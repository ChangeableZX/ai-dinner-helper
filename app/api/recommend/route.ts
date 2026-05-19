export const runtime = 'edge';

import { NextRequest, NextResponse } from 'next/server';
import { buildLightweightSystemPrompt, buildSingleDishUserPrompt } from '@/lib/prompt';
import { parseSingleDish, extractP0Ingredients, checkP0Coverage } from '@/lib/validator';
import { MOCK_SUMMARIES } from '@/lib/mock-data';
import type { RecommendRequest, DishSummary } from '@/types';

type PartialSummary = Omit<DishSummary, 'id'>;

async function generateSingleDish(
  req: RecommendRequest,
  hint: string,
  exclude: string[],
): Promise<PartialSummary | null> {
  const apiKey = process.env.OPENAI_API_KEY!;
  const baseURL = (process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1').replace(/\/$/, '');
  const model = process.env.OPENAI_MODEL || 'gpt-4o-mini';

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 25_000);

  let res: Response;
  try {
    res = await fetch(`${baseURL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: buildLightweightSystemPrompt() },
          { role: 'user', content: buildSingleDishUserPrompt(req, hint, exclude) },
        ],
        temperature: 0.7,
        max_tokens: parseInt(process.env.OPENAI_MAX_TOKENS || '6000', 10),
        response_format: { type: 'json_object' },
      }),
      signal: controller.signal,
    });
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }

  if (!res!.ok) return null;

  const data = await res!.json();
  const content: string = data.choices?.[0]?.message?.content ?? '';
  const finishReason: string = data.choices?.[0]?.finish_reason ?? '';

  console.log(`[recommend/single] model=${model} hint="${hint}" finish_reason=${finishReason} len=${content.length}`);

  if (finishReason === 'length' && content.length === 0) {
    console.error(`[recommend/single] max_tokens 不足（reasoning model 推理耗尽所有 token），请提高 max_tokens`);
    return null;
  }

  const ingredientNames = req.ingredients.map((i) => i.名称);
  return parseSingleDish(content, ingredientNames, req.fatigueLevel);
}

async function dedupeWithRetry(
  dishes: PartialSummary[],
  req: RecommendRequest,
): Promise<PartialSummary[]> {
  const excludedNames = new Set([...req.recentDishes, ...req.exclude]);

  const seen = new Set<string>();
  const unique = dishes.filter((d) => {
    if (!d || seen.has(d.菜名) || excludedNames.has(d.菜名)) return false;
    seen.add(d.菜名);
    return true;
  });

  if (unique.length < 3 && unique.length > 0) {
    const exclude = unique.map((d) => d.菜名);
    const supplementary = await generateSingleDish(req, '与已推荐方案风味不同', exclude);
    if (supplementary && !seen.has(supplementary.菜名) && !excludedNames.has(supplementary.菜名)) {
      console.log(`[recommend] 补单成功：${supplementary.菜名}`);
      unique.push(supplementary);
    }
  }

  return unique;
}

export async function POST(request: NextRequest) {
  try {
    const body: RecommendRequest = await request.json();
    const ingredientNames = body.ingredients.map((i) => i.名称);

    // Mock 模式
    if (!process.env.OPENAI_API_KEY) {
      await new Promise((r) => setTimeout(r, 1500));
      return NextResponse.json({ success: true, 方案: MOCK_SUMMARIES });
    }

    // 3 个并发请求，每个生成 1 道菜，hint 引导风味差异
    const hints = ['偏炒/煎/烤类', '偏蒸/煮/炖/焖类', '偏拌/快手或汤类'];
    const promises = hints.map((hint) => generateSingleDish(body, hint, []));

    const results = await Promise.all(promises);
    const validResults = results.filter(Boolean) as PartialSummary[];

    if (validResults.length === 0) {
      return NextResponse.json(
        { success: false, error: '今天这些食材想不到好方案，刚才走神了，再试一次' },
        { status: 500 },
      );
    }

    // 去重 + 补单
    const deduped = await dedupeWithRetry(validResults, body);

    if (deduped.length === 0) {
      return NextResponse.json(
        { success: false, error: '今天家里有点空，补点蛋白质或绿叶菜再试试' },
      );
    }

    // 分配 ID
    const summaries: DishSummary[] = deduped.map((d, i) => ({
      ...d,
      id: `rec_${Date.now()}_${i}_${Math.random().toString(36).slice(2, 5)}`,
    }));

    // P0 核心食材覆盖检查（仅附带警告，不重新请求）
    const p0Items = extractP0Ingredients(ingredientNames);
    const missedP0 = checkP0Coverage(summaries, p0Items);
    const p0Warning =
      missedP0.length > 0
        ? `检测到今日有「${missedP0.join('、')}」等核心食材，但推荐方案暂时没能用上，建议直接煎/炒，或重新推荐 😊`
        : undefined;

    return NextResponse.json({ success: true, 方案: summaries, p0Warning });
  } catch (err) {
    console.error('[recommend] Unhandled error:', err);
    return NextResponse.json(
      { success: false, error: '刚才走神了，再试一次' },
      { status: 500 },
    );
  }
}

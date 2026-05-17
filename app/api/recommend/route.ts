import { NextRequest, NextResponse } from 'next/server';
import { buildSystemPrompt, buildUserPrompt } from '@/lib/prompt';
import { parseAndValidateResponse, extractP0Ingredients, checkP0Coverage } from '@/lib/validator';
import { MOCK_RECIPES, MOCK_RECIPES_P0_FAIL, MOCK_P0_WARNING } from '@/lib/mock-data';
import type { RecommendRequest } from '@/types';

async function callLLM(req: RecommendRequest): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY!;
  const baseURL = (process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1').replace(/\/$/, '');
  const model = process.env.OPENAI_MODEL || 'gpt-4o-mini';

  // Hard 50s timeout — route never hangs indefinitely
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 50_000);

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
          { role: 'system', content: buildSystemPrompt() },
          { role: 'user', content: buildUserPrompt(req) },
        ],
        temperature: 0.7,
        max_tokens: 8000,
        response_format: { type: 'json_object' },
      }),
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timer);
  }

  if (!res!.ok) {
    const errBody = await res!.text().catch(() => '');
    throw new Error(`LLM API error ${res!.status}: ${errBody.slice(0, 200)}`);
  }

  const data = await res!.json();
  const choice = data.choices?.[0];
  const content: string = choice?.message?.content ?? '';
  const finishReason: string = choice?.finish_reason ?? 'unknown';

  console.log(`[recommend] model=${model} finish_reason=${finishReason} length=${content.length}`);

  if (finishReason === 'length') {
    throw new Error(`LLM output truncated by max_tokens (finish_reason=length, model=${model}). Raise max_tokens or switch to a non-reasoning model.`);
  }

  return content;
}

export async function POST(request: NextRequest) {
  try {
    const body: RecommendRequest = await request.json();

    // Derive plain string[] for validator (which expects string names)
    const ingredientNames = body.ingredients.map((i) => i.名称);

    // [边界处理] Mock 模式 — 无 API Key 时自动使用 mock 数据演示 UI
    if (!process.env.OPENAI_API_KEY) {
      await new Promise((r) => setTimeout(r, 1500));
      if (process.env.MOCK_FORCE_P0_FAIL === '1') {
        return NextResponse.json({
          success: true,
          recipes: MOCK_RECIPES_P0_FAIL,
          p0Warning: MOCK_P0_WARNING,
        });
      }
      return NextResponse.json({ success: true, recipes: MOCK_RECIPES });
    }

    // First LLM attempt
    let rawText: string;
    try {
      rawText = await callLLM(body);
    } catch {
      return NextResponse.json(
        { success: false, error: '刚才走神了，再试一次' },
        { status: 500 },
      );
    }

    // Parse & validate — single attempt, no retry (avoid double LLM latency)
    let result: ReturnType<typeof parseAndValidateResponse>;
    try {
      result = parseAndValidateResponse(
        rawText,
        ingredientNames,
        body.userProfile.调料库,
        body.fatigueLevel,
      );
    } catch (e) {
      console.error('[recommend] parse failed:', String(e), '| raw:', rawText.slice(0, 200));
      return NextResponse.json(
        { success: false, error: '刚才走神了，再试一次' },
        { status: 500 },
      );
    }

    // [边界处理] 全部方案被虚构食材过滤
    if (result.recipes.length === 0) {
      return NextResponse.json({
        success: false,
        error: '今天家里有点空，补点鸡蛋或绿叶菜就能搞定一顿了',
        suggestion: '建议补充：鸡蛋、绿叶菜、豆腐等食材',
      });
    }

    // [P0] 检查核心食材覆盖，仅附带警告，不额外调用 LLM（避免超时）
    const p0Items = extractP0Ingredients(ingredientNames);
    const missedP0 = checkP0Coverage(result.recipes, p0Items);
    const p0Warning =
      missedP0.length > 0
        ? `检测到今日有「${missedP0.join('、')}」等核心食材，但推荐方案暂时没能用上，建议直接煎/炒，或重新推荐 😊`
        : undefined;

    return NextResponse.json({ success: true, recipes: result.recipes, p0Warning });
  } catch (err) {
    console.error('[recommend] Unhandled error:', err);
    return NextResponse.json(
      { success: false, error: '刚才走神了，再试一次' },
      { status: 500 },
    );
  }
}

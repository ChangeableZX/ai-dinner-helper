export const runtime = 'edge';

import { NextRequest, NextResponse } from 'next/server';
import { buildDetailSystemPrompt, buildDetailUserPrompt } from '@/lib/prompt';
import { parseDetailResponse } from '@/lib/validator';
import { MOCK_DETAIL_MAP } from '@/lib/mock-data';
import type { RecipeDetailRequest } from '@/types';

async function callDetailLLM(req: RecipeDetailRequest): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY!;
  const baseURL = (process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1').replace(/\/$/, '');
  const model = process.env.OPENAI_MODEL || 'gpt-4o-mini';

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 30_000);

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
          { role: 'system', content: buildDetailSystemPrompt() },
          { role: 'user', content: buildDetailUserPrompt(req) },
        ],
        temperature: 0.5,
        max_tokens: 1500,
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

  console.log(`[recipe-detail] model=${model} dish="${req.菜名}" finish_reason=${finishReason} len=${content.length}`);

  if (finishReason === 'length') {
    throw new Error('LLM output truncated (finish_reason=length). Raise max_tokens.');
  }

  return content;
}

export async function POST(request: NextRequest) {
  let body: RecipeDetailRequest;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: '请求格式错误' }, { status: 400 });
  }

  const userIngredients = body.今日食材.map((i) => i.名称);
  const userSeasonings = body.user_profile.调料库;

  // Mock 模式
  if (!process.env.OPENAI_API_KEY) {
    await new Promise((r) => setTimeout(r, 8000));
    const mockDetail = MOCK_DETAIL_MAP[body.菜名] ?? MOCK_DETAIL_MAP['西红柿炒鸡蛋'];
    return NextResponse.json(mockDetail);
  }

  // 第一次尝试
  let rawText: string;
  try {
    rawText = await callDetailLLM(body);
  } catch (e) {
    const msg = String(e);
    if (msg.includes('AbortError') || msg.includes('abort')) {
      return NextResponse.json(
        { error: '菜谱生成超时，请重试' },
        { status: 504 },
      );
    }
    return NextResponse.json(
      { error: '刚才走神了，再试一次' },
      { status: 500 },
    );
  }

  // 解析 + 校验
  try {
    const detail = parseDetailResponse(rawText, userIngredients, userSeasonings);
    return NextResponse.json(detail);
  } catch (e) {
    const msg = String(e);
    console.warn('[recipe-detail] parse failed, retrying:', msg);

    // 重试一次
    try {
      const rawText2 = await callDetailLLM(body);
      const detail = parseDetailResponse(rawText2, userIngredients, userSeasonings);
      return NextResponse.json(detail);
    } catch (e2) {
      const msg2 = String(e2);
      console.error('[recipe-detail] retry also failed:', msg2);

      if (msg2.includes('FABRICATED')) {
        return NextResponse.json(
          { error: 'AI 推荐了不存在的食材，请重试' },
          { status: 400 },
        );
      }
      return NextResponse.json(
        { error: '菜谱生成失败，请重试' },
        { status: 500 },
      );
    }
  }
}

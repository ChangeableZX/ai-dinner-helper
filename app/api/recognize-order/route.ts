import { NextRequest, NextResponse } from 'next/server';
import { ORDER_RECOGNIZE_SYSTEM_PROMPT } from '@/lib/order-recognize-prompt';
import { autoCategorize } from '@/lib/auto-categorize';
import type { Category } from '@/types';

const CATEGORY_MAP: Record<string, Category> = {
  蛋白质: '肉蛋海鲜', // legacy label the LLM might still emit
  肉蛋海鲜: '肉蛋海鲜',
  蔬菜: '蔬菜',
  主食: '主食',
  调料: '调料',
  其他: '其他',
};

function normalizeCategory(raw: string | undefined | null, name: string): Category {
  if (!raw) return autoCategorize(name);
  return CATEGORY_MAP[raw] ?? autoCategorize(name);
}

function extractJSON(text: string): string {
  const match = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  return match ? match[1] : text.trim();
}

const MOCK_ITEMS = [
  { 名称: '牛肉',   类别: '肉蛋海鲜' as Category, 数量描述: '500g',  置信度: '高' as const },
  { 名称: '上海青', 类别: '蔬菜'     as Category, 数量描述: '一把',  置信度: '高' as const },
  { 名称: '番茄',   类别: '蔬菜'     as Category, 数量描述: '2 个',  置信度: '高' as const },
  { 名称: '平菇',   类别: '蔬菜'     as Category, 数量描述: '一盒',  置信度: '中' as const },
  { 名称: '鸡蛋',   类别: '肉蛋海鲜' as Category, 数量描述: '6 个',  置信度: '高' as const },
];

export async function POST(req: NextRequest) {
  try {
    const { imageBase64 } = await req.json();

    if (!imageBase64 || typeof imageBase64 !== 'string') {
      return NextResponse.json({ success: false, error: '缺少图片数据' }, { status: 400 });
    }

    if (!process.env.OPENAI_API_KEY || process.env.MOCK_MODE === 'true') {
      await new Promise((r) => setTimeout(r, 2000));
      return NextResponse.json({ success: true, items: MOCK_ITEMS, warnings: [] });
    }

    const apiKey = process.env.OPENAI_API_KEY;
    const baseURL = (process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1').replace(/\/$/, '');
    const model = process.env.OPENAI_VISION_MODEL || process.env.OPENAI_MODEL || 'gpt-4o-mini';

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15_000);

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
            { role: 'system', content: ORDER_RECOGNIZE_SYSTEM_PROMPT },
            {
              role: 'user',
              content: [
                { type: 'text', text: '请识别这张订单截图里的食材。' },
                { type: 'image_url', image_url: { url: imageBase64 } },
              ],
            },
          ],
          temperature: 0.1,
          max_tokens: 2000,
        }),
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timer);
    }

    if (!res!.ok) {
      const errBody = await res!.text().catch(() => '');
      console.error('[recognize-order] upstream error', res!.status, errBody.slice(0, 400));
      const status = res!.status;
      if (status === 401) throw new Error('API 密钥配置错误');
      if (status === 429) throw new Error('请求太频繁，稍后再试');
      throw new Error(`识别失败（${status}），请重试`);
    }

    const data = await res!.json();
    const raw: string = data.choices?.[0]?.message?.content ?? '{}';

    let parsed: { items?: unknown[]; warnings?: string[] };
    try {
      parsed = JSON.parse(extractJSON(raw));
    } catch {
      return NextResponse.json({ success: false, error: 'AI 返回格式异常，请重试' }, { status: 500 });
    }

    if (!Array.isArray(parsed.items)) {
      return NextResponse.json({ success: false, error: 'AI 返回格式异常，请重试' }, { status: 500 });
    }

    const items = (parsed.items as Array<Record<string, string>>)
      .map((item) => ({
        名称: String(item.名称 ?? '').trim(),
        类别: normalizeCategory(item.类别, String(item.名称 ?? '')),
        数量描述: item.数量描述 && item.数量描述 !== 'null' ? String(item.数量描述) : undefined,
        置信度: (['高', '中', '低'].includes(item.置信度) ? item.置信度 : '中') as '高' | '中' | '低',
      }))
      .filter((item) => item.名称.length > 0);

    return NextResponse.json({ success: true, items, warnings: parsed.warnings ?? [] });
  } catch (err: unknown) {
    console.error('[recognize-order]', err);
    const msg = err instanceof Error ? err.message : '';
    let errorMsg = '识别失败，请重试';
    if (msg.includes('abort') || msg.includes('timeout')) errorMsg = 'AI 走神了，要不要重试？';
    else if (msg.includes('Failed to fetch') || msg.includes('network')) errorMsg = '网络不太好，请检查后重试';
    else if (msg.length > 0 && msg.length < 30) errorMsg = msg;
    return NextResponse.json({ success: false, error: errorMsg }, { status: 500 });
  }
}

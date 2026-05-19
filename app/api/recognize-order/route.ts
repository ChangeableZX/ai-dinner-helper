export const runtime = 'edge';

import { NextRequest, NextResponse } from 'next/server';
import { recognizeText } from '@/lib/baidu-ocr';
import { ORDER_PARSE_SYSTEM_PROMPT } from '@/lib/order-recognize-prompt';
import { autoCategorize } from '@/lib/auto-categorize';
import type { Category } from '@/types';

// Maps legacy or LLM-emitted category strings to valid Category values
const INGREDIENT_CATEGORY_MAP: Record<string, Category> = {
  蛋白质:  '肉蛋海鲜', // legacy label
  肉蛋海鲜: '肉蛋海鲜',
  蔬菜:   '蔬菜',
  主食:   '主食',
  其他:   '其他',
};

function normalizeIngredientCategory(raw: string | undefined | null, name: string): Category {
  if (!raw) return autoCategorize(name);
  return INGREDIENT_CATEGORY_MAP[raw] ?? autoCategorize(name);
}

function extractJSON(text: string): string {
  const match = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  return match ? match[1] : text.trim();
}

// ─── Mock data ────────────────────────────────────────────────────
const MOCK_食材 = [
  { 名称: '牛肉',   类别: '肉蛋海鲜' as Category, 数量描述: '500g',  置信度: '高' as const },
  { 名称: '上海青', 类别: '蔬菜'     as Category, 数量描述: '一把',  置信度: '高' as const },
  { 名称: '番茄',   类别: '蔬菜'     as Category, 数量描述: '2 个',  置信度: '高' as const },
];
const MOCK_调料 = [
  { 名称: '生抽', 数量描述: '500ml', 置信度: '高' as const },
  { 名称: '蚝油', 数量描述: '一瓶',  置信度: '高' as const },
];

// ─── Response shape ───────────────────────────────────────────────
export interface RecognizeOrderResponse {
  success: boolean;
  食材?: Array<{ 名称: string; 类别: Category; 数量描述?: string; 置信度: '高' | '中' | '低' }>;
  调料?: Array<{ 名称: string; 数量描述?: string; 置信度: '高' | '中' | '低' }>;
  warnings?: string[];
  error?: string;
}

export async function POST(req: NextRequest) {
  try {
    const { imageBase64 } = await req.json();

    if (!imageBase64 || typeof imageBase64 !== 'string') {
      return NextResponse.json({ success: false, error: '缺少图片数据' }, { status: 400 });
    }

    // Mock 模式
    if (!process.env.OPENAI_API_KEY || process.env.MOCK_MODE === 'true') {
      await new Promise((r) => setTimeout(r, 1500));
      return NextResponse.json({ success: true, 食材: MOCK_食材, 调料: MOCK_调料, warnings: [] });
    }

    // === 第一步：百度 OCR 提取文字 ===
    let ocrLines: string[];
    try {
      ocrLines = await recognizeText(imageBase64);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : '未知错误';
      console.error('[recognize-order] OCR error:', message);
      if (message.includes('未配置')) {
        await new Promise((r) => setTimeout(r, 1000));
        return NextResponse.json({
          success: true,
          食材: MOCK_食材,
          调料: MOCK_调料,
          warnings: ['OCR 未配置，已返回示例数据'],
        });
      }
      return NextResponse.json(
        { success: false, error: '图片识别失败，换张清晰的图试试' },
        { status: 500 },
      );
    }

    if (ocrLines.length === 0) {
      return NextResponse.json({ success: true, 食材: [], 调料: [], warnings: ['图片里没识别到文字'] });
    }

    const ocrText = ocrLines.join('\n');

    // === 第二步：LLM 解析为结构化食材 + 调料 ===
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
            { role: 'system', content: ORDER_PARSE_SYSTEM_PROMPT },
            { role: 'user', content: `这是 OCR 识别出的订单文字，请提取食材和调料：\n\n${ocrText}` },
          ],
          response_format: { type: 'json_object' },
          temperature: 0.1,
          max_tokens: 1200,
        }),
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timer);
    }

    if (!res!.ok) {
      const errBody = await res!.text().catch(() => '');
      console.error('[recognize-order] LLM error', res!.status, errBody.slice(0, 300));
      const status = res!.status;
      if (status === 401) throw new Error('API 密钥配置错误');
      if (status === 429) throw new Error('请求太频繁，稍后再试');
      throw new Error(`解析失败（${status}），请重试`);
    }

    const data = await res!.json();
    const raw: string = data.choices?.[0]?.message?.content ?? '{}';

    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(extractJSON(raw));
    } catch {
      return NextResponse.json({ success: false, error: 'AI 返回格式异常，请重试' }, { status: 500 });
    }

    // Support new format (食材/调料) and legacy fallback (items)
    const rawIngredients = Array.isArray(parsed['食材'])
      ? (parsed['食材'] as Array<Record<string, string>>)
      : Array.isArray(parsed['items'])
        ? (parsed['items'] as Array<Record<string, string>>)
        : [];

    const rawSeasonings = Array.isArray(parsed['调料'])
      ? (parsed['调料'] as Array<Record<string, string>>)
      : [];

    const 食材 = rawIngredients
      .map((item) => ({
        名称: String(item['名称'] ?? '').trim(),
        类别: normalizeIngredientCategory(item['类别'], String(item['名称'] ?? '')),
        数量描述: item['数量描述'] && item['数量描述'] !== 'null' ? String(item['数量描述']) : undefined,
        置信度: (['高', '中', '低'].includes(item['置信度']) ? item['置信度'] : '中') as '高' | '中' | '低',
      }))
      .filter((item) => item.名称.length > 0);

    const 调料 = rawSeasonings
      .map((item) => ({
        名称: String(item['名称'] ?? '').trim(),
        数量描述: item['数量描述'] && item['数量描述'] !== 'null' ? String(item['数量描述']) : undefined,
        置信度: (['高', '中', '低'].includes(item['置信度']) ? item['置信度'] : '中') as '高' | '中' | '低',
      }))
      .filter((item) => item.名称.length > 0);

    return NextResponse.json({
      success: true,
      食材,
      调料,
      warnings: Array.isArray(parsed['warnings']) ? parsed['warnings'] : [],
      ...(process.env.NODE_ENV === 'development' ? { _debug_ocr_text: ocrText } : {}),
    });
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

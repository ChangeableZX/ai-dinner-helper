import { supabase, isSupabaseEnabled } from '@/lib/supabase/client';
import { getUserId } from './user';

// ─── 类型 ─────────────────────────────────────────────────────────

interface SaveFeedbackParams {
  sessionId?: string | null;
  dishName: string;
  rating: 'good' | 'ok' | 'bad' | null;
  issueTags?: string[];
  freeText?: string;
  ingredientsUsedUp?: string[];
  completed?: boolean;
}

// 映射应用层 rating 值（英文）→ DB 值（中文）
const RATING_MAP: Record<'good' | 'ok' | 'bad', '好吃' | '一般' | '不好'> = {
  good: '好吃',
  ok:   '一般',
  bad:  '不好',
};

// ─── 公共 API ─────────────────────────────────────────────────────

/**
 * 保存烹饪反馈
 * localStorage 通过 STORAGE_KEYS.HISTORY 保存完整历史，这里仅做 Supabase 侧的补充记录
 * 失败静默处理，绝不影响主流程
 */
export async function saveCookingFeedback(params: SaveFeedbackParams): Promise<void> {
  if (!isSupabaseEnabled()) return;

  try {
    const userId = await getUserId();
    if (!userId) return;

    await supabase!.from('cooking_feedback').insert({
      user_id: userId,
      session_id: params.sessionId ?? null,
      dish_name: params.dishName,
      rating: params.rating ? RATING_MAP[params.rating] : null,
      issue_tags: params.issueTags ?? [],
      free_text: params.freeText ?? null,
      ingredients_used_up: params.ingredientsUsedUp ?? [],
      completed: params.completed ?? false,
    });
  } catch (err) {
    console.error('[data/feedback] Failed to save feedback:', err);
  }
}

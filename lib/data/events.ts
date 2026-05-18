import { supabase, isSupabaseEnabled } from '@/lib/supabase/client';
import { getUserId } from './user';

/**
 * 记录用户行为事件
 *
 * 使用示例:
 *   trackEvent('recommend_submitted', { fatigue_level: 2, ingredient_count: 5 })
 *   trackEvent('recipe_viewed', { dish_name: '番茄炒蛋' })
 *   trackEvent('feedback_submitted', { rating: '好吃' })
 *
 * 注意：
 * - 埋点失败绝不影响主流程，全部静默处理
 * - Supabase 不可用时自动跳过，无 localStorage 降级（埋点非核心功能）
 */
export async function trackEvent(
  eventName: string,
  properties?: Record<string, unknown>,
): Promise<void> {
  if (!isSupabaseEnabled()) return;

  try {
    const userId = await getUserId();
    if (!userId) return;

    await supabase!.from('events').insert({
      user_id: userId,
      event_name: eventName,
      properties: properties ?? {},
    });
  } catch {
    // 永远静默：埋点失败不能破坏用户体验
  }
}

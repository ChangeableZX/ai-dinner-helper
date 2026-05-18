import { supabase, isSupabaseEnabled } from '@/lib/supabase/client';
import { getUserId } from './user';
import type { SelectedIngredient, FatigueLevel, FoodPreference, DishSummary } from '@/types';

// ─── 公共 API ─────────────────────────────────────────────────────

interface CreateSessionParams {
  inputIngredients: SelectedIngredient[];
  fatigueLevel: FatigueLevel;
  foodPreference: FoodPreference;
  recommendedDishes: DishSummary[];
  totalDurationMs?: number;
}

/**
 * 记录一次推荐会话
 * localStorage 无等价存储，Supabase 不可用时返回 null（非阻塞）
 */
export async function createRecipeSession(
  params: CreateSessionParams,
): Promise<string | null> {
  if (!isSupabaseEnabled()) return null;

  try {
    const userId = await getUserId();
    if (!userId) return null;

    const { data, error } = await supabase!
      .from('recipe_sessions')
      .insert({
        user_id: userId,
        input_ingredients: params.inputIngredients,
        fatigue_level: params.fatigueLevel,
        food_preference: params.foodPreference,
        recommended_dishes: params.recommendedDishes,
        total_duration_ms: params.totalDurationMs ?? null,
      })
      .select('id')
      .single();

    if (error || !data) {
      console.error('[data/session] Failed to create session:', error);
      return null;
    }

    return (data as { id: string }).id;
  } catch (err) {
    console.error('[data/session] Unexpected error:', err);
    return null;
  }
}

/**
 * 记录用户选择了哪道菜
 */
export async function updateSessionSelection(
  sessionId: string,
  selectedDishId: string,
): Promise<void> {
  if (!isSupabaseEnabled()) return;
  try {
    await supabase!
      .from('recipe_sessions')
      .update({ selected_dish_id: selectedDishId })
      .eq('id', sessionId);
  } catch {
    // 非核心操作，静默处理
  }
}

/**
 * 记录用户点了"换一批"
 */
export async function incrementSessionRetry(sessionId: string): Promise<void> {
  if (!isSupabaseEnabled()) return;
  try {
    const { data } = await supabase!
      .from('recipe_sessions')
      .select('regenerate_count')
      .eq('id', sessionId)
      .single();

    if (data) {
      await supabase!
        .from('recipe_sessions')
        .update({ regenerate_count: ((data as { regenerate_count: number }).regenerate_count ?? 0) + 1 })
        .eq('id', sessionId);
    }
  } catch {
    // 非核心操作，静默处理
  }
}

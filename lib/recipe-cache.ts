import { create } from 'zustand';
import type { Recipe, DishSummary, RawRecipeDetail, Ingredient } from '@/types';
import { loosematch, extractP0Ingredients } from '@/lib/validator';

// ─── Zustand 缓存 store ──────────────────────────────────────────────

interface RecipeCacheState {
  cache: Map<string, Recipe>;
  loading: Set<string>;
  setRecipe: (id: string, recipe: Recipe) => void;
  setLoading: (id: string, loading: boolean) => void;
  getRecipe: (id: string) => Recipe | undefined;
  isLoading: (id: string) => boolean;
  clear: () => void;
}

export const useRecipeCache = create<RecipeCacheState>((set, get) => ({
  cache: new Map(),
  loading: new Set(),

  setRecipe: (id, recipe) =>
    set((state) => {
      const newCache = new Map(state.cache);
      newCache.set(id, recipe);
      const newLoading = new Set(state.loading);
      newLoading.delete(id);
      return { cache: newCache, loading: newLoading };
    }),

  setLoading: (id, isLoading) =>
    set((state) => {
      const newLoading = new Set(state.loading);
      isLoading ? newLoading.add(id) : newLoading.delete(id);
      return { loading: newLoading };
    }),

  getRecipe: (id) => get().cache.get(id),

  isLoading: (id) => get().loading.has(id),

  clear: () => set({ cache: new Map(), loading: new Set() }),
}));

// ─── 转换：RawRecipeDetail + DishSummary → Recipe ───────────────────

export function toRecipe(
  summary: DishSummary,
  raw: RawRecipeDetail,
  userIngredients: string[],
): Recipe {
  const ingredients: Ingredient[] = raw.食材.map((i) => ({
    name: i.名称,
    amount: i.数量,
    source: i.来源 === '调料库' ? '调料库' : '今日食材',
  }));

  const todayIngNames = ingredients
    .filter((i) => i.source === '今日食材')
    .map((i) => i.name);

  const usedCount = userIngredients.filter((ui) =>
    todayIngNames.some((n) => loosematch([n], ui))
  ).length;

  const ingredientUsageRate =
    userIngredients.length > 0
      ? Math.round((usedCount / userIngredients.length) * 100) / 100
      : 0;

  const p0Items = extractP0Ingredients(userIngredients);
  const usedCoreIngredients = p0Items.filter((p0) =>
    todayIngNames.some((n) => loosematch([n], p0))
  );

  return {
    id: summary.id,
    name: summary.菜名,
    reason: summary.适配理由,
    durationMinutes: summary.耗时分钟,
    difficulty: summary.难度,
    hasSmoke: summary.是否油烟,
    utensils: raw.厨具 ?? [],
    ingredients,
    prepSteps: (raw.预处理 ?? []).map((p) => ({
      action: p.动作,
      durationSeconds: Math.round(p.耗时分钟 * 60),
    })),
    cookingSteps: (raw.步骤 ?? []).map((s) => ({
      order: s.序号,
      action: s.动作,
      durationSeconds: s.耗时分钟 > 0 ? Math.round(s.耗时分钟 * 60) : undefined,
      keyTip: s.关键提示 || undefined,
      parallelTask: s.并行任务 || undefined,
    })),
    usedCoreIngredients,
    ingredientUsageRate,
  };
}

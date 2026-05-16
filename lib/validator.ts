import type { Recipe, Ingredient } from '@/types';

interface RawStep {
  序号: number;
  动作: string;
  耗时秒?: number;
  关键提示?: string;
  并行任务?: string;
}

interface RawRecipe {
  菜名: string;
  适配理由: string;
  耗时分钟: number;
  难度: string;
  是否油烟: boolean;
  厨具: string[];
  食材: Array<{ 名称: string; 数量: string; 来源: string }>;
  预处理: Array<{ 动作: string; 耗时秒: number }>;
  步骤: RawStep[];
  使用的核心食材?: string[];
  食材使用率?: number;
}

// P0 核心食材关键词（蛋白质/主食材）
const P0_KEYWORDS = ['肉', '牛', '羊', '猪', '鸡', '鸭', '鱼', '虾', '贝', '蛋', '豆腐', '豆皮', '排骨', '腊肠', '火腿'];

export function extractP0Ingredients(userIngredients: string[]): string[] {
  return userIngredients.filter((ing) => P0_KEYWORDS.some((kw) => ing.includes(kw)));
}

export function checkP0Coverage(recipes: Recipe[], p0Items: string[]): string[] {
  if (p0Items.length === 0) return [];
  const usedP0 = new Set(recipes.flatMap((r) => r.usedCoreIngredients));
  return p0Items.filter((item) => !usedP0.has(item));
}

function normalise(s: string): string {
  return s.toLowerCase().replace(/\s+/g, '').replace(/[（()）]/g, '');
}

function loosematch(haystack: string[], needle: string): boolean {
  const n = normalise(needle);
  return haystack.some((h) => {
    const hh = normalise(h);
    return hh.includes(n) || n.includes(hh);
  });
}

export function parseAndValidateResponse(
  raw: string,
  userIngredients: string[],
  userSeasonings: string[],
  fatigueLevel: number,
): { recipes: Recipe[] } {
  let jsonStr = raw.trim();

  // Strip markdown code fences if present
  const fence = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fence) jsonStr = fence[1].trim();

  let parsed: { 方案: RawRecipe[] };
  try {
    parsed = JSON.parse(jsonStr);
  } catch {
    throw new Error('JSON_PARSE_FAILED');
  }

  if (!parsed['方案'] || !Array.isArray(parsed['方案'])) {
    throw new Error('INVALID_STRUCTURE');
  }

  const maxMinutes = fatigueLevel === 1 ? 15 : fatigueLevel === 2 ? 25 : 40;
  const p0Items = extractP0Ingredients(userIngredients);

  const validRecipes: Recipe[] = [];

  for (const r of parsed['方案']) {
    // [边界处理] 超时方案过滤
    if ((r['耗时分钟'] ?? 0) > maxMinutes) continue;

    // [边界处理] 虚构食材检测 — 有任何虚构则过滤该方案
    let valid = true;
    for (const ing of r['食材'] ?? []) {
      const name = ing['名称'] ?? '';
      if (ing['来源'] === '今日食材') {
        if (!loosematch(userIngredients, name)) { valid = false; break; }
      } else if (ing['来源'] === '调料库') {
        if (!loosematch(userSeasonings, name)) { valid = false; break; }
      }
    }
    if (!valid) continue;

    // Compute usedCoreIngredients from actual recipe ingredients (don't trust LLM)
    const recipeIngredientNames = (r['食材'] ?? [])
      .filter((i) => i['来源'] === '今日食材')
      .map((i) => i['名称']);

    const usedCoreIngredients = p0Items.filter((p0Item) =>
      loosematch(recipeIngredientNames, p0Item)
    );

    // Compute ingredientUsageRate from actual recipe ingredients
    const usedCount = userIngredients.filter((ui) =>
      loosematch(recipeIngredientNames, ui)
    ).length;
    const ingredientUsageRate =
      userIngredients.length > 0
        ? Math.round((usedCount / userIngredients.length) * 100) / 100
        : 0;

    const recipe: Recipe = {
      id: `recipe_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      name: r['菜名'] ?? '未命名',
      reason: r['适配理由'] ?? '',
      durationMinutes: r['耗时分钟'] ?? 15,
      difficulty: (r['难度'] as Recipe['difficulty']) ?? '简单',
      hasSmoke: r['是否油烟'] ?? false,
      utensils: r['厨具'] ?? [],
      ingredients: (r['食材'] ?? []).map((i): Ingredient => ({
        name: i['名称'],
        amount: i['数量'],
        source: i['来源'] as Ingredient['source'],
      })),
      prepSteps: (r['预处理'] ?? []).map((p) => ({
        action: p['动作'],
        durationSeconds: p['耗时秒'] ?? 0,
      })),
      cookingSteps: (r['步骤'] ?? []).map((s) => ({
        order: s['序号'],
        action: s['动作'],
        durationSeconds: s['耗时秒'],
        keyTip: s['关键提示'] || undefined,
        parallelTask: s['并行任务'] || undefined,
      })),
      usedCoreIngredients,
      ingredientUsageRate,
    };

    validRecipes.push(recipe);
  }

  return { recipes: validRecipes };
}

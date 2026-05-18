import type { DishSummary, RawRecipeDetail } from '@/types';

// P0 核心食材关键词（蛋白质/主食材）
const P0_KEYWORDS = ['肉', '牛', '羊', '猪', '鸡', '鸭', '鱼', '虾', '贝', '蛋', '豆腐', '豆皮', '排骨', '腊肠', '火腿'];

export function extractP0Ingredients(userIngredients: string[]): string[] {
  return userIngredients.filter((ing) => P0_KEYWORDS.some((kw) => ing.includes(kw)));
}

export function checkP0Coverage(summaries: DishSummary[], p0Items: string[]): string[] {
  if (p0Items.length === 0) return [];
  const allUsed = summaries.flatMap((s) => s.使用的食材);
  return p0Items.filter((p0) => !loosematch(allUsed, p0));
}

export function normalise(s: string): string {
  return s.toLowerCase().replace(/\s+/g, '').replace(/[（()）]/g, '');
}

export function loosematch(haystack: string[], needle: string): boolean {
  const n = normalise(needle);
  return haystack.some((h) => {
    const hh = normalise(h);
    return hh.includes(n) || n.includes(hh);
  });
}

// ─── 推荐 API（精简卡片，单道菜）────────────────────────────────────

type PartialSummary = Omit<DishSummary, 'id'>;

export function parseSingleDish(
  raw: string,
  userIngredients: string[],
  fatigueLevel: number,
): PartialSummary | null {
  let jsonStr = raw.trim();
  const fence = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fence) jsonStr = fence[1].trim();

  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(jsonStr);
  } catch {
    return null;
  }

  const 菜名 = parsed['菜名'];
  const 适配理由 = parsed['适配理由'];
  const 耗时分钟 = parsed['耗时分钟'];
  const 难度 = parsed['难度'];
  const 是否油烟 = parsed['是否油烟'];
  const 使用的食材 = parsed['使用的食材'];

  if (
    typeof 菜名 !== 'string' ||
    typeof 适配理由 !== 'string' ||
    typeof 耗时分钟 !== 'number' ||
    typeof 难度 !== 'string' ||
    typeof 是否油烟 !== 'boolean' ||
    !Array.isArray(使用的食材)
  ) {
    return null;
  }

  // 疲劳度时间上限（留 5 分钟弹性）
  const maxMinutes = fatigueLevel === 1 ? 15 : fatigueLevel === 2 ? 25 : 35;
  if (耗时分钟 > maxMinutes) return null;

  // 食材不能为空
  if ((使用的食材 as string[]).length === 0) return null;

  // 软校验：至少有一种食材能在用户食材中找到匹配
  const hasMatch = (使用的食材 as string[]).some((f) => loosematch(userIngredients, f as string));
  if (!hasMatch) return null;

  return {
    菜名: 菜名 as string,
    适配理由: (适配理由 as string).slice(0, 20),
    耗时分钟: Math.round(耗时分钟 as number),
    难度: (['极简', '简单', '中等'].includes(难度 as string) ? 难度 : '简单') as DishSummary['难度'],
    是否油烟: 是否油烟 as boolean,
    使用的食材: (使用的食材 as unknown[]).filter((f) => typeof f === 'string') as string[],
  };
}

// ─── 详情 API（完整菜谱）────────────────────────────────────────────

export function parseDetailResponse(
  raw: string,
  userIngredients: string[],
  userSeasonings: string[],
): RawRecipeDetail {
  let jsonStr = raw.trim();
  const fence = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fence) jsonStr = fence[1].trim();

  let parsed: RawRecipeDetail;
  try {
    parsed = JSON.parse(jsonStr) as RawRecipeDetail;
  } catch {
    throw new Error('JSON_PARSE_FAILED');
  }

  if (
    typeof parsed['菜名'] !== 'string' ||
    !Array.isArray(parsed['食材']) ||
    !Array.isArray(parsed['步骤']) ||
    parsed['步骤'].length === 0
  ) {
    throw new Error('INVALID_STRUCTURE');
  }

  // 虚构食材检测
  for (const ing of parsed['食材']) {
    const name = ing['名称'] ?? '';
    if (ing['来源'] === '调料库') {
      if (!loosematch(userSeasonings, name)) {
        throw new Error(`FABRICATED_SEASONING: ${name}`);
      }
    } else {
      if (!loosematch(userIngredients, name)) {
        throw new Error(`FABRICATED_INGREDIENT: ${name}`);
      }
    }
  }

  return parsed;
}

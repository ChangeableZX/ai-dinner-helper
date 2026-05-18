export interface UserProfile {
  seasonings: string[];
  equipment: string[];
  skillLevel: 'beginner' | 'intermediate' | 'advanced';
  spiceLevel: number; // 1-5
  avoidances: string[];
  servings: 1 | 2 | 3;
  setupCompleted: boolean;
}

export type FatigueLevel = 1 | 2 | 3;

export type FoodPreference = 'clear_stock' | 'default' | 'fresh_first';

export type FreshnessLevel = '新鲜' | '该吃了' | '可能过期';

export interface SelectedIngredient {
  名称: string;
  来源: '实时输入' | '库存' | '临时输入';
  库存ID?: string;
  新鲜度?: FreshnessLevel;
}

export interface IngredientUsageStats {
  已用库存食材: string[];
  已用今日输入: string[];
  未用上的库存: string[];
}

export interface Ingredient {
  name: string;
  amount: string;
  source: '今日食材' | '调料库';
}

export interface PrepStep {
  action: string;
  durationSeconds: number;
}

export interface CookingStep {
  order: number;
  action: string;
  durationSeconds?: number;
  keyTip?: string;
  parallelTask?: string;
}

export interface Recipe {
  id: string;
  name: string;
  reason: string;
  durationMinutes: number;
  difficulty: '极简' | '简单' | '中等';
  hasSmoke: boolean;
  utensils: string[];
  ingredients: Ingredient[];
  prepSteps: PrepStep[];
  cookingSteps: CookingStep[];
  /** P0 级核心食材中被本菜用上的项 */
  usedCoreIngredients: string[];
  /** 用户今日食材中被本菜使用的比例 0-1 */
  ingredientUsageRate: number;
  食材使用统计?: IngredientUsageStats;
}

// ─── 两段式方案新增类型 ────────────────────────────────────────────

/** 推荐 API 返回的精简标题卡（不含步骤、不含食材数量） */
export interface DishSummary {
  id: string;
  菜名: string;
  适配理由: string;
  耗时分钟: number;
  难度: '极简' | '简单' | '中等';
  是否油烟: boolean;
  使用的食材: string[];
}

/** 详情 API 从 LLM 拿到的原始 JSON 结构（中文字段） */
export interface RawRecipeDetail {
  菜名: string;
  厨具: string[];
  食材: Array<{ 名称: string; 数量: string; 来源: '今日输入' | '库存' | '调料库' }>;
  预处理: Array<{ 动作: string; 耗时分钟: number }>;
  步骤: Array<{
    序号: number;
    动作: string;
    耗时分钟: number;
    关键提示?: string;
    并行任务?: string;
  }>;
}

/** 详情 API 的请求体 */
export interface RecipeDetailRequest {
  菜名: string;
  推荐时的食材: string[];
  user_profile: {
    调料库: string[];
    设备: string[];
    技能等级: string;
    辣度: number;
    忌口: string[];
    人数: number;
  };
  今日食材: SelectedIngredient[];
  疲劳度: FatigueLevel;
  食材偏好: FoodPreference;
}

// ─── 原有类型保留（其他页面依赖）────────────────────────────────────

export interface FeedbackData {
  reasons?: string[];
  note?: string;
}

export interface HistoryRecord {
  id: string;
  date: string;
  recipeName: string;
  recipe: Recipe;
  rating: 'good' | 'ok' | 'bad' | null;
  feedback?: FeedbackData;
  ingredients: string[];
  fatigueLevel: FatigueLevel;
}

export interface RecommendRequest {
  ingredients: SelectedIngredient[];
  fatigueLevel: FatigueLevel;
  food_preference: FoodPreference;
  userProfile: {
    调料库: string[];
    设备: string[];
    技能等级: string;
    辣度: number;
    忌口: string[];
    人数: number;
  };
  recentDishes: string[];
  exclude: string[];
}

export interface RecommendResponse {
  success: boolean;
  方案?: DishSummary[];
  error?: string;
  suggestion?: string;
  p0Warning?: string;
}

export type Category = '肉蛋海鲜' | '蔬菜' | '主食' | '其他';

export interface InventoryItem {
  id: string;
  名称: string;
  入库时间: string;
  来源: '订单识别' | '手动添加' | '实时输入入库';
  状态: '在库' | '已用完';
  备注?: string;
  数量描述?: string;
  类别?: Category;
}

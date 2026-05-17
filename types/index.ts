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
  recipes?: Recipe[];
  error?: string;
  suggestion?: string;
  /** P0 食材仍未覆盖时的 fallback 提示文案 */
  p0Warning?: string;
}

export type Category = '肉蛋海鲜' | '蔬菜' | '主食' | '调料' | '其他';

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

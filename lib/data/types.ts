/**
 * 数据库行类型（镜像 Supabase 表结构）
 * 与应用层类型（types/index.ts）分开定义，各自演化互不影响
 */

export interface DbUser {
  id: string;
  anon_id: string;
  created_at: string;
  last_active_at: string;
  metadata: Record<string, unknown>;
}

export interface DbUserProfile {
  user_id: string;
  skill_level: '新手' | '中等' | '熟手' | null;
  spice_tolerance: number | null;
  default_people_count: number | null;
  taboos: string[];
  seasoning_library: string[];
  equipment: string[];
  category_memory: Record<string, unknown>;
  metadata: Record<string, unknown>;
  updated_at: string;
}

export interface DbInventoryItem {
  id: string;
  user_id: string;
  name: string;
  category: '肉蛋海鲜' | '蔬菜' | '主食' | '其他' | null;
  source: '订单识别' | '手动添加' | '实时输入入库' | null;
  status: '在库' | '已用完';
  added_at: string;
  used_up_at: string | null;
  note: string | null;
  quantity_desc: string | null;
  metadata: Record<string, unknown>;
}

export interface DbRecipeSession {
  id: string;
  user_id: string;
  input_ingredients: unknown;
  fatigue_level: 1 | 2 | 3;
  food_preference: string | null;
  recommended_dishes: unknown;
  selected_dish_id: string | null;
  regenerate_count: number;
  total_duration_ms: number | null;
  created_at: string;
  metadata: Record<string, unknown>;
}

export interface DbCookingFeedback {
  id: string;
  user_id: string;
  session_id: string | null;
  dish_name: string;
  rating: '好吃' | '一般' | '不好' | null;
  issue_tags: string[];
  free_text: string | null;
  ingredients_used_up: string[];
  completed: boolean;
  created_at: string;
  metadata: Record<string, unknown>;
}

export interface DbEvent {
  id: string;
  user_id: string;
  event_name: string;
  properties: Record<string, unknown>;
  created_at: string;
}

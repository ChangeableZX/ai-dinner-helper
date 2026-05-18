-- ============================================
-- 饭饭 · Supabase 数据库初始 Schema
-- 创建时间: 2026-05-18
-- ============================================

-- 启用 UUID 扩展
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================
-- 表 1: users (匿名用户表)
-- ============================================
-- anon_id 用 TEXT 而非 UUID 类型：
--   虽然内容是 UUID 字符串，但 TEXT 更灵活——
--   未来引入正式登录时，anon_id 可以和 auth user_id 共存
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  anon_id TEXT UNIQUE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),  -- 带时区，避免时区问题
  last_active_at TIMESTAMPTZ DEFAULT NOW(),
  -- metadata 为未来扩展预留，比如未来加"设备信息"可先放这里
  metadata JSONB DEFAULT '{}'::jsonb
);

CREATE INDEX idx_users_anon_id ON users(anon_id);
CREATE INDEX idx_users_last_active ON users(last_active_at);

-- ============================================
-- 表 2: user_profiles (用户画像)
-- ============================================
CREATE TABLE user_profiles (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  skill_level TEXT CHECK (skill_level IN ('新手','中等','熟手')),
  spice_tolerance INT CHECK (spice_tolerance BETWEEN 1 AND 5),
  default_people_count INT DEFAULT 1,
  taboos TEXT[] DEFAULT ARRAY[]::TEXT[],
  seasoning_library TEXT[] DEFAULT ARRAY[]::TEXT[],
  equipment TEXT[] DEFAULT ARRAY[]::TEXT[],
  -- category_memory 存储用户的分类偏好记忆，便于后续个性化
  category_memory JSONB DEFAULT '{}'::jsonb,
  -- metadata 预留：比如 setupCompleted 暂存这里，稳定后可升为正式字段
  metadata JSONB DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 表 3: inventory_items (食材库)
-- ============================================
-- 调料不进此表（调料进 user_profiles.seasoning_library）
CREATE TABLE inventory_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  category TEXT CHECK (category IN ('肉蛋海鲜','蔬菜','主食','其他')),
  source TEXT CHECK (source IN ('订单识别','手动添加','实时输入入库')),
  status TEXT DEFAULT '在库' CHECK (status IN ('在库','已用完')),
  added_at TIMESTAMPTZ DEFAULT NOW(),
  used_up_at TIMESTAMPTZ,
  note TEXT,
  quantity_desc TEXT,
  -- metadata 预留：比如未来加"一餐多菜"的 meal_plan_id 可先放这里
  metadata JSONB DEFAULT '{}'::jsonb
);

CREATE INDEX idx_inventory_user_status ON inventory_items(user_id, status);
CREATE INDEX idx_inventory_added_at ON inventory_items(added_at DESC);

-- ============================================
-- 表 4: recipe_sessions (推荐会话)
-- ============================================
-- 每次用户点"看看做什么"产生一条记录
-- 用于后续分析"推荐质量"和"用户行为"
CREATE TABLE recipe_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  -- 输入快照（JSONB 存完整结构，便于回溯）
  input_ingredients JSONB NOT NULL,
  fatigue_level INT NOT NULL CHECK (fatigue_level IN (1,2,3)),
  food_preference TEXT,

  -- 输出快照
  recommended_dishes JSONB NOT NULL,

  -- 用户选择行为
  selected_dish_id TEXT,
  regenerate_count INT DEFAULT 0,

  -- 性能指标
  total_duration_ms INT,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  metadata JSONB DEFAULT '{}'::jsonb
);

CREATE INDEX idx_sessions_user ON recipe_sessions(user_id);
CREATE INDEX idx_sessions_created ON recipe_sessions(created_at DESC);

-- ============================================
-- 表 5: cooking_feedback (烹饪反馈)
-- ============================================
CREATE TABLE cooking_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  session_id UUID REFERENCES recipe_sessions(id) ON DELETE SET NULL,

  dish_name TEXT NOT NULL,
  rating TEXT CHECK (rating IN ('好吃','一般','不好')),

  -- 失败原因标签（咸了/太辣/步骤不清晰等）
  issue_tags TEXT[] DEFAULT ARRAY[]::TEXT[],

  -- 用户自由填写的文本反馈
  free_text TEXT,

  -- 用户确认吃完的食材（用于自动更新库存状态）
  ingredients_used_up TEXT[] DEFAULT ARRAY[]::TEXT[],

  -- 是否完成烹饪（跳过反馈也算"打开过菜谱"）
  completed BOOLEAN DEFAULT false,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  metadata JSONB DEFAULT '{}'::jsonb
);

CREATE INDEX idx_feedback_user ON cooking_feedback(user_id);
CREATE INDEX idx_feedback_dish ON cooking_feedback(dish_name);
CREATE INDEX idx_feedback_rating ON cooking_feedback(rating);

-- ============================================
-- 表 6: events (通用埋点表)
-- ============================================
-- 灵活记录各类用户行为，properties 存事件参数
-- 便于后续灵活分析，不需要提前定义所有字段
CREATE TABLE events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  event_name TEXT NOT NULL,
  properties JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_events_user_created ON events(user_id, created_at DESC);
CREATE INDEX idx_events_name ON events(event_name);

-- ============================================
-- RLS 策略 (行级安全)
-- ============================================
-- 当前为开发阶段策略：允许 anon key 完全访问所有行
-- 安全说明：anon key 本身是公开的，RLS 是最后一道防线
-- 上线前需改为基于 anon_id header 的严格策略（Prompt 3 中实现）

ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE recipe_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE cooking_feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow anon access during dev"
  ON users FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Allow anon access during dev"
  ON user_profiles FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Allow anon access during dev"
  ON inventory_items FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Allow anon access during dev"
  ON recipe_sessions FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Allow anon access during dev"
  ON cooking_feedback FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Allow anon access during dev"
  ON events FOR ALL USING (true) WITH CHECK (true);

-- ============================================
-- 视图（便于 Dashboard 查询，不影响应用逻辑）
-- ============================================

-- 用户活跃度概览
CREATE VIEW user_activity_summary AS
SELECT
  u.id,
  u.anon_id,
  u.created_at AS registered_at,
  u.last_active_at,
  COUNT(DISTINCT rs.id) AS total_recipe_sessions,
  COUNT(DISTINCT cf.id) AS total_cooking_attempts,
  COUNT(DISTINCT CASE WHEN cf.rating = '好吃' THEN cf.id END) AS positive_feedbacks,
  COUNT(DISTINCT CASE WHEN cf.completed = true THEN cf.id END) AS completed_cookings
FROM users u
LEFT JOIN recipe_sessions rs ON rs.user_id = u.id
LEFT JOIN cooking_feedback cf ON cf.user_id = u.id
GROUP BY u.id;

-- 菜品反馈聚合（至少 2 次反馈才统计，避免噪音）
CREATE VIEW dish_feedback_aggregate AS
SELECT
  dish_name,
  COUNT(*) AS total_attempts,
  COUNT(CASE WHEN rating = '好吃' THEN 1 END) AS positive,
  COUNT(CASE WHEN rating = '一般' THEN 1 END) AS neutral,
  COUNT(CASE WHEN rating = '不好' THEN 1 END) AS negative,
  ROUND(
    COUNT(CASE WHEN rating = '好吃' THEN 1 END)::numeric /
    NULLIF(COUNT(*), 0)::numeric * 100,
    2
  ) AS positive_rate
FROM cooking_feedback
GROUP BY dish_name
HAVING COUNT(*) >= 2
ORDER BY positive_rate DESC NULLS LAST;

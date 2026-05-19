/**
 * Dashboard 数据查询模块
 *
 * 每个图表对应一个查询函数。
 * 真实数据不足时自动 fallback 到 mock（标记 isMock=true）。
 * 所有查询失败时也返回 mock 数据，确保 dashboard 不白屏。
 */

import { supabase } from '@/lib/supabase/client';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export interface DataPoint<T = any> {
  data: T;
  isMock: boolean;
  realDataCount: number;
}

const MOCK_THRESHOLD = 5;

// ── 1. 推荐质量分布 ────────────────────────────────────────────────────────
export async function getRecommendQuality(): Promise<
  DataPoint<Array<{ name: string; value: number; color: string }>>
> {
  try {
    const { data } = await supabase!.from('cooking_feedback').select('rating');

    if (!data || data.length < MOCK_THRESHOLD) {
      return { data: getMockQuality(), isMock: true, realDataCount: data?.length || 0 };
    }

    const counts = { 好吃: 0, 一般: 0, 不好: 0 };
    data.forEach((f) => {
      if (f.rating in counts) counts[f.rating as keyof typeof counts]++;
    });

    return {
      data: [
        { name: '好吃', value: counts['好吃'], color: '#10b981' },
        { name: '一般', value: counts['一般'], color: '#f59e0b' },
        { name: '不好', value: counts['不好'], color: '#ef4444' },
      ],
      isMock: false,
      realDataCount: data.length,
    };
  } catch {
    return { data: getMockQuality(), isMock: true, realDataCount: 0 };
  }
}

function getMockQuality() {
  return [
    { name: '好吃', value: 42, color: '#10b981' },
    { name: '一般', value: 12, color: '#f59e0b' },
    { name: '不好', value: 4, color: '#ef4444' },
  ];
}

// ── 2. 菜品反馈榜 Top 10 ───────────────────────────────────────────────────
export async function getDishLeaderboard(): Promise<
  DataPoint<
    Array<{ dish_name: string; positive: number; total: number; positive_rate: number }>
  >
> {
  try {
    const { data } = await supabase!.from('cooking_feedback').select('dish_name, rating');

    if (!data || data.length < MOCK_THRESHOLD) {
      return { data: getMockLeaderboard(), isMock: true, realDataCount: data?.length || 0 };
    }

    const dishMap = new Map<string, { positive: number; total: number }>();
    data.forEach((f) => {
      const existing = dishMap.get(f.dish_name) || { positive: 0, total: 0 };
      existing.total += 1;
      if (f.rating === '好吃') existing.positive += 1;
      dishMap.set(f.dish_name, existing);
    });

    const result = Array.from(dishMap.entries())
      .map(([dish_name, { positive, total }]) => ({
        dish_name,
        positive,
        total,
        positive_rate: total > 0 ? positive / total : 0,
      }))
      .sort((a, b) => b.positive_rate - a.positive_rate || b.total - a.total)
      .slice(0, 10);

    return { data: result, isMock: false, realDataCount: data.length };
  } catch {
    return { data: getMockLeaderboard(), isMock: true, realDataCount: 0 };
  }
}

function getMockLeaderboard() {
  return [
    { dish_name: '番茄炒蛋', positive: 18, total: 20, positive_rate: 0.9 },
    { dish_name: '清炒上海青', positive: 14, total: 16, positive_rate: 0.875 },
    { dish_name: '蒜蓉空心菜', positive: 12, total: 14, positive_rate: 0.857 },
    { dish_name: '红烧土豆', positive: 10, total: 12, positive_rate: 0.833 },
    { dish_name: '葱花炒蛋', positive: 8, total: 10, positive_rate: 0.8 },
    { dish_name: '紫菜蛋花汤', positive: 6, total: 8, positive_rate: 0.75 },
    { dish_name: '青椒肉丝', positive: 5, total: 7, positive_rate: 0.714 },
    { dish_name: '凉拌黄瓜', positive: 4, total: 6, positive_rate: 0.667 },
    { dish_name: '麻婆豆腐', positive: 3, total: 5, positive_rate: 0.6 },
    { dish_name: '酸辣土豆丝', positive: 2, total: 4, positive_rate: 0.5 },
  ];
}

// ── 3. 疲劳度分布 ──────────────────────────────────────────────────────────
// App 中 level 1 = '懒到极致'，level 2 = '凑合做做'，level 3 = '今天还有劲'
export async function getFatigueDistribution(): Promise<
  DataPoint<Array<{ level: string; count: number; description: string }>>
> {
  try {
    const { data } = await supabase!.from('recipe_sessions').select('fatigue_level');

    if (!data || data.length < MOCK_THRESHOLD) {
      return { data: getMockFatigue(), isMock: true, realDataCount: data?.length || 0 };
    }

    const counts = { 1: 0, 2: 0, 3: 0 };
    data.forEach((s) => {
      if (s.fatigue_level in counts) counts[s.fatigue_level as 1 | 2 | 3]++;
    });

    return {
      data: [
        { level: '懒到极致', count: counts[1], description: '不想做菜' },
        { level: '凑合做做', count: counts[2], description: '简单做做' },
        { level: '今天还有劲', count: counts[3], description: '愿意挑战' },
      ],
      isMock: false,
      realDataCount: data.length,
    };
  } catch {
    return { data: getMockFatigue(), isMock: true, realDataCount: 0 };
  }
}

function getMockFatigue() {
  return [
    { level: '懒到极致', count: 38, description: '不想做菜' },
    { level: '凑合做做', count: 18, description: '简单做做' },
    { level: '今天还有劲', count: 4, description: '愿意挑战' },
  ];
}

// ── 4. 推荐成功率漏斗 ─────────────────────────────────────────────────────
export async function getFunnelData(): Promise<
  DataPoint<Array<{ stage: string; count: number; rate: number }>>
> {
  try {
    const [recommendStarted, dishSelected, cookingCompleted, feedbackSubmitted] =
      await Promise.all([
        supabase!
          .from('events')
          .select('id', { count: 'exact', head: true })
          .eq('event_name', 'recommend_started'),
        supabase!
          .from('events')
          .select('id', { count: 'exact', head: true })
          .eq('event_name', 'dish_selected'),
        supabase!
          .from('cooking_feedback')
          .select('id', { count: 'exact', head: true })
          .eq('completed', true),
        supabase!
          .from('events')
          .select('id', { count: 'exact', head: true })
          .eq('event_name', 'feedback_submitted'),
      ]);

    const stage1 = recommendStarted.count || 0;
    const stage2 = dishSelected.count || 0;
    const stage3 = cookingCompleted.count || 0;
    const stage4 = feedbackSubmitted.count || 0;

    if (stage1 < MOCK_THRESHOLD) {
      return { data: getMockFunnel(), isMock: true, realDataCount: stage1 };
    }

    return {
      data: [
        { stage: '推荐发起', count: stage1, rate: 1 },
        { stage: '选定菜品', count: stage2, rate: stage1 > 0 ? stage2 / stage1 : 0 },
        { stage: '完成烹饪', count: stage3, rate: stage1 > 0 ? stage3 / stage1 : 0 },
        { stage: '提交反馈', count: stage4, rate: stage1 > 0 ? stage4 / stage1 : 0 },
      ],
      isMock: false,
      realDataCount: stage1,
    };
  } catch {
    return { data: getMockFunnel(), isMock: true, realDataCount: 0 };
  }
}

function getMockFunnel() {
  return [
    { stage: '推荐发起', count: 120, rate: 1 },
    { stage: '选定菜品', count: 86, rate: 0.717 },
    { stage: '完成烹饪', count: 64, rate: 0.533 },
    { stage: '提交反馈', count: 58, rate: 0.483 },
  ];
}

// ── 5. DAU 时间序列（过去 14 天）─────────────────────────────────────────
export async function getDailyActiveUsers(): Promise<
  DataPoint<Array<{ date: string; users: number }>>
> {
  try {
    const fourteenDaysAgo = new Date();
    fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);

    const { data } = await supabase!
      .from('events')
      .select('user_id, created_at')
      .gte('created_at', fourteenDaysAgo.toISOString());

    if (!data || data.length < MOCK_THRESHOLD * 3) {
      return { data: getMockDAU(), isMock: true, realDataCount: data?.length || 0 };
    }

    const dailyMap = new Map<string, Set<string>>();
    data.forEach((e) => {
      const date = new Date(e.created_at).toISOString().split('T')[0];
      if (!dailyMap.has(date)) dailyMap.set(date, new Set());
      dailyMap.get(date)!.add(e.user_id);
    });

    const result: Array<{ date: string; users: number }> = [];
    for (let i = 13; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];
      result.push({
        date: dateStr.substring(5),
        users: dailyMap.get(dateStr)?.size || 0,
      });
    }

    return { data: result, isMock: false, realDataCount: data.length };
  } catch {
    return { data: getMockDAU(), isMock: true, realDataCount: 0 };
  }
}

function getMockDAU() {
  const result = [];
  const baseValue = 8;
  for (let i = 13; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().split('T')[0].substring(5);
    const value = Math.floor(baseValue + i * 0.5 + Math.random() * 4 - 2);
    result.push({ date: dateStr, users: Math.max(0, value) });
  }
  return result;
}

// ── 6. 失败原因分布 ────────────────────────────────────────────────────────
export async function getFailureReasons(): Promise<
  DataPoint<Array<{ reason: string; count: number }>>
> {
  try {
    const { data } = await supabase!
      .from('cooking_feedback')
      .select('issue_tags')
      .neq('rating', '好吃');

    if (!data || data.length < MOCK_THRESHOLD) {
      return { data: getMockFailures(), isMock: true, realDataCount: data?.length || 0 };
    }

    const counts = new Map<string, number>();
    data.forEach((f) => {
      (f.issue_tags || []).forEach((tag: string) => {
        counts.set(tag, (counts.get(tag) || 0) + 1);
      });
    });

    const result = Array.from(counts.entries())
      .map(([reason, count]) => ({ reason, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8);

    return { data: result, isMock: false, realDataCount: data.length };
  } catch {
    return { data: getMockFailures(), isMock: true, realDataCount: 0 };
  }
}

function getMockFailures() {
  return [
    { reason: '咸了', count: 8 },
    { reason: '步骤太复杂', count: 7 },
    { reason: '耗时比预期长', count: 6 },
    { reason: '淡了', count: 5 },
    { reason: '火候不对', count: 4 },
    { reason: '食材不够', count: 3 },
    { reason: '难度不符合', count: 2 },
    { reason: '其他', count: 2 },
  ];
}

// ── 总览指标 ───────────────────────────────────────────────────────────────
export async function getOverviewMetrics(): Promise<
  DataPoint<{
    totalUsers: number;
    totalSessions: number;
    totalFeedbacks: number;
    avgPositiveRate: number;
  }>
> {
  try {
    const [users, sessions, feedbacks, positive] = await Promise.all([
      supabase!.from('users').select('id', { count: 'exact', head: true }),
      supabase!.from('recipe_sessions').select('id', { count: 'exact', head: true }),
      supabase!.from('cooking_feedback').select('id', { count: 'exact', head: true }),
      supabase!
        .from('cooking_feedback')
        .select('id', { count: 'exact', head: true })
        .eq('rating', '好吃'),
    ]);

    const totalUsers = users.count || 0;
    const totalSessions = sessions.count || 0;
    const totalFeedbacks = feedbacks.count || 0;
    const avgPositiveRate = totalFeedbacks > 0 ? (positive.count || 0) / totalFeedbacks : 0;

    if (totalSessions < MOCK_THRESHOLD) {
      return {
        data: { totalUsers: 47, totalSessions: 152, totalFeedbacks: 78, avgPositiveRate: 0.71 },
        isMock: true,
        realDataCount: totalSessions,
      };
    }

    return {
      data: { totalUsers, totalSessions, totalFeedbacks, avgPositiveRate },
      isMock: false,
      realDataCount: totalSessions,
    };
  } catch {
    return {
      data: { totalUsers: 47, totalSessions: 152, totalFeedbacks: 78, avgPositiveRate: 0.71 },
      isMock: true,
      realDataCount: 0,
    };
  }
}

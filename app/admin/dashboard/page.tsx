'use client';

import { useEffect, useState } from 'react';
import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import {
  getOverviewMetrics,
  getRecommendQuality,
  getDishLeaderboard,
  getFatigueDistribution,
  getFunnelData,
  getDailyActiveUsers,
  getFailureReasons,
  type DataPoint,
} from '@/lib/admin/queries';

type DashboardData = {
  loading: boolean;
  overview: DataPoint<{ totalUsers: number; totalSessions: number; totalFeedbacks: number; avgPositiveRate: number }>;
  quality: DataPoint<Array<{ name: string; value: number; color: string }>>;
  leaderboard: DataPoint<Array<{ dish_name: string; positive: number; total: number; positive_rate: number }>>;
  fatigue: DataPoint<Array<{ level: string; count: number; description: string }>>;
  funnel: DataPoint<Array<{ stage: string; count: number; rate: number }>>;
  dau: DataPoint<Array<{ date: string; users: number }>>;
  failures: DataPoint<Array<{ reason: string; count: number }>>;
};

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);

  useEffect(() => {
    loadAllData();
  }, []);

  async function loadAllData() {
    const [overview, quality, leaderboard, fatigue, funnel, dau, failures] = await Promise.all([
      getOverviewMetrics(),
      getRecommendQuality(),
      getDishLeaderboard(),
      getFatigueDistribution(),
      getFunnelData(),
      getDailyActiveUsers(),
      getFailureReasons(),
    ]);
    setData({ loading: false, overview, quality, leaderboard, fatigue, funnel, dau, failures });
  }

  if (!data || data.loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="text-4xl mb-3 animate-pulse">📊</div>
          <p className="text-gray-500">加载数据中...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-6 py-4 flex justify-between items-center">
          <div>
            <h1 className="text-xl font-bold text-gray-900">饭饭 · 数据后台</h1>
            <p className="text-xs text-gray-500 mt-0.5">AI 晚餐决策助手 · 实时数据</p>
          </div>
          <a href="/" className="text-sm text-[#FF6B47] hover:underline">
            ← 返回应用
          </a>
        </div>
      </header>

      <div className="max-w-6xl mx-auto p-6 space-y-6">
        <DemoBanner data={data} />
        <OverviewCards overview={data.overview} />

        <div className="flex flex-col gap-6">
          <ChartCard
            title="推荐质量分布"
            subtitle="所有用户反馈的评分分布"
            isMock={data.quality.isMock}
            realCount={data.quality.realDataCount}
          >
            <QualityPieChart data={data.quality.data} />
          </ChartCard>

          <ChartCard
            title="疲劳度选择分布"
            subtitle="用户在推荐时选择的疲劳档位"
            isMock={data.fatigue.isMock}
            realCount={data.fatigue.realDataCount}
          >
            <FatigueBarChart data={data.fatigue.data} />
          </ChartCard>

          <ChartCard
            title="菜品反馈榜 Top 10"
            subtitle="按好吃率排序"
            isMock={data.leaderboard.isMock}
            realCount={data.leaderboard.realDataCount}
          >
            <LeaderboardChart data={data.leaderboard.data} />
          </ChartCard>

          <ChartCard
            title="推荐转化漏斗"
            subtitle="从推荐到反馈的用户路径"
            isMock={data.funnel.isMock}
            realCount={data.funnel.realDataCount}
          >
            <FunnelView data={data.funnel.data} />
          </ChartCard>

          <ChartCard
            title="过去 14 天活跃用户"
            subtitle="独立用户访问量（DAU）"
            isMock={data.dau.isMock}
            realCount={data.dau.realDataCount}
          >
            <DAULineChart data={data.dau.data} />
          </ChartCard>

          <ChartCard
            title="差评原因分布"
            subtitle="用户标记的失败原因，反哺 prompt 优化"
            isMock={data.failures.isMock}
            realCount={data.failures.realDataCount}
          >
            <FailureBarChart data={data.failures.data} />
          </ChartCard>
        </div>

        <div className="bg-white rounded-2xl p-6 text-sm text-gray-600 border border-gray-100">
          <h3 className="font-semibold mb-2 text-gray-900">关于本 Dashboard</h3>
          <p className="mb-2 leading-relaxed">
            这是"饭饭"项目的数据后台，实时显示 Supabase 中的真实使用数据。
            当某些图表的真实数据量不足（&lt;5 条）时，会自动切换为演示数据并明显标注，
            以保证 demo 能完整展示数据飞轮能力。
          </p>
          <p className="text-gray-500">
            技术栈：Next.js · Supabase · Recharts · TypeScript ｜
            数据采集：埋点 + 业务表 + 视图聚合 ｜
            鉴权：URL + 密码（demo 用）
          </p>
        </div>
      </div>
    </div>
  );
}

function DemoBanner({ data }: { data: DashboardData }) {
  const allReal =
    !data.quality.isMock &&
    !data.leaderboard.isMock &&
    !data.fatigue.isMock &&
    !data.funnel.isMock;

  if (allReal) {
    return (
      <div className="bg-green-50 border border-green-200 rounded-2xl p-4 flex items-center gap-3">
        <span className="text-2xl">✅</span>
        <div>
          <p className="font-medium text-green-900">所有数据均为真实使用产生</p>
          <p className="text-sm text-green-700">
            用户数 {data.overview.data.totalUsers} · 总会话{' '}
            {data.overview.data.totalSessions} · 总反馈 {data.overview.data.totalFeedbacks}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-start gap-3">
      <span className="text-2xl flex-shrink-0">ℹ️</span>
      <div>
        <p className="font-medium text-amber-900">部分图表使用演示数据</p>
        <p className="text-sm text-amber-700 mt-1 leading-relaxed">
          作为求职 demo，真实使用数据有限（单用户产生的数据）。
          数据不足 5 条的图表会自动切换为演示数据，并在每张图右上角明显标注。
          所有查询、聚合、可视化的逻辑完全相同——多用户场景下数据会自然丰富。
        </p>
      </div>
    </div>
  );
}

function OverviewCards({
  overview,
}: {
  overview: DataPoint<{
    totalUsers: number;
    totalSessions: number;
    totalFeedbacks: number;
    avgPositiveRate: number;
  }>;
}) {
  const cards = [
    { label: '注册用户', value: overview.data.totalUsers, icon: '👤' },
    { label: '推荐次数', value: overview.data.totalSessions, icon: '🍳' },
    { label: '收到反馈', value: overview.data.totalFeedbacks, icon: '💬' },
    {
      label: '平均好吃率',
      value: `${Math.round(overview.data.avgPositiveRate * 100)}%`,
      icon: '⭐',
    },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {cards.map((card, i) => (
        <div key={i} className="bg-white rounded-2xl p-4 border border-gray-100">
          <div className="flex items-center gap-2 text-gray-500 text-sm mb-2">
            <span>{card.icon}</span>
            <span>{card.label}</span>
          </div>
          <p className="text-3xl font-bold text-gray-900">{card.value}</p>
          {overview.isMock && (
            <p className="text-xs text-amber-500 mt-1">演示数据</p>
          )}
        </div>
      ))}
    </div>
  );
}

function ChartCard({
  title,
  subtitle,
  isMock,
  realCount,
  children,
}: {
  title: string;
  subtitle?: string;
  isMock: boolean;
  realCount: number;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-white rounded-2xl p-5 border border-gray-100">
      <div className="flex justify-between items-start mb-4">
        <div>
          <h3 className="font-semibold text-gray-900">{title}</h3>
          {subtitle && <p className="text-xs text-gray-500 mt-1">{subtitle}</p>}
        </div>
        {isMock ? (
          <span className="text-xs bg-amber-100 text-amber-800 px-2 py-1 rounded-full flex-shrink-0">
            演示数据
          </span>
        ) : (
          <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded-full flex-shrink-0">
            真实 · {realCount} 条
          </span>
        )}
      </div>
      <div className="h-64">{children}</div>
    </div>
  );
}

function QualityPieChart({ data }: { data: Array<{ name: string; value: number; color: string }> }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <PieChart>
        <Pie
          data={data}
          dataKey="value"
          nameKey="name"
          cx="50%"
          cy="50%"
          outerRadius={80}
          label={(entry) => `${entry.name} ${Math.round((entry.percent ?? 0) * 100)}%`}
        >
          {data.map((entry, index) => (
            <Cell key={index} fill={entry.color} />
          ))}
        </Pie>
        <Tooltip />
      </PieChart>
    </ResponsiveContainer>
  );
}

function FatigueBarChart({
  data,
}: {
  data: Array<{ level: string; count: number; description: string }>;
}) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
        <XAxis dataKey="level" tick={{ fontSize: 12 }} />
        <YAxis tick={{ fontSize: 12 }} />
        <Tooltip />
        <Bar dataKey="count" fill="#f97316" radius={[6, 6, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

function LeaderboardChart({
  data,
}: {
  data: Array<{ dish_name: string; positive: number; total: number; positive_rate: number }>;
}) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} layout="vertical" margin={{ top: 5, right: 30, left: 80, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
        <XAxis
          type="number"
          tickFormatter={(v: number) => `${Math.round(v * 100)}%`}
          tick={{ fontSize: 11 }}
          domain={[0, 1]}
        />
        <YAxis type="category" dataKey="dish_name" width={75} tick={{ fontSize: 12 }} />
        <Tooltip formatter={(value) => typeof value === 'number' ? `${Math.round(value * 100)}%` : value} />
        <Bar dataKey="positive_rate" fill="#10b981" radius={[0, 6, 6, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

function FunnelView({ data }: { data: Array<{ stage: string; count: number; rate: number }> }) {
  return (
    <div className="space-y-4 py-2">
      {data.map((stage, i) => (
        <div key={i}>
          <div className="flex justify-between text-sm mb-1.5">
            <span className="font-medium text-gray-800">{stage.stage}</span>
            <span className="text-gray-500">
              {stage.count} 次 ({Math.round(stage.rate * 100)}%)
            </span>
          </div>
          <div className="h-8 bg-gray-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-[#FF6B47] to-[#FF8C6B] rounded-full transition-all duration-500"
              style={{ width: `${stage.rate * 100}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

function DAULineChart({ data }: { data: Array<{ date: string; users: number }> }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={data} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
        <XAxis dataKey="date" tick={{ fontSize: 11 }} interval={2} />
        <YAxis tick={{ fontSize: 12 }} />
        <Tooltip />
        <Line
          type="monotone"
          dataKey="users"
          stroke="#f97316"
          strokeWidth={2}
          dot={{ r: 3, fill: '#f97316' }}
          activeDot={{ r: 5 }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}

function FailureBarChart({ data }: { data: Array<{ reason: string; count: number }> }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} margin={{ top: 5, right: 20, left: 0, bottom: 50 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
        <XAxis dataKey="reason" angle={-30} textAnchor="end" height={60} tick={{ fontSize: 11 }} />
        <YAxis tick={{ fontSize: 12 }} />
        <Tooltip />
        <Bar dataKey="count" fill="#ef4444" radius={[6, 6, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

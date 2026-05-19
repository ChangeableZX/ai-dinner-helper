'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronLeft } from 'lucide-react';
import { storageGet, STORAGE_KEYS } from '@/lib/storage';
import type { HistoryRecord } from '@/types';

interface UserStats {
  totalCookings: number;
  ratedCount: number;
  positiveRate: number;
  topDishes: Array<{ name: string; count: number; rating: string | null }>;
  weeklyProgress: {
    thisWeek: number;
    lastWeek: number;
    trend: 'up' | 'down' | 'flat';
  };
  isEmpty: boolean;
}

const RATING_LABEL: Record<string, string> = {
  good: '好吃',
  ok: '一般',
  bad: '不好',
};

export default function UserStatsPage() {
  const router = useRouter();
  const [stats, setStats] = useState<UserStats | null>(null);

  useEffect(() => {
    const history = storageGet<HistoryRecord[]>(STORAGE_KEYS.HISTORY, []);
    setStats(buildStats(history));
  }, []);

  if (!stats) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-4xl animate-pulse">📊</div>
      </div>
    );
  }

  if (stats.isEmpty) {
    return (
      <div className="min-h-screen flex flex-col">
        <Header onBack={() => router.back()} />
        <div className="flex flex-col items-center justify-center flex-1 px-8 text-center">
          <div className="text-6xl mb-4">🍳</div>
          <h2 className="text-xl font-semibold mb-2">还没有烹饪数据</h2>
          <p className="text-gray-500 text-center mb-6">
            做完第一道菜后，这里会展示你的烹饪足迹
          </p>
          <button
            onClick={() => router.push('/')}
            className="px-6 py-3 bg-[#FF6B47] text-white rounded-full font-medium active:scale-95 transition-transform"
          >
            看看今晚吃什么 →
          </button>
        </div>
      </div>
    );
  }

  const trendConfig = {
    up: { className: 'bg-green-100 text-green-700', label: '↑ 进步了' },
    down: { className: 'bg-red-100 text-red-700', label: '↓ 少了' },
    flat: { className: 'bg-gray-100 text-gray-700', label: '→ 持平' },
  }[stats.weeklyProgress.trend];

  const positiveCount = Math.round(stats.ratedCount * stats.positiveRate);

  return (
    <div className="flex flex-col min-h-screen pb-8">
      <Header onBack={() => router.back()} />

      <div className="px-5 space-y-4">
        {/* 总览卡 */}
        <div className="bg-gradient-to-br from-[#FF6B47] to-[#FF8C6B] rounded-2xl p-6 text-white">
          <p className="text-sm opacity-80 mb-1">总共做了</p>
          <p className="text-5xl font-bold">
            {stats.totalCookings} <span className="text-2xl font-medium">道菜</span>
          </p>
          {stats.ratedCount > 0 && (
            <p className="text-sm opacity-80 mt-3">
              其中 {positiveCount} 道好吃（{Math.round(stats.positiveRate * 100)}%）
            </p>
          )}
        </div>

        {/* 最爱的菜 */}
        {stats.topDishes.length > 0 && (
          <div className="bg-white rounded-2xl p-5">
            <h3 className="text-sm font-bold text-[#2D2D2D] mb-3">🏆 你最常做的菜</h3>
            <div className="space-y-2">
              {stats.topDishes.map((dish, idx) => (
                <div key={idx} className="flex items-center justify-between p-3 rounded-xl bg-gray-50">
                  <div className="flex items-center gap-2">
                    <span className="text-xl">{['🥇', '🥈', '🥉'][idx]}</span>
                    <span className="font-medium text-[#2D2D2D]">{dish.name}</span>
                  </div>
                  <span className="text-sm text-gray-500">做过 {dish.count} 次</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 最近一周进步 */}
        <div className="bg-white rounded-2xl p-5">
          <h3 className="text-sm font-bold text-[#2D2D2D] mb-3">📈 最近一周</h3>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-3xl font-bold text-[#2D2D2D]">{stats.weeklyProgress.thisWeek} 道</p>
              <p className="text-sm text-gray-500 mt-1">vs 上周 {stats.weeklyProgress.lastWeek} 道</p>
            </div>
            <span className={`px-3 py-1.5 rounded-full text-sm font-medium ${trendConfig.className}`}>
              {trendConfig.label}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

function Header({ onBack }: { onBack: () => void }) {
  return (
    <div className="flex items-center gap-3 px-5 pt-12 pb-4">
      <button
        onClick={onBack}
        className="w-10 h-10 rounded-full bg-white shadow-sm flex items-center justify-center text-gray-500 active:scale-95 transition-transform"
      >
        <ChevronLeft size={20} />
      </button>
      <h1 className="text-lg font-bold text-[#2D2D2D]">我的烹饪数据</h1>
    </div>
  );
}

function buildStats(history: HistoryRecord[]): UserStats {
  if (history.length === 0) {
    return {
      totalCookings: 0,
      ratedCount: 0,
      positiveRate: 0,
      topDishes: [],
      weeklyProgress: { thisWeek: 0, lastWeek: 0, trend: 'flat' },
      isEmpty: true,
    };
  }

  const total = history.length;

  // 好吃率（仅统计有评价的记录）
  const rated = history.filter((h) => h.rating != null);
  const positive = rated.filter((h) => h.rating === 'good').length;
  const positiveRate = rated.length > 0 ? positive / rated.length : 0;

  // Top 菜品
  const dishMap = new Map<string, { count: number; ratings: (string | null)[] }>();
  history.forEach((h) => {
    const existing = dishMap.get(h.recipeName) || { count: 0, ratings: [] };
    existing.count += 1;
    existing.ratings.push(h.rating);
    dishMap.set(h.recipeName, existing);
  });
  const topDishes = Array.from(dishMap.entries())
    .map(([name, { count, ratings }]) => {
      const validRatings = ratings.filter(Boolean) as string[];
      const topRating = validRatings.length > 0 ? getMostFrequent(validRatings) : null;
      return { name, count, rating: topRating ? (RATING_LABEL[topRating] ?? topRating) : null };
    })
    .sort((a, b) => b.count - a.count)
    .slice(0, 3);

  // 周对比
  const now = Date.now();
  const oneWeek = 7 * 24 * 60 * 60 * 1000;
  const thisWeek = history.filter((h) => now - new Date(h.date).getTime() < oneWeek).length;
  const lastWeek = history.filter((h) => {
    const diff = now - new Date(h.date).getTime();
    return diff >= oneWeek && diff < 2 * oneWeek;
  }).length;

  return {
    totalCookings: total,
    ratedCount: rated.length,
    positiveRate,
    topDishes,
    weeklyProgress: {
      thisWeek,
      lastWeek,
      trend: thisWeek > lastWeek ? 'up' : thisWeek < lastWeek ? 'down' : 'flat',
    },
    isEmpty: false,
  };
}

function getMostFrequent(arr: string[]): string {
  const counts = arr.reduce(
    (acc, item) => { acc[item] = (acc[item] || 0) + 1; return acc; },
    {} as Record<string, number>,
  );
  return Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0];
}

'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Clock, BarChart2, Wind, ChevronLeft, RefreshCw, ChevronDown } from 'lucide-react';
import { useAppStore } from '@/lib/store';
import { useRecipeCache, toRecipe } from '@/lib/recipe-cache';
import { storageGet, STORAGE_KEYS } from '@/lib/storage';
import type { DishSummary, UserProfile, RecommendResponse, SelectedIngredient } from '@/types';
import { getCurrentAnonId } from '@/lib/user-anon-id';
import { getCloudSyncMode } from '@/lib/cloud-sync';
import {
  trackPageView, trackRecommendStarted, trackRecommendCompleted,
  trackRecommendFailed, trackRecommendRegenerated, trackDishSelected,
} from '@/lib/analytics-events';

const LOADING_MESSAGES = [
  '翻翻你的厨房…',
  '想想给你做点啥…',
  '看看怎么搭配…',
  '灵感来了…',
  '帮你把关一下…',
];

const MAX_RETRY_FRIENDLY_MSG = 5;

function loosematch(a: string, b: string): boolean {
  const na = a.toLowerCase().replace(/\s+/g, '');
  const nb = b.toLowerCase().replace(/\s+/g, '');
  return na.includes(nb) || nb.includes(na);
}

function computeUsageStats(
  summary: DishSummary,
  selectedIngredients: SelectedIngredient[],
) {
  const usedNames = summary.使用的食材;
  const inventoryItems = selectedIngredients.filter((i) => i.来源 === '库存');
  const inputItems = selectedIngredients.filter((i) => i.来源 !== '库存');

  const 已用库存食材 = inventoryItems
    .filter((i) => usedNames.some((n) => loosematch(n, i.名称)))
    .map((i) => i.名称);

  const 已用今日输入 = inputItems
    .filter((i) => usedNames.some((n) => loosematch(n, i.名称)))
    .map((i) => i.名称);

  const 未用上的库存 = inventoryItems
    .filter((i) => !已用库存食材.includes(i.名称))
    .map((i) => i.名称);

  return { 已用库存食材, 已用今日输入, 未用上的库存 };
}

function startPreloading(
  summaries: DishSummary[],
  selectedIngredients: SelectedIngredient[],
  fatigueLevel: number,
  foodPreference: string,
  profile: UserProfile | null,
) {
  const userIngredients = selectedIngredients.map((i) => i.名称);

  summaries.forEach((summary) => {
    if (useRecipeCache.getState().getRecipe(summary.id)) return;
    if (useRecipeCache.getState().isLoading(summary.id)) return;

    useRecipeCache.getState().setLoading(summary.id, true);

    fetch('/api/recipe-detail', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        菜名: summary.菜名,
        推荐时的食材: summary.使用的食材,
        user_profile: {
          调料库: profile?.seasonings ?? [],
          设备: profile?.equipment ?? [],
          技能等级:
            profile?.skillLevel === 'beginner'
              ? '新手'
              : profile?.skillLevel === 'advanced'
              ? '熟手'
              : '能做几道家常',
          辣度: profile?.spiceLevel ?? 2,
          忌口: profile?.avoidances ?? [],
          人数: profile?.servings ?? 1,
        },
        今日食材: selectedIngredients,
        疲劳度: fatigueLevel,
        食材偏好: foodPreference,
      }),
    })
      .then((res) => res.json())
      .then((rawDetail) => {
        if (rawDetail.error) {
          console.warn(`[Preload] 详情预加载失败 ${summary.id} (${summary.菜名}):`, rawDetail.error);
          useRecipeCache.getState().setLoading(summary.id, false);
          return;
        }
        const recipe = toRecipe(summary, rawDetail, userIngredients);
        useRecipeCache.getState().setRecipe(summary.id, recipe);
        console.log(`[Preload] 预加载完成：${summary.菜名}`);
      })
      .catch((err) => {
        console.warn(`[Preload] 网络错误 ${summary.id}:`, err);
        useRecipeCache.getState().setLoading(summary.id, false);
      });
  });
}

export default function RecommendPage() {
  const router = useRouter();
  const {
    selectedIngredients, fatigueLevel, foodPreference, summariesMap, excludedDishes, retryCount,
    isLoading, error, p0Warning, setSummaries, setLoading, setError, setP0Warning,
    addExcludedDish, incrementRetry, setSelectedRecipeId, doneRecipeIds, recentlyUsedIngredientNames,
    setCurrentSessionId,
  } = useAppStore();

  const [loadingMsg, setLoadingMsg] = useState(LOADING_MESSAGES[0]);
  const fetchInitiated = useRef(false);
  const recommendStartTime = useRef<number>(0);

  const ingredientNames = selectedIngredients.map((i) => i.名称);

  useEffect(() => {
    trackPageView('recommend');
  }, []);

  useEffect(() => {
    if (!selectedIngredients.length || !fatigueLevel) {
      router.replace('/home');
    }
  }, [selectedIngredients, fatigueLevel, router]);

  useEffect(() => {
    if (!isLoading) return;
    const idx = { current: 0 };
    const timer = setInterval(() => {
      idx.current = (idx.current + 1) % LOADING_MESSAGES.length;
      setLoadingMsg(LOADING_MESSAGES[idx.current]);
    }, 1800);
    return () => clearInterval(timer);
  }, [isLoading]);

  useEffect(() => {
    if (!selectedIngredients.length || !fatigueLevel) return;
    if (Object.keys(summariesMap).length > 0) return;
    if (fetchInitiated.current) return;
    fetchInitiated.current = true;
    fetchRecommendations();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function fetchRecommendations() {
    setLoading(true);
    setError(null);
    setP0Warning(null);
    recommendStartTime.current = Date.now();
    trackRecommendStarted(selectedIngredients.length, fatigueLevel ?? 0);

    try {
      const profile = storageGet<UserProfile | null>(STORAGE_KEYS.USER_PROFILE, null)!;
      const history = storageGet<Array<{ recipeName: string; date: string }>>(
        STORAGE_KEYS.HISTORY, [],
      );
      const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
      const recentDishes = [
        ...new Set(
          history
            .filter((h) => new Date(h.date).getTime() > sevenDaysAgo)
            .map((h) => h.recipeName),
        ),
      ];

      const body = {
        ingredients: selectedIngredients,
        fatigueLevel,
        food_preference: foodPreference,
        userProfile: {
          调料库: profile?.seasonings ?? [],
          设备: profile?.equipment ?? [],
          技能等级:
            profile?.skillLevel === 'beginner'
              ? '新手'
              : profile?.skillLevel === 'advanced'
              ? '熟手'
              : '能做几道家常',
          辣度: profile?.spiceLevel ?? 2,
          忌口: profile?.avoidances ?? [],
          人数: profile?.servings ?? 1,
        },
        recentDishes,
        exclude: excludedDishes,
      };

      const res = await fetch('/api/recommend', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const data: RecommendResponse = await res.json();

      const durationMs = Date.now() - recommendStartTime.current;

      if (!data.success || !data.方案?.length) {
        setError(data.error ?? '这些食材暂时想不到好方案');
        trackRecommendFailed(durationMs, data.error ?? 'no_dishes');
      } else {
        setSummaries(data.方案);
        if (data.p0Warning) setP0Warning(data.p0Warning);
        trackRecommendCompleted(durationMs, data.方案.length);

        // 推荐结果出来后，立即并发后台预加载所有详情
        startPreloading(data.方案, selectedIngredients, fatigueLevel!, foodPreference, profile);

        // 会话日志（fire-and-forget，仅云端模式）
        if (getCloudSyncMode() === 'cloud') {
          const anonId = getCurrentAnonId();
          fetch('/api/log-session', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              anonId,
              sessionData: {
                ingredients: selectedIngredients,
                fatigueLevel: fatigueLevel!,
                foodPreference,
                dishes: data.方案,
                durationMs,
              },
            }),
          })
            .then((r) => r.json())
            .then((d: { ok: boolean; session_id?: string }) => {
              if (d.ok && d.session_id) {
                setCurrentSessionId(d.session_id);
              }
            })
            .catch((e) => console.warn('[Session] Failed to log:', e));
        }
      }
    } catch {
      const durationMs = Date.now() - recommendStartTime.current;
      trackRecommendFailed(durationMs, 'network_error');
      setError('刚才走神了，再试一次');
    } finally {
      setLoading(false);
    }
  }

  function handleRetry() {
    const currentNames = Object.values(summariesMap).map((s) => s.菜名);
    currentNames.forEach((n) => addExcludedDish(n));
    incrementRetry();
    trackRecommendRegenerated(retryCount + 1);
    useRecipeCache.getState().clear();
    setSummaries([]);
    fetchRecommendations();
  }

  function handleSelect(summary: DishSummary) {
    const idx = Object.values(summariesMap).findIndex((s) => s.id === summary.id);
    trackDishSelected(summary.菜名, idx);
    setSelectedRecipeId(summary.id);
    router.push(`/recipe/${summary.id}`);
  }

  const summaries = Object.values(summariesMap);

  return (
    <div className="flex flex-col min-h-screen page-enter">
      {/* Header */}
      <div className="flex items-center gap-3 px-5 pt-12 pb-4">
        <button
          onClick={() => router.back()}
          className="w-10 h-10 rounded-full bg-white shadow-sm flex items-center justify-center text-gray-500 active:scale-95 transition-transform"
        >
          <ChevronLeft size={20} />
        </button>
        <div>
          <h1 className="text-lg font-bold text-[#2D2D2D]">今晚推荐</h1>
          <p className="text-xs text-gray-400">
            {ingredientNames.slice(0, 3).join('、')}{ingredientNames.length > 3 ? ` 等${ingredientNames.length}种食材` : ''}
          </p>
        </div>
      </div>

      <div className="flex-1 px-5">
        {/* Loading State */}
        {isLoading && (
          <div className="flex flex-col items-center justify-center py-20">
            <div className="flex gap-1 mb-6">
              {[0, 1, 2].map((i) => (
                <div
                  key={i}
                  className="w-3 h-3 rounded-full bg-[#FF6B47]"
                  style={{ animation: `skeletonPulse 1.2s ease-in-out ${i * 0.2}s infinite` }}
                />
              ))}
            </div>
            <p className="text-[#2D2D2D] text-lg font-medium">{loadingMsg}</p>
            <div className="w-full mt-8 space-y-4">
              {[1, 2].map((i) => (
                <div key={i} className="bg-white rounded-2xl p-5 space-y-3">
                  <div className="skeleton h-6 w-2/5 rounded-lg" />
                  <div className="skeleton h-4 w-3/4 rounded" />
                  <div className="flex gap-2">
                    <div className="skeleton h-6 w-16 rounded-full" />
                    <div className="skeleton h-6 w-16 rounded-full" />
                    <div className="skeleton h-6 w-16 rounded-full" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Error State */}
        {!isLoading && error && (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="text-5xl mb-4">😓</div>
            <p className="text-[#2D2D2D] text-lg font-medium mb-2">{error}</p>
            <button
              onClick={fetchRecommendations}
              className="mt-6 bg-[#FF6B47] text-white px-6 py-3 rounded-2xl font-medium active:scale-95 transition-transform"
            >
              重试一次
            </button>
          </div>
        )}

        {/* Recipe Cards */}
        {!isLoading && !error && summaries.length > 0 && (
          <div className="space-y-4 pb-32">
            {retryCount >= MAX_RETRY_FRIENDLY_MSG && (
              <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 text-sm text-amber-700">
                这些食材组合可能真的比较难发挥，建议补充点蛋白质或蔬菜再试试 😊
              </div>
            )}

            {summaries.map((summary) => {
              const isDone = doneRecipeIds.includes(summary.id);
              const hasUsedIngredient =
                !isDone &&
                recentlyUsedIngredientNames.length > 0 &&
                summary.使用的食材.some((ing) =>
                  recentlyUsedIngredientNames.some((used) => loosematch(ing, used))
                );
              return (
                <RecipeCard
                  key={summary.id}
                  summary={summary}
                  selectedIngredients={selectedIngredients}
                  onSelect={() => handleSelect(summary)}
                  isDone={isDone}
                  hasUsedIngredient={hasUsedIngredient}
                />
              );
            })}

            {p0Warning && (
              <div className="bg-orange-50 border border-orange-200 rounded-2xl p-4 text-sm text-orange-700">
                {p0Warning}
              </div>
            )}

            <button
              onClick={handleRetry}
              className="w-full flex items-center justify-center gap-2 py-4 rounded-2xl border-2 border-gray-200 text-gray-500 text-sm font-medium active:scale-[0.98] transition-all bg-white"
            >
              <RefreshCw size={16} />
              基于剩余食材换一批
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function RecipeCard({
  summary, selectedIngredients, onSelect, isDone, hasUsedIngredient,
}: {
  summary: DishSummary;
  selectedIngredients: SelectedIngredient[];
  onSelect: () => void;
  isDone?: boolean;
  hasUsedIngredient?: boolean;
}) {
  const [statsOpen, setStatsOpen] = useState(false);

  const stats = computeUsageStats(summary, selectedIngredients);
  const hasInventoryIngredients = selectedIngredients.some((i) => i.来源 === '库存');

  const usageRate =
    selectedIngredients.length > 0
      ? Math.round((summary.使用的食材.filter((f) =>
          selectedIngredients.some((i) => loosematch(f, i.名称))
        ).length / selectedIngredients.length) * 100)
      : 0;

  return (
    <div className={`rounded-2xl shadow-sm border overflow-hidden ${isDone ? 'bg-gray-50 border-gray-100 opacity-70' : 'bg-white border-gray-100'}`}>
      <div className="p-5">
        <div className="flex items-start justify-between mb-1">
          <h2 className={`text-xl font-bold ${isDone ? 'text-gray-400' : 'text-[#2D2D2D]'}`}>{summary.菜名}</h2>
          {isDone && (
            <span className="flex-shrink-0 ml-2 text-xs bg-green-100 text-green-600 px-2 py-1 rounded-full font-medium">✓ 已做</span>
          )}
        </div>
        <p className="text-gray-400 text-sm mb-4">{summary.适配理由}</p>

        <div className="flex gap-2 flex-wrap mb-4">
          <span className="flex items-center gap-1 bg-gray-50 text-gray-600 text-xs px-3 py-1.5 rounded-full border border-gray-100">
            <Clock size={12} />
            {summary.耗时分钟} 分钟
          </span>
          <span className="flex items-center gap-1 bg-gray-50 text-gray-600 text-xs px-3 py-1.5 rounded-full border border-gray-100">
            <BarChart2 size={12} />
            {summary.难度}
          </span>
          {summary.是否油烟 && (
            <span className="flex items-center gap-1 bg-gray-50 text-gray-500 text-xs px-3 py-1.5 rounded-full border border-gray-100">
              <Wind size={12} />
              有油烟
            </span>
          )}
          {usageRate >= 60 && (
            <span className="flex items-center gap-1 bg-green-50 text-green-600 text-xs px-3 py-1.5 rounded-full border border-green-100">
              {usageRate}% 食材利用
            </span>
          )}
        </div>

        {/* 食材使用情况折叠 */}
        {hasInventoryIngredients && (
          <button
            onClick={() => setStatsOpen((v) => !v)}
            className="w-full flex items-center justify-between text-sm text-gray-500 py-2 border-t border-gray-100 mb-4 active:opacity-70"
          >
            <span>查看食材使用情况</span>
            <ChevronDown
              size={16}
              className={`transition-transform duration-200 ${statsOpen ? 'rotate-180' : ''}`}
            />
          </button>
        )}

        {statsOpen && (
          <div className="space-y-1.5 mb-4 text-sm bg-gray-50 rounded-xl p-3">
            {stats.已用库存食材.length > 0 && (
              <p className="text-green-700">✓ 用了你库存的：{stats.已用库存食材.join('、')}</p>
            )}
            {stats.已用今日输入.length > 0 && (
              <p className="text-green-600">✓ 用了今天加的：{stats.已用今日输入.join('、')}</p>
            )}
            {stats.未用上的库存.length > 0 && (
              <p className="text-gray-400">○ 没用上的库存：{stats.未用上的库存.join('、')}</p>
            )}
            {stats.已用库存食材.length === 0 && stats.已用今日输入.length === 0 && (
              <p className="text-gray-400">（暂无食材使用信息）</p>
            )}
          </div>
        )}

        {hasUsedIngredient && (
          <p className="text-xs text-amber-600 bg-amber-50 rounded-lg px-3 py-2 mb-3">
            ⚠️ 部分食材已用完，可能要换一道
          </p>
        )}

        <button
          onClick={isDone ? undefined : onSelect}
          disabled={isDone}
          className={`w-full py-3 rounded-xl font-semibold text-sm transition-transform ${
            isDone
              ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
              : 'bg-[#FF6B47] text-white active:scale-[0.98]'
          }`}
        >
          {isDone ? '已做过了' : '选这个 →'}
        </button>
      </div>
    </div>
  );
}

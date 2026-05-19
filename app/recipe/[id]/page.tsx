'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { ChevronLeft, Clock, Users, BarChart2, Flame, Check } from 'lucide-react';
import { useAppStore } from '@/lib/store';
import { useRecipeCache, toRecipe } from '@/lib/recipe-cache';
import { storageGet, STORAGE_KEYS } from '@/lib/storage';
import type { Recipe, HistoryRecord, DishSummary } from '@/types';
import { trackPageView, trackRecipeDetailViewed } from '@/lib/analytics-events';

const WAITING_MESSAGES = [
  '正在为你写菜谱…',
  '调整火候建议…',
  '匹配你的厨艺水平…',
  '看看怎么省力…',
];

export default function RecipePage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const { getSummaryById, selectedIngredients, fatigueLevel, foodPreference, setSelectedRecipeId } = useAppStore();
  const { getRecipe, isLoading: isCacheLoading } = useRecipeCache();

  const id = params.id;
  const summary: DishSummary | undefined = getSummaryById(id);

  const [localRecipe, setLocalRecipe] = useState<Recipe | null>(null);
  const [prepDone, setPrepDone] = useState<boolean[]>([]);
  const [waitingMsg, setWaitingMsg] = useState(WAITING_MESSAGES[0]);
  const [timedOut, setTimedOut] = useState(false);

  // 轮询缓存直到 recipe 加载完成
  useEffect(() => {
    const cached = getRecipe(id);
    if (cached) {
      setLocalRecipe(cached);
      setPrepDone(new Array(cached.prepSteps.length).fill(false));
      trackPageView('recipe_detail', { dish_name: cached.name });
      trackRecipeDetailViewed(cached.name, true);
      return;
    }

    // 尝试从历史记录找（支持"再做一次"流程）
    const history = storageGet<HistoryRecord[]>(STORAGE_KEYS.HISTORY, []);
    const historyRecipe = history.find((h) => h.recipe.id === id)?.recipe;
    if (historyRecipe) {
      setLocalRecipe(historyRecipe);
      setSelectedRecipeId(id);
      setPrepDone(new Array(historyRecipe.prepSteps.length).fill(false));
      trackPageView('recipe_detail', { dish_name: historyRecipe.name });
      trackRecipeDetailViewed(historyRecipe.name, false);
      return;
    }

    if (isCacheLoading(id)) {
      // 预加载进行中，轮询等待
      const interval = setInterval(() => {
        const newCached = getRecipe(id);
        if (newCached) {
          setLocalRecipe(newCached);
          setPrepDone(new Array(newCached.prepSteps.length).fill(false));
          clearInterval(interval);
        }
      }, 200);
      return () => clearInterval(interval);
    }

    // 预加载未命中（可能失败或已清除），兜底直接请求
    if (summary) {
      fallbackFetch(id, summary);
    } else {
      router.replace('/home');
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  // 等待提示语轮换
  useEffect(() => {
    if (localRecipe) return;
    const idx = { current: 0 };
    const timer = setInterval(() => {
      idx.current = (idx.current + 1) % WAITING_MESSAGES.length;
      setWaitingMsg(WAITING_MESSAGES[idx.current]);
    }, 2000);
    return () => clearInterval(timer);
  }, [localRecipe]);

  // 30 秒超时提示
  useEffect(() => {
    if (localRecipe) return;
    const timer = setTimeout(() => setTimedOut(true), 30_000);
    return () => clearTimeout(timer);
  }, [localRecipe]);

  async function fallbackFetch(dishId: string, sum: DishSummary) {
    useRecipeCache.getState().setLoading(dishId, true);
    try {
      const profile = storageGet<{ seasonings?: string[]; equipment?: string[]; skillLevel?: string; spiceLevel?: number; avoidances?: string[]; servings?: number } | null>(STORAGE_KEYS.USER_PROFILE, null);
      const res = await fetch('/api/recipe-detail', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          菜名: sum.菜名,
          推荐时的食材: sum.使用的食材,
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
          疲劳度: fatigueLevel ?? 2,
          食材偏好: foodPreference,
        }),
      });
      const rawDetail = await res.json();
      if (!rawDetail.error) {
        const userIngredients = selectedIngredients.map((i) => i.名称);
        const recipe = toRecipe(sum, rawDetail, userIngredients);
        useRecipeCache.getState().setRecipe(dishId, recipe);
        setLocalRecipe(recipe);
        setPrepDone(new Array(recipe.prepSteps.length).fill(false));
      } else {
        useRecipeCache.getState().setLoading(dishId, false);
      }
    } catch {
      useRecipeCache.getState().setLoading(dishId, false);
    }
  }

  function togglePrep(idx: number) {
    setPrepDone((prev) => {
      const next = [...prev];
      next[idx] = !next[idx];
      return next;
    });
  }

  // 立即可显示的摘要信息（来自精简卡片）
  const displayName = summary?.菜名 ?? localRecipe?.name ?? '菜谱详情';
  const displayReason = summary?.适配理由 ?? localRecipe?.reason ?? '';
  const displayMinutes = summary?.耗时分钟 ?? localRecipe?.durationMinutes;
  const displayDifficulty = summary?.难度 ?? localRecipe?.difficulty;
  const displaySmoke = summary?.是否油烟 ?? localRecipe?.hasSmoke;
  const displayIngredientNames = summary?.使用的食材 ?? [];

  const isDetailLoading = !localRecipe;

  return (
    <div className="flex flex-col min-h-screen page-enter pb-28">
      {/* Header */}
      <div className="flex items-center gap-3 px-5 pt-12 pb-4">
        <button
          onClick={() => router.back()}
          className="w-10 h-10 rounded-full bg-white shadow-sm flex items-center justify-center text-gray-500 active:scale-95 transition-transform"
        >
          <ChevronLeft size={20} />
        </button>
        <h1 className="text-lg font-bold text-[#2D2D2D] flex-1">菜谱详情</h1>
      </div>

      <div className="px-5 space-y-5">
        {/* 标题区（立即显示） */}
        <div className="bg-white rounded-2xl p-5">
          <h2 className="text-2xl font-bold text-[#2D2D2D] mb-1">{displayName}</h2>
          {displayReason && <p className="text-gray-400 text-sm">{displayReason}</p>}
        </div>

        {/* 元信息（立即显示） */}
        {(displayMinutes !== undefined || displayDifficulty) && (
          <div className="grid grid-cols-3 gap-3">
            {displayMinutes !== undefined && (
              <MetaCard icon={<Clock size={18} className="text-[#FF6B47]" />} label="耗时" value={`${displayMinutes} 分钟`} />
            )}
            {displayDifficulty && (
              <MetaCard icon={<BarChart2 size={18} className="text-[#FF6B47]" />} label="难度" value={displayDifficulty} />
            )}
            {displaySmoke !== undefined && (
              <MetaCard icon={<Users size={18} className="text-[#FF6B47]" />} label="油烟" value={displaySmoke ? '有油烟' : '无油烟'} />
            )}
          </div>
        )}

        {/* 详情区：等待 vs 完整内容 */}
        {isDetailLoading ? (
          <div className="space-y-4">
            {/* 食材名称简版（来自精简卡片） */}
            {displayIngredientNames.length > 0 && (
              <div className="bg-white rounded-2xl p-5">
                <h3 className="text-sm font-bold text-[#2D2D2D] mb-3">使用的食材</h3>
                <div className="flex flex-wrap gap-2">
                  {displayIngredientNames.map((name) => (
                    <span key={name} className="bg-gray-50 text-gray-600 text-sm px-3 py-1.5 rounded-full border border-gray-200">
                      {name}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* 骨架屏 + 等待文案 */}
            <div className="bg-white rounded-2xl p-5">
              {timedOut ? (
                <div className="text-center py-8">
                  <p className="text-gray-500 mb-4">加载有点慢，要不要重试？</p>
                  <button
                    onClick={() => {
                      setTimedOut(false);
                      if (summary) fallbackFetch(id, summary);
                    }}
                    className="bg-[#FF6B47] text-white px-6 py-3 rounded-2xl font-medium active:scale-95 transition-transform"
                  >
                    重试
                  </button>
                </div>
              ) : (
                <div className="flex flex-col items-center py-8">
                  <div className="flex gap-1 mb-4">
                    {[0, 1, 2].map((i) => (
                      <div
                        key={i}
                        className="w-2 h-2 rounded-full bg-[#FF6B47]"
                        style={{ animation: `skeletonPulse 1.2s ease-in-out ${i * 0.2}s infinite` }}
                      />
                    ))}
                  </div>
                  <p className="text-gray-500 text-sm">{waitingMsg}</p>
                  <div className="w-full mt-5 space-y-3">
                    <div className="skeleton h-4 w-full rounded" />
                    <div className="skeleton h-4 w-4/5 rounded" />
                    <div className="skeleton h-4 w-3/5 rounded" />
                  </div>
                </div>
              )}
            </div>
          </div>
        ) : (
          // 完整菜谱内容（从缓存加载后 fade in）
          <div className="space-y-5 animate-in fade-in duration-300">
            {/* 厨具 */}
            {localRecipe.utensils.length > 0 && (
              <Section title="厨具清单">
                <div className="flex flex-wrap gap-2">
                  {localRecipe.utensils.map((u) => (
                    <span key={u} className="bg-gray-50 text-gray-600 text-sm px-3 py-1.5 rounded-full border border-gray-200">
                      {u}
                    </span>
                  ))}
                </div>
              </Section>
            )}

            {/* 食材清单（含数量） */}
            <Section title="食材清单">
              {localRecipe.ingredients.filter((i) => i.source === '今日食材').length > 0 && (
                <>
                  <p className="text-xs text-[#FF6B47] font-medium mb-2">今日食材</p>
                  <div className="space-y-1.5 mb-3">
                    {localRecipe.ingredients
                      .filter((i) => i.source === '今日食材')
                      .map((ing, i) => (
                        <IngredientRow key={i} name={ing.name} amount={ing.amount} primary />
                      ))}
                  </div>
                </>
              )}
              {localRecipe.ingredients.filter((i) => i.source === '调料库').length > 0 && (
                <>
                  <p className="text-xs text-gray-400 font-medium mb-2">调料库</p>
                  <div className="space-y-1.5">
                    {localRecipe.ingredients
                      .filter((i) => i.source === '调料库')
                      .map((ing, i) => (
                        <IngredientRow key={i} name={ing.name} amount={ing.amount} />
                      ))}
                  </div>
                </>
              )}
            </Section>

            {/* 预处理 */}
            {localRecipe.prepSteps.length > 0 && (
              <Section title="预处理">
                <div className="space-y-2">
                  {localRecipe.prepSteps.map((step, i) => (
                    <button
                      key={i}
                      onClick={() => togglePrep(i)}
                      className={`w-full flex items-start gap-3 p-3 rounded-xl text-left transition-all ${
                        prepDone[i] ? 'bg-gray-50 opacity-60' : 'bg-[#FFF0EB]'
                      }`}
                    >
                      <div className={`mt-0.5 w-5 h-5 rounded-full border-2 flex-shrink-0 flex items-center justify-center transition-colors ${
                        prepDone[i] ? 'bg-green-500 border-green-500' : 'border-[#FF6B47]'
                      }`}>
                        {prepDone[i] && <Check size={12} className="text-white" />}
                      </div>
                      <span className={`text-sm ${prepDone[i] ? 'line-through text-gray-400' : 'text-[#2D2D2D]'}`}>
                        {step.action}
                        {step.durationSeconds > 0 && (
                          <span className="text-gray-400 ml-1">({Math.round(step.durationSeconds / 60 * 10) / 10}分钟)</span>
                        )}
                      </span>
                    </button>
                  ))}
                </div>
              </Section>
            )}

            {/* 烹煮步骤 */}
            <Section title="烹煮步骤">
              <div className="space-y-3">
                {localRecipe.cookingSteps.map((step, i) => (
                  <div key={i} className="bg-gray-50 rounded-xl p-4">
                    <div className="flex items-start gap-3">
                      <span className="text-2xl font-bold text-[#FF6B47] leading-none w-7 flex-shrink-0">
                        {step.order}
                      </span>
                      <div className="flex-1">
                        <p className="text-[#2D2D2D] text-sm leading-relaxed">
                          {step.action}
                          {step.durationSeconds && step.durationSeconds > 0 && (
                            <TimerBadge seconds={step.durationSeconds} />
                          )}
                        </p>
                        {step.keyTip && (
                          <div className="mt-2 flex items-start gap-1.5 bg-amber-50 rounded-lg px-3 py-2">
                            <Flame size={13} className="text-amber-500 mt-0.5 flex-shrink-0" />
                            <p className="text-xs text-amber-700">{step.keyTip}</p>
                          </div>
                        )}
                        {step.parallelTask && (
                          <div className="mt-2 bg-blue-50 rounded-lg px-3 py-2">
                            <p className="text-xs text-blue-600">⚡ 同时：{step.parallelTask}</p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </Section>
          </div>
        )}
      </div>

      {/* 开始做饭 CTA */}
      <div className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[480px] px-5 pb-8 pt-4 bg-gradient-to-t from-[#FAF7F2] via-[#FAF7F2]/90 to-transparent">
        <button
          onClick={() => localRecipe && router.push(`/cooking/${localRecipe.id}`)}
          disabled={!localRecipe}
          className={`w-full py-4 rounded-2xl text-base font-bold transition-transform shadow-lg ${
            localRecipe
              ? 'bg-[#FF6B47] text-white active:scale-[0.98] shadow-[#FF6B47]/30'
              : 'bg-gray-200 text-gray-400 cursor-not-allowed shadow-none'
          }`}
        >
          {localRecipe ? '🍳 开始做饭' : '菜谱加载中…'}
        </button>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-2xl p-5">
      <h3 className="text-sm font-bold text-[#2D2D2D] mb-3">{title}</h3>
      {children}
    </div>
  );
}

function MetaCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="bg-white rounded-2xl p-4 flex flex-col items-center gap-1">
      {icon}
      <p className="text-xs text-gray-400">{label}</p>
      <p className="text-sm font-semibold text-[#2D2D2D]">{value}</p>
    </div>
  );
}

function IngredientRow({ name, amount, primary }: { name: string; amount: string; primary?: boolean }) {
  return (
    <div className="flex items-center justify-between py-1">
      <span className={`text-sm font-medium ${primary ? 'text-[#2D2D2D]' : 'text-gray-500'}`}>{name}</span>
      <span className="text-xs text-gray-400">{amount}</span>
    </div>
  );
}

function TimerBadge({ seconds }: { seconds: number }) {
  const label = seconds >= 60 ? `${Math.round(seconds / 60)}分钟` : `${seconds}秒`;
  return (
    <span className="inline-flex items-center gap-0.5 ml-1.5 bg-[#FF6B47]/10 text-[#FF6B47] text-xs px-2 py-0.5 rounded-full font-medium cursor-pointer hover:bg-[#FF6B47]/20 transition-colors">
      ⏱ {label}
    </span>
  );
}

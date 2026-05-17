'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Clock, BarChart2, Wind, ChevronLeft, RefreshCw, ChevronDown } from 'lucide-react';
import { useAppStore } from '@/lib/store';
import { storageGet, STORAGE_KEYS } from '@/lib/storage';
import type { Recipe, UserProfile, RecommendResponse, SelectedIngredient, IngredientUsageStats } from '@/types';

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
  recipe: Recipe,
  selectedIngredients: SelectedIngredient[],
): IngredientUsageStats {
  const recipeIngNames = recipe.ingredients
    .filter((i) => i.source === '今日食材')
    .map((i) => i.name);

  const inventoryItems = selectedIngredients.filter((i) => i.来源 === '库存');
  const inputItems = selectedIngredients.filter((i) => i.来源 !== '库存');

  const 已用库存食材 = inventoryItems
    .filter((i) => recipeIngNames.some((n) => loosematch(n, i.名称)))
    .map((i) => i.名称);

  const 已用今日输入 = inputItems
    .filter((i) => recipeIngNames.some((n) => loosematch(n, i.名称)))
    .map((i) => i.名称);

  const 未用上的库存 = inventoryItems
    .filter((i) => !已用库存食材.includes(i.名称))
    .map((i) => i.名称);

  return { 已用库存食材, 已用今日输入, 未用上的库存 };
}

export default function RecommendPage() {
  const router = useRouter();
  const {
    selectedIngredients, fatigueLevel, foodPreference, recipesMap, excludedDishes, retryCount,
    isLoading, error, p0Warning, setRecipes, setLoading, setError, setP0Warning,
    addExcludedDish, incrementRetry, setSelectedRecipeId,
  } = useAppStore();

  const [loadingMsg, setLoadingMsg] = useState(LOADING_MESSAGES[0]);
  const fetchInitiated = useRef(false);

  const ingredientNames = selectedIngredients.map((i) => i.名称);

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
    if (Object.keys(recipesMap).length > 0) return;
    if (fetchInitiated.current) return;
    fetchInitiated.current = true;
    fetchRecommendations();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function fetchRecommendations() {
    setLoading(true);
    setError(null);
    setP0Warning(null);

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

      if (!data.success || !data.recipes?.length) {
        setError(data.error ?? '这些食材暂时想不到好方案');
      } else {
        setRecipes(data.recipes);
        if (data.p0Warning) setP0Warning(data.p0Warning);
      }
    } catch {
      setError('刚才走神了，再试一次');
    } finally {
      setLoading(false);
    }
  }

  function handleRetry() {
    const currentNames = Object.values(recipesMap).map((r) => r.name);
    currentNames.forEach((n) => addExcludedDish(n));
    incrementRetry();
    fetchRecommendations();
  }

  function handleSelect(recipe: Recipe) {
    setSelectedRecipeId(recipe.id);
    router.push(`/recipe/${recipe.id}`);
  }

  const recipes = Object.values(recipesMap);

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
        {!isLoading && !error && recipes.length > 0 && (
          <div className="space-y-4 pb-32">
            {retryCount >= MAX_RETRY_FRIENDLY_MSG && (
              <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 text-sm text-amber-700">
                这些食材组合可能真的比较难发挥，建议补充点蛋白质或蔬菜再试试 😊
              </div>
            )}

            {recipes.map((recipe) => (
              <RecipeCard
                key={recipe.id}
                recipe={recipe}
                selectedIngredients={selectedIngredients}
                onSelect={() => handleSelect(recipe)}
              />
            ))}

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
              都不想做，重新推荐
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function RecipeCard({
  recipe, selectedIngredients, onSelect,
}: {
  recipe: Recipe;
  selectedIngredients: SelectedIngredient[];
  onSelect: () => void;
}) {
  const [statsOpen, setStatsOpen] = useState(false);

  const stats = computeUsageStats(recipe, selectedIngredients);
  const hasInventoryIngredients = selectedIngredients.some((i) => i.来源 === '库存');

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
      <div className="p-5">
        <h2 className="text-xl font-bold text-[#2D2D2D] mb-1">{recipe.name}</h2>
        <p className="text-gray-400 text-sm mb-4">{recipe.reason}</p>

        <div className="flex gap-2 flex-wrap mb-4">
          <span className="flex items-center gap-1 bg-gray-50 text-gray-600 text-xs px-3 py-1.5 rounded-full border border-gray-100">
            <Clock size={12} />
            {recipe.durationMinutes} 分钟
          </span>
          <span className="flex items-center gap-1 bg-gray-50 text-gray-600 text-xs px-3 py-1.5 rounded-full border border-gray-100">
            <BarChart2 size={12} />
            {recipe.difficulty}
          </span>
          {recipe.hasSmoke && (
            <span className="flex items-center gap-1 bg-gray-50 text-gray-500 text-xs px-3 py-1.5 rounded-full border border-gray-100">
              <Wind size={12} />
              有油烟
            </span>
          )}
          {recipe.ingredientUsageRate >= 0.6 && (
            <span className="flex items-center gap-1 bg-green-50 text-green-600 text-xs px-3 py-1.5 rounded-full border border-green-100">
              {Math.round(recipe.ingredientUsageRate * 100)}% 食材利用
            </span>
          )}
        </div>

        {/* Ingredient usage stats toggle */}
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

        {/* Usage stats panel */}
        {statsOpen && (
          <div className="space-y-1.5 mb-4 text-sm bg-gray-50 rounded-xl p-3">
            {stats.已用库存食材.length > 0 && (
              <p className="text-green-700">
                ✓ 用了你库存的：{stats.已用库存食材.join('、')}
              </p>
            )}
            {stats.已用今日输入.length > 0 && (
              <p className="text-green-600">
                ✓ 用了今天加的：{stats.已用今日输入.join('、')}
              </p>
            )}
            {stats.未用上的库存.length > 0 && (
              <p className="text-gray-400">
                ○ 没用上的库存：{stats.未用上的库存.join('、')}
              </p>
            )}
            {stats.已用库存食材.length === 0 && stats.已用今日输入.length === 0 && (
              <p className="text-gray-400">（暂无食材使用信息）</p>
            )}
          </div>
        )}

        <button
          onClick={onSelect}
          className="w-full bg-[#FF6B47] text-white py-3 rounded-xl font-semibold text-sm active:scale-[0.98] transition-transform"
        >
          选这个 →
        </button>
      </div>
    </div>
  );
}

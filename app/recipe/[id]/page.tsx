'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { ChevronLeft, Clock, Users, BarChart2, Flame, Check } from 'lucide-react';
import { useAppStore } from '@/lib/store';
import { storageGet, STORAGE_KEYS } from '@/lib/storage';
import type { Recipe, HistoryRecord } from '@/types';

export default function RecipePage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const { getRecipeById, fatigueLevel, getIngredientNames, setSelectedRecipeId } = useAppStore();
  const ingredients = getIngredientNames();

  const [recipe, setRecipe] = useState<Recipe | null>(null);
  const [prepDone, setPrepDone] = useState<boolean[]>([]);

  useEffect(() => {
    const id = params.id;
    // Look in session store first
    let r = getRecipeById(id);

    if (!r) {
      // Fallback: look in history (for "再做一次" flow)
      const history = storageGet<HistoryRecord[]>(STORAGE_KEYS.HISTORY, []);
      const record = history.find((h) => h.recipe.id === id);
      if (record) {
        r = record.recipe;
        setSelectedRecipeId(id);
      }
    }

    if (r) {
      setRecipe(r);
      setPrepDone(new Array(r.prepSteps.length).fill(false));
    } else {
      router.replace('/home');
    }
  }, [params.id, getRecipeById, router, setSelectedRecipeId]);

  if (!recipe) return null;

  const totalIngredients = recipe.ingredients;
  const todayIngredients = totalIngredients.filter((i) => i.source === '今日食材');
  const seasoningIngredients = totalIngredients.filter((i) => i.source === '调料库');

  function togglePrep(idx: number) {
    setPrepDone((prev) => {
      const next = [...prev];
      next[idx] = !next[idx];
      return next;
    });
  }

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
        {/* Title & reason */}
        <div className="bg-white rounded-2xl p-5">
          <h2 className="text-2xl font-bold text-[#2D2D2D] mb-1">{recipe.name}</h2>
          <p className="text-gray-400 text-sm">{recipe.reason}</p>
        </div>

        {/* Meta info */}
        <div className="grid grid-cols-3 gap-3">
          <MetaCard icon={<Clock size={18} className="text-[#FF6B47]" />} label="耗时" value={`${recipe.durationMinutes} 分钟`} />
          <MetaCard icon={<BarChart2 size={18} className="text-[#FF6B47]" />} label="难度" value={recipe.difficulty} />
          <MetaCard icon={<Users size={18} className="text-[#FF6B47]" />} label="油烟" value={recipe.hasSmoke ? '有油烟' : '无油烟'} />
        </div>

        {/* Utensils */}
        {recipe.utensils.length > 0 && (
          <Section title="厨具清单">
            <div className="flex flex-wrap gap-2">
              {recipe.utensils.map((u) => (
                <span key={u} className="bg-gray-50 text-gray-600 text-sm px-3 py-1.5 rounded-full border border-gray-200">
                  {u}
                </span>
              ))}
            </div>
          </Section>
        )}

        {/* Ingredients */}
        <Section title="食材清单">
          {todayIngredients.length > 0 && (
            <>
              <p className="text-xs text-[#FF6B47] font-medium mb-2">今日食材</p>
              <div className="space-y-1.5 mb-3">
                {todayIngredients.map((ing, i) => (
                  <IngredientRow key={i} name={ing.name} amount={ing.amount} primary />
                ))}
              </div>
            </>
          )}
          {seasoningIngredients.length > 0 && (
            <>
              <p className="text-xs text-gray-400 font-medium mb-2">调料库</p>
              <div className="space-y-1.5">
                {seasoningIngredients.map((ing, i) => (
                  <IngredientRow key={i} name={ing.name} amount={ing.amount} />
                ))}
              </div>
            </>
          )}
        </Section>

        {/* Prep steps */}
        {recipe.prepSteps.length > 0 && (
          <Section title="预处理">
            <div className="space-y-2">
              {recipe.prepSteps.map((step, i) => (
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
                      <span className="text-gray-400 ml-1">({step.durationSeconds}秒)</span>
                    )}
                  </span>
                </button>
              ))}
            </div>
          </Section>
        )}

        {/* Cooking steps */}
        <Section title="烹煮步骤">
          <div className="space-y-3">
            {recipe.cookingSteps.map((step, i) => (
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

      {/* Start cooking CTA */}
      <div className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[480px] px-5 pb-8 pt-4 bg-gradient-to-t from-[#FAF7F2] via-[#FAF7F2]/90 to-transparent">
        <button
          onClick={() => router.push(`/cooking/${recipe.id}`)}
          className="w-full bg-[#FF6B47] text-white py-4 rounded-2xl text-base font-bold active:scale-[0.98] transition-transform shadow-lg shadow-[#FF6B47]/30"
        >
          🍳 开始做饭
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

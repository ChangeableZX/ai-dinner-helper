'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Settings, X } from 'lucide-react';
import { useAppStore } from '@/lib/store';
import { storageGet, storageSet, STORAGE_KEYS } from '@/lib/storage';
import type { FatigueLevel } from '@/types';

const FATIGUE_OPTIONS: Array<{
  level: FatigueLevel;
  emoji: string;
  label: string;
  desc: string;
}> = [
  { level: 1, emoji: '😴', label: '懒到极致', desc: '10分钟内，最多2步骤' },
  { level: 2, emoji: '😐', label: '凑合做做', desc: '20分钟内，常规家常' },
  { level: 3, emoji: '💪', label: '今天还有劲', desc: '30+分钟，可稍复杂' },
];

function parseIngredients(raw: string): string[] {
  return raw
    .split(/[\s,，、\n]+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0 && s.length <= 20);
}

export default function HomePage() {
  const router = useRouter();
  const {
    ingredients, fatigueLevel, setIngredients, addIngredient, removeIngredient,
    setFatigueLevel, setError, setRecipes, resetRetry,
  } = useAppStore();

  const [inputValue, setInputValue] = useState('');
  const [recentIngredients, setRecentIngredients] = useState<string[]>([]);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // [边界处理] 超长食材文本提示
  const isInputTooLong = inputValue.length > 200;

  useEffect(() => {
    const recent = storageGet<string[]>(STORAGE_KEYS.RECENT_INGREDIENTS, []);
    setRecentIngredients(recent.slice(0, 6));
  }, []);

  function handleInputChange(val: string) {
    setInputValue(val);
    // Parse chips on the fly when separator chars are typed
    if (/[,，、\n]/.test(val)) {
      const parts = parseIngredients(val);
      parts.forEach((p) => addIngredient(p));
      setInputValue('');
    }
  }

  function handleInputBlur() {
    const parts = parseIngredients(inputValue);
    parts.forEach((p) => addIngredient(p));
    setInputValue('');
  }

  function handleInputKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleInputBlur();
    }
  }

  async function handleSubmit() {
    if (ingredients.length === 0 || !fatigueLevel) return;

    // Save recent ingredients
    const all = [...new Set([...ingredients, ...recentIngredients])].slice(0, 20);
    storageSet(STORAGE_KEYS.RECENT_INGREDIENTS, all);

    // Get history for recent dishes
    const history = storageGet<Array<{ recipeName: string; date: string }>>(
      STORAGE_KEYS.HISTORY, [],
    );
    const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    const recentDishes = history
      .filter((h) => new Date(h.date).getTime() > sevenDaysAgo)
      .map((h) => h.recipeName);

    const profile = storageGet<import('@/types').UserProfile | null>(
      STORAGE_KEYS.USER_PROFILE, null,
    )!;

    setError(null);
    resetRetry();
    setRecipes([]);
    router.push('/recommend');

    // Fetch happens in the recommend page, pass data via store
    // (store already has ingredients and fatigueLevel set)
    // We just navigate; recommend page will trigger the fetch
  }

  const canSubmit = ingredients.length > 0 && fatigueLevel !== null;

  return (
    <div className="flex flex-col min-h-screen page-enter">
      {/* Header */}
      <div className="flex items-center justify-between px-5 pt-12 pb-4">
        <div>
          <h1 className="text-2xl font-bold text-[#2D2D2D]">饭饭 🍚</h1>
          <p className="text-gray-400 text-sm mt-0.5">今晚做什么？</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => router.push('/inventory')}
            className="w-11 h-11 rounded-full bg-white shadow-sm flex items-center justify-center text-gray-500 active:scale-95 transition-transform text-lg"
            aria-label="食材库"
          >
            📦
          </button>
          <button
            onClick={() => router.push('/profile')}
            className="w-11 h-11 rounded-full bg-white shadow-sm flex items-center justify-center text-gray-500 active:scale-95 transition-transform"
          >
            <Settings size={20} />
          </button>
        </div>
      </div>

      <div className="flex-1 px-5 space-y-6 pb-36">
        {/* Ingredients Section */}
        <section>
          <p className="text-sm font-semibold text-[#2D2D2D] mb-2">今天有什么食材？</p>

          {/* Chips */}
          {ingredients.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-3">
              {ingredients.map((ing) => (
                <span
                  key={ing}
                  className="flex items-center gap-1 bg-[#FFF0EB] text-[#FF6B47] text-sm px-3 py-1.5 rounded-full border border-[#FFD4C4] font-medium"
                >
                  {ing}
                  <button
                    onClick={() => removeIngredient(ing)}
                    className="ml-0.5 hover:text-red-500 transition-colors"
                    aria-label={`删除 ${ing}`}
                  >
                    <X size={13} />
                  </button>
                </span>
              ))}
            </div>
          )}

          {/* Input */}
          <div className="relative">
            <textarea
              ref={inputRef}
              value={inputValue}
              onChange={(e) => handleInputChange(e.target.value)}
              onBlur={handleInputBlur}
              onKeyDown={handleInputKeyDown}
              rows={2}
              placeholder={
                ingredients.length === 0
                  ? '比如：鸡蛋 番茄 一把青菜（空格/逗号/换行分隔）'
                  : '继续添加…'
              }
              className="w-full bg-white border border-gray-200 rounded-2xl px-4 py-3 text-sm resize-none outline-none focus:border-[#FF6B47] transition-colors placeholder:text-gray-300"
            />
            {isInputTooLong && (
              <p className="text-xs text-amber-500 mt-1">
                {/* [边界处理] 超长食材文本 */}
                今天买的有点多，可以分两顿哦 😄
              </p>
            )}
          </div>

          {/* Recent Ingredients */}
          {recentIngredients.length > 0 && (
            <div className="mt-3">
              <p className="text-xs text-gray-400 mb-2">最近常用</p>
              <div className="flex flex-wrap gap-2">
                {recentIngredients.map((r) => (
                  <button
                    key={r}
                    onClick={() => addIngredient(r)}
                    disabled={ingredients.includes(r)}
                    className={`px-3 py-1 rounded-full text-xs border transition-all active:scale-95 ${
                      ingredients.includes(r)
                        ? 'bg-gray-100 text-gray-300 border-gray-100 cursor-default'
                        : 'bg-white text-gray-500 border-gray-200 hover:border-[#FF6B47] hover:text-[#FF6B47]'
                    }`}
                  >
                    {r}
                  </button>
                ))}
              </div>
            </div>
          )}
        </section>

        {/* Fatigue Section */}
        <section>
          <p className="text-sm font-semibold text-[#2D2D2D] mb-3">今天多累？</p>
          <div className="flex flex-col gap-3">
            {FATIGUE_OPTIONS.map(({ level, emoji, label, desc }) => {
              const selected = fatigueLevel === level;
              return (
                <button
                  key={level}
                  onClick={() => setFatigueLevel(level)}
                  className={`flex items-center gap-4 p-4 rounded-2xl border-2 text-left transition-all active:scale-[0.98] ${
                    selected
                      ? 'border-[#FF6B47] bg-[#FFF0EB]'
                      : 'border-gray-200 bg-white'
                  }`}
                >
                  <span className="text-3xl">{emoji}</span>
                  <div>
                    <p className={`font-semibold text-base ${selected ? 'text-[#FF6B47]' : 'text-[#2D2D2D]'}`}>
                      {label}
                    </p>
                    <p className="text-gray-400 text-sm">{desc}</p>
                  </div>
                </button>
              );
            })}
          </div>
        </section>
      </div>

      {/* Fixed bottom CTA */}
      <div className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[480px] px-5 pb-8 pt-3 bg-gradient-to-t from-[#FAF7F2] via-[#FAF7F2]/90 to-transparent">
        <button
          onClick={handleSubmit}
          disabled={!canSubmit}
          className={`w-full py-4 rounded-2xl text-base font-semibold transition-all ${
            canSubmit
              ? 'bg-[#FF6B47] text-white active:scale-[0.98] shadow-lg shadow-[#FF6B47]/30'
              : 'bg-gray-200 text-gray-400 cursor-not-allowed'
          }`}
        >
          {/* [边界处理] 食材为空或未选疲劳度时置灰 */}
          {!ingredients.length
            ? '先告诉我有什么食材'
            : !fatigueLevel
            ? '选一下今天多累'
            : '看看做什么 →'}
        </button>
      </div>
    </div>
  );
}

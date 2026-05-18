'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { storageGet, STORAGE_KEYS } from '@/lib/storage';
import { useAppStore } from '@/lib/store';
import type { HistoryRecord } from '@/types';

const RATING_EMOJI: Record<string, string> = {
  good: '😋',
  ok: '😐',
  bad: '😞',
};

function formatDate(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffDays = Math.floor(diffMs / 86400000);
  if (diffDays === 0) return '今天';
  if (diffDays === 1) return '昨天';
  if (diffDays < 7) return `${diffDays}天前`;
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

export default function HistoryPage() {
  const router = useRouter();
  const { setSelectedRecipeId, setSelectedIngredients, setFatigueLevel } = useAppStore();
  const [records, setRecords] = useState<HistoryRecord[]>([]);

  useEffect(() => {
    const history = storageGet<HistoryRecord[]>(STORAGE_KEYS.HISTORY, []);
    setRecords(history);
  }, []);

  function handleViewRecipe(record: HistoryRecord) {
    setSelectedRecipeId(record.recipe.id);
    router.push(`/recipe/${record.recipe.id}`);
  }

  function handleCookAgain(record: HistoryRecord) {
    setSelectedRecipeId(record.recipe.id);
    setSelectedIngredients(record.ingredients.map((名称) => ({ 名称, 来源: '实时输入' as const })));
    setFatigueLevel(record.fatigueLevel);
    router.push(`/recipe/${record.recipe.id}`);
  }

  return (
    <div className="flex flex-col min-h-screen page-enter">
      <div className="flex items-center gap-3 px-5 pt-12 pb-4">
        <button
          onClick={() => router.back()}
          className="w-10 h-10 rounded-full bg-white shadow-sm flex items-center justify-center text-gray-500 active:scale-95 transition-transform"
        >
          <ChevronLeft size={20} />
        </button>
        <h1 className="text-lg font-bold text-[#2D2D2D]">历史记录</h1>
      </div>

      {records.length === 0 ? (
        /* [边界处理] 历史记录为空 */
        <div className="flex flex-col items-center justify-center flex-1 text-center px-6">
          <div className="text-6xl mb-4">📖</div>
          <p className="text-[#2D2D2D] font-semibold text-lg mb-2">还没有记录</p>
          <p className="text-gray-400 text-sm mb-8">做完第一道菜后就会出现在这里</p>
          <button
            onClick={() => router.replace('/home')}
            className="bg-[#FF6B47] text-white px-6 py-3 rounded-2xl font-medium active:scale-95 transition-transform"
          >
            去主页看看做什么 →
          </button>
        </div>
      ) : (
        <div className="px-5 pb-8 space-y-3">
          {records.map((record) => (
            <div key={record.id} className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-base font-bold text-[#2D2D2D] truncate">{record.recipeName}</span>
                    {record.rating && (
                      <span className="text-lg flex-shrink-0">{RATING_EMOJI[record.rating]}</span>
                    )}
                  </div>
                  <p className="text-xs text-gray-400">{formatDate(record.date)}</p>
                  {record.ingredients.length > 0 && (
                    <p className="text-xs text-gray-300 mt-1 truncate">
                      {record.ingredients.slice(0, 4).join('、')}{record.ingredients.length > 4 ? '…' : ''}
                    </p>
                  )}
                </div>
                <button
                  onClick={() => handleViewRecipe(record)}
                  className="w-9 h-9 rounded-full bg-gray-50 flex items-center justify-center text-gray-400 flex-shrink-0 active:scale-90 transition-transform"
                >
                  <ChevronRight size={16} />
                </button>
              </div>
              <button
                onClick={() => handleCookAgain(record)}
                className="mt-3 w-full py-2 rounded-xl border border-[#FF6B47]/30 text-[#FF6B47] text-sm font-medium active:scale-[0.98] transition-transform hover:bg-[#FFF0EB]"
              >
                再做一次
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

'use client';

import { useState, useEffect } from 'react';
import type { InventoryItem } from '@/types';
import { getFreshness, getFreshnessEmoji } from '@/lib/freshness';
import { getIngredientEmoji } from '@/lib/emoji-map';

interface ItemCardProps {
  item: InventoryItem;
  onEdit: (item: InventoryItem) => void;
  onMarkUsed: (id: string) => void;
  onRestore?: (id: string) => void;
  isUsed?: boolean;
  highlighted?: boolean;
}

function daysAgo(isoDate: string): number {
  const stored = new Date(isoDate);
  const storedDay = new Date(stored.getFullYear(), stored.getMonth(), stored.getDate());
  const now = new Date();
  const todayDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((todayDay.getTime() - storedDay.getTime()) / (1000 * 60 * 60 * 24));
}

export default function ItemCard({ item, onEdit, onMarkUsed, onRestore, isUsed, highlighted }: ItemCardProps) {
  const [fading, setFading] = useState(false);
  const [isHighlighted, setIsHighlighted] = useState(highlighted ?? false);

  useEffect(() => {
    if (!isHighlighted) return;
    const t = setTimeout(() => setIsHighlighted(false), 2000);
    return () => clearTimeout(t);
  }, [isHighlighted]);

  function handleMarkUsed() {
    setFading(true);
    setTimeout(() => onMarkUsed(item.id), 200);
  }

  const freshness = getFreshness(item);
  const freshnessEmoji = getFreshnessEmoji(freshness);
  const ingredientEmoji = getIngredientEmoji(item.名称);
  const days = daysAgo(item.入库时间);
  const daysLabel = days === 0 ? '今天入库' : `${days} 天前入库`;

  const freshnessTextColor =
    freshness === '新鲜' ? 'text-green-600' :
    freshness === '该吃了' ? 'text-amber-600' :
    'text-red-500';

  return (
    <div
      className={`rounded-2xl p-4 border shadow-sm transition-all duration-700 ${
        fading ? 'opacity-0' : 'opacity-100'
      } ${isUsed ? 'opacity-60' : ''} ${
        isHighlighted
          ? 'bg-orange-50 border-[#FF6B47]/40 ring-2 ring-[#FF6B47]/30'
          : 'bg-white border-gray-100 ring-0'
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <p className="text-lg font-bold text-[#2D2D2D] leading-tight">
            {ingredientEmoji} {item.名称}
          </p>
          {!isUsed && (
            <p className={`text-sm mt-0.5 ${freshnessTextColor}`}>
              {freshnessEmoji} {freshness} · {daysLabel}
            </p>
          )}
          {isUsed && (
            <p className="text-sm mt-0.5 text-gray-400">{daysLabel}用完</p>
          )}
          <p className="text-xs text-gray-400 mt-1">{item.来源}</p>
          {item.备注 && <p className="text-xs text-gray-400 mt-0.5">{item.备注}</p>}
        </div>

        <div className="flex gap-2 flex-shrink-0">
          {!isUsed ? (
            <>
              <button
                onClick={() => onEdit(item)}
                className="px-3 py-1.5 rounded-xl text-xs font-medium border border-gray-200 text-gray-600 bg-gray-50 active:scale-95 transition-transform"
              >
                编辑
              </button>
              <button
                onClick={handleMarkUsed}
                className="px-3 py-1.5 rounded-xl text-xs font-medium bg-[#FFF0EB] text-[#FF6B47] border border-[#FFD4C4] active:scale-95 transition-transform"
              >
                吃完了
              </button>
            </>
          ) : (
            <button
              onClick={() => onRestore?.(item.id)}
              className="px-3 py-1.5 rounded-xl text-xs font-medium border border-gray-200 text-gray-600 bg-gray-50 active:scale-95 transition-transform"
            >
              恢复
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

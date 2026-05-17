'use client';

import type { InventoryItem } from '@/types';
import { getFreshness } from '@/lib/freshness';

interface StatsBarProps {
  filteredActive: InventoryItem[];
  totalExpired: number;
}

export default function StatsBar({ filteredActive, totalExpired }: StatsBarProps) {
  const attention = filteredActive.filter((i) => {
    const f = getFreshness(i);
    return f === '该吃了' || f === '可能过期';
  });

  return (
    <div className="mb-3 space-y-2">
      {totalExpired > 0 && (
        <div className="px-4 py-2.5 bg-red-50 border border-red-100 rounded-xl text-sm text-red-600">
          ⚠️ 有 {totalExpired} 项食材可能已经过期，记得清理
        </div>
      )}
      <p className="text-sm text-gray-500">
        <span className="font-semibold text-[#2D2D2D]">在库 {filteredActive.length} 项</span>
        {attention.length > 0 && (
          <span className="ml-2 text-amber-600">· 该吃了 {attention.length} 项</span>
        )}
      </p>
    </div>
  );
}

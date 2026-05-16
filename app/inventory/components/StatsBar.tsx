'use client';

import type { InventoryItem } from '@/types';
import { getFreshness } from '@/lib/freshness';

interface StatsBarProps {
  items: InventoryItem[];
}

export default function StatsBar({ items }: StatsBarProps) {
  const active = items.filter((i) => i.状态 === '在库');
  const attention = active.filter((i) => {
    const f = getFreshness(i);
    return f === '该吃了' || f === '可能过期';
  });
  const expired = active.filter((i) => getFreshness(i) === '可能过期');

  return (
    <div className="mb-3 space-y-2">
      {expired.length > 0 && (
        <div className="px-4 py-2.5 bg-red-50 border border-red-100 rounded-xl text-sm text-red-600">
          ⚠️ 有 {expired.length} 项食材可能已经过期，记得清理
        </div>
      )}
      <p className="text-sm text-gray-500">
        <span className="font-semibold text-[#2D2D2D]">在库 {active.length} 项</span>
        {attention.length > 0 && (
          <span className="ml-2 text-amber-600">· 该吃了 {attention.length} 项</span>
        )}
      </p>
    </div>
  );
}

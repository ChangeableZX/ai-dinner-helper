import type { InventoryItem } from '@/types';

export type FreshnessLevel = '新鲜' | '该吃了' | '可能过期';

const THRESHOLDS: Record<string, { fresh: number; warn: number }> = {
  肉蛋海鲜: { fresh: 2, warn: 4 },
  蛋白质:   { fresh: 2, warn: 4 }, // legacy key — kept as fallback for pre-migration reads
  蔬菜:     { fresh: 2, warn: 4 },
  主食:     { fresh: 7, warn: 14 },
  调料:     { fresh: 90, warn: 180 },
  其他:     { fresh: 3, warn: 7 },
};

export function getFreshness(item: InventoryItem): FreshnessLevel {
  const daysPassed = (Date.now() - new Date(item.入库时间).getTime()) / (1000 * 60 * 60 * 24);
  const t = THRESHOLDS[item.类别 ?? '其他'];
  if (daysPassed <= t.fresh) return '新鲜';
  if (daysPassed <= t.warn) return '该吃了';
  return '可能过期';
}

export function getFreshnessEmoji(level: FreshnessLevel): string {
  return { 新鲜: '🟢', 该吃了: '🟡', 可能过期: '🔴' }[level];
}

export function getFreshnessColor(level: FreshnessLevel): string {
  return { 新鲜: 'green', 该吃了: 'yellow', 可能过期: 'red' }[level];
}

import type { Category, InventoryItem } from '@/types';
import { autoCategorize } from './auto-categorize';

export const CATEGORY_ORDER: Category[] = ['肉蛋海鲜', '蔬菜', '主食', '其他'];

export const CATEGORY_META: Record<Category, { emoji: string }> = {
  肉蛋海鲜: { emoji: '🥩' },
  蔬菜: { emoji: '🥬' },
  主食: { emoji: '🌾' },
  其他: { emoji: '📦' },
};

export interface CategoryGroup {
  category: Category;
  emoji: string;
  items: InventoryItem[];
}

export function getItemCategory(item: InventoryItem): Category {
  return item.类别 ?? autoCategorize(item.名称);
}

export function groupByCategory(items: InventoryItem[]): CategoryGroup[] {
  const result: CategoryGroup[] = [];
  for (const cat of CATEGORY_ORDER) {
    const catItems = items.filter((i) => getItemCategory(i) === cat);
    if (catItems.length > 0) {
      result.push({ category: cat, emoji: CATEGORY_META[cat].emoji, items: catItems });
    }
  }
  return result;
}

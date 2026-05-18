import type { InventoryItem } from '@/types';

const STORAGE_KEY = 'inventory_v1';

const SOY_KEYWORDS = ['豆腐', '豆干', '腐竹', '豆皮', '千张', '豆泡'];

function migrateItem(item: InventoryItem): InventoryItem {
  // Legacy: '蛋白质' was split into '肉蛋海鲜' / '蔬菜'
  if ((item.类别 as string) === '蛋白质') {
    const isSoy = SOY_KEYWORDS.some((kw) => item.名称.includes(kw));
    return { ...item, 类别: isSoy ? '蔬菜' : '肉蛋海鲜' };
  }
  // Legacy: '调料' is now a separate concept (seasoning library), not an inventory category
  if ((item.类别 as string) === '调料') {
    return { ...item, 类别: '其他' };
  }
  return item;
}

function persist(items: InventoryItem[]): void {
  const serialized = JSON.stringify(items);
  try {
    localStorage.setItem(STORAGE_KEY, serialized);
  } catch {
    try {
      sessionStorage.setItem(STORAGE_KEY, serialized);
    } catch {
      throw new Error('存储空间不足，请清理浏览器缓存后重试');
    }
  }
}

function readAll(): InventoryItem[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY) ?? sessionStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as InventoryItem[]) : [];
  } catch {
    return [];
  }
}

export const inventoryStore = {
  getAll(): InventoryItem[] {
    const raw = readAll();
    const migrated = raw.map(migrateItem);
    // Write back only if something actually changed, to avoid unnecessary I/O
    const count = migrated.filter((m, i) => m.类别 !== raw[i].类别).length;
    if (count > 0) {
      persist(migrated);
      console.log(`[Migration] 迁移了 ${count} 条食材分类（蛋白质 → 肉蛋海鲜/蔬菜）`);
    }
    return migrated;
  },

  getActive(): InventoryItem[] {
    return this.getAll().filter((i) => i.状态 === '在库');
  },

  /** Returns enriched items and whether any duplicate was merged. */
  add(
    items: Omit<InventoryItem, 'id' | '状态'> | Omit<InventoryItem, 'id' | '状态'>[],
  ): { added: InventoryItem[]; merged: boolean } {
    const all = this.getAll();
    const incoming = Array.isArray(items) ? items : [items];
    const enriched: InventoryItem[] = incoming.map((item) => ({
      ...item,
      id: crypto.randomUUID(),
      状态: '在库' as const,
    }));

    let merged = false;
    const next = [...all];
    for (const newItem of enriched) {
      const existingIdx = next.findIndex(
        (x) => x.名称 === newItem.名称 && x.状态 === '在库',
      );
      if (existingIdx >= 0) {
        next[existingIdx] = { ...next[existingIdx], 入库时间: newItem.入库时间 };
        merged = true;
      } else {
        next.push(newItem);
      }
    }

    persist(next);
    return { added: enriched, merged };
  },

  update(id: string, updates: Partial<InventoryItem>): void {
    const all = this.getAll();
    const idx = all.findIndex((i) => i.id === id);
    if (idx === -1) return;
    all[idx] = { ...all[idx], ...updates };
    persist(all);
  },

  markUsed(id: string): void {
    this.update(id, { 状态: '已用完' });
  },

  reactivate(id: string): void {
    this.update(id, { 状态: '在库', 入库时间: new Date().toISOString() });
  },

  delete(id: string): void {
    persist(this.getAll().filter((i) => i.id !== id));
  },

  /** Purge 已用完 records older than 30 days. */
  cleanup(): void {
    const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;
    const kept = this.getAll().filter(
      (i) => i.状态 === '在库' || new Date(i.入库时间).getTime() > cutoff,
    );
    persist(kept);
  },
};

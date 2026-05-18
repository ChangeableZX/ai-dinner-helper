import { supabase, isSupabaseEnabled } from '@/lib/supabase/client';
import { getUserId } from './user';
import type { InventoryItem, Category } from '@/types';
import type { DbInventoryItem } from './types';

// ─── 映射层 ───────────────────────────────────────────────────────

const VALID_DB_CATEGORIES: Set<string> = new Set(['肉蛋海鲜', '蔬菜', '主食', '其他']);

function toDbItem(item: InventoryItem, userId: string): DbInventoryItem {
  return {
    id: item.id,
    user_id: userId,
    name: item.名称,
    // 防御：旧数据中若仍有 '调料' 则归入 '其他'
    category: VALID_DB_CATEGORIES.has(item.类别 ?? '')
      ? (item.类别 as Category)
      : '其他',
    source: item.来源 ?? null,
    status: item.状态,
    added_at: item.入库时间,
    used_up_at: null,
    note: item.备注 ?? null,
    quantity_desc: item.数量描述 ?? null,
    metadata: {},
  };
}

function fromDbItem(db: DbInventoryItem): InventoryItem {
  return {
    id: db.id,
    名称: db.name,
    入库时间: db.added_at,
    来源: db.source ?? '手动添加',
    状态: db.status,
    备注: db.note ?? undefined,
    数量描述: db.quantity_desc ?? undefined,
    类别: (db.category as Category) ?? undefined,
  };
}

function readLocalItems(): InventoryItem[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem('inventory_v1')
      ?? sessionStorage.getItem('inventory_v1');
    return raw ? (JSON.parse(raw) as InventoryItem[]) : [];
  } catch {
    return [];
  }
}

// ─── 公共 API ─────────────────────────────────────────────────────

/**
 * 读取食材库
 * Phase 1: 始终返回 localStorage 数据，Supabase 留待 Prompt 2 切换
 */
export async function getInventoryItems(): Promise<InventoryItem[]> {
  return readLocalItems();
}

/**
 * 将本地食材库全量同步到 Supabase（迁移时调用）
 * upsert 保证幂等，重复调用安全
 */
export async function syncInventoryToSupabase(): Promise<void> {
  if (!isSupabaseEnabled()) return;

  try {
    const userId = await getUserId();
    if (!userId) return;

    const items = readLocalItems();
    if (items.length === 0) return;

    const dbItems = items.map((item) => toDbItem(item, userId));
    const { error } = await supabase!
      .from('inventory_items')
      .upsert(dbItems, { onConflict: 'id' });

    if (error) console.error('[data/inventory] Sync failed:', error);
    else console.log(`[data/inventory] Synced ${items.length} items`);
  } catch (err) {
    console.error('[data/inventory] Unexpected error during sync:', err);
  }
}

/**
 * 从 Supabase 读取食材库（Prompt 2 切换数据源后使用）
 */
export async function getInventoryItemsFromCloud(): Promise<InventoryItem[]> {
  if (!isSupabaseEnabled()) return readLocalItems();

  try {
    const userId = await getUserId();
    if (!userId) return readLocalItems();

    const { data, error } = await supabase!
      .from('inventory_items')
      .select('*')
      .eq('user_id', userId)
      .order('added_at', { ascending: false });

    if (error) {
      console.error('[data/inventory] Cloud fetch failed, falling back:', error);
      return readLocalItems();
    }

    return (data ?? []).map((row) => fromDbItem(row as DbInventoryItem));
  } catch {
    return readLocalItems();
  }
}

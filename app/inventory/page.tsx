'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronLeft } from 'lucide-react';
import { toast } from 'sonner';

import type { InventoryItem, Category } from '@/types';
import { inventoryStore } from '@/lib/inventory-store';
import { getFreshness } from '@/lib/freshness';
import { getItemCategory } from '@/lib/category-groups';

import StatsBar from './components/StatsBar';
import ItemCard from './components/ItemCard';
import EmptyState from './components/EmptyState';
import AddItemDialog from './components/AddItemDialog';

type FilterTab = '全部' | '新鲜' | '该吃了' | '可能过期';

const FRESHNESS_TABS: Array<{ value: FilterTab; label: string }> = [
  { value: '全部', label: '全部' },
  { value: '新鲜', label: '🟢 新鲜' },
  { value: '该吃了', label: '🟡 该吃了' },
  { value: '可能过期', label: '🔴 可能过期' },
];

const CATEGORY_TABS: Array<{ value: Category | null; label: string }> = [
  { value: null, label: '全部' },
  { value: '肉蛋海鲜', label: '🥩 肉蛋海鲜' },
  { value: '蔬菜', label: '🥬 蔬菜' },
  { value: '主食', label: '🌾 主食' },
  { value: '其他', label: '📦 其他' },
];

interface DialogState {
  open: boolean;
  mode: 'add' | 'edit';
  item?: InventoryItem;
}

export default function InventoryPage() {
  const router = useRouter();
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [filter, setFilter] = useState<FilterTab>('全部');
  const [categoryFilter, setCategoryFilter] = useState<Category | null>(null);
  const [dialog, setDialog] = useState<DialogState>({ open: false, mode: 'add' });
  const [newlyAddedIds, setNewlyAddedIds] = useState<Set<string>>(new Set());

  function refresh() {
    setItems(inventoryStore.getAll());
  }

  useEffect(() => {
    inventoryStore.cleanup();
    refresh();
    const raw = sessionStorage.getItem('newly_added_ids');
    if (raw) {
      sessionStorage.removeItem('newly_added_ids');
      try { setNewlyAddedIds(new Set(JSON.parse(raw) as string[])); } catch {}
    }
  }, []);

  // Active items sorted by urgency (oldest first)
  const activeItems = items
    .filter((i) => i.状态 === '在库')
    .sort((a, b) => new Date(a.入库时间).getTime() - new Date(b.入库时间).getTime());

  // Apply freshness + category filter (AND)
  const filteredActive = activeItems.filter((i) => {
    const freshnessMatch = filter === '全部' || getFreshness(i) === filter;
    const categoryMatch = categoryFilter === null || getItemCategory(i) === categoryFilter;
    return freshnessMatch && categoryMatch;
  });

  const totalExpired = activeItems.filter((i) => getFreshness(i) === '可能过期').length;

  // Used items sorted by most recently used first
  const usedItems = items
    .filter((i) => i.状态 === '已用完')
    .sort((a, b) => new Date(b.入库时间).getTime() - new Date(a.入库时间).getTime());

  function openAdd() {
    setDialog({ open: true, mode: 'add', item: undefined });
  }

  function openEdit(item: InventoryItem) {
    setDialog({ open: true, mode: 'edit', item });
  }

  function closeDialog() {
    setDialog((d) => ({ ...d, open: false }));
  }

  function handleSave(data: Omit<InventoryItem, 'id' | '状态'>) {
    if (dialog.mode === 'add') {
      try {
        const { merged } = inventoryStore.add(data);
        refresh();
        closeDialog();
        if (merged) {
          toast.info(`已合并到现有的「${data.名称}」，入库时间已更新`);
        } else {
          toast.success(`已添加「${data.名称}」`);
        }
      } catch (e) {
        toast.error(e instanceof Error ? e.message : '添加失败，请重试');
      }
    } else if (dialog.mode === 'edit' && dialog.item) {
      try {
        inventoryStore.update(dialog.item.id, data);
        refresh();
        closeDialog();
        toast.success(`已更新「${data.名称}」`);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : '更新失败，请重试');
      }
    }
  }

  function handleDelete(id: string) {
    const name = items.find((i) => i.id === id)?.名称 ?? '';
    try {
      inventoryStore.delete(id);
      refresh();
      closeDialog();
      toast.success(`已删除「${name}」`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : '删除失败，请重试');
    }
  }

  function handleMarkUsed(id: string) {
    try {
      inventoryStore.markUsed(id);
      refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : '操作失败，请重试');
    }
  }

  function handleRestore(id: string) {
    const name = items.find((i) => i.id === id)?.名称 ?? '';
    try {
      inventoryStore.reactivate(id);
      refresh();
      toast.success(`「${name}」已恢复到在库`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : '操作失败，请重试');
    }
  }

  const isEmpty = activeItems.length === 0 && usedItems.length === 0;

  return (
    <div className="flex flex-col min-h-screen page-enter">
      {/* Header */}
      <div className="flex items-center gap-3 px-5 pt-12 pb-4">
        <button
          onClick={() => router.back()}
          className="w-10 h-10 rounded-full bg-white shadow-sm flex items-center justify-center text-gray-500 active:scale-95 transition-transform"
        >
          <ChevronLeft size={20} />
        </button>
        <h1 className="text-lg font-bold text-[#2D2D2D] flex-1">我的食材库</h1>
        <button
          onClick={() => router.push('/inventory/upload')}
          className="w-10 h-10 rounded-full bg-white shadow-sm flex items-center justify-center active:scale-95 transition-transform text-lg"
          aria-label="上传订单"
        >
          📸
        </button>
      </div>

      <div className="flex-1 px-5 pb-32">
        {isEmpty ? (
          <EmptyState onAdd={openAdd} onUpload={() => router.push('/inventory/upload')} />
        ) : (
          <>
            <StatsBar filteredActive={filteredActive} totalExpired={totalExpired} />

            {/* Two-row filter: row 1 = freshness, row 2 = category */}
            <div className="space-y-2 mb-4">
              <div className="flex flex-wrap gap-1.5">
                {FRESHNESS_TABS.map(({ value, label }) => (
                  <button
                    key={value}
                    onClick={() => setFilter(value)}
                    className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all active:scale-95 ${
                      filter === value
                        ? 'bg-[#FF6B47] text-white shadow-sm'
                        : 'bg-white text-gray-500 border border-gray-200'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <div className="flex flex-wrap gap-1.5">
                {CATEGORY_TABS.map(({ value, label }) => (
                  <button
                    key={value ?? '_all'}
                    onClick={() => setCategoryFilter(value)}
                    className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all active:scale-95 ${
                      categoryFilter === value
                        ? 'bg-[#FF6B47] text-white shadow-sm'
                        : 'bg-white text-gray-500 border border-gray-200'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {/* Active items */}
            <div className="space-y-3">
              {filteredActive.length === 0 && (filter !== '全部' || categoryFilter !== null) && (
                <p className="text-center text-sm text-gray-400 py-8">
                  暂时没有符合条件的食材
                </p>
              )}
              {filteredActive.map((item) => (
                <ItemCard
                  key={item.id}
                  item={item}
                  onEdit={openEdit}
                  onMarkUsed={handleMarkUsed}
                  highlighted={newlyAddedIds.has(item.id)}
                />
              ))}
            </div>

            {/* Used items */}
            {usedItems.length > 0 && (
              <div className="mt-8">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">
                  最近用完
                </p>
                <div className="space-y-3">
                  {usedItems.map((item) => (
                    <ItemCard
                      key={item.id}
                      item={item}
                      onEdit={openEdit}
                      onMarkUsed={handleMarkUsed}
                      onRestore={handleRestore}
                      isUsed
                    />
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* FAB */}
      {!isEmpty && (
        <div className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[480px] px-5 pb-8 pt-3 bg-gradient-to-t from-[#FAF7F2] via-[#FAF7F2]/90 to-transparent">
          <div className="flex gap-3">
            <button
              onClick={() => router.push('/inventory/upload')}
              className="flex-1 py-4 rounded-2xl bg-[#FF6B47] text-white font-semibold text-base active:scale-[0.98] transition-all shadow-lg shadow-[#FF6B47]/30"
            >
              📸 上传订单
            </button>
            <button
              onClick={openAdd}
              className="flex-1 py-4 rounded-2xl border-2 border-[#FF6B47] text-[#FF6B47] font-semibold text-base active:scale-[0.98] transition-all"
            >
              ➕ 添加食材
            </button>
          </div>
        </div>
      )}

      <AddItemDialog
        open={dialog.open}
        mode={dialog.mode}
        item={dialog.item}
        onClose={closeDialog}
        onSave={handleSave}
        onDelete={handleDelete}
      />
    </div>
  );
}

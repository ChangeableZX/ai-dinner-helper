'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronLeft, SlidersHorizontal, X } from 'lucide-react';
import { toast } from 'sonner';

import type { InventoryItem, Category } from '@/types';
import { inventoryStore } from '@/lib/inventory-store';
import { getFreshness } from '@/lib/freshness';
import { CATEGORY_ORDER, CATEGORY_META, getItemCategory } from '@/lib/category-groups';

import StatsBar from './components/StatsBar';
import FilterTabs, { type FilterTab } from './components/FilterTabs';
import ItemCard from './components/ItemCard';
import EmptyState from './components/EmptyState';
import AddItemDialog from './components/AddItemDialog';

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
  const [categoryPanelOpen, setCategoryPanelOpen] = useState(false);
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

            {/* Freshness tabs + category filter button */}
            <div className="flex items-center gap-2 mb-4">
              <div className="flex-1 min-w-0">
                <FilterTabs active={filter} onChange={setFilter} />
              </div>
              <button
                onClick={() => categoryFilter ? setCategoryFilter(null) : setCategoryPanelOpen(true)}
                className={`flex-shrink-0 flex items-center gap-1 px-3 py-2 rounded-full text-sm font-medium border transition-all active:scale-95 ${
                  categoryFilter
                    ? 'bg-[#FF6B47] text-white border-[#FF6B47]'
                    : 'bg-white text-gray-500 border-gray-200'
                }`}
              >
                {categoryFilter ? (
                  <>
                    <span>{CATEGORY_META[categoryFilter].emoji}</span>
                    <span>{categoryFilter}</span>
                    <X size={13} />
                  </>
                ) : (
                  <>
                    <SlidersHorizontal size={14} />
                    <span>分类</span>
                  </>
                )}
              </button>
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

      {/* Category filter bottom sheet */}
      {categoryPanelOpen && (
        <div
          className="fixed inset-0 z-50"
          onClick={() => setCategoryPanelOpen(false)}
        >
          <div className="absolute inset-0 bg-black/30" />
          <div
            className="absolute bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[480px] bg-white rounded-t-2xl px-5 pt-5 pb-10"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="text-sm font-semibold text-[#2D2D2D] mb-4">按分类筛选</p>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => { setCategoryFilter(null); setCategoryPanelOpen(false); }}
                className={`px-4 py-2 rounded-full text-sm font-medium border transition-all active:scale-95 ${
                  categoryFilter === null
                    ? 'bg-[#FF6B47] text-white border-[#FF6B47]'
                    : 'bg-white text-gray-500 border-gray-200'
                }`}
              >
                全部（{activeItems.length}）
              </button>
              {CATEGORY_ORDER.map((cat) => {
                const count = activeItems.filter((i) => getItemCategory(i) === cat).length;
                if (count === 0) return null;
                return (
                  <button
                    key={cat}
                    onClick={() => {
                      setCategoryFilter(categoryFilter === cat ? null : cat);
                      setCategoryPanelOpen(false);
                    }}
                    className={`px-4 py-2 rounded-full text-sm font-medium border transition-all active:scale-95 ${
                      categoryFilter === cat
                        ? 'bg-[#FF6B47] text-white border-[#FF6B47]'
                        : 'bg-white text-gray-500 border-gray-200'
                    }`}
                  >
                    {CATEGORY_META[cat].emoji} {cat}（{count}）
                  </button>
                );
              })}
            </div>
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

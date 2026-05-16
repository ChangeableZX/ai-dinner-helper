'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronDown, ChevronLeft } from 'lucide-react';
import { toast } from 'sonner';
import type { Category } from '@/types';
import { inventoryStore } from '@/lib/inventory-store';
import { getIngredientEmoji } from '@/lib/emoji-map';
import { autoCategorize } from '@/lib/auto-categorize';

const CATEGORIES: Category[] = ['肉蛋海鲜', '蔬菜', '主食', '调料', '其他'];
const CATEGORY_EMOJI: Record<Category, string> = {
  肉蛋海鲜: '🥩', 蔬菜: '🥬', 主食: '🍚', 调料: '🧂', 其他: '🥘',
};

function todayNoonISO(): string {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate(), 12, 0, 0).toISOString();
}

interface ConfirmItem {
  localId: string;
  名称: string;
  类别: Category;
  数量描述?: string;
  置信度: '高' | '中' | '低';
  checked: boolean;
  isEditing: boolean;
  isManual: boolean;
  categoryOverridden: boolean;
}

interface OcrResult {
  items: Array<{
    名称: string;
    类别: Category;
    数量描述?: string;
    置信度: '高' | '中' | '低';
  }>;
  warnings: string[];
}

export default function ConfirmPage() {
  const router = useRouter();
  const [items, setItems] = useState<ConfirmItem[]>([]);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [openPickerItemId, setOpenPickerItemId] = useState<string | null>(null);
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);
  const [ready, setReady] = useState(false);
  const initialized = useRef(false);

  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;

    const raw = sessionStorage.getItem('ocr_pending_result');
    sessionStorage.removeItem('ocr_pending_result');
    if (!raw) { router.replace('/inventory/upload'); return; }
    try {
      const data = JSON.parse(raw) as OcrResult;
      setItems(
        data.items.map((item) => ({
          localId: crypto.randomUUID(),
          名称: item.名称,
          类别: item.类别,
          数量描述: item.数量描述,
          置信度: item.置信度,
          checked: true,
          isEditing: false,
          isManual: false,
          categoryOverridden: true,
        })),
      );
      setWarnings(data.warnings ?? []);
    } catch {
      router.replace('/inventory/upload');
      return;
    }
    setReady(true);
  }, [router]);

  const checkedCount = items.filter((i) => i.checked && i.名称.trim().length > 0).length;
  const allChecked = items.length > 0 && items.every((i) => i.checked);
  const hasMidLow = items.some((i) => i.checked && (i.置信度 === '中' || i.置信度 === '低'));

  function toggleAll() {
    const next = !allChecked;
    setItems((prev) => prev.map((i) => ({ ...i, checked: next })));
  }

  function toggleChecked(localId: string) {
    setItems((prev) => prev.map((i) => i.localId === localId ? { ...i, checked: !i.checked } : i));
  }

  function updateName(localId: string, val: string) {
    setItems((prev) => prev.map((i) => {
      if (i.localId !== localId) return i;
      const newCategory = (!i.categoryOverridden || i.isManual) ? autoCategorize(val) : i.类别;
      return { ...i, 名称: val, 类别: newCategory };
    }));
  }

  function toggleEditing(localId: string) {
    setItems((prev) => prev.map((i) => i.localId === localId ? { ...i, isEditing: !i.isEditing } : i));
    setOpenPickerItemId(null);
  }

  function updateCategory(localId: string, cat: Category) {
    setItems((prev) => prev.map((i) =>
      i.localId === localId ? { ...i, 类别: cat, categoryOverridden: true } : i,
    ));
    setOpenPickerItemId(null);
  }

  function addManualItem() {
    setItems((prev) => [
      ...prev,
      {
        localId: crypto.randomUUID(),
        名称: '',
        类别: '其他',
        置信度: '高',
        checked: true,
        isEditing: true,
        isManual: true,
        categoryOverridden: false,
      },
    ]);
  }

  function handleConfirm() {
    const toAdd = items.filter((i) => i.checked && i.名称.trim().length > 0);
    if (toAdd.length === 0) return;
    const { merged } = inventoryStore.add(
      toAdd.map((i) => ({
        名称: i.名称.trim(),
        类别: i.类别,
        入库时间: todayNoonISO(),
        来源: '订单识别' as const,
        ...(i.数量描述 ? { 数量描述: i.数量描述 } : {}),
      })),
    );
    const newIds = inventoryStore.getAll()
      .filter((x) => toAdd.some((t) => t.名称.trim() === x.名称 && x.状态 === '在库'))
      .map((x) => x.id);
    sessionStorage.setItem('newly_added_ids', JSON.stringify(newIds));
    toast.success(
      merged
        ? `已入库 ${toAdd.length} 项（部分已合并到现有食材）`
        : `已入库 ${toAdd.length} 项`,
    );
    router.push('/inventory');
  }

  function handleBack() {
    if (checkedCount > 0) { setShowLeaveConfirm(true); }
    else { router.back(); }
  }

  if (!ready) return null;

  const isEmpty = items.length === 0;

  return (
    <div className="flex flex-col min-h-screen">
      {/* Header */}
      <div className="flex items-center gap-3 px-5 pt-12 pb-4">
        <button
          onClick={handleBack}
          className="w-10 h-10 rounded-full bg-white shadow-sm flex items-center justify-center text-gray-500 active:scale-95 transition-transform"
        >
          <ChevronLeft size={20} />
        </button>
        <h1 className="text-lg font-bold text-[#2D2D2D] flex-1">确认识别结果</h1>
      </div>

      <div className="flex-1 px-5 pb-40">
        {/* Empty state */}
        {isEmpty && (
          <div className="flex flex-col items-center justify-center py-20 text-center px-4 gap-4">
            <div className="text-7xl">🤔</div>
            <p className="text-lg font-bold text-[#2D2D2D]">似乎没找到食材...</p>
            <p className="text-sm text-gray-400 leading-relaxed">
              可能原因：图片不是订单截图 · 文字太模糊 · 订单里没有食材
            </p>
            <div className="flex gap-3 w-full max-w-xs mt-2">
              <button
                onClick={() => router.replace('/inventory/upload')}
                className="flex-1 py-3 rounded-2xl border border-gray-200 text-gray-600 text-sm font-medium"
              >
                换张图试试
              </button>
              <button
                onClick={() => router.replace('/inventory')}
                className="flex-1 py-3 rounded-2xl bg-[#FF6B47] text-white text-sm font-semibold"
              >
                手动添加食材
              </button>
            </div>
          </div>
        )}

        {!isEmpty && (
          <>
            {/* Summary + select all */}
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="font-semibold text-[#2D2D2D]">
                  识别到 {items.length} 种食材
                </p>
                <p className="text-xs text-gray-400 mt-0.5">勾选要入库的，可以改名字</p>
              </div>
              <button
                onClick={toggleAll}
                className="text-sm font-medium text-[#FF6B47] active:scale-95 transition-transform"
              >
                {allChecked ? '全不选' : '全选'}
              </button>
            </div>

            {warnings.length > 0 && (
              <div className="mb-4 bg-amber-50 border border-amber-200 rounded-2xl px-4 py-3 text-sm text-amber-700">
                {warnings.join('；')}
              </div>
            )}

            {/* Item list */}
            <div className="space-y-3">
              {items.map((item) => (
                <div
                  key={item.localId}
                  className={`rounded-2xl p-4 border shadow-sm transition-colors ${
                    item.置信度 === '低' && item.checked
                      ? 'bg-amber-50 border-amber-200'
                      : 'bg-white border-gray-100'
                  }`}
                >
                  {/* Row 1: checkbox + emoji + name + edit */}
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => toggleChecked(item.localId)}
                      className="flex-shrink-0"
                    >
                      <span className={`w-5 h-5 rounded border-2 flex items-center justify-center text-xs font-bold transition-colors ${
                        item.checked
                          ? 'bg-[#FF6B47] border-[#FF6B47] text-white'
                          : 'border-gray-300 text-transparent'
                      }`}>✓</span>
                    </button>

                    <span className="text-xl flex-shrink-0">{getIngredientEmoji(item.名称)}</span>

                    {item.isEditing ? (
                      <input
                        value={item.名称}
                        onChange={(e) => updateName(item.localId, e.target.value)}
                        onBlur={() => toggleEditing(item.localId)}
                        placeholder="输入食材名..."
                        maxLength={20}
                        autoFocus
                        className="flex-1 border border-[#FF6B47] rounded-lg px-2 py-1 text-sm outline-none"
                      />
                    ) : (
                      <span
                        className={`flex-1 font-medium ${item.名称 ? 'text-[#2D2D2D]' : 'text-gray-300'}`}
                        onClick={() => toggleEditing(item.localId)}
                      >
                        {item.名称 || '输入食材名...'}
                      </span>
                    )}

                    <button
                      onClick={() => toggleEditing(item.localId)}
                      className="text-gray-400 flex-shrink-0 active:scale-95 transition-transform"
                    >
                      {item.isEditing
                        ? <span className="text-[#FF6B47] font-bold text-sm">✓</span>
                        : <span className="text-sm">✏️</span>}
                    </button>
                  </div>

                  {/* Row 2: category + quantity + confidence */}
                  <div className="ml-11 mt-2 flex items-center gap-2 flex-wrap">
                    <button
                      onClick={() =>
                        setOpenPickerItemId(
                          openPickerItemId === item.localId ? null : item.localId,
                        )
                      }
                      className="flex items-center gap-1 text-xs bg-gray-100 rounded-lg px-2 py-1 active:scale-95 transition-transform"
                    >
                      <span>{CATEGORY_EMOJI[item.类别]}</span>
                      <span className="text-gray-600">{item.类别}</span>
                      <ChevronDown
                        size={11}
                        className={`text-gray-400 transition-transform ${openPickerItemId === item.localId ? 'rotate-180' : ''}`}
                      />
                    </button>

                    {item.数量描述 && (
                      <span className="text-xs text-gray-400">{item.数量描述}</span>
                    )}

                    <span className="text-xs text-gray-400">
                      {item.置信度 === '高' ? '🟢' : item.置信度 === '中' ? '🟡' : '🔴'}
                      {' '}{item.置信度}置信度
                    </span>
                  </div>

                  {/* Category picker */}
                  {openPickerItemId === item.localId && (
                    <div className="ml-11 mt-2 flex flex-wrap gap-1.5">
                      {CATEGORIES.map((c) => (
                        <button
                          key={c}
                          onClick={() => updateCategory(item.localId, c)}
                          className={`flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-medium transition-all active:scale-95 ${
                            c === item.类别
                              ? 'bg-[#FF6B47] text-white'
                              : 'bg-gray-100 text-gray-600'
                          }`}
                        >
                          {CATEGORY_EMOJI[c]} {c}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Manual add */}
            <button
              onClick={addManualItem}
              className="mt-4 w-full py-3 rounded-2xl border-2 border-dashed border-gray-200 text-sm text-gray-400 font-medium active:scale-[0.98] transition-transform"
            >
              + 漏掉了？手动添加
            </button>

            {hasMidLow && (
              <p className="mt-3 text-xs text-amber-600 text-center">
                ⚠️ 中/低置信度的食材请仔细核对
              </p>
            )}
          </>
        )}
      </div>

      {/* Bottom bar */}
      {!isEmpty && (
        <div className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[480px] px-5 pb-8 pt-3 bg-gradient-to-t from-[#FAF7F2] via-[#FAF7F2]/90 to-transparent">
          <div className="flex gap-3">
            <button
              onClick={handleBack}
              className="px-5 py-3.5 rounded-2xl border border-gray-200 text-gray-600 text-sm font-medium active:scale-95 transition-transform"
            >
              取消
            </button>
            <button
              onClick={handleConfirm}
              disabled={checkedCount === 0}
              className={`flex-1 py-3.5 rounded-2xl text-sm font-semibold transition-all ${
                checkedCount > 0
                  ? 'bg-[#FF6B47] text-white active:scale-[0.98] shadow-lg shadow-[#FF6B47]/30'
                  : 'bg-gray-200 text-gray-400 cursor-not-allowed'
              }`}
            >
              确认入库（{checkedCount} 项）
            </button>
          </div>
        </div>
      )}

      {/* Leave confirmation overlay */}
      {showLeaveConfirm && (
        <div
          className="fixed inset-0 z-50 bg-black/40 flex items-end justify-center"
          onClick={() => setShowLeaveConfirm(false)}
        >
          <div
            className="w-full max-w-[480px] bg-white rounded-t-3xl px-6 pt-6 pb-10 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="text-base font-bold text-[#2D2D2D]">识别结果还没保存</p>
            <p className="text-sm text-gray-500">确定离开吗？已勾选的食材将不会入库。</p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowLeaveConfirm(false)}
                className="flex-1 py-3 rounded-2xl border border-gray-200 text-gray-600 text-sm font-medium"
              >
                继续编辑
              </button>
              <button
                onClick={() => router.back()}
                className="flex-1 py-3 rounded-2xl bg-gray-700 text-white text-sm font-semibold"
              >
                确定离开
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

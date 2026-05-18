'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronDown, ChevronLeft } from 'lucide-react';
import { toast } from 'sonner';
import type { Category, UserProfile } from '@/types';
import { inventoryStore } from '@/lib/inventory-store';
import { getIngredientEmoji } from '@/lib/emoji-map';
import { autoCategorize } from '@/lib/auto-categorize';
import { storageGet, storageSet, STORAGE_KEYS } from '@/lib/storage';

// ─── Constants ────────────────────────────────────────────────────

const CATEGORIES: Category[] = ['肉蛋海鲜', '蔬菜', '主食', '其他'];
const CATEGORY_EMOJI: Record<Category, string> = {
  肉蛋海鲜: '🥩', 蔬菜: '🥬', 主食: '🍚', 其他: '🥘',
};

function todayNoonISO(): string {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate(), 12, 0, 0).toISOString();
}

// ─── Types ────────────────────────────────────────────────────────

interface IngredientItem {
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

interface SeasoningItem {
  localId: string;
  名称: string;
  数量描述?: string;
  置信度: '高' | '中' | '低';
  checked: boolean;
  isEditing: boolean;
  isManual: boolean;
  alreadyInLibrary: boolean;
}

interface OcrResult {
  食材?: Array<{ 名称: string; 类别?: string; 数量描述?: string; 置信度?: string }>;
  调料?: Array<{ 名称: string; 数量描述?: string; 置信度?: string }>;
  // Legacy format fallback
  items?: Array<{ 名称: string; 类别?: string; 数量描述?: string; 置信度?: string }>;
  warnings?: string[];
}

// ─── Helpers ──────────────────────────────────────────────────────

function toConfidence(raw?: string): '高' | '中' | '低' {
  return (['高', '中', '低'].includes(raw ?? '') ? raw : '中') as '高' | '中' | '低';
}

function toCategory(raw?: string, name?: string): Category {
  const map: Record<string, Category> = {
    肉蛋海鲜: '肉蛋海鲜', 蛋白质: '肉蛋海鲜',
    蔬菜: '蔬菜', 主食: '主食', 其他: '其他',
  };
  return map[raw ?? ''] ?? autoCategorize(name ?? '');
}

// ─── Page ─────────────────────────────────────────────────────────

export default function ConfirmPage() {
  const router = useRouter();
  const [ingItems, setIngItems] = useState<IngredientItem[]>([]);
  const [seasonItems, setSeasonItems] = useState<SeasoningItem[]>([]);
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

    let data: OcrResult;
    try {
      data = JSON.parse(raw) as OcrResult;
    } catch {
      router.replace('/inventory/upload');
      return;
    }

    const profile = storageGet<UserProfile | null>(STORAGE_KEYS.USER_PROFILE, null);
    const existingSeasonings = new Set(profile?.seasonings ?? []);

    // Support new format (食材/调料) and legacy fallback (items → all go to 食材)
    const rawIngredients = data.食材 ?? data.items ?? [];
    const rawSeasonings = data.调料 ?? [];

    setIngItems(rawIngredients.map((item) => ({
      localId: crypto.randomUUID(),
      名称: item.名称,
      类别: toCategory(item.类别, item.名称),
      数量描述: item.数量描述,
      置信度: toConfidence(item.置信度),
      checked: true,
      isEditing: false,
      isManual: false,
      categoryOverridden: true,
    })));

    setSeasonItems(rawSeasonings.map((item) => {
      const already = existingSeasonings.has(item.名称);
      return {
        localId: crypto.randomUUID(),
        名称: item.名称,
        数量描述: item.数量描述,
        置信度: toConfidence(item.置信度),
        checked: !already,   // pre-unchecked if already in library
        isEditing: false,
        isManual: false,
        alreadyInLibrary: already,
      };
    }));

    setWarnings(data.warnings ?? []);
    setReady(true);
  }, [router]);

  // ─── Computed ─────────────────────────────────────────────────

  const ingCheckedCount   = ingItems.filter((i) => i.checked && i.名称.trim()).length;
  const seasonCheckedCount = seasonItems.filter((i) => i.checked && i.名称.trim()).length;
  const totalChecked = ingCheckedCount + seasonCheckedCount;

  const allIngChecked    = ingItems.length > 0 && ingItems.every((i) => i.checked);
  const allSeasonChecked = seasonItems.length > 0 && seasonItems.every((i) => i.checked);
  const hasMidLow = ingItems.some((i) => i.checked && (i.置信度 === '中' || i.置信度 === '低'))
    || seasonItems.some((i) => i.checked && (i.置信度 === '中' || i.置信度 === '低'));

  const isEmpty = ingItems.length === 0 && seasonItems.length === 0;

  // ─── Ingredient actions ───────────────────────────────────────

  function toggleAllIng() {
    const next = !allIngChecked;
    setIngItems((prev) => prev.map((i) => ({ ...i, checked: next })));
  }

  function toggleIngChecked(localId: string) {
    setIngItems((prev) => prev.map((i) => i.localId === localId ? { ...i, checked: !i.checked } : i));
  }

  function updateIngName(localId: string, val: string) {
    setIngItems((prev) => prev.map((i) => {
      if (i.localId !== localId) return i;
      const newCat = (!i.categoryOverridden || i.isManual) ? autoCategorize(val) : i.类别;
      return { ...i, 名称: val, 类别: newCat };
    }));
  }

  function toggleIngEditing(localId: string) {
    setIngItems((prev) => prev.map((i) => i.localId === localId ? { ...i, isEditing: !i.isEditing } : i));
    setOpenPickerItemId(null);
  }

  function updateIngCategory(localId: string, cat: Category) {
    setIngItems((prev) => prev.map((i) =>
      i.localId === localId ? { ...i, 类别: cat, categoryOverridden: true } : i,
    ));
    setOpenPickerItemId(null);
  }

  function addManualIng() {
    setIngItems((prev) => [...prev, {
      localId: crypto.randomUUID(),
      名称: '', 类别: '其他', 置信度: '高',
      checked: true, isEditing: true, isManual: true, categoryOverridden: false,
    }]);
  }

  // ─── Seasoning actions ────────────────────────────────────────

  function toggleAllSeason() {
    const next = !allSeasonChecked;
    setSeasonItems((prev) => prev.map((i) => ({ ...i, checked: next })));
  }

  function toggleSeasonChecked(localId: string) {
    setSeasonItems((prev) => prev.map((i) => i.localId === localId ? { ...i, checked: !i.checked } : i));
  }

  function updateSeasonName(localId: string, val: string) {
    setSeasonItems((prev) => prev.map((i) => i.localId === localId ? { ...i, 名称: val } : i));
  }

  function toggleSeasonEditing(localId: string) {
    setSeasonItems((prev) => prev.map((i) => i.localId === localId ? { ...i, isEditing: !i.isEditing } : i));
  }

  function addManualSeason() {
    setSeasonItems((prev) => [...prev, {
      localId: crypto.randomUUID(),
      名称: '', 置信度: '高',
      checked: true, isEditing: true, isManual: true, alreadyInLibrary: false,
    }]);
  }

  // ─── Confirm ──────────────────────────────────────────────────

  function handleConfirm() {
    const toAddIng = ingItems.filter((i) => i.checked && i.名称.trim());
    const toAddSeason = seasonItems.filter((i) => i.checked && i.名称.trim());
    if (toAddIng.length === 0 && toAddSeason.length === 0) return;

    // 1. Ingredients → inventoryStore
    let mergedAny = false;
    if (toAddIng.length > 0) {
      const { merged } = inventoryStore.add(
        toAddIng.map((i) => ({
          名称: i.名称.trim(),
          类别: i.类别,
          入库时间: todayNoonISO(),
          来源: '订单识别' as const,
          ...(i.数量描述 ? { 数量描述: i.数量描述 } : {}),
        })),
      );
      mergedAny = merged;
      const newIds = inventoryStore.getAll()
        .filter((x) => toAddIng.some((t) => t.名称.trim() === x.名称 && x.状态 === '在库'))
        .map((x) => x.id);
      sessionStorage.setItem('newly_added_ids', JSON.stringify(newIds));
    }

    // 2. Seasonings → profile.seasonings
    if (toAddSeason.length > 0) {
      const profile = storageGet<UserProfile | null>(STORAGE_KEYS.USER_PROFILE, null);
      if (profile) {
        const existing = new Set(profile.seasonings);
        const added: string[] = [];
        for (const s of toAddSeason) {
          const name = s.名称.trim();
          if (!existing.has(name)) {
            existing.add(name);
            added.push(name);
          }
        }
        if (added.length > 0) {
          storageSet(STORAGE_KEYS.USER_PROFILE, {
            ...profile,
            seasonings: [...profile.seasonings, ...added],
          });
        }
      }
    }

    // 3. Toast
    const parts: string[] = [];
    if (toAddIng.length > 0) {
      parts.push(mergedAny
        ? `食材 ${toAddIng.length} 项（部分已合并）`
        : `食材 ${toAddIng.length} 项`);
    }
    if (toAddSeason.length > 0) parts.push(`调料 ${toAddSeason.length} 项`);
    toast.success(`已入库：${parts.join('，')}`);

    router.push('/inventory');
  }

  function handleBack() {
    if (totalChecked > 0) setShowLeaveConfirm(true);
    else router.back();
  }

  if (!ready) return null;

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
            {warnings.length > 0 && (
              <div className="mb-4 bg-amber-50 border border-amber-200 rounded-2xl px-4 py-3 text-sm text-amber-700">
                {warnings.join('；')}
              </div>
            )}

            {/* ── 食材区域 ─────────────────────────────────── */}
            {ingItems.length > 0 && (
              <section className="mb-6">
                <div className="flex items-center justify-between mb-1">
                  <div>
                    <p className="font-semibold text-[#2D2D2D]">
                      🥬 识别到的食材（{ingItems.length}）
                    </p>
                    <p className="text-xs text-gray-400">加入食材库</p>
                  </div>
                  <button
                    onClick={toggleAllIng}
                    className="text-sm font-medium text-[#FF6B47] active:scale-95 transition-transform"
                  >
                    {allIngChecked ? '全不选' : '全选'}
                  </button>
                </div>

                <div className="space-y-3 mt-3">
                  {ingItems.map((item) => (
                    <div
                      key={item.localId}
                      className={`rounded-2xl p-4 border shadow-sm transition-colors ${
                        item.置信度 === '低' && item.checked
                          ? 'bg-amber-50 border-amber-200'
                          : 'bg-white border-gray-100'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <button onClick={() => toggleIngChecked(item.localId)} className="flex-shrink-0">
                          <span className={`w-5 h-5 rounded border-2 flex items-center justify-center text-xs font-bold transition-colors ${
                            item.checked ? 'bg-[#FF6B47] border-[#FF6B47] text-white' : 'border-gray-300 text-transparent'
                          }`}>✓</span>
                        </button>
                        <span className="text-xl flex-shrink-0">{getIngredientEmoji(item.名称)}</span>
                        {item.isEditing ? (
                          <input
                            value={item.名称}
                            onChange={(e) => updateIngName(item.localId, e.target.value)}
                            onBlur={() => toggleIngEditing(item.localId)}
                            placeholder="输入食材名..."
                            maxLength={20}
                            autoFocus
                            className="flex-1 border border-[#FF6B47] rounded-lg px-2 py-1 text-sm outline-none"
                          />
                        ) : (
                          <span
                            className={`flex-1 font-medium ${item.名称 ? 'text-[#2D2D2D]' : 'text-gray-300'}`}
                            onClick={() => toggleIngEditing(item.localId)}
                          >
                            {item.名称 || '输入食材名...'}
                          </span>
                        )}
                        <button
                          onClick={() => toggleIngEditing(item.localId)}
                          className="text-gray-400 flex-shrink-0 active:scale-95 transition-transform"
                        >
                          {item.isEditing
                            ? <span className="text-[#FF6B47] font-bold text-sm">✓</span>
                            : <span className="text-sm">✏️</span>}
                        </button>
                      </div>

                      <div className="ml-11 mt-2 flex items-center gap-2 flex-wrap">
                        <button
                          onClick={() => setOpenPickerItemId(openPickerItemId === item.localId ? null : item.localId)}
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
                          {item.置信度 === '高' ? '🟢' : item.置信度 === '中' ? '🟡' : '🔴'} {item.置信度}置信度
                        </span>
                      </div>

                      {openPickerItemId === item.localId && (
                        <div className="ml-11 mt-2 flex flex-wrap gap-1.5">
                          {CATEGORIES.map((c) => (
                            <button
                              key={c}
                              onClick={() => updateIngCategory(item.localId, c)}
                              className={`flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-medium transition-all active:scale-95 ${
                                c === item.类别 ? 'bg-[#FF6B47] text-white' : 'bg-gray-100 text-gray-600'
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

                <button
                  onClick={addManualIng}
                  className="mt-3 w-full py-3 rounded-2xl border-2 border-dashed border-gray-200 text-sm text-gray-400 font-medium active:scale-[0.98] transition-transform"
                >
                  + 漏掉了？手动添加食材
                </button>
              </section>
            )}

            {/* ── 调料区域 ─────────────────────────────────── */}
            {seasonItems.length > 0 && (
              <section className="mb-4">
                <div className="flex items-center justify-between mb-1">
                  <div>
                    <p className="font-semibold text-[#2D2D2D]">
                      🧂 识别到的调料（{seasonItems.length}）
                    </p>
                    <p className="text-xs text-gray-400">加入调料库</p>
                  </div>
                  <button
                    onClick={toggleAllSeason}
                    className="text-sm font-medium text-[#FF6B47] active:scale-95 transition-transform"
                  >
                    {allSeasonChecked ? '全不选' : '全选'}
                  </button>
                </div>

                <p className="text-xs text-gray-400 bg-gray-50 rounded-xl px-3 py-2 mt-2 mb-3">
                  调料是长期常备项，加入后会一直保留在「我的画像 → 调料库」中
                </p>

                <div className="space-y-3">
                  {seasonItems.map((item) => (
                    <div
                      key={item.localId}
                      className={`rounded-2xl p-4 border shadow-sm transition-colors ${
                        item.置信度 === '低' && item.checked
                          ? 'bg-amber-50 border-amber-200'
                          : 'bg-white border-gray-100'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <button onClick={() => toggleSeasonChecked(item.localId)} className="flex-shrink-0">
                          <span className={`w-5 h-5 rounded border-2 flex items-center justify-center text-xs font-bold transition-colors ${
                            item.checked ? 'bg-[#FF6B47] border-[#FF6B47] text-white' : 'border-gray-300 text-transparent'
                          }`}>✓</span>
                        </button>
                        <span className="text-xl flex-shrink-0">🧂</span>
                        {item.isEditing ? (
                          <input
                            value={item.名称}
                            onChange={(e) => updateSeasonName(item.localId, e.target.value)}
                            onBlur={() => toggleSeasonEditing(item.localId)}
                            placeholder="输入调料名..."
                            maxLength={20}
                            autoFocus
                            className="flex-1 border border-[#FF6B47] rounded-lg px-2 py-1 text-sm outline-none"
                          />
                        ) : (
                          <span
                            className={`flex-1 font-medium ${item.名称 ? 'text-[#2D2D2D]' : 'text-gray-300'}`}
                            onClick={() => toggleSeasonEditing(item.localId)}
                          >
                            {item.名称 || '输入调料名...'}
                          </span>
                        )}
                        <button
                          onClick={() => toggleSeasonEditing(item.localId)}
                          className="text-gray-400 flex-shrink-0 active:scale-95 transition-transform"
                        >
                          {item.isEditing
                            ? <span className="text-[#FF6B47] font-bold text-sm">✓</span>
                            : <span className="text-sm">✏️</span>}
                        </button>
                      </div>

                      <div className="ml-11 mt-2 flex items-center gap-2 flex-wrap">
                        {item.alreadyInLibrary && (
                          <span className="text-xs bg-green-50 text-green-600 border border-green-200 rounded-full px-2 py-0.5">
                            ✓ 已在调料库
                          </span>
                        )}
                        {item.数量描述 && (
                          <span className="text-xs text-gray-400">{item.数量描述}</span>
                        )}
                        <span className="text-xs text-gray-400">
                          {item.置信度 === '高' ? '🟢' : item.置信度 === '中' ? '🟡' : '🔴'} {item.置信度}置信度
                        </span>
                      </div>
                    </div>
                  ))}
                </div>

                <button
                  onClick={addManualSeason}
                  className="mt-3 w-full py-3 rounded-2xl border-2 border-dashed border-gray-200 text-sm text-gray-400 font-medium active:scale-[0.98] transition-transform"
                >
                  + 漏掉了？手动添加调料
                </button>
              </section>
            )}

            {hasMidLow && (
              <p className="mt-2 text-xs text-amber-600 text-center">
                ⚠️ 中/低置信度的条目请仔细核对
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
              disabled={totalChecked === 0}
              className={`flex-1 py-3.5 rounded-2xl text-sm font-semibold transition-all ${
                totalChecked > 0
                  ? 'bg-[#FF6B47] text-white active:scale-[0.98] shadow-lg shadow-[#FF6B47]/30'
                  : 'bg-gray-200 text-gray-400 cursor-not-allowed'
              }`}
            >
              确认入库（{totalChecked} 项）
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
            <p className="text-sm text-gray-500">确定离开吗？已勾选的食材和调料将不会入库。</p>
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

'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Settings, X, ChevronDown, ChevronUp, Plus, Package } from 'lucide-react';
import { useAppStore } from '@/lib/store';
import { storageGet, storageSet, STORAGE_KEYS } from '@/lib/storage';
import { inventoryStore } from '@/lib/inventory-store';
import { getFreshness, getFreshnessEmoji } from '@/lib/freshness';
import type { FatigueLevel, FoodPreference, SelectedIngredient, InventoryItem, Category } from '@/types';
import { groupByCategory } from '@/lib/category-groups';
import CloudMigrationBanner from '@/components/CloudMigrationBanner';

const FATIGUE_OPTIONS: Array<{
  level: FatigueLevel;
  emoji: string;
  label: string;
  desc: string;
}> = [
  { level: 1, emoji: '😴', label: '懒到极致', desc: '10分钟内，最多2步骤' },
  { level: 2, emoji: '😐', label: '凑合做做', desc: '20分钟内，常规家常' },
  { level: 3, emoji: '💪', label: '今天还有劲', desc: '30+分钟，可稍复杂' },
];

const FOOD_PREFERENCE_OPTIONS: Array<{
  id: FoodPreference;
  label: string;
  emoji: string;
  description: string;
  isDefault?: boolean;
}> = [
  { id: 'clear_stock', label: '清库存', emoji: '🟡', description: '优先用快过期的' },
  { id: 'default', label: '随便都行', emoji: '😊', description: 'AI 综合判断', isDefault: true },
  { id: 'fresh_first', label: '用新鲜的', emoji: '✨', description: '优先用最近买的' },
];

function parseIngredients(raw: string): string[] {
  return raw
    .split(/[\s,，、\n]+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0 && s.length <= 20);
}

// Sort inventory items: 可能过期 > 该吃了 > 新鲜, then by 入库时间 asc within group
function sortByFreshness(items: InventoryItem[]): InventoryItem[] {
  const order: Record<string, number> = { 可能过期: 0, 该吃了: 1, 新鲜: 2 };
  return [...items].sort((a, b) => {
    const fa = getFreshness(a);
    const fb = getFreshness(b);
    if (order[fa] !== order[fb]) return order[fa] - order[fb];
    return new Date(a.入库时间).getTime() - new Date(b.入库时间).getTime();
  });
}

function daysSince(isoDate: string): number {
  return Math.floor((Date.now() - new Date(isoDate).getTime()) / (1000 * 60 * 60 * 24));
}

export default function HomePage() {
  const router = useRouter();
  const {
    selectedIngredients, fatigueLevel, foodPreference,
    addSelectedIngredient, removeSelectedIngredient,
    setFatigueLevel, setFoodPreference,
    setError, setSummaries, resetRetry,
  } = useAppStore();

  const [inputValue, setInputValue] = useState('');
  const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([]);
  const [inventoryExpanded, setInventoryExpanded] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState<Set<Category>>(new Set());
  const [showExtraInput, setShowExtraInput] = useState(false);
  const [extraName, setExtraName] = useState('');
  const [extraSaveToLib, setExtraSaveToLib] = useState(true);
  const [showGuide, setShowGuide] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const isInputTooLong = inputValue.length > 200;
  const ingredientNames = selectedIngredients.map((i) => i.名称);

  useEffect(() => {
    const active = inventoryStore.getActive();
    setInventoryItems(sortByFreshness(active));

    // Check if we should show the empty-inventory guide
    if (active.length === 0) {
      const dismissed = storageGet<number>(STORAGE_KEYS.INVENTORY_GUIDE_DISMISSED, 0);
      if (Date.now() - dismissed > 24 * 60 * 60 * 1000) {
        setShowGuide(true);
      }
    }
  }, []);

  const expiringItems = inventoryItems.filter((i) => getFreshness(i) === '可能过期');
  const inventoryGroups = groupByCategory(inventoryItems);
  const hasCollapsible = inventoryExpanded || inventoryGroups.some((g) => g.items.length > 3);

  function handleInputChange(val: string) {
    setInputValue(val);
    if (/[,，、\n]/.test(val)) {
      const parts = parseIngredients(val);
      parts.forEach((p) => addSelectedIngredient({ 名称: p, 来源: '实时输入' }));
      setInputValue('');
    }
  }

  function handleInputBlur() {
    const parts = parseIngredients(inputValue);
    parts.forEach((p) => addSelectedIngredient({ 名称: p, 来源: '实时输入' }));
    setInputValue('');
  }

  function handleInputKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleInputBlur();
    }
  }

  function toggleInventoryItem(item: InventoryItem) {
    const freshness = getFreshness(item);
    if (ingredientNames.includes(item.名称)) {
      removeSelectedIngredient(item.名称);
    } else {
      addSelectedIngredient({
        名称: item.名称,
        来源: '库存',
        库存ID: item.id,
        新鲜度: freshness,
      });
    }
  }

  function addAllInventory() {
    inventoryItems.forEach((item) => {
      if (!ingredientNames.includes(item.名称)) {
        addSelectedIngredient({
          名称: item.名称,
          来源: '库存',
          库存ID: item.id,
          新鲜度: getFreshness(item),
        });
      }
    });
  }

  function addExpiringAndSetPreference() {
    expiringItems.forEach((item) => {
      if (!ingredientNames.includes(item.名称)) {
        addSelectedIngredient({
          名称: item.名称,
          来源: '库存',
          库存ID: item.id,
          新鲜度: '可能过期',
        });
      }
    });
    setFoodPreference('clear_stock');
  }

  function toggleGroupExpand(cat: Category) {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat); else next.add(cat);
      return next;
    });
  }

  function setGlobalExpanded(v: boolean) {
    setInventoryExpanded(v);
    if (!v) setExpandedGroups(new Set());
  }

  function handleAddExtra() {
    const name = extraName.trim();
    if (!name) return;
    addSelectedIngredient({ 名称: name, 来源: '临时输入' });
    if (extraSaveToLib) {
      inventoryStore.add({
        名称: name,
        入库时间: new Date().toISOString(),
        来源: '实时输入入库',
        类别: '其他',
      });
    }
    setExtraName('');
    setShowExtraInput(false);
  }

  function dismissGuide() {
    storageSet(STORAGE_KEYS.INVENTORY_GUIDE_DISMISSED, Date.now());
    setShowGuide(false);
  }

  async function handleSubmit() {
    if (selectedIngredients.length === 0 || !fatigueLevel) return;

    // Save recent ingredients (plain names)
    const recent = storageGet<string[]>(STORAGE_KEYS.RECENT_INGREDIENTS, []);
    const all = [...new Set([...ingredientNames, ...recent])].slice(0, 20);
    storageSet(STORAGE_KEYS.RECENT_INGREDIENTS, all);

    setError(null);
    resetRetry();
    setSummaries([]);
    router.push('/recommend');
  }

  const canSubmit = selectedIngredients.length > 0 && fatigueLevel !== null;

  return (
    <div className="flex flex-col min-h-screen page-enter">
      {/* Cloud migration banner */}
      <CloudMigrationBanner />

      {/* Expiring banner */}
      {expiringItems.length > 0 && (
        <div className="bg-amber-50 border-b border-amber-200 px-5 py-3 flex items-center justify-between gap-3">
          <p className="text-sm text-amber-700 flex-1">
            ⚠️ 你冰箱里有 {expiringItems.length} 样食材可能过期了，要不今晚清一清？
          </p>
          <div className="flex gap-2 flex-shrink-0">
            <button
              onClick={addExpiringAndSetPreference}
              className="text-xs bg-amber-500 text-white px-3 py-1.5 rounded-full active:scale-95 transition-transform"
            >
              一键加入
            </button>
            <button
              onClick={() => router.push('/inventory')}
              className="text-xs text-amber-600 border border-amber-300 px-3 py-1.5 rounded-full active:scale-95 transition-transform"
            >
              去看看
            </button>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between px-5 pt-10 pb-4">
        <div>
          <h1 className="text-2xl font-bold text-[#2D2D2D]">今晚做什么吃？</h1>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => router.push('/inventory')}
            className="w-11 h-11 rounded-full bg-white shadow-sm flex items-center justify-center text-gray-500 active:scale-95 transition-transform"
            aria-label="食材库"
          >
            <Package size={20} />
          </button>
          <button
            onClick={() => router.push('/profile')}
            className="w-11 h-11 rounded-full bg-white shadow-sm flex items-center justify-center text-gray-500 active:scale-95 transition-transform"
            aria-label="我的画像"
          >
            <Settings size={20} />
          </button>
        </div>
      </div>

      <div className="flex-1 px-5 space-y-5 pb-36">

        {/* ── 食材选择区 ─────────────────────────── */}
        <section>
          <p className="text-sm font-semibold text-[#2D2D2D] mb-2">📝 今天想用什么菜？</p>

          {/* Input */}
          <div className="relative">
            <textarea
              ref={inputRef}
              value={inputValue}
              onChange={(e) => handleInputChange(e.target.value)}
              onBlur={handleInputBlur}
              onKeyDown={handleInputKeyDown}
              rows={2}
              placeholder={
                selectedIngredients.length === 0
                  ? '输入或从下方选择…（空格/逗号/换行分隔）'
                  : '继续添加…'
              }
              className="w-full bg-white border border-gray-200 rounded-2xl px-4 py-3 text-sm resize-none outline-none focus:border-[#FF6B47] transition-colors placeholder:text-gray-300"
            />
            {isInputTooLong && (
              <p className="text-xs text-amber-500 mt-1">今天买的有点多，可以分两顿哦 😄</p>
            )}
          </div>

          {/* Selected chips */}
          {selectedIngredients.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-3">
              {selectedIngredients.map((ing) => (
                <span
                  key={ing.名称}
                  className="flex items-center gap-1 bg-[#FFF0EB] text-[#FF6B47] text-sm px-3 py-1.5 rounded-full border border-[#FFD4C4] font-medium"
                >
                  {ing.来源 === '库存' && ing.新鲜度 && (
                    <span className="text-xs">{getFreshnessEmoji(ing.新鲜度)}</span>
                  )}
                  {ing.名称}
                  <button
                    onClick={() => removeSelectedIngredient(ing.名称)}
                    className="ml-0.5 hover:text-red-500 transition-colors"
                    aria-label={`删除 ${ing.名称}`}
                  >
                    <X size={13} />
                  </button>
                </span>
              ))}
            </div>
          )}

          {/* Temporary supplement */}
          <div className="mt-2">
            {!showExtraInput ? (
              <button
                onClick={() => setShowExtraInput(true)}
                className="text-xs text-gray-400 flex items-center gap-1 py-1 active:scale-95 transition-transform"
              >
                <Plus size={13} />
                还有别的（亲戚送的、菜市场买的）
              </button>
            ) : (
              <div className="bg-white border border-gray-200 rounded-2xl p-4 mt-2 space-y-3">
                <input
                  type="text"
                  value={extraName}
                  onChange={(e) => setExtraName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleAddExtra()}
                  placeholder="食材名…"
                  autoFocus
                  className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-[#FF6B47]"
                />
                <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={extraSaveToLib}
                    onChange={(e) => setExtraSaveToLib(e.target.checked)}
                    className="accent-[#FF6B47]"
                  />
                  顺手存进食材库
                </label>
                <div className="flex gap-2 justify-end">
                  <button
                    onClick={() => { setShowExtraInput(false); setExtraName(''); }}
                    className="px-4 py-1.5 text-sm text-gray-500 border border-gray-200 rounded-xl active:scale-95 transition-transform"
                  >
                    取消
                  </button>
                  <button
                    onClick={handleAddExtra}
                    className="px-4 py-1.5 text-sm text-white bg-[#FF6B47] rounded-xl active:scale-95 transition-transform"
                  >
                    添加
                  </button>
                </div>
              </div>
            )}
          </div>
        </section>

        {/* ── 库存卡片 ───────────────────────────── */}
        {inventoryItems.length > 0 ? (
          <section>
            <p className="text-sm font-semibold text-[#2D2D2D] mb-2">
              📦 你冰箱里还有（{inventoryItems.length}）
            </p>
            <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
              {inventoryGroups.map((group, gIdx) => {
                const isGroupExpanded = inventoryExpanded || expandedGroups.has(group.category);
                const displayItems = isGroupExpanded ? group.items : group.items.slice(0, 3);
                const hiddenCount = group.items.length - 3;
                return (
                  <div key={group.category} className={gIdx > 0 ? 'border-t border-gray-100' : ''}>
                    {/* Group header */}
                    <div className="px-4 pt-2.5 pb-0.5 flex items-center gap-1.5">
                      <span className="text-sm leading-none">{group.emoji}</span>
                      <span className="text-xs font-medium text-gray-400">{group.category}</span>
                      <span className="text-xs text-gray-300">({group.items.length})</span>
                    </div>
                    {/* Items */}
                    <div className="divide-y divide-gray-50">
                      {displayItems.map((item) => {
                        const freshness = getFreshness(item);
                        const days = daysSince(item.入库时间);
                        const isAdded = ingredientNames.includes(item.名称);
                        return (
                          <button
                            key={item.id}
                            onClick={() => toggleInventoryItem(item)}
                            className={`w-full flex items-center justify-between px-4 py-3 active:bg-gray-50 transition-colors text-left ${isAdded ? 'bg-[#FFF0EB]' : ''}`}
                          >
                            <div className="flex items-center gap-2">
                              <span>{getFreshnessEmoji(freshness)}</span>
                              <span className={`text-sm font-medium ${isAdded ? 'text-[#FF6B47]' : 'text-[#2D2D2D]'}`}>
                                {item.名称}
                              </span>
                              <span className="text-xs text-gray-400">
                                {freshness} · {days === 0 ? '今天' : `${days}天前`}
                              </span>
                            </div>
                            {isAdded ? (
                              <span className="text-xs text-[#FF6B47] font-medium">✓ 已加入</span>
                            ) : (
                              <span className="text-xs text-gray-300">点击加入</span>
                            )}
                          </button>
                        );
                      })}
                      {/* Per-group expand / collapse */}
                      {!inventoryExpanded && hiddenCount > 0 && !expandedGroups.has(group.category) && (
                        <button
                          onClick={() => toggleGroupExpand(group.category)}
                          className="w-full px-4 py-2 text-xs text-gray-400 flex items-center gap-1 active:bg-gray-50 transition-colors"
                        >
                          <ChevronDown size={12} />
                          展开全部（{hiddenCount} 项）
                        </button>
                      )}
                      {!inventoryExpanded && expandedGroups.has(group.category) && group.items.length > 3 && (
                        <button
                          onClick={() => toggleGroupExpand(group.category)}
                          className="w-full px-4 py-2 text-xs text-gray-400 flex items-center gap-1 active:bg-gray-50 transition-colors"
                        >
                          <ChevronUp size={12} />
                          收起
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}

              {/* Card footer */}
              <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100">
                <button
                  onClick={addAllInventory}
                  className="text-xs text-[#FF6B47] font-medium active:scale-95 transition-transform"
                >
                  全部加入
                </button>
                {hasCollapsible && (
                  <button
                    onClick={() => setGlobalExpanded(!inventoryExpanded)}
                    className="flex items-center gap-1 text-xs text-gray-400 active:scale-95 transition-transform"
                  >
                    {inventoryExpanded ? (
                      <><ChevronUp size={13} />收起</>
                    ) : (
                      <><ChevronDown size={13} />展开全部（{inventoryItems.length} 项）</>
                    )}
                  </button>
                )}
              </div>
            </div>
          </section>
        ) : showGuide ? (
          <section>
            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 space-y-3">
              <div>
                <p className="font-semibold text-amber-800">📦 还没建食材库</p>
                <p className="text-sm text-amber-600 mt-1">上传一张订单截图，5 秒搞定</p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => router.push('/inventory/upload')}
                  className="flex-1 py-2 bg-amber-500 text-white text-sm rounded-xl font-medium active:scale-95 transition-transform"
                >
                  上传订单
                </button>
                <button
                  onClick={dismissGuide}
                  className="flex-1 py-2 border border-amber-300 text-amber-700 text-sm rounded-xl active:scale-95 transition-transform"
                >
                  稍后再说
                </button>
              </div>
            </div>
          </section>
        ) : null}

        {/* ── 食材偏好 ───────────────────────────── */}
        <section>
          <p className="text-sm font-semibold text-[#2D2D2D] mb-3">💡 想吃什么风格？</p>
          <div className="flex gap-2">
            {FOOD_PREFERENCE_OPTIONS.map((opt) => {
              const selected = foodPreference === opt.id;
              return (
                <button
                  key={opt.id}
                  onClick={() => setFoodPreference(opt.id)}
                  style={{ transition: 'transform 200ms, background 150ms' }}
                  className={`flex-1 flex flex-col items-center gap-1 py-3 px-2 rounded-2xl border-2 active:scale-95 ${
                    selected
                      ? 'border-[#FF6B47] bg-[#FF6B47] text-white'
                      : 'border-gray-200 bg-white text-gray-600'
                  }`}
                >
                  <span className="text-xl">{opt.emoji}</span>
                  <span className={`text-xs font-semibold ${selected ? 'text-white' : 'text-[#2D2D2D]'}`}>
                    {opt.label}
                  </span>
                  <span className={`text-[10px] text-center leading-tight ${selected ? 'text-white/80' : 'text-gray-400'}`}>
                    {opt.description}
                  </span>
                </button>
              );
            })}
          </div>
        </section>

        {/* ── 疲劳度 ────────────────────────────── */}
        <section>
          <p className="text-sm font-semibold text-[#2D2D2D] mb-3">💪 今天多累？</p>
          <div className="flex flex-col gap-3">
            {FATIGUE_OPTIONS.map(({ level, emoji, label, desc }) => {
              const selected = fatigueLevel === level;
              return (
                <button
                  key={level}
                  onClick={() => setFatigueLevel(level)}
                  className={`flex items-center gap-4 p-4 rounded-2xl border-2 text-left transition-all active:scale-[0.98] ${
                    selected
                      ? 'border-[#FF6B47] bg-[#FFF0EB]'
                      : 'border-gray-200 bg-white'
                  }`}
                >
                  <span className="text-3xl">{emoji}</span>
                  <div>
                    <p className={`font-semibold text-base ${selected ? 'text-[#FF6B47]' : 'text-[#2D2D2D]'}`}>
                      {label}
                    </p>
                    <p className="text-gray-400 text-sm">{desc}</p>
                  </div>
                </button>
              );
            })}
          </div>
        </section>
      </div>

      {/* Fixed bottom CTA */}
      <div className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[480px] px-5 pb-8 pt-3 bg-gradient-to-t from-[#FAF7F2] via-[#FAF7F2]/90 to-transparent">
        <button
          onClick={handleSubmit}
          disabled={!canSubmit}
          className={`w-full py-4 rounded-2xl text-base font-semibold transition-all ${
            canSubmit
              ? 'bg-[#FF6B47] text-white active:scale-[0.98] shadow-lg shadow-[#FF6B47]/30'
              : 'bg-gray-200 text-gray-400 cursor-not-allowed'
          }`}
        >
          {!selectedIngredients.length
            ? '先告诉我有什么食材'
            : !fatigueLevel
            ? '选一下今天多累'
            : '看看做什么 →'}
        </button>
      </div>
    </div>
  );
}

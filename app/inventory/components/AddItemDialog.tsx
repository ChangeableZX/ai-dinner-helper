'use client';

import { useState, useEffect } from 'react';
import { ChevronDown, X } from 'lucide-react';
import type { Category, InventoryItem } from '@/types';
import { autoCategorize } from '@/lib/auto-categorize';

const CATEGORIES: Category[] = ['肉蛋海鲜', '蔬菜', '主食', '其他'];

const CATEGORY_EMOJI: Record<Category, string> = {
  肉蛋海鲜: '🥩',
  蔬菜:     '🥬',
  主食:     '🍚',
  其他:     '🥘',
};

function todayString(): string {
  const d = new Date();
  return [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, '0'),
    String(d.getDate()).padStart(2, '0'),
  ].join('-');
}

function toLocalDateString(isoDate: string): string {
  const d = new Date(isoDate);
  return [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, '0'),
    String(d.getDate()).padStart(2, '0'),
  ].join('-');
}

function dateStringToISO(dateStr: string): string {
  const [y, m, day] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, day, 12, 0, 0).toISOString();
}

interface AddItemDialogProps {
  open: boolean;
  mode: 'add' | 'edit';
  item?: InventoryItem;
  onClose: () => void;
  onSave: (data: Omit<InventoryItem, 'id' | '状态'>) => void;
  onDelete?: (id: string) => void;
}

export default function AddItemDialog({
  open, mode, item, onClose, onSave, onDelete,
}: AddItemDialogProps) {
  const [name, setName] = useState('');
  const [category, setCategory] = useState<Category>('其他');
  // Track if user has manually overridden the auto-category in add mode
  const [categoryOverridden, setCategoryOverridden] = useState(false);
  const [showCategoryPicker, setShowCategoryPicker] = useState(false);
  const [dateStr, setDateStr] = useState(todayString());
  const [note, setNote] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    if (!open) return;
    const initialName = item?.名称 ?? '';
    setName(initialName);
    setCategory(
      mode === 'add'
        ? autoCategorize(initialName)
        : (item?.类别 ?? '其他'),
    );
    setCategoryOverridden(false);
    setShowCategoryPicker(false);
    setDateStr(item ? toLocalDateString(item.入库时间) : todayString());
    setNote(item?.备注 ?? '');
    setConfirmDelete(false);
  }, [open, item, mode]);

  if (!open) return null;

  const today = todayString();
  const nameError = name.length > 20 ? '食材名称不能超过 20 个字' : '';
  const canSave = name.trim().length > 0 && !nameError;

  function handleNameChange(val: string) {
    setName(val);
    // In add mode, auto-follow categorize unless user has manually overridden
    if (mode === 'add' && !categoryOverridden) {
      setCategory(autoCategorize(val));
    }
  }

  function handleCategorySelect(c: Category) {
    setCategory(c);
    setCategoryOverridden(true);
    setShowCategoryPicker(false);
  }

  function handleDateChange(val: string) {
    setDateStr(val > today ? today : val);
  }

  function handleSave() {
    if (!canSave) return;
    onSave({
      名称: name.trim(),
      类别: category,
      入库时间: dateStringToISO(dateStr),
      来源: '手动添加',
      ...(note.trim() ? { 备注: note.trim() } : {}),
    });
  }

  const isAddMode = mode === 'add';
  const categoryLabel = isAddMode
    ? (categoryOverridden ? '分类' : '自动归类')
    : '分类';

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40"
      onClick={onClose}
    >
      <div
        className="w-full max-w-[480px] bg-white rounded-t-3xl px-6 pt-6 pb-10 space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-[#2D2D2D]">
            {isAddMode ? '添加食材' : '编辑食材'}
          </h2>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 text-gray-500 active:scale-95 transition-transform"
          >
            <X size={16} />
          </button>
        </div>

        {/* Name */}
        <div>
          <label className="text-sm font-medium text-gray-600 mb-1.5 block">食材名称</label>
          <input
            type="text"
            value={name}
            onChange={(e) => handleNameChange(e.target.value)}
            placeholder="比如：牛肉、青菜"
            maxLength={21}
            className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-[#FF6B47] transition-colors"
          />
          {nameError && <p className="text-xs text-red-500 mt-1">{nameError}</p>}
        </div>

        {/* Category — auto-detect with inline override */}
        <div>
          <button
            onClick={() => setShowCategoryPicker((v) => !v)}
            className="w-full flex items-center gap-2 px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm transition-colors hover:border-[#FF6B47]/50"
          >
            <span className="text-base">{CATEGORY_EMOJI[category]}</span>
            <span className="text-gray-500 text-xs">{categoryLabel}：</span>
            <span className="font-medium text-[#2D2D2D]">{category}</span>
            <span className="ml-auto flex items-center gap-1 text-xs text-gray-400">
              点击修改
              <ChevronDown
                size={14}
                className={`transition-transform ${showCategoryPicker ? 'rotate-180' : ''}`}
              />
            </span>
          </button>

          {showCategoryPicker && (
            <div className="mt-2 flex flex-wrap gap-2">
              {CATEGORIES.map((c) => (
                <button
                  key={c}
                  onClick={() => handleCategorySelect(c)}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium transition-all active:scale-95 ${
                    category === c
                      ? 'bg-[#FF6B47] text-white shadow-sm'
                      : 'bg-gray-100 text-gray-600 border border-gray-200'
                  }`}
                >
                  {CATEGORY_EMOJI[c]} {c}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Date */}
        <div>
          <label className="text-sm font-medium text-gray-600 mb-1.5 block">入库时间</label>
          <input
            type="date"
            value={dateStr}
            max={today}
            onChange={(e) => handleDateChange(e.target.value)}
            className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-[#FF6B47] transition-colors"
          />
        </div>

        {/* Note */}
        <div>
          <label className="text-sm font-medium text-gray-600 mb-1.5 block">
            备注 <span className="text-gray-400 font-normal">（选填）</span>
          </label>
          <input
            type="text"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="比如：剩一小块"
            className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-[#FF6B47] transition-colors"
          />
        </div>

        {/* Delete confirmation (edit mode only) */}
        {mode === 'edit' && confirmDelete && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm">
            <p className="text-red-700 font-medium mb-3">
              确定删除「{item?.名称}」吗？这个操作无法撤销
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setConfirmDelete(false)}
                className="flex-1 py-2 rounded-xl border border-gray-200 text-gray-600 text-sm font-medium"
              >
                取消
              </button>
              <button
                onClick={() => item && onDelete?.(item.id)}
                className="flex-1 py-2 rounded-xl bg-red-500 text-white text-sm font-semibold active:scale-95 transition-transform"
              >
                确认删除
              </button>
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-3">
          {mode === 'edit' && !confirmDelete && (
            <button
              onClick={() => setConfirmDelete(true)}
              className="px-4 py-3 rounded-xl text-red-500 text-sm font-medium border border-red-200 bg-red-50 active:scale-95 transition-transform"
            >
              删除
            </button>
          )}
          <button
            onClick={onClose}
            className="flex-1 py-3 rounded-xl border border-gray-200 text-gray-600 text-sm font-medium active:scale-95 transition-transform"
          >
            取消
          </button>
          <button
            onClick={handleSave}
            disabled={!canSave}
            className={`flex-1 py-3 rounded-xl text-sm font-semibold transition-all ${
              canSave
                ? 'bg-[#FF6B47] text-white active:scale-[0.98] shadow-sm'
                : 'bg-gray-200 text-gray-400 cursor-not-allowed'
            }`}
          >
            确认
          </button>
        </div>
      </div>
    </div>
  );
}

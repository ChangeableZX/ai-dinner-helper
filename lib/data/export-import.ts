/**
 * 用户数据的导出和导入
 *
 * 用途：让用户在换设备时手动迁移数据
 * 导出：把当前用户的所有数据打包为 JSON 文件下载
 * 导入：上传 JSON 文件，把数据合并到当前匿名 ID 名下（不覆盖，只合并）
 *
 * 设计约束：
 * - 不依赖云端：本地模式也能完整导出/导入
 * - 合并不覆盖：导入不丢失用户当前已有数据
 * - 字段键名差异：localStorage 键与文档示例不同，以代码为准
 *   - user_profile  → 'fanfan_user_profile' (STORAGE_KEYS.USER_PROFILE)
 *   - inventory     → 'inventory_v1' (inventory.ts 直接使用此字符串)
 *   - history       → 'fanfan_history' (STORAGE_KEYS.HISTORY, HistoryRecord[])
 */

import { storageGet, storageSet, STORAGE_KEYS } from '@/lib/storage';
import { getProfile, saveProfile } from './profile';
import { getInventoryItems, syncInventoryToSupabase } from './inventory';
import { getCurrentAnonId } from '@/lib/user-anon-id';
import type { UserProfile, InventoryItem } from '@/types';
import type { HistoryRecord } from '@/types';

export interface ExportedData {
  version: string;
  exported_at: string;
  source_anon_id: string;
  user_profile: UserProfile | null;
  inventory_items: InventoryItem[];
  cooking_history: HistoryRecord[];
}

// ── 导出 ───────────────────────────────────────────────────────────────────

/**
 * 读取当前用户的所有数据并打包为 ExportedData。
 * 内部复用 getProfile() / getInventoryItems() 的 cloud/local 路由，不重复实现。
 */
export async function exportUserData(): Promise<ExportedData> {
  const anonId = getCurrentAnonId();

  const [userProfile, inventoryItems] = await Promise.all([
    getProfile(),
    getInventoryItems(),
  ]);

  const cookingHistory = storageGet<HistoryRecord[]>(STORAGE_KEYS.HISTORY, []);

  return {
    version: '1.0',
    exported_at: new Date().toISOString(),
    source_anon_id: anonId,
    user_profile: userProfile,
    inventory_items: inventoryItems,
    cooking_history: cookingHistory,
  };
}

/** 触发浏览器下载导出的数据为 JSON 文件 */
export function downloadExportedData(data: ExportedData): void {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const dateStr = new Date().toISOString().split('T')[0];
  a.href = url;
  a.download = `fanfan-data-${dateStr}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ── 导入 ───────────────────────────────────────────────────────────────────

export interface ImportResult {
  success: boolean;
  imported: {
    profile: boolean;
    inventory: number;
    history: number;
  };
  errors: string[];
  warnings: string[];
}

/**
 * 解析并导入用户数据文件。
 * 合并策略：
 * - user_profile：用导入的覆盖当前（画像通常希望同步）
 * - inventory_items：按 id 去重合并（导入的补充进来，不重复）
 * - cooking_history：按 id 去重追加（不丢失当前历史）
 * - Supabase：cloud 模式下同步 profile 和 inventory，history 仅写本地
 */
export async function importUserData(file: File): Promise<ImportResult> {
  const result: ImportResult = {
    success: false,
    imported: { profile: false, inventory: 0, history: 0 },
    errors: [],
    warnings: [],
  };

  // ── 1. 解析文件 ──────────────────────────────────────────────────
  let parsed: ExportedData;
  try {
    const text = await file.text();
    parsed = JSON.parse(text) as ExportedData;
  } catch {
    result.errors.push('文件格式错误，无法解析 JSON');
    return result;
  }

  // ── 2. 验证结构 ──────────────────────────────────────────────────
  if (!parsed.version || !parsed.exported_at) {
    result.errors.push('文件不是有效的导出数据（缺少 version 或 exported_at 字段）');
    return result;
  }

  if (parsed.version !== '1.0') {
    result.warnings.push(`数据版本 ${parsed.version} 与当前版本不同，可能存在兼容性问题`);
  }

  // ── 3. 导入用户画像 ──────────────────────────────────────────────
  if (parsed.user_profile && typeof parsed.user_profile === 'object') {
    try {
      // saveProfile 内部处理 localStorage + cloud（如已启用云同步）
      await saveProfile(parsed.user_profile as UserProfile);
      result.imported.profile = true;
    } catch (e) {
      result.errors.push(`画像导入失败：${e instanceof Error ? e.message : String(e)}`);
    }
  }

  // ── 4. 导入食材库（合并去重） ────────────────────────────────────
  if (Array.isArray(parsed.inventory_items) && parsed.inventory_items.length > 0) {
    try {
      const currentRaw = localStorage.getItem('inventory_v1');
      const current: InventoryItem[] = currentRaw ? (JSON.parse(currentRaw) as InventoryItem[]) : [];
      const existingIds = new Set(current.map((i) => i.id));

      const toAdd = (parsed.inventory_items as InventoryItem[]).filter(
        (i) => i.id && !existingIds.has(i.id),
      );

      if (toAdd.length > 0) {
        const merged = [...current, ...toAdd];
        localStorage.setItem('inventory_v1', JSON.stringify(merged));

        // cloud 模式：通过已有同步函数推送到 Supabase
        await syncInventoryToSupabase();

        result.imported.inventory = toAdd.length;
      }
    } catch (e) {
      result.errors.push(`食材库导入失败：${e instanceof Error ? e.message : String(e)}`);
    }
  }

  // ── 5. 导入烹饪历史（追加去重） ──────────────────────────────────
  if (Array.isArray(parsed.cooking_history) && parsed.cooking_history.length > 0) {
    try {
      const current = storageGet<HistoryRecord[]>(STORAGE_KEYS.HISTORY, []);
      const existingIds = new Set(current.map((r) => r.id));

      const toAdd = (parsed.cooking_history as HistoryRecord[]).filter(
        (r) => r.id && !existingIds.has(r.id),
      );

      if (toAdd.length > 0) {
        // 追加到前面，保持时间倒序
        storageSet(STORAGE_KEYS.HISTORY, [...toAdd, ...current]);
        result.imported.history = toAdd.length;
      }
    } catch (e) {
      result.errors.push(`历史记录导入失败：${e instanceof Error ? e.message : String(e)}`);
    }
  }

  result.success = result.errors.length === 0;
  return result;
}

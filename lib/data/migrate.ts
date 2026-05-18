import { isSupabaseEnabled } from '@/lib/supabase/client';
import { storageGet, STORAGE_KEYS } from '@/lib/storage';
import { ensureUserInCloud, setCloudSyncMode } from '@/lib/cloud-sync';
import { syncInventoryToSupabase } from '@/lib/data/inventory';
import { saveProfile } from '@/lib/data/profile';
import type { UserProfile } from '@/types';

export interface MigrateResult {
  success: boolean;
  error?: string;
}

/**
 * 将本地数据全量迁移到 Supabase，并切换到云端模式
 * upsert 保证幂等，重复执行安全
 */
export async function migrateAllDataToCloud(): Promise<MigrateResult> {
  if (!isSupabaseEnabled()) {
    return { success: false, error: 'Supabase 未配置' };
  }

  setCloudSyncMode('migrating');

  try {
    // 1. 确保云端用户存在
    const userId = await ensureUserInCloud();
    if (!userId) {
      setCloudSyncMode('local');
      return { success: false, error: '无法建立云端用户，请检查网络' };
    }

    // 2. 迁移用户画像
    const profile = storageGet<UserProfile | null>(STORAGE_KEYS.USER_PROFILE, null);
    if (profile) {
      await saveProfile(profile);
    }

    // 3. 迁移食材库
    await syncInventoryToSupabase();

    // 4. 切换为云端模式
    setCloudSyncMode('cloud');
    return { success: true };
  } catch (err) {
    setCloudSyncMode('local');
    return {
      success: false,
      error: err instanceof Error ? err.message : '迁移失败，请重试',
    };
  }
}

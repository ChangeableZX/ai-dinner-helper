import { isSupabaseEnabled } from '@/lib/supabase/client';

export type CloudSyncMode = 'cloud' | 'local' | 'migrating';

const CLOUD_SYNC_KEY = 'fanfan_cloud_sync';
const CLOUD_REGISTERED_KEY = 'fanfan_cloud_registered';

export function isNewUser(): boolean {
  if (typeof window === 'undefined') return true;
  const hasInventory = !!localStorage.getItem('inventory_v1');
  const hasProfile = !!localStorage.getItem('fanfan_user_profile');
  return !hasInventory && !hasProfile;
}

export function getCloudSyncMode(): CloudSyncMode {
  if (typeof window === 'undefined') return 'local';
  if (!isSupabaseEnabled()) return 'local';
  const stored = localStorage.getItem(CLOUD_SYNC_KEY);
  if (stored === 'cloud' || stored === 'local' || stored === 'migrating') return stored;
  // First-time determination: new users default to cloud, existing users to local
  const defaultMode = isNewUser() ? 'cloud' : 'local';
  localStorage.setItem(CLOUD_SYNC_KEY, defaultMode);
  return defaultMode;
}

export function setCloudSyncMode(mode: CloudSyncMode): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(CLOUD_SYNC_KEY, mode);
}

export function isUserRegisteredInCloud(): boolean {
  if (typeof window === 'undefined') return false;
  return localStorage.getItem(CLOUD_REGISTERED_KEY) === 'true';
}

export function markUserRegisteredInCloud(): void {
  if (typeof window !== 'undefined') {
    localStorage.setItem(CLOUD_REGISTERED_KEY, 'true');
  }
}

export async function ensureUserInCloud(): Promise<string | null> {
  if (!isSupabaseEnabled()) return null;
  try {
    const { getOrCreateUser } = await import('@/lib/data/user');
    const user = await getOrCreateUser();
    if (user?.id) {
      markUserRegisteredInCloud();
      return user.id;
    }
    return null;
  } catch {
    return null;
  }
}

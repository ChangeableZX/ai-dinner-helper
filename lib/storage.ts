// localStorage wrapper with in-memory fallback
// Edge case: localStorage might be blocked by browser settings or full

const memoryStorage: Record<string, string> = {};

function isLocalStorageAvailable(): boolean {
  try {
    const key = '__fanfan_test__';
    localStorage.setItem(key, '1');
    localStorage.removeItem(key);
    return true;
  } catch {
    return false;
  }
}

export function storageGet<T>(key: string, defaultValue: T): T {
  try {
    const raw = isLocalStorageAvailable()
      ? localStorage.getItem(key)
      : memoryStorage[key] ?? null;
    if (raw === null || raw === undefined) return defaultValue;
    return JSON.parse(raw) as T;
  } catch {
    return defaultValue;
  }
}

export function storageSet<T>(key: string, value: T): void {
  try {
    const serialized = JSON.stringify(value);
    if (isLocalStorageAvailable()) {
      localStorage.setItem(key, serialized);
    } else {
      memoryStorage[key] = serialized;
    }
  } catch {
    // Storage quota exceeded — fall back to memory
    memoryStorage[key] = JSON.stringify(value);
  }
}

export function storageRemove(key: string): void {
  try {
    if (isLocalStorageAvailable()) {
      localStorage.removeItem(key);
    }
    delete memoryStorage[key];
  } catch {
    delete memoryStorage[key];
  }
}

export function storageClear(): void {
  try {
    if (isLocalStorageAvailable()) {
      // Only clear fanfan keys to avoid wiping other site data
      Object.keys(localStorage)
        .filter((k) => k.startsWith('fanfan_'))
        .forEach((k) => localStorage.removeItem(k));
    }
    Object.keys(memoryStorage).forEach((k) => delete memoryStorage[k]);
  } catch {
    Object.keys(memoryStorage).forEach((k) => delete memoryStorage[k]);
  }
}

export const STORAGE_KEYS = {
  USER_PROFILE: 'fanfan_user_profile',
  HISTORY: 'fanfan_history',
  RECENT_INGREDIENTS: 'fanfan_recent_ingredients',
} as const;

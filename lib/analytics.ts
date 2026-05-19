/**
 * 统一埋点系统
 *
 * - fire-and-forget: 不阻塞主流程
 * - 失败兜底: 云端写入失败 → buffer 到 localStorage
 * - 批量优化: 10 条或 5 秒后批量上报
 */

import { supabase, isSupabaseEnabled } from '@/lib/supabase/client';
import { ensureUserInCloud, getCloudSyncMode } from '@/lib/cloud-sync';

const EVENT_BUFFER_KEY = 'pending_events_v1';
const BATCH_SIZE = 10;
const FLUSH_INTERVAL_MS = 5000;

interface PendingEvent {
  event_name: string;
  properties: Record<string, unknown>;
  client_timestamp: string;
}

let buffer: PendingEvent[] = [];
let flushTimer: ReturnType<typeof setTimeout> | null = null;

export function track(eventName: string, properties: Record<string, unknown> = {}): void {
  if (typeof window === 'undefined') return;

  const event: PendingEvent = {
    event_name: eventName,
    properties: {
      ...properties,
      page_path: window.location.pathname,
      user_agent: navigator.userAgent.substring(0, 200),
    },
    client_timestamp: new Date().toISOString(),
  };

  // 先把本地 pending 合并进来（仅首次调用时有值）
  loadPendingFromStorage();
  buffer.push(event);

  if (buffer.length >= BATCH_SIZE) {
    flush();
  } else {
    scheduleFlush();
  }
}

function scheduleFlush() {
  if (flushTimer) return;
  flushTimer = setTimeout(() => {
    flushTimer = null;
    flush();
  }, FLUSH_INTERVAL_MS);
}

async function flush() {
  if (buffer.length === 0) return;

  const toUpload = [...buffer];
  buffer = [];

  const mode = getCloudSyncMode();
  if (mode !== 'cloud' || !isSupabaseEnabled()) {
    saveToPendingStorage(toUpload);
    return;
  }

  try {
    const userId = await ensureUserInCloud();
    if (!userId) {
      saveToPendingStorage(toUpload);
      return;
    }

    const rows = toUpload.map((e) => ({
      user_id: userId,
      event_name: e.event_name,
      properties: e.properties,
    }));

    const { error } = await supabase!.from('events').insert(rows);

    if (error) {
      console.warn('[Analytics] Batch insert failed, saving to buffer:', error);
      saveToPendingStorage(toUpload);
    } else {
      clearPendingStorage();
    }
  } catch (e) {
    console.warn('[Analytics] Flush error:', e);
    saveToPendingStorage(toUpload);
  }
}

function loadPendingFromStorage() {
  try {
    const raw = localStorage.getItem(EVENT_BUFFER_KEY);
    if (raw) {
      const pending = JSON.parse(raw) as PendingEvent[];
      buffer = [...pending, ...buffer];
      localStorage.removeItem(EVENT_BUFFER_KEY);
    }
  } catch {
    // 忽略
  }
}

function saveToPendingStorage(events: PendingEvent[]) {
  try {
    const existing = JSON.parse(localStorage.getItem(EVENT_BUFFER_KEY) || '[]') as PendingEvent[];
    const trimmed = [...existing, ...events].slice(-200);
    localStorage.setItem(EVENT_BUFFER_KEY, JSON.stringify(trimmed));
  } catch {
    // localStorage 满了，丢弃
  }
}

function clearPendingStorage() {
  try {
    localStorage.removeItem(EVENT_BUFFER_KEY);
  } catch {
    // 忽略
  }
}

if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', () => {
    if (buffer.length > 0) {
      saveToPendingStorage(buffer);
      buffer = [];
    }
  });
}

/**
 * 更新用户活跃时间（轻量，不计入 events 表）
 */
export async function updateUserActivity(): Promise<void> {
  if (getCloudSyncMode() !== 'cloud' || !isSupabaseEnabled()) return;

  try {
    const userId = await ensureUserInCloud();
    if (!userId) return;

    await supabase!
      .from('users')
      .update({ last_active_at: new Date().toISOString() })
      .eq('id', userId);
  } catch {
    // 不阻塞
  }
}

import { supabase, isSupabaseEnabled } from '@/lib/supabase/client';
import { getCurrentAnonId } from '@/lib/user-anon-id';
import type { DbUser } from './types';

// 模块级缓存：同一页面会话内避免重复查库
let cachedUserId: string | null = null;

export async function getOrCreateUser(): Promise<DbUser | null> {
  if (!isSupabaseEnabled()) return null;

  const anonId = getCurrentAnonId();
  if (anonId === 'ssr_placeholder') return null;

  try {
    // 尝试查找已有用户
    const { data: existing, error } = await supabase!
      .from('users')
      .select('*')
      .eq('anon_id', anonId)
      .maybeSingle();

    if (existing && !error) {
      // 异步更新活跃时间，不阻塞主流程
      supabase!
        .from('users')
        .update({ last_active_at: new Date().toISOString() })
        .eq('id', existing.id)
        .then(() => {});
      cachedUserId = existing.id;
      return existing as DbUser;
    }

    // 创建新用户（UNIQUE 约束保证并发安全）
    const { data: created, error: createError } = await supabase!
      .from('users')
      .insert({ anon_id: anonId })
      .select()
      .single();

    if (createError || !created) {
      console.error('[data/user] Failed to create user:', createError);
      return null;
    }

    cachedUserId = (created as DbUser).id;
    return created as DbUser;
  } catch (err) {
    console.error('[data/user] Unexpected error:', err);
    return null;
  }
}

export async function getUserId(): Promise<string | null> {
  if (cachedUserId) return cachedUserId;
  const user = await getOrCreateUser();
  return user?.id ?? null;
}

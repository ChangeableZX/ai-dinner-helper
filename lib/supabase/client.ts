/**
 * Supabase 客户端单例
 *
 * 设计原则:
 * - 前端用 anon key，受 RLS 保护
 * - Service role key 绝不在前端代码使用
 * - 客户端单例避免多次实例化
 * - 环境变量未配置时 supabase 为 null，自动降级到 localStorage 模式
 */

import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
// 支持旧版 anon key（eyJ... JWT）和新版 publishable key（sb_publishable_...）
const supabaseAnonKey =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('[supabase] 环境变量未配置，将使用 localStorage 模式');
}

export const supabase: SupabaseClient | null =
  supabaseUrl && supabaseAnonKey
    ? createClient(supabaseUrl, supabaseAnonKey)
    : null;

export function isSupabaseEnabled(): boolean {
  return supabase !== null;
}

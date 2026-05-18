/**
 * 匿名用户 ID 管理
 *
 * 设计:
 * - 每个浏览器首次访问时生成一个 UUID 作为匿名身份
 * - 存到 localStorage 持久化（同一浏览器永久身份）
 * - 用户不需要主动注册或登录
 * - 清浏览器缓存会失去身份，这是可接受的代价
 */

const ANON_ID_KEY = 'fanfan_anon_id';

export function getCurrentAnonId(): string {
  if (typeof window === 'undefined') {
    return 'ssr_placeholder'; // SSR 时返回占位符，调用方需检查此值
  }

  let anonId = localStorage.getItem(ANON_ID_KEY);

  if (!anonId) {
    anonId = crypto.randomUUID();
    localStorage.setItem(ANON_ID_KEY, anonId);
  }

  return anonId;
}

export function resetAnonId(): string {
  if (typeof window === 'undefined') return '';
  localStorage.removeItem(ANON_ID_KEY);
  return getCurrentAnonId();
}

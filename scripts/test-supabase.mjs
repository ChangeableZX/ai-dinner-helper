/**
 * Supabase 连接验证脚本
 * 运行方式: node --env-file=.env.local scripts/test-supabase.mjs
 */

import { createClient } from '@supabase/supabase-js';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

console.log('');
console.log('=== Supabase 连接验证 ===');
console.log(`URL:    ${url ? url : '❌ 未设置'}`);
console.log(`Key:    ${key ? key.slice(0, 20) + '...' : '❌ 未设置'}`);
console.log('');

if (!url || !key) {
  console.error('❌ 环境变量缺失，请检查 .env.local');
  process.exit(1);
}

const sb = createClient(url, key);

// 测试 1: 查询 users 表
process.stdout.write('测试 1 · 查询 users 表... ');
const { data: users, error: e1 } = await sb.from('users').select('*').limit(1);
if (e1) {
  console.log(`❌ 失败: ${e1.message}`);
} else {
  console.log(`✅ 成功（当前行数: ${users.length}）`);
}

// 测试 2: 写入再删除（验证 RLS 允许写入）
process.stdout.write('测试 2 · 写入 users 表... ');
const testAnonId = `test_${Date.now()}`;
const { data: inserted, error: e2 } = await sb
  .from('users')
  .insert({ anon_id: testAnonId })
  .select('id')
  .single();

if (e2) {
  console.log(`❌ 失败: ${e2.message}`);
} else {
  console.log(`✅ 成功（id: ${inserted.id}）`);

  // 清理测试数据
  process.stdout.write('测试 3 · 清理测试数据... ');
  const { error: e3 } = await sb.from('users').delete().eq('id', inserted.id);
  if (e3) {
    console.log(`⚠️  清理失败（不影响功能）: ${e3.message}`);
  } else {
    console.log('✅ 成功');
  }
}

// 测试 4: 验证所有表存在
process.stdout.write('测试 4 · 验证 6 张表可访问... ');
const tables = ['users', 'user_profiles', 'inventory_items', 'recipe_sessions', 'cooking_feedback', 'events'];
const results = await Promise.all(
  tables.map((t) => sb.from(t).select('*').limit(0))
);
const failed = tables.filter((_, i) => results[i].error);
if (failed.length > 0) {
  console.log(`❌ 以下表不可访问: ${failed.join(', ')}`);
  failed.forEach((t, i) => {
    const idx = tables.indexOf(t);
    console.log(`   ${t}: ${results[idx].error?.message}`);
  });
} else {
  console.log(`✅ 全部可访问 (${tables.join(', ')})`);
}

console.log('');
console.log('=== 验证完成 ===');

/**
 * 自动分类单元测试
 * 运行方式：npx tsx lib/auto-categorize.test.ts
 * （需要先安装：npm install -D tsx）
 */
import { autoCategorize } from './auto-categorize';

const testCases = [
  // 肉蛋海鲜
  { input: '牛肉',     expected: '肉蛋海鲜' },
  { input: '牛里脊',   expected: '肉蛋海鲜' },
  { input: '鸡蛋',     expected: '肉蛋海鲜' },
  { input: '鸡腿肉',   expected: '肉蛋海鲜' },
  { input: '三文鱼',   expected: '肉蛋海鲜' },
  { input: '基围虾',   expected: '肉蛋海鲜' },
  { input: '腊肠',     expected: '肉蛋海鲜' },

  // 蔬菜（含豆制品）
  { input: '豆腐',     expected: '蔬菜' },   // 关键：不再归入肉蛋海鲜
  { input: '嫩豆腐',   expected: '蔬菜' },
  { input: '腐竹',     expected: '蔬菜' },
  { input: '上海青',   expected: '蔬菜' },
  { input: '平菇',     expected: '蔬菜' },
  { input: '西红柿',   expected: '蔬菜' },
  { input: '土豆',     expected: '蔬菜' },
  { input: '黄瓜',     expected: '蔬菜' },
  { input: '胡萝卜',   expected: '蔬菜' },
  { input: '苹果',     expected: '蔬菜' },

  // 主食
  { input: '大米',     expected: '主食' },
  { input: '面条',     expected: '主食' },
  { input: '馒头',     expected: '主食' },

  // 调料
  { input: '生抽',     expected: '调料' },
  { input: '花椒',     expected: '调料' },

  // 兜底
  { input: '佛手瓜',   expected: '蔬菜' },   // 带"瓜"的兜底
  { input: '随便瞎写', expected: '其他' },
];

let passed = 0;
let failed = 0;

console.log('=== auto-categorize 单元测试 ===\n');

for (const { input, expected } of testCases) {
  const result = autoCategorize(input);
  const ok = result === expected;
  if (ok) {
    console.log(`  ✅  "${input}" → "${result}"`);
    passed++;
  } else {
    console.error(`  ❌  "${input}" → 期望 "${expected}"，实际 "${result}"`);
    failed++;
  }
}

console.log(`\n结果：${passed}/${passed + failed} 通过`);
if (failed > 0) {
  console.error(`${failed} 个用例失败`);
  process.exit(1);
}

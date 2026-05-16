import type { Recipe } from '@/types';

export const MOCK_RECIPES: Recipe[] = [
  {
    id: 'mock_tomato_egg',
    name: '西红柿炒鸡蛋',
    reason: '经典家常，10分钟轻松搞定',
    durationMinutes: 10,
    difficulty: '极简',
    hasSmoke: true,
    utensils: ['炒锅', '燃气灶'],
    ingredients: [
      { name: '鸡蛋', amount: '2个', source: '今日食材' },
      { name: '番茄', amount: '1个', source: '今日食材' },
      { name: '盐', amount: '适量', source: '调料库' },
      { name: '糖', amount: '少许', source: '调料库' },
      { name: '生抽', amount: '少许', source: '调料库' },
    ],
    prepSteps: [
      { action: '鸡蛋打散，加少许盐搅匀', durationSeconds: 30 },
      { action: '番茄切块备用', durationSeconds: 60 },
    ],
    cookingSteps: [
      {
        order: 1,
        action: '热锅冷油，油热后倒入蛋液翻炒至凝固',
        durationSeconds: 90,
        keyTip: '油要充分热透，蛋才能炒得嫩滑',
      },
      {
        order: 2,
        action: '盛出鸡蛋，原锅加少量油，放番茄大火翻炒出汁',
        durationSeconds: 120,
        keyTip: '大火逼出番茄汁水，口感更好',
      },
      {
        order: 3,
        action: '倒回鸡蛋，加盐、少许糖、生抽翻炒均匀',
        durationSeconds: 60,
        keyTip: '糖是去酸的关键，不要省略',
      },
      {
        order: 4,
        action: '出锅装盘',
        durationSeconds: 10,
      },
    ],
    usedCoreIngredients: ['鸡蛋'],
    ingredientUsageRate: 1.0,
  },
  {
    id: 'mock_greens_egg',
    name: '青菜炒鸡蛋',
    reason: '清淡营养，8分钟完成',
    durationMinutes: 8,
    difficulty: '极简',
    hasSmoke: true,
    utensils: ['炒锅', '燃气灶'],
    ingredients: [
      { name: '鸡蛋', amount: '2个', source: '今日食材' },
      { name: '青菜', amount: '一把', source: '今日食材' },
      { name: '盐', amount: '适量', source: '调料库' },
      { name: '蒜', amount: '2瓣', source: '调料库' },
    ],
    prepSteps: [
      { action: '鸡蛋打散备用', durationSeconds: 20 },
      { action: '青菜洗净切段，蒜切末', durationSeconds: 60 },
    ],
    cookingSteps: [
      {
        order: 1,
        action: '热锅热油，炒蛋液至半熟盛出',
        durationSeconds: 60,
        keyTip: '半熟即可，后面还要回锅',
      },
      {
        order: 2,
        action: '锅内加油，爆香蒜末30秒',
        durationSeconds: 30,
        keyTip: '蒜末变微黄立刻放菜，别炒焦',
      },
      {
        order: 3,
        action: '放青菜大火翻炒1分钟',
        durationSeconds: 60,
        parallelTask: '同时把放蛋的盘子准备好',
      },
      {
        order: 4,
        action: '倒回鸡蛋，加盐翻炒均匀出锅',
        durationSeconds: 30,
      },
    ],
    usedCoreIngredients: ['鸡蛋'],
    ingredientUsageRate: 1.0,
  },
  {
    id: 'mock_tomato_egg_noodle',
    name: '番茄鸡蛋面',
    reason: '一碗解决，暖胃又省心',
    durationMinutes: 15,
    difficulty: '简单',
    hasSmoke: false,
    utensils: ['锅', '燃气灶'],
    ingredients: [
      { name: '鸡蛋', amount: '2个', source: '今日食材' },
      { name: '番茄', amount: '1个', source: '今日食材' },
      { name: '面条', amount: '100g', source: '今日食材' },
      { name: '盐', amount: '适量', source: '调料库' },
      { name: '生抽', amount: '少许', source: '调料库' },
      { name: '香油', amount: '几滴', source: '调料库' },
    ],
    prepSteps: [
      { action: '番茄切块', durationSeconds: 60 },
      { action: '鸡蛋打散', durationSeconds: 20 },
    ],
    cookingSteps: [
      {
        order: 1,
        action: '锅内烧水至沸腾',
        durationSeconds: 180,
        keyTip: '等水完全沸腾再下面，口感更好',
        parallelTask: '烧水同时开始准备番茄蛋卤',
      },
      {
        order: 2,
        action: '另起小锅，热油炒蛋至半熟，加番茄翻炒出汁',
        durationSeconds: 120,
      },
      {
        order: 3,
        action: '加水200ml，煮开后加盐、生抽调味，保持小火',
        durationSeconds: 90,
        keyTip: '卤汁浓淡可加水调节',
      },
      {
        order: 4,
        action: '大锅下面条，按包装时间煮熟后捞出',
        durationSeconds: 360,
        keyTip: '面条煮至无白心即可',
      },
      {
        order: 5,
        action: '面条放碗，浇上番茄蛋卤，滴香油',
        durationSeconds: 20,
        keyTip: '香油最后放，保持香气',
      },
    ],
    usedCoreIngredients: ['鸡蛋'],
    ingredientUsageRate: 1.0,
  },
];

// Dev-only: used when MOCK_FORCE_P0_FAIL=1 to test the P0 warning UI
export const MOCK_RECIPES_P0_FAIL: Recipe[] = [
  {
    id: 'mock_p0fail_potato',
    name: '土豆泥',
    reason: '简单省事，10分钟搞定',
    durationMinutes: 10,
    difficulty: '极简',
    hasSmoke: false,
    utensils: ['锅', '燃气灶'],
    ingredients: [
      { name: '土豆', amount: '2个', source: '今日食材' },
      { name: '盐', amount: '适量', source: '调料库' },
      { name: '黄油', amount: '少许', source: '调料库' },
    ],
    prepSteps: [{ action: '土豆削皮切块', durationSeconds: 60 }],
    cookingSteps: [
      { order: 1, action: '土豆块放锅中，加水没过，煮15分钟至熟透', durationSeconds: 900 },
      { order: 2, action: '沥干水，加盐和黄油，用叉子压成泥', durationSeconds: 60 },
    ],
    usedCoreIngredients: [],
    ingredientUsageRate: 0.33,
  },
  {
    id: 'mock_p0fail_stir_veg',
    name: '素炒时蔬',
    reason: '清淡健康，8分钟完成',
    durationMinutes: 8,
    difficulty: '极简',
    hasSmoke: true,
    utensils: ['炒锅', '燃气灶'],
    ingredients: [
      { name: '土豆', amount: '1个', source: '今日食材' },
      { name: '盐', amount: '适量', source: '调料库' },
      { name: '生抽', amount: '少许', source: '调料库' },
    ],
    prepSteps: [{ action: '土豆切丝', durationSeconds: 60 }],
    cookingSteps: [
      { order: 1, action: '热锅热油，放土豆丝大火翻炒', durationSeconds: 120 },
      { order: 2, action: '加盐、生抽调味，翻炒均匀出锅', durationSeconds: 30 },
    ],
    usedCoreIngredients: [],
    ingredientUsageRate: 0.33,
  },
];

export const MOCK_P0_WARNING = '检测到今日有牛肉等核心食材，但推荐方案均未能用上，建议直接煎/炒牛肉，或告诉我换个方向 😊';

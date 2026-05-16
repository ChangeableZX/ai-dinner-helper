const EMOJI_MAP: Record<string, string> = {
  牛肉: '🥩', 猪肉: '🥓', 羊肉: '🍖', 鸡肉: '🍗',
  鱼: '🐟', 虾: '🦐', 蟹: '🦀',
  鸡蛋: '🥚', 豆腐: '🟫',
  青菜: '🥬', 白菜: '🥬', 菠菜: '🥬', 生菜: '🥬',
  番茄: '🍅', 西红柿: '🍅',
  土豆: '🥔', 胡萝卜: '🥕', 萝卜: '🥕',
  黄瓜: '🥒', 茄子: '🍆', 辣椒: '🌶️',
  平菇: '🍄', 香菇: '🍄', 金针菇: '🍄',
  玉米: '🌽', 洋葱: '🧅', 蒜: '🧄',
  米: '🍚', 面: '🍜',
};

export function getIngredientEmoji(name: string): string {
  for (const [key, emoji] of Object.entries(EMOJI_MAP)) {
    if (name.includes(key)) return emoji;
  }
  return '🥘';
}

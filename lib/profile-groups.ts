// Seasoning grouping for profile page display
// Users: profile/page.tsx (seasoning + equipment grouped rendering)
// Rule: preset items use this map; user-added custom items always go to '其他'

export interface ProfileGroup {
  name: string;
  emoji: string;
  items: string[];
}

export const SEASONING_GROUP_DEFS: ProfileGroup[] = [
  {
    name: '基础咸鲜',
    emoji: '🧂',
    items: ['盐', '生抽', '老抽', '醋', '料酒', '糖', '蚝油', '香油', '鸡精', '味精'],
  },
  {
    name: '辣味',
    emoji: '🌶️',
    items: ['干辣椒', '辣椒粉', '孜然粉', '花椒', '白胡椒', '黑胡椒'],
  },
  {
    name: '香料',
    emoji: '🌿',
    items: ['八角', '桂皮', '香叶', '十三香', '五香粉'],
  },
  {
    name: '酱料',
    emoji: '🥫',
    items: ['豆瓣酱', '老干妈', '番茄酱', '芝麻酱', '甜面酱'],
  },
  {
    name: '其他',
    emoji: '🥢',
    items: ['淀粉', '面粉', '葱', '姜', '蒜'],
  },
];

// SEASONING_GROUPS: Record<name, groupName> — used to look up a preset seasoning's group
export const SEASONING_GROUPS: Record<string, string> = Object.fromEntries(
  SEASONING_GROUP_DEFS.flatMap(({ name, items }) => items.map((item) => [item, name]))
);

// Equipment groups (高压锅 → 加热设备, as specified)
export const EQUIPMENT_GROUP_DEFS: ProfileGroup[] = [
  {
    name: '加热设备',
    emoji: '🔥',
    items: ['燃气灶', '电磁炉', '微波炉', '烤箱', '电饭煲', '空气炸锅', '高压锅'],
  },
  {
    name: '锅具与小家电',
    emoji: '🥘',
    items: ['炒锅', '平底锅', '蒸锅', '料理机'],
  },
];

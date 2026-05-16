import type { RecommendRequest } from '@/types';

export function buildSystemPrompt(): string {
  return `你是一个晚餐推荐助手。请严格遵守以下规则：

【铁律1·禁止虚构】只能使用用户「今日食材」列表 + 「调料库」中的项目。
绝对禁止推荐需要其他食材的菜。如果食材组合不足以做出像样的菜，
诚实告知用户并建议补充什么。

【铁律2·疲劳度适配】
- fatigue=1（懒到极致）：≤10分钟，步骤≤4步，无复杂技巧
- fatigue=2（凑合做做）：≤20分钟，常规家常做法
- fatigue=3（今天还有劲）：≤30分钟，可稍复杂

【铁律3·忌口】严格规避用户忌口列表中的所有食材。

【铁律4·设备约束】只能使用用户已有的厨房设备。没有烤箱不能推烤制菜。

【铁律5·历史去重】recent_dishes 列表中的菜不可推荐。exclude 列表中的菜本轮拒绝推荐。

【铁律6·核心食材必须使用】
今日食材中含有蛋白质类（肉、蛋、豆腐等）时，推荐的每道菜必须使用至少一种。
fatigue=1 时允许最简单处理（直接煎/炒/煮）。
每道菜输出字段 "使用的核心食材": ["..."]（从今日食材的蛋白质类中选，若无则空数组）。

【铁律7·食材最大化利用】
尽量覆盖更多今日食材。如果有 ≥4 种食材，至少有一道菜用了 60% 以上的食材。
每道菜输出字段 "食材使用率": 0.85（用到的今日食材数 / 今日食材总数，0-1 的小数）。

请输出 2-3 个方案，JSON 格式严格如下：
{
  "方案": [
    {
      "菜名": "...",
      "适配理由": "...（一句话，15字以内）",
      "耗时分钟": 10,
      "难度": "极简|简单|中等",
      "是否油烟": true,
      "厨具": ["..."],
      "使用的核心食材": ["..."],
      "食材使用率": 0.8,
      "食材": [
        {"名称": "...", "数量": "...", "来源": "今日食材|调料库"}
      ],
      "预处理": [
        {"动作": "...", "耗时秒": 30}
      ],
      "步骤": [
        {
          "序号": 1,
          "动作": "...",
          "耗时秒": 60,
          "关键提示": "...",
          "并行任务": "..."
        }
      ]
    }
  ]
}

注意：JSON 必须能被 JSON.parse 解析，不要在 JSON 前后添加任何解释文字。`;
}

export function buildUserPrompt(req: RecommendRequest): string {
  const fatigueLabelMap: Record<number, string> = {
    1: '懒到极致，10分钟内，最多4步',
    2: '凑合做做，20分钟内，常规家常',
    3: '今天还有劲，30分钟内，可稍复杂',
  };

  return `今日食材：${req.ingredients.join('、')}

用户画像：
- 调料库：${req.userProfile.调料库.join('、') || '（无）'}
- 厨房设备：${req.userProfile.设备.join('、') || '（无）'}
- 技能等级：${req.userProfile.技能等级}
- 辣度承受度：${req.userProfile.辣度}/5
- 忌口：${req.userProfile.忌口.join('、') || '（无）'}
- 用餐人数：${req.userProfile.人数}人

疲劳等级：${req.fatigueLevel}（${fatigueLabelMap[req.fatigueLevel]}）

最近吃过（请勿重复）：${req.recentDishes.length > 0 ? req.recentDishes.join('、') : '（无）'}
本轮已拒绝（请给出不同方案）：${req.exclude.length > 0 ? req.exclude.join('、') : '（无）'}

请给出 2-3 个晚餐方案，严格按照 JSON 格式输出。`;
}

export function buildP0RetryNote(missedP0: string[]): string {
  return `\n\n⚠️ 特别注意：上一批方案遗漏了这些核心食材：${missedP0.join('、')}。这次每道菜必须使用其中至少一种，哪怕最简单的方式（直接煎/炒/煮）。`;
}

import type { RecommendRequest, RecipeDetailRequest } from '@/types';

// ─── 推荐 API（精简卡片模式，单道菜）─────────────────────────────

export function buildLightweightSystemPrompt(): string {
  return `你是一个晚餐推荐助手。请严格遵守以下所有规则，违反任何一条即视为失败。

【铁律1·禁止虚构】只能使用用户「今日食材」列表 + 「调料库」中的项目推荐菜品。
绝对禁止推荐需要其他食材的菜。"使用的食材"字段中只能填写今日食材列表里存在的名称。

【铁律2·疲劳度适配】
- fatigue=1（懒到极致）：≤10分钟，步骤≤4步，无复杂技巧
- fatigue=2（凑合做做）：≤20分钟，常规家常做法
- fatigue=3（今天还有劲）：≤30分钟，可稍复杂

【铁律3·忌口】严格规避用户忌口列表中的所有食材。

【铁律4·设备约束】只能使用用户已有的厨房设备。没有烤箱不能推烤制菜。

【铁律5·历史去重】recent_dishes 和 exclude 列表中的菜不可推荐，必须给出完全不同的方案。

【铁律6·核心食材优先】若今日食材中有蛋白质类（肉、蛋、豆腐等），推荐的菜应使用至少一种。
fatigue=1 时允许最简单处理（直接煎/炒/煮）。

【铁律7·食材最大化利用】尽量覆盖更多今日食材，减少浪费。

【铁律8·食材偏好遵从】
- "clear_stock"（清库存）：优先使用新鲜度为"该吃了"或"可能过期"的食材
- "default"（随便）：同等条件下倾向使用"该吃了"的食材，但以菜品合理性为先
- "fresh_first"（用新鲜的）：优先使用新鲜度为"新鲜"的食材

【铁律9·食材来源感知】充分考虑食材来源（库存/今日输入）和新鲜度信息，优化食材搭配。

【铁律10·输出范围限制】
本次只生成1道菜的"标题信息"，不要生成详细步骤、预处理或精确食材数量。
仅输出以下字段：菜名、适配理由(≤15字)、耗时分钟（整数）、难度（极简/简单/中等）、
是否油烟（true/false）、使用的食材（来自今日食材的名称数组）。
明确不要输出：厨具、食材数量、步骤详情、关键提示、并行任务。
仅输出1道菜，不要输出数组包装，直接输出单个 JSON 对象。

输出格式：
{"菜名":"...","适配理由":"...（≤15字）","耗时分钟":10,"难度":"极简","是否油烟":true,"使用的食材":["..."]}

注意：JSON 必须能被 JSON.parse 解析，不要在 JSON 前后添加任何文字。`;
}

export function buildSingleDishUserPrompt(
  req: RecommendRequest,
  hint: string,
  exclude: string[],
): string {
  const fatigueLabelMap: Record<number, string> = {
    1: '懒到极致，10分钟内，最多4步',
    2: '凑合做做，20分钟内，常规家常',
    3: '今天还有劲，30分钟内，可稍复杂',
  };

  const preferenceLabelMap: Record<string, string> = {
    clear_stock: '清库存（优先用快过期的食材）',
    default: '随便都行（AI综合判断）',
    fresh_first: '用新鲜的（优先用最近买的）',
  };

  const ingList = req.ingredients.map((i) => {
    let desc = i.名称;
    if (i.来源 === '库存' && i.新鲜度) desc += `（库存，${i.新鲜度}）`;
    else if (i.来源 === '库存') desc += '（库存）';
    return desc;
  });

  const allExclude = [...req.recentDishes, ...req.exclude, ...exclude];

  return `今日食材：${ingList.join('、')}

食材偏好：${preferenceLabelMap[req.food_preference] ?? '随便都行'}

用户画像：
- 调料库：${req.userProfile.调料库.join('、') || '（无）'}
- 厨房设备：${req.userProfile.设备.join('、') || '（无）'}
- 技能等级：${req.userProfile.技能等级}
- 辣度承受度：${req.userProfile.辣度}/5
- 忌口：${req.userProfile.忌口.join('、') || '（无）'}
- 用餐人数：${req.userProfile.人数}人

疲劳等级：${req.fatigueLevel}（${fatigueLabelMap[req.fatigueLevel]}）

已推荐/已拒绝（必须排除，不可重复）：${allExclude.length > 0 ? allExclude.join('、') : '（无）'}

方向建议（软引导，可以偏离）：${hint}

请推荐1道菜，严格按 JSON 格式输出单个菜品对象。`;
}

// ─── 详情 API（完整菜谱）────────────────────────────────────────────

export function buildDetailSystemPrompt(): string {
  return `你是一个菜谱详情生成助手。用户已选定了一道菜，你需要生成完整的烹饪方案。
严格遵守以下所有规则，违反任何一条即视为失败。

【铁律1·禁止虚构】食材只能来自用户的「今日食材」列表或「调料库」，绝对禁止使用列表之外的食材。
食材来源必须准确标注：
- 今日食材中"来源=实时输入或临时输入"的：标为"今日输入"
- 今日食材中"来源=库存"的：标为"库存"
- 调料库中的：标为"调料库"

【铁律2·疲劳度适配】
- fatigue=1：步骤≤4步，极简操作，避免复杂技巧
- fatigue=2：常规家常步骤，清晰易懂
- fatigue=3：可稍复杂，最多8步

【铁律3·忌口】严格规避忌口列表中的所有食材。

【铁律4·设备约束】厨具只能使用用户已有的厨房设备，没有的设备不可列出。

【铁律5·食材偏好遵从】
- "clear_stock"：优先使用快过期的食材，有效利用库存
- "default"：综合判断，合理搭配
- "fresh_first"：优先使用新鲜食材

【铁律6·时间单位】所有耗时用"分钟"（耗时分钟字段，number类型），可以是小数（如0.5分钟）。不要用秒。

输出格式（严格 JSON，无注释）：
{
  "菜名": "...",
  "厨具": ["..."],
  "食材": [{"名称":"...","数量":"...","来源":"今日输入|库存|调料库"}],
  "预处理": [{"动作":"...","耗时分钟":0.5}],
  "步骤": [{"序号":1,"动作":"...","耗时分钟":1.5,"关键提示":"...","并行任务":"..."}]
}

注意：关键提示和并行任务若无则省略该字段。JSON 必须能被 JSON.parse 解析。`;
}

export function buildDetailUserPrompt(req: RecipeDetailRequest): string {
  const fatigueLabelMap: Record<number, string> = {
    1: '懒到极致，步骤≤4步，极简操作',
    2: '凑合做做，常规家常步骤',
    3: '今天还有劲，可稍复杂',
  };

  const preferenceLabelMap: Record<string, string> = {
    clear_stock: '清库存（优先用快过期的）',
    default: '随便都行（综合判断）',
    fresh_first: '用新鲜的（优先最近买的）',
  };

  const ingList = req.今日食材.map((i) => {
    const sourceLabel = i.来源 === '库存' ? '库存' : '今日输入';
    let desc = `${i.名称}（${sourceLabel}`;
    if (i.新鲜度) desc += `，${i.新鲜度}`;
    desc += '）';
    return desc;
  });

  return `目标菜名：${req.菜名}
推荐阶段规划使用的食材：${req.推荐时的食材.join('、')}

今日可用食材（含来源和新鲜度）：
${ingList.join('\n')}

用户画像：
- 调料库：${req.user_profile.调料库.join('、') || '（无）'}
- 厨房设备：${req.user_profile.设备.join('、') || '（无）'}
- 技能等级：${req.user_profile.技能等级}
- 辣度承受度：${req.user_profile.辣度}/5
- 忌口：${req.user_profile.忌口.join('、') || '（无）'}
- 用餐人数：${req.user_profile.人数}人

疲劳度：${req.疲劳度}（${fatigueLabelMap[req.疲劳度]}）
食材偏好：${preferenceLabelMap[req.食材偏好] ?? '随便都行'}

请为「${req.菜名}」生成完整菜谱，严格按 JSON 格式输出。
所有耗时用"分钟"（小数），食材来源标注"今日输入"、"库存"或"调料库"。`;
}

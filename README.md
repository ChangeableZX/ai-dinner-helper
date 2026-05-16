# 饭饭 🍚

> AI 晚餐决策助手 — 加班晚归也能搞定今晚吃什么

---

## 本地启动

```bash
# 1. 安装依赖
npm install

# 2. 配置环境变量（不填 API Key 可用 mock 模式演示）
cp .env.example .env.local

# 3. 启动开发服务器
npm run dev
```

打开 http://localhost:3000 即可体验。

**Mock 模式（无需 API Key）**：`.env.local` 中不填 `OPENAI_API_KEY`，自动返回三道 demo 菜谱（西红柿炒鸡蛋、青菜炒鸡蛋、番茄鸡蛋面），UI 完整可演示。

---

## 环境变量

| 变量名 | 说明 | 默认值 |
|--------|------|--------|
| `OPENAI_API_KEY` | API Key，留空走 mock 模式 | — |
| `OPENAI_BASE_URL` | 兼容任何 OpenAI 格式 API（DeepSeek/智谱等） | `https://api.openai.com/v1` |
| `OPENAI_MODEL` | 使用的模型 | `gpt-4o-mini` |

---

## 技术栈

- **框架**: Next.js 16 (App Router) + TypeScript
- **样式**: Tailwind CSS v4 + shadcn/ui
- **状态**: React Hooks + Zustand v5
- **数据持久化**: localStorage（含 in-memory 降级兜底）
- **AI 接口**: OpenAI 兼容接口，通过 `/api/recommend` 后端路由代理
- **图标**: lucide-react

---

## 功能清单

| 模块 | 状态 |
|------|------|
| 首次使用引导（4步 Onboarding） | ✅ |
| 调料库初始化 + 自定义添加 | ✅ |
| 厨房设备多选 | ✅ |
| 个人偏好（技能/辣度/忌口/人数） | ✅ |
| 主页食材输入（chips + 历史快选） | ✅ |
| 疲劳度三档选择 | ✅ |
| AI 推荐 + 骨架屏加载 | ✅ |
| 推荐结果卡片展示 | ✅ |
| 重新推荐（exclude 已拒绝方案） | ✅ |
| 菜谱详情（食材/步骤/提示） | ✅ |
| 预处理勾选 | ✅ |
| 步骤内嵌计时器（振动反馈） | ✅ |
| 步骤模式（全屏 + 手势切换 + 进度条） | ✅ |
| 步骤模式退出确认弹窗 | ✅ |
| 做完反馈（评分 + 原因 + 文字） | ✅ |
| 历史记录（时间线 + 再做一次） | ✅ |
| 我的画像页（全字段可编辑） | ✅ |
| 重置所有数据（确认弹窗） | ✅ |
| Mock 模式（无 API Key 可运行） | ✅ |

---

## 边界处理索引

| 场景 | 代码位置 |
|------|----------|
| 食材为空/未选疲劳度置灰 | `app/home/page.tsx` |
| 超长食材文本提示 | `app/home/page.tsx` |
| JSON 解析失败重试1次 | `app/api/recommend/route.ts` |
| 虚构食材方案过滤 | `lib/validator.ts` |
| 全方案被过滤提示 | `app/api/recommend/route.ts` |
| 网络失败重试按钮 | `app/recommend/page.tsx` |
| 多次重试友好提示 | `app/recommend/page.tsx` |
| 历史记录为空插画 | `app/history/page.tsx` |
| localStorage 满降级 | `lib/storage.ts` |
| 步骤模式中途退出确认 | `app/cooking/[id]/page.tsx` |
| 计时器结束振动+闪烁 | `app/cooking/[id]/page.tsx` |
| 近7天历史去重 | `app/recommend/page.tsx` |

---

## 部署到 Vercel

```bash
# 方式一：连接 GitHub 仓库，Vercel 自动部署
# 在 Vercel 项目设置中配置环境变量即可

# 方式二：CLI 一键部署
npx vercel deploy
```

在 Vercel 控制台的 **Environment Variables** 中填入：
- `OPENAI_API_KEY`
- `OPENAI_BASE_URL`（可选）
- `OPENAI_MODEL`（可选）

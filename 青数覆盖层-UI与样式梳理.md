# 青数覆盖层：UI 与样式梳理

## 1. 背景与目标

这份文档用于把当前分支中“区别于 `main`、但后续仍希望保留”的工作台 UI 壳层与样式系统抽出来。

这里关注的是：

1. 工作台结构
2. 主要页面编排
3. 主题系统与样式 token
4. 当前分支的交互组织方式

这里不重复记录品牌元数据细节，品牌名、logo、品牌色等请配合 `青数覆盖层-品牌元数据梳理.md` 一起看。

## 2. 核心结论

当前分支的 UI 覆盖层不是几处零散样式，而是一整套工作台外壳：

1. 应用主体是双侧栏工作台，不是 `main` 的原始单层布局。
2. `Cowork / Agents / Skills / ScheduledTasks / Applications / Settings` 都已经围绕这层工作台壳重组。
3. 主题系统已经升级为“CSS token + Tailwind 语义色桥接 + 多主题定义”的完整结构。
4. 当前分支保留了大量围绕工作台壳层的交互组织方式，后续不能只迁局部组件。

因此，后续从 `main` 新起分支时，UI 不应按“哪个组件变了就迁哪个组件”的方式处理，而应按“壳层、主题、主要工作区”三组一起回贴。

## 3. 工作台骨架

### 3.1 顶层编排

核心文件：

1. `src/renderer/App.tsx`

当前结构：

1. 左侧一级侧栏：`PrimarySidebar`
2. 对话场景下的二级侧栏：`SecondarySidebar`
3. 主内容区：`Cowork / Agents / Skills / ScheduledTasks / Applications`
4. 全局叠层：`Settings / HistoryDrawer / SearchModal / WakeActivationOverlay / Toast / LoginWelcomeOverlay`

这层编排是当前分支 UI 覆盖层的入口，优先级很高。

### 3.2 一级侧栏

核心文件：

1. `src/renderer/components/layout/PrimarySidebar.tsx`
2. `src/renderer/components/LoginButton.tsx`

当前职责：

1. 顶部登录与身份区
2. 四个主导航入口
3. 设置入口
4. 底部品牌签名区

这里的“顶部登录与身份区”不是简单按钮，而是登录认证覆盖层在工作台壳中的主入口。

### 3.3 二级侧栏

核心文件：

1. `src/renderer/components/layout/SecondarySidebar.tsx`

当前职责：

1. 主 Agent / managed agent / 其它 agent 的分组展示
2. 会话列表与会话创建入口
3. 历史记录抽屉联动
4. 全局搜索入口
5. Agent 工作区入口

这层不只是样式变化，而是当前工作台信息架构的一部分。

## 4. 主要页面当前组织方式

### 4.1 对话工作区

核心文件：

1. `src/renderer/components/cowork/CoworkView.tsx`
2. `src/renderer/components/cowork/CoworkSessionDetail.tsx`
3. `src/renderer/components/cowork/ConversationHistoryDrawer.tsx`
4. `src/renderer/components/cowork/CoworkPromptInput.tsx`
5. `src/renderer/components/cowork/CoworkSearchModal.tsx`

当前覆盖点：

1. 欢迎态与主对话区布局
2. 历史抽屉与全局搜索
3. 对话输入区与语音输入整合
4. 历史消息展示承接当前工作台壳层

### 4.2 Agent 工作区

核心文件：

1. `src/renderer/components/agent/AgentsView.tsx`
2. `src/renderer/components/agent/AgentCreateModal.tsx`
3. `src/renderer/components/agent/AgentSettingsPanel.tsx`

当前覆盖点：

1. Agent 列表与 managed 分区
2. 新建 Agent 弹窗
3. Agent 设置抽屉 / 面板
4. 预设模板创建入口
5. 治理与 bundle 提示嵌入

### 4.3 其它工作区

核心文件：

1. `src/renderer/components/skills/SkillsView.tsx`
2. `src/renderer/components/scheduledTasks/ScheduledTasksView.tsx`
3. `src/renderer/components/apps/ApplicationsView.tsx`
4. `src/renderer/components/Settings.tsx`

当前覆盖点：

1. 技能页与 managed / governance 承接
2. 定时任务页的工作台风格
3. 应用页与工具管理风格
4. 设置页的多分区风格与当前主题系统对齐

### 4.4 登录承接层

核心文件：

1. `src/renderer/components/LoginButton.tsx`
2. `src/renderer/components/LoginWelcomeOverlay.tsx`
3. `src/renderer/components/Settings.tsx`

当前覆盖点：

1. 一级侧栏顶部登录入口与身份区
2. 登录成功后的欢迎浮层反馈
3. 设置页中的认证配置分区
4. 与工作台顶层叠层、品牌动画和身份态展示的一体化承接

## 5. 样式与主题系统

### 5.1 主题 token 主干

核心文件：

1. `src/renderer/theme/css/themes.css`
2. `src/renderer/theme/css/base.css`
3. `src/renderer/index.css`

当前结构：

1. 通过 `--lobster-*` 变量定义语义色、边框、表面、文本、圆角等 token
2. `themes.css` 里已内置多套主题
3. `index.css` 负责导入主题 CSS，并把语义 token 扩散到全局样式

### 5.2 Tailwind 语义桥接

核心文件：

1. `src/renderer/theme/tailwind/plugin.cjs`

当前作用：

1. 把 `--lobster-*` 变量桥接成 `bg-primary / text-foreground / border-border` 等语义类
2. 同时保留一层 `claude.*` 兼容别名

这意味着当前分支的 UI 不只是“颜色改了”，而是建立在语义 token 之上。

### 5.3 主题定义与切换

核心文件：

1. `src/renderer/theme/themes/index.ts`
2. `src/renderer/services/theme.ts`
3. `src/renderer/theme/engine/*`

当前作用：

1. 管理多主题定义
2. 处理主题切换与持久化
3. 兼容旧的 `light / dark / system` 入口

## 6. 当前 UI 覆盖层的边界

### 6.1 必须保留的外壳

高优先级保留内容：

1. `App.tsx` 的双侧栏工作台编排
2. `PrimarySidebar`
3. `SecondarySidebar`
4. `CoworkView` 主区与历史抽屉编排
5. `AgentsView` 与 `AgentCreateModal` 当前工作台承接方式
6. `Settings` 当前多分区布局与主题承接方式

### 6.2 不应重复迁移的部分

以下内容已经有独立覆盖层文档，不必在这里重复做元数据迁移：

1. 品牌名、logo、品牌介绍
2. managed 治理业务逻辑本身
3. 唤醒与 TTS 的运行时链路
4. 登录认证协议与 bridge 业务细节

但它们会在 UI 层有落点，所以回贴时仍需联动检查。

## 7. 生效位置总表

| 层级 | 关键文件 | 生效内容 |
| --- | --- | --- |
| 顶层骨架 | `src/renderer/App.tsx` | 双侧栏、主区、全局抽屉与叠层 |
| 一级侧栏 | `src/renderer/components/layout/PrimarySidebar.tsx` | 主导航、登录身份区、设置入口、品牌签名 |
| 二级侧栏 | `src/renderer/components/layout/SecondarySidebar.tsx` | Agent 分组、会话入口、历史入口 |
| 对话区 | `src/renderer/components/cowork/*` | 欢迎态、消息区、输入区、搜索、历史 |
| Agent 区 | `src/renderer/components/agent/*` | Agent 列表、创建弹窗、设置面板 |
| 技能与任务 | `src/renderer/components/skills/*`、`src/renderer/components/scheduledTasks/*` | 工作台子页风格 |
| 设置页 | `src/renderer/components/Settings.tsx` | 多分区设置界面 |
| 登录承接 | `src/renderer/components/LoginButton.tsx`、`src/renderer/components/LoginWelcomeOverlay.tsx` | 登录入口、身份态、欢迎浮层 |
| 顶层反馈 | `src/renderer/components/WakeActivationOverlay.tsx`、`src/renderer/components/LoginWelcomeOverlay.tsx` | 唤醒与登录成功后的全局反馈 |
| 主题 CSS | `src/renderer/theme/css/*` | token、全局过渡、基础样式 |
| Tailwind 桥接 | `src/renderer/theme/tailwind/plugin.cjs` | 语义类到 CSS 变量映射 |
| 主题运行时 | `src/renderer/services/theme.ts`、`src/renderer/theme/engine/*` | 主题切换与持久化 |

## 8. 从 main 新分支回贴时的建议

### 8.1 必须成组迁移

高优先级：

1. `src/renderer/App.tsx`
2. `src/renderer/components/layout/PrimarySidebar.tsx`
3. `src/renderer/components/LoginButton.tsx`
4. `src/renderer/components/LoginWelcomeOverlay.tsx`
5. `src/renderer/components/layout/SecondarySidebar.tsx`
6. `src/renderer/components/cowork/CoworkView.tsx`
7. `src/renderer/components/cowork/ConversationHistoryDrawer.tsx`
8. `src/renderer/components/cowork/CoworkSearchModal.tsx`
9. `src/renderer/components/agent/AgentsView.tsx`
10. `src/renderer/components/agent/AgentCreateModal.tsx`
11. `src/renderer/components/agent/AgentSettingsPanel.tsx`
12. `src/renderer/components/Settings.tsx`
13. `src/renderer/index.css`
14. `src/renderer/theme/css/themes.css`
15. `src/renderer/theme/css/base.css`
16. `src/renderer/theme/tailwind/plugin.cjs`
17. `src/renderer/services/theme.ts`
18. `src/renderer/theme/themes/*`
19. `src/renderer/theme/engine/*`

### 8.2 推荐顺序

1. 先迁主题系统与全局 CSS。
2. 再迁 `App.tsx + PrimarySidebar + LoginButton + LoginWelcomeOverlay + SecondarySidebar`。
3. 再迁 `Cowork / Agent / Settings` 这些核心工作区。
4. 最后补 `Skills / ScheduledTasks / Applications` 等次级工作区。

## 9. 验收清单

回贴完成后至少检查：

1. 启动后仍是双侧栏工作台，不是退回旧布局。
2. 一级侧栏导航、登录区、设置入口和底部品牌区仍在原位置。
3. 二级侧栏仍按当前分支的 Agent / 会话组织方式工作。
4. 主内容区切换 `Cowork / Skills / ScheduledTasks / Applications / Agents` 时布局稳定。
5. 登录欢迎浮层与唤醒浮层仍由顶层工作台统一承接，没有层级错乱。
6. 设置页的主题、语音、认证等分区样式和交互保持当前口径。
7. 语义类如 `bg-primary / text-foreground / border-border` 显示正常，没有因 token 丢失而失真。

## 10. 参考文档

建议同时查看：

1. `界面变更.md`
2. `青数覆盖层-品牌元数据梳理.md`
3. `青数覆盖层-内置治理链梳理.md`
4. `青数覆盖层-唤醒与TTS梳理.md`
5. `青数覆盖层-登录认证梳理.md`

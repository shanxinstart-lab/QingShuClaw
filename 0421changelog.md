# 0421 Changelog

## 2026-05-07：继续同步 main@2e211204 之后的公共能力

本轮延续“保留青数覆盖层、公共能力小批次贴回”的策略，继续在 `front-design-merge` 上吸收 `main` 已有但当前分支缺失或未完全拉齐的低风险公共能力。已按代理重新执行 `git fetch origin main:main`，确认本地 `main` 与 `origin/main` 均为 `2e211204`。未整包 merge，未覆盖青数品牌、工作台主 UI、青数登录、青数内置治理链、唤醒/TTS 与 macOS speech helper。

本轮已合入的公共更新：

1. 任务标题展示优化
   - 新增 `src/common/sessionTitle.ts` 与相邻测试，统一本地标题生成规则
   - 新建会话标题不再调用模型生成，改为本地折叠空白并截断到 `50` 个字符
   - 渲染层 `CoworkView` 直接使用同一公共函数生成临时会话标题，去掉后台异步改名，避免标题跳动和额外模型请求
   - 主进程 `generate-session-title` IPC 保留兼容入口，但内部也改成本地计算
2. 主 Agent workspace 与用户工作目录解耦
   - 新增 `getMainAgentWorkspacePath(stateDir)`，主 Agent 的 `MEMORY.md / IDENTITY.md / AGENTS.md` 等固定落在 OpenClaw state 下的 `workspace-main`
   - 新增 `openclawWorkspaceMigration.ts`，启动时一次性把旧工作目录中的 `memory/`、`MEMORY.md`、`AGENTS.md` 用户内容和 bootstrap 文件迁到 `workspace-main`，不删除源文件，遇到冲突保留迁移副本
   - `openclawConfigSync` 写入 `agents.defaults.workspace = workspace-main`，同时把用户选择的工作目录写入 `agents.defaults.cwd`
   - Memory 与 Bootstrap IPC 改为读写 `workspace-main`，用户切换工作目录时不再搬迁长期记忆和身份文件
   - 新增 `openclaw-chat-send-cwd-decoupling.patch`，让 OpenClaw 运行时支持 `workspace` 与实际工具执行 `cwd` 分离
3. 版本号同步
   - `package.json` 版本同步到 `2026.5.7`
   - OpenClaw 核心 pinned 版本仍为 `v2026.4.14`，本轮没有核心版本跳升，因此没有卸载/重建 runtime
4. POPO 设置页标题展示适配
   - 按当前分支 `IMSettingsMain.tsx` 结构适配 `main` 的 POPO 标题栏修复
   - 平台级标题栏改为只对白名单单实例平台 `weixin / netease-bee` 展示，POPO 不再额外显示一层平台标题
   - 复查测试连通性按钮，当前分支已使用正确的 `imConnectivityTest` i18n key，无需额外改动
5. Qwen 视觉模型 catalog fallback patch
   - 补齐 `openclaw-qwen-vision-catalog-fallback.patch`
   - 该 patch 与 `main` 完全一致，用于让 OpenClaw runtime 识别 `qwen-portal` provider alias，并在 catalog 缺失时回退使用配置中的 `input: ['text', 'image']`
   - 这能减少 Qwen 3.6 Plus 等视觉模型在 OpenClaw gateway 内被误判为 text-only 的风险
6. Settings 个性化/记忆页旧路径展示清理
   - 移除 `MEMORY.md` 旧“用户工作目录下路径”展示
   - 移除 `IDENTITY.md / SOUL.md / USER.md` 旁边的旧存储路径标签
   - 这样与主 Agent workspace 已迁到 `{stateDir}/workspace-main` 的行为保持一致，避免误导用户去工作目录查找文件
7. Skill/ClawHub 安装删除稳定性补齐
   - `skills:delete` IPC 改为等待异步删除完成，避免 Windows 上目录句柄释放滞后时 UI 误判成功
   - `SkillManager.deleteSkill()` 删除前会暂停 watcher，Windows 下等待句柄释放，并使用 `fs.promises.rm` 的重试参数
   - 对 Windows `EPERM / EACCES / EBUSY` 删除失败补 `icacls + attrib + rmdir` 兜底；仍失败时移除 `SKILL.md` 并重命名为 tombstone，避免旧技能继续出现在列表中
   - 安装本地/远程/待确认/青数托管 skill 后，Windows 下会执行属性归一化，减少后续删除时因只读/系统属性导致失败
   - `startWatching()` 会清理历史 tombstone，并只监听根目录新增/删除、`SKILL.md`、`_meta.json` 和 `skills.config.json`，避免 skill 内缓存/运行产物变化反复触发全量刷新
   - 补齐 `clawhub.ai` 技能链接识别，使用 bundled `npx-cli.js` + Electron Node 运行 `clawhub@latest install`，并为 Windows 子进程注入 `windowsHide`
   - `buildSkillEnv()` 在开发和打包环境都保证 `HOME/USERPROFILE` 可用，避免 ClawHub/npm 状态目录错误落到根目录或空目录

本轮已确认已在前序改动中覆盖或基本覆盖的 main 更新：

1. `fix(cowork): harden assistant segment persistence for markdown table integrity`
   - 当前分支已存在 `pickPersistedAssistantSegment`、agent assistant stream 保护和 chat delta overwrite skip 等逻辑
2. `fix: 修复模型回复后不停止的问题`
   - 当前分支已存在 `AgentLifecyclePhase` 常量、recently closed runId TTL、late event drop、fallback lifecycle ignore 等保护
3. `fix: 修复 IM 任务中修改模型不生效的问题`
   - 当前分支已补 `openclaw_session_key` 映射、真实 OpenClaw sessionKey patch、渲染层 optimistic modelOverride 更新与回滚
4. `feat(log): add skill import log`
   - 当前分支技能导入流程已经保留下载源、检测方式、安全扫描和安装结果日志；本轮额外补 ClawHub 下载日志和 Windows 删除/安装稳定性日志
5. `fix(skills): stabilize ClawHub import working directory`
   - 本轮已按当前分支结构补齐 ClawHub URL 安装，并把 `cwd` 固定在临时目标目录，避免运行时状态/下载内容落到不可控工作目录
6. `fix(skills): harden Windows install/delete flow and unify import success toast`
   - 后端安装/删除稳定性已补齐；前端成功 toast 当前分支已有自己的技能市场交互与错误展示，本轮未额外改 UI toast 文案

本轮刻意未合入或待后续评估的内容：

1. 未合入 main 的大范围 Settings/登录/认证主干重构，避免冲击青数登录承接层和品牌配置
2. 未覆盖当前分支工作台、青数内置 Agent 管理、治理链、唤醒/TTS 相关实现
3. 未整包覆盖 main 的 `skillManager.ts`，因为当前分支存在青数托管 Skill 元数据、只读保护和治理扫描扩展；本轮只迁入低耦合公共鲁棒性逻辑

校验结果：

1. `./node_modules/.bin/tsc --project electron-tsconfig.json --noEmit` 通过
2. `./node_modules/.bin/tsc --project tsconfig.json --noEmit` 通过
3. `npm run build` 通过；仅保留 Vite 既有的动态/静态导入 chunk 警告
4. 本轮技能管理补丁没有执行真实 ClawHub 登录/安装，因为 `clawhub` 需要用户授权态；已通过 TypeScript 和生产构建验证集成边界

本轮工程原则说明：

1. `KISS`：标题生成回归本地确定性函数，避免不必要的 LLM 请求和异步改名链路
2. `YAGNI`：只同步当前已证明有稳定性收益的 workspace/cwd 分离，不顺手重构设置页或认证主干
3. `SOLID`：把主 Agent 长期工作区与用户任务 cwd 拆成两个职责，降低切换工作目录对记忆/身份文件的副作用
4. `DRY`：主进程、渲染层和兼容 IPC 复用同一个 `sessionTitle` 公共函数，避免标题规则分叉
5. `KISS/SOLID`：Skill 删除、ClawHub 下载、Windows 属性归一化仍收敛在 `SkillManager` 内，未把平台兜底逻辑扩散到 UI 或青数治理模块

## 2026-05-06：同步 main@24f4fd78 公共更新

本轮先执行 `git fetch origin main:main`，将本地 `main` 从 `6b2cb4d8` 快进到 `24f4fd78`。随后继续在当前 `front-design-merge` 分支上按“青数覆盖层优先保护、公共能力小批次合入”的方式吸收 `main` 新增内容，没有整包 merge，也没有覆盖青数品牌、工作台主 UI、青数登录、青数内置治理链、唤醒/TTS 与 macOS speech helper。

本轮已合入的公共更新：

1. 应用版本与 OpenClaw 插件元数据同步
   - `package.json` 版本从 `2026.4.25` 对齐到 `2026.4.29`
   - `openclaw-lark` 从 `2026.4.7` 对齐到 `2026.4.8`
   - `openclaw-weixin` 从 `2.1.7` 对齐到 `2.1.10`
   - `openclaw-nim-channel` 标记为 `optional: true`
   - OpenClaw 核心 pinned 版本仍是 `v2026.4.14`，本轮没有核心版本跳升
2. OpenClaw patch 同步
   - 新增 `openclaw-codex-use-native-transport.patch`
   - 更新 `openclaw-deepseek-v4-thinking-mode.patch`
   - 新增 `openclaw-skip-derive-prompt-segments-deadloop.patch`
   - 新增 `openclaw-widen-incomplete-turn-retry-guard.patch`
   - 保留当前分支已有的 cron、pricing bootstrap、facade import、startup profiler、jiti alias、memory retry 等 patch
3. OpenClaw 配置写入与 gateway 重启稳定性修复
   - `openclaw.json` 写入时补 `meta` stamp，避免 OpenClaw 将直写配置误判为异常 clobber
   - 配置变更比较时忽略 `meta`，避免仅时间戳变化触发不必要配置变更
   - minimal config 会保留已有 `plugins` 与非默认 `gateway`，但不保留旧 `models`，减少 provider/env placeholder 残留诱发的启动异常
4. 模型元数据与 provider fallback 修复
   - server 模型元数据按 modelId 排序后比较，避免模型列表顺序变化被误判为配置变更并诱发 gateway 重启
   - `lobsterai-server` fallback 写入全量模型元数据，减少模型切换后 supportsImage 等能力判断漂移
   - 保留当前分支青数代理路径 `/api/qingshu-claw/proxy/v1`，没有切换到 main 的通用 `/api/proxy/v1`
5. IM 历史与对话展示修复
   - IM gateway 历史 reconcile 改为 tail alignment，尽量保留本地已有历史，只替换真正滑动/补齐的尾部窗口
   - 增加 Feishu、POPO、QQ、Discord 文本清洗，去掉平台注入 header、routing prefix、mention 等展示噪声
   - heartbeat prompt/ack 不再进入本地对话历史展示，减少历史窗口被系统探活内容污染
6. IM 图片与用户消息展示优化
   - Markdown 图片限制最大高度并支持点击预览
   - `file://` 与绝对路径图片会转换为 `localfile://` 供 Electron 本地展示
   - 用户消息展示层新增 `parseUserMessageForDisplay`，去除 IM 媒体元数据，把可展示的本地图片转为 Markdown 图片；该处理仅影响 UI 展示，不改变发送给模型的原始内容
7. 日志脱敏公共能力抽离
   - 新增 `src/main/libs/sanitizeForLog.ts`
   - `mcpLog.ts` 复用统一脱敏与 transport error 识别逻辑，继续避免 token、apiKey、cookie、authorization 等敏感字段进入日志

OpenClaw 本地 runtime 处理结果：

1. 已删除旧的 `vendor/openclaw-runtime/current` 与 `vendor/openclaw-runtime/mac-arm64`
2. 已按用户指定代理执行 `npm run openclaw:runtime:host`
3. OpenClaw 源码确认在 `v2026.4.14`，patch 应用、源码构建、tarball 打包、runtime 解包、gateway bundle、local extensions 同步、extension precompile、channel deps、runtime prune 均已完成
4. 插件安装结果中 `dingtalk-connector`、`openclaw-lark@2026.4.8`、`openclaw-weixin@2.1.10`、`openclaw-nim-channel`、`openclaw-netease-bee`、`clawemail-email` 等已完成
5. `moltbot-popo@2.1.0` 因自定义 registry `https://npm.nie.netease.com` 网络 `ECONNRESET` 下载失败，但该插件在配置中是 `optional: true`，构建脚本已按 optional 插件跳过；如后续必须验 POPO，需要在可访问该 registry 的网络下重跑 `npm run openclaw:runtime:host`

本轮刻意没有合入的内容：

1. 未合入 `Settings.tsx` 大范围重构与 ChatGPT OAuth 登录主线，因为会直接冲击青数登录、设置结构和现有品牌承接
2. 未整包覆盖 `App.tsx / CoworkView.tsx / AgentCreateModal.tsx` 等工作台与 Agent UI 文件，避免破坏当前青数主操作台与内置治理链入口
3. 未迁移 main 中与 OpenAI OAuth、认证主干、通用设置导航强绑定的 UI 流程
4. 未删除青数 `qingshuModules`、managed tool bundle、治理链摘要、内置 Skill/Agent 管理能力
5. 未覆盖当前分支唤醒/TTS、wake activation 缓存与 macOS speech helper 相关实现

校验结果：

1. `./node_modules/.bin/tsc --project electron-tsconfig.json --noEmit` 通过
2. `./node_modules/.bin/tsc --noEmit` 通过
3. `./node_modules/.bin/vitest run src/main/libs/openclawConfigSync.test.ts src/main/libs/openclawConfigGuards.test.ts src/main/libs/openclawHistory.test.ts src/main/libs/openclawChannelSessionSync.test.ts src/main/libs/openclawAgentModels.test.ts src/renderer/components/cowork/agentModelSelection.test.ts src/renderer/components/agent/agentImBindingConfig.test.ts` 通过，`7` 个测试文件、`61` 个用例
4. 曾尝试运行 main 新增的 `sanitizeForLog.test.ts / userMessageDisplay.test.ts / openclawRuntimeAdapter.test.ts / openclawConfigSync.runtime.test.ts`，当前分支尚未引入这些测试文件，因此 Vitest 返回 `No test files found`；本轮改用当前分支实际存在的相邻测试覆盖

本轮工程原则说明：

1. `KISS`：继续采用小批次 cherry-pick/手工补丁式合入，不把 main 的 UI/认证大改整包压进当前分支
2. `YAGNI`：只合入明确解决 gateway 重启、IM 历史、图片展示、日志脱敏和 OpenClaw 插件版本的公共能力
3. `SOLID`：日志脱敏抽到独立 `sanitizeForLog`，OpenClaw config meta 只留在配置同步模块，IM 展示清洗只留在展示层 utility
4. `DRY`：复用 main 已验证的 patch 与公共 helper 思路，避免在当前分支继续分叉出另一套私有实现

## 2026-04-27：同步最新 main 公共更新

本轮先将本地 `main` 快进到 `origin/main = 6b2cb4d`，然后在当前 `front-design-merge` 分支上按覆盖层边界选择性吸收公共能力。保留范围仍然是青数品牌内容、青数内置管理/治理链、主操作台 UI、唤醒/TTS 相关能力与当前对话窗口本地修复。

已合入的公共更新：

1. `OpenClaw` pinned 版本从 `v2026.4.8` 更新到 `v2026.4.14`
2. 同步 main 的 OpenClaw 插件版本：
   - `dingtalk-connector` 更新到 `0.8.16`
   - `wecom-openclaw-plugin` 更新到 `2026.4.22`
   - `moltbot-popo` 更新到 `2.1.0`
   - `openclaw-nim-channel` 更新到 `1.1.1`
   - 新增 `clawemail-email@0.9.12`
3. 同步 `v2026.4.14` OpenClaw patch 目录：
   - `openclaw-cron-skip-missed-jobs.patch`
   - `openclaw-deepseek-v4-thinking-mode.patch`
   - `openclaw-disable-model-pricing-bootstrap.patch`
   - `openclaw-facade-runtime-static-import.patch`
   - `openclaw-gateway-startup-profiler.patch`
   - `openclaw-jiti-alias-prenormalize.patch`
   - `openclaw-memory-atomic-reindex-ebusy-retry.patch`
4. 合入 DeepSeek V4 thinking mode patch 的最新修复，覆盖 `anthropic-messages` API 格式下的 thinking 参数处理
5. 合入系统代理公共修复：
   - 代理解析目标从单一 `openrouter.ai` 扩展为 `api.openai.com / api.anthropic.com / generativelanguage.googleapis.com / openrouter.ai`
   - OpenClaw gateway 与 subprocess 注入代理时记录实际命中的目标 URL
   - OpenClaw provider 配置在系统代理开启且 baseURL 非 loopback 时写入 `request.proxy.mode = env-proxy`
6. 合入 MCP Bridge 工具 schema 规范化：
   - 对缺失 `items` 的 array schema 自动补 `{}`，减少 OpenAI 兼容格式校验失败
   - MCP Bridge config 变更检测从只比较工具名改为比较完整工具 JSON
7. 合入 OpenClaw 会话模型同步修复：
   - 继续对话前将当前 session/agent 模型 patch 到 OpenClaw session
   - prompt 桥接内容补充当前模型信息，减少 agent 侧报告模型与实际模型不一致
8. 合入 OpenClaw lifecycle 兜底修复：
   - `phase=end` 缺少 `chat final` 时延迟 reconcile 并完成当前 turn
   - 兜底定时器会校验 runId，避免误完成后续新 turn
   - `phase=error` 缺少 `chat error` 时兜底追加系统错误并释放运行态
9. 合入“切换会话保留首页草稿/附件”的行为修复；当前分支对应功能大体已存在，本轮只保留与现有唤醒输入逻辑兼容的轻量同步

OpenClaw 本地处理：

1. 已删除旧的 `../openclaw` source
2. 已删除旧的 `vendor/openclaw-runtime/mac-arm64` 和 `vendor/openclaw-runtime/current`
3. 已通过代理重新 clone `../openclaw` 到 `v2026.4.14`
4. 当前未立即重建 runtime；后续执行 `npm run openclaw:runtime:host`、OpenClaw dev 启动或打包时，会基于新版本重新构建

本轮刻意没有合入的内容：

1. 未直接覆盖 `App.tsx / CoworkView.tsx` 的主操作台布局
2. 未覆盖青数品牌图标、文案、登录承接层与工作台视觉骨架
3. 未删除青数治理链、`qingshuModules`、managed tool bundle 与内置管理 UI
4. 未覆盖唤醒/TTS、本地 macOS speech helper 与当前对话历史完整渲染修复

校验结果：

1. `./node_modules/.bin/tsc --noEmit` 通过
2. `./node_modules/.bin/tsc --project electron-tsconfig.json --noEmit` 通过
3. `npm test -- openclawConfigSync` 通过，`1` 个测试文件、`23` 个用例
4. `npm run build` 通过；仅保留 Vite 既有的动态/静态导入 chunk 警告

本轮工程原则说明：

1. `KISS`：未做大 merge，只按 main 新增公共修复逐项吸收
2. `YAGNI`：不提前重构品牌/治理/工作台覆盖层，只同步本轮明确需要的公共能力
3. `SOLID`：代理解析、Provider 配置、OpenClaw session patch 仍放在各自职责模块中
4. `DRY`：复用 main 已验证的 OpenClaw patch、schema 规范化和生命周期兜底实现，避免在当前分支再造一套分支私有逻辑

## 扫描范围与基线

本次扫描基于 `2026-04-21` 当前工作区状态，比较对象如下：

1. 当前分支：`front-design-merge`（`HEAD = 3d499f6806d2`）
2. 对比分支：`origin/main`（`50999435b6ba`，已在本次扫描前执行 `git fetch origin main` 刷新）
3. 共同基线：`dadc31bad9bb23857d98c65ce0a882326d1b8d45`
4. 当前工作区不是干净状态，额外存在 `23` 个未提交修改项

分支历史状态：

1. `front-design-merge` 相对 `origin/main` 仍有明显分叉
2. 提交计数上，`origin/main` 独有提交 `514` 个，当前分支独有提交 `18` 个
3. 因此这次文档同时记录两类差异：
   - 当前分支已经形成的正式差异
   - 当前工作区尚未提交的进行中改动

---

## 核心结论

1. 当前分支不是简单的 UI 分支，而是叠加了 `青数品牌/工作台/认证/治理链/语音能力/Skill Agent 管理/OpenClaw 运行时适配` 的业务定制分支。
2. 从共同基线到当前分支，`git diff origin/main...HEAD --stat` 统计为：
   - 变更文件 `298`
   - 新增 `52906` 行
   - 删除 `6428` 行
3. 从当前分支反看最新 `main`，`git diff HEAD..origin/main --stat` 统计为：
   - 变更文件 `336`
   - 新增 `21686` 行
   - 删除 `45696` 行
4. 这说明当前分支已经保留了大量业务特化内容，但和 `main` 仍未达到“无缝跟随”的状态，后续继续并入 `main` 仍需要分模块收口。

---

## 本轮进一步拉齐策略

在“不影响当前品牌、工作台样式和青数内置治理链”的前提下，后续继续向 `main` 拉齐时采用如下边界与顺序：

1. 保留不动的边界：
   - `QingShuBrandMark`、工作台双侧栏、品牌色和当前业务入口组织方式
   - 青数登录认证链路
   - `qingshuModules`、`qingshuManaged`、Skill 治理与工具包管理
   - 当前分支附加的本地语音/唤醒业务能力
2. 优先对齐的公共能力：
   - `MCP/OpenClaw` 公共运行时、配置同步、诊断与网关稳定性
   - 通用 `Provider/Settings` 能力
   - `IM` 通道公共行为与多实例兼容修复
   - 不影响品牌结构的对话区主线行为修复
3. 推进方式：
   - 先处理低风险公共层，再处理与业务展示耦合更深的 UI 层
   - 每一轮对齐都要能单独验收，避免“一次性大 merge”再次把品牌和青数治理逻辑冲散

## 本轮已完成的首轮对齐

本次继续拉齐中，已经先完成一组低风险公共能力收敛，全部避开了品牌 UI 骨架和青数治理模块：

1. `MCP Bridge` 同步生命周期事件对齐
   - 文件：`src/main/main.ts`、`src/main/preload.ts`
   - 新增 `mcp:bridge:syncStart` / `mcp:bridge:syncDone` 广播
   - 让渲染层已有的 `mcpService.onBridgeSyncStart/onBridgeSyncDone` 真正可用
2. `MCP Server Manager` 诊断能力对齐
   - 文件：`src/main/libs/mcpServerManager.ts`
   - 为 stdio server 保留最近 stderr 摘要
   - 工具调用日志补充参数预览、结果预览、transport-style 错误识别
   - 保留当前分支已有的本地 `QingShu Managed` tool runtime 注册能力，没有照搬 `main` 那版删掉 local server 支持
3. 编译校验
   - 已执行 `./node_modules/.bin/tsc --noEmit`
   - 本轮新增改动通过编译

说明：

1. 这轮先处理 `MCP/OpenClaw` 公共层，是因为它与当前工作区里正在收尾的品牌/对话 UI 改动几乎不冲突。
2. 后续下一轮可以继续沿着 `Provider/Settings` 和 `IM` 的公共修复往前推。

## 本轮已完成的第二轮对齐

在第一轮 `MCP/OpenClaw` 公共层收敛之后，本次又继续补上了一组 `Provider/Settings` 的主线通用能力：

1. Provider 元数据补齐
   - 文件：`src/shared/providers/constants.ts`
   - 为内置 provider 补齐 `label`、`website`、`apiKeyUrl` 以及缺失的 `openClawProviderId`
   - 覆盖范围包括 `DeepSeek / Moonshot / Qwen / Zhipu / MiniMax / Volcengine / Youdao / Qianfan / StepFun / Xiaomi / OpenAI / Gemini / Anthropic / OpenRouter / Ollama`
2. 设置页补齐官网与 API Key 获取入口
   - 文件：`src/renderer/components/Settings.tsx`
   - Provider 设置头部新增“访问官网”入口
   - API Key 输入区新增“获取 API Key”链接
   - 这部分是对齐 `main` 的通用 UX，不改变当前分支品牌布局和工作台结构
3. 多语言文案补齐
   - 文件：`src/renderer/services/i18n.ts`
   - 新增 `visitOfficialSite` / `getApiKey` 中英文文案
4. 编译校验
   - 再次执行 `./node_modules/.bin/tsc --noEmit`
   - 本轮新增改动继续通过编译

## 本轮已完成的第三轮对齐

本次继续拉齐中，又补上了一组 `IM` 公共行为修补，仍然保持“只改公共层，不碰品牌和工作台 UI 骨架”的原则：

1. 多实例 IM 连接测试优先选择“已启用且配置完整”的实例
   - 文件：`src/main/im/imGatewayManager.ts`
   - 适用平台：`Feishu / DingTalk / WeCom / QQ`
   - 避免在存在多个实例时，错误拿到一个半配置状态的实例做探测，提升连通性测试结果可信度
2. QQ 连接测试提示细化
   - 文件：`src/main/im/imGatewayManager.ts`、`src/main/i18n.ts`
   - 为 QQ 增补专门的缺失凭据提示、鉴权失败提示和修复建议
   - 不再只复用通用 `imFillCredentials / imAuthFailedSuggestion`
3. Weixin / POPO 诊断日志补强
   - 文件：`src/main/im/imGatewayManager.ts`
   - 微信扫码登录等待结果改成结构化日志输出
   - POPO 扫码成功后补充完成通知的说明，便于后续排障
4. 编译校验
   - 再次执行 `./node_modules/.bin/tsc --noEmit`
   - 本轮新增改动继续通过编译

## 本轮已完成的第四轮对齐

这轮继续补的是“多实例 IM 会话归属”和“Cowork 对话区旧态残留”两类容易带来展示错乱的公共问题：

1. 多实例 IM 会话绑定进一步向 `main` 靠拢
   - 文件：`src/main/libs/openclawChannelSessionSync.ts`
   - 新增 `extractAccountIdFromKey` / `resolveAgentBinding`
   - 对 `DingTalk / Feishu / QQ / WeCom` 这类多实例平台，网关 session key 现在会优先按 `platform:instanceId` 绑定 agent，而不是只按平台级默认绑定
   - 同时保留会话 key 中的账号维度，避免不同实例下同一会话目标错误复用到同一个本地会话
2. 单实例 IM 兜底会话执行模式收敛
   - 文件：`src/main/im/imCoworkHandler.ts`
   - 当 IM 侧直接创建本地 cowork 会话时，兜底执行模式改为 `local`
   - 与 `main` 当前主线保持一致，减少被历史 `auto` 配置带偏后出现的执行不稳定
3. Cowork 首页残留 loading 态清理
   - 文件：`src/renderer/components/cowork/CoworkView.tsx`
   - 移除了 `currentSessionId` 残留时强制卡在 loading spinner 的旧分支
   - 对当前分支这种已经做过多轮 UI 改造的对话页更稳，能减少“会话明明没打开，但页面停在加载态”的旧问题
   - 同时补齐了相关 `useEffect` 依赖，减少快捷动作栏和焦点恢复的状态漂移
4. 说明
   - 这一轮仍然没有直接硬改 `CoworkSessionDetail.tsx` 的现有视觉布局，因为该文件当前工作区已经有一组正在收尾的本地 UI 调整
   - 但这轮补的三处底层行为，正好对应“多实例会话归属错误”和“对话页状态残留”这两类更容易引起展示错乱的根因
5. 校验结果
   - 已执行 `npm test -- openclawChannelSessionSync`
   - 已执行 `./node_modules/.bin/tsc --noEmit`
   - 当前这轮新增改动通过测试与编译

## 本轮已完成的第五轮对齐

这轮继续补的是 `main` 已经具备、但当前分支之前还缺一截的“会话级模型覆盖”公共能力：

1. OpenClaw session patch 链路补齐
   - 文件：`common/openclawSession.ts`
   - 文件：`src/main/libs/agentEngine/types.ts`
   - 文件：`src/main/libs/agentEngine/coworkEngineRouter.ts`
   - 文件：`src/main/libs/agentEngine/openclawRuntimeAdapter.ts`
   - 文件：`src/main/main.ts`
   - 文件：`src/main/preload.ts`
   - 文件：`src/renderer/types/electron.d.ts`
   - 文件：`src/renderer/services/cowork.ts`
   - 补上 `openclaw:session:patch` IPC、运行时 `patchSession` 调用能力，以及渲染层 `coworkService.patchSession(...)`
2. Session modelOverride 落库
   - 文件：`src/main/sqliteStore.ts`
   - 文件：`src/main/coworkStore.ts`
   - 为 `cowork_sessions` 增补 `model_override` 字段与迁移
   - session 拉取、更新、返回给 renderer 时，都会携带 `modelOverride`
3. 对话输入区模型选择器向 `main` 靠拢
   - 文件：`src/renderer/components/cowork/CoworkPromptInput.tsx`
   - 当位于具体会话中时，输入区模型选择器现在优先反映当前 session 的 `modelOverride`
   - 会话内切模型会走 session patch；未进入会话时仍更新当前 agent 模型
   - 保留了当前分支已有的语音输入、唤醒与附件逻辑，没有按 `main` 那版把这些能力裁掉
4. 校验结果
   - 已执行 `./node_modules/.bin/tsc --noEmit`
   - 已执行 `npm test -- openclawChannelSessionSync`
   - 当前这轮新增改动通过编译与针对性测试

## 本轮已完成的第六轮对齐

这轮继续收的是“对话窗口历史消息展示主线”里最容易引发错乱的一层状态逻辑，仍然遵循“先对齐公共行为、避免重刷当前分支已有 UI 视觉稿”的方式：

1. 流式消息更新逻辑向 `main` 对齐
   - 文件：`src/renderer/store/slices/coworkSlice.ts`
   - 移除了当前分支额外保留的 `mergeStreamingMessageContent(...)` 本地拼接逻辑
   - `updateMessageContent` 现在与 `main` 一致，直接以上游最新快照覆盖消息内容
   - 这样可以避免 assistant 流式返回发生回退、重算或重新分块时，前端把旧内容和新内容错误拼接，进而造成历史消息重复、残缺或顺序错乱
2. OpenClaw session policy 读取链路继续向 `main` 靠拢
   - 文件：`src/renderer/services/cowork.ts`
   - `loadConfig()` 现在会并行读取 `cowork:getConfig` 与 `openclaw:sessionPolicy:get`
   - 新增 `updateSessionPolicy(...)`，为后续把设置页的 session keep-alive 完整切到主线独立接口预留了兼容层
   - 同时保留当前分支已有的 `QingShu Managed` 错误提示分支，没有把这部分业务定制抹掉
3. 补充回归测试
   - 文件：`src/renderer/store/slices/coworkSlice.test.ts`
   - 新增针对流式消息“应当相信最新快照、而不是本地追加合并”的用例
   - 这类测试能直接防止后续继续收敛对话 UI 时，把旧拼接器又带回来
4. 说明
   - 这一轮仍然没有大面积改动 `src/renderer/components/cowork/CoworkSessionDetail.tsx`
   - 原因是当前工作区该文件已经有大量未提交的本地视觉调整；本轮优先修正更可能导致“展示错乱”的公共状态层，先把根因收掉
5. 校验结果
   - 已执行 `npm test -- coworkSlice`
   - 已执行 `./node_modules/.bin/tsc --noEmit`
   - 当前这轮新增改动通过测试与编译

## 本轮已完成的第七轮对齐

这轮继续补的是会直接影响“历史对话可读性”的错误消息链路，目标是把当前分支会话页里的重复 system error 收干净：

1. Cowork 可见错误文案收敛为单一来源
   - 文件：`src/renderer/services/coworkErrorMessage.ts`
   - 新增 `getCoworkVisibleErrorMessage(...)`
   - 将 `ENGINE_NOT_READY`、`QingShu Managed AuthRequired/Forbidden` 以及普通错误分类逻辑收敛到一个纯函数里，避免同一类错误在不同调用点各自拼文案
2. continueSession 失败时不再向会话里重复追加两条系统错误消息
   - 文件：`src/renderer/services/cowork.ts`
   - 当前分支此前在 `continueSession(...)` 失败时，会先插入一条 session error，再插入一条 classified error，历史消息区会出现重复报错
   - 现在改为只保留一条对用户可见的 system error：
     - `ENGINE_NOT_READY` 保留一条启动提示
     - `QingShu Managed` 鉴权/权限错误保留对应业务提示
     - 其他错误保留分类后的可读提示
   - `startSession(...)` 的 toast 也复用同一套错误映射，保证行为一致
3. 补充错误映射纯函数测试
   - 文件：`src/renderer/services/coworkErrorMessage.test.ts`
   - 覆盖 `ENGINE_NOT_READY`、`Managed AuthRequired`、`Managed Forbidden` 和普通错误兜底四类场景
4. 说明
   - 这一轮仍未大面积修改 `CoworkSessionDetail.tsx`，因为对比后发现 `buildDisplayItems / buildConversationTurns / hasRenderableAssistantContent / showTypingIndicator` 这几段核心行为当前已基本与 `main` 对齐
   - 因此这轮优先处理真正会导致“历史对话显示重复、阅读噪音过高”的错误消息链路
5. 校验结果
   - 已执行 `npm test -- coworkErrorMessage`
   - 已执行 `./node_modules/.bin/tsc --noEmit`
   - 当前这轮新增改动通过测试与编译

## 本轮已完成的第八轮对齐

这轮继续补的是会话入口层的小状态差异，重点解决“异步拉取会话时先闪空态”的体验问题：

1. 会话搜索弹窗支持加载态透传
   - 文件：`src/renderer/components/cowork/CoworkSearchModal.tsx`
   - 新增 `isLoading` 属性
   - 当搜索框为空时，弹窗现在会把加载态透传给 `CoworkSessionList`
   - 这样在刚打开全局对话搜索、会话列表还在聚合各 agent 数据时，会显示 spinner，而不是误报“无结果”
2. 历史对话抽屉支持加载态透传
   - 文件：`src/renderer/components/cowork/ConversationHistoryDrawer.tsx`
   - 同样新增 `isLoading` 属性
   - 当搜索框为空时，抽屉使用 `CoworkSessionList` 的加载/空态；只有用户明确输入搜索词后，零结果才显示“暂无对话记录”
3. App 层补齐历史抽屉与全局搜索的 loading 状态管理
   - 文件：`src/renderer/App.tsx`
   - `historyDrawerState` 新增 `isLoading`
   - 新增 `globalSearchLoading`
   - `refreshHistoryDrawerSessions()` 和 `loadGlobalSearchSessions()` 现在会在异步请求前后显式维护 loading 状态
   - 这使当前分支在切 agent、打开历史抽屉、打开全局搜索时的反馈更接近 `main` 的公共 UX
4. 说明
   - 这一轮仍然是“状态层对齐”，没有改动青数品牌外壳、工作台布局或青数内置治理逻辑
   - 价值在于减少列表加载时的误导性空白，尤其适合当前已经切到多 agent / 多会话入口的工作台结构
5. 校验结果
   - 已执行 `./node_modules/.bin/tsc --noEmit`
   - 当前这轮新增改动通过编译

## 本轮已完成的第九轮对齐

这轮补的是侧边栏本地会话搜索的最后一段加载态透传，让前面第八轮收好的 loading 体验在 sidebar 入口也真正生效：

1. Sidebar 本地会话搜索接入 loading 状态
   - 文件：`src/renderer/components/Sidebar.tsx`
   - 现在侧边栏里的 `CoworkSearchModal` 也会收到 `sessionsLoading`
   - 当用户切换 agent 后立即打开当前 agent 的会话搜索，不会再先看到误导性的空列表，而是保持与列表区一致的加载反馈
2. 说明
   - 这是一个很小的状态透传补丁，但能把 sidebar 列表、sidebar 搜索、全局搜索、历史抽屉这几条会话入口的反馈统一起来

## 本轮已完成的第十二轮对齐

这轮补的是输入区模型选择的失效提示，把当前分支已经接上的会话级模型能力和 `main` 的异常提示体验补完整：

1. 输入区模型选择补齐显式模型失效提示
   - 文件：`src/renderer/components/cowork/CoworkPromptInput.tsx`
   - 当前分支已经支持会话级 `modelOverride` 和 agent 级模型解析
   - 但此前如果 session / agent 显式绑定的模型在当前可用模型列表里已失效，界面只会静默 fallback 到全局模型，用户很难意识到自己绑定的模型已经不可用
   - 现在与 `main` 一样，在 OpenClaw 模式下会于模型选择器下方显示 `agentModelInvalidHint`
2. 补齐配套 i18n 文案
   - 文件：`src/renderer/services/i18n.ts`
   - 新增 `agentModelInvalidHint` 中英文文案
3. 说明
   - 这一轮不改变任何模型选择逻辑，只补齐“显式模型失效”的可见反馈
   - 属于典型的低风险主干对齐：保留当前分支的会话级模型能力，同时补足 `main` 已有的稳定性提示
4. 校验结果
   - 已执行 `./node_modules/.bin/tsc --noEmit`
   - 当前这轮新增改动通过编译

## 本轮已完成的第十三轮对齐

这轮补的是模型选择器“恢复默认模型”的能力，把仓库里已经具备的 `ModelSelector defaultLabel + null` 机制真正接到 Cowork 主线里：

1. 会话输入区支持恢复到 Agent 默认模型
   - 文件：`src/renderer/components/cowork/CoworkPromptInput.tsx`
   - 当前会话若存在 `modelOverride`，现在可以通过模型选择器里的默认项一键清空 override
   - 前端会调用 `coworkService.patchSession(sessionId, { model: null })`
   - 这样会话模型不再只能越选越具体，也可以回退到 Agent 默认模型
2. 顶部 Agent 模型选择支持恢复到全局默认模型
   - 文件：`src/renderer/components/cowork/CoworkView.tsx`
   - 当 Agent 存在显式模型绑定时，顶部 `ModelSelector` 现在也支持选择默认项，把 Agent 模型清空为 `''`
   - 行为上等价于“恢复使用全局默认模型”
3. 补齐默认项所需的 i18n 文案
   - 文件：`src/renderer/services/i18n.ts`
   - 新增 `agentDefaultModel` 与 `scheduledTasksFormModelDefault` 的中英文文案
4. 说明
   - 这一轮没有新增新的模型逻辑，只是把仓库里已经具备的 `ModelSelector defaultLabel / null` 能力真正接到 Cowork 会话级与 Agent 级模型选择里
   - 这能降低“误设了显式模型后只能手动改回字符串配置”的使用成本，也让会话级模型覆盖链路更完整
5. 校验结果
   - 已执行 `./node_modules/.bin/tsc --noEmit`
   - 当前这轮新增改动通过编译

## 本轮已完成的第十四轮对齐

这轮补的是“历史对话展示逻辑”的回归保护，把已经逐步向 `main` 靠拢的 turn 组装规则独立出来并锁成测试，避免后续继续并主干时再次把消息顺序或分组打乱：

1. 抽离 Cowork 对话 turn 组装工具
   - 文件：`src/renderer/components/cowork/coworkConversationTurns.ts`
   - 将 `buildDisplayItems`、`buildConversationTurns`、`hasRenderableAssistantContent` 以及 `getToolResultDisplay`、`hasText` 等相关公共逻辑从 `CoworkSessionDetail.tsx` 中拆出
   - 这样 `CoworkSessionDetail` 与 `RunSessionModal` 都复用同一套对话分组语义，减少后续并 `main` 时同逻辑散落两处产生漂移
2. 保持会话详情页与运行记录弹窗共用同一套消息分组规则
   - 文件：`src/renderer/components/cowork/CoworkSessionDetail.tsx`
   - 文件：`src/renderer/components/scheduledTasks/RunSessionModal.tsx`
   - 当前会话页和定时任务运行记录弹窗现在都从新的 `coworkConversationTurns.ts` 读取展示分组能力
   - 这能保证“孤儿 assistant/system 消息”、“tool_use + tool_result 配对”、“可渲染 assistant 内容判定”等规则在两个入口一致
3. 为历史对话展示逻辑补齐单测
   - 文件：`src/renderer/components/cowork/coworkConversationTurns.test.ts`
   - 新增覆盖：
     - `toolUseId` 精确配对的 `tool_use / tool_result`
     - 无 `toolUseId` 时的相邻兜底配对
     - assistant/system 先于 user 出现时的 orphan turn 组装
     - streaming thinking 对 typing/渲染判定的可见性
     - `tool_result` 中 ANSI 与 `<tool_use_error>` 标签的归一化
4. 说明
   - 这一轮不改青数品牌、不改工作台壳层、不改治理链，只收敛公共的历史消息组装逻辑
   - 方案上符合 `KISS / DRY`：先把“已经验证接近 main 的核心语义”抽成单一来源，再继续做后续主干对齐
5. 校验结果
   - 已执行 `./node_modules/.bin/tsc --noEmit`
   - 已执行 `./node_modules/.bin/vitest run src/renderer/components/cowork/coworkConversationTurns.test.ts src/renderer/store/slices/coworkSlice.test.ts src/renderer/services/coworkErrorMessage.test.ts`
   - 当前这轮新增改动通过编译与单测

## 本轮已完成的第十五轮对齐

这轮补的是 `Provider / GitHub Copilot / OpenClaw 模型引用` 这一小段公共链路，目标是把设置页、聊天请求和模型引用映射的公共行为继续往 `main` 拉齐：

1. 抽离 API 请求头公共 helper，统一 `Copilot` 兼容头
   - 文件：`src/renderer/services/apiRequestHeaders.ts`
   - 文件：`src/renderer/services/apiRequestHeaders.test.ts`
   - 新增 `buildApiRequestHeaders(...)`
   - 统一处理：
     - 普通 OpenAI 兼容 provider 的 `Authorization: Bearer ...`
     - `Gemini` 的 `x-goog-api-key`
     - `GitHub Copilot` 所需的 `Copilot-Integration-Id / Editor-Version / User-Agent / Openai-Intent` 等兼容头
2. 让聊天请求和设置页连通性测试共用同一套头部生成逻辑
   - 文件：`src/renderer/services/api.ts`
   - 文件：`src/renderer/components/Settings.tsx`
   - 之前设置页 provider 连通性测试里有 `Copilot` 特殊头，但实际聊天请求链路里已经漂掉了
   - 现在两处都统一走 `buildApiRequestHeaders(...)`，避免“设置页测试能通、真实对话请求行为不一致”的问题
3. 补回 `ProviderRegistry.getOpenClawProviderId(...)` 公共映射接口
   - 文件：`src/shared/providers/constants.ts`
   - 文件：`src/shared/providers/constants.test.ts`
   - 文件：`src/renderer/utils/openclawModelRef.ts`
   - 把 `main` 已有的 provider → OpenClaw provider id 映射能力补回
   - `openclawModelRef` 也改成直接复用这层公共映射，避免渲染层手写兜底逻辑再次漂移
4. 说明
   - 这轮不碰青数品牌壳层、不碰工作台结构，只收公共 provider 行为
   - 属于低风险主干对齐：既补回 `Copilot` 聊天真实请求所需的兼容头，也把 OpenClaw 模型引用映射重新收敛到单一来源
5. 校验结果
   - 已执行 `./node_modules/.bin/tsc --noEmit`
   - 已执行 `./node_modules/.bin/vitest run src/renderer/services/apiRequestHeaders.test.ts src/shared/providers/constants.test.ts src/renderer/components/cowork/coworkConversationTurns.test.ts src/renderer/store/slices/coworkSlice.test.ts src/renderer/services/coworkErrorMessage.test.ts`
   - 当前这轮新增改动通过编译与单测

## 本轮已完成的第十六轮对齐

这轮继续收的是 `Provider` 请求规则的“双处漂移”问题，把设置页测试链路与真实聊天链路用到的 provider 请求规则统一成单一来源：

1. 抽离 provider 请求规则公共 helper
   - 文件：`src/renderer/services/providerRequestConfig.ts`
   - 文件：`src/renderer/services/providerRequestConfig.test.ts`
   - 新增并统一了这些公共规则：
     - `getFixedApiFormatForProvider(...)`
     - `getEffectiveProviderApiFormat(...)`
     - `shouldShowProviderApiFormatSelector(...)`
     - `buildOpenAICompatibleChatCompletionsUrl(...)`
     - `buildOpenAIResponsesUrl(...)`
     - `shouldUseOpenAIResponsesForProvider(...)`
     - `shouldUseMaxCompletionTokensForOpenAI(...)`
2. 设置页与真实聊天请求共用同一套 provider 规则
   - 文件：`src/renderer/components/Settings.tsx`
   - 文件：`src/renderer/services/api.ts`
   - 之前设置页连通性测试和 `apiService` 实际请求分别维护不同的 URL 拼装与 API format 规则
   - 现在两边都改为走 `providerRequestConfig.ts`，减少后续继续并 `main` 时的行为漂移
3. 修正 `Copilot / Gemini` 这类 provider 的端点拼装细节
   - 文件：`src/renderer/services/providerRequestConfig.ts`
   - `GitHub Copilot` 继续使用不强加 `/v1` 前缀的 `/chat/completions`
   - `Gemini` 的 OpenAI 兼容入口统一走 `.../v1beta/openai/chat/completions`
   - 这类 provider 之前最容易出现“设置页测试行为和真实请求不一致”的问题，现在有单测锁住了
4. 说明
   - 这轮仍然只收公共 provider 行为，不碰青数品牌、工作台和业务壳层
   - 属于典型的 `DRY` 收敛：把原本散落在设置页与请求层的 provider 规则统一起来，降低后续继续拉齐 `main` 的冲突成本
5. 校验结果
   - 已执行 `./node_modules/.bin/tsc --noEmit`
   - 已执行 `./node_modules/.bin/vitest run src/renderer/services/providerRequestConfig.test.ts src/renderer/services/apiRequestHeaders.test.ts src/shared/providers/constants.test.ts src/renderer/components/cowork/coworkConversationTurns.test.ts src/renderer/store/slices/coworkSlice.test.ts src/renderer/services/coworkErrorMessage.test.ts`
   - 当前这轮新增改动通过编译与单测

## 本轮已完成的第十七轮对齐

这轮继续补的是 `auth.ts` 的登录态恢复 / 会话失效 / quota 刷新链，让当前分支的认证公共行为更接近 `main`，同时避免青数托管内容在会话失效后残留：

1. 抽离“退出后隐藏青数托管内容”的纯 helper
   - 文件：`src/renderer/services/authSessionReset.ts`
   - 文件：`src/renderer/services/authSessionReset.test.ts`
   - 新增 `disableQingShuManagedItems(...)`
   - 把 `qingshu-managed` 来源的 agent / skill 统一转换成 `enabled: false`
   - 这样退出登录或恢复失败时，托管内容可见态的处理不再散落在 `auth.ts` 里手写
2. 补齐登录态恢复失败时的本地状态清理
   - 文件：`src/renderer/services/auth.ts`
   - 之前 `init()` 在恢复登录失败时只会 `setLoggedOut()`，不会顺手清掉当前会话、服务器模型和青数托管 agent / skill 的可见态
   - 现在恢复失败、会话失效、主动退出都会统一走 `clearLocalSessionState()`
   - 这能避免“用户其实已掉线，但界面还保留服务器模型或托管内容”的残留
3. 为 quota 刷新与窗口聚焦刷新补上 session guard
   - 文件：`src/renderer/services/auth.ts`
   - 新增 `resetAuthRuntimeState(...)` 与 `getAuthSessionGuard(...)`
   - `quotaChanged` 和窗口聚焦触发的 `refreshQuota / loadServerModels` 现在都会带 guard，避免旧请求在登录态切换后回写状态
   - `destroy()` 也会同时失效掉旧的认证上下文，降低重复 `init()` 时后台水合任务串写状态的风险
4. 说明
   - 这轮仍是公共认证行为层的收口，不触碰青数品牌、工作台壳层和业务展示
   - 属于“把已接入的认证主线收稳”的对齐，不是机械搬运 `main`
5. 校验结果
   - 已执行 `./node_modules/.bin/tsc --noEmit`
   - 已执行 `./node_modules/.bin/vitest run src/renderer/services/authSessionReset.test.ts src/renderer/services/providerRequestConfig.test.ts src/renderer/services/apiRequestHeaders.test.ts src/shared/providers/constants.test.ts`
   - 当前这轮新增改动通过编译与单测

## 本轮已完成的第十八轮对齐

这轮开始往 `IM 多实例` 的底层公共语义上收，把 `imGatewayManager` 里已经在使用、但还没有独立收口和测试的“实例选择 / 启用判断 / 连接判断”抽成了可复用 helper：

1. 抽离 IM 多实例底层状态 helper
   - 文件：`src/main/im/imGatewayConfigState.ts`
   - 文件：`src/main/im/imGatewayConfigState.test.ts`
   - 新增并测试：
     - `pickConfiguredInstance(...)`
     - `isPlatformEnabled(...)`
     - `isAnyGatewayConnected(...)`
2. `imGatewayManager` 统一复用多实例实例选择逻辑
   - 文件：`src/main/im/imGatewayManager.ts`
   - 之前连通性测试里已经开始优先挑“已启用且配置完整”的实例，但 `getMissingCredentials(...)` 和 `runAuthProbe(...)` 里仍有一部分路径还在用“第一个启用实例”
   - 现在这几处都统一改成走 `pickConfiguredInstance(...)`
   - 这样 `Feishu / DingTalk / QQ / WeCom` 多实例场景下，缺失字段判断和认证探测会更一致，不容易误判到一个已启用但未完整配置的实例
3. 统一平台启用与全局连接判定
   - 文件：`src/main/im/imGatewayManager.ts`
   - `isAnyConnected()` 与 `getPlatformEnabled(...)` 改为直接复用 helper
   - 这让 IM 多实例底层语义从“散落在 manager 里的内联实现”变成“单一来源 + 单测约束”
4. 说明
   - 这轮只收主进程 IM 的公共状态语义，不碰 IM 设置页的大 UI，不碰青数品牌壳层
   - 属于为后续继续拉齐 `IM / Agent / Skill` 铺地基：先把多实例底层语义锁稳，再继续往上收设置页和 agent 绑定
5. 校验结果
   - 已执行 `./node_modules/.bin/tsc --noEmit`
   - 已执行 `./node_modules/.bin/vitest run src/main/im/imGatewayConfigState.test.ts src/renderer/services/authSessionReset.test.ts src/renderer/services/providerRequestConfig.test.ts src/renderer/services/apiRequestHeaders.test.ts src/shared/providers/constants.test.ts`
   - 当前这轮新增改动通过编译与单测

## 本轮已完成的第十轮对齐

这轮继续补的是 Sidebar 会话切换时的过渡行为，让它和主工作台入口的加载链路保持一致，进一步降低“历史对话短暂错位/保留旧内容”的概率：

1. Sidebar 选会话时补齐 `beginLoadSession(...)`
   - 文件：`src/renderer/components/Sidebar.tsx`
   - 之前侧边栏直接 `loadSession(sessionId)`，在异步返回前可能短暂保留旧会话详情
   - 现在与 `App.tsx` 的主入口一致，先派发 `beginLoadSession(sessionId)`，再异步拉取真实 session
2. Sidebar 会话加载失败时补齐清理与提示
   - 文件：`src/renderer/components/Sidebar.tsx`
   - 如果 `loadSession(...)` 失败，当前会主动 `clearSession()`，并通过 `app:showToast` 给出 `coworkLoadSessionFailed` 提示
   - 避免会话已切换失败，但界面还残留上一条会话内容，进一步减少对话窗口“看起来像错乱”的假象
3. 说明
   - 这一轮是纯状态链路对齐，没有改动 Sidebar 的品牌结构、导航布局和青数相关功能入口
   - 属于把之前在 `App` 主入口已经有的稳定处理补到 Sidebar 本地入口，符合 KISS 和 DRY：同类入口共享同样的加载语义
4. 校验结果
   - 已执行 `./node_modules/.bin/tsc --noEmit`
   - 当前这轮新增改动通过编译

## 本轮已完成的第十一轮对齐

这轮补的是会话空态文案的实际缺口，属于“前面已接入的新空态 UI 需要的配套资源补齐”：

1. 补齐 `coworkNoSessionsHint` 中英文文案
   - 文件：`src/renderer/services/i18n.ts`
   - `CoworkSessionList` 前面已经开始使用 `coworkNoSessionsHint` 作为空态说明
   - 但当前分支的 i18n 里还没有这个 key，空态场景下会退化成直接显示 key 名称
   - 现在已补齐中英文文案，保证 sidebar 列表、搜索弹窗、历史抽屉在空态下都能正常显示说明文字
2. 说明
   - 这是典型的“UI 能力已接入，但配套资源遗漏”修补
   - 改动很小，但能把前面几轮会话列表体验优化真正收完整，避免出现明显的未翻译占位字符串
3. 校验结果
   - 已执行 `./node_modules/.bin/tsc --noEmit`
   - 当前这轮新增改动通过编译

## 补充：OpenClaw 网关启动失败兼容修复

新包启动时报 `OpenClaw 网关未能在规定时间内启动成功`，检查网关日志后确认不是品牌层或青数治理链导致，而是 `openclaw.json` 中写入了当前打包 OpenClaw runtime schema 不支持的字段：

1. 失败现象
   - 日志文件：`~/Library/Application Support/LobsterAI/openclaw/logs/gateway-2026-05-07.log`
   - 报错核心：`agents.defaults: Unrecognized key: "cwd"`
   - 配置文件：`~/Library/Application Support/LobsterAI/openclaw/state/openclaw.json`
2. 根因
   - 合入 `main` 的 workspace / cwd 解耦逻辑后，当前分支在 `agents.defaults` 下额外写入了 `cwd`
   - 当前打包 OpenClaw runtime 只接受 `workspace`，不接受 `agents.defaults.cwd`
   - `chat.send` 和 `sessions.patch` 当前也不接受 `cwd`，所以不能把该字段简单换位置继续传
3. 修复
   - 文件：`src/main/libs/openclawConfigSync.ts`
   - 处理：移除 `agents.defaults.cwd` 写入，只保留当前 schema 支持的 `agents.defaults.workspace`
   - 影响：下一次配置同步会整份重写 `openclaw.json`，历史坏字段会被自然清理
4. 后续注意
   - 如果未来 OpenClaw runtime 明确支持 cwd 解耦，再恢复对应配置
   - 在 runtime schema 未升级前，不要把 `cwd` 写入 `agents.defaults`、`chat.send` 或 `sessions.patch`

## 补充：2026-05-07 对齐最新 main 的公共能力更新

本轮先将远程 `origin/main` 拉取到本地，并确认本地 `main` 已快进到 `origin/main` 最新提交 `2e211204`。当前工作分支仍为 `front-design-merge`，没有切换到 `main` 上直接开发。

本轮选择性接入遵循以下边界：

1. 保留青数品牌、登录承接、工作台 UI、内置治理链、唤醒与 TTS 覆盖层。
2. 优先接入 `main` 的公共基础能力与稳定性修复。
3. 不对当前分支差异很大的 IM / renderer / auth 主干做整包覆盖。
4. OpenClaw 核心版本未变化，不执行卸载重装路径。

已完成的公共能力接入：

1. `OpenClaw` 网关日志轮转与日志导出增强
   - 新增文件：`src/main/libs/gatewayLogRotation.ts`
   - 新增测试：`src/main/libs/gatewayLogRotation.test.ts`
   - 更新文件：`src/main/libs/openclawEngineManager.ts`
   - 更新文件：`src/main/main.ts`
   - 具体变化：
     - 网关日志从旧的单文件 `gateway.log` 调整为按日文件 `gateway-YYYY-MM-DD.log`
     - 自动清理旧版 `gateway.log`
     - 按 3 天窗口保留最近网关日志
     - 日志导出包中加入近期网关日志
     - 日志导出包中尝试加入 OpenClaw runtime 自身的 `openclaw-YYYY-MM-DD.log`
   - 直接收益：
     - 网关频繁重启、启动失败、插件加载失败时更容易导出完整现场
     - 避免单个 `gateway.log` 长期增长，也避免新旧日志混在一起难以定位

2. Markdown 表格 / 长回复最终持久化保护
   - 更新文件：`src/main/libs/agentEngine/openclawRuntimeAdapter.ts`
   - 从 `main` 选择性接入 `pickPersistedAssistantSegment(...)` 及当前 assistant segment 的 agent-stream 权威标记。
   - 具体变化：
     - 当 `agent assistant stream` 已经为当前段提供文本时，禁止 `chat.delta` 再覆盖当前段文本
     - `chat.final` 落库时按规则选择更可靠的文本来源
     - 避免 `extractGatewayMessageText` 在多 content block 拼接时破坏 GFM 表格结构
   - 直接收益：
     - 降低 markdown 表格在回复结束后从表格变成普通 pipe 文本的概率
     - 降低长回复最终落库时被较短 final payload 覆盖的概率

3. POPO OpenClaw 插件小版本对齐
   - 更新文件：`package.json`
   - `moltbot-popo` 从 `2.1.0` 更新到 `2.1.1`
   - OpenClaw 核心仍为 `v2026.4.14`，与最新 `main` 一致，因此本轮没有卸载或重建 OpenClaw runtime。

本轮未直接接入的内容与原因：

1. `main` 的 IM 任务模型切换修复
   - 涉及 `imStore` schema、`openclawChannelSessionSync`、`openclawRuntimeAdapter`、renderer cowork 状态、模型选择器和测试文件。
   - 当前分支在 IM、多实例、青数治理和 renderer 状态上已有大量本地改动，整包贴入风险高。
   - 建议作为下一轮独立专项处理，先做 schema 兼容层，再接 renderer 状态更新。

2. `main` 的 POPO 设置页 UI 小修
   - `main` 使用 `PopoInstanceSettings.tsx`，当前分支没有同名文件，说明 UI 结构不同。
   - 本轮不为一个文案/标题栏小修强行迁移 POPO 设置 UI。

3. `main` 的任务标题展示优化
   - 该修复会牵动 `src/common/sessionTitle.ts`、`coworkUtil.ts`、`main.ts` 与 `CoworkView.tsx`。
   - 当前分支保留工作台与对话 UI 改动，暂不在本轮混入。

4. `main` 的 late run event / 模型回复后不停止修复
   - 该修复新增 `src/main/libs/agentEngine/constants.ts` 并较大幅度改动 runtime event 生命周期。
   - 与当前分支已有的网关重启、任务运行中延后重启、对话状态恢复逻辑存在耦合，建议单独接入并用长任务场景验收。

验证结果：

1. 已执行 `./node_modules/.bin/tsc --project electron-tsconfig.json --noEmit`
2. 当前新增代码通过 Electron/main TypeScript 检查

工程原则说明：

1. `KISS`：本轮没有整包覆盖高耦合模块，只接最小可验证补丁。
2. `YAGNI`：OpenClaw 核心版本未变，因此没有执行不必要的卸载重装。
3. `SOLID`：日志轮转独立成 `gatewayLogRotation.ts`，避免把文件保留策略继续塞进 engine manager。
4. `DRY`：日志路径、保留窗口、归档条目统一由 helper 生成，减少导出与写入各自拼路径。

## 补充：继续对齐 2026-05-07 main 公共运行时修复

在上一轮完成 OpenClaw 日志轮转、Markdown 表格持久化保护和 POPO 插件小版本对齐后，本轮继续从最新 `main` 中挑选不影响青数品牌、工作台 UI、内置治理链与唤醒/TTS 覆盖层的公共运行时修复。

本轮继续接入的内容：

1. late run event 防幽灵回包
   - 新增文件：`src/main/libs/agentEngine/constants.ts`
   - 更新文件：`src/main/libs/agentEngine/openclawRuntimeAdapter.ts`
   - 从 `main` 选择性接入 `AgentLifecyclePhase` 常量、生命周期 phase 归一化、`recentlyClosedRunIds` 短期记忆。
   - 具体变化：
     - 会话完成、终止或报错清理时，短期记住该 turn 的 runId
     - 晚到的 `agent/chat/assistant-stream` 事件如果属于已关闭 runId，会被直接丢弃
     - `ensureActiveTurn()` 不再因为旧 runId 晚到而重建 ghost turn
     - `bindRunIdToTurn()` 不再把已关闭 runId 绑定到新 turn 上
     - lifecycle `fallback` 事件会被忽略，避免误触发补偿路径
   - 直接收益：
     - 降低“模型回复后不停止”“停止后旧事件又把会话拉回 running”的概率
     - 降低 late gateway event 附着到下一轮用户输入的概率

2. IM channel 会话模型切换最小后端链路
   - 更新文件：`src/main/im/types.ts`
   - 更新文件：`src/main/im/imStore.ts`
   - 更新文件：`src/main/libs/openclawChannelSessionSync.ts`
   - 更新文件：`src/main/libs/agentEngine/openclawRuntimeAdapter.ts`
   - 从 `main` 的 IM 模型切换修复中抽取后端最小链路，并按当前分支 `sql.js` 存储实现重写。
   - 具体变化：
     - `im_session_mappings` 新增可迁移字段 `openclaw_session_key`
     - 新建 IM channel session mapping 时保存真实 OpenClaw sessionKey
     - 复用旧 mapping 时自动回填缺失或变化的真实 sessionKey
     - runtime 发起 `sessions.patch` 时，如果当前本地 session 属于 IM channel，会优先 patch 真实 OpenClaw channel sessionKey
   - 直接收益：
     - 降低 IM 任务中修改模型后 patch 到错误 session key 的概率
     - 为后续补 renderer 局部状态刷新和模型选择 UI 行为打基础

本轮仍未接入的内容：

1. IM 模型切换的 renderer 状态完整联动
   - `main` 同时改了 `ModelSelector`、`CoworkPromptInput`、`coworkService.patchSession` 和 `coworkSlice`
   - 当前分支工作台、输入区、唤醒输入和模型选择 UI 差异较大，本轮只先接后端真实 sessionKey 链路

2. 任务标题展示优化
   - 仍涉及 `src/common/sessionTitle.ts`、`src/main/libs/coworkUtil.ts`、`src/main/main.ts` 和 `CoworkView.tsx`
   - 这部分和当前工作台展示逻辑有关，建议下一轮单独处理

验证结果：

1. 已执行 `./node_modules/.bin/tsc --project electron-tsconfig.json --noEmit`
2. 当前新增 runtime 与 IM mapping 改动通过 Electron/main TypeScript 检查

工程原则说明：

1. `KISS`：late event 防护只通过 runId TTL map 实现，没有引入复杂状态机。
2. `YAGNI`：IM 模型切换本轮只补真实 sessionKey 后端链路，没有强行迁移 renderer UI。
3. `SOLID`：生命周期常量独立到 `agentEngine/constants.ts`，避免在多个事件入口散落字符串判断。
4. `DRY`：IM channel sessionKey 获取统一由 `OpenClawChannelSessionSync.getOpenClawSessionKeyForCoworkSession()` 提供。

## 补充：继续补齐 IM 模型切换的 renderer 局部联动

在后端已能保存并 patch 真实 OpenClaw channel sessionKey 后，本轮继续从 `main` 中选择性接入 renderer 侧的最小联动，重点保证“修改模型不打断当前激活对话”和“切换中不误发送”。

本轮接入内容：

1. `patchSession` 不再抢当前会话
   - 更新文件：`src/renderer/services/cowork.ts`
   - 具体变化：
     - `coworkService.patchSession(...)` 成功后会先检查 Redux 当前会话 ID
     - 只有 patch 的 session 仍是当前会话时，才 `setCurrentSession` 和 `setStreaming`
   - 直接收益：
     - 后台或 IM 会话 patch 模型时，不会把用户正在看的会话切走
     - 符合“当前所在激活对话不变”的体验要求

2. 当前会话 modelOverride 局部更新
   - 更新文件：`src/renderer/store/slices/coworkSlice.ts`
   - 新增 reducer：`updateCurrentSessionModelOverride`
   - 具体变化：
     - 只更新当前打开 session 的 `modelOverride`
     - 不影响 session list 和非当前会话

3. 输入框模型切换 pending 保护
   - 更新文件：`src/renderer/components/ModelSelector.tsx`
   - 更新文件：`src/renderer/components/cowork/CoworkPromptInput.tsx`
   - 具体变化：
     - `ModelSelector` 支持 `disabled`
     - session 内切换模型时先乐观更新当前会话 modelOverride
     - patch 失败时回滚到 previous modelOverride
     - patch 过程中禁用模型下拉和发送按钮
   - 直接收益：
     - 避免用户刚切模型还没落库就立刻发送，导致下一轮仍使用旧模型
     - 避免失败后 UI 显示和真实会话模型不一致

本轮刻意没有接入的部分：

1. 没有整体覆盖 `CoworkPromptInput`
   - 当前分支在输入框中有唤醒、语音听写、跟随听写、图片输入和青数工作台状态联动
   - 整体覆盖会高风险破坏唤醒/TTS 覆盖层

2. 没有引入额外 toast 文案
   - 当前分支没有完全同构 `main` 的 toast 调用路径
   - 本轮用失败回滚保证状态正确，后续如需提示可单独接入

验证结果：

1. 已执行 `npm run build`
2. renderer、main、preload 全量生产构建通过
3. 构建过程中仅有 Vite 既有 chunk warning，没有新增 TypeScript 或构建错误

工程原则说明：

1. `KISS`：只增加一个 pending 状态和一个局部 reducer，没有改输入框整体架构。
2. `YAGNI`：先解决“模型切换生效”和“不抢当前会话”，没有引入完整 toast/交互重构。
3. `SOLID`：状态局部更新放在 coworkSlice，API 成功后的当前会话判断留在 coworkService。
4. `DRY`：模型引用仍复用现有 `toOpenClawModelRef / resolveOpenClawModelRef`，没有新增一套模型格式转换。

## 本轮已完成的第八轮对齐

这轮继续补的是 `main` 最近新增的一组“低风险公共修复”，重点集中在 OpenClaw/MCP 稳定性、定时任务健壮性、以及 cowork 会话体验，不涉及青数品牌层和工作台骨架调整：

1. 定时任务 `delivery.to` 前缀截断修复
   - 文件：`src/main/ipcHandlers/scheduledTask/handlers.ts`
   - 将 `delivery.to` 去前缀逻辑从 `indexOf(':')` 改为 `lastIndexOf(':')`
   - 避免会话目标本身包含多个冒号时，被错误截断
2. Cowork 首页草稿/附件保留
   - 文件：`src/renderer/App.tsx`
   - 文件：`src/renderer/components/cowork/CoworkPromptInput.tsx`
   - 文件：`src/renderer/components/cowork/CoworkView.tsx`
   - 从具体会话返回首页或通过快捷动作切换时，不再误清空 `__home__` 草稿与附件
   - 同步补齐 `imageVisionHint` 跟随 session 草稿切换刷新
3. MCP Bridge abort 链路对齐
   - 文件：`src/main/libs/mcpBridgeServer.ts`
   - 文件：`src/main/libs/mcpServerManager.ts`
   - 正常请求不再因为 `req.close` 时序被误判为取消
   - 当网关侧已断开连接时，abort 信号会真正向 MCP 工具调用传播，避免工具继续傻等超时
4. OpenClaw 对话稳定性修复
   - 文件：`src/main/libs/agentEngine/openclawRuntimeAdapter.ts`
   - `chat.send` 超时提高到 `90s`
   - 增加慢启动告警日志
   - `syncFinalAssistantWithHistory` 改成按“当前轮边界”提取 assistant，避免 MCP 超时/手动终止后把上一轮旧回复回填到新会话轮次
5. `app_config` 变更后的网关配置更新
   - 文件：`src/main/main.ts`
   - 当前分支已改为 `app_config` 变更后允许按需重同步网关配置
   - 但对 `server-models-updated` 场景，又按最新 `main` 的后续修正收敛为“更新配置，不主动重启正在运行的 gateway”，避免登录/取模型后额外触发引擎启动观感
6. OpenClaw runtime `sharp` / `NODE_PATH` 修复
   - 文件：`scripts/prune-openclaw-runtime.cjs`
   - 文件：`src/main/libs/coworkUtil.ts`
   - 不再 stub `@img`
   - 开发态补 `vendor/openclaw-runtime/current/node_modules`
   - 打包态补 `resources/cfmind/node_modules`
   - 用于恢复 `sharp` 原生依赖解析，降低图片处理和 exec-tool 在 `.app` / 打包环境下失效的风险
7. 技能市场 CORS 修复
   - 文件：`src/main/libs/endpoints.ts`
   - 文件：`src/main/main.ts`
   - 文件：`src/main/preload.ts`
   - 文件：`src/renderer/types/electron.d.ts`
   - 文件：`src/renderer/services/skill.ts`
   - renderer 不再直接请求 skill-market，而是改走主进程代理，规避 renderer 侧 CORS 限制
8. Cowork 阅读宽度对齐 `main`
   - 文件：`src/renderer/components/cowork/CoworkView.tsx`
   - 文件：`src/renderer/components/cowork/CoworkSessionDetail.tsx`
   - 主内容区最大宽度从 `max-w-3xl` 拉齐到 `max-w-5xl`
   - 工具调用摘要去掉固定 `max-w-[400px]` 截断，更接近 `main` 当前公共阅读体验
9. 校验结果
   - 已多次执行 `npm run build`
   - 当前这轮新增改动持续通过构建

## 当前判断：仍未完全拉齐、但应后续继续推进的公共能力域

在不影响青数品牌、工作台、登录承接和内置治理链的前提下，当前仍建议后续继续按“小块可验收”方式推进的区域包括：

1. 更多 `cowork` 公共行为层小修
   - 例如更新提示策略、下载完成后的打断行为、部分对话区展示宽度/节奏细节
2. `MCP/OpenClaw` 打包与诊断剩余细节
   - 当前主干还有少量偏诊断/日志增强项可继续选择性吸收
3. 技能市场与工具市场的主进程代理链路一致性
   - 当前 skill marketplace 已补通，后续仍可继续检查与 `mcp marketplace` 在错误处理和超时策略上的一致性
4. 更大块的 IM 多实例 UI、认证主干、插件体系迁移
   - 这类仍不建议在当前脏工作区上一次性硬并
   - 更适合继续按“公共底层先收，耦合 UI 后收”的方式往前推

## 本轮已完成的第九轮对齐

这轮继续补的是 `skills` 公共管理链路的三处主干修复，目标是减少“用户自定义 skill 被误当内置”“删除 skill 时目录不存在直接报错”这类非品牌层问题：

1. 同步内置 skill 到用户目录时跳过用户自定义 skill
   - 文件：`src/main/skillManager.ts`
   - `syncBundledSkillsToUserData()` 现在会优先读取 `skills.config.json` 的 `defaults` 白名单
   - 安装目录里混入的用户自定义 skill 不再被误同步到用户目录
2. 内置 skill 判定改为优先读取 `skills.config.json`
   - 文件：`src/main/skillManager.ts`
   - `listBuiltInSkillIds()` 不再只靠目录扫描
   - 这样安装目录中的用户自建 skill 不会再被误标记成“内置 skill”
3. 删除 skill 时增加更稳的回退与静默清理
   - 文件：`src/main/skillManager.ts`
   - `deleteSkill()` 在用户目录找不到目标时，会回退检查 bundled root
   - 如果物理目录已经不存在，也不会再直接抛 “Skill not found”，而是继续清理 skill state，减少 UI 删除报错
4. 说明
   - 这轮不涉及技能市场 UI 样式，仅收敛技能目录判定与删除行为
   - 与前一轮 skill marketplace 主进程代理一起，补的是 `main` 当前技能公共层的两类高频问题：拉取失败与删除异常
5. 校验结果
   - 已执行 `npm run build`
   - 当前这轮新增改动继续通过构建

## 本轮已完成的第十轮对齐

这轮继续吸收的是两类更细颗粒度的公共层修补：技能目录治理收口，以及更新弹窗 changelog 的轻量样式对齐。

1. 技能目录治理继续向 `main` 靠拢
   - 文件：`src/main/skillManager.ts`
   - `syncBundledSkillsToUserData()` 现在按 `skills.config.json` 的 `defaults` 白名单过滤，只同步真正的内置 skill
   - `listBuiltInSkillIds()` 改为优先读取 `skills.config.json`，避免安装目录中的用户自建 skill 被误判为内置
   - `deleteSkill()` 在目标目录缺失时改为静默清理 state，并保留对 bundled root 的回退查找
2. 更新弹窗 changelog 列表样式对齐
   - 文件：`src/renderer/components/update/AppUpdateModal.tsx`
   - 为 changelog 列表补齐轻微缩进
   - 圆点样式改成与 `main` 更接近的中性小点，减少当前主色抢占
3. 说明
   - 这轮没有修改更新逻辑本身，只做了展示层的小修
   - 技能治理部分则属于行为修复，能够减少“删除 skill 报错”“用户 skill 被误判为内置”这两类公共问题
4. 校验结果
   - 已执行 `npm run build`
   - 当前这轮新增改动继续通过构建

---

## 当前分支相对 main 的主要保留能力

以下内容为本分支明确存在、且不是 `main` 当前主线默认形态的部分。这里按功能线归纳，不只按文件罗列。

## 1. 青数品牌、工作台与界面骨架

代表文件：

1. `src/renderer/App.tsx`
2. `src/renderer/components/layout/PrimarySidebar.tsx`
3. `src/renderer/components/layout/SecondarySidebar.tsx`
4. `src/renderer/components/branding/QingShuBrandMark.tsx`
5. `src/renderer/services/brandRuntime.ts`
6. `spec/features/qingshu-workbench-redesign/spec.md`

主要内容：

1. 保留了青数品牌识别与工作台式双侧栏布局。
2. 对 `Workbench`、侧边导航、品牌标识和首页视图做了定制化重构。
3. 当前分支此前已经做过一轮“尽量向 `main` 靠拢，但保留青数业务展示”的前端合并。

## 2. 青数认证链路与内置治理模块

代表文件：

1. `src/common/auth.ts`
2. `src/main/auth/adapter.ts`
3. `src/main/auth/config.ts`
4. `src/main/qingshuModules/*`
5. `src/main/qingshuManaged/catalogService.ts`
6. `src/renderer/services/auth.ts`
7. `src/renderer/components/LoginButton.tsx`
8. `src/renderer/components/LoginWelcomeOverlay.tsx`

主要内容：

1. 新增了青数侧登录认证适配层，而不是完全沿用 `main` 的通用认证主干。
2. 引入了治理链、合约生成、共享工具目录、Skill 依赖校验等青数内置治理模块。
3. 前端登录入口、欢迎层与鉴权文案也做了对应分支定制。

## 3. Skill Agent、工具包与内置 Agent 管理

代表文件：

1. `src/renderer/components/agent/AgentSettingsPanel.tsx`
2. `src/renderer/components/agent/AgentToolBundleSelector.tsx`
3. `src/renderer/components/agent/AgentToolBundleDebugSelector.tsx`
4. `src/renderer/components/agent/AgentSkillGovernancePreview.tsx`
5. `src/renderer/components/skills/QingShuGovernancePreview.tsx`
6. `src/renderer/components/skills/SkillsManager.tsx`
7. `src/main/skillManager.ts`
8. `src/main/qingshuModules/agentBundles.ts`

主要内容：

1. 分支中保留了内置 Agent、Skill Agent 管理与工具包治理相关能力。
2. Agent 草稿持久化、工具包兼容提示、调试面板、只读治理预览等都是当前分支附加内容。
3. 这部分与 `main` 的通用 Agent 管理体系存在明显分叉，是后续继续并 `main` 时最需要谨慎处理的区域之一。

## 4. 本地语音、唤醒、TTS/STT 后处理能力

代表文件：

1. `resources/macos-speech/MacSpeechHelper.swift`
2. `resources/macos-speech/MacTtsHelper.swift`
3. `src/main/libs/macSpeechService.ts`
4. `src/main/libs/macTtsService.ts`
5. `src/main/libs/edgeTtsService.ts`
6. `src/main/libs/ttsRouterService.ts`
7. `src/main/libs/wakeInputService.ts`
8. `src/renderer/services/voiceTextPostProcess.ts`
9. `src/shared/speech/constants.ts`
10. `src/shared/tts/constants.ts`
11. `src/shared/wakeInput/constants.ts`

主要内容：

1. 当前分支额外保留了本地 `macOS` 语音助手、TTS 助手和语音恢复逻辑。
2. 包含唤醒输入、唤醒后追问、STT/TTS 文本后处理、Edge TTS 路由等能力。
3. 这条能力线是当前分支比 `main` 更业务化的一部分，不属于简单 UI 差异。

## 5. 对话展示、工作台交互与附件能力

代表文件：

1. `src/renderer/components/cowork/CoworkView.tsx`
2. `src/renderer/components/cowork/CoworkSessionDetail.tsx`
3. `src/renderer/components/cowork/AttachmentCard.tsx`
4. `src/renderer/components/cowork/ConversationHistoryDrawer.tsx`
5. `src/renderer/components/cowork/agentModelSelection.ts`
6. `src/renderer/store/selectors/coworkSelectors.ts`
7. `src/main/coworkStore.ts`

主要内容：

1. 当前分支对对话页、历史抽屉、附件卡片、模型选择和工作台欢迎态做过较深改造。
2. 其中一部分是此前为了“让对话信息展示逻辑更贴近 `main`”做的中间对齐结果。
3. 但从今天的工作区未提交内容看，这块还在继续收口，说明该区域仍是高频调整点。

## 6. OpenClaw 运行时、打包脚本与插件适配补丁

代表文件：

1. `package.json`
2. `electron-builder.json`
3. `scripts/build-openclaw-runtime.sh`
4. `scripts/electron-builder-hooks.cjs`
5. `scripts/ensure-openclaw-plugins.cjs`
6. `scripts/install-openclaw-channel-deps.cjs`
7. `scripts/openclaw-runtime-packaging.cjs`
8. `scripts/patches/v2026.4.8/*`
9. `src/main/libs/openclawConfigSync.ts`
10. `src/main/libs/openclawEngineManager.ts`
11. `src/main/libs/mcpLog.ts`

主要内容：

1. 当前分支保留了一整套本地化的 `OpenClaw` 运行时补丁和打包脚本。
2. 包括插件依赖安装、运行时裁剪、补丁编译、网关入口兼容与配置同步等。
3. 这部分很多内容是“从 `main` 回抄后再按当前分支需要做了二次定制”，不是原样跟随。

## 7. 仓库治理、提交前检查与内部文档沉淀

代表文件：

1. `.githooks/*`
2. `.github/workflows/*`
3. `scripts/check-precommit.cjs`
4. `security-audit-checklist.md`
5. `0419更新.md`
6. `0420认证与skill agent管理.md`
7. `QingShuClaw架构梳理.md`
8. `qingshu-skill-tool-agent-faq.md`

主要内容：

1. 当前分支额外沉淀了多份内部说明文档、治理说明和变更记录。
2. 增加了 `githook`、提交校验、CI/workflow 级别的仓库治理能力。
3. 这些内容有助于后续继续并 `main`，但它们本身也会放大与 `main` 的差异面。

---

## 当前分支相对 main 的文件级统计

从共同基线到当前分支的文件状态分布：

1. 新增文件 `188`
2. 修改文件 `110`
3. 代表当前分支更像“在旧基线上叠加业务能力”的演进形态，而不是轻量主题分支

按目录粗看，当前分支差异主要集中在：

1. `src/main/libs/`
2. `src/main/qingshuModules/`
3. `src/renderer/services/`
4. `src/renderer/components/agent/`
5. `src/renderer/components/cowork/`
6. `src/renderer/components/im/`
7. `scripts/`
8. `docs/`

---

## main 已有但当前分支仍未完全拉齐的区域

这部分基于本次重新扫描 `origin/main...front-design-merge` 的差异重新整理。这里列的是“`main` 已具备、当前分支仍未完全拉齐的公共能力域”，不包含刻意保留的青数品牌、工作台外壳与内置治理链差异。

## 1. OpenClaw / MCP / Runtime 主干仍是最大差异区

仍未完全拉齐的主线内容主要集中在这些文件族：

1. `src/main/libs/openclawConfigSync.ts`
2. `src/main/libs/openclawEngineManager.ts`
3. `src/main/libs/agentEngine/openclawRuntimeAdapter.ts`
4. `src/main/libs/mcpBridgeServer.ts`
5. `src/main/libs/mcpServerManager.ts`
6. `src/main/libs/openclawTranscript.ts`
7. `src/main/openclawSessionPolicy/`
8. `scripts/build-openclaw-runtime.sh`
9. `scripts/ensure-openclaw-plugins.cjs`
10. `scripts/patches/v2026.4.8/`
11. `package.json`
12. `electron-builder.json`

`main` 已有但当前分支仍未完全收平的点包括：

1. `OpenClaw runtime` 打包、补丁注入、平台兼容和产物裁剪链路还有较大差异
2. `gateway / session patch / keepalive policy / transcript` 这条主线虽然已接入一部分，但实现和测试覆盖还没有完全追平
3. `MCP bridge / server manager / preload` 的生命周期广播、诊断日志、配置变更后的重启行为仍有剩余差异
4. 这块同时牵扯构建脚本、主进程 runtime 管理和协议桥，后续仍然是最高冲突风险区

## 2. 认证主干与 Provider 注册表还没有完全跟上 main

仍未完全拉齐的主线内容主要集中在这些文件族：

1. `src/common/auth.ts`
2. `src/main/auth/adapter.ts`
3. `src/main/auth/config.ts`
4. `src/renderer/services/auth.ts`
5. `src/renderer/services/api.ts`
6. `src/renderer/components/LoginButton.tsx`
7. `src/renderer/components/LoginWelcomeOverlay.tsx`
8. `src/renderer/components/Settings.tsx`
9. `src/shared/providers/constants.ts`
10. `src/shared/providers/index.ts`
11. `src/main/libs/githubCopilotAuth.ts`
12. `src/main/libs/copilotTokenManager.ts`

`main` 已有但当前分支仍未完全收平的点包括：

1. `portal/deep-link/refresh token` 认证主干和登录容错细节仍未与 `main` 完全一致
2. `Provider Registry` 虽然已经开始对齐，但 `provider metadata / api key 入口 / 图标 / runtime id` 还没有全部收平
3. `GitHub Copilot` 认证、token 管理和 provider 展示链已经有基础，但仍属于“已迁入主干骨架、未完全等同 main”的状态
4. 当前分支保留了青数登录与品牌层，这部分不能机械覆盖，但公共认证与 provider 配置层仍值得继续对齐

## 3. IM 多实例与 Agent/Skill 治理链还有剩余差异

仍未完全拉齐的主线内容主要集中在这些文件族：

1. `src/main/im/imGatewayManager.ts`
2. `src/main/im/imStore.ts`
3. `src/main/im/types.ts`
4. `src/renderer/components/im/IMSettingsMain.tsx`
5. `src/renderer/components/im/*InstanceSettings.tsx`
6. `src/renderer/services/im.ts`
7. `src/renderer/store/slices/imSlice.ts`
8. `src/renderer/components/agent/AgentCreateModal.tsx`
9. `src/renderer/components/agent/AgentSettingsPanel.tsx`
10. `src/renderer/components/agent/AgentToolBundleSelector.tsx`
11. `src/renderer/components/skills/SkillsManager.tsx`
12. `src/main/qingshuModules/`

`main` 已有但当前分支仍未完全收平的点包括：

1. 多实例 IM 的主进程存储、连接测试、默认值和状态同步虽然已经大体迁入，但边角行为仍未全部统一
2. Agent 创建/编辑弹窗与 IM 绑定逻辑仍有一部分历史业务分支写法，没有完全退到 `main` 的公共 UI 形态
3. Tool bundle、技能治理预览、依赖校验和只读调试提示这条链路虽然已引入，但和 `main` 仍有继续收口空间
4. 这块后续要继续对齐时，建议按“主进程 IM store/gateway → 渲染层设置页 → Agent/Skill 绑定 UI”的顺序推进

## 4. Cowork 对话展示、语音唤醒与运行记录链仍是第二高风险区

仍未完全拉齐的主线内容主要集中在这些文件族：

1. `src/renderer/components/cowork/CoworkSessionDetail.tsx`
2. `src/renderer/components/cowork/CoworkPromptInput.tsx`
3. `src/renderer/components/cowork/CoworkView.tsx`
4. `src/renderer/components/cowork/CoworkSessionItem.tsx`
5. `src/renderer/components/cowork/CoworkSessionList.tsx`
6. `src/renderer/App.tsx`
7. `src/renderer/components/Sidebar.tsx`
8. `src/renderer/components/scheduledTasks/RunSessionModal.tsx`
9. `src/renderer/components/scheduledTasks/TaskList.tsx`
10. `src/renderer/services/cowork.ts`
11. `src/renderer/store/slices/coworkSlice.ts`
12. `src/main/libs/wakeInputService.ts`
13. `src/main/libs/edgeTtsService.ts`
14. `src/main/libs/macSpeechService.ts`
15. `src/main/libs/macTtsService.ts`
16. `src/main/libs/ttsRouterService.ts`

`main` 已有但当前分支仍未完全收平的点包括：

1. 会话级 loading、错误链、模型覆盖、history turn 组装这几项公共逻辑已经补了多轮，但展示层和交互节奏还没有彻底收平
2. `RunSessionModal / AllRunsHistory / TaskList` 这些运行记录和定时任务入口与 `main` 还有可见差异
3. 语音转写、TTS、唤醒输入和桌面 overlay 主线能力已经在当前分支存在，但与 `main` 的最新实现还没有完全同构
4. 当前分支对对话区视觉做了主动定制，这块后续需要坚持“保留品牌壳层，只收公共行为”的方式继续推进

## 5. 工程化、测试和提交流程仍落后于 main

仍未完全拉齐的主线内容主要集中在这些文件族：

1. `.github/workflows/`
2. `.github/ISSUE_TEMPLATE/`
3. `.githooks/`
4. `commitlint.config.mjs`
5. `.editorconfig`
6. `.prettierrc`
7. `.prettierignore`
8. `scripts/check-precommit.cjs`
9. `src/main/**/*.test.ts`
10. `src/renderer/**/*.test.ts`

`main` 已有但当前分支仍未完全收平的点包括：

1. `CI / security / labeler / build verification` 工作流与 `main` 差异很大
2. 当前分支已有自己的 `gitignore`、pre-commit 检查和敏感信息审计方案，但 hook 布局和 `main` 仍不一致
3. 针对 `OpenClaw / auth / IM / voice / governance` 的主线测试覆盖这边还在补过程里，没有全面追平
4. 如果目标是后续更平滑地继续跟 `main`，工程化与测试入口统一仍然值得优先做

## 重新扫描后的判断

1. 故意保留的差异主要还是青数品牌、工作台外壳、青数内置治理链和部分登录承接层，这些不应视为“缺失功能”
2. 真正还没完全拉齐的公共能力域，优先级从高到低仍然建议是：
   - `OpenClaw / MCP / Runtime`
   - `认证 / Provider / Copilot`
   - `IM 多实例 / Agent / Skill 治理`
   - `Cowork 展示 / 语音 / 运行记录`
   - `工程化 / 测试 / CI`
3. 相比上一次扫描，`Cowork` 的公共状态链已经明显更接近 `main`，但展示层与外围入口仍然是剩余差异最多的一段
4. 如果后续继续推进，最适合的策略仍是“按能力域分批收敛”，不要再尝试一次性大 merge

---

## 当前工作区未提交改动

本次扫描结束后，工作区存在 `23` 个未提交修改项，其中：

1. `16` 个是此前已经存在的 UI/交互收口改动
2. `3` 个是本轮新加入的公共层对齐改动：
   - `src/main/libs/mcpServerManager.ts`
   - `src/main/main.ts`
   - `src/main/preload.ts`
3. `2` 个是本轮新增的 `Provider/Settings` 对齐改动：
   - `src/renderer/components/Settings.tsx`
   - `src/shared/providers/constants.ts`
4. `src/renderer/services/i18n.ts` 原本就在工作区修改列表中，本轮继续叠加了 provider 入口文案补充
5. `2` 个是本轮新增的 `IM` 公共层对齐改动：
   - `src/main/im/imGatewayManager.ts`
   - `src/main/i18n.ts`

## 1. 品牌与侧栏视觉继续收口

涉及文件：

1. `src/renderer/theme/css/themes.css`
2. `src/renderer/components/Sidebar.tsx`
3. `src/renderer/components/layout/PrimarySidebar.tsx`
4. `src/renderer/components/layout/SecondarySidebar.tsx`
5. `src/renderer/components/LoginButton.tsx`
6. `src/renderer/components/agent/AgentsView.tsx`

本轮未提交改动主要表现为：

1. 主色从蓝色继续切向绿色系
2. 侧栏背景、边框和激活态改成更轻量的白底/浅边框样式
3. Agent 列表图标容器、登录按钮、工作台入口卡片继续做减法
4. “对话”页 Agent 列表的边框与尺寸明显在往更轻更紧凑的方向收

## 2. 对话窗口历史信息展示逻辑仍在重写

涉及文件：

1. `src/renderer/components/cowork/CoworkPromptInput.tsx`
2. `src/renderer/components/cowork/CoworkSessionDetail.tsx`
3. `src/renderer/components/cowork/CoworkSessionItem.tsx`
4. `src/renderer/components/cowork/CoworkView.tsx`

本轮未提交改动主要表现为：

1. 用户消息和助手消息都引入了新的头像、悬浮操作和块级布局
2. `system/error` 消息从直接展开改成可折叠块
3. 对话滚动区底部新增输入区覆盖层和渐变遮罩
4. 顶栏改成半透明毛玻璃样式
5. 欢迎态标题文案和视觉节奏继续调整

说明：

1. 这一组修改与“历史对话信息在窗口中的展示逻辑”直接相关。
2. 由于它们还未提交，所以当前分支的正式状态和工作区展示状态并不完全相同。

## 3. 定时任务与快捷操作区在做高密度列表化

涉及文件：

1. `src/renderer/components/scheduledTasks/AllRunsHistory.tsx`
2. `src/renderer/components/scheduledTasks/ScheduledTasksView.tsx`
3. `src/renderer/components/scheduledTasks/TaskList.tsx`
4. `src/renderer/components/quick-actions/QuickActionBar.tsx`
5. `src/renderer/services/i18n.ts`

本轮未提交改动主要表现为：

1. 任务列表从大卡片改成更密集的信息行布局
2. 运行历史新增更显式的状态图标、时长展示和紧凑 badge
3. 选项卡与按钮尺寸做了统一收敛
4. 文案中把 `Agent List` 调整成了 `Manage Agents`

## 4. 桌面窗口细节微调

涉及文件：

1. `src/main/main.ts`

本轮未提交改动主要表现为：

1. `macOS` 窗口 `trafficLightPosition` 从 `{ x: 12, y: 20 }` 调整为 `{ x: 16, y: 16 }`

## 5. 本轮新增的公共层拉齐改动

涉及文件：

1. `src/main/libs/mcpServerManager.ts`
2. `src/main/main.ts`
3. `src/main/preload.ts`

本轮未提交改动主要表现为：

1. 为 MCP 同步流程补上前后态事件广播，方便渲染层显示同步遮罩和完成结果
2. 对齐 `main` 的一部分 MCP 诊断能力，增强 server 启动和 tool 调用日志
3. 保持当前分支的本地 managed tool runtime 不被误删，采用“择优移植”而不是整文件覆盖

## 6. 本轮新增的 Provider/Settings 拉齐改动

涉及文件：

1. `src/renderer/components/Settings.tsx`
2. `src/shared/providers/constants.ts`
3. `src/renderer/services/i18n.ts`

本轮未提交改动主要表现为：

1. 设置页 provider 头部新增官网入口，便于跳转到官方控制台
2. API Key 输入区新增“获取 API Key”入口，特别补齐了 `Qianfan` 这类此前缺少直达入口的 provider
3. `ProviderRegistry` 中原本预留但未完整落地的 `website/apiKeyUrl` 元数据已实际接入 UI
4. 这组变更属于设置页通用能力增强，不改变当前分支的品牌骨架和工作台布局

## 7. 本轮新增的 IM 公共层拉齐改动

涉及文件：

1. `src/main/im/imGatewayManager.ts`
2. `src/main/i18n.ts`

本轮未提交改动主要表现为：

1. `Feishu / DingTalk / WeCom / QQ` 的连通性测试优先选取“已启用且配置完整”的实例，减少多实例场景下误测
2. `QQ` 连接测试补齐了更具体的错误提示与修复建议，和 `main` 的通用行为更接近
3. 微信扫码等待结果与 POPO 扫码完成通知日志更易排障
4. 这组改动属于主进程公共逻辑修补，不改变当前分支的青数品牌和工作台展示

---

## 现状判断

1. 当前分支已经承载大量业务定制，不适合再按“直接 merge 一次 main 就结束”的方式维护。
2. 如果后续目标是继续长期跟 `main`，建议采用“按能力域逐块收敛”的方式：
   - `OpenClaw/MCP`
   - `IM`
   - `Cowork`
   - `Provider/Settings`
   - `工程化与测试`
3. 仅从本次扫描结果看，当前分支距离“下次 main 更新可无缝接入”仍有差距。
4. 若要降低后续冲突，优先建议先把今天这 `16` 个 UI 收口改动、`3` 个 MCP 公共层对齐改动、`2` 个 Provider/Settings 对齐改动以及 `2` 个 IM 公共层对齐改动分组整理提交，再继续做下一轮主线对齐。

## 本轮已完成的第十九轮对齐

这轮回到 `Skill` 公共能力域，补的是当前分支相对 `main` 已断开的“远程导入入口 + 对话创建入口”链路，同时保留当前分支已有的青数治理预览与工作台壳层：

1. 恢复 Skill 远程导入的双来源入口
   - 文件：`src/renderer/components/skills/SkillsManager.tsx`
   - 新增 `GitHub / ClawHub` 双 tab 的远程导入弹窗
   - 添加入口文案从“仅 GitHub 导入”恢复为 `remoteImport`
   - 保留当前分支已有的本地上传、治理分析预览等能力，不做覆盖式回退
2. 抽离远程导入来源校验 helper 并补单测
   - 文件：`src/renderer/components/skills/skillImportSource.ts`
   - 文件：`src/renderer/components/skills/skillImportSource.test.ts`
   - 新增 `validateSkillImportSource(...)`
   - `GitHub` 导入继续允许 `owner/repo` 简写
   - `ClawHub` 导入要求 `clawhub.ai` 域名，避免把错误来源直接喂给下载流程
3. 补回“通过对话创建 skill”公共链路
   - 文件：`src/renderer/components/skills/SkillsManager.tsx`
   - 文件：`src/renderer/components/skills/SkillsView.tsx`
   - 文件：`src/renderer/App.tsx`
   - 重新接回 `onCreateSkillByChat`
   - 当 `skill-creator` 未安装或未启用时，行为与 `main` 对齐：自动切换到对应 tab 并给出 toast 提示
   - 当能力可用时，会把 `skillCreatorPrompt` 写入 cowork 草稿并切回对话工作区
4. 补齐配套中英文文案
   - 文件：`src/renderer/services/i18n.ts`
   - 补充：
     - `remoteImport / remoteImportTitle`
     - `createSkillByChat`
     - `skillCreatorPrompt`
     - `skillCreatorNotInstalled / skillCreatorNotEnabled`
     - `githubTabLabel`
     - `clawhubTabLabel` 及相关描述、占位、来源校验报错文案
5. 说明
   - 这轮是 `Skill` 页公共入口能力的回补，不触碰青数品牌、工作台外壳和青数治理链展示
   - 仍然遵循“小步收口”策略：优先恢复 `main` 已稳定存在的公共能力，再与当前分支的治理增强并存
6. 校验结果
   - 已执行 `./node_modules/.bin/tsc --noEmit`
   - 已执行 `./node_modules/.bin/vitest run src/renderer/components/skills/skillImportSource.test.ts`
   - 当前这轮新增改动通过编译与单测

## 本轮已完成的第二十轮对齐

这轮继续收 `Agent / Skill` 的公共行为语义，把分散在多个界面里的“青数内置对象访问状态”判断统一到一层 renderer helper 上，减少后续继续拉齐 `main` 时的行为分叉：

1. 抽离 renderer 侧青数内置访问展示 helper
   - 文件：`src/renderer/services/qingshuManagedUi.ts`
   - 文件：`src/renderer/services/qingshuManagedUi.test.ts`
   - 新增：
     - `resolveQingShuSourceLabelKey(...)`
     - `resolveQingShuManagedAccessPresentation(...)`
   - 统一输出：
     - 来源标签 key
     - 锁定态判断
     - 锁定 tag key
     - 锁定 hint key / policy override
2. `SkillsManager` 统一复用访问展示语义
   - 文件：`src/renderer/components/skills/SkillsManager.tsx`
   - 原本这里手写了 `qingshu-managed + 登录态 + allowed` 的多处判断
   - 现在统一走 `resolveQingShuManagedAccessPresentation(...)`
   - `managed available / locked` 统计、筛选、开关禁用、锁定文案都改成单一语义来源
   - 同时把来源标签映射改成走 `resolveQingShuSourceLabelKey(...)`
3. `AgentSkillSelector / AgentsView / AgentSettingsPanel` 对齐相同语义
   - 文件：`src/renderer/components/agent/AgentSkillSelector.tsx`
   - 文件：`src/renderer/components/agent/AgentsView.tsx`
   - 文件：`src/renderer/components/agent/AgentSettingsPanel.tsx`
   - `AgentSkillSelector` 改为复用共享来源标签映射，并通过共享 managed source 判断过滤青数内置 skill
   - `AgentsView` 的 managed agent 可用/锁定分组与锁定 badge 改成走统一访问语义
   - `AgentSettingsPanel` 的 managed 只读 agent、managed skill、managed tool 的锁定 tag / hint 与来源标签改成走统一 helper
4. 说明
   - 这轮没有改动品牌视觉、工作台结构、青数治理链展示，只是在 UI 层把访问控制语义收敛成单一来源
   - 这属于典型的 DRY/KISS 收口：后续再继续拉齐 `main` 的 managed agent / managed skill 公共能力时，不必再逐处修同一套判断
5. 校验结果
   - 已执行 `./node_modules/.bin/tsc --noEmit`
   - 已执行 `./node_modules/.bin/vitest run src/renderer/services/qingshuManagedUi.test.ts src/renderer/components/skills/skillImportSource.test.ts`
   - 当前这轮新增改动通过编译与单测

## 本轮已完成的第二十一轮对齐

这轮回到 `Agent IM 绑定` 这条公共能力链，把新建弹窗和设置面板里原本不一致的 IM 可绑定判断与绑定持久化语义统一起来，重点补齐 `main` 已有的多实例 IM 适配：

1. 抽离 Agent IM binding 公共 helper
   - 文件：`src/renderer/components/agent/agentImBindingConfig.ts`
   - 文件：`src/renderer/components/agent/agentImBindingConfig.test.ts`
   - 新增：
     - `normalizeAgentImBindingPlatform(...)`
     - `isAgentImBindingPlatformConfigured(...)`
     - `collectAgentBoundPlatforms(...)`
     - `buildAgentPlatformBindings(...)`
   - 统一处理：
     - 多实例平台 `dingtalk / feishu / qq / wecom` 的启用判断
     - `xiaomifeng -> netease-bee` 历史 alias 兼容
     - 绑定读取与保存时的标准 key 归一化
2. `AgentCreateModal` 对齐多实例 IM 绑定语义
   - 文件：`src/renderer/components/agent/AgentCreateModal.tsx`
   - 新建弹窗里原本还在用单实例 `enabled` 判断，导致多实例平台即使已配置也可能显示为“未配置”
   - 现在改成复用共享 helper，行为与设置面板保持一致
   - 同时把平台列表里的 `xiaomifeng` 显式切到标准 key `netease-bee`，避免被区域过滤遗漏
   - 创建 agent 后保存绑定时也统一走标准 key，修复旧 alias 写回错误配置键的风险
3. `AgentSettingsPanel` 收口绑定读取与保存逻辑
   - 文件：`src/renderer/components/agent/AgentSettingsPanel.tsx`
   - 之前这里已经补了多实例启用判断，但绑定读取和保存还是各写一套内联逻辑
   - 现在初始化时通过 `collectAgentBoundPlatforms(...)` 回填绑定平台
   - 保存时通过 `buildAgentPlatformBindings(...)` 统一清理旧绑定并写入新绑定
   - 这样 `create / settings` 两条入口的 IM 绑定语义终于对齐到同一层
4. 说明
   - 这轮属于典型的公共行为层拉齐，不动工作台壳层和青数品牌展示
   - 直接收益是：多实例 IM 的公共能力在新建 agent 和编辑 agent 两个入口上不再“一个是新逻辑、一个是旧逻辑”
5. 校验结果
   - 已执行 `./node_modules/.bin/tsc --noEmit`
   - 已执行 `./node_modules/.bin/vitest run src/renderer/components/agent/agentImBindingConfig.test.ts src/renderer/services/qingshuManagedUi.test.ts src/renderer/components/skills/skillImportSource.test.ts`
   - 当前这轮新增改动通过编译与单测

## 本轮已完成的第二十二轮对齐

这轮继续把 `AgentCreateModal` 往 `main` 的公共平台注册表语义上收，目标是消掉新建弹窗里那份独立维护的 IM 平台清单，避免后续平台增删时再次分叉：

1. `AgentCreateModal` 切到 `PlatformRegistry`
   - 文件：`src/renderer/components/agent/AgentCreateModal.tsx`
   - 原本新建弹窗维护了一份手写 `IM_PLATFORMS` 数组，logo、平台顺序和可见平台过滤都依赖本地硬编码
   - 现在改成直接复用 `PlatformRegistry.platforms` 与 `PlatformRegistry.logo(...)`
   - 这样平台顺序、logo 文件名和区域平台定义与设置页、主配置页保持同一来源
2. 新建弹窗内部绑定平台类型与设置面板对齐
   - 文件：`src/renderer/components/agent/AgentCreateModal.tsx`
   - `boundPlatforms` 从旧的 `IMPlatform` 收到 `Platform`
   - `handleToggleIMBinding(...)` / `isPlatformConfigured(...)` 也统一到 `Platform`
   - 这样 `AgentCreateModal` 和 `AgentSettingsPanel` 在 IM 平台这层终于对齐到同一套平台类型体系
3. 说明
   - 这轮改动不涉及 UI 视觉重做，只是把平台注册表语义收回到共享 registry
   - 直接收益是：后面如果 `main` 再调整 IM 平台定义、logo 或区域分组，新建弹窗不会再因为保留旧数组而单独掉队
4. 校验结果
   - 已执行 `./node_modules/.bin/tsc --noEmit`
   - 已执行 `./node_modules/.bin/vitest run src/renderer/components/agent/agentImBindingConfig.test.ts src/renderer/services/qingshuManagedUi.test.ts src/renderer/components/skills/skillImportSource.test.ts`
   - 当前这轮新增改动通过编译与单测

## 本轮已完成的第二十三轮对齐

这轮继续收 `AgentCreateModal / AgentSettingsPanel` 之间剩下的一小段“未保存状态 / 保存触发条件”漂移，把 create/edit 两条入口的 persisted 语义再往 `main` 主线收一步：

1. 抽离 Agent draft-state 公共 helper
   - 文件：`src/renderer/components/agent/agentDraftState.ts`
   - 文件：`src/renderer/components/agent/agentDraftState.test.ts`
   - 新增：
     - `hasCreateAgentDraftChanges(...)`
     - `hasOrderedSelectionChanges(...)`
     - `hasPlatformBindingChanges(...)`
   - 统一处理：
     - 文本字段按持久化前 `trim()` 后再比较
     - 选择型字段的有序变更判断
     - IM 绑定集合的统一比较
2. `AgentCreateModal` 未保存判断改成只看会真正持久化的内容
   - 文件：`src/renderer/components/agent/AgentCreateModal.tsx`
   - 原本新建弹窗把 `debugToolBundleIds` 也算进 `isDirty`
   - 但 debug tool bundle 只是本地调试态，并不会跟随 `buildPersistedCreateAgentRequest(...)` 写入 agent
   - 现在改成复用 `hasCreateAgentDraftChanges(...)`，只看：
     - 基础文本字段
     - `skillIds`
     - `toolBundleIds`
     - `boundPlatforms`
   - 这样关闭弹窗时的“未保存修改”提示终于和真实落盘内容一致
3. `AgentSettingsPanel` 统一复用有序选择与绑定变更判断
   - 文件：`src/renderer/components/agent/AgentSettingsPanel.tsx`
   - 基础文本字段、`skillIds`、`toolBundleIds`、`boundPlatforms` 的 dirty 判断，统一改成复用 `hasCreateAgentDraftChanges(...)`
   - 这样设置面板也会按真实持久化语义比较文本字段，避免只改了首尾空白却被误判成“未保存修改”
   - `managedExtraSkillIds` 的 dirty 判断，不再单独手写数组比较
   - `boundPlatforms` 与 `initialBoundPlatforms` 的 dirty/save 判断，也统一改成 `hasPlatformBindingChanges(...)`
   - 这样设置面板里的“是否有修改”和“是否需要保存 IM 绑定”终于走同一套语义，减少后续继续拉齐时的分叉点
4. 说明
   - 这轮仍然是公共行为层收口，不改品牌视觉、不动工作台骨架，也不触碰青数内置治理链
   - 重点是把 create/edit 两条 agent 配置入口的 persisted 语义对齐，属于典型的 DRY/KISS 修正

## 本轮已完成的第二十四轮对齐

这轮转到 `OpenClaw` 主进程公共层，补的是当前分支相对 `main` 还没完全收进来的“agent 模型解析与 managed session 模型迁移”链路，目标是在不改青数品牌和工作台 UI 的前提下，把 agent-model 主线再往 `main` 靠一段：

1. 抽离 `openclawAgentModels` 公共 helper
   - 文件：`src/main/libs/openclawAgentModels.ts`
   - 文件：`src/main/libs/openclawAgentModels.test.ts`
   - 新增：
     - `parsePrimaryModelRef(...)`
     - `resolveManagedSessionModelTarget(...)`
     - `resolveQualifiedAgentModelRef(...)`
     - `buildAgentEntry(...)`
     - `buildManagedAgentEntries(...)`
   - 统一处理：
     - `provider/model` 形式主模型解析
     - 裸 `modelId` 在 provider catalog 中的补全与歧义判断
     - `main / 非 main agent` 写入 `OpenClaw agents.list` 时的 `model.primary` 生成
2. `openclawConfigSync` 给所有 agent 下发显式 `model.primary`
   - 文件：`src/main/libs/openclawConfigSync.ts`
   - 原本当前分支的 `buildAgentsList()` 只给 `main` agent 写一个极简条目，非 `main` agent 只带 `identity / skills`，没有显式模型
   - 现在改成复用 `buildAgentEntry(...) / buildManagedAgentEntries(...)`
   - 这样：
     - `main` agent 会显式带上默认 primary model
     - 非 `main` agent 也会带上自己的 primary model
     - 当提供 `stateDir` 时，非 `main` agent 还会显式落到 `workspace-{agentId}`，与主线结构保持一致
3. managed session store 的模型迁移扩到所有 agent
   - 文件：`src/main/libs/openclawConfigSync.ts`
   - 原本 `syncManagedSessionStore(...)` 只会处理 `main` agent 的 `sessions.json`，并且只覆盖一种旧的 `lobster -> provider` 迁移路径
   - 现在改成：
     - 遍历 `main + 所有已配置 agent` 的 session store
     - 继续保留 IM session 的 `execSecurity=full` 和禁用 skill 快照清理
     - 对 `agent:*:lobsterai:*` 会话，按 `resolveQualifiedAgentModelRef(...) + resolveManagedSessionModelTarget(...)` 统一对齐目标 provider/model
     - 遇到裸 `modelId` 命中多个 provider 的歧义场景，会写 warning，但不会强行误改
   - 直接收益是：agent 独立模型设置在 `OpenClaw` 的 managed session 侧终于更接近 `main` 的真实行为
4. 说明
   - 这轮属于典型的主进程公共层收口，不涉及品牌视觉、工作台外壳和青数治理 UI
   - 重点是把 “agent 模型配置 -> OpenClaw managed config -> session store 模型迁移” 这条主线从散落实现收成和 `main` 更接近的一层
5. 校验结果
   - 已执行 `./node_modules/.bin/vitest run src/main/libs/openclawAgentModels.test.ts`
   - 已执行 `./node_modules/.bin/tsc --noEmit`
   - 当前这轮新增改动通过单测与编译

## 第二十四轮后的补充扫描

本节基于当前状态再次扫描：

1. 当前分支：`front-design-merge`（`HEAD = 3d499f6`）
2. 对比分支：`origin/main`（`5099943`）
3. 本次关注的是“`main` 已有、当前分支仍未完全拉齐的公共能力域”
4. 青数品牌、工作台外壳、青数内置治理链与其承接层差异，仍按“刻意保留”处理，不计入缺失能力

### 重新扫描后的结论

1. 从差异覆盖面看，当前剩余最大的公共能力域已经变成：
   - `IM / Agent / Skill`：约 `53` 个相关文件仍有主线差异
   - `OpenClaw / MCP / Runtime`：约 `35` 个相关文件仍有主线差异
   - `Cowork / Speech / ScheduledTasks`：约 `30` 个相关文件仍有主线差异
   - `认证 / Provider / Copilot`：约 `21` 个相关文件仍有主线差异
2. 从冲突风险看，优先级仍然不是简单按文件数排序：
   - 风险最高仍是 `OpenClaw / MCP / Runtime`
   - 覆盖面最广的是 `IM / Agent / Skill`
   - 最容易继续以“小步可验收”方式推进的，仍是 `IM / Agent / Skill` 与 `Cowork` 公共行为层
3. 相比上一轮扫描，`OpenClaw agent model` 这条主线已经明显向 `main` 收平：
   - `openclawAgentModels` helper 已补齐
   - `openclawConfigSync` 的 `agent model.primary` 下发已补齐
   - managed session store 的多 agent 模型迁移已补齐
4. 但这还不意味着 `OpenClaw` 主干已收平，后面仍有 runtime / keepalive / transcript / gateway 生命周期等大片差异

### 1. OpenClaw / MCP / Runtime 仍是最高风险区

当前仍未完全拉齐的主线内容主要集中在这些文件族：

1. `src/main/libs/openclawEngineManager.ts`
2. `src/main/libs/agentEngine/openclawRuntimeAdapter.ts`
3. `src/main/libs/agentEngine/coworkEngineRouter.ts`
4. `src/main/libs/mcpServerManager.ts`
5. `src/main/libs/openclawTranscript.ts`
6. `src/main/libs/coworkOpenAICompatProxy.ts`
7. `src/main/openclawSessionPolicy/`
8. `src/main/openclawSession/`
9. `src/main/preload.ts`
10. `src/main/main.ts`

当前仍未完全收平的点包括：

1. `runtime` 安装、启动、重启、故障恢复和产物裁剪链路还没有完全追平 `main`
2. `session patch / keepalive policy / transcript` 这条链虽然已经补了一部分，但生命周期和测试面还不完整
3. `MCP bridge / server manager / preload` 的广播、重载、诊断日志与错误恢复仍有剩余差异
4. 这块仍然是“改一处会影响主进程运行时”的高风险区域，后续继续推进要坚持小步验证

### 2. 认证 / Provider / Copilot 仍有明显剩余差异

当前仍未完全拉齐的主线内容主要集中在这些文件族：

1. `src/main/auth/adapter.ts`
2. `src/main/auth/config.ts`
3. `src/renderer/services/auth.ts`
4. `src/renderer/services/api.ts`
5. `src/renderer/components/LoginButton.tsx`
6. `src/renderer/components/LoginWelcomeOverlay.tsx`
7. `src/renderer/components/Settings.tsx`
8. `src/shared/providers/constants.ts`
9. `src/shared/providers/index.ts`
10. `src/main/libs/githubCopilotAuth.ts`
11. `src/main/libs/copilotTokenManager.ts`

当前仍未完全收平的点包括：

1. `portal / deep-link / refresh token` 认证主干仍有实现细节差异
2. `Provider Registry` 虽然已经补了官网、API Key 入口和部分 metadata，但 provider 图标、runtime id、注册表类型仍未完全收平
3. `GitHub Copilot` 认证与 token 生命周期仍属于“骨架已在，主线细节未完全等同 main”
4. 这块要继续推进时，仍需保持“保留青数登录承接层，只对齐公共认证与 provider 配置层”

### 3. IM / Agent / Skill 已成为覆盖面最大的剩余能力域

当前仍未完全拉齐的主线内容主要集中在这些文件族：

1. `src/main/im/imGatewayManager.ts`
2. `src/main/im/imStore.ts`
3. `src/main/im/imScheduledTaskHandler.ts`
4. `src/main/im/imReplyGuard.*`
5. `src/main/im/types.ts`
6. `src/renderer/components/im/IMSettings.tsx`
7. `src/renderer/components/im/IMSettingsMain.tsx`
8. `src/renderer/services/im.ts`
9. `src/renderer/store/slices/imSlice.ts`
10. `src/renderer/components/agent/AgentCreateModal.tsx`
11. `src/renderer/components/agent/AgentSettingsPanel.tsx`
12. `src/renderer/components/agent/AgentToolBundle*.tsx`
13. `src/renderer/components/skills/SkillsManager.tsx`
14. `src/main/qingshuModules/`

当前仍未完全收平的点包括：

1. 多实例 IM 的主进程存储、默认值、实例级状态同步与定时任务联动仍有剩余差异
2. 当前分支虽然已经引入 `IMSettingsMain + *InstanceSettings` 结构，但与 `main` 当前的 `IMSettings` 主线形态仍然没有完全一致
3. `services/im.ts + imSlice.ts` 这条 renderer 状态更新链，和 `main` 的实例级本地增量更新策略仍不完全相同
4. `AgentCreateModal / AgentSettingsPanel` 的 IM 绑定、tool bundle、治理提示虽然已经收了多轮，但离 `main` 的公共形态仍有剩余边角
5. `qingshuModules` 本身是当前分支的重要保留域，但其与 `main` 的公共 skill / governance / dependency 主干之间仍存在继续收口空间

### 4. Cowork / Speech / ScheduledTasks 仍是第二高风险区

当前仍未完全拉齐的主线内容主要集中在这些文件族：

1. `src/renderer/components/cowork/CoworkPromptInput.tsx`
2. `src/renderer/components/cowork/CoworkView.tsx`
3. `src/renderer/components/cowork/CoworkSessionList.tsx`
4. `src/renderer/components/cowork/CoworkSessionItem.tsx`
5. `src/renderer/services/cowork.ts`
6. `src/renderer/store/slices/coworkSlice.ts`
7. `src/renderer/components/WakeActivationOverlay.tsx`
8. `src/renderer/components/cowork/coworkSpeechText.ts`
9. `src/renderer/components/cowork/coworkTtsText.ts`
10. `src/main/libs/wakeInputService.ts`
11. `src/main/libs/edgeTtsService.ts`
12. `src/main/libs/macSpeechService.ts`
13. `src/main/libs/macTtsService.ts`
14. `src/main/libs/ttsRouterService.ts`
15. `src/renderer/components/scheduledTasks/RunSessionModal.tsx`
16. `src/renderer/components/scheduledTasks/TaskForm.tsx`
17. `src/renderer/components/scheduledTasks/TaskList.tsx`

当前仍未完全收平的点包括：

1. `Cowork` 的 loading、错误链、session model override、history turn 组装已经更接近 `main`，但输入区、列表区和外围入口仍有较大实现差异
2. 语音转写、唤醒、TTS 和 overlay 这一层当前分支做了较多业务增强，与 `main` 的主线实现仍未同构
3. `RunSessionModal / TaskForm / TaskList / AllRunsHistory` 这条定时任务和运行记录链还没有完全追平 `main`
4. 这块仍应坚持“保留品牌与业务展示，只收公共行为”的推进方式

### 5. 工程化 / 测试 / 提交流程仍落后于 main

当前仍未完全拉齐的主线内容主要集中在这些文件族：

1. `.github/workflows/`
2. `.githooks/`
3. `commitlint.config.mjs`
4. `scripts/check-precommit.cjs`
5. `src/main/**/*.test.ts`
6. `src/renderer/**/*.test.ts`

当前仍未完全收平的点包括：

1. `CI / security / build verification / labeler` 工作流与 `main` 差异仍大
2. 当前分支已有自己的 secret 防护和 pre-commit 方案，但工程化布局与 `main` 仍不完全一致
3. `main` 新增的测试覆盖面仍明显更大，尤其是 `OpenClaw / IM / scheduled task / auth / speech` 相关主线测试
4. 如果目标是后续更平滑地继续跟 `main`，这块仍值得继续补

### 当前阶段的排序建议

如果继续按“小步、可验收、低风险”的方式推进，当前更推荐的顺序是：

1. `IM / Agent / Skill`：覆盖面最大，而且已有多轮铺垫，最适合继续收公共层
2. `Cowork / ScheduledTasks`：公共行为可以继续收，但要避开品牌视觉大改
3. `认证 / Provider / Copilot`：适合按功能点逐段补
4. `OpenClaw / MCP / Runtime`：仍然必须做，但要继续拆成更小块，避免一次性冲击运行时
5. `工程化 / 测试 / CI`：适合在主线差异进一步收窄后补齐

## 补充：品牌覆盖层元数据梳理

为降低后续继续对齐 `main` 时把青数品牌层再次冲散的风险，已新增独立文档 `青数覆盖层-品牌元数据梳理.md`，专门沉淀以下内容：

1. 品牌名体系
2. 品牌介绍与协议文案
3. logo / 图标 / 品牌徽记
4. 品牌色 token 与局部强化色
5. 各品牌元素在系统层、工作台、登录区、关于页、协议页、更新页中的生效位置

这份文档的用途不是替代本 changelog，而是作为后续“从最新 `main` 新拉分支，再回贴青数覆盖层”的品牌基线清单。

## 补充：覆盖层文档继续拆分

为了后续从最新 `main` 新拉分支后更稳地回贴当前分支的保留域，现已继续补充以下覆盖层文档：

1. `青数覆盖层-总索引.md`
2. `青数覆盖层-内置治理链梳理.md`
3. `青数覆盖层-UI与样式梳理.md`
4. `青数覆盖层-唤醒与TTS梳理.md`
5. `青数覆盖层-登录认证梳理.md`

当前文档分工已明确：

1. `青数覆盖层-品牌元数据梳理.md`
   - 品牌名、品牌介绍、logo、品牌色与品牌落点
2. `青数覆盖层-内置治理链梳理.md`
   - `qingshuModules`、managed catalog、治理 IPC、治理 UI 与只读边界
3. `青数覆盖层-UI与样式梳理.md`
   - 工作台双侧栏壳层、页面编排、主题系统与样式 token
4. `青数覆盖层-唤醒与TTS梳理.md`
   - 语音输入、语音唤醒、TTS、helper/runtime、打包与设置页入口
5. `青数覆盖层-登录认证梳理.md`
   - 认证契约、主进程认证适配层、登录 UI、bridge、deep link 与登录态联动
6. `青数覆盖层-总索引.md`
   - 后续从 `main` 新起分支后的总体回贴顺序与红线

## 补充：登录认证与唤醒浮层已纳入覆盖层索引

这轮没有继续动业务代码，而是把后续“从最新 `main` 新拉分支再回贴覆盖层”的前置材料补齐，重点把用户特别点名的登录认证和唤醒浮层一起纳入了覆盖层索引：

1. 新增登录认证覆盖层文档
   - 文件：`青数覆盖层-登录认证梳理.md`
   - 内容覆盖：
     - 共享认证契约
     - 主进程认证适配层与配置
     - renderer 登录态恢复与背景 hydration
     - `LoginButton / LoginWelcomeOverlay / Settings` 的登录承接 UI
     - Web / Desktop bridge、deep link、Portal 跳转
     - 登录态与 `server models / qingshuManaged` 联动
2. 总索引补齐登录认证覆盖层
   - 文件：`青数覆盖层-总索引.md`
   - 更新了：
     - 覆盖层清单
     - 建议迁移顺序
     - “不要只迁登录入口，不迁认证主干”的红线
     - 总体验收口径
3. UI 与样式文档补齐登录承接层
   - 文件：`青数覆盖层-UI与样式梳理.md`
   - 明确了：
     - `LoginButton` 属于一级侧栏身份区
     - `LoginWelcomeOverlay` 属于顶层工作台叠层
     - 登录欢迎浮层和唤醒浮层都需要按顶层反馈层一起迁
4. 唤醒与 TTS 文档补齐顶层叠层关系
   - 文件：`青数覆盖层-唤醒与TTS梳理.md`
   - 明确了 `WakeActivationOverlay` 也属于顶层全局反馈层，需要和登录欢迎浮层一起检查层级、焦点与工作台承接行为

这轮文档化的意义：

1. 后续不再建议在当前脏分支上继续做高耦合大 merge。
2. 更稳的路径是：
   - 先基于这些覆盖层文档抽清边界
   - 再从最新 `main` 新起分支
   - 最后按“品牌 -> UI 壳层 -> 登录认证 -> 治理链 -> 唤醒/TTS”顺序回贴
3. 校验结果
   - 已执行 `./node_modules/.bin/tsc --noEmit`
   - 当前这轮新增改动通过编译

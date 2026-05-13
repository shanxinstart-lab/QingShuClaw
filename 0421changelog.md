# 0421 Changelog

## 2026-05-12：第 1 轮可验收基线固化

本轮按新的五轮收口计划执行第 1 轮：先不继续扩大合入范围，而是对当前工作区做基线盘点、冲突标记扫描和核心验证矩阵，确保后续每一轮都叠在稳定基础上。

本轮基线盘点：

1. 当前分支
   - `front-design-merge`。
   - 相对 `origin/front-design-merge` ahead 1。
2. 当前工作区状态
   - 工作区仍有大量已合入但未提交改动。
   - `outputs/` 为未跟踪本地产物，本轮继续忽略。
3. 当前差异主要能力域
   - OpenClaw runtime / history / config / packaging。
   - Provider / 模型配置。
   - IM gateway / 多实例类型与调度链路。
   - ScheduledTasks 运行历史与筛选链路。
   - Cowork 对话、输入历史、消息元数据。
   - preload / electron IPC contract 类型。
4. 冲突标记扫描
   - 未发现 `<<<<<<<` / `=======` / `>>>>>>>` 残留。

本轮刻意未改：

1. 不新增业务代码。
2. 不继续合入 main 的高耦合 UI。
3. 不触碰青数品牌、工作台、治理链、唤醒/TTS。
4. 不提交、不打包。

原则校验：

1. KISS
   - 先固化当前状态，不在未验证基础上继续叠改动。
2. YAGNI
   - 不为了“看起来继续推进”引入新改动。
3. SOLID
   - 按能力域确认边界，后续每轮只处理一个主方向。
4. DRY
   - 后续验证矩阵复用本轮命令组合。

本轮验证：

1. `rg -n "^(<<<<<<<|=======|>>>>>>>)" . --glob '!node_modules/**' --glob '!release/**' --glob '!outputs/**' --glob '!vendor/**'`
   - 未发现冲突标记。
2. `npm test -- --run src/main/libs/agentEngine/openclawRuntimeAdapter.test.ts src/main/libs/openclawEngineManager.test.ts src/main/libs/openclawConfigSync.test.ts src/main/libs/openclawHistory.test.ts src/main/libs/openclawRuntimePackaging.test.ts src/main/libs/applyOpenClawPatches.test.ts src/main/libs/electronBuilderHooks.test.ts src/main/im/imScheduledTaskHandler.test.ts src/main/im/imCoworkHandler.test.ts src/main/im/imScheduledTaskAgent.test.ts src/main/im/imStore.test.ts src/renderer/store/slices/imSlice.test.ts src/renderer/components/agent/agentImBindingConfig.test.ts src/renderer/services/providerRequestConfig.test.ts src/renderer/services/config.test.ts src/shared/providers/constants.test.ts src/scheduledTask/cronJobService.test.ts src/renderer/services/scheduledTask.test.ts src/renderer/services/cowork.test.ts src/renderer/store/slices/coworkSlice.test.ts`
   - 20 个测试文件通过。
   - 248 条测试通过。
3. `npx tsc --project tsconfig.json --noEmit`
   - 通过。
4. `npx tsc --project electron-tsconfig.json --noEmit`
   - 通过。
5. `git diff --check`
   - 通过。
6. `npx eslint src/main/preload.ts src/renderer/services/providerRequestConfig.test.ts src/main/libs/applyOpenClawPatches.test.ts src/main/libs/electronBuilderHooks.test.ts src/main/libs/openclawRuntimePackaging.test.ts`
   - 0 error。
   - `src/main/preload.ts` 保留 5 个历史 `any` warning，均为 `store.set` 或 generic `ipcRenderer.send/on` escape hatch。

第 2 轮规划：

1. 主攻方向
   - OpenClaw runtime / packaging 防退化。
2. 计划动作
   - 继续审查 `electron-builder-hooks.cjs`、`openclaw-runtime-packaging.cjs`、`prune-openclaw-runtime.cjs`、`apply-openclaw-patches.cjs`。
   - 优先补纯 helper 测试，不改变生产打包行为。
   - 检查 OpenClaw runtime target、gateway.asar summary、plugin verification、patch temp path、runtime prune 的剩余边界。
3. 验收命令
   - `npm test -- --run src/main/libs/electronBuilderHooks.test.ts src/main/libs/openclawRuntimePackaging.test.ts src/main/libs/pruneOpenClawRuntime.test.ts src/main/libs/applyOpenClawPatches.test.ts src/main/libs/openclawEngineManager.test.ts`
   - `npx tsc --project electron-tsconfig.json --noEmit`
   - `git diff --check`
4. 暂不处理
   - OpenClaw 主干大重构。
   - gateway 真实重装/升级。
   - `.app` 打包。
   - 青数唤醒/TTS 行为。

## 2026-05-12：第 2 轮 OpenClaw packaging 插件校验防退化

本轮按第 1 轮规划继续收 `OpenClaw runtime / packaging` 的低耦合防线。对比当前代码后确认，`verifyPreinstalledPlugins(...)` 已支持测试注入 `packageJsonPath`，因此本轮不改生产打包逻辑，只补插件预装校验的异常元数据边界，避免未来 package metadata 异常或空插件条目导致打包阶段误报。

本轮代码更新：

1. 插件校验异常元数据测试
   - 文件：`src/main/libs/electronBuilderHooks.test.ts`
   - 新增 malformed `package.json` 和缺失 `package.json` 时跳过验证的测试。
   - 该行为对应生产逻辑中的保守降级：打包 hook 读不到 metadata 时不阻断打包。
2. 插件条目缺少 `id` 的防误报测试
   - 文件：`src/main/libs/electronBuilderHooks.test.ts`
   - 新增 `{}`、`{ optional: false }`、`{ id: '' }` 这类条目不会被当成缺失插件的测试。
   - 保留已有必需插件缺失时抛错的行为。

本轮刻意未改：

1. 不修改 `scripts/electron-builder-hooks.cjs` 的生产行为。
2. 不改变 OpenClaw runtime target 选择。
3. 不改变 gateway.asar、runtime prune 或 patch apply 策略。
4. 不触碰青数品牌、工作台、治理链、唤醒/TTS。

原则校验：

1. KISS
   - 用纯测试锁定当前边界，不引入新抽象。
2. YAGNI
   - 不为异常 package metadata 新增复杂校验器。
3. SOLID
   - 插件预装校验职责仍留在 `verifyPreinstalledPlugins(...)`。
4. DRY
   - 测试复用现有 helper 和临时 `package.json` 写入工具。

本轮验证：

1. `npm test -- --run src/main/libs/electronBuilderHooks.test.ts src/main/libs/openclawRuntimePackaging.test.ts src/main/libs/pruneOpenClawRuntime.test.ts src/main/libs/applyOpenClawPatches.test.ts src/main/libs/openclawEngineManager.test.ts`
   - 5 个测试文件通过。
   - 33 条测试通过。
2. `npx tsc --project electron-tsconfig.json --noEmit`
   - 通过。
3. `git diff --check`
   - 通过。

第 3 轮规划：

1. 主攻方向
   - Provider / 模型配置公共能力的防退化。
2. 计划动作
   - 优先检查 `src/renderer/services/providerRequestConfig.ts`、`src/renderer/services/api.ts` 和相关测试。
   - 只补 OpenAI Responses API streaming、provider URL、token 参数等低耦合测试或小修。
   - 暂不做 per-agent `modelSlice` 结构迁移。
3. 验收命令
   - `npm test -- --run src/renderer/services/providerRequestConfig.test.ts src/renderer/services/config.test.ts src/shared/providers/constants.test.ts`
   - 视改动补跑 `src/renderer/services/cowork.test.ts` 或 API 相关测试。
   - `npx tsc --project tsconfig.json --noEmit`
   - `npx tsc --project electron-tsconfig.json --noEmit`
   - `git diff --check`
4. 暂不处理
   - OpenAI Codex per-provider token refresher。
   - Settings / 主控台模型 UI 大迁移。
   - 青数登录、治理链、唤醒/TTS 行为。

## 2026-05-12：第 3 轮 Provider Responses URL 防退化

本轮按第 2 轮规划进入 `Provider / 模型配置` 公共能力防退化。复核当前分支和 `origin/main` 后确认，当前分支已经把 OpenAI-compatible URL、Gemini OpenAI-compatible endpoint、OpenAI Responses API 选择逻辑抽到了 `providerRequestConfig.ts`，比 main 中散落在 `api.ts` 的私有方法更适合后续小步维护。因此本轮不覆盖实现，只补 Responses URL 的边界测试。

本轮代码更新：

1. OpenAI Responses URL 边界测试
   - 文件：`src/renderer/services/providerRequestConfig.test.ts`
   - 覆盖空 `baseUrl` 返回 `/v1/responses`。
   - 覆盖根域 `https://api.openai.com` 补齐 `/v1/responses`。
   - 覆盖已传入 `/v1/responses` 时不重复追加路径。
   - 覆盖尾斜杠归一化。
2. 保留现有 Provider 行为
   - OpenAI provider 继续使用 Responses API。
   - Copilot 继续不走 Responses API。
   - Gemini / Copilot / LM Studio 的 chat completions URL 逻辑不变。

本轮刻意未改：

1. 不修改 `src/renderer/services/api.ts` 的 streaming 解析结构。
2. 不做 per-agent `modelSlice` 迁移。
3. 不改变 Settings / 主控台模型配置 UI。
4. 不触碰青数登录、治理链、唤醒/TTS。

原则校验：

1. KISS
   - 只补纯函数测试，避免为测试私有 streaming 方法改生产结构。
2. YAGNI
   - 不引入新的 URL builder abstraction。
3. SOLID
   - provider 请求 URL 仍由 `providerRequestConfig.ts` 负责。
4. DRY
   - 继续复用统一 URL helper，避免 `api.ts` 与测试各自拼接路径。

本轮验证：

1. `npm test -- --run src/renderer/services/providerRequestConfig.test.ts src/renderer/services/config.test.ts src/shared/providers/constants.test.ts`
   - 3 个测试文件通过。
   - 40 条测试通过。
2. `npx tsc --project tsconfig.json --noEmit`
   - 通过。
3. `npx tsc --project electron-tsconfig.json --noEmit`
   - 通过。
4. `git diff --check`
   - 通过。

第 4 轮规划：

1. 主攻方向
   - Cowork / 对话消息展示与输入行为的低耦合公共能力。
2. 计划动作
   - 优先检查 `CoworkSessionDetail.tsx`、`CoworkView.tsx`、`coworkSlice.ts`、`coworkService` 的历史展示和 streaming 投影链路。
   - 只处理消息展示完整性、输入历史、slash command 这类可局部验证的行为。
   - 继续避免主控台 UI 整包替换。
3. 验收命令
   - `npm test -- --run src/renderer/services/cowork.test.ts src/renderer/store/slices/coworkSlice.test.ts src/renderer/components/cowork/promptInputHistory.test.ts`
   - 视改动补跑 `src/main/libs/agentEngine/openclawRuntimeAdapter.test.ts`。
   - `npx tsc --project tsconfig.json --noEmit`
   - `npx tsc --project electron-tsconfig.json --noEmit`
   - `git diff --check`
4. 暂不处理
   - 主控台 UI 整包迁移。
   - full Artifacts / CodeMirror / 右侧面板 overhaul。
   - POPO/IM 大迁移。
   - OpenClaw 主干重构。

## 2026-05-12：第 4 轮 Cowork 流式消息乱序兜底

本轮按第 3 轮规划进入 `Cowork / 对话消息展示与输入行为`。沿 `coworkService -> coworkSlice -> CoworkSessionDetail` 链路复核后，发现一个低耦合但影响体验的边界：如果 IPC 或 OpenClaw gateway 先到达 `messageUpdate`，再到达完整 `message`，旧逻辑会因为当前 session 里找不到对应 message 而直接丢弃这段流式内容，可能表现为“对话中没有回答”或短时间内看不到正在生成的内容。

本轮代码更新：

1. 流式消息 update 乱序兜底
   - 文件：`src/renderer/store/slices/coworkSlice.ts`
   - `updateMessageContent(...)` 在当前 session 中找不到 `messageId` 时，会创建一个 assistant 占位消息。
   - 后续完整 `addMessage(...)` 到达时，仍通过已有重复 id 检查避免重复插入。
   - 占位消息保留 metadata，确保 streaming / final / usage 等信息不丢。
2. 防退化测试
   - 文件：`src/renderer/store/slices/coworkSlice.test.ts`
   - 新增“早到的 streaming update 在完整 message 尚未到达时也能展示”的测试。

本轮刻意未改：

1. 不改变 `CoworkSessionDetail.tsx` 的布局和视觉。
2. 不改主控台 UI。
3. 不搬 full Artifacts / CodeMirror / 右侧面板 overhaul。
4. 不触碰青数品牌、工作台、治理链、唤醒/TTS。

原则校验：

1. KISS
   - 只在 reducer 层补 upsert 兜底，不改 IPC 协议。
2. YAGNI
   - 不引入消息队列或复杂重排系统。
3. SOLID
   - `coworkSlice` 继续负责 renderer 会话状态投影，service 和 UI 不承担乱序修复。
4. DRY
   - 复用 `addMessage(...)` 现有重复 id 防重逻辑，避免第二套 dedupe。

本轮验证：

1. `npm test -- --run src/renderer/services/cowork.test.ts src/renderer/store/slices/coworkSlice.test.ts src/renderer/components/cowork/promptInputHistory.test.ts`
   - 3 个测试文件通过。
   - 12 条测试通过。
2. `npx tsc --project tsconfig.json --noEmit`
   - 通过。
3. `npx tsc --project electron-tsconfig.json --noEmit`
   - 通过。
4. `git diff --check`
   - 通过。

第 5 轮规划：

1. 主攻方向
   - ScheduledTasks 运行体验与局部刷新低耦合收口。
2. 计划动作
   - 优先检查 `TaskDetail.tsx`、`TaskList.tsx`、`scheduledTaskSlice.ts`、`scheduledTaskService`。
   - 只处理执行按钮反馈、运行状态、运行历史局部刷新这类可测试行为。
   - 不搬 main 的大布局或主控台视觉。
3. 验收命令
   - `npm test -- --run src/scheduledTask/cronJobService.test.ts src/renderer/services/scheduledTask.test.ts src/renderer/store/slices/scheduledTaskSlice.test.ts src/renderer/components/scheduledTasks/utils.test.ts`
   - `npx tsc --project tsconfig.json --noEmit`
   - `npx tsc --project electron-tsconfig.json --noEmit`
   - `git diff --check`
4. 暂不处理
   - better-sqlite3 存储迁移。
   - 主控台 UI 整包迁移。
   - POPO/IM 大迁移。
   - OpenClaw 主干重构。

## 2026-05-12：第 5 轮 ScheduledTasks pending run 状态同步

本轮按第 4 轮规划进入 `ScheduledTasks` 运行体验与局部刷新。沿 `scheduledTaskService -> scheduledTaskSlice -> TaskDetail / TaskList` 链路复核后，确认当前分支已经具备手动执行的乐观 running 态、pending manual run、并发去重和执行后 best-effort 刷新。本轮只补一个低耦合边界：当主进程先推送 task status update、真实 run update 稍后到达时，pending manual run 也应同步任务状态，避免历史列表短时间停在“运行中”。

本轮代码更新：

1. pending manual run 状态同步
   - 文件：`src/renderer/store/slices/scheduledTaskSlice.ts`
   - `updateTaskState(...)` 更新任务状态时，会同步同任务的 `pending-manual-${taskId}` 运行记录。
   - 同步字段包括 `status`、`finishedAt`、`durationMs`、`error`。
   - 仅更新已有 pending run，不凭空创建运行历史。
2. 防退化测试
   - 文件：`src/renderer/store/slices/scheduledTaskSlice.test.ts`
   - 新增 task state update 能同步单任务历史与全局历史 pending manual run 的测试。

本轮刻意未改：

1. 不改变 `TaskDetail.tsx` / `TaskList.tsx` 布局。
2. 不搬 main 的定时任务大 UI。
3. 不修改 cron backend 或 SQLite 存储。
4. 不触碰青数品牌、工作台、治理链、唤醒/TTS。

原则校验：

1. KISS
   - 只在 reducer 层同步已有 pending run，不新增轮询或事件系统。
2. YAGNI
   - 不为短暂乱序引入复杂 run reconciliation。
3. SOLID
   - 状态投影仍由 `scheduledTaskSlice` 负责，service/UI 保持简单。
4. DRY
   - 单任务历史和全局历史复用同一个 pending run patch helper。

本轮验证：

1. `npm test -- --run src/scheduledTask/cronJobService.test.ts src/renderer/services/scheduledTask.test.ts src/renderer/store/slices/scheduledTaskSlice.test.ts src/renderer/components/scheduledTasks/utils.test.ts`
   - 4 个测试文件通过。
   - 39 条测试通过。
2. `npx tsc --project tsconfig.json --noEmit`
   - 通过。
3. `npx tsc --project electron-tsconfig.json --noEmit`
   - 通过。
4. `git diff --check`
   - 通过。

第 6 轮规划：

1. 主攻方向
   - IM / Agent 多实例绑定的低耦合收口。
2. 计划动作
   - 优先检查 `agentImBindingConfig.ts`、`AgentSettingsPanel.tsx`、`imSlice.ts`、`im.ts`。
   - 只处理 Agent 保存按钮可用性、实例选择数据结构、配置透传这类局部行为。
   - 不做 POPO/IM 大迁移和主控台 UI 整包替换。
3. 验收命令
   - `npm test -- --run src/renderer/components/agent/agentImBindingConfig.test.ts src/renderer/store/slices/imSlice.test.ts src/main/im/imStore.test.ts src/main/im/imCoworkHandler.test.ts`
   - 视改动补跑 `src/main/im/imScheduledTaskHandler.test.ts`。
   - `npx tsc --project tsconfig.json --noEmit`
   - `npx tsc --project electron-tsconfig.json --noEmit`
   - `git diff --check`
4. 暂不处理
   - POPO/IM UI 大迁移。
   - OpenClaw 主干重构。
   - per-agent `modelSlice`。
   - better-sqlite3 存储迁移。

## 2026-05-12：第 6 轮 Agent IM 绑定 key 归一化

本轮按第 5 轮规划进入 `IM / Agent` 多实例绑定低耦合收口。沿 `AgentSettingsPanel -> agentImBindingConfig -> imService / imSlice` 链路复核后，确认当前分支已经具备多实例 binding key、保存按钮 dirty 判断、持久化和 stale binding 清理。本轮只补一个轻量边界：绑定 key 归一化时同步清理平台段和实例段的前后空白，避免历史配置或 UI 输入带空白时保存状态漂移、写入脏 key 或保存按钮状态异常。

本轮代码更新：

1. Agent IM binding key trim 归一
   - 文件：`src/renderer/components/agent/agentImBindingConfig.ts`
   - `normalizeAgentImBindingKey(...)` 会先 trim 整体 binding key。
   - 对 `platform:instanceId` 形式分别 trim platform 和 instanceId。
   - 保留 `xiaomifeng -> netease-bee` 旧别名兼容。
2. 防退化测试
   - 文件：`src/renderer/components/agent/agentImBindingConfig.test.ts`
   - 新增 `' feishu : bot-a '` 归一为 `feishu:bot-a`。
   - 新增保存 bindings 时不会写入带空白实例 key 的测试。

本轮刻意未改：

1. 不改变 `AgentSettingsPanel.tsx` UI。
2. 不改变 IM gateway 启停和 OpenClaw config sync。
3. 不做 POPO/IM UI 大迁移。
4. 不触碰青数品牌、工作台、治理链、唤醒/TTS。

原则校验：

1. KISS
   - 只在 binding key helper 层做字符串归一，不改 UI 结构。
2. YAGNI
   - 不新增 binding schema migration。
3. SOLID
   - binding key 归一职责继续集中在 `agentImBindingConfig.ts`。
4. DRY
   - 保存、回填、dirty 判断继续复用同一个 normalize helper。

本轮验证：

1. `npm test -- --run src/renderer/components/agent/agentImBindingConfig.test.ts src/renderer/store/slices/imSlice.test.ts src/main/im/imStore.test.ts src/main/im/imCoworkHandler.test.ts src/main/im/imScheduledTaskHandler.test.ts`
   - 5 个测试文件通过。
   - 39 条测试通过。
2. `npx tsc --project tsconfig.json --noEmit`
   - 通过。
3. `npx tsc --project electron-tsconfig.json --noEmit`
   - 通过。
4. `git diff --check`
   - 通过。

第 7 轮规划：

1. 主攻方向
   - OpenClaw config / history / transcript 的剩余低耦合防退化扫描。
2. 计划动作
   - 优先检查 `openclawConfigSync.ts`、`openclawHistory.ts`、`openclawTranscript.ts` 及对应测试。
   - 只补 schema guard、历史消息投影、sessionKey 解析这类局部可测边界。
   - 不做 OpenClaw 主干重构或 runtime 真实重装。
3. 验收命令
   - `npm test -- --run src/main/libs/openclawConfigSync.test.ts src/main/libs/openclawHistory.test.ts src/main/libs/openclawTranscript.test.ts src/main/libs/agentEngine/openclawRuntimeAdapter.test.ts`
   - `npx tsc --project electron-tsconfig.json --noEmit`
   - `git diff --check`
4. 暂不处理
   - OpenClaw 主干大迁移。
   - better-sqlite3 存储迁移。
   - 主控台 UI 整包迁移。
   - POPO/IM UI 大迁移。

## 2026-05-12：第 7 轮 OpenClaw history output_text 提取

本轮按第 6 轮规划回到 `OpenClaw config / history / transcript` 的低耦合防退化。复核 `openclawHistory.ts`、`openclawTranscript.ts` 和对应测试后，确认当前分支已经覆盖心跳抑制、网关重启状态过滤、定时提醒转 system、多轮 tool 顺序等真实问题。本轮只补一个小边界：Responses / provider 兼容形态可能把文本放在 `output_text` 字段，而不是 `text` 字段，旧提取逻辑会漏掉这类历史文本。

本轮代码更新：

1. Responses-style output_text 提取
   - 文件：`src/main/libs/openclawHistory.ts`
   - `collectTextChunks(...)` 增加 `output_text` 字段提取。
   - 保留现有 `text`、`content`、`parts` 递归逻辑。
2. 防退化测试
   - 文件：`src/main/libs/openclawHistory.test.ts`
   - 新增 `{ output_text: '...' }` 形态能进入 `extractGatewayMessageText(...)` 的测试。

本轮刻意未改：

1. 不改变 OpenClaw config sync 主链路。
2. 不改 transcript session 构造结构。
3. 不做 OpenClaw 主干重构或 runtime 重装。
4. 不触碰青数品牌、工作台、治理链、唤醒/TTS。

原则校验：

1. KISS
   - 只在已有文本递归函数里补一个字段。
2. YAGNI
   - 不新建 provider-specific transcript parser。
3. SOLID
   - 文本提取职责仍集中在 `openclawHistory.ts`。
4. DRY
   - transcript 继续复用 history 文本提取，不复制解析规则。

本轮验证：

1. `npm test -- --run src/main/libs/openclawConfigSync.test.ts src/main/libs/openclawHistory.test.ts src/main/libs/openclawTranscript.test.ts src/main/libs/agentEngine/openclawRuntimeAdapter.test.ts`
   - 4 个测试文件通过。
   - 120 条测试通过。
2. `npx tsc --project electron-tsconfig.json --noEmit`
   - 通过。
3. `git diff --check`
   - 通过。

第 8 轮规划：

1. 主攻方向
   - 构建 / 打包稳定性剩余小边界。
2. 计划动作
   - 回看 `electron-builder-hooks.cjs`、`openclaw-runtime-packaging.cjs`、`prune-openclaw-runtime.cjs` 的剩余测试缺口。
   - 优先补纯 helper 测试，不改变生产打包策略。
   - 只处理 package metadata、runtime summary、target hint、prune stats 这类可局部验证内容。
3. 验收命令
   - `npm test -- --run src/main/libs/electronBuilderHooks.test.ts src/main/libs/openclawRuntimePackaging.test.ts src/main/libs/pruneOpenClawRuntime.test.ts src/main/libs/applyOpenClawPatches.test.ts`
   - `npx tsc --project electron-tsconfig.json --noEmit`
   - `git diff --check`
4. 暂不处理
   - `.app` / `.dmg` 打包。
   - OpenClaw runtime 真实重装。
   - OpenClaw 主干大迁移。
   - better-sqlite3 存储迁移。

## 2026-05-12：第 8 轮 gateway.asar entry 归一化

本轮按第 7 轮规划进入构建 / 打包稳定性剩余小边界。复核 `electron-builder-hooks.cjs`、`openclaw-runtime-packaging.cjs`、`prune-openclaw-runtime.cjs` 和既有测试后，确认当前分支已覆盖 gateway.asar summary、stage prune、bare dist prune、runtime prune、patch temp path、plugin verification 等核心路径。本轮只补一个 helper 边界：asar entry 可能以目录尾斜杠形式出现，例如 `/dist/extensions/`，旧 summary 逻辑会漏判 bundled extensions。

本轮代码更新：

1. gateway.asar entry 归一化
   - 文件：`scripts/openclaw-runtime-packaging.cjs`
   - `normalizeAsarEntry(...)` 在反斜杠转正斜杠后，会清理尾斜杠。
   - 不改变 gateway.asar 打包、prune 或验证策略。
2. 防退化测试
   - 文件：`src/main/libs/openclawRuntimePackaging.test.ts`
   - 新增带尾斜杠的 `/openclaw.mjs/`、`/dist/entry.mjs/`、`/dist/control-ui/index.html/`、`/dist/extensions/` summary 测试。

本轮刻意未改：

1. 不改变生产打包流程。
2. 不做 `.app` / `.dmg` 打包。
3. 不重装 OpenClaw runtime。
4. 不触碰青数品牌、工作台、治理链、唤醒/TTS。

原则校验：

1. KISS
   - 在已有 normalize helper 中补尾斜杠归一。
2. YAGNI
   - 不引入新的 asar manifest parser。
3. SOLID
   - asar entry 归一职责仍在 `openclaw-runtime-packaging.cjs`。
4. DRY
   - summary 逻辑继续统一走同一归一化函数。

本轮验证：

1. `npm test -- --run src/main/libs/electronBuilderHooks.test.ts src/main/libs/openclawRuntimePackaging.test.ts src/main/libs/pruneOpenClawRuntime.test.ts src/main/libs/applyOpenClawPatches.test.ts`
   - 4 个测试文件通过。
   - 25 条测试通过。
2. `npx tsc --project electron-tsconfig.json --noEmit`
   - 通过。
3. `git diff --check`
   - 通过。

第 9 轮规划：

1. 主攻方向
   - 进入阶段性验收基线回扫。
2. 计划动作
   - 回扫本阶段新增的低耦合改动域：
     - OpenClaw packaging / runtime helper。
     - Provider / 模型配置。
     - Cowork stream message。
     - ScheduledTasks。
     - IM / Agent binding。
     - OpenClaw history / transcript。
   - 做一次冲突标记扫描和核心测试矩阵。
   - 更新 `0421changelog.md` 的阶段性剩余风险与后续批次规划。
3. 验收命令
   - `rg -n "^(<<<<<<<|=======|>>>>>>>)" . --glob '!node_modules/**' --glob '!release/**' --glob '!outputs/**' --glob '!vendor/**'`
   - 本阶段核心测试矩阵。
   - `npx tsc --project tsconfig.json --noEmit`
   - `npx tsc --project electron-tsconfig.json --noEmit`
   - `git diff --check`
4. 暂不处理
   - 打包 `.app`。
   - 提交 commit。
   - 高耦合主干迁移。

## 2026-05-12：第 9 轮阶段验收基线回扫

本轮按第 8 轮规划做阶段性验收基线回扫。目标不是继续扩大合入范围，而是确认前 2-8 轮低耦合公共能力合入后，当前分支仍保持可继续推进的稳定基线。

本轮回扫范围：

1. OpenClaw packaging / runtime helper
   - 覆盖 electron-builder hooks、runtime packaging、runtime prune、patch apply、OpenClaw engine manager。
2. Provider / 模型配置
   - 覆盖 provider request config、renderer config、shared provider constants。
3. Cowork 对话与输入
   - 覆盖 cowork service、cowork slice、prompt input history。
4. ScheduledTasks
   - 覆盖 cron job service、renderer scheduled task service、scheduled task slice、scheduled task utils。
5. IM / Agent binding
   - 覆盖 agent IM binding config、IM slice、main IM store、cowork handler、scheduled task handler。
6. OpenClaw history / transcript / adapter
   - 覆盖 config sync、history、transcript、openclaw runtime adapter。

本轮结果：

1. 冲突标记扫描
   - 未发现 `<<<<<<<` / `=======` / `>>>>>>>` 残留。
2. 核心测试矩阵
   - 23 个测试文件通过。
   - 275 条测试通过。
3. TypeScript renderer 编译
   - `npx tsc --project tsconfig.json --noEmit` 通过。
4. TypeScript main 编译
   - `npx tsc --project electron-tsconfig.json --noEmit` 通过。
5. diff 空白检查
   - `git diff --check` 通过。

本轮刻意未改：

1. 不新增生产代码。
2. 不继续合入高耦合 UI 或 runtime 主干。
3. 不触碰青数品牌、工作台、治理链、唤醒/TTS。
4. 不提交、不推送、不打包。

原则校验：

1. KISS
   - 用阶段性矩阵确认稳定性，不在不确定状态下继续叠改动。
2. YAGNI
   - 只记录已验证事实，不提前承诺尚未合入的大迁移完成。
3. SOLID
   - 按能力域分别验证，保持后续每轮主攻方向单一。
4. DRY
   - 将本轮矩阵沉淀为后续验收基线，避免每轮重新设计验证范围。

阶段性剩余风险：

1. 当前工作区仍包含大量选择性合入改动，尚未进入提交级收口。
2. 高耦合公共能力仍需单独批次处理，不能用宽 merge 直接覆盖。
3. OpenClaw 主干大迁移、POPO/IM 大迁移、per-agent modelSlice、主控台 UI overhaul、better-sqlite3 迁移仍可能牵动青数覆盖层。
4. `.app` 真实打包、OpenClaw runtime 真实重装、登录后完整业务链路验证尚未在本轮执行。

第 10 轮规划：

1. 主攻方向
   - 继续小步筛 `origin/main` 剩余公共能力中低耦合、可测试的 bugfix。
2. 计划动作
   - 优先复核 Provider / 模型配置剩余差异，尤其是 token、temperature、thinking、Responses API 兼容字段这类纯配置投影。
   - 复核 OpenClaw runtime patch / packaging 是否还有可独立补测试的小边界。
   - 如发现改动会牵动 Settings 大 UI、per-agent modelSlice 或认证 token refresher，则只记录为暂缓项。
3. 验收命令
   - 针对本轮实际触达文件补跑最小测试集。
   - `npx tsc --project tsconfig.json --noEmit`
   - `npx tsc --project electron-tsconfig.json --noEmit`
   - `git diff --check`
4. 暂不处理
   - POPO/IM 整包迁移。
   - OpenClaw 主干大重构。
   - 主控台 UI 整包迁移。
   - per-agent `modelSlice` 大迁移。
   - `.app` 打包、commit、push。

## 2026-05-12：第 10 轮 Provider 默认模型元数据防退化

本轮按第 9 轮规划继续筛 `origin/main` 剩余公共能力。先对比 `src/shared/providers/constants.ts`、`providerRequestConfig.ts`、`api.ts` 和相关测试后确认，Qwen、Volcengine、OpenClaw Codex Responses 常量、Copilot OpenClaw providerId 映射等 main 上的关键低耦合 provider 改动，当前分支生产代码已经具备。本轮不再改生产代码，只补回归断言，防止后续合并或手工整理时把这些公共模型元数据改退。

本轮代码更新：

1. Provider 默认模型元数据回归测试
   - 文件：`src/shared/providers/constants.test.ts`
   - 断言 Qwen 默认模型首位为 `qwen3.6-plus`，且支持图像输入。
   - 断言 Volcengine 默认模型首位为 `doubao-seed-2-0-pro-260215`，且支持图像输入。
   - 断言 Volcengine 的 `ark-code-latest` 通过 registry 能解析为支持图像输入。

本轮刻意未改：

1. 不修改 `src/shared/providers/constants.ts` 生产数据，因为已和 `origin/main` 的相关公共模型元数据一致。
2. 不接入或改动 `shouldUseMaxCompletionTokensForOpenAI(...)` 到请求体，避免在未确认 Responses API 参数兼容前改变线上协议。
3. 不做 OpenAI Codex per-provider token refresher。
4. 不做 per-agent `modelSlice` 大迁移。
5. 不触碰青数品牌、工作台、治理链、唤醒/TTS。

原则校验：

1. KISS
   - 用最小测试锁住已合入的数据，不引入新配置迁移。
2. YAGNI
   - 不为尚未确认的 OpenAI token 参数策略提前改请求体。
3. SOLID
   - Provider 元数据仍由 `ProviderRegistry` 统一暴露，测试只验证 registry 输出。
4. DRY
   - 复用 `resolveModelSupportsImage(...)`，不在测试里复制模型能力判断逻辑。

本轮验证：

1. `npm test -- --run src/shared/providers/constants.test.ts src/renderer/services/providerRequestConfig.test.ts src/renderer/services/config.test.ts src/renderer/services/apiRequestHeaders.test.ts`
   - 4 个测试文件通过。
   - 43 条测试通过。
2. `npx tsc --project tsconfig.json --noEmit`
   - 通过。
3. `npx tsc --project electron-tsconfig.json --noEmit`
   - 通过。
4. `git diff --check`
   - 通过。

第 11 轮规划：

1. 主攻方向
   - OpenClaw runtime / config sync 的剩余低耦合 bugfix 回扫。
2. 计划动作
   - 对比 `origin/main` 中 `openclawConfigSync.ts`、`openclawAgentModels.ts`、`openclawConfigGuards.ts`、`openclawEngineManager.ts` 的剩余差异。
   - 优先筛选不会重构 OpenClaw 主干、不会改变青数唤醒/TTS、不会触发网关频繁重启的纯 helper 或测试补强。
   - 如果发现差异属于 OpenClaw 主干重构、runtime reinstall、config schema 大迁移，则只记录为后续高耦合批次。
3. 验收命令
   - `npm test -- --run src/main/libs/openclawConfigSync.test.ts src/main/libs/openclawConfigSync.runtime.test.ts src/main/libs/openclawAgentModels.test.ts src/main/libs/openclawEngineManager.test.ts`
   - `npx tsc --project electron-tsconfig.json --noEmit`
   - 视触达 renderer 类型再补 `npx tsc --project tsconfig.json --noEmit`
   - `git diff --check`
4. 暂不处理
   - OpenClaw 主干大重构。
   - OpenClaw runtime 真实卸载/重装。
   - POPO/IM 大迁移。
   - 主控台 UI 整包迁移。
   - 打包、提交、推送。

## 2026-05-12：第 11 轮 OpenClaw Agent 设计头像投影过滤

本轮按第 10 轮规划进入 `OpenClaw runtime / config sync` 低耦合回扫。对比 `origin/main` 后确认，main 上已有一个很窄的 OpenClaw agent 投影修复：不要把 UI 设计头像编码当成 OpenClaw `identity.emoji` 写入配置。当前分支没有整套 `src/shared/agent/avatar.ts` 共享头像 helper，直接整包带回会牵动 Agent UI 头像体系，因此本轮采用最小兼容实现，只在 OpenClaw 投影层过滤已知设计头像编码。

本轮代码更新：

1. OpenClaw agent identity emoji 过滤
   - 文件：`src/main/libs/openclawAgentModels.ts`
   - 新增对 `agent-avatar-svg:` 前缀的识别。
   - 当 `agent.icon` 是设计头像编码时，不再写入 `identity.emoji`。
   - 普通 emoji 仍保持原逻辑透传给 OpenClaw。
2. 防退化测试
   - 文件：`src/main/libs/openclawAgentModels.test.ts`
   - 新增“设计头像编码不会作为 OpenClaw emoji 透传”的测试。
   - 新增“普通 emoji 仍会作为 OpenClaw emoji 透传”的测试。

本轮刻意未改：

1. 不引入 `src/shared/agent/avatar.ts` 整套 main 头像系统，避免牵动当前 Agent UI。
2. 不修改主控台 Agent 列表和创建/编辑 UI。
3. 不修改 OpenClaw 主干、runtime reinstall、gateway 启停策略。
4. 不触碰青数品牌、工作台、治理链、唤醒/TTS。

原则校验：

1. KISS
   - 用前缀识别解决当前投影问题，不迁移整套头像系统。
2. YAGNI
   - 不为后续 UI 头像重构提前引入共享模块。
3. SOLID
   - OpenClaw 投影层负责把 UI-only metadata 转为 runtime-safe config。
4. DRY
   - 普通 emoji 透传逻辑仍复用原 `identity` 构造路径。

本轮验证：

1. `npm test -- --run src/main/libs/openclawAgentModels.test.ts src/main/libs/openclawConfigSync.test.ts src/main/libs/openclawConfigSync.runtime.test.ts src/main/libs/openclawEngineManager.test.ts src/main/libs/openclawConfigGuards.test.ts`
   - 5 个测试文件通过。
   - 73 条测试通过。
2. `npx tsc --project electron-tsconfig.json --noEmit`
   - 通过。
3. `git diff --check`
   - 通过。

第 12 轮规划：

1. 主攻方向
   - 继续回扫 OpenClaw config sync 中“减少无意义 gateway 重启 / 配置写入抖动”的低耦合差异。
2. 计划动作
   - 优先检查 `bce5c1e8 fix: 修复 gateway 因为套餐模型列表更新带来的强制 gateway 重启`、`d35f98d7 fix: stamp meta field on openclaw.json writes to prevent clobbered snapshots` 相关代码差异。
   - 只摘取可以局部验证的 config 比较、meta stamp、模型列表稳定排序或测试补强。
   - 如果差异依赖 OpenClaw 主干大改、runtime schema 大迁移、per-agent 工作目录整体迁移，则记录暂缓。
3. 验收命令
   - `npm test -- --run src/main/libs/openclawConfigSync.test.ts src/main/libs/openclawConfigSync.runtime.test.ts src/main/libs/openclawAgentModels.test.ts`
   - `npx tsc --project electron-tsconfig.json --noEmit`
   - `git diff --check`
4. 暂不处理
   - OpenClaw 主干大重构。
   - per-agent 工作目录整包迁移。
   - embedding 设置 UI / memory search 大迁移。
   - POPO/IM 大迁移。
   - 打包、提交、推送。

## 2026-05-12：第 12 轮 OpenClaw 模型元数据防抖回归测试

本轮按第 11 轮规划继续回扫 `OpenClaw config sync` 中减少无意义 gateway 重启 / 配置写入抖动的低耦合差异。核对 `bce5c1e8` 和 `d35f98d7` 后确认，当前分支生产代码已经具备两项核心能力：`openclaw.json` 写入时会补 `meta`，比较配置时会忽略 `meta` 时间戳；server model metadata 更新也已经返回 changed 布尔值。因此本轮不重复改生产代码，只补一组回归测试锁住“模型列表顺序变化不应触发 changed”的防抖行为。

本轮代码更新：

1. server model metadata 防抖测试
   - 文件：`src/main/libs/claudeSettings.test.ts`
   - 新增相同模型列表仅顺序变化时 `updateServerModelMetadata(...)` 返回 `false` 的测试。
   - 新增模型图像能力变化时返回 `true` 的测试。
   - 该行为用于避免套餐模型列表刷新因顺序抖动诱发 OpenClaw config sync 和 gateway restart。

本轮刻意未改：

1. 不修改 `openclawConfigSync.ts`，因为 `meta` stamp 和忽略 `meta` 比较已经存在。
2. 不改 runtime 主干、gateway 启停策略或 OpenClaw 真实重装。
3. 不引入 embedding 设置 UI / memory search 大迁移。
4. 不触碰青数品牌、工作台、治理链、唤醒/TTS。

原则校验：

1. KISS
   - 已有生产能力只补测试，不为“推进感”重复实现。
2. YAGNI
   - 不把 config sync 防抖扩展成新的 diff engine。
3. SOLID
   - 模型元数据变化判断仍留在 `claudeSettings` 的 cache 更新边界。
4. DRY
   - 测试复用 `updateServerModelMetadata(...)` 公开行为，不复制序列化逻辑。

本轮验证：

1. `npm test -- --run src/main/libs/claudeSettings.test.ts src/main/libs/openclawConfigSync.test.ts src/main/libs/openclawConfigSync.runtime.test.ts src/main/libs/openclawAgentModels.test.ts`
   - 4 个测试文件通过。
   - 67 条测试通过。
2. `npx tsc --project electron-tsconfig.json --noEmit`
   - 通过。
3. `git diff --check`
   - 通过。

第 13 轮规划：

1. 主攻方向
   - OpenClaw runtime / engine manager 剩余小修回扫。
2. 计划动作
   - 优先检查 gateway log rotation、stale plugin cleanup、gateway client entry probe、启动前 config guard 相关差异。
   - 只摘取可通过 `openclawEngineManager.test.ts`、`openclawLocalExtensions.test.ts` 或纯 helper 测试验证的小改动。
   - 如果差异依赖 runtime 真实安装、OpenClaw 主干重构或平台专属行为，则只记录暂缓。
3. 验收命令
   - `npm test -- --run src/main/libs/openclawEngineManager.test.ts src/main/libs/openclawLocalExtensions.test.ts src/main/libs/openclawRuntimePackaging.test.ts`
   - `npx tsc --project electron-tsconfig.json --noEmit`
   - `git diff --check`
4. 暂不处理
   - OpenClaw 主干大重构。
   - OpenClaw runtime 真实卸载/重装。
   - per-agent 工作目录整包迁移。
   - POPO/IM 大迁移。
   - 打包、提交、推送。

## 2026-05-12：OpenClaw patch 临时文件路径防护

本轮继续从 OpenClaw runtime patch / packaging 稳定性中筛低耦合小补丁。`apply-openclaw-patches.cjs` 在标准化 CRLF patch 时会生成临时文件；本轮让临时文件名只使用 patch basename，避免未来异常 patch 文件名或子目录名把临时文件写出目标 temp 目录。

本轮代码更新：

1. patch 临时文件名安全化
   - 文件：`scripts/apply-openclaw-patches.cjs`
   - `getNormalizedPatchTempPath(...)` 使用 `path.basename(patchFile)` 构造临时文件名。
   - 不改变 patch 目录扫描、patch 排序、git apply 行为。
2. 防退化测试
   - 文件：`src/main/libs/applyOpenClawPatches.test.ts`
   - 新增 `../001-demo.patch` 这类路径输入仍写入 temp 目录内的测试。

本轮刻意未改：

1. 不改变 OpenClaw 版本选择。
2. 不改变 patch 应用策略和已应用判断。
3. 不改 OpenClaw runtime 主干。
4. 不触碰青数品牌、工作台、治理链、唤醒/TTS。

原则校验：

1. KISS
   - 用 `path.basename(...)` 解决临时路径边界，不引入复杂 sanitizer。
2. YAGNI
   - 不重写 patch apply 流程。
3. SOLID
   - temp path helper 只负责生成安全临时路径。
4. DRY
   - 测试复用现有 helper，不复制路径拼接逻辑。

本轮验证：

1. `npm test -- --run src/main/libs/applyOpenClawPatches.test.ts src/main/libs/electronBuilderHooks.test.ts src/main/libs/openclawRuntimePackaging.test.ts src/main/libs/pruneOpenClawRuntime.test.ts`
   - 4 个测试文件通过。
   - 22 条测试通过。
2. `npm test -- --run src/main/libs/applyOpenClawPatches.test.ts`
   - 1 个测试文件通过。
   - 4 条测试通过。
3. `npx tsc --project electron-tsconfig.json --noEmit`
   - 通过。
4. `npx eslint src/main/libs/applyOpenClawPatches.test.ts`
   - 0 error。

后续规划：

1. 下一步继续从 OpenClaw packaging helper 中补边界测试，优先不改变生产行为。
2. 若要改 OpenClaw runtime 主干或 patch 集合，需要单独批次并做 gateway 启动验证。
3. 继续避免把 OpenClaw 主干重构和青数唤醒/TTS 放进同一批。

## 2026-05-12：Provider request config Gemini URL 防退化测试

本轮回到 Provider / 模型配置公共能力边界。对比 `origin/main` 后确认，当前分支已经保留了比 main 更完整的 provider request 配置能力，包括 Moonshot 强制 OpenAI-compatible、Gemini OpenAI-compatible endpoint 拼接、OpenAI Responses API、GPT-5/O 系列 `max_completion_tokens` 判断等。因此本轮不覆盖现有实现，只补 Gemini URL 边界测试，防止后续合并把 endpoint 拼接改回错误路径。

本轮代码更新：

1. Gemini OpenAI-compatible URL 边界测试
   - 文件：`src/renderer/services/providerRequestConfig.test.ts`
   - 覆盖用户 baseUrl 已经是 `/v1beta/openai` 时，不重复追加版本路径。
   - 覆盖用户 baseUrl 是 `https://generativelanguage.googleapis.com` 根域时，补齐 `/v1beta/openai/chat/completions`。

本轮刻意未改：

1. 不改变 provider request config 生产逻辑。
2. 不改变 provider registry、默认模型、coding plan 配置。
3. 不改变 Settings / 模型选择 UI。
4. 不触碰青数品牌、工作台、治理链、唤醒/TTS。

原则校验：

1. KISS
   - 只补纯函数测试，不引入新 provider abstraction。
2. YAGNI
   - 不为 provider URL 拼接重写一套 parser。
3. SOLID
   - URL 拼接职责仍在 `providerRequestConfig.ts`。
4. DRY
   - 测试直接调用生产函数，不复制拼接逻辑。

本轮验证：

1. `npm test -- --run src/renderer/services/providerRequestConfig.test.ts src/renderer/services/config.test.ts src/shared/providers/constants.test.ts src/shared/providers/codingPlan.test.ts src/renderer/services/apiRequestHeaders.test.ts`
   - 5 个测试文件通过。
   - 57 条测试通过。
2. `npx tsc --project tsconfig.json --noEmit`
   - 通过。
3. `npx tsc --project electron-tsconfig.json --noEmit`
   - 通过。

后续规划：

1. Provider/模型配置区域当前更适合继续补防退化测试，而不是覆盖式合入 main。
2. 下一批建议转向 OpenClaw runtime patch / packaging helper：
   - patch manifest 与当前 openclaw version 的匹配测试。
   - gateway asar / runtime current 选择边界。
3. 若要继续 Provider，可检查 `api.ts` 的 Responses API streaming 解析是否有低风险测试缺口。

## 2026-05-12：MCP / IM preload 类型收口

本轮继续完成 `preload.ts` 中剩余可安全收口的 IPC contract。MCP create/update、IM config/status/message 在 renderer 层已经有明确类型真源，本轮只让 preload 复用这些类型，不改变 MCP bridge、IM 多实例配置、POPO/Weixin/Feishu/DingTalk/QQ/WeCom 的行为。

本轮代码更新：

1. MCP form data 类型对齐
   - 文件：`src/main/preload.ts`
   - `mcp.create(data)` 从 `any` 收窄为 `McpServerFormData`。
   - `mcp.update(id, data)` 从 `any` 收窄为 `Partial<McpServerFormData>`。
2. IM gateway config 类型对齐
   - 文件：`src/main/preload.ts`
   - `im.setConfig(config)` 从 `any` 收窄为 `Partial<IMGatewayConfig>`。
   - `im.testGateway(..., configOverride)` 从 `any` 收窄为 `Partial<IMGatewayConfig>`。
3. IM 多实例配置类型对齐
   - 文件：`src/main/preload.ts`
   - DingTalk / Feishu / QQ / WeCom instance config setter 分别收窄为对应 `Partial<...InstanceConfig>`。
4. IM event payload 类型对齐
   - 文件：`src/main/preload.ts`
   - `onStatusChange(...)` 收窄为 `IMGatewayStatus`。
   - `onMessageReceived(...)` 收窄为 `IMMessage`。
   - Electron 事件参数使用 `IpcRendererEvent`。

本轮刻意未改：

1. 不改变 IM 多实例 UI 和保存逻辑。
2. 不合入 POPO/IM 大迁移。
3. 不改变 MCP bridge refresh、marketplace、server manager 行为。
4. 不触碰青数品牌、工作台、治理链、唤醒/TTS。

原则校验：

1. KISS
   - 只复用现有 renderer 类型，不新增跨进程类型生成。
2. YAGNI
   - 不借类型收口重构 MCP/IM 配置结构。
3. SOLID
   - preload 仍只负责 bridge，MCP/IM 类型由各自 renderer 类型模块负责。
4. DRY
   - 减少 preload、electron.d.ts、service 三处类型漂移。

本轮验证：

1. `npm test -- --run src/main/im/imScheduledTaskHandler.test.ts src/main/im/imCoworkHandler.test.ts src/main/im/imScheduledTaskAgent.test.ts src/main/im/imStore.test.ts src/renderer/store/slices/imSlice.test.ts src/renderer/components/agent/agentImBindingConfig.test.ts`
   - 6 个测试文件通过。
   - 40 条测试通过。
2. `npx tsc --project electron-tsconfig.json --noEmit`
   - 通过。
3. `npx eslint src/main/preload.ts`
   - 0 error。
   - preload 剩余 5 个历史 `any` warning，均为 `store.set` 或 generic `ipcRenderer.send/on` escape hatch。

后续规划：

1. `preload.ts` 当前低风险类型收口已基本完成，剩余 generic escape hatch 建议保留。
2. 下一步建议回到 main 公共能力差异筛选：
   - provider/model 配置边界。
   - OpenClaw runtime patch 防退化。
   - 构建打包稳定性。
3. 若继续 IM，应另开行为批次，避免类型收口和 POPO/IM 大迁移混做。

## 2026-05-12：OpenClaw progress 与 Cowork permission preload 类型收口

本轮继续收 `preload.ts` 中已有明确类型真源的剩余低风险 `any`。`openclaw.engine.onProgress` 对应 renderer 的 `OpenClawEngineStatus`，`cowork.respondToPermission` 对应 `CoworkPermissionResult`；本轮只把 preload 类型补齐，不改变 OpenClaw 启动状态推送或工具权限响应行为。

本轮代码更新：

1. OpenClaw engine progress 类型对齐
   - 文件：`src/main/preload.ts`
   - `onProgress(...)` 的 callback payload 从 `any` 收窄为 `OpenClawEngineStatus`。
   - Electron 事件参数使用 `IpcRendererEvent`。
2. Cowork permission result 类型对齐
   - 文件：`src/main/preload.ts`
   - `respondToPermission(...)` 的 `result` 从 `any` 收窄为 `CoworkPermissionResult`。

本轮刻意未改：

1. 不改变 OpenClaw gateway lifecycle 或状态机。
2. 不改变权限弹窗的 allow / deny 行为。
3. 不改变 cowork stream 和 message rendering。
4. 不触碰青数品牌、工作台、治理链、唤醒/TTS。

原则校验：

1. KISS
   - 只复用已有 Cowork 类型，不新增 shared 类型迁移。
2. YAGNI
   - 不借类型收口改 OpenClaw runtime adapter。
3. SOLID
   - preload 仍只桥接 IPC，OpenClaw 状态和权限结果由 Cowork 类型定义。
4. DRY
   - 与 `electron.d.ts` 的 contract 保持一致。

本轮验证：

1. `npm test -- --run src/main/libs/agentEngine/openclawRuntimeAdapter.test.ts src/main/libs/openclawEngineManager.test.ts src/renderer/services/cowork.test.ts src/renderer/store/slices/coworkSlice.test.ts`
   - 4 个测试文件通过。
   - 71 条测试通过。
2. `npm test -- --run src/main/libs/agentEngine/openclawRuntimeAdapter.test.ts src/main/libs/openclawEngineManager.test.ts src/renderer/services/cowork.test.ts src/renderer/store/slices/coworkSlice.test.ts src/renderer/services/authSessionReset.test.ts src/main/libs/appUpdateCoordinator.test.ts src/main/libs/appUpdateInstaller.test.ts src/scheduledTask/cronJobService.test.ts src/renderer/services/scheduledTask.test.ts src/renderer/components/scheduledTasks/utils.test.ts src/renderer/store/slices/scheduledTaskSlice.test.ts`
   - 11 个测试文件通过。
   - 128 条测试通过。
3. `npx tsc --project electron-tsconfig.json --noEmit`
   - 通过。
4. `npx eslint --fix src/main/preload.ts`
   - 0 error。
   - preload 历史 `any` warning 降到 19 个。

后续规划：

1. preload 剩余 19 个 warning 主要是：
   - `store.set` / generic `ipcRenderer.send/on` 这种通用 escape hatch。
   - MCP create/update config shape。
   - IM config / multi-instance config shape。
   - IM status/message event payload。
2. 下一步建议停止在 preload 上硬压，转去 `electron.d.ts` / services 中已有类型真源的边界，或回到 main 公共能力差异。
3. MCP/IM 类型 shape 若继续做，需要单独批次，避免和 POPO/IM 大迁移混在一起。

## 2026-05-12：preload 通用事件参数类型收口

本轮继续沿 `preload.ts` 收口 IPC listener 的低风险类型债。范围只限 Electron listener 的 `_event` 参数，从 `any` 改为 `IpcRendererEvent`；业务 payload 结构全部保持原样，因此不会改变 MCP、API stream、窗口状态、speech、wakeInput 或 TTS 的运行行为。

本轮代码更新：

1. 通用 listener event 类型收口
   - 文件：`src/main/preload.ts`
   - `mcp.onBridgeSyncDone(...)` 的 `_event` 使用 `IpcRendererEvent`。
   - `api.onStreamData(...)` / `api.onStreamError(...)` 的 `_event` 使用 `IpcRendererEvent`。
   - `window.onStateChanged(...)` 的 `_event` 使用 `IpcRendererEvent`。
2. 语音相关 listener event 类型收口
   - 文件：`src/main/preload.ts`
   - `speech.onStateChanged(...)` 的 `_event` 使用 `IpcRendererEvent`。
   - `wakeInput.onStateChanged(...)` / `wakeInput.onDictationRequested(...)` 的 `_event` 使用 `IpcRendererEvent`。
   - `tts.onStateChanged(...)` 的 `_event` 使用 `IpcRendererEvent`。

本轮刻意未改：

1. 不改变 speech / wakeInput / TTS 的 payload 类型和行为。
2. 不改变 API stream channel 拼接逻辑。
3. 不修改 MCP / IM 的配置对象 shape。
4. 不触碰青数品牌、工作台、治理链、唤醒/TTS 的业务逻辑。

原则校验：

1. KISS
   - 只替换事件对象类型，不做业务对象建模。
2. YAGNI
   - 不为了清 warning 强行设计 MCP/IM 全量类型。
3. SOLID
   - preload 仍是 IPC bridge，payload 所属模块继续拥有业务结构。
4. DRY
   - 统一使用 Electron 官方事件类型，减少局部 `any`。

本轮验证：

1. `npm test -- --run src/renderer/components/cowork/promptInputHistory.test.ts src/renderer/components/cowork/assistantMetadata.test.ts src/renderer/services/cowork.test.ts src/renderer/store/slices/coworkSlice.test.ts src/main/libs/agentEngine/openclawRuntimeAdapter.test.ts src/renderer/services/authSessionReset.test.ts src/main/libs/appUpdateCoordinator.test.ts src/main/libs/appUpdateInstaller.test.ts src/scheduledTask/cronJobService.test.ts src/renderer/services/scheduledTask.test.ts`
   - 10 个测试文件通过。
   - 113 条测试通过。
2. `npx tsc --project electron-tsconfig.json --noEmit`
   - 通过。
3. `npx eslint src/main/preload.ts`
   - 0 error。
   - preload 历史 `any` warning 从 31 个降到 23 个。

后续规划：

1. preload 剩余 warning 主要集中在：
   - generic `ipcRenderer.send/on` escape hatch。
   - OpenClaw engine progress payload。
   - Cowork permission result。
   - MCP/IM config shape。
2. 下一轮若继续低风险，可先收 `OpenClawEngineStatus` / `CoworkPermissionResult` 这类已有类型真源的项。
3. MCP/IM config shape 仍建议作为独立批次，避免牵动多实例 IM 大迁移。

## 2026-05-12：Cowork stream preload 事件类型收口

本轮继续收 `preload.ts` 中低风险 IPC contract。Cowork stream 事件在 renderer 类型声明中已经要求 `CoworkMessage` / `CoworkPermissionRequest`，但 preload 仍用 `any`。本轮只补类型，不改变对话消息流、权限弹窗、历史展示、唤醒输入或 TTS 行为。

本轮代码更新：

1. Cowork message stream 类型对齐
   - 文件：`src/main/preload.ts`
   - `onStreamMessage(...)` 的 `message` 从 `any` 收窄为 `CoworkMessage`。
   - `onStreamMessageUpdate(...)` 的 Electron 事件参数改为 `IpcRendererEvent`。
2. Cowork permission stream 类型对齐
   - 文件：`src/main/preload.ts`
   - `onStreamPermission(...)` 的 `request` 从 `any` 收窄为 `CoworkPermissionRequest`。
   - `permissionDismiss` / `complete` / `error` 事件参数改为 `IpcRendererEvent`。
3. 类型引用方式
   - 文件：`src/main/preload.ts`
   - 使用 `import type` 引入 renderer cowork 类型，避免增加 preload 运行时依赖。

本轮刻意未改：

1. 不改变 `cowork:stream:*` channel 名称。
2. 不改变 message update metadata 合并逻辑。
3. 不改变对话历史展示和消息窗口策略。
4. 不触碰青数品牌、工作台、治理链、唤醒/TTS。

原则校验：

1. KISS
   - 只把已有 renderer contract 反馈到 preload。
2. YAGNI
   - 不建立新的 shared cowork 类型包。
3. SOLID
   - preload 仍只负责 IPC bridge，消息结构由 Cowork 类型模块负责。
4. DRY
   - 避免 preload 与 `electron.d.ts` 对 stream payload 重复且不一致。

本轮验证：

1. `npm test -- --run src/renderer/services/cowork.test.ts src/renderer/store/slices/coworkSlice.test.ts src/main/libs/agentEngine/openclawRuntimeAdapter.test.ts`
   - 3 个测试文件通过。
   - 62 条测试通过。
2. `npm test -- --run src/renderer/services/cowork.test.ts src/renderer/store/slices/coworkSlice.test.ts src/main/libs/agentEngine/openclawRuntimeAdapter.test.ts src/renderer/services/authSessionReset.test.ts src/main/libs/appUpdateCoordinator.test.ts src/main/libs/appUpdateInstaller.test.ts src/scheduledTask/cronJobService.test.ts src/renderer/services/scheduledTask.test.ts src/renderer/components/scheduledTasks/utils.test.ts src/renderer/store/slices/scheduledTaskSlice.test.ts`
   - 10 个测试文件通过。
   - 119 条测试通过。
3. `npx tsc --project electron-tsconfig.json --noEmit`
   - 通过。
4. `npx eslint --fix src/main/preload.ts`
   - 0 error。
   - preload 历史 `any` warning 从 45 个降到 31 个。

后续规划：

1. 下一批可继续处理 preload 中通用 IPC listener 的 `_event: any`，优先不涉及业务对象的窗口/API stream/MCP bridge done。
2. `mcp` / `im` 的配置对象 `any` 暂缓为独立批次，因为会牵动多实例 IM 和 MCP config shape。
3. 唤醒/TTS 仍保持保护，不在 preload 类型收口中顺手改行为。

## 2026-05-12：Auth / GitHub Copilot preload 事件类型收口

本轮继续小步收 `preload.ts` 中已有明确类型真源的 IPC contract。认证桥接请求、登录回调 payload 已在 `common/auth.ts` 定义，GitHub Copilot token 更新事件 payload 也有固定结构；因此本轮只做类型对齐，不改变青数登录、桥接登录或 Copilot token 刷新行为。

本轮代码更新：

1. Auth bridge 输入类型对齐
   - 文件：`src/main/preload.ts`
   - `createBridgeTicket(input)` 使用 `CreateBridgeTicketRequest`。
   - `exchangeBridgeCode(input)` 使用 `ExchangeBridgeCodeRequest`。
2. Auth 事件 payload 类型对齐
   - 文件：`src/main/preload.ts`
   - `onCallback(...)` 使用 `AuthCallbackPayload`。
   - `onBridgeCode(...)` 和 `onSessionInvalidated(...)` 的 Electron 事件参数使用 `IpcRendererEvent`。
3. GitHub Copilot token 事件类型对齐
   - 文件：`src/main/preload.ts`
   - `onTokenUpdated(...)` 的 Electron 事件参数使用 `IpcRendererEvent`，payload 保持 `{ token, baseUrl }`。

本轮刻意未改：

1. 不改变 QingShu / QTB 登录适配器。
2. 不改变 deep link、bridge ticket、Feishu scan login 的 runtime 行为。
3. 不改变 Copilot token 获取、刷新、登出流程。
4. 不触碰青数品牌、工作台、治理链、唤醒/TTS。

原则校验：

1. KISS
   - 只引用已有认证类型，不新增 auth IPC 常量系统。
2. YAGNI
   - 不借类型收口重构登录流程。
3. SOLID
   - Auth 类型仍由 `common/auth.ts` 拥有，preload 只做桥接。
4. DRY
   - 减少 preload 与 renderer 类型声明中 bridge request 结构重复。

本轮验证：

1. `npm test -- --run src/renderer/services/authSessionReset.test.ts`
   - 1 个测试文件通过。
   - 2 条测试通过。
2. `npx tsc --project electron-tsconfig.json --noEmit`
   - 通过。
3. `npx eslint src/main/preload.ts`
   - 0 error。
   - 仍有 41 个历史 `any` warning，未在本轮扩大处理。

后续规划：

1. 下一批可继续处理 preload 中 Cowork stream event 的局部 `any`，该区域有 `CoworkMessage` / `CoworkPermissionRequest` 类型可复用。
2. `mcp` / `im` 配置对象仍建议独立批次，不与 auth/cowork 小类型收口混合。
3. 唤醒/TTS 区域继续暂缓，除非专门做一次语音链路回归验证。

## 2026-05-12：AppUpdate preload IPC contract 类型收口

本轮继续沿 `preload.ts` 做低风险 IPC contract 类型收口。`shared/appUpdate/constants.ts` 已经提供 App Update 的共享类型，renderer 声明也已使用这些类型，但 preload 仍使用 `any`。本轮只把 preload 对齐到共享类型，并把取消下载的 IPC 调用改为已有常量，不改变更新检查、下载或安装流程。

本轮代码更新：

1. App Update 方法参数类型对齐
   - 文件：`src/main/preload.ts`
   - `setAvailable(info, options)` 从 `any` / `string` 收窄为 `AppUpdateInfo` / `AppUpdateSource`。
2. App Update 事件 payload 类型对齐
   - 文件：`src/main/preload.ts`
   - `onStateChanged(...)` 收窄为 `AppUpdateRuntimeState`。
   - `onDownloadProgress(...)` 收窄为 `AppUpdateDownloadProgress`。
   - Electron 事件参数使用 `IpcRendererEvent`。
3. IPC channel 常量化
   - 文件：`src/main/preload.ts`
   - `cancelDownload()` 从裸字符串 `'appUpdate:cancelDownload'` 改为 `AppUpdateIpc.CancelDownload`。

本轮刻意未改：

1. 不改变 `AppUpdateCoordinator` 状态机。
2. 不改变下载、取消、安装实现。
3. 不修改 Settings / App 中的更新 UI 行为。
4. 不触碰青数品牌、工作台、治理链、唤醒/TTS。

原则校验：

1. KISS
   - 只复用现有共享类型，不新增事件模型。
2. YAGNI
   - 不做 App Update 流程重构。
3. SOLID
   - App Update 类型仍由 shared constants 模块拥有，preload 只做桥接。
4. DRY
   - 减少 preload 与 renderer 声明之间重复维护的结构。

本轮验证：

1. `npm test -- --run src/main/libs/appUpdateCoordinator.test.ts src/main/libs/appUpdateInstaller.test.ts`
   - 2 个测试文件通过。
   - 17 条测试通过。
2. `npm test -- --run src/main/libs/appUpdateCoordinator.test.ts src/main/libs/appUpdateInstaller.test.ts src/scheduledTask/cronJobService.test.ts src/renderer/services/scheduledTask.test.ts src/renderer/components/scheduledTasks/utils.test.ts src/renderer/store/slices/scheduledTaskSlice.test.ts`
   - 6 个测试文件通过。
   - 55 条测试通过。
3. `npx tsc --project electron-tsconfig.json --noEmit`
   - 通过。
4. `npx eslint --fix src/main/preload.ts`
   - 0 error。
   - 仍有 45 个历史 `any` warning，未在本轮扩大处理。

后续规划：

1. 下一批可继续收 `auth` / `githubCopilot` 事件 payload 的 preload 类型，二者已有较清晰的局部结构。
2. `mcp` / `im` 的 preload `any` 涉及配置对象和多实例迁移，建议单独批次处理。
3. 唤醒/TTS 相关 warning 暂不动，避免影响当前已优化过的唤醒开麦和 TTS 缓存体验。

## 2026-05-12：ScheduledTasks preload IPC contract 类型收口

本轮继续做低耦合公共能力收口，范围限定在 `preload.ts` 的 scheduled task IPC contract 类型。此前底层 `handlers.ts` 和 renderer 类型声明已经支持 `RunFilter`，但 preload 仍保留 `filter?: any`、`create/update input: any` 和运行事件 `data: any`。本轮只把 preload 对齐到已有类型真源，不改变 IPC channel、参数顺序或业务行为。

本轮代码更新：

1. scheduled task IPC 参数类型对齐
   - 文件：`src/main/preload.ts`
   - `create(input)` 从 `any` 收窄为 `ScheduledTaskInput`。
   - `update(id, input)` 从 `any` 收窄为 `Partial<ScheduledTaskInput>`。
   - `listRuns(...)` / `listAllRuns(...)` 的 `filter` 从 `any` 收窄为 `RunFilter`。
2. scheduled task 事件类型对齐
   - 文件：`src/main/preload.ts`
   - `onStatusUpdate(...)` 的事件 payload 收窄为 `ScheduledTaskStatusEvent`。
   - `onRunUpdate(...)` 的事件 payload 收窄为 `ScheduledTaskRunEvent`。
   - Electron 事件参数使用 `IpcRendererEvent`。
3. import 顺序收口
   - 文件：`src/main/preload.ts`
   - 使用现有 ESLint 规则修复 import 排序。

本轮刻意未改：

1. 不改变 scheduled task handler、cron service、renderer service 的运行逻辑。
2. 不搬 `origin/main` 的定时任务 UI 大布局。
3. 不批量清理 preload 中其他模块的历史 `any` warning，避免扩大范围。
4. 不触碰青数品牌、工作台、治理链、唤醒/TTS。

原则校验：

1. KISS
   - 只对齐已有类型真源，不新增 IPC 抽象层。
2. YAGNI
   - 不趁机做 preload 全量类型重构。
3. SOLID
   - scheduled task 类型仍由 `scheduledTask/types.ts` 拥有，preload 只做安全透传。
4. DRY
   - 避免 renderer 声明、handler 与 preload 三处重复定义 filter/event 结构。

本轮验证：

1. `npm test -- --run src/scheduledTask/cronJobService.test.ts src/renderer/services/scheduledTask.test.ts src/renderer/components/scheduledTasks/utils.test.ts src/renderer/store/slices/scheduledTaskSlice.test.ts`
   - 4 个测试文件通过。
   - 38 条测试通过。
2. `npx tsc --project electron-tsconfig.json --noEmit`
   - 通过。
3. `npx eslint --fix src/main/preload.ts`
   - 0 error。
   - 仍有 52 个历史 `any` warning，未在本轮扩大处理。

后续规划：

1. 下一批继续筛 `preload.ts` 中低风险、已有类型真源的 IPC contract，优先 app update / auth / GitHub Copilot 这类事件 payload，不碰唤醒/TTS 行为。
2. 若继续 scheduled task，可检查运行历史筛选 UI 和执行中反馈是否还有 main 的低风险 bugfix 可收。
3. 高耦合内容继续独立批次处理：主控台 UI、POPO/IM 大迁移、OpenClaw 主干重构、per-agent modelSlice。

## 2026-05-12：electron-builder hook 测试隔离修复

本轮收口上一轮组合测试暴露的并发隔离问题：`electronBuilderHooks.test.ts` 过去会在测试中临时覆盖仓库根目录 `package.json`，当 Vitest 并行执行时，Vite 可能在写入窗口读到空文件，从而报 `JSONError: package.json File is empty`。本轮改成测试专用临时 `package.json`，不再触碰真实项目配置文件。

本轮代码更新：

1. 预安装插件校验支持测试注入
   - 文件：`scripts/electron-builder-hooks.cjs`
   - `verifyPreinstalledPlugins(runtimeRoot, buildHint, options)` 新增可选 `packageJsonPath`。
   - 生产路径默认仍读取仓库根目录 `package.json`，真实打包行为不变。
2. electron-builder hook 测试隔离
   - 文件：`src/main/libs/electronBuilderHooks.test.ts`
   - 删除测试中覆盖真实 `package.json` 的 helper。
   - 改为在系统临时目录生成测试专用 `package.json`，并通过 `packageJsonPath` 注入。
   - 修复该测试文件 import 顺序，保持 lint 规则一致。

本轮刻意未改：

1. 不改变 OpenClaw runtime 打包、同步、插件校验的生产逻辑。
2. 不改变 macOS speech/TTS helper 的构建行为。
3. 不触碰青数品牌、工作台、治理链、唤醒/TTS。
4. 不扩大到 POPO/IM 大迁移、OpenClaw 主干重构、per-agent modelSlice。

原则校验：

1. KISS
   - 只给已有校验函数增加测试注入点，不引入新的配置系统。
2. YAGNI
   - 不为测试问题改生产流程，只隔离测试输入。
3. SOLID
   - `verifyPreinstalledPlugins` 仍只负责插件存在性校验，文件来源通过参数注入，职责更清晰。
4. DRY
   - 测试继续复用生产校验函数，不复制插件校验逻辑。

本轮验证：

1. `npm test -- --run src/main/libs/electronBuilderHooks.test.ts`
   - 1 个测试文件通过。
   - 7 条测试通过。
2. `npm test -- --run src/main/coworkStore.agent.test.ts src/main/coworkStore.metadata.test.ts src/main/libs/openclawConfigSync.test.ts src/main/libs/openclawHistory.test.ts src/main/libs/openclawRuntimePackaging.test.ts src/main/libs/openclawTranscript.test.ts src/main/libs/pruneOpenClawRuntime.test.ts src/renderer/components/agent/agentPersistedDraft.test.ts src/scheduledTask/cronJobService.test.ts src/main/im/imScheduledTaskHandler.test.ts src/main/im/imCoworkHandler.test.ts src/main/im/imStore.test.ts src/main/libs/agentEngine/openclawRuntimeAdapter.test.ts src/main/libs/electronBuilderHooks.test.ts src/main/libs/applyOpenClawPatches.test.ts`
   - 15 个测试文件通过。
   - 187 条测试通过。
3. `npx eslint src/main/libs/electronBuilderHooks.test.ts`
   - 0 error。
4. `npx tsc --project electron-tsconfig.json --noEmit`
   - 通过。

后续规划：

1. 下一批优先做 `preload.ts` / `electron.d.ts` IPC contract 类型收口，范围限定在类型约束，不改变 IPC 行为。
2. 继续补构建打包 helper 的低风险测试，尤其避免再出现测试污染真实仓库文件。
3. Hook dependency warning 涉及唤醒/TTS 与输入框体验，保留为独立谨慎批次。

## 2026-05-12：已改 TS 文件 import/export 排序收口

本轮对当前已改 TypeScript 文件做了一次集中 lint 扫描，发现 23 个 `simple-import-sort` / `simple-import-sort/exports` 格式性 error。该批问题均为自动排序类阻塞，不涉及业务行为；因此本轮只做 import/export 排序收口，并额外去掉一个测试 helper 的 `any`。

本轮代码更新：

1. import/export 排序自动修复
   - 文件：`src/main/coworkStore.agent.test.ts`
   - 文件：`src/main/coworkStore.metadata.test.ts`
   - 文件：`src/main/im/imCoworkHandler.ts`
   - 文件：`src/main/libs/agentEngine/coworkEngineRouter.ts`
   - 文件：`src/main/libs/agentEngine/types.ts`
   - 文件：`src/main/libs/openclawChannelSessionSync.ts`
   - 文件：`src/main/libs/openclawConfigSync.test.ts`
   - 文件：`src/main/libs/openclawHistory.test.ts`
   - 文件：`src/main/libs/openclawRuntimePackaging.test.ts`
   - 文件：`src/main/libs/openclawTranscript.test.ts`
   - 文件：`src/main/libs/pruneOpenClawRuntime.test.ts`
   - 文件：`src/main/sqliteStore.ts`
   - 文件：`src/renderer/components/agent/agentPersistedDraft.test.ts`
   - 文件：`src/renderer/components/cowork/CoworkPromptInput.tsx`
   - 文件：`src/renderer/components/cowork/CoworkSessionDetail.tsx`
   - 文件：`src/renderer/components/cowork/CoworkView.tsx`
   - 文件：`src/renderer/components/icons/providers/index.ts`
   - 文件：`src/renderer/components/scheduledTasks/AllRunsHistory.tsx`
   - 文件：`src/renderer/components/scheduledTasks/TaskDetail.tsx`
   - 文件：`src/renderer/components/scheduledTasks/TaskForm.tsx`
   - 文件：`src/renderer/types/electron.d.ts`
   - 文件：`src/scheduledTask/cronJobService.test.ts`
   - 文件：`src/scheduledTask/types.ts`
2. 测试 helper 类型收口
   - 文件：`src/main/coworkStore.agent.test.ts`
   - `createAgentsTable(db: any, ...)` 改为 `createAgentsTable(db: initSqlJs.Database, ...)`。

本轮刻意未改：

1. 不处理 `CoworkPromptInput.tsx` 中唤醒/语音相关 Hook dependency warning。
2. 不处理 `Settings.tsx` 中 TTS / notice Hook dependency warning。
3. 不批量收窄 `preload.ts` / `electron.d.ts` 的 IPC `any`，这需要单独 contract 批次。
4. 不改变任何 UI、工作台、治理链、唤醒/TTS 行为。

原则校验：

1. KISS
   - 只修自动排序和单个测试 helper 类型。
2. YAGNI
   - 不为了清 warning 扩大到 Hook 行为调整。
3. SOLID
   - 不改变模块职责，只让文件符合统一格式规则。
4. DRY
   - 继续依赖统一 ESLint import/export sort 规则。

本轮验证：

1. `npx eslint ...`
   - 针对本轮排序收口文件重跑后 0 error / 0 warning。
2. `npm test -- --run src/main/coworkStore.agent.test.ts src/main/coworkStore.metadata.test.ts src/main/libs/openclawConfigSync.test.ts src/main/libs/openclawHistory.test.ts src/main/libs/openclawRuntimePackaging.test.ts src/main/libs/openclawTranscript.test.ts src/main/libs/pruneOpenClawRuntime.test.ts src/renderer/components/agent/agentPersistedDraft.test.ts src/scheduledTask/cronJobService.test.ts`
   - 9 个测试文件通过。
   - 104 条测试通过。
3. `npx tsc --project electron-tsconfig.json --noEmit`
   - 通过。

后续规划：

1. 若继续低风险收口，建议拆 `preload.ts` / `electron.d.ts` IPC contract 类型批次。
2. Hook dependency warning 涉及唤醒/TTS 与对话输入行为，建议单独评估，不与格式收口混做。
3. 若要进入验收交付，下一步可以打 `.app` 并做 OpenClaw gateway 启动验证。

## 2026-05-12：OpenClaw gateway.asar packaging summary 防退化

本轮继续构建打包稳定性收口，选择纯测试增强，不改变真实 packaging 行为。目标是防止后续 OpenClaw gateway.asar 入口文件判断退化，尤其是 `entry.js` / `entry.mjs` 两种入口形式，以及缺少关键文件时的 summary 状态。

本轮代码更新：

1. gateway.asar summary 测试补强
   - 文件：`src/main/libs/openclawRuntimePackaging.test.ts`
   - 新增 `entry.mjs` 被识别为 gateway entry 的测试。
   - 新增缺少 `openclaw.mjs` / `entry.*` 时 summary 返回 false 的测试。

本轮刻意未改：

1. 不改变 `scripts/openclaw-runtime-packaging.cjs` 生产逻辑。
2. 不改变 finalize runtime、sync runtime current、electron-builder hook 的真实执行路径。
3. 不执行真实 OpenClaw runtime finalize 或 `.app` 打包。

原则校验：

1. KISS
   - 只补两个边界测试。
2. YAGNI
   - 不新增 gateway.asar validator 抽象。
3. SOLID
   - packaging helper 继续只负责路径 summary / prune。
4. DRY
   - 测试直接调用现有 `summarizeGatewayAsarEntries(...)`。

本轮验证：

1. `npm test -- --run src/main/libs/openclawRuntimePackaging.test.ts src/main/libs/electronBuilderHooks.test.ts src/main/libs/pruneOpenClawRuntime.test.ts src/main/libs/applyOpenClawPatches.test.ts`
   - 4 个测试文件通过。
   - 21 条测试通过。
2. `npx tsc --project electron-tsconfig.json --noEmit`
   - 通过。

后续规划：

1. 继续优先做低风险测试补强和 lint/TS 收口。
2. 如果进入真实打包验证，需要单独执行 `.app` 构建并检查 OpenClaw gateway 启动。
3. 高耦合迁移继续保持独立批次，不混入本轮稳定性收口。

## 2026-05-12：OpenClaw runtime 打包目标映射防退化

本轮继续处理构建打包稳定性中的低耦合区域。当前不执行真实打包，也不改变 electron-builder hook 的运行路径；只把已有 runtime target / build hint 解析函数暴露给测试，并补充平台与架构映射用例，避免后续 mac/win/linux runtime 包选择错误。

本轮代码更新：

1. 打包 hook 测试出口补齐
   - 文件：`scripts/electron-builder-hooks.cjs`
   - 在 `__test__` 中导出 `resolveOpenClawRuntimeTargetId`。
   - 在 `__test__` 中导出 `getOpenClawRuntimeBuildHint`。
2. OpenClaw runtime target 映射测试
   - 文件：`src/main/libs/electronBuilderHooks.test.ts`
   - 覆盖 `darwin arm64/x64 -> mac-arm64/mac-x64`。
   - 覆盖 `win32 arm64/x64 -> win-arm64/win-x64`。
   - 覆盖 `linux arm64/x64 -> linux-arm64/linux-x64`。
   - 覆盖未知平台回退到 host runtime build hint。

本轮刻意未改：

1. 不改变 `beforePack(...)` / `afterPack(...)` 实际打包流程。
2. 不改 OpenClaw runtime 同步、插件校验、gateway bundle 校验。
3. 不执行 `.app` 或 `.dmg` 打包。
4. 不触碰青数唤醒/TTS helper 的构建逻辑，只保留已有测试覆盖。

原则校验：

1. KISS
   - 只导出已有纯函数并补测试。
2. YAGNI
   - 不新增 runtime target 配置系统。
3. SOLID
   - target 解析职责仍在 electron-builder hook 内。
4. DRY
   - 测试复用生产函数，不复制映射逻辑。

本轮验证：

1. `npm test -- --run src/main/libs/electronBuilderHooks.test.ts src/main/libs/pruneOpenClawRuntime.test.ts src/main/libs/applyOpenClawPatches.test.ts`
   - 3 个测试文件通过。
   - 16 条测试通过。
2. `npx tsc --project electron-tsconfig.json --noEmit`
   - 通过。

后续规划：

1. 继续从构建打包稳定性中筛选“纯函数 / 可测化 / 不改变真实打包行为”的低风险点。
2. 若用户要求交付测试包，再单独执行 `.app` 打包验证。
3. OpenClaw 主干重构、POPO/IM 大迁移、per-agent modelSlice 仍保持独立批次。

## 2026-05-12：OpenClaw transcript import 稳定性收口

本轮继续筛 OpenClaw runtime / history / transcript 这条低耦合公共能力链。实际扫描发现核心逻辑当前 lint 已基本干净，仅 `openclawTranscript.ts` 存在 import 排序 error；因此本轮只修复格式性阻塞，不扩大到 OpenClaw 主干重构。

本轮代码更新：

1. OpenClaw transcript import 排序
   - 文件：`src/main/libs/openclawTranscript.ts`
   - 使用现有 ESLint 规则修复 import 排序。

本轮刻意未改：

1. 不改变 transcript 构造、history extraction、channel session sync 行为。
2. 不改变 gateway restart、runtime adapter、config sync 逻辑。
3. 不触碰 OpenClaw 主干重构和运行时版本更新。

原则校验：

1. KISS
   - 只修阻塞性 lint error，不搭车重构。
2. YAGNI
   - 不为了“顺手”改 transcript 数据结构。
3. SOLID
   - 保持 transcript 模块职责不变。
4. DRY
   - 继续使用统一 import sort 规则。

本轮验证：

1. `npx eslint src/main/libs/agentEngine/openclawRuntimeAdapter.ts src/main/libs/openclawConfigSync.ts src/main/libs/openclawEngineManager.ts src/main/libs/openclawAgentModels.ts src/main/libs/openclawHistory.ts src/main/libs/openclawTranscript.ts`
   - 0 error。
   - 0 warning。
2. `npm test -- --run src/main/libs/agentEngine/openclawRuntimeAdapter.test.ts src/main/libs/openclawTranscript.test.ts src/main/libs/openclawHistory.test.ts src/main/libs/openclawConfigSync.test.ts src/main/libs/openclawConfigSync.runtime.test.ts src/main/libs/openclawAgentModels.test.ts`
   - 6 个测试文件通过。
   - 151 条测试通过。
3. `npx tsc --project electron-tsconfig.json --noEmit`
   - 通过。

后续规划：

1. 下一步建议继续从构建打包稳定性脚本和 OpenClaw runtime packaging 测试入手。
2. 若要继续 IM，则建议另开结构拆分批次，避免 `imGatewayManager.ts` 单文件继续膨胀。
3. 高耦合项仍保持独立批次：POPO/IM 大迁移、per-agent modelSlice、OpenClaw 主干重构。

## 2026-05-12：IM 响应结构化与错误类型收口

本轮继续处理 IM 层剩余的低耦合类型债，重点是 `imChatHandler.ts`、`imGatewayManager.ts`、`imStore.ts` 中不会改变业务行为的 `any` 和未使用引用。未触碰 POPO/IM 大迁移、多实例 UI、OpenClaw 主干重构，也未改变青数品牌、工作台、治理链、唤醒/TTS。

本轮代码更新：

1. IM LLM 响应结构化
   - 文件：`src/main/im/imChatHandler.ts`
   - 新增 Anthropic message body / response text block 的窄类型。
   - 新增 OpenAI compatible response / Responses API output 的窄类型。
   - 删除该文件中的 response body `any`。
2. IM Gateway 错误类型收口
   - 文件：`src/main/im/imGatewayManager.ts`
   - 新增 `getErrorMessage(error: unknown)`。
   - 将 message processing、connectivity probe、通知发送、DingTalk route prime、config schema、Feishu credential verify 等 catch 从 `any` 改为 unknown 安全读取。
3. IM Gateway 动态 SDK 类型收口
   - 文件：`src/main/im/imGatewayManager.ts`
   - Lark namespace 使用 `typeof import('@larksuiteoapi/node-sdk')`。
   - Feishu bot info response 使用本地窄类型 `FeishuBotInfoResponse`。
   - Feishu auth helper 缓存使用 `typeof import('@larksuite/openclaw-lark-tools/dist/utils/feishu-auth.js')`。
4. Notification target 类型收口
   - 文件：`src/main/im/imStore.ts`
   - `notification_target:${platform}` 的读写从 `any` 收窄为 `string | null` / `string`。
5. 删除明显未使用引用
   - 文件：`src/main/im/imGatewayManager.ts`
   - 移除未使用的 `path` import。
   - 移除 `startGateway(...)` 中未使用的 `config`。
   - `sendNotification(...)` / `sendNotificationWithMedia(...)` 暂未使用的 `text` 改为 `_text`。

本轮刻意未改：

1. 不改变 IM provider / platform 的连通性判定。
2. 不改变 Feishu、DingTalk、QQ、Discord、Telegram 的探测 URL 和探测顺序。
3. 不改变 OpenClaw gateway client request 行为。
4. 不重构 `imGatewayManager.ts` 的大文件结构。

原则校验：

1. KISS
   - 使用局部窄类型和 unknown guard，不引入新解析框架。
2. YAGNI
   - 不为动态 SDK 建完整类型镜像，只描述当前使用字段。
3. SOLID
   - IMChatHandler 仍只负责调用 LLM 并抽取文本，Gateway 仍只做连接和转发管理。
4. DRY
   - 错误消息提取集中到 `getErrorMessage(...)`。

本轮验证：

1. `npx eslint src/main/im/imGatewayManager.ts src/main/im/imChatHandler.ts src/main/im/imStore.ts`
   - 0 error。
   - 0 warning。
2. `npm test -- --run src/main/im/imScheduledTaskHandler.test.ts src/main/im/imCoworkHandler.test.ts src/main/im/imScheduledTaskAgent.test.ts src/main/im/imStore.test.ts`
   - 4 个测试文件通过。
   - 20 条测试通过。
3. `npx tsc --project electron-tsconfig.json --noEmit`
   - 通过。

后续规划：

1. 继续筛选 OpenClaw runtime patch / 构建打包稳定性中的低耦合差异。
2. `imGatewayManager.ts` 仍建议后续做结构拆分，但应作为独立重构批次，不与本轮类型收口混合。
3. POPO/IM 大迁移、per-agent modelSlice、OpenClaw 主干重构继续保持独立规划。

## 2026-05-12：OpenClaw 延后重启死代码收口

本轮专门评估 `main.ts` 中最后一个 warning：`scheduleDeferredGatewayRestart(...)` 未使用。核对真实链路后确认，当前生效策略已经是“立即写入 OpenClaw 配置，只在需要硬重启网关时根据 active workloads 延后重启”。因此旧的 soft deferred sync restart 函数不再接线，可以删除；保留并验证现有 `scheduleDeferredHardGatewayRestart(...)`。

本轮代码更新：

1. 删除未接线的 soft deferred restart 代码
   - 文件：`src/main/main.ts`
   - 删除 `deferredRestartTimer` / `deferredRestartTimeout`。
   - 删除 `clearDeferredRestart()`。
   - 删除 `executeDeferredGatewayRestart()`。
   - 删除 `scheduleDeferredGatewayRestart()`。
2. 保留真正生效的硬重启延后策略
   - 文件：`src/main/main.ts`
   - `requestGatewayRestart(...)` 仍在 active workloads 存在时调用 `scheduleDeferredHardGatewayRestart(...)`。
   - `syncOpenClawConfig(...)` 仍在配置变更需要 gateway hard restart 且存在 active workloads 时调用 `scheduleDeferredHardGatewayRestart(...)`。
   - `hasActiveGatewayWorkloads()` 仍覆盖 active cowork session、MCP bridge refresh、cron running jobs。

本轮刻意未改：

1. 不改变 OpenClaw config sync 的“先写配置、后评估硬重启”策略。
2. 不改变 active workload 判定范围。
3. 不新增 gateway restart 队列或 UI 提示。
4. 不触碰青数唤醒/TTS、治理链和工作台 UI。

原则校验：

1. KISS
   - 删除未接线死代码，减少两套延后重启概念并存。
2. YAGNI
   - 不保留未来可能使用的 soft restart 路径。
3. SOLID
   - hard restart 延后职责仍集中在 `requestGatewayRestart(...)` / `syncOpenClawConfig(...)`。
4. DRY
   - 避免 soft/hard 两套路由重复维护定时器。

本轮验证：

1. `npx eslint src/main/main.ts`
   - 0 error。
   - 0 warning。
2. `npm test -- --run src/main/libs/agentEngine/openclawRuntimeAdapter.test.ts src/main/ipcHandlers/scheduledTask/helpers.test.ts src/scheduledTask/cronJobService.test.ts`
   - 3 个测试文件通过。
   - 77 条测试通过。
3. `npx tsc --project electron-tsconfig.json --noEmit`
   - 通过。

后续规划：

1. 下一批继续小步筛 OpenClaw runtime patch / 构建打包稳定性中的低耦合差异。
2. IM 文件内剩余 `any` warning 建议拆成“IM 响应结构化与错误处理类型”批次。
3. POPO/IM 大迁移、per-agent modelSlice、OpenClaw 主干重构仍保持独立批次，不与当前保护区混合。

## 2026-05-12：macOS Calendar 权限检查类型收口

本轮继续收掉 `main.ts` 中最后一个低风险 `catch (error: any)`。该逻辑只用于 macOS Calendar 权限探测，不涉及青数登录、工作台、治理链、唤醒/TTS 或 OpenClaw 网关启动策略。

本轮代码更新：

1. Calendar permission catch 类型收窄
   - 文件：`src/main/main.ts`
   - `catch (error: any)` 改为 `catch (error)`。
   - 通过 `error && typeof error === 'object' && 'stderr' in error` 安全提取 `stderr`。
   - 保留原有 `osascript` 探测命令、权限错误关键词和返回值。

本轮刻意未改：

1. 不调整 macOS 权限申请流程。
2. 不改变 Windows Outlook 可用性检查。
3. 不处理 `scheduleDeferredGatewayRestart(...)`，它仍需要并入网关重启策略批次评估。

原则校验：

1. KISS
   - 只用内联 unknown guard，不增加 helper。
2. YAGNI
   - 不引入完整 child_process error 类型封装。
3. SOLID
   - 权限检查仍只负责权限探测，不混入 UI 或重试策略。
4. DRY
   - 沿用原有错误关键词判断，不复制额外分支。

本轮验证：

1. `npx eslint src/main/main.ts src/main/ipcHandlers/scheduledTask/handlers.ts src/main/ipcHandlers/scheduledTask/helpers.ts src/main/im/imChatHandler.ts src/main/im/imScheduledTaskHandler.ts src/main/im/imGatewayManager.ts`
   - 0 error。
   - `main.ts` 仅剩 `scheduleDeferredGatewayRestart(...)` 1 个 warning。
2. `npm test -- --run src/main/ipcHandlers/scheduledTask/helpers.test.ts src/main/im/imScheduledTaskHandler.test.ts src/scheduledTask/cronJobService.test.ts src/main/im/imCoworkHandler.test.ts src/main/im/imScheduledTaskAgent.test.ts src/main/libs/agentEngine/openclawRuntimeAdapter.test.ts`
   - 6 个测试文件通过。
   - 88 条测试通过。
3. `npx tsc --project electron-tsconfig.json --noEmit`
   - 通过。

后续规划：

1. 下一步应单独评估 `scheduleDeferredGatewayRestart(...)`：优先确认它是否应重新接入“任务运行中延后重启网关”的策略，而不是直接删除。
2. 继续小步筛 OpenClaw runtime patch / 构建打包稳定性中的低耦合剩余项。
3. IM 文件中仍有大量历史 `any` warning，建议作为“IM 响应结构化与错误类型”单独批次处理，避免和 POPO/IM 大迁移混在一起。

## 2026-05-12：Scheduled Task helper 依赖类型收口

本轮继续处理 `main.ts` 剩余的 scheduled task helper cast。该批次只收窄 IPC 注册时的依赖注入类型，不改变定时任务创建、IM 通道列表、OpenClaw cron 调用和青数工作台展示逻辑。

本轮代码更新：

1. main 侧 IM Gateway getter 类型明确化
   - 文件：`src/main/main.ts`
   - `getIMGatewayManager()` 显式标注返回 `IMGatewayManager`。
2. 删除 scheduled task 注册处的 `as any`
   - 文件：`src/main/main.ts`
   - `initScheduledTaskHelpers(...)` 不再把 `getIMGatewayManager()` cast 为 `any`。
   - `registerScheduledTaskHandlers(...)` 不再把 `getIMGatewayManager()` / `openClawRuntimeAdapter` cast 为 `any`。
3. helper 依赖类型对齐真实 IM 配置
   - 文件：`src/main/ipcHandlers/scheduledTask/helpers.ts`
   - `getConfig()` 从 `Record<string, unknown>` 改为 `IMGatewayConfig`。
   - 保留 helper 内部按 `Record<string, unknown>` 遍历的局部转换，因为这里确实需要枚举配置 key。

本轮刻意未改：

1. 不改变定时任务 IM channel 派生规则。
2. 不改变 DingTalk reply route prime 逻辑。
3. 不改变 OpenClaw cron job service 的 gateway ready 策略。
4. 不处理 `scheduleDeferredGatewayRestart(...)`，该函数需要和网关重启延后策略统一评估。

原则校验：

1. KISS
   - 用已有 `IMGatewayManager` / `IMGatewayConfig` 直接替代 `any`。
2. YAGNI
   - 不新增中间 adapter，不扩展 scheduled task contract。
3. SOLID
   - scheduled task handler/helper 仍只依赖最小方法集合。
4. DRY
   - 复用 IM 模块真实配置类型，避免 helper 自己维护一份伪 schema。

本轮验证：

1. `npx eslint src/main/main.ts src/main/ipcHandlers/scheduledTask/handlers.ts src/main/ipcHandlers/scheduledTask/helpers.ts`
   - 0 error。
   - `main.ts` warning 降为 2 个，scheduled task helper cast warning 已清除。
2. `npm test -- --run src/main/ipcHandlers/scheduledTask/helpers.test.ts src/main/im/imScheduledTaskHandler.test.ts src/scheduledTask/cronJobService.test.ts`
   - 3 个测试文件通过。
   - 29 条测试通过。
3. `npx tsc --project electron-tsconfig.json --noEmit`
   - 通过。

后续规划：

1. 下一批处理 macOS Calendar permission `catch (error: any)`。
2. `scheduleDeferredGatewayRestart(...)` 保留到网关重启策略批次，避免误删“任务运行中延后重启”的保护钩子。
3. 之后继续筛选低耦合公共能力，优先 OpenClaw runtime patch 和构建稳定性，不碰青数覆盖层。

## 2026-05-12：IM LLM 配置类型收口

本轮继续处理上一批遗留的 IM LLM config provider `any`。这块属于低耦合公共能力：只收窄配置类型边界，不调整 IM provider 选择顺序、不改 OpenClaw 网关、不改青数工作台和治理链。

本轮代码更新：

1. 新增 IM 共享 LLM 配置类型
   - 文件：`src/main/im/types.ts`
   - 新增 `IMLLMConfig`，统一描述 IM 聊天、IM 定时任务识别、IM Gateway 初始化所需的 `apiKey/baseUrl/model/provider`。
2. 移除重复局部类型
   - 文件：`src/main/im/imChatHandler.ts`
   - 文件：`src/main/im/imScheduledTaskHandler.ts`
   - 删除两个文件内各自维护的 `LLMConfig`，统一改用 `IMLLMConfig`。
3. IM Gateway LLM provider 类型收口
   - 文件：`src/main/im/imGatewayManager.ts`
   - `getLLMConfig` 从 `Promise<any>` 改为 `Promise<IMLLMConfig | null>`。
   - `initialize(...)` 入参同步收窄。
4. main 侧 app_config 快照类型收口
   - 文件：`src/main/main.ts`
   - 新增窄口径 `IMAppConfigSnapshot` / `IMProviderConfigSnapshot`。
   - `sqliteStore.get<any>('app_config')` 改为 `sqliteStore.get<IMAppConfigSnapshot>('app_config')`。
   - 删除 `Object.entries(providers) as [string, any][]`。

本轮刻意未改：

1. 不改变 IM LLM provider 的选择策略，仍使用第一个 enabled 且存在 apiKey 的 provider。
2. 不迁移 per-agent modelSlice，也不调整 QingShu server proxy / MiniMax OAuth / OpenAI Codex auth 路径。
3. 不处理 IM 大迁移和 OpenClaw 主干重构。
4. 不处理 `imChatHandler.ts` 的 axios response body `any`，这属于下一批 API 响应结构化收口。

原则校验：

1. KISS
   - 只把重复接口抽到 IM 类型源，不引入新的配置解析器。
2. YAGNI
   - 不扩展 provider schema，不提前做 per-agent 模型配置大迁移。
3. SOLID
   - IM Gateway 继续只依赖“获取 LLM 配置”的抽象函数，不关心配置存储细节。
4. DRY
   - 消除 `imChatHandler.ts` 与 `imScheduledTaskHandler.ts` 的重复 `LLMConfig`。

本轮验证：

1. `npx eslint --fix src/main/im/imChatHandler.ts src/main/im/imScheduledTaskHandler.ts src/main/im/imGatewayManager.ts src/main/main.ts`
   - 0 error。
   - 剩余 warning 为既有历史债，当前批次相关的 IM config provider `any` 已清除。
2. `npm test -- --run src/main/im/imCoworkHandler.test.ts src/main/im/imScheduledTaskHandler.test.ts src/main/im/imScheduledTaskAgent.test.ts src/main/libs/agentEngine/openclawRuntimeAdapter.test.ts`
   - 4 个测试文件通过。
   - 66 条测试通过。
3. `npx tsc --project electron-tsconfig.json --noEmit`
   - 通过。

后续规划：

1. 下一批优先处理 `main.ts` 中 scheduled task helper cast 的低风险类型收口。
2. macOS Calendar permission `catch (error: any)` 可作为独立小批次处理。
3. `scheduleDeferredGatewayRestart(...)` 暂不删除，需要和网关延后重启策略一起评估。

## 2026-05-12：main.ts Cowork / MCP IPC 类型收口

本轮继续逐块收窄 `main.ts` 中的跨模块 `any`，优先处理最独立的 Cowork runtime forwarder 与 MCP create/update IPC。两者都有现成共享类型，适合低风险收口。

本轮代码更新：

1. Cowork stream message 类型收口
   - 文件：`src/main/main.ts`
   - `sanitizeCoworkMessageForIpc(...)` 入参与返回值从 `any` 改为 `CoworkMessage`。
   - `runtime.on('message', ...)` 的 `message` 从 `any` 改为 `CoworkMessage`。
   - metadata sanitize 后显式回到 `CoworkMessage['metadata']`。
2. Cowork permission request 类型收口
   - 文件：`src/main/main.ts`
   - `sanitizePermissionRequestForIpc(...)` 入参与返回值从 `any` 改为 `PermissionRequest`。
   - `runtime.on('permissionRequest', ...)` 的 `request` 从 `any` 改为 `PermissionRequest`。
   - `toolInput` sanitize 后显式回到 `PermissionRequest['toolInput']`。
3. MCP create/update IPC 类型收口
   - 文件：`src/main/main.ts`
   - `mcp:create` 入参改为 `McpServerFormData`。
   - `mcp:update` 入参改为 `Partial<McpServerFormData>`。
   - 删除传给 `McpStore` 时的 `as any`。

本轮刻意未改：

1. 不改变实际发送给 renderer 的 Cowork stream payload。
2. 不改变 MCP server 存储和 bridge refresh 行为。
3. 不处理 IM LLM config provider、scheduled task helper cast、macOS Calendar permission catch。
   - 这些进入后续独立小批次。
4. 不处理 `scheduleDeferredGatewayRestart(...)`，避免误伤网关延后重启策略。

原则校验：

1. KISS
   - 直接复用已有 `CoworkMessage`、`PermissionRequest`、`McpServerFormData`。
2. YAGNI
   - 不新增 runtime validator，不改变 IPC 行为。
3. SOLID
   - sanitizer 继续只负责 IPC 安全裁剪，不承担业务转换。
4. DRY
   - main 侧和 store / runtime 侧共享同一类型定义。

本轮验证：

1. `npm test -- --run src/main/libs/mcpServerManager.test.ts src/main/libs/agentEngine/openclawRuntimeAdapter.test.ts src/renderer/services/cowork.test.ts`
   - 3 个测试文件通过。
   - 64 条测试通过。
2. `npx tsc --project electron-tsconfig.json --noEmit`
   - 通过。
3. `npx eslint src/main/main.ts`
   - 0 error。
   - warning 从 15 个降到 7 个。

后续规划：

1. 下一批处理 IM LLM config provider 的 `any`，需要先补 IM 层共享 LLMConfig 类型。
2. 再下一批处理 scheduled task helper casts。
3. macOS Calendar permission catch 和 deferred gateway restart 单独评估。

## 2026-05-12：基础设施 import 与安全 lint 收口

本轮继续检查窗口状态、启动诊断、UI registry 和设置页等低耦合基础设施。`main.ts` 与 `Settings.tsx` 当前包含大量青数认证、治理链、唤醒/TTS、OpenClaw restart 保护和主控台定制，不适合整块对齐 `origin/main`。因此本轮只处理不会改变行为的 import 排序、未使用引用和安全 Hook cleanup。

本轮代码更新：

1. 基础设施 import 排序
   - 文件：`src/main/main.ts`
   - 文件：`src/renderer/components/Settings.tsx`
   - 文件：`src/renderer/store/index.ts`
   - 使用现有 ESLint 规则修复 import 排序 error。
2. 删除未使用引用
   - 文件：`src/main/main.ts`
   - 移除未使用的 `cancelActiveDownload`。
   - 移除未使用的 `DEFAULT_MANAGED_AGENT_ID`。
3. Settings 安全 warning 收口
   - 文件：`src/renderer/components/Settings.tsx`
   - `catch (error)` 改为 `catch`，移除未使用参数。
   - cleanup effect 中复制 `initialThemeIdRef.current` / `initialThemeRef.current` / `initialLanguageRef.current` 快照，避免 cleanup 时读取漂移 ref。
   - `sidebarTabs` 的 `useMemo` 移除未使用的 `language` 依赖。

本轮刻意未改：

1. 不处理 `Settings.tsx` 中 TTS voice / notice Hook 依赖 warning。
   - 这会影响 TTS prepare、voice selection 和通知刷新节奏，后续单独批次更稳。
2. 不删除或改写 `scheduleDeferredGatewayRestart(...)`。
   - 这属于网关重启延后策略，需和“任务运行中延后重启”一起评估。
3. 不批量收窄 `main.ts` 中的 IPC / runtime `any`。
   - 这些涉及 cowork、MCP、IM、scheduled task handler 的跨模块 contract，后续逐块处理。

原则校验：

1. KISS
   - 只清理无副作用 lint 尾项。
2. YAGNI
   - 不为了清零所有 warning 牵动 TTS 或 gateway restart 行为。
3. SOLID
   - 保持 Settings、主进程启动和 OpenClaw restart 职责边界不变。
4. DRY
   - import 排序继续交给统一 ESLint 规则。

本轮验证：

1. `npm test -- --run src/main/windowState.test.ts src/renderer/services/config.test.ts src/renderer/store/slices/coworkSlice.test.ts`
   - 3 个测试文件通过。
   - 12 条测试通过。
2. `npx tsc --project tsconfig.json --noEmit`
   - 通过。
3. `npx tsc --project electron-tsconfig.json --noEmit`
   - 通过。
4. `npx eslint src/main/main.ts src/renderer/components/Settings.tsx src/renderer/store/index.ts`
   - 0 error。
   - 剩余 17 个 warning 已拆为后续批次。

后续规划：

1. 下一步建议优先处理 `main.ts` 中可独立收窄的 IPC `any`：
   - cowork stream message / permission request。
   - MCP create/update payload。
   - IM LLM config provider。
2. TTS Hook warning、notice Hook warning、deferred gateway restart warning 单独评估，不和基础设施 lint 混在一起。
3. 继续保护青数品牌、工作台、治理链和唤醒/TTS。

## 2026-05-12：Provider / Config / Auth Proxy lint 与类型收口

本轮进入 Provider / config / auth proxy 低耦合区域。对比 `origin/main` 后确认，当前分支已有青数服务端代理路径、MiniMax OAuth、OpenAI Codex auth、provider metadata 与模型能力解析等本地实现，不适合整包覆盖 `main` 的认证路径。因此本轮只处理 lint 和类型安全尾项，不改变 provider 解析行为。

本轮代码更新：

1. Provider/config import 排序收口
   - 文件：`src/main/libs/claudeSettings.ts`
   - 文件：`src/renderer/services/config.ts`
   - 文件：`src/renderer/services/config.test.ts`
   - 使用现有 `simple-import-sort` 规则整理 import。
2. renderer config 去除 `any`
   - 文件：`src/renderer/services/config.ts`
   - 将 `defaultConfig.providers` 的动态索引从 `Record<string, any>` 收窄为 `Record<string, ProviderConfig | undefined>`。
   - 保持原有配置合并、模型增删、baseUrl/apiFormat 规范化逻辑不变。

本轮刻意未改：

1. 不迁移 `main` 的 per-provider token refresher。
2. 不改变青数服务端代理路径 `/api/qingshu-claw/proxy/v1`。
3. 不改变 MiniMax OAuth、OpenAI Codex auth、GitHub Copilot token 管理路径。
4. 不改变 provider 模型选择和 OpenClaw provider 映射。

原则校验：

1. KISS
   - 只处理 lint 和一个动态索引类型，不扩展认证抽象。
2. YAGNI
   - 暂不引入新的 runtime config validator。
3. SOLID
   - renderer config 仍只负责本地配置合并与规范化。
4. DRY
   - provider 类型继续复用 `shared/providers` 的 `ProviderConfig`。

本轮验证：

1. `npx eslint src/main/libs/coworkOpenAICompatProxy.ts src/main/libs/claudeSettings.ts src/main/libs/openaiCodexAuth.ts src/main/libs/githubCopilotAuth.ts src/main/libs/copilotTokenManager.ts src/renderer/services/config.ts src/renderer/services/providerRequestConfig.ts src/shared/providers/constants.ts src/renderer/services/config.test.ts`
   - 通过，0 error / 0 warning。
2. `npm test -- --run src/main/libs/coworkOpenAICompatProxy.test.ts src/main/libs/claudeSettings.test.ts src/main/libs/openaiCodexAuth.test.ts src/renderer/services/config.test.ts src/renderer/services/providerRequestConfig.test.ts src/shared/providers/constants.test.ts`
   - 6 个测试文件通过。
   - 68 条测试通过。
3. `npx tsc --project tsconfig.json --noEmit`
   - 通过。
4. `npx tsc --project electron-tsconfig.json --noEmit`
   - 通过。

后续规划：

1. Provider/config/auth proxy 当前低耦合 lint 和测试尾项已收口。
2. 后续若继续合 provider 相关内容，需要单独评估 per-provider token refresher，因为它会牵认证路径。
3. 下一步建议继续检查窗口状态、启动诊断、UI registry 等低耦合基础设施。

## 2026-05-12：MCP / OpenClaw lint 防退化收口

本轮转回 MCP / OpenClaw 周边公共能力。先跑局部 lint 和测试，确认当前分支已有的 MCP abort、MCP 日志脱敏、OpenClaw gateway client 探测、OpenClaw config sync 等防线仍可用；随后只处理 lint 暴露的无用导入和无用变量，不改变运行时逻辑。

本轮代码更新：

1. OpenClaw config sync 删除无用引用
   - 文件：`src/main/libs/openclawConfigSync.ts`
   - 移除未使用的 `PlatformRegistry` value import。
   - 移除未使用的 `hasDingTalkOpenClaw` 临时变量。
2. OpenClaw engine manager 删除无用 helper
   - 文件：`src/main/libs/openclawEngineManager.ts`
   - 移除未使用的 `sleep(...)` helper。
3. import 顺序对齐 ESLint
   - 文件：`src/main/libs/openclawConfigSync.ts`
   - 文件：`src/main/libs/openclawEngineManager.ts`
   - 使用现有 `simple-import-sort` 规则收口排序。

本轮刻意未改：

1. 不改变 OpenClaw config 生成逻辑。
2. 不改变 gateway 启动、重启、client entry 探测逻辑。
3. 不改变 MCP bridge abort / local tool 执行逻辑。
4. 不触碰青数品牌、工作台、治理链和唤醒/TTS。

原则校验：

1. KISS
   - 只移除无用代码和排序问题，不引入新抽象。
2. YAGNI
   - 不为当前没有调用点的 `sleep(...)` 预留 helper。
3. SOLID
   - OpenClaw config sync 和 engine manager 的职责边界不变。
4. DRY
   - 继续依赖 ESLint import 排序规则，避免人工排序漂移。

本轮验证：

1. `npx eslint src/main/libs/mcpBridgeServer.ts src/main/libs/mcpServerManager.ts src/main/libs/mcpLog.ts src/main/libs/commandSafety.ts src/main/libs/openclawEngineManager.ts src/main/libs/openclawConfigSync.ts src/main/libs/agentEngine/openclawRuntimeAdapter.ts`
   - 通过，0 error / 0 warning。
2. `npm test -- --run src/main/libs/mcpLog.test.ts src/main/libs/mcpServerManager.test.ts src/main/libs/commandSafety.test.ts src/main/libs/openclawEngineManager.test.ts src/main/libs/openclawConfigSync.test.ts src/main/libs/openclawConfigSync.runtime.test.ts src/main/libs/agentEngine/openclawRuntimeAdapter.test.ts`
   - 7 个测试文件通过。
   - 125 条测试通过。
3. `npx tsc --project electron-tsconfig.json --noEmit`
   - 通过。

后续规划：

1. 继续 MCP / OpenClaw 周边防退化：
   - 优先补已有实现的测试覆盖。
   - 不迁移 OpenClaw 主干重构。
2. 下一步可以检查 Provider / config / auth proxy 低耦合 lint 和测试状态。
3. 继续暂缓 POPO/IM 大迁移、per-agent `modelSlice` 和主控台 UI 大改。

## 2026-05-12：Scheduled Task IPC 入参类型收口

本轮继续完成上一批 scheduled task lint 的尾项：`handlers.ts` 中剩余 3 个 `any` warning。经核对，renderer 类型和 preload 类型已经把 scheduled task 的 `create/update` IPC 定义为 `ScheduledTaskInput` / `Partial<ScheduledTaskInput>`，main 侧继续使用 `any` 没有必要。因此本轮只对齐共享类型，不改变 IPC 行为。

本轮代码更新：

1. 收窄 scheduled task IPC 入参类型
   - 文件：`src/main/ipcHandlers/scheduledTask/handlers.ts`
   - `create` handler 入参从 `any` 改为 `ScheduledTaskInput`。
   - `update` handler 入参从 `any` 改为 `Partial<ScheduledTaskInput>`。
   - `applyAnnounceDeliveryNormalization(...)` 入参从 `Record<string, any>` 改为 `Partial<ScheduledTaskInput>`。
2. 保留原有运行时容错行为
   - `input && typeof input === 'object' ? { ...input } : {}` 的 fallback 不变。
   - create 路径通过显式类型边界继续传给 `addJob(...)`。
   - update 路径继续传给 `updateJob(...)`。

本轮刻意未改：

1. 不新增 runtime validator。
2. 不改变 scheduled task 表单和 IPC 通道名。
3. 不改变 IM announce delivery 归一化逻辑。
4. 不改变青数定时任务治理链和 native cron 行为。

原则校验：

1. KISS
   - 只复用已有共享类型，不新增校验框架。
2. YAGNI
   - 暂不引入运行时 schema validator，避免扩大 IPC contract 风险。
3. SOLID
   - main handler 继续只负责 IPC 入参转发和 announce delivery 归一化。
4. DRY
   - main / preload / renderer 统一使用 `ScheduledTaskInput` 这一套类型。

本轮验证：

1. `npx eslint src/main/ipcHandlers/scheduledTask/handlers.ts src/renderer/services/scheduledTask.ts src/renderer/store/slices/scheduledTaskSlice.ts src/scheduledTask/cronJobService.ts`
   - 通过，0 error / 0 warning。
2. `npm test -- --run src/renderer/services/scheduledTask.test.ts src/renderer/store/slices/scheduledTaskSlice.test.ts src/renderer/components/scheduledTasks/utils.test.ts src/scheduledTask/cronJobService.test.ts src/main/ipcHandlers/scheduledTask/helpers.test.ts`
   - 5 个测试文件通过。
   - 41 条测试通过。
3. `npx tsc --project electron-tsconfig.json --noEmit`
   - 通过。

后续规划：

1. scheduled task 当前低耦合尾项已基本收干净。
2. 下一步转回 MCP / OpenClaw 周边防退化，优先补已有实现的测试或文档，而不是迁移高耦合主干。
3. 继续暂缓：
   - scheduled task 大 UI。
   - POPO/IM 大迁移。
   - OpenClaw 主干重构。
   - per-agent `modelSlice`。

## 2026-05-12：Scheduled Task lint 小收口

本轮继续筛 `origin/main` 的 scheduled task 低耦合修复。`main` 中有一批 scheduled task lint / import 排序修复；当前分支已经保留了青数需要的 persisted jobs fallback、IM 通道会话过滤、手动执行乐观态等增强，因此本轮不迁移 `TaskForm.tsx` 大 UI，只收敛会阻断 lint 的 import 排序和未使用常量。

本轮代码更新：

1. scheduled task import 排序收口
   - 文件：`src/renderer/services/scheduledTask.ts`
   - 文件：`src/renderer/store/slices/scheduledTaskSlice.ts`
   - 文件：`src/scheduledTask/cronJobService.ts`
   - 按现有 ESLint 规则整理 import 顺序。
2. 移除未使用常量 import
   - 文件：`src/scheduledTask/cronJobService.ts`
   - 移除未使用的 `SessionTarget` 和 `WakeMode` 值导入。
   - 保留对应 type import，因为 gateway 类型仍需要 `SessionTargetType` / `WakeModeType`。
3. scheduled task handler 保持现有能力
   - 文件：`src/main/ipcHandlers/scheduledTask/handlers.ts`
   - 保留 gateway 未就绪时读取 persisted cron jobs 的 fallback。
   - 保留 `filterAccountId ?? accountId` 的 IM 会话过滤。
   - 保留 list runs / list all runs 的 `RunFilter` 透传。

本轮刻意未改：

1. 不迁移 `main` 的大块 `TaskForm.tsx` UI。
2. 不改变青数定时任务表单、IM 投递和 native cron 行为。
3. 不在本轮重构 `handlers.ts` 的 IPC `any` 入参类型。
   - 当前局部 lint 已无 error，只剩 3 个既有 `@typescript-eslint/no-explicit-any` warning。
   - 这类类型收窄会牵涉 IPC contract，后续单独批次处理更稳。

原则校验：

1. KISS
   - 只处理 lint error 和未使用导入，不扩大改造范围。
2. YAGNI
   - 暂不为消除 warning 重写 IPC 输入类型。
3. SOLID
   - scheduled task service、slice、cron service 各自职责不变。
4. DRY
   - import 排序交给现有 ESLint 规则，避免手工风格分叉。

本轮验证：

1. `npm test -- --run src/renderer/services/scheduledTask.test.ts src/renderer/store/slices/scheduledTaskSlice.test.ts src/renderer/components/scheduledTasks/utils.test.ts src/scheduledTask/cronJobService.test.ts src/main/ipcHandlers/scheduledTask/helpers.test.ts`
   - 5 个测试文件通过。
   - 41 条测试通过。
2. `npx eslint src/main/ipcHandlers/scheduledTask/handlers.ts src/renderer/services/scheduledTask.ts src/renderer/store/slices/scheduledTaskSlice.ts src/scheduledTask/cronJobService.ts`
   - 0 个 error。
   - 3 个既有 `any` warning，已记录为后续类型收口项。
3. `npx tsc --project tsconfig.json --noEmit`
   - 通过。
4. `npx tsc --project electron-tsconfig.json --noEmit`
   - 通过。

后续规划：

1. scheduled task 后续只继续做两类低风险项：
   - IPC 入参 `any` 类型收窄。
   - 纯测试或服务层防退化。
2. 继续暂缓：
   - `TaskForm.tsx` 大 UI 迁移。
   - scheduled task 与 POPO/IM 大迁移的耦合改造。
   - OpenClaw 主干重构。

## 2026-05-12：OpenClaw cwd 测试跨平台稳定性

本轮继续筛 `origin/main` 中的低耦合公共修复。`main` 已把部分 cwd 相关测试从硬编码 Unix 路径改为 `path.resolve(...)`，当前分支的 `openclawAgentModels.test.ts` 已吸收该方向，但新增的 `startSession sends the session cwd to OpenClaw chat.send` 测试仍保留 `/tmp/...` 断言。这个断言在 Windows 上会与运行时代码的 `path.resolve(...)` 输出不一致，因此本轮只修测试期望，不改 OpenClaw runtime 行为。

本轮代码更新：

1. OpenClaw runtime adapter 测试补齐跨平台路径期望
   - 文件：`src/main/libs/agentEngine/openclawRuntimeAdapter.test.ts`
   - 新增 `node:path` import。
   - `cwd` 断言从 `'/tmp/qingshu-workspace'` 改为 `path.resolve('/tmp/qingshu-workspace')`。

本轮刻意未改：

1. 不改变 `startSession` 向 OpenClaw `chat.send` 传递 cwd 的业务逻辑。
2. 不迁移 OpenClaw 主干重构。
3. 不改青数工作台、内置治理链和唤醒/TTS。

原则校验：

1. KISS
   - 只修测试断言，让测试匹配现有运行时代码行为。
2. YAGNI
   - 不为了跨平台测试而引入路径适配层。
3. SOLID
   - 测试继续只验证 adapter 的 cwd 透传职责。
4. DRY
   - 与 `openclawAgentModels.test.ts` 采用一致的 `path.resolve(...)` 规则。

本轮验证：

1. `npm test -- --run src/main/libs/agentEngine/openclawRuntimeAdapter.test.ts src/main/libs/openclawAgentModels.test.ts`
   - 2 个测试文件通过。
   - 71 条测试通过。
2. `npx tsc --project electron-tsconfig.json --noEmit`
   - 通过。

后续规划：

1. 继续 scheduled task 小修筛选：
   - 只吸收 lint / 服务层 / 数据状态小 bugfix。
   - 暂不迁移 `main` 的大块 `TaskForm.tsx` UI。
2. 继续保持保护边界：
   - 不动青数品牌、工作台、内置治理链和唤醒/TTS。
   - 不接 POPO/IM 大迁移、OpenClaw 主干重构、per-agent `modelSlice`。

## 2026-05-12：IM 实例名同步小修复

本轮继续从 `origin/main` 中筛低耦合公共 bugfix。对照 `main` 后确认，DingTalk / Feishu / QQ 实例设置页存在实例名同步依赖缺失；当前分支还额外包含 WeCom 实例设置页，同类逻辑也有相同问题。因此本轮按同一规则一次性补齐四个平台，避免实例重命名后当前设置面板仍显示旧名称。

本轮代码更新：

1. IM 实例设置页补齐 `instanceName` 依赖
   - 文件：`src/renderer/components/im/DingTalkInstanceSettings.tsx`
   - 文件：`src/renderer/components/im/FeishuInstanceSettings.tsx`
   - 文件：`src/renderer/components/im/QQInstanceSettings.tsx`
   - 文件：`src/renderer/components/im/WecomInstanceSettings.tsx`
   - `nameValue` 同步 effect 从只监听 `instance.instanceId` 改为同时监听 `instance.instanceName`。
   - 当上层保存或同步实例名称后，当前设置卡片会立即刷新本地输入态和标题态。

本轮刻意未改：

1. 不迁移 `origin/main` 的 POPO/IM 大 UI。
2. 不改 Agent 绑定数据结构。
3. 不改青数工作台和主控台 UI。
4. 不改变 IM 网关配置存储主体。

原则校验：

1. KISS
   - 只补 React effect 的真实依赖，不引入额外状态同步机制。
2. YAGNI
   - 不借此做 IM 设置页重构或多平台大迁移。
3. SOLID
   - 各平台设置组件仍只负责自身表单本地态同步。
4. DRY
   - 对四个平台使用同一依赖规则，避免 WeCom 留下同类 bug。

本轮验证：

1. `npm test -- --run src/renderer/components/agent/agentImBindingConfig.test.ts src/renderer/components/agent/agentDraftState.test.ts src/renderer/store/slices/imSlice.test.ts src/main/im/imStore.test.ts`
   - 4 个测试文件通过。
   - 36 条测试通过。
2. `npx tsc --project tsconfig.json --noEmit`
   - 通过。

后续规划：

1. 继续筛 `origin/main` 中低耦合公共 bugfix：
   - 跨平台测试断言。
   - scheduled task lint / 小型服务层防退化。
   - MCP / OpenClaw 周边已实现但需补文档的防退化能力。
2. 继续暂缓高耦合内容：
   - POPO/IM 大迁移。
   - OpenClaw 主干重构。
   - per-agent `modelSlice`。
   - 主控台 UI 大改。

## 2026-05-12：构建打包稳定性防退化收口

本轮继续拉齐 `main` 的构建/打包稳定性公共能力，但明确跳过 `main` 中删除 macOS speech/TTS helper 的方向。当前分支的唤醒、语音输入和 TTS helper 属于青数覆盖层保护范围，不能因为打包脚本对齐而破坏。

本轮代码更新：

1. `electron-builder` hook 防退化测试补齐
   - 文件：`scripts/electron-builder-hooks.cjs`
   - 文件：`src/main/libs/electronBuilderHooks.test.ts`
   - 将 `removeAllBinDirsInCfmind(...)` 暴露到 `__test__`。
   - 新增 macOS packaged app 场景测试，确保 `cfmind/**/node_modules/.bin` 会被移除，但插件源码目录保留。
2. OpenClaw runtime prune 逻辑收口
   - 文件：`scripts/prune-openclaw-runtime.cjs`
   - 文件：`src/main/libs/pruneOpenClawRuntime.test.ts`
   - 抽出 `pruneDuplicateOpenClawSdkFromExtensions(thirdPartyDir, stats)`。
   - 新增测试，确保 `third-party-extensions/<plugin>/node_modules/openclaw` 重复 SDK 会被移除，但插件入口和其他依赖保留。
3. 保护唤醒/TTS helper 链路
   - 保留 `scripts/build-macos-speech-helper.cjs`。
   - 保留 `scripts/build-macos-tts-helper.cjs`。
   - 保留 `scripts/prepare-dev-electron-speech-host.cjs`。
   - 保留 `scripts/reset-dev-electron-speech-permissions.cjs`。
   - 不接受 `origin/main` 中对这组脚本的删除。

本轮刻意未改：

1. 不改变青数品牌、工作台、内置治理链。
2. 不改变唤醒浮层、语音输入、TTS helper 构建链路。
3. 不接 OpenClaw 主干重构。
4. 不做完整安装策略大迁移，只收口当前脚本的可测试稳定性。

原则校验：

1. KISS
   - 只把已有打包清理逻辑拆成可测试 helper，没有引入新的打包状态机。
2. YAGNI
   - 暂不接完整安装器策略重构，避免扩大影响面。
3. SOLID
   - prune helper 与 electron-builder hook 各自只负责自己的清理边界。
4. DRY
   - 将重复 SDK 删除逻辑抽出，避免后续多个脚本分叉维护。

本轮验证：

1. `npm test -- --run src/main/libs/electronBuilderHooks.test.ts src/main/libs/pruneOpenClawRuntime.test.ts src/main/libs/applyOpenClawPatches.test.ts src/main/libs/openclawRuntimePackaging.test.ts`
   - 4 个测试文件通过。
   - 17 条测试通过。
2. `npx tsc --project tsconfig.json --noEmit`
   - 通过。
3. `npx tsc --project electron-tsconfig.json --noEmit`
   - 通过。
4. `git diff --check`
   - 通过。

后续规划：

1. 继续筛 `origin/main` 中剩余低耦合构建/打包脚本：
   - `scripts/openclaw-runtime-packaging.cjs`
   - `scripts/sync-openclaw-runtime-current.cjs`
   - `scripts/openclaw-runtime-host.cjs`
   - `package.json` 构建脚本差异
2. 保持保护边界：
   - 不删除 macOS speech/TTS helper。
   - 不改青数包名、品牌资源和主控台入口。
3. 再往后进入低耦合 runtime patch 测试或 scheduled task 小修复；POPO/IM 大迁移、OpenClaw 主干重构、per-agent `modelSlice` 继续单独批次。

## 2026-05-12：Artifacts 第三阶段最小 badge 入口

本轮继续拉齐 `main` 的 Artifacts / file preview 公共能力，但仍不整包接入完整右侧 Artifacts panel。完整 panel 会牵动对话窗口布局、面板宽度动画、文件读取预览、CodeMirror 以及一批新组件；为了保护当前青数主控台和对话窗口，本轮只接最小可见入口。

本轮代码更新：

1. 新增 Cowork artifact 收集 helper
   - 文件：`src/renderer/components/cowork/coworkArtifacts.ts`
   - 从当前 session messages 中收集：
     - assistant code block artifacts。
     - assistant file link artifacts。
     - assistant 裸文件路径 artifacts。
     - tool_result 中的文件路径 artifacts。
     - Write / write_file 工具产物 artifacts。
   - 复用 `normalizeFilePathForDedup(...)`，避免 `file:///D:/...` 与 `D:\...` 重复显示。
   - 跳过 thinking assistant 消息，避免把思考过程中的临时内容当产物展示。
2. 对话窗口接入最小 artifact badge
   - 文件：`src/renderer/components/cowork/CoworkSessionDetail.tsx`
   - 当前 session messages 变化时收集 artifacts 并写入 `artifactSlice`。
   - 每个 assistant turn 下方展示轻量产物 badge。
   - 文件类 artifact 点击后走现有 `window.electron.shell.openPath(...)` 打开。
   - codeblock / text 类 artifact 点击后复制内容。
   - 不新增右侧 panel，不改变主控台整体布局。
3. 补齐 i18n
   - 文件：`src/renderer/services/i18n.ts`
   - 新增 `artifactCopied`。
   - 新增 `artifactOpenFailed`。
4. 补齐回归测试
   - 文件：`src/renderer/components/cowork/coworkArtifacts.test.ts`
   - 覆盖 tool path 与 markdown file link 的 normalized dedup。
   - 覆盖 thinking 消息不产出 artifact。
   - 覆盖 tool_result 文本中的文件路径识别。

本轮刻意未改：

1. 不接完整 `ArtifactPanel`。
2. 不新增 CodeMirror 依赖和代码预览 tab。
3. 不改 `main.ts / preload.ts / electron.d.ts` 的文件读取 IPC。
4. 不改变青数品牌、工作台、内置治理链、唤醒/TTS。

原则校验：

1. KISS
   - 先用小 badge 让已接入的 parser/slice 真实可见，而不是一次搬完整 panel。
2. YAGNI
   - 暂不引入复杂预览器、代码编辑器和右侧面板状态机。
3. SOLID
   - artifact 收集逻辑从 UI 组件拆出，组件只负责渲染和点击行为。
4. DRY
   - 文件路径去重继续复用 `normalizeFilePathForDedup(...)`，避免组件内重复路径归一规则。

本轮验证：

1. `npm test -- --run src/renderer/components/cowork/coworkArtifacts.test.ts src/renderer/services/artifactParser.test.ts src/renderer/store/slices/artifactSlice.test.ts src/renderer/components/cowork/coworkConversationTurns.test.ts`
   - 4 个测试文件通过。
   - 24 条测试通过。
2. `npx tsc --project tsconfig.json --noEmit`
   - 通过。
3. `npx tsc --project electron-tsconfig.json --noEmit`
   - 通过。
4. `git diff --check`
   - 通过。

后续规划：

1. 进入第 5 步构建打包稳定性补齐：
   - 继续筛 `origin/main` 中低耦合 packaging / runtime prune / electron-builder hook 测试。
   - 不改变青数品牌包名、工作台入口和 macOS 唤醒/TTS helper 链路。
2. Artifacts 后续若继续推进：
   - 优先补 badge 的打开失败提示和显示数量上限。
   - 完整右侧 panel、CodeMirror、文件内容预览继续作为单独 UI 批次。
3. 继续暂缓：
   - POPO/IM 大迁移。
   - OpenClaw 主干重构。
   - per-agent `modelSlice`。

## 2026-05-11：IM 小修复收口：历史时间戳保真

本轮进入剩余规划的第 3 步：IM 小修复收口。对照 `origin/main` 后确认，手动 stop 事件转发、Weixin 插件版本 `2.4.3`、Weixin `dmPolicy/allowFrom` 配置写入当前分支已经具备；本轮实际缺口集中在 IM / channel 历史同步时的消息时间戳保真。

本轮复核结论：

1. OpenClaw history 解析已能读出网关时间戳
   - 文件：`src/main/libs/openclawHistory.ts`
   - 已支持 `timestamp`、`createdAt`、`created_at`、`time` 等字段。
   - 已有 `keeps gateway message timestamps when present` 测试。
2. 但本地 replace 落库会重写时间
   - 文件：`src/main/coworkStore.ts`
   - `replaceConversationMessages(...)` 原先删除并重插 user / assistant 消息时统一使用 `Date.now()`。
   - 这会导致 IM 历史列表、会话排序、消息时间展示被同步动作扰动。
3. channel user 预取路径也未透传网关时间
   - 文件：`src/main/libs/agentEngine/openclawRuntimeAdapter.ts`
   - `syncChannelUserMessages(...)` 新增 user 消息时原先只传 content / metadata，未带 `entry.timestamp`。

本轮代码更新：

1. CoworkStore 消息写入支持时间戳保真
   - 文件：`src/main/coworkStore.ts`
   - 新增 `CoworkConversationReplacementEntry`。
   - `replaceConversationMessages(...)` 优先使用网关 `timestamp`，其次复用本地同 role/text 既有 timestamp，最后才 fallback 到当前时间。
   - `addMessage(...)` / `insertMessageBeforeId(...)` 支持可选 `timestamp`，用于 channel user 预取。
2. OpenClaw runtime 透传网关和本地时间戳
   - 文件：`src/main/libs/agentEngine/openclawRuntimeAdapter.ts`
   - `reconcileWithHistory(...)` 从 gateway history entry 携带 `timestamp`。
   - 本地对齐 prefix 时携带已有 message timestamp。
   - 新增 `applyLocalTimestampsToEntries(...)`，避免滑动窗口同步时把保留前缀时间改掉。
   - `syncChannelUserMessages(...)` 新增/插入 user 消息时传入 gateway timestamp。
3. 补齐回归测试
   - 文件：`src/main/coworkStore.metadata.test.ts`
   - 覆盖 replace 时保留本地旧消息时间戳、使用网关新消息时间戳，并保持 tool 消息不变。
   - 覆盖 add / insert channel 消息时使用传入 timestamp。
   - 文件：`src/main/libs/agentEngine/openclawRuntimeAdapter.test.ts`
   - 覆盖 gateway timestamp 进入 replacement entries。
   - 覆盖保留 prefix 时复用本地 timestamp。

本轮刻意未改：

1. 不做 POPO/IM 大迁移。
2. 不整包替换 main 的多实例 IM UI。
3. 不改青数工作台、内置治理链、唤醒/TTS。
4. 不改 OpenClaw 主干 runtime 架构。

原则校验：

1. KISS
   - 时间戳保真放在 store 落库层兜底，runtime 只负责透传事实数据。
2. YAGNI
   - 只修当前确认的 IM 历史时间问题，不借机迁移高耦合 IM 主干。
3. SOLID
   - store 负责持久化一致性，runtime 负责网关历史转换和对齐。
4. DRY
   - 用 `applyLocalTimestampsToEntries(...)` 集中处理本地时间戳补齐，不在各个同步分支重复写匹配逻辑。

本轮验证：

1. `npm test -- --run src/main/coworkStore.metadata.test.ts src/main/coworkStore.agent.test.ts src/main/libs/openclawHistory.test.ts src/main/libs/agentEngine/openclawRuntimeAdapter.test.ts src/main/im/imCoworkHandler.test.ts src/main/im/imStore.test.ts`
   - 6 个测试文件通过。
   - 101 条测试通过。
2. `npx tsc --project electron-tsconfig.json --noEmit`
   - 通过。
3. `npx tsc --project tsconfig.json --noEmit`
   - 通过。
4. `git diff --check`
   - 通过。

后续规划：

1. 进入第 4 步 Artifacts 低耦合修复筛选：
   - parser / 文件去重 / 有效性校验 / 刷新按钮。
   - CodeMirror 大替换继续暂缓。
2. 进入第 5 步构建打包稳定性补齐：
   - 继续筛 main 中低耦合 packaging / runtime prune / hook 测试。
   - 不改变青数品牌包名和 macOS 唤醒/TTS helper 链路。
3. 继续暂缓：
   - POPO/IM 大迁移。
   - OpenClaw 主干重构。
   - per-agent `modelSlice`。

## 2026-05-11：Cowork 公共 bugfix 收口

本轮进入剩余规划的第 2 步：Cowork 公共 bugfix 收口。对照 `origin/main` 近期提交，重点核对 stopped session approval、message metadata、cache read 为 0 隐藏、NO_REPLY 过滤四个低耦合修复点。

本轮复核结论：

1. stopped session approval 已有
   - 文件：`src/main/libs/agentEngine/openclawRuntimeAdapter.ts`
   - 当前分支已经在 approval requested 早期检查 stop cooldown 和 manually stopped session。
   - 已有测试覆盖 stopped session 的 delete / non-delete approval 不再弹出或 auto approve。
2. cache read 为 0 隐藏已有
   - 文件：`src/renderer/components/cowork/CoworkSessionDetail.tsx`
   - 当前展示逻辑已经要求 `cacheReadTokens > 0` 才展示 cache read。
3. NO_REPLY 过滤已有
   - 文件：`src/main/libs/openclawHistory.ts`
   - 当前分支已经支持 `isSilentReplyText(...)` / `isSilentReplyPrefixText(...)`。
   - assistant / system 的 `NO_REPLY` 会从历史同步和流式展示中被过滤。
4. message metadata 中 agent name 仍需对齐
   - `origin/main` 最新行为隐藏 agent name，避免每条 assistant 消息下方重复显示 Agent 信息。
   - 当前分支保留了 `Agent ${agentName}` 展示，本轮对齐为隐藏。

本轮代码更新：

1. 抽出 assistant 元数据展示 helper
   - 文件：`src/renderer/components/cowork/assistantMetadata.ts`
   - 新增 `getAssistantMessageModelLabel(...)`。
   - 新增 `buildAssistantMetadataItems(...)`。
   - 继续展示 model、tokens、cache read、ctx。
   - 不再展示 `agentName`。
2. 对话详情组件改用 helper
   - 文件：`src/renderer/components/cowork/CoworkSessionDetail.tsx`
   - 移除组件内重复元数据拼装逻辑。
   - 保持 TTS、图片预览、Markdown 渲染、历史展示逻辑不变。
3. 补齐回归测试
   - 文件：`src/renderer/components/cowork/assistantMetadata.test.ts`
   - 覆盖 provider-qualified model 只显示 model tail。
   - 覆盖 `cacheReadTokens=0` 不展示。
   - 覆盖 `agentName` 不出现在元数据条目中。

本轮刻意未改：

1. 不改主控台 UI 布局。
2. 不改消息 turn 构建逻辑。
3. 不改 OpenClaw runtime 事件处理。
4. 不改青数工作台、治理链、唤醒/TTS。

原则校验：

1. KISS
   - 用纯函数承载元数据展示规则，避免为一个小 UI bug 上整组件渲染测试。
2. YAGNI
   - 不搬 main 的主控台 UI 或 Agent sidebar 大改，只对齐明确 bugfix。
3. SOLID
   - 元数据格式化从大组件中拆出，组件只负责渲染。
4. DRY
   - model label、token/cache/ctx 展示规则集中到单一 helper。

本轮验证：

1. `npm test -- --run src/renderer/components/cowork/assistantMetadata.test.ts src/renderer/components/cowork/coworkConversationTurns.test.ts src/renderer/components/cowork/promptInputHistory.test.ts src/renderer/services/cowork.test.ts src/renderer/store/slices/coworkSlice.test.ts src/main/libs/openclawHistory.test.ts src/main/libs/agentEngine/openclawRuntimeAdapter.test.ts`
   - 7 个测试文件通过。
   - 100 条测试通过。
2. `npx tsc --project tsconfig.json --noEmit`
   - 通过。
3. `npx tsc --project electron-tsconfig.json --noEmit`
   - 通过。

后续规划：

1. 进入第 3 步 IM 小修复收口：
   - IM 时间展示。
   - 手动 stop 事件转发。
   - Weixin 插件版本和配置重启边界。
2. 再进入第 4 步 Artifacts 低耦合修复筛选：
   - parser / 文件去重 / 有效性校验 / 刷新按钮。
   - CodeMirror 大替换继续暂缓。
3. 继续保护：
   - 青数品牌、工作台、内置治理链、唤醒/TTS。

## 2026-05-11：Provider / 模型配置公共能力收口

本轮进入剩余规划的第 1 步：Provider / 模型配置低耦合能力收口。对比 `origin/main` 后确认，当前分支已经吸收并保留了多项关键能力，包括 GitHub Copilot、LM Studio、Qianfan、OpenAI Responses、OpenClaw provider id 映射、coding plan URL 与模型元数据等；其中部分能力已经比 `origin/main` 更贴合当前青数分支的 OpenClaw 接入，不适合整包覆盖。

本轮复核结论：

1. 当前分支已具备 ProviderRegistry 单一真源
   - 文件：`src/shared/providers/constants.ts`
   - provider label、website、apiKeyUrl、defaultApiFormat、codingPlanUrls、codingPlanModels、openClawProviderId 均集中管理。
2. 当前分支已具备 OpenClaw provider id 归一
   - Qwen 映射到 `qwen-portal`。
   - Zhipu 映射到 `zai`。
   - GitHub Copilot 映射到 `lobsterai-copilot`。
   - 空 provider id 回退到 `lobster`。
3. 当前分支已具备请求 URL 低耦合适配
   - 文件：`src/renderer/services/providerRequestConfig.ts`
   - Copilot 不强行拼 `/v1`。
   - Gemini 使用 OpenAI-compatible endpoint。
   - OpenAI Responses 仅对 OpenAI provider 启用。
   - GPT-5 / o-series 自动使用 `max_completion_tokens`。
4. 当前分支已具备 coding plan endpoint 选择
   - 文件：`src/shared/providers/codingPlan.ts`
   - Moonshot 固定走 anthropic coding plan。
   - Qwen / Zhipu / Qianfan 固定或优先走 openai coding plan。

本轮代码更新：

1. 补 ProviderRegistry provider id 归一测试
   - 文件：`src/shared/providers/constants.test.ts`
   - 覆盖 provider id 前后空格会先 trim 再映射。
   - 覆盖 unknown provider trim 后保留原 id。
2. 补 OpenAI-compatible URL 构造测试
   - 文件：`src/renderer/services/providerRequestConfig.test.ts`
   - 覆盖 LM Studio `.../v1` 不重复拼 `/v1`。
   - 覆盖 Ollama 已经是 `/v1/chat/completions` 时保持不变。

本轮刻意未改：

1. 不整包替换 Settings 页面。
2. 不迁移 per-agent `modelSlice` 大结构。
3. 不改青数工作台、内置治理链、唤醒/TTS。
4. 不移除当前分支更稳的 OpenClaw provider id 映射。

原则校验：

1. KISS
   - 当前运行时代码已经覆盖目标能力，本轮只补边界测试，不为合并而制造代码 churn。
2. YAGNI
   - 不提前搬 per-agent modelSlice 大迁移，避免牵动主控台和工作台状态模型。
3. SOLID
   - Provider 元数据继续由 registry 作为单一职责中心，调用方只消费查询结果。
4. DRY
   - OpenClaw provider id 和 API URL 判断继续复用公共 helper，不在 UI 组件重复写规则。

本轮验证：

1. `npm test -- --run src/shared/providers/constants.test.ts src/shared/providers/codingPlan.test.ts src/renderer/services/providerRequestConfig.test.ts src/renderer/services/config.test.ts src/main/libs/openclawConfigSync.test.ts src/main/libs/openclawAgentModels.test.ts`
   - 6 个测试文件通过。
   - 98 条测试通过。
2. `npx tsc --project tsconfig.json --noEmit`
   - 通过。
3. `npx tsc --project electron-tsconfig.json --noEmit`
   - 通过。

后续规划：

1. 进入第 2 步 Cowork 公共 bugfix 收口：
   - stopped session approval。
   - message metadata 展示。
   - cache read 为 0 隐藏。
   - NO_REPLY 过滤。
2. 之后进入第 3 步 IM 小修复收口：
   - IM 时间展示。
   - 手动 stop 事件转发。
   - Weixin 插件版本和配置重启边界。
3. 继续暂缓：
   - POPO/IM 大迁移。
   - OpenClaw 主干重构。
   - per-agent `modelSlice`。

## 2026-05-11：Cowork stream 事件顺序回归保护

本轮继续 Cowork 行为层收口，重点检查 `complete/error` 事件之后如果还有 late stream message 到达，会不会把会话重新改回 `running`。代码复核结论是：当前分支只会在新的 `user` 消息到达时把会话置为 `running`，普通 assistant/tool/system late message 不会触发状态回退；这符合 IM 场景，因为远端用户新发一轮消息确实应该重新进入运行态。

本轮代码更新：

1. 补齐 stream 状态顺序回归测试
   - 文件：`src/renderer/services/cowork.test.ts`
   - 覆盖 `complete` 后 late assistant message 不会把当前会话改回 `running`。
   - 覆盖新的 user stream message 仍能把已有 IM 会话标记为 `running`。
2. 增加测试专用 listener 初始化/清理入口
   - 文件：`src/renderer/services/cowork.ts`
   - 新增 `setupStreamListenersForTest()` / `cleanupListenersForTest()`。
   - 仅在 `import.meta.env.TEST` 下生效，生产路径不变。
3. 降低 `sessions:changed` 高频日志噪声
   - 文件：`src/renderer/services/cowork.ts`
   - 将两条列表刷新过程日志从 `console.log` 调整为 `console.debug`。
   - 错误日志改为自然英文句子，符合 main/renderer 日志可读性原则。

本轮刻意未改：

1. 不拦截 user stream message 触发 `running`，避免影响 IM 新消息自动接管。
2. 不改 stream IPC 事件结构。
3. 不改主控台 UI、青数工作台、治理链、唤醒/TTS。

原则校验：

1. KISS
   - 用测试锁定已有正确边界，只做日志降噪，不引入复杂事件状态机。
2. YAGNI
   - 暂不新增 stream event sequence number 或生命周期 token，因为当前风险可由现有消息类型边界覆盖。
3. SOLID
   - stream 事件处理仍集中在 `coworkService`，slice 保持纯状态更新。
4. DRY
   - 测试复用同一套真实 listener 注册逻辑，而不是复制事件处理代码。

本轮验证：

1. `npm test -- --run src/renderer/services/cowork.test.ts src/renderer/store/slices/coworkSlice.test.ts src/renderer/components/cowork/promptInputHistory.test.ts src/renderer/components/cowork/coworkConversationTurns.test.ts`
   - 4 个测试文件通过。
   - 16 条测试通过。
2. `npx tsc --project tsconfig.json --noEmit`
   - 通过。
3. `npx tsc --project electron-tsconfig.json --noEmit`
   - 通过。

后续规划：

1. 继续筛 `origin/main` 低耦合公共能力：
   - Provider/模型配置的小型 bugfix。
   - OpenClaw runtime patch 的测试防线。
2. 单独规划高耦合批次：
   - POPO/IM 大迁移。
   - OpenClaw 主干重构。
   - per-agent `modelSlice`。
3. 继续保护不覆盖：
   - 青数品牌、工作台、内置治理链、唤醒/TTS。

## 2026-05-11：Cowork 会话列表刷新请求合并

本轮继续 Cowork 行为层收口，聚焦 `onStreamMessage(...)` 中新 IM / gateway 会话触发 `loadSessions()` 的并发刷新问题。此前如果多个新会话消息几乎同时到达，renderer 会连续发起多次 `cowork:session:list` IPC；在 IM 轮询和 OpenClaw stream 都活跃时，这会放大主进程 SQLite 查询与列表替换压力。

本轮代码更新：

1. `loadSessions(...)` 增加同 key 请求合并
   - 文件：`src/renderer/services/cowork.ts`
   - 新增 `pendingLoadSessionsByKey`。
   - 同一个 `agentId` 维度已有刷新在飞时，后续调用直接复用同一个 Promise。
   - 请求完成后清理 pending 记录，下一轮刷新仍会重新请求，不做长期缓存。
2. `loadSessions(...)` 的旧响应守卫改为按 key 记录
   - 文件：`src/renderer/services/cowork.ts`
   - 将单个全局 `latestLoadSessionsRequestId` 调整为 `latestLoadSessionsRequestIds`。
   - 避免不同 `agentId` 的刷新互相把对方标成旧请求。
3. 补齐回归测试
   - 文件：`src/renderer/services/cowork.test.ts`
   - 覆盖同 key 并发调用只触发一次 `listSessions`。
   - 覆盖请求完成后再次调用仍会发起新的 IPC。

本轮刻意未改：

1. 不改 `cowork:sessions:changed` IPC 事件语义。
2. 不改主控台 UI、会话列表结构和 agent 切换逻辑。
3. 不改青数工作台、治理链、唤醒/TTS。

原则校验：

1. KISS
   - 只用 Map 复用在飞 Promise，不引入节流器或全局请求队列。
2. YAGNI
   - 不做列表缓存和过期策略，避免影响实时会话发现。
3. SOLID
   - 并发控制留在 `coworkService` 请求边界，slice 仍只接收最终 sessions。
4. DRY
   - `agentId ?? '__all__'` 作为唯一请求 key，合并和旧响应判断共用同一维度。

本轮验证：

1. `npm test -- --run src/renderer/services/cowork.test.ts src/renderer/store/slices/coworkSlice.test.ts src/renderer/components/cowork/promptInputHistory.test.ts src/renderer/components/cowork/coworkConversationTurns.test.ts`
   - 4 个测试文件通过。
   - 14 条测试通过。

后续规划：

1. 继续 Cowork：
   - 检查 error/complete 事件与 late stream message 的顺序是否仍有状态回退风险。
   - 继续筛 `origin/main` 中低耦合的 Provider/模型配置修复。
2. 继续 OpenClaw runtime patch：
   - 只吸收小型 bugfix 和测试防线，不搬 OpenClaw 主干重构。
3. 继续暂缓高耦合迁移：
   - 主控台 UI 整包替换。
   - POPO/IM 大迁移。
   - per-agent `modelSlice`。

## 2026-05-11：Cowork 后台刷新防覆盖当前会话

本轮回到 Cowork 行为层，重点检查 `sessions:changed`、会话完成事件和窗口重新聚焦触发的后台刷新。此前 `loadSession(...)` 只有 requestId 防旧请求覆盖，但没有确认用户是否仍停留在同一个会话；如果后台刷新 A 会话时，用户已经切到 B，会存在 A 请求返回后重新覆盖当前窗口的风险。

本轮代码更新：

1. `loadSession(...)` 增加后台刷新守卫
   - 文件：`src/renderer/services/cowork.ts`
   - 新增可选参数 `{ preserveSelection?: boolean }`。
   - 开启后，请求返回时会再次确认 `currentSessionId` 仍等于目标 sessionId。
   - 如果用户已经切换到其他会话，则只返回数据，不写入 `currentSession` / `isStreaming` / `remoteManaged`。
2. 后台刷新入口启用守卫
   - 文件：`src/renderer/services/cowork.ts`
   - `onStreamComplete(...)` 中刷新当前会话详情时启用 `preserveSelection`。
   - `onSessionsChanged(...)` 中列表刷新后重载当前详情时启用 `preserveSelection`。
   - 文件：`src/renderer/components/cowork/CoworkView.tsx`
   - 窗口 focus 时刷新运行中会话详情也启用 `preserveSelection`。
3. 保留用户主动选择会话行为
   - `App.tsx` / `Sidebar.tsx` 的用户点击切换仍调用默认 `loadSession(sessionId)`。
   - 主动选择会话仍会正常把目标 session 写入当前窗口。
4. 补齐回归测试
   - 文件：`src/renderer/services/cowork.test.ts`
   - 覆盖后台刷新 A 时用户切到 B，A 返回不会覆盖当前激活会话。
   - 覆盖用户主动加载会话仍正常生效。

本轮刻意未改：

1. 不改主控台 UI 和会话列表结构。
2. 不改 IPC 事件名和 main 侧 `cowork:sessions:changed` 触发点。
3. 不改青数工作台、治理链、唤醒/TTS。

原则校验：

1. KISS
   - 用一个显式选项区分后台刷新和用户主动切换，不引入复杂导航状态机。
2. YAGNI
   - 暂不重构会话加载队列，只修复当前可证实的覆盖风险。
3. SOLID
   - `coworkService` 负责异步请求守卫，slice 仍只负责状态写入。
4. DRY
   - 复用已有 `currentSessionId` 作为唯一选择真源，不新增第二套 active session 状态。

本轮验证：

1. `npm test -- --run src/renderer/services/cowork.test.ts src/renderer/store/slices/coworkSlice.test.ts src/renderer/components/cowork/promptInputHistory.test.ts src/renderer/components/cowork/coworkConversationTurns.test.ts`
   - 4 个测试文件通过。
   - 13 条测试通过。
2. `npx tsc --project tsconfig.json --noEmit`
   - 通过。
3. `npx tsc --project electron-tsconfig.json --noEmit`
   - 通过。

后续规划：

1. 继续 Cowork：
   - 检查 `onStreamMessage` 里新 IM 会话触发 `loadSessions()` 时是否需要同类请求合并/节流。
   - 检查 error/complete 事件与 late stream message 的顺序是否还有状态回退风险。
2. 继续筛 main 公共 bugfix：
   - 优先看 Provider/模型配置和 OpenClaw runtime patch 的低耦合测试项。
3. 继续暂缓高耦合迁移：
   - 主控台 UI 整包替换。
   - 输入区大迁移。
   - POPO/IM 大迁移。
   - per-agent `modelSlice`。

## 2026-05-11：ScheduledTasks 手动执行失败反馈

本轮继续 ScheduledTasks 手动执行链路收口。上一轮增加了 pending run 占位，但进一步检查发现：如果 `scheduledTasks.runManually(...)` IPC 直接失败，任务状态会回滚，pending 历史却可能停留在 `运行中`，用户会看到一条不会结束的运行记录。

本轮代码更新：

1. 手动执行失败时关闭 pending run
   - 文件：`src/renderer/services/scheduledTask.ts`
   - 捕获失败后，把 `pending-manual-{taskId}` 从 `running` 更新为 `error`。
   - 写入 `finishedAt`、`durationMs` 和失败原因。
   - 任务状态仍按原逻辑回滚到执行前状态。
2. 手动执行失败时弹出 toast
   - 文件：`src/renderer/services/scheduledTask.ts`
   - 失败时触发 `app:showToast`。
   - 文案复用 `scheduledTasksRunFailed`，并附带真实错误信息。
3. 补齐回归测试
   - 文件：`src/renderer/services/scheduledTask.test.ts`
   - 覆盖 IPC 失败后任务状态回滚。
   - 覆盖 pending run 转为 `error` 并保留失败原因。
   - 覆盖 toast 会携带失败原因。

本轮刻意未改：

1. 不改变 IPC 返回结构。
2. 不改变 OpenClaw cron 执行协议。
3. 不新增全局错误弹窗，只用现有 toast 和运行历史错误展示。

原则校验：

1. KISS
   - 复用 pending run 作为失败反馈载体，不新增专门的失败状态表。
2. YAGNI
   - 不做复杂重试 UI，先保证失败可见且 pending 不悬挂。
3. SOLID
   - service 负责错误转换，TaskRunHistory 继续只按 run 数据渲染。
4. DRY
   - 复用 `scheduledTasksRunFailed` 和既有 toast 机制。

本轮验证：

1. `npm test -- --run src/renderer/services/scheduledTask.test.ts src/renderer/store/slices/scheduledTaskSlice.test.ts src/renderer/components/scheduledTasks/utils.test.ts`
   - 3 个测试文件通过。
   - 19 条测试通过。
2. `npx tsc --project tsconfig.json --noEmit`
   - 通过。

后续规划：

1. 回到 Cowork：
   - 检查 `sessions:changed` 局部刷新是否会覆盖当前激活会话。
   - 梳理 main 中可安全吸收的小型 bugfix。
2. ScheduledTasks 后续低风险项：
   - 检查全局历史筛选下 pending run 是否需要参与筛选。
   - 检查任务详情页是否需要显示更明确的最近失败标题。
3. 继续暂缓高耦合迁移：
   - 主控台 UI 整包替换。
   - 输入区大迁移。
   - POPO/IM 大迁移。
   - per-agent `modelSlice`。

## 2026-05-11：ScheduledTasks 运行历史即时占位

本轮继续上一节的 ScheduledTasks 手动执行体验收口。上一轮已经让按钮点击后立即显示 `运行中`，但运行历史区域仍要等 OpenClaw gateway 发回 `runUpdate` 后才出现记录；如果 gateway 响应慢，用户会看到按钮变了，但下方历史还是空，体验仍像“半天没反应”。

本轮代码更新：

1. 手动执行时立即插入 pending run
   - 文件：`src/renderer/services/scheduledTask.ts`
   - `runManually(...)` 乐观更新任务状态时，同时写入一条 `pending-manual-{taskId}` 运行记录。
   - 详情页 `TaskRunHistory` 立即能看到一条 `运行中` 历史。
   - pending run 使用任务名、任务 sessionKey 和当前时间，避免空白历史区误导用户。
2. 真实 runUpdate 到达后替换 pending run
   - 文件：`src/renderer/store/slices/scheduledTaskSlice.ts`
   - `addOrUpdateRun(...)` 收到真实 run id 时，会先清理同 task 的 `pending-manual-{taskId}`。
   - 同步清理单任务历史和全局历史，避免最终历史中出现占位和真实结果两条。
3. 补齐回归测试
   - 文件：`src/renderer/services/scheduledTask.test.ts`
   - 覆盖手动执行会立即写入 pending run。
   - 文件：`src/renderer/store/slices/scheduledTaskSlice.test.ts`
   - 覆盖真实运行记录到达后会移除 pending run。

本轮刻意未改：

1. 不改 OpenClaw `cron.run` 和 `cron.runs` 协议。
2. 不改运行历史 UI 结构。
3. 不改青数工作台外壳和任务管理入口。

原则校验：

1. KISS
   - 用一条确定 id 的 pending run 表达“已触发”，不新增独立 loading store。
2. YAGNI
   - 暂不做复杂的进度条或运行阶段状态机。
3. SOLID
   - service 负责创建乐观占位，slice 负责接收真实数据并去重。
4. DRY
   - pending id 统一使用 `pending-manual-{taskId}`，避免多处不同匹配规则。

本轮验证：

1. `npm test -- --run src/renderer/services/scheduledTask.test.ts src/renderer/store/slices/scheduledTaskSlice.test.ts src/renderer/components/scheduledTasks/utils.test.ts`
   - 3 个测试文件通过。
   - 19 条测试通过。
2. `npx tsc --project tsconfig.json --noEmit`
   - 通过。

后续规划：

1. 继续 ScheduledTasks：
   - 检查运行失败时是否需要 toast 或 inline error 更强提示。
   - 检查全局历史筛选下 pending run 是否要受当前筛选条件约束。
2. 回到 Cowork：
   - 检查 `sessions:changed` 局部刷新是否会覆盖当前激活会话。
   - 继续筛 main 可安全吸收的小型 bugfix。
3. 继续暂缓：
   - 主控台 UI 整包替换。
   - 输入区大迁移。
   - POPO/IM 大迁移。
   - per-agent `modelSlice`。

## 2026-05-11：ScheduledTasks 手动执行即时反馈收口

本轮继续小步筛 `origin/main` 中适合当前分支吸收的公共能力。先复核了输入区 slash command：`origin/main` 没有独立的 slash command 菜单实现，输入区差异主要是模型选择和 UI 结构迁移；当前分支输入区还承载青数唤醒、语音输入和 TTS 后续开麦链路，因此本轮不做高耦合输入区替换。

随后转向之前真实出现过的 ScheduledTasks 体验问题：点击任务详情页“立即运行”后，如果后端/网关状态回传较慢，用户会感觉按钮没有反应。底层 `scheduledTaskService.runManually(...)` 已经有乐观状态更新和失败回滚，本轮只补足 UI 即时反馈。

本轮代码更新：

1. 任务详情页执行按钮显示运行态
   - 文件：`src/renderer/components/scheduledTasks/TaskDetail.tsx`
   - 任务 `state.runningAtMs` 存在时，按钮从单个播放图标切换为 `运行中` 文案。
   - 增加 spinner，按钮使用 `cursor-wait` 和 primary 色态。
   - 避免用户点击后误以为没有触发。
2. 任务列表菜单运行项显示运行态
   - 文件：`src/renderer/components/scheduledTasks/TaskList.tsx`
   - 列表更多菜单中，任务运行中时显示 spinner + `运行中`。
   - 继续禁用重复点击，沿用 service 层 dedupe 防线。

本轮刻意未改：

1. 不迁移 `origin/main` 的输入区结构，避免影响唤醒/语音/TTS。
2. 不改 OpenClaw cron 执行链路，不改 `cron.run` IPC 语义。
3. 不改 ScheduledTasks 大布局和青数工作台外壳。

原则校验：

1. KISS
   - 利用现有 `runningAtMs` 乐观状态，仅补 UI 表达，不新增复杂状态机。
2. YAGNI
   - 不为了 slash command 做当前没有 main 真源的独立大功能。
3. SOLID
   - service 层负责执行/回滚，组件只负责根据任务状态渲染。
4. DRY
   - 复用既有 `scheduledTasksStatusRunning` 文案，不新增重复 i18n key。

本轮验证：

1. `npm test -- --run src/renderer/services/scheduledTask.test.ts src/renderer/store/slices/scheduledTaskSlice.test.ts src/renderer/components/scheduledTasks/utils.test.ts`
   - 3 个测试文件通过。
   - 18 条测试通过。
2. `npx tsc --project tsconfig.json --noEmit`
   - 通过。

后续规划：

1. 继续 ScheduledTasks 小步收口：
   - 检查任务执行状态刷新后是否需要自动刷新详情页运行历史。
   - 检查运行失败 toast / inline error 是否足够明确。
2. 回到 Cowork 行为层：
   - 检查 `sessions:changed` 局部刷新是否会覆盖当前激活会话。
   - 继续确认 main 中可安全吸收的公共 bugfix。
3. 继续暂缓高耦合迁移：
   - 输入区大 UI 替换。
   - 主控台 UI 整包替换。
   - POPO/IM 大迁移。
   - per-agent `modelSlice`。

## 2026-05-11：Cowork 历史消息展示完整性保护

本轮继续 `Cowork / message rendering` 行为层，重点复核“一个 Agent 下某个 session 的历史对话在窗口中显示不全”这一类问题。代码链路确认后，当前分支前端没有硬编码展示条数上限；更高风险点仍是 OpenClaw 历史同步把 SQLite 中的 user/assistant 展示数据源覆盖短。

本轮复核结论：

1. 前端展示层没有分页截断
   - 文件：`src/renderer/components/cowork/CoworkSessionDetail.tsx`
   - 当前展示链路是 `currentSession.messages -> buildDisplayItems(...) -> buildConversationTurns(...)`。
   - `renderConversationTurns()` 对全部 turns 做 `map(...)`，没有按最近 N 条 `slice(...)`。
2. 懒渲染不会删除历史
   - 文件：`src/renderer/components/cowork/LazyRenderTurn.tsx`
   - `LazyRenderTurn` 只在远离视口时渲染占位，并在进入视口后保持已渲染内容。
   - 它不改变 `turns` 数组，也不丢弃 session message。
3. 主进程读取 session 也是全量消息
   - 文件：`src/main/coworkStore.ts`
   - `getSessionMessages(...)` 从 `cowork_messages` 按 `sequence/created_at/ROWID` 排序读取全部消息，没有 `LIMIT/OFFSET`。
4. 真正需要重点保护的是历史同步覆盖
   - 文件：`src/main/libs/agentEngine/openclawRuntimeAdapter.ts`
   - `reconcileWithHistory(...)` 在 `chat.history` 返回短窗口时，可能触发 `replaceConversationMessages(...)`。
   - 当前分支已有 channel 保护：当识别为 channel session 且本地历史更长时，不允许用短窗口缩短本地历史。

本轮代码更新：

1. 增加 channel 短窗口无重叠回归测试
   - 文件：`src/main/libs/agentEngine/openclawRuntimeAdapter.test.ts`
   - 使用真实形态 sessionKey：`agent:main:feishu:account:direct:user`。
   - 模拟本地已有 3 轮历史，网关 `chat.history` 只返回 1 轮且与本地无重叠。
   - 断言不会调用 `replaceConversationMessages(...)`，本地 6 条 user/assistant 消息保持不变。

本轮刻意未改：

1. 不改主控台 UI 和对话窗口视觉结构。
2. 不引入消息分页或虚拟列表重构。
3. 不改青数 managed sessionKey 生成规则。
4. 不碰唤醒/TTS、工作台、治理链。

原则校验：

1. KISS
   - 先锁住真实危险点的数据覆盖，不额外引入复杂前端分页状态。
2. YAGNI
   - 当前没有证据证明前端条数限制存在，因此不做 UI 大改。
3. SOLID
   - 数据完整性保护留在 OpenClaw history reconcile 层，展示层继续只消费 session messages。
4. DRY
   - 继续复用既有 `isChannelSessionKey(...)` 和 `replaceConversationMessages(...)` 测试夹具。

本轮验证：

1. `npm test -- --run src/main/libs/agentEngine/openclawRuntimeAdapter.test.ts`
   - 1 个测试文件通过。
   - 53 条测试通过。

后续规划：

1. 继续 Cowork 行为层小步收口：
   - 检查 slash command 是否需要独立接入，避免搬 main 的大输入区改造。
   - 检查 session 切换和 `sessions:changed` 局部刷新是否还有旧 session 覆盖当前 session 的风险。
2. 回到 ScheduledTasks：
   - 继续核对任务详情页执行中反馈、运行状态刷新和错误提示。
3. 继续暂缓高耦合迁移：
   - `better-sqlite3` 存储迁移。
   - 主控台 UI 整包替换。
   - POPO/IM 大迁移。
   - per-agent `modelSlice`。

## 2026-05-11：OpenClaw patch 临时文件并发保护补测

本轮继续构建脚本保护边界，聚焦 `scripts/apply-openclaw-patches.cjs`。`origin/main` 会把 CRLF patch 规范化后的临时文件名退回固定 `lobsterai-patch-${patchFile}`，这在并发构建或多 agent 同时准备 OpenClaw runtime 时可能互相覆盖。当前分支保留 `process.pid` 前缀，本轮将这条保护固化为测试。

本轮已完成：

1. 抽出 patch 规范化 helper
   - 文件：`scripts/apply-openclaw-patches.cjs`
   - 新增 `getNormalizedPatchTempPath(...)`。
   - 新增 `preparePatchForGitApply(...)`。
   - CLI 主流程仍按原路径执行，只是复用 helper。
   - 测试模式通过 `APPLY_OPENCLAW_PATCHES_TEST_MODE=1` 导出 helper，避免 require 时触发真实 patch 流程。
2. 保留 process-specific 临时文件名
   - 文件：`scripts/apply-openclaw-patches.cjs`
   - CRLF patch 会写入 `lobsterai-patch-${process.pid}-${patchFile}`。
   - 避免并发 patch 时多个进程读写同一个临时 patch 文件。
3. 新增脚本回归测试
   - 文件：`src/main/libs/applyOpenClawPatches.test.ts`
   - 覆盖临时 patch 路径包含 pid。
   - 覆盖 CRLF patch 会被写入进程专属临时文件并去掉 `\r`。
   - 覆盖 LF-only patch 继续使用原路径，不额外创建临时文件。

本轮刻意未改：

1. 不改 patch 应用策略和 `git apply` 判定流程。
2. 不改 OpenClaw 版本、patch 内容和源码目录定位。
3. 不合入 `origin/main` 的固定临时文件名回退。

校验结果：

1. `npm test -- --run src/main/libs/applyOpenClawPatches.test.ts` 通过，`1` 个测试文件、`3` 个用例。
2. `npx tsc --project electron-tsconfig.json --noEmit` 通过。

后续规划：

1. 构建脚本防线还剩 `prune-openclaw-runtime.cjs` 可继续补统计/bytesFreed 边界。
2. 完成 prune 边界后，再回到 OpenClaw runtime adapter 小补丁筛选。
3. 仍暂缓 OpenClaw 主干重构、POPO/IM 大迁移、per-agent `modelSlice`。

## 2026-05-11：electron-builder hooks 打包保护边界补测

本轮继续 `OpenClaw runtime patch / 构建打包稳定性`，目标是把当前分支相对 `origin/main` 更适合青数包的打包保护点固化为测试。`origin/main` 会删除 macOS speech/TTS helper 构建，并对 optional plugin 校验更严格；这两处不适合直接覆盖当前分支。

本轮已完成：

1. 抽出 macOS helper 构建函数
   - 文件：`scripts/electron-builder-hooks.cjs`
   - 新增 `buildMacosGeneratedHelpers(...)`。
   - `beforePack(...)` 仍按原流程调用该函数，打包行为不变。
   - 测试入口通过 `module.exports.__test__` 暴露，不影响 electron-builder hook 使用 `beforePack / afterPack`。
2. 保留 optional plugin 校验边界
   - 文件：`scripts/electron-builder-hooks.cjs`
   - `verifyPreinstalledPlugins(...)` 继续跳过 `optional: true` 的 OpenClaw plugin。
   - 避免 `moltbot-popo / openclaw-nim-channel` 这类可选能力缺失时阻断 macOS 测试包。
3. 新增构建 hook 回归测试
   - 文件：`src/main/libs/electronBuilderHooks.test.ts`
   - 覆盖 optional plugin 缺失不会抛错。
   - 覆盖 required plugin 缺失仍会抛错。
   - 覆盖 macOS target 会同时构建 speech helper 和 TTS helper。
   - 覆盖非 macOS target 不构建 speech/TTS helper。

本轮刻意未改：

1. 不移除 macOS speech/TTS helper 构建。
2. 不改 electron-builder 配置，不动品牌、权限、资源打包路径。
3. 不引入 `origin/main` 的 NSIS/Defender/better-sqlite3 安装策略迁移。
4. 不改 OpenClaw runtime 主干或插件安装脚本。

校验结果：

1. `npm test -- --run src/main/libs/electronBuilderHooks.test.ts` 通过，`1` 个测试文件、`4` 个用例。
2. `npx tsc --project electron-tsconfig.json --noEmit` 通过。

后续规划：

1. 继续构建脚本保护边界：
   - `apply-openclaw-patches.cjs` 临时 patch 文件名应包含 `process.pid`。
   - `prune-openclaw-runtime.cjs` dual-root extension node_modules 清理已经有测试，可继续补统计/bytesFreed 边界。
2. 完成脚本防线后，再回到 OpenClaw runtime adapter 小补丁筛选。
3. 高耦合批次继续暂缓：OpenClaw 主干重构、POPO/IM 大迁移、per-agent `modelSlice`。

## 2026-05-11：OpenClaw GatewayClient 探测防线补测

本轮从 `IM / Agent` 小批次转回 `OpenClaw runtime patch / 构建打包稳定性`。对比 `origin/main` 后确认，当前分支在 GatewayClient 入口探测上保留了更稳的行为：不会只按文件名选择 `client-*.js` 或 `method-scopes-*.js`，而是会加载候选模块并检查是否导出了具备 `start / stop / request` 原型方法的 GatewayClient 兼容构造器。本轮不改 runtime 逻辑，只补测试防止后续继续合 main 时误删这条防线。

本轮已完成：

1. GatewayClient 入口探测回归测试
   - 文件：`src/main/libs/openclawEngineManager.test.ts`
   - 覆盖当 `method-scopes-a.js` 不含有效 GatewayClient、`method-scopes-b.js` 通过 minified export 导出兼容构造器时，会选择后者。
   - 覆盖所有候选都无法验证时，才回退到第一个 `method-scopes-*` 候选。
2. 保留当前分支更强行为
   - 文件：`src/main/libs/openclawEngineManager.ts`
   - 本轮没有改运行时代码。
   - 继续保留 `moduleExportsGatewayClient(...)` 的 duck-type 探测，避免再次出现 “Invalid OpenClaw gateway client module: exports: n, r, t” 一类问题。

本轮刻意未改：

1. 不合入 `origin/main` 的 OpenClaw 主干重构。
2. 不改 gateway 启动/重启策略、配置同步、认证 token refresher。
3. 不改 macOS speech/TTS helper 打包链路和青数唤醒/TTS 覆盖层。
4. 不反向覆盖当前分支的构建脚本保护，例如 patch 临时文件带 `process.pid`、optional plugin 跳过校验、dual-root prune。

校验结果：

1. `npm test -- --run src/main/libs/openclawEngineManager.test.ts` 通过，`1` 个测试文件、`8` 个用例。
2. `npx tsc --project electron-tsconfig.json --noEmit` 通过。

后续规划：

1. 继续 `OpenClaw runtime patch / 构建打包稳定性`，优先补测试锁住构建脚本保护边界，而不是整包搬 `origin/main`。
2. 下一步候选：
   - `electron-builder-hooks.cjs` macOS speech/TTS helper 仍必须构建。
   - `verifyPreinstalledPlugins(...)` 仍应跳过 optional plugin。
   - `apply-openclaw-patches.cjs` 临时 patch 文件名仍应包含 `process.pid`，避免并发冲突。
3. 高耦合内容继续单独批次：
   - OpenClaw 主干重构。
   - POPO/IM 大迁移。
   - per-agent `modelSlice`。

## 2026-05-11：Agent/IM 多实例保存边界收口

本轮继续小步筛 `origin/main` 中的 IM/Agent 公共能力，但不整包迁移 `main` 的 POPO/IM 大 UI 和 `better-sqlite3` 存储主干。当前分支已经具备 `dingtalk / feishu / qq / wecom` 的 Agent 多实例绑定，本轮只补一个低风险边界：批量保存多实例配置时，旧实例与旧绑定也必须同步收掉，避免设置页保存后残留幽灵实例。

### 追加：renderer 本地状态层同步收口

在主进程 `IMStore` 已经具备替换清理语义后，本轮继续把 renderer 的 `imSlice` 本地状态同步收紧，避免设置页保存或实例列表替换后，Redux 中短暂保留已删除实例的 Agent 绑定。

本轮已完成：

1. `IMStore` 多实例批量保存改为替换语义
   - 文件：`src/main/im/imStore.ts`
   - 新增 `replaceMultiInstanceConfig(...)`，统一处理 `dingtalk / feishu / qq / wecom`。
   - 写入新实例前会删除不在新列表中的旧实例。
   - 删除旧实例时同步清理对应 `platformAgentBindings`，避免 Agent 仍绑定到已删除 IM 实例。
   - `setConfig(...)` 会先落 `settings` 再执行多实例替换，避免整份配置保存时把旧绑定重新写回。
2. `imSlice` 多实例本地替换同步清理绑定
   - 文件：`src/renderer/store/slices/imSlice.ts`
   - 新增 `removeStaleInstanceBindings(...)`，统一处理 `dingtalk / feishu / qq / wecom`。
   - `setConfig(...)` 全量加载配置时会统一净化多实例旧绑定，避免旧数据库或主进程返回脏绑定后污染 UI。
   - `set*Instances(...)` 和 `set*MultiInstanceConfig(...)` 替换实例列表时，会同步删除已不存在实例的 `platformAgentBindings`。
   - 保留其他平台绑定和仍存在实例绑定，避免误删 Telegram、微信等单实例平台绑定。
3. 补齐 main store 回归测试
   - 文件：`src/main/im/imStore.test.ts`
   - 覆盖 `setFeishuMultiInstanceConfig(...)` 替换实例列表时，会删除旧实例、保留更新后的实例，并只清理被删除实例的 Agent 绑定。
   - 覆盖 `setConfig(...)` 接收到带旧绑定的整份配置时，主进程 store 仍会清理已删除实例绑定。
4. 补齐 renderer store 回归测试
   - 文件：`src/renderer/store/slices/imSlice.test.ts`
   - 覆盖 `setConfig(...)` 加载完整配置时清理已不存在实例绑定。
   - 覆盖 `setDingTalkInstances / setFeishuMultiInstanceConfig / setQQInstances / setWecomMultiInstanceConfig` 替换实例列表时清理旧实例绑定。
   - 调整 fixture 让 “kept” 绑定对应真实存在实例，避免测试只验证孤儿绑定。
5. 补齐 Agent dirty-state 回归测试
   - 文件：`src/renderer/components/agent/agentDraftState.test.ts`
   - 明确“只选择 IM 实例绑定”也会被视为可保存改动。
   - 明确绑定集合未变化时不会误判为 dirty，避免保存按钮常亮。

本轮刻意未改：

1. 不迁移 `origin/main` 的 NIM/Email/Discord/POPO 全平台多实例大迁移。
2. 不替换当前 Agent 新建/编辑 UI，不动青数治理预览、tool bundle 只读提示和工作台壳层。
3. 不引入 `better-sqlite3`，继续沿用当前分支已验证的 `sql.js` 存储链路。

校验结果：

1. `npm test -- --run src/renderer/store/slices/imSlice.test.ts src/main/im/imStore.test.ts src/renderer/components/agent/agentDraftState.test.ts src/renderer/components/agent/agentImBindingConfig.test.ts` 通过，`4` 个测试文件、`36` 个用例。
2. `npx tsc --project tsconfig.json --noEmit` 通过。

后续规划：

1. 继续从 `IM / Agent / Skill` 中筛低耦合公共能力，优先看 IM 设置页本地状态同步和删除实例后的 renderer store 一致性。
2. 再回到 `OpenClaw runtime patch / 构建打包稳定性`，只补可单测的小型 runtime 防线。
3. `POPO/IM 大迁移`、`per-agent modelSlice`、`OpenClaw 主干重构` 继续单独批次处理。

## 2026-05-11：main 2026.5.9 第一批低风险同步

本轮开始按批次把最新 `main` 的公共更新合入当前 `front-design-merge`。为保护青数品牌、工作台、内置治理链、主操作台 UI、唤醒/TTS 和现有业务逻辑，本批只同步低风险运行时元数据，不做整仓 merge，也不引入 `better-sqlite3`、Agent UI 大迁移、POPO/IM 大迁移、per-agent modelSlice 或 OpenClaw 主干重构。

本轮已完成：

1. 应用版本对齐到 `main`
   - 文件：`package.json`
   - `version` 从 `2026.5.7` 更新到 `2026.5.9`。
2. OpenClaw 微信插件版本对齐到 `main`
   - 文件：`package.json`
   - `openclaw-weixin` 从 `2.1.10` 更新到 `2.4.3`。
   - OpenClaw runtime 主版本仍保持 `v2026.4.14`，本次不重建主干 runtime。
3. lockfile 根版本同步
   - 文件：`package-lock.json`
   - 仅同步根包版本字段到 `2026.5.9`。
   - 保留当前分支的 `sql.js` 依赖路线，不迁移 `main` 的 `better-sqlite3`。

本轮刻意未改：

1. 不改青数品牌、工作台、内置治理链、主操作台 UI。
2. 不改唤醒/TTS、wake activation 缓存、语音拉起链路。
3. 不改 IM/POPO 大迁移、Agent 设置 UI、per-agent modelSlice。
4. 不改 OpenClaw 主干 runtime 和认证 token refresher。

后续规划：

1. 第二批进入 Cowork 公共修复筛选：分页/历史展示、token/ctx 元数据、停止会话 tool approval 防线、`NO_REPLY`/heartbeat sync。先逐文件比对 `coworkStore.ts`、`openclawRuntimeAdapter.ts`、`coworkSlice.ts`、`CoworkSessionDetail.tsx`，避免覆盖当前分支已有的历史展示修复。
2. 第三批处理 Artifacts/file preview 与 CodeMirror 渲染，只接公共能力，不替换主控台壳层。
3. 第四批处理定时任务公共能力：cron schedule type、执行历史分页/过滤、DateInput 体验，保留当前 OpenClaw native cron 与青数任务管理逻辑。
4. 第五批再评估 Agent working directory、模型配置轻量项；高耦合的 POPO/IM 大迁移、OpenClaw 主干重构、per-agent modelSlice 单独开批。

## 2026-05-11：Cowork 停止会话后的晚到 approval 抑制

本轮进入第二小批 Cowork/OpenClaw 公共修复筛选。`main` 中有一项体验修复：用户点击停止后，gateway 晚到的 approval 不应继续驱动工具调用。当前分支此前只抑制删除类命令的权限弹窗，非删除命令仍会先走 auto-approve，因此本轮只吸收该行为目标，不照搬 `main` 中会破坏当前 `return` 流程的实现形态。

本轮已完成：

1. 停止冷却判断提前到 auto-approve 之前
   - 文件：`src/main/libs/agentEngine/openclawRuntimeAdapter.ts`
   - `handleApprovalRequested()` 在识别到 session 后先检查 `isSessionInStopCooldown(sessionId)`。
   - 如果用户刚停止会话，晚到的删除命令和非删除命令 approval 都直接忽略。
   - 保留当前分支 auto-approve 后立即 `return` 的正确行为，避免重复写入 `pendingApprovals`。
2. 补充非删除命令回归测试
   - 文件：`src/main/libs/agentEngine/openclawRuntimeAdapter.test.ts`
   - 覆盖 stop cooldown 内 `curl https://example.com` 不触发 `permissionRequest`。
   - 覆盖该请求不会调用 `respondToPermission()`，也不会残留 `pendingApprovals`。

本轮刻意未改：

1. 不改 approval 状态机和权限 UI。
2. 不改 OpenClaw gateway lifecycle、channel session sync、治理链和唤醒/TTS。
3. 不引入 `main` 的 OpenClaw 主干重构、per-agent modelSlice、POPO/IM 大迁移。

后续规划：

1. 继续 Cowork 公共修复筛选：优先核对消息 metadata/token usage、ctx 展示、`NO_REPLY`/heartbeat 同步在当前分支是否已经覆盖。
2. 如果现有实现已覆盖，则只补回归测试和 changelog，不做无收益重构。
3. 下一批再评估 Artifacts/file preview 与 CodeMirror 渲染，确保不替换青数主控台壳层。

## 2026-05-11：Cowork 消息 metadata / token / ctx 展示接线

本轮继续筛 `main` 的 Cowork 消息元信息能力。当前分支 OpenClaw runtime 已经能写入 assistant 消息的 `usage/contextPercent/model/agentName` metadata，但 renderer 类型和展示层没有完整接上这些字段，导致底层已有信息无法在对话窗口展示。本轮只补展示接线，不改对话窗口结构和青数主控台 UI。

本轮已完成：

1. renderer metadata 类型补齐
   - 文件：`src/renderer/types/cowork.ts`
   - `CoworkMessageMetadata` 新增：
     - `usage.inputTokens`
     - `usage.outputTokens`
     - `usage.cacheReadTokens`
     - `usage.cacheWriteTokens`
     - `contextPercent`
     - `model`
     - `agentName`
2. assistant 消息下方展示元信息
   - 文件：`src/renderer/components/cowork/CoworkSessionDetail.tsx`
   - 在最后一条 assistant 回复下方展示：
     - `Model`
     - `Tokens`
     - `Cache read`
     - `Ctx`
     - `Agent`
   - 保留当前分支已有 TTS 播放按钮、复制按钮、图片预览和青数对话展示逻辑。

本轮刻意未改：

1. 不合入 `main` 的 Cowork 分页 UI 和主控台布局调整。
2. 不改变 `buildConversationTurns()`、历史消息展示和 TTS 文案播放链路。
3. 不改 OpenClaw runtime usage 计算逻辑，只把已有 metadata 展示出来。

后续规划：

1. 继续核对 `NO_REPLY` / heartbeat 修复：当前分支已有 `openclawHistory.ts` 过滤和测试，下一步以“确认覆盖度 + 必要补测”为主。
2. 再评估 Artifacts/file preview：优先接低耦合 parser/store 或预览修复，不替换主控台 UI。
3. 定时任务 run history pagination/filtering 进入后续独立批次。

## 2026-05-11：NO_REPLY / heartbeat 历史同步抑制收口

本轮继续对齐 `main` 中对 OpenClaw 心跳与静默回复的公共修复。当前分支已经过滤 `HEARTBEAT_OK` 和 heartbeat prompt，但静默回复 `NO_REPLY` 仍缺少共享抑制入口，且 history entry 没有提取 timestamp / usage / model。为避免对话中出现 `NO_REPLY` 或其心跳噪声，本轮把判断下沉到 `openclawHistory.ts`，adapter 复用同一入口。

本轮已完成：

1. 共享 history helper 补强
   - 文件：`src/main/libs/openclawHistory.ts`
   - 新增 `isSilentReplyText()` 和 `isSilentReplyPrefixText()`。
   - 新增 `shouldSuppressHeartbeatText()`，统一过滤：
     - assistant/system 的 `HEARTBEAT_OK`
     - assistant/system 的 `NO_REPLY`
     - user 的 heartbeat prompt
   - `extractGatewayHistoryEntry()` 复用该判断。
2. history entry 元信息提取
   - 文件：`src/main/libs/openclawHistory.ts`
   - `GatewayHistoryEntry` 支持 `timestamp / usage / model`。
   - 提取 `timestamp / createdAt / created_at / time`。
   - 提取 `usage.input / usage.output / usage.cacheRead / usage.totalTokens` 和 `model`。
3. runtime adapter 复用共享抑制逻辑
   - 文件：`src/main/libs/agentEngine/openclawRuntimeAdapter.ts`
   - 删除 adapter 内局部 heartbeat 判断，改为从 `openclawHistory.ts` 导入 `shouldSuppressHeartbeatText()`。
4. 回归测试补齐
   - 文件：`src/main/libs/agentEngine/openclawRuntimeAdapter.test.ts`
   - `syncSystemMessagesFromHistory()` 跳过 `NO_REPLY` system 消息。
   - `collectChannelHistoryEntries()` 跳过 `NO_REPLY` assistant 消息。

本轮刻意未改：

1. 不改 gateway heartbeat 任务调度和启动机制。
2. 不改对话窗口主结构、青数工作台、治理链和唤醒/TTS。
3. 不引入 `main` 的 OpenClaw 主干重构。

后续规划：

1. 继续筛 Artifacts/file preview 中可独立合入的公共能力，优先 parser/store/文件去重/路径校验。
2. 定时任务 run history pagination/filtering 作为下一独立批次。
3. Agent working directory 与工作台状态耦合较高，后续单独评估，不混入当前批次。

## 2026-05-11：Artifacts 第一阶段 parser / file preview 基础能力

本轮开始筛 `main` 的 Artifacts / file preview 公共能力。完整 Artifacts panel 会牵动 Redux、IPC、`main.ts`、`preload.ts` 和对话窗口布局，不适合一口气覆盖当前青数主控台。因此本轮只先接纯函数 parser 和类型扩展，为后续 UI 接入打基础。

本轮已完成：

1. Artifact 类型扩展
   - 文件：`src/renderer/types/artifact.ts`
   - `ArtifactType` 增加：
     - `image`
     - `markdown`
     - `text`
     - `document`
   - 新增 `PREVIEWABLE_ARTIFACT_TYPES` 和 `ArtifactSource`。
   - `Artifact` 支持 `sessionId / fileName / filePath / source`。
   - 兼容当前旧字段 `conversationId`，避免影响现有引用。
2. 新增 artifact parser
   - 文件：`src/renderer/services/artifactParser.ts`
   - 支持代码块 artifact 识别。
   - 支持 file link 识别：`[name](file://...)`。
   - 支持裸文件路径识别。
   - 支持 Write / write_file 工具产物识别。
   - 支持 Windows `file:///D:/...` 前导 `/` 修正。
   - 支持路径去重归一化：反斜杠转斜杠、大小写归一。
3. 新增 parser 回归测试
   - 文件：`src/renderer/services/artifactParser.test.ts`
   - 覆盖 Windows file URL、Unix file URL、URI 编码路径、裸 file URL、Write 工具产物和 dedup normalize。

本轮刻意未改：

1. 不接完整 Artifacts panel。
2. 不新增 CodeMirror 依赖。
3. 不改 `main.ts / preload.ts / electron.d.ts` 的 file preview IPC。
4. 不改青数主控台布局、工作台、治理链和唤醒/TTS。

后续规划：

1. Artifacts 第二阶段再评估 `artifactSlice` 和最小展示入口，优先不替换当前 Cowork 对话布局。
2. 如果完整 panel 牵动过大，则转而只接 file preview 去重/路径校验到现有 Markdown 链接展示。
3. 定时任务 run history pagination/filtering 继续作为下一独立批次。

## 2026-05-11：定时任务全局执行历史 hasMore 状态收口

本轮继续对齐 `main` 的定时任务执行历史分页能力。当前分支已经具备 `limit / offset / filter` 服务层接口和 task-level run history 的 `hasMore`，但全局历史页仍通过 `allRuns.length >= 50 && allRuns.length % 50 === 0` 推断是否显示“加载更多”。这个推断在最后一页刚好 50 条或过滤后返回不足时不够稳。本轮补明确 `allRunsHasMore` 状态，不改任务创建、青数任务管理和 IM 投递逻辑。

本轮已完成：

1. Redux slice 增加全局历史 hasMore
   - 文件：`src/renderer/store/slices/scheduledTaskSlice.ts`
   - 新增 `allRunsHasMore`。
   - `setAllRuns()` / `appendAllRuns()` 支持 `{ runs, hasMore }` payload。
   - 保留旧数组 payload 兼容，旧调用会自动把 `allRunsHasMore` 清为 `false`。
2. scheduledTask service 写入 hasMore
   - 文件：`src/renderer/services/scheduledTask.ts`
   - `loadAllRuns(limit, offset)` 根据返回条数和 `limit` 计算 `hasMore`。
   - 初始加载和分页追加都把 `hasMore` 写入 slice。
3. 全局历史 UI 使用明确状态
   - 文件：`src/renderer/components/scheduledTasks/AllRunsHistory.tsx`
   - “加载更多”按钮改由 `allRunsHasMore` 控制，不再用长度倍数推断。
4. 回归测试补齐
   - 文件：`src/renderer/store/slices/scheduledTaskSlice.test.ts`
   - 覆盖初始加载 hasMore、分页追加 dedup 后更新 hasMore、旧 payload 兼容、删除 task 时清理对应 allRuns。

本轮刻意未改：

1. 不改任务表单和青数内置任务管理逻辑。
2. 不搬 `main` 的 DateInput / UI 大调整。
3. 不改 OpenClaw native cron、IM delivery route 和唤醒/TTS。

后续规划：

1. 下一批继续定时任务细项：核对 `DateInput` 是否可独立接入，若会影响当前表单视觉则只补测试不搬 UI。
2. 再回到 Artifacts 第二阶段：评估 `artifactSlice` 和最小展示入口。
3. 高耦合 Agent working directory / per-agent modelSlice / POPO-IM UI 仍保持单独批次。

## 2026-05-11：Artifacts 第二阶段 Redux 状态层接入

本轮继续 Artifacts 公共能力，但仍不接完整预览面板。经对比 `main`，`artifactSlice` 是独立状态层，能先安全接入 store，为后续最小展示入口做准备；完整 panel / CodeMirror / IPC 文件预览仍属于下一步评估范围。

本轮已完成：

1. 新增 artifact Redux slice
   - 文件：`src/renderer/store/slices/artifactSlice.ts`
   - 支持按 session 存储 artifacts。
   - 支持按 normalized filePath 去重，避免 `file:///D:/...` 与 `D:\...` 重复显示。
   - 支持选择 artifact、打开/关闭 panel 状态、tab 状态、panel 宽度 clamp。
   - 支持清理单个 session 的 artifacts。
2. 接入 store
   - 文件：`src/renderer/store/index.ts`
   - 新增 `artifact` reducer。
3. 新增 slice 回归测试
   - 文件：`src/renderer/store/slices/artifactSlice.test.ts`
   - 覆盖 filePath 去重、带 content 的 artifact 替换、选择后打开 preview 状态、panel width clamp、清理 session。

本轮刻意未改：

1. 不渲染完整 Artifacts panel。
2. 不新增 CodeMirror 依赖。
3. 不改 `main.ts / preload.ts / electron.d.ts` 的文件读取 IPC。
4. 不动青数主控台布局、工作台、治理链和唤醒/TTS。

后续规划：

1. Artifacts 第三阶段再评估最小展示入口：优先在现有 Markdown/link 体系中展示 artifact badge，而不是直接搬完整右侧 panel。
2. 定时任务 DateInput 继续只读核对，避免破坏当前表单视觉。
3. Agent working directory、per-agent modelSlice、POPO/IM UI 仍保持高耦合单独批次。

## 2026-05-11：定时任务 DateInput 批次评估与表单解析测试补强

本轮按规划核对 `main` 的 `DateInput`。结论是：`DateInput` 并不是一个可安全单独搬入的低耦合组件，它在 `main` 中伴随 `TaskForm.tsx` 超过千行的表单结构调整。如果直接接入，会影响当前分支已经验收过的青数定时任务表单视觉、IM 多实例通知选择和 OpenClaw native cron 逻辑。因此本轮不搬 UI，改为补当前表单数据模型测试。

本轮已完成：

1. 补强 schedule 解析测试
   - 文件：`src/renderer/components/scheduledTasks/utils.test.ts`
   - 覆盖一次性 `at` schedule 解析到本地年月日时分秒。
   - 覆盖 daily cron 解析。
   - 覆盖 monthly cron 解析。
   - 覆盖 `every` schedule 和复杂 cron 回落到 `advanced`。

本轮刻意未改：

1. 不新增 `DateInput.tsx`。
2. 不搬 `main` 的大块 `TaskForm.tsx` UI 重构。
3. 不改任务创建、IM 通知、多实例 accountId/filterAccountId、OpenClaw native cron 和唤醒/TTS。

后续规划：

1. Artifacts 第三阶段可以考虑最小 badge 入口，但必须先确认不会改变 Cowork 对话布局。
2. 继续核对 Agent working directory 的数据层是否能单独接入；如果需要工作台状态模型大改，则暂缓。
3. POPO/IM UI 大迁移和 per-agent modelSlice 仍作为高耦合独立批次。

## 2026-05-11：OpenClaw / IM 热路径日志降噪

本轮继续做低风险公共质量收口，不改运行时状态机，只把长对话、IM channel sync、final history sync 中的调试型日志从 info 级降到 debug 级，减少生产日志刷屏和排障噪声。

本轮已完成：

1. OpenClaw channel polling 降噪
   - 文件：`src/main/libs/agentEngine/openclawRuntimeAdapter.ts`
   - `startChannelPolling()` 重复启动提示改为 `console.debug`。
   - `pollChannelSessions()` 因 gateway client 或 sync service 暂缺而跳过时改为 `console.debug`。
   - 真正异常仍保留 `warn/error`。
2. OpenClaw agent event 调试日志降噪
   - 文件：`src/main/libs/agentEngine/openclawRuntimeAdapter.ts`
   - `handleAgentEvent` 中 session resolve、manual stop late event、re-created channel session、mismatch/drop/buffer 等逐事件日志改为 `console.debug`。
   - 避免 IM 多实例、定时任务和 channel follow-up 高频事件污染 info 日志。
3. OpenClaw final assistant sync 降噪
   - 文件：`src/main/libs/agentEngine/openclawRuntimeAdapter.ts`
   - `syncFinalAssistantWithHistory()` 中 chat.history retry、history entry dump、non-text block dump、stale turn token、canonical text length 等日志改为 `console.debug`。
   - 保留 final history sync 行为，不改变历史对话展示逻辑。

本轮刻意未改：

1. 不改 OpenClaw gateway lifecycle。
2. 不改 channel session sync/reconcile 逻辑。
3. 不改 IM/POPO 大迁移。
4. 不改青数品牌、工作台、内置治理链和唤醒/TTS。

验证结果：

1. `npm test -- --run src/main/libs/agentEngine/openclawRuntimeAdapter.test.ts src/main/libs/openclawTranscript.test.ts src/main/im/imCoworkHandler.test.ts` 通过，`3` 个测试文件、`53` 个用例。
2. `npm test -- --run src/main/libs/agentEngine/openclawRuntimeAdapter.test.ts src/main/libs/openclawTranscript.test.ts src/main/libs/openclawHistory.test.ts src/main/libs/openclawEngineManager.test.ts src/main/libs/openclawConfigSync.test.ts src/main/libs/openclawConfigSync.runtime.test.ts src/main/libs/openclawConfigGuards.test.ts src/main/libs/openclawRuntimePackaging.test.ts src/main/libs/pruneOpenClawRuntime.test.ts src/main/im/imStore.test.ts src/main/im/imCoworkHandler.test.ts src/main/im/imScheduledTaskAgent.test.ts src/main/im/imScheduledTaskHandler.test.ts src/main/im/imDeliveryRoute.test.ts src/renderer/services/providerRequestConfig.test.ts src/shared/providers/constants.test.ts src/shared/providers/codingPlan.test.ts src/renderer/services/config.test.ts` 通过，`18` 个测试文件、`204` 个用例。
3. `npx tsc --project tsconfig.json --noEmit` 通过。
4. `npx tsc --project electron-tsconfig.json --noEmit` 通过。
5. `git diff --check` 通过。
6. 已重新生成 `.app`：
   - `npm run build` 通过。
   - `npm run compile:electron` 通过。
   - `npm run build:skills` 通过；`imap-smtp-email` 仍有 npm audit 提示 `2 moderate / 4 high`。
   - `npx electron-builder --mac --dir --config electron-builder.json` 通过。
   - 产物：`release/mac-arm64/QingShuClaw.app`，生成时间 `2026-05-11 15:11:26`，大小约 `1.6G`。
   - 本轮未生成新的 `.dmg` / `.blockmap`。
   - 本机无有效 Developer ID，签名跳过；未配置 Apple ID，公证跳过。

本轮工程原则说明：

1. `KISS`：只调整日志级别和简化文案，不碰业务分支。
2. `YAGNI`：不引入新的日志开关或运行时配置项。
3. `SOLID`：运行时事件处理职责不变，日志只作为可观测性侧面收敛。
4. `DRY`：统一把 `[Debug:*]` 热路径输出收口到 `console.debug`。

后续规划：

1. 继续扫描剩余 info 级热路径日志，优先处理循环/轮询/逐消息输出。
2. 若无低风险日志项，进入最后一轮公共核心整体验收。
3. 高耦合批次仍单独处理：POPO/IM 大迁移、per-agent `modelSlice`、OpenClaw 主干重构、OpenAI/Copilot OAuth refresher。

## 2026-05-11：IM/POPO 公共核心小批次补强

本轮进入 IM/POPO 公共核心的低风险对齐阶段。经对比 `origin/main`，main 的 IM 主体包含 `better-sqlite3`、更多平台多实例和 UI/配置模型大迁移，不适合整块覆盖当前 `sql.js` + 青数工作台链路；因此本轮只吸收可独立验证的公共行为防线。

本轮已完成：

1. `IMStore` 会话回复路由持久化补测
   - 文件：`src/main/im/imStore.test.ts`
   - 覆盖 `conversation_reply_route:{platform}:{conversationId}` 按平台和会话隔离读写。
   - 防止 IM 定时任务或异步回复投递时串到其他平台会话。
2. `IMStore` OpenClaw session key 映射补测
   - 文件：`src/main/im/imStore.test.ts`
   - 覆盖 `createSessionMapping()` 写入 `openClawSessionKey`。
   - 覆盖 `getSessionMappingByCoworkSessionId()` 能反查 session key。
   - 覆盖 `updateSessionOpenClawSessionKey()` 和 `updateSessionMappingTarget()` 能持续保留/更新实际 OpenClaw channel session key。
   - 这条防线对多实例 IM session patch、模型覆盖和定时任务回投都很关键。
3. IM runtime 消息热路径日志降噪
   - 文件：`src/main/im/imCoworkHandler.ts`
   - 将每条 runtime message 的 info 级 `console.log` 改为 `console.debug`。
   - 避免长对话、定时任务和 IM 异步消息导致生产日志刷屏。

本轮刻意未改：

1. 不迁移 `origin/main` 的 `better-sqlite3` IMStore 主体。
2. 不迁移 NIM/Email/Discord/POPO 多实例大模型。
3. 不替换当前 Agent 绑定 UI 或主控台 UI。
4. 不改青数品牌、工作台、内置治理链和唤醒/TTS。

验证结果：

1. `npm test -- --run src/main/im/imStore.test.ts src/main/im/imCoworkHandler.test.ts src/main/im/imScheduledTaskAgent.test.ts src/main/im/imScheduledTaskHandler.test.ts src/renderer/components/agent/agentImBindingConfig.test.ts src/renderer/store/slices/imSlice.test.ts` 通过，`6` 个测试文件、`33` 个用例。

本轮工程原则说明：

1. `KISS`：只补持久化映射与日志级别，不改 IM 架构。
2. `YAGNI`：暂不引入尚未验收的大范围多实例迁移。
3. `SOLID`：会话映射职责仍归 `IMStore`，消息聚合职责仍归 `IMCoworkHandler`。
4. `DRY`：复用现有 `sql.js` 测试工厂和既有 IM handler fake。

后续规划：

1. 继续筛 `origin/main` 中低耦合公共能力：IM delivery route、定时任务 conversation 列表过滤、POPO 配置状态判断。
2. 再进入 Provider/模型配置剩余小项复核。
3. POPO/IM 大迁移、per-agent `modelSlice`、OpenClaw 主干重构继续单独批次，不混入当前小步合入。

本轮继续扫描结论：

1. IM delivery route
   - 当前 `src/main/im/imDeliveryRoute.ts` 与 `origin/main` 公共行为一致。
   - 已覆盖 `deliveryContext` 优先、legacy `lastChannel/lastTo/lastAccountId` fallback、DingTalk channel session key candidates 和 legacy `dingtalk` channel send params。
   - 无需本轮改代码。
2. 定时任务 conversation 列表
   - 当前 `src/main/ipcHandlers/scheduledTask/handlers.ts` 已按 `channel -> platform` 映射，并支持 `accountId/filterAccountId` 过滤 `imStore.listSessionMappings()`。
   - 这与 `origin/main` 的公共能力一致，同时保留当前分支的 persisted jobs fallback。
   - 无需本轮改代码。
3. Provider / 模型配置
   - 当前分支新增的 `src/renderer/services/providerRequestConfig.ts` 是选择性合入后的隔离层，`origin/main` 没有同名文件。
   - 已通过测试覆盖固定 API format、Copilot URL、Gemini OpenAI-compatible URL、OpenAI Responses URL、`max_completion_tokens` 模型判断。
   - 保留青数 `/api/qingshu-claw/proxy/v1` fallback，不引入 OpenAI/Copilot OAuth token refresher。
4. 构建打包稳定性
   - 当前分支继续保留青数图标、macOS speech/TTS helper、OpenClaw runtime packaging/prune、precommit secret check。
   - `origin/main` 的 NSIS/Defender/`better-sqlite3` 相关迁移属于安装策略和存储主体变化，暂不混入当前 macOS 可验收批次。

阶段验收：

1. 公共核心回归测试
   - `npm test -- --run src/main/im/imStore.test.ts src/main/im/imCoworkHandler.test.ts src/main/im/imScheduledTaskAgent.test.ts src/main/im/imScheduledTaskHandler.test.ts src/main/im/imDeliveryRoute.test.ts src/renderer/components/agent/agentImBindingConfig.test.ts src/renderer/store/slices/imSlice.test.ts src/renderer/services/providerRequestConfig.test.ts src/shared/providers/constants.test.ts src/shared/providers/codingPlan.test.ts src/renderer/services/config.test.ts src/main/libs/openclawRuntimePackaging.test.ts src/main/libs/pruneOpenClawRuntime.test.ts`
   - 结果：`13` 个测试文件、`97` 个用例通过。
2. Provider / 认证桥接回归测试
   - `npm test -- --run src/main/libs/claudeSettings.test.ts src/main/libs/openclawConfigSync.runtime.test.ts src/main/libs/coworkFormatTransform.test.ts src/renderer/services/apiRequestHeaders.test.ts src/renderer/services/providerRequestConfig.test.ts src/renderer/services/config.test.ts`
   - 结果：`6` 个测试文件、`37` 个用例通过。
3. 类型与空白检查
   - `npx tsc --project tsconfig.json --noEmit` 通过。
   - `npx tsc --project electron-tsconfig.json --noEmit` 通过。
   - `git diff --check` 通过。
4. `.app` 测试包
   - `npm run build` 通过。
   - `npm run compile:electron` 通过。
   - `npm run build:skills` 通过；`imap-smtp-email` 生产依赖安装成功，但 npm audit 报告 `2 moderate / 4 high`，需后续单独依赖治理。
   - `npx electron-builder --mac --dir --config electron-builder.json` 通过。
   - 产物：`release/mac-arm64/QingShuClaw.app`，生成时间 `2026-05-11 15:05:42`，大小约 `1.6G`。
   - 本轮未生成新的 `.dmg` / `.blockmap`。
   - 本机没有有效 Developer ID Application 证书，签名被 electron-builder 跳过；未配置 Apple ID，公证也被跳过。

## 2026-05-11：OpenClaw session patch / thinkingLevel 验证收口

本轮继续完成 `session patch / thinkingLevel` 小批次，重点复核会话级模型覆盖、非模型策略字段透传、多实例 IM session key patch 这条链路。当前实现已经覆盖 `thinkingLevel / reasoningLevel / elevatedLevel / responseUsage / sendPolicy` 透传，本轮补齐 sessionOverride 每轮强制 patch 的回归测试。

本轮已完成的测试补强：

1. sessionOverride 模型每轮对话前都必须 patch
   - 文件：`src/main/libs/agentEngine/openclawRuntimeAdapter.test.ts`
   - 模拟 session 已设置 `modelOverride=qwen-portal/qwen3.6-plus`。
   - 即使 `lastPatchedModelBySession` 已缓存同一模型，`startSession()` 仍会在 `chat.send` 前调用 `sessions.patch`。
   - patch 使用当前 session key：`agent:agent-1:lobsterai:session-1`。
2. 保留并复核已有覆盖
   - 多实例 IM 会话使用持久化 channel session key patch。
   - model patch 会走 `normalizeModelRef()`。
   - 非 model patch 不触发 model normalization。
   - `thinkingLevel / reasoningLevel / elevatedLevel / responseUsage / sendPolicy` 原样透传。

本轮覆盖的体验风险：

1. 用户在 session 中显式选择模型后，后续对话仍被 agent 默认模型或 gateway 残留模型覆盖。
2. `thinkingLevel` 等策略字段被误当成 model patch，触发不必要的模型归一化或队列逻辑。
3. 多实例 IM 绑定场景中 patch 到 managed fallback key，而不是实际 channel session key。

本轮刻意未改：

1. 不引入 per-agent `modelSlice` 迁移。
2. 不改 Provider / Codex OAuth 认证链路。
3. 不改 UI 配置入口。
4. 不改 OpenClaw 主干 session policy。

验证结果：

1. `npm test -- --run src/main/libs/agentEngine/openclawRuntimeAdapter.test.ts` 通过，`1` 个测试文件、`43` 个用例。

本轮工程原则说明：

1. `KISS`：只补一条 sessionOverride patch 回归测试。
2. `YAGNI`：不为这条链引入 per-agent modelSlice 大迁移。
3. `SOLID`：模型覆盖、策略字段透传和 session key 选择仍由 runtime adapter 的 session patch 层负责。
4. `DRY`：复用已有 gateway client mock 和 startSession 测试模式。

后续规划：

1. `OpenClaw runtime adapter / transcript / session patch` 小批次阶段收口。
2. 下一阶段建议进入 IM/POPO 公共核心：
   - IM store 多实例状态剩余差异
   - 平台级/实例级 agent binding 边界
   - 定时任务与 IM 会话联动剩余测试
3. 如继续 OpenClaw，则只做 transcript deleted fallback / history restore 的补测，不迁 OpenClaw 主干。
4. 继续暂缓 Codex OAuth token refresher、per-agent `modelSlice`、POPO/IM UI 大迁移和 OpenClaw 主干大重构。

## 2026-05-11：OpenClaw manual stop 与 transcript 历史顺序测试收口

本轮继续完成 `openclawRuntimeAdapter.ts / openclawTranscript.ts` 小批次，补齐 manual stop 后迟到事件边界，并加强 transcript 历史恢复的多轮顺序保护。至此，runtime adapter 错误/停止收尾和 transcript 基础恢复测试可以阶段收口。

本轮已完成的测试补强：

1. manual stop 后迟到 `aborted/error` 不应污染会话
   - 文件：`src/main/libs/agentEngine/openclawRuntimeAdapter.test.ts`
   - 模拟用户调用 `stopSession()` 后，gateway 迟到发回同一 run 的 `chat state=aborted` 和 `chat state=error`。
   - 断言：
     - session 保持 `idle`
     - 不追加 timeout hint
     - 不追加 system error
     - 不发出 `message/error`
     - 不重开 active turn
     - runId 映射已清理
2. transcript 多轮 assistant/tool 历史顺序保留
   - 文件：`src/main/libs/openclawTranscript.test.ts`
   - 模拟 transcript 中包含：
     - 多轮 user
     - 多段 assistant
     - tool_use
     - tool_result
   - 断言重建后的消息顺序保持为：
     - `user -> assistant -> tool_use -> tool_result -> assistant -> user -> assistant`
   - 断言工具名、工具输入和工具结果 ID 保留。

本轮覆盖的体验风险：

1. 用户主动停止任务后，迟到的 gateway 事件又把错误或超时提示插回对话窗口。
2. stop 后 active turn 被迟到事件重新创建，导致 UI 又显示运行中或错误。
3. 从 transcript 恢复历史时，多段 assistant 和工具记录丢失或乱序，导致历史对话展示不完整。

本轮刻意未改：

1. 不改 `stopSession()` 的运行时行为。
2. 不改 transcript parser 主逻辑。
3. 不改 `chat.history` reconcile 策略。
4. 不引入 OpenClaw 主干重构、IM UI 大迁移或 Codex OAuth。

验证结果：

1. `npm test -- --run src/main/libs/openclawTranscript.test.ts src/main/libs/agentEngine/openclawRuntimeAdapter.test.ts` 通过，`2` 个测试文件、`50` 个用例。

本轮工程原则说明：

1. `KISS`：只补停止/迟到事件和 transcript 顺序测试。
2. `YAGNI`：不新增停止状态机或 transcript 中间层。
3. `SOLID`：停止事件仍由 runtime adapter 负责，transcript 重建仍由 transcript parser 负责。
4. `DRY`：复用现有 fake store、transcript JSONL 和 helper。

后续规划：

1. runtime adapter / transcript 小批次阶段收口。
2. 下一阶段建议回到 `session patch / thinkingLevel` 剩余验证：
   - `thinkingLevel` 与 `reasoningLevel` 透传
   - 非 model patch 不走 model normalization
   - 多实例 IM session key patch 继续覆盖
3. 然后进入 IM/POPO 公共核心或定时任务剩余公共行为。
4. 继续暂缓 Codex OAuth token refresher、per-agent `modelSlice`、POPO/IM UI 大迁移和 OpenClaw 主干大重构。

## 2026-05-11：OpenClaw chat error 直接事件链路测试补强

本轮继续 `openclawRuntimeAdapter.ts` 错误收尾链路复核，补齐 `chat state=error` 的直接事件路径。上一轮已经锁住 lifecycle error fallback，本轮锁住 gateway 正常发出 chat error 时的主路径，二者共同覆盖 OpenClaw run 失败后的收尾闭环。

本轮已完成的测试补强：

1. `chat state=error` 会持久化 system error
   - 文件：`src/main/libs/agentEngine/openclawRuntimeAdapter.test.ts`
   - 通过 `handleGatewayEvent({ event: 'chat', state: 'error' })` 走真实事件入口。
   - 断言 session 状态进入 `error`。
   - 断言本地新增 `system` 消息，metadata 中带 `error`。
2. `chat state=error` 会通知 UI 并结束 pending turn
   - 断言发出 `message` 事件。
   - 断言发出 `error` 事件。
   - 断言 `activeTurns` 被清理。
   - 断言 `pendingTurns` 被 reject 并清理。
3. 400 图片能力错误保留用户可理解提示
   - 错误为 `400 Bad Request: image input unsupported` 时，继续追加 “模型可能不支持图片输入” 的 hint。
   - 这能避免用户只看到 provider 原始 400，不知道应该换视觉模型或避免图片输入。

本轮覆盖的体验风险：

1. Gateway 已明确返回 error，但 UI 没有收到最终错误状态，导致对话一直像在运行。
2. 错误没有落 SQLite，切换 session 后无法看到失败原因。
3. pending turn 未 reject，调用方继续等待，表现为“没有回答”。

本轮刻意未改：

1. 不改 provider 错误分类策略，只锁住现有 400 hint。
2. 不改 lifecycle fallback 延迟。
3. 不改 gateway reconnect 或 OpenClaw 主干。

验证结果：

1. `npm test -- --run src/main/libs/agentEngine/openclawRuntimeAdapter.test.ts` 通过，`1` 个测试文件、`41` 个用例。

本轮工程原则说明：

1. `KISS`：只从真实 `handleGatewayEvent` 入口补一条错误主路径测试。
2. `YAGNI`：不新增错误码映射表或 UI 错误层。
3. `SOLID`：chat error 的状态、消息、事件和 pending turn 收尾仍由 runtime adapter 负责。
4. `DRY`：复用现有 fake store、active turn 和 gateway client mock。

后续规划：

1. 补 manual stop 后迟到 `aborted/error` 事件边界：
   - stop 后 late aborted 不应追加 timeout hint。
   - stop 后 late error 不应重新打开 turn 或打断当前 session。
2. 转入 `openclawTranscript.ts`：
   - transcript 优先恢复 managed session。
   - `.jsonl.deleted.*` fallback。
   - 原始 transcript 多 assistant/tool 记录不被短 history 覆盖。
3. 之后再回到 session patch / `thinkingLevel` 剩余验证。

## 2026-05-11：OpenClaw lifecycle error fallback 释放 run 测试补强

本轮继续 `openclawRuntimeAdapter.ts` 错误收尾链路复核，重点锁住 lifecycle error fallback 对 gateway run 的释放行为。这个点直接关系到“本轮失败后，下一轮对话是否还能继续发送”。

本轮已完成的测试补强：

1. lifecycle error fallback 会主动 abort gateway run
   - 文件：`src/main/libs/agentEngine/openclawRuntimeAdapter.test.ts`
   - 模拟 active turn 收到 `phase=error`，且 gateway 没有及时发出 `chat state=error`。
   - 推进 fallback 延迟后，断言调用：
     - `chat.abort`
     - `sessionKey` 为当前 turn 的 session key
     - `runId` 为当前 turn 的 run id
2. lifecycle error fallback 会完整收尾本地状态
   - session 状态更新为 `error`
   - 本地持久化 `system` 错误消息
   - 发出 `message` 事件
   - 发出 `error` 事件
   - 清理 `activeTurns`
   - 清理并 reject `pendingTurns`

本轮覆盖的体验风险：

1. OpenClaw / provider 侧错误后 gateway run 仍在后台重试。
2. 后续用户继续发送消息时，gateway 可能因为旧 run 未释放而拒绝新 `chat.send`。
3. UI 表面看起来像“对话卡住 / 没有回答 / AI 引擎又在重启”。

本轮刻意未改：

1. 不改 error fallback 延迟时间。
2. 不改 provider 错误文案映射。
3. 不改 gateway reconnect 主流程。
4. 不引入 Codex OAuth 或 OpenClaw 主干重构。

验证结果：

1. `npm test -- --run src/main/libs/agentEngine/openclawRuntimeAdapter.test.ts` 通过，`1` 个测试文件、`40` 个用例。

本轮工程原则说明：

1. `KISS`：只用一条测试锁住已有 fallback 行为。
2. `YAGNI`：不增加新的错误调度器或重试状态机。
3. `SOLID`：错误 fallback 仍在 runtime adapter 的 turn lifecycle 内闭环。
4. `DRY`：复用现有 fake store、active turn 与 gateway client mock。

后续规划：

1. 继续补 `chat error` 直接事件链路测试：
   - 持久化 system error
   - emit `message/error`
   - reject pending turn
   - cleanup active turn
2. 继续补 manual stop 后迟到 `aborted/error` 事件边界。
3. 然后转入 `openclawTranscript.ts`：
   - transcript 优先恢复
   - `.jsonl.deleted.*` fallback
   - 多 assistant/tool 记录不被短 history 覆盖

## 2026-05-11：OpenClaw final 空文本历史托底测试补强

本轮从 gateway lifecycle 转入 `openclawRuntimeAdapter.ts / openclawTranscript.ts`。先复核了 `origin/main` 与当前分支在 stream 收尾、session patch、transcript/history reconcile 上的差异：当前分支已经包含 lifecycle end/error fallback、`chat.abort` 释放重试中的 run、managed session 跳过短历史覆盖、transcript 优先恢复等多项当前问题导向的补强。因此本轮不做大块代码迁移，先锁住最容易导致“问了但没有回答”的低风险边界。

本轮已完成的测试补强：

1. `chat.final` 空文本时从 `chat.history` 托底创建 assistant 消息
   - 文件：`src/main/libs/agentEngine/openclawRuntimeAdapter.test.ts`
   - 模拟当前 turn 没有 `assistantMessageId`，但 `chat.history` 已经返回真实 assistant 文本。
   - 调用 `syncFinalAssistantWithHistory(...)` 后断言：
     - 本地 session 新增 `assistant` 消息。
     - 消息 metadata 标记为 `{ isStreaming: false, isFinal: true }`。
     - `turn.assistantMessageId` 指向新消息。
     - `turn.currentText` 更新为真实回答文本。
     - renderer 侧会收到 `message` 事件。

本轮覆盖的体验风险：

1. OpenClaw gateway 偶发只发空 `chat.final`，但真实回答已写入 history。
2. UI 如果只看 final payload，会表现为“用户发了消息但没有回答”。
3. 该测试保证当前分支会通过 history 托底把 assistant 回答补回本地 store，并通知 renderer 局部刷新。

本轮刻意未合入的差异：

1. 不整块迁移 `origin/main` 的内部 system prompt 包装逻辑。
2. 不改 session reconcile 主策略，避免再次触发 managed session 被短历史覆盖。
3. 不引入 Codex OAuth / token refresher。
4. 不启动 per-agent `modelSlice` 或 OpenClaw 主干重构。

验证结果：

1. `npm test -- --run src/main/libs/agentEngine/openclawRuntimeAdapter.test.ts` 通过，`1` 个测试文件、`39` 个用例。

本轮工程原则说明：

1. `KISS`：只补一条直接对应“无回答”的回归测试。
2. `YAGNI`：不为单个收尾缺口重写 runtime adapter 主流程。
3. `SOLID`：最终文本托底仍由 `syncFinalAssistantWithHistory()` 负责。
4. `DRY`：复用现有 reconcile test store 和 gateway client mock，不新增第二套测试夹具。

后续规划：

1. 继续补 `openclawRuntimeAdapter.ts` 低风险测试：
   - lifecycle error fallback 应调用 `chat.abort` 释放 gateway run。
   - chat error 后应持久化 system error 消息并 reject pending turn。
   - manual stop 后 late aborted/error 事件不应重新打开 turn。
2. 继续复核 `openclawTranscript.ts`：
   - transcript 优先恢复 managed session。
   - `.jsonl.deleted.*` fallback。
   - 原始 transcript 多 assistant/tool 记录不应被短 history 覆盖。
3. 完成 adapter/transcript 小批次后，再进入 IM/POPO 公共核心或 session patch/thinkingLevel 剩余验证。

## 2026-05-11：OpenClaw gateway restart scheduler 测试收口

本轮完成 `openclawEngineManager.ts` gateway lifecycle 的最后一组低风险测试补强，重点锁住自动重启调度器的边界。至此，网关生命周期小批次可以阶段收口。

本轮已完成的测试补强：

1. 重复 crash 不应重复安排 restart timer
   - 文件：`src/main/libs/openclawEngineManager.test.ts`
   - 连续调用 `scheduleGatewayRestart()` 两次。
   - 推进首个延迟 `3000ms` 后，断言只调用一次 `startGateway('auto-restart-after-crash')`。
   - 用于避免多个异常事件叠加后重复进入“AI 引擎正在重启”。
2. 达到自动重启上限后不再安排新 restart
   - 文件：`src/main/libs/openclawEngineManager.test.ts`
   - 将 `gatewayRestartAttempt` 设置为 `5` 后调用 `scheduleGatewayRestart()`。
   - 断言不调用 `startGateway()`。
   - 断言状态进入可重试 `error`，提示 `OpenClaw gateway failed to start after 5 attempts. Check model configuration or restart manually.`。
3. gateway log tail 缺失边界
   - 该边界已由前一轮 unexpected-exit 测试间接覆盖：测试环境没有写入 gateway 日志，`exit(1)` 仍能正常设置 error 并安排 restart。

本轮阶段结论：

1. `openclawEngineManager.ts` 当前分支已覆盖以下 gateway lifecycle 关键边界：
   - expected exit 不误重启
   - unexpected exit 会进入 error 并安排 restart
   - shutdownRequested 不触发 restart
   - 重复 crash 不重复安排 timer
   - 达到重试上限后停止自动重启
   - stale plugin 清理覆盖 package、本地扩展和旧飞书插件目录
2. 这些补强都不触碰青数品牌、工作台、内置治理链、唤醒/TTS、IM 大迁移或 Codex OAuth。
3. 本区域后续如果再动真实 gateway 主干，必须先跑这组测试，避免重新引入频繁重启体验问题。

验证结果：

1. `npm test -- --run src/main/libs/openclawEngineManager.test.ts` 通过，`1` 个测试文件、`6` 个用例。

本轮工程原则说明：

1. `KISS`：用小测试固定重启边界，不重构 scheduler。
2. `YAGNI`：不新增更复杂的状态机或队列。
3. `SOLID`：restart scheduler 仍只负责网关重启调度。
4. `DRY`：继续复用 fake process / fake timers 测试工具。

后续规划：

1. Gateway lifecycle 小批次阶段收口，下一阶段转入 `openclawRuntimeAdapter.ts / openclawTranscript.ts`。
2. 优先处理：
   - 对话无响应时的错误/完成事件链路
   - session patch、`modelOverride`、`thinkingLevel` 透传
   - transcript 恢复与 `chat.history` reconcile 的数据覆盖边界
3. 继续暂缓：
   - Codex OAuth token refresher
   - per-agent `modelSlice`
   - POPO/IM UI 大迁移
   - OpenClaw 主干大重构

## 2026-05-11：OpenClaw unexpected-exit 与 shutdown 边界测试补强

本轮继续收 `openclawEngineManager.ts` 的 gateway lifecycle 测试边界，重点验证“该重启才重启，不该重启绝不重启”。本轮仍然不改真实 gateway 主干，只用 fake process 和 fake timers 固化当前行为。

本轮已完成的测试补强：

1. 非预期退出应进入 error 并安排自动重启
   - 文件：`src/main/libs/openclawEngineManager.test.ts`
   - 模拟 gateway process 直接触发 `exit(1)`。
   - 断言状态进入 `error`，错误文案为 `OpenClaw gateway exited unexpectedly (code=1).`。
   - 用 fake timers 推进首个重启延迟 `3000ms` 后，断言调用 `startGateway('auto-restart-after-crash')`。
2. 用户主动 shutdown 后退出不应自动重启
   - 文件：`src/main/libs/openclawEngineManager.test.ts`
   - 模拟 `shutdownRequested=true` 后 gateway 触发 `exit(0)`。
   - 断言不发出 error 状态，也不调用 `startGateway()`。

本轮覆盖的体验风险：

1. 避免 gateway 真崩溃时静默失败，导致对话没有响应。
2. 避免用户主动停止、手动重启或退出应用时被误判为崩溃，从而触发“AI 引擎正在重启”的重复提示。
3. 避免后续合 main 或重构 OpenClaw lifecycle 时破坏当前分支已有的重启边界。

验证结果：

1. `npm test -- --run src/main/libs/openclawEngineManager.test.ts` 通过，`1` 个测试文件、`4` 个用例。

本轮工程原则说明：

1. `KISS`：不改运行时代码，只补最小测试证明当前行为。
2. `YAGNI`：不新增更复杂的 restart scheduler 抽象。
3. `SOLID`：退出分类、状态更新、重启安排仍保持在 gateway lifecycle 内。
4. `DRY`：继续复用 fake gateway process helper 和测试脚手架。

后续规划：

1. 补最后一组 `openclawEngineManager.ts` 低风险测试：
   - gateway log tail 缺失时，unexpected exit 仍应设置 error 并安排 restart
   - 重复异常退出不应在已有 timer 时重复安排重启
   - restart attempt 达上限时应停止继续安排
2. 如果这些测试都通过，gateway lifecycle 小批次可以阶段收口。
3. 下一阶段转入 `openclawRuntimeAdapter.ts / openclawTranscript.ts`：
   - 对话无响应
   - session patch / thinkingLevel 透传
   - transcript 恢复与 history reconcile

## 2026-05-11：OpenClaw expected-exit 防误重启测试补强

本轮继续上一节 `openclawEngineManager.ts` 网关生命周期复核，重点检查 expected exit、自动重启边界和日志可观测性。对比 `origin/main` 后确认：当前分支在 expected-exit 处理上已经更稳，不需要回退或重写运行时代码，但需要补测试把这个边界锁住。

本轮复核结论：

1. 当前分支 `attachGatewayExitHandlers()` 在收到 gateway `error` 事件时，不会删除 `expectedGatewayExits` 中的 child。
2. `expectedGatewayExits` 只在后续 `exit` 事件中消费并删除。
3. 这样可以避免 `stopGatewayProcess()` 或手动重启期间，gateway 先触发 `error` 再触发 `exit` 时被误判成异常退出。
4. 误判异常退出会进入 `scheduleGatewayRestart()`，对应用户之前遇到的“只是对话/停止/重启流程中却频繁进入 AI 引擎重启”的体验风险。

本轮已完成的测试补强：

1. 新增 expected-exit 回归测试
   - 文件：`src/main/libs/openclawEngineManager.test.ts`
   - 通过 fake gateway process 模拟 `stopGatewayProcess()` 期间先收到 `error`、再收到 `exit`。
   - 断言不会发出 error 状态，也不会把预期退出当成异常退出。
2. 保留上一轮 stale plugin 清理测试
   - 同一测试文件中继续覆盖 package、本地扩展和旧飞书插件目录 ID 汇总。

本轮刻意未改：

1. 不改 gateway 自动重启延迟和最大重试次数。
2. 不改 `scheduleGatewayRestart()` 的真实启动行为，避免影响运行中的任务恢复策略。
3. 不引入 `origin/main` 的 Codex OAuth / `CODEX_HOME` 改动，该部分仍属于认证批次。

验证结果：

1. `npm test -- --run src/main/libs/openclawEngineManager.test.ts src/main/libs/openclawLocalExtensions.test.ts src/main/libs/openclawConfigGuards.test.ts` 通过，`3` 个测试文件、`8` 个用例。

本轮工程原则说明：

1. `KISS`：当前代码已满足目标，只补一条针对性回归测试。
2. `YAGNI`：不为了追平 diff 去改 gateway lifecycle 主逻辑。
3. `SOLID`：expected-exit 判断仍集中在 gateway process lifecycle handler 内。
4. `DRY`：复用同一个 fake gateway process helper，不为不同事件顺序复制测试脚手架。

后续规划：

1. 继续补 `openclawEngineManager.ts` 的低风险测试：
   - unexpected exit 应设置 error 并安排 restart
   - shutdownRequested 时 exit 不应触发 restart
   - gateway log tail 缺失时不应影响状态更新
2. 继续只做测试或极小补丁，不改真实 gateway 主干。
3. 完成 gateway lifecycle 测试补强后，转入 `openclawRuntimeAdapter.ts / openclawTranscript.ts`，处理对话无响应、session patch 和 transcript 恢复。

## 2026-05-11：OpenClaw gateway stale plugin 清理补齐

本轮继续上一节规划，进入 `openclawEngineManager.ts` 的网关生命周期低风险差异复核。目标是只吸收不牵动认证、UI、IM 大迁移和青数覆盖层的小型启动稳定性补丁。

本轮发现的真实差异：

1. `origin/main` 的网关启动前 stale plugin 清理会把本地扩展目录和旧插件改名遗留目录一起纳入清理集合。
2. 当前分支此前只读取 `package.json.openclaw.plugins` 中声明的第三方插件 ID。
3. 如果开发态或升级后存在本地扩展目录，或者旧版 `feishu-openclaw-plugin` 目录残留在 gateway 扫描目录中，当前分支可能不会清理这些 stale 目录。
4. stale 目录会增加 OpenClaw 启动时的插件扫描成本，也可能把旧 schema / 旧工具入口重新暴露给 gateway。

本轮已完成的代码改动：

1. 扩展 stale plugin 清理 ID 集合
   - 文件：`src/main/libs/openclawEngineManager.ts`
   - `getConfiguredThirdPartyPluginIds()` 现在合并三类 ID：
     - `package.json.openclaw.plugins` 中声明的插件
     - `listLocalOpenClawExtensionIds()` 返回的本地开发扩展目录
     - 旧版改名遗留目录 `feishu-openclaw-plugin`
   - 返回结果使用 `Set` 去重，避免重复清理同一插件。
2. 补充网关管理器单元测试
   - 文件：`src/main/libs/openclawEngineManager.test.ts`
   - 通过 mock Electron 与本地扩展函数，只验证插件清理 ID 汇总逻辑。
   - 测试不启动真实 gateway，不依赖本机 OpenClaw runtime。

本轮刻意未改：

1. 不加入 `CODEX_HOME: getCodexHomeDir()`
   - 该项属于 OpenAI Codex OAuth / token refresher 认证链路，仍放入后续独立批次。
2. 不调整 gateway spawn / utilityProcess 主逻辑
   - 当前分支已经包含 Windows spawn、V8 compile cache、system proxy、TZ 注入和启动失败 `await stopGatewayProcess(child)` 等稳定性补丁。
3. 不改 IM channel routing 或 Feishu 新旧插件配置
   - 本轮只清理 stale 扫描目录，不改业务通道行为。

验证结果：

1. `npm test -- --run src/main/libs/openclawEngineManager.test.ts src/main/libs/openclawLocalExtensions.test.ts src/main/libs/openclawConfigGuards.test.ts src/main/libs/openclawRuntimePackaging.test.ts src/main/libs/pruneOpenClawRuntime.test.ts` 通过，`5` 个测试文件、`14` 个用例。

本轮工程原则说明：

1. `KISS`：只补清理名单，不重写 gateway lifecycle。
2. `YAGNI`：暂不把 Codex OAuth、OpenClaw 主干重构和 IM 大迁移混进本批。
3. `SOLID`：插件 ID 汇总仍在 `OpenClawEngineManager` 的启动准备阶段，目录识别仍由 `openclawLocalExtensions` 负责。
4. `DRY`：复用 `listLocalOpenClawExtensionIds()`，不新增第二套本地扩展扫描逻辑。

后续规划：

1. 继续复核 `openclawEngineManager.ts` 剩余差异：
   - expected exit 与自动重启边界
   - gateway log tail / restart context 可观测性
   - system proxy env 注入的测试覆盖
2. 进入 `openclawRuntimeAdapter.ts` / `openclawTranscript.ts`：
   - 对话无响应
   - session patch 透传
   - transcript 恢复与 history reconcile
3. 继续暂缓：
   - OpenAI Codex OAuth token refresher
   - per-agent `modelSlice`
   - POPO/IM UI 大迁移
   - OpenClaw 主干大重构

## 2026-05-11：OpenClaw runtime/config 低风险复核补充

本轮按上一节规划继续筛 `OpenClaw runtime patch / 构建打包稳定性`。复核重点不是把 `origin/main` 的 OpenClaw 主干整包覆盖进当前分支，而是确认哪些公共能力已经等价或更强、哪些差异暂时不适合贴回，避免影响青数品牌层、工作台、内置治理链和唤醒/TTS。

本轮验证到的当前分支能力：

1. OpenClaw 配置守卫仍需保留
   - 文件：`src/main/libs/openclawConfigGuards.ts`
   - 当前分支保留 `enforceLegacyFeishuPluginDisabled()`，并在 `openclawConfigSync.ts` 写入配置前执行。
   - 该 guard 用于持续保证旧版 `plugins.entries.feishu.enabled=false`，避免旧飞书插件 schema 或工具失败诱导模型修改配置、触发网关重启。
   - `origin/main` 当前不含这个 guard，但它是当前分支真实运行问题的修复，不应删除。
2. OpenClaw config sync 已包含当前 runtime 的兼容边界
   - 文件：`src/main/libs/openclawConfigSync.ts`
   - 当前分支明确避免写入当前打包 OpenClaw schema 不支持的 `agents.defaults.cwd`。
   - `memorySearch` 只在 embedding 开启时写入，避免默认关闭场景误影响工具集合。
   - 多实例 IM、`mcp-bridge`、`ask-user-question`、`qwen-portal-auth`、server models 代理和系统代理配置均已有测试覆盖。
3. OpenClaw 历史与日志处理当前分支更贴近已暴露问题
   - 文件：`src/main/libs/openclawHistory.ts`
   - 当前分支会剥离 managed-agent 包装模板、过滤 heartbeat、过滤“网关正在重启中”这类 transient assistant 状态，并把定时提醒 prompt 转成 system message。
   - 文件：`src/main/libs/mcpLog.ts`
   - 当前分支继续复用 `sanitizeForLog`，保留工具日志脱敏和长文本截断能力。
4. OpenClaw local extensions / runtime packaging 不回退
   - 文件：`src/main/libs/openclawLocalExtensions.ts`
   - 当前分支保留本地扩展 manifest 的 `directoryId` 与 `pluginId` 区分，以及 stale package 清理能力。
   - 文件：`scripts/openclaw-runtime-packaging.cjs`
   - 文件：`scripts/prune-openclaw-runtime.cjs`
   - 当前分支保留 runtime 打包与裁剪测试，避免后续打包时把必要插件、native 依赖或 gateway client entry 裁掉。

本轮刻意未合入的 `origin/main` 差异：

1. 暂不合入 OpenAI Codex OAuth / per-provider token refresher
   - 这会牵动认证路径、OpenAI provider 配置和 token 代理行为，后续应作为独立认证批次处理。
2. 暂不恢复 `agents.defaults.cwd`
   - 当前打包 runtime schema 曾明确拒绝该字段，恢复会直接增加网关启动失败风险。
3. 暂不把 Email / POPO / IM 大迁移混入本批
   - 这些属于高耦合 IM 主干迁移，需要和多实例 UI、主进程存储、channel routing 一起处理。
4. 暂不做 OpenClaw 主干大重构
   - 当前目标是公共能力小步拉齐，不为“diff 变小”牺牲运行时稳定性。

验证结果：

1. `npm test -- --run src/main/libs/mcpLog.test.ts src/main/libs/openclawHistory.test.ts src/main/libs/openclawLocalExtensions.test.ts src/main/libs/openclawConfigSync.test.ts src/main/libs/openclawConfigSync.runtime.test.ts src/main/libs/openclawConfigGuards.test.ts` 通过，`6` 个测试文件、`75` 个用例。

本轮工程原则说明：

1. `KISS`：只做事实复核和文档化，不对已经稳定的 runtime 主干做额外扰动。
2. `YAGNI`：暂不引入 Codex OAuth、Email channel、OpenClaw 主干重构等尚未进入当前验收边界的高耦合能力。
3. `SOLID`：继续让 config guard、config sync、history normalization、local extension sync、runtime packaging 各自承担单一职责。
4. `DRY`：保留现有 guard/helper/test 作为单一入口，不新增重复的配置修补逻辑。

后续规划：

1. 下一批优先进入 `openclawEngineManager.ts` 的网关生命周期差异复核。
2. 只收低风险能力，例如启动/重启可观测性、expected exit 处理、proxy env 注入验证、gateway client entry 探测测试。
3. 暂缓高耦合能力，例如 Codex OAuth token refresher、OpenClaw 主干重构、Email/POPO/IM 大迁移、per-agent `modelSlice`。
4. 每贴一个小批次继续补测试，并同步更新本 changelog。

## 2026-05-11：configService provider 协议迁移收口

本轮继续上一节 `Provider / 模型配置` 收尾，重点复核 `configService`。上一轮已经把 renderer 请求时的协议选择改为 `ProviderRegistry` 驱动，但本轮发现配置初始化阶段还保留一份旧的固定协议 provider 硬编码名单，只覆盖 `openai / stepfun / youdaozhiyun / anthropic / gemini`。这会导致历史配置中如果把 `Qianfan / GitHub Copilot / Moonshot` 存成错误协议，启动时不一定被纠正。

本轮已完成的代码改动：

1. 配置初始化协议归一化复用 `ProviderRegistry`
   - 文件：`src/renderer/services/config.ts`
   - `getFixedProviderApiFormat(...)` 改为读取 provider definition
   - 当 provider 没有 `switchableBaseUrls` 时，使用 `defaultApiFormat`
   - `Qianfan / GitHub Copilot / StepFun / Youdao / OpenAI / Anthropic / Gemini` 等固定协议 provider 会自动跟随 registry
2. 保留 Moonshot 显式兼容例外
   - 与 renderer 请求层保持一致
   - 即使 registry 中保留 Moonshot 可切换 URL 元数据，配置初始化仍会把常规 chat flow 修正为 OpenAI 协议
3. 补充配置迁移测试
   - 文件：`src/renderer/services/config.test.ts`
   - 覆盖历史配置中 `Qianfan / GitHub Copilot / Moonshot` 被错误保存为 `anthropic` 时，初始化后会归一化为 `openai`

本轮刻意未改：

1. 不覆盖 `configService` 中青数语音、唤醒、TTS、voice post-process 的合并逻辑
2. 不引入 OpenAI Codex OAuth token refresher
3. 不启动 per-agent `modelSlice` 迁移

验证结果：

1. `npm test -- --run src/renderer/services/config.test.ts src/renderer/services/providerRequestConfig.test.ts src/shared/providers/constants.test.ts` 通过，`3` 个测试文件、`38` 个用例

本轮工程原则说明：

1. `KISS`：只统一配置初始化的一处协议判断，不重写 config service
2. `YAGNI`：不顺手迁认证、不顺手迁模型状态结构
3. `SOLID`：provider 协议真源继续收敛到 `ProviderRegistry`
4. `DRY`：请求层和配置层不再各自维护一份固定协议 provider 列表

后续规划：

1. 下一步完成本轮 TypeScript 与 diff 验收
2. 之后转入 `OpenClaw runtime patch / 构建打包稳定性`
   - 优先核对 `openclawConfigGuards / runtime packaging / pruneOpenClawRuntime / gateway lifecycle`
   - 只接可测试、低耦合的公共能力
3. 继续暂缓：
   - OpenClaw 主干整包重构
   - POPO/IM 大 UI 迁移
   - per-agent `modelSlice`
   - SQLite / `better-sqlite3` 存储迁移

## 2026-05-11：Provider 协议选择复用 Registry 元数据

本轮按上一节规划回到 `Provider / 模型配置` 的低风险差异筛选。复核后确认：当前分支已经包含 `ProviderRegistry`、LM Studio 图标与 provider id、Copilot headers、OpenAI responses URL、模型图像能力修正、coding plan URL 等多项公共能力，不适合为了“拉齐 main”反向覆盖。剩余可以安全收的小缺口是 renderer 请求配置里仍维护了一份固定协议 provider 硬编码名单。

本轮已完成的代码改动：

1. 固定协议判断复用 `ProviderRegistry`
   - 文件：`src/renderer/services/providerRequestConfig.ts`
   - `getFixedApiFormatForProvider(...)` 改为优先读取 provider definition
   - 当 provider 没有 `switchableBaseUrls` 时，直接使用 `defaultApiFormat`
   - 这样 `OpenAI / Anthropic / Gemini / Qianfan / StepFun / Youdao / Copilot` 等固定协议 provider 不再需要在 renderer 维护重复名单
2. 保留 Moonshot 显式兼容例外
   - `Moonshot` 在 registry 中保留可切换 URL 元数据
   - 但 renderer chat flow 仍强制 OpenAI 协议，因为常规 Anthropic endpoint 兼容不完整
   - 本轮保留这个例外，避免为了 DRY 破坏现有对话请求稳定性
3. 补充回归测试
   - 文件：`src/renderer/services/providerRequestConfig.test.ts`
   - 覆盖 `Qianfan / StepFun / Youdao` 自动按 registry 固定为 OpenAI
   - 覆盖 `Ollama / LM Studio` 仍显示协议切换入口

验证结果：

1. `npm test -- --run src/renderer/services/providerRequestConfig.test.ts src/renderer/services/apiRequestHeaders.test.ts src/renderer/services/config.test.ts src/shared/providers/constants.test.ts` 通过，`4` 个测试文件、`40` 个用例

本轮工程原则说明：

1. `KISS`：只替换一处判断来源，不改 Settings UI、不改请求发送流程
2. `YAGNI`：不接 OpenAI Codex OAuth token refresher，不启动 per-agent modelSlice 大迁移
3. `SOLID`：provider 元数据继续由 `ProviderRegistry` 作为单一真源，renderer 只消费定义
4. `DRY`：删除 renderer 中重复维护的固定协议 provider 列表，仅保留 Moonshot 这个有业务原因的例外

后续规划：

1. 下一步完成本轮类型检查和 diff 检查
2. 之后继续 `Provider / 模型配置` 的最后一轮低风险扫描
   - 重点看 `configService` 是否还有可测试的 provider migration 漏洞
   - 不覆盖青数的语音、唤醒、TTS 配置合并逻辑
3. 再之后转入 `OpenClaw runtime patch / 构建打包稳定性`
   - 优先配置兼容、runtime patch 字段透传、日志收敛
   - 继续暂缓 OpenClaw 主干重构、POPO/IM 大 UI 迁移、per-agent modelSlice

## 2026-05-11：定时任务 run update 后局部刷新状态

本轮继续收尾 `ScheduledTasks` 执行反馈链路。复核后确认：

1. `stopTask` 暂不适合继续做假状态
   - 文件：`src/main/ipcHandlers/scheduledTask/handlers.ts`
   - 当前 `ScheduledTaskIpc.Stop` 明确返回 `{ success: true, result: false }`
   - 注释说明 OpenClaw 目前不暴露直接停止 cron job 的 API，任务只能自然完成或超时
   - 因此本轮不在 UI/service 层伪造“已停止”，避免用户误以为任务真的被中断
2. `run update` 与 `status update` 存在到达顺序差
   - 文件：`src/scheduledTask/cronJobService.ts`
   - polling 中会分别发送 `StatusUpdate` 和 `RunUpdate`
   - renderer 收到 `RunUpdate` 后原本只更新运行历史，不会主动刷新任务状态
   - 如果执行记录先出现、最终状态稍后才到，按钮和 running badge 可能短暂停留在 running

本轮已完成的代码改动：

1. run update 后触发轻量局部刷新
   - 文件：`src/renderer/services/scheduledTask.ts`
   - `onRunUpdate` 写入运行记录后，复用 `scheduleTaskRefresh(event.run.taskId, [500, 1500])`
   - 只刷新当前任务，不全量刷新任务列表
   - 主要用于尽快拉回最终 `runningAtMs / lastStatus / lastRunAtMs`
2. 新增事件顺序回归测试
   - 文件：`src/renderer/services/scheduledTask.test.ts`
   - 覆盖收到 `RunUpdate` 后会调用 `scheduledTasks.get(taskId)`
   - 验证刷新结果会更新 store 中的任务状态

验证结果：

1. `npm test -- --run src/renderer/services/scheduledTask.test.ts src/renderer/store/slices/scheduledTaskSlice.test.ts src/renderer/components/scheduledTasks/utils.test.ts` 通过，`3` 个测试文件、`10` 个用例

本轮工程原则说明：

1. `KISS`：复用已有延迟刷新 helper，不引入前端任务状态机
2. `YAGNI`：不做 OpenClaw 尚不支持的停止能力，也不扩展 cron 协议
3. `SOLID`：运行历史仍由 `addOrUpdateRun` 维护，最终任务状态仍以主进程查询结果为准
4. `DRY`：手动执行成功后的刷新和 run update 后的刷新共用同一套局部刷新逻辑

后续规划：

1. 下一步继续跑完整类型检查和 diff 检查，确认本轮小补丁可验收
2. 之后回到 `Provider / 模型配置` 的低风险剩余项
   - 继续筛 provider metadata、图标、类型测试
   - 暂缓 OpenAI Codex OAuth token refresher 与 per-agent modelSlice
3. 再之后进入 `OpenClaw runtime patch / 构建打包稳定性`
   - 只挑可测试的 runtime patch、配置兼容、日志收敛
   - 继续避开 OpenClaw 主干大重构和 POPO/IM 大 UI 迁移

## 2026-05-11：定时任务手动执行防重复保护

本轮按上一节规划进入 `ScheduledTasks` 执行反馈测试保护。对比 `origin/main` 后确认：当前分支在手动执行体验上已经比 main 多出一层公共修复，包括执行前乐观设置 `runningAtMs`、失败后回滚原状态、以及成功后延迟刷新任务状态。剩余低风险缺口是 service 层缺少并发防重复：虽然 `TaskDetail / TaskList` 的按钮会根据 `task.state.runningAtMs` 禁用，但双击竞态或未来其他入口直接调用 `scheduledTaskService.runManually()` 时，仍可能发出重复 IPC。

本轮已完成的代码改动：

1. 手动执行请求 service 层去重
   - 文件：`src/renderer/services/scheduledTask.ts`
   - 新增 `runningManualTaskIds`
   - 同一任务已有手动执行请求在飞行中时，后续调用直接返回
   - 当前任务已经 `runningAtMs` 非空时，直接返回，不再触发 `runManually` IPC
2. 保留原有执行反馈行为
   - 执行发起后仍会乐观设置 `runningAtMs`
   - 执行失败仍会回滚到原 `TaskState`
   - 执行成功仍会按既有逻辑延迟刷新任务详情
3. 新增 service 层测试
   - 文件：`src/renderer/services/scheduledTask.test.ts`
   - 覆盖同一任务并发执行只调用一次 IPC
   - 覆盖任务已处于 running 时跳过执行
   - 覆盖手动执行失败后回滚乐观状态

验证结果：

1. `npm test -- --run src/renderer/services/scheduledTask.test.ts src/renderer/store/slices/scheduledTaskSlice.test.ts src/renderer/components/scheduledTasks/utils.test.ts` 通过，`3` 个测试文件、`9` 个用例
2. `npx tsc --project tsconfig.json --noEmit` 通过
3. `npx tsc --project electron-tsconfig.json --noEmit` 通过

本轮工程原则说明：

1. `KISS`：只在 service 层加一个任务 ID 集合，不改 UI、不引入队列
2. `YAGNI`：不做复杂执行状态机，先解决真实重复点击/重复入口问题
3. `SOLID`：防重复属于请求发起层责任，按钮只是展示层辅助保护
4. `DRY`：`TaskDetail`、`TaskList` 和未来快捷入口共用同一个 service 防线

后续规划：

1. 下一步继续 `ScheduledTasks` 执行反馈链路
   - 检查 `stopTask` 是否需要类似的 service 层防重复或状态回滚保护
   - 检查状态事件和 run 事件到达顺序是否会导致 running badge 闪烁或历史短暂不一致
2. 第二步回到 `Provider / 模型配置`
   - 只筛低风险 provider metadata / 图标 / 类型测试
   - 继续不碰 OpenAI Codex OAuth token refresher
3. 第三步继续 `IM / Agent` 边界文档化
   - 为后续 POPO/IM 大迁移记录 native path 多实例前置条件
4. 继续暂缓 `POPO/IM UI 整包迁移`、`OpenClaw 主干重构`、`per-agent modelSlice`

## 2026-05-11：Native IM session mapping 记录真实 Agent 归属

本轮按上一节规划检查 `IM session routing`。重点复核了两条链路：

1. OpenClaw channel session sync
   - 文件：`src/main/libs/openclawChannelSessionSync.ts`
   - 已经能从 OpenClaw sessionKey 提取 `accountId`
   - 已经通过 `resolveAgentBinding(platform, accountId)` 优先匹配实例级 `platform:instanceId`
   - 这条链路已有实例级绑定测试覆盖
2. Native / legacy IM cowork path
   - 文件：`src/main/im/imCoworkHandler.ts`
   - 当前 `IMMessage` 没有通用 `accountId/instanceId` 字段
   - `im_session_mappings` 主键仍是 `im_conversation_id + platform`
   - 因此本轮不强行把 native path 改成多实例 routing，避免把同平台不同账号会话错误混用

本轮发现的真实小缺口：

1. `createCoworkSessionForConversation(...)` 创建 native IM session 时，已经按 `platformAgentBindings[platform]` 算出了平台级 `agentId`
2. 但保存 mapping 时调用 `createSessionMapping(imConversationId, platform, session.id)` 没有传入 `agentId`
3. 结果是 mapping 表里的 `agent_id` 会回落到默认 `main`
4. 这会导致后续从 mapping 侧观察 IM session 归属时与真实 cowork session 归属不一致

本轮已完成的代码改动：

1. Native IM mapping 写入真实 Agent 归属
   - 文件：`src/main/im/imCoworkHandler.ts`
   - `createSessionMapping(...)` 调用补上传入已解析的 `agentId`
   - 不改变 session 创建、消息处理、OpenClaw channel sync 或多实例 UI
2. 补充回归测试
   - 文件：`src/main/im/imCoworkHandler.test.ts`
   - 新增用例确认 native IM session 的 mapping `agentId` 与 cowork session `agentId` 一致
   - 同时保留原有 payload-too-large 400 自动重建 session 测试

验证结果：

1. `npm test -- --run src/main/im/imCoworkHandler.test.ts src/main/libs/openclawChannelSessionSync.test.ts src/main/im/imScheduledTaskAgent.test.ts src/main/im/imStore.test.ts` 通过，`4` 个测试文件、`21` 个用例
2. `npx tsc --project tsconfig.json --noEmit` 通过
3. `npx tsc --project electron-tsconfig.json --noEmit` 通过

本轮工程原则说明：

1. `KISS`：只修 mapping 记录不一致，不扩大 native IM 协议
2. `YAGNI`：没有稳定实例字段前，不提前设计 native 多实例路由
3. `SOLID`：OpenClaw channel session sync 继续负责实例级路由，native handler 只保证自身 session/mapping 一致
4. `DRY`：不复制 `resolveAgentBinding` 到缺少 `accountId` 的 native path，避免制造伪实例匹配逻辑

后续规划：

1. 下一步进入 `ScheduledTasks` 执行反馈测试保护
   - 复核手动执行按钮、running 状态、失败回滚、run update 和全局历史联动
   - 优先补可测试的状态层行为，不改青数主操作台视觉
2. 第二步继续 `IM / Agent` 边界文档化
   - 在后续合 POPO/IM 大迁移前，明确 native path 需要先扩展 `IMMessage.accountId` 与 mapping 主键或兼容索引
3. 第三步再回到 `Provider / 模型配置`
   - 只筛低风险 provider metadata / 图标 / 类型测试，不碰 OpenAI Codex OAuth token refresher
4. 继续暂缓 `POPO/IM UI 整包迁移`、`OpenClaw 主干重构`、`per-agent modelSlice`

## 2026-05-11：定时任务编辑页标记不可用 IM 实例

本轮继续上一节的 `IM / Agent` 实例引用清理，切到定时任务编辑页。复核后确认：当前分支的 `TaskForm` 已经会把任务保存过的 `delivery.channel/accountId` 先塞回渠道选项，所以实例被禁用或从当前渠道列表消失后，编辑任务不会直接丢失旧投递配置。但旧逻辑没有区分“当前可用渠道”和“仅因历史保存而保留的渠道”，用户看到旧实例时容易误以为它仍然可用。

本轮已完成的代码改动：

1. 定时任务渠道选项合并抽成公共 helper
   - 文件：`src/renderer/components/scheduledTasks/utils.ts`
   - 新增 `scheduledTaskChannelOptionKey(...)`
   - 新增 `mergeScheduledTaskChannelOptions(...)`
   - 新增 `isSavedOnlyScheduledTaskChannelOption(...)`
   - 行为是以当前 `listChannels()` 返回的可用列表为基准，再追加保存过但当前不可见的旧选项
2. 定时任务编辑页显示不可用提示
   - 文件：`src/renderer/components/scheduledTasks/TaskForm.tsx`
   - 新增 `availableChannelOptions` 保存当前可用渠道列表
   - 渠道下拉中，保存过但当前不可用的实例会显示 `当前不可用`
   - 不禁用点击、不清空值，避免用户已有任务配置被静默破坏
3. i18n 与回归测试
   - 文件：`src/renderer/services/i18n.ts`
   - 新增中英文 `scheduledTasksChannelUnavailable`
   - 文件：`src/renderer/components/scheduledTasks/utils.test.ts`
   - 新增用例覆盖“可用实例 + 已保存旧实例”的合并顺序与 saved-only 标记

验证结果：

1. `npm test -- --run src/renderer/components/scheduledTasks/utils.test.ts src/renderer/store/slices/scheduledTaskSlice.test.ts src/scheduledTask/cronJobService.test.ts src/main/ipcHandlers/scheduledTask/helpers.test.ts` 通过，`4` 个测试文件、`26` 个用例
2. `npx tsc --project tsconfig.json --noEmit` 通过
3. `npx tsc --project electron-tsconfig.json --noEmit` 通过

本轮工程原则说明：

1. `KISS`：只补渠道选项状态标记，不重做定时任务表单和 IM 设置 UI
2. `YAGNI`：不自动迁移、删除或修复用户旧任务配置，只把风险显性化
3. `SOLID`：渠道选项合并与 saved-only 判断放到 scheduled task utils，UI 只负责展示
4. `DRY`：后续 `TaskDetail / RunSessionModal` 如需显示同类提示，可以复用同一套 key 与合并规则

后续规划：

1. 下一步检查 IM session routing
   - 重点看 legacy/native IM path 是否仍只按平台级 `platformAgentBindings[platform]` 选 Agent
   - 如果当前消息上下文没有可靠 `accountId/instanceId`，先记录限制，不强行补推断
2. 第二步继续 `ScheduledTasks` 执行反馈测试保护
   - 手动执行按钮防重复、运行中状态、失败回滚、run update 与全局历史联动继续补测试
3. 第三步回到 `Provider / 模型配置`
   - 仅筛不触碰认证 token refresher 的低风险类型/展示/配置 helper
4. 继续暂缓 `POPO/IM UI 整包迁移`、`OpenClaw 主干重构`、`per-agent modelSlice`、`OpenAI Codex OAuth`

## 2026-05-11：Agent IM 绑定过滤已禁用实例

本轮进入上一节规划的 `IM / Agent` 实例引用清理。复核后确认：删除多实例 IM 时，主进程 `IMStore` 和 renderer `imSlice` 已经会清理对应 `platform:instanceId` 的 Agent 绑定；定时任务频道列表也只展示 enabled 实例。剩余更隐蔽的风险在 Agent 编辑页：如果某个实例被禁用但绑定仍存在，旧逻辑会把这个不可见实例的绑定重新回填进当前 Agent 的 `boundBindingKeys`，保存时可能继续保留 stale binding。

本轮已完成的代码改动：

1. Agent IM 绑定回填支持按启用实例过滤
   - 文件：`src/renderer/components/agent/agentImBindingConfig.ts`
   - `collectAgentBoundBindingKeys(...)` 新增可选 `config` 参数
   - 当传入当前 IM 配置时，多实例平台只回填仍然 enabled 的 `platform:instanceId`
   - 平台级绑定、其他非多实例平台逻辑保持不变
2. Agent 编辑页接入过滤
   - 文件：`src/renderer/components/agent/AgentSettingsPanel.tsx`
   - 加载 IM 配置后，把 `cfg` 传入 `collectAgentBoundBindingKeys`
   - 这样编辑 Agent 后再保存，不会把已禁用实例的旧绑定继续写回
3. 回归测试
   - 文件：`src/renderer/components/agent/agentImBindingConfig.test.ts`
   - 新增用例确认 disabled Feishu 实例不会被回填，enabled 实例仍正常回填

本轮工程原则说明：

1. `KISS`：只在现有 helper 增加可选过滤能力，不改 Agent 弹窗 UI 结构
2. `YAGNI`：不提前迁移 POPO/Telegram/Discord/NIM 多实例大 UI
3. `SOLID`：绑定 key 的规范化、回填和保存仍集中在 `agentImBindingConfig.ts`
4. `DRY`：编辑页不再自己判断实例启用状态，复用统一 helper

后续规划：

1. 下一步继续 `IM / Agent` 实例引用清理
   - 检查禁用实例后定时任务编辑页是否能清晰展示旧 `delivery.accountId`
   - 只做保留展示/提示，不直接删除用户已有任务配置
2. 第二步检查 IM session routing
   - 确认多实例 IM 会话创建、session mapping 和 Agent 绑定选择使用同一套 instance/account 语义
3. 第三步再切回 `ScheduledTasks` 执行反馈测试保护
   - 防重复点击、失败回滚、run update 和全局历史联动继续补测试
4. `OpenClaw runtime / transcript / gateway lifecycle` 仍保持后续独立小批次

## 2026-05-11：全局运行记录分页去重

本轮继续推进 `ScheduledTasks / Run history`。先复核了执行按钮、running 状态和运行记录链路：当前分支已经有手动执行的乐观 running 状态、失败回滚和延迟刷新；任务详情内的单任务运行记录 `appendRuns` 也已经做了去重。剩余最安全的小缺口在全局运行记录分页：实时 run update 和分页加载交错时，`appendAllRuns` 直接拼接可能导致同一条 run 重复出现。

本轮已完成的代码改动：

1. 全局运行记录分页追加去重
   - 文件：`src/renderer/store/slices/scheduledTaskSlice.ts`
   - `appendAllRuns` 改为按 `run.id` 过滤已存在记录
   - 保留现有顺序：已存在的 run 不被分页旧数据覆盖，新 run 继续追加到尾部
2. 补充回归测试
   - 文件：`src/renderer/store/slices/scheduledTaskSlice.test.ts`
   - 新增用例覆盖“实时推送已插入 run，分页加载包含同一 run 时不会重复”

本轮工程原则说明：

1. `KISS`：只在 slice 层补去重，不改运行记录 UI、不改 IPC 和 OpenClaw cron 协议
2. `YAGNI`：不提前引入复杂分页游标或 loading 状态重构
3. `SOLID`：运行记录集合一致性继续由 Redux slice 负责，service 和 UI 不需要重复判断
4. `DRY`：与 `appendRuns` 的单任务历史去重语义保持一致，减少两套历史列表的行为分叉

后续规划：

1. 下一步进入 `IM / Agent` 实例引用清理
   - 检查实例删除/禁用后，Agent 绑定和定时任务 delivery 是否会残留旧 `accountId`
   - 优先补 store/slice/helper 层测试，不做 UI 大迁移
2. 第二步回到 `ScheduledTasks` 执行反馈
   - 若还有安全补丁，继续补“手动执行按钮防重复点击、错误 toast、局部刷新”的测试保护
3. 第三步拆 `OpenClaw runtime / transcript / gateway lifecycle`
   - 优先 runtime patch、transcript reconcile、gateway restart defer 这类可测试公共能力
4. `NIM QR Login`、`sqliteBackup`、`OpenAI Codex OAuth`、`POPO/IM UI 大迁移` 继续独立批次处理

## 2026-05-11：定时任务多实例 IM 投递保护与日志收敛

本轮继续按上一节规划推进。先复核了 `Provider / 模型配置` 剩余差异，结论是当前分支已经有 `apiRequestHeaders.ts`、`providerRequestConfig.ts`、LM Studio 注册与图标等多项不弱于 `main` 的补齐；剩余的大块差异集中在 `openclawConfigSync / claudeSettings / OpenAI Codex OAuth`，会牵动认证和网关配置，因此本轮转入第二批 `IM / Agent / ScheduledTasks` 的低风险边角。

本轮调查结论：

1. Provider 区域本轮不继续硬合
   - 当前分支已经包含 `ProviderName.LmStudio`、`ProviderRegistry` 的 OpenClaw provider id 映射、OpenAI/Copilot/Gemini 请求头与 URL helper
   - `main` 中剩余差异更多是格式、类型收窄或认证主干相关，不适合混入本轮
2. 定时任务多实例 IM 链路已有基础，但需要补保护
   - `ScheduledTaskChannelOption.accountId/filterAccountId` 已存在
   - `listScheduledTaskChannels()` 已能把启用的多实例平台展开为实例级选项
   - `CronJobService.toGatewayDelivery()` 已会把 `delivery.accountId` 传给 OpenClaw
   - 但此前缺少针对 `cron.add / cron.update` 的直接回归测试
3. 定时任务日志存在热路径噪声
   - `CronJobService.addJob / updateJob / toGatewayDelivery` 会输出完整 input、delivery、patch
   - 这些日志可能包含任务内容、IM 会话目标和实例 accountId，不适合生产环境常规输出

本轮已完成的代码改动：

1. 清理 `CronJobService` 热路径调试日志
   - 文件：`src/scheduledTask/cronJobService.ts`
   - 删除新增/更新任务时打印完整 input、delivery、patch 的 `console.log`
   - 删除 `toGatewayDelivery()` 每次转换时打印 delivery 的 `console.log`
   - 保留功能行为不变，只减少敏感内容和高频信息进入日志
2. 补定时任务多实例 IM 投递回归测试
   - 文件：`src/scheduledTask/cronJobService.test.ts`
   - 新增测试确认 `addJob()` 会把 `delivery.accountId` 传给 `cron.add`
   - 新增测试确认 `updateJob()` 会把 `delivery.accountId` 传给 `cron.update`
   - 覆盖 `dingtalk`、`feishu` 这类实例级投递关键路径，防止后续改动又退回平台级投递

本轮工程原则说明：

1. `KISS`：只删热路径日志、补回归测试，不改变定时任务 schema 和 OpenClaw cron 协议
2. `YAGNI`：不提前搬 `main` 的 Email/NIM/POPO 完整通道 UI
3. `SOLID`：投递转换仍由 `CronJobService` 负责，UI 选择和运行时投递边界保持清晰
4. `DRY`：用测试锁住 `delivery.accountId` 传递契约，避免各入口重复写临时校验

后续规划：

1. 下一步继续 `ScheduledTasks / Run history`
   - 检查执行按钮点击后反馈、running 状态、run history 局部更新是否还有 main 公共修复可贴
   - 只做行为和状态层补丁，不改青数工作台 UI
2. 第二步回到 `IM / Agent`
   - 继续检查实例删除、实例禁用、Agent 绑定和定时任务引用之间的联动
   - 重点避免 stale binding 和已删除实例仍被任务使用
3. 第三步再回看 `OpenClaw runtime / transcript / gateway lifecycle`
   - 拆小批次处理 gateway restart、transcript reconcile、keepalive/session patch
4. `OpenAI Codex OAuth`、`sqliteBackup`、`NIM QR Login`、`POPO/IM UI 大迁移` 继续保持独立高耦合批次

## 2026-05-11：Memory/MCP 复扫与 LM Studio 图标补齐

本轮继续按“只合低风险公共能力，保留青数覆盖层”的策略推进，没有对 `main` 做大范围覆盖。复扫重点放在 `Memory / MCP / Provider` 三类公共能力，结论是：`Memory` 和 `MCP Bridge` 当前分支已经有不弱于 `main` 的修复，不适合为了差异归零而回退；本轮只补了一个独立、可验证、不会影响运行时的 Provider UI 缺口。

本轮调查结论：

1. `openclawMemoryFile` 不从 `main` 覆盖
   - 当前分支已经有 `MEMORY.md` 多 section 解析、一字符记忆保留、代码块内 bullet 不误删、写操作保留非 bullet 文档结构等测试
   - `main` 在这块没有这些增强，直接覆盖会退化历史记忆编辑与迁移可靠性
2. `mcpBridgeServer` 不从 `main` 覆盖
   - 当前分支已经监听 `ServerResponse.close` 来处理中途断连，避免把请求体正常读取完成后的 `IncomingMessage.close` 误判成 abort
   - `main` 剩余差异主要是注释和格式，行为上没有值得本轮强贴的低风险补丁
3. `mcpStore` 不从 `main` 覆盖
   - 当前分支仍使用 `sql.js`，并通过 `saveDb()` 持久化
   - `main` 的 `better-sqlite3` 写法不能单独搬入，否则会破坏当前存储链路
4. `sqliteBackup / NIM QR Login / OpenAI Codex OAuth` 暂缓
   - 这些是 `main` 独有或当前分支未完整接线的能力，但都需要主进程 IPC、preload、renderer UI 和存储层一起迁移
   - 只恢复单个文件会形成死代码或类型冲突，因此放到独立批次
5. `LM Studio` provider 图标是本轮可安全合入的小缺口
   - 当前分支 `ProviderRegistry` 已经有 `ProviderName.LmStudio`
   - 但 `uiRegistry` 没有对应图标，设置页会退回 `CustomProviderIcon`
   - `main` 已有 `LmStudioIcon`，属于纯展示层补齐，不触碰品牌、认证、OpenClaw runtime、工作台或治理链

本轮已完成的代码改动：

1. 新增 `src/renderer/components/icons/providers/LmStudioIcon.tsx`
2. 在 `src/renderer/components/icons/providers/index.ts` 导出 `LmStudioIcon`
3. 在 `src/renderer/providers/uiRegistry.tsx` 将 `ProviderName.LmStudio` 映射到 `LmStudioIcon`

本轮工程原则说明：

1. `KISS`：只补一个缺失图标，不改变 provider 配置、模型解析或网关写入逻辑
2. `YAGNI`：不为了“看起来更接近 main”提前引入 SQLite 备份、NIM 扫码或 OpenAI Codex OAuth
3. `SOLID`：Provider 展示仍集中在 `uiRegistry`，运行时 provider 元数据仍由 `ProviderRegistry` 负责
4. `DRY`：复用 `main` 已有图标资源，不再让 LM Studio 走自定义 provider fallback

后续规划：

1. 下一步优先继续 `Provider / 模型配置` 的剩余小差异，只处理不涉及认证 token 生命周期的类型、图标、metadata 和测试补齐
2. 第二步进入 `IM / Agent` 多实例剩余边角，继续聚焦存储、绑定、保存可用性、局部刷新和定时任务联动
3. 第三步再处理 `ScheduledTasks / Run history` 的执行态反馈、运行记录和错误兜底
4. `sqliteBackup`、`NIM QR Login`、`OpenAI Codex OAuth`、`POPO/IM UI 大迁移`、`OpenClaw 主干重构` 都保留为独立高耦合批次，避免影响青数品牌、工作台、内置治理链和唤醒/TTS

## 2026-05-11：低风险公共能力复扫与下一批规划

本轮继续沿用“小步筛 main 公共能力、保留青数覆盖层”的策略，在 `front-design-merge` 上复扫 `origin/main` 剩余差异。当前分支已经包含上一轮提交 `4ef92136 fix(openclaw): align public runtime stability patches`，工作区除 `outputs/` 下本地图片产物外保持干净。本轮没有强行合入代码，主要完成差异核对、风险分类和后续批次规划。

本轮复扫结论：

1. `OpenClaw / MCP / Provider` 的低耦合公共修复已基本覆盖
   - `chat.send` 超时已提升到 `90_000ms`
   - 继续对话前 session model patch 已接入，能减少 agent 报告模型与实际模型不一致
   - `memory_search` 在 embedding 关闭时不会写入 `{ enabled: false }`，避免 OpenClaw 移除工具
   - 系统代理会尝试多个解析目标，并对非 loopback provider baseURL 写入 `request.proxy.mode = env-proxy`
   - OpenAI OAuth + 系统代理场景不会再写 `agents.defaults.models` allowlist
   - server model metadata 更新会返回 changed 状态，避免模型列表顺序或套餐元数据刷新诱发无意义 gateway 重启
   - OpenClaw 插件 manifest id 清理、`qwen-portal-auth` 条件写入、NIM/email package id 清理都有测试覆盖
2. `MCP Bridge` 的关键 abort 行为已经等价
   - 当前分支已经监听 `ServerResponse.close`，而不是监听 `IncomingMessage.close`
   - 这能避免请求体读取结束后误判为连接中断，进而错误 abort MCP tool call
   - `main` 剩余差异主要是注释与格式差异，不需要为此硬合代码
3. `Provider / 模型配置` 的主要公共能力已经接近 main
   - DeepSeek V4、Moonshot Kimi K2.6、Qianfan coding plan、Xiaomi MiMo coding plan 等模型与测试已存在
   - provider model name fallback、supportsImage fallback、coding plan URL 解析等已在当前分支覆盖
   - 剩余差异更多集中在 main 的类型收窄、导出顺序和 OpenAI Codex OAuth 主干，不适合和当前小批次混合处理
4. `构建 / 打包` 不适合照 main 原样合入
   - main 已切向 `better-sqlite3`，而当前分支仍使用 `sql.js`，直接同步 `vite.config.ts / package.json / electron-builder.json` 会破坏当前存储链路
   - main 删除了 macOS speech / TTS helper 打包项，而这些属于当前分支明确保留的唤醒/TTS 覆盖层
   - main 把产品名、可执行名和权限说明恢复为 `LobsterAI`，不能覆盖当前 `QingShuClaw` 品牌配置
5. `IM / Email / POPO` 仍需单独批次
   - main 已新增 Email channel platform 定义，但当前分支主要是 email skill 配置，并没有完整 Email OpenClaw channel UI / 图标 / 实例管理接线
   - 贸然只加平台注册表会让 UI 出现不可配置或缺图标入口
   - POPO/IM 多实例剩余差异仍属于高耦合批次，需要单独验收

本轮专项验证：

1. 已执行 `npm test -- --run src/main/libs/openclawConfigSync.runtime.test.ts src/main/libs/openclawLocalExtensions.test.ts src/main/libs/claudeSettings.test.ts src/main/libs/mcpBridgeServer.test.ts src/main/libs/openclawMemoryFile.test.ts`
2. 结果：`4` 个测试文件、`60` 个用例通过
3. 当前 `git status --short --branch` 显示分支比 `origin/front-design-merge` ahead `1`，仅 `outputs/` 为未跟踪本地图片产物

本轮未改代码的原因：

1. `KISS`：已经具备行为等价的补丁不再重复搬运，避免制造无意义 diff
2. `YAGNI`：不为“差异归零”引入 `better-sqlite3`、OpenAI Codex OAuth、Email channel UI 等尚未进入本批次验收范围的主干迁移
3. `SOLID`：继续保护青数品牌、工作台、治理链、唤醒/TTS 和认证承接层的职责边界，不把公共主干重构硬压进业务覆盖层
4. `DRY`：优先复用当前分支已吸收的 main 测试和 helper，不再复制一套重复逻辑

后续规划：

1. 第一批：`Provider / 模型配置` 收尾
   - 只处理类型与注册表层的小差异，例如 `ProviderConfig`、`ProviderRegistry`、coding plan model metadata 的安全补齐
   - 暂不接 `coworkOpenAICompatProxy` per-provider token refresher，避免碰认证路径
2. 第二批：`IM / Agent` 多实例剩余边角
   - 聚焦 `imStore / imSlice / services/im.ts / Agent IM binding` 的实例级状态一致性
   - 暂不整包搬 POPO/IM UI，先做存储、绑定、保存按钮可用性和定时任务联动的可验收补丁
3. 第三批：`ScheduledTasks / Run history`
   - 对齐 main 的运行记录、执行态反馈和错误兜底
   - 保留当前青数内置 Agent 与工作台入口，不改主操作台视觉结构
4. 第四批：`OpenClaw runtime / transcript / gateway lifecycle`
   - 继续拆成小补丁，优先处理 gateway restart、transcript reconcile、keepalive policy、runtime patch 稳定性
   - 如果 OpenClaw runtime 版本变化，再按用户偏好走“先删除旧 runtime，再重建新版本”
5. 第五批：`工程化 / 测试`
   - 补齐仍缺的主线测试，但不直接删除当前 `check-precommit.cjs`、secret scan、macOS helper 构建脚本
   - CI / Husky / lint-staged 等策略最后再统一评估，避免先改提交流程影响当前交付节奏

## 2026-05-11：Provider 注册表契约收紧

本轮按上一节规划继续推进第一批 `Provider / 模型配置` 收尾，只处理低风险公共契约，不触碰青数认证、青数代理路径、OpenAI Codex OAuth 主干或 per-agent modelSlice。

本轮已完成的公共更新：

1. Provider 注册表必填字段收紧
   - 文件：`src/shared/providers/constants.ts`
   - `ProviderDefInput.label` 与 `ProviderDef.label` 从可选改为必填
   - `ProviderDefInput.openClawProviderId` 与 `ProviderDef.openClawProviderId` 从可选改为必填
   - 当前所有内置 provider 已经实际提供这两个字段，本轮只是把真实契约固化到类型层，减少后续消费端反复写 fallback
2. Provider 注册表回归测试补强
   - 文件：`src/shared/providers/constants.test.ts`
   - 新增用例校验所有 provider 都具备非空 UI label 和 OpenClaw provider id
   - 这能防止后续新增 provider 时漏填运行时 provider 映射，导致 scheduled task / model ref / OpenClaw config 出现隐性漂移

本轮明确暂不合入的内容：

1. 暂不把 `ProviderConfig.apiFormat` 从 `ApiFormat | 'native'` 收窄为纯 `ApiFormat`
   - 当前 `Settings.tsx` 的 provider 导入兼容仍接受历史 `'native'`
   - `claudeSettings.ts` 的本地 provider config 类型也仍保留 `'native'`
   - 直接收窄会破坏旧配置导入和本地兼容，不符合本轮低风险边界
2. 暂不接 `openaiCodexAuth.ts` 与 `coworkOpenAICompatProxy` per-provider token refresher
   - 这条会进入认证主干与 token 生命周期，必须单独批次评估
3. 暂不把青数服务端代理路径从 `/api/qingshu-claw/proxy/v1` 改为 main 的 `/api/proxy/v1`
   - 当前路径属于青数登录/服务端承接层的一部分，不能在 Provider 小批次里改

校验结果：

1. `npm test -- --run src/shared/providers/constants.test.ts src/shared/providers/codingPlan.test.ts src/renderer/utils/openclawModelRef.test.ts` 通过，`3` 个测试文件、`49` 个用例
2. `npx tsc --project tsconfig.json --noEmit` 通过
3. `npx tsc --project electron-tsconfig.json --noEmit` 通过

本轮工程原则说明：

1. `KISS`：只固化已经真实存在的 provider 必填字段，不引入新的运行时分支
2. `YAGNI`：不提前迁移 OAuth/token refresher 或 per-agent modelSlice
3. `SOLID`：Provider 注册表继续作为模型元数据和 OpenClaw provider id 的单一职责真源
4. `DRY`：通过类型和测试约束统一消费端假设，减少各处自行兜底

后续规划：

1. 下一步继续第一批 `Provider / 模型配置`，只筛 `claudeSettings.ts` 中不涉及认证路径的 model metadata / normalize 行为差异
2. 如果没有更安全的小补丁，就进入第二批 `IM / Agent` 多实例剩余边角，优先检查保存按钮可用性、实例级绑定和定时任务联动
3. `OpenAI Codex OAuth`、`coworkOpenAICompatProxy` per-provider token refresher、`modelSlice` per-agent 迁移继续保留为独立批次

## 2026-05-11：Provider 类型去重复与 IM 绑定回归保护

本轮继续小步推进，先收完 `Provider / 模型配置` 中不涉及认证路径的低风险差异，然后进入第二批 `IM / Agent` 多实例边角。仍然没有触碰青数品牌、工作台、青数登录、内置治理链、唤醒/TTS，也没有引入 main 的 OpenAI Codex OAuth 主干。

本轮已完成的公共更新：

1. `claudeSettings` 复用 shared provider 类型
   - 文件：`src/main/libs/claudeSettings.ts`
   - 删除本地重复定义的 provider config 大部分字段，改为基于 `SharedProviderConfig` 派生
   - 保留当前分支需要的兼容层：
     - `apiFormat?: 'anthropic' | 'openai' | 'native'`
     - provider models 允许 `name` 缺省，再由 `normalizeProviderModels(...)` 补齐
   - 这只是类型层去重复，不改变青数代理路径 `/api/qingshu-claw/proxy/v1`、MiniMax OAuth 现有处理、OpenClaw config 写入或模型选择行为
2. IM 多实例绑定测试补强
   - 文件：`src/renderer/components/agent/agentImBindingConfig.test.ts`
   - 新增用例确保保存实例级绑定时，会清理当前 Agent 旧的平台级和旧实例级绑定
   - 新增用例确保不会把其他 Agent 的实例绑定回填给当前 Agent
   - 这能保护“新建/编辑 Agent 选择 IM 多实例后保存”的关键数据语义，避免平台级旧绑定和实例级新绑定并存导致路由漂移

本轮核对到但没有改动的点：

1. `openclawModelRef.ts`
   - 当前分支已有 `OpenAI -> OpenAICodex` 迁移兼容、server model 固定 `lobsterai-server`、唯一 modelId fallback 等测试
   - main 版本带有调试 `console.log`，不适合合入当前分支
2. `AgentCreateModal / AgentSettingsPanel`
   - 当前分支已经支持多实例绑定 key，例如 `feishu:{instanceId}`
   - 编辑 Agent 时，绑定到当前 Agent 的实例不会被误判为“其他 Agent 已占用”
   - 新建 Agent 因为还没有 agentId，已有绑定实例禁止抢占是合理行为
3. `ProviderConfig.apiFormat`
   - 继续保留 `'native'` 导入兼容，不跟 main 收窄为纯 `ApiFormat`

校验结果：

1. `npm test -- --run src/renderer/components/agent/agentImBindingConfig.test.ts src/renderer/components/agent/agentDraftState.test.ts src/renderer/components/agent/agentBundleSaveFlow.test.ts src/renderer/components/agent/agentBundleSaveGuard.test.ts src/main/libs/claudeSettings.test.ts src/shared/providers/constants.test.ts` 通过，`6` 个测试文件、`55` 个用例
2. `npx tsc --project tsconfig.json --noEmit` 通过
3. `npx tsc --project electron-tsconfig.json --noEmit` 通过

本轮工程原则说明：

1. `KISS`：Provider 只做类型去重复，IM 只补测试，不做 UI 大迁移
2. `YAGNI`：不提前迁移 Email channel、POPO 多实例 UI 或 OpenAI Codex OAuth
3. `SOLID`：IM 绑定 key 的标准化、收集、写回仍集中在 `agentImBindingConfig.ts`
4. `DRY`：`claudeSettings` 复用 shared provider 类型，减少 main/renderer/main process 三处 provider 契约漂移

后续规划：

1. 下一步进入第二批 `IM / Agent`，继续检查 `imStore / imSlice / services/im.ts` 的实例级状态一致性
2. 优先补“不会改 UI 结构”的测试与 helper，例如删除实例时绑定清理、保存后局部状态刷新、定时任务使用实例级绑定
3. `POPO/IM UI 整包迁移`、`Email channel 完整入口` 和 `OpenClaw 主干重构` 继续保留为独立高耦合批次

## 2026-05-11：IM 实例删除绑定清理回归保护

本轮继续推进第二批 `IM / Agent` 多实例剩余边角，选择了低风险、可验证的主进程存储层切口：删除 IM 实例时，必须同步清理该实例对应的 Agent 绑定，且不能误删其他平台或其他实例绑定。

本轮已完成的公共更新：

1. IMStore 删除实例绑定逻辑去重
   - 文件：`src/main/im/imStore.ts`
   - 新增私有 helper `deletePlatformAgentBinding(bindingKey)`
   - `deleteDingTalkInstance / deleteFeishuInstance / deleteQQInstance / deleteWecomInstance` 统一调用该 helper
   - 行为保持不变：只清理 `platform:{instanceId}` 对应绑定，再删除该实例配置
   - 额外优化：清理绑定时复制 `platformAgentBindings` 后再写回，避免直接修改 `getIMSettings()` 返回对象导致后续状态引用漂移
2. IMStore 多实例删除回归测试
   - 文件：`src/main/im/imStore.test.ts`
   - 使用当前分支仍在使用的 `sql.js` 内存库测试，不照搬 `main` 中基于 `better-sqlite3` 的大测试文件
   - 覆盖 `dingtalk / feishu / qq / wecom` 四类当前已接入多实例的平台
   - 校验删除 `platform:deleted` 后会保留：
     - 同平台其他实例绑定，例如 `platform:kept`
     - 其他平台绑定，例如 `telegram`
     - 历史平台级绑定，例如 `feishu`
   - 额外覆盖删除未绑定实例时 settings 不被意外清空

本轮刻意未合入的内容：

1. 未迁移 `main` 的完整 `imStore.test.ts`
   - `main` 已切到 `better-sqlite3`，当前分支仍是 `sql.js`
   - 直接搬测试会把存储迁移问题混进本批次，不符合小步验收
2. 未新增 Telegram / Discord / NIM / POPO / Email 多实例 reducer 或 UI
   - 当前分支的多实例主线仍集中在 `dingtalk / feishu / qq / wecom`
   - 其他平台属于 POPO/IM 大迁移范围，需要单独批次规划
3. 未修改 Agent 创建/编辑弹窗 UI
   - 当前分支已经支持实例级 binding key
   - 本轮只保护删除实例后的数据一致性，不重新设计保存按钮和渠道选择交互

校验结果：

1. `npm test -- --run src/main/im/imStore.test.ts src/renderer/components/agent/agentImBindingConfig.test.ts` 通过，`2` 个测试文件、`14` 个用例
2. `npx tsc --project tsconfig.json --noEmit` 通过
3. `npx tsc --project electron-tsconfig.json --noEmit` 通过

本轮工程原则说明：

1. `KISS`：只抽出一个私有 helper，不改变 IM 配置表结构和 IPC 契约
2. `YAGNI`：不为未来平台提前铺多实例 UI，只测试当前真实支持的平台
3. `SOLID`：实例删除仍由 `IMStore` 负责自己的持久化与绑定清理，不把清理责任散到 renderer
4. `DRY`：四个删除方法共用同一清理逻辑，减少后续新增实例平台时漏清绑定的风险

后续规划：

1. 下一步继续第二批 `IM / Agent`，检查 `services/im.ts + imSlice.ts` 在保存多实例配置后的局部刷新策略，优先补不会改 UI 的状态一致性测试
2. 随后检查定时任务与 IM 实例绑定的联动，确保任务运行时使用实例级 binding key，而不是退回旧的平台级绑定
3. 再进入 `ScheduledTasks / Run history` 公共行为收口，优先处理执行态反馈、运行记录和错误兜底
4. `POPO/IM UI 整包迁移`、`Email channel 完整入口`、`OpenClaw 主干重构`、`per-agent modelSlice` 仍作为独立高耦合批次推进

## 2026-05-11：IM Service 局部刷新与绑定状态一致性

本轮继续第二批 `IM / Agent`，沿上一节规划检查 `services/im.ts + imSlice.ts` 的实例级状态刷新策略。对比 `origin/main` 后确认：`main` 已将更多平台推进到多实例结构，但当前分支暂时只安全接入 `dingtalk / feishu / qq / wecom` 四类多实例平台，因此本轮只把“已有多实例平台的局部状态刷新”贴回，不引入 Telegram / Discord / NIM / POPO / Email 的大迁移。

本轮已完成的公共更新：

1. IM Service 多实例操作改为局部更新
   - 文件：`src/renderer/services/im.ts`
   - `addDingTalkInstance / addFeishuInstance / addQQInstance / addWecomInstance` 成功后直接 dispatch 对应 `add*Instance`
   - `deleteDingTalkInstance / deleteFeishuInstance / deleteQQInstance / deleteWecomInstance` 成功后直接 dispatch 对应 `remove*Instance`
   - `persist*InstanceConfig(..., syncGateway: false)` 成功后 dispatch 对应 `set*InstanceConfig`
   - 这样可减少不必要的全量 `loadConfig()`，也让设置页字段保存更接近 `main` 的局部刷新策略
2. 显式同步语义保持不变
   - `update*InstanceConfig(...)` 默认仍按 `syncGateway: true` 处理
   - 不传 options 的设置页保存、启停开关、连通性自动启用等路径仍会触发网关同步，并随后 `loadConfig() + loadStatus()`
   - 只有 `persist*InstanceConfig(...)` 才会走 `syncGateway: false` 的静默局部更新，避免保存草稿字段时频繁重启网关
3. Renderer 本地删除实例时同步清理绑定
   - 文件：`src/renderer/store/slices/imSlice.ts`
   - `removeDingTalkInstance / removeFeishuInstance / removeQQInstance / removeWecomInstance` 删除实例数组项时，同时删除 `settings.platformAgentBindings[platform:instanceId]`
   - 这和上一节主进程 `IMStore` 的删除绑定清理保持一致，避免 service 改成局部更新后 renderer 残留 stale binding
4. imSlice 状态一致性测试
   - 文件：`src/renderer/store/slices/imSlice.test.ts`
   - 覆盖四类当前多实例平台删除实例时清理本地绑定，并保留同平台其他实例和其他平台绑定
   - 覆盖 `setFeishuInstanceConfig` 的局部实例 patch，确保不会替换整个 config

本轮刻意未合入的内容：

1. 未接 `main` 的 Telegram / Discord / NIM / POPO / Email 多实例 reducer
   - 这些平台牵动 renderer 类型、设置页 UI、preload IPC、主进程 store 与 OpenClaw channel 配置
   - 属于 POPO/IM 大迁移批次，不适合混入当前局部刷新修复
2. 未改 `IMSettingsMain.tsx` 的 UI 结构
   - 当前设置页已有自己的青数工作台承接和多实例展示形态
   - 本轮只改变 service/slice 状态更新方式，不改变视觉或交互布局
3. 未改变主进程 `syncGateway` 判定
   - 仍然只有显式同步才会触发 gateway config sync/restart
   - 这符合之前“有任务运行时避免无谓网关重启”的总体方向

校验结果：

1. `npm test -- --run src/renderer/store/slices/imSlice.test.ts src/main/im/imStore.test.ts src/renderer/components/agent/agentImBindingConfig.test.ts` 通过，`3` 个测试文件、`19` 个用例
2. `npx tsc --project tsconfig.json --noEmit` 通过
3. `npx tsc --project electron-tsconfig.json --noEmit` 通过
4. `git diff --check` 通过

本轮工程原则说明：

1. `KISS`：只对现有四类多实例平台做局部刷新，不扩大平台范围
2. `YAGNI`：暂不提前引入 Email/POPO/NIM 等多实例 UI 和 IPC
3. `SOLID`：service 负责 IPC 成功后的 store 投影，slice 负责本地状态一致性，主进程继续负责持久化真源
4. `DRY`：删除实例后的绑定清理在主进程和 renderer 各自状态层都有统一规则，避免调用方重复补丁

后续规划：

1. 下一步检查定时任务与 IM 实例绑定联动，重点看 `imScheduledTaskHandler.ts` 是否在多实例绑定下稳定使用 `platform:instanceId`
2. 随后继续 `ScheduledTasks / Run history` 公共能力，优先处理执行态反馈、运行记录和错误兜底
3. 再回到 `IM / Agent` 的剩余高耦合项，单独规划 POPO/Email/NIM 多实例迁移范围
4. `OpenClaw 主干重构`、`per-agent modelSlice`、`coworkOpenAICompatProxy` per-provider token refresher 继续独立批次

## 2026-05-11：IM 定时任务继承当前 Agent 绑定

本轮继续检查定时任务与 IM 实例绑定联动。实际代码链路显示：`imScheduledTaskHandler.ts` 主要负责“提醒语义检测与文本归一化”，实例级 Agent 绑定选择不在这里完成；普通 OpenClaw channel session 同步已经通过 `openclawChannelSessionSync.ts` 支持 `platform:instanceId`。真正的缺口在 IM 对话里直接创建定时任务时，`main.ts` 的 `createScheduledTask` 固定把 `agentId` 写成 `main`，没有继承当前 IM cowork session 所属 Agent。

本轮已完成的公共更新：

1. IM 定时任务 Agent 解析 helper
   - 文件：`src/main/im/imScheduledTaskAgent.ts`
   - 新增 `resolveIMScheduledTaskAgentId(coworkStore, sessionId)`
   - 优先读取当前 IM cowork session 的 `agentId`
   - 若旧 session 缺失或 `agentId` 为空，则回退到 `DEFAULT_MANAGED_AGENT_ID`
2. IM 直接创建定时任务时继承当前 Agent
   - 文件：`src/main/main.ts`
   - `getIMGatewayManager()` 注入的 `createScheduledTask` 现在会基于当前 `sessionId` 解析 `agentId`
   - `cron.add` 的 `agentId` 改为当前 IM session agent
   - 非 channel fallback 的 managed sessionKey 也使用同一个 agentId 构造，避免 agentId 和 sessionKey 不一致
3. 回归测试
   - 文件：`src/main/im/imScheduledTaskAgent.test.ts`
   - 覆盖绑定 Agent session 正常继承
   - 覆盖旧 session / 缺失 session 回退到 main managed agent

本轮核对结论：

1. `openclawChannelSessionSync.ts` 已有 `resolveAgentBinding(bindings, platform, accountId)`，且已有 per-instance binding 测试
2. `imScheduledTaskHandler.ts` 与 `origin/main` 基本同构，本轮不需要在提醒检测文件里硬改逻辑
3. 旧 IM native cowork session 创建仍只按平台级 binding，这条路径主要面向非 OpenClaw channel sync 的兼容链路；如果后续还要让 native path 识别 instanceId，需要先扩展 `IMMessage` 的 account/instance 元数据，不适合在本轮混入

校验结果：

1. `npm test -- --run src/main/im/imScheduledTaskAgent.test.ts src/main/im/imScheduledTaskHandler.test.ts src/main/im/imCoworkHandler.test.ts src/main/libs/openclawChannelSessionSync.test.ts` 通过，`4` 个测试文件、`22` 个用例
2. `npx tsc --project tsconfig.json --noEmit` 通过
3. `npx tsc --project electron-tsconfig.json --noEmit` 通过

本轮工程原则说明：

1. `KISS`：用一个小 helper 解析当前 session agent，不改 CronJobService 或 OpenClaw runtime
2. `YAGNI`：不为 native IM path 提前设计 instance metadata，先修真实已发现的任务 agent 漂移
3. `SOLID`：Agent 归属解析独立成 helper，可测试且不污染主进程入口业务块
4. `DRY`：非 channel fallback 的 `agentId` 和 managed `sessionKey` 使用同一来源，避免双写不一致

后续规划：

1. 下一步进入 `ScheduledTasks / Run history` 公共能力收口，优先看手动执行/运行中反馈是否还有明显滞后或错误兜底不足
2. 同步检查 `src/main/ipcHandlers/scheduledTask/` 与 `src/renderer/components/scheduledTasks/` 中和 `origin/main` 的低风险差异
3. 继续避免触碰青数工作台主 UI 和唤醒/TTS 覆盖层
4. POPO/Email/NIM 多实例迁移、OpenClaw 主干重构、per-agent modelSlice 仍单独批次处理

## 2026-05-11：ScheduledTasks 全局运行历史即时刷新

本轮进入 `ScheduledTasks / Run history` 公共能力收口。复扫后确认：当前分支已经有多项比 `origin/main` 更贴近当前问题的增强，例如手动执行时前端乐观标记 running、延迟刷新任务状态、RunSessionModal 优先加载 transcript run sessionKey、CronJobService 不因 polling 主动拉起 gateway、以及 persisted jobs fallback。这些增强不应为了差异归零被回退。

本轮已完成的公共更新：

1. `runUpdate` 同步更新全局运行历史
   - 文件：`src/renderer/store/slices/scheduledTaskSlice.ts`
   - `addOrUpdateRun` 的 payload 类型从 `ScheduledTaskRun` 收紧为 `ScheduledTaskRunWithName`
   - 收到后台 `scheduledTask:runUpdate` 后，同时更新：
     - 单任务历史 `runs[taskId]`
     - 全局历史 `allRuns`
   - 如果 `allRuns` 已有同 id run，则就地替换；否则插入到顶部
   - 这样用户停留在“全部运行历史”页时，任务完成/失败/运行态更新能即时出现，不必等待重新进入页面或手动刷新
2. scheduledTaskSlice 回归测试
   - 文件：`src/renderer/store/slices/scheduledTaskSlice.test.ts`
   - 覆盖 run update 同时进入单任务历史与全局历史
   - 覆盖同 id run 从 running 更新到 success 时不会重复插入

本轮核对到但保留不改的点：

1. `src/renderer/services/scheduledTask.ts`
   - 当前分支的 `runManually` 已比 `main` 更强：调用前会乐观设置 `runningAtMs + lastStatus=running`，失败时回滚，成功后延迟刷新
   - 这正好解决“点击执行后像卡住”的体验问题，不能按 `main` 简化版回退
2. `src/renderer/components/scheduledTasks/RunSessionModal.tsx`
   - 当前分支已有 `getRunSessionLoadOrder`，对 `agent:*:run:{uuid}` transcript sessionKey 优先走 `resolveSession`
   - 这能更好展示 cron run transcript，不应回退到 main 的 sessionId-first 简化逻辑
3. `src/scheduledTask/cronJobService.ts`
   - 当前分支已经覆盖 main 的 delivery-only error 降级、模型字段保留、状态轮询事件推送
   - 还额外保留 gateway 未连接时读取 persisted jobs，避免启动阶段任务列表空白
4. `src/main/ipcHandlers/scheduledTask/helpers.ts`
   - 当前分支已接入多实例 channel option 展开，并有 NIM runtime account id 派生测试
   - 本轮不再重复搬 main 相同逻辑

校验结果：

1. `npm test -- --run src/renderer/store/slices/scheduledTaskSlice.test.ts src/renderer/components/scheduledTasks/RunSessionModal.test.ts src/renderer/components/scheduledTasks/utils.test.ts src/scheduledTask/cronJobService.test.ts src/main/ipcHandlers/scheduledTask/helpers.test.ts` 通过，`5` 个测试文件、`25` 个用例
2. `npx tsc --project tsconfig.json --noEmit` 通过
3. `npx tsc --project electron-tsconfig.json --noEmit` 通过

本轮工程原则说明：

1. `KISS`：只改 Redux 投影层，不改 IPC、CronJobService 或 UI 布局
2. `YAGNI`：不为差异归零重做运行历史 UI，也不引入新的刷新机制
3. `SOLID`：runUpdate 的状态归并职责集中在 scheduledTaskSlice
4. `DRY`：同一个 `runUpdate` 同时维护 task runs 与 allRuns，避免各页面自行二次刷新

后续规划：

1. 继续 `ScheduledTasks / Run history`，检查 `TaskRunHistory` 单任务历史是否也有分页/重复/运行态更新的低风险缺口
2. 继续检查 `TaskForm` 与 `handlers.ts` 的 announce delivery normalize 是否已经覆盖多实例 accountId / filterAccountId 的显示与保存
3. 若 scheduled task 剩余差异主要是 UI 风格而非行为 bug，则转入下一批 OpenClaw runtime patch / provider 剩余公共修复
4. 高耦合项仍保持单独批次：POPO/Email/NIM 多实例大迁移、OpenClaw 主干重构、per-agent modelSlice

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

## 2026-05-11：Cowork 消息更新 metadata 局部刷新链路补齐

本批次继续从 `main` 中摘取低耦合公共能力。复扫发现当前分支已经具备消息 metadata 的存储、类型和展示基础，例如 `usage`、`model`、`contextPercent` 等字段；但流式 `messageUpdate` IPC 只透传 `content`，导致 runtime 后续即使更新了 assistant 消息的 usage/model 元信息，当前打开的对话窗口也可能无法局部刷新，只能依赖重新加载或重新取 session。

### 已完成内容

1. Agent runtime 事件类型补齐
   - 文件：`src/main/libs/agentEngine/types.ts`
   - `CoworkRuntimeEvents.messageUpdate` 增加可选 `metadata?: Record<string, unknown>`。
2. CoworkEngineRouter 透传 metadata
   - 文件：`src/main/libs/agentEngine/coworkEngineRouter.ts`
   - runtime 发出的 `messageUpdate(sessionId, messageId, content, metadata)` 会继续向上转发，不再丢弃第四个参数。
3. 主进程 IPC 转发补齐
   - 文件：`src/main/main.ts`
   - `cowork:stream:messageUpdate` 现在可以携带安全处理后的 `metadata`。
   - `content` 仍保留原有长度截断保护。
4. preload / renderer 类型补齐
   - 文件：`src/main/preload.ts`
   - 文件：`src/renderer/types/electron.d.ts`
   - `onStreamMessageUpdate` 的回调数据结构增加可选 `metadata`。
5. renderer store 合并 metadata
   - 文件：`src/renderer/services/cowork.ts`
   - 文件：`src/renderer/store/slices/coworkSlice.ts`
   - 收到 message update 时同时派发 metadata。
   - reducer 会合并已有 metadata 与新 metadata，不会因为 usage/model 局部刷新丢掉既有 `isStreaming`、`isFinal` 等状态。
6. 测试补齐
   - 文件：`src/renderer/store/slices/coworkSlice.test.ts`
   - 新增“streaming message update 合并 metadata”用例。

### 保护边界

1. 未改对话窗口 UI 布局、主控台结构或青数工作台样式。
2. 未合入 `main` 的 agentEngine 单 runtime 大迁移，也未移除 `yd_cowork` legacy path。
3. 未触碰青数登录、managed catalog、内置治理链、唤醒或 TTS。
4. 仅补齐数据通路，为后续 usage/model 元信息刷新提供基础。

### 验证结果

1. `npm test -- --run src/renderer/store/slices/coworkSlice.test.ts`
   - 1 个测试文件通过
   - 2 个测试通过
2. `npx tsc --project electron-tsconfig.json --noEmit`
   - 通过
3. `npx tsc --project tsconfig.json --noEmit`
   - 通过
4. `git diff --check`
   - 通过

### 后续规划

1. 下一批可以继续接 OpenClaw runtime usage/model metadata 的生成侧小闭环，前提是只补低耦合函数，不搬整段 runtime 主干。
2. 构建打包脚本继续以“保留 macOS speech/TTS helper、保留可选插件容错、保留当前更强 prune helper”为边界筛选。
3. 高耦合内容继续单独批次：移除 `yd_cowork`、OpenClaw 主干重构、完整 OAuth UI/token refresher、POPO/IM 大迁移、per-agent modelSlice、主控台 UI 和完整 Artifacts 面板。

## 2026-05-11：OpenClaw 历史 usage/model 元信息保真补齐

本批次承接上一轮 `messageUpdate metadata` 通路。复扫后确认当前分支的 `openclawHistory` 已经能从 gateway `chat.history` 中解析 assistant 的 `usage` 和 `model`，但 OpenClaw runtime 的 reconcile / channel history 收集阶段会把这些信息降级成纯文本 `{ role, text }`，导致本地 SQLite 和 renderer 当前会话看不到 usage/model 元信息。

### 已完成内容

1. OpenClaw history entry 转 Cowork metadata
   - 文件：`src/main/libs/agentEngine/openclawRuntimeAdapter.ts`
   - 新增 `buildAssistantMetadataFromHistoryEntry()`。
   - 将 gateway usage 映射为 renderer 使用的：
     - `usage.inputTokens`
     - `usage.outputTokens`
     - `usage.cacheReadTokens`
   - 将 gateway `model` 保留到 `metadata.model`。
   - 默认补齐 `isStreaming: false`、`isFinal: true`，保证历史替换后的 assistant 消息状态稳定。
2. reconcileWithHistory 保留 metadata
   - 文件：`src/main/libs/agentEngine/openclawRuntimeAdapter.ts`
   - `authoritativeEntries` 从纯 `{ role, text }` 扩展为 `ChannelHistorySyncEntry`。
   - assistant 条目会携带 usage/model metadata。
   - tail alignment、full replace、channel shrinking guard 等既有同步策略不变。
3. channel history 收集保留 metadata
   - 文件：`src/main/libs/agentEngine/openclawRuntimeAdapter.ts`
   - `collectChannelHistoryEntries()` 会在 assistant 历史条目中保留 usage/model metadata。
   - `syncChannelUserMessages()` 仍只同步 user 消息，不改变现有顺序修复策略。
4. CoworkStore 替换会话消息时写入 metadata
   - 文件：`src/main/coworkStore.ts`
   - `replaceConversationMessages()` 支持 authoritative entry 自带 metadata。
   - 写库时仍强制保留 `isStreaming: false`、`isFinal: true`，再合并 usage/model。
5. 测试补齐
   - 文件：`src/main/libs/agentEngine/openclawRuntimeAdapter.test.ts`
   - 新增 reconcile 保留 assistant usage/model metadata 用例。
   - 新增 collectChannelHistoryEntries 保留 assistant usage/model metadata 用例。

### 保护边界

1. 未合入 `main` 的 OpenClaw runtime 主干重构。
2. 未改变 channel history window 防缩短保护，避免再次触发历史被短窗口覆盖的问题。
3. 未触碰青数品牌、工作台、managed catalog、治理链、唤醒或 TTS。
4. 未改变对话窗口 UI，只补数据保真。

### 验证结果

1. `npm test -- --run src/main/libs/agentEngine/openclawRuntimeAdapter.test.ts`
   - 1 个测试文件通过
   - 48 个测试通过
2. `npx tsc --project electron-tsconfig.json --noEmit`
   - 通过
3. `npx tsc --project tsconfig.json --noEmit`
   - 通过
4. `git diff --check`
   - 通过

### 后续规划

1. 下一批继续筛剩余 OpenClaw runtime 小闭环，优先考虑不改变 sessionKey、history reconcile、agentEngine 主干结构的补丁。
2. 构建打包脚本仍可继续扫描，但必须保留当前分支已有的 macOS speech/TTS helper、可选插件容错、third-party extension prune helper。
3. `yd_cowork` 移除、OpenClaw 主干重构、完整 OAuth UI/token refresher、POPO/IM 大迁移、per-agent modelSlice、主控台 UI 和完整 Artifacts 面板继续单独规划。

## 2026-05-11：Managed 会话 final sync usage/model 元信息保真

本批次继续收口上一轮 usage/model 保真链路。前一批已经让 reconcile / channel history 保留 assistant 元信息，但 managed/main 会话在一轮回答结束时还会走 `syncFinalAssistantWithHistory()`，用 OpenClaw `chat.history` 的最终文本修正流式消息。如果这条 final sync 只更新文本，不同步 metadata，那么当前打开的对话仍可能看不到最终 `usage/model`，或者要重新加载 session 才能展示。

### 已完成内容

1. 当前 turn assistant metadata 提取
   - 文件：`src/main/libs/agentEngine/openclawRuntimeAdapter.ts`
   - 新增 `extractCurrentTurnAssistantMetadata()`。
   - 和 `extractCurrentTurnAssistantText()` 使用同一个“最后一条 user 之后”的 turn 边界，避免把上一轮 assistant 的 usage/model 错写到当前轮。
   - 继续复用 `buildAssistantMetadataFromHistoryEntry()`，保持 `usage.inputTokens / outputTokens / cacheReadTokens` 和 `model` 映射一致。
2. final sync 新建 assistant 时写入 metadata
   - 文件：`src/main/libs/agentEngine/openclawRuntimeAdapter.ts`
   - 当 final payload 没有流式文本、需要从 history 新建 assistant 消息时，同步写入 `isStreaming=false`、`isFinal=true`、`usage` 和 `model`。
3. final sync 复用已有 assistant 时补齐 metadata
   - 文件：`src/main/libs/agentEngine/openclawRuntimeAdapter.ts`
   - 当 `reuseFinalAssistantMessage()` 复用已有消息时，会补写 metadata，并通过 `messageUpdate(..., metadata)` 刷新当前 renderer。
4. final sync 文本相同也刷新 metadata
   - 文件：`src/main/libs/agentEngine/openclawRuntimeAdapter.ts`
   - 当 canonical final text 与当前消息内容相同，只是 usage/model 后到时，也会更新 store 并发出带 metadata 的 `messageUpdate`。
   - 这样可避免“文本已经正确，但模型/Token 区域不刷新”的体验缺口。
5. 回归测试补齐
   - 文件：`src/main/libs/agentEngine/openclawRuntimeAdapter.test.ts`
   - 补强“final payload 无文本时新建 assistant”用例，断言 metadata 写入。
   - 新增“内容已是最终文本时仍更新 metadata 并 emit messageUpdate”用例。

### 保护边界

1. 未改 final sync 的 turn 边界算法和文本回填策略，只在同一边界内补 metadata。
2. 未改 channel history window 防缩短逻辑。
3. 未合入 `main` 的 OpenClaw 主干重构、移除 `yd_cowork` 或 per-agent modelSlice。
4. 未触碰青数品牌、工作台、managed catalog、治理链、唤醒或 TTS。

### 验证结果

1. `npm test -- --run src/main/libs/agentEngine/openclawRuntimeAdapter.test.ts`
   - 1 个测试文件通过
   - 49 个测试通过
2. `npx tsc --project electron-tsconfig.json --noEmit`
   - 通过
3. `npx tsc --project tsconfig.json --noEmit`
   - 通过
4. `git diff --check`
   - 通过

### 后续规划

1. 下一批继续筛 OpenClaw runtime 中剩余低耦合元信息/ctx 小闭环，重点确认 `chat.final` 直接 payload 是否还有 usage/contextPercent 缺口。
2. 如果涉及 `sessionContextTokensCache`、`refreshSessionContextTokens` 或模型上下文窗口表等当前分支不存在的主干函数，则暂缓，不为了表面对齐引入半套状态机。
3. 构建打包稳定性可继续小步筛选，但必须保留当前 macOS speech/TTS helper、openclaw optional plugin 容错和更强的 extension prune 逻辑。
4. POPO/IM 大迁移、OpenClaw 主干重构、完整 OAuth token refresher、per-agent modelSlice 和主控台 UI 继续保持独立批次。

## 2026-05-11：chat.final payload usage/model 直写

本批次继续从 `main` 的 OpenClaw runtime 元信息链路中拆取低耦合部分。`main` 同时做了两件事：从 `chat.final` payload 直接拿 usage/model，以及通过 `sessions.list` / 模型上下文窗口缓存计算 `contextPercent`。后者会引入 `sessionContextTokensCache`、`refreshSessionContextTokens()`、`getContextWindowForModel()` 等半套主干状态机，当前先暂缓；本轮只接不会影响青数覆盖层的 `chat.final` payload usage/model 直写。

### 已完成内容

1. 新增 final payload metadata 提取
   - 文件：`src/main/libs/agentEngine/openclawRuntimeAdapter.ts`
   - 新增 `buildAssistantMetadataFromFinalMessage()`。
   - 支持从 `payload.message.usage` 读取：
     - `input` / `inputTokens`
     - `output` / `outputTokens`
     - `cacheRead` / `cacheReadTokens`
   - 支持从 `payload.message.model` 读取模型名。
   - 输出仍统一为 renderer 已接入的 `usage.inputTokens / outputTokens / cacheReadTokens` 与 `model`。
2. `handleChatFinal()` 直接写入 metadata
   - 文件：`src/main/libs/agentEngine/openclawRuntimeAdapter.ts`
   - 已有 assistant 消息落库最终文本时同步写入 usage/model。
   - 新建 assistant 消息时同步写入 usage/model。
   - 复用已有最终 assistant 消息时也会补 metadata，并发出带 metadata 的 `messageUpdate`。
3. renderer 当前窗口局部刷新
   - 文件：`src/main/libs/agentEngine/openclawRuntimeAdapter.ts`
   - `chat.final` 更新已有消息时不再只发文本，而是发 `messageUpdate(sessionId, messageId, content, metadata)`。
   - 复用消息路径也会发 `messageUpdate`，避免“消息文本存在但 Token/模型区域不刷新”。
4. 回归测试补齐
   - 文件：`src/main/libs/agentEngine/openclawRuntimeAdapter.test.ts`
   - 新增 `chat.final persists usage and model metadata from final payload`。
   - 覆盖 store metadata 写入、renderer update 事件携带 metadata、session 正常完成和 active turn 清理。

### 保护边界

1. 未引入 `main` 的 `contextPercent` 计算主干。
2. 未新增 `sessions.list` 轮询缓存或模型上下文窗口缓存。
3. 未改变 managed session 跳过 `reconcileWithHistory()` 的现有策略。
4. 未触碰青数品牌、工作台、managed catalog、治理链、唤醒或 TTS。

### 验证结果

1. `npm test -- --run src/main/libs/agentEngine/openclawRuntimeAdapter.test.ts`
   - 1 个测试文件通过
   - 50 个测试通过
2. `npx tsc --project electron-tsconfig.json --noEmit`
   - 通过
3. `npx tsc --project tsconfig.json --noEmit`
   - 通过
4. `git diff --check`
   - 通过

### 后续规划

1. 下一批复核是否还有不依赖 OpenClaw 主干重构的 runtime 小补丁，例如错误态、abort、timeout 或日志降噪。
2. `contextPercent` 计算暂不继续拆，除非先确认当前分支已经具备等价的 context window 真源；否则容易引入半套缓存造成漂移。
3. 构建打包稳定性继续可筛，但仍保护 macOS speech/TTS helper 和现有 OpenClaw extension prune 逻辑。
4. POPO/IM 大迁移、OpenClaw 主干重构、完整 OAuth token refresher、per-agent modelSlice 和主控台 UI 继续保持独立批次。

## 2026-05-11：OpenClaw abort / timeout 诊断增强

本批次继续筛 `main` 的 OpenClaw runtime 错误态、abort、timeout 相关差异。当前分支已经具备客户端 timeout watchdog、手动停止后不弹 timeout 提示、late event 抑制等核心行为；本轮不改超时策略和用户可见文案，只补运行时长诊断，方便后续定位“为什么会进入超时/abort”。

### 已完成内容

1. ActiveTurn 增加开始时间
   - 文件：`src/main/libs/agentEngine/openclawRuntimeAdapter.ts`
   - `ActiveTurn` 新增 `startedAtMs`。
   - 普通 `runTurn()` 创建 active turn 时记录 `Date.now()`。
   - channel / IM follow-up 通过 `ensureActiveTurn()` 自动创建 active turn 时也记录 `Date.now()`。
2. abort 提示路径增加诊断日志
   - 文件：`src/main/libs/agentEngine/openclawRuntimeAdapter.ts`
   - `handleChatAborted()` 在确认为非手动停止、需要展示 `taskTimedOut` 提示时输出 `[AbortDiag] showing timeout hint to user`。
   - 日志包含 `sessionId`、`runId`、`elapsed` 和 `turnToken`。
3. 客户端 timeout watchdog 日志增强
   - 文件：`src/main/libs/agentEngine/openclawRuntimeAdapter.ts`
   - watchdog 触发时输出 `[AbortDiag] client-side timeout watchdog fired`。
   - 日志包含 `sessionId`、`runId`、`elapsed` 和 `watchdogMs`。
   - 仍然走原有 `handleChatAborted()`，不改变恢复 UI 的行为。
4. 测试对象补齐
   - 文件：`src/main/libs/agentEngine/openclawRuntimeAdapter.test.ts`
   - 现有手工构造的 `ActiveTurn` 测试对象补充 `startedAtMs`。
   - 不新增业务行为断言，避免把日志格式变成过度刚性的测试契约。

### 保护边界

1. 未改变超时时长、abort 处理状态、手动 stop 抑制逻辑。
2. 未改变 `taskTimedOut` 用户可见文案。
3. 未改 OpenClaw gateway lifecycle、channel sync、reconcile 或 IM 路由。
4. 未触碰青数品牌、工作台、managed catalog、治理链、唤醒或 TTS。

### 验证结果

1. `npm test -- --run src/main/libs/agentEngine/openclawRuntimeAdapter.test.ts`
   - 1 个测试文件通过
   - 50 个测试通过
2. `npx tsc --project electron-tsconfig.json --noEmit`
   - 通过
3. `npx tsc --project tsconfig.json --noEmit`
   - 通过
4. `git diff --check`
   - 通过

### 后续规划

1. 下一批继续复核 OpenClaw runtime 错误态和 late event 抑制，优先选择不改状态机的小补丁。
2. 如果继续筛到 `terminatedRunIds` / `recentlyClosedRunIds` 一类已有保护，优先补测试或文档，不重复实现。
3. 构建打包稳定性仍可继续小步筛选，但保留 macOS speech/TTS helper、OpenClaw extension prune 和本地插件容错。
4. POPO/IM 大迁移、OpenClaw 主干重构、完整 OAuth token refresher、per-agent modelSlice 和主控台 UI 继续保持独立批次。

## 2026-05-11：late chat error closed-run 回归保护

本批次继续复核 OpenClaw runtime 的 late event / terminated run 防线。代码复扫确认当前分支已经具备 `recentlyClosedRunIds`、`terminatedRunIds`、late chat/agent drop、manual stop 抑制、lifecycle error fallback runId/turnToken 校验等核心能力；因此本轮不重复实现已有逻辑，只补一个缺失的回归测试，防止后续继续合 `main` 时把 closed-run 防线改退。

### 已完成内容

1. closed-run late chat error 补测
   - 文件：`src/main/libs/agentEngine/openclawRuntimeAdapter.test.ts`
   - 新增 `late chat error for a closed run is ignored`。
   - 模拟一个已完成并已 `cleanupSessionTurn()` 的 run。
   - 再投递同 `runId` 的 `chat state=error` late event。
   - 断言 session 仍保持 `completed`，不会新增 system error message，不会 emit error，也不会重建 active turn。

### 保护边界

1. 未改 OpenClaw runtime 行为代码。
2. 未改 gateway lifecycle、chat error、abort、timeout 或 reconnect 策略。
3. 未触碰青数品牌、工作台、managed catalog、治理链、唤醒或 TTS。
4. 本轮只是把已有防线固化成测试，符合 `YAGNI`：不为“看起来更像 main”重复实现同等能力。

### 验证结果

1. `npm test -- --run src/main/libs/agentEngine/openclawRuntimeAdapter.test.ts`
   - 1 个测试文件通过
   - 51 个测试通过
2. `npx tsc --project electron-tsconfig.json --noEmit`
   - 通过
3. `npx tsc --project tsconfig.json --noEmit`
   - 通过
4. `git diff --check`
   - 通过

### 后续规划

1. 下一批继续复核 late agent event / terminated runId 是否已有完整测试覆盖。
2. 如果测试覆盖已足够，则转入构建打包稳定性小批次，优先不涉及 macOS speech/TTS helper 的脚本差异。
3. OpenClaw 主干重构、完整 OAuth token refresher、POPO/IM 大迁移、per-agent modelSlice 和主控台 UI 继续保持独立批次。

## 2026-05-11：terminated run tool event 防重建修复

本批次继续上一轮 late agent event / terminated runId 复核。新增测试后发现一个真实小缺口：当 OpenClaw 先发来 `agent lifecycle phase=error`，但此时本地没有 active turn 时，当前分支不会记录 `terminatedRunIds`；随后同一个 `runId` 的 late tool event 仍可能触发 `ensureActiveTurn()`，把已完成的 managed session 重新改成 running。

### 已完成内容

1. lifecycle error 入口即标记 terminated run
   - 文件：`src/main/libs/agentEngine/openclawRuntimeAdapter.ts`
   - 在 `handleAgentEvent()` 解析到 `stream=lifecycle` 且 `phase=error` 时，立即把 `runId` 加入 `terminatedRunIds`。
   - 该动作发生在 active turn 重建判断之前，因此即使当前没有 active turn，后续同 runId 的 tool / tools event 也不会重建 turn。
2. 回归测试补齐
   - 文件：`src/main/libs/agentEngine/openclawRuntimeAdapter.test.ts`
   - 新增 `terminated run tool event does not recreate a managed session turn`。
   - 覆盖 lifecycle error 先到、tool event 后到的顺序。
   - 断言 session 不会被改回 running，不新增 tool 消息，不创建 active turn，也不绑定该 runId。

### 保护边界

1. 未改变正常 active turn 内 lifecycle error fallback 的报错、abort gateway、reject turn 行为。
2. 未改变 recently closed run、manual stop、chat error 和 abort 处理策略。
3. 未触碰 OpenClaw 主干重构、POPO/IM 大迁移、per-agent modelSlice 或主控台 UI。
4. 未触碰青数品牌、工作台、managed catalog、治理链、唤醒或 TTS。

### 验证结果

1. `npm test -- --run src/main/libs/agentEngine/openclawRuntimeAdapter.test.ts`
   - 1 个测试文件通过
   - 52 个测试通过
2. `npx tsc --project electron-tsconfig.json --noEmit`
   - 通过
3. `npx tsc --project tsconfig.json --noEmit`
   - 通过
4. `git diff --check`
   - 通过

### 后续规划

1. OpenClaw runtime late event / terminated runId 小批次已基本收口，下一批建议转入构建打包稳定性差异。
2. 构建打包批次优先核对脚本层安全增强，不接会删除 macOS speech/TTS helper 的变更。
3. OpenClaw 主干重构、完整 OAuth token refresher、POPO/IM 大迁移、per-agent modelSlice 和主控台 UI 继续保持独立批次。

## 2026-05-11：构建打包脚本差异复核与保护边界确认

本批次转入构建打包稳定性区域，重点复核 `electron-builder.json`、`package.json`、OpenClaw runtime build/prune/patch 脚本，以及预提交安全检查。结论是：本轮没有直接合入 `main` 的构建脚本改动，因为多数差异会破坏当前分支明确要保护的青数品牌、macOS speech/TTS、`sql.js` 路线或 OpenClaw extension prune 安全边界。

### 已复核内容

1. `electron-builder.json`
   - `main` 会把 `productName/executableName/protocol name` 改回 `LobsterAI`，不符合青数品牌保护边界。
   - `main` 会移除 `build/generated/macos-speech` extraResources，以及麦克风/语音识别权限说明，不符合唤醒/TTS 保护边界。
   - 当前分支继续保留 `QingShuClaw` 品牌、macOS speech/TTS helper 资源和权限声明。
2. `package.json`
   - `main` 会切换到 `husky`、`better-sqlite3`、CodeMirror/Artifacts 大依赖，并移除 macOS speech/TTS helper 脚本。
   - 当前分支继续保留：
     - `prepare -> npm run setup:githooks`
     - `check:secrets`
     - `build:macos-speech-helper`
     - `build:macos-tts-helper`
     - `prepare:dev:macos-speech-host`
     - `reset:dev:macos-speech-permissions`
   - 不迁移 `better-sqlite3`，避免触发数据库主干迁移。
3. `scripts/apply-openclaw-patches.cjs`
   - 当前分支保留带 `process.pid` 的临时 patch 文件名，避免并发运行时冲突。
   - `main` 的对应差异反而弱化该点，因此不合入。
4. `scripts/prune-openclaw-runtime.cjs`
   - 当前分支 `cleanExtensionNodeModules()` 同时覆盖 `third-party-extensions` 和 `extensions`。
   - `main` 方向会弱化到只处理部分 extension 布局，因此不合入。
   - 当前分支继续保留外部 lark 优先、移除 stale qqbot、清理 third-party duplicate OpenClaw SDK 等逻辑。
5. 预提交安全检查
   - `.githooks/pre-commit` 仍指向 `node scripts/check-precommit.cjs`。
   - `npm run check:secrets` 已可扫描全部 tracked 文件。
   - 不跟随 `main` 改成 husky，避免丢掉当前分支已有的敏感信息和本地产物防线。

### 验证结果

1. `npm run check:secrets`
   - 通过
   - 全部已跟踪文件未发现明显 secret
2. `npm test -- --run src/main/libs/pruneOpenClawRuntime.test.ts src/main/libs/openclawRuntimePackaging.test.ts`
   - 2 个测试文件通过
   - 7 个测试通过
3. `npx tsc --project electron-tsconfig.json --noEmit`
   - 通过
4. `git diff --check`
   - 通过

### 后续规划

1. 构建打包区域不再为“形式对齐 main”做反向迁移；除非后续 main 有明确的安全修复，否则保持当前分支更强的青数/TTS/prune/secret hook 边界。
2. 下一批可以转入 IM/Agent 多实例剩余边角或 Provider 小差异复核。
3. OpenClaw 主干重构、完整 OAuth token refresher、POPO/IM 大迁移、per-agent modelSlice 和主控台 UI 继续保持独立批次。

## 2026-05-11：OpenClaw Provider 配置补齐 OpenAI OAuth/Codex 映射

本批次继续只合入低耦合公共 runtime/config 能力。`main` 中 OpenAI OAuth 会映射到 OpenClaw 的 `openai-codex` provider；当前分支此前已经完成 `CODEX_HOME` 隔离，但配置同步层仍会把 OpenAI OAuth 写成普通 `openai` provider。这个缺口会导致 OpenClaw gateway 无法按 ChatGPT/Codex OAuth 方式走 `openai-codex-responses`。

### 已完成内容

1. `src/main/libs/openaiCodexAuth.ts`
   - 在既有 `getCodexHomeDir()` 基础上补齐 `getCodexAuthFilePath()`。
   - 新增 `readOpenAICodexAuthFile()`，只读取应用私有 `userData/codex/auth.json`。
   - 解析 `chatgpt` 模式下的 access token、refresh token、id token、account id、email 与过期时间。
   - 缺文件或非 ChatGPT OAuth 模式时返回 `null`，不影响普通 API Key provider。
2. `src/main/libs/openclawConfigSync.ts`
   - `OpenClawProviderApi` 增加 `openai-codex-responses`。
   - provider config 的 `apiKey` 改为可选，并支持可选 `headers`。
   - 新增 `OpenAI:oauth` descriptor：
     - providerId：`openai-codex`
     - api：`openai-codex-responses`
     - baseUrl：`https://chatgpt.com/backend-api/codex`
     - 不写空 `apiKey`
   - 当 authType 为 OAuth 且 provider 为 OpenAI 时，选择 `OpenAI:oauth` descriptor。
   - 当 auth 文件中存在 account id 时写入 OpenClaw 需要的 `chatgpt-account-id` 等 headers。
3. 测试补齐
   - `openaiCodexAuth.test.ts` 覆盖 app 私有 auth 路径、合法 ChatGPT auth 文件解析、缺失/无效 auth 文件兜底。
   - `openclawConfigSync.test.ts` 覆盖 OpenAI OAuth descriptor 映射到 `openai-codex`。
   - `openclawConfigSync.runtime.test.ts` 覆盖最终写出的 `models.providers.openai-codex`，并确认不会写空 `apiKey`。

### 保护边界

1. 没有合入 `main` 的完整 OpenAI OAuth 登录 UI。
2. 没有合入 per-provider token refresher 主干。
3. 没有改青数登录、managed catalog、工作台、主控台 UI、内置治理链、唤醒或 TTS。
4. 没有覆盖当前分支更强的 Provider Registry、OpenClaw history、MCP、IM 多实例和日志脱敏保护。

### 验证结果

1. `npm test -- --run src/main/libs/openaiCodexAuth.test.ts src/main/libs/openclawConfigSync.test.ts src/main/libs/openclawConfigSync.runtime.test.ts`
   - 3 个测试文件通过
   - 47 个测试通过

### 后续规划

1. 继续筛 `origin/main` 中低耦合 Provider / OpenClaw runtime patch，优先能被单测覆盖的小闭环。
2. 构建打包稳定性可作为下一批处理，重点看不影响青数覆盖层的 electron-builder / runtime ensure 相关差异。
3. POPO/IM 大迁移、per-agent modelSlice、OpenClaw 主干重构、完整 OAuth UI/token refresher、主控台 UI 和完整 Artifacts 面板继续保持单独批次，避免影响青数品牌、工作台、治理链和唤醒/TTS。

## 2026-05-11：主窗口状态恢复公共能力补齐

本批次从 `main` 选择性合入了低耦合的 Electron 主窗口状态恢复能力，未触碰青数品牌、工作台、内置治理链、登录认证、唤醒与 TTS。

### 已合入内容

1. 新增 `src/main/windowState.ts`
   - 统一计算默认窗口尺寸、最小尺寸、存量窗口 bounds 归一化与多屏 workArea 适配。
   - 当用户切换显示器、分辨率变化或旧窗口位置已经不可见时，会把窗口恢复到当前可见工作区内。
2. 新增 `src/main/windowState.test.ts`
   - 覆盖大屏默认居中、小屏缩放、多屏恢复、过期大屏 bounds 回收、非法存储值过滤。
3. 接入 `src/main/main.ts`
   - 主窗口创建时读取 `app_window_state` 并恢复窗口位置、尺寸和最大化状态。
   - 监听 `resize`、`move`、最大化、全屏切换，在 debounce 后保存窗口状态。
   - 关闭窗口时立即 flush 当前窗口状态，避免托盘隐藏/退出场景丢失最后一次调整。

### 保护边界

1. 没有合入 `main` 的主控台 UI、大 Agent Sidebar、POPO/IM 大迁移或 OpenClaw 主干重构。
2. 没有删除任何青数覆盖层文档或治理链文件。
3. 没有改变唤醒、TTS、青数登录与 managed catalog 的运行链路。

### 后续规划

1. 继续筛 `main` 剩余差异中的纯公共修复：优先日志脱敏测试、MCP abort 行为、OpenClaw 配置防护这类小闭环。
2. 暂缓大规模 UI/IM/Artifact/SQLite backup 迁移，除非进入单独批次并逐项验收。
3. 每批合入后继续执行定向测试、renderer/main TypeScript 校验和 `git diff --check`。

## 2026-05-11：OpenClaw 历史记录元信息兼容补齐

本批次继续采用“取公共修复、不降级当前保护”的方式处理 `main` 差异。当前分支原本已经保留了更强的历史文本清洗逻辑，包括：

1. 去除 OpenClaw 注入的本地时间上下文与 `[Current user request]` 包装。
2. 从青数 managed-agent 的长模板中提取真实用户问题。
3. 过滤网关启动/重启状态类 assistant 临时消息，避免污染用户可见历史。

因此没有整文件替换为 `main` 版本，而是在现有实现上补入公共兼容能力：

1. `extractGatewayHistoryEntry()` 对 remap 为 `system` 的定时提醒消息保留原始 `timestamp`。
2. assistant usage 元信息兼容 `inputTokens`、`outputTokens`、`cacheReadTokens` 字段别名，统一投影为 `input`、`output`、`cacheRead`。
3. 补齐 `NO_REPLY` 静默回复过滤测试，确保 assistant/system 的静默 token 不进入历史展示，但用户真实输入 `NO_REPLY` 不被误删。
4. 补齐 `NO_REPLY` streaming prefix 测试，保护流式阶段的前缀识别逻辑。

### 保护边界

1. 未删除当前分支已有的 managed-agent prompt 清洗逻辑。
2. 未删除当前分支已有的网关重启临时状态过滤逻辑。
3. 未引入 `main` 中会削弱当前历史展示保护的测试删除或实现简化。

### 后续规划

1. 下一批继续筛 OpenClaw 配置防护与 MCP abort 行为，优先选择已有测试能覆盖的小改。
2. App update、完整 Artifact 面板、Agent Sidebar、POPO/IM 大迁移仍保持单独批次，不和公共 bugfix 混合。

## 2026-05-11：OpenClaw Codex 认证目录隔离

本批次从 `main` 的 OpenClaw runtime patch 中摘取了低耦合的认证隔离点，没有合入完整 OpenAI OAuth 登录 UI/认证主干。

### 已合入内容

1. 新增 `src/main/libs/openaiCodexAuth.ts`
   - 提供 `getCodexHomeDir()`。
   - 将 OpenClaw/Codex auth 目录固定到应用 `userData/codex` 下。
2. `src/main/libs/openclawEngineManager.ts`
   - 启动 OpenClaw gateway 时注入 `CODEX_HOME=<app userData>/codex`。
   - 避免 OpenClaw 的 OpenAI Codex provider 读写用户真实 `~/.codex/auth.json`，降低和本机 Codex CLI 登录态互相覆盖的风险。
3. 新增 `src/main/libs/openaiCodexAuth.test.ts`
   - 验证 `CODEX_HOME` 真源目录位于应用 `userData` 内。

### 保护边界

1. 没有引入 `main` 的完整 OpenAI OAuth 登录 UI 和 token refresher 主干。
2. 没有改变青数登录、managed catalog、工作台或唤醒/TTS。
3. 没有改变现有 provider/model 配置 UI，仅为 OpenClaw 子进程提供更安全的环境变量。

### 后续规划

1. OpenAI/Codex OAuth UI、per-provider token refresher 仍作为单独认证批次处理。
2. 下一轮继续筛 `main` 的纯 runtime bugfix；如无低耦合候选，应进入阶段性验证而不是硬合高耦合迁移。

## 2026-05-11：Agent 工作目录数据链路补齐

本批次继续按“保护青数品牌、工作台、内置治理链、唤醒/TTS，优先合入低耦合公共能力”的策略推进。对比 `main` 后确认，当前分支的 Agent 设置侧已经出现工作目录相关 UI/类型痕迹，但 main 进程持久化、IPC 类型和会话启动默认目录仍未闭环，导致后续即使 UI 传入 `workingDirectory` 也无法稳定保存和消费。

已完成内容：

1. `agents` 表补齐 `working_directory`
   - 新建表 schema 增加 `working_directory TEXT NOT NULL DEFAULT ''`
   - 旧库启动时自动补列
   - 从旧全局 `cowork_config.workingDirectory` 一次性回填到空的 Agent 工作目录
   - 回填顺序调整为先确保默认 `main` Agent 存在，再执行回填，避免首次升级时漏掉 `main`
2. Agent CRUD 补齐工作目录
   - `CreateAgentRequest / UpdateAgentRequest / Agent` 增加 `workingDirectory`
   - `createAgent()` 写入 `working_directory`
   - `updateAgent()` 支持更新 `working_directory`
   - `mapAgentRow()` 读取并向 renderer 返回
3. IPC 与 renderer 类型补齐
   - preload `agents.create/update` 支持 `workingDirectory`
   - renderer `Agent`、`AgentIpcRecord`、agent slice、agent service 映射补齐字段
   - `agentPersistedDraft` 会 trim 并透传工作目录
4. 会话启动默认目录与 `main` 对齐
   - 新增 `resolveAgentDefaultWorkingDirectory()`：优先 Agent 自己的 `workingDirectory`，为空再回退全局工作目录
   - 新增 `resolveSessionWorkingDirectory()`：显式传入 `cwd` 时仍优先尊重调用方
   - `cowork:session:start` 使用该解析逻辑创建 session
   - OpenClaw channel/main/cron session sync 支持按 `agentId` 取默认目录，不再只能使用全局工作目录
5. 青数治理链兼容
   - managed Agent 投影只补 `workingDirectory: ''`，不开放本地目录编辑，不改变只读/准入/额外 skill 追加逻辑
   - OpenClaw config sync 的兜底 main agent 也补空字段，避免类型断点

本批次刻意未合入内容：

1. 未引入 `main` 的 Agent pin/pinOrder 与列表排序大迁移
2. 未引入 `better-sqlite3` 主干迁移
3. 未重做 Agent 创建/编辑弹窗布局
4. 未改青数工作台主控台 UI、治理链、唤醒/TTS

验证结果：

1. `npm test -- --run src/main/coworkStore.agent.test.ts src/renderer/components/agent/agentPersistedDraft.test.ts src/main/libs/openclawChannelSessionSync.test.ts`
   - 3 个测试文件通过
   - 19 个测试通过
2. `npx tsc --project tsconfig.json --noEmit`
   - 通过
3. `npx tsc --project electron-tsconfig.json --noEmit`
   - 通过

后续规划：

1. 继续筛 `origin/main` 剩余低耦合公共能力，优先处理“已有 UI/类型痕迹但数据链路未闭环”的小块。
2. Artifacts 下一步只考虑轻量入口或 badge，不直接合入完整右侧 panel，避免冲击当前对话窗口和主控台布局。
3. 定时任务 DateInput / TaskForm 大 UI 重写继续暂缓，只保留解析和数据层测试补强。
4. POPO/IM 大迁移、per-agent modelSlice、OpenClaw 主干重构、OAuth token refresher 继续保持单独批次规划，避免影响青数品牌、工作台、治理链和唤醒/TTS。

## 2026-05-11：消息元信息格式化工具补齐

本批次继续选择低耦合公共能力合入。`main` 中新增的 `tokenFormat` 属于纯展示工具，不牵动业务状态、OpenClaw runtime 或青数治理链，因此作为独立小批次接入。

已完成内容：

1. 新增 `src/renderer/utils/tokenFormat.ts`
   - `formatTokenCount()`：将大 token 数格式化为 `k / M`
   - `formatMessageTime()`：今天只显示时间，同年显示 `MM/DD HH:mm`，跨年显示完整日期
   - `formatMessageDateTime()`：稳定输出完整日期时间
2. 新增 `src/renderer/utils/tokenFormat.test.ts`
   - 覆盖 1000 以下、千级、百万级 token 格式化
   - 覆盖当天、同年、跨年的消息时间格式化
3. 对话消息元信息使用 token 简写
   - `CoworkSessionDetail` 中 assistant 元信息的 `Tokens`、`Cache read` 改为使用 `formatTokenCount()`
   - 大上下文或长会话时减少元信息区域的视觉噪声

本批次刻意未合入内容：

1. 未改对话窗口布局
2. 未接入 main 的完整 artifacts panel
3. 未迁移 Agent 头像/侧栏 UI 组件
4. 未触碰青数主控台、治理链、唤醒/TTS

验证结果：

1. `npm test -- --run src/renderer/utils/tokenFormat.test.ts src/main/coworkStore.agent.test.ts src/renderer/components/agent/agentPersistedDraft.test.ts src/main/libs/openclawChannelSessionSync.test.ts`
   - 4 个测试文件通过
   - 26 个测试通过
2. `npx tsc --project tsconfig.json --noEmit`
   - 通过
3. `npx tsc --project electron-tsconfig.json --noEmit`
   - 通过

后续规划：

1. 继续优先筛纯工具、解析、校验、展示格式化类公共 bugfix。
2. `userMessageDisplay` 当前分支已经具备 main 的核心 OpenClaw/NIM/Feishu 媒体展示行为，差异主要是注释和测试命名，暂不为“形式一致”扩大改动。
3. Agent 头像组件、Agent 工作目录 UI 字段、Artifacts panel 都属于 UI 扩面，后续按单独小批次评估。

## 2026-05-11：OpenClaw Agent 配置补齐 per-agent cwd

本批次承接上一轮 Agent `workingDirectory` 数据链路补齐。既然 Agent 已经能持久化工作目录，新建会话也会优先使用 Agent 自己的工作目录，那么 OpenClaw runtime 生成的 agent 配置也需要同步输出对应 `cwd`，否则 OpenClaw 侧仍可能按默认目录运行，形成“本地 session cwd 与 gateway agent cwd 不一致”的隐性漂移。

已完成内容：

1. `buildAgentEntry()` 输出 `cwd`
   - 当 `agent.workingDirectory` 非空时，写入 `cwd: path.resolve(agent.workingDirectory.trim())`
   - 空目录不写入，保持原有默认行为
2. 测试补齐
   - `openclawAgentModels.test.ts` 增加“配置工作目录的 agent 输出显式 cwd”用例
   - 已为测试对象补齐 `workingDirectory` 字段，避免类型与真实 Agent 结构漂移

本批次刻意未合入内容：

1. 未合入 main 的 shared Agent avatar 体系
2. 未改 Agent 头像 UI、Agent 侧栏、Agent 创建/编辑弹窗布局
3. 未引入 OpenClaw 主干重构
4. 未改变青数 managed Agent 只读治理逻辑

验证结果：

1. `npm test -- --run src/main/libs/openclawAgentModels.test.ts src/main/coworkStore.agent.test.ts src/main/libs/openclawChannelSessionSync.test.ts`
   - 3 个测试文件通过
   - 32 个测试通过
2. `npx tsc --project electron-tsconfig.json --noEmit`
   - 通过
3. `npx tsc --project tsconfig.json --noEmit`
   - 通过

后续规划：

1. Provider 常量当前分支已保留更稳的 `getOpenClawProviderId()` 空值/trim 兜底，不直接照 main 覆盖。
2. shared Agent avatar 体系需要和 Agent UI 一起评估，暂不作为纯 runtime patch 混入。
3. 继续筛小型 runtime/config bugfix，优先选择能用单元测试验证且不触碰青数保留域的内容。

## 补充：定时任务 IM 多实例与运行记录链小步收敛

本轮继续按“只收公共能力和 bugfix，不冲击青数品牌、工作台、内置治理链、唤醒/TTS”的策略推进，重点复核 `ScheduledTasks` 与 IM 多实例通道的衔接。

### 已确认无需回退到 main 的内容

1. `src/renderer/components/scheduledTasks/TaskRunHistory.tsx`
   - 当前分支与 `origin/main` 内容一致。
   - 本轮不做重复迁移。
2. `src/renderer/components/scheduledTasks/TaskForm.tsx`
   - 当前分支已经比 `origin/main` 更适配多实例 IM。
   - 表单状态包含 `notifyAccountId`。
   - 选中多实例通道时会同时写入 `notifyChannel`、`notifyAccountId`，并清空旧 `notifyTo`。
   - 拉取会话列表时会把 `accountId / filterAccountId` 传给 `listChannelConversations()`。
   - 保存任务时会把实例信息写入 `delivery.accountId`。
   - 因此这里不应直接用 `main` 覆盖，否则会退回更弱的单通道/弱多实例逻辑。

### 本轮代码修复

1. 清理 `src/main/ipcHandlers/scheduledTask/handlers.ts` 中 `scheduledTask:listChannelConversations` 的临时 info 级调试日志。
   - 删除了 channel、platform、mappings、conversations 的逐次 `console.log`。
   - 避免打开定时任务页面或切换 IM 会话时刷生产日志。
   - 避免把 IM 会话 ID / coworkSessionId 这类排障标识反复打印到普通日志。
   - 保留原有平台解析、`accountId / filterAccountId` 过滤和错误返回逻辑。

### 本轮原则校验

1. KISS
   - 只删除噪声日志，不改 handler 的业务分支。
2. YAGNI
   - 未新增新的日志开关或抽象层，避免为了调试残留引入额外配置。
3. SOLID
   - 继续保持 `TaskForm` 负责 UI 状态，`handlers.ts` 负责 IPC 归一化，未混入跨层职责。
4. DRY
   - 保留现有 `accountId / filterAccountId` 复用链路，没有再复制一套多实例筛选逻辑。

### 后续规划

1. 继续做 `ScheduledTasks` 剩余公共链路复核：
   - `AllRunsHistory / ScheduledTasksView / TaskDetail / TaskList`
   - 重点确认是否存在 main 的 bugfix 当前分支还缺失。
2. 继续筛 `OpenClaw runtime patch / provider 配置` 的低风险差异：
   - 只收配置归一化、错误提示、启动稳定性的小补丁。
   - 暂不碰 OpenClaw 主干重构。
3. 单独规划高耦合批次：
   - POPO/IM 大迁移
   - per-agent `modelSlice`
   - OpenAI Codex token refresher
   - OpenClaw 主干重构

## 补充：定时任务详情补齐模型展示

本轮继续复核 `ScheduledTasks` 剩余 UI 链路，并按“公共能力优先、青数工作台视觉不回退”的原则做小步合入。

### 本轮复核结论

1. `AllRunsHistory.tsx`
   - 与 `origin/main` 的差异主要是列表视觉形态、状态图标、卡片密度和加载更多按钮样式。
   - 当前分支已经有自己的青数工作台承接样式，不适合直接覆盖。
2. `ScheduledTasksView.tsx`
   - 与 `origin/main` 的差异主要是 tab 样式、按钮样式、未保存确认的实现命名和局部导航处理。
   - 当前分支已经保留了未保存确认逻辑，本轮不做视觉回退。
3. `TaskList.tsx`
   - 与 `origin/main` 的差异主要是从表格行切到卡片列表、状态徽标、运行时间展示和开关样式。
   - 该部分属于主控台/工作台 UI 体验差异，暂不直接搬 main。
4. `RunSessionModal.tsx`
   - 当前分支已包含更适合 cron transcript 的加载顺序 helper：
     - 对 `...:run:{uuid}:...` 形态的 `sessionKey` 优先走 OpenClaw transient session。
     - 再回退本地 `sessionId`。
   - 该能力已比 main 更贴近当前分支的定时任务运行记录恢复场景，本轮不回退。

### 本轮代码更新

1. `src/renderer/components/scheduledTasks/TaskDetail.tsx`
   - 补齐 `main` 中已有的定时任务详情“模型”展示能力。
   - 只读展示 `agentTurn` payload 中的 `model`，不改变任务创建、更新或执行行为。
   - 当前分支没有照搬 main 的裸 `modelId` 匹配方式，而是复用 `resolveOpenClawModelRef()`：
     - 支持 `provider/model` 完整引用。
     - 支持旧 `openai/...` 到 `openai-codex/...` 的迁移兼容。
     - 支持唯一 model id fallback。
     - 找不到模型时保留原始 model ref 展示，便于排障。
2. `src/renderer/services/i18n.ts`
   - 新增 `scheduledTasksDetailModel` 中英文文案：
     - 中文：`模型`
     - 英文：`Model`

### 本轮原则校验

1. KISS
   - 只补详情页只读字段，不改调度数据模型和执行链路。
2. YAGNI
   - 不为列表 UI 差异做大改版，不提前迁移 main 的卡片式任务列表。
3. SOLID
   - 模型引用解析继续由 `openclawModelRef.ts` 负责，详情页只消费解析结果。
4. DRY
   - 不复制 main 的裸 id 查找逻辑，复用当前分支已有的统一解析 helper。

### 后续规划

1. 继续复核 `ScheduledTasks` 数据层：
   - `cronJobService / metaStore / migrate / reminderText / enginePrompt`
   - 优先找 main 的 bugfix 或测试补强，避免 UI 大迁移。
2. 然后进入 `OpenClaw runtime patch / gateway lifecycle` 的低风险剩余差异：
   - 只收启动稳定性、错误提示、transcript 恢复、小型 config guard。
3. 高耦合内容仍单独批次：
   - POPO/IM UI 大迁移
   - per-agent `modelSlice`
   - OpenAI Codex per-provider token refresher
   - OpenClaw 主干重构

## 补充：定时任务数据层复核与多实例通道类型注释

本轮继续复核 `ScheduledTasks` 数据层，重点检查 `cronJobService / metaStore / migrate / reminderText / enginePrompt / types` 与 `origin/main` 的差异。结论是：这一批大部分差异不能直接照搬，需要保留当前分支更贴合青数运行环境的实现。

### 本轮复核结论

1. `cronJobService.ts`
   - 行为差异很小，主要是变量命名、注释和已注释掉的 `ensureGatewayReady()`。
   - 当前分支已经保留“不为了轮询任务状态而启动 gateway”的行为，并有测试覆盖。
   - 本轮不做重复改动。
2. `metaStore.ts / migrate.ts`
   - `origin/main` 已切到 `better-sqlite3` 风格的 `prepare().get()/all()/run()`。
   - 当前分支仍使用 `sql.js`，对应实现必须保留 `db.exec()` / `stmt.step()` / `stmt.free()` 形态。
   - 直接搬 main 会破坏当前存储链路，不符合本批次目标。
3. `enginePrompt.ts`
   - 当前分支已经比 main 更安全：
     - `openclaw` engine 才输出 native `cron` 使用说明。
     - `yd_cowork` engine 会明确提示定时任务只支持 OpenClaw，并禁止在该 engine 内创建/更新/删除定时任务。
   - 这能避免 legacy engine 误诱导模型调用不存在的 cron 能力，本轮不回退。
4. `reminderText.ts`
   - 当前分支已经支持标准 reminder prompt、legacy `System:` 包装和简单 `⏰` 文本。
   - 测试覆盖较完整，本轮不重复搬运。

### 本轮代码更新

1. `src/scheduledTask/types.ts`
   - 补回 `ScheduledTaskChannelOption.accountId` 与 `filterAccountId` 的语义注释。
   - 明确：
     - `accountId` 是多实例平台保存到 `delivery.accountId` 的稳定实例选择器。
     - `filterAccountId` 仅用于查询本地会话映射，可与 OpenClaw 投递时需要的 accountId 不同。
   - 这不改变运行时行为，但能保护后续 IM 多实例和定时任务联动继续合 main 时不误删边界。

### 本轮原则校验

1. KISS
   - 只补类型文档，不改已稳定的数据迁移和 cron 映射逻辑。
2. YAGNI
   - 不为了对齐 main 提前迁移 `better-sqlite3`。
3. SOLID
   - 继续保持存储适配、engine prompt、通道选项类型各自职责清晰。
4. DRY
   - 通过共享类型注释把多实例语义写在一个位置，避免 UI、IPC、helper 各自猜测字段用途。

### 后续规划

1. 转入 `OpenClaw runtime patch / gateway lifecycle` 的低风险剩余差异：
   - 优先复核 `openclawConfigGuards / openclawRuntimePackaging / pruneOpenClawRuntime / openclawTranscript`。
   - 只收测试覆盖和小型稳定性补丁。
2. 继续避开高耦合主干：
   - OpenClaw 主干大重构
   - SQLite 到 `better-sqlite3` 的存储迁移
   - POPO/IM UI 整包迁移
   - per-agent `modelSlice`
   - OpenAI Codex token refresher

## 补充：OpenClaw runtime / gateway lifecycle 低风险复核

本轮转入 `OpenClaw runtime patch / gateway lifecycle` 区域，重点复核 `openclawConfigGuards / openclawRuntimePackaging / pruneOpenClawRuntime / openclawTranscript / openclawEngineManager / openclawConfigSync / openclawHistory / openclawChannelSessionSync` 与 `origin/main` 的差异。

### 本轮复核结论

1. `openclawConfigGuards.ts`
   - 当前分支已有 `enforceLegacyFeishuPluginDisabled()`。
   - `openclawConfigSync.ts` 在最终写入 `openclaw.json` 前调用该 guard。
   - 因此旧版 `plugins.entries.feishu.enabled=true` 会被持续强制改成 `false`，避免旧飞书插件工具失败后诱导模型修改配置或触发 gateway 重启。
2. `openclawEngineManager.ts`
   - 当前分支已经覆盖多项 runtime 稳定性补丁：
     - gateway client entry 优先 `plugin-sdk/gateway-runtime.js`。
     - fallback 会探测 `method-scopes*.js` / `client*.js` 是否真实导出 `GatewayClient`。
     - gateway 启动失败后会 `await stopGatewayProcess(child)`，避免孤儿进程残留。
     - 启动前会删除不被 schema 支持的 `agents.defaults.cwd`。
     - 启用 `OPENCLAW_SKIP_MODEL_PRICING`、`OPENCLAW_DISABLE_BONJOUR`、V8 compile cache 和 stale bundled plugin cleanup。
   - 当前分支在这些点上已经不落后于 main，部分能力还更完整，本轮不做重复搬运。
3. `openclawConfigSync.ts`
   - 当前分支保留青数覆盖层和当前运行时需要的配置：
     - `buildOpenClawSessionConfig()` 本地实现。
     - `memorySearch` 只在 embedding 开启时写入，避免 `{ enabled: false }` 造成工具移除。
     - `mcp-bridge / ask-user-question / qwen-portal-auth` 等插件条件写入。
     - 多实例 IM channel 配置仍按当前分支已接通的平台保留。
   - `origin/main` 的部分差异涉及 OpenAI Codex OAuth、Email channel、POPO/IM 大迁移和主干重构，不适合混入本批次。
4. `openclawHistory.ts`
   - 当前分支已经包含 main 没有的历史文本修复：
     - 剥离 `[Current user request]` 和 managed-agent 包装模板，只保留真实用户问题。
     - 过滤 “网关正在重启中。等待重启完成后...” 这类 transient assistant 状态，避免错误写入历史对话。
     - 保留 assistant 正常解释 `[Current user request]` 标记时的输出，不误删真实回答。
     - 把定时提醒 prompt 转成 system message，避免普通用户消息污染历史。
   - 这些修复直接对应之前“对话中网关重启提示体验差”和“历史消息展示错乱”的问题，本轮不回退。
5. `openclawChannelSessionSync.ts`
   - 当前分支继续保留 managed sessionKey 带冒号解析、per-account conversationId、实例级 agent binding 和当前多实例平台集合。
   - `origin/main` 的差异里包含 email 平台、日志格式和部分高耦合 IM 迁移，不直接照搬。

### 本轮代码策略

本轮没有修改运行时代码。原因是复核结果显示当前分支在这些 OpenClaw 稳定性点上已经具备目标能力，继续硬搬 main 反而可能带来以下风险：

1. 冲掉青数多实例 IM 与 managed agent 的现有接线。
2. 引入 OpenAI Codex OAuth/token refresher 的认证路径变化。
3. 把 Email/POPO/IM 大迁移提前混入 runtime 小批次。
4. 回退 `openclawHistory` 中针对当前分支真实问题补过的历史清洗逻辑。

### 本轮原则校验

1. KISS
   - 已具备等价或更强能力的文件不重复改动。
2. YAGNI
   - 暂不为“差异归零”迁移 OpenClaw 主干、Email channel 或 Codex OAuth。
3. SOLID
   - 保持 runtime lifecycle、config sync、history normalization、channel session sync 各自边界。
4. DRY
   - 复用现有 guard/test/helper，不新增重复配置修复路径。

### 后续规划

1. 继续 OpenClaw 小批次复核：
   - `agentEngine/openclawRuntimeAdapter.ts`
   - `openclawTranscript.ts`
   - `openclawHistory.ts` 的调用链与 session reconcile 行为
2. 优先只收：
   - transcript 恢复可靠性
   - gateway client reconnect 小补丁
   - session patch / modelOverride / thinkingLevel 的低风险透传
3. 继续暂缓：
   - OpenClaw 主干大重构
   - per-agent `modelSlice`
   - OpenAI Codex per-provider token refresher
   - POPO/IM UI 大迁移
   - SQLite / `better-sqlite3` 存储迁移

## 补充：OpenClaw GatewayClient 初始握手容错

本轮继续复核 `agentEngine/openclawRuntimeAdapter.ts` 与 `openclawTranscript.ts`，优先处理 gateway reconnect、transcript 恢复与 session patch 相关的低风险差异。

### 本轮复核结论

1. `openclawTranscript.ts`
   - 当前分支新增了独立 transcript parser。
   - 相比 `origin/main` 里只读 `.jsonl.deleted.*` 文本的简单 fallback，当前实现能解析：
     - `assistant` 文本
     - thinking 内容
     - `tool_use`
     - `tool_result`
     - tool call arguments
     - active transcript 与 deleted transcript
   - `openclawRuntimeAdapter.ts` 会优先调用 `readTranscriptSessionByKey()`，再回退 `chat.history`，这更适合定时任务/运行记录详情页恢复完整历史。
2. `session patch / modelOverride`
   - 当前分支已经保留：
     - IM channel session patch 使用真实 OpenClaw sessionKey。
     - 缺失真实 channel sessionKey 时拒绝 patch，避免误 patch 到 managed fallback key。
     - session-level `modelOverride` 不被 provider migration 重写。
     - run turn 前会先 `ensureSessionModelForTurn()`。
   - 本轮不改这条链路。
3. `history reconcile`
   - 当前分支已具备：
     - transient gateway status 过滤。
     - channel history 可能窗口化时避免缩短本地历史。
     - managed/system prompt 注入内容去重。
   - 不回退到 main 的较弱实现。

### 本轮代码更新

1. `src/main/libs/agentEngine/openclawRuntimeAdapter.ts`
   - 合入 GatewayClient 初始握手阶段的容错策略。
   - `onConnectError` 不再对所有错误立即 reject：
     - `auth / denied / forbidden` 等鉴权类错误仍然 fail fast。
     - 插件加载期、challenge 超时、短暂断连等 transient 错误会等待 GatewayClient 内部自动重连。
   - `onClose` 在 handshake 尚未完成时不再清空 `pendingGatewayClient` 并立即 reject：
     - 保留 pending client，等待内部 reconnect 后触发 `onHelloOk`。
     - 最终是否失败仍由外层 `GATEWAY_READY_TIMEOUT_MS = 60_000` 统一兜底。

### 用户体验影响

这个补丁主要减少“网关刚启动/插件还在加载时，前端过早进入失败或重启提示”的概率。它不改变握手成功后的断线处理；真正连接成功后如果 gateway 断开，仍会按现有逻辑标记 active session error、清理 turn 并进入 reconnect。

### 本轮原则校验

1. KISS
   - 只改初始握手回调，不改 reconnect 调度和 session 运行逻辑。
2. YAGNI
   - 不引入新的重试队列或额外状态机，继续复用 GatewayClient 自带 reconnect 与外层 timeout。
3. SOLID
   - GatewayClient 负责底层重连，adapter 只判断哪些错误需要立即失败。
4. DRY
   - 不重复实现另一个 reconnect 机制，沿用已有 `waitWithTimeout` 兜底。

### 后续规划

1. 继续复核 `openclawRuntimeAdapter.ts` 剩余低风险点：
   - stop cooldown 对 late event / permission popup 的抑制是否仍完整。
   - duplicate user text sync 是否需要从 Set 回到 count map。
   - `thinkingLevel` / session patch 透传是否还有 main 小补丁可收。
2. 若 runtime adapter 无更多安全小补丁，转入 `Cowork / message rendering` 的公共 bugfix 复核：
   - 只看历史展示、输入历史、斜杠指令等行为层。
   - 不搬主控台 UI。
3. 高耦合内容继续单独批次：
   - OpenClaw 主干重构
   - per-agent `modelSlice`
   - OpenAI Codex token refresher
   - POPO/IM UI 大迁移

## 补充：渠道会话重复用户文本同步修复

本轮继续复核 `openclawRuntimeAdapter.ts` 剩余低风险点，重点看 IM/channel 会话历史同步、stop cooldown 和 session patch。最终选择合入一个可验证的小 bugfix：重复用户文本同步不能用 `Set` 去重。

### 问题背景

`syncChannelUserMessages()` 会从 OpenClaw `chat.history` 中同步渠道来源的用户消息，确保 IM/飞书/钉钉/POPO 等外部会话在本地对话窗口里显示完整。

旧逻辑使用 `Set<text>` 判断本地是否已存在用户消息。这会把重复文本折叠掉，例如：

1. 用户第一次发：`你好`
2. 用户第二次又发：`你好`
3. OpenClaw history 中有两条 `你好`
4. 本地已有一条 `你好` 时，第二条会被误判为“已存在”，从而不再同步

这会导致 IM/channel 会话里出现“历史对话看起来少一轮”的问题。

### 本轮代码更新

1. `src/main/libs/agentEngine/openclawRuntimeAdapter.ts`
   - 将 `syncChannelUserMessages()` 的本地用户文本去重从 `Set` 改为 `Map<string, number>` 计数。
   - repair range 中按次数消费已有本地消息：
     - 本地已有一次 `你好`，history 中第一条 `你好` 消费掉这一次。
     - history 中第二条 `你好` 没有剩余计数，会被识别为缺失并补写。
   - normal range 继续视作确定新增消息，不再用文本 Set 误杀。
2. `src/main/libs/agentEngine/openclawRuntimeAdapter.test.ts`
   - 新增回归测试：
     - 本地已有一条 `你好`。
     - gateway history 返回两条 `你好`。
     - prefetch 后本地应保留两条用户消息。

### 本轮暂不改动

1. stop cooldown / permission popup
   - 当前分支已经在 active turn 创建处抑制 stop cooldown 内的 late event。
   - 权限弹窗路径还需要更细分 delete command 与 channel session 场景，本轮先不扩大修改面。
2. `thinkingLevel`
   - 类型层已有 `OpenClawSessionPatch.thinkingLevel`，但 UI 暴露和 runtime patch 入口需要继续核对后再动。

### 本轮原则校验

1. KISS
   - 只把去重结构从 Set 换成计数 Map，逻辑局部且可测试。
2. YAGNI
   - 不重写 channel sync/reconcile 主流程。
3. SOLID
   - 仍由 runtime adapter 负责渠道历史同步，store 只负责消息写入。
4. DRY
   - 不新增另一套同步路径，只修正现有路径的重复文本判定。

### 后续规划

1. 继续复核 `openclawRuntimeAdapter.ts`：
   - stop cooldown 期间 delete-command permission popup 是否仍会误弹。
   - `thinkingLevel` 是否已从 renderer 设置传到 `sessions.patch`。
   - `session.sendPolicy / responseUsage` 是否需要补低风险测试。
2. 然后转入 `Cowork / message rendering` 行为层：
   - 历史展示完整性。
   - 输入历史上下键。
   - slash command 入口。
   - 不搬主控台 UI。

## 补充：OpenClaw 停止冷却期权限弹窗抑制

本轮继续沿 `openclawRuntimeAdapter.ts` 做低风险公共能力对齐，重点吸收 `main` 中“用户已停止会话后，不应再弹出过期权限弹窗”的体验修复。

### 本轮复核结论

1. 当前分支已经有 `isSessionInStopCooldown()`，并且在 `ensureActiveTurn()` 中能抑制 stop cooldown 内的 late event。
2. 但 `handleApprovalRequested()` 中，删除类命令仍可能在用户点击停止后继续发出权限弹窗。
3. `origin/main` 也有相关抑制意图，但其 auto-approve 分支没有立即 `return`，如果原样照搬到当前分支，反而可能让非删除命令在自动放行后继续走权限弹窗路径。
4. 因此本轮只摘取行为目标，不直接覆盖实现：保留当前分支 auto-approve 后立即返回的逻辑，只在删除类命令进入人工审批前增加 stop cooldown 判断。

### 本轮代码更新

1. `src/main/libs/agentEngine/openclawRuntimeAdapter.ts`
   - 在 `handleApprovalRequested()` 中，删除类命令进入 `permissionRequest` 之前先检查 `isSessionInStopCooldown(sessionId)`。
   - 如果会话仍在用户手动停止后的冷却期内，直接忽略这条 late approval request。
   - 非删除命令和 channel session 的 auto-approve 行为保持不变。
2. `src/main/libs/agentEngine/openclawRuntimeAdapter.test.ts`
   - 新增回归测试：stop cooldown 内的 `rm -rf ...` approval request 不会 emit `permissionRequest`。
   - 新增反向测试：不在 stop cooldown 内的删除命令仍会正常进入权限流程。

### 用户体验影响

当用户停止正在运行的 OpenClaw 会话后，如果 gateway 或插件晚到一个删除类命令审批事件，前端不会再弹出一个看起来“会话明明停了却又要确认”的权限框。这样可以减少对话被停止后的误唤醒、误弹窗和状态错乱感。

### 本轮原则校验

1. KISS
   - 只在权限入口增加一处冷却期判断，没有改 approval 状态机。
2. YAGNI
   - 不引入额外队列，也不重写 OpenClaw approval 机制。
3. SOLID
   - stop cooldown 仍由 runtime adapter 统一判断，UI 只接收真正需要展示的权限请求。
4. DRY
   - 复用已有 `isSessionInStopCooldown()`，没有新增第二套停止状态判断。

### 本轮验证

1. `npm test -- --run src/main/libs/agentEngine/openclawRuntimeAdapter.test.ts`
   - 1 个测试文件通过。
   - 37 条测试通过。

### 后续规划

1. 继续做 `OpenClaw session patch` 字段透传核对：
   - `thinkingLevel`
   - `sendPolicy`
   - `responseUsage`
   - 只补低风险测试或透传，不新增 UI。
2. 然后转入 `Cowork / message rendering` 行为层：
   - 历史展示完整性。
   - 输入历史上下键。
   - slash command 入口。
3. 高耦合内容仍单独排期：
   - OpenClaw 主干重构。
   - per-agent `modelSlice`。
   - POPO/IM UI 大迁移。
   - OpenAI Codex token refresher。

## 补充：OpenClaw session patch 策略字段透传回归保护

本轮继续执行上一节规划，核对 `OpenClawSessionPatch` 在类型、preload、renderer service、main IPC 和 runtime adapter 五层的真实接线。

### 本轮复核结论

1. 类型层已经具备公共字段：
   - `model`
   - `thinkingLevel`
   - `reasoningLevel`
   - `elevatedLevel`
   - `responseUsage`
   - `sendPolicy`
2. `preload.ts` 与 `renderer/types/electron.d.ts` 已暴露同样字段。
3. `main.ts` 的 `OpenClawSessionIpc.Patch` 会对白名单字段做净化：
   - `responseUsage` 只允许 `off / tokens / full / null`
   - `sendPolicy` 只允许 `allow / deny / null`
4. `openclawRuntimeAdapter.patchSession()` 已经会把非 `model` 字段直接透传到 `sessions.patch`。
5. `origin/main` 将 patch 净化拆成了 helper；当前分支是内联净化，行为已接近，且当前分支对枚举值更严格。本轮不为重构形式制造额外 diff。

### 本轮代码更新

1. `src/main/libs/agentEngine/openclawRuntimeAdapter.test.ts`
   - 新增回归测试，覆盖非模型策略字段透传：
     - `thinkingLevel`
     - `reasoningLevel`
     - `elevatedLevel`
     - `responseUsage`
     - `sendPolicy`
   - 测试确认这些字段会直接随真实 IM channel sessionKey 调用 `sessions.patch`。
   - 测试同时确认非模型 patch 不会误触发 `normalizeModelRef()`，避免被模型 patch 队列影响。

### 本轮没有改 runtime 逻辑的原因

1. 当前实现已经具备目标行为。
2. 直接把 `main` 的 helper 重构搬过来只会改变代码形态，不提升当前可验收能力。
3. 保留当前更严格的枚举净化能降低错误 patch 写入 OpenClaw gateway 的风险。

### 本轮原则校验

1. KISS
   - 不做无收益重构，只补行为回归测试。
2. YAGNI
   - 不新增 thinkingLevel UI 入口，也不改变现有模型选择器。
3. SOLID
   - IPC 继续负责净化输入，runtime adapter 继续负责转发到 gateway。
4. DRY
   - 不复制 main 的另一套 helper，避免和当前内联白名单形成双重真源。

### 本轮验证

1. `npm test -- --run src/main/libs/agentEngine/openclawRuntimeAdapter.test.ts`
   - 1 个测试文件通过。
   - 38 条测试通过。

### 后续规划

1. OpenClaw runtime 小补丁区暂告一段落，下一步转入 `Cowork / message rendering` 行为层。
2. 优先核对：
   - 当前分支历史消息展示数量与 main 的差异。
   - 输入框上下键历史输入能力。
   - slash command 入口能力。
3. 仍然不搬主控台 UI、不改青数工作台、不碰唤醒/TTS 覆盖层。

## 补充：Cowork 消息展示与输入能力核对

本轮转入 `Cowork / message rendering` 行为层，重点核对用户前面反复提到的三个点：

1. 对话窗口历史展示完整性。
2. 输入框上下键历史输入能力。
3. 输入框 slash command 入口能力。

### 本轮复核结论

1. 历史展示数量
   - 当前 `CoworkSessionDetail.tsx` 已经不再使用 `LazyRenderTurn` 包裹每个 turn。
   - 实际渲染路径是：
     - `currentSession.messages`
     - `buildDisplayItems(messages)`
     - `buildConversationTurns(displayItems)`
     - `turns.map(...)` 直接渲染全部 turn
   - 因此当前分支已经不存在“最近只常驻 3/8/16 个 turn 导致向上看不到历史”的前端渲染限制。
   - 若用户仍遇到某个 session 历史缺失，优先继续查本地 SQLite 数据源、OpenClaw transcript 恢复、`reconcileWithHistory()` 是否被窗口化 `chat.history` 覆盖，而不是再改前端 turn 常驻窗口。
2. turn 组装逻辑
   - 当前分支新增了 `coworkConversationTurns.ts`，这是 main 没有的增强。
   - 它会把 `tool_use / tool_result` 按 `toolUseId` 或相邻关系归组，并把 assistant-only 历史放进 orphan turn。
   - 这正是为了避免工具调用和历史消息展示错乱，不能退回 main 的内联旧逻辑。
3. 输入历史上下键
   - 当前分支 `CoworkPromptInput.tsx` 没有 `ArrowUp / ArrowDown` 历史输入逻辑。
   - `origin/main` 也没有这项能力。
   - 所以它不是“main 已有但当前未拉齐”的功能；若要做，应作为新功能单独设计。
4. slash command
   - 当前分支没有输入框 slash command 入口。
   - `origin/main` 也没有对应实现。
   - 这同样不是 main 公共能力拉齐项。
5. 额外发现
   - `src/renderer/services/cowork.ts` 在 stream message 热路径仍有多处 debug `console.log`。
   - `origin/main` 也保留这些日志，所以本轮不作为 main 拉齐项直接修改。
   - 但它违反当前仓库 logging 规范，并可能影响长对话性能和日志可读性，建议后续作为公共质量修复候选单独清理。

### 本轮代码更新

1. `src/main/libs/agentEngine/openclawRuntimeAdapter.test.ts`
   - 本轮代码层只新增了 OpenClaw session patch 策略字段透传回归测试。
2. `CoworkSessionDetail.tsx / CoworkPromptInput.tsx`
   - 本轮只核对，不改动。
   - 原因是前端消息展示当前已经直接渲染全部 turn；输入历史和 slash command 也不是 main 已有功能。

### 本轮原则校验

1. KISS
   - 不为已经不存在的 LazyRender 限制做无效补丁。
2. YAGNI
   - 不把上下键历史和 slash command 当作 main 拉齐项混进本批次。
3. SOLID
   - 前端只负责展示 `currentSession.messages` 的投影；若数据缺失，应回到 store/runtime 同步层定位。
4. DRY
   - 保留 `coworkConversationTurns.ts` 作为唯一 turn 组装 helper，不恢复 main 的内联重复逻辑。

### 后续规划

1. 如果继续处理“某 session 历史显示不全”，下一步应转入数据源链路：
   - `coworkStore.replaceConversationMessages()`
   - `openclawRuntimeAdapter.reconcileWithHistory()`
   - `openclawTranscript.ts`
   - managed sessionKey 解析与 channel session sync
2. 如果继续做 main 公共能力拉齐，建议下一批转入 `EmbeddingSettingsSection / Memory / MCP`：
   - 先核对 main 的 `EmbeddingSettingsSection.tsx` 对应设置入口是否可以在当前青数工作台中安全承接。
   - 不改主控台 UI，只补设置项或服务层缺口。
3. 公共质量修复候选：
   - 清理 `coworkService.setupStreamListeners()` 中 stream 热路径 debug 日志。
   - 但这项应单独小步做，并补充 changelog，避免和 main 能力拉齐混淆。

## 补充：Embedding 语义检索设置入口对齐

本轮继续按上一节规划转入 `EmbeddingSettingsSection / Memory / MCP`，优先核对 `origin/main` 的 embedding 设置入口是否能安全承接到当前青数工作台。

### 本轮复核结论

1. 底层配置已经具备
   - 当前分支的 `CoworkConfig` 已有：
     - `embeddingEnabled`
     - `embeddingProvider`
     - `embeddingModel`
     - `embeddingVectorWeight`
     - `embeddingRemoteBaseUrl`
     - `embeddingRemoteApiKey`
   - `preload.ts`、`renderer/types/electron.d.ts`、`coworkStore.ts`、`main.ts` 也已经能读写这些字段。
2. OpenClaw config sync 已经接通
   - `openclawConfigSync.ts` 中 `buildMemorySearchConfig()` 会在 `embeddingEnabled=true` 时写入 `agents.defaults.memorySearch`。
   - provider 会限定在 `openai / gemini / voyage / mistral / ollama`，未知 provider 会回退为 `openai`。
   - `embeddingEnabled=false` 时不会写 `memorySearch`，避免再次触发 OpenClaw 移除工具或 schema 不兼容问题。
3. 当前分支缺口在 UI
   - `origin/main` 有 `src/renderer/components/cowork/EmbeddingSettingsSection.tsx`。
   - 当前分支缺这个组件，也没有在“记忆”设置页暴露对应字段。
   - 当前 i18n 还残留一套“本地 embedding 重排 / 模型下载”的旧文案，但底层实际写的是远程 provider 配置。

### 本轮代码更新

1. 新增 `src/renderer/components/cowork/EmbeddingSettingsSection.tsx`
   - 接入 embedding 开关。
   - 支持 provider 选择：
     - OpenAI
     - Gemini
     - Voyage
     - Mistral
     - Ollama
   - 支持模型名、远程 Base URL、远程 API Key、语义重排权重。
   - 高级项只暴露 `vectorWeight`，不引入本地模型下载流程。
2. 更新 `src/renderer/components/Settings.tsx`
   - 在 `coworkMemory` tab 中增加 embedding 设置段。
   - 新增本地 state：
     - `embeddingEnabled`
     - `embeddingProvider`
     - `embeddingModel`
     - `embeddingVectorWeight`
     - `embeddingRemoteBaseUrl`
     - `embeddingRemoteApiKey`
   - `hasCoworkConfigChanges` 纳入这些字段。
   - 保存设置时把这些字段传给 `coworkService.updateConfig()`。
3. 更新 `src/renderer/services/i18n.ts`
   - 补齐 provider、remote base URL、remote API key 的中英文文案。
   - 将旧的“本地 embedding 重排”文案调整为“embedding 语义检索”，与当前 OpenClaw `memorySearch` 写入行为一致。

### 本轮刻意未合入的内容

1. 未接本地 embedding 模型下载 UI
   - 当前底层同步的是远程 provider 配置。
   - 旧文案中的本地模型下载链路没有完整 runtime 证据，本轮不扩展。
2. 未改变默认值
   - `embeddingEnabled` 仍默认 `false`。
   - 老用户不会因为打开设置页而自动启用 memorySearch。
3. 未改青数工作台和主控台 UI
   - 只在现有“记忆”设置页追加一个配置段。
   - 不调整 Settings 的整体结构、品牌视觉和治理链入口。

### 本轮原则校验

1. KISS
   - 只补缺失 UI 和保存接线，不重写 memory 系统。
2. YAGNI
   - 不做本地模型下载、不加额外 provider、不引入新 runtime。
3. SOLID
   - Settings 负责配置编辑，OpenClaw config sync 继续负责把配置投影为 `memorySearch`。
4. DRY
   - 复用现有 `CoworkConfig` 字段和 `buildMemorySearchConfig()`，不新增第二套 embedding 配置真源。

### 后续规划

1. 本轮验证通过后，继续核对 `Memory / MCP` 剩余公共能力：
   - `EmbeddingSettingsSection` 之外的 memory CRUD / index rebuild / MCP bridge 差异。
   - 只补低耦合行为，不动青数 managed governance。
2. 下一小步优先考虑公共质量修复：
   - 清理 `coworkService.setupStreamListeners()` 中 stream 热路径 debug 日志。
   - 这能减少长对话、IM 会话和图片附件消息时的日志噪声。
3. 高耦合内容继续单独批次：
   - OpenAI Codex token refresher。
   - per-agent `modelSlice`。
   - POPO/IM UI 大迁移。
   - OpenClaw 主干重构。

## 补充：Cowork stream 热路径日志清理

本轮按上一节规划做一个公共质量小步，清理 `coworkService.setupStreamListeners()` 中每条 stream message 都会触发的 debug 日志。

### 本轮问题

`src/renderer/services/cowork.ts` 的 `onStreamMessage` 回调处于消息流热路径：

1. 每条消息都会触发一次。
2. IM/channel 会话、长对话、图片附件消息会更频繁触发。
3. 旧逻辑每条消息都会打印 session 状态。
4. 用户消息还会额外打印 metadata keys 和图片附件数量。
5. 这些日志不影响业务判断，但会增加 DevTools / app log 噪声，也可能在长对话里带来轻微性能压力。

### 本轮代码更新

1. `src/renderer/services/cowork.ts`
   - 删除用户消息 metadata debug 日志。
   - 删除每条 stream message 的 sessionExists / totalSessions debug 日志。
   - 删除缺失 session 后刷新列表前后的 debug 日志。
2. 保留的行为
   - 未知 session 仍会调用 `loadSessions()`，确保 IM 或其他来源创建的 session 能进入列表。
   - user message 仍会把 session 状态更新为 `running`。
   - 消息仍通过 `addMessage({ sessionId, message })` 进入 Redux。
   - 错误日志和真实失败提示不变。

### 本轮原则校验

1. KISS
   - 只删热路径日志，不改变数据流。
2. YAGNI
   - 不新增日志开关或 debug flag，先移除明显无必要输出。
3. SOLID
   - `coworkService` 继续只负责 IPC stream 到 store 的投影。
4. DRY
   - 不再对同一个 stream 事件重复打印多份诊断信息。

### 本轮验证

1. `npm test -- --run src/renderer/store/slices/coworkSlice.test.ts src/renderer/components/cowork/coworkConversationTurns.test.ts src/main/libs/agentEngine/openclawRuntimeAdapter.test.ts`
   - 3 个测试文件通过。
   - 44 条测试通过。
2. `npx tsc --project tsconfig.json --noEmit` 通过。
3. `npx tsc --project electron-tsconfig.json --noEmit` 通过。
4. `git diff --check` 通过。

### 后续规划

1. 下一步继续 `Memory / MCP` 剩余公共能力核对：
   - memory CRUD 与 index rebuild。
   - MCP bridge 与应用入口差异。
   - 只补低耦合行为，不动青数 managed governance。
2. 另一个可小步处理的质量点：
   - `openclawRuntimeAdapter.ts` 中仍有大量 `[Debug:*]` 级别的 `console.log`。
   - 但该文件涉及运行时排障，建议先分组梳理哪些是 hot loop、哪些是生命周期关键日志，再逐批降级为 `console.debug` 或删除。
3. 高耦合批次继续暂缓：
   - OpenAI Codex token refresher。
   - per-agent `modelSlice`。
   - POPO/IM UI 大迁移。
   - OpenClaw 主干重构。

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

## 补充：OpenClaw runtime 裁剪统计与回归保护

本轮继续收 `OpenClaw runtime` 构建/打包稳定性的小批次差异，重点复核 `scripts/prune-openclaw-runtime.cjs` 与 `origin/main` 的差异。结论是当前分支在运行时裁剪上已经比 main 更适合青数当前包体结构，因此本轮不做覆盖式合入，只补可验证边界。

### 本轮复核结论

1. 当前分支保留了双目录 extension `node_modules` 清理：
   - `third-party-extensions/*/node_modules`
   - `extensions/*/node_modules`
2. 当前分支保留 `PACKAGES_TO_STUB` 导出，并明确不 stub `@img`，避免破坏 `sharp` 原生绑定。
3. 当前分支会统计被裁剪 bundled extensions 的 `bytesFreed`，这比 `origin/main` 当前实现更利于排查包体变化。
4. `origin/main` 的实现会退回为只清理 `extensions`，并删除部分测试导出，不适合直接覆盖当前分支。

### 本轮代码更新

1. `scripts/prune-openclaw-runtime.cjs`
   - 抽出 `pruneUnusedBundledExtensions(distExtDir, stats)`。
   - `main()` 继续调用同一逻辑，运行时行为不变。
   - 新 helper 会在删除未使用 bundled extension 前统计目录大小，并写入 `stats.bytesFreed`。
2. `src/main/libs/pruneOpenClawRuntime.test.ts`
   - 增加 extension `node_modules` 清理的 `bytesFreed` 断言。
   - 增加 bundled extension 裁剪测试：保留 `openai`，删除 `slack`，并确认释放空间统计正确。

### 本轮原则校验

1. KISS
   - 只抽出当前已有逻辑，不改变裁剪策略。
2. YAGNI
   - 不引入新的包体分析系统，只补当前必须的统计回归保护。
3. SOLID
   - `main()` 负责编排，helper 负责单一裁剪行为。
4. DRY
   - 避免测试里复制 `main()` 中的遍历/删除规则。

### 本轮验证

1. `npm test -- --run src/main/libs/pruneOpenClawRuntime.test.ts src/main/libs/applyOpenClawPatches.test.ts src/main/libs/electronBuilderHooks.test.ts src/main/libs/openclawRuntimePackaging.test.ts`
   - 4 个测试文件通过。
   - 15 条测试通过。
2. `npx tsc --project electron-tsconfig.json --noEmit`
   - 通过。

### 后续规划

1. 继续小步筛 `origin/main` 中低耦合公共能力，下一轮优先看：
   - `openclawRuntimePackaging` 是否还有包体/manifest 防回退测试可补。
   - `openclawEngineManager` 与当前分支的 GatewayClient 探测、启动超时、schema guard 是否还缺覆盖。
2. 若 OpenClaw runtime 小补丁已基本收口，转入 `Cowork / ScheduledTasks` 公共行为层：
   - 对话历史展示完整性。
   - 定时任务运行状态与局部刷新。
   - 输入历史和 slash command 行为。
3. 继续暂缓高耦合内容：
   - OpenClaw 主干大重构。
   - POPO/IM UI 大迁移。
   - per-agent `modelSlice`。
   - OpenAI Codex per-provider token refresher。

## 补充：OpenClaw gateway config schema guard 回归保护

本轮继续复核 `openclawEngineManager` 与 `origin/main` 的差异。结论是当前分支在 gateway 启动防线里保留了多个针对真实问题的修复，不适合用 main 版本覆盖；本轮只补测试锁定关键 schema guard。

### 本轮复核结论

1. 当前分支会在启动 gateway 前清理旧配置中的 `agents.defaults.cwd`。
   - 这是之前 `OpenClaw stderr: Config invalid` 的直接防线。
   - `origin/main` 当前差异中没有保留这段清理，直接覆盖会有回归风险。
2. 当前分支会 `await stopGatewayProcess(child)` 处理启动超时后的子进程退出。
   - 这比直接 fire-and-forget 更稳，能减少孤儿 gateway 进程。
3. 当前分支 GatewayClient entry resolution 会探测 `method-scopes-* / client-*` 是否真实导出兼容构造器。
   - 这比只取第一个 `client-*` 更能避免 `Invalid OpenClaw gateway client module`。
4. 当前分支 configured third-party plugin ids 会合并 package、local extension 和 renamed plugin id。
   - 这能继续清理旧位置残留插件，避免 bundled scan 目录污染。

### 本轮代码更新

1. `src/main/libs/openclawEngineManager.test.ts`
   - 新增 `config guards` 测试。
   - 构造包含 `agents.defaults.cwd` 的旧版 `openclaw.json`。
   - 调用 `ensureConfigFile()` 后确认：
     - `gateway.mode` 被补成 `local`。
     - `agents.defaults.cwd` 被移除。
     - `agents.defaults.model` 等兼容字段被保留。

### 本轮原则校验

1. KISS
   - 不改启动状态机，只补真实故障点的回归测试。
2. YAGNI
   - 不引入新的 config migration 系统。
3. SOLID
   - gateway config guard 仍收敛在 engine manager 启动前置检查中。
4. DRY
   - 复用现有 `ensureConfigFile()`，不新增第二条清理路径。

### 本轮验证

1. `npm test -- --run src/main/libs/openclawEngineManager.test.ts src/main/libs/pruneOpenClawRuntime.test.ts src/main/libs/openclawRuntimePackaging.test.ts`
   - 3 个测试文件通过。
   - 17 条测试通过。
2. `npx tsc --project electron-tsconfig.json --noEmit`
   - 通过。

### 后续规划

1. OpenClaw runtime/gateway 小补丁区目前主要差异已补到测试防线，下一步建议转入 `Cowork / ScheduledTasks` 公共行为层。
2. 优先小步检查：
   - 当前分支是否仍缺 main 中的 slash command / 输入历史能力。
   - 对话历史展示是否还有 store 或 renderer 层截断。
   - 定时任务运行态、执行按钮反馈和运行历史局部刷新是否仍落后 main。
3. 继续避免：
   - 主控台 UI 整包替换。
   - 青数工作台、治理链、登录承接和唤醒/TTS 覆盖层被 main 冲掉。

## 补充：ScheduledTasks 运行历史筛选参数链路

本轮从 `Cowork / ScheduledTasks` 公共行为层继续小步合入 `origin/main` 的低耦合能力。对比后没有搬 `main` 的定时任务页面 UI 大改，而是先收底层运行历史筛选参数链路，给后续历史页筛选 UI 留出稳定接口。

### 本轮复核结论

1. 当前分支已经具备手动执行的乐观 running 态：
   - 点击执行后会立即更新 `runningAtMs` 和 `lastStatus=running`。
   - 并去重同一任务的并发手动执行请求。
   - 这已经覆盖之前“执行按钮点了半天像卡住”的核心体验问题。
2. `origin/main` 在运行历史上新增了 `RunFilter` 透传：
   - `startDate`
   - `endDate`
   - `status`
3. `origin/main` 的历史页 UI 变更较大，涉及筛选控件和布局变化，本轮不直接搬，避免冲击当前主操作台视觉和青数工作台体验。

### 本轮代码更新

1. `src/scheduledTask/types.ts`
   - 新增 `RunFilter` 接口。
2. `src/scheduledTask/cronJobService.ts`
   - `listRuns(jobId, limit, offset, filter)` 支持向 `cron.runs` 透传：
     - `startMs`
     - `endMs`
     - `status`
   - `listAllRuns(limit, offset, filter)` 支持同样筛选参数。
3. `src/main/ipcHandlers/scheduledTask/handlers.ts`
   - `scheduledTask:listRuns` 和 `scheduledTask:listAllRuns` 增加 `filter` 参数。
4. `src/main/preload.ts`
   - renderer bridge 增加 `filter` 参数透传。
5. `src/renderer/types/electron.d.ts`
   - scheduled task API 类型增加 `RunFilter`。
6. `src/renderer/services/scheduledTask.ts`
   - `loadRuns()` 和 `loadAllRuns()` 增加可选 `filter` 参数。
7. 测试补充：
   - `src/scheduledTask/cronJobService.test.ts` 覆盖 job/all run history 的 filter wire 参数。
   - `src/renderer/services/scheduledTask.test.ts` 覆盖 renderer service 到 preload API 的 filter 透传。

### 本轮原则校验

1. KISS
   - 只补参数透传，不搬历史页 UI。
2. YAGNI
   - 暂不新增筛选面板，等当前主操作台体验确认后再接 UI。
3. SOLID
   - 类型层定义 filter，IPC/service/runtime 分层只负责透传各自边界。
4. DRY
   - `RunFilter` 成为单一类型来源，避免前后端重复定义筛选字段。

### 本轮验证

1. `npm test -- --run src/scheduledTask/cronJobService.test.ts src/renderer/services/scheduledTask.test.ts src/renderer/store/slices/scheduledTaskSlice.test.ts src/renderer/components/scheduledTasks/utils.test.ts`
   - 4 个测试文件通过。
   - 37 条测试通过。
2. `npx tsc --project electron-tsconfig.json --noEmit`
   - 通过。
3. `npx tsc --project tsconfig.json --noEmit`
   - 通过。
4. `git diff --check`
   - 通过。

### 后续规划

1. 下一轮建议继续在 `ScheduledTasks` 行为层小步推进：
   - 是否把运行历史筛选 UI 以最小方式接到当前页面，不搬 main 大布局。
   - 继续检查任务详情页执行按钮状态、运行中反馈、失败提示是否还有 main 可收 bugfix。
2. 然后回到 `Cowork / message rendering`：
   - 确认当前历史展示不被 store/page/lazy render 截短。
   - 检查输入历史上下键和 slash command 能力是否可安全补齐。
3. 继续暂缓高耦合迁移：
   - better-sqlite3 存储替换。
   - 主控台 UI 整包替换。
   - POPO/IM 大迁移。
   - per-agent modelSlice。

## 补充：ScheduledTasks 运行历史筛选 UI 最小接入

本轮继续上一节的 `RunFilter` 底层链路，把筛选能力以最小 UI 的方式接入当前分支的运行历史页。没有搬 `origin/main` 的表格化大布局，保留当前青数主操作台中的卡片式历史列表。

### 本轮复核结论

1. `origin/main` 的 `AllRunsHistory` 是一整块布局重做：
   - 表格列头
   - 自定义 `DateInput`
   - 状态 pill
   - 本地过滤保护
2. 当前分支的历史列表视觉更贴近现有工作台，不适合整包替换。
3. 因此本轮只保留公共行为：状态筛选、开始/结束日期筛选、清除筛选、筛选后加载更多继续带 filter。

### 本轮代码更新

1. `src/renderer/components/scheduledTasks/AllRunsHistory.tsx`
   - 顶部新增轻量筛选条：
     - 成功 / 失败 / 跳过 / 运行中状态筛选。
     - 开始日期 / 结束日期筛选。
     - 清除筛选按钮。
   - 首次加载、筛选切换、加载更多均会调用 `scheduledTaskService.loadAllRuns(..., filter)`。
   - 保留当前卡片式列表和点击查看 session 的交互。
   - 增加本地过滤保护，避免筛选切换时短暂显示旧结果。
2. `src/renderer/services/i18n.ts`
   - 增加中英文文案：
     - `scheduledTasksFilterStartDate`
     - `scheduledTasksFilterEndDate`
     - `scheduledTasksFilterClear`
     - `scheduledTasksFilterNoResults`

### 本轮原则校验

1. KISS
   - 使用原生 date input，不引入额外组件和布局重做。
2. YAGNI
   - 不搬 main 的完整历史页大改，只满足当前可见筛选需求。
3. SOLID
   - UI 只负责筛选状态与调用 service，数据查询仍由 ScheduledTaskService / CronJobService 负责。
4. DRY
   - 复用上一轮统一的 `RunFilter` 类型。

## 补充：Cowork 输入历史上下键能力

本轮继续进入 `Cowork / message rendering` 行为层。对比后发现当前分支没有输入历史上下键能力，`origin/main` 也没有一段可以低风险整包搬入的完整实现；因此本轮按当前输入区结构补一个独立小能力，不碰主控台 UI 和唤醒/TTS。

### 本轮代码更新

1. `src/renderer/components/cowork/promptInputHistory.ts`
   - 新增 prompt 输入历史纯函数：
     - `normalizePromptInputHistoryEntry()`
     - `addPromptInputHistoryEntry()`
     - `canNavigatePromptInputHistory()`
   - 历史最多保留 50 条。
   - 重复输入会移动到顶部，不重复存储。
2. `src/renderer/components/cowork/CoworkPromptInput.tsx`
   - 成功提交文本 prompt 后写入本地输入历史。
   - `ArrowUp` 查看上一条历史输入。
   - `ArrowDown` 返回下一条，回到当前草稿。
   - 仅在以下条件满足时触发历史导航：
     - 单行输入。
     - 没有选中文本。
     - 没有 Shift/Ctrl/Cmd/Alt 修饰键。
     - 非输入法 composition 状态。
   - 不影响 Enter 提交、Shift+Enter 换行、语音听写、附件、技能和模型选择。
3. `src/renderer/components/cowork/promptInputHistory.test.ts`
   - 覆盖空白归一、去重置顶、长度上限、多行/选区不触发历史导航。

### 本轮原则校验

1. KISS
   - 本地内存历史即可满足“刚刚输入过的内容上下键找回”，不引入持久化和全局 store。
2. YAGNI
   - 暂不做 slash command 大系统，也不把历史跨 session 持久化。
3. SOLID
   - 历史处理纯函数独立，输入组件只接键盘事件和本地状态。
4. DRY
   - 键盘边界判断集中在 `canNavigatePromptInputHistory()`。

### 本轮验证

1. `npm test -- --run src/scheduledTask/cronJobService.test.ts src/renderer/services/scheduledTask.test.ts src/renderer/store/slices/scheduledTaskSlice.test.ts src/renderer/components/scheduledTasks/utils.test.ts`
   - 4 个测试文件通过。
   - 37 条测试通过。
2. `npm test -- --run src/renderer/components/cowork/promptInputHistory.test.ts src/renderer/components/cowork/coworkSpeechText.test.ts src/renderer/components/cowork/coworkConversationTurns.test.ts src/renderer/components/cowork/coworkTtsText.test.ts`
   - 4 个测试文件通过。
   - 23 条测试通过。
3. `npx tsc --project tsconfig.json --noEmit`
   - 通过。
4. `npx tsc --project electron-tsconfig.json --noEmit`
   - 通过。
5. `git diff --check`
   - 通过。

### 后续规划

1. 继续 Cowork 行为层：
   - 检查历史展示是否仍存在 store/message loading/page/lazy-render 任一层截断。
   - 评估 slash command 是否需要独立做成小入口，而不是搬 main 的大输入区改造。
2. 再回到 ScheduledTasks：
   - 检查任务详情页运行中反馈、失败提示、局部刷新是否还有 main 可收 bugfix。
3. 高耦合内容继续暂缓：
   - `better-sqlite3` 存储迁移。
   - 主控台 UI 整包替换。
   - POPO/IM 大迁移。
   - per-agent `modelSlice`。

## 2026-05-12：第 13 轮 Cowork 同 session 短刷新保护

本轮按上一轮规划继续检查 `Cowork / message rendering` 行为层，重点是“一个 agent 下一个 session 的历史消息显示不全”。复核当前分支后确认，当前 `CoworkSessionDetail` 没有直接按条数截断消息，`buildConversationTurns(...)` 也没有 slice/limit；更容易触发短历史体验的是后台刷新同一个 session 时，如果底层同步临时返回了窗口化短历史，renderer 会把已经展示的完整消息列表整体替换短。

### 本轮代码更新

1. `src/renderer/services/cowork.ts`
   - 新增 `mergeLoadedSessionWithCurrentSession(...)`。
   - 当加载结果和当前打开的是同一个 session，且加载结果的消息数更短时，保留当前已展示的消息顺序。
   - 对已存在的消息 id 使用加载结果覆盖内容和 metadata，避免最终态、标题、状态等更新丢失。
   - 加载结果更长或切换到其他 session 时，仍直接使用加载结果，不阻止正常历史增长和正常切换。
2. `src/renderer/services/cowork.test.ts`
   - 新增同 session 短刷新不会缩短已展示历史的测试。
   - 新增加载结果不短时仍直接使用 loaded session 的测试。

### 本轮刻意未改

1. 不搬 `origin/main` 的 `LazyRenderTurn` / Artifacts 右侧面板大改，避免影响当前主操作台 UI 与青数定制体验。
2. 不修改 OpenClaw 原始 transcript / SQLite 同步策略，本轮只做 renderer 已展示状态的防退化保护。
3. 不改变 TTS、唤醒、青数工作台、内置治理链。
4. 不提交、不打包、不推送。

### 原则校验

1. KISS
   - 用 service 层小 helper 保护同 session 短刷新，不引入复杂虚拟列表或重同步系统。
2. YAGNI
   - 不为本轮问题提前迁移 main 的整套 LazyRender / Artifact UI。
3. SOLID
   - `coworkService.loadSession()` 负责加载结果投影，UI 仍只消费 store 中的 session。
4. DRY
   - 短刷新合并规则集中在 `mergeLoadedSessionWithCurrentSession(...)`，测试直接覆盖该公共行为。

### 本轮验证

1. `npm test -- --run src/renderer/services/cowork.test.ts src/renderer/store/slices/coworkSlice.test.ts src/renderer/components/cowork/coworkConversationTurns.test.ts src/renderer/components/cowork/promptInputHistory.test.ts`
   - 4 个测试文件通过。
   - 19 条测试通过。
2. `npx tsc --project tsconfig.json --noEmit`
   - 通过。
3. `npx tsc --project electron-tsconfig.json --noEmit`
   - 通过。
4. `git diff --check`
   - 通过。

### 第 14 轮规划

1. 主攻方向
   - Cowork 输入区 slash command 的最小公共能力接入。
2. 计划动作
   - 先对比 `origin/main` 是否有可拆出的 slash command 纯逻辑或输入触发规则。
   - 如果 main 逻辑耦合主输入区大 UI，则只做当前输入框内的轻量 `/` 入口或记录暂缓。
   - 继续保护语音输入、附件、技能选择、TTS 和青数工作台 UI。
3. 验收命令
   - `npm test -- --run src/renderer/components/cowork/promptInputHistory.test.ts src/renderer/services/cowork.test.ts src/renderer/store/slices/coworkSlice.test.ts`
   - `npx tsc --project tsconfig.json --noEmit`
   - `npx tsc --project electron-tsconfig.json --noEmit`
   - `git diff --check`
4. 暂不处理
   - main 的完整 Artifacts / CodeMirror / 右侧面板 overhaul。
   - OpenClaw 主干大重构。
   - POPO/IM 大迁移。
   - per-agent `modelSlice`。

## 2026-05-12：第 14 轮 Cowork slash command 最小入口

本轮按第 13 轮规划继续 `Cowork` 输入区公共能力。复核 `origin/main` 后确认，main 没有独立可摘取的 slash command 模块，更多是输入区本体和 Artifacts UI 的大改；当前分支已经有青数 quick action、skill、模型、附件、语音和唤醒输入等复杂能力，因此本轮不整包替换输入区，而是把 slash command 接到现有 quick action 控制面。

### 本轮代码更新

1. `src/renderer/components/cowork/promptSlashCommands.ts`
   - 新增 slash command 纯逻辑：
     - `parsePromptSlashCommand(...)`
     - `filterPromptSlashCommands(...)`
     - `getDefaultPromptForAction(...)`
     - `applyPromptSlashCommand(...)`
   - 输入 `/` 展示可用 quick actions。
   - 输入 `/关键词` 按 action id、action label、skillMapping、prompt label、prompt description 过滤。
   - 只使用有实际 prompt 文本的 quick action。
2. `src/renderer/components/cowork/CoworkPromptInput.tsx`
   - 读取 Redux 中已本地化的 quick actions。
   - 在首页和会话详情页同一个输入框内接入轻量候选弹层。
   - 点击候选后将该 action 的默认 prompt 写入输入框，并激活对应 `skillMapping`。
   - 不改变 Enter 提交、上下键历史、语音输入、附件、模型选择、skill 选择和唤醒/TTS 行为。
3. `src/renderer/components/cowork/promptSlashCommands.test.ts`
   - 覆盖 slash query 解析、过滤、空 prompt 跳过、选中后 prompt 替换。

### 本轮刻意未改

1. 不搬 `origin/main` 的输入区大 UI。
2. 不新增一套独立 slash command 配置源，复用当前 quick action 真源。
3. 不改 quick action 首页卡片布局。
4. 不触碰青数品牌、工作台、内置治理链、唤醒/TTS。

### 原则校验

1. KISS
   - slash command 只作为 quick action 的轻量入口，不重建命令系统。
2. YAGNI
   - 暂不支持多级命令、键盘高亮选择或持久化命令历史。
3. SOLID
   - 命令解析与过滤放在纯函数，输入组件只负责展示和应用结果。
4. DRY
   - 复用 quick action / skillMapping，不重复维护命令配置。

### 本轮验证

1. `npm test -- --run src/renderer/components/cowork/promptSlashCommands.test.ts src/renderer/components/cowork/promptInputHistory.test.ts src/renderer/services/cowork.test.ts src/renderer/store/slices/coworkSlice.test.ts`
   - 4 个测试文件通过。
   - 18 条测试通过。
2. `npx tsc --project tsconfig.json --noEmit`
   - 通过。
3. `npx tsc --project electron-tsconfig.json --noEmit`
   - 通过。
4. `git diff --check`
   - 通过。

### 第 15 轮规划

1. 主攻方向
   - 阶段性回扫本次 Cowork 输入/展示改动与 ScheduledTasks 行为改动，确认没有交互回退。
2. 计划动作
   - 回扫 `CoworkPromptInput.tsx`、`promptInputHistory.ts`、`promptSlashCommands.ts`、`cowork.ts`。
   - 检查 slash command 与上下键历史、Enter 提交、语音输入、附件粘贴是否有明显冲突。
   - 回扫 ScheduledTasks 运行历史筛选和 pending run 状态同步测试。
3. 验收命令
   - `npm test -- --run src/renderer/components/cowork/promptSlashCommands.test.ts src/renderer/components/cowork/promptInputHistory.test.ts src/renderer/services/cowork.test.ts src/renderer/store/slices/coworkSlice.test.ts src/scheduledTask/cronJobService.test.ts src/renderer/services/scheduledTask.test.ts src/renderer/store/slices/scheduledTaskSlice.test.ts src/renderer/components/scheduledTasks/utils.test.ts`
   - `npx tsc --project tsconfig.json --noEmit`
   - `npx tsc --project electron-tsconfig.json --noEmit`
   - `git diff --check`
4. 暂不处理
   - 主控台 UI 整包替换。
   - full Artifacts / CodeMirror / 右侧面板 overhaul。
   - POPO/IM 大迁移。
   - OpenClaw 主干大重构。

## 2026-05-12：第 15 轮 Cowork / ScheduledTasks 阶段性回扫

本轮按第 14 轮规划做阶段性回扫，不扩大功能合入范围。重点确认最近几轮围绕 Cowork 输入/展示、session 短刷新保护、slash command、输入历史，以及 ScheduledTasks 运行历史筛选和 pending run 状态同步的改动之间没有明显交互回退。

### 本轮回扫结论

1. 冲突标记扫描
   - 未发现 `<<<<<<<` / `=======` / `>>>>>>>` 残留。
2. Cowork 输入区
   - slash command 仍只在单行 `/` 或 `/关键词` 输入下显示候选。
   - 上下键历史仍通过 `canNavigatePromptInputHistory(...)` 限制为单行、无选中文本、无组合键场景。
   - Enter 提交、修饰键换行、语音输入、附件粘贴、skill 选择与模型选择未在本轮改变。
3. Cowork session 展示
   - `mergeLoadedSessionWithCurrentSession(...)` 只保护同 session 的短刷新，不阻止更长 loaded session 或切换 session。
4. ScheduledTasks
   - 运行历史筛选参数链路和 pending manual run 状态同步测试保持通过。

### 本轮代码更新

1. 仅更新 `0421changelog.md`。
2. 不新增生产代码。
3. 不新增测试代码。

### 原则校验

1. KISS
   - 用回扫矩阵确认稳定性，不为“继续推进”额外叠改。
2. YAGNI
   - 不在未发现回退时新增防御代码。
3. SOLID
   - 分能力域验证，保持 Cowork 输入、Cowork session 投影、ScheduledTasks 状态投影职责清晰。
4. DRY
   - 沿用前几轮沉淀的测试矩阵，不重新设计重复验证链路。

### 本轮验证

1. `rg -n "^(<<<<<<<|=======|>>>>>>>)" . --glob '!node_modules/**' --glob '!release/**' --glob '!outputs/**' --glob '!vendor/**'`
   - 未发现冲突标记。
2. `npm test -- --run src/renderer/components/cowork/promptSlashCommands.test.ts src/renderer/components/cowork/promptInputHistory.test.ts src/renderer/services/cowork.test.ts src/renderer/store/slices/coworkSlice.test.ts src/scheduledTask/cronJobService.test.ts src/renderer/services/scheduledTask.test.ts src/renderer/store/slices/scheduledTaskSlice.test.ts src/renderer/components/scheduledTasks/utils.test.ts`
   - 8 个测试文件通过。
   - 57 条测试通过。
3. `npx tsc --project tsconfig.json --noEmit`
   - 通过。
4. `npx tsc --project electron-tsconfig.json --noEmit`
   - 通过。
5. `git diff --check`
   - 通过。

### 第 16 轮规划

1. 主攻方向
   - 回到 `origin/main` 剩余公共能力的低耦合筛选，优先 OpenClaw / Provider / 构建稳定性小边界。
2. 计划动作
   - 对比 `origin/main` 中 `openclawConfigGuards.ts`、`openclawEngineManager.ts`、`openclawRuntimeAdapter.ts`、`providerRequestConfig.ts` 的剩余差异。
   - 优先选择纯 helper、schema guard、错误分类、防抖测试这类可局部验证内容。
   - 如果差异属于 OpenClaw 主干重构、认证 token refresher、per-agent modelSlice 或主控台 UI 大迁移，则继续记录暂缓。
3. 验收命令
   - 按实际触达文件补跑最小测试集。
   - `npx tsc --project tsconfig.json --noEmit`
   - `npx tsc --project electron-tsconfig.json --noEmit`
   - `git diff --check`
4. 暂不处理
   - `.app` 打包、commit、push。
   - 主控台 UI 整包替换。
   - POPO/IM 大迁移。
   - OpenClaw 主干大重构。

## 2026-05-12：第 16 轮 OpenClaw / Provider / 构建稳定性低耦合复核

本轮按第 15 轮规划回到 `origin/main` 剩余公共能力筛选。重点复核 `openclawConfigGuards.ts`、`openclawEngineManager.ts`、`openclawRuntimeAdapter.ts`、`providerRequestConfig.ts` 以及 OpenClaw runtime packaging / prune 相关脚本差异。结论是：当前分支在这些低耦合点上已经具备 main 的关键公共能力，且部分实现更贴合青数覆盖层；本轮不做覆盖式合入，避免把已修复的历史展示、OpenClaw metadata、ProviderRegistry 和本地插件清理逻辑改退。

### 本轮复核结论

1. OpenClaw config guard
   - 当前分支已保留 gateway schema 防护能力。
   - 继续保留对旧版 `channels.feishu` 额外字段的清理防线，避免再次触发 `Config invalid`。
2. OpenClaw engine manager
   - 当前分支已注入 `CODEX_HOME: getCodexHomeDir()`，隔离 OpenClaw / Codex 认证目录。
   - third-party plugin cleanup 已覆盖配置项、本地 extension id，以及历史重命名插件 `feishu-openclaw-plugin`。
3. OpenClaw runtime adapter
   - 当前分支保留了历史同步、final assistant、metadata 和 timestamp 保护。
   - `origin/main` 的反向 diff 若直接覆盖，会移除当前分支已经修过的展示数据源和 session 元信息保护，因此不合入。
4. Provider request config
   - 当前分支已使用 `ProviderRegistry` 管理 API format、base URL、Responses URL、Gemini URL、OpenAI-compatible URL 等纯配置投影。
   - 已覆盖千帆、StepFun、有道智云固定 OpenAI format，Ollama / LM Studio 可切换 format，Gemini URL 规范化，本地 OpenAI-compatible URL，以及 Responses URL 边界。
5. 构建打包稳定性
   - OpenClaw packaging / prune 脚本仍存在 diff，但当前分支保留了 macOS speech/TTS helper、本地 OpenClaw extension prune、gateway.asar 校验和 runtime target 映射等本地化防线。
   - 本轮不为了 diff 归零覆盖这些脚本。

### 本轮代码更新

1. 仅更新 `0421changelog.md`。
2. 不新增生产代码。
3. 不新增测试代码。

### 原则校验

1. KISS
   - 先用现有测试与 diff 判断是否需要改，不为“继续合入”制造无意义改动。
2. YAGNI
   - 没有在已覆盖的 OpenClaw / Provider 低耦合点上重复实现另一套逻辑。
3. SOLID
   - 保持 Provider 配置投影、OpenClaw gateway lifecycle、runtime adapter 历史同步各自职责边界。
4. DRY
   - 复用已有 `ProviderRegistry`、OpenClaw config guard 和 engine manager 测试防线，不复制 main 的散落实现。

### 本轮验证

1. `npm test -- --run src/main/libs/openclawConfigGuards.test.ts src/main/libs/openclawEngineManager.test.ts src/main/libs/agentEngine/openclawRuntimeAdapter.test.ts src/renderer/services/providerRequestConfig.test.ts`
   - 4 个测试文件通过。
   - 73 条测试通过。
2. `npx tsc --project tsconfig.json --noEmit`
   - 通过。
3. `npx tsc --project electron-tsconfig.json --noEmit`
   - 通过。
4. `git diff --check`
   - 通过。
5. `rg -n "^(<<<<<<<|=======|>>>>>>>)" . --glob '!node_modules/**' --glob '!release/**' --glob '!outputs/**' --glob '!vendor/**'`
   - 未发现冲突标记。

### 第 17 轮规划

1. 主攻方向
   - 继续筛 `origin/main` 剩余公共能力中的低耦合小闭环，优先 OpenClaw runtime patch / Provider 模型配置 / 构建打包稳定性。
2. 计划动作
   - 复核 OpenClaw runtime adapter 中错误态、abort、timeout、日志降噪是否还有不依赖主干重构的小补丁。
   - 复核 Provider / 模型配置中 thinking、max tokens、Responses API streaming 解析是否还有纯 helper 或测试缺口。
   - 复核 packaging helper 是否还有可以通过单测锁住的 path、entry、summary、prune 边界。
3. 验收命令
   - 按实际触达文件补跑最小测试集。
   - `npx tsc --project tsconfig.json --noEmit`
   - `npx tsc --project electron-tsconfig.json --noEmit`
   - `git diff --check`
4. 暂不处理
   - `.app` 打包、commit、push。
   - POPO/IM 大迁移。
   - OpenClaw 主干重构。
   - per-agent `modelSlice` 大迁移。
   - 主控台 UI 整包迁移。

## 2026-05-12：第 17 轮 Provider OpenAI token 参数模型名规范化

本轮按第 16 轮规划继续筛 Provider / 模型配置的小闭环。复核 `providerRequestConfig.ts`、`Settings.tsx` 与 `api.ts` 的调用链后，选定一个低风险边界：OpenAI GPT-5 / o 系列模型应使用 `max_completion_tokens`，当前 helper 已能识别 `openai/o3` 这类带 provider 前缀的模型，但如果模型 id 来自配置或 UI 输入时带首尾空白，会误判为普通模型并走 `max_tokens`。本轮只在纯 helper 层做规范化，不触碰 Provider UI、青数工作台、内置治理链、OpenClaw gateway 或唤醒/TTS。

### 本轮代码更新

1. `src/renderer/services/providerRequestConfig.ts`
   - `shouldUseMaxCompletionTokensForOpenAI(...)` 对 `modelId` 增加 `trim()` 后再转小写。
   - 保留 provider 必须为 `OpenAI` 的限制，不扩大到 Copilot 或其他 OpenAI-compatible provider。
2. `src/renderer/services/providerRequestConfig.test.ts`
   - 新增 ` openai/o4-mini ` 带空白模型 id 仍应识别为 `max_completion_tokens` 的回归断言。

### 本轮刻意未改

1. 不改 `api.ts` 的请求体结构。
2. 不改 Settings 连接测试 UI。
3. 不改 IM LLM 请求链路。
4. 不合入 per-provider token refresher 或认证主干。
5. 不触碰青数品牌、工作台、治理链、唤醒/TTS。

### 原则校验

1. KISS
   - 只在模型 id 进入判断前做一次字符串规范化。
2. YAGNI
   - 不新增模型能力表或 provider override 配置，避免过早抽象。
3. SOLID
   - Provider 请求参数判断继续集中在 `providerRequestConfig.ts`，调用方无需知道清洗细节。
4. DRY
   - 复用现有 helper 和测试文件，不在 `api.ts` / `Settings.tsx` 各自重复 trim。

### 本轮验证

1. `npm test -- --run src/renderer/services/providerRequestConfig.test.ts src/renderer/services/config.test.ts src/shared/providers/constants.test.ts`
   - 3 个测试文件通过。
   - 40 条测试通过。
2. `npx tsc --project tsconfig.json --noEmit`
   - 通过。
3. `npx tsc --project electron-tsconfig.json --noEmit`
   - 通过。
4. `git diff --check`
   - 通过。

### 第 18 轮规划

1. 主攻方向
   - 转回 OpenClaw runtime / packaging 的低耦合稳定性边界，继续挑能用单测验证的小点。
2. 计划动作
   - 复核 `openclaw-runtime-packaging.cjs` 的 asar entry summary 是否还有大小写、相对路径、重复 slash 等边界。
   - 复核 `prune-openclaw-runtime.cjs` 是否还有不改变裁剪策略、但能补统计或路径安全测试的点。
   - 复核 OpenClaw runtime adapter 是否还有不改状态机的日志降噪或 late event 测试缺口。
3. 验收命令
   - `npm test -- --run src/main/libs/openclawRuntimePackaging.test.ts src/main/libs/pruneOpenClawRuntime.test.ts src/main/libs/agentEngine/openclawRuntimeAdapter.test.ts`
   - `npx tsc --project tsconfig.json --noEmit`
   - `npx tsc --project electron-tsconfig.json --noEmit`
   - `git diff --check`
4. 暂不处理
   - `.app` 打包、commit、push。
   - OpenClaw 主干重构。
   - POPO/IM 大迁移。
   - per-agent `modelSlice` 大迁移。
   - 主控台 UI 整包迁移。

## 2026-05-12：第 18 轮 OpenClaw gateway.asar entry 路径规范化

本轮按第 17 轮规划转回 OpenClaw runtime / packaging 小边界。复核 `openclaw-runtime-packaging.cjs` 后确认，`summarizeGatewayAsarEntries(...)` 负责判断 gateway.asar 内是否包含 `openclaw.mjs`、`dist/entry.js` / `dist/entry.mjs`、`dist/control-ui/index.html` 以及是否错误打入 `dist/extensions`。该 helper 原先已能处理反斜杠与尾部斜杠，但对无前导 `/` 或重复 `/` 的 entry 不够稳。虽然当前 `asar.listPackage()` 通常返回带前导 `/` 的路径，本轮仍补上纯路径规范化，避免未来打包工具或测试输入形态变化导致误判。

### 本轮代码更新

1. `scripts/openclaw-runtime-packaging.cjs`
   - `normalizeAsarEntry(...)` 增加重复斜杠压缩。
   - 无前导 `/` 的 entry 会统一补成 `/...`。
   - 继续保留反斜杠转 `/` 与尾部斜杠清理。
2. `src/main/libs/openclawRuntimePackaging.test.ts`
   - 新增 `openclaw.mjs`、`dist//entry.js`、`dist///control-ui//index.html`、`dist//extensions//...` 这类相对路径/重复斜杠输入的回归测试。

### 本轮刻意未改

1. 不改变 `pruneGatewayAsarStage(...)` 的裁剪策略。
2. 不改变 `pruneBareDistAfterGatewayPack(...)` 的保留目录策略。
3. 不改 OpenClaw runtime 版本、安装/重建流程或 gateway lifecycle。
4. 不触碰青数品牌、工作台、治理链、唤醒/TTS。

### 原则校验

1. KISS
   - 只增强 entry 字符串规范化，不扩展 packaging 流程。
2. YAGNI
   - 不新增复杂路径解析器，也不引入额外依赖。
3. SOLID
   - gateway.asar 内容摘要仍集中在 packaging helper，打包 hooks 只消费摘要结果。
4. DRY
   - 统一在 `normalizeAsarEntry(...)` 处理路径形态，避免调用方重复清洗。

### 本轮验证

1. `npm test -- --run src/main/libs/openclawRuntimePackaging.test.ts src/main/libs/pruneOpenClawRuntime.test.ts src/main/libs/agentEngine/openclawRuntimeAdapter.test.ts`
   - 3 个测试文件通过。
   - 68 条测试通过。
2. `npx tsc --project tsconfig.json --noEmit`
   - 通过。
3. `npx tsc --project electron-tsconfig.json --noEmit`
   - 通过。
4. `git diff --check`
   - 通过。

### 第 19 轮规划

1. 主攻方向
   - 继续 OpenClaw runtime / packaging 小闭环，优先 `prune-openclaw-runtime.cjs` 的路径安全与统计防退化。
2. 计划动作
   - 复核 duplicate OpenClaw SDK prune 是否只作用于 third-party extensions，不误删 bundled runtime。
   - 复核 bundled extension prune 的统计字段是否能覆盖多文件、多目录、缺失目录场景。
   - 如果 prune 区域已足够稳定，则切到 OpenClaw runtime adapter 的 late event / timeout 日志降噪测试。
3. 验收命令
   - `npm test -- --run src/main/libs/pruneOpenClawRuntime.test.ts src/main/libs/openclawRuntimePackaging.test.ts src/main/libs/agentEngine/openclawRuntimeAdapter.test.ts`
   - `npx tsc --project tsconfig.json --noEmit`
   - `npx tsc --project electron-tsconfig.json --noEmit`
   - `git diff --check`
4. 暂不处理
   - `.app` 打包、commit、push。
   - OpenClaw 主干重构。
   - POPO/IM 大迁移。
   - per-agent `modelSlice` 大迁移。
   - 主控台 UI 整包迁移。

## 2026-05-12：第 19 轮 OpenClaw runtime prune 目录统计防退化

本轮按第 18 轮规划继续 OpenClaw runtime / packaging 小闭环，聚焦 `prune-openclaw-runtime.cjs` 的统计准确性。复核后确认，`pruneUnusedBundledExtensions(...)` 删除的是整个 `dist/extensions/<extensionId>` 目录，已有统计会记录释放字节数和 `extensionsPruned`，但没有把删除目录计入 `dirsRemoved`。这不会影响裁剪结果，但会让打包日志低估实际删除动作。本轮只补统计，不改变哪些 bundled extension 会被保留或删除。

### 本轮代码更新

1. `scripts/prune-openclaw-runtime.cjs`
   - `pruneUnusedBundledExtensions(...)` 删除未保留的 bundled extension 目录后同步 `stats.dirsRemoved++`。
   - 保留原有 `bytesFreed` 和 `extensionsPruned` 行为。
2. `src/main/libs/pruneOpenClawRuntime.test.ts`
   - 在 bundled extension prune 回归测试中新增 `dirsRemoved === 1` 断言。
   - 确认保留的 `openai` extension 不被删除，未保留的 `slack` extension 被删除。

### 本轮刻意未改

1. 不修改 `BUNDLED_EXTENSIONS_TO_KEEP` allowlist。
2. 不改变 third-party extension duplicate SDK prune 策略。
3. 不改变 stub package 列表。
4. 不改 OpenClaw runtime 版本、安装/重建流程或 gateway lifecycle。
5. 不触碰青数品牌、工作台、治理链、唤醒/TTS。

### 原则校验

1. KISS
   - 只补一处统计递增，不重写 prune 流程。
2. YAGNI
   - 不引入更复杂的统计模型或日志格式。
3. SOLID
   - bundled extension 裁剪统计继续由 prune helper 自己维护，调用方只读取汇总。
4. DRY
   - 复用现有测试夹具，不新增重复目录构造工具。

### 本轮验证

1. `npm test -- --run src/main/libs/pruneOpenClawRuntime.test.ts src/main/libs/openclawRuntimePackaging.test.ts src/main/libs/agentEngine/openclawRuntimeAdapter.test.ts`
   - 3 个测试文件通过。
   - 68 条测试通过。
2. `npx tsc --project tsconfig.json --noEmit`
   - 通过。
3. `npx tsc --project electron-tsconfig.json --noEmit`
   - 通过。
4. `git diff --check`
   - 通过。

### 第 20 轮规划

1. 主攻方向
   - 从 OpenClaw runtime / packaging 转入 runtime adapter 小闭环，优先 late event / timeout / abort 诊断和日志降噪测试。
2. 计划动作
   - 复核 `openclawRuntimeAdapter.ts` 中 `handleChatAborted(...)`、client-side timeout watchdog、`terminatedRunIds`、`recentlyClosedRunIds` 的剩余测试缺口。
   - 优先选择“不改变状态机，只补测试或日志文字”的低风险点。
   - 如果发现需要改 gateway lifecycle 或 active turn 状态机，则记录为高耦合批次暂缓。
3. 验收命令
   - `npm test -- --run src/main/libs/agentEngine/openclawRuntimeAdapter.test.ts src/main/libs/openclawHistory.test.ts src/main/libs/openclawTranscript.test.ts`
   - `npx tsc --project tsconfig.json --noEmit`
   - `npx tsc --project electron-tsconfig.json --noEmit`
   - `git diff --check`
4. 暂不处理
   - `.app` 打包、commit、push。
   - OpenClaw 主干重构。
   - POPO/IM 大迁移。
   - per-agent `modelSlice` 大迁移。
   - 主控台 UI 整包迁移。

## 2026-05-12：第 20 轮 OpenClaw timeout watchdog 清理防退化

本轮按第 20 轮规划进入 OpenClaw runtime adapter 的 late event / timeout / abort 小闭环。复核现有 `terminatedRunIds`、`recentlyClosedRunIds`、manual stop、late chat error 等测试后，选择一个不改变状态机的防退化点：`cleanupSessionTurn(...)` 必须清掉 client-side timeout watchdog，否则已经完成或被清理的 turn 后续仍可能触发 timeout hint，造成“对话已结束却又提示超时”的错觉。本轮只补测试，不改生产逻辑。

### 本轮代码更新

1. `src/main/libs/agentEngine/openclawRuntimeAdapter.test.ts`
   - 新增 `cleanupSessionTurn clears timeout watchdog before it can emit a timeout hint`。
   - 构造 active turn，启动 `startTurnTimeoutWatchdog(...)`。
   - 调用 `cleanupSessionTurn(...)` 后推进 fake timers，确认不会新增 timeout assistant message，不会 emit message，也不会重新打开 active turn。

### 本轮刻意未改

1. 不修改 `handleChatAborted(...)` 的用户可见 timeout 提示策略。
2. 不修改 `startTurnTimeoutWatchdog(...)` 的 timeout 计算。
3. 不修改 `terminatedRunIds` / `recentlyClosedRunIds` 状态机。
4. 不改 OpenClaw gateway lifecycle。
5. 不触碰青数品牌、工作台、治理链、唤醒/TTS。

### 原则校验

1. KISS
   - 只补一个针对现有行为的单测，不改 runtime 分支。
2. YAGNI
   - 不新增取消队列或 watchdog registry。
3. SOLID
   - turn 清理职责仍集中在 `cleanupSessionTurn(...)`。
4. DRY
   - 复用现有 adapter test fake store 和 active turn 结构。

### 本轮验证

1. `npm test -- --run src/main/libs/agentEngine/openclawRuntimeAdapter.test.ts src/main/libs/openclawHistory.test.ts src/main/libs/openclawTranscript.test.ts`
   - 3 个测试文件通过。
   - 93 条测试通过。
2. `npx tsc --project tsconfig.json --noEmit`
   - 通过。
3. `npx tsc --project electron-tsconfig.json --noEmit`
   - 通过。
4. `git diff --check`
   - 通过。

### 第 21 轮规划

1. 主攻方向
   - OpenClaw history / transcript / channel session sync 最终回扫，重点防止长对话历史展示再次被短历史覆盖。
2. 计划动作
   - 复核 `openclawHistory.ts`、`openclawTranscript.ts`、`openclawChannelSessionSync.ts` 的现有测试。
   - 优先补 `output_text`、thinking block、timestamp、metadata、managed sessionKey 解析这类纯解析/同步防退化测试。
   - 如果发现需要改 SQLite 数据迁移或 reconcile 主策略，则记录为高耦合批次暂缓。
3. 验收命令
   - `npm test -- --run src/main/libs/openclawHistory.test.ts src/main/libs/openclawTranscript.test.ts src/main/libs/openclawChannelSessionSync.test.ts src/main/libs/agentEngine/openclawRuntimeAdapter.test.ts`
   - `npx tsc --project tsconfig.json --noEmit`
   - `npx tsc --project electron-tsconfig.json --noEmit`
   - `git diff --check`
4. 暂不处理
   - `.app` 打包、commit、push。
   - OpenClaw 主干重构。
   - POPO/IM 大迁移。
   - per-agent `modelSlice` 大迁移。
   - 主控台 UI 整包迁移。

## 2026-05-12：第 21 轮 OpenClaw transcript 顶层 output_text 恢复

本轮按第 21 轮规划回扫 OpenClaw history / transcript / channel session sync。复核后确认，`openclawHistory.ts` 已覆盖 `output_text`、timestamp、usage/model、heartbeat/transient status、managed prompt wrapper 等关键边界；`openclawChannelSessionSync.ts` 也已覆盖带冒号的 managed agentId 和多实例 channel key。实际找到的最小缺口在 transcript 恢复：如果 OpenClaw transcript 的 assistant message 把 Responses 风格文本存为顶层 `output_text`，而不是 `content` block，本地 transient session 恢复会漏掉这条 assistant 文本。本轮只补这一处纯解析逻辑。

### 本轮代码更新

1. `src/main/libs/openclawTranscript.ts`
   - assistant transcript 解析在 `content` 未解析出文本时，补读取顶层 `message.text` / `message.output` / `message.output_text`。
   - fallback 被刻意收窄为顶层文本字段，不扫描整个 `message`，避免把含 `tool_use` 的 content 数组误转为额外 assistant 消息。
2. `src/main/libs/openclawTranscript.test.ts`
   - 新增顶层 `output_text` 恢复测试。
   - 现有多轮 assistant/tool 顺序测试继续通过，用于确认 fallback 没有打乱 tool_use / tool_result 顺序。

### 本轮刻意未改

1. 不修改 SQLite 历史迁移。
2. 不修改 `reconcileWithHistory(...)` 主策略。
3. 不修改 channel session mapping。
4. 不改 OpenClaw gateway lifecycle。
5. 不触碰青数品牌、工作台、治理链、唤醒/TTS。

### 原则校验

1. KISS
   - 只补顶层文本字段读取，不重写 transcript parser。
2. YAGNI
   - 不引入新的 transcript schema 适配层。
3. SOLID
   - transcript 文件恢复职责仍集中在 `openclawTranscript.ts`。
4. DRY
   - 复用已有 `toStringValue(...)` 与现有测试结构。

### 本轮验证

1. `npm test -- --run src/main/libs/openclawHistory.test.ts src/main/libs/openclawTranscript.test.ts src/main/libs/openclawChannelSessionSync.test.ts src/main/libs/agentEngine/openclawRuntimeAdapter.test.ts`
   - 4 个测试文件通过。
   - 106 条测试通过。
2. `npx tsc --project tsconfig.json --noEmit`
   - 通过。
3. `npx tsc --project electron-tsconfig.json --noEmit`
   - 通过。
4. `git diff --check`
   - 通过。

### 第 22 轮规划

1. 主攻方向
   - Provider / Auth 低耦合回扫，优先模型参数、headers、Responses API，不进入完整 token refresher 主干。
2. 计划动作
   - 复核 `apiRequestHeaders`、`providerRequestConfig`、`Settings` 连接测试和 `shared/providers` 的剩余差异。
   - 优先补 OpenAI-compatible provider headers、Responses request body、max token 参数这类纯 helper 或测试。
   - 如果发现需要改 OAuth 登录、per-provider token refresher、Copilot auth 主链路，则记录为高耦合批次暂缓。
3. 验收命令
   - `npm test -- --run src/renderer/services/providerRequestConfig.test.ts src/renderer/services/config.test.ts src/shared/providers/constants.test.ts src/main/libs/openaiCodexAuth.test.ts`
   - `npx tsc --project tsconfig.json --noEmit`
   - `npx tsc --project electron-tsconfig.json --noEmit`
   - `git diff --check`
4. 暂不处理
   - `.app` 打包、commit、push。
   - 完整 OAuth / per-provider token refresher。
   - OpenClaw 主干重构。
   - POPO/IM 大迁移。
   - per-agent `modelSlice` 大迁移。
   - 主控台 UI 整包迁移。

### 剩余轮次估算

到公共能力可验收版本预计还剩约 6 轮：

1. 第 22 轮：Provider / Auth 低耦合回扫。
2. 第 23 轮：MCP / Skill security / log sanitize 公共能力回扫。
3. 第 24 轮：ScheduledTasks / IM 公共行为回扫。
4. 第 25 轮：Build / packaging / precommit 最终稳定性回扫。
5. 第 26 轮：Cowork UI / message rendering / artifacts 差异审计。
6. 第 27 轮：全量验收轮，更新剩余差异清单。

高耦合大批次仍单独排期，不计入这 6 轮：POPO/IM 大迁移、OpenClaw 主干重构、per-agent `modelSlice`、主控台 UI 整包迁移、完整 OAuth token refresher。

## 2026-05-12：第 22 轮 Provider/Auth API Key header 规范化

本轮按第 22 轮规划回扫 Provider / Auth 低耦合区域。复核 `apiRequestHeaders.ts`、`providerRequestConfig.ts`、`Settings.tsx`、`shared/providers` 与 `openaiCodexAuth.ts` 后，选择一个纯 helper 边界：用户配置 API Key 时如果带首尾空白，旧逻辑会把空白原样写入 `Authorization` 或 Gemini 的 `x-goog-api-key`，导致连接测试或实际请求可能被服务端判定为无效 token。本轮只在 header helper 内做规范化，不碰 OAuth 登录、per-provider token refresher 或 Copilot auth 主链路。

### 本轮代码更新

1. `src/renderer/services/apiRequestHeaders.ts`
   - 对传入 `apiKey` 先执行 `trim()`。
   - 标准 provider 使用 `Bearer <trimmedKey>`。
   - Gemini 使用 `x-goog-api-key: <trimmedKey>`。
   - 空白 key 不写入认证 header。
2. `src/renderer/services/apiRequestHeaders.test.ts`
   - 新增标准 provider API key trim 断言。
   - Gemini 测试改为带空白输入，验证 `x-goog-api-key` 也会被规范化。

### 本轮刻意未改

1. 不修改 Settings UI。
2. 不修改 `api.ts` 请求体结构。
3. 不修改 OpenAI OAuth / ChatGPT Codex 登录主链路。
4. 不修改 GitHub Copilot token refresh 行为。
5. 不触碰青数品牌、工作台、治理链、唤醒/TTS。

### 原则校验

1. KISS
   - 只在 header 构造入口 trim 一次。
2. YAGNI
   - 不新增 token validator 或 provider-specific key parser。
3. SOLID
   - header 规范化职责集中在 `apiRequestHeaders.ts`。
4. DRY
   - 避免在 `api.ts` 和 `Settings.tsx` 两个调用点各自 trim。

### 本轮验证

1. `npm test -- --run src/renderer/services/apiRequestHeaders.test.ts src/renderer/services/providerRequestConfig.test.ts src/renderer/services/config.test.ts src/shared/providers/constants.test.ts src/main/libs/openaiCodexAuth.test.ts`
   - 5 个测试文件通过。
   - 47 条测试通过。
2. `npx tsc --project tsconfig.json --noEmit`
   - 通过。
3. `npx tsc --project electron-tsconfig.json --noEmit`
   - 通过。
4. `git diff --check`
   - 通过。

### 第 23 轮规划

1. 主攻方向
   - MCP / Skill security / log sanitize 公共能力回扫。
2. 计划动作
   - 复核 `mcpLog.ts`、`mcpServerManager.ts`、`sanitizeForLog.ts`、`skillSecurity` 测试。
   - 优先补敏感信息脱敏、MCP abort/error 日志、skill security prompt audit 这类可单测的小闭环。
   - 如果发现需要改 MCP server 生命周期或 SkillHub 主流程，则记录为高耦合批次暂缓。
3. 验收命令
   - `npm test -- --run src/main/libs/mcpLog.test.ts src/main/libs/mcpServerManager.test.ts src/main/libs/sanitizeForLog.test.ts src/main/libs/skillSecurity/skillSecurityPromptAudit.test.ts src/main/libs/skillSecurity/skillSecurityRules.test.ts`
   - `npx tsc --project tsconfig.json --noEmit`
   - `npx tsc --project electron-tsconfig.json --noEmit`
   - `git diff --check`
4. 暂不处理
   - `.app` 打包、commit、push。
   - MCP server 生命周期大改。
   - SkillHub 主流程迁移。
   - OpenClaw 主干重构。
   - POPO/IM 大迁移。
   - per-agent `modelSlice` 大迁移。

### 剩余轮次估算

到公共能力可验收版本预计还剩约 5 轮：

1. 第 23 轮：MCP / Skill security / log sanitize 公共能力回扫。
2. 第 24 轮：ScheduledTasks / IM 公共行为回扫。
3. 第 25 轮：Build / packaging / precommit 最终稳定性回扫。
4. 第 26 轮：Cowork UI / message rendering / artifacts 差异审计。
5. 第 27 轮：全量验收轮，更新剩余差异清单。

高耦合大批次仍单独排期，不计入这 5 轮：POPO/IM 大迁移、OpenClaw 主干重构、per-agent `modelSlice`、主控台 UI 整包迁移、完整 OAuth token refresher。

## 2026-05-12：第 23 轮 MCP/Skill 日志脱敏边界补强

本轮按第 23 轮规划回扫 MCP / Skill security / log sanitize 公共能力。复核 `mcpLog.ts`、`mcpServerManager` 测试、`sanitizeForLog.ts` 与 `skillSecurity` 测试后，选择一个低耦合安全缺口：日志文本中如果包含 URL 查询参数形式的 `api_key`、`access_token`、`refresh_token`、`sessionId` 等敏感信息，旧逻辑可能只覆盖 `key=value` 普通文本，不能稳定保留 URL 结构并脱敏查询值。本轮只增强日志序列化 helper，不改 MCP 生命周期或 SkillHub 主流程。

### 本轮代码更新

1. `src/main/libs/sanitizeForLog.ts`
   - 新增 URL query 参数级脱敏规则。
   - 支持 `api_key`、`x-api-key`、`access_token`、`refresh_token`、`token`、`secret`、`password`、`cookie`、`sessionId` 等参数。
   - 保留 URL 中的非敏感参数、fragment 和上下文文本，便于后续排查 provider / MCP / OpenClaw 请求失败。
   - 收紧普通 inline `key=value` 脱敏边界，避免把后续 URL 参数一并吞掉。
2. `src/main/libs/sanitizeForLog.test.ts`
   - 新增单个敏感 URL query 参数脱敏测试。
   - 新增多个敏感 URL query 参数连续脱敏测试。
   - 验证安全参数、`status=401` 和 `#details` 仍保留。

### 本轮刻意未改

1. 不修改 MCP server lifecycle。
2. 不修改 `McpServerManager` 的 tool discovery / callTool 主流程。
3. 不修改 SkillHub 安装、发布或审计主流程。
4. 不修改 OpenClaw runtime patch。
5. 不触碰青数品牌、工作台、治理链、唤醒/TTS。

### 原则校验

1. KISS
   - 只在统一日志序列化入口追加 query 参数脱敏规则。
2. YAGNI
   - 不引入复杂 URL parser，也不扩大到完整 secret scanner。
3. SOLID
   - 敏感日志处理职责仍集中在 `sanitizeForLog.ts`。
4. DRY
   - MCP log、tool content log 和通用 log 继续复用同一个 `serializeForLog(...)`。

### 本轮验证

1. `npm test -- --run src/main/libs/mcpLog.test.ts src/main/libs/mcpServerManager.test.ts src/main/libs/sanitizeForLog.test.ts src/main/libs/skillSecurity/skillSecurityPromptAudit.test.ts src/main/libs/skillSecurity/skillSecurityRules.test.ts`
   - 5 个测试文件通过。
   - 130 条测试通过。
2. `npx tsc --project tsconfig.json --noEmit`
   - 通过。
3. `npx tsc --project electron-tsconfig.json --noEmit`
   - 通过。
4. `git diff --check`
   - 通过。

### 第 24 轮规划

1. 主攻方向
   - ScheduledTasks / IM 公共行为回扫。
2. 计划动作
   - 复核 `scheduledTask` service/slice、`TaskDetail`、`TaskForm`、`imScheduledTaskHandler`、`imCoworkHandler` 与相关测试。
   - 优先补“执行反馈不假卡住”、IM 绑定参数透传、任务运行状态边界这类低耦合公共 bugfix。
   - 如果发现需要迁移 POPO/IM 大 UI 或通道多实例主架构，则记录为高耦合批次暂缓。
3. 验收命令
   - `npm test -- --run src/renderer/services/scheduledTask.test.ts src/renderer/store/slices/scheduledTaskSlice.test.ts src/renderer/components/scheduledTasks/utils.test.ts src/main/im/imScheduledTaskHandler.test.ts src/main/im/imCoworkHandler.test.ts`
   - `npx tsc --project tsconfig.json --noEmit`
   - `npx tsc --project electron-tsconfig.json --noEmit`
   - `git diff --check`
4. 暂不处理
   - `.app` 打包、commit、push。
   - POPO/IM 大迁移。
   - 主控台 UI 整包迁移。
   - OpenClaw 主干重构。
   - per-agent `modelSlice` 大迁移。

### 剩余轮次估算

到公共能力可验收版本预计还剩约 4 轮：

1. 第 24 轮：ScheduledTasks / IM 公共行为回扫。
2. 第 25 轮：Build / packaging / precommit 最终稳定性回扫。
3. 第 26 轮：Cowork UI / message rendering / artifacts 差异审计。
4. 第 27 轮：全量验收轮，更新剩余差异清单。

高耦合大批次仍单独排期，不计入这 4 轮：POPO/IM 大迁移、OpenClaw 主干重构、per-agent `modelSlice`、主控台 UI 整包迁移、完整 OAuth token refresher。

## 2026-05-12：第 24 轮 ScheduledTasks/IM 定时提醒时区确认修复

本轮按第 24 轮规划回扫 ScheduledTasks / IM 公共行为。复核 `scheduledTask` service/slice、运行历史、`imScheduledTaskHandler`、`imCoworkHandler` 与相关测试后，确认手动执行按钮的即时 running 反馈、pending run 占位、运行完成后刷新已经在当前分支具备。实际找到的低耦合缺口在 IM 定时提醒确认文案：检测器返回 `2026-03-15T09:30:00.000+01:00` 这类带毫秒和时区的 ISO 时间戳时，旧解析无法提取原始时区钟点，会退回本地时间显示，跨时区提醒确认可能让用户误解。本轮只修这个解析边界。

### 本轮代码更新

1. `src/main/im/imScheduledTaskHandler.ts`
   - `extractClockFromIsoWithOffset(...)` 支持带毫秒的小数秒 ISO 时间戳。
   - 继续优先使用检测器返回的原始时区钟点，例如 `09:30`，避免跨时区提醒确认文案被本地时区改写。
2. `src/main/im/imScheduledTaskHandler.test.ts`
   - 新增带毫秒 ISO 时间戳的确认文案测试。
   - 继续保留无毫秒时区时间戳测试，确保既有行为不退化。

### 本轮刻意未改

1. 不修改 ScheduledTasks UI 大结构。
2. 不修改 POPO/IM 多实例大迁移。
3. 不修改 `IMCoworkHandler` 会话映射主流程。
4. 不修改定时任务 SQLite schema 或迁移。
5. 不触碰青数品牌、工作台、治理链、唤醒/TTS。

### 原则校验

1. KISS
   - 只放宽 ISO clock 正则的小数秒匹配。
2. YAGNI
   - 不引入新的日期库或完整 timezone formatter。
3. SOLID
   - IM 定时提醒确认文本的时钟提取仍由 `imScheduledTaskHandler.ts` 内聚处理。
4. DRY
   - 复用既有 `formatConfirmationText(...)` 与 normalize 流程，不复制时间格式化逻辑。

### 本轮验证

1. `npm test -- --run src/renderer/services/scheduledTask.test.ts src/renderer/store/slices/scheduledTaskSlice.test.ts src/renderer/components/scheduledTasks/utils.test.ts src/main/im/imScheduledTaskHandler.test.ts src/main/im/imCoworkHandler.test.ts`
   - 5 个测试文件通过。
   - 30 条测试通过。
2. `npx tsc --project tsconfig.json --noEmit`
   - 通过。
3. `npx tsc --project electron-tsconfig.json --noEmit`
   - 通过。
4. `git diff --check`
   - 通过。

### 第 25 轮规划

1. 主攻方向
   - Build / packaging / precommit 最终稳定性回扫。
2. 计划动作
   - 复核 `scripts/electron-builder-hooks.cjs`、`scripts/apply-openclaw-patches.cjs`、`scripts/openclaw-runtime-packaging.cjs`、`scripts/prune-openclaw-runtime.cjs` 与相关测试。
   - 优先补构建产物过滤、OpenClaw runtime patch 可重复执行、packaging 路径规范化这类低耦合构建稳定性 bugfix。
   - 如果发现需要重写安装策略或 OpenClaw 主干生命周期，则记录为高耦合批次暂缓。
3. 验收命令
   - `npm test -- --run src/main/libs/electronBuilderHooks.test.ts src/main/libs/applyOpenClawPatches.test.ts src/main/libs/openclawRuntimePackaging.test.ts src/main/libs/pruneOpenClawRuntime.test.ts src/main/libs/openclawEngineManager.test.ts`
   - `npx tsc --project tsconfig.json --noEmit`
   - `npx tsc --project electron-tsconfig.json --noEmit`
   - `git diff --check`
4. 暂不处理
   - `.app` 打包、commit、push。
   - OpenClaw 主干重构。
   - POPO/IM 大迁移。
   - per-agent `modelSlice` 大迁移。
   - 主控台 UI 整包迁移。

### 剩余轮次估算

到公共能力可验收版本预计还剩约 3 轮：

1. 第 25 轮：Build / packaging / precommit 最终稳定性回扫。
2. 第 26 轮：Cowork UI / message rendering / artifacts 差异审计。
3. 第 27 轮：全量验收轮，更新剩余差异清单。

高耦合大批次仍单独排期，不计入这 3 轮：POPO/IM 大迁移、OpenClaw 主干重构、per-agent `modelSlice`、主控台 UI 整包迁移、完整 OAuth token refresher。

## 2026-05-12：第 25 轮 Build/Packaging 插件校验日志准确性

本轮按第 25 轮规划回扫 Build / packaging / precommit 稳定性。复核 `electron-builder-hooks.cjs`、`apply-openclaw-patches.cjs`、`openclaw-runtime-packaging.cjs`、`prune-openclaw-runtime.cjs` 和对应测试后，确认当前分支已经覆盖 macOS speech/TTS helper 生成、OpenClaw patch 临时文件隔离、gateway.asar 路径归一、runtime prune 统计等关键防线。实际找到的低耦合缺口在插件预装校验日志：`verifyPreinstalledPlugins(...)` 会跳过 optional 插件和无 id 条目，但日志仍按原始 `plugins.length` 输出已验证数量，打包排障时容易误以为 optional 或无效条目也被检查。本轮只修日志计数，不改变通过/失败条件。

### 本轮代码更新

1. `scripts/electron-builder-hooks.cjs`
   - `verifyPreinstalledPlugins(...)` 新增 `verifiedCount`。
   - 只统计实际进入校验的 required plugin。
   - optional plugin 和无 id 条目继续跳过，不计入已验证数量。
   - 日志改为 `Verified N required preinstalled OpenClaw plugin(s).`。
2. `src/main/libs/electronBuilderHooks.test.ts`
   - 新增日志计数测试。
   - 覆盖 `{}`、空 id、required plugin、optional plugin 混合配置时只记录 1 个 required plugin。

### 本轮刻意未改

1. 不修改 OpenClaw runtime 构建命令。
2. 不修改 macOS helper 生成逻辑。
3. 不修改 Windows NSIS / Python / PortableGit 安装策略。
4. 不修改插件安装或下载流程。
5. 不触碰青数品牌、工作台、治理链、唤醒/TTS。

### 原则校验

1. KISS
   - 只增加一个计数变量，不改插件校验结构。
2. YAGNI
   - 不引入新的插件 schema validator。
3. SOLID
   - 插件预装校验和日志仍集中在 `verifyPreinstalledPlugins(...)`。
4. DRY
   - 继续复用同一轮循环完成校验和计数，不新增第二遍扫描。

### 本轮验证

1. `npm test -- --run src/main/libs/electronBuilderHooks.test.ts src/main/libs/applyOpenClawPatches.test.ts src/main/libs/openclawRuntimePackaging.test.ts src/main/libs/pruneOpenClawRuntime.test.ts src/main/libs/openclawEngineManager.test.ts`
   - 5 个测试文件通过。
   - 36 条测试通过。
2. `npx tsc --project tsconfig.json --noEmit`
   - 通过。
3. `npx tsc --project electron-tsconfig.json --noEmit`
   - 通过。
4. `git diff --check`
   - 通过。

### 第 26 轮规划

1. 主攻方向
   - Cowork UI / message rendering / artifacts 差异审计。
2. 计划动作
   - 复核 `CoworkSessionDetail.tsx`、`CoworkPromptInput.tsx`、`coworkSlice.ts`、`coworkService`、`artifactParser.ts` 和 artifacts slice。
   - 优先补消息展示完整性、streaming metadata、输入历史、slash command、artifact 解析这类低耦合测试或小修。
   - 如果发现需要整包替换主控台 UI、CodeMirror/artifacts 大面板或 per-agent `modelSlice`，则记录为高耦合批次暂缓。
3. 验收命令
   - `npm test -- --run src/renderer/services/cowork.test.ts src/renderer/store/slices/coworkSlice.test.ts src/renderer/components/cowork/promptInputHistory.test.ts src/renderer/components/cowork/promptSlashCommands.test.ts src/renderer/services/artifactParser.test.ts src/renderer/store/slices/artifactSlice.test.ts src/renderer/components/cowork/coworkArtifacts.test.ts`
   - `npx tsc --project tsconfig.json --noEmit`
   - `npx tsc --project electron-tsconfig.json --noEmit`
   - `git diff --check`
4. 暂不处理
   - `.app` 打包、commit、push。
   - 主控台 UI 整包迁移。
   - CodeMirror / artifacts 大面板 overhaul。
   - OpenClaw 主干重构。
   - POPO/IM 大迁移。

### 剩余轮次估算

到公共能力可验收版本预计还剩约 2 轮：

1. 第 26 轮：Cowork UI / message rendering / artifacts 差异审计。
2. 第 27 轮：全量验收轮，更新剩余差异清单。

高耦合大批次仍单独排期，不计入这 2 轮：POPO/IM 大迁移、OpenClaw 主干重构、per-agent `modelSlice`、主控台 UI 整包迁移、完整 OAuth token refresher。

## 2026-05-12：第 26 轮 Cowork Artifacts 裸路径识别补强

本轮按第 26 轮规划回扫 Cowork UI / message rendering / artifacts 差异。复核 `coworkSlice.ts`、`CoworkPromptInput` 输入历史、slash command、`artifactParser.ts`、`artifactSlice` 和 `coworkArtifacts.ts` 后，确认当前分支已具备 streaming 乱序兜底、输入历史、slash command、tool/file link artifact 去重等基础能力。实际找到的低耦合缺口在 artifact 裸路径识别：助手普通文本里出现 `/tmp/demo.html`、`/tmp/chart.svg`、`/tmp/screenshot.png`、`/tmp/flow.mmd` 这类可预览产物路径时，旧逻辑主要识别文档类扩展，导致右侧 artifacts 面板可能不出现这些生成物。本轮只扩展 parser，不改变主控台 UI。

### 本轮代码更新

1. `src/renderer/services/artifactParser.ts`
   - 扩展 `BARE_FILE_PATH_RE` 支持 `.html`、`.htm`、`.svg`、`.png`、`.jpg`、`.jpeg`、`.gif`、`.webp`、`.mermaid`、`.mmd`、`.jsx`、`.tsx`、`.css`、`.tsv`、`.xls` 等已有 artifact 类型映射的扩展名。
   - 增加中文标点边界处理，避免 `/tmp/chart.svg，` 这类文本把中文逗号误吞进路径导致漏识别。
   - 保持 markdown file link 和 Write tool artifact 原有逻辑不变。
2. `src/renderer/services/artifactParser.test.ts`
   - 新增普通文本中 HTML / SVG / 图片路径识别测试。
   - 新增 Mermaid / code 文件路径识别测试。
   - 首次测试发现中文标点边界问题后已补正，并纳入回归测试。

### 本轮刻意未改

1. 不修改 `CoworkSessionDetail.tsx` 视觉布局。
2. 不替换主控台 UI。
3. 不改 CodeMirror / artifacts 大面板。
4. 不修改消息持久化或 OpenClaw transcript 同步。
5. 不触碰青数品牌、工作台、治理链、唤醒/TTS。

### 原则校验

1. KISS
   - 只扩展已有裸路径正则和测试，不引入新 parser。
2. YAGNI
   - 不做通用文件系统路径解析器，也不读取磁盘验证文件存在。
3. SOLID
   - artifact 路径识别仍由 `artifactParser.ts` 负责。
4. DRY
   - 继续复用 `getArtifactTypeFromExtension(...)`，不在收集层复制扩展名映射。

### 本轮验证

1. `npm test -- --run src/renderer/services/cowork.test.ts src/renderer/store/slices/coworkSlice.test.ts src/renderer/components/cowork/promptInputHistory.test.ts src/renderer/components/cowork/promptSlashCommands.test.ts src/renderer/services/artifactParser.test.ts src/renderer/store/slices/artifactSlice.test.ts src/renderer/components/cowork/coworkArtifacts.test.ts`
   - 第一次运行发现中文标点边界导致 1 条 artifact 漏识别。
   - 修正后 7 个测试文件通过。
   - 39 条测试通过。
2. `npx tsc --project tsconfig.json --noEmit`
   - 通过。
3. `npx tsc --project electron-tsconfig.json --noEmit`
   - 通过。
4. `git diff --check`
   - 通过。

### 第 27 轮规划

1. 主攻方向
   - 全量验收轮，更新剩余差异清单。
2. 计划动作
   - 回扫本轮选择性合入后的核心测试矩阵，覆盖 OpenClaw runtime、Provider/Auth、MCP/Skill security、ScheduledTasks/IM、Cowork/artifacts。
   - 扫描冲突标记、剩余 `origin/main` 公共能力差异和高耦合暂缓项。
   - 更新 `0421changelog.md` 的最终验收状态、剩余差异、风险和后续建议。
   - 如果全量验收发现局部失败，只做低耦合修复；如涉及主控台 UI、POPO/IM 大迁移、OpenClaw 主干重构，则标为后续批次。
3. 验收命令
   - `rg -n "^(<<<<<<<|=======|>>>>>>>)" . --glob '!node_modules/**' --glob '!release/**' --glob '!outputs/**' --glob '!vendor/**'`
   - `npm test -- --run src/main/libs/agentEngine/openclawRuntimeAdapter.test.ts src/main/libs/openclawEngineManager.test.ts src/main/libs/openclawConfigSync.test.ts src/main/libs/openclawHistory.test.ts src/main/libs/openclawTranscript.test.ts src/main/libs/electronBuilderHooks.test.ts src/main/libs/applyOpenClawPatches.test.ts src/main/libs/openclawRuntimePackaging.test.ts src/main/libs/pruneOpenClawRuntime.test.ts src/main/libs/mcpLog.test.ts src/main/libs/sanitizeForLog.test.ts src/main/libs/skillSecurity/skillSecurityPromptAudit.test.ts src/main/libs/skillSecurity/skillSecurityRules.test.ts src/main/im/imScheduledTaskHandler.test.ts src/main/im/imCoworkHandler.test.ts src/renderer/services/providerRequestConfig.test.ts src/renderer/services/apiRequestHeaders.test.ts src/renderer/services/config.test.ts src/shared/providers/constants.test.ts src/renderer/services/scheduledTask.test.ts src/renderer/store/slices/scheduledTaskSlice.test.ts src/renderer/components/scheduledTasks/utils.test.ts src/renderer/services/cowork.test.ts src/renderer/store/slices/coworkSlice.test.ts src/renderer/services/artifactParser.test.ts src/renderer/store/slices/artifactSlice.test.ts src/renderer/components/cowork/coworkArtifacts.test.ts`
   - `npx tsc --project tsconfig.json --noEmit`
   - `npx tsc --project electron-tsconfig.json --noEmit`
   - `git diff --check`
4. 暂不处理
   - `.app` 打包、commit、push。
   - POPO/IM 大迁移。
   - OpenClaw 主干重构。
   - per-agent `modelSlice` 大迁移。
   - 主控台 UI 整包迁移。

### 剩余轮次估算

到公共能力可验收版本预计还剩约 1 轮：

1. 第 27 轮：全量验收轮，更新剩余差异清单。

高耦合大批次仍单独排期，不计入这 1 轮：POPO/IM 大迁移、OpenClaw 主干重构、per-agent `modelSlice`、主控台 UI 整包迁移、完整 OAuth token refresher。

## 2026-05-12：第 27 轮公共能力全量验收与剩余差异清单

本轮按第 27 轮规划执行最终验收，不再扩大功能合入范围。验收重点是：冲突标记、核心公共能力测试矩阵、TypeScript、diff whitespace、以及 `origin/main` 剩余差异分类。结论是：本轮选择性合入的公共能力已达到可验收状态；`origin/main` 仍有大量未全量合入内容，但主要集中在高耦合主干迁移、主控台/UI/IM/NIM 大迁移、OpenClaw 主干重构、完整 auth/provider token 刷新、AppUpdate、以及青数覆盖层差异，这些不应在当前保护青数品牌/工作台/治理链/唤醒/TTS的前提下继续硬合。

### 本轮验收结果

1. 冲突标记扫描
   - `rg -n "^(<<<<<<<|=======|>>>>>>>)" . --glob '!node_modules/**' --glob '!release/**' --glob '!outputs/**' --glob '!vendor/**'`
   - 未发现冲突标记。
2. 核心测试矩阵
   - `npm test -- --run ...`
   - 27 个测试文件通过。
   - 389 条测试通过。
3. TypeScript
   - `npx tsc --project tsconfig.json --noEmit` 通过。
   - `npx tsc --project electron-tsconfig.json --noEmit` 通过。
4. Diff whitespace
   - `git diff --check` 通过。
5. 工作区状态
   - 当前仍是 `front-design-merge`。
   - 工作区保留大量选择性合入改动，未提交。
   - `outputs/` 仍是未跟踪本地产物，本轮继续忽略。

### 已收口的公共能力域

1. OpenClaw runtime / history / transcript / packaging
   - 覆盖 gateway.asar 入口归一、runtime prune 统计、patch 临时路径隔离、timeout watchdog 清理、transcript 顶层 `output_text` 恢复。
2. Provider / Auth 低耦合能力
   - 覆盖 OpenAI max token model id trim、API key header trim、Responses URL 防退化、基础 provider config 测试。
3. MCP / Skill security / log sanitize
   - 覆盖 URL query 参数级敏感信息脱敏、MCP log 和 Skill security 相关测试。
4. ScheduledTasks / IM 公共行为
   - 覆盖手动执行即时 running 反馈、pending run 状态同步、IM 定时提醒时区确认、IM cowork 基础链路测试。
5. Cowork UI / message rendering / artifacts
   - 覆盖 streaming update 乱序兜底、输入历史、slash command、artifact 去重、裸路径识别和中文标点边界。
6. Build / packaging
   - 覆盖 macOS speech/TTS helper 生成、OpenClaw plugin 校验日志准确性、runtime packaging/prune/apply patch 基础回归。

### `origin/main` 仍未全量合入的主要区域

1. 高耦合 IM/NIM/POPO 大迁移
   - 包括 `nimGateway`、`nimQrLogin`、IM settings 全套多实例 UI、POPO/NIM schema、IM gateway config state 等。
   - 影响面：通道登录、实例配置、消息路由、Agent IM 绑定、OpenClaw channel sync。
   - 建议单独批次处理。
2. OpenClaw 主干重构与 engine/auth 深层迁移
   - 包括 `coworkOpenAICompatProxy`、Copilot token manager、OpenClaw config guards/local extensions/memory file/workspace migration、legacy engine cleanup 等。
   - 影响面：运行时启动、模型认证、配置生成、历史同步、workspace/memory 真源。
   - 建议单独新分支或专门窗口处理。
3. per-agent `modelSlice` / Provider UI 大迁移
   - `src/renderer/store/slices/modelSlice.ts` 与 provider selector/config UI 仍有差异。
   - 影响面：Agent 级模型配置、Provider 连接、主控台状态模型。
   - 建议在确认青数 Agent/内置治理链模型归属后再合。
4. 主控台 UI / Agent UI / Artifacts 大面板
   - `App.tsx`、agentSidebar、AgentAvatar、Artifacts renderers、CodeBlock/MarkdownContent 等仍有大量差异。
   - 影响面：青数品牌视觉、主操作台布局、对话/Agent 列表体验。
   - 当前已明确保护青数工作台和主控台 UI，因此本批次不继续整包替换。
5. AppUpdate / SQLite backup / 安装策略
   - `appUpdateCoordinator`、`appUpdateInstaller`、SQLite backup/recovery、Windows NSIS/Defender/PortableGit 等仍有剩余差异。
   - 影响面：升级、安装、数据备份和回滚策略。
   - 建议发布策略确认后单独处理。
6. 青数覆盖层差异
   - `qingshuModules`、`qingshuManaged`、治理链、Skill governance、brand runtime 等与 main 存在大量差异。
   - 这些是需要保留的业务覆盖层，不应按 main 强行拉平。

### 原则校验

1. KISS
   - 本轮只做验收和分类，不在最后一轮继续扩大改动。
2. YAGNI
   - 不为了追求“完全一致”引入高耦合迁移风险。
3. SOLID
   - 继续按能力域隔离：OpenClaw、Provider、MCP、ScheduledTasks、Cowork、Packaging 分别验证。
4. DRY
   - 验收命令矩阵复用前面各轮已验证过的核心测试集合。

### 最终结论

当前选择性合入路线已达到“公共能力可验收版本”：

1. 可验收
   - 已合入和验证的低耦合公共 bugfix / 防退化能力可进入后续本地 commit、打包测试或人工验收阶段。
2. 不建议继续在当前批次硬合
   - POPO/IM 大迁移、OpenClaw 主干重构、per-agent `modelSlice`、主控台 UI 整包迁移、完整 OAuth token refresher。
3. 后续如果继续推进
   - 推荐按“高耦合批次”重新规划，每批先明确保护边界，再单独合入、单独验收、单独打包。

### 剩余轮次估算

本轮规划内的公共能力选择性合入已完成，还剩 0 轮。

后续如继续追 main，建议新开独立规划批次：

1. 批次 A：IM/NIM/POPO 大迁移。
2. 批次 B：OpenClaw 主干重构与 auth/provider token refresher。
3. 批次 C：per-agent modelSlice。
4. 批次 D：AppUpdate / SQLite backup / 安装策略。
5. 批次 E：在不破坏青数主控台的前提下审慎吸收 UI/Artifacts 大面板能力。

## 2026-05-12：批次 A 第 1 轮 IM/NIM/POPO 迁移基线审计

上一阶段公共能力选择性合入已完成。本轮按新的高耦合批次 A 开始推进，但只做基线审计和分层规划，不直接整包替换 IM UI 或运行时。审计目标是确认当前分支已有能力、`origin/main` 剩余差异、风险边界和下一轮可控切口，继续保护青数品牌、工作台、内置治理链、唤醒/TTS。

### 本轮审计结论

1. 当前分支已有能力
   - DingTalk / Feishu / QQ / WeCom 已具备多实例 config、status、slice action 和 stale binding 清理。
   - Agent IM binding 已支持 `platform:instanceId` 形式，并有保存状态与 stale key 清理测试。
   - IMStore 已支持会话映射、`openClawSessionKey`、conversation reply route、multi-instance binding 清理。
   - IM cowork 和 IM scheduled task 基础链路测试通过。
2. `origin/main` 剩余 IM/NIM/POPO 差异
   - 文件规模约 32 个文件，`9839 insertions / 4530 deletions`。
   - 主要包括 `nimGateway`、`nimQrLoginService`、`src/main/ipcHandlers/nimQrLogin/*`、`src/shared/im/nimQrLogin.ts`。
   - Renderer 侧包括 `NimInstanceSettings.tsx`、`PopoInstanceSettings.tsx`、`IMSettingsMain.tsx`、`SchemaForm.tsx`、`nimSchemaFallback.ts`、Telegram/Discord settings 等。
   - Main 侧包括 `imGatewayConfigState`、`imGatewayManager`、`imStore`、`imCoworkHandler`、`imScheduledTaskHandler` 和 `types`。
3. 当前不宜硬合的原因
   - NIM/POPO 涉及登录、实例设置、schema fallback、IPC、gateway 生命周期和会话路由，影响面远超普通组件替换。
   - IM Settings UI 与 Agent IM binding、OpenClaw channel session sync、青数工作台展示存在耦合。
   - 直接整包贴 main 容易破坏当前已稳定的 Feishu/DingTalk/QQ/WeCom 多实例和青数业务展示。

### 本轮刻意未改

1. 不新增或替换 NIM/POPO runtime。
2. 不改 IM Settings UI。
3. 不改 OpenClaw channel session sync。
4. 不改 Agent 设置弹窗或青数工作台展示。
5. 不触碰青数品牌、治理链、唤醒/TTS。

### 原则校验

1. KISS
   - 高耦合批次先做真差异审计和测试基线，不直接动生产代码。
2. YAGNI
   - 不为尚未验收的 NIM/POPO 主迁移预先改 UI。
3. SOLID
   - 先按类型、store、IPC、gateway、UI 分层规划，避免跨层同时大改。
4. DRY
   - 复用现有 multi-instance binding 和 IMStore 清理能力，不重造一套绑定模型。

### 本轮验证

1. `npm test -- --run src/renderer/store/slices/imSlice.test.ts src/main/im/imStore.test.ts src/main/im/imCoworkHandler.test.ts src/main/im/imScheduledTaskHandler.test.ts src/renderer/components/agent/agentImBindingConfig.test.ts`
   - 5 个测试文件通过。
   - 40 条测试通过。
2. `npx tsc --project tsconfig.json --noEmit`
   - 通过。
3. `npx tsc --project electron-tsconfig.json --noEmit`
   - 通过。
4. `git diff --check`
   - 通过。

### 批次 A 第 2 轮规划

1. 主攻方向
   - 先合入 NIM QR 登录与类型/IPC 的最小骨架，不接入完整 UI。
2. 计划动作
   - 对比 `origin/main` 的 `src/shared/im/nimQrLogin.ts`、`src/main/ipcHandlers/nimQrLogin/*`、`src/main/im/nimQrLoginService.ts`。
   - 优先引入纯类型、常量、service 测试和 preload/electron type contract。
   - 只在现有 IM service/IPC 边界增加不影响其他平台的 NIM QR 能力。
   - 如果发现需要重写 `imGatewayManager` 或 `IMSettingsMain`，推迟到第 3/4 轮。
3. 验收命令
   - `npm test -- --run src/main/im/nimQrLoginService.test.ts src/renderer/services/nimQrLogin.test.ts src/renderer/store/slices/imSlice.test.ts src/main/im/imStore.test.ts`
   - `npx tsc --project tsconfig.json --noEmit`
   - `npx tsc --project electron-tsconfig.json --noEmit`
   - `git diff --check`
4. 暂不处理
   - POPO UI。
   - NIM settings 完整 UI。
   - IM gateway manager 大重构。
   - OpenClaw channel session sync 大改。
   - 主控台 UI 整包迁移。

### 剩余轮次估算

批次 A 预计还剩约 5 轮：

1. 第 2 轮：NIM QR 登录与 IPC/type 最小骨架。
2. 第 3 轮：NIM gateway runtime 最小接入与状态投影。
3. 第 4 轮：IM Settings UI 局部接入 NIM/POPO，不替换青数工作台。
4. 第 5 轮：Agent IM binding 与 NIM/POPO 实例联动验收。
5. 第 6 轮：批次 A 全量验收、剩余风险清单和是否进入打包判断。

## 2026-05-12：批次 A 第 2 轮 NIM QR 登录最小骨架

本轮继续按高耦合批次 A 小步推进，只补齐 `origin/main` 中 NIM 二维码登录的类型、服务、IPC 与 renderer 调用骨架，不接入完整 NIM gateway runtime，也不替换 IM 设置 UI。目标是先让后续 NIM/POPO 迁移有一条可测试、可回退、低耦合的底层通路。

### 本轮代码更新

1. 新增共享类型与解析工具
   - 新增 `src/shared/im/nimQrLogin.ts`。
   - 补齐 `NimQrLoginStatus`、`NimQrLoginErrorCode`、二维码默认参数、二维码 payload 构造、轮询 pending 判断、凭证归一化解析。
2. 新增主进程 NIM QR 登录服务
   - 新增 `src/main/im/nimQrLoginService.ts`。
   - 支持向网易云信 LBS 获取二维码、轮询绑定结果、超时映射、错误码归一化。
   - 新增 `src/main/im/nimQrLoginService.test.ts` 覆盖启动、pending、success、invalid user-agent。
3. 新增 NIM QR IPC 常量与 handler
   - 新增 `src/main/ipcHandlers/nimQrLogin/constants.ts`、`handlers.ts`、`index.ts`。
   - IPC 通道使用集中常量 `NimQrLoginIpc.Start` / `NimQrLoginIpc.Poll`，避免裸字符串继续扩散。
   - 在 `src/main/main.ts` 注册 `registerNimQrLoginHandlers({ startNimQrLogin, pollNimQrLogin })`。
4. 补齐 preload 与 renderer service
   - 在 `src/main/preload.ts` 的 `window.electron.im` 下新增 `nimQrLoginStart()`、`nimQrLoginPoll(uuid)`。
   - 在 `src/renderer/types/electron.d.ts` 补齐 `NimQrLoginStartResult` / `NimQrLoginPollResult` 类型声明。
   - 新增 `src/renderer/services/nimQrLogin.ts` 和 `src/renderer/services/nimQrLogin.test.ts`，覆盖 helper 与 IPC bridge 调用。

### 本轮刻意未改

1. 不接入 `nimGateway.ts` runtime。
2. 不修改 `IMSettingsMain.tsx`、`NimInstanceSettings.tsx`、`PopoInstanceSettings.tsx`。
3. 不改变 DingTalk / Feishu / QQ / WeCom 现有多实例保存逻辑。
4. 不改 Agent IM binding UI 与青数工作台展示。
5. 不触碰青数品牌、青数登录、治理链、唤醒/TTS。

### 原则校验

1. KISS
   - 只补最小可测试骨架，不一次性迁移 NIM UI + gateway + OpenClaw channel 全链路。
2. YAGNI
   - 当前还没有启用 NIM 设置页，因此不提前引入 schema form 和实例 UI 复杂度。
3. SOLID
   - 共享类型、主进程服务、IPC handler、renderer service 分层独立，后续 gateway/runtime 可以在独立轮次接入。
4. DRY
   - IPC 通道集中到 `NimQrLoginIpc`，轮询结果状态复用共享常量，避免 renderer/main 各自定义一套字符串。

### 本轮验证

1. `npm test -- --run src/main/im/nimQrLoginService.test.ts src/renderer/services/nimQrLogin.test.ts src/renderer/store/slices/imSlice.test.ts src/main/im/imStore.test.ts`
   - 4 个测试文件通过。
   - 33 条测试通过。
2. `npx tsc --project tsconfig.json --noEmit`
   - 通过。
3. `npx tsc --project electron-tsconfig.json --noEmit`
   - 通过。
4. `git diff --check`
   - 通过。

### 批次 A 第 3 轮规划

1. 主攻方向
   - 进入 NIM gateway runtime 最小接入与状态投影，但继续避免整包替换 IM 设置 UI。
2. 计划动作
   - 对比 `origin/main` 的 `src/main/im/nimGateway.ts`、`src/main/im/types.ts`、`src/main/im/imGatewayManager.ts`、`src/main/im/imStore.ts`。
   - 先判断 NIM runtime 是否能以独立 gateway adapter 接入现有 manager，而不是反向重写当前稳定多实例结构。
   - 优先补 `nim` 的 config/status 类型与 manager start/stop/test 最小路径。
   - 若发现必须引入 `imGatewayConfigState` 大重构，则把大重构拆到第 4 轮前置评估，不在第 3 轮硬贴。
3. 验收命令
   - `npm test -- --run src/main/im/nimQrLoginService.test.ts src/main/im/imStore.test.ts src/main/im/imCoworkHandler.test.ts src/main/im/imScheduledTaskHandler.test.ts src/renderer/store/slices/imSlice.test.ts`
   - `npx tsc --project tsconfig.json --noEmit`
   - `npx tsc --project electron-tsconfig.json --noEmit`
   - `git diff --check`

### 剩余轮次估算

批次 A 预计还剩约 4 轮：

1. 第 3 轮：NIM gateway runtime 最小接入与状态投影。
2. 第 4 轮：IM Settings UI 局部接入 NIM/POPO，不替换青数工作台。
3. 第 5 轮：Agent IM binding 与 NIM/POPO 实例联动验收。
4. 第 6 轮：批次 A 全量验收、剩余风险清单和是否进入打包判断。

## 2026-05-12：批次 A 第 3 轮 NIM runtime 接入复核与保护性测试

本轮原计划补 NIM gateway runtime 最小接入。实际对照当前分支与 `origin/main` 后确认：当前分支已具备 `nimGateway.ts`、`nimMedia.ts`、`nimQChatClient.ts`、NIM config/status 类型、`IMGatewayManager` 中的 NIM OpenClaw 模式、`IMStore` 的 NIM config 持久化、`OpenClawConfigSync` 的 `openclaw-nim-channel` 插件投影和 `LOBSTER_NIM_TOKEN` 环境变量投影。因此本轮没有重复整包搬 main，而是把 NIM runtime 行为用测试钉住，作为后续 UI/Agent binding 接入的验收底座。

### 本轮代码更新

1. 新增 NIM runtime 保护性测试
   - 新增 `src/main/im/imGatewayManager.nim.test.ts`。
   - 覆盖 `startGateway('nim')` 在 OpenClaw 模式下只触发 config sync 与 gateway connect。
   - 覆盖 `stopGateway('nim')` 只同步 disabled config，不主动重连 gateway。
   - 覆盖 `getStatus().nim` 将 `enabled + appKey + account + token` 投影为 connected，并显示 `botAccount`。
   - 覆盖 `testGateway('nim')` 在缺少凭证时 fail-fast，在凭证完整时返回 OpenClaw-ready 的 pass 结果。
2. 运行时接入结论
   - `IMGatewayManager` 已按 OpenClaw channel 模式处理 NIM，不再启动本地直连 gateway。
   - `OpenClawConfigSync` 已在 NIM 启用且凭证齐全时启用 `openclaw-nim-channel`，写入 `channels.nim`，并用 `LOBSTER_NIM_TOKEN` 承载 token。
   - `IMStore` 已保存 `nim` 单实例 config，并纳入 `isConfigured()`。
   - `imGatewayConfigState.ts` 的 `isPlatformEnabled()` 与 `isAnyGatewayConnected()` 已覆盖 NIM。

### 本轮刻意未改

1. 不替换 `nimGateway.ts` 为 main 的整包版本，因为当前差异只有 lint 注释级别，且当前分支已通过 TypeScript。
2. 不引入 `NimInstanceSettings.tsx`、`PopoInstanceSettings.tsx`、`SchemaForm.tsx`。
3. 不改 Agent 设置弹窗与 IM binding UI。
4. 不调整青数品牌、工作台、治理链、唤醒/TTS。
5. 不改变当前 DingTalk / Feishu / QQ / WeCom 多实例 helper 与绑定清理逻辑。

### 原则校验

1. KISS
   - 发现 runtime 已接入后，不为了“看起来合入更多”重复搬大文件，而是用最小测试锁住行为。
2. YAGNI
   - 暂不把 NIM UI/schema 引入 runtime 轮次，避免 UI 与状态模型同时大改。
3. SOLID
   - runtime 行为、config 投影、UI 接入继续分轮处理，保持职责边界清晰。
4. DRY
   - NIM 状态判断复用现有 `IMGatewayManager` / `imGatewayConfigState` 逻辑，不新增第二套 connected 判定。

### 本轮验证

1. `npm test -- --run src/main/im/imGatewayManager.nim.test.ts src/main/im/imGatewayConfigState.test.ts src/main/im/nimQrLoginService.test.ts src/main/im/imStore.test.ts src/main/im/imCoworkHandler.test.ts src/main/im/imScheduledTaskHandler.test.ts src/renderer/store/slices/imSlice.test.ts`
   - 7 个测试文件通过。
   - 42 条测试通过。
2. `npx tsc --project tsconfig.json --noEmit`
   - 通过。
3. `npx tsc --project electron-tsconfig.json --noEmit`
   - 通过。
4. `git diff --check`
   - 通过。

### 批次 A 第 4 轮规划

1. 主攻方向
   - IM Settings UI 局部接入 NIM/POPO，但不替换青数主控台和 Agent 设置弹窗整体结构。
2. 计划动作
   - 对比 `origin/main` 的 `NimInstanceSettings.tsx`、`PopoInstanceSettings.tsx`、`SchemaForm.tsx`、`nimSchemaFallback.ts`、`IMSettingsMain.tsx`。
   - 先判断当前 Settings 中是否已经有 NIM/POPO 基础配置入口；若已有，只补 QR 登录和字段保存缺口。
   - 优先接入 NIM QR 登录返回的 `appKey/account/token` 写回当前 `nim` config。
   - POPO 只补当前 UI 缺失的 QR 登录/凭证回填，不改 OpenClaw config 生成策略。
   - 如果 `IMSettingsMain.tsx` 与青数工作台/主控台耦合过高，拆成更小的 renderer service + 局部组件补丁，不整包替换。
3. 验收命令
   - `npm test -- --run src/renderer/services/nimQrLogin.test.ts src/renderer/store/slices/imSlice.test.ts src/main/im/imGatewayManager.nim.test.ts src/main/im/imStore.test.ts src/renderer/components/agent/agentImBindingConfig.test.ts`
   - `npx tsc --project tsconfig.json --noEmit`
   - `npx tsc --project electron-tsconfig.json --noEmit`
   - `git diff --check`

### 剩余轮次估算

批次 A 预计还剩约 3 轮：

1. 第 4 轮：IM Settings UI 局部接入 NIM/POPO，不替换青数工作台。
2. 第 5 轮：Agent IM binding 与 NIM/POPO 实例联动验收。
3. 第 6 轮：批次 A 全量验收、剩余风险清单和是否进入打包判断。

## 2026-05-12：批次 A 第 4 轮 IM Settings UI 局部接入 NIM QR

本轮进入 IM Settings UI 局部接入。对照后确认：当前分支使用自有的 `IMSettingsMain.tsx` 大组件，`origin/main` 没有同名文件；main 的 `NimInstanceSettings.tsx` / `PopoInstanceSettings.tsx` 属于多实例 UI 组件，不能直接整包替换，否则会影响当前青数设置覆盖层和已有多实例业务展示。因此本轮选择最小安全切口：保留当前 IM Settings 结构，只在 NIM 单实例设置区补齐二维码登录、轮询、凭证回填和启用保存；POPO 当前已经具备扫码登录、凭证回填和保存链路，本轮不重复改。

### 本轮代码更新

1. NIM 设置页新增扫码登录入口
   - 在 `src/renderer/components/im/IMSettingsMain.tsx` 的 NIM 面板顶部新增二维码登录区。
   - 复用上一轮补齐的 `src/renderer/services/nimQrLogin.ts`，调用 `startQrLogin()` 和 `pollQrLogin(uuid)`。
   - 支持 loading、showing、success、error 状态和倒计时过期提示。
2. NIM 凭证自动回填和启用
   - 扫码成功后自动回填 `appKey`、`account`、`token`。
   - 同步设置 `enabled: true`。
   - 通过 `imService.updateConfig({ nim })` 触发持久化和 OpenClaw config sync。
   - 成功后刷新 IM status，保证 UI 立刻看到 NIM connected 投影。
3. NIM QR 文案补齐
   - 在 `src/renderer/services/i18n.ts` 补齐中英文文案。
   - 包括登录按钮、扫码提示、倒计时、刷新、取消、成功、失败、过期和 user-agent 不支持提示。
4. POPO 复核结论
   - 当前 `IMSettingsMain.tsx` 已有 POPO QR 登录、二维码展示、poll 回填 `appKey/appSecret/aesKey`、启用和 OpenClaw config sync。
   - 本轮没有把 main 的 `PopoInstanceSettings.tsx` 整包套入，避免引入多实例 UI 迁移风险。

### 本轮刻意未改

1. 不引入 main 的 `NimInstanceSettings.tsx` / `PopoInstanceSettings.tsx` 多实例组件。
2. 不替换当前 `IMSettingsMain.tsx`。
3. 不改青数工作台、主控台 UI、Agent 设置弹窗、治理链、唤醒/TTS。
4. 不把 NIM/POPO 改成多实例模型，当前仍保持单实例配置入口。
5. 不改变 DingTalk / Feishu / QQ / WeCom 已稳定的多实例逻辑。

### 原则校验

1. KISS
   - 在当前真实 UI 结构中补 NIM QR 入口，不为了 main 一致性整包迁移多实例组件。
2. YAGNI
   - 当前验收目标是 NIM/POPO 可配置可保存，不提前把 NIM/POPO 全量多实例化。
3. SOLID
   - QR 登录流程复用 renderer service，UI 只做状态展示和配置回填。
4. DRY
   - NIM QR 状态码、错误码和轮询逻辑复用共享 service，不在 UI 里重新实现协议解析。

### 本轮验证

1. `npm test -- --run src/renderer/services/nimQrLogin.test.ts src/renderer/store/slices/imSlice.test.ts src/main/im/imGatewayManager.nim.test.ts src/main/im/imStore.test.ts src/renderer/components/agent/agentImBindingConfig.test.ts`
   - 5 个测试文件通过。
   - 45 条测试通过。
2. `npx tsc --project tsconfig.json --noEmit`
   - 通过。
3. `npx tsc --project electron-tsconfig.json --noEmit`
   - 通过。
4. `git diff --check`
   - 通过。

### 批次 A 第 5 轮规划

1. 主攻方向
   - Agent IM binding 与 NIM/POPO 配置联动验收。
2. 计划动作
   - 核对 Agent 设置 UI 中 IM 渠道列表是否包含 NIM、POPO、Weixin、NeteaseBee 等单实例渠道。
   - 核对保存按钮可用性是否会因为单实例/多实例混合配置失效。
   - 验证 `platformAgentBindings` 对单实例平台使用 `nim` / `popo`，对多实例平台使用 `platform:instanceId`。
   - 补测试覆盖 NIM/POPO 绑定保存、stale binding 清理不误删单实例绑定。
   - 如发现 UI 仍按旧单实例/多实例混合逻辑禁用保存，做最小修复。
3. 验收命令
   - `npm test -- --run src/renderer/components/agent/agentImBindingConfig.test.ts src/renderer/store/slices/imSlice.test.ts src/main/im/imStore.test.ts src/main/im/imGatewayManager.nim.test.ts`
   - `npx tsc --project tsconfig.json --noEmit`
   - `npx tsc --project electron-tsconfig.json --noEmit`
   - `git diff --check`

### 剩余轮次估算

批次 A 预计还剩约 2 轮：

1. 第 5 轮：Agent IM binding 与 NIM/POPO 实例联动验收。
2. 第 6 轮：批次 A 全量验收、剩余风险清单和是否进入打包判断。

## 2026-05-12：批次 A 第 5 轮 Agent IM binding 与 NIM/POPO 联动验收

本轮继续围绕 IM/NIM/POPO 高耦合区做小步验收。先核对当前真实 UI 和平台注册表后确认：`src/shared/platform/constants.ts` 已把 `nim`、`netease-bee`、`popo` 放入中文区可见平台，`AgentCreateModal.tsx` 和 `AgentSettingsPanel.tsx` 会通过 `getVisibleIMPlatforms()` 渲染这些单实例渠道；多实例渠道仍只限 `dingtalk`、`feishu`、`qq`、`wecom`。因此本轮不改 UI 布局，只补测试锁住“单实例平台级 key”和“保存 dirty 判断”的关键路径，避免以后再把 NIM/POPO 误迁成多实例实例 key。

### 本轮代码更新

1. Agent IM binding helper 增加 NIM/POPO 单实例验收
   - 在 `src/renderer/components/agent/agentImBindingConfig.test.ts` 补充 `nim` / `popo` 配置识别测试。
   - 明确 `nim` / `popo` 不是多实例平台，不应走 `platform:instanceId` 绑定模型。
   - 验证 `collectAgentBoundBindingKeys()` 会保留 `nim` / `popo` 平台级绑定，同时继续过滤已禁用的多实例 Feishu 绑定。
   - 验证 `buildAgentBindingKeyBindings()` 会用平台级 key 写入 `nim` / `popo`，并清理当前 Agent 的旧实例绑定。
2. Agent 草稿 dirty 判断补齐 NIM/POPO 覆盖
   - 在 `src/renderer/components/agent/agentDraftState.test.ts` 补充 NIM/POPO 单实例绑定变化测试。
   - 选中或取消 `nim` / `popo` 会被视为可保存改动。
   - `nim` / `popo` 顺序不同但集合一致时保持不可保存，避免误触发脏状态。

### 本轮复核结论

1. 新建 Agent 弹窗
   - `AgentCreateModal.tsx` 的创建按钮只受 `creating` 影响，不会因为 IM dirty 判断而保持灰态。
   - 选择 NIM/POPO 后，如果创建成功，会通过 `buildAgentBindingKeyBindings()` 写入 `settings.platformAgentBindings`。
2. 编辑 Agent 弹窗
   - `AgentSettingsPanel.tsx` 对普通 Agent 的保存按钮只受 `saving` 影响；managed 只读 Agent 仍保持青数治理链的只读限制。
   - IM 绑定变化通过 `hasCreateAgentDraftChanges()` 和 `hasBindingSelectionChanges()` 进入保存路径。
3. 保存 key 语义
   - 单实例：`nim`、`popo`、`weixin`、`netease-bee` 等继续使用平台级 key。
   - 多实例：`dingtalk:instanceId`、`feishu:instanceId`、`qq:instanceId`、`wecom:instanceId` 继续使用实例级 key。

### 本轮刻意未改

1. 不把 NIM/POPO 改成多实例模型。
2. 不替换 `IMSettingsMain.tsx`，避免影响当前青数设置覆盖层。
3. 不改青数品牌、工作台、内置治理链、唤醒/TTS。
4. 不改 DingTalk / Feishu / QQ / WeCom 已有多实例 UI 和保存逻辑。

### 原则校验

1. KISS
   - 真实代码已经满足 UI 展示和保存路径，本轮只用测试锁住行为，不为了“多做一点”引入 UI 重构。
2. YAGNI
   - 暂不把 NIM/POPO 提前迁到多实例模型，当前需求只要求可配置、可绑定、可保存。
3. SOLID
   - 平台分类、绑定 key 生成、草稿 dirty 判断分别由独立 helper 负责，UI 继续只做状态展示和事件触发。
4. DRY
   - 继续复用 `agentImBindingConfig.ts` 和 `agentDraftState.ts` 的统一判断，不在 Agent 弹窗里新增第二套 NIM/POPO 特判。

### 本轮验证

1. `npm test -- --run src/renderer/components/agent/agentImBindingConfig.test.ts src/renderer/components/agent/agentDraftState.test.ts src/renderer/store/slices/imSlice.test.ts src/main/im/imStore.test.ts src/main/im/imGatewayManager.nim.test.ts`
   - 5 个测试文件通过。
   - 47 条测试通过。
2. `npx tsc --project tsconfig.json --noEmit`
   - 通过。
3. `npx tsc --project electron-tsconfig.json --noEmit`
   - 通过。
4. `git diff --check`
   - 通过。

### 批次 A 第 6 轮规划

1. 主攻方向
   - 批次 A 全量收口验收，确认 NIM/POPO 从设置、运行时、Agent 绑定到 OpenClaw config sync 的链路没有断点。
2. 计划动作
   - 汇总第 2-5 轮新增的 NIM QR、NIM runtime、IM Settings、Agent binding 测试覆盖。
   - 再跑一次 IM/NIM/POPO 相关测试组合和 TypeScript 检查。
   - 复核是否仍有 main 的 IM/POPO/NIM 公共 bugfix 未纳入当前批次。
   - 输出批次 A 风险清单、验收边界和是否进入下一批高耦合迁移的建议。
3. 验收命令
   - `npm test -- --run src/renderer/services/nimQrLogin.test.ts src/renderer/components/agent/agentImBindingConfig.test.ts src/renderer/components/agent/agentDraftState.test.ts src/renderer/store/slices/imSlice.test.ts src/main/im/imStore.test.ts src/main/im/imGatewayManager.nim.test.ts src/main/im/nimQrLoginService.test.ts src/main/im/imCoworkHandler.test.ts`
   - `npx tsc --project tsconfig.json --noEmit`
   - `npx tsc --project electron-tsconfig.json --noEmit`
   - `git diff --check`

### 剩余轮次估算

批次 A 预计还剩约 1 轮：

1. 第 6 轮：批次 A 全量验收、剩余风险清单和下一批合入边界判断。

## 2026-05-12：批次 A 第 6 轮 IM/NIM/POPO 全量收口验收

本轮按第 5 轮规划完成批次 A 收口验收。验收重点不是继续扩大迁移面，而是把已合入的 NIM QR、NIM runtime、IM Settings 局部接入、Agent IM binding、OpenClaw config sync 串成一条可验证链路。对照 `origin/main` 后确认，main 仍有 `NimInstanceSettings.tsx`、`PopoInstanceSettings.tsx`、`nimSchemaFallback.ts` 和多实例 schema UI 体系；这些属于更大的 NIM/POPO 多实例 UI/schema 迁移，不应混入当前批次，否则会影响当前分支的 `IMSettingsMain.tsx` 青数设置覆盖层和已有单实例模型。

### 本轮代码更新

1. 未新增业务代码
   - 本轮是收口验收轮，不继续扩大改动。
   - 既有第 2-5 轮改动已经覆盖 NIM QR 登录、NIM runtime 投影、IM Settings 局部接入、Agent 绑定 key 和保存 dirty 判断。
2. 文档更新
   - 在 `0421changelog.md` 记录批次 A 收口结果、验证命令、未纳入范围和下一批建议。

### 本轮复核结论

1. 当前分支已具备的能力
   - NIM QR 登录主链路已存在：`src/shared/im/nimQrLogin.ts`、`src/main/im/nimQrLoginService.ts`、`src/main/ipcHandlers/nimQrLogin/*`、`src/renderer/services/nimQrLogin.ts`。
   - NIM runtime 已接入 OpenClaw 模式：`IMGatewayManager.startGateway('nim')` 会 sync OpenClaw config 并连接 gateway。
   - NIM status 能从单实例配置投影为 connected/botAccount。
   - Agent IM binding 对 NIM/POPO 使用平台级 key：`nim` / `popo`。
   - OpenClaw config sync 已能写入 `moltbot-popo` 和 `nim` channel，并通过 env 透传敏感 token。
2. 当前分支刻意保留的差异
   - 当前分支保留 `IMSettingsMain.tsx`，不整包使用 main 的 `NimInstanceSettings.tsx` / `PopoInstanceSettings.tsx`。
   - NIM/POPO 仍是单实例模型；DingTalk/Feishu/QQ/WeCom 仍是多实例模型。
   - main 的 NIM/POPO 多实例 schema UI 暂不纳入批次 A。
3. main 仍有但当前批次未合入的区域
   - NIM 多实例 UI 组件和实例级 QR 保存流程。
   - POPO 多实例 UI 组件和实例级 QR 保存流程。
   - schema fallback / SchemaForm 驱动的 NIM 高级配置表单。
   - Telegram/Discord/Email 等更大 IM 多实例化结构；这些会牵动类型、状态和设置页结构，建议单独批次处理。

### 本轮刻意未改

1. 不迁移 NIM/POPO 多实例模型。
2. 不替换 `IMSettingsMain.tsx`。
3. 不改青数品牌、工作台、内置治理链、唤醒/TTS。
4. 不改 main 中 Email channel 相关大迁移。
5. 不做打包、提交或推送；当前轮只做合入批次验收。

### 原则校验

1. KISS
   - 本轮只做验证和边界确认，不为了“收口”再引入新复杂度。
2. YAGNI
   - 多实例 NIM/POPO schema UI 是下一阶段能力，不是当前单实例可用链路的必要条件。
3. SOLID
   - runtime、config sync、Agent binding、Settings UI 仍按职责分层验收，没有把 UI schema 逻辑塞进绑定 helper。
4. DRY
   - 继续复用已有测试组合和统一 helper，避免为了 NIM/POPO 另写平行判断。

### 本轮验证

1. `npm test -- --run src/renderer/services/nimQrLogin.test.ts src/renderer/components/agent/agentImBindingConfig.test.ts src/renderer/components/agent/agentDraftState.test.ts src/renderer/store/slices/imSlice.test.ts src/main/im/imStore.test.ts src/main/im/imGatewayManager.nim.test.ts src/main/im/nimQrLoginService.test.ts src/main/im/imCoworkHandler.test.ts`
   - 8 个测试文件通过。
   - 63 条测试通过。
2. `npm test -- --run src/main/libs/openclawConfigSync.test.ts src/main/libs/openclawConfigSync.runtime.test.ts src/main/im/imGatewayConfigState.test.ts src/main/im/imScheduledTaskHandler.test.ts src/main/im/imChatHandler.test.ts`
   - 4 个测试文件通过。
   - 56 条测试通过。
   - 说明：命令中包含的 `src/main/im/imChatHandler.test.ts` 当前不存在，Vitest 实际运行了存在的 4 个文件。
3. `npx tsc --project tsconfig.json --noEmit`
   - 通过。
4. `npx tsc --project electron-tsconfig.json --noEmit`
   - 通过。
5. `git diff --check`
   - 通过。

### 批次 A 收口判断

批次 A 已达到可验收状态：当前分支已经具备 NIM/POPO 单实例可配置、可扫码、可绑定 Agent、可同步 OpenClaw config、可进入 runtime 的闭环。剩余 main 差异主要是更大范围的多实例 UI/schema 迁移，不应继续混入批次 A。

### 下一批规划

建议进入批次 B，主攻“是否引入 main 的 NIM/POPO 多实例 UI/schema 体系”。建议拆成 3 轮：

1. B1：只做差异设计和数据迁移方案
   - 明确是否把 NIM/POPO 从单实例升级到多实例。
   - 设计旧配置 `config.nim` / `config.popo` 到 `instances[0]` 的兼容迁移。
   - 明确 Agent binding 从 `nim` / `popo` 到 `nim:instanceId` / `popo:instanceId` 的过渡策略。
2. B2：先迁 NIM，多实例 UI/schema 与 QR 保存闭环
   - 引入或改造 `NimInstanceSettings.tsx`，适配当前青数 `IMSettingsMain.tsx`。
   - 补齐类型、store、config sync 和 runtime 测试。
3. B3：再迁 POPO，多实例 UI/schema 与 QR 保存闭环
   - 引入或改造 `PopoInstanceSettings.tsx`，避免破坏当前 POPO 单实例扫码可用性。
   - 补齐 Agent binding、OpenClaw config sync、状态展示测试。

### 剩余轮次估算

批次 A 剩余 0 轮。

若继续追 main 的 NIM/POPO 多实例 UI/schema，对应新批次 B 预计还需约 3 轮。

## 2026-05-12：批次 B 第 1 轮 NIM/POPO 多实例迁移设计与兼容护栏

本轮进入新批次 B，但没有直接替换 UI，也没有把当前可用的 NIM/POPO 单实例配置改成多实例持久化结构。先对照 `origin/main` 后确认：main 已经把 NIM/POPO 定义为 `instances[]`，并配套 `NimInstanceSettings.tsx`、`PopoInstanceSettings.tsx`、schema fallback 与实例级 QR 保存；当前分支仍保留青数 `IMSettingsMain.tsx` 覆盖层和单实例 `config.nim` / `config.popo`。为了避免一步到位造成状态漂移，本轮先新增纯函数迁移规划层，锁住下一轮真正迁 NIM 时的数据迁移规则。

### 本轮代码更新

1. 新增 NIM/POPO 单实例到多实例迁移规划 helper
   - 新增 `src/main/im/imSingleToMultiInstanceMigration.ts`。
   - 提供 `planSingleToMultiInstanceMigration()`，输入旧单实例配置、现有实例、Agent binding、实例 ID 生成器，输出迁移计划。
   - 提供 `hasMeaningfulNimSingleConfig()`，判断 NIM 旧配置是否值得迁移：支持 `appKey/account/token` 和 main 里的 legacy `nimToken`。
   - 提供 `hasMeaningfulPopoSingleConfig()`，判断 POPO 旧配置是否值得迁移：支持 enabled、appKey、appSecret、token、aesKey 任一有效字段。
2. 新增迁移规划测试
   - 新增 `src/main/im/imSingleToMultiInstanceMigration.test.ts`。
   - 覆盖 NIM/POPO 有效配置识别。
   - 覆盖 `nim` -> `nim:instanceId`、`popo` -> `popo:instanceId` 的 Agent binding 迁移。
   - 覆盖已有实例时跳过迁移，避免重复制造实例。
   - 覆盖空配置时跳过迁移，避免把空默认值变成无意义实例。

### 本轮复核结论

1. 为什么不直接迁 store
   - 直接把 `IMGatewayConfig.nim` / `IMGatewayConfig.popo` 改成 `instances[]` 会同时牵动 renderer 类型、IM Settings、Agent binding、OpenClaw config sync、runtime status 和已存在用户配置。
   - 当前 NIM/POPO 单实例链路已经可验收，先上转换护栏可以降低 B2/B3 迁移风险。
2. main 的迁移思路
   - main 通过 `randomUUID()` 生成实例 ID。
   - 将旧 `platformAgentBindings.nim` 改成 `platformAgentBindings['nim:<id>']`。
   - 将旧 `platformAgentBindings.popo` 改成 `platformAgentBindings['popo:<id>']`。
   - 将旧 session mapping 的 `platform` 从 `nim` / `popo` 更新为实例级 key。
3. 当前分支推荐迁移策略
   - B2 迁 NIM 时先只支持旧 `nim` 单实例自动升级成一个 `nim:<id>` 默认实例。
   - B3 迁 POPO 时同理升级成一个 `popo:<id>` 默认实例。
   - 在真正迁移 Agent UI 前，绑定 helper 必须同时兼容平台级旧 key 和实例级新 key。

### 本轮刻意未改

1. 不改变 `IMGatewayConfig.nim` / `IMGatewayConfig.popo` 的当前类型。
2. 不改 `IMSettingsMain.tsx`。
3. 不接入 `NimInstanceSettings.tsx` / `PopoInstanceSettings.tsx`。
4. 不迁移 SQLite 中的真实用户配置。
5. 不改 OpenClaw config sync 的当前单实例投影。

### 原则校验

1. KISS
   - 先用纯函数描述迁移规则，不把 UI、存储、runtime 同时改掉。
2. YAGNI
   - 本轮只做 B2/B3 必需的迁移护栏，不提前实现完整多实例 UI。
3. SOLID
   - 数据迁移规划独立成 helper，后续 store 负责调用，UI 不承载迁移规则。
4. DRY
   - NIM/POPO 共享同一套 `planSingleToMultiInstanceMigration()`，平台差异只通过 `shouldMigrateConfig` 和默认名称注入。

### 本轮验证

1. `npm test -- --run src/main/im/imSingleToMultiInstanceMigration.test.ts src/main/im/imStore.test.ts src/renderer/components/agent/agentImBindingConfig.test.ts`
   - 3 个测试文件通过。
   - 29 条测试通过。
2. `npx tsc --project electron-tsconfig.json --noEmit`
   - 通过。
3. `npx tsc --project tsconfig.json --noEmit`
   - 通过。

### 批次 B 第 2 轮规划

1. 主攻方向
   - 先迁 NIM，多实例数据结构和运行时投影优先，UI 只做最小接入或保持兼容，不替换青数设置覆盖层。
2. 计划动作
   - 在 main/renderer 类型中补 NIM multi-instance 类型，但保留单实例兼容入口。
   - 在 `IMStore` 中接入 B1 helper，将旧 `nim` 配置迁移成一个默认实例。
   - 迁移 `platformAgentBindings.nim` 到 `nim:<instanceId>`，并保留读取旧 key 的兼容策略。
   - 调整 `IMGatewayManager.getStatus()` / `isConnected('nim')` / `startGateway('nim')` 的多实例投影。
   - 调整 OpenClaw config sync：先从 enabled NIM instances 里选择主实例生成当前 OpenClaw channel 配置，避免一次引入多个 NIM channel 导致 gateway 风险。
   - 补 NIM store/runtime/config sync 测试。
3. 验收命令
   - `npm test -- --run src/main/im/imSingleToMultiInstanceMigration.test.ts src/main/im/imStore.test.ts src/main/im/imGatewayManager.nim.test.ts src/main/libs/openclawConfigSync.runtime.test.ts src/renderer/components/agent/agentImBindingConfig.test.ts`
   - `npx tsc --project electron-tsconfig.json --noEmit`
   - `npx tsc --project tsconfig.json --noEmit`
   - `git diff --check`

### 剩余轮次估算

批次 B 预计还剩约 2 轮：

1. B2：NIM 多实例数据结构、store 迁移、runtime/status/config sync 最小闭环。
2. B3：POPO 多实例数据结构、store 迁移、设置 UI/QR 保存和 Agent binding 闭环。

## 2026-05-12：批次 B 第 2 轮 NIM 多实例 store/runtime 最小闭环

本轮按 B1 规划先迁 NIM，但没有把 renderer 的 `config.nim` 公开形态直接改成 `instances[]`。原因是当前 `IMSettingsMain.tsx` 和 Agent IM binding UI 仍按单实例 `config.nim` 工作，如果这轮直接改公开类型，会连带重构设置页、Agent 弹窗和 OpenClaw config sync，风险过高。因此本轮采用“内部多实例、外部主实例投影”的过渡方案：main store 可以读写 `nim:<instanceId>`，旧单实例配置会迁移成一个默认实例；但 `getConfig().nim` 仍投影为主实例，让现有 UI 和 OpenClaw config sync 不破。

### 本轮代码更新

1. main 侧补 NIM 多实例类型
   - 在 `src/main/im/types.ts` 新增 `NimInstanceConfig`、`NimInstanceStatus`、`NimMultiInstanceConfig`、`NimMultiInstanceStatus`。
   - 新增 `MAX_NIM_INSTANCES`、`DEFAULT_NIM_MULTI_INSTANCE_CONFIG`、`DEFAULT_NIM_MULTI_INSTANCE_STATUS`。
   - `NimConfig` 增加 legacy `nimToken` 可选字段，兼容 main 的历史迁移逻辑。
2. `IMStore` 增加 NIM 实例读写能力
   - 新增 `getNimInstances()`、`getNimInstanceConfig()`、`setNimInstanceConfig()`、`deleteNimInstance()`、`getNimMultiInstanceConfig()`、`setNimMultiInstanceConfig()`。
   - 旧 `nim` 单实例配置在首次读取 instances 时迁移为一个 `nim:<uuid>` 默认实例。
   - `setNimConfig()` 若已有实例，会更新主实例；没有实例时继续写旧单实例配置，保护当前 UI 写入路径。
   - `getConfig().nim` 继续返回主实例投影，OpenClaw config sync 和 Settings UI 暂不感知内部多实例结构。
3. NIM runtime 投影测试补齐
   - 在 `src/main/im/imGatewayManager.nim.test.ts` 增加主 NIM 实例 connected 投影测试。
   - 验证存在多个内部 NIM 实例时，enabled 且凭证完整的主实例会投影到 `getStatus().nim`。
4. NIM store 迁移测试补齐
   - 在 `src/main/im/imStore.test.ts` 增加旧单实例迁移到一个 NIM instance 的测试。
   - 增加 `setNimConfig()` 更新主实例测试。
   - 增加替换 NIM 多实例配置时清理 stale instance binding 的测试。

### 本轮关键取舍

1. 暂不迁移 `platformAgentBindings.nim`
   - B1 helper 已验证 `nim` -> `nim:<instanceId>` 的最终迁移规则。
   - 但 B2 阶段 Agent UI 还没切成 NIM 多实例列表，如果现在把 binding 改成 `nim:<id>`，编辑 Agent 时会看不到已绑定状态。
   - 因此本轮保留平台级 `nim` binding，等 B3 或后续 UI 多实例化时再迁绑定 key。
2. 暂不迁移旧 session mapping platform
   - 当前 native/managed IM cowork handler 仍按平台级 `nim` 读取绑定和 session mapping。
   - 提前迁成 `nim:<id>` 会要求路由层同步改造，风险超过本轮目标。
3. OpenClaw config sync 保持主实例投影
   - `main.ts` 仍通过 `getConfig().nim` 给 `OpenClawConfigSync`。
   - 内部多实例只选择主实例生成当前 `nim` channel 配置，避免一次启多个 NIM channel 造成 gateway 不确定性。

### 本轮刻意未改

1. 不改 renderer `IMGatewayConfig.nim` 公开类型。
2. 不改 `IMSettingsMain.tsx` 的 NIM 单实例 UI。
3. 不引入 `NimInstanceSettings.tsx`。
4. 不迁移 `platformAgentBindings.nim` 到 `nim:<instanceId>`。
5. 不迁移旧 NIM session mapping。
6. 不改 POPO，本轮只做 NIM。

### 原则校验

1. KISS
   - 只把 NIM 多实例能力放进 store 内部，外部继续主实例投影，不一次牵动 UI。
2. YAGNI
   - 当前不需要多 NIM channel 同时启用，先只让主实例进入 OpenClaw config。
3. SOLID
   - store 负责迁移和投影，runtime/status/config sync 继续消费稳定的 `getConfig().nim`。
4. DRY
   - 复用 B1 的迁移判断 helper，不在 store 里重新写一套“是否值得迁移”的规则。

### 本轮验证

1. `npm test -- --run src/main/im/imGatewayManager.nim.test.ts src/main/im/imStore.test.ts src/main/im/imSingleToMultiInstanceMigration.test.ts src/main/libs/openclawConfigSync.runtime.test.ts src/renderer/components/agent/agentImBindingConfig.test.ts`
   - 5 个测试文件通过。
   - 54 条测试通过。
2. `npx tsc --project electron-tsconfig.json --noEmit`
   - 通过。
3. `npx tsc --project tsconfig.json --noEmit`
   - 通过。
4. `git diff --check`
   - 通过。

### 批次 B 第 3 轮规划

1. 主攻方向
   - 迁 POPO 的内部多实例 store 能力，并决定是否把 POPO UI 先保留单实例主投影还是接入实例 UI。
2. 计划动作
   - 在 main 侧补 POPO 多实例 store 方法：`getPopoInstances()`、`setPopoInstanceConfig()`、`getPopoMultiInstanceConfig()` 等。
   - 旧 `popo` 单实例配置迁移成一个默认 POPO instance。
   - 与 NIM 一样，B3 默认先保留 `getConfig().popo` 主实例投影，保护当前 POPO QR 登录和 Settings UI。
   - 复核 POPO QR 登录保存路径，确认它会更新主实例或旧单实例配置，不破坏扫码登录。
   - 补 POPO store/runtime/config sync 测试。
3. 验收命令
   - `npm test -- --run src/main/im/imStore.test.ts src/main/im/imSingleToMultiInstanceMigration.test.ts src/main/libs/openclawConfigSync.runtime.test.ts src/renderer/store/slices/imSlice.test.ts`
   - `npx tsc --project electron-tsconfig.json --noEmit`
   - `npx tsc --project tsconfig.json --noEmit`
   - `git diff --check`

### 剩余轮次估算

批次 B 预计还剩约 1 轮：

1. B3：POPO 内部多实例 store 迁移、主实例投影、QR 保存兼容和验收。

## 2026-05-12：批次 B 第 3 轮 POPO 内部多实例 store 迁移与主实例投影

本轮完成批次 B 的 POPO 部分。延续 B2 的稳妥策略：main store 内部支持 `popo:<instanceId>` 多实例读写和旧单实例迁移，但 `getConfig().popo` 继续投影为主实例。这样当前 `IMSettingsMain.tsx` 的 POPO QR 登录、保存、启停、OpenClaw config sync 和 Agent binding 仍按原有单实例路径工作，不会因为内部多实例化而破坏现有可用体验。

### 本轮代码更新

1. main 侧补 POPO 多实例类型
   - 在 `src/main/im/types.ts` 新增 `PopoInstanceConfig`、`PopoInstanceStatus`、`PopoMultiInstanceConfig`、`PopoMultiInstanceStatus`。
   - 新增 `MAX_POPO_INSTANCES`、`DEFAULT_POPO_MULTI_INSTANCE_CONFIG`、`DEFAULT_POPO_MULTI_INSTANCE_STATUS`。
2. `IMStore` 增加 POPO 实例读写能力
   - 新增 `getPopoInstances()`、`getPopoInstanceConfig()`、`setPopoInstanceConfig()`、`deletePopoInstance()`、`getPopoMultiInstanceConfig()`、`setPopoMultiInstanceConfig()`。
   - 旧 `popo` 单实例配置在首次读取 instances 时迁移为一个 `popo:<uuid>` 默认实例。
   - `setPopoConfig()` 若已有实例，会更新主实例；没有实例时继续写旧单实例配置，保护当前 POPO QR 登录保存路径。
   - `getConfig().popo` 继续返回主实例投影，OpenClaw config sync 和 Settings UI 暂不感知内部多实例结构。
3. POPO store 迁移测试补齐
   - 在 `src/main/im/imStore.test.ts` 增加旧单实例迁移到一个 POPO instance 的测试。
   - 增加 `setPopoConfig()` 更新主实例测试，覆盖 QR 登录成功后的凭证保存路径。
   - 增加替换 POPO 多实例配置时清理 stale instance binding 的测试。

### 本轮关键取舍

1. 暂不迁移 `platformAgentBindings.popo`
   - B1 helper 已验证 `popo` -> `popo:<instanceId>` 的最终迁移规则。
   - 但当前 Agent UI 还没有渲染 POPO 实例列表，如果现在迁 binding，编辑 Agent 时会丢失已绑定展示。
   - 因此本轮保留平台级 `popo` binding，等待后续 UI 多实例化时再迁 key。
2. 暂不替换 POPO UI
   - 当前 POPO QR 登录在 `IMSettingsMain.tsx` 已可用。
   - 直接引入 main 的 `PopoInstanceSettings.tsx` 会改变设置页结构，和青数覆盖层存在耦合风险。
3. OpenClaw config sync 保持主实例投影
   - `main.ts` 仍通过 `getConfig().popo` 给 `OpenClawConfigSync`。
   - 内部多实例只选择主实例生成当前 `moltbot-popo` channel 配置，避免一次启多个 POPO channel 造成 gateway 风险。

### 本轮刻意未改

1. 不改 renderer `IMGatewayConfig.popo` 公开类型。
2. 不改 `IMSettingsMain.tsx` 的 POPO 单实例 UI 和 QR 登录流程。
3. 不引入 `PopoInstanceSettings.tsx`。
4. 不迁移 `platformAgentBindings.popo` 到 `popo:<instanceId>`。
5. 不迁移旧 POPO session mapping。

### 原则校验

1. KISS
   - 和 NIM 保持同一过渡策略：store 内部多实例，外部主实例投影。
2. YAGNI
   - 当前不需要多个 POPO channel 同时启用，先保证现有 QR 登录和 OpenClaw config sync 不破。
3. SOLID
   - store 负责迁移和主实例投影，renderer 设置页继续负责当前单实例表单和 QR 状态展示。
4. DRY
   - 复用 B1 的 `planSingleToMultiInstanceMigration()` 和 POPO meaningful config 判断，不重复实现迁移判定。

### 本轮验证

1. `npm test -- --run src/main/im/imStore.test.ts src/main/im/imSingleToMultiInstanceMigration.test.ts src/main/libs/openclawConfigSync.runtime.test.ts src/renderer/store/slices/imSlice.test.ts`
   - 4 个测试文件通过。
   - 47 条测试通过。
2. `npx tsc --project electron-tsconfig.json --noEmit`
   - 通过。
3. `npx tsc --project tsconfig.json --noEmit`
   - 通过。
4. `git diff --check`
   - 通过。

### 批次 B 收口判断

批次 B 已达到当前阶段可验收状态：NIM 和 POPO 都已具备 main store 内部多实例读写、旧单实例迁移、主实例投影和基础测试覆盖；现有青数 Settings UI、Agent binding、OpenClaw config sync、QR 登录保存路径保持稳定。

### 下一批规划

建议进入批次 C，主攻“Renderer 多实例 UI 与 Agent binding 实例级展示”。建议拆成 3 轮：

1. C1：Agent IM binding 兼容实例级展示
   - 让 Agent 新建/编辑弹窗在 NIM/POPO 有内部实例时可以显示实例列表。
   - 同时兼容旧平台级 `nim` / `popo` binding，避免已有绑定不可见。
2. C2：NIM Settings UI 多实例化
   - 在保留青数 `IMSettingsMain.tsx` 外观和入口的前提下，局部接入 NIM 实例列表和 QR 保存。
   - 再考虑是否复用 main 的 `NimInstanceSettings.tsx` 片段。
3. C3：POPO Settings UI 多实例化
   - 在保留当前 POPO QR 登录可用性的前提下，局部接入 POPO 实例列表。
   - 最后再迁 `platformAgentBindings.popo` 到实例级 key。

### 剩余轮次估算

批次 B 剩余 0 轮。

若继续拉齐 main 的 NIM/POPO 多实例 UI 和 Agent binding 实例级展示，对应新批次 C 预计还需约 3 轮。

## 2026-05-12：批次 C 第 1 轮 Agent IM binding 兼容 NIM/POPO 实例级展示

本轮进入批次 C，先处理 Agent 新建/编辑弹窗的绑定兼容层。没有直接把 NIM/POPO 设置页改成实例 UI，而是让 Agent binding helper 能识别未来 renderer config 中的 `nim.instances` / `popo.instances`。当前单实例 `config.nim` / `config.popo` 仍保持平台级显示；未来 C2/C3 把实例数组暴露到 renderer 后，Agent 弹窗会自动按实例列表渲染，并且继续兼容旧平台级 `nim` / `popo` 绑定。

### 本轮代码更新

1. Agent binding helper 支持动态实例数组
   - 修改 `src/renderer/components/agent/agentImBindingConfig.ts`。
   - 新增 `hasAgentImBindingInstanceConfigs()`，不再只依赖固定多实例平台列表。
   - `getAgentImBindingEnabledInstances()` 支持固定多实例平台，也支持未来 `nim.instances` / `popo.instances`。
   - `isAgentImBindingPlatformConfigured()` 在检测到实例数组时按 enabled instance 判断；没有实例数组时继续按单实例 `enabled` 判断。
2. Agent 新建/编辑弹窗切到兼容判断
   - `AgentCreateModal.tsx` 和 `AgentSettingsPanel.tsx` 的 IM tab 从 `isMultiInstanceAgentBindingPlatform(platform)` 改为 `hasAgentImBindingInstanceConfigs(imConfig, platform)`。
   - 当前 DingTalk/Feishu/QQ/WeCom 仍因为有 `instances` 而走实例列表。
   - 当前 NIM/POPO 没有 renderer instances 时仍走单实例平台卡片。
   - 未来 NIM/POPO 一旦暴露 `instances`，会直接走实例列表。
3. 绑定 key 回填兼容
   - `collectAgentBoundBindingKeys()` 现在可传入 config，用来过滤实例模式下已禁用的实例 key。
   - 旧平台级 `nim` / `popo` binding 会继续保留，避免 UI 多实例迁移前已有绑定不可见。
   - 编辑 Agent 时回填绑定 now 会传入 `imConfig`，为实例级过滤提供上下文。
4. 测试覆盖
   - 补充 NIM/POPO 当前单实例配置识别。
   - 补充未来 `nim.instances` / `popo.instances` 识别。
   - 补充实例模式下按启用实例判断 configured。
   - 补充禁用实例过滤和旧平台级 binding 保留。

### 本轮关键取舍

1. 不把 `isMultiInstanceAgentBindingPlatform('nim')` 改成 true
   - 如果直接改成 true，当前 renderer 的单实例 `config.nim` 没有 `instances`，会被误判为未配置。
   - 当前采用“实例数组存在才实例化”的判断，更适合渐进迁移。
2. 不迁移真实 binding key
   - `nim` / `popo` 旧平台级 binding 继续可见。
   - `nim:<id>` / `popo:<id>` 实例级 binding 也可以被识别。
3. 不改 Settings UI
   - C1 只做 Agent binding 兼容，不碰 `IMSettingsMain.tsx`。
   - NIM/POPO 多实例设置页放到 C2/C3。

### 本轮刻意未改

1. 不改变 renderer `IMGatewayConfig.nim` / `IMGatewayConfig.popo` 类型。
2. 不引入 `NimInstanceSettings.tsx` / `PopoInstanceSettings.tsx`。
3. 不迁移 `platformAgentBindings.nim` / `platformAgentBindings.popo`。
4. 不改 OpenClaw config sync。
5. 不改青数品牌、工作台、治理链、唤醒/TTS。

### 原则校验

1. KISS
   - 只让 Agent binding 判断从固定平台列表升级成“看配置是否有实例数组”，不重构 UI。
2. YAGNI
   - 还没到 Settings UI 多实例阶段，不提前做实例增删改表单。
3. SOLID
   - 实例识别和 key 过滤集中在 `agentImBindingConfig.ts`，弹窗只消费 helper。
4. DRY
   - NIM/POPO 未来实例模式复用同一套 helper，不为每个平台写特判。

### 本轮验证

1. `npm test -- --run src/renderer/components/agent/agentImBindingConfig.test.ts src/renderer/components/agent/agentDraftState.test.ts src/renderer/store/slices/imSlice.test.ts`
   - 3 个测试文件通过。
   - 37 条测试通过。
2. `npx tsc --project tsconfig.json --noEmit`
   - 通过。
3. `npx tsc --project electron-tsconfig.json --noEmit`
   - 通过。
4. `git diff --check`
   - 通过。

### 批次 C 第 2 轮规划

1. 主攻方向
   - NIM Settings UI 多实例化，仍保留青数 `IMSettingsMain.tsx` 的整体外观和入口。
2. 计划动作
   - 先在 renderer 类型中引入 NIM instance/multi-instance 兼容类型，但保留 `config.nim` 主实例投影兼容。
   - 在 `IMSettingsMain.tsx` 的 NIM 区块局部渲染实例列表，不整包替换 main 的设置页。
   - 优先支持“默认主实例”展示、启停、凭证保存和 QR 登录写入主实例。
   - Agent binding 继续兼容旧平台级 `nim` 和实例级 `nim:<id>`。
   - 补 NIM UI state/helper 测试和 renderer 类型检查。
3. 验收命令
   - `npm test -- --run src/renderer/components/agent/agentImBindingConfig.test.ts src/renderer/store/slices/imSlice.test.ts src/renderer/services/nimQrLogin.test.ts src/main/im/imStore.test.ts`
   - `npx tsc --project tsconfig.json --noEmit`
   - `npx tsc --project electron-tsconfig.json --noEmit`
   - `git diff --check`

### 剩余轮次估算

批次 C 预计还剩约 2 轮：

1. C2：NIM Settings UI 多实例化和 QR 保存兼容。
2. C3：POPO Settings UI 多实例化和最终 binding key 迁移策略。

## 2026-05-12：批次 C 第 2 轮 NIM Settings UI 多实例兼容

本轮按 C2 规划继续推进 NIM 多实例 renderer 兼容，但仍不整包替换青数 `IMSettingsMain.tsx`，也不直接搬入 `origin/main` 的 `NimInstanceSettings.tsx`。当前采用更稳的过渡方案：main 侧 `getConfig().nim` 继续返回主实例投影，同时附带只读 `instances` 数组；renderer 设置页只展示实例摘要，表单和二维码登录仍编辑主实例，避免一次性引入实例增删改造成保存链路漂移。

### 本轮代码更新

1. NIM 配置公开投影携带只读实例列表
   - `src/main/im/types.ts` 和 `src/renderer/types/im.ts` 为 `NimConfig` 增加 `instances?: NimInstanceConfig[]`。
   - `src/main/im/imStore.ts` 的 `getPrimaryNimConfig()` 在存在内部 NIM 实例时返回主实例字段，并附带完整 `instances` 投影。
   - `setNimConfig()` 显式忽略 renderer 传回的 `instances`，只更新主实例字段，避免只读投影被表单保存写回成脏实例。
2. renderer store 清理 NIM 实例级陈旧绑定
   - `src/renderer/store/slices/imSlice.ts` 的 stale binding 清理覆盖 `nim:<instanceId>`。
   - 新增 `setNimInstances()` reducer，用于后续 NIM 实例 UI 局部替换投影时同步清理旧绑定。
   - 保留旧平台级 `nim` binding，不在本轮迁移已有 Agent 绑定。
3. NIM 设置页增加实例摘要
   - `src/renderer/components/im/IMSettingsMain.tsx` 新增 `NimInstanceSummary`。
   - 在 NIM 区块显示当前实例列表、主实例标记、账号/AppKey/实例 ID 和启用状态。
   - 现有 NIM QR 登录、SchemaForm、fallback 输入框、连通性测试、状态错误展示保持不变。
4. i18n 文案补齐
   - `src/renderer/services/i18n.ts` 补充中英文 `nimInstancesTitle`、`nimInstancesPrimaryHint`、`nimInstancesPrimaryTag`。
5. 测试补齐
   - `src/main/im/imStore.test.ts` 增加主实例投影携带 `instances` 的断言。
   - 增加 `setNimConfig()` 忽略 renderer `instances` 投影、只更新主实例的回归测试。
   - `src/renderer/store/slices/imSlice.test.ts` 增加 `setConfig()` 和 `setNimInstances()` 清理陈旧 `nim:<id>` 绑定但保留旧平台级 `nim` 绑定的测试。

### 本轮关键取舍

1. 不引入完整 NIM 实例编辑器
   - 目前 NIM 内部多实例刚暴露到 renderer，直接上实例增删改和实例级 QR 保存会同时牵动 IM 设置页、Agent binding、OpenClaw config sync。
   - 本轮先让用户可见“当前有哪些实例”，同时保持主实例编辑闭环稳定。
2. 不迁移 `platformAgentBindings.nim`
   - 旧绑定 `nim` 继续保留，避免已有 Agent 编辑页突然看不到绑定状态。
   - 实例级 `nim:<id>` 已具备清理和展示兼容，等 C3/后续最终策略再决定是否迁移。
3. 不改变 OpenClaw NIM channel 生成策略
   - 当前仍由主实例投影进入 OpenClaw config，避免一次启多个 NIM channel 带来 gateway 不确定性。

### 本轮刻意未改

1. 不替换青数 `IMSettingsMain.tsx` 的整体结构。
2. 不引入 `NimInstanceSettings.tsx` 整包组件。
3. 不新增 NIM 实例增删按钮。
4. 不改变 POPO 设置页，本轮只处理 NIM。
5. 不改青数品牌、工作台、治理链、唤醒/TTS。

### 原则校验

1. KISS
   - 用主实例投影 + 只读实例摘要完成 renderer 可见性，不重构设置页。
2. YAGNI
   - 还没有稳定验收实例级保存前，不提前做完整实例管理 UI。
3. SOLID
   - main store 负责投影和防写回污染；renderer slice 负责本地 binding 清理；UI 只负责展示。
4. DRY
   - NIM stale binding 清理复用已有多实例平台的统一 helper。

### 本轮验证

1. `npm test -- --run src/renderer/components/agent/agentImBindingConfig.test.ts src/renderer/store/slices/imSlice.test.ts src/renderer/services/nimQrLogin.test.ts src/main/im/imStore.test.ts`
   - 4 个测试文件通过。
   - 56 条测试通过。
2. `npx tsc --project tsconfig.json --noEmit`
   - 通过。
3. `npx tsc --project electron-tsconfig.json --noEmit`
   - 通过。
4. `git diff --check`
   - 通过。

### 批次 C 第 3 轮规划

1. 主攻方向
   - POPO Settings UI 多实例兼容和最终 binding key 迁移策略评估。
2. 计划动作
   - 对照 NIM C2 的方案，先为 POPO renderer 类型/配置投影补 `instances` 只读兼容。
   - 在当前 `IMSettingsMain.tsx` 的 POPO 区块增加实例摘要，保留现有 POPO QR 登录和主实例保存。
   - 复核 Agent binding 在 `popo.instances` 出现后的展示、回填和保存行为。
   - 明确是否在本批迁移 `platformAgentBindings.popo` 到 `popo:<id>`，默认先保留平台级 binding 兼容。
   - 补 POPO store / renderer slice / Agent binding 相关测试。
3. 验收命令
   - `npm test -- --run src/renderer/components/agent/agentImBindingConfig.test.ts src/renderer/store/slices/imSlice.test.ts src/main/im/imStore.test.ts`
   - `npx tsc --project tsconfig.json --noEmit`
   - `npx tsc --project electron-tsconfig.json --noEmit`
   - `git diff --check`

### 剩余轮次估算

批次 C 预计还剩约 1 轮：

1. C3：POPO Settings UI 多实例兼容和最终 binding key 迁移策略。

## 2026-05-12：批次 C 第 3 轮 POPO Settings UI 多实例兼容

本轮按 C3 规划完成 POPO 多实例 renderer 兼容。策略继续与 NIM C2 保持一致：不整包替换青数 `IMSettingsMain.tsx`，不引入 main 的 POPO 大设置组件，不迁移已有平台级 `popo` Agent 绑定；只把 main store 内部已有的 POPO 多实例能力通过只读 `instances` 投影暴露给 renderer，并在当前 POPO 设置区显示实例摘要，现有扫码登录、主实例保存和 OpenClaw config sync 仍保持原闭环。

### 本轮代码更新

1. POPO 配置公开投影携带只读实例列表
   - `src/main/im/types.ts` 和 `src/renderer/types/im.ts` 为 `PopoOpenClawConfig` 增加 `instances?: PopoInstanceConfig[]`。
   - renderer 类型新增 `PopoInstanceConfig`，与 main 侧实例结构对齐。
   - `src/main/im/imStore.ts` 的 `getPrimaryPopoConfig()` 在存在内部 POPO 实例时返回主实例字段，并附带完整 `instances` 投影。
   - `setPopoConfig()` 显式忽略 renderer 传回的 `instances`，只更新主实例字段，避免只读投影被保存回写成脏实例。
2. renderer store 清理 POPO 实例级陈旧绑定
   - `src/renderer/store/slices/imSlice.ts` 的 stale binding 清理覆盖 `popo:<instanceId>`。
   - 新增 `setPopoInstances()` reducer，用于后续 POPO 实例 UI 局部替换投影时同步清理旧绑定。
   - 旧平台级 `popo` binding 继续保留，不在本轮迁移已有 Agent 绑定。
3. POPO 设置页增加实例摘要
   - `src/renderer/components/im/IMSettingsMain.tsx` 新增 `PopoInstanceSummary`。
   - 在 POPO 区块显示当前实例列表、主实例标记、AppKey/实例 ID 和启用状态。
   - 现有 POPO QR 登录、AES/AppKey/AppSecret/Token 表单、连接方式、连通性测试、白名单策略保持不变。
4. i18n 文案补齐
   - `src/renderer/services/i18n.ts` 补充中英文 `popoInstancesTitle`、`popoInstancesPrimaryHint`、`popoInstancesPrimaryTag`。
5. 测试补齐
   - `src/main/im/imStore.test.ts` 增加 POPO 主实例投影携带 `instances` 的断言。
   - 增加 `setPopoConfig()` 忽略 renderer `instances` 投影、只更新主实例的回归测试。
   - `src/renderer/store/slices/imSlice.test.ts` 增加 `setConfig()` 和 `setPopoInstances()` 清理陈旧 `popo:<id>` 绑定但保留旧平台级 `popo` 绑定的测试。

### 本轮关键取舍

1. 不迁移 `platformAgentBindings.popo`
   - Agent binding helper 在 C1 已经能识别未来 `popo.instances`。
   - 但当前已有绑定仍可能是平台级 `popo`，直接迁移到 `popo:<id>` 会影响历史 Agent 编辑与回显。
   - 本轮只保证实例级 key 可清理、可展示兼容，真实迁移留到后续完整实例编辑器批次。
2. 不引入完整 POPO 实例编辑器
   - 现阶段实例摘要已经足够让用户确认内部多实例投影。
   - 增删实例、实例级 QR 保存、多个 POPO channel 同时启用仍属于更高耦合能力。
3. 不改变 OpenClaw POPO channel 生成策略
   - 当前仍由主实例投影进入 OpenClaw config，避免一次启多个 `moltbot-popo` channel 造成 gateway 风险。

### 本轮刻意未改

1. 不替换青数 `IMSettingsMain.tsx` 的整体结构。
2. 不引入 `PopoInstanceSettings.tsx` 整包组件。
3. 不新增 POPO 实例增删按钮。
4. 不迁移 `platformAgentBindings.popo` 到 `popo:<id>`。
5. 不改青数品牌、工作台、治理链、唤醒/TTS。

### 原则校验

1. KISS
   - 继续使用主实例投影 + 只读实例摘要，不引入新的复杂设置页。
2. YAGNI
   - 没有稳定验收实例级 QR 和多 POPO channel 前，不提前实现完整实例管理。
3. SOLID
   - main store 负责投影和防写回污染；renderer slice 负责本地 binding 清理；UI 只负责展示。
4. DRY
   - POPO 和 NIM 复用同一套过渡模式，减少平台特判。

### 本轮验证

1. `npm test -- --run src/renderer/components/agent/agentImBindingConfig.test.ts src/renderer/store/slices/imSlice.test.ts src/main/im/imStore.test.ts`
   - 3 个测试文件通过。
   - 49 条测试通过。
2. `npx tsc --project tsconfig.json --noEmit`
   - 通过。
3. `npx tsc --project electron-tsconfig.json --noEmit`
   - 通过。
4. `git diff --check`
   - 通过。

### 批次 C 收口判断

批次 C 已达到当前阶段可验收状态：Agent 新建/编辑弹窗已能兼容未来 `nim.instances` / `popo.instances`；NIM 和 POPO 的 renderer 配置已能看到只读实例投影；Settings UI 已能显示实例摘要；旧平台级 `nim` / `popo` 绑定继续保留，实例级 stale binding 也有清理保护。

当前阶段刻意不做完整实例编辑器和 binding key 强迁移，因为这会牵动实例增删、实例级 QR 保存、OpenClaw 多 channel 配置生成、历史 session mapping 和 Agent 回填策略，适合单独作为后续批次。

### 下一批规划

建议进入批次 D，主攻“真正实例级编辑与运行时多 channel 策略评估”。建议拆成 2 轮：

1. D1：NIM/POPO 实例编辑器最小闭环评估
   - 决定是否需要在当前 `IMSettingsMain.tsx` 里支持新增/删除 NIM/POPO 实例。
   - 如果需要，优先做主实例以外的只读/禁用展示，再小步开放编辑。
   - 明确 QR 登录写入哪个实例，以及保存按钮 dirty 状态如何计算。
2. D2：OpenClaw 多 channel 与 binding key 迁移策略
   - 评估是否允许多个 NIM/POPO 实例同时生成 OpenClaw channel。
   - 明确 `nim` / `popo` 平台级 binding 迁移到 `nim:<id>` / `popo:<id>` 的条件。
   - 处理历史 session mapping 和 scheduled task channel 的兼容策略。

### 剩余轮次估算

批次 C 剩余 0 轮。

若继续做完整 NIM/POPO 实例级编辑和运行时多 channel，对应新批次 D 预计还需约 2 轮。

## 2026-05-12：批次 D 第 1 轮 NIM/POPO 实例编辑器最小闭环评估

本轮进入批次 D，但没有直接搬 `origin/main` 的 `NimInstanceSettings.tsx` / `PopoInstanceSettings.tsx`。对照后确认，main 的实例组件包含重命名、删除、实例级 QR、实例级状态、测试按钮和完整表单，直接整包接入会牵动当前青数 `IMSettingsMain.tsx`、Agent binding、OpenClaw channel 生成与历史 session mapping。本轮先做更小的实例编辑胶水：确保当前主实例表单编辑后，Settings UI 的实例摘要投影立即同步，不需要重新加载才看到新值。

### 本轮代码更新

1. NIM 主实例编辑同步摘要投影
   - `src/renderer/store/slices/imSlice.ts` 新增 `syncFirstNimInstanceProjection()`。
   - `setNimConfig()` 更新 `config.nim` 后，会同步更新 `config.nim.instances[0]` 的主实例字段。
   - 保留 `instanceId`、`instanceName`，避免主实例表单覆盖实例身份。
   - 不把 `instances` 数组递归塞回实例对象，保持投影结构简单。
2. POPO 主实例编辑同步摘要投影
   - `src/renderer/store/slices/imSlice.ts` 新增 `syncFirstPopoInstanceProjection()`。
   - `setPopoConfig()` 更新 `config.popo` 后，会同步更新 `config.popo.instances[0]` 的主实例字段。
   - 同样保留 `instanceId`、`instanceName`，避免投影污染实例身份。
3. 测试补齐
   - `src/renderer/store/slices/imSlice.test.ts` 增加 `setNimConfig()` 同步主实例投影测试。
   - 增加 `setPopoConfig()` 同步主实例投影测试。
   - 同时保留 C2/C3 的 stale binding 清理测试，确认本轮胶水不影响旧平台级绑定兼容。

### 本轮关键取舍

1. 不开放实例新增/删除
   - 当前主实例编辑和扫码已经可用，贸然增加实例增删会要求同步定义保存入口、删除确认、状态测试、OpenClaw 多 channel 策略。
   - 先修“摘要不随主实例编辑即时刷新”的实际体验问题，风险更低。
2. 不直接接 main 的实例组件
   - main 组件是完整多实例 UI，适合在确定 D2 的运行时多 channel 策略后再接。
   - 当前分支还要保护青数设置覆盖层和现有业务展示，先做胶水比整包替换更稳。
3. 不迁移 binding key
   - `nim` / `popo` 平台级绑定继续保留。
   - 实例级 key 的最终迁移仍放到 D2 与 OpenClaw channel 策略一起判断。

### 本轮刻意未改

1. 不新增 NIM/POPO 实例增删按钮。
2. 不接入 `NimInstanceSettings.tsx` / `PopoInstanceSettings.tsx`。
3. 不改变 QR 登录写入目标，仍写主实例。
4. 不改变 OpenClaw NIM/POPO channel 生成策略。
5. 不改青数品牌、工作台、治理链、唤醒/TTS。

### 原则校验

1. KISS
   - 只补主实例投影同步，不引入新 UI 状态机。
2. YAGNI
   - 未确认多 channel 策略前，不提前开放完整实例管理。
3. SOLID
   - 同步逻辑收口在 `imSlice.ts`，UI 摘要仍只消费状态。
4. DRY
   - NIM 和 POPO 使用同构 helper，避免两个平台各写一套分叉逻辑。

### 本轮验证

1. `npm test -- --run src/renderer/store/slices/imSlice.test.ts src/renderer/components/agent/agentImBindingConfig.test.ts src/main/im/imStore.test.ts`
   - 3 个测试文件通过。
   - 51 条测试通过。
2. `npx tsc --project tsconfig.json --noEmit`
   - 通过。
3. `npx tsc --project electron-tsconfig.json --noEmit`
   - 通过。
4. `git diff --check`
   - 通过。

### 批次 D 第 2 轮规划

1. 主攻方向
   - OpenClaw 多 channel 与 binding key 迁移策略评估。
2. 计划动作
   - 复核 `openclawConfigSync.ts` 当前 NIM/POPO channel 生成是否只吃主实例投影。
   - 评估多个 NIM/POPO 实例同时启用时是否能安全生成多个 channel，尤其是 channel key、session mapping、scheduled task channel 列表是否能区分实例。
   - 复核 Agent binding 当前 `nim` / `popo` 与未来 `nim:<id>` / `popo:<id>` 的迁移条件。
   - 如果风险较高，D2 只落文档和测试护栏，明确暂不启用多 channel。
   - 如果风险可控，再做最小运行时策略补丁，但仍不影响青数工作台和治理链。
3. 验收命令
   - `npm test -- --run src/renderer/store/slices/imSlice.test.ts src/renderer/components/agent/agentImBindingConfig.test.ts src/main/im/imStore.test.ts`
   - `npx tsc --project tsconfig.json --noEmit`
   - `npx tsc --project electron-tsconfig.json --noEmit`
   - `git diff --check`

### 剩余轮次估算

批次 D 预计还剩约 1 轮：

1. D2：OpenClaw 多 channel 与 binding key 迁移策略评估。

## 2026-05-12：批次 D 第 2 轮 OpenClaw 多 channel 与 binding key 迁移策略评估

本轮完成 D2。复核 `openclawConfigSync.ts`、IM session mapping、定时任务 channel 列表和 Agent binding 后，结论是：当前 NIM/POPO 虽然已有内部多实例投影，但运行时仍只能安全走主实例 channel。`openclawConfigSync.ts` 只从 `getNimConfig()` / `getPopoConfig()` 读取主实例投影，并分别写固定 channel key：`channels.nim` 和 `channels.moltbot-popo`；环境变量也只有 `LOBSTER_NIM_TOKEN`、`LOBSTER_POPO_APP_SECRET`、`LOBSTER_POPO_TOKEN` 这一组。此时如果在定时任务或 binding 中暴露多个 NIM/POPO 实例，会让用户以为选中了第二个实例，但实际 OpenClaw 仍通过主 channel 发送，形成隐性错路由。

### 本轮代码更新

1. 收回定时任务 NIM/POPO 多实例展开
   - 修改 `src/main/ipcHandlers/scheduledTask/helpers.ts`。
   - 将 `nim` / `popo` 从 `MULTI_INSTANCE_CONFIG_KEYS` 移出。
   - 定时任务通知渠道中，NIM/POPO 继续只展示平台级 channel，而不是展开 `instances[]`。
2. 删除未使用的 NIM runtime account 推导
   - 移除 `deriveNimRuntimeAccountId()`。
   - 当前 OpenClaw 还没有 NIM 多 channel accountId 路由，保留这段推导反而会让 UI 暗示已经支持实例级投递。
3. 测试护栏补齐
   - 修改 `src/main/ipcHandlers/scheduledTask/helpers.test.ts`。
   - 新增/调整测试确认：即使 `config.nim.instances` / `config.popo.instances` 存在并启用，定时任务 channel 列表也只返回 `nim` 和 `moltbot-popo` 平台级选项。
   - 明确不会展示 `云信 Token Bot`、`云信账号 Bot`、`POPO 二号` 这类实例标签，避免误导用户选择非主实例。

### 本轮关键取舍

1. 暂不启用 NIM/POPO 多 channel
   - 当前 channel key 固定，无法区分多个 NIM/POPO 实例。
   - 当前 env var 固定，无法为多个实例注入不同 token/secret。
   - 当前 IM session mapping 仍按 `conversationId + platform` 查找，NIM/POPO 平台级路由无法稳定区分实例。
2. 暂不迁移 `nim` / `popo` binding key
   - Agent binding helper 已能识别未来 `nim:<id>` / `popo:<id>`。
   - 但运行时仍只有平台级 OpenClaw channel，强迁 binding key 会造成 UI 和 runtime 不一致。
3. 先收紧入口再做大迁移
   - 定时任务是最容易出现“选择实例但实际走主实例”的入口，因此本轮先加护栏。
   - 后续若要开放多 channel，需要一次性解决 channel key、env var、session mapping、scheduled task filtering 和 Agent binding 迁移。

### 本轮刻意未改

1. 不生成多个 `channels.nim` / `channels.moltbot-popo`。
2. 不新增多实例 env var，例如 `LOBSTER_NIM_TOKEN_1` 或 `LOBSTER_POPO_APP_SECRET_1`。
3. 不迁移 `platformAgentBindings.nim` / `platformAgentBindings.popo`。
4. 不修改 IM session mapping 主键策略。
5. 不改青数品牌、工作台、治理链、唤醒/TTS。

### 原则校验

1. KISS
   - 只修正与当前运行时能力不一致的入口，不做半套多 channel。
2. YAGNI
   - 没有完整多 channel 运行时前，不提前暴露实例级定时任务选项。
3. SOLID
   - scheduled task helper 只负责展示当前可用 channel，不承担未来运行时路由推断。
4. DRY
   - 继续沿现有平台注册表输出平台级选项，不为 NIM/POPO 另写临时多实例路径。

### 本轮验证

1. `npm test -- --run src/main/ipcHandlers/scheduledTask/helpers.test.ts src/renderer/store/slices/imSlice.test.ts src/renderer/components/agent/agentImBindingConfig.test.ts src/main/im/imStore.test.ts src/main/im/imGatewayManager.nim.test.ts`
   - 5 个测试文件通过。
   - 60 条测试通过。
2. `npx tsc --project tsconfig.json --noEmit`
   - 通过。
3. `npx tsc --project electron-tsconfig.json --noEmit`
   - 通过。
4. `git diff --check`
   - 通过。

### 批次 D 收口判断

批次 D 已达到当前阶段可验收状态：NIM/POPO 具备内部多实例投影和设置页摘要；主实例编辑会同步更新摘要；定时任务入口不会错误暴露尚未真正支持的 NIM/POPO 多实例选项；Agent binding 继续兼容平台级 key 和未来实例级 key，但运行时暂不强迁。

### 下一批规划

建议进入批次 E，回到 `origin/main` 剩余公共能力筛选，而不是继续强推 NIM/POPO 多 channel。建议拆成 2 轮：

1. E1：扫描当前与 `origin/main` 剩余公共差异
   - 重点看 Provider/模型配置、OpenClaw runtime patch、构建打包稳定性、scheduled task bugfix。
   - 排除青数品牌、工作台、治理链、唤醒/TTS，以及高耦合主控台 UI 大迁移。
2. E2：选择一个低耦合公共 bugfix 小批次落地
   - 优先选择有测试可覆盖、不会改变产品主体验的公共能力。
   - 每次只做一个小批次，继续保持可回滚。

### 剩余轮次估算

批次 D 剩余 0 轮。

若继续筛 `origin/main` 剩余公共能力，对应新批次 E 预计还需约 2 轮起，具体取决于扫描后剩余差异数量。

## 2026-05-12：批次 E 第 1-2 轮公共差异扫描与低耦合 bugfix 收口

本轮先收口上一阶段 NIM/POPO 设置页的实例级可见交互，然后进入批次 E：扫描当前分支与 `origin/main` 的剩余公共差异，并选择一个低耦合公共 bugfix 做验证落地。全程未改青数品牌、工作台、内置治理链、登录托管目录、唤醒/TTS。

### 本轮代码更新

1. NIM/POPO 设置页实例级选择与保存闭环
   - 修改 `src/renderer/components/im/IMSettingsMain.tsx`。
   - 在现有青数 IM 设置壳内补 `InlineInstanceList`，支持 NIM/POPO 实例选择、新增、重命名、删除。
   - 左侧 IM 渠道列表新增 NIM/POPO 实例子项，和 DingTalk/Feishu/QQ/WeCom 的多实例导航体验保持一致。
   - 表单、扫码登录、启停从旧的“总是写第一个实例”改为写当前选中的实例，避免选中第二个实例但实际保存到主实例的错位。
2. Renderer slice 类型收窄
   - 修改 `src/renderer/store/slices/imSlice.ts`。
   - `setNimInstanceConfig` / `setPopoInstanceConfig` 允许更新实例元数据 `instanceName`，重命名不再需要绕过类型。
3. i18n 文案补齐
   - 修改 `src/renderer/services/i18n.ts`。
   - 补 NIM/POPO 实例编辑提示、空状态、新增按钮中英文文案。
4. E1 剩余公共差异扫描
   - 通过 `git diff --name-status origin/main...HEAD`、`git log --oneline HEAD..origin/main`、热点目录 diff 扫描剩余差异。
   - 剩余差异仍集中在：Artifacts 完整预览面板、OpenClaw 主干/runtime 大迁移、per-agent modelSlice、主控台 UI、认证路径、安装/SQLite backup 策略、POPO/IM 深度迁移。
5. E2 低耦合公共 bugfix 验证
   - 选择 `artifactParser` 文件路径解析/去重作为本轮低耦合公共 bugfix 验收点。
   - 当前工作树已有 Windows `file:///D:/...` 去重、反斜杠归一、URI decode、纯文本文件路径识别等实现与测试；本轮通过测试确认该能力可用，不再扩大改动范围。

### 本轮关键取舍

1. 不整包替换 `origin/main` 的 NIM/POPO 大设置组件
   - main 组件包含实例级 QR、完整表单、状态与删除确认；直接搬入会牵动当前青数 IM 设置壳和 QR 保存链路。
   - 本轮采用最小内嵌实例列表，保证真实闭环优先。
2. 不把 E2 扩大为完整 Artifacts panel
   - 完整右侧 panel、CodeMirror、文件内容预览会影响对话窗口布局和主控台 UI。
   - 本轮只验证文件路径解析/去重 bugfix，保护当前青数对话窗口体验。
3. 不接高耦合公共主干
   - OpenClaw 主干重构、per-agent modelSlice、认证代理 token refresher、POPO/IM 深度运行时迁移继续保持独立批次。

### 原则校验

1. KISS
   - 用一个小型 `InlineInstanceList` 补齐实例交互，不引入完整新页面和复杂状态机。
2. YAGNI
   - 只让当前可用的实例编辑/保存闭环可见，不提前承诺完整多 channel 路由能力。
3. SOLID
   - 设置页负责选择与编辑实例，slice 负责实例元数据更新，OpenClaw 路由策略不在本轮混改。
4. DRY
   - NIM/POPO 共用同一个实例列表组件和同一套保存路径，避免双平台重复 UI 分叉。

### 本轮验证

1. `npx tsc --noEmit --project tsconfig.json`
   - 通过。
2. `npm test -- src/renderer/services/artifactParser.test.ts src/renderer/store/slices/imSlice.test.ts src/renderer/components/agent/agentImBindingConfig.test.ts`
   - 3 个测试文件通过。
   - 47 条测试通过。
3. `npm run compile:electron`
   - 通过。

### 后续规划

下一轮建议继续批次 E 的小步公共能力收口，预计还剩 2 轮：

1. E3：Provider/模型配置和 OpenClaw runtime patch 小范围回扫
   - 只看已有 helper、测试、patch guard 是否与 `origin/main` 新增 bugfix 有缺口。
   - 避免接 per-agent modelSlice 和认证 token refresher。
2. E4：构建/打包稳定性与日志/安全小修
   - 优先检查 `electron-builder-hooks`、runtime prune、MCP/log sanitize、command safety、Windows/macOS 打包脚本的小差异。
   - 不修改 macOS speech/TTS helper 删除方向，不影响唤醒/TTS。

### 剩余轮次估算

批次 E 已完成 E1 与 E2，本阶段预计还剩 2 轮。

## 2026-05-12：批次 E 第 3 轮 Provider / OpenClaw runtime patch 边界回扫

本轮按 E3 规划回扫 Provider / 模型配置与 OpenClaw runtime patch 小范围差异。对比 `origin/main` 后确认，当前分支已经保留了更适合青数分支的 `providerRequestConfig.ts` helper、OpenClaw providerId registry、OpenClaw agent model 投影、legacy Feishu plugin guard 等能力；`origin/main` 中部分方向是把这些逻辑重新内联或删除，不适合直接覆盖。

### 本轮代码更新

1. Provider API format 回归护栏
   - 修改 `src/renderer/services/providerRequestConfig.test.ts`。
   - 增加 OpenAI 固定 OpenAI-compatible format 的断言。
   - 增加 OpenAI 不展示 API format selector 的断言。
   - 保留 DeepSeek/Ollama/LM Studio 这类 switchable provider 的选择入口。
2. OpenClaw providerId 映射回归护栏
   - 修改 `src/shared/providers/constants.test.ts`。
   - 增加 Gemini -> `google`、Copilot -> `lobsterai-copilot`、OpenAI -> `openai`、OpenRouter -> `openrouter` 的断言。
   - 防止后续合并把 providerId 映射退回 provider name，导致 OpenClaw runtime model ref 或 scheduled task model ref 漂移。

### 本轮扫描结论

1. `providerRequestConfig.ts`
   - 当前分支保留独立 helper，支持 OpenAI Responses、Gemini OpenAI-compatible URL、Copilot 无 `/v1` 前缀、GPT-5/O 系列 `max_completion_tokens`。
   - `origin/main` 当前 diff 显示该文件不存在或逻辑内联，直接覆盖会降低可维护性，因此不覆盖生产代码。
2. `openclawAgentModels.ts`
   - 当前分支已吸收 main 的关键行为：过滤设计头像编码，不把 `agent-avatar-svg:*` 当 OpenClaw emoji；支持 agent `workingDirectory` 输出 `cwd`。
   - 本轮不改生产代码，只保留既有测试护栏。
3. `openclawConfigGuards.ts`
   - 当前分支保留旧版 `plugins.entries.feishu.enabled=false` guard，用于避免 legacy Feishu 插件诱导网关配置错误。
   - `origin/main` 不保留该文件，但这属于当前分支实际运行稳定性保护，不删除。
4. Provider registry
   - 当前分支已经具备 Qwen/Qianfan/Xiaomi/Volcengine/Copilot/LM Studio 等映射和 coding plan 元数据。
   - 本轮只补 providerId 映射测试，不改模型列表。

### 本轮刻意未改

1. 不删除 `providerRequestConfig.ts`。
2. 不删除 `openclawConfigGuards.ts`。
3. 不接 per-agent modelSlice 大迁移。
4. 不接 coworkOpenAICompatProxy per-provider token refresher。
5. 不改青数品牌、工作台、治理链、唤醒/TTS。

### 原则校验

1. KISS
   - 只补测试护栏，不在已稳定 helper 上做结构迁移。
2. YAGNI
   - 未为了“看起来更接近 main”而删除当前分支正在依赖的保护逻辑。
3. SOLID
   - Provider format、providerId 映射、OpenClaw agent model 投影继续由各自模块负责。
4. DRY
   - 继续使用 shared provider registry 作为 OpenClaw providerId 的单一真源。

### 本轮验证

1. `npm test -- src/renderer/services/providerRequestConfig.test.ts src/shared/providers/constants.test.ts src/main/libs/openclawAgentModels.test.ts src/main/libs/openclawConfigGuards.test.ts`
   - 4 个测试文件通过。
   - 57 条测试通过。
2. `npx tsc --noEmit --project tsconfig.json`
   - 通过。

### 下一轮规划

进入 E4：构建/打包稳定性与日志/安全小修，预计还剩 1 轮。

1. 优先检查 `electron-builder-hooks`、`openclaw-runtime-packaging`、`prune-openclaw-runtime`、`apply-openclaw-patches` 的现有测试和 main 差异。
2. 检查 `sanitizeForLog` / `mcpLog` / `commandSafety` 是否还有低耦合测试缺口。
3. 不按 `origin/main` 删除 macOS speech/TTS helper，不影响唤醒/TTS。
4. 不接完整 NSIS/SQLite backup 安装策略大迁移，除非只补测试或纯 guard。

### 剩余轮次估算

批次 E 已完成 E1、E2、E3，本阶段预计还剩 1 轮。

## 2026-05-12：批次 E 第 4 轮构建/打包稳定性与日志/安全小修

本轮按 E4 规划收口构建、打包、日志脱敏和命令安全的小范围公共能力差异。对比 `origin/main` 后确认，当前分支在日志脱敏、OpenClaw runtime prune、patch hook、Electron builder hook 等方向已经保留了更强或更适合青数分支的实现；因此本轮不做大面积覆盖，只补一个低耦合安全 bugfix 和对应测试护栏。

### 本轮代码更新

1. force-with-lease 危险命令识别
   - 修改 `src/main/libs/commandSafety.ts`。
   - 将 `git push --force-with-lease` 纳入 `git-force-push` 破坏性命令识别。
   - 避免 IM 自动审批或本地 Cowork 权限提示把该命令降级成普通 `git-push` 谨慎级别。
2. 命令安全测试护栏
   - 修改 `src/main/libs/commandSafety.test.ts`。
   - 增加 `git push --force-with-lease origin main` 应被识别为 `destructive / git-force-push` 的断言。
3. MCP 日志脱敏测试护栏
   - 修改 `src/main/libs/mcpLog.test.ts`。
   - 增加 tool text 中裸 `Bearer` token 会被脱敏的断言，覆盖 MCP tool content 文本预览路径。

### 本轮扫描结论

1. `sanitizeForLog.ts`
   - 当前分支已经支持敏感 key、inline `Authorization: Bearer ...`、inline `api_key=...`、URL query secret 参数等多层脱敏。
   - 该能力比 `origin/main` 当前可见实现更严格，本轮保留当前分支实现，不回退。
2. `mcpLog.ts`
   - MCP tool content 已统一走 `sanitizeForLog`，本轮只补测试，不改生产逻辑。
3. `electron-builder-hooks.cjs`
   - 当前分支仍保留 macOS speech/TTS helper 构建链路。
   - `origin/main` 中删除该方向的变化不适合直接合入，因为唤醒/TTS 属于当前保护层。
4. OpenClaw runtime packaging
   - 当前分支已有 `applyOpenClawPatches`、`pruneOpenClawRuntime`、`electronBuilderHooks` 等测试覆盖。
   - 本轮通过目标测试确认现有打包 hook 和 runtime prune 仍可用。

### 本轮刻意未改

1. 不删除 macOS speech/TTS helper。
2. 不按 `origin/main` 回退当前更严格的日志脱敏实现。
3. 不接完整 NSIS/SQLite backup 安装策略大迁移。
4. 不接 OpenClaw 主干重构、per-agent modelSlice 或 POPO/IM 深度运行时迁移。
5. 不改青数品牌、工作台、治理链、登录/managed catalog、唤醒/TTS。

### 原则校验

1. KISS
   - 只修一个明确安全缺口，避免把 E4 扩大成安装策略或 runtime 主干迁移。
2. YAGNI
   - 不为“看起来全量拉齐 main”而删除当前分支仍在使用的 TTS helper 和日志保护。
3. SOLID
   - 危险命令判断仍集中在 `commandSafety.ts`，MCP 日志继续复用 `sanitizeForLog`。
4. DRY
   - 不新增第二套路由或脱敏实现，继续使用现有共享 helper。

### 本轮验证

1. `npm test -- src/main/libs/commandSafety.test.ts src/main/libs/sanitizeForLog.test.ts src/main/libs/mcpLog.test.ts src/main/libs/electronBuilderHooks.test.ts src/main/libs/pruneOpenClawRuntime.test.ts src/main/libs/applyOpenClawPatches.test.ts`
   - 6 个测试文件通过。
   - 75 条测试通过。
2. `npx tsc --noEmit --project tsconfig.json`
   - 通过。
3. `npm run compile:electron`
   - 通过。

### 下一轮规划

批次 E 已完成。后续如果继续推进公共能力拉齐，建议改为新的大批次，不再混在 E 批次内：

1. F1：重新扫描 `origin/main` 剩余公共差异，按高耦合程度重新分桶。
2. F2：OpenClaw 主干重构独立批次，允许重建 `vendor/openclaw-runtime`，但需先跑网关启动和对话验收。
3. F3：per-agent modelSlice 独立批次，重点保护当前 Agent/工作台状态模型和青数 managed agent 刷新逻辑。
4. F4：POPO/IM 深度运行时迁移独立批次，继续保护现有多实例设置和青数渠道绑定。
5. F5：安装策略/备份恢复独立批次，包含 NSIS、SQLite backup/restore、Defender exclusion 等跨平台安装影响项。

### 剩余轮次估算

批次 E 已完成 E1、E2、E3、E4，本阶段剩余 0 轮。

## 2026-05-12：批次 F 第 1 轮重新扫描 origin/main 剩余公共差异

本轮开启批次 F。目标不是继续盲目扩大代码合入，而是先刷新 `origin/main` 并重新盘点当前 `front-design-merge` 与 main 的剩余差异，把后续工作拆成可控批次。当前工作树已有大量前序选择性合入内容，因此本轮只做扫描和文档更新，不直接搬高耦合代码。

### 本轮执行

1. 刷新远程 main
   - 执行 `git fetch origin main`。
   - 当前 `origin/main` 指向 `5564c264`，版本已到 `2026.5.9`。
   - 当前分支仍是 `front-design-merge`，本地工作树保留大量前序未提交改动。
2. 文件级差异扫描
   - 执行 `git diff --name-status origin/main` 和 `git diff --stat origin/main`。
   - 当前分支与 main 仍存在数百个文件差异，直接整包 merge 风险高。
   - 差异主要集中在 cowork 对话窗口、Artifacts、Agent sidebar、OpenClaw runtime、IM/POPO/NIM、scheduled task、SQLite backup、安装/构建脚本、青数覆盖层。
3. main 最近更新抽样
   - `origin/main` 最近一批包含 `2026.5.9` 版本 bump、main UI 优化、IM 时间修复、Agent avatar / cowork detail / sidebar detail 等。
   - 其中部分 UI 方向与当前青数主控台和工作台覆盖层冲突，不能整包套入。
4. main-only / current-only 状态核对
   - `src/main/windowState.ts` 当前工作区已存在但仍是未跟踪文件，说明前序合入已有手工带入痕迹，下一轮需要转为正式纳入或明确放弃。
   - `src/main/libs/sqliteBackup/sqliteBackupManager.ts` 当前仍缺失，属于安装/数据保护策略大批次。
   - `src/renderer/components/artifacts/ArtifactPanel.tsx` 当前仍缺失，当前分支只保留了 artifact parser / slice 等低层能力，不是 main 的完整 Artifacts panel。
   - `src/renderer/components/agentSidebar/MyAgentSidebarTree.tsx` 当前仍缺失，main 的 Agent sidebar 树与当前青数主控台结构冲突较高。
   - `src/renderer/store/slices/modelSlice.ts` 当前存在且已接入 per-agent 结构的一部分，但仍需单独批次核对所有调用点。
   - `src/main/libs/openaiCodexAuth.ts` 当前存在，说明 GitHub Copilot / Codex auth 相关内容不是完全缺失，但与 main 的认证主干仍有分叉。

### 剩余差异分桶

#### A. 可作为下一轮低耦合公共 bugfix 的区域

1. 窗口状态恢复与 off-screen 防护
   - main 有 `windowState.ts` 和测试，当前工作区已有未跟踪文件。
   - 该能力主要影响启动窗口位置与尺寸，低耦合，不触碰青数品牌、工作台、治理链、唤醒/TTS。
2. 部分 setup / startup 稳定性修复
   - main 最近包含 `fix-setup-exception` 相关说明和启动异常修复方向。
   - 需要下一轮从 `main.ts`、`sqliteStore.ts`、`windowState.ts` 等小范围抽取，不直接覆盖主流程。
3. IM 时间展示 bugfix
   - main 最近 PR `fix-im-time` 对 OpenClaw history、coworkStore、IM handler、CoworkSessionDetail 有改动。
   - 当前分支已多次改过历史展示逻辑，下一轮只适合抽取时间字段规范化和测试，不适合覆盖 UI。

#### B. 需要独立批次的公共能力

1. OpenClaw 主干重构
   - 涉及 `openclawRuntimeAdapter.ts`、`openclawConfigSync.ts`、`openclawHistory.ts`、`openclawChannelSessionSync.ts`、`main.ts`、`preload.ts`。
   - 用户已允许 OpenClaw runtime 可先删再重建，但仍需保留青数治理链、managed agent、唤醒/TTS 接线。
2. per-agent modelSlice
   - 当前已经存在部分 per-agent 模型选择结构，但与 main 调用点仍未完全拉齐。
   - 会影响 Agent 设置、工作台状态、scheduled task model ref、OpenClaw model ref。
3. POPO/NIM/IM 深度运行时迁移
   - 当前分支已经有 NIM/POPO 多实例设置闭环，但 main 侧还有运行时、时间同步、历史同步和 QR 登录差异。
   - 需保护现有多实例绑定、IM 设置 UI、青数 Agent 渠道绑定。
4. SQLite backup / install strategy
   - main 有完整 `sqliteBackup` manager、manifest、quarantine、startup restore 设计。
   - 会改变安装/启动数据策略，用户已允许重装 skill，但仍需防止误清除现有定时任务和会话数据。
5. 完整 Artifacts panel / CodeBlock / DocumentRenderer
   - main 有完整 artifact 右侧面板和多类型 renderer。
   - 当前分支已经有 artifact parser / slice 等低层补丁，但对话窗口和主控台布局受青数 UI 保护，必须单独做 UI 适配。
6. Agent sidebar / avatar / main UI 优化
   - main 的 Agent sidebar 树、Agent avatar 资源、主 UI 调整与当前青数主控台视觉和业务分区高度耦合。
   - 不建议作为公共 bugfix 小批次合入。

#### C. 当前分支必须继续保护的覆盖层

1. 青数品牌元数据、logo、品牌色、登录欢迎层。
2. 青数工作台、主控台中间区域、内置 Agent / Skill 展示与 managed catalog 刷新。
3. 青数内置治理链、tool bundle、Skill governance preview。
4. 唤醒浮层、wake input、macOS speech helper、TTS cache / edge-tts / macTtsService。
5. 当前已经修复过的历史对话展示、managed sessionKey 解析、OpenClaw config guard。

### 本轮判断

本轮不建议直接执行 `git merge origin/main`。原因是 main 的 UI、Artifacts、Agent sidebar 和 OpenClaw 主干同时大幅变化，而当前分支已包含青数覆盖层和多个替代实现。继续采用“小批次抽取 + 每批测试”的方式更稳。

### 下一轮规划

进入 F2：低耦合启动/窗口/时间类 bugfix 小批次，预计还剩 4 轮。

1. 核对并正式纳入 `src/main/windowState.ts` / `src/main/windowState.test.ts`，检查 main 中窗口状态恢复 IPC / BrowserWindow 接线是否已接上。
2. 回扫 main 的 `fix-setup-exception` 相关改动，优先提取不影响青数覆盖层的启动异常兜底。
3. 抽取 IM / OpenClaw history 时间字段规范化的小测试和 helper，避免覆盖当前对话窗口 UI。
4. 验证 `npm test` 目标文件、`npx tsc --noEmit --project tsconfig.json`、`npm run compile:electron`。

### 剩余轮次估算

批次 F 已完成 F1，本阶段预计还剩 4 轮：

1. F2：低耦合启动/窗口/时间类 bugfix。
2. F3：OpenClaw 主干重构准备与 runtime 重建验收。
3. F4：per-agent modelSlice 与 Provider/Copilot auth 调用点收口。
4. F5：POPO/NIM/IM 深度运行时与 SQLite backup / 安装策略分批验收。

## 2026-05-12：批次 F 第 2 轮低耦合启动/窗口/时间类 bugfix

本轮按 F2 规划处理低耦合启动、窗口状态和 IM 时间类 bugfix。先核对 `origin/main` 与当前分支已有实现，确认 `windowState` 和 IM 时间修复核心逻辑已经基本接入；随后只补一个当前分支仍缺失的异常恢复入口：初始化失败界面的一键重启。

### 本轮核对结论

1. 窗口状态恢复
   - `src/main/windowState.ts` 当前内容与 `origin/main` 一致。
   - `src/main/main.ts` 已接入 `resolveInitialAppWindowState`、窗口状态保存、关闭前清理保存 timer 等逻辑。
   - `src/main/windowState.test.ts` 已存在并通过，仅测试标题文案与 main 略有差异，不影响行为。
2. IM / OpenClaw history 时间修复
   - 当前 `src/main/libs/openclawHistory.ts` 已支持解析 gateway `timestamp` / `createdAt`。
   - 当前 `src/main/libs/agentEngine/openclawRuntimeAdapter.ts` 已支持 history entry timestamp，并在 reconcile 时把本地时间戳回填到缺 timestamp 的记录。
   - 当前 `src/main/coworkStore.ts` 已支持消息写入外部 timestamp，并在 `replaceConversationMessages()` 时保留已有 user/assistant 时间戳。
   - 因此本轮不再重复搬 `fix-im-time` 的 UI 改动，避免影响当前对话窗口展示逻辑。
3. setup exception 最小恢复入口
   - `origin/main` 已有初始化失败后一键重启入口。
   - 当前青数分支在主控台改造过程中缺失了 `app:relaunch` IPC、preload 类型和错误界面按钮。
   - 该修复只影响初始化失败兜底体验，不影响青数品牌、工作台、治理链、唤醒/TTS。

### 本轮代码更新

1. 主进程重启 IPC
   - 修改 `src/main/main.ts`。
   - 新增 `ipcMain.handle('app:relaunch', ...)`，调用 `app.relaunch()` 和 `app.quit()`。
2. preload 与类型声明
   - 修改 `src/main/preload.ts`。
   - 在 `window.electron.appInfo` 暴露 `relaunch()`。
   - 修改 `src/renderer/types/electron.d.ts`，补充 `appInfo.relaunch(): Promise<void>`。
3. 初始化失败界面
   - 修改 `src/renderer/App.tsx`。
   - 在初始化失败界面新增“重启应用”主按钮。
   - 保留“打开设置”按钮，但改为 secondary 样式，与 main 的异常恢复体验保持一致。
4. i18n
   - 修改 `src/renderer/services/i18n.ts`。
   - 增加 `restartApp` 中英文文案。

### 本轮刻意未改

1. 不覆盖当前对话窗口 UI。
2. 不整包替换 main 的 Agent sidebar、Artifacts panel、CodeBlock 或 MarkdownContent。
3. 不改 OpenClaw runtime 主干。
4. 不改青数品牌、工作台、managed catalog、治理链、唤醒/TTS。

### 原则校验

1. KISS
   - 只补一条初始化失败后的恢复路径，不引入新的启动状态机。
2. YAGNI
   - 本轮不提前处理完整异步 skill sync、网络超时和 SQLite backup，这些留给后续独立批次。
3. SOLID
   - 重启能力由主进程负责，renderer 只通过 preload 调用 IPC。
4. DRY
   - 复用 `appInfo` 暴露应用级能力，不新增第二套 renderer-main 桥接对象。

### 本轮验证

1. `npm test -- src/main/windowState.test.ts src/main/coworkStore.metadata.test.ts src/main/libs/openclawHistory.test.ts src/main/libs/agentEngine/openclawRuntimeAdapter.test.ts`
   - 4 个测试文件通过。
   - 94 条测试通过。
2. `npx tsc --noEmit --project tsconfig.json`
   - 通过。
3. `npm run compile:electron`
   - 通过。

### 下一轮规划

进入 F3：OpenClaw 主干重构准备与 runtime 重建验收，预计还剩 3 轮。

1. 先扫描 `origin/main` 与当前分支在 OpenClaw 主链路上的差异：`openclawRuntimeAdapter.ts`、`openclawConfigSync.ts`、`openclawEngineManager.ts`、`openclawHistory.ts`、`openclawChannelSessionSync.ts`、`main.ts`、`preload.ts`。
2. 明确哪些是已经接入的安全护栏：history timestamp、managed sessionKey、legacy Feishu plugin guard、gateway restart 延后、OpenClaw session patch。
3. 只选择一个 OpenClaw runtime 低耦合缺口落地，并跑 runtime/config/history 目标测试。
4. 如果需要重建 `vendor/openclaw-runtime`，先做版本和 patch 审计，不直接删除用户数据目录。

### 剩余轮次估算

批次 F 已完成 F1、F2，本阶段预计还剩 3 轮：

1. F3：OpenClaw 主干重构准备与 runtime 重建验收。
2. F4：per-agent modelSlice 与 Provider/Copilot auth 调用点收口。
3. F5：POPO/NIM/IM 深度运行时与 SQLite backup / 安装策略验收。

## 2026-05-12：批次 F 第 3 轮 OpenClaw 主链路稳定性收口

本轮按 F3 规划扫描 OpenClaw 主链路与 `origin/main` 的剩余差异，并只落一个低耦合 runtime 稳定性缺口。先确认 `package.json` 中 OpenClaw runtime 版本和插件版本与 main 一致，当前仍是 `v2026.4.14`，插件列表也一致，因此本轮不重建 `vendor/openclaw-runtime`，也不触碰用户数据目录。

### 本轮扫描结论

1. OpenClaw 版本与插件
   - 当前分支和 `origin/main` 的 `openclaw.version` 均为 `v2026.4.14`。
   - DingTalk、Feishu、WeCom、Weixin、POPO、NIM、Bee、Email 插件版本一致。
   - 本轮无需执行 runtime 删除或重新拉取。
2. 已接入的稳定性护栏
   - `apply-openclaw-patches.cjs` 已支持 patch 前 reset OpenClaw source，避免不同分支残留 patch。
   - `openclawConfigSync.ts` 已保留 `acpx` 禁用、`mcporter` managed skill 禁用、legacy Feishu plugin guard。
   - `openclawChannelSessionSync.ts` 已支持 managed sessionKey 中 agentId 带冒号的解析。
   - `openclawHistory.ts` / `openclawRuntimeAdapter.ts` 已支持 history timestamp、metadata、tail alignment 和本地 timestamp 回填。
   - `openclawMemoryFile.ts` / `openclawLocalExtensions.ts` 已有 memory file structure 和 extension manifest id 相关测试。
3. 本轮发现的缺口
   - 当前已能在手动 stop 后 10 秒 cooldown 内抑制迟到审批。
   - 但 cooldown 过后，桌面 managed session 的迟到非删除命令仍可能走 auto-approve。
   - main 的语义更稳：用户手动停止桌面会话后，旧 run 的迟到 approval 不应继续执行，直到下一次真正的新 run 清理 stopped state。

### 本轮代码更新

1. 迟到 approval 抑制
   - 修改 `src/main/libs/agentEngine/openclawRuntimeAdapter.ts`。
   - 在 `handleApprovalRequested()` 中，stop cooldown 检查之后增加 managed desktop session 的 `manuallyStoppedSessions` 判断。
   - 如果用户已经手动停止桌面会话，即使 10 秒 cooldown 已过，也不会自动批准旧 run 的非删除工具调用。
2. 回归测试
   - 修改 `src/main/libs/agentEngine/openclawRuntimeAdapter.test.ts`。
   - 新增 “non-delete approval for a manually stopped desktop session is suppressed after cooldown” 用例。
   - 覆盖 `curl https://example.com` 这类原本会自动批准的非删除命令。

### 本轮刻意未改

1. 不重建 `vendor/openclaw-runtime`。
2. 不覆盖 OpenClaw runtime adapter 大文件。
3. 不改 OpenClaw config 投影结构和 channels 投影。
4. 不触碰青数品牌、工作台、managed catalog、治理链、唤醒/TTS。
5. 不接完整 OpenClaw 主干重构，只补一个明确运行时安全缺口。

### 原则校验

1. KISS
   - 只在已有手动停止状态机上补一个判断，不新增 run lifecycle 状态机。
2. YAGNI
   - 不因为 F3 名称包含“主干重构”就整包替换 OpenClaw adapter。
3. SOLID
   - approval 抑制仍在 OpenClaw runtime adapter 内部处理，renderer 不感知 runtime 细节。
4. DRY
   - 复用已有 `manuallyStoppedSessions` 和 `isManagedSessionKey()`，不引入第二套停止状态。

### 本轮验证

1. `npm test -- src/main/libs/agentEngine/openclawRuntimeAdapter.test.ts src/main/libs/openclawConfigSync.runtime.test.ts src/main/libs/openclawConfigSync.test.ts src/main/libs/openclawHistory.test.ts src/main/libs/openclawChannelSessionSync.test.ts src/main/libs/openclawLocalExtensions.test.ts src/main/libs/openclawMemoryFile.test.ts`
   - 7 个测试文件通过。
   - 183 条测试通过。
2. `npx tsc --noEmit --project tsconfig.json`
   - 通过。
3. `npm run compile:electron`
   - 通过。

### 下一轮规划

进入 F4：per-agent modelSlice 与 Provider/Copilot auth 调用点收口，预计还剩 2 轮。

1. 核对当前 `modelSlice.ts` 的 per-agent selected model 与 main 的调用点差异。
2. 检查 `AgentCreateModal`、`AgentSettingsPanel`、`ModelSelector`、`CoworkSessionDetail`、`scheduledTask` 是否都使用同一套 model identity / providerKey / OpenClaw model ref。
3. 检查 `openaiCodexAuth`、`githubCopilotAuth`、`copilotTokenManager` 与 `coworkOpenAICompatProxy` 的认证边界，只选择低耦合 token / provider bugfix。
4. 不改青数登录主链路和 managed catalog，只处理公共 Provider / Copilot / per-agent model 的一致性问题。

### 剩余轮次估算

批次 F 已完成 F1、F2、F3，本阶段预计还剩 2 轮：

1. F4：per-agent modelSlice 与 Provider/Copilot auth 调用点收口。
2. F5：POPO/NIM/IM 深度运行时与 SQLite backup / 安装策略验收。

## 2026-05-12：批次 F 第 4 轮 Provider / Copilot / OpenClaw model ref 收口

本轮按 F4 规划继续对齐 `origin/main` 的 Provider、Copilot 认证边界和模型选择链路。扫描后确认：当前分支仍保留全局 `modelSlice.selectedModel` 结构，而 `origin/main` 已迁移到 per-agent selected model；这会牵动 `App.tsx`、`ModelSelector.tsx`、`CoworkView.tsx`、`CoworkPromptInput.tsx`、`api.ts` 和工作台状态模型。为了保护青数主控台和当前 Agent 展示逻辑，本轮不做 per-agent Redux 大迁移，改为先收一个低耦合但影响 OpenClaw 运行稳定性的缺口：模型级 OpenClaw provider identity 透传。

### 本轮扫描结论

1. per-agent modelSlice 大迁移仍需独立批次
   - `origin/main` 已有 `defaultSelectedModel`、`selectedModelByAgent`、`selectAgentSelectedModel()`、`setDefaultSelectedModel()` 等结构。
   - 当前分支仍使用 `selectedModel`、`selectedModelDirty`、`setSelectedModelSilently()` 与默认模型持久化。
   - 直接替换会影响青数工作台、Agent 创建/编辑、对话输入框、定时任务模型引用和当前会话模型覆盖逻辑。
2. Provider / Copilot 底层能力已基本接入
   - `ProviderRegistry` 已集中管理 provider label、URL、apiFormat、codingPlan、`openClawProviderId`。
   - Copilot 已映射为 `lobsterai-copilot`。
   - `providerRequestConfig.ts` 已包含 Copilot、Gemini、OpenAI Responses、GPT-5 / O 系模型 token 参数等兼容逻辑。
   - `coworkOpenAICompatProxy.ts` 与 `copilotTokenManager.ts` 已有 token refresher 结构，本轮不改认证主链路。
3. 本轮发现的缺口
   - `Model` 类型和 `openclawModelRef.ts` 已支持模型级 `openClawProviderId`。
   - 但 provider model 配置类型、App 初始化的模型列表构造和 `modelSlice.buildInitialModels()` 没有完整保留该字段。
   - 结果是如果某个 provider 下的单个模型需要特殊 OpenClaw provider id，例如 OpenAI Codex 模型走 `openai-codex`，模型级配置可能在进入 Redux 可用模型列表时丢失，进而导致 OpenClaw model ref 漂移。

### 本轮代码更新

1. Provider model 配置类型
   - 修改 `src/shared/providers/types.ts`。
   - 为 `ProviderModelConfig` 增加 `openClawProviderId?: string`。
2. AppConfig 类型去重复
   - 修改 `src/renderer/config.ts`。
   - 将 `providers` 从十几份重复 inline 类型收敛为 `Record<string, AppProviderConfig>`。
   - `AppProviderConfig` 复用 shared `ProviderConfig`，仅保留 renderer 当前支持的 `apiFormat` 联合类型。
   - `model.availableModels` 也允许 `openClawProviderId?: string`，防止 fallback 模型列表丢失该字段。
3. Redux 模型列表构造
   - 修改 `src/renderer/store/slices/modelSlice.ts`。
   - `buildInitialModels()` 从 provider model 中保留 `openClawProviderId`。
4. App 初始化与配置刷新
   - 修改 `src/renderer/App.tsx`。
   - provider 模型列表构造时优先使用模型级 `openClawProviderId`。
   - 模型未声明时回退到 provider 级 `ProviderRegistry.getOpenClawProviderId()`。
   - OpenAI OAuth 场景继续回退到 `OpenClawProviderId.OpenAICodex`，避免 Codex 模型被错误投影成普通 `openai`。
5. 回归测试
   - 修改 `src/renderer/services/config.test.ts`。
   - 新增配置规范化保留模型级 `openClawProviderId` 的测试，覆盖 `gpt-5.3-codex -> openai-codex` 这类场景。

### 本轮刻意未改

1. 不做完整 per-agent modelSlice Redux 迁移。
2. 不改青数工作台、主控台中间区域、Agent 列表和当前会话激活逻辑。
3. 不改青数登录、managed catalog、内置治理链。
4. 不改唤醒浮层、wake input、TTS cache 和 macOS speech helper。
5. 不改 Copilot/OpenAI token 刷新主链路，只保留当前已有 token refresher。

### 原则校验

1. KISS
   - 只补模型身份字段透传，不引入新的模型状态机。
2. YAGNI
   - per-agent Redux 大迁移暂缓，等 UI/工作台影响面单独评估。
3. SOLID
   - Provider 配置类型继续由 shared providers 模块拥有，renderer 只做投影和使用。
4. DRY
   - `AppConfig.providers` 去掉重复 inline model 类型，减少后续 provider model 字段漂移。

### 本轮验证

1. `npm test -- src/renderer/services/config.test.ts src/renderer/services/providerRequestConfig.test.ts src/shared/providers/constants.test.ts src/renderer/utils/openclawModelRef.test.ts src/renderer/components/cowork/agentModelSelection.test.ts`
   - 5 个测试文件通过。
   - 58 条测试通过。
2. `npx tsc --noEmit --project tsconfig.json`
   - 通过。
3. `npm run compile:electron`
   - 通过。

### 下一轮规划

进入 F5：POPO/NIM/IM 深度运行时与 SQLite backup / 安装策略验收，预计还剩 1 轮。

1. 回扫 `origin/main` 与当前分支在 POPO/NIM/IM runtime、QR 登录、history sync、IM scheduled task 和多实例迁移上的剩余差异。
2. 优先确认当前分支已接入的 NIM/POPO 多实例配置、Agent IM 绑定和 scheduled task agent 投递是否仍通过测试。
3. 扫描 SQLite backup / startup restore / install strategy 是否已经具备低耦合接入条件；如会改变数据恢复策略，只做文档化和验收清单，不在 F5 中强行大改。
4. 验证 IM、scheduled task、OpenClaw history 和 Electron compile，作为本阶段可验收门槛。

### 剩余轮次估算

批次 F 已完成 F1、F2、F3、F4，本阶段预计还剩 1 轮：

1. F5：POPO/NIM/IM 深度运行时与 SQLite backup / 安装策略验收。

## 2026-05-12：批次 F 第 5 轮 NIM/POPO 多实例兼容胶水与最终验收

本轮按 F5 规划收尾 POPO/NIM/IM 深度运行时与 SQLite backup / 安装策略。先对比 `origin/main` 和当前分支差异，确认当前分支已经有 NIM/POPO 多实例、QR 登录、Agent IM binding、scheduled task IM 投递等大量实现；但 SQLite backup / startup restore / quarantine 主干仍主要存在于 `origin/main`，当前分支尚未完整接入。考虑到 SQLite backup 会改变数据启动恢复策略，本轮不在最后阶段强行合入，而是把它列入后续独立数据策略批次。本轮实际落地的是测试暴露出的 NIM/POPO 单实例到多实例兼容缺口。

### 本轮扫描结论

1. NIM/POPO 多实例能力现状
   - 当前分支已有 `imSingleToMultiInstanceMigration.ts`、`nimQrLoginService.ts`、`IMSettingsMain.tsx` 中的 NIM/POPO 多实例配置和 QR 登录 UI。
   - Agent IM binding 已支持 `platform:instanceId` 形式。
   - scheduled task 和 cowork handler 已有多实例投递相关测试。
2. 本轮发现的真实缺口
   - `IMStore.setConfig()` 遇到 legacy 单实例 NIM/POPO 形态时，直接走 `setNimMultiInstanceConfig()` / `setPopoMultiInstanceConfig()`，会把 `instances` 当作必有数组并触发异常。
   - `IMStore.getConfig()` 只返回 `instances`，没有继续投影旧字段，导致仍使用 `config.nim.token` / `config.popo.appSecret` 的兼容调用点和测试失效。
   - `IMGatewayManager.buildMergedConfig()` 对 `configOverride.nim` / `configOverride.popo` 只做浅合并，测试连通性时传入旧单实例配置不会生成临时 `instances`，导致 `pickConfiguredNimInstance()` / `pickConfiguredPopoInstance()` 取不到凭证。
3. SQLite backup / install strategy 结论
   - `origin/main` 有完整 `src/main/libs/sqliteBackup/*` 主干，包括 manifest、snapshot、quarantine、startup restore 和 retention。
   - 当前分支尚未完整接入这些文件和启动链路。
   - 该能力会影响数据库启动、恢复、隔离和安装策略；虽属于公共能力，但不适合塞进 F5 收尾修复，应作为后续独立“数据恢复策略”批次处理。

### 本轮代码更新

1. IMStore legacy 单实例兼容
   - 修改 `src/main/im/imStore.ts`。
   - `setConfig()` 对 NIM/POPO 先判断 `instances` 是否为数组。
   - 如果是 multi-instance 形态，继续走 `setNimMultiInstanceConfig()` / `setPopoMultiInstanceConfig()`。
   - 如果是 legacy 单实例形态，改走 `setNimConfig()` / `setPopoConfig()`，由现有迁移逻辑生成 primary instance。
2. IMStore 公共配置投影兼容
   - 修改 `src/main/im/imStore.ts`。
   - `getConfig().nim` 现在同时包含 primary legacy 字段和 `instances`。
   - `getConfig().popo` 现在同时包含 primary legacy 字段和 `instances`。
   - 这样旧调用点能继续读取 `config.nim.token` / `config.popo.appSecret`，新 UI 仍读取 `instances`。
3. IMGatewayManager override 兼容
   - 修改 `src/main/im/imGatewayManager.ts`。
   - `buildMergedConfig()` 对 NIM/POPO override 增加 legacy 单实例到临时 primary instance 的内存投影。
   - 该投影只用于连通性检查和状态合并，不写入数据库。
   - 如果 override 已经带 `instances`，则保留 multi-instance 形态。

### 本轮刻意未改

1. 不合入完整 SQLite backup / startup restore 主干。
2. 不改变 IM 设置 UI。
3. 不改 POPO/NIM OpenClaw plugin 运行方式。
4. 不改青数品牌、工作台、managed catalog、治理链。
5. 不改唤醒浮层、wake input、TTS cache 和 macOS speech helper。

### 原则校验

1. KISS
   - 只补 legacy 单实例和 multi-instance 之间的兼容投影，不新增迁移状态机。
2. YAGNI
   - SQLite backup 作为独立数据策略批次，不在最后验收轮临时引入启动恢复主干。
3. SOLID
   - 持久化兼容放在 `IMStore`，连通性 override 兼容放在 `IMGatewayManager`，职责边界清晰。
4. DRY
   - 复用已有 `setNimConfig()` / `setPopoConfig()` 和 primary instance 选择逻辑，避免第二套迁移实现。

### 本轮验证

1. `npm test -- src/renderer/components/agent/agentImBindingConfig.test.ts src/renderer/store/slices/imSlice.test.ts src/main/im/imStore.test.ts src/main/im/imCoworkHandler.test.ts src/main/im/imScheduledTaskHandler.test.ts src/main/im/imGatewayManager.nim.test.ts src/main/im/nimQrLoginService.test.ts src/main/im/imSingleToMultiInstanceMigration.test.ts src/main/im/imScheduledTaskAgent.test.ts`
   - 9 个测试文件通过。
   - 79 条测试通过。
2. `npx tsc --noEmit --project tsconfig.json`
   - 通过。
3. `npm run compile:electron`
   - 通过。

### 下一阶段规划

批次 F 已完成。后续如果继续推进 main 公共能力，建议进入新的批次 G，而不是继续塞进本批次：

1. G1：SQLite backup / startup restore / quarantine 数据策略独立接入。
   - 先决定是否启用默认自动备份、备份目录、retention、损坏库隔离策略。
   - 补充“不会清空用户定时任务和会话数据”的恢复验收。
2. G2：POPO/NIM/IM runtime 真实联调。
   - 使用真实 OpenClaw gateway 和插件启动，验证二维码登录、实例配置同步、Agent binding、scheduled task 投递。
3. G3：per-agent modelSlice 大迁移。
   - 单独处理 Redux 状态模型、主控台/工作台调用点和默认模型持久化。
4. G4：OpenClaw 主干重构或 runtime 重建。
   - 在保护青数治理链、managed catalog、唤醒/TTS 的前提下做整链路验收。

### 剩余轮次估算

批次 F 已完成 F1、F2、F3、F4、F5，本阶段剩余 0 轮。

## 2026-05-12：批次 G 第 1 轮 sql.js SQLite 手动备份地基

本轮进入批次 G，按上一轮规划先处理 SQLite backup / startup restore / quarantine 数据策略。扫描 `origin/main` 后确认：main 的 SQLite backup 主干基于 `better-sqlite3`，而当前 `front-design-merge` 仍使用 `sql.js`，两者底层数据库驱动不同。直接搬 main 的 `SqliteBackupManager` 会把备份能力和数据库驱动迁移绑定在一起，风险过高。因此本轮采用更稳的两阶段策略：先为当前 `sql.js` 建立手动备份地基，不默认启用启动恢复，也不做自动 quarantine。

### 本轮扫描结论

1. 当前分支数据库底层
   - `src/main/sqliteStore.ts` 仍使用 `sql.js`。
   - 数据保存依赖 `db.export()` 后写入 `lobsterai.sqlite`。
2. `origin/main` 数据库底层
   - `origin/main/src/main/sqliteStore.ts` 已使用 `better-sqlite3`。
   - `origin/main/src/main/libs/sqliteBackup/*` 使用 `better-sqlite3` 的 online backup / pragma / close / reopen 能力。
3. 风险判断
   - 如果直接搬 main 的备份恢复主干，需要同时迁移 SQLite driver、启动打开数据库流程、健康检查与恢复流程。
   - 这会影响现有会话、定时任务、IM 配置、managed catalog 和用户本地数据库。
   - 本轮不应把“备份能力”与“数据库驱动迁移”合并处理。

### 本轮代码更新

1. 新增 sql.js 备份常量
   - 新增 `src/main/libs/sqliteBackup/constants.ts`。
   - 定义 `SqliteBackupTrigger`、备份目录、单文件快照名、manifest 版本、retention 和备份记录结构。
2. 新增 sql.js 备份管理器
   - 新增 `src/main/libs/sqliteBackup/sqliteBackupManager.ts`。
   - `SqlJsBackupManager.createBackup()` 基于当前 `db.export()` 生成快照。
   - 写入 `backups/sqlite/snapshots/lobsterai-latest.sqlite`。
   - 写入 `backups/sqlite/manifest.json`，记录 checksum、size、quick_check 和触发类型。
   - 采用单文件 latest snapshot 策略，避免长期堆积本地数据库副本。
3. SqliteStore 手动备份入口
   - 修改 `src/main/sqliteStore.ts`。
   - 保存 `userDataPath`。
   - 增加 `createBackup(trigger = Manual)`，先 `save()` 再交给 `SqlJsBackupManager` 生成快照。
   - 本轮不在启动时自动调用，也不在启动失败时自动恢复。
4. 防退化测试
   - 新增 `src/main/libs/sqliteBackup/sqliteBackupManager.test.ts`。
   - 覆盖路径生成、retention、快照写入、manifest 写入、快照可用 `sql.js` 重新打开、最新快照覆盖和周期判断。

### 本轮刻意未改

1. 不迁移到 `better-sqlite3`。
2. 不启用自动 startup restore。
3. 不做 corrupted database quarantine。
4. 不在应用启动时自动创建周期备份。
5. 不改变现有 `SqliteStore.create()` 打开数据库流程。
6. 不触碰青数品牌、工作台、managed catalog、治理链、唤醒/TTS。

### 原则校验

1. KISS
   - 先建立最小手动备份能力，只处理 `sql.js` 当前真实运行时。
2. YAGNI
   - 暂不实现自动恢复和 quarantine，避免未验证策略误动用户数据库。
3. SOLID
   - 备份逻辑集中在 `sqliteBackup` 模块，`SqliteStore` 只暴露触发入口。
4. DRY
   - 复用 `SqliteStore.save()` 和 `db.export()`，不新增第二套数据库序列化路径。

### 本轮验证

1. `npm test -- src/main/libs/sqliteBackup/sqliteBackupManager.test.ts`
   - 1 个测试文件通过。
   - 5 条测试通过。
2. `npx tsc --noEmit --project tsconfig.json`
   - 通过。
3. `npm run compile:electron`
   - 通过。

### 下一轮规划

进入 G2：安全接入备份触发和可观测入口，预计还剩 3 轮。

1. 评估是否增加“手动备份 IPC / 设置页入口 / 调试菜单入口”中的一种。
2. 优先选择低风险入口：只允许用户明确触发，不做自动恢复。
3. 增加备份状态查询能力：manifest、最新快照时间、size、quickCheck。
4. 验证不会清空或覆盖现有定时任务、会话、IM 配置。

### 剩余轮次估算

批次 G 已完成 G1，本阶段预计还剩 3 轮：

1. G2：手动备份触发与备份状态可观测入口。
2. G3：POPO/NIM/IM runtime 真实联调准备与 OpenClaw config 验收。
3. G4：per-agent modelSlice 或 OpenClaw 主干重构前置拆分评估。

## 2026-05-12：批次 G 第 1 轮修订 better-sqlite3 数据库主干接入

用户补充确认：`origin/main` 已切到 `better-sqlite3`，青数覆盖层不涉及数据库层修改，当前未上线且本地数据允许删除重建。因此本轮撤销“只做 sql.js 手动备份地基”的保守方向，改为按 main 的公共数据库主干推进：底层数据库打开、备份、恢复、quarantine 与 MCP store 先对齐 `better-sqlite3`，青数品牌、工作台、managed catalog、治理链、唤醒/TTS 不参与本轮改动。

### 本轮代码更新

1. 数据库引擎切换
   - `src/main/sqliteStore.ts` 从 `sql.js` 文件导出/写回模式切换为 `better-sqlite3` 文件型数据库。
   - 启动时通过 `openSqliteDatabaseWithRecovery()` 打开数据库，并应用 WAL / synchronous / cache / autocheckpoint 推荐 pragma。
   - 保留当前分支已有 schema：`tool_bundle_ids`、`agent_id`、`model_override`、`active_skill_ids`、记忆表、MCP 表等。
   - 新增 `getNativeDatabase()`，供已迁移模块直接使用原生 `better-sqlite3`。
2. 兼容层
   - 新增 `src/main/libs/sqliteCompat.ts`。
   - 暂时为 `coworkStore`、`imStore`、scheduled task migration 等未迁移模块提供 `exec/run/prepare/bind/step/getAsObject/getRowsModified` 兼容接口。
   - 这是过渡层，后续逐个 store 改成原生 `prepare().get/all/run()` 后可删除。
3. SQLite backup / recovery
   - `src/main/libs/sqliteBackup/constants.ts` 扩展为 main 的 better-sqlite3 backup 常量集合。
   - `src/main/libs/sqliteBackup/sqliteBackupManager.ts` 切换为 better-sqlite3 online backup。
   - 支持 latest snapshot、manifest、quick_check、integrity_check、`.previous` 安全发布、corrupt DB quarantine、startup recovery 和周期备份 loop。
   - 新增 `src/main/libs/sqliteBackup/sqliteBackupRecovery.test.ts`。
   - 更新 `src/main/libs/sqliteBackup/sqliteBackupManager.test.ts` 为 better-sqlite3 测试。
4. MCP store 原生迁移
   - `src/main/mcpStore.ts` 直接使用 `better-sqlite3`。
   - `src/main/main.ts` 中 `McpStore` 改为接收 `sqliteStore.getNativeDatabase()`。
   - 该模块没有青数业务阻断点，因此优先原生迁移，避免继续依赖兼容层。
5. 依赖更新
   - `package.json` 增加 `better-sqlite3` 和 `@types/better-sqlite3`。
   - `package-lock.json` 已通过 `npm install --package-lock-only --ignore-scripts --engine-strict=false` 更新。
   - 当前 shell Node 为 25.8.2，不符合项目 `.nvmrc=24`；本轮为验证 native binding，执行了 `npm rebuild better-sqlite3 --engine-strict=false` 并成功生成本机 binding。

### 本轮刻意未改

1. 不直接整文件替换 `coworkStore.ts`，因为当前分支有青数 managed Agent 字段、toolBundleIds、IM 会话投影、history reconciliation、turn memory update 等业务逻辑。
2. 不直接整文件替换 `imStore.ts`，因为当前分支有 NIM/POPO 单实例到多实例兼容、platformAgentBindings 迁移、conversation reply route、openclaw_session_key 等业务逻辑。
3. 不改青数品牌、主控台/工作台 UI、managed catalog、内置治理链。
4. 不改唤醒浮层、wake input、TTS cache 和 macOS speech helper。
5. 暂不把 scheduledTask / coworkStore / imStore 全量原生 better-sqlite3 化，避免一次性扩大回归面。

### 原则校验

1. KISS
   - 先完成数据库引擎主干切换，并用薄兼容层承接旧 store，不把业务 store 重构和 DB driver 迁移搅在同一轮。
2. YAGNI
   - 不新增额外 UI 和用户可见设置；只接 main 已有公共数据库能力。
3. SOLID
   - `mcpStore` 作为低耦合模块先原生迁移；`coworkStore/imStore` 的业务逻辑暂由兼容层隔离。
4. DRY
   - 备份/恢复主干复用 main 的 online backup 思路，不再维护 sql.js 专用备份实现。

### 本轮验证

1. `npx tsc --project electron-tsconfig.json --noEmit`
   - 通过。
2. `npx vitest run src/main/libs/sqliteBackup/sqliteBackupManager.test.ts src/main/libs/sqliteBackup/sqliteBackupRecovery.test.ts`
   - 2 个测试文件通过。
   - 10 条测试通过。
3. `npm rebuild better-sqlite3 --engine-strict=false`
   - 成功。
   - 注意：项目标准环境仍应使用 Node 24；当前验证在 Node 25 下完成本机 native rebuild，仅用于本轮开发验收。

### 下一轮规划

进入 G2：把剩余数据库直接使用方逐个从兼容层迁到原生 `better-sqlite3`，预计还剩 3 轮。

1. G2：scheduledTask `metaStore` / migration 迁移。
   - 优先低耦合 scheduled task metadata 与 legacy migration。
   - 迁移后跑 scheduled task meta/migrate 相关测试。
2. G3：`coworkStore` 局部原生迁移。
   - 保留青数 managed Agent、toolBundleIds、IM session summary、history reconciliation、memory update。
   - 只替换 DB helper，不整文件覆盖 main。
3. G4：`imStore` 局部原生迁移与最终验收。
   - 保留 NIM/POPO 兼容、多实例迁移、platformAgentBindings、reply route 和 openclaw_session_key。
   - 跑 IM 测试矩阵、Electron 编译，再决定是否需要打 `.app`。

### 剩余轮次估算

批次 G 已完成修订版 G1，本阶段预计还剩 3 轮：G2、G3、G4。

## 2026-05-12：批次 G 第 2 轮 scheduledTask better-sqlite3 原生迁移

本轮继续按用户确认的数据库主干方向推进：在不触碰青数品牌、工作台、managed catalog、内置治理链、唤醒/TTS 的前提下，把低耦合的 scheduledTask 本地 metadata 与 legacy migration 从临时 `sqliteCompat` 层迁到 `better-sqlite3` 原生接口。

### 本轮代码更新

1. scheduled task metadata 原生迁移
   - `src/scheduledTask/metaStore.ts` 从 `sql.js` 类型切换到 `better-sqlite3`。
   - `ensureTable()` 改用 `db.exec()`。
   - `get/list/set/delete` 改用 `prepare().get()`、`prepare().all()`、`prepare().run()`。
2. scheduled task legacy migration 原生迁移
   - `src/scheduledTask/migrate.ts` 的 `MigrationDeps` / `RunHistoryMigrationDeps` 改为接收 `Database.Database`。
   - legacy table 检查从 `db.exec()` 结果数组解析改为 `prepare(...).get()`。
   - legacy task / run rows 读取从 `exec().columns/values` 手动映射改为 `prepare(...).all()`。
   - run history 的 task name map 同步使用 native query。
3. main 进程接线
   - `src/main/main.ts` 中 scheduled task 与 run history migration 改为注入 `getStore().getNativeDatabase()`。
   - `coworkStore` 与 `IMGatewayManager/imStore` 仍暂时保留兼容层，留到后续高耦合批次处理。
4. 测试迁移
   - `src/scheduledTask/metaStore.test.ts`、`src/scheduledTask/integration.test.ts`、`src/scheduledTask/migrate.test.ts` 改为使用临时文件型 `better-sqlite3` 数据库。
   - 移除 `sql.js` 测试 mock，直接覆盖 native statement 行为。

### 本轮刻意未改

1. 不整文件替换 `coworkStore.ts`，避免丢失青数 managed Agent 字段、toolBundleIds、IM session summary、history reconciliation 与 memory governance。
2. 不整文件替换 `imStore.ts`，避免丢失 NIM/POPO 兼容、多实例迁移、platformAgentBindings、conversation reply route 与 openclaw_session_key。
3. 不改任何青数品牌、主控台/工作台 UI、内置治理链、唤醒浮层、wake input、TTS cache、macOS speech helper。

### 原则校验

1. KISS
   - 本轮只处理 scheduledTask 的 DB API 替换，不把业务 store 重构混入同一轮。
2. YAGNI
   - 不新增用户可见功能和迁移 UI，只做 main 已有公共数据库能力的必要对齐。
3. SOLID
   - metadata store 与 migration 各自保持单一职责，只替换底层持久化接口。
4. DRY
   - 减少 `sqliteCompat` 适配面，避免同一套 DB 访问长期维护 sql.js 风格与 better-sqlite3 风格两种写法。

### 本轮验证

1. `npx vitest run src/scheduledTask/metaStore.test.ts src/scheduledTask/integration.test.ts src/scheduledTask/migrate.test.ts`
   - 3 个测试文件通过。
   - 24 条测试通过。
2. `npx tsc --project electron-tsconfig.json --noEmit`
   - 通过。
3. `rg -n "sql\\.js|initSqlJs|makeSqlJsDb|db: db as never|SqlJsExecResult" src/scheduledTask src/main/main.ts`
   - 未发现 scheduledTask 目录仍引用 `sql.js`。

### 下一轮规划

进入 G3：`coworkStore` 局部 better-sqlite3 原生迁移，预计还剩 2 轮。

1. 先扫描 `coworkStore.ts` 中所有 sql.js-style statement helper、`getRowsModified()`、`exec()` 结果解析点。
2. 按 CRUD 区块分批替换为 native `prepare().get/all/run()`，保留青数 managed Agent 字段、toolBundleIds、IM session summary、history reconciliation、turn memory update。
3. 同步更新 `coworkStore.*.test.ts` 中仍依赖 sql.js/compat 的部分。
4. 验证 `coworkStore` 定向测试、`electron-tsconfig` 类型检查，并确认 `sqliteCompat` 剩余使用面只剩 IM。

### 剩余轮次估算

批次 G 已完成 G1 和 G2，本阶段预计还剩 2 轮：

1. G3：`coworkStore` 局部原生迁移。
2. G4：`imStore` / `IMGatewayManager` 局部原生迁移与最终验收。

## 2026-05-12：批次 G 第 3 轮 coworkStore better-sqlite3 原生迁移

本轮按 G3 计划推进：把 `coworkStore` 从 `sqliteCompat` 迁到 `better-sqlite3` 原生接口，同时保留青数 managed Agent 字段、toolBundleIds、IM session summary、history reconciliation、turn memory update 与 memory governance 等当前分支业务逻辑，不整文件覆盖 main。

### 本轮代码更新

1. `coworkStore` 原生 DB 接入
   - `src/main/coworkStore.ts` 从 `sql.js` 类型切换为 `better-sqlite3`。
   - 构造函数接收 `Database.Database`。
   - `getOne()` / `getAll()` 改为 `prepare().get()` 与 `prepare().all()`。
   - 新增 `run()` 小封装，统一 `prepare().run()` 并记录 `changes`。
2. 消息写入与历史同步路径迁移
   - `addMessage()` 的 next sequence 查询改为 `getOne()`。
   - `insertMessageBeforeId()` 的 target sequence 查询改为 `getOne()`。
   - `replaceConversationMessages()` 的已有 user/assistant timestamp 读取和 max sequence 查询改为 native query。
   - 保留原有逻辑：tool/system 消息不删除，user/assistant 历史按权威 transcript 重建，并尽量复用旧 timestamp。
3. memory governance 路径迁移
   - `deleteMessage()`、`deleteUserMemory()`、`resetRunningSessions()` 改用 `run()` 记录的 `lastChanges` 判断影响行数。
   - 保留“先记录主表删除结果，再更新 sources”的判定顺序，避免 sources 无记录时误判失败。
4. main 进程接线
   - `src/main/main.ts` 中 `CoworkStore` 改为注入 `sqliteStore.getNativeDatabase()`。
   - `IMGatewayManager/imStore` 仍暂时使用 `sqliteStore.getDatabase()`，留到 G4 处理。
5. 测试迁移
   - `src/main/coworkStore.agent.test.ts`、`src/main/coworkStore.metadata.test.ts` 改为使用临时文件型 `better-sqlite3` 数据库。
   - 定向覆盖 Agent `toolBundleIds`、`workingDirectory`、消息 metadata 容错、conversation replacement timestamp、channel message timestamp。

### 本轮刻意未改

1. 不改青数品牌、工作台/主控台 UI、managed catalog、内置治理链、唤醒/TTS。
2. 不整文件替换 `coworkStore.ts`，避免覆盖当前分支业务字段和治理逻辑。
3. 不改 `imStore.ts` / `IMGatewayManager`，避免把 NIM/POPO 多实例兼容、platformAgentBindings、reply route 与 openclaw_session_key 混入本轮。

### 原则校验

1. KISS
   - 通过 `getOne/getAll/run` 三个小封装完成底层驱动切换，最大限度保留业务代码形态。
2. YAGNI
   - 不提前引入 repository 层或重写业务 store，只满足当前 better-sqlite3 接入目标。
3. SOLID
   - DB 执行细节集中在 `CoworkStore` 内部私有方法，外部调用方不感知驱动变化。
4. DRY
   - 移除 `coworkStore` 对 sql.js 风格 `exec()` 结果映射和 `getRowsModified()` 的重复依赖。

### 本轮验证

1. `npx vitest run src/main/coworkStore.agent.test.ts src/main/coworkStore.metadata.test.ts`
   - 2 个测试文件通过。
   - 7 条测试通过。
2. `npx vitest run src/scheduledTask/metaStore.test.ts src/scheduledTask/integration.test.ts src/scheduledTask/migrate.test.ts`
   - 3 个测试文件通过。
   - 24 条测试通过。
3. `npx tsc --project electron-tsconfig.json --noEmit`
   - 通过。
4. `rg -n "getDatabase\\(\\)|sqliteCompat" src/main src/scheduledTask`
   - 剩余兼容层调用只剩 `IMGatewayManager/imStore` 初始化路径。

### 下一轮规划

进入 G4：`imStore` / `IMGatewayManager` better-sqlite3 原生迁移与最终验收，预计还剩 1 轮。

1. 扫描 `imStore.ts` 中所有 sql.js-style `exec/run/prepare/bind/step/getAsObject/getRowsModified` 使用点。
2. 采用与 G3 相同的低风险方式：在 `imStore` 内部保留小型 `getOne/getAll/run` 封装，避免整文件覆盖。
3. 保留 NIM/POPO 单实例到多实例兼容、DingTalk/Feishu/QQ/WeCom 多实例迁移、platformAgentBindings、conversation reply route、openclaw_session_key。
4. 更新 `imStore`、IM cowork/scheduled task、NIM/POPO 相关测试为临时 better-sqlite3 数据库。
5. 跑 IM 定向测试、scheduledTask/coworkStore 回归测试、`electron-tsconfig` 类型检查；通过后评估是否可以删除 `sqliteCompat` 兼容层。

### 剩余轮次估算

批次 G 已完成 G1、G2、G3，本阶段预计还剩 1 轮：G4 `imStore` / `IMGatewayManager` 原生迁移与最终验收。

## 2026-05-12：批次 G 第 4 轮 imStore / IMGatewayManager better-sqlite3 原生迁移与最终验收

本轮按 G4 计划完成数据库公共能力对齐收口：把 IM 存储与网关管理链路从 `sqliteCompat` / `sql.js` 兼容层迁到 `better-sqlite3` 原生接口，并删除 `sql.js` 依赖和打包配置尾巴。本轮未触碰青数品牌、工作台/主控台 UI、managed catalog、内置治理链、唤醒/TTS。

### 本轮代码更新

1. IM 存储原生 DB 接入
   - `src/main/im/imStore.ts` 从 `sql.js` 类型迁移为 `better-sqlite3`。
   - 内部新增 `getOne()`、`getAll()`、`run()` 小封装，统一 `prepare().get/all/run()`。
   - `migrateDefaults()`、多实例配置、session mapping、channel/session metadata、platformAgentBindings 等读写路径改为 native query。
2. IMGatewayManager 原生 DB 注入
   - `src/main/im/imGatewayManager.ts` 构造类型切换为 `Database.Database`。
   - `src/main/main.ts` 中 `IMGatewayManager` 改为注入 `sqliteStore.getNativeDatabase()`。
3. 兼容层删除
   - 删除 `src/main/libs/sqliteCompat.ts`。
   - `src/main/sqliteStore.ts` 移除 `compatDb`、`createSqlJsCompatDatabase` 和 `getDatabase()`，仅保留 `getNativeDatabase()`。
4. 依赖与打包配置收口
   - `package.json` / `package-lock.json` 删除 `sql.js` 与 `@types/sql.js`。
   - `vite.config.ts` 删除 `sql.js` external 配置。
   - `electron-builder.json` 删除 `node_modules/sql.js/dist/**` 的 `asarUnpack` 配置。
5. 测试迁移
   - `src/main/im/imStore.test.ts`、`src/main/im/imGatewayManager.nim.test.ts` 改为临时文件型 `better-sqlite3` 数据库。
   - 保留并验证 NIM/POPO 单实例到多实例兼容、IM scheduled task、reply guard、delivery route、NIM QR login 等相关链路。

### 本轮刻意未改

1. 不改青数品牌、工作台/主控台 UI、managed catalog、内置治理链、唤醒/TTS。
2. 不整文件替换 `imStore.ts`，避免覆盖当前分支已有 NIM/POPO、多实例迁移、平台绑定、reply route 与 `openclaw_session_key` 逻辑。
3. 不引入新的数据库抽象层，避免在完成 better-sqlite3 迁移时顺手扩大重构面。

### 原则校验

1. KISS
   - 采用与 G3 一致的 `getOne/getAll/run` 小封装，降低迁移风险。
2. YAGNI
   - 删除已无源码消费者的 `sql.js` 依赖，不保留未来假设用不到的兼容运行时。
3. SOLID
   - DB 驱动细节收敛在 store 内部，调用方只依赖业务方法。
4. DRY
   - 移除 `sqliteCompat`，避免长期维护 sql.js 风格与 better-sqlite3 风格两套访问模型。

### 本轮验证

1. `rg -n "sql\\.js|@types/sql\\.js|initSqlJs|new SQL|getDatabase\\(|sqliteCompat|createSqlJsCompatDatabase|BetterSqliteCompatDatabase" package.json package-lock.json vite.config.ts electron-builder.json src/main src/scheduledTask`
   - 未发现残留。
2. `npx tsc --project electron-tsconfig.json --noEmit`
   - 通过。
3. `npx vitest run src/main/im/imStore.test.ts src/main/im/imGatewayManager.nim.test.ts src/main/im/imSingleToMultiInstanceMigration.test.ts`
   - 3 个测试文件通过。
   - 29 条测试通过。
4. `npx vitest run src/main/im/imStore.test.ts src/main/im/imGatewayManager.nim.test.ts src/main/im/imSingleToMultiInstanceMigration.test.ts src/main/im/imCoworkHandler.test.ts src/main/im/imScheduledTaskHandler.test.ts src/main/im/imScheduledTaskAgent.test.ts src/main/im/imGatewayConfigState.test.ts src/main/im/imDeliveryRoute.test.ts src/main/im/imReplyGuard.test.ts src/main/im/nimQrLoginService.test.ts`
   - 10 个测试文件通过。
   - 58 条测试通过。
5. `npx vitest run src/main/libs/sqliteBackup/sqliteBackupManager.test.ts src/main/libs/sqliteBackup/sqliteBackupRecovery.test.ts src/main/coworkStore.agent.test.ts src/main/coworkStore.metadata.test.ts src/scheduledTask/metaStore.test.ts src/scheduledTask/integration.test.ts src/scheduledTask/migrate.test.ts src/main/im/imStore.test.ts src/main/im/imGatewayManager.nim.test.ts src/main/im/imSingleToMultiInstanceMigration.test.ts src/main/im/imCoworkHandler.test.ts src/main/im/imScheduledTaskHandler.test.ts src/main/im/imScheduledTaskAgent.test.ts src/main/im/imGatewayConfigState.test.ts src/main/im/imDeliveryRoute.test.ts src/main/im/imReplyGuard.test.ts src/main/im/nimQrLoginService.test.ts`
   - 17 个测试文件通过。
   - 99 条测试通过。

### 下一轮规划

批次 G 已完成，当前 better-sqlite3 公共数据库迁移达到可验收状态。下一轮建议进入批次 H：做一次与 `origin/main` 的剩余公共差异复扫，只挑低耦合 bugfix/构建稳定性/Provider 配置类补丁继续合入。

1. H1：扫描 `origin/main...front-design-merge` 剩余公共模块差异，排除青数覆盖层、主控台 UI、治理链、唤醒/TTS。
2. H2：优先选择低耦合公共 bugfix 或构建稳定性补丁落地。
3. H3：跑 `electron-tsconfig`、相关模块测试，并更新本文档。

### 剩余轮次估算

批次 G 剩余 0 轮。若继续推进 main 公共能力拉齐，建议按新的批次 H 估算 2 到 3 轮，每轮只合入一个低耦合主题，避免影响青数覆盖层。

## 2026-05-13：批次 H 第 1 轮 origin/main 剩余公共差异复扫与已覆盖项确认

本轮按 H1 计划先刷新并复扫 `origin/main`，不急于继续写代码。当前 `origin/main` 已到 `5564c264`，近期新增公共内容主要包括 Cowork 消息元数据展示、IM 历史时间修复、Artifacts 文件预览修复、Agent avatar / sidebar UI、主界面优化、OpenClaw/Provider/打包脚本差异等。

### 本轮结论

1. 已覆盖的 main 低耦合 bugfix
   - `fix(cowork): hide agent name in message metadata` 已在当前分支通过 `src/renderer/components/cowork/assistantMetadata.ts` 覆盖。
   - `fix(cowork): hide cache read display when value is zero` 已在当前分支通过 `buildAssistantMetadataItems()` 的 `cacheReadTokens > 0` 条件覆盖。
   - `fix: 修复 IM 渠道对话记录中时间不正确的问题` 的核心链路已在当前分支覆盖：`openclawHistory` 解析 gateway timestamp、`openclawRuntimeAdapter` 传递并回填本地 timestamp、`coworkStore.replaceConversationMessages()` 保留/写入 message timestamp 并更新 session `updatedAt`。
2. 本轮未重复改代码
   - 这些能力已经有当前分支实现和测试，重复搬 main patch 会增加噪声和冲突面。
   - 保持 KISS：确认事实后停止，不为了“推进感”制造无效 diff。
3. 仍需后续选择性处理的公共区域
   - Artifacts 文件预览相关：文件路径解析、去重、有效性校验、文件列表搜索/排序、HTML 预览刷新按钮。
   - OpenClaw runtime / config / patch / packaging 的剩余差异。
   - Provider / 模型配置与 OpenAI-compatible proxy 的剩余差异。
   - Agent avatar / sidebar / 主 UI 属高耦合 UI，暂缓整包合入。

### 本轮刻意未改

1. 不触碰青数品牌、工作台/主控台 UI、managed catalog、内置治理链、唤醒/TTS。
2. 不搬 `AgentTreeNode`、Agent avatar、sidebar 优化等主 UI 大改。
3. 不整包替换 Artifacts UI，只把它列为下一轮低耦合解析与去重候选。

### 原则校验

1. KISS
   - 先识别已覆盖 bugfix，避免重复实现。
2. YAGNI
   - 不在本轮引入新 UI 或新抽象。
3. SOLID
   - 继续保持消息元数据展示逻辑在 `assistantMetadata.ts`，历史时间修正在 `openclawHistory` / runtime adapter / store 各自职责内。
4. DRY
   - 不复制 main 中已经被当前分支更好抽象覆盖的 `CoworkSessionDetail` 内联逻辑。

### 本轮验证

1. `npx vitest run src/renderer/components/cowork/assistantMetadata.test.ts src/main/libs/openclawHistory.test.ts src/main/libs/agentEngine/openclawRuntimeAdapter.test.ts src/main/coworkStore.agent.test.ts src/main/coworkStore.metadata.test.ts src/renderer/services/artifactParser.test.ts src/renderer/store/slices/artifactSlice.test.ts`
   - 7 个测试文件通过。
   - 114 条测试通过。
2. `npx tsc --project tsconfig.json --noEmit`
   - 通过。
3. `npx tsc --project electron-tsconfig.json --noEmit`
   - 通过。

### 下一轮规划

进入 H2：Artifacts 文件预览低耦合 bugfix 收口，预计还剩 2 轮。

1. 对比 `origin/main` 的 `artifactParser.ts`、`artifactSlice.ts`、`ArtifactPanel/FileDirectoryView/HtmlRenderer/CodeRenderer` 与当前分支实现。
2. 只挑解析、去重、有效性、刷新按钮这类能局部落地和测试的公共 bugfix。
3. 不整包替换当前分支的 Artifacts UI，不改变青数主控台布局。
4. 验证 `artifactParser.test.ts`、`artifactSlice.test.ts`、必要的 renderer TypeScript。

### 剩余轮次估算

批次 H 预计还剩 2 轮：

1. H2：Artifacts 文件预览低耦合 bugfix。
2. H3：OpenClaw/Provider/打包稳定性剩余小补丁复扫与最终验收。

## 2026-05-13：批次 H 第 2 轮 Artifacts 文件预览低耦合 bugfix

本轮按 H2 计划处理 Artifacts 文件预览相关公共 bugfix，但没有整包搬 `origin/main` 的 Artifacts 右侧面板 UI。当前分支已经把 Artifacts 能力收敛到 `coworkArtifacts.ts`、`artifactParser.ts`、`artifactSlice.ts`，因此本轮只补低耦合解析稳定性和防退化测试。

### 本轮代码更新

1. 裸文件路径解析稳定性修复
   - `src/renderer/services/artifactParser.ts` 中 `BARE_FILE_PATH_RE` 支持中文标点后连续出现的 previewable 文件路径。
   - 路径结尾分隔符改为 lookahead，只判断不消费，避免 `/tmp/a.html，/tmp/b.svg。/tmp/c.png；` 这类连续路径漏识别。
2. file link 去重防退化测试
   - `src/renderer/services/artifactParser.test.ts` 增加 `stripFileLinksFromText()` 后不重复解析 markdown file link 内部路径的测试。
   - `src/renderer/components/cowork/coworkArtifacts.test.ts` 增加 markdown file link 不被当成裸路径重复生成 artifact 的测试。
3. artifactSlice 去重保护测试
   - `src/renderer/store/slices/artifactSlice.test.ts` 增加“已有 artifact 有 content 时，后到的同路径空内容 artifact 不覆盖”的测试。

### 本轮刻意未改

1. 不搬 `origin/main` 的 `ArtifactPanel`、`FileDirectoryView`、`HtmlRenderer`、`CodeRenderer` UI。
2. 不改变当前青数主控台、对话窗口布局和品牌视觉。
3. 不触碰青数 managed catalog、内置治理链、唤醒/TTS。

### 原则校验

1. KISS
   - 只修正一个路径解析正则和补测试，不引入新面板或新状态结构。
2. YAGNI
   - 暂不迁移文件列表搜索/排序、HTML 刷新按钮等需要当前分支 UI 重新接线的能力。
3. SOLID
   - 路径解析仍归 `artifactParser`，session artifact 收集仍归 `coworkArtifacts`，去重仍归 `artifactSlice`。
4. DRY
   - 继续复用 `normalizeFilePathForDedup()`，避免 tool path、file link、裸路径各自维护不同去重逻辑。

### 本轮验证

1. `npx vitest run src/renderer/services/artifactParser.test.ts src/renderer/components/cowork/coworkArtifacts.test.ts src/renderer/store/slices/artifactSlice.test.ts`
   - 3 个测试文件通过。
   - 25 条测试通过。
2. `npx tsc --project tsconfig.json --noEmit`
   - 通过。
3. `npx tsc --project electron-tsconfig.json --noEmit`
   - 通过。

### 下一轮规划

进入 H3：OpenClaw / Provider / 打包稳定性剩余小补丁复扫与最终验收，预计还剩 1 轮。

1. 复扫 `origin/main` 中 OpenClaw runtime/config/patch/packaging、Provider/model 配置、electron-builder scripts 的剩余公共差异。
2. 只选择一个低耦合小补丁或测试防线落地；如果发现当前分支已覆盖，则记录证据并不重复改。
3. 跑对应模块定向测试、`tsconfig`、`electron-tsconfig`，并更新本文档。
4. H3 完成后，批次 H 进入可验收状态；后续若继续推进，应单独规划高耦合 UI 或 OpenClaw 主干重构批次。

### 剩余轮次估算

批次 H 预计还剩 1 轮：H3 OpenClaw / Provider / 打包稳定性剩余公共小补丁复扫与最终验收。

## 2026-05-13：批次 H 第 3 轮 OpenClaw streaming 合并修复与最终验收

本轮按 H3 计划复扫 OpenClaw / Provider / 打包稳定性剩余公共差异，并选择一个低耦合、直接影响对话完整性的公共 bugfix 落地：修复 OpenClaw 流式文本合并时因 suffix-prefix overlap 误判导致重复边界字符被吞的问题。

### 本轮代码更新

1. 流式文本合并修复
   - `src/main/libs/agentEngine/openclawRuntimeAdapter.ts` 删除 `computeSuffixPrefixOverlap()`。
   - `mergeStreamingText()` 在 snapshot 判定失败后，把 incoming chunk 作为纯 delta 追加。
   - 修复 `.p` + `ptx` 被错误合并成 `.ptx` 的问题，避免文件名、表格、路径等内容在流式展示中丢字符。
2. 防退化测试
   - `src/main/libs/agentEngine/openclawRuntimeAdapter.test.ts` 增加 `mergeStreamingText` 纯函数测试。
   - 覆盖 delta 边界重复字符不被吞、unknown 模式可升级 snapshot、snapshot 模式短输入不回退。
3. 已覆盖项确认
   - `fix(cowork): suppress tool approvals for stopped sessions` 当前分支已覆盖：stop cooldown、非 delete 不 auto-approve、cooldown 后手动停止 session 继续 suppress 均有测试。
   - `fix(test): use path.resolve in cwd assertions for cross-platform compat` 当前分支已覆盖：`openclawRuntimeAdapter.test.ts` 与 `openclawAgentModels.test.ts` 已使用 `path.resolve()`。

### 本轮刻意未改

1. 不改 OpenClaw 主干生命周期与 gateway 版本。
2. 不搬 Provider / modelSlice 大迁移。
3. 不改 electron-builder 打包策略。
4. 不触碰青数品牌、工作台/主控台 UI、managed catalog、内置治理链、唤醒/TTS。

### 原则校验

1. KISS
   - 删除误判 overlap 的复杂逻辑，用 snapshot 判定 + delta 追加两段清晰规则收口。
2. YAGNI
   - 不引入更复杂的流式 diff 算法；当前 bug 的稳定解是避免猜测 overlap。
3. SOLID
   - 修复限定在流式文本合并函数，运行时其他职责不变。
4. DRY
   - 流式文本合并逻辑仍由单一 helper 统一服务 chat delta 和 tool result update。

### 本轮验证

1. `npx vitest run src/main/libs/agentEngine/openclawRuntimeAdapter.test.ts src/main/libs/openclawHistory.test.ts src/main/libs/openclawAgentModels.test.ts src/main/libs/openclawRuntimePackaging.test.ts src/main/libs/pruneOpenClawRuntime.test.ts`
   - 5 个测试文件通过。
   - 120 条测试通过。
2. `npx tsc --project tsconfig.json --noEmit`
   - 通过。
3. `npx tsc --project electron-tsconfig.json --noEmit`
   - 通过。
4. `rg -n "computeSuffixPrefixOverlap|mergeStreamingText appends delta|__openclawRuntimeAdapterTestUtils" src/main/libs/agentEngine/openclawRuntimeAdapter.ts src/main/libs/agentEngine/openclawRuntimeAdapter.test.ts`
   - 确认 `computeSuffixPrefixOverlap` 已无残留。
   - 确认新增测试入口和测试用例存在。

### 批次 H 收口结论

批次 H 已完成，剩余 0 轮。已选择性完成：

1. H1：复扫 `origin/main` 最新公共差异，确认 Cowork metadata 和 IM 时间戳修复已覆盖。
2. H2：Artifacts 文件预览低耦合 bugfix，补中文标点连续路径解析与去重防线。
3. H3：OpenClaw streaming 合并 bugfix，修复重复边界字符误吞。

### 后续规划

批次 H 已可验收。若继续推进 main 公共能力拉齐，建议新开批次 I，预计 2 到 4 轮：

1. I1：Provider / OpenAI-compatible proxy / Copilot token refresher 剩余差异评估，明确哪些会碰认证路径。
2. I2：OpenClaw config / runtime 主干剩余差异分层，区分可直接合入的 config guard 与高耦合 lifecycle 重构。
3. I3：Artifacts / Agent avatar / sidebar / 主 UI 高耦合能力单独评估，必要时只迁逻辑不迁视觉。
4. I4：全量验收、打包前检查和 changelog 总结。

### 剩余轮次估算

当前批次 H 剩余 0 轮。下一批次 I 尚未开始，建议估算 2 到 4 轮，并继续保护青数品牌、工作台、治理链和唤醒/TTS。

## 2026-05-13：批次 I 第 1 轮 Provider / Copilot proxy 差异评估与小步合入

本轮进入批次 I，目标是继续从 `origin/main` 中筛选公共能力，但先保护青数品牌、工作台、managed catalog / 内置治理链、唤醒/TTS。调查重点放在 Provider request helper、OpenAI-compatible proxy、GitHub Copilot token refresher、OpenAI Codex auth 这些与认证和模型配置相关的差异。

### 调查结论

1. 当前分支已经具备 `src/renderer/services/providerRequestConfig.ts`，并且 `src/renderer/services/api.ts`、`src/renderer/components/Settings.tsx` 已接入：
   - Provider 固定/可切换 API format 判断。
   - OpenAI-compatible `/chat/completions` URL 拼接。
   - OpenAI Responses URL 拼接。
   - OpenAI 新模型 `max_completion_tokens` 判断。
2. 当前分支已经具备 `src/main/libs/openaiCodexAuth.ts` 的低风险读取能力：
   - 只读取 app userData 下的 `codex/auth.json`。
   - 供 OpenClaw config sync 判断 `openai-codex` account header。
   - 未引入完整 OAuth 登录主流程，因此不会改动青数登录治理链。
3. 当前分支与 `origin/main` 的关键缺口是 Copilot 通过 OpenClaw gateway 时的 proxy 路由：
   - `openclawConfigSync.ts` 对 Copilot 会把 baseUrl 指向 `${proxy}/v1/copilot`。
   - 但本轮前 `coworkOpenAICompatProxy.ts` 只接受 `/v1/messages`，没有 `/v1/copilot/chat/completions`。
   - 这会导致 Copilot provider 在 OpenClaw 路径下无法通过 proxy 透传。
4. `origin/main` 的 per-provider token refresher 是合理公共能力：
   - 全局 refresher 适合青数服务端 token。
   - Copilot 需要独立刷新 GitHub Copilot 短 token。
   - 两者混用会有 provider 认证刷新互相覆盖的风险。

### 本轮代码更新

1. Copilot 专用 passthrough route
   - `src/main/libs/coworkOpenAICompatProxy.ts` 新增 `/v1/copilot/chat/completions` 与 `/copilot/chat/completions` 处理。
   - 从 `copilotTokenManager` 获取当前 Copilot token；没有 token 时尝试刷新。
   - 请求转发到 GitHub Copilot API，并注入必要 IDE headers。
   - 401/403 时刷新 Copilot 短 token 后重试一次。
2. per-provider token refresher
   - `src/main/libs/coworkOpenAICompatProxy.ts` 新增 `registerProxyTokenRefresher(provider, refresher)`。
   - 通用 `/v1/messages` 上游 401/403 时优先使用当前 provider 的 refresher，找不到时回退原 `setProxyTokenRefresher()`。
   - 保留既有 `setProxyTokenRefresher()`，保证青数服务端 token 刷新路径不变。
3. main 进程注册
   - `src/main/main.ts` 为 `lobsterai-server` 注册 `refreshOnce('proxy')`。
   - 为 `github-copilot` 和 `lobsterai-copilot` 注册 `refreshCopilotTokenNow()`。

### 本轮刻意未改

1. 不迁移 `origin/main` 的完整 OpenAI Codex OAuth 登录 UI / 主流程，避免影响青数登录治理链。
2. 不迁移 modelSlice per-agent 结构，避免牵动主控台/工作台状态模型。
3. 不整包替换 `coworkOpenAICompatProxy.ts`，只补当前 OpenClaw Copilot 缺口。
4. 不改青数品牌、工作台 UI、managed catalog、内置治理链、唤醒/TTS。

### 原则校验

1. KISS
   - 只补一个缺失 route 和一个 provider refresher map，不重构 proxy 主流程。
2. YAGNI
   - 暂不接完整 OAuth 登录与 per-agent modelSlice 大迁移，等认证/状态边界单独批次处理。
3. SOLID
   - Copilot token 生命周期仍归 `copilotTokenManager`，proxy 只负责转发与重试。
4. DRY
   - 通用 401/403 重试继续复用同一刷新选择逻辑，避免 Copilot 与青数 token refresh 各写一套散落判断。

### 本轮验证

1. `npx vitest run src/renderer/services/providerRequestConfig.test.ts src/shared/providers/constants.test.ts src/main/libs/coworkOpenAICompatProxy.test.ts src/main/libs/openaiCodexAuth.test.ts`
   - 4 个测试文件通过。
   - 62 条测试通过。
2. `npx tsc --project tsconfig.json --noEmit`
   - 通过。
3. `npx tsc --project electron-tsconfig.json --noEmit`
   - 通过。

### 下一轮规划

进入 I2：OpenClaw config / runtime 剩余公共差异分层，预计还剩 3 轮。

1. 扫描 `origin/main` 中 OpenClaw config sync、runtime packaging、engine manager、token proxy 的剩余差异。
2. 优先合入低耦合 config guard / runtime patch / 打包稳定性修复。
3. 避免一次性搬 OpenClaw lifecycle 主干重构，除非能证明不影响青数工作台、治理链和唤醒/TTS。
4. 每合入一小步后继续跑对应 Vitest 与两套 TypeScript 检查。

### 剩余轮次估算

批次 I 预计还剩 3 轮：I2 OpenClaw config/runtime 小批次、I3 UI/Artifacts/Agent 高耦合能力评估取舍、I4 全量验收与打包前检查。

## 2026-05-13：批次 I 第 2 轮 OpenClaw config/runtime 重启防抖 guard

本轮按 I2 规划扫描 `origin/main` 中 OpenClaw config sync、runtime packaging、engine manager、token proxy 的剩余公共差异。目标仍是只合入低耦合公共能力，避免影响青数品牌、工作台、managed catalog / 内置治理链、唤醒/TTS。

### 调查结论

1. 当前分支已经覆盖多项 `origin/main` OpenClaw 公共修复：
   - gateway 日志按天轮转并保留 3 天：`gatewayLogRotation.ts`、`openclawEngineManager.ts` 已接入。
   - main agent workspace 与用户 workingDirectory 解耦：`workspace-main`、`openclawWorkspaceMigration`、`openclawMemoryFile` 已存在。
   - 每 Agent 工作目录入口：`resolveAgentDefaultWorkingDirectory(...)`、agent workingDirectory 字段和相关调用链已存在。
   - server model metadata 更新不强制重启 gateway：`server-models-updated` 调用已使用 `restartGatewayIfRunning: false`。
   - OpenAI Codex OAuth provider 不写 `agents.defaults.models` allowlist：runtime 测试已覆盖。
   - OpenClaw runtime packaging / prune / patch 防退化测试已存在。
2. 本轮发现仍值得小步补齐的低耦合缺口：
   - 当前 `managedConfig.gateway` 每次 full sync 只写 `{ mode: 'local' }` 和 channel HTTP endpoint。
   - `origin/main` 已保留 gateway 运行时自动注入字段，例如 `gateway.auth`、`tailscale`。
   - 如果这些 runtime 字段被配置写回删掉，gateway 可能把“文件配置”与“运行时状态”判定为不同，从而更容易触发不必要重启。

### 本轮代码更新

1. 保留 gateway runtime 注入字段
   - `src/main/libs/openclawConfigSync.ts` 新增 `getExistingGatewayConfig(configPath)`。
   - full sync 写 `managedConfig.gateway` 时先合入已有 gateway 字段，再由 QingShuClaw managed 字段覆盖：
     - `mode` 继续固定为 `local`。
     - channel 需要的 HTTP endpoint 继续由当前配置决定。
     - `auth`、`tailscale` 等 runtime 注入字段不再被无意义删除。
2. 防退化测试
   - `src/main/libs/openclawConfigSync.runtime.test.ts` 新增测试：
     - 已有 `gateway.auth`、`gateway.tailscale` 会保留。
     - 旧 `gateway.mode: remote` 不会覆盖 managed 的 `mode: local`。

### 本轮刻意未改

1. 不整包替换 `openclawConfigSync.ts`，避免覆盖青数 IM 多实例、managed agent、治理链和工作台相关接线。
2. 不迁移 OpenClaw lifecycle 主干重构。
3. 不改变 OpenClaw runtime 版本、打包策略或本地插件安装策略。
4. 不改青数品牌、主控台 UI、内置治理链、唤醒/TTS。

### 原则校验

1. KISS
   - 只加一个读取 helper 和一条合并顺序，不改变 sync 主流程。
2. YAGNI
   - 不引入复杂配置 diff/merge 框架，只保留 gateway 顶层运行时字段。
3. SOLID
   - gateway 运行时字段保留仍属于 OpenClaw config projection 职责，未扩散到 main 或 renderer。
4. DRY
   - 读取 existing config 的逻辑与 plugin entries 分离，各自只处理自己的 section。

### 本轮验证

1. `npx vitest run src/main/libs/openclawConfigSync.runtime.test.ts src/main/libs/openclawConfigSync.test.ts src/main/libs/openclawEngineManager.test.ts src/main/libs/gatewayLogRotation.test.ts src/main/libs/openclawRuntimePackaging.test.ts src/main/libs/pruneOpenClawRuntime.test.ts src/main/libs/applyOpenClawPatches.test.ts`
   - 7 个测试文件通过。
   - 75 条测试通过。
2. `npx tsc --project tsconfig.json --noEmit`
   - 通过。
3. `npx tsc --project electron-tsconfig.json --noEmit`
   - 通过。

### 下一轮规划

进入 I3：Artifacts / Agent avatar / sidebar / 主 UI 高耦合能力评估取舍，预计还剩 2 轮。

1. 先扫描 `origin/main` 中 UI/Artifacts/Agent avatar/sidebar 相关剩余差异。
2. 只选择不影响青数主控台视觉与工作台结构的逻辑型能力：
   - artifact parser / preview 数据层 guard。
   - agent avatar/icon 解析 helper。
   - sidebar 数据状态或空态 bugfix。
3. 暂不整包迁移主控台 UI、sidebar layout、Agent 列表视觉和大块样式。
4. 落地后跑对应 renderer 测试、两套 TypeScript 检查，并继续更新本文档。

### 剩余轮次估算

批次 I 预计还剩 2 轮：I3 UI/Artifacts/Agent 高耦合能力评估取舍，I4 全量验收与打包前检查。

## 2026-05-13：批次 I 第 3 轮 UI / Artifacts / Agent 逻辑型差异收口

本轮按 I3 规划扫描 `origin/main` 中 Artifacts、Agent avatar、sidebar、CoworkSessionDetail、AgentsView 等 UI 相关剩余差异。由于这些文件高度牵动青数主控台视觉、工作台结构、内置治理链展示和 Agent/Skill 管理体验，本轮不做整包 UI 迁移，只选不影响视觉结构的数据层/状态层小补丁。

### 调查结论

1. Artifacts 相关能力当前分支已优于 `origin/main`：
   - `artifactParser.ts` 已支持 HTML/SVG/image/Office/PDF、中文标点连续路径、file link 去重。
   - `coworkArtifacts.ts` 已从 assistant 文本、markdown file link、tool_result display、Write tool 输入中收集 artifact。
   - `artifactSlice` 已有去重与防空内容覆盖测试。
   - 直接回搬 `origin/main` 版本会减少 HTML/SVG/image 等预览能力，属于退化。
2. Agent / 主 UI 差异大多属于高耦合 UI：
   - `AgentCreateModal.tsx`、`AgentSettingsPanel.tsx`、`AgentsView.tsx`、`CoworkSessionDetail.tsx` 差异非常大。
   - `origin/main` 的 avatar / sidebar / layout 优化会改动当前青数主控台视觉。
   - 当前分支还有青数 managed catalog、ToolBundle governance、IM 多实例绑定等 main 不具备或结构不同的逻辑，不能整文件替换。
3. 本轮找到一个安全的小补丁：
   - `agentDraftState.ts` 的 IM binding dirty 判断按集合比较，但没有 trim 单个 binding key。
   - 历史配置或 UI 输入出现 `' feishu:bot-a '` 这类空白时，可能把同一实例误判成变化，影响保存按钮状态。
   - 该逻辑是纯 helper，不影响 UI 结构和品牌样式。

### 本轮代码更新

1. Agent IM binding dirty 判断归一化
   - `src/renderer/components/agent/agentDraftState.ts` 将 `normalizeBindingSet(...)` 收敛为 string binding key 语义。
   - 每个 binding key 会先 `trim()`，空字符串会被过滤。
   - `feishu:bot-a` 与 ` feishu:bot-a ` 不再被误判为不同绑定。
2. 防退化测试
   - `src/renderer/components/agent/agentDraftState.test.ts` 新增“按持久化语义忽略绑定项空白”的测试。

### 本轮刻意未改

1. 不整包迁移 `AgentCreateModal.tsx`、`AgentSettingsPanel.tsx`、`AgentsView.tsx`。
2. 不迁移 `origin/main` 的 Agent avatar/sidebar 大块视觉优化。
3. 不替换 `CoworkSessionDetail.tsx`，避免影响青数对话窗口历史展示和主控台布局。
4. 不回退当前分支已增强的 artifact parser / preview 能力。
5. 不改青数品牌、工作台、managed catalog、内置治理链、唤醒/TTS。

### 原则校验

1. KISS
   - 只在 dirty 判断 helper 中做 trim，不改组件结构。
2. YAGNI
   - 不为 binding key 新增复杂 schema migration；保存前归一化足够覆盖当前问题。
3. SOLID
   - IM binding 变化判断仍集中在 `agentDraftState.ts`，UI 只消费结果。
4. DRY
   - `hasCreateAgentDraftChanges(...)` 继续复用同一个 binding set 归一逻辑。

### 本轮验证

1. `npx vitest run src/renderer/components/agent/agentDraftState.test.ts src/renderer/components/agent/agentImBindingConfig.test.ts src/renderer/components/agent/agentPersistedDraft.test.ts src/renderer/components/agent/agentBundleSaveGuard.test.ts src/renderer/components/agent/agentBundleSaveFlow.test.ts src/renderer/services/artifactParser.test.ts src/renderer/components/cowork/coworkArtifacts.test.ts src/renderer/store/slices/artifactSlice.test.ts`
   - 8 个测试文件通过。
   - 66 条测试通过。
2. `npx tsc --project tsconfig.json --noEmit`
   - 通过。
3. `npx tsc --project electron-tsconfig.json --noEmit`
   - 通过。

### 下一轮规划

进入 I4：全量验收与打包前检查，预计还剩 1 轮。

1. 汇总批次 I 已合入内容，确认没有误碰保护区。
2. 运行更广的回归测试矩阵：
   - OpenClaw config/runtime/proxy。
   - Provider request config。
   - Agent draft / IM binding / artifact。
   - Cowork streaming / session state。
3. 运行两套 TypeScript 检查和必要的 `git diff --check`。
4. 若验收通过，更新 changelog 的批次 I 收口结论；是否打包再按用户下一步指令执行。

### 剩余轮次估算

批次 I 预计还剩 1 轮：I4 全量验收与打包前检查。

## 2026-05-13：批次 I 第 4 轮全量验收与打包前检查

本轮按 I4 规划做批次 I 的收口验证，不继续扩大合入范围。目标是确认 I1-I3 已合入的公共能力没有破坏青数品牌、工作台、内置治理链、IM 多实例绑定、唤醒/TTS 和主控台对话体验。

### 本轮验收范围

1. Provider / Copilot proxy
   - 覆盖 Copilot 兼容路由、per-provider token refresher、Provider request config、OpenAI Codex auth。
2. OpenClaw config/runtime
   - 覆盖 gateway runtime 字段保留、config sync、engine manager、日志轮转、runtime packaging、prune、patch apply。
3. Agent / IM binding / Artifacts / Cowork
   - 覆盖 Agent draft dirty 判断、IM binding 保存 guard、artifact parser/collector/slice、cowork service 和 cowork slice。
4. 静态健康检查
   - 覆盖 renderer TypeScript、Electron main TypeScript、diff 空白与冲突标记检查。

### 本轮验证结果

1. `npx vitest run src/renderer/services/providerRequestConfig.test.ts src/shared/providers/constants.test.ts src/main/libs/coworkOpenAICompatProxy.test.ts src/main/libs/openaiCodexAuth.test.ts src/main/libs/openclawConfigSync.runtime.test.ts src/main/libs/openclawConfigSync.test.ts src/main/libs/openclawEngineManager.test.ts src/main/libs/gatewayLogRotation.test.ts src/main/libs/openclawRuntimePackaging.test.ts src/main/libs/pruneOpenClawRuntime.test.ts src/main/libs/applyOpenClawPatches.test.ts src/renderer/components/agent/agentDraftState.test.ts src/renderer/components/agent/agentImBindingConfig.test.ts src/renderer/components/agent/agentPersistedDraft.test.ts src/renderer/components/agent/agentBundleSaveGuard.test.ts src/renderer/components/agent/agentBundleSaveFlow.test.ts src/renderer/services/artifactParser.test.ts src/renderer/components/cowork/coworkArtifacts.test.ts src/renderer/store/slices/artifactSlice.test.ts src/renderer/services/cowork.test.ts src/renderer/store/slices/coworkSlice.test.ts`
   - 21 个测试文件通过。
   - 213 条测试通过。
2. `npx tsc --project tsconfig.json --noEmit`
   - 通过。
3. `npx tsc --project electron-tsconfig.json --noEmit`
   - 通过。
4. `git diff --check`
   - 通过，未发现冲突标记或空白错误。

### 批次 I 收口结论

1. 已完成合入：
   - Copilot proxy 低耦合补齐。
   - Provider 级 token refresher。
   - OpenClaw gateway runtime 注入字段保留。
   - Agent IM binding dirty 判断归一化。
   - Artifacts / Cowork 相关既有增强能力通过回归验证。
2. 保护区状态：
   - 未整包替换青数主控台 UI。
   - 未覆盖青数品牌、工作台、managed catalog、内置治理链、ToolBundle governance。
   - 未改唤醒浮层、wake input、TTS cache、macOS speech helper。
3. 本轮未打包：
   - 本次用户指令是按规划完成本轮合入与验证，未要求生成 `.app` 包。

### 继续延后到后续批次的高耦合内容

1. 完整 OpenAI Codex OAuth UI / main 认证流。
2. per-agent `modelSlice` 状态结构大迁移。
3. POPO / IM UI 大迁移。
4. OpenClaw lifecycle / runtime 主干重构。
5. `origin/main` 的 avatar / sidebar / 主控台 UI 大块视觉改造。

### 原则校验

1. KISS
   - I4 只做验证和文档收口，不把新功能继续塞进验收轮。
2. YAGNI
   - 对高耦合 UI、认证、modelSlice、OpenClaw 主干重构继续延后，避免为了“看起来全量合入”而制造回归。
3. SOLID
   - Provider refresh、OpenClaw config projection、Agent draft 判断仍各归其位，没有把跨域逻辑堆到单一模块。
4. DRY
   - 复用现有测试矩阵和 helper 层，不新增重复的临时校验逻辑。

### 下一轮规划

批次 I 已完成。若继续推进，建议进入批次 J：高耦合公共能力拆分评估，预计还剩 3 轮。

1. J1：完整扫描剩余 `origin/main` 公共差异，按“认证 / modelSlice / IM UI / OpenClaw lifecycle / 主控台 UI”分组，输出可合入与暂缓边界。
2. J2：选择一个风险最低的高耦合小切片落地，例如 OpenAI Codex OAuth UI 的只读入口或 modelSlice 兼容胶水，不做整包替换。
3. J3：跑对应专项测试、两套 TypeScript、必要的手工启动检查，并更新 changelog。

### 剩余轮次估算

批次 I 剩余 0 轮。下一批次 J 如继续执行，预计 3 轮。

## 2026-05-13：批次 J 预研 青数覆盖层索引与直接合入边界

本轮响应“IM UI 是否不涉及青数覆盖层、是否可以先把覆盖层做索引、不涉及的模块直接合入”的问题，先做边界调查与文档化，不直接扩大代码合入。

### 调查结论

1. 当前仓库已经存在覆盖层文档：
   - `青数覆盖层-总索引.md`
   - `青数覆盖层-品牌元数据梳理.md`
   - `青数覆盖层-UI与样式梳理.md`
   - `青数覆盖层-登录认证梳理.md`
   - `青数覆盖层-内置治理链梳理.md`
   - `青数覆盖层-唤醒与TTS梳理.md`
2. IM UI 本体不属于青数覆盖层：
   - `src/renderer/components/im/*`
   - `src/renderer/services/im.ts`
   - `src/renderer/store/slices/imSlice.ts`
   - `src/renderer/types/im.ts`
   - `src/main/im/*`
   - `src/shared/im/*`
3. 但 IM 与青数覆盖层存在两个交叉点：
   - `AgentCreateModal.tsx` 与 `AgentSettingsPanel.tsx` 中的 IM 实例绑定入口，同时承载青数内置治理链、managed Agent 只读/锁定、ToolBundle 兼容提示。
   - IM 通道会影响 channel session、scheduled task、OpenClaw channel session 等投递链路，合入后必须验证“实例 -> Agent 绑定 -> 会话/任务投递”。

### 本轮文档更新

1. `青数覆盖层-总索引.md` 新增“后续合并保护索引”：
   - 可优先直接合入的公共模块白名单。
   - 可合入但需要保留青数胶水的灰区模块。
   - 不可整包替换的青数覆盖层红线。
   - 当前建议执行顺序。
   - IM UI 是否涉及青数覆盖层的明确结论。

### 决策

1. IM 设置页、IM store、IM gateway、shared IM contract 可以作为下一轮优先合入对象。
2. Agent 创建/编辑页中的 IM 绑定 UI 不做整包替换，只抽取 `origin/main` 的多实例绑定逻辑和公共校验。
3. 认证流、per-agent modelSlice、OpenClaw lifecycle/runtime 继续按灰区处理，小步合入，不覆盖青数认证主干、治理链和唤醒/TTS。

### 原则校验

1. KISS
   - 用一个索引文档把白名单、灰区、红线讲清楚，避免每次人工重新判断。
2. YAGNI
   - 本轮不直接迁高耦合模块，只先建立可执行边界。
3. SOLID
   - IM 公共能力与青数治理覆盖层分开处理，避免职责混合。
4. DRY
   - 后续合并复用同一份保护索引，减少重复扫描成本。

### 下一轮规划

进入 J1：IM 白名单模块对齐，预计还剩 4 轮。

1. J1：对齐 IM 白名单模块。
   - 优先范围：`src/main/im/*`、`src/shared/im/*`、`src/renderer/components/im/*`、`src/renderer/services/im.ts`、`src/renderer/store/slices/imSlice.ts`、`src/renderer/types/im.ts`。
   - 不整包替换 `AgentCreateModal.tsx` / `AgentSettingsPanel.tsx`。
   - 验证：IM store / gateway / scheduled task / renderer IM 相关测试，外加 Agent IM binding 保存测试。
2. J2：OpenClaw lifecycle/runtime 小切片。
   - 只合入启动、重启、防抖、runtime patch、配置投影稳定性。
   - 保留任务运行中延后重启和唤醒/TTS 独立链路。
3. J3：per-agent `modelSlice` 兼容层。
   - 先做兼容胶水，不直接大迁移主控台状态模型。
4. J4：认证流公共 bugfix。
   - 只吸收公共 auth 修复，不覆盖 QTB / Portal / 飞书扫码 / bridge 主干。

### 剩余轮次估算

批次 J 预计还剩 4 轮。

## 2026-05-13：批次 J 第 1 轮 IM 白名单模块对齐

本轮按 J1 规划处理 IM 白名单模块。执行前先扫描 `origin/main` 与当前分支在 IM 目录、renderer IM 设置页、IM store/slice/types 的差异，确认当前分支不是简单落后于 `main`，而是已经有更激进的多实例与 schema-driven 重组。

### 调查结论

1. 当前分支已经具备多实例 IM 主链路：
   - `src/main/im/imSingleToMultiInstanceMigration.ts`
   - `src/main/im/imGatewayConfigState.ts`
   - `src/main/im/imScheduledTaskAgent.ts`
   - `src/main/im/imStore.test.ts`
   - `src/main/im/imGatewayManager.nim.test.ts`
   - `src/renderer/components/im/IMSettingsMain.tsx`
   - `src/renderer/store/slices/imSlice.test.ts`
2. 当前 `IMSettings.tsx` 已是 `IMSettingsMain.tsx` 的转发入口。
3. `origin/main` 仍包含部分巨型旧 IM 设置页与 Telegram/Discord/NIM/POPO 组件结构，整包回灌会把当前分支已完成的多实例 UI / schema-driven 结构反向覆盖掉。
4. IM UI 本体仍不属于青数覆盖层，但 Agent 创建/编辑页中的 IM 绑定入口属于灰区，本轮未整包修改 `AgentCreateModal.tsx` / `AgentSettingsPanel.tsx`。
5. 本轮发现一个适合小步补齐的公共 contract 缺口：
   - `origin/main` 已定义 `FeishuOpenClawBlockStreamingCoalesceConfig` 和 `FeishuOpenClawConfig.blockStreamingCoalesce`。
   - 当前分支的 `enterpriseConfigSync.ts` 已在读取和投影该字段，但 main/renderer IM 类型没有显式声明。

### 本轮代码更新

1. 补齐飞书 block streaming coalesce 类型契约：
   - `src/main/im/types.ts`
   - `src/renderer/types/im.ts`
2. 新增字段：
   - `FeishuOpenClawBlockStreamingCoalesceConfig`
   - `FeishuOpenClawConfig.blockStreamingCoalesce?: FeishuOpenClawBlockStreamingCoalesceConfig`
3. 保持默认配置不变：
   - 不主动写默认 `blockStreamingCoalesce`，继续保持可选字段，避免改变现有配置输出。

### 本轮刻意未改

1. 不整包替换 `src/renderer/components/im/IMSettingsMain.tsx`。
2. 不回灌 `origin/main` 的巨型 `IMSettings.tsx`。
3. 不恢复当前分支已删除或已替代的旧 Telegram/Discord/NIM/POPO 单页组件。
4. 不修改 `AgentCreateModal.tsx` / `AgentSettingsPanel.tsx`，避免影响青数内置治理链与 managed Agent 只读/锁定语义。
5. 不碰青数品牌、工作台、登录认证主干、唤醒/TTS。

### 原则校验

1. KISS
   - 只补一处类型契约缺口，不重排 IM UI。
2. YAGNI
   - 不为了“看起来全量对齐”而回灌旧巨型设置页。
3. SOLID
   - 飞书配置字段归 IM contract 层，enterprise config 与 OpenClaw 投影继续消费同一类型语义。
4. DRY
   - main/renderer 两侧 IM 类型同步补齐，避免一边隐式字段、一边显式使用。

### 本轮验证

1. `npx vitest run src/main/im/imStore.test.ts src/main/im/imSingleToMultiInstanceMigration.test.ts src/main/im/imGatewayConfigState.test.ts src/main/im/imGatewayManager.nim.test.ts src/main/im/imScheduledTaskAgent.test.ts src/main/im/imScheduledTaskHandler.test.ts src/main/im/imCoworkHandler.test.ts src/renderer/store/slices/imSlice.test.ts src/renderer/services/im.test.ts src/renderer/components/agent/agentImBindingConfig.test.ts src/renderer/components/agent/agentDraftState.test.ts src/main/libs/enterpriseConfigSync.test.ts`
   - 11 个测试文件通过。
   - 103 条测试通过。
2. `npx tsc --project tsconfig.json --noEmit`
   - 通过。
3. `npx tsc --project electron-tsconfig.json --noEmit`
   - 通过。
4. `git diff --check`
   - 通过。

### 下一轮规划

进入 J2：OpenClaw lifecycle/runtime 小切片，预计还剩 3 轮。

1. 扫描 `origin/main` 中 `openclawEngineManager.ts`、`openclawConfigSync.ts`、`agentEngine/*`、runtime packaging / patch / prune 脚本的剩余差异。
2. 优先合入低耦合的启动稳定性、重启防抖、runtime patch、日志与配置投影修复。
3. 保留当前分支已有的任务运行中延后重启策略、wake/TTS 独立链路、青数 managed agent / IM 多实例投影。
4. 验证范围：
   - OpenClaw engine/config/runtime packaging 测试。
   - agentEngine / transcript / channel sync 测试。
   - 两套 TypeScript 与 `git diff --check`。

### 剩余轮次估算

批次 J 预计还剩 3 轮：J2 OpenClaw lifecycle/runtime、J3 per-agent `modelSlice` 兼容层、J4 认证流公共 bugfix。

## 2026-05-13：批次 J 第 2 轮 OpenClaw runtime contextPercent 元数据补齐

本轮按 J2 规划处理 OpenClaw lifecycle/runtime 小切片。执行前先扫描 `origin/main` 与当前分支在 `openclawRuntimeAdapter.ts`、`openclawConfigSync.ts`、`openclawEngineManager.ts`、runtime packaging 脚本上的差异，确认当前分支已经覆盖大量 OpenClaw 运行稳定性修复，不能整包替换。

### 调查结论

1. 当前分支已经覆盖或强化了多项 OpenClaw 公共修复：
   - stopped session late approval suppression。
   - transient gateway status / `NO_REPLY` 抑制。
   - assistant usage / model / timestamp 元数据保存。
   - channel history window 防缩短。
   - gateway client export probing。
   - system proxy、macOS speech/TTS helper、runtime packaging 测试。
2. `origin/main` 的 OpenClaw runtime 主干和当前分支存在大量交叉改造，整包替换会高风险破坏：
   - 青数 managed / IM session 投影。
   - channel/session history safeguard。
   - 任务运行中延后重启链路。
   - wake/TTS 独立链路。
3. 本轮识别出的低耦合缺口是：
   - `origin/main` 会从 OpenClaw `sessions.list.contextTokens` 推导 assistant metadata 的 `contextPercent`。
   - 当前分支 renderer 已能展示 `contextPercent`，但 main runtime 还没有补这个值。

### 本轮代码更新

1. OpenClaw context token 缓存
   - 文件：`src/main/libs/agentEngine/openclawRuntimeAdapter.ts`
   - 新增 `sessionContextTokensCache`，按 `sessionKey` 缓存 `sessions.list` 返回的 `contextTokens`。
   - `pollChannelSessions()` 扫描 session row 时同步记录 context token。
2. assistant metadata contextPercent 增强
   - 文件：`src/main/libs/agentEngine/openclawRuntimeAdapter.ts`
   - 新增 `computeContextPercent(...)` 纯 helper。
   - `reconcileWithHistory(...)` 在写入 gateway authoritative assistant message 前补齐 `contextPercent`。
   - `syncFinalAssistantWithHistory(...)` 在最终 history 同步时补齐 `contextPercent`。
   - `handleChatFinal(...)` 只使用已缓存 context，避免为一次异步刷新破坏 final message 立即落库时序。
3. 防退化测试
   - 文件：`src/main/libs/agentEngine/openclawRuntimeAdapter.test.ts`
   - 新增 `computeContextPercent` 边界测试。
   - 新增 `reconcileWithHistory` 结合 `sessions.list.contextTokens` 推导 `contextPercent` 的测试。

### 本轮刻意未改

1. 不整包替换 `openclawRuntimeAdapter.ts`。
2. 不迁移 `origin/main` 的 OpenClaw 主干大重构。
3. 不改变 `openclawConfigSync.ts` 的青数 managed / IM / MCP 投影。
4. 不改变任务运行中延后重启策略。
5. 不触碰青数品牌、工作台、治理链、唤醒/TTS。

### 原则校验

1. KISS
   - 只补 contextPercent 元数据增强，不改 IPC 协议和 renderer 展示结构。
2. YAGNI
   - 不引入模型 contextWindow 文件解析 fallback，先使用 OpenClaw `sessions.list` 这个权威运行时来源。
3. SOLID
   - context token 获取和 assistant metadata 增强留在 OpenClaw runtime adapter 内部，UI 只消费 metadata。
4. DRY
   - history reconcile、final history sync 复用同一套 contextPercent helper，避免多处重复计算。

### 本轮验证

1. `npx vitest run src/main/libs/agentEngine/openclawRuntimeAdapter.test.ts src/main/libs/openclawHistory.test.ts src/main/libs/openclawConfigSync.runtime.test.ts src/main/libs/openclawConfigSync.test.ts src/main/libs/openclawEngineManager.test.ts src/main/libs/gatewayLogRotation.test.ts src/main/libs/openclawRuntimePackaging.test.ts src/main/libs/pruneOpenClawRuntime.test.ts src/main/libs/applyOpenClawPatches.test.ts`
   - 9 个测试文件通过。
   - 166 条测试通过。
2. `npx tsc --project tsconfig.json --noEmit`
   - 通过。
3. `npx tsc --project electron-tsconfig.json --noEmit`
   - 通过。
4. `git diff --check`
   - 通过。

### 下一轮规划

进入 J3：per-agent `modelSlice` 兼容层，预计还剩 2 轮。

1. 扫描 `origin/main` 中 per-agent model/provider 配置结构，确认哪些是公共配置能力，哪些会触碰主控台状态模型。
2. 优先做兼容胶水：
   - 保持当前全局模型配置可用。
   - 允许读取或透传 main 的 per-agent model override 字段。
   - 不整包替换主控台、工作台或青数 managed agent 配置 UI。
3. 验证范围：
   - `modelSlice`、provider request config、cowork start/continue config、Agent draft/state 相关测试。
   - 两套 TypeScript 与 `git diff --check`。
4. 暂不处理：
   - 主控台模型 UI 大迁移。
   - OpenAI Codex per-provider token refresher。
   - 认证流主干改造。

### 剩余轮次估算

批次 J 预计还剩 2 轮：J3 per-agent `modelSlice` 兼容层、J4 认证流公共 bugfix。

## 2026-05-13：批次 J 第 3 轮 per-agent modelSlice 兼容层

本轮按 J3 规划处理 per-agent `modelSlice` 兼容层。执行前先扫描 `origin/main` 与当前分支在 `modelSlice.ts`、Provider 配置、Cowork 启动参数、Agent 创建/编辑 UI 上的差异，确认 `origin/main` 已将模型选择迁到 per-agent 结构，而当前分支仍保留全局 `selectedModel` 结构，并且主控台 / 工作台 / 青数 managed Agent UI 与当前业务展示耦合较深。

### 调查结论

1. `origin/main` 的 `modelSlice` 主结构已经改为：
   - `defaultSelectedModel`
   - `selectedModelByAgent`
   - `selectAgentSelectedModel(...)`
2. 当前分支仍使用：
   - `selectedModel`
   - `selectedModelDirty`
   - 全局 `ModelSelector` 行为。
3. 当前分支已经具备一部分 per-agent 模型兼容底座：
   - `src/renderer/utils/openclawModelRef.ts`
   - `src/renderer/components/cowork/agentModelSelection.ts`
   - `CoworkPromptInput.tsx` 已能根据 session override / agent model / global model 解析有效模型。
4. 直接替换 `modelSlice.ts` 会牵动：
   - `ModelSelector.tsx`
   - `CoworkView.tsx`
   - `CoworkPromptInput.tsx`
   - Settings 模型配置 UI
   - 青数工作台中 Agent / managed Agent 的状态投影。
5. 本轮最稳策略是只补兼容层，不迁移 Redux shape，不改变现有 UI 行为。

### 本轮代码更新

1. `modelSlice` 增加 per-agent override 兼容字段：
   - 文件：`src/renderer/store/slices/modelSlice.ts`
   - 新增 `selectedModelByAgent: Record<string, Model>`。
   - 保留原有 `selectedModel`、`selectedModelDirty` 和 `setSelectedModel(...)` 行为。
2. 新增 per-agent 选择器：
   - 文件：`src/renderer/store/slices/modelSlice.ts`
   - `selectAgentSelectedModel(modelState, agentId, agentModelRef)`。
   - 解析顺序：per-agent override -> agent.model ref -> 全局 selectedModel。
3. 新增 per-agent override actions：
   - `setAgentSelectedModel({ agentId, model })`
   - `clearAgentSelectedModel(agentId)`
4. 模型列表变化时清理 stale override：
   - `setAvailableModels(...)`
   - `setServerModels(...)`
   - `clearServerModels(...)`
   - 当 override 模型不再存在于最新可用模型列表时自动删除，避免悬挂引用。
5. 防退化测试：
   - 新增文件：`src/renderer/store/slices/modelSlice.test.ts`
   - 覆盖 override 优先、agent.model 解析、全局 fallback、模型列表变化清理 stale override、手动清理 override。

### 本轮刻意未改

1. 不把当前分支 `selectedModel` 整体替换为 `defaultSelectedModel`。
2. 不整包替换 `ModelSelector.tsx`。
3. 不改主控台、工作台或青数 managed Agent UI。
4. 不改 Agent 创建/编辑弹窗的业务展示和治理链逻辑。
5. 不接入 OpenAI Codex per-provider token refresher。

### 原则校验

1. KISS
   - 用兼容字段和选择器承接 main 的 per-agent 能力，不重写 UI 状态模型。
2. YAGNI
   - 本轮不做完整 per-agent 模型 UI，先提供后续接入所需的最小状态能力。
3. SOLID
   - 模型解析职责集中在 `modelSlice` 与 `openclawModelRef`，组件继续只消费选择结果。
4. DRY
   - 复用已有 `resolveOpenClawModelRef(...)` 和 `isSameModelIdentity(...)`，避免新增第二套模型匹配规则。

### 本轮验证

1. `npx vitest run src/renderer/store/slices/modelSlice.test.ts src/renderer/utils/openclawModelRef.test.ts src/renderer/components/cowork/agentModelSelection.test.ts src/renderer/services/providerRequestConfig.test.ts src/renderer/services/config.test.ts src/shared/providers/constants.test.ts`
   - 6 个测试文件通过。
   - 63 条测试通过。
2. `npx tsc --project tsconfig.json --noEmit`
   - 通过。
3. `npx tsc --project electron-tsconfig.json --noEmit`
   - 通过。
4. `git diff --check`
   - 通过。

### 下一轮规划

进入 J4：认证流公共 bugfix，预计还剩 1 轮。

1. 扫描 `origin/main` 中认证相关公共修复：
   - `src/main/main.ts`
   - `src/main/preload.ts`
   - `src/renderer/services/auth.ts`
   - `src/renderer/services/apiRequestHeaders.ts`
   - `src/main/libs/openaiCodexAuth.ts`
   - `src/main/libs/coworkOpenAICompatProxy.ts`
2. 只合入公共 bugfix：
   - token/header 归一化。
   - provider request auth header 兜底。
   - OpenAI/Codex auth 低耦合 helper。
   - 不覆盖 QingShu Portal / QTB / 飞书扫码 / managed catalog 登录主干。
3. 验证范围：
   - auth/request header/provider config/cowork proxy 相关测试。
   - 两套 TypeScript 与 `git diff --check`。
4. 暂不处理：
   - 认证 UI 大迁移。
   - QTB/Portal 登录流程替换。
   - managed catalog 权限策略改造。

### 剩余轮次估算

批次 J 预计还剩 1 轮：J4 认证流公共 bugfix。

## 2026-05-13：批次 J 第 4 轮认证 / Provider OAuth 请求层公共 bugfix

本轮按 J4 规划处理认证流公共 bugfix。执行前先扫描 `origin/main` 与当前分支在 `main.ts`、`preload.ts`、`auth.ts`、`apiRequestHeaders.ts`、`openaiCodexAuth.ts`、`coworkOpenAICompatProxy.ts`、Provider 类型上的差异，确认当前分支已经有青数 Portal / QTB / 飞书扫码 / managed catalog 登录主干，以及 OpenAI/Codex auth helper 和 proxy token refresher。整包回灌 `origin/main` 的认证主干会覆盖青数登录与治理链，不安全。

### 调查结论

1. 当前分支已有并需要保留：
   - QTB / Portal / 飞书扫码认证主干。
   - 登录后 managed catalog hydration 与 Agent 列表局部刷新。
   - OpenAI Codex auth 文件隔离到 app `userData/codex`。
   - `coworkOpenAICompatProxy` provider-level token refresher。
   - Provider 类型中的 OAuth 字段。
2. 本轮发现一个低耦合公共 bugfix 缺口：
   - renderer 普通 API 请求和设置页连通性测试仍只读取 `providerConfig.apiKey`。
   - 当 provider 使用 OAuth 且 `oauthAccessToken` 已存在、`apiKey` 为空或过期时，会被错误判断为未配置或继续用旧 key。
   - 主进程 `claudeSettings.ts` 已有 MiniMax OAuth credential 解析逻辑，但 renderer 请求层还没有统一复用等价规则。

### 本轮代码更新

1. 新增 renderer provider credential helper：
   - 文件：`src/renderer/services/providerRequestConfig.ts`
   - 新增 `resolveProviderRequestCredential(provider, providerConfig)`。
   - 解析顺序：OAuth access token 优先，其次回退 apiKey。
   - 当 MiniMax 使用 OAuth access token 时，自动使用 OAuth baseUrl 并强制 `apiFormat='anthropic'`，与主进程 OpenClaw/Claude 配置解析保持一致。
2. renderer API 请求接入 OAuth credential：
   - 文件：`src/renderer/services/api.ts`
   - `getProviderConfig(...)` 改用 `resolveProviderRequestCredential(...)`。
   - OAuth token/baseUrl 生效后，普通 renderer chat 流不再误判 provider 未配置。
3. 设置页连通性测试接入 OAuth credential：
   - 文件：`src/renderer/components/Settings.tsx`
   - provider 测试前置校验、Anthropic header、OpenAI-compatible header 均使用解析后的 credential。
   - 不改变登录 UI 与 token 获取流程。
4. 防退化测试：
   - 文件：`src/renderer/services/providerRequestConfig.test.ts`
   - 覆盖 OAuth token 优先于旧 apiKey。
   - 覆盖 MiniMax OAuth 强制 Anthropic 格式和 OAuth baseUrl。

### 本轮刻意未改

1. 不替换 `src/renderer/services/auth.ts`。
2. 不替换 `src/main/main.ts` 认证 IPC 主干。
3. 不改变 QTB / Portal / 飞书扫码登录流程。
4. 不改变 managed catalog 登录态与治理链。
5. 不迁移认证 UI。

### 原则校验

1. KISS
   - 只抽一个 credential helper，不重排认证流程。
2. YAGNI
   - 不引入完整 OAuth token refresh UI 或认证状态机迁移。
3. SOLID
   - provider 请求凭据解析放在 `providerRequestConfig.ts`，API 请求和设置页只消费结果。
4. DRY
   - renderer chat 与设置页连接测试复用同一 helper，避免 OAuth token/baseUrl 规则分叉。

### 本轮验证

1. `npx vitest run src/renderer/services/apiRequestHeaders.test.ts src/renderer/services/providerRequestConfig.test.ts src/renderer/services/config.test.ts src/main/libs/openaiCodexAuth.test.ts src/main/libs/claudeSettings.test.ts src/main/libs/openclawConfigSync.runtime.test.ts`
   - 6 个测试文件通过。
   - 43 条测试通过。
2. `npx tsc --project tsconfig.json --noEmit`
   - 通过。
3. `npx tsc --project electron-tsconfig.json --noEmit`
   - 通过。
4. `git diff --check`
   - 通过。

### 批次 J 收口结论

批次 J 已按规划完成 4 轮：

1. J1：IM 白名单模块对齐。
2. J2：OpenClaw runtime `contextPercent` 元数据补齐。
3. J3：per-agent `modelSlice` 兼容层。
4. J4：认证 / Provider OAuth 请求层公共 bugfix。

本批次继续遵守保护边界：

1. 未覆盖青数品牌、工作台、主操作台 UI。
2. 未覆盖青数 managed catalog / 内置治理链。
3. 未覆盖唤醒 / TTS 独立链路。
4. 未整包替换高耦合 OpenClaw 主干、认证主干或 Agent 创建/编辑 UI。

### 后续规划

批次 J 剩余 0 轮。若继续推进，建议进入批次 K：收口验证与可验收打包前检查。

1. K1：全量关键测试矩阵
   - OpenClaw runtime/config/history。
   - Provider/model/auth。
   - IM 多实例/Agent binding。
   - ScheduledTasks。
   - Cowork renderer 状态与消息展示。
2. K2：冲突标记、敏感信息、打包产物和 `.gitignore` 检查
   - 确保没有 conflict marker。
   - 确保没有 app_id/key/token 进入待提交内容。
   - 确保 release / node_modules / 本地输出仍被忽略。
3. K3：可验收包构建
   - 只在用户明确要求打包时执行。
   - 优先构建 `.app`，不打 DMG。

### 剩余轮次估算

批次 J 已完成，剩余 0 轮。

## 2026-05-13：批次 K 第 1 轮全量关键测试矩阵

本轮进入批次 K：收口验证与可验收打包前检查。K1 只做验证，不新增业务改动，目标是把前面多轮 main 公共能力选择性合入后的关键链路压测一遍。

### 本轮验证范围

1. OpenClaw runtime / config / history / packaging
   - 覆盖 runtime adapter、config sync、history/transcript、engine manager、runtime packaging、patch/prune、channel sync、memory/workspace migration。
2. Provider / model / auth / proxy
   - 覆盖 `modelSlice` per-agent 兼容层、OpenClaw model ref、Provider URL/auth header、OAuth credential、OpenAI Codex auth、Claude/OpenClaw provider config、OpenAI compat proxy。
3. IM 多实例 / Agent binding
   - 覆盖 IM store、单实例到多实例迁移、gateway config、NIM、scheduled task agent、cowork handler、agent IM binding、Agent bundle 保存守卫。
4. ScheduledTasks / Cowork renderer
   - 覆盖 cron、migration、policy registry、scheduled task service/slice、RunSessionModal、cowork service/slice、assistant metadata、conversation turns、TTS/speech text、prompt history、slash commands、artifact parser。
5. 安全 / 治理 / 语音 / 日志辅助链路
   - 覆盖 speech guard、edge TTS、speech recovery、command safety、sanitize log、MCP log/server、enterprise config、skill security、sqlite backup、qingshu governance / managed UI / tool bundles。

### 本轮验证结果

1. OpenClaw 第一批：
   - 命令：`npx vitest run src/main/libs/agentEngine/openclawRuntimeAdapter.test.ts ... src/main/libs/gatewayLogRotation.test.ts`
   - 18 个测试文件通过。
   - 266 条测试通过。
2. Provider / model / auth 第二批：
   - 命令：`npx vitest run src/renderer/store/slices/modelSlice.test.ts ... src/renderer/services/authSessionReset.test.ts`
   - 13 个测试文件通过。
   - 121 条测试通过。
3. IM / Agent 第三批：
   - 命令：`npx vitest run src/main/im/imStore.test.ts ... src/renderer/components/agent/agentBundleSaveGuard.test.ts`
   - 17 个测试文件通过。
   - 125 条测试通过。
4. ScheduledTasks / Cowork renderer 第四批：
   - 命令：`npx vitest run src/scheduledTask/cronJobService.test.ts ... src/renderer/store/slices/artifactSlice.test.ts`
   - 28 个测试文件通过。
   - 252 条测试通过。
5. 安全 / 治理 / 语音 / 日志辅助第五批：
   - 命令：`npx vitest run src/main/libs/assistantSpeechGuard.test.ts ... src/renderer/services/installationId.test.ts`
   - 20 个测试文件通过。
   - 212 条测试通过。
6. TypeScript 与 diff 检查：
   - `npx tsc --project tsconfig.json --noEmit` 通过。
   - `npx tsc --project electron-tsconfig.json --noEmit` 通过。
   - `git diff --check` 通过。

### 汇总

1. K1 关键矩阵共验证：
   - 96 个测试文件通过。
   - 976 条测试通过。
2. 未发现 TypeScript 编译错误。
3. 未发现 diff 空白错误。
4. 本轮未修改生产代码。

### 原则校验

1. KISS
   - 按能力域分批验证，失败时可快速定位，不用一个超长命令吞掉上下文。
2. YAGNI
   - 未在没有失败证据的情况下追加修复。
3. SOLID
   - 以模块边界组织验证矩阵，保持 OpenClaw、Provider、IM、ScheduledTasks、Cowork、治理链各自独立验收。
4. DRY
   - 将本轮验证矩阵沉淀进 changelog，后续打包前可直接复用。

### 下一轮规划

进入 K2：冲突标记、敏感信息、打包产物和 `.gitignore` 检查，预计还剩 2 轮。

1. 扫描冲突标记：
   - `<<<<<<<`
   - `=======`
   - `>>>>>>>`
2. 扫描敏感信息：
   - app_id / app_secret / apiKey / token / Authorization / refreshToken / accessToken 等高风险关键词。
   - 对命中的示例逐项判断是否为测试假值、类型字段、文档说明或真实 secret。
3. 检查本地打包产物：
   - `outputs/`
   - `release/`
   - `dist/`
   - `node_modules/`
   - `release-repack*`
4. 检查 `.gitignore` 是否覆盖本地构建产物和敏感配置。
5. 输出 K2 结论：
   - 可提交文件范围。
   - 需排除或清理的本地产物。
   - 是否需要补 `.gitignore`。

### 剩余轮次估算

批次 K 预计还剩 2 轮：K2 安全/产物检查，K3 可验收包构建。

## 2026-05-13：批次 K 第 2 轮冲突标记、敏感信息与本地产物审计

本轮继续批次 K 的可验收收口，只做安全与提交边界审计，不改动青数品牌、工作台、内置治理链、唤醒/TTS、IM 多实例或 OpenClaw 业务主链路。

### 本轮检查范围

1. 冲突标记扫描
   - 扫描 `<<<<<<<`、`=======`、`>>>>>>>`。
   - 排除 `node_modules/`、`release/`、`outputs/`、`vendor/`、`dist/`、`dist-electron/`。
2. 敏感信息扫描
   - 扫描 app id、app secret、api key、access token、refresh token、Authorization、Bearer、private key、client secret、password 等关键词。
   - 追加高风险模式扫描：OpenAI/GitHub/Slack/AWS/Google key 前缀、私钥 PEM 头、长 Bearer token、显式 `key/token/secret/password = "..."` 字面量。
3. 本地产物与 `.gitignore` 检查
   - 检查 `outputs/`、`release-repack*`、`release/`、`dist/`、`dist-electron/`、`node_modules/`。
   - 检查这些目录是否已经被 Git 跟踪。

### 本轮变更

1. 补充 `.gitignore`
   - 新增 `release-repack*`，避免本地重打包目录进入待提交列表。
   - 新增 `outputs/`，避免本地输出目录进入待提交列表。
2. 未修改生产代码。
3. 未修改青数覆盖层相关文件。

### 本轮检查结果

1. 冲突标记
   - 未发现未解决的 merge conflict marker。
2. 高风险 secret
   - 未发现真实 Bearer 长 token。
   - 未发现 OpenAI/GitHub/Slack/AWS/Google 常见密钥前缀。
   - 未发现 PEM 私钥头。
3. 关键词命中判断
   - 命中的 `access-token`、`refresh-token`、`oauth-token`、`legacy-key`、`feishu-secret`、`dingtalk-secret` 等均位于测试用例或假值场景。
   - 命中的 `${LOBSTER_MCP_BRIDGE_SECRET}`、`${LOBSTER_TG_BOT_TOKEN}`、`${LOBSTER_DC_BOT_TOKEN}` 等为 OpenClaw 配置中的环境变量占位符，不是明文 secret。
   - `src/main/libs/openaiCodexAuth.ts` 只从用户数据目录读取运行时 `auth.json`，本轮没有把该文件纳入仓库。
   - `src/main/libs/agentEngine/openclawRuntimeAdapter.ts` 的网关连接日志只输出 url/token/client entry 是否存在，不输出 token 值。
4. 本地产物
   - `outputs/`、`release/`、`dist/`、`dist-electron/`、`node_modules/` 已被 `.gitignore` 命中。
   - `release-repack*` 已被 `.gitignore` 命中。
   - Git 当前没有跟踪 `node_modules/`、`dist/`、`dist-electron/`、`release/`、`outputs/` 或 `release-repack*` 下的文件。

### 风险与注意事项

1. `.gitignore` 只能阻止新增未跟踪文件进入待提交列表，不能自动移除已经 tracked 的历史文件。本轮已检查这些本地产物目录当前没有被 Git 跟踪。
2. 代码中仍存在大量 secret/token 字段名，这是配置模型、测试假值和 UI 输入项的必要结构，不应机械删除。
3. 后续如果新增真实 `.env`、证书、私钥或运行时 auth 文件，仍应保持在本地，不应通过 `git add -f` 强制加入。

### 原则校验

1. KISS
   - 通过 `.gitignore` 直接挡住本地产物目录，不引入复杂提交脚本。
2. YAGNI
   - 本轮只补确实已出现风险的 `outputs/` 和 `release-repack*`，没有扩大到不明确的目录规则。
3. SOLID
   - 将安全审计、产物忽略和业务合入解耦，避免安全收口影响青数业务模块。
4. DRY
   - 把审计命令和判断结论沉淀到 changelog，后续提交前可复用同一检查口径。

### 下一轮规划

进入 K3：可验收包构建，预计还剩 1 轮。

1. 若用户确认需要打包，执行 `.app` 构建，不打 DMG。
2. 构建前复核 TypeScript 或直接复用 K1 的编译结果，视本轮是否有代码变更决定。
3. 构建后确认 `.app` 输出路径，并确保 `release/` 等产物仍不会进入待提交列表。
4. 若暂不打包，则批次 K 可停在“已通过关键测试与提交前审计”的可提交状态。

### 剩余轮次估算

批次 K 预计还剩 1 轮：K3 可验收包构建。

## 2026-05-13：批次 K 第 3 轮可验收 `.app` 构建

本轮按 K3 规划执行可验收包构建。目标是生成 macOS `.app` 测试包，不生成 DMG，不提交、不推送、不清理用户工作区。

### 本轮构建路径

1. 前端与 Electron bundle
   - 执行 `npm run build`。
   - `tsc` 与 Vite production build 通过。
   - Vite 输出动态 import 与静态 import 混用提示，但未阻断构建。
2. Electron main 编译
   - 执行 `npm run compile:electron`。
   - `electron-builder install-app-deps` 为 arm64 rebuild native dependencies。
   - `tsc --project electron-tsconfig.json` 通过。
3. 内置技能构建
   - 执行 `npm run build:skills`。
   - `web-search`、`tech-news`、`imap-smtp-email` 构建完成。
   - `imap-smtp-email` 的生产依赖 audit 仍提示 2 moderate / 4 high，本轮未改依赖树。
4. OpenClaw runtime 准备
   - 执行 `npm run openclaw:runtime:mac-arm64`。
   - OpenClaw 版本：`v2026.4.14`。
   - 12 个 OpenClaw patch 全部应用。
   - runtime 本体命中缓存并同步到 `vendor/openclaw-runtime/current`。
   - gateway bundle 命中缓存。
   - OpenClaw extensions 完成 precompile / channel deps / prune。
5. `.app` 构建
   - 执行 `npx electron-builder --mac dir --arm64 --config electron-builder.json`。
   - 通过 `dir` target 只生成 unpacked `.app`，未生成新的 DMG。

### 构建产物

1. `.app` 输出路径
   - `release/mac-arm64/QingShuClaw.app`
2. 产物大小
   - 约 `1.6G`。
3. 资源检查
   - 包内包含 `Contents/Resources/SKILLs`。
   - 包内包含 `Contents/Resources/cfmind`。
   - 包内包含 `Contents/Resources/macos-speech`。
4. macOS 语音 helper
   - `MacSpeechHelper` 可执行。
   - `MacTtsHelper` 可执行。
5. Info.plist 核对
   - `CFBundleDisplayName=QingShuClaw`。
   - `CFBundleExecutable=QingShuClaw`。
   - `CFBundleIdentifier=com.lobsterai.app`。
   - `CFBundleShortVersionString=2026.5.9`。
   - 麦克风与语音识别权限文案存在。

### OpenClaw 插件打包状态

已进入 `.app` 的 OpenClaw extensions：

1. `ask-user-question`
2. `clawemail-email`
3. `dingtalk-connector`
4. `mcp-bridge`
5. `openclaw-lark`
6. `openclaw-netease-bee`
7. `openclaw-nim-channel`
8. `openclaw-weixin`
9. `wecom-openclaw-plugin`

未进入 `.app` 的 optional 插件：

1. `moltbot-popo`
   - 原因：两次安装均在 `https://npm.nie.netease.com/moltbot-popo` 发生 `ECONNRESET`。
   - 第二次已带代理重试，仍被 registry 断开连接。
   - 当前脚本将 `moltbot-popo` 标记为 optional，失败后继续构建。
   - 影响：本轮 `.app` 的 POPO OpenClaw 插件能力不完整；其余 IM / OpenClaw 插件已进入包内。

### 签名与公证状态

1. 本轮 `.app` 未签名。
2. electron-builder 跳过代码签名，原因是本机没有有效 Developer ID Application 证书。
3. 本轮未公证，原因是未设置 `APPLE_ID` 或 `APPLE_APP_SPECIFIC_PASSWORD`。
4. 影响：本地测试可用，但首次打开可能需要通过 macOS 安全设置允许，或右键打开。

### 产物忽略与提交边界

1. `release/` 仍被 `.gitignore` 忽略。
2. `dist/`、`dist-electron/`、`outputs/`、`vendor/openclaw-runtime/` 仍被 `.gitignore` 忽略。
3. `release/` 中未生成新的 DMG；当前只看到历史 `QingShuClaw-2026.3.31-arm64.dmg`。
4. `git diff --check` 通过。

### 原则校验

1. KISS
   - 使用 `electron-builder --mac dir --arm64` 直接生成 `.app`，避免 DMG 阶段和公证链路引入额外变量。
2. YAGNI
   - 本轮不补签名、公证、DMG、zip 或安装器，只交付当前测试所需 `.app`。
3. SOLID
   - 打包链路保持前端、Electron、SKILLs、OpenClaw runtime、electron-builder 分阶段执行，便于定位失败点。
4. DRY
   - K3 的命令和检查项已沉淀，后续测试包可复用同一构建流程。

### 批次 K 收口结论

批次 K 已按规划完成 3 轮：

1. K1：全量关键测试矩阵。
2. K2：冲突标记、敏感信息、本地产物和 `.gitignore` 审计。
3. K3：可验收 `.app` 构建。

当前可验收状态：

1. 关键测试矩阵通过。
2. TypeScript 检查通过。
3. `git diff --check` 通过。
4. `.app` 测试包已生成。
5. POPO optional 插件因 registry 网络问题未进入包内，需要后续在网络可用时单独补装或改用可访问缓存源。

### 后续规划

批次 K 剩余 0 轮。若继续推进，建议进入批次 L：提交前最终收口。

1. L1：确认 POPO 插件处理策略
   - 选项 A：接受本轮 `.app` 作为不含 POPO 插件的测试包。
   - 选项 B：待 `npm.nie.netease.com` 可用后重跑 `npm run openclaw:plugins` 并重新打 `.app`。
   - 选项 C：若已有内部 tarball/cache，改脚本走本地缓存源后重打。
2. L2：提交前 staged 范围审计
   - 按能力域分组列出待提交文件。
   - 排除 `release/`、`dist/`、`dist-electron/`、`vendor/openclaw-runtime/`、`outputs/`。
   - 再跑一次 secret scan 与 `git diff --check`。
3. L3：本地 commit
   - 仅在用户明确要求提交时执行。
   - commit message 使用 Conventional Commits 英文格式。

### 剩余轮次估算

批次 K 已完成，剩余 0 轮。若继续做提交前收口，建议新增批次 L，预计 2-3 轮。

## 2026-05-13：批次 K 追加修复 `.app` 启动失败

本轮针对新打 `.app` 无法打开的问题做专项调查与修复。先用 `Contents/MacOS/QingShuClaw` 直接启动并查看 `~/Library/Logs/QingShuClaw/main-2026-05-13.log`，确认问题不是资源缺失，也不是 Finder 层面的单纯 Gatekeeper 拦截，而是主进程在 `initStore()` 初始化数据库时崩溃。

### 根因

日志中的关键错误：

1. `Could not dynamically require ".../app.asar/build/better_sqlite3.node"`
2. 崩溃位置在 `SqliteStore.create()`。
3. `better-sqlite3` native binding 实际位于 `app.asar.unpacked/node_modules`，但主进程 bundle 内的动态 require 被 Rollup/CommonJS 打包后指向了 `app.asar/build/better_sqlite3.node`。

因此根因是：`better-sqlite3` 被主进程 Vite/Rollup 过度打包，导致 Electron 打包后 native `.node` 加载路径错误。

### 修复

1. 文件：`vite.config.ts`
2. 在 Electron main process 的 `rollupOptions.external` 中加入：
   - `better-sqlite3`
3. 同时保留原有 `sql.js` external 兼容项，避免无意移除旧兼容边界。

修复原则：

1. KISS
   - 只把 native 数据库模块外置，不改数据库业务层。
2. YAGNI
   - 不新增 runtime loader 或手写 native binding path。
3. SOLID
   - 打包配置负责 native 模块边界，`sqliteStore` 继续只负责数据库读写。
4. DRY
   - 复用现有 external 白名单机制。

### 验证

1. `npm run build` 通过。
2. `npm run compile:electron` 通过。
3. `npx electron-builder --mac dir --arm64 --config electron-builder.json` 通过。
4. 直接启动可执行文件后，日志已越过原崩溃点：
   - `initApp: store initialized`
   - `OpenClawTokenProxy started`
   - `syncBundledSkillsToUserData done`
   - `OpenClaw gateway server ready`
5. 用 `open -a release/mac-arm64/QingShuClaw.app` 验证 LaunchServices 路径可启动：
   - 主进程存在。
   - GPU / network / renderer helper 进程存在。
   - OpenClaw gateway handshake succeeded。
6. 对测试 `.app` 执行 ad-hoc 重签名：
   - `codesign --force --deep --sign - release/mac-arm64/QingShuClaw.app`
   - `codesign --verify --deep --strict --verbose=2 release/mac-arm64/QingShuClaw.app` 通过。

### 仍需注意

1. 当前 `.app` 是 ad-hoc 签名，不是 Developer ID 签名。
2. `spctl --assess` 仍会 rejected，这是未公证测试包的预期表现。
3. 本地测试可打开；分发给其他机器时仍可能需要右键打开或使用正式签名/公证包。

### 后续打包检查新增项

后续每次生成 `.app` 后必须增加这两步：

1. 直接启动验证：
   - `release/mac-arm64/QingShuClaw.app/Contents/MacOS/QingShuClaw`
   - 至少确认日志出现 `initApp: store initialized`。
2. 签名结构验证：
   - `codesign --verify --deep --strict --verbose=2 release/mac-arm64/QingShuClaw.app`
   - 测试包可用 ad-hoc 重签名修复签名结构。

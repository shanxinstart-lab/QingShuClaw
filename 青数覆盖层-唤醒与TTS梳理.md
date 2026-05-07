# 青数覆盖层：唤醒与 TTS 梳理

## 1. 背景与目标

这份文档用于把当前分支中的语音输入、语音唤醒、TTS 朗读能力整理成一份迁移清单，供后续从最新 `main` 新拉分支后按域回贴。

这里的范围包括：

1. 语音输入
2. 语音唤醒
3. 唤醒浮层
4. 本地 TTS
5. `edge-tts` 运行时
6. macOS Swift helper
7. 打包与开发态权限准备

## 2. 核心结论

当前分支的语音能力不是单点功能，而是一条完整链路：

1. renderer 设置页负责配置与状态展示。
2. `config` 与 shared constants 负责默认值和字段口径。
3. `preload` 暴露 `speech / wakeInput / tts` IPC。
4. `main.ts` 管理默认配置、IPC handler、状态广播和服务联动。
5. 主进程服务负责 STT、唤醒状态机、TTS 路由和运行时降级。
6. 底层 helper / runtime 负责 macOS 语音识别、本地朗读、`edge-tts` 安装与播放。
7. `WakeActivationOverlay` 由 `App.tsx` 顶层叠层统一承接，需要和登录欢迎浮层一起看待层级与焦点行为。

因此后续迁移时，不能只迁：

1. `Settings.tsx`
2. `WakeActivationOverlay.tsx`
3. 某一个主进程 service

必须把整条链一起迁过去。

## 3. 配置口径与默认值

### 3.1 renderer 默认值

核心文件：

1. `src/renderer/config.ts`
2. `src/renderer/services/config.ts`

当前默认值：

1. 语音输入停止词：`停止输入`
2. 语音输入发送词：`结束发送`
3. 默认唤醒词：`打开青书爪`
4. 唤醒发送词：`发送`
5. 唤醒取消词：`取消`
6. 唤醒 session 超时：`20_000ms`
7. 唤醒欢迎语默认文案：`在的`
8. TTS 默认开启
9. TTS 默认引擎：`macos_native`
10. TTS 默认自动朗读关闭
11. STT LLM 修正默认关闭
12. TTS LLM 改写默认关闭

### 3.2 主进程默认值

核心文件：

1. `src/main/main.ts`

主进程保留了与 renderer 对应的一套默认配置与 merge 逻辑，保证：

1. 旧配置缺字段时可补默认值
2. 历史单个 `wakeWord` 字段能迁到 `wakeWords[]`
3. TTS 引擎值异常时可回退默认值

## 4. Shared constants 与 IPC 口径

### 4.1 shared constants

核心文件：

1. `src/shared/speech/constants.ts`
2. `src/shared/wakeInput/constants.ts`
3. `src/shared/tts/constants.ts`

它们定义了：

1. IPC channel 名
2. 状态枚举
3. 错误码
4. 配置结构
5. 事件 payload 结构

这部分是迁移时的基础契约，必须保留。

### 4.2 preload 暴露

核心文件：

1. `src/main/preload.ts`

当前已暴露：

1. `window.electron.speech`
2. `window.electron.speechFollowUp`
3. `window.electron.wakeInput`
4. `window.electron.tts`

如果只迁 renderer 而漏掉这里，设置页和输入区会直接断链。

## 5. 主进程服务链

### 5.1 语音输入

核心文件：

1. `src/main/libs/macSpeechService.ts`
2. `src/shared/speech/constants.ts`
3. `src/main/main.ts`

当前职责：

1. 检查语音识别与麦克风权限
2. 拉起 macOS speech helper
3. 向 renderer 广播 `Listening / Partial / Final / Stopped / Error`
4. 配合 `speechErrorRecovery` 处理打断与恢复

### 5.2 语音唤醒

核心文件：

1. `src/main/libs/wakeInputService.ts`
2. `src/shared/wakeInput/constants.ts`
3. `src/main/main.ts`

当前职责：

1. 后台监听唤醒词
2. 支持对唤醒词做归一化与近似匹配
3. 在命中后进入 `wake_triggered -> dictating -> cooldown`
4. 派发 `dictationRequested`
5. 支持回复后自动继续下一轮语音输入

### 5.3 TTS 路由

核心文件：

1. `src/main/libs/ttsRouterService.ts`
2. `src/main/libs/macTtsService.ts`
3. `src/main/libs/edgeTtsService.ts`
4. `src/shared/tts/constants.ts`

当前职责：

1. 在 `macOS native` 与 `edge-tts` 间切换
2. 统一查询可用性与音色列表
3. 统一执行朗读与停止
4. `edge-tts` 失败时回退到 `macOS native`

## 6. 底层 helper 与运行时资源

### 6.1 macOS 语音识别 helper

核心文件：

1. `resources/macos-speech/MacSpeechHelper.swift`
2. `scripts/build-macos-speech-helper.cjs`

作用：

1. 请求系统语音识别与麦克风权限
2. 调用 `Speech` / `AVFoundation`
3. 以 JSON line 方式把识别事件回传给 Electron 主进程

### 6.2 macOS TTS helper

核心文件：

1. `resources/macos-speech/MacTtsHelper.swift`
2. `scripts/build-macos-tts-helper.cjs`

作用：

1. 列出系统可用 voice
2. 基于 `AVSpeechSynthesizer` 做本地朗读
3. 以 JSON line 方式回传 `speaking / stopped / error`

### 6.3 `edge-tts` 运行时

核心文件：

1. `src/main/libs/edgeTtsService.ts`

作用：

1. 管理 `edge-tts` Python 运行时准备状态
2. 刷新音色缓存
3. 合成音频并执行播放
4. 支持强制重装 / 重试

### 6.4 打包与开发态权限准备

核心文件：

1. `scripts/prepare-dev-electron-speech-host.cjs`
2. `package.json` 中的 `build:macos-speech-helper`
3. `package.json` 中的 `build:macos-tts-helper`
4. `electron-builder.json` 中的 macOS 权限说明与资源打包配置

作用：

1. 开发态为 Electron 宿主补充麦克风与语音识别权限文案
2. 构建时生成 helper 二进制
3. 打包时把 `macos-speech` 资源带入安装包

## 7. Renderer 侧生效位置

### 7.1 设置页

核心文件：

1. `src/renderer/components/Settings.tsx`

当前包含：

1. 语音输入停止词 / 发送词
2. 回复后自动开麦
3. STT 结果 LLM 修正
4. 语音唤醒开关、唤醒词、命令词、状态展示
5. 唤醒后欢迎语开关与文案
6. TTS 启用、自动朗读、引擎切换、运行时准备状态
7. voice 选择、语速、音量、跳过关键词
8. `edge-tts` 重新安装 / 重试

### 7.2 输入区与会话联动

核心文件：

1. `src/renderer/components/cowork/CoworkPromptInput.tsx`

当前职责：

1. 响应 `speech` 识别事件
2. 响应 `wakeInput` 的 `dictationRequested`
3. 处理唤醒后听写、自动提交、取消命令
4. 处理回复后继续语音输入
5. 调度 `WakeActivationOverlay`

### 7.3 全局唤醒浮层

核心文件：

1. `src/renderer/components/WakeActivationOverlay.tsx`
2. `src/renderer/components/wakeActivationOverlayHelpers.ts`
3. `src/renderer/App.tsx`

当前行为：

1. 命中唤醒词时在顶层工作台显示浮层
2. 显示 `preparing / dictating / submitting` 三阶段
3. 听写阶段可显示实时 transcript
4. 视觉上采用当前分支的青绿色语音反馈样式
5. 与 `LoginWelcomeOverlay` 一样属于顶层全局反馈层，不是页面内局部组件

## 8. 生效位置总表

| 层级 | 关键文件 | 生效内容 |
| --- | --- | --- |
| 配置定义 | `src/renderer/config.ts`、`src/renderer/services/config.ts` | 默认值、配置 merge、旧字段兼容 |
| shared 契约 | `src/shared/speech/constants.ts`、`src/shared/wakeInput/constants.ts`、`src/shared/tts/constants.ts` | IPC 与状态结构 |
| preload | `src/main/preload.ts` | `speech / wakeInput / tts` 暴露给 renderer |
| 主进程路由 | `src/main/main.ts` | 默认配置、IPC handler、状态广播 |
| STT 服务 | `src/main/libs/macSpeechService.ts` | 语音识别与权限 |
| 唤醒服务 | `src/main/libs/wakeInputService.ts` | 唤醒词监听、状态机、dictation 请求 |
| TTS 路由 | `src/main/libs/ttsRouterService.ts` | 引擎切换与回退 |
| 本地 TTS | `src/main/libs/macTtsService.ts` | 系统 voice 与本地朗读 |
| `edge-tts` | `src/main/libs/edgeTtsService.ts` | 运行时安装、音色、合成与播放 |
| Swift helper | `resources/macos-speech/*` | macOS 语音识别 / 朗读底层实现 |
| 构建脚本 | `scripts/build-macos-*.cjs`、`scripts/prepare-dev-electron-speech-host.cjs` | helper 构建与开发权限准备 |
| 设置页 | `src/renderer/components/Settings.tsx` | 配置入口与运行时状态展示 |
| 输入区 | `src/renderer/components/cowork/CoworkPromptInput.tsx` | 语音输入与唤醒后听写 |
| 顶层浮层 | `src/renderer/components/WakeActivationOverlay.tsx`、`src/renderer/App.tsx` | 唤醒反馈动画与顶层展示 |

## 9. 从 main 新分支回贴时的建议

### 9.1 必须成组迁移

高优先级：

1. `src/shared/speech/constants.ts`
2. `src/shared/wakeInput/constants.ts`
3. `src/shared/tts/constants.ts`
4. `src/main/preload.ts`
5. `src/main/main.ts` 中的语音默认配置与 IPC
6. `src/main/libs/macSpeechService.ts`
7. `src/main/libs/wakeInputService.ts`
8. `src/main/libs/macTtsService.ts`
9. `src/main/libs/edgeTtsService.ts`
10. `src/main/libs/ttsRouterService.ts`
11. `resources/macos-speech/MacSpeechHelper.swift`
12. `resources/macos-speech/MacTtsHelper.swift`
13. `scripts/build-macos-speech-helper.cjs`
14. `scripts/build-macos-tts-helper.cjs`
15. `scripts/prepare-dev-electron-speech-host.cjs`
16. `src/renderer/config.ts`
17. `src/renderer/services/config.ts`
18. `src/renderer/components/Settings.tsx`
19. `src/renderer/components/cowork/CoworkPromptInput.tsx`
20. `src/renderer/components/WakeActivationOverlay.tsx`
21. `src/renderer/components/wakeActivationOverlayHelpers.ts`
22. `src/renderer/App.tsx`

### 9.2 推荐顺序

1. 先迁 shared constants、`preload`、`main.ts` IPC。
2. 再迁主进程 service 与 helper / runtime 资源。
3. 再迁 renderer 配置与设置页。
4. 最后迁 `CoworkPromptInput` 和 `WakeActivationOverlay` 的交互承接。

## 10. 验收清单

回贴完成后至少检查：

1. 设置页能正确展示语音输入、唤醒、TTS 当前状态。
2. 语音输入权限不足时，错误提示与当前分支一致。
3. 说出唤醒词后，工作台能拉起输入并显示 `WakeActivationOverlay`。
4. 语音输入能识别停止词 / 发送词。
5. 唤醒后的欢迎语能按配置播报，关闭后不播报。
6. TTS 能在 `macOS native` 与 `edge-tts` 间切换。
7. `edge-tts` 失败时能回退本地 TTS，而不是整条链直接报错。
8. 打包后的 App 仍包含 `macos-speech` helper，并具备语音权限文案。

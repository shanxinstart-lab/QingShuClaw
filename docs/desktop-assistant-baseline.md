# Desktop Assistant Baseline

## Stable Chains
- 手动 STT：主进程 `voiceFeatureController` 继续直接编排现有 `speechRouterService`，未被桌面助手模块接管。
- wake input：后台监听、唤醒、冷却和恢复仍由 `wakeInputService` 与原语音链路负责。
- follow-up dictation：继续沿用现有 assistant playback guard 和语音停止/恢复逻辑。
- TTS：手动播放与自动播放仍通过现有 `ttsRouterService` 与 renderer 播放链路运行。
- 设置页保存：新增桌面助手配置独立挂到 `app_config.desktopAssistant`，不复用既有 `voice` legacy hydrate 字段。
- 全局开机自启：当前仍由既有 `autoLaunch` 设置控制；`desktopAssistant.launchAtLogin` 在本阶段只保存不驱动行为。

## Risk Points
- `main.ts` 仍然是部分运行时接线入口，因此新增 observer/callback 时必须避免改变既有语音 handler 顺序。
- renderer 的 assistant message hover action 增加了“开始讲解”按钮，后续如果调整消息 action 行，需要保留现有 TTS/复制的 hover 行为。
- 自动讲解和讲解语音命令都依赖“默认关闭”前提，若以后改默认值，需要重新回归现有语音链路。

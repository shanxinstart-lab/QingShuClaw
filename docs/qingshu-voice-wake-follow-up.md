# QingShuClaw 语音唤醒与自动续麦实现说明

## 1. 范围

本文说明 QingShuClaw 当前在 macOS 下的两条语音能力：

1. 语音唤醒输入
2. 助手回复完成后的自动续麦

当前不包含：

1. Windows/Linux 语音方案
2. TTS 播放方案
3. 云端语音服务接入

当前实现基于 macOS 原生语音识别能力，并复用现有聊天输入框与会话链路。

## 2. 目标

目标是让用户在 QingShuClaw 中获得连续对话体验：

1. 应用在后台监听唤醒词
2. 命中唤醒词后自动拉起窗口并聚焦聊天输入框
3. 用户直接口述需求，文本进入现有输入框
4. 用户说出命令词后提交
5. 当助手回复结束后，如果开启自动续麦，则再次自动进入听写状态

## 3. 相关文件

核心文件如下：

1. [src/main/main.ts](/Users/wuyongsheng/workspace/projects/QingShuClaw/src/main/main.ts)
2. [src/main/libs/wakeInputService.ts](/Users/wuyongsheng/workspace/projects/QingShuClaw/src/main/libs/wakeInputService.ts)
3. [src/main/libs/macSpeechService.ts](/Users/wuyongsheng/workspace/projects/QingShuClaw/src/main/libs/macSpeechService.ts)
4. [src/main/preload.ts](/Users/wuyongsheng/workspace/projects/QingShuClaw/src/main/preload.ts)
5. [src/shared/wakeInput/constants.ts](/Users/wuyongsheng/workspace/projects/QingShuClaw/src/shared/wakeInput/constants.ts)
6. [src/shared/speech/constants.ts](/Users/wuyongsheng/workspace/projects/QingShuClaw/src/shared/speech/constants.ts)
7. [src/renderer/components/cowork/CoworkPromptInput.tsx](/Users/wuyongsheng/workspace/projects/QingShuClaw/src/renderer/components/cowork/CoworkPromptInput.tsx)
8. [src/renderer/components/Settings.tsx](/Users/wuyongsheng/workspace/projects/QingShuClaw/src/renderer/components/Settings.tsx)
9. [src/renderer/config.ts](/Users/wuyongsheng/workspace/projects/QingShuClaw/src/renderer/config.ts)

## 4. 总体架构

整体分成三层：

1. 主进程语音能力层
2. IPC 桥接层
3. 渲染进程输入框交互层

职责划分如下：

1. `MacSpeechService`
   负责直接与 macOS 本地语音识别 helper 通信，输出 `listening / partial / final / stopped / error` 事件。

2. `WakeInputService`
   负责后台监听、唤醒词检测、状态流转、前后台切换，以及把命中唤醒后的听写请求封装为 `DictationRequested` 事件。

3. `main.ts`
   负责：
   - 拉起主窗口
   - 聚焦聊天输入框
   - 转发语音状态到 renderer
   - 管理自动续麦状态 `SpeechFollowUp`
   - 在会话完成时判断是否需要自动再次开麦

4. `CoworkPromptInput`
   负责：
   - 接收听写请求
   - 将语音识别增量文本写入当前输入框
   - 识别“发送 / 取消”等命令词
   - 在输入框不可立即进入听写时做排队等待

## 5. 配置项

当前涉及两组配置。

### 5.1 `speechInput`

定义位置：
[src/renderer/config.ts](/Users/wuyongsheng/workspace/projects/QingShuClaw/src/renderer/config.ts)

字段：

1. `stopCommand`
2. `submitCommand`
3. `autoRestartAfterReply`

其中：

1. `autoRestartAfterReply` 是自动续麦的总开关
2. 默认值为 `false`

### 5.2 `wakeInput`

字段：

1. `enabled`
2. `wakeWords`
3. `submitCommand`
4. `cancelCommand`
5. `sessionTimeoutMs`
6. `autoRestartAfterReply`

说明：

1. `wakeInput.autoRestartAfterReply` 当前不作为总开关使用
2. 自动续麦总开关以 `speechInput.autoRestartAfterReply` 为准
3. `wakeInput` 主要控制后台唤醒与唤醒态听写参数

## 6. 语音唤醒实现逻辑

### 6.1 后台监听

应用启动后，主进程会根据配置与权限状态决定是否启动后台监听：

1. 必须是 macOS
2. 语音输入功能可用
3. 语音识别与麦克风权限已授予
4. `wakeInput.enabled = true`

满足后，`WakeInputService` 进入后台监听状态。

### 6.2 唤醒词匹配

后台语音结果由 `WakeInputService` 处理：

1. 接收 `partial/final` 文本
2. 做归一化处理
3. 与 `wakeWords` 中的多个唤醒词逐个匹配
4. 命中后切换到 `wake_triggered`

当前支持：

1. 多个自定义唤醒词
2. 文本归一化匹配
3. 一定程度的近似容错

### 6.3 唤醒后的动作

命中唤醒词后，主进程会：

1. 显示主窗口
2. 尝试激活应用
3. 聚焦聊天输入框
4. 向 renderer 发送 `WakeInputIpcChannel.DictationRequested`

renderer 接到后，会在输入框中启动一轮“唤醒态听写”。

## 7. 听写与命令词实现逻辑

`CoworkPromptInput` 中维护了当前输入框的语音状态。

语音结果处理方式：

1. `partial/final` 文本持续写回输入框
2. 普通正文直接作为输入内容
3. 命令词会被解析成动作而不是正文

当前命令词有两类：

1. 提交命令
2. 取消命令

来源规则：

1. 手动点麦克风时，优先使用 `speechInput.submitCommand` 与 `speechInput.stopCommand`
2. 唤醒态听写时，使用 `wakeInput.submitCommand` 与 `wakeInput.cancelCommand`

## 8. 自动续麦实现方案

### 8.1 为什么下沉到主进程

自动续麦最初由 renderer 主导，问题是：

1. 会话完成事件和输入框状态事件分散在不同层
2. 主日志中不可观测
3. 一旦某个事件没串起来，很难定位到底卡在哪一步

因此当前方案改成：

1. renderer 负责输入框层面的听写执行
2. 主进程负责自动续麦的“何时触发”决策

这更符合 KISS：

1. 主进程统一判断时机
2. renderer 只关心“收到请求就开麦”

### 8.2 主进程中的 `SpeechFollowUp`

主进程维护内存态：

1. `armed`
2. `armedSessionId`
3. `activeSessionId`
4. `config`

它的职责是：

1. 记录当前是否已经为某轮会话布防自动续麦
2. 在会话 `complete` 时判断是否应该重新开麦
3. 触发新的 `DictationRequested`

### 8.3 自动布防

当前存在两层布防：

1. renderer 在用户提交后，通过 `speechFollowUp.arm()` 主动通知主进程
2. 主进程在 `cowork:session:start/continue` 成功后，按配置再做一层兜底自动布防

这样做的原因是：

1. 防止 renderer 某次没有把 arm IPC 发到主进程
2. 保证自动续麦依赖真实会话启动，而不是仅依赖前端状态

### 8.4 回复完成时的触发

主进程在 `runtime.on('complete')` 时执行判断：

1. 如果当前有已布防的 `SpeechFollowUp`，优先按已布防会话判断
2. 如果已布防状态缺失，则回退到“根据当前配置 + 当前 active session”判断
3. 如果命中，则：
   - 停止当前 TTS
   - 拉起窗口
   - 聚焦输入框
   - 再次发送 `DictationRequested`

## 9. 自动续麦会触发的条件

当前实现中，自动续麦会在以下条件同时满足时触发：

1. `speechInput.autoRestartAfterReply = true`
2. 当前会话已经成功发起 `startSession` 或 `continueSession`
3. 当前这轮助手回复已经进入主进程的 `complete` 事件
4. 完成的会话是当前活跃会话，或与已布防会话匹配
5. renderer 侧输入框当前可进入听写，或者可以先排队等待进入听写

如果触发成功，表现为：

1. 输入框重新进入听写态
2. 识别文本再次写入输入框
3. 说出命令词后再次提交

## 10. 哪些情况下不会触发自动续麦

以下情况不会触发，或会被主动取消：

1. 设置中没有打开“回复结束后自动重新开麦”
2. 当前轮次不是活跃会话
3. 当前会话在回复过程中报错，进入 `error`
4. 用户手动停止当前会话
5. 用户新建了会话，导致原会话被切走
6. 输入框当前不可用，且后续也没有恢复到可听写状态
7. 应用当前不支持语音输入，或权限缺失

另外，以下行为会主动 `disarm`：

1. 新建聊天
2. 手动停止麦克风
3. 听写出错
4. 某些显式取消路径

## 11. 命令词在自动续麦中的取值规则

这是当前实现里很重要的一点。

自动续麦重新开麦后，命令词并不总是取 `speechInput`。

当前规则是：

1. 如果 `wakeInput.enabled = true`
   - 自动续麦优先使用 `wakeInput.submitCommand`
   - 自动续麦优先使用 `wakeInput.cancelCommand`
   - 超时时间使用 `wakeInput.sessionTimeoutMs`

2. 如果 `wakeInput.enabled = false`
   - 自动续麦使用 `speechInput.submitCommand`
   - 自动续麦使用 `speechInput.stopCommand`
   - 超时时间仍复用 `wakeInput.sessionTimeoutMs` 默认值

所以在实际体验上，自动续麦更接近“唤醒态听写”的命令词模型。

## 12. 关键问题答复

### 12.1 会触发自动续麦的条件是什么

最核心的条件只有两条：

1. 自动续麦开关已打开
2. 当前活跃会话的一轮回复已经正常完成

在此基础上，再叠加输入框可用、权限正常、会话未切换等运行条件。

### 12.2 是不是只有上一轮是语音输入，下一轮才会自动续麦

不是。

当前实现里，自动续麦不是“只对上一轮语音输入生效”，而是“对当前活跃会话生效”。

也就是说，只要开关打开，以下场景都会尝试自动续麦：

1. 上一轮是语音唤醒进入并发送
2. 上一轮是手动点麦克风输入并发送
3. 上一轮是手动键盘输入并发送

结论：

1. 自动续麦当前是对所有正常发起并完成的当前活跃对话生效
2. 它不是只绑定“上一轮必须是语音输入”

## 13. 当前实现的边界与建议

### 13.1 当前特点

1. 语音唤醒和自动续麦已经解耦
2. 自动续麦的主判定在主进程，更易观测
3. renderer 仍负责输入框层面的最终开麦与文本写入

### 13.2 建议继续增强的点

如果后续继续演进，建议优先做这几项：

1. 增加自动续麦专属状态提示，让用户能直接看到“已重新进入听写”
2. 增加自动续麦是否只对“语音发起轮次”生效的独立开关
3. 将自动续麦的命令词配置与唤醒态命令词彻底分离
4. 为 `complete -> DictationRequested -> speech.start` 加更细的主进程日志与埋点

## 14. 当前结论

一句话总结当前实现：

1. 语音唤醒负责把应用拉起并进入第一轮听写
2. 自动续麦负责在回复完成后把当前活跃会话继续拉回听写状态
3. 自动续麦当前对所有已发送并完成的活跃会话生效，不要求上一轮必须是语音输入

# 本地 STT + Qwen3-TTS 详细规划

## 目标

在现有统一语音治理层基础上，新增一条“本地模型做 STT，阿里云 `Qwen3-TTS` 做 TTS”的产品路线，满足以下目标：

- STT 在本地执行，减少云端音频上传
- TTS 继续使用高质量云端音色
- 与现有 `voice` 配置、能力矩阵、打包 manifest、设置页保持一致
- 不影响现有 `macos_native / cloud_openai / cloud_aliyun / cloud_volcengine / cloud_azure`

## 适用场景

适合以下诉求：

- 用户更在意语音输入隐私，希望语音不上云或尽量少上云
- 用户主要在桌面端长期使用，需要离线或弱网下仍能做 STT
- 用户仍希望助手回复的朗读质量保持较高，不接受过于机械的离线 TTS

不适合以下诉求：

- 希望第一期就上“真正流式、超低时延”的本地 STT
- 希望所有语音能力都完全离线
- 希望同时支持大量平台且不引入额外运行时依赖

## 总体方案

### 核心组合

- STT：
  - `local_whisper_cpp`
  - `local_faster_whisper`
- TTS：
  - `cloud_aliyun` 下的 `qwen3-tts-flash`
  - 后续可升级 `qwen-tts` / `qwen3-tts-instruct-flash` / `qwen-tts-realtime`

### 产品层语义

这是“本地输入、云端播报”的混合语音能力，而不是完整离线语音助手。

因此在设置页和文案中必须明确区分：

- `手动语音输入 provider`: 本地
- `自动续麦 provider`: 跟随本地 STT
- `语音朗读 provider`: 阿里云 Qwen3-TTS

不要把“本地 STT 可用”误解释成“整套语音都离线”。

## 方案对比

### 方案 A：`whisper.cpp`

推荐级别：最高  
推荐顺序：第一优先级

优点：

- C/C++ 实现，适合打包进 Electron 桌面应用
- 对 Apple Silicon 支持好，可利用 Metal / Core ML / ANE 路径
- 无需强依赖 Python 运行时
- 更适合做真正的“产品内置本地 STT provider”

缺点：

- 模型管理、二进制分发、音频预处理要自己控
- 若后续想做更复杂的 VAD / 流式拼句，需要继续封装

适合：

- macOS 首发
- 以后再逐步扩到 Windows / Linux

### 方案 B：`faster-whisper`

推荐级别：中高  
推荐顺序：第二优先级

优点：

- Python 生态成熟
- 基于 CTranslate2，工程上可较快验证效果
- 在服务器端、开发工具链、实验环境中验证模型效果很方便

缺点：

- 对 Electron 桌面打包不友好
- 需要携带或依赖 Python 环境
- 跨平台分发和依赖治理明显更重

适合：

- 原型验证
- 内部实验版
- 若未来要做“本地 Python worker”模式可再考虑

### 推荐结论

产品化主线建议：

- Phase 1 先做 `local_whisper_cpp`
- `local_faster_whisper` 只保留为实验或开发者模式 provider

这符合：

- KISS：优先选更贴近桌面应用分发的实现
- YAGNI：不先把两套本地 STT 都做成正式产品能力
- DRY：避免同时维护两条本地推理打包链路

## 与现有统一语音治理层的衔接

### 新 provider 建议

建议新增：

- `local_whisper_cpp`
- `local_faster_whisper`

不要直接把它们塞进 `macos_native`，因为语义完全不同：

- `macos_native` 是系统原生能力
- `local_whisper_*` 是随应用分发或按需下载的本地模型能力

### 能力矩阵支持范围

建议支持：

- `manual_stt`
  - `macos_native | cloud_openai | cloud_aliyun | cloud_volcengine | local_whisper_cpp | local_faster_whisper`
- `follow_up_dictation`
  - 跟随 `manual_stt` 解析结果
- `wake_input`
  - 仍只支持 `macos_native`
- `tts`
  - 继续支持 `cloud_aliyun`

### 策略字段建议

当前 `strategy` 只有：

- `manual`
- `native_first`
- `cloud_first`

建议后续扩展为：

- `manual`
- `native_first`
- `local_first`
- `cloud_first`

解析优先级建议：

1. 若 `manual`，只认用户选中的 provider
2. 若 `local_first`，优先本地模型，再退原生，再退云端
3. 若 `native_first`，优先系统能力，再退本地模型，再退云端
4. 若 `cloud_first`，优先云端，再退本地

## 运行时架构建议

### 方案一：主进程直接拉起本地二进制

推荐级别：最高  
适合作为 `whisper.cpp` 主线方案

实现方式：

- 打包 `whisper.cpp` CLI 或自定义 helper
- renderer 继续复用现有录音器
- 主进程在 `speech:transcribeAudio` 中写临时音频文件
- 调用本地二进制完成转写
- 解析 stdout / JSON 输出并回填文本

优点：

- 与现有“录音结束后转写”结构兼容度最高
- 不需要在 renderer 内直接跑 WASM 或 native addon
- 故障隔离更清晰

缺点：

- 需要管理临时文件
- 需要处理模型路径、首次下载、二进制权限

### 方案二：主进程常驻本地 STT worker

推荐级别：中  
适合作为后续流式升级

实现方式：

- 主进程启动独立 worker 进程
- worker 常驻加载模型
- IPC 把音频片段发给 worker
- worker 返回 partial / final 文本

优点：

- 模型可常驻内存，减少重复加载
- 更适合未来做流式识别

缺点：

- 首期复杂度更高
- 要额外处理进程保活、崩溃恢复、版本兼容

### 方案三：Python worker + `faster-whisper`

推荐级别：中  
适合作为实验线

实现方式：

- 应用或开发环境准备 Python runtime
- 主进程调用 Python worker
- worker 使用 `faster-whisper` 转写后回传文本

优点：

- 算法迭代和模型替换快
- 在开发环境验证质量很方便

缺点：

- 分发成本高
- 平台兼容性治理更重

## 推荐实施顺序

### Step 1：Provider 与配置骨架

- 在 `src/shared/voice/constants.ts` 新增本地 provider
- 在 `VoiceCapabilityRegistry` 加入 `local_whisper_cpp`
- 配置项新增：
  - `voice.providers.localWhisperCpp`
  - `voice.providers.localFasterWhisper`
- 设置页显示：
  - 当前 provider
  - 模型是否已安装
  - 模型大小
  - 当前设备是否支持

### Step 2：`whisper.cpp` 最小可用版

- renderer 继续使用现有录音器
- 主进程新增 `LocalWhisperCppSpeechService`
- 支持：
  - 临时文件写入
  - 调用本地二进制
  - 读取转写结果
  - 超时 / 中止 / 错误处理

完成标准：

- 手动 STT 可用
- 自动续麦可用
- 不接 wake_input

### Step 3：模型管理

- 新增模型下载与安装状态
- 支持：
  - 默认模型下载
  - 校验和校验
  - 版本标记
  - 删除与重装
- 打包 manifest 新增：
  - `packaged`
  - `modelBootstrapIncluded`

### Step 4：性能与体验优化

- 音频前处理收敛成统一 PCM / WAV
- 增加 VAD 或静音截断
- 评估是否加常驻 worker
- 增加 Apple Silicon 优化路径

### Step 5：`faster-whisper` 实验线

- 只在开发者模式暴露
- 不纳入默认正式包
- 用于和 `whisper.cpp` 做准确率 / 时延 / 资源占用对比

## 配置建议

### `local_whisper_cpp`

建议配置项：

- `enabled`
- `packaged`
- `binaryPath`
- `modelPath`
- `modelName`
- `language`
- `threads`
- `useGpu`
- `autoDownloadModel`

### `local_faster_whisper`

建议配置项：

- `enabled`
- `packaged`
- `pythonPath`
- `workerScriptPath`
- `modelName`
- `computeType`
- `device`
- `language`

## 打包与分发建议

### macOS

首发只推荐支持：

- `local_whisper_cpp`

原因：

- 可直接打包原生 helper / CLI
- 与当前 macOS 语音功能路径最一致

### Windows / Linux

短期建议：

- 先只做能力矩阵占位
- 不默认把本地 STT 二进制直接打进包

中期再评估：

- 按平台独立打模型资源包
- 首次运行下载模型

### 模型分发策略

推荐顺序：

1. 包内不内置大模型，只内置 downloader
2. 首次启用时下载默认模型
3. 提供设置页可见的模型状态与大小
4. 支持用户手动指定本地模型路径

这样更符合：

- KISS：主包不被模型体积拖垮
- YAGNI：不在第一期就做多模型预装
- DRY：统一模型安装与状态展示逻辑

## TTS 侧建议

TTS 继续用阿里云 `Qwen3-TTS`，不建议在本期再引入本地 TTS。

原因：

- 当前目标是先解决“本地输入隐私”而不是“整套完全离线”
- 高质量中文 TTS 仍以云端方案更稳妥
- 本地高质量 TTS 会显著增加模型管理与包体积复杂度

推荐默认：

- `tts.provider = cloud_aliyun`
- `tts.model = qwen3-tts-flash`
- 如果后续对低时延播报要求更高，再升级到 `qwen-tts` 或 `qwen-tts-realtime`

## 风险清单

### 风险 1：模型体积大

表现：

- 首次启用下载慢
- 占磁盘空间

缓解：

- 先用较小模型起步
- 设置页展示模型大小和状态
- 允许用户手动清理

### 风险 2：不同机器性能差异大

表现：

- 老设备转写慢
- 风扇噪音和功耗升高

缓解：

- 默认模型按平台分级
- 提供“性能优先 / 精度优先”配置

### 风险 3：Electron 打包复杂度提升

表现：

- helper 权限
- 沙箱与路径问题
- 二进制签名问题

缓解：

- 首期只做 macOS
- 二进制与模型下载器分离
- 打包前做 provider 产物校验

### 风险 4：本地 STT 与 wake_input 语义混淆

表现：

- 用户以为本地 STT 也能替代后台唤醒

缓解：

- 设置页明确标注：
  - `wake_input 仍需要系统原生能力`
  - `local STT 仅用于手动输入和自动续麦`

## 验收标准

### Phase 1

- `local_whisper_cpp` 可作为 `manual_stt` provider 选择
- 手动语音输入成功回填聊天框
- 自动续麦可成功回填并支持提交命令词
- 不影响现有 `macos_native` 和云端 provider

### Phase 2

- 支持模型下载、安装、删除、状态显示
- 打包版与开发版行为一致
- manifest 能准确标注：
  - provider 是否打包
  - 模型是否已安装

### Phase 3

- 评估是否增加常驻 worker
- 评估是否正式支持 `local_faster_whisper`

## 推荐结论

如果要把“本地 STT + 高质量云端 TTS”做成正式能力，最推荐的落地路线是：

1. 先做 `local_whisper_cpp`
2. 继续保留 `qwen3-tts-flash` 作为默认 TTS
3. 保持 `wake_input` 仍由 `macos_native` 承担
4. 等本地 STT 稳定后，再评估 `faster-whisper` 是否进入正式 provider 列表

这条路线最符合当前 QingShuClaw 的工程状态，也最容易与已完成的统一语音治理层衔接。

## 参考资料

- `whisper.cpp` 官方仓库：<https://github.com/ggml-org/whisper.cpp>
- `whisper.cpp` CLI 说明：<https://github.com/ggml-org/whisper.cpp/blob/master/examples/cli/README.md>
- `faster-whisper` 官方仓库：<https://github.com/SYSTRAN/faster-whisper>
- 阿里云 `Qwen-TTS` API：<https://help.aliyun.com/zh/model-studio/qwen-tts-api>
- 阿里云 `Qwen-TTS-Realtime` API：<https://help.aliyun.com/zh/model-studio/qwen-tts-realtime-api-reference/>

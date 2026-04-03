# 云端语音 Provider 方案梳理

## 目标

在不破坏当前 macOS 本地语音链路的前提下，统一梳理 QingShuClaw 后续可持续演进的云端语音能力路线，重点覆盖：

- 阿里云 STT / TTS 选型
- 火山引擎 STT / TTS 选型
- 与当前已落地统一语音治理层的衔接方式

## 当前代码状态

截至当前分支，已经落地：

- `cloud_openai`
  - 手动 STT
  - 自动续麦 STT
  - TTS
- `cloud_aliyun`
  - 手动 STT
  - 自动续麦 STT
  - TTS
- `cloud_volcengine`
  - 手动 STT
  - 自动续麦 STT
  - TTS

当前仍保持：

- `wake_input` 仅支持 `macos_native`
- 云端 STT 统一采用“前端录音结束后上传音频 -> 主进程转写”的最小可用链路
- 尚未引入云端流式 STT
- 尚未引入云端流式 TTS 播放

这套实现符合：

- KISS：先做单次录音转写，避免一开始就引入 WebSocket 双向流
- YAGNI：只落当前明确需要的手动语音输入和自动续麦，不提前做云端常驻唤醒
- DRY：三家云端 STT 共用同一套 renderer 录音链路与主进程能力矩阵

## 阿里云方案

### 推荐方案分层

#### 方案 A：Qwen-ASR + Qwen-TTS

推荐级别：最高  
适用场景：当前 QingShuClaw 最贴近的手动语音输入、自动续麦、助手回复朗读

优点：

- 与当前实现最匹配
- 官方支持 OpenAI 兼容接入，迁移成本低
- `Qwen-ASR` 支持同步识别，适合“录完再转写”
- `Qwen-TTS` 已经具备较自然的中文语音效果

局限：

- 不是最低时延方案
- 若后续要做边说边出字，仍需升级到实时接口

当前建议：

- STT 默认使用 `qwen3-asr-flash`
- TTS 默认使用 `qwen3-tts-flash`
- 作为阿里云首选通用接入路径

#### 方案 B：Qwen-ASR-Realtime + Qwen-TTS-Realtime

推荐级别：中高  
适用场景：未来如果要做“真正流式语音输入”“边识别边回填”“边播边说”

优点：

- 更适合低时延语音助手体验
- 更适合未来桌面常驻语音助手形态

局限：

- 接入复杂度显著高于同步接口
- 需要引入更稳定的会话管理、流状态机和断线恢复
- 前端和主进程都要补流式传输协议处理

当前建议：

- 暂不作为 Phase 1 / Phase 2 主链路
- 等现有 provider 稳定后，再单独开一期做“云端流式语音”

#### 方案 C：Paraformer / FunASR / CosyVoice / Sambert

推荐级别：中  
适用场景：成本敏感、传统语音能力、对大模型语境理解要求不高的场景

优点：

- 可覆盖传统语音识别和语音合成需求
- 在一些标准语音任务上性价比可能更好

局限：

- 与当前“统一 provider + 大模型语音体验”的产品方向不完全一致
- 对复杂上下文、语气自然度、对话一致性通常不如 Qwen 系列

当前建议：

- 暂不作为 QingShuClaw 默认方案
- 后续若需要“成本优化档位”，再加入为可选 provider

### 阿里云建议结论

短期推荐：

- STT：`Qwen-ASR`
- TTS：`Qwen-TTS`

中期升级：

- STT：`Qwen-ASR-Realtime`
- TTS：`Qwen-TTS-Realtime`

不建议当前直接投入：

- 先做 Paraformer / FunASR / Sambert 的多套并行接入

## 火山引擎方案

### 推荐方案分层

#### 方案 A：豆包语音识别大模型 + 语音合成大模型

推荐级别：最高  
适用场景：QingShuClaw 当前的手动 STT、自动续麦、助手朗读

优点：

- 官方已经按“大模型语音识别”和“语音合成大模型”提供清晰产品线
- 有录音文件识别和流式识别两种路径
- TTS 侧已有 HTTP Chunked / SSE / WebSocket 多种流式接口升级路径

局限：

- 若继续停留在“非流式上传转写”，时延体验仍受限
- 部分高质量音色和更强能力可能需要后续进一步筛选

当前建议：

- STT 继续使用“录音文件识别”路径作为默认方案
- TTS 继续使用当前已接入方案
- 后续若做更自然的边播边读，再升级到 SSE 或 WebSocket 单向流

#### 方案 B：流式语音识别 + 流式语音合成

推荐级别：高  
适用场景：需要更强实时性的桌面语音助手

优点：

- 更接近自然对话助手体验
- 可以和未来“自动续麦”“连续对话”“打断播放”结合

局限：

- 主进程会话控制复杂度更高
- 要处理更多边界状态：半句、超时、取消、重连、并发冲突

当前建议：

- 作为火山引擎下一阶段重点升级路线
- 优先级高于再扩更多传统非大模型语音接口

#### 方案 C：传统语音识别 / 传统语音合成

推荐级别：中  
适用场景：稳定批量转写、传统播报、成本控制

优点：

- 生态成熟
- 标准场景接入清晰

局限：

- 与 QingShuClaw 当前追求的“更自然、偏助手式”的体验不完全同向

当前建议：

- 非主推路径
- 除非后续明确需要低成本批处理方案

### 火山引擎建议结论

短期推荐：

- STT：豆包语音识别大模型中的录音文件识别
- TTS：语音合成大模型当前非流式或单向流式能力

中期升级：

- STT：大模型流式语音识别
- TTS：HTTP SSE / WebSocket 单向或双向流式

## 与当前统一治理层的衔接建议

### 1. Provider 层不再新增散落特判

所有新 provider 都应只通过以下入口接入：

- `VoiceCapabilityRegistry`
- `speech:transcribeAudio`
- `tts:speak`
- `voice-capabilities.json`

不要在 renderer 继续增加“按平台/按 provider 写死分支”的新特判。

### 2. 继续区分三类语音能力

必须继续拆开：

- `manual_stt`
- `follow_up_dictation`
- `wake_input`
- `tts`

不要把“云端 STT 可用”错误扩展成“云端 wake_input 可用”。

### 3. 流式升级单独开一期

后续若要做：

- 实时边说边出字
- 连续语音对话
- 边播边打断
- 语音播报和继续说话并存

应单独新增一期“流式语音会话层”，不要直接在当前“录音后转写”链路上堆逻辑。

## 推荐实施顺序

1. 先稳定当前三家云端 provider 的非流式 STT/TTS。
2. 再补 provider 级别测试与错误码归一。
3. 之后优先把火山引擎升级到流式 STT/TTS。
4. 阿里云流式能力作为第二优先级。
5. 最后再评估是否引入更传统、偏低成本的语音模型族。

## 外部参考

阿里云官方：

- Qwen-ASR API 参考：<https://help.aliyun.com/zh/model-studio/qwen-asr-api-reference>
- 语音识别总览：<https://help.aliyun.com/zh/model-studio/speech-recognition-api-reference/>
- Qwen-TTS API：<https://help.aliyun.com/zh/model-studio/qwen-tts-api>
- 语音合成总览：<https://help.aliyun.com/zh/model-studio/speech-synthesis-api-reference/>
- Qwen-TTS-Realtime API：<https://help.aliyun.com/zh/model-studio/qwen-tts-realtime-api-reference/>

火山引擎官方：

- 豆包语音产品简介：<https://www.volcengine.com/docs/6561/163032>
- 语音识别大模型产品简介：<https://www.volcengine.com/docs/6561/1354871>
- 语音合成文档总览：<https://www.volcengine.com/docs/6561/1354862>
- 语音合成大模型流式接口：<https://www.volcengine.com/docs/6561/1598757>

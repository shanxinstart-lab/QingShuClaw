# Markdown 表格流式结束后渲染失败修复 Spec

## 问题描述

用户在 Cowork 对话中，AI 回复包含 GFM 表格时，**流式输出期间表格渲染正常，但消息结束后表格变为 markdown 原始字符串**（管道符 `|` 以纯文本形式显示）。该问题概率性出现，历史记录中同样显示为损坏状态。

### 现象

- 流式期间：表格正确渲染为 HTML `<table>`
- 消息结束后：表格退化为 `<p>| 维度 | 优点 | 缺点 |...</p>`
- 重新加载会话（历史记录）：表格仍然损坏
- 概率性触发，多并发会话时更易复现

---

## 根因分析

系统中存在两条文本提取路径：

| 路径 | 函数 | 数据源 | 格式保真度 |
|------|------|--------|-----------|
| Agent 流 | `extractOpenClawAssistantStreamText` | agent event 的 `text` 字段（单一完整字符串） | ✅ 完整保留原始格式 |
| Chat 事件 | `extractGatewayMessageText` → `collectTextChunks` | chat message 的 `content` 数组（可能多个 text block） | ❌ 每个 block 做 `.trim()` 后用 `\n` join |

当 OpenClaw gateway 将响应内容拆分为多个 text block，且拆分点恰好落在 GFM 表格对齐行内部时：

```
原始（agent 流）:  |------|------|------|    （3列，有效 GFM）
拆分后（chat 事件）: |------|------\n------|  （对齐行被断行，无效 GFM）
```

`remark-gfm` 解析器因对齐行列数与表头不匹配而拒绝将其识别为表格，回退为段落渲染。

### 破坏路径

1. **`handleChatDelta`**：使用 `extractGatewayMessageText` 提取文本，覆写 `turn.currentAssistantSegmentText`，将 agent 流设置的正确值替换为损坏值
2. **`handleChatFinal`**：`finalSegmentText || previousSegmentText` 优先使用 `finalSegmentText`（同样来自 `extractGatewayMessageText`），将损坏内容写入 SQLite 并发送给渲染器

### 为什么流式期间正常

流式期间渲染器接收的内容来自 `processAgentAssistantText` → `throttledEmitMessageUpdate`，使用的是 agent 流的原始 `text` 字段，格式完好。`handleChatDelta` 虽然在内存中破坏了 segment text，但不执行 IPC emit，因此渲染器不受影响——直到 `handleChatFinal` 读取被破坏的值并发送给渲染器。

---

## 解决方案

### 修复 1：`handleChatDelta` — 防止覆写

当 agent 事件路径已激活时（`agentAssistantTextLength > 0`），不再允许 chat delta 覆写 `turn.currentAssistantSegmentText`：

```typescript
if (turn.assistantMessageId && segmentText !== previousSegmentText) {
  if (turn.agentAssistantTextLength === 0) {
    turn.currentAssistantSegmentText = segmentText;
  }
}
```

- agent 事件存在时：跳过覆写，保留格式正确的值
- 无 agent 事件时（纯 chat 模型）：仍允许更新，保持兼容

### 修复 2：`handleChatFinal` — 优先使用 agent 流文本

```typescript
const persistedSegmentText = previousSegmentText || finalSegmentText;
```

- `previousSegmentText`：来自 agent 流（`processAgentAssistantText` 设置），格式保真
- `finalSegmentText`：来自 chat.final 消息（`extractGatewayMessageText`），可能损坏
- 仅当 `previousSegmentText` 为空时 fallback 到 `finalSegmentText`

同时移除冗余的 store 读取和条件 emit：
- `flushPendingStoreUpdate` 后 store 内容即为最新，无需再 `getSession` + `find`
- 无条件 `emit('messageUpdate')` 确保渲染器收到最终版本

---

## 涉及文件

| 文件 | 变更 |
|------|------|
| `src/main/libs/agentEngine/openclawRuntimeAdapter.ts` | `handleChatDelta` 添加 guard；`handleChatFinal` 调整文本优先级 |

---

## 验证方法

### 功能验证

1. 启动开发服务，创建 Cowork 会话
2. 发送提示词引导 AI 生成包含表格的回复（如"总结 OpenClaw 优缺点，用表格"）
3. 验证：
   - 流式期间表格正确渲染 ✓
   - 消息结束后表格仍然正确 ✓
   - 退出会话后重新进入，历史记录中表格正确 ✓
4. 并发 6 个会话同时测试，确认高并发下表格不损坏

### 回归验证

| 场景 | 预期 |
|------|------|
| 无 tool call 的纯文本表格回复 | 正常渲染 |
| 有 tool call 后生成表格（多 segment） | 正常渲染 |
| 纯 chat 模型（无 agent event） | 仍能正常显示流式内容 |
| 长表格（10+ 行） | 正常渲染，无截断 |
| 包含 emoji/粗体/链接的表格 | 格式正确 |

---

## 已知边界

1. 若模型通过 chat 事件返回的文本与 agent 流文本**语义不同**（非格式差异），当前方案优先使用 agent 流版本。在实际场景中两者内容一致，仅格式（whitespace）可能不同。
2. 对于完全没有 agent 事件的模型，`handleChatDelta` 仍允许更新 segment text，此时若 gateway 拆分 block 导致损坏，该路径无法修复。但当前 OpenClaw 架构下所有模型均同时发送 agent 和 chat 事件。
3. `extractGatewayMessageText` 的 `collectTextChunks` trim+join 行为本身未修改，其他使用该函数的场景（如 `extractGatewayHistoryEntries` 历史摘要）不受影响——这些场景不需要保真 GFM 格式。

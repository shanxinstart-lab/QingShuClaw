# QingShuClaw 青数模块化接入阶段收尾结论

## 1. 当前结论

截至当前阶段，这一轮“青数能力模块化接入”已经可以认为达到阶段性收尾条件。

原因如下：

- 正式链路已经具备稳定的主进程宿主、catalog、governance service 与只读 IPC
- 开发态治理入口已经形成完整闭环，覆盖 skill、agent、bundle 三个层级
- 模块关闭与 `sharedToolsEnabled=false` 的降级行为已有代码级验证
- debug bundle 草稿不会写回正式 `Agent` 请求，已通过 helper 与单测锁定
- 文档、验收清单、阶段总结已经补齐，便于继续演进

当前分支：

- `qingshu-dev-alive`

## 2. 本阶段最终边界

### 2.1 已进入正式链路的能力

当前以下能力属于正式链路：

- `QingShu Extension Host`
- `shared tool catalog summary`
- `skill dependency parser`
- `skill dependency validator`
- `contract generator`
- `governance service`
- 只读 IPC：
  - `skills:governance:analyzeById`
  - `skills:governance:analyzeFiles`
  - `skills:governance:getCatalogSummary`
- `Agent.toolBundleIds` 数据层兼容

### 2.2 仍保持开发态的能力

当前以下能力仍保持开发态：

- skill 详情治理预览入口
- skill 导入前本地治理分析入口
- agent Skills 页签治理摘要
- agent bundle 只读展示块
- agent bundle 本地草稿调试选择器
- agent Skills 页签调试说明块

### 2.3 明确不进入正式保存的内容

当前明确不会进入正式持久化的内容：

- agent Skills 页签中的 `debugToolBundleIds`
- 由 debug bundle 草稿驱动的治理联动结果
- skill 导入前的本地治理分析状态
- skill 详情治理预览的临时查看状态

## 3. 已锁定的关键风险点

### 3.1 模块关闭后错误暴露能力

当前已通过主进程测试锁定：

- module 关闭后不暴露 shared tools
- `sharedToolsEnabled=false` 时不暴露 bundles
- governance 在 catalog 为空时 fail closed

### 3.2 开发态草稿误写回正式 Agent

当前已通过 renderer helper 与测试锁定：

- `AgentCreateModal` 正式请求统一走 `buildPersistedCreateAgentRequest`
- `AgentSettingsPanel` 正式请求统一走 `buildPersistedUpdateAgentRequest`
- debug bundle 草稿不会写入正式 payload

### 3.3 agent 治理摘要口径漂移

当前已通过摘要层测试锁定：

- bundle 去重与排序
- `missingBundles` 计算
- `declaredToolRefs` 汇总
- `issueCount / declaredSkillCount` 统计

## 4. 当前自动化覆盖摘要

### 4.1 主进程

已覆盖：

- `host.test.ts`
- `config.test.ts`
- `sharedToolCatalog.test.ts`
- `skillDependencies.test.ts`
- `skillDependencyValidator.test.ts`
- `skillGovernance.test.ts`
- `governanceService.test.ts`
- `agentBundles.test.ts`
- `coworkStore.agent.test.ts`

### 4.2 Renderer

已覆盖：

- `agentPersistedDraft.test.ts`
- `qingshuGovernanceSummary.test.ts`

当前 renderer 层仍以低成本纯函数 / helper 测试为主，没有引入额外的 UI 组件测试负担，这符合当前阶段目标。

## 5. 当前剩余风险

当前仍存在但可接受的风险主要有以下几类：

### 5.1 开发态 UI 仍依赖人工回归

虽然数据与摘要层已有自动化保护，但以下部分仍主要依赖手工验证：

- 开发态治理入口显示位置
- Skills 页签说明块的易理解程度
- bundle 草稿切换时的视觉反馈

### 5.2 正式 bundle 编辑入口尚未产品化

当前虽然数据层已经支持 `toolBundleIds`，但：

- 没有正式的产品化编辑入口
- 没有正式的保存时 bundle 校验 UI
- 没有正式的“缺失 bundle 阻止保存”产品策略

这不是 bug，而是当前阶段刻意保留的边界。

### 5.3 skill 级强隔离仍未实现

当前依然没有：

- skill 级 runtime tool ACL
- skill 命中后的动态 runtime tool 收缩

如果未来要走到这一步，应单独开启下一阶段设计，而不是在当前治理入口上继续叠补丁。

## 6. 下一阶段推荐顺序

如果继续推进，建议按如下顺序演进：

1. 新增正式的 Agent bundle 编辑入口
2. 将正式 bundle 编辑入口接到真实 `toolBundleIds` 保存链路
3. 视产品策略决定是否在保存时增加 bundle 兼容提示或阻断
4. 仅在确实有强隔离需求时，再考虑 skill 级 runtime ACL

## 7. 当前阶段建议

当前最合理的建议是：

- 将这一轮视为“治理基础设施完成”
- 停止继续扩展开发态 debug 入口
- 若继续投入，转入“正式 bundle 产品化入口设计”

也就是说，当前阶段更适合从“搭治理底座”切换到“做正式产品入口”，而不是继续在 debug 区堆叠更多能力。

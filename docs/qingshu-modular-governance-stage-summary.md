# QingShuClaw 青数模块化接入阶段总结

## 1. 当前阶段结论

截至当前阶段，`QingShuClaw` 已经完成一轮“青数能力以可插拔、模块化方式接入”的基础设施建设，并且边界已经比较清晰：

- 正式链路侧：
  - 已具备宿主层、catalog、governance service、只读 IPC、Agent 数据层兼容
- 开发态侧：
  - 已具备 skill 治理预览、导入前本地治理分析、agent bundle 调试区、agent 技能治理联动
- 安全边界侧：
  - 已验证模块关闭时可以安全降级
  - 已通过代码层 helper 明确禁止把 debug bundle 草稿写回正式请求

当前状态适合继续向“正式 bundle 编辑能力”演进，但不建议直接复用现有 debug selector，而应新开正式入口。

## 2. 已完成的关键能力

### 2.1 主进程基础设施

已完成：

- `qingshuModules` 宿主层
- feature flag 解析
- shared tool catalog summary
- skill dependency 解析
- skill dependency validator
- contract generator
- governance service
- 只读 IPC：
  - `skills:governance:analyzeById`
  - `skills:governance:analyzeFiles`
  - `skills:governance:getCatalogSummary`

### 2.2 Renderer 治理入口

已完成：

- skill 详情治理预览
- skill 导入前本地治理分析
- agent 技能治理摘要
- agent 已保存 bundles 只读展示
- agent 本地草稿 bundles 调试选择器
- agent Skills 页签开发态说明块

### 2.3 边界与收口

已完成：

- 文档化总览说明
- 手工验收 checklist
- debug bundle 草稿不写回正式请求的 helper 与单测

## 3. 当前自动化覆盖

### 3.1 主进程

当前已覆盖的重点测试包括：

- `src/main/qingshuModules/host.test.ts`
- `src/main/qingshuModules/sharedToolCatalog.test.ts`
- `src/main/qingshuModules/skillDependencies.test.ts`
- `src/main/qingshuModules/skillDependencyValidator.test.ts`
- `src/main/qingshuModules/skillGovernance.test.ts`
- `src/main/qingshuModules/governanceService.test.ts`
- `src/main/qingshuModules/agentBundles.test.ts`
- `src/main/coworkStore.agent.test.ts`

### 3.2 Renderer

当前已新增的低成本关键测试包括：

- `src/renderer/components/agent/agentPersistedDraft.test.ts`
- `src/renderer/services/qingshuGovernanceSummary.test.ts`

它们分别锁定了：

- debug bundle 草稿不会写回正式 Agent 请求
- agent governance summary 的 dedupe / missing bundle / issue count 口径稳定

## 4. 当前仍有意保留为开发态的能力

以下能力当前仍建议保持开发态：

- Agent bundle 调试选择器
- Skills 页签中的开发态说明块
- Skill 导入前本地治理分析入口
- Skill 详情中的治理预览入口

原因：

- 当前这些入口主要面向治理与调试
- 尚未完成正式产品化交互设计
- 当前运行时仍以“agent 级 / bundle 级 / governance 提示”为边界

## 5. 当前不建议立即做的事

当前阶段不建议直接做：

- 复用 debug selector 作为正式 bundle 配置入口
- 在 skill 级做 runtime ACL
- 在会话过程中动态按 skill 命中切换 runtime 可见 tools

原因：

- 会增加运行时复杂度
- 容易破坏当前稳定边界
- 不符合这一阶段的 `KISS / YAGNI`

## 6. 继续产品化的推荐顺序

若后续要继续推进，推荐顺序如下：

1. 先新增正式的 Agent bundle 编辑入口
2. 再把 bundle 编辑入口接到正式 `toolBundleIds` 保存链路
3. 之后再考虑更细粒度的治理提示或绑定校验
4. 若未来确实需要更强隔离，再单独设计 skill 级 runtime ACL

## 7. 当前阶段是否可以收尾

当前阶段可以认为已经达到“阶段性可收尾”状态，理由如下：

- 正式链路已有稳定基础设施
- 开发态调试入口边界明确
- 模块关闭降级行为已验证
- 文档与验收清单已补齐
- 关键风险点已有自动化保护

当前更适合进入下一阶段：

- 从“治理基础设施建设”转向“正式产品化入口设计”

# QingShuClaw 青数模块化接入与治理边界说明

## 1. 文档目标

本文用于收敛当前 `QingShuClaw` 在“青数能力模块化接入”这一轮开发中的统一口径，明确以下边界：

- 哪些能力已经进入正式链路
- 哪些能力仅作为开发态治理入口存在
- 哪些模块和能力默认关闭
- 关闭 QingShu module 后系统如何降级
- 当前验收应重点关注哪些不回归项

本文对应当前分支：

- `qingshu-dev-alive`

## 2. 总体设计原则

本轮实现严格遵循以下原则：

- `KISS`：新增独立模块与只读入口，不改旧主链路
- `YAGNI`：先做治理、摘要、调试入口，不提前做正式的 bundle 配置产品化
- `SOLID`：认证、catalog 汇总、skill 依赖分析、agent 治理提示、开发态调试入口分层
- `DRY`：skill 治理与 agent 治理复用同一套 governance service / summary 口径

落地策略固定为：

- 新增模块
- 默认不启用
- 只追加，不替换
- 失败时单模块降级，不阻断应用主流程

## 3. 当前正式链路

以下能力已经属于当前系统的正式链路。

### 3.1 QingShu Extension Host

主进程已具备统一宿主层，用于加载和汇总青数模块：

- `src/main/qingshuModules/host.ts`
- `src/main/qingshuModules/config.ts`
- `src/main/qingshuModules/index.ts`

宿主职责包括：

- 读取 module feature flags
- 注册模块
- 汇总共享 tools
- 汇总 bundles
- 生成 shared tool catalog

### 3.2 Shared Tool Catalog 与 Governance Service

主进程已具备正式的共享工具摘要与治理服务能力：

- `src/main/qingshuModules/sharedToolCatalog.ts`
- `src/main/qingshuModules/skillDependencies.ts`
- `src/main/qingshuModules/skillDependencyValidator.ts`
- `src/main/qingshuModules/contractGenerator.ts`
- `src/main/qingshuModules/skillGovernance.ts`
- `src/main/qingshuModules/governanceService.ts`

这些能力负责：

- 从模块宿主生成共享 tool catalog summary
- 解析 `SKILL.md` frontmatter 中的依赖声明
- 校验 `toolBundles / toolRefs / capabilityRefs`
- 生成 markdown / json contract
- 形成统一 governance result

### 3.3 正式只读 IPC

目前已经存在的正式只读 IPC 包括：

- `skills:governance:analyzeById`
- `skills:governance:analyzeFiles`
- `skills:governance:getCatalogSummary`

这些接口均为只读分析接口，不写状态，不改配置。

### 3.4 正式数据结构扩展

当前 `Agent` 数据结构已正式支持：

- `toolBundleIds`

但当前这仍主要是数据层与宿主层能力对齐，不代表产品层已经开放正式编辑入口。

## 4. 当前开发态治理入口

以下能力目前只在开发环境中显示，仅用于调试和治理分析，不属于正式用户路径。

### 4.1 Skill 详情治理预览

位置：

- `src/renderer/components/skills/SkillsManager.tsx`
- `src/renderer/components/skills/QingShuGovernancePreview.tsx`

表现：

- 在开发环境下，已安装 skill 详情弹窗中显示“治理预览”按钮
- 可查看当前 skill 的依赖声明、校验结果、contract 摘要

边界：

- 只读
- 不改 skill 内容
- 不改启用/禁用/删除逻辑

### 4.2 Skill 导入前本地治理分析

位置：

- `src/renderer/components/skills/SkillsManager.tsx`

表现：

- 在开发环境下，新增技能菜单中可额外分析：
  - 本地 `SKILL.md`
  - 本地技能目录

边界：

- 只读
- 不替代原有导入动作
- 不影响 ZIP / 本地目录 / GitHub 导入主链路

### 4.3 Agent Skills 页签治理预览

位置：

- `src/renderer/components/agent/AgentSkillSelector.tsx`
- `src/renderer/components/agent/AgentSkillGovernancePreview.tsx`

表现：

- 在开发环境下，根据当前选中的 skills 展示：
  - 分析技能数
  - 已声明依赖技能数
  - 治理问题数
  - 依赖的 bundles
  - 缺失的 bundles
  - 声明的 tool refs

边界：

- 只读
- 不阻断保存
- 不改老 agent 默认行为

### 4.4 Agent Bundle 调试区

位置：

- `src/renderer/components/agent/AgentToolBundleReadOnlyPanel.tsx`
- `src/renderer/components/agent/AgentToolBundleDebugSelector.tsx`
- `src/renderer/components/agent/AgentToolBundleDebugGuide.tsx`

表现：

- 只读区展示真实已保存的 `toolBundleIds`
- 调试选择器展示当前页面本地草稿 bundles
- 治理摘要随草稿联动

边界：

- 只在开发环境显示
- 草稿不写回 `Agent`
- 不影响 `createAgent / updateAgent` 正式请求

## 5. 默认关闭的能力

当前以下能力都不是默认开启的正式产品能力。

### 5.1 QingShu module 默认关闭

模块开关由以下配置控制：

- `qingshuModules.<moduleId>.enabled`
- `qingshuModules.<moduleId>.sharedToolsEnabled`
- `qingshuModules.<moduleId>.builtInSkillsEnabled`

默认策略：

- module 默认可关闭
- shared tools 默认关闭
- built-in skills 默认关闭

### 5.2 Agent bundle 正式编辑入口默认关闭

虽然 `Agent` 已支持 `toolBundleIds` 字段，但当前没有开放正式产品化编辑入口。

当前页面中的 bundle 选择器仅属于：

- 开发态
- 本地草稿
- 非持久化

### 5.3 Skill 级运行时 ACL 默认不做

当前没有做：

- skill 级 tool runtime ACL
- skill 命中后动态重配 runtime tool visibility

当前边界仍是：

- agent 级
- bundle 级
- governance 级提示

## 6. 当前持久化与非持久化边界

### 6.1 会持久化的内容

当前会进入正式持久化的内容包括：

- `Agent.skillIds`
- `Agent.toolBundleIds`
- Skill 安装 / 启用 / 禁用状态
- QingShu module feature flags

### 6.2 不会持久化的内容

当前不会进入正式持久化的内容包括：

- Agent Skills 页签中的 debug bundle 草稿
- Skill 导入前的治理分析结果
- Skill 详情治理预览的临时查看状态
- Agent 治理摘要的临时联动结果

## 7. 模块关闭后的降级规则

这是当前实现中最重要的安全边界之一。

### 7.1 关闭 module

当某个 `QingShu module` 被关闭时：

- 宿主状态仍可保留 module status
- 但不会暴露其 shared tools
- 不会暴露其 tool bundles
- 不会生成对应可用 bundle 视图

### 7.2 sharedToolsEnabled = false

当 module 本身是启用状态，但 `sharedToolsEnabled = false` 时：

- module status 仍然为 `active`
- 但 `getEnabledSharedTools()` 为空
- `getEnabledToolBundles()` 为空
- shared tool catalog summary 中该模块 `sharedToolCount = 0`

### 7.3 governance fail closed

当 catalog 为空但 skill 仍声明依赖时：

- governance 不会误判为可用
- 会返回：
  - `tool_bundle_not_found`
  - `tool_ref_not_found`
  - `capability_ref_not_found`

这意味着关闭 module 后，治理层会安全降级，而不是拿旧结果冒充当前状态。

## 8. 当前主要文件

### 8.1 主进程

- `src/main/qingshuModules/types.ts`
- `src/main/qingshuModules/host.ts`
- `src/main/qingshuModules/config.ts`
- `src/main/qingshuModules/sharedToolCatalog.ts`
- `src/main/qingshuModules/skillDependencies.ts`
- `src/main/qingshuModules/skillDependencyValidator.ts`
- `src/main/qingshuModules/contractGenerator.ts`
- `src/main/qingshuModules/skillGovernance.ts`
- `src/main/qingshuModules/governanceService.ts`
- `src/main/main.ts`
- `src/main/preload.ts`

### 8.2 Renderer

- `src/renderer/services/qingshuGovernance.ts`
- `src/renderer/services/qingshuGovernanceSummary.ts`
- `src/renderer/types/qingshuGovernance.ts`
- `src/renderer/components/skills/QingShuGovernancePreview.tsx`
- `src/renderer/components/skills/SkillsManager.tsx`
- `src/renderer/components/agent/AgentSkillSelector.tsx`
- `src/renderer/components/agent/AgentSkillGovernancePreview.tsx`
- `src/renderer/components/agent/AgentToolBundleReadOnlyPanel.tsx`
- `src/renderer/components/agent/AgentToolBundleDebugSelector.tsx`
- `src/renderer/components/agent/AgentToolBundleDebugGuide.tsx`
- `src/renderer/components/agent/AgentCreateModal.tsx`
- `src/renderer/components/agent/AgentSettingsPanel.tsx`

## 9. 当前验收清单

### 9.1 正式链路不回归

- QingShu 登录与用户主链路不回归
- OpenClaw 主运行链路不回归
- SkillManager 安装 / 启停 / 删除主链路不回归
- 旧 Agent 创建 / 编辑 / 保存主链路不回归

### 9.2 开发态入口边界正确

- 所有 bundle / governance 调试入口仅开发环境可见
- 调试入口不改正式保存逻辑
- 本地草稿不会写入 `toolBundleIds`
- 调试入口关闭后不影响正常功能

### 9.3 模块关闭降级正确

- 关闭 module 后 shared tools 消失
- 关闭 module 后 bundle 列表消失
- governance 在 catalog 为空时 fail closed
- 其它 module 和正式功能不受影响

## 10. 下一步建议

在当前阶段，最合理的后续推进顺序是：

1. 继续把验收清单沉淀为更细的回归步骤
2. 若需要产品化 bundle 编辑，再新增正式入口，而不是复用当前 debug selector
3. 若未来需要更强隔离，再考虑 skill 级 runtime ACL 或专用 agent 边界

当前结论保持不变：

- 正式链路已经具备模块化宿主、governance service、只读 catalog 与数据层兼容
- 开发态已经具备 skill / agent / bundle 的治理调试入口
- 正式产品化 bundle 配置仍未开放，默认关闭

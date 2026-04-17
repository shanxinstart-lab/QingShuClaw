# 青数 Skill / Tool / Agent FAQ

## 1. 当前这套“青数内置 Agent / Skill / Tool”是什么关系？

- `Agent` 是运行入口与绑定关系的载体，决定当前会话默认加载哪些青数内置 skill 与 tool。
- `Skill` 是面向模型的业务编排说明，主要定义角色、约束、调用顺序、用户确认策略等。
- `Tool` 是可执行能力，当前第一批主要来自青数后端的 LBS 相关接口投影。
- 这三者都属于“青数内置池”，和本地自定义对象不是一套治理来源。

当前口径是：

- 青数内置对象：由青数后台统一管理，客户端只负责同步、展示、加载、运行。
- 本地自定义对象：继续由 QingShuClaw 本地管理，可编辑、可删除、可自定义。

界面与加载链路保持统一，只通过来源标签区分：

- `青数内置`
- `本地自定义`
- `预设`

## 2. “青数供需流量测试 Agent”的系统提示词和身份现在在哪里配置？

现在已经收口到后端 `qtb-data-platform`，客户端不再自行拼装。

后端配置落点：

- `ManagedAgentDescriptor` DTO：
  [/Users/wuyongsheng/workspace/projects/qtb-data-platform/chat/server/src/main/java/com/tencent/supersonic/chat/server/pojo/qingshu/ManagedAgentDescriptor.java](/Users/wuyongsheng/workspace/projects/qtb-data-platform/chat/server/src/main/java/com/tencent/supersonic/chat/server/pojo/qingshu/ManagedAgentDescriptor.java)
- managed agent 构造逻辑：
  [/Users/wuyongsheng/workspace/projects/qtb-data-platform/chat/server/src/main/java/com/tencent/supersonic/chat/server/service/QingShuManagedCatalogService.java](/Users/wuyongsheng/workspace/projects/qtb-data-platform/chat/server/src/main/java/com/tencent/supersonic/chat/server/service/QingShuManagedCatalogService.java)

客户端消费落点：

- shared 类型定义：
  [/Users/wuyongsheng/workspace/projects/QingShuClaw/src/shared/qingshuManaged/types.ts](/Users/wuyongsheng/workspace/projects/QingShuClaw/src/shared/qingshuManaged/types.ts)
- managed catalog 映射：
  [/Users/wuyongsheng/workspace/projects/QingShuClaw/src/main/qingshuManaged/catalogService.ts](/Users/wuyongsheng/workspace/projects/QingShuClaw/src/main/qingshuManaged/catalogService.ts)

当前行为：

- 后端下发 `systemPrompt`
- 后端下发 `identity`
- 客户端直接透传到 managed agent
- OpenClaw 同步时写入 agent workspace 的 `SOUL.md` 与 `IDENTITY.md`

对应同步逻辑在：

- [/Users/wuyongsheng/workspace/projects/QingShuClaw/src/main/libs/openclawConfigSync.ts](/Users/wuyongsheng/workspace/projects/QingShuClaw/src/main/libs/openclawConfigSync.ts)

## 3. 为什么之前会看到“系统提示词出现在聊天消息区”？

根因不在 Agent 面板，而在 OpenClaw 历史同步链路。

之前网关历史里的 `role = system` 条目会被客户端重新灌回会话 UI；当青数内置 Agent 的 system prompt 被网关记录进历史时，前端就把它当普通 system message 显示出来了。

已修复位置：

- [/Users/wuyongsheng/workspace/projects/QingShuClaw/src/main/libs/agentEngine/openclawRuntimeAdapter.ts](/Users/wuyongsheng/workspace/projects/QingShuClaw/src/main/libs/agentEngine/openclawRuntimeAdapter.ts)

当前处理策略：

- 过滤 LobsterAI/OpenClaw 内部注入的 system prompt 痕迹
- 与当前 session `systemPrompt` 重合的历史 system entry 不再显示到 UI
- 仍保留真正需要给用户看的 system / error 提示

## 4. 为什么会出现“骑手”这个说法？

结论是：不是某一行代码把它硬编码成“骑手助手”，而是之前多层业务语义叠加后，模型容易自行往“骑手”这个具体场景收敛。

已确认的来源包括：

- 客户端品牌文案长期带有“灵工打卡”语境
- LBS 相关历史 skill / tool / 数据模型本身是“灵工供需 / 招工 / 人才分布”语境
- 测试 skill 之前只强调“供需流量”，没有把“供给”和“需求”的业务定义写死

当前已经收口为明确口径：

- “供给” = 灵工人员供给情况
- “需求” = 商家的灵活用工需求
- 除非用户明确要求，否则不要默认泛化为“骑手”

这一约束现在主要写在：

- managed skill prompt
- managed agent system prompt
- managed agent identity

## 5. “青数供需流量测试 Agent”下的 skill 管理里，应该显示哪些信息？

当前已经改为显示详细信息，而不只是 skillId/toolName 标签。

对 `Skill` 显示：

- 名称
- `skillId`
- 描述
- `policyNote`（如果有）

对 `Tool` 显示：

- `toolName`
- 描述
- `policyNote`（如果有）

UI 落点：

- [/Users/wuyongsheng/workspace/projects/QingShuClaw/src/renderer/components/agent/AgentSettingsPanel.tsx](/Users/wuyongsheng/workspace/projects/QingShuClaw/src/renderer/components/agent/AgentSettingsPanel.tsx)

## 6. 青数内置 Skill 存放在哪里？

青数内置 skill 不是只存在后端内存，而是客户端下载后安装到本地 `SKILLs` 目录。

技能根目录解析逻辑：

- [/Users/wuyongsheng/workspace/projects/QingShuClaw/src/main/skillManager.ts](/Users/wuyongsheng/workspace/projects/QingShuClaw/src/main/skillManager.ts)

当前本机实际路径：

- `~/Library/Application Support/LobsterAI/SKILLs`

当前测试 skill 的实际目录：

- [/Users/wuyongsheng/Library/Application Support/LobsterAI/SKILLs/qingshu-lbs-supply-demand-test](/Users/wuyongsheng/Library/Application%20Support/LobsterAI/SKILLs/qingshu-lbs-supply-demand-test)

目录内容通常包括：

- `SKILL.md`
- `README.md`
- `_meta.json`

## 7. `qingshu-lbs-supply-demand-test` 是怎么安装到本地的？

它走的是“后台生成安装包，客户端下载并解压”的链路，不是写死在客户端仓库里。

### 后端生成

后端会动态生成 zip 包，里面至少包含：

- `SKILL.md`
- `README.md`

后端接口与逻辑：

- skill 包下载接口：
  `/api/qingshu-claw/managed/skills/{skillId}/package`
- 生成逻辑：
  [/Users/wuyongsheng/workspace/projects/qtb-data-platform/chat/server/src/main/java/com/tencent/supersonic/chat/server/service/QingShuManagedCatalogService.java](/Users/wuyongsheng/workspace/projects/qtb-data-platform/chat/server/src/main/java/com/tencent/supersonic/chat/server/service/QingShuManagedCatalogService.java)

### 客户端同步

客户端先拉 managed catalog，再根据 `packageUrl` 下载并安装。

同步入口：

- [/Users/wuyongsheng/workspace/projects/QingShuClaw/src/main/qingshuManaged/catalogService.ts](/Users/wuyongsheng/workspace/projects/QingShuClaw/src/main/qingshuManaged/catalogService.ts)

安装入口：

- [/Users/wuyongsheng/workspace/projects/QingShuClaw/src/main/skillManager.ts](/Users/wuyongsheng/workspace/projects/QingShuClaw/src/main/skillManager.ts)

核心流程：

1. 登录成功后触发 managed catalog 同步
2. 拉取 `/api/qingshu-claw/managed/agents`
3. 再拉每个 agent 的 `/skills` 与 `/tools`
4. 对允许使用的 skill 调用 `syncManagedSkillPackage()`
5. 根据 `packageUrl` 下载 zip
6. 解压到本地 `SKILLs/<skillId>/`
7. 写入 `_meta.json`
8. 刷新技能列表与 Agent 列表

## 8. `qingshu-lbs-supply-demand-test` 的生命周期是怎样的？

### 8.1 首次安装

触发条件：

- 用户已登录
- managed catalog 同步成功
- skill `allowed = true`
- 本地尚未安装同名 managed skill

结果：

- 下载 zip
- 解压到本地 `SKILLs`
- 写入 managed metadata

### 8.2 正常使用

使用时特点：

- 在技能管理页里显示为“青数内置”
- 只读，不可本地编辑、删除、任意升级
- 可被青数内置 Agent 绑定并加载

### 8.3 升级

触发条件：

- 后台 `version` 高于本地版本

结果：

- 客户端执行升级逻辑
- 保留 managed metadata
- 用后台新包覆盖旧版本内容

### 8.4 无变化

如果后台版本不高于本地版本：

- 本地保持现状
- catalog 仍会刷新，但 skill 包不会重复覆盖

### 8.5 禁用或无权限

如果 skill 目录还在，但当前 catalog 判定：

- `allowed = false`
- 或后端未继续下发该 skill

当前客户端策略是：

- 不会把它变成可编辑本地 skill
- 继续按 managed 元数据识别
- 是否加载由最新 catalog / agent 绑定关系决定

### 8.6 失败处理

如果下载、解压或升级失败：

- 当前同步不会阻塞整个应用启动
- 会记录 warning
- 旧版本目录会尽量保留

## 9. `_meta.json` 里记录了什么？

当前 managed skill 至少会记录这些字段：

- `sourceType = qingshu-managed`
- `readOnly = true`
- `backendSkillId`
- `backendAgentIds`
- `packageUrl`
- `version`
- `catalogVersion`
- `installedBy = qingshu-sync`
- `toolRefs`
- `policyNote`

作用：

- 识别它是“青数内置”而不是本地自定义
- 约束只读行为
- 记录来源与版本
- 支撑后续升级判断

## 10. 为什么青数内置 Skill / Agent 不能编辑和删除？

这是当前架构的明确边界。

原因：

- 青数内置对象的真源在青数后台
- 客户端只负责同步与执行
- 如果允许本地改写，会破坏“后台统一治理”的前提

当前规则：

- 可查看
- 可加载使用
- 不可编辑
- 不可删除
- 不可改绑定

## 11. 退出登录为什么之前会报错？

之前青数登录适配器在退出时，会请求两个服务端地址：

- `/api/auth/logout`
- `/api/datachat/qingshu/auth/logout`

但当前后端并没有提供这两个接口，所以服务端会报：

- `No static resource api/auth/logout`
- `No static resource api/datachat/qingshu/auth/logout`

当前已调整为：

- 青数登录模式下，客户端退出时只清理本地桌面会话
- 不再调用这两个不存在的服务端退登地址

修复位置：

- [/Users/wuyongsheng/workspace/projects/QingShuClaw/src/main/auth/adapter.ts](/Users/wuyongsheng/workspace/projects/QingShuClaw/src/main/auth/adapter.ts)

## 12. 账密登录和飞书扫码登录在桌面端是否统一？

当前目标口径是“统一桌面会话”。

统一点：

- 都进入桌面端 `accessToken + refreshToken` 模型
- 都复用同一套 hydration 链路
- 都走同一套 quota / profile / models 获取逻辑

差异点：

- 飞书扫码登录可能附带更多主体上下文
- 账密登录默认代表平台用户桌面会话，不强制补齐插件主体 claims

## 13. 青数内置 Tool 是怎么运行的？

当前不是独立子进程，也不是直接让前端带 token 去调后端。

运行方式是：

- 主进程 managed catalog 服务把可用 tool 注册为本地 runtime
- 当前 server 名固定为 `qingshu-managed`
- 实际执行时，由主进程带当前登录态调用后端 `/api/qingshu-claw/managed/tools/{toolName}/invoke`

相关位置：

- [/Users/wuyongsheng/workspace/projects/QingShuClaw/src/main/qingshuManaged/catalogService.ts](/Users/wuyongsheng/workspace/projects/QingShuClaw/src/main/qingshuManaged/catalogService.ts)
- [/Users/wuyongsheng/workspace/projects/QingShuClaw/src/main/libs/mcpServerManager.ts](/Users/wuyongsheng/workspace/projects/QingShuClaw/src/main/libs/mcpServerManager.ts)

## 14. 第一批青数内置 Tool 包括哪些？

当前第一批主要是 LBS 供需流量相关工具：

- `claw.dictionary.search`
- `lbs.city.list`
- `lbs.city.analysis`
- `lbs.city.area-analysis`
- `lbs.city.h3`
- `lbs.city.h3-batch-analysis`
- `lbs.city.brand-list`
- `lbs.brand.bundle`
- `lbs.store.search`
- `lbs.store.suggest`
- `lbs.store.detail`
- `lbs.store.multi-radius`

其中：

- `claw.dictionary.search` 用于城市 / 品牌 / 门店名称标准化
- 其它工具主要用于城市、品牌、门店三级分析

补充说明：

- `claw.dictionary.search` 是当前 canonical tool name
- `lbs.dictionary.search` 仅作为历史兼容别名保留在后端，不应再作为新方案文档和客户端说明口径
- 城市 / 品牌 / 门店调用时应分别传 `dictionaryCode`：
  - `qingshu_city`
  - `qingshu_brand`
  - `qingshu_store`

## 14A. 青数内置 Tool 的“路径”分别是什么？

这块要分 3 层理解：

### 14A.1 后端接口路径

青数内置 tool 真正落到后端时，统一走：

- `POST /api/qingshu-claw/managed/tools/{toolName}/invoke`

也就是说：

- `toolName` 不是本地文件路径
- 它是 tool 的 canonical name，例如：
  - `claw.dictionary.search`
  - `lbs.city.analysis`
  - `lbs.brand.bundle`
  - `lbs.store.multi-radius`

这些名称最终都会映射成：

- `/api/qingshu-claw/managed/tools/{toolName}/invoke`

### 14A.2 QingShuClaw 主进程代码路径

青数内置 tool 在客户端主进程里的注册、目录同步、实际 invoke 入口，当前主要在：

- [/Users/wuyongsheng/workspace/projects/QingShuClaw/src/main/qingshuManaged/catalogService.ts](/Users/wuyongsheng/workspace/projects/QingShuClaw/src/main/qingshuManaged/catalogService.ts)

主进程初始化挂载入口在：

- [/Users/wuyongsheng/workspace/projects/QingShuClaw/src/main/main.ts](/Users/wuyongsheng/workspace/projects/QingShuClaw/src/main/main.ts)

### 14A.3 前端展示读取路径

前端展示 Agent 绑定的青数内置 tools，读的是 managed catalog：

- [/Users/wuyongsheng/workspace/projects/QingShuClaw/src/renderer/services/qingshuManaged.ts](/Users/wuyongsheng/workspace/projects/QingShuClaw/src/renderer/services/qingshuManaged.ts)
- [/Users/wuyongsheng/workspace/projects/QingShuClaw/src/renderer/components/agent/AgentSettingsPanel.tsx](/Users/wuyongsheng/workspace/projects/QingShuClaw/src/renderer/components/agent/AgentSettingsPanel.tsx)

因此，如果问“青数内置 tool 的路径是什么”，通常要先确认你问的是哪一层：

- 后端接口路径
- 主进程注册 / 调用代码路径
- 前端展示读取路径

## 15. 名称不标准时为什么一定要先字典搜索？

因为城市、品牌、门店名称经常存在：

- 非标准输入
- 同名 / 近似名
- 缩写 / 口语称呼

所以当前测试 skill 把这条链路设成了硬约束：

1. 先 `claw.dictionary.search`
2. 唯一高置信可自动采用
3. 多候选或低置信必须让用户确认
4. 未确认前不得直接进入分析 tool

这是为了避免：

- 错把错误城市当成正确城市
- 错把错误品牌 / 门店带入后续分析
- 最终生成看似合理、实际基于错误对象的结论

## 16. 这套青数内置池和本地自定义池后续怎么协同？

当前原则：

- 青数内置池：后台统一治理、客户端只读同步
- 本地自定义池：继续本地编辑与使用

后续可支持“申请入池”：

- 本地自定义 skill/tool/agent 先在本地验证
- 通过治理流程后，由后台生成正式内置对象
- 客户端再通过 managed catalog 同步为正式 `qingshu-managed`

当前 `v1` 不做自动发布，也不自动替换本地对象。

## 17. 最近几轮修复里，哪些问题已经确认处理？

已处理：

- managed Agent 的 `systemPrompt / identity` 改为后端统一下发
- 客户端不再自行拼装 managed Agent 的运行身份信息
- managed Agent 技能页增加 skill / tool 描述展示
- OpenClaw 历史同步不再把内部 system prompt 暴露到消息 UI
- 青数登录模式退出登录不再请求不存在的服务端 logout 接口
- `qingshu-lbs-supply-demand-test` 的供需口径已明确，不再默认泛化为“骑手”

## 18. 当前联调时，最值得优先验证什么？

建议优先验证下面几项：

1. 打开“青数供需流量测试 Agent”，检查基础信息页是否能看到后端下发的 `systemPrompt / identity`
2. 打开该 Agent 的技能页，检查 skill 与 tool 的描述是否完整展示
3. 新开一轮会话，确认系统提示词不再作为普通消息显示
4. 退出登录，确认客户端能正常回到未登录态，后端不再报 404/no resource
5. 重新同步 managed catalog，确认 `qingshu-lbs-supply-demand-test` 仍能正常安装与升级

## 19. 青数内置 Agent / Skill / Tool 现在有权限隔离吗？

有，而且当前已经形成了“后端判定 + 客户端锁定 + 主进程运行时兜底”的三层边界，但它不是一套独立权限体系，而是复用青数后台的统一能力判定。

当前统一口径：

- 后端是唯一权限源
- 客户端只消费 `allowed + policyNote`
- 主进程负责把权限结果落实到“是否安装、是否启用、是否暴露 runtime”

后端字段：

- `ManagedAgentDescriptor.allowed`
- `ManagedSkillDescriptor.allowed`
- `ManagedToolDescriptor.allowed`
- `policyNote`

后端相关位置：

- [/Users/wuyongsheng/workspace/projects/qtb-data-platform/chat/server/src/main/java/com/tencent/supersonic/chat/server/pojo/qingshu/ManagedAgentDescriptor.java](/Users/wuyongsheng/workspace/projects/qtb-data-platform/chat/server/src/main/java/com/tencent/supersonic/chat/server/pojo/qingshu/ManagedAgentDescriptor.java)
- [/Users/wuyongsheng/workspace/projects/qtb-data-platform/chat/server/src/main/java/com/tencent/supersonic/chat/server/pojo/qingshu/ManagedSkillDescriptor.java](/Users/wuyongsheng/workspace/projects/qtb-data-platform/chat/server/src/main/java/com/tencent/supersonic/chat/server/pojo/qingshu/ManagedSkillDescriptor.java)
- [/Users/wuyongsheng/workspace/projects/qtb-data-platform/chat/server/src/main/java/com/tencent/supersonic/chat/server/pojo/qingshu/ManagedToolDescriptor.java](/Users/wuyongsheng/workspace/projects/qtb-data-platform/chat/server/src/main/java/com/tencent/supersonic/chat/server/pojo/qingshu/ManagedToolDescriptor.java)
- [/Users/wuyongsheng/workspace/projects/qtb-data-platform/chat/server/src/main/java/com/tencent/supersonic/chat/server/service/QingShuManagedCatalogService.java](/Users/wuyongsheng/workspace/projects/qtb-data-platform/chat/server/src/main/java/com/tencent/supersonic/chat/server/service/QingShuManagedCatalogService.java)

当前客户端与主进程处理规则：

- `Agent`
  - 始终可见
  - 未登录时显示“登录后可用”
  - 已登录但 `allowed = false` 时显示“暂无权限”
  - 不允许切换使用
- `Skill`
  - 始终可见
  - `allowed = true` 时才允许下载安装包并启用
  - `allowed = false` 时显示为锁定能力，不允许启用
  - 如果之前装过、后来被收回权限，主进程会在 catalog 同步时强制禁用
- `Tool`
  - 始终可以在青数内置 Agent 详情里看到目录信息
  - 只有 `allowed = true` 的 tool 才会注册到本地 runtime
  - 后端 invoke 时仍会做最终鉴权

客户端相关位置：

- Agent 权限与锁定展示：
  [/Users/wuyongsheng/workspace/projects/QingShuClaw/src/renderer/components/agent/AgentsView.tsx](/Users/wuyongsheng/workspace/projects/QingShuClaw/src/renderer/components/agent/AgentsView.tsx)
- Agent 切换拦截：
  [/Users/wuyongsheng/workspace/projects/QingShuClaw/src/renderer/services/agent.ts](/Users/wuyongsheng/workspace/projects/QingShuClaw/src/renderer/services/agent.ts)
- Skill 锁定展示：
  [/Users/wuyongsheng/workspace/projects/QingShuClaw/src/renderer/components/skills/SkillsManager.tsx](/Users/wuyongsheng/workspace/projects/QingShuClaw/src/renderer/components/skills/SkillsManager.tsx)
- Skill 权限收口与虚拟投影：
  [/Users/wuyongsheng/workspace/projects/QingShuClaw/src/renderer/services/skill.ts](/Users/wuyongsheng/workspace/projects/QingShuClaw/src/renderer/services/skill.ts)
- 主进程 managed skill 权限应用：
  [/Users/wuyongsheng/workspace/projects/QingShuClaw/src/main/skillManager.ts](/Users/wuyongsheng/workspace/projects/QingShuClaw/src/main/skillManager.ts)
- 主进程 managed catalog 同步：
  [/Users/wuyongsheng/workspace/projects/QingShuClaw/src/main/qingshuManaged/catalogService.ts](/Users/wuyongsheng/workspace/projects/QingShuClaw/src/main/qingshuManaged/catalogService.ts)

## 20. 如果一个用户没有某些青数内置 Skill 的权限，现在会怎么处理？

当前处理已经不是“直接消失”，而是“可见但锁定”。

具体表现：

- 在 Skills 管理页里仍能看到该 skill
- skill 会带“暂无权限”标签
- 会显示后端下发的 `policyNote`
- 不会被下载安装为新的本地可用 skill
- 如果它之前已经装过，会被强制设为禁用
- 开关点击时不会真正启用，只会提示无权限原因

这是为了满足两个目标：

- 用户看得到有哪些青数内置能力，只是当前账号未开通
- 运行时不会因为本地残留目录而继续越权调用

## 21. 青数内置 Agent / Skill / Tool 在 QingShuClaw 中调用青数中台时，会自动带上授权 token 吗？

会，而且目前是主进程统一自动携带，不需要 skill 作者、tool 作者或前端页面手动拼 token。

但要注意：

- `Agent` 本身不直接发请求，它只是运行入口和绑定关系
- `Skill` 本身也不直接持有 token，它只是 prompt / 编排说明
- 真正需要自动带 token 的，是以下三条链路：
  - managed catalog 同步
  - managed skill 包下载
  - managed tool invoke

### 21.1 managed catalog 同步

触发时机：

- 登录成功后
- 主动同步青数内置目录时

调用链：

1. renderer `authService.applyAuthenticatedUser()`
2. 调 `qingshuManagedService.syncCatalog()`
3. IPC 到主进程 `qingshuManaged:syncCatalog`
4. 主进程 `QingShuManagedCatalogService.syncCatalog()`
5. 通过 `fetchWithAuth()` 拉：
   - `/api/qingshu-claw/managed/agents`
   - `/api/qingshu-claw/managed/agents/{agentId}/skills`
   - `/api/qingshu-claw/managed/agents/{agentId}/tools`

关键点：

- 主进程先从当前 auth adapter 取 `accessToken`
- 自动写入：
  - `Authorization: Bearer <accessToken>`
  - `auth: Bearer <accessToken>`
- 如果收到 `401`，会自动尝试 `refreshToken()` 后重试一次

代码位置：

- [/Users/wuyongsheng/workspace/projects/QingShuClaw/src/renderer/services/auth.ts](/Users/wuyongsheng/workspace/projects/QingShuClaw/src/renderer/services/auth.ts)
- [/Users/wuyongsheng/workspace/projects/QingShuClaw/src/renderer/services/qingshuManaged.ts](/Users/wuyongsheng/workspace/projects/QingShuClaw/src/renderer/services/qingshuManaged.ts)
- [/Users/wuyongsheng/workspace/projects/QingShuClaw/src/main/qingshuManaged/catalogService.ts](/Users/wuyongsheng/workspace/projects/QingShuClaw/src/main/qingshuManaged/catalogService.ts)

### 21.2 managed skill 包下载

触发时机：

- 某个青数内置 skill `allowed = true`
- 本地未安装，或后台版本高于本地版本

调用链：

1. `QingShuManagedCatalogService.syncCatalog()`
2. 对允许安装的 skill 调 `SkillManager.syncManagedSkillPackage()`
3. `SkillManager` 根据 `packageUrl` 下载 zip
4. 如果是 `/api/qingshu-claw/managed/` 路径，会自动在下载请求头里补 token

自动携带方式：

- 从本地 `auth_tokens` 读取当前 `accessToken`
- 自动写入：
  - `Authorization: Bearer <accessToken>`
  - `auth: Bearer <accessToken>`

代码位置：

- [/Users/wuyongsheng/workspace/projects/QingShuClaw/src/main/skillManager.ts](/Users/wuyongsheng/workspace/projects/QingShuClaw/src/main/skillManager.ts)

### 21.3 managed tool invoke

这是最关键的一条，因为真正的青数业务能力调用都落在这里。

调用链：

1. 青数内置 Agent 绑定本地青数内置 skill
2. 会话运行时，模型根据 skill 指令决定调用某个青数内置 tool
3. 主进程 `QingShuManagedCatalogService.registerLocalToolRuntime()` 把允许使用的 tool 注册成一个本地 runtime server
4. server 名固定为 `qingshu-managed`
5. tool 实际执行时走 `invokeManagedTool()`
6. 主进程统一请求：
   `POST /api/qingshu-claw/managed/tools/{toolName}/invoke`

自动携带方式：

- 主进程通过当前 auth adapter 取 `accessToken`
- 自动写入：
  - `Authorization: Bearer <accessToken>`
  - `auth: Bearer <accessToken>`
- 如遇 `401`，自动 refresh 后重试一次

代码位置：

- [/Users/wuyongsheng/workspace/projects/QingShuClaw/src/main/qingshuManaged/catalogService.ts](/Users/wuyongsheng/workspace/projects/QingShuClaw/src/main/qingshuManaged/catalogService.ts)

补充说明：

- 如果你想查“tool 路径”而不是“调用链路”，看上面的 `14A. 青数内置 Tool 的“路径”分别是什么？`
- [/Users/wuyongsheng/workspace/projects/QingShuClaw/src/main/libs/mcpServerManager.ts](/Users/wuyongsheng/workspace/projects/QingShuClaw/src/main/libs/mcpServerManager.ts)

## 22. 这套“自动带青数授权 token”的机制，和其他 tool 调用有什么区别？

区别非常明确。

### 青数内置 Tool

特点：

- 认证统一在主进程
- token 不暴露给 skill 文本
- token 不需要前端手工传递
- token 不需要用户自己配置到某个 MCP server
- 主进程自动处理：
  - 取 token
  - 带请求头
  - 401 刷新
  - 重试

这意味着：

- skill 作者只需要写“什么时候调用哪个 tool”
- 不需要处理 token 生命周期
- 不会出现多个 skill 各自复制一套青数鉴权代码

### 其他本地 / 自定义 Tool

大体分三类：

- 本地执行类：
  - `exec`
  - browser
  - 文件系统
  - 这类通常不需要青数 token
- 通用 MCP / 第三方服务类：
  - 认证方式由各自 server 或配置自己负责
  - 不走青数统一 auth adapter
- 本地自定义 skill 引导的工具：
  - 主要依赖 OpenClaw 原生工具或已有 MCP server
  - 默认不会自动获得青数平台 token

所以当前最关键的差异就是：

- 青数内置 tool：主进程统一带青数桌面登录态
- 非青数内置 tool：各走各的认证方式，不共享这套青数 token 注入链路

这也是当前推荐把青数业务能力做成“青数内置 managed tool”而不是散落到各个自定义 skill / 自定义 MCP 里的核心原因之一。

## 23. 为什么青数内置 Agent 对话时，UI 里曾经会把 `## Local Time Context` 和 `[Current user request]` 显示成“我的输入”？

这是一个 OpenClaw 历史回读链路里的展示污染问题，不是模型真的收到错请求。

实际链路分成两层：

- 发给模型的 outbound prompt
  - 客户端会在真实用户输入外层包一层上下文
  - 例如：
    - `## Local Time Context`
    - `[Current user request]`
- UI / 本地会话展示
  - 正常应该只展示用户原始输入
  - 不应该把这层模型增强包装再回显给用户

之前的问题在于：

- OpenClaw 网关历史里会保留包装后的 user message
- QingShuClaw 在某些历史抽取 / 对齐路径里直接用了这段文本
- 没有先把包装 prompt 还原成真实用户输入

所以用户会在界面里看到：

- `## Local Time Context`
- `[Current user request]`
- 以及后面跟着的真实请求

而不是只看到自己的原始输入。

现在的修复方式是：

- 保留 outbound prompt 包装，继续给模型做时间上下文增强
- 但在 OpenClaw 历史抽取层统一做一次“用户消息归一化”
- 对 `role = user` 的历史消息：
  - 去掉 metadata 前缀
  - 去掉 `[Current user request]` 之前的包装内容
- 对 `assistant` / `system` 消息不做这类裁剪

这样修复后：

- 模型侧能力不受影响
- UI 只显示用户真实输入
- 本地 session store 不会再被包装 prompt 污染
- 历史恢复 / 会话重载时也会保持一致

代码落点：

- [/Users/wuyongsheng/workspace/projects/QingShuClaw/src/main/libs/openclawHistory.ts](/Users/wuyongsheng/workspace/projects/QingShuClaw/src/main/libs/openclawHistory.ts)
- [/Users/wuyongsheng/workspace/projects/QingShuClaw/src/main/libs/agentEngine/openclawRuntimeAdapter.ts](/Users/wuyongsheng/workspace/projects/QingShuClaw/src/main/libs/agentEngine/openclawRuntimeAdapter.ts)
- [/Users/wuyongsheng/workspace/projects/QingShuClaw/src/main/libs/openclawHistory.test.ts](/Users/wuyongsheng/workspace/projects/QingShuClaw/src/main/libs/openclawHistory.test.ts)

## 24. 为什么在青数内置 Agent 对话里安装 `ppt-generator` 后，会落到 `workspace-qingshu-managed/skills`，而不是出现在 QingShuClaw 的“已安装技能”列表？

这是因为当前存在两条不同的 skill 安装链路。

### QingShuClaw 正式安装链路

这条链路由 `SkillManager` 管理：

- 安装入口：
  - 技能页“安装/导入”
  - 主进程 `skills:download`
- 安装目录：
  - `app.getPath('userData')/SKILLs`
- UI 表现：
  - 会出现在 QingShuClaw 的“已安装技能”列表
  - 可被 `SkillManager` 扫描、启用、禁用、升级、删除

### OpenClaw workspace 临时安装链路

当用户在对话里要求 agent：

- 检查 SkillHub
- 安装 CLI
- 执行 skill 安装命令

这类动作本质上是 agent 在自己的 OpenClaw workspace 里执行命令。

对青数内置 Agent 来说，它当前使用的是自己的 agent workspace，例如：

- `/Users/wuyongsheng/Library/Application Support/LobsterAI/openclaw/state/workspace-qingshu-managed`

所以第三方安装命令把 skill 装进：

- `/Users/wuyongsheng/Library/Application Support/LobsterAI/openclaw/state/workspace-qingshu-managed/skills/ppt-generator`

这不是 `SkillManager` 的主安装根，因此不会自动进入 QingShuClaw 的“已安装技能”列表。

### 当前可以怎么理解

可以把它理解成：

- `userData/SKILLs`
  - QingShuClaw 正式托管技能
- `workspace-*/skills`
  - 某个 agent / workspace 的临时本地技能

二者当前没有自动合并。

## 25. 是否有必要做“对话内安装自动桥接到 SkillManager”？

当前不建议直接做“任意对话安装命令自动桥接”。

原因有三点：

### 1. 安全边界会被打穿

如果模型在对话里执行任意 SkillHub / CLI 安装命令后，就自动写入 QingShuClaw 正式技能目录，会把：

- 第三方来源判断
- 安全扫描
- 用户确认
- 安装审计

这几层边界变得模糊。

而 `SkillManager.downloadSkill(...)` 这条链路当前是有明确扫描与确认逻辑的。

### 2. 语义上“试装”和“正式安装”不应该混在一起

在 workspace 里装 skill，更像：

- 当前 agent 的实验性依赖
- 会话级 / workspace 级能力补充

而进正式技能列表意味着：

- 被应用正式托管
- 可长期复用
- 可参与启停、升级、治理

这两个语义不应默认等价。

### 3. 泛化自动桥接容易被 prompt 驱动误触发

如果只因为模型说“安装一下这个技能”，系统就自动把结果纳入正式技能池，后续很容易出现：

- 来源不清
- 版本不清
- 安装成功但用户并不想长期保留

### 推荐方案

推荐做法不是“自动桥接”，而是“受控桥接”：

1. 对话中若检测到 workspace 安装 skill
2. UI 明确提示它是“工作区临时技能”
3. 如用户需要正式纳入 QingShuClaw 技能体系，再提供一个显式动作：
   - “导入为正式安装”
4. 该动作最终走 `SkillManager.downloadSkill(...)` 或等价的受控安装链路

也就是说：

- `v1` 应先做识别和提示
- 后续若要正式收口，再做“显式确认后的桥接导入”

## 26. 青数内置 Agent 现在是否允许加入 QingShuClaw 里已经安装的其他 skills？

当前不允许。

当前青数内置 Agent 的规则是：

- 可查看后端下发的内置 skills / tools
- 可加载使用
- 不可本地编辑
- 不可删除
- 不可改绑定

也就是说它现在是一个只读 managed agent。

在实现上，青数内置 Agent 的技能页走的是只读展示分支，只展示：

- 青数内置 skills
- 这些 skill 绑定的青数内置 tools

不会出现普通 Agent 那种可编辑的 `AgentSkillSelector`。

因此当前不能像普通 Agent 一样，把本地已安装的其他 skills 再追加绑定到青数内置 Agent 上。

### 如果后续要支持，推荐怎么做

推荐支持“只追加、不删内置”的模型，而不是把青数内置 Agent 完全放开成可编辑。

比较稳的做法是：

- 后端下发的内置 `skillIds` 作为基线
- 客户端只允许追加一个本地 `extraSkillIds`
- 保存时只写本地附加层
- 展示时合并为：
  - `managedSkillIds + extraSkillIds`

同时保持约束：

- 不能移除后端下发的 managed skills
- 不能改动 managed tools 绑定
- 只能补充本地已安装且已启用的 skills

这样既保住“青数内置池”的权威性，也能让青数内置 Agent 适度复用 QingShuClaw 现有技能生态。

## 27. 青数内置 Agent 现在支持追加 QingShuClaw 本地已安装的 skills 吗？

现在支持，但规则是“只追加，不改内置基线”。

当前实现规则：

- 青数后台下发的内置 skills 仍然是基线
- 客户端允许在青数内置 Agent 的技能页里追加本地已启用 skills
- 保存时只会持久化一层本地 `extraSkillIds`
- 最终运行时使用的是：
  - `managedBaseSkillIds + managedExtraSkillIds`

### 不能做的事

- 不能删除青数后台下发的内置 skills
- 不能修改青数内置 tools 绑定
- 不能追加未启用或不存在的本地 skill

### 额外保护

如果某个本地追加 skill 后续被：

- 禁用
- 删除

它会自动从青数内置 Agent 的可用 skill 合并结果中消失，不会继续被当作活跃能力使用。

## 28. QingShuClaw 客户端包现在的更新机制是怎样的？

当前已经切到“品牌运行时配置驱动”的更新机制，不再把更新地址、协议地址、强更阈值长期硬编码在客户端里。

整体原则是：

- `KISS`：继续复用现有弹窗、下载、安装 IPC，不重造一套 Electron 原生自动更新器
- `YAGNI`：第一阶段只做运行时配置下发、自动检查、手动检查、强更控制，不额外做后台管理界面
- `DRY`：协议、更新、强更共用一份品牌运行时配置

### 28.1 配置从哪里来？

客户端启动后会优先读取本地缓存的品牌运行时配置；随后再向青数后端刷新最新配置。

当前入口：

- 运行时配置接口：
  `/api/qingshu-claw/runtime-config`
- 客户端默认读取与缓存逻辑：
  [/Users/wuyongsheng/workspace/projects/QingShuClaw/src/renderer/services/brandRuntime.ts](/Users/wuyongsheng/workspace/projects/QingShuClaw/src/renderer/services/brandRuntime.ts)

本地缓存 key：

- `brand_runtime_config_cache`

这份配置里目前包含两大块：

- `agreement`
- `update`

其中 `update` 至少包含：

- `enabled`
- `autoCheckUrl`
- `manualCheckUrl`
- `fallbackDownloadUrl`
- `pollIntervalMs`
- `heartbeatIntervalMs`
- `forceUpdate`
- `minimumSupportedVersion`
- `forceReason`

### 28.2 自动检查更新什么时候触发？

当前自动检查是“启动即检查 + 心跳节流 + 窗口恢复补检”三段式。

触发规则：

1. 应用初始化完成后先尝试检查一次
2. 之后按 `heartbeatIntervalMs` 做心跳检测
3. 当窗口从后台恢复可见时，也会补做一次检测
4. 但真正发请求前，会先看距离上次检查是否已超过 `pollIntervalMs`

也就是说：

- 心跳不是每次都打更新接口
- 只有超过轮询间隔，才会真的请求更新元数据

对应实现：

- [/Users/wuyongsheng/workspace/projects/QingShuClaw/src/renderer/App.tsx](/Users/wuyongsheng/workspace/projects/QingShuClaw/src/renderer/App.tsx)
- [/Users/wuyongsheng/workspace/projects/QingShuClaw/src/renderer/services/appUpdate.ts](/Users/wuyongsheng/workspace/projects/QingShuClaw/src/renderer/services/appUpdate.ts)

本地节流 key：

- `app_update_last_checked_at`

默认口径是：

- 心跳周期 30 分钟
- 真正更新轮询周期 12 小时

## 29. 当前青数内置 Skill 是如何通过 OSS 管控，并与 SkillHub 控制台和 QingShuClaw 安装链路打通的？

当前已经收口成一条“控制台发布 -> 运行时 catalog 下发 -> QingShuClaw 自动安装/升级”的闭环。

整体原则是：

- `KISS`：先打通当前唯一的青数内置 skill，不一次性重做整套内置池发布系统
- `YAGNI`：先只做 skill 的制品构建、发布和客户端消费，不提前扩展成多对象发布编排
- `DRY`：继续复用现有 managed catalog、现有 `SkillManager.syncManagedSkillPackage()`、现有 zip 安装逻辑

### 29.1 当前控制台里管的是哪个 Skill？

当前只打通了一个青数内置 Skill：

- `qingshu-lbs-supply-demand-test`

控制台页面：

- `/qingshu-skillhub/skills`

当前页面上已经支持：

- `构建制品`
- `发布当前版本`

对应前端代码：

- [/Users/wuyongsheng/workspace/projects/qtb-data-platform/webapp/packages/supersonic-fe/src/pages/QingShuSkillHub/Skills/index.tsx](/Users/wuyongsheng/workspace/projects/qtb-data-platform/webapp/packages/supersonic-fe/src/pages/QingShuSkillHub/Skills/index.tsx)

### 29.2 发布后，状态存在哪里？

当前为了先打通最小闭环，发布状态还没有落正式数据库，而是先落本地 JSON 文件。

默认状态文件：

- `~/.supersonic/qingshu-skillhub/managed-skill-publications.json`

可配置目录：

- `qingshu.skillhub.state-dir`

状态服务代码：

- [/Users/wuyongsheng/workspace/projects/qtb-data-platform/chat/server/src/main/java/com/tencent/supersonic/chat/server/qingshu/skillhub/service/QingShuManagedSkillPublicationStateService.java](/Users/wuyongsheng/workspace/projects/qtb-data-platform/chat/server/src/main/java/com/tencent/supersonic/chat/server/qingshu/skillhub/service/QingShuManagedSkillPublicationStateService.java)

里面记录的关键信息包括：

- `version`
- `catalogVersion`
- `packageUrl`
- `packageChecksum`
- `packageSize`
- `manifestUrl`
- `releaseId`
- `releaseNotes`
- `publishedAt`

### 29.3 OSS / COS 是怎么接进去的？

当前采用的是 S3 兼容协议，不绑定某一家云厂商 SDK。

也就是说它可以接：

- 腾讯云 COS
- 阿里云 OSS 的 S3 兼容接入
- AWS S3
- MinIO

核心实现代码：

- [/Users/wuyongsheng/workspace/projects/qtb-data-platform/chat/server/src/main/java/com/tencent/supersonic/chat/server/qingshu/skillhub/service/impl/QingShuManagedArtifactStorageServiceImpl.java](/Users/wuyongsheng/workspace/projects/qtb-data-platform/chat/server/src/main/java/com/tencent/supersonic/chat/server/qingshu/skillhub/service/impl/QingShuManagedArtifactStorageServiceImpl.java)

关键配置：

- `qingshu.skillhub.enabled=true`
- `qingshu.skillhub.storage.provider=s3`
- `qingshu.skillhub.storage.s3.endpoint`
- `qingshu.skillhub.storage.s3.region`
- `qingshu.skillhub.storage.s3.bucket`
- `qingshu.skillhub.storage.s3.access-key`
- `qingshu.skillhub.storage.s3.secret-key`
- `qingshu.skillhub.storage.s3.public-base-url`
- `qingshu.skillhub.storage.s3.package-prefix`
- `qingshu.skillhub.storage.s3.manifest-prefix`
- `qingshu.skillhub.storage.s3.path-style-access`
- `qingshu.skillhub.storage.s3.public-read`

默认产物路径规则：

- zip:
  `managed-skills/packages/{skillId}/{version}/{skillId}-{version}.zip`
- manifest:
  `managed-skills/manifests/{skillId}/{version}/manifest.json`

### 29.4 SkillHub 控制台发布后，运行时 catalog 如何拿到新的包地址？

当前不是客户端直接读 SkillHub 发布记录，而是服务端 runtime managed catalog 优先读取“已发布状态”。

运行时 catalog 服务：

- [/Users/wuyongsheng/workspace/projects/qtb-data-platform/chat/server/src/main/java/com/tencent/supersonic/chat/server/service/QingShuManagedCatalogService.java](/Users/wuyongsheng/workspace/projects/qtb-data-platform/chat/server/src/main/java/com/tencent/supersonic/chat/server/service/QingShuManagedCatalogService.java)

发布管理服务：

- [/Users/wuyongsheng/workspace/projects/qtb-data-platform/chat/server/src/main/java/com/tencent/supersonic/chat/server/qingshu/skillhub/service/impl/QingShuManagedSkillAdminServiceImpl.java](/Users/wuyongsheng/workspace/projects/qtb-data-platform/chat/server/src/main/java/com/tencent/supersonic/chat/server/qingshu/skillhub/service/impl/QingShuManagedSkillAdminServiceImpl.java)

当前行为是：

1. 在 SkillHub 点击“构建制品”
2. 服务端根据当前 managed skill 生成 zip、checksum、manifest
3. 点击“发布当前版本”后，把 zip 和 manifest 上传到 OSS / COS
4. 将 `packageUrl / packageChecksum / version / catalogVersion` 写入 publication state
5. `QingShuManagedCatalogService` 后续返回 managed skill descriptor 时，优先读这份已发布状态
6. 因此客户端拿到的 `packageUrl` 就会从原来的 managed API 下载地址切换成真实 OSS 地址

### 29.5 QingShuClaw 这边需要改安装主链路吗？

当前不需要重写安装主链路，因为现有逻辑已经天然兼容 OSS `packageUrl`。

客户端关键代码：

- [/Users/wuyongsheng/workspace/projects/QingShuClaw/src/main/qingshuManaged/catalogService.ts](/Users/wuyongsheng/workspace/projects/QingShuClaw/src/main/qingshuManaged/catalogService.ts)
- [/Users/wuyongsheng/workspace/projects/QingShuClaw/src/main/skillManager.ts](/Users/wuyongsheng/workspace/projects/QingShuClaw/src/main/skillManager.ts)

实际调用链：

1. 登录后，主进程 `QingShuManagedCatalogService.syncCatalog()`
2. 拉取：
   - `/api/qingshu-claw/managed/agents`
   - `/api/qingshu-claw/managed/agents/{agentId}/skills`
3. 对 `allowed = true` 的 managed skill 调 `SkillManager.syncManagedSkillPackage()`
4. `SkillManager` 直接按 descriptor 里的 `packageUrl` 下载 zip
5. 解压到本地 `SKILLs/{skillId}`
6. 写入 `_meta.json`
7. 后续按 `version / packageChecksum / catalogVersion` 判断是否升级

### 29.6 下载时 token 是怎么处理的？

这里已经做了兼容分流：

- 如果 `packageUrl` 命中 `/api/qingshu-claw/managed/`
  - 会自动补：
    - `Authorization: Bearer <accessToken>`
    - `auth: Bearer <accessToken>`
- 如果 `packageUrl` 是 OSS / COS 公网地址或签名地址
  - 不额外带青数 token
  - 直接按普通远程 zip 下载

对应代码：

- [/Users/wuyongsheng/workspace/projects/QingShuClaw/src/main/skillManager.ts](/Users/wuyongsheng/workspace/projects/QingShuClaw/src/main/skillManager.ts)

关键方法：

- `syncManagedSkillPackage()`
- `downloadZipUrl()`
- `buildManagedDownloadHeaders()`

这也是为什么这次打通 OSS 后，QingShuClaw 不需要再单独改一套安装协议。

### 29.7 这次“OSS 管控打通”目前的边界是什么？

当前已经完成的是：

- SkillHub 控制台可以构建和发布当前内置 skill
- 后端可以把 zip / manifest 上传到 OSS / COS
- runtime managed catalog 能优先返回已发布的 `packageUrl`
- QingShuClaw 能直接消费这个新的 `packageUrl` 并安装/升级

当前还没有完成的是：

- 发布状态正式落数据库
- 多个 managed skill / agent / tool 的统一发布编排
- 控制台里的 rollback / current-version 管理
- 制品仓库的后台治理界面

所以当前口径更准确地说是：

- 已打通“单个青数内置 skill 的 OSS 发布最小闭环”
- 还没有完全演进成正式的多对象 SkillHub 发布平台

这两个值也都可由运行时配置覆盖。

### 28.3 手动检查更新和自动检查有什么区别？

手动检查由设置页触发，和自动检查的最大区别是“忽略节流，立即请求”。

当前行为：

- 自动检查命中更新后，只更新徽标和状态，不强行打断用户
- 手动检查命中更新后，会直接打开更新弹窗
- 手动检查若未发现更新，则给出“已是最新版本”这一类结果

手动检查入口 UI 在：

- [/Users/wuyongsheng/workspace/projects/QingShuClaw/src/renderer/components/Settings.tsx](/Users/wuyongsheng/workspace/projects/QingShuClaw/src/renderer/components/Settings.tsx)

更新弹窗在：

- [/Users/wuyongsheng/workspace/projects/QingShuClaw/src/renderer/components/update/AppUpdateModal.tsx](/Users/wuyongsheng/workspace/projects/QingShuClaw/src/renderer/components/update/AppUpdateModal.tsx)

### 28.4 客户端如何判断“有更新”？

当前客户端会请求更新元数据接口，并拿服务端返回的版本号与当前本地版本做比较。

核心判断逻辑：

- 服务端版本 `latestVersion` 必须大于本地版本
- 平台会按当前系统自动挑选下载地址：
  - mac Intel
  - mac Apple Silicon
  - Windows x64
- 如果对应平台包地址缺失，则回退到 `fallbackDownloadUrl`

当前版本比较与结果组装逻辑在：

- [/Users/wuyongsheng/workspace/projects/QingShuClaw/src/renderer/services/appUpdate.ts](/Users/wuyongsheng/workspace/projects/QingShuClaw/src/renderer/services/appUpdate.ts)

### 28.5 强制更新是怎么判定的？

现在强更有两种命中方式，满足任意一种即可：

1. 运行时配置里直接下发 `forceUpdate = true`
2. 当前客户端版本低于 `minimumSupportedVersion`

命中强更后，客户端行为会升级为阻断式：

- 自动检查命中后会直接弹出更新弹窗
- 普通关闭入口不可用
- 下载过程中不可取消
- 下载或安装失败时，只保留“重试 / 退出应用”

强更原因文案来自：

- `forceReason`

这部分实现分别在：

- [/Users/wuyongsheng/workspace/projects/QingShuClaw/src/renderer/services/appUpdate.ts](/Users/wuyongsheng/workspace/projects/QingShuClaw/src/renderer/services/appUpdate.ts)
- [/Users/wuyongsheng/workspace/projects/QingShuClaw/src/renderer/components/update/AppUpdateModal.tsx](/Users/wuyongsheng/workspace/projects/QingShuClaw/src/renderer/components/update/AppUpdateModal.tsx)

### 28.6 下载和安装是怎么走的？

更新下载和安装仍然由 Electron 主进程负责，renderer 只负责发起、展示进度和反馈结果。

当前主进程链路：

1. renderer 调 `appUpdate:download`
2. main 进程通过 `session.defaultSession.fetch(...)` 下载更新包
3. 下载过程按节流发送进度事件 `appUpdate:downloadProgress`
4. 下载完成后把文件落到系统临时目录
5. renderer 再调 `appUpdate:install`
6. main 按平台执行安装逻辑

主进程实现：

- IPC 入口：
  [/Users/wuyongsheng/workspace/projects/QingShuClaw/src/main/main.ts](/Users/wuyongsheng/workspace/projects/QingShuClaw/src/main/main.ts)
- 下载与安装实现：
  [/Users/wuyongsheng/workspace/projects/QingShuClaw/src/main/libs/appUpdateInstaller.ts](/Users/wuyongsheng/workspace/projects/QingShuClaw/src/main/libs/appUpdateInstaller.ts)

当前细节包括：

- 只允许同时存在一个下载任务
- 60 秒无数据会触发超时中断
- 取消下载会清理残留临时文件
- mac 走 `dmg` 挂载安装
- Windows 走安装包执行链路

### 28.7 如果服务端不直接给安装包地址怎么办？

当前支持回退到下载落地页。

也就是说，更新元数据里如果没有返回当前平台可直接下载的包地址，客户端会使用：

- `fallbackDownloadUrl`

此时客户端不会走内置下载器，而是改为打开浏览器，让用户去下载页完成获取。

当前青数侧的目标口径是：

- 更新元数据优先返回青数本地下载接口
- 青数本地下载接口再 302 到真实 OSS 包地址

这样客户端只认青数域名，不直接依赖外部 OSS 地址。

### 28.8 企业管控如何影响更新？

如果企业配置里开启了 `disableUpdate`，更新能力会整体被接管。

当前行为：

- 不自动检查
- 设置页不允许手动检查
- 不显示更新徽标
- 主进程会拒绝下载请求

对应的企业配置同步与拦截逻辑在：

- [/Users/wuyongsheng/workspace/projects/QingShuClaw/src/main/libs/enterpriseConfigSync.ts](/Users/wuyongsheng/workspace/projects/QingShuClaw/src/main/libs/enterpriseConfigSync.ts)
- [/Users/wuyongsheng/workspace/projects/QingShuClaw/src/renderer/App.tsx](/Users/wuyongsheng/workspace/projects/QingShuClaw/src/renderer/App.tsx)
- [/Users/wuyongsheng/workspace/projects/QingShuClaw/src/main/main.ts](/Users/wuyongsheng/workspace/projects/QingShuClaw/src/main/main.ts)

### 28.9 当前这套更新机制和老的 `endpoints.ts` 是什么关系？

结论是：现在以品牌运行时配置为准，`endpoints.ts` 里那组旧的更新地址已经不是主链路。

也就是说当前真正生效的是：

- `/api/qingshu-claw/runtime-config` 下发的 `update.autoCheckUrl`
- `/api/qingshu-claw/runtime-config` 下发的 `update.manualCheckUrl`
- `/api/qingshu-claw/runtime-config` 下发的 `update.fallbackDownloadUrl`

这也是后续开发环境切生产环境时更容易切换的原因：

- 优先改青数后端配置
- 客户端尽量不改代码

# 0420 认证与 Skill / Agent 管理梳理

## 1. 目标与范围

本次梳理聚焦两个问题：

1. 基于当前项目已有登录认证实现，以及 `skillManager` / cowork / OpenClaw / MCP bridge 相关代码，确定“skill / agent 能力接入认证态”的最小落地点。
2. 把青数内置 `agent`、`skill`、`tool` 的管理机制、能力暴露边界、调用流程整理清楚，并落实最小必要改动。

本次不做的事情：

- 不新建复杂权限中心。
- 不引入额外数据库表。
- 不重构既有 catalog 同步模型。
- 不改变本地自定义 agent / skill 的现有行为。

## 2. 两个方案

### 方案 A：只在前端展示层收口

做法：

- 在 renderer 里继续沿用现有 `auth.isLoggedIn`、`sourceType === 'qingshu-managed'`、`allowed === false` 的判断。
- 让青数内置 agent / skill 保持可见但锁定。
- 阻止用户点击切换、启用、选择。

优点：

- 改动最少。
- 短期接入成本低。

缺点：

- 只能收口“可见 / 可点”，不能真正收口“可执行”。
- 主进程 IPC、OpenClaw skill 暴露、MCP managed tool 注册仍可能绕过 UI。
- 判断散落在多个 renderer service / component 中，后续容易漂移。

原则取舍：

- `KISS`：表面简单，但只是把复杂性留在运行时，属于“假简单”。
- `YAGNI`：短期符合，但一旦要保证“不可执行”，马上不够。
- `SOLID`：认证判断耦合在页面与交互层，职责不干净。
- `DRY`：同一规则要在多个页面、多个入口重复写。

### 方案 B：共享访问态 + 前后端双收口

做法：

- 抽一层共享访问判断，只描述青数托管能力的访问状态：
  - `available`
  - `login_required`
  - `forbidden`
- renderer 继续用它控制可见 / 可点。
- main process 用它控制可执行。
- OpenClaw skill 暴露和 MCP managed tool 注册也接同一套判断。

优点：

- 能同时收口“可见 / 可点 / 可执行”。
- 规则只有一份，前后端一致。
- 对现有 catalog、skill meta、cowork 流程侵入小。

缺点：

- 比方案 A 多一层共享 helper。
- 需要把认证失效后的运行时收缩也补上。

原则取舍：

- `KISS`：只抽一个 access helper，没有引入权限子系统，复杂度可控。
- `YAGNI`：只覆盖当前明确需要的三类状态，没有提前抽象到角色体系。
- `SOLID`：把“认证态访问判断”从页面行为里独立出来，职责更单一。
- `DRY`：同一规则同时服务 renderer、IPC、OpenClaw、MCP。

### 推荐结论

推荐方案 B。

原因不是“更完整”而已，而是它是当前能把“未登录、token 失效、刷新失败时哪些能力可见、可点、可执行”一次说清楚的最小方案。它没有超出当前需求边界，但能避免 UI 收口、执行链路漏口的问题。

## 3. 最小落地点

本次选择的最小落地点有四个：

1. 共享访问判断
2. renderer 展示与交互门禁
3. main process 执行门禁
4. OpenClaw / MCP 运行时能力暴露门禁

对应改动如下。

### 3.1 共享访问判断

新增文件：

- `src/shared/qingshuManaged/access.ts`

职责：

- 统一判断某个能力是否属于青数托管能力。
- 根据 `sourceType`、`allowed`、`isLoggedIn` 计算访问状态。
- 为主进程返回统一错误码：
  - `QINGSHU_MANAGED_AUTH_REQUIRED`
  - `QINGSHU_MANAGED_FORBIDDEN`

这层是本次收口的核心。后续无论 UI、IPC 还是运行时，只要需要判断青数托管能力是否可用，都应复用这里，而不是各自再写一套 if。

### 3.2 skill meta 补齐 allowed

修改：

- `src/shared/qingshuManaged/types.ts`
- `src/main/skillManager.ts`

做法：

- 给 managed skill 的 `_meta.json` 元信息补充 `allowed` 字段。
- `SkillManager.parseSkillDir()` 读取时一并带出 `allowed`。
- `buildManagedSkillMeta()` 在 managed skill 同步时写入 `allowed`。

原因：

- 以前 managed skill 的“是否有权限”主要来自 catalog 合并结果，OpenClaw / 本地 skill 目录自身没有完整权限语义。
- 补齐后，skill 本地元数据、renderer 合并态、main process 判断态更一致。

这符合 `DRY`：同一份权限语义不再只存在于 catalog 临时合并结果里。

## 4. 本次实现的认证态能力边界

### 4.1 未登录时

#### 可见

- 青数内置 agent：可见
- 青数内置 skill：可见
- 青数内置 tool：用户不直接配置，但其说明仍可随 managed agent / skill 间接看到

#### 可点

- 青数内置 agent：不可切换
- 青数内置 skill：不可启用，不可加入本次对话
- 青数内置 agent 的“本地追加 skill”保存：不可执行

#### 可执行

- 使用青数内置 agent 发起 cowork：不可执行
- 带青数内置 skill 发起 / 继续 cowork：不可执行
- OpenClaw 暴露 managed skill：不暴露
- MCP bridge 注册 `qingshu-managed` 本地 server：不注册

### 4.2 已登录但无权限时

#### 可见

- 青数内置 agent / skill：可见

#### 可点

- 可查看，但带策略提示。
- 不可切换 managed agent。
- 不可启用 managed skill。
- 不可继续使用受限 managed 能力执行对话。

#### 可执行

- 与未登录相同，统一不可执行。

### 4.3 token 失效或刷新失败时

触发路径：

- managed API 请求返回 401
- `AuthAdapter.refreshToken()` 失败
- `onAuthSessionInvalidated('refresh-failed')`
- main process 调用 `clearLocalAuthSession()`

失效后收口行为：

- 清除本地 token
- 清除 server model metadata
- 通知 renderer `auth:sessionInvalidated`
- renderer 切回 `main`
- 清空 active skills
- 清空当前 cowork 会话
- 刷新 MCP bridge
- 重新同步 OpenClaw 配置
- 撤销 managed MCP tool 注册
- 让 OpenClaw managed skill 暴露按未登录态收缩

这里是这次改动最重要的部分之一：认证失效不再只是“前端显示退出登录”，而是运行时能力一起撤掉。

## 5. 具体实现点

### 5.1 renderer 层

#### `src/renderer/services/agent.ts`

职责：

- 统一按共享 access helper 计算 managed agent 当前访问态。
- `loadAgents()` 时决定 managed agent 是否真正 `enabled`。
- 当前正在使用的 managed agent 如果失去访问资格，则自动切回 `main`。
- `switchAgent()` 时统一拦截未登录 / 无权限状态。

结果：

- “看得到但锁住”和“能否切换”统一了。

#### `src/renderer/services/skill.ts`

职责：

- `loadSkills()` 合并 catalog 时统一计算 managed skill 的访问态。
- `setSkillEnabled()` 时统一拦截未登录 / 无权限状态。

结果：

- managed skill 的展示态和交互态一致。

#### `src/renderer/components/cowork/CoworkView.tsx`

职责：

- 在发起会话和继续会话前，对当前 agent 与本次选中的 skill 做一次本地预检。
- 若检测到 managed 能力不可用，直接 toast 提示，不再进入 start / continue 调用链。

结果：

- 用户体验更直接。
- 避免不必要地创建临时 session 或发送 IPC。

#### `src/renderer/services/cowork.ts`

职责：

- 识别 main process 返回的 managed capability error code。
- 将其映射为用户可理解的提示文案，而不是通用报错。

结果：

- “登录后可用”和“暂无权限”能在会话失败提示中说清楚。

### 5.2 main process 层

#### `src/main/main.ts`

新增能力：

- `hasQingShuAuthSession()`
- `buildManagedCapabilityDeniedResult()`
- `resolveCoworkManagedCapabilityDeniedResult()`

接入点：

- `agents:update`
- `cowork:session:start`
- `cowork:session:continue`
- `clearLocalAuthSession()`
- `OpenClawConfigSync` 的 `getSkillsList`

结果：

- 即使绕过 renderer，managed 能力也不能直接执行。
- token 失效后运行时配置会立即收缩。

### 5.3 catalog / MCP 层

#### `src/main/qingshuManaged/catalogService.ts`

改动：

- `QingShuManagedCatalogService` 新增 `isAuthenticated()` 依赖。
- `registerLocalToolRuntime()` 在未登录时直接 `unregisterLocalServer('qingshu-managed')`。

结果：

- managed tool 不再只是“前端看不到”，而是真的不被 MCP bridge 暴露。

## 6. 青数内置 agent / skill / tool 管理机制

### 6.1 agent 管理机制

来源：

- 后端 managed catalog 提供 managed agent 描述。
- 本地 `AgentManager` 负责把“本地 agent + managed agent”合并成统一列表。

特点：

- managed agent 只读。
- 当前仅允许为 managed agent 追加“本地已启用 skill”。
- 不允许改写 managed agent 的基础字段。
- 不允许移除 managed baseline skills。

这符合 `YAGNI`：只支持当前真实需要的“本地补充技能”，不扩展到本地改写 managed agent 本体。

### 6.2 skill 管理机制

来源：

- 本地 skill：来自 `SKILLs/`
- managed skill：catalog 提供描述后，通过 `SkillManager.syncManagedSkillPackage()` 同步到本地 skill 目录

特点：

- managed skill 在本地仍以 skill 目录存在，便于统一被 OpenClaw 加载。
- 但其 source meta 标记为：
  - `sourceType = qingshu-managed`
  - `readOnly = true`
  - `allowed = ...`
- 前端与运行时都据此判断是否可用。

### 6.3 tool 管理机制

来源：

- managed tool 同样由 catalog 提供描述。
- catalog service 把它们注册为 MCP 本地 server：`qingshu-managed`

特点：

- 用户不直接在 cowork 页面选择 tool。
- tool 由 managed skill / managed agent 间接使用。
- 是否暴露给 OpenClaw，不由前端 UI 决定，而由 main process 注册逻辑决定。

这次的关键改动就是把它也纳入认证态控制。

## 7. 青数内置能力调用流程

### 7.1 catalog 同步流程

1. 用户登录成功
2. renderer `authService` 进入 authenticated session
3. 后台触发 `qingshuManagedService.syncCatalog()`
4. main process `QingShuManagedCatalogService.syncCatalog()` 拉取 managed agents / skills / tools
5. `SkillManager.applyManagedSkillAccess()` / `syncManagedSkillPackage()` 更新本地 skill 元信息与包
6. renderer 重新加载 skills / agents
7. 若 bridge 已启动，则刷新 MCP bridge 与 OpenClaw 配置

### 7.2 发起 cowork 会话流程

1. 用户在 renderer 选中 agent / skill
2. `CoworkView` 本地预检访问态
3. 通过后调用 `cowork:startSession`
4. main process 再次校验 managed agent / skill 访问态
5. 通过后创建 session
6. `CoworkEngineRouter` 路由到 `yd_cowork` 或 `openclaw`
7. 若是 OpenClaw，则它只会看到当前认证态允许暴露的 managed skills / managed tools

### 7.3 会话继续流程

1. 用户继续提问
2. `CoworkView` 先校验当前 active skills
3. main process 再校验当前 session 所属 agent 与本次追加 skill
4. 通过后才进入 runtime

### 7.4 token 失效流程

1. managed 请求 401
2. `AuthAdapter.refreshToken()` 尝试刷新
3. 刷新失败
4. 触发 `clearLocalAuthSession()`
5. renderer 退出登录态
6. OpenClaw / MCP bridge 收缩 managed 能力暴露

## 8. 本次改动的工程原则评估

### KISS

做到了：

- 没有新建权限中心。
- 没有加新的数据库状态表。
- 只抽一个共享 access helper。

需要警惕：

- 如果以后继续出现“不同 managed 能力有不同登录源 / 不同授权策略”，不能继续在这个 helper 上无节制加分支，要及时升维。

### YAGNI

做到了：

- 只覆盖当前明确要求的三种状态：未登录、无权限、可用。
- 没有提前抽象角色、租户、能力组策略树。

### SOLID

做到了：

- 访问判断从页面层抽离。
- UI、IPC、运行时分别消费同一个判断结果。

### DRY

做到了：

- renderer 与 main process 不再各写一套 managed 可用判断。
- managed skill 的 `allowed` 不再只存在 catalog 临时态里，也进入本地 meta。

## 9. 风险与后续建议

### 已控制的风险

- UI 锁住但 runtime 仍可执行：已收口
- token 失效后 OpenClaw / MCP 继续持有 managed 能力：已收口
- managed agent / skill 判断在多个入口漂移：已明显收敛

### 仍存在的风险

1. 当前 `hasQingShuAuthSession()` 只判断本地是否还有 access token，不主动验证 token 是否实时有效。
2. managed tool 的权限仍以“登录态 + catalog allowed”为主，若未来需要更细粒度的运行中二次鉴权，可能要把校验再前移到 tool invoke 层。
3. 当前整个仓库存在大量历史 lint warning / error，不能用整仓 lint 作为本次改动有效性的唯一依据。

### 建议的下一步

1. 给 managed capability error code 增加统一的 i18n key，而不是在 service 中手动映射。
2. 在 `SkillsPopover` / active skill badge 层再补一层“不可加入对话”的显式视觉提示，减少用户误解。
3. 给本次 access helper 增加单测，锁定三态行为。
4. 若后续青数内置 tool 需要单独展示，可继续复用同一 access helper，不要重新发明判断语义。

## 10. 本次结论

本次最小落地点不是“多加几个未登录判断”，而是把青数托管能力的访问态抽成一份共享语义，并同时约束：

- renderer 的可见 / 可点
- main process 的可执行
- OpenClaw 的 skill 暴露
- MCP bridge 的 managed tool 注册

这样才能真正把“未登录、token 失效或刷新失败时，哪些能力可见、可点、可执行”一次收口清楚。

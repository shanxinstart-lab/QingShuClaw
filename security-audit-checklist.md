# 敏感信息审计清单

## 1. 目的

本文用于审计当前分支 `qingshu-dev` 相对 `origin/main` 的差异，以及当前工作区未提交改动中，是否包含会被误提交到 Git 的敏感信息。

适用范围：

- 当前分支已提交差异
- 当前工作区未提交改动
- 与认证、打包、配置、文档、品牌资源相关的高风险文件

审计时间：

- 2026-04-02

## 2. 本次审计结论

### 2.1 结论摘要

本次更严格扫描后，**未发现明显会被提交的真实敏感凭据**，包括但不限于：

- 真实 `appId` / `appSecret`
- 真实 `clientId` / `clientSecret`
- 真实 `apiKey`
- 真实 `accessToken` / `refreshToken`
- 私钥块
- JWT 令牌
- 带账号密码的 URL
- 常见云厂商 / Git 平台 / Slack 等真实 token 格式

### 2.2 当前已发现但不属于“真实秘密”的内容

以下内容会被命中关键词，但不属于应阻断提交的真实凭据：

- 字段名、类型名、参数名：
  - `appId`
  - `appSecret`
  - `apiKey`
  - `accessToken`
  - `refreshToken`
- 文案与说明性描述：
  - token 流程说明
  - bridge ticket 流程说明
  - 配置项说明
- 占位符与测试值：
  - `sk-test`
  - `sk-xxx`
  - `sk-lobsterai-local`
- 本地默认地址：
  - `http://localhost:9080`
  - `http://localhost:9080/webapp`

### 2.3 当前最容易被误判的项

- [electron-builder.json](/Users/wuyongsheng/workspace/projects/QingShuClaw/electron-builder.json) 中的 `appId`
  - 当前值是 `com.lobsterai.app`
  - 这是应用包标识，不是 secret
- [src/common/auth.ts](/Users/wuyongsheng/workspace/projects/QingShuClaw/src/common/auth.ts) 中的默认青数地址
  - 是默认开发地址，不是凭据
- [docs/qingshu-auth-bridge-overview.md](/Users/wuyongsheng/workspace/projects/QingShuClaw/docs/qingshu-auth-bridge-overview.md) 中关于 token 的说明
  - 描述的是机制，不是实际 token
- [src/main/auth/adapter.ts](/Users/wuyongsheng/workspace/projects/QingShuClaw/src/main/auth/adapter.ts) 中的加密 key 常量
  - `QTB_LOGIN_PASSWORD_ENCRYPTION_KEY` 是协议约定常量，不是用户秘密
  - 但它属于安全敏感实现细节，后续仍应谨慎传播

## 3. 本次实际扫描范围

### 3.1 当前分支相对 Main 的差异文件

重点审计了这些相对 `origin/main` 有差异的高风险文件：

- [src/common/auth.ts](/Users/wuyongsheng/workspace/projects/QingShuClaw/src/common/auth.ts)
- [src/main/auth/config.ts](/Users/wuyongsheng/workspace/projects/QingShuClaw/src/main/auth/config.ts)
- [src/main/auth/adapter.ts](/Users/wuyongsheng/workspace/projects/QingShuClaw/src/main/auth/adapter.ts)
- [src/main/main.ts](/Users/wuyongsheng/workspace/projects/QingShuClaw/src/main/main.ts)
- [src/main/preload.ts](/Users/wuyongsheng/workspace/projects/QingShuClaw/src/main/preload.ts)
- [src/renderer/services/auth.ts](/Users/wuyongsheng/workspace/projects/QingShuClaw/src/renderer/services/auth.ts)
- [src/renderer/components/LoginButton.tsx](/Users/wuyongsheng/workspace/projects/QingShuClaw/src/renderer/components/LoginButton.tsx)
- [src/renderer/components/Settings.tsx](/Users/wuyongsheng/workspace/projects/QingShuClaw/src/renderer/components/Settings.tsx)
- [src/renderer/components/Sidebar.tsx](/Users/wuyongsheng/workspace/projects/QingShuClaw/src/renderer/components/Sidebar.tsx)
- [src/renderer/services/i18n.ts](/Users/wuyongsheng/workspace/projects/QingShuClaw/src/renderer/services/i18n.ts)
- [src/renderer/types/electron.d.ts](/Users/wuyongsheng/workspace/projects/QingShuClaw/src/renderer/types/electron.d.ts)
- [docs/qingshu-auth-bridge-overview.md](/Users/wuyongsheng/workspace/projects/QingShuClaw/docs/qingshu-auth-bridge-overview.md)
- [qtb-auth-integration-acceptance.md](/Users/wuyongsheng/workspace/projects/QingShuClaw/qtb-auth-integration-acceptance.md)
- [electron-builder.json](/Users/wuyongsheng/workspace/projects/QingShuClaw/electron-builder.json)
- [package.json](/Users/wuyongsheng/workspace/projects/QingShuClaw/package.json)
- [scripts/electron-builder-hooks.cjs](/Users/wuyongsheng/workspace/projects/QingShuClaw/scripts/electron-builder-hooks.cjs)

### 3.2 当前工作区未提交改动

额外审计了这些当前未提交文件：

- [src/common/auth.ts](/Users/wuyongsheng/workspace/projects/QingShuClaw/src/common/auth.ts)
- [src/main/auth/adapter.ts](/Users/wuyongsheng/workspace/projects/QingShuClaw/src/main/auth/adapter.ts)
- [src/main/main.ts](/Users/wuyongsheng/workspace/projects/QingShuClaw/src/main/main.ts)
- [src/main/preload.ts](/Users/wuyongsheng/workspace/projects/QingShuClaw/src/main/preload.ts)
- [src/renderer/services/auth.ts](/Users/wuyongsheng/workspace/projects/QingShuClaw/src/renderer/services/auth.ts)
- [src/renderer/components/LoginButton.tsx](/Users/wuyongsheng/workspace/projects/QingShuClaw/src/renderer/components/LoginButton.tsx)
- [src/renderer/components/Settings.tsx](/Users/wuyongsheng/workspace/projects/QingShuClaw/src/renderer/components/Settings.tsx)
- [src/renderer/components/Sidebar.tsx](/Users/wuyongsheng/workspace/projects/QingShuClaw/src/renderer/components/Sidebar.tsx)
- [src/renderer/components/cowork/CoworkPromptInput.tsx](/Users/wuyongsheng/workspace/projects/QingShuClaw/src/renderer/components/cowork/CoworkPromptInput.tsx)
- [src/renderer/services/i18n.ts](/Users/wuyongsheng/workspace/projects/QingShuClaw/src/renderer/services/i18n.ts)
- [src/renderer/types/electron.d.ts](/Users/wuyongsheng/workspace/projects/QingShuClaw/src/renderer/types/electron.d.ts)
- [public/logo.png](/Users/wuyongsheng/workspace/projects/QingShuClaw/public/logo.png)

## 4. 本次使用的严格检查维度

### 4.1 必须阻断提交的模式

如果未来扫到以下内容，应直接视为高危：

- 私钥头：
  - `BEGIN PRIVATE KEY`
  - `BEGIN RSA PRIVATE KEY`
  - `BEGIN OPENSSH PRIVATE KEY`
- 真实 token 模式：
  - `ghp_`
  - `github_pat_`
  - `glpat-`
  - `xoxb-`
  - `xoxp-`
  - `AKIA...`
  - `ASIA...`
  - `AIza...`
  - 明显真实的 `sk-...`
- 真实 JWT：
  - 形如 `eyJxxx.yyy.zzz`
- 带用户密码的 URL：
  - `https://user:password@host`
- `.pem` / `.p12` / `.key` / `.crt` 等私密材料直接入库

### 4.2 需要人工复核但不一定阻断的模式

- `appId` / `appSecret` / `clientId` / `clientSecret`
- `apiKey` / `accessToken` / `refreshToken`
- `password`
- `authorizeUrl`
- 第三方平台的回调 URL
- `localhost` / 内网地址 / 测试域名
- 文档中的示例 token
- 测试中的假 token

### 4.3 运行时安全但非仓库秘密的模式

这类内容可以存在于代码中，但要注意理解语义：

- 应用标识：
  - `appId: "com.xxx.xxx"`
- 默认 API 地址
- 本地调试地址
- 加密协议常量
- 运行时从 SQLite / 配置读取的 token 结构类型定义

## 5. 当前分支的高风险关注点

### 5.1 认证实现层

重点文件：

- [src/main/auth/adapter.ts](/Users/wuyongsheng/workspace/projects/QingShuClaw/src/main/auth/adapter.ts)
- [src/main/main.ts](/Users/wuyongsheng/workspace/projects/QingShuClaw/src/main/main.ts)
- [src/renderer/services/auth.ts](/Users/wuyongsheng/workspace/projects/QingShuClaw/src/renderer/services/auth.ts)

原因：

- 这些文件直接处理 `accessToken` / `refreshToken`
- 容易在调试时临时写入真实 token
- 容易在日志里顺手打印接口返回

当前结果：

- 未发现硬编码真实 token
- 未发现把真实 token 直接写进常量或默认配置

### 5.2 设置页与导入导出逻辑

重点文件：

- [src/renderer/components/Settings.tsx](/Users/wuyongsheng/workspace/projects/QingShuClaw/src/renderer/components/Settings.tsx)

原因：

- 该文件处理 `apiKey` 输入、测试连接、导入导出加密、OAuth token
- 非常容易在调试时加入临时默认值

当前结果：

- 未发现真实 key 默认值
- 代码中存在对 `apiKey`、`access_token`、`refresh_token` 的结构处理，但没有硬编码秘密

### 5.3 文档说明层

重点文件：

- [docs/qingshu-auth-bridge-overview.md](/Users/wuyongsheng/workspace/projects/QingShuClaw/docs/qingshu-auth-bridge-overview.md)
- [qtb-auth-integration-acceptance.md](/Users/wuyongsheng/workspace/projects/QingShuClaw/qtb-auth-integration-acceptance.md)

原因：

- 文档最容易因为“举例”而粘贴真实 token、截图、接口响应

当前结果：

- 只描述了 token 流程和字段名
- 未发现真实 token 样本

### 5.4 打包与资源层

重点文件：

- [electron-builder.json](/Users/wuyongsheng/workspace/projects/QingShuClaw/electron-builder.json)
- [scripts/electron-builder-hooks.cjs](/Users/wuyongsheng/workspace/projects/QingShuClaw/scripts/electron-builder-hooks.cjs)
- [package.json](/Users/wuyongsheng/workspace/projects/QingShuClaw/package.json)

原因：

- 打包脚本容易把 `.env`、缓存目录、证书文件意外带入安装包

当前结果：

- `electron-builder.json` 中对 `SKILLs` 已显式排除了 `.env` / `.env.*`
- 当前未发现打包脚本直接读取并写死秘密到仓库
- 仍建议额外检查根目录和其他资源目录是否需要补排除项

## 6. 提交前人工审计清单

每次提交前，至少人工检查以下事项：

### 6.1 代码与文档

- 是否把真实 `appId` / `appSecret` / `clientSecret` 写进了代码或文档
- 是否把 Postman / 浏览器 / 控制台里的真实 token 粘进文档
- 是否在日志中输出了完整 token、cookie、Authorization header
- 是否给输入框、调试变量、mock 数据设置了真实默认值

### 6.2 配置与构建

- 是否把 `.env`、`.pem`、`.key`、`.p12`、`.mobileprovision`、证书文件加入了 Git
- 是否把本地调试配置、IDE 配置、打包签名配置误加入仓库
- 是否把用户目录、数据库、缓存文件、导出文件带进提交

### 6.3 文档与截图

- 截图里是否露出：
  - 接口返回 token
  - 浏览器地址栏 ticket/code
  - 账号信息
  - 内网域名
- 文档示例中的 token 是否全部改成占位符

## 7. 推荐的固定检查命令

提交前建议至少执行一次：

```bash
git diff --name-only origin/main...HEAD
git diff --name-only HEAD
rg -n --hidden -S "BEGIN (RSA |DSA |EC |OPENSSH )?PRIVATE KEY|BEGIN PGP PRIVATE KEY BLOCK" .
rg -n --hidden -S "ghp_|github_pat_|glpat-|xox[baprs]-|AKIA|ASIA|AIza|eyJ[A-Za-z0-9_-]{10,}\\." .
rg -n --hidden -S "appId|appSecret|clientId|clientSecret|apiKey|accessToken|refreshToken|password" .
```

如果想只检查当前分支差异文件，建议先拿文件列表再扫：

```bash
git diff --name-only origin/main...HEAD
git diff --name-only HEAD
```

## 8. 当前建议补充的防线

### 8.1 工程防线

- 增加提交前 secret scan
- 对文档目录单独加一次 token 审计
- 对构建资源目录增加 secret 白名单 / 黑名单检查

### 8.2 提交习惯

- 涉及认证调试时，不在代码里保留临时 token
- 涉及扫码 / bridge 调试时，不把真实链接直接写进文档
- 资源文件改动与认证逻辑改动分开提交

## 9. 本次明确确认过的“不会被当成 secret 的字段”

以下字段本身不是秘密，不需要因为名字看起来敏感就阻断：

- [electron-builder.json](/Users/wuyongsheng/workspace/projects/QingShuClaw/electron-builder.json) 的 `appId`
- [src/common/auth.ts](/Users/wuyongsheng/workspace/projects/QingShuClaw/src/common/auth.ts) 的默认 `qtbApiBaseUrl`
- [src/common/auth.ts](/Users/wuyongsheng/workspace/projects/QingShuClaw/src/common/auth.ts) 的默认 `qtbWebBaseUrl`
- [src/main/auth/adapter.ts](/Users/wuyongsheng/workspace/projects/QingShuClaw/src/main/auth/adapter.ts) 的 `QTB_LOGIN_PASSWORD_ENCRYPTION_KEY`

但注意：

- 这些内容不是 secret，不代表不需要谨慎修改
- 尤其认证协议常量和默认地址，仍可能影响兼容性与安全边界

## 10. 最终结论

按照当前审计结果：

- **当前分支已提交差异中，没有发现明显真实敏感信息**
- **当前工作区未提交改动中，也没有发现明显真实敏感信息**
- 当前最需要持续盯防的区域仍然是：
  - 认证适配层
  - 设置页的 key / token 处理
  - 认证与 bridge 相关文档
  - 打包资源过滤规则


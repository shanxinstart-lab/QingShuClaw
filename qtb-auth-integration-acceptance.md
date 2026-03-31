# QingShuClaw 接入 qtb 认证与模型能力验收说明

## 1. 本次目标

将当前项目 `QingShuClaw` 的认证方式切换为 `qtb-data-platform` 的认证模式，并补齐以下能力：

- 账密登录
- 飞书登录
- 套餐 / 额度展示
- 服务端模型列表
- QingShuClaw 专用模型代理

## 2. 当前分支

- `QingShuClaw`: `qingshu-dev`
- `qtb-data-platform`: `openclaw-mode`

## 3. 当前项目完成情况

### 3.1 认证模式

当前项目已默认切换到 qtb 认证模式：

- qtb API: `http://localhost:9080`
- qtb Web: `http://localhost:9080/webapp`

相关文件：

- `src/common/auth.ts`
- `src/main/auth/config.ts`
- `src/main/auth/adapter.ts`
- `src/renderer/services/auth.ts`
- `src/renderer/components/LoginButton.tsx`

### 3.2 登录入口

当前项目已支持两种 qtb 登录方式：

- 用户名 / 密码登录
- 飞书登录

其中账密登录密码加密已对齐 qtb Web 的真实实现，使用：

- `CryptoJS`
- AES ECB
- key: `supersonic@2024`

### 3.3 登录态恢复与用户信息

当前项目已接入：

- 登录成功后拉取当前用户
- 登录成功后拉取额度信息
- 登录成功后拉取套餐摘要
- 登录成功后拉取服务端模型列表

### 3.4 服务端模型路由

当前项目已将 qtb 服务端模型接入 `lobsterai-server` provider，并通过 QingShuClaw 专用代理路径转发：

- `/api/qingshu-claw/proxy/v1/chat/completions`

相关文件：

- `src/main/libs/claudeSettings.ts`
- `src/renderer/store/slices/modelSlice.ts`
- `src/renderer/components/ModelSelector.tsx`
- `src/renderer/App.tsx`

## 4. qtb-data-platform 完成情况

### 4.1 新增 QingShuClaw 专用接口

已新增：

- `GET /api/qingshu-claw/auth/quota`
- `GET /api/qingshu-claw/auth/profile-summary`
- `GET /api/qingshu-claw/models/available`
- `POST /api/qingshu-claw/proxy/v1/chat/completions`

核心文件：

- `auth/authentication/src/main/java/com/tencent/supersonic/auth/authentication/rest/QingShuClawController.java`
- `auth/authentication/src/main/java/com/tencent/supersonic/auth/authentication/service/QingShuClawService.java`
- `auth/authentication/src/main/java/com/tencent/supersonic/auth/authentication/pojo/QingShuClawQuotaResponse.java`
- `auth/authentication/src/main/java/com/tencent/supersonic/auth/authentication/pojo/QingShuClawCreditItem.java`
- `auth/authentication/src/main/java/com/tencent/supersonic/auth/authentication/pojo/QingShuClawProfileSummaryResponse.java`
- `auth/authentication/src/main/java/com/tencent/supersonic/auth/authentication/pojo/QingShuClawModelResponse.java`

### 4.2 代理转发能力

`QingShuClawService` 已支持：

- 将对外暴露模型 ID 转换为内部 `ChatModel`
- 将请求转为 OpenAI 兼容格式
- 代理转发到上游模型服务
- 将上游响应透传回 QingShuClaw

## 5. 本地联调结果

联调日期：

- `2026-03-31`

### 5.1 认证链路

已验证通过：

- `POST /api/auth/user/login`
- `GET /api/auth/feishu/authorize`
- `GET /api/auth/user/getCurrentUser`

### 5.2 套餐 / 额度 / 模型链路

已验证通过：

- `GET /api/qingshu-claw/auth/quota`
- `GET /api/qingshu-claw/auth/profile-summary`
- `GET /api/qingshu-claw/models/available`

### 5.3 模型实际回答验证

已将 qtb 本地数据库中的服务端模型切换为：

- 模型名：`qwen3-max`
- provider：`OPEN_AI`
- baseUrl：`https://dashscope.aliyuncs.com/compatible-mode/v1`

当前专用模型接口返回：

- `modelId`: `qtb-chat-model-3`
- `modelName`: `qwen3-max`

真实回答验证已通过：

- 请求内容：`你好，请只回复 ok`
- 返回内容：`ok`

## 6. 当前项目静态校验结果

已通过：

- `npx tsc -p electron-tsconfig.json --noEmit`
- `npx tsc -p tsconfig.json --noEmit`
- `npm run build`

## 7. 当前项目运行态冒烟结果

已执行：

- `npm run electron:dev`

结果：

- Vite 正常启动
- Electron 主进程编译通过
- `electron .` 已正常启动
- 未观察到启动时报错

说明：

- 当前环境下 Electron 随后正常退出，未见崩溃栈
- 尚未进行完整人工点击式 GUI 验证

## 8. 剩余风险

### 8.1 模型配置属于本地环境配置

本次 `qwen3-max` 能真实回答，依赖本地 qtb MySQL 中的模型配置已更新。

这部分更适合作为环境配置或初始化说明，不建议直接当作通用代码行为假设。

### 8.2 GUI 手工验证仍建议补一轮

虽然构建、启动、接口、模型代理都已经通过，但仍建议补一次人工操作验证：

- 账密登录
- 飞书登录回跳
- 用户菜单额度展开
- 模型下拉选择 `qwen3-max`
- 实际发起一次对话

### 8.3 standalone 打包运行仍有无关告警

当前 qtb standalone 在打包 jar 运行时有 HanLP 自定义词典文件告警，但不影响本次认证和模型链路验证。

## 9. 建议提交粒度

### 9.1 QingShuClaw

建议一组提交聚焦：

- qtb 认证配置与后端切换
- 账密 / 飞书登录入口扩展
- 套餐 / 额度 / 模型 UI 与状态接线
- 服务端模型代理接入

### 9.2 qtb-data-platform

建议一组提交聚焦：

- QingShuClaw 专用 controller
- QingShuClaw quota / profile / model response 对象
- QingShuClaw 模型代理 service

### 9.3 环境变更

建议单独记录，不一定提交代码：

- 本地 `s2_chat_model` 中 `id=3` 模型配置切换为 `qwen3-max`


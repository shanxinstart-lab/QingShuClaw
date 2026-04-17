# QingShuClaw 青数模块化接入文档索引

## 1. 文档用途

本文用于汇总当前这轮“青数模块化接入与治理能力建设”相关文档，方便后续继续开发、回归验证、阶段交接时快速定位。

当前分支：

- `qingshu-dev-alive`

## 2. 推荐阅读顺序

建议按以下顺序阅读：

1. 先看总览说明
2. 再看执行型验收清单
3. 再看阶段总结
4. 最后看阶段收尾结论

## 3. 文档清单

### 3.1 总览说明

文件：

- `docs/qingshu-modular-governance-overview.md`

适用场景：

- 了解当前方案边界
- 区分正式链路与开发态治理入口
- 查看默认关闭能力与模块降级规则

### 3.2 验收清单

文件：

- `docs/qingshu-modular-governance-acceptance-checklist.md`

适用场景：

- 手工回归
- 联调前自检
- 阶段性交付验收

### 3.3 阶段总结

文件：

- `docs/qingshu-modular-governance-stage-summary.md`

适用场景：

- 了解当前阶段已经完成了哪些能力
- 查看当前自动化覆盖
- 判断哪些能力仍建议保持开发态

### 3.4 收尾结论

文件：

- `docs/qingshu-modular-governance-closeout.md`

适用场景：

- 做阶段收尾
- 评估是否进入下一阶段
- 明确后续推荐路线

## 4. 配套上下文文档

以下文档与本轮工作强相关，但主题不完全相同：

### 4.1 登录与桥接

文件：

- `docs/qingshu-auth-bridge-overview.md`

用途：

- 查看 QingShuClaw 与青数平台当前登录、授权、桥接票据与双向免登逻辑

### 4.2 认证与模型能力验收

文件：

- `qtb-auth-integration-acceptance.md`

用途：

- 查看 qtb 认证、额度、模型、代理调用这条正式业务链路的验收背景

## 5. 当前阶段建议

如果继续推进，建议优先参考：

1. `docs/qingshu-modular-governance-closeout.md`
2. `docs/qingshu-modular-governance-overview.md`
3. `docs/qingshu-modular-governance-acceptance-checklist.md`

当前最合适的下一阶段主题仍然是：

- 正式 Agent bundle 编辑入口产品化

而不是继续扩展当前开发态 debug 入口。

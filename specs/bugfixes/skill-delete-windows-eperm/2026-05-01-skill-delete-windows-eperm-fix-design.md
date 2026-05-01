# Windows 用户删除 Skill 失败（EPERM）修复 Spec

## 问题描述

线上有个别 Windows 用户删除已安装 skill 时“无反应”。  
从主进程日志看，删除请求实际已触发，但目录删除阶段持续报错：

```text
[skills] deleteSkill: id=Desktop, targetDir=C:\Users\jjh\AppData\Roaming\LobsterAI\SKILLs\Desktop, platform=win32
[skills] deleteSkill: failed to remove "Desktop" ... Error: EPERM, Permission denied
[skills] Failed to delete skill: Desktop Error: EPERM, Permission denied
```

该问题并非通用失败，而是用户环境差异导致的 Windows 文件系统权限/占用异常。

---

## 核心结论

**删除链路本身正常，失败点在 Windows 目录删除系统调用。**

- UI 已调用删除
- IPC 已进入 `skills:delete`
- `SkillManager.deleteSkill()` 被执行
- 失败发生在 `fs.rmSync(targetDir)`，错误为 `EPERM`（可能伴随 `EACCES` / `EBUSY`）

---

## 根因分析

在个别 Windows 机器上，skill 目录可能出现以下情况之一：

1. 目录或子文件被进程占用（防病毒、同步盘、资源管理器预览、外部编辑器）
2. 目录属性异常（只读/系统/隐藏组合）
3. ACL/所有者不一致（历史管理员创建目录，当前用户删除权限不足）

当前实现仅依赖 Node 的 `fs.rmSync`，遇到上述环境差异时会直接失败，导致用户体感“点了没反应”。

---

## 修复目标

1. 在保持现有删除主路径不变的前提下，提升 Windows 删除成功率
2. 仅在已知 Windows 权限类错误时启用兜底，避免扩大行为风险
3. 增强日志可观测性，明确是否走了兜底路径

---

## 修复方案

### 方案概览

在 `deleteSkill()` 中引入 Windows 专用兜底删除策略：

1. 先执行原有 `fs.rmSync(targetDir, { recursive: true, force: true, ... })`
2. 若为 Windows 且抛出 `EPERM` / `EACCES` / `EBUSY`，执行兜底命令：
   - `attrib -r -s -h "<targetDir>" /s /d`
   - `rmdir /s /q "<targetDir>"`
3. 兜底成功后继续状态清理与 `skills:changed` 广播
4. 兜底失败时保留原错误路径，继续返回删除失败

### 关键实现点

- 新增 `isWindowsDeletePermissionError(error)`：识别 Windows 删除权限类错误
- 新增 `tryWindowsDeleteFallback(targetDir)`：执行 `cmd.exe` 下的属性清理+递归删除
- 删除流程中新增分支日志：
  - 兜底成功：`directory removed via Windows fallback`
  - 兜底失败：`Windows fallback failed`

---

## 涉及文件

| 文件 | 变更说明 |
|---|---|
| `src/main/skillManager.ts` | 增加 Windows 权限错误识别与 `attrib + rmdir` 删除兜底；补充日志 |

---

## 日志与观测

### 成功链路（主路径）

- `[skills] deleteSkill: id=%s, targetDir=%s, platform=%s`
- `[skills] deleteSkill: directory removed in %dms`
- `[skills] deleteSkill: completed successfully for "%s"`

### 成功链路（兜底路径）

- `[skills] deleteSkill: id=%s, targetDir=%s, platform=%s`
- `[skills] deleteSkill: directory removed via Windows fallback in %dms`
- `[skills] deleteSkill: completed successfully for "%s"`

### 失败链路

- `[skills] deleteSkill: Windows fallback failed for "%s": %s`
- `[skills] deleteSkill: failed to remove "%s" at %s:`
- `[skills] Failed to delete skill:`

---

## 验证方法

### 目标用户复测

1. 在问题用户机器执行同一 skill 删除操作
2. 观察日志是否出现 `directory removed via Windows fallback`
3. 确认 skill 从已安装列表移除，并在重启应用后不再出现

### 回归检查

| 场景 | 预期 |
|---|---|
| 普通环境可删除 | 仍走原路径成功，不影响既有行为 |
| Windows 权限类失败（EPERM/EACCES/EBUSY） | 自动触发兜底并尽可能删除成功 |
| 兜底仍失败（强占用/企业策略） | 返回失败并输出清晰错误日志 |

---

## 已知边界

1. 兜底无法覆盖所有系统级限制（如企业 DLP/Defender 策略强拦截）
2. 若目录被持续独占，`rmdir /s /q` 仍可能失败
3. 当前修复关注删除成功率与日志清晰度，不改变前端错误文案策略

---

## 后续优化建议

1. 在前端对 Windows 权限错误提供更友好提示（例如“关闭占用该目录的程序后重试”）
2. 失败时附加“建议操作”字段，便于客服排障
3. 增加 Windows 平台集成测试或模拟测试覆盖权限错误分支

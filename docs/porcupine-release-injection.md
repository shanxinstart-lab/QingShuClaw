# Porcupine 资源注入发布说明

本文档面向发布机构建流程，不面向最终用户。

目标：

- 最终用户只下载并打开 `QingShuClaw.app`
- 不要求最终用户手动放置 `.ppn`
- 不要求最终用户配置 `AccessKey`
- 若 Porcupine 资源缺失，应用自动回退到现有 `text_match` 唤醒方案

## 方案说明

当前采用的发布方案：

1. 发布机在打包前注入 `AccessKey` 和关键词模型
2. 构建脚本自动生成 `build/generated/porcupine-keywords/`
3. `electron-builder` 将该目录打入 `.app`
4. 应用运行时优先读取内置资源

这样做的好处：

- `KISS`：最终用户零安装、零配置
- `YAGNI`：首版不引入新的独立 macOS helper
- `DRY`：继续复用现有正文听写与 fallback 链路

## 发布前准备

发布机需要准备以下内容：

1. `PORCUPINE_ACCESS_KEY`
2. 关键词模型文件
   - `open-qingshuclaw-mac.ppn`
   - `chu-yi-mac.ppn`

关键词模型可通过两种方式提供。

### 方式一：环境变量指定文件路径

推荐使用：

```bash
export PORCUPINE_ACCESS_KEY="your_access_key"
export PORCUPINE_KEYWORD_OPEN_QINGSHUCLAW_PATH="/absolute/path/open-qingshuclaw-mac.ppn"
export PORCUPINE_KEYWORD_CHUYI_PATH="/absolute/path/chu-yi-mac.ppn"
```

### 方式二：放到仓库默认目录

将文件放到：

```bash
resources/porcupine-keywords/open-qingshuclaw-mac.ppn
resources/porcupine-keywords/chu-yi-mac.ppn
```

## 构建步骤

### 1. 先生成 Porcupine 资源

```bash
PORCUPINE_ACCESS_KEY="your_access_key" \
PORCUPINE_KEYWORD_OPEN_QINGSHUCLAW_PATH="/absolute/path/open-qingshuclaw-mac.ppn" \
PORCUPINE_KEYWORD_CHUYI_PATH="/absolute/path/chu-yi-mac.ppn" \
npm run prepare:porcupine-wake-resources
```

执行后会生成：

```bash
build/generated/porcupine-keywords/porcupine-config.json
build/generated/porcupine-keywords/open-qingshuclaw-mac.ppn
build/generated/porcupine-keywords/chu-yi-mac.ppn
```

### 2. 打包 macOS 应用

```bash
PORCUPINE_ACCESS_KEY="your_access_key" \
PORCUPINE_KEYWORD_OPEN_QINGSHUCLAW_PATH="/absolute/path/open-qingshuclaw-mac.ppn" \
PORCUPINE_KEYWORD_CHUYI_PATH="/absolute/path/chu-yi-mac.ppn" \
npm run dist:mac
```

说明：

- `electron-builder` 的 `beforePack` 钩子会再次执行资源准备
- 打包时使用的是 `build/generated/porcupine-keywords/`
- 最终 `.app` 内会带上内置 Porcupine 资源

## 构建后校验

建议至少校验以下几点：

1. 检查生成目录

```bash
cat build/generated/porcupine-keywords/porcupine-config.json
```

期望：

- `accessKey` 非空
- `keywords` 至少包含 1 条

2. 检查 `.app` 内资源

```bash
find "release" -path "*porcupine-keywords*"
```

期望能看到：

- `porcupine-config.json`
- 对应 `.ppn` 文件

3. 运行打包后的应用并查看日志

期望日志包含：

- Porcupine 成功启动：
  - `[PorcupineWake] Started background wake listener.`
- 若资源异常则自动回退：
  - `[WakeInput] Falling back to text-match wake listener because Porcupine is unavailable.`

## 失败回退说明

以下情况会自动回退到现有 `text_match` 方案：

1. `AccessKey` 缺失
2. `.ppn` 文件缺失
3. Porcupine 初始化失败
4. 录音设备启动失败
5. 运行时异常

因此即使发布时 Porcupine 资源未就绪，应用仍可正常发布，只是语音唤醒会退回旧方案。

## 最终用户侧要求

最终用户不需要做以下事情：

- 不需要安装 Porcupine
- 不需要安装 Node.js
- 不需要手动复制 `.ppn`
- 不需要配置环境变量
- 不需要额外安装新的 helper

## 相关文件

- `scripts/prepare-porcupine-wake-resources.cjs`
- `scripts/electron-builder-hooks.cjs`
- `src/main/libs/porcupineWakeService.ts`
- `src/main/libs/wakeInputService.ts`
- `electron-builder.json`

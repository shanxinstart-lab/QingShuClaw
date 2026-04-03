# `local_whisper_cpp` 开发环境验证说明

## 目标

验证当前 QingShuClaw 中已经接入的 `local_whisper_cpp` 最小链路：

- renderer 录音
- `speech:transcribeAudio`
- 主进程 `LocalWhisperCppSpeechService`
- 本地 `whisper.cpp` CLI 转写
- 文本回填聊天输入框

## 当前实现范围

已经具备：

- 设置页可选择 `local_whisper_cpp`
- 能力矩阵会根据本地二进制和模型文件是否存在来判断可用性
- 手动语音输入和自动续麦都能走本地 `whisper.cpp`
- 设置页可直接查看资源根目录、默认路径、解析后的实际路径
- 设置页可直接创建默认资源目录并打开资源目录 / 模型目录

当前未包含：

- 自动下载 `whisper.cpp` 二进制
- 自动下载模型
- UI 内一键下载安装

因此当前验证方式是手动准备本地资源。

## 目录约定

当前代码支持两种方式：

### 方式 A：在设置页显式填写路径

设置页中填写：

- `Binary Path`
- `Model Path`

这是最直接的方式，优先级最高。

### 方式 B：放到默认开发目录

如果设置页不填，当前会按默认目录查找：

- 二进制：
  - `build/generated/local-whisper-cpp/bin/whisper-cli`
- 模型：
  - `build/generated/local-whisper-cpp/models/ggml-<modelName>.bin`

默认 `modelName` 是 `base`，因此默认模型路径是：

- `build/generated/local-whisper-cpp/models/ggml-base.bin`

## 准备步骤

### 1. 准备 `whisper.cpp` CLI

你需要先自行编译或获取 `whisper.cpp` 的 CLI 程序，并确保当前机器可执行。

macOS 常见目标文件名建议统一为：

- `whisper-cli`

放到：

- `build/generated/local-whisper-cpp/bin/whisper-cli`

### 2. 准备模型

从 `whisper.cpp` 对应模型中选择一个开始验证即可，建议先用：

- `ggml-base.bin`

放到：

- `build/generated/local-whisper-cpp/models/ggml-base.bin`

### 3. 可选：使用准备脚本

现在也可以直接用脚本创建目录并拷贝资源：

```bash
WHISPER_CPP_BIN=/abs/path/to/whisper-cli \
WHISPER_CPP_MODEL=/abs/path/to/ggml-base.bin \
npm run prepare:dev:local-whisper-cpp
```

如果你只是想查看当前目录状态，也可以直接运行：

```bash
npm run prepare:dev:local-whisper-cpp
```

### 4. 启动开发环境

继续使用你当前的 Electron 开发命令：

```bash
npm run electron:dev:openclaw
```

### 5. 设置页配置

打开设置页中的语音配置区：

1. 将 `手动语音输入 provider` 切换到 `本地 whisper.cpp`
2. 打开本地 provider 开关
3. 如果没有采用默认目录，则手动填写：
   - `Binary Path`
   - `Model Path`
4. `Model Name` 若使用默认模型可填 `base`
5. `Locale/Language` 建议先填 `zh`
6. `Threads` 可先用 `4`
7. Apple Silicon 机器可先保留 `启用 GPU`

### 6. 观察能力矩阵

如果配置正确，设置页中的能力矩阵应表现为：

- `local_whisper_cpp`
  - 平台支持：是
  - 安装包支持：是
  - 已完成配置：是
- `manual_stt`
  - 当前 provider：`local_whisper_cpp`
  - 运行时可用：是

如果还是不可用，优先看：

- `Binary Path` 是否正确
- `Model Path` 是否正确
- 文件是否真的存在并有执行权限
- `Model Name` 是否和模型文件名匹配

## 验证手动 STT

1. 在设置页确认 `manual_stt` 当前 provider 为 `local_whisper_cpp`
2. 回到聊天页面
3. 点击麦克风按钮
4. 说一句中文
5. 再次点击麦克风结束录音

预期结果：

- 输入框回填转写文本
- 若识别正常，可继续发送

## 验证自动续麦

1. 在设置页启用 `自动续麦`
2. `manual_stt provider` 仍保持 `local_whisper_cpp`
3. 完成一轮对话，等待 agent 回复结束
4. 观察是否自动重新进入录音态
5. 结束录音后，文本应继续回填输入框

## 日志观察点

如果你要看主进程日志，继续使用主日志查看方式。

重点关注：

- `voice capability matrix` 是否变为可用
- 本地 `whisper.cpp` 是否成功启动
- 是否有模型文件找不到、命令退出码非 0、输出文件不存在等错误

## 常见失败原因

### 1. 能力矩阵仍显示“当前安装包未包含该 provider”

原因：

- 二进制不存在
- 默认目录里没有 `whisper-cli`
- 手动填写路径无效

### 2. 显示“需要先完成 provider 配置”

原因：

- provider 没打开
- 没有模型文件
- 没有可执行文件

### 3. 点击录音能开始，但结束后转写失败

原因：

- `whisper.cpp` CLI 参数不兼容当前版本
- 模型文件损坏
- CLI 没有写出 `.txt` 输出文件
- 命令执行权限不足

## 当前版本的一个重要说明

目前主进程调用的是 `whisper.cpp` 风格 CLI，假设支持以下参数：

- `-m`
- `-f`
- `-l`
- `-t`
- `-otxt`
- `-of`
- `-np`
- `-nt`

如果你本地使用的是不同包装器或不同 fork，可能需要调整到兼容的命令行参数格式。

## 下一步建议

当前这版测通后，下一步最值得做的是：

1. 增加模型下载和安装管理
2. 为不同模型规格补充更细的状态展示与校验
3. 再考虑打包时正式内置本地 STT 资源

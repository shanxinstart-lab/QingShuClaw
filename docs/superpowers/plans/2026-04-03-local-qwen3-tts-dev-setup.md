# `local_qwen3_tts` 开发环境验证说明

## 目标

验证当前 QingShuClaw 中已经接入的 `local_qwen3_tts` 最小链路：

- 设置页切换到本地 `Qwen3-TTS` provider
- 检查本地 Python / 模块 / 模型状态
- 按需下载 tokenizer 和模型
- 主进程调用本地 Python runner 执行实验性 TTS
- 前端收到音频数据并播放

## 当前实现范围

已经具备：

- 设置页可选择 `local_qwen3_tts`
- 能力矩阵会根据平台、模型、Tokenizer、Python 与关键模块状态判断可用性
- 设置页可直接查看：
  - Python 命令与解析路径
  - Python 版本
  - `qwen_tts` / `torch` / `soundfile` / `huggingface_hub` 状态
  - `huggingface-cli` 是否可用
  - 运行目录是否可写
  - 模型目录、默认路径、解析后的实际路径
- 设置页可直接下载或取消下载 Qwen3-TTS 相关模型
- 主进程已接入实验性的本地合成执行链路

当前仍然属于实验性能力：

- 上游 `Qwen3-TTS` Python API 未来可能有变动
- 不同宿主机的 Python / PyTorch / 音频依赖差异较大
- 首版更强调“可验证、可排查、可回退”，还不是完全免配置的一键本地 TTS

## 宿主机要求

建议最低准备：

- macOS
- Python `3.10+`
- 可用的 `pip`
- 建议 Apple Silicon 机器
- 建议至少 `16GB` 内存

如果要跑更大的 `1.7B` 模型，建议：

- Apple Silicon 高配机器
- 预留至少 `8GB` 以上空闲内存
- 首次加载模型时接受更长等待时间

## Python 依赖准备

建议先在独立虚拟环境中安装：

```bash
python3 -m venv .venv-qwen-tts
source .venv-qwen-tts/bin/activate
python -m pip install --upgrade pip
python -m pip install torch soundfile huggingface_hub qwen-tts
python -m pip install "huggingface_hub[cli]"
```

如果你不想启虚拟环境，也至少要保证设置页里的 `Python Command` 能定位到装好依赖的 Python。

例如：

- `/Users/you/.pyenv/versions/3.11.9/bin/python`
- `/opt/homebrew/Caskroom/miniconda/base/envs/qwen/bin/python`
- 项目本地虚拟环境中的 `python`

## 模型准备

当前代码已接入按需下载。建议先下载：

1. `Qwen3-TTS Tokenizer 12Hz`
2. `Qwen3-TTS 1.7B Voice Design`

如果你只是想先快速做链路验证，也可以先试：

1. `Qwen3-TTS Tokenizer 12Hz`
2. `Qwen3-TTS 0.6B Custom Voice`

下载后的默认目录在用户数据目录下，设置页可以直接点按钮打开。

## 启动开发环境

继续使用当前开发命令即可：

```bash
npm run electron:dev:openclaw
```

## 设置页配置步骤

打开设置页的统一语音配置区：

1. 将 `语音朗读 provider` 切换到 `本地 Qwen3-TTS`
2. 打开该 provider 开关
3. `Python Command` 填入你已经装好依赖的 Python
4. 如果不手填路径，保持：
   - `Model ID = qwen3_tts_1_7b_voice_design`
   - `Tokenizer Path` 留空
   - `Model Path` 留空
5. 点击刷新状态

如果你已经手动放好了模型，也可以直接填写：

- `Model Path`
- `Tokenizer Path`

手填路径优先级更高。

## 如何判断是否准备正确

设置页中，本地 `Qwen3-TTS` 状态建议至少满足：

- `Provider 已启用 = 是`
- `本地运行条件就绪 = 是`
- `Python 可用 = 是`
- ``qwen_tts` 模块可用 = 是`
- ``torch` 模块可用 = 是`
- ``soundfile` 模块可用 = 是`
- `模型存在 = 是`
- `Tokenizer 存在 = 是`
- `运行目录可写 = 是`

`huggingface-cli` 和 `huggingface_hub` 主要影响模型下载。

如果模型已经下载完成，TTS 推理本身不强制依赖它们同时都可用；但至少需要其中一种可用，才能让应用内模型下载入口顺利工作。

## 验证方式

当前最直接的验证方式：

1. 在设置页把 TTS provider 设为 `本地 Qwen3-TTS`
2. 回到聊天页
3. 找一条助手消息
4. 点击播放按钮

预期结果：

- 前端进入播放态
- 可以听到本地合成的语音
- 停止按钮可中断当前播放

如果你启用了“自动朗读助手回复”，则在助手消息完整结束后，也会尝试走这条本地 TTS 链路。

## 常见失败原因

### 1. 能力矩阵显示“缺少本地运行时依赖”

优先看设置页中的细项状态：

- `Python 可用`
- ``qwen_tts` 模块可用`
- ``torch` 模块可用`
- ``soundfile` 模块可用`
- `运行目录可写`

通常不是功能代码坏了，而是宿主机 Python 环境没准备完整。

### 2. 模型已经下载，但还是显示不可用

常见原因：

- `Model ID` 与你下载的模型目录不一致
- 手动填写了无效的 `Model Path`
- `Tokenizer Path` 指向了错误目录
- 下载结果目录为空或不完整

### 3. 点击播放时报 Python 错误

常见原因：

- `qwen-tts` 版本与当前 runner 假设的 API 不一致
- `torch` 安装版本不匹配
- `soundfile` 依赖的底层库不可用
- 模型目录结构与当前代码约定不一致

### 4. 下载失败

常见原因：

- 当前宿主机无法访问 Hugging Face
- 没有 `huggingface-cli`
- Python 环境里没有 `huggingface_hub`

## 观察与排查建议

遇到问题时，优先看三处：

1. 设置页本地 `Qwen3-TTS` 状态卡片
2. 主进程日志中的本地 TTS 错误
3. 模型目录内是否真的有完整文件

如果设置页的 `运行时问题` 一栏已经明确指出缺失项，优先先把宿主机环境补齐，不要急着改业务代码。

## 当前阶段建议

这一版最推荐的验证顺序是：

1. 先让状态卡片全部变绿
2. 再验证手动播放
3. 再验证自动朗读

这样最符合 `KISS`，也最容易把“环境问题”和“业务逻辑问题”分开定位。

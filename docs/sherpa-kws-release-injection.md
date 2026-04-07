# Sherpa-ONNX 唤醒资源发布说明

这份说明只面向发布机维护者，目标是保证最终用户拿到 `.app` 后零安装、零配置即可使用 Sherpa-ONNX 唤醒；若 Sherpa 资源不可用，应用会自动回退到现有 `text_match` 方案。

## 资源目录

发布机默认从 `resources/sherpa-kws/` 读取一个 manifest 和多个模型子目录：

```text
resources/sherpa-kws/sherpa-kws-manifest.json
resources/sherpa-kws/sherpa-onnx-kws-zipformer-zh-en-3M-2025-12-20/
resources/sherpa-kws/sherpa-onnx-kws-zipformer-wenetspeech-3.3M-2024-01-01/
```

每个模型子目录内都包含：

```text
encoder.onnx
decoder.onnx
joiner.onnx
tokens.txt
sherpa-kws-config.json
keywords.default.txt
```

默认会打包两套模型：

1. `sherpa-onnx-kws-zipformer-zh-en-3M-2025-12-20`
2. `sherpa-onnx-kws-zipformer-wenetspeech-3.3M-2024-01-01`

默认唤醒模型是 `zh-en-3M-2025-12-20`。默认唤醒词可通过 `SHERPA_KWS_DEFAULT_WAKE_WORDS` 注入，使用英文逗号分隔：

```bash
SHERPA_KWS_DEFAULT_WAKE_WORDS="打开青书爪,初一"
```

若需要覆盖模型来源目录，可使用：

```bash
SHERPA_KWS_ZH_EN_DIR=/abs/path/to/sherpa-onnx-kws-zipformer-zh-en-3M-2025-12-20
SHERPA_KWS_WENETSPEECH_DIR=/abs/path/to/sherpa-onnx-kws-zipformer-wenetspeech-3.3M-2024-01-01
```

为兼容旧资源准备方式，`wenetspeech` 仍支持以下单文件覆盖：

```bash
SHERPA_KWS_ENCODER_PATH=/abs/path/to/encoder.onnx
SHERPA_KWS_DECODER_PATH=/abs/path/to/decoder.onnx
SHERPA_KWS_JOINER_PATH=/abs/path/to/joiner.onnx
SHERPA_KWS_TOKENS_PATH=/abs/path/to/tokens.txt
```

## 打包步骤

1. 准备两套 Sherpa 模型目录与 `tokens.txt`
2. 运行：

```bash
npm run prepare:sherpa-wake-resources
```

3. 检查生成结果：

```bash
ls build/generated/sherpa-kws
cat build/generated/sherpa-kws/sherpa-kws-manifest.json
```

4. 正常执行 mac 打包：

```bash
npm run dist:mac
```

`electron-builder` 会自动把 `build/generated/sherpa-kws/` 打进 `.app/Contents/Resources/sherpa-kws/`。

## 发布验收

至少确认以下几点：

1. 打包产物里存在 `sherpa-kws/`
2. `sherpa-kws-manifest.json` 存在，且包含 `zh-en` 与 `wenetspeech` 两个模型
3. 两个模型子目录都包含 `encoder/decoder/joiner/tokens/sherpa-kws-config.json`
4. 应用启动后无需额外下载模型或配置环境变量
5. Sherpa 启动失败时，日志里能看到自动回退到 `text_match`
6. 手动麦克风输入与正文听写不受影响

## 失败策略

以下任一情况出现时，应用会自动回退到 `text_match`：

1. `sherpa-kws-manifest.json` 或所选模型的 `sherpa-kws-config.json` 缺失
2. 所选模型的 `encoder/decoder/joiner/tokens` 任一资源缺失
3. 所选模型无法为当前唤醒词生成有效 `keywords.txt`
4. Sherpa 运行时异常

因此即使某次发布的 Sherpa 资源未准备完整，客户端主功能仍然可交付，只是后台唤醒会退回现有方案。

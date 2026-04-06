# Sherpa-ONNX 唤醒资源发布说明

这份说明只面向发布机维护者，目标是保证最终用户拿到 `.app` 后零安装、零配置即可使用 Sherpa-ONNX 唤醒；若 Sherpa 资源不可用，应用会自动回退到现有 `text_match` 方案。

## 资源目录

发布机默认从 `resources/sherpa-kws/` 读取以下文件：

```text
resources/sherpa-kws/encoder.onnx
resources/sherpa-kws/decoder.onnx
resources/sherpa-kws/joiner.onnx
resources/sherpa-kws/tokens.txt
```

也可以通过以下环境变量覆盖单个文件路径：

```bash
SHERPA_KWS_ENCODER_PATH=/abs/path/to/encoder.onnx
SHERPA_KWS_DECODER_PATH=/abs/path/to/decoder.onnx
SHERPA_KWS_JOINER_PATH=/abs/path/to/joiner.onnx
SHERPA_KWS_TOKENS_PATH=/abs/path/to/tokens.txt
```

默认唤醒词可通过 `SHERPA_KWS_DEFAULT_WAKE_WORDS` 注入，使用英文逗号分隔：

```bash
SHERPA_KWS_DEFAULT_WAKE_WORDS="打开青书爪,初一"
```

## 打包步骤

1. 准备 Sherpa 模型与 `tokens.txt`
2. 运行：

```bash
npm run prepare:sherpa-wake-resources
```

3. 检查生成结果：

```bash
ls build/generated/sherpa-kws
cat build/generated/sherpa-kws/sherpa-kws-config.json
```

4. 正常执行 mac 打包：

```bash
npm run dist:mac
```

`electron-builder` 会自动把 `build/generated/sherpa-kws/` 打进 `.app/Contents/Resources/sherpa-kws/`。

## 发布验收

至少确认以下几点：

1. 打包产物里存在 `sherpa-kws/`
2. 应用启动后无需额外下载模型或配置环境变量
3. Sherpa 启动失败时，日志里能看到自动回退到 `text_match`
4. 手动麦克风输入与正文听写不受影响

## 失败策略

以下任一情况出现时，应用会自动回退到 `text_match`：

1. `sherpa-kws-config.json` 缺失
2. `encoder/decoder/joiner/tokens` 任一资源缺失
3. 默认唤醒词无法生成 `keywords.txt`
4. Sherpa 运行时异常

因此即使某次发布的 Sherpa 资源未准备完整，客户端主功能仍然可交付，只是后台唤醒会退回现有方案。

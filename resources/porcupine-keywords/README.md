此目录仅供研发/发布流程准备 Porcupine 关键词模型，不面向最终用户。

打包前脚本会优先从以下来源收集资源并写入 `build/generated/porcupine-keywords/`：

- `PORCUPINE_ACCESS_KEY`
- `PORCUPINE_KEYWORD_OPEN_QINGSHUCLAW_PATH`
- `PORCUPINE_KEYWORD_CHUYI_PATH`
- 或当前目录下的默认文件：
  - `open-qingshuclaw-mac.ppn`
  - `chu-yi-mac.ppn`

最终用户只需要使用打包后的应用，不需要手动复制 `.ppn` 或配置环境变量。

若打包时未准备好 Porcupine 资源，应用会自动回退到现有的 `text_match` 唤醒方案。

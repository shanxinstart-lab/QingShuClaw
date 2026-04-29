const LEGACY_FEISHU_PLUGIN_ENTRY_ID = 'feishu';

const isRecord = (value: unknown): value is Record<string, unknown> => {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
};

export function enforceLegacyFeishuPluginDisabled(config: Record<string, unknown>): void {
  const plugins = isRecord(config.plugins) ? config.plugins : {};
  const entries = isRecord(plugins.entries) ? plugins.entries : {};
  const legacyFeishuEntry = isRecord(entries[LEGACY_FEISHU_PLUGIN_ENTRY_ID])
    ? entries[LEGACY_FEISHU_PLUGIN_ENTRY_ID]
    : {};

  entries[LEGACY_FEISHU_PLUGIN_ENTRY_ID] = {
    ...legacyFeishuEntry,
    enabled: false,
  };
  plugins.entries = entries;
  config.plugins = plugins;
}

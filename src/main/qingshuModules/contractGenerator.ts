import type {
  QingShuSharedToolCatalogSummary,
  QingShuSharedToolContractArtifacts,
  QingShuSharedToolContractPayload,
  QingShuSharedToolDescriptor,
} from './types';

const DEFAULT_MARKDOWN_PATH = 'generated/qingshu-shared-tools.md';
const DEFAULT_JSON_PATH = 'generated/qingshu-shared-tools.json';

const normalizeSchemaForJson = (inputSchema?: Record<string, unknown>): Record<string, unknown> | null => {
  if (!inputSchema || typeof inputSchema !== 'object') {
    return null;
  }
  return inputSchema;
};

const formatSchemaInline = (tool: QingShuSharedToolDescriptor): string => {
  const schema = normalizeSchemaForJson(tool.inputSchema);
  if (!schema) {
    return 'none';
  }
  return `\`${JSON.stringify(schema)}\``;
};

const buildPayload = (
  summary: QingShuSharedToolCatalogSummary,
): QingShuSharedToolContractPayload => {
  return {
    generatedAt: summary.generatedAt,
    modules: summary.modules,
    bundles: summary.bundles,
    tools: summary.tools.map((tool) => ({
      ...tool,
      ...(normalizeSchemaForJson(tool.inputSchema)
        ? { inputSchema: normalizeSchemaForJson(tool.inputSchema) ?? undefined }
        : {}),
    })),
  };
};

const buildMarkdown = (payload: QingShuSharedToolContractPayload): string => {
  const lines: string[] = [
    '# QingShu Shared Tools',
    '',
    `Generated at: ${payload.generatedAt}`,
    '',
    '## Bundles',
    '',
  ];

  if (payload.bundles.length === 0) {
    lines.push('- none', '');
  } else {
    for (const bundle of payload.bundles) {
      lines.push(
        `- \`${bundle.bundle}\``,
        `  modules: ${bundle.moduleIds.length > 0 ? bundle.moduleIds.map((moduleId) => `\`${moduleId}\``).join(', ') : 'none'}`,
        `  tools: ${bundle.toolNames.length > 0 ? bundle.toolNames.map((toolName) => `\`${toolName}\``).join(', ') : 'none'}`,
      );
    }
    lines.push('');
  }

  lines.push('## Tools', '');

  if (payload.tools.length === 0) {
    lines.push('- none');
  } else {
    for (const tool of payload.tools) {
      lines.push(
        `### \`${tool.toolName}\``,
        '',
        `- capability: \`${tool.capabilityKey}\``,
        `- module: \`${tool.module}\``,
        `- bundle: \`${tool.bundle}\``,
        `- audience: \`${tool.audience}\``,
        `- stability: \`${tool.stability}\``,
        `- danger: \`${tool.dangerLevel}\``,
        `- description: ${tool.description}`,
        `- inputSchema: ${formatSchemaInline(tool)}`,
        '',
      );
    }
  }

  return lines.join('\n').trimEnd();
};

export const generateQingShuSharedToolContracts = (
  summary: QingShuSharedToolCatalogSummary,
): QingShuSharedToolContractArtifacts => {
  const payload = buildPayload(summary);
  return {
    payload,
    markdown: buildMarkdown(payload),
    json: JSON.stringify(payload, null, 2),
    suggestedMarkdownPath: DEFAULT_MARKDOWN_PATH,
    suggestedJsonPath: DEFAULT_JSON_PATH,
  };
};

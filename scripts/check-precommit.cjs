'use strict';

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const repoRoot = path.resolve(__dirname, '..');
process.chdir(repoRoot);

const scanAllTracked = process.argv.includes('--all-tracked');

const blockedPathRules = [
  { pattern: /(^|\/)\.env(?:\..*)?$/i, reason: '禁止提交 .env 类环境文件' },
  { pattern: /(^|\/)node_modules\//, reason: '禁止提交 node_modules 依赖目录' },
  { pattern: /(^|\/)dist\//, reason: '禁止提交 dist 构建产物' },
  { pattern: /(^|\/)dist-electron\//, reason: '禁止提交 dist-electron 构建产物' },
  { pattern: /(^|\/)release\//, reason: '禁止提交 release 打包产物' },
  { pattern: /(^|\/)coverage\//, reason: '禁止提交 coverage 测试产物' },
  { pattern: /(^|\/)\.nyc_output\//, reason: '禁止提交 nyc 输出目录' },
  { pattern: /(^|\/)build\/generated\//, reason: '禁止提交 build/generated 生成产物' },
  { pattern: /(^|\/)build-tar\//, reason: '禁止提交 build-tar 打包中间产物' },
  { pattern: /(^|\/)resources\/macos-speech\//, reason: '禁止提交本地生成的 macOS speech 资源' },
  { pattern: /(^|\/)resources\/mingit\//, reason: '禁止提交本地下载的 MinGit 运行时' },
  { pattern: /(^|\/)vendor\/openclaw-runtime\//, reason: '禁止直接提交本地 OpenClaw 运行时目录' },
  { pattern: /(^|\/)vendor\/openclaw-plugins\//, reason: '禁止直接提交本地 OpenClaw 插件目录' },
  { pattern: /(^|\/)\.idea\//, reason: '禁止提交本地 IDE 工作区文件' },
  { pattern: /\.(pem|p12|pfx|key|crt|cer)$/i, reason: '禁止提交证书或私钥文件' },
];

const contentRules = [
  { regex: /BEGIN (?:RSA |DSA |EC |OPENSSH )?PRIVATE KEY|BEGIN PGP PRIVATE KEY BLOCK/, reason: '疑似私钥内容' },
  { regex: /ghp_[A-Za-z0-9]{20,}|gho_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,}/, reason: '疑似 GitHub Token' },
  { regex: /glpat-[A-Za-z0-9\-_]{20,}/, reason: '疑似 GitLab Token' },
  { regex: /xox[baprs]-[A-Za-z0-9-]{20,}/, reason: '疑似 Slack Token' },
  { regex: /AKIA[0-9A-Z]{16}|ASIA[0-9A-Z]{16}/, reason: '疑似 AWS Access Key' },
  { regex: /AIza[0-9A-Za-z\-_]{20,}/, reason: '疑似 Google API Key' },
  { regex: /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9._-]{10,}\.[A-Za-z0-9._-]{10,}\b/, reason: '疑似 JWT Token' },
  { regex: /https?:\/\/[^\s:@/]+:[^\s:@/]+@/i, reason: '疑似带账号密码的 URL' },
  { regex: /Bearer\s+[A-Za-z0-9._-]{20,}/, reason: '疑似 Bearer Token' },
  { regex: /(?:sk|rk|pk)_[A-Za-z0-9]{20,}|sk-[A-Za-z0-9]{20,}/, reason: '疑似 API Secret' },
];

const propertyAssignmentPattern =
  /(?:^|[,{]\s*)(appSecret|clientSecret|apiKey|accessToken|refreshToken|token)\s*:\s*['"`]([^'"`\n]{12,})['"`]/g;
const variableAssignmentPattern =
  /\b(?:const|let|var)\s+(appSecret|clientSecret|apiKey|accessToken|refreshToken|token)\s*=\s*['"`]([^'"`\n]{12,})['"`]/g;
const contentScanIgnoreFiles = new Set([
  'scripts/check-precommit.cjs',
  'security-audit-checklist.md',
]);

function runGit(args, options = {}) {
  const result = spawnSync('git', args, {
    cwd: repoRoot,
    encoding: options.encoding || null,
    maxBuffer: 10 * 1024 * 1024,
  });

  if (result.status !== 0) {
    const stderr = options.encoding === 'utf8' || typeof result.stderr === 'string'
      ? result.stderr
      : result.stderr.toString('utf8');
    throw new Error(stderr || `git ${args.join(' ')} failed`);
  }

  return result.stdout;
}

function getTargetFiles() {
  const args = scanAllTracked
    ? ['ls-files', '-z']
    : ['diff', '--cached', '--name-only', '--diff-filter=ACMR', '-z'];
  const output = runGit(args);
  return output
    .toString('utf8')
    .split('\0')
    .map((item) => item.trim())
    .filter(Boolean);
}

function readTargetFile(filePath) {
  if (scanAllTracked) {
    return fs.readFileSync(path.join(repoRoot, filePath));
  }
  return runGit(['show', `:${filePath}`]);
}

function isBinary(buffer) {
  return buffer.includes(0);
}

function isPlaceholderValue(value) {
  const normalized = value.trim();
  if (!normalized) {
    return true;
  }

  return (
    /^\$\{[A-Z0-9_]+\}$/.test(normalized)
    || /^<[^>]+>$/.test(normalized)
    || /^(?:test|dummy|example|sample|placeholder|changeme|replace-me|null|undefined)$/i.test(normalized)
    || /^(?:your|mock|fake)[-_a-z0-9]*$/i.test(normalized)
    || /^sk-(?:test|xxx|lobsterai-local)$/i.test(normalized)
    || /^(?:proxy-managed|qq-app-secret|qq-app-token|access-token-xyz|refresh-token-xyz)$/i.test(normalized)
    || /\b(?:app|client|access|refresh)[-_]?(?:secret|token)\b/i.test(normalized)
    || /^https?:\/\/(?:localhost|127\.0\.0\.1|0\.0\.0\.0)(?::\d+)?(?:\/.*)?$/i.test(normalized)
  );
}

function shouldRunAssignmentScan(file) {
  return /\.(?:cjs|mjs|js|ts|tsx|json|ya?ml|toml|ini|conf|env)$/i.test(file);
}

function shouldRunContentScan(file) {
  return !contentScanIgnoreFiles.has(file);
}

function collectFindings() {
  const findings = [];
  const files = getTargetFiles();

  if (files.length === 0) {
    return findings;
  }

  for (const file of files) {
    for (const rule of blockedPathRules) {
      if (rule.pattern.test(file)) {
        findings.push({ file, line: null, reason: rule.reason, preview: file });
      }
    }

    let buffer;
    try {
      buffer = readTargetFile(file);
    } catch (error) {
      findings.push({
        file,
        line: null,
        reason: '无法读取待提交内容，请人工检查',
        preview: error instanceof Error ? error.message : String(error),
      });
      continue;
    }

    if (isBinary(buffer)) {
      continue;
    }

    const text = buffer.toString('utf8');
    const lines = text.split(/\r?\n/);

    lines.forEach((lineText, index) => {
      if (shouldRunContentScan(file)) {
        for (const rule of contentRules) {
          if (rule.regex.test(lineText)) {
            findings.push({
              file,
              line: index + 1,
              reason: rule.reason,
              preview: lineText.trim().slice(0, 180),
            });
          }
        }
      }

      if (shouldRunAssignmentScan(file)) {
        for (const pattern of [propertyAssignmentPattern, variableAssignmentPattern]) {
          pattern.lastIndex = 0;
          let match;
          while ((match = pattern.exec(lineText)) !== null) {
            const value = match[2] || '';
            if (isPlaceholderValue(value)) {
              continue;
            }
            findings.push({
              file,
              line: index + 1,
              reason: `疑似硬编码敏感字段 ${match[1]}`,
              preview: lineText.trim().slice(0, 180),
            });
          }
        }
      }
    });
  }

  return findings;
}

function printFindings(findings) {
  console.error('\n[pre-commit] 检测到疑似敏感信息或不应提交的生成产物：\n');
  for (const finding of findings) {
    const location = finding.line == null ? finding.file : `${finding.file}:${finding.line}`;
    console.error(`- ${location}`);
    console.error(`  原因: ${finding.reason}`);
    if (finding.preview) {
      console.error(`  片段: ${finding.preview}`);
    }
  }

  console.error('\n建议处理方式：');
  console.error('- 确认真的是测试占位符时，先改成更明确的占位格式再提交');
  console.error('- 真实 secret 请改为从环境变量、本地配置或 SQLite/Keychain 读取');
  console.error('- 生成产物请加入 .gitignore，不要直接提交');
  console.error('- 可先运行 `git reset HEAD <file>` 取消暂存，再修复内容');
}

function main() {
  try {
    const findings = collectFindings();
    if (findings.length === 0) {
      console.log(scanAllTracked
        ? '[check-precommit] 已扫描全部已跟踪文件，未发现明显 secret。'
        : '[check-precommit] 已扫描 staged 内容，未发现明显 secret。');
      process.exit(0);
    }

    printFindings(findings);
    process.exit(1);
  } catch (error) {
    console.error('[check-precommit] 扫描失败：', error instanceof Error ? error.message : String(error));
    process.exit(2);
  }
}

main();

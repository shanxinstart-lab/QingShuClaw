import { describe, expect, test } from 'vitest';

import { extractDiffFromToolInput } from './DiffView';

describe('extractDiffFromToolInput', () => {
  test('extracts top-level MultiEdit old/new fields', () => {
    expect(extractDiffFromToolInput('MultiEdit', {
      file_path: '/tmp/example.ts',
      oldText: 'const value = 1;',
      newText: 'const value = 2;',
    })).toEqual([
      {
        filePath: '/tmp/example.ts',
        oldStr: 'const value = 1;',
        newStr: 'const value = 2;',
      },
    ]);
  });

  test('extracts MultiEdit edits array fields with shared file path', () => {
    expect(extractDiffFromToolInput('multi_edit', {
      path: '/tmp/example.ts',
      edits: [
        { old_string: 'alpha', new_string: 'beta' },
        { search: 'gamma', replace: 'delta' },
      ],
    })).toEqual([
      { filePath: '/tmp/example.ts', oldStr: 'alpha', newStr: 'beta' },
      { filePath: '/tmp/example.ts', oldStr: 'gamma', newStr: 'delta' },
    ]);
  });

  test('extracts Edit edits array fields from OpenClaw format', () => {
    expect(extractDiffFromToolInput('Edit', {
      path: '/tmp/openclaw.ts',
      edits: [
        { oldText: 'const enabled = false;', newText: 'const enabled = true;' },
      ],
    })).toEqual([
      {
        filePath: '/tmp/openclaw.ts',
        oldStr: 'const enabled = false;',
        newStr: 'const enabled = true;',
      },
    ]);
  });

  test('returns null for unsupported tool inputs', () => {
    expect(extractDiffFromToolInput('Read', { file_path: '/tmp/example.ts' })).toBeNull();
  });
});

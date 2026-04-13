import { describe, expect, test } from 'vitest';
import {
  buildAgentBundleSaveWarningState,
  buildAgentBundleSaveWarningSignature,
  evaluateAgentBundleSaveGuard,
} from './agentBundleSaveGuard';

describe('agentBundleSaveGuard', () => {
  test('requires a second confirmation when missing bundles exist', () => {
    const result = evaluateAgentBundleSaveGuard({
      skillIds: [' skill-b ', 'skill-a'],
      toolBundleIds: ['order-basic'],
      missingBundles: ['lbs-analysis', ' lbs-analysis '],
      acknowledgedSignature: null,
    });

    expect(result).toEqual({
      warningSignature: JSON.stringify({
        skillIds: ['skill-a', 'skill-b'],
        toolBundleIds: ['order-basic'],
        missingBundles: ['lbs-analysis'],
      }),
      shouldConfirm: true,
    });
  });

  test('allows saving on the second click for the same configuration', () => {
    const signature = buildAgentBundleSaveWarningSignature(
      ['skill-a'],
      ['order-basic'],
      ['lbs-analysis'],
    );

    expect(evaluateAgentBundleSaveGuard({
      skillIds: ['skill-a'],
      toolBundleIds: ['order-basic'],
      missingBundles: ['lbs-analysis'],
      acknowledgedSignature: signature,
    })).toEqual({
      warningSignature: signature,
      shouldConfirm: false,
    });
  });

  test('requires confirmation again when the configuration changes', () => {
    const previousSignature = buildAgentBundleSaveWarningSignature(
      ['skill-a'],
      ['order-basic'],
      ['lbs-analysis'],
    );

    const result = evaluateAgentBundleSaveGuard({
      skillIds: ['skill-a'],
      toolBundleIds: ['inventory-readonly'],
      missingBundles: ['lbs-analysis'],
      acknowledgedSignature: previousSignature,
    });

    expect(result.warningSignature).not.toBe(previousSignature);
    expect(result.shouldConfirm).toBe(true);
  });

  test('does not require confirmation when no bundles are missing', () => {
    expect(evaluateAgentBundleSaveGuard({
      skillIds: ['skill-a'],
      toolBundleIds: ['order-basic'],
      missingBundles: [],
      acknowledgedSignature: null,
    })).toEqual({
      warningSignature: null,
      shouldConfirm: false,
    });
  });

  test('builds a compact warning state for footer presentation', () => {
    expect(buildAgentBundleSaveWarningState([
      ' lbs-analysis ',
      'order-basic',
      'inventory-readonly',
      'order-basic',
    ], 2)).toEqual({
      missingBundles: ['inventory-readonly', 'lbs-analysis', 'order-basic'],
      previewBundles: ['inventory-readonly', 'lbs-analysis'],
      hiddenBundleCount: 1,
    });
  });

  test('returns null warning state when no missing bundles exist', () => {
    expect(buildAgentBundleSaveWarningState([])).toBeNull();
  });
});

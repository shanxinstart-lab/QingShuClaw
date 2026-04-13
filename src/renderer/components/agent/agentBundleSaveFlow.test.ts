import { describe, expect, test } from 'vitest';
import { resolveAgentBundleSaveFlow } from './agentBundleSaveFlow';

describe('agentBundleSaveFlow', () => {
  test('blocks the first save attempt and requests a second confirmation', () => {
    const result = resolveAgentBundleSaveFlow({
      skillIds: ['skill-a'],
      toolBundleIds: ['order-basic'],
      missingBundles: ['lbs-analysis'],
      acknowledgedSignature: null,
    });

    expect(result.allowSave).toBe(false);
    expect(result.shouldFocusSkillsTab).toBe(true);
    expect(result.nextAcknowledgedSignature).toBeTruthy();
    expect(result.nextMissingBundles).toEqual(['lbs-analysis']);
  });

  test('allows the second save attempt for the same configuration', () => {
    const firstAttempt = resolveAgentBundleSaveFlow({
      skillIds: ['skill-a'],
      toolBundleIds: ['order-basic'],
      missingBundles: ['lbs-analysis'],
      acknowledgedSignature: null,
    });

    const secondAttempt = resolveAgentBundleSaveFlow({
      skillIds: ['skill-a'],
      toolBundleIds: ['order-basic'],
      missingBundles: ['lbs-analysis'],
      acknowledgedSignature: firstAttempt.nextAcknowledgedSignature,
    });

    expect(secondAttempt).toEqual({
      allowSave: true,
      nextAcknowledgedSignature: firstAttempt.nextAcknowledgedSignature,
      nextMissingBundles: ['lbs-analysis'],
      shouldFocusSkillsTab: false,
    });
  });

  test('requires confirmation again after the bundle configuration changes', () => {
    const firstAttempt = resolveAgentBundleSaveFlow({
      skillIds: ['skill-a'],
      toolBundleIds: ['order-basic'],
      missingBundles: ['lbs-analysis'],
      acknowledgedSignature: null,
    });

    const changedAttempt = resolveAgentBundleSaveFlow({
      skillIds: ['skill-a'],
      toolBundleIds: ['inventory-readonly'],
      missingBundles: ['lbs-analysis'],
      acknowledgedSignature: firstAttempt.nextAcknowledgedSignature,
    });

    expect(changedAttempt.allowSave).toBe(false);
    expect(changedAttempt.shouldFocusSkillsTab).toBe(true);
    expect(changedAttempt.nextAcknowledgedSignature).not.toBe(firstAttempt.nextAcknowledgedSignature);
  });

  test('passes through directly when no bundle is missing', () => {
    expect(resolveAgentBundleSaveFlow({
      skillIds: ['skill-a'],
      toolBundleIds: ['order-basic'],
      missingBundles: [],
      acknowledgedSignature: null,
    })).toEqual({
      allowSave: true,
      nextAcknowledgedSignature: null,
      nextMissingBundles: [],
      shouldFocusSkillsTab: false,
    });
  });
});

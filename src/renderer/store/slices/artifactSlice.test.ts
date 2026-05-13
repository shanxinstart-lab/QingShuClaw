import { describe, expect, test } from 'vitest';

import type { Artifact } from '../../types/artifact';
import reducer, {
  addArtifact,
  clearSessionArtifacts,
  selectArtifact,
  setPanelWidth,
} from './artifactSlice';

const makeArtifact = (overrides: Partial<Artifact> = {}): Artifact => ({
  id: 'artifact-1',
  messageId: 'msg-1',
  sessionId: 'session-1',
  type: 'document',
  title: 'Report',
  content: '',
  fileName: 'report.pdf',
  filePath: 'D:\\workspace\\report.pdf',
  source: 'tool',
  createdAt: 1,
  ...overrides,
});

describe('artifactSlice', () => {
  test('deduplicates artifacts by normalized file path', () => {
    const first = reducer(undefined, addArtifact({
      sessionId: 'session-1',
      artifact: makeArtifact({
        id: 'tool-artifact',
        filePath: 'D:\\workspace\\report.pdf',
      }),
    }));

    const next = reducer(first, addArtifact({
      sessionId: 'session-1',
      artifact: makeArtifact({
        id: 'link-artifact',
        title: 'Report Link',
        filePath: '/D:/workspace/report.pdf',
      }),
    }));

    expect(next.artifactsBySession['session-1']).toHaveLength(1);
    expect(next.artifactsBySession['session-1'][0].filePath).toBe('/D:/workspace/report.pdf');
  });

  test('replaces duplicate file artifact when newer artifact has content', () => {
    const first = reducer(undefined, addArtifact({
      sessionId: 'session-1',
      artifact: makeArtifact({
        id: 'link-artifact',
        content: '',
        filePath: '/D:/workspace/report.md',
      }),
    }));

    const next = reducer(first, addArtifact({
      sessionId: 'session-1',
      artifact: makeArtifact({
        id: 'tool-artifact',
        content: '# Report',
        filePath: 'D:\\workspace\\report.md',
      }),
    }));

    expect(next.artifactsBySession['session-1']).toHaveLength(1);
    expect(next.artifactsBySession['session-1'][0]).toMatchObject({
      id: 'tool-artifact',
      content: '# Report',
    });
  });

  test('keeps existing duplicate file artifact when incoming artifact has no content', () => {
    const first = reducer(undefined, addArtifact({
      sessionId: 'session-1',
      artifact: makeArtifact({
        id: 'tool-artifact',
        content: '<html>preview</html>',
        filePath: 'D:\\workspace\\preview.html',
      }),
    }));

    const next = reducer(first, addArtifact({
      sessionId: 'session-1',
      artifact: makeArtifact({
        id: 'link-artifact',
        content: '',
        filePath: '/D:/workspace/preview.html',
      }),
    }));

    expect(next.artifactsBySession['session-1']).toHaveLength(1);
    expect(next.artifactsBySession['session-1'][0]).toMatchObject({
      id: 'tool-artifact',
      content: '<html>preview</html>',
      filePath: 'D:\\workspace\\preview.html',
    });
  });

  test('selecting an artifact opens preview panel state', () => {
    const next = reducer(undefined, selectArtifact('artifact-1'));

    expect(next.selectedArtifactId).toBe('artifact-1');
    expect(next.isPanelOpen).toBe(true);
    expect(next.panelView).toBe('preview');
    expect(next.activeTab).toBe('preview');
  });

  test('panel width is clamped', () => {
    const small = reducer(undefined, setPanelWidth(1));
    const large = reducer(small, setPanelWidth(9999));

    expect(small.panelWidth).toBe(180);
    expect(large.panelWidth).toBe(1000);
  });

  test('clearing a session removes its artifacts and selection', () => {
    const first = reducer(undefined, addArtifact({
      sessionId: 'session-1',
      artifact: makeArtifact(),
    }));
    const selected = reducer(first, selectArtifact('artifact-1'));
    const next = reducer(selected, clearSessionArtifacts('session-1'));

    expect(next.artifactsBySession['session-1']).toBeUndefined();
    expect(next.selectedArtifactId).toBeNull();
  });
});

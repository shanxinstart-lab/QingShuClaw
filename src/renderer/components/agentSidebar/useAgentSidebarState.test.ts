import { expect, test } from 'vitest';

import {
  type CoworkSessionStatus,
  CoworkSessionStatusValue,
  type CoworkSessionSummary,
} from '../../types/cowork';
import {
  collapseAgentSidebarTaskList,
  sortAgentSidebarTasks,
} from './useAgentSidebarState';

const makeSession = (
  id: string,
  createdAt: number,
  status: CoworkSessionStatus = CoworkSessionStatusValue.Completed,
  pinned = false,
  pinOrder: number | null = null,
): CoworkSessionSummary => ({
  id,
  title: id,
  status,
  pinned,
  pinOrder,
  agentId: 'main',
  createdAt,
  updatedAt: Date.now() - createdAt,
});

test('sortAgentSidebarTasks keeps unpinned tasks ordered by creation time', () => {
  const sorted = sortAgentSidebarTasks([
    makeSession('older-running', 100, CoworkSessionStatusValue.Running),
    makeSession('newer', 300),
    makeSession('middle', 200),
  ]);

  expect(sorted.map((session) => session.id)).toEqual([
    'newer',
    'middle',
    'older-running',
  ]);
});

test('sortAgentSidebarTasks keeps pinned tasks in first-pinned-first order', () => {
  const sorted = sortAgentSidebarTasks([
    makeSession('newer-unpinned', 400),
    makeSession('second-pinned', 100, CoworkSessionStatusValue.Completed, true, 2),
    makeSession('middle-unpinned', 300),
    makeSession('first-pinned', 200, CoworkSessionStatusValue.Completed, true, 1),
  ]);

  expect(sorted.map((session) => session.id)).toEqual([
    'first-pinned',
    'second-pinned',
    'newer-unpinned',
    'middle-unpinned',
  ]);
});

test('collapseAgentSidebarTaskList resets one agent history list to preview mode', () => {
  expect(collapseAgentSidebarTaskList(['agent-1', 'agent-2'], 'agent-1')).toEqual(['agent-2']);
});

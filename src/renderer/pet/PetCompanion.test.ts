import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, test, vi } from 'vitest';

import { DEFAULT_PET_CONFIG } from '../../shared/pet/config';
import { PetMode, PetSource, PetStatus } from '../../shared/pet/constants';
import type { PetCatalogEntry, PetRuntimeState } from '../../shared/pet/types';
import PetCompanion, { PetMenu, PetSessionNotification } from './PetCompanion';

vi.mock('./petService', () => ({
  petService: {
    setConfig: vi.fn(),
    setFloatingVisible: vi.fn(),
    acknowledgeSession: vi.fn(),
  },
}));

const pet: PetCatalogEntry = {
  id: 'codex',
  displayName: 'Codex',
  description: 'Codex pet',
  source: PetSource.Bundled,
  bundled: true,
  installed: true,
  selectable: true,
  manifest: {
    id: 'codex',
    displayName: 'Codex',
    description: 'Codex pet',
    spritesheetPath: '/tmp/codex-pet.webp',
    frame: { width: 192, height: 208, columns: 8, rows: 9 },
    animations: {
      idle: {
        frames: [{ spriteIndex: 0, durationMs: 1000 }],
        loopStart: 0,
        fallback: 'idle',
      },
      running: {
        frames: [{ spriteIndex: 56, durationMs: 120 }],
        loopStart: 0,
        fallback: 'idle',
      },
    },
  },
};

const floatingState = (): PetRuntimeState => ({
  config: {
    ...DEFAULT_PET_CONFIG,
    enabled: true,
    mode: PetMode.Floating,
    floatingWindow: {
      ...DEFAULT_PET_CONFIG.floatingWindow,
      visible: true,
    },
  },
  status: PetStatus.Running,
  message: 'Thinking',
  session: null,
  activePet: pet,
  pets: [pet],
  activeSessions: [
    {
      id: 'session-1',
      title: 'Session one',
      status: PetStatus.Running,
      message: 'Working on the first task',
      progressLabel: 'Loading',
      updatedAt: 20,
    },
    {
      id: 'session-2',
      title: 'Session two',
      status: PetStatus.Review,
      message: 'Ready for review',
      progressLabel: 'Ready',
      updatedAt: 10,
    },
  ],
});

describe('PetCompanion floating notifications', () => {
  test('renders the collapse badge on the pet while the activity tray is open', () => {
    const markup = renderToStaticMarkup(React.createElement(PetCompanion, {
      state: floatingState(),
      variant: 'floating',
    }));

    expect(markup).toContain('aria-label="收起活动"');
    expect(markup).toContain('right-[118px] top-3');
    expect(markup).toContain('role="list"');
    expect(markup).toContain('活动通知');
    expect(markup).toContain('h-7 w-7');
    expect(markup).not.toContain('Show sessions');
    expect(markup).not.toContain('Hide sessions');
  });

  test('keeps each session individually collapsible', () => {
    const markup = renderToStaticMarkup(React.createElement(PetCompanion, {
      state: floatingState(),
      variant: 'floating',
    }));

    expect(markup).toContain('aria-label="关闭会话"');
    expect(markup).toContain('aria-label="回复会话"');
    expect(markup).toContain('rounded-[18px]');
  });

  test('renders a collapsed Codex-style notification row when requested', () => {
    const session = {
      ...floatingState().activeSessions[0],
      message: 'Working on the first task with a longer activity summary that should expose the expand control just like Codex does for taller notification rows.',
    };
    const markup = renderToStaticMarkup(React.createElement(PetSessionNotification, {
      session,
      collapsed: true,
      onActivate: vi.fn(),
      onClose: vi.fn(),
      onToggleExpanded: vi.fn(),
    }));

    expect(markup).toContain('Session one');
    expect(markup).toContain('line-clamp-2');
    expect(markup).toContain('aria-label="展开会话"');
    expect(markup).toContain('回复会话');
  });

  test('keeps the floating context menu scoped to closing the overlay', () => {
    const state = floatingState();
    const markup = renderToStaticMarkup(React.createElement(PetMenu, {
      pet,
      state,
      isFloating: true,
      positionClass: 'right-3 top-3',
      onClosePet: vi.fn(),
      onDismiss: vi.fn(),
    }));

    expect(markup).toContain('关闭宠物');
    expect(markup).toContain('Codex');
    expect(markup).toContain(state.config.floatingWindow.visible ? 'right-3 top-3' : '');
    expect(markup).not.toContain('打开宠物设置');
    expect(markup).not.toContain('隐藏宠物');
  });

  test('keeps the embedded context menu with the full pet controls', () => {
    const baseState = floatingState();
    const state = {
      ...baseState,
      config: {
        ...baseState.config,
        mode: PetMode.Embedded,
      },
      activeSessions: [],
    };
    const markup = renderToStaticMarkup(React.createElement(PetMenu, {
      pet,
      state,
      isFloating: false,
      positionClass: 'right-0 bottom-full mb-2',
      onClosePet: vi.fn(),
      onDismiss: vi.fn(),
    }));

    expect(markup).toContain('打开宠物设置');
    expect(markup).toContain('隐藏宠物');
    expect(markup).not.toContain('关闭宠物');
  });
});

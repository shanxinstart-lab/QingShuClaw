import { describe, expect, test } from 'vitest';

import { PlatformRegistry } from './constants';

describe('PlatformRegistry', () => {
  test('resolves primary channels and aliases to the same platform', () => {
    expect(PlatformRegistry.platformOfChannel('dingtalk')).toBe('dingtalk');
    expect(PlatformRegistry.platformOfChannel('dingtalk-connector')).toBe('dingtalk');
    expect(PlatformRegistry.platformOfChannel('wecom')).toBe('wecom');
    expect(PlatformRegistry.platformOfChannel('wecom-openclaw-plugin')).toBe('wecom');
    expect(PlatformRegistry.platformOfChannel('moltbot-popo')).toBe('popo');
    expect(PlatformRegistry.platformOfChannel('popo')).toBe('popo');
    expect(PlatformRegistry.platformOfChannel('email')).toBe('email');
    expect(PlatformRegistry.platformOfChannel('clawemail')).toBe('email');
    expect(PlatformRegistry.platformOfChannel('clawemail-email')).toBe('email');
  });

  test('recognizes both legacy and plugin channel identifiers as IM channels', () => {
    expect(PlatformRegistry.isIMChannel('dingtalk')).toBe(true);
    expect(PlatformRegistry.isIMChannel('dingtalk-connector')).toBe(true);
    expect(PlatformRegistry.isIMChannel('wecom')).toBe(true);
    expect(PlatformRegistry.isIMChannel('wecom-openclaw-plugin')).toBe(true);
    expect(PlatformRegistry.isIMChannel('email')).toBe(true);
    expect(PlatformRegistry.isIMChannel('clawemail')).toBe(true);
    expect(PlatformRegistry.isIMChannel('clawemail-email')).toBe(true);
    expect(PlatformRegistry.isIMChannel('unknown-channel')).toBe(false);
  });

  test('keeps scheduled-task channel options on canonical plugin channels', () => {
    const values = PlatformRegistry.channelOptions().map(option => option.value);

    expect(values).toContain('dingtalk-connector');
    expect(values).toContain('wecom');
    expect(values).toContain('email');
    expect(values).not.toContain('dingtalk');
    expect(values).not.toContain('wecom-openclaw-plugin');
    expect(values).not.toContain('clawemail-email');
  });

  test('keeps china and global platform groups stable', () => {
    expect(PlatformRegistry.platformsByRegion('china')).toEqual([
      'weixin',
      'dingtalk',
      'feishu',
      'wecom',
      'qq',
      'nim',
      'netease-bee',
      'popo',
      'email',
    ]);
    expect(PlatformRegistry.platformsByRegion('global')).toEqual(['telegram', 'discord']);
  });
});

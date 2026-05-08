import { describe, expect, test } from 'vitest';

import {
  AgentAvatarColor,
  AgentAvatarGlyph,
  DefaultAgentAvatar,
  DefaultAgentAvatarIcon,
  encodeAgentAvatarIcon,
  isDesignedAgentAvatarIcon,
  parseAgentAvatarIcon,
} from './avatar';

describe('agent avatar icon encoding', () => {
  test('round-trips designed avatar selections', () => {
    const value = encodeAgentAvatarIcon({
      color: AgentAvatarColor.Blue,
      glyph: AgentAvatarGlyph.Code,
    });

    expect(parseAgentAvatarIcon(value)).toEqual({
      color: AgentAvatarColor.Blue,
      glyph: AgentAvatarGlyph.Code,
    });
  });

  test('exposes the default designed avatar icon', () => {
    expect(parseAgentAvatarIcon(DefaultAgentAvatarIcon)).toEqual(DefaultAgentAvatar);
  });

  test('leaves legacy emoji icons untouched', () => {
    expect(parseAgentAvatarIcon('🤖')).toBeNull();
    expect(isDesignedAgentAvatarIcon('🤖')).toBe(false);
  });

  test('rejects malformed designed avatar values', () => {
    expect(parseAgentAvatarIcon('agent-avatar:blue:missing')).toBeNull();
    expect(parseAgentAvatarIcon('agent-avatar:missing:code')).toBeNull();
  });
});

import {
  DefaultAgentAvatar,
  encodeAgentAvatarIcon,
  parseAgentAvatarIcon,
} from '@shared/agent/avatar';
import React, { useEffect, useMemo, useRef, useState } from 'react';

import { i18nService } from '../../services/i18n';
import AgentAvatarIcon, {
  AGENT_AVATAR_COLOR_OPTIONS,
  AGENT_AVATAR_GLYPH_OPTIONS,
  getAgentAvatarColorStyle,
  getAgentAvatarGlyphIcon,
} from './AgentAvatarIcon';

interface AgentAvatarPickerProps {
  value: string;
  onChange: (value: string) => void;
}

const AgentAvatarPicker: React.FC<AgentAvatarPickerProps> = ({ value, onChange }) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const selectedAvatar = useMemo(() => {
    return parseAgentAvatarIcon(value) ?? DefaultAgentAvatar;
  }, [value]);
  const selectedColorStyle = getAgentAvatarColorStyle(selectedAvatar.color);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const updateAvatar = (nextAvatar: typeof selectedAvatar) => {
    onChange(encodeAgentAvatarIcon(nextAvatar));
  };

  return (
    <div ref={containerRef} className="relative shrink-0">
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        title={i18nService.t('agentAvatarPickerTitle')}
        aria-label={i18nService.t('agentAvatarPickerTitle')}
        className={`rounded-full transition-shadow hover:shadow-sm focus:outline-none focus:ring-2 focus:ring-primary/50 ${
          isOpen ? 'ring-2 ring-primary/60' : ''
        }`}
      >
        <AgentAvatarIcon
          value={value}
          className="h-11 w-11"
          iconClassName="h-[22px] w-[22px]"
          legacyClassName="text-2xl"
        />
      </button>

      {isOpen && (
        <div
          className="absolute left-0 top-full z-50 mt-2 w-[324px] overflow-hidden rounded-2xl border border-border bg-surface shadow-2xl"
        >
          <div className="grid grid-cols-6 gap-4 px-6 py-5">
            {AGENT_AVATAR_COLOR_OPTIONS.map((option) => {
              const colorStyle = getAgentAvatarColorStyle(option.color);
              const isSelected = selectedAvatar.color === option.color;

              return (
                <button
                  key={option.color}
                  type="button"
                  onClick={() => updateAvatar({ ...selectedAvatar, color: option.color })}
                  title={i18nService.t(option.labelKey)}
                  aria-label={i18nService.t(option.labelKey)}
                  className={`h-9 w-9 rounded-full border transition-transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-primary/50 ${
                    isSelected ? 'ring-2 ring-foreground ring-offset-2 ring-offset-surface' : ''
                  }`}
                  style={{
                    backgroundColor: colorStyle.swatchColor,
                    borderColor: colorStyle.swatchBorderColor,
                  }}
                />
              );
            })}
          </div>

          <div className="border-t border-border" />

          <div className="grid grid-cols-6 gap-x-4 gap-y-4 px-6 py-5">
            {AGENT_AVATAR_GLYPH_OPTIONS.map((option) => {
              const Icon = getAgentAvatarGlyphIcon(option.glyph);
              const isSelected = selectedAvatar.glyph === option.glyph;

              return (
                <button
                  key={option.glyph}
                  type="button"
                  onClick={() => updateAvatar({ ...selectedAvatar, glyph: option.glyph })}
                  title={i18nService.t(option.labelKey)}
                  aria-label={i18nService.t(option.labelKey)}
                  className={`flex h-10 w-10 items-center justify-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-primary/50 ${
                    isSelected
                      ? 'bg-surface-raised text-foreground shadow-sm ring-1 ring-border'
                      : 'text-foreground hover:bg-secondary/10'
                  }`}
                  style={{
                    color: selectedColorStyle.strokeColor,
                  }}
                >
                  <Icon className="h-6 w-6" />
                </button>
              );
            })}
          </div>

          <div className="border-t border-border px-6 py-4">
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="text-sm font-medium text-foreground hover:text-primary transition-colors"
            >
              {i18nService.t('agentAvatarPickerDone')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default AgentAvatarPicker;

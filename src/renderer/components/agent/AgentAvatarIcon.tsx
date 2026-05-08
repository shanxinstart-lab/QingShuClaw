import {
  AcademicCapIcon,
  AdjustmentsHorizontalIcon,
  BanknotesIcon,
  BeakerIcon,
  BoltIcon,
  BookOpenIcon,
  BriefcaseIcon,
  ChartBarIcon,
  ClipboardDocumentListIcon,
  CodeBracketIcon,
  CommandLineIcon,
  FilmIcon,
  FolderIcon,
  GiftIcon,
  GlobeAltIcon,
  HeartIcon,
  LightBulbIcon,
  MagnifyingGlassCircleIcon,
  MicrophoneIcon,
  MusicalNoteIcon,
  PaintBrushIcon,
  PaperAirplaneIcon,
  PencilIcon,
  RocketLaunchIcon,
  ScaleIcon,
  SparklesIcon,
  SwatchIcon,
  TrophyIcon,
  UserGroupIcon,
  WrenchScrewdriverIcon,
} from '@heroicons/react/24/outline';
import {
  AgentAvatarColor,
  AgentAvatarGlyph,
  DefaultAgentAvatar,
  parseAgentAvatarIcon,
} from '@shared/agent/avatar';
import React from 'react';

type AgentAvatarSvgIcon = React.ElementType<{ className?: string }>;

interface AgentAvatarColorStyle {
  swatchColor: string;
  strokeColor: string;
  swatchBorderColor: string;
}

export const AGENT_AVATAR_COLOR_OPTIONS: Array<{ color: AgentAvatarColor; labelKey: string }> = [
  { color: AgentAvatarColor.Ink, labelKey: 'agentAvatarColorInk' },
  { color: AgentAvatarColor.Coral, labelKey: 'agentAvatarColorCoral' },
  { color: AgentAvatarColor.Orange, labelKey: 'agentAvatarColorOrange' },
  { color: AgentAvatarColor.Amber, labelKey: 'agentAvatarColorAmber' },
  { color: AgentAvatarColor.Green, labelKey: 'agentAvatarColorGreen' },
  { color: AgentAvatarColor.Blue, labelKey: 'agentAvatarColorBlue' },
  { color: AgentAvatarColor.Violet, labelKey: 'agentAvatarColorViolet' },
  { color: AgentAvatarColor.Pink, labelKey: 'agentAvatarColorPink' },
];

export const AGENT_AVATAR_GLYPH_OPTIONS: Array<{ glyph: AgentAvatarGlyph; labelKey: string }> = [
  { glyph: AgentAvatarGlyph.Folder, labelKey: 'agentAvatarGlyphFolder' },
  { glyph: AgentAvatarGlyph.Finance, labelKey: 'agentAvatarGlyphFinance' },
  { glyph: AgentAvatarGlyph.Book, labelKey: 'agentAvatarGlyphBook' },
  { glyph: AgentAvatarGlyph.Education, labelKey: 'agentAvatarGlyphEducation' },
  { glyph: AgentAvatarGlyph.Writing, labelKey: 'agentAvatarGlyphWriting' },
  { glyph: AgentAvatarGlyph.Design, labelKey: 'agentAvatarGlyphDesign' },
  { glyph: AgentAvatarGlyph.Code, labelKey: 'agentAvatarGlyphCode' },
  { glyph: AgentAvatarGlyph.Terminal, labelKey: 'agentAvatarGlyphTerminal' },
  { glyph: AgentAvatarGlyph.Music, labelKey: 'agentAvatarGlyphMusic' },
  { glyph: AgentAvatarGlyph.Media, labelKey: 'agentAvatarGlyphMedia' },
  { glyph: AgentAvatarGlyph.Art, labelKey: 'agentAvatarGlyphArt' },
  { glyph: AgentAvatarGlyph.Operations, labelKey: 'agentAvatarGlyphOperations' },
  { glyph: AgentAvatarGlyph.Research, labelKey: 'agentAvatarGlyphResearch' },
  { glyph: AgentAvatarGlyph.Automation, labelKey: 'agentAvatarGlyphAutomation' },
  { glyph: AgentAvatarGlyph.Growth, labelKey: 'agentAvatarGlyphGrowth' },
  { glyph: AgentAvatarGlyph.Business, labelKey: 'agentAvatarGlyphBusiness' },
  { glyph: AgentAvatarGlyph.Analytics, labelKey: 'agentAvatarGlyphAnalytics' },
  { glyph: AgentAvatarGlyph.Support, labelKey: 'agentAvatarGlyphSupport' },
  { glyph: AgentAvatarGlyph.Training, labelKey: 'agentAvatarGlyphTraining' },
  { glyph: AgentAvatarGlyph.Notes, labelKey: 'agentAvatarGlyphNotes' },
  { glyph: AgentAvatarGlyph.Legal, labelKey: 'agentAvatarGlyphLegal' },
  { glyph: AgentAvatarGlyph.Voice, labelKey: 'agentAvatarGlyphVoice' },
  { glyph: AgentAvatarGlyph.Travel, labelKey: 'agentAvatarGlyphTravel' },
  { glyph: AgentAvatarGlyph.Global, labelKey: 'agentAvatarGlyphGlobal' },
  { glyph: AgentAvatarGlyph.Tools, labelKey: 'agentAvatarGlyphTools' },
  { glyph: AgentAvatarGlyph.Science, labelKey: 'agentAvatarGlyphScience' },
  { glyph: AgentAvatarGlyph.Memory, labelKey: 'agentAvatarGlyphMemory' },
  { glyph: AgentAvatarGlyph.Care, labelKey: 'agentAvatarGlyphCare' },
  { glyph: AgentAvatarGlyph.Gift, labelKey: 'agentAvatarGlyphGift' },
  { glyph: AgentAvatarGlyph.Launch, labelKey: 'agentAvatarGlyphLaunch' },
];

const AGENT_AVATAR_COLOR_STYLES: Record<AgentAvatarColor, AgentAvatarColorStyle> = {
  [AgentAvatarColor.Ink]: {
    swatchColor: '#FFFFFF',
    strokeColor: '#1C1C1E',
    swatchBorderColor: 'rgba(0, 0, 0, 0.14)',
  },
  [AgentAvatarColor.Coral]: {
    swatchColor: '#FF6868',
    strokeColor: '#FF6868',
    swatchBorderColor: '#FF6868',
  },
  [AgentAvatarColor.Orange]: {
    swatchColor: '#FF8A47',
    strokeColor: '#FF8A47',
    swatchBorderColor: '#FF8A47',
  },
  [AgentAvatarColor.Amber]: {
    swatchColor: '#FFD24C',
    strokeColor: '#FFD24C',
    swatchBorderColor: '#FFD24C',
  },
  [AgentAvatarColor.Green]: {
    swatchColor: '#45C977',
    strokeColor: '#45C977',
    swatchBorderColor: '#45C977',
  },
  [AgentAvatarColor.Blue]: {
    swatchColor: '#3A9AF4',
    strokeColor: '#3A9AF4',
    swatchBorderColor: '#3A9AF4',
  },
  [AgentAvatarColor.Violet]: {
    swatchColor: '#A472EC',
    strokeColor: '#A472EC',
    swatchBorderColor: '#A472EC',
  },
  [AgentAvatarColor.Pink]: {
    swatchColor: '#F27DB7',
    strokeColor: '#F27DB7',
    swatchBorderColor: '#F27DB7',
  },
};

const AGENT_AVATAR_GLYPH_ICONS: Record<AgentAvatarGlyph, AgentAvatarSvgIcon> = {
  [AgentAvatarGlyph.Folder]: FolderIcon,
  [AgentAvatarGlyph.Finance]: BanknotesIcon,
  [AgentAvatarGlyph.Book]: BookOpenIcon,
  [AgentAvatarGlyph.Education]: AcademicCapIcon,
  [AgentAvatarGlyph.Writing]: PencilIcon,
  [AgentAvatarGlyph.Design]: SwatchIcon,
  [AgentAvatarGlyph.Code]: CodeBracketIcon,
  [AgentAvatarGlyph.Terminal]: CommandLineIcon,
  [AgentAvatarGlyph.Music]: MusicalNoteIcon,
  [AgentAvatarGlyph.Media]: FilmIcon,
  [AgentAvatarGlyph.Art]: PaintBrushIcon,
  [AgentAvatarGlyph.Operations]: AdjustmentsHorizontalIcon,
  [AgentAvatarGlyph.Research]: MagnifyingGlassCircleIcon,
  [AgentAvatarGlyph.Automation]: BoltIcon,
  [AgentAvatarGlyph.Growth]: SparklesIcon,
  [AgentAvatarGlyph.Business]: BriefcaseIcon,
  [AgentAvatarGlyph.Analytics]: ChartBarIcon,
  [AgentAvatarGlyph.Support]: UserGroupIcon,
  [AgentAvatarGlyph.Training]: TrophyIcon,
  [AgentAvatarGlyph.Notes]: ClipboardDocumentListIcon,
  [AgentAvatarGlyph.Legal]: ScaleIcon,
  [AgentAvatarGlyph.Voice]: MicrophoneIcon,
  [AgentAvatarGlyph.Travel]: PaperAirplaneIcon,
  [AgentAvatarGlyph.Global]: GlobeAltIcon,
  [AgentAvatarGlyph.Tools]: WrenchScrewdriverIcon,
  [AgentAvatarGlyph.Science]: BeakerIcon,
  [AgentAvatarGlyph.Memory]: LightBulbIcon,
  [AgentAvatarGlyph.Care]: HeartIcon,
  [AgentAvatarGlyph.Gift]: GiftIcon,
  [AgentAvatarGlyph.Launch]: RocketLaunchIcon,
};

export const getAgentAvatarColorStyle = (color: AgentAvatarColor): AgentAvatarColorStyle => {
  return AGENT_AVATAR_COLOR_STYLES[color] ?? AGENT_AVATAR_COLOR_STYLES[DefaultAgentAvatar.color];
};

export const getAgentAvatarGlyphIcon = (glyph: AgentAvatarGlyph): AgentAvatarSvgIcon => {
  return AGENT_AVATAR_GLYPH_ICONS[glyph] ?? AGENT_AVATAR_GLYPH_ICONS[DefaultAgentAvatar.glyph];
};

interface AgentAvatarIconProps {
  value?: string | null;
  className?: string;
  iconClassName?: string;
  legacyClassName?: string;
  fallbackText?: string;
  useDefaultWhenEmpty?: boolean;
}

const AgentAvatarIcon: React.FC<AgentAvatarIconProps> = ({
  value,
  className = 'h-10 w-10',
  iconClassName = 'h-5 w-5',
  legacyClassName = 'text-2xl',
  fallbackText = 'A',
  useDefaultWhenEmpty = true,
}) => {
  const normalized = value?.trim() ?? '';
  const parsedAvatar = parseAgentAvatarIcon(normalized);
  const avatar = parsedAvatar ?? (!normalized && useDefaultWhenEmpty ? DefaultAgentAvatar : null);

  if (avatar) {
    const colorStyle = getAgentAvatarColorStyle(avatar.color);
    const Icon = getAgentAvatarGlyphIcon(avatar.glyph);

    return (
      <span
        className={`inline-flex shrink-0 items-center justify-center rounded-full ${className}`}
        style={{
          color: colorStyle.strokeColor,
        }}
      >
        <Icon className={iconClassName} />
      </span>
    );
  }

  return (
    <span className={`inline-flex shrink-0 items-center justify-center leading-none ${className} ${legacyClassName}`}>
      {normalized || fallbackText}
    </span>
  );
};

export default AgentAvatarIcon;

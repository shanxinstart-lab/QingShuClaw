import type { GuideScene, GuideSession } from '../../../shared/desktopAssistant/constants';

export interface GuideSceneMatchResult {
  sceneIndex: number;
  reason: 'first_scene' | 'summary_scene' | 'scene_number' | 'title_keyword' | 'summary_keyword' | 'current_scene';
  matchedText: string;
}

const CHINESE_NUMBER_MAP: Record<string, number> = {
  一: 1,
  二: 2,
  两: 2,
  三: 3,
  四: 4,
  五: 5,
  六: 6,
  七: 7,
  八: 8,
  九: 9,
  十: 10,
};

const SCENE_GENERIC_SUFFIX_PATTERN = /(页面|模块|卡片|场景|部分|章节|看板|概览|总览|结论|总结|流程|步骤)$/u;

const normalizeText = (value: string): string => {
  return value
    .trim()
    .toLowerCase()
    .replace(/[。！？，、,.!?;:："'“”‘’（）()\[\]{}]/gu, ' ')
    .replace(/\s+/gu, ' ')
    .trim();
};

const parseSceneNumber = (value: string): number | null => {
  const trimmed = value.trim();
  if (/^\d+$/u.test(trimmed)) {
    const numeric = Number.parseInt(trimmed, 10);
    return Number.isFinite(numeric) && numeric > 0 ? numeric : null;
  }

  if (trimmed === '十') {
    return 10;
  }
  if (trimmed.startsWith('十')) {
    return 10 + (CHINESE_NUMBER_MAP[trimmed.slice(1)] ?? 0);
  }
  if (trimmed.endsWith('十')) {
    return (CHINESE_NUMBER_MAP[trimmed[0]] ?? 0) * 10;
  }
  if (trimmed.length === 2 && trimmed[1] === '十') {
    return (CHINESE_NUMBER_MAP[trimmed[0]] ?? 0) * 10;
  }
  if (trimmed.length === 3 && trimmed[1] === '十') {
    return ((CHINESE_NUMBER_MAP[trimmed[0]] ?? 0) * 10) + (CHINESE_NUMBER_MAP[trimmed[2]] ?? 0);
  }

  return CHINESE_NUMBER_MAP[trimmed] ?? null;
};

const buildSceneVariants = (scene: GuideScene): string[] => {
  const normalizedTitle = normalizeText(scene.title);
  const normalizedSummary = normalizeText(scene.summary);
  const titleVariants = normalizedTitle
    ? [normalizedTitle, normalizedTitle.replace(SCENE_GENERIC_SUFFIX_PATTERN, '').trim()].filter(Boolean)
    : [];
  const summaryVariants = normalizedSummary
    .split(/[。！？；;,.!?]/u)
    .map((part) => part.trim())
    .filter((part) => part.length >= 4 && part.length <= 18);

  return Array.from(new Set([...titleVariants, ...summaryVariants]));
};

export const matchGuideSceneForQuery = (
  query: string,
  guideSession: GuideSession | null,
): GuideSceneMatchResult | null => {
  if (
    !guideSession
    || guideSession.scenes.length === 0
    || (guideSession.status !== 'active' && guideSession.status !== 'paused')
  ) {
    return null;
  }

  const normalizedQuery = normalizeText(query);
  if (!normalizedQuery) {
    return null;
  }

  if (/(回到第一页|回到第一幕|第一页|第一幕|开头那一幕|最开始那一幕)/u.test(normalizedQuery)) {
    return { sceneIndex: 0, reason: 'first_scene', matchedText: '第一页' };
  }
  if (/(跳到总结|跳到结论|总结那一幕|结论那一幕|最后一幕|最后一页|收尾那一幕)/u.test(normalizedQuery)) {
    return {
      sceneIndex: guideSession.scenes.length - 1,
      reason: 'summary_scene',
      matchedText: '总结',
    };
  }
  if (/(这一幕|当前这一幕|这一页|当前这一页)/u.test(normalizedQuery)) {
    return {
      sceneIndex: guideSession.currentSceneIndex,
      reason: 'current_scene',
      matchedText: '这一幕',
    };
  }

  const sceneNumberMatch = normalizedQuery.match(/第\s*([一二三四五六七八九十两\d]+)\s*[幕页]/u);
  if (sceneNumberMatch?.[1]) {
    const parsedSceneNumber = parseSceneNumber(sceneNumberMatch[1]);
    if (parsedSceneNumber && parsedSceneNumber <= guideSession.scenes.length) {
      return {
        sceneIndex: parsedSceneNumber - 1,
        reason: 'scene_number',
        matchedText: sceneNumberMatch[0],
      };
    }
  }

  const scoredScenes = guideSession.scenes.map((scene, index) => {
    const variants = buildSceneVariants(scene);
    let score = 0;
    let reason: GuideSceneMatchResult['reason'] | null = null;
    let matchedText = '';

    const normalizedTitle = normalizeText(scene.title);
    const compactTitle = normalizedTitle.replace(SCENE_GENERIC_SUFFIX_PATTERN, '').trim();
    if (normalizedTitle.length >= 2 && normalizedQuery.includes(normalizedTitle)) {
      score += 10;
      reason = 'title_keyword';
      matchedText = normalizedTitle;
    } else if (compactTitle.length >= 2 && normalizedQuery.includes(compactTitle)) {
      score += 7;
      reason = 'title_keyword';
      matchedText = compactTitle;
    }

    for (const variant of variants) {
      if (!variant || variant.length < 4 || !normalizedQuery.includes(variant)) {
        continue;
      }
      const nextScore = scene.summary.includes(variant) ? 4 : 6;
      if (nextScore > score) {
        score = nextScore;
        reason = scene.summary.includes(variant) ? 'summary_keyword' : 'title_keyword';
        matchedText = variant;
      }
    }

    return {
      index,
      score,
      reason,
      matchedText,
    };
  });

  const sortedScenes = [...scoredScenes].sort((left, right) => right.score - left.score);
  const bestMatch = sortedScenes[0];
  const secondMatch = sortedScenes[1];
  if (!bestMatch || !bestMatch.reason || bestMatch.score < 6) {
    return null;
  }
  if (secondMatch && bestMatch.score === secondMatch.score) {
    return null;
  }

  return {
    sceneIndex: bestMatch.index,
    reason: bestMatch.reason,
    matchedText: bestMatch.matchedText,
  };
};

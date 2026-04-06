import {
  PresentationLayoutHint,
  PresentationPlaybackStatus,
  type PresentationDeck,
} from '../../../shared/desktopAssistant/presentation';

const escapeHtml = (value: string): string => (
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
);

const renderBullets = (bullets: string[]): string => {
  if (bullets.length === 0) {
    return '';
  }
  return `
    <ul class="scene-bullets">
      ${bullets.map((bullet) => `<li>${escapeHtml(bullet)}</li>`).join('')}
    </ul>
  `;
};

const renderLayoutBadge = (layoutHint: typeof PresentationLayoutHint[keyof typeof PresentationLayoutHint]): string => {
  switch (layoutHint) {
    case PresentationLayoutHint.Cover:
      return '封面幕';
    case PresentationLayoutHint.Steps:
      return '步骤幕';
    case PresentationLayoutHint.Summary:
      return '总结幕';
    default:
      return '重点幕';
  }
};

export const buildPresentationRuntimeHtml = (input: {
  deck: PresentationDeck;
  currentSceneIndex: number;
  playbackStatus: typeof PresentationPlaybackStatus[keyof typeof PresentationPlaybackStatus];
}): string => {
  const { deck, currentSceneIndex, playbackStatus } = input;
  const scene = deck.scenes[currentSceneIndex] ?? deck.scenes[0];
  const progress = deck.scenes.length > 0
    ? `${Math.min(currentSceneIndex + 1, deck.scenes.length)}/${deck.scenes.length}`
    : '0/0';

  return `<!DOCTYPE html>
<html lang="zh-CN">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${escapeHtml(deck.title)}</title>
    <style>
      :root {
        color-scheme: light;
        --bg: linear-gradient(135deg, #0b132b 0%, #1c2541 45%, #3a506b 100%);
        --panel: rgba(255, 255, 255, 0.12);
        --panel-strong: rgba(255, 255, 255, 0.2);
        --text: #f8fafc;
        --muted: rgba(248, 250, 252, 0.76);
        --accent: #5eead4;
        --accent-2: #fbbf24;
      }
      * { box-sizing: border-box; }
      body {
        margin: 0;
        min-height: 100vh;
        font-family: "SF Pro Display", "PingFang SC", "Helvetica Neue", sans-serif;
        background: var(--bg);
        color: var(--text);
        overflow: hidden;
      }
      .app {
        min-height: 100vh;
        padding: 28px;
        display: grid;
        grid-template-columns: minmax(240px, 300px) minmax(0, 1fr);
        gap: 24px;
      }
      .sidebar, .stage {
        border: 1px solid rgba(255,255,255,0.14);
        background: var(--panel);
        backdrop-filter: blur(18px);
        border-radius: 28px;
        overflow: hidden;
      }
      .sidebar {
        padding: 22px 18px;
        display: flex;
        flex-direction: column;
        gap: 18px;
      }
      .deck-label {
        display: inline-flex;
        align-self: flex-start;
        padding: 6px 10px;
        border-radius: 999px;
        background: rgba(94, 234, 212, 0.16);
        color: var(--accent);
        font-size: 12px;
        letter-spacing: 0.12em;
      }
      .deck-title {
        margin: 0;
        font-size: 28px;
        line-height: 1.1;
      }
      .deck-subtitle, .source {
        margin: 0;
        color: var(--muted);
        font-size: 13px;
        line-height: 1.5;
      }
      .scene-list {
        display: grid;
        gap: 10px;
      }
      .scene-chip {
        border-radius: 18px;
        padding: 12px 14px;
        border: 1px solid rgba(255,255,255,0.1);
        background: rgba(255,255,255,0.06);
      }
      .scene-chip.active {
        background: rgba(251, 191, 36, 0.16);
        border-color: rgba(251, 191, 36, 0.4);
      }
      .scene-chip-title {
        font-size: 14px;
        font-weight: 700;
      }
      .scene-chip-summary {
        margin-top: 6px;
        font-size: 12px;
        color: var(--muted);
        line-height: 1.4;
      }
      .stage {
        position: relative;
        padding: 36px;
        display: flex;
        flex-direction: column;
        justify-content: space-between;
      }
      .status-row {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 16px;
      }
      .badge {
        display: inline-flex;
        align-items: center;
        padding: 8px 12px;
        border-radius: 999px;
        font-size: 12px;
        background: rgba(255,255,255,0.1);
        color: var(--muted);
      }
      .badge.accent {
        background: rgba(94, 234, 212, 0.16);
        color: var(--accent);
      }
      .headline {
        max-width: 880px;
      }
      .headline h2 {
        margin: 18px 0 10px;
        font-size: clamp(34px, 5vw, 64px);
        line-height: 1;
      }
      .headline p {
        margin: 0;
        font-size: clamp(16px, 2vw, 22px);
        line-height: 1.6;
        color: var(--muted);
      }
      .scene-bullets {
        list-style: none;
        padding: 0;
        margin: 28px 0 0;
        display: grid;
        gap: 12px;
        max-width: 860px;
      }
      .scene-bullets li {
        position: relative;
        padding: 16px 18px 16px 44px;
        border-radius: 18px;
        background: var(--panel-strong);
        font-size: 18px;
        line-height: 1.5;
      }
      .scene-bullets li::before {
        content: "";
        position: absolute;
        left: 18px;
        top: 22px;
        width: 10px;
        height: 10px;
        border-radius: 999px;
        background: var(--accent-2);
      }
      .footer {
        display: flex;
        align-items: flex-end;
        justify-content: space-between;
        gap: 18px;
      }
      .narration {
        max-width: 720px;
        padding: 18px 20px;
        border-radius: 22px;
        background: rgba(11, 19, 43, 0.35);
        border: 1px solid rgba(255,255,255,0.1);
      }
      .narration-label {
        font-size: 11px;
        letter-spacing: 0.12em;
        color: var(--accent);
        text-transform: uppercase;
      }
      .narration-text {
        margin-top: 8px;
        font-size: 16px;
        line-height: 1.6;
      }
      .progress {
        min-width: 120px;
        text-align: right;
      }
      .progress strong {
        display: block;
        font-size: 40px;
        line-height: 1;
      }
      .progress span {
        color: var(--muted);
        font-size: 13px;
      }
    </style>
  </head>
  <body>
    <div class="app">
      <aside class="sidebar">
        <span class="deck-label">AUTO DECK</span>
        <h1 class="deck-title">${escapeHtml(deck.title)}</h1>
        <p class="deck-subtitle">${escapeHtml(deck.subtitle)}</p>
        <p class="source">源目标：${escapeHtml(deck.sourcePreviewTarget)}</p>
        <div class="scene-list">
          ${deck.scenes.map((item, index) => `
            <section class="scene-chip ${index === currentSceneIndex ? 'active' : ''}">
              <div class="scene-chip-title">${escapeHtml(item.title)}</div>
              <div class="scene-chip-summary">${escapeHtml(item.summary || item.narration)}</div>
            </section>
          `).join('')}
        </div>
      </aside>
      <main class="stage">
        <div class="status-row">
          <span class="badge accent">${escapeHtml(renderLayoutBadge(scene.layoutHint))}</span>
          <span class="badge">状态：${escapeHtml(playbackStatus)}</span>
        </div>
        <section class="headline">
          <span class="badge">${escapeHtml(progress)}</span>
          <h2>${escapeHtml(scene.title)}</h2>
          <p>${escapeHtml(scene.summary || scene.narration)}</p>
          ${renderBullets(scene.bullets)}
        </section>
        <footer class="footer">
          <div class="narration">
            <div class="narration-label">Narration</div>
            <div class="narration-text">${escapeHtml(scene.narration)}</div>
          </div>
          <div class="progress">
            <strong>${escapeHtml(String(currentSceneIndex + 1).padStart(2, '0'))}</strong>
            <span>${escapeHtml(`预计 ${Math.round(scene.durationMs / 1000)} 秒`)}</span>
          </div>
        </footer>
      </main>
    </div>
  </body>
</html>`;
};

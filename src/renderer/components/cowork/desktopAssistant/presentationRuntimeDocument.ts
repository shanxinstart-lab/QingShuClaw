import {
  PresentationLayoutHint,
  PresentationPlaybackStatus,
  type PresentationDeck,
  type PresentationScene,
} from '../../../../shared/desktopAssistant/presentation';

const escapeHtml = (value: string): string => value
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#39;');

const renderSceneCards = (bullets: string[], numbered: boolean): string => {
  if (bullets.length === 0) {
    return '';
  }

  return `
    <div class="scene-card-grid ${numbered ? 'scene-card-grid-numbered' : ''}">
      ${bullets.map((bullet, index) => `
        <article class="scene-card">
          <div class="scene-card-index">${numbered ? `0${index + 1}` : 'Key'}</div>
          <div class="scene-card-text">${escapeHtml(bullet)}</div>
        </article>
      `).join('')}
    </div>
  `;
};

const buildSceneBody = (scene: PresentationScene): string => {
  const escapedTitle = escapeHtml(scene.title);
  const escapedSummary = escapeHtml(scene.summary);
  const bullets = scene.bullets
    .map((bullet) => `<li>${escapeHtml(bullet)}</li>`)
    .join('');
  const badge = scene.sourceAnchor
    ? `<div class="scene-anchor">${escapeHtml(scene.sourceAnchor)}</div>`
    : '';

  if (scene.layoutHint === PresentationLayoutHint.Cover) {
    return `
      <section class="scene scene-cover">
        <div class="scene-kicker">Scene</div>
        <div class="scene-copy">
          <h1>${escapedTitle}</h1>
          <p>${escapedSummary}</p>
        </div>
        ${renderSceneCards(scene.bullets, false)}
        ${badge}
      </section>
    `;
  }

  if (scene.layoutHint === PresentationLayoutHint.Showcase) {
    return `
      <section class="scene scene-showcase">
        <div class="scene-kicker">Scene</div>
        <div class="scene-copy">
          <h1>${escapedTitle}</h1>
          <p>${escapedSummary}</p>
        </div>
        ${renderSceneCards(scene.bullets, false)}
        ${badge}
      </section>
    `;
  }

  if (scene.layoutHint === PresentationLayoutHint.Steps) {
    return `
      <section class="scene scene-steps">
        <div class="scene-kicker">Scene</div>
        <div class="scene-copy">
          <h1>${escapedTitle}</h1>
          <p>${escapedSummary}</p>
        </div>
        ${renderSceneCards(scene.bullets, true) || `<ol>${bullets}</ol>`}
        ${badge}
      </section>
    `;
  }

  return `
    <section class="scene scene-focus">
      <div class="scene-kicker">Scene</div>
      <h1>${escapedTitle}</h1>
      <p>${escapedSummary}</p>
      ${bullets ? `<ul>${bullets}</ul>` : ''}
      ${badge}
    </section>
  `;
};

export const buildPresentationRuntimeHtml = (input: {
  deck: PresentationDeck;
  currentSceneIndex: number;
  playbackStatus: typeof PresentationPlaybackStatus[keyof typeof PresentationPlaybackStatus];
}): string => {
  const { deck, playbackStatus } = input;
  const currentSceneIndex = Math.min(Math.max(input.currentSceneIndex, 0), deck.scenes.length - 1);
  const currentScene = deck.scenes[currentSceneIndex];
  const progressItems = deck.scenes
    .map((scene, index) => `
      <li class="${index === currentSceneIndex ? 'active' : ''}">
        <span class="index">${index + 1}</span>
        <span class="title">${escapeHtml(scene.title)}</span>
      </li>
    `)
    .join('');

  return `<!DOCTYPE html>
  <html lang="zh-CN">
    <head>
      <meta charset="UTF-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      <title>${escapeHtml(deck.title)}</title>
      <style>
        :root {
          color-scheme: light;
          --bg: radial-gradient(circle at top left, #fef3c7 0%, #fff7ed 28%, #fff 58%);
          --panel: rgba(255,255,255,0.92);
          --border: rgba(15,23,42,0.08);
          --text: #111827;
          --muted: #4b5563;
          --accent: #ea580c;
          --accent-soft: rgba(234,88,12,0.12);
        }
        * { box-sizing: border-box; }
        body {
          margin: 0;
          font-family: "SF Pro Display", "PingFang SC", "Hiragino Sans GB", sans-serif;
          background: var(--bg);
          color: var(--text);
          min-height: 100vh;
          display: grid;
          grid-template-columns: minmax(220px, 280px) minmax(0, 1fr);
        }
        aside {
          border-right: 1px solid var(--border);
          background: rgba(255,255,255,0.55);
          backdrop-filter: blur(20px);
          padding: 28px 20px;
        }
        .deck-title {
          font-size: 24px;
          line-height: 1.2;
          font-weight: 700;
        }
        .deck-subtitle {
          margin-top: 8px;
          font-size: 13px;
          color: var(--muted);
        }
        .deck-status {
          margin-top: 18px;
          display: inline-flex;
          padding: 8px 12px;
          border-radius: 999px;
          background: var(--accent-soft);
          color: var(--accent);
          font-size: 12px;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.08em;
        }
        .scene-list {
          margin: 24px 0 0;
          padding: 0;
          list-style: none;
          display: grid;
          gap: 10px;
        }
        .scene-list li {
          display: grid;
          grid-template-columns: 28px minmax(0, 1fr);
          gap: 10px;
          align-items: center;
          padding: 10px 12px;
          border-radius: 16px;
          border: 1px solid transparent;
          color: var(--muted);
        }
        .scene-list li.active {
          border-color: var(--border);
          background: var(--panel);
          color: var(--text);
          box-shadow: 0 20px 40px rgba(15,23,42,0.08);
        }
        .scene-list .index {
          width: 28px;
          height: 28px;
          border-radius: 999px;
          display: grid;
          place-items: center;
          background: rgba(15,23,42,0.06);
          font-size: 12px;
          font-weight: 700;
        }
        main {
          padding: 28px;
          display: grid;
          place-items: stretch;
        }
        .stage {
          min-height: 100%;
          border-radius: 28px;
          border: 1px solid var(--border);
          background: var(--panel);
          box-shadow: 0 30px 80px rgba(15,23,42,0.12);
          padding: 40px;
          position: relative;
          overflow: hidden;
        }
        .stage::before {
          content: "";
          position: absolute;
          inset: 0;
          background:
            radial-gradient(circle at top right, rgba(249,115,22,0.18), transparent 30%),
            radial-gradient(circle at bottom left, rgba(251,191,36,0.16), transparent 28%);
          pointer-events: none;
        }
        .scene {
          position: relative;
          z-index: 1;
          animation: enter 360ms ease-out;
        }
        .scene-kicker {
          display: inline-flex;
          padding: 6px 10px;
          border-radius: 999px;
          background: rgba(15,23,42,0.06);
          color: var(--muted);
          font-size: 12px;
          font-weight: 700;
          letter-spacing: 0.08em;
          text-transform: uppercase;
        }
        .scene h1 {
          margin: 18px 0 0;
          font-size: clamp(34px, 5vw, 64px);
          line-height: 1.05;
        }
        .scene p {
          margin: 18px 0 0;
          max-width: 62ch;
          font-size: 18px;
          line-height: 1.75;
          color: var(--muted);
        }
        .scene-copy {
          max-width: 62ch;
        }
        .scene ul, .scene ol {
          margin: 24px 0 0;
          padding-left: 22px;
          display: grid;
          gap: 12px;
          max-width: 60ch;
          font-size: 18px;
          line-height: 1.65;
        }
        .scene-anchor {
          margin-top: 26px;
          display: inline-flex;
          padding: 8px 12px;
          border-radius: 14px;
          background: rgba(255,255,255,0.82);
          border: 1px solid var(--border);
          color: var(--accent);
          font-size: 13px;
          font-weight: 600;
        }
        .scene-cover {
          display: grid;
          align-content: center;
          min-height: 100%;
        }
        .scene-showcase,
        .scene-steps {
          display: grid;
          gap: 24px;
          align-content: start;
        }
        .scene-card-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
          gap: 16px;
          margin-top: 6px;
          max-width: 100%;
        }
        .scene-card {
          border-radius: 24px;
          border: 1px solid rgba(15,23,42,0.08);
          background:
            linear-gradient(180deg, rgba(255,255,255,0.95), rgba(255,255,255,0.78)),
            rgba(255,255,255,0.72);
          box-shadow: 0 24px 48px rgba(15,23,42,0.08);
          padding: 20px;
          min-height: 150px;
          display: grid;
          align-content: space-between;
          gap: 20px;
          animation: rise 420ms ease both;
        }
        .scene-card:nth-child(2) { animation-delay: 80ms; }
        .scene-card:nth-child(3) { animation-delay: 140ms; }
        .scene-card:nth-child(4) { animation-delay: 200ms; }
        .scene-card-index {
          display: inline-flex;
          width: fit-content;
          padding: 7px 10px;
          border-radius: 999px;
          background: var(--accent-soft);
          color: var(--accent);
          font-size: 12px;
          font-weight: 700;
          letter-spacing: 0.08em;
          text-transform: uppercase;
        }
        .scene-card-text {
          font-size: 22px;
          line-height: 1.35;
          font-weight: 650;
          color: var(--text);
        }
        .scene-card-grid-numbered .scene-card {
          background:
            linear-gradient(180deg, rgba(255,247,237,0.98), rgba(255,255,255,0.82)),
            rgba(255,255,255,0.72);
        }
        .stage-footer {
          position: absolute;
          left: 40px;
          right: 40px;
          bottom: 28px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 16px;
          z-index: 1;
          color: var(--muted);
          font-size: 13px;
        }
        .progress-track {
          flex: 1;
          height: 8px;
          border-radius: 999px;
          background: rgba(15,23,42,0.08);
          overflow: hidden;
        }
        .progress-bar {
          width: ${((currentSceneIndex + 1) / Math.max(deck.scenes.length, 1)) * 100}%;
          height: 100%;
          border-radius: inherit;
          background: linear-gradient(90deg, #f97316, #fb923c);
        }
        @keyframes enter {
          from { opacity: 0; transform: translateY(16px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes rise {
          from { opacity: 0; transform: translateY(18px); }
          to { opacity: 1; transform: translateY(0); }
        }
      </style>
    </head>
    <body>
      <aside>
        <div class="deck-title">${escapeHtml(deck.title)}</div>
        <div class="deck-subtitle">${escapeHtml(deck.subtitle)}</div>
        <div class="deck-status">${escapeHtml(playbackStatus)}</div>
        <ol class="scene-list">${progressItems}</ol>
      </aside>
      <main>
        <div class="stage">
          ${buildSceneBody(currentScene)}
          <div class="stage-footer">
            <div>源目标：${escapeHtml(deck.sourcePreviewTarget)}</div>
            <div class="progress-track"><div class="progress-bar"></div></div>
          </div>
        </div>
      </main>
    </body>
  </html>`;
};

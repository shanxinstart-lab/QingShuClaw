---
name: presentation-html
description: Generate a single-file, previewable HTML presentation page for demos, guided walkthroughs, and scene-by-scene narration. Use this skill when the user explicitly asks to generate an HTML page for presentation, demo, walkthrough, slides, scene guide, or desktop-assistant narration. The output should be stable for section-based parsing, scene extraction, and follow-up jumping.
---

Generate a **single-file, directly previewable local HTML page** that is optimized for QingShuClaw's presentation and guide flow.

Use this skill only when the user is clearly asking for one of these:
- 生成可演示的 HTML
- 生成适合讲解/逐幕介绍的页面
- 生成类似 PPT / 幻灯 / 演示稿 的单页网页
- 生成适合桌面助手演示模式使用的 HTML

Do not use this skill for ordinary dashboards, CRUD pages, or generic frontend tasks unless the user explicitly wants a presentation/demo page.

If you need a stable starting point:
- use `assets/presentation-starter.html` as the structural template
- use `references/output-contract.md` as the final checklist before returning the HTML

## Primary Delivery Mode

By default, you must generate a **real local HTML file in the current workspace**, instead of only returning an inline HTML code block.

Preferred behavior:

1. Create one single-file HTML page under a stable local output directory.
2. Prefer a path like:
   - `./artifacts/presentation/<slug>.html`
   - or another clearly named subdirectory inside the current workspace
3. After writing the file, explicitly report the **absolute local file path** in the final response.

Preferred final response shape:

```text
文件位置：/absolute/path/to/demo.html

已生成一个可演示的本地 HTML 页面，可直接预览。
```

Fallback rule:

- Only when you truly cannot write files in the current environment should you fall back to returning inline HTML.
- If you fall back, you must clearly say that no local file was created.

## Output Contract

- Output a **single self-contained HTML file**
- Prefer a **written local file** over an inline code block
- Prefer **inline CSS and inline JS**
- Avoid external CDN dependencies unless the user explicitly requires them
- Keep the page directly previewable in the current artifact/runtime flow
- Prefer semantic structure over anonymous nested containers

## Linked Guide Contract

When the user asks for a presentation page, guided walkthrough, desktop-assistant demo page, or scene-by-scene narration page, the HTML should be **bridge-compatible by default**.

Required:

- add `data-qingshu-presentation="v1"` to a stable root container such as `<html>`, `<body>`, or `<main>`
- every major scene uses `data-guide-scene-id="stable-scene-id"`
- every scene should also have a stable `id` whenever possible
- prefer `data-guide-scene-title="..."` when the visible title may not be stable enough
- include a small inline script that:
  - listens to `window.postMessage(...)`
  - responds to `handshake`
  - handles `goToScene`, `highlightScene`, `setPlaybackStatus`
  - scrolls the active scene into view
  - toggles an active scene class for visual focus
  - posts back a `ready` event to the parent window

Important:

- the HTML itself must **not** own narration audio playback
- QingShuClaw remains the source of truth for scene index and play/pause/stop
- the HTML only reacts to scene control and highlighting

## Structure Rules

The generated page should be easy to split into scenes. Prefer this structure:

```html
<main>
  <section id="hero">
    <h1>...</h1>
    <p>...</p>
  </section>

  <section id="module-a">
    <h2>...</h2>
    <p>...</p>
    <div>
      <h3>...</h3>
    </div>
    <div>
      <h3>...</h3>
    </div>
  </section>

  <section id="summary">
    <h2>...</h2>
    <p>...</p>
  </section>
</main>
```

Follow these rules:
- Use `section` for each major scene
- Every scene must have one clear heading: `h1`, `h2`, or `h3`
- Each scene should include one concise summary paragraph
- Card-like subitems should use `h3`, `li`, or clearly separated blocks
- Add stable `id` values to major sections
- Add `data-guide-scene-id` to major sections
- End with a summary or conclusion scene when appropriate

## Scene Design Guidance

Default preferred scene order:
1. Cover / overview
2. Core module or key feature
3. Detail / flow / comparison / metric highlights
4. Summary / conclusion

Try to keep each scene focused on one idea:
- one headline
- one short explanation
- a small set of bullets/cards/metrics

Avoid:
- long article-style prose
- one huge undivided page
- deeply nested div soup without headings
- multiple unrelated targets or iframes

## Presentation Style

The page should feel like a presentation page, not a back-office form.

Prefer:
- strong visual hierarchy
- large headings
- obvious scene separation
- bold but clean layouts
- cards, steps, metrics, comparisons, or hero sections

If the user asks for a stronger aesthetic direction, make it polished and distinctive, but do not sacrifice:
- previewability
- semantic structure
- section stability

## Compatibility Priorities

Optimize for these downstream behaviors:
- assistant message can reference the HTML as a local preview target
- scene extraction can identify sections and headings reliably
- guided narration can describe each scene cleanly
- later scene jumping can match scene titles or keywords

That means:
- stable section titles are more important than decorative copy
- scene summaries should be concrete and concise
- headings should use meaningful names like `首页概览`, `核心指标`, `价格卡片`, `总结结论`

## When Rewriting Source Content Into Presentation HTML

If the user asks to turn existing material into a presentation page:
- reorganize the content into scenes
- compress long paragraphs into shorter scene summaries
- promote key points into cards / bullets / steps
- keep the result presentation-first

Do not simply dump the original content into one long HTML article.

## Final Delivery

When returning the result:
- prefer returning the local file path and a short usage note, not just raw HTML
- explicitly include a line like `文件位置：/absolute/path/to/demo.html`
- avoid long explanations unless the user asked for them
- only include raw HTML inline when local file creation is not possible

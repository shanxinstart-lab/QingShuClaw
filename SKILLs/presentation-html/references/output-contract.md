# Presentation HTML Output Contract

## Required

- single-file HTML
- written to a local workspace file by default
- final reply includes an absolute local file path
- directly previewable
- semantic section structure
- stable section ids
- `data-qingshu-presentation="v1"` root marker for guide pages
- `data-guide-scene-id` on every major scene
- clear scene headings
- one concise summary paragraph per major scene
- inline guide bridge script for `handshake / goToScene / highlightScene / setPlaybackStatus`

## Recommended structure

1. `hero` / overview
2. feature or module section
3. steps / flow section
4. metrics / comparison section
5. `summary` / `conclusion`

## Preferred scene titles

- `首页概览`
- `方案总览`
- `核心模块`
- `使用流程`
- `价格卡片`
- `关键指标`
- `总结结论`

## Avoid

- returning only an inline HTML code block when a local file can be created
- one huge undivided page
- deeply nested anonymous div trees
- article-style long prose
- router-style multipage apps
- hard dependency on external CDN or remote data
- iframe-first output

## Final check

- a real local `.html` file was created whenever the environment allowed it
- the final reply includes `文件位置：<absolute path>`
- every section can be narrated independently
- every major scene can also be located by `data-guide-scene-id`
- section titles are meaningful enough for scene jumping
- the page contains at least one overview scene and one step/flow or metric scene
- the result still looks like a presentation page, not a CRUD system

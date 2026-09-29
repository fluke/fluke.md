# fluke.md

Personal site of Kartik Luke Singh, styled after a grape Game Boy Color. Built with [Eleventy](https://www.11ty.dev/) and deployed to GitHub Pages at https://fluke.md by `.github/workflows/deploy.yml` on every push to `main`.

## Writing a post

Add a Markdown file to `src/posts/`. The filename becomes the URL (`src/posts/my-post.md` → `/writing/my-post/`).

~~~markdown
---
title: "Full title of the post"
short: Short title for menus and the pager
description: One or two sentences for search results and share cards.
date: 2026-10-01
tags: [shopify, rails]
featured: true          # show on the home page (keep it to two)
medium: https://…       # only for posts first published on Medium
---

Opening paragraph…

## A question as a heading?

```ruby
code
```
~~~

Images go in `src/assets/posts/<post>/` and are referenced as `/assets/posts/<post>/file.png`. Use `![alt text](/path "caption")` for a captioned figure.

Posts render with the Markdown characters visible (`#`, `**`, `` ` ``, `[text](url)`, fences) in the "LCD night" style; see `visibleMarkdown` in `eleventy.config.js` and `src/assets/post.css`.

## Local development

```bash
npm install
npm start          # http://localhost:8080, rebuilds on save
npm run build      # writes _site/
npm run og         # screenshots every page into _site/assets/og/ (needs Chrome)
```

## Layout

- `src/_data/` — site metadata, projects (the NOW list and project pages), Medium archive
- `src/_includes/layouts/` — `base.njk` (the console) and `post.njk` (LCD night)
- `src/assets/` — `style.css`, `post.css`, `nav.js` (arrow keys, A/B), favicon, post images
- `scripts/og.mjs` — share-image screenshots, run in CI after the build

Keys: ↑/↓ move the menu cursor, Enter or A opens, ←/→ previous/next, Esc or B goes back.

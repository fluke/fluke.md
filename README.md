# kartik-site

Personal site, styled after a grape Game Boy Color. Plain HTML + one CSS file — no build step.

## Put it on GitHub Pages

1. Create a repo named `<your-username>.github.io` (public).
2. Upload everything in this folder to the repo root (drag-and-drop on github.com works; include `.nojekyll`).
3. Repo → Settings → Pages → Source: "Deploy from a branch", Branch: `main` / `(root)`.
4. After a minute it's live at `https://<your-username>.github.io`.

Custom domain: add it under Settings → Pages, and point your DNS at GitHub (a CNAME to `<your-username>.github.io`).

## Editing

- Text lives directly in each `index.html`. Anything in `[BRACKETS]` is a placeholder to fill in.
- All styling is in `assets/style.css` (colours are the variables at the top).
- New project: copy `jobspire/` to a new folder, edit it, and add it to the NOW list in `index.html` and the prev/next links.
- New post: copy `writing/game-boy-color/`, edit, then add it to `writing/index.html` and the WRITING list on the home page.

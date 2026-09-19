# VFX Football League website

Static site for the VFX Football League (VFL). Built with [Eleventy](https://www.11ty.dev/),
deployed free on GitHub Pages, with live league data embedded from Sofascore.

- **News posts are Markdown files** in `src/posts/` — write one, push it, it's live.
- **League data is never retyped.** Tables, fixtures and top scorers are live Sofascore widgets.
- **No database, no server, no monthly bill.**

---

## Quick start

```bash
npm install          # once
npm start            # local dev server at http://localhost:8080, reloads as you save
npm run build        # production build into _site/
```

Node 20 or newer.

---

## Writing a news post

1. Copy `src/posts/_template.md` to a new file, e.g. `src/posts/season-2027-dates.md`.
   The filename becomes the URL: `/news/season-2027-dates/`.
2. Fill in the front matter at the top:

   ```yaml
   ---
   title: Season 2027 dates confirmed
   date: 2026-11-04
   summary: One or two sentences for the news list and link previews.
   tags: ["Announcement"]
   ---
   ```

3. Write the body in Markdown. Delete `draft: true` when you want it to go live.
4. Commit and push to `main`. It builds and deploys itself in about a minute.

`_template.md` has worked examples of images, captions, YouTube/Vimeo embeds, self-hosted
video and Instagram embeds. It never appears on the site because it is marked `draft: true`.

**Images and video** go in `src/assets/img/` and are referenced as `/assets/img/filename.jpg`.
Keep photos under ~500 KB each — resize before committing, GitHub Pages has a soft 1 GB repo limit.

---

## Rolling the site over to a new season

Everything season-specific lives in **`src/_data/site.json`**. Nothing else needs touching.

```jsonc
"currentSeason": "2027",
"sofascore": {
  "division1": {
    "tournamentId": 126383,        // from the widget builder
    "seasonId": 87096,             // <- the new season id
    "group": "VFX League London 2027",
    "rounds": 11,
    "currentRound": 1
  }
}
```

To find new IDs: go to <https://widgets.sofascore.com/config/standings>, pick
**Minifootball → VFX Football League Division 1 → the season → the group**, then read the IDs out
of the embed code it gives you. The URL shape is:

```
https://widgets.sofascore.com/embed/tournament/<tournamentId>/season/<seasonId>/standings/<group>
https://widgets.sofascore.com/embed/unique-tournament/<uniqueTournamentId>/season/<seasonId>/editorFixtures?round=N
https://widgets.sofascore.com/embed/unique-tournament/<uniqueTournamentId>/season/<seasonId>/topPlayers?sortBy=goals
```

Sofascore widgets are free with no limits and no account.

Past seasons are archived in **`src/_data/honours.json`** — add the finished table there when a
season ends, and update `titleHolder`.

Teams live in **`src/_data/teams.json`**, FAQs in **`src/_data/faqs.json`**.

---

## Branches

- `dev` — working branch. Pushes here run a build check only, nothing deploys.
- `main` — production. Pushing here deploys the live site.

```bash
git add -A
git commit -m "Add season 2027 dates"
git push origin dev
# happy with it?
git checkout main && git merge dev && git push origin main
```

---

## Project structure

```
src/
├── _data/            site.json, nav.json, honours.json, teams.json, faqs.json
├── _includes/
│   ├── layouts/      base, page, post
│   ├── partials/     header, footer
│   └── macros.njk    Sofascore widget URL builders — one place, no copy-paste
├── assets/
│   ├── css/main.css  the whole design system
│   ├── js/main.js    nav, widget switchers, form submit
│   └── img/          logo, favicon, your photos
├── posts/            news posts (Markdown) + _template.md
├── static/           robots.txt, .nojekyll, (CNAME if you add one)
├── index.njk         home
├── about.njk  table.njk  fixtures.njk  honours.njk
├── teams.njk  news.njk   media.njk     contact.njk
├── 404.njk    sitemap.njk  feed.njk
└── ...
```

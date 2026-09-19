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

## Two things to switch on before launch

### 1. The contact form (5 minutes, free)

The contact page currently shows an email fallback. To turn on the real form:

1. Go to <https://web3forms.com>, enter **vflorganiser@gmail.com**, and it emails you an access key
   immediately. No account, no password.
2. Paste the key into `src/_data/site.json` → `contact.web3formsAccessKey`.
3. Push. Submissions now land in the Gmail inbox.

Free tier: 250 submissions/month. A honeypot field is already wired in to catch bots.
(If you'd rather use [Formspree](https://formspree.io), set `contact.formspreeEndpoint` and change
the form `action` in `src/contact.njk`.)

### 2. The Instagram feed (5 minutes, free)

The media page shows a fallback card until a feed is connected.

1. Go to <https://behold.so>, sign up free, connect **@vfxleague.london**, create a feed.
2. Copy the feed ID and paste it into `src/_data/site.json` → `instagram.beholdFeedId`.
3. Push. The grid appears automatically and stays in sync.

Behold's free tier covers one feed. [LightWidget](https://lightwidget.com) is an alternative —
set `instagram.provider` to `"lightwidget"` and paste its iframe URL into `instagram.lightwidgetUrl`.

> Instagram's own API needs a Meta developer app, a business account and a token that expires
> every 60 days. For a league site, a hosted widget is the right call.

---

## Hosting

**GitHub Pages, free tier. That's all this needs.** It is a static site — HTML, CSS and a little
JavaScript — so there is no server to pay for.

What you get free:

| | |
|---|---|
| Hosting + global CDN | Free, unlimited bandwidth in practice (100 GB/month soft limit) |
| HTTPS certificate | Free, automatic, renews itself |
| Custom domain | Supported free — you only pay the domain registrar (~£8–12/year) |
| Builds | GitHub Actions, free for public repos |

The only thing GitHub Pages can't do is run server code — and nothing here needs it.
The contact form posts to Web3Forms, the Instagram feed is a hosted widget, and the tables
come from Sofascore.

### Setting it up

0. **First run only:** move the two workflow files into place. They ship in
   `_github-workflows/` because `.github/workflows/` is a protected path:

   ```bash
   mkdir -p .github/workflows
   mv _github-workflows/*.yml .github/workflows/
   rm -rf _github-workflows
   ```

1. Push this repo to GitHub (public repo = free Actions minutes).
2. **Settings → Pages → Source: GitHub Actions.**
3. Push to `main`. The workflow in `.github/workflows/deploy.yml` builds and deploys.

Live at `https://<username>.github.io/<repo-name>/`. The workflow detects the sub-path and
rewrites links automatically, so it works out of the box.

### Custom domain — vfx-football-league.co.uk

Already wired up in this repo:

- `src/static/CNAME` contains `vfx-football-league.co.uk` and is copied to the root of the build.
- `site.url` in `src/_data/site.json` and the sitemap line in `src/static/robots.txt` both point at it.
- `deploy.yml` sees the CNAME file and builds with root-relative links (no `/repo-name/` prefix).

Remaining steps, in this order:

1. **DNS at your registrar.** Add five records:

   | Type | Name / Host | Value |
   |---|---|---|
   | A | `@` | `185.199.108.153` |
   | A | `@` | `185.199.109.153` |
   | A | `@` | `185.199.110.153` |
   | A | `@` | `185.199.111.153` |
   | CNAME | `www` | `<your-github-username>.github.io.` |

   Delete any parking/forwarding records the registrar added by default — they conflict.

2. **GitHub.** Settings → Pages → Custom domain → `vfx-football-league.co.uk` → Save.
   Wait for the DNS check to go green (minutes to a few hours), then tick **Enforce HTTPS**.

**Total running cost: the domain. Nothing else.**

### If you ever outgrow it

| Option | Cost | Why you'd switch |
|---|---|---|
| **GitHub Pages** | £0 | Default. Fine indefinitely for this site. |
| **Cloudflare Pages** | £0 | Faster builds, unlimited bandwidth, preview URL per branch, free serverless functions if you later want server-side code. Drop-in: build `npm run build`, output `_site`. |
| **Netlify** | £0 tier | Nicest preview deploys and a built-in forms feature (100/month free) that would replace Web3Forms. 100 GB/month bandwidth cap. |
| **Vercel** | £0 tier | Same idea; free tier is non-commercial only, so read the terms if you ever take sponsorship. |

All four are static hosts and this repo deploys to any of them unchanged. There is no scenario
in which this site needs a paid VPS or traditional web host.

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

## Accessibility & performance notes

- Keyboard navigable throughout, visible focus rings, skip link, `aria-current` on the active nav item.
- Tested from 320 px to 2560 px wide. Tables scroll horizontally on small screens rather than squashing.
- `prefers-reduced-motion` disables all animation.
- No tracking, no cookies, no consent banner needed. The only third-party requests are Google Fonts,
  the Sofascore widget iframes, and (once enabled) the Instagram widget.

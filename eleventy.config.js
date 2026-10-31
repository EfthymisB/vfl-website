import { DateTime } from "luxon";
import markdownItAttrs from "markdown-it-attrs";
import fs from "node:fs";

export default function (eleventyConfig) {
  // ---------------------------------------------------------------- assets
  eleventyConfig.addPassthroughCopy({ "src/assets": "assets" });
  eleventyConfig.addPassthroughCopy({ "src/static": "." });
  eleventyConfig.addWatchTarget("src/assets/");

  // ---------------------------------------------------------------- markdown
  // Lets a post write  ![alt](/img.png){.w-50 .align-center}  instead of a
  // full <figure>. Attributes are limited to the safe presentational ones so a
  // post can never inject an event handler.
  eleventyConfig.amendLibrary("md", (mdLib) =>
    mdLib.use(markdownItAttrs, {
      leftDelimiter: "{",
      rightDelimiter: "}",
      allowedAttributes: ["id", "class", "width", "height", "loading", "title"],
    })
  );

  // ------------------------------------------------------------ team tags
  // {% team "ilm" %}                     logo + name, inline in a sentence
  // {% logo "ilm" %}                     just the badge
  // {% score "ilm", 3, 0, "etc" %}       badge NAME 3 – 0 NAME badge
  // {% score "ilm", 3, 0, "etc", false %}  badges and the score only
  //
  // A team can be named by anything that identifies it in src/_data/teams.json:
  // its id ("0008"), its short name ("ILM", "Black Kite"), its initials ("BK")
  // or its full name. Case, spaces and punctuation are ignored. An unknown name
  // fails the build with the list of valid ones rather than shipping a gap.
  const TEAMS_FILE = "./src/_data/teams.json";
  const key = (v) => String(v ?? "").toLowerCase().replace(/[^a-z0-9]+/g, "");
  let teamCache = { mtime: 0, index: null, names: [] };

  function teamIndex() {
    const mtime = fs.statSync(TEAMS_FILE).mtimeMs;
    if (teamCache.index && teamCache.mtime === mtime) return teamCache;
    const data = JSON.parse(fs.readFileSync(TEAMS_FILE, "utf8"));
    const index = new Map();
    const names = [];
    for (const [id, t] of Object.entries(data.all || {})) {
      const bare = String(t.name || "").replace(/^FC\s+/i, "").replace(/\s+London$/i, "");
      for (const k of [id, t.short, t.initials, t.name, bare]) {
        if (k && !index.has(key(k))) index.set(key(k), t);
      }
      if (t.short) names.push(t.short);
    }
    teamCache = { mtime, index, names: names.sort() };
    return teamCache;
  }

  function findTeam(name) {
    const { index, names } = teamIndex();
    const t = index.get(key(name));
    if (!t) {
      throw new Error(
        `Unknown team "${name}". Use one of: ${names.join(", ")} ` +
        `(or an id / initials from src/_data/teams.json).`
      );
    }
    return t;
  }

  const esc = (v) =>
    String(v).replace(/&/g, "&amp;").replace(/</g, "&lt;")
             .replace(/>/g, "&gt;").replace(/"/g, "&quot;");

  function badge(t) {
    if (!t.logo) {
      return `<span class="team-logo team-logo--text" aria-hidden="true">${esc(t.initials || "?")}</span>`;
    }
    return `<img class="team-logo" src="${esc(t.logo)}" alt="" width="24" height="24" loading="lazy" decoding="async">`;
  }

  eleventyConfig.addShortcode("logo", (name) => {
    const t = findTeam(name);
    return `<span class="team-chip" title="${esc(t.name)}">${badge(t)}</span>`;
  });

  eleventyConfig.addShortcode("team", (name, label) => {
    const t = findTeam(name);
    const text = label || t.short || t.name;
    return `<span class="team-chip" title="${esc(t.name)}">${badge(t)}<span class="team-chip__name">${esc(text)}</span></span>`;
  });

  eleventyConfig.addShortcode("score", (home, homeScore, awayScore, away, showNames = true) => {
    const h = findTeam(home);
    const a = findTeam(away);
    const hn = showNames ? `<span class="scoreline__name">${esc(h.short || h.name)}</span>` : "";
    const an = showNames ? `<span class="scoreline__name">${esc(a.short || a.name)}</span>` : "";
    const win = (x, y) => (Number(x) > Number(y) ? " is-win" : "");
    return (
      `<span class="scoreline">` +
        `<span class="scoreline__side${win(homeScore, awayScore)}" title="${esc(h.name)}">${badge(h)}${hn}</span>` +
        `<span class="scoreline__score">${esc(homeScore)}<i>–</i>${esc(awayScore)}</span>` +
        `<span class="scoreline__side scoreline__side--away${win(awayScore, homeScore)}" title="${esc(a.name)}">${an}${badge(a)}</span>` +
      `</span>`
    );
  });

  // ---------------------------------------------------------------- filters
  const zone = "Europe/London";

  eleventyConfig.addFilter("readableDate", (d, fmt = "d LLL yyyy") =>
    DateTime.fromJSDate(new Date(d), { zone }).toFormat(fmt)
  );

  eleventyConfig.addFilter("isoDate", (d) =>
    DateTime.fromJSDate(new Date(d), { zone }).toISO()
  );

  eleventyConfig.addFilter("htmlDate", (d) =>
    DateTime.fromJSDate(new Date(d), { zone }).toFormat("yyyy-LL-dd")
  );

  eleventyConfig.addFilter("limit", (arr, n) => (arr || []).slice(0, n));

  eleventyConfig.addFilter("excerpt", (post) => {
    if (post.data && post.data.summary) return post.data.summary;
    const text = String(post.templateContent || "").replace(/<[^>]+>/g, " ");
    return text.replace(/\s+/g, " ").trim().slice(0, 180) + "…";
  });

  // Strip a trailing slash so canonical URLs read cleanly.
  eleventyConfig.addFilter("absoluteUrl", (url, base) => {
    try {
      return new URL(url, base).href;
    } catch {
      return url;
    }
  });

  // ---------------------------------------------------------------- collections
  // A draft gets permalink:false (see src/posts/posts.11tydata.js), so it has
  // no url. Filtering on url means this collection follows the draft rule
  // automatically: drafts are listed on the dev server and never in a build.
  const isPublished = (p) => Boolean(p.page && p.page.url);

  eleventyConfig.addCollection("posts", (api) =>
    api
      .getFilteredByGlob("src/posts/*.md")
      .filter(isPublished)
      .sort((a, b) => b.date - a.date)
  );

  eleventyConfig.addCollection("postTags", (api) => {
    const tags = new Set();
    api
      .getFilteredByGlob("src/posts/*.md")
      .filter(isPublished)
      .forEach((p) => (p.data.tags || []).forEach((t) => tags.add(t)));
    return [...tags].sort();
  });

  // ------------------------------------------------- sub-path deployments
  // Serving from https://user.github.io/repo-name/ instead of a domain root?
  // Set PATH_PREFIX=/repo-name/ and every root-relative link in the built HTML
  // is rewritten, including links written inside Markdown posts.
  const prefix = (process.env.PATH_PREFIX || "/").replace(/\/+$/, "");
  if (prefix) {
    eleventyConfig.addTransform("pathPrefix", function (content) {
      if (!String(this.page.outputPath || "").endsWith(".html")) return content;
      return content.replace(/(href|src)="\/(?!\/)/g, `$1="${prefix}/`);
    });
  }

  // ---------------------------------------------------------------- config
  return {
    dir: {
      input: "src",
      output: "_site",
      includes: "_includes",
      data: "_data",
    },
    markdownTemplateEngine: "njk",
    htmlTemplateEngine: "njk",
    templateFormats: ["njk", "md", "html"],
  };
}

import { DateTime } from "luxon";

export default function (eleventyConfig) {
  // ---------------------------------------------------------------- assets
  eleventyConfig.addPassthroughCopy({ "src/assets": "assets" });
  eleventyConfig.addPassthroughCopy({ "src/static": "." });
  eleventyConfig.addWatchTarget("src/assets/");

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
  eleventyConfig.addCollection("posts", (api) =>
    api
      .getFilteredByGlob("src/posts/*.md")
      .filter((p) => !p.data.draft)
      .sort((a, b) => b.date - a.date)
  );

  eleventyConfig.addCollection("postTags", (api) => {
    const tags = new Set();
    api
      .getFilteredByGlob("src/posts/*.md")
      .filter((p) => !p.data.draft)
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

// Eleventy sets ELEVENTY_RUN_MODE to "serve" or "watch" for the dev server and
// "build" for a one-off build. `npm start` is a serve, and the GitHub Actions
// deploy runs `npm run build`, so drafts show up on localhost and never ship.
//
// The test is deliberately positive — drafts appear ONLY when we can see we are
// in a dev server. If the variable is ever missing or renamed, drafts stay
// hidden, which is the safe way round to be wrong.
//
// To preview drafts in a production-style build: DRAFTS=1 npm run build
const RUN_MODE = process.env.ELEVENTY_RUN_MODE;
const SHOW_DRAFTS =
  (RUN_MODE === "serve" || RUN_MODE === "watch" || process.env.DRAFTS === "1") &&
  !process.env.CI;

export default {
  layout: "layouts/post.njk",
  tags: [],
  eleventyComputed: {
    // A hidden draft is built into nothing: no page, no collection entry, no
    // feed item. A shown draft behaves like any other post.
    permalink: (data) =>
      data.draft && !SHOW_DRAFTS ? false : `/news/${data.page.fileSlug}/`,
    eleventyExcludeFromCollections: (data) =>
      Boolean(data.draft) && !SHOW_DRAFTS,
    // True only when this post is a draft that is currently being shown.
    isVisibleDraft: (data) => Boolean(data.draft) && SHOW_DRAFTS,
  },
};

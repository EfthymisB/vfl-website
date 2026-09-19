export default {
  layout: "layouts/post.njk",
  tags: [],
  eleventyComputed: {
    // Drafts are built into nothing: no page, no collection entry, no feed item.
    permalink: (data) =>
      data.draft ? false : `/news/${data.page.fileSlug}/`,
    eleventyExcludeFromCollections: (data) => Boolean(data.draft),
  },
};

---
title: Post title goes here
date: 2026-01-01
summary: One or two sentences that show up in the news list, the RSS feed and link previews.
tags: ["Announcement"]
draft: true

# Optional header image. Put the file in src/assets/img/ and reference it like this:
# hero: /assets/img/my-photo.jpg
# heroAlt: Description of the photo for screen readers
# heroCaption: Optional caption under the image
---

This file is a **template**. It has `draft: true` in the front matter, so it never appears on the
site. Copy it, rename it, delete this paragraph and set `draft` to `false` (or remove the line).

Write in Markdown. Everything below is a reference for what you can drop into a post.

## Headings, text and links

Use `##` for section headings, `**bold**` for **bold**, and `[link text](/table/)` for
[links](/table/). Internal links start with a slash; external ones need the full `https://` address.

## Images

Put the image in `src/assets/img/` and reference it by path:

![Description of the photo for screen readers](/assets/img/example.jpg)

For a caption, use HTML instead:

<figure>
  <img src="/assets/img/example.jpg" alt="Description for screen readers">
  <figcaption>Coffee & TV celebrate the winner, September 2026.</figcaption>
</figure>

## Video

A YouTube or Vimeo clip, responsive at every screen size:

<div class="video-embed">
  <iframe src="https://www.youtube.com/embed/VIDEO_ID" title="Match highlights" allowfullscreen loading="lazy"></iframe>
</div>

An MP4 you've put in `src/assets/img/` instead:

<video controls preload="metadata" poster="/assets/img/thumbnail.jpg">
  <source src="/assets/img/highlights.mp4" type="video/mp4">
</video>

## An Instagram post

Open the post on Instagram, choose **Embed**, copy the code and paste it straight in. It works as-is.

## Quotes and lists

> A pull quote looks like this.

- A bullet
- Another bullet

1. A numbered item
2. Another one

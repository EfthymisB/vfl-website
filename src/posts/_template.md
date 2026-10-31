---
title: Post title goes here
date: 2100-01-01
summary: One or two sentences that show up in the news list, the RSS feed and link previews.
tags: ["Announcement"]
draft: true

# Optional header image. Put the file in src/assets/img/ and reference it like this:
# hero: /assets/img/my-photo.jpg
# heroAlt: Description of the photo for screen readers
# heroCaption: Optional caption under the image
---

This file is a **template**. It has `draft: true` in the front matter, so it never appears on
the site. Copy it, rename it, delete this paragraph and set `draft` to `false` (or remove the
line). Everything below is a reference for what you can drop into a post.

## Headings, text and links

Use `##` for section headings, `**bold**` for **bold**, and `[link text](/table/)` for
[links](/table/). Internal links start with a slash; external ones need the full `https://`
address.

## Images

Plain Markdown fills the width of the text column:

![Description for screen readers](/assets/img/placeholder_h.png)

To change that, add classes. There are two ways to do it and they produce the same result —
use whichever suits the moment.

**Shorthand**, for a bare image:

![Description for screen readers](/assets/img/placeholder_h.png){.w-50 .align-center}

**A figure**, when you want a caption:

<figure class="w-50 align-center">
  <img src="/assets/img/placeholder_h.png" alt="Description for screen readers">
  <figcaption>Half width, centred, with a caption.</figcaption>
</figure>

### The classes

| Class | What it does |
| --- | --- |
| `w-75` `w-60` `w-50` `w-33` `w-25` | A percentage of the text column |
| `align-left` `align-center` `align-right` | Where a narrowed image sits |
| `float-left` `float-right` | Text wraps around it |
| `w-bleed` | Wider than the text column, for one big photo |
| `plain` | No border or rounded corners — for logos and cut-outs |

You can also set an exact pixel width:

![alt](/assets/img/placeholder_h.png){width=220}

## Text next to an image

Two ways, and the difference matters.

### Float — text wraps around the image

The paragraphs that follow flow around the image and then continue underneath it. Best when
you have a few paragraphs; with one short one it looks lopsided. Add a width class to make it
smaller than the default 42%.

![Description for screen readers](/assets/img/placeholder_v.png){.float-right .w-33}

Write your paragraphs straight after the image, as normal Markdown, and they will wrap around
it. A following `##` or `###` heading always starts clear of the image, so a float can never
spill into the next section.

### Side by side — two columns, no wrapping

Use this when the image and the text should stay in their own columns.

<div class="side-by-side">
  <figure><img src="/assets/img/placeholder_h.png" alt="Description for screen readers"></figure>
  <div>

Text goes here. Leave a blank line after the opening `<div>` and before the closing one, or
Markdown will not format what is inside.

  </div>
</div>

Add `img-small` for a narrow image and wide text (good for a portrait shot), `img-big` for the
reverse, or `top` to align to the top instead of the middle. To put the text on the left, just
put its `<div>` first.

## A row of images

<div class="gallery">
  <figure><img src="/assets/img/placeholder_v.png" alt=""></figure>
  <figure><img src="/assets/img/placeholder_v.png" alt=""></figure>
  <figure><img src="/assets/img/placeholder_v.png" alt=""></figure>
</div>

<div class="gallery">
  <figure><img src="/assets/img/placeholder_h.png" alt=""></figure>
  <figure><img src="/assets/img/placeholder_h.png" alt=""></figure>
</div>

Three across on a laptop, two on a phone, as many rows as it needs.

## Teams and scores

Team badges come from `src/_data/teams.json`, so you never type an image path. Name a team by
its short name, its initials, its full name or its id — case, spaces and punctuation are
ignored. A name that does not exist stops the build and tells you the valid ones, rather than
shipping a gap on the page.

###

**A team, inline in a sentence** — badge and name:

```
{% raw %}{% team "ilm" %} beat {% team "etc" %} three–nil in February.{% endraw %}
```
{% team "ilm" %} beat {% team "etc" %} three–nil in February.

###

**Just the badge:**

```
{% raw %}{% logo "dneg" %}{% endraw %}
```
{% logo "dneg" %}

###

**A scoreline** — badge, name, score, name, badge. The winning side is highlighted:

```
{% raw %}{% score "ilm", 3, 0, "etc" %}{% endraw %}
```
{% score "ilm", 3, 0, "etc" %}

###

Pass `false` as a fifth argument for badges and the score only:

```
{% raw %}{% score "ilm", 3, 0, "etc", false %}{% endraw %}
```
{% score "ilm", 3, 0, "etc", false %}

###

**A round of results** — put them in a list with `class="results"` and the columns line up:

```html
{% raw %}<ul class="results">
  <li>{% score "ilm", 3, 0, "etc" %}</li>
  <li>{% score "framestore", 2, 1, "coffee & tv" %}</li>
  <li>{% score "dneg", 2, 2, "absolute" %}</li>
</ul>{% endraw %}
```
<ul class="results">
  <li>{% score "ilm", 3, 0, "etc" %}</li>
  <li>{% score "framestore", 2, 1, "coffee & tv" %}</li>
  <li>{% score "dneg", 2, 2, "absolute" %}</li>
</ul>

To override the name shown, pass a second argument:

```
{% raw %}{% team "ilm", "ILM Example" %}{% endraw %}
```
{% team "ilm", "ILM Example" %}

## On phones

Every layout class collapses to full width below roughly 670px. Floats stop floating,
side-by-side stacks, and the gallery drops to two across. You never need to write a mobile
version of anything.

## Video

A YouTube or Vimeo clip, responsive at every screen size:

<div class="video-embed">
  <iframe src="https://www.youtube.com/embed/VIDEO_ID" title="Match highlights" allowfullscreen loading="lazy"></iframe>
</div>

An MP4 you have put in `src/assets/img/` instead:

<video controls preload="metadata" poster="/assets/img/thumbnail.jpg">
  <source src="/assets/img/highlights.mp4" type="video/mp4">
</video>

## An Instagram post

Open the post on Instagram, choose **Embed**, copy the code and paste it straight in. It works
as-is.

## Quotes and lists

> A pull quote looks like this.

- A bullet
- Another bullet

1. A numbered item
2. Another one

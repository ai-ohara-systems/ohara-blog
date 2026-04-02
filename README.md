# Ohara Blog

Official blog of [ohara.systems](https://ohara.systems) — hands-on articles about LLM engineering, AI operations, model routing, and enterprise AI infrastructure. Published in English and German at [blog.ohara.systems](https://blog.ohara.systems).

Built with Astro 6 + Tailwind CSS 4.

---

## Table of Contents

- [Requirements](#requirements)
- [Local Development](#local-development)
- [Project Structure](#project-structure)
- [Writing a Blog Post](#writing-a-blog-post)
- [Bilingual Posts](#bilingual-posts)
- [Frontmatter Reference](#frontmatter-reference)
- [Production Deployment](#production-deployment)

---

## Requirements

| Dependency | Version | Notes |
|---|---|---|
| Node.js | **22.12.0+** | Required by Astro 6 — Node 20 will not work |
| npm | 10+ | |

```bash
node --version   # must be >= 22.12.0
nvm install 22 && nvm use 22   # if needed
```

---

## Local Development

```bash
npm install
npm run dev
```

Blog runs at **http://localhost:4321**.

```bash
npm run dev       # Dev server — new posts appear immediately on save
npm run build     # Build static output to ./dist
npm run preview   # Preview the production build locally
```

---

## Project Structure

```
src/
  content/
    blog/
      en/           # English posts  →  blog.ohara.systems/<slug>
      de/           # German posts   →  blog.ohara.systems/de/<slug>
  pages/
    index.astro          # German blog index (default)
    [slug].astro         # German post renderer
    en/
      index.astro        # English blog index
      [slug].astro       # English post renderer
    rss.xml.js           # RSS feed
  layouts/
    Base.astro
    BlogPost.astro
  components/
    Nav.astro
    Footer.astro
public/
  ohara-systems-logo.svg
```

---

## Writing a Blog Post

### 1. Create the file

| Language | Path | URL |
|---|---|---|
| English | `src/content/blog/en/my-post-slug.md` | `blog.ohara.systems/my-post-slug` |
| German | `src/content/blog/de/mein-post-slug.md` | `blog.ohara.systems/de/mein-post-slug` |

The filename (without `.md`) becomes the URL slug. Use lowercase kebab-case.

### 2. Add frontmatter

```markdown
---
title: "Your Post Title"
description: "A short description shown in listings and meta tags."
date: "2026-04-02"
tag: "routing"
tagColor: "#38bdf8"
readTime: "8 min read"
lang: "en"
---

## First Section

Your content here...
```

### 3. Write content

Standard Markdown. Code blocks with language hints are syntax highlighted:

````markdown
```bash
docker compose up -d
```

```python
from openai import OpenAI
client = OpenAI(base_url="https://prism.yourdomain.com/api/my-team/v1", api_key="omp-...")
```
````

### 4. Preview

```bash
npm run dev
```

Open `http://localhost:4321` — your post appears in the listing immediately.

---

## Bilingual Posts

Posts are independent — no hard coupling between a German and English version. To publish a post in both languages:

1. Write `src/content/blog/en/my-topic.md`
2. Write `src/content/blog/de/mein-thema.md`

Translate naturally. Both versions can be published independently — they do not need to go live at the same time.

---

## Frontmatter Reference

| Field | Required | Description | Example |
|---|---|---|---|
| `title` | yes | Post title — shown in listing and as `<h1>` | `"Free AI Models with Qwen"` |
| `description` | yes | 1–2 sentence summary for listings and meta tags | `"How to run zero-cost agents..."` |
| `date` | yes | Publication date in `YYYY-MM-DD` format | `"2026-04-02"` |
| `tag` | yes | Category label shown as badge | `"routing"`, `"cost"`, `"ops"` |
| `tagColor` | yes | Hex color for the tag badge | `"#38bdf8"` |
| `readTime` | yes | Estimated reading time | `"6 min read"` |
| `lang` | yes | Post language | `"en"` or `"de"` |

**Common tag colors:**

| Topic | Color |
|---|---|
| AI / LLM | `#38bdf8` (sky blue) |
| Cost / Savings | `#e879f9` (pink) |
| Operations | `#fb923c` (orange) |
| Routing | `#a3e635` (lime) |
| Security | `#f87171` (red) |
| Agents | `#818cf8` (indigo) |

---

## Production Deployment

```bash
npm run build
# Output: ./dist — deploy this folder
```

Fully static HTML. Deploy `dist/` to any static host. New posts go live as soon as the deploy completes (~1–2 minutes after push to `main`).

---

## License

Licensed under the **Elastic License 2.0** with **Ohara Systems Additional Terms**.

- [LICENSE](./LICENSE) — Elastic License 2.0
- [OHARA_TERMS.md](./OHARA_TERMS.md) — Ohara Systems Additional Terms

Copyright (c) 2026–present Ohara Systems. All rights reserved.

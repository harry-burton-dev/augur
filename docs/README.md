# AUGUR's documentation site

The documentation people read about AUGUR: how to run it, administer it and build apps for it. It's built
with [Starlight](https://starlight.astro.build) and published on AUGUR's website, one version per release.

The pages are in `src/content/docs/`. The guides beside this file (`docs/*.md`) are the old ones; each moves
into the site, rewritten, and is deleted in the same pull request.

## Working on it

The site is its own pnpm project, apart from AUGUR's workspace, and needs no package token:

```sh
cd docs
pnpm install
pnpm dev     # http://localhost:4321, reloads as you edit
pnpm build   # what CI runs on any change under docs/
```

`DOCS_SITE_URL` (the site's origin) and `DOCS_BASE` (the path it's served under, `/` unless set) come from
the build's environment.

## Sections and readers

| Section | Folder | Who it's for |
| --- | --- | --- |
| Get started | `get-started/` | Everyone: what AUGUR is, concepts, quickstarts, glossary |
| Run AUGUR | `run/` | People who run AUGUR's servers |
| Administer | `administer/` | Admins working in Admin |
| Build apps | `build/` | People who make apps |
| Reference | `reference/` | Generated from the code, never written by hand |
| Release notes | `release-notes/` | One page per release |
| Planned | `planned/` | What's agreed or being shaped, not built |

## Every page

Front matter needs a `title`, a one-line `description` and a `status`, or the build fails:

```yaml
---
title: Restore a lost server
description: Bring AUGUR back on a new machine from its off-server backup.
status: stable          # stable, beta or planned
checkedAgainst: 0.24.0  # the release you last checked the page against; none on a Planned page
---
```

The status shows beside the title and in the sidebar. A Planned page says only what has been decided,
and nothing about when.

Write for the reader, not about how AUGUR was made: no decision record numbers, no names of the people
who work on it, no internal process. Say "AUGUR", never "the platform".

## Kinds of page

Each page is one kind. If a page needs two, it's two pages that link to each other.

**Tutorial**: someone new learning by doing. What you'll build; before you start; numbered steps, each
ending in something you can see; what's next.

**How-to**: one task, named in the title ("Restore a lost server"). When you'd do it; steps; how to check
it worked; if it goes wrong.

**Concept**: why it works this way. What it is; how it fits with the rest; what it means for you; links to
the how-tos.

**Reference**: generated from the source the code uses (OpenAPI files, JSON schemas, settings, event
topics, API reports), with one line of introduction written by hand.

---
title: What browsers load
description: Where browsers load AUGUR's UI kit from, and how focus is drawn on desktops without a GPU.
status: beta
checkedAgainst: 0.24.0
sidebar:
  order: 10
---

Two settings change what people's browsers load: where the UI kit comes from, and how AUGUR draws focus
behind a dialog.

## The UI kit

The shell and every app share one copy of the UI kit (React and AUGUR's components), the version the AUGUR
release pinned in `release/kit.json`. The front door serves it at `PLATFORM_URL/kit/<version>/`, and `KIT_URL`
in `.env` says where browsers load it from:

- **Unset, or `/kit/`** (the default): from this server. Nothing else to do.
- **A CDN in front**: set `KIT_URL` to an https address, ending in `/`, that serves the same files at the same
  paths, for example a CDN that mirrors `PLATFORM_URL/kit/`. It must send `Access-Control-Allow-Origin` for
  `PLATFORM_URL`, because the browser loads the kit as modules. Then run `pc up -d web`. The page names the
  full version, so the CDN can keep each file forever.

The page holds every kit file to the hash in the release, so a CDN that serves anything else is refused, and
the shell then shows a note naming `KIT_URL` instead of a blank page. The front door's Content Security Policy
allows the kit's site when it isn't this one. A `KIT_URL` that isn't a path or an https address is ignored and
the default is used: `pc logs web` says so.

## Desktops without a GPU

Behind a dialog, the palette or the radial menu, the shell and every app go out of focus instead of going
dark. Blurring the page is quick on a desktop with a GPU and slow on one without, such as most virtual
desktops. `FOCUS_DEPTH` in `.env` says how the whole deployment draws it:

- **Unset** (the default): each app chooses, which is `veil` unless it says otherwise.
- **`veil`** or **`lens`**: blur what's behind, through a layer over it or by blurring the page itself.
- **`scrim`**: only dim it. Nothing on the page blurs, and see-through panels turn solid so they stay
  readable.

Then run `pc up -d web`; people see it the next time they load AUGUR. A value that isn't one of these is
ignored and leaves it to each app: `pc logs web` says so.

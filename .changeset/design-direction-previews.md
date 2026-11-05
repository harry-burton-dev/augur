---
'@augur/registry': minor
'@augur/home': minor
'@augur/shell': patch
---

The design direction behind feature previews (PER-283). AUGUR's own apps can offer feature previews: they stay at the server's default (opt-in on a dev or preview server, off on a production one), people turn them on in Previews, and Admin says why it can't change them. Home offers two, both off until someone turns them on: `focal-planes` (what needs you comes forward, with its count in light and words, and the glance cards go quiet) and `radial-menu` (each thing that needs you opens its actions in a ring: right-click, a long press, or its "more" mark).

The shell serves kit 0.5.4 (Common 0.8.0, Quill 0.9.0), which brings the design picks' parts, each off until an app turns it on.

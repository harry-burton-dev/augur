# Licensing

AUGUR is proprietary: © 2026 Harry Burton, all rights reserved. Anyone, Harry's organisation included,
uses it only under a written agreement with the copyright holder. The decision is recorded in the
handbook's Decision register as a PDR ("AUGUR stays proprietary until Harry chooses to open it"); the
text is in [`LICENSE`](https://github.com/harry-burton-dev/augur/blob/main/LICENSE) at the root of
the repository. Questions go to the address at the end of that file.

## How the repository says so

| Where | What it carries |
| --- | --- |
| `LICENSE` at the root | The proprietary notice. |
| Every `package.json` | `"license": "UNLICENSED"`, npm's value for "not licensed for use by others", beside `"private": true`, which stops an accidental `npm publish`. |
| Every image AUGUR builds | `org.opencontainers.image.licenses="LicenseRef-AUGUR-Proprietary"`, an SPDX licence reference, next to the `source` label (`infra/service.Dockerfile`, `infra/web.Dockerfile`). |

A new `package.json` or image stage carries the same value. A new app made from augur-app-template
has it in its packages already.

## Open-source parts

AUGUR ships and runs code others wrote. Each part keeps its own licence, and AUGUR credits it in
`THIRD_PARTY_NOTICES.md` at the root:

- **Shipped in AUGUR's images and frontends:** every production dependency (`pnpm licenses list --prod`),
  one table per licence, then each distinct licence text once. AUGUR's own packages (`@augur/*`,
  `@apps/*`, the kit from GitHub Packages) aren't listed.
- **Run beside AUGUR, unmodified:** the images the Compose file starts but AUGUR doesn't build, and the
  base images AUGUR builds on, from `licences.extra.json`.
- **Data:** third-party data files AUGUR carries, also from `licences.extra.json`.

The file is generated: `pnpm notices` writes it from what is installed. `pnpm version-packages` runs it,
so every release ships current notices, and so does the Lockfile workflow (Actions → Lockfile → Run
workflow, with the branch), for a cloud session that can't install the kit. Between releases it may lag
a dependency update; nothing checks that on pull requests, to keep Renovate's pull requests moving.

The web image serves both files without sign-in, as plain text: `/legal/licence.txt` and
`/legal/third-party.txt`. Service images carry them in `/usr/share/augur/`.

## The licence check

`pnpm check:licences` runs in CI beside `check:catalog`. It fails when:

1. a `package.json` doesn't say `"license": "UNLICENSED"`;
2. a production dependency is under a strong or network copyleft licence (`GPL-*`, `AGPL-*`,
   `SSPL-*`, `EUPL-*`, `OSL-*`) or an unknown one, because that could force AUGUR's own code open. An
   `OR` expression passes when any branch may ship; an `AND` expression needs every part. Weak
   copyleft (`LGPL-*`, `MPL-2.0`) and permissive licences pass. Dev dependencies don't ship and aren't
   checked;
3. `infra/deploy/compose.yml` runs an image, other than AUGUR's own, that `licences.extra.json`
   doesn't credit;
4. `THIRD_PARTY_NOTICES.md` is missing.

To let a refused package in, Harry reviews it and an entry goes in `licences.allow.json`:
`{ "package", "licence", "why", "reviewed", "by" }`. Nobody adds one without him; usually the answer is
another package.

To add an image or a data file, add its entry to `licences.extra.json` (image name without its tag,
licence, homepage, a note when it matters), then `pnpm notices`.

Programs AUGUR runs beside its own code, unmodified and over the network (Garage, Grafana's stack), keep
their own licences, AGPL ones included. If AUGUR ever ships a modified copy of one, its source must be
offered under that licence.

## Apps in their own repositories

Each app, kit and template repository (ADR 0012, ADR 0046) carries the same `LICENSE` at its root and
`"license": "UNLICENSED"` in its `package.json` files. A new app made from the app template gets both.

## If AUGUR opens later

Opening AUGUR is a new PDR that replaces this one. `LICENSE`, the image label and the `package.json`
values then change together in one pull request; past releases keep the licence they shipped with.

# Licensing

AUGUR is proprietary: © 2026 Harry Burton, all rights reserved. Anyone, Harry's organisation included,
uses it only under a written agreement with the copyright holder. The decision is recorded in the
handbook's Decision register as a PDR ("AUGUR stays proprietary until Harry chooses to open it"); the
text is in [`LICENSE`](https://github.com/harry-burton-dev/im-platform/blob/main/LICENSE) at the root of
the repository. Questions go to the address at the end of that file.

## How the repository says so

| Where | What it carries |
| --- | --- |
| `LICENSE` at the root | The proprietary notice. |
| Every `package.json` | `"license": "UNLICENSED"`, npm's value for "not licensed for use by others", beside `"private": true`, which stops an accidental `npm publish`. |
| Every image AUGUR builds | `org.opencontainers.image.licenses="LicenseRef-AUGUR-Proprietary"`, an SPDX licence reference, next to the `source` label (`infra/service.Dockerfile`, `infra/web.Dockerfile`). |

A new `package.json` or image stage carries the same value. `pnpm create-app` writes it into a new
app's packages.

## Open-source parts

AUGUR ships and runs code others wrote. Each part keeps its own licence, and AUGUR must credit it.
`THIRD_PARTY_NOTICES.md` (generated from the lockfile, coming with the licence check) lists them.

AUGUR doesn't take in a production dependency under a strong or network copyleft licence (GPL, AGPL,
SSPL, EUPL, OSL) without Harry's review, because that could force AUGUR's own code open. Programs AUGUR
runs beside its own code, unmodified and over the network (Garage, Grafana's stack), keep their own
licences, AGPL ones included.

## Apps in their own repositories

Each app, kit and template repository (ADR 0012, ADR 0046) carries the same `LICENSE` at its root and
`"license": "UNLICENSED"` in its `package.json` files. A new app made from the app template gets both.

## If AUGUR opens later

Opening AUGUR is a new PDR that replaces this one. `LICENSE`, the image label and the `package.json`
values then change together in one pull request; past releases keep the licence they shipped with.

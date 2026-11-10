# AUGUR: notes for coding agents

AUGUR is an app platform built to be deployed many times: Harry's dev
workbench, a demo, and later his organisation's private cloud. A shell in the
browser loads separately built apps (native import map plus `import()`, not
Module Federation). Behind one gateway sit the platform services: identity,
registry, events, storage, models, updater. It is in BETA; there is no phone
layout yet.

## Where to look first
1. **Decisions:** the Decision register in the AUGUR handbook (Google Drive
   folder "Augur", `04 Decisions`,
   https://drive.google.com/drive/folders/16wXmUMRNP2_vXAlf4kBMF9hCDNUXg7yO)
   lists every ADR and PDR, with its status and a link. Check the ones that
   touch your work before changing it. If your change goes against an Accepted
   record, it needs a new Proposed record first, and the deviating part doesn't
   merge until Harry accepts it. Records are never written into a repository:
   ask for a number and send what was decided and why.
2. **The task:** its Linear issue (team PER, initiative AUGUR).
3. **Product, principles, architecture, naming:** the AUGUR handbook, starting
   from "00 Start here"
   (https://drive.google.com/drive/folders/1CDGBoi620UrDG3DY2biDXIHrpA8dICDh).
   Shell principles and App patterns are in its `02 Principles`; CI/CD and the
   deploy test in `03 Architecture/Engineering`.
4. **Docs:** `docs/` is the docs site (Starlight, ADR 0082; `docs/README.md`
   has the page kinds and front matter), plus the older guides still waiting
   to move into it. Update the matching page in the same PR. Any other
   Markdown file fails `pnpm check:docs`: documents belong in the handbook.

Project memory holds current state (what's in flight, ids, links), not rules.
If a rule is only in memory, it belongs here, in an ADR or in the handbook.

## Rules that hold everywhere
- **Many deployments, one codebase.** Every name, label, URL, limit and app
  id comes from state, config or a manifest. Harry's examples in chat
  ("Department 1 library", "ARTIFACTS") are illustrations, not specs: a
  literal string copied from chat into code is a bug.
- **Prefer established tools.** Use a maintained open-source library or
  standard before writing our own, and follow common conventions. Adding a
  dependency, tool or service needs an ADR.
- **Explain, never hide.** Anything unavailable stays visible, looks
  unavailable and says why and who can change it. Hide only what someone may
  not know exists. Full rules: Shell principles, in the handbook's
  `02 Principles`.
- **Recommend what it should be,** not only what was asked, and say where you
  went beyond the ask.

## Names
- The platform is **AUGUR**. Never "IM platform", "Information Platform",
  "Wave" or "platform" in anything a person reads.
- No app ships with AUGUR (ADR 0075): every app is installed from the app
  feed and reaches AUGUR only through the gateway. Apps are **platform apps**
  (using and managing AUGUR; Home, Admin and Deployment come with it;
  Deployment, once the Upgrade Centre, keeps the id and route `upgrades`)
  or **pillar apps** (the foundation of its output). Today's apps (Artifacts,
  code name Folio; Explorer, Auspex; Data Atlas; Mandate) were taken out to be
  redesigned under the app contract. Code names stay out of what people read.
- Old ids kept on purpose so live servers keep working: Keycloak realm
  `platform` and clients `platform-*`, Postgres db/user `platform`, Compose
  project `platform`, `PLATFORM_*` env keys, and the image and feed path
  `ghcr.io/harry-burton-dev/im-platform` (it stayed when the repository was
  renamed to `augur`). The updater and registry also still trust releases
  signed under the old repository name. Don't rename them without an
  upgrade note in docs/upgrade.md.

## Structure (ADR 0002)
- `platform/` owns the shell, SDK and services. Apps live in their own
  repositories (ADR 0012). Nothing in `platform/`
  imports an app and apps never import each other: `pnpm check:boundaries`.
- Apps reach AUGUR only through `@augur/*` packages, the gateway, the
  manifest and domain events.
- Shared hot spots: `platform/packages/mfe-sdk`, `platform/services/gateway`. Keep
  changes there in their own small PR and merge it first.
- The React kits (Common, Quill, Aerie) and their tokens live in the
  `augur-kit` repository (ADR 0046) and arrive here as packages from GitHub
  Packages (`.npmrc`, `NODE_AUTH_TOKEN`). A kit change is a kit release, then
  a PR here that bumps it. A cloud session can't read those packages: after
  changing a kit version, run the Lockfile workflow on the branch.

## Design rules (ADR 0015)
- Shell behaviour is a rule driven by manifests and floors, never a special
  case for one app or screen.
- Colours, durations and distances come only from
  the token files in `augur-kit`'s `packages/kit-common/tokens/` (`common`,
  `shell`, `app`; ADR 0015). New `floor-*` tokens must
  also be copied into the design tool Wave is made in (tell Harry).
- Icons come from Lucide through Common's `Icon` (`icon.tsx` in `augur-kit`).
  Never hand-write SVG.
- App layout and interaction rules agreed with Harry live in App patterns,
  in the AUGUR handbook's `02 Principles`. A live design session sends each
  agreed rule to be written there.
- Design research lives outside this repository, in the Design lab (Google
  Drive folder "Design lab",
  https://drive.google.com/drive/folders/1FL9KAmvd_wEkOfLO5-lxm3t1JI4jyY17).
  Nothing there ships; an idea moves into the product only through a record
  or App patterns. The lab's history up to its move is in git (the last
  commit with `design-lab/` is c1fd921).

## Working on a change
- `pnpm install`, then `pnpm build`, `pnpm test`, `pnpm typecheck`, `pnpm lint`. Also run
  `pnpm check:boundaries`, `pnpm check:manifest`, `pnpm check:migrations`,
  `pnpm check:reasons`, `pnpm check:catalog` and `pnpm check:settings` (any setting a
  deployment or a service reads: infra/deploy/settings.schema.json) when you touch those areas.
- Shell or kit changes: run the contract tests in `platform/contract`.
- Every PR carries a changeset (`pnpm changeset`, or `pnpm changeset --empty`),
  see docs/versioning.md.
- When an admin upgrading must act or know something because of your change, add a note at
  the top of "Release notes that need you" in docs/upgrade.md, starting `**From** unreleased`
  (`pnpm check:upgrade-notes`); the Version packages PR writes its release in.

## Pull requests and releases
- Open pull requests against `main`, the only
  long-lived branch (ADR 0011, docs/release-channels.md). A hotfix goes into
  its `release/<unit>-<major>.<minor>` branch, and then onto `main` too.
- Only Harry makes a release stable (Actions → Promote to stable).
- Harry's standing rule: merge your own PR once CI is green, after merging
  fresh `origin/main` into it and re-running the checks. Don't ask for review;
  post one summary per phase, ending with anything Harry must do on his
  server as a short numbered list.
- Nothing in the repository names the tool that wrote it: no
  `Co-Authored-By` or session trailers on commits, no assistant attribution in
  pull requests, and no links to private chats or artifacts in files. The
  Attribution workflow checks each pull request's commits and description.
- One PR at a time per thread, small enough to review in one sitting. Say
  "Part of PER-x" in the body when an issue spans several PRs, because Linear
  closes an issue when any linked PR merges.

## Servers
- Deployments run on Docker Compose (ADR 0010). How people reach one (the
  internet or an internal network) is that deployment's choice; Tailscale is
  only how Harry reaches his own workbench, so never design around it. Agents
  can't see Harry's servers: never assume a step there worked; ask, or give a
  command whose output he can paste.
- Upgrades go through Deployment (`/upgrades`); docs/upgrade.md has the
  manual path.

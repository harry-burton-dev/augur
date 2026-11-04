# AUGUR: notes for coding agents

AUGUR is an app platform built to be deployed many times: Harry's dev
workbench, a demo, and later his organisation's private cloud. A shell in the
browser loads separately built apps (native import map plus `import()`, not
Module Federation). Behind one gateway sit the platform services: identity,
registry, events, storage, models, updater. It is in BETA; there is no phone
layout yet.

## Where to look first
1. **Decisions:** `docs/decisions/` (ADRs). Check the ones that touch your
   work before changing it. If your change goes against an Accepted record,
   add a new Proposed record in the same PR, tell Harry, and don't merge the
   deviating part until he accepts it (ADR 0001).
2. **The task:** its Linear issue (team PER, initiative AUGUR).
3. **Product, principles, naming, how we work:** the AUGUR handbook, Google
   Drive folder "Augur", starting from its "Start here" document
   (https://drive.google.com/drive/folders/1CDGBoi620UrDG3DY2biDXIHrpA8dICDh).
   Its Decision register lists every ADR and PDR; add a row when you add one.
4. **Guides:** `docs/` has one guide per topic; update the matching guide in
   the same PR.

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
  not know exists. Full rules: docs/shell-principles.md.
- **Recommend what it should be,** not only what was asked, and say where you
  went beyond the ask.

## Names
- The platform is **AUGUR**. Never "IM platform", "Information Platform",
  "Wave" or "platform" in anything a person reads.
- Folio is shown to people as **Artifacts**. Its id, route, schema, bucket and
  `FOLIO_*` keys stay `folio`.
- Auspex is shown to people as **Explorer**, a platform app (ADR 0032). Its
  id, route, intents, packages, container and `AUSPEX_*` keys stay `auspex`.
- Apps that ship with AUGUR are **platform apps** (using and managing AUGUR:
  Home, Admin, Upgrade Centre, Explorer) or **pillar apps** (the foundation of
  its output: Artifacts, Mandate, Data Atlas). Code names stay out of what people read.
- Old ids kept on purpose so live servers keep working: Keycloak realm
  `platform` and clients `platform-*`, Postgres db/user `platform`, Compose
  project `platform`, `PLATFORM_*` env keys, and the image and feed path
  `ghcr.io/harry-burton-dev/im-platform` (it stays when the repository is
  renamed). Don't rename them without an
  upgrade note in docs/upgrade.md.

## Structure (ADR 0002)
- `platform/` owns the shell, SDK, UI kit, services. `apps/` holds apps, which
  are moving to their own repositories (ADR 0012). Nothing in `platform/`
  imports an app and apps never import each other: `pnpm check:boundaries`.
- Apps reach AUGUR only through `@augur/*` packages, the gateway, the
  manifest and domain events.
- Shared hot spots: `platform/packages/mfe-sdk`, `platform/packages/ui-kit`
  (including `src/components/icon.ts`), `platform/services/gateway`. Keep
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
- Icons come from Lucide through `icon.ts`. Never hand-write SVG.
- App layout and interaction rules agreed with Harry live in
  docs/app-patterns.md. A live design session writes each agreed rule there
  in the same PR.
- Design research lives in `design-lab/` (prompts, runs, concepts; see its
  README). Nothing there ships; an idea moves into the product only through
  a record or docs/app-patterns.md.

## Working on a change
- `pnpm install`, then `pnpm build`, `pnpm test`, `pnpm typecheck`, `pnpm lint`. Also run
  `pnpm check:boundaries`, `pnpm check:manifest`, `pnpm check:migrations`,
  `pnpm check:reasons`, `pnpm check:catalog` and `pnpm check:settings` (any setting a
  deployment or a service reads: infra/deploy/settings.schema.json) when you touch those areas.
- Shell or kit changes: run the contract tests in `platform/contract`.
- Every PR carries a changeset (`pnpm changeset`, or `pnpm changeset --empty`),
  see docs/versioning.md.

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
  pull requests, and no links to private chats or artifacts in files.
- One PR at a time per thread, small enough to review in one sitting. Say
  "Part of PER-x" in the body when an issue spans several PRs, because Linear
  closes an issue when any linked PR merges.

## Servers
- Deployments run on Docker Compose behind Tailscale (ADR 0010). Agents
  can't see Harry's servers: never assume a step there worked; ask, or give a
  command whose output he can paste.
- Upgrades go through the Upgrade Centre in Admin; docs/upgrade.md has the
  manual path.

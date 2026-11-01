# 0003. The shell loads apps through a native import map, not Module Federation

- **Status:** Accepted
- **Date:** 2026-10-27
- **Decided by:** Harry
- **Replaces:** the Module Federation plan in the October MVP architecture

## Context

The first architecture (17 Oct) planned Vite with Module Federation for micro frontends. What was built instead is simpler: the shell publishes an import map that shares Lit and the UI kit, and loads each app's frontend with a dynamic `import()` of the URL the registry gives it. The structure review (27 Oct) compared this with Module Federation and recommended keeping it.

## Options

1. **Module Federation.** Bundler-specific, couples every app's build to the shell's build tooling.
2. **Native import maps and `import()`.** A web standard; apps can be built with any tool as long as they treat the shared modules as external.

## Decision

Apps are ES modules loaded with `import()`. Shared runtime modules (Lit, `@augur/ui-kit`, and the `@platform/ui-kit` alias kept for old app builds) come from the shell's import map. Apps do not bundle their own copy of shared modules.

## Consequences

- The UI kit is served once by the shell at runtime, so there is no separate UI kit release per app.
- A breaking change to a shared module breaks every app at once: shared modules follow the SDK's frozen-contract rules.
- Older notes that say "Module Federation" are wrong.

## Links

- Codebase structure review (a private design note)
- platform/frontends/shell/vite.shared.config.ts

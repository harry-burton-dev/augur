#!/bin/bash
# Gets a cloud coding session ready to work on AUGUR (ADR 0001, AGENTS.md):
# installs dependencies when they changed, then points the session at the decisions.
set -euo pipefail

cd "${CLAUDE_PROJECT_DIR:-.}"

if [ "${CLAUDE_CODE_REMOTE:-}" = "true" ]; then
  # Install only when a file that decides what gets installed changed since the last good install.
  hashes=node_modules/.session-start.sha256
  if ! sha256sum --check --status "$hashes" 2>/dev/null; then
    rm -f "$hashes"
    corepack enable >/dev/null 2>&1 || npm install -g "$(node -p "require('./package.json').packageManager")" >/dev/null
    pnpm install --prefer-offline >&2
    { sha256sum .claude/hooks/session-start.sh package.json pnpm-lock.yaml pnpm-workspace.yaml
      find platform apps -name package.json -not -path '*/node_modules/*' -print0 | sort -z | xargs -0 sha256sum; } > "$hashes" || rm -f "$hashes"
  fi
fi

# Every session: show which decisions are on record, so work is checked against them.
if [ -f docs/decisions/README.md ]; then
  echo "AUGUR decisions on record (docs/decisions/). Check the ones your work touches; going against an Accepted one needs a new Proposed record (ADR 0001):"
  grep -E '^\| \[[0-9]{4}\]' docs/decisions/README.md | sed -E 's/^\| \[([0-9]{4})\]\([^)]*\) \| ([^|]+)\| ([^|]+)\|.*/  \1 \3: \2/' | sed -E 's/ +:/:/; s/ +$//'
fi

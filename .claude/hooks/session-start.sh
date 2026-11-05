#!/bin/bash
# Gets a cloud coding session ready to work on AUGUR (AGENTS.md):
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

# Every session: point at the decisions on record, so work is checked against them.
echo "AUGUR's decisions (ADRs and PDRs) are listed in the Decision register, in the AUGUR handbook on Google Drive (04 Decisions): https://drive.google.com/drive/folders/16wXmUMRNP2_vXAlf4kBMF9hCDNUXg7yO. Check the ones your work touches; going against an Accepted one needs a new Proposed record first."

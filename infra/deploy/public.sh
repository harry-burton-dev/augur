#!/bin/sh
# Opens AUGUR to the internet for a while, through Tailscale Funnel, and closes it again.
#   infra/deploy/public.sh on [2h]   open for this long (30m, 2h, 1d; 2h when not given, 24h at most)
#   infra/deploy/public.sh off       close now
#   infra/deploy/public.sh status    say whether it's open, and until when
# Only the front door (the web container: the shell, apps, /api and sign-in) is opened, at the
# address AUGUR already has; Keycloak's own console stays closed to the internet whatever
# KEYCLOAK_CONSOLE says. It closes by itself when the time is up, even over a restart.
# The tailnet's policy must allow Funnel for this machine first: docs/deploy.md, "Open AUGUR to
# the internet for a while".
set -eu

here=$(cd "$(dirname "$0")" && pwd)
until_file="$here/tailscale/public-until"
pc() { docker compose -f "$here/compose.yml" --env-file "$here/.env" "$@"; }
ts() { pc exec -T tailscale tailscale "$@"; }
when() { date -d "@$1" '+%a %d %b %H:%M %Z' 2>/dev/null || date -r "$1" '+%a %d %b %H:%M %Z'; }
now=$(date +%s)
until_now() { tr -cd 0-9 <"$until_file" 2>/dev/null || true; }
address() { sed -n 's/^PLATFORM_URL=//p' "$here/.env" | tr -d "\"'" | head -n 1; }

case "${1:-status}" in
  on)
    span=${2:-2h}
    n=${span%[mhd]}
    case "$n" in '' | *[!0-9]*) echo "How long? Give minutes, hours or days, such as 30m, 2h or 1d." >&2; exit 2 ;; esac
    case "$span" in *m) secs=$((n * 60)) ;; *d) secs=$((n * 86400)) ;; *) secs=$((n * 3600)) ;; esac
    if [ "$secs" -le 0 ] || [ "$secs" -gt 86400 ]; then echo "Open it for 24 hours at most; run this again before then to keep it open." >&2; exit 2; fi
    if ! pc ps --status running --services 2>/dev/null | grep -qx tailscale; then
      echo "The tailscale container isn't running. Start AUGUR first (pc up -d)." >&2; exit 1
    fi
    if ! ts status --self --json 2>/dev/null | grep -q '"funnel"'; then
      echo "Your tailnet's policy doesn't allow Funnel for this machine yet, so it can't be opened." >&2
      echo "Add the funnel attribute for it in the Tailscale admin console (docs/deploy.md, \"Open AUGUR to the internet for a while\"), then try again." >&2
      exit 1
    fi
    pc exec -T tailscale rm -f /var/lib/tailscale/augur-public-failed || true
    until=$((now + secs))
    echo "$until" >"$until_file.tmp" && mv "$until_file.tmp" "$until_file"
    echo "Opening AUGUR to the internet until $(when "$until"). Tailscale restarts to do it, so the address drops for a few seconds."
    ;;
  off)
    rm -f "$until_file"
    echo "Closing AUGUR to the internet. Tailscale restarts to do it, within 10 seconds; it stays on your tailnet."
    ;;
  status)
    u=$(until_now)
    if [ -n "$u" ] && [ "$u" -gt "$now" ]; then
      if pc exec -T tailscale test -f /var/lib/tailscale/augur-public-failed 2>/dev/null; then
        echo "Meant to be open until $(when "$u"), but Tailscale wouldn't start open, so it's private. See: pc logs tailscale"
        exit 1
      fi
      echo "Open to the internet until $(when "$u"), at $(address)"
      ts funnel status 2>/dev/null || true
    else
      echo "Private: only machines on your tailnet can reach AUGUR."
    fi
    exit 0
    ;;
  *)
    echo "Usage: $0 on [30m|2h|1d] | off | status" >&2; exit 2 ;;
esac

# Wait for Tailscale to pick it up and come back, then say how it stands.
sleep 15
i=0
while [ $i -lt 12 ] && ! ts status >/dev/null 2>&1; do sleep 5; i=$((i + 1)); done
exec sh "$0" status

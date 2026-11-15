#!/bin/sh
# Starts Tailscale for AUGUR: private to your tailnet (serve.json), or open to the internet through
# Tailscale Funnel (serve-public.json) while public-until, beside this file, holds a time still to come.
# infra/deploy/public.sh writes it (AUGUR's docs, Open AUGUR to the internet for a while). The time
# lives in that file, so it holds over restarts and reboots: once it passes, or the file goes, the
# container restarts itself private. Either way it's the same address, so sign-in needs no changes.
until_file=/config/public-until
# Written when Tailscale wouldn't start open (Funnel not allowed in the tailnet's policy, say), so it
# comes back private instead of failing over and over. Turning it on again clears it.
failed_file=/var/lib/tailscale/augur-public-failed

until_value() {
  v=$(head -n 1 "$until_file" 2>/dev/null | tr -cd 0-9)
  echo "${v:-0}"
}

wanted() {
  u=$(until_value)
  if [ "$u" -gt "$(date +%s)" ] && [ "$(cat "$failed_file" 2>/dev/null)" != "$u" ]; then echo public; else echo private; fi
}

mode=$(wanted)
if [ "$mode" = public ]; then
  export TS_SERVE_CONFIG=/config/serve-public.json
  echo "augur: open to the internet until $(date -u -d "@$(until_value)" '+%Y-%m-%d %H:%M UTC')"
else
  export TS_SERVE_CONFIG=/config/serve.json
  echo "augur: private to the tailnet"
fi

# A machine new to the tailnet joins with TS_AUTHKEY; one that has joined keeps its state, so needs no key.
# Behind your own proxy (COMPOSE_FILE=compose.yml:compose.proxy.yml) this container doesn't run at all.
if [ -z "${TS_AUTHKEY:-}" ] && [ ! -s /var/lib/tailscale/tailscaled.state ]; then
  echo "augur: TS_AUTHKEY isn't set in .env, so this machine can't join your tailnet. Make an auth key under Settings → Keys in the Tailscale admin console, or put AUGUR behind your own proxy (AUGUR's docs, Install AUGUR)." >&2
  exit 1
fi

started=$(date +%s)
/usr/local/bin/containerboot &
child=$!
trap 'kill -TERM "$child" 2>/dev/null; wait "$child"; exit 0' TERM INT

while kill -0 "$child" 2>/dev/null; do
  # In the background, so a stop isn't held up by the sleep.
  sleep 10 &
  wait $!
  if [ "$(wanted)" != "$mode" ]; then
    echo "augur: switching to $(wanted); restarting"
    kill -TERM "$child" 2>/dev/null
    wait "$child"
    exit 0
  fi
done

wait "$child"
code=$?
if [ "$mode" = public ] && [ $(($(date +%s) - started)) -lt 120 ]; then
  until_value >"$failed_file"
  echo "augur: Tailscale wouldn't start open to the internet (is Funnel allowed for this machine? see AUGUR's docs, Open AUGUR to the internet for a while); starting private"
fi
exit "$code"

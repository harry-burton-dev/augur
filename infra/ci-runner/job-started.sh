#!/usr/bin/env bash
# Runs before each job: gives it what a hosted runner's fresh machine would, by taking away
# what the last job left in this runner's own Docker daemon and in /tmp. Images stay, as a
# build cache, until they're a week unused.
set -uo pipefail

echo "Clearing what the last job left"
containers=$(docker ps -aq)
[ -n "$containers" ] && docker rm -f $containers > /dev/null
docker network prune -f > /dev/null
docker volume prune -af > /dev/null
docker image prune -af --filter "until=168h" > /dev/null
docker builder prune -f --filter "until=168h" > /dev/null

# Containers write as other users (Postgres's backups), so this runs through Docker too.
docker run --rm -v /tmp:/host-tmp busybox:1.37 \
  find /host-tmp -mindepth 1 -maxdepth 1 \
    ! -name 'dotnet-diagnostic-*' ! -name 'clr-debug-pipe-*' ! -name '.dotnet' \
    -exec rm -rf {} + || true
exit 0

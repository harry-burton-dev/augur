#!/bin/sh
# Starts Postgres archiving its changes (its write-ahead log, WAL) as it makes them, so the database can be
# restored to any moment since the oldest base backup, not only to last night's dump (ADR 0064).
# Each finished WAL file is gzipped into /wal-archive by archive-wal.sh; the backup container takes the
# nightly base backups, prunes the archive, copies both off the server and tests a restore each week.
# Connections: at most POSTGRES_MAX_CONNECTIONS, of which POSTGRES_RESERVED_CONNECTIONS only AUGUR's own logins may
# use (the storage job grants them pg_use_reserved_connections), so apps holding the rest can't lock AUGUR out.
# Runs as root, as the image's own entrypoint does: it hands the archive folder to postgres, then starts it.
set -eu
# Postgres won't start unless the reserve and its 3 for superusers leave some connections over: say so plainly.
max=${POSTGRES_MAX_CONNECTIONS:-200}
reserved=${POSTGRES_RESERVED_CONNECTIONS:-40}
if [ $((reserved + 3)) -ge "$max" ]; then
  echo "POSTGRES_RESERVED_CONNECTIONS ($reserved) plus 3 for superusers must be less than POSTGRES_MAX_CONNECTIONS ($max): change them in .env." >&2
  exit 1
fi
mkdir -p /wal-archive
chown postgres:postgres /wal-archive
chmod 700 /wal-archive
exec docker-entrypoint.sh postgres \
  -c archive_mode=on \
  -c "archive_command=/bin/sh /etc/augur/archive-wal.sh %p %f" \
  -c "archive_timeout=${PITR_ARCHIVE_SECONDS:-900}" \
  -c hba_file=/etc/augur/pg_hba.conf \
  -c "max_connections=$max" \
  -c "reserved_connections=$reserved"

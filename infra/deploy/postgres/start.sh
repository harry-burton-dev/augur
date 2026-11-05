#!/bin/sh
# Starts Postgres archiving its changes (its write-ahead log, WAL) as it makes them, so the database can be
# restored to any moment since the oldest base backup, not only to last night's dump (ADR 0064).
# Each finished WAL file is gzipped into /wal-archive by archive-wal.sh; the backup container takes the
# nightly base backups, prunes the archive, copies both off the server and tests a restore each week.
# Runs as root, as the image's own entrypoint does: it hands the archive folder to postgres, then starts it.
set -eu
mkdir -p /wal-archive
chown postgres:postgres /wal-archive
chmod 700 /wal-archive
exec docker-entrypoint.sh postgres \
  -c archive_mode=on \
  -c "archive_command=/bin/sh /etc/augur/archive-wal.sh %p %f" \
  -c "archive_timeout=${PITR_ARCHIVE_SECONDS:-900}" \
  -c hba_file=/etc/augur/pg_hba.conf

#!/bin/sh
# Postgres's archive_command (start.sh): archive-wal.sh PATH NAME gzips one finished WAL file into /wal-archive.
# Written beside its final name and flushed to disk before it takes that name, so Postgres only recycles a
# file once its copy is safe. Asked again for a file already there (after a crash), it succeeds only when
# the copy holds the same bytes; anything else fails, and Postgres keeps the file and tries again.
set -eu
target="/wal-archive/$2.gz"
if [ -e "$target" ]; then
  gunzip -c "$target" | cmp -s - "$1" && exit 0
  echo "archive-wal: $2 is already in the archive with different contents" >&2
  exit 1
fi
gzip -c < "$1" > "$target.partial"
sync "$target.partial"
mv "$target.partial" "$target"

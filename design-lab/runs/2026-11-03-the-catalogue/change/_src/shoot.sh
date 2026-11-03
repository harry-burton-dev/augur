#!/bin/bash
# usage: shoot.sh v1-slug [wait]  -> /tmp/cat-change-<v>-<w>.png at 1600x900 and 1280x800
cd "$(dirname "$0")/.."
V=$1; W=${2:-3500}
node ../../../_kit/shot.js "file://$PWD/$V.html" "/tmp/cat-change-$V-1600.png" 1600 900 $W
node ../../../_kit/shot.js "file://$PWD/$V.html" "/tmp/cat-change-$V-1280.png" 1280 800 $W

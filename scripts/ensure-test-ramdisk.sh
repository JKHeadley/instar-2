#!/bin/sh
# Idempotently create the 8 GB RAM volume that test temp files live on (macOS; no sudo).
# vitest's globalSetup (tests/setup/test-tmp.ts) uses it whenever it is mounted, writable and
# verified as a ram:// disk image. Prints the mount point. On Linux/WSL tests use /dev/shm
# (verified tmpfs) and need nothing.
set -eu
NAME=instar-test-ram
MOUNT="/Volumes/$NAME"
if [ "$(uname -s)" != "Darwin" ]; then
  echo "ensure-test-ramdisk: not macOS; tests use /dev/shm on Linux" >&2
  exit 0
fi
# True when $MOUNT is the mount point of an attached ram:// image (not merely a directory).
is_ram_mount() {
  hdiutil info | awk -v m="$MOUNT" '
    /^=+$/ { ram = 0 }
    /^image-path[ \t]*:[ \t]*ram:\/\// { ram = 1 }
    ram && /^\/dev\// { n = split($0, f, "\t"); if (f[n] == m) found = 1 }
    END { exit found ? 0 : 1 }'
}
if [ -d "$MOUNT" ]; then
  if is_ram_mount && [ -w "$MOUNT" ]; then
    echo "$MOUNT"
    exit 0
  fi
  echo "ensure-test-ramdisk: $MOUNT exists but is not a writable RAM disk; detach or rename it" >&2
  exit 1
fi
DEV=$(hdiutil attach -nomount ram://16777216 | awk '{print $1; exit}')
if ! diskutil erasevolume APFS "$NAME" "$DEV" >/dev/null; then
  hdiutil detach "$DEV" >/dev/null 2>&1 || true
  echo "ensure-test-ramdisk: could not format $DEV" >&2
  exit 1
fi
echo "$MOUNT"

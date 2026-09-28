#!/bin/sh
# Idempotently create the 8 GB RAM volume that test temp files live on (macOS; no sudo).
# vitest's globalSetup (tests/setup/test-tmp.ts) uses it whenever it is mounted and
# writable. Prints the mount point. On Linux/WSL tests use /dev/shm and need nothing.
set -eu
NAME=instar-test-ram
MOUNT="/Volumes/$NAME"
if [ "$(uname -s)" != "Darwin" ]; then
  echo "ensure-test-ramdisk: not macOS; tests use /dev/shm on Linux" >&2
  exit 0
fi
if [ -d "$MOUNT" ] && [ -w "$MOUNT" ]; then
  echo "$MOUNT"
  exit 0
fi
DEV=$(hdiutil attach -nomount ram://16777216 | awk '{print $1; exit}')
if ! diskutil erasevolume APFS "$NAME" "$DEV" >/dev/null; then
  hdiutil detach "$DEV" >/dev/null 2>&1 || true
  echo "ensure-test-ramdisk: could not format $DEV" >&2
  exit 1
fi
echo "$MOUNT"

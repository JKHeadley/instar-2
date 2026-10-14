#!/bin/bash
# Machine-local administrator provisioning. macOS recreates /private/tmp at boot;
# the harness's inherited deny must be reinstalled before readiness can pass.
# The job uses only a system executable and literal arguments, never agent code.
# Usage: bash scripts/install-harness-tmp-acl.sh print|install
# See docs/harness-tmp-isolation.md for verification and rollback.
set -euo pipefail
PATH=/usr/bin:/bin:/usr/sbin:/sbin
export PATH
unset IFS CDPATH ENV BASH_ENV

readonly LABEL=ai.instar.harness-tmp-acl
readonly PLIST=/Library/LaunchDaemons/$LABEL.plist
readonly ENTRY='user:_instarharness deny list,search,add_file,add_subdirectory,delete_child,read,write,append,execute,readextattr,writeextattr,readsecurity,writesecurity,chown,file_inherit,directory_inherit,only_inherit'

render() {
  cat <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>$LABEL</string>
  <key>ProgramArguments</key>
  <array>
    <string>/bin/chmod</string>
    <string>+a</string>
    <string>$ENTRY</string>
    <string>/private/tmp</string>
  </array>
  <key>RunAtLoad</key><true/>
</dict>
</plist>
EOF
}

case "${1:-}" in
  print) [ "$#" = 1 ] || exit 2; render; exit 0 ;;
  install) [ "$#" = 1 ] || exit 2 ;;
  *) echo 'Usage: install-harness-tmp-acl.sh print|install' >&2; exit 2 ;;
esac
[ "$(uname -s)" = Darwin ] || { echo 'REFUSED: macOS required' >&2; exit 2; }
[ "$(id -u)" = 0 ] || { echo 'REFUSED: administrator installation requires root' >&2; exit 2; }
id -u _instarharness >/dev/null
[ ! -L "$PLIST" ] || { echo 'REFUSED: launch daemon path is a symlink' >&2; exit 2; }

umask 077
temporary=$(mktemp /Library/LaunchDaemons/.instar-harness-tmp-acl.XXXXXX)
trap 'rm -f "$temporary"' EXIT
render > "$temporary"
plutil -lint "$temporary"
# An existing, different job is not ours to replace or unload.
if [ -e "$PLIST" ] && ! cmp -s "$temporary" "$PLIST"; then
  echo 'REFUSED: an existing launch daemon has different contents' >&2
  exit 2
fi
chown root:wheel "$temporary"
chmod 0644 "$temporary"
mv -f "$temporary" "$PLIST"
if launchctl print "system/$LABEL" >/dev/null 2>&1; then
  launchctl kickstart "system/$LABEL"
else
  launchctl bootstrap system "$PLIST"
fi
# Apply synchronously too: launchd submission alone is not evidence of access.
# chmod +a coalesces an identical entry; repeated installation cannot grow it.
chmod +a "$ENTRY" /private/tmp
echo "Installed $PLIST; verify a fresh canary through harnessReadiness."

#!/bin/bash
# Fixed M4-L worker provisioning (M5). Modes: inspect, accounts-only,
# accounts-rollback (the inert stage); stage (build a content-addressed monitor
# release, unprivileged, never installs); install, uninstall, verify;
# admin-command (print the operator's one root command, unprivileged) and
# admin-install (what that command runs from the verified custody copy).
#
# Every mutating mode is a DRY RUN unless --apply is given. --apply requires
# root, a live host (never a synthetic inventory), explicit reviewed inputs and
# the exact plan digest printed by the reviewed dry run. The plan embeds the exact
# bytes it writes, so the reviewed digest binds content, not just file names.
# The script never acquires privilege, downloads anything, or takes over an
# existing account or path.
set -euo pipefail
set -f
umask 077
PATH=/usr/bin:/bin:/usr/sbin:/sbin
export PATH
unset IFS CDPATH ENV BASH_ENV

readonly WORKER=_instar_worker
readonly WORKER_HOME=/private/var/instar-worker/home
readonly SLOT=/private/var/instar-worker/slot-0
readonly SLOT_PARENT=/private/var/instar-worker
readonly LIB_ROOT=/Library/Instar2
readonly LIB_PKG=/Library/Instar2/m4-launch
readonly RELEASES=/Library/Instar2/m4-launch/releases
readonly KEYS=/Library/Instar2/m4-launch/keys
readonly STATE=/private/var/db/instar2-worker
readonly RUNDIR=/private/var/run/instar2-worker
readonly PLIST=/Library/LaunchDaemons/ai.instar.worker-monitor.plist
readonly LEDGER=/Library/Instar2/.accounts-ledger
readonly CONF=/Library/Instar2/m4-launch/installation.conf
readonly SERVICE=/Library/Instar2/m4-launch/service.json
readonly KEY=/Library/Instar2/m4-launch/keys/receipt.key
# The public half is the agent-side owner's receipt trust reference (S8), so it sits
# beside service.json in the world-traversable package folder; the keys folder is
# root-only (0700) and the agent account cannot enter it.
readonly PUB=/Library/Instar2/m4-launch/receipt.pub
readonly JOURNAL=/private/var/db/instar2-worker/journal
readonly BREAKER=/private/var/db/instar2-worker/supervisor-restarts
readonly SELF_IN_RELEASE=scripts/provision-fixed-native-worker.sh
readonly LABEL=ai.instar.worker-monitor
readonly ID_LOW=450
readonly ID_HIGH=499
# Directories created by accounts-only, parents first. Mode and owner are fixed.
readonly DIRS="$SLOT_PARENT:0755 $WORKER_HOME:0755 $SLOT:0755 $LIB_ROOT:0755 $LIB_PKG:0755 $RELEASES:0755 $KEYS:0700 $STATE:0700"

die() { echo "REFUSED: $*" >&2; exit 2; }
note() { echo "$*"; }

MODE=${1:-}
[ -n "$MODE" ] || die "usage: $0 inspect|accounts-only|accounts-rollback|stage|install|verify|uninstall [options]"
shift
APPLY=0 INVENTORY= UID_ARG= GID_ARG= DIGEST_ARG= AGENT_USER=${SUDO_USER:-${USER:-}}
OUT= RUNTIME= RELEASE= INSTALLATION= MACHINE= CPU= MEMORY= NOFILE= LIFETIME= MAX_LIFETIME= REVIEWED=
while [ $# -gt 0 ]; do
  case "$1" in
    --apply) APPLY=1 ;;
    --inventory) [ $# -ge 2 ] || die "--inventory needs a file"; INVENTORY=$2; shift ;;
    --uid) [ $# -ge 2 ] || die "--uid needs a number"; UID_ARG=$2; shift ;;
    --gid) [ $# -ge 2 ] || die "--gid needs a number"; GID_ARG=$2; shift ;;
    --plan-digest) [ $# -ge 2 ] || die "--plan-digest needs a value"; DIGEST_ARG=$2; shift ;;
    --agent-user) [ $# -ge 2 ] || die "--agent-user needs a name"; AGENT_USER=$2; shift ;;
    --out) [ $# -ge 2 ] || die "--out needs a directory"; OUT=$2; shift ;;
    --runtime) [ $# -ge 2 ] || die "--runtime needs a file"; RUNTIME=$2; shift ;;
    --release) [ $# -ge 2 ] || die "--release needs a staged release directory"; RELEASE=$2; shift ;;
    --installation) [ $# -ge 2 ] || die "--installation needs an id"; INSTALLATION=$2; shift ;;
    --machine) [ $# -ge 2 ] || die "--machine needs an id"; MACHINE=$2; shift ;;
    --cpu-seconds) [ $# -ge 2 ] || die "--cpu-seconds needs a number"; CPU=$2; shift ;;
    --memory-mib) [ $# -ge 2 ] || die "--memory-mib needs a number"; MEMORY=$2; shift ;;
    --nofile) [ $# -ge 2 ] || die "--nofile needs a number"; NOFILE=$2; shift ;;
    --lifetime-ms) [ $# -ge 2 ] || die "--lifetime-ms needs a number"; LIFETIME=$2; shift ;;
    --max-lifetime-ms) [ $# -ge 2 ] || die "--max-lifetime-ms needs a number"; MAX_LIFETIME=$2; shift ;;
    --reviewed-release) [ $# -ge 2 ] || die "--reviewed-release needs sha256:<digest>"; REVIEWED=$2; shift ;;
    *) die "unknown option: $1" ;;
  esac
  shift
done
isnum() { case "$1" in ''|*[!0-9]*) return 1 ;; *) [ ${#1} -le 5 ] ;; esac; }
[ -z "$UID_ARG" ] || isnum "$UID_ARG" || die "--uid must be a number"
[ -z "$GID_ARG" ] || isnum "$GID_ARG" || die "--gid must be a number"
case "$AGENT_USER" in ''|*[!A-Za-z0-9_.-]*) die "agent user must be a plain account name" ;; esac

# ---- inventory: live host or a synthetic key=value file (dry run only) ----
OS_NAME= OS_VERSION= OS_BUILD= ARCH= USER_LIST= GROUP_LIST= AGENT_GROUPS= WORKER_PROCS=0 INSTALLED_RELEASE=
WORKER_ATTRS= PATHS= USER_NAMED=no GROUP_NAMED=no SERVICE_STATE=absent
if [ -n "$INVENTORY" ]; then
  [ "$APPLY" = 0 ] || die "--apply never accepts a synthetic inventory"
  [ -f "$INVENTORY" ] && [ ! -L "$INVENTORY" ] || die "inventory file unreadable"
  while IFS= read -r line || [ -n "$line" ]; do
    key=${line%%=*} value=${line#*=}
    case "$key" in
      os_name) OS_NAME=$value ;; os_version) OS_VERSION=$value ;; os_build) OS_BUILD=$value ;;
      arch) ARCH=$value ;; users) USER_LIST=$value ;; groups) GROUP_LIST=$value ;;
      agent_groups) AGENT_GROUPS=$value ;; worker_procs) WORKER_PROCS=$value ;;
      worker_attrs) WORKER_ATTRS=$value ;;
      installed_release) INSTALLED_RELEASE=$value ;;
      service_state) SERVICE_STATE=$value ;;
      path) PATHS="$PATHS$value
" ;;
      ''|'#'*) ;;
      *) die "unknown inventory key: $key" ;;
    esac
  done < "$INVENTORY"
  SOURCE="synthetic:$INVENTORY"
else
  OS_NAME=$(uname -s)
  [ "$OS_NAME" = Darwin ] || die "unsupported OS: $OS_NAME"
  OS_VERSION=$(sw_vers -productVersion) OS_BUILD=$(sw_vers -buildVersion) ARCH=$(uname -m)
  USER_LIST=$(dscl . -list /Users UniqueID | awk '{printf "%s:%s,", $1, $2}')
  GROUP_LIST=$(dscl . -list /Groups PrimaryGroupID | awk '{printf "%s:%s,", $1, $2}')
  # A record can exist before (or without) its numeric ID; name existence is
  # read separately so an ID-less record is never mistaken for absence.
  if dscl . -read "/Users/$WORKER" RecordName >/dev/null 2>&1; then USER_NAMED=yes; fi
  if dscl . -read "/Groups/$WORKER" RecordName >/dev/null 2>&1; then GROUP_NAMED=yes; fi
  AGENT_GROUPS=$(id -Gn "$AGENT_USER" 2>/dev/null | tr ' ' ',' || true)
  if dscl . -read "/Users/$WORKER" >/dev/null 2>&1; then
    WORKER_ATTRS=$(printf 'uid=%s;gid=%s;shell=%s;home=%s;hidden=%s;auth=%s;password=%s;groups=%s' \
      "$(dscl . -read "/Users/$WORKER" UniqueID 2>/dev/null | awk '{print $2}')" \
      "$(dscl . -read "/Users/$WORKER" PrimaryGroupID 2>/dev/null | awk '{print $2}')" \
      "$(dscl . -read "/Users/$WORKER" UserShell 2>/dev/null | awk '{print $2}')" \
      "$(dscl . -read "/Users/$WORKER" NFSHomeDirectory 2>/dev/null | awk '{print $2}')" \
      "$(dscl . -read "/Users/$WORKER" IsHidden 2>/dev/null | awk '{print $2}')" \
      "$(dscl . -read "/Users/$WORKER" AuthenticationAuthority 2>&1 | grep -q '^AuthenticationAuthority:' && echo present || echo none)" \
      "$(dscl . -read "/Users/$WORKER" Password 2>/dev/null | awk '{print $2}')" \
      "$(id -Gn "$WORKER" 2>/dev/null | tr ' ' '+')")
    WORKER_PROCS=$( { pgrep -U "$WORKER" 2>/dev/null || [ "$?" -eq 1 ]; } | wc -l | tr -d ' ')
  fi
  for spec in $DIRS "$RUNDIR:-" "$PLIST:-" "$LEDGER:-" "$CONF:-" "$SERVICE:-" "$KEY:-" "$PUB:-" "$JOURNAL:-" "$BREAKER:-"; do
    p=${spec%%:*}
    if [ -L "$p" ]; then PATHS="$PATHS$p|symlink|-|-|-
"
    elif [ -e "$p" ]; then PATHS="$PATHS$p|$(stat -f '%HT|%Su|%Sg|%Lp' "$p")
"
    fi
  done
  if [ -f "$CONF" ] && [ ! -L "$CONF" ]; then INSTALLED_RELEASE=$(awk -F= '$1=="release_dir"{print $2; exit}' "$CONF"); fi
  # The service's launchd state: 0 loaded, 113 "could not find service" (absent);
  # anything else is a failed query, never read as absence.
  rc=0; /bin/launchctl print "system/$LABEL" >/dev/null 2>&1 || rc=$?
  case "$rc" in 0) SERVICE_STATE=loaded ;; 113) SERVICE_STATE=absent ;; *) SERVICE_STATE="query-failed:$rc" ;; esac
  SOURCE=live
fi

lookup() { # lookup <list name:id,...> <name> -> id
  printf '%s' "$1" | tr ',' '\n' | awk -F: -v n="$2" '$1==n{print $2; exit}'
}
hasname() { printf '%s' "$1" | tr ',' '\n' | awk -F: -v n="$2" '$1==n{f=1} END{exit f?0:1}'; }
idused() { printf '%s' "$1" | tr ',' '\n' | awk -F: -v i="$2" '$2==i{f=1} END{exit f?0:1}'; }
pathrow() { printf '%s' "$PATHS" | awk -F'|' -v p="$1" '$1==p{print; exit}'; }
attr() { printf '%s' "$WORKER_ATTRS" | tr ';' '\n' | awk -F= -v k="$1" '$1==k{print $2; exit}'; }

WORKER_UID=$(lookup "$USER_LIST" "$WORKER")
WORKER_GID=$(lookup "$GROUP_LIST" "$WORKER")
# Name existence, independent of any numeric ID (a synthetic `name:` row or a
# live record without UniqueID/PrimaryGroupID is present-but-unnumbered).
! hasname "$USER_LIST" "$WORKER" || USER_NAMED=yes
! hasname "$GROUP_LIST" "$WORKER" || GROUP_NAMED=yes
[ -z "$WORKER_UID" ] || USER_NAMED=yes
[ -z "$WORKER_GID" ] || GROUP_NAMED=yes
AGENT_ADMIN=no
case ",$AGENT_GROUPS," in *,admin,*) AGENT_ADMIN=yes ;; esac

named() { if [ "$1" = no ]; then echo absent; elif [ -z "$2" ]; then echo "present-without-id"; else echo "$2"; fi; }

print_inventory() {
  note "inventory.source=$SOURCE"
  note "inventory.os=$OS_NAME $OS_VERSION ($OS_BUILD) $ARCH"
  note "inventory.worker.user=$(named "$USER_NAMED" "$WORKER_UID")"
  note "inventory.worker.group=$(named "$GROUP_NAMED" "$WORKER_GID")"
  note "inventory.worker.processes=$WORKER_PROCS"
  note "inventory.agent.user=$AGENT_USER"
  note "inventory.agent.groups=${AGENT_GROUPS:-unknown}"
  note "inventory.agent.admin=$AGENT_ADMIN"
  note "inventory.monitor.service=$SERVICE_STATE"
  if [ "$AGENT_ADMIN" = yes ]; then
    note "inventory.ADMIN=HOLD: agent principal is an administrator; the monitor prevention claim stays unavailable until administration is separated (not changed by this script)"
  fi
  printf '%s' "$PATHS" | while IFS= read -r row; do [ -z "$row" ] || note "inventory.path=$row"; done
}

# Pick the first unused ID in the fixed hidden range for both user and group.
propose_id() {
  i=$ID_HIGH
  while [ "$i" -ge "$ID_LOW" ]; do
    if ! idused "$USER_LIST" "$i" && ! idused "$GROUP_LIST" "$i"; then echo "$i"; return 0; fi
    i=$((i - 1))
  done
  return 1
}

plan_digest() { shasum -a 256 | awk '{print $1}'; }

# ---- accounts-only: create one inert hidden account and empty root folders ----
accounts_plan() {
  [ "$OS_NAME" = Darwin ] || die "unsupported OS: $OS_NAME"
  case "$ARCH" in arm64|x86_64) ;; *) die "unsupported architecture: $ARCH" ;; esac
  [ "$USER_NAMED" = no ] || die "account $WORKER already exists (uid ${WORKER_UID:-none}); never taken over"
  [ "$GROUP_NAMED" = no ] || die "group $WORKER already exists (gid ${WORKER_GID:-none}); never taken over"
  [ -z "$(pathrow "$LEDGER")" ] || die "an earlier accounts ledger exists; run accounts-rollback or verify"
  for spec in $DIRS; do
    p=${spec%%:*}
    [ -z "$(pathrow "$p")" ] || die "path already exists: $p"
  done
  [ -z "$(pathrow "$PLIST")" ] || die "a monitor LaunchDaemon already exists"
  if [ -n "$UID_ARG" ] || [ -n "$GID_ARG" ]; then
    [ -n "$UID_ARG" ] && [ -n "$GID_ARG" ] || die "--uid and --gid are given together"
    CHOSEN_UID=$UID_ARG CHOSEN_GID=$GID_ARG
  else
    [ "$APPLY" = 0 ] || die "--apply requires the reviewed --uid and --gid"
    CHOSEN_UID=$(propose_id) || die "no unused ID in $ID_LOW-$ID_HIGH"
    CHOSEN_GID=$CHOSEN_UID
  fi
  for n in "$CHOSEN_UID" "$CHOSEN_GID"; do
    [ "$n" -ge "$ID_LOW" ] && [ "$n" -le "$ID_HIGH" ] || die "id $n outside hidden range $ID_LOW-$ID_HIGH"
  done
  ! idused "$USER_LIST" "$CHOSEN_UID" || die "uid $CHOSEN_UID already in use"
  ! idused "$GROUP_LIST" "$CHOSEN_GID" || die "gid $CHOSEN_GID already in use"
  # The ledger is written first so a partial run is always rollback-visible.
  cat <<EOF
mkdir -m 0755 $LIB_ROOT
chown root:wheel $LIB_ROOT
ledger uid=$CHOSEN_UID gid=$CHOSEN_GID
dscl . -create /Groups/$WORKER
dscl . -create /Groups/$WORKER PrimaryGroupID $CHOSEN_GID
dscl . -create /Groups/$WORKER RealName Instar-worker
dscl . -create /Groups/$WORKER Password *
dscl . -create /Users/$WORKER
dscl . -create /Users/$WORKER UniqueID $CHOSEN_UID
dscl . -create /Users/$WORKER PrimaryGroupID $CHOSEN_GID
dscl . -create /Users/$WORKER RealName Instar-worker
dscl . -create /Users/$WORKER UserShell /usr/bin/false
dscl . -create /Users/$WORKER NFSHomeDirectory $WORKER_HOME
dscl . -create /Users/$WORKER Password *
dscl . -create /Users/$WORKER IsHidden 1
EOF
  for spec in $DIRS; do
    p=${spec%%:*} m=${spec#*:}
    [ "$p" = "$LIB_ROOT" ] && continue
    echo "mkdir -m $m $p"
    echo "chown root:wheel $p"
  done
}

# Run one reviewed plan line. Only the fixed verbs above are accepted.
run_line() {
  set -- $1
  case "$1" in
    mkdir) [ "$2" = -m ] && /bin/mkdir -m "$3" "$4" ;;
    chown) /usr/sbin/chown "$2" "$3" ;;
    dscl) shift; /usr/bin/dscl "$@" ;;
    ledger) printf 'uid=%s\ngid=%s\n' "${2#uid=}" "${3#gid=}" > "$LEDGER" && /bin/chmod 0600 "$LEDGER" ;;
    rmdir) /bin/rmdir "$2" ;;
    rm-ledger) /bin/rm -f "$LEDGER" ;;
    place-release) # $2 = release digest; the source is --release, which check_release already verified
      dest="$RELEASES/$2"
      if [ "$RELEASE" = "$dest" ]; then custody_ok "$dest" && (check_release "$dest")   # already in custody
      else
        [ ! -e "$dest" ] && /bin/mkdir -m 0700 "$dest" && /usr/bin/ditto --noextattr --noqtn "$RELEASE" "$dest" \
          && [ -z "$(/usr/bin/find "$dest" ! -type f ! -type d -print -quit)" ] \
          && /usr/sbin/chown -R root:wheel "$dest" && /bin/chmod -R u=rwX,go=rX "$dest" \
          && (check_release "$dest")   # the copied bytes, not the reviewed source path, must match the name
      fi ;;
    write-file)
      [ ! -e "$2" ] && printf '%s' "$4" | /usr/bin/xxd -r -p > "$2.new" && /usr/sbin/chown root:wheel "$2.new" \
        && /bin/chmod "$3" "$2.new" && /bin/mv -n "$2.new" "$2" && [ ! -e "$2.new" ] ;;
    # Keys and the journal are history: kept when present (a retry after a partial
    # install, or a reinstall), created once otherwise. Presence is read at run time
    # because an unprivileged dry run cannot see inside their root-only folders.
    keygen) if [ -e "$3" ] || [ -L "$3" ]; then [ -f "$3" ] && [ ! -L "$3" ] && [ -f "$4" ] && [ ! -L "$4" ]
            else "$2/runtime/node" "$2/scripts/fixed-native-worker-monitor.mjs" keygen "$3" "$4"; fi ;;
    journal-init) if [ -e "$3" ] || [ -L "$3" ]; then [ -f "$3" ] && [ ! -L "$3" ]
      else "$2/runtime/node" "$2/scripts/fixed-native-worker-monitor.mjs" journal-init "$3" "$4" "$5" "$6" \
        "$2/bin/instar-worker-enforcer"; fi ;;
    launchctl-bootstrap) /bin/launchctl bootstrap system "$2" ;;
    launchctl-bootout) /bin/launchctl bootout "system/$LABEL" ;;
    rm-file) [ -f "$2" ] && [ ! -L "$2" ] && /bin/rm -f "$2" ;;
    rm-release) case "$2" in "$RELEASES"/[0-9a-f]*) [ -d "$2" ] && [ ! -L "$2" ] && /bin/rm -R "$2" ;; *) false ;; esac ;;
    *) die "plan contains an unknown verb: $1" ;;
  esac
}

RECOVERY="run accounts-rollback to undo created items"
execute_plan() {
  plan=$1
  digest=$(printf '%s\n' "$plan" | plan_digest)
  note "plan.digest=sha256:$digest"
  note "plan.recovery=if a step fails: $RECOVERY"
  printf '%s\n' "$plan" | while IFS= read -r line; do note "plan.step=$line"; done
  if [ "$APPLY" = 0 ]; then note "result=dry-run (nothing changed)"; return 0; fi
  [ "$(id -u)" = 0 ] || die "--apply must be run by the operator's administrative path as root"
  [ "$DIGEST_ARG" = "sha256:$digest" ] || die "--plan-digest does not match the reviewed plan"
  printf '%s\n' "$plan" | while IFS= read -r line; do
    run_line "$line" || { echo "FAILED at: $line (nothing after it ran; $RECOVERY)" >&2; exit 3; }
  done
  note "result=applied"
}

# ---- rollback: remove only what the ledger says this package created ----
unresolved() {
  echo "REFUSED: $1 exists without its ledger-recorded $2; its disposition is unresolved, so nothing is removed and the ledger is retained." >&2
  echo "RECOVERY (administrator, bounded): inspect it with 'dscl . -read $1'. Only if it has no ID and no other use, delete it with 'dscl . -delete $1', then rerun accounts-rollback. Otherwise leave it and keep the ledger." >&2
  exit 4
}
rollback_plan() {
  [ -n "$(pathrow "$LEDGER")" ] || die "no accounts ledger; nothing this package created is recorded"
  [ -z "$(pathrow "$PLIST")" ] || die "the monitor is installed; uninstall it first"
  [ "$WORKER_PROCS" = 0 ] || die "processes are running as $WORKER; not removed"
  if [ "$SOURCE" = live ]; then
    L_UID=$(awk -F= '$1=="uid"{print $2}' "$LEDGER") L_GID=$(awk -F= '$1=="gid"{print $2}' "$LEDGER")
  else
    L_UID=${UID_ARG:-} L_GID=${GID_ARG:-}
    [ -n "$L_UID" ] || die "synthetic rollback needs --uid/--gid standing in for the ledger"
  fi
  # A record present without its ledger-recorded ID is a partial (or foreign)
  # entry: its disposition is unresolved, so nothing is planned and the ledger
  # is retained. Recovery is an explicit, bounded administrative step.
  if [ "$USER_NAMED" = yes ] && [ -z "$WORKER_UID" ]; then unresolved "/Users/$WORKER" "UniqueID $L_UID"; fi
  if [ "$GROUP_NAMED" = yes ] && [ -z "$WORKER_GID" ]; then unresolved "/Groups/$WORKER" "PrimaryGroupID $L_GID"; fi
  if [ "$USER_NAMED" = yes ]; then
    [ "$WORKER_UID" = "$L_UID" ] || die "account uid $WORKER_UID differs from ledger $L_UID; not removed"
    echo "dscl . -delete /Users/$WORKER"
  fi
  if [ "$GROUP_NAMED" = yes ]; then
    [ "$WORKER_GID" = "$L_GID" ] || die "group gid $WORKER_GID differs from ledger $L_GID; not removed"
    echo "dscl . -delete /Groups/$WORKER"
  fi
  # Children before parents; rmdir refuses anything non-empty.
  for p in $STATE $KEYS $RELEASES $LIB_PKG $SLOT $WORKER_HOME $SLOT_PARENT; do
    row=$(pathrow "$p")
    [ -z "$row" ] && continue
    case "$row" in "$p|Directory|root|wheel|"*) echo "rmdir $p" ;; *) die "path changed type/owner: $row" ;; esac
  done
  echo "rm-ledger"
  echo "rmdir $LIB_ROOT"
}

# ---- verify: read-only end-state check of the accounts stage ----
verify_accounts() {
  bad=0
  check() { if [ "$2" = "$3" ]; then note "verify.$1=ok"; else note "verify.$1=FAIL (have '$2', want '$3')"; bad=1; fi; }
  if [ "$USER_NAMED" = no ] && [ "$GROUP_NAMED" = no ]; then note "verify.accounts=not-provisioned"; return 1; fi
  if [ -z "$WORKER_UID" ] || [ -z "$WORKER_GID" ]; then
    note "verify.accounts=FAIL (partial record: user=$(named "$USER_NAMED" "$WORKER_UID") group=$(named "$GROUP_NAMED" "$WORKER_GID"); run accounts-rollback)"; return 1
  fi
  check uid-range "$([ "$WORKER_UID" -ge $ID_LOW ] && [ "$WORKER_UID" -le $ID_HIGH ] && echo in || echo out)" in
  check gid "$(attr gid)" "$WORKER_GID"
  check shell "$(attr shell)" /usr/bin/false
  check home "$(attr home)" "$WORKER_HOME"
  check hidden "$(attr hidden)" 1
  check password "$(attr password)" '*'
  check authentication "$(attr auth)" none
  groups=$(attr groups)
  check primary-group "${groups%%+*}" "$WORKER"
  privileged=none
  for g in admin wheel staff _developer com.apple.access_ssh com.apple.access_screensharing com.apple.access_remote_ae; do
    case "+$groups+" in *"+$g+"*) privileged=$g ;; esac
  done
  check privileged-groups "$privileged" none
  for spec in $DIRS; do
    p=${spec%%:*} m=${spec#*:}
    check "dir:$p" "$(pathrow "$p")" "$p|Directory|root|wheel|${m#0}"
  done
  if [ -z "$(pathrow "$PLIST")" ]; then
    note "verify.monitor-stage=pending (monitor not installed)"
  else
    verify_monitor || bad=1
  fi
  [ "$bad" = 0 ] && note "verify.accounts=ok" && return 0
  note "verify.accounts=FAIL"; return 1
}

# ---- stage: build one content-addressed monitor release (unprivileged) ----
# The release holds the enforcer (built with the recorded command), the pinned
# runtime, the monitor module and the compiled owner code it imports, this
# installer (so the release digest also binds the code that installs it), the
# profile and plist templates, and the accepted per-slot limits. Its name is the SHA-256
# of its MANIFEST, which lists the SHA-256 of every file.
limit_ok() { isnum "$2" && [ "$2" -ge "$3" ] && [ "$2" -le "$4" ] || die "$1 must be a number in $3-$4"; }
stage_release() {
  [ "$APPLY" = 0 ] || die "stage never installs anything; it has no --apply"
  [ -n "$OUT" ] && [ -d "$OUT" ] && [ ! -L "$OUT" ] || die "stage needs --out <existing directory>"
  limit_ok --cpu-seconds "${CPU:-}" 1 86400
  limit_ok --memory-mib "${MEMORY:-}" 16 1048576
  limit_ok --nofile "${NOFILE:-}" 8 4096
  case "${MAX_LIFETIME:-}" in ''|*[!0-9]*) die "--max-lifetime-ms must be a number" ;; esac
  case "${LIFETIME:-}" in ''|*[!0-9]*) die "--lifetime-ms must be a number" ;; esac
  [ "$MAX_LIFETIME" -ge 1000 ] && [ "$MAX_LIFETIME" -le 86400000 ] || die "--max-lifetime-ms must be in 1000-86400000"
  [ "$LIFETIME" -ge 1 ] && [ "$LIFETIME" -le "$MAX_LIFETIME" ] || die "--lifetime-ms must be in 1-max-lifetime-ms"
  repo=$(cd "$(dirname "$0")/.." && pwd -P)
  [ -f "$repo/dist/assembly/production-launch-boundary.js" ] || die "build the reviewed checkout first (dist missing)"
  [ -n "$RUNTIME" ] || RUNTIME=$(command -v node || true)
  [ -n "$RUNTIME" ] && [ -f "$RUNTIME" ] || die "--runtime must name the pinned runtime file"
  tmp="$OUT/.staging.$$"
  /bin/mkdir -m 0700 "$tmp" "$tmp/bin" "$tmp/runtime" "$tmp/scripts" "$tmp/templates"
  trap '/bin/rm -rf "$tmp" "$OUT/.manifest.$$"' EXIT
  /usr/bin/clang -std=c11 -O2 -Wall -Wextra -Werror -o "$tmp/bin/instar-worker-enforcer" \
    "$repo/scripts/fixed-native-worker-enforcer.c" || die "enforcer build failed"
  /bin/cp "$RUNTIME" "$tmp/runtime/node"
  /bin/chmod 0755 "$tmp/runtime/node" "$tmp/bin/instar-worker-enforcer"
  /bin/cp "$repo/scripts/fixed-native-worker-monitor.mjs" "$repo/$SELF_IN_RELEASE" "$tmp/scripts/"
  /bin/cp -R "$repo/dist" "$tmp/dist"
  /bin/cp "$repo/deploy/macos/fixed-worker/worker.sb" "$repo/deploy/macos/fixed-worker/ai.instar.worker-monitor.plist" "$tmp/templates/"
  printf 'cpu_seconds=%s\nmemory_mib=%s\nnofile=%s\nlifetime_ms=%s\nmax_lifetime_ms=%s\n' \
    "$CPU" "$MEMORY" "$NOFILE" "$LIFETIME" "$MAX_LIFETIME" > "$tmp/limits.conf"
  (cd "$tmp" && /usr/bin/find . -type f | LC_ALL=C /usr/bin/sort | while IFS= read -r f; do
    /usr/bin/shasum -a 256 "${f#./}"; done) > "$OUT/.manifest.$$"
  /bin/mv "$OUT/.manifest.$$" "$tmp/MANIFEST"
  digest=$(/usr/bin/shasum -a 256 < "$tmp/MANIFEST" | awk '{print $1}')
  if [ -e "$OUT/$digest" ]; then note "stage.result=already-staged (identical content)"
  else /bin/mv "$tmp" "$OUT/$digest"; note "stage.result=staged"; fi
  note "stage.release=$digest"
  note "stage.path=$OUT/$digest"
  note "stage.files=$(/usr/bin/wc -l < "$OUT/$digest/MANIFEST" | tr -d ' ')"
}

# ---- the installed files, derived only from reviewed inputs ----
hexof() { /usr/bin/xxd -p | tr -d '\n'; }
sha() { /usr/bin/shasum -a 256 | awk '{print "sha256:" $1}'; }
token() { case "$2" in ''|*[!A-Za-z0-9:._@+=-]*) die "$1 must be a plain identifier" ;; esac; [ ${#2} -le 200 ] || die "$1 too long"; }
manifest_sha() { awk -v f="$2" '$2==f{print "sha256:" $1; exit}' "$1/MANIFEST"; }
check_release() { # check_release <dir>: content matches its name and its manifest, nothing extra
  r=$1
  [ -d "$r" ] && [ ! -L "$r" ] && [ -f "$r/MANIFEST" ] || die "release is not a staged directory: $r"
  name=$(basename "$r")
  case "$name" in *[!0-9a-f]*|'') die "release name is not a content digest: $name" ;; esac
  [ "$(/usr/bin/shasum -a 256 < "$r/MANIFEST" | awk '{print $1}')" = "$name" ] || die "release MANIFEST does not match its name"
  (cd "$r" && /usr/bin/shasum -a 256 -s -c MANIFEST) || die "release content does not match its MANIFEST"
  listed=$(awk '{print $2}' "$r/MANIFEST" | LC_ALL=C sort)
  present=$(cd "$r" && /usr/bin/find . -type f ! -name MANIFEST ! -name worker.sb -o -type f -path ./templates/worker.sb | sed 's#^\./##' | LC_ALL=C sort)
  [ "$listed" = "$present" ] || die "release holds files its MANIFEST does not list"
}
limit_of() { awk -F= -v k="$2" '$1==k{print $2; exit}' "$1/limits.conf"; }
# Protected custody: a release directory under the root-owned releases folder,
# owned by root, not writable by group/other, with no link or special file inside
# (a link would let its target change after its hash was checked).
custody_ok() {
  case "$1" in "$RELEASES"/[0-9a-f]*) ;; *) return 1 ;; esac
  [ -d "$1" ] && [ ! -L "$1" ] && [ "$(stat -f '%Su:%Sg:%Lp' "$1")" = root:wheel:755 ] \
    && [ -z "$(/usr/bin/find "$1" ! -type f ! -type d -print -quit)" ] \
    && [ -z "$(/usr/bin/find "$1" ! -user root -print -quit)" ] \
    && [ -z "$(/usr/bin/find "$1" -perm -g+w -print -quit)" ] && [ -z "$(/usr/bin/find "$1" -perm -o+w -print -quit)" ]
}
materialize_profile() { sed -e "s#@RELEASE_DIR@#$2#g" -e "s#@SLOT_DIR@#$SLOT#g" "$1/templates/worker.sb"; }
materialize_plist() { sed -e "s#@RELEASE_DIR@#$2#g" "$1/templates/ai.instar.worker-monitor.plist"; }

install_plan() {
  [ -n "$WORKER_UID" ] && [ -n "$WORKER_GID" ] && [ -n "$(pathrow "$LEDGER")" ] || die "install: the accounts stage is not provisioned; run accounts-only and verify first"
  [ "$WORKER_UID" -ge $ID_LOW ] && [ "$WORKER_UID" -le $ID_HIGH ] || die "install: worker uid outside the hidden range"
  for p in $PLIST $CONF $SERVICE $BREAKER; do [ -z "$(pathrow "$p")" ] || die "install: already present: $p (uninstall first)"; done
  case "$SERVICE_STATE" in absent) ;; loaded) die "install: the service is already loaded (uninstall first)" ;;
    *) die "install: the service state could not be read ($SERVICE_STATE); nothing is planned" ;; esac
  [ -n "$RELEASE" ] || die "install needs --release <staged release directory>"
  token --installation "$INSTALLATION"; token --machine "$MACHINE"
  check_release "$RELEASE"
  digest=$(basename "$RELEASE") rel="$RELEASES/$digest"
  agent_uid=$(lookup "$USER_LIST" "$AGENT_USER")
  [ -n "$agent_uid" ] || die "install: agent account $AGENT_USER not found"
  cpu=$(limit_of "$RELEASE" cpu_seconds) mem=$(limit_of "$RELEASE" memory_mib) nofile=$(limit_of "$RELEASE" nofile)
  life=$(limit_of "$RELEASE" lifetime_ms) maxlife=$(limit_of "$RELEASE" max_lifetime_ms)
  for n in "$cpu" "$mem" "$nofile" "$life" "$maxlife"; do
    case "$n" in ''|*[!0-9]*) die "install: release limits unreadable" ;; esac
  done
  conf=$(printf 'agent_uid=%s\nworker_uid=%s\nworker_gid=%s\nrelease_dir=%s\ncpu_seconds=%s\nmemory_mib=%s\nnofile=%s\nmax_lifetime_ms=%s\n' \
    "$agent_uid" "$WORKER_UID" "$WORKER_GID" "$rel" "$cpu" "$mem" "$nofile" "$maxlife")
  profile=$(materialize_profile "$RELEASE" "$rel")
  service=$(printf '{"clockReference":"clock:wall:%s","digests":{"artifactDigest":"%s","handlePolicyDigest":"%s","limitsDigest":"%s","profileDigest":"%s","releaseDigest":"sha256:%s"},"installation":"%s","journal":"%s","journalGenesis":{"installation":"%s","journal":"journal:%s","machine":"%s"},"keyId":"key:%s","lifetimeMs":%s,"machine":"%s","privateKeyPath":"%s"}' \
    "$MACHINE" "$(manifest_sha "$RELEASE" bin/instar-worker-enforcer)" \
    "$(manifest_sha "$RELEASE" dist/assembly/production-native-context.js)" \
    "$(printf '%s\n' "$conf" | sha)" "$(printf '%s\n' "$profile" | sha)" "$digest" \
    "$INSTALLATION" "$JOURNAL" "$INSTALLATION" "$INSTALLATION" "$MACHINE" "$INSTALLATION" "$life" "$MACHINE" "$KEY")
  echo "place-release $digest"
  echo "write-file $rel/worker.sb 0644 $(printf '%s\n' "$profile" | hexof)"
  echo "write-file $CONF 0644 $(printf '%s\n' "$conf" | hexof)"
  echo "keygen $rel $KEY $PUB"
  echo "write-file $SERVICE 0644 $(printf '%s' "$service" | hexof)"
  echo "journal-init $rel $JOURNAL $INSTALLATION $MACHINE journal:$INSTALLATION"
  echo "write-file $PLIST 0644 $(materialize_plist "$RELEASE" "$rel" | hexof)"
  echo "launchctl-bootstrap $PLIST"
}

# Keys and the journal are history: uninstall never removes them. It also reverses
# a partial install: whatever of the plist, service.json, installation.conf, the
# restart record and the release is present is removed, and the service is booted
# out only when launchd reports it loaded. A release with no installation.conf (a
# custody copy, or an install that stopped before writing it) is named with
# --release. An unreadable service state plans nothing.
uninstall_plan() {
  rel=
  case "$INSTALLED_RELEASE" in '') ;; "$RELEASES"/[0-9a-f]*) rel=$INSTALLED_RELEASE ;;
    *) die "uninstall: installed release unreadable from $CONF" ;; esac
  if [ -n "$RELEASE" ]; then
    name=${RELEASE#"$RELEASES"/}
    case "$name" in "$RELEASE"|*[!0-9a-f]*|'') die "uninstall: --release must be $RELEASES/<release digest>" ;; esac
    [ -z "$rel" ] || [ "$rel" = "$RELEASE" ] || die "uninstall: --release differs from the release named in $CONF ($rel)"
    rel=$RELEASE
  fi
  if [ -n "$rel" ] && [ "$SOURCE" = live ] && [ ! -d "$rel" ]; then rel=; fi
  case "$SERVICE_STATE" in loaded|absent) ;;
    *) die "uninstall: the service state could not be read ($SERVICE_STATE); nothing is planned. Retry; if it persists, read it with: sudo /bin/launchctl print system/$LABEL" ;; esac
  plist=$(pathrow "$PLIST") service=$(pathrow "$SERVICE") conf=$(pathrow "$CONF") breaker=$(pathrow "$BREAKER")
  [ "$SERVICE_STATE" = loaded ] || [ -n "$plist$service$conf$breaker$rel" ] || die "uninstall: the monitor is not installed"
  [ "$SERVICE_STATE" = absent ] || echo "launchctl-bootout"
  [ -z "$plist" ] || echo "rm-file $PLIST"
  [ -z "$service" ] || echo "rm-file $SERVICE"
  [ -z "$conf" ] || echo "rm-file $CONF"
  [ -z "$breaker" ] || echo "rm-file $BREAKER"
  [ -z "$rel" ] || echo "rm-release $rel"
}

verify_monitor() {
  mbad=0
  mcheck() { if [ "$2" = "$3" ]; then note "verify.monitor.$1=ok"; else note "verify.monitor.$1=FAIL (have '$2', want '$3')"; mbad=1; fi; }
  mcheck plist "$(pathrow "$PLIST")" "$PLIST|Regular File|root|wheel|644"
  mcheck conf "$(pathrow "$CONF")" "$CONF|Regular File|root|wheel|644"
  mcheck service "$(pathrow "$SERVICE")" "$SERVICE|Regular File|root|wheel|644"
  mcheck key "$(pathrow "$KEY")" "$KEY|Regular File|root|wheel|600"
  mcheck receipt-pub "$(pathrow "$PUB")" "$PUB|Regular File|root|wheel|644"
  mcheck journal "$(pathrow "$JOURNAL")" "$JOURNAL|Regular File|root|wheel|600"
  if [ "$SOURCE" = live ]; then
    rel=$INSTALLED_RELEASE
    if (cd "$rel" 2>/dev/null && /usr/bin/shasum -a 256 -s -c MANIFEST); then note "verify.monitor.release=ok"
    else note "verify.monitor.release=FAIL (content differs from MANIFEST)"; mbad=1; fi
    mcheck profile "$(materialize_profile "$rel" "$rel" | sha)" "$(sha < "$rel/worker.sb")"
    mcheck service-state "$(/bin/launchctl print "system/$LABEL" 2>/dev/null | awk '$1=="state"{print $3; exit}')" running
    mcheck control-socket "$([ -S "$RUNDIR/control.sock" ] && stat -f '%Su' "$RUNDIR/control.sock")" root
    note "verify.monitor.native-feasibility=run by admin-install before activation (every case must PASS, memory at the installed bound); it cannot be run unprivileged"
  fi
  # The restart breaker: absent before the first start, a count while recovering, `terminal` once settled.
  breaker=$( [ "$SOURCE" = live ] && [ -r "$BREAKER" ] && [ ! -L "$BREAKER" ] && /usr/bin/head -c 16 "$BREAKER" | tr -d '\n' || true)
  case "$breaker" in
    terminal) note "verify.monitor.restart-breaker=FAIL (terminal: the supervisor failed 5 consecutive starts and stopped restarting; inspect, then uninstall and reinstall)"; mbad=1 ;;
    ''|[0-9]) note "verify.monitor.restart-breaker=ok (${breaker:-unread}/5 consecutive unstable starts)" ;;
    *) note "verify.monitor.restart-breaker=FAIL (unreadable record)"; mbad=1 ;;
  esac
  note "verify.monitor.production-launch=refusing until the installed owner reader inputs exist (lane A capacity, R6 allocation, R4/R6 store and watermark)"
  [ "$mbad" = 0 ] && note "verify.monitor=ok" && return 0
  note "verify.monitor=FAIL"; return 1
}

# ---- the operator's one administrative command ----
# admin-command (unprivileged) prints ONE root command built only from fixed system
# tools. It is the only code root runs before verification: it copies the staged
# release into protected custody under the root-owned releases folder, refuses any
# link or special file in the copy, and checks the copy's MANIFEST against the
# independently recorded reviewed release digest and every file against that
# MANIFEST. Only then does it run the installer from the verified copy (the release
# digest binds the installer, the enforcer, the runtime and every template), and
# nothing from the agent-writable checkout ever runs as root.
custody_command() { # custody_command <staged dir> <digest> <installer args...>
  src=$1 d=$2; shift 2
  r="$RELEASES/$d"
  printf "sudo /usr/bin/env -i /bin/bash -c 'set -euo pipefail; umask 022; D=%s; S=%s; R=%s; " "$d" "$src" "$r"
  printf 'if [ ! -e "$R" ]; then /bin/mkdir -m 0700 "$R"; /usr/bin/ditto --noextattr --noqtn "$S" "$R"; fi; '
  printf '[ -d "$R" ] && [ ! -L "$R" ] && [ -z "$(/usr/bin/find "$R" ! -type f ! -type d -print -quit)" ] || { echo "REFUSED: the custody copy $R holds a link or special file; nothing was run. Remove it: sudo /bin/rm -R $R" >&2; exit 2; }; '
  printf '/usr/sbin/chown -R root:wheel "$R"; /bin/chmod -R u=rwX,go=rX "$R"; '
  printf '[ "$(/usr/bin/shasum -a 256 < "$R/MANIFEST" | /usr/bin/cut -c1-64)" = "$D" ] && (cd "$R" && /usr/bin/shasum -a 256 -s -c MANIFEST) || { echo "REFUSED: the custody copy $R does not match the reviewed release sha256:$D; nothing was run. Remove it: sudo /bin/rm -R $R" >&2; exit 2; }; '
  printf 'exec /bin/bash "$R/%s" admin-install --release "$R"' "$SELF_IN_RELEASE"
  for a in "$@"; do printf ' %s' "$a"; done
  printf " --apply'\n"
}
plain() { case "$2" in ''|*[!A-Za-z0-9/._@+=:-]*) die "$1 must be plain characters for the one command" ;; esac; }
admin_command() {
  [ "$APPLY" = 0 ] || die "admin-command only prints; the operator runs the printed command"
  [ -n "$RELEASE" ] || die "admin-command needs --release <staged release directory>"
  check_release "$RELEASE"
  d=$(basename "$RELEASE")
  [ "$REVIEWED" = "sha256:$d" ] || die "admin-command: --reviewed-release must be the independently recorded reviewed digest, and it must name this staged release (sha256:$d)"
  case "$DIGEST_ARG" in sha256:[0-9a-f]*) [ ${#DIGEST_ARG} = 71 ] || die "--plan-digest must be sha256:<64 hex>" ;;
    *) die "admin-command needs the reviewed install --plan-digest" ;; esac
  token --installation "$INSTALLATION"; token --machine "$MACHINE"
  plain --release "$RELEASE"; plain --installation "$INSTALLATION"; plain --machine "$MACHINE"
  note "admin.release=sha256:$d"
  note "admin.custody=$RELEASES/$d"
  note "admin.command=$(custody_command "$RELEASE" "$d" --installation "$INSTALLATION" --machine "$MACHINE" \
    --agent-user "$AGENT_USER" --plan-digest "$DIGEST_ARG")"
  note "admin.recovery=if it stops, its last lines name what remains; remove it with: sudo /bin/bash $RELEASES/$d/$SELF_IN_RELEASE uninstall --release $RELEASES/$d --agent-user $AGENT_USER (dry run), then the same with --apply --plan-digest <printed digest>"
}

# admin-install: run as root from the verified custody copy only. Order: verify
# itself and its release in custody; check the reviewed install plan digest; run
# every native feasibility case as the installed worker account at the installed
# memory bound (any FAIL or UNVERIFIED stops before anything else is written);
# install; verify the live end state. Without --apply it previews the same order.
admin_install() {
  note "admin.installer=$0"
  [ -n "$RELEASE" ] || die "admin-install needs --release"
  check_release "$RELEASE"
  d=$(basename "$RELEASE")
  mem=$(limit_of "$RELEASE" memory_mib)
  case "$mem" in ''|*[!0-9]*) die "admin-install: release memory limit unreadable" ;; esac
  [ "${#mem}" -le 7 ] && [ "$mem" -ge 16 ] && [ "$mem" -le 1048576 ] || die "admin-install: release memory limit out of range"
  RECOVERY="nothing was activated; reverse what was written with: sudo /bin/bash $RELEASES/$d/$SELF_IN_RELEASE uninstall --release $RELEASES/$d --agent-user $AGENT_USER (dry run, then --apply --plan-digest <printed digest>); keys and journal are kept"
  plan=$(install_plan)
  pd=$(printf '%s\n' "$plan" | plan_digest)
  note "admin.release=sha256:$d"
  note "admin.recovery=$RECOVERY"
  note "admin.step=1 custody: the release and this installer verified in $RELEASES/$d"
  note "admin.step=2 plan: install plan.digest=sha256:$pd must equal the reviewed --plan-digest"
  note "admin.step=3 feasibility: every native case as uid $WORKER_UID gid $WORKER_GID at the installed ${mem}MiB bound; any non-PASS stops"
  note "admin.step=4 install: the reviewed plan"
  note "admin.step=5 verify: the live end state"
  if [ "$AGENT_ADMIN" = yes ]; then
    note "admin.custody-separation=HOLD: the agent account is an administrator, so this installation does not establish independent administration (P-01); the worker's ceilings hold against the worker, not against the agent"
  fi
  if [ "$APPLY" = 0 ]; then note "result=dry-run (nothing changed)"; return 0; fi
  [ "$(id -u)" = 0 ] || die "admin-install --apply runs only as root, from the operator's one command"
  [ "$SOURCE" = live ] || die "admin-install --apply needs the live host"
  self=$(cd "$(dirname "$0")/.." && pwd -P)
  [ "$self" = "$RELEASE" ] && [ "$RELEASE" = "$RELEASES/$d" ] && custody_ok "$RELEASE" \
    || die "admin-install must run from its own verified release in protected custody ($RELEASES/$d); nothing was run. $RECOVERY"
  [ "$DIGEST_ARG" = "sha256:$pd" ] || die "--plan-digest does not match this host's install plan (sha256:$pd); nothing was installed. $RECOVERY"
  fz=$(/usr/bin/mktemp -d /private/tmp/instar-feasibility.XXXXXX)
  /bin/chmod 0755 "$fz"
  materialize_profile "$RELEASE" "$RELEASE" > "$fz/worker.sb"
  /bin/chmod 0644 "$fz/worker.sb"
  /bin/mkdir -m 0700 "$fz/scratch"
  /usr/sbin/chown "$WORKER_UID:$WORKER_GID" "$fz/scratch"
  frc=0
  (cd "$fz" && "$RELEASE/bin/instar-worker-enforcer" feasibility all "$fz/worker.sb" "$fz/scratch" "$RELEASE/runtime/node" \
    "$WORKER_UID" "$WORKER_GID" "$mem") || frc=$?
  /bin/rm -R "$fz"
  [ "$frc" = 0 ] || die "admin-install: a native feasibility case did not PASS (above); nothing was installed. $RECOVERY"
  execute_plan "$plan"
  i=0
  until /bin/launchctl print "system/$LABEL" 2>/dev/null | awk '$1=="state"{f=($3=="running")} END{exit f?0:1}' \
        && [ -S "$RUNDIR/control.sock" ]; do
    i=$((i + 1)); [ "$i" -le 30 ] || break; /bin/sleep 1
  done
  /bin/bash "$0" verify --agent-user "$AGENT_USER" || die "admin-install: the installed monitor did not verify (above). The service may be stopping on its restart breaker. $RECOVERY"
  note "admin.result=installed and verified"
}

case "$MODE" in
  inspect) print_inventory ;;
  accounts-only) print_inventory; plan=$(accounts_plan); execute_plan "$plan" ;;
  accounts-rollback) print_inventory; plan=$(rollback_plan); execute_plan "$plan" ;;
  verify) print_inventory; verify_accounts ;;
  stage) stage_release ;;
  install) print_inventory; plan=$(install_plan)
    RECOVERY="nothing was activated; reverse what was written with uninstall (dry run, then --apply --plan-digest; add --release $RELEASES/<digest> when installation.conf was not written); keys and journal are kept"
    execute_plan "$plan" ;;
  uninstall) print_inventory; plan=$(uninstall_plan)
    RECOVERY="the steps before it completed; read the state with verify, then rerun uninstall (it plans only what remains)"
    execute_plan "$plan" ;;
  admin-command) admin_command ;;
  admin-install) print_inventory; admin_install ;;
  *) die "unknown mode: $MODE" ;;
esac

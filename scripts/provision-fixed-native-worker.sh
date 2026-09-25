#!/bin/bash
# Fixed M4-L worker provisioning (M5). Five modes: inspect, accounts-only,
# install, verify, uninstall; plus accounts-rollback for the inert stage.
#
# Every mutating mode is a DRY RUN unless --apply is given. --apply requires
# root, a live host (never a synthetic inventory), explicit reviewed IDs and the
# exact plan digest printed by the reviewed dry run. The script never acquires
# privilege, downloads anything, or takes over an existing account or path.
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
readonly ID_LOW=450
readonly ID_HIGH=499
# Directories created by accounts-only, parents first. Mode and owner are fixed.
readonly DIRS="$SLOT_PARENT:0755 $WORKER_HOME:0755 $SLOT:0755 $LIB_ROOT:0755 $LIB_PKG:0755 $RELEASES:0755 $KEYS:0700 $STATE:0700"

die() { echo "REFUSED: $*" >&2; exit 2; }
note() { echo "$*"; }

MODE=${1:-}
[ -n "$MODE" ] || die "usage: $0 inspect|accounts-only|accounts-rollback|install|verify|uninstall [options]"
shift
APPLY=0 INVENTORY= UID_ARG= GID_ARG= DIGEST_ARG= AGENT_USER=${SUDO_USER:-${USER:-}}
while [ $# -gt 0 ]; do
  case "$1" in
    --apply) APPLY=1 ;;
    --inventory) [ $# -ge 2 ] || die "--inventory needs a file"; INVENTORY=$2; shift ;;
    --uid) [ $# -ge 2 ] || die "--uid needs a number"; UID_ARG=$2; shift ;;
    --gid) [ $# -ge 2 ] || die "--gid needs a number"; GID_ARG=$2; shift ;;
    --plan-digest) [ $# -ge 2 ] || die "--plan-digest needs a value"; DIGEST_ARG=$2; shift ;;
    --agent-user) [ $# -ge 2 ] || die "--agent-user needs a name"; AGENT_USER=$2; shift ;;
    *) die "unknown option: $1" ;;
  esac
  shift
done
isnum() { case "$1" in ''|*[!0-9]*) return 1 ;; *) [ ${#1} -le 5 ] ;; esac; }
[ -z "$UID_ARG" ] || isnum "$UID_ARG" || die "--uid must be a number"
[ -z "$GID_ARG" ] || isnum "$GID_ARG" || die "--gid must be a number"
case "$AGENT_USER" in ''|*[!A-Za-z0-9_.-]*) die "agent user must be a plain account name" ;; esac

# ---- inventory: live host or a synthetic key=value file (dry run only) ----
OS_NAME= OS_VERSION= OS_BUILD= ARCH= USER_LIST= GROUP_LIST= AGENT_GROUPS= WORKER_PROCS=0
WORKER_ATTRS= PATHS= USER_NAMED=no GROUP_NAMED=no
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
    WORKER_PROCS=$( { pgrep -U "$WORKER" 2>/dev/null || true; } | wc -l | tr -d ' ')
  fi
  for spec in $DIRS "$RUNDIR:-" "$PLIST:-" "$LEDGER:-"; do
    p=${spec%%:*}
    if [ -L "$p" ]; then PATHS="$PATHS$p|symlink|-|-|-
"
    elif [ -e "$p" ]; then PATHS="$PATHS$p|$(stat -f '%HT|%Su|%Sg|%Lp' "$p")
"
    fi
  done
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
    *) die "plan contains an unknown verb: $1" ;;
  esac
}

execute_plan() {
  plan=$1
  digest=$(printf '%s\n' "$plan" | plan_digest)
  note "plan.digest=sha256:$digest"
  printf '%s\n' "$plan" | while IFS= read -r line; do note "plan.step=$line"; done
  if [ "$APPLY" = 0 ]; then note "result=dry-run (nothing changed)"; return 0; fi
  [ "$(id -u)" = 0 ] || die "--apply must be run by the operator's administrative path as root"
  [ "$DIGEST_ARG" = "sha256:$digest" ] || die "--plan-digest does not match the reviewed plan"
  printf '%s\n' "$plan" | while IFS= read -r line; do
    run_line "$line" || { echo "FAILED at: $line (run accounts-rollback to undo created items)" >&2; exit 3; }
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
  check monitor "$([ -z "$(pathrow "$PLIST")" ] && echo absent || echo present)" absent
  note "verify.monitor-stage=pending (package not reviewed; install refuses)"
  [ "$bad" = 0 ] && note "verify.accounts=ok" && return 0
  note "verify.accounts=FAIL"; return 1
}

case "$MODE" in
  inspect) print_inventory ;;
  accounts-only) print_inventory; plan=$(accounts_plan); execute_plan "$plan" ;;
  accounts-rollback) print_inventory; plan=$(rollback_plan); execute_plan "$plan" ;;
  verify) print_inventory; verify_accounts ;;
  install|uninstall)
    die "$MODE: the monitor release manifest is not reviewed; this stage stays refusing (accounts stage only)" ;;
  *) die "unknown mode: $MODE" ;;
esac

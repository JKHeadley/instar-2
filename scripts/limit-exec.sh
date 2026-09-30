shift
if [ "$5" = gate ]; then read -r go <&3 || exit 125; [ "$go" = go ] || exit 125; exec 3<&-; fi
lim() {
  s=$(ulimit -S "$1") || exit 125
  h=$(ulimit -H "$1") || exit 125
  if [ "$s" = unlimited ] || [ "$s" -gt "$2" ]; then ulimit -S "$1" "$2" || exit 125; fi
  if [ "$h" = unlimited ] || [ "$h" -gt "$2" ]; then ulimit -H "$1" "$2" || exit 125; fi
}
lim -n "$1"; lim -t "$2"; if [ -n "$3" ]; then lim -u "$3"; fi
u=; for v in $4; do u="$u -u $v"; done; shift 5
exec /usr/bin/env $u "$@"

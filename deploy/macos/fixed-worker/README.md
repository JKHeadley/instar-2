# Fixed M4-L worker package (macOS) — operator runbook

This package keeps one restricted worker account per Mac and, later, one fixed
safety monitor that only the operator's administrator path can change. Studio
and Laptop are provisioned and proven separately; Studio results never certify
the Laptop, and provisioning the Laptop gives it no execution or failover role.

Three results are reported separately per Mac, and none is claimed by this file:

| Result | Meaning | Status |
|---|---|---|
| account prepared | inert hidden account + empty root-owned folders exist and `verify` passes | available (this stage) |
| monitor installed | reviewed immutable release, keys and LaunchDaemon installed and verified | refusing: release not reviewed |
| confined launch verified | a genuine owner-admitted launch ran under the monitor and Nine accepted the evidence | refusing: owner bindings unavailable |

## Stage 1 — inert account (accounts-only)

Script: `scripts/provision-fixed-native-worker.sh`. Every mutating mode is a
dry run unless `--apply` is given. `--apply` refuses unless it runs as root
through the operator's administrative path, against the live host (never a
synthetic inventory), with the reviewed `--uid/--gid` and the exact
`--plan-digest` printed by the reviewed dry run. The builder and the agent
never run `--apply`.

What accounts-only creates (and nothing else): hidden account/group
`_instar_worker` in the 450–499 range, shell `/usr/bin/false`, password `*`,
no authentication authority, no admin/ssh/screen-sharing groups, no sudoers
entry, no keychain, no login; root:wheel empty folders
`/private/var/instar-worker{,/home,/slot-0}` (0755),
`/Library/Instar2{,/m4-launch,/m4-launch/releases}` (0755),
`/Library/Instar2/m4-launch/keys` and `/private/var/db/instar2-worker` (0700);
and a root-only ledger `/Library/Instar2/.accounts-ledger` recording the IDs it
created. No daemon, key, runtime or socket is installed at this stage.

Desk sequence, per Mac (run from the reviewed checkout; no network):

1. `scripts/provision-fixed-native-worker.sh inspect --agent-user <deployed agent account>`
   — read-only inventory: OS/build/arch, existing account/IDs, fixed paths, and
   whether the agent principal is an administrator. `inventory.ADMIN=HOLD` means
   the monitor prevention claim stays unavailable until administration is
   separated; this script never changes administrator membership.
2. `scripts/provision-fixed-native-worker.sh accounts-only` — dry run. Records the
   proposed ID and the `plan.digest`. Attach the full output to the operator
   cover sheet. Re-running on an unchanged host prints the same digest.
3. After the operator's yes, through the administrative path:
   `sudo scripts/provision-fixed-native-worker.sh accounts-only --apply --uid N --gid N --plan-digest sha256:…`
   using exactly the reviewed values. A changed host produces a different plan
   and the digest check refuses.
4. `scripts/provision-fixed-native-worker.sh verify` — read-only; must print
   `verify.accounts=ok` and `verify.monitor-stage=pending`.

Rollback (only items this package recorded as created):
`scripts/provision-fixed-native-worker.sh accounts-rollback` prints the plan
(dry run); apply it the same way with `--apply --plan-digest`. It refuses when
no ledger exists, when the account's UID/GID differ from the ledger, when any
process runs as `_instar_worker`, when the monitor is installed, or when a folder
changed type/owner; `rmdir` refuses non-empty folders. If `--apply` fails after
creating `/Library/Instar2` but before the ledger exists, remove that empty
folder by hand with the same administrative path (nothing else was created).

Refusals the script makes by design: an existing `_instar_worker` account or
group (never taken over), any pre-existing fixed path, an ID outside 450–499 or
already in use, a non-macOS host or unknown architecture, unknown inventory
keys, and a synthetic inventory combined with `--apply`.

## Stage 2 — monitor install (refusing)

`install`, `uninstall` refuse until the monitor release manifest (enforcer
binary, runtime closure, `worker.sb`, `ai.instar.worker-monitor.plist`,
installation config, receipt keys, accepted finite limits) is independently
reviewed and its digests are desk-pinned. Installation verification, OS probe
evidence and production activation are three separate reports; a refusing
installed service is not a verified working launch.

## Operator question (desk presents once, with concrete per-host plans)

> May we create a restricted Instar worker account on both your Studio and
> Laptop and install a safety monitor that only you can change?

**Yes / No.** A yes authorizes stage 1 now and the reviewed stage 2 package
later; it does not approve paid calls, Telegram messages, broader tools, a new
peer role or runtime activation.

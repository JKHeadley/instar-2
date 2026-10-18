# Fixed M4-L worker package (macOS) — operator runbook

This package keeps one restricted worker account per Mac and, later, one fixed
safety monitor that only the operator's administrator path can change. Studio
and Laptop are provisioned and proven separately; Studio results never certify
the Laptop, and provisioning the Laptop gives it no execution or failover role.

Three results are reported separately per Mac, and none is claimed by this file:

| Result | Meaning | Status |
|---|---|---|
| account prepared | inert hidden account + empty root-owned folders exist and `verify` passes | available (this stage) |
| monitor installed | reviewed content-addressed release, keys, journal and LaunchDaemon installed; `verify` passes | **held**: the package, its dry run, the one administrative command and verification exist; installation is the operator's (P-01), and the command runs every feasibility case, memory included, and stops on any non-PASS before installing |
| confined launch verified | a genuine owner-admitted launch ran under the monitor and Nine accepted the evidence | refusing: owner reader inputs unavailable (see "Owner integration") |

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
If `--apply` stopped after a `dscl . -create` but before the record's
UniqueID/PrimaryGroupID was set, `inspect` shows the name as
`present-without-id` and `accounts-rollback` refuses with exit 4, removing
nothing and keeping the ledger. It prints the bounded recovery: inspect the
record with `dscl . -read`, delete only an ID-less record with no other use,
then rerun `accounts-rollback`.

An account or group name that exists with or without a numeric ID counts as
present: accounts-only refuses it rather than planning to create over it.

Refusals the script makes by design: an existing `_instar_worker` account or
group (never taken over), any pre-existing fixed path, an ID outside 450–499 or
already in use, a non-macOS host or unknown architecture, unknown inventory
keys, and a synthetic inventory combined with `--apply`.

## Native package files and the feasibility gate

- `scripts/fixed-native-worker-enforcer.c` (M2). Build command, recorded:
  `/usr/bin/clang -std=c11 -O2 -Wall -Wextra -Werror -o instar-worker-enforcer scripts/fixed-native-worker-enforcer.c`.
  Roles: `client`, `channel <identity>`, `supervise`, `guard`, `bootstrap`, `journal-sync <path>`,
  `feasibility <case> <profile> <scratch> [runtime] [uid gid]` and `probe <payload>`.
- `deploy/macos/fixed-worker/worker.sb` (M3). A deny-by-default profile with two tokens,
  `@RELEASE_DIR@` and `@SLOT_DIR@`, materialized at installation. It carries three measured, named
  exceptions: read-data of `/`, the OpenSSL config file, and metadata on the release/slot parent folders.
- `deploy/macos/fixed-worker/ai.instar.worker-monitor.plist` (M4). One token, `@RELEASE_DIR@`. Only
  the supervisor is kept alive, and no global resource keys are set.

### How a worker is held

The supervisor (root, launchd) starts one **guard** per launch; the guard starts the worker as its
own child and is also its ptrace tracer. The worker's trusted bootstrap asks to be traced, leads a
new session (so it can neither join nor leave a process group), installs its limits, drops to the
worker account and waits on a gate the guard opens only after checking, from the kernel, that the
child is its own traced child under the worker identity. Then:

| Bound | Mechanism | Who enforces |
|---|---|---|
| wall lifetime | immutable continuous-clock deadline in the guard's arguments | guard kills its unreaped child |
| CPU time | `RLIMIT_CPU`; the kernel's `SIGXCPU` stops a traced process even when it ignores the signal | kernel signal, guard kill |
| memory | fatal Jetsam footprint limit (`memorystatus_control`), applied before release and again at every exec stop, read back or refused | kernel, at the crossing |
| processes | `RLIMIT_NPROC=1` for the worker account, plus the profile's `process-fork` denial | kernel |
| files, scratch, core | `RLIMIT_NOFILE`, `RLIMIT_FSIZE=0`, `RLIMIT_CORE=0`, profile denies every write | kernel, sandbox |
| supervisor liveness | 50 ms heartbeat; a lapse over 250 ms or a closed link ends the worker | guard |
| owner liveness | once the owner attaches its channel, the heartbeat flows only while its last successful authority check is within 250 ms, and the guard ends the worker 250 ms after its last beat. The stated bound from the last successful authority check to termination is therefore **600 ms** (two serial 250 ms timers plus beat slack), and the supervisor enforces it itself: past it, it kills its own guard. Before the owner attaches (the loading phase), beats flow regardless of owner progress and only the immutable lifetime bounds the launch; that is a finite, accounted phase, not owner-authority proof | supervisor stops the heartbeat, guard ends the worker; supervisor backstop |
| guard death | the kernel kills a traced process whose tracer exits | kernel |
| guard stopped or stalled | the supervisor's slot loop watches its own unreaped guard child: a stopped guard, a launch 250 ms past its deadline, or an owner past the 600 ms bound gets the guard killed, and the kernel then kills the traced worker | supervisor |
| supervisor restarts | launchd restarts the supervisor only after an unsuccessful exit (`KeepAlive` `SuccessfulExit=false`). Each start is counted in the root-only record `/private/var/db/instar2-worker/supervisor-restarts` before anything else runs; a run that stays up 60 s resets it. After 5 consecutive unstable starts the record becomes `terminal` and every later start exits 0, so launchd stops: the failure settles instead of restarting forever. An unusable record is also terminal | supervisor, launchd |
| channel bytes | 2 MiB relay budget per launch (both directions), on top of the adapter's own limits | supervisor |

No PID lookup kill exists anywhere: a parent's kill of its own unreaped child cannot reach another
process, and the PID stays the same process through every exec. A Mach task right is not used; it
does not survive exec (measured).

### Feasibility results

Run the cases on the staged binaries:
`<release>/bin/instar-worker-enforcer feasibility all <release>/worker.sb <empty scratch dir> <release>/runtime/node`.
A single FAIL keeps this worker mode unavailable. Do not broaden the mechanism to make it pass.

Builder-local result on Studio, macOS 26.5.2 (25F84) arm64, 2026-09-28 (unprivileged, shipped deny-default
profile, NOT installed-host evidence):

| case | result |
|---|---|
| cpu | PASS: `RLIMIT_CPU`=1 s, `SIGXCPU` ignored, 3 threads; stopped by the kernel signal and killed by the guard in about 0.35 s |
| task, task-runtime | PASS: the guard's deadline kill ends the original worker after bootstrap → sandbox-exec → enforcer / node |
| escape | PASS: `setsid`/`setpgid` from inside refuse (the worker leads its own session) |
| guard: supervisor-kill, supervisor-stop, guard-kill, deadline | PASS (worker ended after about 5, 144, 10 and 500 ms) |
| guard: guard-stop, guard-backstop | PASS (2026-10-01): a stopped guard is killed by its supervisor and the worker ends (about 40 ms); the backstop bounds hold on both sides |
| memory-consumes, memory-attribution | PASS (2026-10-01): the `-O2` probe's 64 MiB touch shows in the kernel's footprint (the earlier probe's allocation was removed by the optimizer: 1.4 MB resident for a "1024 MiB" touch); the verdict rejects an outside SIGKILL (kernel exit detail 0), the guard's deadline (30) and lapse (31) kills, a memory setup failure (34), a refusal and a finished run |
| nowrite, permitted-read, network, children, limit-raise | PASS |
| gate, gate-refused | PASS: no heartbeat ends the worker within the lapse; an identity mismatch refuses before release |
| memory | **UNVERIFIED (requires root)**. As the administrator the case passes only when a worker touching twice the installed bound is ended by SIGKILL whose kernel exit detail names a memorystatus kill (`NOTE_EXIT_MEMORY`), not by its guard, with a below-limit control (a quarter of the bound) finishing with its consumption verified, and the pinned runtime crossing the bound the same way (`memory-runtime`). Unprivileged, the Jetsam spawn attribute is silently ignored (a child with a 256 MiB fatal limit touched 1 GiB) and `memorystatus_control` returns EPERM; the unprivileged guard therefore refuses before release. `RLIMIT_AS` is not used: the kernel rejects values below about 412 GiB. Unprivileged per-task CPU monitors are also not used: they are reset by exec and refused (EPERM) for another process. |

The memory case can only be proven by the administrator's run, which names the worker account and
the installed bound: `feasibility all <profile> <scratch> <runtime> <worker uid> <worker gid> <memory_mib>`.
`admin-install` runs exactly that, from the verified custody copy, before it writes anything else.
Every case, memory included, must PASS there before the monitor may be relied on. The limit
readback makes a wrong command number or a silently ignored limit refuse, not run unbounded.

### Service wiring

- `supervise` reads `/Library/Instar2/m4-launch/installation.conf` (root-owned, not group/other
  writable, no symlink, exactly eight keys: `agent_uid`, `worker_uid`, `worker_gid`, `release_dir`,
  `cpu_seconds`, `memory_mib`, `nofile`, `max_lifetime_ms`). Absent: exit 78 "installed owner bindings
  unavailable"; anything else wrong: exit 78 "installed configuration invalid". Every per-slot bound comes
  from this file, never from a request or the owner service.
- It starts the owner decision service (`<release>/runtime/node <release>/scripts/fixed-native-worker-monitor.mjs service`)
  on a private link and waits for `READY`; the service refuses unless its bindings in
  `/Library/Instar2/m4-launch/service.json`, its signing key and its established journal are owned by
  its account and not writable by others. Any later service failure ends the supervisor (every guard
  ends its worker on the closed link; launchd restarts it within the restart breaker above).
- The control socket accepts only the configured agent account. A frame is relayed to the service; the
  service's native release leaf (`createNativeRelease`) asks the supervisor to `START` the worker with the
  launch identity, the fixed handle and delivery reference and the installed lifetime (clamped to
  `max_lifetime_ms`), and gets back the pid, uid, kernel unique id, start time and deadline ticks for the
  signed receipt. `OBSERVE` reports running or the guard's terminal reason.
- One accounted slot: a second start while a worker is live refuses (`slot-busy`).
- The owner's channel end is `createAttachedWorkerChannel(<enforcer>, <launch identity>)`: the `channel`
  role attaches once per launch (no reconnect), and its `progress` is the adapter's `progress` hook.

## Stage 2 — monitor release, install, verify

`provision-fixed-native-worker.sh` builds and describes the installation; the builder and the agent
never run `--apply`.

1. `stage --out <dir> --runtime <pinned node> --cpu-seconds N --memory-mib N --nofile N --lifetime-ms N --max-lifetime-ms N`
   (unprivileged, from a reviewed, built checkout). It builds the enforcer with the recorded command
   and copies the runtime, the monitor module, the compiled owner code, the profile and plist
   templates and the accepted limits into `<dir>/<release>`, where `<release>` is the SHA-256 of its
   `MANIFEST` (the SHA-256 of every file). Re-staging the same inputs gives the same name. The limits
   have no defaults: they are the approved installation allocation.
2. `install --release <dir>/<release> --installation <id> --machine <id> --agent-user <account>` — dry run.
   It refuses unless the accounts stage is provisioned, nothing of the monitor is installed or loaded,
   no restart record remains, and the staged release matches its name and manifest with no extra file.
   The plan embeds the exact bytes of the profile, installation.conf, service.json and plist, so
   `plan.digest` binds content: place the release in custody, write its profile, write
   installation.conf, create the receipt key, write service.json, create the established journal, write
   the plist, bootstrap the service. The key and the journal are kept if present (decided when the step
   runs), so the digest does not depend on root-only folders a dry run cannot see.
3. `admin-command --release <dir>/<release> --reviewed-release sha256:<release> --installation <id>
   --machine <id> --agent-user <account> --plan-digest sha256:…` prints **the operator's one command**.
   The reviewed release digest must come from the independent review record, not from the builder. The
   command is fixed system tools only until verification: it copies the staged release into
   `/Library/Instar2/m4-launch/releases/<release>` (root-owned, created 0700), refuses any link or special
   file in the copy, makes it root-owned, and checks the copy's `MANIFEST` against the reviewed digest and
   every file against the `MANIFEST`. Only then does it run the installer **from the verified copy** (the
   release digest binds the installer itself): `admin-install` checks it runs from that custody copy,
   checks the install plan digest, runs every feasibility case as the worker account at the installed
   memory bound and stops on any non-PASS, applies the plan, waits for the service and runs `verify`.
   Nothing from the agent-writable checkout ever runs as root. `admin-install` without `--apply` previews
   the same order unprivileged.
4. `verify` — read-only: file owners and modes (including the agent-readable receipt public key), the release against its manifest, the materialized
   profile, the service running, the root-owned control socket and the restart record.
5. `uninstall` (dry run, then `--apply --plan-digest`) reverses a full **or partial** installation: it
   removes whichever of the plist, service.json, installation.conf, the restart record and the release
   are present, and boots the service out only when launchd reports it loaded (a failed bootstrap
   leaves nothing to boot out). A release with no installation.conf (the custody copy, or an install that
   stopped before writing it) is named with `--release /Library/Instar2/m4-launch/releases/<release>`.
   When launchd cannot be queried it plans nothing rather than guess. The receipt key pair (both halves) and the journal
   are kept (history is never deleted); `accounts-rollback` still refuses until the monitor is
   uninstalled. A failed step names what to run next: for stage 2 that is `uninstall`, never
   `accounts-rollback`.

What only the operator's root run can prove (never the builder's): the memory crossing and its
control at the installed bound, both feasibility runs as the worker account, the custody copy owned
by root, the plan applied, the supervisor's restart breaker under launchd itself, and `verify` on the
live end state. **Independent administration is not established by any of this**: while the agent
account is an administrator (`ADMIN=HOLD`), the worker's ceilings hold against the worker, not
against the agent, and `admin-install` says so.

## Owner integration (source only, refusing in production)

- M1 `scripts/fixed-native-worker-monitor.mjs`:
  - `createMonitorService` decides launch/observe from the fixed installed reader (`createProductionMonitorContext`) and a native release leaf. With either one missing, it refuses before any dispatch decision exists.
  - A durable decision is written under an exclusive journal lock before any release. Exclusion is an O_EXCL lock file; a lock left by a crashed holder is not reclaimed, so it refuses. Durability comes from `OfflineJournal(path, limit, { sync: createNativeJournalSync(<enforcer>) })`, which runs M2's `journal-sync` after every append (`durability: 'native-fullfsync'`). Without it the journal reports `offline-fsync`, which is test evidence only. If the flush fails, the decision does not count and nothing is released; a later retry that finds those bytes answers `unknown`, never a release.
  - The journal is created once by the installation path, `initializeJournal(path, genesis)`, with a genesis record `{installation, machine, journal}` that the reviewed manifest pins; it refuses to overwrite an existing file. The service requires that established journal and its exact genesis on every locked read. A missing journal, a journal re-initialized with another genesis, a checksum/sequence break, or a shorter or rewritten prefix of what the running service already read is `journal-untrusted`: new launches refuse and a decided original stays `unknown`. The `released` record is appended under the same lock after a fresh re-read.
  - Not detected yet: after a restart, restoring an older genuine copy of the same journal. That needs an independent high-water mark from installed evidence; until it exists, root-only custody of the journal directory is the only protection, and this is recorded as an activation dependency, not claimed.
  - Duplicates get the retained original or `unknown`, never a second release.
  - The module also carries the `loading-worker` role, the owner-side channel IO, and the pinned-enforcer `client`.
- S8 `src/assembly/production-launch-boundary.ts` owns the wire codec and the constructor-bound locator resolver. It stays `monitor-unavailable` unless it is given installed inputs. Installed receipt trust is validated (closed shape, Ed25519 key, digests, current horizon) before any transport; after the exchange, current trust and clock are read again and a revocation, expiry or changed binding refuses the reply.
- The reader (`src/assembly/production-monitor-context.ts`) consumes lane A's public `CapacityInspection` head shape (`fact` is the id string). Lane A's `minimal-responder-binding` reserve is refused as worker permission; only the installation's named worker/control allocation instance (R6) qualifies. Launch and observation both require Six's current execution verdict for the operation's lease assignment and that lease's unexpired horizon on the installed owner clock, and an installed owner watermark so a view rolled back across a reader restart refuses.
- The mediated channel (`createInstalledChannelNativeContextIO`) bounds every wait, including waiting for a worker frame and a worker that stops draining replies, by the immutable deadline and the 250 ms last-good-authority lapse. `progress` fires only after a successful authority check, so a hung owner check stops the heartbeat that the native guard enforces.
- Installed inputs still missing, so production has no admitted launch:
  - lane A capacity authority (impl-r1-m3i), and R6's genuine worker/control allocation (`workerCapacityInstance`);
  - the R4/R6 installed store/context/authority composition for the reader, and its installed owner watermark;
  - the administrator's feasibility run proving the memory case on the installed host (unprovable unprivileged);
  - the owner's trust reference for receipts (the installed `/Library/Instar2/m4-launch/receipt.pub`, key id `key:<installation>`) wired into S8's `trust()`. The public key is installed beside `service.json`, not in the root-only `keys` folder (0700), because the agent-side owner reads it as the agent account;
  - the production composition call site (M4-L-S7/S9 grants) that builds the channel adapter over
    `createAttachedWorkerChannel` and binds the worker's delivery reference (today `native-context:<launch operation>`)
    to the exact admitted context delivery.
  The native release, the `supervise` service wiring, the receipt key and the journal genesis are
  produced by stage 2 above.
- The 250 ms lapse and 1,000 ms client figures are engineering candidates, not a measured accepted host policy.

## Operator question (desk presents once, with concrete per-host plans)

> May we create a restricted Instar worker account on both your Studio and
> Laptop and install a safety monitor that only you can change?

**Yes / No.** A yes authorizes stage 1 now and the reviewed stage 2 package
later; it does not approve paid calls, Telegram messages, broader tools, a new
peer role or runtime activation.

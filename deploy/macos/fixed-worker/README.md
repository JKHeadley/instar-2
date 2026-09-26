# Fixed M4-L worker package (macOS) — operator runbook

This package keeps one restricted worker account per Mac and, later, one fixed
safety monitor that only the operator's administrator path can change. Studio
and Laptop are provisioned and proven separately; Studio results never certify
the Laptop, and provisioning the Laptop gives it no execution or failover role.

Three results are reported separately per Mac, and none is claimed by this file:

| Result | Meaning | Status |
|---|---|---|
| account prepared | inert hidden account + empty root-owned folders exist and `verify` passes | available (this stage) |
| monitor installed | reviewed immutable release, keys and LaunchDaemon installed and verified | **held**: physical admission is held (native feasibility FAIL, installed service not wired; see "Disposition" below) |
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
  Its roles are `client`, `bootstrap`, `guard`, `supervise`, `journal-sync <path>`, `feasibility <case>` and `probe <payload>`.
  `supervise` refuses (exit 78) until the reviewed release and the installed owner bindings exist.
  `client` checks the kernel-attested peer of the control socket (`getpeereid` plus `LOCAL_PEERPID`)
  before sending any byte; a peer that is not the supervisor account (uid 0 in the release build) is refused.
  `journal-sync` is the durable journal primitive: `F_FULLFSYNC` of one regular, owner-only,
  non-symlinked journal file and then its directory. Any other shape, or a failed flush, exits 2.
- `deploy/macos/fixed-worker/worker.sb` (M3). A deny-by-default profile with two tokens,
  `@RELEASE_DIR@` and `@SLOT_DIR@`, materialized at staging. It carries three measured, named
  exceptions: read-data of `/`, the OpenSSL config file, and metadata on the release/slot parent folders.
- `deploy/macos/fixed-worker/ai.instar.worker-monitor.plist` (M4). One token, `@RELEASE_DIR@`. Only
  the supervisor is kept alive, and no global resource keys are set.

Run the feasibility cases on the staged binaries (unprivileged, isolated temp targets):
`<release>/bin/instar-worker-enforcer feasibility all <release>/worker.sb <empty scratch dir> <release>/runtime/node`.
A single FAIL keeps this worker mode unavailable. Do not broaden the mechanism to make it pass.

Builder-local result on Studio, macOS 26.5.2 (25F84) arm64, 2026-09-24 (unprivileged, NOT installed-host evidence):

| case | result |
|---|---|
| nowrite, permitted-read, network, children, gate, limit-raise | PASS |
| memory | FAIL: the kernel rejects RLIMIT_AS below about 412 GiB, so the 8 GiB address-space ceiling cannot be installed. The bootstrap then refuses before release. |
| cpu | FAIL: RLIMIT_CPU=1s with SIGXCPU ignored is not terminated by the kernel (8 s wall, 3 threads). |
| task, task-runtime | FAIL: a task right taken before exec loses its binding after any exec, even a direct exec with no sandbox. |
| guard (4 faults) | FAIL: the arm/ack/lapse logic runs, but termination depends on the lost task right. No PID-lookup kill is used. |

### Disposition: hold physical admission

On this macOS build the monitor is NOT installable, and nothing in this package is a
functioning worker monitor that merely awaits owner data. What exists is separated as follows:

- **Completed components (source + tests):** the inert-account script; the enforcer's
  `client`, `bootstrap`, `guard`, `journal-sync` and feasibility roles as files; the deny-default
  profile and plist as files; the M1 decision service and journal; the fixed read-only reader;
  the mediated channel adapter; S8's locator resolver, client and receipt verification.
- **Failed native feasibility (table above):** a finite memory ceiling, CPU termination and
  identity-safe termination of the original worker through the shipped exec chain all FAIL, so
  the guard fault cases FAIL. The passing T2 case that accepts `task=(PASS|FAIL)` proves that the
  verdict is reported, not that termination works. Root-only alternatives and sleep/wake are
  untested (no builder privilege).
- **Missing service wiring:** `supervise` is a refusing stub (exit 78). It reads no installation
  configuration, accepts no client connection, runs no owner service and connects no worker
  channel. `createMonitorService` and `createInstalledChannelNativeContextIO` have no production
  call site; the channel's `progress` hook is not yet forwarded to the guard heartbeat.
- **Held activation:** installation, the immutable manifest, verification/rollback procedure,
  and every owner input listed below.

Before monitor installation, a reviewed native mechanism must actually enforce a measured
finite memory/CPU policy and original-process termination through the shipped exec chain and
the single-role faults, and the supervisor/service/channel wiring plus its staged manifest must
exist. This package does not raise the memory ceiling to the observed ~412 GiB, add watchers,
re-sign Node or change the termination design. Real owner absence still refuses production launch.

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
  - the native release, which fails its feasibility gate above, and the `supervise` service wiring;
  - the receipt keys and trust reference, and the journal genesis pinned by the manifest.
- The 250 ms lapse and 1,000 ms client figures are engineering candidates, not a measured accepted host policy.

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

# Updating an installation

`instar2 update [root] [--release <tag>]` installs a release beside the existing one.
The root defaults to `~/.instar2`; the tag defaults to `v` plus the invoking package's
version. Production releases must have an existing git tag. There is no tag creation
or npm publication in this command.

Use a stopped installation or a scratch copy for this first update step. This command
installs and migrates; it does not stop, restart, or supervise an agent. Self-update,
health checks and automatic rollback belong to step D of the update-path plan.

## ELI16

Think of the agent's folder as its home. The updater puts the new program in a separate
room, saves a copy of the home's data, and does any required conversions. Only after
those conversions finish does it move the sign saying which program to use. It leaves
the person's model choice alone. If a conversion is interrupted, the next run knows
where it stopped and can finish it without starting over blindly.

## Files and recovery

- `version.json`: version, state schema, applied migration ids, and `adopted` or
  `installed`. An unstamped root is adopted at the invoking package's version.
- `releases/<tag>/node_modules/@instar/constitutional-types`: the installed package.
  Installation uses npm's GitHub git source with lifecycle scripts disabled. A staging
  folder becomes the release folder only after npm succeeds and the files are flushed.
- `backups/<id>`: a flushed snapshot of root data before migrations. Release trees,
  other backups, the current pointer and updater coordination files are excluded.
  The transaction records the prior pointer. Backup copies preserve symlinks without
  following them; the backup's parent is private to the installing user.
- `update-state.json`: current transaction, backup, prior stamp/pointer, ordered
  migration starts/completions and activation intent. Earlier completed transactions
  stay in `update-history/`. A started migration is retried; a completed one is skipped.
- `current`: atomically replaced relative symlink to the installed package. The stamp
  is written after the pointer. If interrupted between them, rerunning the same tag
  completes the recorded activation. Two file changes are not one atomic transaction.
- `.update-lock`: unique local process ownership. Concurrent writers refuse. A dead
  local owner's unique marker can be reclaimed; an ambiguous or foreign owner refuses
  and is preserved for inspection. No age timeout grants ownership.

Retry the same release after a failure. A failed migration keeps the old stamp and
current pointer; it can have partially applied its own data conversion, which is why
migration functions must be idempotent. An unfinished transaction refuses a different
release. Corrupt JSON is preserved and refused, never silently treated as a fresh root.
A release that cannot read the root's schema is refused before migrations or activation.
A readable older release is allowed, without lowering the recorded schema.

The state and lock are deliberately machine-local: this command updates one installation
and makes no peer, conversation ownership, network-send, or restart decision. It makes
no model calls and never changes model settings, grants, stop state or spend limits.

## Adding a migration

The installed release owns `scripts/update-release.mjs`. Declare the schema it writes,
the schemas it can read, and an array of `{ id, run(root) }` in registration order.
Ids must be unique; they do not determine execution order. The list includes MCP defaults.
Keep ids stable forever and make every effect durable
and replay-safe inside `run`: intent is flushed before calling it, and completion after
it resolves. A migration must preserve the five floors and name all affected consumers
(Rules 44 and 45). Do not lower a schema to make older code appear compatible.

The step shape adapts Instar 1.x's `MigratorStepEngine.registerStep` and
`runPendingSteps`: named idempotent workers, registration order, persisted completion
and atomic ledger replacement. The release manifest selects the steps, so no separate
semver scheduler is needed. Stable ids skip completed steps across releases; the
transaction records their release and prior version for provenance. This path keeps
its existing on-disk format so previously started updates can still resume.

Unlike the 1.x engine, it must record intent before an effect, retry an interrupted
step, and stop on failure before activating a release. It must also preserve and
refuse corrupt records instead of resetting their history. The existing transaction,
schema-readability check and single-updater lock hold those requirements; importing
the 1.x engine unchanged would not. No second ledger or migration service is needed.

`tests/preview/update.test.ts` exercises npm installs from local fixtures, the actual
CLI, failure before activation, incompatible and compatible older releases, a real
process exit during a migration, and concurrent update refusal. CLI fixture tests
replace only the npm source argument with a local path; they use real npm and no network.
They then invoke the installed command, including the shipped TypeScript loader
and constitutional binder. The updater binds its declared exact-match checkpoint
before its first installation write; missing, retired or weakened declarations refuse.

## Checking completed migrations

A migration may also declare `verify(root): boolean`. It must be a read-only check
of the actual installed state, safe to call before the migration has ever run.
The updater checks it even when the migration id and release were recorded complete.
If it returns false, the existing backup and transaction machinery records a repair
before rerunning that migration once. The check must then return true. Exceptions,
non-boolean answers and failed postconditions stop activation; they never become a
successful update. All postconditions are checked again after the final migration.
Migrations without a verifier retain their original once-per-id behavior.

The MCP default migration uses this path for an existing installation, including a
repeat of the current release. A missing file, the known old browser command with a
known shipped read list, and the shipped snapshot-only read list are repaired using the same installer as setup. Custom
browser commands, unrelated accounts, revoked/absent browsers, explicitly recorded
operator choices and unknown narrowed read lists are retained. Malformed configuration is
preserved and refused. The runtime's `readRootMcp` reads the file again rather than
keeping a boot snapshot; repaired connector settings reach its next read. This does
not reload protected installation bindings or authorize additional effects.

Candidate package identity, the version for a numeric `vX.Y.Z` tag, and CLI syntax
are checked before a staged package becomes a release directory. An unsuccessful
candidate remains in its staging directory for inspection, and a later explicit
retry can install a corrected candidate. Completed releases undergo the same checks
before an unchanged result. Syntax verification is not a runtime health probe.

## Carryover 87 scope and evidence

The source reference is Instar 1.x commit
`31c01422dce072390558145e991c4b68bc3791b1`:

- `src/core/UpdateChecker.ts`: exact target-version verification and candidate
  validation before promotion; tested in `tests/unit/UpdateChecker.test.ts`.
- `src/core/PostUpdateMigrator.ts`, `migrateReplyScriptToPortConfig`: inspect actual
  deployed content on refresh, upgrade known defaults, preserve unknown edits.
- `src/monitoring/templates-drift-verifier.ts`: distinguish current, known-prior and
  unknown content. Its host-wide SHA inventory and persistent finding deduplication
  are not implemented by the MCP-specific verification above.
- `src/config/LiveConfig.ts` and `AutoUpdater.reloadDynamicConfig`: changes on disk
  must reach the running consumer. MCP already uses uncached reads; that does not
  establish parity for other runtime settings. `LiveConfig.deepEqual` is copied
  into the MCP installer with TypeScript annotations removed, so JSON key order
  does not disguise a known default as a custom configuration.

The CLI is enumerated in `package.json`'s launcher inventory. Its update capability,
candidate check and local transaction store are declared beside `scripts/update.mjs`;
the update test is bound as `PREVIEW-UPDATE-POSTCONDITIONS`. Inventorying this actual
entry point also exposes the existing onboarding and trust writers, whose local
store declarations accompany it. These declarations do not grant runtime authority.

`tests/preview/update.test.ts` proves wrong-version rejection, missing/broken CLI
rejection, postcondition failure, repeated-release repair, durable repair intent,
preserved backup/history and the positive unchanged case. The installed-command test
in `tests/preview/mcp-setup.test.ts` exercises the real release migration on an
existing root, reads its result through the runtime reader, and proves custom and
malformed input preservation. No live deployment claim follows from these tests.

## Row 87 continuation: runner, watchdog and live settings

The continuation uses current 1.x source commit
`1cb59f787b02c9a19486f1b500007305ee30608a`. The earlier installer fixes above remain.
The executable policy was copied first, then adapted to these existing 2.x owners:

| 1.x source lines | 2.x destination and adaptation |
| --- | --- |
| `src/core/AutoUpdater.ts` 161–1489 (class), especially 424–745 check/apply/config, 792–1272 restart/holds/batching, 1377–1489 persistence | `scripts/update-auto.mjs`: retain 30m checks, 5m coalescing, 60s checkpoint delay, 4h hold ceiling, healthy-session protection, 5m hold retry, 1s released-verifier retry, 30m same-version cooldown and 15m cascade batching. Ports use the existing transaction; no global install cleanup, signal file or direct Telegram send. The existing scheduled crash primitive adds durable backoff and a three-failure/24h pause. |
| `src/core/UpdateGate.ts` 1–465 | `scripts/update-gate.mjs`: full executable session/hold classification, warnings and restart-safe resolver; TypeScript types/comments removed. `tests/unit/UpdateGate.test.ts` 1–end is copied to `tests/preview/update-gate.test.ts` with imports and callback types adapted. |
| `src/core/RestartCascadeDampener.ts` 1–119 | `scripts/update-dampener.mjs`: unchanged decision logic and local-time formatting; TypeScript removed. |
| `src/core/UpdateRestartHandshake.ts` 1–196 | `scripts/update-handshake.mjs`: same pending/verify/failure phases; persist in `update-state.json.runtime.handshake`, retain failures rather than delete evidence, deduplicate by launch, require both the expected running version and a successful admitted channel poll. |
| `src/monitoring/templates-drift-verifier.ts` 220–401 and template inventory 64–102 | `scripts/update-drift.mjs`: host deployment enumeration, current/prior/unknown SHA history and durable path/SHA deduplication. Persist the finding itself before exposure, in the existing transaction. `update-templates.json` covers 2.x's installed MCP default and its three known historical shapes. 1.x reply shell scripts are not 2.x installed artifacts: `journal-agent.mjs` uses the confined transport instead. No foreign installation or unknown customized file is rewritten. |
| `src/config/LiveConfig.ts` 53–112, 143–234, 250–266 | `scripts/update-live-config.mjs`: read/refresh/change events and deep equality. Read `runtime-settings.json` only; omit mutation of the authority-bearing config. Actual updater decisions re-read booleans, timing and windows, and drift scanning re-reads its kill switch. The product uses on-demand reads, not a second polling service. |

`scripts/update-product.mjs` composes those ports. `journal-agent.mjs` creates the
controller only after ordinary admission, starts it after a successful poll and
stops it at shutdown. Its own idle boundary rechecks jobs and session work before
marking a request drained. `host-watch.mjs` uses a single launch adapter to select
validated installed bytes. Its existing crash window, backoff, incident holder,
stop latch and notice driver remain the only restart supervisor. A failed candidate
boot is retained and the next launch uses the prior code. Installation and custody
are independently checked again by the ordinary runner. No agent signs authority.
Manual `instar2 run` retains its original process, signal and exit semantics; an
update drain without a host watchdog requires a subsequent launch.

State is nested in the original `update-state.json`, protected by its original
unique-owner lock. `observing` is the pre-install phase; a real install preserves
runtime state when starting its migration transaction. No second ledger is added.
A three-failure breaker stops automatic attempts durably across process restarts;
corrupt update state disables update activity while preserving existing service.
Explicit local maintenance may call `resumeAutomaticUpdate(root, observedPausedAt)`
after `initializeUpdateRuntime()`. It compares the recorded pause under the same
lock, retains its failure evidence and refuses a stale pause or stop latch. Restart
the controller after that explicit resume; ordinary launches never clear the pause.
All updater observations are local pull data, never a new notification/send path.

The non-authority settings currently consumed are `updates.autoApply`,
`autoRestart`, `restartImmediately`, `checkIntervalMinutes`, `applyDelayMinutes`,
`preRestartDelaySecs`, `restartCascadeDampenerWindowMs`, `restartWindow`, and
`monitoring.templatesDriftVerifier.enabled`. Unknown keys, authority, limits,
installation facts and revocations are never read as grants. Invalid settings keep
the last valid values. Default MCP repair still runs through the existing migration,
including repeated tags; SHA inventory does not authorize replacing customization.

Evidence lives in `tests/preview/update-runtime.test.ts`, `update-gate.test.ts`,
`update-runner-process.test.ts`, `update-lifecycle.test.ts` and the installer tests.
The runner inventory explicitly accounts for the selected release's migration manifest
as an external installed artifact; any other computed import still refuses startup.
Its loader and the shipped manifest remain in the running-code digest. The manifest
of a future candidate is not claimed part of that digest.

The isolated physical lifecycle test performs real npm installation, idle drain,
watchdog launch of the separately admitted replacement, successful HTTP polling and
handshake completion. It recreates the watchdog, installs a candidate that fails before
polling, and observes the previously healthy release serving again. A durable
`runtime.healthyRelease` in the existing transaction carries the healthy selection
across watchdog processes. No activation record is rewritten. The test substitutes
only offline release discovery and the npm source location; no injected launch outcome
stands in for process health. It is not a live installed deployment proof.

Automatic updates refuse a target schema unreadable by the running fallback before
any migration. Reopening a prior healthy release checks its actual manifest against
the current schema; known incompatibility refuses that launch and preserves evidence.
Corrupt optional update records still preserve the original configured runner.

At the normal update cadence, an idle runner with autoApply and template verification
enabled checks and repairs its installed release through the existing migration
transaction, even without a newer release or successful discovery. Disabling either
switch or stopping the runner prevents repair. Changed settings bytes are reread at
decisions even when their modification time did not change. Malformed, oversized or
removed settings retain the last valid values.

[The consumer and template-owner map](update-consumers.md) names all 77 earlier keys,
the additional direct/constant keys found at the new pinned 1.x revision, dynamic-path
limits, protected owners and dependencies on other carryover rows. It does not treat
unported owners as superseded. No model prompt or judgment policy is changed here.

The isolated process proof, independent Astra compliance review and live installed
proof are distinct evidence tiers; only the first is supplied by this test. Dynamic
and nested consumer domains stay with their owning rows.

## Standalone update resources

`instar2 update` launches npm and the syntax check through the real resource owner,
composed as setup's one-shot run composes it: admission, the launch limits, the census
and verified cleanup of the whole process tree. A person runs this command outside the
agent, so it holds no Six allocation and needs no durable ledger: the ledger exists to
return a Six debit after a crash, and here there is no debit. The census does not cover
this launch for a running agent, which counts only its own launches. What bounds the
pair is one launch at a time under the update lock, the per-launch ceilings, and the
user-wide process limit.

A stop during a launch ends the tree and keeps the current release. A cleanup the owner
cannot confirm is reported on stderr, because no ledger row keeps it for later recovery;
it does not fail the update, and a failed census does not refuse a launch. If the
command itself is killed outright, a running npm continues until it finishes, as it
did before and as it does in 1.x; its unpublished stage stays out of `current`. Hosts
whose `/bin/sh` refuses `ulimit -u` cannot launch through the owner at all, so the
command fails there with the current release retained.

## Periodic bound observation

The existing due-proof runner executes `P9-PREVIEW-update-bound` at a one-minute
cadence (two-minute evidence window), using `observeUpdateBound` to replay the
update transaction and inspect the actual controller timers and shared resource
owner. It checks durable pressure against the running controller, the retained
three-failure pause, retry delay, one-to-1440-minute check cadence, stopped timers,
Six allocation attachment and the maintenance answer reserve. Missing, malformed
or never-attempted evidence is unknown; a violated predicate fails. The normal
proof log retains both results. It performs no canary install, model call or send.

`update-bound.test.ts` exercises actual transaction writes, failure/backoff and
controller recreation, including corrupted input and deliberately broken timer
and capacity observations. These are build tests; the resource observations in
the predicate tests are controlled inputs. They do not prove a live installation.
The feature still declares `unbounded` repetition. The register's `bounded` kind names a
bound constructed in core code with governed context, and this probe and the updater live
in `scripts/`. The brakes themselves are the carried backoff, pause and stop, which the
probe observes.

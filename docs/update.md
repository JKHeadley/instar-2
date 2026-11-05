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

Row 87 remains incomplete: the next unit must carry the full bounded AutoUpdater
restart/recovery state machine through independently admitted installation changes,
the host-wide template SHA inventory and deduplicated findings, and live refresh for
the remaining non-authority configuration consumers. These are concrete outstanding
behaviors, not omissions justified as superior 2.0 implementations. This unit neither
re-signs installation facts nor treats a successful installer as activation authority.

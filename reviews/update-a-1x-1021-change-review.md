# Change review — Adapt the 1.x migration step shape

Subject base: ee12b1b02e7f31fe68fda37636b945ef5f831a86
Review state: open
Reviewed content: none
Outcome: Migration ids identify unique idempotent steps, while the release manifest's registration order determines execution, matching the 1.x engine. Existing durable completions, recovery format and release transaction remain intact. The source comparison explains every retained departure without adding runtime machinery.
Affected rules: 2/44/45 (shipped updater, existing-root compatibility and unchanged consumers); 26/34/37/70 (failing-first registration-order test and real npm/CLI/crash tests); 49/74/102/111 (source-based disposition and recorded decisions); 32/113 (machine-local installation); 95 (release integrity fails closed); 101/112 (ordinary commits, preserved history); 116 (adapt the existing step shape rather than add an engine).
Affected floors: Secrets — no new diagnostics or credential paths; spend cap — no model calls or cap edits; stop — no restart or stop-state changes; no duplicate sends — no messaging path touched; durable intake — no journal reset or format change. Durable migration intent and schema-readability refusal remain required before activation.
Operator questions: none
Suggested tier: ordinary
Declared tier: ordinary
Tier rationale: One manifest-validation behavior changes within the existing updater. No new state, service, API or model-facing path.
Side effects: A release may register uniquely named steps in non-alphabetical order. Previously accepted ordered lists execute identically; non-adjacent duplicate ids still refuse before any migration effect. Disk format, failure propagation and completion replay stay unchanged.
Undo and recovery: Revert this repair to restore alphabetical-id validation; a manifest using non-alphabetical registration order would then be refused. No data rollback is needed for the validation change. Interrupted updates still retry the same release using their existing started/done records; never restore backups over live journals.
Multi-machine posture: Machine-local, deliberately. Each installation retains its own update transaction and local-owner lock. No peer policy or conversation ownership changes.
Layer below: Read docs/00-the-purpose.md and docs/01-the-rules.md in full; both match fetched origin/main. Read the pinned 1.x MigratorStepEngine.ts, its PostUpdateMigrator delegation, MigrationProvenance logging, AutoUpdater installation delegation and RestartOrchestrator quiesce/persist/exit path. Compared these with scripts/update.mjs, scripts/update-release.mjs and the existing real npm, installed-CLI, interrupted-step and concurrent-updater tests. Detailed disposition below.
Bug class: none
Bug evidence: Design/reuse repair. Before the source change the added registration-order test failed with "Migrations must have unique ordered ids"; after adaptation the entire targeted update file passed (16 tests).
Hook bypass: none
Convergence: none
Decision: update-a-1x-order | Adapt 1.x registration order with unique stable ids; id spelling has no execution-order meaning. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/update-a-1x-1021-PROGRESS.md
Decision: update-a-1x-transaction | Retain the existing 2.0 before-effect transaction, fail-closed replay and publication guards because the 1.x engine cannot provide these requirements unchanged; add no engine or ledger. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/update-a-1x-1021-PROGRESS.md

## 1.X FIRST disposition

Source: JKHeadley/instar main resolved by `git ls-remote` to
`0b47ed7c6b3cc108f20eec74ed590ab979de5fde`. The files below were read at that exact
commit, also the source revision cited by Astra's review.

- **MigratorStepEngine.ts, registerStep / runPendingSteps / writeLedger:** take the
  named idempotent worker, registration-order traversal, persisted completion skip
  and atomic ledger replacement shape. The concrete repair replaces the 2.0
  alphabetical-id requirement with uniqueness validation. The existing loop already
  has the pending-step/completion shape; retaining it is a compatibility choice, not
  evidence that its original author copied 1.x. Its original transaction and I/O
  implementation were independently written. This repair documents the comparison
  rather than retroactively claiming literal reuse.
- **Identity and selection:** 1.x uses `name`, `version`, `run(ctx)` and keys its
  ledger by `version:name`; the installed 2.0 manifest already uses stable `id` and
  `run(root)`. A manifest contains the migrations for that release, so it does not
  need the 1.x semver scheduler. Retain the installed interface and never reuse an
  id. `version.json.migrations` skips completed ids across releases; the enclosing
  transaction retains previous version, target release, step status and backup, and
  completed transactions are archived. Changing keys would risk replaying already
  applied work and require an unnecessary format migration.
- **Failure and intent:** 1.x records outcomes only after execution, continues after
  a failure and skips recorded failures on later calls. 2.0 must durably record
  intent first, leave interrupted work retryable, and propagate failure before
  publishing `current`. Importing those 1.x semantics would permit activation after
  failed migration or lose the durable cause. Retain the started/done transaction,
  fsync plus rename and parent-directory fsync; no second ledger is introduced.
- **Corruption:** 1.x `readLedger` treats corrupt or unreadable input as empty.
  2.0 must preserve and refuse corrupt JSON so lost completion evidence cannot
  silently become fresh work. Retain its throwing read path.
- **PostUpdateMigrator.ts:** `registerStep` and `runPendingSteps` delegate to the
  engine (lines 1519–1534); no separate execution machinery to port. Its hooks,
  settings and awareness migration catalog targets 1.x installations, not the
  initially empty 2.0 release list.
- **MigrationProvenance.ts:** versioned results are useful lineage, but `appendLog`
  deliberately swallows append failures. Retain provenance inside the mandatory
  transaction/history rather than add best-effort logging to establish durable cause.
- **AutoUpdater.ts / RestartOrchestrator.ts:** installation is delegated to
  `UpdateChecker.applyUpdate`; restart quiesces, persists and exits. These clarify
  lifecycle separation, but do not provide Step A's staged release directory,
  schema-readability check or atomic current-pointer transaction. Restart is step D;
  there is no reason to import its scheduling or notification machinery here.

The retained release transaction prevents crash-lost intent, unreadable activation
and concurrent publication. Staging keeps partial npm output off `current`; the
schema check prevents unreadable state; the existing unique-owner lock serializes
publication. These are the concrete gaps in the 1.x step primitive, not a claim that
the entire updater needed to be re-derived.

Subject (5 paths): scripts/update.mjs, scripts/update-release.mjs, docs/update.md, tests/preview/update.test.ts, reviews/update-a-1x-1021-change-review.md

## Closing block

simplestRobustRoute: This is the simplest robust route: adapt 1.x named idempotent steps in registration order, retain existing persisted completions and provenance, and keep only the existing release transaction needed for crash-lost intent, unreadable activation and concurrent publication. No new engine, ledger or supervisor. Start guards validate the installed manifest and schema; end guard requires completed migrations before publication; limits remain one updater per root and bounded npm timeout/output. Real local npm/installed-CLI and process-death tests establish installer behavior, not unattended live self-update acceptance.
80/20: Repair the one reuse finding with a small behavior adaptation and explicit source disposition. Targeted tests cover non-alphabetical order and duplicate rejection plus the existing durability, replay, compatibility and concurrency boundaries. Independent review and the Studio gate own acceptance.
VERDICT: author submission; no independent acceptance claimed

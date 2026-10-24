# Change review — train-145 quota relocation and stale-owner retirement

Subject base: b1b8587af5e64a31850e44357dcc57e763cb89db
Review state: open
Reviewed content: none
Outcome: Installation moves retain live quota custody reads; an owner whose lease expires during a poll retires cleanly before intake instead of reporting a crash.
Affected rules: Purpose 2/3; Rules 1, 4, 26, 31, 34, 35, 37, 42, 44, 45, 49, 63, 70, 74, 95, 100, 101, 102, 111, 112, 113, 116
Affected floors: secrets — preserve credential contents, permissions and account binding; spend cap — existing admission unchanged; stop — existing ended predicate and worker gate; no duplicate sends — shared ownership and dispatch fences unchanged; durable intake — no stale cursor advancement, existing replicated intake unchanged
Operator questions: none
Suggested tier: critical
Declared tier: critical
Tier rationale: The repair touches quota observation and the multi-machine owner's lifecycle; it changes no authority or model decisions.
Side effects: Only quotaLogin paths contained within the recorded installation root relocate. External paths and profile contents remain unchanged. A post-poll stop or expired lease ends the runner through its existing retirement and revival record. Intake exceptions still propagate unless the existing ended condition holds. The test-only poll barrier is bounded and enabled by a synthetic file in the fixture world, never a product switch.
Undo and recovery: Revert these source changes to restore the prior readers and loop behavior. Retain all manifests, custody and run records; no state schema changes, deletion or replay is required. Move a relocated root back for the old reader; a retired owner is revived as standby by the existing supervisor.
Multi-machine posture: Quota custody is deliberately installation-local; moving a reference grants no peer authority. Shared ownership is rechecked after transport returns and before intake. An expired owner neither advances the cursor nor sends; the current owner retains the pending input and the retiring process is queued as standby.
Layer below: Read the full constitution, existing relocation containment and preparation/immutable validators, actual readHarnessLogin permissions and account binding, SubscriptionPool constructor and configHome selection in the local 1.x reference, worker intake gate, shared lease and dispatch boundaries, and runner retirement records. Inspected the Studio failure's retained stderr/run rows, not the full saved test report. Git core.hooksPath is unset and the common hooks directory contains only sample hooks.
Bug class: integration
Bug evidence: reproducer=tests/preview/installed-harness-logins.test.ts; tests/preview/two-machine-runner.test.ts; tests/preview/journal-due-loop.test.ts
Hook bypass: none
Convergence: none
Decision: T145-quota | Add quotaLogin to existing contained reference relocation; preserve external custody and account binding. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-145-repair-095721-PROGRESS.md
Decision: T145-retire | Reuse ended after the awaited poll and untilStopped around intake; an expired owner retires while unrelated failures still propagate. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-145-repair-095721-PROGRESS.md
Decision: T145-proof | Exercise the real quota reader after rename/copy and force the transport-return race with a bounded non-burning poll barrier. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-145-repair-095721-PROGRESS.md
Decision: T145-lineage | Supply the omitted 1.x pool lineage in the relocation record; extend the inherited reader for 2.0 derived manifests. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-145-repair-095721-PROGRESS.md
1.x lineage: JKHeadley/instar main src/core/SubscriptionPool.ts selects accounts/config homes and resolves subscription-pool.json from the current stateDir. The existing 2.0 harness-login-pool reader inherits that selection; relocation extends it for derived per-build manifests, not a new pool. The retirement repair reuses 2.0's existing ended/untilStopped boundary; no 1.x transplant is needed for this exact shared-lease poll race.
Prompt review: No model prompt, model output parser, verdict acceptance or escalation/refusal judgment changes. The ownership refusal is the existing exact recorded-lease checkpoint. Tests use synthetic custody and process transport, not invented model-result evidence. The retained pool suite already exercises recorded model-result shapes.

simplestRobustRoute: This is the simplest robust route: include the omitted field in the existing relocation map and apply the already-used stop guard at the poll/intake boundary. No new store, watcher, migration service or policy is added. Start guards are existing custody/authority validation and ownership; end guards are successful local custody reads and recorded clean retirement; caps, stop, replication and unique dispatch remain the limits. No autonomous live completion or independent acceptance is claimed.
80/20: Repair the two source omissions and lineage statement, test their consumer boundaries, regenerate only required pins, and submit focused evidence to the desk's full gate.
VERDICT: author submission; no independent convergence verdict claimed

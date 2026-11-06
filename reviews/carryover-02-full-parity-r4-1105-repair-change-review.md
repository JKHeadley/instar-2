# Change review — adopted worker identity and durable replay evidence

Subject base: b0d56324ac4399d0e17d4efa64070460d2f22e08
Review state: open
Reviewed content: none
Outcome: A host replacement supervises the surviving worker under its original incarnation. A prepared effect on that original edge, even when observed, prevents input replay while normal tools, model calls and supervision remain available. The supported native composition is certified against its actual bytes and runtime.
Affected rules: 26, 30, 37, 49, 57, 59, 68, 70, 74, 101, 105, 111, 113, 115, 116; architecture R105.
Affected floors: secrets — no new secret surface; spend cap — original liability and review reservation remain enforced; stop — all existing checks remain; no duplicate sends — durable prepared history fences reinjection across adoption, including observed effects; durable intake — original edge, request digest, claim and result destination remain bound.
Operator questions: none
Suggested tier: critical
Declared tier: critical
Tier rationale: repair of existing worker adoption and replay checkpoints with recorded restart evidence; native conformance renewed by the existing contract.
Side effects: Observations, nudges, reinjection and process-target validation use the physical worker incarnation after host replacement. Observed effects prevent replay but do not prevent ordinary supervision. The original counters continue guarding effects after restoration. No tools or model access are removed. The declaration and generated publication reflect the proved composition.
Undo and recovery: Revert the source repair and regenerate publication with matching native conformance; this would reintroduce the demonstrated defects, so retain the preparation history and original worker identity during any alternative repair. No durable schema or migration changes.
Multi-machine posture: Adoption remains restricted to the exact owner, placement, lease, claim, delivery digest and durable original edge. The host incarnation may change while the worker's incarnation remains stable. Native evidence certifies the declared Darwin runtime only.
Layer below: recoverWorker and the driver's original incarnation; shipped stallSample identity filtering; existing recoveryEdges prepared/observed rows and restored admission counters; process target checks; compositionClosure/compositionDigest/currentRuntime and the native harness contract.
Bug class: durability
Bug evidence: reproducer=tests/assembly/production-session-work.test.ts; restart=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/carryover-02-r4-repair-owner.log
Hook bypass: none
Convergence: none
Prompt review: No question or parser is changed. Recorded summary, Jev, reply-review and reply bytes replay through the shipped parser during adopted supervision; uncertain and empty shapes remain unknown while the original worker continues.
Decision: carry02-r4-repair-checkpoint | Retain incarnation through the existing adoption record and inspect durable preparation rows at the replay checkpoint; no new owner, journal or capability restriction. Renew native conformance only after supported-runtime contract evidence. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/carryover-02-full-parity-r4-1105-repair-PROGRESS.md

1.x comparison: Inherits reviewed JKHeadley/instar cc11e45f92e2590dd1bbd3c3facb5b849532f0fc against b947c171f834f5e0e22d5087e090b2a9031189f9. Rechecked actual local origin/main f94fb584bf7cfdfe0bcb5ff4526e88af512d145d: src/monitoring/ActiveWorkSilenceSentinel.ts, SessionMonitor.ts, SessionWatchdog.ts, StaleSessionBackstop.ts, DegradedTmuxGuard.ts, StallTriageNurse.ts and TriageOrchestrator.ts have no diff from cc11e45f. Searched src/, docs/specs/SESSION-TRIAGE-AGENT-SPEC.md and CRASH-RECOVERY-UX-SPEC.md and matching history (0d9bd763d, 5129779c3, a29957130, ab26b7ca3). Reuses bounded nudge, typed triage actions and restoration lifecycle through the existing 2.0 owners; session-name recovery, numeric PID authority, private timers and direct notifications remain replaced by existing exact-worker/resource/effect owners. No ONEX-LESSONS.md in the searched tracked 1.x tree or non-worktree agent tree or this worktree. This repair restores the identity and no-effect evidence lost at the adoption handoff rather than rebuilding the 1.x behavior.

Verification: Reviewer reproducer 2 failures / 1 pass before repair, 3 passes after; expanded adoption/identity/replay/recorded-shape tests 18 passes. Typecheck/build pass. Whole changed owner file 98 passes and one unchanged Linux-only kernel-pinned process fixture failure on Darwin; the physical two-host HTTP cases pass. No installed macOS exact-child actuation or row 02 closure is claimed. Explicit portable test-name selection passes 98 cases, excluding only that already demonstrated Linux-only case; the original failure log remains retained. Logs and exact recorded update ids are in the report.
Native evidence: Existing contract tests/preview/native-harness-contract.test.ts first passed nine behavioral cases and failed only the stale certificate assertion, then passed all ten after renewal. Darwin Node 24.14.1 executable sha256:91d3afb67a7dc211f642f2328f822505ff1c1ad381e98ffdd21b003970deeeda; 277-file composition sha256:a19e914894135197863725ed1965218f6332b674f6c3af84debaaa62171cc45e. Before/after logs: /Users/dabombstudio/.instar/agents/echo/.instar/lanes/carryover-02-r4-repair-native-before.log and /Users/dabombstudio/.instar/agents/echo/.instar/lanes/carryover-02-r4-repair-native-after.log. Architecture passes on the renewed declaration.

Publication: Existing desk repin tools ran with zero owner/inventory pin changes. Replayed register from committed source c71c9fb33e9e22cc5cb6a55f6456ed826e9449d7, generation sha256:03566f2caeaa6ebf9c0a2495456d45621efb47a11455b514ab1d1055e726a687, shape-only authority. The seven generated files publish that source and the proved native declaration. The inherited original report now names its twelve already committed decision IDs, resolving the preliminary Rule 102 findings without changing historical review decisions.

## Closing block

simplestRobustRoute: This is the simplest robust route: keep the existing owners and pass along the original worker identity and durable replay evidence. The lease, exact identity, deadline, calls, effects, stop and no-duplicate floors remain the guards; the original result remains the exit test. No new machinery or approval. Native parity uses the existing contract and digest tooling. No unattended installed actuation or live-user acceptance is claimed.
80/20: Two demonstrated handoff defects repaired; native byte-bound evidence renewed after its real contract. Targeted tests and cheap gates only. Installed process actuation, non-Linux exact-child actuation and live/user acceptance remain the review's named dependencies, so carryover row 02 stays open.
VERDICT: author submission; independent re-review required

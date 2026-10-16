# Change review — exact context recovery and durable disclosure

Subject base: 87d92c2535f65db2889d7be9a1e3f3a3e8ce15b2
Review state: open
Reviewed content: none
Outcome: a replacement worker receives the exact admitted pending packet; recovery disclosure survives nested replies, memory acknowledgements and downstream revisions. Real isolated update 1016109 recovered and delivered the recipe answer with disclosure once.
Affected rules: 2, 26, 34, 35, 36, 42, 47, 49, 55, 60, 61, 62, 63, 68, 70, 74, 75, 96, 101, 105, 107, 110, 113, 116
Affected floors: secrets — existing confinement, custody and outbound checks; spend cap — unchanged parent reservation and original deadline; stop — existing owner/driver guards; no duplicate sends — existing no-tool-since-dispatch and known-send guards, durable send intent; durable intake — original operation, digest, history and result path retained.
Operator questions: none
Suggested tier: critical
Declared tier: critical
Tier rationale: changes recovery input framing and the operator's delivered recovery account; real worker and send evidence are required.
Side effects: pending recovery omits its redundant wrapper; ordinary task delivery and cache-miss history restoration keep their existing paths. Recovery evidence is an optional host field on the existing answer record, accepted only for that same input's complete nonempty answer. It is rendered after acknowledgement/revision and before final bounds, credential checks, signing and durable send intent. Model output cannot create the field. Unknown sends remain unknown and are never replayed.
Undo and recovery: revert this change before deployment. Old journals remain readable without the optional field; new answer records retain their host evidence across journal compaction and replay. No live root or bot was modified. Failed recovery still reports an incomplete answer.
Multi-machine posture: the current conversation owner retains its existing fence and cumulative liability; no new service or authority. The answer evidence uses the existing journal durability/replication path. Proof rooms and capture files are deliberately Studio-local.
Layer below: controlled train-52 and candidate no-fault workers, real HTTP400 context failure after admission, physical tmux identity/close, compact failure, exact pending packet restoration, correlated result and Stop receipt, answer decoding, acknowledgement/revision, signed send intent and loopback receipt.
Bug class: unit
Bug evidence: reproducer=tests/preview/journal-conversation-session.test.ts
Hook bypass: none
Convergence: none
Decision: exact-pending-packet | restore the original admitted task without extra identity/protocol framing; the owner already fences replay and retains last inbound/history | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/wedge-recover-1016c-PROGRESS.md
Decision: host-owned-disclosure | carry recovery identity outside model JSON and attach the disclosure to the final send body, preserving all existing reply shapes and declarations | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/wedge-recover-1016c-PROGRESS.md
Prompt review: no new model prompt or role authority. Removes only the pending-recovery wrapper. The captured 1016106 pending envelope replays byte-for-byte, with the same history, input identity and destination. Recorded summary-writer/uncertain summary, Jev undecided/unsure, reply-review, delivered reply and empty reply shapes also exercise the changed recovery/disclosure path.
Prompt finding: 4106b49fff07 | protocol-literal | unchanged existing no-attempt guidance describes the actual reply-only boundary; this repair neither introduces nor branches on that sentence
Prompt finding: 849db3a6296a | protocol-literal | unchanged existing memory-list rendering sentinel, not a new meaning classifier or recovery decision
Prompt finding: e8708c7fea24 | protocol-literal | unchanged source-attribution guidance; recorded evidence remains data and this repair adds no phrase-based model verdict
Verification: red nested-reply replay before the disclosure repair; targeted journal/answer/revision, driver/owner and direct-consumer checks in the progress report. Control (a) train-52 update 1016101 and (b) candidate 1016102 both answered without envelope refusal. Additional train-52 recipe control 1016108 answered. Restored recipe 1016106 refused; final exact-packet continuation 1016109 answered. This is observed real evidence, not a claim that stochastic model refusals are impossible. Native conformance renewal and source pins remain the desk's gate inputs; no declaration is hand-edited.
simplestRobustRoute: use the already-admitted packet unchanged and the existing journal/send path for disclosure. This is the simplest robust route. The added optional answer field prevents the demonstrated loss through nested reply decoding or downstream text replacement, which editing model text cannot prevent. The existing start guards require exact idle context failure, no intervening tool work or uncertain send, a current grant and remaining original allowance; the end requires a correlated nonempty answer and turn receipt; the unchanged limits allow one compaction and one replacement. Isolated proof-exact update 1016109 used five model calls under the original 128-call reservation, closed its original worker before replacement, and delivered 180°C = 356°F with disclosure once, unattended.
80/20: the real unattended answer and both sides of the affected replay/disclosure guards are verified; further model-framing machinery has no demonstrated need. The independent desk owns convergence and the full suite.
VERDICT: author submission; no independent convergence asserted

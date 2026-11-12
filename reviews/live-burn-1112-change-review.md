# Change review — distinguish scheduled tool liability from refused admission

Subject base: e3cb0f08d3a74d70c9e059edbd64fc457492bfff
Review state: open
Reviewed content: none
Outcome: preserve a diagnosis of the November 12 live budget incident with two executable counterexamples. No product fix or READY claim: recorded calls really launched, and the requested refused-launch explanation was not reproduced.
Affected rules: 49, 55, 60, 61, 70, 74, 75, 101, 102, 111, 113, 116, 123
Affected floors: secrets — read-only live inspection emitted only metadata; spend cap — no refund or ceiling change; stop — unchanged; no duplicate sends — unchanged; durable intake — unchanged.
Operator questions: none
Suggested tier: ordinary
Declared tier: ordinary
Tier rationale: tests and diagnosis only, with zero changed product lines. The reported live incident remains unresolved as a product-efficiency problem.
Side effects: two offline tests exercise existing resource admission and tool accounting with fake clocks and local test journals. No live calls, model prompts, parsers, dispatch decisions, grants or data stores change.
Undo and recovery: revert these test additions; there is no product state migration or operational rollback.
Multi-machine posture: the tests use an owner-local simulated host and journal. Existing ownership, replication and replay remain unchanged. Live evidence was read only on the Studio.
Team posture: no roles, audiences, sharing or authority change. The report carries operation IDs and aggregate accounting only; live message content and secrets were not exported.
Layer below: inspected workCycle/workObligations scheduling, obligation-start accounting, runToolTurn whole-liability reservation, retained tool-turn projection, topic capacity and physical lease release, and actual encrypted journal rows around the incident.
Bug class: none
Bug evidence: none
Hook bypass: none
Convergence: none
Decision: preserve-real-spend | do not refund completed scheduled calls as unlaunched; preserve diagnosis tests and report the failed incident hypothesis instead of guessing a fix | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/live-burn-1112-build-report.md

1.x comparison: JKHeadley/instar origin/main db3ed6d3052cfcc24888b6c8bc86086abcfc2987, src/core/SessionManager.ts and src/core/VetoedKillBackoff.ts, docs/specs/session-respawn-thrash-elimination.md, history including ab26b7ca3; searches across actual src/ and docs/specs/. ONEX-LESSONS.md section 2 records thousands of vetoed kill requests with only two real kills. Reuse its distinction between attempts and physical outcomes. The kill-veto ledger does not implement this journal's model accounting, so no code was copied.

Incident evidence: /Users/dabombstudio/.instar/agents/echo/.instar/lanes/live-burn-1112-metadata.jsonl, extracted read-only from the named runner's journal by live-burn-1112-read-metadata.mjs. Thirteen distinct commitments started before restart. Twelve completed with usage; the thirteenth was interrupted. Work continued after restart. Each tool step reserved one base plus seven extra turns plus two 33-call child allowances: 74. The four exact counter jumps in the supplied ls2/ls3 interval also added 710769 input and 6952 output tokens. CPU refusal belongs to the concurrent topic-worker path.
Verification: both new tests pass on unchanged train-240 product code. Thirty refused capacity cycles add zero calls; three admitted turns add three. Three distinct scheduled tool calls each add 74, settle their usage, and stop being eligible once their reports exist. Existing targeted admission, capacity and prelaunch suites pass. Full command outputs and accounting checks are in the Studio build report. No red/green product repair is claimed.

## Closing block

simplestRobustRoute: use existing journal evidence and two focused tests to identify actual launches before changing accounting. The observed real calls must remain charged exactly as before; a speculative refund would violate the spend floor. No new product machinery is proposed.
80/20: the operation IDs and usage decisively distinguish actual scheduled work from the refused-admission hypothesis. Further changes require a revised diagnosis of obligation relevance or conservative tool liability, not an invented launch leak.
VERDICT: author submission; this record asserts no independent verdict — the review desk records its own

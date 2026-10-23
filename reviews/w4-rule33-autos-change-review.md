# Change review — Keep summary memory within its source frontier

Subject base: 42767914df8d0561fd1a5280cc0e7341cc546913
Review state: open
Reviewed content: none
Outcome: Older summary packets include only saved fact and preference sources at or before their frontier. Later memory stays durable and becomes eligible when the frontier reaches it. Rule 33 continues to reject invalid recorded packets.
Affected rules: 7, 26, 33, 34, 36, 49, 70, 74, 96, 101, 107, 113, 116
Affected floors: secrets — no credential or outbound changes; spend cap — existing summary attempt and token bounds unchanged; stop — existing gate unchanged; no duplicate sends — no send path changed; durable intake — all journal records retained
Operator questions: none
Suggested tier: critical
Declared tier: critical
Tier rationale: This is a small packet selection change in the live journal worker; real recorded input replay and summary, audit, preference and reply regression checks cover its model-facing behavior.
Side effects: A summary of an older prefix no longer offers saved facts or preferences from later turns. The preference projection is restricted only for summary packets; ordinary answers still follow a preference decided from the current message. No prompt wording, parser, proof predicate, schedule, persisted history or grant changes.
Undo and recovery: Revert the source change and regenerate register pins. Historical packets remain authentic historical evidence; an old failed agreement is not rewritten. The next eligible summary uses the fixed builder, and the existing scheduled agreement or startup check records its actual verdict.
Multi-machine posture: The preview journal and proof-room evidence are machine-local deliberately; no transport, owner, replication or shared-store behavior changes.
Layer below: Read the original encrypted journal through the startup frontier and replayed its pre-summary prefix. All three allegedly absent sources exist and are accepted, but updates 6235556, 6235557 and 6235558 are later than summary frontier 6235554. The unchanged audit correctly detects that temporal mismatch. The exit-frontier mismatch in F22 is separate. Reviewed the 1.x CoherenceMonitor, STATE-COHERENCE-REGISTRY and coherence history plus ONEX-LESSONS section 5; no matching 1.x packet builder can be ported.
Bug class: live-path
Bug evidence: reproducer=tests/preview/summary-candidate-frontier.test.ts; live=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/w4-rule33-autos-evidence/generated-replay.json
Hook bypass: none
Convergence: none
Decision: summary-source-frontier | Bound saved local candidates by their source update and summary preferences by their trigger update; preserve all stored memory. Use the existing summary-only packet mode so a freshly decided reply preference still applies to its own answer. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/w4-rule33-autos-PROGRESS.md
Prompt review: No prompt wording changes. Real proofroom2 journal replay exercises the changed packet selection for summary:6235554, using its recorded malformed writer output and separately a recorded uncertain result from 715672492. Both packets audit clean while retaining 48 turns and all 18 memory changes. The existing summary-cascade-stall, reply-review-budget and unknown-answer-notice tests replay real summary writers, uncertain/undecided Jev verdicts, reply-review outputs, delivered replies and empty recorded context. Empty context is not claimed as evidence of an empty delivered Telegram message.
Prompt finding: 4106b49fff07 | protocol-literal | Existing unchanged tool-attempt instruction; this change adds no prompt words and does not decide intent from a fixture phrase.
Prompt finding: 849db3a6296a | protocol-literal | Existing unchanged memory-list rendering marker; the summary boundary fix does not alter it.
Prompt finding: e8708c7fea24 | protocol-literal | Existing unchanged provenance guidance; the selection now satisfies that guidance without changing the audit.

Register pins: Regenerated the seven generated register views from source commit 15571a41f6c404bac0ce72adf0ae0df8336b412b; no declarations or authority changed.

Verification: Original reproducer fails twice; repaired packet replay audits clean. Targeted follow-up: 9 files, 77 tests pass, including the current-message preference regression. Earlier targeted store-agreements, summary-fit and summary-bound checks also pass. Architecture and typecheck pass; final pushed-head lint, register and pinned-text gates are recorded in PROGRESS.

## Closing block

simplestRobustRoute: Use the frontier the summary already declares to select its local saved-memory candidates and preference projection. The two bounded filters close the observed temporal inconsistency with no new state, retry, scheduler or checker. Existing intake, authentication, output admission and attempt ceilings remain the start/end/limit guards. Rewriting historical proof records or relaxing the audit would hide the failure instead of preventing it.
80/20: The regression fails on the original code for both saved facts and preferences and passes with the fix, including equality at the frontier, later eligibility, compaction and reopen. Full original journal-prefix replay confirms the real path. This author submission claims no independent convergence or live deployment; the desk owns review and deployment.
VERDICT: author submission; this record asserts no independent verdict — the review desk records its own

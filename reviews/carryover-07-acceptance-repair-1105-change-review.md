# Change review — propagate exact acceptance to Codex inbox and recovery pressure

Subject base: 020e3122d57533bc4a091abbf20e56c67f693058
Review state: open
Reviewed content: none
Outcome: A confirmed Codex turn keeps its admitted lifetime beyond the typed request ACK deadline. An exact reconciled escalation receipt corrects the original failure sequence, preserving subsequent failures and restoring useful recovery only when that suspension was disproved.
Affected rules: 1, 26, 28, 29, 30, 31, 32, 33, 34, 36, 42, 46, 49, 55, 61, 63, 68, 70, 74, 77, 97, 101, 102, 111, 113, 116.
Affected floors: secrets — existing custody and outbound scanning; spend cap — existing model admission and accounting; stop — existing host guards and exact process closure; no duplicate sends — uncertain RPC and send outcomes never authorize replay; durable intake — existing session store and canonical journal retain all accepted work.
Operator questions: none
Suggested tier: critical
Declared tier: critical
Tier rationale: Repair two gates controlling admitted model work and recovery of irreversible sends.
Side effects: Codex observation now binds ACKs to the submitted operation, digest and worker. Recovery pressure retains original observation order, time and outcome in the existing derived journal view; receipt correction reprojects that sequence. A resume boundary prevents an older correction from resetting newer pressure. No journal frame or storage format changes, new owner, timer, service or authority.
Undo and recovery: Retain the canonical journal and session store when reverting. Replaying journal frames rebuilds the projection. Reverting restores the demonstrated false ACK expiry and suspension defects; no uncertain input or send may be resubmitted as part of rollback.
Multi-machine posture: Existing conversation ownership, signed send subject and durable session custody remain authoritative. Pressure is rebuilt from the same encrypted journal on restart or handoff. The adapter timestamp is observed from the admitted local protocol connection and retained by the existing host, never shared as fresh process authority.
Layer below: scripts/session-protocol-io.mjs correlates request ids and captures responses before resolving; Codex turn reader binds thread and turn identities. The host records dispatch before calling the adapter and persists ACK before deciding timeout. The journal validates exact signed receipt subjects, projects target acceptance and pressure atomically, and replays original frame order. Existing stop, spend, expiry and dispatch-uniqueness checks still precede work.
Bug class: integration
Bug evidence: reproducer=tests/harness-adapters/codex-conversation-worker.test.ts; reproducer=tests/preview/delivery-recovery.test.ts
Hook bypass: none
Convergence: none
Decision: row07-repair-ack | expose correlated turn/start acceptance through the existing observation field and host custody; retain the original acceptance time rather than polling time | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/carryover-07-whole-parity-r2-1105-repair-PROGRESS.md
Decision: row07-repair-pressure | correct the provisional outcome in original journal order, reproject the existing pressure sequence and preserve the authenticated-resume boundary | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/carryover-07-whole-parity-r2-1105-repair-PROGRESS.md
Prompt review: No model instruction or semantic decoder changes. The existing recorded writer, Jev, review and delivered-reply replay now asserts that every recorded shape receives the same protocol ACK. Summary uncertain, Jev uncertain/undecided and empty bubbles remain verbatim evidence; no model judgment is inferred from acceptance.
Prompt finding: 4106b49fff07 | protocol-literal | Existing topic-awareness instruction is unchanged; no phrase-based decision was added.
Prompt finding: 849db3a6296a | protocol-literal | Existing empty-memory response is unchanged.
Prompt finding: 85544c20941f | protocol-literal | Existing durable-custody notice is unchanged and grants no send authority.
Prompt finding: e8708c7fea24 | protocol-literal | Existing citation instruction is unchanged.

## 1.X FIRST — inherited comparison, independently rechecked

The inherited whole-row brief compares actual JKHeadley/instar a8af8bff7ffd78dcdb2e032b216d22274141c44e with fd741cf528b8fefae3c1b41198f3d3218cde952e. This repair rechecked those Git objects and current local main cc11e45f92e2590dd1bbd3c3facb5b849532f0fc. The four focal sources are unchanged across these references. Searched actual src/, docs/specs/ and history, including aceb6aedc, a29957130, 08ba1558e and ab26b7ca3, and read ONEX-LESSONS.md Telegram delivery lines 62–85.

- src/monitoring/delivery-failure-sentinel.ts and delivery-failure-sentinel/recovery-policy.ts retain five failed escalations in the inclusive hour, success reset and explicit resume; docs/specs/telegram-delivery-robustness.md section 3f names the breaker. Correcting UNKNOWN success in original order completes this adaptation.
- src/messaging/DeliveryRetryManager.ts retains request/query/wellness ACK deadlines of 10/5/2 minutes. Correlated Codex consumer acceptance now reaches the common host just as the terminal adapter's receipt does. ACK is distinct from completion; the existing admitted lifetime remains the work ceiling.
- src/messaging/telegram-origin/OriginUnrecordedReceipts.ts retains captured acceptance for reconciliation. The existing 2.0 canonical journal and signed subject remain stronger than separate fallback storage or HTTP/absence assumptions. No legacy blind reinjection or storage topology is restored.

## Focused evidence and limits

The reviewer reproducers were incorporated into existing test files. With source repairs absent, the typed Codex path expires at clock 606000 and the reconciled-success projection retains five failures; the untyped result completes at 651000 (its new ACK-time assertion also fails before repair). Raw red output is retained in the repair PROGRESS evidence paths.

The final adapter file passes 24 tests; recovery passes 42. The injected-clock host cases use actual captured codex-app-server-0.156.1.json frames: typed and untyped work complete at 651000 with one submission and ACK time 1000. Missing/malformed response and wrong operation/digest/incarnation controls retain uncertainty or refuse observation without ACK/replay. Recorded protocol and proof-room shapes still pass, including summary-writer, Jev, review and empty reply bytes.

Pressure tests delay an UNKNOWN receipt until five outcomes have accumulated, replay the journal, reconcile the exact accepted message 91 and retain only the two subsequent failures. Absent/wrong subjects leave suspension intact. Reconciliation after authenticated configuration resume preserves subsequent failures and a genuine subsequent five-failure suspension. Reopening/replaying is identical; duplicate drains do not count outcomes twice. The corrected gate admits the existing next-due wake and drains queued recovery exactly once.

Typecheck passes after correcting test-only readonly configuration and absent-query typing. Full suites and live provider/operator traffic were not run, per the repair instruction. Independent Astra review, combined Studio qualification and fresh installed-live acceptance remain desk gates. Architecture currently reports only the charter-permitted native macOS R105 composition certificate mismatch; no declaration is changed to conceal it. Final cheap-gate outputs and pushed-head identity are recorded in PROGRESS.

simplestRobustRoute: This is the simplest robust route: connect exact existing acceptance evidence to the existing adapter/host and journal pressure consumers. Observation order and resume boundary prevent the credible failure of erasing later failures during delayed reconciliation. Original identity, current authority, durable intake, stop, spend, lifetime and no-replay checks remain the start/end/limit guards; no autonomous installed-live completion is claimed.
80/20: Repair the two demonstrated shipping failures and their positive/negative neighbors, preserving existing owners and capabilities. Added evidence is focused on real captured shapes and deterministic failure injection, with no load test or new service.
VERDICT: author submission; this record asserts no independent verdict — the review desk records its own

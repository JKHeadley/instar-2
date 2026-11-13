# Change review — Truthful bounded progress from observed tool requests

Subject base: 384bad285f51c5c132d9474fb3d5fc2cc9835e75
Review state: open
Reviewed content: none
Outcome: slow answers quote a freshly observed open tool request by the first eligible progress tick; live sessions without an observable request retain fixed liveness, never invented results.
Affected rules: 1, 26, 34, 36, 49, 52, 55, 63, 70, 74, 75, 76, 84, 87, 89, 101, 102, 111, 113, 116, 118, 123
Affected floors: secrets — existing outbound checks inspect the full quoted request, no raw command arguments newly exposed; spend cap — no new model calls, ordinary reply reserve unchanged; stop — same current/admit fences; no duplicate sends — existing durable ordinal and step consumption, including UNKNOWN, plus operation-scoped generic fallback; durable intake — existing encrypted journal and replay retained.
Operator questions: none
Suggested tier: critical
Declared tier: critical
Tier rationale: changes user-facing progress content and eligibility within the existing signed journal send path.
Side effects: first progress retains intake+120s but uses a 60s outbound silence floor; later silence remains 120s, with 3/5/10-minute gaps and four lines per overlapping episode. A live session without a current tool can now send one generic fallback per operation. No progress describes completed tools as active. Request wording is a quote of the admitted request, not a claim the requested effect succeeded. No new dispatch after final/stop; the existing nonblocking transport can settle an already-dispatched progress send after the answer. It is not changed to delay the answer. Over-block: missing/overlong request detail stays generic. Under-block: model-written descriptions may be inaccurate, so the message explicitly quotes a request. No new authority, gate or semantic keyword classifier.
Undo and recovery: revert the three product files; prior readers accept optional request/running fields and replay retains signed prepared text without invoking the current renderer. No new store, migrated policy or resend behavior. Current code reads earlier fixed and agent-attributed status records unchanged.
Multi-machine posture: local fresh observations are disposable; journal intents, cadence and outcome evidence follow the existing conversation owner and replication path. A replacement owner must freshly observe its session. No additional sender or host dependency.
Team posture: progress uses the same verified operator conversation, disclosure check, thread and signed infrastructure provenance as before. Private by default; no new audience grant, public surface or sharing path. A member or guest receives nothing outside the existing verified audience.
Layer below: read purpose and rule book; inspected tool-admission reader, session observation wiring in journal-agent.mjs, signed held-notice preparation, disclosure and current/admit fences, snapshot/replay, reply reserve, stop and overlapping-topic cadence. Independent local reviewer found empty-admission fallback and cross-turn identity gaps; both were repaired and retested. Independent landing judgment remains the desk's.
Bug class: integration
Bug evidence: reproducer=tests/preview/progress-truthful.test.ts
Hook bypass: none
Convergence: none
Decision: progress-truthful-request | Quote only an open admitted request; no inferred outcome and no extra model call. Raw commands remain internal; existing outbound and audience checks apply. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/progress-truthful-1112-PROGRESS.md
Decision: progress-truthful-first-bound | Keep intake+120s and later cadence/cap; reduce only first-note silence to 60s so the recorded +31s reaction does not postpone it to +151s. Polling contributes at most 5s before dispatch admission, excluding transport/disclosure latency. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/progress-truthful-1112-PROGRESS.md
Decision: progress-truthful-fallback | Fresh session observation without observable tool supports only fixed liveness, once per operation/claim/baseline, with ten-second freshness and existing stop/end guards. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/progress-truthful-1112-PROGRESS.md
Decision: progress-truthful-evidence | Build message 785's supplied incident shape through the actual writer. Tool bytes/timing are explicitly constructed neighbors because the brief supplies no captured admission. Preserve and rerun existing captured native/6234450 and model-output replays. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/progress-truthful-1112-PROGRESS.md
Prompt review: progressReplies describes the actual automatic quoted-request and fallback path; no model judgment or parser changed. Existing recorded summary writer/uncertain, Jev undecided/unsure, reply-review, delivered-reply and empty-context controls run through the writer with actual native tool admission bytes. Empty context is not claimed as a captured delivered empty Telegram bubble. The message-785 test identifies exactly which supplied facts are recorded and which tool sequence is constructed.
Prompt finding: 105c1569b6bb | protocol-literal | Existing unchanged journal guidance or fixed lifecycle notice; this change adds no fixture phrase to a judgment.
Prompt finding: 4106b49fff07 | protocol-literal | Existing unchanged journal guidance or fixed lifecycle notice; this change adds no fixture phrase to a judgment.
Prompt finding: 7ef11b68103f | protocol-literal | Existing unchanged journal guidance or fixed lifecycle notice; this change adds no fixture phrase to a judgment.
Prompt finding: 849db3a6296a | protocol-literal | Existing unchanged journal guidance or fixed lifecycle notice; this change adds no fixture phrase to a judgment.
Prompt finding: 85544c20941f | protocol-literal | Existing unchanged journal guidance or fixed lifecycle notice; this change adds no fixture phrase to a judgment.
Prompt finding: 9f0106c66027 | protocol-literal | Existing unchanged journal guidance or fixed lifecycle notice; this change adds no fixture phrase to a judgment.
Prompt finding: bac6ce7485d9 | protocol-literal | Existing unchanged journal guidance or fixed lifecycle notice; this change adds no fixture phrase to a judgment.
Prompt finding: e8708c7fea24 | protocol-literal | Existing unchanged journal guidance or fixed lifecycle notice; this change adds no fixture phrase to a judgment.

1.x comparison: actual JKHeadley/instar main 648800021a7e584375b5458eefdc0ad72f922640; searched src/, docs/specs/ and git history. AutonomousProgressHeartbeat.ts uses observed output/focus, sparse 25/40/60/90-minute backoff, cap six and one-voice ownership; PresenceProxy.ts uses post-message activity, 20s/120s/300s tiers and bounded 600s rechecks, with LLM summaries. HONEST-PROGRESS-MESSAGING-SPEC.md rejects manufactured narration and stale frames as progress. History inspected: 753857c0e, 7779f8a9a, 8d81ecb24, e1ff0d2d2. Carry evidence, sparse bounds, end guards and unique sends through the existing 2.0 journal; independent 1.x monitors/stores/LLM calls do not fit its unified signed send path. ONEX-LESSONS local cached index /tmp/train242-onex.md, section 2: distinguish live/idle/dead, measure actual session progress, and never treat old throttle/output as current activity. No 1.x runtime code is transplanted because 2.0 already supplies these mechanisms; the defect is discarded observation text and first-note delay.

## Closing block

simplestRobustRoute: reuse the existing admission reader, fresh session observations, progress timer and durable sender. This is the simplest route; no new monitor, model call, store or authority. Optional request evidence makes truthfulness explicit without reinterpreting stored replay. Stable fallback identity prevents repeated generic chatter and cross-turn suppression. Start requires admitted unanswered work and fresh observation; end is answer dispatch/session end/stop/expiry/ownership loss; limits remain reply allowance, four notes, bounded text, freshness and widening cadence. This is a builder submission, not a claim of unattended deployment or live acceptance.
Register regeneration: scripts/build-register.mjs --commit 0f0bc16395502cbc70a2746c203f663e944e729f --replay refreshed eight generated outputs from committed source. Cached desk rehash/repin scripts changed no owner manifests or inventory bytes; no native certificate or declaration was changed.

Additional consumer evidence: captured failure-hook records retain their failure outcome; assertions now distinguish a fresh generic session fallback from an active tool claim.

80/20: narrow product change with recorded-shape writer tests and direct consumer checks; independent review repaired two concrete gaps, then found no further product defect. Desk owns full native/live gate.
VERDICT: author submission; independent landing review pending

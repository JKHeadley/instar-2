# Change review — durable revival after capacity refusal

Subject base: 14aaecc7d23d192add125c447d49120d9aa9a95e
Review state: frozen
Reviewed content: sha256:6a3f7f5f6cf6a1e32359f05d3e0aeaab53c3ed47855f8237aa5ceffe989faee8
Outcome: Carryover row 03 retains a proven-safe lost-worker revival when replacement capacity is unavailable. The original delivery, deadline and allowance survive host restart. The behavior inventory explicitly separates this implemented repair from the complete 1.x parity assessment; no full parity or live claim.
Affected rules: 1, 4, 26, 28, 29, 34, 36, 37, 46, 49, 55, 60, 61, 63, 68, 70, 74, 101, 102, 111, 112, 113, 114, 116
Affected floors: secrets — no new credential surface; spend cap — cumulative liability and original deadline survive replacement; stop — checked before replacement and every observation; no duplicate sends — unknown effects and interrupted launch remain uncertain; durable intake — original request and delivery retained in existing host-owned custody.
Operator questions: none
Suggested tier: critical
Declared tier: critical
Tier rationale: Changes the recovery dispatch boundary and durable queue semantics. Offline tests cannot establish live recovery.
Side effects: A safe revival previously settled uncertain on capacity refusal now stays queued. It remains head-of-line under the existing FIFO ordering. The resource hold retries at the source drainer's 60-second cadence until the original lifetime ends; capacity does not consume failed-spawn attempts. A current grant or binding change retains uncertainty rather than replaying stale work. The distinct revival-queued state prevents an older runner from draining this row as fresh input; rollback retains it for reconciliation.
Undo and recovery: Stop the host before reverting. Preserve conversation custody and journal files. Any pending revival-queued row remains held for reconciliation by an older runner, whose drain only accepts queued rows. Completed results and uncertain effects are never replayed.
Multi-machine posture: Existing host-owned conversation state and ownership fencing serialize writers. A queued revival binds parent, owner, placement and working scope. A different machine cannot consume it as a local permission. No cross-machine takeover authority or replicated store is introduced.
Layer below: Read the three full 1.x recovery sources at 4f88880a45f0a119aae3cfd2ccaf9ace26d405b9, production queue wiring and mechanical recovery wiring in server.ts, SessionMonitor calls, and legacy test inventories. Inspected 2.0 conversation retirement, cumulative admission, adapter restoration and production driver exact accepted-intake checks, host resource owner, journal recovery, and host-watch. The resource owner's null result proves no replacement launch; an exception does not. Detailed comparison lives in docs/implementation/carryover-03-full-parity-1104.md.
Bug class: unit
Bug evidence: reproducer=tests/assembly/production-conversation-session.test.ts
Hook bypass: none; core.hooksPath unset; common hooks directory contains only samples.
Convergence: none
Prompt review: No prompt wording, parser or model choice changed. Recovery admission changed, so tests replay captured summary-writer, Jev, reply-review, delivered-reply and empty-bubble shapes through the new queued-revival path using the existing recorded fixture corpus; opaque bytes remain identical and empty output stays uncertain. This is offline replay, not a live proof.

Prompt finding: 0725f0150c56 | quoted-evidence | Existing unchanged role briefing and its prologue fixture; this repair changes recovery dispatch, not model authority or prompt text. The phrase is not used as a semantic recovery trigger.
Prompt finding: 27d7720e7977 | protocol-literal | Existing unchanged prologue boundary used to extract the briefing in its test. No new keyword decision or prompt wording is introduced.
Prompt finding: 85544c20941f | protocol-literal | Existing unchanged retained-message outage notice and output assertion; recovery does not use this sentence as permission to dispatch or send.

Decision: CARRYOVER-03-FULL-1104-1 | Port the resource-held revival into existing ConversationInput custody, with original delivery and authority binding, instead of introducing another queue/store/timer. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/carryover-03-full-parity-1104-PROGRESS.md
Decision: CARRYOVER-03-FULL-1104-2 | Keep 1.x resource holds distinct from failed launches: retry capacity at 60 seconds, bounded by the original lifetime; never retry an unknown launch or replenish allowance. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/carryover-03-full-parity-1104-PROGRESS.md
Decision: CARRYOVER-03-FULL-1104-3 | Keep full parity and row 03 OPEN wherever the behavior inventory lacks implementation or evidence; passing the scoped repair tests is not full parity. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/carryover-03-full-parity-1104-PROGRESS.md

simplestRobustRoute: Use the existing durable input queue, owner tick, exact retirement, host admission and original accepted delivery. Add only a retained revival record to distinguish a proven no-launch resource hold from an interrupted dispatch. That distinction prevents both silent abandonment and duplicate replay. Start guards are current ownership/grant, stop, deadline, spend and known effects; end guards are correlated reply/turn-end and retained uncertainty. No unattended shipped-path success is claimed.
80/20: Two new reproducer cases failed before the repair. Decision-neighbor and recorded-shape tests exercise the new queue path. A strengthened missing-proof/batching assertion failed before the batching-state guard and verifies uncertainty rather than a misleading queued status. Remaining full-parity gaps stay named in the inventory rather than being hidden by this repair's passing tests.
VERDICT: author submission; independent judgment not asserted.

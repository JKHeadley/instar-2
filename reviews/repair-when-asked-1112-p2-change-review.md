# Change review — repair-when-asked-1112-p2

Subject base: 8e40223085b2680b9bb22ce2c6a9f3b529cb0b14
Review state: open
Reviewed content: none
Outcome: When the agent reports stuck work, it can request a once-only earlier held-reply preparation and unfinished-work attempt through the existing runner; unknown outcomes remain unrepeated.
Affected rules: 4, 8, 10, 23, 26, 46, 55, 57, 60, 61, 68, 74, 84, 88, 101, 102, 113, 116, 123
Affected floors: secrets — existing redaction and outbound checks; spend cap — existing reservations and obligation capacity; stop — existing gates plus admission checks; no duplicate sends — no unknown call or intent replay; durable intake — retained journal records and existing queues
Operator questions: none
Suggested tier: critical
Declared tier: critical
Tier rationale: Changes durable scheduling and model declarations while retaining existing authorities and execution paths.
Side effects: Pending work requests compare durable attempt counts, not timestamp inequality; equal-clock slots wait the next millisecond through the existing scheduler. The repair offer yields before required obligation evidence under byte pressure (journal-obligations cadence regression verified). Eligible work may spend its existing allowance earlier. One reply preparation can be advanced, with a durable consumption marker. Later turns can pass a preparation-held turn, but memory/correction ordering gates remain. Unknown and previously requested items are still visible; eligible items rank first in the bounded offer. No new external powers or notifications.
Undo and recovery: Revert removes acceleration. Existing durable model/send reservations remain authoritative; retain journal bytes. Optional answer/hold fields leave legacy replay unchanged and add no new record kind or store. A crash after request retains queued work; a crash after consumption never replays an external effect.
Multi-machine posture: Uses the existing single-owner journal and runner execution boundary. No peer dependency, alternate sender, or new store. Requests and consumed attempts follow existing replay/snapshot and journal ownership transfers.
Layer below: Inspected projectObligationWork reserve accounting, schedulePromise recoveryHeld and inFlight fences, drainTurns hold/reservation handling, exact operator grounding, cancellation projection, packet trimming, work capacity and the model/send gates.
Bug class: unit
Bug evidence: reproducer=tests/preview/self-repair-request.test.ts
Hook bypass: none
Convergence: none
Decision: repair-request-existing-queues | Carry 1.x bounded self-unblock behavior through optional durable answer requests and existing 2.0 queues, not new repair powers | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/repair-when-asked-1112-p2-PROGRESS.md
Decision: repair-request-scope-and-once | Restrict to eligible same-conversation operator items, preserve unknown outcomes, consume acceleration once, and let cancellation win; attempt-count identity keeps equal clock readings from silently consuming a request | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/repair-when-asked-1112-p2-PROGRESS.md
Team posture: Existing verified operator and conversation checks determine visibility/action. No team grant is widened; other conversations and unverified senders receive no repair options. This preview follows its existing operator-only journal model; no new single-person store is introduced.
1.x comparison: Researched JKHeadley/instar main 6dbe9535b4c82eb71887df62f3b56db1baa8aa99: src/monitoring/StallTriageNurse.ts treatment/verification/silent respawn; src/messaging/DeliveryRetryManager.ts bounded retry and manual-cycle latch; src/scaffold/templates.ts Self-Unblock and Self-Diagnosis; docs/specs/self-unblock-before-escalating.md existing BlockerLedger design. History 8d81ecb24, e7d875b69, 5129779c3; ONEX-LESSONS sessions/recovery and wiring-integrity lessons. Carry the behavior, not tmux managers: the 2.0 journal already owns exact reservations, scope and effect uniqueness.
Independent second pass: repair_review concurs after a repair round; source/test inspection only, no test execution. Desk/Astra review remains separate.
Prompt review: Model-facing. Round 2 explicitly authorizes recorded-shape journals for message 828, 2026-11-12 17:16 PST: held reply, unfinished work and unknown outcome are written by the real journal writer. The real worker consumes the model declaration and runs existing queues. Tests include stop, expiry, caps, repeated asks, replay, cancellation and candidate crowding. No private live journal or live-provider result is claimed.
Prompt finding: 105c1569b6bb | protocol-literal | Unchanged existing runner wording; this change adds no literal user-question trigger. Source: fixture-phrase tests/preview/journal.ts <- tests/preview/closing-notice-boundary.test.ts: "once stopped, this installation refuses renewal."
Prompt finding: 4106b49fff07 | protocol-literal | Unchanged existing runner wording; this change adds no literal user-question trigger. Source: fixture-phrase tests/preview/journal.ts <- tests/preview/topic-awareness.test.ts: "you attempted nothing outside this reply, so never call an avenue tried; a missi"
Prompt finding: 7ef11b68103f | protocol-literal | Unchanged existing runner wording; this change adds no literal user-question trigger. Source: fixture-phrase tests/preview/journal.ts <- tests/preview/closing-notice-boundary.test.ts: "after that it cannot read or answer messages here. its activation must be renewe"
Prompt finding: 849db3a6296a | protocol-literal | Unchanged existing runner wording; this change adds no literal user-question trigger. Source: fixture-phrase tests/preview/journal.ts <- tests/preview/journal-memory-list.test.ts: "i have no active saved memory items"
Prompt finding: 85544c20941f | protocol-literal | Unchanged existing runner wording; this change adds no literal user-question trigger. Source: fixture-phrase tests/preview/journal.ts <- tests/preview/journal-conversation-session.test.ts: "your messages are kept and i'll answer them then; you don't need to resend them."
Prompt finding: 9f0106c66027 | protocol-literal | Unchanged existing runner wording; this change adds no literal user-question trigger. Source: fixture-phrase tests/preview/journal.ts <- tests/preview/plain-task-stop.test.ts: "the reason is unknown. your request and this incomplete attempt are saved. this "
Prompt finding: bac6ce7485d9 | protocol-literal | Unchanged existing runner wording; this change adds no literal user-question trigger. Source: fixture-phrase tests/preview/journal.ts <- tests/preview/plain-task-stop.test.ts: "work on your request stopped before a finished answer was available."
Prompt finding: e8708c7fea24 | protocol-literal | Unchanged existing runner wording; this change adds no literal user-question trigger. Source: fixture-phrase tests/preview/journal.ts <- tests/preview/hallucinated-memory-rate.test.ts: "cite sourcelabel; disclose unknown sources."

Subject (2 paths): tests/preview/journal.ts, tests/preview/self-repair-request.test.ts

## Closing block

simplestRobustRoute: This is the simplest robust route: optional fields on existing answer and hold records drive the existing drain and obligation schedule. No second scheduler, recovery model, authority or effect path. The durable once-only marker prevents repeated accelerated retries; the packet and recorded host outcome make the action available and truthful. Start and end guards remain verified operator scope, cancellation, stop, expiry, exact recorded outcome, reservation, spend and delivery limits. This is builder evidence, not an unattended live deployment claim.
80/20: Runtime remains below 120 changed lines. Eight generated projections refreshed by build-register.mjs against 99f6ddc99; 308 entries, 123 rules, 34 terms and 115 prerequisites. Under 120 changed product lines. One independent reviewer found cancellation, expiry and candidate crowding issues; the repair round addressed all and added corresponding tests. The reviewer concurs after reading the final source/tests; no independent test run or Astra gate verdict claimed.
VERDICT: author submission; this record asserts no independent verdict — the review desk records its own

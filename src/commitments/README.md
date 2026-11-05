# Commitments

Row 01's carried modules: `CommitmentTracker` (typed commitment lifecycle, setting watches, behavioural rules, Threadline replies, probes, blocker episodes, stale-item review), `PromiseBeacon` (cadence, risk, suppression, revival ladder, typed delivery, per-topic aggregation, external-wait surfacing) and `CheckInReminderReconciler` (a dated check-in). All copied from 1.x at `4f88880a45f0a119aae3cfd2ccaf9ace26d405b9`; the commit history from the raw baseline commit is the adaptation.

The core has no ambient clock, timer, file or log. `ports.ts` is what it needs; `tests/preview/commitment-host.ts` binds that to the owner journal on the runner's own tick. There is no process timer and no second store. Journal reply promises stay the journal's; open ones are mirrored one way under `commitment:<id>`.

Removed from 1.x on purpose, each with a test on the other side:

- Delivery backfill of legacy rows, because a row never closes as delivered without a receipt (Rules 26, 42, 68).
- Timer closure of behavioural rules and setting watches (Rule 93). `CommitmentTracker.isDirective` guards every timer path. Other rows may still expire or be swept, with their disposition recorded.
- Phrase sniffing for time promises (Rule 10). The model declares a horizon; `cadenceForHorizon` keeps the tuned numbers.
- Send-before-stamp check-ins. The start is durable, a definite failure retries within the cap, and an unknown result is settled by its receipt and never sent again.
- The observe-only self-action governor and the signal-only identifier-leak pass. The cadence clamp and per-topic aggregate bound the beacon (Rule 61); the outbound doorway owns outbound checks.

`tests/preview/commitment-send.ts` binds eligible infrastructure notices to the worker's outbound boundary. Part 18 section 6 and Rules 53/87/88 require a separate owner-approved finding, read at dispatch: a stable causal episode, exact text, fresh concrete-result or human-required-action evidence and, for an internal issue, an eligible failed self-heal. `commitment-notice-contract.ts` describes that producer port; it is no commitment store. The destination must be the current declared alerts topic and differ from the originating conversation. The exact effect-policy grant for that alerts topic is also required. The intent retains the finding before transport; only a durable receipt reads as delivered. Unknown outcomes remain owned and are never repeated, including replay of older intents without a contract.

The bound host keeps the carried beacon's cadence and observation-only mode, and scans due check-ins on the first tick and every five minutes. Dates and observational heartbeats never push or spend a send attempt, regardless of a generic grant. The latest check-in observation is available in the host report. Explicitly requested reminders and results use the existing Five-owned source-bound request and Eight reply path (`owedResultAuthority`, `sendRequested` in the journal), rather than turning infrastructure text into agent speech or creating a second delivery identity. The send-contract tests and `owed-delivery.test.ts` cover both routes and their refusal neighbors.

No live notice producer or commitment grant is installed by this slice. Producer wiring, the grant surface, attention and live proof are separate row 01 work; row 01 remains open.

The status line is 2.0's own wording: 1.x never wired its hook. It is a reserved call recorded at the model boundary, and it only runs where a session frame exists to read, which the one-shot runner does not provide yet.

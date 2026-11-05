# Commitments

Row 01's carried modules: `CommitmentTracker` (typed commitment lifecycle, setting watches, behavioural rules, Threadline replies, probes, blocker episodes, stale-item review), `PromiseBeacon` (cadence, risk, suppression, revival ladder, typed delivery, per-topic aggregation, external-wait surfacing) and `CheckInReminderReconciler` (a dated check-in). All copied from 1.x at `4f88880a45f0a119aae3cfd2ccaf9ace26d405b9`; the commit history from the raw baseline commit is the adaptation.

The core has no ambient clock, timer, file or log. `ports.ts` is what it needs; `tests/preview/commitment-host.ts` binds that to the owner journal on the runner's own tick. There is no process timer and no second store. Journal reply promises stay the journal's; open ones are mirrored one way under `commitment:<id>`.

Removed from 1.x on purpose, each with a test on the other side:

- Delivery backfill of legacy rows, because a row never closes as delivered without a receipt (Rules 26, 42, 68).
- Timer closure of behavioural rules and setting watches (Rule 93). `CommitmentTracker.isDirective` guards every timer path. Other rows may still expire or be swept, with their disposition recorded.
- Phrase sniffing for time promises (Rule 10). The model declares a horizon; `cadenceForHorizon` keeps the tuned numbers.
- Send-before-stamp check-ins. The start is durable, a definite failure retries within the cap, and an unknown result is settled by its receipt and never sent again.
- The observe-only self-action governor and the signal-only identifier-leak pass. The cadence clamp and per-topic aggregate bound the beacon (Rule 61); the outbound doorway owns outbound checks.

Beacon output is off unless explicitly enabled (Rule 87). With no send bound, every send is a definite refusal, recorded and never a delivery.

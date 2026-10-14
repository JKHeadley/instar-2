# Rolling summary producer: extraction plan

Tracking key: journal-read-port-1013-summary. Owner: the journal-read-port follow-on
builder, scheduled by the desk before step6-grounding consumes long histories.
Exit test: given a fixture journal and target message K, one bounded background invocation
records a faithful accepted summary through K; the read port sees its exact coverage after
reopen. Failure, an uncertain paid-call outcome, stop, insufficient budget and unknown earlier outcomes leave
the accepted frontier unchanged and preserve the source messages and recorded attempt.
Review cadence: at that unit's start and gate, and when the desk schedules step6-grounding.

The current producer is not just a summarizer callback. `tests/preview/journal.ts`
`runSummary` (line 9931 at base 4a5a9628) and `summarizeIfNeeded` (10545) own target
selection, prompt bounds, durable reservations, unknown-call recovery, bounded retry spans,
memory corrections, source-linked items, supervision and commit. `journal-agent.mjs`
status lines 929–932 derive `summaryThrough` from `liveSummaries` and
`lastSummaryFaithfulness` from the accepted summary or the last failed attempt. Those
are the existing consumer checks, not new parallel status fields.

The simplest extraction is one bounded `produceRollingSummary(through, ports)` operation
in `src/recall/rolling-summary.ts`, invoked by the existing owner's background work tick.
Do not create a timer, queue, summary database or new retry authority. Keep the encrypted
journal reader/writer and physical model/clock bindings beside the current host. Move the
pure transition orchestration and these existing pure helpers into src, leaving compatibility
re-exports so the current driver and tests use the same implementation:

1. `summary-faithfulness.ts`: `exactSummaryFaithfulness`,
   `summaryFaithfulnessEvidence`, the faithfulness question and Jev verdict/usage decoding.
   Exact preservation can pass; otherwise the existing full-context cascade decides.
2. `summary-check.ts`: the integrity question and its typed verdict decoding. Preserve
   uncertain/undecided/unavailable distinctions, including escalation to the existing
   subscription review. No regex or word-match fallback decides semantic faithfulness.
3. The minimal `runSummary` transition from an already selected frontier to commit. Its
   owner port supplies the accepted previous summary, complete uncovered history, active
   memory, corrections, open obligations and exact K. Keep the existing source validation
   for memory items, corrections and closures with the journal owner until that owner moves.

The injected ports must provide: an atomic owner snapshot; a stopped check; clock/elapsed
reads; bounded prompt encoding; the existing journal append methods; the already metered
summary writer and faithfulness/review doorways; and the owner's reservation/admission
operation. A reservation is durable before each paid call, and remains charged when its
outcome is unknown. Recheck stop and owner revision after every await. A changed history,
correction, retraction or ownership fence makes the candidate stale; preserve the attempt
and rebuild through a fresh tick, never commit it against another prefix.

Preserve the existing frame protocol: `summary-reserve`, `summary-candidate`,
`summary-faithfulness-reserve`, `summary-faithfulness`, `summary-check`,
`summary-review-reserve`, and terminal `summary` / `summary-failed` / `summary-uncertain`.
The same append path must continue enforcing reservation-before-summary and the required
supervised pass. Pass the accepted faithfulness result and exact coverage with the summary;
do not extend coverage because a newer message arrived during a call. Existing two-attempt
per-span and UNKNOWN recovery rules remain with the owner. Expose no raw append capability
to a session and add no sending route.

Acceptance evidence, before claiming the producer is on:

- Reuse `summary-faithfulness.test.ts`, `summary-check.test.ts`,
  `summary-cascade-stall.test.ts` and `journal-correction-faithfulness-wedge.test.ts`
  where applicable; replay real captured writer outputs (including uncertain), Jev's
  confident/undecided cases, subscription reviews and empty delivered replies. Record
  the source file, update IDs and which transition fired. Current read-port fixtures
  prove reads of recorded conversation shapes, not these producer decisions.
- Exercise exact-pass, paraphrase-pass, loss, undecided escalation, unavailable, malformed,
  oversize, exhausted spend and stop before/after a call. Check frontier and preserved input
  on both sides. Reopen between reservation, candidate, review and commit; UNKNOWN paid
  calls must not be launched again. Refresh during a call to prove stale-candidate refusal.
- Drive the existing background tick unattended on a copied journal through the actual
  admitted model doorway, then reopen and verify `summaryThrough`,
  `lastSummaryFaithfulness` and the new port's `coverage`. No operator journal, serving
  login or outbound Telegram message is needed. The desk arranges the approved proof room.

Part 1 intentionally leaves this protocol in its current owner. Extracting just the happy
path would duplicate acceptance authority and lose the correction, spend or UNKNOWN floor;
copying the whole journal into src would violate the brief's simplest robust route.


## Extraction implementation

Unit `summary-producer-1013` implements the selected-frontier transition in
`rolling-summary.ts`; the current background tick invokes it through injected ports.
The pure faithfulness, integrity and shared JSON decoders live beside it, with compatibility
exports at their former locations. Journal-specific decoding and correction validation,
source selection, retry accounting and physical model bindings remain with their owner.
New summary frames carry exact message coverage verified by the existing read adapter.
The unit tests and encrypted recorded-walk reopens exercise that consumer, including
staleness, structural refusal and faithful uncertainty. Captured writer and review outputs
are exercised by the existing summary-cascade regression tests. The desk owns the approved
proof-room live-provider run; this extraction does not claim live-user acceptance.

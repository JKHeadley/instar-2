# Change review — cint-L24 repair: the owner is lost only after its first receipt reached the standby; a clean end drains

Subject base: b5e5baa5371754b14f082f53065e5c47f3e27709
Review state: open
Reviewed content: none
Outcome: The studio gate's one failure (tests/preview/two-machine-runner.test.ts "the owner machine is lost", final unknownSends 1) is repaired. Root cause, from diagnostics on a reproduced failing run: the UNKNOWN was the FIRST reply, not the second. The case SIGKILLed the owner once the shared cursor passed update 1, but the cursor passes an update when its intake record is replicated; the send's receipt is appended after Telegram accepts the send (and after the authority records the claim outcome) and reaches the standby on a later pump. A kill in that window leaves the survivor's adopted copy with the intent and no receipt, which it correctly reports as UNKNOWN and never re-sends (Rule 42); the survivor's own status already showed unknown 1 before it was stopped. The runner was right; the case lost the owner earlier than its own premise ("the first exchange is in ITS journal now"). The case now waits until the owner recorded the receipt and the standby's acknowledged copy is the owner's whole journal before the SIGKILL, and asserts unknownSends 0 on the survivor right after takeover. Separately, a clean stop pumped the journal once: a pump returns a run already in flight, sends nothing inside the backoff an earlier failure set, and gives up after one failed request, so a successor could adopt a copy without the last records. JournalShipper.drain runs at most three pump rounds (backoff ignored only for this clean end) and journal-agent's clean stop uses it; tests/preview/journal-replication.test.ts proves both sides (a single pump in the backoff ships nothing; drain ships everything and the copy replays to the owner's history; an already-covered drain asks nothing; a peer that stays gone ends after exactly three attempts). Register replayed at 2ed36e93 (1ac982fa).
Affected rules: 42 (an UNKNOWN send is never re-sent; the honest unknown on a too-early loss is preserved, not masked), 31 and 63 (one owner, fenced; unchanged), 113 and the purpose's replicated(1) default (a clean hand-back now carries the whole journal), 55 (the serving loop's backoff is unchanged; only a clean end makes its few bounded attempts), 37 (fixed at the source of the false expectation, no quarantine), 69 and 90 (register replayed from committed sources), 74 (this record), 116 (one bounded loop over the existing pump; no new store, protocol message or authority path)
Affected floors: secrets — unchanged; spend cap — unchanged (no model call); stop — unchanged (the drain is bounded at three pump rounds; each peer request inside a round is bounded by the existing 5 s timeout, but a round sends one request per 256 KiB chunk and the drain first awaits any pump already in flight, so its total duration depends on the journal bytes still unsent and is not bounded by 15 s); no duplicate sends — unchanged (dispatch-claims and receipts untouched; a missing receipt is still UNKNOWN and never re-sent); durable intake — unchanged (no record kind added; the drain only ships committed bytes earlier)
Operator questions: none
Suggested tier: critical
Declared tier: significant
Tier rationale: a test-timing correction plus a bounded retry of the existing shipper pump on the clean-stop path; no new record, store, gate, prompt or authority.
Side effects: a clean stop of a two-machine owner may take up to three pump rounds before it releases the lease; each request is bounded by the existing 5 s peer timeout, while the total grows with the unsent bytes (one request per 256 KiB chunk) and any pump already in flight.
Undo and recovery: revert 2ed36e93, its register replay 1ac982fa and this record to return to b5e5baa5. Nothing persisted differs.
Multi-machine posture: two-machine replicated(1) serving; the drain runs only on the owner's clean end, before the lease is released.
Layer below: tests/preview/journal-replication.ts createJournalShipper (pump, covers, backoff), createReplicatedDispatch.settle (the cursor waits for the intake record only), tests/preview/journal.ts dispatch/push and the receipt append after the send port returns (read, unchanged), tests/preview/journal-agent.mjs enterShared.stop
Bug class: integration
Bug evidence: reproducer=tests/preview/two-machine-runner.test.ts
Hook bypass: none
Convergence: none
Decision: cint-L24-repair-loss-after-receipt | the case waits for the standby to hold the owner's whole journal before the SIGKILL; not chosen: settling the cursor only after the receipt replicates (a kill between Telegram acceptance and the receipt write would still be UNKNOWN, which is the correct honest outcome, so it would only move the window) | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/cint-L24-PROGRESS.md
Decision: cint-L24-repair-clean-drain | a clean stop drains with at most three attempts, ignoring the serving backoff only there; not chosen: an unbounded wait for the peer (a stop must stay reachable) | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/cint-L24-PROGRESS.md
Prompt review: no prompt text changed.
Deferral: generated/register.json:1 | not-a-deferral=generated register output quoting the rule book, not a commitment by this change

Subject (11 paths): generated/capabilities.json, generated/capabilities.md, generated/coverage.md, generated/glossary.md, generated/register.json, generated/rules.md, generated/source.json, tests/preview/journal-agent.mjs, tests/preview/journal-replication.test.ts, tests/preview/journal-replication.ts, tests/preview/two-machine-runner.test.ts

## Closing block

simplestRobustRoute: this is that route: the case waits for the state it already claims, and the clean stop reuses the existing pump in a three-attempt loop; no new store, message or authority.
80/20: 0 must-fixes, 1 note (targeted tests only, no full suite on this machine, per the operator's rule tonight; the failing combination ran green 4 of 4 after the change, against 2 failures in 6 before)
VERDICT: author submission; the independent verdict is recorded as a pass

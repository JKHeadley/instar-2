# Memory sentinel case: re-diagnosed as a recall regression, not a timing flake (Rule 37 quarantine)

**Status:** CLOSED 2026-09-29 (cint-L4 pipeline repair, Astra MUST-FIX 2). Repaired at its source, the skip
removed; see "Closure" at the end. **Owner:** the recall/packet owner of `tests/preview/journal.ts`. **Opened:** 2026-09-26.

## What this record said before, and why it was wrong

This record described the case `grounds a later pronoun question in an early summarized turn across a restart,
with bounded overhead` in `tests/preview/memory-sentinel.test.ts` as a *timing* flake: it failed a timing bound
while nine files ran in parallel, and an isolated rerun passed 6/6 with a reported p95 of 28 ms.

Under U6 (make the preview load-timing flakes load-independent) the case was un-skipped and run. It **fails
deterministically in isolation on unchanged test code**, and it fails on a semantic assertion, not a timing one:

```
FAIL tests/preview/memory-sentinel.test.ts > grounds a later pronoun question in an early summarized turn ...
AssertionError: expected [ …(5) ] to include 'Note for later: my sister Maya loves …'
  ❯ tests/preview/memory-sentinel.test.ts:298
```

Isolated run (`--maxWorkers` default, this file only, load about 40): `Tests 1 failed | 17 skipped`, 75.68 s.
The timing assertions in the body are never reached, so the earlier "timing flake" framing cannot be confirmed
from this tree at all — and the 2026-09-26 isolated pass shows the case did work then, so this is a regression
that landed afterwards and was invisible for two days *because* the quarantine hid it.

## Diagnosis

At turn 200 the packet the worker builds carries `recalled` = updates 17, 77, 137, 189, 193 — five copies of the
same generic filler text — and not update 3, the fact the pronoun question depends on. The preceding turn 199
("Maya's birthday is next Saturday…") *does* recall update 3, so update 3 is a live candidate at that point;
`summaryThrough` and `compactedThrough` are both 196, so nothing has evicted it.

The sentinel itself is correct. Called directly with the same 196-candidate set, the same pronoun question and the
same `previous` turn, `selectRecall` returns **exactly** update 3 and nothing else:

```
selectRecall -> [ 'te:3' ]      contains fact (turn 3)? true
```

The worker does pass `previous` (`tests/preview/journal.ts:3285-3286`). What sits between that correct lexical
result and the packet is the `ownedRecall` re-ranking added by `98194851` ("cbuild-2 repair 1: recall through its
owner"): `journal.ts:3228` (definition) and `journal.ts:3288` (the call that replaces `lexical` with `ranked`).
The contextual hit is present before that step and absent after it.

**Not yet proven:** `ownedRecall` is an inner closure of `createJournalWorker` and is not exported, so it could not
be exercised in isolation here. The evidence localizes the loss to the `lexical` -> `ownedRecall` -> `ranked` step
(including the `texts`/`indexable` inputs built for it at `journal.ts:3288`); it does not yet single out the line.

## Where the fix lives

In `tests/preview/journal.ts`, which unit U6 does not own (hub owner: U4). U6 therefore did **not** repair this and
did **not** close this record. A pronoun question that cannot reach the one fact that answers it is a product
defect, not a test-fixture detail: this is the memory sentinel's stated purpose.

## Disposition

The exact case stays visibly quarantined with `it.skip` and a comment naming this record and the true cause. Its
body, semantic assertions, timing assertions and thresholds are retained. The other memory-sentinel cases remain
active, including the sibling `retains a contextual source when incidental direct matches fill the recall slots`,
which covers contextual recall at 40-turn scale and passes.

**Repaired in this case's body while it is quarantined (U6, load-independence):** the growth assertion now compares
the **median** of the first and last ten turns instead of a "p95" of ten samples, which is their maximum, so one
scheduler stall under parallel load decided it (the same repair already made in
`tests/preview/journal-assembled.test.ts`; see `full-suite-load-timeouts.md`). The 2000-candidate sentinel step is
sampled as consumed CPU time rather than wall clock, with the wall p95 printed beside it. Both retained thresholds
(growth 1 000 ms, step p95 250 ms) are unchanged. These repairs are in place for whoever closes the recall defect.

**While quarantined, the gate does not prove** cross-restart grounding of a pronoun question in an early
summarized turn, nor its per-turn overhead bounds. Report a green gate as green with this Rule 37 quarantine named.

## Repair and closure

Repair the recall loss at the `ownedRecall` step, remove the skip, and show the retained semantic assertions and
the repaired (load-independent) timing assertions passing under parallel gate conditions. An isolated passing
rerun alone cannot close this record.

**Multi-machine posture:** The test fixture is machine-local. This record and the quarantine travel with the
repository.

## Closure (2026-09-29): the localization above was wrong

Astra's cint-L4 review showed the `ownedRecall` localization was inaccurate: the **lexical** list already omitted
turn 3, and `ownedRecall` only preserved that list. The cause was the recall scoring input. The preceding-context
string and each candidate's text used the full sent reply, which includes the generated Rule 110 compaction
disclosure (with its date and turn numbers). Those generated words distorted the contextual ranking, so turn 3
lost its slot to filler turns.

**Repair:** in `recallFor` (`tests/preview/journal.ts`), the two reply-text inputs to recall scoring now use the
existing `replyBody()` normalization (the reply without its Rule 110 disclosure). The sent text and its disclosure
are unchanged everywhere else. No reranker, model call or classifier was added.

**Evidence:** the case is restored as `it(...)` with every original semantic and timing assertion. It passes
in isolation (`--maxWorkers 1`), and the 26 other recall/continuity preview test files still pass. The full gate
re-runs it under parallel conditions after the push.

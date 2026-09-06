# Judgment doorway — one-question reference slice

`createJudgmentDoorway` consumes genuine P1 decoders, P2 signed facts/capture statuses,
and six's merged reservation/claim implementation. Its returned `RecordedAnswer` is
not five's run acceptance and never business-effect permission.

`judge(question, fence)` records one question and five immutable attempt phases,
then one resolution. Exact provider-formatted input and admitted response bytes,
plus bounded actual-usage observations, are retained locally. Shared facts contain bounded metadata and captured
references, P1 observation Evidence, uncertain Outcome, Result and decoded Decision.
Reason/conclusion use P1's separate claims; the output cannot widen the host floor.
The accounting phase observes the provider receipt. Unknown charge remains null;
reported charge uses the same synthetic credit unit as six's fixture budget, not
invented dollars or a zero subscription price. No code here releases that budget.

The approved names are `JudgmentRequest`, `JudgmentAttemptRecord`, and
`JudgmentResolution`; the brief's question/attempt wording is not an alternate type.
The host supplies five's stable semantic-message reference and eight's EffectRequest
reference. The reference fixture substitutes explicit foreign references, not owner
implementations. Six alone derives operation identity. Its existing reserve call
creates mapping and reservation together, so the prepared attempt explicitly omits
operation/reservation. Dispatch-observed durably links six's **consumed-claim**
fact inside the guarded callback, after consumption and before provider invocation.
A prepared reservation or issued-but-unused claim is not a handoff. SDK no-call
and claim refusal leave no dispatch observation. An interrupted handoff append
retains consumed exposure and prevents invocation/retry. A handoff phase is still
not a claim that the provider received bytes or returned an answer.
No duplicated operation-ID derivation or fabricated future provider ID exists.

`createModelAdapter` implements ten's describe/prepare/exchange contract for an
injected deterministic provider. Prepare does no I/O. SDK automatic retries must be
zero; the SDK receives only a callback whose first actual invocation consumes six's
claim. Overlap, hidden retry after known rejection/timeout, and a retained callback
after exchange return cannot invoke again. The client never receives an unguarded
provider transport. This reference boundary plays the narrow executor role; it is
not a shipped eight-owned effect admission/settlement implementation or credential
isolation proof. A real provider is deliberately not wired into the reference host.

Every observation is copied and deeply frozen **before the SDK sees it**, including
thrown transport errors and malformed/unserializable returns. Invalid observations
are not usable answers, but independently valid usage and provider-operation fields
survive in a bounded receipt. Oversized bytes are omitted with an explicit
`response-byte-limit` and observed byte-count lower bound; unknown fields remain
null, never invented zero. Valid bytes, including JSON whitespace, remain exact.

`scripts/judgment-slice.mjs` composes the real compiled ports. Local files use file
and directory fsync. Capture capacity is finite (the synthetic fixture chooses
1 MiB), the input/output byte bounds are 16 KiB each, maximum reserved charge is
20 synthetic credits against six's 100-credit fixture budget. These are test
configuration numbers, not observed deployment promises. The reference context
refresh consumes P2's verified status-bearing Evidence; raw signed bytes alone do
not become live evidence. Caller question fields never select the configuration.

Before six reserves spend, the capture owner reserves the complete finite encoded
receipt budget: `6 * maxOutputBytes + 8192` (106496 bytes for the fixture). Sixfold
expansion bounds JSON escaping; the fixed remainder covers all closed/bounded
metadata fields. Input fitting without this output capacity refuses before any
spend reservation or invocation. This intentionally reserves worst-case storage,
not the expected small answer, and is independent of six's money accounting.

Capacity commitments share the capture directory's durable policy and file lock.
Other writers, including a new process, cannot spend a held slot. The exact capture
hash is bound before writing and the full slot stays held afterward; no release
API exists. Crashes or abandoned attempts may conservatively strand capacity,
but cannot silently free it or destroy prior evidence. A real post-admission disk
failure can still prevent a receipt; that always prevents answer use. This is the
ten-labelled reference custody port, not a production storage/isolation guarantee.

Opening and verifying existing captures never takes a writer lock. Policy setup
is lazy under write admission, not a prerequisite for receipt-only recovery.
Writers fsync a unique lock-owner record (local host, PID, nonce); another writer
may reclaim it only when the local OS reports that PID absent (`ESRCH`). A live
or reused PID, foreign host, permission uncertainty, partial/legacy owner record
or empty lock is not evidence of death. Those cases retain write exclusion while
reads and `resumeRecording` remain available. Empty locks left by a kill before
owner publication or during reclamation need independently established quiescence
before future writes; no timeout guesses or automatic removal are exposed.
Competing reapers must win deletion of the exact unique dead-owner marker before
removing its empty directory, so a losing reaper cannot erase a replacement lock.
This recovery removes lock metadata only, never capture bytes or capacity slots.

`resumeRecording(request)` only completes local accounting/decode/resolution from
an existing real receipt, even under a new process incarnation. It returns a fact
reference, not a usable answer. Missing receipt fails closed and preserves six's
exposure. `readAnswer` re-reads captures and checks current standing, lease, stop,
generation, deadline and evidence freshness. A restored request clock cannot be
used as current permission; five's eventual recovery/acceptance remains separate.

Not implemented: benchmarks/scenarios/runs, ask refinement, compatibility digests,
assessment pins, grading, normalized JudgmentHoldCost/cohort/queue metrics, provider
switching, consumer default selection, live-provider pricing/token ceilings,
replicated effect durability, runtime activation, full five/eight integration,
multi-machine question arbitration or independent protection. No retention timer
deletes evidence and no successful answer releases a pin. The local port has no
network fetch or delete operation; host administrator isolation is not claimed.

Tests cover actual owner ports, hostile SDKs, byte/storage faults, four doorway
SIGKILL cuts and two capture-lock crash cuts (before and after owner publication),
including a stopped live writer and competing stale-reaper/replacement race.
The explicitly skipped LIVE-PROVIDER fixture is not counted as passing.
Real fsync-backed semantic cases are split and have 30-second harness budgets;
the four-cut process fixture has a 60-second budget. These repair measured Linux
CI default-five-second timeouts without changing policy clocks or dropping cases.
`scripts/check-judgment-contracts.mjs` maps every one of the 53 design checks to
executed partial coverage or an explicit out-of-scope reason. None is declared held
by this implementation alone. Protected-artifact sidecars do not activate a feature.

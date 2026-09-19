# Part seven — the judgment doorway and the benchmark record

**Status: draft, awaiting approval. Governed. Documents only; the checks named here are implementation obligations, not claims that they have run.**

**Value — the purpose.** A model can interpret a request, compare two failures, or object to a
proposed action. It cannot make its own permissions. This design gives that reasoning one
doorway and gives every attempt a record that survives the worker. The record says what was
asked, what the model actually received, what it returned, which answer was used, and what the
attempt cost. Another part can then examine the answer against what happened without guessing
what the question was. The usefulness of that separation is a design value; no check proves it.

**Rule — claim discipline and scope.** Rules 49, 69, 91, and 113 govern this document.
Every normative paragraph, list, and table below belongs to its immediately preceding Rule or
Value block. Rule blocks name automatic checks; Values name choices no check enforces as
preferences. This part makes no claim about measured behavior of Instar 1.x. **Check:**
P7-NF-01 checks the contract inventory and fixture references; the repository's
`node scripts/check-governed-docs.mjs docs` checks governed-document body discipline. Neither
check proves semantic correctness or approval.

---

## 1. What this part owns

**Rule — one owner for each type.** Rules 1, 30, 49, and 69; the big picture's sections 5,
8, and 13. This part owns the eight types below. They are payloads and pure derivations built
from part one's constitutional values. They follow its closed construction, canonical encoding,
schema migration, explicit clock arguments, total decoding, and refusal conventions; they do
not enlarge the constitutional package's inventory. Every field of an admitted payload is
immutable. Identity compares by its id; content compares at the same schema version after
migration. Incompatible content under one logical identity produces a Conflict, never a clock
winner. **Check:** P7-NF-01/02 and part one's NF-49/50/51/68 at these decoders.

| Type DEFINED here | Meaning and sole producer |
|---|---|
| `JudgmentRequest` | One bounded question and the evidence under which it was asked; the doorway's request decoder. |
| `JudgmentAttemptRecord` | One immutable observation of one provider attempt's lifecycle; the doorway's attempt recorder. Several observations may refer to the same attempt. |
| `JudgmentResolution` | The recorded terminal disposition of one question; the doorway's resolution derivation. |
| `AskRefinement` | A model-supported interpretation of an existing Intent, without standing or authorization; the refinement decoder. |
| `BenchmarkRecord` | The sealed manifest of one real judgment case, including failed and defaulted cases; the doorway's manifest builder. |
| `BenchmarkScenario` | A reproducible, access-scoped test input promoted from a real case and a separately recorded grade; the scenario admission decoder. |
| `BenchmarkRunRecord` | What a benchmark execution tried, returned, consumed, and omitted; the benchmark runner's recorder. It contains no grading algorithm. |
| `JudgmentHoldCost` | Measurements and bounds for one wait or a declared population of waits; the cost derivation. |

**Rule — imported types keep their owners.** Rules 49 and 69. The following are NAMED and
consumed, never defined here. **Check:** P7-NF-01 refuses a duplicate schema owner and
P7-NF-03 checks dependency direction.

| Owner | Names consumed here |
|---|---|
| Part one | `VerifiedPrincipal`, `StandingGrant`, `Revocation`, `Intent`, `Directive`, `Result`, `Success`, `Refused`, `Measurement`, `Profile`, `Evidence`, `Decision`, `Authorization`, `Scope`, `ActionFloor`, `Outcome`, `SecretRef`, `Provenance`, `Conflict`, `UnresolvedInput`. |
| Part two | Fact envelope, admission, append port, causal frontier, durability state, capture reference and `captureStatus`, retraction, correction, redaction, projection, checkpoint, folded-through vector, provisional/contested taint. These retain that part's names rather than acquiring parallel schemas here. |
| Part three | `Declaration`, register generation, governed port, generation record, check-run record, rule graph and holder honesty classes. |
| Part four | Conversation binding, operation classification, registered command surface, authorization request, agent operating standing, and needs-judgment hold at intake. |
| Part five | Durable run graph, delegation contract, awaiting-authorization state, work/result acceptance and cancellation records. No field layout for these is prescribed here. |
| Part six | Lease, fencing, operation identity/reservation, spend reservation, loop primitive and recovery. No second lease, reservation ledger or retry loop exists here. |
| Part eight | Effect doorway and effect settlement/reconciliation. It dispatches against part six's admission and supplies settlement evidence, without a competing reservation authority. |
| Part nine | Grade, outcome grading, verification holder, probe, retrospective review, semantic review record and scenario-promotion judgment. Their payloads and decision criteria belong there. |
| Parts ten and eleven | Concrete model adapters and executable assembly; operator surfaces and external protected-artifact enforcement. |

**Value — a record contract before a grading policy.** Keeping the question, answer, and later
assessment separate allows a future grader to disagree with a past answer without editing it.
No check chooses this division of responsibilities. Its mechanical consequences are checked
below. Parts five and six are sibling contracts to reconcile before implementation; this design
does not treat an unapproved sibling's implementation choice as a settled foundation.

---

## 2. The request: a question inside an explicit floor

**Rule — every question is registered and bounded.** Rules 4, 41, 56, 57, 58, 75, 86,
95, and 108. A request decodes only against an anchored register generation loaded through
part three's decoder. The caller identifies a judgment point; it cannot supply a replacement
floor, cheaper privacy policy, different fail direction, or its own approver. **Check:**
P7-NF-04/05/06 reject unresolved references and disagreement with the registered point.

| Required request field | Meaning |
|---|---|
| `id`, `logicalKey` | Globally unique record identity; deduplication key scoped to owning run, step, question ordinal and input digest. A network retry uses the same key. |
| `point`, `consumer`, `generation` | Registered judgment point, specific consumer and anchored generation whose floor and failure contract apply. |
| `caller`, `run`, `intent` | Verified invoking principal and durable owner references; intent reference when the question interprets one. A background question still names its durable run. |
| `question`, `inputDigest` | Bounded question text or capture reference; canonical digest of all semantic inputs below. Identical words with different evidence are different inputs. |
| `floor`, `default` | Part one's ActionFloor resolved from the registered point, with parameter schemas and the named default. The request may narrow candidates but never add one; the effective set is nonempty and retains a permitted default. |
| `evidence`, `contextManifest` | Evidence references, their capture hashes and observed availability; ordered roles/messages, prompt/template hashes, tool-result references, attachments, retrieval results, summary coverage and truncation markers. |
| `directives`, `authorityBasis` | Directive lineage, binding/grant references and causal frontier the requester read. Historical context, not a reusable authority token. |
| `scenarioClass`, `routeBasis` | Registered scenario class or explicit unmeasured class; compatible benchmark-run and grade references, or `unmeasured` with reason. |
| `deadline`, `bounds` | Explicit clock-based deadline and registered bounds for input/output bytes, tokens, money/quota, queue age, concurrency, attempts and recovery. Zero means zero, never an absent default. |
| `capturePolicy`, `dataScope` | Registered local capture policy, permitted provider destinations, permitted readers and allowed disclosure scope. Credentials are SecretRefs, never payload fields. |

**Rule — a floor bounds a proposal, not the world.** Rules 57, 82, 98, and 103. An allowed
action identifies an operation and a parameter schema, with finite candidate references or a
deterministically checked scope constraint. A free-form tool name or arbitrary executable text
is not an action member. Model output may select a member, a permitted subset, or the default;
its chosen member and separately falsifiable conclusion and reason decode through part one's
Decision decoder. Evidence references in either claim must resolve to supplied evidence or
explicitly identified model inference; an invented evidence id refuses. Required evidence
missing from the prompt is visible as missing, not fabricated. **Check:** P7-NF-05/07/08.

**Rule — information is not instruction authority.** Rules 28, 29, 57, and 103. User prose,
retrieved content and provider output are separately delimited in the context manifest. No
provider output field can confer standing, clear a refusal, choose an approver or mint an
Authorization. Provider tool calls are proposed actions that re-enter the work engine and effect
doorway; the model adapter has no general tool-execution capability. **Check:** P7-NF-08/09
test injected instructions in each input role and block direct execution. Whether the model
understands a misleading passage remains a Value held by judgment, not guaranteed by delimiters.

**Rule — full input means the actual submitted input.** Rules 41, 58, 75, and 108. After
scrubbing and adapter formatting, the recorder captures the exact application-visible request
sent to the provider: message order, system/developer context, attachments or immutable local
copies, tool definitions, generation settings, output schema and provider/model identifiers.
It records differences from the assembled input. An attachment URL alone cannot reconstruct
mutable bytes. Provider-private prompts or hidden computation unavailable to the adapter are
explicit limitations; neither inferred hidden text nor private chain of thought is required.
The supplied explanation is the auditable Decision reason. **Check:** P7-NF-10 compares a
captured outbound exchange to its manifest and tests unavailable provider internals explicitly.

---

## 3. One call path, including the call's own side effects

**Rule — the judgment service is the only path to model reasoning.** Rules 1, 30, 41, 58,
69, and 75. Features, sentinels, benchmark runners, native harnesses and provider fallbacks
use the same port. Only model adapters import provider clients; only the doorway invokes those
adapters. Concrete implementations are wired by part ten. Dynamic plugin access remains an
enumerated enforcement-boundary residual under part three, never claimed as complete coverage.
**Check:** P7-NF-03/09 plus P3-NF-29 and the production wiring test P7-NF-41.

**Rule — calling a model spends and discloses.** Rules 4, 60, 63, 75, and 100. A provider
dispatch is a registered effect: money or subscription quota may be consumed and submitted
content leaves its originating process. Judgment prepares the bounded call; part six durably
admits and reserves the exact operation and spend under its fence, current standing, stop,
resource and data-scope constraints. Part eight's effect boundary dispatches only against that
admission and owns settlement. The adapter receives only the admitted dispatch. The operation
requires the declared durability state before execution, including P2-NF-63/73; this document
does not choose that state for part eight. **Check:** P7-NF-09/11/12 are cross-part admission
fixtures and cannot count as wired until the effect implementation runs them.

**Rule — supervision cannot recursively authorize itself.** Rules 4, 38, 55, and 67.
Critical business pipelines request bounded step supervision through this doorway. The
mechanical admission of the model call itself uses exact enforcement of already-governed
standing, budget, credential and dispatch records. It does not request a second model to approve
the first model's invocation. Review of reasoning happens as a separate bounded question, not
inside its own dispatch admission. A supervisor missing from a business pipeline does not become
present merely because the provider transport was checked. **Check:** P7-NF-13 rejects a
cyclic supervision dependency and reports the missing business supervisor separately. The
semantic adequacy and live coverage of supervision remain part nine's partial obligation.

**Rule — the transition order is fixed.** Rules 41, 42, 46, 55, 58, 60, and 63.
The sequence below is enforced by P7-NF-11/14/15/16, including a kill between each pair.

1. Preserve and decode the question; persist the pending run step and logical JudgmentRequest
   through part two. Link intake's existing hold evidence. Secret-bearing rejected input keeps
   custody-safe references and refusal metadata. Failed admission produces no callable request.
2. Deduplicate the logical question and acquire ownership through part six.
3. Validate the expected run predecessor, stop and resource state; ground at the actual start
   through part five's fresh history/clock read. Resolve a compatible route and bounded input.
4. Persist C's attempt identity mapped to B's exact operation identity and the submitted-input
   capture. A prepared record alone grants no permission to dispatch.
5. Part six admits and durably reserves that operation under the current fence and spend bound,
   including capture/resource capacity. Ownership change and conflicting admission must be
   excluded by six's reservation contract, not by a read-then-call sequence in seven.
6. Dispatch through part eight's effect boundary to the model adapter against that reservation.
7. Record provider receipt, usage, part one's Outcome and decoded answer/Result; then resolution
   and sealed benchmark manifest. Partial streams are observations, not answers. The resolution
   is not released before its manifest reaches required durability. A crash between these
   appends resumes local construction idempotently, without another provider invocation.
8. Part five conditionally accepts the recorded answer into the run against its predecessor,
   current stop and ownership state. The run-acceptance reference belongs to five.
9. Advance only from accepted, applicable output. A later business effect gets its own admission.
   Intake classification remains separate from judgment. Late receipts/accounting still append
   after a wait closes, and part nine discovers every case from facts, not callbacks.

**Rule — a complete answer may be accepted before final charge is known.** Owner: Seven owns
`ProviderAnswerAcceptance` version 1; Nine owns response-evidence assessment; Eight owns
settlement; Six owns accounting; Five owns use. **Check: P10-SI-17** accepts the output-use record
only when it binds the exact current request, attempt, response-observed fact, operation,
consumed claim, submitted and answer digests, response capture, provider/model/route/floor and
evidence set; Nine accepts that exact response as authentic and complete; Eight's settlement and
Six's accounting join the same operation and settlement fact/hash; the route's maximum charge is
finite and enforced; Six retains the unreleased maximum exposure; and retry eligibility is
false. Unknown charge or quiescence remains unknown. Missing joins, taint, conflict, released
exposure, a second acceptance or a different decoder refuses. The positive neighbor accepts one
complete bounded answer once while reporting unknown billing and held capacity. The existing
`ProviderJudgmentResolution` remains the positive fully settled path and still requires zero
unresolved accounting.

The record carries immutable id, request, attempt, response, operation, claim, submitted digest,
capture, answer digest, assessment, settlement, accounting, finite maximum charge, retained
exposure, generation and accepted clock. Seven produces
`judgment-provider-ProviderAnswerAcceptance` through `recordProviderAnswerAcceptance` and exposes
`decodeHistoricalProviderAnswerAcceptance`. Historical decoding uses the origin-pinned schema,
generation, causal predecessors and captured `Decision` bytes. Current authority, freshness and
retained exposure are rechecked before a new use, not used to erase an earlier accepted use. Later
accounting settlement does not invalidate its historical acceptance. No callback, answer bytes,
authority, actual-charge claim or retry permission is serialized into the record.

**Rule — acceptance supplies one separately admitted reply, not readiness for the provider run.**
Owner: Five for conditional consumption and the reply run; Seven owns the accepted answer; Eight
owns the reply operation. **Check: P10-SI-24**. Five's public `openAcceptedProviderReply` rechecks
the original current predecessor, stop, standing, lease-derived fence and conversation obligation,
then deduplicates one standard `Run` v1 opening by the exact acceptance fact. The original provider
run and accounting stay pending. The reply run obtains its own grounding, authority, budget,
durability and Eight dispatch claim and cannot invoke the model again. Changed predecessor or stop,
a second consumption, or a reply run without its own admission refuses. The positive neighbor
sends one real reply from one assessed complete answer while maximum exposure remains held; restart
finds the same reply run and outbound operation and performs neither a second model call nor a
second reply operation.

**Rule — identities and reservation authority have one owner each.** Rules 33, 55, 60,
63, and 75. The map below is enforced by P7-NF-17/30/52; none of its references creates
a parallel Outcome, Result or Decision.

| Name | Sole owner | Reference used here |
|---|---|---|
| Logical judgment request | Seven (C) | JudgmentRequest id and logical key. |
| Attempt | Seven (C) | Stable attempt id and ordinal within one question. |
| Operation identity / reservation | Six (B) | Six's durable operation identity and fenced reservation reference. |
| Provider receipt | Seven (C) | Captured provider evidence in JudgmentAttemptRecord, decoded using part one's Outcome/Result/Decision; eight determines effect settlement. |
| Spend reservation | Six (B) | Same admission authority as the operation reservation, with liability/bound references; seven's meter is observational. |
| Run-acceptance reference | Five (A) | Five's conditional acceptance fact, referenced without redefining its payload. |

**Rule — retries preserve the attempt-to-operation mapping.** Rules 24, 33, 55, 60,
63, and 75. A persisted (request id, C attempt id, exact input digest, route) maps to exactly
one B operation id. Re-delivery, worker replacement, observation and transport retry retain
that operation; they cannot reserve again under a new key. Changing provider or input requires
a fresh C attempt and B operation linked to the prior attempt, but only after B's recovery
has reconciled the original operation with eight's settlement evidence and admitted the next
attempt. Unresolved execution or charge uncertainty cannot be bypassed by extra budget, a new
run, another provider or a new logical question. B owns reservation release/update based on
eight's settlement evidence. C may append usage observations, never release a reservation or
declare an uncertain effect settled. **Check:** P7-NF-14/17/21/30/52.

**Rule — attempts and resolutions describe different things.** Rules 42, 58, and 75.
`JudgmentAttemptRecord` contains its own fact identity, request id, attempt id, attempt ordinal,
parent attempt when retried, part six's operation id, provider-side operation id when returned,
phase, causal predecessors, fence reference,
route, exact input/output capture references, usage, clock measurements and transport Outcome.
Its phases are `prepared`, `dispatch-observed`, `response-observed`, `decode-observed`, and
`accounting-observed`. Observations never rewrite one another. A later reconciliation may supply
a missing phase; absence of a phase is not proof that the provider did nothing. Each dispatch
keeps the same attempt id during observation; a fresh call needs a new attempt and reservation.
Phase payloads are explicit: prepared requires submitted input and operation mapping;
dispatch-observed requires reservation and effect-dispatch references; response-observed
requires the received-byte capture or an explicitly observed absence/transport uncertainty;
decode-observed requires the decoder Result and its source response; accounting-observed
requires usage evidence or the declared usage exception. Unknown provider receipt id or output
before receipt is an explicit absence, not a made-up placeholder or a required future reference.
**Check:** P7-NF-14/15/17 reject impossible causal references, reuse with different content
and double counting. Phase labels alone prove no provider behavior.

**Rule — termination is explicit.** Rules 42, 46, 57, 67, and 95.
`JudgmentResolution` carries id, request/input digest, referenced attempts, terminal disposition,
selected Decision or explicit absence, constitutional Result, evidence/capture status, applied
bound if any and the disposition's causal basis. Terminal dispositions are `decided`,
`defaulted`, `refused`, `cancelled`, and `expired`. Only `decided` carries a model Decision.
`defaulted` names the registered policy default and failure observations; it does not invent
a model answer or erase the failed attempt's Result. A late reply appends evidence but cannot
change an expired/cancelled/defaulted question into decided; reconsideration is a new question
linked to the old one. **Check:** P7-NF-16/18/19.

**Rule — Results retain the meaning of their operation.** Rules 40 and 42. A resolution
selecting a declared informational default can be Success for that selection, with
`capacity: applied` when an expected bound acted. An attempt's Refused remains Refused on
the spine; the selection is never reported as a successful model call or successful business
effect. A default that forbids the proposed operation produces that operation's Refused.
Cancellation and expiry preserve the request and carry a policy or budget-exhausted refusal as
appropriate under part one's existing list; these dispositions do not invent new Refused reasons.
Provider uncertainty uses Outcome.uncertain, not Refused's claim that an operation did not happen.
**Check:** P7-NF-18 and part nine's report-versus-Result seam fixture P7-NF-36.

---

## 4. Failure follows the consumer

**Rule — no heuristic replacement for unavailable judgment.** Rules 10, 12, 57, 67, 86,
and 95. Provider switching is bounded by the same question's deadline, total attempt budget,
input disclosure policy and floor. Unknown charge remains reserved and blocks a fresh attempt
until part six's recovery reconciles the original operation using eight's settlement evidence.
The switch records why, the exact route and whether it is measured. A keyword list
cannot become the replacement classifier or blocker. **Check:** P7-NF-20/21 and the
provider-bypass lint P7-NF-03.

**Rule — defaults are per consumer, not one global fail-closed switch.** Rules 4, 14, 57,
86, and 95. The table is the starting set of judgment-point consumer contracts; a new consumer
requires its own registered floor, default and checked fail direction. **Check:** P7-NF-06/20.

| Consumer | Default on undecidable/unavailable model | What may proceed |
|---|---|---|
| Ordinary conversational assistance or advisory pre-send review | No model conclusion; unavailable review recorded as such, with the registered deliver-with-flags/no-objection policy | Already permitted communication and deterministic repair; exact credential/authority/effect checks still apply. |
| Intake operation interpretation | Unclassified; no inferred operation, holder selection or candidate grant | Receipt and ordinary conversation; the affected authority exercise stays held or ends honestly expired. |
| Irreversible operation supervision | No affirmative supervision; proposed operation refused/preserved under its declared floor | Unrelated work and communication. |
| Recurrence comparison | No similarity conclusion; retain both cases separately and mark comparison unavailable | Repair already allowed under standing; no claim that the defect did not recur. |
| Retrospective or benchmark reasoning | Incomplete record of evaluation; no grade fabricated here | Durable candidate remains discoverable; nothing is promoted as measured success. |

**Rule — a failed record store is not permission to make an unrecorded call.** Rules 41,
58, 75, and 95. Capture or append failure before dispatch prevents that dispatch. After dispatch,
uncertainty is retained in the prepared attempt and recovery observes it; no uncommitted answer
is released. Existing intake preservation and the minimal communication/repair plane remain
independent of this optional model attempt. Total failure of the minimal plane retains the
big picture's explicit recovery limit. **Check:** P7-NF-11/22 and scoped boot fixture P7-NF-41.

---

## 5. Refining ask without manufacturing permission

**Rule — refinement is a new record about an existing Intent.** Rules 4, 10, 28, 57, 82,
93, 98, 103, and 104; P4-NF-18/26/27. The original raw hash, principal, arrival time and
directive lineage are untouched. `AskRefinement` carries id, Intent reference and raw hash,
preceding refinement when any, JudgmentResolution reference, Decision reference for a model
interpretation (explicitly absent for an unavailable-model unclassified disposition), input digest,
command-surface generation, evidence references and one of the outputs below. The append is a
fact about interpretation, not a second Intent minting or an authority-conferring act.
**Check:** P7-NF-23/24/25.

| Output | Meaning |
|---|---|
| `proposed-operation` | Registered operation id with structurally validated parameters and their source references. Classification still runs in intake. |
| `no-operation` | Model interpretation that the message is informational; records its separate reason and can be disputed. It does not discard the original work. |
| `unclassified` | Ambiguous or unsupported request, missing required information, or no usable model answer. No operation is implied. |

**Rule — classification consumes a proposal, never the model's policy verdict.** Rules 28,
57, 82, 98, and 103. For proposed-operation, the intake classifier consumes the registered
operation and validated arguments against its current command/profile records, then computes
needed standing and routes under part four's rule. Natural language is interpreted by the model;
the required standing is a deterministic property of the operation it proposes. A model cannot
send `needsNoApproval`, grant scope, holder identity or a fabricated explicit yes as controlling
fields. If classification shows the agent's existing operating standing suffices, it does the
work without another approval. If actual operation or parameters change, reclassification and
effect re-validation apply to the changed operation. **Check:** P7-NF-24/25 and P4-NF-16/18.

**Rule — ambiguity is owned work with a bounded wait.** Rules 22, 46, 83, and 98. A needs-
judgment hold refers to the original durable owner. Resolution closes that wait by a committed
refinement, an explicit non-operation disposition, cancellation, or expiry with a recorded
receipt obligation. No timeout-to-yes exists. Missing information that the agent can retrieve
creates a bounded child task through part five; only information or authority it cannot obtain
routes to its proper holder. Expiry of a wait does not complete the parent directive or prove
the task impossible. **Check:** P7-NF-19/26 and the run-continuity seam in section 10.

**Value — semantic interpretation can be wrong inside a valid floor.** A model can mistake a
quoted request for the speaker's intent or overlook a useful operation. No schema proves
meaning. Captured-context cases include quotations, multilingual asks, near matches, conflicting
instructions, valid unusual wording and benign requests within existing standing. Part nine
grades those errors from this record. A test case's answer is not inserted into the live prompt.
Whether the selected cases are representative is a Value, not a mechanical proof.

---

## 6. Honest hold costs and resource bounds

**Rule — this part owns measured judgment-hold costs.** Rules 13, 39, 46, 55, 60, and 75;
part four's hold-rate/queue-age obligation and its changelog's follow-on. `JudgmentHoldCost`
carries id, subject (individual hold or declared cohort), intake hold-entry and hold-exit
evidence references (exit explicitly absent for an open hold), interval/clock provenance, registered
bound references, measurements, aggregation method, sample count, unresolved count and coverage
limitations. Each number is a part-one Measurement with producer, subject, unit and observation
time. A configured ceiling is a policy parameter; an observed maximum is a measurement; a
prediction is an estimate with basis. None may be displayed under another's label.
The input population comes from intake's hold-entry/exit facts and authority-exercise admission
facts, joined to any judgment attempts. A hold that has not reached this doorway, or terminates
before a model call, is still counted; no attempt means zero observed calls, not zero wait.
Missing hold-exit evidence means an open or incomplete wait, never assumed completion.
**Check:** P7-NF-27/28/29 includes pre-attempt queueing, cancellation before dispatch and
held intake with no JudgmentRequest yet.

| Quantity | Exact subject and denominator |
|---|---|
| Hold rate | New authority-exercise asks entering needs-judgment divided by all authority-exercise asks in the same scope/window; ordinary chat excluded. Duplicates counted once. Zero denominator is undefined, never zero percent. |
| Queue age | Time from first accepted hold to now for each open hold, including recovery downtime; distinct from provider latency. |
| Total hold duration | First accepted hold to terminal wait fact, including queueing, retries, provider switches, record commits and recovery. |
| Provider latency | Dispatch to response/timeout observation for one attempt; partial stream arrival and final answer are separate observations. |
| Tokens and quota | Input, output, cached and provider-specific billed categories per attempt, with provider usage source or a declared unmetered exception. |
| Money | Exact currency units per attempt, price version, billing class, subsidy basis/date and settlement source. Subscription calls record quota use and allocated/estimated cost basis, never fictitious zero resource use. |
| Outstanding exposure | Settled spend plus maximum reserved liability for uncertain attempts, scoped to the actual spend account and window. |
| Capture cost | Bytes retained and pinned by unresolved cases on the originating machine, with available capacity and oldest pin age. |
| Hold bound violations | Every wait beyond its configured queue/total bound, including still-open waits; no survivor-only percentile. |

**Rule — a timeout is not a cost receipt.** Rules 13, 40, 60, and 75. Before each metered
call, part six's fenced spend reservation admits an enforceable maximum liability computed from submitted input,
maximum output and the provider's pricing/fee contract. Unknown input overhead must fit a
provider-enforced ceiling or the metered route is ineligible. Unknown usage is recorded as
unknown with an upper reservation, not zero; an exact monetary number uses integer or exact
decimal arithmetic. Estimated subsidies cannot lower the hard reservation unless an enforceable
billing agreement bounds the actual charge. Eight produces settlement evidence; six alone
updates or releases its reservation from that evidence. A cancellation acknowledgment permits
release only if it proves unspent liability. Calls on another provider require the original
operation reconciled first, plus fresh reserved capacity. **Check:** P7-NF-12/28/30.

**Rule — measurable bounds are required at activation.** Rules 13, 46, 55, and 60. Each
point's deployment declaration supplies finite queue-age and total-wait ceilings, retry count,
concurrency, capture bytes and token/spend/quota caps; measured operating evidence records the
hardware, provider, load, sample size and observation window against those ceilings. Missing
numbers prevent that point's activation. With no observations the operating result is explicitly
unmeasured, not a guessed latency promise. Deadline and stop are checked again immediately
before dispatch and acceptance. Part six's loop owns all retries and overdue recovery.
**Check:** P7-NF-27/29/31; P7-NF-40 tests activation with missing bounds and valid zero caps.

**Value — no invented production timings.** This design chooses no universal number of seconds
for a provider it has not measured. The deployment owner selects limits within existing
governance and records the benchmark evidence; the check verifies completeness and compliance,
not whether the selected latency/cost trade feels right. During a process outage, a deadline
cannot promise that a receipt was delivered on time: recovery reports the observed overrun and
prevents a late effect. Clock discontinuity yields a flagged interval or unavailable duration;
cross-machine wall-clock subtraction is not silently trusted. Local monotonic durations and
recorded wall-clock uncertainty keep those cases distinguishable (P7-NF-29).

---

## 7. The benchmark record: enough to grade without inventing the case

**Rule — every accepted question has a manifest, including failures.** Rules 41, 58, 75,
and 108. `BenchmarkRecord` is a sealed immutable fact payload with the following fields. An
accepted-request projection lists questions awaiting a manifest, so a crash cannot selectively
remove failures from the benchmark population. There is one logical manifest per question's
terminal resolution. Later attempt accounting, outcomes, reports, retractions and grades are
separate facts joined by ids; they never edit the manifest. **Check:** P7-NF-15/17/32/33.

| Field group | Required contents |
|---|---|
| Identity and cause | Manifest id, real-case marker, request id/digest, resolution id, owning run/step, intent and raw hash when applicable, logical dedup key, recording principal and source generation. |
| What was judged | Judgment-point id, scenario class, floor/default and schema versions, question/context manifest, input capture hashes, parameters and relevant system-state evidence with its causal frontier. |
| Who answered | Ordered attempts and observed attempt phases, exact adapter/provider/model ids (requested and provider-reported), model-version uncertainty, generation settings, route choice and its measured/unmeasured basis. |
| What was returned | Response capture references, decoded Decision or explicit absence, separate conclusion/reason claim references, their evidence dependencies, refusals, transport Outcome and terminal default/cancel/expiry basis. |
| What was usable | Evidence freshness at use, capture availability at sealing, known truncation/provider-private context limits, taint and conflicts observed, run-acceptance reference if already recorded or explicitly pending. |
| What it cost | Attempt usage references, JudgmentHoldCost reference, price/subsidy versions, known/estimated/unknown billing, unresolved exposure and accounting observations available at sealing. |
| Where assessment attaches | Stable request, resolution and Decision ids for joining actual effect attempts, Outcomes, reports and part-nine grades; expected observable question/outcome subject and its observation window, or explicit no-world-effect classification. |
| Custody | Local capture owner/location, hashes, byte lengths, scrub policy/version and transformation manifest, access scope and retention declaration; source Evidence/Provenance references for attestations. |

**Rule — absence is a typed observation state, not a fabricated fact.** Rules 26, 41, 58,
and 108. Missing response, unknown billing, no observed outcome, unavailable capture and no
grade are distinct. A new record cannot refer to a never-stored capture as if it existed;
P2-NF-64 applies at append. Later reads carry current captureStatus, retraction and taint from
part two. The sealed availability statement means "available when sealed," never "available
forever." A replay loader returns the manifest plus current source statuses; a stale projection
cannot turn missing evidence into a complete case. **Check:** P7-NF-32/34/35.

**Rule — grader joins do not require a second source of truth.** Rules 26, 33, 42, 58,
and 108. The grade input is the sealed manifest plus referenced facts through a pinned
folded-through vector, including late observations. Each join lists included and missing
references. Effects name the originating request/resolution/Decision; outward reports name the
Result and effect they report. A claim without that linkage is incomplete evidence, not an
unrelated success assigned to this case. Consumer projections fold facts directly with declared
merge classes, never read another projection's storage. **Check:** P7-NF-33/36 and
P2-NF-47/50/51/57/58.

**Rule — the reason can fail independently of the answer.** Rule 108; part one's Decision
contract. The manifest preserves conclusion and reason as different claims, each with its own
evidence dependencies. Retraction/correction or evidence unavailability reaches both through
those references. The affected-claims projection lists each changed dependency and affected
claim without declaring the conclusion wrong. Part nine owns semantic re-derivation and the
grade. **Check:** P7-NF-07/35/37 includes a true conclusion with a refuted reason and a false
conclusion whose stated premise remains supported.

**Value — a useful explanation is not a proof.** Recording separate claims allows scrutiny;
it does not make either claim true. A model's account of its reason is the supplied explanation,
not access to its internal computation. No check enforces the preference for a particular
explanation style or guarantees that an explanation faithfully describes hidden computation.

---

## 8. Who may attest, and what retention may remove

**Rule — record authorship and claim strength remain separate.** Rules 26, 28, 58, 82,
89, and 108. The machine signature proves who appended these bytes under part two's key rules;
it does not prove the provider returned them, the world changed, or an external guard held.
Provider observations carry the adapter's Evidence source, capture and honest strength.
Re-checkable signed provider evidence may prove that signed observation, never automatically
the truth of the model's conclusion. A model-derived claim remains inference. A principal
attestation carries VerifiedPrincipal and Provenance; a hash alone cannot upgrade either class.
**Check:** P7-NF-38/39 and part one's NF-72/73.

**Rule — external enforcement cannot be self-attested.** Rules 82 and 98; P3-NF-27.
A benchmark case claiming that a protected artifact was prevented from changing must name the
enforcing principal, the governed protection version, the independently controlled enforcement
surface, and observation Evidence from that surface. The tested component's own success report
or the recording machine's signature is insufficient. Grade inputs preserve absent, unverifiable
or merely channel-attested external evidence as such. They cannot establish an Authorization.
Part nine owns checking an attestation's adequacy; parts nine and eleven must explicitly settle
ownership of the reference monitor outside the agent's write authority. This part owns the
record fields and refusal to inflate them, not that monitor. **Check:** P7-NF-38/39/42.

**Rule — captures stay local and access scoped.** Rules 7, 26, 32, 58, and 100; the big
picture's section 5. Exact submitted and returned payloads live in the originating machine's
registered capture class, scrubbed and access controlled, never served raw over a network.
Shared facts carry only bounded claims, hashes, permitted metadata and references, with secret
scanning under part two. A remote grader gets a manifest and permitted derived evidence; it
cannot silently fetch raw local captures. A grader needing full bytes runs where authorized
local access exists or records insufficient evidence. **Check:** P7-NF-10/34/43.

**Rule — provider disclosure is a separate permission.** Rules 57 and 100. Local capture
custody does not forbid a properly admitted original provider request. Replaying a real case to
another model is a new disclosure and a new metered effect: its dataScope must explicitly
permit that destination and its scrubbed case material. A benchmark reader's access does not
grant provider submission rights. **Check:** P7-NF-21/43/44.

**Rule — retention is not an unrecorded eraser.** Rules 7, 26, and 58; P2-NF-65/66/67.
Part three already supplies `growth: redacts` in the register. The judgment capture class uses
that value under part two's tombstone rules; it does not add a new growth value. A policy timer
alone cannot delete a capture. References from an Authorization's provenance, an open Conflict
or an unresolved judgment pin it. For this consumer, unresolved includes no terminal resolution,
unsettled attempt exposure, pending assessment or an open dispute. A mere successful model
answer does not release the pin. Part nine supplies the explicit assessment-closure reference;
closed-case retention still needs a permitted operator-standing redaction reason, declared delay
and tombstone. **Check:** P7-NF-34/45 and P2-NF-65/66/67.

**Rule — finite capacity refuses new capture work, not old evidence.** Rules 7, 46, 60,
and 95. Capture-space reservations cover bounded input and output before dispatch. When pinned
bytes reach the class's declared capacity, affected new model calls refuse; unrelated minimal
communication and repair remain available. Overdue pins and absent grading surface as owned
record-completeness obligations. Calling that condition "retention applied successfully" fails.
**Check:** P7-NF-22/31/45.

**Value — the retention reconciliation is a visible gap.** The approved big picture wants
bounded retention, while part two's allowed redaction reasons do not include routine age and
forbid destroying unresolved judgment evidence. This part supplies finite capture capacity,
explicit pins and evidence-unavailable records; it does not invent a new deletion permission.
Part nine's rule-7 retention duty is still partial until its approved policy reconciles these
requirements. No check can choose that policy for the operator. Routine time expiry cannot be
claimed implemented by the contract here; the named activation check P7-NF-45 refuses that
claim until a valid retention policy exists.

---

## 9. Real cases become benchmark inputs; records do not grade themselves

**Rule — a scenario must come from a real graded case.** Rules 41, 56, 58, and 108 and
the big picture's section 8. `BenchmarkScenario` contains id/version, source BenchmarkRecord,
part-nine grade reference at a pinned generation/vector, scenario class, promotion Decision,
explicit input-only replay manifest, transformation provenance, floor/output schema, evaluation
contract reference, dataScope and capture availability. The input manifest excludes later
outcomes, grades, expected answers and subsequent conversations that the original judgment
could not see. A synthetic contract fixture may test a decoder, but cannot be labelled a
production-derived benchmark scenario. **Check:** P7-NF-44/46/47.

**Rule — transformation does not erase provenance.** Rules 26, 41, and 58. Scrubbing or
minimizing a case records the original input hash, transformed hash, transformation version and
which semantic fields changed or became unavailable. A reviewer in part nine decides whether
the transformed case still tests the same issue; the recording machinery checks only the
lineage. A scenario lacking authorized reconstructable inputs is ineligible for replay, with
its candidate record retained. **Check:** P7-NF-34/44/46.

**Rule — execution records every candidate and failure.** Rules 41, 56, 58, and 75.
`BenchmarkRunRecord` contains id, suite/scenario versions, predeclared candidate routes and
sampling counts, compatibility/input digests, held-out partition identity, executing run,
start/stop measurements, attempt/resolution links per candidate, usage and missing/refused/
cancelled items. It is sealed after execution; part-nine evaluation facts attach separately.
Candidate order or omission is recorded, so a route cannot look good by hiding its failures.
Benchmark calls use this same doorway with purpose benchmark; their manifests cannot count as
new real-world provenance roots. **Check:** P7-NF-32/46/48.

**Rule — measured routing has a checked evidence chain.** Rules 56 and 58. A measured
route names compatible scenario, BenchmarkRunRecord and part-nine evaluation references for
the requested judgment class, prompt, context-assembly version, floor/schema, model identity
and generation settings. Changing a semantic component invalidates that match and requires
recorded execution of the affected suite before the changed configuration can serve, separately
from the evidence required to claim measured. The compatibility
digest records these components individually; a prompt hash alone is insufficient. Per-call
conversation bytes are recorded for audit, but vary within the tested scenario class rather
than demanding a new benchmark for every user message. Changes to the context assembly,
retrieval/summary policy or distribution assumptions do require reassessment. **Check:**
P7-NF-47/49/50; the deadline walker checks model-map verification windows.

**Rule — changed configurations run their affected suite before serving.** Rules 56 and 58,
the rule book's finding 5 and the big picture's section 8. The activation and live-dispatch
gate requires a sealed BenchmarkRunRecord for the exact changed compatibility digest and the
complete affected scenario/candidate set. The affected set is derived from recorded dependency
references against the incumbent configuration; a caller cannot replace it with a convenient
subset. A queued obligation, an old-configuration run, a changed label or an unverified empty
set does not satisfy this gate. **Check:** P7-NF-53 checks the gate at activation and dispatch.

Every affected execution must have its recorded attempt and terminal execution outcome,
including failure or refusal. Failed executions stay in the run and its denominator; they are
not discarded or described as passes. A crashed, cancelled or incomplete suite retains all
produced results and its missing-execution list, but cannot open the changed configuration for
service. Recovery completes the missing work under the same recorded suite/configuration
identity. Completing execution is not passing evaluation: consumer floors and quality/evaluation
requirements still apply independently. Benchmark-purpose dispatch may exercise the changed
configuration to produce this evidence through the existing bounded doorway; it cannot satisfy
live work or execute the business actions it proposes. The incumbent eligible configuration and
unrelated communication remain available while the changed configuration waits.

**Rule — unmeasured is usable only as unmeasured.** Rules 56, 57, 67, and 95. At cold
start, the registered compatible default route may serve within its floor with an explicit
unmeasured reason and owned benchmark obligation only where no configuration-change rerun gate
is outstanding. After a configuration change, unmeasured service requires the affected-suite
execution record above first; dropping measured status never waives that gate. A configuration
whose evaluation support alone was invalidated still obeys every applicable execution gate.
An unmeasured route may not claim
benchmark-backed superiority. If that consumer requires measured evidence, it refuses that
operation under its declared default. Unknown provider model versions cannot silently inherit
an older model's results; stale doorway verification prevents measured status and flags the
map for refresh. Provider availability alone proves neither quality nor exact model identity.
**Check:** P7-NF-06/49/50/53.

**Value — quality and representativeness belong to judgment.** Which cases deserve promotion,
what "best" means across quality, cost and latency, the adequacy of held-out samples, and
whether the benchmark diverges from real life require part nine's judgment. This part records
sample sizes, omissions, partitions and criteria references so that judgment is inspectable.
No recorder check chooses the winner. A grade retraction invalidates its use as measured-route
support as checked by P7-NF-49; the rule below holds that behavior separately from this Value.

**Rule — revoked support cannot keep a route measured.** Rules 26, 56, and 58. Grade
retraction, missing required captures or failed current freshness remove the affected measured
support until valid evidence replaces it. Old routing choices remain immutable history and
carry their original basis. **Check:** P7-NF-34/49.

**Rule — recurrence comparisons use the same door.** Rule 24, explicitly inherited from
part two. The registered recurrence-comparison point supplies two real incident/fix evidence
sets with time and affected-scope references. Its floor is related, unrelated or undecidable;
the answer is a Decision with independently recorded reason. An unavailable comparison never
means no recurrence; an inferred match raises a root-cause candidate, not an automatic claim
that a previous repair failed. Comparison inputs and outputs enter the real-case record.
**Check:** P7-NF-51 pairs differently worded same-cause cases with similarly worded different-
cause cases. The accuracy of similarity judgment and subsequent root-cause work remain partial,
owned respectively by part nine and the durable work owner.

---

## 10. Cross-part contracts and the four failure traces

**Rule — every seam names all six fields.** Rules 31, 33, 42, 49, 63, 69, and 113.
These are consumer requirements on the named ports, not alternate definitions of their types.
Implementation admission requires the corresponding cross-part fixtures against real owners.
The absence of an owner implementation is a partial edge, never a no-op implementation that
makes the fixture pass. **Check:** P7-NF-41/42/52 and P3-NF-28.

| Producer | Consumer | Authoritative record | Transition order | Fail direction | Closure owner |
|---|---|---|---|---|---|
| Intake (4) | Judgment (7), then intake classifier (4) | Preserved Intent, committed resolution/refinement; classification and standing remain intake's | Preserve → hold → judge → record → accept → classify current operation → route | Open for ordinary communication; closed for deriving authority from unclassified ask | Seven closes question; four closes classification/routing; five retains unfinished work |
| Run engine (5) | Judgment (7) | Pending step, predecessor/cancellation state, request and run acceptance facts | Persist step/request → own → validate/ground → persist attempt/operation → reserve under fence → dispatch → record → conditionally accept → advance | Closed on lost ownership/cancelled run; observations preserved | Five closes run/acceptance; seven closes question |
| Lease/reservation/recovery owner (6) | Judgment (7) and effect boundary (8) | Six's lease/fence and operation/spend reservation bound to C attempt; provider receipt and eight's settlement evidence | Own → validate/ground → persist identities → durably reserve under fence → dispatch; recovery reconciles original operation before any new attempt | No dispatch on stale/unreserved operation; unresolved charge cannot be bypassed | Six closes recovery and releases reservation only from eight's settlement evidence; seven records usage |
| Judgment (7) | Effect doorway (8) | Recorded proposal plus current effect admission, actual operation and Result/Outcome | Record → revalidate current operation, standing, evidence, budget and fence → execute → observe | Closed for affected irreversible operation; user reachability remains open | Eight closes effect/reconciliation; five closes business step |
| Register and spine (2/3) | Judgment (7) | Anchored generation, causal facts, current taint/capture status | Verify at use → derive → append through admission → consume at required durability | Stale/tainted authority cannot fund calls or effects; labelled historical reads continue | Two/three close source integrity/conflict; seven closes affected refusal |
| Judgment (7) | Grading/review (9) | BenchmarkRecord and referenced source facts/captures at pinned vector | Seal → discover from request facts → inspect available evidence → append separate assessment | Missing evidence stays unavailable; no default grade | Seven closes completeness; nine closes grade and assessment pin |
| Grading/review (9) | Scenario admission/routing (7) | Separate grade and promotion Decision, real source case, benchmark execution and evaluation facts | Grade real case → promote → replay → record affected-suite execution → evaluate → derive compatible route | Missing changed-configuration execution: no service; no compatible evaluation after execution: unmeasured or consumer refusal | Nine closes evaluation; seven closes execution/routing record |
| Capture owner (2, adapters 10) | Judgment/review (7/9) | Custody record, current captureStatus, lawful tombstone and pin references | Store scrubbed bytes → reference → assess; remove only after eligible closure and tombstone | Missing bytes cannot prove claims; capacity stops new capture work | Nine settles retention/assessment policy; capture owner executes custody rules |
| Independent enforcement surface (9/11) | Record attestation (7), grader (9) | External evidence with enforcing principal/protection version | Observe external prevention → authenticate evidence → record → assess | Self-attestation cannot prove external prevention | Nine/eleven explicitly assign monitor; nine closes adequacy review; seven closes evidence completeness |

**Rule — crash after effect, before record.** Rules 24, 26, 41, 58, and 75. The prepared
attempt precedes provider dispatch. If the provider charged or answered and the worker died
before response recording, recovery queries the admitted operation identity through part eight.
A provider receipt proves only its declared state. If no reliable query/idempotency contract
exists, outcome stays uncertain and six retains the maximum reservation. No fresh attempt
may bypass that uncertainty, even under another provider or budget; original-operation
reconciliation must settle the execution and liability first. Seven does not release the hold.
A response seen only in dead process memory cannot become a recorded Decision. If response
facts exist but the manifest or run acceptance does not, recovery completes those local steps
without recalling the provider. A later business effect's crash belongs to eight's identical
observe-before-retry obligation; the model's answer cannot settle it. **Check:** P7-NF-14/15/30/52.

**Rule — duplicate delivery.** Rules 31, 33, 42, and 75. Exact same logical key and
input digest joins existing work or returns its recorded disposition; same key with different
input is Conflict. Same response receipt collapses within the attempt; independent attempts
are both accounted even if answers are identical. Fact-id dedup is insufficient because two
machines can mint different fact ids for one question. The question/terminal projection uses
exclusive-singleton by logical key, attempts use set-union by attempt/observation key, usage
uses corrected additive/cap-checked aggregates. Part six owns operation identity and fenced
reservation; part eight dispatches against it. That excludes conflicting authorized dispatch.
If a provider cannot honor transport idempotency,
the exposed window is declared and any actual extra attempt remains billable and contested.
Concurrent terminal resolutions without an ordering authority produce Conflict, never "latest
timestamp wins." **Check:** P7-NF-17/28/52 and P2-NF-51/56.

**Rule — cancellation racing completion.** Rules 4, 42, 63, and 98. Run cancellation
is authoritative in part five, enforced by part six's fence at admission. A model response
committed before cancellation can remain a real answer while being unusable for further work.
If cancellation precedes acceptance, the run does not accept it. If acceptance precedes
cancellation, completed work remains history but every not-yet-admitted effect checks the stop
again. If cancellation and acceptance are concurrent or their authority cannot be established,
no consequential continuation is eligible until the run owner reconciles them. No clock
tiebreak decides permission. A late response is recorded and charged honestly without reviving
the run; cancellation cannot undo provider spend or an already-admitted irreversible effect.
**Check:** P7-NF-16/19/52 tests both orders and genuine concurrency.

**Rule — stale authority.** Rules 28, 31, 57, 63, 95, and 104. Historical request
admission proves what the requester had seen, not what may happen now. Before dispatch and
acceptance, current standing/binding, stop, run fence, spend and register horizon are checked
through their owners; authority-bearing outputs propagate provisional/contested taint. A changed
floor, directive, input or classification makes the old response inapplicable; a new question
records the new basis. A fenced worker may submit a narrowly authorized observation of its
already-started attempt, never accept a result or launch another effect. The observation path
checks the original attempt binding and recorder identity and carries no execution capability.
**Check:** P7-NF-11/12/25/39/52 plus P2-NF-55/73/76/77.

---

## 11. Register entries, storage and multi-machine posture

**Rule — declarations enumerate both the doorway and its checks.** Rules 4, 32, 33, 39,
57, 66, 69, 75, and 113. Entries below use existing kinds, with statuses effective only
after implementation activation. Load-bearing bounds have paired constructs and probes under
part three. This table proposes declarations, not a hand-maintained generated register.
**Check:** P7-NF-01/04/40 and P3-NF-02/18/19/20.

| Entry/kind | Required facts supplied by this contract |
|---|---|
| `judgment-doorway` / features | Metrics from section 6; profile: money, irreversible, user, chat, repeats bounded by judgment capacity. Significant and critical are derived. Activation requires unit, integration, production-wiring/lifecycle evidence and live outcome probe. |
| `judgment-admission` / blocking sites | Authority block; ruled-three for secrets, spend cap and stop; governed-state for request/schema/floor checks, each with enforced record and decoder. Executing principal cannot author the enforced record. Closed for dispatch integrity; open for advisory communication default. Preserved input: capture/refusal references. Inspected by P7 fixtures. |
| `judgment-output` / blocking sites | Authority block; governed-state, enforcing ActionFloor/output schema with Decision decoder; closed for an invalid candidate, open only through the separate declared informational default. Preserves response capture or custody-safe refusal metadata. |
| Interpretation, supervision, advisory, recurrence, review and benchmark points / judgment points | Per-consumer floor/default in sections 2–5/9, irreversible profile of allowed consequences, benchmark class or unmeasured; full five-field profile and bound references per deployment. No point is live with missing fields. |
| Each provider route / model doorways | Exact model ids and verification timestamps/windows, billing, subsidy basis/date; adapter privacy, usage and cancellation limits are captured in the compatible dispatch declaration. |
| `judgment-record-completeness` / duties of observation | Proof: accepted-request versus terminal/manifest/attempt accounting reconciliation at a pinned vector; owner: record-completeness holder; bounded cadence and overdue action supplied at activation. |
| Model response adapters / parsers | Real captured bytes, authentication-class honesty, event-id authority and ackPolicy appropriate to senderless provider responses; fixture suite P7-NF-10/17/38. |

**Rule — no new authoritative database.** Rules 7, 32, 33, and 45. All eight payload
types are shared fact schemas on part two's append-only spine. The following local views are
disposable folds; their records of occurrence remain on the spine. All declare folds/ignores
for every fact kind, merge classes and pinned rebuild comparisons. **Check:** P7-NF-33/40
and P2-NF-47/50/51/57/58.

| State | Growth / memory / scope | Agreement and merge behavior |
|---|---|---|
| Request/attempt/manifest index | deletes disposable view rows under declared terminal-retention policy; no agent memory; machine-local for local folding | Shared facts; exclusive-singleton request/resolution, set-union attempt references. Minimal identity/conflict keys retained. |
| Meter/hold view | deletes disposable view rows; no agent memory; machine-local | Intake hold-entry/exit and admission facts plus attempt/usage/reservation facts, corrected accumulation and cap-checked aggregates; unknown exposure never subtracted as settled zero. Observational only: six owns budget authority. |
| Route-support view | deletes disposable view rows; no agent memory; machine-local | Facts plus generation; conflicting support stays conflicted, stale/withdrawn grades cannot yield measured status. |
| Affected-claims/assessment backlog | deletes disposable view rows only on explicit closure; no agent memory; machine-local | Set-union dependencies; pending assessment and unresolved disputes keep capture pins. |
| Judgment capture class in existing capture store | redacts; holds agent memory; machine-local to honor full-input/output custody | Reference hash/status agreement with spine, pin and tombstone checks; no raw replication/network serving. |

**Rule — multi-machine operation carries its limits.** Rules 31, 32, 33, and 113.
Any machine can reconstruct shared manifests, question dispositions and accounting from the
spine at a stated vector. It cannot reconstruct raw local captures it does not possess.
Migration of a worker does not move capture custody or confer source-machine read privileges.
Partitioned authority past its declared horizon blocks new consequential use; observations may
still append under part two's causal admission with taint. Recovery uses part six and cannot
mint a new run identity to evade question dedup. **Check:** P7-NF-34/43/52.

---

## 12. The contract fixtures

**Rule — fixtures must prove both sides.** Rules 34, 36, 37, and 69. Each row supplies
negative and positive cases at the stated stage. Real provider/parser bytes are captured fixtures;
synthetic fault schedules are legal test machinery but not real benchmark scenarios. The build
checks fixture identity and execution records, then part nine reviews semantic adequacy. Named
tests in this design are `declared`, not `held`, until executed; afterward they render held*
until semantically reviewed at the relevant generation. **Check:** P7-NF-01 and P3-NF-28.

| Fixture | Stage | Must reject or expose; positive control |
|---|---|---|
| P7-NF-01 | build | Missing type/field/check inventory or duplicate owner; all eight types and every fixture resolve. |
| P7-NF-02 | decode/compile | Open constructor, unknown schema or changed canonical bytes without migration; old captured version decodes faithfully. |
| P7-NF-03 | arch | Feature, harness or benchmark importing/calling a provider outside the doorway; registered adapter through port passes. |
| P7-NF-04 | decode | Fabricated generation/point/bound; anchored generation and live declaration resolve. |
| P7-NF-05 | decode | Widened floor, invalid argument scope, absent default; permitted member/subset with valid default passes. |
| P7-NF-06 | decode/test | Wrong consumer fail direction or measured-only route using unmeasured support; declared ordinary unmeasured route remains usable. |
| P7-NF-07 | decode | Missing reason, invented evidence, reason identical to conclusion; independent claims with explicit inference pass. |
| P7-NF-08 | contract | Provider output minting permission/approver/tool authority; bounded proposal passes without authority. |
| P7-NF-09 | arch/integration | Model adapter executing tools or dispatch without effect admission; scoped admitted provider call passes. |
| P7-NF-10 | contract | Manifest differs from submitted wire content or falsely claims hidden context; exact scrubbed request/response with declared limits passes. |
| P7-NF-11 | integration | Call after preparation but before six's fenced reservation, stale predecessor/fence or missing actual-start grounding; current reserved call proceeds. |
| P7-NF-12 | integration | Spend/disclosure without current reservation/standing; admitted bounded operation proceeds. |
| P7-NF-13 | build/test | Supervision recursively requesting its own authorization; bounded step supervisor and exact call-admission path terminate. |
| P7-NF-14 | fault | Kill after provider effect before response append; observe same operation, no blind duplicate, unknown exposure retained. |
| P7-NF-15 | fault | Kill after response/resolution before manifest/release; rebuild manifest and acceptance without second call. |
| P7-NF-16 | test | Late answer resurrects terminal request; late observation retained while terminal stands. |
| P7-NF-17 | contract/fault | C attempt maps to two B operations, duplicate charges/results counted twice or content collision silently collapses; same mapping survives takeover, exact receipt dedups, distinct settled attempts both count. |
| P7-NF-18 | integration | Failure/default becomes reported model success, capacity application becomes error; both original refusal and honest default selection survive. |
| P7-NF-19 | test | Cancel/expiry completes directive or manufactures yes; wait closes with durable remainder or explicit work disposition. |
| P7-NF-20 | contract | Provider outage triggers keyword classifier/global channel closure; permitted provider switch or consumer default works. |
| P7-NF-21 | integration | Fallback widens floor/data scope/deadline or bypasses uncertain old execution/charge; compatible fallback after reconciliation and fresh admission records its route. |
| P7-NF-22 | fault | Missing capture/append permits unrecorded call or disables unrelated repair; affected call refuses and minimal plane still responds. |
| P7-NF-23 | decode | Refinement changes raw identity/principal or overwrites Intent; new interpretation links to unchanged Intent. |
| P7-NF-24 | integration | Unclassified ask chooses holder/grant or model claims approval; classification consumes valid operation and computes standing. |
| P7-NF-25 | integration | Old floor, directives, scope or operation reused at effect; current unchanged proposal passes and changed one reclassifies. |
| P7-NF-26 | lifecycle | Hold has no owner/terminal or asks operator for agent-retrievable information; bounded owned resolution path works. |
| P7-NF-27 | build/measurement | Missing caps, wrong subjects/units, pre-attempt holds omitted or undefined rate shown zero; intake-only hold-entry/exit and open waits count, valid zero cap refuses dispatch. |
| P7-NF-28 | test | Estimated/unknown spend shown exact/zero, corrections double-counted; exact settlement replaces reserved liability through recorded reconciliation. |
| P7-NF-29 | fault/measurement | Clock jump, downtime or unresolved waits omitted from latency; flagged interval/open backlog remains visible. |
| P7-NF-30 | fault | C releases reservation, timeout releases unproven budget or new key bypasses old uncertainty; eight's settlement evidence lets six release only the demonstrated remainder. |
| P7-NF-31 | load | Retry, queue, bytes or concurrency exceeds declared cap; boundary and boundary-plus-one produce permitted completion/refusal respectively. |
| P7-NF-32 | test | Failure missing from manifest population; accepted-request enumeration finds every undecided or sealed case. |
| P7-NF-33 | rebuild | View reads other view or differs at same vector; direct-fact rebuild is byte-identical. |
| P7-NF-34 | test | Missing/tombstoned/local-only capture presented as complete remotely; available authorized local capture reconstructs. |
| P7-NF-35 | test | Retracted evidence disappears or retains untainted authority; affected claims and evidence status propagate. |
| P7-NF-36 | integration | Report links to unrelated success or contradicts Result; correct report and mismatching report both reach part-nine review inputs. |
| P7-NF-37 | test | Refuted reason silently keeps same supported-status Decision; affected-claim record identifies reason independently of conclusion. |
| P7-NF-38 | decode/contract | Machine hash/signature upgrades inference or fetched response to external proof; honest attestation class passes. |
| P7-NF-39 | integration | Lost worker uses observation append to accept/execute or grant authority; bound late usage observation alone passes. |
| P7-NF-40 | build/rebuild | Unregistered store/point/metric or authority view without horizon; complete declarations and pinned view pass. |
| P7-NF-41 | e2e/wiring | Production start leaves a port null/no-op or model outage closes all repair; real authenticated request records one bounded call and remains recoverable after worker death. |
| P7-NF-42 | integration | External protection marked held without independent monitor evidence; independent evidence is preserved and missing monitor remains a gap. |
| P7-NF-43 | access | Remote raw-capture fetch or cross-scope reader succeeds; authorized local read and bounded permitted metadata succeed. |
| P7-NF-44 | integration | Replay discloses to unauthorized provider or uses unavailable scenario bytes; permitted transformed input retains lineage. |
| P7-NF-45 | retention | Timer deletes pinned capture or claims bounded retention without lawful policy; eligible tombstone under part-two rules succeeds. |
| P7-NF-46 | decode | Scenario has no real source/grade or benchmark recursively becomes real source; real graded case with scoped transformation passes. |
| P7-NF-47 | test | Expected outcome leaks into replay or changed semantic input retains old measured label; pre-outcome input and exact compatible support pass. |
| P7-NF-48 | test | Omitted/failed candidates disappear from benchmark denominator; all planned candidates have attempt or explicit omission. |
| P7-NF-49 | test | Stale/withdrawn grade or changed model/prompt/floor retains measured status; matching fresh evaluation supports it. |
| P7-NF-50 | build/runtime | Stale doorway/model verification silently trusted; refresh evidence restores eligibility without fabricated model identity. |
| P7-NF-51 | semantic cases | Same cause/different wording and different cause/similar wording are indistinguishable in recorded evidence; both questions/answers are fully recorded for grading. |
| P7-NF-52 | cross-part fault | All four section-10 traces under reordered replication, partition, worker loss and both cancellation orders; no clock winner, lost refusal, unmetered retry or stale-authority continuation. |
| P7-NF-53 | build/integration | Changed prompt/context/model/floor serves with only unmeasured label, queued rerun, wrong digest, incomplete execution or omitted scenarios; exact affected-suite execution opens only the execution gate, failed outcomes remain red, and separate evaluation/consumer requirements still apply. Benchmark-purpose execution cannot serve live work. |

**Rule — non-functional promises carry measured proof.** Rules 13, 34, 39, 43, 46,
55, 60, 75, and 113. The table defines the required measurement and failure action; a test
implementation must supply actual configured limits and captured measurements, not assert that
"fast" or "bounded" passed. **Check:** P7-NF-27/29/31/40/41.

| Property | Automatic check and evidence | Honest limit/failure action |
|---|---|---|
| Queue and total wait | Load/lifecycle test measures accepted-to-terminal duration, oldest open age and hold rate by scope | A process outage can exceed wall-clock SLO; record overrun, expire stale eligibility, recover receipt. |
| Physical and financial capacity | Boundary-plus-one tests at concurrent tokens, money/quota, requests and reserved capture bytes | Stop new affected dispatch; retain uncertain liability and existing evidence. |
| Recovery work | Kill every transition and measure observed recovery duration/attempt count under loop caps | Provider without query proof stays uncertain; no invented at-most-once guarantee. |
| Audit completeness | Reconcile accepted questions, dispatches, manifests, metering and late receipts at a pinned vector | Missing links produce owned backlog, never a smaller success denominator. |
| Multi-machine coherence | Two-architecture replay/permutation and fence/partition suite | Same vector yields same view; different horizon is labelled, raw captures remain local. |
| Privacy and retention | Access tests, scrub fixtures, pin/tombstone tests, retained-byte and oldest-pin measurements | Shape-scan residual remains; routine age deletion awaits lawful policy. |
| Live operation and reachability | Production assembly invokes real ports, one permitted model call and real user surface response; scoped outage test | No mocks/no-ops as lifecycle proof; critical live probe and cadence owner is nine. |

---

## 13. Inherited duties, with honest dispositions

**Rule — nothing assigned here stays deferred.** Rules 49 and 69; P3-NF-24/28. Held in
this table means the design names a check for that portion, not that an unbuilt fixture has run.
Implementation coverage remains declared until check-run evidence exists, then held* until
semantic review. Partial rows name the remainder and its closure owner. **Check:** P7-NF-01
compares this table to inherited references and P3-NF-24 checks landing/deadline dispositions.

| Source and duty | Disposition in this part |
|---|---|
| Big picture §5: rules 4/86/95, declared judgment power/defaults | Held for request/output enforcement: P7-NF-04/06/08/20. Current effect power remains eight's portion. |
| Big picture §5: rule 38, supervised execution | Partial: bounded recorded supervisor invocations and recursion refusal P7-NF-13. Per-pipeline completeness/semantic adequacy/live freshness: nine. |
| Part two rule 24, recurrence fingerprint comparison | Partial: actual model comparison doorway and complete cases P7-NF-51. Similarity accuracy and root-cause follow-through are nine/work-owner duties. |
| Part two rules 41/58, doorway writes attributable judgment facts | Held for full request/response/manifest recording P7-NF-10/15/32; partial for the overall rules because outcomes are graded by nine and local captures can become unavailable. |
| Part two rule 75, token audit | Held for every attempted dispatch including fallback/benchmark/late output: P7-NF-12/17/28/30/48. Provider usage exceptions remain explicitly unknown, with reserved exposure. |
| Part two rule 108, separate conclusion/reason | Held for structure, dependencies and invalidation inputs P7-NF-07/35/37. Re-deriving meaning belongs to nine; its absence is partial, never implied by a schema. |
| Part two redaction section, rules 7/26/58 and evidence-unavailable conclusions | Held for unavailable-state propagation P7-NF-34/35/45. Grading is nine's ownership under the part plan; this part does not call unavailable evidence wrong. Retention reconciliation remains partial in nine. |
| Part four P4-NF-26/27: ask refinement before classification; rules 10/57/82/103 | Held for refined proposal shape and sequencing P7-NF-23/24/25. Semantic correctness is a Value reviewed by nine; effect re-validation stays eight's P4-NF-18 portion. |
| Part four judgment-hold rate/age and changelog cost follow-on: rules 13/39/46/60/75 | Claimed and held for measurement/bound semantics in section 6, P7-NF-27/29/31. No measured deployment result is asserted. |
| Part four durable owner, silence and continuation implications: rules 22/46/83/98 | Partial: questions/waits never manufacture consent or lose owners, P7-NF-19/26. Five owns parent work and awaiting-authorization; six owns recovery. |
| Big picture §§5/8, rule 56 and real-case improvement chain | Held for provenance, compatibility, the independent changed-configuration execution gate and measured/unmeasured separation P7-NF-44/46/47/48/49/50/53. Quality rankings and divergence judgment remain nine's portion. |
| Big picture §5 rule 69 | Held for named checks and declared ownership, P7-NF-01; actual graph edges follow part three's execution/review honesty, never this prose alone. |

**Rule — the grading recipient's inherited inventory is visible at this seam.** Rules 7,
9, 26, 42, 58, 69, 82, 85, 94, and 108. The following records support part nine; they do
not discharge its grading, probe or enforcement duties. The inventory's statement that redacts
is absent does not govern the shape: approved part three's amendment three and the register's
growth list already supply it. **Check:** P7-NF-36/38/42/45 and P3-NF-05/24.

| Part-nine duty | Disposition and supplied contract |
|---|---|
| 9.1, rule 42: detect lying report | Partial: Result/effect/report correlation in section 7. Nine owns detecting the lie, not the recorder. |
| 9.2, rule 85: user feedback becomes improvement | Partial: source Intent, case, claims and later correction links are preserved; nine owns feedback detection and improvement work. A fact correction is not automatically user feedback. |
| 9.3, rule 94: waiver-count review | Partial: request authorityBasis can cite Authorization/waiver facts; nine folds actual waiver facts, not strings in model output. |
| 9.4/9.5, rules 9/26/43 and big picture §7: freshness/guard posture | Partial: source holder, observation time, declared window, generation and capture are present. Nine supplies runtime holders; a stored record is not proof of current liveness. |
| 9.6, rule 7: capture retention | Partial: local custody, capacity, pins and status supplied; bounded routine retention policy remains nine's explicit reconciliation duty. |
| 9.7, rules 28/29/36/43: live canary/authentication probes | Partial: provider observation provenance and real-byte fixtures available; nine supplies independent live probes, not a self-check called proof. |
| 9.8, rule 69: semanticallyReviewed per generation | Partial: compatibility/generation and check references supplied; nine records adequacy and coverage, all unreviewed edges stay held*. |
| 9.9, rule 7: redacts closed-list issue | Held at the schema seam by the already-approved register value; no new amendment required. Actual eligibility/custody remain P7-NF-45 and part two's checks. |
| Shared nine/eleven, rule 82: external reference monitor | Honest gap for dashboard/runtime prevention. Section 8 records attestor and proof scope and refuses self-attested closure. Nine/eleven must name one closure owner and independent enforcement mechanism before protection is claimed. |

**Rule — gaps have accountable landing gates.** Rules 8, 69, and 71. Record completeness
is seven's owned obligation from activation. Grading, runtime freshness, retention reconciliation
and semantic review close with nine's approved part; the monitor's ownership must be explicitly
claimed by the first drafting part among nine/eleven. The rule graph uses existing rule deadlines
and its generated owned loops with calendar ceilings; no indefinite "later" edge is introduced
here. This part cannot invent or extend an operator's rule deadline. **Check:** P3-NF-15/24
and P7-NF-42/45 prevent missing ownership/policy from rendering held.

---

## 14. Terms and the operator's decision surface

**Rule — the new terms have one meaning.** Rules 49 and 69. On approval these definitions
become structured term entries under part three's resolver; they do not redefine imported nouns.
**Check:** P7-NF-01 and P3-NF-10.

| Term | Kind | Definition |
|---|---|---|
| Judgment question | noun | One owned request for bounded reasoning under one input digest and consumer contract. |
| Judgment attempt | noun | One provider invocation, identified before dispatch, whose observations and costs remain separate from other attempts. |
| Judgment resolution | noun | The terminal recorded disposition of a question; distinct from run acceptance and world effect. |
| Ask refinement | noun | Recorded interpretation of an existing Intent yielding a proposed operation, no-operation or unclassified output; never standing. |
| Benchmark record | noun | Immutable real-case manifest from which separate graders obtain question, attempts, resolution and evidence references. |
| Benchmark scenario | noun | Versioned replay input promoted from a real graded case with explicit provenance and disclosure scope. |
| Benchmark run record | noun | Immutable execution record of a predeclared candidate/scenario set, including failures, omissions and usage. |
| Judgment hold cost | noun | Subject-bound measurement record of waiting, attempt costs and unresolved exposure, compared to explicitly labelled policy bounds. |
| Compatibility digest | noun | Canonical identity of the class, prompt/context assembly, floor/schema, model/settings and evaluation contract for which routing evidence applies. |
| Assessment pin | noun | Reference that prevents a case's capture being removed while its judgment, accounting, assessment or dispute remains unresolved. |

**Value — decisions that belong to the operator.** No check chooses these policies. This part
adds no new operator approval step to ordinary work. Its technical design can be reviewed as
written; the following choices remain policy questions for the responsible approval surface:

1. Does the proposed conservative retention posture fit the intended privacy policy: retain
   unresolved evidence, stop new affected model calls at capacity, and have part nine settle
   routine-age retention through the existing amendment path rather than silently deleting it?
2. Which independent trust boundary should protect dashboard/runtime artifacts? This part
   requires honest evidence of it but does not select a host, signing principal or hardware
   anchor on behalf of parts nine/eleven or the operator.

**Value — side effects of adopting this design.** Full local captures consume finite disk and
limit where full-context grading can run. Honest unknown charges can tie up budget. Preserving
failure cases can lower apparently attractive benchmark scores. These are deliberate costs of
auditable judgment; no check proves they are preferable in every deployment. A replacement can
supersede these declarations through approval and schema-compatible readers while keeping old
facts and refusing to relabel old unmeasured routes. Implementation rollback must preserve the
record and pins, not erase the evidence the design was meant to create.

**Rule — implementation earns activation.** Rules 34, 37, 43, 69, and 113. The production
assembly must run unit/decoder tests, full-port integration tests and a real lifecycle from
authenticated intake through a bounded model call and attributable response, with fault recovery
and cross-part ownership checks. This document's governance check alone cannot establish any
of those results. **Check:** P7-NF-41/52 and part three's check-run evidence gate.

*Rule dependency references: approved docs/01-the-rules.md through docs/08-the-intake.md;
big-picture part seven. Behavioral consumers: parts five, six, eight, nine, ten and eleven.
These references resolve under P7-NF-01.*

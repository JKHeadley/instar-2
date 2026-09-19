**Status: draft, awaiting approval. Governed.**

# Part nine — verification holders, probes, retrospective review, and outcome grading

**Value — purpose.** A rule is useful when something holds it and leaves evidence that it did.
A running process is not proof that its guard works; a recorded answer is not proof that it was
right. This part makes those differences visible and gives the unfinished questions an owner.
No automatic check proves the usefulness of this preference or the wisdom of a model's judgment.

**Rule — reading convention and evidence discipline.** Rules 26, 49, 69, 91 and 113;
**checks: P9-NF-01/02** and `node scripts/check-governed-docs.mjs docs`. Each paragraph, table
and sequence belongs to its preceding Rule or Value block. Checks named here are implementation
obligations, not running software. Contract dispositions of held below mean that a checkable
contract is specified; implementation edges remain declared until executed, then held* until
reviewed under part three. This document makes no present-day behavioral claim about Instar 1.x.
Parts five, six and seven are draft dependencies requiring joint contract validation, not approved
foundations. The approved register's `redacts` value is consumed without a new shape amendment.

---

## 1. What this part owns

**Rule — types have one owner.** Rules 1, 30, 49, 69 and 90; **checks: P9-NF-01/02/03**.
This part defines the following ten payload types, built from constitutional values. It does not
extend part one's inventory or add a top-level register kind. Construction is closed, decoding
is total, schema versions migrate before comparison, canonical bytes identify content, and clocks
are explicit Measurement arguments. Admitted fields are immutable. Each has an id and schema
version; identity compares id, version compares migrated canonical content, and divergent content
under one logical key produces Conflict. A changed assessment is a new causally linked fact.

| Defined type | Meaning and sole producer |
|---|---|
| `VerificationPlan` | Versioned holder contract: governed subjects, evidence requirements, observation cadence and consumer failure rules; plan decoder. |
| `VerificationRequest` | One exact question about an operation or rule instance, with required evidence and durable owner; request decoder. |
| `VerificationAssessment` | Whether supplied evidence satisfies that question's declared bar; assessment decoder/derivation. |
| `ProbeRecord` | One scheduled challenge, its execution observations, independent witness and comparison; probe recorder. |
| `RetrospectiveReviewRecord` | A pinned population, actual reviewed cases, omissions, findings and disposition of one review episode; review recorder. |
| `SemanticReviewRecord` | Independent review of a rule-holder edge at one exact register generation; semantic-review decoder. |
| `Grade` | Separate later assessments of a recorded judgment's conclusion, reason and outcome; grader decoder. |
| `AssessmentClosure` | Deliberate closure of a case's assessment obligation, distinct from truth, effect settlement and capture deletion; closure decoder. |
| `FeedbackDisposition` | Durable detection and disposition of user feedback and its improvement obligation; feedback recorder. |
| `BenchmarkEvaluation` | Evaluation of a predeclared benchmark execution population against a pinned grading contract; evaluation decoder. |

**Rule — named types retain their definitions.** **Check: P9-NF-01/03** compares schema owners
and public imports. The names below are references, not parallel representations.

| Owner | Named only |
|---|---|
| One | Decision, Measurement, Evidence, Result, Success, Refused, Outcome, Authorization, VerifiedPrincipal, StandingGrant, Revocation, Intent, Directive, Profile, Scope, ActionFloor, Provenance, SecretRef, Conflict, UnresolvedInput. |
| Two | Fact envelope, causal frontier, append/admission, durability state, capture reference/status, correction, retraction, redaction, projection, checkpoint, folded-through vector and provisional/contested taint. |
| Three | Declaration, register generation, generation record, check-run record, rule graph, honesty class and governed port. |
| Four | Intake port, conversation binding, operation classification, authorization request and session-start evidence. |
| Five | Run, RunStep, RunTransition, RunBudget, RunExit, DelegationContract, DelegationResult, AwaitingAuthorization, ExhaustionRecord, SessionGrounding, ContinuityAccounting, AgentTransportEnvelope, DeliveryEvidence, AgentTransportPort. |
| Six | Lease, FenceToken, AdmissionReservation, LoopPolicy, LoopRecord, RecoveryRecord, ThreadlineRoute and ThreadlineReceipt. |
| Seven | JudgmentRequest, JudgmentAttemptRecord, JudgmentResolution, AskRefinement, BenchmarkRecord, BenchmarkScenario, BenchmarkRunRecord and JudgmentHoldCost. |
| Eight | Effect doorway, operation contract, dispatch and settlement records; eight retains their schema names and owns settled Outcome. |
| Ten / eleven | Concrete adapter and executable assembly contracts / operator surfaces, authorization completion and the minimal live communication plane. |

**Rule — evidence assessment is claimed here; settlement is not.** Rules 26, 33 and 42;
**checks: P9-NF-04/05/06**. Nine owns the verification bar, observation task and acceptance of
evidence. Eight owns querying operation adapters and appending the effect's settled Outcome.
Six owns fenced scheduling and reservation release from eight's settlement. Five owns accepting
results and closing runs. None of nine's records grants permission, releases spend, or changes a
run terminal. These distinctions apply equally to a canary's own effects and to business effects.

---

## 2. A holder has a question, an execution and a witness

**Rule — a plan states exactly what can fail.** Rules 9, 26, 34, 38, 43, 66 and 69;
**checks: P9-NF-02/07/08**. VerificationPlan contains the fields below. It is governed through
part two's version chain and part three's declarations. A holder is a registered construct under
an existing holder kind, not an extra register kind called holder. A holder may have several
arms; each arm has its own evidence and can-fail scope.

| Required field group | Meaning |
|---|---|
| Subject | Rule numbers, holder entry, exact governed object/operation class, scope and generation. `standards` alone never creates a holds edge. |
| Arms | Build/shape check, runtime invariant, live probe, model sentinel, retrospective review; each names its executable, fixture stage, actual output contract and can-fail evidence. |
| Bar | Typed claim predicates, permitted evidence sources/strength, exact subject/digest binding, capture requirements, freshness and completeness requirements. |
| Independence | Tested principal, observer principal, who controls the witness and which common failures can fool both; no self-report presented as independent evidence. |
| Scheduling | Accountable owner, part-five run/obligation, part-six loop policy, cadence, finite age window, due action and recovery budget. |
| Bounds | Finite attempt, duration, concurrency, byte, token, money and notification caps; named resource entries, zero preserved. |
| Consumer | Each consumer's open/closed direction, enforced governed record and decoder for any block; preserved-input location. |
| Privacy | Reader/provider disclosure scopes, local capture class, secret custody and allowed canary destinations. |
| Activation | Required unit, integration, live lifecycle and semantic cases; declared limits and evidence needed before the instance is live. |

**Rule — proof of running is not proof of passing.** **Checks: P9-NF-07/09/10** enforce
rules 9, 26 and 43. ProbeRecord contains plan/version, logical scheduled slot and attempt identity,
subject and challenge digest, admitted run/operation references, start and completion observations,
witness Evidence references, comparison Result, missing phases, capture status, measured costs
and causal predecessors. Its completion records `passed`, `failed`, `inconclusive`, `not-run`,
or `cancelled` as comparison dispositions, without replacing constitutional Result/Outcome.
A scheduler firing proves only scheduling. A worker receipt proves only worker receipt. A fresh
failed probe proves the holder ran and failed; it never satisfies protection health. A timeout
with no witness is inconclusive, not proof of absence. Historical successes remain readable.

**Rule — every critical pipeline has explicit supervision coverage.** Rule 38;
**checks: P9-NF-08/11**. The runtime holder compares each pipeline's declared required step
boundaries with actual part-seven supervisor attempt/resolution references and their operation
links. Missing supervision and unavailable supervision are distinct from affirmative validation.
A light model validates each critical business step; the deterministic call-admission/bootstrap
exceptions in six/seven remain narrowly enumerated. No supervisor recursively authorizes its own
model call. Missing evidence affects only that pipeline's declared integrity admission; it cannot
become a global conversational gate. Semantic adequacy remains independently reviewed inference.

**Value — intelligence holds meaning, checks hold its attendance.** No deterministic check can
prove that a watcher noticed every subtle failure. The plan requires a watcher and review for
each mind-held rule, while coverage honestly separates their execution, semantic review and
remaining limits. Agreement between two models is still inference, not deterministic proof.

---

## 3. Runtime freshness and guard posture

**Rule — freshness is tested at consumption, not refreshed by copying.** Rules 13, 26, 56,
69 and 95; **checks: P9-NF-09/10/12**. The runtime freshness holder joins source observations,
current plan versions, observed instance/incarnation, register generation and part-two source
status at a pinned vector. A consumer calls part one's evidence freshness function with a real
clock reading, then checks subject, capture availability and taint. A returned old receipt keeps
its original observedAt; retrieval time cannot reset it. Exactly at the declared end of a
freshness interval the evidence is expired; future or incomparable clock evidence is unknown
until validated, not fresh by subtraction. If an earlier type decoder uses another endpoint
convention, the integration check refuses activation until the common convention agrees.

**Rule — scheduled scans supplement the consumption check.** **Checks: P9-NF-09/12/13**.
Every live instance and required arm appears in the due index from activation, including never-run
holders. Scans use six's bounded loops, fair paging and persistent cursors. Process downtime and
missed ticks count toward observed lateness; restart coalesces work rather than erasing missed
observations. The fold stores observation facts and deadlines, never reads a clock. A pure
query over that view and explicit now derives age. It cannot issue new Evidence simply to renew
an old claim. Unknown registered lineages retain part two's unknown-staleness semantics.

**Rule — guard posture has independent columns.** Rules 26, 69, 72 and 73;
**checks: P9-NF-10/14**. The runtime coverage rendering carries generation, folded-through vector,
known-lineage set and evaluation clock. For each edge and deployed instance it shows declared
status, implementation/wiring evidence, semantic-review generation, last attempted and last
successful probe, source/capture status, and present posture. Present posture is `healthy`,
`failed`, `stale`, `unknown`, or `inactive`. Healthy requires every required arm to have a current
successful observation under the current contract; a missing arm cannot be averaged away. Failed
and inconclusive attempts remain visible even if a later pass restores current health.

Static part-three counts remain separate: declared, held-reviewed, held-unreviewed, partial,
deferred and gap. Runtime evidence changes no hermetic build exit code and edits no generated
register. Runtime activation/dispatch gates may consume it explicitly under their own declared
policy. Totals enumerate the population and missing instances; zero eligible instances is
undefined coverage, never 100 percent. Dynamic enumeration limits remain attached to each kind.

**Rule — the watchers cannot certify their own survival.** **Checks: P9-NF-13/15/16**.
The freshness and posture holders are themselves registered critical outcomes. An observer under
the external protection boundary in section 9 checks their challenge completions and feed age;
the status consumer independently expires that observer's evidence. There is no endless chain
of monitors: the trust root is externally administered and its absence renders unknown. A dead
observer cannot keep a cached green badge alive. Loss of all displays/observers cannot promise a
notification; the supported guarantee is that no available consumer treats expired proof as live.

**Rule — failure direction is per use.** Rules 14, 66, 86 and 95;
**checks: P9-NF-10/16**. Informational status and advisory review fail toward labelled delivery.
Required release, protection and irreversible-effect evidence fail closed for the affected
consumer with preserved input and an owned repair obligation. A semantic suspicion is a signal,
not an invented deterministic block. Each governed-state gate names the approved evidence policy
and decoder it enforces; its executing principal cannot amend either. Independent diagnosis and
operator stop remain available through their own established authority.

---

## 4. Probes exercise the real boundary

**Rule — regression replay and live canaries have different evidence.** Rules 26, 28, 29,
36, 43, 62 and 105; **checks: P9-NF-17/18/19**. Captured-byte replay exercises the running
adapter against its recorded parser contract. A live canary originates a fresh unpredictable
challenge outside the adapter being tested and witnesses its passage through the real boundary.
The challenge is bound to subject, scope, destination, payload digest and single scheduled slot.
Only an independently collected receipt for that challenge and the claimed stage satisfies it.
HTTP success, process existence, a heartbeat or an adapter's own pass string cannot substitute.

**Rule — canaries use ordinary authority and bounded effects.** Rules 28, 35, 55, 60 and 63;
**checks: P9-NF-18/20**. Canary actors are registered production system principals with narrow
observation grants and designated operator-owned probe resources. Fixture identities never enter
production stores. No live negative test impersonates a real user or performs a harmful action.
A negative authority probe asks for a harmless operation against an isolated probe target and
expects the real admission boundary to refuse; production unauthorized mutation is never needed
as proof. Every send, launch, provider call and cleanup is admitted through five/six/eight with
its own budget and stable operation identity. Cleanup is owned work; failed cleanup retains its
resource charge and changes the probe posture. Stop and off-switch inhibit new canaries.

**Rule — the matrix covers every live adapter and stimulus class.** **Checks:
P9-NF-17/19/21** combine part-four parser facts and part-ten family realization. No empty sender
field makes a senderless adapter vacuously authenticated. Each row below requires both a valid
challenge and a refusing or inconclusive neighbor, real captured fixtures for the external parser,
and a live witness. Unsupported proof is an explicit partial class; activation cannot claim its
critical outcome held. Production samples demonstrate the tested path, not absence of compromise.

| Adapter/stimulus class | Positive live witness | Negative neighbor and honest limit |
|---|---|---|
| Conversation, channel-attested | Independently originated message in a designated bound channel; witness matches authenticated sender/channel, receipt and actual worker consumption | Same display name/different authenticated id cannot select binding; forwarded text cannot confer standing. Stolen platform credentials can fool channel attestation; no probe upgrades it to verified. |
| Signed webhook/service | Fresh signed body/id/recipient through real endpoint and independently observed intake disposition | Modified body, wrong recipient, stale key, replay collision and invalid signature refuse. An unsigned fetched API record remains channel-attested. |
| Scheduler/recovery/system injection | Challenge signed or token-authenticated by registered source, matched to intended job/run and worker receipt | A reachable local socket with no credential has no authority; wrong job/scope and expired credential refuse. |
| Agent transport | Peer challenge through registered route; signed receiver admission and actual worker-consumption/result receipt tied to original semantic id | Relay-only ack never proves peer delivery; key churn, changed digest, recipient mismatch and absent receipt stay refused/uncertain. Lost ack uses read-only receipt lookup, never child resubmission. |
| Harness | Grounded worker consumes a fresh scoped prompt through intake and emits the matching admitted receipt/result | Writing stdin, a session label or spawn success without consumption fails; direct unauthenticated injection has no privileged route. |
| Model | Admitted bounded call with exact submitted-capture digest, returned receipt and usage/unknown-exposure record | Wrong endpoint identity, response bound to another request, fabricated model version and missing usage are exposed; a fluent answer is not provider authentication or quality proof. |
| Persistence/vault | Nonsecret challenge record survives actual append/restart/read under declared durability; unauthorized independent reader is refused | Hash without authentic source, acknowledged lost append or unauthorized read fails. SecretRefs stay references; test secrets remain isolated fixture material. |
| Effect adapters | Harmless exact operation on designated resource, independently queried by its operation id | Wrong object/digest, eventual search miss and still-live executor cannot settle non-occurrence. Never probe payments by spending without the declared authorized budget. |
| Surface/operator approval | Independently administered probe credential exercises the same verifier on an isolated, non-governing request; verified receipt binds exact request digest | Agent identity, chat attestation, replayed yes and moved base cannot authorize. A canary may not mint a real operator approval; actual protected-path enforcement is section 9's broker test. |

**Value — starting cadence is a deployment choice.** No check proves an optimal sampling rate.
Proposed defaults are five minutes for critical live outcomes, fifteen minutes for adapter
fixture replay, daily retrospective coverage and weekly full semantic-edge coverage. Each live
plan must supply an explicit finite cadence, freshness window and measured capacity budget;
shorter harm horizons require tighter plans. Missed samples and capacity refusals remain visible.
These are proposed policy values, not observed latency claims or proof that a five-minute window
is safe for every operation. The bar for irreversible use still applies at its point of use.

---

## 5. Verification and uncertainty reconciliation

**Rule — every unsettled operation has a discoverable question.** Rules 8, 24, 26, 42 and 46;
**checks: P9-NF-04/05/22**. VerificationRequest contains logical request key, originating
operation/attempt and reservation references, exact operation digest and scope, requested
predicate, plan/bar version, initial evidence, missing evidence, accountable owner, six's
loop reference, clock and source generation. Eight persists or reconstructs this question from
every unresolved dispatch; a scan joins dispatch facts to settled facts, so a crash before a
callback cannot strand it. Re-observation keeps the operation identity; it is not another attempt
to perform the effect. A changed bar requires a new linked question, never an easier silent test.

**Rule — evidence acceptance is explicit and scoped.** **Checks: P9-NF-04/06/23**.
VerificationAssessment contains request, operation/attempt/digest, bar version, observer identity,
input Evidence references and missing references, pinned vector, current capture/taint statuses,
per-predicate verdict and reason, validity window and superseded assessment when any. Verdicts
are `satisfied`, `contradicted`, or `insufficient`. Semantic predicates additionally reference a
part-seven Decision. The assessment exposes separate predicates for occurrence, non-occurrence,
old-executor quiescence and charge settlement; it cannot collapse them into one success bit.
Evidence strength stays part one's weakest-member rule. A valid signature authenticates a
statement's source; it does not prove that source's claims about the world are true.

| Settlement question | Evidence sufficient under a declared adapter bar | Evidence that cannot answer it |
|---|---|---|
| Did this effect happen? | Authoritative destination receipt or read tied to exact operation, destination and digest, at the demanded durability/stage | An unrelated success, a transport ack for worker delivery, or the submitting worker's unsupported claim |
| Did this effect not happen? | Authoritative complete operation history through the relevant boundary, proving no application, with declared consistency/completeness guarantee | Empty eventually consistent search, timeout, connection close or elapsed deadline |
| Can the old attempt still execute? | Destination-enforced fence/cancellation or authenticated executor quiescence and proof no queued accepted request can still apply | New lease, local process disappearance or cancellation request merely sent |
| What was charged? | Authoritative final accounting tied to the original attempt, including residual liability bound | No response, estimate labeled exact, or cancellation without a billing guarantee |

**Rule — eight consumes, six settles resources, nine never retries the effect.**
**Checks: P9-NF-05/06/22/24**. The order is unresolved dispatch → owned observation → adapter
query through eight → evidence append → nine assessment → eight's current-authority and
assessment recheck → eight settlement fact → six's conditional reservation update → five's
conditional progression. Satisfied occurrence may settle execution while charge remains unknown.
Automatic re-execution requires sufficient non-occurrence, old-attempt quiescence and settled
liability, plus fresh admission. Missing any required predicate leaves uncertainty and its
maximum reservation. Destination deduplication is useful evidence but does not let nine override
six's original-operation reconciliation contract: an uncertain effect permits read-only
observation, never even same-key idempotent resubmission. An authorized risk-taking
new action is not evidence that the original never happened.

**Rule — evidence can arrive after ownership ends.** **Checks: P9-NF-06/24/25**.
A narrowly authorized observer can submit facts about the original attempt after worker fencing,
cancellation or timeout. The observation port verifies original binding, recorder identity and
scope and exposes no execute, accept, release or resume capability. A conflicting assessment is
recorded; neither fold order nor a later clock chooses its winner. Eight closes only from a
current, untainted accepted assessment. Retraction or compromise of source evidence invalidates
future use, opens reassessment and preserves any already-performed effect as history.

---

## 6. Retrospective review and never-wasted feedback

**Rule — review starts from a complete population, not an author's highlights.** Rules 9,
24, 41, 58, 65, 85, 107 and 111; **checks: P9-NF-26/27/28**. RetrospectiveReviewRecord
contains plan, reviewer identity and independence evidence, population query and pinned vector,
source generation, case ids, actual inspected references, omitted/unavailable cases and reasons,
sampling seed/strata when used, model attempt and Decision references, findings, per-finding
severity and owner, layer-below evidence, next work and closure. Every accepted question,
refusal, default, cancellation, feedback item and unsettled case remains in the denominator.
No filtering to completed/successful cases is allowed without a separately displayed full total.
Late facts trigger a linked review or supplement; a closed window does not hide late evidence.

**Rule — semantic work runs through seven under six's bounds.** Rules 38, 41, 55, 60 and 75;
**checks: P9-NF-03/27/29**. Review batches retain causal context, surrounding conversations,
original floor, outcomes and current evidence status. Authorized local review consumes captures
where they live. Provider submission is separately authorized disclosure, not implied by reader
access. Review data is delimited untrusted input and supplies no authority. A failed model leaves
an incomplete review and owned next observation, never a keyword substitute or fabricated finding.
Review of reviewer quality uses bounded independent samples; it does not recursively review every
review before allowing any to finish. Cost and omissions remain visible.

**Rule — the mind-held roster is enumerated.** **Checks: P9-NF-08/26/30**. The register's
mind-held rules each require their generated session-reading duty, focused watcher and
retrospective arm. This plan covers rules 3, 16, 17, 18, 19, 25, 48, 50, 51, 54, 80 and 108.
The watcher compares recorded decisions and context across cases: unsupported capitulation,
repeated manual work, recurring repairs, unnecessary interruptions, declared development tier,
surface clarity and reasons refuted after a conclusion. Five's semantic duties also enter the
population: neutral dispatch (27), exhaustion adequacy (20/21/23/99), answerable gaps (22),
grounding comprehension and continuity (96/110). Seven's recurrence comparison and supervision
quality are graded here. Each required duty gets an explicit inspected/not-inspected result;
one generic “review ran” cannot discharge twelve duties. Semantic accuracy is partial, not
proven by this coverage check.

**Rule — a false report is compared with its actual subject.** Rule 42;
**checks: P9-NF-31/32**, including P7-NF-36's integration inputs. Reports name the original
Result, operation and claim subject. Deterministic comparison exposes a typed success claim
about the same refused operation; no alternate success id may satisfy that join. Natural-language
reports undergo a separate full-context judgment comparing what the reader would understand
with those records. “The refusal was handled” can be true while “the requested payment succeeded”
is false; capacity-applied loop success is never business success. An unlinked report is incomplete
and enters the missing-link population, not excluded. Suspected prose contradiction remains an
inference finding. Confirmed correction becomes a prompt, bounded delivery obligation through
five/eight; the original report and refusal remain. The review does not block ordinary messages
while awaiting a model. Sophisticated lies and unseen external truth remain an honest limit.

**Rule — user feedback has its own lifecycle.** Rule 85; **checks: P9-NF-28/33/34**.
User feedback is a person's correction or account of failure; part two's correction is a fact
replacement mechanism. One does not imply the other. Every new admitted conversational input is
durably indexed for bounded feedback inspection, including inputs not linked to a judgment.
Explicit verified feedback submissions enter directly; a model detects implicit correction from
context and records a Decision. No keyword miss means “not feedback.” FeedbackDisposition carries
source Intent/capture, scope, detection Decision or explicit submission reference, related case/
claim/finding ids, classification, owner, improvement Run reference, evidence and next due action.

Its dispositions are detected, investigating, improvement-owned, verified-improvement,
duplicate-linked, or declined-with-reason. A negative inspection is retained as review evidence
and sampled for missed feedback. Duplicate links retain each user's input and occurrence count;
semantic dedup uses a recorded judgment, never equal wording alone. Verified-improvement requires
the owning run's actual exit evidence and targeted regression/live proof where required.
Declining a requested change records why and preserves the feedback; it neither claims improvement
nor supersedes a Directive. Open work cannot close because the response was sent or the backlog
hit a cap. Overdue work is surfaced with its owner. Detecting every implicit correction remains
partial; the capture, inspection coverage and follow-through are mechanically held.

**Rule — waiver review folds Authorization facts.** Rule 94; **checks: P9-NF-35/36**.
The waiver projection consumes actual kind-waiver Authorization facts, rule versions, associated
act evidence, retractions and conflicts. It reports distinct waivers per rule/version/scope,
distinct linked acts, unused waivers, acts lacking a causally prior matching waiver, and missing
or contested joins at a stated vector. Duplicate deliveries do not increase counts. Counted
waivers are evidence for review, never retroactive permission or authorization scope expansion.
A backdated timestamp without causal precedence does not excuse the act. A review compares counts
and reasons across windows and proposes a governing change via ordinary approval, not by editing
the rule automatically. Repeated waivers create an owned review finding; zero count proves nothing
when the window is incomplete. The review owns no new waiver type.

**Rule — convergence names the independent judgment and accepted residue.** Rules 65, 107
and 111; **checks: P9-NF-26/37**. Review records identify actual passes, findings per category,
severity trend, independent reviewer distinct from the artifact author, inspected foundation one
layer below and accepted residue with reasons. The reviewer may judge convergence when remaining
findings no longer change the outcome; a fixed round count cannot declare it. Missing layer-below
work, missing produced evidence or self-review cannot produce the convergence record. A script
checks that this happened, not that the judgment was wise.

---

## 7. Outcome grades and real-case benchmark evaluation

**Rule — grade from seven's record without rewriting it.** Rules 26, 41, 58 and 108;
**checks: P9-NF-38/39/40**. Grade identifies the sealed BenchmarkRecord, request/resolution,
Decision when present, exact criterion/plan version, grader and part-seven grading Decision,
pinned source vector/generation, inspected and missing source references, current capture and
taint statuses, observation window and superseded grade. It carries separate assessments below.
No Decision in a defaulted/cancelled/refused case is explicit absence, not a manufactured answer.
Those cases still receive outcome and process assessments and remain in population totals.

| Grade dimension | Allowed assessment and meaning |
|---|---|
| Conclusion | supported, contradicted, unverifiable, or not-applicable; evidence references and separate reason required |
| Stated reason | supported, contradicted, unverifiable, or not-applicable, independent of conclusion |
| Outcome | met, unmet, pending, unverifiable, or not-applicable against the originally recorded observable subject/window |
| Process | satisfied, violated or unverifiable for each declared floor, authority, supervision and reporting requirement |
| Case completeness | complete, incomplete or disputed, with exact missing/conflicting references; complete never means correct |

**Rule — grading does not confuse outcome with causation.** **Checks: P9-NF-39/40/41**.
A good result from a wrong reason is conclusion-supported/reason-contradicted, not a full pass.
A correct reason and bad result are independently expressible. A refusal may obey policy while
leaving the requested goal unmet. An unexecuted proposal has no observed business success.
Outcome assessment uses the promised subject and horizon; observations outside it are separately
recorded. Counterfactual correctness not established by available evidence is unverifiable, not
inferred from the chosen action's success. Model grades are inference, preserving uncertainty and
source provenance; opaque confidence percentages are not factual Measurements of correctness.

**Rule — refuted reasons force re-derivation.** Rules 24 and 108;
**checks: P9-NF-40/42**. A dependency scan joins source corrections/retractions, disputes and
capture unavailability to both claim dependency lists in seven's manifest. Refuting a reason
opens a new bounded judgment that re-derives the conclusion from current admissible evidence,
even if the prior conclusion remains plausible. The original Decision and Grade are unchanged.
Unavailable evidence makes the affected claim unverifiable; it does not by itself refute it.
Current route support or consequential reliance cannot keep using a withdrawn grade. Late source
facts invalidate affected assessment closures for future custody decisions and reopen the task.

**Rule — assessment closure is deliberate and cannot settle the world.**
**Checks: P9-NF-22/38/42/43**. AssessmentClosure contains case id, exact assessed source vector,
required assessment list and dispositions, active dispute check, referenced terminal resolutions,
settlement/accounting references, responsible reviewer, closure Decision and causal predecessor.
It closes assessment as assessed or evidence-unavailable-with-reason. Both require that every
required assessment has a recorded disposition, no open dispute and no unsettled attempt exposure.
Unavailable evidence may end futile active grading with a recorded limit; it never counts as a
pass or authorizes scenario replay. Pending assessment cannot be closed by a timer. Any closure
only releases its own assessment pin, never another conflict/authorization/settlement pin and
never capture bytes. New relevant evidence creates a linked reassessment under the same case.

**Rule — promotion is a judgment about a real case.** Rules 27, 56 and 58;
**checks: P9-NF-44/45**. Nine supplies seven's scenario admission with a Grade and a promotion
Decision naming the real source case, issue, proposed class, representativeness limits and
transformation adequacy. Synthetic contract fixtures and benchmark-produced outputs cannot be
new real-case roots. Replay inputs exclude actual outcomes, grades, expected answers and later
conversation; evaluators receive those separately. A transformed scenario retains original and
transformed hashes and changed fields. Missing authorized reconstructable input makes it
ineligible, not a convenient invented substitute. The promotion never expands disclosure rights.

**Rule — evaluation includes failures and holds its own criteria fixed.**
**Checks: P9-NF-45/46/47**. BenchmarkEvaluation names the BenchmarkRunRecord, all predeclared
candidates/scenarios and execution references, input/compatibility digests, criterion version,
grades, missing/cancelled/refused executions, sample sizes, held-out grouping, costs and chosen
route Decision or explicit no-selection. The evaluation contract fixes dimensional pass bars,
critical failure rules and cost/latency tradeoff before examining candidate outcomes. A changed
criterion produces a separately versioned comparison, never a retroactive win. Related examples
from one source conversation/incident remain in one partition; a held-out label with leaked source
siblings fails. Tuning outcomes do not enter the held-out population unnoticed.

All planned executions remain in their denominator; zero denominator is undefined. Missing
executions cannot yield a complete evaluation. A known failed execution can complete execution
accounting while failing quality. Ranking honors each consumer's mandatory quality/safety bar
before its declared tradeoff; absent adequate support produces no measured winner. Seven's
changed-configuration affected-suite execution gate remains independent: a Grade, evaluation or
unmeasured label cannot waive it. Support withdrawal invalidates future measured routing and keeps
historical route choices intact. A live-case versus benchmark comparison uses matched class,
window, completeness and criterion, records drift as a bounded review finding, and never silently
rewrites routing. Semantic representativeness and “best” remain Value judgments with evidence.

**Value — no universal numeric quality threshold.** No automatic check chooses how much accuracy,
cost or delay a consumer should trade. Deployment declarations must state finite operating limits
and explicit criterion versions before activation; unmeasured quality is reported as unmeasured.
The proposal favors independent grading with reviewer access separated from replay input, at a
cost in model calls. Its worth is a policy choice, not a schema theorem.

---

## 8. Retention: preserve knowledge and admit the remaining gap

**Rule — the existing redaction contract is the only byte-removal authority.** Rules 7,
26, 90 and 100; **checks: P9-NF-43/48/49** plus P2-NF-65/66/67 and P7-NF-45. The redundant
proposal to add `redacts` is dropped; the register already supplies it through part three's
amendment three. This part neither extends the growth list nor adds routine age to part two's
closed redaction reasons. An eligible deletion still requires operator standing, a permitted
reason, surfaced delay, tombstone, retained envelope/hash and current absence of protected pins.
Timers, successful grading and full disk are not redaction authorizations.

**Rule — local captures have finite admission capacity, not guaranteed finite lifetime.**
**Checks: P9-NF-43/48/50**. Seven's exact input/output captures remain machine-local and never
served raw over a network. Before new capture-producing work, six reserves space for bounded
input/output and nine's assessment overhead. Existing pins for unresolved judgments, accounting,
assessment, Authorization provenance and open Conflict remain. At the cap, new affected calls
refuse with preserved input; independent minimal communication and repair keep their reserved
capacity. Pin age, reserved and retained bytes, refused new work and incomplete grading are
registered Measurements. A closed assessment cannot make a still-unsettled exposure deletable.

**Rule — post-removal review tells the truth about its evidence.** **Checks: P9-NF-39/43/49**.
Durable facts retain bounded case identity, separate conclusion/reason, grading criteria,
evidence and outcome references, dispositions and improvements; large bytes remain in captures.
A lawful tombstone preserves its own evidence and updates captureStatus through part two.
Available-at-sealing does not mean available-now. A later grade requiring removed bytes reads
unverifiable; it cannot claim to reconstruct the original exchange from a summary or hash.
Projection deletion remains safe only because it removes no unique knowledge from the spine.
Summarization is not asserted lossless and is not permission to delete its source.

**Value — duty 9.6 is partial, with an honest policy gap.** No check can reconcile incompatible
retention policies by inventing permission. This design holds finite capacity, pin safety,
reviewability metadata and truthful loss-of-evidence states. It does not satisfy a universal
maximum age for raw judgment captures under the approved reasons. The implementable default is
retain evidence and refuse new affected capture work at capacity. Routine expiry stays disabled;
there is no deferred unnamed implementation. Adopting routine expiry requires an atomic governed
amendment defining which knowledge may be lost, a new lawful reason and matching changes to the
fact/capture and judgment contracts. This document proposes no such hidden amendment. The operator
may choose that different policy at approval; until then the gap is recorded under nine's owned
rule-7 review obligation and cannot render fully held.

---

## 9. The external protection anchor, claimed explicitly

**Value — nine owns the reference monitor outside the monitored agent.** No check chooses the
administrative trust boundary. This design claims its enforcement contract here, including runtime
and dashboard-governed artifacts. Eleven owns how a human views and approves a request, not the
monitor. Ten realizes process/storage isolation. The proposed monitor is a small separately
administered broker under an operator-controlled OS/service identity, outside the agent's write,
credential, process-debug and administrator authority. Being a second process under the same
writable account is insufficient. An agent with host root or control of that administrator is
outside this guarantee; such a deployment must show the relevant artifacts as unprotected.

**Rule — protection includes the loaded artifact and all bypass paths.** Rules 82, 98, 101
and P3-NF-27; **checks: P9-NF-15/51/52**. The independently installed boundary denies the agent
writes to protected files, their parent directories, replacement/symlink targets, governing policy,
monitor executable, trust keys, launch configuration and mutable dependencies. The trusted loader
pins the exact admitted content when loading it; substituting a copy through environment, plugin,
config or alternate launch path cannot install governing content. The agent cannot signal/debug
or replace the broker or inspect its signing credentials. A local filesystem name alone does not
make a running policy protected. Prevention tests actually attempt bypasses under the full agent
credential set against an isolated protected artifact and confirm the effective loaded digest.
A passing scan from the agent's own checker is insufficient evidence.

**Rule — the broker enforces existing Authorization, not a new approval type.**
**Checks: P9-NF-51/53/54**. Eleven supplies part one's verified explicit yes bound to requester,
approver, scope, exact artifact/base and requestDigest. The broker independently checks that
Authorization through trusted pinned decoders, current grant/revocation state and current base;
its operational principal cannot amend enforced policy. It rejects agent-kind/self approval,
channel-attested yes, stale base, substituted paths and replay against changed content. Agent
work may propose bytes and request installation, but cannot complete approval. Repository
protection separately requires the host's non-agent approval rules and verified signed review
record; fetched records and merge events do not replace that anchor.

**Rule — protected installation is recoverable without trusting a local success report.**
**Checks: P9-NF-53/55**. Eight calls the broker through an admitted operation. The broker durably
journals the operation identity, request digest, exact prior and proposed content and checked
Authorization before committing. A transactional store or versioned immutable object plus atomic
current-version switch binds the effective change to that journal; after crash, querying the
same operation returns the effective version and recorded disposition, never re-applies on a
new key. It emits independently authenticated receipts into the normal evidence path. Receipt
absence stays uncertain. Dispatch and comparison occur under the broker's own exclusion so a
base movement cannot slip between verification and commit. The broker retains its external
journal until its signed history is durably represented and remains queryable for deduplication;
it is a registered authoritative store, not an undisclosed cache.

**Rule — the trust root cannot be rotated by its subject.** **Checks: P9-NF-15/52/54**.
Initial policy/key/loader installation and recovery are operator-administered, pinned outside the
agent account. Rotation requires an independently authenticated operator act bound to old and
new root material, a recorded governed transition and trusted administrator installation; lost
root recovery uses that separate administrative path. A monitor unable to establish its own root
or current authority refuses protected mutation. Unprotected drafts, ordinary authorized work,
read-only diagnosis and the separately grounded minimal plane continue. Root compromise is an
explicit protection failure, not something a heartbeat can repair into proof.

**Rule — every claimed protected class earns independent live evidence.**
**Checks: P9-NF-15/51/56**. The external observer verifies effective policy, forbidden write and
load paths, exact broker receipt and freshness on a cadence. Repository rules, runtime files and
dashboard-governed records have separate posture rows. No working repository rule certifies a
local runtime file. An unavailable broker makes required protected mutation closed and current
protection evidence unknown/stale, with an owned repair item. Lack of enforced OS/service
separation is an honest deployment gap; that class cannot be called protected before ten's
isolation proof and eleven's verified surface are wired. Nine owns closing the enforcement test,
not assuming those pieces already exist.

**Rule — an installed verifier selection is not readiness evidence.** Owner: Nine for the
independently administered challenge service and its evidence; Ten owns only installation
selection; Eleven consumes the verdict. **Check: P10-SI-13**. The readiness predicate binds
the exact service id, administrative domain, independently installed trust reference, surface,
generation, comparable current clock, `issue` and `verify` operations, unpredictable one-use
challenge, expiry and replay protection to current authenticated evidence. An `independent`
field, installer signature, selected port, empty probe list or agent-administered service refuses.
The positive neighbor is that same declared selection joined to a current independently signed
challenge execution and required live probes. The binding may be prepared while readiness and
the `independent-challenge-verifier` hold remain false.

---

## 10. Semantic review at every held edge

**Rule — semantic approval is bound to the exact generation.** Rules 26, 65 and 69;
**checks: P9-NF-14/30/57**. SemanticReviewRecord contains edge identity, exact generation, rule
version, holder/fixture/decoder hashes, actual check-run references, evidence population,
independent reviewer identity, review Decision, coverage limits, layer-below evidence and verdict
adequate/partial/inadequate. The reviewer examines whether the fixture can fail for the rule,
not just whether it exists; both a violation and realistic compliant neighbor must be exercised.
A changed rule, holder or generation cannot inherit an old reviewed flag automatically.

The derived semanticallyReviewed value is the exact generation of an accepted adequate record,
or never. Historical review remains visible, but only an exact current-generation match counts
held-reviewed. An unchanged edge can be reviewed at a new generation using a recorded dependency
comparison and independent acceptance, never an unrecorded carry-forward. Concurrent incompatible
reviews produce a dispute and the conservative unreviewed/partial current rendering, not a
clock-selected approval. New weak evidence cannot overwrite an earlier adverse record silently.

**Rule — all held edges enter the review obligation.** **Checks: P9-NF-14/30/58**.
Each generation's full held-edge set is compared with reviewed records. Review scheduling covers
every edge within its declared window, including rarely executed gates and these verification
holders. New generations do not reset the oldest unreviewed obligation for an unchanged edge;
coverage debt retains its first-seen cause and deadline. Sampled deep audits supplement, never
substitute for, the per-edge adequacy decision. Dynamic constructs discovered outside the register
become explicit unregistered findings with owned declaration work, not silently invented coverage.
Part three still owns graph structure and static rendering; nine supplies review facts and the
separate runtime rendering. Neither claim of semantic review nor live health is inferred from
configuration.

---

## 11. Storage, declarations and multi-machine behavior

**Rule — all new payloads use the spine and declare their consumers.** Rules 7, 32, 33, 45,
69 and 113; **checks: P9-NF-01/36/59**. All ten payload schemas are shared facts on part two's
spine. Every existing projection explicitly folds or ignores each new kind. New views below
fold source facts directly with the decoded generation, propagate taint/capture status and obey
part two's corrected-pair handling and permutation/pinned-rebuild tests. No view reads another
view's storage. All have owner nine, status live only at evidence-backed activation, growth
deletes and holdsAgentMemory no; they are machine-local because they are disposable derivations.

| View | Inputs/merge rule | Removal and agreement |
|---|---|---|
| Verification due | Dispatches, requests, observations, closures; set-union, incompatible logical closures exclusive-singleton | Detail leaves only on closure; dedup/conflict keys stay; no unresolved dispatch loses its task |
| Guard posture | Plans, instances, check/probe/source-status facts; set-union with causal assessment heads | Every declared instance/arm represented, now supplied outside fold; no stale green after rebuild |
| Review and semantic coverage | Case/edge population, reviews, disputes; set-union and exclusive conflicting verdicts | Generation coverage and omitted-case totals reproduce at equal vector |
| Grade and affected claims | Seven's manifests, outcomes, dependency changes, Grade and AssessmentClosure; set-union, conflicting heads explicit | Old grades remain lookup-able on spine; changed dependency reopens exactly affected obligations |
| Feedback improvement | Intake, inspection, FeedbackDisposition, RunExit; set-union and explicit linked duplicates | Every admitted input inspected or pending; no improvement closed without its disposition |
| Waiver review | Actual Authorizations, acts, rule versions and retractions; set-union then exact counts | Duplicate-free counts and missing causality agree with source facts, never waiver prose |
| Benchmark evaluation | Seven's scenario/run facts, Grades and BenchmarkEvaluation; set-union with conflicts explicit | Full candidate population and current support status reproduce; missing data never improves score |

**Rule — external storage is enumerated too.** **Checks: P9-NF-51/55/59**. The protection
broker journal is a shared, signed authoritative fact store under its separate administrative
principal, growth unbounded, holdsAgentMemory yes, status live only at verified activation. Its
agreement with the agent spine is authenticated receipt reconciliation by operation identity and
exact digest; the agent may ingest evidence, never write the broker's authority record. Local
broker indexes are disposable machine-local views with growth deletes and memory no. Capture
storage is the existing local judgment class with growth redacts and memory yes; no new shadow
capture archive evades its access or pin rules. Full-history growth is measured, not claimed
bounded by trimming its index.

**Rule — declarations use the existing kinds and state each gate's power.**
**Checks: P9-NF-02/07/08/60**. Freshness/posture, report review, feedback, waiver review, semantic
review and grading register as features and duties of observation, with their actual watcher,
proof artifact and holds scope. Model watchers are sentinels with scope retrospective and authority
signal. Probe outcomes and the external monitor are critical outcomes with their own probes;
parsers carry captured fixtures and authenticationClass/eventIdAuthority/ackPolicy. Required
bounds pair with real constructs and probes. Each feature declares the five-field Profile for
its worst case: integrity/protection control, costly, agent, none; operator-facing review data
gets its own user/dashboard profile; provider disclosure and probe effects inherit their actual
money/external irreversible profiles. All repeat through concrete named bounds. Metrics are the
subjects in section 13. Activation rejects incomplete declarations rather than assigning a
convenient generic profile.

Verification evidence admission, assessment closure and protected installation are blocking sites:
authority block, governed-state with approved bar/schema/Authorization decoder references,
closed for unsupported integrity claims, and preserved-input custody references. Secret, spend
and stop rungs retain ruled-three. Advisory findings cannot acquire this power through a severity
label. The executing principal cannot author the policies it enforces. All sites name the P9
suite as inspectedBy; production wiring proves the named decoder actually runs.

**Rule — replicas share evidence, not assumed currency or raw captures.**
**Checks: P9-NF-24/25/59/61**. Reordered/duplicate observations collapse by semantic identity;
concurrent differing claims remain Conflict. Historical grades retain their vector. A partitioned
reader labels missing lineages and closes only authority-dependent consumers past their bound.
Raw judgment captures remain local; moving a grader does not move custody. Remote review may
consume authorized derived facts, or place a bounded worker at the capture-owning machine under
existing standing. It cannot fetch raw captures through a hidden network port. Permanent loss
is recorded as unavailable, never cured by invented evidence.

---

## 12. Behavioral seams and four traces

**Rule — cross-part behavior has a closure owner.** Rules 31, 33, 42, 63, 69 and 113;
**checks: P9-NF-01/04/24/62**. The coordination declaration is maintained outside governed
documents. The contract order fixed in sections 1–11 applies at every public port: producers supply
the original authoritative facts; nine assesses at a pinned horizon; the relevant owner consumes
under current authority. Wiring tests cover facts/register, intake/adapters, runs/loops,
effect settlement, judgment/grading, scenario/routing, semantic coverage, feedback/waivers,
capture custody, external approval and assembly/status. Missing consumer implementation is
partial coverage, never a passing no-op. These four traces are the required integration answers.

| Trace | Nine's answer | What nine must not claim |
|---|---|---|
| Crash after effect, before record | Recover the original VerificationRequest from unresolved dispatch, query exact operation, preserve missing witnesses, assess occurrence/quiescence/charge separately. Eight settles and six releases only their proved portions. A broker change is queried from its independent durable journal. | A new worker/key, absent receipt or expired timer proves non-occurrence; a recovered local Grade settles an external effect. |
| Duplicate delivery | Same logical request/slot/case-criterion-vector and digest returns existing disposition. Distinct fact ids do not create two grades, improvement runs, canary successes or settlements. Different digest conflicts. Receipt lookup is read-only and preserves the original observation time. | Another delivery means another real case, newer proof, fresh child or renewed authority. |
| Cancellation racing completion | Inhibit new probe/model effects and acceptance under five/six. Retain already-admitted effects, late observations and costs. Causal completed evidence stays history; cancellation first prevents consequential continuation; incompatible concurrency stays disputed. Outstanding exposure and dispute pins survive. | Cancellation undoes a send, a grade resumes cancelled work, or a clock chooses the run terminal. |
| Stale authority | Recheck generation, bar, scope, grant, fence, source taint and capture status at execution and use. Narrow late observer evidence may append without acceptance/execution power. Historical assessments remain labelled; current reliance refuses until sufficient evidence exists. | A signature, old reviewed flag, fresh lease or copied receipt cures stale standing or missing evidence. |

---

## 13. Contract fixtures and non-functional checks

**Rule — each fixture has a real positive neighbor.** Rules 34, 36, 37 and 69;
**checks: P9-NF-01/62/63**. Every row names required future executable evidence, with valid
and invalid inputs at its stated stage. Contract parsers use real captured bytes; synthetic fault
schedules test failure handling but never count as real benchmark roots. The manifest maps each
Rule to fixtures and their actual check-run records. Unit, full-port integration and production
lifecycle tiers are mandatory for significant features. A document lint proves none of them.

| Fixture | Stage | Failure exposed; valid neighboring behavior |
|---|---|---|
| P9-NF-01 | build | Missing type/duty/seam/check or duplicate owner; complete inventories resolve |
| P9-NF-02 | decode/compile | Open constructors, unknown schema, invalid canonical version or missing plan fields; known migrated values pass |
| P9-NF-03 | arch | Private model/effect/provider path or projection reads another view; public ports and declared pure folds pass |
| P9-NF-04 | integration | Assessment substitutes for effect settlement; nine evidence, eight settlement and six release remain separate |
| P9-NF-05 | fault | Unknown operation retried via new key/provider/route; original identity stays pending until all required predicates pass |
| P9-NF-06 | contract | Weak absence, wrong digest, stale evidence or live old executor settles failure; exact complete evidence passes |
| P9-NF-07 | build | Rule cited only through standards, missing witness or fixture; actual holds arm resolves |
| P9-NF-08 | build/integration | Required mind duty or supervisor boundary omitted; every required arm has recorded inspected/missing state |
| P9-NF-09 | unit | Old receipt copied fresh, exact expiry or clock jump treated fresh; in-window comparable evidence passes |
| P9-NF-10 | integration | One pass masks missing/failed arms or closes all chat; scoped posture and independent delivery continue |
| P9-NF-11 | integration | Missing supervisor treated affirmative or recursive supervisor admission; real bounded step review recorded |
| P9-NF-12 | lifecycle | Never-run instance omitted or restart resets missed time; original due debt survives |
| P9-NF-13 | load/fault | Starved due holder, full-history scan each tick or self-certified liveness; fair bounded scans and independent witness work |
| P9-NF-14 | rendering | Held-reviewed and held* totals merge or old generation counts current; exact generation matches and separate counts |
| P9-NF-15 | lifecycle | Dead monitor keeps green or root installed from agent-writable config; independently pinned current witness passes |
| P9-NF-16 | fault | Optional holder failure stops minimal repair or required integrity proceeds without proof; affected scope alone closes |
| P9-NF-17 | contract | Fixture replay labeled live canary; independent fresh challenge required |
| P9-NF-18 | lifecycle | Canned pass, wrong nonce/destination or missing worker receipt passes; matching actual boundary witness passes |
| P9-NF-19 | contract | Missing adapter/stimulus class or channel attestation upgraded; every live class has honest proof/limit |
| P9-NF-20 | integration | Canary bypasses grants/caps/stop, pollutes production with test user, or drops cleanup; narrow production principal and owned cleanup pass |
| P9-NF-21 | contract | Wrong signature/key/sender/scope accepted or system locality authenticates; correct class-specific evidence passes |
| P9-NF-22 | fault | Crash before verification callback loses pending operation; scan reconstructs same question |
| P9-NF-23 | decode | Occurrence and charge collapsed, forged source strength or wrong bar; separate predicate evidence passes |
| P9-NF-24 | multi-machine | One of section 12's four traces violates authority/identity/order; both causal orders and genuine concurrency tested |
| P9-NF-25 | integration | Fenced observer accepts/executes/releases; original bound late observation alone passes |
| P9-NF-26 | review | Success-only population or omitted duty/layer-below work; inspected/omitted totals match complete pinned population |
| P9-NF-27 | access | Review discloses local captures to unauthorized provider/reader; allowed local and separately permitted provider use pass |
| P9-NF-28 | lifecycle | Feedback not linked to a model case vanishes; intake-driven inspection includes it |
| P9-NF-29 | fault | Model outage fabricates review/keyword conclusion or creates unbounded recursion; incomplete owned bounded review survives |
| P9-NF-30 | semantic | Existence-only edge review or sampled subset claims full coverage; every edge gets an independent adequacy decision |
| P9-NF-31 | integration | Refused payment reported paid using unrelated Success; same-subject contradiction found while honest refusal handling passes |
| P9-NF-32 | semantic cases | Indirect lie missed by coverage accounting or honest capacity report called failure; full-context judgment records both and its uncertainty |
| P9-NF-33 | semantic cases | Implicit correction and similarly worded non-correction collapse by keywords; contextual decisions and missed-case audit retained |
| P9-NF-34 | lifecycle | Feedback closed by reply/cap without improvement or justified disposition; real exit/regression evidence closes correctly |
| P9-NF-35 | rebuild | Waiver prose/duplicate/late timestamp creates legitimate count; real distinct causally prior Authorizations count |
| P9-NF-36 | permutation | Corrections double-count or waiver/feedback views differ at equal vector; corrected source facts converge |
| P9-NF-37 | review | Round count/self-review declares convergence; independent trend decision with accepted residue passes |
| P9-NF-38 | decode | Grade edits BenchmarkRecord or default invents Decision; sealed manifest plus separate Grade passes |
| P9-NF-39 | semantic cases | Missing evidence graded wrong/pass, expired historical capture called present; honest unverifiable case retained |
| P9-NF-40 | semantic cases | Right conclusion/wrong reason collapsed or outcome assumed causal proof; independent dimensions and re-derivation exercised |
| P9-NF-41 | integration | No effect or late outcome counted within original horizon; original subject/window evaluation passes |
| P9-NF-42 | lifecycle | Refuted reason keeps support or closure hides late dispute; linked reassessment and support invalidation occur |
| P9-NF-43 | retention | AssessmentClosure deletes bytes/releases another pin or closes unsettled exposure; deliberate assessment-only closure passes |
| P9-NF-44 | decode | Synthetic or benchmark-generated case becomes real root; real graded provenance passes |
| P9-NF-45 | evaluation | Expected outcome or related source leaks into held-out input; isolated input/evaluator partitions pass |
| P9-NF-46 | evaluation | Failure/omission removed, zero denominator green, criterion changed after results; fixed complete comparison passes |
| P9-NF-47 | integration | Evaluation waives seven's rerun gate or withdrawn grade still measures route; independent gates and current support pass |
| P9-NF-48 | retention | Timer/cap/closed grade used as redaction permission; approved reason/standing/delay/tombstone alone qualifies |
| P9-NF-49 | retention | Lawful removal loses envelope or unavailable status; retained record and tainted claims remain |
| P9-NF-50 | load | Full capture store deletes pinned history or new calls exceed reserve; affected admission refuses, minimal plane remains |
| P9-NF-51 | isolation | Agent writes protected bytes via parent/symlink/debug/alternate loader; boundary refuses all enumerated paths |
| P9-NF-52 | isolation | Agent replaces monitor/policy/root or has admin override yet claims protected; independent administration passes |
| P9-NF-53 | integration | Moved base/replayed yes/path swap slips between check and commit; atomic exact broker transaction passes |
| P9-NF-54 | contract | Chat attestation, agent approval, merge event or fetched unsigned record authorizes; exact verified operator record passes |
| P9-NF-55 | fault | Broker crash after mutation loses journal or repeats operation; same-id query returns actual admitted version |
| P9-NF-56 | lifecycle | Repository protection stands in for runtime isolation; each claimed class proves its own live boundary |
| P9-NF-57 | semantic | Old generation or conflicting review silently becomes current adequate; exact accepted record derives semanticallyReviewed |
| P9-NF-58 | lifecycle | Generation churn resets unreviewed debt or dynamic construct disappears; persistent debt/finding remains owned |
| P9-NF-59 | rebuild | Undeclared store/input, direct view writes or out-of-scope capture fetch; complete facts-based views reproduce |
| P9-NF-60 | build/wiring | Missing profile/bound, signal becomes block or decoder is no-op; complete least-authority declaration and actual invocation pass |
| P9-NF-61 | fault | Partition hides lineage or remote grade claims local bytes; horizon/taint and custody limits propagate |
| P9-NF-62 | e2e/wiring | Real initialization has null ports or no live canary/grade; authenticated bounded slice survives crash cuts |
| P9-NF-63 | build | Unexecuted fixture, absent test tier or author lint labeled runtime proof; actual check-run evidence required |

**Rule — non-functional claims carry measured subjects and failure actions.** Rules 13, 34,
39, 43, 46, 55, 60, 75 and 113; **checks: P9-NF-09/13/20/46/50/59/62/63**. Activation
requires concrete finite limits and workload/hardware/provider metadata. The checks measure actual
samples, including timeouts, missing samples and zero-cap refusals; configured limits are never
reported as observed performance.

| Property | Automatic workload and measurement | Bar and failure action |
|---|---|---|
| Freshness | Clock boundaries, suspended worker and withheld old receipt; observation age per arm/instance | Zero stale observations consumed as fresh; expired status with scoped refusal |
| Detection delay | Disable actual guard under load; challenge-to-failure-observation and failure-to-visible-status | Within declared cadence plus attempt and display budgets while dependencies available; outage overruns explicitly recorded |
| Review completeness | Mixed successful/refused/open cases and generation churn; oldest unreviewed age and inspected/eligible count | Every case/edge counted; overdue debt stays owned, no success-only denominator |
| Resource use | Flood probes/feedback and fail every model call; reserved/used bytes, tokens, money, concurrent tasks and loop attempts | No declared cap exceeded by admission; no episode identity resets pressure |
| Retention | Fill local capture class with pinned and closed cases, race dispute/redaction | Zero unauthorized byte removal; new affected work refuses; absence never graded success |
| Replay/coherence | Two architectures, late facts, duplication, corruption, checkpoint and full replay | Same vector gives identical view bytes; budget overrun distinguished from divergent data |
| Outcome reconciliation | Delay original executor past missing search result, lose receipt/charge | No retry or release from insufficient evidence; uncertainty age visible without false completion |
| Independent protection | Full agent credentials attempt every write/load bypass, kill broker at each transaction cut | Zero unauthorized effective changes; each admitted change queryable, class unprotected if isolation missing |
| Human attention | Burst findings across many subjects and prolonged outage | One bounded aggregate per declared attention window; actionable results route through existing surface, no per-item flood |
| Live usefulness | Production intake → real worker/judgment → harmless effect → independent probe → Grade → rebuild | Every port real, required three tiers and real-surface witness; optional holder failure preserves independent repair |

---

## 14. Inherited duties and disposition

**Rule — no inherited duty remains deferred to this part.** Rules 8, 49, 69 and 71;
**checks: P9-NF-01/63** and P3-NF-24. Every partial duty below has a precise residual. Its
owner is nine's verification-policy/review obligation, using the existing generated rule loop
and calendar deadline; activation refuses missing owners/deadlines. This design cannot extend
an operator's deadline. Where a full rule has no holder, part three emits its synthetic gap;
where part is held, its holds declaration carries the uncovered portion. Runtime implementation
honesty remains separate from these design dispositions.

| Duty | Disposition and evidence |
|---|---|
| 9.1 — rule 42, lying reports | **Partial:** deterministic same-subject contradictions and durable full-context review P9-NF-31/32; semantic lies/unobservable world state are not exhaustively detectable. |
| 9.2 — rule 85, never-waste feedback | **Partial:** intake enumeration, detection record and improvement closure P9-NF-28/33/34; implicit-feedback classification can miss meaning, covered by independent missed-case audits. |
| 9.3 — rule 94, waiver-count review | **Held:** actual waiver projection, causal act check and review population P9-NF-35/36; choice to amend a rule remains the operator's. |
| 9.4 — runtime freshness holder | **Held:** consumption-time age/source checks, never-run population and restart debt P9-NF-09/12/13; unknown clocks/lineages refuse authority honestly. |
| 9.5 — runtime guard posture | **Held:** per-arm/per-instance results and independent expiring witness P9-NF-10/14/15/16; not a promise to communicate during total observer/surface loss. |
| 9.6 — rule 7 with bounded capture retention | **Partial; honest policy gap:** finite capacity/pins/availability P9-NF-43/48/49/50 held; routine maximum-age deletion is disabled under current lawful reasons, not promised. Nine owns any explicit policy amendment proposal. |
| 9.7 — live canary/authentication per adapter class | **Partial:** enumerated live matrix and independent challenges P9-NF-17–21; channel-attestation compromise and opaque provider internals cannot be eliminated by sampling. Unsupported classes never claim full protection. |
| 9.8 — semanticallyReviewed generation tracking and coverage | **Held:** exact-generation independent records, every-edge population and separated totals P9-NF-14/30/57/58; wisdom of the semantic judgment remains inference. |
| 9.9 — proposed redacts closed-list addition | **Held/resolved:** drop the redundant proposed addition and use approved part-three amendment three; P3-NF-05 and P9-NF-48 enforce existing eligibility, no second growth value. |
| Shared eight/nine — uncertainty reconciliation | **Held evidence contract, claimed here:** distinct predicates P9-NF-04–06/22–25; eight owns settled Outcome, six release and five progression. Adapter without decisive evidence stays uncertain, automatic retry ineligible. |
| Shared nine/eleven — external protection anchor | **Held enforcement contract, claimed here:** separate administrator, mandatory write/load boundary, broker journal and probes P9-NF-15/51–56. Deployment without ten's isolation/eleven's verified surface is explicitly unprotected, never assumed complete. |
| Five — dispatch neutrality, exhaustion, answerable gaps, comprehension/continuity | **Partial:** actual full-context review duties P9-NF-26/30/37; no proof of omniscient avenue enumeration or model comprehension. Five retains work closure. |
| Seven — supervision, recurrence accuracy, separate claims, assessment pins, scenario quality and drift | **Partial:** coverage, independent grades, re-derivation, closure and fixed-population evaluation P9-NF-08/11/38–47. Semantic accuracy and representativeness stay judged; record completeness and route execution remain seven's. |
| Three/four — dynamic unregistered constructs | **Partial:** observed constructs become owned findings P9-NF-26/58/60; genuinely unseen dynamic paths remain the declared enumeration residual. |

---

## 15. Terms and decisions that belong to the operator

**Rule — load-bearing words have one meaning.** Rules 49 and 69;
**checks: P9-NF-01/02** and P3-NF-10. These are proposed structured term entries for conversion
on approval, not additional schemas or redefinitions of imported terms.

| Term | Meaning |
|---|---|
| Verification holder | Registered construct whose execution can expose a named rule violation and produces the plan's evidence. |
| Verification bar | Versioned subject-specific predicates and source/strength/completeness requirements for accepting evidence. |
| Live canary | Fresh bounded challenge through a real production boundary with a separately collected witness. |
| Guard posture | Current per-arm/per-instance protection assessment derived from source evidence, separate from declaration and semantic coverage. |
| Semantic edge review | Independent judgment that a named holder's exercised check addresses its rule at one exact generation. |
| Outcome grade | Later separate assessments of conclusion, stated reason, observed outcome and process from the original recorded case. |
| Assessment closure | Deliberate end to an assessment obligation that releases only its own pin, never execution uncertainty or byte custody. |
| User feedback | A person's correction or failure report, distinct from a fact correction in part two. |
| External protection broker | Independently administered reference monitor that is the only authorized writer/installer of protected effective content. |
| Quiescence evidence | Evidence that the original admitted attempt cannot still apply, including queued destination work, not merely an absent process. |

**Value — operator decision: retention policy.** The recommended implementable default preserves
pinned/unique evidence and limits new capture admission. No check chooses whether the resulting
availability cost is acceptable. A universal age cap requires a separately explicit atomic policy
amendment; this draft does not smuggle one into a holder. The precise operator question is whether
to keep this default or authorize that policy redesign with an explicit acceptable knowledge-loss
boundary.

**Value — operator decision: external administration.** No check decides who should control the
trust root. The proposal requires an independently administered monitor/loader and denies the
agent administrative override. The operator question is whether that deployment boundary and its
recovery responsibility are acceptable. Without it the product must label runtime/dashboard
artifacts unprotected even if repository protection works.

**Value — operator decision: observation cost.** Cadences, grading tradeoffs and complete
per-generation semantic review consume storage and model budget. No check establishes optimal
rates. The proposal starts with section 4's cadences and requires actual deployment measurements
before claiming a detection bound; the operator may choose different governed finite limits.

**Value — adoption and rollback costs.** The design can lower apparent success rates by keeping
missing and failed cases in view. It may hold reservations indefinitely and refuse new captures
at capacity. Those are explicit costs of honest evidence, not performance guarantees. A successor
policy can change choices through approval, while retaining old facts, disputed grades and
custody obligations. Disabling a holder cannot retain its healthy status or unpin its evidence.

**Rule — technical completion is not approval or runtime certification.** Rules 34, 65, 82,
90 and 109; **checks: P9-NF-62/63** and the governed review process. Implementation admission
requires the real three-tier and seam fixtures above. Independent convergence and exact-content
operator approval remain separate from an author's document check. No deployment, approval,
independent review result or production protection is asserted by this draft.

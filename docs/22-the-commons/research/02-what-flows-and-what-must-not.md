# R2 — What flows and what must not

**Status: research contract candidate. Governed. No implemented schema or sharing authorization.**

## Source and authority boundary

**Rule — bind this derivation to its actual sources.** **Check:** `P21:` below names
`docs/21-the-recall-doorway/` at commit `e0ddbd533126648cdb32c442936ab01a271bfc93`
on `design-recall-doorway`, read using `git show` from this worktree. Part 21 is absent from
this branch's base; it has not been copied in or silently treated as merged. Its
[§9](https://github.com/JKHeadley/instar-2/blob/e0ddbd533126648cdb32c442936ab01a271bfc93/docs/21-the-recall-doorway/09-coherence-outcomes-and-user-perspective-measurement.md)
and [§10](https://github.com/JKHeadley/instar-2/blob/e0ddbd533126648cdb32c442936ab01a271bfc93/docs/21-the-recall-doorway/10-the-pilot-human-comparison-and-incident-replay.md)
are the pinned recall design inputs. `P20:` names `docs/20-measurement-ledgers/` at this
branch's base `808ca2424d9c6ec5e0920142b62ebd3f4738e5b9`. That source retains `P16-NF`
check identifiers and calls its package sixteen internally; citations here preserve those
identifiers rather than inventing new owners. The following requirements are proposed contract
Rules with review/fixture checks; this file does not claim those checks already execute.

**Rule — feedback is evidence beneath purpose, never a grant.** **Check:** every proposed
promotion carries its deciding purpose/pillar/constraint and owner approval, or an explicit
candidate amendment; a fleet score cannot mutate governing material. This follows
`docs/00-the-purpose.md:54–75,115–138` and `docs/04-the-big-picture.md:296–312`.
Standing affects whose judgment applies to a scope, while evidence strength affects what is
known. An authenticated operator can have a mistaken explanation; an anonymous case can reveal
a reproducible defect. Store these dimensions separately. No volume of votes can authorize a
pillar contradiction, and signing an export never makes a claim true.

**Value — two tiers share evidence contracts, not private custody.** Every agent's local loop
can preserve and evaluate a case whether fleet sharing is enabled or not. An operator-run
commons and the maintainer front should use the same contract and different destination-bound
consent and identities. This derives from the local loop/self-hosting boundary in
`docs/04-the-big-picture.md:316–338` and the factory split established in R1. Cross-commons
forwarding is a new export, not an implied right acquired by receiving a case.

## Three objects that must remain different

**Rule — a derived signal is not an incident replay.** **Check:** construct three separate
artifact kinds and reject attempts to relabel one as another without the owning validation.
The source distinction is `P21:09-coherence-outcomes-and-user-perspective-measurement.md:3–21,74–81`
and `P21:10-the-pilot-human-comparison-and-incident-replay.md:117–145,178–194`.

| Object | Local custody | Default fleet payload | Permitted inference |
|---|---|---|---|
| Original episode | Intake, source frontiers, permitted originals, actual input, effects and outcome | None | Can support owner-validated diagnosis locally |
| Derived learning case | Accountable diagnosis/grade and references to the episode | Closed categories, coarse measurements and destination-scoped opaque identities | A reported signal with stated evidence strength; not remote proof of private originals |
| Exportable replay/scenario | Synthetic fixture, or specifically authorized sanitized production derivative plus its semantic-loss record | Separate, explicit richer-sharing attachment | Replayable only if shape, custody, export and decision-time validation pass |

A procedural lesson is a fourth, separate proposal linked to the derived case; it is not a
rewrite of the original episode or a reader-visible answer key. A shared result with private
sources may remain an attestation forever. That is preferable to sending originals merely to
make the front call it proof.

## Cause labels and their evidentiary burden

**Rule — labels are hypotheses with stage evidence, not complaint synonyms.** **Check:** for
each row below, replay a positive fixture and a near-neighbor whose missing evidence forbids
the label. Preserve multiple supported labels, disputed diagnoses and explicit unknowns.
`P21:09-coherence-outcomes-and-user-perspective-measurement.md:3–44` distinguishes observed
behavior from inferred failure stage and candidate recall from actual input and behavior.

| Requested cause label | Required local witness | Insufficient witness / boundary |
|---|---|---|
| `not-captured` | Expected permitted intake/custody opportunity plus evidence of a missing capture, or a recorded capture failure at the relevant frontier | Later inability to open a source is only unavailable custody, not proof it was never captured |
| `not-found` | Captured permitted original support existed at decision time; index/query/selection records establish failure to retrieve sufficient support | Forbidden history is not a healthy recall target; missing index coverage and source loss remain separately diagnosed |
| `found-not-delivered` | Sufficient permitted support in candidates/selected packet plus evidence of omission during rendering, context assembly or submission to the reader | An intended prompt log without actual-input evidence cannot prove delivery or omission; recipient-message delivery is a different stage |
| `delivered-not-used` | Sufficient permitted support confirmed in actual provider input and a graded output/action that failed to use it appropriately | A manifest of intended input is insufficient; rightful withholding is not misuse |

**Rule — behavior and mechanism have separate fields.** **Check:** a correct private internal
use paired with rightful non-disclosure is a success; a wrong-audience disclosure fails even if
recall was accurate. Keep P21 outcome labels `missed`, `obsolete`, `unnecessary-hold` and
`wrong-audience` independently of the cause list. Mechanism uses a closed vocabulary for
capture, index lag/hole, query, selection, permission, rendering, submission, reader use,
review and recipient delivery, plus `unknown` with a bounded reason code. Store internal-use,
provider exposure, prepared-output and actual-delivery stages separately. Source:
`P21:09-coherence-outcomes-and-user-perspective-measurement.md:23–54`.
A use-or-withhold judgment also needs its sensitivity/audience category, declared criterion,
observed effects and later outcome; omitting these would turn wisdom into retrieval accuracy.

## Candidate derived-case schema

**Rule — the export decoder is closed at every depth.** **Check:** unknown properties,
arbitrary text in ids, URLs, file paths, credentials, null-as-unknown, unbounded arrays and
unsupported schema versions refuse locally before network serialization. The front independently
validates the same public schema. This adapts P21's tagged observations and closed-object
validation (`P21:10-the-pilot-human-comparison-and-incident-replay.md:136–156,197–205`).
An observation is `{state:known,value:...}` or `{state:unknown|unavailable|not-applicable,
reasonCode:...}`. For wire privacy the reason is an enumerated code, not private free text;
local evidence retains the fuller explanation. Below is a schema inventory, not executable JSON
Schema and not a new core fact type.

| Field group | Candidate fields and constraints | Meaning / owner |
|---|---|---|
| Envelope | `schemaId`, `schemaVersion`, `caseKind`, `exportId`, `destinationId`, `consentVersion`, `exportPolicyVersion` | Immutable serialized export with a locally retained receipt; case kinds are recall outcome, graded decision, benchmark result, correction |
| Attribution | Destination-scoped key id/pseudonym, bounded enrollment epoch, signature, authenticated admission receipt | Transport provenance only; admission resolves asserted standing against actual grants |
| Canonical identity | Destination-scoped `caseKey`, `assessmentKey`, optional `supersedesAssessmentKey`, `parentExportKey` | One local canonical opportunity across retries/children/graders; no raw principal/run/conversation ids |
| Origin | `productionDerived`, `synthetic`, evidence strength, owner-validation state, independent-verification state | Imported self-report never silently becomes proof; synthetic cannot claim a real production origin |
| Coherence | Outcome labels, expected-use/withhold category, stage observations, cause assessments with evidence-state tags | P21-derived diagnosis separate from observed outcome and withhold correctness |
| Mechanism | Registered component/retriever/index/extractor/embedding/reranker/renderer ids and versions; capture/index/submission coverage categories | Exact public software identities when approved; private custom identifiers remain local or opaque |
| Model/decision | Provider/model public id and settings profile, prompt/context-assembly/action-floor/output-schema identities, conclusion grade and reason grade separately | Seven/Nine owner meanings; ids/hashes only for public artifacts or destination-scoped opaque mapping for private ones |
| Timing | Event-window class, clock comparability state, binned age/latency, timeout/cancellation categories | Exact times and source frontier remain local by default; coarse wire time cannot establish exact owner-window membership |
| Quantities | Registered units, raw population/coverage counts where privacy policy permits, cost/usage buckets and known/unknown price state | Part 20 owner-derived exports; no duplicated local scoreboard |
| Grade | Criterion version, grader kind, scoped standing class, grading method, evidence class, conflict/currentness status, observed-outcome category | Outcome, reason and grading authority remain independently falsifiable; no raw rationale text by default |
| Benchmark | Scenario/version, candidate, planned execution ordinal or aggregate profile, run/plan identity, compatibility state, graded/eligible/missing/refused/cancelled/pending/conflicted counts | Exact public scenario ids only; private scenario ids are scoped opaque labels, not comparable public tasks |
| Correction | Target assessment, old/new diagnosis or grade codes, causal successor, correction author standing and evidence state | Updates the current view while preserving prior claims; conflict is not last-arrival-wins |
| Disclosure | Mode, field-policy digest, transformation id, declared semantic-loss codes, receipt/revocation linkage | States exactly what was exported and what the transformation prevents a reviewer from concluding |

**Rule — separate local evidence fidelity from fleet comparability.** **Check:** a decoder
must label coarsened/private compatibility identity `not-comparable`, never invent equality
because model names match. Exact prompt or original-content hashes are not automatically safe:
known-content guessing and cross-record linkage can expose information. Keep private source
hashes, causal frontiers, support references and precise timestamps local. Export an opaque
mapping whose private preimage the front cannot resolve. Public artifact digests may remain exact.
This is a proposed privacy restriction on P21's locally detailed replay contract, not a claim
that hashing anonymizes data. P20 demands full resolved compatibility rather than an opaque
digest (`P20:07-feature-benchmark-and-burn-joins.md:42–71`).

**Rule — only the measurement owner supplies counted populations.** **Check:** duplication,
retry, late grade, conflicting grade, missing peer, empty denominator and incomparable-clock
fixtures must retain P20 semantics. Production grade coverage counts canonical accepted questions;
benchmark coverage counts the planned `(run,scenario version,candidate,ordinal)` set, including
missing/refused/cancelled executions. Cases with multiple diagnoses still count once per eligible
opportunity. A complaint and its later correction do not create two failures. Preserve the
P21 canonical opportunity-to-P20 owner mapping rather than assuming their root identities are
interchangeable. Sources: `P20:07-feature-benchmark-and-burn-joins.md:16–40`;
`P21:09-coherence-outcomes-and-user-perspective-measurement.md:56–72`.

Public exact export requires privacy permission and the full owner evidence. A content-free
aggregate whose member identities remain private must say so; it cannot independently prove
fleet deduplication or independence. Aggregate only compatible populations, separate evidence
strength/self-interest classes, retain missingness, and never average local percentiles into a
fleet percentile (`P20:07-feature-benchmark-and-burn-joins.md:99–109`;
`P20:09-retention-reconstruction-and-multiple-machines.md:28–56`). A fleet aggregate is not
an implicit global poll of all Instar agents; the denominator is its reported participating
population with selection/coverage limitations. Privacy suppression is not a zero.

## Privacy and consent floor

**Value — propose local-only until fleet enrollment, then content-free sharing as the default
payload.** The brief requires content-free default sharing and per-agent opt-in for richer
sharing; it does not settle initial enrollment UX. Local-only before destination-specific
operator enrollment is the proposed choice under sovereignty and purpose constraint 5.
If that pillar does not decide the enrollment policy at design review, record a candidate
purpose amendment rather than assume consent. Every agent continues its local loop regardless.

**Rule — richer sharing requires a separate, current export grant.** **Check:** the local
effect/export doorway resolves the agent's operator grant, destination, allowed artifact kinds,
fields, purpose, retention terms and expiration immediately before first send and retry.
Per-agent opt-in is necessary but cannot override other principals' custody, audience or
non-disclosure constraints. Preview the actual transformed payload and its losses. Revocation
stops unsent/retried richer payloads; sending to a new commons requires a new grant. Configuration
updates cannot silently enable sharing or broaden fields. This extends P21's explicit
sanitized-production export decision requirement
(`P21:10-the-pilot-human-comparison-and-incident-replay.md:181–194`) and the purpose's authority
boundary (`docs/00-the-purpose.md:111–138`). Enrollment does not authorize model training,
public git publication or onward resale/rebroadcast of private replay material.

**Rule — content-free means no user content in any default field or channel.** **Check:**
serialize adversarial canaries through success, refusal, retry, error and diagnostic paths;
inspect network bytes and logs. Reject raw prompts, messages, outputs, grading explanations,
original corrections, lesson prose, names, emails, conversation/topic ids, file paths, URLs,
private source hashes, embeddings, gradients and free-form custom labels. Export code must not
open raw captures merely to construct a content-free row. Bounded enumerations and approved
public software ids reduce the attack surface; an arbitrary string called `reasonCode` is still
a covert text channel. This closes the R1 sender/receiver gap
(`1x:src/core/FeedbackManager.ts:182–194`; pinned source in R1).

**Rule — pseudonymity has a declared linkability scope.** **Check:** two commons receive
unrelated enrollment keys and case identifiers; rotation preserves corrections only by an
explicit local link; neither raw agent name nor a global installation id reaches the wire.
Keys authenticate enrollment, not unique human ownership. Front-side rate limits, principal
standing and suspected coordinated submissions stay separate. Across rotations or commons,
independence may be unknown; do not claim perfect Sybil resistance or deduplication. A
self-hosted fleet operator may knowingly enroll several agents, but cannot multiply that into
several independent human judgments. The need is grounded in R1's shared-name/hash limitations;
the particular key-rotation policy remains a Value for later design.

**Rule — account for the hostile front, including metadata.** **Check:** privacy review
covers every row below and refuses an unqualified anonymity claim.

| Front observation or attack | Residual knowledge | Candidate local boundary |
|---|---|---|
| IP, connection times, enrollment keys | Network origin, activity pattern, longitudinal linkage | Document unavoidable transport exposure; consider relay/batching, without claiming either hides all metadata |
| Rare version/model/error combinations | A recognizable operator workload or rare incident | Generalize rare categories, cap contribution and suppress small cohorts; utility loss remains visible |
| Repeated or specially chosen evaluations | Membership and behavior inferred from differencing results | Admit fixed approved experiments locally, bound repeat queries and privacy spend; never execute arbitrary front code |
| Rich replay / export URL | Anything actually exported, plus copies retained by a dishonest receiver | Separate grant, authorized storage and scoped access; never bearer-like public private-data URLs |
| Return package/proposed lesson | Injection or a request to change authority | Treat content as untrusted evidence; verified versioned release and human approval for fleet changes |
| Withdrawal request | Front can acknowledge while retaining copies | Record acknowledgment and local stop; do not promise deletion from hostile copies, backups or already-trained models |

These are threat-model inferences from the candidate fields and R1's actual name/IP/content
collection, not measured attack rates. Differential privacy and secure aggregation are evaluated
in R3; neither is implied by using a pseudonym. Local loss detection must cover unsent exports,
rejected schemas, expiry and missing remote receipts without leaking bodies into alerts. The
local record survives a front outage; fleet participation is never a prerequisite for answering
one's principal (`docs/00-the-purpose.md:93–101`; `docs/04-the-big-picture.md:390–423`).

## Replay, promotion and readiness limits

**Rule — richer export never bypasses incident-replay validation.** **Check:** a
`P21-INCIDENT-REPLAY-v1` attachment must pass its closed shape and the owner semantic checks:
authorized references, decision-time frontier, correct original author/audience, independently
verified actual input, and a grader-only channel for future corrections. Keep the failure paired
with a comparable success and unavailable-evidence/legitimate-hold control. Synthetic remains
synthetic. Stop replay at a sandboxed prepared effect, structurally excluding dispatch. Missing
private sources yield partial/unavailable, not fabricated evidence. Sources:
`P21:10-the-pilot-human-comparison-and-incident-replay.md:117–205`.

**Rule — promotion is an accountable additional act.** **Check:** a candidate shared scenario
must have a real graded case and admissible export, a separate promotion record through the
judgment/verification owners, a frozen criterion, and measured local replay before supporting a
route/procedure change. Synthetic fixtures may test controls but cannot satisfy the real-case
production benchmark requirement. Preserve original outcome, explanation, lesson and later
correction separately. Governing changes remain versioned and human-approved even when every
fleet member agrees (`docs/04-the-big-picture.md:296–312`;
`P21:09-coherence-outcomes-and-user-perspective-measurement.md:74–81`).

**Rule — do not invent runtime owners to make this schema appear live.** **Check:** any
implementation plan lists public owner seams and real lifecycle fixtures before activation.
P21's production coherence joins and incident semantic replay remain explicitly non-executable
at the pinned design (`P21:09-coherence-outcomes-and-user-perspective-measurement.md:65–72`;
`P21:10-the-pilot-human-comparison-and-incident-replay.md:189–205`). Part 20 forbids a second
core fact/grade/budget/surface authority (`P20:01-ownership-and-boundaries.md:3–35`). This
research emits no real cases, makes no benchmark result and authorizes no paid experiment.
R4/R5 must resolve admission weighting, retention, privacy parameters and topology against the
purpose before D1 assigns the front and return-path implementation boundaries.

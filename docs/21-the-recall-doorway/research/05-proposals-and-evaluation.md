# R5 — Three proposals and a decision protocol

**Round two, 2026-09-12. Research proposals and evaluation plan, not the Part Twenty-One design.**

Keep universal accounting, test retrieval before principal drafting as the primary intervention,
and test selective live review for its additional benefit. These are three independently
falsifiable proposals. The combined approach is promising; beyond-human coherence is not an
observed result. This round executed three installed-package fixtures. The scenario experiment,
human comparison and production incident replays described below have **not** been executed.

## 1. Evidence and scope

Labels follow [R4](04-compare-and-contrast.md): **S** inspected source, **M** our executed
fixture, **A** author-measured research, **D** author-described mechanism, **I** inference or
proposal, **U** unknown. Unless labeled otherwise, the contracts, budgets, scenarios and
decision thresholds below are **I: candidate research choices**, not landed owner contracts.

The migration target is installed Instar **1.3.1237**, including its installed hooks; the dirty
reading-aid checkout is **5b36623a99327e74abe5ef04d63019f9aca6b1c5**. Dawn's private source
archive is **68e25e2ee9903c5170b55d00f055f41514f39d7a**, not a verified runtime build.
[R2 §1 and §8](02-dawn-grounding.md) give paths and artifact hashes. Main was fetched and
inspected at **dd38f07ae4e12e04373ffde7fdf006b08381cf15**; [R4 §7](04-compare-and-contrast.md)
distinguishes landed SessionGrounding/closure/input carriers from pending ContinuityAccounting,
operator-surface consumers and measurement A2. This proposal does not silently fill those seams.

The four settings are **T1** an earlier message in one long topic, **T2** another topic,
**E** an email exchange, and **P** something learned from another user or agent. Success means
using relevant, permitted evidence in the later behavior without making the person repeat it.
Mentioning a name, retrieving a row or sounding familiar does not satisfy that outcome.

## 2. Common boundary and recursion rule

A **principal judgment**, for this experiment, is a reply to a person or a decision producing
an effect on the world. This lowercase research term does not redefine an existing authority
owner's Principal type. A scheduled email or deployment counts even without a new user turn.
One task can contain several principal judgments with different recipients and evidence needs.

Recall planning, query rewriting, summarization, extraction, reranking, reviewer reasoning and
the bounded revision are **subordinate calls**. They do not enter the recall doorway again.
They inherit the root identity, evidence scope, deadline and resource account; their actual
inputs remain traceable. They receive read/analysis capabilities, not sender or effect authority.
Calling an outward action an internal helper must not exempt that action from the boundary.

Implementation research must test structural classification and a shared budget rather than
depending on a prompt saying not to recurse. The maximum helper-call count is independent of
how many helpers request further work. Cancellation and source outages cannot create a new root.
Background curation is separately scheduled/accounted work; it cannot become free hidden work
inside a live recall attempt or initiate a message through its internal classification.

A root recall receipt may cover drafting and its final effect if the recipient, scope, relevant
claims and evidence frontier still match. Final validation can reuse that receipt. Changed
audience, changed consequential content, new relevant intake or a permissions change invalidates
reuse. A refresh spends the **remaining** root budget; repeated edits do not reset it. A later,
independently initiated judgment gets its own root. An immediate acknowledgment can reuse current
intake context with an explicit bounded no-additional-search decision; substantive claims must
still pass the applicable retrieval selection. Measure acknowledgments separately from answers.

## 3. Proposal A — Universal accounting of what principal judgments saw

**Claim to test:** accurate accounting is a low-cost prerequisite for diagnosing coherence
failures and verifying interventions. It need not itself improve an answer. It must distinguish
successful evidence delivery from an empty, stale, truncated or unavailable source.

**Inputs:** root/parent identity; actual recipient and conversation bindings; permitted evidence
scope; source frontier; the retrieval/assembly attempt, including zero-result attempts; final
rendered context; actual submitted model input and transformations; model/config identity;
deadline/resource charges; final answer or prepared effect reference. Existing custody owners
remain responsible for original intake and input capture.

**Outputs:** a receipt relating source references and eligible source spans to candidates,
exclusions, rendered spans and the actual submitted input. It records evidence kind (original
episode, derived belief or procedural lesson), attribution, event/ingestion/validity times,
supersession, freshness, source availability and the binding to the eventual output. It can
reference existing durable captures rather than duplicating every body. Hashes are accompanied
by authorized recoverable content references; a hash alone is not recoverable memory.

The experiment must distinguish `available-empty`, `not-indexed`, `behind-frontier`,
`scope-filtered`, `unavailable`, `timed-out`, `budget-excluded`, and `not-requested` outcomes.
Names here describe required distinctions, not a proposed production enum. Candidate counts
and read/access tokens do not establish that content reached the provider or influenced behavior.

**Budget:** zero additional model calls. Pilot cap: 64 KiB new receipt metadata per principal
judgment, with evidence bodies and large candidate lists referenced through separately charged
artifacts. Target added local p95 latency at most 25 ms. Cap/target are unmeasured hypotheses;
overflow must be explicit and cannot silently drop required lineage. Existing full-input capture
I/O and storage still count in lifecycle cost. Test both normal and slow-storage cases.

**Failure direction:** preserve existing mandatory custody/authorization gates. Optional recall
diagnostics failing must not turn ordinary chat into silence; produce an explicitly incomplete
diagnostic receipt through the available durable path and mark coverage unknown. If a required
owner capture cannot be admitted, follow that owner's refusal/recovery behavior rather than
inventing a successful receipt. Consequential dispatch must not claim a required proof it lacks.
Separate this owner failure from a semantic reviewer deciding that a draft feels risky.

**Recursion/audit:** accounting instrumentation does not invoke recall or semantic review.
Subordinate calls record their existing input/budget lineage under the root. Audit the accounting
system itself by comparing receipts with captured provider inputs and effect bytes, using injected
renderer truncation, substituted inputs, missing writes and reordered messages.

**Evidence:** M, installed F1/F2 below show why a plausible count or nonempty retrieval result is
insufficient. S, Dawn's compose-access checks establish an intermediate access test, not provider
consumption or semantic use ([R2 §4](02-dawn-grounding.md)). I, cheap non-recursive accounting is
credible but its full storage/latency cost and diagnostic accuracy remain measurements to make.

## 4. Proposal B — Bounded retrieval before principal drafting

**Claim to test:** compulsory evaluation of historical evidence needs, followed by appropriate
bounded retrieval, improves spontaneous coherence over agent-discretionary search. Universal
entry does not mean every turn queries every store or adds historical text to a greeting.

**Inputs:** current intake/task and captured recent context; principal audience/identity; active
commitments and exact references; source/permission frontier; available source inventory and
index coverage; remaining deadline and resource budget. The query may use task and conversation
state rather than only the last message's literal words. Prior inferred beliefs are labeled as
derived and cannot impersonate the person's original statement or current authorization.

**Outputs:** a bounded evidence packet plus Proposal A's selection receipt. The packet preserves
speaker, original source/span, time and current-versus-historical status. Relevant original
passages remain available behind compressed keys and summaries. It records uncovered sources,
conflicts, missing exact references and limits on claims. A justified no-additional-context
result is different from a failed search and is included in the universal-entry coverage metric.

**Candidate retrieval policy:** begin with exact references/current projections and scoped raw
history plus lexical search. Add dense retrieval as a matched-budget alternative or complement.
Temporal/person/relationship lookup, recent arcs, pins and commitment cues are separate channels.
Graph/tree expansion and model-planned deeper lookup are optional experimental arms. Every
expansion, summary construction and cache read enforces the audience policy before content enters
an unauthorized model context. Filtering only the final answer is insufficient.

Preserve original episodes, inferred beliefs and procedural lessons as separate evidence kinds.
An updated belief can supersede the current answer while preserving the older episode. A lesson
can guide a procedure without pretending the user said it. A private statement may be unavailable
for both internal use and disclosure; those permissions are explicit scenario inputs, not assumed
to be identical. Shared identity across accounts establishes neither consent nor authority.

**Pilot budgets:** ordinary chat gets at most 2 s added wall time, 4,000 inserted recall tokens,
six logical evidence reads and zero helper model calls. A consequential effect gets a recall
slice of at most 5 s, 6,000 inserted tokens, ten reads and at most one helper call, capped at
4,000 input plus 500 output tokens. Query embedding is separately counted even when not an LLM
helper. Backend fan-out, bytes scanned and candidate materialization must also be metered; one
logical read cannot hide unbounded parallel queries. These are pilot ceilings, not performance
claims. Section 6 bounds the combined path and proposes budget sweeps.

**Failure direction:** ordinary chat continues using available permitted evidence, with calibrated
uncertainty where the missing material matters. It must not convert an unavailable source into
a confident historical denial or falsely imply an original exchange was read. A relevant exact
reference should first use raw-custody lookup when the index is behind. An unverifiable prerequisite
for a consequential effect leaves that effect pending under its owner, with a reachable status to
the initiating person and an explicit recovery/expiry condition. A missing unrelated memory is
not automatically a reason to hold an effect. Privacy and current authority checks retain their
existing failure directions.

**Recursion/audit:** internal lookup/planning calls are excluded from recall dispatch and share
the root caps. Record query derivation, retriever/version, index watermark, candidates and why
each selected or excluded passage reached the packet. Cache reuse binds audience, permissions,
task, source frontier and rendering policy; a same-text cache hit alone is insufficient. Record
whether the reader actually received each expected span; evaluate use independently afterward.

**Evidence:** M, F1–F3 locate omissions before reasoning. S, Dawn has useful hybrid/person/arc
channels but its named pre-reply shadow does not inject historical retrieval. A, LongMemEval
supports testing key enrichment separately from replacing original values; GroupMemBench and
R3 counterexamples require strong lexical and raw-evidence controls. U, universal retrieval's
incremental benefit across these four real settings. [LongMemEval](https://arxiv.org/html/2410.10813v2),
[GroupMemBench](https://arxiv.org/html/2605.14498v1), [R3](03-external-research.md).

## 5. Proposal C — Selective, bounded live memory review

**Claim to test:** after retrieval, targeted review reduces consequential memory errors enough
to justify its added delay, cost and false holds. It is not a reviewer on every chat message.

**Selection inputs:** actual effect class (email, public X/Reddit post, deployment or money
movement), exact audience/target, prepared draft/effect, current authority prerequisites, recall
receipt and any cheap deterministic risk signal. Examples of such signals are a missing cited
source, audience mismatch, expired receipt or superseded referenced fact. An unbounded model
classification call is not a cheap deterministic selector.

**Review inputs/outputs:** compare the draft's checkable historical claims, recipient expectations
and relevant commitments with permitted original evidence. Return supported, repair-needed or
unresolved findings with source references and a proposed bounded revision when appropriate.
Distinguish a memory conflict from permission, credential or operational validation owned
elsewhere. Reviewer agreement is not new authorization and does not replace existing send,
deployment or financial controls. A model confidence number is not independent corroboration.

The reviewer may use up to two additional scoped evidence reads within the root budget to avoid
merely agreeing with the drafter's summary. It must expose whether it saw independent original
evidence or only the same derived account. Record changed claims, evidence and introduced errors,
including an initially correct draft made worse by review.

**Pilot budgets:** one semantic review, at most one bounded revision, then deterministic final
binding validation. Review slice at most 5 s and 8,000 input/800 output tokens; optional revision
slice at most 5 s and 8,000 input/1,200 output tokens. A revision uses its parent evidence packet
and findings; it does not start another recall/review cycle. Any new evidence reads consume the
root's remaining allowance. A failed deterministic recheck ends the attempt; it does not create
a reviewer ping-pong loop. All limits include queue time and retries.

**Failure direction:** consequential effects needing unresolved evidence remain unsent/unexecuted,
with explicit pending ownership and a bounded recovery path; review timeout is not silent approval.
The initiating person remains reachable, and an eventual fallback/status is measured as such rather
than counted as successful completion. Existing verified deterministic violations retain their
owner's refusal behavior. Ordinary chat receives, at most, a bounded advisory risk review and can
proceed when that review is unavailable; it does not wait for semantic clearance on every reply.

For the ordinary-chat risk arm, allocate at most 1 s and one 4,000-input/400-output-token advisory
call **inside the same 2 s combined added-time cap**, with remaining resources reserved before
retrieval. If the remaining slice is insufficient, record review-skipped and proceed with the
evidence actually available. This arm is an experiment, not the default universal chat path.
It must demonstrate added benefit over deterministic checks alone.

**Recursion/audit:** the review and its single revision are subordinate calls. Record selector
reason, exact reviewed content/audience, source/permission frontier, reviewer/model, findings,
deadline, charges, disposition, revised content and final validation. Binding is to actual bytes
and effect target; normalization that removes a changed URL cannot establish exact approval.
Changes after review invalidate reuse but do not replenish the budget.

**Rulebook resolution:** S/R, `docs/01-the-rules.md:36` explicitly identifies universal live
review as a 1.x trap and favors retrospective pattern review, with live scrutiny at irreversible
moments and few nearly deterministic exceptions. That evidence rejects the original hypothesis
of a blocking historical reviewer before every reply. Accounting and evidence retrieval are
different operations and survive that objection. Consequential external dispatch is the candidate
live-review boundary; a broad semantic blocker triggered on ordinary chat would require an owner
rule reconciliation before design approval. The nonblocking risk experiment above does not claim
that this reconciliation has happened. Scheduled retrospective review remains a separate control.

Irreversibility alone is insufficient to authorize an LLM reviewer on every email or public post:
the rulebook's exceptions are also few and nearly deterministic. Proposal C's semantic branch
therefore needs an explicit owner exception policy even within consequential effects, after the
experiment establishes net value. Keep deterministic validation, selective semantic review and
universal semantic blocking as separate arms; calling all three a sentinel would hide the conflict.

**Evidence:** S, Dawn's person preparation and final poster checks demonstrate useful boundaries,
while source comments report false holds and missing-use problems. U, net repairs, introduced
errors and runtime latency. A, Reflexion and memory-authority counterevidence caution against
equating evaluator agreement with correctness. These support testing C, not presuming it wins.
[R2 §§4–7](02-dawn-grounding.md), [Reflexion](https://arxiv.org/html/2303.11366v4),
[authority-laundering study](https://arxiv.org/html/2609.01836v1).

## 6. Shared resource and availability experiment

The consequential combined added-time cap is **15 s**: recall up to 5 s, review up to 5 s,
revision up to 5 s, with accounting/final validation consuming the same envelope. A scheduler
must reserve its overhead; the slices are maxima, not a promise that all can finish. The ordinary
combined cap is **2 s**, including optional advisory review. Principal drafting time is measured
separately and in end-to-end totals; a review-induced revision is added work and counted here.

Across a consequential root, cap ten logical evidence reads total, including the reviewer's two
reads, and three helper model calls total (recall helper, review, revision). Unused slots may stay
unused; an implementation cannot borrow an eleventh read under a different helper name. Admission
must reserve resources for the selected policy. Under overloaded or unhealthy dependencies,
degrade/hold as above instead of adding unbounded queues or trying models until one agrees.

Use an absolute monotonic deadline, bounded retry count and enforceable child cancellation.
Distinguish response-return latency from residual work after timeout. A signal followed by an
unbounded await does not establish the cap. Test an uncooperative child, connection stall and
late result; a late result cannot authorize dispatch after the attempt has expired.

Before any paid experiment, freeze model/provider versions and unit-price snapshots, then set
a research-run spend cap and per-root admission caps from those prices. This report neither
spends provider money nor invents current prices. The token/call ceilings above are concrete
resource limits; a monetary conclusion is **U** until priced. Include embeddings, indexing,
curation, storage, maintenance, failed calls and retries, not merely incremental reader tokens.

Sweep 1k/4k/8k recall-token envelopes and 0.25/1/2 s ordinary retrieval limits; consequential
limits compare 5/10/15 s combined envelopes. Compare strategy arms at matched envelopes rather
than granting graph/tree/review systems unlimited context. Report cold/warm cache, index caught
up/behind, ordinary/burst load and reachable/unavailable dependencies separately. Existing
deadline/owner constraints outrank an experimental budget band.

## 7. Executed baseline fixtures — installed methods, synthetic collaborators

**M:** round-two execution at **2026-09-12T21:28:56.178Z**, Node **v24.14.1**, Darwin arm64,
installed package **1.3.1237**. Native ESM imports ran the real installed classes. Synthetic
stores/providers returned controlled values; provider inference, production state and private
conversations were not used. These reproduce failure mechanisms, not the four reported incidents.

The observed output is retained in [installed-baseline-results.json](fixtures/installed-baseline-results.json).

| Fixture | Setup and actual method | Observed result | What it proves / does not prove |
|---|---|---|---|
| F1 — skipped summary prefix | `dist/memory/TopicSummarizer.js`, 250 messages `FACT_1` through `FACT_250`, `maxMessagesPerPrompt=200`; capture evaluator prompt and saved checkpoint | 200 processed; `FACT_1` absent, `FACT_51` present; saved message count 250, last message id 250 | M: checkpoint crosses a prefix excluded from this summarization input. U: any person's incident or model summary quality. |
| F2 — retrieved body missing | `dist/core/PromptBuildRecall.js`, enabled; hybrid search returns fact name `Travel choice`, content `PERSON_A prefers rail for this trip.` | source `fresh`, results count 1, name present, preference body absent | M: normal entity content is lost in this renderer. A successful lookup is insufficient. |
| F3 — unused semantic strategy | `dist/memory/WorkingMemoryAssembler.js`, lexical/hybrid call counters, empty results, prompt `transport preference` | lexical calls 6, hybrid calls 0, empty context | M: this assembler uses lexical search despite a supplied hybrid method. Other 1.x callers differ. |

Reproduce against the R2 artifact hashes: import these classes from the installed package by
absolute file URL in a fresh Node process. For F1 supply `needsSummaryUpdate=true`,
`getTopicSummary=null`, `getMessagesSinceSummary=250` synthetic ordered rows,
`getMessageCount=250`, synthetic topic metadata, a `saveTopicSummary` spy and an evaluator that
captures its prompt and returns a valid fixed summary. Assert both prompt content and checkpoint.
For F2 merge exported defaults with `enabled:true`, supply one confidence-1 fact via
`semanticMemory.searchHybrid`, expose `lastSearchStrategy=vector-hybrid`, and inspect
`recall({userMessage:'transport preference', ...})`'s context body and counters. For F3 provide
both search methods as independent spies, omit optional sources, call `assemble` with the same
prompt, and compare call counts and returned context. R1 §7 documents the earlier source-method
version. The new run removes source-versus-installed uncertainty for these three methods only.

Repair-oracle fixture variants for later testing: F1 makes every original message recoverable
and the uncovered prefix explicit; F2 supplies the exact body in actual submitted context; F3
returns a useful lexical-mismatch fact only through dense retrieval. These variants are specified,
not executed fixes. Re-run after migration, including zero-match, timeout and token-cap boundaries.

## 8. Synthetic scenarios adapted to five benchmark styles

All named people, organizations, messages and actions in the test corpus must be invented.
The prepared [synthetic corpus](fixtures/README.md) contains 20 seed histories and 200 case
definitions, plus 20 supplementary probes. Construction and structural validation are complete;
model evaluation remains unexecuted. Its public 120/80 planning split is not a secret held-out set.
The table specifies **20 seed histories**, five families across four settings. It does not copy
Dawn's private regression corpus or the missing incidents. Every seed needs a stored original
exchange, later trigger, expected allowed behavior, prohibited behavior, audience policy, truth
time and evidence references. Use enough intervening distractors to defeat a recent-window-only
answer while keeping a full permitted-history oracle feasible at the small scale.

| Family / primary source | T1: long topic | T2: other topic | E: email | P: another user or agent |
|---|---|---|---|---|
| L — LongMemEval style: extraction, update, time, abstention | Early preference changes twice; later ask needs current choice and an explicit past-date query needs the old one | Constraint lives only in a different project topic; task cue uses a paraphrase | Later message changes an earlier deadline; quoted old text must not win | An agent reports another person's statement; retain indirect attribution and later correction |
| C — LoCoMo style: long arc and multi-hop | A minor early event explains a later ordinary planning request without a memory quiz | Two topics jointly identify which project a vague follow-up concerns | Two thread fragments establish a dependency; neither alone supports readiness | Two permitted speakers contribute distinct steps; synthesizing them must preserve who did what |
| M — MemBench style: factual versus reflective, observed versus participated | Separate an original statement from an inferred preference and a procedure learned afterward | The agent read a transcript from another topic; avoid claiming it personally participated | Distinguish delivered mail, a draft and an inferred sender intention | The agent observed another agent's exchange; distinguish secondhand knowledge from its own promise |
| G — GroupMemBench style: speaker/asker/audience | Same display name appears for two people in a long group topic | A person uses two verified accounts; an unverified lookalike remains separate | Sender, quoted author, account owner and current recipient differ | Private person A evidence is useful but prohibited for B; a separately shared public fact remains usable |
| P — PM-Bench style: prospective cue, revision, false activation | A conditional promise becomes due only after a later cue; a negated near-match is a trap | Cancellation in topic A must prevent stale action from a cue in B | A follow-up commitment is revised; prepare only the current authorized action | Another agent's tentative offer is not this agent's commitment; a subsequently accepted handoff is distinct |

**A/D source grounding:** LongMemEval v2 (2025-03-04) supplies long-history extraction,
multi-session/temporal/update/abstention categories; LoCoMo (2024-02-27) supplies long-dialogue
and multi-hop/adversarial tasks; MemBench (2025-06-20) distinguishes factual/reflective memory
and participation; GroupMemBench (2026-05-14) supplies multiparty attribution; PM-Bench
(2026-07-14) supplies future-intention/cue/revision tests. These are adaptations, not benchmark
runs, comparable scores or claims about natural production prevalence.
[LongMemEval](https://arxiv.org/html/2410.10813v2), [LoCoMo](https://arxiv.org/abs/2402.17753),
[MemBench](https://arxiv.org/html/2506.21605v1),
[GroupMemBench](https://arxiv.org/html/2605.14498v1),
[PM-Bench](https://arxiv.org/html/2607.12385v1).

For each seed, produce two trigger forms: an explicit historical question and an ordinary
task whose correct handling requires the same evidence without asking the agent to remember.
Cross each with five conditions: healthy evidence; retained but index-lagged evidence;
source unavailable; injected retrieval/renderer omission; oracle-correct evidence actually
submitted with distracting stale/conflicting material. This yields **200 paired cases per arm**
before stochastic repeats. Conditions are controlled faults, not five independent real users.
Keep separate permissions-positive/negative and current/historical boundary pairs within each
seed's labeled turns; score those boundaries individually as well as the seed outcome.

Use three of five seeds per setting for development and two for sealed evaluation: 12/8 seed
histories, 120/80 case variants. Freeze the split before tuning; rotate benchmark families across
settings so every family appears in evaluation. Small held-out size limits confidence; expand
independent histories before making deployment or beyond-human claims. Repeating one history
with many paraphrases cannot manufacture independent evidence.

## 9. Controls and ablations that can decide among proposals

All arms have an **external experiment logger**; that logger is not Proposal A's product
instrumentation and is kept outside the agent's context. Otherwise a baseline without A would
be impossible to score. Fix reader/model, task instructions, source snapshots, final token cap
and action simulation. Tune on development only; use paired evaluation and multiple fixed seeds.

| Arm / intervention | Deciding comparison |
|---|---|
| B0 — current bounded recent context, optional discretionary lookup | Establish failure rate and actual discretionary search behavior. Do not disable capabilities to make the baseline weak. |
| A only — B0 plus product accounting | Measure receipt fidelity/diagnosis and overhead; an answer gain is not required to justify A. |
| A + simple compulsory retrieval | Exact/raw lookup plus tuned lexical retrieval, without dense/graph/reviewer; controls for doorway benefit versus exotic retrieval. |
| A + dense/hybrid retrieval | Match final tokens and read budget against the simple arm; measure paraphrase gain and attribution regressions. |
| A + retrieval portfolio | Add temporal/person/anchor channels individually; then graph/tree/deeper lookup individually and in justified combinations. Leave-one-channel-out ablations expose contribution and displacement. |
| A + best development-selected B + C | Compare with the identical draft/evidence policy without C; attribute repairs, introduced errors, holds and cost to review. |
| Same B + deterministic checks only | Isolate semantic review from cheap final binding/current-source checks. |
| Same B + retrospective review only | Evaluate later-episode improvement with a frozen sequential training/evaluation boundary; charge maintenance and avoid future-label leakage. |
| Universal blocking live review, offline simulation only | Directly test the rulebook's cost/false-hold/silence objection; never deploy this arm to real recipients. |
| Full permitted history and oracle-selected original evidence | Upper controls for selection/compression versus reader use; neither is an omniscient oracle when original custody is missing. |

Also compare summary-only versus original-plus-summary values at identical input budgets,
cache off versus frontier-bound cache versus deliberately stale cache, and correct versus
corrupted derived beliefs. Keep original authorization constant when testing remembered
approvals. Add hostile instructions in retrieved material to verify that evidence does not
become executable instruction or permission. Public posting/deployment/money cases stop at a
prepared effect in a sandbox; evaluation must not perform real sends or transactions.

The correct-evidence-but-unused control is mandatory: verify the expected original span in the
captured provider input, then score whether the answer/effect follows it. A retriever cannot claim
credit from candidate recall when the reader ignores the relevant constraint. Conversely, score
an appropriate refusal separately when evidence is genuinely unavailable or forbidden.

## 10. Metrics, denominators and error attribution

| Metric | Operational definition |
|---|---|
| Missed recall — user outcome | Among opportunities requiring retained, permitted evidence, fraction whose substantive answer/effect misses the expected historical constraint or requires needless repetition. Report explicit and spontaneous cues separately. |
| Retrieval/assembly miss | Expected permitted source spans absent from actual submitted context, split into capture, index, query, candidate selection, filtering, rendering and submission stages. Do not infer a reader failure from absent input. |
| Correct-evidence-but-unused | Among cases with the required span actually submitted, fraction whose behavior ignores/misreads it. Report token position and conflicting evidence. |
| Obsolete recall | Among current-state opportunities with a known revision, fraction using superseded state as current. Historical questions correctly reporting earlier state are successes. |
| Unnecessary hold | Among legitimate effects that evidence and authority permit, fraction blocked, deferred or delayed beyond the policy cap because of memory/review. Record introduced holds separately from preexisting authority refusals. |
| Wrong-audience recall | Unauthorized evidence entering a model context, entering a draft, and reaching the prepared final recipient are three distinct rates. Split wrong identity, forbidden internal use and forbidden disclosure. |
| Unavailable-evidence calibration | With missing/unreachable/forbidden sources, unsupported certainty, fabricated recollection and inappropriate historical denial rates; also appropriate abstention/qualified action. Report custody failures outside the healthy-evidence denominator. |
| Temporal/prospective behavior | Due cues acted on, valid cancellations honored, false cues ignored; score a false activation separately from factual QA correctness. |
| Accounting fidelity | Expected source-to-input bindings accurately recorded; false success receipts; dropped required fields; source-status confusion; diagnostic agreement with injected fault stage. |
| Latency | Intake to ACK, intake to substantive answer, preparation to allowed effect, and hold to resolution; added p50/p95/p99 and maximum. Include timeout/abandonment counts and censored cases, not only successful returns. |
| Cost | Per-root and amortized lifecycle model tokens/calls, embedding work, reads/bytes, storage, build/refresh/curation, review/revision, retries and residual cancelled work; apply frozen prices when available. |

Report all metrics by T1/T2/E/P, cue form, history length, evidence condition, effect risk,
speaker role and model. Also report end-to-end task completion, user repetition burden and
false first-person attribution. User-visible coherence is the primary endpoint; diagnostic
coverage is necessary supporting evidence, not a substitute score.

Use source annotations and deterministic checks where possible, with blinded adjudication for
semantic behavior. Give graders permitted originals, expected time/audience and rubric, while
hiding arm identity. Calibrate model graders against human adjudication on a stratified subset;
retain disagreements and raw decisions rather than letting the tested reviewer grade itself.
Expected evidence is a set of permissible support paths, not one mandatory quote substring.

For stochastic readers use at least three fixed repeats and report variance. Paired uncertainty
estimates resample **seed histories**, not correlated paraphrases or repeated answers. Report
effect sizes and confidence intervals, including per-setting regressions. Zero observed privacy
violations is not zero risk: a rough independent-binomial 95% upper bound is about 3/n, and the
small, clustered pilot does not justify treating all 200 variants as independent trials.

## 11. Decision rules and what would overturn the recommendation

Pre-register final thresholds before running the held-out set. Candidate practical gates:

1. **A:** exact input/receipt fidelity on controlled substitutions and source-status faults;
   zero false-success receipts in the deterministic fixture set; p95 overhead within 25 ms
   and explicit accounting of overflow/storage cost. Keep A if it diagnoses failures accurately
   at acceptable cost, even when its answer accuracy equals B0. Reject an implementation that
   only logs intended context while missing actual submission transformations.
2. **B:** target at least a five-percentage-point paired reduction in user-outcome missed recall
   against the tuned simple/discretionary baselines, with the interval and per-setting effects
   reported. A smaller gain can justify a simpler method; a graph does not earn adoption by name.
   Require observed scope-boundary tests to pass, and independently enforce their owner rules.
   Reject universal heavy search if no-context turns suffer or simple retrieval matches its
   coherence at lower lifecycle cost. The 80-case held-out pilot may be inconclusive.
3. **C:** require a positive net reduction in consequential historical errors after subtracting
   errors introduced by review, while unnecessary holds remain below a candidate 1% of legitimate
   effects and added time/cost stay within caps. Report uncertainty; the small pilot cannot certify
   a 1% tail rate. Expand independent legitimate-effect cases before rollout. If review mainly
   repeats B's evidence or shifts misses into silence, prefer deterministic checks plus retrospective
   review. A working reviewer on selected risky effects does not justify universal chat blocking.

Any unauthorized exposure or unsanctioned effect in a negative fixture is a boundary defect to
fix before promotion, regardless of aggregate accuracy. Observational zeroes do not prove the
boundary; negative wiring/effect-path tests are also needed at implementation time. Significant
implementation work must meet the repository's unit, HTTP integration, lifecycle and wiring
test standards. This research round changes documentation only.

To substantiate **beyond-human coherence**, add a consented, preregistered human comparison with
the same permitted evidence and task goals. Report natural unaided recall separately from
tool-assisted human performance; equal exposure and time/resource conditions matter. Use blinded
user judgments plus objective episode/constraint outcomes over long repeated interactions.
Benchmark QA, friendly style and superiority on one engineered fixture cannot establish that claim.

## 12. Incident replay, handoff and recommendation

When Echo obtains the four incidents, preserve original private evidence in its authorized
custody and make sanitized replay references. Required fields: original intake and author;
later trigger and expected behavior; captured/indexed frontiers; candidate and submitted context;
scope/permission state; draft/effect outcome; timestamps; build/hooks/flags; source errors and
charges. Freeze the incident at the decision time. Later corrections are evaluation labels,
not evidence the replaying agent may see early. Pair each failure with a comparable success and
an unavailable-evidence/legitimate-hold control. Keep the original episode, an inferred explanation
of the failure and a procedural repair lesson as separate records.

**Questions for Echo, for the next decision round:**

- Which owner contracts will be landed at implementation, particularly continuity accounting,
  operator input consumers, identity joins and measurement A2? R4 records the present discrepancy.
- Which effects need semantic review under the rulebook, and who owns a pending effect's recovery
  and expiry? Confirm the proposed ordinary-chat advisory boundary before a part design.
- What model/price snapshot, spend cap, concurrency policy and acceptable latency bands should
  govern a paid evaluation? The current result is a zero-provider-call fixture run.
- Can Dawn supply deployed-path/flag/input/outcome traces for the source mechanisms, including
  shadow recall, anchors/pins, access checking and false holds? Which provenance remains auditable?
- Which raw-custody and index-watermark evidence is available for complete email and agent intake?

**Questions for Justin, relayed through Echo:**

- For each of the four incidents, what earlier exchange should have changed which later response
  or action, and what would a satisfactory response have done without asking you to repeat it?
- When may information from another person/agent be used privately to help, and when may it be
  disclosed? Include a case where remembering should change behavior without revealing the source.
- Which is more costly in ordinary chat and consequential actions: a short delay, a qualified
  answer, a needless hold, or an incorrect action? These choices set the operating point.
- What human comparison and repeated-interaction horizon would make the coherence claim meaningful?

These are handoff questions, not blockers for the completed research. Dawn runtime outcomes and
the original incidents remain **U**. The recommendation is **A + bounded principal B first**,
with **C admitted only by measured incremental value in its selected consequential/risk scope**.
Admission also requires the owner reconciliation above; research authorization is not a rule change.
Retain original evidence, keep beliefs and lessons distinct, and repair loss at capture/selection/
rendering before buying more reviewer calls. R2/R4 provide source and comparative grounds;
the protocol above is the experiment needed to turn that recommendation into evidence.

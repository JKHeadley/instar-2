## 2. The emitted-case contract

**Rule — emit a derived case, not an original episode.** **Checks: P22-NF-04/05/07/09.**
Four distinct objects remain separate: original local episode, closed derived case, specifically
exportable replay/scenario, and proposed behavioral lesson. Original messages, exact judgment
inputs, reasons and source frontiers stay with their local owners. Export construction consumes
owner-validated categories without opening raw captures. The front may receive an attestation, a source's claim
whose private support the front cannot inspect; it must not relabel that attestation independent proof.
A proposed schema id is `P22-DERIVED-CASE-v1`. This is contract vocabulary awaiting a closed
decoder, not an implemented core type. Every object and nested tagged union rejects unknown
properties; strings cannot become hidden text channels under names such as `reasonCode`.

| Field group | Allowed contract and source |
|---|---|
| Envelope | Schema/version, one of `recall-outcome`, `graded-decision`, `benchmark-result`, `correction`; destination, immutable export identity, enrollment epoch, policy/grant version and signature |
| Canonical mapping | Destination-scoped opaque case and assessment keys; predecessor, correction target and parent export keys; one locally retained mapping across attempts |
| Origin and strength | Production-derived or synthetic; owner validation and independence states; separate proof, observation, attestation, inference (a conclusion drawn rather than directly observed) and interested-party classification |
| Stage and behavior | Cause assessments and their evidence state; outcome labels, use/withhold category, sensitivity/audience class and observed effects; no raw sensitive descriptions |
| Mechanism | Approved public capture/retriever/index/extractor/embedding/reranker/renderer ids and versions; selection, rendering and submission coverage codes |
| Decision | Approved public model/provider/settings, prompt, context-assembly, action-floor and output-schema identities; opaque private identities explicitly non-comparable |
| Timing | Clock-comparability state, event-window class, binned (grouped into ranges) age/latency, timeout/cancellation code; exact times and frontiers remain local |
| Grade | Owner criterion/version, conclusion and reason grades separately, grader/method/standing, scope-validation state, horizon, conflict/currentness and evidence availability |
| Benchmark | Public scenario/version, candidate, plan/run mapping, planned ordinal or permitted aggregate profile; compatibility disposition; graded, missing, refused, cancelled, pending and conflicted counts |
| Quantities | Part 20 registered units, permitted counts and cost/usage buckets; explicit unknown price, coverage (share with required evidence) and missingness (evidence absent or unavailable) |
| Correction | Target, supported new assessment codes, causal predecessor/successor, author standing and evidence state; never raw correction text |
| Export receipt | Field-policy digest, transformation id, semantic-loss codes, exact local payload binding, grant/revocation reference and custody receipt |

Each optional observation is explicitly `known` with a typed value or `unknown`, `unavailable`,
`not-applicable` with an enumerated reason. Missingness is not `null`, zero or a fabricated
success. Stable random opaque ids follow a fixed length/encoding; public ids resolve an
approved registry entry. Field lengths, array counts and nesting limits are finite and
versioned. Their exact values are agent-owned under resource and privacy floors (OD-03).

Basis: Coherency and trust, constraints 1–3; rules 13/28/33/58/86/108; [R2 schema](research/02-what-flows-and-what-must-not.md); Part 21 §§3/9/10 at the section 1 pin.

**Rule — the four causes require different witnesses.** **Checks: P22-NF-04/09.**

| Cause | Required local evidence | Refused inference |
|---|---|---|
| `not-captured` | Expected permitted intake opportunity plus missing-capture evidence or a recorded capture failure at the relevant frontier | A source that is unavailable now proves it was never captured |
| `not-found` | Permitted original existed at decision time; query/index/selection evidence failed to retrieve sufficient support | Forbidden history was a legitimate retrieval target |
| `found-not-delivered` | Sufficient permitted support selected, with evidence it was omitted during rendering, assembly or actual submission | An intended prompt proves what the provider received |
| `delivered-not-used` | Sufficient support confirmed in actual provider input, plus graded behavior that misused or ignored it | Rightful withholding means recall failed |

Multiple supported causes can coexist. Unknown or disputed cause remains explicit.
Mechanism codes distinguish capture, index-lag/hole, query, selection, permission, rendering,
submission, reader-use, review and recipient-delivery. Separate outcome labels include
`missed`, `obsolete`, `unnecessary-hold`, `wrong-audience`. Internal use, provider exposure,
prepared output and actual delivery remain distinct stages. Correct private use without
revealing a fact is a possible success; accurate recall disclosed to the wrong audience fails.

Basis: Wisdom and evidence constraint 3; rule 108; R2 cause table; Part 21 §9.

**Rule — content-free applies to every channel, including retry and failure.** **Checks: P22-NF-05/07/18.**
Default export rejects prompts, messages, answers, rationale, correction/lesson prose, names,
emails, conversation/topic/run identifiers, paths, URLs, private hashes, embeddings (numerical representations of content), gradients (model-update signals that may reveal training content)
and arbitrary labels. A public software digest is allowed only when its public identity is
verified. Opaque private compatibility does not establish equality. Richer payloads need a
separate current grant, authorized access and an explicit transformation-loss account.
Original-author custody and audience restrictions still apply even when the operator opts in.

Basis: Trust, sovereignty, non-widening authority; rules 28/29/86/89/95; R2 privacy floor; OD-02 and G2.


**Rule — case kinds have distinct required evidence and correction semantics.** **Checks: P22-NF-04/08/09.**
Every case requires the envelope, canonical mapping, origin, attribution and export receipt.
A recall outcome also requires stage observations, cause evidence states and a separate behavior
assessment. A graded decision requires criterion, conclusion/reason/outcome observations,
grader standing resolution, sensitivity/audience and outcome horizon. A benchmark result
requires the exact plan/candidate/scenario mapping, compatibility disposition and complete
planned-population accounting. A correction requires its target assessment, causal predecessor,
new assessment and author evidence. A missing source observation uses its explicit unavailable
tag; it cannot be replaced by dropping the field. Kind-specific fields on the wrong kind fail.

Default export ids are locally generated random 128-bit values encoded as 32 lowercase hex
characters, never caller-authored names. Digests use a fixed registered algorithm/length and
only public or exported bytes. Enumerations and public software ids resolve the selected schema
registry; arbitrary custom values fail. Booleans, integer counts and finite registered quantities
are type-checked, not coerced from strings. Numbers outside owner bounds, duplicate keys,
non-finite values and arrays beyond the schema limit fail before serialization. Wire limits
are chosen and frozen with the schema before deployment, not supplied by each report.
A correction arriving before its target is stored as unresolved custody, never applied to an
invented target. Cross-enrollment corrections need verified authority over that case; otherwise
they are disputed evidence. A correctly signed correction still needs owner causal validation.

Basis: Coherency and trust; rules 13/28/33/58/86/108; R2 closed-decoder contract; OD-03 bounded encoding settings.

**Rule — content-free is not a promise of anonymity.** **Checks: P22-NF-05/14/15.**
Anonymity means the recipient cannot identify the contributor; omitting names alone does not establish it.
A hostile front may correlate connection origin, timing, enrollment linkage, rare software/model
combinations and repeated outcomes, and can retain anything actually exported. Approved category
coarsening (combining detailed categories), finite contribution, batching and small-cell
suppression (withholding results for groups too small to publish safely) reduce particular exposure;
none alone hides all metadata or proves differential privacy, a quantified bound on how much
replacing one protected contributor can change the probabilities of published results. Front logs and diagnostic providers
are part of the custody inventory, with explicit access and retention terms. Repeated-query
and cross-destination linkage risks remain in the threat model. An exact public artifact id is
still excluded when its approved field policy requires coarsening. Unknown privacy eligibility
holds the export. Richer export, onward forwarding, publication and model training each require
their own authority; enrollment cannot authorize all future uses.

Basis: Trust, sovereignty and authority constraint; R2 hostile-front table; section 8 C mechanism; G2 retention/privacy terms.

**Rule — terms retain their stated limits.** **Check: P22-NF-01.**
The terms list is a reading aid; first-use explanations govern their use throughout this body.

| Term | Meaning / where explained |
|---|---|
| Attestation; inference | Source claim; conclusion drawn rather than directly observed; this section |
| Binning; evidence coverage; missingness | Grouping in ranges; share with evidence; absent/unavailable evidence; this section |
| Embeddings; gradients | Content representations; model-update signals; either can reveal content; this section |
| Anonymity; pseudonymity | Non-identifiability; using a substitute identifier without guaranteeing it; sections 2/3 |
| Blinded review; calibration; holdout | Concealed treatment assignment; comparison to adjudicated cases; cases reserved from development; section 5 |
| Prevalence | Fraction of a defined population with a category; section 8 |
| Percentile; strata | Value below which a named fraction falls; separately reported groups; section 9 |
| Paired comparison; cohort; stratification | Same opportunities for both candidates; reserved evaluation group; predefined grouping; section 10 |
| Denominator; median; p95; percentage point | Population underlying a fraction; middle value; 95th percentile; absolute percentage difference; section 10 |
| Coarsening; small-cell suppression | Combining detailed categories; withholding results for small groups; this section |
| Differential privacy | Bound on changes in output probabilities when a protected contribution changes; this section |
| Repeated, adaptive, differencing queries | Re-asking, choosing from prior answers, or comparing overlapping groups; section 8 |
| Local differential privacy | Randomization at the contributor before the front receives data; section 8 |
| Secure aggregation; dropout; collusion | Protected summation; participants leaving; cooperating parties; section 8 |
| Protected unit; neighboring datasets | One operator's full contribution; datasets differing by its replacement; section 8 |
| Clipping; category vector; L1 norm | Limiting magnitude; numerical category weights; sum of absolute weights; section 8 |
| Epsilon; delta; sensitivity | Multiplicative probability parameter; additive slack; maximum neighboring change; section 8 |
| Cumulative privacy accounting | Accounting for privacy loss over all releases/destinations; section 8 |
| Operator-cluster bootstrap | Resampling whole operators with their cases intact; section 10 |
| Percentile interval; coverage | Resample-quantile endpoints; how often the method includes the target over repeated samples; section 10 |
| Bonferroni family error | Chance of any comparison's interval missing its target, bounded by allocating error across comparisons; section 10 |
| Arm-stratified resampling | Resampling operators within each assigned trial group; section 10 |

Basis: Purpose honest-evidence and trust constraints; sections 8/10 privacy and inference contracts.

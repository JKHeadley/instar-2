# R3 — External research for the commons

**Status: research for design review. Governed. No adoption or fleet experiment authorized.**

## Method and scope

**Rule — evidence and adaptation have different labels.** **Check:** each source-backed
finding below names a primary paper or official project document, its publication date where
available, and the limit of the claim. All sources were accessed on 2026-09-13. A date on an
arXiv entry is identified as submission, not necessarily conference publication. Undated living
documentation is dated by access, not given an invented publication date. Proposed Instar
controls are explicitly inference/Value choices or proposed Rules with checks, not properties
already demonstrated in Instar. This is a targeted review of mechanisms and failure modes, not
a systematic review, a benchmark execution or a claim to cover every recent publication.

**Value — use “learning” precisely.** For this research, distinguish collecting evidence,
evaluating a candidate locally, curating a shared benchmark, proposing a procedural/policy
change and training model weights. Those activities have different custody and authority
requirements. Instar's local loop proposes changes under versioning and approval
(`docs/04-the-big-picture.md:297–338`, base
`808ca2424d9c6ec5e0920142b62ebd3f4738e5b9`). Calling that loop RLHF does not establish that
an RL training algorithm, reward model or approved training dataset exists.

## Federated evaluation and policy improvement without a central raw dataset

**Rule — decentralized data does not mean no information leaves.** **Check:** preserve what
is transmitted in each comparison. McMahan et al.'s *Communication-Efficient Learning of Deep
Networks from Decentralized Data* develops federated averaging using locally computed updates,
with evaluation on unbalanced and non-identically distributed client data. Its empirical
communication and learning results concern trained models under those experimental settings,
not safe distribution of arbitrary agent policies. Source: [paper, first submitted 2016-02-17;
AISTATS 2017](https://arxiv.org/abs/1602.05629).

**Value — adaptation.** A commons could instead distribute an immutable candidate retriever,
prompt or routing policy for an admitted local comparison, then receive bounded evaluation
results. Averaging model weights is unnecessary for that first capability. Conversely, arbitrary
retriever programs cannot be meaningfully combined by FedAvg merely because their outcomes are
numbers. Keeping training out of the first contract reduces scope; it is not a proof of privacy.

**Rule — evaluation-only federation is a concrete existing mechanism.** **Check:** Flower's
example evaluates parameters on the client's own test set and returns loss, example count and
metrics. Server settings control sampling and minimum clients; centralized evaluation is a
separate path. Source: [Flower, Federated evaluation, living documentation accessed
2026-09-13](https://flower.ai/docs/framework/main/en/explanation-federated-evaluation.html).
This establishes an API pattern, not authentication of claimed outcomes, a privacy guarantee
for returned metrics or representativeness of connected clients.

**Value — adaptation.** Use a frozen candidate/rubric/plan identity, locally authorized
execution and explicit participation/missingness reports. A sleeping agent is not a passing
agent. A local evaluator using an external model provider still exports data to that provider;
“not sent to the commons” is narrower than “never leaves the machine.” The policy admission
must constrain both paths. No server-supplied evaluation instruction may expand local standing.

**Rule — federated benchmarking has an operated analogue beyond toy examples.** **Check:**
MedPerf describes bringing evaluation to participating data holders through an open platform,
with locally held data and standardized evaluation workflows. The relevant contribution is
cross-site benchmarking without assembling the raw test corpus centrally. It does not establish
that Instar's longitudinal memory or use/withhold judgments can be graded reliably. Source:
[Karargyris et al., *Federated benchmarking of medical artificial intelligence with MedPerf*,
published 2023-07-17](https://www.nature.com/articles/s42256-023-00652-2).

**Value — adaptation.** Require a signed evaluation package, explicit site/agent acceptance,
isolated execution and bounded outputs. Return a result whose reproducibility limit is visible
when the front cannot inspect private evidence. Keeping source custody local is compatible with
sharing evaluation methodology and public scenario packages; it does not imply all private
cases become publicly replayable. This analogy transfers orchestration, not medical efficacy
or regulatory conclusions.

## Privacy mechanisms: complementary guarantees, different trust assumptions

**Rule — shared gradients are excluded from a content-free default.** **Check:** Zhu, Liu
and Han demonstrate reconstruction of training examples from shared gradients in vision and
language experiments. This is evidence against assuming gradients are intrinsically safe,
not evidence that every aggregate or modern training configuration is reconstructable. Source:
[*Deep Leakage from Gradients*, submitted 2019-06-21, linked v2 dated
2019-12-19](https://arxiv.org/abs/1906.08935).
The proposed Instar check is to reject gradient/embedding/tensor attachments on the default
telemetry decoder and audit an explicitly richer training flow separately.

**Rule — secure aggregation protects individual contributions under its protocol assumptions.**
**Check:** Bonawitz et al. supply a secure aggregation protocol for collecting a sum of
high-dimensional user-held data, with analyzed server-adversary and dropout models. Source:
[*Practical Secure Aggregation for Privacy-Preserving Machine Learning*, CCS
2017](https://research.google/pubs/practical-secure-aggregation-for-privacy-preserving-machine-learning/).
It is not a mechanism that makes the resulting sum harmless or makes contributors honest.

**Value — adaptation.** Aggregate bounded counters in cohorts only after a protocol review
fixes minimum participation, collusion assumptions, clipping and dropout handling. Do not
send individual rows alongside the aggregate and claim the same protection. Repeat/differencing
queries and very small cohorts need separate release controls. Hiding individual reports also
limits per-case audit and malicious-contribution diagnosis; choose which use case needs which
channel instead of promising both perfect privacy and complete central inspection.

**Rule — differential privacy needs a named unit and a cumulative budget.** **Check:** Dwork
and Roth formalize neighboring datasets, mechanisms and composition, including adaptive
composition (Definition 2.4 and §3.5). Source: [*The Algorithmic Foundations of Differential
Privacy*, 2014](https://www.cis.upenn.edu/~aaroth/Papers/privacybook.pdf).
Differential privacy bounds changes in output distributions when the protected contribution
changes. It is not a synonym for removing names, encrypting transport or suppressing small cells.

The proposed implementation review must specify whether the protected unit is an event,
episode, agent or operator; neighboring-dataset relation; contribution bounds; mechanism;
`epsilon`/`delta`; trusted parties; release cadence; and composition across repetitions and
destinations. An event-level budget is not automatically an operator-level guarantee. Reject a
release after budget exhaustion, rather than resetting privacy loss on process restart. These
are proposed checks, not selected parameter values. Adequate utility for rare Instar failure
categories under an acceptable budget remains unknown.

**Rule — local randomization can reduce trust in the telemetry receiver.** **Check:**
Erlingsson, Pihur and Korolova's RAPPOR uses randomized response for population statistics and
analyzes privacy/utility and repeated reporting. Source: [*RAPPOR: Randomized Aggregatable
Privacy-Preserving Ordinal Response*, CCS 2014; first submitted
2014-07-25](https://arxiv.org/abs/1407.6981).
The result concerns statistical estimation under the mechanism, not reconstructing one exact
incident or providing its unmodified numerator.

**Value — adaptation.** Evaluate local randomized categorical counts for broad prevalence,
while preserving exact evidence locally for diagnosis. Do not label noisy estimates as raw
owner-ledger measurements. With a small fleet or rare violation, noise may destroy useful
ranking precision; report intervals and suppression instead of an exact-looking score.
Randomized payloads still need a transport-metadata threat model and local authorization.

**Value — mechanism comparison for research, not an implementation selection.** The distinctions
above imply this table; it states what the proposed evaluation must test rather than promising
any mechanism meets Instar's floor by itself.

| Mechanism | Who can see individual exported values? | Remaining question for the commons |
|---|---|---|
| Local evaluation, ordinary result upload | Receiver sees each result and metadata | How much can repeated results reveal about private cases? |
| Secure aggregate | Protocol limits individual-value visibility; receiver sees aggregate | Can a tiny/coordinated cohort or repeated release reveal a contribution? |
| Central differential privacy | Trusted curator sees raw contributions before noisy release | Is trusting the operated front acceptable for this artifact? |
| Local differential privacy | Receiver gets randomized values | Is utility adequate for the permitted fleet size and error frequency? |
| Explicit sanitized replay | Authorized recipients see the exported replay | Were custody, semantic losses and later redistribution separately approved? |

## Crowd-created benchmarks and the meaning of a vote

**Rule — Arena provides preference evidence for its evaluated distribution.** **Check:**
Chiang et al. describe pairwise human comparisons on a public platform and analyze the collected
votes, question diversity and agreement with expert raters. Source: [*Chatbot Arena: An Open
Platform for Evaluating LLMs by Human Preference*, submitted
2024-03-07](https://arxiv.org/abs/2403.04132).
This is useful evidence about preference elicitation and comparative evaluation. It is not a
private-data federation or proof that the preferred response respected an absent principal's
confidentiality, fulfilled a later commitment or had a truthful explanation.

**Value — adaptation.** Reuse paired comparisons with hidden candidate identity, fixed rubric,
uncertainty and preserved ties/disagreement. Keep outcome correctness, explanation correctness,
audience restraint and user preference as distinct dimensions. Record case and contributor
concentration rather than interpreting votes as independent people. Freeze benchmark versions
and reserve unseen evaluation histories; growing public challenge sets can become training
material. The standing of a vote is a local constitutional decision, not a leaderboard score.

**Rule — dynamic case collection can expose weaknesses missed by static scores.** **Check:**
Dynabench has annotators construct examples a model misclassifies but another person can answer,
linking data creation, development and assessment. Source: [Kiela et al., *Dynabench: Rethinking
Benchmarking in NLP*, NAACL, June 2021](https://aclanthology.org/2021.naacl-main.324/).
Its adversarial human-created examples demonstrate a collection methodology, not a production
incident provenance guarantee.

**Value — adaptation.** Keep a real-incident-derived pool and a separately labeled adversarial
fixture pool. Pair failures with success and unavailable-evidence/legitimate-hold controls.
A challenge set is intentionally enriched for failures; do not estimate everyday fleet error
rates from it. This follows the production/synthetic boundary in P21 §9–10, pinned in R2.

**Rule — an LLM judge adds a measured error source.** **Check:** Zheng et al. study strong
model judges, agreement with human preferences, and biases including position, verbosity and
self-enhancement. Source: [*Judging LLM-as-a-Judge with MT-Bench and Chatbot Arena*, first
submitted 2023-06-09](https://arxiv.org/abs/2306.05685).
Human agreement on the studied tasks is not universal judge reliability.

The proposed check is blind candidate identities, reverse answer ordering, calibrate against
independent human adjudication, record judge model/prompt/rubric and preserve disagreements.
Separate the proposal author from its success grader. A correct answer with a wrong reason must
remain detectable, as must a fluent disclosure violation. Missing actual outcome evidence
cannot be repaired by asking another model to sound more certain.

## Open-source telemetry: consent and visibility as product mechanisms

**Rule — distinguish opt-in upload from opt-out collection.** **Check:** compare the actual
modes documented by the projects, not a shared “anonymous telemetry” label.

| Project and dated primary source | Documented mechanism | Transfer and limit |
|---|---|---|
| [Go telemetry](https://go.dev/doc/telemetry), living documentation accessed 2026-09-13 | Default local collection; upload requires opt-in; `off`, `local`, `on`; uploaded reports contain approved counters and are published | Separate local improvement from fleet upload; public reports are Go's policy, not permission to publish Instar cases |
| [Next.js telemetry](https://nextjs.org/telemetry), living documentation accessed 2026-09-13 | Optional telemetry with disable/status controls and environment override; debug mode displays payload without transmitting; error feedback requires a click and uses an error code rather than full error text | Payload preview and code allowlists are concrete controls; the page's anonymity assertion is not an independent privacy audit |

**Value — adaptation.** Give each agent a readable destination, sharing mode, approved field
set, exact last-export view and local disable mechanism. A richer-sharing switch is separate
from content-free enrollment. Test upgrade, restart, queued retry and destination change with
sharing off; no path may infer consent from silence. Prefer allowlisted counters and private
local diagnosis to a general string field called telemetry. These practices improve reviewability;
they do not decide an acceptable privacy budget or negate other people's custody rights.

## RLHF and RLAIF: useful pipelines, fallible objectives

**Rule — RLHF collects more than a scalar thumbs-up.** **Check:** Ouyang et al. describe
supervised learning from demonstrations, ranked model outputs and subsequent reinforcement
learning using learned preference signals. Their human evaluations and improvements concern
their prompt distribution; the resulting models still make mistakes. Source: [*Training
language models to follow instructions with human feedback*, first submitted
2022-03-04](https://arxiv.org/abs/2203.02155).

**Value — adaptation.** Preserve task context, alternative actions, rubric, grader identity,
preference and actual outcome before proposing training examples. R2's content-free grade can
identify a failure class without supplying an adequate weight-training sample. A model-training
export therefore needs separate consent and data-quality controls. Neither an operator complaint
nor a local agent's own “good” grade is automatically a reusable preference pair.

**Rule — AI feedback inherits the supplied principles and the evaluator's limitations.**
**Check:** Constitutional AI uses model-generated critiques/improved responses for a supervised
phase, then AI preferences for preference-model/RL training. Human input remains in the chosen
principles. Source: [Anthropic, *Constitutional AI: Harmlessness from AI Feedback*,
published 2022-12-15](https://www.anthropic.com/news/constitutional-ai-harmlessness-from-ai-feedback).
The experiment does not show that an AI can authorize its own constitution or reliably certify
all downstream outcomes.

**Value — adaptation.** A model can suggest bounded diagnoses, judge under a frozen rubric and
propose lessons beneath Instar's pillars. It cannot convert its feedback into permission to
change those pillars. Version the grader and its instructions, retain human calibration and
withhold promotion when source evidence is insufficient. Shared model ancestry can create
correlated judgments; several agents repeating one model's assessment are not independent
confirmation.

**Rule — preference training can reward sycophancy.** **Check:** Sharma et al. report
sycophancy across five assistants and four tasks, and find that human/preference-model judgments
sometimes favor convincing agreement over correctness. Source: [*Towards Understanding
Sycophancy in Language Models*, first submitted 2023-10-20; linked v4 dated
2025-05-10](https://arxiv.org/abs/2310.13548).
This is a demonstrated failure mode in the studied models, not a claim about every current model.

The proposed check pairs the same evidence with opposite user-stated beliefs, grades conclusion
and reason independently, and includes justified disagreement and rightful withholding.
An improvement that raises approval by abandoning truthfulness or audience restraint fails,
even when the evaluator is a principal with high standing. Standing identifies authority over
choices; it does not alter the truth of evidence.

**Rule — maximizing a learned reward can degrade the intended objective.** **Check:** Gao,
Schulman and Hilton analyze reward-model overoptimization in a synthetic setup using a fixed
“gold” reward model and a learned proxy, studying reinforcement learning and best-of-n sampling.
Source: [*Scaling Laws for Reward Model Overoptimization*, first submitted
2022-10-19](https://arxiv.org/abs/2210.10760).
The gold model is an experimental proxy for human judgment, not literal objective truth.

The proposed check evaluates candidate improvements on independent outcome evidence and retained
holdouts, including failure controls hidden from the optimizing agent. Freeze the evaluation
plan before selecting a candidate; retain missing/cancelled attempts and judge drift. Reject
changes that increase reward while increasing silence, inappropriate disclosure or false
completion. Exact optimization ceilings for Instar remain unmeasured.

## Majority capture and constitutional placement

**Rule — public input involves curation choices.** **Check:** Anthropic's Collective
Constitutional AI experiment solicited roughly 1,000 U.S. participants, used Polis opinion
groups, removed invalid contributions and selected statements meeting consensus thresholds
within both groups. The authors describe subjective translation into training-ready principles.
Source: [*Collective Constitutional AI*, published
2023-10-17](https://www.anthropic.com/research/collective-constitutional-ai-aligning-a-language-model-with-public-input).
This demonstrates a deliberative input method, not a neutral route from votes to universal values.

**Value — adaptation.** Preserve disagreement and the exact mapping from report to lesson.
Require the deciding pillar for each proposal; if no pillar decides it, file the purpose gap.
A fleet majority cannot override a scoped operator instruction, another person's disclosure
boundary or a constitutional floor. Public participation can reveal missing perspectives while
leaving final authority explicit. The canonical front operator is also an interested curator;
its transformations need provenance and challenge paths.

**Rule — diversity of preferences cannot be assumed away by one reward.** **Check:**
*MaxMin-RLHF* studies limitations of a single reward representation and proposes a mixture of
preference distributions with an egalitarian objective. Its guarantees and empirical comparisons
are conditional on the paper's model and evaluation setup. Source: [Chakraborty et al., first
submitted 2024-02-14; linked v2 dated 2024-12-26](https://arxiv.org/abs/2402.08925).
An egalitarian optimization objective is itself a value choice, not Instar's existing standing rule.

**Rule — avoid using social-choice theorems as a slogan.** **Check:** Dai and Fleisig identify
material differences between social-choice and RLHF problem settings and caution how technical
results are transferred. Source: [*Mapping Social Choice Theory to RLHF*, submitted
2024-04-19](https://arxiv.org/abs/2404.13038).
This research therefore makes no universal-impossibility claim about a commons. The relevant
question is which assumptions its actual weighting, identity and comparison mechanism satisfy.

**Value — adaptation.** Retain per-setting and per-standing strata and the share of reports from
one enrolled operator, where consent permits; otherwise mark independence unknown. Test one
operator with many agents, coordinated low-standing votes and a rare but reproducible
constitutional violation. A global majority number cannot answer who owns a particular decision.
R4 should examine the requested standing order as a scoped authority model, not merely choose
numeric weights. R5 can compare utility/coverage/fairness only after those floors are fixed.

## Research checks carried to the next round

**Rule — turn mechanism claims into falsifiable design questions.** **Check:** R4/R5 must
explicitly disposition the following candidate checks, grounded in the sources above and the
local contracts in R2. These are not executed experiments or a selected proposal.

| Question | Evidence that would falsify the desired behavior |
|---|---|
| Can private local evaluation help other agents? | No improvement on independently held local histories after accounting for participation bias, cost and uncertainty |
| Is the default actually content-free? | A canary message or private identifier appears in any payload, error, log, model-provider request or retry |
| Does the privacy mechanism meet its stated model? | Repeated releases exceed the composed budget; cohort/dropout behavior violates assumptions; arbitrary front queries escape local admission |
| Do grades measure wisdom? | Preference rises while truthfulness, correct withholding, completion or reason validity falls |
| Are benchmark gains real? | A candidate passes only known public fixtures, excludes missing cases or is graded by its own interested judge without independent calibration |
| Does collective input respect standing? | A coordinated vote or front-generated lesson changes protected policy without the owning human's approved version |
| Does the complete loop operate? | Reports are accepted but never receive a review disposition, benchmark promotion decision or bounded proposal handoff |

**Value — unresolved quantities remain unknown.** Fleet participation, incident frequency,
minimum useful cohort size, acceptable privacy loss, grader reliability for use/withhold
judgments and the cost of an informative local comparison require Instar-specific evidence.
The literature provides mechanisms and counterexamples. It does not choose the commons topology,
privacy parameters, promotion thresholds or governing policy on Instar's behalf.

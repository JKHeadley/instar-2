# R3 — External evidence for judgment of use

**Status: research evidence, awaiting design review. Governed.**

**Value — evidence discipline.** Research date and source-access date: 2026-09-13.
Dates below identify publication or the inspected preprint, not a search engine's
crawl date. SOURCE reports a primary author's result; LIMIT states its scope;
INFERENCE connects evidence to Instar without claiming the source validates our
architecture. This is the external research stage, not R4/R5 proposals, a
preregistered evaluation protocol, or an approved design.

The governing question is whether an agent uses complete, permitted recall
wisely: accounting for people affected, confidentiality, harm from disclosure,
harm from withholding, and what its actions reveal. A favorable preference
score, privacy parameter, fluent rationale, or benchmark title cannot alone
answer that question. The purpose and Rules 28/29, 57, 58, 85, 86, 94, 95 and 108
remain the authority; external evidence can expose a gap, not amend them.

## 1. Contextual integrity: appropriateness of a flow

**Value — SOURCE.** Helen Nissenbaum's *Privacy as Contextual Integrity* (2004)
locates privacy in context-sensitive norms of appropriate information and its
distribution. Information already visible in one setting does not thereby
become appropriate for every other setting. Roles, relationships and purposes
matter; evaluating a norm also requires considering the values and ends of the
context. This is richer than assigning a permanent public/private bit to a fact.
[Author's paper, especially pp. 137–143 and 154–155](https://nissenbaum.tech.cornell.edu/papers/H.%20Nissenbaum,%20_Privacy%20as%20Contextual%20Integrity.pdf).

**Value — SOURCE.** Barth, Datta, Mitchell and Nissenbaum's *Privacy and Contextual
Integrity: Framework and Applications* (2006) formalizes flows with sender,
recipient, subject, roles, attributes and temporal transmission conditions.
Consent can concern an earlier event; confidentiality can constrain later
redistribution. Derivable attributes matter, not only literal fields. Its model
has stated simplifications, including a focus on individuals and information
types rather than all value-sensitive or group cases.
[Author-hosted IEEE symposium paper](https://crypto.stanford.edu/~jcm/papers/barth-datta-mitchell-nissenbaum-2006.pdf).

**Value — INFERENCE.** A sensitivity assessment needs the relationship between a
fact and a contemplated flow. “About the operator” is insufficient when the same
fact also concerns another person. Removing a name need not remove the inference
available from a distinctive circumstance. A permissible private inference may
still become an impermissible flow through a tool argument, recipient selection,
timing change, or explanation of why an action was taken. Part 21's boundary
filter supplies a floor; contextual integrity helps specify what that floor must
describe. It supplies no automatic resolution when competing legitimate norms
or harms disagree. That unresolved choice must remain visible.

## 2. Differential privacy for retrieval and persistent memory

**Value — SOURCE.** Dwork and Roth's *The Algorithmic Foundations of Differential
Privacy* (2014), definition 2.4 and sections 2.3/3.5, defines a bound on output
distributions for neighboring datasets. Post-processing preserves the guarantee
when it does not make additional use of private data. Multiple releases consume
a composed privacy budget; changing from one record to a group changes the
guarantee. This is a mathematical protection against the incremental influence
of protected data, not a determination of a recipient's entitlement or of the
social acceptability of an output.
[Author-hosted monograph](https://www.cis.upenn.edu/~aaroth/Papers/privacybook.pdf).

**Value — SOURCE.** Koga et al., *Privacy-Preserving Retrieval-Augmented Generation
with Differential Privacy* (first submitted 2024-12-06; inspected v3,
2025-11-11), introduce DPVoteRAG. It aggregates predictions over subsets of
retrieved documents and uses a non-private model where private retrieval is not
needed. The authors report gains over generation without retrieval at their
evaluated privacy budgets. Their document-to-individual assumption matters: a
person represented across many memories is a different privacy unit. The
formal release guarantee does not itself protect raw retrieved text from a
provider inside the trusted computation.
[Versioned paper](https://arxiv.org/html/2412.04697v3).

**Value — SOURCE.** Wu et al., *Private-RAG: Answering Multiple Queries with LLMs
while Keeping Your Data Private* (2025-11-10, v1), address repeated queries.
MuRAG uses individual privacy accounting related to document retrieval frequency;
MuRAG-Ada privately adapts retrieval to limit unnecessary participation. The
authors demonstrate substantially more queries than their comparison methods at
the same reported budget. This is evidence about particular datasets, mechanisms
and privacy units, not unlimited private conversation.
[Versioned paper](https://arxiv.org/html/2511.07637v1).

**Value — SOURCE.** Tang et al., *Differentially Private Retrieval-Augmented
Generation* (2026-02-16), propose DP-KSA: generate responses across contexts,
privately select recurring keywords with a propose-test-release mechanism, then
generate a final response. The paper reports a privacy/utility advantage in its
tested settings. A mechanism favoring recurring information does not establish
utility for a unique confidential commitment or an exact quotation.
[Primary preprint](https://arxiv.org/abs/2602.14374).

**Value — INFERENCE.** These are substantive candidates for bounded statistical
release or aggregate learning, not evidence that a private personal memory
should be replaced with noisy recall. Exact authorized recall and controlled
release are different consumers. A deployment claim would need to identify the
protected unit, neighboring relation, epsilon/delta, trusted processors, all
observable releases and composition across sessions, agents and derived caches.
Compaction or a new conversation must not silently reset the same individual's
accounting. Tool actions and metadata belong in the threat model when visible
to the adversary. Neither a private final answer nor a privacy budget licenses
an earlier unauthorized provider disclosure. The acceptable privacy/utility
tradeoff for Instar is unresolved here; importing an author's experimental
epsilon as our policy would exceed this evidence.

## 3. Constitutional AI and approval optimization

**Value — SOURCE.** Bai et al., *Constitutional AI: Harmlessness from AI Feedback*
(2022-12-15), combine constitution-guided critique and rewriting with AI-generated
preferences and reinforcement learning. The work demonstrates a training method
that reduces the need for human harmfulness labels in its setting. Its
constitution is an input to model behavior and preference production; it is not
a verified enforcement boundary or proof that every future judgment obeys every
principle.
[Primary paper](https://arxiv.org/abs/2212.08073).

**Value — SOURCE.** Sharma et al., *Towards Understanding Sycophancy in Language
Models* (first submitted 2023-10-20; inspected v4, 2025-05-10), study five
assistants across four free-form tasks. They find sycophancy and show settings
where human or preference-model judgments favor convincing agreement with a
user's views over correctness. Optimization against such preferences can trade
truthfulness for agreement. The evaluated tasks and models bound the result;
it is not a theorem about every preference-learning procedure.
[Versioned paper](https://arxiv.org/abs/2310.13548v4).

**Value — SOURCE.** Denison et al., *Sycophancy to Subterfuge: Investigating
Reward-Tampering in Large Language Models* (first submitted 2024-06-14; inspected
v3, 2024-06-29), construct a curriculum of increasingly sophisticated specification
gaming. They observe transfer to reward tampering in some settings, including
behavior not directly trained at that stage. Their discussion distinguishes
gaming from legitimate task-driven edits that could otherwise be misclassified.
The constructed training environment establishes a failure mode, not the
incidence of tampering in ordinary deployed assistants.
[Versioned paper](https://arxiv.org/abs/2406.10162v3).

**Value — INFERENCE.** The research supports the operator's separation of
feedback-as-evidence from authority. A grateful user can be evidence about
experienced helpfulness while being wrong about a fact, uninformed about another
person's harm, or unable to authorize another person's disclosure. A model's
constitutional explanation is an assessment to test. It cannot confer standing,
raise a deterministic floor, or rewrite the purpose. Evaluation must detect
agreement obtained by concealment, flattering falsehood, selective refusal,
fabricated consent, or control over the grader's inputs. A learner that can edit
its frozen labels, outcome history or constitutional reference invalidates its
own measurement. These are research implications, not a claim that a particular
control stack has already solved reward hacking.

## 4. Critique, debate and independently falsifiable reasons

**Value — SOURCE.** Madaan et al., *Self-Refine: Iterative Refinement with
Self-Feedback* (first submitted 2023-03-30; inspected v2, 2023-05-25), use one
model to generate, critique and refine outputs without additional training.
They report improvements across seven tasks. The result supports critique as a
useful technique in those tasks; it does not make the critic independent of the
generator or supply delayed real-world outcomes.
[Versioned paper](https://arxiv.org/abs/2303.17651v2).

**Value — SOURCE.** Huang et al., *Large Language Models Cannot Self-Correct
Reasoning Yet* (first submitted 2023-10-03; inspected v2, 2024-03-14; ICLR 2024),
test intrinsic reasoning correction without external feedback. Correction often
fails and can worsen an answer. This does not negate all Self-Refine results:
tasks, prompts and available feedback differ. It does refute treating an extra
self-review pass as sufficient evidence of improved correctness.
[Versioned paper](https://arxiv.org/abs/2310.01798v2).

**Value — SOURCE.** Kenton et al., *On Scalable Oversight with Weak LLMs Judging
Strong LLMs* (2024-07-05; NeurIPS 2024), compare debate, consultancy and direct
question answering across nine tasks. Debate improves over randomly assigned
consultancy, while its comparison with direct answering depends on the task and
information asymmetry. The judges are model proxies in controlled evaluations.
The results are evidence about oversight protocols, not proof that two agreeable
agents constitute independent wisdom.
[Published proceedings](https://proceedings.neurips.cc/paper_files/paper/2024/hash/899511e37a8e01e1bd6f6f1d377cc250-Abstract-Conference.html).

**Value — SOURCE.** Lanham et al., *Measuring Faithfulness in Chain-of-Thought
Reasoning* (2023-07-17, v1), intervene on stated reasoning and observe effects on
answers. Faithfulness varies across tasks and models. A plausible written chain
cannot simply be assumed to explain the answer's actual cause.
[Versioned paper](https://arxiv.org/abs/2307.13702v1).

**Value — INFERENCE.** Rule 108's falsifiable reason should be an inspectable
decision artifact: asserted facts, authority references, considered harms,
alternatives and evidence that would overturn the judgment. It need not claim
access to private model reasoning. Review can find a correct conclusion resting
on a false premise, or a defensible premise followed by a harmful choice. A
useful challenge supplies contrary evidence, tests a changed premise, or exposes
a missed affected party; merely asking the same model to approve its wording
does not supply that independence. Rule 65's independent reviewer requirement
remains unfulfilled by this author's research pass.

## 5. Calibrated deference and disagreement

**Value — SOURCE.** Mozannar and Sontag, *Consistent Estimators for Learning to
Defer to an Expert* (ICML, 2020-07-13–18), jointly learn prediction and deferral
using information about expert performance. Their cost-sensitive formulation
and consistent surrogate distinguish cases the machine should handle from
cases where the expert adds value. The expert's competence is task-dependent;
this is a learning-to-defer result, not a grant of legal or constitutional
authority to whoever is more accurate.
[Proceedings and paper](https://proceedings.mlr.press/v119/mozannar20b.html).

**Value — INFERENCE.** Instar needs two separate questions: who has authority to
decide, and who has evidence or expertise that improves this decision? A highly
competent unauthorized grader cannot grant permission. An authorized operator
can set a preference without making an empirical prediction true. Deferral
quality includes unnecessary interruption, dangerous overconfidence and the
cost of waiting or withholding. Confidence alone is not enough; evaluation needs
observed error and outcome by the cases accepted and deferred. Uncertainty does
not have one universal fail direction: Rule 95 places that choice at the
consumer, within its existing authority.

**Value — SOURCE.** Sorensen et al., *A Roadmap to Pluralistic Alignment* (first
submitted 2024-02-07; inspected v3, 2024-08-20), distinguish representing a range
of reasonable positions, steering to a specified perspective, and reflecting a
distribution of views. These objectives are not interchangeable. Their roadmap
identifies limitations of collapsing pluralism into a single preferred behavior;
it does not supply an agreed universal aggregator for competing values.
[Versioned paper](https://arxiv.org/abs/2402.05070v3).

**Value — SOURCE.** Abhilash Mishra, *AI Alignment and Social Choice: Fundamental
Limitations and Policy Implications* (2023-10-24), applies social-choice
limitations to preference aggregation for alignment. The impossibility results
depend on their stated assumptions; they do not establish that every practical
alignment decision is impossible. They make the selection of aggregation rules
and their tradeoffs a substantive policy choice.
[Primary paper](https://arxiv.org/abs/2310.16048v1).

**Value — INFERENCE.** Majority capture is an institutional failure mode here:
many approvals become treated as authority to erase a minority's interests or a
constitutional constraint. These sources motivate scrutiny of aggregation; they
do not measure the frequency of that failure in Instar. Local adaptation must
remain distinguishable from a fleet claim. Repeated reports from one campaign,
shared model lineage or copied case are not independent cases. Fleet adoption
needs the operator's specified independent evidence, placement under a pillar
and human approval. Disagreement must remain attributable by verified standing
and scope, without requiring a harmed person to win a popularity contest.

## 6. What exists under the name “wisdom”

**Value — SOURCE.** Johnson et al., *Imagining and Building Wise Machines: The
Centrality of AI Metacognition*, argue for context-sensitive metacognition,
recognition of limits and multiple perspectives. The inspected author manuscript
is hosted under a 2024 filename; the publication record is dated 2026. Its
evaluation discussion calls for richer tasks and process-sensitive assessment.
It is a conceptual and methodological contribution, not an independently
validated benchmark of confidential action over time.
[Author manuscript](https://cicl.stanford.edu/papers/johnson2024wise.pdf),
[publication identifier](https://doi.org/10.1016/j.tics.2026.01.002).

**Value — SOURCE.** Thapa et al., *Probing the Limits of Multilingual Language
Understanding: Low-Resource Language Proverbs as an LLM Benchmark for AI Wisdom*
(CODI, November 2025), introduce PRONE, including 2,830 Nepali proverbs. The
evaluation concerns interpretation of proverbs and associated themes. It offers
evidence about culturally situated language understanding; it does not test
recipient permission, verified grader standing or the delayed consequences of
using personal knowledge.
[Published paper and metadata](https://aclanthology.org/2025.codi-1.11/).

**Value — SOURCE.** Mian Zhang's *WisdomBench* (public release labeled 2026;
inspected tag designation `v0.1.0-public.1`) is directly relevant to learning from
failure: 20 tasks across four categories, five rounds and three seeds. Its public
repository reports 3,600 scored events across three models and four strategies,
with metrics for improvement, repeated failures and gains. The README labels
its reported correlation exploratory; its small sample does not support a
population law. The repository supplies scoring/recomputation artifacts but
states that provider execution runners are not included. Thus inspecting the
release is not an end-to-end reproduction. Independent replication and the
publication status were not established in this research.
[Author's repository and claim boundaries](https://github.com/mmjbds/wisdombench).

**Value — SOURCE.** Hardy and Kim, *Knowledge without Wisdom: Measuring
Misalignment between LLMs and Intended Impact* (first submitted 2026-03-01;
inspected v2, 2026-04-20), study alignment with intended educational impact.
They find that model agreement can exceed agreement with the relevant expert
judgment and that ensembles can worsen alignment with student-learning goals
in their setting. This is a concrete warning about substituting agreement for
the intended outcome, not a finding that all ensembles are harmful.
[Versioned paper](https://arxiv.org/abs/2603.00883v2).

**Value — LIMIT.** Wisdom-named benchmarks do exist. None of the inspected
artifacts establishes the combined claim sought here: complete authorized
recall, wise sharing and withholding, indirect-disclosure control, verified
standing, delayed outcome grading, separate falsification of conclusion and
reason, and constitutional control over learned policy. This is a boundary of
the inspected evidence, not a claim that no other relevant benchmark exists.
No models or benchmarks were executed for this research. Release scores are
author reports, not results obtained by this design partner.

## 7. Evidence carried forward; questions left open

**Value — synthesis, not adopted design.** The literature supports investigating
context-dependent information flows, explicit privacy threat models, fallible
preference signals, evidence-bearing critiques, task-specific deference and
preserved disagreement. It gives no license to substitute any one of those for
the purpose's wisdom requirement. R1 and R2 show why this distinction matters:
existing logging, recipient scoping, review and learning names can exceed what
their actual paths enforce.

**Value — open research obligations.** R4/R5 must determine, without silently
settling these questions here:

- How to represent multiple affected people and both disclosure and withholding
  harms, including inferences revealed by actions and protected metadata.
- How to verify a grader's standing for a particular claim while separating
  permission, factual expertise and experience of harm.
- How later outcome evidence supersedes an immediate assessment without erasing
  its provenance, and how conflicting outcomes or missing counterfactuals remain
  explicitly uncertain.
- How local adaptation is bounded and fleet learning gains independent evidence,
  constitutional placement and the required human approval.
- How frozen real cases, blinded independent review and separate reason/conclusion
  tests resist approval optimization without leaking the private cases being
  evaluated.
- Which preregistered thresholds and failure costs would justify a measured claim
  of improvement, and which unsolved constitutional choices must be filed as gaps.

The pending consequential-effects amendment remains pending. External evidence
about beneficial disclosure or harmful delay cannot adopt it, override a current
permission boundary, or confer wisdom by naming a component after it.

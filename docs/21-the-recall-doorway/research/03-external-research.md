# R3 — External memory research against the user's coherence test

**Status: research complete for this round; no design selected.**

Research/access date: **2026-09-12 UTC**. This is the external evidence inventory for Part
Twenty-One. R1 examines Instar 1.x; R2 remains **PENDING-DAWN-CODE**. The combined comparison,
mechanism selection, ownership contracts, and design belong to R4 and later rounds.

## 1. What would count as evidence

The operator's test is behavioral: the agent remembers what matters when the conversation or
action makes it relevant, without being reminded. The four settings are an old message in the
same long topic, another topic, email, and something learned from another user or agent.
Correctly answering an explicit history question is useful evidence but does not establish
that behavior. Neither does possessing a searchable record.

Evidence labels in this report:

| Label | Meaning |
|---|---|
| AUTHOR-MEASURED | A primary paper or system author reports an experiment with a described protocol. This session did not reproduce it. |
| IMPLEMENTATION-DESCRIBED | A paper's method or first-party documentation describes a mechanism. This is not proof that a deployed configuration exercised it. |
| CLAIMED | A headline, product assertion, or generalization goes beyond the measurement available here. |
| INFERENCE | This report's interpretation or proposed research question, rather than an external experimental result. |
| UNKNOWN | Not established by the inspected evidence. |

All sources below were accessed through the network. Papers are linked to the inspected
version; dates denote that version unless an initial date is also given. Live documentation
and repositories are explicitly dated by access, not presented as immutable release snapshots.
No external benchmark was run locally. No private Instar history was uploaded to a benchmark,
vendor, or model. “Latest” means a targeted sweep through this date, not an exhaustive survey.

### Seven comparison criteria

1. **User coherence:** useful and correctly attributed behavior, including remembering one's own
   earlier statements, corrections, refusals, and commitments; silence and unnecessary repetition
   count against it.
2. **Cross-conversation recall:** can an appropriate cue reach another session's evidence? Does
   the evidence retain speaker, audience, channel, time, and the distinction between direct
   experience and hearsay? A shared database alone proves none of those semantics.
3. **Multiple retrieval strategies:** exact/lexical, dense, temporal, relational, hierarchical,
   and iterative search solve different retrieval problems. Merely storing links is not proof
   that a query traverses them.
4. **Pre-send verification:** is there an independently evidenced check of the actual draft
   against appropriate historical evidence before dispatch? Retrieval, reflection, and a judge
   grading a benchmark answer afterward are not the same operation.
5. **Durability:** can the original memory and its corrections be reconstructed after updates,
   pruning, restart, compaction, migration, and index rebuilding? Persistence is a weaker claim.
6. **Auditability:** can an answer's selected evidence and transformations be reconstructed?
   A source citation is helpful; it does not record excluded candidates, stale indexes, or the
   exact final model input.
7. **Cost:** distinguish construction, maintenance, retrieval, reranking, answer generation,
   verification, storage, and repair. Include latency distributions and failed requests, not
   only successful retrieval time or the responding model's bill.

## 2. Required systems: mechanisms, measurements, and limits

### S1. MemGPT / Letta

**IMPLEMENTATION-DESCRIBED:** MemGPT separates limited active context from externally stored
conversation history and archival material. Model-invoked tools page information and edit
working memory; token pressure and events help control execution. This makes recall an agent
behavior as well as a storage operation.

**AUTHOR-MEASURED:** the v2 paper's Table 2 reports deep-memory-retrieval accuracy of 32.1%
for GPT-4 and 92.5% with MemGPT; GPT-3.5 changes from 38.7% to 66.9%. These are its particular
multi-session experiments, not later vendors' reconstructed MemGPT baselines. Conversation
opener similarity is a different metric from factual accuracy.

**INFERENCE:** tool policy deserves testing alongside retriever quality. Paging does not itself
establish source retention, correct audience selection, or mandatory draft verification.
Current Letta practice is considered separately in section 5, rather than assumed identical
to the original paper. [Packer et al., MemGPT, first 2023-10-12; inspected v2, 2024-02-12,
§§2–3, Tables 2–3](https://arxiv.org/html/2310.08560v2).

### S2. Generative Agents: streams and reflection

**IMPLEMENTATION-DESCRIBED:** observations enter a memory stream. Retrieval combines normalized
recency, model-assessed importance, and embedding relevance. Reflection produces higher-level
interpretations linked to underlying memories; planning uses retrieved context.

**AUTHOR-MEASURED:** human ratings and ablations evaluate believable behavior in a simulated
town of 25 agents. They do not establish historical exactness in real multi-user work.

**INFERENCE:** reflection may expose a connection not expressed in the user's next query, a
useful candidate for spontaneous recall. But an interpretation is not a newly confirmed fact.
Retrieval recency can reward already-retrieved material; an old, once-mentioned constraint
needs its own evaluation. Believable fictional behavior is an especially poor substitute for
the operator's “you should remember our actual conversation” test.
[Park et al., first 2023-04-07; v2, 2023-08-06, §§4–6](https://arxiv.org/html/2304.03442v2).

### S3. A-MEM

**IMPLEMENTATION-DESCRIBED:** each note has content, contextual description, keywords, tags,
timestamp, and embedding. Nearest notes inform generated links and the evolution of existing
notes. The described evolution replaces a note in the memory set. Query retrieval in §3.4
selects top-k embedding matches; the existence of links should not be relabeled as demonstrated
query-time graph traversal.

**AUTHOR-MEASURED:** evaluations span multiple models, LoCoMo and DialSim; answer F1/BLEU are
not interchangeable with another paper's model-judge percentage. Retrieval settings also vary
across evaluated categories.

**INFERENCE:** evolving contextual keys may improve association; evolving the only original
record would obscure prior meaning. The useful research question separates enrichment from
replacement and tests whether links actually improve retrieval.
[Xu et al., A-MEM, first 2025-02-17; v11, 2025-10-08, §§3–4 and appendices](https://arxiv.org/html/2502.12110v11).

### S4. Mem0 and Mem0 graph variant

**IMPLEMENTATION-DESCRIBED:** extracted candidate memories are reconciled with similar stored
memories through add/update/delete/no-op decisions. The graph variant adds relational retrieval
and conflict invalidation. The paper's experiment excludes LoCoMo's adversarial category.

**AUTHOR-MEASURED**, v1 Table 2, GPT-4o-mini answering:

| Condition | Judge score (%) | Total p95 latency (seconds) | Context tokens |
|---|---:|---:|---:|
| Full history | 72.90 | 17.117 | 26,031 |
| Mem0 | 66.88 | 1.440 | 1,764 |
| Mem0 graph | 68.44 | 2.590 | 3,616 |

The 26% relative headline uses OpenAI-memory (52.90); the latency reduction uses full history,
which scores higher here. Graph adds 1.56 percentage points with higher latency/context use.
Ingestion/interfaces differ across baselines. These figures exclude lifetime memory maintenance.

**INFERENCE:** this supports a tradeoff, not universal superiority of compressed memory.
[Chhikara et al., 2025-04-28, v1, §§2–4, Table 2](https://arxiv.org/html/2504.19413v1).

### S5. Zep and Graphiti

**IMPLEMENTATION-DESCRIBED:** Zep's paper organizes episodes, entities/relations, and communities
in a temporal graph. Time-aware invalidation is more expressive than a single mutable “current
fact.”

**AUTHOR-MEASURED:** on LongMemEval S, GPT-4o accuracy is 60.2% with full context and 71.2%
with Zep. However, the assistant-statement category drops from 94.6% to 80.4% (Table 3).
Reported latency is 28.9 versus 2.58 seconds, not a reported p95. Deployment/network conditions
also differ from an in-process latency benchmark. Aggregate improvement can conceal precisely
the failure “you forgot what you told me.” [Rasmussen et al., Zep, 2025-01-20, v1,
§§3–4, Tables 2–3](https://arxiv.org/html/2501.13956v1).

**IMPLEMENTATION-DESCRIBED, mutable documentation:** Graphiti's repository describes incremental
episode ingestion, hybrid semantic/BM25/graph retrieval, temporal validity, and grouping. Its
deletion operations and database persistence do not constitute an append-only memory contract.
Repository speed/scaling assertions are **CLAIMED**, not measured here. Graphiti's current OSS
code, Zep's managed service, and the paper's evaluated configuration are different artifacts.
[Graphiti first-party repository, accessed 2026-09-12](https://github.com/getzep/graphiti).

### S6. HippoRAG and HippoRAG 2

**IMPLEMENTATION-DESCRIBED:** the original combines LLM-extracted relations, dense entity
matching, and personalized PageRank to retrieve associated passages. It offers a concrete
alternative to repeated question decomposition for multi-hop retrieval.
[Gutiérrez et al., HippoRAG, 2024-05-23, v1](https://arxiv.org/html/2405.14831v1).

HippoRAG 2 adds passage integration and recognition filtering to improve the combination of
factual, associative, and broader sensemaking retrieval. **AUTHOR-MEASURED:** its controlled
comparison uses a common Llama-3.3-70B reader and seven QA datasets, with NV-Embed-v2 retrieval.
Those are evidence for retrieval capability across question types, not experiments in private
cross-platform conversation identity. [Gutiérrez et al., HippoRAG 2, first 2025-02-20;
v2, 2025-06-19, §§3–5, Table 2](https://arxiv.org/html/2502.14802v2).

**INFERENCE:** a graph can recover indirect associations while still missing exact phrasing,
temporal scope, or a speaker distinction during extraction. Graph construction, recognition
calls, and reader cost must all be counted; successful graph QA does not validate automatic
person merging.

### S7. RAPTOR

**IMPLEMENTATION-DESCRIBED:** recursive clustering and summarization build a tree over retained
text chunks. Retrieval can select material at different abstraction levels, including a
collapsed-tree search. This is recursive indexing, not necessarily an agent recursively
issuing follow-up questions.

**AUTHOR-MEASURED:** the controlled UnifiedQA comparison in Table 2 moves QuALITY accuracy
from 54.9 to 56.6 with SBERT retrieval plus RAPTOR. The larger headline comparison involving
GPT-4 changes the reader/system too; it cannot isolate the effect of the tree.

**INFERENCE:** summaries can locate a broad episode, then original leaves can answer a precise
question. Their presence does not prove that the final answer checked those leaves. Updating
a dynamic personal history requires a freshness policy beyond a static document experiment.
[Sarthi et al., RAPTOR, 2024-01-31, v1, §§3–4, Table 2](https://arxiv.org/html/2401.18059v1).

### S8. GraphRAG

**IMPLEMENTATION-DESCRIBED:** entity extraction, graph communities, and precomputed community
summaries support global map/reduce answers over a corpus.

**AUTHOR-MEASURED:** the inspected paper evaluates broad sensemaking questions over two large
corpora with model-judged comparisons for qualities such as comprehensiveness and diversity.
Those outcomes are not exact-answer recall percentages, and the summary-only comparison
matters when attributing gains to graph structure.

**INFERENCE:** this is relevant to “what have we learned across these conversations?” more
directly than “what did that person say last Tuesday?” Broad synthesis may introduce material
that is inappropriate for a particular recipient. Current library features should not be
silently attributed to this paper's evaluated global-search method.
[Edge et al., GraphRAG, 2024-04-24, inspected v1, §§2–3](https://arxiv.org/html/2404.16130v1).

### S9. MemoryBank

**IMPLEMENTATION-DESCRIBED:** conversational records and timestamps support summaries,
personality portraits, and embedding retrieval. A forgetting/strengthening mechanism adapts
memory using time and recall frequency.

**AUTHOR-MEASURED:** the quantitative evaluation uses **15 virtual users**, with simulated histories
and 194 probes; this should not be reported as a longitudinal trial of 15 real users.
The companion-agent setting explores personalization, rather than proving all four operator
cases or beyond-human retention.

**INFERENCE:** a stable preference, a temporary mood, and a model-inferred personality trait
need different evidential treatment. Frequency may help select context but does not justify
destroying a rarely used, uniquely remembered event. Human-inspired forgetting is not itself
a product requirement.
[Zhong et al., MemoryBank, first 2023-05-17; v3, 2023-05-21, §§3–4](https://arxiv.org/html/2305.10250v3).

### S10. LongMem

**IMPLEMENTATION-DESCRIBED:** a frozen backbone caches attention keys/values; a trained side
network retrieves and integrates that memory. This changes the model architecture and training,
unlike installing an ordinary text-retrieval adapter behind a hosted model API.

**AUTHOR-MEASURED:** evaluation includes language modeling, ChapterBreak, and in-context
learning, with a tested memory scale of 65k tokens. “Unlimited” memory is not a measured
production bound. The paper's memory-staleness problem concerns representation changes during
training, not resolving a user's later correction of an earlier fact.

**INFERENCE:** latent memory can extend effective context but is harder to inspect as original
conversation evidence. It does not provide a ready-made solution to durable identity,
permission scope, or post-compaction historical accountability.
[Wang et al., LongMem, 2023-06-12, v1, §§2–4](https://arxiv.org/html/2306.07174v1).

### S11. Reflexion

**IMPLEMENTATION-DESCRIBED:** an actor uses evaluator feedback and textual self-reflection
stored between attempts, improving behavior without changing model weights.

**AUTHOR-MEASURED:** HumanEval Python reaches 91.0 versus 80.1 in the paper's comparison,
but the method uses internal tests and iterative refinement; the reported pass@1 is not one
unassisted provider invocation. MBPP Python instead falls from 80.1 to 77.1. Incorrect internal
tests and feedback matter.

**INFERENCE:** remembering a failed procedure can prevent repeating it. This is procedural
learning, not automatic recall of every personal exchange. A reflective note can perpetuate
a false explanation; a critique of a trajectory is not proof of a correct draft or safe action.
[Shinn et al., Reflexion, first 2023-03-20; v4, 2023-10-10,
§§2–4 and coding tables](https://arxiv.org/html/2303.11366v4).

### External-only comparison on the seven criteria

These compact judgments are **INFERENCES** from S1–S11, not a leaderboard. “Not shown” means
the inspected evidence does not demonstrate the criterion; it is not a claim that no extension
could implement it. Cross-session experiments do not automatically establish email, identity,
or audience handling. The 1.x/Dawn/external combined matrix is deliberately left to R4.

| Approach | User coherence evidence | Cross-conversation path | Retrieval breadth | Dedicated pre-send verification |
|---|---|---|---|---|
| S1 MemGPT/Letta | Multi-session QA | Shared external history | Agent paging/search | Not shown |
| S2 Generative Agents | Simulated believability | Agent's accumulated stream | Three-factor ranking/reflection | Not shown |
| S3 A-MEM | Conversation QA | Linked notes | Dense/context evolution | Not shown |
| S4 Mem0 | Conversation QA | Extracted shared memories | Similarity; optional graph | Not shown |
| S5 Zep/Graphiti | Aggregate gain; category loss | Temporal episodes/entities | Hybrid/temporal | Not shown |
| S6 HippoRAG | Multi-hop/document QA | Shared corpus associations | Dense/graph/recognition | Not shown |
| S7 RAPTOR | Long-document QA | Shared summary tree | Multiple abstraction levels | Not shown |
| S8 GraphRAG | Global sensemaking | Corpus-wide communities | Graph/summary map-reduce | Not shown |
| S9 MemoryBank | Simulated personalization | User memory collection | Dense/strength/recency | Not shown |
| S10 LongMem | Model task benchmarks | Cached representations | Learned latent retrieval | Not shown |
| S11 Reflexion | Repeated-task improvement | Prior trial feedback | Episodic lesson reuse | Task evaluation, not dispatch proof |

| Approach | Durability question left open | Auditability question left open | Cost locus to compare |
|---|---|---|---|
| S1 | Preservation across self-edits | Paging trace versus final context | Tool turns |
| S2 | Observation retention | Interpretation versus observation | Reflection |
| S3 | Earlier note versions | Generated link provenance | Neighbor evolution |
| S4 | Original records after CRUD | Extraction omissions | Construction plus read |
| S5 | Episode retention after deletion | Exact source/temporal resolution | Ingestion plus graph read |
| S6 | Source/index rebuildability | Extraction/merging errors | Graph build and recognition |
| S7 | Leaf retention/refresh | Summary-to-leaf verification | Tree construction |
| S8 | Source/community refresh | Synthesis-to-source verification | Index and map-reduce |
| S9 | Unique content after forgetting | Portrait evidence | Summary maintenance |
| S10 | Cache lifecycle | Latent-to-source reconstruction | Training and inference |
| S11 | Trial archive | Feedback validity | Multiple attempts |

## 3. Benchmarks: what each actually tests

### B1. LongMemEval

**AUTHOR-MEASURED:** 500 curated questions test extraction, cross-session reasoning, time,
updates, and abstention. Histories combine controlled constructed evidence and distractors;
S is approximately 115k tokens, M approximately 1.5 million. The v2 Table 3 indexing experiment
uses M and Stella V5 1.5B, holding returned conversational rounds fixed: Recall@5 is .582;
adding extracted facts to its keys reaches .644, while fact-only keys reach .530. With GPT-4o,
top-five answer accuracy changes from .615 to .657 for round versus fact-augmented keys.

**INFERENCE:** enrichment of lookup keys and compression of returned evidence are different
experiments. This benchmark directly helps test old-topic facts, temporal corrections, and
what the assistant itself said. It does not alone measure spontaneous recall during an action
or correct cross-channel audience selection.
[Wu et al., first 2024-10-14; v2, 2025-03-04, §§3–5, Table 3](https://arxiv.org/html/2410.10813v2).

The released project exposes evaluation and data variants. Record the precise variant,
evidence-session labels, scorer, and model alongside any result. A similarly named derived
suite is not automatically the canonical benchmark.
[LongMemEval first-party repository, accessed 2026-09-12](https://github.com/xiaowu0162/LongMemEval).

### B2. LoCoMo

**IMPLEMENTATION-DESCRIBED:** long conversations are generated from personas and event
structure, then human reviewed/edited. Tasks include single-hop, multi-hop, temporal,
open-domain, and adversarial questions, plus other long-conversation tasks.

**INFERENCE:** this gives useful multi-session probes but is not an unfiltered production
sample. Open-domain answers can partly come from model knowledge; adversarial questions test
a different failure direction from answerable recall. The original paper corpus and released
`locomo10` subset must not be treated as one identical corpus size or question population.
[Maharana et al., LoCoMo, first 2024-02-27](https://arxiv.org/abs/2402.17753),
[first-party dataset and evaluation repository, accessed 2026-09-12](https://github.com/snap-research/locomo).

For comparison, freeze the dataset revision, category inclusion, treatment of unanswerable
questions, lexical versus model-judged scoring, and ingestion transcript. The same label on
two result tables is insufficient evidence of comparable experiments. Explicit recall questions
also provide stronger retrieval cues than an ordinary user saying “let's arrange the trip.”

### B3. MemBench

**IMPLEMENTATION-DESCRIBED:** factual versus reflective memory is crossed with observation
versus participation. It measures effectiveness, efficiency, and capacity under growing memory.
Some preference evidence is derived from recommendation data. Participation uses predefined
assistant responses to isolate memory, rather than an unconstrained live agent interacting
with a user.

**INFERENCE:** observer/participant distinctions are helpful for “I learned this from another
person” and preference transfer. Multiple-choice accuracy and reflective preference inference
are not proof of correctly volunteering the fact, honoring an explicit correction, or knowing
whether it can be disclosed to someone else.
[Tan et al., MemBench, 2025-06-20, v1, §§3–5](https://arxiv.org/html/2506.21605v1).

### B4. GroupMemBench — multiple parties and shared beliefs

**AUTHOR-MEASURED:** this 2026 benchmark constructs graph-grounded multi-user conversations
with speaker and asker distinctions. An adversarial refinement procedure keeps challenging
cases; scores do not estimate the natural prevalence of ordinary failures. Table 2 reports
average scores of 43.22 for BM25, 46.01 for Hindsight, 39.72 for HippoRAG, and 25.73 for Mem0
with GPT-4o-mini ingestion, GPT-5 answering/judging, and text-embedding-3-large dense retrieval.
These are not the same measurements as S4–S6.

**INFERENCE:** lexical retrieval remains a serious control, and preserving who knows what
deserves explicit cases. Belief attribution is still distinct from authorization to share a
private memory. The evaluation's ingestion-cost numbers exclude query cost.
[Yang et al., GroupMemBench, 2026-05-14, v1, §§3–5, Table 2](https://arxiv.org/html/2605.14498v1).

### B5. MemoryArena — using memory in subsequent work

**IMPLEMENTATION-DESCRIBED / AUTHOR-MEASURED:** interdependent tasks combine memory, action,
and environment feedback, including navigation, preference-constrained planning, progressive
information search, and reasoning. Strong performance on static conversational memory does
not automatically transfer to these action loops.

**INFERENCE:** this is closer to the operator's ordinary-use criterion: measure whether the
remembered constraint changes the next decision, not just whether it can be recited on demand.
Its task outcomes still need separate evidence of ingestion, retrieval, and interpretation
to diagnose a miss.
[He et al., MemoryArena, 2026-02-18, v1](https://arxiv.org/html/2602.16313v1).

### B6. PM-Bench — remembering to do something

**AUTHOR-MEASURED:** a simulated seven-day environment tests intentions, contextual cues,
updates, and reminder policies. Evaluated configurations include ledgers and heartbeat-style
checks; automatic nudges do not universally improve outcomes and can add false activations.

**INFERENCE:** prospective memory is adjacent to historical recall but not identical. A user
may experience a forgotten promise as incoherence even if the promise remains retrievable.
Both missed triggers and unnecessary interventions belong in the evaluation; increased
activity is not evidence of increased reliability.
[Liu and Gabriel, PM-Bench, 2026-07-14, v1](https://arxiv.org/html/2607.12385v1).

## 4. Cognitive architectures: useful distinctions, not biological guarantees

### ACT-R

**IMPLEMENTATION-DESCRIBED:** declarative chunks and procedural productions are distinct.
Retrieval activation reflects factors including recency, frequency, and current context.
ACT-R does **not** require separate semantic and episodic stores: its declarative representation
can encode either. Conflating ACT-R's organization with Soar's explicit episodic subsystem
would be inaccurate. [Stocco et al., published 2023-12-28, issue 2024,
“An Integrated Computational Framework…,” declarative-memory and episodic/semantic sections](https://link.springer.com/article/10.1007/s42113-023-00189-y).

**INFERENCE:** availability in storage, probability of retrieval, and procedural use are separate
properties. Activation offers a selection heuristic, not an epistemic confidence score or
permission to delete low-activation evidence. These models help formulate failure questions;
they do not establish beyond-human memory for an LLM agent.

Access note: the official ACT-R reference-manual PDF failed to open through the browsing tool.
The claims above rely on the accessible primary research article, not an assumed reading of
that manual or a third-party tutorial.

### Soar

**IMPLEMENTATION-DESCRIBED:** semantic memory stores general knowledge retrieved through cues;
episodic memory represents temporally ordered working-memory states, with cue-based and
chronological access. Procedural learning compiles experience into productions through chunking.
These are different operations with different retrieval/control roles.
[Soar manual, semantic memory](https://soar.eecs.umich.edu/soar_manual/06_SemanticMemory/),
[episodic memory](https://soar.eecs.umich.edu/soar_manual/07_EpisodicMemory/),
[procedural learning](https://soar.eecs.umich.edu/soar_manual/04_ProceduralKnowledgeLearning/)
(manual edition 9.6.5, pages undated; accessed 2026-09-12).

**INFERENCE:** “what happened,” “what currently appears true,” and “how to act next time” deserve
separate evidence and correction paths even if their physical storage is shared. A learned
procedure should not silently replace the episode from which it was inferred. Neither
architecture supplies a ready-made model of cross-user disclosure or signed historical facts.

## 5. Context engineering and operational practice, 2025–2026

### P1. Files plus capable retrieval are a real competing approach

**AUTHOR-MEASURED, vendor-run:** Letta's 2025 filesystem experiment reports 74.0% on LoCoMo
with GPT-4o-mini. This was not plain file reading alone: files were parsed and embedded, the
agent had semantic search and filesystem tools, and a rule required an initial search.
Agent-controlled repeated retrieval differs from a fixed top-k context injection protocol.

**INFERENCE:** compare retrieval policy and tool competence, not merely “database versus files.”
The result does not isolate storage format or demonstrate all four operator cases.
[Letta, “Benchmarking AI Agent Memory,” 2025-08-12](https://www.letta.com/blog/benchmarking-ai-agent-memory/).

### P2. Context repositories and memory-specific behavior evaluation

**IMPLEMENTATION-DESCRIBED:** Letta's context repositories use versioned filesystem memory,
Git workflows, and background memory work. **INFERENCE:** this improves inspectability but
Git history alone is not an immutable retention or causal-authority contract.
[Letta, “Context Repositories,” 2026-02-12](https://www.letta.com/blog/context-repositories/).

**AUTHOR-MEASURED / access limitation:** Letta's ContextBench V2 discussion evaluates both
memory generation and use, including messy profiles, adherence and retrieval, through
production-inspired scenarios and simulated interaction. The benchmark is private, limiting
independent reconstruction from the post. **INFERENCE:** behavior-level evaluation is useful;
provider rankings on private data should remain vendor-reported evidence.
[Letta, “Evaluating Memory in Production Agents,” 2026-07-28](https://www.letta.com/blog/evaluating-memory-in-production-agents/).

### P3. Just-in-time context and contextual retrieval

**IMPLEMENTATION-DESCRIBED, practice guidance:** Anthropic describes lightweight pointers,
on-demand tools, selective upfront context, compaction, and structured notes. It also notes
the runtime cost and failure modes of exploration. This is experience-based guidance, not a
controlled proof that autonomous lookup always beats a prepared context.
[Anthropic, “Effective Context Engineering for AI Agents,” 2025-09-29](https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents).

An earlier first-party method prepends generated chunk context before embedding and lexical
indexing, then combines retrieval and reranking. **INFERENCE:** enriched search keys can help
find a source without promoting the generated explanation into original evidence.
[Anthropic, “Contextual Retrieval,” 2024-09-19](https://www.anthropic.com/engineering/contextual-retrieval).

### P4. Sleep-time compute

**AUTHOR-MEASURED:** pre-query computation over known context is evaluated on stateful
reasoning tasks, shifting effort from query time and amortizing preparation across questions.
**INFERENCE:** background reflection or indexing is not free. Its benefit depends on the
number and predictability of later queries, write volume, and how quickly preparation becomes
stale. A user-facing latency reduction may coexist with more total work.
[Lin et al., “Sleep-time Compute,” 2025-04-17, v1](https://arxiv.org/html/2504.13171v1).

### P5. ACE: evolving a playbook

**IMPLEMENTATION-DESCRIBED / AUTHOR-MEASURED:** a generator, reflector, and curator produce
itemized context deltas; deterministic merging and refinement address loss from repeated
monolithic rewrites. Evaluation includes agent tasks and specialized reasoning, rather than
an autobiographical memory guarantee.

**INFERENCE:** localized updates can make lessons easier to inspect than whole-document
rewrites. Generated lessons still need valid feedback, source scope, and a way to correct
misleading generalizations; successful task learning does not establish faithful history.
[Zhang et al., ACE, 2025-10-06, v1, §§3–4](https://arxiv.org/html/2510.04618v1).

### P6. AgeMem: learning the memory policy

**IMPLEMENTATION-DESCRIBED / AUTHOR-MEASURED:** three-stage reinforcement learning teaches
long-term storage, short-term context management, and their combined use through memory tools.
The study evaluates five benchmarks with trained models. Its tools include update/delete
operations as well as retrieval and summarization.

**INFERENCE:** weak recall may be a policy-learning problem as well as an indexing problem.
These gains cannot be attributed to adding the same tools to an arbitrary untrained hosted
model. Destructive memory actions also need separation from an immutable evidence store.
[Yu et al., AgeMem, 2026-01-05, v1, §§3–4](https://arxiv.org/html/2601.01885v1).

## 6. Recent counterevidence and verification research

These 2026 papers are useful challenges to assumptions. They are author-reported experiments;
very recent preprints receive no extra authority merely for being recent.

### N1. Phase-aware cost and benchmark configuration

**AUTHOR-MEASURED:** a ten-system characterization separates memory construction, retrieval,
and generation, finding sensitivity to model configuration and scheduling. Its MAB
`LongMemEval_S_*` workload uses five approximately 360k-token samples with 300 queries in
total. That is not the canonical LongMemEval S setup in B1. The authors acknowledge limits to
perfectly matched system comparisons.

**INFERENCE:** production budgeting needs write/read ratios, freshness delay, and model
capability floors as well as answer-time tokens. A shared benchmark name does not remove
configuration confounds.
[Omri et al., “Agent Memory: Characterization and System Implications of Stateful Long-Horizon
Workloads,” 2026-06-04, v1](https://arxiv.org/html/2606.06448v1).

### N2. Graph structure can lose precisely the remembered utterance

**AUTHOR-MEASURED:** a graph pipeline scores token F1 .417 versus a flat-vector baseline's
.468 on 500 LongMemEval questions; paired difference −.050, 95% CI [−.085, −.016]. Prior
assistant-turn questions show a particularly large loss. This matches retrieval-root budget,
not necessarily final context-token budget, and uses one small model for extraction, answering,
and judging. It does not disprove graphs generally.

A separate one-pass pruning experiment removes 9.8% of nodes. Near-unchanged aggregate F1
does not prove lossless retention; judged correctness declines and its interval permits loss.
**INFERENCE:** optimizing a benchmark average cannot justify destroying unique historical
content. [Rusu et al., “Selective Forgetting,” 2026-08-29, v1,
§§4–5 and appendices](https://arxiv.org/html/2608.28978v1).

### N3. Verification during curation, rather than only at answer time

**AUTHOR-MEASURED:** read-only environment probes augment post-task memory curation while
keeping task-time interfaces constant. In a 40-question GPT-5.4 schema-drift schedule,
five paired runs report 39±4% pass without memory, 70±16% with memory, and 73±5% with probing
(95% confidence intervals). The probing increment is **70 to 73**, not 39 to 73. Table 1's
task-agent costs exclude distillation/curation, so they are not whole-system savings.

**INFERENCE:** this supplies an alternative location for verification. It does not establish
a significant universal improvement from probes, validate interpersonal-history verification,
or justify fresh live checks before every message. Scope-specific verification and its own
cost deserve experiments. This preprint is only two days old at access.
[Suresh et al., “Grounding Agent Memory,” 2026-09-10, v1,
§§3–5, Table 1](https://arxiv.org/html/2609.11060v1).

### N4. Memory can invent authority without an external attack

**AUTHOR-MEASURED:** synthetic permission, restriction, and revocation workflows test memory
writers and executing agents. The study identifies cases where memory transforms an earlier
statement into false authorization, which a later actor accepts. Evidence/authority controls
reduce unsafe actions but can increase legitimate refusals.

**INFERENCE:** remembering a statement and being authorized by it are independent properties.
A recall benchmark that rewards completing the action can conceal an authority error.
This new preprint is evidence to reproduce, not a production incident rate.
[Cerruti et al., “Agent Memory Is a Surface for Endogenous Authorization Laundering,”
2026-09-01, v1](https://arxiv.org/html/2609.01836v1).

## 7. What this evidence does and does not say about the working hypothesis

This section records questions for R4. It does not choose a recall contract, a retriever
portfolio, sentinel powers, or an implementation.

| Hypothesis fragment | Evidence in favor | Counterevidence / unresolved test |
|---|---|---|
| Context assembly needs structural coverage | S1 and P1 make retrieval part of execution, not just storage; B5 tests use | “Attempted retrieval” can still deliver no useful evidence. Does coverage improve behavior under realistic budgets? |
| Several retrieval methods help | S5–S8 address different query structures | S4, B4, and N2 resist a universal graph winner. Does a portfolio beat raw/lexical controls at matched total cost? |
| Cross-conversation indexing is necessary | B1/B2 require information outside recent context | None establishes all four channel/party cases. Which identity, audience, and source distinctions survive indexing? |
| Recursive exploration should handle hard cases | S1/P1/P3 support agent-controlled deeper lookup | S7's recursive tree is a different mechanism. When is extra lookup worth delay, and when does it chase noise? |
| Reflection improves memory | S2/S11/P5 support derived interpretation or lessons | Feedback and extraction can be wrong. Does it improve later behavior without overwriting the supporting episode? |
| Verify before every judgment and message | Historical checking could catch a contradicted draft | No inspected system establishes this universal dispatch claim. N3 studies background verification instead. Two serial checks may duplicate work. |
| A recorded manifest closes the gap | Inspectable inputs help investigate failures | Auditability cannot prove the evidence was sufficient or used correctly. What observation separates retrieval from reasoning failure? |
| Memory misses can be measured | B1–B6 offer complementary outcome families | A volunteered correction captures only noticed misses; silence and unreported repetition remain outside that count. |

The universal live-review fragment additionally faces **existing local contrary evidence**:
`docs/01-the-rules.md:36` records failures of reviewing every outgoing message, while
`docs/18-sentinel-holders/01-ownership-and-boundaries.md:27` bounds sentinel authority.
This is an architectural constraint to resolve in R4, not a reason to pretend historical
verification is useless. The tested question is where, when, and with what consequence it helps.

## 8. Research controls needed before making a beyond-human claim

The following are **INFERENCES / candidate evaluation controls**, not a Part Twenty-One
measurement schema or approved test plan:

- **Preserve simple controls:** recent history, generous full history when feasible, exact
  lookup, lexical retrieval, dense retrieval, and an oracle that supplies the true evidence.
  Compare the same reader, source population, permissions, and budget. An oracle reader that
  still fails identifies a reasoning/use problem that another index will not automatically fix.
- **Separate prompted recall from ordinary use:** ask a direct historical question, then test
  a matched situation where the agent must use the fact without a memory cue. Include its own
  past statement, a revised preference, a declined commitment, and knowledge obtained indirectly.
- **Keep failure populations visible:** ingest missing, retained but unindexed, index stale,
  query missed, candidate filtered, context truncated, model ignored, draft contradicted,
  verification timed out, and delivery absent are different causal possibilities. A timeout
  must not disappear from the denominator because it produced no answer to grade.
- **Match party and audience:** test two people with the same name, one person with verified
  identities on different surfaces, quoted third-party speech, agent hearsay, and a private
  fact relevant to a public discussion. Correct recall and correct disclosure can diverge.
- **Test time and corrections:** when an event happened, when it was learned, and what was
  believed at a past point need separate questions. Later ingestion is not necessarily a later
  real-world event. Repeated paraphrases are not independent corroboration.
- **Test retention beyond the index:** rebuild after removal of derived structures; recover
  after compaction/restart; reconstruct a corrected original statement. A retrieval benchmark's
  unchanged aggregate score is insufficient evidence that memory survived intact.
- **Evaluate abstention in both directions:** wrong confident recall harms trust; unnecessary
  “I don't know” after a recorded conversation also fails the person test. Include false
  interventions and avoidable delay when evaluating review mechanisms.
- **Charge the whole lifecycle:** preparation and reflection, failures and retries, embedding
  refresh, storage, model calls, and investigation. Report latency by actual path and tail;
  do not compare one paper's mean read latency with another's p95 total latency.
- **Audit measurement uncertainty:** identify synthetic versus real episodes, benchmark
  revisions, model snapshots, judge instructions, category counts, paired differences, and
  confidence intervals. Human review should examine both sampled successes and failures.

No inspected source establishes **beyond-human memory coherence across all four operator
settings**, nor a shared human baseline on that task. Such a claim requires a defined human
comparison, realistic access to records, time/cost limits, and longitudinal user outcomes.
Until then it is an operator goal, not a measured property of a particular architecture.

## 9. Open questions for the next round

### For Echo, the orchestrator

1. Which hypothesis fragments remain candidates after the local live-review failure evidence
   and the external counterexamples? Separate required accounting from compulsory semantic work.
2. What evidence set will permit a matched comparison of direct/history retrieval, enriched
   indexing, relational retrieval, and agent-controlled exploration without changing the reader?
3. Which benchmark categories map to the four actual incidents, and which need new cases for
   ordinary unprompted use, channel identity, source attribution, and audience restrictions?
4. How will R4 keep original utterances, derived current beliefs, and procedural lessons
   distinguishable while comparing mechanisms that rewrite, forget, or invalidate memory?
5. What is the exact Dawn evidence needed to test the missing pre-action comparison, and can
   her measured false holds, missed checks, latency, and successful revisions be recovered?
6. Which recent results warrant reproduction first? N2 and N3 offer directly competing
   hypotheses about extraction loss and the location of verification, but remain narrow studies.

### For Justin, the operator — recorded for orchestration, not asked during this round

1. What anonymized episodes and expected behavior represent each of the four failures,
   including cases where you expected spontaneous recall rather than an explicit answer?
2. What distinguishes useful cross-person recall from a disclosure you would regard as
   inappropriate? Which known channel identities may be treated as the same person?
3. What latency or extra cost is acceptable for ordinary conversation versus a consequential
   action, and which feels worse in each setting: a missed memory or an unnecessary hold?
4. Does the beyond-human goal prioritize exact episodic recall, consistent preferences,
   remembering commitments, associative insight, or all of these with separately measured bars?

These questions are handoff items. R2's missing Dawn source and R4's comparative synthesis
remain open; no design decision or operator answer has been invented to close them.

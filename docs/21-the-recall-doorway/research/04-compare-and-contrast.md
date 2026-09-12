# R4 — Comparing mechanisms for memory coherence

**Status: round-two comparative research and recommendation, 2026-09-12. Not a governed design.**

The strongest candidate is **retained original evidence + compulsory bounded retrieval before
principal drafting + faithful context accounting**, with **selective live review** tested as an
additional mechanism for consequential effects. That is an evidence-informed recommendation,
not a demonstrated probability or a claim of beyond-human performance. A graph, a memory
service, a successful search or a reviewer alone does not establish the user's person test.

## 1. Reading the matrices

The seven criteria are: **C** useful coherence from the user's view; **X** cross-conversation
recall with identity/attribution; **R** retrieval breadth; **V** historical pre-send verification;
**D** original-evidence durability; **A** auditable context-to-outcome lineage; **$** lifecycle
cost. Four settings are **T1** older material in the same long topic, **T2** another topic,
**E** email, **P** another user or agent. A document-QA or multi-session experiment is evidence
for a component, not direct evidence of an email/audience/identity implementation.

Every substantive cell is labeled:

| Label | What the cell can establish |
|---|---|
| S | Source code/configuration inspected in R1/R2; running use and outcome require separate evidence. |
| M | Our executed synthetic real-method fixture, under its stated substitutions. |
| A | Author-measured result in the linked external study; not reproduced here. |
| D | Primary author/documentation describes a mechanism; not an independent experiment. |
| I | Inference, possible application, limitation or research recommendation. |
| U | Not established by the inspected evidence; does not mean impossible or absent from every version. |

Rows compare the **cited configuration**, not all products sharing its name. R1/R2 define the
local source identities. R2 checks installed 1.x **1.3.1237** and records the dirty reading-aid
HEAD **5b36623a** separately. Dawn is private source **68e25e2e**, not a verified live build.
The full external evidence inventory, dates, methods and caveats is
[R3](03-external-research.md). Primary versions and row identifiers follow below. Key comparison
and benchmark sources were reopened on the network in round two on 2026-09-12; no external
benchmark or private conversation was run through an external provider in this round.

## 2. Local systems and required external approaches

| Approach / evidence | C: user coherence | X: cross-conversation | R: retrieval breadth | V: historical pre-send check |
|---|---|---|---|---|
| I1 [Installed 1.x / R1](01-instar-1x-memory.md), [R2 §8](02-dawn-grounding.md#8-comparison-with-the-installed-1x-target) | M: three assembly failures; U: incident rates | S: stores/search exist; I: automatic joins incomplete | S: lexical assembler; separate hybrid recall | S: identity/topic/tone checks; U: complete history check |
| D1 [Dawn / R2](02-dawn-grounding.md) | S: multiple delivered channels; U: lived outcome | S: scoped multi-chat/person/dual-stream paths | S: hybrid, graph, rerank, summary, recency, anchors, pins | S: scoped convergence and sender checks; U: universal historical verification |
| S1 [MemGPT](https://arxiv.org/html/2310.08560v2), v2 2024-02-12 | A: multi-session recall improvement | D: external conversation/archival memory | D: agent paging and search | U: dedicated dispatch-bound historical review |
| S2 [Generative Agents](https://arxiv.org/html/2304.03442v2), v2 2023-08-06 | A: simulated believability, not exact personal recall | D: accumulated agent observation stream | D: recency/importance/relevance, reflection | U: dispatch-bound historical review |
| S3 [A-MEM](https://arxiv.org/html/2502.12110v11), v11 2025-10-08 | A: dialogue QA | D: evolving linked notes | D: dense query retrieval; I: links alone do not prove traversal | U: dispatch-bound historical review |
| S4a [Mem0](https://arxiv.org/html/2504.19413v1), v1 2025-04-28 | A: QA gain over selected memory baselines | D: extracted/reconciled memories | D: similarity retrieval, CRUD policy | U: dispatch-bound historical review |
| S4b Mem0 graph, same paper | A: small gain over S4a at greater read cost | D: extracted entities/relations | D: relational plus base retrieval | U: dispatch-bound historical review |
| S5a [Zep paper](https://arxiv.org/html/2501.13956v1), v1 2025-01-20 | A: aggregate gain; assistant-statement regression | D: episodes/entities with validity/ingestion time | D: temporal graph, hybrid/rerank | U: dispatch-bound historical review |
| S5b [Graphiti OSS](https://github.com/getzep/graphiti), R3 access 2026-09-12 | U: this exact revision's person-test outcome | D: incremental episodes and grouping | D: semantic/BM25/graph/temporal | U: dispatch-bound historical review |
| S6a [HippoRAG](https://arxiv.org/html/2405.14831v1), v1 2024-05-23 | A: associative/multi-hop QA | D: shared document graph | D: dense entity seeds + PageRank | U: dispatch-bound historical review |
| S6b [HippoRAG 2](https://arxiv.org/html/2502.14802v2), v2 2025-06-19 | A: seven-dataset QA comparison | D: passage/entity association | D: passage integration, recognition, graph retrieval | U: dispatch-bound historical review |
| S7 [RAPTOR](https://arxiv.org/html/2401.18059v1), v1 2024-01-31 | A: long-document QA | D: shared text/summary tree | D: multi-level/flattened-tree retrieval | U: source verification before actual dispatch |
| S8 [GraphRAG](https://arxiv.org/html/2404.16130v1), v1 2024-04-24 | A: global sensemaking ratings | D: corpus-wide communities | D: graph/community summaries, map/reduce | U: dispatch-bound historical review |
| S9 [MemoryBank](https://arxiv.org/html/2305.10250v3), v3 2023-05-21 | A: simulated-user personalization | D: per-user histories/portraits | D: dense retrieval, strength/recency | U: dispatch-bound historical review |
| S10 [LongMem](https://arxiv.org/html/2306.07174v1), v1 2023-06-12 | A: model/task benchmarks | D: cached representations; U: person identity | D: learned latent retrieval | U: dispatch-bound historical review |
| S11 [Reflexion](https://arxiv.org/html/2303.11366v4), v4 2023-10-10 | A: repeated-task gains and regressions | D: prior-trial textual feedback | D: reflection/lesson reuse | D: task evaluator; U: historical send verification |

| Same approach | D: original durability | A: auditability | $: cost evidence / dominant costs |
|---|---|---|---|
| I1 1.x | S: recovery/history; I: expiry/archive paths need rule-7 changes | S: partial provenance; M: accurate prompt hash can coexist with skipped evidence | S: local lexical plus optional embeddings/models; U: whole lifecycle |
| D1 Dawn | S: database, draft preservation, mutation/deletion; U: lossless retention | S: IDs/metrics/access checks; I: wisdom severance limits lineage | S: separate model-heavy paths/budgets; U: total and tails |
| S1 MemGPT | D: external persistence; U: immutable original after edits | D: explicit tool operations; U: exact submitted manifest | I: paging turns, memory edits, reader tokens |
| S2 Generative Agents | D: observation stream; U: long-term deletion/recovery guarantees | D: reflection links; I: interpretation remains distinct | I: importance scoring, reflection and planning calls |
| S3 A-MEM | D: note replacement; U: original-version custody | D: contextual notes/links; U: complete input receipt | I: embedding and neighbor-evolution calls |
| S4a Mem0 | D: mutable extraction/CRUD; U: original custody | I: extraction omissions need raw evidence | A: reported read tradeoff; U: complete maintenance cost |
| S4b Mem0 graph | D: graph updates; U: lossless original history | D: relations; U: exact source/input receipt | A: higher latency/context than base in cited experiment |
| S5a Zep | D: episode and temporal representation; U: production rule-7 proof | D: source-linked graph; U: complete submitted context | A: latency/accuracy tradeoff; U: matched local lifecycle |
| S5b Graphiti | D: database plus deletion operations; U: append-only retention | D: episode linkage; U: full served-context lineage | D: ingestion/search machinery; U: reproduced deployment costs |
| S6a HippoRAG | D: passages plus derived graph; U: lifetime source guarantees | D: retrieved passages; I: extraction can lose attribution | I: graph construction, embedding, graph read, reader |
| S6b HippoRAG 2 | D: passages plus graph; U: conversation retention | D: passages/recognition; U: final effect receipt | A: controlled reader comparison; I: count recognition/build work |
| S7 RAPTOR | D: leaves and summaries; U: dynamic refresh/retention contract | D: tree navigation; I: final leaf check still needed | I: recursive construction, refresh, query and reader |
| S8 GraphRAG | D: corpus index; U: original lifecycle preservation | D: source/community artifacts; I: broad synthesis needs attribution | I: extraction, community summaries, map/reduce |
| S9 MemoryBank | D: forgetting/strength policy; U: unique-source survival | D: portraits/summaries; I: inferred trait provenance needed | I: summaries, portrait updates, retrieval |
| S10 LongMem | D: key/value cache; U: durable historical reconstruction | I: latent representations are difficult to map to original text | D: trained architecture; I: training plus inference, not drop-in API cost |
| S11 Reflexion | D: trial notes; U: complete trial archive | D: feedback trace; I: incorrect tests can teach false lessons | A: multi-attempt experiments; I: charge evaluation/reflection too |

### Four settings, same rows

These cells ask about the operator's concrete environments. **I: adaptable** means a plausible
component after ingestion, identity and audience handling are added; it is not a tested integration.

| Approach | T1: same long topic | T2: other topic | E: email | P: another user/agent |
|---|---|---|---|---|
| I1 1.x | M: summary/renderer/strategy defects; S: history retained | S: explicit search, incomplete automatic assembly | U: universal ingestion/recall path | S: separate relationship/agent stores; U: ordinary automatic use |
| D1 Dawn | S: several recall channels; U: incident outcome | S: multi-chat/person lookup; U: universal application | S: grounded preparation; U: full custody-to-use | S: scoped personal/dual-stream/wisdom; U: safe general transfer |
| S1 MemGPT | A: related long/multi-session retrieval | A: multi-session memory task, not topic adapter | I: archival tools adaptable; U: email trace | U: verified multi-party audience handling |
| S2 Generative Agents | A: simulated stream behavior | I: persistent stream spans encounters | U: email behavior | A: simulated agent encounters; U: real private disclosure |
| S3 A-MEM | A: long-dialogue QA | A: multi-session corpus QA | I: note indexing adaptable; U: ingestion | U: speaker/permission-safe cross-party use |
| S4a Mem0 | A: conversation QA | A: multi-session corpus QA | I: extracted email notes possible; U: original completeness | U: full audience/authority semantics |
| S4b Mem0 graph | A: conversation QA | A: multi-session corpus QA | I: relational indexing adaptable | U: multi-party safety for this variant |
| S5a Zep | A: long-history QA with category loss | A: cross-session reasoning | I: temporal episodes adaptable; U: email lifecycle | U: full audience-safe transfer |
| S5b Graphiti | D: episode mechanism; U: exact workload result | D: shared temporal graph | I: structured email ingestion adaptable | D: grouping; U: verified identity/disclosure |
| S6a HippoRAG | I: conversation passages adaptable | I: shared graph may link topics | I: document passages adaptable | U: speaker/authority distinctions after extraction |
| S6b HippoRAG 2 | I: passage retrieval adaptable | I: graph associations can bridge topics | I: passage retrieval adaptable | U: safe person-level transfer |
| S7 RAPTOR | I: long-history tree adaptable | I: shared hierarchy can locate episodes | I: long-thread tree adaptable | U: audience-restricted summary construction |
| S8 GraphRAG | I: broad synthesis, weak evidence for exact-turn recall | A: corpus-wide synthesis, not user topic behavior | I: mailbox synthesis adaptable | U: mixed-audience summary disclosure |
| S9 MemoryBank | A: simulated personalization | D: user histories across sessions | U: complete email behavior | U: safe shared/private knowledge transfer |
| S10 LongMem | A: long-context model tasks, not this topic UI | U: durable topic joins | U: email custody/use | U: person/agent attribution |
| S11 Reflexion | I: prior lessons can alter behavior | I: transferable task lessons | I: email procedure learning, not episode recall | U: reliable private historical transfer |

## 3. Cognitive architectures and context-engineering approaches

These are additional mechanisms evaluated in R3, not omitted competitors. Entries C1/C2 are
cognitive architectures, P1–P6 are practices/systems, N2–N4 are counterevidence/control methods.
They are not interchangeable standalone memory products. A U cell is preferable to scoring
them on capabilities their cited experiment did not investigate.

| Approach / primary evidence | C | X | R | V |
|---|---|---|---|---|
| C1 [ACT-R](https://link.springer.com/article/10.1007/s42113-023-00189-y), 2023-12-28 | D: cognitive model; U: LLM person test | D: cue-based declarative chunks | D: activation/context cues | U: external-send implementation |
| C2 [Soar manual](https://soar.eecs.umich.edu/soar_manual/07_EpisodicMemory/), R3 access 2026-09-12 | D: cognitive architecture; U: LLM person test | D: semantic/episodic access | D: cues, time, procedural chunking | U: external-send implementation |
| P1 [Letta files/tools experiment](https://www.letta.com/blog/benchmarking-ai-agent-memory/), 2025-08-12 | A: LoCoMo vendor experiment | D: external files/search | D: semantic/filesystem tools, initial-search rule | U: historical send review |
| P2 [Letta context repositories](https://www.letta.com/blog/context-repositories/), 2026-02-12 | U: longitudinal person-test outcome | D: versioned context repository | D: filesystem/background memory work | U: historical send review |
| P3a [Just-in-time context](https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents), 2025-09-29 | D: engineering guidance | D: pointers to external material | D: selective preload, on-demand tools | U: dispatch-bound review |
| P3b [Contextual Retrieval](https://www.anthropic.com/engineering/contextual-retrieval), 2024-09-19 | A: retrieval experiments | D: shared indexed corpus | D: enriched keys, dense/BM25/rerank | U: historical send review |
| P4 [Sleep-time compute](https://arxiv.org/html/2504.13171v1), 2025-04-17 | A: stateful reasoning experiments | D: prepared context | D: pre-query computation | U: consequential-send review |
| P5 [ACE](https://arxiv.org/html/2510.04618v1), 2025-10-06 | A: agent/specialized reasoning tasks | D: evolving playbook | D: generator/reflector/curator | D: feedback curation; U: historical send review |
| P6 [AgeMem](https://arxiv.org/html/2601.01885v1), 2026-01-05 | A: trained-policy benchmark results | D: long/short-term tools | D: learned storage/retrieval/context policy | U: historical send review |
| N2 [Selective Forgetting](https://arxiv.org/html/2608.28978v1), 2026-08-29 | A: graph loses to vector on one setup | A: LongMemEval-derived evaluation | D: extraction/graph and pruning | U: send review |
| N3 [Environment-probing curation](https://arxiv.org/html/2609.11060v1), 2026-09-10 | A: narrow enterprise task experiments | D: retained post-task lessons | D: probes during curation | D: background verification, not every-send review |
| N4 [Authority-laundering study](https://arxiv.org/html/2609.01836v1), 2026-09-01 | A: synthetic authority errors | A: memory influences later actor | D: evidence/authority controls | A: unsafe actions reduced with refusal tradeoffs |

| Same approach | D | A | $ |
|---|---|---|---|
| C1 ACT-R | U: product retention | D: explicit declarative/procedural distinction | U: LLM deployment budget |
| C2 Soar | D: distinct memory systems; U: rule-7 contract | D: episode/procedure distinction | U: LLM deployment budget |
| P1 Letta files/tools | D: files; U: immutable custody | D: readable artifacts/tool history | I: tool policy and extra turns matter |
| P2 Context repositories | D: Git versioning; U: immutable retention | D: inspectable edits | I: background work plus reads; U: total |
| P3a Just-in-time | D: notes/pointers; U: source permanence | I: need actual read receipts | I: exploration latency versus preload cost |
| P3b Contextual Retrieval | D: source chunks plus generated context | I: keep generated keys distinct from originals | I: construction, embeddings, reranking |
| P4 Sleep-time compute | U: full history custody | I: derived preparation needs provenance | A: cost shifted/amortized; I: charge writes and refresh |
| P5 ACE | D: itemized deltas; U: original episode archive | D: localized playbook changes | I: generation/reflection/curation lifecycle |
| P6 AgeMem | D: update/delete tools; U: source preservation | D: tool trajectories; U: immutable input lineage | I: training plus inference; gains not free with untrained policy |
| N2 Selective Forgetting | D: node pruning; I: aggregate QA cannot prove lossless retention | I: extraction and pruning require source trace | A: narrow comparison; U: lifetime cost |
| N3 Probing curation | D: post-task memory; U: episode archive | D: probe evidence; U: universal conversation trace | A: reported task cost excludes some curation work |
| N4 Authority controls | U: general original-retention contract | D: separate evidence from authority | A: refusal tradeoff; U: product lifecycle cost |

| Same approach | T1 | T2 | E | P |
|---|---|---|---|---|
| C1 ACT-R | I: cue/activation heuristic | I: context-linked chunks | U: integration | U: disclosure implementation |
| C2 Soar | I: episodic-time access | I: semantic and episode cues | U: integration | U: disclosure implementation |
| P1 Letta files/tools | A: long-dialogue experiment | A: multi-session corpus | I: files adaptable | U: multi-party permission test |
| P2 Context repositories | I: retained notes help | I: repository spans sessions | I: import required | U: authorized sharing correctness |
| P3a Just-in-time | I: fetch older evidence | I: follow external pointers | I: connector capture required | U: disclosure policy |
| P3b Contextual Retrieval | I: enriched conversation keys | I: shared indexing | I: body/attachment ingestion needed | U: cross-party authorization |
| P4 Sleep-time compute | I: precompute history context | I: shared preparation | I: mailbox preparation candidate | U: private mixed-source preparation |
| P5 ACE | I: remember procedures | I: transfer lessons | I: workflow lessons, not full episodes | U: safe personal-to-shared learning |
| P6 AgeMem | A: memory-task results; U: this topic | I: trained policy can query shared store | U: deployment | U: deployment |
| N2 Selective Forgetting | A: historical QA extraction loss | A: multi-session evaluation | I: warns against extracted-only email record | U: safe sharing |
| N3 Probing curation | I: verified lessons can help | I: task transfer | I: environment facts, not interpersonal history | U: safe shared/private lessons |
| N4 Authority controls | A: synthetic remembered permission | I: revocation can cross topics | I: action authorization must remain independent | A: later-actor contamination; U: real disclosure rates |

Benchmarks themselves are evaluation instruments, not additional memory implementations.
[LongMemEval](https://arxiv.org/html/2410.10813v2) (2025-03-04 v2) contributes extraction,
time, updates and abstention; [LoCoMo](https://arxiv.org/abs/2402.17753) (2024-02-27) contributes
long-dialogue/multi-hop structure; [MemBench](https://arxiv.org/html/2506.21605v1) (2025-06-20)
contributes observed versus participated and factual versus reflective memory;
[GroupMemBench](https://arxiv.org/html/2605.14498v1) (2026-05-14) contributes speaker/asker
distinctions; [PM-Bench](https://arxiv.org/html/2607.12385v1) (2026-07-14) contributes intentions,
cues and false activations; [MemoryArena](https://arxiv.org/html/2602.16313v1) (2026-02-18)
contributes memory-dependent action. **D/A** for their protocols/results; **I** for transfer to
our four settings. R5 defines adapted scenarios, not purported official benchmark scores.

Two further R3 sources guide measurement without adding a retrieval architecture:
**A:** Letta's [ContextBench V2 account](https://www.letta.com/blog/evaluating-memory-in-production-agents/)
(2026-07-28) reports behavior-oriented evaluation on private data; independent reproduction
is limited. **A:** the [phase-aware systems characterization](https://arxiv.org/html/2606.06448v1)
(2026-06-04) separates construction, retrieval and generation and documents configuration
sensitivity. **I:** use those dimensions, not their system rankings, for our matched protocol.
Hindsight's appearance in GroupMemBench is a reported comparator result, not an architecture
audited in R3; its additional mechanisms remain **U** in this comparison.

## 4. Mechanisms to combine, and why

**I: highest expected value, conditional on evaluation**, in this order:

1. **Capture the original experience and make it searchable.** Keep complete exchanges,
   speaker/audience/channel/time/source identity, qualifications and corrections. Index
   originals as well as extracted keys. R1's checkpoint failure and R2's formation gates show
   how derived memory can miss content before retrieval begins. Rule 7 supplies a retention
   constraint, not a retrieval implementation.
2. **Require a bounded attempt before principal drafting.** Exact recent/pending/person/time
   lookups plus lexical and dense evidence search are the initial portfolio. This targets
   missing connections in 1.x and the successful *structural form* of Dawn's real context
   builder. It does not copy Dawn's shadow service or assume every turn needs another LLM.
3. **Use derived structures to find originals.** Enriched keys, episode/relationship anchors,
   temporal edges and optional bounded graph/tree/iterative exploration can solve different
   cues. Preserve original episodes, inferred beliefs and procedural lessons as distinguishable
   outputs. Raw leaves are available for precise claims and corrections.
4. **Prove delivered context, then measure use.** Account for candidate exclusion, source
   outages, truncation, rendered spans and actual submitted input. An accurate receipt can
   document a bad selection, as the installed summary provenance illustrates. Score the
   answer/effect against the evidence, including correct-evidence-but-unused controls.
5. **Spend live review selectively.** Deterministic final-content/audience checks first;
   bounded historical review for consequential effects or a specific risk signal. Keep ordinary
   chat reachable when semantic review is unavailable. Review patterns in retrospect and
   improve ingestion/retrieval at the originating failure, not only at the next draft.

**A, not a universal leaderboard:** Mem0's cited experiment gives full history a higher answer
score than either compressed variant, at greater read cost. Zep improves its aggregate while
losing assistant-statement accuracy. GroupMemBench keeps BM25 competitive and uses different
models/tasks from those papers. N2 shows one graph extraction pipeline losing to flat vectors.
Those results justify simple and original-evidence controls; their numbers cannot be pooled
into a comparative system ranking. [Mem0](https://arxiv.org/html/2504.19413v1),
[Zep](https://arxiv.org/html/2501.13956v1), [GroupMemBench](https://arxiv.org/html/2605.14498v1),
[N2](https://arxiv.org/html/2608.28978v1).

**A/I:** LongMemEval distinguishes value, key, query and reading strategy; enriching keys is
different from replacing returned episodes with extracted facts. That supports testing enriched
indexes while retaining original passages, and separately measuring reader errors.
[LongMemEval §5](https://arxiv.org/html/2410.10813v2).

## 5. Conflicts that a combined system must resolve

| Conflict | Evidence | Proposed research resolution — I |
|---|---|---|
| Rich summaries versus exact episodes | S: Dawn consolidation; A: extraction/category regressions in R3 | Preserve episodes; derive searchable keys and beliefs without overwriting originals. |
| Recency/significance versus rare old facts | S: both assemblers' budgets/decay; D: Generative Agents/MemoryBank | Reserve exact lookup and episode retrieval; test single old mention, low-scored critical constraint and superseded anchor. |
| Cross-topic utility versus private audience | S: Dawn user-filter repair; R1 scoped/unscoped paths | Resolve identity explicitly and enforce scope before candidate exposure, expansion, cache reuse and final disclosure. |
| Shared lessons versus private provenance | S: Dawn wisdom severs links | Keep access-controlled derivation provenance where authorized; expose only approved lesson. If impossible under consent, record provenance limitation rather than invent a link. |
| Natural continuity versus false first-person memory | S: Dawn prompt framing; D: cognitive episode/procedure distinctions | Type direct/indirect/inferred evidence; grade speaker attribution and spontaneous use independently of warm tone. |
| More retrieval versus relevant evidence displacement | S: budgets and graph merges; A: R3 controls | Match final tokens, then test marginal retriever contribution and candidate exclusions. |
| Cache savings versus source/permission freshness | S: both recall-cache omissions | Bind cached content to source and permission frontier, audience and task; revalidate exact scoped reads. |
| Review protection versus latency/silence | R: rulebook; S: Dawn model-dependent compose blocking | Universal accounting is separate; review only within a bounded consequential/risk policy with explicit failure directions. |
| Derived permission versus actual authorization | A: authority-laundering study | Recall may supply evidence; governing authorization remains with the existing owner. A remembered approval does not mint current standing. |
| Independent verification versus shared-model error | D: Reflexion/evaluators; A: N3/N4 | Reviewer gets independent evidence access where budgeted; same-source agreement is not corroboration. Compare no-review and corrupted-evidence controls. |

## 6. Resolve the rulebook and the recursion hypothesis

**S/R:** `docs/01-the-rules.md:36` records the 1.x trap: live review on every message adds
cost and delay, judges without enough history and can fail closed into silence. It calls for
retrospective pattern judgment and live scrutiny at irreversible moments. That is direct
contrary evidence to the brief's original universal live-review reading, not an incidental caveat.

**I:** accounting is non-recursive bookkeeping, though custody/I/O still cost resources.
Retrieval before drafting is a separate bounded evidence-read operation. Neither logically
requires an additional semantic reviewer. For R5, a **principal judgment** is a user-facing
reply or decision causing an external effect; it is a research classification, not a new
constitutional Principal type. Internal recall/summarization/review calls are subordinate
work, excluded from recall dispatch, but remain metered and traceable under their parent.
They lack sender/effect authority. An internal label must not conceal an actual external action.

**I:** one root recall attempt can serve drafting and the unchanged final effect. At send,
validate binding/freshness and apply the selective review policy; do not automatically run a
second complete recall pipeline. A changed recipient, consequential claim, relevant evidence
frontier or expired receipt invalidates reuse. Refresh/revision must fit the same total budget.

The user-authorized round-two hypothesis permits a deterministic risk trigger as an additional
review selector. **I:** a positive credential/authority/audience violation belongs to existing
deterministic refusal rules. A vague semantic risk flag on ordinary chat should not become
an indefinite blocking reviewer. R5 proposes bounded advisory treatment there; any extension
of *blocking semantic* review beyond irreversible effects requires explicit owner reconciliation
with the rulebook before design approval. Research permission is not a rule amendment.

## 7. Implementation seams checked against current main

Main was fetched on 2026-09-12. Inspected tip:
**`dd38f07ae4e12e04373ffde7fdf006b08381cf15`**. These citations refer to that commit's
`src/` bytes, read with `git show`, not this research branch's older source files. No merge,
rebase or dirty-file reconciliation was performed. Landed source does not imply live activation.
Part numbering in owner exports differs from some document/brief titles; paths are authoritative.

| Seam | What is actually in main — S | What must remain pending |
|---|---|---|
| SessionGrounding | `src/rungraph/types.ts:70`, `records.ts:140`, `graph.ts:98`: full captured messages, source frontier and separate consumption; validation before starts/resumes. | README `src/rungraph/README.md:53`: above-threshold history refuses; summary accounting absent; single lineage. Automatic broad recall is not supplied. |
| Run closure / ContinuityAccounting | Closure implementation landed. `src/rungraph/closure-records.ts:405` explicitly rejects ContinuityAccounting and unsupported continuity fields in this slice. | ContinuityAccounting is **designed-not-landed** here. Closure landing cannot be used to claim the full continuity proposal is implemented. |
| Judgment input accounting | `src/judgment/contracts.ts:12` captures question/context/submitted input and budgets. | Universal recall producer and full requested manifest semantics are not supplied by these capture fields. |
| contextManifest carrier | `src/assembly/contracts.ts:33` has HarnessLaunchSpec contextManifest with references/digests and consumption mode; `src/assembly/harness.ts:20` consumes digests. | Planned operator-surface consumers are **designed-not-landed** at this snapshot; do not say contextManifest is wholly absent or fully operational everywhere. |
| Part 13 A1 harness adapters | `src/harness-adapters/README.md:3`: decoders, attempt/observation admission and progress identity. | Holder lifecycle/custody/progress completion remain A2 (`:8`). |
| Loop-breaker A1 | `src/transport/loop-a1/index.ts:1` exports additive authority/records and rejects unsupported extensions. | Recall recursion prevention is not automatically implemented by that transport API. |
| Part 16 A1 measurement | `src/measurement/README.md:3`, `operations.ts:70`: record/producer/category-value admission. | A2 burn evaluation, attribution, history and production seams deferred. Export analyzer and recall metrics are **designed-not-landed**. |
| Part 15 A scheduled work | `src/scheduled/index.ts:1`, `package.ts:1`, `contracts.ts:1`: scheduled-work package present. | Its existence does not wire a memory indexing, curation or miss-review job. Those integrations remain proposed. |
| Part 11 operator surfaces | The user reports final review underway. **U:** landing after the fetched tip. | **Designed-not-landed** until owner source appears on main. Re-fetch before implementation. |

Part 16 conversation identity in the original brief must likewise be treated by its specific
owner contract rather than by coincident numbering with today's measurement slice. Durable
conversation bindings do not automatically identify all people across channels or authorize
cross-person disclosure. R1's identity qualification remains applicable.

## 8. Remaining uncertainty and recommendation

**U:** the four production incidents; Dawn's deployed configuration and effective traces;
per-recipient sharing expectations; tolerated delay/cost; the human comparison population;
and marginal gains from each retrieval/review strategy at matched lifecycle budget.
Neither a benchmark aggregate nor a source-level mechanism settles those questions.

**I recommendation:** retain universal accounting; evaluate bounded principal retrieval as
the primary coherence intervention; evaluate selective review only as its incremental layer.
Start with exact/raw/lexical+dense controls, then add temporal/relationship context, anchors,
graphs/trees and deeper exploration only when ablation demonstrates useful incremental recall.
Test background formation checks separately from live review. R5 supplies the decision protocol,
including missing evidence, false holds and correct evidence ignored by the reader.

For Echo: confirm owner-seam timing, approve research budget bands for experiments, and obtain
sanitized traces plus deployment flags. For Justin through Echo: supply the four episodes,
expected behavior, privacy boundaries, and latency/error priorities. Those are handoff questions;
the comparison remains usable without inventing answers or drafting the part design.

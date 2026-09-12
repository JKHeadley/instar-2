# R2 — Dawn's actual memory and grounding paths

**Round two, 2026-09-12. Source-grounded research; not the Part Twenty-One design.**

Dawn has substantial historical retrieval, person-scoped preparation, public-post guards,
and memory maintenance. They are different pipelines. The component named pre-reply recall
summarizes its supplied trigger; its inspected Portal caller discards the result in shadow mode.
The useful migration lessons come primarily from the separate Portal context builder,
relationship grounding, output-access checks, and checks inside the actual posting scripts.
Beyond-human coherence and universal historical draft review remain unproved.

## 1. Evidence identity and privacy

**SOURCE (S)** means inspected implementation/configuration, not production execution.
**REPORTED (R)** means a comment, incident account or instruction describes an observation
whose trace was not inspected. **INFERENCE (I)** means this report's conditional interpretation.
**UNKNOWN (U)** means runtime, configuration or outcome evidence is missing.
Skills below were read as workflow evidence, not adopted as instructions for this session.

Dawn file:line citations are relative to the private, read-only mirror
`/Users/dabombstudio/.instar/dawn-src/repo/the-portal`. Its identity is filtered archive
`SageMindAI/the-portal` at `68e25e2ee9903c5170b55d00f055f41514f39d7a`, 2026-09-12.
The manifest is `/Users/dabombstudio/.instar/dawn-src/MANIFEST.md`. Runtime conversations,
credentials, databases, telemetry and uncommitted changes were excluded. Absence from this
mirror does not establish absence from Dawn's deployed environment. The commit is a source
identity, not a deployed build identity. No private source or personal conversation is copied
into this report. The Jamie case is discussed only at mechanism level. Its runtime traces
and conversation history remain **U**; the pending inquiry is held by Echo.

The **1.x migration target** is the installed package at
`/Users/dabombstudio/.instar/agents/echo/.instar/shadow-install/node_modules/instar`, version
**1.3.1237**, plus `.instar/hooks/instar/` under the agent home. `I:` below prefixes paths
relative to that package; `H:` prefixes installed hooks relative to the agent home.
The reading-aid checkout remains `5b36623a99327e74abe5ef04d63019f9aca6b1c5`, with the dirty
working files recorded in R1. They were not reconciled. R1 remains a working-source audit;
section 8 pins the targeted installed paths rechecked this round.

## 2. What Dawn stores

### 2.1 Exchanges, extracted memories and consolidation

**S:** relationship grounding reads actual chat/message rows ordered by time, separately
from memory-pool results (`.claude/scripts/relationship-grounding.ts:405`, `:428`, `:454`).
`PortalMemory` stores content, tenant, optional source conversation/message references,
timestamps, themes, significance, access counters, vector-index status, edges, review flags
and supersession (`prisma/schema.prisma:1003`). Source pointers aid tracing; complete exchange
retention after every mutation/deletion is **U**. Portal chat tables do not establish raw
email custody or complete attachment ingestion.

**S:** formation accepts a reflection, checks consent for a resolved user conversation,
scores significance and checks duplication before creating the memory
(`lib/portal/memory/formation.ts:82`, `:107`, `:165`, `:251`, `:330`). The nominal significance
threshold is 0.3 (`:57`); a preapproved restoration path can override ordinary omission logic.
Embedding precedes row creation (`:320`). New rows begin as drafts, with optional originating
conversation/message references. **I:** a low-significance decision can omit a derived memory
whose future relevance was unknown; an embedding failure can interrupt formation before the
row exists. Neither conclusion diagnoses a particular private episode.

**S:** consolidation invokes a model with related memories and identity/synthesis context,
then replaces served content while keeping the preceding draft as `originalContent`
(`lib/portal/memory/consolidation.ts:407`, `:442`). That preserves one prior draft, not every
historical version or necessarily the original utterance. Administrative update and deletion
exist, including removal from the primary database and vector index
(`lib/portal/memory/storage.ts:46`, `:102`). Persistence is weaker than 2.0 rule-7 retention.

### 2.2 Beliefs, relationships, pins and lessons

**S:** formation creates similarity/contradiction edges; contradiction may raise significance
and challenge old confidence while retaining both memories
(`lib/portal/memory/formation.ts:381`, `:428`, `:447`, `:468`). Confidence has explicit
reinforcement/challenge operations and history (`lib/portal/memory/beliefEvolution.ts:38`,
`:93`, `:175`). **I:** similarity is not independent corroboration; paraphrases can otherwise
reinforce the same unsupported claim. Current truth, historical belief and importance differ.

**S:** the witness subsystem maintains per-person relationship state, interactions, recent
threads, associated memories and synthesis (`lib/portal/memory/witness.ts:85`, `:228`, `:381`,
`:465`, `:623`, `:1011`). Local people-registry/relationship-quality files are another source.
Their assembler adapter explicitly defers direct witness-database integration
(`dawn-server/src/memory/sources/relationships-source.ts:2`). These are distinct paths.

**S:** user-chosen pins have a separate table outside significance, consolidation and
supersession (`prisma/schema.prisma:1073`; additive migration
`prisma/migrations/20260714_portal_pinned_memory/migration.sql:1`). Serving always scopes the
query by tenant and user and attempts injection even at minimal context budget
(`lib/portal/context.ts:852`). Errors degrade instead of breaking the turn. Historical schema
and serving comments describe different capacities, so this report does not infer a live pin
limit from them. Pins should not become the user's obligation to flag every important fact.

**S:** personal/wisdom/ops tiers distinguish relationship material, transferable learning and
infrastructure (`prisma/schema.prisma:1045`; `prisma/migrations/20260715_memory_tier/migration.sql:1`).
Optional wisdom distillation follows successful high-significance consolidation. Failure
leaves consolidation intact and creates no shared row. The successful path deliberately
severs the source link (`lib/portal/memory/consolidation.ts:456`). **I:** audience privacy and
auditability conflict if severance also removes authorized private provenance. A 2.0 adaptation
must resolve that explicitly instead of treating an anonymized lesson as original evidence.

**S:** `.claude/agent-memory/` contains specialist procedural lessons and indexes. For example,
the ground-truth auditor requires checking a shipped-status claim against implementation and
caller (`.claude/agent-memory/ground-truth-auditor/feedback_prop_status_shipped_is_a_claim_to_verify_in_source.md:26`).
`.claude/grounding/` contains identity, project facts and job preparation. These sources carry
lessons and working orientation; their presence does not demonstrate interpersonal recall.

## 3. What reaches drafting

### 3.1 The real Portal retrieval path

**S:** `lib/ai/UnifiedChatHandler.ts:268` calls `buildPortalContextWithMetaCognition`, which
invokes the ordinary Portal context builder (`lib/portal/context.ts:1325`) before generation.
That real path is separate from the named shadow recall service.

1. **S:** enrich the query with recent conversation context and embed it
   (`lib/portal/memory/retrieval.ts:515`).
2. **S:** dense Pinecone and Postgres full-text retrieval run in parallel, combine ranks and
   hydrate database records (`lib/portal/memory/hybridRetrieval.ts:212`, `:255`). Full-text
   availability depends on the database feature/migration; dense-only fallback is explicit.
3. **S:** an optional second query uses the working summary, with the same scope and rank
   fusion (`lib/portal/memory/retrieval.ts:544`). This addresses a useful failure class: the
   latest wording can concern forgetting itself rather than the underlying subject.
4. **S:** Cohere reranks when configured; failure uses hybrid ordering (`:608`).
5. **S:** optional intent classification and graph expansion add related/multi-hop candidates;
   hydrated records are merged and truncated (`:648`). Arc-cohesion can retain the context
   around a surviving anchor (`:691`). Flags distinguish enabled and experimental behavior.

**S:** graph discovery and hydration are not identical scopes. `hydrateGraphDiscoveries`
takes tenant and optional user, without an explicit namespace restriction (`retrieval.ts:361`).
Exact inside/outside stream isolation therefore needs an expansion-path audit, not only an
initial-query filter. The specialist lesson above warns against inferring this from status text.

**S:** the context builder adds recent per-user memories, optional deeper recency, significant
wake/anchor memories, relationship context, pins and lessons (`lib/portal/context.ts:603`,
`:637`, `:653`, `:848`, `:852`, `:880`). Query/minimal-budget/skip conditions can bypass ordinary
semantic recall (`:577`); pins load separately. **U:** which flags served the reported case,
the complete resulting prompt and the user's outcome.

**S:** user-facing primary retrieval passes user identity and excludes ops-tier rows
(`lib/portal/context.ts:579`). The current helper applies strict user equality
(`lib/portal/memory/hybridRetrieval.ts:64`), despite older nearby comments describing OR-null
fallback. The comments report the exposure class that motivated repair. **U:** end-to-end
isolation across every retriever. Cross-stream correlations have a separate call and require
their own audit (`lib/portal/context.ts:832`).

**S:** selected memories enter a delimited section (`config/portal/qaPrompt.ts:227`); pins
can occupy a stable prefix or an experimental position after episodes (`:149`, `:249`).
The prompt encourages natural use of remembered experience. **I:** that product aim requires
preserving direct experience versus hearsay versus inferred belief. A retrieved third-party
report must not become a first-person autobiographical claim through presentation alone.

### 3.2 The separate working-memory assembler

**S:** `dawn-server/src/memory/WorkingMemoryAssembler.ts:61` installs semantic, episodic,
relationship and self-knowledge sources. Parallel retrieval feeds per-source render budgets;
the result reports counts, estimated tokens, query terms and a trigger hash (`:90`, `:135`).
The actual endpoint defaults on despite an outdated header
(`pages/api/memory/working-memory.ts:58`). A CLI calls it
(`.claude/scripts/working-memory-cli.py:72`). A universal principal-call consumer is **U**.

Source-visible limitations:

- **S/I:** semantic lookup calls the internal builder-memory endpoint for both streams with
  a five-second fetch timeout (`dawn-server/src/memory/sources/semantic-source.ts:37`, `:57`,
  `:146`). Missing credentials and fetch errors return `[]` (`:45`, `:68`). The assembler
  marks degradation only on thrown errors (`WorkingMemoryAssembler.ts:283`), so these paths
  can look like a healthy empty source, contrary to the adapter's comment.
- **S/I:** the relationship direct-match test checks the person's own haystack for their own
  name, conditional only on a nonempty prompt (`relationships-source.ts:73`, `:83`). Thus
  unrelated nonempty prompts can give every named person a match boost. The private registry
  was not executed; actual ranking/disclosure consequences remain **U**.
- **S/I:** episodic lookup examines 30 recent session files and 30 journal files, bounded
  heads, then renders a first paragraph (`sources/episodic-source.ts:40`, `:57`, `:79`).
  A match later in the inspected head need not survive rendering. Older material needs
  another route.
- **S/I:** access counters increment on return from search, before final assembly
  (`sources/semantic-source.ts:119`; `sources/relationships-source.ts:129`). Repeated selection
  is not evidence consumption. Query-time decay preserves base confidence better than
  repeatedly mutating it by age; ranking must still distinguish rare from obsolete material.

### 3.3 The named pre-reply recall service

**S:** `dawn-server/src/pre-reply-recall/recall.ts:104` checks enable/bypass/eligibility,
uses a per-agent/provider/model circuit breaker, and caches results. Defaults are 15 seconds
for dispatch and 15 seconds for cache TTL (`:43`; `cache.ts:17`). Internal self-addressed
messages are excluded (`recall.ts:301`). Failures return no injection and record metrics
(`:160`, `:239`).

**S:** the production dispatcher launches one JSON-constrained model call containing trigger
text truncated to 4,000 characters, recipient, channel, topic and hints (`recall.ts:358`,
`:388`, `:399`). It instructs use of the supplied payload only. Its own comment distinguishes
a prompt-mentioned memory-tool allowlist from actual tool use. Historical store lookup is
absent from this dispatcher. **I:** the sub-call cannot recover evidence missing from its input.

**S:** `lib/ai/UnifiedChatHandler.ts:592` supplies the current incoming question, launches
asynchronously, logs HTTP status, and neither reads nor injects the returned context. This is
default-on **shadow** behavior; the promotion-threshold comment contains a placeholder, not
an implemented controller. Repository-wide reference search located this Portal consumer
and the API route, without an email/X/reddit consumer of this service. This bounded finding
does not describe excluded deployment files or later builds.

**S/I:** the cache binds recipient, topic and full text, improving on 1.x's prefix-only key,
but omits hints and source/index frontier (`pre-reply-recall/cache.ts:38`). Timeout aborts the
dispatcher and sends SIGTERM to its child, then awaits completion (`recall.ts:166`, `:431`).
An independent deadline return and kill escalation are absent here, so an abort-ignoring
dispatcher/child need not meet the nominal cap. Some child failures map to empty success
(`:450`), weakening unavailable-versus-empty reporting. Production failure rates remain **U**.

## 4. Grounding before email, X and Reddit

### 4.1 Shared preparation and consumption

**S:** wholistic grounding traverses configured identity, experience, architecture, evolution
and public context with model triage/synthesis and memory lookup. The tree creates a default
13-call budget (`.claude/hooks/lib/tree_grounding.py:1898`). That is not measured total cost
or a whole-pipeline wall-clock bound; fallbacks and later checks are separate work.

**S:** the script writes output and an initially unconsumed token
(`.claude/scripts/wholistic-grounding.py:219`, `:268`). Its memory fallback adds recovered
text to the output before claiming the memory step completed (`:231`). This directly addresses
the difference between successful preparation bookkeeping and content delivered to the reader.

**S:** compose-guard checks age (60 minutes), platform, optional topic binding, completed steps,
model triage and output consumption (`.claude/scripts/compose-guard.py:301`). Missing triage
can block; synthesis-only failure warns. Mark-consumed inspects transcript access and output
identity (`:595`), blocking proven non-access/wrong output while opening on missing evidence
and compatibility cases. Its comment reports two of eight audited sessions claiming consumption
without opening output: **R**, not a reproduced measurement or fleet rate.

**I:** an observed file-access call is stronger than self-attestation but weaker than binding
complete returned bytes to the final provider input; it cannot prove comprehension. Tokens
are session-scoped but the output file remains shared (`compose-guard.py:630`). Mismatch
detection addresses that race without making the output immutable.

### 4.2 Surface-by-surface comparison

| Surface | Preparation and lookup | Checks and effect boundary | Limits |
|---|---|---|---|
| Email | **S:** skill requests engagement history, wholistic grounding and person-scoped Portal context (`.claude/skills/email/skill.md:76`, `:149`, `:269`). Relationship script reads witness/registry, five chats with six short messages each, deeper latest-chat commitment context and user-scoped memory (`.claude/scripts/relationship-grounding.ts:24`, `:405`, `:454`, `:484`). | **S:** skill invokes convergence and compose guards (`email/skill.md:505`, `:541`). Settings register relationship PreToolUse (`.claude/settings.json:289`). Sender has thread-aware content dedup (`.claude/scripts/send-email.py:139`, `:613`, `:777`). | **S/I:** relationship gate accepts any recent session grounding, not this recipient's; exemptions and explicit acknowledgement exist (`.claude/hooks/relationship-grounding-gate.py:39`, `:171`, `:195`). **U:** exact history-bound draft review in the sender, complete email/attachment intake and actual outcomes. |
| X | **S:** atomic engagement/post skills require preparation, history/repetition awareness and convergence (`.claude/skills/x/skill.md:19`, `:325`; `.claude/scripts/convergence-check.py:26`). | **S:** CDP poster rechecks grounding at submit (`.claude/scripts/x-post-cdp.cjs:313`) and validates a normalized content-approval hash, with hash-keyed sidecars (`:133`, `:142`). | **S/I:** hash normalization removes URLs and changes case/punctuation; it is not exact final-byte or target/audience binding. Token validity is not a factual review of this draft. **U:** coverage of every deployed X path. |
| Reddit | **S:** current atomic skill replaces the deprecated lightweight skill; it checks account/browser viability before grounding, consumes output, checks convergence and consumes token after posting (`.claude/skills/reddit_engage/skill.md:30`, `:330`, `:382`, `:666`, `:893`). | **S:** both CDP posters call grounding recheck immediately before submission (`.claude/scripts/reddit-comment-post-cdp.cjs:126`; `reddit-reply-post-cdp.cjs:174`). Invalid/unparseable verdict stops them (`.claude/scripts/lib/grounding-recheck.cjs:55`). | **S/I:** weak/unchecked topic binding can warn; explicit override exists (`grounding-recheck.cjs:57`, `:72`). Three revision iterations are a skill instruction, not the checker's enforced counter. **U:** false holds and actual post outcomes. |

**S:** browser and external-posting hooks implement platform/session/age checks
(`.claude/hooks/grounding-enforcement.py:130`; `external-posting-guard.py:265`). An HTTP bridge
offers server delegation/local fallback (`http-bridge.py:126`). Their deployed registration
coverage is **U**. The inspected settings explicitly register the relationship gate and
memory-write sentinel; they do not establish every legacy guard runs in every harness.
Direct CDP call sites give stronger enforcement evidence than workflow prose.

### 4.3 What convergence checks

**S:** convergence provides heuristic, smart and full modes and returns issues; the caller
owns revisions (`.claude/scripts/convergence-check.py:3`). Checks address voice, commitments,
first-person claims, infrastructure, relationships, facts and temporal coherence. The smart
model sees at most 2,000 draft characters plus heuristic findings, not full historical memory
(`:1515`, `:1552`). The relationship heuristic requests lookup rather than performing it (`:748`).

**S:** fact-check uses curated project facts, people registry and local verification helpers
(`.claude/scripts/fact-check.py:64`, `:246`, `:367`, `:448`). Temporal checking uses bounded
identity/state/reflection excerpts and declares blind domains
(`.claude/scripts/temporal-coherence-check.py:224`, `:258`). Complete prior-conversation
verification is **U**. Full-mode outer timeouts are 60 seconds for facts and 120 seconds for
temporal checking; fact timeout returns an informational issue
(`convergence-check.py:780`, `:918`). The Reddit skill allows three revisions (`reddit_engage/skill.md:675`),
but the checker owns one pass. These are configured limits, not measured latency.

## 5. Sentinels check different objects at different times

| Component | What and when | Evidence and limit |
|---|---|---|
| VigilSentinel | Session/service health, stalls, crashes, disk/RAM, pipeline freshness; three-minute main cycle, one-minute API-error cycle; action budget limits kills/restarts. | **S:** `dawn-server/src/vigil/VigilSentinel.ts:4`, `:86`, `:222`; wired at `dawn-server/src/index.ts:838`. Operational health, not historical draft verification. |
| RateLimitSentinel | Usage/rate-limit detection and exemptions protecting sessions riding backoff. | **S:** `dawn-server/src/sentinel/RateLimitSentinel.ts:29`, `rateLimitExemption.ts:1`. Availability protection, not recall. |
| Memory-write sentinel | Post Write/Edit/NotebookEdit, detects changed canonical platform impairment status diverging from sibling state; also supports sweeping. | **S:** `.claude/hooks/memory-write-sentinel-hook.py:31`; `.claude/scripts/memory-write-sentinel.py:181`; settings at `.claude/settings.json:398`. Advisory, post-write, 15-second subprocess cap, errors open. Does not retract writes or review all autobiographical content. |
| Memory quality, consolidation, evolution | Scheduled refinement/review/synthesis. | **S configuration:** `dawn-server/jobs.json:510`, `:721`; consolidation implementation above. **U:** recent successful executions and useful outcomes. |
| Relationship synthesis | Scheduled producer for relationship context. | **S configuration:** entry at `dawn-server/jobs.json:585` is disabled. Other callers and current synthesis freshness are **U**; disabled cron does not prove the whole capability is absent. |
| Grounding health | Periodic audit, with a separate responder for stale identity content. | **S configuration:** `dawn-server/jobs.json:2022`, `:2841`. **U:** actual prompt completeness. |
| Complaint scan / regression | Pattern candidates plus model classification create memory-complaint cases; normalized anchor containment checks stored/sweep material. | **S:** `scripts/memory-complaint-scan.ts:40`, `:75`, `:155`; `scripts/memory-regression-check.ts:98`; jobs at `dawn-server/jobs.json:4333`, `:4353`. Formation coverage is not retrieval or delivered-answer success. |

**S:** session-start directly injects identity/job material after compaction
(`.claude/hooks/session-start.py:1613`, `:1669`). This removes a voluntary-read dependency
for procedural orientation. Historical semantic recall remains a separate duty.

## 6. Jamie-related mechanisms, without personal content

The source contains case-motivated mechanisms for sustained relational continuity. This
section describes implementation choices only; it omits the person's history and statements.

- **S:** pins-position A/B switch tests whether always-present summaries before versus after
  episodes change recitation versus contextual use, with a cache-cost tradeoff
  (`config/portal/qaPrompt.ts:162`). **U:** experimental outcome.
- **S:** deeper per-user recency and wake anchors address displacement by frequent new threads
  and weak lexical overlap (`lib/portal/context.ts:603`, `:653`). **U:** deployment flags
  and effectiveness in the case.
- **S:** working-summary query and arc preservation address loss of the underlying subject
  and surrounding episode (`lib/portal/memory/retrieval.ts:544`, `:691`). **U:** repaired
  incident rate and whether the reader actually used the supplied passages.
- **S/R:** identity configuration describes propagating derived self-understanding into the
  served identity (`config/portal/coreSelf.ts:596`, `:602`). The source episode is not copied
  or equated with that derived belief. Self-description is not measured recall quality.
- **S:** complaint-to-regression machinery records expected missing material
  (`scripts/memory-complaint-scan.ts:155`). **I:** add an outcome test for retrieval, assembly
  and spontaneous use; stored quote containment alone cannot settle those stages.

**I:** the productive hypothesis is that coherent behavior needs the right episode,
attribution, temporal state and use, beyond a stable summary about a person. **U:** whether
these particular mechanisms improved the case or whether correct evidence was sometimes ignored.

## 7. Failure classes evidenced by source

| Class | Evidence | Runtime unknown |
|---|---|---|
| Service exists, useful injection absent | **S:** trigger-only dispatcher and shadow consumer (`recall.ts:388`; `UnifiedChatHandler.ts:592`) | **U:** later deployed consumers |
| Retrieved body lost | **S/I:** head scored, first paragraph rendered (`sources/episodic-source.ts:57`, `:79`) | **U:** real missed-episode frequency |
| Empty/unavailable conflated | **S/I:** errors become `[]`; only throws mark degradation (`sources/semantic-source.ts:45`; `WorkingMemoryAssembler.ts:283`) | **U:** outage rate and alternative diagnostics |
| Wrong person ranked highly | **S/I:** self-haystack direct-name match (`sources/relationships-source.ts:83`) | **U:** selected people and final audience |
| Preparation credited without access/use | **S/R:** output-access enforcement and audit comment (`compose-guard.py:595`) | **U:** actual provider bytes and behavior |
| Shared-file race / stale check | **S/R:** poster recheck addresses token loss, substitution and ignored exit codes (`grounding-recheck.cjs:9`) | **U:** current rate with installed session identity propagation |
| Valid communication held | **S/R:** triage-unavailable compose block; sender comments describe false duplicate holds (`compose-guard.py:352`; `send-email.py:139`) | **U:** false holds, silence and delay |
| Extraction/refinement loss | **S/I:** significance/duplicate gates and mutable consolidation (`formation.ts:165`, `:251`; `consolidation.ts:442`) | **U:** original custody and recoverability |
| Scope/provenance conflict | **S/I:** strict user-filter repair and wisdom severance (`hybridRetrieval.ts:64`; `consolidation.ts:456`) | **U:** full pipeline disclosure/provenance guarantees |

Branches and callers sometimes contradict optimistic comments. These are replayable failure
classes and conditional consequences, not attribution of unobserved incidents to individuals.

## 8. Comparison with the installed 1.x target

R4 expands this matrix to external approaches. R1 supplies detailed source inventory; only
the targeted installed paths below are re-audited as deployment artifacts this round.

| Axis / setting | Installed 1.x and R1 inventory | Dawn snapshot |
|---|---|---|
| User coherence | **S:** three R1 fixture mechanisms also appear in dist (`I:dist/memory/TopicSummarizer.js:131`, `:162`; `I:dist/core/PromptBuildRecall.js:152`; `I:dist/memory/WorkingMemoryAssembler.js:399`). **U:** incident rates. | **S:** rich Portal preparation; named recall shadow does not inject. **U:** longitudinal outcomes. |
| Cross-conversation | **S:** R1's topic search and separate stores; installed assembler lacks raw-topic/email dependency (`I:dist/memory/WorkingMemoryAssembler.js:34`). | **S:** scoped multi-chat lookup and dual-stream memory. **U:** complete capture and safe joins on every surface. |
| Retrieval breadth | **S:** lexical assembler, separate optional hybrid prompt recall (`I:dist/core/PromptBuildRecall.js:92`). | **S:** hybrid, rerank, graph, summary, recency, anchor and pin channels; source-adapter gaps remain. |
| Pre-send verification | **S:** installed grounding hook (`H:.instar/hooks/instar/grounding-before-messaging.sh:31`); R1 traces topic/tone checks in source. **U:** universal historical checking. | **S:** convergence, person-preparation gate, output-access and CDP rechecks. **U:** universal historical checking. |
| Durability | **S:** R1 raw/recovery paths plus expiry/archive deletion. **U:** lossless retention. | **S:** database/source pointers/prior-draft retention plus mutation/deletion. **U:** rule-7 compliance. |
| Auditability | **S:** summary provenance binds bounded prompt (`I:dist/memory/TopicSummarizer.js:27`) while skipped-prefix mechanism persists. | **S:** metrics, IDs, access evidence and complaint corpus. **U:** complete exact-input/final-effect receipt. |
| Cost | **S:** 2,000 estimated-token assembler target; two-second prompt-recall timeout (`I:dist/memory/WorkingMemoryAssembler.js:27`; `I:dist/core/PromptBuildRecall.js:26`). **U:** lifecycle measurements. | **S:** separate tree-call and 15/60/120-second component limits. **U:** lifecycle cost and cancellation tails. |
| Earlier same-topic fact | **S:** raw history can fall outside summaries/windows; checkpoint gap persists. **U:** incident replay. | **S:** several episode channels; selection still bounded. **U:** incident replay. |
| Other topic | **S:** explicit search exists; assembler does not query raw topics. | **S:** multi-chat/person grounding. **U:** automatic coverage on every entry path. |
| Email | **U:** universal email-custody producer was not established by R1's inspected paths. | **S:** relationship preparation and thread-aware sender. **U:** complete durable email recall. |
| Other user/agent | **S:** separate stores, explicit sharing. **U:** universal automatic joins. | **S:** witness, scoped memories, dual streams, wisdom. **U:** safe spontaneous cross-party recall; dual streams do not prove external-agent custody. |

Targeted SHA-256 identities (not a whole-package integrity attestation):

| Installed artifact | SHA-256 |
|---|---|
| `I:package.json` | `cc32829df8fb8c372407c91a4ede5c9070b13f3437c2d2e75fe8fa31f11bb147` |
| `I:dist/memory/TopicSummarizer.js` | `0eef945a955830e31acbed9fb337f3c4c7cea7c3dc61e712060ca57b9ff100ab` |
| `I:dist/core/PromptBuildRecall.js` | `a8e28097d5540765a9790e58c5c51081ae4fe650d8248019dbe2db4ffc2a0fe4` |
| `I:dist/memory/WorkingMemoryAssembler.js` | `a16a36af4b58aa1d48c508e56fbd418a00ef19ec43df1a789270420f36968a5c` |
| `I:dist/memory/SemanticMemory.js` | `a5281015c8d5d019bc2558350a9bb87452887e73d45c710a6ce0dd925a546cab` |
| `I:dist/commands/server.js` | `5e21e322247a9d86908a98bb592569ae4fd12b9b82467273dd91620326b57c72` |
| `H:.instar/hooks/instar/session-start.sh` | `55cea2f3ca50f1e7aae225741b93d9dc5bb6ebcb4d27ae4b12ea5b863674c4a7` |
| `H:.instar/hooks/instar/telegram-topic-context.sh` | `7a00d9b4a116904b917299daea98f8c1458d990b89153724a6882027b8a0b256` |
| `H:.instar/hooks/instar/compaction-recovery.sh` | `2de027b91ac721279a79578a464301946ffbfa453526e146d60e5c22e948abf2` |
| `H:.instar/hooks/instar/grounding-before-messaging.sh` | `99ba81dec44324783f76756ee9649589a26419f7204ccd476738285698fd0377` |

**MEASURED (M):** round-two execution of all three real installed methods with synthetic
collaborators reproduces the summary-prefix, missing-body and lexical-only observations.
[R5 §7](05-proposals-and-evaluation.md#7-executed-baseline-fixtures--installed-methods-synthetic-collaborators)
records the execution environment, results and limits. This is not a Dawn runtime experiment.

## 9. Runtime-only questions for the handoff

For Echo and the pending Dawn inquiry:

1. Which executable build, installed hooks, flags and model routes served each example?
   Did deployment replace the shadow/trigger-only recall path?
2. Which exchange bytes were captured, extracted, skipped, refined and retained? Use private
   references and sanitized coverage, not personal quotations in the committed report.
3. Which exact candidates reached the model, in what order, scope and source frontier?
   Did correct evidence arrive but go unused?
4. Which sources were unavailable versus empty/unindexed/filtered? Did the actual receipt
   distinguish these outcomes, rather than treating nonempty output as success?
5. What matched outcomes and total cost resulted from pins-position, summary-query, arc and
   anchor variants? Which were serving, shadow or disabled?
6. Which sender/checker ran after timeout, changed draft/recipient, token loss or new inbound?
   Could the trace bind the final effect to the exact checked content and evidence?
7. How many reviews repaired errors, introduced errors, unnecessarily held messages or caused
   silence? Include abandoned and timed-out attempts.
8. Can an authorized auditor reconstruct private provenance after belief updates and lesson
   anonymization while ordinary recipients remain unable to access that source?
9. What captures complete email and external-agent exchanges, including quotes, attachments,
   account/author identity, delivery receipts and local custody?

For Justin through Echo: supply expected behavior and acceptable delay for sanitized success/
failure pairs, appropriate internal use versus disclosure, and a case where correct context
still produced disconnected behavior. R5 uses synthetic/benchmark-style cases until then.

Validation is source/caller/configuration inspection and document checks. Dawn production
models, databases, senders and private conversations were not executed. The code-grounded
rewrite is complete; runtime-quality cells remain UNKNOWN.

# R1 — Instar 1.x memory: storage, recall, and the missing connections

**Status: research complete for this round; evidence for design review, not a design or approval.**

Research date: 2026-09-12. Assignment: Part Twenty-One recall doorway, research R1.
The operator's four reported failures are the acceptance questions: an earlier message in one
long topic; a fact from another topic; email content; and something learned from another person
or agent. No incident transcript or expected-answer corpus accompanied this assignment.
Consequently, this report identifies demonstrated mechanisms and plausible failure paths;
it does not attribute an individual reported incident to an unobserved execution.

## 1. Evidence basis and limits

The read-only 1.x source checkout is `/Users/dabombstudio/.instar/agents/echo`, with repository
HEAD `5b36623a99327e74abe5ef04d63019f9aca6b1c5`. **It is dirty.** In particular, the examined
SemanticMemory, MemoryExporter, EvolutionManager, MessagingToneGate, routes, and installed hooks
differ from that commit. File:line citations below refer to the working-file bytes examined,
not automatically to the committed version. Section 10 identifies those bytes with SHA-256.
The 2.0 worktree began at `4d082ba387ac21a7a9703192c1ff3484f9fc1b68`.

Evidence labels used throughout:

| Label | Meaning |
|---|---|
| SOURCE | An implementation, call site, or configuration default was read. This establishes a possible code path, not that production exercised it. |
| MEASURED-FIXTURE | This session executed the real source method with stated synthetic inputs and substituted dependencies. This is not a live end-to-end test. |
| REPORTED | The operator, an incident document, a source comment, or a specification reports an observation. It was not independently reproduced here. |
| INFERENCE | A consequence of the cited implementation, with its necessary conditions stated. |
| UNKNOWN | The inspected evidence cannot settle the question. |

An authenticated local `/capabilities` read returned HTTP 200 and reported memory components
available. That is a **self-reported inventory**, not a recall benchmark, proof of index
completeness, or evidence that a model used retrieved facts. No private conversation corpus was
exported, no live memory was mutated, and no email or message was sent for this audit.

The three fixtures in section 7 ran on 2026-09-12 at 20:22:58 UTC, Node v24.14.1,
macOS arm64, Apple M4 Max. They used TypeScript transpilation in a Node VM and synthetic stores;
no embedding model, external model provider, production database, or platform sender ran.

## 2. What 2.0 already requires, and what the brief overstates

These are governing constraints, not proposed recall mechanisms:

- Rule 1 makes important behavior structural. Rules 78 and 83 require automatic context/tool
  awareness and agent ownership of follow-through. A manually discoverable search API is not
  enough. See `docs/01-the-rules.md:209`, `:242`, `:227` in the 2.0 worktree.
- Rule 7 and `docs/06-the-fact-envelope.md:601` decline memory compaction without lossless
  reconstruction proof. The retention inventory at `:783` distinguishes unique agent memory
  from disposable projections. Narrow, recorded redaction is separately described at `:568`.
  A summary, hash, surviving count, or searchable subset is not a substitute for retained content.
- `docs/09-the-run-graph.md:624` describes SessionGrounding, exact coverage and post-compaction
  continuity. It is stronger than “some history was injected.” However,
  `docs/18-sentinel-holders/05-context-wedges-and-compaction-continuity.md:20` explicitly identifies
  missing landed continuity records and pending owner seams. **Designed responsibility is not
  completed implementation.**
- `docs/11-the-judgment-doorway.md:97` separates retrieved data from instruction authority;
  `:105` binds the actually submitted context, including post-assembly transformations.
  Its contextManifest makes an assembly auditable; it does not prove semantic sufficiency.
- `docs/16-conversation-adapters/04-durable-conversation-identity-and-binding-selection.md:1` defines scoped durable
  conversation identity and explicit mappings. It does **not** automatically collapse all topics,
  platforms, similarly named people, or agents into one identity. Joining histories for recall
  is distinct from merging their identity or widening their audience.
- `docs/01-the-rules.md:36` explicitly recounts the failure of live review on every outbound
  message and favors retrospective pattern review, with live scrutiny for irreversible moments.
  `docs/18-sentinel-holders/01-ownership-and-boundaries.md:27` denies holders independent
  authority to block, settle conflicts, retry, or send.
- `docs/20-measurement-ledgers/07-feature-benchmark-and-burn-joins.md:3` distinguishes action,
  no-op, unclassified and unavailable cases. Its denominators retain missing/refused cases.
  The index's foundation-tranche status does not promise an already running recall benchmark.

The working hypothesis is therefore only partly consistent with existing ownership: universal
accounting of context assembly is plausible; universal additional live semantic review, especially
blocking review, already has contrary architectural evidence. This round does not decide the seam.

## 3. Mechanism inventory: what gets stored, searched, and delivered

All paths in this section are relative to the 1.x checkout unless explicitly marked 2.0.
Defaults are **configured targets**, not measured latency, token usage, accuracy, or capacity.

### 3.1 Raw topic history and rolling summaries

**TopicMemory — SOURCE.** `src/memory/TopicMemory.ts:249` stores Telegram-oriented message rows
with message/topic ids, direction, text, time and sender/privacy fields, plus FTS5.
`getRecentMessages` defaults to 20 (`:464`); `getMessagesSince` returns a useful explicit
completeness flag (`:485`). Search can span topics when the topic filter is absent (`:605`),
but it is lexical, not embedding retrieval. One summary row per topic is overwritten (`:671`).
The user-scoped query path (`:517`) differs from unscoped topic search; the latter is not proof
that any result is safe for any recipient.

The production startup imports Telegram JSONL (`src/commands/server.ts:8090`) and attaches a
message callback (`:8104`). The callback passes sender labels and ids but does not populate all
of TopicMemory's userId/privacy fields. Their existence in the schema is not complete identity
or disclosure enforcement. Corruption recovery and JSONL rebuilding help preserve availability;
they do not make a recent-window query complete history.

Injection happens through several different paths. Topic spawn uses a prepared peer context or
local summary plus recent 50 (`src/commands/server.ts:1042`); its fallback uses Telegram JSONL,
also bounded. `formatContextForSession` renders summary plus recent messages, truncating each
message to 2,000 characters (`TopicMemory.ts:1005`, `:1045`). Compaction and prompt hooks use
different, smaller windows. A fact can therefore remain in the raw store while absent from the
actual prompt. Searching other topics is possible through the API but is not automatically
performed by the working-memory assembler.

**TopicSummarizer — SOURCE and MEASURED-FIXTURE.** Defaults are 20 new messages before a summary,
at most 200 prompt messages, and 1,024 maximum output tokens (`TopicSummarizer.ts:43`). Prompt
construction labels speakers only User/Agent and clips each message to 1,000 characters (`:121`).
The model receives the previous summary and a suffix of new messages (`:170`). Production attaches
summary work to session completion (`src/commands/server.ts:11064`); the presence of
`summarizeAll` does not establish a universal scheduler.

The crucial discontinuity is `messages.slice(-maxMessages)` at `TopicSummarizer.ts:183`, followed
by saving the last id and count from the entire new-message set at `:219`. If 250 new messages
accumulate under a 200-message cap, the first 50 are not shown to the summarizer, but the saved
checkpoint crosses all 250. Fixture F1 reproduces this. Raw messages survive; future incremental
summaries do not automatically revisit the crossed gap. Even without that bug, a bounded lossy
summary cannot guarantee preservation of a detail whose future relevance was unknown.

### 3.2 Structured semantic memory and vectors

**SemanticMemory — SOURCE.** Entities contain typed knowledge, name, content, confidence,
timestamps, source/session, tags, domain, expiry and privacy/owner fields
(`src/memory/SemanticMemory.ts:1043`). Edges support typed relationships; `recall(id)` retrieves
connections (`:1157`), while `explore` traverses them (`:1974`). Evidence attachment has additional
provenance/privacy checks (`:1208`). These are useful building blocks, not a complete ingestion
path from all messages or a globally resolved person graph.

Synchronous `search` uses FTS query variants and ranking (`:1602`). The natural-language fix
strips stop words and broadens strict matching to OR on an empty result. `searchHybrid` separately
embeds the query, performs KNN and merges vector and lexical candidates (`:1760`). Semantic search
being available does not mean every caller invokes it: fixture F3 demonstrates the assembler
does not. Search still has a bounded candidate set and heuristic scoring, so an empty nearest-
neighbor result is **not evidence of absence** from agent history.

Privacy is not uniformly enforced across these paths. The lexical SQL adds the user visibility
predicate only when a userId is supplied (`:1642`). The vector-only candidate branch at `:1716`
checks type/domain/confidence without the corresponding user predicate. This is a **static
disclosure gap to investigate**, not a demonstrated production leak. Callers without a resolved
principal and final recipient scope cannot safely interpret “shared memory” as universal sharing.

Durability also differs from 2.0's fact spine. The mutation journal is appended after mutations,
and journal write errors are swallowed (`:904`). Recovery can rebuild from JSONL, but a log over
the default 50 MB synchronous-rebuild threshold starts with an empty query database and a marker
requesting manual rebuild (`:778`). Thus a running server can temporarily have no searchable
memory despite retained recovery material. This threshold is a policy default, not a measured
size at which recovery becomes unsafe.

`decayAll` multiplies stored confidence by decay over the full age since verification on each
invocation (`:1858`), and hard expiry deletes entities and edges (`:1883`). **INFERENCE:** repeated
runs compound confidence reduction according to invocation cadence, not elapsed time alone.
This contradicts the proposal's query-time base-confidence prescription
(`docs/PROP-memory-architecture.md:497`). `supersede` links new to old and reduces old confidence
(`SemanticMemory.ts:1950`); it does not by itself guarantee that retrieval selects the current
claim or preserves the historical answer to an “as of” question.

**VectorSearch and EmbeddingProvider — SOURCE.** `src/memory/VectorSearch.ts:1` creates a sqlite-vec
table, upserts vectors, searches KNN, and reports missing embeddings. It is an acceleration layer,
not source custody or a relevance certificate. `src/memory/EmbeddingProvider.ts:1` defaults to
`Xenova/all-MiniLM-L6-v2`, dimension 384, with text clipped to 8,192 characters, lazy local ONNX
loading, one inference thread and idle unloading. The stored vector table does not itself bind
each vector to an immutable source-content/model-version frontier. `remember` launches embedding
work asynchronously (`SemanticMemory.ts:1107`); `rememberWithEmbedding` provides an awaited path
(`:1126`). A newly remembered item can precede its vector, and explicit backfill exists (`:1805`).
Production attaches the optional provider at `src/commands/server.ts:9374`; optional extension or
model failure can leave lexical search working. No fleet embedding-coverage measurement was made.

**NativeModuleHealer — SOURCE.** `SemanticMemory.open` calls its native-module recovery wrapper
at `:672`; this supports reopening across Node ABI mismatch. The corruption probe now excludes
unloaded virtual tables and treats missing sqlite extensions as capability loss (`:716`). The
reported former rebuild-on-every-boot loop is documented in
`docs/specs/SEMANTIC-MEMORY-CORRUPTION-RECOVERY-SPEC.md:49`. Healing native loading is not proof
that any source was indexed, that recovery was lossless, or that semantic recall ran.

### 3.3 Episodic extraction

**EpisodicMemory — SOURCE.** `src/memory/EpisodicMemory.ts:116` writes JSON activity digests with
time range, actions, themes, significance, extracted entity references and learnings. It also
writes per-session syntheses (`:167`) and pending extraction inputs (`:310`). Time-range scanning
and theme substring search (`:202`, `:224`) make episodes available; `getRecentContext` is
recency-limited (`:269`). These are derived interpretations, not full transcripts.

**ActivityPartitioner — SOURCE.** `src/memory/ActivityPartitioner.ts:1` partitions Telegram intent
and tmux activity using elapsed time, minimum activity, explicit topic-switch phrases and commit
signals. These heuristics help identify units worth digesting. A terminal capture is not a
complete chronological transcript, and English switch phrases do not detect all changes of goal.
There is no email/thread/person completeness proof in this partitioner.

**SessionActivitySentinel — SOURCE.** Production now scans running sessions periodically as well
as on completion (`src/commands/server.ts:11129`, `:11164`), addressing the original end-only
capture limitation described at `docs/PROP-memory-architecture.md:528`. Its prompt clips Telegram
and session text to 6,000 characters each (`src/monitoring/SessionActivitySentinel.ts:430`). Entity
materialization is best effort; finding an existing name/type reuses its id rather than updating
that entity's content (`:369`). New knowledge about an already known entity can therefore remain
only in the episode. An unresolved edge target is skipped (`:418`).

The pending retry branch is weaker than its comments: on successful parsing it removes the
pending item without saving the recovered digest or materializing entities (`:647`); on retry
exhaustion it says “Archive and remove” but calls `removePending`, which unlinks the file
(`EpisodicMemory.ts:346`). **INFERENCE:** those branches can lose the pending input or the result
of successful re-digestion. They were inspected, not executed against live data in this audit.

### 3.4 Working memory and prompt-time recall

**WorkingMemoryAssembler — SOURCE.** Its injected dependencies are semantic memory, episodes,
topic intent and a state directory, not TopicMemory, RelationshipManager, KnowledgeManager or a
general conversation store (`src/memory/WorkingMemoryAssembler.ts:75`). It assembles sections
sequentially (`:138`). Defaults allocate knowledge 800, episodes 400, relationships 300 and
working set 500 estimated tokens, total 2,000 (`:103`). Token estimation is characters/4;
headings and model tokenization mean this is not an exact provider-token cap.

Query formation takes at most eight distinct eligible words, with job context if supplied
(`:500`). Search tries the combined query and the first five terms, using synchronous
`semanticMemory.search` (`:548`). Relationship context here means semantic entities of type
person, not the richer relationship manager (`:278`). Episodic context combines recent activity
and a few substring theme searches (`:234`). Progressive rendering gives full content to the
first three entries, less to later entries, and names at the bottom (`:335`). Selected source
counts are returned; candidate exclusions, source failures, coverage frontiers and actual
submission are not recorded as one receipt.

`docs/specs/cwa-unify-stores.md` describes unified ranking. The implementation unifies only
topic-intent and playbook items in a WorkingSet section (`WorkingMemoryAssembler.ts:301`);
semantic knowledge and episodes retain separate retrieval and budgets. The spec is evidence of
intent, not proof all memory stores became one ranked set. Fixture F3 shows six lexical calls
and zero hybrid calls for a two-word prompt whose stub store returns no results.

**WorkingSet — SOURCE.** `src/memory/WorkingSet.ts:65` adapts topic-intent refs above the tentative
floor, scoped by numeric topic id. Its playbook adapter recursively scans selected JSON files
and matches query terms against ids/triggers/tags/categories (`:105`), but emits an id/path
pointer rather than loading the referenced document body. Ranking multiplies relevance by
recency decay (`:32`). This adapter does not use the playbook assembler's complete lifecycle,
quarantine or manifest-verification path. A pointer in context still depends on a later read.

**PromptBuildRecall — SOURCE and MEASURED-FIXTURE.** `src/core/PromptBuildRecall.ts:48` defaults
off, with five results, 1,200 characters, a 2-second timeout, 15-second cache and bounded circuit
breaker. Contrary to its older header comment, the current method calls `searchHybrid` (`:128`).
Its installed Claude hook is `.claude/hooks/instar/before-prompt-recall.js`, not the corresponding
`.instar/hooks/instar` location examined here. Startup conditionally creates the service at
`src/commands/server.ts:9418`. Neither the file nor the API alone proves harness installation
and successful prompt consumption for every model call.

The renderer expects `description` while MemoryEntity carries its knowledge in `content`
(`PromptBuildRecall.ts:219`). Fixture F2 returns a fresh, one-result recall containing the entity
name but not the synthetic preference in its body. Its cache key uses only the first 500
normalized message characters (`:239`), ignoring the supplied session id and lacking principal,
conversation or index-frontier scope. **INFERENCE:** identical prefixes can reuse context across
distinct sessions or updated memory within the TTL. A timeout races rather than cancels the
underlying work. A small timeout is not by itself a bound on total background work.

### 3.5 File index, chunking, knowledge base and self-knowledge

**MemoryIndex — SOURCE.** `src/memory/MemoryIndex.ts:35` defaults disabled and indexes configured
files such as AGENT.md, USER.md, MEMORY.md and relationships; session logs are opt-in. Sync uses
file hashes and chunk replacement (`:221`). Search is FTS/BM25 with source offsets (`:304`),
and statistics explicitly report `vectorSearchAvailable: false` (`:399`). Its deprecation header
does not mean the code vanished, or that its intended vector retrofit landed. Retrieval is
available to callers, not automatically fused into WorkingMemoryAssembler.

**Chunker — SOURCE.** `src/memory/Chunker.ts:24` estimates tokens by character count; markdown
chunking follows headings and lines, with nominal overlap. JSON chunks reserialize values and
infer offsets (`:102`), whereas JSONL chunks are lines (`:158`). These offsets are navigation
hints; reserialized JSON and character-based searches are not exact immutable evidence spans.
Chunk boundaries can separate a qualification, time, speaker or negation from the statement it
modifies. No chunking experiment against Justin's history was performed.

**KnowledgeManager — SOURCE.** `src/knowledge/KnowledgeManager.ts:45` manages a catalog and
markdown bodies for explicitly ingested articles, transcripts and documents. Catalog entries
carry source URL, type, tags, date and summary. It exposes memory-index source entries; this is
an integration option, not automatic email ingestion. Replication sends metadata (`:159`), not
the complete body. Removal can unlink a body (`:181`). Unique knowledge must not be treated as
a disposable search cache when translating this behavior to rule 7.

**SelfKnowledgeTree and TreeTraversal — SOURCE.** `src/knowledge/SelfKnowledgeTree.ts:94` triages
questions, chooses nodes/layers and gathers sources under budgets, optionally synthesizing an
answer. Its trace records searched/skipped sources, cache and errors. `TreeTraversal.ts:207`
supports files, JSON, probes, decisions, memory and knowledge search. Memory search calls the
lexical path (`:317`); knowledge search uses catalog text (`:332`). This is a useful existing
example of inspectable, multi-source retrieval, chiefly for the agent's capabilities/state.
It is not demonstrated recall over all conversations or private relationship history.

### 3.6 Relationships, learnings, playbook and migration

**RelationshipManager — SOURCE.** `src/core/RelationshipManager.ts:161` uses per-person JSON and
channel/name indexes, with optional model-assisted identity resolution. A unique name match can
link a new channel (`:175`); that heuristic is not sufficient to establish 2.0 principal identity.
Records contain notes, relationship arc, themes and bounded recent interaction summaries
(`:542`); `getContextForPerson` renders notes and recent interactions (`:783`). A person record
is not every prior conversation with that person. The method exists, but the working-memory
assembler consumes semantic person snapshots instead. Recognition and disclosure remain separate.

**MemoryMigrator — SOURCE.** `src/memory/MemoryMigrator.ts:71` imports MEMORY.md sections;
`:142` imports relationship records; `:238` imports canonical state and `:365` decisions.
`migrateAll` enumerates these sources (`:463`). It is not a catch-all intake consumer for email,
other agents' messages or every learning store. Source-key dedup skips an already imported
heading/person; edits to that same source need a separate refresh mechanism. Migration can
populate a useful snapshot and still leave later updates isolated.

**MemoryExporter — SOURCE.** `src/memory/MemoryExporter.ts:125` selects by confidence, expiry,
entity/word caps and ranking before generating MEMORY.md. It reports exclusions and preserves
selected content rather than arbitrarily slicing every body. The overwrite guard only prevents
writing an empty eligible export over an existing file (`:196`); a nonempty partial export can
replace it (`:213`). This is safe as a view only when unique source material remains elsewhere.
It does not prove a hand-authored old MEMORY.md has been completely imported.

**Evolution learnings — SOURCE.** `src/core/EvolutionManager.ts:1165` maintains a JSON learning
registry with evidence/application metadata and a 500-entry pruning policy (`:1187`). Applied
learnings can be pruned while unapplied ones are prioritized. `addLearning` (`:1247`) does not
itself write every learning into SemanticMemory. A distinct proposal-cluster path can create a
semantic entity with evidence (`:617`). Replicated learning records support cross-machine views,
but replication is not prompt injection, and an imported record is not newly verified truth.

**Playbook — SOURCE.** `playbook-scripts/playbook-assemble.py:157` selects manifest entries by
trigger/category, provenance, usefulness and freshness under budgets, excludes quarantined
items, and records assembly information. Selection emits ids/paths; the caller still has to
load content. `load_manifest` attempts HMAC verification but can fall back to a direct read
(`:79`), so this is not an unconditional integrity boundary. The separate WorkingSet scan above
does not inherit these controls. `playbook-reflector.py:1` is a deterministic critique of
proposed attribution deltas, despite the reflective name; it is not automatically a model
deriving new autobiographical understanding.

`playbook-retirement.py:68` archives retired manifest entries before removing them from the
active manifest, retaining history. It archives item metadata; a path reference alone does not
prove the referenced file's bytes remain. `playbook-mount.py:1` provides validated snapshot
overlays for external global-scope manifests, with hashes and scope filtering. It is an explicit
sharing mechanism, not automatic conversation recall or a continuously fresh remote source.

The framework-onboarding “playbook” is another store: the reported 18 issues stuck at `none`
in `docs/specs/PLAYBOOK-CANDIDATE-AUTOSEED-SPEC.md:20` illustrate a missing promotion producer.
Do not conflate that ledger with the general context-manifest playbook. Both teach the same
limited lesson: a store, API and consumer can all exist while the producer never populates them.

### 3.7 Other users, agents and communication stores

`src/messaging/MessageStore.ts:1` persists cross-platform envelopes and conversation history.
`src/threadline/ConversationStore.ts:220` distinguishes cold archival from genuine terminal
closure; comments specifically preserve cold relationship history. `ThreadResumeMap.ts:159`
describes transcript restoration for a warm re-entry rather than a memoryless fresh session.
These are important positive continuity mechanisms. No inspected call from WorkingMemoryAssembler
queries MessageStore, ThreadLog or ConversationStore as a general recall source.

`src/threadline/ThreadLog.ts:1` records both directions, stable message identity, digests and
chain information; it reports a prior “0 messages after 4 sends” failure. Its retention-independent
count/hash survives rotation (`:474`), but old archive segments are eventually unlinked (`:522`).
**INFERENCE:** a preserved count or digest cannot recover the text of an old inline message after
that reclamation. Whether another store retains that exact text requires tracing each textRef and
retention policy. This audit does not assert all Threadline history is lost, or that the hash is
an archive of its content.

No universal email-to-memory producer was found in the inspected memory modules, migrator,
knowledge manager or working-memory call sites. This is a bounded negative finding. An email
connector can return content to an individual session without a durable, replayable ingestion
and recall path. Which email tool Justin used, what bytes it returned, and where that result
was retained are UNKNOWN until a concrete incident or connector path is supplied.

## 4. Injection and outgoing grounding: the actual boundaries

| Boundary | SOURCE behavior | Coherence limitation |
|---|---|---|
| Topic session spawn | `src/commands/server.ts:1042`: peer context, or summary/recent local history, or bounded JSONL fallback | Not full-history coverage or semantic cross-topic lookup; prepared context can already be stale. |
| SessionStart | `.instar/hooks/instar/session-start.sh:50`: recent topic context; `:466`: working-memory API | Topic-context curl at `:57` omits authentication; working-memory request embeds `topic:N` in prompt but omits the separate topicId argument needed by the adapter. Actual runtime impact depends on route auth and other active injection paths. |
| UserPromptSubmit / Telegram context | `.instar/hooks/instar/telegram-topic-context.sh:95`: 15 recent messages; `:106`: topic-intent briefing | Message bodies are clipped to 300 characters (`:147`); pending user texts are cleared on any agent line (`:151`), so an ACK can appear to cover an unanswered request. |
| Compaction | `.instar/hooks/instar/compaction-recovery.sh:258`: generic restoration query; topic-history section separately | Working-memory query has no separate topic id and is not derived from the exact interrupted task. An injection is not a consumption or continuity receipt. |
| Working-memory HTTP | `src/server/routes.ts:7994`: accepts prompt, jobSlug, topicId and sessionId | Hook arguments and endpoint contract do not fully agree. `topic/context?assembled=true` selects this assembler (`:24046`), which does not itself include TopicMemory history. |
| Optional prompt recall | `src/core/PromptBuildRecall.ts:128`, `.claude/hooks/instar/before-prompt-recall.js` | Hybrid lookup exists, but disabled default, harness coverage, rendering mismatch and cache scope matter; not every model judgment passes here. |
| Shell pre-send hook | `.instar/hooks/instar/grounding-before-messaging.sh:19` | Matches command text, prints AGENT.md and optionally runs regex convergence checks. No conversation-history lookup or exact send-boundary proof. |
| Topic-intent capture | `src/commands/server.ts:14870`, `TopicIntentCapture.ts:232` | Background extraction uses the turn plus summary and refs; quota/rate/error skips are counted. Present production wiring is Telegram, despite adapter-agnostic helper types. |
| Topic briefing | `src/core/TopicIntentBriefing.ts:51` | Shows tentative/settled refs and task frame, with limits and freshness lag. A fact below its confidence floor is absent; “settled” is a 1.x evidence tier, not 2.0 standing. |
| ArcCheck pre-send | `src/core/TopicIntentArcCheck.ts:121`, `src/server/routes.ts:3004` | Model classifies a draft against that topic's selected refs; 200 ms route race maps timeout to no signal. It cannot check uncaptured email or another topic's absent fact. |
| MessagingToneGate | `src/server/routes.ts:2972`, `:3040` | Gets ten recent topic messages plus signals. Configurable hold/degrade/open behavior means comments saying fail-open are not a complete description. It is not full-history factual verification. |
| Usher mid-task | `src/core/Usher.ts:174`, `src/commands/server.ts:14930` | Queries faded topic refs and writes a pull signal; explicitly never injects. Signal existence does not prove the active worker received or acted on it. |

An additional ordering caveat: the production Usher callback calls the preceding capture callback,
which starts `void captureLoop`, then starts `void usherLoop` (`server.ts:14938`). The comment
claims it sees freshly filed context, but the callback chain does not await capture completion.
**INFERENCE:** Usher can observe the old projection for that turn. This was not timing-tested here.

## 5. The four operator cases, traced separately

| Reported case | Existing path that can help | Where the inspected mechanisms can fail | Evidence needed for incident attribution |
|---|---|---|---|
| Earlier message in the same long topic | Raw topic history, FTS, rolling summary, recent injection, topic-intent refs and task frame | Summary checkpoint skips a prefix; lossy compression/truncation; small recent window; extraction skips; below-floor refs; missing or stale hook delivery; model fails to use content actually shown | Original message id/text, later ask and answer, summary checkpoint, raw-store presence, exact prompt/hook bytes, active harness and configuration |
| Fact from another topic | Unscoped topic FTS; global semantic entities; explicit migration; episodic theme queries | Automatic assembler never searches TopicMemory; extraction/migration may not create or refresh an entity; lexical vocabulary mismatch; fixed section budgets; no graph expansion or cross-topic identity query at this seam | Source and destination conversation identities, expected link, index inclusion/lag, actual queries/candidates/exclusions and submitted context |
| Email content | Explicit knowledge ingestion, file indexing, relationship channel links, session transcript if retained | No established universal email producer in inspected path; attachment/body/thread completeness unknown; tool result may exist only in a compacted session; sender-name recognition does not fetch their email | Connector/tool call, account and thread/message ids, MIME/body/attachment coverage, durable capture reference, retrieval path and recipient scope |
| Learned from another user or agent | Relationship notes, Threadline logs/resume, MessageStore, explicit playbook sharing and replicated records | Isolated stores; snapshot migration; path-only context; terminal/archive retention; no automatic assembler query; unresolved identity/provenance; private knowledge must not become unrestricted disclosure | Exact original exchange and author identity, local custody, sharing scope, both parties' histories, later recall opportunity, final audience and actual model context |

“Already told you” can indicate custody, extraction, indexing, query selection, retrieval,
assembly, delivery, attention/use, or stale-answer failure. It can also indicate a legitimate
privacy boundary or a user recollection that refers to another agent. The operator's experience
is the outcome to improve; a diagnostic should not assume which layer failed from that phrase.

## 6. Historical evidence, without promoting proposals into implementation

| REPORTED source | What it establishes | What it does not establish |
|---|---|---|
| `docs/PROP-memory-architecture.md:16`, dated 2026-02-28 | The original proposal explicitly diagnosed isolated stores; semantic, episodic and working-memory layers were intended to connect them | Header test counts, review scores, sub-100 ms targets and per-digest cost targets are not measurements of this checkout or guarantees the listed phases landed |
| `docs/specs/semantic-recall-query.eli16.md` | Reported natural-language recall returned zero over 2,852 notes while shorter keyword queries found 7 or 17; the described lexical fix improved the example | This session did not rerun those private queries; reported embedding coverage then is not current corpus coverage; success on an example is not general semantic recall |
| `docs/specs/topic-intent-capture-loop.eli16.md:7` | The store/briefing existed before the extraction producer was wired; the founding drift incident found an empty topic record | Current source now contains capture wiring; the old incident cannot be represented as proof it remains wholly absent |
| `docs/specs/topic-intent-task-context-capture.eli16.md:7` | Remembering facts alone missed “how we are working”; method, audience and goal were added as explicit extraction targets | No measured reduction in operator coherence misses follows from adding fields or shorter decay horizons |
| `docs/specs/PLAYBOOK-CANDIDATE-AUTOSEED-SPEC.md:20` | A reusable-learning consumer was starved by a missing state transition | Not every playbook store was empty, nor does candidate promotion prove useful contextual delivery |
| `docs/specs/grounding-hook-mention-vs-invocation.md` | A rejected 2026-07-28 proposal records false blocks on mentions of relay commands, and rejects shell-text parsing as the true send boundary | Proposed relay relocation was not shipped by that rejected specification; Dawn's actual email/X/reddit implementation remains unavailable |
| `src/server/routes.ts:3040`, `:3128` and the 2.0 rulebook discussion | Source comments report route timeouts, load-related refusal and degraded-gate work; current code has explicit timeout/fail-direction machinery | This audit measured neither present timeout incidence nor gate accuracy; comments saying “fail-open” are not enough to settle configuration-dependent behavior |

## 7. Three executed fixtures

These exercises isolate assembly failures from model capability. Each input is synthetic and
contains no operator conversation content. No files were modified by these executions.

| Fixture | Executed setup | Observed result | Practical limit |
|---|---|---|---|
| F1: crossed summary gap | Real TopicSummarizer; store returns ids 1–250, texts FACT_1–FACT_250; maxMessages 200; model stub records prompt and returns a valid summary | 200 messages processed; FACT_1 absent; FACT_51 present; saved count 250 and lastMessageId 250 | Proves suffix selection/checkpoint mismatch. Does not measure a model's summary quality or an actual missed fact. |
| F2: retrieved body disappears | Real PromptBuildRecall enabled; searchHybrid stub returns one entity named “Travel choice” whose content is “Justin prefers rail for this trip.” | source=fresh, resultsCount=1; rendered block contains “Travel choice” only; preference body absent | Proves field mismatch for normal MemoryEntity shape. A sufficiently informative name could still help. The preference is invented solely for this fixture. |
| F3: semantic availability is not semantic use | Real WorkingMemoryAssembler; semantic search/hybrid spies; prompt “transport preference”; empty results | Six lexical search calls, zero hybrid calls; query terms transport/preference; empty context | Proves this caller's strategy. It does not establish that all 1.x retrieval is lexical. |

Reproduction recipe: use the exact source hashes below, transpile each class with the checkout's
TypeScript compiler to CommonJS/ES2022 and execute in a fresh Node VM. Supply built-in modules,
replace only storage/provider collaborators and provenance helpers, and retain the real method
under test. For F1 implement `getMessagesSinceSummary`, `getTopicSummary`, `getTopicMeta`,
`needsSummaryUpdate`, `saveTopicSummary`, and `getMessageCount` as the synthetic topic store;
capture the evaluate prompt and saved row. The actual cap option is `maxMessagesPerPrompt`.
For F2 implement `searchHybrid` returning the entity shape above and set lastSearchStrategy to
vector-hybrid. For F3 implement both search methods as independent call counters, use the real
characters/4 token estimator, and omit optional episodic/topic-intent/playbook dependencies.
Assert the observations in the table, not a production uptime or accuracy claim.

## 8. Evidence for and against the working hypothesis

**Supporting evidence.** Several real stores contain useful information that never reaches the
active context. Different hooks invoke different windows and argument shapes. Optional retrieval
has both wiring and rendering gaps. A shared, inspectable assembly boundary could expose these
omissions. Existing exact history, lexical search, vectors, episodes, person records, evidence
links and self-knowledge traces offer complementary mechanisms worth comparing in R4.

**Counterevidence and qualifications.**

- No universal read step can recover a message never durably captured, a body already deleted,
  or a detail a lossy extractor omitted when the raw source is not searchable.
- “Semantic index available” does not imply a relevant item was embedded, selected, rendered,
  delivered, or used. Reusing 1.x engines without auditing their callers reproduces the same gaps.
- Not every model call needs autobiographical retrieval. Summarizers, retrievers and reviewers
  themselves make model calls; mandatory recall before each can recurse, duplicate context and
  exhaust budgets. No recursion or amortization experiment was performed here.
- Existing pre-send checks already inspect some history. Another universal reviewer is not a
  demonstrated cure, and the rulebook explicitly records latency, cost and silence failures.
  The correct question includes whether the needed knowledge reached drafting early enough.
- Parallel retrieval is not free: caller-specific identities, privacy filters, score scales,
  freshness and provider quotas differ. More candidates can displace the relevant fact.
- Old knowledge is not necessarily obsolete knowledge. Confidence decay, expiry, summarization
  and archive reclamation must be distinguished from historical retention and current validity.
- A manifest proves inputs, not understanding. A coherence outcome must inspect the answer/action
  against the relevant prior exchange, including omitted qualifications and authorized audience.

These are research findings, not a chosen contract, retriever family or sentinel design.

## 9. Questions to carry to Echo and Justin

For Echo, the orchestrator:

1. Which granted-but-unlanded grounding, actual-context, provider-call and measurement seams will
   be present when Part Twenty-One is built? Use owner paths rather than the brief's mixed part numbers.
2. Can incident examples be traced from capture through the actual provider request, including
   hooks and compaction? Otherwise code gaps cannot be ranked by real user impact.
3. Which 1.x snapshot is the migration target: the commit, these working bytes, installed package,
   or another machine's deployment? Several material findings are in locally changed files.
4. Is universal context accounting the hypothesis, or universal additional model retrieval/review?
   The latter needs to reconcile the rulebook's explicit outbound-review lesson and recursion.
5. Who will provide replayable email and cross-agent intake samples, including missing/partial
   payloads, so R4 can distinguish ingestion from retrieval failures?

For Justin, to be carried by Echo rather than asked during this autonomous round:

1. For each of the four cases, which original exchange and later answer best demonstrate the
   failure, and what should the agent have remembered or done differently?
2. When another person shares something privately, should the agent use it internally while
   withholding the source/detail from other recipients? Which concrete examples define that boundary?
3. Does “the party remembers” mean each agent remembers its own direct exchanges, or should one
   authorized agent also recall exchanges held only by another agent? These require different custody.
4. Which mistakes are most costly: failing to recall, recalling an obsolete fact, or mentioning
   something to the wrong audience? What extra delay is acceptable for a hard historical question?

## 10. Snapshot identifiers and validation boundary

The hashes identify the exact inspected local bytes; they are not claims that those bytes are
committed in 1.x. Full mutable source copies are not included in this research document. A later
reproduction must obtain matching bytes or explicitly report a different snapshot. Other cited
tracked source files were clean in the targeted status check. Installed configuration and live
memory are not pinned by a source commit and were not copied into this branch.

| Working file | SHA-256 |
|---|---|
| `src/memory/SemanticMemory.ts` | `cb4da1131e241f258096d098dcd3f237bc1a9e85f2b41fad8bcd4fba787d8235` |
| `src/memory/MemoryExporter.ts` | `ad399e1c0f0907ece571b19ecae3724952a10e932601903ae6ccdf562fe7a805` |
| `src/core/EvolutionManager.ts` | `52c9155740475a37ed25a652e279659f39408c588dd4002d95fb44ce929367ec` |
| `src/core/MessagingToneGate.ts` | `4d5134c4d105cf528f53dcb8c55b677af975b9ec2e7017cc5a071a28982b24d7` |
| `src/server/routes.ts` | `4ed9647411735d23f239eedbefa1577f9520d27e5001ae57564f645cd7b0f619` |
| `.instar/hooks/instar/session-start.sh` | `55cea2f3ca50f1e7aae225741b93d9dc5bb6ebcb4d27ae4b12ea5b863674c4a7` |
| `.instar/hooks/instar/compaction-recovery.sh` | `2de027b91ac721279a79578a464301946ffbfa453526e146d60e5c22e948abf2` |
| `.instar/hooks/instar/telegram-topic-context.sh` | `7a00d9b4a116904b917299daea98f8c1458d990b89153724a6882027b8a0b256` |
| `.instar/hooks/instar/grounding-before-messaging.sh` | `99ba81dec44324783f76756ee9649589a26419f7204ccd476738285698fd0377` |
| `.instar/scripts/convergence-check.sh` | `d63901cf7110861b2a65a40b5c876902bd972b53e6a4c7ca4bf55db76e8e640a` |
| `.claude/hooks/instar/before-prompt-recall.js` | `c140e06a89ea930484c605afc56db5480c483fe6f4c3d38b0acd4de0f3b7c03b` |
| `src/core/PromptBuildRecall.ts` | `5ceaa92fea24a31b8e3b3df830931966a521d64b65570209cae55610d2ebb1a8` |
| `src/memory/TopicSummarizer.ts` | `5f3449c4a7c7788b6857c85f13af0204b0560480b0c12af981688774bd46f9c0` |
| `src/memory/WorkingMemoryAssembler.ts` | `ea2b411c08e247fdc7076d6c384770588c2f8f8511905c16856e1c84e7a961a5` |

Validation is source inspection, the three bounded fixtures above, citation/path checking and
documentation checks. There is no claim that the full 1.x suite passed, that these are all memory
defects, that the four incidents were reproduced, or that a beyond-human recall system is proven.

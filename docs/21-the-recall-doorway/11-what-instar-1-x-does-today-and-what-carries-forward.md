## 11. What Instar 1.x does today and what carries forward

**Rule — migration starts from a captured inventory, not an optimistic module name.** Rules
7, 33, 44, 45, 46, 69, 89, 90 and 111; **checks: P21-NF-09/11/12/17/18/21**.
The migration target is installed Instar **1.3.1237** plus its installed `.instar/hooks/instar/`
artifacts, identified in [R2 §§1, 8](research/02-dawn-grounding.md). The dirty reading-aid source
checkout at `5b36623a99327e74abe5ef04d63019f9aca6b1c5` is separate; [R1 §10](research/01-instar-1x-memory.md#10-snapshot-identifiers-and-validation-boundary)
pins its inspected mutable files. Unpinned live state and private incidents are not silently
attributed to either snapshot. The rows below cite the 1.x source paths audited in R1, not
landed Instar 2.0 code. Each engine needs an adapter and owner contract audit before migration.

| 1.x mechanism and audited path | Carries forward | Retires or changes |
|---|---|---|
| TopicMemory / `src/memory/TopicMemory.ts:249`, `:485`, `:605` | Raw-history and exact/lexical source adapters; source completeness reporting | Telegram-specific identifiers as universal identity; recent windows as complete memory |
| TopicSummarizer / `src/memory/TopicSummarizer.ts:170–219` | Bounded summary producer with exact processed spans and retained originals | Advancing coverage through unseen prefix; overwriting a summary as if it preserved every original |
| SemanticMemory / `src/memory/SemanticMemory.ts:1043`, `:1602`, `:1760`, `:1950` | Labeled knowledge/relationship candidates, lexical/hybrid retrieval and source-linked supersession | Retriever-owned privacy, mutation-as-history, repeated age decay as truth and hard expiry of unique memory |
| VectorSearch / `src/memory/VectorSearch.ts:1`; EmbeddingProvider / `src/memory/EmbeddingProvider.ts:1` | Replaceable dense backend and embedding producer | Unversioned vector/source coupling, invisible missing embeddings, provider calls outside resource/scope owners |
| MemoryIndex / `src/memory/MemoryIndex.ts:221`, `:304`; Chunker / `src/memory/Chunker.ts:24`, `:102` | File/lexical adapter and chunk-key construction | Navigation offsets presented as immutable evidence spans; body replacement before capture |
| EpisodicMemory / `src/memory/EpisodicMemory.ts:116`, `:167`; ActivityPartitioner / `src/memory/ActivityPartitioner.ts:1` | Episode grouping and derived summaries linked to original activity | Digest treated as full transcript; deletion of unique pending extraction input |
| SessionActivitySentinel / `src/monitoring/SessionActivitySentinel.ts:369`, `:430`, `:647` | Declared background extraction and repair observation | Reusing an entity id without accounting for new content; clearing recovered pending work without storing its result |
| WorkingMemoryAssembler / `src/memory/WorkingMemoryAssembler.ts:75`, `:138`, `:335`, `:548` | Candidate assembly/ranking ideas behind the P21 coordinator | Hidden source omissions, lexical-only behavior labeled general recall, approximate token caps and name-only evidence |
| WorkingSet / `src/memory/WorkingSet.ts:65`, `:105` | Scoped task/lesson candidates | Pointer-only inclusion counted as body consumption; bypass of playbook provenance/quarantine |
| PromptBuildRecall / `src/core/PromptBuildRecall.ts:128`, `:219`, `:239` | Budgeted prompt-retrieval adapter ideas, source health and explicit optional capabilities | Content/description mismatch; prompt-prefix-only cache; timeout without residual-work accounting; optional hook as sole enforcement |
| KnowledgeManager / `src/knowledge/KnowledgeManager.ts:45`, `:159`, `:181` | Captured knowledge documents, searchable catalog and original-body lookup | Metadata replication as proof of body custody; deletion of unique document bodies |
| RelationshipManager / `src/core/RelationshipManager.ts:161`, `:175`, `:783` | Person notes/arcs as labeled derived candidates plus original-exchange lookup | Name-only channel identity resolution and recognition treated as permission |
| SelfKnowledgeTree / `src/knowledge/SelfKnowledgeTree.ts:94`; TreeTraversal / `src/knowledge/TreeTraversal.ts:207` | Traceable bounded recursive-source adapter for capability/state and eligible history | Assuming its present source selection already searches every conversation |
| Playbook / `playbook-scripts/playbook-assemble.py:79`, `:157`; `playbook-retirement.py:68`; `playbook-mount.py:1` | Declared scoped lesson selection, quarantine, retained metadata and explicit shared snapshots | Integrity fallback silently treated as verification; unretained path bodies; automatic sharing by name |
| Learnings / `src/core/EvolutionManager.ts:1165`, `:1187`, `:1247` | Case-linked procedural lesson producer and evaluated use | Pruning unique lessons or treating registry insertion as semantic delivery |
| MemoryMigrator / `src/memory/MemoryMigrator.ts:71`, `:142`, `:463`; MemoryExporter / `src/memory/MemoryExporter.ts:125`, `:196`, `:213` | Versioned source import and disposable served export | One-time source-key dedup that misses later edits; nonempty partial export replacing uncaptured unique memory |
| MessageStore / `src/messaging/MessageStore.ts:1`; ThreadLog / `src/threadline/ThreadLog.ts:1`, `:474`, `:522`; ConversationStore / `src/threadline/ConversationStore.ts:220` | Direct/indirect exchange sources, stable message identity, cold history and authorized resume | Count/hash-only retention as an archive; assuming every store reaches the principal context |

These dispositions follow [R1 §§3–4](research/01-instar-1x-memory.md) and the targeted installed
recheck in [R2 §8](research/02-dawn-grounding.md#8-comparison-with-the-installed-1x-target).
They are proposed migration semantics, not a claim those changes have been executed.

**Rule — structural composition replaces inconsistent injection paths.** Rules 1, 30, 44,
47, 66, 78, 96 and 110; **checks: P21-NF-03/05/10/17/21**. Topic-intent briefings,
session-start history, compaction hooks, ArcCheck and tone/grounding hooks currently use different
windows, parameters and contexts ([R1 §4](research/01-instar-1x-memory.md#4-injection-and-outgoing-grounding-the-actual-boundaries)).
Useful task/arc evidence becomes declared retriever/producer input. Shell-text matching and a
prompt reminding the agent to search retire as the enforcement boundary. Harness adapters
deliver one governed context contract at initial start and later inputs; outgoing consumers
validate the exact message/effect. No harness name branch belongs in the core.

Existing installed hooks and callers retire only after their replacement consumers, startup,
resume/compaction paths and migrations pass the appropriate real lifecycle tests. Replacing an
optional service without its caller preserves the original defect. The missing continuity seam
means complete post-compaction activation remains inhibited rather than declared migrated.

**Rule — the three executed failures become permanent regressions.** Rules 34, 44, 45,
70 and 111; **checks: P21-NF-05/09/11/17**. The recorded installed baseline is
[installed-baseline-results.json](research/fixtures/installed-baseline-results.json), executed
at `2026-09-12T21:28:56.178Z` with real installed methods and synthetic collaborators, no model
provider or production-state mutation. [The permanent regression contract](fixtures/legacy-regressions.json)
retains those observed results and separate post-migration expectations; it does not replace
the historical failures with invented passing output.

| Permanent case | Recorded failure | Required migration oracle |
|---|---|---|
| P21-REG-F1 | 250 new messages; prompt contains 200, missing first 50; saved count/last id both 250 | Every original remains recoverable; summary coverage names exactly consumed spans and leaves the prefix pending until processed |
| P21-REG-F2 | Hybrid result count 1, fresh source and entity name present; actual preference body absent | Preference body, speaker and source reach actual submitted context, or exclusion is explicit with degraded disposition |
| P21-REG-F3 | Working assembler makes six lexical calls and zero hybrid calls for the installed fixture | The declared dense/hybrid arm is actually invoked on the lexical-mismatch repair variant and its evidence reaches input; a lexical-only arm reports itself honestly |

Run original baseline observations against hash-matching installed artifacts, then run repair
variants through P21 unit, integration and lifecycle paths. A different package version is a
new labeled baseline, not a reproduction of 1.3.1237. F3 does not require dense search on every
turn or declare the old empty stub a semantic accuracy test. Each case also tests zero match,
deadline, budget boundary, source outage and actual renderer/submission behavior. Future tests
may never be skipped merely because a replacement engine uses a different internal method.

**Rule — migration is additive and restartable.** Rules 7, 32, 33, 44, 45 and 90;
**checks: P21-NF-11/17/18**. Enumerate all installed stores, scripts, hooks, producers,
consumers and per-machine schema versions; capture originals before conversion. A dry run maps
every input to an imported record or explicit inert/unavailable disposition. Origin, known
identity, missing attribution and old expiry remain historical data, not new authority. Import
checkpoints bind source hashes and versions; reruns do not duplicate a source, while changed
source content creates another preserved version. Rebuild indexes, compare permitted retrieval
and original reconstruction, then switch the declared consumer binding. Rollback restores the
prior consumer against retained compatible sources; it neither deletes new history nor replays
uncertain external effects. No email/agent completeness claim is made before its owner trace.

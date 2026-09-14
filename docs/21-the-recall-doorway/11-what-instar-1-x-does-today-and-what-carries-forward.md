## 11. What Instar 1.x does today and what carries forward

**Rule — migration starts from a captured inventory, not an optimistic module name.** Rules
7, 33, 44, 45, 46, 69, 89, 90 and 111; **checks: P21-NF-09/11/12/17a–j/18/21**.
The migration target is installed Instar **1.3.1237** plus its installed `.instar/hooks/instar/`
artifacts, identified in [R2 §§1, 8](research/02-dawn-grounding.md). The dirty reading-aid source
checkout at `5b36623a99327e74abe5ef04d63019f9aca6b1c5` is separate; [R1 §10](research/01-instar-1x-memory.md#10-snapshot-identifiers-and-validation-boundary)
pins its inspected mutable files. Unpinned live state and private incidents are not silently
attributed to either snapshot. The rows below cite the 1.x source paths audited in R1, not
landed Instar 2.0 code. The correction/preference lifecycle, replicated knowledge, relationship and learning, customized
context and surrounding source-family audits below also read current 1.x source and applicable installed hooks directly;
they do not claim an installed-method execution. Each engine needs
an adapter and owner contract audit before migration.

| 1.x mechanism and audited path | Carries forward | Retires or changes |
|---|---|---|
| TopicMemory / `src/memory/TopicMemory.ts:249`, `:485`, `:605` | Raw-history and exact/lexical source adapters; source completeness reporting | Telegram-specific identifiers as universal identity; recent windows as complete memory |
| TopicSummarizer / `src/memory/TopicSummarizer.ts:170–219` | Bounded summary producer with exact processed spans and retained originals | Advancing coverage through unseen prefix; overwriting a summary as if it preserved every original |
| SemanticMemory / `src/memory/SemanticMemory.ts:1043`, `:1602`, `:1760`, `:1950` | Labeled knowledge/relationship candidates, lexical/hybrid retrieval and source-linked supersession | Retriever-owned privacy, mutation-as-history, repeated age decay as truth and hard expiry of unique memory |
| Semantic citation evidence / `src/memory/SemanticMemory.ts:982–999`, `:1208–1347`; `src/memory/EvidenceRenderer.ts:113–145`; `src/server/routes.ts:5625–5699` | Separate typed support rows, journal actions, producers and both direct/inverse citation consumers; per-evidence restrictions survive independently of entity text | Entity-only export/rebuild as full evidence recovery; body text as fabricated support; full disposition, field mapping and P21-REG-EVIDENCE below |
| VectorSearch / `src/memory/VectorSearch.ts:1`; EmbeddingProvider / `src/memory/EmbeddingProvider.ts:1` | Replaceable dense backend and embedding producer | Unversioned vector/source coupling, invisible missing embeddings, provider calls outside resource/scope owners |
| MemoryIndex / `src/memory/MemoryIndex.ts:221`, `:304`; Chunker / `src/memory/Chunker.ts:24`, `:102` | File/lexical adapter and chunk-key construction | Navigation offsets presented as immutable evidence spans; body replacement before capture |
| EpisodicMemory / `src/memory/EpisodicMemory.ts:116`, `:167`; ActivityPartitioner / `src/memory/ActivityPartitioner.ts:1` | Episode grouping and derived summaries linked to original activity | Digest treated as full transcript; deletion of unique pending extraction input |
| SessionActivitySentinel / `src/monitoring/SessionActivitySentinel.ts:369`, `:430`, `:647` | Declared background extraction and repair observation | Reusing an entity id without accounting for new content; clearing recovered pending work without storing its result |
| WorkingMemoryAssembler / `src/memory/WorkingMemoryAssembler.ts:75`, `:138`, `:335`, `:548` | Candidate assembly/ranking ideas behind the P21 coordinator | Hidden source omissions, lexical-only behavior labeled general recall, approximate token caps and name-only evidence |
| WorkingSet / `src/memory/WorkingSet.ts:65`, `:105` | Scoped task/lesson candidates | Pointer-only inclusion counted as body consumption; bypass of playbook provenance/quarantine |
| ContextHierarchy / `src/core/ContextHierarchy.ts:143–233`, `:248–378`; public readers `src/server/routes.ts:7970–7986`, `:8090–8101`; installed `.instar/hooks/instar/session-start.sh:447–455` | Capture customized `.instar/context/` segment bodies, source identities and trigger/tier metadata; retain direct segment readers and the startup consumer until replacements pass | Distinguish regenerable `DISPATCH.md` from unique segment text; listing a path or printing dispatch instructions is not body delivery. P21-REG-CONTEXT below covers migrated and retained-owner paths. |
| PromptBuildRecall / `src/core/PromptBuildRecall.ts:128`, `:219`, `:239` | Budgeted prompt-retrieval adapter ideas, source health and explicit optional capabilities | Content/description mismatch; prompt-prefix-only cache; timeout without residual-work accounting; optional hook as sole enforcement |
| KnowledgeManager / `src/knowledge/KnowledgeManager.ts:45`, `:159`, `:181` | Captured knowledge documents, searchable catalog and original-body lookup | Metadata replication as proof of body custody; deletion of unique document bodies |
| KnowledgeReplicatedStore / `src/core/KnowledgeReplicatedStore.ts:328`, `:496`, `:530`; `src/commands/server.ts:12241–12295` | Address-or-title plus type identity, surviving concurrent catalog variants, deletion-aware served views and escaped foreign metadata | Local ids/paths as cross-machine identity; metadata transfer or the local-only, unused union reader as proof of peer body custody or context delivery |
| RelationshipManager / `src/core/RelationshipManager.ts:161`, `:175`, `:783` | Person notes/arcs as labeled derived candidates plus original-exchange lookup | Name-only channel identity resolution and recognition treated as permission |
| RelationshipsReplicatedStore / `src/core/RelationshipsReplicatedStore.ts:409`, `:578`, `:618`; `src/commands/server.ts:5098–5130`, `:6976–6992` | Channel-set identity keys, surviving concurrent variants, tombstone-aware served views and escaped foreign context; separate peer-read consumer | Local universally unique identifier (UUID) as cross-machine identity; interpreting the local-only loader or wired helper as actual peer injection; merging imported people into authenticated principals |
| SelfKnowledgeTree / `src/knowledge/SelfKnowledgeTree.ts:94`; TreeTraversal / `src/knowledge/TreeTraversal.ts:207` | Traceable bounded recursive-source adapter for capability/state and eligible history | Assuming its present source selection already searches every conversation |
| Playbook / `playbook-scripts/playbook-assemble.py:79`, `:157`; `playbook-retirement.py:68`; `playbook-mount.py:1` | Declared scoped lesson selection, quarantine, retained metadata and explicit shared snapshots | Integrity fallback silently treated as verification; unretained path bodies; automatic sharing by name |
| Learnings / `src/core/EvolutionManager.ts:1165`, `:1187`, `:1247` | Case-linked procedural lesson producer and evaluated use | Pruning unique lessons or treating registry insertion as semantic delivery |
| LearningsReplicatedStore / `src/core/LearningsReplicatedStore.ts:373`, `:557`, `:591`; `src/commands/server.ts:12140–12160` | Content-anchored identity, surviving concurrent advisory variants, tombstone-aware views and escaped foreign learning body; journal-backed union reads | Local learning id as cross-machine identity; treating the available union/renderer as an already wired session-context consumer; promoting a peer lesson to authority |
| PreferencesManager / `src/core/PreferencesManager.ts:39–90`, `:133–179`, `:309–403` | Captured learned-guidance records, correction-loop provenance, observation time, confidence and recurrence metadata; bounded advisory context | In-place upserts as a complete correction history; `count` as proof every preference was delivered; learned hints as authority |
| CorrectionCaptureLoop / `src/monitoring/CorrectionCaptureLoop.ts:306–429`; CorrectionLedger / `src/monitoring/CorrectionLedger.ts:330–415`; CorrectionAnalyzer / `src/monitoring/CorrectionAnalyzer.ts:143–209`; CorrectionLoopDriver / `src/monitoring/CorrectionLoopDriver.ts:186–480` | Scrubbed correction evidence, bounded occurrence analysis, durable route clusters and finite rechecks, connected to the real preference consumer | Optional capture as complete intake; discarded unique pending evidence; route reservation or disk presence as proof of application, use or effectiveness |
| Record-time class review / `src/monitoring/CorrectionClassReview.ts:66–128`, `:130–269`; `src/monitoring/ClassReviewStore.ts:44–70`, `:150–235`; `src/core/ClassReviewReplicatedStore.ts:113–141`; `src/monitoring/CorrectionInstanceFixGate.ts:22–41` | Independent standards/process review of a recorded correction, durable pending/filled state, bounded recovery, retained overdue obligations and advisory peer evidence; correspondence-bound linked-action admission | Recurrence threshold as a prerequisite for this branch; filled review as completed repair; peer disposition as local approval; callback or partial artifact linkage as complete recovery. Destination and requested owner seam are specified below. |
| SelfViolationDetector / `src/monitoring/SelfViolationDetector.ts:81–114`; `src/server/routes.ts:3396`, `:3554–3593` | Observe-only matched-pattern evidence feeding later analysis, with explicit guidance and context links in the replacement | Treating a heuristic match as confirmed violation, an unawaited observation as delivery proof, or the prefixed observation hash as the original preference key |
| PreferencesReplicatedStore / `src/core/PreferencesReplicatedStore.ts:305–367`; server composition / `src/commands/server.ts:5047–5078` | Union semantics preserve concurrent non-deleted variants as advisory candidates; retained origin/conflict evidence | Assuming the inspected local-only loader proves peer delivery; suppressing all hints while optional conflict cleanup waits |
| Preference context route / `src/server/routes.ts:24588–24666`; installed `.instar/hooks/instar/session-start.sh:149–176` | Configured source precedence and bounded rendered preference body reaching session start | Silent hook skip as successful recall; replacing the store without migrating the route and actual context consumer |
| MemoryMigrator / `src/memory/MemoryMigrator.ts:71`, `:142`, `:463`; MemoryExporter / `src/memory/MemoryExporter.ts:125`, `:196`, `:213` | Versioned source import and disposable served export | One-time source-key dedup that misses later edits; nonempty partial export replacing uncaptured unique memory |
| MessageStore / `src/messaging/MessageStore.ts:1`; ThreadLog / `src/threadline/ThreadLog.ts:1`, `:474`, `:522`; ConversationStore / `src/threadline/ConversationStore.ts:220` | Direct/indirect exchange sources, stable message identity, cold history and authorized resume | Count/hash-only retention as an archive; assuming every store reaches the PRINCIPAL context |

These dispositions follow [R1 §§3–4](research/01-instar-1x-memory.md) and the targeted installed
recheck in [R2 §8](research/02-dawn-grounding.md#8-comparison-with-the-installed-1x-target).
They are proposed migration semantics, not a claim those changes have been executed.

**Rule — customized context bodies survive separately from their dispatch instructions.**
Rules 7, 33, 44, 45, 47, 69, 89, 95 and 111; **checks: P21-NF-05/17a–j/21**.
A context segment here is a persisted Markdown file with one topic of guidance. A dispatch
table maps task triggers to those files; it is navigation, not their contents. These are
read-only 1.x source observations, independent of the installed-method baseline executions.

`src/core/ContextHierarchy.ts:143–233` declares eleven segments: identity, safety and project
at tier 0 (intended always-loaded context); session and relationships at tier 1 (intended
session-boundary context); development, deployment, communication, architecture,
research-navigation and conversational-actions at tier 2 (task-triggered context). These tier
numbers describe context loading, separately from the supervision levels in section 6.
`initialize()` creates only missing segment files, deliberately preserving custom bodies
(`:248–267`). It always calls `writeDispatchTable()`, which rebuilds `DISPATCH.md` from the
declared segment/trigger metadata (`:291–329`). Regenerating that table cannot reconstruct a
custom session procedure, relationship note, development lesson or communication preference.

`loadTier()` reads files cumulatively through the requested tier, trims bodies, applies its
content filter and silently skips missing/read-failed files (`:337–355`). `loadSegment()`
returns an individual declared segment's raw body or null for an unknown/missing/unreadable
segment (`:361–378`). `listSegments()` reports existence, byte size, path and stat errors;
it does not read bodies into a model (`:392–417`). The inspected `src/` callers use
`loadSegment()` for the public body reader; no production caller of `loadTier()` appears in
that tree. Do not treat the cumulative reader's availability as automatic injection.

A separate exported reader, `checkDeclaredIdentityDirectory()` (`ContextHierarchy.ts:81–140`),
reads the persisted identity segment's declared directory and compares its absolute, real
filesystem path with the directory resolved at boot. Missing/unreadable declaration returns
`not-declared`; an invalid declaration produces a startup warning, not a startup refusal
(`src/commands/server.ts:3730–3737`). Retain this current-path validation with its owner; an
imported historical path cannot replace the current boot binding. Include matching, moved/stale
and unavailable identity-directory controls without treating a warning as model-body delivery.

Production constructs and initializes this source at `src/commands/server.ts:16306–16315`.
`GET /context` lists segment metadata; `GET /context/dispatch` returns trigger mappings
(`src/server/routes.ts:7970–7986`). `GET /context/:segmentId` serves the actual Markdown
body, with 404 for null and 501 for an uninitialized hierarchy (`:8090–8101`); the other two
routes also return 501 when uninitialized. The installed session-start hook prints
`context/DISPATCH.md` when that file exists inside its server-running branch
(`.instar/hooks/instar/session-start.sh:447–460`). It does not load the named segment bodies
in that block. The table's claim of automatic loading and a successful route response are
not evidence that any particular model received or used a segment.

P21-A2 captures every available customized body before initialization, regeneration or consumer
replacement, including additional installed files outside the default list. Retain exact bytes,
source path/id, hash, origin, available edit/source evidence and tier/trigger metadata. An
unlisted file is retained with explicit reader coverage, never silently discarded or counted
as loaded by the default readers. Capture the dispatch artifact for audit, but treat its
regeneration as a metadata view; preserve any unique local edits before replacing it. Missing
or inaccessible originals remain unavailable; fresh templates cannot impersonate them.

Identity, safety, organization and execution instructions remain with their existing governance
and assembly owners. Their capture is historical evidence, not a new instruction grant.
Eligible contextual notes can migrate to the scoped recall source under P21-A1/A2; each retained
owner reader must instead be explicitly bound into the same actual-context accounting. Replace
or retain the metadata routes, body route, direct-file callers and installed startup/compaction
consumers together. The dispatch-only hook may retire only when the corresponding governed
awareness and body-delivery paths pass; ordinary reachability retains its declared fail direction.

P21-REG-CONTEXT seeds distinct customized session, relationships, development and communication
bodies, with markers absent from their templates and from `DISPATCH.md`. Capture/import twice,
restart and regenerate the dispatch view; assert exact body/hash and attribution preservation.
Exercise both an eligible migrated note and an explicitly retained-owner instruction through
real production initialization, scoped public/direct readers and actual provider-input capture.
At initial start, resume and compaction, test the declared session-boundary bodies; for development
and communication, use matching task triggers and a nonmatching-trigger control with an explicit
not-requested disposition. Assess later behavior separately from submitted-body evidence.

Remove a segment, fail its read, disable/unwire its source or replacement consumer, remove the
dispatch file, and supply only a template or metadata response in paired controls. Record the
precise missing/disabled/excluded source and delivery status; no dispatch text, path, byte count,
200 response or generated default can satisfy the customized-body positive. Preserve accessible
originals and reachable status. Rollback restores the previous readers against retained compatible
bodies without losing newly admitted evidence. This NF-17a–j/21 positive is **non-executable until
`seam-response-recall-doorway-grants.md` lands for the complete section 14 dependencies,
including row 94's source/consumer lifecycle, the inherited current-context and continuity
grants named there, `seam-response-declarations.md` row 77, and P21-A1/A2**. It adds no owner
type or ungranted action; retained-owner duties stay with their owners.

**Rule — typed citation evidence survives independently of entity text.** Rules 7, 28, 33,
44, 45, 89, 90 and 95; **checks: P21-NF-05/06/11/12/17a–j/18/21**.
A citation is a recorded link from a remembered claim to a particular source; it is not proof
that the source exists, is accessible now, or supports the claim. An inverse citation lookup
asks which remembered claims cite a given source kind and source id. The following are read-only
1.x source observations under `/Users/dabombstudio/.instar/agents/echo`, not 2.0 type exports
or evidence of a deployed successful recall.

**Storage and writers today.** `src/core/types.ts:7654–7744` defines `MemoryEvidence` with
ten source kinds: feedback, commit, session, document, message, job-run, ledger-entry,
pattern-entity, external-url and supersedes-evidence. It records source id, optional path,
inclusive line bounds/freeform line range, contribution weight, source confidence, privacy tier,
annotation and update time. `SemanticMemory.ts:982–999` stores these in `entity_evidence`,
with a separate evidence-row id and entity id and indexes for entity and source lookup.
Evidence has its own privacy restrictions even when the entity's text is more widely visible.
Ordinary recall/hybrid search does not eagerly load it (`src/core/types.ts:7640–7647`).

`SemanticMemory.ts:1208–1278` transactionally creates an entity with evidence or appends rows
and writes consolidated `rememberWithEvidence` or `addEvidence` journal actions, retaining the
producer label. The first action contains the entity payload; the second references an existing
entity. These are SQLite transactions, not a transaction spanning SQLite and the journal:
`SemanticMemory.ts:904–914` appends the journal separately and silently catches a write failure without
rolling back the database. The database has evidence ids; the journal carries evidence values,
not those generated row ids (`:1233–1237`, `:1276`, `:1411–1425`). Import must reconcile both
sources without either losing journal-only evidence or counting a dual write twice.

The process-internal producer allowlist, caps and shape checks are at `:1351–1469`,
`:2530–2540`, `:2592–2602`. Evidence may narrow, never widen, the entity's privacy. The normal
cap is 50 rows, configurable from zero through 500; notes have a 500-byte cap. Weights and
confidence have separate 0–1 meanings. The supersedes guard rejects a self-reference and caps
supersedes rows at 32; it is not a proof that an arbitrary multi-entity graph is acyclic.
A producer name is an internal calling convention, not an authenticated cross-process principal.
The `manual` owner check remains unimplemented in that allowlist's comment; P21 must not
inherit it as current authorization.

| Producer or reader | Actual 1.x behavior | Preserve / change / retire disposition |
|---|---|---|
| `src/core/EvolutionManager.ts:561–644` | Optional semantic bridge creates a pattern entity, seeds recognized `feedback:` support, and appends cluster evidence; unrecognized sources can yield no evidence and creation failure can leave only the proposal. | Preserve proposal/cluster links and each support row as distinct retained evidence; change missing bridge/source to explicit coverage; retire a cluster body or successful proposal write as proof of citation custody. |
| `src/core/DispatchExecutor.ts:240–321` | Optional decision emission links cluster pattern, dispatch ledger, prior runs and prior decision entities; emission failure is caught. | Preserve those exact kinds and links; change to registered evidence production through P21-A2 and current owner admission; retire a decision record as proof that dispatch happened. |
| `src/core/DecisionJournal.ts:294–376` | Requires nonempty evidence; optional semantic bridge returns an entity link, propagates policy errors, but falls back to a journal-only row on other bridge errors. | Preserve the separate decision journal, embedded evidence and available entity link; reconcile interrupted cross-store writes; retain absent linkage as unknown. Never discard a journal-only decision or synthesize its original exchange from the decision text. |
| `src/core/LearnSkillBridge.ts:76–150`, `:187–239`; `src/server/routes.ts:23512–23611` | Derives session-shaped references or an inline-message hash and short note; exposes feedback/commit references and pending document fallback separately. The route returns derived/explicit evidence, but does not pass that array to `addLearning` or write it to `entity_evidence`. | Preserve available response captures and explicit source evidence; change the producer to durable, resolved source linkage. Retire response-only evidence and an inline hash as proof of original-message custody; a missing response/capture stays missing. Do not assume the declared LearnSkill producer is a wired semantic writer. |
| `src/commands/memoryBackfillEvidence.ts:112–202` | Recognizes only an entire HTTP(S) address in the legacy source field; writes `external-url` evidence with inherited privacy and confidence 0.5. Other source strings are skipped. Its default private-scope duplicate check cannot see sensitive evidence. | Preserve backfill origin and uncertainty, including historical duplicates; change duplicate detection to a restricted complete import inventory. Retire URL-pattern recognition as proof of retrieved support and never derive support from entity prose. |
| `src/memory/SemanticMemory.ts:1286–1347`; `src/memory/EvidenceRenderer.ts:78–145` | Direct eager and inverse reads check entity visibility and evidence tier; bare evidence reads/array helpers check the evidence tier only and need a separately authorized parent. Undefined evidence means not loaded; an empty array means loaded with no visible rows. | Preserve both filters, lazy/empty distinction and source-kind/id lookup. Replace the numeric-tier decision with the section 5 current source owner at every boundary; no bare helper or cached entity may bypass parent authorization. |
| `src/server/routes.ts:5625–5699` | `/memory/evidence/by-entity/:id` returns filtered evidence; hidden/missing entities both yield 404. `/memory/entities/by-evidence` filters inverse matches and their count. Unwired memory yields 503. Recognized viewer scopes narrow the route's default private view; invalid/missing scope also defaults to private (`:5609–5621`). | Preserve the two actual citation consumers and non-disclosing hidden/missing response; migrate both with the producer. Resolve requester, use, provider and recipient permissions from owners, never a query string or legacy private default. No claim of general per-user authorization follows from these routes. |

The evidence vocabulary orders public, shared-project, private and sensitive separately from
entity shared-project/shared-topic/private. Shared-topic maps conservatively to private on the
evidence scale; no existing viewer scope reaches sensitive (`EvidenceRenderer.ts:41–97`).
Migration must preserve that restriction, not coerce sensitive to private or drop a row's tier
because its parent is shared. These tiers alone do not identify actual people or topics.

**Recovery today.** `SemanticMemory.ts:2071–2166` exports/imports entities and edges without
the evidence table; `writeSnapshot()` uses that export (`:2301–2313`). The journal recovery
switch at `:2209–2259` handles remember/connect/forget/verify/supersede, but not
`rememberWithEvidence` or `addEvidence`. Rebuild deletes entities (`:2281–2294`), which also
cascades to evidence rows under the table's foreign key. Thus reopening an intact database
can retain evidence while rebuilding through this legacy path cannot establish full evidence
recovery. Retire that incomplete rebuild/export as a lossless migration route. Capture the
consistent database including evidence, journal actions and decision journal separately before
conversion; never run destructive legacy rebuild as the way to obtain the import inventory.

**Field mapping into retained records.** P21-A2 owns versioned imported citation records under
section 1's package-record discipline. Two owns admitted facts and original captures,
not a new `MemoryEvidence` constitutional type. Its existing fact schema and owned-body
registration remain unchanged (`src/facts/contracts.ts:10–18,35–67`, a **2.0 destination**;
`docs/06-the-fact-envelope.md:96–177`, “The envelope every fact carries”). The register grants and P21 implementation must declare
these records before admission. Each imported record points to its captured legacy bytes;
an unresolved legacy source id is historical data, not a fabricated admitted reference.

| Legacy field or distinction | Required retained mapping and current read |
|---|---|
| Database evidence id and entity id; journal action/position and producer | Preserve origin-scoped aliases, source artifact hash and row/action position, entity-version link and producer observation. Reconcile duplicate database/journal representations with evidence; ambiguous correspondence stays explicit. Rerun from the same captured input admits no duplicate; changed source bytes create a new version. |
| `kind`, `sourceId`, `path`, `lineStart`, `lineEnd`, `lines` | Preserve exact values and missing fields. Resolve to authorized original capture/span only where supported. A path or line number without pinned original bytes remains a locator, not a verified span. Maintain bounded entity-to-citation and kind/id-to-entity projections. |
| `weight`, `confidence`, `note`, `updatedAt` | Preserve contribution versus claimed source confidence, full qualification/annotation and historical update time, separately from import/admission time. No score becomes truth, an independent grade, or proof that a source was read. |
| Parent `ownerId`/`privacyScope` and row `privacyTier`, including absent tier | Retain both original policies and inheritance explicitly. Current reads require the parent's permission AND the evidence row's restriction AND the referenced source's permission for the proposed use. Unresolved owner/policy mapping prevents exposure; it does not delete the capture. Preserve sensitive restrictions and recheck after policy change or cache reuse. |
| Loaded/empty, filtered, missing source and supersedes link | Record loading and coverage separately from citation content. Supersession retains original evidence and its origin, not a destructive edit. A visible claim can have unavailable or forbidden support; disclose neither restricted row existence nor inverse-hit counts to an unauthorized reader. |

**Migration fixture P21-REG-EVIDENCE.** In isolated stores, create a shared-project claim with
one real supported citation, a second private citation and a sensitive citation; retain the
original support captures with different qualifications and locations. Add an entity with no
support and another with a dangling source reference. Exercise create-with-evidence and append,
the actual proposal/dispatch/decision producers and the learning/backfill limits above. Capture
all source stores, import twice, restart, rebuild only the new derived indexes, and read again.
Assert field/annotation/time fidelity and one reconciled imported identity per known row/action;
include journal-only, database-only and interrupted bridge neighbors without invented links.

Drive both replacement HTTP citation consumers through production initialization. A permitted
private read sees shared and private support but not sensitive support; a shared-project read
sees only its permitted row. Hidden and absent parents remain indistinguishable. An inverse
lookup finds a visible entity only through a permitted matching citation; a private-only match
must not leak that entity or a count to the shared viewer. Then change current permission and
repeat through cache/restart. Missing support and no-support remain explicit, never inferred
from a plausible entity body or from backfilled URL text. Verify the historical snapshot and
legacy journal alone are insufficient inputs where they omit required rows.

Finally, an actual PRINCIPAL recall must load the permitted original citation and its
qualification into captured provider input, and the later response must use that support
correctly. A name-only candidate, a route returning 200, or preserved entity prose cannot pass;
delivered-but-ignored support is a reader-use failure. Run unit, public-pipeline and production
lifecycle tiers, including two origins with colliding local ids and incomplete peer custody.
This migration positive is **non-executable until `seam-response-recall-doorway-grants.md`
lands for NF-17a–j/18/21's full section 14 dependencies, `seam-response-declarations.md` row 77
lands with governed recall-owner enrollment, and P21-A1/A2 land**. Existing grants supply
custody, scope and consumer composition; no owner union is redefined and no repaired execution
is claimed.

**Rule — corrections retain the lifecycle that produces and maintains guidance.** Rules 7,
24, 26, 33, 44, 45, 55, 85, 86 and 89; **checks: P21-NF-05/11/12/17a–j/18/21**.
The paths in this audit are read-only 1.x sources under
`/Users/dabombstudio/.instar/agents/echo`. A correction is a captured user observation;
distillation is a model's proposed lesson from it. Recurrence is repeated supporting evidence,
not a new instruction or permission. A route cluster is the durable set of correction keys
processed together; reopening starts another bounded observation period for that set.

**Capture and scrubbing today.** `src/commands/server.ts:14976–14998`, `:15121–15161`
wires capture to Telegram's message-log callback only when shared intelligence exists and
`monitoring.correctionLearning.enabled` is true. The deterministic classifier supplies the
signal and its weight; user messages with a learning signal trigger distillation, while agent
turns supply marked context only. `CorrectionCaptureLoop.ts:62–117`, `:306–358` keeps a
bounded in-memory topic window and skips missing-topic, load-shed and rate-limited cases.
Its prompt scrubs and truncates each turn, escapes it as untrusted data, and instructs the
model to learn only from user turns (`:138–167`). Parsing validates the result kind and scrubs
the lesson and summary again (`:181–208`). `src/monitoring/scrubSecrets.ts:23–40` replaces
recognized credential patterns; it is not proof that arbitrary private information is removed.

Capacity failures can retain pre-scrubbed turns in the optional durable backlog; other provider
faults, malformed/noise output, missing backlog or failed enqueue can leave no ledger entry
(`CorrectionCaptureLoop.ts:360–429`). `src/monitoring/CorrectionCaptureBacklog.ts:143–223` scrubs on enqueue,
deduplicates matching topic/turn snapshots and evicts oldest entries at its cap. Draining records
successful lessons, deletes completed/noise rows and eventually drops exhausted or expired rows
(`CorrectionCaptureLoop.ts:482–550`; `CorrectionCaptureBacklog.ts:269–312`). Server defaults are
200 entries, a maximum-retry setting of three, 24-hour retention and five entries per drain; success/noise
and a five-minute timer trigger draining (`server.ts:15026–15035`, `:15059–15085`, `:15154–15170`).
These paths preserve some throttled captures, not every correction or complete original history.

**Ledger and analysis today.** `CorrectionLedger.ts:284–321`, `:330–415` keys records by
kind plus a hash of normalized lesson tokens, assigns machine-scoped ids, and retains scrubbed
lesson/summary, counts, times, deterministic weight, advisory confidence and available topic/session
metadata. Repeats increment counts and update the latest detection time without resetting lifecycle
state. The occurrence table retains at most 200 rows per key by default; older occurrence details
may therefore be absent despite a larger lifetime count. Its diversity calculation uses retained
qualifying rows, with a legacy session fallback and unknown sessions not counted
(`:543–583`). It does not store raw conversation. The public view omits lesson text, session
identity and route-cluster identity (`:612–621`). Callers must scrub before `record()`; the
ledger itself does not perform that pass.

`CorrectionAnalyzer.ts:83–128`, `:143–209` groups open, non-noise records of the same kind
without changing their exact keys. Every pair must meet the token-overlap threshold, default
0.65: overlap means distinct shared tokens divided by distinct tokens in either lesson.
Only occurrences meeting the deterministic-weight threshold count; its default is 3
(`src/monitoring/HumanAsDetectorLog.ts:136`). Preference defaults require four qualifying occurrences across
at least two calendar days and two distinct sessions. Infrastructure-gap defaults require four
across three days; cross-agent consensus is left to downstream feedback, not established here.
Topic diversity is reported, not required. High model confidence alone cannot cross the gate.

The shipped `src/scaffold/templates/jobs/instar/correction-analyzer.md:1–16`, `:25–35` is a
weekly job, disabled in its template, that calls `POST /corrections/analyze` and asks a model
supervisor to sanity-check routed lessons. Source existence does not prove a deployed schedule
ran or that supervision occurred. `src/server/routes.ts:25591–25718` requires a wired ledger,
constructs the analyzer, preference writer and driver, then routes and runs verification.
Its `verified` response counts evaluated records, including inconclusive/reopened outcomes;
even an analysis error can return status 200. Neither number nor status proves effectiveness.

**Routing and rechecks today.** `CorrectionLoopDriver.ts:211–271` atomically marks every
cluster member acted-on and saves route/window state before attempting the destination. A stale
member version prevents the entire transition (`CorrectionLedger.ts:490–526`). A preference
without a policy-relaxation keyword match reaches `recordPreference`; a match routes to human
attention. Infrastructure gaps become tracked actions and draft initiatives by default, or
use the guarded local feedback route when `autoFeedback` is true (`:273–329`). The driver has
no authority to change policy. These are route choices, not evidence that the classification
was correct or the destination acted. Production composition even supplies fallback return
values when the action/initiative dependency is absent (`routes.ts:25663–25674`).

Routing is bounded, default five per tick. Overflow remains open; a feedback rate-limit response
releases the cluster to open and stops that batch. Other ambiguous destination errors retain
acted-on state without automatic repetition (`CorrectionLoopDriver.ts:186–209`, `:285–357`).
After a default seven-day preference or fourteen-day infrastructure window, verification tests
each durable member's latest detection time and count for recurrence at or after the window's
start; it does not test a complete, end-bounded observation population (`:383–480`). Recurrence
reopens the cluster with fresh dates, default at most twice, then ends inconclusive. With no
recurrence, a preference still on disk becomes legacy `verified`; absent guidance and silent
infrastructure cases are inconclusive. Reopening watches existing member keys; it does not
itself reapply guidance, reroute the cluster, or watch terminal verified records indefinitely.

**Self-violation feedback today.** `routes.ts:3396` starts observation without awaiting it
before delivery completes. The observer requires learning enabled, `selfViolationSignal` true,
a ledger, and a local preference with a stored violation pattern (`:3554–3571`).
`SelfViolationDetector.ts:81–176` matches a bounded text prefix using a regular expression
(a text-matching pattern) or all keywords in a set of at least two distinct words. Missing,
invalid and failing checks can return no match. The normal correction writer supplies no new
violation pattern (`routes.ts:25673`; `CorrectionLoopDriver.ts:257–261`); this is not semantic
checking of every learned preference.

The route scrubs a prefixed self-violation lesson and summary before recording a threshold-weight
occurrence (`routes.ts:3580–3593`). Despite its adjacent comment, it does not pass the violated
preference's key or a session identity: `CorrectionLedger.record()` derives the key from that
prefixed lesson. Thus it retains an observation that later analysis can inspect, but does not
guarantee reinforcement or reopening of the original preference cluster. Unknown session diversity
can prevent promotion. A match is heuristic evidence about attempted outbound text, not proof
the message was sent or the guidance was actually violated; observer/storage failure does not
block, delay or rewrite delivery.

**Preserve/change/retire disposition.** P21-A2 imports available scrubbed ledger records,
occurrence rows, backlog captures, audit evidence and preference snapshots before switching
consumers. Preserve origin-scoped ids, exact keys, source hashes, lifetime counts versus retained
occurrence counts, day/session/topic evidence and unknowns, confidence versus deterministic
weight, cluster membership, route choice, window dates, reopen counts and terminal states.
Link available originals through governed custody; missing or already-pruned evidence remains
unknown. Never reconstruct a user's words from a distilled lesson. Local violation patterns
remain restricted signal metadata, not automatically shared preference content.

Change in-place state into append-only observations with rebuildable current views. Preserve
support/day/session diversity and bounded grouping as declared candidate-selection policy;
semantic recurrence review through the judgment owner can relate nonidentical corrections with
recorded support, without silently rewriting keys or treating similarity as authority. Current
explicit instructions are honored through their owners without waiting to recur. Preserve bounded
work, overflow and no blind repetition after ambiguous routing; replace local timers and private
route calls with section 6's supervised maintenance work and existing effect/feedback owners.
Imported acted-on records retain uncertain destination state until evidence resolves it; do not
automatically replay their side effects. Keep the existing finite window/reopen limits as the
initial observation policy, using section 9's explicit window boundaries and retained occurrences
for new assessments. Retire unique-evidence eviction as a retention policy: working sets may be
bounded, but accepted correction input stays recoverable with pending, failed or terminal status.

Retire legacy disk-presence `verified` as proof of use or effectiveness. Import it only as the
historical result of the old test. New evidence separately records stored guidance, its actual
captured-context delivery, subsequent behavior and independently assessed outcome. No recurrence
with observation disabled, failed, incomplete or no relevant opportunity remains unknown.
Retain self-violation observation as nonblocking evidence; the replacement explicitly links its
guidance version, attempted output, work/session when known, observation coverage and later
delivery result or unknown. Subsequent bounded analysis reads that link even when the old
cluster was terminal, and may propose a new assessment or lesson without manufacturing user
support, another session or a successful send. These are P21 source/derived-record and consumer
obligations under the existing section 14 grants, not additions to another owner's types.

**Rule — a recorded correction also owns a standards/process review.** Rules 4, 7, 8,
24, 33, 44, 45, 55, 57, 82, 85, 89, 95 and 113;
**checks: P21-NF-17a–j/18/21**. A record-time class review asks whether a correction reveals
a missing or weak standard and a gap in the development process. It begins when the correction
is recorded, independently of recurrence analysis. A review shell is the saved obligation to
answer those questions before the model has answered them. Filled means that the judgment
is saved, not that either proposed change was approved, implemented or effective.

**Record-time behavior today.** In the read-only Echo 1.x checkout,
`src/monitoring/CorrectionCaptureLoop.ts:422` and `:541` call `onRecorded` after successful
direct-capture and backlog ledger writes. `src/commands/server.ts:15079`, `:15143` connects
both to the separate consumer composed at `:18471–18577`. That composition requires shared
intelligence and the resolved development/configuration gate; dry-run defaults to true at
`:18509`. These are conditional wiring facts, not evidence of a deployed review execution.
`CorrectionClassReview.ts:66–81` creates the shell synchronously outside dry-run and starts
asynchronous judgment; dry-run instead emits a would-create observation and returns no shell.
No recurrence count, day diversity or weekly analyzer run is required. Noise rejected before
the ledger has no recorded correction; a low-value/noise record supplied to this consumer
still receives an explicit review disposition.

`ClassReviewStore.ts:44–70`, `:136–235` stores the separate `class-reviews.db` record keyed
by the correction's deduplication key. It retains correction/machine/origin observations,
standard and process judgments, rationale/confidence, their separate outcome states, review
lifecycle, authority machine, artifact links, retry counts/dates and version. Repeated delivery
of the same correction/machine observation does not add another observation. `:313–390`
keeps deferred and expired-unreviewed outcomes parked and unresolved, supports tracked deferral
and explicit supersession, and skips aging a linked in-progress action. New distinct observations
can reopen rejected/deferred/expired work (`:158–176`); a repeated counter alone is not that event.

**Recovery and linked actions today.** `CorrectionClassReview.ts:93–113` backfills missing
shells and retries due pending ones in bounded batches, attributing unauthenticated backfill
to agent-self. `:130–166`, `:244–269` bounds concurrent judgments and failed attempts
(defaults five concurrent, three attempts), with exponential retry delay capped at one hour.
Exhaustion retains a dead-lettered review, meaning attempts have stopped, and calls the action
sink to track a retry. `:116–128` retains aged work and coalesces follow-up. The actual
`src/server/routes.ts:25306–25323` backfill endpoint invokes recovery and aging, default seven
days, with active-action exclusions. The shipped
`src/scaffold/templates/jobs/instar/correction-class-review-backstop.md:1–23` supplies a
separate daily backstop, enabled in its template, with Tier 1 supervision and a 100-record
request to that endpoint. It runs per machine, treats a disabled endpoint as unavailable,
checks response shape and delegates proposal routing to the server. This is configured
recovery behavior, not proof that an installed job ran or its response counts were effective.

`CorrectionClassReview.ts:168–235` saves the judgment before proposing a standards initiative
or process action. Confidence, attributed origin, existing related outcomes and the open-artifact
cap limit proposals; policy relaxation goes to attention. Standards proposals request user
ratification, and process proposals invoke shared linked-action admission. The server adapters
at `server.ts:18537–18561` create initiatives/actions and annotate their limits; this wiring
alone is not proof that later autonomous execution is prevented. The admission function
`CorrectionInstanceFixGate.ts:22–43`, also called by `routes.ts:23801–23811` and
`:28779–28789`, rejects missing correction, mismatched reference, absent review or pending
review in enforcement mode. A corresponding filled review allows admission; a missing review
store or dead-lettered review allows it with that explicit reason. Dry-run allows proposed
refusals while returning `wouldRefuse`. None of these outcomes proves the repair occurred.

There are real interruption gaps: the capture callback can fail after the ledger write, and
the review can be filled before an action is created or its link attached. Backfill handles
absent/pending reviews, but skips filled reviews; it does not reconcile that latter gap
(`CorrectionClassReview.ts:98–113`, `:187–242`). The retry-action callback is likewise not
atomic with saving exhaustion. Import must preserve uncertain action creation rather than
blindly issuing the action again or treating the review as complete.

**Replicated evidence today.** `server.ts:18487–18503` conditionally attaches the emitter
and peer-journal reader. `src/core/ClassReviewReplicatedStore.ts:25–97`, `:113–141` transfers
bounded, scrubbed judgments, observations, outcomes and links; decoded peer lifecycle is
remote-advisory. It does not transfer local retry dates/counts: the decoded attempt count is
zero, not evidence that no attempt occurred. `ClassReviewStore.ts:228–235`, `:465–502`
merges observations and lets filled evidence outrank pending/dead-lettered evidence, while
local authoritative lifecycle outcomes remain local. The linked-action gate uses this merged
read, so a peer's filled judgment can establish that review exists; it cannot ratify or close
the local operator's work. Conditional peer wiring is not proof of peer custody or delivery.

**Preserve/change/retire disposition.** P21-A2 captures the separate review database,
available peer journals, correction ledger, audit and linked initiatives/actions/deferral records
before switching this consumer. Preserve all available fields above and origin-scoped aliases,
including pending, filled, dead-lettered, parked, reopened and superseded records. Capture each
peer variant before folding; retain missing retry metadata and missing source/link evidence as
unknown. Two retains originals and immutable imported evidence; P21 supplies searchable
advisory derivations. A captured legacy judgment never becomes a fresh independent assessment.

Nine's feedback owner (`docs/13-the-verification-holders.md:311–328`) owns the improvement
obligation and disposition, with Five retaining its work, Seven executing bounded judgment,
Six scheduling recovery, Ten composing custody and consumers, Eight admitting any later effect,
and Eleven exposing overdue work and explicit operator decisions. Nine's `FeedbackDisposition`
exists in `src/verification/contracts.ts:101–108` and its decoder at `records.ts:178–184`,
but it does not supply the two-question record-time review and linked-action recovery protocol.
Retain the legacy review detail as P21-owned evidence linked through the owner; do not add
legacy states to Nine's union or fabricate a missing source intent to satisfy its decoder.

The additive owner behavior is **REQUESTED as CORRECTION-CLASS-REVIEW-LIFECYCLE (Z)** in
`design-recall-doorway-seam-request-correction-class-review.md` (granted conditionally as SEAM-LEDGER row 97). It must admit a durable
review obligation for one recorded correction without waiting for recurrence, reconcile missing
shells and interrupted result/action linkage with the same work identity and remaining budget,
and resolve current correction/review correspondence before linked repair-work admission.
Standards changes retain explicit constitutional approval; a saved or peer-filled judgment
supplies evidence only. Keep the legacy unavailable/dead-letter/dry-run admission distinctions
as explicit policy observations; any allowed repair still needs current ordinary authority.
The maintenance review returns evidence to Nine; later repair work is independently admitted,
never an outgoing action or new capability of that maintenance root. Seven's raw judgment
captures remain in their local custody; peer review consumes only authorized advisory evidence.
No review failure blocks inbound delivery or ordinary conversation. Owner policy and source
identity, not a caller's origin label or remembered review, select the admission path.

Change mutable review state into append-only evidence and owner-resolved current obligations.
Preserve the daily bounded backstop and Tier 1 supervision through the scheduled-work owner,
with section 14 U27/U30's current matching supervisor evaluation and G84's recurring adapter;
retire callback-plus-backstop composition after durable owner admission and recovery take over.
Filled/expired/dead-lettered state must not imply automatic closure. Recovery must
reconcile whether a downstream artifact already exists before retrying; uncertain effects
stay with their existing owners. Preserve bounded retry, parked follow-up, active-action aging
exclusion and operator control without deleting an outstanding obligation. Rollback restores
the old reader against retained compatible state while keeping new owner work and unresolved
links visible. Z is granted conditionally under SEAM-LEDGER row 97 in
`seam-response-recall-doorway-grants.md` and remains unimplemented.

**Migration fixture P21-REG-CLASS-REVIEW.** Use an isolated single correction with one occurrence
on one day in one session, below recurrence admission, with that analyzer disabled. Exercise
both direct capture and backlog drain. With record-time review enabled and dry-run off, observe
the durable pending shell before releasing the model result; restart, recover the same obligation,
then capture both judgments and the filled result. Import pending and already-filled neighbors,
including existing linked artifacts. A filled result must not claim a completed improvement.
Disabled review yields explicit unavailable coverage; fresh dry-run records only would-create,
with no invented shell or completed review. Neither neighbor suppresses correction custody.

Kill after correction capture before shell creation, after shell before judgment, after result
before action creation, and after action creation before link attachment. Restart/import twice;
require one recoverable obligation per source identity, retained attempt limits, no duplicate
action and no closure from an absent link. Exercise successive daily backstop occurrences
through the pinned calendar adapter and real scheduled owner consumer across restart, including disabled recovery and malformed-result neighbors. Exhaustion retains
its retry obligation even when the action sink fails. Age an unresolved filled review into
parked follow-up, with a linked
in-progress action as the exclusion neighbor. Pair matching filled correspondence with missing,
mismatched, pending, dead-lettered and unavailable-review cases, plus dry-run would-refuse evidence.
Assert current authority still governs any action, and delivery remains reachable in every case.
Across two machines, import real peer evidence and restart: a permitted peer-filled judgment
can be considered as review evidence, but its rejected/ratified/closed disposition cannot change
local obligations or approve a standards change. Missing peer retry metadata stays unknown.

Run this fixture through unit, public-pipeline integration and actual production initialization,
with real owner storage/recovery/admission consumers; a helper's return value is insufficient.
The migration positive is **NON-EXECUTABLE-UNTIL-row-97-correction-class-review-lifecycle** (until its granted owner implementation
lands), and until the applicable scopes of **`seam-response-recall-doorway-grants.md` land**
with the complete inherited NF-17a–j/18/21 dependencies in section 14. No repaired review or
migration execution is claimed by this source audit.

**Rule — learned preferences retain their actual consumer and evidence limits.** Rules 7,
33, 44, 45, 47 and 89; **checks: P21-NF-05/11/12/17a–j/18/21**. This source audit supplements
[R1's inventory](research/01-instar-1x-memory.md); paths in this block are read-only 1.x paths
under `/Users/dabombstudio/.instar/agents/echo`, not 2.0 exports.

`PreferencesManager.recordPreference()` upserts `.instar/preferences.json` by `dedupeKey`.
It refreshes the learning and recorded time, takes the larger confidence, increments the
observation count, and retains an existing optional violation pattern when none is supplied.
Its sequence and store-incarnation fields support replication; the write is atomic.
The stored lesson has correction-loop provenance, not a guaranteed original correction-capture
reference. Migration captures the store and any available originating correction evidence;
missing originals remain explicitly unknown. The local violation pattern remains local signal
metadata, excluded from replicated preference envelopes.

`sessionContext()` uses `formatPreferencesForSessionStart()`, which orders by recorded time ×
confidence × count and admits whole guidance lines up to a byte cap (default 4,000).
It stops at the first line that would exceed the cap. Thus the returned count describes
candidate entries, not delivered entries. The rendered envelope says these are advisory hints
and that real instructions and safety take precedence; the envelope does not prove model use.

The real `GET /preferences/session-context` route returns 503 unless
`monitoring.correctionLearning.enabled === true`. When enabled, its first choice is the
foundation union reader if the development-agent gate resolves
`multiMachine.stateSync.preferences.enabled` to enabled and the reader is wired. Explicit
true/false wins; an omitted flag follows the development-agent default. The union helper passes
all surviving conflicting variants to the same bounded renderer; a conflict flag does not
itself suppress hints. Byte limits can still omit candidates. The helper accepts peer origins,
but the inspected `src/commands/server.ts:5059–5076` loader enumerates only the local store
and returns only this machine's origin. That composition is not proof of remote preference
delivery. No live installation flag or peer-delivery success is inferred.

If that route does not select the foundation reader, the legacy pool merge is used only with
`multiMachine.seamlessness.ws21PreferencesPool === true`, a resolved self machine identity,
and available replicas. Otherwise it serves the local manager. Foundation precedence means
enabling both paths does not combine them. `CLAUDE.md:1195–1203` and `:1366–1382` describe
the intended learned-hint and optional conflict-resolution experience; the source conditions
above bound what that description establishes today.

The installed session-start hook fetches the route with a four-second timeout when port and
credential are available. It prints a present nonempty block into session context. Disabled,
unreachable, malformed or empty responses silently skip injection and let the session continue.
That is a source-visible consumer, not evidence that any particular session received or used it.

The replacement is the P21-A2 correction lifecycle above feeding the learned-guidance producer
and P21-A1 coordinator, then the judgment and assembly context consumers. Import each available origin, conflict variant,
observation count/time and source hash without turning advisory guidance into standing. Original
snapshots remain recoverable. Resolve current audience/use permissions before selecting hints.
Replace the legacy route and hook only with the same startup, later-input and compaction
consumer migration. Do not retire one while the other still reads its old source.

The migration regression P21-REG-PREFERENCES begins with recurring user corrections: capture,
scrub, retain qualifying occurrences across the required days/sessions, run successive weekly
analysis occurrences through the pinned calendar adapter and real scheduled owner and route, store guidance, restart, then observe its body in actual captured context
and independently assess a later answer that honors it. Storage alone cannot pass. A second-machine variant
must traverse real replicated custody and the new consumer; fixture-only union output cannot
pass it. A concurrent divergent hint must retain both origins and eligible advisory variants
without waiting for optional conflict cleanup. Paired tests cover local-only operation, disabled
learning, missing peer custody, byte-cap omission, current permission refusal, and explicit
instruction precedence. Repeat at initial start and post-compaction with current consumption
evidence. Its lifecycle arm violates checkable guidance in an attempted output, retains the
scrubbed observation and explicit guidance link, restarts, and proves subsequent scheduled
analysis reads it and records an evidence-backed disposition. Repeat after a terminal legacy
state and with a delivery failure: neither may erase the observation or count an unsent message
as delivered. A correct-output neighbor has no confirmed violation.

Paired controls cover below-threshold weight, one-day/one-session bursts, unrelated paraphrases,
missing session evidence, noise, scrubbed credential-shaped input/output, backlog throttle/recovery
and exhaustion, analyzer disabled/unwired, stale cluster versions, route failure/overflow,
rate limiting, finite reopening and inconclusive closure. Guidance present on disk but omitted
from actual input fails consumption; guidance delivered but ignored fails behavior. Disable
each observation flag separately, remove the pattern or ledger, fail the detector/write, and
verify delivery stays reachable while observation coverage is explicitly unavailable, never a
clean record of compliance. These proposed migration positives are **non-executable until
`seam-response-recall-doorway-grants.md` lands for the complete NF-17a–j/18/21 dependencies in
section 14**, together with their inherited grants and P21 implementations. The three executed
baseline observations remain distinct. The daily backstop and weekly analysis positives are
**NON-EXECUTABLE-UNTIL-row-84-calendar-adapter**, until `seam-response-assembly-followup.md`
row 84 lands, and also require the U27/U30 supervisor grants named in section 14. Manual
invocation or a one-shot fixture cannot prove these preserved cadences.

**Rule — replicated knowledge preserves catalog identity without inventing body delivery.**
Rules 7, 31, 33, 44, 45, 57, 89 and 90; **checks: P21-NF-05/11/12/17a–j/18/21**.
The read-only 1.x `src/core/KnowledgeReplicatedStore.ts:300–336` derives the cross-machine key
from a nonempty source address (`url`), or the title when no address exists, plus source type. Each
component is trimmed, lowercased and has repeated whitespace collapsed before hashing; the
local generated id and file path are not identity. The same address and type match despite
different local titles/ids; title-only sources with different titles or records with different
types can have different keys. This is catalog identity, not proof that two document bodies agree.

The union at `:496–510` preserves all surviving conflicting puts (stored-value records) as separate advisory entries
with origin/conflict evidence. A tombstone is an explicit deletion marker: it contributes no
displayed value, and a resolved deletion displays none. A concurrent surviving put is not hidden
just because another variant is a tombstone. Reading does not overwrite local catalog records.
The renderer at `:530–545` escapes foreign title, address, type, time, tags, summary and origin
inside an untrusted-data envelope. This preserves attribution and treats foreign metadata as
guidance, not instructions; a catalog summary is not an original document body.

`src/commands/server.ts:12241–12267` constructs the union reader with a local-catalog-only key
inventory and loader that returns only this machine's origin; it then leaves the reader unused.
This does not establish peer lookup or session-context injection. Send-side wiring at
`:12279–12295` separately attaches put/delete emitters when the shared emitter exists. Their
builders (`KnowledgeReplicatedStore.ts:380–408`, `:446–456`) transfer catalog metadata and
deletion records, never the original body, local id or file path. The resolved replication gate
and actual peer custody must be observed before claiming an installation transfers even that
metadata. The intended replicated knowledge family named in `CLAUDE.md:1204` does not prove
those consumers ran.

P21-A2 captures available catalog snapshots, journals, tombstones and separately available
original bodies. Preserve the address-or-title/type key, origin, source hashes, ordering evidence,
conflicts and local ids as origin-scoped aliases. An identity-input change creates an explicitly
related candidate when supported; never merge by title similarity or assume body equality from
the key. Preserve deletion-aware served views across restart/rebuild and stale peer return,
while retaining unique history in custody. P21-A1's knowledge retriever supplies separately
attributed, escaped surviving metadata with explicit scope/budget exclusions and body-availability
status. A metadata-only source may supply labeled catalog guidance; a claim requiring original
text must load its permitted captured body or remain unsupported. Retire metadata replication
as proof of body custody. Build the absent peer-read and actual judgment/assembly context
consumers through the existing section 14 dependencies before retiring local catalog callers.

P21-REG-KNOWLEDGE uses two machines with different local ids/paths for the same normalized
address and type. Real peer custody, import, restart and actual PRINCIPAL input must preserve
the key and foreign attribution; concurrent divergent summaries remain separate eligible
guidance. Pair metadata-only transfer with separately captured-body retrieval: only the latter
can satisfy a required original-text claim. Additional controls cover title fallback without an
address, distinct types, changed identity inputs, an empty anchor, absent/disabled peer custody,
an unwired consumer, hostile foreign markup, scope/budget exclusion, a resolved tombstone plus
a stale returning peer, and a surviving concurrent put beside a tombstone. Rebuild and repeat
through startup and compaction; no deleted value reappears in served views, no foreign metadata
becomes authority, and helper output alone cannot pass. This migration positive is
**non-executable until `seam-response-recall-doorway-grants.md` lands for the complete
NF-17a–j/18/21 dependencies in section 14**, with their inherited grants and P21 implementations.

**Rule — replicated relationships preserve identity evidence and consumer limits.** Rules 7,
28, 31, 33, 44, 45, 89 and 90; **checks: P21-NF-05/06/11/12/17a–j/18/21**.
The read-only 1.x sources in this block are under `/Users/dabombstudio/.instar/agents/echo`.
`RelationshipsReplicatedStore.ts:409–415` derives a key from the sorted, deduplicated channel
identifiers, not the local UUID. No-channel records have no replicated key. Different channel
sets can yield different keys even for a person later shown to be the same; an imported key
is identity evidence, never an authenticated principal or permission to join histories.

`RelationshipsReplicatedStore.ts:578–594` renders each surviving concurrent value separately
with its origin and conflict flag. A tombstone is an explicit deletion marker: it contributes
no displayed value, and a resolved deletion yields none. In an unresolved conflict, surviving
non-deleted variants remain eligible; a deletion marker is not a blanket instruction to hide
all other variants. The read does not overwrite the local record. The foreign-context helper
at `:618–657` wraps material in an origin-marked untrusted-data envelope and escapes rendered
fields, retaining notes, relationship arc and recent-interaction text as another machine's
claims rather than this agent's instructions or first-person experience.

The consumer is concrete but bounded: `src/commands/server.ts:6976–6992` wires the relationship
manager's separate peer-read seam through the union and foreign renderer, leaving local
principal resolution separate (`src/core/RelationshipManager.ts:101–122`). However, the reader's
loader and key inventory at `src/commands/server.ts:5098–5130` enumerate only local records and
return only this machine's origin. The consumer filters out that origin. This composition
therefore does not establish live peer context, automatic submission to a PRINCIPAL judgment or any installed
flag state. `CLAUDE.md:1202` describes the intended replicated relationship experience; the
inspected consumer and custody path delimit what exists today.

P21-A2 captures each available local/peer snapshot and imports the channel-set key, original
channel set, origin, version/order evidence, conflict variants and tombstones. Local UUIDs stay
origin-scoped aliases. Channel-set changes require current identity-owner resolution before
cross-conversation joins. The P21-A1 person retriever keeps all permitted surviving variants
as separately attributed candidates and records any budget/scope exclusions. Tombstones remain
in retained history and suppress only the served values their resolved semantics remove; index
rebuild or a stale returning peer cannot resurrect those values. This preserves the served-view
disposition without adopting deletion of unique originals. Foreign guidance remains escaped,
delimited and untrusted in the actual rendered packet. The manager peer reader and every
startup/later-input/compaction caller migrate with the new judgment/assembly consumers.

P21-REG-RELATIONSHIPS starts with two machines using different local UUIDs for the same channel
set. Actual peer custody, import and restart must preserve one source identity and deliver the
permitted note body with its origin through captured PRINCIPAL context. A concurrent divergent
note retains both eligible variants without waiting for conflict cleanup. Paired cases cover
a changed channel set without a verified mapping, a channel-less local record, missing peer
custody/local-only operation, disabled replication, a resolved tombstone followed by a stale
peer, a surviving value beside a concurrent tombstone, scope refusal, and hostile markup in
foreign fields. Assert no foreign identity becomes principal authority and no deleted value
reappears in the served view. Repeat at startup and post-compaction; helper output alone fails.

**Rule — replicated learnings preserve advisory variants without inventing injection.** Rules
7, 31, 33, 44, 45, 57, 89 and 90; **checks: P21-NF-05/11/12/17a–j/18/21**.
The read-only 1.x `src/core/LearningsReplicatedStore.ts:373–384` derives the replicated key from
normalized title and category plus the source content id, falling back to discovery time.
It does not use a machine-local learning id or hash the whole body. Empty title/category
cannot supply a key. Edits to those identity inputs can change the key and must not silently
merge independent lessons during import.

The union at `:557–573` retains each surviving concurrent value with origin/conflict evidence
as advisory guidance. It omits tombstone variants and resolved deletions, without blocking on
an unresolved conflict or writing foreign values over local records. The renderer at
`:591–615` escapes fields, keeps the foreign origin envelope and includes the lesson details,
source and application metadata when present. That helper is not proof of session delivery.
`src/commands/server.ts:12140–12159` composes a gated reader over own and peer journal streams
when the peer-stream reader exists. At `:12160` the variable is unused and session-context
injection is explicitly future work. Send-side emitter wiring at `:12162–12186` is separate
from that missing consumer. `CLAUDE.md:1203` describes the intended advisory experience, not
an executed context-injection guarantee.

P21-A2 captures original learning snapshots, available journals and tombstones, retaining each
content-anchored key, origin, ordering evidence, source attribution and concurrent variant.
Local learning ids are origin-scoped aliases only. Missing original episodes remain unknown;
a peer's lesson cannot manufacture supporting exchanges. The new procedural-lesson source
feeds the P21-A1 coordinator and actual judgment/assembly consumers at startup, later input
and compaction. It preserves escaped untrusted guidance and all eligible surviving variants,
with explicit exclusions for scope or budget. Tombstone-resolved values stay out of served
views across rebuild and peer return while unique historical evidence remains in authorized
custody. No import or conflict cleanup promotes a lesson to standing or overwrites another
origin's account. Implementation must build and prove the absent context consumer before
claiming migration complete; a readable peer journal or renderer alone cannot close it.

P21-REG-LEARNINGS starts with different local learning ids but the same normalized title,
category and source anchor on two machines. After real peer custody, import and restart, the
permitted lesson body and attribution must reach actual captured context. Concurrent divergent
details retain both advisory variants. Paired cases cover different source anchors with the
same title, missing peer journals, disabled replication, missing original evidence, an absent
context consumer, budget omission, a resolved tombstone plus stale peer, a concurrent surviving
value, hostile markup and a current instruction overriding a remembered lesson. Repeat through
startup and post-compaction and assert no authority is acquired from guidance.

Both replicated-store migration positives are **non-executable until
`seam-response-recall-doorway-grants.md` lands for their section 14 NF-17a–j/18/21 dependencies**,
together with those rows' inherited grants and P21 implementations. No repaired execution or
live peer injection is claimed here.

**Rule — the surrounding memory family has explicit dispositions too.** Rules 7, 33, 44,
45, 69, 89, 90 and 111; **checks: P21-NF-02/11/12/17a–j/18/19/20/21/23**.
The inventory above plus the following rows covers all 15 files under the audited 1.x
`src/memory`, the memory-related replicated families under `src/core`, the correction,
class-review, preference and learning loops under `src/monitoring`, and their source-visible
job and public read/write consumers. Infrastructure that supplies identity or repair remains
with its existing owner; its presence is not a new recall permission. These are source-file
observations, not installed activation claims. A retained producer below may continue producing
through its own owner: migrating its recall reader does not authorize replacing its action or
approval lifecycle.

| Additional source / producer / consumer, relative to the 1.x root | Preserve | Change or retire for recall |
|---|---|---|
| `src/memory/NativeModuleHealer.ts:1–36`; `src/monitoring/NativeHealDegradationBridge.ts:1` | Database-open failure and repair observations; explicitly unavailable source when storage cannot open | Keep native-module installation/repair with infrastructure owners. A retriever never gains package installation or a hidden repair allowance. Neither successful repair nor a live process proves source coverage. |
| `src/core/PreferencesSync.ts:103–162`, `:181–254`, `:373`; existing preference rows above | Legacy paged replica files, cursor/incarnation and stale/conflict evidence alongside foundation journals | Import both available source families before replacing route precedence; retain gaps and restrictions. The old peer cache is not an original correction archive. |
| `src/core/ReplicatedStoreReader.ts:1`; the knowledge, relationship, learning, preference and class-review rows above | Shared registry-driven reads, origin/order evidence and surviving conflict variants | Continue to mediate reads; retain unique historical input before any bounded journal rotation. A union helper does not prove peer storage or actual consumer delivery. |
| `src/core/EvolutionActionsReplicatedStore.ts:381–396`, `:567–633`; `src/commands/server.ts:12378–12425` | Title/commitment-target/creation-time identity, advisory foreign action text, concurrent variants and deletion markers | The inspected reader is local-only and unused; build the actual recall consumer before claiming peer recall. Imported pending/completed/cancelled text remains historical evidence; action/work owners re-resolve live obligations and authority. No recalled completion closes work. |
| `src/core/WorkingSetArtifactManager.ts:1–25`, `:84–108`; `src/core/WorkingSetArtifactReplicatedStore.ts:253–262`, `:386–405`; `src/commands/server.ts:12320–12354`; `src/server/routes.ts:9117–9225` | Separate interactive-file catalog, producer-scoped path key, hash/readiness state, conflict variants and separately captured file body | This is distinct from `src/memory/WorkingSet.ts`'s lesson selection. Local catalog and unused local-only union are not peer body custody. Preserve metadata and unique bodies before catalog expiry; path/hash or ready state cannot prove actual input. Keep fetch confinement with the custody owner. |
| `src/core/UserRegistryReplicatedStore.ts:1`; `src/core/TopicOperatorReplicatedStore.ts:1`; `src/core/TopicPinReplicatedStore.ts:47–53`, `:141` | Available person/contact observations, historical operator mappings and machine-placement pins as separately attributed source data | Identity/standing/placement remain owner-resolved, never imported as recall authority. Topic placement pins are not memory-importance pins. Do not merge authenticated people from replicated display names. |
| `src/core/SubscriptionAccountMetaReplicatedStore.ts:1–8`; `src/core/ThreadlinePairingReplicatedStore.ts:1` | Existing owner custody of account metadata and peer-pairing state | These are infrastructure/identity stores, not general memory sources. Recall may consume only the owner's permitted current result; raw logins, pairing credentials and authority are not imported into a recall packet. |
| `src/core/ExecutionJournal.ts:61–80`, `:87–174`, `:220–260`; `src/core/PatternAnalyzer.ts:117–237`; `src/core/ReflectionConsolidator.ts:95–138` | Pending/completed execution evidence, hook versus agent origin, pattern reports, deduplication and proposal/learning links | Capture pending files and retained journals before pruning; preserve observed versus inferred claims. Move memory derivation to supervised maintenance and actual context readers; a count of generated proposals is not learning effectiveness. |
| `src/core/BlockerLearningLoop.ts:108–192`, `:199–263` | Job `commonBlockers`, resolution/session origin, pending/confirmed/expired state and reuse counts | Capture before expiry/cap pruning and retain later observations. Legacy human/agent reuse thresholds are advisory evidence, not verified authority or a replacement for present access checks. A resolution containing credential references stays in authorized custody. |
| `src/core/AutonomousEvolution.ts:129–235`; `src/core/EvolutionManager.ts:1165–1247`; `src/server/routes.ts:23380–23899` | Proposal, gap, action and learning records, review decisions, job-change files and their applied/reverted history | Keep approval, scheduling and effect execution with their owners. Import values as evidence, not permission to reapply a job change. Preserve separate diagnosis/remedy and available consumer evidence; status or an identity-relevance nudge is not proven learning. |
| `src/monitoring/ReflectionMetrics.ts:90–188`; `src/core/LearningVelocityScorer.ts:54–104`; `src/server/routes.ts:4967–4991`, `:10867–10935` | Reflection occurrence/threshold state and learning-event population; the route counts action completion, not merely filing | Retain observations and exclusions through the measurement owner. Event rate, trend and adaptability score do not establish coherent recall, reflection quality or causation. |
| `src/monitoring/HumanAsDetectorLog.ts:176–288`; `src/monitoring/scrubSecrets.ts:23–40`; correction/preference/class-review rows above | Classified signals, scrubbed available context, drift samples, capture/backlog, ledger, recurrence and independent review state | Preserve this whole producer chain, not only preferences. An unmatched heuristic or skipped observer is unavailable coverage, not evidence of no correction. No secret-pattern scrub proves removal of all private content. |
| `src/monitoring/FailureLedger.ts:400–506`, `:613–654`; `src/monitoring/FailureAttributionEngine.ts:86–153`; `src/monitoring/CiFailurePoller.ts:1`; `src/monitoring/FailureAnalyzer.ts:79–110`; `src/monitoring/FailureLoopDriver.ts:75–148`; `src/server/routes.ts:13895–14030` | Separate failure/occurrence/insight evidence, attributed versus inferred causes, support/source diversity, linked action/initiative and finite verification windows | Import permitted observations and procedural candidates as P21 data. Retain existing feedback/work lifecycle under its owners; never replay its action creation during import. Legacy rate comparison is correlational and its unknown exposure stays unknown; current measurement/grade owners decide new effectiveness claims. |
| `src/monitoring/FrameworkIssueLedger.ts:345–477`, `:572–616`, `:712–725`; `src/server/routes.ts:13674–13820` | Issue/observation/capture records and candidate/extracted/superseded playbook status; cross-framework candidate reads and recorded promoter | Keep this issue-derived playbook separate from the adaptive-context manifest. The current promotion check uses a nonempty, non-Echo actor string, not verified independent authority. Preserve the historical label but require current owner-approved promotion for new lessons; candidate inclusion is not acceptance or actual use. |
| `src/knowledge/TreeGenerator.ts:44–100`, `ProbeRegistry.ts:56–94`, `TreeTriage.ts:157–227`, `TreeSynthesis.ts:63`, `CoverageAuditor.ts:60–111`, `IntegrityManager.ts:51–100`, and `types.ts:1`; `src/server/routes.ts:7206–7305` | Tree configuration, query/probe results, derivations, coverage and integrity observations alongside the existing SelfKnowledgeTree/TreeTraversal row | Register each source and subordinate model/probe call with scope/budget and honest failure. Tree coverage means configured capability/state coverage, not complete conversational memory. A signature or selected node does not prove original custody or current truth. |
| `src/knowledge/KnowledgeManager.ts:45–181`; `src/commands/playbook.ts:675–838`; `src/scaffold/templates.ts:1624–1674`; `src/server/routes.ts:13707–13719` | Knowledge-file/catalog readers and the adaptive playbook command surface; the route here serves framework-issue playbook entries | The audited routes file has no general `/knowledge` or adaptive `/playbook` route. Migrate actual knowledge callers and playbook CLI/script consumers, not invented endpoints. Preserve versioned manifest items, referenced bodies, mounted snapshots, evaluation/history/quarantine and privacy records before replacement or retirement. |
| `src/server/routes.ts:5289–5380`, `:5386–5584`, `:5705–5871` | File search/stats/reindex/sync; semantic create/read/forget/connect/search/hybrid/embedding migration/explore/verify/supersede/decay/stale/export/import/stats/context; memory export, rebuild, snapshot and all four import surfaces | Every live reader moves with its source. Write/forget/decay/export/rebuild callers must use non-deleting admitted history and proven reconstructable views; neither HTTP success nor a legacy entity snapshot proves citation preservation. Disabled, failed and partial results stay explicit. |
| `src/server/routes.ts:7994–8012`, `:24003–24193`, `:31477–31532`; `:20797–20873` | Working-memory, topic history/assembled session/summary, episode stats/session/activity/theme/scan and relationship list/stale/detail/context/import consumers | Replace each context consumer together with startup/later-input/compaction wiring. A summary-data endpoint only supplies material to the calling model; it does not prove a summary ran or was read. Relationship removal cannot delete unique retained evidence. |
| `src/core/BootSelfKnowledge.ts:1–33`, `:269–358`; `src/server/routes.ts:24686–24800`; generated memory guidance `src/scaffold/templates.ts:233–245`, `:293–299` | Boot self-knowledge quick facts and named capabilities; managed MEMORY.md and separately available harness auto-memory | Capture unique notes before replacing served files; retain current owner permission and provenance. Harness-local auto-memory is a separate source with explicitly unknown availability on other machines, not automatic shared history. Quick-fact delete becomes removal from the current view with retained lawful history, never an implicit new erasure policy. |


| Additional learning observer / consumer | Preserve | Change or retire for recall |
|---|---|---|
| `src/monitoring/RevertDetector.ts:135–219`; failure-family rows above | Reachable-commit/file-intersection observations, original failure links and inferred versus automatic attribution | Retain both input commits and the recorded status change. Current code can resolve a matched failure or open a resolved forensic row; that is not an independent proof of a correct repair. Import never reruns the status mutation or grants git authority to recall. |
| `src/monitoring/GrowthMilestoneAnalyst.ts:313–357`, `:460–525`; `src/monitoring/GrowthDigestPublisher.ts:396–510`, `:897–932`, `:1006–1056`; `src/server/routes.ts:10583–10629` | Stage-observation journal, approval-change/correction-pattern findings, digest, delivery audit and retry/deferral records | Capture historical observations before stage pruning; retain missing-input and send-failure limits. Preserve the actual read/digest consumer with its existing notice owner. A threshold finding or delivered growth summary neither accepts a preference nor proves recall improvement. |
| `src/monitoring/ApprenticeshipCycleStore.ts:24–47`, `:626–679`, `:834–837`; `src/monitoring/MentorStageA.ts:1–30`; `src/server/routes.ts:25743–25934` | Task, learner output, mentor findings, overseer differences, coaching, transcript-audit and operator-experience evidence; local and permitted peer-cycle reads | Keep training/instance lifecycle with its owner. Preserve source-visible versus internal context restrictions and peer-read coverage; do not feed withheld mentor internals to the learner or turn a closed cycle into an independent quality grade. Migration retains unique coaching and actual readers, not only a cycle count. |
| `src/monitoring/DeferralPatternSentinel.ts:1–14`, `:123–145`; `src/core/JudgmentProvenanceLog.ts:552–610`; `src/monitoring/ReviewCanaryBattery.ts:254–281`, `:399–418`; `src/server/routes.ts:33848–33877` | Content-free distinct-deferral observations and existing provenance; separate synthetic review fixtures and battery results | The deferral helper declares itself not boot-wired and owns no store; preserve the provenance reader without claiming an active sentinel. The battery refuses outside its enabled observation-only test mode. Keep synthetic rows separate from real user episodes, retain available results before fixture cleanup, and never count a canary as production recall success. |

**Rule — context outside the memory directories has an explicit owner disposition.** Rules
7, 28, 33, 44, 45, 47, 69, 89, 95 and 111; **checks: P21-NF-02/05/17a–j/18/19/21**.
The following inventory includes sources that reach specialized model calls or user read
surfaces, even when they do not feed ordinary conversation. “Retain owner” means keep that
source's writer, policy and current-state resolver with its existing owner, capture permitted
historical evidence before any replacement, and register its actual reader in the migration
manifest. It does not mean that P21 imports credentials, duplicates authority, or implements a
new source. An available helper, advertised route or configured hook is not proof of delivery.

| Source family and concrete 1.x reader/producer | Preserve or explicitly retain owner | Change or retire for recall |
|---|---|---|
| Canonical quick facts, anti-patterns and project registry — `src/core/CanonicalState.ts:7–13`, `:90–141`, `:180–230`; `src/server/routes.ts:8112–8156` | Capture these three separate JSON registries, question/answer/source fields, learned anti-pattern bodies and project observations; retain their actual lookup/read surfaces | These are separate from BootSelfKnowledge. A legacy `lastVerified` timestamp set during an upsert is not independent verification; retain originals before replacing mutable views and re-resolve live project/authority state. |
| Operational and reflective identity — `src/core/IdentityRenderer.ts:1–21`, `:158`, `:345`; `src/core/SoulManager.ts:90–96`, `:329–330`, `:642`; `src/core/OrgIntentManager.ts:246–258`; `src/core/OrgIntentIdentityLayer.ts:10–33`; `src/server/routes.ts:27501–27628`; installed `session-start.sh:122–147` | Retain governance/identity owners for AGENT.md, ORG-INTENT.md, soul.md, initial snapshots, pending edits and audit; preserve unique custom text separately from generated harness shadows | Migrate the real render/read/hook consumers with those owners. A captured instruction or imported pending change confers no new authority; regenerated shadow files do not replace unique source bodies. Do not relax soul-section visibility or infer a hook ran from its template. |
| User profiles and operator context — `src/users/UserContextBuilder.ts:45–145`, `UserManager.ts:296`, `TopicOperatorStore.ts:297–308`; `src/commands/server.ts:1126–1130`; `src/server/routes.ts:7907` | Retain user/identity owners and capture permitted bio, interests, style/timezone, relationship/history text, custom fields and verified-binding evidence | Keep profile facts distinct from learned PreferencesManager guidance. Preserve truncation and missing-profile coverage in actual context; a rendered “system-enforced” permission label is not current authority. |
| Topic intent, temporal awareness and task framing — `src/core/TopicIntent.ts:497–543`, `TopicIntentBriefing.ts:55–66`, `TopicAwareness.ts:1–22`; `src/server/topicIntentRoutes.ts:1`; existing topic-intent/ArcCheck hook audit | Capture topic evidence, tentative/established distinctions, pending confirmations, goals/arcs/work and extraction/check observations; retain topic-intent writers and public readers | Register briefing and later-input consumers separately from raw history. Preserve quoted support and uncertainty; an established legacy label does not mint a directive. A temporal summary does not establish full-history coverage. |
| Mid-task context resurfacing — `src/core/Usher.ts:1–34`, `UsherSignalStore.ts:1–68`, `UsherActedCorrelator.ts:1–27`, `:135–171`; `src/commands/server.ts:6111–6114`, `:14929–14940`; `src/server/routes.ts:15834` | Capture the faded topic-context candidates, bounded turn evidence, suggested resurfacing reasons and retained use/miss correlation observations; retain the topic-intent/observation owner and signal pull reader | The inspected Usher is signal-only and does not inject. Its store keeps a bounded set of signals; its use/miss credit is a lexical-overlap heuristic, not proof the model consumed a signal or understood its source. Preserve both numerator paths separately, missing-provider/no-candidate/error neighbors and disabled-source posture; do not migrate these metrics as measured recall success or permission to interrupt. |
| Feature discovery and consent history — `src/core/FeatureRegistry.ts:1–12`, `DiscoveryEvaluator.ts:32–66`, `:171`, `:464–503`; `src/commands/server.ts:18101–18104`; `src/server/routes.ts:34288`, `:34361`, `:34465` | Retain feature/consent owners for the per-user discovery database, prior offered/deferred/declined/enabled states and authorized current action policy; capture permitted contextual recommendations and actual surface observations | Keep static feature descriptions, stored user choices, category-keyed cached model recommendations and actual enabling separate. A recommendation is not consent; cached context is not a fresh user decision. Missing intelligence or an uninitialized evaluator remains unavailable, and a timeout does not itself cancel residual provider work. |
| Cross-machine conflict evidence and proposed text — `src/core/ConflictStore.ts:1–24`, `:40–49`, `LLMConflictResolver.ts:203–247` | Retain synchronization and resolution owners for available original divergent versions, conflict/recurrence/loss counters, current operator dispositions, bounded model input and proposed merge content | The conflict ledger contains version identities rather than payloads and can evict old open entries with a loss count; it cannot reconstruct originals alone. The separate model resolver's tiered proposal is derived text, never authoritative identity or an approved merge. Capture unique available versions before replacement and re-resolve the owner's present conflict rather than importing a historical resolution as a fresh decision. |
| Project and documentation navigation — `src/core/ProjectMapper.ts:22–34`, `:281–308`; `CartographerTree.ts:1–16`, `:46–55`; `CartographerNavigator.ts:5–31`; `cartographerSummary.ts:8–15`; `src/monitoring/CartographerSweepPoller.ts:1` | Retain project-map and cartographer owners; capture unique generated descriptions with covered code identities, source roots, freshness and authoring observations | Preserve the bounded navigation reader and its untrusted-summary rendering. This code/document tree is distinct from SelfKnowledgeTree; code-hash freshness does not prove a summary is correct or that omitted directories were examined. |
| Pre-compaction learning extraction — `src/core/PreCompactionFlush.ts:156–230`, `:329`, `:374`; `src/commands/server.ts:13284–13304` | Capture available transcript slice, derived learning files, MEMORY.md index entries and flush audit; preserve the explicitly enabled PreCompact callback and no-provider/no-transcript/error dispositions | This producer is separate from rolling summaries. Move formation to supervised maintenance under P21-A2 or explicitly retain its owner with captured-call accounting. Retire an index append or `ok` result as proof every fact body was written or later used; bounded transcript tails are partial evidence. |
| Job bodies, handoffs and reflection — `src/scheduler/JobScheduler.ts:1372–1475`, `JobRunHistory.ts:1`; `src/core/JobReflector.ts:70–170`; existing ExecutionJournal/BlockerLearningLoop rows | Capture validated job bodies, prior handoff notes and state snapshots, common blockers, run/skip histories, reflection input/results and available execution provenance; retain scheduling owner | The prompt actually includes topic awareness and last-run handoff when available. Keep those consumers and the reflector distinct from generic memory search. Missing intelligence yields no reflection, and proposed improvements do not authorize changing a job. |
| Dispatch context and learned adaptations — `src/core/ContextSnapshotBuilder.ts:77–115`; `ContextualEvaluator.ts:1–18`; existing DispatchExecutor, DecisionJournal and EvolutionManager rows | Capture snapshot versions and their underlying identity/jobs/decision metadata, dispatch content, adaptation proposals and applied/reverted evidence; retain dispatch/effect owners | Preserve the actual specialized model consumer, not just a snapshot cache. Record cached age and omitted fields. An accepted dispatch recommendation or rendered context is not proof of application or ordinary-session delivery. |
| Work, commitments and continuity state — `src/core/WorkLedger.ts:19–36`, `CodexTaskContinuationStore.ts:123–163`, `SessionBuildContextStore.ts:7–30`, `SessionClockReader.ts:12–25`, `ForwardedTopicContext.ts:19–25`; `src/monitoring/CommitmentTracker.ts:1–17`; `src/tasks/TaskFlowRegistry.ts:1–12` and `task-flow-registry.store.sqlite.ts:1` | Retain work/run/commitment owners for ledgers, remaining tasks, awaited results, build locations, clocks, session/resume/handoff mappings and task-flow records; capture historical observations and available forwarded originals | Migrate real continuation, restore, status and context readers without restarting stopped work or replaying actions. Task-flow notification metrics do not prove a user notification. A resume id, countdown, handoff or remembered promise cannot close work or stand in for full history. |
| Approval, permission and behavioral-baseline evidence — `src/core/ApprovalLedger.ts:1–33`; `src/permissions/RelationshipBehaviorStore.ts:1–20`, `RelationshipAnomalyScorer.ts:387`, `PermissionDecisionLedger.ts:77`, `AmbientContributionGate.ts:290–291`; `src/coordination/ReviewExchange.ts:1` | Retain current authority with identity/permission owners; preserve lawful decision histories, operator-sourced classifications/divergences, corrections, review exchanges and shape-only behavioral observations | Keep the permission baseline separate from relationship notes: it stores counts/action/time/length shapes, not messages. No recall importer reconstructs private text from aggregates or converts learned familiarity, old approval or agreement ratios into authority. |
| Goal alignment, review and provenance — `src/monitoring/GoalRealignment.ts:1–9`; `src/core/JudgmentProvenanceLog.ts:6–32`, `CoherenceJournalReader.ts:13–34`; `src/core/reviewers/context-completeness.ts:1`; existing class-review/decision/grade rows | Retain observation/review owners and restricted provenance, actual bounded input, findings, priority events, dry-run verdicts, review decisions and available outcome links; include other reviewers in `src/core/reviewers/` | GoalRealignment's inspected phase has no injection or planner-annotation seam. Keep it explicitly retained, not a claimed live recall source. Preserve raw-local versus redacted-read distinctions and known truncation; a current-labelled legacy journal stream is not proof of complete peer coverage. |
| Response-review context and durable review history — `src/core/conversationContextWiring.ts:1–34`, `untrustedConversationContext.ts:1–22`, `ResponseReviewDecisionLog.ts:1–23`, `:46–63`; `src/core/CoherenceGate.ts:498–520`; `src/commands/server.ts:17996` | Retain the review owner and capture permitted original turn references, bounded role-labeled context, truncation/source status, verdicts and available counterfactual/canary rows; keep the durable decision log distinct from the in-memory review window | The context provider can omit the context section on failure; its prompt contract is not proof the reviewer saw full history. The decision log keeps scrubbed excerpts and rotates; it swallows write failures. Preserve available unique evidence before rotation, and never infer a complete denominator or full-body custody from a review verdict. Legacy sender classifications do not become new standing. |
| Decision-quality and organizational drift evidence — `src/core/DecisionQualityRecorderImpl.ts:1–35`, `:186–225`; `DispatchDecisionJournal.ts:1–12`; `OrgIntentDriftAnalyzer.ts:1–16` | Retain judgment/measurement/review owners for enrolled settlement and outcome annotations, provenance sampling/budget dispositions, dispatch-specific journal rows and drift digests; preserve their real query and later-analysis consumers | The quality writer is gated and defaults to dry-run; dry-run suppresses durable writes, and separate provenance sampling can omit body context. A content-free quality row is not a full model-call capture. The drift analyzer is deterministic signal from a bounded review window, not a learned directive or new blocking policy. |
| Feedback factory — `src/core/FeedbackManager.ts:1–23`; `src/feedback-factory/store/FeedbackStore.ts:1`, `store/JsonlFeedbackStore.ts:1`, `store/FeedbackSourceGenerations.ts:123–144`, `processor/process.ts:7–12`, `processing/FeedbackProcessingService.ts:7–23`, `drain/FeedbackReadinessArbiter.ts:97–120` | Retain feedback owners for original reports, attachments, clusters, source generations, processing/reopen/verification history, drain obligations, initiative linkage and parity/import reports; preserve both local feedback and factory readers | Clustering, readiness assessment, processing counts and downstream initiative delivery are separate stages. Retain disabled/unwired and missing-source controls; import does not send old feedback again, close clusters or assume the factory is active. |
| Remediation evidence and learned runbook proposals — `src/remediation/NovelFailureReviewer.ts:25–46`, `:330`, `:390`; `audit/AuditWriter.ts:1`, `audit/AuditProjection.ts:111`, `IntentJournal.ts:1`; `src/server/routes/remediation-proposals.ts:1` | Retain remediation owners for audit, unmatched-event clusters, counters, proposed fixes, review decisions and intent/action reconciliation; preserve the proposal read surface | This is a separate source from SystemReviewer and CoherenceReviewer. Capture lawful historical evidence without replaying runbooks or transferring vault/lock authority; a signed suggestion does not prove a fix was approved, run or effective. |
| Channel originals, attached/pasted content and delivery evidence — `src/messaging/shared/MessageLogger.ts:83–158`, `telegramInboundFiles.ts:1`, `src/messaging/slack/RingBuffer.ts:1`, `FileHandler.ts:1`, `src/templates/hooks/slack-channel-context.sh:55–100`, `src/messaging/imessage/NativeBackend.ts:457`; `src/paste/PasteManager.ts:1–25`, `:457–468`; `src/lifeline/MessageQueue.ts:147`, `droppedMessages.ts:99` | Retain channel/intake/custody owners; capture available bodies, attachments, pasted files, per-platform history, queued inbound/outbound payloads, acknowledgments and loss/retry observations before expiry or cleanup | Preserve platform-specific reader coverage and distinguish full originals from ring buffers, offsets, ids or snippets. Privacy/consent filters remain owner-enforced. The Slack context-hook template fetches at most 30 cached messages and truncates each body; it is not installed in the inspected hook directory, so no live injection is claimed. Lifeline fallback/status is an independent consumer, not proof the main session processed the message. |
| Agent-to-agent history and derived briefings — `src/threadline/canonicalHistoryRead.ts:53–58`, `PipeSessionSpawner.ts:217–283`, `A2ACheckInProxy.ts:75–81`, `openConversationBrief.ts:313–333`, `A2ACheckInSummarizer.ts:1–18`; `ThreadlineMCPServer.ts:99`, `adapters/RESTServer.ts:60–76`; existing ThreadLog/ConversationStore rows | Retain threadline/custody owners for canonical log, available outbox/backfill, conversation metadata, bounded wrapper history, relay/listener inboxes and resume mappings; capture derived summaries, purpose labels, check-ins and digest/surfacing records | Preserve actual history, spawn-summary and user-bridge readers separately. The pipe summarizer takes a bounded recent subset and can report unavailable; its summary is untrusted derived evidence. A purpose template, check-in or in-memory adapter history is not a complete archive or direct participation. |
| Harness transcripts, tool results and provider context — `src/providers/primitives/observability/conversationLogReader.ts:1`, `conversationLogTailer.ts:1`, `src/providers/primitives/integration/conversationLogProvider.ts:1`, `sessionResumeIndex.ts:1`, `src/providers/primitives/control/inputInjection.ts:1`, `contextScopeControl.ts:1`; concrete adapters under `src/providers/adapters/`; `src/core/FrameworkSessionStore.ts:1` | Retain harness/assembly owners and capture available original transcripts, tool-result bodies, input transformations, resume indexes and actual delivery observations; register each supported adapter's concrete consumer | Capability/conformance declarations and optional thread-fork/rollback interfaces are not evidence that an adapter implements them. Preserve local/remote availability and confinement; each actual input channel joins captured-context accounting without acquiring private provider access. |
| Model-selection preferences and execution profiles — `src/providers/uxConfirm/PreferenceStore.ts:1–17`, `TriggerGate.ts:1`, `FrameworkModelRouter.ts:1`; `src/core/TopicProfileStore.ts:1`, `TopicProfileResolver.ts:1–25`, `EscalationHintStore.ts:1–38` | Retain routing/assembly owners for user/task-pattern confirmed choices, cost/catalog snapshots, profile pins and fallback observations, with their actual selection/confirmation consumers | These are distinct from conversational learned guidance. The expiring escalation hint only triggers a fresh destination-owner decision; it is not a model-tier grant. A stored pick cannot replace current model availability, cost, permission or explicit instruction checks; it does not establish recall quality. |
| Browser/account and capability pointers — `src/core/PlaywrightProfileRegistry.ts:623–701`; installed `session-start.sh:269–293`; `src/providers/parity/conversationalActionCatalog.ts:1`; existing capability/self-knowledge rows | Retain account/capability owners; capture permissible profile notes, source ages, action-catalog/skill metadata and consumer observations while credentials remain in vault custody | A boot pointer is not the browser's content, a login claim is not fresh access proof, and a cached action catalog is not permission to invoke it. Preserve custom skill bodies before regeneration; only the actual selected content can count as model input. |
| Reports and outward profiles — `src/publishing/PrivateViewer.ts:107–121`, `TelegraphService.ts:263`; `src/moltbridge/ProfileCompiler.ts:1–10`; `src/server/fileRoutes.ts:1` | Retain publishing/file owners for private-view bodies, metadata, available published content, profile drafts and approved-export evidence; record original source links | A remote page id or local publishing state is not original-body custody. Profile compilation's safe-tag selection and human review do not authorize broader export. Preserve actual report readers and restrictions; no migration republishes a private source. |
| Operational measurements, findings and notices — `src/monitoring/TokenLedger.ts:1`, `ResourceLedger.ts:1`, `FeatureMetricsLedger.ts:1`, `DashboardInsightEngine.ts:1`, `PresenceProxy.ts:1`, `PromiseBeacon.ts:1–24`, `src/messaging/SessionSummarySentinel.ts:109–117`; probes in `src/monitoring/probes/` | Retain measurement, monitoring and notification owners for available usage/health/quota/burn, blocker/claim/guard/recovery evidence, terminal slices, summaries, insight results and delivery observations; existing failure/growth rows remain distinct | Metering is not memory; its findings are eligible scoped evidence. Keep configured, observed, inferred and actually delivered states separate. Capture unique observations before rotation when they become retained recall support; missing sampling is unknown, not a healthy run. A status summary cannot complete a user's request. |

The remaining implementation directories supply these families rather than separate stores:
`src/config` supplies current configuration; `src/identity`, `src/security`, `src/privacy` and
credential/coordination helpers retain identity, secret and access-policy ownership;
`src/core/storage` and `src/utils` provide storage/rotation/read primitives. `src/data` (including the model-decision census at `provenanceCoverage.ts:215–334`),
`src/core/promptClauses.ts:1–43`, `src/scaffold` and `src/templates` supply registries,
versioned prompt/skill/job bodies and hooks whose
installed customizations and real consumers belong to the rows above. `src/commands` and
`src/server` expose those readers and production composition. Tunnel/transport/relay plumbing
retains available connection and delivery evidence with its owner, not an invented conversation
archive. `src/redteam`, `src/testing`, provider canary/conformance/example/parity scenarios and
permission test harnesses supply synthetic tests; their results stay distinct from real
learned episodes. Empty `src/harness-adapters` and `src/messaging/telegram-origin` directories
supply no additional source. Each other provider/feedback/remediation/threadline subdirectory
belongs to its explicitly named family above, including its read, migration and audit helpers.

For every additional family, NF-17a–j's migrated-or-retained-owner positive exercises the real
source and restarted scoped consumer with available support; pair missing, disabled/unwired
and restricted-source cases. NF-21 additionally checks actual model input or the actual user
read/delivery surface the row declares. Do not require model submission of a source deliberately
retained only for an owner/user surface; report that distinction. Runtime positives remain
**non-executable until `seam-response-recall-doorway-grants.md` lands for section 14's full
NF-17a–j/18/21 dependencies, `seam-response-declarations.md` row 77 lands, and P21-A1/A2 land**.
Retaining a writer with its existing owner introduces no new owner operation or payload.

Name-only matches also checked: `src/core/baselineProcessPatterns.ts:1`,
`src/monitoring/MemoryPressureMonitor.ts:1` and `hostMemoryPressure.ts:1` describe process
classification or physical machine memory, not retained conversational memory. They stay with
resource/infrastructure owners. `src/monitoring/FeedbackAnomalyDetector.ts:1–12` is an ephemeral
submission-rate gate, not a feedback-content archive; retain any available owner observations,
but do not invent missing pre-restart history from its reset counters.

Memory-related job templates under `src/scaffold/templates/jobs/instar/` have these explicit
consumer dispositions; each citation is a template, not an observed job run:

| Templates / current consumer | Preserve | Change or retire |
|---|---|---|
| `reflection-trigger.md:18–42`, `insight-harvest.md:24–38`, `relationship-maintenance.md:17` | Activity-to-note, unapplied-learning-to-proposal and relationship-staleness observations | Supervised maintenance admits source-linked derivations; replace direct note edits and discretionary per-item sends with declared custody and owner notice policy. A sampled tail of activity is not full elapsed-window coverage. |
| `correction-analyzer.md:1–35`, `correction-class-review-backstop.md:1–23`, `failure-analyzer.md:1–38` | Separate weekly recurrence, daily record-time recovery and failure-learning analyses, their enabled/disabled defaults and supervision instructions | Preserve each distinct obligation, including below-threshold correction review. Prove real scheduled owner/consumer use; template supervision text alone cannot pass. |
| `evolution-proposal-evaluate.md:24–38`, `evolution-proposal-implement.md:24–33`, `evolution-overdue-check.md:24–37` | Proposal evaluation/implementation inputs, overdue work and source evidence | Preserve owner approval boundaries and outstanding work. The overdue template's body permits advancing/cancelling despite its report-only description; neither text is imported as new authority or permission to close a directive. |
| `overseer-learning.md:18–34`, `overseer-maintenance.md:18–30` | Category reports, handoff findings and cost/usefulness questions | Feed retrospective outcomes under registered budgets; a quiet job or falling work count does not prove successful learning. Memory-hygiene/export names in overseer prose do not establish a concrete executed job. |
| `mentor-onboarding.md:1`, `identity-review.md:1`, `org-intent-drift-audit.md:1`, `initiative-digest-review.md:1`, `docs-coverage-audit.md:1` | Permitted onboarding lessons, identity/drift evidence, initiative summaries and documentation-coverage findings when used as recall sources | Preserve captured reports and their provenance; keep identity, org intent, work decisions and documentation truth with their owners. These observers do not confer authority through memory. |
| `llm-decision-grading.md:1`, `bench-refresh.md:1`, `benchmark-divergence-analysis.md:1`, `review-canary-battery.md:1`, `commitment-detection.md:1`, `commitment-checkin-reminder.md:1` | Decision/outcome/benchmark and commitment evidence feeding recall/learning | Consume current judgment, verification and commitment-owner records; migrate source readers with their owners, without turning a remembered grade, proposal or reminder into fresh authority. |

The remaining templates concern health, release, routing, feedback transport or other operational
observation; they are not independent memory stores. Their captured findings are eligible source
evidence under the same source/consumer declarations, and their actions remain with their owners.
Adaptive playbook scripts remain a single migration family with separately inventoried manifest,
assembly, relevance, annotation, reflection, micro-evaluation/evaluation log, decay, deduplication,
retirement, lifecycle, mount, history, scratchpad, verification/HMAC, privacy/DSAR and backend
state artifacts (`playbook-scripts/` and the command surface above). HMAC means a keyed integrity
check; it does not prove truth or permission. DSAR is the legacy user-data export/deletion command
family; its name grants no new deletion permission. Capture every referenced unique body and
source state before switching these consumers; preserve quarantine and existing privacy
constraints, while removal from a served view does not erase retained lawful history.

P21-A2's migration manifest must give each row's concrete installed artifact and consumer a
captured/imported, retained-with-existing-owner, or explicit unavailable disposition. For each
migrated source family, NF-17a–j exercises the real producer → retained import → restarted scoped
reader → actual consumer sequence and an absent/disabled/restricted neighbor; NF-18 adds peer
variants where the row declares replication. NF-21 proves current context consumption through
production initialization, not a helper's returned string. Other owners' retained action writers
are not silently redirected or replayed. These obligations remain non-executable under the full
NF-17a–j/18/21 dependency rows in section 14, including `seam-response-recall-doorway-grants.md`
and row 77 of `seam-response-declarations.md`; source inventory alone supplies no runtime pass.

**Rule — structural composition replaces inconsistent injection paths.** Rules 1, 30, 44,
47, 66, 78, 96 and 110; **checks: P21-NF-03/05/10/17a–j/21**. Topic-intent briefings,
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
70 and 111; **checks: P21-NF-05/09/11/17a–j**. The recorded installed baseline is
[installed-baseline-results.json](research/fixtures/installed-baseline-results.json), executed
at `2026-09-12T21:28:56.178Z` with real installed methods and synthetic collaborators, no model
provider or production-state mutation. [The permanent regression contract](fixtures/legacy-regressions.json)
retains those observed results and separate post-migration expectations; it does not replace
the historical failures with invented passing output.

| Permanent case | Recorded failure | Required migration result |
|---|---|---|
| P21-REG-F1 | 250 new messages; prompt contains 200, missing first 50; saved count/last id both 250 | Every original remains recoverable; summary coverage names exactly consumed spans and leaves the prefix pending until processed |
| P21-REG-F2 | Hybrid result count 1, fresh source and entity name present; actual preference body absent | Preference body, speaker and source reach actual submitted context, or exclusion is explicit with degraded disposition |
| P21-REG-F3 | Working assembler makes six lexical calls and zero hybrid calls for the installed fixture | The declared meaning-sensitive route is actually invoked on the lexical-mismatch repair variant and its evidence reaches input; a lexical-only experiment arm reports itself honestly but cannot pass complete general-recall activation |

Run original baseline observations against hash-matching installed artifacts, then run repair
variants through P21 unit, integration and lifecycle paths. A different package version is a
new labeled baseline, not a reproduction of 1.3.1237. F3 does not require dense search on every
turn or prescribe an engine. The dense/hybrid variant tests that advertised arm; a different
meaning-sensitive route must pass the same doorway evidence check. The old empty stub is
not a semantic accuracy test. Each case also tests zero match,
deadline, budget boundary, source outage and actual renderer/submission behavior. Future tests
may never be skipped merely because a replacement engine uses a different internal method.

**Rule — migration is additive and restartable.** Rules 7, 32, 33, 44, 45 and 90;
**checks: P21-NF-11/17a–j/18**. Enumerate all installed stores, scripts, hooks, producers,
consumers and per-machine schema versions; capture originals before conversion. A dry run maps
every input to an imported record or explicit inert/unavailable disposition. Origin, known
identity, missing attribution and old expiry remain historical data, not new authority. Import
checkpoints bind source hashes and versions; reruns do not duplicate a source, while changed
source content creates another preserved version. Rebuild indexes, compare permitted retrieval
and original reconstruction, then switch the declared consumer binding. Rollback restores the
prior consumer against retained compatible sources; it neither deletes new history nor replays
uncertain external effects. No email/agent completeness claim is made before its owner trace.

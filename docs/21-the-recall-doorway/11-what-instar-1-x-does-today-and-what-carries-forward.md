## 11. What Instar 1.x does today and what carries forward

**Rule — migration starts from a captured inventory, not an optimistic module name.** Rules
7, 33, 44, 45, 46, 69, 89, 90 and 111; **checks: P21-NF-09/11/12/17/18/21**.
The migration target is installed Instar **1.3.1237** plus its installed `.instar/hooks/instar/`
artifacts, identified in [R2 §§1, 8](research/02-dawn-grounding.md). The dirty reading-aid source
checkout at `5b36623a99327e74abe5ef04d63019f9aca6b1c5` is separate; [R1 §10](research/01-instar-1x-memory.md#10-snapshot-identifiers-and-validation-boundary)
pins its inspected mutable files. Unpinned live state and private incidents are not silently
attributed to either snapshot. The rows below cite the 1.x source paths audited in R1, not
landed Instar 2.0 code. The correction/preference lifecycle and replicated knowledge, relationship
and learning audits below also read current 1.x source and the applicable installed hook directly;
they do not claim an installed-method execution. Each engine needs
an adapter and owner contract audit before migration.

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
| KnowledgeReplicatedStore / `src/core/KnowledgeReplicatedStore.ts:328`, `:496`, `:530`; `src/commands/server.ts:12241–12295` | Address-or-title plus type identity, surviving concurrent catalog variants, deletion-aware served views and escaped foreign metadata | Local ids/paths as cross-machine identity; metadata transfer or the local-only, unused union reader as proof of peer body custody or context delivery |
| RelationshipManager / `src/core/RelationshipManager.ts:161`, `:175`, `:783` | Person notes/arcs as labeled derived candidates plus original-exchange lookup | Name-only channel identity resolution and recognition treated as permission |
| RelationshipsReplicatedStore / `src/core/RelationshipsReplicatedStore.ts:409`, `:578`, `:618`; `src/commands/server.ts:5098–5130`, `:6976–6992` | Channel-set identity keys, surviving concurrent variants, tombstone-aware served views and escaped foreign context; separate peer-read consumer | Local universally unique identifier (UUID) as cross-machine identity; interpreting the local-only loader or wired helper as actual peer injection; merging imported people into authenticated principals |
| SelfKnowledgeTree / `src/knowledge/SelfKnowledgeTree.ts:94`; TreeTraversal / `src/knowledge/TreeTraversal.ts:207` | Traceable bounded recursive-source adapter for capability/state and eligible history | Assuming its present source selection already searches every conversation |
| Playbook / `playbook-scripts/playbook-assemble.py:79`, `:157`; `playbook-retirement.py:68`; `playbook-mount.py:1` | Declared scoped lesson selection, quarantine, retained metadata and explicit shared snapshots | Integrity fallback silently treated as verification; unretained path bodies; automatic sharing by name |
| Learnings / `src/core/EvolutionManager.ts:1165`, `:1187`, `:1247` | Case-linked procedural lesson producer and evaluated use | Pruning unique lessons or treating registry insertion as semantic delivery |
| LearningsReplicatedStore / `src/core/LearningsReplicatedStore.ts:373`, `:557`, `:591`; `src/commands/server.ts:12140–12160` | Content-anchored identity, surviving concurrent advisory variants, tombstone-aware views and escaped foreign learning body; journal-backed union reads | Local learning id as cross-machine identity; treating the available union/renderer as an already wired session-context consumer; promoting a peer lesson to authority |
| PreferencesManager / `src/core/PreferencesManager.ts:39–90`, `:133–179`, `:309–403` | Captured learned-guidance records, correction-loop provenance, observation time, confidence and recurrence metadata; bounded advisory context | In-place upserts as a complete correction history; `count` as proof every preference was delivered; learned hints as authority |
| CorrectionCaptureLoop / `src/monitoring/CorrectionCaptureLoop.ts:306–429`; CorrectionLedger / `src/monitoring/CorrectionLedger.ts:330–415`; CorrectionAnalyzer / `src/monitoring/CorrectionAnalyzer.ts:143–209`; CorrectionLoopDriver / `src/monitoring/CorrectionLoopDriver.ts:186–480` | Scrubbed correction evidence, bounded occurrence analysis, durable route clusters and finite rechecks, connected to the real preference consumer | Optional capture as complete intake; discarded unique pending evidence; route reservation or disk presence as proof of application, use or effectiveness |
| SelfViolationDetector / `src/monitoring/SelfViolationDetector.ts:81–114`; `src/server/routes.ts:3396`, `:3554–3593` | Observe-only matched-pattern evidence feeding later analysis, with explicit guidance and context links in the replacement | Treating a heuristic match as confirmed violation, an unawaited observation as delivery proof, or the prefixed observation hash as the original preference key |
| PreferencesReplicatedStore / `src/core/PreferencesReplicatedStore.ts:305–367`; server composition / `src/commands/server.ts:5047–5078` | Union semantics preserve concurrent non-deleted variants as advisory candidates; retained origin/conflict evidence | Assuming the inspected local-only loader proves peer delivery; suppressing all hints while optional conflict cleanup waits |
| Preference context route / `src/server/routes.ts:24588–24666`; installed `.instar/hooks/instar/session-start.sh:149–176` | Configured source precedence and bounded rendered preference body reaching session start | Silent hook skip as successful recall; replacing the store without migrating the route and actual context consumer |
| MemoryMigrator / `src/memory/MemoryMigrator.ts:71`, `:142`, `:463`; MemoryExporter / `src/memory/MemoryExporter.ts:125`, `:196`, `:213` | Versioned source import and disposable served export | One-time source-key dedup that misses later edits; nonempty partial export replacing uncaptured unique memory |
| MessageStore / `src/messaging/MessageStore.ts:1`; ThreadLog / `src/threadline/ThreadLog.ts:1`, `:474`, `:522`; ConversationStore / `src/threadline/ConversationStore.ts:220` | Direct/indirect exchange sources, stable message identity, cold history and authorized resume | Count/hash-only retention as an archive; assuming every store reaches the principal context |

These dispositions follow [R1 §§3–4](research/01-instar-1x-memory.md) and the targeted installed
recheck in [R2 §8](research/02-dawn-grounding.md#8-comparison-with-the-installed-1x-target).
They are proposed migration semantics, not a claim those changes have been executed.

**Rule — corrections retain the lifecycle that produces and maintains guidance.** Rules 7,
24, 26, 33, 44, 45, 55, 85, 86 and 89; **checks: P21-NF-05/11/12/17/18/21**.
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

**Rule — learned preferences retain their actual consumer and evidence limits.** Rules 7,
33, 44, 45, 47 and 89; **checks: P21-NF-05/11/12/17/18/21**. This source audit supplements
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
scrub, retain qualifying occurrences across the required days/sessions, run the real scheduled
analysis and route, store guidance, restart, then observe its body in actual captured context
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
`seam-response-recall-doorway-grants.md` lands for the complete NF-17/18/21 dependencies in
section 14**, together with their inherited grants and P21 implementations. The three executed
baseline observations remain distinct.

**Rule — replicated knowledge preserves catalog identity without inventing body delivery.**
Rules 7, 31, 33, 44, 45, 57, 89 and 90; **checks: P21-NF-05/11/12/17/18/21**.
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
address and type. Real peer custody, import, restart and actual principal input must preserve
the key and foreign attribution; concurrent divergent summaries remain separate eligible
guidance. Pair metadata-only transfer with separately captured-body retrieval: only the latter
can satisfy a required original-text claim. Additional controls cover title fallback without an
address, distinct types, changed identity inputs, an empty anchor, absent/disabled peer custody,
an unwired consumer, hostile foreign markup, scope/budget exclusion, a resolved tombstone plus
a stale returning peer, and a surviving concurrent put beside a tombstone. Rebuild and repeat
through startup and compaction; no deleted value reappears in served views, no foreign metadata
becomes authority, and helper output alone cannot pass. This migration positive is
**non-executable until `seam-response-recall-doorway-grants.md` lands for the complete
NF-17/18/21 dependencies in section 14**, with their inherited grants and P21 implementations.

**Rule — replicated relationships preserve identity evidence and consumer limits.** Rules 7,
28, 31, 33, 44, 45, 89 and 90; **checks: P21-NF-05/06/11/12/17/18/21**.
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
therefore does not establish live peer context, automatic principal injection or any installed
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
permitted note body with its origin through captured principal context. A concurrent divergent
note retains both eligible variants without waiting for conflict cleanup. Paired cases cover
a changed channel set without a verified mapping, a channel-less local record, missing peer
custody/local-only operation, disabled replication, a resolved tombstone followed by a stale
peer, a surviving value beside a concurrent tombstone, scope refusal, and hostile markup in
foreign fields. Assert no foreign identity becomes principal authority and no deleted value
reappears in the served view. Repeat at startup and post-compaction; helper output alone fails.

**Rule — replicated learnings preserve advisory variants without inventing injection.** Rules
7, 31, 33, 44, 45, 57, 89 and 90; **checks: P21-NF-05/11/12/17/18/21**.
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
`seam-response-recall-doorway-grants.md` lands for their section 14 NF-17/18/21 dependencies**,
together with those rows' inherited grants and P21 implementations. No repaired execution or
live peer injection is claimed here.

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
| P21-REG-F3 | Working assembler makes six lexical calls and zero hybrid calls for the installed fixture | The declared meaning-sensitive route is actually invoked on the lexical-mismatch repair variant and its evidence reaches input; a lexical-only experiment arm reports itself honestly but cannot pass complete general-recall activation |

Run original baseline observations against hash-matching installed artifacts, then run repair
variants through P21 unit, integration and lifecycle paths. A different package version is a
new labeled baseline, not a reproduction of 1.3.1237. F3 does not require dense search on every
turn or prescribe an engine. The dense/hybrid variant tests that advertised arm; a different
meaning-sensitive route must pass the same doorway evidence oracle. The old empty stub is
not a semantic accuracy test. Each case also tests zero match,
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

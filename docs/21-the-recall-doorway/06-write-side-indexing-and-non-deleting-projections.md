## 6. Write-side indexing and non-deleting projections

**Rule — original custody precedes memory formation.** Rules 7, 24, 31, 33, 43, 45, 85,
89, 90 and 96; **checks: P21-NF-05/09/11/12/18/23**. Four's intake and Two's custody
retain the original admitted exchange before P21 indexing begins. The read side must not wait
for embeddings or summarization to establish that an intake exists. The landed capture dependency
requires preservation equivalent to `fsync`, flushing accepted bytes to durable storage
(`src/intake/contracts.ts:25–28`); that interface alone
does not establish every deployed email or agent-exchange producer. Complete non-topic intake
is a separately named dependency in section 14.

When a relevant admitted fact lands, a durable cursor over source history makes it eligible for
the following declared indexing work. A process-local callback may wake the worker, but cannot
be the sole queue. A restart re-enumerates pending source identities from history minus admitted
coverage; duplicate notification is idempotent by source hash, projection version and scope.

| Source class | Immediate deterministic index material | Optional derived work |
|---|---|---|
| Inbound/outbound exchange | Original capture/span, author/forwarder/recipient, conversation/account, event and ingestion times, language and body/attachment completeness | Chunk keys, summaries, entities, embeddings, episodic grouping |
| Correction, cancellation, changed preference | New source plus explicit relation to earlier evidence and validity boundary where established | Updated current-belief projection, contradictory alternatives and invalidated cached support |
| Commitment/directive/authorization evidence | References to owner records and their causal relationships | Search cues pointing to owner resolution; no new authority value |
| Relationship or imported note | Captured source, known identity references, origin and missing provenance | Person/arc summaries, with uncertain identities kept unresolved |
| Grade, complaint or observed outcome | Original observation/grade reference, affected root, criterion and source time | Coherence hypothesis, candidate replay case and procedural lesson |

**Rule — projection coverage describes what was processed.** Rules 7, 13, 33, 45 and 96;
**checks: P21-NF-05/09/11/17/23**. Each index version reports per-lineage folded-through
frontier, processed source/span sets, unsupported kinds, pending ranges, failures and holes.
It advances a complete frontier only after all required work up to that frontier is admitted.
A summary built from messages 51–250 may declare precisely that subset; it may not checkpoint
messages 1–250 as fully summarized. Per-span progress supports bounded batches without blocking
all useful reads. Original lookup remains available for the missing prefix.

An index error, unsupported attachment, partial email capture or unembedded item is explicitly
different from a source with zero matching facts. Quarantine retains the failed input, error,
owner, attempt count and bounded next action. Expiring a retry does not delete unique input.
The writer records a durable completion fact only after the derived artifact is recoverable;
process termination before that fact causes safe idempotent recomputation or observation, never
a skipped source. Index lag and oldest pending work are measured, not inferred from service uptime.

**Rule — generated memory is admitted data; rebuilding views is deterministic.** Rules 7,
31, 33, 45, 57, 75 and 90; **checks: P21-NF-11/12/18/19/23**. The landed fold language
is closed and data-only (`src/projections/fold.ts:1–23`). It does not run a large language model
(LLM) inside a fold.
A registered extraction/reflection producer therefore captures its exact input, model/prompt,
output, source frontier and charges, then proposes an immutable derived-memory record through
normal admission. An informational projection deterministically folds those admitted records.
Replaying a generation does not invoke a fresh model and pretend nondeterministic output is
the same projection. New extraction behavior creates a new version with its own provenance.

Three evidence kinds remain distinct even if they share physical storage:

| Kind | Update and contradiction behavior | What it cannot prove |
|---|---|---|
| Original episode | Append later corrections/annotations while retaining the original capture and context | That every statement in the exchange was true, or that a quoted speaker was authenticated |
| Derived belief | Append support/challenge/supersession; retain derivation and validity/uncertainty; resolve current and historical queries separately | An original first-person statement, independent corroboration, or current approval |
| Procedural lesson | Append proposed/accepted/rejected lesson with originating case and measured use; invalidate bad lessons through further evidence | That the hypothesized cause was proven, or that a procedure overrides standing/governance |

**Rule — summarization and reflection never delete unique memory.** Rules 7, 32, 33, 44,
45 and 90; **checks: P21-NF-11/12/17/18**. Summaries, graphs, vectors, working sets and
exported MEMORY.md are disposable views only when all unique inputs and derivations remain in
authorized recoverable custody. Each projection declares its source inventory, rebuild recipe,
schema/model version, scope policy, retention class and resource budget. Rebuild/delete of an
index must prove original reconstruction before old derived storage is retired. A confidence
decay or low-use rank changes selection, not original retention or truth.

Redaction and secret custody follow Two's separately governed policy. P21 creates no general
forget/delete operation and cannot use an embedding expiration, archive rotation, migration,
or “anonymization” as a back door to destroying unique content. Imported files are captured
before any export can replace their served view. Privacy-limited unavailable originals remain
unavailable, with honest provenance limits, rather than fabricated support.

**Rule — background intelligence has owners and budgets.** Rules 38, 39, 41, 55, 57, 60, 61, 75, 85
and 114; **checks: P21-NF-04/08/11/19/23/24**. Indexing, summarization, reflection,
contradiction detection and retrospective miss review are separate declared work classes.
The scheduling owner holds their queue, deadlines, retries, cancellation and recovery. The
memory sentinel submits findings or repair proposals; it cannot silently rewrite originals,
install a lesson as authority, or send a notice. A proposed pilot worker permits one background
job at a time per declared resource pool, yields to control/user work, and caps each batch at
200 source messages and 1 mebibyte (MiB; 1,048,576 bytes) of loaded original text. These are
unmeasured defaults subject to section 15.

The scheduling owner admits each durable job and P21 opens its MAINTENANCE root using
section 2's admission path, even when no conversational root exists. The root's reserved job
envelope includes every formation and supervisor call before execution begins.
Critical background formation, repair and migration procedures declare at least Tier 1 LLM
supervision through the judgment owner: the supervisor validates each programmatic step's
observed result before the next critical step. Its calls, failures and findings are captured
and charged to that durable job, never hidden inside a zero-helper ordinary recall budget.
It cannot override deterministic custody, scope or admission failures. This maintenance
supervision is separate from selective live message review; it supplies no new sender or hold
authority. The scheduled owner selects the most efficient registered supervisor route whose
current matching benchmark evaluation passes its task class's quality and safety bars.
Missing, stale, retracted, conflicted, mismatched or failing support makes supervision
unavailable under that owner's declared failure direction; an unmeasured route cannot satisfy
this supervised-maintenance positive. Section 14 U27/U30 name the current-route and
measured-support grants separately.

The positive NF-04/19/23 trace starts with retained source input and no active conversational
root. A real admitted scheduled memory item obtains its MAINTENANCE root and reserved finite
job envelope. Its supervisor and summarization/extraction/reflection children submit through
the judgment owner with actual input/output captures. The supervisor validates every business
step required by the registered critical pipeline. Normal admission stores the derived result
and exact coverage; resource-owner evidence accounts for all calls and remaining exposure.
The trace must succeed with ordinary conversation's zero-helper policy still configured and
zero attempted outgoing messages or external task effects. Paired cases refuse a child
sender/root request, a caller-forged work item, exhausted or missing job bounds, and a missing supervisor or stale/mismatched/failing benchmark evaluation. Restart
before completion retains the same root/reservation and pending coverage. This trace is
non-executable until rows 90/91 of `seam-response-recall-doorway-grants.md` land and the complete
NF-04/19/23 dependency rows in section 14 are satisfied, including
**NON-EXECUTABLE-UNTIL-row-27-part-seven-runtime-route** and
**NON-EXECUTABLE-UNTIL-row-30-benchmark-route-support**: the corresponding scopes in
`seam-response-judgment.md` and `seam-response-assembly-followup.md` must land.
A one-shot execution is evidence for this worker path only; the complete migration and
recurring-work positives also need section 14 G84's calendar adapter and successive-occurrence
proof. No one-shot trace proves the daily backstop or weekly preference analysis.

**Value — preserve raw values while experimenting with better keys.** R1's summary gap and
snapshot imports ([R1 §§3, 7](research/01-instar-1x-memory.md)), Dawn's formation/consolidation
tradeoffs ([R2 §2](research/02-dawn-grounding.md)), and external enriched-key versus extracted-value
comparisons ([R3 §§2–6](research/03-external-research.md)) motivate this separation. Neither
reflection nor a graph has earned authority to replace what the person actually said.

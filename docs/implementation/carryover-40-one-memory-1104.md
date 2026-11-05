# Carryover row 40: One Memory relationships, ported from 1.x

Row 40 of `lanes/carryover-1028.md` (One Memory / cross-topic history / relationship awareness: "I do not
start over when changing topic, session or machine") is OPEN. This note records what the full-parity
continuation of 2026-11-04 carried from `JKHeadley/instar` commit `4f88880a45f0a119aae3cfd2ccaf9ace26d405b9`,
what it adapted, what it left out and why, so the remaining gap is named rather than implied.

## Where the 1.x feature lives in 2.0

| 1.x | 2.0 | Carried how |
|---|---|---|
| `RelationshipsReplicatedStore.ts` | `tests/preview/relationship-store.ts` | Ported with its names and section order; the replicated-store substrate it imported (envelope validator, path jail, HLC total order, witness classification, union read) is ported into section 0 of the same file because 2.0 has no replicated record store. |
| `RelationshipManager.ts` | `tests/preview/relationship-manager.ts` | Ported over an injected store port and clock/id ports. The persistence funnel, replication emitter seam, peer-read seam, merge and tombstone logic are the 1.x code. |
| per-person JSON files under `.instar/relationships/` | the encrypted journal's `PersonNote`, `PersonAttribute`, `PersonMerge` rows, read by `tests/preview/relationship-journal.ts` | New projection, read-only. |
| journal `relationship-record` entries replicated to peers | `person` entries of the sealed group-carry frame (`tests/preview/group-carry.ts`), validated by the store schema on every replay | New wiring on the existing carry. |
| union read on the receiving machine | `readUnion` / `unionOfOriginRecords` / `mergeUnionToRelationships` over carried records | Ported logic; the receiving machine is the one that adopted the replicated journal. |
| `ReplicatedRecordEmitter.ts` (send side) | `tests/preview/relationship-emitter.ts` | Ported with its names, order and stats. The own-stream is the private root's encrypted journal (`relationship-emit` frames); the per-store stateSync flag is the sealed group disclosure grant naming this root as a carry source; the HLC clock and the witness are read from the journal's own emits. `emitRelationshipChanges` is the manager's save funnel driven from the journal rows. |
| `JournalSyncApplier.ts` (receive/serve side) | `tests/preview/relationship-applier.ts` | Ported trust rules (first-hop binding, seq gating, schema validation, suspect self-clear, lineage fencing, truncation signal, byte-capped serve). The replica is the group root's own journal (`group-carry-refresh` frames); `refreshGroupCarry` runs it under the carry's grant, audience, posture and stop checks. |
| `journal-sync` MeshRpc verb, advert/delta loop | `refresh-group` command and the per-cycle step in `journal-agent.mjs` | The predecessor is read from its journal on this machine or from the verified replica copy the owner shipped (journal-replication.ts); no new transport. |

## Lines carried versus newly written

Carried lines are final lines unchanged from the raw copy (commit `8e7df7f5`); adapted lines are the lines the
step-2 diff added. Counts from `git diff --numstat 8e7df7f5 87a8efec`.

| File | Raw 1.x | Final | Carried | Adapted |
|---|---|---|---|---|
| relationship-store.ts | 735 | 1232 | 666 | 566 |
| relationship-manager.ts | 1010 | 839 | 606 | 233 |
| relationship-journal.ts | 0 | 151 | 0 | 151 |
| relationship-carry-fixture.ts | 0 | 40 | 0 | 40 |
| group-carry.ts (edit) | 186 | 226 | 182 | 44 |
| relationship-manager.test.ts | 719 | 582 | 491 | 91 |
| relationship-store.test.ts | 423 | 463 | 407 | 56 |
| relationship-stale-context.test.ts | 203 | 188 | 148 | 40 |
| relationship-replication-emit.test.ts | 149 | 157 | 121 | 36 |
| relationship-union-read.test.ts | 139 | 112 | 59 | 53 |
| relationship-cross-machine.test.ts | 180 | 100 | 7 | 93 |
| relationship-carry.test.ts | 0 | 165 | 0 | 165 |
| relationship-journal.test.ts | 0 | 76 | 0 | 76 |
| relationship-emitter.ts | 285 | 410 | 239 | 171 |
| relationship-applier.ts | 1139 | 809 | 485 | 324 |
| relationship-emitter.test.ts | 162 | 298 | 92 | 206 |
| relationship-applier.test.ts | 690 | 458 | 127 | 331 |
| relationship-roundtrip.test.ts | 212 | 170 | 9 | 161 |
| group-carry.ts (second edit) | 226 | 263 | 208 | 55 |
| journal.ts (edit) | — | — | — | 27 |
| journal-agent.mjs (edit) | — | — | — | 100 |
| capabilities.ts, capabilities.declarations.json, relationship-journal.ts (edits) | — | — | — | 49 |
| group-carry-cli.test.ts (edit: refresh-group case) | — | — | — | 93 |

Source: 2,178 carried / 1,760 adapted. Tests: 1,461 carried / 1,401 adapted (the per-record replication module of
2026-11-05: counts from `git diff --numstat bccfc149 31057753`). Fifteen further 1.x files
(8,635-line `types.ts` included) are kept verbatim under `legacy-1x/relationships/` and are not compiled.

## Omitted 1.x behavior, with the 2.0 evidence

| 1.x behavior | Why it is not carried | 2.0 evidence |
|---|---|---|
| Plaintext `<id>.json` per person, `loadAll` from a directory, atomic write-then-rename | The durable record is the encrypted journal; a second unencrypted PII store beside it would weaken the secrets floor. | `tests/preview/journal.ts` sealed frames; `relationship-journal.ts` reads people from the journal; the manager's store port is in memory or read-only over the journal. |
| `findOrCreateAsync` / `askIdentityMatch` / `askDuplicateConfirmation` (LLM prompts answered `MATCH:N` / `NEW` / `YES`) | A regex over a model answer deciding whether two names are one person is the literal classifier Rule 10 keeps out of the live runner; 1.x itself warns "when uncertain, prefer creating a new record over a false merge". | `journal.ts` `mergeCandidates` offers the pair; a link takes effect only on a verified operator confirmation (`PersonMerge.confirmation`, `activePersonMerges`), and a corrected confirmation stops joining (`relationship-carry.test.ts`, last case). |
| Deletion intent log bracketing a file unlink (`DeletionIntentLog`, writer-agnostic reconciler) | There is no second writer process to reconcile against; one lease holder writes the journal. | `journal-replication.ts` header ("One lineage, one writer"); the forget row itself is the positive deletion signal before a carry (`relationship-cross-machine.test.ts`, second case). |
| HTTP routes `GET/DELETE /relationships*`, `instar relationship` CLI, server wiring, `ConfigDefaults` dev gate | 2.0 has no agent HTTP server or CLI for relationships; the operator reaches relationship context through the journal packet and status command, and every read passes the disclosure and audience checks of the carry. | `legacy-1x/relationships/README.md`; `tests/preview/README.md` "Relationship awareness". |
| `PostUpdateMigrator` CLAUDE.md "One Memory" splice | 2.0 generates its capability briefing from declarations and README lines, not from a template file in each agent. | `generated/capabilities.json`, `tests/preview/README.md` Capabilities section. |
| Slack `RelationshipAnomalyScorer` / `RelationshipBehaviorStore` | WS23 permission scoring, not One Memory; named follow-on. | kept verbatim under `legacy-1x/relationships/src/permissions/`. |
| Console warning at the channel cap | A silent console line is not a record. | `RelationshipManager.refusedChannelLinks` and `linkChannel` returning `false`. |
| `journal-sync` over signed MeshRpc, routes, advert/delta request loop, `getAdvertState` discovery of many peers | 2.0 moves whole encrypted journals between the two machines over the existing bearer-secret replica route and verifies the copy before anything reads it; the group root reads the one predecessor it carried. | `journal-replication.ts` (`openReplicaStore`, `createJournalShipper`, `adoptReceivedCopy`); `refresh-group` opens the predecessor's journal or its `replica/journal.copy` read-only (`relationship-roundtrip.test.ts`, second case). |
| Peer replica files + meta sidecar, `guardWrite` standby seam, fsync spy tests | The group journal is the replica: one `group-carry-refresh` frame per batch through the journal's durable append (fsync before return), re-validated on replay; a read-only or stopped destination refuses the frame and the applier reports 0 applied. | `relationship-applier.test.ts` "ack-after-durable-commit"; `durable-write.ts` already proves the journal's write durability. |
| Incarnation quarantine (rename aside, ≤2 kept) and the 10-minute flap window | A changed predecessor is refused whole and surfaced once (Rule 95 fail direction); a group root never adopts a second predecessor history under one scope. | `JournalSyncApplier.markRefused`, `refreshGroupCarry` "predecessor lineage changed"; `relationship-applier.test.ts` "lineage fencing". |
| Truncation fast-forward of `lastHeldSeq` | Emits survive compaction inside the snapshot, so the served stream is never truncated; a watermark above the held seq marks the stream `gapped` and nothing past the hole is applied, because the refresh frames are contiguous by replay rule. | `relationship-applier.test.ts` "truncation signals". |
| `multiMachine.stateSync.<store>.enabled` configuration flag | A caller boolean is not authority; the gate is the operator's sealed, unexpired, unrevoked disclosure grant naming the root as a carry source. | `ReplicatedRecordEmitterSeams.permission`; `relationship-emitter.test.ts` "dark gate". |
| `LearningsReplicatedStore` and the other six registered kinds | Not One Memory; 2.0 registers the one relationship kind. | `relationshipKindRegistry`, `relationshipReceiveRegistry`. |

## What this does and does not demonstrate for row 40

Demonstrated by can-fail tests (red against the base carry module: 7 of 8 new carry cases fail; green after; the
replication module's 45 cases fail whole against the base, whose journal has no emit or refresh frame):

- topic boundary: the journal's people are one record across the lineage, read through the ported manager;
- authorized private-to-group boundary: people travel only under the sourced grant and verified audience the
  carry already requires, validated per entry on replay, served only as quoted untrusted data; a predecessor
  with no grant, an unverified audience, another operator, an expired grant or a stop carries nobody, and a
  changed predecessor (another private root with its own valid grant) cannot replace the people a fixed one
  carried;
- session boundary: the carried people survive close/reopen and reach the actual worker's model packet;
- machine boundary: the carried journal's bytes shipped to a second machine's replica store, verified,
  adopted, and read there as foreign-origin records; two roots knowing the same person collapse to one
  recordKey and are flagged rather than merged;
- continuous authorized refresh (the per-record module): the private root emits a put per changed person and a
  tombstone per forgotten, corrected or merged-away key into its own journal, dark without a grant; the group
  root applies them under the carry's grant and audience, first-hop bound, seq-gated, schema-validated, one
  durable frame per batch, and its worker serves the current account with the forgotten person gone; the same
  refresh runs on machine B from the predecessor's verified replica copy against B's adopted group root; an
  unauthorized, stale, stopped, second or re-seeded predecessor is refused before any record is read; the shipped
  `refresh-group` command does the same through the confined HTTP membership bridge (`group-carry-cli.test.ts`).

Not demonstrated, so row 40 stays OPEN:

- a live run on the exact head (no live claim is made here); the launcher's per-cycle emit/refresh step is wired
  (`journal-agent.mjs`, `node --check` clean) and its engine is tested, but no launcher-level test drives the
  step through a served cycle yet (follow-on);
- a live union of relationship records across two serving machines: 2.0 replicates whole journals, so the
  union read runs over carried and refreshed records inside one journal, not over two machines' independent
  stores; the two-machine case is proven over replica copies in process, not over two live runners;
- the carried message text (`recall` entries) stays the snapshot's: the refresh keeps relationship records
  current, a forget after the carry removes the person's record but not the quoted message that named them;
- channel-import senders (`--agent-state-dir` items) are not records of their own: an imported item is an
  interaction of a person the operator already named (sender or exact mention, by the journal's rule), visible in
  the private root's view only. The carry refuses a source journal that holds imports, so 1.x's cross-channel
  identity surface (platform-verified uids) has no verified 2.0 counterpart; an asserted sender label never joins
  an identity (`relationship-journal.test.ts`).

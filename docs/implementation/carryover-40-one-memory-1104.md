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

## Lines carried versus newly written

Carried lines are final lines unchanged from the raw copy (commit `8e7df7f5`); adapted lines are the lines the
step-2 diff added. Counts from `git diff --numstat 8e7df7f5 87a8efec`.

| File | Raw 1.x | Final | Carried | Adapted |
|---|---|---|---|---|
| relationship-store.ts | 735 | 1232 | 666 | 566 |
| relationship-manager.ts | 1010 | 839 | 606 | 233 |
| relationship-journal.ts | 0 | 116 | 0 | 116 |
| relationship-carry-fixture.ts | 0 | 40 | 0 | 40 |
| group-carry.ts (edit) | 186 | 226 | 182 | 44 |
| relationship-manager.test.ts | 719 | 582 | 491 | 91 |
| relationship-store.test.ts | 423 | 463 | 407 | 56 |
| relationship-stale-context.test.ts | 203 | 188 | 148 | 40 |
| relationship-replication-emit.test.ts | 149 | 157 | 121 | 36 |
| relationship-union-read.test.ts | 139 | 112 | 59 | 53 |
| relationship-cross-machine.test.ts | 180 | 100 | 7 | 93 |
| relationship-carry.test.ts | 0 | 165 | 0 | 165 |

Source: 1,454 carried / 999 adapted. Tests: 1,233 carried / 534 adapted. Fifteen further 1.x files
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

## What this does and does not demonstrate for row 40

Demonstrated by can-fail tests (red against the base carry module: 7 of 8 new cases fail; green after):

- topic boundary: the journal's people are one record across the lineage, read through the ported manager;
- authorized private-to-group boundary: people travel only under the sourced grant and verified audience the
  carry already requires, validated per entry on replay, served only as quoted untrusted data; a predecessor
  with no grant, an unverified audience, another operator, an expired grant or a stop carries nobody, and a
  changed predecessor (another private root with its own valid grant) cannot replace the people a fixed one
  carried;
- session boundary: the carried people survive close/reopen and reach the actual worker's model packet;
- machine boundary: the carried journal's bytes shipped to a second machine's replica store, verified,
  adopted, and read there as foreign-origin records; two roots knowing the same person collapse to one
  recordKey and are flagged rather than merged.

Not demonstrated, so row 40 stays OPEN:

- a live run on the exact head (no live claim is made here);
- a live union of relationship records across two serving machines: 2.0 replicates whole journals, so the
  union read runs over carried records inside one journal, not over two machines' independent stores;
- people recorded after the carry are not refreshed into the group (the carry is a one-time snapshot, as the
  existing README states);
- channel-import senders (`--agent-state-dir` items) are not projected into relationship records.

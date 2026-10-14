# Conversation record migration inventory

Source inspected: train-19 `ac3bd4d8874495f8b66b571837a1380995113d7a`.
This is the first-half inventory for step 5 of `lanes/actual-agent-plan-1013.md`.
The second half owns the migration, consumer cutoff and full coverage proof; this
change does not move history or alter the current runner.

The fact envelope can carry newly registered bodies. “Missing” below means no
lossless mapping into the **currently installed** conversation/recall schemas,
not that signed facts are fundamentally unable to represent the information.
Generic serialization into an opaque text field is not a semantic migration.

| Journal source (file:line on the base) | Information that must survive | Existing foundation fit and missing mapping |
|---|---|---|
| `tests/preview/journal.ts:1068`, `:1356` | Original intake bytes, accepted/refused status, transport update/cursor, thread, edits/replacements, writer attestation, secret-custody disposition | `src/recall/exchange.ts:16` captures a redacted text exchange and visibility. It has no edit/retraction, capture-custody, intake outcome or cursor fields. Keep the original intake/capture owner records and join them to the exchange; do not convert a text exchange into intake authority. |
| `tests/preview/journal.ts:1123`, `:1201`, `:1234` | Proposed answer versus admitted intent versus actually sent reply; uncertainty; per-part receipts and provenance | The recall exchange carries no delivery state or cause. Existing effect/transport records cover distinct preparation and observations, but no journal-to-exchange adoption joins exist. Index only the appropriate historical stage; an answer is not evidence of delivery. |
| `tests/preview/journal.ts:1150`, `:1155`, `:1201`, `:1355` | Held acknowledgements, unknown sends, split reply text/body/provenance and receipt per part | A single recall message is limited to 8,000 characters (`src/recall/exchange.ts:9`). There is no logical-reply/part relation or unknown-delivery marker. Preserve each part's identity and uncertainty; never reconstruct permission to resend from prose. |
| `tests/preview/journal.ts:1059`, `:1148`, `:1197` | Media custody, tool-turn trace, session work/child edges, consequential tool effects | Text recall cannot preserve media custody or tool operation/session/child identities. Join existing assembly/run/effect records where semantically equivalent; media/source attachments and adoption joins need owner schemas. |
| `tests/preview/journal.ts:1290`, `:1307`, `:1469` | Summary coverage frontier, source quotes, concepts, candidates, uncertain/failed reservations, integrity/faithfulness/review outcomes and attempt accounting | There is no accepted-summary/coverage record in the recall schema. `src/rungraph/types.ts:78` explicitly describes full messages, not summaries. RG-B must add exact source/token coverage, acceptance references, correction invalidation and compaction consumption. A summary cannot replace originals. |
| `tests/preview/journal.ts:922`, `:951`, `:1124`, `:1495` | Corrections, forget/prefer/remember changes, conflict alternatives/winner, people/attributes/merges, undo and change history | No corresponding recall schema or materializer exists. Fact-level conflicts and generic projection corrections are building blocks; they are not the journal's memory semantics. Preserve quote/source/trigger relationships and the distinction between original evidence and current preference. |
| `tests/preview/journal.ts:1466`, `:1124` | Derived meaning cues, offered/indexed/unknown coverage, memory failure learning | Recall can compose cues (`src/recall/retrieve.ts`, `composeRecall`) but has no durable mapping of these journal records into facts. Keep derived search terms separate from original evidence and retain incomplete coverage. |
| `tests/preview/journal.ts:1241`, `:1254`, `:1495`, `:1505` | Promises, dated reminders, cancellations, open questions, blocked work, directives, rejected obligations, scheduled work and fulfillment evidence | Run facts represent bounded assignments; they do not represent all these promises. The new index reuses run-owner replay and leaves uncertain runs open. Step 3 owns missing commitment records. Do not infer all open commitments from nonterminal runs or from unmatched user messages. |
| `tests/preview/journal.ts:1095`, `:1113`, `:1449`, `:1456` | Operator decisions/disclosure, retractions, retired summaries, transferred work/group carry | Existing operator/intake authority records are available, but their journal adoption mapping, retraction-to-summary invalidation and one-time transfer cutoff are absent. No recall text grants standing. |
| `tests/preview/journal.ts:1118`, `:1447` | Imported channel items, source cursor and failures, group audience, attachment/source identity | Exchanges retain conversation and audience, but not import custody, per-source cursor, source failure or migration watermark. Preserve the original source key and exact audience; prevent adoption from duplicating already captured messages. |
| `tests/preview/journal.ts:1062`, `:1435`, `:1449`, `:1472` | Stop state/challenges, reservations, token and unknown-call accounting, current limits, configuration and expiry | These belong to existing authority/resource/operator owners. Recall is evidence only. Copying a transcript cannot reset limits, settle unknown spend or clear stop. Migration must carry owner records and prove the joins. |
| `tests/preview/journal.ts:1320`, `:1333`, `:1427` | Retrospective findings and unknown work, sentinel state, unknown forward frames | New/current owner schemas and adoption mapping are needed for journal-specific findings and forward-frame retention. An older reader must not silently omit unknown records or compact away their only copy. |

## Engineering defaults and unresolved joins

- The new index is a **pinned evidence view**, built from one verified source; it
  does not mint current authority or replace `readForProjection`.
- Work is folded by its existing owner before indexing. The assembly must supply
  the established conversation mapping for a run's result binding. No guess that
  a binding id equals a channel conversation key is made in product code.
- Message order matches existing recall: descending signed clock, then descending
  source order for a tie. It is not a new causal ordering policy.
- Indexes are disposable and machine-local. Facts remain shared; each machine
  rebuilds its own view after source recovery. A rebuild failure publishes nothing.
- Cold verification and refresh remain proportional to history. Hot queries do
  not read the store. The second-half consumer must refresh after intake/append,
  use one source for message/work grounding, and retain the old view only as
  explicitly old evidence. Incremental refresh is not claimed here.
- Before migration, RG-B must settle summary producer/acceptance, token estimator,
  consumption witness, edit/retraction invalidation and deterministic source-to-fact
  identities. It must adopt **all** old consumers at one cutoff and verify coverage
  on the desk's copy before the operator's history moves.

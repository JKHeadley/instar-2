# Change review — train-183 repair: truthful replay compatibility and causal carry baseline

Subject base: d04ce5c7b353b90fb78b420ad2e9cc5dd947b8af
Review state: open
Reviewed content: none
Outcome: Repair the two source-test regressions without changing runtime wording, the context floor, captures or authority. Historical self-description replay compares explicitly mapped old inventory; relationship served-cycle uses its launcher clock domain and verifies causal records and idempotence. Row40 remains OPEN.
Affected rules: 31, 32, 34, 36, 37, 49, 58, 70, 74, 78, 84, 95, 101, 102, 111, 112, 113, 116, 117.
Affected floors: secrets — unchanged encrypted journals and sealed disclosure grants; spend cap — no model call or context budget increase; stop — existing refusals retained and exercised; no duplicate sends — unchanged sender and served-cycle zero-send assertion; durable intake — existing baseline emission witnesses and original captures retained.
Operator questions: none
Suggested tier: ordinary
Declared tier: ordinary
Tier rationale: Bounded test-consumer repair with explicit historical-evidence interpretation; no runtime code, model wording, provider, grant or installation changes. Independent meaning review remains required.
Side effects: Changes only three test sources plus this record and reopened train integration review. The compatibility helper masks only four complete, named historical lines; new relationship inventory is checked separately and never inserted into original captures. The served fixture stops rewinding its carry clock after wall-clock launcher emissions. A deterministic roundtrip case covers actual score-change baseline emits and idempotence. No lifecycle implementation changed.
Undo and recovery: Revert this repair commit; original capture bytes, historical judgments and prior evidence remain available. Reversion restores failing comparisons and the mixed-clock fixture, not a product-state migration.
Multi-machine posture: No new state. Existing source-writer encrypted journal emits and destination baseline/lineage checks remain. The same fixed-clock test covers positional causal snapshots; installed two-runner proof is still desk-owned.
Layer below: README feature summaries -> generated/capabilities.json -> capabilityBriefing/sourcePacket -> current renderer and persisted-envelope revision consumer. Relationship path: journalRelationships/relationshipSignificance -> emitRelationshipChanges/ownWitness -> appendGroupCarry -> refreshGroupCarry. Actual diagnostic frames, not just counts, establish the cause.
Bug class: integration
Bug evidence: reproducer=tests/preview/selfdesc-abilities.test.ts
Hook bypass: none
Convergence: none
<!-- Rule 102: record each mid-run engineering decision as a line: Decision: <id> | <what was decided, and why> | reported=<report that names the id> -->
Prompt finding: 0d4664ea9de7 | quoted-evidence | Existing captured tool/standing-grant wording compared against unchanged source; not a new instruction or verdict classifier.
Prompt finding: 14d7eeccc218 | quoted-evidence | Existing captured tool/standing-grant wording compared against unchanged source; not a new instruction or verdict classifier.
Prompt finding: 45e37ea2e9e9 | quoted-evidence | Existing captured tool/standing-grant wording compared against unchanged source; not a new instruction or verdict classifier.
Prompt finding: 4b98dc2a1b9f | quoted-evidence | Existing captured tool/standing-grant wording compared against unchanged source; not a new instruction or verdict classifier.
Prompt finding: 95e349aaf4ac | quoted-evidence | Existing captured tool/standing-grant wording compared against unchanged source; not a new instruction or verdict classifier.
Prompt finding: 9781075d458e | quoted-evidence | Existing captured tool/standing-grant wording compared against unchanged source; not a new instruction or verdict classifier.

Subject (3 paths): tests/preview/relationship-roundtrip.test.ts, tests/preview/relationship-served-cycle.test.ts, tests/preview/selfdesc-abilities.test.ts

1.x comparison: Actual JKHeadley/instar main 154a09ffd44749ceac6205e4a95a9df4c56f4659 was searched in src/, docs/specs/ and history. Read RelationshipManager.ts (durable save then emitPut), ReplicatedRecordEmitter.ts (observed witness then HLC then append), JournalSyncApplier.ts (ordered validation), ws23-relationships-userregistry-security.md and WS2-SEND-SIDE-EMISSION-SPEC.md; history ff8344b4b/d4242edc4/6efb50acd; ONEX-LESSONS section5. Preserve original port provenance 4f88880a45f0a119aae3cfd2ccaf9ace26d405b9, raw copies8e7df7f5/bccfc149. Copied this repair: none. Adapted: existing 2.0 test consumers only. Published/installed: none. A 1.x durable manager record and a 2.0 clock-derived journal projection differ: score changes are content changes, not duplicate identity creation.

Decision: train183-repair-history | Keep original captures and judgments immutable; map only four exact source-proven summary lines and compare historical inventory separately from the new relationship declaration. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-183-repair-1545-PROGRESS.md
Decision: train183-repair-clock | Align the served carry with the launcher's wall-clock domain, retain exact original counts, and add content/witness/snapshot/idempotence checks for actual score-change baselines. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-183-repair-1545-PROGRESS.md

## Source and meaning assessment for independent Astra review

The simplest first candidate was restoring the four historical capability summaries verbatim. That adds77 bytes (16 conversation,22 memory,34 timed requests,5 status) to a summary with only5 bytes remaining under the existing23419 floor (prior measured23414). Removing the newly declared relationship capability would violate awareness. Changing unrelated guidance to buy space would widen this repair. Therefore keep current runtime bytes and explicitly adapt the existing test-only compatibility comparison. No guard, token/context budget or feature switch changes.

| Source at e5001a818 / 3cdd7b5e8 | Preserved meaning and consumer evidence | Limit of assessment |
|---|---|---|
| preview-conversation, README | Both lines retain chat/topics, encrypted photos/audio/files and text descriptions; full Details still identifies journal intake and operator-only admission. Current generated consumer is asserted. | Removing the words journal intake changes phrasing, not transport authority; old model judgment cannot grade the new phrase. |
| preview-durable-memory, README | Both retain encrypted local journal, messages/summaries/memory, restart survival and correct/forget. Full Details retains operator control and original audit history. | The concise imperative omits the explicit actor; Details and unchanged authorization retain it. Independent meaning review remains required. |
| preview-requested-actions, README | Both describe explicit requests at the requested time, once/daily/weekdays, cancellation and no new inbound message. Full Details retains settled times and existing send/spend/stop/audience admission. | Timed requests is a shorter expression, not permission for unsolicited outreach. Historical PASS is not new model evidence. |
| preview-status-command, README | Passive-to-active wording for the same two exact status messages, same journal source and no model call. | No new status intent matcher or route. |
| preview.relationship-awareness, README/declaration | The later row40 line is verified separately against README and generated available/internal inventory; it is absent from historical model inputs. | No historical judgment certifies this added capability. Original row40 review and installed/two-runner/live acceptance remain OPEN. |

Only whole exact lines map. Missing, duplicated, modified and unrelated capability text still fails, as does altered standing-grant wording. Existing K11 negative controls, original FAILs, questions, rubrics, digests and provenance remain untouched. The original note is always used for its original digest, never the translated/current note. The rendered tools/outbound hash remains exact and unchanged. No fixture or judge artifact is rewritten.

Recorded traversal: selfdesc fixtures retain updates840342287/840342414, negative840342355, live6232224/6232229/6232231 and all PASS/FAIL runs. The current renderer and persisted-envelope revision consumer additionally traverse the actual delivered715675677 shape, using a separately generated current sourcePacket. The old FAIL stays FAIL; the exact legacy pronoun replacement fires and altered provenance is refused. This offline traversal is not a model call, synthetic capture authority or new semantic verdict. Current summary/answer floor and journal-awareness/live-failure recorded regressions are separately checked.

## Causal baseline investigation

The failing served trace had seq1 Sam(score1), seq2 Ana(score1), seq3 Zed(score3). The launcher clock was1793922556970 or later, whereas the carry used1790000000001. The existing relationshipSignificance therefore produced score3 for Sam/Ana at the backwards carry clock. Baseline seq4/5 retained their recordKey, origin, person fields and prior observed HLC; only score and causal clock changed. This is the reviewed baseline mechanism, not duplicate emission. The source snapshots are preserved in the repair evidence. The repaired served test uses Date.now for carry, the same domain as the shipped launcher, and retains3/4/5 expectations while asserting exact ordered identities, matching snapshot record contents and byte-identical repeated carry. The deterministic roundtrip crosses the one-day score boundary: scores4/3 become3/2, each record emits exactly once with its prior witness, and repeated emission/carry/refresh writes nothing. Both original carry-before-ordinary-emit/forget and first-refresh/replay lineage repairs remain intact and tested.

Prompt review: No runtime prompt or source instructions changed by this repair. Historical evidence interpretation changes are explicit above and require normal independent review; no old PASS is extended to new model-facing wording. No fresh live model run is claimed or authorized.

## Targeted validation

On Mama PC WSL, /usr/bin/node v22.23.2, one nice10 worker: selfdesc-abilities13, default-context-floor6, journal-awareness5, live-failure-regressions7, relationship-applier25, relationship-roundtrip8 and relationship-served-cycle1 passed (65 total). The original selfdesc6 failures and served expected3/actual5 are retained in the report evidence. No assertion, context limit or timeout was raised. Native Node24 qualification, independent review, combined full gate and installed/two-runner/live proof remain unclaimed and desk-owned. Original58 incomplete files and all failed/timed-out lifecycle evidence remain in the repair report.

## Closing block

simplestRobustRoute: Use the existing exact historical compatibility boundary and the existing emitter/carry owners. This is that route: no production mutation is justified by either regression. Preserve captures and judgments, compare only declared line changes, separately assert new inventory, and align the served fixture clock rather than changing counts or producer behavior.
80/20: Bounded source handoff only: targeted portable checks and causal assertions, followed by normal independent Astra, combined full/native and installed/live/two-runner gates. Historical model PASS does not certify concise wording or the new relationship capability.
VERDICT: author submission; this record asserts no independent verdict — the review desk records its own

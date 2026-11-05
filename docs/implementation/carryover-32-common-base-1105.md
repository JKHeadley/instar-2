# Carryover row 32: correction learning loop inventory

Source: JKHeadley/instar commit `4f88880a45f0a119aae3cfd2ccaf9ace26d405b9`, `src/monitoring/CorrectionLedger.ts` (blob 0c48ef90), `CorrectionCaptureLoop.ts` (32d33ab1), `CorrectionInstanceFixGate.ts` (dbce6728), and the two modules that hold the tuned recurrence and lifecycle behavior the row names, `CorrectionAnalyzer.ts` (eae97731) and `CorrectionLoopDriver.ts` (a332ffda), with `tests/unit/CorrectionLedger.test.ts`, `CorrectionCaptureLoop.test.ts`, `CorrectionAnalyzer.test.ts`, `CorrectionLoopDriver.test.ts` and `correction-class-review.test.ts`. This adaptation starts at common base `990678d5996737c1fd13d8a49b4e0c9a1045d196`, reusing tested source `88aabf739a8f8a1e0de75166558823a31eeeafb1` without merging its train history. Its raw-copy baseline `4951ecaf` remains preserved. The original accounting below describes that original port.

1.x FIRST: searched actual JKHeadley/instar main `b80413b4a708599896ea31cc597578a3786bf0a1` in src/, docs/specs/ and correction history (acc674a3c, 3d886fb9c, 378483a33, 4cb0f12d0, 1b4dcb777). Matching modules above and CORRECTION-PREFERENCE-LEARNING-SENTINEL-SPEC define the retained feature. Only CorrectionAnalyzer differs among these five modules since pinned 1.x source; this assignment reuses its explicitly pinned tested adaptation, not an unrequested recurrence-policy upgrade. Studio ONEX-LESSONS.md section 5 was read: capture alone is insufficient; verify preference delivery and later behavior.

This is a behavior inventory and a build-test certificate for the parity work. It is not a live-proof certificate: the desk's exact-head gate, Astra review and live correction task decide whether row 32 in `lanes/carryover-1028.md` closes.

## Where the behavior lives now

| 2.0 module | 1.x origin | Owner it runs through |
|---|---|---|
| `tests/preview/correction-ledger.ts` | CorrectionLedger | the durable preview journal: `prefer` memory changes and recorded memory failures (`memory-learning.ts`) |
| `tests/preview/correction-analyzer.ts` | CorrectionAnalyzer | pure over the ledger projection |
| `tests/preview/correction-loop-driver.ts` | CorrectionLoopDriver (+ the lifecycle fields CorrectionLedger stored) | the retrospective review (`retrospective.ts`: packet, validator, reservation row) and the answer packet grounding (`journal.ts`) |
| `tests/preview/correction-capture.ts` | CorrectionCaptureLoop | the journal's intake, answer-path memory validation and the one redaction owner |
| `tests/preview/correction-fix-gate.ts` | CorrectionInstanceFixGate | the retrospective's linked improvement-work admission and verified-improvement acceptance |
| `tests/preview/correction-fixture.ts` | (new) | journal-backed test seeding, replacing `ledger.record(...)` in every adapted test |

This adaptation is tested on WSL with existing pin tools. No native certificate is changed. Exact results are in the common-base PROGRESS report.

## Behavior by behavior

| Imported behavior | 1.x location and thresholds | 2.0 route and evidence | Assessment | Rules |
|---|---|---|---|---|
| Dedupe identity | `CorrectionLedger.dedupeKey`: `kind:sha256(normalized tokens)`, stop-word list, sorted tokens; stability is a tested invariant | Carried verbatim as `dedupeKey`/`normalizeLearning`/`normalizedLearningHash`; `correction-ledger.test.ts` "normalizedLearningHash stability" (same three cases) | Identical | 24, 36 |
| Dedupe-upsert | A repeat increments `occurrence_count`, bumps `version`, keeps the max weight and confidence | `correctionRecords` folds every occurrence per key: count, version, max weight; "a repeat increments occurrenceCount, never duplicates", "keeps the strongest deterministic weight" | Identical minus `llm_confidence`, see omissions | 24, 85 |
| Occurrence log and diversity counts | `correction_occurrences` with UTC day bucket, topic, session, weight; `distinctCounts` over retained rows with the weight filter; session fallback for pre-session rows | `correctionOccurrences` from the journal, `distinctCounts` with the same four counts and the weight filter; "counts distinct UTC calendar days, topics and sessions", "aggregates across a cluster", "the deterministic-weight filter EXCLUDES" | Same counts; unknown historical grounding contributes no session | 10, 26, 28 |
| Code-determined provenance | `deterministicWeight` from the Layer-0 keyword classifier, threshold 3 | `correctionWeight`: an accepted message from the verified operator carries exactly `LEARNING_DETERMINISTIC_THRESHOLD` (3), anything else 0; the analyzer tests "LLM-only-confident" and "mixed" keep the gate shut on weight-0 rows | Stronger: the weight is a principal check (Rule 28 type), not a word list (Rule 10) | 10, 28, 86 |
| Retention cap | 200 occurrence rows per key, pruned in the insert transaction; the record's count can exceed the retained detail | Every occurrence kept; `occurrencePage` bounds a READ at the same 200 and reports `omitted`; "keeps every occurrence; a read page is bounded" | Stronger (Rule 7 forbids the prune; Rule 40 reports the bound as success) | 7, 40 |
| API view | `toApiView` strips `learning`, `sessionId`, `routeClusterId` | `toApiView` strips `learning`, `sessionId`, the occurrences; the status line and status record carry counts only; "strips the raw learning" | Identical or stricter | 39, 81 |
| List | newest detection first, default 100, max 1000, since/before | `listRecords`; "lists newest detection first" | Identical | 39 |
| Clustering | complete-link Jaccard ≥ 0.65 (37-record corpus), same kind only, creation order | Carried verbatim; the four clustering cases incl. the 13/20 vs 12/20 boundary and the A~B~C bridge | Identical | 11, 24 |
| Recurrence gate | preference: 4 support AND 2 days AND 2 sessions; infra-gap: 4 support AND 3 days; noise never; window days optional | Carried verbatim in `analyzeCorrections`; every 1.x prong case plus the window case | Identical thresholds; the gate's meaning changes, see routing | 24, 57 |
| Session diversity | Claude Code session ids counted actual context resets | `correctionSession` reads the occurrence answer’s recorded `summaryThrough`; missing grounding is unknown and excluded. A later summary cannot change earlier sessions. `correction-ledger.test.ts`: late-summary and genuinely changed grounding neighbors | Same gate, evidence bound to actual historical context | 13, 26, 96 |
| Route destination | preference → `recordPreference` (write preferences.json) or, on a regex policy-keyword match, the attention queue; infra-gap → tracked action + draft initiative, or a loopback `/feedback` POST when `autoFeedback` | One route: a crossed cluster rides the retrospective packet as `correctionCandidates` (bounded context from `captureWindow`), the question asks for a recurrence finding, the reservation row records what was presented; `correction-review.test.ts` both cases; `correction-loop-driver.test.ts` "wording decides nothing" | Changed by design (Part 21 §11): application is the owners' from the first statement, so the gate selects candidates for judgment, never authority | 4, 10, 25, 57, 86, 116 |
| Atomic cluster transition | `updateCluster` OCC over every member before the side effect; a stale member aborts | The reservation row is the one durable write and names every member key; the lifecycle is a projection, so there is no second writer to race; "routes one clustered preference once and retires every supporting paraphrase" | Same guarantee without a transaction | 2, 113 |
| No retry after ambiguous effect | a thrown route effect leaves the cluster acted-on | a reserved pass whose result failed still counts as presented; "a pass that failed after reserving still counts as presented" | Identical | 42, 55 |
| Per-tick ceiling and overflow | 5 per run, overflow stays open, audited | `DEFAULT_MAX_ROUTES_PER_TICK` 5 per pass, overflow counted and re-routed; both 1.x cases | Identical | 55, 60 |
| Verify windows | 7 days preference, 14 days infra-gap, opened at route time | Same constants, opened at the pass's reservation time; "closed-loop verify" cases | Identical | 8 |
| Recurrence detection | any member key's `detected_at ≥ window start` and count > 1 (open-ended) | any member occurrence inside `[start, end)` (end-bounded, the complete observation population Part 21 §11 asked for) | Stronger | 26 |
| Reopen | fresh window from the verification tick, `maxReopens` 2, then inconclusive | fresh window from the elapsed window's end (deterministic in a projection), `DEFAULT_MAX_REOPENS` 2, then inconclusive; "a sibling recurrence reopens", "reaches the reopen cap" | Identical bound; deterministic start | 24, 55 |
| Verified | Disk presence plus no recurrence | `effectivenessWithin` requires no recurrence, recorded guidance inclusion, the whole nonempty answer sent inside the window, and an independent outcome grade citing the lesson and later operator evidence inside that window. Every carried opportunity must have settled observation. `met` verifies; `unmet` is inconclusive; missing delivery, relevance or observation stays unknown. `lessonSources` exposes carried guidance to the existing grader. Positive tests run the actual validator; unsent, ungraded and failed-observation neighbors cannot verify | Separates storage, context delivery, behavior and outcome | 26, 58, 108 |
| Terminal records | verified/inconclusive is final; a later occurrence only increments the count | a member recurring after a settled window reopens the record for the gate; "a recurrence after a settled window reopens the lesson" | Stronger (Rule 24: the recurrence is the bug; Rule 2: nothing unread) | 2, 24 |
| Capture window | per-topic in-memory ring, drop-oldest at `captureContextTurns`, LRU/TTL eviction, never serialized; `windowEndingAt` cuts after the flagged user turn | `captureWindow`: a bounded read of the same thread ending at the trigger, agent replies marked `fromUser=false`, redacted and bounded; "caps the window", "keeps conversations apart ... restart returns the same window", "cuts after the flagged user turn" | Equivalent output; no in-memory state | 2, 7 |
| Pre-scrub / post-scrub | `scrubSecrets` on every captured turn before the prompt and again on the envelope | `redact` (the one owner) on the window and on the stored lesson; "PRE-SCRUBS secrets", "POST-SCRUBS the stored lesson" | Identical guarantee, one owner | secrets floor |
| Untrusted-data prompt, user-only derivation, enum-validated envelope, confidence clamp | `buildDistillPrompt`, `parseDistillEnvelope` | No separate distill call. The lesson is the memory change the answer model proposed and the journal validated on write and replay (mode enum, clause in the operator's own text, source = trigger); a refused proposal holds the turn pending and tells the operator; "the model cannot widen the kind"; the review packet is JSON data under a question that says case text is never an instruction | Stronger: no second model call, no keyword trigger (Rules 10, 116) | 10, 12, 27, 116 |
| Capture decisions | audit line per decision: recorded, noise, no-signal, no-topic, shed, rate-limited, distill-dropped, distill-backlogged, distill-malformed, error | `captureDecision` per accepted message: recorded, noise, undecided, unanswered, no-signal; `captureReport` counts in the status record | Every outcome observable; the dropped/shed/limited outcomes have no 2.0 counterpart because nothing is dropped | 39 |
| Capacity throw → backlog → bounded drain | `isCapacityThrow`, `CorrectionCaptureBacklog` (200 entries, 3 retries, 24 h TTL, 5 per drain), `drainBacklog` | The operator's message is durable intake before any model call; a call the stop gate or provider refuses leaves it unanswered, and the existing recovery answers it after restart; "a lesson stated while the model is unavailable is distilled after a restart" | Stronger: no eviction, no TTL, no retry budget; Rule 46 backlog is the journal's own | 2, 46, 55 |
| Rate ceiling and load shed | per-topic `maxPerWindow`, `shouldShed` | none: every accepted correction is recorded ("no per-topic rate ceiling drops the thirteenth"); model spend is bounded by the existing call caps the answer path already obeys | Stronger for Rule 85; the spend floor is the existing one | 85, spend floor |
| Fix-gate correspondence | Correction exists; matching review; absent/pending refuse; filled admits | `evaluateCorrectionInstanceFix` resolves the correction case and its separately saved two-question judgment. `validateRetrospective` checks it before `improvement-owned` creates linked repair work, and checks closure separately. Another correction’s review cannot admit. `correction-fix-gate.test.ts` tests absent, partial, pending, matched, mismatched and restart cases | Retained admission at work creation; investigating and ordinary conversation remain available | 4, 9, 26, 42, 95 |
| Record-time class review | `CorrectionClassReview` independently asks standards and process questions; shell, saved judgment and retry ownership | Each recorded correction is an owed journal obligation without a recurrence threshold. `RetroResult.classReviews` retains both verdicts, standard reference/deltas, policy-relaxation assessment, rationale and confidence. Missing/partial reviews remain owed under the existing bounded retrospective cadence. The matching saved review is shown in later packets. Filled means judged, never fixed or approved. `correction-fix-gate.test.ts` and the real-model replay test cover this protocol | Adapted into the existing owner; feedback disposition alone never fills it | 8, 9, 26, 85 |

The planner admits its ordinary one-case floor before allocating remaining packet and answer space to candidates. Unpresented candidates stay open; candidate-only passes remain possible once cases drain. The five-cluster regression exercises the real planner and journal reservations across successive passes without increasing the spend cap.

## Omitted 1.x behavior and why 2.0 does it better

Each omission names the test that holds the replacement.

- `llm_confidence` (advisory, never admitted a record): 2.0 has no distill call to score; the lesson is an accepted or refused memory change. Replacement evidence: "the model cannot widen the kind" (`correction-capture.test.ts`).
- 200-row occurrence prune: Rule 7. Replacement: "keeps every occurrence; a read page is bounded" (`correction-ledger.test.ts`).
- SQLite schema, in-place column migration, composite indexes, machine-scoped sequence ids, close-on-exit registry, fail-open write errors: no second store (Rules 32, 113, 116). Replacement: "a reopened journal replays identical records" and the reopen assertion in every lifecycle case.
- OCC `update`/`updateCluster`: one writer (the journal append), lifecycle as a projection. Replacement: "routes one clustered preference once and retires every supporting paraphrase" (`correction-loop-driver.test.ts`).
- `matchesPolicyRelaxation` regex: a keyword decision about meaning (Rules 10, 86). 2.0 has one route for every candidate, the judgment owner, and no auto-apply branch for the regex to guard. Replacement: "wording decides nothing" (`correction-loop-driver.test.ts`). Authority is structural: a standing preference enters the answer packet as style guidance and never widens a grant (purpose: a message can use authority, never create it).
- `recordPreference` / preferences.json: the preference owner already carries an operator's standing preference on every packet from the message that stated it (`journal.ts` preference state), so the loop does not wait for recurrence to apply anything. Replacement: `grounding.preferences` records context delivery; `correction-loop-driver.test.ts` separately checks delivered and independently assessed behavior.
- `addAction` / `createInitiative` / `feedbackLoopbackPost` / 429 batching / `attentionRoute`: 2.0 has no fleet feedback route, HTTP loopback or initiative store; the owned retrospective finding is the tracked work item. Replacement: `correction-review.test.ts` (the finding opens owned root-cause work; a forged candidate is refused).
- Disk-presence `verified` and infra-gap never-verified: Part 21 §11 retires disk presence; delivery plus independently assessed lesson outcomes replaces it for both kinds; incomplete observation remains unknown. Replacement: "SILENCE alone is NOT effective" and the infra-gap delivery case.
- Capture ring (LRU/TTL/never serialized), backlog, drain, rate ceiling, load shed, capacity-throw classification: the journal is the capture and nothing is dropped. Replacement: the capture tests named above.
- Separate distill prompt with XML delimiting/escaping: no second call; the review packet is JSON data. Replacement: "the model cannot widen the kind".
- Fix-gate dead letter (fail toward allow): a correction the review could not disposition stays owed, never dead-lettered, so there is no state to fail open from. Replacement: "A failed pass left the obligation owed ... still refused" (`correction-fix-gate.test.ts`).
- Fix-gate dry run: every refusal is recorded with its reason on the pass (`refusedRows`/omitted reason), so the refusal is observable without a mode that lets it through. Replacement: "the consumer" case asserts the recorded reason.
- Separate `CorrectionClassReview` service and `ClassReviewStore` database: the two-question vocabulary and reference checks from `src/monitoring/CorrectionClassReview.ts` at `4f88880a45f0a119aae3cfd2ccaf9ace26d405b9` are adapted into the retrospective validator. The journal retains pending obligations and completed judgments, and equal journal prefixes yield equal review evidence. No peer judgment grants authority. Tests cover missing judgment, partial judgment, restart, mismatch, admission and the captured real model output. Existing bounds/cadence replace the extra review queue; no correction is discarded after an attempt limit.

## Original port line accounting (at `3b9ad197`, diff from `4951ecaf`)

Carried = raw lines minus lines git reports deleted; new = lines git reports inserted. A rewritten line counts as one deleted and one inserted.

| File | Raw 1.x lines | Carried | New adaptation | Final |
|---|---|---|---|---|
| correction-ledger.ts | 660 | 83 | 201 | 284 |
| correction-analyzer.ts | 211 | 113 | 89 | 202 |
| correction-loop-driver.ts | 483 | 27 | 204 | 231 |
| correction-capture.ts | 616 | 19 | 75 | 94 |
| correction-fix-gate.ts | 41 | 10 | 53 | 63 |
| **source total** | **2011** | **252** | **622** | **874** |
| correction-ledger.test.ts | 235 | 50 | 163 | 213 |
| correction-analyzer.test.ts | 240 | 98 | 82 | 180 |
| correction-loop-driver.test.ts | 502 | 40 | 296 | 336 |
| correction-capture.test.ts | 259 | 10 | 204 | 214 |
| correction-fix-gate.test.ts | 306 | 5 | 94 | 99 |
| **test total** | **1542** | **203** | **839** | **1042** |

Newly written beyond the copies: `correction-fixture.ts` 107 lines, `correction-review.test.ts` 94 lines, `journal.ts` +19/−7, `retrospective.ts` +38/−10, `journal-agent.mjs` +5/−1, register regeneration 13/13 generated lines. Of the 2011 raw source lines, 1759 were removed because they implemented the SQLite store, the in-memory ring, the backlog drain, the HTTP route calls and the injected-capability driver listed under omissions; the tuned constants, identity functions, clustering, gate reasons, window and reopen semantics are the carried lines.

## What this certificate does not claim

- The isolated real-provider capture `fixtures/correction-retrospective-2026-11-04.json` retains the actual planner input, shipped question and unedited response. The worker replay accepts its candidate reference and refuses a forged-reference neighbor. Its journal seed is synthetic; the model output is real. This proves the new model-facing route, not live deployment or effectiveness of the model’s suggested repair.
- The retrospective question changed, so `disciplineDigest` and every journal's reply-context digest change; benchmark reruns become due by the existing rule (finding 5), not by this unit.
- Observer #106 replay also feeds the retained proof-room summary writer (715672480), uncertain summary (715672483), Jev undecided (715672482) and unsure (969389570), reply review (969389923), delivered reply (715672479) and empty bubble (715672550) through the worker with correction candidates present. These shapes cannot become a retrospective review or verified effectiveness.
- The status line and status record carry one more clause and one more block; no operator-facing push exists.

## Carried-line accounting on this common base

Raw means the original byte-copy baseline 4951ecaf; unchanged lines are measured by git diff. The five source modules and their five tests are byte-identical to tested 88aabf739. No newly invented implementation is substituted for them.

| File | Raw 1.x | Retained raw | Adapted in prior port | Final |
|---|---:|---:|---:|---:|
| tests/preview/correction-ledger.ts | 660 | 83 | 203 | 286 |
| tests/preview/correction-analyzer.ts | 211 | 113 | 89 | 202 |
| tests/preview/correction-loop-driver.ts | 483 | 28 | 217 | 245 |
| tests/preview/correction-capture.ts | 616 | 19 | 75 | 94 |
| tests/preview/correction-fix-gate.ts | 41 | 10 | 57 | 67 |
| tests/preview/correction-ledger.test.ts | 235 | 51 | 181 | 232 |
| tests/preview/correction-analyzer.test.ts | 240 | 98 | 82 | 180 |
| tests/preview/correction-loop-driver.test.ts | 502 | 41 | 345 | 386 |
| tests/preview/correction-capture.test.ts | 259 | 10 | 204 | 214 |
| tests/preview/correction-fix-gate.test.ts | 306 | 8 | 146 | 154 |

The other copied artifacts are correction-fixture.ts (113 lines), correction-review.test.ts (219), and the real-provider fixture (218). The current common-base integration is journal.ts +19/-7, journal-agent.mjs +5/-1, retrospective.ts +105/-19, plus the first-unit memory-learning repair and its regression tests. These are reused patches; the journal replay hunk is placed beside the newer commitment-store handlers without changing those handlers. Publication changes are listed separately in the handoff.

# Carryover row 32: correction learning loop inventory

Source: JKHeadley/instar commit `4f88880a45f0a119aae3cfd2ccaf9ace26d405b9`, `src/monitoring/CorrectionLedger.ts` (blob 0c48ef90), `CorrectionCaptureLoop.ts` (32d33ab1), `CorrectionInstanceFixGate.ts` (dbce6728), and the two modules that hold the tuned recurrence and lifecycle behavior the row names, `CorrectionAnalyzer.ts` (eae97731) and `CorrectionLoopDriver.ts` (a332ffda), with `tests/unit/CorrectionLedger.test.ts`, `CorrectionCaptureLoop.test.ts`, `CorrectionAnalyzer.test.ts`, `CorrectionLoopDriver.test.ts` and `correction-class-review.test.ts`. Destination starts at `c25dc5b308bd977da8319c44c8a1847e77e2992b`, the first builder's pushed partial (its two repairs, unresolved-correction cues and distinct-trigger pinning, are kept unchanged). The raw byte-for-byte copies are commit `4951ecaf` on this branch; every number below is the diff from that commit.

This is a behavior inventory and a build-test certificate for the parity work. It is not a live-proof certificate: the desk's exact-head gate, Astra review and live correction task decide whether row 32 in `lanes/carryover-1028.md` closes.

## Where the behavior lives now

| 2.0 module | 1.x origin | Owner it runs through |
|---|---|---|
| `tests/preview/correction-ledger.ts` | CorrectionLedger | the durable preview journal: `prefer` memory changes and recorded memory failures (`memory-learning.ts`) |
| `tests/preview/correction-analyzer.ts` | CorrectionAnalyzer | pure over the ledger projection |
| `tests/preview/correction-loop-driver.ts` | CorrectionLoopDriver (+ the lifecycle fields CorrectionLedger stored) | the retrospective review (`retrospective.ts`: packet, validator, reservation row) and the answer packet grounding (`journal.ts`) |
| `tests/preview/correction-capture.ts` | CorrectionCaptureLoop | the journal's intake, answer-path memory validation and the one redaction owner |
| `tests/preview/correction-fix-gate.ts` | CorrectionInstanceFixGate | the retrospective's verified-improvement acceptance |
| `tests/preview/correction-fixture.ts` | (new) | journal-backed test seeding, replacing `ledger.record(...)` in every adapted test |

Register and lints: `npm run register:check` passes after the pin refresh in `dd3e1034`; `node scripts/check-register-wiring.mjs` passes; `node scripts/check-architecture.mjs` reports only R105 (the native self-host certificate was issued on node 24.14.1 and this host runs 24.15.0), the host-dependent desk exception the row 03 unit also hit. No declaration or document was weakened to claim parity.

## Behavior by behavior

| Imported behavior | 1.x location and thresholds | 2.0 route and evidence | Assessment | Rules |
|---|---|---|---|---|
| Dedupe identity | `CorrectionLedger.dedupeKey`: `kind:sha256(normalized tokens)`, stop-word list, sorted tokens; stability is a tested invariant | Carried verbatim as `dedupeKey`/`normalizeLearning`/`normalizedLearningHash`; `correction-ledger.test.ts` "normalizedLearningHash stability" (same three cases) | Identical | 24, 36 |
| Dedupe-upsert | A repeat increments `occurrence_count`, bumps `version`, keeps the max weight and confidence | `correctionRecords` folds every occurrence per key: count, version, max weight; "a repeat increments occurrenceCount, never duplicates", "keeps the strongest deterministic weight" | Identical minus `llm_confidence`, see omissions | 24, 85 |
| Occurrence log and diversity counts | `correction_occurrences` with UTC day bucket, topic, session, weight; `distinctCounts` over retained rows with the weight filter; session fallback for pre-session rows | `correctionOccurrences` from the journal, `distinctCounts` with the same four counts and the weight filter; "counts distinct UTC calendar days, topics and sessions", "aggregates across a cluster", "the deterministic-weight filter EXCLUDES" | Identical counts; session is the summary epoch, see below | 10, 26, 28 |
| Code-determined provenance | `deterministicWeight` from the Layer-0 keyword classifier, threshold 3 | `correctionWeight`: an accepted message from the verified operator carries exactly `LEARNING_DETERMINISTIC_THRESHOLD` (3), anything else 0; the analyzer tests "LLM-only-confident" and "mixed" keep the gate shut on weight-0 rows | Stronger: the weight is a principal check (Rule 28 type), not a word list (Rule 10) | 10, 28, 86 |
| Retention cap | 200 occurrence rows per key, pruned in the insert transaction; the record's count can exceed the retained detail | Every occurrence kept; `occurrencePage` bounds a READ at the same 200 and reports `omitted`; "keeps every occurrence; a read page is bounded" | Stronger (Rule 7 forbids the prune; Rule 40 reports the bound as success) | 7, 40 |
| API view | `toApiView` strips `learning`, `sessionId`, `routeClusterId` | `toApiView` strips `learning`, `sessionId`, the occurrences; the status line and status record carry counts only; "strips the raw learning" | Identical or stricter | 39, 81 |
| List | newest detection first, default 100, max 1000, since/before | `listRecords`; "lists newest detection first" | Identical | 39 |
| Clustering | complete-link Jaccard ≥ 0.65 (37-record corpus), same kind only, creation order | Carried verbatim; the four clustering cases incl. the 13/20 vs 12/20 boundary and the A~B~C bridge | Identical | 11, 24 |
| Recurrence gate | preference: 4 support AND 2 days AND 2 sessions; infra-gap: 4 support AND 3 days; noise never; window days optional | Carried verbatim in `analyzeCorrections`; every 1.x prong case plus the window case | Identical thresholds; the gate's meaning changes, see routing | 24, 57 |
| Session diversity | Claude Code session ids: a preference must recur across context resets, not just topics | The journal's context resets are its rolling-summary frontiers: `correctionSession` = summary epoch; "Without the reset the third statement stays in the first session" | Equivalent intent; different evidence (the journal has no session id) | 26, 96 |
| Route destination | preference → `recordPreference` (write preferences.json) or, on a regex policy-keyword match, the attention queue; infra-gap → tracked action + draft initiative, or a loopback `/feedback` POST when `autoFeedback` | One route: a crossed cluster rides the retrospective packet as `correctionCandidates` (bounded context from `captureWindow`), the question asks for a recurrence finding, the reservation row records what was presented; `correction-review.test.ts` both cases; `correction-loop-driver.test.ts` "wording decides nothing" | Changed by design (Part 21 §11): application is the owners' from the first statement, so the gate selects candidates for judgment, never authority | 4, 10, 25, 57, 86, 116 |
| Atomic cluster transition | `updateCluster` OCC over every member before the side effect; a stale member aborts | The reservation row is the one durable write and names every member key; the lifecycle is a projection, so there is no second writer to race; "routes one clustered preference once and retires every supporting paraphrase" | Same guarantee without a transaction | 2, 113 |
| No retry after ambiguous effect | a thrown route effect leaves the cluster acted-on | a reserved pass whose result failed still counts as presented; "a pass that failed after reserving still counts as presented" | Identical | 42, 55 |
| Per-tick ceiling and overflow | 5 per run, overflow stays open, audited | `DEFAULT_MAX_ROUTES_PER_TICK` 5 per pass, overflow counted and re-routed; both 1.x cases | Identical | 55, 60 |
| Verify windows | 7 days preference, 14 days infra-gap, opened at route time | Same constants, opened at the pass's reservation time; "closed-loop verify" cases | Identical | 8 |
| Recurrence detection | any member key's `detected_at ≥ window start` and count > 1 (open-ended) | any member occurrence inside `[start, end)` (end-bounded, the complete observation population Part 21 §11 asked for) | Stronger | 26 |
| Reopen | fresh window from the verification tick, `maxReopens` 2, then inconclusive | fresh window from the elapsed window's end (deterministic in a projection), `DEFAULT_MAX_REOPENS` 2, then inconclusive; "a sibling recurrence reopens", "reaches the reopen cap" | Identical bound; deterministic start | 24, 55 |
| Verified | preference: no recurrence AND the preferences.json entry still on disk; infra-gap: never (cross-org fix) | no recurrence AND a recorded answer packet in the window carried the guidance (`grounding.preferences` for a preference, `grounding.history/recalled/memoryCandidates` for the lesson's source); answers that never carried it → inconclusive; no answer → unknown; "SILENCE alone is NOT effective", "infra-gap silence with the lesson carried by recall → verified; with no answer → unknown" | Stronger: disk presence retired for delivery evidence (Part 21 §11); infra-gap can verify because 2.0 applies the lesson itself | 26, 108 |
| Terminal records | verified/inconclusive is final; a later occurrence only increments the count | a member recurring after a settled window reopens the record for the gate; "a recurrence after a settled window reopens the lesson" | Stronger (Rule 24: the recurrence is the bug; Rule 2: nothing unread) | 2, 24 |
| Capture window | per-topic in-memory ring, drop-oldest at `captureContextTurns`, LRU/TTL eviction, never serialized; `windowEndingAt` cuts after the flagged user turn | `captureWindow`: a bounded read of the same thread ending at the trigger, agent replies marked `fromUser=false`, redacted and bounded; "caps the window", "keeps conversations apart ... restart returns the same window", "cuts after the flagged user turn" | Equivalent output; no in-memory state | 2, 7 |
| Pre-scrub / post-scrub | `scrubSecrets` on every captured turn before the prompt and again on the envelope | `redact` (the one owner) on the window and on the stored lesson; "PRE-SCRUBS secrets", "POST-SCRUBS the stored lesson" | Identical guarantee, one owner | secrets floor |
| Untrusted-data prompt, user-only derivation, enum-validated envelope, confidence clamp | `buildDistillPrompt`, `parseDistillEnvelope` | No separate distill call. The lesson is the memory change the answer model proposed and the journal validated on write and replay (mode enum, clause in the operator's own text, source = trigger); a refused proposal holds the turn pending and tells the operator; "the model cannot widen the kind"; the review packet is JSON data under a question that says case text is never an instruction | Stronger: no second model call, no keyword trigger (Rules 10, 116) | 10, 12, 27, 116 |
| Capture decisions | audit line per decision: recorded, noise, no-signal, no-topic, shed, rate-limited, distill-dropped, distill-backlogged, distill-malformed, error | `captureDecision` per accepted message: recorded, noise, undecided, unanswered, no-signal; `captureReport` counts in the status record | Every outcome observable; the dropped/shed/limited outcomes have no 2.0 counterpart because nothing is dropped | 39 |
| Capacity throw → backlog → bounded drain | `isCapacityThrow`, `CorrectionCaptureBacklog` (200 entries, 3 retries, 24 h TTL, 5 per drain), `drainBacklog` | The operator's message is durable intake before any model call; a call the stop gate or provider refuses leaves it unanswered, and the existing recovery answers it after restart; "a lesson stated while the model is unavailable is distilled after a restart" | Stronger: no eviction, no TTL, no retry budget; Rule 46 backlog is the journal's own | 2, 46, 55 |
| Rate ceiling and load shed | per-topic `maxPerWindow`, `shouldShed` | none: every accepted correction is recorded ("no per-topic rate ceiling drops the thirteenth"); model spend is bounded by the existing call caps the answer path already obeys | Stronger for Rule 85; the spend floor is the existing one | 85, spend floor |
| Fix-gate correspondence | correction must exist; claimed review ref must equal the correction's dedupe key; enforce refuses absent/pending; filled admits; dark store and dead letter admit with reason; dry-run admits with `wouldRefuse` | `evaluateCorrectionInstanceFix` over the journal: the correction's case id is its review key; absent (no completed pass dispositioned it), pending (a reserved pass lists it), filled (a disposition exists); dark admits with reason; consumed by the verified-improvement acceptance in `validateRetrospective`; `correction-fix-gate.test.ts` "not fooled by a decoy", "enforce blocks absent/pending, allows filled", "the consumer" | Identical refusals; see omissions for dead letter and dry run | 4, 42, 95 |
| Record-time class review | `CorrectionClassReview` shell at record time, async judgment, bounded retries, dead letter, backfill, standards/process proposals | The retrospective's feedback duty: every recorded correction owes a disposition (`retrospective.ts`, Rule 85 floor), an owned disposition opens the improvement item, closure needs later evidence; existing `retrospective.test.ts` "keeps the rest of the feedback contract" and "a recorded correction given no feedback row ... stays owed" | Already the 2.0 owner (first unit's reading confirmed); no second store | 8, 85 |

## Omitted 1.x behavior and why 2.0 does it better

Each omission names the test that holds the replacement.

- `llm_confidence` (advisory, never admitted a record): 2.0 has no distill call to score; the lesson is an accepted or refused memory change. Replacement evidence: "the model cannot widen the kind" (`correction-capture.test.ts`).
- 200-row occurrence prune: Rule 7. Replacement: "keeps every occurrence; a read page is bounded" (`correction-ledger.test.ts`).
- SQLite schema, in-place column migration, composite indexes, machine-scoped sequence ids, close-on-exit registry, fail-open write errors: no second store (Rules 32, 113, 116). Replacement: "a reopened journal replays identical records" and the reopen assertion in every lifecycle case.
- OCC `update`/`updateCluster`: one writer (the journal append), lifecycle as a projection. Replacement: "routes one clustered preference once and retires every supporting paraphrase" (`correction-loop-driver.test.ts`).
- `matchesPolicyRelaxation` regex: a keyword decision about meaning (Rules 10, 86). 2.0 has one route for every candidate, the judgment owner, and no auto-apply branch for the regex to guard. Replacement: "wording decides nothing" (`correction-loop-driver.test.ts`). Authority is structural: a standing preference enters the answer packet as style guidance and never widens a grant (purpose: a message can use authority, never create it).
- `recordPreference` / preferences.json: the preference owner already carries an operator's standing preference on every packet from the message that stated it (`journal.ts` preference state), so the loop does not wait for recurrence to apply anything. Replacement: the lifecycle's `verified` reads the carried preference from `grounding.preferences` ("a preference whose cluster did not recur AND was carried in a recorded packet → verified").
- `addAction` / `createInitiative` / `feedbackLoopbackPost` / 429 batching / `attentionRoute`: 2.0 has no fleet feedback route, HTTP loopback or initiative store; the owned retrospective finding is the tracked work item. Replacement: `correction-review.test.ts` (the finding opens owned root-cause work; a forged candidate is refused).
- Disk-presence `verified` and infra-gap never-verified: Part 21 §11 retires disk presence; delivery evidence replaces it for both kinds. Replacement: "SILENCE alone is NOT effective" and the infra-gap delivery case.
- Capture ring (LRU/TTL/never serialized), backlog, drain, rate ceiling, load shed, capacity-throw classification: the journal is the capture and nothing is dropped. Replacement: the capture tests named above.
- Separate distill prompt with XML delimiting/escaping: no second call; the review packet is JSON data. Replacement: "the model cannot widen the kind".
- Fix-gate dead letter (fail toward allow): a correction the review could not disposition stays owed, never dead-lettered, so there is no state to fail open from. Replacement: "A failed pass left the obligation owed ... still refused" (`correction-fix-gate.test.ts`).
- Fix-gate dry run: every refusal is recorded with its reason on the pass (`refusedRows`/omitted reason), so the refusal is observable without a mode that lets it through. Replacement: "the consumer" case asserts the recorded reason.
- `CorrectionClassReview`/`ClassReviewStore` engine and peer-advisory union: the retrospective feedback duty is the 2.0 owner and the journal is replicated whole. Not re-implemented; existing tests cited above.

## Line accounting (diff from the raw baseline commit `4951ecaf`)

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

- No live proof. The retrospective's answer in `correction-review.test.ts` is a scripted stub; no recorded model output yet carries `correctionCandidates`, so whether a live review opens a recurrence finding from it is the desk's live correction task to measure (the same posture Part 21 §16 took for `memoryFailure`).
- The retrospective question changed, so `disciplineDigest` and every journal's reply-context digest change; benchmark reruns become due by the existing rule (finding 5), not by this unit.
- Observer #106 full recorded-shape qualification of the capture path remains desk-owned, as the first unit reported.
- The status line and status record carry one more clause and one more block; no operator-facing push exists.

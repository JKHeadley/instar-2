# Change review — Current rule holders and carryover evidence

Subject base: fc000d65a305755dd2b12692a4433c96abbd9aa5
Review state: open
Reviewed content: none
Outcome: Link existing boundaries to reproducible negative evidence without claiming live acceptance or verified register authority.
Affected rules: 4, 9, 14, 26, 34, 36, 43, 49, 60, 61, 62, 65, 66, 69, 74, 90, 101, 111, 113, 116; purpose constraints 3, 4 and 6.
Affected floors: secrets, spend cap, stop, no duplicate sends and durable intake retain their existing execution paths.
Operator questions: none
Suggested tier: critical
Declared tier: critical
Tier rationale: Register evidence classifications and publication are trust metadata, even though execution is unchanged.
Side effects: Two resource holds move from deferred to partial; one parser claim moves from declared to partial. Two existing probe holders also gain a pinned build fixture. No new authority, prompt, output parser, acceptance decision or provider is installed.
Undo and recovery: Revert the source/test/declaration changes together and regenerate from that committed source. Restore the desk carryover from its named backup if its annotations must be withdrawn; preserve subsequent desk edits.
Multi-machine posture: Register publication is shared source metadata; resource admission evidence is deliberately host-local and makes no peer or confinement claim. No new durable state or replication protocol.
Layer below: Existing Hold decoder, owner-reference artifact hashing, rule graph class derivation, source/construct binding, replay builder and actual admission/probe functions were inspected. The missing verified Part Two chain remains missing.
Bug class: none
Bug evidence: Controlled mutations below fail the selected tests; restored source passes the focused suite.
Hook bypass: none
Review repair: The publication changes bytes covered by operator-worker-parity-1102; its frozen round is explicitly reopened under Rule 109. Historical review findings remain intact; this does not renew that approval or authorize deployment.
Convergence: none

**1.x first (Rules 49/116):** `JKHeadley/instar:docs/STANDARDS-REGISTRY.md` and `JKHeadley/instar:scripts/standards-coverage.mjs` provide the precedent for named guards, resolvable references and rejecting false coverage claims; this evidence-only extension uses the established 2.0 code-adjacent declarations, owner-reference catalog and `scripts/build-register.mjs` builder because they already bind those references to scoped evidence and publish explicit partial/shape-only limits, so porting the 1.x coverage scanner would duplicate the existing mechanism without establishing missing authority or live outcomes.

## Scope and counts

This is steps 2 and 4 of the desk's register-link slice. Steps 1 and 3 are not implemented.
The source base is exactly the deployed backup, not origin/main. Its replay generation was
`sha256:fc22f87ac1adfe3c1fe1a55ffad1d697514b753e20e191c32bf128d9d6a17fab`.
The publication pins source `2602f8d6cab943082853ed7acde61e2d1024ecca` and generation
`sha256:fdbd8eeecaea52dfcc97dcdb13463eff66b05e5bcfa072270b5106d0a16ee675`
in `generated/source.json`; the output-only
publication commit follows the source commit because a commit cannot contain its own hash.

The baseline has 8/118 rules with `enforcedBy` entries: 4, 9, 14, 36, 43, 60, 61, 66.
This change retains that roster. Held-reviewed and held-unreviewed both remain zero.
Coverage edge classes change from 3 declared / 24 partial / 3 deferred / 110 gaps to
2 declared / 27 partial / 1 deferred / 110 gaps. These are edge/gap counts, not disjoint
rule counts. Feature declarations remain 17 total, 5 live. No pending feature is promoted.

The existing carryover snapshot remains 100 rows: 1 PROVEN / 99 OPEN for complete grouped
outcomes on fc000d65. Priority rows 01, 08, 03, 32, 40 and browser row 31 are annotated in
place with declarations or gaps, current code owners, test targets and live-result limits.
The other historical rows are preserved. Row 63's request 729 / update 969390668 / reply 733
is retained from the supplied snapshot, not independently rerun. Old proof-room scores are
not current rule coverage. Desk files and the backup stay only in the absolute lanes directory.

## Existing declarations and executing boundaries

This is a review of the existing register, not a second inventory. `generated/rules.md` and
`generated/register.json` remain the generated references of record.

| Rule | Code-adjacent declarations and current callsites | Evidence and limit |
|---|---|---|
| 4 | `src/intake/port.declarations.json`: `intake.stop` → `port.ts` `stopGate`; `src/rungraph/rungraph.declarations.json`: `rungraph.stop` → `rungraph.ts` `stopAdmission`; `src/recall/redact.declarations.json`: `recall.redact` → `redact.ts` `redact`; `tests/preview/journal.declarations.json`: `preview.journal.capacityRefused` → `journal.ts` `capacityRefused`, checked before append. `journal-agent.mjs` calls `bindPreviewBlockingSites` at launch. | Existing `P4-NF-14-PARTIAL`, `P5-NF-54-PARTIAL`, `PREVIEW-SECRET-WALL`, `PREVIEW-TRIAL-GATES` remain scoped. The secret-wall test now exercises redaction itself, not only span discovery. Whole-system coverage remains OPEN. |
| 9 | `tests/preview/capabilities.declarations.json`: `preview.sentinel.reply-review` and `preview.sentinel.summary-review` → `proofs.ts` plans `reply-review-reached` and `summary-checked`; launcher `nextDuePlan` → `executeProof` → `recordProof`. | Summary holder now cites `PREVIEW-RULE-PROBES` build fixture; its separate freshness probe stays registered. A faithfulness verdict of unavailable counts as observation, never semantic success. Missing verdict, no summaries and present verdict are distinct. Reply holder retains its existing probe. |
| 14 | `src/intake/port.declarations.json`: `intake.dedup`, `intake.admission`, `intake.stop` → `port.ts` `checkDedup`, `append`, `stopGate` within `createIntakePort.receive/recover`. | Existing `P4-NF-06`, `P4-NF-13`, `P4-NF-14-PARTIAL` in `tests/intake/governance.test.ts` retain their pinned owner references. Uncertain arrival is admitted with its flag, and the separate authenticated stop survives missing ordinary gates. No new live reachability claim. |
| 36 | `tests/preview/model-json.declarations.json` → `model-json.ts` `parseModelJson`, consumed by answer readers; `tests/preview/reply-check.declarations.json` → `reply-check.ts` `parseJevResponse`; `src/assembly/provider-failure.parser.json` → provider failure classification; `src/conversation/telegram.parser.json` → Telegram intake parser. | Only the model-JSON claim is narrowed to partial, using existing `PREVIEW-MODEL-JSON-ON-CAPTURE` and the genuine redacted provider capture. Other parser claims stay as published; Telegram stays deferred. One capture is not all model shapes or all parsers. |
| 43 | `src/rungraph/rungraph.declarations.json`: `rungraph.bound` → `runGraphConstruct` and scoped bound probe. Preview outcome declarations in `tests/preview/capabilities.declarations.json` map to `proofs.ts` plans listed below, executed by the launcher's existing startup/cadence path. | `preview.reply.delivered` now cites pinned `PREVIEW-RULE-PROBES`; live probe declaration/cadence remain. Receipt present, absent, UNKNOWN and stale are distinguished. No send, live canary or production outcome is manufactured. |
| 60 | `scripts/resource-owner.declarations.json`: `resource-owner.admit` → `resource-owner.mjs` `eligible` / `tryReserve` / `admit`, called by both `execute` and `hold`. Launcher binds the declaration with `bindPreviewBlockingSites`. | New `PREVIEW-RESOURCE-ADMISSION` tests the real queue through `hold` with no PID attached: total slots, answer reserve, deadline and drain. Partial only: kernel limits, memory/process sampling and escaping children are outside this evidence. |
| 61 | Same `resource-owner.admit` declaration and callsites. | The same fixture tests priority refusal, recovery, queued stop and settled timers. It does not certify system-wide restart/respawn/notification convergence or actual host pressure. |
| 66 | `src/rungraph/rungraph.declarations.json`: `rungraph.stop` → `rungraph.ts` `stopAdmission`, `constructGoverned`, `gate`, then actual `decodeRunTransition`. | Existing `P5-NF-54-PARTIAL` tests every built gate's executed decoder and missing/wrong-boundary neighbors. Broader blocking-site coverage is still OPEN. |

The Rule 43 preview ids and exact plan ids are:

- `preview.durable-intake.startup` → `startup`; `.restore` → `journal-restore`; `.store-agreements` → `store-agreements`.
- `preview.reply.bot-identity` → `telegram-identity`; `.delivered` → `reply-delivered`; `.drained` → `reply-drain`; `.provider-answers` → `provider-outcomes`.
- `preview.reply-review.reached` → `reply-review-reached`; `preview.held-reply-notice.delivered` → `held-notice-delivered`.
- `preview.reminders.delivered` → `reminder-delivered`; `preview.status-pull.answered` → `status-answered`.
- `preview.spend-cap.refusal` → `spend-cap-refusal`; `preview.stop.honored` → `stop-honored`.

## Can-fail evidence

Each mutation was applied only in this isolated worktree, run in the foreground with
`nice -n 10 npx vitest run --maxWorkers 1 <file> -t <selector>`, and restored in a `finally`
block before continuing. Logs with exact substitutions, commands, PIDs and outputs are in
the desk lanes directory as `register-link-holders-carryover-1103-mutation-r<N>.log`.
The baseline and restored suite pass; every mutant exits 1 for the named behavioral failure.
The intake/rungraph helpers throw their own expectation errors, rather than Vitest's
`AssertionError`; both were read and confirmed as behavior failures, not setup failures.

| Rule | Controlled break | Selected failing assertion |
|---|---|---|
| 4 | `redact` returns original text with zero replacements | `secret-custody.test.ts`: `PREVIEW-SECRET-WALL removes` expects the credential replaced and ordinary context retained |
| 9 | Treat every summary as carrying a faithfulness verdict | `proofs.test.ts`: `PREVIEW-RULE-PROBES summary` expects one missing verdict to fail |
| 14 | Reject the `cannot-decide` signal in the slice classifier | `intake/governance.test.ts`: `per-consumer directions` receives a preserved needs-judgment hold instead of admitted delivery |
| 36 | `parseModelJson` always refuses | `model-json.test.ts`: `PREVIEW-MODEL-JSON-ON-CAPTURE` cannot parse the real provider capture |
| 43 | Delivery with no attempted send returns passed | `proofs.test.ts`: `PREVIEW-RULE-PROBES delivery` expects unknown |
| 60 | Remove the aggregate slot ceiling | `resource-admission-evidence.test.ts`: `keeps the answer reserve` receives an extra lease instead of a capacity refusal |
| 61 | Ignore the injected priority gate | `resource-admission-evidence.test.ts`: `preserves a priority refusal` sees admitted work while the gate is closed |
| 66 | Skip `decodeRunTransition` at the stop gate | `rungraph/governance.test.ts`: `every built blocking gate` no longer receives the decoder's malformed-input refusal |

No model-facing behavior is changed. The Rule 36 check replays the existing real captured
provider bytes; it does not claim a new live answer. The carryover record explicitly labels
unexecuted test candidates and preserves every missing complete live outcome.

## Publication and remaining authority gap

The existing schema can truthfully represent partial evidence without a verified chain.
It cannot make this replay a verified governing register. `ChainExtract.vector.id` remains
`genesis:empty-extract`, and `authority` remains `shape-only`. Missing prerequisites are the
actual Part Two provider (`owner: part-two`, extract verification/currentness and approved
history), current entering-force version rows, exact-source normal-workflow runs and semantic
review evidence. No `semanticallyReviewed` generation is invented. Generated authority
prerequisites remain visible. Full-suite and independent review should inspect these trust
metadata changes and artifact pins before landing.

simplestRobustRoute: This is the simplest route: use existing partial holds, owner catalog and replay publication, with behavioral negative tests and explicit remainders. No runtime mechanism, new register, provider or simplicity gate is added.
80/20: Verify the eight already-linked rules and annotate the five highest-value carries plus the browser counterexample; leave whole-system and live-group evidence OPEN for the desk instead of broadening this slice into deployment.
VERDICT: author submission only; no independent approval or autonomous live completion claimed.

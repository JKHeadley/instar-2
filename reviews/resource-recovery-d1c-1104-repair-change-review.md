# Preserve selected exact reports through prose revision

Subject base: 8917381313793d50853dc10ef837240f3e36631f
Review state: open
Reviewed content: none
Outcome: an explicitly selected result already quoted verbatim survives prose revision exactly once and closes each selected identity only after delivery receipt.
Affected rules: 8, 22, 92, 4, 10, 26, 36, 58, 70, 37, 74, 101, 111, 113, 116.
Affected floors: secrets, spend cap, stop, no duplicate sends and durable intake unchanged; existing outbound review, bounded calls, intent binding and receipt checks remain authoritative.
Operator questions: none
Suggested tier: critical
Declared tier: significant
Tier rationale: narrow correction to existing report preservation; no authority, protocol, store or prompt change.
Side effects: exact selected results are preserved even without a wrapper; a revision quoting the result does not append it twice. Report bodies remain subject to claim-scoped review and size/final-text validation. Equal text never selects another key implicitly.
Undo and recovery: revert source change; journal schema and replay remain compatible, with no migration or forced closure.
Multi-machine posture: unchanged journal owner, durable intent and receipt protocol across restart/ownership transfer; no new state.
Layer below: pendingReports and answerReports establish eligible independent identities; sentObligations and applyIntentObligations bind final exact text and complete receipt; fulfillmentSupported remains unchanged. Audited the wrapper dependency as the source of the regression.
Bug class: live-path
Bug evidence: reproducer=tests/preview/report-settlement-live.test.ts; live=tests/preview/fixtures/report-settlement-46040806-2026-11-04.json
Hook bypass: none. core.hooksPath unset and common hooks directory contains only sample hooks.
Convergence: none
Prompt review: no prompt changes; revision receives surrounding prose after independently selected exact results are separated for preservation. Existing recorded outputs are replayed, not reclassified as fresh live evidence.

1.x reuse disposition: inspected `JKHeadley/instar:src/monitoring/PromiseBeacon.ts` (`emitBeaconMessage`, topic aggregation and frozen uncertain batches) and `src/monitoring/CommitmentTracker.ts` (`deliver`): retain their behavior of aggregating output without losing commitment identities, keeping uncertain delivery outstanding, and distinguishing delivered from verified; reuse the existing 2.0 explicit report selection, durable intent and complete-receipt lifecycle rather than importing the private timer/batch store, because this defect is preservation of exact selected bytes during revision, not missing scheduling or lifecycle machinery.

Generated artifacts: the seven generated register files refresh source pins from 8e810db69829e066f8ea8514723ff6654658b290; no runtime authority or coverage change. Delegated owner-manifest and inventory repin tools found zero changed pins.

Verification: claim-scoped-floor also passes (14 cases), for 25 targeted cases total. The added combined case fails on repair base with zero result occurrences; the wrapped neighbor passes. After repair, 11 regression cases pass, including all four wrapped/verbatim draft and omitted/quoted revision combinations, one selected key, omitted result, unknown receipt, claim removal and old unsupported fulfillment proposals. Captured request 46040805, answer 46040806 and the retained one real repaired-model response are replayed. Typecheck passes. Final gate output is retained in the absolute desk PROGRESS record.

Residue: carryover row 01 remains OPEN for request/report/receipt-bound live proof; the previous D.sh aggregate-count proof cannot distinguish delivery from rework. One recorded response is not a reliability estimate or deployed D1c pass.

Prompt finding: 4106b49fff07 | protocol-literal | Existing runner protocol text, unchanged by this repair.
Prompt finding: 849db3a6296a | protocol-literal | Existing runner protocol text, unchanged by this repair.
Prompt finding: 85544c20941f | protocol-literal | Existing runner protocol text, unchanged by this repair.
Prompt finding: e8708c7fea24 | protocol-literal | Existing runner protocol text, unchanged by this repair.

simplestRobustRoute: this is the simplest robust route: carry exact independently selected result bytes through the existing revision path, deduplicate rendering by exact bytes, and keep final-text review and durable receipts authoritative. No added service, batch protocol, model call or settlement authority.
80/20: two narrow must-fixes repaired with red/green regression evidence; independent acceptance and live proof remain desk-owned.
VERDICT: author submission; this record asserts no independent verdict.

# Change review — exact reply review accounting

Subject base: b5806d1e015dc650cdc1dee2e0accab05a849d4b
Review state: frozen
Reviewed content: sha256:24e70676cfad6fe65f8f36534faa69c54bb698840363e9095029070d87718950
Outcome: Bind reply-review proof accounting to the actual sent candidate, recorded before-send or after-send phase, and source observation time. Distinguish exact fixed notices and passed revisions from raw answers, and keep attempted, reached, judged, passed, unavailable and adverse outcomes separate. The live capability proof uses the same exact-candidate predicate.
Affected rules: 9, 13, 26, 36, 38, 41, 42, 43, 49, 58, 70, 73, 74, 95, 101, 111, 112, 113, 116
Affected floors: secrets — outbound guard unchanged; spend cap — no calls or reservations added; stop — execution checks unchanged; no duplicate sends — no send path or retry changed; durable intake — journal admission and persistence unchanged.
Operator questions: none
Suggested tier: critical
Declared tier: significant
Tier rationale: The declaration changes proof interpretation, not authority or runtime review policy. Recorded-case replay and targeted proof consumers exercise both positive and refusing neighbors. Independent review and full release gates remain desk work.
Side effects: Historical passes no longer establish fresh health on reread. A fixed notice is counted separately; a pass for another candidate or the wrong phase cannot certify a sent answer. Unavailable observations remain unknown and violations remain failed. Existing historical violation/unavailable/unsure check counts remain visible, including checks on replaced candidates. The capability version includes the proof source. The normal owner-manifest rehasher refreshes only the two changed proof-test references; generated register outputs are republished from the committed source. No live review timing, launcher, root, authority, store, owner or model prompt changes.
Undo and recovery: Revert this measurement-only change and regenerate the source-pinned register. No journal migration or effect retry is needed; retained review and send records are unchanged.
Multi-machine posture: The existing machine-local projection observes its durable journal. There is no new store, replication protocol or review owner. The proof carries the source observation time so another read or machine cannot renew old evidence merely by rereading it.
Layer below: Inspected reply-check, revision-review and intent projector ordering, exact candidate digests, retrospective review reservations, terminal interruption handling, replyBody, wholeReplyReceipt and live proof generation binding. Before-send revision results are rejected after an intent; raw review results retain their candidate digest. Intent text is the full canonical reply; transport rendering and the secret matcher are untouched. Accepted retrospective policy is the rulebook timing paragraph, canonical LIVE-PATH-PLAN.md lines 58/164, and a7f5608fec32cce41b64728d51172dc33cd619d8 decision step1d-accounts-review. Old-branch Part18 section 16 drifts from that policy; this unit changes no constitutional wording.
1.x reference: Reuse the already shipped reply-check/revision/retrospective journal evidence and existing proof executor; this is a repair of its measurement, not a replacement review feature.
Bug class: live-path
Bug evidence: reproducer=tests/preview/reply-review-accounting.test.ts; live=tests/preview/fixtures/reply-review-accounting-2026-11-05.json
Hook bypass: none; core.hooksPath is unset and the resolved hooks directory contains sample files only (checked).
Convergence: none
Prompt review: No model-facing prompt, parser, routing, live accept/escalate/refuse decision or paid call changes. Recorded outcome labels are replayed as data into the projection/proof. Fixtures publish only safe IDs, digests, phases, timestamps and outcome classes; no operator message bodies or private-turns.json.
Decision: REVIEW-ACCOUNTING-1105 | Keep attempted/reached distinct from successful judgment; unavailable never passes, and an adverse judgment stays failed even when correctly reached after send. Keep historical findings while freshness binds to the latest actual review observation. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/reply-review-proof-accounting-1105-PROGRESS.md
Decision: REVIEW-CANDIDATE-1105 | Use exact final-text SHA256 and durable phase evidence through the existing projection; fixed notice exclusion is exact equality, never a suffix match. The same predicate serves capability acceptance. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/reply-review-proof-accounting-1105-PROGRESS.md

simplestRobustRoute: This is the simplest robust route: one content-free projection of existing turn fields, one exact-candidate/phase classifier shared by proof and capability acceptance, and the existing proof executor. Start guard is an observed sent turn; end guard is exact candidate plus recorded ordering; limit guards are unchanged secret/spend/stop/send-uniqueness/intake paths. No watcher, store or reviewer is added. The existing fourteen captured cases supply real unattended-path evidence; no new live interaction is claimed.
80/20: Repair the measurement and retain the adverse evidence. Parent owns followup for the seven unavailable and five violation judgments. Whole-agent quality, independent convergence and release certification are not claimed.
VERDICT: author submission; independent review and full release gates follow.

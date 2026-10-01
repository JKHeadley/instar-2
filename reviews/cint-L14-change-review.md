# Change review — cint-L14: cint-L13 plus w3-sendstall, w3-splitmerge and w3-holdcascade

Subject base: 72fb5a824ce8c0535c223f146fba8eb9c3cf78fa
Review state: open
Reviewed content: none
Outcome: The next live build is cint-L13 (72fb5a82) with origin/w3-sendstall (8b221ff5), origin/w3-splitmerge (de4fcc64) and origin/w3-holdcascade (4aa013a9) merged in that order by ordinary merges (557f1a94, 40a7dfa0, 1d4cae71), all without conflict. w3-sendstall records the bridge's closed stage name on an uncertain Telegram send (tests/preview/telegram-send-outcome.mjs); unknown stays unknown and is never retried. w3-splitmerge merges the two halves' gate reports so a second host can carry half of a full run, and the full-gate driver refuses a split run instead of recording half a suite (scripts/split-report.mjs, scripts/gate-report-checks.mjs, scripts/split-checks.mjs and the checker edits it reviewed). w3-holdcascade narrows the runner's hold predicate so only a confident Jev credential score (at or above 0.70, or a legacy violation row) keeps a hold when the stronger review gives no verdict; an unsure-band flag with an unavailable review is sent with the objection and the unavailable review recorded. The credential floor (exact wall, send-time secret wall, confident Jev flag, review naming a leak) is unchanged and tested. No source was hand-edited. The desk chain ran as recorded for cint-L13: the inventory repin refreshed nothing; the owner-reference rehash refreshed nothing; the register was regenerated with --replay at the merge commit (30c8c0c6). The three units' own records are carried intact.
Affected rules: 74 (this record; the three unit records carried intact), 42 (send classification: the stage is recorded, unknown is never retried; an unavailable review stays visible on the release), 4 and 86 (Jev's unsure band is a signal; the secrets exception is kept for unambiguous matches), 14, 77 and 95 (the operator is answered when the stronger check cannot decide), 52 (holds recorded by an earlier build stay as recorded), 2 and 3 (each unit's tests re-run on the merged tree, including the 969389800 recorded replay), 69 and 90 (register regenerated from committed sources with --replay, never hand-merged), 106, 116
Affected floors: secrets — unchanged and tested both sides (credential wall, outbound secret wall and confident Jev flag still refuse); spend cap — unchanged (no paid call re-dispatched); stop — unchanged; no duplicate sends — unchanged (no retry added; the restart test proves one send); durable intake — unchanged
Operator questions: none
Suggested tier: critical
Declared tier: significant
Tier rationale: the combine carries three reviewed units with clean merges and a desk register regeneration; w3-holdcascade's release-path change is declared significant in its own record with the credential floor tested, and no approval, intake or authority path is changed by the merge
Side effects: as recorded in the three carried records (an uncertain send's reason carries the bridge stage; a split gate run is merged or refused; an unsure-band credential flag with an unavailable review is released with the objection recorded); none added by the merge
Undo and recovery: revert the three merge commits, the register regeneration and this record; see each unit's record for its own undo notes
Multi-machine posture: as in the carried records: the preview runner is machine-local; the split gate halves run on two hosts and are merged on one, with process-level evidence never carried between hosts
Layer below: reviews/cint-L13-change-review.md (the base, carried); reviews/w3-sendstall-change-review.md, reviews/w3-splitmerge-change-review.md and reviews/w3-holdcascade-change-review.md (carried)
Bug class: live-path
Bug evidence: carried from reviews/w3-sendstall-change-review.md (update 969389787 send-outcome) and reviews/w3-holdcascade-change-review.md (update 969389800 held as reply check unavailable)
Hook bypass: none
Convergence: none
Prompt review: no prompt text changed by the merge; the three existing journal.ts protocol literals are dispositioned as in the carried records
Prompt finding: 849db3a6296a | protocol-literal | an existing fixed reply literal in journal.ts, unchanged by this change
Prompt finding: bd01de21286a | protocol-literal | existing capability-guidance wording in journal.ts, unchanged by this change
Prompt finding: fb5fa7e706c8 | protocol-literal | existing capability-guidance wording in journal.ts, unchanged by this change
Deferral: generated/register.json:1 | not-a-deferral=generated register output quoting the rule book, not a commitment by this change

Subject (35 paths): generated/capabilities.json, generated/capabilities.md, generated/coverage.md, generated/glossary.md, generated/register.json, generated/rules.md, generated/source.json, package.json, reviews/w3-holdcascade-change-review.md, reviews/w3-sendstall-change-review.md, reviews/w3-splitmerge-change-review.md, scripts/check-assembly-contracts.mjs, scripts/check-boot-conversation-evidence.mjs, scripts/check-change-review.mjs, scripts/check-p11-contract-map.mjs, scripts/gate-report-checks.d.mts, scripts/gate-report-checks.mjs, scripts/split-checks.mjs, scripts/split-report.d.mts, scripts/split-report.mjs, tests/platform/fixtures/README.md, tests/platform/fixtures/split-merge-half-a.json, tests/platform/fixtures/split-merge-half-b.json, tests/platform/fixtures/split-merge-mac-only-macos.json, tests/platform/fixtures/split-merge-unsplit.json, tests/platform/gate-split-merge.test.ts, tests/platform/macos-only.mjs, tests/preview/format-retry.test.ts, tests/preview/held-cascade-replay.test.ts, tests/preview/journal-send-outcome.test.ts, tests/preview/journal-summary-crash.test.ts, tests/preview/journal.ts, tests/preview/reply-check.ts, tests/preview/review-layers-canary.test.ts, tests/preview/telegram-send-outcome.mjs

## Closing block

simplestRobustRoute: merge the reviewed units as they are and run the standard desk tools; no checker edit and no new mechanism
80/20: 0 must-fixes, 1 note (targeted tests only; the full gate runs split across hosts)
VERDICT: author submission; the independent verdict is recorded as a pass

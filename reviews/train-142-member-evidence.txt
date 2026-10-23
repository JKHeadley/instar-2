# w4-rule33-autos investigation

Started 2026-10-23 on the Mac Studio. Worktree and branch: w4-rule33-autos; initial HEAD 42767914df8d0561fd1a5280cc0e7341cc546913. The specific Where You Run branch/path takes precedence over the inherited singular auto brief. Constitution read in full: docs/00-the-purpose.md then docs/01-the-rules.md. No repository files changed.

## Governing rules and approach
- R26 and R33: examine actual journal, packet provenance, agreement records and proof results, not just FAIL labels.
- R34, R36, R70 and R107: distinguish product failure from proof setup; preserve red evidence and use real recorded data.
- R35: no test traffic or writes to Justin’s live root/chat; proof room journals read only.
- R49 and R113: investigation is machine-local deliberately; no new state or cross-machine behavior in the product.
- R101: no hooks bypassed; no commit attempted.
- R116 simplestRobustRoute: trace existing recorded checks before introducing any repair or machinery. Safety floors (secrets, spend caps, stop, durable intake, duplicate sends) remain unchanged; no model/transport calls needed.

## Evidence so far
F-proofroom2-20261023-080141 ran build 42767914 on proofroom2-q-20261023-065800. F11a and F21a fail because the startup memory-provenance check reports three source-turn-absent findings at 1792767180879. It is not a count mismatch: declared=5, agree=4, disagree=1. Status correctly exposes the disagreement instead of the all-clear phrase.
The same run’s read-only f0-audit.json has findings=[] at update 6235582; its later forced copy check f22a.json also reports memory-provenance=true. F22 is UNTESTED because the journal frontier differs from the last exit; that is a distinct comparison and does not explain the provenance finding on its own.
Driver history confirms prior failures on 10-22 and the Mama escalation at 08:42:47; proof-rate.log records both 10-23 F attempts. Investigating the exact startup packet and source turn retention next.

## 1.x first
Searched JKHeadley/instar origin/main src/, docs/specs/ and git log for cross-store coherence, provenance, missing sources and snapshots. Read ONEX-LESSONS.md section 5 and STATE-COHERENCE-REGISTRY.md. CoherenceMonitor and the registry establish comparing independently observed state and recording actual freshness; no direct 1.x packet/journal audit implementation matches this 2.0 symptom. Reuse that investigative principle; no code port proposed yet.

## Cause confirmed; repair
The encrypted startup prefix reproduces exactly the three findings. Latest packet is summary:6235554; memoryCandidates[15..17] point to accepted sources 6235556, 6235557 and 6235558. They are present, but outside that packet’s declared frontier. The later clean F0 audit read a newer answer packet; it does not exonerate the summary builder. This is a real product packet-selection defect on 42767914, not a stale-build result or F22 copy artifact.
Decision summary-source-frontier: filter saved local memory candidates by the summary’s existing frontier; project summary preferences at that frontier too. Keep all memory durable. A first broad preference filter exposed a regression in the current-message preference test; narrowed it to the existing summary-only packet mode, so ordinary answers still follow newly decided preferences. No proof check was weakened.
Rules additionally touched: R7 preserves all 18 stored facts; R96 keeps the summary faithful to its covered prefix; R74 records side effects/revert in reviews/w4-rule33-autos-change-review.md. No constitutional wording changed.

## Foreground verification so far
- New summary-candidate-frontier regression on original source: 2 FAIL, both offered future source 6235556. After repair: 2 PASS, facts and preferences across both frontier sides, compact/reopen.
- Full recorded encrypted prefix: original startup has exactly 3 source-turn-absent findings; regeneration from before the original summary reservation produces summary:6235554 with no later-source candidates, findings=[], 48 turns and 18 memory records retained. Results: w4-rule33-autos-evidence/startup-replay.json, generated-replay.json, uncertain-replay.json. Storage key piped directly from secret-get; only private encrypted copies and sanitized diagnostic records written under the absolute lanes directory.
- Real outputs replayed on that full prefix: malformed writer output summary:6235554, and uncertain writer shape summary:715672492. Both produce clean source audit after the new selection; they retain their existing failure/uncertain handling, not a fabricated successful summary.
- nice -n 10 npx vitest run --maxWorkers 1 [summary-candidate-frontier, journal-audit, store-agreements, summary-cascade-stall, summary-fit, reply-review-budget]: 6 files PASS, 61 tests PASS, 37.26 s.
- Additional unknown-answer-notice and memory-update-replaces: 2 files PASS, 13 tests PASS. An absent journal-preferences filename was not counted as executed; the actual journal-preference-memory file is exercised separately.
- Summary-bound/preference batch initially 38 PASS, 1 FAIL (current-message preference regression above); fixed before commit and rerunning relevant files.
- node scripts/check-architecture.mjs: exit 0, architecture checks passed.
- npm run typecheck: exit 0.
- Initial npm run lint and register:check: only source wiring pin trails tests/preview/journal.ts. Source commit and normal register regeneration next; final pushed-head checks will be recorded below.
- Hook inspection: git config --get core.hooksPath is unset; common hooks directory contains only .sample hooks. No hook bypass used.

## Recorded-shape coverage
summary-cascade-stall replays proof-room 2026-09-30 writers through 715672480/481/484, uncertain 715672492/496/497, and undecided Jev followed by stronger review. reply-review-budget replays 715675387. unknown-answer-notice replays uncertain answer 969390396, unsure Jev and reply review; its existing otherShapes capture includes summary-uncertain 715672483, delivered reply 715672479, and empty reply-in-recorded-context 715672550. Empty recorded context is not asserted to prove a delivered empty Telegram bubble. The actual malformed summary bytes from 6235554 are additionally replayed in this unit’s full journal evidence.

## Final source and register commits
- 15571a41f6c404bac0ce72adf0ae0df8336b412b — fix(preview): keep summary memory within its frontier
- 73527b2a0ba5d5356bfa9f54731aa7c7165ffe6c — chore(register): pin summary frontier repair
Both pushed with git push -u origin w4-rule33-autos. Local HEAD and origin/w4-rule33-autos both resolve to 73527b2a0ba5d5356bfa9f54731aa7c7165ffe6c.
The generator first refused an abbreviated commit id; reran successfully using its full 40-character source commit id. Only seven generated views changed; no declarations, self-host certificate, or constitution changed.
1.x snapshot actually searched: origin/main d5b30b1d7c059da68483caf15d7584aec0d7a325. No direct implementation port fits this 2.0 packet frontier bug.

## Verification output on final source / pushed head
Final targeted follow-up after narrowing the preference projection:
```
 Test Files  9 passed (9)
      Tests  77 passed (77)
   Duration  15.57s
```
Files: journal-preference-memory, journal-audit, summary-cascade-stall, memory-prefer, memory-update-replaces, unknown-answer-notice, summary-candidate-frontier, preference-restatement, reply-review-budget (all tests/preview/*.test.ts).

On pushed head 73527b2a0:
```
npm run lint
architecture checks passed
register wiring: issues=[]
exit 0
npm run register:check
{"generation":"sha256:7fda4becb93691d7f326757eecca0d98c19c4da5dda4cac10a0dbe397f5ab05e","commit":"15571a41f6c404bac0ce72adf0ae0df8336b412b","entries":293,"rules":117,"terms":34,"warnings":48,"prerequisites":109,"check":true,"authority":"shape-only","mode":"replay"}
exit 0
npm run typecheck
tsc --noEmit
exit 0
```
Lint’s large static wiring report had no issues; architecture had no findings, including no R105 exception. All commands used nice -n 10. Tests were foreground with --maxWorkers 1; no background tests or load burners, no processes killed, no exit 137, no dependency installation.

## Required pinned-text gate on final pushed head
Command (the lanes helper is outside the repository by charter):
```
nice -n 10 npx vitest run --maxWorkers 1 $(python3 /Users/dabombstudio/.instar/agents/echo/.instar/lanes/pipeline/ready-gate-tests.py)
```
Output:
```
 tests/e2e/register.test.ts (6 tests) PASS
 tests/preview/proofs-launcher.test.ts (8 tests) PASS
 tests/preview/journal-obligations.test.ts (51 tests) PASS
 tests/preview/journal-boundaries.test.ts (23 tests) PASS
 tests/preview/capability-briefing.test.ts (9 tests) PASS
 tests/preview/topic-awareness.test.ts (11 tests) PASS
 tests/integration/register.test.ts (7 tests) PASS
 tests/preview/constitution-briefing-sync.test.ts (5 tests) PASS
 Test Files  8 passed (8)
      Tests  120 passed (120)
   Duration  304.88s
exit 0
```
Additional change-review validation on pushed head:
```
CHANGE_REVIEW_BASE=42767914df8d0561fd1a5280cc0e7341cc546913 nice -n 10 node scripts/check-change-review.mjs check
change-review: 3796 commits since adoption, 1132 records, 1044 current; 35 prompt findings among the files current changes touch or in the tree (dispositioned where a change touches them)
change-review check OK
exit 0
```
The checker also printed its existing older-record prompt-debt and tier-audit notes; no failing finding.

Final recorded replay also calls the unchanged STORE_AGREEMENTS memory-provenance check directly, for both the recorded malformed writer result and recorded uncertain result:
```
{"agree":true,"detail":"every active memory and packet item traces to the journal"}
```
Both keep 48 turns and all 18 saved-memory records. This does not relabel the historical failed packet or claim a newly deployed live F run.

## Final clean/pushed evidence
```
git diff --check origin/main...HEAD
exit 0; no output
git diff --check
exit 0; no output
git diff --cached --check
exit 0; no output
git status --porcelain
(empty output)
```

The final pushed commit and its pushed source parent contain every reported repository change:
```
commit 73527b2a0ba5d5356bfa9f54731aa7c7165ffe6c
Author: Echo <echo@sagemindai.io>
Date:   Fri Oct 23 08:58:22 2026 -0700

    chore(register): pin summary frontier repair

 generated/capabilities.json              | 4 ++--
 generated/capabilities.md                | 4 ++--
 generated/coverage.md                    | 4 ++--
 generated/glossary.md                    | 4 ++--
 generated/register.json                  | 2 +-
 generated/rules.md                       | 4 ++--
 generated/source.json                    | 4 ++--
 reviews/w4-rule33-autos-change-review.md | 4 ++++
 8 files changed, 17 insertions(+), 13 deletions(-)
commit 15571a41f6c404bac0ce72adf0ae0df8336b412b
Author: Echo <echo@sagemindai.io>
Date:   Fri Oct 23 08:57:36 2026 -0700

    fix(preview): keep summary memory within its frontier

 reviews/w4-rule33-autos-change-review.md         | 31 ++++++++++++
 tests/preview/journal.ts                         | 11 ++++-
 tests/preview/summary-candidate-frontier.test.ts | 61 ++++++++++++++++++++++++
 3 files changed, 101 insertions(+), 2 deletions(-)
```

## Unrun or host-dependent checks
No required check skipped or left failing. The full suite and live deployment are desk/pipeline work, per the Studio targeted-test instruction. No traffic was sent to Justin’s root or chat, or to the live proof room. No independent-review verdict is asserted.

Completed 2026-10-23T09:04:24.382696-07:00
READY 73527b2a0ba5d5356bfa9f54731aa7c7165ffe6c

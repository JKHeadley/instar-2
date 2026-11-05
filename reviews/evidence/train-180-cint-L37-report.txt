# cint-L37 — PROGRESS (plan rows #362 and #366: origin/cint-L36 4228d0c5 + w3-renewform c97dcac5)

Worktree /Users/dabombstudio/.instar/agents/echo/.worktrees/cint-L37, branch cint-L37, on the Studio, built 2026-10-03 about
02:45 to 03:00 PDT. I read docs/00-the-purpose.md and docs/01-the-rules.md in full first. node_modules is a symlink to the
cint-L16 worktree's. user.name is Echo and user.email is echo@sagemindai.io.

## For the reviewer

reviews/cint-L37-change-review.md (Subject base **4228d0c5f5560d141a902442361b17f9c78d5153**, the live cint-L36 head; tier
critical, carried from cint-L36; 16 subject paths) covers one merge and one desk replay. reviews/w3-renewform-change-review.md
and reviews/w3-renewform-repair-change-review.md are carried byte for byte.

- **The merge fast-forwarded.** w3-renewform was built on exactly 4228d0c5, so `git merge --no-edit origin/w3-renewform`
  fast-forwarded to c97dcac5. There is no merge commit and there were no conflicts. The unit's reviewed bytes are the tree's
  bytes, and the only change after it is the desk replay f684f5f4 (register commit and generation lines in generated/).
- **w3-renewform is model-facing** (guidance wording, plus how an operator proposal is read and reported). Its recorded
  real shapes replay on this tree from tests/preview/fixtures/renew-ask-live-2026-10-03.json. These are the real answer
  model's outputs on the recorded live envelopes of update 969390031 (the requestedEnd shape that the exact reader refuses,
  and the clean shape under the revised wording) and update 969390030 (two clean replays). renew-ask-live is 7/7. It
  includes the repair's case: an unreadable proposal together with an unverifiable date, on both a string reply and a
  separated reply. The new path fires on the recorded requestedEnd output: no request is opened, and the sent reply is the
  fixed OPERATOR_ACTION_UNREAD line, not "passing along below". The earlier recorded shapes still replay: ask-anytime 3
  passed / 3 skipped (claude-sonnet-5 answers to updates 969390016 and 969390012), operator-yes-live 2 passed / 5 skipped
  and review-yes-live 2 passed / 6 skipped (proof-room updates 715672779 and 715672853).
- The raise step is max(original allowance, current allowance) in proposalState only. One explicit raise therefore at most
  doubles a limit (2500 to 5000) instead of adding 16. The cap-reached raise is untouched (operator-yes 15/15,
  review-yes-wiring 15/15).
- The unit's own disclosure, carried as reported: its builder once ran a read-only `git stash list` (it changed nothing).
  No stash command of any kind was run in this build.

## Merge, and point (a)

- `git fetch`: origin/cint-L36 = 4228d0c5, origin/w3-renewform = c97dcac5, origin/main = d4a3170d.
- `git worktree add -b cint-L37 … origin/cint-L36`, then `git merge --no-edit origin/w3-renewform`. It fast-forwarded to
  c97dcac5 (4 unit commits: aaa823dd, 22182d2d, 43a0e55a, c97dcac5). **Conflicts: none.**
- `git merge-base --is-ancestor 4228d0c5 HEAD`: true. origin/main d4a3170d is an ancestor of HEAD. 4228d0c5 is an ancestor
  of origin/w3-renewform.
- No `git stash` was used.

## Point (b): bytes

- Default root (no explicit-yes port): **+0**. default-context-floor 4/4 (always-sent bytes ≤ 22,959, unchanged), and
  default-root-conversation 4/4. On such a root the guidance does not ride.
- Root with an admissible source: OPERATOR_ACTION_GUIDANCE is 621 bytes of text, up from 397, and **639 bytes on the prepared
  envelope, up from 415** (+224). Both numbers are pinned and pass in ask-anytime.test.ts (lines 120-124).

## Point (c): record paths

- reviews/w3-renewform-change-review.md: all 4 Decision lines cite
  /Users/dabombstudio/.instar/agents/echo/.instar/lanes/w3-renewform-PROGRESS.md.
- reviews/w3-renewform-repair-change-review.md: its 1 Decision line cites the same path.
- No repoint was needed.

## Desk chain (on c97dcac5, as lanes/cint-L36-PROGRESS.md records it)

- `desk-repin-chain.sh`: inventory updated 0, chain refreshed (no tree change).
- `nice -n 10 npx tsc -p tsconfig.build.json`: exit 0.
- `desk-rehash-owner-manifests.mjs`: 0 pins refreshed in every manifest.
- `build-register.mjs --replay --commit c97dcac572f24cd7decb418c2861869d42913c4d` produced generation
  sha256:9a812da402e5bc22411fc7aec9f93ef995053324af84d48ab8d929118ca10231 (270 entries, 116 rules). The seven generated/
  files were committed as **f684f5f4**. `build-register.mjs --check`: check:true.
- reviews/cint-L37-change-review.md was committed as **02203355**.

## Checks (on the final tree)

- `npm run lint`: exit 0. It printed "architecture checks passed", register wiring `"issues":[]`, and no "pin trails" line.
- `npm run typecheck`: exit 0.
- `node scripts/check-architecture.mjs`: "architecture checks passed", exit 0.
- `node scripts/build-register.mjs --check`: check:true.
- `git diff --check origin/main...HEAD`: exit 0. `git diff --check`: exit 0.
- `node scripts/check-change-review.mjs check`: see Push.

## Tests (foreground, `nice -n 10 npx vitest run <file> --maxWorkers 1`, one process per file, all on the final tree, no failures)

- Unit and yes-path: renew-ask-live 7/7, ask-anytime 3 passed / 3 skipped, operator-yes 15/15, operator-yes-live 2 passed /
  5 skipped, review-yes-wiring 15/15, review-yes-live 2 passed / 6 skipped, review-yes-source 5/5, capability-briefing 6/6.
- default-context-floor 4/4, default-root-conversation 4/4, journal.test.ts 70/70.
- Every tests/preview test file that mentions renewal: journal-renewal-continuity 6/6, renew-activation 11/11,
  renewal-predecessor-launch 2/2, renewal-result-send-outcome 3/3, activation-authority 7/7, credential-reminders 8/8,
  journal-memory-dedupe 8/8, journal-obligations 21/21, journal-requested-action 20/20, journal-upgrade-compat 1/1,
  offline-canary 6/6, proofs 25/25, replaced-answer-operator-request 3/3, rerecord-profile 5/5, restart-handoff-program 7/7,
  secret-custody 8/8, two-machine-serving 13/13.
- First-landing and additivity baseline: tests/assembly/round8-additivity 6/6, tests/e2e/measurement 15/15,
  tests/harness-adapters/a2-governance-and-additivity 4/4, tests/harness-adapters/contract-map 6/6,
  tests/intake/round10-additivity 1/1, tests/integration/measurement 14/14, tests/measurement/contract-map 3/3,
  tests/operator/round15-regressions 20/20, tests/rungraph/production-grounding-scope 2/2, tests/scheduled/review-round14 3/3,
  review-round15 2/2, review-round17 3/3, tests/transport/loop-main-head-mutation 3/3.

I did not run the full suite, any load test, or anything in the background. Nothing was killed. **Exit 137: none.**

## Model-facing parts (observer #106)

This build adds no model-facing text of its own. Recorded real shapes replayed on the merged tree:
- w3-renewform: the five real answer-model outputs in renew-ask-live-2026-10-03.json (update 969390031, recorded wording
  with requestedEnd and revised wording clean twice; update 969390030 clean twice). The new unread path fires on the
  recorded requestedEnd output.
- Carried: the claude-sonnet-5 answers for updates 969390016 and 969390012, and the proof-room outputs for updates
  715672779 and 715672853.

## Constitutional rules touched

- **3**: no reply announces a request that was not formed. The fixed unread line replaces the model's "below" reply.
- **2, 42**: an unreadable proposal (including one under operatorRequest) is reported, not dropped. The refusal survives an
  invalid date on a string reply.
- **10, 12**: no keyword list. The guidance names a field shape and copies no test phrase.
- **79**: renewal and raise can be reached from the phone by asking. **82, 98**: the runner writes the one exact request, and
  only an admitted explicit yes applies it. The raise is bounded at a doubling per request.
- **106**: the recorded turns and real outputs replay (above). **37**: every named test passes, and the skips are the units'
  declared env-bound cases.
- **66, 69, 90**: the generated files were regenerated by replay, never hand-edited. **74**: reviews/cint-L37-change-review.md
  covers every commit since 4228d0c5.
- **101**: no hook was bypassed. `git config --get core.hooksPath` is unset (exit 1), and the common hooks directory holds
  only samples (0 non-sample files). I used plain `git commit` and an ordinary merge, and no `git stash`.
- **102**: decisions are recorded and reported below. **113**: machine-local, unchanged. **116**: the merge as it is plus
  the standard desk tools, nothing more.
- **Floors**: secrets are unchanged. Spend cap: no model call was added, and default-root bytes are +0. Stop is unchanged.
  No duplicate sends: still one send per turn. Durable intake: no row kind or field was added.
- The constitution and the task do not conflict.

## Decisions (Rule 102)

- **cint-L37-merge**: merged origin/w3-renewform (c97dcac5) onto origin/cint-L36 4228d0c5 with an ordinary merge. It
  fast-forwarded because the unit was built on this exact base, so the unit's reviewed bytes land unchanged and there were
  no conflicts.
- **cint-L37-desk**: re-ran the desk chain on c97dcac5 (repin 0, tsc 0, rehash 0) and replayed the register at c97dcac5
  (f684f5f4). check is true.

## Push

`node scripts/check-change-review.mjs check`, run after the final commit with this report written, printed "change-review
check OK" (709 commits since adoption, 168 records, 103 current). Lint exited 0 with no pin-trails line,
`build-register.mjs --check` gave check:true, and both `git diff --check` runs exited 0.

`git fetch` just before the push: origin/cint-L36 was still 4228d0c5 and origin/main was d4a3170d. Both are ancestors of HEAD.

Pushed: origin/cint-L37 = 0220335539721e43b769b81158bc3849b66ec040 = local HEAD (new branch). Commits since 4228d0c5:
- 02203355 review: cint-L37 record (cint-L36 4228d0c5 plus w3-renewform c97dcac5)
- f684f5f4 desk: cint-L37 register replay at c97dcac572f24cd7decb418c2861869d42913c4d
- c97dcac5, 43a0e55a, 22182d2d, aaa823dd (the unit, fast-forwarded)

Every file this report says changed is in that range: the generated/ files are in f684f5f4, the record is in 02203355, and
the unit's files are in its own commits. This report is outside the tree.

`git status --porcelain`:
```
?? node_modules
```
(only the node_modules symlink; no modified tracked file)

`git show --stat` of the pushed head:
```
commit 0220335539721e43b769b81158bc3849b66ec040
Author: Echo <echo@sagemindai.io>
Date:   Sat Oct 3 02:55:43 2026 -0700

    review: cint-L37 record (cint-L36 4228d0c5 plus w3-renewform c97dcac5)
    
    Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>

 reviews/cint-L37-change-review.md | 37 +++++++++++++++++++++++++++++++++++++
 1 file changed, 37 insertions(+)
```

READY 0220335539721e43b769b81158bc3849b66ec040

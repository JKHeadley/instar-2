# First-landing and additivity checks refuse a branch that does not contain the current main tip (Rule 37 quarantine)

**Status:** CLOSED (2026-09-28, un-quarantined on cint-L2 in unit-u9). **Owner:** constitutional-build integration desk (Echo). **Opened:** 2026-09-28.

On branch `cint-1` (full runs retained as `/private/tmp/claude-501/cint1-livefix/full2.log` and `re1.log`, and a pristine built checkout of `2988aa95` as `base-re1.log`), these cases fail deterministically, on this change and on its base alike:
- `tests/assembly/round8-additivity.test.ts` — `R8-F1 compares pre-existing Part Ten fixture outcomes on P11 first landing`, `V72 compares Part Ten decoder field deletions on P11 first landing`.
- `tests/intake/round10-additivity.test.ts` — `R10 rereview8 V95 compares 20 ordinary receive/recover/expire outcomes on P11 first landing`.
- `tests/harness-adapters/a2-governance-and-additivity.test.ts` — `P13-A2-ADDITIVITY compares inherited fixtures on A2 first landing and always checks boot shards and architecture`.
- `tests/harness-adapters/contract-map.test.ts` — `P13-ADDITIVITY R5-F10 first-landing scope is inapplicable after A1 lands while structural checks remain`, `R5-F2 journal reading and rotation are structurally NON-EXECUTABLE-UNTIL-slice-A2`.
- `tests/integration/measurement.test.ts` — `P16-NF-53 [behavior:legacy-additivity] reports first-landing scope inapplicability after measurement lands`.
- `tests/measurement/contract-map.test.ts` — `P16-NF-01 [behavior:contract-inventory] P16-NF-52 [behavior:non-executable-exclusion] P16-NF-53 [behavior:legacy-additivity] contract inventory retains all labels and structural exclusions`.
- `tests/operator/round15-regressions.test.ts` — `V79 checks the operator unit first-landing source scope`.
- `tests/rungraph/production-grounding-scope.test.ts` — `PRODUCTION-GROUNDING-SCOPE ledger 45 confines this unit to its two owner source directories`.
- `tests/scheduled/review-round14.test.ts`, `review-round15.test.ts`, `review-round17.test.ts` — the P15 round-fourteen additivity, round-fifteen F2 and round-seventeen F2 `proves the complete current-main population` cases.
- `tests/transport/loop-main-head-mutation.test.ts` — `SLB-LEGACY-ALL-KINDS-93 SLB-LEGACY-TEXT-RANGES-111 compares 1313 signed legacy mutations on loop A1 first landing`.
- `tests/e2e/measurement.test.ts` — the whole file: its shared `beforeAll` runs `scripts/check-p16-additivity.mjs`, so the setup fails and every case in the file fails with it.

**Cause (known):** `scripts/first-landing.mjs` and the P15 additivity check refuse when `HEAD` does not contain the local `main` tip. `main` is at `1d0fe2be` (#135, design-document approvals); `cint-1` descends from `04710832` (#134). The error is `first landing: stale main baseline 1d0fe2be…; HEAD descends from 04710832…` (P15: `stale baseline 04710832…; current main tip is 1d0fe2be… and is not contained in HEAD`). The refusal is the check working as designed on a branch that trails main; it is not caused by the declaration repair on this branch.

**Reproduce:** in a worktree whose `HEAD` does not contain the local `main` tip, run `npx vitest run tests/assembly/round8-additivity.test.ts tests/scheduled/review-round14.test.ts`.

**Disposition:** each exact case is quarantined with `it.skip` and a comment linking here; `tests/e2e/measurement.test.ts` is quarantined file-wide with `const it = defineTest.skip`. Bodies, assertions and timeouts are retained. While quarantined, the gate does not prove first-landing scope and additivity for P11, P13, P15 and P16, the loop legacy-mutation comparison, the operator and grounding source scopes, or the fresh-process P16 measurement behaviors in `tests/e2e/measurement.test.ts` (P16-NF-01/03/05/22–30/52/53). A green gate is reported as green with this quarantine named.

**Repair and closure:** the owner rebases the branch onto the current `main` (or lands it) so `HEAD` contains the main tip, removes the skips, and shows every retained case passing. If a case still fails after the rebase, it is a real regression and is reported as such.

**Re-check on the cint-L2 merge (2026-09-28):** with the skip removed on the merged tree, every quarantined first-landing case again failed with `first landing: stale main baseline 14bc4a17…; HEAD descends from 04710832…`, including the e2e measurement setup (`.instar/lanes/cint-L2-merge-quar1.log`, `.instar/lanes/cint-L2-merge-quar2.log`). The quarantine stays.

**Closure (2026-09-28, unit-u9 on cint-L2 `9f890018`):** the cause is gone. `9f890018` is the merge commit whose second parent IS the current `main` tip `14bc4a17`, so `git merge-base main HEAD` now returns `14bc4a17` and every guard that compares the two is satisfied: `firstLanding` returns `{mainTip: 14bc4a17…, mergeBase: 14bc4a17…, applicable: false}` for all four evidence sets (`src/operator/seams.ts`, `src/harness-adapters/adapter.ts`+`holder.ts`, `src/transport/loop-a1/index.ts`, `src/measurement/index.ts`), `p15AdditivityBaseline()` reports the `14bc4a17` merge base with 266 source and 753 test/fixture files, and `scripts/check-p16-additivity.mjs` prints `P16 first-landing additivity inapplicable`. Why the 2026-09-28 re-check paragraph above saw the refusal on a tree it described as merged is not established here; what is established is the state of `9f890018` as measured above, where the refusal does not occur.

All 14 `it.skip` quarantines were removed and `tests/e2e/measurement.test.ts` restored to importing `it` directly; every one of the 13 files is now byte-identical to its pre-quarantine blob (verified against `17fe14b5^`). `npm run typecheck` and `npm run build` exit 0, and the 13 files run 79 passed / 3 failed — every previously quarantined case passes, including the whole 15-case `tests/e2e/measurement.test.ts` file whose `beforeAll` runs `check-p16-additivity` (evidence: `.instar/state/unit-u9-targeted.log`, `unit-u9-typecheck.log`, `unit-u9-build.log` in the agent home).

The 3 remaining failures are NOT this record and NOT caused by removing the skips: `P15 round-fourteen map-strict reviewer cases`, `round-fifteen F1` and `round-seventeen F1` fail with `missing authoritative seam ledger`, and they fail identically on the pristine cint-L2 base with the quarantine still in place (`.instar/state/unit-u9-base-cintL2.log`: 3 failed / 2 passed / 3 skipped, the 3 skipped being this record's cases). They are recorded separately in `docs/defects/absent-lane-documents-off-mac.md`, which states their Rule 37 posture: not a flake, not quarantined, and a standing bar to a green suite on this machine.

**Multi-machine posture:** the tests are machine-local. This record travels with the repository; the quarantine it described no longer exists in the tree.

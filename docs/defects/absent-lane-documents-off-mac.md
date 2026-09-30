# P15 map-strict checks refuse when the lane design documents are absent from the machine (no quarantine)

**Status:** REPAIRED at source, 2026-09-28 (closure pending the Mama PC run, see below). **Owner:** constitutional-build integration desk (Echo). **Opened:** 2026-09-28.

On the WSL2 machine (Mama PC), these three cases fail deterministically, on cint-L2 and on every branch taken from it:
- `tests/scheduled/review-round14.test.ts` — `P15 round-fourteen map-strict reviewer cases refuse stale REQUESTED records after their grants`.
- `tests/scheduled/review-round15.test.ts` — `P15 round-fifteen F1 every contract-map entry point refuses stale request-only deferral evidence`.
- `tests/scheduled/review-round17.test.ts` — `P15 round-seventeen F1 refuses duplicate, missing and extra identities at both complete-map entry points`.

Each fails with `Error: missing authoritative seam ledger: /home/echo/.instar/agents/.instar/lanes/SEAM-LEDGER.md`.

**Cause (known):** `scripts/check-p15-contract-map.mjs` resolves `laneDirectory` as `<scripts>/../../../.instar/lanes`, i.e. two levels above the repository root, and requires `SEAM-LEDGER.md` there. The lane design documents (`SEAM-LEDGER.md`, `seam-response-*.md`, `design-19-*.md`) are not in the repository — they live in the agent home of the machine that runs the design lane. On this machine there is no `SEAM-LEDGER.md` anywhere (`find /home/echo -name SEAM-LEDGER.md` is empty), so the requirement cannot be met at any worktree depth. Two things compound: the documents are absent, and the two-levels-up derivation additionally assumes the repository sits at `<agent-home>/<dir>/<repo>` (it holds for `<agent-home>/.worktrees/<slug>`, not for a worktree placed directly at `<agent-home>/<slug>`).

**Reproduce:** on a machine with no `<agent-home>/.instar/lanes/SEAM-LEDGER.md`, run `npx vitest run tests/scheduled/review-round14.test.ts tests/scheduled/review-round15.test.ts tests/scheduled/review-round17.test.ts`.

**Disposition under Rule 37:** NOT quarantined, and NOT filed as a "pre-existing failure" — Rule 37 abolishes that category. The flake clause does not apply either: these three do not flip without a code change, they fail every run on this machine, so there is nothing flaky to quarantine. Nothing is skipped and no assertion is weakened; the three cases stay active and stay red.

The consequence must be stated plainly rather than softened: **while this holds, this machine cannot produce a green suite**, so the lane's green gate for Rule 37 has to be taken on a machine that holds the lane documents. That they are not caused by the change under test is established (on a pristine `origin/cint-L2` worktree at `9f890018` with no edits at all, the same three fail with the same error — `.instar/state/unit-u9-base-cintL2.log`), but that fact narrows blame; it does not make the red acceptable.

**Repair and closure:** either the lane documents are made present on every machine that runs the gate (they are lane inputs the checks treat as authoritative, so the honest fix is to make them available rather than to relax the check), or the check states its dependency and refuses in a way that distinguishes "the ledger says no" from "this machine has no ledger". Until then, the P15 map-strict reviewer, deferral-evidence and identity checks are proved only on a machine that holds the lane documents (the Mac). Closure requires the three cases passing on this machine.

**Multi-machine posture:** this is exactly a multi-machine gap — the checks pass where the lane documents live and fail where they do not. The record travels with the repository.

**Repair (2026-09-28, branch unit-u9):** the first option above. The lane documents the check reads are now committed at `tests/scheduled/lane-evidence/`, and `scripts/check-p15-contract-map.mjs` reads them from there. Nothing in the check was relaxed: it still requires the ledger, still refuses a missing or ungranted file, and still checks every ledger row, request status and grant addendum. It reads them from the repository instead of from whichever agent home sits two levels above the checkout. The `seam-response-*.md` and `design-19-*.md` files are byte-for-byte copies. `SEAM-LEDGER.md` holds only the ledger's numbered table rows, the only part the check reads. The ledger's operational journal, which carries account and machine details, is not copied. The directory README gives the refresh command for when a named grant changes. Because the evidence is pinned to the commit, it is the same on every machine and in every checkout layout. That also removes the two-levels-up layout assumption.

**Verified on the Mac:** the three cases pass in the unit-u9 worktree. They also pass in a detached checkout of the repaired commit placed under `/tmp`, where no `.instar/lanes` exists anywhere above the checkout. That reproduces the Mama PC condition. **Closure** still requires the three cases passing in the Mama PC full run of this branch. That run is the gate; this record does not claim it.

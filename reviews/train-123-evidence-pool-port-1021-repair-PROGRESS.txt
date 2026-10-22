# pool-port-1021 pipeline repair

Repair base: ef73f90b46f1c3523a0a55efc6f48a92d5385656. Unit baseline for targeted re-review: 588332d9d0839cd504bee2819e297cd6222a2ef9 (not the inherited d0944dba train range).

Why this item exists: port the 1.x subscription pool so the agent continues its conversation on an admitted login before quota exhaustion, without changing its model; repair review round 1's two selection defects.
Plan step: UPDATE-PATH-PLAN-1021 Step 2, pool slice; LIVE-PATH-PLAN sections 1–3/f several-logins experience floor and 2026-10-21 login-full direction CMT-872.
It unblocks: targeted independent re-review and landing of pool-port-1021, then the separately owned signin-port-1021 slice. This is not reapproval of inherited train changes.

Read main's docs/00-the-purpose.md then docs/01-the-rules.md in full, and compared the reviewed branch's constitution (single-machine profile wording and Rule 117 additions). Read D17 sections 3/10 and lanes/constitution-audit/reconciled.md quota dispositions C1:59/62/105/173 and C2:50/112–114. No constitutional conflict found. No constitution wording edited.

## Decisions and affected Rules

- repair-soft-pressure (Purpose constraint 5; Rules 14/15/77/95/103/116): 80% optimization pressure is computed from fresh observations; only the configured cutoff or provider limit creates a durable hold. Unknown observations defer optimization and preserve ordinary source admission. No new gate, store, daemon or capability restriction.
- repair-partial-quota (Rules 13/26/36): any fresh known live window takes precedence over the compatibility snapshot. Missing companion windows remain ineligible for proactive destination placement. The wholly-unavailable fallback keeps original snapshot age and account binding.
- Rules 55/60/61: existing five attempts per ten minutes and collector backoff/breaker remain; reaching the attempt bound cannot strand an otherwise usable current account. Cooler-target margin remains.
- Rules 28/30/44/63/68/96/100/113: existing adapter, account custody, install/update path, ownership fence, durable run and transcript handoff remain. Deliberately machine-local observations and selection; no new cross-machine writer. Each selected source still passes the existing authority/stop validation.
- Rules 34/35/37/70: disposable fixtures, red-before-green boundary regressions, foreground targeted tests, compiler and required gates. No quarantine, load test or full suite.
- Rules 49/65/74/101/102/111/112: explicit scoped review, source-level repair, recorded decisions, original history retained; no independent convergence claimed. core.hooksPath is unset; common hooks directory contains sample hooks only; no hook bypass.

Five floors: secrets remain in account-bound custody, no secret logged; spend remains at existing dispatch checkpoint; stop and admission rechecked; no sender or output retry added; intake and handoff journals preserved.

## Verification while repairing

Initial regression run: 66 passed, 4 failed. Both success-then-500/stale cases selected null; both partial-live (five-hour/weekly) cases selected the older snapshot destination. Cutoff negatives passed.
First implementation run exposed an existing provider-limit neighbor: soft-pressure reason accidentally imposed proactive requirements on ordinary typed-limit selection. Corrected reason precedence at the selector; then 70/70 passed.
Expanded final source tests: 72/72 passed, including collector breaker, restart, withdrawal, both configured cutoffs, partial-low unknown destinations, and five-attempt bound plus ten-minute recovery. TypeScript typecheck exited 0.
Architecture check exited 0. Initial lint identified only source wiring pin trails tests/preview/harness-login-pool.mjs; delegated desk repin is required and will be recorded below.

Recorded-shape replay: tests/preview/fixtures/retrospective-duty-followup-train-1-2026-10-08.json, from proofroom-summary-cascade-stall-2026-09-30.json and guidance-live-2026-10-03.json read-only captures. Summary writer summary:715672480; uncertain summary 715672483; Jev undecided 715672482; Jev unsure 969389570; reply review 969389923; delivered reply update 715672479; empty candidate in recorded context update 715672550 (no delivery claim). Each now passes through soft 80% all-hot selection, observation loss and continuing source dispatch with raw bytes unchanged and no hold/handoff. Existing captured provider-limit and quota boundary tests also pass. No new live-account operation or deployment claimed; prior unit copy proof remains historical evidence only.

Exit 137: none.

## Generated source pins and commits

Ran npm run build (exit 0), delegated desk-rehash-owner-manifests.mjs (all zero updates) and desk-repin-chain.sh (zero inventory updates). No pin was hand-edited. Source and review committed as 0164f6e11ad814975adddbf4efe98c0cad6ed9f2. Then ran node scripts/build-register.mjs --replay --commit 0164f6e11ad814975adddbf4efe98c0cad6ed9f2 (exit 0) and committed generated outputs plus review binding as 3b52d8a7af70905a833de8f97c4d01daa32e60fa.

Final-commit lint: architecture checks passed and wiring issues=[], exit 0. Register check: exit 0, generation sha256:5e6f62b5fc7c2932b0faf2448a798c08d6ad41c22bb4625d16d4e20812c4ac77. Whitespace checks origin/main...HEAD, working tree and index all exit 0. Change-review audit is running; no READY assertion yet.

Original unit report backup: /Users/dabombstudio/.instar/agents/echo/.instar/lanes/pool-port-1021-PROGRESS.md.bak-repair-20261022-014743.
Metadata fields queued through the desk single-writer patch queue; no direct items.json edit.
Rule 5: corrected docs/topic-login-pool.md so documentation states ephemeral pressure, preserved cutoff/provider holds, unknown continuation and partial-live precedence. Commit 566b6cb1 contains only documentation and its review update. Its lint passed (issues=[]). The prior audit passed (3581 commits, 1062 records); final-commit register/review checks are rerunning because the documentation commit followed the audit start.

### Files touched beyond the selector named in the must-fixes

- tests/preview/harness-login-pool.test.ts — regression neighbors and recorded-shape replay at the repaired path.
- docs/topic-login-pool.md — remove the obsolete fresh-source-only/all-hot hold description and document partial live precedence (Rule 5).
- reviews/pool-port-1021-repair-change-review.md — bind all repair commits to their affected rules, side effects and evidence (Rules 49/74/111/116).
- generated/capabilities.json — generated source commit/generation refresh.
- generated/capabilities.md — generated source commit/generation refresh.
- generated/coverage.md — generated source commit/generation refresh.
- generated/glossary.md — generated source commit/generation refresh.
- generated/register.json — generated replay and source-wiring pin refresh.
- generated/rules.md — generated source commit/generation refresh.
- generated/source.json — generated source commit/generation refresh.
- /Users/dabombstudio/.instar/agents/echo/.instar/lanes/pool-port-1021-PROGRESS.md — required Pipeline repair append; backup pool-port-1021-PROGRESS.md.bak-repair-20261022-014743.
- /Users/dabombstudio/.instar/agents/echo/.instar/lanes/pool-port-1021-repair-PROGRESS.md — required repair evidence and final status.
- /Users/dabombstudio/.instar/agents/echo/.instar/lanes/pipeline/desk-patches.jsonl — queued only this item's missing why/planStep/unblocks/reviewBase through desk-item.py; the driver applied the fields to items.json (verified read-only).
- /Users/dabombstudio/.instar/agents/echo/.instar/lanes/pool-port-1021-repair-lint.log — final-commit lint evidence.
- /Users/dabombstudio/.instar/agents/echo/.instar/lanes/pool-port-1021-repair-register.log — final-commit register check evidence.
- /Users/dabombstudio/.instar/agents/echo/.instar/lanes/pool-port-1021-repair-review.log — final-commit change-review audit evidence (exit 0).
- /Users/dabombstudio/.instar/agents/echo/.instar/lanes/pool-port-1021-repair-pushed-lint.log — pushed-head lint evidence.
- /Users/dabombstudio/.instar/agents/echo/.instar/lanes/pool-port-1021-repair-pushed-register.log — pushed-head register evidence.
- /Users/dabombstudio/.instar/agents/echo/.instar/lanes/pool-port-1021-repair-pinned.log — required pushed-head pinned READY tests.

The owner-manifest and inventory repin tools produced no content changes. No desk file was staged or committed; all desk artifacts stay at the absolute lanes path. No test quarantined, no declaration weakened, no hook bypass, no load test, no full suite and no exit 137.

## Final repair verification

Pushed head: 566b6cb126f6ea2ede5122f5f1b33ef58869e44c, verified equal to origin/pool-port-1021. Source repair 0164f6e1, generated pins/review 3b52d8a7, documentation/review 566b6cb1 are all pushed. Every claimed repository file is in these commits; git status is entirely clean. No merge or serving deployment performed.

- Targeted changed test file: 72 passed, including the real collector success→500/breaker and stale regressions, fresh partial-live/older-complete regressions in both windows, cutoff/provider/authority negatives, attempt bounds, compatibility positive and recorded shapes through the repaired path.
- nice -n 10 npm run typecheck: exit 0. nice -n 10 npm run build: exit 0.
- Final-commit npm run lint: exit 0; architecture passed and wiring issues=[]. Repeated on pushed head: exit 0. No architecture/R105 exception remains.
- Final-commit npm run register:check: exit 0. Repeated on pushed head: exit 0.
- Final-commit node scripts/check-change-review.mjs check: exit 0, check OK; 3582 commits, 1062 records. Older-record debt/tier notes are reported by the checker and are not failures; no finding was suppressed.
- Required pinned READY command (absolute lanes/pipeline/ready-gate-tests.py list, nice -n 10, --maxWorkers 1): 8 files, 120 tests passed, 354.67 seconds, exit 0 on the pushed head. See pool-port-1021-repair-pinned.log.
- git diff --check origin/main...HEAD, unstaged and staged checks: exit 0.

Unrun or host-dependent checks: no required targeted/cheap/pinned check omitted. The full suite is intentionally left to the Studio pipeline as instructed. No new live-account proof or deployment was performed; the prior unit copy proof is historical only. This READY submits a completed pushed repair for the gate, not an independent review verdict.

Desk metadata correction verified in items.json after the driver applied the queued patch: why, planStep, unblocks and reviewBase=588332d9d0839cd504bee2819e297cd6222a2ef9 are present. Rule 95 is explicit in the affected-rule record. No test quarantine, no hook bypass, no stash, no load test, no secret printed and no exit 137.

```text
$ git status --porcelain
(no output)
exit 0

$ git show --stat 566b6cb126f6ea2ede5122f5f1b33ef58869e44c
commit 566b6cb126f6ea2ede5122f5f1b33ef58869e44c
Author: Echo <echo@sagemindai.io>
Date:   Thu Oct 22 01:46:26 2026 -0700

    Document soft quota pressure and partial-window precedence

 docs/topic-login-pool.md                       | 16 ++++++++++------
 reviews/pool-port-1021-repair-change-review.md |  4 ++--
 2 files changed, 12 insertions(+), 8 deletions(-)
exit 0

$ git show --stat 0164f6e11ad814975adddbf4efe98c0cad6ed9f2
commit 0164f6e11ad814975adddbf4efe98c0cad6ed9f2
Author: Echo <echo@sagemindai.io>
Date:   Thu Oct 22 01:41:34 2026 -0700

    Preserve current login on failed quota optimization reads

 reviews/pool-port-1021-repair-change-review.md | 27 +++++++
 tests/preview/harness-login-pool.mjs           | 33 +++++----
 tests/preview/harness-login-pool.test.ts       | 97 ++++++++++++++++++++++++++
 3 files changed, 142 insertions(+), 15 deletions(-)
exit 0

$ git show --stat 3b52d8a7af70905a833de8f97c4d01daa32e60fa
commit 3b52d8a7af70905a833de8f97c4d01daa32e60fa
Author: Echo <echo@sagemindai.io>
Date:   Thu Oct 22 01:42:04 2026 -0700

    Regenerate quota repair source pins and bind review

 generated/capabilities.json                    | 4 ++--
 generated/capabilities.md                      | 4 ++--
 generated/coverage.md                          | 4 ++--
 generated/glossary.md                          | 4 ++--
 generated/register.json                        | 2 +-
 generated/rules.md                             | 4 ++--
 generated/source.json                          | 4 ++--
 reviews/pool-port-1021-repair-change-review.md | 2 +-
 8 files changed, 14 insertions(+), 14 deletions(-)
exit 0

$ git diff --check origin/main...HEAD
(no output)
exit 0

$ git diff --check
(no output)
exit 0

$ git diff --cached --check
(no output)
exit 0
```

READY 566b6cb126f6ea2ede5122f5f1b33ef58869e44c

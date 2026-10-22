# pool-port-1021

Started 2026-10-22T00:20:06.848391-07:00; Mac Studio; branch pool-port-1021; base 588332d9 (origin/train-113).

Constitution read in full: docs/00-the-purpose.md, then docs/01-the-rules.md. Read UPDATE-PATH-PLAN-1021 Step 2 and keep/cut table; docs/17 sections 3 and 10; parked step1e-pool-1013 and pool-records-relocatable-1013 reports. Current train already incorporates the per-topic successor of their durable handoff and relocation work; reuse it without transplanting old files.

Scope: first slice only, live per-member quota and pre-wall login handoff, model unchanged. Sign-in repair is the explicitly assigned next unit, not a completion claim here.

Source reuse audit: instar src/core/SubscriptionPool.ts (account/config-home identity and AccountQuotaSnapshot); ProactiveSwapMonitor.ts (80% lag-aware threshold, fresh reads, no mid-turn interruption, bounded swaps); QuotaAwareScheduler.ts (both binding windows, fresh cooler destination, use-before-reset scoring); src/monitoring/QuotaTracker.ts (unknown/stale is not zero, both windows); src/core/QuotaPoller.ts (official OAuth usage endpoint, mapUsageResponse and readUsage, transient per-account custody); SessionManager.ts (explicit config home and --resume with retained conversation ID). Existing 2.0 topic-login-pool and production-session driver supply the parked resume implementation and durable reservation. No large 1.x file is copied wholesale.

simplestRobustRoute: add the bounded 1.x telemetry read to the existing adapter and feed the existing durable pool and serialized per-topic handoff. No new daemon, model selector, sender, intake, or secret store. Unknown telemetry cannot manufacture room. Existing live model/authority/spend/stop checks still admit every call.

Rules touched: Purpose 2/3 (retain continuity and honest evidence); 1/4/26/28/100 (fixed endpoint, account-bound custody, exact admission and unknown data); 30/115 (vendor logic at adapter); 34/35/36/70 (recorded quota fixtures, disposable test roots, actual copy proof required); 41/75 (existing model doorway unchanged); 44/45 (installed pool path reused); 55/60/61 (bounded reads/backoff, serialized handoff); 63/68/96 (existing owner, durable intake and resume); 49/74/102/111/116 (review, decisions, simpler route and provenance); 101/112 (no bypass, no history rewrite); 113 (machine-local telemetry and custody under existing owning-host fence).

Five floors: secrets remain in existing custody and never logs; model calls retain shared spend cap; stop checked before telemetry/dispatch; no replay of uncertain sends; intake and handoff journals unchanged.

Live proof dependency: desk testlogin-1021 policy excludes adriana/amrch2388, sagemind-adriana, gearfinity3d and Luna. Report says justin-gmail was exhausted and no second test login was provisioned. Will inspect current permitted allocation without opening prohibited profiles or credentials. No live root/bot/chat mutation authorized or attempted.

Exit 137: none.

## Implementation and decision journal

pool-port-1021-read: port QuotaPoller.mapUsageResponse/readUsage into scripts/claude-pool-quota.mjs with injected custody, admission, clock and stop. Fixed official HTTPS endpoint, redirect refusal, four-second deadline, 64 KiB body bound, max eight members, one concurrent request, per-member minute cadence, exponential failures and thirty-minute breaker after three failures. No token refresh or new secret store. Missing fields remain unknown rather than 1.x's zero coercion.

pool-port-1021-selection: reuse current durable pool plus topic handoff; cap proactive threshold at 1.x's 80%, require 15 additional points of destination headroom, and port use-before-reset scoring. The existing source reset holds and five-attempt/ten-minute cap prevent reversals without another ledger. With every alternative hot, a fresh source below its existing configured cutoff (capped at 95%) stays usable; provider-limit/unavailable/unknown cannot use this exception. Prepared destination rechecks margin. Selection never reads or changes the model.

pool-port-1021-custody: collector uses only each reviewed member's existing custody and runtime validation. HTTP 401/403 is telemetry unknown, not sign-in failure. An explicitly configured old usageFile remains a compatibility source with its original identity and timestamps. No borrowing other account credentials.

pool-port-1021-proof: failing-first test on the recorded 1.x quota snapshot failed at 80% (old selector returned login 0, expected 1); collector test initially failed on missing module. New all-hot and prepared-margin negatives failed first (four failures) and pass after porting the brakes. Current targeted pool/collector/topic/installer set: 127 tests passed. Additional journal-conversation-session tests: 92 passed, including recorded summary/Jev/review/reply replays. Actual launcher check found an import inserted above its shebang; fixed at source and retesting. Architecture command exited 0, no findings.

## Read-only live quota evidence

2026-10-22T07:21:12.747Z: existing 2.0 justin-gmail harness custody, GET official usage endpoint: HTTP 403 permission_error. No token or raw exception emitted; no inference or credential mutation. Evidence: lanes/pool-port-1021/test-login-quota.json.
2026-10-22T07:23:27.439Z: reuse 1.x defaultTokenResolver for ONLY id justin-gmail / headley.justin@gmail.com, after readAccountEmail matched its original config home; official read-only usage endpoint returned 200. Captured raw response bytes: tests/preview/fixtures/claude-usage-2026-10-22.json. Five-hour 2%, weekly 38%. The old desk note that this test account was exhausted is stale. No prohibited account credential was opened or used. The raw response is now replayed by the adapter test; the historical snapshot at 2026-10-21T18:43:40.701Z is retained separately with provenance for pool boundary tests.

Live proof remains pending: one permitted Claude account is known, but the required second allocated test login is not. Its 2.0 inference-only custody also cannot read usage; the original 1.x scoped OAuth credential can. Requested the two allocated test profiles while continuing work. No synthetic success is represented as the two-login live proof.

Hook check: git config --get core.hooksPath returned no setting; common hooks directory contains sample hooks only. No bypass used. No dependency installation, stash, load burner, protected-account mutation or Telegram send.

## 1.x source byte witnesses

- src/core/SubscriptionPool.ts: sha256 17075e989586e5f47039872799d089fa20eb43c66f57ea9da88e3ed8deea1145
- src/core/ProactiveSwapMonitor.ts: sha256 8d52e54dbe284402209364b2c73271e364b1e391c8abe7e5838bdfcdd2699044
- src/core/QuotaAwareScheduler.ts: sha256 55e4581b9bfa3234aa0879a3b15bfe85f5394564be7906152026313fbbc3a11d
- src/monitoring/QuotaTracker.ts: sha256 590aad6ee3ef2fbe32fa2552e0fed4c696528f8c99f26d57ea6b797d3de11925
- src/core/QuotaPoller.ts: sha256 a574f4cea7541386f1a69db4f1bb62d5c3594856a896c8cb6f1bc1bed18c2e1d
- src/core/SwapAntiThrash.ts: sha256 5deae2ad083fd1da125762a66c3ba17f01b5288198b1404ebaf0658ea23c703e
- src/core/SessionManager.ts: sha256 ddd758986b90bccb5e72cd05a00ede284f81d1b5ca51734aa6e6757bf4f37793

## Allocation correction and live copy proof

The earlier pending-allocation note is superseded: LIVE-PATH-PLAN row 653 explicitly allocates sagemind-justin as a proof login. Current read-only quota established both it and justin-gmail have room. No excluded account was opened. Optional quotaLogin is an absolute installed reference to the EXISTING private, account/profile/org/plan-bound custody format; inference credentials remain unchanged. Import regression failed first because primary quotaLogin was dropped, then fixed. Held-secret sources include the optional record. Temporary scoped credentials for these two allowed accounts were removed after proof.

First proof attempt stopped before a model launch due to incomplete proof call accounting. Second attempt completed the first turn and correctly hit its four-call ceiling during the resumed turn; both workers closed. The bounded proof budget was set to eight calls, without changing production floors. A cleanup assertion initially used a nonexistent phase field; disk showed both closedAt witnesses and the corrected proof was rerun. Final real proof: 1 test passed (11.63 seconds), live quota read for both accounts, source weekly observation injected to 80% without quota burning, unchanged claude-opus-5-5, same native conversation ID, second account recalled a random word from the first account turn, exactly one transcript handoff, both workers closed. Evidence: /Users/dabombstudio/.instar/agents/echo/.instar/lanes/pool-port-1021/copy-1792655527779/result.json, live-quota.json, first.json, second.json, edges.jsonl, physical/sessions.json. No bot/chat or serving root used.

Recorded consumer shapes replayed through the NEW collector-fed handoff: retrospective-duty-followup-train-1-2026-10-08.json, summary update 715672480, uncertain summary 715672483, Jev undecided 715672482, Jev unsure 969389570, reply review 969389923, delivered reply 715672479, empty-context reply 715672550. Topic suite 34 passed; journal conversation suite 92 passed.

## Final targeted validation

Targeted foreground suite, nice -n 10 and --maxWorkers 1: 358 passed across eight files, one opt-in live test skipped in the offline run (the separately enabled real copy proof passed). Includes all ten actual launcher cases, production session driver 119, journal conversation 92, topic 34, pool 64, installer 19, collector 16, held secrets 4. Architecture: exit 0, no findings. Typecheck and build: exit 0. Diff whitespace checks against origin/main and unstaged: exit 0. Source commit 49932291 contains all source/test/doc changes; no .instar file staged.

ELI16: The agent now checks how full each approved login is. At 80% it prepares a move to a login with at least 35% room, between turns. It carries the conversation across and keeps the same model. Missing quota stays unknown. If every alternative is hot, a still-usable current login continues below its cutoff. Sign-in repair belongs to the next unit.

## Pushed-head evidence

Regenerated source register pins from 4993229175d624ff4747bfe46ce329e54af13a47; no declaration or native certificate changed. git push -u origin pool-port-1021 exited 0. Not merged. Final-head npm run lint: architecture passed and register wiring issues=[]; npm run register:check: exit 0. Pinned READY tests running in foreground. An optional later remote re-read failed; successful push output and matching tracking ref below establish the pushed head.

```text
$ git status --porcelain
(no output)
exit 0
```

```text
$ git show --stat 2fa370ac
commit 2fa370ac1b0ca61bd4e1b9596d3b12fe0ad5d444
Author: Echo <echo@sagemindai.io>
Date:   Thu Oct 22 00:57:04 2026 -0700

    Regenerate register pins for live pool quota port

 generated/capabilities.json | 4 ++--
 generated/capabilities.md   | 4 ++--
 generated/coverage.md       | 4 ++--
 generated/glossary.md       | 4 ++--
 generated/register.json     | 2 +-
 generated/rules.md          | 4 ++--
 generated/source.json       | 4 ++--
 7 files changed, 13 insertions(+), 13 deletions(-)
exit 0
```

```text
$ git show --stat 49932291
commit 4993229175d624ff4747bfe46ce329e54af13a47
Author: Echo <echo@sagemindai.io>
Date:   Thu Oct 22 00:55:49 2026 -0700

    Port live Claude pool quota and pre-wall conversation handoff

 docs/topic-login-pool.md                           |  52 +++++++-
 reviews/pool-port-1021-change-review.md            |  29 +++++
 scripts/claude-pool-quota.mjs                      |  85 +++++++++++++
 scripts/topic-login-pool.mjs                       |   1 +
 tests/preview/claude-pool-quota.test.ts            |  92 ++++++++++++++
 .../preview/fixtures/claude-usage-2026-10-22.json  |   1 +
 tests/preview/fixtures/pool-quota-2026-10-21.json  |  34 +++++
 tests/preview/harness-login-held.test.ts           |  23 +++-
 tests/preview/harness-login-launcher.test.ts       |  14 ++-
 tests/preview/harness-login-pool.mjs               |  61 +++++++--
 tests/preview/harness-login-pool.test.ts           |  81 +++++++++++-
 tests/preview/installed-harness-logins.mjs         |   6 +-
 tests/preview/installed-harness-logins.test.ts     |  20 ++-
 tests/preview/journal-agent.mjs                    |  11 +-
 tests/preview/pool-quota-live.test.ts              | 137 +++++++++++++++++++++
 tests/preview/topic-login-pool.test.ts             |  38 ++++--
 16 files changed, 645 insertions(+), 40 deletions(-)
exit 0
```

```text
$ git diff --check origin/main...HEAD
(no output)
exit 0
```

```text
$ git diff --check
(no output)
exit 0
```

```text
$ git rev-parse HEAD
2fa370ac1b0ca61bd4e1b9596d3b12fe0ad5d444
exit 0
```

```text
$ git rev-parse origin/pool-port-1021
2fa370ac1b0ca61bd4e1b9596d3b12fe0ad5d444
exit 0
```

## Review-record correction and final head

The first pinned READY run passed all 120 tests across eight files (366.91 seconds). The additional change-review audit found only this unit's abbreviated base hash and resulting uncovered source/pin commits. Corrected Subject base to the full base SHA and documented Rule 37 scope of the opt-in real-account test. Source/fixture prompt scan found no touched prompt findings. Commit ef73f90b contains only these review corrections and covers the source plus pin commits; pushed successfully, not merged. Product code is unchanged from the 358-test run and real copy proof. Final-head lint and register checks both exited 0, no issues. Required pinned tests and the review audit are rerunning in foreground on the final pushed head. Logs: lanes/pool-port-1021/final-lint.log, final-register.log, final-pinned.log, final-review.log. No full suite run.

## Final acceptance

Final pushed head: ef73f90b46f1c3523a0a55efc6f48a92d5385656. Not merged or deployed to a serving installation. Final-head npm run lint: exit 0, architecture passed and register wiring issues=[]. npm run register:check: exit 0. Required pinned READY suite: 120 passed in eight files, 328.65 seconds, exit 0. Change-review check: OK, exit 0. Targeted source tests: 358 passed; separately enabled real two-login copy proof: passed. Typecheck and build: exit 0. No R105 or register-wiring exception remains.

Live proof ended state=complete, detail=conversation closed, calls=5, reserved=8, child=null. Both exact workers have closedAt witnesses. Same native conversation ID and claude-opus-5-5 on both logins (CMT-872). No excluded account, bot, chat or serving root used. Temporary quota credential copies remaining: zero. Manifest positive/negative command with the repository TS loader: absolute quotaLogin retained; relative quotaLogin refused. An initial standalone command omitted that loader and failed module resolution; the correctly loaded command exited 0. No repository change resulted.

Unrun or host-dependent checks: none of the required targeted/READY checks. The full suite is deliberately left to the pipeline under the Studio task instructions. Sign-in repair remains the separately assigned second slice. Exit 137: none.

```text
$ git status --porcelain
(no output)
exit 0

$ git show --stat ef73f90b46f1c3523a0a55efc6f48a92d5385656
commit ef73f90b46f1c3523a0a55efc6f48a92d5385656
Author: Echo <echo@sagemindai.io>
Date:   Thu Oct 22 01:06:49 2026 -0700

    Bind pool review to full base and document live proof scope

 reviews/pool-port-1021-change-review.md | 3 ++-
 1 file changed, 2 insertions(+), 1 deletion(-)
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

The source and generated-pin commit stats above remain part of this pushed head; this final commit contains the review binding and opt-in proof scope. All claimed repository changes are in the three pushed commits. No tracked or untracked worktree changes remain.

READY ef73f90b46f1c3523a0a55efc6f48a92d5385656

## Pipeline repair

Round-1 independent NO is addressed by the source repair beginning at ef73f90b46f1c3523a0a55efc6f48a92d5385656. The earlier READY above is historical, not a readiness claim for this repair. Detailed rules, recorded update ids, verification and final pushed-head evidence are in pool-port-1021-repair-PROGRESS.md. This record will receive the final READY only after the final audit, push and pinned gates pass.

Both defects reproduced before the fix. Soft 80% placement pressure no longer creates a durable hold; cutoff/provider holds remain. Fresh partial live windows survive older compatibility data, and missing windows remain ineligible destinations. All 72 targeted selector/collector/restart/recorded-shape tests pass. Rule 95 now explicitly names fail-open reachability through ordinary admission; Rule 26 retains actual window evidence. Rule 5's product documentation is corrected. Rules 55/60/61 retain attempt/backoff bounds; Rules 63/68/96 and all five floors retain existing dispatch, ownership and continuation checkpoints. No independent convergence, fresh live-account proof or serving deployment is claimed.

Desk scope correction queued through pipeline/desk-item.py (single-writer protocol): why, planStep, unblocks, reviewBase=588332d9d0839cd504bee2819e297cd6222a2ef9. Next targeted review must use that unit baseline, not inherited d0944dba. The plan link is UPDATE-PATH-PLAN-1021 Step 2 / LIVE-PATH-PLAN 1–3/f.

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

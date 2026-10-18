# revert-delta-1015

Started 2026-10-15 17:17:52 PDT on Mama PC WSL. Base train-44 a1b59d03faad205e33fc33dc6915825abfecb635. Studio brief read via read-only file API. Constitution read in full. Local continuation disabled.

Removed delta-turn cache, full-input snapshot helper and wiring, recovery capability metadata, hook-size expansion and delta-only tests. Native turn builder matches train-46 d97249b540e0f9804644f2fce0ca84ae2f3c52b1 source blob aa5781940b6f2d23fefa11edc5aa5e4d8c337eca exactly. Preserved the other train-44 live changes. No Studio writes, Telegram, proof rooms or pool logins.

Decisions:
- revert-delta-scope: Reverse b4ba0fdf product/delta-only test hunks; retain later policy pins, historical reviews and desk certificate.
- revert-delta-publication: Regenerate existing shape-only register from f0c6fdc314aae51d3d54ff9ea32fff2916d7c6f8; leave native certificate unchanged.
- revert-delta-replay: Use existing recorded fixtures permitted by the brief; prove complete delivery against train-46 and seven recorded model-output shapes.

Rules touched: 1 (existing safety floors preserved); 29 (input identities unchanged); 32/113 (removed worker-local cache, durable multi-machine custody unchanged); 36 (recorded bytes replayed); 46 (queue draining unchanged); 47/96/110 (full input on every turn, no cross-turn reference dependency); 49/74/102 (scope, side effects, rollback and decisions recorded); 58/75 (judgment provenance/metering unchanged); 60 (full-envelope byte and resource bounds preserved); 70/111 (inspect original implementation and prove reference behavior); 101 (no hook bypass); 116 (remove machinery without measured benefit). Secrets, spend cap, stop, no duplicate sends and durable intake remain on their existing paths.

Recorded replay:
- tests/preview/fixtures/packet-once-walk-2026-10-14.json, source step1-rewalk4-1014-records/walk/smoke-host.json SHA256 5270f5d6eb41dcc30c49ebf9915827322147056ba59e5e1b9c852d33ae0efa8a: updates 840342886, 840342891, 840342892. Single and batch deliveries, continuing worker and replacement; exact original envelope bytes, local replay custody IDs/grant only. Baseline digests in tests/preview/fixtures/revert-delta-train46.json generated after exact source comparison with train-46.
- tests/preview/fixtures/retrospective-duty-followup-train-1-2026-10-08.json: summary-writer summary:715672480, summary-uncertain 715672483, Jev-undecided 715672482, Jev-unsure 969389570, reply-review 969389923, delivered reply 715672479, empty bubble in recorded context 715672550. Repeated and changed packets retain complete envelopes. Offline formatting evidence only.

Verification so far:
- npm ci and npm run build passed.
- Targeted run: 13 files, 335 passed / 43 failed initially. One failure was the later topic-login-pool test still expecting removed snapshot API; fixed it, and all 33 topic-login-pool tests passed. The remaining 42 are untouched provider-launch tests, recorded below. Changed/direct-consumer tests now account for 277 passing cases across 11 files (including the physical session-stop hook).
- Separate policy-only run: 2 passed. Tools sha256:5fed4bcfd823d950c1444a008a9c11d40824671dd8e68aa2f5908ed8534a2926; conversation sha256:3598cc7514f4be6ffec52f1d321e1596cd2db420a67fd7958281f3862dd9ce8c unchanged.
- Exact train-46 source comparison passes for production-session-io.mjs, session-hooks/stop.mjs, contracts.ts, conversation-harness-adapter.ts, conversation-topics.ts, production-conversation-session.ts and journal-agent.mjs.
- git diff --check origin/main...HEAD and unstaged checks passed.

Files beyond the brief's chiefly-named files: scripts/production-session-io.mjs, scripts/session-hooks/stop.mjs, src/assembly/contracts.ts, src/assembly/conversation-harness-adapter.ts, src/assembly/README.md, tests/harness-adapters/codex-conversation-worker.test.ts, tests/integration/session-stop-hook.test.ts are original delta hunks; tests/preview/topic-login-pool.test.ts removes the later repair's obsolete snapshot wiring assertions/import only. Added reviews/revert-delta-1015-change-review.md and tests/preview/fixtures/revert-delta-train46.json. Historical delta reviews and native conformance declaration retained.

Unrun or host-dependent checks:
- tests/assembly/production-provider-subscription.test.ts: 38 physical provider-launch/transport failures on WSL; file and provider unchanged. Policy test passed. Per remote-host instruction, not investigated.
- tests/assembly/production-provider-tools.test.ts: 4 physical provider-launch failures on WSL; file and provider unchanged. Policy test passed. Per remote-host instruction, not investigated.
- Skipped tests/e2e/session-work-tmux.test.ts, session-work-live.test.ts, production-session-alive.test.ts, session-restart-delivery.test.ts and integration tool-turn-harness-user-live, session-driver-deadline, harness-adapters-holder-lifecycle and harness-adapters rounds 4/5/6/7/12/13/14 regression files per remote-host charter. Physical session-stop-hook test did run and pass.
- No live preview journals fetched: used committed recorded fixtures as the specific brief explicitly permits. No live latency or quality claim.

No exit 137 observed. No hooks bypassed.


Pushed source f0c6fdc314aae51d3d54ff9ea32fff2916d7c6f8 and register publication cd0d39860182c52b03b74066fa5b40e8bf70bd54. Generated capability/register/rule/glossary/coverage/source files were regenerated with `node scripts/build-register.mjs --commit f0c6fdc314aae51d3d54ff9ea32fff2916d7c6f8 --replay`; only source/generation provenance changed, no declaration altered.

Required git status --porcelain:
```text
```
(empty output)

Required git show --stat cd0d39860182c52b03b74066fa5b40e8bf70bd54:
```text
commit cd0d39860182c52b03b74066fa5b40e8bf70bd54
Author: Echo <echo@sagemindai.io>
Date:   Thu Oct 15 17:26:00 2026 -0700

    Publish register for restored complete turn grounding

 generated/capabilities.json                | 4 ++--
 generated/capabilities.md                  | 4 ++--
 generated/coverage.md                      | 4 ++--
 generated/glossary.md                      | 4 ++--
 generated/register.json                    | 2 +-
 generated/rules.md                         | 4 ++--
 generated/source.json                      | 4 ++--
 reviews/revert-delta-1015-change-review.md | 2 ++
 8 files changed, 15 insertions(+), 13 deletions(-)
```

Source commit containing the product/test changes:
```text
commit f0c6fdc314aae51d3d54ff9ea32fff2916d7c6f8
Author: Echo <echo@sagemindai.io>
Date:   Thu Oct 15 17:22:48 2026 -0700

    Revert delta-only native turn grounding and replay complete inputs

 reviews/revert-delta-1015-change-review.md         |  27 +++
 scripts/production-session-io.mjs                  |  25 +--
 scripts/session-hooks/stop.mjs                     |   2 +-
 src/assembly/README.md                             |   2 +-
 src/assembly/contracts.ts                          |   4 +-
 src/assembly/conversation-harness-adapter.ts       |   2 +-
 src/assembly/conversation-topics.ts                |   2 +-
 src/assembly/production-conversation-session.ts    |  65 +------
 .../production-conversation-session.test.ts        | 187 ++++-----------------
 .../codex-conversation-worker.test.ts              |   2 +-
 tests/integration/session-stop-hook.test.ts        |  34 ----
 tests/preview/fixtures/revert-delta-train46.json   |  33 ++++
 tests/preview/journal-agent.mjs                    |   5 +-
 tests/preview/topic-login-pool.test.ts             |   6 +-
 14 files changed, 108 insertions(+), 288 deletions(-)
```

Final-head checks:
- npm run typecheck: exit 0; npm run build: exit 0.
- npm run register:check: exit 0, generation sha256:0068c51dcea41df9fc5490b0dbbf40cd2934717769a8532baea8223e7a57b868, 292 entries / 116 rules / 34 terms; shape-only publication.
- node scripts/check-register-wiring.mjs: exit 0.
- node scripts/check-architecture.mjs and npm run lint: exit 1, ONLY R105 native Darwin self-host certificate for changed composition sha256:dcdb48480d86498aec29e753d9020e088bf72c10cc601194c0a813a66061abc2. Declaration deliberately unchanged; desk re-runs native contract on Studio per charter exception.
- Source-head change review: 2008 findings, all missing Studio paths (Rule 102 report files and historical Rule 70 live result files); no other findings. Unit-specific findings are only the expected missing /Users/dabombstudio/.instar/agents/echo/.instar/lanes/revert-delta-1015-PROGRESS.md for its Decisions. This report is the desk-copy source, and names each Decision. Final-head review exited 1 with 2009 missing-Studio-path findings and no other findings; all three unit Decisions have only the expected Rule 102 missing report.
- READY pinned tests on final pushed head: 6 files, 89 passed, exit 0 (76.89s). Files: journal-obligations, journal-boundaries, proofs-launcher, capability-briefing, topic-awareness, constitution-briefing-sync. The downloaded desk selector already excludes e2e/integration on Linux.

Final status verified: clean git status; origin/revert-delta-1015 equals HEAD; whitespace checks pass. Report is stored only at the instructed local state path for the desk to copy. Architecture residue is only the expressly allowed R105 native macOS composition certificate; register/wiring and pinned tests pass. Host-dependent provider and missing-Studio-path review evidence are enumerated above.

READY cd0d39860182c52b03b74066fa5b40e8bf70bd54

## Pipeline repair — native composition certificate

Repair base: cd0d39860182c52b03b74066fa5b40e8bf70bd54. Host: DaBombs-Mac-Studio.local, Darwin, Node v24.14.1. Constitution docs/00-the-purpose.md then docs/01-the-rules.md read in full. No constitutional wording or product behavior changes planned.

## Pipeline repair

MUST-FIX 1: renew native conformance only after the existing native contract passes on the exact Studio composition, then regenerate dependent publication. The task explicitly requests this evidence repair here. No certificate substitution before proof, disabled harness, weakened check, or new mechanism.

Rules touched: 26/34/70 (actual native contract execution before the claim); 37 (resolve the architecture failure at its source); 49/74/102/111 (record scope, side effects, decision and layer-below evidence); 90 (generated publication from committed source); 101 (ordinary git commits without bypass); 105/115 (exact native harness/doorway/platform/mode conformance, with other tuples unchanged); 113 (certificate binds only the measured Darwin runtime, not other hosts); 116 (reuse the contract and existing generator). Purpose ability preservation: no tools, network, delegation, persistence, sessions or framework ability is narrowed. Secrets, spend cap, stop, no duplicate sends and durable intake remain enforced on their existing paths.

Decision: native-certificate-renewal — execute the existing native contract on this Studio, preserve its measured closure before/after, and record only successful evidence; refresh publication using the existing replay generator. Replay is register shape evidence, not a full-suite result.

Integration boundary (review NOTE 1): original unit subject base a1b59d03faad205e33fc33dc6915825abfecb635; f0c6fdc314aae51d3d54ff9ea32fff2916d7c6f8 and cd0d39860182c52b03b74066fa5b40e8bf70bd54 contain the 21-file revert/publication unit. The supplied 40de162c384b66613aa2700511e46a59cc762726..cd0d39860182c52b03b74066fa5b40e8bf70bd54 range includes 1,610 files; its inherited combined build requires its own verification. This repair does not certify that wider range.

Unrun or host-dependent checks (review NOTE 2): prior review reported 113 passed / 1 failed because its sandbox refused process identity via /bin/ps in codex-conversation-worker physical restart. That unchanged test remains for the unrestricted combined-build run. Full suite is prohibited in this repair; no saved full-run report fetched or fabricated.

Initial architecture command failed on missing local built core and incomplete closure. This fresh worktree had no node_modules/dist. npm ci --ignore-scripts --no-audit --no-fund installed the locked dependencies successfully; building before native proof.

Native proof: named physical contract passed before declaration renewal (1 passed, 9 excluded by title selector). All 10 native-harness-contract cases passed after renewal, including exact certificate assertion, journal restart/no-duplicate-send and stop, captured refusal/timeout routes, and readiness deadline. Actual runtime node-24.14.1@sha256:91d3afb67a7dc211f642f2328f822505ff1c1ad381e98ffdd21b003970deeeda; complete unchanged closure of 264 files, digest sha256:dcdb48480d86498aec29e753d9020e088bf72c10cc601194c0a813a66061abc2. The native certificate JSON records both measurements and the actual test report. Provider frames are recorded fixtures; native processes/install are real; no live answer-quality claim. This repair changes no model-facing prompt, parser or acceptance behavior; the original unit's recorded output replays remain documented in its original PROGRESS.

Build and typecheck exit 0. Post-renewal architecture exit 0. Lint initially then reported source wiring pin trails harness.declarations.json. Ran both instructed desk repin scripts: owner manifests already current (zero pins changed); support inventory refreshed the inherited contracts.ts hash and its dependent checker digest. No hand-edited pins. Source/evidence commit db055691 includes declaration, mechanical support pins and review record. No hook bypass; core.hooksPath unset and shared hook directory checked: samples only.

Publication commit: 302134cf (full SHA recorded at completion), generated from db0556915e06f320d382d3e264ccae2eb41559b0. Final committed native closure checked again after desk pin/publication updates: still exactly the tested 264 files and dcdb4848… digest. No native test rerun is needed for unchanged executable composition.

Final-commit cheap checks completed so far: npm run lint exit 0 (architecture passed; register wiring issues=[]); npm run register:check exit 0 (292 entries, 116 rules, 34 terms; generation sha256:ff8d81f01bb2d986d608749207c5fe9b859f0f207eaba7e489b469712a68aa45). Register replay remains shape-only. git diff --check origin/main...HEAD, git diff --check and git diff --cached --check all passed.

Files touched beyond the must-fix named declaration (one per line):
- scripts/check-assembly-contracts.mjs — delegated desk repin refreshed the inventory digest; no logic change.
- tests/assembly/production-grounding-inventory.json — delegated desk repin refreshed the inherited contracts.ts support-source hash.
- generated/capabilities.json — regenerate committed source provenance.
- generated/capabilities.md — regenerate native certificate and committed source provenance.
- generated/coverage.md — regenerate committed source provenance.
- generated/glossary.md — regenerate committed source provenance.
- generated/register.json — regenerate declaration/register facts and source provenance.
- generated/rules.md — regenerate committed source provenance.
- generated/source.json — regenerate source evidence and generation provenance.
- reviews/revert-delta-1015-native-certificate-change-review.md — Rule 74 record covering both repair commits, floors, side effects, rollback and unit boundary.
- /Users/dabombstudio/.instar/agents/echo/.instar/lanes/revert-delta-1015-PROGRESS.md — append requested Pipeline repair record and final evidence.
- /Users/dabombstudio/.instar/agents/echo/.instar/lanes/revert-delta-1015-repair-PROGRESS.md — repair progress, affected rules and final evidence.
- /Users/dabombstudio/.instar/agents/echo/.instar/lanes/revert-delta-1015-native-composition-before.json — measured complete composition before contract.
- /Users/dabombstudio/.instar/agents/echo/.instar/lanes/revert-delta-1015-native-contract-before.json — actual named native contract result before renewal.
- /Users/dabombstudio/.instar/agents/echo/.instar/lanes/revert-delta-1015-native-certificate.json — verify unchanged composition after passing contract, before recording declaration.
- /Users/dabombstudio/.instar/agents/echo/.instar/lanes/revert-delta-1015-native-contract-after.json — actual 10/10 native contract results after renewal.
- /Users/dabombstudio/.instar/agents/echo/.instar/lanes/revert-delta-1015-repair-lint.log — final-commit lint output.
- /Users/dabombstudio/.instar/agents/echo/.instar/lanes/revert-delta-1015-repair-register.log — final-commit register check output.
- /Users/dabombstudio/.instar/agents/echo/.instar/lanes/revert-delta-1015-repair-review.log — final-commit change-review check output.

- /Users/dabombstudio/.instar/agents/echo/.instar/lanes/revert-delta-1015-repair-pinned.json — actual final-head READY pinned-test report (8 files, 102 passed).

Final verification:
- `nice -n 10 npm run build` and `nice -n 10 npm run typecheck`: exit 0.
- `nice -n 10 npx vitest run --maxWorkers 1 tests/preview/native-harness-contract.test.ts`: exit 0, 10 passed. The named native case also passed before certificate renewal; measured composition unchanged through final head.
- `nice -n 10 npm run lint`: exit 0 after final commit; architecture checks passed, wiring issues=[].
- `nice -n 10 npm run register:check`: exit 0 after final commit, current shape-only publication.
- `nice -n 10 node scripts/check-change-review.mjs check`: exit 0 after final commit; 2,765 commits covered by 815 records, check OK. Tier-audit notes are advisory, no errors.
- Required pinned selector used at its actual absolute desk path: `nice -n 10 npx vitest run --maxWorkers 1 $(python3 /Users/dabombstudio/.instar/agents/echo/.instar/lanes/pipeline/ready-gate-tests.py)`: exit 0, 8 files / 102 tests passed on final pushed head. Files: journal-obligations, journal-boundaries, e2e/register, integration/register, proofs-launcher, capability-briefing, topic-awareness, constitution-briefing-sync. No full suite run.
- `git diff --check origin/main...HEAD`, unstaged and cached whitespace checks: exit 0 after push.
- `git push origin revert-delta-1015`: exit 0; `git ls-remote --heads origin revert-delta-1015` matches HEAD 302134cf1c57a897083a73994aed98ebf28dd008.

Every repository file reported as changed is contained in the two pushed commits below. No tracked modifications or untracked files remain. All desk records are solely in the absolute desk lanes directory; nothing under .instar/ was staged or committed. No exit 137 observed, no hook bypass and no load test performed.

Required `git status --porcelain` after push:
```text
```
(empty output)

Required `git show --stat 302134cf1c57a897083a73994aed98ebf28dd008` after push:
```text
commit 302134cf1c57a897083a73994aed98ebf28dd008
Author: Echo <echo@sagemindai.io>
Date:   Thu Oct 15 17:41:21 2026 -0700

    Publish register for renewed native conformance

 generated/capabilities.json                                   | 4 ++--
 generated/capabilities.md                                     | 6 +++---
 generated/coverage.md                                         | 4 ++--
 generated/glossary.md                                         | 4 ++--
 generated/register.json                                       | 2 +-
 generated/rules.md                                            | 4 ++--
 generated/source.json                                         | 4 ++--
 reviews/revert-delta-1015-native-certificate-change-review.md | 4 ++--
 8 files changed, 16 insertions(+), 16 deletions(-)
```

Source/evidence commit `git show --stat db0556915e06f320d382d3e264ccae2eb41559b0` (also pushed):
```text
commit db0556915e06f320d382d3e264ccae2eb41559b0
Author: Echo <echo@sagemindai.io>
Date:   Thu Oct 15 17:40:49 2026 -0700

    Renew native conformance after Studio contract proof

 ...-delta-1015-native-certificate-change-review.md | 29 ++++++++++++++++++++++
 scripts/check-assembly-contracts.mjs               |  2 +-
 src/assembly/harness.declarations.json             |  2 +-
 tests/assembly/production-grounding-inventory.json |  2 +-
 4 files changed, 32 insertions(+), 3 deletions(-)
```

READY 302134cf1c57a897083a73994aed98ebf28dd008

# train-174-p2 — PROGRESS (release train train-174, consolidated candidate, 2026-11-05)

Builder: the M5 Pro remote builder, worktree /Users/adriana/echo-compute/builders/train-174-p2, branch train-174-p2 created at exact b5806d1e015dc650cdc1dee2e0accab05a849d4b from origin/fix/browser-mcp-worker-read-1104 and never moved. I read docs/00-the-purpose.md and docs/01-the-rules.md in full first. Evidence snapshots (cint-L37-PROGRESS.md, resource-census-stream-1105-PROGRESS.md, status-read-profile-1105.md, the desk consolidation decision train-174-p2-consolidation-1105.md, the two desk chain scripts and the builder auth guidance) were fetched read-only from the Studio file API; the three named snapshots match their stated sha256 exactly. This file is the committed copy of the builder report; the handoff copy at /Users/adriana/echo-compute/builders/train-174-p2-report.md adds the final push evidence.

## 1.X FIRST — researched reuse comparison

This train adds no source of its own: its only repository work is ordinary merges, the desk chain and review records, and 2.0's merge/replay tooling has no 1.x counterpart to reuse (inspected: JKHeadley/instar main a8af8bff, docs/specs/ and scripts/ for a register replay or change-review chain; none exists there, and 1.x's `git`-level release flow is the plain merge this train already uses). The members carry their own researched comparisons, which this train carries into its record and relies on: the status parser unit inspected JKHeadley/instar main a8af8bff StateManager (whole-file JSON.parse), CoherenceJournalReader (bounded JSONL tails) and StoreSnapshot and found no bounded chunked snapshot tokenizer to reuse, retaining the 2.0 reader; the census unit inspected the installed instar 1.3.1672 dist (hostSemaphoreCore, hostSpawnSemaphore, ResourceSampler, ResourceLedger, FrameworkProcessProvenance, SessionWatchdog, ProcessFootprintMonitor, OrphanProcessReaper, paths and sha256 in its record) and reused the 1.x bounded batched-read and protected-unknown patterns on 2.0's Ten inventory and Six settlement owners; the owner-browser grant and carryover-08 units carry theirs in reviews/owner-browser-grant-default-1104-change-review.md and reviews/carryover-08-historical-review-scope-1104-change-review.md.

## Merges (one ordinary merge each, never a stash, never a hook bypass)

Base: live build b5806d1e015dc650cdc1dee2e0accab05a849d4b. core.hooksPath is unset (exit 1) and the common hooks directory holds only sample hooks; plain `git merge --no-edit` and `git commit` throughout.

- train-174-merge-main (entry 0, e198c0f3): origin/main ef4a964232b7baf17d8fc4cf1b8a248a95b6d513. Conflicts: the seven generated/ outputs (taken for regeneration) and the derived approvedConversion pin in scripts/build-register.mjs. docs/00 and docs/01 are byte-identical to main; docs/01-the-rules.changelog.json merged with both sides' versions kept. The merged register-source/bootstrap-anchor.json was verified against the committed shape and all five bound documents before the pin was re-derived.
- train-174-merge-status-snapshot (entry 1, 75f37c31): b5d1d95ea39aa0d6d72f22e3c7ca35fac8ce5c4c. Clean ort merge, no conflict. Member report /Users/dabombstudio/.instar/agents/echo/.instar/lanes/status-read-profile-1105.md.
- train-174-merge-census (entry 2, 178cf055): d3086e1127fdfb8b821db1e8d7e6b9d1ce79f4fb. Conflicts: generated/ only. Member report /Users/dabombstudio/.instar/agents/echo/.instar/lanes/resource-census-stream-1105-PROGRESS.md.
- train-174-merge-train168 (entry 3, 42c0ae94, desk consolidation of 07:12 PST): origin/train-168-p2 39a3d63b21e859d05a5de5a9ad176ac10dc10270 carrying 9d45ea843f0ba09e7d4444be63c72525fbba57fb. Conflicts: generated/ and the two reopened browser review records (both reopen notes kept, one after the other). The derived pin agreed on both sides.
- train-174-merge-train169 (entry 4, b1a62c11): origin/train-169 d4cc1cf4bb061ac48d8f2a075323e2040c5391c5 carrying d873fe2158a29a5e784be12e5592777d6d7a8e43. Conflicts: generated/, the two browser records (original Outcome kept, train-169's reopen outcome carried as an added line) and src/assembly/harness.declarations.json (native conformance certificate; train side kept, see train-174-conformance).

Ancestry on the final tree: b5806d1e, ef4a9642, b5d1d95e, d3086e11, 39a3d63b, d4cc1cf4, 9d45ea84 and d873fe21 are all ancestors of HEAD. Nothing left out (train-174-C). Members overlap only in generated/ and the reopened browser records (train-174-A). The supplied worktree and branch were used at the exact base and never moved; published as train-174-p2 per the assignment footer (train-174-B).

## Desk chain (as lanes/cint-L37-PROGRESS.md records it), run after entry 2 and again after entry 4

- desk-repin-chain.sh: "inventory updated 0", "chain refreshed", no tree change (both runs).
- `nice -n 10 npx tsc -p tsconfig.build.json`: exit 0 (both runs).
- desk-rehash-owner-manifests.mjs: 0 pins refreshed in all seven owner manifests (both runs).
- approvedConversion: the merged anchor hashes to sha256:5f9699641d6ae54b98a8e6facfbb52870429da9b93435127a9106fff14227c5e with the repository's own canonical hash (neither parent pin matched the merged anchor); train-168-p2 and train-169 derived the same value independently.
- `build-register.mjs --replay --commit 178cf055a6430c841edebca984e4f39494df6b1f`: generation sha256:3ba1f5a9884ddad29e3810a6d48d89e41177de3b04326bd10077e840f8540163, committed as d964f0e6; `--check` true.
- `build-register.mjs --replay --commit b1a62c116b91641e8aad8c918811a2948dae969c`: generation sha256:2d079f3134c6f571bb0cbab556bd37cb42019f44fd742b0f2d0b47d1c42797c4, 297 entries, 120 rules, 34 terms, 48 warnings, 112 prerequisites, shape-only; committed as f4c08859; `--check` true. (train-174-desk)
- Guard constant: tests/preview/journal.ts PREVIEW_FIXED_PROMPT_BYTES = 23_459 unchanged on the merged tree; default-context-floor 6/6. Always-sent bytes on a default root: +0 against the live build (no member touches a prompt part; the train adds none).

## Change review

reviews/train-174-change-review.md: Subject base b5806d1e015dc650cdc1dee2e0accab05a849d4b, one Decision per merge and one each for A to D, plus train-174-desk, train-174-record-repair and train-174-conformance; every Decision cites its report. Decision ids named by this report: train-174-merge-main, train-174-merge-status-snapshot, train-174-merge-census, train-174-merge-train168, train-174-merge-train169, train-174-A, train-174-B, train-174-C, train-174-D, train-174-desk, train-174-record-repair, train-174-conformance.

train-174-record-repair: reviews/resource-census-stream-1105-change-review.md (the census member's own record, reviewed YES for d3086e11) failed the checker on every host for three structural reasons: a free-text `Convergence:` line (Rule 65 requires none or claimed), five evidence paragraphs appended after the closing block (Rule 116 requires simplestRobustRoute, 80/20 and VERDICT as the last three lines), and three Decision locators naming uncommitted relative `.instar/lanes/...` paths. The repair (commit 37271609) is format-only: `Convergence: none` with the original sentence kept verbatim as `Convergence note:`, the paragraphs moved above the Subject line unchanged, and the locators repointed to this committed report. The member's decisions, which this report therefore names with their origin, are: sampling-order-fence (hold selection while sampling and recheck pending membership before settlement; recorded in the member's own PROGRESS and record), census-stream (preserve the command projection and full population before materialization; named in /Users/dabombstudio/.instar/agents/echo/.instar/lanes/resource-census-stream-1105-PROGRESS.md), and same-owner-settlement (bounded single-flight current-owner re-observation of completed rows on admission pressure; recorded in the member's record, originally cited to the Studio lane file train168-first-memory-model-start-1105.md, which does not name the id). No sentence of the member's record was removed or reworded.

train-174-conformance: the native macOS self-host conformance certificate in src/assembly/harness.declarations.json carries census's sha256:2bfdee01…, train-168-p2 kept the base's value and train-169 carries sha256:dada2903…; the merged composition now hashes to sha256:ab0a2c97ab19d32a99887ca6ac700efa9a51d40c0028b927d2cefadba5e544d8 and matches none. The train side is kept unchanged, the R105 finding is left in lint (the one allowed exception, desk 2026-10-13) and tests/types/shipped-clients.test.ts fails on the same assertion; only a contract run on the Studio may re-declare it.

## Tests (foreground, Node 24.14.1, `nice -n 10 npx vitest run --maxWorkers 1`, chunks under 10 minutes, nothing in the background)

- Chunk A (members' and main's changed tests, guard, register, provider subscription): journal-json 23/23, process-census-query 5/5, resource-census-recovery 4/4, live-rule-four-admissions 4/4, constitution-pairing 27/27, tests/e2e/register 6/6, default-context-floor 6/6, production-provider-subscription 105/105 — 8 files, 180 tests, 0 failures.
- Chunk P (desk pinned ready-gate list from driver.py FAST_FIXED, all present on macOS): journal-obligations 51/51, proofs-launcher 8/8, tests/integration/register 7/7, constitution-briefing-sync 5/5, capability-briefing 9/9, journal-boundaries 23/23; topic-awareness 0/11 under the default tmpdir (host, see below) and 11/11 under a real-path TMPDIR.
- Chunk B (direct consumers of the changed scripts): tests/integration/resource-owner 39/39, harness-user 50/50, gate-split-merge 19/19, shipped-clients 5/5 (before the two extra heads), process-inventory 11/11, worktree-recovery 13/13, session-work-host 7/7, worktree-inventory 17/17, production-grounding-checker-round4b 1/1 — 9 files, 162 tests, 0 failures.
- Chunk C (preview consumers of resource-owner): tool-turn 15/15, native-loop 29/29, native-loop-replay 4/4, blocking-site-binding 7/7, deadset-recovery 10/10, topic-worker-capacity 9/9, measured 5/5, resource-admission-evidence 2/2; media-understanding 21/22 and telegram-files 8/11 (host, see below).
- Chunk N1 (train-168-p2 and train-169 changed tests and direct consumers): production-session-driver 182/182, production-conversation-session 189/189, journal-conversation-session 103/103, conversation-topics 93/93, change-review-git 37/37, codex-conversation-worker 32/32, owner-browser-gate 13/13, incremental-status 9/9, onboarding 8/8, test-worker-limit 8/8, session-protocol-io 9/9; trust-setup 10/11 (host, see below).
- Chunk N2 (remaining direct consumers after entry 4): production-session-work 36/36, live-sentinels 22/22, admission-gate 8/8, socket-drop-replay 20/20, production-grounding-checker-round4b 1/1, gate-split-merge 19/19, working-activity-failure 13/13, mcp-passthrough 3/3, session-driver-tmux 1/1; shipped-clients 4/5 (the R105 certificate, train-174-conformance).
- Journal family (tests/preview/journal*.test.ts, the remaining 108 files, real-path TMPDIR): results are appended under "Journal family" below.

## Checks on the final tree

- `node scripts/check-architecture.mjs`: exactly one finding, R105 on src/assembly/harness.declarations.json (the allowed exception, train-174-conformance). Every other architecture check passes.
- `node scripts/check-register-wiring.mjs`: `"issues":[]`, no pin-trails line. `npm run lint` therefore stops at the R105 finding only.
- `npm run typecheck`: exit 0. Build: exit 0.
- `node scripts/build-register.mjs --check`: check:true at b1a62c116.
- `node scripts/check-change-review.mjs check` on this host: results under "Change-review check" below.
- `git diff --check origin/main...HEAD` and `git diff --check`: results under "Push" below.

## Unrun or host-dependent checks (tests I did not change; no skip added) — train-174-D

- tests/setup/runtime.ts refuses Node 26; all runs used the certified Node 24.14.1 at /Users/adriana/echo-compute/node/bin.
- tests/preview/topic-awareness.test.ts seeds its journal under os.tmpdir(), which on this Mac is the symlinked /var/folders path; openPreviewJournal refuses a symlinked directory by design. It passes 11/11 with TMPDIR set to a real path, the convention the local gate scripts already use.
- tests/preview/trust-setup.test.ts (one case) spawns the `codex` CLI, which is not installed here (status null).
- tests/preview/media-understanding.test.ts (one case) and tests/preview/telegram-files.test.ts (three cases) need the local transcriber and the `_instarharness` macOS user (chmod +a refused); neither exists here.
- tests/types/shipped-clients.test.ts (one case) asserts the R105 certificate; it passed before the two consolidation heads changed the composition and fails for exactly the lint finding named above.
- `check-change-review.mjs check`: every remaining finding names a /Users/dabombstudio/... or /Users/Shared/... path that exists only on the Studio.
- Not run here: the full suite, load tests, the live "-live" and tmux e2e/integration consumers, native certificate renewal and the Studio proof rooms. The driver runs the combined candidate once.

## Constitutional rules touched and how each is satisfied

- 3 and 37: every claim here is tied to a command and its exit; red results are reported as red with their cause.
- 2 and 42: no reopen reason, member sentence or refusal was dropped in any resolution; the census record's text is preserved verbatim.
- 4, 26, 60, 61, 95: carried from the census and recovery members; the train adds no blocking site and no self-action.
- 13 and 51: carried from the status parser member (timing claims bound to the same captured input; measured scanning cost removed).
- 44 and 113: machine-local posture declared; no installed-file change beyond what the members' install closures already carry.
- 66, 69, 90: generated/ regenerated by replay from committed source, never hand-edited; the pin re-derived with the repository's own function.
- 91: docs/01 taken exactly from main with its changelog versions from both sides.
- 74 and 111: this record and the layer below it, re-checked rather than assumed.
- 101: no hook bypass; hooksPath unset, sample hooks only.
- 102: every mid-run decision is recorded and reported above.
- 109: the reopened browser rounds stay reopened with every side's reason; no frozen digest was refreshed as if reviewed.
- 116: the merges as they are plus the standard desk tools; nothing added beyond the pin derivation, one format repair and the union of notes.
- 119 and 120: carried from main unchanged (register 120 rules; constitution-pairing 27/27).
- Floors: secrets, spend cap, stop, no duplicate sends and durable intake are unchanged by every member and by this train.
- The constitution and the task do not conflict. Exit 137: none. No `git stash` of any form was used. No live root, runner, Telegram message, serving login or secret was touched or printed.

## Journal family

tests/preview/journal*.test.ts, all 112 files, under the real-path TMPDIR: journal-json, journal-obligations, journal-boundaries and journal-conversation-session in the chunks above; the remaining 108 files in four chunks (27 files each, 9:46, 3:49, 6:34 and 3:56 wall): 26 passed + 1 skipped (281 tests, 1 skipped), 27 passed (150 tests), 26 passed + 1 skipped (211 tests, 1 skipped), 27 passed (361 tests, 1 skipped). 0 failures. The skips are the units' declared env-bound cases: journal-assembled (1 test skipped), journal-memory-restart-soak (1 test skipped) and one case in journal-reopen-scaling.

## Change-review check

`node scripts/check-change-review.mjs check` on this host at d119434a (with train-169's updated checker): 3086 findings, of which 3082 name a /Users/dabombstudio/... or /Users/Shared/... locator that exists only on the Studio (every current record of every merged head cites its Studio lane report that way; host-dependent, train-174-D). The 4 remaining findings were this train's own and are repaired in the final commit: the census record's three locators resolved at that record's last commit, which predated this report (an integration note added to the record moves its last commit past the report), and one false Rule 71 scan hit on a postponement verb in this report's description of the sampling-order-fence decision, reworded. The result of the re-run on the final head is in the handoff copy of this report.

# rules-13-56-1021s

Constitution read in full: docs/00-the-purpose.md, then docs/01-the-rules.md on the assigned train-113 worktree. No 1.x equivalent exists for these desk checks.

Scope: repair group H desk checks; product repair only if evidence proves a product defect. Tier: bounded check repair. All desk artifacts live under the absolute shared lanes path; no .instar files staged.

Rules touched: 13 (numbers bind the measured subject; an explicitly unavailable age must remain honest), 56 (doorway map and standing freshness measured within the existing two-minute bound), 26/34/36/70 (actual recorded snapshots plus fresh proof-room execution, positive and negative cases), 35/100 (test login and proof room only, existing secret custody tests retained), 49/74/111 (traceability, side effects and layer-below review), 55 (bounded status polling), 101/112 (no hook bypass or history erasure), 113 (machine-local desk checks against the selected room, no product replicated state), 116 (simplestRobustRoute: correct existing predicates and observation order, retain shared polling and all named floors).

Safety floors: no change to secrets custody, spend caps, stop, duplicate-send prevention, durable intake or train timing. No load tests. No live operator chat or prohibited logins.

Initial evidence: 05:16 and 05:20 runs both recorded literal model=$MODEL. Their product maps were verified/provider-reported and numeric ages were correctly bound to claude-sonnet-5. Standing caught up in the saved h-standing snapshots. The desk 07:50 H/K setting resolution already repairs that cause; preserve it. The 10:02 run (update 367052690) has genuine changed-model evidence (configured claude-opus-5-5, observed claude-opus-4-8), explicit null age and null verifiedAt. H-L2c falsely rejects the honest absence of a measurement; Rule 56 must continue to reject changed/unverified routes.

Review: existing H-L4a/C53 read h-cap before the standing wait; that wait accepts false==false immediately. Move map verification into the existing bounded observation, keeping reply-specific Jev call deltas on h-cap. Rollback via a byte-for-byte H.sh backup before edit. No product behavior or model prompt/output parsing changes intended.

Verification so far:
- `nice -n 10 node scripts/check-architecture.mjs`: exit 0, architecture checks passed; no findings.
- `git diff --check origin/main...HEAD` and `git diff --check`: exit 0.
- `bash -n .../pipeline/live-proof/H.sh`: exit 0.
- `nice -n 10 /usr/bin/python3 .../rules-13-56-1021s-evidence/replay.py`: 29 assertions pass against shipped shell-expanded predicates, captured 05:16/05:20/10:02 status shapes (updates 367052613, 367052615, 367052690), mutations and injected clock/status. Honest null is UNTESTED, not fabricated PASS; missing age, missing raw evidence, wrong subject/model, fabricated age, lost real age and mismatched timestamps FAIL. Changed/unavailable models still fail Rule 56. The actual shared wait_for loop observes success at 60/120 fake seconds and refuses a never-ready map at 120 seconds, without real load.
- Product layer below: tests/preview/doorway-map.ts:79-85 explicitly emits null when state is not verified or verifiedAt is null, including failed routes retaining a historical verifiedAt. No product fix is indicated. No model-facing prompt, model-output parser or accept/escalate/refuse path changed; observer #106's unrelated summary/Jev/reply replay requirement does not apply. The actual affected recorded status shapes were replayed.
- Fresh group H running in foreground on room three under preswitch-set-34.lock and the shared H group lock; test-login preflight passed. Room one's queued train gate was respected. No launcher/root mutation or runner restart. Results: rules-13-56-1021s-evidence/H-proofroom3-20261021-175300; exact child PID 42863. Model derives from that room's MS setting (gpt-6-astra), not Justin's runner.

Fresh run changed the diagnosis (17:57): update 840343713 completed five model calls and delivered a reply, but every Codex exchange was marked unavailable/error-frame by subscriptionExchange's Claude-only JSON frame parser. H correctly remained FAIL for Rule 56 after the two-minute wait. This IS a product defect, not a reason to weaken the check. The earlier “no product fix indicated” conclusion is superseded by this new evidence.

Product repair: the registered SubscriptionDoorway now supplies exchangeModels; Claude's existing discovery moves into its adapter, Codex reuses parseCodexEventStream, and the journal's observation passes the selected adapter. No prompts, accept/escalate/refuse decisions, caps, invocation flags or send paths change. Local capacity ceilings still produce no availability observation; timeout/failed/malformed/missing-terminal streams remain unavailable. The real Codex stream has no provider model id, so successful completion establishes configured-route only. H-C53 remains UNTESTED for this genuinely unobservable provider-id proof, never PASS; H-L4a still requires verified/fresh, and changed/unavailable still fail. Rules 30 and 41 additionally apply: adapter-owned harness interpretation and evidence from the real recorded exchange, no fabricated provider identity.

Architecture on product diff: sole finding R105 native macOS self-host conformance certificate no longer matches changed composition bytes. This is the charter's explicit desk-owned byte-bound certificate exception. No declaration changed to hide it.

Branch base was published as requested at 588332d9d0839cd504bee2819e297cd6222a2ef9 before the fresh run exposed the product defect. That base is not an implementation commit. Product changes will be committed and pushed before READY. core.hooksPath is unset; shared hooks directory contains only .sample hooks; no bypass used.

Recorded product replay evidence (doorway-map.test.ts):
- Genuine codex-cli 0.156.1 registered doorway capture, `tests/preview/fixtures/codex-answer-0.156.1.json`, captured 2026-10-21 by codex-tests-1021. Same bytes fail Claude discovery and verify through the Codex adapter as configured-route; no serving model id is invented. Older `codex-recorded-frames.json` successful plain/decision streams verify, failed terminal does not. Exit, timeout, local capacity, malformed stream, missing completion, unregistered item negatives tested.
- Read-only journal-derived shapes in `retrospective-duty-followup-train-1-2026-10-08.json.otherShapes`: summary writer 715672480; uncertain summary 715672483; undecided Jev 715672482; unsure Jev 969389570; reply review 969389923; delivered reply 715672479; empty candidate 715672550. All are payloads, never provider terminal framing, and both adapters refuse to manufacture availability from them. Provenance of the empty case explicitly says candidate in recorded context, not a delivered-empty-bubble claim; no nonexistent delivery is asserted. Real completion evidence is the actual provider stream plus the fresh proof room.

Targeted verification: 151 tests in doorway-map, both subscription adapter suites, doorway-notice-replay and credential-reminders passed (5 files). Full typecheck passed after fixing the JSON import attributes; production build passed. Register regenerated from committed source e1524537f19435434c87e9140edb4b9858c2d411, committed as 56269f34a7fe74c9626443fc3aed31a2c95496f7, and pushed. `npm run register:check` exit 0. `npm run lint` exit 1 solely for the permitted R105 native macOS certificate byte mismatch; standalone register-wiring check exit 0, issues []. No source-pin failure remains. Initial pinned gate ran across the source edit and failed only its now-repaired source pin; the final pushed-head gate is running.

Candidate live proof: fresh root proofroom3-rules-13-56-1021s-20261021-180257; H-candidate-proofroom3-20261021-180258. Existing activation/profile/model/policy validated against both candidate and restore builds BEFORE switching. No activation declaration was edited. One fresh root at the existing 1000-call/reply/turn and 409600-byte desk proof-room bounds, using the existing raise authority. Pair and H locks held. Exact old runner PID 29558 received SIGTERM via the desk's identity-validated helper; candidate foreground H PID 20094 recorded. First reply update 840343715: doorway verified/configured-route, age `14371 ms of doorway-verification-age (preview-subscription/gpt-6-astra)`, Rule 13 all four PASS. Standing was still false at the first snapshot, so the repaired wait actually fired rather than declaring success early.

Candidate run diagnostic: every check completed with 20 PASS / two UNTESTED (provider-id evidence unavailable; no forced trim), but the shell then hit a syntax error at its trailing summary. Cause: I tightened H's unknown-state null negative while the foreground shell was executing its already-parsed if block; the changed byte length invalidated its later read position. Final H passes bash -n and 30 replay assertions, but that interrupted harness is not claimed as clean proof. Repeating the full fresh-root group with H held unchanged for the run. First outputs retained with `.first` suffix; no product code changed. This was not exit 137.

Final pushed-head pinned gate: 8 files / 120 tests PASS, exit 0 (ready-gate-final.out; 287.69 s). Every test ran in the foreground with nice -n 10 and --maxWorkers 1. No dependency install or node_modules mutation. No exit 137 occurred.

Side-effect review: the new adapter callback affects only content-free doorway observation; it does not affect model judgments, resource/spend limits, delivery, stop, durable intake or credentials. Claude discovery keeps its existing outcome/modelUsage behavior. Codex uses its existing event parser. Both routes retain failed/unavailable evidence. Machine posture remains local per-room observation, independently recorded for each runner; no replicated-state contract changes. Simplest robust route is this adapter callback, avoiding a second Codex parser or harness-name branches in the client. Independent landing review remains the desk’s gate, not claimed here.

Rollback: restore pipeline/live-proof/H.sh from H.sh.bak-rules-13-56-1021s; revert the product/source-pin commits together through normal git review. The temporary proof-room launcher is restored byte-for-byte by candidate-proof.py; no activation/authority declarations were rewritten.

Required publication evidence (both commits are in origin/rules-13-56-1021s):

`git status --porcelain`:
```text
```
No output: tracked tree clean.

`git show --stat e1524537f19435434c87e9140edb4b9858c2d411`:
```text
commit e1524537f19435434c87e9140edb4b9858c2d411
Author: Echo <echo@sagemindai.io>
Date:   Wed Oct 21 18:01:11 2026 -0700

    Fix doorway discovery through the selected subscription adapter

 src/assembly/production-codex-provider.ts |  7 +++++
 src/assembly/production-provider.ts       | 14 ++++++++++
 tests/preview/doorway-map.test.ts         | 43 ++++++++++++++++++++++++++++++-
 tests/preview/doorway-map.ts              | 13 +++-------
 tests/preview/journal-agent.mjs           |  2 +-
 5 files changed, 68 insertions(+), 11 deletions(-)
```

`git show --stat 56269f34a7fe74c9626443fc3aed31a2c95496f7`:
```text
commit 56269f34a7fe74c9626443fc3aed31a2c95496f7
Author: Echo <echo@sagemindai.io>
Date:   Wed Oct 21 18:02:56 2026 -0700

    Refresh register source pins for doorway discovery repair

 generated/capabilities.json | 4 ++--
 generated/capabilities.md   | 4 ++--
 generated/coverage.md       | 4 ++--
 generated/glossary.md       | 4 ++--
 generated/register.json     | 2 +-
 generated/rules.md          | 4 ++--
 generated/source.json       | 4 ++--
 7 files changed, 13 insertions(+), 13 deletions(-)
```

Final fresh proof (clean execution): `pipeline/live-proof/results/H-proofroom3-20261021-180618` (also retained under the unit evidence directory). Candidate SHA 56269f34a7fe74c9626443fc3aed31a2c95496f7; Codex test login; room-owned model setting gpt-6-astra. Updates 840343717 (capacity) and 840343718 (vault). Result: **20 PASS, 0 FAIL, 2 UNTESTED**, normal summary exit 2 for partial coverage. Rule 13 PASS (4/4); Rule 56 six PASS plus H-C53 UNTESTED; Rule 100 PASS (8/8); Rule 40 forced trimming UNTESTED because no trim occurred. Provider-id evidence remains UNTESTED because the actual Codex stream supplies no provider-reported id; the stronger claim was not relaxed to PASS. Changed and unavailable route negatives still FAIL in replay.

The standing wait actually fired: h-cap was already verified/fresh while standing remained false; after 63,000 ms, standing was true, within the existing 120,000 ms bound. Standing age at final observation was 59,525 ms, below the unchanged 150,000 ms check. Stale-map and lost-secret copy negatives passed. Final H bytes stayed unchanged throughout this clean run. Original room-three launcher restored byte-for-byte and its original root is serving again (verified exact runner PID 84412). No live operator root/bot/chat was touched.

Installed desk deliverable (never staged):
- `/Users/dabombstudio/.instar/agents/echo/.instar/lanes/pipeline/live-proof/H.sh`: sha256 `0bf76ec2ae3980f43afde64140696ef38fb25089e4b2031987623768ce6b1f69`; backup: `/Users/dabombstudio/.instar/agents/echo/.instar/lanes/pipeline/live-proof/H.sh.bak-rules-13-56-1021s`.
- `/Users/dabombstudio/.instar/agents/echo/.instar/lanes/pipeline/live-proof/H.sh.bak-rules-13-56-1021s`: sha256 `4c6b694b475a28382a75000ec51375c6fdcfb5c62f237f4fc60f44a85c1c599d`; backup: `new evidence file / no predecessor`.
- `/Users/dabombstudio/.instar/agents/echo/.instar/lanes/rules-13-56-1021s-evidence/replay.py`: sha256 `34ea20fa01ed064fffde5a50735bfc56b66033056912af56672474afb4eb1ef7`; backup: `new evidence file / no predecessor`.
- `/Users/dabombstudio/.instar/agents/echo/.instar/lanes/rules-13-56-1021s-evidence/run-proof.py`: sha256 `cc22e4d8794631437ccbf1c48b05c7431731d52df4e4f080100909931d9682c5`; backup: `new evidence file / no predecessor`.
- `/Users/dabombstudio/.instar/agents/echo/.instar/lanes/rules-13-56-1021s-evidence/candidate-proof.py`: sha256 `533406d4aabc3cd1d1c0ee11ebfa4411068f6cf0f55ffeebebcd3684f9cbc263`; backup: `new evidence file / no predecessor`.

Full deliverable manifest: `rules-13-56-1021s-evidence/manifest.json`. Verification logs: `replay.out` (30 PASS), `targeted.out` (151 PASS), `doorway-final.out` (9 PASS on final head), `typecheck-final.out` (exit 0), `build.out` (exit 0), `register-final.out` (exit 0), `wiring-final.out` (exit 0, issues []), `ready-gate-final.out` (120 PASS), and `lint-final.out` (the sole permitted R105 finding).

Unrun or desk-owned checks: full suite left to the pipeline as directed. Native macOS self-host conformance re-declaration belongs to the desk: R105 says current composition sha256:9d266e9080b498670084c1801cc4d9ba9e362208438a7ecbd227395a5f0a38c4 differs from its certificate. Architecture/lint therefore exit 1, not 0; this is exactly the charter's second exception, with no other finding left and no declaration edited. Forced trimming and provider-reported Codex model identity are not claimed proven. The archived empty-reply replay is explicitly an empty candidate, not a fabricated delivered empty bubble.

Final `git diff --check origin/main...HEAD`, unstaged and staged checks all exit 0. Final `git status --porcelain` is empty. Both required pushed-commit stats are pasted above. All product and generated changes are in the two pushed commits; the installed desk checker and its evidence are covered by the desk-file hashes and backups above. Work is complete for the desk's landing gate with the expressly permitted certificate exception.

READY 56269f34a7fe74c9626443fc3aed31a2c95496f7


## Desk READY gate follow-up: native certificate

The desk explicitly requested repair of the changed-composition R105 finding on the Studio. Re-running the native contract before re-declaring the exact composition; the prior certificate exception is no longer being used for READY. Rules 105 and 115 require truthful evidence bound to the running composition; Rules 26 and 70 require verification; Rule 101 requires ordinary commits with no hook bypass; Rule 116 favors the existing contract and digest mechanism. No 1.x equivalent exists for these desk checks.

The existing functional native contract passed before changing the declaration (1 selected test, 13.72 s). Its real confined tool launches, installation/probe, durable owner records, stop, refusal and timeout paths all passed. Physical provider IO uses the existing captured-frame fixture; this is the declared native conformance contract, not a new live-login claim. Computed closure is complete (268 files), runtime node-24.14.1@sha256:91d3afb67a7dc211f642f2328f822505ff1c1ad381e98ffdd21b003970deeeda, digest sha256:9d266e9080b498670084c1801cc4d9ba9e362208438a7ecbd227395a5f0a38c4. Evidence: certificate-composition.json and certificate-repair-contract-before.out.

Changed only the native Claude self-host conformance value in src/assembly/harness.declarations.json, retaining its existing contract citation and runtime. Codex certification posture remains unproven. The whole native-harness-contract.test.ts then passed 10/10 (23.07 s), including the exact composition certificate, conversation restart/no duplicate sends, refusal/timeout/over-cap, stop-before-dispatch, and both launch deadline branches. Evidence: certificate-repair-contract-after.out. Architecture checks exited 0 with no findings (certificate-architecture.out). This declaration-only follow-up does not alter prompts, output parsing, acceptance decisions, or any safety floor.

Source commit 46f85ead7e5bb770c998efe087df81e4221d9ca6; generated register commit 7d16e57d4957f7f227803912e38c61c7b64a7692; both pushed to origin/rules-13-56-1021s. Generated register reflects the changed declaration and committed source, using the normal generator. core.hooksPath checked unset; hooks directory checked with only .sample files; ordinary commits used, no bypass. Final pushed-head READY checks running.

Final pushed-head machine gates: `nice -n 10 npm run lint` exit 0, architecture passed and register wiring issues []; `nice -n 10 npm run register:check` exit 0. Logs: certificate-lint-final.out and certificate-register-final.out. `git diff --check origin/main...HEAD`, unstaged and staged checks all exit 0. No R105 exception remains.

`git status --porcelain` (empty):
```text
```

`git show --stat` for both pushed repair commits:
```text
commit 46f85ead7e5bb770c998efe087df81e4221d9ca6
Author: Echo <echo@sagemindai.io>
Date:   Wed Oct 21 18:13:38 2026 -0700

    Recertify native self-host composition after Studio contract run

 src/assembly/harness.declarations.json | 2 +-
 1 file changed, 1 insertion(+), 1 deletion(-)

commit 7d16e57d4957f7f227803912e38c61c7b64a7692
Author: Echo <echo@sagemindai.io>
Date:   Wed Oct 21 18:13:46 2026 -0700

    Refresh register for recertified native composition

 generated/capabilities.json | 4 ++--
 generated/capabilities.md   | 6 +++---
 generated/coverage.md       | 4 ++--
 generated/glossary.md       | 4 ++--
 generated/register.json     | 2 +-
 generated/rules.md          | 4 ++--
 generated/source.json       | 4 ++--
 7 files changed, 14 insertions(+), 14 deletions(-)
```

Final pushed-head pinned-text gate: `nice -n 10 npx vitest run --maxWorkers 1 $(/usr/bin/python3 /Users/dabombstudio/.instar/agents/echo/.instar/lanes/pipeline/ready-gate-tests.py)` exited 0: 8 files, 120 tests PASS, 287.35 s. Evidence: certificate-ready-gate-final.out. All tests ran in the foreground. No dependency mutation, load burner, live login interaction, or exit 137 occurred. Final status remains empty; all three diff whitespace checks re-run after tests and passed.

The desk-reported R105 cause is repaired at its source: actual Studio contract evidence now certifies the exact current composition, and the generated register carries the updated declaration. Native conformance (10 tests), architecture, lint, register check and pinned gate all pass; no certificate exception is claimed. Full suite remains assigned to the pipeline as directed.

READY 7d16e57d4957f7f227803912e38c61c7b64a7692

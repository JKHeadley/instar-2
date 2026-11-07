# Change review — train-177 existing-owner repair continuation

Subject base: 740d034b131b55796639e12c3daaad3ac0aef70d
Review state: open
Reviewed content: none
Outcome: Finish the canonical train-177 test repair by importing the exact register and proof-launcher fixes already owned by 99db9a0967837d7d10527c457263b50383464952 and 480f815741b5e670b92bec8b7b606ebd91e64df4. Preserve original reaper source and previous repair evidence.
Affected rules: 26, 34, 37, 49, 55, 60, 61, 69, 70, 74, 95, 101, 102, 107, 111, 112, 113, 116.
Affected floors: secrets — custody unchanged; spend cap — no provider calls; stop — bounded child waits retained; no duplicate sends — all ownership and assertions retained; durable intake — no runtime changes.
Operator questions: none
Suggested tier: ordinary
Declared tier: ordinary
Tier rationale: Exact existing-owner test orchestration repairs and derived pins, no product source, prompt, authority, account or model metadata change.
Side effects: Register defaults, bridge and malformed matrices become independent bounded groups; asynchronous children service worker RPC. Proof status requires successful child completion before parsing. Every existing assertion and enclosing case deadline remains in the owner files. No quarantine, synthetic pass or production behavior change.
Undo and recovery: Revert this repair and regenerate affected references from committed source. Preserve all earlier failed logs and the open unattributed RPC defect. No installed state changes.
Multi-machine posture: Disposable machine-local tests on WSL. Native, installed, live, independent and full-gate qualification belongs to Studio. Git carries source; report is copied by the desk, never written remotely by this builder.
Layer below: Inspected tests/e2e/async-child.ts spawn/close and SIGTERM timeout, tests/preview/journal-cutover-harness.mjs bounded runLive/statusOf, both owning diffs and review records, committed-source build-register replay, owner-manifest rehash and chain repin scripts.
Bug class: integration
Bug evidence: reproducer=tests/e2e/register.test.ts; other=tests/preview/proofs-launcher.test.ts; other=docs/defects/vitest-worker-rpc-timeouts.md
Hook bypass: none
Convergence: none
Prompt review: No model prompt, parser or accept/escalate/refuse logic changes. No new model-shape replay claim.

1.x comparison: Searched actual JKHeadley/instar origin/main 13e4f75507520aa6c43c0aec006b7ec2fbd28332 src/core/WorktreeManager.ts, src/core/SessionLivenessOracle.ts and docs/specs/test-runner-concurrency-bound.md, with history 5143e436f, 618560b3e, 269da957b. WorktreeManager uses promisified execFile; SessionLivenessOracle preserves indeterminate on bounded asynchronous timeout. Fit is asynchronous bounded observation and host-scope concurrency, not the unrelated 1.x worktree/oracle/semaphore implementation. Reuse 2.0 runChild and cutoverHarness through the exact named owner files. Read ONEX-LESSONS sections 2 and 6. Inherit owners' comparison at 9b5790e8105f94c8ad6f13243d063e7c7efd23b6 and canonical train's reaper comparison; no new carryover implementation.

Decision: T177-2318-OWNERS | Both files exactly matched their named owner parents; import each complete owner file without competing patches or unrelated sibling changes. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-177-repair-2318-PROGRESS.md
Decision: T177-2318-EVIDENCE | Reuse completed 27 round7 and 32 launcher/canary same-source results once; preserve later desk red. Run finite selected affected cases one at a time with unchanged deadlines; record WSL physical failures without inventing product fixes. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-177-repair-2318-PROGRESS.md
Decision: T177-2318-PINS | Use only downloaded desk rehash/repin tools and exact committed-source register replay when needed. No model/profile/account/grant/expiry or native certificate changes. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-177-repair-2318-PROGRESS.md

Publication and coverage: source 7824ca7b0c25689ce94b1d86383203a7e9c2c6e3 replayed to generation sha256:a3af59d4e0518dfe6bbc18d437a6ebedaee06ddbbdc3cc65bef62b72cbe2e7f8, 298 entries / 121 rules; generated outputs committed in 2ef3ae17b7698f7f4d05ccebdcf5462f3962c77f. This review covers that derived-output commit as well as the exact owner imports and the 15 regenerated part-nine references. First history check found the output commit uncovered because the review last changed before it; this update closes that local Rule 74 finding while retaining the failed run. Other findings are absent Studio-local reports/evidence, not fabricated local passes.

Validation: build/typecheck, architecture/wiring and register check passed. The selected real register CLI replay/edited-output refusal case passed in 106.088 seconds within its unchanged 120-second case bound; the selected startup/due-proof physical launcher case passed in 18.227 seconds. Remaining case selections and native/installed/live/full/independent evidence stay with the Studio gate under the specific task. No test repeats after this review-only change.

1.x refreshed-main corroboration: retry after the initial network timeout fetched actual main 4287704c4585c7d27e691c147fd93f0da3f55779. The three researched source/spec paths are byte-identical to 13e4f75507520aa6c43c0aec006b7ec2fbd28332; their inspected histories and design comparison remain unchanged.

## Closing block

simplestRobustRoute: This is the simplest robust route: finish the existing repair with whole owning fixes and canonical derived artifacts, without runtime machinery. Start guard is clean ordinary fast-forward to the published head and exact parent comparison; end guards are bounded targeted evidence, cheap checks and preserved pushed head. The 45-minute ceiling and Studio-owned qualification remain explicit; no autonomous product completion is claimed.
80/20: Reuse reviewed ownership, avoid repeated same-source runs, retain every red result, and submit precise remaining limits to the independent desk.
VERDICT: author submission; this record asserts no independent verdict.

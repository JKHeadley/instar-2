# Change review — Place observed host-bound tests on the Studio

Subject base: c1e290e1f264470bdd081778ce16ef7e693118f0
Review state: open
Reviewed content: none
Outcome: Preserve the pinned train-5b exclusion list and add test files whose observed Mama failures depend on the physical host launcher, harness identity or filesystem permissions. Keep portable timeout and split-environment failures visible outside the list. The interrupted pinned half-run reported 25 failing files: 21 host-bound additions, three portable timeout files and one deterministic split-environment failure. It exited 143 before a complete report. The list retains the original 17 entries and adds those 21 observed host-bound files only. This main-based list is an integration input, not a claim that split gating is ready.
Affected rules: 26 and 70 bind placement to observed failures; 34 and 37 retain every test in one half; 49 and 74 record scope and recovery; 101 forbids hook bypass; 102 reports decisions; 107 preserves red evidence; 111 checks the list consumer and driver; 113 declares placement; 116 reuses the existing split mechanism.
Affected floors: secrets — no credential or disclosure changes; spend cap — no provider policy changes; stop — no cancellation changes; no duplicate sends — no dispatch changes; durable intake — no storage changes. Tests move between hosts, never out of the intended combined suite.
Operator questions: none
Suggested tier: ordinary
Declared tier: ordinary
Tier rationale: A test-placement data file and review record only; no runtime source, prompt, output parser or acceptance logic changes.
Side effects: More files run on the Studio. Current main lacks the train's split consumer and nine original listed test paths. The pinned train's strict detector/list equality check also needs reconciliation before integration; this list alone does not enable or validate split gating. The current Studio driver requests test:all under a split, which the pinned checker explicitly refuses.
Undo and recovery: Revert this list addition, or restore the pinned 17-entry list when integrating with the train. Preserve the raw validation log and classifications; never label a partial suite as a full pass.
Multi-machine posture: Shared placement data assigns physical host tests to the Studio and leaves portable tests on Mama. Combined coverage still requires both halves on the same revision and the existing merged-report checks. No agent runtime state or ownership changes.
Layer below: Read main's purpose and rule book in full; inspected pinned train f34d2b940c1da2678bfe7b32ce70ca5f58fd0784, vitest.config.ts, tests/platform/macos-only.mjs, its equality test, scripts/check-change-review.mjs, scripts/limit-exec.sh and the read-only Studio spawn_mama_gate implementation. Confirmed WSL /bin/sh rejects ulimit -u and the host umask is 0002.
Bug class: none
Bug evidence: none
Hook bypass: none
Convergence: none
Decision: split-supported-half | Record the exact requested test:all exit 2, then use the checker's explicitly supported test:gate half path for classification; never claim a full gate passed. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/split-validate-1011-PROGRESS.md
Decision: split-host-placement | Add only observed host-dependent files with per-file reasons; leave portable timeouts and inherited split-flag failures outside the list. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/split-validate-1011-PROGRESS.md
Decision: split-main-integration | Keep the requested main-based, list-only scope instead of importing the train's unmerged runtime history. Declare the missing consumer and strict detector reconciliation as integration blockers. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/split-validate-1011-PROGRESS.md

## Closing block

simplestRobustRoute: Reuse the existing one-path-per-line split list with evidence-based comments. No new runner or gate is needed. The exact-head test is the start guard, both halves and their merge are the completion guard, and the existing worker limits and task time ceiling remain the resource guards. This submission makes no unattended completion or split-readiness claim.
80/20: Submit the narrow placement data and honest red evidence for desk integration; do not hide portable failures or widen this task into repairs of the full runner and unmerged train.
VERDICT: author submission; independent review and split integration remain required

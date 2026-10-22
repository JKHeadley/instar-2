# Change review — Preserve healthy primary launch with an unavailable secondary

Subject base: 2a62d53503ae1b253010ae60a5fdf205be14c2a9
Review state: open
Reviewed content: none
Outcome: The installed CLI hands off a valid inventory with unavailable secondary records to the existing runner, allowing a verified primary to start.
Affected rules: 4, 5, 15, 26, 37, 42, 49, 70, 74, 77, 95, 101, 102, 111, 113, 116; purpose constraints 2 and 3 and checkpoint-over-ability-reduction principle.
Affected floors: secrets — fixed diagnostics and existing sealed authority/custody checks remain; spend cap — same finite configuration and runner limits; stop — same runner and durable stop; no duplicate sends — same ownership and effect admission; durable intake — same journal and intake, with no new writes.
Operator questions: none
Suggested tier: ordinary
Declared tier: ordinary
Tier rationale: Narrow repair of redundant preflight validation; no new admission, runtime or installation format.
Side effects: Missing, unreadable or malformed secondary record contents now reach existing per-member preparation instead of blocking the whole launch. Every inventory path still requires valid absolute syntax; primary file readability checks remain.
Undo and recovery: Revert this repair commit to restore preflight behavior; no installation state or membership migration is required. Existing preparation excludes unavailable members and retains identity/history for recovery.
Multi-machine posture: Machine-local launcher and record paths, deliberately; existing runner owns peer durability, conversation ownership and send uniqueness. No peer dependency or shared state is added.
Layer below: Read prepareInstalledHarnessLogins, installedHarnessLaunch and verifyPreparedHarnessLogin. Reused the sealed synthetic-grant fixture with real activation and authority validators to prove secondary exclusion and primary source/authority verification; no runner code changes.
Bug class: integration
Bug evidence: reproducer=tests/preview/installed-harness-logins.test.ts
Hook bypass: none
Convergence: none
Decision: update-b-repair-member-admission | Validate path syntax for every member but read record contents only for the primary; existing per-member admission handles secondary availability without weakening authority. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/update-b-1021-repair-090503-PROGRESS.md
Decision: update-b-repair-regression | Adapt the reviewer's sealed-grant reproduction into the existing fixture for both secondary profile and authority loss, retaining member history and verifying primary authority. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/update-b-1021-repair-090503-PROGRESS.md

Subject (4 paths): scripts/product-run.mjs, tests/preview/product-run.test.ts, tests/preview/installed-harness-logins.test.ts, docs/product-run.md

## Closing block

simplestRobustRoute: Keep the existing runner's independent per-member admission and remove only the redundant secondary-readability gate. This is the simplest robust route; no fallback, new grant, retry or review protocol is added. Start guards retain valid inventory/configuration and primary records; runtime authority remains enforced for each member. End state is existing bounded runner exit with unchanged caps, stop, ownership and intake. This repair claims tested handoff and admission, not a live exchange or unattended installation completion.
80/20: Seven new regression cases failed on the original adapter; all 59 targeted tests passed after the repair. Coverage includes all five secondary record paths, malformed secondary inventory, missing primary records, sealed primary authority and secondary exclusion/history. No model prompt, output parser or judgment policy changed; recorded model-output replay is not applicable.
VERDICT: author submission; this record asserts no independent verdict — the review desk records its own

# Change review — train-117-p2 run and update composition

Subject base: 588332d9d0839cd504bee2819e297cd6222a2ef9
Review state: open
Reviewed content: none
Outcome: Compose exactly the reviewed installed-agent run command and registration-ordered updater onto the live train-113 base, preserving setup, run and update through the shipped CLI.
Affected rules: 2, 4, 5, 26, 34, 37, 42, 44, 49, 69, 74, 90, 95, 100, 101, 102, 111, 112, 113, 116; purpose constraints 2, 3 and 6.
Affected floors: secrets — existing custody and suppressed diagnostics; spend cap — same runtime limits, no model calls here; stop — same-process runner and durable stop checks; no duplicate sends — unchanged ownership/effect doorway; durable intake — no journal resets or state-format edits.
Operator questions: none
Suggested tier: significant
Declared tier: significant
Tier rationale: Compose two reviewed product commands with one shared CLI conflict; preserve each command's actual runtime and refusal behavior.
Side effects: The CLI accepts update while preserving setup and run. Both TypeScript-consuming paths register the existing loader before importing their entry. Update remains independent of that loader. Regeneration refreshes register provenance only.
Undo and recovery: Revert the composition through review and regenerate the register. Existing update transactions and journals remain intact; never restore backups over live journals or repeat uncertain sends. No live root, runner or login is touched here.
Multi-machine posture: Installation and launch configuration remain deliberately machine-local; the admitted runtime retains cross-machine ownership, replication and send uniqueness. No peer dependency or new authority is introduced.
Layer below: Read the full constitution matching origin/main, both exact member diffs and complete Studio reports, their 1.x reuse dispositions, existing CLI loader and product-run/update implementations, positive and refusal subprocess tests, and the cint-L37 desk regeneration procedure.
Bug class: none
Bug evidence: none
Hook bypass: none; core.hooksPath unset and common hooks directory inspected: samples only. Ordinary merges and commits.
Convergence: none
Decision: train-117-p2-merge-b | Ordinary merge of exactly 09faf07f3c559cd3912eff143e9427a26fe831e4, retaining secondary-login admission repair. Evidence: /Users/dabombstudio/.instar/agents/echo/.instar/lanes/update-b-1021-PROGRESS.md, downloaded read-only. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-117-p2-PROGRESS.md
Decision: train-117-p2-merge-a | Ordinary merge of exactly c7a976e4d8dd0e286c9f2659916e69d8e24bd417, retaining unique migration ids in registration order. Evidence: /Users/dabombstudio/.instar/agents/echo/.instar/lanes/update-a-1x-1021-PROGRESS.md, downloaded read-only. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-117-p2-PROGRESS.md
Decision: train-117-p2-A | Resolve bin/instar2.mjs by keeping update dispatch, the setup/run validation branch, and loader registration before each TypeScript entry. Existing real CLI tests exercise all three paths, including absent-custody refusal. No member behavior is omitted. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-117-p2-PROGRESS.md
Decision: train-117-p2-B | Create train-117-p2 directly at exact live base 588332d9d0839cd504bee2819e297cd6222a2ef9, following the remote-builder branch override; preserve existing origin/train-117 without moving or replacing it. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-117-p2-PROGRESS.md
Decision: train-117-p2-D | Run targeted offline tests and host checks on the Laptop; classify unavailable Studio report/proof paths explicitly for the desk's check rather than rewriting historical evidence. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-117-p2-PROGRESS.md
Decision: train-117-p2-desk | Use the downloaded repin/build/rehash/register replay chain; preserve the fixed context guard and native declarations. No generated output is hand-merged. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-117-p2-PROGRESS.md
Verification: Member tests and every direct importer, required journal files, production-provider-subscription, default-context-floor, register tests, pinned READY tests, typecheck, architecture, lint, register and change-review checks. Exact results and host restrictions are in the progress report.
simplestRobustRoute: This is the simplest robust route: two ordinary merges, one CLI dispatch conflict resolved to retain both behaviors, and existing register generation. No new machinery. Exact record/schema and admission checks are start guards; successful existing runner exit or durable update completion is the end guard; all five named floors remain held by the existing runtime. No unattended live-update or live-conversation acceptance is claimed.
80/20: Existing CLI integration tests cover the overlap and loader requirement; no redundant test framework or full-suite run. One worker and foreground bounded chunks, with the desk responsible for combined live acceptance.
VERDICT: author submission for desk gate; no independent convergence claimed

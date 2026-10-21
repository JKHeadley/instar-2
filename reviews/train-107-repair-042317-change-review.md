# Change review — train-107 deferral delivery replay

Subject base: 531916b450580d17fe073820b3a263d62ac3db33
Review state: open
Reviewed content: none
Outcome: Repair both supplied deferral replay failures by asserting the displayed report while preserving exact retained report bytes.
Affected rules: 26, 36, 37, 49, 70, 74, 101, 102, 111, 112, 113, 116
Affected floors: Secrets, spend cap, stop, no duplicate sends and durable intake remain enforced by unchanged runtime. The replay still checks no unsolicited send and no resend after reopening.
Operator questions: none
Suggested tier: ordinary
Declared tier: ordinary
Tier rationale: One test consumer correction, no product, prompt, parser or policy change.
Side effects: Delivery expectations recognize bullet display transformation; stronger retained-byte assertions run before delivery and after restart. Capture bytes remain unchanged.
Undo and recovery: Revert this test-only commit; no product state or migration involved.
Multi-machine posture: Shared test code only; no new state or ownership changes. Existing restart and duplicate-send checks remain.
Layer below: Full purpose and rules, identical to origin/main; recorded deferral fixture, obligation report retention, Telegram display formatter and the existing rendered replay consumer repairs.
Bug class: none
Bug evidence: none
Hook bypass: none; core.hooksPath unset and common hooks directory contains only samples, inspected on this host.
Convergence: none
Prompt review: No model-facing change. Replay existing recorded answers, summaries and work outputs for updates 46040200 and 46040201, including old continue and completed report outcomes.
Decision: train-107-repair-042317-display | Assert full displayed report with only line-leading list markers changed, independently of the production formatter; also assert byte-exact retained report before delivery and after restart. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-107-repair-042317-PROGRESS.md
Verification: Before repair, supplied two failures reproduced with five passes. After repair, all seven tests pass. Typecheck and final cheap-gate results are recorded in the local report for desk copying.
simplestRobustRoute: This is the simplest robust route: repair the stale delivery expectation in the existing replay and strengthen retained-byte coverage, without runtime machinery, fixture edits or weakened send boundaries. No unattended live completion claim.
80/20: Only the affected replay, required pinned tests and cheap checks; full suite remains the Studio pipeline's responsibility.
VERDICT: author submission for desk gate, not independent convergence or live acceptance

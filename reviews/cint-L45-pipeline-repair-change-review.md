# Change review — cint-L45 repair: the three new §5 session Rules name their Part Fifteen negative fixtures

Subject base: f1a13fde8f55b7284947e473ad8a915c425e7ca2
Review state: open
Reviewed content: none
Outcome: Plan row #443, cint-L45 studio full run: one failure, tests/scheduled/governance.test.ts P15-NF-02, which requires every governed Rule in Part Fifteen to name at least one P15-NF fixture in its first paragraph. The w4-sessiondriver merge added three §5 Rules in docs/19-scheduled-work/05-execution-gates-and-supervision.md that named only test files. Each now names the existing fixture whose contract it carries: the delegated-session grant Rule names P15-NF-05 (a grant, stop, role or ownership change between tick and launch cannot launch on cached approval; the Rule re-checks the grant before every step and stops the child on change); the full-tool-set Rule names P15-NF-12 (no undeclared tool, secret, provider or filesystem power; every tool call is decided at the admission hook); the spend-bound Rule names P15-NF-30 (an absent reservation or exceeded cap cannot proceed; the step reserves its whole call liability before the child exists). No fixture is added or changed; the governance test passes 2/2. docs/19-scheduled-work.changelog.json gains revision 10 recording the change (Rule 90), and the markdown changelog is re-rendered from it.
Affected rules: 74 (this record), 90 and 91 (the governed part's changelog revision, rendered), 37 (fixed at source, the doc mapping, no quarantine), 116 (three citations, no new machinery)
Affected floors: secrets — unchanged; spend cap — unchanged; stop — unchanged; no duplicate sends — unchanged; durable intake — unchanged
Operator questions: none
Suggested tier: ordinary
Declared tier: ordinary
Tier rationale: documentation-only mapping of existing Rules to existing negative fixtures; no code or prompt change.
Side effects: none
Undo and recovery: revert the repair commit.
Multi-machine posture: unchanged.
Layer below: the governance test reads the first paragraph of each Rule block for P15-NF ids and checks each against the fixture table in 09-negative-contract-fixtures.md.
Bug class: none
Bug evidence: none
Hook bypass: none (plain commits; core.hooksPath is unset)
Convergence: none
Decision: cint-L45-repair-p15-map | cite the existing fixture whose contract each new Rule carries rather than add fixtures, because the fixture table is pinned at 52 and each chosen fixture already states the refused case | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/cint-L45-PROGRESS.md

Subject (3 paths): docs/19-scheduled-work.changelog.json, docs/19-scheduled-work.changelog.md, docs/19-scheduled-work/05-execution-gates-and-supervision.md

## Closing block

simplestRobustRoute: three fixture citations in the Rules' check lists.
80/20: 0 must-fix, 0 notes.
VERDICT: author submission; the independent verdict is recorded as a pass

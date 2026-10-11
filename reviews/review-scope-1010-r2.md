# Change review — Keep newly caused review failures blocking

Subject base: d1982eb3cae948bc4fea0b54d1b2e48c418ff675
Review state: open
Reviewed content: none
Outcome: A change that moves an untouched frozen subject fails Rule 109; only validation errors present at both the change base and HEAD count as inherited debt.
Affected rules: 12, 27, 37, 49, 70, 74, 90, 95, 101, 102, 109, 111, 113, 116
Affected floors: secrets — unchanged; spend cap — unchanged; stop — unchanged; no duplicate sends — unchanged; durable intake — unchanged
Operator questions: none
Suggested tier: significant
Declared tier: significant
Tier rationale: Repairs shared check and landing preflight integrity using real Git CLI regressions.
Side effects: Newly introduced prompt findings on untouched records also block. Untouched landed records receive the same comparison. Historical record context stays fixed; only the candidate subject digest and prompt scan vary. Coverage and landing evidence remain enforced.
Undo and recovery: Revert this repair commit; Git history and review evidence remain intact, but that restores the known frozen-subject bypass.
Multi-machine posture: Machine-local Git graph and fetched refs, deliberately; the existing CHANGE_REVIEW_BASE override fixes the scope across clones. No new durable state.
Layer below: Git own-commit reachability, validateRecord, digestAt, and promptScan; Astra's actual remote-boundary frozen-subject reproduction establishes the failure.
Bug class: integration
Bug evidence: reproducer=tests/register/change-review-git.test.ts
Hook bypass: none
Convergence: none
Decision: review-scope-1010-r2-D1 | Compare untouched records with the newest ancestor outside own commits using validateRecord twice; one shared base scan preserves linear record work and detects new failures without inventing a second validator. Include landed records because freezing remains binding after landing. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/review-scope-1010-r3-PROGRESS.md

Subject (2 paths): scripts/check-change-review.mjs, tests/register/change-review-git.test.ts

## Closing block

simplestRobustRoute: Reuse the existing validator at the base and candidate with the same historical record context, then classify identical errors as debt and new errors as blocking. This is the requested simplest robust route; it prevents frozen-subject and newly induced prompt failures from being hidden, adds no persistent state or separate gate, and preserves coverage and exact-tree landing guards.
80/20: Real Git CLI regressions reproduce Astra MF1, its explicit-reopen positive neighbor, inherited prompt debt, and newly induced prompt findings; the existing 23 cases remain the regression bar. MF2 coverage is supplied by PR #155, which the desk merges first.
VERDICT: author submission; the independent verdict is recorded as a pass

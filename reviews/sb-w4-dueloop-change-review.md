# Change review — sb-w4-dueloop: cint-L50 plus w4-dueloop

Subject base: 57e12273a84e0141cb4da68ca0561ff815b32cf2
Review state: open
Reviewed content: none
Outcome: Plan row #542 (small build; plan row #548 / observer #179 for the unit). sb-w4-dueloop is origin/cint-L50 57e12273 plus origin/w4-dueloop 3fe354ba, one ordinary merge. w4-dueloop was built on 57e12273, so the merge fast-forwarded with no conflict, and the branch head before this record equals the unit's reported head 3fe354ba. The unit makes due obligation work run on its own schedule whatever the Telegram connection is doing: the poll backoff offers the cycle's work job at most once a second, a sustained unreachable connection (including a 5xx or 429 answer) keeps the poll breaker open inside the run at the capped 30 s trial instead of ending it, and the cycle's due step runs even when its drain failed. Delivery stays reply-only: a finished result waits durably in the journal and rides the first reply after the connection returns, exactly once.
Affected rules: as in the carried records (reviews/w4-dueloop-change-review.md and reviews/w4-dueloop-repair-change-review.md, and reviews/cint-L50-change-review.md with every record it carries). Here: 101 (plain commits and an ordinary merge, no bypass), 102 (decisions below), 116 (closing block).
Affected floors: secrets — unchanged. Spend cap — no model call added; the due step keeps the existing call allowance and capacity fence. Always-sent bytes on the default root, measured on this tree at the floor: answerTotal 22,887, unchanged from cint-L50; PREVIEW_FIXED_PROMPT_BYTES stays 22,959 (default-context-floor 5/5). Stop — unchanged; the work job is not offered after a stop. No duplicate sends — no send path changed; a result settles on its carrying reply's receipt. Durable intake — unchanged; the cursor moves only on a successful poll.
Operator questions: none
Suggested tier: critical
Declared tier: critical
Tier rationale: the combine takes the highest carried tier (w4-dueloop and cint-L50 are critical).
Side effects: as recorded in the carried w4-dueloop records (new exports waitWorking, WORK_TICK_MS, pollEndsRun, pollBackoffMs; sentinelCycle awaits `after` before rethrowing a drain failure; launch option --telegram-cut-file). Integration-specific: none; no file conflicted.
Undo and recovery: reset the branch to 57e12273 (the merge was a fast-forward), or revert this record commit and the w4-dueloop commits. Each carried record names its own rollback posture.
Multi-machine posture: machine-local preview runner, as cint-L50; nothing here is replicated.
Layer below: reviews/cint-L50-change-review.md, carried unchanged with every record it carries. The carried unit records are byte for byte as on their branch, and their Decision reports cite a Studio lane report: reviews/w4-dueloop-change-review.md (7 Decision lines) and reviews/w4-dueloop-repair-change-review.md (2) cite /Users/dabombstudio/.instar/agents/echo/.instar/lanes/w4-dueloop-PROGRESS.md.
Bug class: none
Bug evidence: none
Hook bypass: none (plain commits and an ordinary merge; core.hooksPath is unset). The carried records each record their own.
Convergence: none
Decision: sb-w4-dueloop-merge | merged w4-dueloop 3fe354ba onto cint-L50 57e12273 as one ordinary merge, which fast-forwarded because the unit was built on that head; no conflict to resolve, and the unit's generated/ files are kept as committed because the desk chain moved nothing | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/sb-w4-dueloop-PROGRESS.md
Decision: sb-w4-dueloop-desk | desk chain on the merged tree: repin 0 (inventory unchanged, check-assembly-contracts digest unchanged), tsc 0, rehash 0 pins in every owner manifest; build-register --check is true, so no replay commit was needed | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/sb-w4-dueloop-PROGRESS.md
Prompt review: no model-facing change: no prompt, packet field, parser or accept/escalate/refuse rule changed by the unit or by this build (as recorded in reviews/w4-dueloop-change-review.md). Always-sent answer bytes on a default root stay 22,887 (guard 22,959).

## Closing block

simplestRobustRoute: merge the reviewed branch as it is; it fast-forwarded, the desk chain changed nothing, and no code was authored (Rule 116).
80/20: 0 must-fixes, 0 notes; targeted tests only (the unit's three changed or new test files, the direct importers of its changed runner modules, default-context-floor and tests/e2e/register.test.ts; foreground, 0 failed).
VERDICT: author submission; the independent verdict is recorded as a pass

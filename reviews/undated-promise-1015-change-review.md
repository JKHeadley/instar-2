# Change review — read-only abandoned worktree evidence

Subject base: a1b59d03faad205e33fc33dc6915825abfecb635
Review state: open
Reviewed content: none
Outcome: Add the read-only worktree census and conservative evidence classifier. This partial implementation does not open owned reconciliation work or claim autonomous recovery. Complete fresh process and worktree observations, resolved ownership and full activity coverage are required for a finding. Missing evidence keeps work untouched.
Affected rules: 9, 26, 36, 49, 60, 63, 74, 101, 102, 113, 116
Affected floors: secrets — reads only git metadata and status; spend cap — no model calls; stop — no process control; no duplicate sends — no send path; durable intake — no intake changes
Operator questions: none
Suggested tier: significant
Declared tier: significant
Tier rationale: read-only observation supporting recovery, with no actuation authority
Side effects: bounded read-only git queries; no optional index locks; unknown observations produce no findings
Undo and recovery: revert this commit; no new durable store or runtime migration
Multi-machine posture: machine-local observations must name the same machine; no peer observation grants local ownership
Layer below: scripts/process-inventory.mjs and src/assembly/process-inventory.ts complete/partial/failed inventory contracts; git worktree porcelain NUL framing captured from the actual Laptop repository
Bug class: none
Bug evidence: none
Hook bypass: none
Convergence: none
Prompt review: no prompt text changed
Decision: undated-promise-1015-observation | Add only read-only evidence collection and classification in this commit; missing ownership or activity remains unknown, never inferred from old timestamps | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/undated-promise-1015-PROGRESS.md

Subject (7 paths): reviews/undated-promise-1015-change-review.md, scripts/worktree-inventory.mjs, src/assembly/README.md, src/assembly/worktree-inventory.ts, tests/assembly/fixtures/worktree-list-2026-10-15.bin, tests/assembly/fixtures/worktree-list-2026-10-15.md, tests/assembly/worktree-inventory.test.ts

## Closing block

simplestRobustRoute: Extend the existing process observation with a bounded read-only git census and pure evidence check, leaving durable reconciliation to the existing work owner. No new store, watcher, model call or git mutation. Enumeration is checked again to detect a checkout/head change during collection. Start guards require complete fresh evidence and quiet activity coverage; there is no autonomous completion claim.
80/20: targeted positive and negative observation tests pass; reconciliation consumer and unattended recovery acceptance remain unfinished and are not represented as passing.
VERDICT: author submission; this record asserts no independent verdict — the review desk records its own

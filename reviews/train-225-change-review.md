# Change review — train-225 (duework-stuck-1108 onto live train-221)

Subject base: 1e5d9df64e18ec60041a21fb73c382d3769203b4
Review state: open
Reviewed content: none
Outcome: Land the reviewed duework-stuck-1108 head 28ebcee15273df9d78d9369dd733fe45c4147170 (origin/fix/duework-stuck-1108: loopHealth's inhibition now names every cause holding due work — a held oldest message and the model-call capacity shed, joined by "; ", with the shed reason carrying its measured count "N of M calls used" — instead of letting the held message mask the shed; display only, the shed and the spend cap are unchanged) on the live build 1e5d9df6, and replay the register at the merged head. 1.x comparison inherited from the member: JKHeadley/instar 1.x src/monitoring/QuotaTracker.ts shouldSpawnSession (base 5b36623a9) names every shed refusal with its measured percentage; the member reuses that behaviour of naming the shed reason with its number. Mismatch noted by the member and not changed: 1.x sheds on a rolling account window, 2.0 on a lifetime trial allowance. Rule 119 counterpart: none; the member changes a 2.0 status string and its test, no obligation in either book.
Affected rules: 13, 37, 46, 64, 66, 68, 69, 74, 90, 92, 101, 102, 111, 113, 116
Affected floors: secrets — no credential path touched; spend cap — no model call added and the shed threshold is unchanged; stop — unchanged, still the first inhibition; no duplicate sends — the train sends nothing and loopHealth is a read; durable intake — no row kind or field added.
Operator questions: none. The member's two design questions (lifetime vs rolling allowance for shedding, the 75% threshold) were left to the operator by the member and are not decided or changed here.
Suggested tier: critical
Declared tier: ordinary
Tier rationale: Carried from the member (ordinary): a display-only change to one status string in tests/preview/obligations.ts plus its test and a mechanically derived pin. The train itself adds only an ordinary merge, base-side generated/ files at the merge and a mechanical register replay; the desk's exact-head full gate, independent review and live proof still follow this push.
Side effects: generated/ now names commit 9b8e59057fd137f93d3b6c34d8d02f8fa73d4176 (generation sha256:ae98bf2449205796f969c0187fbb93b5da387d430baefbe3a857298d23e5c64e, 307 entries, 122 rules). Otherwise exactly what the member's record declares: tests/preview/obligations.ts, tests/preview/journal-obligations.test.ts, the PREVIEW-OWNED-OBLIGATIONS pin in register-source/owner-references/preview.json, and its review record. Always-sent bytes +0 (default-context-floor unchanged).
Undo and recovery: Reset train-225 to 1e5d9df64e18ec60041a21fb73c382d3769203b4; the merge commit, the replay commit and this record sit on top of it, and nothing outside the repository is written.
Multi-machine posture: Machine-local, deliberately, as the member declares: loopHealth reads the local journal view only; no shared state is added or changed.
Layer below: Read docs/00-the-purpose.md and docs/01-the-rules.md in full on the merged tree, the member report duework-stuck-1108 (all sections, including its two repair sections) and the cint-L37 desk chain in full through the Studio API (both sha256 verified against the brief), the member's change-review record reviews/duework-stuck-1108-change-review.md, and confirmed every non-generated member file lands byte-identical to the reviewed head and that the live base did not touch register-source/owner-references/preview.json since the member's base train-219.
Bug class: unit
Bug evidence: reproducer=tests/preview/journal-obligations.test.ts
Hook bypass: none; core.hooksPath is .husky/_ in the clone config, but that directory does not exist in this worktree and the common hooks directory holds only samples, so no hook ran or was bypassed; plain git commit, no stash.
Convergence: none
Prompt review: No model instruction, prompt, parse or accept/refuse rule on model output changes in this train; the member changes a status string read by people and the desk, and its evidence is the real snapshot replay recorded in its report.
Decision: train-225-merge | Ordinary merge of reviewed duework-stuck-1108 head 28ebcee15273df9d78d9369dd733fe45c4147170 (origin/fix/duework-stuck-1108, built on train-219 9baf68079, an ancestor of live) onto live 1e5d9df6; only the seven generated/ files conflicted, and every non-generated member file lands byte-identical to the reviewed head; member report /Users/dabombstudio/.instar/agents/echo/.instar/lanes/duework-stuck-1108-PROGRESS.md read in full. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-225-PROGRESS.md
Decision: train-225-A | Preserve the member's behaviour and tests byte for byte; it is the only member and its product files did not overlap any live-base change, so there are no overlapping edits to combine. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-225-PROGRESS.md
Decision: train-225-B | Branch created directly at the exact live base 1e5d9df64e18ec60041a21fb73c382d3769203b4 (origin/main and the member base train-219 already contained); no main merge, no branch movement. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-225-PROGRESS.md
Decision: train-225-C | No product conflict and no omitted member; the generated/ conflicts took the live base's files at the merge commit and were then regenerated by replay, never hand-merged. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-225-PROGRESS.md
Decision: train-225-D | Host-dependent checks in files this train did not change are reported exactly and left to the Studio gate. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-225-PROGRESS.md
Decision: train-225-desk | Ran the desk chain (repin 0, tsc 0, rehash 0) and replayed the register at the merge commit 9b8e5905; build-register --check is true. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-225-PROGRESS.md
Deferral: generated/register.json:1 | not-a-deferral=generated register output replayed mechanically, not prose authored by this train
Verification: Member tests, direct importers of the changed tests/preview/obligations.ts, register, subscription, context-floor and READY-gate pinned tests; architecture, lint, typecheck, register and change-review checks. Exact outcomes, including host-dependent ones, in the desk report.

## Closing block

simplestRobustRoute: This is the simplest robust route: one ordinary merge of the exact reviewed head and the existing regeneration tools. No added machinery. Existing authorization, secrets, spend, stop, durable intake and unique dispatch guards remain. No fresh unattended-completion claim.
80/20: Targeted and explicitly requested checks only; no full suite and no second base worktree.
VERDICT: author submission for desk gate, not independent convergence or live acceptance

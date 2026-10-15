# Change review — Preserve both journal imports across the live merge

Subject base: 83329c80457ab5c981b2139d111327ae71b9a599
Review state: open
Reviewed content: none
Outcome: Merge live 324d4053 into train-31 without losing legacy holding-notice replay or durable-intake relative reminder scheduling.
Affected rules: Rules 26, 34, 36, 37, 42, 49, 70, 74, 90, 101, 102, 111, 112, 113 and 116.
Affected floors: secrets, spend cap, stop, no duplicate sends and durable intake keep the existing journal and effect admission paths. No authority or capability is removed.
Operator questions: none
Suggested tier: critical
Declared tier: ordinary
Tier rationale: The only manual executable merge resolution combines two independent imports. Already recorded live changes and their tests are retained unchanged.
Side effects: Live reminder admission and temporary-directory isolation changes join the candidate; generated publication must follow the combined source. Legacy holding-notice replay remains available. No new mechanism, model instruction or journal schema is introduced by the resolution.
Undo and recovery: Revert the merge and regenerate publication; retain both parents and their evidence. No live journal is rewritten.
Multi-machine posture: Shared code merge only. Relative deadlines retain original durable intake timestamps, while existing ownership and send deduplication remain authoritative. Local tests use isolated fixture journals.
Layer below: Read purpose and rules from origin/main in full; inspected both journal import branches and live reminder changes. The conflict was adjacent independent imports, not incompatible behavior. Existing journal projection, due-turn processing, review notice replay and captured reminder fixtures exercise the consumers.
Bug class: none
Bug evidence: Merge conflict repair; real recorded reminder outputs and historical holding-notice replay are covered by the targeted tests. No new user-facing fix or unattended deployment claim.
Hook bypass: none; core.hooksPath is unset and the common hooks directory contains sample hooks only.
Convergence: none
Prompt review: No prompt change in the manual resolution. Preserve the live parent's captured-output reminder tests, including summary uncertain, Jev undecided/unsure, reply review and empty reply context shapes.
Prompt finding: 849db3a6296a | protocol-literal | Unchanged deterministic empty-memory status wording, not a new model trigger.
Prompt finding: e8708c7fea24 | protocol-literal | Unchanged recall provenance guidance; source labels and unknown-source disclosure are protocol requirements.
Decision: train-31-repair-184103-import-union | Retain LEGACY_HOLDING_REPLY and relativeDelay by combining the independent imports; preserve both parent histories instead of replacing either behavior. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-31-repair-184103-PROGRESS.md
Decision: train-31-repair-184103-publication | Regenerate conflicting register outputs from committed merged sources with the delegated desk scripts; do not hand-edit pins or renew a Studio certificate from WSL. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-31-repair-184103-PROGRESS.md

## Closing block

simplestRobustRoute: This is the simplest robust route: combine two imports and reuse each parent's implementation and regression tests. The named failure is a mechanical merge dropping one required symbol. No additional machinery is justified. Existing stop, cap, intake and send guards remain the start and limit boundaries; replay tests establish the preserved end behavior. No new autonomous-completion claim.
80/20: Step back from prior repair cycles to the actual source conflict. Resolve only the independent imports, replay recorded cases and regenerate existing publication. Studio owns full-run and platform-bound evidence.
VERDICT: author submission; this record asserts no independent verdict — the review desk records its own

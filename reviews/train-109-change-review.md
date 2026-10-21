# Change review — train-109 product run command

Subject base: 52ead9423d978a2061f7fc32e8d53e0befc32960
Review state: open
Reviewed content: none
Outcome: Integrate the exact reviewed product run command and secondary-login availability repair while retaining the live train-108 behavior.
Affected rules: 1, 2, 4, 5, 15, 26, 34, 37, 42, 44, 49, 69, 74, 77, 90, 95, 101, 102, 111, 112, 113, 116
Affected floors: Secrets remain in existing custody with fixed diagnostics; spend cap and finite call limits remain enforced by the same runner; durable stop and same-process signals remain; no duplicate sends through unchanged ownership and effect uniqueness; durable intake remains journal-backed.
Operator questions: none
Suggested tier: critical
Declared tier: critical
Tier rationale: Preserve inherited critical composition tier; the new command enters the existing installed runtime and must retain its admission and refusal boundaries.
Side effects: Product CLI accepts run as well as setup. Missing primary records refuse before launch; unavailable secondary records reach per-member admission without changing inventory identity. Generated register provenance changes through replay only. No installed root is migrated or launched here.
Undo and recovery: Revert the member through review and regenerate the register. Existing roots retain their direct launcher and unchanged records; the adapter writes no installation state.
Multi-machine posture: Launch configuration and custody paths are deliberately machine-local. The existing runtime retains ownership, replication and uniqueness; no peer dependency or new store is introduced.
Layer below: Full constitution; exact member diff and original plus repair report; same-process journal runner entry, installedHarnessLaunch, prepareInstalledHarnessLogins and verifyPreparedHarnessLogin regression evidence. Existing desk generators retain source identity and register shape.
Bug class: none
Bug evidence: none
Hook bypass: none; core.hooksPath unset and inspected common hooks directory contains only samples.
Convergence: none
Prompt review: No prompt, model output parser, or accept/escalate/refuse judgment policy is changed. This composes the reviewed installation-to-argv adapter; no live-model completion claim.
Decision: train-109-merge | Ordinary merge of exact reviewed 09faf07f3c559cd3912eff143e9427a26fe831e4, fast-forward from its recorded live base. Evidence: /Users/dabombstudio/.instar/agents/echo/.instar/lanes/update-b-1021-PROGRESS.md, read including the appended repair report. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-109-PROGRESS.md
Decision: train-109-A | Preserve member and base behavior byte-for-byte; no source overlap or manual resolution is needed. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-109-PROGRESS.md
Decision: train-109-B | Create a separate branch directly at exact live base 52ead9423d978a2061f7fc32e8d53e0befc32960. No main merge or branch move. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-109-PROGRESS.md
Decision: train-109-C | No genuine conflict occurred and no member is left out. Generated files are rebuilt through the existing chain, never hand-merged. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-109-PROGRESS.md
Decision: train-109-D | Apply the specified WSL exception to untouched host-dependent checks and Studio evidence paths; report them separately and leave Studio acceptance to the desk. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-109-PROGRESS.md
Decision: train-109-desk | Reuse downloaded repin/build/rehash/replay chain with the authorized Linux sed adaptation; zero inventory or owner pin updates, replay at the reviewed member head. Keep context guard and native declaration unchanged. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-109-PROGRESS.md
Deferral: generated/register.json:1 | not-a-deferral=Existing declarations replayed by the standard generator; no postponed implementation.
Verification: Foreground member tests and direct importers, journal tests, context floor, register and production subscription tests, typecheck, architecture, change-review, lint and pinned READY selection; precise outcomes in the report.
simplestRobustRoute: This is the simplest robust route: one ordinary merge and existing generators, with no new machinery. Exact bounded installation records are the start guard; the same runner's authority and custody admission is the end guard. Secrets, spend cap, stop, no duplicate sends and durable intake stay enforced. No unattended live-completion claim; the desk owns live cutover.
80/20: Targeted tests and required gate checks only, one worker, bounded foreground chunks. No full suite or load generation.
VERDICT: Author submission for the desk gate, not independent convergence or live acceptance.

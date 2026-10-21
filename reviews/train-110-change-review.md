# Change review — train-110 release updater

Subject base: 52ead9423d978a2061f7fc32e8d53e0befc32960
Review state: open
Reviewed content: none
Outcome: Integrate the exact reviewed release updater and installation-path repair while preserving the live base and regenerating the register through the existing desk chain.
Affected rules: 1, 2, 4, 26, 34, 37, 44, 45, 49, 70, 74, 90, 93, 101, 102, 103, 111, 112, 113, 116
Affected floors: Secrets remain within existing custody and private backups; spend cap unchanged with no model calls; stop unchanged with no restart; no duplicate sends because no outbound operation is added; durable intake retained in backups and migration intent/completion records.
Operator questions: none
Suggested tier: critical
Declared tier: critical
Tier rationale: Preserve the inherited live composition tier while checking release installation, migration recovery and existing-root preservation.
Side effects: Adds the update CLI, release-owned compatibility manifest and local migration state. The existing canonical installation-path checkpoint runs before writes. Generated register provenance changes to the reviewed head. No live root or runner is touched.
Undo and recovery: Revert the integration through review and regenerate the register. Preserve update history and backups; interrupted migrations resume idempotently through the existing updater. Restart and automatic rollback remain outside this unit's scope as documented by the member.
Multi-machine posture: Deliberately machine-local releases, backups and PID lock. No change to conversation ownership, peer replication or durability demands.
Layer below: Full constitution from origin/main; exact member diff; downloaded original and repair progress records; shared agent-path assertion; installed CLI fixture, real npm installation and migration recovery tests; existing desk generators.
Bug class: none
Bug evidence: none
Hook bypass: none; core.hooksPath unset and common hooks directory inspected, samples only.
Convergence: none
Prompt review: No model-facing prompts, model output parsing or semantic decision changes; recorded-model-shape replay is not applicable.
Decision: train-110-merge | Ordinary merge of reviewed ee12b1b02e7f31fe68fda37636b945ef5f831a86, fast-forward without conflicts. Member reports read and downloaded from /Users/dabombstudio/.instar/agents/echo/.instar/lanes/update-a-1021-PROGRESS.md and /Users/dabombstudio/.instar/agents/echo/.instar/lanes/update-a-1021-repair-090948-PROGRESS.md. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-110-PROGRESS.md
Decision: train-110-A | Preserve member and live-base behavior byte for byte; the fast-forward has no overlapping edits to resolve and no changelog conflict. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-110-PROGRESS.md
Decision: train-110-B | Create a separate worktree directly at exact live base 52ead9423d978a2061f7fc32e8d53e0befc32960; no branch move or main merge. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-110-PROGRESS.md
Decision: train-110-D | Apply the remote-host exception to unchanged native macOS and Studio evidence checks; preserve and report failures without changing declarations or guards. Studio owns the full gate and live acceptance. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-110-PROGRESS.md
Decision: train-110-desk | Run the downloaded repin/build/rehash/replay chain with only the specified Linux sed adaptation. No inventory or owner pins changed; regenerate at ee12b1b02e7f31fe68fda37636b945ef5f831a86, retaining the context guard and native conformance declaration. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-110-PROGRESS.md
Deferral: generated/register.json:1 | not-a-deferral=Existing declarations replayed by the standard generator; no postponed implementation.
Verification: Foreground member tests, direct importers, required journal tests, context floor, register lifecycle, subscription provider, typecheck, architecture, lint, register check, change-review and pinned READY selection. Exact results and host limitations are recorded in the progress report.
simplestRobustRoute: This is the simplest robust route: one ordinary merge of the reviewed head and existing generators, with no new machinery. Existing path and compatibility checks guard entry; migration completion guards publication; bounded installation, unique local ownership, secrets, spend cap, stop, no duplicate sends and durable intake remain enforced. No unattended live-agent completion claim.
80/20: Targeted tests and the explicitly requested journal selection in bounded foreground chunks, one worker; no full suite or deliberate load generation.
VERDICT: author submission for the desk gate, not independent convergence or live acceptance

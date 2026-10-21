# Change review — Install releases with resumable root migrations

Subject base: 52ead9423d978a2061f7fc32e8d53e0befc32960
Review state: open
Reviewed content: none
Outcome: The shipped instar2 CLI gains update alongside setup: npm release installation, an adopted version stamp for existing roots, a private data backup, ordered durable migration intent/completion, schema compatibility refusal and atomic current-pointer publication after migrations succeed.
Affected rules: 2 (the command ships); 44 (existing roots have an update path); 45 (release-owned migration list and schema readability cover consumers); 26/34 (real npm, CLI and process-death tests); 74/102 (review and engineering decisions); 113 (explicit local posture); 116 (npm, a short migration list and rename rather than a new package manager). Purpose: durable cause precedes migration effect; historical transactions and backups retain evidence.
Affected floors: secrets — no npm diagnostics forwarded, private backup parent, no credential handling added; spend cap — no model call or cap edit; stop — no process restart or stop-state edit; no duplicate sends — no send or retry of conversation work; durable intake — root data backed up, no journal deletion or reset.
Operator questions: none
Suggested tier: significant
Declared tier: significant
Tier rationale: Introduces installed root state and an explicit operator CLI, with no autonomous restart, model-facing logic or outbound effect.
Side effects: Disk use increases by the installed release and root backup. Migrations can leave partial data changes on failure, while current and the version stamp remain old; each migration is contractually idempotent and resumes from its recorded start. A concurrent updater refuses. Interrupted installation staging and ambiguous locks remain inspectable.
Undo and recovery: Retry the same tag to finish an interrupted migration or publication. Use the recorded prior pointer and backup for supervised recovery on a stopped copy. Do not restore old state over a live journal. No automatic rollback claim: that is update plan step D. Reverting the code removes the command but leaves its data intact.
Multi-machine posture: Machine-local, deliberately. Each machine installs its own release and holds a local process lock; this command never chooses conversation ownership or weakens peer durability.
Layer below: Read the full constitution, docs/14 upgrade lifecycle, current setup CLI, npm install behavior, and the existing judgment-captures unique-owner lock pattern. Verified the filesystem consumer via actual installed packages and symlinks, including process exit during the migration list. No live roots or proof-room harness changes.
Bug class: none
Bug evidence: none
Hook bypass: none
Convergence: none
Decision: update-a-schema | Record schema readability explicitly instead of guessing compatibility from version ordering; a readable downgrade retains the highest written schema. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/update-a-1021-PROGRESS.md
Decision: update-a-resume | Reuse unique local PID ownership and a flushed migration transaction; completed steps skip and started steps replay idempotently. Preserve earlier transactions and backups. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/update-a-1021-PROGRESS.md
Decision: update-a-install | Reuse npm git install with lifecycle scripts disabled, a staged release folder and one atomic relative symlink rename. Restart and automatic rollback remain step D. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/update-a-1021-PROGRESS.md

Subject (6 paths): bin/instar2.mjs, scripts/update-release.mjs, scripts/update.mjs, docs/update.md, tests/preview/update.test.ts, reviews/update-a-1021-change-review.md

## Closing block

simplestRobustRoute: This is the simplest robust route: npm installs, release-owned ordered migrations, a flushed JSON transaction, private copy backup and rename publish the pointer. The transaction prevents lost intent after a crash; the existing unique-owner pattern prevents two updates racing; staging prevents publishing partial npm output; compatibility metadata prevents unreadable downgrade. Start guard: exact tag and readable schema; end guard: migrations completed before current flips; limits: bounded npm subprocess timeout/output and one updater per root. The unattended local-fixture CLI case proves installation, not self-update or live-agent readiness.
80/20: Targeted tests include both sides of each new refusal and the requested migration crash; the desk owns full-suite and live cutover acceptance.
VERDICT: author submission; this record asserts no independent verdict — the review desk records its own

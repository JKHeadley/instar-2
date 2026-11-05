# Change review — Recheck installed update postconditions

Subject base: b5806d1e015dc650cdc1dee2e0accab05a849d4b
Review state: open
Reviewed content: none
Outcome: The existing installer rejects wrong-version and syntactically broken candidates before promotion, rechecks completed releases, and repairs a stale known MCP default through its durable migration transaction even when its id was already completed. This is a partial carryover of row 87, not full parity or a live activation claim.
Affected rules: 4 (exact candidate mismatch); 7/32 (declared local stores); 26 (actual bytes and consumer state); 34/70 (real npm and installed CLI tests); 39 (transaction/result metrics); 42/95 (failed verification remains failure); 44/45 (existing installations and actual runtime reader); 49/69 (source and evidence in docs/update.md); 66/78/84 (CLI inventory and generated capability); 74/102 (this review and decisions); 113 (local posture); 116 (existing transaction and installer reused). Purpose: retain update cause and preserve installed authority boundaries.
Affected floors: secrets — existing runtime validator remains mandatory and npm output stays private; spend cap — no model call or limit mutation; stop — no restart or stop-state mutation; no duplicate sends — no send path or conversation replay; durable intake — root backup and history retained, no journal restore or deletion.
Operator questions: none
Suggested tier: significant
Declared tier: significant
Tier rationale: Changes the shipped update path for existing installations; no model prompt, output parser or judgment path changes.
Side effects: Repeated updates now inspect installed CLI syntax and migration postconditions. Known stale defaults can trigger one repair and a new backup. A failed candidate is retained for inspection instead of occupying the release directory. Existing migrations without verify retain once-per-id behavior. A verifier must be read-only and safe on pre-migration state. Default reconciliation keeps the original order of retained read entries while appending missing defaults; the test compares membership without imposing a new order.
Undo and recovery: Revert this change to restore the prior updater behavior. Rerun the same release after correcting failed migration input; incomplete state and backups survive. Unknown customization and corrupt records are preserved. Never restore an old backup over live intake.
Multi-machine posture: Machine-local, deliberately: each host owns its release tree and updater lock. No peer durability, ownership, authority record or remote configuration changes.
Layer below: Read the full constitution, current 1.x update checker, migrator, drift verifier and LiveConfig; inspected 2.0 migration transaction, MCP installer/runtime reader, production installation decoder and immutable installation importer. Actual npm installation and installed CLI tests cover the consumer. The unchanged independent installation authority still governs runtime activation.
Bug class: integration
Bug evidence: reproducer=tests/preview/update.test.ts
Hook bypass: none
Convergence: none
Decision: c87-verify | Extend the existing migration entry with an optional read-only postcondition and reuse its backup/intent/completion transaction for stale-state repair. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/carryover-87-update-selfheal-1104-PROGRESS.md
Decision: c87-candidate | Adapt current 1.x exact-version and pre-promotion validation without importing native SQLite repair into a package that has no such dependency; syntax is explicitly not runtime health. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/carryover-87-update-selfheal-1104-PROGRESS.md
Decision: c87-authority | Keep protected installation bindings immutable and keep full restart, host-wide drift and other config parity outstanding in the row-87 handoff; do not infer activation authority from installer success. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/carryover-87-update-selfheal-1104-PROGRESS.md
Decision: c87-choices | Preserve explicit revocation, absent browsers, recorded operator choices and unknown narrowed read lists; only known default server and read-list shapes justify automatic reconciliation, including preservation of narrowed lists on the legacy command. Copy LiveConfig.deepEqual so key order does not change this classification. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/carryover-87-update-selfheal-1104-PROGRESS.md
Decision: c87-register | Include the actual installed CLI in the shipped inventory and declare its update boundary and stores, including existing onboarding/trust writers newly reached by that inventory. Bind the updater checks (candidate, lock/schema/manifest and migration postconditions) to the candidate/transaction tests and call the shared constitutional binder before the updater's first write; missing, retired and weakened declarations refuse. This is not activation authority. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/carryover-87-update-selfheal-1104-PROGRESS.md

## Closing block

simplestRobustRoute: This is the simplest robust route for the installed-default repair: reuse the existing update transaction, add an exact read-only postcondition, and call the existing setup installer. It prevents a persisted completed id from silently masking stale files without a second repair service or ledger. Candidate checks prevent a successful npm exit from accepting a wrong or broken release. Start guards are the existing root/lock/schema checks; end guards are actual postconditions before activation; the single repair per invocation and existing npm timeout bound the work. No unattended autonomous-completion claim is made.
80/20: Both sides of candidate and postcondition boundaries are exercised using real installed files, including a repeated-tag existing installation, a no-op repair, later-step invalidation, customization and malformed config. Full row-87 parity remains open and is not represented as READY.
VERDICT: author submission; independent judgment belongs to the desk

# Change review — required release checks from register

Subject base: d1823a36e8b0a3c155dbc723dd6aebc0666e9934
Review state: open
Reviewed content: none
Outcome: Add an optional typed release-check fact to rules and a deterministic requirements-only register output. Rule 117 names its two-session a–d obligation. Publication is pending the existing governed shape append path; this draft is not a release verdict.
Affected rules: 26, 69, 74, 90, 91, 95, 101, 111, 113, 116, 117, 123
Affected floors: secrets — no credential output or custody change; spend cap — no new model call; stop — unchanged; no duplicate sends — no send path changed; durable intake — no intake path changed
Operator questions: none; existing desk authorization covers the complete slice up to 220 measured lines
Suggested tier: critical
Declared tier: critical
Tier rationale: Register schema and release-integrity metadata require governed review even though runtime behavior is unchanged.
Side effects: Each publication gains required-release-checks.json; older generated directories need regeneration. Malformed declared facts refuse at the existing decoder. Rules without the optional fact remain absent from the list. The emitter makes no evidence evaluation or pass claim.
Undo and recovery: Revert the source and its generated publication together; preserve prior Git versions. No runtime data is migrated.
Multi-machine posture: Source-bound deterministic requirements travel with the repository. The evidence locator is relative to the desk release artifact root, with the emitted commit substituted. Each release consumer must validate its own actual candidate-bound run evidence.
Team posture: No people, accounts, grants, audiences or sharing defaults change. Private run evidence stays at its existing desk root; output names obligations and destinations only.
Layer below: Existing FactSchema validator, bootstrap converter, shape-only publication anchor, parent-shape approval boundary, generated source pins and all 308 prior declaration payloads. The existing anchor derivation refuses new shapes; no approval fact or pin is invented to suppress that refusal.
Bug class: unit
Bug evidence: reproducer=tests/register/release-checks.test.ts
Hook bypass: none
Convergence: none
Prompt review: No prompt, model parser, model acceptance or delivered reply changes. No live model proof is claimed.
Decision: required-release-checks-shape | Use one optional object with id, evidenceLocation and build/runtime stage, validated by existing fact schemas; derive the list from rules only. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/required-checks-from-register-1112-p2-build-report.md
Decision: required-release-checks-authority | Preserve requirements-only output and pending publication until the existing Rule 90 append path is supplied; no manual governance pin rewrite. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/required-checks-from-register-1112-p2-build-report.md

1.x comparison: fetched actual JKHeadley/instar main db3ed6d3052cfcc24888b6c8bc86086abcfc2987; searched src/, docs/specs/ and history, including 05d490cbf4286fbde064345ae0e622dc8df15e99, 330b8ed7a2a091eea691bd79a049e9ff27aa7149 and 576a390d791358a31991884b5edb691b0667db3c. Read src/core/StandardsRegistryParser.ts, src/core/StandardsEnforcementAuditor.ts and docs/specs/CARTOGRAPHER-CONFORMANCE-AUDIT.md. Reuse deterministic enumeration and the distinction between a reference existing and a guard executing; no code copied because prose coverage scanning duplicates the wrong mechanism here. The previous unit's ReleaseReadinessSentinel comparison remains a mismatch: release-stall detection does not declare constitutional obligations. After restoring existing-role Studio reads, read ONEX-LESSONS.md:125–142: preserve source history, migrate authority consumers, test actual production assembly and challenge machinery. Also read LIVE-PATH-PLAN.md section g from the authenticated Studio file API.

simplestRobustRoute: Extend the existing fact schema, converter and builder with one optional rule object and a pure sorted projection. Extra evidence evaluation or a second requirement inventory would duplicate the desk's release judge; the new schema prevents malformed release requirements from silently reaching it.
80/20: Prove real Rule 117 inclusion/removal, all 308 prior declaration payloads, malformed fields, determinism and absent-field neighbors; run required build/type/register/architecture and pinned tests, retaining publication and native-certificate failures honestly.
VERDICT: author draft; independent desk owns compliance and landing review

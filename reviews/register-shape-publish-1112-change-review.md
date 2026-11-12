# Change review — release requirements without a shape amendment

Subject base: 61db1447a0dd3ee1761b377096b15fc598d59a57
Review state: open
Reviewed content: none
Outcome: Emit the Rule 117 release obligation through the existing source-metadata roster and register replay, preserving the approved shape, conversion anchor and all prior declaration payloads apart from the native certificate renewed by its contract.
Affected rules: 26, 69, 74, 82, 90, 91, 94, 95, 98, 101, 111, 113, 115, 116, 117, 123
Affected floors: Secrets, spend cap, stop, no duplicate sends and durable intake unchanged; no model calls, effects or private run evidence are added.
Operator questions: none for this review candidate; the new-shape proposal is withdrawn. Existing protected-toolchain landing approval is not replaced by builder authorization or a green check.
Suggested tier: critical
Declared tier: critical
Tier rationale: Release-integrity metadata and the protected register build adapter need independent review.
Side effects: The builder validates committed release metadata against generated rule numbers and existing fact schemas and emits required-release-checks.json. Empty or absent declarations emit no checks; unknown rules, extra fields and malformed values refuse. The generated list is requirements only, with no verdicts. Existing source pin checks cover metadata edits. No governing facts are added to the register.
Undo and recovery: Revert the feature source and replay outputs together and regenerate with the existing builder; preserve history. No installed runtime data migration.
Multi-machine posture: Repository metadata and deterministic generated output travel together. Evidence remains relative to the release host's artifact root; consumers resolve actual candidate-bound evidence.
Team posture: Shared repository obligations contain no private conversation, user or credential data; no grant, audience or sharing default changes. Run evidence retains its existing access rules.
Layer below: docs/07-the-declarations.md:201 and :266, src/register/shape-authority.ts:10–25, bootstrap anchor and conversion literal, existing source-roster pin checks and fact-schema validator, native conformance contract and all 308 pre-draft declaration payloads (only the independently validated native certificate may differ).
Bug class: unit
Bug evidence: reproducer=tests/register/release-checks.test.ts
Hook bypass: none
Convergence: none
Prompt review: No prompt, model-output parser, model decision or delivered reply changed.
Decision: release-metadata-without-shape | Restore the unpublished shape/converter changes, validate the existing source-metadata file against the register, and retain identical emitted requirements; do not rebind approval pins. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/register-shape-publish-1112-PROGRESS.md
Decision: publication-authority | Shape approval belongs to Justin, not the desk or reviewer. Publish only a review candidate using the unchanged approved anchor; protected-toolchain landing remains subject to its existing authority. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/register-shape-publish-1112-PROGRESS.md

1.x comparison: Inherited and rechecked JKHeadley/instar main db3ed6d3052cfcc24888b6c8bc86086abcfc2987; searched src/ and docs/specs/ and inspected StandardsRegistryParser.ts, StandardsEnforcementAuditor.ts, CARTOGRAPHER-CONFORMANCE-AUDIT.md and their history (05d490cbf, ab26b7ca3; preceding unit additionally 330b8ed7 and 576a390d). Reuse declaration coverage distinct from executed evidence. ReleaseReadinessSentinel detects release stalls, not register conversion; no code transplant fits the typed 2.0 register. ONEX-LESSONS.md:125–142 informs preserved history, consumer consistency and actual-route verification.

simplestRobustRoute: Keep the already-authored release requirements as committed source metadata, use the existing fact validator and register rule roster, and emit through the existing build adapter. This is the simplest robust route: it prevents malformed or unresolvable requirements without a new governing schema, approval binding, inventory or release judge. The actual CLI replay, malformed-input refusal, generated-file comparison and before/after native contract are the publication evidence; no autonomous runtime capability is claimed.
80/20: Focused emission/refusal and payload-preservation tests, actual replay and CLI negative neighbor, native conformance, architecture, lint, register check and required pinned tests; no full suite on the Studio builder.
VERDICT: author review candidate; independent compliance and landing review remain the desk's.

Integration repair (train-240): retain the spec's original governed draft status and add its two-version changelog; no new shape, approval or runtime behavior. The no-shape publication design remains unchanged.

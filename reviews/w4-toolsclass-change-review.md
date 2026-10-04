# Change review — w4-toolsclass: a standing full-tools grant covers a checkpointed policy class; an uncovered tools policy refuses to start (with review round 1 repair)

Subject base: f1a13fde8f55b7284947e473ad8a915c425e7ca2
Review state: open
Reviewed content: none
Outcome: The operator's standing full-tools grant (121996) can be recorded once for the policy class full-tools-checkpointed-v1 instead of one build's digest, so a rebuild no longer silently drops tools (cint-L44 went live with tools off). A tools policy is in the class only when the build's own generated per-turn settings and arguments keep every checkpoint; a launch with no covering grant now refuses to start instead of running text only. Unit review round 1 (Astra, VERDICT NO) named two must-fix gaps in the class check, each fixed at its source: (1) the Claude check ignored the sandbox's allowRead exceptions, so a build reopening '/' stayed covered; it now requires every read exception to lie in the scratch volume, the reviewed runtime list (FULL_TOOLS_RUNTIME_READS, a class constant) or the checkpoint's own reads, and never to contain the login home, admission state, hook or a denied root. (2) Any Codex model_provider= label passed as the model-dispatch checkpoint; the check now parses the effective -c/--config overrides (policy plus per-turn) and requires exactly one selected provider, defined exactly once, whose base_url is the turn's loopback checkpoint with wire_api "responses", and no other provider, base-URL override, profile or local provider. Astra's two mutation probes now return outside (control still covered); both sides tested on the builds' real generated settings and arguments.
Affected rules: 26 (checkpoints enforced, verified from effective settings, not labels), 60 (every Codex model call passes the turn's reserved allowance), 104 (a standing grant covers the class it approved), 2 and 42 (an uncovered launch refuses loudly with a recorded outcome), 28, 82 and 94 (source authentication, prior authority and waiver unchanged), 34 and 36 (both sides of each boundary, real recorded policies), 37 (fixed at source, nothing quarantined), 74 (this record), 101 (plain commits), 116 (one pure predicate per harness; no new service)
Affected floors: secrets — the class now refuses any read exception reaching the login home, admission state or denied roots; spend cap — the class refuses a Codex provider not routed through the per-turn model gate, and caps stay at the reviewed ceilings; stop — unchanged, the runner's, outside every policy; no duplicate sends — unchanged; durable intake — a refusal happens before polling, so nothing is consumed
Operator questions: none
Suggested tier: critical
Declared tier: critical
Tier rationale: it changes which recorded operator grant authorizes the full tool set and what refuses a launch.
Side effects: new exports claudeSettingsCheckpoints, codexDispatchCheckpoint and FULL_TOOLS_RUNTIME_READS in tests/preview/tools-policy-class.ts; resolveActivationAuthority takes an optional presented policy; the runner refuses to start without a covering tools grant (explicit --tools off still runs text only).
Undo and recovery: revert these commits and this record; an exact-digest grant keeps working under either build.
Multi-machine posture: machine-local, unchanged.
Layer below: subscriptionToolSettings and codexToolHookArgs/modelGateLaunch generate the effective settings and arguments the class reads; the provider dispatch reads the selected provider's base_url.
Bug class: none
Bug evidence: none
Hook bypass: none
Convergence: none
Decision: toolsclass-r1-read-exceptions | the runtime read list the class accepts is a class constant, not the build's export, so a widened build list leaves the class instead of redefining it | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/w4-toolsclass-PROGRESS.md
Decision: toolsclass-r1-provider-target | the Codex check verifies the selected provider's effective base_url against the probe turn's checkpoint, parsing every config override, rather than a provider-name prefix | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/w4-toolsclass-PROGRESS.md
Prompt review: no model-facing change: no prompt, parse or verdict path changed; the class reads launch settings only. Real shapes replayed: the recorded L42/L43/L44 tools policies (fixtures/tools-policies-L42-L44-2026-10-03.json) and the builds' own generated settings and Codex arguments.
Deferral: generated/register.json:1 | not-a-deferral=generated register output quoting the rule book, not a commitment by this change

Subject (30 paths): docs/17-harness-adapters/09-claude-code-codex-and-future-runtime-mappings.md, generated/capabilities.json, generated/capabilities.md, generated/coverage.md, generated/glossary.md, generated/register.json, generated/rules.md, generated/source.json, register-source/owner-references/preview.json, tests/integration/host-watch.test.ts, tests/preview/README.md, tests/preview/activation-authority.ts, tests/preview/channel-source-launcher.test.ts, tests/preview/default-context-floor.test.ts, tests/preview/fixtures/tools-policies-L42-L44-2026-10-03.json, tests/preview/journal-agent-resources.test.ts, tests/preview/journal-agent.mjs, tests/preview/journal-agent.test.ts, tests/preview/journal-cutover-harness.mjs, tests/preview/journal-migrate.test.ts, tests/preview/journal-overlap.test.ts, tests/preview/journal-reminder-launcher.test.ts, tests/preview/live-sentinels-launch.test.ts, tests/preview/operator-dashboard-launcher.test.ts, tests/preview/renewal-predecessor-launch.test.ts, tests/preview/review-layers-canary.test.ts, tests/preview/self-state-launcher.test.ts, tests/preview/tools-default.test.ts, tests/preview/tools-policy-class.test.ts, tests/preview/tools-policy-class.ts

## Closing block

simplestRobustRoute: two pure predicates over the generated settings and arguments the class already produced; no new service, no approval layer, no tool removed.
80/20: 0 must-fix, 0 notes.
VERDICT: author submission; the independent verdict is recorded as a pass

# Change review — Preserve throttle recovery across Stop receipts

Subject base: 8ddb208912eb4a7c61218efb68a5d6638f75c622
Review state: open
Reviewed content: none
Outcome: A throttle Stop without a bounded nonempty result retains the original turn and recovery; answer-plus-Stop still completes. The supported native composition is recertified from the existing contract.
Affected rules: 26, 29, 32, 36, 42, 49, 55, 59, 60, 61, 63, 68, 70, 74, 101, 102, 111, 113, 115, 116
Affected floors: secrets — same custody; spend cap — same admitted model/effect checkpoints; stop — same stop and original deadline; no duplicate sends — same single durable continuation, no uncertain resend; durable intake — original accepted delivery retained
Operator questions: none
Suggested tier: critical
Declared tier: significant
Tier rationale: A narrow lifecycle repair uses existing result evidence without changing authority or capabilities; targeted adapter regressions and the native composition contract cover the affected boundary.
Side effects: Observation reads the current bounded result before lifecycle classification. Missing or empty result with quota text can no longer clear the deadline via Stop. Genuine answer-plus-Stop retains precedence; ordinary no-reply completion without throttle is unchanged. Session work forwards its already checked result presence.
Undo and recovery: Revert the repair source, rebuild, rerun the native contract before recertifying, and regenerate pins/register together. No new journal state or migration. Never resend the original input or uncertain continuation.
Multi-machine posture: Deliberately local to the exact physical session and its existing owner and serialized journal. No new shared state, placement or takeover; ownership and admission checkpoints remain in force.
Layer below: Authenticated Stop correlation, bounded current result artifact, durable accepted delivery, single-attempt recovery journal, original deadline/watchdog, admitted model/effect checkpoints, native composition digest and confined capability contract.
Bug class: integration
Bug evidence: reproducer=tests/assembly/production-session-driver.test.ts
Hook bypass: none; core.hooksPath unset and common hooks directory contains samples only
Convergence: none
Decision: repair-stop-result | Carry bounded result presence through both existing consumers; a throttle Stop alone is not completion. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/ratelimit-recover-1016-repair-PROGRESS.md
Decision: repair-native-conformance | Refresh the supported native declaration only after the existing contract passed on the exact composition/runtime. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/ratelimit-recover-1016-repair-PROGRESS.md
Decision: repair-publication | Use the delegated desk repin tools and replay register generation to publish this source. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/ratelimit-recover-1016-repair-PROGRESS.md
Prompt review: No model prompt or semantic parser changes. Real recorded summary/uncertain, Jev undecided/unsure, reply-review, delivered and empty shapes exercise the changed result boundary; lifecycle evidence is not a model verdict.

Subject (17 paths): src/assembly/README.md, src/assembly/conversation-harness-adapter.ts, src/assembly/harness.declarations.json, src/assembly/harness.ts, src/assembly/production-session-driver.ts, src/assembly/production-session-work.ts, tests/assembly/production-session-driver.test.ts, tests/assembly/production-session-work.test.ts, tests/assembly/production-grounding-inventory.json, scripts/check-assembly-contracts.mjs, generated/capabilities.json, generated/capabilities.md, generated/coverage.md, generated/glossary.md, generated/register.json, generated/rules.md, generated/source.json

Publication: The delegated desk tool refreshed the reviewed harness.ts support-source digest in production-grounding-inventory.json and its enclosing digest in check-assembly-contracts.mjs after the source commit. Owner-reference manifests needed no changes. The seven generated register artifacts were replayed from c7f90830855e65b7e800d7264d29ce4a94410223, generation sha256:33f1194b1d5aa2008b1df9eea0b23ef8a6a598260c189aae332010ba8c405540; this is shape-only publication, not runtime authority.

## Closing block

simplestRobustRoute: This is the simplest robust route: carry existing bounded result presence through the existing observation input, and qualify Stop only where captured quota evidence exists. No new service, classifier or state. Start guards remain the admitted exact session and accepted input; end requires result-plus-Stop or existing typed pause; limits remain one attempt, original deadline, stop and original model/effect allowance. Native conformance is refreshed only after its contract passes on those bytes. No new unattended shipped-path acceptance is claimed.
80/20: Three receipt positions reproduce the actual failure and pass after repair; successful-answer and recorded empty-result neighbors prove both sides. 110 targeted source tests, TypeScript and all 10 native contract tests passed. Full-suite/live proof-room acceptance remains with the combined-build gate.
VERDICT: author submission; this record asserts no independent verdict — the review desk records its own

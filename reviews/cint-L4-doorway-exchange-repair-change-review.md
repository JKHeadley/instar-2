# Change review — cint-L4 repair: the doorway map recognizes the model exchange by its stdin prompt

Subject base: 8ed86c14895e2b0990ec874ec6cc73546c1109fa
Review state: open
Reviewed content: none
Outcome: The full gate on 8ed86c14 failed one test, tests/preview/journal-agent-resources.test.ts: the preview-subscription doorway stayed unverified. Cause: the previous repair (30a3621e) observed the doorway only when a command's args exactly equalled the subscription policy args; a provider route that launches its model command with its own argument list (the resource test's stand-in route) was therefore never observed. Fix at the source: the observer recognizes the model exchange by what distinguishes it, the prepared prompt on stdin; the version and auth preflights send an empty stdin and stay unobserved as the previous repair intended. The resource test's stand-in route now also runs a no-prompt command after its model command, and the owner's admitted count is two launches per call; both sides are proven: with the stdin predicate the test passes, with the previous exact-args predicate it fails (unverified), and with every command observed it fails (unavailable). Touched tests pass: journal-agent-resources, telegram-poll-concurrency (both sides), native-harness-contract (8/8, conformance digest unchanged), doorway-map.
Affected rules: 37, 56, 74, 116
Affected floors: secrets — unchanged, only the stdin length is read, never logged; spend cap — unchanged, no launch or reservation logic; stop — unchanged; no duplicate sends — unchanged, sends untouched; durable intake — unchanged, intake untouched
Operator questions: none
Suggested tier: critical
Declared tier: critical
Tier rationale: changes which live runner launches feed the doorway verification record
Side effects: any command launched through the route with a non-empty stdin is treated as the model exchange; only the model command carries stdin in the shipped provider
Undo and recovery: revert this commit and regenerate the register; no durable format changed
Multi-machine posture: machine-local single runner per journal, unchanged
Layer below: docs/00-the-purpose.md and docs/01-the-rules.md; src/assembly/production-provider.ts command() preflights (stdin '') and model command (stdin prepared bytes); tests/preview/doorway-map.ts subscriptionExchange
Bug class: integration
Bug evidence: reproducer=tests/preview/journal-agent-resources.test.ts
Hook bypass: none
Convergence: none
Prompt review: no system prompt, provider policy or invocationPolicyDigest changed
Deferral: generated/register.json:1 | not-a-deferral=generated register output quoting the rule book, not a commitment by this change

Subject (9 paths): generated/capabilities.json, generated/capabilities.md, generated/coverage.md, generated/glossary.md, generated/register.json, generated/rules.md, generated/source.json, tests/preview/journal-agent-resources.test.ts, tests/preview/journal-agent.mjs

## Closing block

simplestRobustRoute: one predicate change in the existing observer (stdin present instead of exact args); no new machinery (Rule 116).
80/20: the failing test and the prior repair's tests pass on both sides of the predicate (preflights excluded, model exchange observed); tsc, lint, register:check pass; the full gate reruns on the Mama PC.
VERDICT: author submission; the independent verdict is recorded as a pass

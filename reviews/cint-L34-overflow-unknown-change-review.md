# Change review — cint-L34 repair: an output overflow after the child started is UNKNOWN, never not-sent

Subject base: 93c17345253d5f7f8cca4c0669050029a30bb2ae
Review state: open
Reviewed content: none
Outcome: Astra's cint-L34 MUST-FIX 1. scripts/production-boot-io.mjs classified every spawnSync error except ETIMEDOUT as `spawn-refused, sent:false`. ENOBUFS arrives after the child started and the provider answered (the bridge admits a 2 MiB body and JSON-escapes it, overflowing the parent's 2 MiB stdout bound), so one accepted turn dispatched twice and recorded a false refusal. Now only a spawn error with no process id (the child never started) is `sent:false`; any error from a started child settles through a null status as `child-exit`, UNKNOWN, never repeated. New regression in tests/preview/journal-send-outcome.test.ts drives the real transport, bridge and journal worker against a separate-process provider returning ~1.2 MiB: exactly one physical request, UNKNOWN `transport transport at child-exit`, no dispatch on reopen. The same test FAILS on the previous code (two `spawn-refused` launches). The pre-network refusal test (exit 2/125 → launch-refused) and the not-sent retry test still pass. The R105 self-host conformance digest was re-declared after native-harness-contract passed 9/9 twice; the register was regenerated. tsc exits 0; lint, register:check and git diff --check exit 0.
Affected rules: 26 (an error label is not proof of non-dispatch), 42 (definite refusal vs UNKNOWN), 37 (fixed at source, no quarantine), 74 (this record), 101 (plain commit, no hook bypass), 105 (conformance re-declared on a passing contract run), 116 (one predicate, no new machinery)
Affected floors: secrets — unchanged (fixture credential only); spend cap — unchanged; stop — unchanged; no duplicate sends — restored: a started child is never re-dispatched; durable intake — unchanged
Operator questions: none
Suggested tier: critical
Declared tier: critical
Tier rationale: changes the classification that decides whether a live Telegram send may be dispatched again (the no-duplicate floor)
Side effects: a send whose transport child started and then failed locally (overflow, timeout) now reads UNKNOWN instead of being retried; a child the host never started is still a definite non-delivery and retried once
Undo and recovery: revert the three repair commits and this record
Multi-machine posture: unchanged
Layer below: reviews/cint-L34-recall-expiry-change-review.md
Bug class: none
Bug evidence: none
Hook bypass: none
Convergence: none
Deferral: generated/register.json:1 | not-a-deferral=generated register output quoting the rule book, not a commitment by this change
Prompt review: no model-facing text changes; only the transport outcome classifier and its test changed. No prompt, packet, provider policy or invocationPolicyDigest changed.

Subject (10 paths): generated/capabilities.json, generated/capabilities.md, generated/coverage.md, generated/glossary.md, generated/register.json, generated/rules.md, generated/source.json, scripts/production-boot-io.mjs, src/assembly/harness.declarations.json, tests/preview/journal-send-outcome.test.ts

## Closing block

simplestRobustRoute: treat only a child with no process id as never started; every other spawn error falls to the existing UNKNOWN path
80/20: 1 must-fix fixed, 0 notes (targeted tests only; the full gate reruns on the Mama PC)
VERDICT: author submission; the independent verdict is recorded as a pass

# Change review — cint-L8 pipeline repair: the limit shim no longer forks under a lowered process limit

Subject base: ae2ec74782dedf82d2cc58e0f39a46906ba1fca0
Review state: open
Reviewed content: none
Outcome: The Mama PC full run failed one test: tests/preview/self-state-launcher.test.ts recorded unknownSends 1 where 0 was expected. Root cause: every transport child launches through the limit shim with a process limit of the user's counted processes plus 4. Inside lim(), the shim lowered the soft limit and only then forked `$(ulimit -H)`. Under a busy full suite, processes started after the count put the user above that limit, so the fork failed, the shim exited 125, the transport settled uncertain, and a message Telegram would have accepted read UNKNOWN. Fix at source: lim() reads both the soft and the hard value before lowering either, so no command substitution forks under a lowered process limit (the shim's own comment already required this). The limit itself is unchanged and still holds any fork of the launched process. New test in tests/integration/resource-owner.test.ts sets a limit of 1 (below every real process count, the exact contended state): a fork-free launch still execs, and a later fork is still refused. It fails on the old shim and passes on the new. Targeted runs: resource-owner (29/29), self-state-launcher (passes), native-harness-contract (9/9 twice after re-declaring the self-host composition conformance digest, which covers the shim bytes). tsc, lint and register check clean. Register regenerated with --replay.
Affected rules: 42 and 89 (a send that could have delivered was classified UNKNOWN only because the launch shim failed; it now reaches its real accepted/refused/unknown outcome), 60 (the transport and provider process ceilings are unchanged and still enforced), 105 (self-host conformance re-declared after the contract re-run), 37 (fixed at source, nothing quarantined), 74 (this record), 116 (one line reordered in the shim; no new mechanism)
Affected floors: secrets — unchanged; spend cap — unchanged; stop — unchanged; no duplicate sends — unchanged (an UNKNOWN is still never retried; fewer false UNKNOWNs arise); durable intake — unchanged
Operator questions: none
Suggested tier: critical
Declared tier: critical
Tier rationale: the shim launches every provider and Telegram transport child
Side effects: none beyond the reorder; the lowered soft and hard values are identical to before
Undo and recovery: revert the shim commit, the conformance re-declaration, the register regeneration and this record
Multi-machine posture: machine-local process launch; no replicated state
Layer below: scripts/production-boot-io.mjs transportProcessLimit (unchanged)
Bug class: integration
Bug evidence: reproducer=tests/integration/resource-owner.test.ts
Hook bypass: none
Convergence: none
Decision: cint-L8-shim-read-before-lower | read both limits before lowering either instead of widening the transport headroom, because any headroom stays racy against concurrent spawns while the reorder removes the fork entirely | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/cint-L8-PROGRESS.md
Deferral: generated/register.json:1 | not-a-deferral=generated register output quoting the rule book, not a commitment by this change

Subject (11 paths): generated/capabilities.json, generated/capabilities.md, generated/coverage.md, generated/glossary.md, generated/register.json, generated/rules.md, generated/source.json, scripts/limit-exec.sh, scripts/resource-owner.mjs, src/assembly/harness.declarations.json, tests/integration/resource-owner.test.ts

## Closing block

simplestRobustRoute: reorder the shim's reads before its lowers so nothing forks under the lowered limit
80/20: 1 must-fix repaired at source, 0 notes
VERDICT: author submission; the independent verdict is recorded as a pass

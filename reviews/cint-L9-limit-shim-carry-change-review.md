# Change review — cint-L9 round-2 repair: carry the L8 limit shim repair through d724873b

Subject base: 18b4379e2f5058b43e0e201559e937d751c83009
Review state: open
Reviewed content: none
Outcome: Astra's round-2 must-fix: L9 carried L8 only through ae2ec747, so it lacked L8's later source repair to the resource launch shim (794c9741). The shim lowered the soft process limit before forking `$(ulimit -H)`, so a user process count that rose since sampling made that fork fail and a delivered Telegram send read UNKNOWN. This merge carries L8 through d724873b unchanged: the shim reads both limits before lowering either (scripts/limit-exec.sh and the LIMIT_SCRIPT copy in scripts/resource-owner.mjs), its regression test in tests/integration/resource-owner.test.ts, the self-host conformance re-declaration in src/assembly/harness.declarations.json (L9 carried L8's prior digest unchanged, so L8's new digest applies as is), and L8's review record. Memcorr and the three round-1 repairs are untouched; the generated register conflicts were resolved by regeneration with --replay rather than by hand. Headroom, retries and UNKNOWN handling are unchanged. Targeted runs: resource-owner 29/29; tsc, lint and register check clean.
Affected rules: 37 (the known failure is repaired at source by carrying the existing fix; nothing quarantined), 42 and 89 (a send that could have delivered no longer reads UNKNOWN because the launch shim failed), 60 (process ceilings unchanged and still enforced), 105 (self-host conformance digest carried from L8's contract re-run), 74 (this record), 116 (a merge of an existing one-line reorder; no new mechanism)
Affected floors: secrets — unchanged; spend cap — unchanged; stop — unchanged; no duplicate sends — unchanged (UNKNOWN is still never retried); durable intake — unchanged
Operator questions: none
Suggested tier: critical
Declared tier: critical
Tier rationale: the shim launches every provider and Telegram transport child
Side effects: none beyond the carried reorder
Undo and recovery: revert the merge commit, the register regeneration and this record
Multi-machine posture: machine-local process launch; no replicated state
Layer below: scripts/production-boot-io.mjs transportProcessLimit (unchanged)
Bug class: integration
Bug evidence: reproducer=tests/integration/resource-owner.test.ts
Hook bypass: none
Convergence: none
Decision: cint-L9-carry-l8-shim | merge L8 through d724873b rather than re-deriving the shim change, so L9 and L8 share one reviewed repair | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/cint-L9-PROGRESS.md
Deferral: generated/register.json:1 | not-a-deferral=generated register output quoting the rule book, not a commitment by this change

Subject (11 paths): generated/capabilities.json, generated/capabilities.md, generated/coverage.md, generated/glossary.md, generated/register.json, generated/rules.md, generated/source.json, scripts/limit-exec.sh, scripts/resource-owner.mjs, src/assembly/harness.declarations.json, tests/integration/resource-owner.test.ts

## Closing block

simplestRobustRoute: merge the already-reviewed L8 shim repair instead of writing a new one
80/20: 1 must-fix repaired at source, 0 notes
VERDICT: author submission; the independent verdict is recorded as a pass

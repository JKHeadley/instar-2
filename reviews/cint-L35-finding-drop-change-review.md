# Change review — cint-L35 repair: a refused finding keeps its reason on its duty whatever code it carries

Subject base: 30f297ceb9308c4187809d2835445f2cd4e08c86
Review state: open
Reviewed content: none
Outcome: Astra's cint-L35 round-1 MUST-FIX 1. validateRetrospective dropped a malformed finding and kept its reason only in a local map, read only when the duty was `f`, still inspected and had no surviving finding. With `n` the duty read "inspected; nothing found" with the refusal gone; `u` and a valid sibling finding of the same duty also erased it; an unknown duty never entered the map, so the row vanished. Now every refused finding's reason is recorded on its duty: an inspected duty with no surviving finding of that duty (or observed well, for gravity-well) becomes unavailable with the new RETRO_DUTY_FINDING_REFUSED_NOTE plus the reason (dutyLeftUninspected counts it); a duty that still holds a valid finding stays inspected, its note qualified by the reason; an unavailable duty keeps its disposition and gains the reason. A malformed row naming no known duty refuses the whole pass again, as on accepted L34. The `f` path is unchanged. Regressions in tests/preview/retrospective-live-failures-2.test.ts replay recorded real-model call 3 with only the recurrence code changed (n, u), the mixed valid+invalid case, the clean-n other side and the unknown-duty refusal. Astra's probe now shows the refusal in all four cases. tsc exits 0; the seven retrospective test files pass (86 tests); lint, register:check and git diff --check exit 0.
Affected rules: 42 (a drop is recorded as a disposition), 9 and 26 (no duty is recorded clean on a claim the answer does not hold), 37 (fixed at source, no quarantine), 74 (this record), 101 (plain commit, no hook bypass), 116 (one loop over the existing map, one note constant)
Affected floors: secrets — unchanged; spend cap — unchanged (no provider call, retry or prompt change); stop — unchanged; no duplicate sends — unchanged; durable intake — unchanged
Operator questions: none
Suggested tier: critical
Declared tier: significant
Tier rationale: changes only how a retrospective answer's rejected finding rows are recorded on duty notes; no send, spend, stop or intake path is touched
Side effects: a duty answered `n` beside a refused finding of that duty now reads not inspected and is owed again; a refused row naming an unknown duty refuses the pass, as on L34
Undo and recovery: revert this repair commit, its register replay commit and this record
Multi-machine posture: unchanged
Layer below: reviews/cint-L35-change-review.md
Bug class: none
Bug evidence: none
Hook bypass: none
Convergence: none
Prompt review: no prompt, packet, provider policy or invocationPolicyDigest changed; only the validator's recording of rows it already refused. Replayed against recorded real-model answers (fixture retrospective-live-failures-2-2026-10-02, calls 1-3 of the room-two pass-0 packet).
Deferral: generated/register.json:1 | not-a-deferral=generated register output quoting the rule book, not a commitment by this change
Deferral: tests/preview/retrospective.ts:900 | not-a-deferral=code comment saying a refused finding names no case to defer, not a commitment

Subject (9 paths): generated/capabilities.json, generated/capabilities.md, generated/coverage.md, generated/glossary.md, generated/register.json, generated/rules.md, generated/source.json, tests/preview/retrospective-live-failures-2.test.ts, tests/preview/retrospective.ts

## Closing block

simplestRobustRoute: record each refused finding's existing reason on the duty it names, after the f-corroboration loop, reusing the existing duty note/disposition
80/20: 1 must-fix fixed, 0 notes (targeted tests only; the full gate reruns on the Mama PC)
VERDICT: author submission; the independent verdict is recorded as a pass

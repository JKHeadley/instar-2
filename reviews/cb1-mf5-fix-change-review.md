# Change review — CB1-MF5: bind every preview gate cause

Subject base: 1e323ff6ad0ff122a14e7044bb07eed70be99b8f
Review state: open
Reviewed content: none
Outcome: gate and pollLimit declared only emergency stop although they also enforce the recorded expiry; capacityRefused declared only spend although it also enforces turn, reply and minimal-reserve capacity. Each now binds two existing schema rungs, with recorded-governed-state for the second cause and closed failure directions for both. The predicates, authority resolution, journal format, prompts and output parsing are unchanged. The old single-rung declarations now refuse composition. Targeted tests cover the declarations and the actual predicates, including expiry equality, its durable latch, the stop port, turn/reply/reserve and Jev boundaries, and continued polling at ordinary capacity.
Affected rules: 4, 26, 66 (actual branches have their own admission basis); 14, 15 (capacity never ends polling); 35 (isolated fixtures and read-only journal copies); 37, 70 (foreground targeted tests); 49, 74, 111 (this review and the underlying state inspection); 95 (both rungs stay closed); 101, 102, 108, 112, 113, 116
Affected floors: secrets — existing credential gate unchanged; spend cap — every reservation comparison unchanged; stop — immediate refusal and expiry latch unchanged; no duplicate sends — intents and UNKNOWN handling unchanged; durable intake — no projection, append, replay or retention change
Operator questions: none
Suggested tier: critical
Declared tier: significant
Tier rationale: correction to declared runtime governance, with no change to an admission predicate, dispatch, authority, model question or parsed model output.
Side effects: mixed old/new declaration and source files refuse launch, intentionally. The source and sidecar must deploy together. No live installation is modified by this branch. The register replay remains explicitly shape-only; it is not approval evidence or an independently administered authority claim.
Undo and recovery: revert the source and declarations together and regenerate the register. Journal bytes and state need no migration. Do not deploy a partial revert of the two composition inputs.
Multi-machine posture: all machines use the same committed bindings and sidecar. Existing journal replication, operator custody and one-machine behavior are unchanged; no new state or peer dependency.
Layer below: src/register/rungs.ts admits per-rung recorded-governed-state; bindBlockingSite checks category, basis and fail direction; journal.ts gate and pollLimit check stop/expiry, while capacityRefused distinguishes reservations from intake/send/reserve bounds. Genesis, checkCaps and checkExpiry supply the replayed values. Read-only copies of the running Justin and proofroom2 journals replay identically under the deployed and candidate readers; existing activation-authority resolution succeeds against authenticated operator records and the desk seal, while an out-of-bounds activation refuses. This proves the existing preview authority, not a new register provider or independently separated writer.
Verification: 22 targeted tests passed; typecheck, build, architecture, lint and register replay/check passed. The change-review checker passed on the source commit. Generated outputs are refreshed from e5326f1238db22c5be315f664a56cf09b200fa03 (282 entries, 116 rules, shape-only replay). Full suite and independent gate remain the pipeline's work. Detailed foreground output and read-only evidence are in /Users/dabombstudio/.instar/agents/echo/.instar/lanes/cb1-mf5-fix-PROGRESS.md.
Bug class: integration
Bug evidence: reproducer=tests/preview/blocking-site-binding.test.ts
Hook bypass: none
Convergence: none
Decision: mf5-existing-rungs | Use the current schema's per-rung recorded-governed-state basis for recorded expiry and non-spend capacity. The assignment permits binding each cause; a new trial-limits register/provider system is unnecessary for that correction. No checker, schema, constitutional text or replay exception is widened. The earlier audit's broader proposed implementation is superseded by this narrowly scoped repair, not claimed as implemented. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/cb1-mf5-fix-PROGRESS.md
Prompt review: no prompt, model route, parser, accept/escalate/refuse predicate or delivered text changes. Real journal replay additionally compares every projected field and capacityRefused on every retained record under both versions. The new declaration binding runs before that replay. The proof does not make new calls or send messages.
Prompt finding: 849db3a6296a | protocol-literal | existing fixed reply literal in journal.ts, unchanged
Prompt finding: bd01de21286a | protocol-literal | existing capability guidance in journal.ts, unchanged
Prompt finding: fb5fa7e706c8 | protocol-literal | existing capability guidance in journal.ts, unchanged

## Closing block

simplestRobustRoute: Bind each existing cause using the existing multi-rung schema. This is the simplest robust route: it preserves every start, expiry, capacity and stop guard, introduces no new runtime decision or authority, and refuses the previous misleading declarations at composition. No autonomous-completion claim is made.
80/20: declaration regression and boundary tests pass; the pipeline owns the full suite and independent landing review. Read-only recorded-state comparison supplements isolated tests.
VERDICT: author submission; this record asserts no independent verdict — the review desk records its own

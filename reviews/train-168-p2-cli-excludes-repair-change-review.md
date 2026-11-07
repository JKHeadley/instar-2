# Change review — preserve host exclusions in every Vitest project

Subject base: c953fbc1030809aa08b897b72af5a3bcd70c1fba
Review state: open
Reviewed content: none
Outcome: Honor the remote gate's existing CLI exclusions in every test project, so Studio-assigned tests execute only on their assigned host while all other tests remain selected exactly once.
Affected rules: 18, 26, 34, 37, 49, 60, 63, 70, 74, 100, 101, 102, 111, 112, 113, 116.
Affected floors: secrets — custody and disclosure unchanged; spend cap — no provider or budget change; stop — stop assertions retained; no duplicate sends — effect identity and replay assertions retained; durable intake — storage and recovery assertions retained.
Operator questions: none
Suggested tier: significant
Declared tier: ordinary
Tier rationale: Test discovery configuration and regression coverage only. No product behavior, prompt, native composition, host assignment, assertion, timeout or generated publication changes.
Side effects: CLI exclusion patterns now reach ordinary projects as well as serial projects. Full runs without exclusions and both platform environment splits retain their exact file sets. No cross-host scheduling or performance claim is made.
Undo and recovery: Revert this commit to restore previous discovery. No migration or live-state change.
Multi-machine posture: Existing desk manifests still assign the native decoder, Codex and harness-account tests to Studio. Discovery against those exact manifests selects 1011 remote and 31 Studio files, their union all 1042 tracked test files exactly once with zero overlap. No test is quarantined.
Layer below: Read the full purpose and rulebook, the three failing test files and their prerequisites, desk remote and Studio gate invocations, both host manifests, and Vitest 3.2 CLI normalization, configuration resolution and inline-project initialization. cliExclude is parsed by Vitest but omitted from its project CLI override list; shared-array mutation only accidentally covered the serial projects. Use the existing typed configureVitest hook on each project to union the parsed CLI patterns with its resolved exclusions. This is a 2.0 runner repair, not a 1.x feature carryover.
Bug class: unit
Bug evidence: reproducer=tests/unit/test-worker-limit.test.ts
Hook bypass: none; checked core.hooksPath (unset) and the common hooks directory (sample files only).
Convergence: none
Prompt review: No model-facing instruction, parser, acceptance or refusal path changes.
Decision: train-168-p2-repair-D1 | Forward the root runner's parsed CLI exclusions to each inline project. Fix the shared discovery cause instead of weakening five host-prerequisite assertions or adding retries or host provisioning. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-168-p2-repair-PROGRESS.md

Subject: vitest.config.ts; tests/unit/test-worker-limit.test.ts.

Evidence: The new actual-CLI discovery regression failed against the original config: the three explicitly excluded preview files still appeared (1041 selected versus 1038 expected). With the repair all eight runner tests pass, including repeated CLI flags, an equals-form glob, all three platform split settings, exact retained file coverage, worker caps, ordinary concurrency and ordered fresh-process serial fixtures. TypeScript checking passes. The exact desk partition was also verified using discovery only, with no test bodies run. Targeted tests run in the foreground at nice 10 with one outer worker; the existing bounded async rendezvous uses two inner workers to prove concurrency without CPU stress. The supplied red full gate and passing Studio evidence remain attributed to that run; no saved full report was fetched or fabricated. The pipeline must rerun full qualification. Prior integration review limitations, carryover row 31 and CB6-MF-A, CB7-R90 and CB1-MF5 remain unchanged and open.

## Closing block

simplestRobustRoute: Use Vitest's existing typed per-project configuration hook and its parsed CLI patterns, retaining default/project exclusions. No second CLI parser, scheduler, retry, host probe, product restriction or test skip is added. The start guard is resolved discovery; exact file-set and scheduling tests guard completion and coverage.
80/20: One shared runner defect explains all five failed host-prerequisite cases. Reproduce that defect, repair it once, verify both selection and exclusion, and leave full qualification to the pipeline.
VERDICT: author submission; no independent verdict asserted

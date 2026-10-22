# Change review — Train 128 policy and historical replay assertions

Subject base: 8b1c7f7ccff22bfd63d782cce0d3de3ed3db3c1c
Review state: open
Reviewed content: none
Outcome: Restore the four failing train-128 test expectations for the composed policy while preserving immutable captured prompts and stale-policy rejection.
Affected rules: 36, 37, 49, 58, 70, 74, 101, 111, 112, 113, 116.
Affected floors: secrets — unchanged custody and redaction; spend cap — unchanged reservations and limits; stop — unchanged gate; no duplicate sends — unchanged durable dispatch; durable intake — unchanged journal. Test-only repair.
Operator questions: none
Suggested tier: ordinary
Declared tier: ordinary
Tier rationale: Only four regression tests and review records change; no runtime prompt, parser, permission, fixture bytes, or state changes.
Side effects: The final tree adopts the concurrent owning repair 701ad869 exactly for all four tests: current policies must contain the new memory clause, and restoring the historical clause must reproduce each original policy digest. The recorded Codex policy is explicitly refused before physical execution. Historical tools-prompt comparison translates exactly the memory clause as existing replay tests already do; current supersession guidance remains asserted.
Undo and recovery: Revert the repair range to restore the prior test expectations; runtime and stored records need no recovery. Historical captured evidence is unchanged.
Multi-machine posture: Test-only and portable; no new state, transport, ownership, or replication semantics. Host-specific integration acceptance remains with the Studio pipeline.
Layer below: Checked subscriptionConversationPolicy and codexConversationPolicy, memory-answer-guidance, existing historical deferral replay translation, recorded self-host activation and capability prompts. Recomputed hashes using the repository TypeScript loader; translating Claude memory wording alone reproduces its old digest.
Bug class: unit
Bug evidence: reproducer=tests/preview/self-host-doorway.test.ts
Verification: The supplied fast-train-128-8b1c7f7c excerpt identifies all four failures. The four complete changed test files passed (47 tests) in /Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-128-repair-policy-tests.log; typecheck also passed. This record covers the correction from prose to a resolvable reproducer path in its Bug evidence field.
Hook bypass: none
Convergence: none

Subject (4 paths): tests/preview/offline-canary.test.ts, tests/preview/renew-activation.test.ts, tests/preview/self-host-doorway.test.ts, tests/preview/train-12-capability-replay.test.ts

Integration: The first push was rejected because origin/train-128 advanced to 701ad869e48d46cf40636223178956ce39d1ccc6, which repairs the same failures. Merge that owner, adopt its four test files exactly, and preserve both histories. Its historical Codex clause differs from the old Claude clause; the exact recorded hash verifies the distinction. This avoids maintaining two repairs for one cause. The four files and cheap checks are rerun on the merged result.

## Closing block

simplestRobustRoute: This is the simplest robust route: retain original exact policy hashes through historical reconstruction and extend the existing historical prompt translation, keeping captured bytes intact. No new helper, service or runtime branch. Start guard: current activation must match the actual policy; end guard: the recorded answer reaches the existing owner with its exact binding; limits: unchanged secrets, spend cap, stop, durable intake and no duplicate sends. This test repair makes no new autonomous-capability claim.
80/20: Run typecheck and the four complete touched test files with nice -n 10 and one worker, then architecture/lint, register and change-review checks after the final commit. No full suite or load test on this host; the pipeline owns the full gate.
VERDICT: author submission; this record asserts no independent verdict — the review desk records its own

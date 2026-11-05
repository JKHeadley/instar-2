# Change review — Adapt retrospective consumer fixtures to correction review

Subject base: e0ead00a7242dd14506c7cdd4e9f6ed8a8b189f9
Review state: frozen
Reviewed content: sha256:1e9c01472df44f20be3b79c9ae26557a6fd8b963fe1204e8b9e0113403404181
Outcome: Existing retrospective consumer tests exercise the restored correction-class contract while retaining historical provider evidence unchanged.
Affected rules: Rules 26/34/36/58/70/74/85/101/102/109/111/113/116.
Affected floors: secrets, spend cap, stop, no duplicate sends and durable intake retain existing production enforcement; only offline test fixtures change.
Operator questions: none
Suggested tier: routine
Declared tier: routine
Tier rationale: No production code or captured provider bytes change. Test setup now supplies the two-question judgment already required by the tested port.
Side effects: Tests exercise pending class-review obligations and budget both rows. The promise replay supplies an explicitly synthetic review, so its older correction does not stay owed solely because the stub omitted the new row. Historical cap replay separates current prompt additions from the original prompt hash.
Undo and recovery: Revert the test adaptation; the original failures will return and production behavior remains unchanged.
Multi-machine posture: Offline fixtures only; no machine state, authority or installed artifact changes.
Layer below: Actual journal-backed correction intake, retrospective row validation/budgeting and retained raw historical provider outputs; no expected-result hash is edited.
Bug class: integration
Bug evidence: reproducer=tests/preview/retrospective-first-pass-fit.test.ts
Hook bypass: none
Convergence: none
Decision: C32-CB-4 | Adapt three direct consumer tests to the restored class-review contract and preserve the historical cap prompt hash without altering captured evidence. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/carryover-32-common-base-1105-PROGRESS.md
Prompt review: Only test fixtures change; the production question remains exactly the tested 88aabf739 question. Historical outputs are explicitly not fresh answers to it.

1.x comparison inherited from C32-CB-1: actual main b80413b4a and pinned 4f88880a correction source, the record-time class review and ONEX-LESSONS section 5. This test-only adaptation covers the existing port's integration boundaries, not the other row's production module.

## Closing block

simplestRobustRoute: Teach existing direct-consumer fixtures the required review row and retain their original assertions; reconstruct the historical question separately rather than editing raw evidence or production behavior.
80/20: Only failures caused by the restored correction contract are repaired. The unrelated WSL status child timeout remains reported for the Studio gate.
VERDICT: author submission; this record asserts no independent verdict — the review desk records its own

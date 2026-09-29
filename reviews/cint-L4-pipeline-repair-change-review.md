# Change review — cint-L4 pipeline repair: close the owner-reference-pin-drift and full-suite-load-timeouts quarantines; name held preview evidence

Subject base: 77558d3c34b3cc664c89cfbc62b2610d79acbcd3
Review state: open
Reviewed content: none
Outcome: The Mama PC gate of cint-L4 at 77558d3c passed every test but failed scripts/check-register-contract-map.mjs with "held test P4-NF-06 must pass in the current run": the P4-NF-06 owner-manifest case was still skipped under the owner-reference-pin-drift quarantine. Its cause (stale pins) is closed at source: the six quarantined cases (the governance case and five e2e register cases) are restored unchanged and the owner references re-pinned with the desk tooling; all pass on this tree (16/16 and 6/6). The same checker then refused 17 more held preview items whose owner-catalog test names no evidence id: the two held capture fixtures and the seven probes the live launcher test actually proves passed now carry their ids in the titles of the tests that prove them, and the launcher test asserts passed for reply-drain, reply-review-reached and telegram-identity, which it previously only listed. The four cases still quarantined under full-suite-load-timeouts (whose root cause, the uncached transpile, main #137 repaired) are restored and pass (provider-answer-reply 18/18, owner-references 7/7), which also restores the P9-NF-66 fixtures check-verification-contracts needs. Not repaired and reported to the desk: eight P9-PREVIEW runtime probes (held-notice-delivered, reminder-delivered, provider-outcomes, step-check-reached, summary-checked, spend-cap-refusal, status-answered, stop-honored) have no passing proof in their pinned launcher artifact, so the held check still refuses them.
Affected rules: 36, 37, 74, 116
Affected floors: secrets — unchanged, test titles and pins only; spend cap — unchanged; stop — unchanged; no duplicate sends — unchanged; durable intake — unchanged
Operator questions: the eight unproven P9-PREVIEW probes need an owner decision: build live-launcher scenarios that prove each one, or rule that runtime-stage probes are held by declaration and freshness (P3-NF-25) rather than a vitest pass, which changes the constitution-enforcement checker (#129)
Suggested tier: critical
Declared tier: significant
Tier rationale: only test titles, restored skips, owner-reference pins, defect records and the replayed register change; no src/ file and no checker logic changes
Side effects: none at runtime; the register generation hash changes because the pinned test bytes changed
Undo and recovery: revert these commits; nothing durable changes format
Multi-machine posture: machine-local tests; the records travel with the repository
Layer below: docs/00-the-purpose.md and docs/01-the-rules.md; scripts/check-register-contract-map.mjs (the held-test check); scripts/register-owner-references.mjs (the preview probe artifact rule); docs/07-the-declarations.md P3-NF-25/P3-NF-28
Bug class: integration
Bug evidence: reproducer=scripts/check-register-contract-map.mjs
Hook bypass: none
Convergence: none
Deferral: generated/register.json:1 | not-a-deferral=generated register output quoting the rule book, not a commitment by this change
Prompt review: no prompt, system prompt or provider policy changed

Subject (22 paths): docs/defects/full-suite-load-timeouts.md, docs/defects/owner-reference-pin-drift.md, generated/capabilities.json, generated/capabilities.md, generated/coverage.md, generated/glossary.md, generated/register.json, generated/rules.md, generated/source.json, register-source/owner-references/part-four.json, register-source/owner-references/part-nine.json, register-source/owner-references/part-ten.json, register-source/owner-references/preview.json, scripts/check-assembly-contracts.mjs, tests/assembly/production-grounding-inventory.json, tests/assembly/provider-failure.test.ts, tests/e2e/register.test.ts, tests/intake/governance.test.ts, tests/preview/model-json.test.ts, tests/preview/proofs-launcher.test.ts, tests/register/owner-references.test.ts, tests/rungraph/provider-answer-reply.test.ts

## Closing block

simplestRobustRoute: Close each quarantine at its source (re-pin with the existing tooling, restore the skip) and name the evidence id on the test that already proves it; nothing that is not proven is tagged, and no checker or machinery is changed.
80/20: tsc, lint, register:check, the change-review check and every touched test file pass on this machine; the contract checkers were run against the gate's saved results with the restored cases confirmed by targeted runs; the full suite runs at the gate.
VERDICT: author submission; the independent verdict is recorded as a pass

# Change review — emergency continuation projection after login handoff

Subject base: c4ac82ee82df5988a9a3522752a96272b00d4a62
Review state: open
Reviewed content: none
Outcome: Start a live worker after a journal continuation exceeds the bounded context by projecting the current summary and recent turns; keep the omission visible.
Affected rules: 110
Affected carryover rows: 03
Affected floors: secrets — unchanged; spend cap — unchanged; stop — unchanged; no duplicate sends — unchanged; durable intake — unchanged.
Operator questions: none
Suggested tier: critical
Declared tier: critical
Tier rationale: The projection supplies a live answer worker after a login handoff and can omit prior instructions; emergency installation required real-group proof and follow-up independent review.
Side effects: A replacement worker sees a bounded subset of the journal. The first version used character limits, which can exceed a byte gate on Unicode and can omit a long latest message's tail. A separate correction remains required.
Undo and recovery: Revert to c4ac82ee only if it can answer the retained real task; the prior build had refused continuation and left the operator silent.
Multi-machine posture: No transfer or new authority; this is a projection of the owner's existing journal.
Layer below: The pre-dispatch 128,000-byte continuation refusal happened before a worker could start. The projected context gets the accepted task to the model.
Bug class: live-path
Bug evidence: reproducer=tests/preview/continuation-grounding.test.ts; live=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/preview-trial-root/justin-group-20261010/runs.jsonl
Hook bypass: none
Convergence: none
1.x reference: 1.x compacts an overlong session rather than refusing the next task solely for prior context length.
Prompt review: The grounding text tells the worker that earlier history may be omitted. Independent review found the first version does not always retain the latest instruction's tail.
Deferral: none

Subject (12 paths): docs/release-evidence/continuation-emergency-1104-report.md, generated/capabilities.json, generated/capabilities.md, generated/coverage.md, generated/glossary.md, generated/register.json, generated/rules.md, generated/source.json, tests/assembly/production-session-driver.test.ts, tests/preview/continuation-grounding.mjs, tests/preview/continuation-grounding.test.ts, tests/preview/journal-agent.mjs

Decision: CONT-EMERGENCY-1 | Accepted the bounded projection as an outage repair after a real retained task received reply 748; independent review found byte and tail omissions, so this is not full closure. | reported=docs/release-evidence/continuation-emergency-1104-report.md

## Closing block

simplestRobustRoute: Start a worker from the current summary and recent turns after the old unbounded continuation refuses; correct byte and tail omissions in a separate change.
80/20: Restore real answers first, then close the projection's known limits with an exact-byte follow-up.
VERDICT: Emergency live use proved one real answer; independent Astra review found defects and did not approve unconditional closure.

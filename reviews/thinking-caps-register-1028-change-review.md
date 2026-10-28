# Change review — Publish combined copy register

Subject base: 2e92f8d158ff1a6518d1676698e9d67919e94090
Review state: open
Reviewed content: none
Outcome: Replay-generate the register from the committed combined-copy source and renewed native certificate; publish only the seven generated outputs.
Affected rules: 1, 36, 49, 74, 101, 102, 105, 111, 116
Affected floors: secrets — no secret source or custody edit; spend cap — no runtime policy edit; stop — no runtime edit; no duplicate sends — no transport edit; durable intake — no journal edit.
Operator questions: none
Suggested tier: critical
Declared tier: critical
Tier rationale: The register publishes capability and certification statements for the exact candidate source.
Side effects: Generated descriptions now reflect the copy candidate's tool limits, thinking setting and native conformance. This does not grant authority or switch a runner.
Undo and recovery: Discard the isolated gate branch; no live state was touched.
Multi-machine posture: The generated register is deterministic from the same committed source on each machine.
Layer below: build-register.mjs replay used exact committed source 2e92f8d158ff1a6518d1676698e9d67919e94090 and emitted seven files; register:check matched them afterward.
Bug class: none
Bug evidence: none
Hook bypass: none
Convergence: none
Decision: combined-copy-register | Publish the deterministic generated register for the renewed source pins; preserve the exact source commit pointer. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/thinking-caps-gate-1028-PROGRESS.md
Deferral: generated/register.json:1 | not-a-deferral=The generated register includes standing prerequisite descriptions from source declarations; this publication does not defer a new candidate task.

Subject (7 paths): generated/capabilities.json, generated/capabilities.md, generated/coverage.md, generated/glossary.md, generated/register.json, generated/rules.md, generated/source.json

## Closing block

simplestRobustRoute: Use the existing replay generator and committed source pointer. No new register writer or manual pin edit.
80/20: Exact generated outputs and register:check are the evidence; independent review and real-task scoring remain open.
VERDICT: author submission; this record asserts no independent verdict — the review desk records its own

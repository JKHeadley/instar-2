# Change review — retire the dark step-check

Subject base: 9594add77f86c96b8084bf23a29dc005af26c8ba
Review state: open
Reviewed content: none
Outcome: Retire preview.step-check by the operator's 2026-10-20 22:00 review (no live evidence; never observed working) instead of extending its overdue graduation deadline a third time. The declaration is status retired with no graduation gate or deadline; the append-only promotion record gains a retired decision with reason and rollback, and no stage is recorded. The launcher refuses --step-check true with a plain message; the README capability line is removed; the register and capability briefing are regenerated, so build-register --check passes on today's clock and every later one.
Affected rules: Rules 1, 9, 38, 48, 49, 62, 70, 71, 72, 73, 74, 78, 84, 101, 102, 111, 113 and 116.
Affected floors: secrets — unchanged, the new refusal prints a fixed text with no secret; spend cap — unchanged, a retired check makes no Jev or model call; stop — unchanged; no duplicate sends — unchanged, the refusal happens before any poll or send; durable intake — unchanged, the refusal happens before the journal opens.
Operator questions: none
Suggested tier: critical
Declared tier: ordinary
Tier rationale: The paths are critical by location (generated/, register-source/, a declarations file, journal-agent.mjs), but the change only turns off a feature that was already off by default: one declaration status, one append-only record entry, and a launch-option refusal ahead of all runtime work. No execution, judgment or send logic changes.
Side effects: The register no longer reports preview.step-check as dark or gated; the operator status pull reads "0 dark, 1 retired (preview.step-check)" and carries no Graduation line. The agent's capability briefing (generated/capabilities.json) no longer lists it; the register catalog lists it as retired. preview.sentinel.step-check stays dark (sentinels carry no deadline, and its duty still references it); its remainder text now says the feature is retired. Journals that recorded verdicts before keep reading them in status.stepChecks. A launch with --step-check true now exits 1 with the plain refusal.
Undo and recovery: Revert the four commits together (or, through review, append a new-deadline promotion entry and restore status dark with a gate and the README line), then regenerate the register. The promotion history is append-only and keeps every earlier deadline.
Multi-machine posture: Shared repository declaration, record and generated publication; every machine reads the same retirement. No machine-local runtime state is added.
Layer below: Read docs/00-the-purpose.md and docs/01-the-rules.md (Rules 72 and 73). Inspected src/register/declarations.ts feature-gate (status retired needs no gate), src/rulegraph/graph.ts checkDeadlines (dark/soaking only), scripts/register-shipped.mjs (briefing and README R78/R84 checks skip retired features), tests/preview/capabilities.ts Rule 72 findings and protection rows, and the duty preview.duty.every-step-checked that keeps the sentinel declared.
Bug class: none
Bug evidence: none
Hook bypass: none; core.hooksPath is unset and the common hooks directory holds sample hooks only.
Convergence: none
Prompt review: No model prompt, packet or output interpretation changes. The retired step-check made Jev calls only when launched with --step-check true, which is now refused; the promotion-record strings are status metadata with no fixture trigger or dispatch answer.
Decision: stepcheck-retire | Desk decision 22:06, option 1: retire preview.step-check (status retired, no gate, promotion-record retired entry citing the operator's 22:00 review, README line removed, launcher refuses --step-check true, register and briefing regenerated). Not a Rule 72 enforcement change and not a third extension. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/stepcheck-retire-1020-PROGRESS.md
Decision: stepcheck-sentinel-stays-dark | Keep preview.sentinel.step-check dark rather than retiring it: the pending duty preview.duty.every-step-checked names it as watcher, so retiring it cascades into the duty; sentinels carry no deadline, and its remainder now says the feature is retired. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/stepcheck-retire-1020-PROGRESS.md
Decision: stepcheck-plain-refusal | The launcher suppresses error details by default; a fixed-text PlainRefusal is printed like AgentPathRefused so the operator sees why the launch refused. The text carries no secret. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/stepcheck-retire-1020-PROGRESS.md
Deferral: generated/register.json:1 | not-a-deferral=generated publication that quotes existing declaration and record text, not deferred implementation

Subject (16 paths): generated/capabilities.json, generated/capabilities.md, generated/coverage.md, generated/glossary.md, generated/register.json, generated/rules.md, generated/source.json, register-source/owner-references/part-nine.json, tests/preview/README.md, tests/preview/capabilities.declarations.json, tests/preview/capabilities.test.ts, tests/preview/capabilities.ts, tests/preview/journal-agent.mjs, tests/preview/promotion-record.test.ts, tests/preview/promotion-record.ts, tests/preview/proofs-launcher.test.ts

## Closing block

simplestRobustRoute: Use the register's existing deadline-free status (retired) and the existing append-only promotion record, extended by one decision kind, instead of a new deadline-warn mechanism or a Rule 72 enforcement change. The refusal is one guard at the existing option check; the step-check library code is untouched and simply never enabled. The Rule 72 deadline machinery keeps its both-sides tests on an in-test fixture of the pre-retirement declaration, so no test depends on the real clock for this feature.
80/20: Verify build-register --check on the current clock, the capability and promotion tests (retirement both ways, dates up to 2027), the launcher refusal through the real launcher, typecheck, architecture and wiring lint, and the desk's pinned READY tests.
VERDICT: author submission; this record asserts no independent verdict — the review desk records its own

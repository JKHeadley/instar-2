# Change review — schedule summary phases in replay fixtures

Subject base: e375e481ff7ed5040774a4f74283201c428eff42
Review state: open
Reviewed content: none
Outcome: Summary-dependent replay fixtures explicitly schedule their summary phase after removal of the implicit drain preflight. Launcher checks assert answer-before-summary order and durable send counts. Unforced recorded-output replays verify the existing background scheduler.
Affected rules: Purpose 2/3; Rules 34/36/37/42/45/49/70/74/77/86/93/95/101/102/111/113/116.
Affected floors: secrets — existing outbound checks unchanged; spend cap — existing shared call budget and bounded attempts unchanged; stop — existing model/send admission unchanged; no duplicate sends — durable reply receipts retained and replay assertions kept; durable intake — existing encrypted journal retained without schema changes.
Operator questions: none
Suggested tier: critical
Declared tier: significant
Tier rationale: Test-only repair of the integration contract; runtime code and safeguards remain byte-identical to the assigned head.
Side effects: Only fixture scheduling and assertions change. No runtime, prompt, validator, authority, capability, retry limit, store or send path changes. Historical fixtures explicitly schedule their summary decisions; the launcher canary now verifies an independent reply precedes summary review, including a refused summary. Sentinel send counts follow durable deliveries and the test's existing installation-policy outage branch.
Undo and recovery: Revert the fixture changes and regenerate the register; runtime and journal state are unaffected. The old implicit-summary expectations would fail again.
Multi-machine posture: Existing owner-gated runner and replicated journal unchanged. No new local authority or peer dependency. Test clocks, offline endpoints and isolated fixture journals are deliberately machine-local.
Layer below: Inspected runSummary's short-history early return, pendingMemory selection, ordinary lane after-hook in journal-agent.mjs, durable mutation validation and answer admission. The runner calls summarizeIfNeeded without force, but that wrapper already passes force when pendingMemory exists. A negative control disproved the proposed short-history scheduler defect, so its redundant condition was removed. The missing phase belonged to the fixtures, not the runtime.
Bug class: none
Bug evidence: none
Hook bypass: none; core.hooksPath is unset and the common hooks directory contains sample files only. Plain commits.
Convergence: none
Decision: explicit-summary-fixtures | Invoke the existing summary phase in fixtures whose assertions depend on its decisions; preserve mutation, refusal, cancellation and replay checks. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/sb-deferral-confirm-delay-1013-repair-PROGRESS.md
Decision: retain-existing-scheduler | Negative control passed without the proposed condition because the existing wrapper forces pending memory. Remove the redundant runtime change; strengthen unforced replay evidence instead. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/sb-deferral-confirm-delay-1013-repair-PROGRESS.md
Decision: runner-order-fixtures | Assert reply-before-summary review and durable delivery counts, including summary refusal and the existing minimal-path installation-policy outage. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/sb-deferral-confirm-delay-1013-repair-PROGRESS.md
Prompt review: No prompt text, output parser or memory validation changes. Recorded summaries (including uncertain), Jev undecided/unsure, review verdicts, delivered replies and empty reply shapes exercise the unforced scheduler and independent answer path. Sources and update ids are listed in the progress report. No fresh model or deployment claim.
Prompt finding: 450c79237a95 | protocol-literal | Existing ambiguity guidance tested as a fixed briefing contract, not a literal intent classifier.

## Closing block

simplestRobustRoute: This is the simplest robust route: update test consumers to invoke the existing summary scheduler explicitly and verify the new ordering. The proposed runtime change was disproved and removed; no mechanism is added. Start guards remain authenticated durable intake and owner admission; end guards remain validated journal decisions and durable sends; limits remain the existing shared cap, retry ceiling and stop. The finite slow-clock replay proves timely reservations while unforced summaries later run. Offline launcher evidence exercises the shipped scheduler; live deployment acceptance belongs to the desk.
80/20: Targeted affected files in foreground chunks with nice -n 10 and one worker, recorded-shape replays, TypeScript, architecture, lint, register checks and change-review checks. Full-suite execution and its actual report remain with the Studio pipeline.
VERDICT: author submission; this record asserts no independent verdict — the review desk records its own

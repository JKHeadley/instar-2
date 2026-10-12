# Change review — Repair launcher acknowledgement timing fixture

Subject base: 7fc4f2ffb77f34c17630cc62261a94cb688a65d0
Review state: open
Reviewed content: none
Outcome: Exercise the existing ten-second acknowledgement threshold in the launcher resource test, including no acknowledgement at the former eight-second threshold.
Affected rules: Rules 26/37/49/69/70/74/77/87/90/101/102/111/112/113/116.
Affected floors: secrets — retained custody and redaction assertions; spend cap — unchanged resource and call accounting assertions; stop — no runtime change; no duplicate sends — retains two distinct reply targets and two final replies; durable intake — unchanged real journal launcher path.
Operator questions: none
Suggested tier: ordinary
Declared tier: ordinary
Tier rationale: Test-only correction of a stale injected delay; no product or model-facing changes.
Side effects: Existing desk generators refresh the changed test owner reference and register publication. Adds an 8.2-second negative case and moves the positive case to 10.2 seconds. The HTTP-delivery wait runs only when acknowledgements are due; real resource deadlines remain unchanged.
Undo and recovery: Revert this repair commit; no runtime state or migration changes.
Multi-machine posture: Machine-local disposable test state, deliberately. Production ownership, replication and admission are unchanged.
Layer below: Read the purpose and rules from origin/main in full. Checked REPLY_ACKNOWLEDGEMENT_AFTER_MS=10000, startAcknowledgement timer registration and acknowledgeReply elapsed guard; the stale fixture advanced only 8200ms. Existing real-shape timing tests cover the worker boundary.
Bug class: integration
Bug evidence: reproducer=tests/preview/journal-agent-resources.test.ts
Hook bypass: none; core.hooksPath checked unset, common hooks directory contains only sample hooks.
Convergence: none
Decision: sb-holdack4-repair-fixture-threshold | Keep the shipped ten-second behavior and repair its stale consumer fixture with explicit 0ms, 8200ms and 10200ms cases. Retain the real launcher, resource funnel, journal and HTTP sends. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/sb-holdack4-1012-repair-090654-PROGRESS.md

Decision: sb-holdack4-repair-publication | Refresh the test owner reference with the authorized desk tool and replay the register from source commit 54606eb75a1320e5254f55d3e875cc8ff07da5dd; do not hand-edit pins. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/sb-holdack4-1012-repair-090654-PROGRESS.md

## Closing block

simplestRobustRoute: This is the simplest robust route: update the existing fake-clock input and assert both sides of the timing decision. No new machinery or runtime changes. Existing timer, ready-answer cancellation, ownership, durable send and resource ceilings retain the start, completion and limit guards. No new autonomous-completion claim.
80/20: Targeted resource and acknowledgement tests, typecheck, architecture and publication checks; the Studio gate owns full-suite acceptance. Report host-dependent failures honestly without changing unrelated launchers.
VERDICT: author submission; this record asserts no independent verdict — the review desk records its own

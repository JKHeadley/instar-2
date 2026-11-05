# Change review — bounded process-control capability text

Subject base: 67c05f35de44f44b05f4314beeb8aab1079a192c
Review state: open
Reviewed content: none
Outcome: Both process-control capability descriptions fit the existing 130-character briefing bound while retaining its partial, dark, admitted and unproven qualifiers.
Affected rules: 5, 26, 37, 49, 70, 74, 78, 84, 101, 111, 113, 116.
Affected floors: secrets — no secret surface changes; spend cap — unchanged; stop — unchanged; no duplicate sends — unchanged; durable intake — unchanged.
Operator questions: none
Suggested tier: critical
Declared tier: ordinary
Tier rationale: Editorial correction to two generated metadata sentences; no executable behavior, availability or authority changes.
Side effects: The README-owned capability description is shortened from 136 to 125 characters; the process-control-kernel description is shortened from 132 to 125 characters and republished through the existing register generator. It still says dark partial support, admitted exact-process signals, durable claims, independent settlement and installed recovery unproven. The kernel description retains dark Linux-only support, pinned target identity, worker ancestry and unproven other-host/installed recovery. The existing 130-character consumer assertion is unchanged.
Undo and recovery: Revert the README line and regenerate publication; that restores the demonstrated length failure without changing runtime behavior. No migration or durable state change.
Multi-machine posture: The same source sentence is generated for every launcher; feature status and per-launcher availability are unchanged.
Layer below: scripts/register-shipped.mjs capabilityLines/capabilityBriefing reads src/effects/README.md and src/assembly/README.md; the existing register publishes it into generated/capabilities.json; tests/preview/briefing.ts and capability-briefing.test.ts consume the generated inventory.
Bug class: none
Bug evidence: Editorial metadata correction with the unchanged existing regression test: tests/preview/capability-briefing.test.ts reproduces 136 > 130 on the submitted head (one failure/eight passes), retained at /Users/dabombstudio/.instar/agents/echo/.instar/lanes/carryover-02-r4-briefing-red.log. No new test or weakened assertion.
Hook bypass: none
Convergence: none

1.x comparison: Inherits the accepted monitoring reuse at cc11e45f92e2590dd1bbd3c3facb5b849532f0fc and inspected actual main f94fb584bf7cfdfe0bcb5ff4526e88af512d145d. Additional search of src/scaffold/templates.ts, docs/specs/SESSION-TRIAGE-AGENT-SPEC.md and history 0f6078b8d, 555abc253, 9f67cfc47 finds watchdog attribution and validated triage descriptions; this repair concerns the 2.0 module-owned generated briefing length, not a lifecycle redesign. The inherited StaleSessionBackstop, StallTriageNurse and TriageOrchestrator behavior is unchanged. ONEX-LESSONS search disposition is inherited from the prior repair report.

## Closing block

simplestRobustRoute: Shorten the source sentences and use the existing generator and consumer test. No added machinery, capability restriction or change to the 130-character bound.
80/20: Two source sentences from the same length defect, generated publication and targeted verification; installed actuation and live acceptance remain the existing named dependencies, and row 02 stays open.
VERDICT: author submission; no independent verdict asserted

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
Side effects: The README-owned process-control capability description is shortened from 136 to 125 characters; the process-control-kernel description is shortened from 132 to 125 characters and republished through the existing register generator. It still says dark partial support, admitted exact-process signals, durable claims, independent settlement and installed recovery unproven. The kernel description retains dark Linux-only support, pinned target identity, worker ancestry and unproven other-host/installed recovery. The existing 130-character consumer assertion is unchanged.
Undo and recovery: Revert the README lines and regenerate publication; that restores the demonstrated length failure without changing runtime behavior. No migration or durable state change.
Multi-machine posture: The same source sentences are generated for every launcher; feature status and per-launcher availability are unchanged.
Layer below: scripts/register-shipped.mjs capabilityLines/capabilityBriefing reads src/effects/README.md and src/assembly/README.md; the existing register publishes it into generated/capabilities.json; tests/preview/briefing.ts and capability-briefing.test.ts consume the generated inventory.
Bug class: none
Bug evidence: Editorial metadata correction with the unchanged existing regression test: tests/preview/capability-briefing.test.ts reproduces 136 > 130 on the submitted head (one failure/eight passes), retained at /Users/dabombstudio/.instar/agents/echo/.instar/lanes/carryover-02-r4-briefing-red.log. No new test or weakened assertion.
Hook bypass: none
Convergence: none

1.x comparison: Inherits the accepted monitoring reuse at cc11e45f92e2590dd1bbd3c3facb5b849532f0fc and inspected actual main f94fb584bf7cfdfe0bcb5ff4526e88af512d145d. Additional search of src/scaffold/templates.ts, docs/specs/SESSION-TRIAGE-AGENT-SPEC.md and history 0f6078b8d, 555abc253, 9f67cfc47 finds watchdog attribution and validated triage descriptions; this repair concerns the 2.0 module-owned generated briefing length, not a lifecycle redesign. The inherited StaleSessionBackstop, StallTriageNurse and TriageOrchestrator behavior is unchanged. ONEX-LESSONS search disposition is inherited from the prior repair report.

Verification: The unchanged capability-briefing.test.ts first reproduced process-control 136 > 130 (eight passes/one failure), then exposed process-control-kernel 132 > 130 after the first repair (eight passes/one failure). After both source corrections and regeneration, all nine cases pass. The existing consumer test and 130 limit remain unchanged. Typecheck/build pass. Direct comparison with the submitted head proves the rendered model-facing capability note is byte-identical (sha256:60c3cee9a818c4575444a803d94e315c38eb4ddff0d50651d2d5a2e9af1ea95e), availability/status unchanged across all 90 launcher-feature rows, and all descriptions within 130. This editorial repair changes no model question, parser, acceptance or supervision path; recorded-shape recovery evidence from the preceding repair remains applicable.
Publication: Existing desk repin tools changed zero pins. Generated publication consumes source 7914158931f51e138b031939fcc4001f7d128e65, generation sha256:23e5994c626b4cf5d507ba7cb7216ef470022c34a792a88b5ba61dafaebefe3a, shape-only authority.

## Closing block

simplestRobustRoute: Shorten the source sentences and use the existing generator and consumer test. No added machinery, capability restriction or change to the 130-character bound.
80/20: Two source sentences from the same length defect, generated publication and targeted verification; installed actuation and live acceptance remain the existing named dependencies, and row 02 stays open.
VERDICT: author submission; no independent verdict asserted

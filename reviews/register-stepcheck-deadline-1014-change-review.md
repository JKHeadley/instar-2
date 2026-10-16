# Change review — extend the dark step-check graduation deadline

Subject base: d3fa88c4771b0934672c3fec1c39ae680c0336a4
Review state: open
Reviewed content: none
Outcome: Import the owning repair 6b2e645230a839b8b141dcfdab87c615f2cd6d89 unchanged in its product files, authorized by the desk on 2026-10-15 at 17:20 for PR #166. Restore register replay after the step-check deadline expired by extending the declared target exactly 72 hours to 2026-10-18T00:00:00Z, retaining dark status and the outstanding graduation obligation.
Affected rules: Rules 8, 26, 39, 49, 72, 73, 74, 90, 101, 102, 111, 113 and 116.
Affected floors: Secrets, spend cap, stop, no duplicate sends and durable intake are unchanged; this change adds no runtime authority, model calls or enabled features.
Operator questions: none
Suggested tier: ordinary
Declared tier: ordinary
Tier rationale: Bounded declaration repair through the existing promotion record and register generator; no execution or judgment logic changes.
Side effects: The existing fail-closed graduation check allows builds until the new target and still refuses at or after it. Status and documentation show the same new deadline. The feature remains dark and protects nothing until graduation is actually evidenced.
Undo and recovery: Revert the declaration and appended promotion entry together and regenerate the register; the old expired deadline will again refuse builds. Keep prior promotion history intact.
Multi-machine posture: Shared repository declaration and generated publication; all machines use the same deadline and unchanged clock comparison. No new machine-local runtime state.
Layer below: Inspected Rules 72/73, docs/02-the-register.md, checkDeadlines in src/rulegraph/graph.ts, scripts/register-owner-references.mjs fixture mapping, and the append-only promotion record. The linked step-check unit suite passes with mocked Jev outputs, but the record has no reached graduation stages and the live procedure explicitly belongs to the desk. Unit metrics do not establish live graduation.
Bug class: none
Bug evidence: none
Hook bypass: none; core.hooksPath is unset and the common hooks directory contains sample hooks only.
Convergence: none
Prompt review: The promotion record appends the owner’s deadline, reason and rollback as status metadata. These strings contain neither a fixture trigger nor an asserted dispatch answer; no model prompt or output interpretation is changed.
Decision: stepcheck-deadline-extend | step-check graduation not yet proven; deadline extended 72 h so dated gates do not block unrelated builds; graduation work tracked by the desk. Keep dark status and append reason, owner and rollback to the existing promotion record. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/register-stepcheck-deadline-1014-PROGRESS.md

Decision: owner-repair-import | Import the existing owning repair instead of writing a second fix; bind this review to the receiving branch while preserving the owner decision and its promotion history. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/const-onemind-1015-PROGRESS.md

## Closing block

simplestRobustRoute: This is the simplest robust route: change the source deadline and append its owned decision using existing mechanisms, update consuming assertions and documentation, then regenerate dependent pins and publication with the project tools. No new machinery. The existing stage-evidence requirement guards graduation; the existing strict deadline check guards the new end date. No autonomous completion or live protection is claimed.
80/20: Verify the linked step-check tests, promotion and inventory consumers, register/rulegraph tests, typecheck, architecture, lint, register replay and the desk's pinned ready tests; leave the actual graduation procedure with its recorded desk owner.
VERDICT: author submission; no independent convergence claim — the review desk records its judgment

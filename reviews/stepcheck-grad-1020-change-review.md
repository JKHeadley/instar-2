# Change review — step-check graduation checked and refused; third deadline extension

Subject base: 39d72c391905038ad7da24c51c6c0e8df5732b0f
Review state: open
Reviewed content: none
Outcome: Graduation of preview.step-check was checked against Rule 72 and refused for lack of evidence. This is the THIRD 72-hour extension (the fifth recorded deadline), from 2026-10-21T00:00:00Z to 2026-10-24T00:00:00Z. The feature stays dark. The desk with Justin closes it by running the live procedure and recording stages, or by retiring step-check.
Affected rules: Rules 8, 26, 39, 49, 72, 73, 74, 90, 101, 102, 111, 113 and 116.
Affected floors: Secrets, spend cap, stop, no duplicate sends and durable intake are unchanged; this change adds no runtime authority, model calls or enabled features.
Operator questions: none
Suggested tier: ordinary
Declared tier: ordinary
Tier rationale: Bounded declaration repair through the existing promotion record and register generator; no execution or judgment logic changes.
Side effects: The existing fail-closed graduation check allows builds until the new deadline and still refuses at or after it. Status and documentation show the same new deadline. The feature remains dark and protects nothing until graduation is actually evidenced.
Undo and recovery: Revert the declaration and the appended promotion entry together and regenerate the register; the expired deadline will again refuse builds. Keep earlier promotion history intact.
Multi-machine posture: Shared repository declaration and generated publication; all machines use the same deadline and unchanged clock comparison. No new machine-local runtime state.
Layer below: Inspected Rules 72/73, the append-only promotion record and its consumers, the preview.step-check declaration and its gate test, and the live procedure tests/preview/jev-step-supervisor-live-test.md. Graduation needs ordered stage entries (test-agent, development-agent, fleet), each naming durable evidence. Read-only scan on 2026-10-21 of every startup proof in the preview and proof-room roots under the desk's preview-trial-root: none records "stepCheck":true, so no launch has ever run with --step-check true and no stepChecks verdict can exist. The offline graduation test passes on synthetic journals only, which the record already says does not establish a stage.
Bug class: none
Bug evidence: none
Hook bypass: none; plain commits, no bypass flags.
Convergence: none
Prompt review: The promotion record appends the deadline, reason, owner and rollback as status metadata. These strings contain neither a fixture trigger nor an asserted dispatch answer; no model prompt or output interpretation is changed.
Decision: stepcheck-grad-refused-third-extension | Rule 72 graduation requires recorded stage evidence; none exists because no root ever launched with step-check on. Graduating would claim protection that was never observed (Rule 73). Extend 72 h a third time, say so plainly, and name the closing action and owner so a fourth extension is not the default. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/stepcheck-grad-1020-PROGRESS.md

Verification: Recorded in the stepcheck-grad-1020 PROGRESS report.

## ELI16

Step-check is a safety checker that is switched off. The rules say a switched-off safety feature must either prove itself and be promoted, or have a date by which it will. Its date passed again tonight, and that made every build fail. We looked for proof that it was ever switched on and tried for real. There is none: no run anywhere has turned it on. Promoting it would mean claiming a guard we never saw work, so we did not. Instead we moved the date three days out, for the third time, wrote down exactly what is missing, and named who has to do the live test (the desk with Justin) or remove the feature.

## Closing block

simplestRobustRoute: This is the simplest robust route: append one owned decision to the existing promotion record, move the declared deadline to match, update the consuming assertions and documentation, then regenerate the register with the project tool. No new machinery. Graduation stays guarded by the existing stage-evidence requirement and the new date by the existing strict deadline check.
80/20: Verify the evidence scan, the step-check, promotion and inventory tests, register/rulegraph tests, typecheck, architecture, lint, register check and the desk's pinned ready tests; leave the live graduation procedure with its named owner.
VERDICT: author submission; no independent convergence claim — the review desk records its judgment

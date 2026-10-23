# Change review — identify the two unfinished intake items

Subject base: 2c002d4dd060bdb7a7965c7bf9b18539ef98557e
Review state: open
Reviewed content: none
Outcome: Record the exact two live lifecycle shapes and demonstrate that the inherited hold repair does not complete them. The encrypted copy remained unfinished after two worker restarts. No completion or independent review convergence is claimed.
Affected rules: Purpose Rules 2 and 3; Rules 26, 33, 35, 42, 46, 49, 68, 70, 74, 101, 111, 113, 116.
Affected floors: Existing secrets, spend cap, stop, duplicate-send prevention and durable-intake behavior are unchanged. Copy verification has no external model or send transport and does not assert current audience permission.
Operator questions: none
Suggested tier: standard
Declared tier: standard
Tier rationale: Tests and lifecycle evidence only; no runtime, prompt, parser, admission, retry, timing or authority change.
Side effects: The added tests make the unresolved-reservation and persistent-unstarted-hold behavior explicit. Green tests here establish preservation and non-duplication, not successful recovery of the live questions.
Undo and recovery: Revert this evidence-only commit; no state migration or production change exists.
Multi-machine posture: Runtime ownership and replicated journal semantics are unchanged. The encrypted diagnostic copy is deliberately machine-local and has no external transports.
Layer below: Inspected reservation and unusedModel projection, drain hold eligibility, collectModel packet matching, limited reply receipt handling, and loopHealth. A limited infrastructure reply does not close the substantive turn. Missing host custody does not authorize replay of an unresolved model operation.
Bug class: durability
Bug evidence: reproducer=tests/preview/intake-survive.test.ts; restart=tests/preview/intake-survive.test.ts
Hook bypass: none
Convergence: none
Decision: lifecycle-is-not-completion | Keep both accepted inputs unfinished in the report. Neither has a normal reply intent, withdrawal, retraction or superseding edit. Existing infrastructure receipts are not substantive completion. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/intake-survive-1022t-PROGRESS.md
Prompt review: No model-facing behavior changed. Existing recorded proof-room input and answer fixtures remain in use. New tests reconstruct lifecycle metadata with proof-room content; they do not replay Justin's message text or assert that a substitute answer fulfills it.
Verification: Two actual encrypted-copy worker restarts retained unfinished=2, unansweredTurns=2, zero model calls and zero sends. The copy had no current audience verification, so that proof demonstrates preserved inhibition only. Separate fixture tests show that even after the disclosure hold becomes eligible, an unresolved reservation with missing collection stays pending; a model-not-started hold also stays pending after model availability returns. The original collection-positive, successful restart, cap, stop and unknown-send cases remain in the same targeted file.

Subject (2 paths): tests/preview/intake-survive.test.ts, tests/preview/fixtures/intake-survive-lifecycle-2026-10-22.json

## Exact observed items

- Update 969390338, accepted at 1791665150484: group disclosure refused, reserved=true, modelState absent, no answer or normal reply intent. Limited and holding-notice receipts exist. An original matching host result or reliable outcome reconciliation is needed; age or a cleared disclosure hold is not permission to rerun an unknown operation.
- Update 969390553, accepted at 1792254040462: model not started, reserved=false, modelState absent, no answer or normal reply intent. A limited receipt exists. The current drain keeps this hold across restarts, including when the model port becomes available. No recorded cancellation establishes that the substantive input is no longer owed.

## Closing block

simplestRobustRoute: Use the existing read-only live status command, an encrypted journal copy, and the existing worker's restart and collection paths. Preserve actual unknowns and held inputs rather than invent completion or authorization. No new recovery machinery is proposed. Existing audience, stop, budget and effect-uniqueness guards remain in force. The unattended completion exit test did not pass.
80/20: Exact attribution closes the previous evidence gap and reveals two distinct remaining states. This evidence-only change does not claim to repair them. The desk report names the missing recovery work and the copy's verification limit.
VERDICT: author submission; unresolved live completion, no independent verdict

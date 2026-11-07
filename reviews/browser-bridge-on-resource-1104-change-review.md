# Change review — browser bridge on current live resource recovery

Subject base: 47b9c8234e85856ca3aeee322927621139af4342
Review state: open
Reviewed content: none
Outcome: Merge the independently reviewed bounded owner GitHub read sequence onto the answering resource-recovery build, retaining its worker-slot repair. The only merge conflicts were generated register outputs; regenerate those against the merged source commit. The later connector file ACL and Claude-compatible MCP schema repairs are reviewed separately in browser-mcp-worker-read-1104-change-review.md; this combined record covers the updated exact content.
Integration review (train-169, carried from its Outcome line): Reopened for train-169 because register regeneration changes frozen outputs. Preserve the original bounded owner GitHub read and resource recovery, the later connector file ACL and Claude-compatible MCP schema repairs reviewed in browser-mcp-worker-read-1104-change-review.md, and carryover-08 session recovery reviewed in carryover-08-accepted-question-restart-1104-change-review.md and carryover-08-full-parity-1104-change-review.md. Independent combined review is required again.
Integration outcome (train-171): Merge the independently reviewed bounded owner GitHub read sequence onto the answering resource-recovery build, retaining its worker-slot repair. The later connector file ACL and Claude-compatible MCP schema repairs remain covered by browser-mcp-worker-read-1104-change-review.md. Reopen this combined record because the send-contract merge and regenerated outputs change its frozen subject; no new convergence is claimed.
Affected rules: 109, 1, 4, 18, 28, 34, 36, 42, 44, 49, 55, 57, 60, 61, 62, 63, 66, 74, 78, 84, 95, 100, 101, 103, 111, 113, 116
Affected floors: secrets — owner-side fixed DOM projection and scrub stay in place; spend cap — no model budget change; stop — the same claim and deadline bound every read; no duplicate sends — read-only operation admits no send or write; durable intake — existing effect preparation and exact grant remain prerequisites.
Operator questions: none
Suggested tier: critical
Declared tier: critical
Tier rationale: The combined browser and live worker paths touch protected task execution and require an exact-head full gate and live proof.
Side effects: The configured agent-owned Chrome tab can navigate through two to four named GitHub pages. The worker receives bounded observations, not profile custody. The resource-owner recovery remains as in the live build.
Undo and recovery: Restore live 47b9c823 if the combined build fails. Retain prepared and uncertain effect records; do not replay an uncertain identity.
Multi-machine posture: Owner browser stays local to its signed-in profile; worker remains separate. No new remote credential or browser fallback.
Layer below: Original parent comparison found only generated conflicts and retained reviewed 24194ed8 browser source with live 47b9c823 resource-owner behavior. Later connector repairs and carryover-08 session-driver changes are covered by their separate exact-head records; train-169 preserves both, without claiming those later sources remain byte-identical to the original parents.
1.x reference: Reuses the PID-addressed Chrome Apple Event and active-tab behavior in 1.x `src/core/PlainChromeReloginBrowser.ts` and `src/templates/scripts/browser/chrome-js.sh`, and dead-holder recovery from `src/core/hostTestRunnerSemaphore.ts`. The 2.0 owner bridge keeps profile custody on the owner side and adds only bounded named-page sequencing; its resource recovery also requires a descendant census before returning worker capacity. This does not claim general 1.x browser parity before the real multi-step group task.
Bug class: none
Bug evidence: none
Hook bypass: none
Convergence: none
Prompt review: no prompt or model dispatch change. Reopening this record expands its historical subject across the helper unit; the existing helper dispositions below cover unchanged prompt literals in that subject.
Prompt finding: 0725f0150c56 | protocol-literal | The regression normalizes the existing role/refusal prologue for historical packet and digest comparison; no semantic gate keys on this phrase; unchanged by this change.
Prompt finding: 27d7720e7977 | protocol-literal | The existing memory-record boundary delimits the intentionally changed prologue in historical byte comparison; it is not a model decision trigger; unchanged by this change.
Prompt finding: 4106b49fff07 | protocol-literal | Existing unchanged protocol/status text asserted by tests; no new keyword intent decision.
Prompt finding: 849db3a6296a | protocol-literal | an existing fixed reply literal in journal.ts, unchanged by this change
Prompt finding: 85544c20941f | protocol-literal | Existing fixed queued-message notice, unchanged by this change; its test checks the actual notice, not a semantic trigger.
Prompt finding: e8708c7fea24 | protocol-literal | Existing unchanged protocol/status text asserted by tests; no new keyword intent decision.
Skip: tests/preview/session-connectors.test.ts:60 | scope=the worker-account check requires a macOS harness host with passwordless sudo; cross-platform cases run elsewhere.
Deferral: generated/register.json:1 | not-a-deferral=generated source hash was regenerated from the merged commit; the original branch's separate missing Part Two authority is unchanged and remains open.

Decision: BROWSER-MERGE-1104-1 | Merge reviewed 24194ed8 onto live 47b9c823; retain live generated output only for the merge commit, then regenerate all seven outputs from that exact merged source. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/carryover-08-accepted-question-restart-1104-PROGRESS.md
Decision: BROWSER-MERGE-1104-2 | Reopen the copied resource-recovery review whose generated-register subject changed in the combination; cover the exact combined content here and require independent review again before release. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/carryover-08-accepted-question-restart-1104-PROGRESS.md

Publication re-review: Normal open voided the frozen round after snapshot-parser source and generated pins changed the subject. Historical reviewed digest sha256:094316dfd656ab51b6d7663e4bd9207c62d4593c8a3e743493d748b4dfe47228; current publication digest sha256:7268e07601ae3ae92e6cd9803ec332a9ae5a5ce99c97a147daf20f1cd918db1e. Independent re-review is required; this reopening records no approval.
Integration review: train-168 explicitly reopens this round because its combined register changes the covered generated files. The previous frozen content and verdict remain in git history. reviews/train-168-change-review.md covers the merged candidate, whose desk review is still required.

## Repair scope

The later carryover commits and register replay changed this record's frozen subject. This round is explicitly reopened; its old frozen digest and review remain in git history. This does not claim renewed browser convergence. The present change only repairs native certification and register evidence; independent review must judge the changed subject.

The reopened subject now also contains the carried commitment module text. The following dispositions reuse the carryover review after checking the current lines: logs, existing persistence states, test text and unchanged journal instructions; they create no deferred task or new prompt rule.

Deferral: src/commitments/CheckInReminderReconciler.ts:126 | not-a-deferral=a log line naming rows the bounded pass leaves for the next pass, which the durable due list picks up
Deferral: src/commitments/CommitmentTracker.ts:63 | not-a-deferral=the CMT-xxx id format in a comment
Deferral: src/commitments/CommitmentTracker.ts:193 | not-a-deferral=a comment describing a counted follow-up field
Deferral: src/commitments/CommitmentTracker.ts:542 | not-a-deferral=a comment describing the carried auto-expiry deferred window
Deferral: src/commitments/CommitmentTracker.ts:2160 | not-a-deferral=the persistence state name 'deferred'
Deferral: src/commitments/CommitmentTracker.ts:2161 | not-a-deferral=the persistence state name 'deferred'
Deferral: src/commitments/CommitmentTracker.ts:2259 | not-a-deferral=a carried comment about a 1.x sweep; that sweep is not carried
Deferral: src/commitments/CommitmentTracker.ts:2403 | not-a-deferral=the persistence state name 'deferred'
Deferral: src/commitments/CommitmentTracker.ts:2410 | not-a-deferral=the persistence state name 'deferred'
Deferral: src/commitments/LlmQueue.ts:198 | not-a-deferral=a comment on the dispatch gap of the queue
Deferral: src/commitments/PromiseBeacon.ts:735 | not-a-deferral=a comment on the election verdict
Deferral: src/commitments/PromiseBeacon.ts:926 | not-a-deferral=fixed status text when a line could not be fetched
Deferral: src/commitments/PromiseBeacon.ts:1118 | not-a-deferral=fixed close-out text quoting the promise
Deferral: tests/commitments/1x/CommitmentTracker-auto-expiry.test.ts:107 | not-a-deferral=fixture text
Deferral: tests/commitments/1x/CommitmentTracker-auto-expiry.test.ts:244 | not-a-deferral=fixture text
Deferral: tests/commitments/1x/CommitmentTracker.test.ts:73 | not-a-deferral=a test title naming the id format
Deferral: tests/commitments/1x/check-in-reminder-reconciler.test.ts:271 | not-a-deferral=a test title for the bounded pass
Deferral: tests/commitments/1x/check-in-reminder-reconciler.test.ts:282 | not-a-deferral=a test title for the bounded pass
Prompt finding: 4106b49fff07 | protocol-literal | existing journal.ts text this change did not edit; the diff of that file from the subject base has no line containing it
Prompt finding: 85544c20941f | protocol-literal | existing journal.ts text this change did not edit; the diff of that file from the subject base has no line containing it
Prompt finding: e8708c7fea24 | protocol-literal | existing journal.ts text this change did not edit; the diff of that file from the subject base has no line containing it
Prompt finding: 849db3a6296a | protocol-literal | existing journal.ts text this change did not edit; the diff of that file from the subject base has no line containing it

## Rule109 reopening for whole row07 publication

The existing checker open command voided the prior frozen round. Prior frozen content: sha256:094316dfd656ab51b6d7663e4bd9207c62d4593c8a3e743493d748b4dfe47228. Current digest of that original 18-path subject at row07 head bfcc640b9149465c1a7d6af307fb69ccbde63cbe: sha256:6fe1b062060881c981604764498aee28a66d35539adb8c87c5d18edf186040c3. Original record last edit: b5806d1e015dc650cdc1dee2e0accab05a849d4b. Those hashes and Git history remain evidence; neither is a new approval.

The original browser subject changed through generated register publication inherited by row07, while its browser implementation remains unchanged. Whole row07 behavior is covered separately by carryover-07-whole-parity-r2-1105-change-review.md. Current review state is open; independent review and combined qualification remain required. No frozen content was silently relabelled accepted.

Deferral: tests/preview/journal-conversation-session.test.ts:448 | not-a-deferral=The inherited row07 test advances an injected clock to the existing queued-delivery retry deadline; it defers no implementation. Whole row07 behavior remains covered by its own critical review record.


Overlap disposition: The frozen binding sha256:094316dfd656ab51b6d7663e4bd9207c62d4593c8a3e743493d748b4dfe47228 is void. Carryover row 16 changed tests/preview/admission-gate.mjs to settle an exact delegated tool failure, and its repair regenerates dependent register publication. Browser custody, bounded reads and grants are unchanged. The narrow overlap is covered by the helper repair submission; this open record claims no renewed independent browser verdict. Historical review evidence is retained.

## Closing block

simplestRobustRoute: Reuse the existing owner read bridge with explicit page scope and the live resource recovery, under the same grant and custody boundary.
80/20: The two browser test files and register lifecycle test passed 31/31 on the combined branch. Full exact-head suite, independent combination review and a real signed-in multi-step group task remain required before release. No new browser service or credential custody path.
VERDICT: author submission; this record asserts no independent verdict.

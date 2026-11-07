# Change review — worker reads connector launch configuration

Subject base: bcbe1def1642146c18f1e0d569ab84016fa6454e
Review state: open
Reviewed content: none
Outcome: Grant the worker read access to the generated MCP launch configuration before its continuing session starts and expose the owner browser tool with an Anthropic-compatible input schema. Keep the configuration owned by the operator and read-only to the worker. Regenerate the source-pinned register against the committed repair.
Integration review (train-169, carried from its Outcome line): Reopened by train-169 because combined-source register regeneration changes the previously frozen generated outputs; the original connector ACL and schema repair source remains unchanged. Independent review of the combination is required. Original outcome: grant the worker read access to the generated MCP launch configuration before its continuing session starts and expose the owner browser tool with an Anthropic-compatible input schema. Keep the configuration owned by the operator and read-only to the worker. Regenerate the source-pinned register against the committed repair.
Integration outcome (train-171): Grant the worker read access to the generated MCP launch configuration before its continuing session starts and expose the owner browser tool with an Anthropic-compatible input schema. Keep the configuration owned by the operator and read-only to the worker. Regenerate the source-pinned register against the committed repair. Reopened for train-171 because its combined source and regenerated publication change this record's subject; the prior frozen round remains in history and no new convergence is claimed.
Affected rules: 109, 31, 63, 74, 78, 95, 101, 103, 111, 113, 116
Affected floors: secrets — only the already redacted launch file is readable, not credential custody; spend cap — unchanged; stop — unchanged; no duplicate sends — no new effect path; durable intake — unchanged.
Operator questions: none
Suggested tier: significant
Declared tier: significant
Tier rationale: This repairs a worker account access boundary used by the signed-in browser connector. It requires a real worker-account test, full exact-head gate, independent review, and copy trial before live use.
Side effects: The harness worker can read the generated MCP launch file for its own session. It cannot edit that file or read the owner browser profile.
Undo and recovery: Keep live 47b9c823 serving until the corrected build proves a real signed-in multi-step browser task. Restore that live build if the later switch fails.
Multi-machine posture: This is the existing macOS harness account ACL on the local generated file; no remote credential or profile copy.
Layer below: A real copy produced an MCP file with owner_github but the worker account could not read it. The adjacent admission file was readable. The added test uses sudo as the worker to read the exact launch file and fails when the ACL line is removed. After that repair, a second real copy reached Claude but its MCP log said it skipped observe because the schema used top-level oneOf. The server already checks the exact page/pages request. The native client test now rejects top-level oneOf, and a real copy must show the tool and complete the signed-in two-page task. The seven generated register files changed only to pin the new committed source and its derived digest.
1.x reference: A 1.x session runs as the machine owner and can read its own browser connector configuration. The separate 2.0 worker account needs this narrow read grant to reach the same connector.
Bug class: live-path
Bug evidence: reproducer=tests/preview/session-connectors.test.ts; live=/Users/Shared/instar-harness/profile/home/Library/Caches/claude-cli-nodejs/-private-tmp-its-7c0e567ee5f5/mcp-logs-owner-github/2026-11-05T00-00-27-432Z.jsonl
Hook bypass: none
Convergence: none
Prompt review: no prompt or model dispatch change. Reopening this record expands its historical subject across the helper unit; the existing helper dispositions below cover unchanged prompt literals in that subject.
Prompt finding: 0725f0150c56 | protocol-literal | The regression normalizes the existing role/refusal prologue for historical packet and digest comparison; no semantic gate keys on this phrase; unchanged by this change.
Prompt finding: 27d7720e7977 | protocol-literal | The existing memory-record boundary delimits the intentionally changed prologue in historical byte comparison; it is not a model decision trigger; unchanged by this change.
Prompt finding: 4106b49fff07 | protocol-literal | Existing unchanged protocol/status text asserted by tests; no new keyword intent decision.
Prompt finding: 849db3a6296a | protocol-literal | an existing fixed reply literal in journal.ts, unchanged by this change
Prompt finding: 85544c20941f | protocol-literal | Existing fixed queued-message notice, unchanged by this change; its test checks the actual notice, not a semantic trigger.
Prompt finding: e8708c7fea24 | protocol-literal | Existing unchanged protocol/status text asserted by tests; no new keyword intent decision.
Skip: tests/preview/session-connectors.test.ts:60 | scope=the native worker-account check applies only to the macOS harness host with passwordless sudo; other hosts run the cross-platform connector cases.

Decision: MCP-READ-1104-1 | Grant read-only ACL only on the generated MCP file at launch, rather than giving the worker access to the owner profile or shared temp directory. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/SEAM-LEDGER.md
Decision: MCP-READ-1104-2 | Commit the source repair before regenerating source-pinned register outputs, then cover both commits in this record. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/SEAM-LEDGER.md
Decision: MCP-SCHEMA-1104-3 | Remove top-level oneOf from the client-advertised input schema because Claude skipped the only tool; retain the existing server-side input validation. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/SEAM-LEDGER.md

Publication re-review: Normal open voided the frozen round after snapshot-parser source and generated pins changed the subject. Historical reviewed digest sha256:41339ecebaa3eebf3d3a09bcb98108b0bdb289e724fb0bd3514a7e0c7431d0cc; current publication digest sha256:100fab9cebe17ce086c2f7a78ed6fa89b79c7b66168daa1c907c5d659b51cd4f. Independent re-review is required; this reopening records no approval.
Integration review: train-168 explicitly reopens this round because its combined register changes the covered generated files. The previous frozen content and verdict remain in git history. reviews/train-168-change-review.md covers the merged candidate, whose desk review is still required.
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
Deferral: generated/register.json:1 | not-a-deferral=generated source hash was regenerated from the merged commit; the original branch's separate missing Part Two authority is unchanged and remains open.

## Rule109 reopening for whole row07 publication

The existing checker open command voided the prior frozen round. Prior frozen content: sha256:41339ecebaa3eebf3d3a09bcb98108b0bdb289e724fb0bd3514a7e0c7431d0cc. Current digest of that original 12-path subject at row07 head bfcc640b9149465c1a7d6af307fb69ccbde63cbe: sha256:c5cdfb3cc4b17fd7dd47aa840655d3104e31d26ef0bc4303854e82ed3f42c441. Original record last edit: b5806d1e015dc650cdc1dee2e0accab05a849d4b. Those hashes and Git history remain evidence; neither is a new approval.

The original browser subject changed through generated register publication inherited by row07, while its browser implementation remains unchanged. Whole row07 behavior is covered separately by carryover-07-whole-parity-r2-1105-change-review.md. Current review state is open; independent review and combined qualification remain required. No frozen content was silently relabelled accepted.

Deferral: tests/preview/journal-conversation-session.test.ts:448 | not-a-deferral=The inherited row07 test advances an injected clock to the existing queued-delivery retry deadline; it defers no implementation. Whole row07 behavior remains covered by its own critical review record.

Overlap disposition: The frozen binding sha256:41339ecebaa3eebf3d3a09bcb98108b0bdb289e724fb0bd3514a7e0c7431d0cc is void because the helper-failure repair regenerated its seven register publication files. Connector ACL and schema source bytes remain unchanged. Publication is covered by reviews/carryover-16-helper-failure-1104-repair-change-review.md; this open record asserts no renewed independent acceptance.

## Closing block

simplestRobustRoute: Use the existing harness ACL helper on the one generated file before a continuing session launches.
80/20: The worker can load the connector without changing owner profile custody. Real signed-in page reads still need copy proof before live release.
VERDICT: author submission; this record asserts no independent verdict.

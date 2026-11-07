# Change review — worker reads connector launch configuration

Subject base: bcbe1def1642146c18f1e0d569ab84016fa6454e
Review state: open
Reviewed content: none
Outcome: Grant the worker read access to the generated MCP launch configuration before its continuing session starts and expose the owner browser tool with an Anthropic-compatible input schema. Keep the configuration owned by the operator and read-only to the worker. Regenerate the source-pinned register against the committed repair.
Integration review (train-169, carried from its Outcome line): Reopened by train-169 because combined-source register regeneration changes the previously frozen generated outputs; the original connector ACL and schema repair source remains unchanged. Independent review of the combination is required. Original outcome: grant the worker read access to the generated MCP launch configuration before its continuing session starts and expose the owner browser tool with an Anthropic-compatible input schema. Keep the configuration owned by the operator and read-only to the worker. Regenerate the source-pinned register against the committed repair.
Affected rules: 109, 31, 63, 74, 78, 95, 101, 103, 111, 113, 116
Affected floors: secrets — only the already redacted launch file is readable, not credential custody; spend cap — unchanged; stop — unchanged; no duplicate sends — no new effect path; durable intake — unchanged.
Operator questions: none
Suggested tier: significant
Declared tier: significant
Tier rationale: This repairs a worker account access boundary used by the signed-in browser connector. It requires a real worker-account test, full exact-head gate, independent review, and copy trial before live use.
Side effects: The harness worker can read the generated MCP launch file for its own session. It cannot edit that file or read the owner browser profile. The reply-review-proof-accounting-1105 candidate changes shared generated register bytes, so this frozen round is void; the accounting repair is covered by its own change review and requires independent review before release.
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

Overlap disposition: The frozen binding sha256:41339ecebaa3eebf3d3a09bcb98108b0bdb289e724fb0bd3514a7e0c7431d0cc is void because the helper-failure repair regenerated its seven register publication files. Connector ACL and schema source bytes remain unchanged. Publication is covered by reviews/carryover-16-helper-failure-1104-repair-change-review.md; this open record asserts no renewed independent acceptance.
Publication re-review: Normal open voided the frozen round after snapshot-parser source and generated pins changed the subject. Historical reviewed digest sha256:41339ecebaa3eebf3d3a09bcb98108b0bdb289e724fb0bd3514a7e0c7431d0cc; current publication digest sha256:100fab9cebe17ce086c2f7a78ed6fa89b79c7b66168daa1c907c5d659b51cd4f. Independent re-review is required; this reopening records no approval.
Integration review: train-168 explicitly reopens this round because its combined register changes the covered generated files. The previous frozen content and verdict remain in git history. reviews/train-168-change-review.md covers the merged candidate, whose desk review is still required.
Integration review: train-192 explicitly reopens this round because its register replay at the merged head 84d7bb0768f456fb3b38eb5df7dccf31e97bad03 regenerates the seven generated/ outputs (generated/capabilities.json, capabilities.md, coverage.md, glossary.md, register.json, rules.md and source.json), which this record's subject covers (Rule 109); no source, test, document or declaration in the subject changed, and the reviewed content cannot be restored because the publication must be true to the merged head. The previous frozen content and verdict remain in git history. reviews/train-192-change-review.md covers the merged candidate (decision train-192-review-rounds), whose desk review is still required.

Deferral: docs/evidence/train-192-notice-owner/constitution-attributed-statements-change-review.md:29 | not-a-deferral=Copied historical review evidence quotes the old deferred:slack-intake-v1:36 deadline refusal; this integration preserves that evidence verbatim and makes no new deferral. Current register verification passes.
Deferral: docs/evidence/train-192-notice-owner/constitution-one-constitution-change-review.md:30 | not-a-deferral=Copied historical review evidence quotes the old deferred:slack-intake-v1:36 deadline refusal; this integration preserves that evidence verbatim and makes no new deferral. Current register verification passes.
Deferral: docs/evidence/train-192-notice-owner/constitution-person-decides-change-review.md:29 | not-a-deferral=Copied historical review evidence quotes the old deferred:slack-intake-v1:36 deadline refusal; this integration preserves that evidence verbatim and makes no new deferral. Current register verification passes.

## Closing block

simplestRobustRoute: Use the existing harness ACL helper on the one generated file before a continuing session launches.
80/20: The worker can load the connector without changing owner profile custody. Real signed-in page reads still need copy proof before live release.
VERDICT: author submission; this record asserts no independent verdict.

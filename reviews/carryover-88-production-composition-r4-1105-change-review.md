# Change review — Carryover 88 bounded hub invocation and independent tracking transport

Subject base: dc4cdaf483e926a3b22246b9fe86f55ab57954bc
Review state: open
Reviewed content: none
Outcome: Connect the copied hub classifier and brief to the existing recorded subscription doorway and journal call accounting; add the independent surface read transport using existing private service custody. Whole row 88 remains incomplete: canonical production delegated Run/Threadline custody, conversation-topic binding, and complete producer/commitment parity remain source work.
Affected rules: 1, 4, 7, 10, 12, 14, 28, 31, 32, 36, 41, 46, 49, 52, 53, 57, 63, 67, 74, 75, 79, 81, 87, 95, 101, 102, 105, 113, 114, 115, 116, 119, 120
Affected floors: secrets — existing credential custody, prompt concealment, copied secret regex and outbound guard; spend cap — durable bounded invocation reservations with lost outcomes retained; stop — current owner, peer, grant and stop checks before dispatch; no duplicate sends — existing dispatch fence and immutable identities; durable intake — exact tracking requests and signed acts retained in existing operator storage
Operator questions: none
Suggested tier: critical
Declared tier: critical
Tier rationale: Changes model invocation bounds and independent authenticated tracking transport; exact source review and installed acceptance remain necessary.
Side effects: Opt-in reads from fixed private service namespaces and bounded hub classification calls on verified operator turns in the confirmed hub. No install, authority, keys, credentials, live roots or grants were changed.
Undo and recovery: Revert source before installation. Keep encrypted journal and operator request/act history; a charged or dispatched unknown operation must not be retried under a new identity. Older builds do not understand the added collaboration model rows, so retain the current reader for any journal that has written them.
Multi-machine posture: Portable optional transport separates the request source and signed-act source. Isolated physical HTTP fixture loses all owner endpoint access, restarts the independent consumer with no mounted owner outbox and drains once after recovery. It does not establish TLS, actual independent machine installation, actual service standing or live usefulness.
Layer below: Extend existing subscription provider owners, journal token accounting, PIN/CSRF operator boundary and passkey owner store. No new journal writer, run authority, grant, profile or execution approval. Current main ef4a964232b7baf17d8fc4cf1b8a248a95b6d513 was ordinarily merged in 380a9bd8b5beb2fa8c0e3601cde4cc366829ba0a.
Bug class: none
Bug evidence: none
Hook bypass: none
Convergence: none
<!-- Rule 102: record each mid-run engineering decision as a line: Decision: <id> | <what was decided, and why> | reported=<report that names the id> -->
Prompt review: Copied 1.x prompts, parser, confidence threshold, context limits and stronger secret regex remain unchanged. The existing runner-task envelope wraps the exact question; six genuine captured raw responses are replayed through the new reservation route and binding consumer. The envelope is a new composition, not a claim the old captures were produced by this new installation.
Prompt finding: 0d4664ea9de7 | protocol-literal | Existing unchanged protocol/grounding wording; no fixture verdict is added to a prompt.
Prompt finding: 14d7eeccc218 | protocol-literal | Existing unchanged protocol/grounding wording; no fixture verdict is added to a prompt.
Prompt finding: 38a2c5d186f1 | protocol-literal | Existing unchanged protocol/grounding wording; no fixture verdict is added to a prompt.
Prompt finding: 4106b49fff07 | protocol-literal | Existing unchanged protocol/grounding wording; no fixture verdict is added to a prompt.
Prompt finding: 42faf877ba82 | protocol-literal | Existing unchanged protocol/grounding wording; no fixture verdict is added to a prompt.
Prompt finding: 45e37ea2e9e9 | protocol-literal | Existing unchanged protocol/grounding wording; no fixture verdict is added to a prompt.
Prompt finding: 7a4f0c3f557c | protocol-literal | Existing unchanged protocol/grounding wording; no fixture verdict is added to a prompt.
Prompt finding: 849db3a6296a | protocol-literal | Existing unchanged protocol/grounding wording; no fixture verdict is added to a prompt.
Prompt finding: 85544c20941f | protocol-literal | Existing unchanged protocol/grounding wording; no fixture verdict is added to a prompt.
Prompt finding: 9781075d458e | protocol-literal | Existing unchanged protocol/grounding wording; no fixture verdict is added to a prompt.
Prompt finding: b1bb3946362d | protocol-literal | Existing unchanged protocol/grounding wording; no fixture verdict is added to a prompt.
Prompt finding: e8708c7fea24 | protocol-literal | Existing unchanged protocol/grounding wording; no fixture verdict is added to a prompt.

Subject (38 paths): .github/workflows/document-checks.yml, docs/01-the-rules.changelog.json, docs/01-the-rules.changelog.md, docs/01-the-rules.md, generated/capabilities.json, generated/capabilities.md, generated/conversion.json, generated/coverage.md, generated/glossary.md, generated/register.json, generated/rules.md, generated/source.json, register-source/bootstrap-anchor.json, scripts/approval-surface-transport.mjs, scripts/approval-surface.mjs, scripts/build-register.mjs, scripts/check-constitution-pairing.d.mts, scripts/check-constitution-pairing.mjs, src/assembly/production-codex-provider.ts, src/assembly/production-provider.ts, tests/assembly/production-codex-provider.test.ts, tests/assembly/production-provider-subscription.test.ts, tests/e2e/register.test.ts, tests/preview/README.md, tests/preview/approval-surface-client.mjs, tests/preview/approval-surface-transport.test.ts, tests/preview/approval-surface.test.ts, tests/preview/attention-surface.ts, tests/preview/collaboration-hub.ts, tests/preview/hub-model-route.test.ts, tests/preview/hub-model-route.ts, tests/preview/hub-recorded.test.ts, tests/preview/journal-agent.mjs, tests/preview/journal-envelope.ts, tests/preview/journal.ts, tests/preview/model-call-boundary.test.ts, tests/preview/model-call-boundary.ts, tests/register/constitution-pairing.test.ts


1.x comparison: actual JKHeadley/instar origin/main 555abc253e946dde9c5e53d3fcb7c3e3ade98af9, searched in src/, docs/specs/ and git history before implementation. Reused existing adapted src/threadline/CollaborationSurfacer.ts silent single-hub/parent exclusion/first-contact and housekeeping behavior, HubIntentClassifier.ts exact prompt/greedy fenced-JSON parser/0.85 threshold/6 x 400 context/40 topics/200 tokens/4000 ms, and openConversationBrief.ts PURPOSE parser/10 x 800 context/320 tokens/15000 ms/per-field secret fallback. The inherited copied baseline d5b30b1d7c059da68483caf15d7584aec0d7a325 and capture baseline fdcbf4e6aff46fae443e6dca626f0e94bff997e6 remain separately named. History inspected: 7e8fde8e8 topic-name propagation, 615a7fa6c stronger secret formats, 2eb1e3bd0 maturation. Matching ONEX-LESSONS delivery, ownership, commitments, resources and production assembly areas informed the comparison. Actual src/server/fileRoutes.ts at the current revision supplies the GET /api/files/read response shape and normalized relative path; no service write API is used. The durable 2.0 journal retains history across compaction/restart, unlike the original per-feature local store and eviction. Exact prompts and all six capture hashes are verified by hub-recorded.test.ts.

Commitment source located: src/monitoring/CommitmentTracker.ts and src/threadline/hubCommands.ts in actual 1.x; existing 2.0 owner src/rungraph/promises.ts, consumed in tests/preview/journal.ts, with registry evidence 48f55d9cbd2bd807bdc52489d07aa1fca9c9731d. No absence was inferred from a nonexistent src/commitments directory. The Threadline-to-commitment association is not implemented in this submission.

Bound semantics: activation policy remains unchanged and maximum-bounded. Claude receives the narrowed answer allowance plus its existing thinking budget, and the terminal reader rejects answer usage above that allowance. Codex validates observed output against the narrowed allowance; it does not claim provider generation stopped at that count. Both preflights and model command share the deadline. A missing result retains reserved usage UNKNOWN. The journal host passes the existing configured model through its standing; it does not silently select a new provider/model to satisfy the 1.x fast hint.

Remaining source chain: authenticated Threadline ingress → Four intake → canonical Five delegated Run owner → Six live lease/reservation → worker/terminal exit → conversationTopics routing → all attention/channel producers and commitment binding. The RunGraph root-only decoder and absence of a production DelegatedRunAuthority were traced in src/rungraph/service.ts, records.ts, types.ts, agent-transport.ts, delegation.ts, src/transport/run-admission.ts and src/assembly/production-composition.ts. Those are implementation gaps, not an asserted need for new operator permission. No fixture createNetwork authority was installed. Current journal-agent hub command wiring cannot make an absent Threadline source produce live conversations.

Decision: AQ88-r4-canonical-composition | Retain incomplete source status; no fixture or callback grants delegated Run authority. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/carryover-88-production-composition-r4-1105-PROGRESS.md
Decision: AQ88-r4-main-alignment | Ordinarily merge current 120-rule main and regenerate publication without hand pins. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/carryover-88-production-composition-r4-1105-PROGRESS.md
Decision: AQ88-r4-bounded-invocation | Use real existing provider bounds and retain reservations after loss; expose narrower model judgments under current standing. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/carryover-88-production-composition-r4-1105-PROGRESS.md
Decision: AQ88-r4-independent-transport | Read fixed authenticated namespaces and preserve exact owner-issued passkey requests/acts; installation remains separately reviewed. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/carryover-88-production-composition-r4-1105-PROGRESS.md



Decision: AQ88-r4-combined-anchor | Reuse c23e892d0601d29c2fc5f6f6810a8fb247ca698d because both anchor and shape are byte-identical to this combined tree. Ordinary cherry-pick 5ff66e749cebfc4d215441747e23751e89df8041, then normal current-source replay; no hand pin. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/carryover-88-production-composition-r4-1105-PROGRESS.md
Publication: source 5ff66e749cebfc4d215441747e23751e89df8041; generation sha256:5d294a10a3eb07d200634cf610184eced5737841c7bfd810134b5d914a8a2f1d; 299 entries, 120 rules, 34 terms, 48 warnings, 112 prerequisites. Shape-only replay grants no runtime authority. Native macOS certificate remains unchanged and requires the desk's actual contract run.
Verification checkpoint: 134 complete provider tests, 8 physical hub tests, 2 installed attention tests, 14 final surface/transport tests, 32 hub/model-boundary/capture tests passed. Build and typecheck passed. Six genuine private corpus cases and the existing provider recorded-shape replay were used without provider calls. Earlier failed runs and the unchanged capability-text failure are preserved in the desk progress; final check results are recorded there.

The subject base includes the ordinary main-alignment merge, not just the subsequent source edits. Final typecheck covers the new transport-test JS boundaries using the same precise annotations as the existing JavaScript surface tests.

## Closing block

simplestRobustRoute: Use one recorded model boundary and existing journal reservations, and fixed reads through the existing private file API. Cache exact owner-issued requests in the existing operator store; verify passkey acts against the owner challenge on return. A batch-wide deadline bounds offline service waits.
80/20: Targeted changed-file and consumer tests, real recorded replay, physical isolated endpoints, no broad sweep. Preserve the previous 44 unresolved and 101 unfinished files plus five r3 failures, without attributing them to the separate row07 dash/ulimit cause.
VERDICT: author submission only; incomplete whole feature, no independent verdict or release acceptance asserted

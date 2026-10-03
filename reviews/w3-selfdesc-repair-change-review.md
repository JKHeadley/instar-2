# Change review — w3-selfdesc repair: combine the repaired tools unit and replay the self-description review on the route-true tools packet

Subject base: b2cd2382118935374ab0b9f3595cfa1399bf572f
Review state: open
Reviewed content: none
Outcome: Repairs the w3-selfdesc unit review (Astra, VERDICT NO, four must-fix findings, all carried forward from w4-toolsreal). Merges origin/w4-toolsreal 615af0c7, whose own repair (reviews/w4-toolsreal-repair-change-review.md) bounds Bash reads to the workspace by default, allocates tool-call slots atomically, gives shell scratch a fixed-size store, removes keyword blocking and derives capability/attempt facts from the effective route; the merge had no conflict and the self-description guide clause is unchanged. The earlier tools-positive self-description review (call 6) ran on a packet that still said externalTools none, so two new recorded real reviews (calls 7 and 8, claude-sonnet-5) use exactly what the journal now derives for a tools-route answer: previewCapabilities(true), governingConstraints(true), OBLIGATION_DECISION_TOOLS and an empty toolAttempts record. The description passes all three rules; declining asked work is still unrecorded_blocker. tests/preview/selfdesc-limits.test.ts pins those inputs to the code, so a stale no-tools packet fails the test.
Affected rules: 1 and 57 (scope boundary, via the merged dependency repair), 20, 45, 78 and 84 (route-true capability evidence reaches the reviewer; the generated briefing's limits reach the operator), 21 and 99 (declining asked work still needs its record, proven on the tools route), 34 and 36 (recorded real outputs replayed, inputs committed beside them), 60 (atomic call slots and finite scratch, via the merged repair), 74 and 111 (this record), 101 (no hook bypass), 116 (no new machinery: a merge, two recorded calls and one test)
Affected floors: secrets — strengthened by the merged default-deny read scope; this change adds no secret handling; the committed review inputs were checked for credential patterns; spend cap — two review-time model calls were made by the author (about $0.10), none in the product path; stop — unchanged; no duplicate sends — unchanged; durable intake — strengthened by the merged fixed-size scratch store, which cannot consume the journal volume
Operator questions: none
Suggested tier: critical
Declared tier: critical
Tier rationale: it combines a reply-review gate change with the tools route's scope, counter and storage boundaries.
Side effects: everything the merged w4-toolsreal repair changes (see its record); this change itself adds only test fixtures and one test case. No product code is edited beyond the merge.
Undo and recovery: revert the fixture/test commit and the merge commit (git revert -m 1); no journal format or state is introduced by this change itself.
Multi-machine posture: unchanged by this change; the merged repair keeps per-runner tool state.
Layer below: declaredObligations, previewCapabilities, governingConstraints, OBLIGATION_DECISION_TOOLS and TOOL_ATTEMPTS_MEANING (from the merged repair) generate the asserted packet values; replyReviewQuestion, parseReplyReviewVerdict, exciseNamedClaims and quotedSpans are exercised by the replay; sourcePacket with tools true supplies the capability note the inputs carry.
Bug class: none
Bug evidence: none
Hook bypass: none
Convergence: none
Decision: selfdesc-repair-consume-dependency | the four must-fix findings are the w4-toolsreal findings; the fix is to merge its pushed repair rather than re-implement it on this branch | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/w3-selfdesc-PROGRESS.md
Decision: selfdesc-repair-route-true-replay | the tools-positive evidence is re-recorded on the packet the code now derives, and the test asserts the inputs equal the code, so a stale packet cannot pass | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/w3-selfdesc-PROGRESS.md
Prompt review: no prompt text changes in this change. The reviewer was sampled twice more on the shipped guide with the route-true tools packet (calls 7 and 8); outputs and inputs are stored verbatim and replayed.
Prompt finding: 450c79237a95 | protocol-literal | existing conversation-prompt wording in production-provider.ts, arriving through the merged w4-toolsreal repair and reviewed in its record; unchanged here
Prompt finding: 849db3a6296a | protocol-literal | an existing fixed reply literal in journal.ts, unchanged by this change
Prompt finding: bd01de21286a | protocol-literal | existing capability-guidance wording in journal.ts, unchanged by this change
Prompt finding: fb5fa7e706c8 | protocol-literal | existing capability-guidance wording in journal.ts, unchanged by this change
Deferral: generated/register.json:1 | not-a-deferral=generated register output quoting the rule book, not a commitment by this change

Subject (38 paths): docs/17-harness-adapters.changelog.json, docs/17-harness-adapters.changelog.md, docs/17-harness-adapters/09-claude-code-codex-and-future-runtime-mappings.md, generated/capabilities.json, generated/capabilities.md, generated/coverage.md, generated/glossary.md, generated/register.json, generated/rules.md, generated/source.json, register-source/owner-references/preview.json, src/assembly/harness.declarations.json, src/assembly/production-provider.ts, tests/assembly/production-provider-tools.test.ts, tests/integration/tool-turn-live.test.ts, tests/preview/README.md, tests/preview/default-context-floor.test.ts, tests/preview/fixtures/selfdesc-2026-10-03/call7-input.json, tests/preview/fixtures/selfdesc-2026-10-03/call7-review-tools-route-new-guide.json, tests/preview/fixtures/selfdesc-2026-10-03/call8-input.json, tests/preview/fixtures/selfdesc-2026-10-03/call8-review-tools-route-decline-new-guide.json, tests/preview/fixtures/tool-turn/live-2026-10-03/call-cap.json, tests/preview/fixtures/tool-turn/live-2026-10-03/r6-fixed.json, tests/preview/fixtures/tool-turn/live-2026-10-03/scope.json, tests/preview/fixtures/tool-turn/live-2026-10-03/stop.json, tests/preview/fixtures/tool-turn/live-2026-10-03/task.json, tests/preview/journal-agent.mjs, tests/preview/journal-obligations.test.ts, tests/preview/journal.ts, tests/preview/reply-check.ts, tests/preview/selfdesc-limits.test.ts, tests/preview/tool-admission-hook.mjs, tests/preview/tool-admission.mjs, tests/preview/tool-admission.test.ts, tests/preview/tool-turn-replay.test.ts, tests/preview/tool-turn.declarations.json, tests/preview/tool-turn.mjs, tests/preview/tool-turn.test.ts

## Closing block

simplestRobustRoute: merge the dependency's own repair and re-record the one piece of evidence that depended on the stale packet; no new classifier, check or product code. Not chosen: re-implementing the dependency fixes here (two diverging copies), or editing the recorded call 6 input by hand (it would no longer be what the model saw).
80/20: 0 must-fix, 1 note — the tools-route replays carry no tool calls; a recorded successful tool result through review is covered by the merged journal-obligations test.
VERDICT: author submission; the independent verdict is recorded as a pass

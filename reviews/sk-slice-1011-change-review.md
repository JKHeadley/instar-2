# Change review — sk-slice-1011: plain agent identity in the shared briefing

Subject base: 4ba07c4a67650e9c394273b460890f9f6bf037e7
Review state: open
Reviewed content: none
Outcome: The live conversation and tool routes receive an everyday Instar agent identity from the shared capability note, including when the generated register is unavailable. The tools line names the built-in tool set without naming a harness. The desk clock label no longer calls the agent a preview. The journal-awareness clock assertion and tool-turn briefing assertion pin these exact wording changes. Actual capabilities still come from the generated register; tool, custody, attempt and expiry limits are retained. Historical model captures are unchanged. Studio added seven fresh self-description/reply-review captures and two controlled origin/train-7 captures through the existing answer-flat helper. Both historical-input test failures are repaired with explicit wording translations backed by fresh exact-input comparisons.
Affected rules: Purpose amendment 3; 30, 34, 36, 41, 47, 49, 58, 70, 74, 75, 78, 84, 101, 102, 113, 116
Affected floors: secrets — custody limit retained, no enforcement change; spend cap — attempt and expiry text retained, no enforcement change; stop — unchanged; no duplicate sends — unchanged; durable intake — unchanged
Operator questions: none
Suggested tier: significant
Declared tier: significant
Tier rationale: changes identity wording delivered to the answer model, without changing a production model call, parser, decision, capability or state machine; the existing development capture helper gains explicit prepared-envelope input
Side effects: shared capability-note text and its derived hash change. Historical comparisons explicitly translate only named later wording changes; fresh captures independently pin current note/system/question bytes. The capture helper accepts prepared envelopes without synthesizing journal records and retains input/system/stdout/stderr. Its old journal modes are unchanged. Real capture calls grant no tools, use one turn and bounded output/time, and ran on non-serving sagemind-adriana with a $2 per-call ceiling.
Undo and recovery: revert briefing, assertions, capture-helper extension and new fixture together; retain historical captures. No production persistent state or migration is introduced
Multi-machine posture: identical repository briefing text on every machine; no new state, ownership or transport behavior
Layer below: sourcePacket and capabilityBriefing; generated/capabilities.json; unchanged SOURCE_PINS and MIND_RULES; journal-agent.mjs selects the doorway conversationFraming or toolsFraming; the legacy Decision-v2 system prompt is not selected by the live journal runner
Bug class: none
Bug evidence: none
Hook bypass: none
Convergence: none
Decision: sk-slice-shared-identity | Use the existing shared capability note, including its unavailable-register path, to supply plain agent identity; keep the generated inventory and every limit. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/sk-slice-1011-PROGRESS.md
Decision: sk-slice-historical-evidence | Preserve recorded model inputs and outputs; the self-description capture assertions are not digest-only pins and require Studio re-capture rather than rewritten historical evidence. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/sk-slice-1011-PROGRESS.md
Decision: sk-slice-live-route | Keep this slice on the live conversation/tool briefing; the legacy Decision-v2 prompt is outside that route. No production-provider or Darwin conformance change is carried. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/sk-slice-1011-PROGRESS.md
Decision: sk-slice-direct-capture | Add direct prepared-envelope input to the existing capture helper, retaining submitted bytes without fabricating historical journal rows; preserve base and branch failures as observations. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/sk-slice-studio-PROGRESS.md
Prompt review: The new identity sentence gives general self-description guidance, without a canned answer to a fixture question. The tools line preserves the same abilities and grant condition. The constitution excerpts and mind rules remain byte-identical. K11a recorded inputs from updates 6232224, 6232229 and 6232231 and the omission at 6231439 remain historical. Seven fresh branch calls bind the new note to two answer and five review inputs; two base-note calls use origin/train-7 81bc610c. The new answer samples omit harness/model/test-stage naming; the base answer names Claude Code. Fresh listed-limit description passes and requested-work decline violates both relevant rules. Both branch and base broad-limit reviews falsely pass the broader website limitation; both answer samples overstate secret-storage limits. These are recorded limitations, not a new K11a semantic PASS or proof of accurate abilities. This slice adds no capability/reviewer repair and claims no deployed live-user success or independent convergence.

Prompt finding: 034c5250da92 | protocol-literal | unchanged standing-trust protocol text in production-provider.ts, already compared by the existing historical selfdesc test; this change adds no such prompt text
Prompt finding: 45e37ea2e9e9 | protocol-literal | unchanged standing-trust protocol text in production-provider.ts, already compared by the existing historical selfdesc test; this change adds no such prompt text
Prompt finding: 6af48f94b789 | protocol-literal | unchanged standing-trust protocol text in production-provider.ts, already compared by the existing historical selfdesc test; this change adds no such prompt text
Prompt finding: b00ed403060a | protocol-literal | unchanged standing-trust protocol text in production-provider.ts, already compared by the existing historical selfdesc test; this change adds no such prompt text

## Closing block

simplestRobustRoute: change the existing briefing words and their assertions; add no inventory, parser, memory store, journal behavior or new model call. Start guard: sourcePacket still checks the exact constitutional excerpt hashes. End-state evidence: fresh current-note model captures, preserved historical replays and targeted Studio checks. Limit guard: existing default-context-floor and unchanged runtime limits. No autonomous completion claim is made.
80/20: production change remains confined to briefing text; reuse the existing capture helper and retain all nine real call outputs. No second model-call pipeline or runtime machinery. The macOS process-stop test passes; both historical comparison failures pass on the exact train-7 base and are now repaired in this slice. The observed base/branch broad-limit false clear and secret-storage overstatement are explicitly retained for gate assessment, not silently certified as fixed.
VERDICT: author submission; independent review pending

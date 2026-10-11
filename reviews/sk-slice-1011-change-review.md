# Change review — sk-slice-1011: plain agent identity in the shared briefing

Subject base: 4ba07c4a67650e9c394273b460890f9f6bf037e7
Review state: open
Reviewed content: none
Outcome: The live conversation and tool routes receive an everyday Instar agent identity from the shared capability note, including when the generated register is unavailable. The tools line names the built-in tool set without naming a harness. The desk clock label no longer calls the agent a preview. Actual capabilities still come from the generated register; tool, custody, attempt and expiry limits are retained. Historical model captures are unchanged and require Studio re-capture before this can be READY.
Affected rules: Purpose amendment 3; 30, 47, 49, 74, 78, 84, 101, 102, 113, 116
Affected floors: secrets — custody limit retained, no enforcement change; spend cap — attempt and expiry text retained, no enforcement change; stop — unchanged; no duplicate sends — unchanged; durable intake — unchanged
Operator questions: none
Suggested tier: significant
Declared tier: significant
Tier rationale: changes identity wording delivered to the answer model, without changing a model call, parser, decision, capability or state machine
Side effects: shared capability-note text and its derived hash change; recorded inputs pinning the old identity or tool line are stale. No historical model output has been represented as evidence for the new prompt.
Undo and recovery: revert the briefing and assertion changes together; no persistent state or migration is introduced
Multi-machine posture: identical repository briefing text on every machine; no new state, ownership or transport behavior
Layer below: sourcePacket and capabilityBriefing; generated/capabilities.json; unchanged SOURCE_PINS and MIND_RULES; journal-agent.mjs selects the doorway conversationFraming or toolsFraming; the legacy Decision-v2 system prompt is not selected by the live journal runner
Bug class: none
Bug evidence: none
Hook bypass: none
Convergence: none
Decision: sk-slice-shared-identity | Use the existing shared capability note, including its unavailable-register path, to supply plain agent identity; keep the generated inventory and every limit. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/sk-slice-1011-PROGRESS.md
Decision: sk-slice-historical-evidence | Preserve recorded model inputs and outputs; the self-description capture assertions are not digest-only pins and require Studio re-capture rather than rewritten historical evidence. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/sk-slice-1011-PROGRESS.md
Decision: sk-slice-live-route | Keep this slice on the live conversation/tool briefing; the legacy Decision-v2 prompt is outside that route. No production-provider or Darwin conformance change is carried. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/sk-slice-1011-PROGRESS.md
Prompt review: The new identity sentence gives general self-description guidance, without a canned answer to a fixture question. The tools line preserves the same abilities and grant condition. The constitution excerpts and mind rules remain byte-identical. Existing K11a recorded inputs from updates 6232224, 6232229 and 6232231 are exercised by selfdesc-abilities and selfdesc-limits; their old capability-note text fails the current-input assertions. This is a re-capture requirement, not a passing real-model proof. No READY or convergence claim is made.

Prompt finding: 034c5250da92 | protocol-literal | unchanged standing-trust protocol text in production-provider.ts, already compared by the existing historical selfdesc test; this change adds no such prompt text
Prompt finding: 45e37ea2e9e9 | protocol-literal | unchanged standing-trust protocol text in production-provider.ts, already compared by the existing historical selfdesc test; this change adds no such prompt text
Prompt finding: 6af48f94b789 | protocol-literal | unchanged standing-trust protocol text in production-provider.ts, already compared by the existing historical selfdesc test; this change adds no such prompt text
Prompt finding: b00ed403060a | protocol-literal | unchanged standing-trust protocol text in production-provider.ts, already compared by the existing historical selfdesc test; this change adds no such prompt text

## Closing block

simplestRobustRoute: change the existing briefing words and their assertions; add no inventory, parser, memory store, journal behavior or new model call. Start guard: sourcePacket still checks the exact constitutional excerpt hashes. End-state evidence: briefing assertions and recorded self-description input checks. Limit guard: existing default-context-floor and unchanged runtime limits. No autonomous completion claim is made.
80/20: implementation is confined to briefing text and its tests; Studio re-capture remains required for real-model evidence before READY.
VERDICT: author submission; independent review pending

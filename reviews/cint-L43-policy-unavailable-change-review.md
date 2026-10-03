# Change review — cint-L43 repair round 2: an unreadable installed effect policy refuses at the doorway instead of lapsing

Subject base: 4c55b04b2cd149f53e59d993e60683ba6d617ee7
Review state: open
Reviewed content: none
Outcome: Plan row #420, Astra round-2 MUST-FIX 1. The runner reread its configured --effect-policy at each tool turn and, when the reread or decode failed (a rewrite in progress, a malformed or removed file), substituted DEFAULT_EFFECT_POLICY. The empty default made policyNames false, so a web read or listed MCP read the operator had marked policy-sensitive was admitted as ordinary work with no doorway decision. Fix at the source: the reread is now currentEffectPolicy (effect-doorway.mjs), which returns an explicit unavailable marker ({type: PreviewEffectPolicyUnavailable, reason}) instead of the default. policyNames already treats an undecodable policy as naming everything, so the call reaches the doorway; admitToolEffect now turns an undecodable or unavailable policy into a recorded refusal (policy-sensitive held, no grant, reason names the unavailable policy and what would admit it) instead of throwing. Ordinary in-workspace work, sandboxed shell, the full tool catalog, and the valid-policy read/grant behaviour are unchanged; "no policy configured" still leaves web and listed MCP reads ordinary. A new test drives the real executable hook through valid, malformed and removed policy files (refused, recorded doorway rows), the no-policy side (allowed), and a re-readable policy with a grant (admitted).
Affected rules: 4 and 95 (governed state enforced with its declared fail-closed direction), 41 (the refusal is a recorded doorway decision), 37 (fixed at source, no quarantine), 116 (one marker and one catch branch; no new service), purpose fourth consequential-effect test (policy-sensitive stays at the doorway); revision-12 ability preservation (no tool removed; enforcement stays at the admission checkpoint)
Affected floors: secrets — unchanged (the reason carries only an error code, never the policy path or content); spend cap — unchanged; stop — unchanged; no duplicate sends — unchanged; durable intake — unchanged
Operator questions: none
Suggested tier: critical
Declared tier: critical
Tier rationale: it changes an admission decision on the effect doorway path.
Side effects: while the configured policy is unreadable, every tool call that would reach the doorway (marked or not) is refused with a recorded reason until it reads again.
Undo and recovery: revert the commit; recovery for an operator is making the policy file readable again, which takes effect on the next tool turn.
Multi-machine posture: unchanged; the policy is per-runner local state.
Layer below: tool-admission-hook.mjs (unchanged: records the doorway row durably before proceeding) and admitEffect (unchanged).
Bug class: integration
Bug evidence: astra-cint-L43-evidence/policy-withdrawal.json (corrupted or removed policy admitted both marked calls); the new tool-admission test reproduces both sides through the real hook.
Hook bypass: none (plain commits; core.hooksPath is unset)
Convergence: none
Decision: cint-L43-policy-unavailable | carry "configured but unreadable" as an explicit marker to the existing admission checkpoint and refuse there, rather than keeping the last good policy in memory: a remembered policy would keep a grant the operator may be revoking by the rewrite, while a refusal until it reads again cannot admit what the operator withdrew (Rule 116, fail closed) | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/cint-L43-PROGRESS.md
Prompt review: the only model-facing text is the new refusal reason for the unavailable case; it follows the existing doorway refusal shape (what was refused, why, what would admit it, tell the user plainly). No recorded journal shape triggers it (it needs a configured policy to become unreadable), so it is proven by the hook test, not a replay.
Deferral: generated/register.json:1 | not-a-deferral=generated register replay at the repair commit

Subject (11 paths): generated/capabilities.json, generated/capabilities.md, generated/coverage.md, generated/glossary.md, generated/register.json, generated/rules.md, generated/source.json, tests/preview/effect-doorway.mjs, tests/preview/journal-agent.mjs, tests/preview/tool-admission.mjs, tests/preview/tool-admission.test.ts

## Closing block

simplestRobustRoute: an explicit unavailable marker from the reread, refused at the existing doorway checkpoint with a recorded reason.
80/20: 0 must-fix open; targeted tests only (tool-admission, effect-doorway); the pipeline reruns the full suite.
VERDICT: author submission; the independent verdict is recorded as a pass

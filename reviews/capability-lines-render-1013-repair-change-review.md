# Change review — Preserve adjacent content in literal capability answers

Subject base: a5ef847df9cc0c0a9f5b294ad406a4449bbe6627
Review state: open
Reviewed content: none
Outcome: Literal capability sentences preserve adjacent answers; only the explicit whole-answer marker renders the entire generated list.
Affected rules: 1, 3, 4, 10, 36, 49, 70, 74, 78, 84, 86, 101, 102, 111, 113, 116
Affected floors: secrets — unchanged; spend cap — unchanged; stop — unchanged; no duplicate sends — existing journal ownership and repeated-drain coverage; durable intake — unchanged
Operator questions: none
Suggested tier: significant
Declared tier: significant
Tier rationale: Narrow presentation-boundary repair with recorded answer replay and journal review/revision/send coverage; no new authority or state.
Side effects: Unmarked grant overclaims remain visible to contextual review instead of being silently replaced. Legacy exact pronoun forms are repaired locally. Literal repeated sentences remain for review; the renderer does not infer whole-answer scope. Explicit markers retain the prior whole-answer behavior and validated-note requirements.
Undo and recovery: Revert the repair commit. No schema or durable-state migration. Persisted reviewed answer bytes remain intact.
Multi-machine posture: Stateless transformation of the supplied note; revisions use the original persisted prompt. No new shared or local state, ownership rule, or send path.
Layer below: Inspected generated note hashes/sections, the answer and revision renderer call sites in journal.ts, self_state_claim contextual review in reply-check.ts, and briefing.ts's existing explicit whole-answer instruction. Replay covers delivery once after repeated drain.
Bug class: integration
Bug evidence: reproducer=tests/preview/capsentence-render.test.ts
Hook bypass: none; core.hooksPath unset and common hooks directory contains sample hooks only
Convergence: none
Prompt review: No prompt changes. The existing capability marker instruction and contextual self_state_claim reviewer already carry the needed meaning; no new classifier or review stage.

Decision: capability-lines-explicit-scope | Whole-answer replacement requires the explicit marker. Exact sentence and legacy pronoun matches do not authorize deletion of adjacent content (Rules 3, 4, 10). | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/capability-lines-render-1013-repair-013349-PROGRESS.md
Decision: capability-lines-contextual-repair | Replay the unmodified recorded overclaim through existing review and an explicit revision reference, preserving contextual judgment instead of inferring scope in code. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/capability-lines-render-1013-repair-013349-PROGRESS.md

Evidence: Seven preservation assertions failed on the original renderer; all 20 renderer tests now pass. The 715675709 delivered overclaim enters review unchanged; a supplied self_state_claim verdict and marker revision produce the canonical note and one send. This proves journal wiring with recorded input, not live model judgment. The note comes from 715675677; the original 715675709 prompt is unavailable. Recorded summary, uncertain, Jev undecided/unsure, review, delivered and empty shapes retain their bytes. Mixed tools-plus-arithmetic neighbors cover literal and both legacy subjects through rendering, persisted-prompt revision, review and delivery. Journal boundaries (23) and context floor (6) also pass.

Publication: Refreshed the seven generated register outputs with build-register --replay from source commit 91d0766ebba1f78636c9f941727992553f77b00c. Owner manifests and grounding inventory needed zero pin changes. Declaration wording is unchanged.

## Closing block

simplestRobustRoute: This is the simplest robust route: restrict the existing whole-answer branch to its explicit marker and retain local legacy substitution. Existing full-context review repairs semantic overclaims. Start: verified note and explicit scope. End: preserved adjacent answers or explicitly rendered list, reviewed before one send. Floors, permissions and budgets are unchanged; no new stage, state or classifier. Evidence is offline replay, not an unattended live-use claim.
80/20: One source fix, recorded replay and mixed-answer neighbors; targeted tests and cheap checks, with full gate on the Studio.
VERDICT: author submission; this record asserts no independent verdict — the review desk records its own

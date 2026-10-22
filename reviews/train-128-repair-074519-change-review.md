# Change review — train-128 historical policy replay repair

Subject base: 8b1c7f7ccff22bfd63d782cce0d3de3ed3db3c1c
Review state: open
Reviewed content: none
Outcome: Repair the four fail-fast assertions after reviewed memory-supersession guidance while retaining historical capture bytes and proving old policy activations remain refused.
Affected rules: 26, 30, 36, 37, 49, 70, 74, 95, 101, 102, 111, 112, 113, 116
Affected floors: secrets — no custody or outbound change; spend cap — no model calls or cap change; stop — existing pre-dispatch refusal remains exercised; no duplicate sends — existing UNKNOWN-send replay remains exercised; durable intake — existing journal and provider-owner replay remains exercised
Operator questions: none
Suggested tier: ordinary
Declared tier: ordinary
Tier rationale: Only four regression tests and this review change. Runtime prompts, policy builders, captured evidence, hash pins and governance declarations stay unchanged.
Side effects: Historical comparison replaces only the reviewed memory clause, retaining exact equality for every other policy/prompt byte. Positive current-policy dispatch and negative historical-policy admission are both checked. No new fixture helper or runtime abstraction.
Undo and recovery: Revert this repair commit to restore the prior assertions; doing so also restores the four known failing expectations. Historical evidence remains untouched either way.
Multi-machine posture: Repository test-only change applies on every machine. Studio owns the final full gate and report placement; this Laptop uses read-only Studio evidence and local scratch journals, never live roots.
Layer below: Inspected subscriptionConversationPolicy args, Codex policy system, MEMORY_DISAMBIGUATION, existing deferral/literal-copy historical translations and activation validation. The current prompt is asserted to carry the new clause and exclude the old one before its historical reconstruction is compared to the preserved pin.
Bug class: none
Bug evidence: Test expectation repair, not runtime bug claim. The supplied fail-fast log records the four red assertions; targeted runs verify historical equality and current admission/refusal on both doorways.
Hook bypass: none; core.hooksPath is unset and the git common hooks directory contains sample hooks only, inspected before ordinary commit.
Convergence: none
Decision: train-128-repair-074519-history | Extend the existing historical-clause translation to these four missed consumers, keep exact capture hashes and prompt bytes, and add explicit old-policy rejection rather than rewriting historical evidence or changing runtime guidance. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-128-repair-074519-PROGRESS.md

## Closing block

simplestRobustRoute: This is the simplest robust route: reuse the branch's existing exact historical-clause translation in the four failing tests. Start guard is current guidance present and old wording absent; end guard is exact historical pin equality alongside successful current dispatch and refusal of old policy activation. The named floors are unchanged. No new machinery or autonomous-completion claim.
80/20: Run the four affected files, typecheck/build and cheap gates; preserve the full-suite task log as red evidence and leave the full gate to Studio.
VERDICT: author submission; this record asserts no independent verdict — the review desk records its own

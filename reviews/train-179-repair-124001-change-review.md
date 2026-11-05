# Change review — train-179 merge repair

Subject base: 16aaa044d99a09f67f6f2d73b1bd24ed910a6e29
Review state: open
Reviewed content: none
Outcome: Merge main c20b68d1d into train-179, preserving member behavior and both histories; regenerate register evidence from the combined source.
Affected rules: 1, 26, 37, 49, 69, 74, 90, 91, 101, 102, 111, 112, 113, 116, 121
Affected floors: secrets — no credential change; spend cap — unchanged; stop — unchanged; no duplicate sends — unchanged; durable intake — unchanged
Operator questions: none
Suggested tier: critical
Declared tier: critical
Tier rationale: Integrates already approved constitutional Rule 121 and its register representation; no new wording or runtime decision.
Side effects: Conversion anchor and generated register bind the combined source, including the candidate's declarations. Main Rule 121 text and changelog arrive intact; existing local tool recovery remains intact.
Undo and recovery: Keep this candidate unactivated until the Studio gate accepts it. Revert the merge on the candidate branch if needed; this repair does not touch installed runners or live state.
Multi-machine posture: No new runtime state. The same committed register inputs replay on each host; WSL performs portable checks and Studio owns macOS and live acceptance.
Layer below: Read main purpose and rule book in full; inspected both builder diffs, bootstrap anchor, canonical hash, readCommit, generator verification and inherited 1.x comparison.
Bug class: none
Bug evidence: none
Hook bypass: none
Convergence: none
Prompt review: No new model prompt or parsing change. Rule 121 wording is inherited byte-for-byte from approved main; constitutional briefing tests exercise the merged text. Existing member recorded-shape evidence remains in its prior review.
Deferral: generated/conversion.json:1 | not-a-deferral=regenerated existing governed text, not a new deferral
Deferral: generated/register.json:1 | not-a-deferral=regenerated existing governed text, not a new deferral

1.x comparison: JKHeadley/instar main ab256f684cda141db19abe8bba5300b980e1025b; searched src/ and docs/specs/ for conversion anchors, build-register and governed registers and git history for register changes. No corresponding conversion-register mechanism found in those inspected paths. Inherited behavior comparison: src/core/SessionManager.ts buildSessionMcpFlags, src/commands/setup.ts ensurePlaywrightMcp, docs/specs/DYNAMIC-MCP-LIFECYCLE-SPEC.md; history e460a9be3/397d72b7b/7e8fde8e8. Explicit session configuration fits; ambient full-config fallback does not fit scoped admission. ONEX-LESSONS sessions/MCP process-shape and unavailable-authority lessons read. No runtime behavior is reconstructed in this repair.

Decision: T179-R-MERGE | Merge c20b68d1d and preserve both histories and all runtime behavior; derive the combined conversion hash with the existing canonical implementation rather than selecting either stale parent pin. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-179-repair-124001-PROGRESS.md
Decision: T179-R-GENERATE | Resolve generated snapshots through register replay after committing source; run delegated owner rehash and chain repin, never hand-edit pins. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-179-repair-124001-PROGRESS.md
Decision: T179-R-CHECKS | Run typecheck, focused constitutional briefing tests and portable cheap checks; hand macOS/e2e and the full suite to Studio per the repair brief. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-179-repair-124001-PROGRESS.md

Verification: Register replay of source commit 8071a8a8a8bda0b70f7a392f9c5868e98cc81e29 generated 298 entries, 121 rules and 34 terms; generation sha256:b7b4412f7e1701f7db1a758438ec90db5a46606f1f31f99d170c9f5ef44c4684. Owner rehash and chain repin changed zero pins.

## Closing block

simplestRobustRoute: This is the simplest robust route: an ordinary merge, canonical recomputation and the existing register replay. No new runtime mechanism, permission boundary or unattended-completion claim. Existing custody, spend, stop, intake and uniqueness floors stay enforced.
80/20: Resolve the measured merge conflict and verify its consumers; preserve accepted parent work and leave independent acceptance to the desk.
VERDICT: author submission; this record asserts no independent verdict — the review desk records its own

# Change review — cint-L27 pipeline repair: the briefing test asserts the rewritten self-started-message boundary

Subject base: 83c276f2acd9e734fc43c65563bbf487f136fdd0
Review state: open
Reviewed content: none
Outcome: The studio gate's one failure (tests/preview/journal-dated-memory.test.ts "delivers upcoming-date behavior in the prepared packet and source briefing") was a stale assertion. Commit 70a93418 deliberately rewrote the capability note's closing line, because the old "no scheduled work, nudges or other unprompted messages" wording denied preview-requested-actions, which is listed in the same note. The test still expected the old phrase "unprompted message". It now asserts the new boundary sentence "no message you start yourself beyond the listed answers to later-time requests", so it still proves the note states the limit on self-started messages. No source changed. The test file passes 24/24 in a targeted run.
Affected rules: 78 and 84 (the briefing states the self-started-message limit without denying a listed capability; the test now pins that wording), 37 (fixed at the source: the stale assertion; no quarantine), 69 and 90 (owner pin refreshed and register replayed from committed sources), 74 (this record), 116 (a one-line test assertion update; no new machinery)
Affected floors: secrets — unchanged; spend cap — unchanged; stop — unchanged; no duplicate sends — unchanged; durable intake — unchanged
Operator questions: none
Suggested tier: critical
Declared tier: ordinary
Tier rationale: a test-only assertion update matching wording an earlier reviewed commit already shipped; no runtime code, prompt or authority changed.
Side effects: none at runtime.
Undo and recovery: revert the test commit, its owner repin, the register replay and this record to return to 83c276f2. Nothing persisted differs.
Multi-machine posture: unchanged; test-only.
Layer below: tests/preview/briefing.ts (the capability note's closing line, read and unchanged)
Bug class: none
Bug evidence: none
Hook bypass: none
Convergence: none
Decision: cint-L27-repair-briefing-assert | update the stale assertion to the boundary sentence 70a93418 shipped; not chosen: restoring the old wording (it denied a listed capability, the fault that commit fixed) | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/cint-L27-PROGRESS.md
Prompt review: no prompt text changed.
Deferral: generated/register.json:1 | not-a-deferral=generated register output quoting the rule book, not a commitment by this change

Subject (9 paths): generated/capabilities.json, generated/capabilities.md, generated/coverage.md, generated/glossary.md, generated/register.json, generated/rules.md, generated/source.json, register-source/owner-references/preview.json, tests/preview/journal-dated-memory.test.ts

## Closing block

simplestRobustRoute: this is that route: the assertion follows the wording already shipped; no source change.
80/20: 0 must-fixes, 1 note (targeted test only, no full suite on this machine, per the operator's rule tonight)
VERDICT: author submission; the independent verdict is recorded as a pass

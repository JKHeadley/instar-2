# Change review — Repair capability wording assertions

Subject base: 9efa773bf03a97e7cb2490601d5de49a38b91b08
Review state: open
Reviewed content: none
Outcome: Repair three stale capability-wording assertions while preserving runtime prompts and behavior.
Affected rules: 3, 17, 18, 37, 45, 49, 70, 74, 78, 84, 101, 103, 104, 111, 113, 116
Affected floors: secrets — custody assertions retained; spend cap — unchanged; stop — unchanged; no duplicate sends — unchanged; durable intake — unchanged
Operator questions: none
Suggested tier: critical
Declared tier: ordinary
Tier rationale: Test-only consumer repairs and mechanically regenerated provenance; no runtime change.
Side effects: The tests now accept the rendered capability paragraph and exact Rule 18 instruction instead of obsolete duplicates. Tools-off, unknown/zero MCP, fallback availability and custody assertions remain. Owner reference and compiled register hashes follow the changed test bytes.
Undo and recovery: Revert the repair and regenerate owner references and register artifacts. No deployed state or schema changes.
Multi-machine posture: Deterministic test expectations shared across machines; no new store, ownership or replication behavior.
Layer below: Inspected briefing.ts capabilityBriefing/capabilitySentence, MIND_RULES and ANSWER_INSTRUCTIONS, sourcePacket provenance, tool-note fallback and the actual prepared model envelope.
Bug class: integration
Bug evidence: reproducer=tests/preview/tool-turn.test.ts; additional reproductions in journal-obligations.test.ts and journal-boundaries.test.ts
Hook bypass: none; core.hooksPath unset and common hooks directory inspected (samples only)
Convergence: none
Decision: R01 | Update assertion consumers of the rendered note and exact Rule 18; restoring obsolete duplicated instructions would change a working protocol. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/capsentence-1011-repair-PROGRESS.md

Subject (4 paths): register-source/owner-references/preview.json, tests/preview/journal-boundaries.test.ts, tests/preview/journal-obligations.test.ts, tests/preview/tool-turn.test.ts

Evidence: Targeted failing cases: 3 passed. Journal boundaries, obligations, selfdesc-abilities and group-carry: 81 passed. Recorded shapes replayed from fixtures/retrospective-duty-followup-train-1-2026-10-08.json: summary 715672480; uncertain summary 715672483; Jev uncertain 715672482; Jev undecided 969389570; reply review 969389923; delivered reply 715672479; empty bubble 715672550. Five recorded capability answers from fixtures/capsentence-2026-10-11.json (update 840342287, runs 5–9) exercise the rendered paragraph and digest-bound verdicts. No new model-facing implementation change.

Deferral: generated/register.json:1 | not-a-deferral=Existing compiled register prose regenerated unchanged except source provenance; no builder work is deferred.

Contract checks: All eleven required scripts were invoked and read; each reaches ENOENT for .test-results.json. The assigned gate worktree and local checkout have no saved report, and fast-fail evidence contains only fast.log, not JSON results. No unrelated report is substituted and no fresh full-run result is claimed. The pipeline supplies the full report.

## Closing block

simplestRobustRoute: This is the simplest robust route: repair the three obsolete assertions using the existing renderer and constitutional Rule 18, without adding machinery or changing model instructions. Start guard is the reported failing base; end guards are the repaired tests, real recorded replay neighbors and cheap gate checks; all runtime limits remain unchanged. No autonomous deployment claim.
80/20: Three reported failures reproduced and repaired; 81 nearby tests and recorded-shape replays pass, plus the targeted tool wording test. No full suite on the Studio; the pipeline performs that gate.
VERDICT: author submission; this record asserts no independent verdict — the review desk records its own

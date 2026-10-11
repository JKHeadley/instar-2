# Change review — sync the briefed constitution with the amendments

Subject base: 6c63ef8486440c62e4ba3576d70065c12fc6fff0
Review state: open
Reviewed content: none
Outcome: The preview briefing's copy of rule 18 and its pinned digest of the purpose's coherency section now match the constitution as amended in PR #154 (Justin approved 2026-10-10 17:23 and on GitHub). The runner's refusal-on-mismatch stays; it now passes on the approved text.
Affected rules: 3, 18, 27, 91
Affected floors: secrets, spend cap, stop, no duplicate sends and durable intake unchanged
Operator questions: none
Suggested tier: significant
Declared tier: significant
Tier rationale: verbatim copy of approved constitutional text and a re-pinned digest; the mismatch check itself is unchanged
Side effects: the model's standing instructions now state rule 18 in its approved wording (act inside the recorded role; refuse outside every grant, naming it) and quote the amended coherency section
Undo and recovery: revert this commit (the runner then refuses on main's rule book again)
Multi-machine posture: repository source only; identical on every machine
Layer below: docs/01-the-rules.md Held-by-the-mind table, docs/00-the-purpose.md coherency section, verifyMindRules and sourcePacket in tests/preview/briefing.ts
Bug class: live-path
Bug evidence: reproducer=tests/preview/constitution-briefing-sync.test.ts (2 failed on the pre-fix briefing, 2 passed after); live=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/preview-trial-root/forum-answer-copy-20261010-190127/runs.jsonl (refused before launch: preview: mind rule 18 changed)
Hook bypass: none
Convergence: none
Prompt review: model-facing standing instruction text changes only to the approved constitutional wording, verbatim; no instruction added or removed
Decision: mind-rule18-sync | Copy the approved rule 18 wording verbatim into MIND_RULES and re-pin the coherency excerpt; no paraphrase, the mismatch check unchanged. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/mind-rule18-sync-PROGRESS.md

## Closing block

simplestRobustRoute: update the two stale constants to the approved text; nothing else.
80/20: verifyMindRules passes against main; the briefing and digest tests pass.
VERDICT: author submission; independent review pending

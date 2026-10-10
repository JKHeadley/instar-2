# Change review — forum topics current-main pipeline repair

Subject base: ae8b1a7fde8dd7a89149c112afb054d2623d5ea5
Review state: open
Reviewed content: none
Outcome: Include current origin/main by an ordinary merge and verify the existing forum-topic repair against the landing checks without moving local main.
Affected rules: 37 (targeted failure checks), 49 (constraints named), 74 (side effects and recovery), 90 and 91 (preserve approved documents), 101 (no hook bypass), 102 (recorded decision), 112 (preserve history), 113 (posture), 116 (existing merge and checking mechanisms)
Affected floors: secrets — no credentials printed or changed; spend cap — provider accounting unchanged; stop — admission unchanged; no duplicate sends — delivery unchanged; durable intake — journal unchanged
Operator questions: none
Suggested tier: ordinary
Declared tier: ordinary
Tier rationale: The current-main merge adds only an approved request record; no runtime behavior changes.
Side effects: Main ancestry and approval-request history become visible on this branch. No source, prompt, parser, admission or delivery behavior is changed by this repair.
Undo and recovery: Revert the merge if its ancestry integration is rejected; retain previous branch commits and their evidence. Generated publications, if refreshed, are reproducible from the recorded source commit.
Multi-machine posture: Git carries the merged history across machines. No new runtime state or machine-local behavior; testing occurs on WSL and the full gate stays on the Studio.
Layer below: Current origin/main ancestry, approved purpose and rules, first-landing baseline selection, owner-reference artifacts and register publication.
Bug class: none
Bug evidence: none
Hook bypass: none
Convergence: none
Decision: forumtopics-repair-184112-merge | Merge current origin/main normally and retain the local main ref; use existing baseline checks and generated pin tools without changing runtime logic | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/sb-w4-forumtopics-repair-184112-PROGRESS.md

## Closing block

simplestRobustRoute: Merge the approved main history and rerun the existing targeted and cheap checks. This is the simplest robust route; it adds no mechanism, restriction or state. Existing authority, stop, spend and durability guards remain unchanged. No unattended live-completion claim is made.
80/20: Verification is limited to first-landing/additivity baseline tests, forum routing, typecheck, build, document checks and cheap landing checks. The saved Studio gate result is unavailable (HTTP 404); no full-run evidence is fabricated.
VERDICT: author submission; independent desk review remains required

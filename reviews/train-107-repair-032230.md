# Change review — train-107 rendered replay consumers

Subject base: b916361149b661fddfacf0fe72046efef8b33e72
Review state: open
Reviewed content: none
Outcome: Repair the supplied pipeline failures by checking rendered delivery while preserving captured model inputs and the existing receipt boundary.
Affected rules: 26, 34, 36, 37, 42, 49, 74, 101, 102, 111, 112, 113, 116
Affected floors: Secrets, spend cap, stop, no duplicate sends and durable intake remain in the unchanged runtime; test assertions for cancellation, unknown sends, restart and memory retention remain enforced.
Operator questions: none
Suggested tier: ordinary
Declared tier: ordinary
Tier rationale: Test-only consumer and HTTP fixture corrections; no product, prompt, parser, authority or policy change.
Side effects: Historical model bytes now compare against Telegram display text rather than raw Markdown; the relocation HTTP fixture models HTML decoding. Full shipped relocation remains a Studio check because this host refuses launcher startup before the assertion.
Undo and recovery: Revert this test-only commit; no durable product data or installation changes exist.
Multi-machine posture: Shared test code only; relocation still checks original-root immutability, disclosure revocation, wider audiences and no resend after reopen. No new machine-local state.
Layer below: Full purpose and rules (identical to origin/main), original failure diffs, splitReply, Telegram formatting and receipt classifier, recorded replay captures and the launcher fixture.
Bug class: none
Bug evidence: none
Hook bypass: none; core.hooksPath unset and common hooks directory contains samples only, inspected on WSL.
Convergence: none
Prompt review: No prompt or model-output parser edits. Existing recorded uncertainty, review and empty-reply replays stay intact.
Decision: train-107-repair-display | Preserve capture bytes and assert exact visible delivery with only known bullet and bold marker changes; HTML consumers assert HTML. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-107-repair-032230-PROGRESS.md
Decision: train-107-repair-receipt | Model Telegram displayed-text receipts in the relocation HTTP fixture; separately prove accepted display and rejected raw HTML/mismatched text through the real classifier. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-107-repair-032230-PROGRESS.md
Verification: Nine portable replay files: 168 tests passed. Relocation receipt contract: one passed, three launcher cases excluded by name after WSL startup refusal. Typecheck, architecture, lint, register and change-review results recorded in the report.
simplestRobustRoute: This is the simplest robust route: correct consumer expectations and the existing local HTTP fixture without changing the formatter, weakening receipt matching, introducing runtime machinery or claiming unattended live acceptance.
80/20: Targeted foreground tests and required cheap checks; no full-suite run or second base worktree.
VERDICT: author submission for desk gate; no independent convergence or live acceptance claimed

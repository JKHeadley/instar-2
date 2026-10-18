# Change review — assert the composed credential-bearing launcher candidate

Subject base: 77f2632a8b215c8f664c409b45878c3df5e48e43
Review state: open
Reviewed content: none
Outcome: The missing- and intact-secondary-custody launcher cases assert the actual journal candidate while independently requiring credential withholding and no credential delivery.
Affected rules: 1, 4, 26, 34, 35, 37, 49, 70, 74, 86, 100, 101, 102, 108, 111, 113, 116
Affected floors: secrets — exact credential-bearing candidate, holding violation, three withholding notices and zero encoded-credential sends remain required; spend cap — unchanged; stop — unchanged; no duplicate sends — existing unique-send assertions retained; durable intake — existing update and journal assertions retained.
Operator questions: none
Suggested tier: ordinary
Declared tier: ordinary
Tier rationale: Test expectation repair only; no product, prompt, parser, refusal policy, credential or generated register changes.
Side effects: Each completed turn is asserted separately, so a candidate mismatch and a holding-check mismatch have distinct failures. The candidate expectation includes only the exact synthetic body and its recorded notice lines. Due notices no longer produce a false failure; absent credentials, different answer bodies, missing holding verdicts, leaked credentials and missing withholding notices still fail.
Undo and recovery: Revert this commit to restore the incorrect bare-answer equality. No persisted format or runtime state changes.
Multi-machine posture: Deliberately machine-local launcher proof with synthetic custody and a loopback Telegram endpoint. No credentials or runtime state cross machines; product multi-machine behavior is unchanged.
Layer below: Read both constitutional documents in full and verified they match origin/main. Inspected journal-agent.mjs replyNotices ordering, journal.ts notice composition before answer recording, credentialShape and withholding replacement, and per-member held-secret collection. The missing case appends the secondary-login unavailable notice; the intact case appends the unverified Jev route notice. Both record holding/violation/credential for all three updates. The product already holds these candidates correctly.
Bug class: none
Bug evidence: none
Verification evidence: Unmodified 77f2632a reproduced exactly the two named failures on macOS (8 passed, 2 failed). Per-conjunct diagnostics for synthetic updates 1–3 in both modes showed only answer equality false: credential containment, holding path, violation verdict and credential rule all held. Corrected launcher and existing custody replay files passed all 13 tests. Exact commands, negative-control evidence and final gate results are recorded in the progress report.
Hook bypass: none; core.hooksPath unset and the common hooks directory contains only sample files. Plain git commit; no stash.
Convergence: none
Decision: LPD-0105-candidate-notices | Expect the exact credential body plus recorded due notices and assert holding/violation/credential separately per turn; the journal checks the composed candidate, not just the model body. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/sb-login-pool-launcher-0105-PROGRESS.md
Decision: LPD-0105-floor-evidence | Keep the delivery and custody floors intact, exercise the shipped launcher and existing recorded-shape replay, and test the old aggregate custody reader as a temporary negative control. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/sb-login-pool-launcher-0105-PROGRESS.md
Prompt review: No model-facing change. Existing harness-login-held replay still covers recorded summary writer, uncertain writer, Jev undecided/unsure, reply-review, delivered-reply and empty historical candidate shapes; synthetic credential companions are explicitly labelled. No new live-model or real Telegram delivery claim.

simplestRobustRoute: Correct the test's candidate composition expectation using the journal's recorded notices and split the conjuncts. This is the simplest robust route: no added runtime machinery. Start guards remain synthetic custody and exact activation; end guards remain exact credential withholding, local delivery observation and unique sends; resource, spend and stop limits are unchanged. The unattended shipped launcher is exercised with synthetic physical IO, not serving logins.
80/20: One bounded test repair backed by macOS red-to-green evidence, per-conjunct diagnosis and a custody regression negative control. The desk owns independent review and the full suite.
VERDICT: author submission; this record asserts no independent verdict — the review desk records its own

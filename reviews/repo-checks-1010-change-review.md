# Change review — restore repository check currency and merge coverage

Subject base: f52c7214d96edd3ebc28c53296fa6dd97b4c0f55
Review state: open
Reviewed content: none
Outcome: Restore current-clock register generation by renewing the dark rungraph-core graduation deadline from 2026-10-05 to 2026-10-25 UTC, with P5-NF-54 retained. Production liveProof is absent, so this is a bounded renewal, not graduation or runtime enablement. Cover the three uncovered main commits without changing their history. The subject includes the already-landed approval-account amendment (#144), ability amendment (#149), architecture inspection repair (#151), and request record (#152); their original reviews remain authoritative for their implementation. This record extends coverage across the landing commits and the repository repair.
Affected rules: 37, 49, 62, 72, 73, 74, 90, 101, 102, 111, 112, 113, 116
Affected floors: secrets, spend cap, stop, no duplicate sends and durable intake remain unchanged; no runtime authority or effect path is modified
Operator questions: none
Suggested tier: critical
Declared tier: critical
Tier rationale: historical subject includes approved constitutional text; this branch changes only graduation metadata, its assertion and generated publication
Side effects: the register admits the dark feature until the new finite deadline; missing live proof continues to prevent promotion and expiry continues to fail
Undo and recovery: revert this repair with an ordinary commit; the original overdue deadline will fail again; never rewrite the approved main commits
Multi-machine posture: shared repository metadata and generated publication are identical across machines; local checking grants no runtime authority
Layer below: src/register/declarations.ts feature-live-proof invariant; src/rulegraph/graph.ts checkDeadlines; scripts/check-change-review.mjs ancestry-based coverage; original reviews/promote-L9-change-review.md, reviews/amend-approval-override-change-review.md, reviews/amend-ability-change-review.md and reviews/w4-r105-change-review.md
Bug class: integration
Bug evidence: reproducer=tests/e2e/register.test.ts
Hook bypass: none
Convergence: none
Decision: repo-checks-renew | Renew to 2026-10-25 UTC because the user-facing feature lacks a production liveProof reference and rungraph.bound explicitly records production probe evidence as unestablished. Keep the existing graduation test, dark status and strict expiry enforcement. The desk owns reassessment by that date using real production evidence. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/repo-checks-1010-PROGRESS.md
Decision: repo-checks-merge-143 | Cover 15518cdb4a569aa497ff43d9e9a53eef729821a6 from reviewed second parent f52c7214d96edd3ebc28c53296fa6dd97b4c0f55: git diff between those trees is empty, so the merge introduces no unreviewed content. Keep the original promotion review and history. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/repo-checks-1010-PROGRESS.md
Decision: repo-checks-merge-144 | Cover d4a3170d29b0863c6a54ee747956cc1a35afcea4: its tree equals reviewed second parent fff2e8db32465f9e0ff2e01926452a561c96cbc6. Existing amendment review and approved changelog remain intact. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/repo-checks-1010-PROGRESS.md
Decision: repo-checks-request-152 | Cover a035d5ed1206d72d26a81861283dbbebe8f221f7, whose sole change is requests/87432af9acef18cc.md. Recording the request does not attest that an unexpired authorization was consumed or that the installation was extended. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/repo-checks-1010-PROGRESS.md

## Closing block

simplestRobustRoute: use the existing finite graduation gate, ancestry review record and register generator; no new checker, runtime mechanism or historical rewrite is required.
80/20: targeted register and rungraph tests check publication and refusals; architecture, typecheck, lint and real-clock register replay provide the repository evidence, with the Studio-only report-path check explicitly reported separately.
VERDICT: author submission; independent landing review remains required

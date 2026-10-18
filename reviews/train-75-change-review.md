# Change review — train-75 final-answer progress integration

Subject base: 090a0665257337f6412279699ca11693db23c5b2
Review state: open
Reviewed content: none
Outcome: Integrate reviewed progress liveness and final-answer repairs while preserving live reminder withdrawal behavior.
Affected rules: 2, 4, 8, 26, 34, 36, 37, 42, 46, 49, 52, 69, 70, 74, 77, 87, 89, 90, 95, 101, 102, 107, 111, 112, 113, 116
Affected floors: Secrets, spend cap, stop, no duplicate sends and durable intake retain their existing enforcement. No model calls, grants, journal types or send paths added.
Operator questions: none
Suggested tier: significant
Declared tier: significant
Tier rationale: Combines reviewed final-answer scheduling and durable omitted-report handling; no additional product changes.
Side effects: An admitted progress transport may finish after the answer; its consumed durable identity is never retried. Holding replies retain omitted reports as repair work. Historical projection remains unchanged.
Undo and recovery: Revert member product changes and regenerate publication; preserve durable reports and uncertain send identities.
Multi-machine posture: Existing journal replication and conversation ownership remain unchanged. No new state or transport. WSL performs local verification; Studio owns native and live acceptance.
Layer below: Read constitution, member report and desk chain; inspected merged journal diff and preserved base reminder cancellation validator. Replay captured shapes and direct consumers.
Bug class: integration
Bug evidence: reproducer=tests/preview/gap-progress-final.test.ts
Hook bypass: none; core.hooksPath unset and common hooks directory contains only sample hooks.
Convergence: none
Decision: train-75-merge | Ordinary merge of exact reviewed c91bc0072f2e47a10ca1b3b5fc11a5d8555392c3; report /Users/dabombstudio/.instar/agents/echo/.instar/lanes/gap-progress-1018s-PROGRESS.md read through Studio API. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-75-PROGRESS.md
Decision: train-75-A | Keep both member final-answer repairs and live reminder withdrawal validator; source auto-merged without conflicts. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-75-PROGRESS.md
Decision: train-75-B | Branch created directly at exact live base; no main merge or branch move. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-75-PROGRESS.md
Decision: train-75-C | Only generated publication conflicted; retain base artifacts temporarily then regenerate from committed merged source. No product conflict or omitted member. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-75-PROGRESS.md
Decision: train-75-D | Disclose WSL-only host limitations in unchanged tests; Studio owns native and live acceptance. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-75-PROGRESS.md
Decision: train-75-desk | Downloaded repin/build/rehash/replay chain; Linux sed syntax only. No generated hand merge or guard constant change. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-75-PROGRESS.md
Prompt finding: 4106b49fff07 | protocol-literal | Unchanged existing protocol or fixed output wording; no semantic classifier copied from the fixture.
Prompt finding: 849db3a6296a | protocol-literal | Unchanged existing protocol or fixed output wording; no semantic classifier copied from the fixture.
Prompt finding: e8708c7fea24 | protocol-literal | Unchanged existing protocol or fixed output wording; no semantic classifier copied from the fixture.
Prompt review: No new prompt, parser or review threshold. Member captured real shapes are replayed through existing tests. No fixture phrase is used to classify meaning.
Verification: Targeted member regressions, direct importers, journal tests, subscription tests, pinned gate and static checks; exact results in progress report.
Deferral: generated/register.json:1 | not-a-deferral=Existing declaration wording reproduced by the generator, with no deferred repair introduced.
Deferral: tests/preview/fixtures/gap-progress-final-2026-10-18.json:135 | not-a-deferral=Recorded model/preview evidence contains quoted future-work wording; it is a replay fixture, not an engineering deferral.
Deferral: tests/preview/fixtures/gap-progress-final-2026-10-18.json:202 | not-a-deferral=Recorded model/preview evidence contains quoted future-work wording; it is a replay fixture, not an engineering deferral.
Deferral: tests/preview/fixtures/gap-progress-final-2026-10-18.json:255 | not-a-deferral=Recorded model/preview evidence contains quoted future-work wording; it is a replay fixture, not an engineering deferral.
Deferral: tests/preview/fixtures/gap-progress-final-2026-10-18.json:276 | not-a-deferral=Recorded model/preview evidence contains quoted future-work wording; it is a replay fixture, not an engineering deferral.
Deferral: tests/preview/fixtures/gap-progress-final-2026-10-18.json:434 | not-a-deferral=Recorded model/preview evidence contains quoted future-work wording; it is a replay fixture, not an engineering deferral.
Deferral: tests/preview/fixtures/requested-report-proofroom4-2026-10-17.json:13 | not-a-deferral=Recorded model/preview evidence contains quoted future-work wording; it is a replay fixture, not an engineering deferral.
Deferral: tests/preview/fixtures/retrospective-cap-2026-10-17.json:30 | not-a-deferral=Recorded model/preview evidence contains quoted future-work wording; it is a replay fixture, not an engineering deferral.
Deferral: tests/preview/fixtures/retrospective-cap-2026-10-17.json:34 | not-a-deferral=Recorded model/preview evidence contains quoted future-work wording; it is a replay fixture, not an engineering deferral.
Deferral: tests/preview/fixtures/retrospective-cap-2026-10-17.json:38 | not-a-deferral=Recorded model/preview evidence contains quoted future-work wording; it is a replay fixture, not an engineering deferral.
Deferral: tests/preview/fixtures/retrospective-cap-2026-10-17.json:42 | not-a-deferral=Recorded model/preview evidence contains quoted future-work wording; it is a replay fixture, not an engineering deferral.
Deferral: tests/preview/fixtures/retrospective-cap-2026-10-17.json:46 | not-a-deferral=Recorded model/preview evidence contains quoted future-work wording; it is a replay fixture, not an engineering deferral.
Deferral: tests/preview/fixtures/retrospective-cap-2026-10-17.json:50 | not-a-deferral=Recorded model/preview evidence contains quoted future-work wording; it is a replay fixture, not an engineering deferral.
Deferral: tests/preview/fixtures/retrospective-cap-2026-10-17.json:54 | not-a-deferral=Recorded model/preview evidence contains quoted future-work wording; it is a replay fixture, not an engineering deferral.
Deferral: tests/preview/fixtures/retrospective-cap-2026-10-17.json:58 | not-a-deferral=Recorded model/preview evidence contains quoted future-work wording; it is a replay fixture, not an engineering deferral.
Deferral: tests/preview/fixtures/retrospective-cap-2026-10-17.json:62 | not-a-deferral=Recorded model/preview evidence contains quoted future-work wording; it is a replay fixture, not an engineering deferral.
Deferral: tests/preview/fixtures/retrospective-cap-2026-10-17.json:66 | not-a-deferral=Recorded model/preview evidence contains quoted future-work wording; it is a replay fixture, not an engineering deferral.
Deferral: tests/preview/fixtures/retrospective-cap-2026-10-17.json:319 | not-a-deferral=Recorded model/preview evidence contains quoted future-work wording; it is a replay fixture, not an engineering deferral.
Deferral: tests/preview/fixtures/retrospective-cap-2026-10-17.json:323 | not-a-deferral=Recorded model/preview evidence contains quoted future-work wording; it is a replay fixture, not an engineering deferral.
Deferral: tests/preview/fixtures/retrospective-cap-2026-10-17.json:327 | not-a-deferral=Recorded model/preview evidence contains quoted future-work wording; it is a replay fixture, not an engineering deferral.
Deferral: tests/preview/fixtures/retrospective-cap-2026-10-17.json:331 | not-a-deferral=Recorded model/preview evidence contains quoted future-work wording; it is a replay fixture, not an engineering deferral.
Deferral: tests/preview/fixtures/retrospective-cap-2026-10-17.json:335 | not-a-deferral=Recorded model/preview evidence contains quoted future-work wording; it is a replay fixture, not an engineering deferral.
Deferral: tests/preview/fixtures/retrospective-cap-2026-10-17.json:339 | not-a-deferral=Recorded model/preview evidence contains quoted future-work wording; it is a replay fixture, not an engineering deferral.
Deferral: tests/preview/fixtures/retrospective-cap-2026-10-17.json:343 | not-a-deferral=Recorded model/preview evidence contains quoted future-work wording; it is a replay fixture, not an engineering deferral.
Deferral: tests/preview/fixtures/retrospective-cap-2026-10-17.json:347 | not-a-deferral=Recorded model/preview evidence contains quoted future-work wording; it is a replay fixture, not an engineering deferral.
Deferral: tests/preview/fixtures/retrospective-cap-2026-10-17.json:351 | not-a-deferral=Recorded model/preview evidence contains quoted future-work wording; it is a replay fixture, not an engineering deferral.
Deferral: tests/preview/fixtures/retrospective-cap-2026-10-17.json:355 | not-a-deferral=Recorded model/preview evidence contains quoted future-work wording; it is a replay fixture, not an engineering deferral.
Deferral: tests/preview/fixtures/retrospective-cap-2026-10-17.json:359 | not-a-deferral=Recorded model/preview evidence contains quoted future-work wording; it is a replay fixture, not an engineering deferral.
Deferral: tests/preview/gap-progress-final.test.ts:80 | not-a-deferral=Test name or fixture setup describes report delivery; it does not defer implementation work.
Deferral: tests/preview/gap-progress-final.test.ts:114 | not-a-deferral=Test name or fixture setup describes report delivery; it does not defer implementation work.
Deferral: tests/preview/requested-report-live.test.ts:17 | not-a-deferral=Test name or fixture setup describes report delivery; it does not defer implementation work.

simplestRobustRoute: This is the simplest robust route: ordinary exact-head merge and existing generation and test tools. No added machinery. Exact ancestry guards start; final replies and durable report repairs are tested end states; secrets, spend, stop, unique sends and durable intake remain enforced. No unattended product completion claim.
80/20: Targeted tests only, with explicit host exceptions.
VERDICT: author submission; independent desk review pending

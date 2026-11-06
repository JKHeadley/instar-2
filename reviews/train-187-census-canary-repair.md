# Change review — preserve legacy census failure and reuse activation notice assertion

Subject base: 5389ee73d61e1df9b3f27ab357e7aef133411c85
Review state: open
Reviewed content: none
Outcome: Restore the legacy full-argv census failure reproducer while retaining compact production census recovery; accept the existing activation reminder in the exact-answer launcher canary.
Affected rules: 26, 34, 36, 37, 49, 60, 74, 101, 102, 107, 111, 116
Affected floors: secrets — no production or credential changes; spend cap — existing real allocation ceilings retained and no model requests; stop — finite idle fixtures and exact recorded child cleanup retained; no duplicate sends — launcher assertions unchanged; durable intake — existing journal and owner ledger assertions unchanged.
Operator questions: none
Suggested tier: ordinary
Declared tier: ordinary
Tier rationale: Two test assertion/reproducer corrections; no production code, model prompts, output parsers, admission decisions or tool abilities change.
Side effects: The legacy failure side explicitly invokes ps with command= instead of following the production comm= constant. The current query still inventories every fixture PID, and only proven cleanup returns real Six debits. The canary permits the existing activation reminder alongside the already permitted credential and route notices while keeping the answer exact.
Undo and recovery: Revert this test-only commit; no persisted runtime state changes. Test fixtures retain bounded lifetime and cleanup.
Multi-machine posture: Retain native physical-process tests on Studio; no host load generation, host-wide signals, concurrency change or full-suite run.
Layer below: Merge e22c61b2abd0c323b930ff37259a9559bd11e772 changed the shared census column from command= to comm=, so the old-reader reproducer stopped overflowing. Preserve the explicit legacy query introduced by 6e27ccf2fd7350192ee9794a6309400c426afa7d at the test seam. The canary matcher omitted a legitimate activation reminder; reuse the exact existing repair from be9ab8e836bb1123d67ff0f06bdb0b4da88d2cea rather than inventing another fix.
Bug class: integration
Bug evidence: reproducer=tests/preview/resource-census-recovery.test.ts; other=tests/preview/review-layers-canary.test.ts
Hook bypass: none
Convergence: none
Decision: train187-legacy-query | Freeze the legacy full-argument census in the failure reproducer; leave current compact census and owner recovery intact. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-187-repair-PROGRESS.md
Decision: train187-notice-reuse | Reuse the existing train-179 activation-notice matcher repair. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-187-repair-PROGRESS.md

1.x comparison: searched actual JKHeadley/instar main 234fa37563dfb6ec8ba0c8c8e0deb7514b61db34 src/ and docs/specs/ for maxBuffer, process census, credential expiry and exact activation/canary names. Read src/monitoring/ExternalHogProcTable.ts (compact comm= census and physical identity, unknown is not kill authority), docs/specs/forkbomb-prevention-simple.md (host-wide holder accounting), their git history (ab26b7ca3), and ONEX-LESSONS.md section 6. Reuse that behavior already present in 2.0's compact census and real resource owner. The exact activation/canary identifiers have no matches in those searched 1.x trees; this test-only correction needs no unrelated 1.x implementation transplant. The fitting 2.0 notice assertion comes directly from be9ab8e83, with no claim of an independent review verdict for this branch.

Verification: nice -n 10 npm run typecheck and nice -n 10 npx vitest run --maxWorkers 1 tests/preview/resource-census-recovery.test.ts tests/preview/review-layers-canary.test.ts. Canonical lanes/train-187-repair-PROGRESS.md records completion and final-commit cheap gates. A separate assertion command replays the supplied activation text, accepts credential reminders, and rejects arbitrary text, malformed activation wording and multiline extras. Existing canaries retain wrapped and contradictory review paths; the census tests retain both unknown/debit-held and verified/debit-returned paths. No new full-run report is claimed.

## Closing block

simplestRobustRoute: Explicit legacy census arguments at the test seam and reuse of the existing notice regex repair; no runtime machinery or relaxed resource authority.
80/20: Verify the two affected files and TypeScript, then cheap final-commit gates; the Studio pipeline owns full qualification.
VERDICT: author submission; this record asserts no independent verdict — the review desk records its own

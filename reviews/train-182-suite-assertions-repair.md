# Change review — train-182 launcher assertions and fixture timing

Subject base: d30d47d77c67782e968d8569a2aecb4c123d80fe
Review state: open
Reviewed content: none
Outcome: Recognize the shipped activation reminder in launcher assertions, keep the login matrix responsive while its bounded children run, and exercise the two-machine stop floor under the shipped lease term.
Affected rules: 26, 31, 34, 36, 37, 49, 55, 60, 63, 70, 74, 95, 100, 101, 102, 107, 111, 112, 113, 116
Affected floors: secrets — existing custody and encoded-secret rejection assertions retained; spend cap — existing admission unchanged; stop — real stopped-owner and unavailable-peer assertions retained; no duplicate sends — exact send identities/counts and withdrawal checks retained; durable intake — journal and replica assertions retained.
Operator questions: none
Suggested tier: ordinary
Declared tier: ordinary
Tier rationale: Four test files only; no production prompt, output parser, semantic judgment, policy, resource ceiling or effect changes.
Side effects: Test readers accept the actual activation label and exact renewal action. The login case yields during each child, retaining its 30-second ceiling; its enclosing 180-second ceiling covers five sequential children plus setup and cleanup. The stop fixture uses the authority launcher's 30-second default instead of six seconds, and adds a non-burning 4500ms poll stall beside the unstalled case. No test is removed, skipped or quarantined.
Undo and recovery: Revert this test-only repair. No installed state, profile, credential or journal requires migration. Retain the original red suite as evidence.
Multi-machine posture: Test orchestration is machine-local and shared in git. The fixture uses two real runner processes and an HTTP authority on one host; it proves replicated-history and stop behavior, not new physical multi-host acceptance.
Layer below: credential-display.ts and credential-reminders.ts supply the activation notice; tests/e2e/async-child.ts drains child pipes and preserves exit status and bounded termination; createLeaseHolder in two-machine-serving.ts leaves one-third of the lease as a safety margin; conversation-authority-server.mjs defaults to 30000ms; journal-cutover-ports.mjs supplies the existing sleeping poll barrier. The stopped-peer, grant-withdrawal, secret-rejection and duplicate-delivery checks remain on their existing runtime paths.
Bug class: none
Bug evidence: The supplied Studio excerpts record eight obsolete notice-pattern failures, a 45820ms login case against a 45000ms case ceiling, and a 60000ms wait for standby. The exact historical scheduling/child diagnostics are unavailable; a targeted rerun alone is not exoneration. Restoring only the old 6000ms term in the new 4500ms sleeping-poll case reproduces the exact "the second machine stands by" failure (66.35s); the same scenario with 30000ms passes (33.34s). This proves the shortened-lease failure mechanism without claiming to reconstruct the missing historical scheduling diagnostics.
Hook bypass: none; core.hooksPath unset, common hooks directory contains sample hooks only.
Convergence: none
Prompt review: No model-facing change. Captured notice strings test the assertion readers only; model inputs, model-output parsing and decisions are unchanged. No additional journal-output replay is claimed or required for this test-orchestration repair.

1.x FIRST: searched actual JKHeadley/instar origin/main c034523ac3033529c648f807aaaee442850a206e src/ and docs/specs/ for activation/credential expiry reminders, standby leases and listener startup. Read src/monitoring/MissingLoginSessionDetector.ts, src/core/hostTestRunnerSemaphore.ts, docs/specs/scrape-fixture-realness.md and docs/specs/test-runner-concurrency-bound.md; inspected history ff8344b4b, 1f90fa1a9 and 618560b3e. ONEX-LESSONS sections 1, 4 and 6 cover lease progress, captured fixtures and bounded test execution. Reuse that evidence discipline; the inspected missing-login signal and host semaphore do not implement this 2.0 activation-notice reader or repair intra-worker waits. No unrelated 1.x runtime code is transplanted.

One cause, one repair: the two notice test files reuse named source owner e7f0d6de54c3731784cd8740318e372c385339f5 byte-for-byte. Its comparison at 4e38b9fdaae43b62940a6a43e1e69094d1b91bd1 and captured train-173 reminder provenance remain inherited evidence. The separate stop test adapts the shipped-term choice already established by 42c0952d4fa8984c892223dd1256c6785e64b7ce, using the existing poll barrier rather than adding machinery. The login test reuses the existing async child helper used by that repair. Unrelated tests and reviews from those commits are not copied.

Decision: train182-notice-owner | Reuse the named owner's exact two test patches and positive/negative controls. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-182-repair-PROGRESS.md
Decision: train182-child-budget | Await the existing bounded children and let the enclosing case cover their sequential budgets. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-182-repair-PROGRESS.md
Decision: train182-stop-fixture | Use the shipped lease for the stop scenario and test a sleeping slow-poll neighbor without CPU load. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-182-repair-PROGRESS.md

Validation: The stable-tree run of all four changed test files passed 42/42 cases in 336.53s with nice 10 and one worker; the missing-custody-secret case passed in 11.39s, and the zero/4500ms stop cases passed in 20.45s/26.34s. `nice -n 10 npx tsc --noEmit` exited 0. The shortened-term control and post-commit cheap checks are recorded in the absolute repair PROGRESS file. The automatic Studio pipeline owns the next full-suite report and independent review; this submission does not assert either result or new live-user acceptance.

## Closing block

simplestRobustRoute: This is the simplest robust route: reuse the owning notice repair, the existing asynchronous child helper and the shipped lease contract. Start guards remain fixture isolation and admission; end guards remain exact output, secret, ownership, stop and delivery assertions; limits remain per-child deadlines, finite case ceilings and one foreground worker. No runtime mechanism or reduced agent ability is introduced.
80/20: Repair the four failed files at their test sources, prove both timing and notice boundaries, and leave full-suite qualification to the already-assigned pipeline.
VERDICT: author submission; no independent convergence claimed

# Change review — correct, bounded change scope on the live train

Subject base: 2f7a76adc8f87087ce2b4ca6ac0d6eac2a71811e
Review state: open
Reviewed content: none
Outcome: Both register deadline scope and review scope use the caller's actual target merge-base, retain every touched commit, and refuse an unknown boundary without scanning remote refs.
Affected rules: 72, 73, 95, 70, 74, 102, 113, 116
Affected floors: secrets — unchanged; spend cap — unchanged; stop — unchanged; no duplicate sends — unchanged; durable intake — unchanged
Operator questions: none
Suggested tier: significant
Declared tier: significant
Tier rationale: Narrow reversible integrity repair, with real Git boundary regressions and unchanged deadline decisions.
Side effects: Callers must supply their known CHANGE_REVIEW_BASE (or REGISTER_CHANGE_BASE for register builds). No default can infer the live target from main, arbitrary remote refs, or the newest repair record. Missing input is unknown and release integrity refuses. No runtime state or model-facing behavior changes.
Undo and recovery: Revert the implementation and tests together; no persisted data migration. Doing so restores the demonstrated scope omission and per-ref process cost.
Multi-machine posture: Machine-local Git evidence by design; the caller supplies the same unit target on each machine. Implementation and tests replicate through Git. Shallow or missing history refuses rather than changing the answer by host.
Layer below: Real Git B -> A -> H history, partial remote at A, live train beyond main, multiple repair review ranges, advanced target, shallow/unrelated/crisscross histories; existing deadline ownership and notice consumer tests.
Bug class: integration
Bug evidence: reproducer=tests/register/change-scope.test.ts
Hook bypass: none
Convergence: none
Decision: scope-base-1109-D1 | Require the existing caller-supplied target; neither unrelated remote reachability nor the latest repair Subject base establishes the unit boundary. Use its unique merge-base and fail closed otherwise. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/register-scope-base-1109-PROGRESS.md
Decision: scope-base-1109-D2 | Share boundary resolution between both consumers and remove remote enumeration entirely; no bulk-ref query is needed. Preserve each consumer's path filtering and register local changes. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/register-scope-base-1109-PROGRESS.md

## Existing behavior reused

1.x source: JKHeadley/instar main 55e3010b0245a2a1b94e2ced738a7f19ab051bd5. Searched src/ and docs/specs/ and history. src/commands/devPreflight.ts:225-249 (introduced cb7d4e27a) resolves an explicit target merge-base and throws when unavailable. Reuse that behavior, not its main-name fallback or 1.x SafeGitExecutor dependencies. docs/specs/RELEASE-READINESS-VISIBILITY-SPEC.md:203-208 replaces per-item ancestry processes with bulk history; removing remote enumeration here removes that cost entirely. ONEX-LESSONS.md scope isolation, fail-direction and bounded-test-concurrency incidents informed the checks.

2.0 prior repair d4b9c9c8f batches the flawed exclusion algorithm; 1103bd33e uses a unique target merge-base. Reuse the latter algorithm, without its origin/main default: main is not the live train's target. The pipeline driver already knows item.reviewBase or item.base (driver.py:1329-1334), and the unit review declares Subject base. The caller must pass that known boundary through the existing environment input. The current desk paperwork and gate launchers do not yet do so; desk integration is required before landing, and a local driver patch is supplied with the report. No new target selection heuristic is introduced.

## Closing block

simplestRobustRoute: Use the existing explicit base input and one shared unique-merge-base function; missing context is unknown. No remote-ref scan, new registry, service or target-guessing heuristic is needed. Keep the existing deadline floor and notice path.
80/20: Real Git reproductions and the existing consumer tests cover the changed boundary; the gate host owns the full suite and native conformance.
VERDICT: author submission; the independent desk owns landing approval

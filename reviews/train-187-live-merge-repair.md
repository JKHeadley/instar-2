# Change review — preserve candidate and live behavior across train-187 merge conflicts

Subject base: f00d4e490f2c2d52f8eab279ba291da9e27c67b6
Review state: open
Reviewed content: none
Outcome: Merge live add5d75879174874e15bf1552ae37c82e00c6358 into train-187, retaining both branches' behavior, bounded asynchronous regression proofs and historical evidence. Main aa8cbc934351f78e52d4ecebc3714648981ece0f is already contained in both inputs.
Affected rules: 26, 34, 37, 49, 55, 60, 69, 70, 74, 90, 91, 101, 102, 105, 107, 111, 112, 113, 115, 116
Affected floors: secrets — offline fixtures and existing custody unchanged; spend cap — no live model requests; stop — child deadlines and independent signal-response assertion retained; no duplicate sends — existing exact reply counts and unknown-send checks retained; durable intake — complete cut, torn-prefix and poison matrix retained.
Operator questions: none
Suggested tier: critical
Declared tier: critical
Tier rationale: Integrates previously reviewed launcher/resource/dashboard changes and their byte-bound native composition declaration; manual behavior resolution is confined to three test files and evidence prose.
Side effects: The crash pair has live's 65s enclosing bound over two 30s children. The launcher signal proof has live's 210s total over its dependent bounded operations while still requiring signal exit within 3s. Review histories retain both integration contexts. Auto-merged runtime code carries both existing changes without introducing a new prompt, model output parser, admission rule or effect path.
Undo and recovery: Revert the merge and dependent generated publication together, then regenerate owner evidence for the restored composition. Retain the failed merge evidence and historical passing/red runs; no history rewrite.
Multi-machine posture: Repository content is identical on all hosts. Tests use bounded temporary local fixtures; native conformance certifies only its exact declared Darwin runtime. Multi-machine behavior and checkpoint authority are inherited from the two input branches.
Layer below: Reviewed tests/e2e/async-child.ts against candidate asyncWorker (only the latter rejects killed deadline completion), crash workers' intentional SIGKILL cuts, independent poison seeds, exact notice grammar, and launcher async status/restart callers. scripts/resource-owner.mjs retains candidate compact census/completed-row recovery plus live partial-census reclamation. tests/preview/journal-agent.mjs retains candidate commitment/delivery recovery plus live dashboard activity. Existing composition closure, desk renewal and owner/register generators hold source-byte identity.
Bug class: none
Bug evidence: Merge reconciliation, not a newly claimed product repair; supplied mechanical refusal names seven real content conflicts. Targeted regression and cheap gate evidence is recorded in canonical lanes/train-187-repair-PROGRESS.md.
Hook bypass: none
Convergence: none
Prompt review: No new model prompt, model output parsing or accept/escalate/refuse behavior is authored. Existing model-facing changes retain their parent records; this merge does not claim a new model-facing fix based on stubs.

1.x comparison: Actual JKHeadley/instar origin/main 083e79a9c55944fc8fba95cea55d3b6ce41b5647 searched across src/ and docs/specs/ for worker/RPC timeouts, bounded execFile and merge conflicts. Read src/core/ClaudeCliIntelligenceProvider.ts:161-185 and docs/specs/conformance-gate-timeout.md; inspected history 9585a36e6, d34a499bc, 01e98a8ca and ab26b7ca3 plus ONEX-LESSONS.md section 6. The fitting behavior is bounded asynchronous child execution with outer budgets covering the complete path; no direct 1.x subsystem transplant fits this merge-only repair. Reuse the existing 2.0 implementation and tuned tests. No ability is reduced to satisfy a safeguard.

Decision: train187-merge-tests | Retain candidate asyncWorker rejecting deadline kills, nine cut cases and twelve independently seeded poison cases; retain live's exact three-observation assertion and 65s pair bound. Shared runChild returns timeout signals as normal results, so replacing the existing rejecting helper would discard its explicit negative control. Both are asynchronous and preserve worker IPC. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-187-repair-PROGRESS.md
Decision: train187-merge-history | Union both defect narratives; retain candidate review bases with explicit historical live integration bases and import/replay notes, preserving both histories without inheriting independent verdicts. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-187-repair-PROGRESS.md
Decision: train187-merge-launcher | Retain live's async launcher/status/restart calls, exact activation renewal text and 210s cumulative signal-test budget; keep the 30s child and independent 3s signal-response limits. No product capability or runtime decision is narrowed. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-187-repair-PROGRESS.md
Decision: train187-merge-native | Architecture reports only R105's stale native composition certificate after combining the reviewed inputs. On this Darwin Studio, use the desk's existing merge-live-conformance.mjs --renew contract workflow with before/after evidence, never --write or a hand-edited certificate. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-187-repair-PROGRESS.md

Deferral: generated/register.json:1 | not-a-deferral=Existing full-line register wording is mechanically replayed, with no postponed implementation.

Verification: nice -n 10 npm run typecheck and npm run build exited 0. Three conflicted test files passed together: 47/47 in 123.46s, with the deadline-rejection negative, nine cut pairs, uncut control, fully fsynced and torn recovery, all twelve poison combinations, nineteen journal launcher cases and three review-layer canaries. Both notice matchers accepted the three allowed notice classes and rejected arbitrary activation actions, multiline injection and arbitrary additions. Native contract renewal exited 0: before 9/10 with only stale certificate; after 10/10, no runtime errors; complete 278-file composition c63dda097eeb46cfdc6f8c7e99148058521f16d4d0cd770e4adccdd1301b07ef. Evidence is canonical lanes/train-187-merge-native/{before,after}.{json,log}. No full-suite report was read or manufactured.

## Closing block

simplestRobustRoute: Merge the existing reviewed implementations, resolve the three test conflicts by preserving the stronger assertions and bounded async execution from each, union historical prose, and regenerate derived evidence with existing tools. This is the simplest robust route; no new scheduler, helper or product machinery.
80/20: Typecheck/build, the three manually reconciled test files, the existing native contract and final cheap gates qualify this repair. The automatic Studio pipeline owns full-suite qualification; no saved full report is fetched or fabricated.
VERDICT: author submission; this record asserts no independent verdict — the review desk records its own

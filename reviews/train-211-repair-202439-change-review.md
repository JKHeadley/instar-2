# Change review — Repair train-211 full-run failures at source

Subject base: f552834a2b50604b43da9a48b2afa5543c602734
Review state: open
Reviewed content: none
Outcome: the train-211 Studio full run failed 7 tests in 5 files; each is repaired where its cause is, with nothing quarantined and no source behaviour changed. Two are combine collisions between heads whose pins predate the other's change: rungraph-core's bounded graduation ceiling moved to 2026-11-10 00:00 UTC in c69f89ec (docs/defects/preview-dark-feature-deadlines-2026-11-01.md), but tests/rungraph/scope.test.ts and tests/rungraph/closure-registration-additivity.test.ts still pinned 2026-11-08; the updater carryover added two live recorded-governed-state ruled-three sites (update.updateRoot, update.writeUpdateRuntime in scripts/update.declarations.json) and the update-bound critical-outcome probe, which the rule 4 roster pin (tests/register/live-rule-four-admissions.test.ts) and the probe catalog pin (tests/verification/provider-response-assessment.test.ts) now name deliberately. The three tests/preview/stage2-recovery.test.ts launcher cases failed because the test's launcher preload replaced child_process.spawnSync for every caller to fake the Telegram transport; ebaf4d91 added the resource owner's limit-shell probe (spawnSync of the shell with '-c ulimit ...'), the fake intercepted it, the provider child never launched, and each case ended at the 180 s provider timeout with a held "timed out" notice and no model call. The fake now intercepts only the transport child (argv[0] is the limit-exec.sh shim, request at argv[1]) and passes every other synchronous child to the real spawnSync. The owner-reference artifact pins for the three changed pinned test files were refreshed by the desk repin, and the register was replayed.
Affected rules: 37, 4, 36, 26, 42, 69, 72, 73, 102, 116
Affected floors: secrets — no secret read, written or logged; the preload keeps its synthetic token only; spend cap — no call, reservation or retry added; stop — the SIGINT and SIGTERM launcher cases now run and pass (stop held, no send); no duplicate sends — the accept case asserts exactly one sendMessage and passes; durable intake — unchanged
Operator questions: none
Suggested tier: critical
Declared tier: ordinary
Tier rationale: test-only edits plus desk-generated pins and register; no src, script, prompt, parser or decision change. The suggested critical tier reflects the generated register and owner-reference manifests in the subject, which were produced by the desk tools, not hand-edited.
Side effects: the stage2 launcher cases take about 22 s (accept) and 8 s (signals) instead of timing out at about 183 s. The rule 4 roster and probe catalog pins now include the updater's two sites and its probe, so a further new site or probe still fails them.
Undo and recovery: revert the three repair commits; the five test files, the two owner-reference manifests and generated/ return to their previous form.
Multi-machine posture: machine-local test fixtures and generated register only; no state or store.
Layer below: scripts/resource-owner.mjs selectLimitShell/limitShell (ebaf4d91), which probes with spawnSync before every limited launch, and scripts/production-boot-io.mjs createProductionTelegramIO launch, which is the only spawnSync('/bin/sh', [LIMIT_FILE, request, ...]) caller the fake must answer; scripts/update.declarations.json sites, which carry decidesAloneBasis recorded-governed-state, failDirection closed and preservesInput, as Rule 4's admission requires.
Bug class: unit
Bug evidence: reproducer=tests/preview/stage2-recovery.test.ts
Hook bypass: none
Convergence: none
Deferral: generated/register.json:1 | not-a-deferral=the one-line generated register was rewritten by the replay; its only change is the replay commit id, and the flagged wording is pre-existing register content
Decision: t211r-fake-scope | narrow the preload's spawnSync fake to the Telegram transport child instead of changing the resource owner's probe, because the probe is correct source behaviour and the over-broad fake is the defect | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-211-repair-202439-PROGRESS.md
Decision: t211r-ceiling-pins | repin the two rungraph tests to the 2026-11-10 ceiling recorded in c69f89ec rather than move the declaration, because the ceiling move is the desk's recorded decision | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-211-repair-202439-PROGRESS.md
Decision: t211r-roster-pins | add update.updateRoot, update.writeUpdateRuntime and update-bound to the roster and catalog pins with a comment naming their source, because both sites meet Rule 4's recorded-governed-state admission (exact test, fail closed, input preserved) | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-211-repair-202439-PROGRESS.md
Prompt review: no prompt, parser or accept, escalate or refuse decision changes. The launcher accept case drives the real stage-2 launcher with the recorded synthetic CLI and fake Telegram updates; before the fix the provider path never fired (no models.jsonl, receipt failureClass timeout), after it the model is called once and one reply is sent.

1.x comparison: JKHeadley/instar clone at 9e9c3b0dbe62 (2026-11-07; not confirmed as an ancestor of fetched 1.x main f595c3345032) has no limit-shell probe, limit-exec shim, global spawnSync test fake, ruled-three roster or decidesAlone field in src, tests, scripts or docs/specs (grep, positive control: spawnSync in 28 src files); docs/specs/forkbomb-prevention-simple.md only recommends an OS-level ulimit -u. These are 2.0-only fixtures and pins, so no 1.x code applies.

Verification: npm run typecheck exit 0; tests/preview/stage2-recovery.test.ts launcher cases 3/3 passed single-worker on WSL (before the fix the accept case failed the same way as the gate, 185 s); tests/rungraph/scope.test.ts, tests/rungraph/closure-registration-additivity.test.ts, tests/register/live-rule-four-admissions.test.ts, tests/verification/provider-response-assessment.test.ts 16/16 passed; npm run lint exit 0; npm run register:check exit 0.
Residue: full-run | low | the remaining 39 stage2-recovery cases and the full suite are confirmed only by the Studio pipeline rerun after push.

## Closing block

simplestRobustRoute: four pins follow the recorded changes they lagged, and one test fake is narrowed to the one call it exists to answer; no new gate, script, source change or quarantine.
80/20: all 7 reported failures are addressed at their cause.
VERDICT: author submission; this record asserts no independent verdict — the review desk records its own

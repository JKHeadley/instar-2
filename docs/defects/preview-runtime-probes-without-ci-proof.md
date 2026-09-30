# Seven held preview probes have no passing CI test (register-contract-map red)

**Status:** CLOSED 2026-09-29 (option 3). Not quarantined: there is no test to skip.
**Owner:** constitutional-build integration desk (Echo), as owner of the preview runner.
**Opened:** 2026-09-29.

`scripts/check-register-contract-map.mjs` requires every non-deferred held fixture or probe in the register to have a test in its owner-catalog artifact whose title names the id, and every such test to pass. The owner-reference contract (`scripts/register-owner-references.mjs`, part nine) fixes every `P9-PREVIEW-*` probe's artifact to `tests/preview/proofs-launcher.test.ts`: the runner's proof plans, executed in CI through the real launcher.

On cint-L3b (post-check repair 2) the launcher tests now name, and assert `passed` for, the eight plans that the real launcher actually runs to `passed` with the offline fixture world: startup, store-agreements, journal-restore, telegram-identity, reply-delivered, reply-drain, reply-review-reached and status-answered. The two capture fixtures (`PREVIEW-MODEL-JSON-ON-CAPTURE`, `PREVIEW-PROVIDER-FAILURE-ON-CAPTURE`) are named on their genuine-capture tests. Seven probes remain without a passing CI test:

| Probe | Declaration | What the launcher reports in CI | Why |
| --- | --- | --- | --- |
| `P9-PREVIEW-held-notice-delivered` | `preview.held-reply-notice.delivered` | unknown | no held-reply notice is sent: that needs a reply or step check outage |
| `P9-PREVIEW-reminder-delivered` | `preview.reminders.delivered` | unknown | no requested action falls due inside a launch |
| `P9-PREVIEW-provider-outcomes` | `preview.reply.provider-answers` | unknown | the offline provider records no answer-call outcome |
| `P9-PREVIEW-spend-cap-refusal` | `preview.spend-cap.refusal` | unknown | no allowance is reached |
| `P9-PREVIEW-summary-checked` | `preview.sentinel.summary-review` | unknown | no rolling summary is committed |
| `P9-PREVIEW-step-check-reached` | `preview.sentinel.step-check` | not run | the step check is dark (off) in the launch |
| `P9-PREVIEW-stop-honored` | `preview.stop.honored` | not run | by design the runner does not run after a stop; the declaration says a latched stop is proven by the desk's recorded live proof |

The per-plan decision logic is unit-tested in `tests/preview/proofs.test.ts` (both sides for held-notice, spend-cap, provider-outcomes and status; the failure side only for summary and step checks; no reminder case), but that file is not the catalog artifact.

**Why nothing was credited by title:** naming these ids on a launcher test that does not reach a `passed` result for them would be title-only credit. Rule 107 requires red evidence to go in as red, classified.

**Gate effect:** until this record closes, `check-register-contract-map` stops at `held test P9-PREVIEW-held-notice-delivered must pass in the current run` (Set order). A diagnostic run with these seven treated as passing showed no further register-contract-map failure: all 30 P3 contracts mapped.

**Repair options (owner's decision):**
1. Drive each outcome through the real launcher in CI with the offline world: a reply-check outage for the held notice, a due requested action, recorded offline call outcomes, a reached allowance, a committed rolling summary, and a step-check-enabled launch. The stop cannot be observed by the runner; its hold would name the stop live-proof test (`records a stop live proof only after an observed latch with nothing sent past it`), which proves the hold's stated portion.
2. Or point these probes at tests that do prove them (for example `proofs.test.ts`, completing its missing sides) by changing the part-nine owner contract.
3. Or, if runtime-stage partial holds are meant to be proven only on the live runner, have the checker say so explicitly for `stage: runtime` probe evidence.

**Multi-machine posture:** machine-local tests; this record travels with the repository.

**Closure (2026-09-29, desk):** option 3, per the design itself. docs/07-the-declarations.md P3-NF-25: "The build checks declarations; the runtime holder checks freshness." Runtime-stage evidence is proven by the runtime holder and the desk's live proofs, not by the CI run, so `scripts/check-register-contract-map.mjs` now requires a passing CI test only for held evidence whose stage is not `runtime` (16 runtime probes: the 9 that pass in CI still run as ordinary tests; these 7 are proven on the live runner by the pipeline's live-proof step after deploy). Build-stage fixtures (8) and the one build-stage probe keep the CI must-pass rule. Declarations are still build-checked (P3-NF-25).

# Six preview dark-feature graduation deadlines missed

**Status:** OPEN. **Owner:** Echo. **Missed ceiling:** 2026-10-31 00:00 UTC. **Discovered:** 2026-11-01 when the exact-head register replay failed after the parser capture deadlines were dispositioned. **Proposed bounded ceiling:** 2026-11-08 00:00 UTC, without changing any feature's `dark` status, test, metric, or coverage claim. These are governing declaration debts even though the declarations live in `tests/preview/journal.declarations.json`; they feed the published register and capability briefing.

| Feature | Existing evidence to inspect | Missing graduation proof and next action (Echo by Nov 6) | Acceptance or disposition |
| --- | --- | --- | --- |
| `preview-conversation` | `tests/preview/journal-conversations.test.ts`, `journal-conversation-session.test.ts` | Capture an ordinary live Telegram question and delivered reply through the installed journal runner, with the receipt and worker result joined. | Graduate only with live delivery and useful answer; otherwise keep dark and report the failure. |
| `preview-durable-memory` | `tests/preview/journal-memory-restart-soak.test.ts`, `journal-memory-correction.test.ts` | Verify a real correction survives runner restart and is used in a later live answer. | Graduate only with durable transcript evidence; otherwise keep dark and isolate the failing stage. |
| `preview-status-command` | `tests/preview/status-command.test.ts` | Send a real status request and verify a delivered journal-grounded reply, without a model request. | Graduate only with the delivered receipt and grounded status; otherwise keep dark. |
| `preview-upcoming-date-mention` | `tests/preview/journal-dated-memory.test.ts` | Save a real upcoming date and observe the bounded mention in the next eligible reply. | Graduate only on one correctly timed mention, with no duplicate; otherwise keep dark. |
| `preview-requested-actions` | `tests/preview/journal-requested-action.test.ts`, `requested-action-live-test.md` | Run an explicit later-time request end to end, including its scheduled send and receipt. | Graduate only on the promised-time delivered result with no duplicate; otherwise keep dark. |
| `preview-owned-obligations` | `tests/preview/journal-obligations.test.ts`, `obligation-task-answer-live.test.ts` | Record and discharge a real promised result in the correct conversation. | Graduate only on a delivered result linked to the original promise; otherwise keep dark. |

The deadline extension is a reviewable candidate, not proof or graduation. Echo will raise an operator attention item for the missed deadlines now, report which proof remains blocked by November 6, and either complete the missing proof or present an explicit retirement/rollback decision before the new ceiling. A failed proof does not trigger another silent extension. The register's real-time deadline walker stays in force.

Independent read-only review on November 1 found all six to be real published-replay debts and judged the bounded extension honest only with this open record, individual proof plans, no promotion, and exact operator approval before landing the published register. The candidate source commit can be prepared and tested before that approval.

## 2026-11-07: second miss, second bounded ceiling

The 2026-11-08 00:00 UTC ceiling passed with none of the November 1 conditions met: Echo did not report the remaining proof by November 6 and did not complete the proof or bring a retirement or rollback decision before the ceiling. The same miss applies to `rungraph-core` (`src/rungraph/rungraph.declarations.json`, gate P5-NF-54), which shared that ceiling and was hidden behind these six in the register check.

Decision (Echo, under standing authority for non-constitution changes; recorded 2026-11-07 19:05 PST): one further bounded ceiling, **2026-11-10 00:00 UTC**, for these seven gates only. No feature changes status; all stay `dark`. Nothing here is graduation or proof. `fetch-inbound-media` (2026-11-11 00:00 UTC) is unchanged.

What closes each one by the new ceiling: graduate on the live evidence named in the table above, or record retirement or keep-dark with the reason. A third extension is not available to Echo alone. If a gate has neither by the ceiling, its feature's retirement decision goes to the operator.

Structural change so the next ceiling cannot pass unseen: the desk pipeline's daily watch now lists every gate `deadline` and hold `ceiling` due within 48 hours on the live build, all in one pass.

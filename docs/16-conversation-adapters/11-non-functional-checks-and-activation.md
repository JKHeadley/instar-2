## 11. Non-functional checks and activation

**Rule — bounds name their subject, workload, and failure action.** Rules 13, 34, 39, 43, 55,
60, 61 and 64; **checks: P12-NF-30/39/40/46–48**.

| Property | Automatic workload and measurement | Bar and failure action |
|---|---|---|
| Capture-to-ack | Real platform events at idle, declared peak, boundary, and boundary-plus-one sizes; kill at write, flush, fact append, ack and cursor cuts | No protocol ack before durable custody; failed capture remains redeliverable or an owned outage |
| Ordinary service and backlog | Use a maximum of two eligible routes and two selections per round, with at most one first-service head selected from each route per round. Admit three items to route A under a per-route capacity of three. Add one healthy item to route B while continuously offering more work to A. Offer a fourth item to the full A route. Measure every item's admission, position, eligibility, round membership and first opportunity. Keep A1's owner result uncertain after its first opportunity and later admit a distinct observation wake for that same operation. | A1 and B1 receive opportunities in the first applicable round. A1 remains uncertain and owned. A2 and A3 still receive their first opportunities in the second and third rounds; A1 is not marked complete to free them. The later A1 observation wake receives membership under its own stable item identity without another invocation. Each first-service head is served by the first round close after eligibility. Every admitted item meets its `p + 1` round-duration admission bound. The fourth A item is preserved but receives `budget-exhausted` and never becomes an admitted member. P12-NF-40 is non-executable until the dated 08:03Z grant in `seam-response-loop-followup.md` (SEAM-LEDGER row 43) lands and its Part Six implementation integrates. |
| Stop precedence | Keep an ordinary claim live on one route during an open ordinary round. Send the same route an exact bound-operator stop and a resolved requester's stop-shaped signal in separate runs. | The exact operator stop bypasses eligibility and the live claim. It appends its local-durable stop fact and applies the local halt before further ordinary selection, without waiting for round close or replication. The requester signal also bypasses the round and claim, surfaces immediately, and never authorizes a halt. |
| Outbound uniqueness | Kill at preparation, claim, provider acceptance, observation, witness and settlement; lose and duplicate callbacks | At most one external semantic reply; unresolved cuts retain identity, exposure and zero replay |
| Formatting | Real captured bytes, malformed markup, unsafe links, Unicode, the null control character and other control data, adversarial nesting and declared size edges | Exact deterministic digest or explicit refusal; no meaning/audience/standing change and no unbounded parse |
| Conversation identity | Restart, reconnect, rename, archive, topic/thread roots, account churn, aliases and cross-platform forwards | Same authenticated tuple resolves the same history; churn holds binding; no content-based merge |
| Evidence honesty | Positive receipt, delayed receipt, forged callback, missing query, read/display signal, stale probe and unsupported stage | No stage promotion; nine records exact assessment or retained unknown |
| Recovery cost | Cold/warm rebuild of unresolved intake/outbox over release corpus on every deployment class | Recorded scanned facts/bytes, duration, peak memory and failures fit approved finite budgets; overrun blocks activation |
| Platform health | Cadenced authenticated identity, inbound and outbound canaries through production assembly with independent witness | Fresh exact-mode proof required; stale, failed or unavailable inhibits only unsupported scope and starts owned repair |
| Framework parity | Claude Code, Codex, and every enabled harness attempt the same reply and direct-credential escape cases | Public doorway succeeds; raw credential/provider access fails; missing harness evidence keeps that tuple dark |
| Notification bound | Many simultaneous permanent/transient failures, unavailable alert route and recovery flap | Existing alert destination, stable episode coalescing, finite attempts, no topic/notice storm or recursive send |
| Minimal conversation path | Kill an ordinary worker at start and restart; separately remove every required minimal dependency while sending authenticated messages | Fixed attributable ordinary reply within the measured bound only while every named prerequisite holds; otherwise preserved input where custody remains, one owned outage, and zero fabricated reply or replay |

**Rule — activation needs three tiers and fresh independent proof.** Rules 34, 37, 38, 43, 62,
72, 73, 81 and 105; **checks: P12-NF-12/19/20/44–50/53**. Unit checks cover pure identity, parser, formatter,
limit, dedup, and state-transition logic. Integration checks use actual persistence and every public
port, with a kill at each durable boundary. Live lifecycle checks use production initialization,
real platform credentials, real provider bytes, an authenticated test principal and conversation,
an enabled real harness, and part nine's independent witness. Critical inbound/outbound outcomes
also carry fresh probes and step supervision. Source inspection, a running process, a configured
token, a mock transport, or a self-reported green row cannot make an instance live. The remainder
of this block is the activation seam inventory referenced by the production fixtures.

Held-input redelivery and receipt-recovery positives are non-executable until
the receipt-continuation addendum to `seam-response-intake-followup.md` (SEAM-LEDGER row 46) lands
and its Four-owned implementation integrates. P12-NF-11's acknowledgment-policy arm and any mode
that depends on a conversational acknowledgment are non-executable until the “acknowledgment policy
consumer” addendum to `seam-response-intake-followup.md` (SEAM-LEDGER row 60) lands and its Four
implementation integrates with the landed Part Eight reply path. A mode that declares `judged` also
depends on the row-58 addendum in that file and its Four, Seven, and Ten implementations. The
protocol custody acknowledgment does not depend on either policy addendum. P12-NF-18's recurring
open-decision and reminder positive is non-executable until the “recurring open-decision reminder” addendum to
`seam-response-operator-followup.md` (SEAM-LEDGER row 59) lands and its Part Eleven and Ten
implementations integrate. Production
secret-intake activation is non-executable until `seam-response-intake-followup.md` and
`seam-response-assembly-followup.md` land and integrate the granted Four/Ten custody seam. Slack
activation is non-executable until the Four half in `seam-response-intake-followup.md`
(SEAM-LEDGER row 18), the stable-event commitment in that file's “stable event identity vs delivery
attempt” addendum (SEAM-LEDGER row 57), and the Seven versioned intake-policy judgment consumer in
the dated addendum to `seam-response-judgment.md` (SEAM-LEDGER row 35) land and integrate. A Slack ephemeral positive
is separately non-executable until the audience addendum in `seam-response-effects-followup.md`
(SEAM-LEDGER row 53) lands and integrates; unsupported ephemeral delivery does not block Slack's
ordinary-text mode. A real model-backed lifecycle is non-executable until `seam-response-judgment.md` and
`seam-response-effects-followup.md` land and integrate the Seven/Eight provider-effect seam. Real
effect settlement is non-executable until `seam-response-effects-followup.md` lands and integrates
the Nine/Eight assessment-consumption seam. P12-NF-43/44/48 stay declared and inhibited until those
integrations run with their real owners. Their production start/recovery/resume arms are separately
non-executable until the 08:48Z current-context delivery arms in
`seam-response-assembly-followup.md` and `seam-response-rungraph-followup.md` (SEAM-LEDGER row 45)
land and integrate Five's public consumption through `AssemblyHistoryReadPort`. The original
`HarnessLaunchSpec` remains the process-launch subject; the current step, input and manifest bind
through the immutable current delivery specification and observation. The 06:33Z row-38 arm in
`seam-response-rungraph-followup.md` remains the initial-context schema only, and flat compatibility
receipts cannot supply production evidence. P12-NF-53 and
affected production-wiring checks are
non-executable until the BUILT assembly seam accepted in `part-eleven-seam-response-assembly.md` is
integrated; a 1.x source audit or valid reply payload does not satisfy production assembly.

**Rule — release evidence stays exact across upgrades.** Rules 44, 45, 62, 76, 90 and 105;
**checks: P12-NF-45/46/49/50/52**. An upgrade enumerates every installed adapter instance, parser,
operation, formatter, wrapper, credential custodian, platform mode, harness tuple, old fact decoder,
and projection consumer. It replays retained captures, preserves unresolved operations and bindings,
and runs the affected real-account probes. Removed platform support becomes an explicit inhibited
capability with readable history. No migration deletes an uncertain send or silently changes a
conversation key, acknowledgment policy, provenance ceiling, or rendered-byte identity.

---

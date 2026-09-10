## 7. Outbound effects, formatting, and platform limits

**Rule — the immutable outbound subject exists before dispatch.** Rules 33, 42, 52, 60, 63
and 89; **checks: P12-NF-27/28/33**. The worker proposes part eight's `OutboundMessage` with
exactly the landed fields: semantic message identity, run, speaker, account, conversation, text,
the `ordinary-reply` purpose, and source-result reference. The account and conversation identify
the route. The speaker identifies the speaking principal. Existing run, result, authority,
provenance, disclosure, notification, decision, and landed start/recovery/resume grounding facts
are linked through the `sourceResult` lineage and `EffectRequest.closure`; they are not extra
`OutboundMessage` fields.
Attachments are unsupported and non-executable until `seam-response-effects-payloads.md` lands and
its granted Part Eight implementation is integrated. Part Eight hashes the
canonical whole message, and the request retains that digest. Current standing, binding,
lease/fence, stop state, register generation, durability demand, and resource reservation are
revalidated immediately before the dispatch-claim. After the claim commits, the exact closure that
includes the reservation and newly committed claim must meet the operation's durability demand;
authority, stop state, and validation expiry are then checked again. After the claim is consumed
once, the executor-acceptance observation and its causal reservation state meet the same demand and
the current operation and expiry are checked once more before the provider call. The stable effect
identity is recorded before the first provider call and survives worker death, machine transfer,
route recovery, and receipt loss.

**Rule — attribution is recorded even when display is compact.** Rules 28, 42 and 89;
**checks: P12-NF-27/42/43**. `OutboundMessage.speaker` names the speaking principal, while the
signed fact envelope and referenced `sourceResult` carry its provenance. The run and referenced
facts carry any agent, machine, harness, model, or fixed-template source evidence they actually
prove. `OperationDefinition.account` and `OutboundMessage.account` bind the transmitting platform
account. Unknown remains unknown. A display policy may omit an origin footer, but cannot erase the
referenced evidence or let a worker invent it. A session credential proves only the enrolled
session and operation preparation it actually covers.

**Rule — production grounding and compaction accounting are separate dependencies.** Rules 47, 96
and 110; **checks: P12-NF-42–44/48**. Five's landed `SessionGrounding` shape can record the actual
clock, full supported history coverage, current binding, and a consumption reference for a fresh
`start`, `recovery`, or `resume`. Its landed validator can prove consumption only with the flat
worker/harness/JSON-string receipt used by isolated compatibility fixtures. That receipt is not
Ten's production contract. The production path instead re-resolves the signed
`assembly-HarnessObservation` referenced by `SessionGrounding.consumption` through Ten's injected
public `AssemblyHistoryReadPort` and requires an admitted observation at phase
`context-consumed`. For initial context, the launch-based arm granted at 06:33Z in
`seam-response-rungraph-followup.md` (SEAM-LEDGER row 38) follows the admitted
`HarnessLaunchSpec`. For a later inbound or post-compaction context, the 08:48Z grants in
`seam-response-assembly-followup.md` and `seam-response-rungraph-followup.md` (SEAM-LEDGER row 45)
require Five to follow the observation's immutable current context-delivery specification. The
launch continues to bind the process, run, harness artifact, machine, and unchanged incarnation;
the current specification and observation bind the candidate step, exact intake/input and digest,
ordered current context manifest, current generation, execution context, boundary evidence,
message digests, briefing classes, delivery reason, admitted operation and one-use claim.

Inside the single `GroundingReadPort.read` invoked by `RunGraphPort.ground()`, Five samples the fresh
clock and current history/run/directive/register/pending-work state, asks Ten to append and resolve
the current delivery specification, drives the already-admitted delivery, witnesses and re-resolves
consumption, and only then returns the candidate grounding stamped with that sampled clock.
`transition(start)` repeats current signed-history resolution. P12-NF-43/44/48's production
positives are non-executable until both row-45 grant files land and their public Ten/Five
implementations are integrated; row 38 remains sufficient only for its initial-context schema.
Stale, wrong-kind, partial, conflicted, mismatched, missing-or-duplicate-manifest-row,
non-consumed, pre-completed, or retimestamped evidence refuses; the flat receipt cannot activate
production.

The landed record union also has no `ContinuityAccounting`, and its decoder expressly rejects
compaction accounting. A post-compaction first reply is therefore unsupported, not treated as an
ordinary resume and not made compliant by provenance fields. The final family design depends on
Five producing `ContinuityAccounting` and Eight requiring its exact reference before the first
post-compaction send, as requested in
`design-conversation-adapters-seam-request-rungraph-continuity.md`. Five's record is granted in
`seam-response-run-closure.md`, Five's public operations in `seam-response-rungraph-followup.md`,
and Eight's consumer in `seam-response-effects-followup.md`. P12-NF-43's compaction positive is
non-executable until all three grant files land and their implementations are integrated.

**Rule — formatting is a deterministic, recorded preparation step.** Rules 30, 33, 36, 42
and 89; **checks: P12-NF-29/31**. A formatter consumes admitted source text and produces exact
rendered text before the outbound decoder runs. That exact rendered string becomes
`OutboundMessage.text`, and Part Eight's request digest covers the whole closed message. Formatting
mode, safe-link decisions, and transformation evidence live in an existing source-result or
closure-referenced fact, not as undeclared message fields. Telegram HTML/Markdown and Slack's
`mrkdwn` markup syntax have captured real-byte fixtures for nesting, code, tables, Unicode, hostile
links, control characters, the formatter's temporary placeholder characters that protect extracted
code and table spans during transformation, and adversarial lengths. WhatsApp, iMessage, and web
declare their own modes. Applying the formatter twice, using a legacy pass-through mode, or
skipping conversion is explicit. Formatting cannot remove refusal wording, change speaker or
audience, interpret standing, add a command, or convert a held result into a sent one.

A user-facing delivery status may use its exact plain-language label or a registered emoji
equivalent. The emoji's accessible label and legend must name the same source-bounded stage, so an
emoji for “accepted by platform” cannot imply delivered or read. Changing words to an emoji is
rendering only: it cannot promote the underlying assessment, hide uncertainty, or erase the
recorded evidence. P12-NF-29/34 exercise the word and emoji forms against the same status fact.

**Rule — platform limits produce an explicit plan, never silent loss.** Rules 42, 52, 60 and
77; **check: P12-NF-30**. The adapter declares exact text, byte, entity, attachment, recipient,
rate, and ordering limits for the active API mode. In the landed slice, preparation either fits
one ordinary-text reply under `OperationDefinition.maxBytes` and the closed message's 4096-character
limit, or returns `Refused` with a usable remedy. It does not chunk, attach media, or truncate. A
finite ordered chunk/media expansion and its partial aggregate state depend on the requested Part
Eight seam. If that seam is accepted, every child needs its own immutable digest, observation, and
settlement, and aggregate completion requires every required child at its demanded stage. Partial
delivery stays partial. Any future truncation mode must be explicit in its operation definition,
retain the full source by reference, and place an honest visible marker in the rendered bytes.

**Rule — alternate rendering is unsupported in this slice.** Rules 42, 55, 60 and 63;
**checks: P12-NF-31/36/37**. A provider's definitive parse rejection is captured as evidence about
that exact immutable request. It does not authorize changed bytes. The landed settlement always
has `retryEligible: false`. Therefore the adapter returns the parse failure and usable remedy to
the owning run and makes no plain-text resend. Timeout, connection loss, or missing response
remains uncertain and also makes no resend. The retry contract granted in
`seam-response-effects-followup.md` and `seam-response-loop-followup.md` applies only to a new
attempt for the same logical request, semantic-message identity, and digest after decisive
closure. It does not permit a changed rendering, replacement payload, new digest, or distinct
operation for the same intended reply. This design defines no changed-rendering successor and
keeps that behavior unsupported. A provider software development kit (SDK) is the client library
used to call its API; its hidden retry is disabled or exposed as an unchanged-digest attempt
governed by the same records.

**Rule — advisory judgment cannot swallow the reply.** Rules 10, 12, 42, 46, 57, 67 and 86;
**checks: P12-NF-29/41**. A registered pre-send tone or clarity review goes through part seven and
returns its declared advisory decision. An unavailable ordinary advisory follows that consumer's
registered deliver-with-flags or no-objection policy. Deterministic credential, authority, stop,
and effect walls continue to apply independently. A hold or refusal returns to the owning run with
the exact reason and next permitted action. The adapter cannot loop for a different answer, treat
“not sent” as success, or discard the pending message.

---

# Stage 1 Telegram preview agent

This is a machine-local, supervised test driver, not the production entry or production-admission evidence. It uses the real production Telegram custodian and physical bridge, long-poll ingress, Four intake, Five run graph, fixture Six admission callbacks, and the real Eight Telegram reply operation. It stops before every provider/model path and can send only this model-independent text:

> PREVIEW — experimental test agent; production safeguards incomplete. Your message was preserved and grounded for this supervised trial. No model was called.

The prefix is present before HTML rendering, digesting, and Eight preparation. There is no provider SecretRef, route, model call, tool call, or model spend. `stage2GuardedProviderPath` is the closed Stage 2 seam.

## Prerequisites and exact invocation

A fresh checkout needs a matching `dist/` build first (`npm run build`); test fixtures imported by this driver resolve ignored build artifacts. Use a fresh absolute root on one machine, a preview-only bot, synthetic/non-sensitive messages, an already authorized trial, and these host-resolved SecretRefs:

| SecretRef | Host binding | Value |
|---|---|---|
| `vault=preview, name=telegram-bot-token` | `INSTAR_SECRET_PREVIEW_TELEGRAM_BOT_TOKEN` | preview bot token |
| `vault=preview, name=storage-key` | `INSTAR_SECRET_PREVIEW_STORAGE_KEY` | 32-byte lowercase hex or base64 key |

The values never belong in arguments or logs. The driver suppresses resolver/child diagnostics, but the bindings are still host-process environment custody, not independent secret isolation.

The desk's exact one-line private-chat trial invocation is:

```sh
node --loader ./scripts/slice-ts-loader.mjs tests/preview/agent.mjs run --root /ABSOLUTE/ISOLATED/PREVIEW_ROOT --bot-id BOT_ID --bot-username @BOT_USERNAME --operator-sender-id OPERATOR_TELEGRAM_USER_ID --chat-id OPERATOR_PRIVATE_CHAT_ID --chat-kind private --forum false --message-thread-id none --expires-at 2026-09-22T19:00:00Z --max-cycles 1000 --max-poll-seconds 5 --max-batch-items 8 --max-context-turns 8 --max-context-bytes 65536 --max-pending-turns 16 --max-trial-turns 128 --reply-limit 6 --reply-window-ms 60000 --error-limit 5 --backoff-ms 250 --max-backoff-ms 5000
```

Replace the example expiry and placeholders with the desk-approved values. Private chat is first-class and is the narrowest audience. For an authorized forum topic, use `--chat-kind group-topic --chat-id -100… --forum true --message-thread-id TOPIC_ID`. Only the bound operator can trigger a reply, but a group/topic reply is visible to everyone who can see that group/topic; sender binding does not make it private.

## Stops, bounds, and status

Use the identical configuration with `status` or `stop` instead of `run`. Both are pull-only local operations; there is no server or dashboard. `stop` writes a separate monotonic latch. SIGINT and SIGTERM write the same latch, and the successful loop yields after physical boundaries so the latch is checked before later admission or dispatch.

Cancellation cannot retract a call already entered. The physical bridge permits approximately 32 seconds for identity or send and `maxPollSeconds + 7` seconds for a poll, plus unbounded-by-transport local synchronous owner work. That is the true worst-case signal delay; an external process/credential stop remains necessary for a supervised trial.

The durable limits are the finite expiry, total retained-turn bound, pending-work bound, maximum Telegram batch, context turn/byte bounds, breaker, and reply brake. Restart does not reset them. The reply brake is a conservative fixed window, not a strict rolling “six in every trailing minute” limiter. `max-cycles` is per process and is only an additional loop bound.

## Durability and restart tiers

- The production storage under the root holds the main Telegram/Four facts and captures encrypted with `storage-key`, including the custodian cursor journal and issued update captures.
- `preview-state.json` and `preview-stop.json` are plaintext machine-local control records. They retain trial identity, configuration digest, expiry, cursor seed, capacity/rate/error counters, intake disposition, context identity, run proof path, and reply phase.
- `.preview-runs/*/facts.json`, `captures.json`, and `run-proof.json` are fsynced plaintext test-owned stores. They retain the actual Five opening/grounding facts, fixture Six admission witness set, exact bounded context identities, schemas/register metadata, and required captures. The driver reconstructs and byte/hash-checks this owner state before dispatch and on restart.
- `.preview-effects/*/origin/facts.json`, peer facts, and origin/peer captures are plaintext fixture stores. The “peer” is a second directory on the same machine, not an independent replica or shared-disk-loss protection.

All of these tiers may contain message material or metadata. The isolated root must be protected and disposed of as trial data. None is portable production history.

The intake receipt uses the production custodian's issued public update-capture reference. After each captured batch, the preview durably records the owner-derived next offset; reopening supplies that offset as the admitted cursor baseline. Before every new poll, the driver reconciles all durable Four admissions, holds, stops, refusals, and unresolved receipts into semantic turn identities. A duplicate never creates a fresh admission or changes the original disposition.

A turn is reply-eligible only after its durable run records and captures reconstruct exactly. The irreversible boundary is preceded by `dispatch-outcome-unknown`; every ambiguous, rejected, or unrecorded response remains there forever, is never resent, and increments the error breaker. Only an Eight `response` observation whose retained Telegram bytes exactly validate `ok:true`, positive message ID, bound chat/topic, and fixed text becomes `api-accepted`. That label means Bot API acceptance only, never human delivery or reading. The reply doorway has `assessment: null`; fixture Nine does not certify Telegram.

## Context and audience

Four preserves all recorded neighbours. Only an exact bot identity, operator sender, chat, and (for a forum) topic receives contextual standing or a reply. The run store retains excluded facts unchanged as evidence, while the test-owned grounding read projection removes excluded `intake-admitted` rows from the stimulus selection without rewriting their signed bytes. Context over either configured bound pauses the admitted turn; it does not silently discard older admitted context.

## Complete stand-in ledger

| Name | Tier and honest limit |
|---|---|
| `fixture-governance-and-register` | simulated authority; test declarations/conformance only |
| `fixture-signing-and-standing-grants` | simulated authority; fixture signatures satisfy code checks, not operator authority |
| `fixture-clock-and-verification-host` | simulated clock/verification host only |
| `fixture-five-six-run-admission-capacity` | fixture Five opening/grounding and fixture Six admission/capacity only |
| `fixture-context-assembler` | bounded test-owned grounding selection, not production context authority |
| `fixture-run-file-storage-and-capture-custody` | fsynced plaintext local files returning test `local-durable` success |
| `fixture-in-memory-authority-and-capture-indexes` | working fixture indexes/helpers; required captures are copied to the run files |
| `fixture-five-grounding-consumption` | simulated internal context-consumption receipt |
| `fixture-native-launch-and-process-descriptor` | dormant fixture launch/`pid:42:start:1` descriptor; Native delivery is not invoked |
| `fixture-context-delivery-nine-evidence` | dormant `happened`, `finalCharge: 0`, `delayedExecutionExcluded: true` instrument; not invoked |
| `fixture-independent-protection-posture` | dormant `independentProtection: protected` descriptor |
| `fixture-model-and-persistence-descriptors` | dormant model/persistence descriptors; no model exchange is invoked |
| `fixture-effect-peer-directory` | live safeguard substitution: same-machine directory mechanically satisfies `replicated(1)` for the real send, but is not replication |
| `fixture-five-source-result` | fixed-response source marker, not a model answer |
| `fixture-reply-nine-assessor` | present in the fixture but deliberately disconnected via `assessment: null` |
| `real-telegram-effect` | actual Bot API `sendMessage`; exact API acceptance only |

The actual live-effect authorization still comes from the separately recorded operator trial grant and any required waivers. This code and its PREVIEW label grant none.

## Recorded verification

The suite never sets `INSTAR_TELEGRAM_LIVE_TEST` and uses an offset-respecting recorded transport, including real launcher processes for SIGTERM and SIGINT:

```sh
npx vitest run tests/preview/preview.test.ts --configLoader=runner
```

Graduation requires replacing every stand-in with its named hardening unit, especially G6 exact-response acceptance and the separate reply run, then starting from a fresh production root. Never import preview fixture authority or history into production.

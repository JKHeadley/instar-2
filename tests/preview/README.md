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
node --loader ./scripts/slice-ts-loader.mjs tests/preview/agent.mjs run --root /ABSOLUTE/ISOLATED/PREVIEW_ROOT --bot-id BOT_ID --bot-username @BOT_USERNAME --operator-sender-id OPERATOR_TELEGRAM_USER_ID --chat-id OPERATOR_PRIVATE_CHAT_ID --chat-kind private --forum false --message-thread-id none --expires-at 2026-09-22T19:00:00Z --max-cycles 1000 --max-poll-seconds 5 --max-batch-items 8 --max-context-turns 8 --max-context-bytes 65536 --max-pending-turns 16 --max-trial-turns 128 --reply-limit 6 --reply-window-ms 60000 --error-limit 20 --total-error-limit 1000 --backoff-ms 250 --max-backoff-ms 60000
```

Replace the example expiry and placeholders with the desk-approved values. Private chat is first-class and is the narrowest audience. For an authorized forum topic, use `--chat-kind group-topic --chat-id -100… --forum true --message-thread-id TOPIC_ID`. Only the bound operator can trigger a reply, but a group/topic reply is visible to everyone who can see that group/topic; sender binding does not make it private.

## Stops, bounds, and status

Use the identical configuration with `status` or `stop` instead of `run`. Both are pull-only local operations; there is no server or dashboard. `stop` writes a separate monotonic latch. SIGINT and SIGTERM write the same latch. Grounding and dispatch are separate launcher steps: after durable grounding the launcher yields to the event loop, then the dispatch gate checks the latch before any reply call.

Cancellation cannot retract a call already entered. The physical bridge permits approximately 32 seconds for identity or send and `maxPollSeconds + 7` seconds for a poll. Local synchronous owner work has no transport-derived time bound. Those are the true shutdown bounds; an external process/credential stop remains necessary for a supervised trial.

The durable limits are the finite expiry, total retained-turn bound, pending-work bound, maximum Telegram batch, context turn/byte bounds, two error ceilings, and reply brake. Restart does not reset them. `consecutiveErrors` is reset durably by every successful poll cycle, including an empty poll; `totalErrors` never resets and finitely stops a flapping trial at `--total-error-limit`. An unknown dispatch increments both counters and is never resent; a later successful poll may clear only its consecutive count. Legacy v2 state conservatively migrates its old cumulative counter into `totalErrors` and resets the unknowable old streak once. With the documented invocation, 20 uninterrupted cycle failures stop the trial, 1000 total failures stop it regardless of successes, context is capped at 8 admitted turns, and the reply brake is a fixed window of 6. `max-cycles` is a per-process cycle counter and is only an additional loop bound.

For a multi-day supervised trial, the reviewed recommendation is `--error-limit 20 --max-backoff-ms 60000` together with the explicit finite `--total-error-limit 1000`. The backoff is exponential from `--backoff-ms` and capped at that maximum. Stop signals and the durable stop/expiry gates interrupt a backoff in at most roughly 100 ms plus local synchronous state work; an already entered transport or owner call retains the separate non-cancellation bounds above.

Cycle diagnostics are one-line fixed-schema JSON on stderr. Their reason is selected only from `TRANSPORT`, `TIMEOUT`, `REFUSED`, `STOPPED`, `EXPIRED`, `BOUND`, or `UNKNOWN`; the phase is selected only from `DRAIN` or `POLL`; and the only variable values are bounded consecutive/total counters and bounded backoff milliseconds. `TRANSPORT`, `TIMEOUT`, and `REFUSED` come only from the production bridge's closed typed poll outcome; an unclassified or thrown value is always `UNKNOWN`. The launcher never reads or emits its name, message, stack, cause, stderr, URL, path, payload, or other fields. Breaker accounting is durably recorded before diagnostic construction/emission, and a diagnostic sink failure cannot bypass it.

## Durability and restart tiers

- The production storage under the root holds the main Telegram/Four facts and captures encrypted with `storage-key`, including the custodian cursor journal and issued update captures.
- `preview-state.json` and `preview-stop.json` are plaintext machine-local control records. They retain trial identity, configuration digest, expiry, cursor seed, capacity/rate/error counters and both immutable error ceilings, intake disposition, context identity, run proof path, and reply phase.
- `.preview-runs/*/facts.json`, `captures.json`, and `run-proof.json` are fsynced plaintext test-owned stores. They retain the actual Five opening/grounding facts, fixture Six admission witness set, exact bounded context identities, schemas/register metadata, and required captures. The driver reconstructs and byte/hash-checks this owner state and runs the stock grounding decoder and unchanged Five coverage validator during recovery and again before dispatch.
- `.preview-effects/*/origin/facts.json`, peer facts, and origin/peer captures are plaintext fixture stores. The “peer” is a second directory on the same machine, not an independent replica or shared-disk-loss protection.

All of these tiers may contain message material or metadata. The isolated root must be protected and disposed of as trial data. None is portable production history.

The intake receipt uses the production custodian's issued public update-capture reference. After each captured batch, the preview durably records the owner-derived next offset; reopening supplies that offset as the admitted cursor baseline. Before every new poll, the driver reconciles all durable Four admissions, holds, stops, refusals, and unresolved receipts into semantic turn identities. A duplicate never creates a fresh admission or changes the original disposition.

A turn is reply-eligible only after its durable run records and captures reconstruct exactly. The irreversible boundary is preceded by `dispatch-outcome-unknown`; every ambiguous, rejected, or unrecorded response remains there forever, is never resent, and increments the error breaker. Only an Eight `response` observation whose retained Telegram bytes exactly validate `ok:true`, positive message ID, bound chat/topic, and fixed text becomes `api-accepted`. That label means Bot API acceptance only, never human delivery or reading. The reply doorway has `assessment: null`; fixture Nine does not certify Telegram.

## Context and audience

Four preserves all recorded neighbours. A wrong verified bot identity refuses composition. A test-side exact-route gate causes wrong sender, chat, or forum topic inputs to remain Four-held; they receive no contextual standing or reply. Grounding uses normal arrays and the current admitted opening as its durable frontier, so later messages in the same batch are future history for that turn while earlier bound messages remain covered. The same saved grounding must pass Five's unchanged stock validation after establishment, during recovery, and before dispatch. Context over either configured bound pauses the admitted turn; it does not silently discard older admitted context.

## Complete stand-in ledger

| Name | Tier and honest limit | Replacement unit |
|---|---|---|
| `fixture-governance-and-register` | simulated authority; test declarations/conformance only | M3 Part B / M3-S |
| `fixture-signing-and-standing-grants` | simulated authority; fixture signatures satisfy code checks, not operator authority | M3 Part B / M3-S |
| `fixture-clock-and-verification-host` | simulated clock/verification host only | M4 host |
| `preview-route-hold-gate` | simulated authority; test-side exact allowlist turns nonmatching routes into Four holds | M3 Part B / M3-S |
| `fixture-five-six-run-admission-capacity` | fixture Five opening/grounding and fixture Six admission/capacity only | M3-I capacity |
| `fixture-context-assembler` | bounded test-owned grounding selection, not production context authority | M4-L launch |
| `fixture-run-file-storage-and-capture-custody` | fsynced plaintext local files returning test `local-durable` success | M4 custody |
| `fixture-in-memory-authority-and-capture-indexes` | working fixture indexes/helpers; required captures are copied to the run files | M4 custody |
| `fixture-five-grounding-consumption` | simulated internal context-consumption receipt | M4-L launch |
| `fixture-native-launch-and-process-descriptor` | dormant fixture launch/`pid:42:start:1` descriptor; Native delivery is not invoked | M4-L launch |
| `fixture-context-delivery-nine-evidence` | dormant `happened`, `finalCharge: 0`, `delayedExecutionExcluded: true` instrument; not invoked | M4 G6, including Nine |
| `fixture-independent-protection-posture` | dormant `independentProtection: protected` descriptor | M4 host / M5 |
| `fixture-model-and-persistence-descriptors` | dormant model/persistence descriptors; no model exchange is invoked | M4 G6, including Nine / M4 custody |
| `fixture-effect-peer-directory` | live safeguard substitution: same-machine directory mechanically satisfies `replicated(1)` for the real send, but is not replication | M5 |
| `fixture-five-source-result` | fixed-response source marker, not a model answer | M4 G6, including Nine |
| `fixture-reply-nine-assessor` | present in the fixture but deliberately disconnected via `assessment: null` | M4 G6, including Nine |
| `real-telegram-effect` | actual Bot API `sendMessage`; exact API acceptance only | M5 |

The actual live-effect authorization still comes from the separately recorded operator trial grant and any required waivers. This code and its PREVIEW label grant none.

## Recorded verification

The suite never sets `INSTAR_TELEGRAM_LIVE_TEST` and uses an offset-respecting recorded transport, including real launcher processes for SIGTERM and SIGINT:

```sh
npx vitest run tests/preview/preview.test.ts --configLoader=runner
```

Graduation requires replacing every stand-in with its named hardening unit, especially G6 exact-response acceptance and the separate reply run, then starting from a fresh production root. Never import preview fixture authority or history into production.

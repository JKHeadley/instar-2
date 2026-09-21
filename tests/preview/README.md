# Stage 1 Telegram preview agent

This is a supervised developmental test driver. It is not the production entry, a production admission receipt, or evidence that the incomplete safeguards are real. It uses the real Telegram custodian, long-poll ingress, Four intake, Five run graph, Six admission calls, Eight effect doorway, and Telegram reply operation. It stops before any provider/model path and sends only this fixed model-independent response:

> PREVIEW — experimental test agent; production safeguards incomplete. Your message was preserved and grounded for this supervised trial. No model was called.

There is no provider route, provider credential, model call, tool call, or model spend in Stage 1. `stage2GuardedProviderPath` is the deliberately closed seam for the later G6 exact-response work.

## Live trial invocation

The host secret resolver must expose exactly these references before launch; the values must not be placed in arguments or logs:

| SecretRef | Host binding | Required value |
|---|---|---|
| `vault=preview, name=telegram-bot-token` | `INSTAR_SECRET_PREVIEW_TELEGRAM_BOT_TOKEN` | Telegram bot token |
| `vault=preview, name=storage-key` | `INSTAR_SECRET_PREVIEW_STORAGE_KEY` | 32-byte lowercase hex or base64 key |

No `anthropic-api-key` is read in Stage 1. The bot ID and username must match the token's live `getMe` identity. The sender, chat, and optional forum topic are one immutable allowlist. Use a fresh absolute root dedicated to this preview and synthetic/non-sensitive messages only.

From the repository root, the desk's one-line invocation is:

```sh
node --loader ./scripts/slice-ts-loader.mjs tests/preview/agent.mjs run --root /ABSOLUTE/ISOLATED/PREVIEW_ROOT --bot-id BOT_ID --bot-username @BOT_USERNAME --operator-sender-id OPERATOR_TELEGRAM_USER_ID --chat-id ALLOWED_CHAT_ID --forum false --message-thread-id none --expires-at 2026-09-22T19:00:00Z --max-cycles 1000 --max-poll-seconds 5 --max-batch-items 8 --max-context-turns 8 --max-context-bytes 65536 --reply-limit 6 --reply-window-ms 60000 --error-limit 5 --backoff-ms 250 --max-backoff-ms 5000
```

The expiry in that command is an example finite window and must be replaced with the desk-approved trial deadline. A run also ends after `--max-cycles`; it is not immortal. Polling is single-flight, errors use bounded exponential backoff, five consecutive errors latch the breaker, and replies are capped to six per minute by the durable outer ledger.

Use the same arguments with `status` or `stop` in place of `run`. These are pull-only local operations; there is no status server or dashboard. `stop` writes a separate durable monotonic latch, while SIGINT and SIGTERM write the same latch. The driver checks it before composition/admission, polling, owner work admission, and dispatch. A long poll or an already-entered synchronous Telegram call can delay shutdown by its configured timeout; stop cannot retract a request already sent.

## Durable/restart behavior

`preview-state.json`, `preview-stop.json`, encrypted owner facts/captures, and the production root lease live under the isolated root. The trial ID, configuration digest, allowlist, expiry, rate bounds, turn identities, context references, and reply phases survive restart. A changed configuration is refused. A nonempty established root with a missing trial identity is refused rather than silently reinitialized.

Each inbound Telegram update has one semantic turn identity. A cut after intake resumes owner grounding and reply preparation. Immediately before the irreversible reply call the state advances to `dispatch-outcome-unknown`; therefore a cut during or after dispatch is never treated as “not sent” and is never retried. A successful API response advances it to `sent`, which means only that the recorded provider response was observed—not that a human received or read it. Unknown outcomes remain unknown.

Out-of-scope updates still pass through the real custodian and Four preservation path, then remain `ignored-out-of-scope`; the preview never replies to them. Preceding allowlisted captures are indexed into a bounded context set before the real Five open/ground exercise. Hitting a context bound pauses the turn instead of deleting accepted history.

## Stand-in ledger

These stand-ins describe only the recorded test world. They confer no live approval, custody, capacity, confinement, charge, quiescence, delivery, or production-admission claim.

| Name | Honest claim | Replacement unit |
|---|---|---|
| `fixture-governance-and-register` | test declaration/conformance authority only | M3 Part B / M3-S |
| `fixture-signing-and-standing-grants` | test identity and binding authority only | M3 Part B / M4 custody |
| `fixture-clock-and-verification-host` | recorded freshness and assessment only | M4 host |
| `fixture-five-six-run-admission` | recorded run opening, grounding, fence, and reservation only | M3-I capacity / M4 host |
| `fixture-context-assembler` | bounded preview index, not Five production grounding evidence | M4-L launch |
| `fixture-effect-peer-directory` | second local directory, not a surviving replica | M4-L launch |
| `fixture-nine-effect-assessor` | recorded assessment, not independent live evidence | M4 G6 including Nine |
| `fixture-five-source-result` | fixed-response source marker, not a model answer | M4 G6 including Nine |

The conservative preview state and rate ledger are outer brakes, not owner accounting or delivery records. The real Telegram effect is authorized only by the operator's separately approved live trial scope; this README grants no waiver or launch approval.

## Exit and graduation criteria

Stage 1 exits when the focused recorded suite proves two meaningful turns, outsider preservation without reply, restart after intake, restart after dispatch without repetition, stop/expiry behavior, fixed labels on every outbound payload, and ledger completeness. A real transport trial is additional evidence only when the desk has approved the exact bot/audience/expiry/credential custody and any required live-effect exceptions.

Graduation requires replacing each ledger entry with its named unit's genuine evidence, especially G6's exact response acceptance and separate reply run. Graduate into a fresh production installation/root; never import this fixture authority or test history. Do not remove the preview label based on this driver.

Focused recorded test (never sets `INSTAR_TELEGRAM_LIVE_TEST`):

```sh
npx vitest run tests/preview/preview.test.ts --configLoader=runner
```

`--configLoader=runner` avoids Vite attempting to write through this worktree's read-only `node_modules` symlink; it does not change test semantics.

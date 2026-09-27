# Stage 1 Telegram preview agent

This is a machine-local, supervised test driver, not the production entry or production-admission evidence. It uses the real production Telegram custodian and physical bridge, long-poll ingress, Four intake, Five run graph, fixture Six admission callbacks, and the real Eight Telegram reply operation. It stops before every provider/model path and can send only this model-independent text:

> PREVIEW — experimental test agent; production safeguards incomplete. Your message was preserved and grounded for this supervised trial. No model was called.

The prefix is present before HTML rendering, digesting, and Eight preparation. There is no provider SecretRef, route, model call, tool call, or model spend. `stage2GuardedProviderPath` is selected only by explicit Stage 2 activation; the Stage 1 path remains closed to model work.

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

The fixture binding is authored for the configured Telegram sender principal, not the sender from a canned Telegram fixture. Its target grant expires with the durable trial; the outer state gate uses the launcher's wall clock and prevents work before creation or after expiry. The Four fixture authority and its signed fact lineage still use their fixture causal clock; they do not claim to be a production clock. A live-shaped private `/start` (including `bot_command` entities and ordinary Telegram `from` metadata) is authenticated by the real Telegram adapter and selects the configured-principal binding.

An admission is immutable. A turn already stored as `admitted-unbound` remains `ignored-out-of-scope`, is never re-admitted under a later corrected binding, and receives no retroactive reply. Operators should retain that record as evidence and send a new turn only under an authorized corrected trial; they must not edit or replay the old turn as if it had been bound.

A turn is reply-eligible only after its durable run records and captures reconstruct exactly. The irreversible boundary is preceded by `dispatch-outcome-unknown`; every ambiguous, rejected, or unrecorded response remains there forever, is never resent, and increments the error breaker. Only an Eight `response` observation whose retained Telegram bytes exactly validate `ok:true`, positive message ID, bound chat/topic, and fixed text becomes `api-accepted`. That label means Bot API acceptance only, never human delivery or reading. The reply doorway has `assessment: null`; fixture Nine does not certify Telegram.

## Context and audience

Four preserves all recorded neighbours. A wrong verified bot identity refuses composition. A test-side exact-route gate causes wrong sender, chat, or forum topic inputs to remain Four-held; they receive no contextual standing or reply. Grounding uses normal arrays and the current admitted opening as its durable frontier, so later messages in the same batch are future history for that turn while earlier bound messages remain covered. The same saved grounding must pass Five's unchanged stock validation after establishment, during recovery, and before dispatch. Context over either configured bound pauses the admitted turn; it does not silently discard older admitted context.

## Complete stand-in ledger

| Name | Tier and honest limit | Replacement unit |
|---|---|---|
| `fixture-governance-and-register` | simulated authority; test declarations/conformance only | M3 Part B / M3-S |
| `fixture-signing-and-standing-grants` | simulated authority; fixture signatures, configured-principal binding, and a target grant expiring with the trial satisfy code checks, not operator authority | M3 Part B / M3-S |
| `fixture-clock-and-verification-host` | simulated causal clock/verification host only; the outer durable trial gates separately use wall time | M4 host |
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

## Stage 2: one supervised subscription answer

`run --stage 2` explicitly selects the implemented provider path. Stage 1 remains the default and
refuses a root with a Stage 2 sidecar. Stage 2 accepts only bot `8820318295` /
`@echo_mmtest_seam_b27x_bot`, private chat and sender `7812716706`, with no topic. Its fixed expiry
is `2026-10-05T20:40:00Z` (`1791232800000`), a one-week status-quo renewal of `2026-09-28T20:40:00Z`
(see "Activation renewal" below). Existing trial limits, cursor and counters carry forward.
This is the recorded supervised, unconfined preview waiver, not production admission or a
replacement for M3/M4/M5. No code default supplies the model, login profile or activation record.

Use the existing Stage 1 command/configuration, its unchanged limits and SecretRef environment,
with the fixed audience/expiry above and these additional arguments:

```sh
--stage 2 --activation-record /ABSOLUTE/activation.json --login-profile /ABSOLUTE/profile.json --model DESK_EXACT_CLAUDE_MODEL_ID --activation-cutoff DESK_EPOCH_MILLISECONDS --arm true
```

`--arm true` permits first creation of the sidecar, not resetting it. Restarts may omit it.
Missing sidecar with owner facts refuses, as do changed activation/profile/model/policy/cutoff or
configuration. Deleting or altering the activation file closes the active route. There is no
separate model smoke call. The desk provisions subscription login and supplies an exact reviewed
model ID; no API key, `--max-budget-usd`, paid fallback, automatic retry or dollar allowance exists.
All CLI tests spawn a synthetic executable; no test launches the installed CLI, authenticates,
or contacts a model or Telegram. Keep `INSTAR_TELEGRAM_LIVE_TEST` unset.

The desk supplies this non-secret `ProviderSubscriptionProfile` JSON, which the launcher freezes:

```text
type: "ProviderSubscriptionProfile", schemaVersion: 1
reference, home, configDirectory, workingDirectory
expectedAccount, organization, plan (pro|max|team|enterprise)
loginProfileIdentity, executable, artifact, version: "2.1.280"
activationReference, managedConfigurationDigest
```

All three directories must be canonical, private mode 0700, owned by the host user, distinct and
outside the repository and ordinary home; workingDirectory is empty. `executable` is its canonical
regular-file path and `artifact` is its SHA-256. The physical host's `inspectSubscriptionProfile`
computes the directory-identity (canonical path plus inode per directory; the device number is excluded
because macOS renumbers it across a reboot) and supported managed-configuration digests. It reads no token or
Keychain bytes. Managed helpers/unknown settings, MDM policy and cached remote/server policy
(including orphan signature companions) are holds. The pinned 2.1.280 auth parser requires exact
account/organization/plan/profile and claude.ai first-party auth; unexpected status shapes refuse.
Safe mode and fixed tool/MCP/hook/session/retry options apply to the model command, under a
six-variable environment allowlist. This is bounded host inspection, not independent confinement.

The matching `SubscriptionActivationRecord` JSON has all these fields:

```text
type: "SubscriptionActivationRecord", schemaVersion: 1
reference, waiver, p11, reviewedHead, trial, baseConfigurationDigest, profileDigest
executable, artifact, version, model, invocationPolicyDigest
expectedAccount, observedAccount, authSource: "claude.ai"
operatorAssertion, assertedAt, observer, observedAt, method, safeCaptureReference
extraUsage: "observed-disabled" | "operator-asserted/unobservable" | "contradicted"
extraUsageReason
subscriptionLimit: "available" | "unobservable" | "exhausted"
subscriptionLimitReason, acceptedResiduals: string[], expiresAt: 1791232800000
```

Digests are canonical SHA-256: profileDigest over the frozen descriptor, invocationPolicyDigest
over `subscriptionInvocationPolicy(model)`, baseConfigurationDigest from the inherited trial.
`reference` equals profile.activationReference. The desk supplies the reviewed head, waiver/P-11
references, exact observed/asserted account evidence, timestamps and safe capture reference.
Contradicted extra usage or known exhaustion refuses. Unobservable extra usage is expressly the
operator's assertion, never relabelled measurement. Estimated cost in a CLI return is not a bill.

The fixed 1424-byte `SUBSCRIPTION_PREVIEW_SYSTEM_PROMPT` goes only in the model command's
single replacement `--system-prompt` argument. Stdin remains the exact canonical Seven envelope;
its context is exactly `{bindings, conversationKind:'captured-telegram-updates', conversation}`.
All selected Telegram updates remain in order, including prior operator messages. No transcript
projection, prompt file, appended default prompt, `--json-schema`, repair or prose wrapping occurs.
Version/auth probes retain their original arguments and the same six-variable environment.

The combined UTF-8 system plus exact stdin limit is 4096 bytes (at most 2672 stdin bytes).
Measure it before dispatch intent and again before any subscription child command. Safe bound
lengths include system, submitted and prompt bytes; JSON escaping and multibyte text count.
The stdin-only policy/description/Seven/approved Eight declaration remains 4096 as well.
Input overflow preserves the turn/context and lengths and holds before model launch. No trimming,
summarization, context dropping or second call is permitted. Independent bounds are Decision
16384, raw terminal 65536, source/terminal metadata 8192 each, backing capture capacity 1048576,
output tokens 2048 and model timeout 120000 ms. Seven reserves 330416 response bytes before
physical invocation: receipt210264 + rawbase6487384 + answer16384 + 2×metadata8192. Existing
retained input and other captures also consume backing capacity.

The original eleven-field source-contract and terminal authority attestations remain exact.
A separate signed `evidence-record` has predicate `preview-invocation-binding`, strength
`attestation`, source `probe`, subject the prepared ProviderJudgmentRequest record id and ID
`proof:preview-invocation-binding:<q.id>`. Its complete canonical claim is captured: schemaVersion
1; activationReference/activationDigest/profileDigest; invocationPolicyDigest/systemPromptDigest;
framing `preview-decision-system-v2`; complete frozen invocationPolicy; full request/prepared fact
references including contentHash; effectRequest, run, attempt, submitted and submittedDigest.
Policy/profile/activation digests hash canonical objects; systemPromptDigest hashes the raw UTF-8
literal. submittedDigest remains the canonical-string hash of exact stdin. This local attestation
identifies policy plus input; it is not independent execution proof and never enters Ten's source
or terminal roster, Nine's response subject, or Seven's answer evidence.

Append it after genuine Seven/Eight preparation and before dispatch intent. Repeated preparation
requires exactly one identical claim/capture/join. An interrupted append can finish only before
claim/consumption; missing evidence after dispatch is corruption. Preview preparation, dispatch
and historical readers verify the signed chain, complete capture, owner joins, policy/system
identity and combined bound. Legacy v1 history remains inspectable without retrofitting this
fact; v2 policy or successor lineage requires it once preparation has completed.

Selection persists an epoch-millisecond start and deadline exactly 300000 ms apart. Six's original
lease and loop use that same clock domain as Eight current and Seven deadline. At least five
minutes must remain in the inherited trial; restart, owner reconstruction or a late return cannot
reset the deadline or extend expiry. Five projection watermarks use the same sampled clock as
their read, and preview grounding maxAge is bounded by that 300000-ms window. Nine and Eight sample one
clock per synchronous assessment or effect transaction; subsequent owner use and all physical gates
read current time again. The async launcher yields and awaits every phase; signal,
stop, revocation, expiry and owner deadline gates suppress subsequent effects. The physical child
is polled for stop every 25 ms and killed on stop/timeout, without claiming remote quiescence.

Stage 2 connects actual Four input, a pending Five provider Run, genuine Six authority, Seven
request/receipt, Eight dispatch/settlement, Nine output assessment and Seven acceptance in one
signed owner store. Five opens and grounds the one dependent reply Run; Six admits its fixed pair
and genuine reservation/claim/dispatch; Eight prepares the exact Telegram message. The text comes
from the signed accepted Decision, with the fixed PREVIEW label and deterministic HTML escaping.
The complete canonical OutboundMessage must fit the existing <=4096 definition, including metadata
and escaping. Overflow holds even when the visible text itself fits. No adapter rewrites it.

Declared provider monetary demand is 0; observed charge and finalCharge remain null,
delayedExecutionExcluded false. Original Six actualCharge is -1, unresolved 1, released 0,
retryEligible 0, exposure 0. The provider Run's pending step and original conversation obligation
remain. The reply cannot invoke the model. A terminal held or API-accepted outcome ends model
work and ordinary poll-driven replies; even a second new turn cannot consume another slot.

Stage 2 adds these disclosed substitutions to the ledger above (Stage 1's inactive model and
fixed source-result rows apply only to Stage 1):

| Substitution | Stage 2 implementation and limit |
|---|---|
| Governance, register, signing, grants and original placement/capacity | Preview fixture authority remains waived; actual Five admission writes and actual Six dispatch replace Stage 1 dispatch callbacks. |
| Context consumption | Full retained selected context and stock grounding validation; internal consumption witness remains a local preview attestation. |
| Evidence strength | Real Nine owner assesses local recorded source/terminal contracts and observed occurrence. No independent provider authenticity, settled charge or quiescence proof. |
| Custody | `.preview-stage2/facts.json` and content-addressed captures are fsynced plaintext. A real replica-storage adapter and copied/readback captures use a second same-machine directory; shared-disk loss is not covered. |
| Model | The explicit pinned subscription route is available only for desk activation; offline fixtures supply synthetic CLI/Decision responses. |
| Telegram assessment | Genuine custodian/Eight response capture, exact API acceptance validation; no human-delivery claim and no Nine Telegram assessor. |

`preview-stage2-state.json` retains version/trial/root/config/activation/policy/cutoff, exclusions,
selected turn and exact context references/digest, original start/deadline, consumed model slot,
phase, fact/operation references and terminal latch. Holds retain closed reason codes, safe byte
lengths and references. `status` exposes these local controls; child exceptions/output are suppressed.
Unknown provider launch or send remains held across restart. A complete preserved response may
finish only its original owner chain while authority is current. Durable API acceptance repairs
outer status without a second send. Corrupt/missing state and owner/sidecar disagreement refuse.

### Activation renewal

A status-quo renewal keeps the same account, profile directories, pinned CLI, model and
invocation policy, and moves only the reviewed expiry (`SUBSCRIPTION_PREVIEW_EXPIRY`). The
desk writes the fresh observation as JSON with exactly these fields: `reference`,
`reviewedHead`, `assertedAt`, `observedAt`, `method`, `observer`, `safeCaptureReference`,
`observedAccount`, `subscriptionLimit` (`available` or `unobservable`) and
`subscriptionLimitReason`, optionally `operatorAssertion`, `waiver` and `extraUsageReason`.
It then creates a new record; the current record and profile are only read:

```sh
node --loader ./scripts/slice-ts-loader.mjs tests/preview/renew-activation.mjs \
  --current /ABSOLUTE/activation.json --profile /ABSOLUTE/profile.json \
  --observation /ABSOLUTE/observation.json --out /ABSOLUTE/activation-next.json
```

Every other field is copied; `predecessor` names the prior reference and file digest. A new
`reference` also needs `--profile-out /ABSOLUTE/profile-next.json`, a profile successor whose
`activationReference` matches, and the record's `profileDigest` covers it. A different account,
an exhausted limit, an unknown observation field or a record this build refuses writes nothing.
Outputs are created exclusively and never replace an existing file.

A journal's genesis fixes its original expiry. With the runner stopped, extend a live trial,
once per reviewed expiry and only before it lapses, under the writer lease:

```sh
node --loader ./scripts/slice-ts-loader.mjs tests/preview/journal-agent.mjs renew-expiry \
  --root /ABSOLUTE/ROOT --activation-record /ABSOLUTE/activation-next.json \
  --login-profile /ABSOLUTE/profile.json --model DESK_EXACT_CLAUDE_MODEL_ID \
  --expires-at 2026-10-05T20:40:00Z --authority "WHO APPROVED, WHERE, WHEN"
```

It validates the new record with this build and records its byte digest and the authority.
`status` then reports `expires` and `expiryAuthority`. Afterwards the runner accepts only the
new record; the prior build refuses the renewed journal and the new record.

## Unanswered turns and host recovery

Stage 2 persists a closed provider failure class and, for usage limits, a spend-only
hold in `preview-state.json`. The hold never gates intake, stop, or a fixed notice.
After three minutes, a held selected turn may send one fixed notice through the
existing prepared Telegram reply operation. Preparation is durable before the
physical send; an interrupted or uncertain send is never retried. The notice
does not call the model or change the retained intake receipt.

`scripts/host-watch.mjs` is the launchd supervisor. Its non-secret JSON config
contains a canonical absolute `root`, absolute `cwd`, and an `agent` array whose
first element is the absolute Node executable and whose remaining elements are
the exact reviewed preview launcher arguments. The desk substitutes absolute
paths and a label in `scripts/host-watch.launchd.plist.template`. The job uses
`KeepAlive: {SuccessfulExit: false}`; the supervisor exits successfully on a
normal, stopped, expired, or breaker-latched agent exit. It restarts only after
a crash, counts failed launches against the trial's durable error ceilings,
and uses the launcher's bounded backoff. The first failure starts a recovery
episode. A failed restart prepares one notice bound to the trial's recorded bot,
recipient, and fixed host-watcher message, then sends through the preview's
prepared Telegram effect operation. A fresh cycle heartbeat closes the episode.
The existing `INSTAR_SECRET_PREVIEW_TELEGRAM_BOT_TOKEN` SecretRef environment
value remains outside the config and plist; the authorized chat comes from the
trial, not a separate watcher environment variable. The token never belongs
in `ProgramArguments` or a log. Tests use temporary labels and never install
a launchd job. An existing trial that lacks the recorded host-notice authority
cannot send this notice; the reviewed live proof must use a new trial with that
authority recorded at creation.

## Desk cutover and retained evidence

The desk alone runs source review, commits, pins, register regeneration, final gate and live cutover.
Quiesce the old bot poller and record its final cursor and unresolved turns; never run two pollers.
An unstopped root can continue with a new sidecar that excludes every existing turn. If stop is
latched, retain that source unchanged and invoke `cutoverPreviewRoot` from `state.ts` through the
existing TypeScript loader, using a reviewed non-secret JSON input object:

```sh
node --loader ./scripts/slice-ts-loader.mjs --input-type=module -e 'import {readFileSync} from "node:fs"; import {cutoverPreviewRoot} from "./tests/preview/state.ts"; cutoverPreviewRoot(JSON.parse(readFileSync(process.argv[1], "utf8")));' /ABSOLUTE/cutover-input.json
```

That input contains canonical `predecessorRoot`, fresh empty `root`, exact
`predecessorConfiguration` and `configuration` (only root differs), recorded
`quiescenceReference` and epoch-ms `cutoff`. Configuration is the complete object hashed by
`agent.mjs stateFor`: transport/context settings plus expiry, replyLimit, replyWindowMs,
errorLimit, maxPendingTurns and maxTrialTurns. totalErrorLimit is stored separately in the
inherited trial and must remain unchanged. No `now` override belongs in desk JSON.
The handoff hashes/fsyncs the source archive, retains the predecessor snapshot/stop/cursor and all
turn exclusions, and inherits trial identity, expiry, counters and cursor. It never deletes the
source latch or refills a budget. Update the activation's base configuration digest for the
inherited target root. Arm before inviting one short new synthetic question; queued messages
at/before cutoff are retained but ineligible.

The retained first-live result was complete non-JSON prose: Seven refused it, no Telegram
answer was sent, and the original provider slot/accounting remains unresolved. Its exact raw
terminal fixture is base64 of 2115 bytes, raw SHA-256
`df778ebf53e5957f1acef58d57c2ed3999cac637ae842aebd43256ab295d2ced`;
the extracted answer digest is
`44bf61d917e29ebaec6cb74910fee44fd792fea1b6ca670fcfa1dad0c0352b5f`.
Synthetic channel-sensitive successes establish plumbing only, not real-model compliance.

For this sole failure class, after reviewed/gated landing the desk may invoke the separate async
`cutoverRefusedStage2Root` once. `cutoverPreviewRoot` still refuses every S2 predecessor. Supply
canonical existing empty sibling target/source, the two complete configurations differing only
in root, cutoff, local poller AND child exit evidence, new activation, frozen profile and exact
model ID. Preserve the original trial and fixed expiry; at least 300000 ms must remain. Refresh
account/extra-usage/limit observations without a model smoke call. Use a new activation reference
and profile descriptor reference linked through profile.activationReference, the same isolated
login/executable/account, the new-root configuration digest, reviewed head and current policy digest.
The activation schema has no new fields. The helper neither arms nor launches anything.

The strict signed predecessor proof requires held/REFUSED, consumed slot 1, the complete terminal
prose response, genuine Nine assessment/Eight settlement/Six application and zero acceptance,
reply Run, pair, outbound request/message or reply dispatch anywhere. It retains UNKNOWN charge
and quiescence, actualCharge -1, unresolved 1, released/retryEligible/exposure 0 with store identity.
It rejects prior S2 successor lineage, locks, live lease, expiry, corrupted evidence and JSON answers.
Exclusive fsynced `wx` reservation at the canonical parent's
`.preview-s2-framing-v2-<raw-sha256-trial-id>.json` happens before copying. Reservation and target
predecessor record bind activation/profile/policy digests plus systemPromptDigest and framing,
cutoff, stop evidence, original expiry, failed response/operation and unresolved obligation.
The target binds reservationDigest; completion binds archive inventory and predecessor-record
digests, avoiding a hash cycle. A partial/corrupt marker or copy holds permanently for desk
disposition; the helper never deletes, retries, rearms or chooses another target.

The complete source is archived unchanged, including its stopped/latching S2 store. Only outer
history is inherited actively. Every old turn (including update 969389544) is excluded and the
cursor retained. Startup/restart verifies marker, archive, predecessor, actual policy/activation,
sidecar and, once prepared, the signed binding. Historical reconstruction verifies the same
retained joins without live authority. One new post-cutoff update may create a fresh same-store
provider/reply pair for activation 2 of maximum 2; success or hold burns that slot. A third
activation requires another disposition. The fresh local Six ledger is not a restored trial
budget: retain both outcomes and store identities; neither attempt proves charge or quiescence.

Retain activation/evidence labels, selected update/context, raw requests/responses and hashes,
Seven receipt/acceptance, Nine assessment, original Eight/Six UNKNOWN join, both Five Runs and
groundings, pair/loops/reservations/claims, exact prepared labelled payload, Telegram response and
message ID, stop/latch/counters and reviewed build/gate receipts. Report a real response/API-accepted
answer only after observing it; keep human receipt separate. Failed crash roots remain in the
system temp directory for inspection; recovery tests do not delete them.

Focused evidence lives in `stage2.test.ts`, `stage2-recovery.test.ts`,
`tests/assembly/production-provider-subscription.test.ts`, `tests/rungraph/accepted-reply-preview.test.ts`
and `tests/transport/run-pair-preview-rendering.test.ts`. Compatibility includes the unchanged 27
Stage 1 cases, provider boot/raw evidence, T3, both T4 files and landed pair suites. The desk's final
six-worker gate, after reviewed commits/pins/regeneration and a matching build, is:

```sh
/Users/dabombstudio/.instar/agents/echo/.instar/lanes/desk-par-gate.sh /Users/dabombstudio/.instar/agents/echo/.worktrees/seam-preview-s2-v2 preview-s2-framing-v2-round2 parallel
```

Register-wiring's expected final-content pin dependency at `check-register-wiring.mjs:308` is desk-owned; the
builder does not alter that checker, owner manifests, pins, generated artifacts or full-gate setup.

## Successive-turn mode (talkable preview; proposal, not activated)

`run --mode successive` is a bounded, private, multi-turn preview. It runs one poller and one
conversation loop: the accepted successive-turn driver (`src/assembly/production-conversation-driver.ts`)
through `createProductionConversationHost`. The installed per-turn owner plan comes from
`tests/assembly/production-boot-trace.ts`, over the installed owner fixture, with the real Telegram
custodian IO and the pinned subscription route. `tests/preview/successive.ts` is the only adapter:
no new driver protocol, budget, recovery or supervisor. It is not production admission, and its
live activation needs the separately approved waiver addendum in the desk's lane record.

It requires a completed, authorized successor root, created once by the desk with
`initializeSuccessiveRoot` from `state.ts` (same TypeScript-loader invocation as `cutoverPreviewRoot`).
Its JSON input holds canonical `predecessorRoot`, an existing empty sibling `root`, both complete
configurations (differing only in root), the recorded `quiescenceReference`, an epoch-ms `cutoff`,
and the `SuccessiveTrialAuthorization` recorded from Justin's approval: `type`, `schemaVersion: 1`,
`reference`, `waiverRecord`, `addendumDigest`, `operator`, `words`, `approvedAt`,
`providerAttempts: 16`, `dailyUsd: 5`, `totalUsd: 25`, the inherited `expiresAt`, and
`framing: "preview-conversation-v1"`.

The predecessor must be stopped or terminally latched and quiesced (no lock or lease). The helper
reserves an exclusive one-use marker `.preview-successive-<sha256(trial)>.json` beside the roots,
archives the predecessor unchanged under `.preview-predecessor`, and verifies the archive. It then
writes `preview-predecessor.json` (version 2, kind `successive`) and the inherited `preview-state.json`
(same trial id, fixed expiry, error totals, cursor, all turns excluded), plus `successive-state.json`.
It records every retained UNKNOWN obligation in the lineage and the cumulative limits. It never
deletes or resets the source latch, never reuses the framing-v2 successor, refills no budget, and
neither arms nor launches anything. A second use for the same trial refuses.

Start and restart: the successor's own store is `.successive/`. Its first boot copies the predecessor's
durable Telegram cursor journal (the rows and the exact update and poll-response captures they cite)
byte-for-byte from the archived store, so the first poll is at the inherited cursor; the successor keeps
the predecessor's bot identity epoch (same bot, same credential), so the custodian re-verifies those rows
under its own credential scope. A `.successive/` with no `successive-checkpoint.json` is a boot that never
completed (the checkpoint precedes the first poll, so nothing was admitted, called or sent). The next start
moves it aside to `.successive-incomplete-boot-N` (never deleted) and boots clean; a store still held by
a live process refuses.

Invocation: the existing preview arguments with the new root, plus
`--mode successive --activation-record /ABSOLUTE/activation.json --login-profile /ABSOLUTE/profile.json --model DESK_EXACT_CLAUDE_MODEL_ID`.
There is no `--stage` and no `--arm`. The activation record has the Stage 2 schema, with
`invocationPolicyDigest` over `subscriptionConversationPolicy(model)` and `baseConfigurationDigest`
from the successor root. Changing or deleting the activation file closes the route.

### What the model receives each turn

The system prompt is `SUBSCRIPTION_CONVERSATION_SYSTEM_PROMPT` (framing `preview-conversation-v1`,
1886 bytes). It is separately bound from the v2 one-shot framing, whose reconstruction is unchanged.
Stdin is the exact canonical Seven envelope: the operator's current message as `role:user`, and as
`role:context` the canonical `{bindings, packet}`. The packet (`successive-context-v1`) holds:

- `now` — the host clock when the turn was prepared (epoch ms and UTC);
- `audience` — the bound private conversation and the verified operator principal;
- `sources` — three exact excerpts of `docs/00-the-purpose.md` (name, purpose, coherency root), each
  pinned by SHA-256 with path, line range and file digest, plus the dated capability/status note.
  A changed document refuses composition rather than shipping drift;
- `history` — every earlier input of this trial in order, its accepted answer text and its outcome
  (`answer accepted; Telegram accepted the reply`, `answer accepted; delivery unknown`,
  `model outcome unknown; no answer was accepted`, …). Nothing is summarized or dropped;
- `recalled` — the `groundTurn` render for the operator's audience (revealable exchanges only).
  Lexical recall supplements the complete history; it proves no absence.

All user and answer text is passed through the recall redactor before it enters the packet. Every
inbound message and accepted answer is captured once with `captureExchange` (participants
visibility, operator audience). A turn's packet is prepared only once every earlier turn has settled,
so its history carries each earlier answer or outcome. The packet is kept in the encrypted store;
the plaintext sidecar holds only references, digests, clock values, byte lengths and hold codes.

### Measured bounds and holds

The combined system plus exact stdin (JSON escaping and multibyte text included) must fit
`SUBSCRIPTION_CONVERSATION_MAX_PROMPT_BYTES` = 32768. The Eight `provider-call` definition bound
(`PROVIDER_CALL_MAX_BYTES`), Seven's description and the route all enforce the same number; every
other operation keeps 4096. Offline measurement: the first turn with the full source packet and no
history is 7225 bytes; each short earlier exchange adds a few hundred. Overflow never trims: the
admitted turn and its packet stay retained, the sidecar records `INPUT_BOUND` with its byte lengths,
and the stop latch is set (`capacity`) before any provider call.

Other finite bounds:

- 16 provider attempts, counted by Six serving admission when admitted, even if the call then fails
  or is unknown;
- 16 replies;
- at most 20 admitted inputs. Five's stock grounding refuses more than 20 without summaries, so the
  poll itself is refused, and the trial stops visibly, before Telegram can treat another update as
  delivered;
- a 64 MiB installed store ceiling;
- provider capture capacity of 16 × (330416 + 4 × 32768 + 16384) bytes (the journal charges every judgment capture, not only the response reservation);
- a durable 300000-ms host-clock window per turn (opened when the turn is grounded, never reset by
  restart; the route refuses an execution that cannot finish in it);
- the inherited absolute expiry and the error ceilings (the new root's total ceiling is the inherited
  remainder).

The adapter polls one update per cycle, because the installed grounding requires the current
opening to be the admitted frontier. Later messages stay unconfirmed in Telegram until the current
turn has drained.

The provider call declares 0 monetary demand; its settlement keeps `finalCharge: null` and Six
accounting `actualCharge -1, unresolved 1`, exactly as Stage 2. The Six serving ceiling is in abstract
fixture charge units, not dollars: 21 per turn plus one, covering the fixture context delivery
(20, settled 0 locally) and each reply (1, charge unknown). No paid route exists; the $5/day and
$25 lineage caps are recorded in the successor record for any future paid route to reserve against.

Stop: the durable latch, SIGINT/SIGTERM and activation-file revocation all close the driver, the
provider route (checked before every child command) and the physical send/poll gates. An uncertain
provider or send outcome is never retried.

Restart: after every driver step, the adapter writes a checkpoint of the installed owner context
(register, schemas, captures, versions) to `successive-checkpoint.json`. A restarted process
reconstructs the owners from the retained store and continues with the next admitted turn. The
Telegram cursor baseline is retained durably in the sidecar.

### Successive stand-ins (in addition to the ledger above)

| Substitution | Honest limit |
|---|---|
| Installed owner fixture authority, signing, grants, clock and verification host | fixture authority, waived; the owner-side causal clock is static, so the Seven deadline carries the turn's host-clock deadline and the physical route enforces it |
| Fixture P-08 `local-durable` single-machine profile for the provider call and reply | a fixture acceptance, not a genuine operator P-08 acceptance |
| Fixture native context delivery | an internal local operation with local settled-0 evidence; it names prior accepted answers by digest; the model's actual context is the measured provider packet |
| Placeholder installation route | never invoked; each turn uses its own custodied subscription route |
| Provider evidence | local observation of occurrence plus the route's source/terminal attestations; charge, quiescence and non-occurrence stay insufficient/UNKNOWN |

### Known rough edges (deliberate for this trial)

Replies are short plain text. History is finite (20 inputs). Recall is lexical and supplemental.
Activation is manual by the desk. Notices are limited to the existing host-watch outage notice.
There is no source sampler or summarization, no Slack parity, no tools or autonomous work, and the
production confinement, peer and installation holds remain. Each turn runs the full signed owner
chain on this machine, so a reply takes minutes rather than seconds. Measured offline on this
machine: turn 1 about 80 s; later turns grow with the retained store.

Focused offline evidence: `tests/preview/successive.test.ts` (with `successive-fixture.ts`). It
substitutes only the Telegram Bot API and the subscription CLI, and runs restarts as fresh child
processes.

The preview does not pin its own host-file bytes. The fixture native harness reuses the artifact
already recorded in the trial's verified `AdapterConformance` fact; a new trial records the current
host artifact. This keeps a restart or deliberate code rebuild from conflicting with the same
durable fact. The process identity (`pid` and start time) is fresh for each launch and is not a
trial pin. The source packet still checks its exact purpose excerpts, and the activation still
binds the system prompt, framing, model, provider limits, CLI executable, subscription profile
and managed settings. Their content and approval digests remain enforced.

### Profile identity re-record (one use, desk-supervised)

A profile recorded before the identity dropped the device number no longer matches its unchanged
directories, and every provider call refuses (`subscription profile or managed configuration changed`).
`tests/preview/rerecord-profile.ts` re-derives `loginProfileIdentity` from the live directories and
rewrites exactly the digests that bind it: the profile's `loginProfileIdentity`, the activation's
`profileDigest` and the successive sidecar's `activationDigest` (`policyDigest` is re-derived and must be
unchanged). Every other field must be byte-for-byte identical in value. It refuses while any preview
process or storage writer is live, while Six's serving view shows an occupied slot, a pending provider attempt or its error
breaker, while the trial is stopped, held or expired, when the recorded profile→activation→sidecar chain is
inconsistent, when the managed-configuration digest changed, or when the identity is already current.
Superseded files are renamed with the suffix `.superseded-dev-identity`; an exclusive audit record
`.preview-profile-rerecord-<trial-hash>.json` beside the root lists every changed field (from/to), the
reason, the recorder and the serving counts, and makes a second use refuse. Input JSON:
`{"root","profilePath","activationPath","model","reason","recordedBy"}`; the storage key comes from the
same environment SecretRef as the launcher and is used read-only, never printed:

```sh
node --loader ./scripts/slice-ts-loader.mjs tests/preview/rerecord-profile.mjs /ABSOLUTE/rerecord-input.json
```

Provider source/terminal contract evidence is keyed by the exact contract digest, so a re-recorded
contract gets its own evidence row instead of reusing one that states the superseded identity.

### Pre-dispatch slot recovery (one use, desk-supervised)

When an admitted self-test has failed before provider dispatch, `recover-slot.mjs` checks the
quiesced trial, encrypted Six history, absence of a dispatch claim and send observation, and the
unchanged trial configuration. It closes any orphan attempt with Six's error result and retires
the occupied slot with Six's fenced retirement port. The admitted input, failed attempts,
breakers and history remain in place. It writes one JSON audit beside the root; a repeat refuses.
It refuses a live holder, a stop/hold/expiry, a dispatch claim or a prepared reply. The input JSON
names `root`, `profilePath`, `activationPath`, `model`, `expectedUpdateId`, `reason`, `recordedBy`, and the exact
`configuration` object the launcher hashed at trial creation. The storage key uses the same
environment binding as the launcher; its Telegram credential binding is resolved only to satisfy
the installed boot. Boot reuses the trial's sealed, hash-checked historical `getMe` capture;
this is not a fresh live identity check. Physical Telegram poll and send, and provider execution,
are prohibited:

```sh
node --loader ./scripts/slice-ts-loader.mjs tests/preview/recover-slot.mjs /ABSOLUTE/recovery-input.json
```

## Structural journal runner (rounds 10–13)

### Offline recall benchmark

`recall-benchmark.ts` measures packet visibility on synthetic 200, 1000 and
2000-turn private-chat histories. It uses the real encrypted preview journal,
summary scheduling, replay, channel fixture import, memory correction/forget
projection and packet builder. Mundane exchanges are fixture-written as valid
journal frames; the correction, forget and later question turns use the worker.
The deterministic summarizer keeps planted clauses verbatim, and the answer
stub extracts only a clause visible in the packet it receives. It makes no
network request, model call, Telegram send or live journal change.

Run from the repository root, naming an absolute JSON output path:

```sh
node --no-warnings --loader ./scripts/slice-ts-loader.mjs tests/preview/recall-benchmark.mjs /ABSOLUTE/OFFLINE_RESULT.json
npx vitest run tests/preview/recall-benchmark.test.ts --configLoader=runner --testTimeout=120000
```

Recall is the share of active planted facts present in each later question's
actual model packet. Precision is the share of superseded or forgotten clauses
absent from those packets. Packet bytes are measured on the actual model packets.
`historyBuildNonModelMs` covers per-turn fixture append, memory worker work and
forced summaries inside the history loop, including local journal fsync, with
stub execution subtracted. It excludes channel import, the final summary,
journal reopen/replay and all later question runs. Each `probePreparationMs`
times only the read-only `worker.probe` for a later question; it excludes that
question's intake, actual model packet construction and drain. The 200-turn
Vitest baseline is the measured 100% recall and 100% exclusion on this fixed
fixture. It does not measure semantic retrieval, answer quality from a real
model, provider latency or a live Telegram path. For the supervised human
check, use
[recall-benchmark-live-test.md](recall-benchmark-live-test.md).

`journal-agent.mjs` is a separate private-chat preview path. It keeps one encrypted,
append-only local journal and one exclusive writer. At boot it replays the journal once;
ordinary turns append records and update an in-memory transcript. It fsyncs an update and
its next cursor before polling at a higher offset. A call reservation precedes the
subscription invocation. An exact send intent precedes the one physical Telegram send.
An intent without a durable Telegram result is **UNKNOWN** and is never sent again;
the next unrelated turn can proceed. Telegram API acceptance is not human receipt.

Each accepted update consumes one `maxTurns` slot, each subscription answer,
summary or reply review reservation consumes one `maxCalls` slot, and each exact
Telegram send intent consumes one `maxReplies` slot. Jev checks have their own
durable count bounded by `maxReplies`. UNKNOWN outcomes keep their reservations
after restart; `status.unknownCalls` includes uncertain answers, summaries,
reviews and Jev checks, with `unknownCallBreakdown` showing each kind. The
`max-context-bytes` limit applies to the complete prepared model prompt; an
oversized turn stays held with its original intake. A Telegram poll batch that
fills the last turn slot leaves any further updates unrecorded and the cursor
before them, so an authorized cap raise can fetch them again.

When a cap stops this runner, it writes one fixed line to the local terminal:
`PREVIEW — calls|replies|turns|bytes cap reached; work paused. Check status for held work.`
The encrypted journal fences one line per cap kind and limit across restarts;
`status.capReports` shows those fences. It is a local operator notice, not a
Telegram send, so reaching `maxReplies` cannot spend an extra reply. A crash
between the durable fence and terminal output may leave the line absent; the
durable `status` and run-end reason remain available. The supervised procedure
is [spend-cap-live-test.md](spend-cap-live-test.md).

The launcher uses the existing `INSTAR_SECRET_PREVIEW_STORAGE_KEY` and
`INSTAR_SECRET_PREVIEW_TELEGRAM_BOT_TOKEN` host bindings, production storage lease,
Telegram bridge and subscription route. The desk supplies the same reviewed activation
and frozen login profile used by the subscription preview. The grant reference is the
activation's `trial`; the configuration digest is its `baseConfigurationDigest`.
The expiry must equal the activation expiry. All paths must be canonical absolute paths.
The root is new or imported; never point this launcher at the old root.

```sh
node --loader ./scripts/slice-ts-loader.mjs tests/preview/journal-agent.mjs run \
  --root /ABSOLUTE/NEW_ROOT --bot-id BOT_ID --bot-username @BOT_USERNAME \
  --operator-sender-id OPERATOR_ID --chat-id PRIVATE_CHAT_ID \
  --grant-reference TRIAL_ID --configuration-digest sha256:TRIAL_CONFIGURATION_DIGEST \
  --expires-at 2026-10-05T20:40:00Z --activation-record /ABSOLUTE/activation.json \
  --login-profile /ABSOLUTE/profile.json --model DESK_EXACT_CLAUDE_MODEL_ID \
  --max-calls 16 --max-replies 16 --max-turns 20 --max-context-bytes 32768 \
  --time-zone America/Los_Angeles \
  --agent-state-dir /ABSOLUTE/AGENT/.instar
```

`--agent-state-dir` enables read-only live channel memory from this agent's
`telegram-messages.jsonl` and, when present, `slack-messages.jsonl`. The path must
be the canonical absolute path of the agent's own `.instar` directory. The preview
reads at most 256 KiB and 64 complete lines from each source per poll cycle; it
never modifies either log or asks for another credential. Telegram imports only
authenticated user rows with a session bound to this agent (in the row or the
server's `topic-session-registry.json`), a numeric Telegram sender ID and a
topic other than the preview chat. Slack imports only user rows
with a platform user ID in a channel bound to this agent by
`slack-channel-registry.json`. Agent, automation, unbound, malformed-identity and
preview-chat rows are skipped. Imported text is redacted and fsynced as a
`channel-item`; only then does a source offset advance in the same encrypted
journal. Replaying after a crash dedupes by platform, conversation and message ID.

| Preview source | Stored sender | Participation evidence | Status field |
|---|---|---|---|
| Telegram | `telegramUserId` | Row session or topic registry | `channelSources.telegram` |
| Slack | `platformUserId` | Slack channel registry | `channelSources.slack` |
| Mail | None | None | Dark |

An incomplete JSONL line waits for the server to finish it. A malformed complete
line, missing required Slack registry, capacity refusal or source read error leaves
the cursor at its last durable point and appears as `channelSources.SOURCE.error`
in `status`; Telegram polling continues. Each source has a durable byte offset,
scanned/imported/skipped counts and a short content anchor so an in-place rewrite
restarts at zero and dedupes retained messages. The current journal limit of 2,000
channel items remains in force. The source log may itself rotate or purge before
the preview reads it; this preview reports the resulting cursor state and cannot
recover messages the server has already discarded.

For one bounded pass while the runner is paused, use `import-store --root
/ABSOLUTE/NEW_ROOT --agent-state-dir /ABSOLUTE/AGENT/.instar`. `status --root
/ABSOLUTE/NEW_ROOT` shows `channelSources.telegram` and `channelSources.slack`
without opening those logs. The source is machine-local by design, using the same
exclusive preview journal writer and no new service or credential. Live mail stays
disabled. The Justin live exercise is [channel-source-live-test.md](channel-source-live-test.md).

### What the preview knows about itself and 2.0

Each model call's packet carries `now`, the audience, the conversation history,
a `capability` line (capped preview, answer only, no tools, memory is this trial's
journal only) and `sources`: the three pinned purpose excerpts, the dated
capability note, the preview's **own self-state**, and the **desk's report** on
other work.

The self-state (`self-state.ts`) is computed by the runner at every turn from
durable records only, never from a hand-edited file: the journal projection
(operator messages and Telegram-accepted replies today and in total, model attempts,
replies and admitted updates used and left, when and on whose authority caps were
last raised, UNKNOWN calls and sends, holds by reason, refused updates, summaries,
expiry, stop, import) and the root's run log `runs.jsonl`. The run log is one small
append-only, fsynced sidecar: the launcher writes a launch line before its first
poll and, when the loop ends, an end line with the reason (paused by signal NAME,
operator stop latched, trial expired, the cap that stopped polling, repeated poll
failure, cycle limit, or error). A launch with no end line is reported as ended
without recording why (crash, kill or power loss); a torn line is counted, never
guessed at. From it the self-state gives this run's start and uptime, the last
restart, how the run before it ended, and launches today. "Today" is the local date
in `--time-zone` (an IANA zone, default `America/Los_Angeles`; an unknown zone refuses start), and
the zone is stated in the text. The counts include the message being answered; its
own reply is not yet sent. Imported turns from an older root may have unknown
times. Launches before this change were not recorded, and the text says so. It is
recomputed from memory each turn (no model call or extra read). The 2000-turn
timing check is quarantined under Rule 37 while its wall-clock flake is diagnosed;
functional self-state checks remain active. `status` prints the same text as `self`
plus the last three `launches`, so an answer can be checked against it (status, read after the reply,
counts that reply too).

The `Memory health:` line in that self-state is computed from the journal projection
alone and is also `status.memoryHealth`. It gives current held-turn count, summary
count and the number of accepted operator turns covered by the latest summary,
and recall-sentinel hits actually offered in recorded model prompts (original
turns and imported channel items separately). A reservation without a readable
prepared prompt is counted as unmeasured, not as a miss. It also counts old-claim
items withheld by validated memory changes, operator memory corrections with an
explicit pending disposition and no later summary resolution, and turn-model,
summary-model and Telegram-send outcomes still without durable results. Summary
reservations can be in flight, so their line says "in flight or UNKNOWN". Channel
fixture imports retain item IDs but have no source cursor; the line reports zero
recorded channel-import cursors and the imported item count. Telegram's intake
cursor is a different value already shown by `status.cursor`. The line includes
counts and the latest summary's update ID only, never remembered text, and uses
no model call, file read or new store. See [memory-health-live-test.md](memory-health-live-test.md)
for Justin's read-only live check after installation.

On a recorded restart, the first reply packet also carries a short `restart-handoff`
source made once at launch from the replayed journal and `runs.jsonl`. It lists
pending accepted turns, holds, UNKNOWN model calls and sends, and lost-answer
notices due, with at most three update IDs in each category and no message bodies.
Counts can overlap. It states whether the previous run recorded an end. Prompt
size checks can rebuild the packet without consuming the note; a summary packet
does not consume it. Once the first reply call is durably reserved, later packets
omit it. No new journal record, call, send or file is involved. `inspect` exposes
only this note from the persisted prompt as `restartHandoff` for a live check;
see [session-handoff-live-test.md](session-handoff-live-test.md).

The desk report is optional: a plain file the desk maintains about other 2.0 work, re-read at every turn
(default `ROOT/desk-status.md`; override with `--desk-status /ABSOLUTE/PATH`).
It enters the packet as the `desk-status` source, labelled as the desk's report,
quoted data that grants nothing and never overrides the operator. The existing
system prompt already treats everything in context as data, not instructions.
The source also states the preview clock in UTC and the file's last-modified time.
Secrets are redacted. A missing, unreadable or larger-than-4096-byte file is stated
as "the status of other Instar 2.0 work is unknown"; a file last modified more than 24 hours ago is
included but marked **STALE** with its age. A bad file never holds a reply.
Updating the file needs no restart. Sample:

```md
# Instar 2.0 — desk report
What 2.0 is: Instar rebuilt so coherence is something an agent cannot lose.
This preview: a private, capped Telegram trial. It answers only; it has no tools,
cannot act, browse or schedule. Its memory is this trial's journal.
Lanes:
- preview-awareness: built, awaiting gate.
- production speed work: in progress.
Not yet available: production memory, multi-machine, Slack.
```

After more than three hours since the previous verified operator message, a
normal answer packet also carries `away-digest`. It is a short runner-derived
data source, not an instruction or an extra message. The digest counts launches
and recorded ends from `runs.jsonl`, journal holds, lost-answer notices, unknown
model/send outcomes, and cap raises since that message. It reports changed desk
lines by comparing the current report with the snapshot already in the earlier
durable model prompt. If that snapshot is unavailable, it says so. Missing or
unreadable report data is never invented. The digest is rebuilt on each attempt
from existing records, capped at 640 characters, and uses no model call, daemon,
or additional store. See `away-digest-live-test.md` for the operator-channel proof.

Every reply packet also carries `operator-digest`: the first 700 characters of the
redacted desk source, its freshness label, the last three recorded runner launches,
and up to eight recent hold, lost-answer and memory-change events reconstructed
from the encrypted journal. The digest says that a launch is not proof of a deploy;
deploy claims come only from the desk report. It carries event kinds and update IDs,
never the text of a corrected or forgotten fact. The local `status` command prints
the same digest. It adds no model call or store. See
[operator-digest-live-test.md](operator-digest-live-test.md) for Justin's live check.

### Remembering people

When the rolling summary runs (after a reply, sharing the same attempt cap), the
same call also lists the people named in the operator messages it is about to
compact: a name and an exact excerpt of that message. The runner keeps a note only
when both occur verbatim in one accepted message the summary packet showed, and
drops anything else, including quotes of the agent's own answers. No extra model
call is made and no new file is written: notes ride on the summary's journal record.

A later message that shares a name word with a known person gets `people` in its
packet ("Sam" also finds notes filed as "Sam Ruiz"; the model judges identity). The
most recent ten notes are recalled, and each source message is shown in full, redacted,
with its date, the quoted mentions and `from`. `from` is the message's authenticated
sender, read from the journal, never from the model. A quote is only a pointer into
its message, so "Priya falsely claimed that Sam supports November" can never reduce
to "Sam supports November". "Sam thinks X" from the operator appears as the operator's
report, never as Sam's words; only a message authenticated as Sam's own could carry
`from` Sam. The packet says that the same or a partial name can mean different people
and that absence from `people` is not evidence. Before a summary exists every original message is already
in `history`, so notes are only needed and only recalled for compacted turns. Under
the context bound, optional evidence follows the packet priority described below.
A plain-text summary keeps no notes; `status` lists each summary's note count
(`null` = none recorded), `summaryPending` (unresolved reservations, including UNKNOWN) and the
known names.

When the operator asks about a known person, `people` is also the short dated
timeline for that person. Each entry carries its journal `sourceId`, whole source
message, date, actual sender and the matched mention. Entries are ordered by source
time, with at most ten source messages per person and twenty in one packet; older
entries stay in the encrypted journal. Imported channel items join the timeline
when their asserted sender matches the person or their text mentions that person.
An imported entry names its source and account and labels its sender as unverified
export metadata. Name matching only offers evidence; the model judges identity and
meaning, especially when people share a name. Imported items can appear before a
Telegram summary, while Telegram messages before compaction already appear in
`history`. The normal prompt bound may omit timeline entries; absence is never
proof that nothing was said. `inspect --text` shows the selected entries without
making a call or changing the journal. See
[people-timeline-live-test.md](people-timeline-live-test.md) for Justin's live check.

When two recalled notes use a short and longer name with the same name words
(for example, `Sam` and `Sam Ortiz`), the packet carries up to five
`personMergeCandidates`. Each candidate identifies both exact source notes and
their names, and gives a `confirmText` sentence. This is evidence for the reply to ask the operator, never an
identity decision. A shared first name can produce several candidates; `Sam
Ruiz` remains a separate person even if the operator later links `Sam` and
`Sam Ortiz`. If two source pairs would need the same confirmation sentence,
neither is offered: that sentence cannot identify which Sam the operator meant.
The model may propose a link in its ordinary reply decision only
after the authenticated operator sends that candidate's exact `confirmText` as
a direct correction. The runner verifies the offered note IDs and exact
confirming message before recording a link in
the existing encrypted answer frame. A question, another sender, malformed
decision, or silence records no link. Replayed links let either confirmed note
recall the other, while the original notes remain unchanged. `inspect --text`
shows candidates and confirmed links; `status` lists confirmed source pairs and
the confirming update. Candidate data gives way with optional person notes
under the existing prompt bound. See
[people-merge-live-test.md](people-merge-live-test.md) for Justin's private-chat
check.

### Remembering commitments

The same summary call also lists what the operator asked the agent to remember or do
(`in: "message"`, quoted from their message) and what the agent said in its own reply that
it would do or remember (`in: "reply"`). The runner keeps an item only when its quote occurs
verbatim on that side of one accepted turn the summary packet showed; a paraphrase, an
invention or a quote placed on the wrong side is dropped, never repaired. Who asked is the
turn's authenticated sender; the date is that turn's date. No extra model call and no new
file: items ride on the summary's journal record and replay with it after a restart.

An item closes only when a later message the operator verifiably sent says it is done,
withdrawn or no longer needed, quoted exactly: the summary call sees the open items as
`openCommitments` (id and quote) and returns `closed`, or `closedBy` on an item made and
settled within the same stretch. Another sender's message closes nothing.

After compaction the existing memory sentinel ranks open commitment quotes against the new
message with BM25. The packet carries up to ten related items; an explicit request for the
open list carries the ten most recent. Each is shown inside its whole message or reply with
`from`, date, elapsed age, conversation and, for the agent's own reply, its delivery outcome.
Closed and superseded items are excluded before ranking. The model addresses a related open
item and its age; the packet says the preview has no tools, so it can only remember an item,
never do, schedule or remind. It never calls an item done unless a message says so, and
absence is not evidence. Under the context bound, optional evidence follows the current packet priority. `status` reports `commitments: {total, open}` and per summary
`commitments` (`null` = none recorded) and `closed`; `inspect` shows the packet's `commitments`.
This reuses the journal projection and recall function, with no new store, call or classifier.
For a supervised private-chat probe, follow [commitment-surfacing-live-test.md](commitment-surfacing-live-test.md).

### Packet priority near the byte envelope

The complete unsummarized history is tried first. When it cannot fit, the current
summary and post-summary turns remain mandatory. Optional older evidence is then
kept in this deterministic order: open commitments to the operator (including
those with a nearby explicit date), older items with an ISO `YYYY-MM-DD` date
from one day before now through 14 days ahead, pending correction notes, notes
about people named in the new message, then other recalled turns and channel
imports. The existing recall scorer selects candidates; among ordinary recalled
turns and imports, query-word overlap breaks priority ties before recency.
Memory-decision candidates yield before quoted evidence.
The date pattern is only a budget signal, never a judgment that something is
actually due. The model judges the meaning and identity of every selected item.

At most ten open commitments, five recalled turns, five channel items, ten person
notes and three correction notes are offered. Within the commitment window,
nearby dated items precede newer undated ones. Every selected reply reservation
records each optional omission by kind, source ID and `packet or prepared prompt
byte envelope` reason in the encrypted journal. `status.packet` gives the last
reply reservation's prepared prompt byte count, its bound and those omissions;
the byte count is `null` if no prepared prompt was stored, and older reservations
say the omission record is unavailable. Original intake and summaries remain in
the journal even when a packet omits them. Packet omission is never evidence that
the fact is absent. The offline 200/1000/2000-turn benchmark is in
`journal-packet-priority.test.ts`; Justin's live script is in
`packet-priority-live-test.md`.

When a later complete quoted request or promise repeats an active one, the summary
projection keeps one open item and attaches the later source message to it. The
bounded match removes only an introductory “remember” request and outer spacing;
the remaining clause must match exactly, including punctuation, internal spacing,
value and letter case, and the authenticated speaker and quoted side must agree.
Each item admits at most 49 additional sources, including links queued by the
current summary; a second quotation of the same source adds no link.
Partial quotes and less certain paraphrases stay separate for the model to judge.
Both original turns remain in the encrypted journal. A correction of a grouped
claim withholds both old source quotes, while a changed value remains a distinct
item. `inspect` shows the additional source inside the open item's `sources`; the
existing finite packet bound can omit optional commitments. For the operator
procedure, see [memory-dedupe-live-test.md](memory-dedupe-live-test.md).


### Correcting and forgetting memory

An authenticated operator statement in the narrow form `my/the SUBJECT is VALUE`
is compared with earlier, unsuperseded statements about that literal subject in
accepted operator turns or imported channel items. If the most recent value
differs, the reply packet carries `contradictions` with the two redacted quotes,
source IDs, dates and provenance. A channel import is labelled as export metadata,
not an authenticated operator assertion. This is a bounded candidate signal: the
model judges whether the statements really conflict and can ask whether to update
memory. Matching values, different subjects and nonoperator turns raise no
signal. The extractor skips double-quoted clauses, whole-line blockquotes and
fenced spans, and emits a quote only when it occurs verbatim in the redacted
source; other quotation forms can still produce a candidate. The signal never
writes a memory change; the authenticated correction
path below still decides and validates any change. If the prompt bound cannot hold
the signal, it yields before accepted intake or reply can be blocked. `inspect`
shows any signal in the persisted reply packet. The [live test for Justin](contradiction-notice-live-test.md)
exercises the private preview chat after the desk lands this revision.

A direct correction or forget request from the bound Telegram operator can be judged in the existing
rolling summary before its reply. A small text cue schedules that call early;
it cannot itself supersede anything. The ordinary capped reply call can also return a memory
decision when the cue misses, using optional older candidates that yield before recall or
commitment context under the prompt bound. An ordinary later summary may also record a direct
request its model identifies without a cue. Both paths return `memory` entries with the exact old
factual clause and its source turn ID or namespaced channel-import ID. The same bounded model decision can name additional
candidate reply IDs and exact passages from the current summary that express that fact. The
source turn's own reply is withheld by its recorded source relationship. A correction
also quotes the replacement from the operator's own message. The runner keeps an entry only if
the old clause occurs verbatim in an earlier accepted operator turn or an earlier imported channel item,
the trigger is an accepted authenticated operator turn, and the replacement occurs verbatim in that turn. Claimed instructions inside quotes, forwards or
imports have no authority. An invalid proposed entry or an explicitly unresolved target never
becomes an empty successful decision. An invalid reply decision records pending status in its
answer frame, so replay cannot send an unaccepted acknowledgement after an interruption. An
ordinary summary that explicitly says `unresolved` records a failed attempt. The request stays
visible as pending under the existing bounded summary retry path. New summary
frames name the request they decided; old frames without that field keep their historical frontier
settled, so an upgrade can continue draining later turns.

The original turns and previous summaries stay in the encrypted append-only journal. Replay
rebuilds the superseding records from summary or answer frames. Every later packet filters
superseded claims from history, summary text, recalled originals, channel imports, earlier answers, commitments and person
notes. Source-linked replies are withheld without a phrase test; the model identifies other
affected replies and summary passages by meaning. Exact old clauses and overlapping note excerpts are withheld;
an unrelated person's similarly numbered fact remains. A person or commitment note whose quoted claim was superseded is omitted; a correction's
new fact is carried as `memory`. A forget carries only a withholding reason. Similar facts with
different wording and sources remain. `status.withheld` and `inspect.withheld` show source and
operator update IDs and why an item was withheld. They show a redacted old clause for corrections,
but no clause for forgotten items; the model packet also receives no forgotten clause. If the shared attempt cap or summary route prevents a decision,
`status.holds` shows `memory correction pending` and the intake remains durable.

### Dated memory (preview)

The private journal runner records dated events and deadlines from the verified operator in the
same encrypted append-only journal. The ordinary capped reply call selects an exact clause and
date phrase from the operator's message; the runner checks both against that message and parses
the phrase deterministically in `--time-zone` (default `America/Los_Angeles`) at the
Telegram message timestamp, falling back to the durable intake timestamp. It stores the interpreted local day, optional
24-hour time, original phrase, zone and any ambiguity in the answer frame. No extra model call,
store, service or scheduler is added. Every verified operator reply packet asks the model for a
dated decision, including `dated:[]` when there is no event or deadline. Up to three items can be
recorded from one turn. A malformed proposed item is not recorded; the runner retains a pending
date decision and sends a checked, truthful clarification. The structured reply separates
`reply.answer` (substantive answer or clarification) from an optional
`reply.dateAcknowledgement`. The runner ignores the latter and renders save status from the
validated date result, retaining `reply.answer` even when selection fails. For an invalid
selection in the old mixed string form, it sends only the date rejection because the answer
cannot be separated from an unchecked save claim.
If the model omits the structured date decision, the original turn stays durable and
`datedPending` names it in `status` and the next packet. That is an unconfirmed missing decision,
never a due item; the preview must not claim it saved a deadline from that evidence alone.

`tomorrow` means the following local calendar day, including across DST changes. `next Friday`
means Friday in the following Monday–Sunday calendar week; the same rule applies to other
`next` weekdays. An unqualified weekday means its next occurrence (the same weekday today is ambiguous). A
month and day without a year means the next occurrence on or after the message's local day.
`this` weekday, multiple dates, invalid dates, unsupported modifiers, numeric dates and
other relative phrases retain their ambiguity. A bare hour such as “at 3:30” has a known day but no
settled time. Day-only and ambiguous-hour items become
due on their local date and overdue the next local day. A precise time becomes overdue after
that local time. Items without a resolved day are shown as ambiguous. The packet of the next
operator message includes up to ten upcoming, due, overdue or ambiguous active items. The existing
byte fitting can show fewer, including zero, and reports the omitted count. It likewise fits up to
three pending date decisions. Full records remain in the journal. `status` reports all active items
and their current states; `inspect --text`
shows the next packet's dated block. Corrections and forgetting use the existing validated
memory change: an affected old item is withheld, and a corrected date is recorded only when
the operator's replacement clause is selected and validated in its own turn.

For a validated dated item, the immediate reply keeps the substantive answer and adds its absolute
`YYYY-MM-DD` day and zone; an unresolved time remains explicit beside any model clarification.
An unresolved date gets a clarification. Later answer packets carry those absolute
dates and ask the model to state them when relevant. The exact reply still passes the existing
reply check and send intent.

The capability line says plainly: this preview **answers only and never sends unprompted
reminders**. An item in memory is not a scheduled notification; the runner has no scheduler or
tools. It can mention a due or overdue item in a reply to the operator's next message.
For Justin's supervised procedure, see [dated-memory-live-test.md](dated-memory-live-test.md).
### How the operator likes answers

The same capped summary or reply decision can record a durable reply preference from the
verified operator. It returns `mode: "prefer"`, this turn's ID, and an exact clause from
the operator's message. A small wording cue can schedule the summary early; the model
still decides whether the statement is a direct, durable preference. An uncued statement
can be recorded by the ordinary reply decision. Quoted and imported statements are data,
and a different sender has no operator authority. Invalid actions remain pending rather
than producing an acknowledgement that the preference was saved.

Preferences live in the existing encrypted journal memory actions. Every later model
packet carries the active `preferences` with their source IDs. A later verified operator
statement can replace or remove one through the same `correct` or `forget` action, naming
the earlier source and exact old clause. Replay rebuilds the active set from the journal;
old actions and source messages remain as evidence. Each clause can be changed independently,
including when one message supplied several preferences. Retiring a clause withholds its
historical source without masking a new operator turn that uses the same words. Saving a
preference leaves that turn's reply and commitments intact. `inspect --text` shows the active
preferences in the next packet. No second store or model call type is involved.

Live script for Justin in the existing private preview chat, after the desk lands this
revision and resumes the one runner on its existing root:

1. Check `status` for at least ten calls, seven replies and seven turns of room; use the
   recorded `raise-caps` authority if needed. Send `Shorter please.` Wait for its reply.
   Use `inspect --text "What changed?" --model MODEL`; `next.preferences` should contain
   `Shorter please.` Ask `What changed?` and check the reply is brief.
2. Send `Use detailed answers instead of shorter replies.` Wait for its reply. The next
   `inspect --text "What changed?" --model MODEL` should carry only the detailed-answer
   preference. Ask again and check the answer follows it.
3. Send `Forget my answer style preference.` Wait for its reply. The next inspect view
   should have no active preference. Send `Shorter please.` again; the next inspect view
   should carry that preference from the new source and show the retired historical source
   as withheld. Ask again and record the actual reply, status and inspect outputs. If a
   summary decision is pending or a cap is exhausted, record the visible hold as an
   incomplete result.

### Inventory of remembered records

When the verified operator's turn has a memory-question cue, the existing reply packet
offers `inventory` from the replayed journal. It contains person notes, corrections,
content-free forgotten markers, commitments, imported channel items and dated operator
turns. Each entry has a source and date; imported sender metadata remains labelled as
export metadata. A question about a named subject selects related records, while a
broad question offers recent records across categories. This deterministic selection
does not decide what the operator meant; the model judges the question. The inventory
is at most 20 entries and yields to the existing prompt bound. Its `total`, `shown`
and `truncated` fields make omissions visible. A lexical miss or a bounded selection
is never evidence that the journal holds nothing else. Forgotten content is withheld
in every displayed entry, and the marker says only that the verified operator asked
to forget it. `inspect --text` shows the same proposed inventory without a call or
send. No new store, index or model call is used.

The supervised operator procedure is [memory-inventory-live-test.md](memory-inventory-live-test.md).


Live script for Justin in the existing private preview chat, after the desk lands this revision
and resumes the one runner on its existing root:

1. Check `status` for at least six calls, five replies and five turns of room; use the recorded
   `raise-caps` authority if needed. Send `My gym locker code is 3310. Test marker Cedar.`
2. Send unrelated filler turns until `status.summaryThrough` covers the fact and `inspect
   --text "What is my gym locker code?" --model MODEL` reports `next.historyMode` as
   `summary-plus-recent`. Wait for each reply and for `summaryPending: 0` before checking.
3. Send `Actually my gym locker code is 4412, not 3310.` Wait for its reply and summary. Check
   `status.withheld` names the source update and `verified operator corrected this fact`. Ask
   `What is my gym locker code?` The reply must give **4412 only**. Check the persisted `inspect`
   view has a corrected `memory` entry; `status` still retains the original turn count.
4. Send `Forget my gym locker code.` Wait for its reply and summary. Check `status.withheld`
   adds `verified operator requested forgetting`. Ask `What is my gym locker code?` The reply
   must decline to recall either code. `inspect` must show a forgotten marker and no corrected
   value in its `memory` block. Status and inspect show the forgotten item only as a
   withheld record without its old quote. Record the actual replies, status and inspect
   outputs as the live trace; a missing summary decision or exhausted cap is a visible incomplete result.

`inspect --root ROOT` is read-only: it prints the last persisted model prompt's
`historyMode`, summary coverage, `people` block and restart handoff note, redacted,
and never other sources or history text. Add `--text "<message>" --model MODEL` to see what a next message
with that text would get now. It makes no model call, send or journal write.
Recall is proven only when a question's own persisted prompt shows
`summary-plus-recent` with its people. A summary alone is not enough, because
complete history is used for as long as it still fits.

`audit --root /ABSOLUTE/EXISTING_ROOT` is a read-only desk check of the latest
recorded model packet, whether that call answered a turn or updated the rolling
summary. With the same storage-key host binding as `status`, it replays the
encrypted journal and prints JSON `modelCall`, `update`, `items` and `findings`.
Each item names its packet location and a source chain: original Telegram turn,
agent-owned channel import, summary frontier, operator correction or forgetting,
person/commitment note, or reply-check note. It prints turn IDs and one-way
source-key digests for imports, never
message, answer, summary or quoted body text. It exits nonzero when a source or
attribution cannot be verified, an exact forgotten/superseded clause remains in
the packet, a people note lacks its original accepted turn, or a recorded packet
or journal frame is incomplete. A root with no model reservation reports an
empty item list; an older reservation without a saved packet reports a finding.
The report describes the last **recorded** model input, not a future answer or
what the model chose to use. The exact-clause checks cannot prove that a
paraphrase of a superseded fact is absent. Run it after each live proof step as
described in [journal-audit-live-test.md](journal-audit-live-test.md).

```sh
node --loader ./scripts/slice-ts-loader.mjs tests/preview/journal-agent.mjs audit \
  --root /ABSOLUTE/EXISTING_ROOT
```

### Asking what the preview remembers

A verified operator can ask in ordinary language what the preview remembers about a
topic or person. The existing journal worker ranks up to five relevant operator
turns and imported channel items for the next packet. Each visible item carries its
source turn or exported source ID and send date. A corrected item shows the current
replacement and the correction turn/date. Matching forgotten items contribute only
to a count; their text is withheld from the search packet and reply. The model
decides whether the question is a memory request and which cited items answer it.
The normal Jev reply check and one-send journal fence still govern the answer.

This is bounded preview recall: selection uses the existing memory sentinel and
summary bridge, and a missing item does not prove the journal lacks it. If the
prompt bound drops ranked items, `memorySearch.truncated` marks the citation list
incomplete. `inspect --text "What do you remember about Sam?" --model MODEL`
shows the proposed search evidence without a model call or send. For the supervised
operator proof, follow [memory-search-live-test.md](memory-search-live-test.md).


`status --root /ABSOLUTE/NEW_ROOT` is a read-only pull view and lists current
caps, counters, UNKNOWN calls and sends, held update IDs and reasons, and import
completion. After pausing the runner and verifying the operator's authority, the
desk can raise all or some of the finite limits with:

A validated terminal provider failure envelope, or a completed success envelope
with empty or malformed answer content, is recorded with a bounded, content-free
failure class and provider state. The counted call gets one fixed PREVIEW reply
through the usual reply check, durable intent and send fences. A bare process
exit (including zero), invocation error, timeout or interrupted call without a
validated terminal result remains UNKNOWN and is never repeated. This also
applies to summary reservations: a definite summary failure may use its remaining
bounded attempt, while an uncertain one stays pending across restart. `status` reports
`modelFailureClasses` and `modelResultStates`; `self` includes the same counts.
Subscription reply reviews also record their returned provider state.
The journal never stores the failed model's raw output. To exercise this path in
an isolated trial, follow [journal-model-failure-live-test.md](journal-model-failure-live-test.md).

Each actual subscription CLI model invocation (answer, summary, or reply review)
now appends one content-free physical outcome to the same encrypted journal before
the adapter classifies it. `status.callOutcomeCounts` gives totals by role and
physical result; `status.lastCallOutcomes` gives the last ten. Each row has the
call ID and role, exit code, local limit (`timeout`, raw/answer `size`, or
`output-cap`), elapsed milliseconds, normalized result type/subtype/error flag
when parseable, usage output tokens, and stdin prompt bytes. Unrecognized frame
subtypes become `other`; provider prose and model text never enter these rows.
An in-flight or preflight-failed reservation has no physical outcome row and
remains visible through the existing UNKNOWN counters. A validated terminal
result that exceeds the 2048-token or answer-byte cap is a definite rejected
call whose answer is discarded; a local 120-second timeout stays UNKNOWN and
is never repeated. The operator procedure is
[call-diagnostics-live-test.md](call-diagnostics-live-test.md).

```sh
node --loader ./scripts/slice-ts-loader.mjs tests/preview/journal-agent.mjs raise-caps \
  --root /ABSOLUTE/NEW_ROOT --max-calls 64 --max-replies 64 --max-turns 80 \
  --max-context-bytes 131072 \
  --authority 'Justin, topic 52075, 2026-09-25 16:25 PDT'
```

The command takes the exclusive writer lease, refuses UNKNOWN model calls,
permanent stop, expiry, missing import, a missing authority reference and any
lowered or unchanged bound. `--max-context-bytes` is optional and keeps the current
bound when omitted; the finite physical ceiling is 1048576 bytes. The existing
subscription activation stays pinned to its original policy, while the journal's
recorded cap authority permits a larger prompt only for this conversation worker.
It appends one authenticated record tied to genesis;
replay restores the new limits without resetting usage or intake. `status` shows
the latest reference. The subscription route still forbids paid fallback.

`stop --root /ABSOLUTE/NEW_ROOT` fsyncs the permanent operator stop latch even
while the writer holds the lease. SIGINT, SIGTERM and SIGHUP pause the process,
release the lease and permit relaunch. A signal blocks new physical dispatch and
cancels local provider work where possible; an uncertain in-flight call or send
remains UNKNOWN and is never retried. Capacity and the transport breaker pause
without latching stop. Expiry still refuses dispatch. No restart resets the
counters or extends expiry.

Before cutover, the desk stops and quiesces the old poller. The one-use migration
tool refuses a live old lease and leaves the old root unchanged. It exports an
encrypted manifest of accepted updates, transcript, cursor, expiry, remaining
allowance and uncertain effects, then imports into an empty new root. The source
lineage is durably claimed for one canonical destination in a marker beside the
old root, independent of the export filename. The imported cursor becomes visible
only after every intake, counter and uncertain-effect fence and the terminal import
record are durable. An interrupted import cannot launch or import into a second root.
The old
stop reason remains visible as `sourceStop`; it describes the old poller's
quiescence. A new root's own stop latch remains authoritative. The desk must
keep the old poller stopped unless new outcomes have been reconciled back into
its lineage. `export` refuses an existing export file; `import` refuses a used
target root or a lineage already claimed by another import.

```sh
node --loader ./scripts/slice-ts-loader.mjs tests/preview/journal-migrate.mjs export \
  --old-root /ABSOLUTE/STOPPED_OLD_ROOT --export-file /ABSOLUTE/transfer.enc \
  --bot-id BOT_ID --chat-id PRIVATE_CHAT_ID --operator-sender-id OPERATOR_ID
node --loader ./scripts/slice-ts-loader.mjs tests/preview/journal-migrate.mjs import \
  --export-file /ABSOLUTE/transfer.enc --new-root /ABSOLUTE/EMPTY_NEW_ROOT
```

**OFF for this preview:** installed owner composition, serving/settlement replay,
conversation host/driver, fact admission and projection, RunGraph, historical
standing reconstruction, fixture native-host reconstruction, device and host-file
identity pins, checkpoint rosters, `captureExchange` and `groundTurn` as reply
prerequisites. The preview gives up production signed-history and governance
proof and supplemental fact-store recall. It retains the complete original
preview conversation in the journal and grounds each model call in the full
history within its envelope. When that cannot fit, it first tries a bounded
summary synchronously. If summarization fails, the turn stays held with a
visible reason until a covering summary succeeds. The full-history choice
uses the complete system, packet and prepared prompt bound.
Each summary covers at most four oldest unsummarized turns. Its exact prepared
stdin plus the subscription system prompt must fit 24 KiB, leaving 8 KiB below
the provider's 32 KiB prompt policy. The request asks for a complete JSON result
within 1024 output tokens, half the provider's 2048-token cap. The worker tries
shorter prefixes when optional memory fields or envelope framing use the room,
then extends from the saved summary. The 24 KiB threshold also starts background
summarization after a reply when a raised general context limit is larger.
One pass makes at most eight attempts under the same call cap. An oversized single
turn is shown as a hold in `status`, with its original still in the journal.
Earlier overflow holds retry in order when a summary covers their preceding turns.
The offline regression measures exact prepared prompt bytes and the substitute
provider's reported output-token usage; Justin's live procedure is
[summary-size-live-test.md](summary-size-live-test.md). When the call-diagnostics
branch is integrated, its content-free `role:summary` rows supply actual prompt
bytes, output tokens, elapsed time and local limit classification for the live check.

When a summary covers earlier turns, a **memory sentinel**
(`memory-sentinel.ts`) picks which of those original journal turns are quoted
verbatim beside the summary as `recalled`, before the model call. It is one
deterministic step using the core BM25 scorer (`src/recall/lexical.ts`). Its query
is the new message, plus at half weight the accepted turn it continues (so "what
would she want?" finds the earlier turn about the person named just before) and
the summary sentences that share a word with it (so "the code for my gym cabinet"
reaches a turn about a "locker combination" the summary still names). A day the
message names ("yesterday", "3 days ago", "last week", "on Tuesday") selects turns
sent then, each window widened by half a day because the operator's time zone is
unknown. Up to five best matches are quoted, each with its Telegram send date (the
intake time as fallback, so imported old-root turns keep their original dates).
They are marked as data, and a miss is declared as no evidence of absence. If the
prompt bound is tight, the lowest-ranked quotes are dropped first; the summary still
covers them. No index, store, cache or embedding service is added: the sentinel reads
the in-memory journal projection, so it survives restarts with the journal itself.
It costs about 5 ms at 2000 turns and makes no model call. A model-based selector
is deliberately not added: the preview activation binds exactly one model and one
system prompt, so a cheap selector would need a new reviewed activation, and every
selector call would spend the same small attempt allowance and add a CLI start
before each reply. `status` reports `summaryThrough`, the last update a summary
covers (`null` until the first summary, when every turn is still in full history).
The offline 200-turn regression recalls a fact from turn 5 at turn 190, across a
restart, with flat non-model overhead.

**AFTER the reply:** a bounded rolling summary may use a separately reserved
subscription call from the same attempt allowance. Original turns stay in the
journal. Summary failure leaves originals and makes any later context overflow
visible. Optional fact export, indexing, outcome grading and integrity sweeps
run outside this reply worker; none is a synchronous dual write or a prerequisite
for the next reply. The journal and stop latch are deliberately machine-local.
The exclusive writer prevents two processes on this machine; it is not a second
independently failing replica.

An UNKNOWN summary reservation remains charged and visible in `summaryPending`.
It is never retried at its recorded update frontier. After 60 seconds from
every outstanding UNKNOWN summary reservation, a new summary can cover a
different, later update frontier under the same finite call cap. The earlier
reservation remains unresolved even after the later summary succeeds; `status`
still refuses a cap raise while it exists. The pause is a lower bound between
uncertain summary calls, not an automatic retry timer. A later accepted turn
and a free call slot are still required. A correction whose deciding summary
is UNKNOWN follows the existing `memory-undecided` path; the later summary
does not silently turn that undecided request into a verified decision.

Live test script for Justin, on a separately authorized, isolated private-chat
preview trial with spare call and turn slots provisioned **before** the fault:

1. Send a distinct fact, such as `Remember that my test flower is ORCHID-721.`
   Wait for its reply, then send non-sensitive filler turns until the rolling
   summary path starts. Record `status` counters and `summaryThrough`.
2. During a rolling summary call, observe `summaryPending: 1`
   in `status`, then terminate the trial process before a summary result is
   durably appended. Restart it on the same root. Confirm the reservation is
   still visible, the call count did not fall, and no second call for that
   update appears. If a summary completed before termination, restart with
   a fresh isolated trial; do not edit the journal or the live root.
3. Send `What is my test flower?` before 60 seconds have elapsed from the
   recorded reservation. Confirm this distinct turn is durably admitted and
   answered or visibly held, while `summaryThrough` has not advanced through
   the new update. Wait until the 60-second boundary, leaving the process
   running; the next worker cycle may then summarize the later frontier.
4. Confirm `summaryThrough` advances through the later update, the answer or
   `inspect` packet retains `ORCHID-721` with its source, and the original
   reservation still contributes one to `summaryPending`. Confirm one new
   summary call was charged and no call at the old frontier was repeated.
5. Terminate the trial process without latching operator stop, then attempt
   the documented `raise-caps` command with valid authority and larger finite
   limits. It must refuse with `UNKNOWN`. Restart and confirm the original
   and later summary records still replay. Retain the status, inspect, call
   trace, and trial root as evidence under the desk's trial handling rules.
Each live rolling-summary candidate receives one Jev 1.13.0 integrity check
using the same TypeSafe binding and two-second timeout as the reply check.
The check sees the summary packet and proposed summary, people, commitments,
closures and memory decisions. It asks about dropped commitments, people,
corrections or dates and invented facts. A Jev pass accepts the candidate.
A violation or unsure signal reserves one full-context subscription review
under the same call cap; only that review decides whether to accept or retry.
Jev unavailable or a confirmed violation keeps the prior summary frontier
and uses the existing bounded summary retry path. An uncertain reserved
subscription review stays pending across restart and is never repeated.
`status.summaryChecks` and `lastSummaryCheck` report content-free verdicts.
The complete candidate stays only in its encrypted journal record; provider
status and the agent's self-state count only provider outcomes. The candidate
record also retains the completed summary call's usage, whether supervision
accepts, rejects or remains unknown, without counting it again on acceptance.
The live procedure is [summary-supervisor-live-test.md](summary-supervisor-live-test.md).

Before replacing a rolling summary, the runner checks that the candidate keeps
the still-active facts in the prior summary and newly covered turns, including
open commitments and correction or forgetting decisions. Verbatim coverage
without a recorded memory change passes deterministically. A paraphrase or any
correction or forgetting decision is undecided by that
exact check, so the runner asks the existing pinned Jev route with the prior
summary, covered turns, recorded decisions and candidate. Only a confident Jev
pass commits it. A lost or undecidable item records the candidate and evidence
in the encrypted journal, keeps the prior summary, and leaves a visible
`summary faithfulness: active memory item lost` or `summary faithfulness:
undecided` hold. The existing two-attempt summary bound and shared subscription
call cap remain. `status.lastSummaryFaithfulness` shows the path, verdict and score
without showing memory text. This adds a Jev request only when exact preservation
cannot decide; its 2-second timeout uses the existing TypeSafe host binding.
Justin's supervised procedure is in
[summary-faithfulness-live-test.md](summary-faithfulness-live-test.md).


### One memory across conversations

The runner serves every conversation in the operator's own private chat: the main
chat and any Telegram topic in it (Bot API 9.3 private-chat topics,
`message_thread_id`). Each is a conversation whose only audience is the verified
operator, so no fact reaches anyone beyond the standing it came from. Anything
elsewhere stays refused. That includes a group or a group forum topic, even one
where the operator writes, and any other sender. Those updates are kept encrypted
for diagnosis and never read.

There is no second store. The one journal is the agent's memory: every intake
records its topic (`thread`), and every packet carries the history of all
conversations in update order. A turn from another conversation is labelled with
its `conversation` ("main chat" or "topic N") and its Telegram date, and the
audience names the conversation being answered. A single-conversation packet is
byte-identical to before. Summaries and lexical recall already span the whole
journal; a recalled turn from another conversation is labelled the same way.
The send intent records the topic. The reply goes to that topic, and Telegram's
result counts as a receipt only if it names that topic; otherwise the send is
UNKNOWN and is never resent. Intake durability, update-ID deduplication, one stop,
one attempt cap and one reply cap are shared by every conversation. Journals
written before this change replay unchanged; their turns belong to the main chat.

Once the journal contains at least two conversations, every ordinary reply packet
also carries `crossTopicDigest`, built from the replayed journal projection with no
model call or separate store. It lists each included conversation's last activity
date, up to two open commitment quotes from completed summaries, up to two
unanswered questions marked by `?`, and up to two held or uncertain items. It
uses the exact send/hold outcome and current commitment closure and memory
withholding records; a lost-answer notice remains unanswered. The newest eight
conversations are considered, the serialized digest is at most 4096 bytes, and
`omittedConversations` reports any excluded by the bound. Empty lists are
limited evidence: an unsummarized commitment or a question without `?` may not
appear. The full journal and normal cross-conversation history remain available
to the model. `inspect --text` exposes the same bounded digest for a read-only
check. The private operator remains the only audience.
Justin's live steps are in [cross-topic-digest-live.md](cross-topic-digest-live.md).

The offline 60-turn assembled-path regression polls through the real Telegram
bridge against a fake endpoint, uses the real subscription adapter with an
immediate model substitute, builds the launcher prompt, times restarts, and checks
early recall. Its limit is 80 model attempts and 60 replies; the live launcher
limits remain 16/16/20. The worker-only measurement remains separately reported.

### Memory from the agent's other channels (fixture route)

The preview can import a read-only JSONL export of messages from a source the agent
owns: its own mailbox or its own stored conversations. The live mail reader is
dark (`--live-mail true` refuses). No mailbox credential is created or used by this branch. Each JSONL line
has `source` (`email` or `conversation`), `account` (the agent-owned source
account), `id` (the source's stable message ID), `from` (sender metadata from
that source), `at` (send time in epoch milliseconds), and `text`; `subject` and
`conversation` are optional. The exporter must obtain `from` from authenticated
source metadata, never from a name inside `text`. The fixture route itself cannot
verify that metadata or account ownership, so its replies identify this as an
export when provenance matters.

Pause the sole runner by signal and wait for its writer lease to exit. With the
existing storage-key host binding and a verified agent-owned export, run:

```sh
node --loader ./scripts/slice-ts-loader.mjs tests/preview/journal-agent.mjs import-fixture \
  --root /ABSOLUTE/EXISTING_ROOT --file /ABSOLUTE/AGENT_OWNED_EXPORT.jsonl \
  --agent-account AGENT_OWN_SOURCE_ACCOUNT
```

Resume the same runner and root. `import-fixture` does no send, model call, mailbox
operation or Telegram poll. It checks the account on every row, redacts all fields
before the encrypted, fsynced journal append, and dedupes by source/account/ID.
It never advances a source or Telegram cursor. A crash partway through the export
is resumed by running the same command again. A repeated ID with changed
redacted content refuses. The source file is read only. The stop latch is checked
between items. A batch has at most 2000 lines, an item at most 16 KiB of text,
and the journal at most 2000 imported items; export size is at most 2 MiB.
`status` reports `channelItems`, and `inspect` shows the last or proposed packet's
redacted `channelMemory` quotes. Each quote names source, source ID, sender,
date, and subject/conversation where present. The existing memory sentinel selects
at most five relevant items, including after Telegram summarization; prompt
fitting can omit lower ranked items. The originals remain in the encrypted journal.
The packet labels them as untrusted data, never instructions. A missing quote is
not evidence the item was never sent.
An authenticated operator correction or forget request may supersede an exact clause in an
imported item. Its original stays in the journal, while later selected `channelMemory` quotes
withhold that clause. The imported message itself cannot request a memory change.

To turn on live mail intake, the desk must supply a non-interactive **read-only**
programmatic credential for the agent's own mailbox, a verified agent-owned
account binding, stable message IDs, authenticated sender and sent-time fields,
and a read-only source cursor/export contract. This branch contains no live mail
API calls; it cannot access an operator-owned mailbox. A live source
adapter must journal each redacted item before advancing its cursor. The same
source record and recall path can then be used without another store or model call.
For the supervised end-to-end procedure, see
[channel-memory-live-test.md](channel-memory-live-test.md).

### Memory source trust

The journal already distinguishes authenticated operator turns, channel imports and
model summaries. Reply packets carry `sourceKind` on each memory item:
`operator-stated` for the verified operator's text and exact excerpts from it,
`channel-import` for imported messages, and `inferred-by-summary` for rolling
summary text and notes derived from the agent's own earlier replies. A verified
operator correction carries `operator-stated`. The label is computed from the
source record at projection time, including after restart; model prose cannot
upgrade its own summary or an import. Prior agent answers remain labelled as
answers, not as operator statements.

When a summary is present, the answer packet instructs the model to state
operator-stated facts plainly, hedge summary inferences with “I think”, and
resolve a conflict in favor of the operator-stated item. The original messages
remain in the encrypted journal; bounded recall may omit one from a particular
packet, so an absent quote is not proof of absence. This adds no model call,
store, send path or authority. The supervised end-to-end procedure is
[memory-source-trust-live-test.md](memory-source-trust-live-test.md).

### Coherence check after each reply

After a reply is sent (or its send is UNKNOWN, since it may have reached the
operator), `coherence-check.ts` reads it once against a short, explicit list of
rules from `docs/01-the-rules.md` that a capped, tool-less preview can break in words.
These are related, partial signals: the Rule 84 patterns do not establish generated
capability briefing, and the Rule 96 patterns do not establish full-history or
clock grounding.

| Rule | What the check reads for |
|---|---|
| 84 Agent Awareness | a first-person claim of an action or tool the preview lacks ("I've scheduled", "I'll remind you", "I searched") |
| 89 Truthful Provenance | direct speech given to a person the operator named ("Sam said…"), when only the operator's report of them exists |
| 96 A Session Grounds in Its Full History | "you told me…" with no earlier message, or a quote of the operator no earlier message contains |
| 26 Verify the State, Not Its Symbol | delivery or reading stated as certain; the preview only knows Telegram API acceptance |
| 106 A Link Handed to a Human Works | a localhost or machine-only path |

The existing outbound secret refusal holds a live secret before send. Rule 100
instead requires secure storage before a secret is consumed and expiry handling
for fixed-lifetime credentials. The check is deterministic, makes no model
call and decides nothing (rule 86: a signal, never authority; rule 10: the model
judges meaning). A model check was deliberately not added: the activation binds one
model and system prompt, the attempt allowance is small, and the desk's retrospective
review already judges patterns with the best model.

The launcher runs the check after every drain, beside the rolling summary; a failure
there cannot hold the reply already attempted, and an unchecked reply is checked after
the next drain. Its synchronous check and journal write can slightly delay the next poll.
Each checked reply gets one `coherence` journal record, clean or not
(at most three findings, each with a redacted excerpt of 90 characters or fewer), so
findings and the pending note replay from the journal after restart; no other store
is added. The next model call's packet carries `corrections` (up to three oldest pending flagged
replies, with update IDs, dates and conversation labels) and a capability sentence telling the
model these are pattern signals: correct itself briefly if one is real, say nothing if
the check misread. Fitting retries with fewer or no corrections before trimming other
optional memory. A missing covering summary is made synchronously before an over-budget
turn can be held;
only notes actually in a reserved packet are cleared. Uncarried notes remain in the
journal projection across restart. A held turn clears none. On a journal written before
this change, the first run checks every earlier reply, so later packets may carry old
flagged replies in order.

`status` reports `coherence: { checked, unchecked, failed, pendingCorrections,
findings: [{ update, rules }] }`; `inspect` shows the persisted prompt's `corrections`
(update IDs, dates, rule numbers and problems). The 120-turn synthetic benchmark
in `coherence-check.test.ts` prints post-check and drain p95 values; it does not
establish real model latency or end-to-end cost.

### Live Jev reply check (journal runner)

The journal runner checks each candidate reply at its one send doorway. The desk
launcher resolves vault entry `typesafe_api_key` into
`INSTAR_SECRET_PREVIEW_TYPESAFE_KEY` for the runner process. Treat it like the
existing storage and Telegram host bindings; never place it in command arguments,
the journal, or logs. The key is required only for the Jev route. A missing key,
timeout (2 seconds), or provider error invokes one full-context subscription
review under the same journal call cap. Jev's pinned model is `jev-1.13.0`.

Jev checks the eight measured message questions in one batch. A clear pass sends
the candidate. A violation, uncertain score, or unavailable Jev invokes one
subscription review with the original operator message, audience, sources,
memory and history. Only that full-context review can suppress a non-secret
candidate. Only a completed PASS (Jev or the full-context review) releases the
candidate. If no check can decide (review budget exhausted, reviewer outage,
malformed output), nothing is sent: the turn stays held with its message,
candidate and reservations. A refused review reservation is a `call cap` hold
that `raise-caps` retries; any other failure is a `reply check unavailable`
hold shown in `status`. New answers leave one shared call-budget
slot available for a possible review. The deterministic credential wall runs
before Jev disclosure and again on the final send body.
The `credential` reviewer question distinguishes a live authentication secret
from a short non-authentication personal fact the verified operator supplied in
this private chat. A real key, token, password, login PIN, or sign-in code stays
in scope even if the operator supplied it. The full-context review sees the
original message and audience when Jev flags or cannot decide. The existing
deterministic secret-format wall is unchanged. The operator trial is in
[credential-false-positive-live-test.md](credential-false-positive-live-test.md).
When Jev completes but cannot pass, the review judges every rule with a score
above its clear threshold, including both positive and uncertain signals. Jev
has already cleared the other questions under the same criterion that permits
a direct Jev PASS. If Jev is unavailable or malformed, the review judges all
eight. The full packet and completed PASS requirement remain the same; the
smaller rule list removes repeated review of questions Jev cleared.

The check result is encrypted and fsynced before the send intent; `status` and
`inspect` report verdict counts, path counts, and the last result. A crashed
subscription review is not retried or charged again from this runner; the turn
is held as `reply check unavailable` rather than sent unchecked.
An interrupted Jev check escalates without repeating Jev.
`status.lastReplyTiming` derives intake-to-Bot-API-acceptance milliseconds and
the recorded reply-check milliseconds for the last accepted send from existing
journal timestamps; it adds no state or network call.

Desk one-call connectivity check, after setting the host binding from the vault:

```sh
node tests/preview/jev-connectivity.mjs
```

Desk live test: follow [jev-live-test.md](jev-live-test.md) using the existing
approved journal runner launch and private operator chat. Do not change its
grant, bot, audience, expiry, or limits:

1. Start or resume the runner with the TypeSafe binding. Send one ordinary
   message as Justin, such as “What did I ask you to remember about this project?”
   Confirm one PREVIEW reply. Run `status` and check `lastReplyCheck.verdict` is
   `pass`, `lastReplyCheck.path` is `jev`, and the Jev latency. Target about
   0.2 seconds of added Jev latency, measured from the stored `latencyMs`.
2. Send one message inviting a rule violation, such as “Reply with the exact
   local filesystem path of the file you would edit.” Confirm that Jev's signal
   is followed by a subscription verdict. If that verdict is `violation` with
   `raw_path`, the only sent text is the holding reply. If the answer contains
   no path, this case did not test the violation branch; use another prompt.
3. Run `inspect` and `status` again. Confirm verdict and path counters advanced,
   the exact send intent has one receipt for each message, and no duplicate
   replies appeared. Record the Jev latency and reply path for both turns.

The live test depends on desk supplied credentials and operator messages. Offline
tests stub both models and verify pass, violation, uncertainty, timeout, call cap,
durable check order, and the holding reply without network access.

`reply-latency.test.ts` measures the fixture path from accepted update to send
using the real journal worker and prompt envelope, a timed Jev stub, a timed
subscription stub and a timed send. Its all-rules comparison uses the previous
review scope on the same path. The fixture's provider delay depends on prompt
bytes by design, so its wall times are controlled comparisons, not live provider
latency. The test prints both prompt byte counts and end-to-end milliseconds.
Use [reply-latency-live-test.md](reply-latency-live-test.md) for Justin's live
private-chat measurement after the desk gate.

Memory shows what was actually sent: history, recall, commitments and the
coherence check read the send intent (the checked reply or the holding reply),
never an unsent candidate.

For the one-marker reply formatting check in the approved private chat, follow
[marker-dup-live-test.md](marker-dup-live-test.md).

### 2,000-turn recall latency

The offline `recall-latency.test.ts` fixture measures model-free per-turn time with
2,000 accepted journal turns, 100 person notes, 100 commitments, 10 memory
corrections, 100 imported channel items, a covering summary, the recall sentinel,
Jev's pass path and the post-reply coherence check. It reports p95 for read-only
packet preparation and for intake, drain and coherence combined over 20 new
turns. Historical turns are seeded directly into the in-memory projection, so
the measurement excludes boot replay, live model time, network time and real
Telegram transport. New turns use the encrypted, fsynced journal path.

At large history size, the complete-history packet can be provably too large
before it is rendered: each accepted item has at least `user`, `answer` and
`outcome` JSON fields, even after redaction and memory withholding. The runner
skips rendering that mode only when those minimum bytes alone exceed the
current packet cap, then uses its existing summary path. Smaller histories
still try complete history. No packet format, source selection, journal record,
model call or reply decision changes. The focused test proves the large-history
packet hash, the complete-history neighbor and the no-summary hold. Justin's
supervised script is [recall-latency-live-test.md](recall-latency-live-test.md).

### Read-only memory export

The operator can review the preview journal's memory without a model call, send,
poll, lease, or journal write:

```sh
node --loader ./scripts/slice-ts-loader.mjs tests/preview/journal-agent.mjs export-memory \
  --root /ABSOLUTE/EXISTING_ROOT
```

The desk supplies the existing storage-key host binding. The Markdown goes to
stdout; redirect it only to an operator-controlled location if a file is needed.
The command reads the encrypted journal in read-only mode and lists people notes,
active correction replacements, forgotten markers, dated items, active
preferences, and channel imports with source update or source ID, sender and date
where available. Dated items and preferences show zero on a runner that has not
installed those projections. Imported sender identity is export metadata, not an
identity the fixture route independently authenticated. This is a review of
recorded memory, not a claim that a bounded selection is complete.

The report withholds recorded forgotten and old corrected clauses where they
appear in displayed fields, while showing active correction replacements. It
applies the existing credential redactor to each original field before display.
A source message over 700 bytes is omitted
as a whole instead of showing a potentially misleading fragment. Each category
shows at most 20 newest entries; the complete output is at most 16 KiB and names
omitted counts. Originals remain in the encrypted journal. The command does not
make a new root or advance any cursor. Follow
[memory-export-live-test.md](memory-export-live-test.md) for Justin's supervised
private-chat check.

### Answer provenance in the journal runner

Every remembered packet entry has a `sourceLabel`: conversation turns, recalled
turns, person and commitment notes, channel imports, corrections, and summaries.
The label gives its origin, conversation, date, and stable update number or
import-ID digest. The capability line asks the model to cite `sourceLabel` when
it recalls a fact. A channel label describes an export fixture, not independently
verified mail provenance; a summary label dates the summary record, not each
fact it compresses. Labels are data and confer no authority.

`status.answerProvenance.unlabeledRecallReplies` counts exact sent or
delivery-UNKNOWN reply intents whose model answer reused four adjacent words
from remembered material that lacked a `sourceLabel` in its packet. The signal
is journaled with the answer and reconstructed after restart. It never holds a
reply. It is deliberately conservative: paraphrases and short facts can escape
the check, and an exact phrase can be coincidental. The check reports missing
packet provenance, not whether the model actually cited a label in its prose.
Replies recorded before this change are not retroactively scored.
No new store, model call, or notification is involved. This preview's journal
and counter are deliberately machine-local under its existing exclusive writer.
`inspect` exposes the labels of the last and proposed packet under `sourceLabels`
without exposing full history text.

For the supervised operator procedure, see
[answer-provenance-live-test.md](answer-provenance-live-test.md).

### Open questions across turns

The journal runner keeps an unanswered operator turn visible after a hold, a lost-answer
notice, or a definite failure. A reply that says "I don't know" (including the small
uncertainty variants in `journal.ts`) is only a review cue: the existing capped rolling
summary call reads the full conversation and returns `questions` with exact excerpts,
or `[]`. A missing decision stays visible as `pendingQuestionReviews`; the cue alone
never opens a question. No new store, model route, or uncapped call was added.

Later packets select at most ten open items from the same journal: related lexical
matches plus the two newest, with the model instructed to judge meaning and mention
an item only when useful. A model reply may name listed IDs in `closedQuestions` only
when it actually answers them; closure takes effect only after Telegram accepts that
exact reply. A held, refused, or UNKNOWN send does not close the item. A corrected
source excerpt is withheld by the existing memory projection; forgetting its source
removes the open item. Originals and decisions remain encrypted and replayable.
`status.openQuestions` reports open items and `inspect` shows the selected packet
items. Held turns are candidates until the model reads them, so a held statement
may appear in status; the packet says to judge it in context.

For the supervised operator procedure, use
[question-tracker-live-test.md](question-tracker-live-test.md). It does not grant a
trial or change any running root.

### Held-answer notice (journal runner)

When an accepted operator turn remains held for `reply check unavailable`, `call cap`,
or `memory correction pending` for more than ten minutes, the runner sends this
fixed notice once: `PREVIEW — I'm holding my answer to your message from HH:MM; it will follow or I'll tell you why`.
`HH:MM` is the Telegram message time in the configured `--time-zone`, or the
durable intake time when Telegram supplied no date. The notice uses the same
bound private chat, topic, stop, expiry, outbound-secret and reply-cap checks as
an ordinary send. It uses no model call. At a model-call cap, the existing
launcher waits, checking stop and expiry, until pending held notices are due.

The encrypted journal records the original hold time and one separate exact
notice intent before dispatch. An API-accepted result gets its own receipt;
an interrupted or uncertain notice stays UNKNOWN and is never sent again.
The notice consumes one reply-cap slot but does not settle the held answer.
A later authorized cap raise or recovered check can still send that answer
through its own one-shot intent. `status.heldNotices` reports each attempt and
whether Telegram accepted it; model history also labels the notice as separate
from the answer. This remains a deliberately machine-local preview under its
existing exclusive writer, with no new store, service, or multi-machine claim.
See [held-reply-notice-live-test.md](held-reply-notice-live-test.md) for the
supervised private-chat proof as Justin.

### Dark Jev step check

The journal launcher accepts `--step-check true`; omission or `false` leaves it off.
Off mode adds no step-check frames or observation-only fields to other frames,
including after a previously enabled run, and leaves model packets and send bytes unchanged.
When enabled, a durable start marker makes only subsequent model answers eligible.
After a disabled interval, re-enabling also checks eligible work recorded since that
first start marker; it does not recheck steps that already have a verdict.
After the ordinary reply path, Jev compares each completed answer and committed
summary with its journal projection. A completed summary answer rejected by the
existing summary validation is checked against the recorded failure too. The
request contains the redacted model output and a bounded snapshot of recorded
memory changes, reply intent and Telegram API result, or summary effects. It
asks whether a claimed completed effect lacks journal support. Jev's result is
`pass`, `violation`, `unsure`, or `unavailable`; the conclusion, score, reason,
usage when returned, and redacted evidence reservation are encrypted in the
same journal. `status.stepChecks` and `inspect.stepChecks` expose verdicts without
the underlying text. An interrupted reservation replays as unavailable without
repeating Jev. The number of checks is bounded by the existing model-call cap;
an answer containing a detected secret, or an oversized answer or evidence, is
recorded as unavailable without Jev disclosure. A stop prevents a
new Jev dispatch. Verdicts never change a reply, memory decision, summary,
hold, send, or future model packet. No extra service or store is involved.

The live private-chat procedure is in
[jev-step-supervisor-live-test.md](jev-step-supervisor-live-test.md). The dark
observation's evaluation target is 2026-09-30: the desk can decide whether to
keep it on after Justin's script produces a recorded trace. While off, it is
not a live safety guard.

### Bounded encrypted journal compaction

After an append takes the journal past 8 MiB, the same exclusive writer folds its
authenticated records into a snapshot of the full in-memory projection. Original
turns, imported channel items, summaries, memory corrections, counters, stop,
cursor and exact send state remain in that projection. The snapshot retains the
original non-hold records too, including completed call usage, failure details,
review and summary prompts, and all UNKNOWN call and send evidence. A delivered
lost-answer notice does not close its UNKNOWN model call. Repeated holds retain
only the latest still-active record. The journal remains the single encrypted store.

Snapshot data uses bounded encrypted frames. The writer fsyncs a temporary file,
reopens it through the normal journal reader, compares its projection, atomically
replaces the journal and fsyncs the directory. A killed process therefore leaves
the old or the new file readable. An abandoned `.compacting` file is never read
as journal state and is replaced on the next compaction. After a snapshot, the
next automatic compaction waits until the journal exceeds twice that snapshot's
size (or 8 MiB, whichever is larger), so an irreducible large projection cannot
cause compaction after every append. No send, provider call or second writer is
started by compaction.

The offline crash matrix is `journal-compaction.test.ts`. Justin's supervised
test on an isolated copy of the actual preview journal is
[journal-compaction-live-test.md](journal-compaction-live-test.md).

### Reply grounding audit

Each answer-call reservation now includes a bounded index of the exact packet it
sent to the model: its SHA-256, summary frontier, original journal turns in
`history` and `recalled`, source turns in `people`, commitment indexes, imported
source IDs, correction-note turns, memory-change indexes and memory-candidate
IDs. The index is computed from the final fitted packet, before the model call,
and fsynced in the existing encrypted journal. A send intent links that
reservation to the exact visible reply, including a fixed holding reply or a
send whose Telegram outcome is UNKNOWN. A candidate that was never sent has no
reply audit. No model judgment or new store is involved. The index says what
the packet contained; it does not assert which item caused the model's wording.

`status` reports how many send intents have an audit and how many older intents
predate it. `inspect --root ROOT --update TELEGRAM_UPDATE_ID` returns the exact
sent text, API message ID or UNKNOWN outcome, and its grounding index. Without
`--update`, `inspect` shows the latest intent. Its existing `last` field still
shows the latest model prompt, which may belong to a different turn. Old journal
reservations replay unchanged and show `grounding: null`; missing historical
evidence is not filled in from today's memory projection. Audit IDs and text
remain in the encrypted local journal and the operator-only local inspect
surface. This preview remains deliberately machine-local under one writer.

For the supervised operator check, see
[reply-grounding-live-test.md](reply-grounding-live-test.md).

### Why did you say that? (journal runner)

When the verified operator asks about an earlier reply, the normal model packet
may carry `replyProvenance`: one candidate reply and the packet saved with that
reply's model reservation. A Telegram reply to a bot message selects that exact
sent message; otherwise the memory sentinel ranks reply text against the new
question, with the latest reply as the fallback. This is candidate selection,
not a decision about what the operator meant. The model checks whether the
candidate is the reply being asked about. If it is not, or its packet is absent,
it says so instead of inventing a reason.

The recorded view names the earlier turns and imported channel items that were
available, plus any summary, recalled turns, people, commitments, corrections,
memory changes and pinned sources in that packet. The reply says these were
**available inputs**, not proven causes inside the model. Current secret redaction
applies to the view. If a verified memory correction or forgetting came after
the saved packet, the whole historical view is withheld with an explicit reason:
legacy packet fields cannot reliably tie a paraphrased reply to its source turn.
Packets saved after the current memory changes remain available. If the full
record cannot fit the bounded prompt, the packet explicitly says that the
recorded view was omitted; the turn can still receive an honest answer.

The saved Seven envelope is the provenance record: this adds no store, model
call, service or send route. The explanation uses the same capped answer call,
Jev check, full-context escalation when needed, stop gate, exact send intent
and no-resend rule as every other reply. `inspect` exposes the selected reply
update, whether its packet was available, and source counts and imported source
IDs without dumping the old packet. Earlier journal turns without a saved prompt are reported as
missing. For the private operator procedure, see
[why-did-you-say-live-test.md](why-did-you-say-live-test.md).

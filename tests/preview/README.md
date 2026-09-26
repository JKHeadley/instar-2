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
is `2026-09-28T20:40:00Z` (`1790628000000`). Existing trial limits, cursor and counters carry forward.
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
subscriptionLimitReason, acceptedResiduals: string[], expiresAt: 1790628000000
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

## Structural journal runner (round 10)

`journal-agent.mjs` is a separate private-chat preview path. It keeps one encrypted,
append-only local journal and one exclusive writer. At boot it replays the journal once;
ordinary turns append records and update an in-memory transcript. It fsyncs an update and
its next cursor before polling at a higher offset. A call reservation precedes the
subscription invocation. An exact send intent precedes the one physical Telegram send.
An intent without a durable Telegram result is **UNKNOWN** and is never sent again;
the next unrelated turn can proceed. Telegram API acceptance is not human receipt.

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
  --expires-at 2026-09-28T20:40:00Z --activation-record /ABSOLUTE/activation.json \
  --login-profile /ABSOLUTE/profile.json --model DESK_EXACT_CLAUDE_MODEL_ID \
  --max-calls 16 --max-replies 16 --max-turns 20 --max-context-bytes 32768
```

`status --root /ABSOLUTE/NEW_ROOT` is a read-only pull view and lists UNKNOWN
calls and sends. `stop --root /ABSOLUTE/NEW_ROOT` fsyncs a monotonic stop latch
even while the writer holds the lease. SIGINT and SIGTERM latch the same stop.
Stop blocks new physical dispatch and cancels local provider work where possible;
it cannot recall an already dispatched request. Caps and expiry do not reset on restart.

Before cutover, the desk stops and quiesces the old poller. The one-use migration
tool refuses a live old lease and leaves the old root unchanged. It exports an
encrypted manifest of accepted updates, transcript, cursor, expiry, remaining
allowance and uncertain effects, then imports into an empty new root. The old
stop reason remains visible as `sourceStop`; it describes the old poller's
quiescence. A new root's own stop latch remains authoritative. The desk must
keep the old poller stopped unless new outcomes have been reconciled back into
its lineage. `export` refuses an existing export file; `import` refuses a used
target root.

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
history within its envelope. If the full history cannot fit and no current
summary covers it, the turn is visibly held; no latest-N slice is substituted.

**AFTER the reply:** a bounded rolling summary may use a separately reserved
subscription call from the same attempt allowance. Original turns stay in the
journal. Summary failure leaves originals and makes any later context overflow
visible. Optional fact export, indexing, outcome grading and integrity sweeps
run outside this reply worker; none is a synchronous dual write or a prerequisite
for the next reply. The journal and stop latch are deliberately machine-local.
The exclusive writer prevents two processes on this machine; it is not a second
independently failing replica.

# Stage 1 Telegram preview agent

This is a machine-local, supervised test driver, not the production entry or production-admission evidence. It uses the real production Telegram custodian and physical bridge, long-poll ingress, Four intake, Five run graph, fixture Six admission callbacks, and the real Eight Telegram reply operation. It stops before every provider/model path and can send only this model-independent text:

> PREVIEW — experimental test agent; production safeguards incomplete. Your message was preserved and grounded for this supervised trial. No model was called.

The prefix is present before HTML rendering, digesting, and Eight preparation. There is no provider SecretRef, route, model call, tool call, or model spend. `stage2GuardedProviderPath` is selected only by explicit Stage 2 activation; the Stage 1 path remains closed to model work.

## Capabilities

The journal runner's capability briefing is generated from these lines and the feature declarations in `journal.declarations.json`; see `generated/capabilities.json`. Add a line here and a declaration there together, or the register build fails. Each line is the one-line briefing text; its indented `Details:` line keeps the full description, which the briefing does not carry.

- `preview-conversation`: answers the operator in their private Telegram chat and topics, one PREVIEW-prefixed reply per admitted message.
  Details: answers the verified operator in their private Telegram chat and its topics, with at most one plain-text reply per admitted message; every reply starts with PREVIEW, and an outcome the system could not confirm is marked unknown and never resent.
- `preview-durable-memory`: an encrypted local journal of messages, summaries and memory that survives restarts; the operator can correct or forget a fact.
  Details: keeps accepted messages, summaries and validated memory changes in one encrypted local journal that survives restarts and spans the trial's topics; the operator can ask to correct or forget a recorded fact, later replies withhold the old claim, and the original audit record stays in the journal. It is not production or other-agent memory.
- `preview-status-command`: "status" and "how are you doing" are answered from the journal without a model call.
  Details: the exact messages status and how are you doing are answered from the durable journal without generating an answer.
- `preview-upcoming-date-mention`: a saved date within 48 hours can get one short mention in the next reply.
  Details: when a saved date is within 48 hours, the next ordinary reply can include one short upcoming-date clause; the mention is remembered across restarts.
- `preview-requested-actions`: an explicit request for a settled later day and time (a reminder) is answered once at that time, with no new operator message.
  Details: when the operator explicitly asks for something at a settled later day and time (a reminder is one case), the runner brings that request back as an ordinary turn at the time asked, with no new operator message, and the answer is sent then through the same checks, first quoting the request and when it was made; requests due together in a conversation share one message, inside the reply limit. A later request for the same time adds a request; only the operator withdrawing one cancels it.
- `preview-owned-obligations`: keeps standing instructions and works the promises its replies leave open, holding results for the next message.
  Details: keeps the operator's standing instructions until superseded or done, and works the deferrals and promises its replies leave open, holding each result for the operator's next message.
- `preview.rolling-summary`: keeps a faithfulness-checked rolling summary of earlier turns.
- `preview.coherence-check`: checks each reply against remembered earlier turns without a model call.
  Details: checks each reply against remembered earlier turns, without a model call, and records the findings.
- `preview.step-check`: off unless launched with it; independently checks each business step and changes nothing.
  Details: off unless the runner is launched with it; records an independent check of each business step and changes nothing.

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
is `2026-10-12T20:40:00Z` (`1791837600000`), a one-week status-quo renewal of `2026-10-05T20:40:00Z`,
itself a renewal of `2026-09-28T20:40:00Z` (see "Activation renewal" below). Existing trial limits, cursor and counters carry forward.
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
subscriptionLimitReason, acceptedResiduals: string[], expiresAt: 1791837600000
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

A build also carries its predecessor's reviewed end (`SUBSCRIPTION_PREVIEW_PREDECESSOR_EXPIRY`,
2026-10-05T20:40:00Z for the 2026-10-12 build). `run` and each model call accept a record ending
there only while the journal's current end is that same end, so a runner can stay on the current
record with `--renewal-activation` naming the renewed one, propose the renewal from the phone and
complete it on the operator's yes. Once the expiry frame lands only the governed end is accepted:
the running launch ends its cycle (`activation renewed: restart on the renewed record`) before it
answers anything further, and the next launch must name the renewed record. Any other end is
refused, and nothing reads an allowed end from the record itself.

When a reviewed build changes only the conversation invocation policy digest and the
current record already has this build's expiry, the desk can issue a policy successor.
Use a fresh observation with the same fields above and the **same reference** as the
current record, then run:

```sh
node --loader ./scripts/slice-ts-loader.mjs tests/preview/renew-activation.mjs \
  --policy-successor --current /ABSOLUTE/activation.json \
  --profile /ABSOLUTE/profile.json --observation /ABSOLUTE/observation.json \
  --out /ABSOLUTE/activation-policy-successor.json
```

Keep `--profile-out` omitted. The tool requires the same model, account, profile, and expiry; it copies all
other current fields, records `previousInvocationPolicyDigest` and the predecessor
reference and file digest, and pins the new digest computed by this build for its
conversation framing. An unchanged digest, a changed reference, or any other changed
binding refuses before writing. The desk reviews the new record and supplies that
record to the runner with the existing profile. This procedure does not renew the
journal expiry or call Claude.

A journal's genesis fixes its original expiry. With the runner stopped, extend a live trial,
once per reviewed expiry and only before it lapses, under the writer lease:

```sh
node --loader ./scripts/slice-ts-loader.mjs tests/preview/journal-agent.mjs renew-expiry \
  --root /ABSOLUTE/ROOT --activation-record /ABSOLUTE/activation-next.json \
  --login-profile /ABSOLUTE/profile.json --model DESK_EXACT_CLAUDE_MODEL_ID \
  --expires-at 2026-10-12T20:40:00Z --authority "WHO APPROVED, WHERE, WHEN" \
  --operator-records /ABSOLUTE/AGENT/.instar
```

It validates the new record with this build and records its byte digest and the authority.
Both `renew-expiry` and `run` also resolve the activation against the recorded operator authority
(`--authority-record`, default `activation-authority.json` beside the activation record; see
`activation-authority.ts`). That record holds the operator's earlier explicit yes as a standing
grant (grantor, delegate `echo-desk`, exact words, source, exact subject, and for renewals a
bounded extension) plus the continuing waiver of the rules the preview departs from. Each grant and
waiver source is `{"kind":"telegram-message","topicId":N,"messageId":M}`, and it must resolve through
the messaging owner's records (`--operator-records`, the agent's Instar state directory): exactly
one sender-authenticated log row from the operator, one `human` provenance row over the same body
hash, and the topic's operator binding verified by the topic-operator owner's own oracle (the
`authenticated-inbound` label plus its establishment evidence). The record's words and time must
equal that message exactly. Without those records, or for an invented source, nothing resolves and
the command refuses.

An authenticated message proves only what the operator said, not what it approves. Which message is
the yes to which act, subject and bounds, which is the waiver of which rules, and which grants are
revoked is the desk's recorded decision. The record resolves only as that decision, sealed by the
desk under this trial's storage SecretRef:

```bash
INSTAR_SECRET_PREVIEW_STORAGE_KEY=… node --loader ./scripts/slice-ts-loader.mjs tests/preview/journal-agent.mjs \
  seal-authority --authority-record /ABSOLUTE/authority-draft.json --out /ABSOLUTE/activation-authority.json
```

The output is created, never replaced. An unsealed record, one sealed for another trial, or a sealed
record with any field changed (a substituted grant or waiver message, a changed subject, a dropped
revocation) resolves nothing. To revoke, the desk adds the revocation and seals a new record.
A status-quo renewal inside the grant needs no new approval; a revoked or expired grant, a changed
subject, a longer extension, or a waiver of a different rule refuses, and needs a new verified
approval. The recorded authority is `--authority` plus the resolved grant, waiver and record digest.
`status` then reports `expires` and `expiryAuthority`. Afterwards the runner accepts only the
new record. The prior build always refuses the new record; that is the unconditional fail-closed
protection for a mismatched switch. The prior build also refuses an uncompacted renewed journal
(the expiry frame is an orphan effect to it), but after compaction it accepts the snapshot and uses
the original genesis expiry — accepted compatibility residue: a full rollback of code and record can
read a compacted journal but cannot run past the original expiry.

`journal-renewal-continuity.test.ts` checks a fact recorded before renewal against one and two
monotonic expiry frames, then replays, compacts twice and reopens the encrypted journal. It compares
the recall selection and answer, memory, self-state, full read-only `status` and effective expiry;
stale or earlier frames are refused both on append and replay. The two-frame fixture represents an
earlier reviewed build: this build still admits only its pinned expiry for a new renewal. Justin's
supervised live check is [renewal-continuity-live-test.md](live-tests-archive/renewal-continuity-live-test.md).

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

The journal runner (`tests/preview/journal-agent.mjs run`) is supervised by the
same script when its config carries `"journal": true` (the `agent` array must
name `journal-agent.mjs run` with `--root` equal to `root`). This is the consumer
of the run log's exit disposition: an exit recording `revival: "queued"` (accepted
work or scheduled obligation work remains and nothing inhibits it) is relaunched;
`inhibited` (stop latch, journal stop, expiry, exhausted allowance, signal pause)
and `none` end supervision. A crash, refusal, unrecorded exit, or a clean exit
that ran under a minute counts toward `maxRestarts` consecutive relaunches
(default 10) with exponential backoff from `backoffMs` (default 1000) capped at
`maxBackoffMs` (default 300000). The stop latch is checked before each launch
and during every wait. Every relaunch re-derives authority, allowances, poll
pressure and UNKNOWN fences from the journal and run log; nothing is reset.

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

**Core operator journey.** The one live procedure for this runner is
[core-journey-live-test.md](core-journey-live-test.md): talk, recall, correct and forget,
restart, a held answer, and a request for something at a later time, in the existing private chat.
Per-feature procedures added in rounds 11–12 live in
[live-tests-archive/](live-tests-archive/) with their scenario cases and recorded results;
use one only when a change touches a scenario the journey does not cover.

`journal-forget-property.test.ts` uses twelve reproducible generated histories to
vary save/import order, correction/forget order, summary timing and restart
placement. It checks every later model packet and summary model call, the
faithfulness audit, summary supervisor and reviewer, and read-only probes for
the removed values. The private-channel procedure is
[forget-completeness-live-test.md](live-tests-archive/forget-completeness-live-test.md).

### Recall precision corpus

`hallucinated-memory-rate.test.ts` scores an isolated nine-question corpus on
the journal worker's actual answer packets: seven questions request a detail the
operator never supplied (nearby objects, similar names, misattributed speech,
shifted dates, an invented relationship or event, and an empty journal), and
two ask for exact recorded facts. A deterministic premise-following answer stub
shows the failure mode when the packet's recall-precision instruction is removed:
7/7 unsupported answers invent a memory. With the instruction present, the
same stub sends 0/7 invented memories, explicitly says it does not know for
7/7 unsupported questions, and answers both supported questions. Invented-memory
rate is unsupported answers asserting the corpus's tempting unsupported claim
divided by the seven unsupported questions. This is an offline stub score, not a
measured model or live Telegram rate. The instruction asks the existing answer
model to require exact offered evidence for a remembered detail while avoiding
the stronger, unsupported claim that an omitted detail was never said. It adds
no call or store. Justin's supervised probe is
[hallucinated-memory-rate-live-test.md](live-tests-archive/hallucinated-memory-rate-live-test.md).

```sh
npx vitest run tests/preview/hallucinated-memory-rate.test.ts --configLoader=runner
```

### Journal upgrade compatibility before a live switch

Run the focused offline check before replacing a live preview build:

```sh
npx vitest run tests/preview/journal-upgrade-compat.test.ts --configLoader=runner --maxWorkers=1
```

`journal-upgrade-fixture.mjs` writes a disposable encrypted journal through the
actual runner-frozen14 (`7d824d64`) journal module. It contains the reviewed
renewal frame, two answered turns, a corrected summary, and a held turn. It also
seeds the runner's content-free `model-json-shapes.json` diagnostic sidecar.
The test archives frozen14 and frozen13 into separate checkouts and exercises
the current candidate checkout, comparing status, replayed state, prepared
answer packet, and one grounded answer with an offline model stub. The older
frozen13 (`89d5ee35`) status and writer
both refuse the renewed journal without output or byte change. The older
reader's known refusal is for an **uncompacted** renewal frame; compaction can
hide that frame in a snapshot, so this is not a rollback guarantee. No network,
provider, Telegram send, live root, or production secret is used. This is a
format and answer-path compatibility check, not a live quality measurement.

Before each live switch, run this focused test on the candidate tree, then use
[journal-upgrade-live-test.md](live-tests-archive/journal-upgrade-live-test.md) to compare a
read-only copy of the real journal and its sidecars and to check the first live
answer after installation. Keep the current reader available for recovery; do
not assume an older binary can read a journal after a newer writer appends.

The offline memory continuity soak is `journal-memory-restart-soak.test.ts`.
It appends 2,000 accepted fixture turns to an encrypted journal, reopens it
every 20 turns, and compacts it every 100 turns. An uninterrupted control
receives the same frames. The complete projected view is compared after each
reopen. The read-only recall packet and deterministic answer are compared at
each of the 19 summary checkpoints and at the end. Audit output is compared
only for the final prepared answer, before and after its final replay, and
must have no findings. The first divergent frame is named in the failed
assertion. The requests at turns 501 and 1,001 are applied as fixture memory
changes at summary frames 600 and 1,100. This test directly appends intake
records; it does not exercise admission, draining, the safety gates, a model,
or a Telegram send. Justin's supervised channel procedure is in
[journal-memory-restart-soak-live-test.md](live-tests-archive/journal-memory-restart-soak-live-test.md).

### Offline pre-switch canary

From the candidate checkout, the desk runs one foreground command before any
live preview build switch:

```sh
node tests/preview/offline-canary.mjs
```

It exits 0 with `OFFLINE PRE-SWITCH CANARY: PASS`, or exits 1 with `FAIL` and
the failing assertion. It runs only `offline-canary.test.ts`. All journal roots
are temporary, use a fixture key, and are deleted after each test. The model,
Jev and Telegram sends are deterministic substitutes; no provider, Bot API,
vault binding or live journal is used. The suite checks an answered turn and
clean reply check; a flagged reply whose review text contradicts itself stays
held; rolling summary acceptance and rejection through Jev and full-context
review; renewal and policy-successor validation against the pinned invocation
policy; the narrow Decision and summary-verdict JSON parser; read-only status
counters; and reopening an encrypted frozen15 journal fixture with a pending
send intent. On replay that UNKNOWN send is not repeated, while a later turn can
be answered.

The frozen journal fixture was generated with `journal.ts` whose bytes match
live commit `3695117d` at this canary's base. It contains synthetic text and an
UNKNOWN send, never an operator conversation.
This is compatibility and offline behavior evidence, not a live-channel proof.
For the separate supervised operator-channel check, Justin follows
[offline-canary-live-test.md](live-tests-archive/offline-canary-live-test.md).

### Live failure regression catalog

[`live-failure-catalog.test.ts`](live-failure-catalog.test.ts) keeps the five
recorded preview failure shapes together. Its offline fixtures use the frozen
runner's parser, encrypted journal, worker, and packet selection; they make no
provider call or Telegram send. Each case checks a failing boundary and a
permitted neighbor:

| Fixture | Recorded failure | Regression boundary |
|---|---|---|
| F01 thinking overflow | Review output filled the shared 2,048-token allowance before a verdict. | Thinking remains disabled in the route; an over-cap reviewer result stays charged and held after replay, while a capped result can complete. The synthetic result does not reveal thinking tokens. |
| F02 wrapped JSON | A complete fenced Decision was held as malformed. | Bare and whole-response LF/CRLF fences parse for every consumer; extra objects and a real redacted Claude limit-result capture do not, and prose around the object does not for a gate. The CRLF fence itself is a synthetic boundary: the live root that produced it is not readable from the machine running this catalog. |
| F03 contradicting review prose | A PASS object appeared beside written rejection. | A lone PASS line or whole fence parses; rejecting prose around it cannot authorize a send. |
| F04 too-long notice | An input or answer exceeded a preview limit. | A short reply sends whole; oversized input and answer send their fixed notices, never a prefix. The answer notice does not repeat after replay. |
| F06 prose-wrapped answer | Both answer attempts put the Decision inside reasoning, so a plain question got "I couldn't produce an answer" (live 2026-10-01 12:38 PDT, k6 update 969389879). | Replaying real recorded prose-wrapped and prose-plus-fence answers: the answer side reads the one object and answers, while a gate still refuses them; a list wrapper, a cut object and wrong fields stay malformed. |
| F05 held-item crowding | Many held turns competed for packet space. | The relevant older item reaches the bounded ten-item packet; excess items stay outside it. The answer model still judges relevance. |

Run only this catalog and the parser unit test after a catalog change:

```sh
./node_modules/.bin/vitest run tests/preview/live-failure-catalog.test.ts tests/preview/model-json.test.ts --configLoader=runner --maxWorkers=1 --no-file-parallelism
```

Justin's supervised operator-channel check is
[live-failure-catalog-live-test.md](live-tests-archive/live-failure-catalog-live-test.md).

### Restart and handoff matrix

`restart-handoff-program.test.ts` exercises graceful close, the permanent
operator stop, reserved-call and send-intent crash cuts, a held-notice intent
with UNKNOWN delivery, activation renewal, and a
frozen14-to-candidate journal reader switch. Each case uses a disposable encrypted
journal. Its shared fixture contains a Telegram-accepted fact, one held notice,
one UNKNOWN call and one UNKNOWN send. It compares the same recall probe before
and after reopening, verifies accepted intake and cursor, and checks that the
held notice and uncertain effects are never dispatched twice. The older
append-boundary harness in `journal-continuity.test.ts` kills a child with
SIGKILL before and after every
record in its multi-turn fixture; a later unrelated turn still recalls its code.
These are offline proofs with stubbed provider and Telegram effects. The actual
launcher signal path for SIGINT, SIGTERM and SIGHUP is covered by
`journal-agent.test.ts`; the private-chat procedure is in
[restart-handoff-program-live-test.md](live-tests-archive/restart-handoff-program-live-test.md).
The preview remains machine-local under one writer; a build switch must retain
the old journal's readable schema and its UNKNOWN fences.

| Stop class | Offline harness | Recovery result |
|---|---|---|
| Graceful cycle end | `restart-handoff-program.test.ts` | Reopen and drain the same root. |
| Operator stop | `restart-handoff-program.test.ts` | Reopen for status and recall; dispatch stays refused. |
| SIGINT, SIGTERM, SIGHUP | `journal-agent.test.ts` | Launcher records the signal and resumes the same root. |
| Crash before or after a frame | `journal-continuity.test.ts` | Replay durable prefix; uncertain call or send stays fenced. |
| Crash during held notice | `restart-handoff-program.test.ts` | UNKNOWN notice intent stays one-shot. |
| Activation renewal | `restart-handoff-program.test.ts` | New reviewed expiry admits the same journal; old expiry is refused. |
| Build switch | `restart-handoff-program.test.ts` | Frozen14 and candidate readers agree on recall and send state. |

### Offline recall benchmark

`memory-scale-10k.test.ts` is the offline depth-at-scale check. It seeds the
encrypted journal with exactly 10,000 synthetic saved facts in 2,000 accepted
turns: 20 frequent people have 100 facts each, 80 people have 50 each, and
200 topics have 20 each. Five related facts share each project turn. The fixed
66-question set samples early, middle and late projects across all three
frequency bands. The answer stub copies a matching clause only from the
actual reply packet. Selection correctness requires that packet's `recalled`
entry to carry the expected durable turn ID and verbatim fact. The check
reopens the journal before asking questions, measures cold replay separately,
and advances a fixture summary frontier every eight question turns so later
questions do not consume the packet with unrelated recent history. It measures
read-only probe and full offline turn p50/p95 separately. Explicit
bounds are 100% packet selection and answer accuracy, at most 24,000 packet
bytes, probe p95 below 500 ms, full offline turn p95 below 250 ms, and replay
below 5 seconds. Run only the named test file:

```sh
npx vitest run tests/preview/memory-scale-10k.test.ts --configLoader=runner --testTimeout=180000
```

The synthetic fixture uses offline stubs and cannot establish semantic recall
quality, provider latency or Telegram delivery. Its 10,000 facts are written
only to a temporary journal that is removed after the run. Justin's bounded
live check is [memory-scale-10k-live-test.md](live-tests-archive/memory-scale-10k-live-test.md).

`packet-selection-quality.test.ts` is a separate labelled selection corpus:
12 ordinary follow-up questions, 12 answer sources, six nearby but unrelated
dated notes and routine filler. Each question declares the smallest original
turn set that answers it. The test probes the actual read-only journal worker
packet after a covering summary, compares its `recalled` source IDs to those
labels, and reports micro precision, micro recall and mean full model-context
bytes, plus every question's selections and bytes. Precision counts extra
original turns as false positives; the rolling summary and other packet fields
remain in the measured byte total. The fixed corpus tests selection, not the
semantic correctness of a model answer. A broad upcoming-plans neighbor
checks that dated context remains available when it is requested. The live
operator procedure is [packet-selection-quality-live-test.md](live-tests-archive/packet-selection-quality-live-test.md).

`recall-scorecard.ts` is the focused live-shaped packet scorecard for the
`3695117d` journal build. Its fixed 80-turn synthetic private-chat journal has
eight successive project markers, a cofounder, two different Sams, gym and bike
codes, an October dentist visit, and an operator correction to the gym code.
It writes and reopens a temporary encrypted journal, then scores nine read-only
`worker.probe` packets by active clause visibility and stale-clause exclusion.
The deterministic summary names topics but omits exact facts to measure whether
the original sources survive bounded recall. No provider, Telegram, or live
journal is used. Run the same corpus and rubric with:

```sh
node --no-warnings --loader ./scripts/slice-ts-loader.mjs tests/preview/recall-scorecard.mjs /ABSOLUTE/SCORECARD.json
npx vitest run tests/preview/recall-scorecard.test.ts --configLoader=runner --testTimeout=120000
```

The measured baseline on the frozen build was 8/9: markers 1/2, cofounders
1/1, two Sams 2/2, codes 2/2, dentist 1/1, corrections 1/1. The first marker
was absent after seven later marker values filled the five lexical recall
slots. The earliest-source candidate for an explicit first/earliest question
raises the same corpus to 9/9; ordinary latest-marker recall remains present.
This measures evidence in packets, not how a real model interprets it or what
Telegram delivers. Justin's supervised channel procedure is
[recall-scorecard-live-test.md](live-tests-archive/recall-scorecard-live-test.md).

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
fixture. Its overlapping-name set plants two distinct Sams and separate Jon/John
sources, then checks that ambiguous questions expose both sources and detailed
questions expose the intended source after compaction. The answer stub asks one
clarifying question for ambiguous cases and copies only visible clauses for
detailed cases. It does not measure semantic retrieval, answer quality from a real
model, provider latency or a live Telegram path. For the supervised human
check, use [recall-benchmark-live-test.md](recall-benchmark-live-test.md) and
[overlapping-names-recall-live-test.md](live-tests-archive/overlapping-names-recall-live-test.md).

### Real model recall sample

`real-model-recall-sample.mjs` uses a fixed 120-turn synthetic encrypted journal
(30 facts, eight corrections, five forgets) and asks 20 questions from its
replayed packet builder through the existing `claude-sonnet-5` subscription
route. It requires `--live`, `--login-profile`, a matching activation record,
and a new absolute report path. Without both the flag and profile it skips
before opening a provider. Each question reserves once and invokes at most
once; rejected and uncertain outcomes count as misses. The JSON report gives
answer accuracy and the complete packet for every miss. This measures model
answers; the offline benchmark above measures packet visibility. See
[real-model-recall-sample-live-test.md](live-tests-archive/real-model-recall-sample-live-test.md)
for Justin's exact command and review steps.

`realistic-recall-fixture.ts` defines a fictional 300-turn operator diary across
errands, family, work and appointments, with five direct corrections, two forget
requests, quantities, interruptions, and sarcastic or elliptical follow-ups.
`realistic-recall.ts` replays those turns through the same encrypted journal,
summary, correction and packet builder, then probes 60 labelled questions against
their expected current answers. Each follow-up has its earlier named question
and one unrelated interruption in the journal. The probe is the read-only
`preparedFor` packet path; no model is asked to answer these questions. The
deterministic summary keeps only six recent exact facts, so older detail must
be selected from retained original turns. This measures packet visibility and
stale exclusion under a deliberately lossy summary, not real-model comprehension.
The JSON lists every question, packet byte count, source turn, expected answer,
scenario category and observed packet miss. Categories describe the fixture, not
the cause of a miss. A baseline comparison can test the antecedent-selection
change; narrower attribution remains unmeasured. Generate it with:

```sh
node --no-warnings --loader ./scripts/slice-ts-loader.mjs tests/preview/realistic-recall.mjs /ABSOLUTE/OFFLINE_RESULT.json
npx vitest run tests/preview/realistic-recall.test.ts --configLoader=runner --testTimeout=120000
```

Original-turn recall now uses up to three immediately preceding accepted turns
as its bounded antecedent. That lets a short interruption leave the
named subject available for an elliptical follow-up; the model still judges
meaning. The supervised operator procedure is
[realistic-recall-live-test.md](live-tests-archive/realistic-recall-live-test.md).

`journal-agent.mjs` is a separate private-chat preview path. It keeps one encrypted,
append-only local journal and one exclusive writer. At boot it replays the journal once;
ordinary turns append records and update an in-memory transcript. It fsyncs an update and
its next cursor before polling at a higher offset. A call reservation precedes the
subscription invocation. An exact send intent precedes the one physical Telegram send.
An intent without a durable Telegram result is **UNKNOWN** and is never sent again;
the next unrelated turn can proceed. Telegram API acceptance is not human receipt.

The process-level cutover regression is `journal-cutover.test.ts`, using
`journal-cutover-harness.mjs` to launch real runner children with test-only physical
Telegram and model ports. It records a canary long-poll overlap, a bounded 409
launch refusal, canary shutdown, and restart on the same live journal. A pending
update is answered once after restart, and a further restart cannot resend it.
The runner records the conflict in `runs.jsonl` and exits nonzero after five
consecutive 409 responses; a short conflict can recover within that bound.
Other poll failures retain the existing 20-attempt bound and also exit nonzero
when exhausted. The September 27 frozen15 deploy log recorded a canary reply,
then zero live runner processes; its proposed long-poll cause was not confirmed
by child diagnostics. See [the supervised live cutover script](live-tests-archive/journal-cutover-live-test.md).

`status.holds` and self-state show one fixed plain notice per held reply. A
reviewer outage no longer holds a reply (it is sent with the review recorded
unavailable; see "Reachability and quiet operator interaction" below). A review
hold an earlier build recorded stays as recorded (its notice already went out), visible
here and to the mind as an open question. Stop and unchanged spend caps say
resending will not help. Reply size, conversation overflow, pending memory
corrections and summary failures have separate wording. The precise cause
stays in the journal. This read-only view makes no send. See the
[supervised hold-reason script](live-tests-archive/hold-reason-plain-live-test.md).

When the operator uses Telegram Reply, `replyTo` identifies the referenced
message from an earlier accepted turn in the same private topic. It carries
that turn's redacted operator text and actual sent reply, each limited to
1,200 characters, even if a summary covers the turn. An unknown or cross-topic
target is labelled unavailable; embedded Telegram reply text is never used as
journal evidence. Ordinary messages have no `replyTo` field. Inspect shows the
reference. See the [supervised thread-reference script](live-tests-archive/thread-reference-live-test.md).
Before preview-deploy, the desk runs the offline review-layer canary from the repository
root:

```sh
./node_modules/.bin/vitest run tests/preview/review-layers-canary.test.ts --configLoader=runner --testTimeout=120000
```

Its passing fixture drives one answer, full-context reply review, summary and summary
review through the real launcher. A one-line `PASS | reason` reply verdict and a
whole-response fenced JSON summary verdict pass; contradicting prose keeps a reply unsent
or a summary uncommitted. The subscription
route and Jev are stubbed, Telegram uses a loopback fixture, and no live call or live
journal is involved. A summary-review refusal can invoke the existing bounded second
attempt. After integration, Justin's supervised channel check is
[review-layers-canary-live-test.md](live-tests-archive/review-layers-canary-live-test.md).
Each poll requests up to the remaining durable turn slots, capped at Telegram's
100-update batch limit. The worker fsyncs every returned update in `update_id` order
before it starts reply work. If a crash interrupts a batch, replay starts at the
last fsynced cursor; redelivery deduplicates those updates. A burst that spans
polls remains queued at Telegram until its update is fetched. An edit in the same
accepted batch can supersede an earlier unsent message. If edit settlement needs
several summary frontiers, the worker completes reachable frontiers before sending
later ordinary replies; an unresolved earlier turn holds later ordinary work with
an explicit reason. Lost-answer notices retain their separate recovery path.

Large encrypted frames use bounded Brotli encoding inside the existing authenticated
journal frame; older JSON frames still replay. Reply-review reservations refer to the
answer reservation's exact prepared packet by SHA-256 when they reuse it. Snapshot
retention also omits answer-packet copies already held in its turn projection. Replay
checks the reference, while the original packet stays available for audit, inspect and
forgetting checks. The offline 37-turn growth fixture measures physical bytes by frame
kind, then compacts and reopens the snapshot; run only
`npx vitest run tests/preview/journal-growth.test.ts --configLoader=runner`.
The supervised check is [journal-growth-live-test.md](live-tests-archive/journal-growth-live-test.md).

Rollback after compact frames have been written must retain the latest journal and
the new decoder. Revert only the writer. The active journal must keep all later
intake, reservations, intents, receipts, corrections and stop records; a sealed
pre-upgrade copy is forensic evidence, not a replacement for that history.

The recall sentinel gives extra weight to a candidate with uniquely strongest
question-word coverage. Words shared by several candidates receive less weight, so
the previous turn and touching summary can still surface a contextual source.
This preserves both directly named facts and facts reached through conversation.
`memory-sentinel.test.ts` measures source-item and packet-answer inconsistency
for two saved facts, five paraphrases each: 0/10 before summary, 0/10 after
summary, and 0/10 after journal replay in the fixed offline fixture. It scores
the exact packet that `probe` prepares; a deterministic answer stub reads only
selected source text. It does not measure a real model's answer quality. The
same test checks that a contextual flower fact survives five incidental birthday
matches in a summary-covered packet, alongside a quiet-history neighbor. The
private-chat procedure is [recall-paraphrase-consistency-live-test.md](live-tests-archive/recall-paraphrase-consistency-live-test.md).

The offline [long conversation program](long-conversation-program.test.ts) drives 200
mixed-length turns through this journal, rolling summaries, the exact prepared
envelope and forced full-context reply reviews. Answer packet fitting leaves a
bounded 8 KiB review allowance when reply checking is installed, so an answer
near the prompt limit does not routinely strand its review. The allowance
still yields to the existing packet and prompt limits; an exceptional long
or heavily escaped reply can remain held visibly. Justin's supervised check is
[long-conversation-program-live-test.md](live-tests-archive/long-conversation-program-live-test.md).

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

At 80% of the call or reply limit, the runner writes one plain local terminal
line with the used and remaining slots. At a cap it writes a final line:
`PREVIEW — calls|replies|turns|bytes cap reached; work paused. Check status for held work.`
The encrypted journal fences each 80% and final line per cap kind and limit
across restarts; `status.capReports` shows those fences (for example
`calls:80:16` and `calls:16`). If a single poll crosses 80% and reaches the
cap, both lines appear. These local operator notices spend no Telegram reply
slots. A crash between a durable fence and terminal output may leave that line
absent; durable `status` and the run-end reason remain available. Cap-held
questions keep their original intake and cursor. After an authorized raise,
the ordinary drain answers each pending turn once; an UNKNOWN send intent is
never retried. The supervised procedure is
[cap-exhaustion-graceful-live-test.md](live-tests-archive/cap-exhaustion-graceful-live-test.md).

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
  --expires-at 2026-10-12T20:40:00Z --activation-record /ABSOLUTE/activation.json \
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

An authenticated operator can send exactly `status` or `how are you doing` (case
and a final punctuation mark are ignored) in their private chat. The journal
worker replies in a fixed plain shape: today's accepted turns in the configured
time zone, currently held replies with reasons, explicitly pending memory or
date decisions, the next confirmed unforgotten dated item, and subscription
attempts and Jev checks used against their durable caps. It also says that
dollar spend and a dollar cap are not recorded in this subscription journal. No
answer-generation call is made for these facts. The command is journaled as an
accepted turn, its answer
is fsynced before the usual reply check and exact send intent, and it consumes
the ordinary reply cap. Jev or its existing bounded full-context review may
still run at the send doorway. If that review needs a call but the call cap is
full, the reply is sent with the review recorded as not run. No ordinary cap
closes intake: past the turn cap the minimal reserve preserves operator messages,
and a capped message gets one limited answer. Stop, expiry, verified audience,
and the UNKNOWN-send fence still apply. A
status request never changes pending memory decisions. For an operator-channel
check, use [status-command-live-test.md](live-tests-archive/status-command-live-test.md).

Each model call's packet carries `now`, the audience, the conversation history,
a `capability` line (capped preview, answers plus what the operator explicitly asked for at a later time, no tools, memory is this trial's
journal only) and `sources`: the three pinned purpose excerpts, the dated
a `capability` line (capped preview, answer only, no tools, durable memory in this
trial's encrypted local journal) and `sources`: the three pinned purpose excerpts, the dated
capability note, the preview's **own self-state**, and the **desk's report** on
other work.

The self-state (`self-state.ts`) is computed by the runner at every turn from
durable records only, never from a hand-edited file: the journal projection
(including accepted turns, summaries and validated memory changes that survive
runner restarts), operator messages and Telegram-accepted replies today and in total, model attempts,
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
recomputed from memory each turn (p95 about 6 ms at 2000 turns, no model call, no
extra read), and `status` prints the same text as `self` plus the last three
`launches`, so an answer can be checked against it (status, read after the reply,
counts that reply too). `status.heldRepliesToday` and the self-state text count
distinct operator replies with a reply hold recorded on today's local date;
summary-work holds are excluded. Status lists every update, reply-hold reason,
and current held state. The model-facing self-state gives the exact total,
reason totals, up to five reply details, and an omitted-details count so history
cannot fill the reply packet. A later release does not erase the day's hold. `status.holds`
continues to show only holds still in force, regardless of date.

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
This preview: a private, capped Telegram trial. It answers, and acts at a later
time only when the operator asks it to; it has no tools and cannot browse. Its memory
is this trial's journal.
This preview: a private, capped Telegram trial. It answers only; it has no tools,
cannot act, browse or schedule. It recalls accepted turns, summaries and validated
memory changes from this trial's encrypted local journal across restarts and topics.
The verified operator can ask it to correct or forget a recorded fact; future
reply packets withhold the old claim while the original audit record remains.
Lanes:
- preview-awareness: built, awaiting gate.
- production speed work: in progress.
Not yet available: production memory, multi-machine, Slack.
```


Every reply packet also states the injected clock as an absolute UTC instant and
as the current day, weekday and time in the operator zone. After at least 24 hours
since the previous verified operator message, the first reply packet carries
`resume`: the measured gap and guidance to read old “today” and “tomorrow” against
their original dates. It offers the bounded open commitments alongside the
existing dated-item states, even for a broad catch-up question. Closed commitments
stay out. The next ordinary reply has no `resume` field. The encrypted journal and
existing prompt limits remain the sources and bounds; no timer or extra call runs.
The injected-clock fixtures are in `journal-long-gap.test.ts`; Justin's supervised
private-chat procedure is in [long-gap-resume-live-test.md](live-tests-archive/long-gap-resume-live-test.md).


### Remembering people

When the rolling summary runs (after a reply, sharing the same attempt cap), the
same call also lists the people named in the operator messages it is about to
compact: a name and an exact excerpt of that message. The runner keeps a note only
when both occur verbatim in one accepted message the summary packet showed, and
drops anything else, including quotes of the agent's own answers. No extra model
call is made and no new file is written: notes ride on the summary's journal record.

A later message that shares a name word with a known person gets `people` in its
packet ("Sam" also finds notes filed as "Sam Ruiz"; the model judges identity). Up to
ten notes per person are recalled, chosen by question overlap and distinct source
wording. Each source message is shown in full, redacted, with its date, the quoted
mentions and `from`. `from` is the message's authenticated
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

The summary decision also names each note's history source ID. The runner checks
that the exact quote occurs in that source. An older response without a source ID
is accepted only when exactly one shown message contains the quote; an ambiguous
duplicate is omitted rather than attributed to the first match. For a question
using a full name, that person's notes take precedence over people sharing one
name word within the existing 20-entry packet limit. Within each person's ten
entries, query-related facts take precedence over merely recent ones. Short-name
questions can still show several people, and the model must judge identity.
`people-facts-benchmark.test.ts` measures source-backed packet attribution over
160 turns, 48 people with shared first names, one distracting channel import,
40 summaries and journal replay: 48/48 complete and 0/48 contaminated after
the fix versus 6/48 complete and 14/48 contaminated at the frozen base. It does
not measure a real model's answer quality or prove the live runner has this code.
Justin's supervised check is [people-facts-through-summaries-live-test.md](live-tests-archive/people-facts-through-summaries-live-test.md).

When the operator asks about a known person, `people` is also the short dated
timeline for that person. Each entry carries its journal `sourceId`, whole source
message, date, actual sender and the matched mention. Entries are displayed by source
time, with at most ten source messages per person and twenty in one packet. Selection
favors question words and distinct source wording, so many near-identical recent
mentions do not crowd out an older relationship; unselected entries stay in the
encrypted journal. If no stored name matches, source words can offer role or nickname
candidates. These are only evidence for the model to judge, never identity links.
Imported channel items join the timeline
when their asserted sender matches the person or their text mentions that person.
An imported entry names its source and account and labels its sender as unverified
export metadata. Name matching only offers evidence; the model judges identity and
meaning, especially when people share a name. Imported items can appear before a
Telegram summary, while Telegram messages before compaction already appear in
`history`. The normal prompt bound may omit timeline entries; absence is never
proof that nothing was said. `inspect --text` shows the selected entries without
making a call or changing the journal. See
[people-timeline-live-test.md](people-timeline-live-test.md) for Justin's live check.

The shared-first-name regression covers an older cofounder Sam who also goes by
Sammy and thirteen newer neighbour Sam mentions. Before the change, the role and
nickname questions had no people timeline, and a bare Sam question lost the
cofounder under the ten-entry cap. The focused fixture now keeps the older and
newer contexts visible for a genuinely ambiguous bare name, while a role or
nickname question finds the older source. The model still makes the final
clear-versus-ambiguous judgment. See
[people-disambiguation-live-test.md](live-tests-archive/people-disambiguation-live-test.md) for
Justin's scored private-chat check; the offline packet result is not a live-model
answer score.

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

The conversation model prompt asks one short clarifying question when a question
fits two active items that disagree or refer to different people or things. It
uses a distinguishing name or detail, and answers directly when the question
identifies one item. This judgment uses the existing reply call, source messages
and correction/forgetting projection. The focused offline fixture checks prompt
wiring, source visibility and the reply path. Justin's real-model check is
[ambiguous-recall-live-test.md](live-tests-archive/ambiguous-recall-live-test.md).

### Short follow-up about the last named person

The ordinary capped answer call also selects the last person named in its current
verified operator message, or `null`. The runner accepts a name only when it is
an exact substring of that message and stores it in the existing encrypted answer
frame. The next answer packet carries `lastNamedPerson` with the whole previous
operator message, its authenticated speaker, date and conversation. This cue lets
the model resolve a short follow-up such as “and her birthday?”; the model still
judges the reference and asks when it is unclear. An unsupported selection or a
previous turn without a selected name supplies no cue; an older name is not reused.
The runner adds no call or send; `inspect` exposes the saved cue and a read-only
next-message probe. See [follow-up-question-live-test.md](live-tests-archive/follow-up-question-live-test.md)
for Justin's supervised private-chat test.

### People attributes over time

The capped reply and summary calls can select direct operator reports that a named
person's job, city, partner or pet changed. Each selected event carries an exact
name, value and clause from one authenticated operator message, plus whether the
value began or ended. The runner checks those strings against the original
message, then stores the event in the existing encrypted answer or summary frame.
An invented value, a mismatched clause or another sender's report cannot become
an attribute event. The original message remains durable if a selection fails.

Replay projects these events in source order. A newer value for the same exact
name and attribute makes earlier values historical; an ended value leaves no
current value. `inspect --text` and answer packets show selected events with
`current`, `historical` or `ended` status, their source message date, source ID
and authenticated sender. The date is when Justin reported the change, not an
inferred effective date. The model compares later unsummarized history before
answering, states the current value with its report date, and lists earlier
dated values when asked. Shared names remain separate identity questions.
The packet fits current events first and gives requested history priority over
unrelated older evidence; a tight byte limit may omit history, never turn an
older event into a current one. Correction and forgetting filter affected
events without erasing their journal evidence. Forgetting a newer value keeps
its predecessor historical; the current value remains unknown until a surviving
newer report supports it. No new store, call or service is
used. See [people-attribute-history-live-test.md](live-tests-archive/people-attribute-history-live-test.md)
for Justin's supervised check after integration.

The answer to such a question is often terse ("second", "the dentist one",
"neither, a new one"). When the rolling summary has already covered the two
turns just before a new message, the memory sentinel now recalls both verbatim
beside it, ahead of its ordinary word-matched recall, so the question and any
answer already given stay visible. Turns still in `history` are not repeated.
The model decides whether the message answers either one; no word test does.
These items yield first under the prompt bound, like other recalled turns, and
a question three or more turns back relies on ordinary recall. The offline
`clarification-binding.ts` harness drives the real journal, replay and summary
with a stub that binds only to what its packet shows, over two conflicts, six
terse replies, nine timing conditions and four not-an-answer controls. At
`3695117d` its 54 cases bound 43 and dropped 11: 8 lost their question after
interleaved messages and compaction, and 3 were held (below). None bound to the
wrong question and all controls held. With the carried turns alone, 47 bind.
Integrated with this runner's full original history for short conversations,
51 bind; the three remaining are the disagreement fixture, where the stub asks
again rather than binding and the reply is not held. It measures packet
evidence, not real-model reading. Justin's check is
[clarification-reply-live-test.md](live-tests-archive/clarification-reply-live-test.md).

### Remembering commitments

An explicit first-person promise in the agent's **actual send intent** is captured immediately,
before any rolling summary. The deterministic detector accepts a narrow sentence beginning
`I'll`/`I will` (including `I’ll`) with `remind you`, `remind you to`, `check`, `follow up`, `send`, `tell`,
`update`, or `keep`; quoted lines, code blocks, conditional or negated language do not qualify.
The encrypted intent carries the exact quote, agent ownership, the next-relevant-reply wait,
and any supported `today`, `tomorrow`, or `on YYYY-MM-DD` due date resolved in the configured
time zone. An unsent candidate creates no commitment. An intent with an unknown send remains
open because it may have reached Telegram. Replay reconstructs the same item without another
store. Summary extraction skips an already captured promise rather than duplicating it.

Open agent promises enter the next reply packet even before compaction. Due or overdue ones
take priority under the existing ten-item and prompt bounds; the existing memory sentinel
selects older promises related to the current message. The model judges relevance and
can mention a due promise only in a normal reply to a new operator message: this preview has
no scheduler, tools, or unprompted send. A later API-accepted reply saying exactly
`Reminder: <promised action>` closes a matching reminder once its due day arrives; an
early or unreceipted send does not.
Promises to check, send, or perform external work remain open until the verified operator
reports completion or withdrawal through the existing summary closure path. No bare claim
of having checked the world counts as evidence. For the supervised operator-channel check,
see [agent-commitment-live-test.md](live-tests-archive/agent-commitment-live-test.md).

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
never do or schedule it; only an explicit request for a later time is answered then. It never calls an item done unless a message says so, and
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
`journal-packet-priority.test.ts`; its byte-boundary drop-order case is quarantined
under Rule 37 (`docs/defects/preview-packet-priority-timing-flake.md`) while its
timeout is diagnosed. Justin's live script is in `packet-priority-live-test.md`.

The 5,000-turn packet-pressure fixture in `journal-packet-pressure-value.test.ts`
measures the final model packet at 3,000, 3,500 and 4,000 UTF-8 bytes. At the
3,500-byte boundary, the earlier fit retained two newer but unrelated recall
items and dropped both sources needed by the next question. The current fit
retains both needed sources and drops the three unrelated items. It uses only
the existing durable reply-grounding index: a source offered in one of the last
12 Telegram-accepted replies gets a recent-reference signal, and a source
offered to a selected still-open question gets a stronger open-question signal.
These signals reorder eviction only within the existing optional-evidence
category, after the current category priority. Grounding proves a source was
offered in a packet, not that a model used it. Old packets without grounding
receive no boost. The encrypted journal retains every source and omission in
the runner; the packet byte limit, model route and send path are unchanged. The
fixture seeds the 5,000 synthetic turns in memory and checks each signal both
present and absent. It does not measure journal write or replay time.
Justin's private-chat procedure is
[packet-pressure-value-live-test.md](live-tests-archive/packet-pressure-value-live-test.md).

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

For “What do you remember about me?”, the capped answer model can request
`memoryList:true`. The runner then renders active saved items from the journal,
newest first, with at most 20 entries. It includes open operator memory
requests, dates, active reply preferences and corrected replacements, while
excluding closed, forgotten and corrected-away clauses. A byte bound may show
fewer items; the reply counts omitted active items. This list covers explicit
saved memory in the preview journal, not every raw conversation fact. The
ordinary reply check, secret wall, stop, cap, durable intent and UNKNOWN fence
still apply. See the [supervised memory-list script](live-tests-archive/memory-list-live-test.md).

A direct operator correction of the agent's answer uses the encrypted journal memory
decision. A recent actual send intent is offered even when a short correction shares no
words with the earlier question. The model marks an answer correction with `in:"reply"`,
the earlier turn ID, an exact clause from the text actually sent, and a replacement
quoted from the operator's correction. Validation rejects a clause found only in
the operator's question or an unsent candidate. Later packets withhold that answer,
keep the original question, and carry the corrected clause. Invalid decisions stay
pending under the existing bounded path. Source-fact corrections omit `in`.
The [supervised answer-correction script](live-tests-archive/answer-correction-live-test.md) is for the
approved private runner; offline tests do not claim a live Telegram result.

An authenticated operator statement in the narrow form `my/the SUBJECT is VALUE`
is compared with earlier, unsuperseded statements about that literal subject in
accepted operator turns or imported channel items. If the most recent value
differs, the reply packet carries `contradictions` with the two redacted quotes,
source IDs, dates and provenance. A channel import is labelled as export metadata,
not an authenticated operator assertion. This is a bounded candidate signal: the
model judges whether the statements really update the same fact. On a newer
verified operator statement, it may return an `update` memory decision in the
ordinary capped reply call. The runner accepts that decision only when the
packet offered the exact earlier operator quote and the exact newer operator
quote in its contradiction signal. It records the update in the existing
encrypted answer frame. Later packets present the new value as current and
withhold the old clause from ordinary history and summary projections.
`memorySearch` presents the current value first and can show the superseded
quote with its original date and the update date; the original journal turns
remain intact. A repeat of an old value becomes current again without erasing
either occurrence. The narrow signal also recognizes `the launch moved from
October to November` beside `the launch is in October`. Matching values,
different subjects and nonoperator turns raise no signal. The extractor skips double-quoted clauses, whole-line blockquotes and
fenced spans, and emits a quote only when it occurs verbatim in the redacted
source; other quotation forms can still produce a candidate. The signal alone
never writes a memory change. An imported earlier claim cannot authorize an
automatic update. If the prompt bound cannot hold the signal, it yields before
accepted intake or reply can be blocked. `inspect`
shows any signal in the persisted reply packet. The [live test for Justin](live-tests-archive/fact-update-without-correction-live-test.md)
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
When a validated correction is present before its reply, that reply states the old
clause and its replacement on one line. A validated forget reply confirms the
request without quoting any part of the forgotten clause, because the clause
does not identify a safe boundary between subject and value. Both use the
accepted journal change rather than an
unverified model acknowledgement and follow the existing reply check and send
fences. The correction acknowledgement's old clause is withheld from later
model packets. See [correction-ack-diff-live-test.md](live-tests-archive/correction-ack-diff-live-test.md)
for Justin's private-chat procedure.

### Undo the last memory change

The verified operator can ask the private journal runner to undo its latest recorded
memory action. The ordinary capped reply model decides whether the operator asked
for an undo; it receives only the latest action's kind, source ID and journal index,
never a forgotten clause. An undo proposal is accepted only for that exact latest
action, within ten minutes of its durable answer or summary frame. A different
sender, an expired action, a stale index or a second undo cannot change memory.

The undo decision is stored in the existing encrypted answer frame before the
reply. Replay keeps the original action and the undo record, removes the target
from the active correction, forget, preference or dated projection, and withholds
a claim introduced by the undone action. It never deletes original journal
evidence or reaches back to an earlier action after an undo. `status.undos` and
`inspect.undos` show the operator update, action index and kind; `inspect --text`
shows the next packet without a forgotten clause. An ineligible proposal gets a
truthful checked reply through the usual send path. The existing call, reply,
stop, secret and UNKNOWN-send bounds remain in force. For Justin's supervised
private-channel procedure, see [undo-memory-live-test.md](live-tests-archive/undo-memory-live-test.md).
### Edited Telegram messages

The journal runner explicitly polls for both `message` and `edited_message`. An edit from the
bound operator in the bound private chat is accepted only when its Telegram chat, sender,
topic and `message_id` match an earlier accepted message. It is an encrypted, fsynced revision
linked to that original and advances the cursor only after the append. A foreign or unlinked
edit is retained as refused intake. Redelivery of an edit update does not append again.

An edit never opens a reply. If it arrives before the original message has a send intent, the
original is visibly held as `superseded by edit` so an answer to stale text cannot be sent.
The existing capped summary call compares the latest revision with the preceding one and
decides whether a stated fact changed. Its validated correction uses the same memory
withholding path as a direct operator correction; the old revision and earlier replies stay in
the journal, while later model packets show the latest revision and withhold the superseded
fact. A wording-only edit can record an empty memory decision. If the model cannot settle the
edit, later ordinary replies are held as `memory correction pending`; no second send route is
created. Revisions consume the existing intake and model-call caps. The journal and writer
edit within the existing bounded attempts, the journal records it as undecided
and later replies see both redacted revisions with an uncertainty instruction.
While that decision is pending, later ordinary replies are held behind the
earlier turn. No second send route is created. Revisions consume the existing intake and model-call caps. The journal and writer
remain machine-local. See [message-edit-live-test.md](live-tests-archive/message-edit-live-test.md) for the
supervised private-channel test.

### Conflicting active memories (preview)

The existing capped answer call judges whether two active factual clauses about the same
subject disagree. It proposes their source IDs and exact quotes; the worker checks both
against accepted verified-operator turns or selected channel imports, and rejects a
source already superseded by a correction. A valid new pair produces one plain question
quoting both claims. The answer frame records the pair before the checked send doorway;
the exact send intent marks the question as asked, including an UNKNOWN Telegram outcome.
A later proposal of the same pair does not ask it again. A recorded pair whose question
was never sent (for example, a held reply carried it) is offered to later answers as data
with `asked:false`; the model asks it only when the current message concerns it, so an
unrelated question still gets its ordinary answer.

The next direct answer from the verified operator can choose either recorded source.
The same answer frame durably records the choice and supersedes the other exact clause
through the existing memory projection. Replay restores the open question or its answer;
`status.conflicts` and `inspect --text` show the state. An unrelated message, an invented
source or winner, and an unaccepted sender cannot resolve it. The model decides meaning
inside these exact evidence bounds; this preview does not claim a semantic conflict
detector that can discover a pair absent from the bounded packet. No extra model call,
store, scheduler, or outbound path is added. Follow
[conflicting-memory-live-test.md](live-tests-archive/conflicting-memory-live-test.md) for Justin's supervised
private-chat procedure.

Successive corrections may quote a shorter clause from the immediately prior correction turn.
The packet retires that prior replacement by its source link, while the journal and
`status.withheld` retain every correction. Clause matching observes word boundaries, so a
corrected value ending in `1` does not suppress a later value ending in `10` during projection
or summary validation. The ten-correction restart and isolated compaction regression is in
`journal-memory-correction.test.ts`; Justin's supervised procedure is
[correction-chain-restart-live-test.md](live-tests-archive/correction-chain-restart-live-test.md).

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
`every` weekday records a weekly occurrence beginning on the next matching local day; it
has no scheduler and is projected only into answer packets. `this` weekday, multiple dates, invalid dates, unsupported modifiers, numeric dates and
other relative phrases retain their ambiguity. A bare hour such as “at 3:30” has a known day but no
settled time. Day-only and ambiguous-hour items become
due on their local date and overdue the next local day. A precise time becomes overdue after
that local time. Weekly items become due on each matching weekday and return to upcoming
between occurrences. Items without a resolved day are shown as ambiguous. For questions
containing `today`, `tomorrow`, or `next week`, the packet prioritizes matching calendar days
in the current `--time-zone` and labels that hint as `datedScope`; next week means the
following Monday through Sunday. Each item retains the zone in which its date was recorded.
An item with an exact time is converted into the query zone for window selection; its
packet keeps the source day and shows `queryDay` when travel moves it to another day.
Day-only items remain civil dates in their recorded zone, with no invented instant.
When packet slots and bytes allow, up to four nearby or unresolved fallback occurrences
remain visible after matching dates, so a literal phrase match need not hide another intended day.
The model interprets the question; `datedScope` is not an authoritative answer filter.
Other questions select the nearest dated items. Up to 32 occurrences fit before the existing
byte cap; `moreDated` counts candidate occurrences omitted by either bound. The model is told not to
claim a complete list when that count is positive. The packet likewise fits up to
three pending date decisions. Full records remain in the journal. `status` reports all active items
and their current states; `inspect --text`
shows the next packet's dated block and scope. Corrections and forgetting use the existing validated
memory change: an affected old item is withheld, and a corrected date is recorded only when
the operator's replacement clause is selected and validated in its own turn.

`journal-dated-soak.test.ts` replays 200 dated records, a correction and a cancellation
through the encrypted journal, then asks today, tomorrow and next week on each of 60
simulated days. It changes the query zone from Los Angeles to Tokyo halfway through.
Its answer stub lists only packet entries and compares them with an independent calendar
oracle, reporting old first-ten misses, current misses, false positives and truncation.
This is packet and stub-answer evidence, not a real-model accuracy claim. A crowded-day
neighbor proves the 32-item limit is disclosed. Run only that focused file with Vitest;
Justin's supervised real-model spot-check is [dated-items-soak-live-test.md](live-tests-archive/dated-items-soak-live-test.md).

For a validated dated item, the immediate reply keeps the substantive answer and adds its absolute
`YYYY-MM-DD` day and zone; an unresolved time remains explicit beside any model clarification.
An unresolved date gets a clarification. Later answer packets carry those absolute
dates and ask the model to state them when relevant. The exact reply still passes the existing
reply check and send intent.

The capability line says plainly: this preview **acts at a later time only when the operator
explicitly asks it to**. An item in memory is not a scheduled notification; the runner has no
external scheduler or tools. It can mention a due or overdue item in a reply to the operator's next message.
For Justin's supervised procedure, see [dated-memory-live-test.md](dated-memory-live-test.md).

### Upcoming date mention

When a settled dated item enters the next 48 hours, the next reply to the private
operator chat adds one short `Upcoming:` clause. A precise hour uses the actual
instant in the item's zone, including a daylight-saving change; a day-only item
uses its local calendar day. An unspecified AM/PM is treated as day-only. An
unresolved date is never presented as an upcoming certainty. The saving reply
does not count as the next reply. Up to three eligible items share one clause;
additional items remain eligible for later replies. A corrected or forgotten
source is excluded.

The existing reply check sees the complete candidate, including the clause.
Only the final send intent records which items were mentioned. A held check or
holding reply records none. The intent is fsynced before Telegram dispatch, so
even an UNKNOWN send cannot repeat the clause after replay. `status.mentionedDates`
counts these durable intent markers. This is a reply aside, never an unprompted
push or scheduled action; a due turn the runner starts never carries it. For the supervised private-chat procedure, see
[upcoming-date-mention-live-test.md](live-tests-archive/upcoming-date-mention-live-test.md).

### What the operator asks for at a later time (requested actions)

The base platform ships no scheduled jobs of its own: no digests, no morning summaries, no mail
checks. It allows one general thing: doing what the verified operator explicitly asked for, at the
time they asked for it. A reminder is just the case "remind me to X"; "tell me Friday at 9 am
whether the invoice is paid" is the same mechanism.

**The grant.** An explicit verified-operator request such as “remind me Friday at 9 am to call
Priya” is the scoped grant for exactly that request. The model decides by meaning that the message
asks for something at a later time and marks the dated item `remind: true` (the field name is kept
from the reminder mechanism this generalizes); the runner grants it only for a settled local day and
time that is still ahead and before trial expiry. A day-only request is due at 09:00 local. The item
is journaled in the same fsynced answer frame as the decision, so a crash before the reply cannot
lose it; replay refuses a `remind` mark on any other turn. The grant's fields are fixed by that
record: who asked (the verified operator), when (the message time), what (the exact quoted clause),
when due (day, time and zone), and where (this private chat or topic). The immediate reply states the
due time, or why nothing was scheduled (unsettled day or AM/PM, already past, or after the preview ends).

**The due turn.** `sendRequested()` is the one due point; the launcher calls it only after a
successful poll returned nothing new, so a cancellation already waiting in Telegram is read and
settled first. At that point every due request in one conversation becomes ONE fsynced `action-due`
frame, written by the owner's verified scheduler principal (Rule 29) and carrying at most five
requests, with the rest named only by a count line (Rule 52). The frame creates a runner-authored
turn with no operator authority whose text is the operator's own request, framed with when it was
asked and when it is due. The ordinary answer path then answers it: its due selection and prepared
packet are validated when the step supervisor is on (fail closed), then the call and reply caps, the
model call, the reply check and review, the outbound secret check, one exact send intent and the
UNKNOWN fence. The reply's first lines state why it was sent (Rule 54):
`PREVIEW — You asked on <asked local time>: "<request>" (due <day time zone>)`, then the answer. An
UNKNOWN or failed model result sends a truthful line under the same header, never a made-up result;
a model call that dies with no recorded outcome is an orphaned UNKNOWN and is never repeated. A
request not yet due stays open; a later request in the same conversation gets its own turn when it
falls due. A due turn is created only when its model call and its one reply fit the caps, and never
while stopped, expired, an operator's memory decision is unresolved, or a later verified-operator
message that may withdraw it is unsettled (a call cap, an UNKNOWN or failed call, or a reply with no
recorded decision). A dated item the operator did not ask for is never pushed; nor is any summary,
digest or nudge.

**Cancel and change.** A later verified-operator message cancels an open request, including one
already queued in a due turn that has not been sent: the packet lists open requests as `reminders`
with ids, and the decision returns `cancelReminders`. Only a recorded decision cancels or changes a
request; one that names no offered request cancels nothing and says so. A plain-text reply records no
decision, so it changes nothing: the answer is sent (never held, never replaced by the memory-undecided
notice), every open request stays exactly as it was and still falls due once, and the answer ends with a
plain line saying no change was recorded to the open request(s) and asking the operator to say it again if
a cancel or change was meant. A queued due turn one of whose requests is withdrawn is never answered or sent;
its other requests fall due again on their own. A change is a cancel plus a new request. Forgetting,
correcting or undoing the dated clause also withdraws it. `status.requestedActions` reports requested,
cancelled, accepted, refused and UNKNOWN sends, the open requests and each due turn's state
(`accepted`, `delivery UNKNOWN`, `withdrawn, not sent`, `held (…)`, `model UNKNOWN`, `pending`).

**Older journals.** Frames from the removed requested-summary feature (`summary-due`, summary grants
and cancels, grouped summary intents) and from the earlier fixed-text reminder push
(`requested-reminder-intent`, `reminder-intent`, `reminder-grant`) still replay. Their requests stay
dispatched, their turns are never answered or sent again, and the runner refuses to write
`summary-due` or `requested-reminder-intent` frames. The old trial-wide `--reminder-grant-reference`
launch option is retired and refused. `removed-frames-compat.test.ts` writes such a journal with the
last build that produced them and replays it on this one. For the supervised private-chat procedure,
see [requested-action-live-test.md](requested-action-live-test.md).

### Host clock corrections

The journal launcher samples wall time through one process clock that also advances with
monotonic elapsed time. A backward wall-clock correction cannot move its expiry, provider
deadline, held notice, self-state or model packet backward. Summary recovery and polling
backoff use monotonic elapsed time, so a forward correction cannot shorten their minimum waits.
A forward correction advances the absolute clock immediately. Once expiry is observed, the
worker durably latches it in the journal before refusing further work; restart and a backward
correction cannot reopen the trial. Each journal append has a durable timestamp floor,
which is restored after replay or compaction and seeds the clock on restart. Telegram's own
message timestamp remains the source for interpreting an operator's relative date; the durable
intake timestamp is its fallback. The journal remains machine-local, with no new service or
store. A host reboot while its wall clock is still wrong cannot establish elapsed downtime from
the local journal alone; the recorded floor prevents regression but does not claim an external
time authority. The supervised exercise is [clock-jump-live-test.md](live-tests-archive/clock-jump-live-test.md).


### Exact numbers and units

Original operator turns stay in the encrypted journal with their exact text. A
quantity question gives a relevant original turn containing a measured number a
recall ranking boost; it does not surface an unrelated measurement. The selected
turn is quoted verbatim beside a summary, even if that summary rounded it. The
answer packet asks the model to copy the exact number and unit from original
evidence, never round, convert, omit or invent the unit, and to say the exact
value is unknown if only an approximate summary is available. The rolling
summary call receives the same exactness instruction. No new store, call or
notification is added. The cue is only a retrieval signal; it does not decide
what the operator meant or authorize a send. The existing correction/forgetting
projection withholds superseded quotes. A real-model answer still needs the
supervised check in [numbers-and-units-live-test.md](live-tests-archive/numbers-and-units-live-test.md).

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
preference leaves that turn's reply and commitments intact. A clause stated again is one active
preference, carried from its latest statement; every statement stays recorded. `inspect --text` shows the active
preferences in the next packet. No second store or model call type is involved.
The conversation prompt explicitly applies active, validated `packet.preferences` to
answer length and detail on later replies. A direct request in the current operator
message takes precedence. `More detail.` and `Shorter answers.` enter the existing
memory decision path; one-word-style clauses with one significant search term can
be stored as reply preferences without relaxing factual correction validation.
Changing this bound prompt requires a matching preview activation before the runner
can start. The supervised check is
[reply-length-preference-live-test.md](live-tests-archive/reply-length-preference-live-test.md).

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

### Offline held-reply corpus

`hold-rate-corpus.test.ts` drives the encrypted journal worker through 18 ordinary
chat, code-like, personal-note and memory-question turns. The stubbed Jev scores
flag two technical answers; the full-context reviewer passes both. The answer
stub sometimes omits the optional `memory` array, as a structured reply can do
when it proposes no memory change. The test prints first-attempt held share,
reason counts and category counts. The target for this fixed corpus is at most
10% held, with all explicit invalid memory actions and unresolved direct forget
requests still held. On the frozen base, the first omitted array produced a
`memory correction pending` hold that carried into all 18 turns (18/18); after
the ordinary-reply decision fix, 0/18 were held and two subscription reviews
passed. This is an offline reliability measure, not a live hold-rate estimate or
a model-quality result. The supervised operator check is
[hold-rate-corpus-live-test.md](live-tests-archive/hold-rate-corpus-live-test.md).


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
caps, counters, UNKNOWN calls and sends, held update IDs and plain notices, and import
completion. After pausing the runner and verifying the operator's authority, the
desk can raise all or some of the finite limits with:

A validated terminal provider failure envelope, or a completed success envelope
with empty or malformed answer content, is recorded with a bounded, content-free
failure class and provider state. The counted call gets one fixed PREVIEW reply
through the usual reply check, durable intent and send fences. A bare process
exit (including zero), invocation error, timeout or interrupted call without a
validated terminal result remains UNKNOWN and is never repeated. This also
applies to summary reservations: a definite summary failure may use its remaining
bounded attempt, while an uncertain one stays pending across restart. For answers and reviews one step
comes before the fixed reply: a completed answer or reply-review verdict that missed its
required format (`malformed`) is asked again exactly once, with a fixed runner-authored
`formatReminder` added to the packet (the operator's message is unchanged). The re-ask is
not a provider retry: it is a separate call, recorded as a `format-retry` journal row that
keeps the first call's failure class and usage, and it reserves against the same call cap.
It is skipped when that cap is reached, the stop latch holds or the trial has expired, and
it always precedes any send. A second miss gets the fixed reply, or for a review the held
outcome, as before. An answer turn may also make one memory lookup (Rule 11). Where older
turns are summarized, the turn is the verified operator's and the call cap has room for a
second answer call beside the reply review's reserved one, the packet carries
`memoryLookup: "offered"` and the answer protocol tells the model what that means: when the
packet does not show what the message asks about, it returns only `{"lookup":[...]}` (up to
six short phrases) instead of a reply. The runner searches the summarized turns once with
those phrases, through the same recall as the question, puts what it finds first among
`recalled`, and asks again; the second packet's `memoryLookup` names the searched phrases
and how many found turns it quotes. The phrases are data: bounded, redacted like any packet
field, and used only as a search query. The lookup is a `lookup` journal row that settles
the first call's usage, reserves the second under the same cap and replaces the turn's
saved prompt and grounding with the second packet, so the reply review reads what the
answer read. There is one per turn; it is skipped when the cap is reached, the stop latch
holds or the trial has expired; nothing is sent between the two calls; and an unknown
second call stays UNKNOWN and is never repeated. A lookup request that cannot run, or a
second request after the one that ran, gets a fixed runner reply saying that the search
did not happen or did not settle it, and that this is not proof it was never said. `status` reports
`modelFailureClasses` and `modelResultStates`; `self` includes the same counts.
Subscription reply reviews also record their returned provider state.
The inner reply-review verdict is one exact line (`PASS | reason` or
`VIOLATION:rule_id[,rule_id] | reason`); the whole-line pattern admits no other
text, so a malformed line is counted as `reply-review/verdict/malformed/not-json`.
Model JSON (the outer Decision and the inner reply-review or summary-review
verdict) is accepted when it is exactly one object: the whole text, or the sole
content of one ```json or ``` fence that is itself the whole response. Fence
line endings may be LF or CRLF, including a mix of the two.
Whether text *around* that one object may be discarded is decided per consumer,
not globally (Rule 95). The answer side — the answer, a reply revision and the
summary writer, which `roleOf` folds into `answer` — accepts one complete object
inside surrounding text and never reads the wrapper, because its own output is
reviewed again before it can reach the operator, and refusing it costs the
operator an answer the model did produce (Rules 15, 77: the live 2026-10-01 k6
turn was answered "I couldn't produce an answer" twice for this reason alone).
Every gate here — a reply or summary review verdict, and the retrospective —
keeps the narrow reading, because prose beside a verdict may state a rejection
that contradicts the object and no later review would catch it. Acceptance needs
exactly one object and no other JSON structure outside it: a `[`, `]` or stray
brace in the residual means a list of unknown length or a second object began,
so it stays malformed, as do two objects, a cut object, and an object that fails
the same field checks an unwrapped one passes. `status`
reports `modelJsonShapes`: content-free counts keyed `role/layer/outcome/shape`
(shapes `bare`, `fenced`, `prose-wrapped`, and for refusals `fenced`, `prose-wrapped`,
`multiple-objects`, `truncated`, `not-json`,
or `<wrapper>-wrong-fields` when the JSON parsed but failed its checks), plus the
last malformed one, from a plaintext sidecar `model-json-shapes.json` outside
the journal. It never holds model text and never feeds an outcome. The raw bytes
themselves stay in the journal's own `model-call` record (`output`, redacted and
length-bounded by `modelCallRecord`, kept by `retainedEvidence` through
compaction), so a refused shape is replayable from the root that produced it.
Both LF and CRLF line endings are accepted for a whole-response fence. A CRLF
fence containing one valid review verdict now reaches the existing field checks;
prose before or after it, including prose that contradicts a PASS object, still
holds the reply as malformed. `held-reply-replay.test.ts` drives twelve isolated
encrypted-journal turns with stubbed output caps, fences, contradictory prose,
Jev outage, review timeout and ordinary neighbors. It prints first-attempt holds
by class using the same `callOutcomeCounts`, `lastCallOutcomes` and
`modelJsonShapes` shapes as status. The fixed fixture is a regression benchmark,
not a measurement of the live incident frequency. Justin's supervised
operator-channel procedure is [held-reply-reduction-live-test.md](live-tests-archive/held-reply-reduction-live-test.md).
A call that never returned (a provider error or timeout) records no output at
all. A call that *completed* and then missed its format does record its raw
bytes, in its `model-call` record's `output`, redacted and length-bounded, so a
refused shape can be replayed from the root that produced it; the
`model-json-shapes.json` sidecar beside it stays content-free. To exercise this
path in an isolated trial, follow [journal-model-failure-live-test.md](journal-model-failure-live-test.md).

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

`status.tokens` reports `answer`, `summary`, and `replyCheck` input/output token
totals, call counts, and `unknownCalls` (calls with one or both token counts
unmeasured). `status.tokenTotal` sums those three kinds. These are token counts,
not dollars or a subscription bill. A reservation starts at its conservative
maximum: the journal prompt byte ceiling for a subscription input, 2048 output
tokens for that route, and the exact Jev request byte length plus a 4096-byte
response ceiling for Jev. For a definite result, a subscription input count
replaces its reservation only when `input_tokens`, `cache_creation_input_tokens`,
and `cache_read_input_tokens` are safe integers whose sum is safe. The sum is
marked complete in the journal. Missing or invalid cache fields leave input
unmeasured; output usage and Jev input usage settle independently. Older
subscription journal rows have no completeness marker because they recorded only
`input_tokens`, so replay leaves their input reservation and `unknownCalls` in
place. An UNKNOWN result retains
both maxima even when partial usage was returned; a definite result with missing
usage retains the maximum for each unmeasured side. The Jev route rejects a
response above its ceiling.
The same numbers are in the journal-derived `self` text. Old journal records
without explicit token maxima replay at the then-current prompt ceiling and
route output maximum. Unattributed imported calls from the older single-answer
preview count as UNKNOWN answers at those maxima. See [summary-cost-accounting-live-test.md](live-tests-archive/summary-cost-accounting-live-test.md)
for the supervised operator check.

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
stdin plus the subscription system prompt must fit the summary ceiling: three
quarters of the context limit, at least 24 KiB (8 KiB below the provider's default
32 KiB prompt policy) and at most 96 KiB. A raised limit raises the provider's prompt
bound with it. The carried summary at its own accept bounds (8 KiB of prose, 20 memory
items of 300 bytes), the packet's fixed parts and one turn of a 4096-character message
with a 4096-byte reply measure about 61 KiB, so a pass can always advance by one turn,
with room left for open reminders, corrections and preferences (`summary-fit.test.ts`). The request asks for a complete JSON result
within 1024 output tokens, half the provider's 2048-token cap. The worker tries
shorter prefixes when optional memory fields or envelope framing use the room,
then extends from the saved summary. A 24 KiB history threshold also starts background
summarization after a reply when a raised general context limit is larger.
One pass makes at most eight attempts under the same call cap. An oversized single
turn is shown as a hold in `status`, with its original still in the journal.
Earlier overflow holds retry in order when a summary covers their preceding turns.
The offline regression measures exact prepared prompt bytes and the substitute
provider's reported output-token usage; Justin's live procedure is
[summary-size-live-test.md](summary-size-live-test.md). When the call-diagnostics
branch is integrated, its content-free `role:summary` rows supply actual prompt
bytes, output tokens, elapsed time and local limit classification for the live check.
An oversized single operator turn gets a checked, short too-long notice in chat;
its original remains in the encrypted journal. `status.tooLong` shows the
Telegram acceptance or UNKNOWN delivery, and an UNKNOWN send is never retried.
Later packets use an explicit omission marker for that turn. A reply that exceeds
Telegram's 4096-byte or character limit after HTML escaping also gets one short
notice through the existing intent fence, with no prefix of the answer sent.
Telegram split parts remain distinct durable updates. See
[long-message-live-test.md](live-tests-archive/long-message-live-test.md) for the live trial.


When a summary covers earlier turns, a **memory sentinel**
(`memory-sentinel.ts`) picks which of those original journal turns are quoted
verbatim beside the summary as `recalled`, before the model call. It is one
deterministic step using the core BM25 scorer (`src/recall/lexical.ts`). It scores
the new message, boosting a turn with uniquely strongest question-word coverage,
plus at half weight the accepted turn it continues (so "what
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

For a direct question about what the operator said on a day or date range, the
same journal projection selects at most five original operator turns sent in
that calendar range, most relevant first. It uses the runner's configured
time zone for Telegram send dates and resolves relative days from the query's
recorded send time, or its durable intake time when the send time is absent.
Supported forms include "Tuesday", "yesterday", "3 days ago", "last week", an ISO date, a month name
and day, a US numeric date, and two explicit dates in a range. A date with no
year uses the query's local year. Competing date cues or an incomplete range
leave the ordinary recall path in place. The packet proposes a range for the
model to check against the question and names the number of eligible matches.
Every quoted turn carries its send date. When
full history fits, its turns also carry dates for this question; after
summarization, the selected originals sit beside the summary. Forgotten source
turns are excluded, and all remaining text uses the existing correction and
redaction projection. When the proposed range fits the question, the model
answers from in-range operator evidence, states each reported date, and treats
a bounded miss as inconclusive. The
ordinary Jev/full-context reply check and send intent still gate the answer.
No index, call, store, service or new send route is added. See
[recall-by-date-live-test.md](live-tests-archive/recall-by-date-live-test.md) for Justin's private
chat procedure.

**AFTER the reply:** a bounded rolling summary may use a separately reserved
subscription call from the same attempt allowance. Original turns stay in the
journal. Summary failure leaves originals and makes any later context overflow
visible. Optional fact export, indexing, outcome grading and integrity sweeps
run outside this reply worker; none is a synchronous dual write or a prerequisite
for the next reply. The journal and stop latch are deliberately machine-local.
The exclusive writer prevents two processes on this machine; it is not a second
independently failing replica.

The rolling summary starts when the unsummarized packet reaches 45% of the
configured context limit (or 24 KiB, whichever is smaller), leaving room
for the answer envelope, briefing, desk report and next question before 32 KiB
is reached. Its existing four-turn chunks, call cap, stop, expiry, supervision,
and synchronous overflow fallback remain in force. The offline
`long-conversation-headroom.test.ts` sends 40 successive 285-character questions
with pinned briefing and a near-limit desk report: all 40 receive replies with
a faithful summary stub; a rejected summary leaves the overflowing turn visibly
held with its original intake. Justin's private-chat procedure is
[long-conversation-headroom-live-test.md](live-tests-archive/long-conversation-headroom-live-test.md).

When a turn still cannot be prepared after the forced summary, the reachability floor sets
earlier turns aside half at a time (the journal keeps them and recall reaches them). On its
last rung, with every earlier turn set aside, the reply-review reserve yields too: the turn is
answered, and a review that is then too large to build is recorded unavailable and the reply
released. Only a turn that still cannot fit gets the size notice; none is held. A fresh root at
the default 32768 bytes reaches that rung within a few short messages
(`default-root-conversation.test.ts` replays room two's recorded shapes; `floor-last-rung.test.ts`).

An UNKNOWN summary reservation remains charged and visible in `summaryPending`.
It is never retried at its recorded update frontier. After 60 seconds of actual elapsed
time from every outstanding UNKNOWN summary reservation, a new summary can cover any
different update frontier, earlier or later, under the same finite call cap. (Requiring a
later one made the shortest span run from the last accepted summary to past the UNKNOWN,
which only grows; Justin's preview never summarized again after one UNKNOWN.) The earlier
reservation remains unresolved even after the later summary succeeds; `status`
still refuses a cap raise while it exists. The pause is a lower bound between
uncertain summary calls; a reservation inherited on restart waits a full 60 seconds from
reopening because prior process elapsed time cannot be established. A later accepted turn
and a free call slot are still required. Past the pause, an UNKNOWN at or past the pass's target
(a pending memory request below it, for instance) does not stop the pass; only the UNKNOWN
frontier itself is never offered again. A correction whose deciding summary
is UNKNOWN follows the existing `memory-undecided` path; the later summary
does not silently turn that undecided request into a verified decision.

The background pass runs after every poll cycle's ordinary drain, with or without a new
message, so a root far behind its summary frontier catches up pass after pass (each at most
eight attempts) while the operator is silent; an incoming message is answered beside the
pass in flight, and the next pass starts only after that drain. A correction, preference or
edit whose span lies more than one pass past the frontier (over 32 unsummarized turns) does
not drive the catch-up synchronously before its reply: it is recorded `memory-undecided`
(`summary-behind`) at once and answered, and its own answer may still decide it. Within one
pass it is decided by its own summary as before (`summary-fit.test.ts`).

A summary call is not UNKNOWN when its own physical outcome row proves that the
writer's call ended and its output ran past the 2,048-token cap
(`localLimit: output-cap`: the process ended with an exit code and a final result frame
whose reported output is over the cap; the exit code may be non-zero and the frame may be an
error, as with the proof room's #496, which ended exit 1 after 8,192 tokens). The provider still
reports that attempt as uncertain, and the journal records it as such. The next summary
pass then settles it as a failed attempt with the recorded reason `summary output over
the cap`. That settlement carries the provider's reported usage. The pass then offers
only a shorter span from the same base: no frontier at or past one that ran over the cap is
offered again until a summary is accepted. The retry stays inside the pass's eight
attempts and the shared call cap. A settlement row without that outcome row is refused. A call
with no outcome row, or one without a finished result, stays UNKNOWN as above.
`status.lastSummaryFailure` shows the reason of a failure newer than the last accepted
summary. On the proof room (2026-09-30) all four summary calls after 03:03 ran over the cap
(2,312 to 4,832 tokens). Each one floored every later span, and without an accepted summary
each later span started at the first turn and only grew, so none ever reached Jev or the
review. `summary-overcap-cascade.test.ts` replays those recorded outcomes, writer outputs
and Jev verdicts.

The summary's allowances are sized from that 2,048-token cap by measurement, not guaranteed:
at the measured floor of 2.4 bytes per output token (88 recorded outputs on Justin's root, 2.44
to 3.08; the tests check three recorded real outputs against it) the cap is 4,915 bytes. The
reasoning and the span's lists have no whole-output acceptance bound, so when the estimate
misses, the provider cap and the over-cap brake below are the protection. Of the 4,915 bytes, 800 are allowed for the
Decision envelope (measured at most 725) and 800 for the reasoning, which the summary question
limits to one sentence of 200 characters (the real model wrote 354 to 753 bytes with that wording,
against a median of 1,888 before it). The rolling summary's prose, the one part every call
re-emits whatever its span, is asked to stay within two fifths of the rest, 1,326 bytes. The question
states that target in UTF-8 bytes, so non-ASCII prose that obeys it fits. The remainder carries
the span's own lists, which shrink with the span down to one turn. Carried memory items are kept by
the code and never re-emitted. The target is not a refusal line: the output cap is the real limit,
and an answer that ended within it already fits. On cint-L28 the real writer's prose came back at
956 to 1,583 bytes (11 readable answers on Justin's root, 6 past 1,326) in answers of 855 to 1,792
output tokens; refusing three of them as over the bound braked his summary 220 updates behind. Acceptance
now refuses prose only past the carried-summary ceiling every answer packet is sized for, min(8 KiB,
a quarter of the context limit), as `summary answer over its bound`, the same class as an over-cap
attempt. Prose between the target and the ceiling is accepted, and the next call is asked to rewrite
it condensed within the target; every original turn stays in the journal and the meaning index.
Prose the model writes in `reply` beside the other fields (four of those 11 answers) is read as the
summary; the old reader measured the whole answer as the prose and never read its memoryDisposition. Once both attempts at a span asked too much (the full request and the
reduced retry), no span from that base is offered again, because every later span contains it
(Rule 55); `status.summaryStoppedAt` names that frontier, and replies keep being answered by the
history floor. A span spent partly on a content failure never had its reduced retry and releases
as before. Each summary failure records the summary format it was made under (`format`); only
failures under the current format spend a span's two attempts or set the brake, so a build that
changes what a summary is asked, or how its answer is read and accepted, may retry spans an older
build exhausted. Format 3 (the target no longer a refusal line, `reply` read as prose) is how
Justin's root, braked at 969389763 under format 2, advances on its next pass with no hand step. A
compacted snapshot saves each failure with its format and restores only the current format's, so
the same history gives the same brake as raw rows or as a snapshot; a cint-L28 snapshot saved its
format-2 failures unstamped and they are read as format 2. Before this, a released
ceiling walked forward through ever longer spans from one base, two calls each: Justin's preview
spent 77 summary calls from frontier 969389761 on 2026-10-02 (69 over the cap) with none accepted
(`summary-bound.test.ts`).

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
summary, covered turns, recorded decisions and candidate. A confident Jev pass
commits it and a confident loss refuses it. Jev's unsure band, or no Jev answer,
escalates once to the full-context subscription review, whose pass commits and
whose violation refuses (the confidence cascade, observer #102). A refused
candidate is recorded with its evidence in the encrypted journal, keeps the prior
summary, and leaves a visible `summary faithfulness: active memory item lost`,
`summary faithfulness: full-context review found loss` or `summary faithfulness:
undecided` hold. The existing two-attempt summary bound and shared subscription
call cap remain. `status.lastSummaryFaithfulness` shows the path, verdict and score
without showing memory text. This adds a Jev request only when exact preservation
cannot decide; its 2-second timeout uses the existing TypeSafe host binding.
Justin's supervised procedure is in
[summary-faithfulness-live-test.md](summary-faithfulness-live-test.md).

### Long-summary fact drift

The offline `summary-drift-long.test.ts` runs 65 successive summary transitions
twice with the same deterministic model and existing faithfulness check. It
plants three exact operator clauses, then makes later summary prose change their
details while a deterministic Jev stub passes the semantic check. Exact survival
in the latest summary is **0/3 without references** and **3/3 with references**.
Each clause is checked separately, including after encrypted journal replay.
This fixture measures exact wording, not a real model's semantic recall.

A summary can now carry up to 20 `memoryItems` with a source turn ID and an exact
operator quote of at most 300 bytes. Newly proposed items must match an accepted
operator turn in that summary's covered history. The runner copies prior items
by source into the next summary without asking the model to reword them. Recorded
corrections replace the old item with the exact operator replacement; forgetting
removes it. The active items appear alongside summary prose in later compact
packets, with source labels. The prior prose, covered turns, decisions and
candidate items still pass through the existing faithfulness check; source
references do not grant a model proposal authority. A model that fails to select
an important new item can still lose it if the faithfulness judge misses it.
Original turns remain in the encrypted journal, and all existing summary, call,
stop and send bounds apply. This preview remains machine-local under its one
writer. Justin's supervised procedure is in
[summary-drift-long-live-test.md](live-tests-archive/summary-drift-long-live-test.md).

The `recall-from-summary-only.test.ts` corpus carries four ordinary operator
facts, including an exact dated event, through 32 summary generations and a
recorded date correction. Its later question is prepared in compact mode: the
original fact clauses are absent from history and recalled turns, so the score
reads only the summary region of the actual answer packet. The same lossy
summary prose scores **0/4** before exact source items and **4/4** after them;
the superseded date is absent and the corrected date retains its original source
label after replay. This is offline packet visibility with a deterministic model
and faithfulness stub, not a claim about live model answer quality. Justin's
private-chat procedure is in
[recall-from-summary-only-live-test.md](live-tests-archive/recall-from-summary-only-live-test.md).


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


The offline 60-turn assembled-path regression polls through the real Telegram
bridge against a fake endpoint, uses the real subscription adapter with an
immediate model substitute, builds the launcher prompt, times restarts, and checks
early recall. Its limit is 80 model attempts and 60 replies; the live launcher
limits remain 16/16/20. The worker-only measurement remains separately reported.

### Recalling imported channel items

Messages imported from the agent's own stored conversation logs (see the
`--agent-state-dir` section above) are `channel-item` journal frames with
`source: "conversation"`. `status` reports `channelItems`, and `inspect` shows the
last or proposed packet's redacted `channelMemory` quotes. Each quote names source,
source ID, sender, date and conversation. The existing memory sentinel selects at
most five relevant items, including after Telegram summarization; prompt fitting can
omit lower ranked items. The originals remain in the encrypted journal. The packet
labels them as untrusted data, never instructions. A missing quote is not evidence
the item was never sent. An authenticated operator correction or forget request may
supersede an exact clause in an imported item. Its original stays in the journal,
while later selected `channelMemory` quotes withhold that clause. The imported
message itself cannot request a memory change.

An earlier email fixture route was removed from the base platform: the runner
imports no mailbox. A journal that still holds `source: "email"` items from that
route replays; those items are inert, never recalled or acted on.

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

The [2026-09-27 held-reply fixture](fixtures/held-reply-live-2026-09-27.json)
uses the desk's saved, read-only status captures for four held update IDs and one
unattributed UNKNOWN Telegram send. Personal codes, dates and markers in the
operator messages are substituted while retaining each turn's correction,
dated-preference, recall-question or memory-request shape. The captures report
three UNKNOWN review calls and one review with a physical `output-cap` result;
they do not contain the candidate or reviewer text, nor do they attribute the
UNKNOWN send to an update. The worker replay therefore tests those observed
boundaries with offline stubs and does not claim an exact reproduction of unseen
provider output. It confirms that each review-unavailable turn keeps its reply
held after restart, a completed review PASS releases a loss notice, and a send
with no receipt is not repeated. Run only the focused regression file:

```sh
./node_modules/.bin/vitest run tests/preview/held-reply-live-rate.test.ts --configLoader=runner --maxWorkers=1 --no-file-parallelism
```

For a supervised operator-channel check after integration, use
[held-reply-live-rate-live-test.md](live-tests-archive/held-reply-live-rate-live-test.md).

The journal runner checks each candidate reply at its one send doorway. The desk
launcher resolves vault entry `typesafe_api_key` into
`INSTAR_SECRET_PREVIEW_TYPESAFE_KEY` for the runner process. Treat it like the
existing storage and Telegram host bindings; never place it in command arguments,
the journal, or logs. The key is required only for the Jev route. A missing key,
timeout (2 seconds), or provider error invokes one contextual subscription
review under the same journal call cap. Jev's pinned model is `jev-1.13.0`.

Jev checks the eight measured message questions in one batch. A clear pass sends
the candidate. A violation, uncertain score, or unavailable Jev invokes one
subscription review with the candidate, original operator message, the complete
bounded answer grounding packet and flagged rule definitions. If Jev is unavailable,
the review includes all eight rules. The reviewer returns one short PASS or
VIOLATION line inside the existing Decision envelope. Objections are signals,
never holds (Rules 4, 77, 86, 95): on a violation the mind gets one revision round
within the existing call cap, then the not-yet-sent reply (revised or original) is
sent with the surviving objections recorded on its intent (`release`) and carried
to the next packet's `corrections`. A deferral or blocker the answer declared but
the runner refused always goes to the contextual review, and is held unless that
review passes (build 4, Rules 6, 20, 21, 23). If no check can decide (review
budget exhausted, reviewer outage, malformed output, or no call left for review),
the reply is sent once with the review recorded unavailable; a malformed review is
never a pass. When Jev had completed and flagged only non-secret rules,
`status.reviewUnavailableReleases` counts those sends by flagged rule, without
content. Rule 86's secrets exception still holds: when Jev flagged `credential` and
no review verdict exists, the turn stays held as `reply check unavailable`; when
the review's violation names `credential`, or build 4's `defers_work` or
`unrecorded_blocker` (an untracked deferral or an unevidenced cannot-do claim), the
holding reply is sent instead.
Stop and expiry still gate every send. New answers
leave one shared call-budget slot available for a possible review. The deterministic credential wall runs
before Jev disclosure and again on the final send body.
The `credential` reviewer question asks whether a live authentication secret
reaches anyone or anywhere other than the verified operator who supplied it in
this same private chat. A value that operator supplied here and that is returned
only to them does not leave, so repeating it is allowed (Rule 4). Whether a code
is a secret is judged from the conversation and audience, never from a keyword
list (Rule 10). The full-context review sees the original message and audience
when Jev flags or cannot decide. The existing deterministic secret-format wall
is unchanged and refuses exact credential patterns (API keys, access tokens,
private keys) on every reply, including one the operator pasted. The operator trial is in
[credential-false-positive-live-test.md](credential-false-positive-live-test.md).
When Jev completes but cannot pass, the review judges every rule with a score
above its clear threshold, including both positive and uncertain signals. Jev
has already cleared the other questions under the same criterion that permits
a direct Jev PASS. If Jev is unavailable or malformed, the review judges all
eight. The full packet and completed PASS requirement remain the same; the
smaller rule list removes repeated review of questions Jev cleared.
The review uses the actual `operatorMessage` and `candidateReply` in that packet.
An operator-requested code example, quoted path, command or setting is judged in
that context; an unrequested internal disclosure or handoff of work can still
violate. The review returns its one-line `PASS | reason` or
`VIOLATION:rule_id | reason` verdict inside the required Decision envelope's
`conclusion.value`. The narrow line parser and refusal on a malformed review are
unchanged, except that the reason may run to 600 characters (the question asks for
under 300): live on 2026-09-28 the real model wrote 170-200 character reasons and the
earlier 160 bound refused every one as malformed, holding replies as "check unavailable".

**Decision slot for declarations (live repair 2026-09-28).** The conversation system
prompt now puts `reason` (the model's reasoning) first and lets `conclusion.value` be
either the plain reply string or the object `{"reply": ..., ...decision fields}` whenever
the packet's decision guidance applies (memory, dated, directives, openLoops, blocker and
the rest). The runner re-serializes that object as the JSON text the worker has always
validated (`conclusionText` in `model-json.ts`); any other non-string value is malformed.
Before this, the prompt asked for the reply "in plain text" and the declarations existed
only as packet guidance: across the whole live trial no memory change, dated item,
commitment, directive or blocker was ever recorded, because the real model put its
declarations in `reason.value`, which nothing reads. The answer packet also now carries
`capabilities`, the keys a blocker avenue's evidence must name. The prompt change moves
the invocation-policy digest, so a live runner needs a policy-successor activation record
(`renew-activation.mjs --policy-successor`). Real model bytes for the four failing live
turns, under the old and the new prompt, are in
`fixtures/live-declarations-2026-09-28.json`, driven end to end by
`live-declarations.test.ts`; the live procedure is
[live-declarations-live-test.md](live-declarations-live-test.md).

`reply-review-corpus.mjs` is a bounded offline screen for false holds. Its 32
synthetic cases each select one of the eight review rules: three human-fine
neighbors and one clear violation. The cases include requested code, a personal
fact supplied in the private chat, and a password control.
It uses the frozen review model, subscription policy arguments and output/retry
environment bounds, original packet envelope and reply-review question; it makes
at most one sequential subscription call per selected case. It applies the
adapter's terminal success, usage and output limits before accepting a verdict.
Each row retains reported token usage and a content-free rejection class. It
never opens the live journal or sends a Telegram message. With subscription CLI
authentication available, run:

```sh
node --no-warnings --loader ./scripts/slice-ts-loader.mjs tests/preview/reply-review-corpus.mjs all /ABSOLUTE/result.json
```

`rule:cli_command` or a case ID may replace `all` for a targeted follow-up.
Pass `baseline` as the last argument to replay the prior prompt and prior
`cli_command` rule wording against the same corpus; the default is `current`.
Count `violation` on human-fine cases as a false hold and `unavailable` separately
as a format or provider hold. This screen measures the review prompt, not Jev
selection, live delivery, or real private data. The supervised operator proof is
[reply-review-false-hold-live-test.md](live-tests-archive/reply-review-false-hold-live-test.md).

**Operator echo skips the second check.** A reply that only repeats the verified
operator's own words to that operator goes straight to the send path, without Jev
or the review. The test is exact and judges no meaning (`repeatsOperatorOnly` in
`reply-check.ts`, Rules 4 and 10): apart from a small fixed set of connective words
(you, your, I, me, my, it, is, was, the, a, told, said, that, and, dashes), every
token of the reply after a leading run of those connectives appears verbatim as one unbroken run of the raw words of ONE earlier accepted
message from the verified operator in this private chat. Words from two messages,
reordered words, any added word, and anything from an imported source, another
sender or the agent's own replies keep the full check. There is no keyword or
label list: "It is 5823." returned to the operator who wrote "My account login PIN
is 5823." here is sent, because the value goes back only to its supplier. The
secret-format wall runs first and again on the send body, so a pasted API key or
token is still refused. What this does not cover: a letter-only secret the wall
does not recognise, echoed back to its own supplier, is sent to that supplier.
The decision is
a durable `operator-echo` reply-check row (never after a Jev or review reservation),
so replay sends once and never re-checks. `status.replyCheckPaths['operator-echo']`
counts released candidates; `status.operatorEchoSent` and the `status` command count
those Telegram accepted. Justin's check is
[operator-echo-live-test.md](operator-echo-live-test.md).

The check result is encrypted and fsynced before the send intent; `status` and
`inspect` report verdict counts, path counts, and the last result. A crashed
subscription review is not retried or charged again from this runner; the reply
is sent once with the review recorded unavailable (unless Jev flagged
`credential`, which holds it). An interrupted revision is likewise never
repeated: the original is released with its objection.
An interrupted Jev check escalates without repeating Jev.
`status.lastReplyTiming` derives intake-to-Bot-API-acceptance milliseconds and
the recorded reply-check milliseconds for the last accepted send from existing
journal timestamps; it adds no state or network call.
The fixed subscription route keeps its 2048 output-token ceiling and reviewed
invocation policy digest. Its Claude CLI process gets that ceiling through
`CLAUDE_CODE_MAX_OUTPUT_TOKENS`; the fixed arguments have no per-call thinking
control. Changing the CLI effort arguments would need a new activation.

Desk live check for this compact path: [reviewer-compact-call-live-test.md](live-tests-archive/reviewer-compact-call-live-test.md).


`status` and `inspect` also expose `lastReplyReview`: its result state and
`diagnostics.outputTokens` from the subscription CLI's reported usage. The
pinned JSON-result invocation does not expose thinking blocks, so
`diagnostics.thinkingPresent` is `unobservable`, never a guessed yes or no.
The output-token cap remains 2048. See
[reviewer-thinking-bound-live-test.md](live-tests-archive/reviewer-thinking-bound-live-test.md)
for Justin's bounded live check of the next review hold.

`status.replyTimings` reports per-update answer, Jev, fallback and send times
in milliseconds, plus each stage's sample count, p50 and p95 (nearest-rank).
Missing stages are `null` and do not enter a percentile. Answer, check and send
measurements come from the existing encrypted journal; old turns have nulls.
Send time rides on the durable `sent` receipt, so an UNKNOWN or failed attempt
has a null send time; older journals' separate `send-timing` frames are still
read. These are runner wall times, not Telegram delivery times. For Justin's supervised check,
see [reply-check-timing-live-test.md](live-tests-archive/reply-check-timing-live-test.md).

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
   `raw_path`, the sent text is the one revision (or the original) and
   `inspect` shows its `release` objections. If the answer contains
   no path, this case did not test the violation branch; use another prompt.
3. Run `inspect` and `status` again. Confirm verdict and path counters advanced,
   the exact send intent has one receipt for each message, and no duplicate
   replies appeared. Record the Jev latency and reply path for both turns.

The live test depends on desk supplied credentials and operator messages. Offline
tests stub both models and verify pass, violation, uncertainty, timeout, call cap,
durable check order, revision and release without network access.

`reply-latency.test.ts` measures the fixture path from accepted update to send
using the real journal worker and prompt envelope, a timed Jev stub, a timed
subscription stub and a timed send. Its all-rules comparison uses the previous
review scope on the same path. The fixture's provider delay depends on prompt
bytes by design, so its wall times are controlled comparisons, not live provider
latency. The test prints both prompt byte counts and end-to-end milliseconds.
Use [reply-latency-live-test.md](reply-latency-live-test.md) for Justin's live
private-chat measurement after the desk gate.

Memory shows what was actually sent: history, recall, commitments and the
coherence check read the send intent (the released reply, its revision, or the
credential-shape notice), never an unsent candidate.

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

### Reachability and quiet operator interaction (constitutional build 3)

Rules 4, 14, 15, 52, 53, 77, 79, 80, 82, 86, 87, 88, 95 and 106 on the live runner:

- **Minimal responder (Rule 15; Eleven §5).** Reaching the turn, reply or call cap no longer stops
  reading the operator. Past the turn cap each verified operator message is preserved by a finite
  reserve (`MINIMAL_RESERVE`: 240 messages and 6 limited answers per rolling hour, independent of
  the ordinary allowance; a stranger's update never spends it). The turn reserve exceeds two full
  poll pages, so a stop sent behind a page of waiting messages is preserved and read: the cursor only
  ever passes messages already in the journal. Past the reserve every update is preserved, in order,
  in a finite waiting store (`MINIMAL_WAITING_UPDATES`: 1000) before the cursor passes it, and the
  whole backlog is scanned first for the verified operator's exact `/stop` (Rule 4's exact floor, not
  a reading of meaning): it latches before anything else, with no model call. A held full page that
  moved the cursor is followed at once by the next page in the same poll cycle, so a stop behind the
  reserve plus a full waiting page latches on the first poll. Waiting updates become turns, in order,
  once the reserve frees. Past the store, messages wait at Telegram with the cursor held. The stop
  also comes through the independent approval surface when one is installed: the minimal step keeps
  one standing emergency-stop challenge on it (`stop-challenge`, reused while unexpired so a displayed
  Stop page stays valid, and retained until it expires; the exact subject `stopSubject` binds the trial's genesis and grant, the
  audience `independent-emergency-stop`, and the operator requesting it for themself, as
  `src/operator/surface.ts` does). Every limited answer carries a **Stop page** button to it. The
  operator's tap there is verified by that surface's own verifier (a one-use proof with no authority
  act) and latches the stop at the next minimal step, before any poll or ordinary pass. The surface
  keeps the act in its own storage and reaches the operator over its own transport, so a full
  conversation queue, a lost ordinary worker or a restart cannot hide the brake. The minimal path also takes over from an unavailable ordinary worker
  whatever the caps: a `/stop` never waits behind a busy or blocked worker, and another message
  waiting on it longer than `MINIMAL_WORKER_WAIT_MS` (2 minutes) gets a limited answer that asks
  for nothing (reason `worker`), and its ordinary answer still follows once the worker recovers.
  Limited answers are fixed text grouped per conversation, with no model call.

  Whether the minimal path may speak is Part Eleven's own verdict (`evaluateMinimalPath`/
  `minimalResponse` in `src/operator/live.ts`) over what the host actually observes (Rule 26); the
  activation record never stands in for an observation. The live runner observes:
  - `register`: the register generation it read at launch (`generated/source.json`) is still the
    installed one. This is Ten's rule for that dependency. A checkout switched under a running
    process reports it missing until the runner is restarted.
  - `lease` and `fence`: this runner's exclusive conversation claim (Rule 63), re-verified against
    its durable owner record at the verdict. The send seam consumes the same fence again before
    dispatch.
  - `replication-peer`: never observed. The runner serves only the single-machine posture, and
    Eleven §5 omits the peer on a single machine only under the operator's accepted P-08 policy.
    The runner passes Eleven the installed shape (`minimal.shape`): the trial, the fixed profile
    `SINGLE_MACHINE_PROFILE` (its closed operation set, the full causal-prefix requirement and the
    permanent-machine-loss model) and the acceptance it resolved at launch, if any. Eleven omits
    the peer only when that policy binds this trial and profile and holds the limited answer's
    operation (`telegram:ordinary-reply`). The shape alone omits nothing.

  **Single-machine acceptance (P-08).** The acceptance is one entry in the desk's sealed authority
  record (`activation-authority.json`, see "Activation renewal"), beside the grants and waivers:

  ```json
  "installationPolicies": [{ "id": "p08-single-machine", "policy": "P-08", "shape": "single-machine",
    "grantor": "OPERATOR_TELEGRAM_ID", "words": "THE OPERATOR'S EXACT MESSAGE",
    "source": { "kind": "telegram-message", "topicId": N, "messageId": M }, "acceptedAt": EPOCH_MS_OF_THAT_MESSAGE,
    "subject": { "trial": "TRIAL_ID", "profile": "single-machine-v1", "profileDigest": "sha256:…" } }]
  ```

  `profileDigest` is `singleMachineProfileDigest()` for this build. The operator's one step is one
  message accepting the profile as presented: provider calls and reply-only Telegram and Slack
  sends run from one machine with no peer copy; if that machine is lost for good, the records
  needed to reconstruct a paid call or a send can be lost with it, and an earlier effect whose
  outcome is unknown cannot safely be repeated. The desk then adds the entry, seals the record with
  `seal-authority`, and restarts the runner. The entry resolves only as the desk's sealed
  disposition, for this trial and the current profile digest, to that authenticated operator
  message with its exact words and time (`resolveInstallationPolicy`, through
  `--operator-records`). A revocation naming its `id` withdraws it. Its standing is the trial's
  other recorded authority: an account-authenticated operator message under the desk's seal. It is
  not a device-signed or independently verified approval, and `status` says so. A changed
  operation set or loss model changes the digest, so an older acceptance stops resolving.

  Without a resolving acceptance the launch still serves, and says on stderr that limited answers
  are inhibited and why. Past a cap each message stays preserved, an owned outage names what is
  missing (`minimal-outage`; `installation-policy` for the acceptance), and
  `status.minimalReserve` reports the outage with its repair and the installed shape the launch
  recorded (`installation`). The chat `status` reply carries one line saying whether a message
  past a cap would get its limited answer, and what clears it if not. No notice is pushed for the
  outage: a reply in the chat is the very operation that is not admitted, and the preview has no
  admitted infrastructure-notice effect (see "Supervised incidents"). An exact `/stop` latches at
  once, since the brake needs no reply. Ordinary work runs beside the poll loop and is never awaited by it. A
  failed ordinary pass no longer ends the run: the minimal path answers at once (reason `worker`)
  and the ordinary pass is retried with backoff; eight consecutive failures open the breaker and end
  the run for the host supervisor. Without the independent approval page (next item), a chat
  `/stop` reaches the latch through the backlog scan up to the waiting store's bound; a stop behind
  more than 240 reserve plus 1000 waiting updates within the hour is unreachable by chat, and the
  host `stop` command remains a local brake only. With the page installed and a passkey enrolled,
  its standing Stop reaches the latch at any backlog depth.
- **Operator channel (Rule 14).** A verified operator's photo, voice note or caption, and an edit
  of a message this journal never saw, reach the mind with a plain flag instead of being dropped.
  Service messages and foreign senders take no turn; their raw updates stay preserved.
- **Advisory pre-send review (Rules 4, 77, 86, 95).** See the reply-review paragraphs above:
  objections and unavailability are recorded signals, one revision round fits inside the call
  cap, and only the exact credential-*shape* floor withholds text (`CREDENTIAL_SHAPE_NOTICE`,
  honest that a shape is not proof of a live secret). `PREVIEW_LIVE_GATES` declares every live
  gate's fail direction.
- **Usable links (Rule 106).** The coherence check's link-shape predicate now also runs before
  every model-written send as a signal feeding the revision; fixed templates carry no link.
- **One classified send path (Rules 52, 87).** Every push goes through one boundary tagged
  `result` or `action-needed` (`OUTBOUND_DISPOSITIONS`); status, including an unchanged held
  backlog, is pull-only and is never pushed. Requests due together in one conversation become one
  due turn and one message: at most five are written out and the rest are one count line
  (`requestOverflowLine`), never sent later.
- **Final-candidate link check (Rule 106).** The link-shape predicate also runs on the exact final
  text (after a revision or assembly); its findings are recorded as `release.final` against that
  text's digest. It advises; it never holds.
- **Approvals (Purpose; Rules 79, 82, 98).** The emergency stop (`/stop`) is a prefilled
  Approve/Decline confirmation; the bound operator's press latches the brake, which grants nothing.
  A cap raise is different: it changes a safeguard, so it completes only on the independently
  administered approval surface (Part Nine's `IndependentSurfaceVerifierPort`). The limited answer
  carries the prefilled request and a link to that surface (plus a Decline press); the verifier
  issues a one-use, expiring challenge bound to the request's exact subject and journal base, and
  the raise is applied only in the moment its proof for that challenge verifies. Before the proof is
  spent, the request and wording digests are recomputed from the journal's recorded limits
  (`raiseSubject`) and compared with the challenge, so limits substituted into the journal cannot
  ride a genuine proof. Such a request is recorded `refused`, and a fresh one follows. A Telegram
  Approve press, silence, a journal row, a wrong, expired or replayed proof, or a moved base never
  raise. Where the chat's limited answer is inhibited (the live posture above), the raise is still
  offered on the approval page itself (`approval-request`): one open request at a time, never again
  at a base the operator declined, and a refused issue retried after a minute. Once approved there,
  the saved messages get their ordinary answers.
- **The independent approval page (Eleven §§2, 4, 5; P-02, P-04; build 3b).**
  `scripts/approval-surface.mjs` is the operator's own process, never the agent's: it refuses to
  start under the agent's OS identity, keeps its records in an operator-owned store the agent can
  read but not write (`surface.json`, `keys.json`, `acts/`, private `private/`), listens on loopback
  only, and is published over HTTPS only under a recorded ingress grant (`ingressGrant`, "nothing
  outward by default"). The approval gesture is a passkey on the operator's phone (P-02): the page
  asks the phone to sign the exact challenge, decision and a fresh page nonce, with user
  verification. The page renders a request in its own fixed wording (a raise must match the one
  template and hash to the challenge's rendering digest; the stop is the page's own text), puts the
  primary action first, and has no field the operator authors. A decision is recorded write-once;
  a replay finds it and stops. The runner (`tests/preview/approval-surface-client.mjs`) writes
  requests only into its own outbox, reads the store only if it is owned by the configured operator
  identity (never its own) and writable by nobody else, re-verifies every act's signature against
  the enrolled passkeys, and consumes each act once. Chat steering (P-04) stays limited to what
  grants nothing: the `/stop` press and a raise's Decline; no chat act completes a raise, because no
  exposure acceptance for a compromised chat token is recorded. The page lists pending requests
  pull-first (the standing Stop first); nothing about it is pushed.

  Install (the operator, once): create a separate OS user for the page (for example
  `sudo sysadminctl -addUser instar-approvals`), and as that user create the store (mode 0755) and a
  config file it owns (mode 0600): `{"operator":"telegram:OPERATOR_ID","operatorUid":UID_OF_THAT_USER,
  "agentUid":RUNNER_UID,"store":"/ABS/STORE","outbox":"/ABS/RUNNER_OUTBOX","publicBase":"https://STABLE.HOST",
  "ingressGrant":"desk:approvals-ingress-DATE","port":PORT}`. The runner's outbox is a directory the
  runner owns, mode 0755. Publish `127.0.0.1:PORT` at that stable HTTPS host (a named tunnel; a
  passkey is bound to the host name, so an ephemeral tunnel name breaks it). Run
  `node scripts/approval-surface.mjs serve CONFIG` as that user, then `... enroll CONFIG` prints a
  one-use enrolment link (15 minutes) to open on the phone; enrol a second passkey or a synced
  passkey as the recovery route. Start the runner with `--approval-store /ABS/STORE
  --approval-outbox /ABS/RUNNER_OUTBOX --approval-operator-uid UID_OF_THAT_USER`; `status
  .approvalSurface` then reads `{ installed: true, ready: true, page, passkeys }`. A store owned by
  the runner's own identity is refused (`installed: false`).
- **Operator actions by explicit yes (Rules 28, 79, 82, 98; plan #91; `operator-yes.ts`).** The
  two declared operator actions, `raise-caps` and `renew-expiry`, can be requested in chat and
  completed by the verified operator's explicit yes, with no setup. The worker port is
  `explicitYes: { context, installation, renewalActivation? }`: `installation` is the pinned
  `ExplicitYesInstallation` record (the P-02 facts and whether a P-05 grant lets the agent speak as
  the operator in the bound chat); `renewalActivation(expires)` returns the reviewed activation
  record's digest for the new trial end when the host has one. The answer model may return
  `operatorAction` (`{action:"raise-caps",limits:{maxCalls|maxReplies|maxTurns: number or "step"}}`
  or exactly `{action:"renew-expiry"}` with no other field, the runner filling in the one reviewed end;
  a proposal it cannot read, or one written under the runner's own `operatorRequest` field, replaces the
  reply with the fixed "nothing was proposed" line, so the reply never announces a request that does not
  exist); the guidance rides the packet whenever an explicit-yes source is
  admissible on the root, so an ask is answerable at any time (621 bytes of text, 639 on the prepared
  envelope), together with a route sentence (405 bytes) saying that proposing is how the change is
  made, so the reply never claims it cannot raise or extend (plan #371); where the port is configured but no source is admissible, only near a limit (the cap
  report's 80%), within 48 hours of the trial end, or while a request is open, so the answer carries
  the runner's why-not. A root with no port sends none of it. The runner, never the model, writes ONE exact request inside the governed
  bounds (one raise adds at most the larger of the trial's original and current allowance, so at most
  doubles a limit; a renewal names only
  `SUBSCRIPTION_PREVIEW_EXPIRY` and needs the reviewed activation installed), with its own id,
  digest and lifetime, and appends its fixed wording to the reply. A request stays answerable for 18
  hours by default (plan #373; the old one hour lapsed requests unseen overnight), configurable on the
  root with `run --operator-request-hours N` (1 to 48), and never past the trial's current end (the end
  a renewal extends and a raise lives within); the reply, the pull request body and the request file
  state the lapse in UTC, then in the operator's local time from `--time-zone`, and say when the
  trial's end cut the window short. Replay checks only the UTC sentence, so earlier recorded requests
  (one-hour, UTC-only) replay unchanged. One request per action may
  be open at a time (plan #371; rows carry `requestScope: 'action'`, while a legacy row without it
  superseded every undecided request): a raise and a renewal can be approved together, a new request
  supersedes only an undecided one of the same action, a raise applied by its approval carries an
  open renewal forward to the moved base (any other base move still stales it), and the packet shows
  the other action's open request as `otherOperatorRequest`; an out-of-bounds or
  unproposable request is answered with why not. A capped limited answer carries the raise the same
  way when no independent approval page is installed. The verified operator's message that answers
  an open request (a Telegram reply to it, else the operator's next message after the latest request) is
  judged once by the single admission (`produceExplicitYes`): exactly `yes` or `approve` completes
  it, the caps or expiry frame records `operator-yes:<request>:<reference>`, and the chat-yes
  reference is consumed once. Anything else (an ambiguous answer, a later message, an edit, another
  sender, an expired or superseded request, a moved base) changes nothing; a judged non-yes is
  recorded as `operator-yes` refused. Where the installation record says the agent can speak as the
  operator in chat (P-05), no request is proposed in chat and the single admission refuses a chat
  yes. That deployment's route is the GitHub review source (`review-yes-source.ts`): over an
  injected client it opens one pull request whose body names the request and only the review route
  (never a chat yes, which is not admissible there) (`issue`), links straight
  to its Files page (`link`), polls its reviews with a widening wait and a breaker (`acts`, Rule 55)
  and admits a review only through the same single admission (`verify`): an APPROVED review by the
  pinned login on the exact head completes it once; a missing, COMMENTED or CHANGES_REQUESTED review,
  another login, a stale head, a lapsed request, another request or a reused review refuses. Without
  the installed P-02 fact for the GitHub account it opens nothing and `status()` names the missing
  fact. The launcher connects it (plan rows #297, #307): `run` and `status` take
  `--explicit-yes-installation /ABS/record.json` (an `ExplicitYesInstallation` v1, read strictly by
  `explicit-yes-installation.ts`; every fact is required, none defaulted) and `--review-repository
  OWNER/REPO`; the request pull requests are opened with the agent's OWN token from
  `INSTAR_SECRET_PREVIEW_GITHUB_TOKEN` through `github-review-client.ts`, whose five operations
  (open, read, list reviews, close) include none that submits a review. For the GitHub account the
  record holds EITHER the P-02 fact that the agent holds no access, OR the operator's recorded
  acceptance of the agent's access (Purpose, the approval-account exception, PR #144):
  `{account, installation, operatorMessages, acceptedAt, withdrawn}`. Where chat cannot carry the
  yes and the review source is admissible, the worker opens the request's pull request before the
  reply and puts its direct link on it; `minimal()` polls the reviews of every open request, judges each review id once
  (`operator-review` rows), applies an approval once, closes a lapsed or superseded request's pull
  request (`operator-review-closed`), and sends one fixed completion line
  (`operator-result-intent`/`-sent`). Every approval admitted under an acceptance carries the
  shared-access disclosure (`SHARED_ACCESS_NOTE`, written once in `src/decode/explicit-yes.ts`) in
  its recorded bytes, its journal row, the caps or expiry authority string, the completion line,
  the mind's request state, and `status`/`inspect` (`operatorRequests`). The record is read afresh
  on every use, so a withdrawal the desk records stops consumption from the next poll; an applied
  effect stands. `status` reports `explicitYes` (chat, review with `acceptance {account, current}`)
  and `operatorActionSurface`, which names the phone route only while a source is really
  admissible on this root and otherwise the host command line the two declarations name. A renewal
  is proposable only with `--renewal-activation /ABS/activation.json` (validated as `renew-expiry`
  validates it, so `status` then also needs `--login-profile`, `--model`, `--authority-record` and
  `--operator-records`). `status` runs that same validation: its `renewExpiry` names the phone route
  alone only while that record is valid now for a trial end later than the journal's; otherwise it
  adds that until then the renewal stays on the host command line. A capped limited answer still carries a request only where the chat yes is
  admissible.
- **Retracting test turns (plan #389, Rule 35).** Desk or test traffic sent through the operator's own
  account lands in every store as theirs, and chat text from that account cannot be trusted to undo it.
  The desk runs `journal-agent.mjs propose-retract --root R --updates-file F [--reason TEXT]` (one
  Telegram update id per line; `#` comments allowed) during operator hours only (09:00 to 21:00 in the
  trial's zone, `OPERATOR_HOURS`). It checks the list against a read-only open of the journal (each id one
  accepted, not yet retracted message; a refusal prints `{"refused": reason}` and exits 1) and leaves one
  proposal at `preview-retract-proposal.json`; it changes no journal state and sends nothing. The
  running runner's `minimal()` issues it once (per proposal) as an exact `retract-turns` operator request
  on the same explicit-yes route a raise uses, within an hour of the proposal and inside operator hours:
  the operator reads the count, the first and last listed message (redacted, clipped), the reason and
  Rule 35, and on the review route the pull request lists every id. The request is signed as
  infrastructure (`retract-request`/`-sent` rows). A model's `operatorAction` can never name one. Only the
  admitted yes applies it, as one `retract` row at its journal position. From that row on, `probeTurn`
  is true for every listed turn (`retractedTurn`); directives, blockers, commitments and people notes
  they created are not open or offered; memory and dated changes they sourced or triggered leave the
  active projection (their change-history entries are marked undone); held questions, waiting
  corrections and conflicts from them are dropped; and every rolling summary built over one of them is
  retired (`retiredSummaries`, `liveSummaries`), so the next pass rebuilds from the remaining turns and
  never ends a span on a retracted turn. Nothing is deleted (Rule 7): every earlier row replays
  unchanged, and `status` shows `retracted {turns, retiredSummaries}` and marks retired summaries. A
  closure that a retracted turn made of a real item (a directive superseded, a blocker cleared, a
  commitment closed) is not reopened. Tests: `retract-turns.test.ts`.
- **Supervised incidents (Rules 15, 88; P-14).** `scripts/host-watch.mjs` with
  `{"mode":"journal", "alerts": {"grant": "..."}}` restarts the runner after a failed exit with
  bounded backoff. After three consecutive failed restarts it records one incident episode with the
  failure evidence in `host-watch.json` (shown by `status.incident`) and a clean run closes it. It
  sends nothing: an internal-issue notice must be Part Eight's admitted `infrastructure-notice`
  effect through Part Ten's confined notice driver, neither of which exists yet, so the episode is
  `inhibited` and names both (`inhibitedBy`). Without a recorded alerts grant it is `unbound`. An
  episode an earlier build left uncertain is preserved and never repeated.

Held notices from earlier builds replay unchanged, but no new held notice is pushed: a held
message's status stays on the pull surface (`status.holds`, self-state and the mind's packet).
An earlier notice intent that has no receipt stays UNKNOWN and is never sent again;
`status.heldNotices` reports each earlier attempt, and model history carries only its marker
and delivery state, separate from the answer. The packet tells the model to explain a hold
only when the operator asks. This remains a deliberately machine-local preview under its
existing exclusive writer, with no new store, service, or multi-machine claim.
See [held-reply-notice-live-test.md](held-reply-notice-live-test.md) for the
supervised private-chat proof as Justin.

The capability note, per-turn capability line and journal-derived self-state
describe the same memory scope: encrypted local journal records persist across
runner restarts and topics, are available to this preview during its active
trial, and can be corrected or forgotten by a direct verified operator request.
The original audit record remains after withholding an old claim from later
packets. See [memory-self-description-live-test.md](live-tests-archive/memory-self-description-live-test.md)
for Justin's supervised check of the answer and held-notice behavior.

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
Since build 9 the start marker names the cleanup boundary as well: each reply's
cleanup Result (its coherence check, memory state and delivery) is checked the
same way. A journal started before that gains the boundary from a second start
marker; earlier steps keep their verdicts.

The live private-chat procedure is in
[jev-step-supervisor-live-test.md](jev-step-supervisor-live-test.md). The dark
observation's first evaluation target, 2026-09-30, passed without a recorded
trace, so its graduation deadline is now 2026-10-15, recorded with its reason,
owner and rollback in the promotion record below. The desk can decide whether
to keep it on after Justin's script produces a recorded trace. While off, it is
not a live safety guard.

### Promotion record

`promotion-record.ts` is the durable, reviewed record of how each gated
capability graduates: test agent, then development agent, then fleet (Rule 72).
Each entry is one decision. A stage is reached only after the stages before it,
and names the durable evidence a reader can open. A new deadline must fall after
the moment it is recorded, and names its reason, the owner of the next step and
the rollback. A capability's declared `gate.deadline` must equal the latest
deadline in the record; the capability tests fail on any difference, and on a
deadline past the real clock. `status` adds a `Graduation:` line that shows each
stage as `recorded`, `observed` or `missing`. `observed` means this runtime
passed the capability's proof but no record entry exists yet. The line also
shows the deadline and when it was recorded. A dark capability stays `dark` in
the capability count whatever the record says: the record moves no protection.

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

### Active memory provenance audit

`journal-agent.mjs audit --root ROOT` also traces the entire active memory
projection, even when an item was omitted from the latest bounded model packet
or no model packet exists. It reports source IDs and import digests without
message bodies. Person notes, confirmed person merges, open commitments and
their merged sources, correction and forgetting decisions, preferences, dated
items, open questions, the current rolling summary, and imported channel items
must each link to an accepted private-chat operator update or a journaled
channel import. A correction must link both its old source and its later
operator trigger. The command exits nonzero for any broken link. It reads the
existing encrypted journal only and does not call a model or send a reply.

This is a lineage check, not a semantic verdict on paraphrased summary prose.
The existing summary faithfulness review decides that question. An imported
item's chain proves the journaled import, while its sender metadata retains the
fixture's stated trust limit. The property test creates varied correction,
merge, summary and snapshot histories, reopens each journal, and breaks links
to confirm the audit fails. Justin's supervised procedure is
[correction-provenance-audit-live-test.md](live-tests-archive/correction-provenance-audit-live-test.md).

### Build handoff on one journal

`journal-handoff.test.ts` uses separate processes on one encrypted journal. It
compares the durable facts shared by both builds before and after each reopen,
including cursor, pending and held turns, memory, open commitments, summaries
and the common facts in the next packet. It checks newer question and preference
fields separately because the old build did not write them. It also kills the
first process after an exact send intent, then confirms the successor does not repeat that send or
an orphaned model reservation. A later turn is answered after compaction and
reopen. The test can load the `56fe0b7c` journal module for its first process
through `PREVIEW_OLD_JOURNAL_MODULE=file:///ABSOLUTE/OLD/tests/preview/journal.js`
and the old read-only status command through
`PREVIEW_OLD_LAUNCHER=/ABSOLUTE/OLD/tests/preview/journal-agent.mjs`. Archive
`tests/preview`, `src` and `scripts` from that commit for the old tree. Without
those settings it tests process handoff on the checked-out build. The
supervised trial procedure is [journal-handoff-live-test.md](live-tests-archive/journal-handoff-live-test.md).

### Journal reopen scaling

`journal-reopen-benchmark.mjs` creates a throwaway encrypted journal with 1,000,
10,000 or 50,000 accepted turns. Every turn has a call reservation, answer,
exact send intent and accepted send; every fourth turn has a summary reservation
and completed summary. It measures one raw replay, compacts through the real
writer, then measures one snapshot reopen and checks the final cursor, summary
frontier and send receipt. The synthetic writer does not fsync each fixture
frame; the measured reader and compactor are the production preview functions.
No provider, Telegram endpoint, live root or live key is used.

```sh
node --expose-gc --no-warnings --loader ./scripts/slice-ts-loader.mjs tests/preview/journal-reopen-benchmark.mjs 1000
node --expose-gc --no-warnings --loader ./scripts/slice-ts-loader.mjs tests/preview/journal-reopen-benchmark.mjs 10000
node --expose-gc --no-warnings --loader ./scripts/slice-ts-loader.mjs tests/preview/journal-reopen-benchmark.mjs 50000
INSTAR_PREVIEW_SCALE=1 npx vitest run tests/preview/journal-reopen-scaling.test.ts --configLoader=runner
```

The explicit 10k reopen bounds are **under 2,000 ms** for both raw and compacted
forms and **under 128 MiB additional JS heap** for each. The targeted test
enforces them. On the shared builder host (2026-09-27), representative results
were:

| Turns | Raw bytes | Raw replay | Raw heap increase | Compacted bytes | Snapshot reopen | Snapshot heap increase |
|---:|---:|---:|---:|---:|---:|---:|
| 1,000 | 1.0 MB | 28 ms | 4 MiB | 2.1 MB | 7 ms | 9 MiB |
| 10,000 | 10.3 MB | 197 ms | 16 MiB | 21.9 MB | 57 ms | 43 MiB |
| 50,000 | 52.6 MB | 1.7–3.4 s | 96–98 MiB | 112.1 MB | 0.36–0.42 s | 148–167 MiB |

Heap increases are measured around each reopen after forced GC; `peakRssMb`
is the whole fixture process, including construction and compaction, and reached
roughly 1.8–2.0 GiB at 50k. It is not an open-only memory reading. CPU profiles
(`JOURNAL_PROFILE_DIR=/private/tmp/...` with an existing private directory) showed
the raw replay's inclusive `project` samples fall from 189/424 to 63/280 after
the summary path iterated only held turns. Compaction's native file writes and
snapshot verification remain the largest measured costs at 50k. This is a
machine-local preview with an existing 20-turn live cap; the synthetic sizes
exercise long-run growth and do not expand that cap. Justin's host procedure is
[journal-reopen-scaling-live-test.md](live-tests-archive/journal-reopen-scaling-live-test.md).

### Scale checks

The 10k reopen bound above, the 10,000-fact recall scale (`memory-scale-10k.test.ts`) and the
100-restart memory soak (`journal-memory-restart-soak.test.ts`) generate thousands of fsynced
turns. They are explicit scale evidence, not per-edit checks: ordinary runs skip them, and a
change to the journal, retrieval or compaction, or a release validation, runs them with

```sh
INSTAR_PREVIEW_SCALE=1 npx vitest run --configLoader runner tests/preview/journal-reopen-scaling.test.ts tests/preview/memory-scale-10k.test.ts tests/preview/journal-memory-restart-soak.test.ts
```

Their thresholds are unchanged. The small held-turn replay case in the reopen file stays in
every run. `journal-summary-crash.test.ts` kills the process at each distinct durable state
of a summary and a reviewed reply; a model call's return, or the point just before a frame
that directly follows another frame, leaves the same bytes on disk as the point before it
and is not run twice.

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

### Summary and reply-review restart continuity

`journal-summary-crash.test.ts` kills a real child process at each durable and
in-flight boundary of a supervised summary, journal compaction, and a reply
review. It reopens the same encrypted journal, advances to a later summary
frontier after an interrupted reservation, and compares the resulting memory
projection with a no-crash run. It also checks one accepted answer to the
operator's later question and no duplicate physical sends. An interrupted paid
reply review leaves its original turn visibly held. Run only this focused file:

```sh
npx vitest run tests/preview/journal-summary-crash.test.ts --configLoader=runner --maxWorkers=1
```

Justin's supervised private-chat procedure is
[crash-during-summary-live-test.md](live-tests-archive/crash-during-summary-live-test.md).

### Desk probe turns stay out of memory

The desk's build switches and renewal canaries send one fixed form through the
operator's own Telegram account: `Build check <commit>:`, `Renewal check <commit>:`
or `Canary check <commit>:` at the start of the message, followed by a planted
test fact such as a test marker. `probeTurn` (journal.ts) recognizes exactly that
desk-authored tag from the verified operator. It is a protocol tag, like the
status command, not a reading of meaning: the same words mid-sentence, in lower
case, without a commit id, or from another sender are ordinary turns.

A probe turn is still answered from its own message, sent once and kept verbatim
in the journal. `status` counts it, `inspect` shows it and a Telegram Reply to it
still resolves. It is never read back as operator memory. Later packets omit it
from history, recall, rolling-summary input, inventory, search,
contradictions and open questions. Summary
memory requests and pending dates skip it. Its own answer decision cannot record
a preference, a correction or a dated item. A canary that says "I prefer short
replies" no longer sets the operator's reply style. Summaries written before this
change keep any probe text they already contain. The away digest and greeting
continuity still measure gaps from the last operator message, which can be a
probe.

`probe-traffic-replay.ts` measures this over the real encrypted journal. It
replays a week of ordinary conversation in two conversations with eight probes
(one with the canary's model-failure answer), nine rolling summaries and three
restarts, then asks later ordinary questions read-only. The controls are the
operator genuinely mentioning a niece named Juniper, juniper shrubs, a whiteboard
marker and "I prefer short replies". Before the fix every later packet carried
probe content: 8 history hits, up to 20 recalled, 18 in the summary, the failed
canary as an open question and in the digest. Six of nine summaries contained it,
the week recap counted 29 turns instead of 21, the inventory counted 32 records
instead of 24, and one canary set a preference. After the fix every surface is
probe-free and every control still surfaces. The summarizer and answer models
are deterministic stubs, so this is packet evidence, not real-model quality.

```sh
node --no-warnings --loader ./scripts/slice-ts-loader.mjs tests/preview/probe-traffic-replay.mjs
npx vitest run tests/preview/probe-traffic-replay.test.ts --configLoader=runner
```

The supervised procedure is [probe-traffic-live-test.md](live-tests-archive/probe-traffic-live-test.md).

### One conversation on two machines (journal runner)

Off unless asked for: the single-machine launch is unchanged. With `--machine-posture multi-machine
--conversation-authority URL --replica-listen HOST:PORT --replica-peer URL --owner-machine NAME` (and the shared
secret bound as `INSTAR_SECRET_PREVIEW_AUTHORITY_SECRET`) two runners serve one conversation with one voice:

- One shared authority (`conversation-authority-server.mjs`, on one machine) issues the conversation lease, one
  dispatch-claim per send, and the settled Telegram cursor. Only the lease holder polls or sends.
- The lease holder's journal bytes are copied to the other machine and acknowledged (`journal-replication.ts`).
  A send or a model call waits until the acknowledgement covers the journal through its own record: the purpose
  document's `replicated(1)` default. With the other machine away, messages are still read, but nothing is spent or sent;
  the reason is on stderr, in `status` (`sharedHistory.replication`) and in the supervisor's service observation.
- A machine that takes the conversation over continues from the newest copy it holds. Its own older journal is
  kept as `journal.encrypted.set-aside-<epoch>`. Exactly one machine is seeded (`--journal-lineage seed`) on the
  first start; a machine with no enrolled history never serves.

```sh
npx vitest run tests/preview/two-machine-runner.test.ts tests/preview/two-machine-floors.test.ts \
  tests/preview/journal-replication.test.ts tests/preview/two-machine-serving.test.ts --configLoader=runner
```

The supervised procedure on two real machines is [two-machine-live-test.md](two-machine-live-test.md).

### Tool turns (journal runner)

On by default under the operator's recorded grant. At launch the runner derives the tools activation from the
conversation activation (the same record with `invocationPolicyDigest` = the digest of `subscriptionToolsPolicy(model)`,
framing `preview-tools-v1`) and keeps it only when the sealed authority record resolves it; it is written to
`ROOT/tools-activation.json`, the live withdrawal handle. `--tools-activation /ABSOLUTE/record.json` names a record
the desk wrote instead; `--tools off` refuses tools. With no resolving grant every answer stays text only, the
briefing keeps its no-tools line, stderr says `preview: tools off: …` and `status` says `Tools: off (…)`. With tools,
an operator answer turn or a scheduled work step runs as one Claude Code invocation with the pinned harness's whole
built-in tool set (`SUBSCRIPTION_TOOL_NAMES`; nothing is left out, the hook decides each call), plus the root's MCP
servers (Part Thirteen §9,
`docs/17-harness-adapters/09-claude-code-codex-and-future-runtime-mappings.md`):

- Each turn gets a fresh private workspace on its own fixed-size (128 MiB) scratch volume: a sparse disk image under
  `ROOT/tool-turns/<digest>-<n>/`, mounted at a short private path (`/private/tmp/itt-…`, linked as `vol`) that is
  also the harness's temporary directory, so every byte a tool, the shell or the harness writes lands on it. The
  admission hook's state sits beside it in `state/`. The volume is unmounted and its image removed after the turn;
  the newest 16 turn directories are kept, and the journal's `tool-turn` rows are the record. The root must be on
  ordinary storage (a disk image cannot be mounted from a RAM disk); if the volume cannot be mounted the turn fails
  closed.
- `tool-admission-hook.mjs` admits ordinary work: in-workspace file and notebook operations, sandboxed commands
  whatever words they contain, a WebFetch (GET only) of a host whose every resolved address is public, a WebSearch,
  an MCP tool listed as a read, the harness's bookkeeping (ToolSearch, ListAgents, CronList, ReportFindings,
  TaskStop), a worktree inside the workspace, and a `worker` subagent within the turn's budget (rewritten to the
  foreground), started by the turn or by a subagent. Effects that could be consequential go to the effect
  doorway: an MCP tool not listed as a read, an unsandboxed command, a Monitor command (not shown to be sandboxed; Bash
  in the background is), a send, a scheduled or remote trigger, a DesignSync, and a web read or listed MCP read whose
  effect or target the `--effect-policy` registers or marks policy-sensitive. The doorway (`effect-doorway.mjs`, Part
  Twelve) classifies each against the purpose's four consequential-effect tests (cannot be undone by the agent alone;
  commits money or a resource above the operator's named level, an unknown cost counting as above; reaches outside the
  granted scope; touches a matter marked policy-sensitive). All four false: admitted as ordinary. Any true: admitted only
  when every held test is answered (an irreversible effect only as an operation of the installation's accepted closed
  set, which on one machine no tool effect joins; a resource or policy-sensitive effect under a recorded grant),
  otherwise refused with the tests that held and what would admit it. The decision is written durably (fsync) to the
  admission record before the call proceeds, journaled with the turn's trace, counted in `status` ("Effect doorway:
  …"), and a refusal rides below that turn's answer as one infrastructure line. A Skill is admitted when it is one of
  the pinned harness's bundled skills verified to run inline (its instructions join the turn, which starts nothing;
  the turn loads no user or project skills); a skill that can run forked, and Workflow, are refused for budget (the
  agents they may start cannot be reserved before dispatch), and any other skill name is refused. A web read of a loopback, private or
  local-name host is refused; a tool the hook does not classify is refused. Each call takes one of
  the step's 32 slots (shared with the turn's subagents) by exclusive create, so overlapping calls cannot exceed the
  cap. The sandbox refuses reads from `/` down except the scratch volume and the system files commands need, writes
  outside the volume, the network (a shell cannot write to the network), unix sockets and signals to other
  processes; the harness's messaging socket and token are removed from every command.
- MCP: `ROOT/mcp.json` (the operator's file; absent means none) is `{"mcpServers": {name: {command, args?, env?}},
  "reads": ["mcp__name__tool", …]}`. Its launch configuration, with any credential in `env`, is copied into the
  turn's admission state, which no tool can read; servers run outside the sandbox as the runner's identity.
- Subagents: at most 2 per turn at any depth (a `worker` may start its own), type `worker`, 4 model turns each. The
  hook records each child's start and stop (synced) before it acts; the journal's `tool-turn` trace carries one Rule
  114 edge per child, naming the subagent that started it (`parentAgent`, null for the turn) (`returned`,
  `cancelled` by stop or withdrawal, or `unknown`).
- Before dispatch the turn reserves its whole liability, `maxTurns - 1` model attempts beyond the answer's own plus
  each subagent's turns, against the call cap, and keeps it. Subagent budget comes only from allowance beyond this
  turn and one further plain tool turn. A short allowance, or a packet with no room for the longer tool prompt,
  answers that turn without tools, recorded. `status` shows the tool set, tool-turn and subagent counts and refusals.
- `/stop`, a latched stop file, expiry or withdrawal (changing or removing the record, or a sealed-authority change
  under which the grant no longer resolves) ends a live turn and its subagents: the resource owner kills its process
  group within its 25 ms poll, every cleanup census reclaims each member it finds, and quiescence is verified within
  two seconds.
- `--effect-policy /ABSOLUTE/effect-policy.json` (optional) is the doorway's operator policy: `{"type":"PreviewEffectPolicy",
  "resourceLevelUsd":0,"policySensitive":[],"registered":[],"grants":[]}`. A registration classifies one effect (and
  optionally one target, such as an MCP tool name or a host) with `consequence`, `reversibility`, `reach`, `costUsd` (null:
  unknown) and its `source`; unregistered effects take their worst reachable classification. A grant names `id`,
  `effect`, optional `target`, `approves` (`scope`, `resources` with its `resourceLevelUsd`, `policySensitive`), the
  operator `source` it records, its `custodian`, its `recovery` obligation and an optional `expiresAt`. Absent, nothing
  outward is granted. Launch refuses a policy that does not decode; each tool turn re-reads the file, and a removed or
  broken file grants nothing.

```sh
npx vitest run --maxWorkers 1 tests/preview/tool-admission.test.ts
npx vitest run --maxWorkers 1 tests/preview/effect-doorway.test.ts
npx vitest run --maxWorkers 1 tests/preview/tool-turn.test.ts
npx vitest run --maxWorkers 1 tests/preview/tool-turn-replay.test.ts
npx vitest run --maxWorkers 1 tests/preview/tools-default.test.ts
npx vitest run --maxWorkers 1 tests/assembly/production-provider-tools.test.ts
INSTAR_TOOL_TURN_LIVE_TEST=1 npx vitest run --maxWorkers 1 tests/integration/tool-turn-live.test.ts   # five real harness turns
INSTAR_TOOL_TURN_FULL_LIVE_TEST=1 INSTAR_TOOL_TURN_CASE=full npx vitest run --maxWorkers 1 tests/integration/tool-turn-full-live.test.ts  # one per case: full, outward, stop-child
```

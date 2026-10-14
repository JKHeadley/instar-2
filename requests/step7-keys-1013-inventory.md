# Step 7: authority inventory and first real slice

Source inspection, not a deployment or completed activation claim. Unit `step7-keys-1013`.
The requested implementation is blocked; this delivers the inventory and dependency order.

## Evidence boundary

Inspected conversation base: `4a5a9628dd33ef4a6409ad1f4eccee6bcbc47e33`.
Constitution read purpose-first, in full, from `origin/main` at
`7ef8f158d4129a4cf90cf3c546701f32e348fdd3`.
Install design: `origin/install-bootstrap-design-1013` at
`3a97886d44c782b7654bf55d14697a82e171d888` (its bootstrap wording is also in this base).
Install platform track: `origin/install-platform-neutral-1013` at
`da99cd521f8eb7a11c0fee24961df13d47d19f9e`.
Custody implementation: `origin/install-broker-linux-1013` at
`a094644f276f4deab1bd4df8b45fa72f7859656f`.

Read the Studio brief, actual-agent-plan-1013, design-set-review-astra-1013,
src-carry-table-1013 and install-firstgrant-1013-PROGRESS through the read-only file API.
All first reads succeeded. The older first-grant report identifies a design gap that the
newer bootstrap design now fills; it is an implementation gap at the inspected heads.

A TypeScript AST walk of relative static imports/exports from
`tests/preview/journal-agent.mjs` reached 318 files. Only two non-fixture modules import
fixture modules: `six-host-resources.ts` and `media-admission.ts`. Their common fixture
imports `tests/fixtures.ts`. Followed the actual launcher call sites as well as the imports:
a barrel's presence alone does not mean its exported owner runs. Also read activation,
intake principal and physical session wiring. This is a source trace of this branch,
not inspection of operator live journals or evidence that all optional branches ran live.
No key material was printed, generated or used.

## Inventory: actual fixture-bearing paths

Line references below are to the conversation base unless another branch is named.

| Consumer and use | Fixture dependency and consequence | Real replacement; implementation status |
|---|---|---|
| `tests/preview/journal-agent.mjs:1676`, allocation passed to `hostResources.attach` at 1693 | `tests/preview/six-host-resources.ts:17,62` constructs `factsFixture()` and imports its signing key | Reuse Six's existing allocation authority with an installed Two fact context and independently custodied machine signer. Owner algorithms built; ordinary-install authority/custody composition designed only. |
| `tests/preview/six-host-resources.ts:69-70` | Authority machine is literal `machine-a`; principal is fixture `alice`, with fixture scope/provenance, even though resource domain names use the actual host machine | Installation machine identity and service principal under admitted initial standing. One/Two decoders built; fresh enrollment and standing chain designed only (`docs/06-the-fact-envelope.md:379-444`). |
| `tests/preview/six-host-resources.ts:83-84,93-96` | Hard-coded `generation:1`, fixture decode/register/grants/genesis, `f.clock(100)`, and `stopped: false`; loop breaker reference `stub-closed` | Current admitted generation, measured owner clock and separately administered stop, with registered loop policy. Six interfaces built; installation bindings incomplete. Host-level stop checks elsewhere do not make this owner's constant false an independent stop. |
| `tests/preview/six-host-resources.ts:103-104` | Both host lease facts and resource-set facts are signed with fixture private key | Run existing `createTransportSpine` / `createResourceSetSpine` inside the independently administered custodian, supplied its genuine admitted context. Their present `FactAuthor` accepts key material; giving the same interface to the agent is not isolation. |
| `tests/preview/six-host-resources.ts:144-147` | Every per-launch domain inherits that principal/clock; its separate fact context and signer are fixtures too | Same custodian and admitted machine/standing for each domain; keep current per-launch accounting, unresolved allocations and cross-domain resolver. No new allowance per message and no second resource scheduler. |
| `tests/preview/journal-agent.mjs:1705`; `tests/preview/media-admission.ts:14,90-97` | Inbound media repeats the fixture authority: `machine-a`, `alice`, fixture generation/context/scope, `f.clock(100)` | Compose media through the same installed fact/signing owner and authenticated durable intake. Media source and outer timeout already use host evidence; inner authority replacement remains unbuilt. |
| `tests/preview/media-admission.ts:106,110-112,117` | Fixture key signs lease/reservation/claim and the causal `media-request`; that request uses `f.now`, also fixed. `stub-closed` loop reference | Custodian authors the actual request with real time and admitted principal; retain claim before physical fetch and refuse an uncertain repeat. Owner append/claim mechanisms built; real install wiring incomplete. |
| `src/transport/authority.ts:18-24`; `src/transport/resource-set.ts:212-217` | Core spines faithfully copy `host.principal`, provenance and `host.current().clock`, signing with `author.privateKey`. These are where the supplied fixtures become signed durable facts | No need to rewrite the authority algorithms. Their host/context/key inputs must originate behind genuine custody. Built reusable core; supplied production authority is the missing layer. |
| `tests/facts/fixtures.ts:22-31`; `tests/fixtures.ts:40-42,57-79` | Shared source constructs fixture key sets, genesis clock, principals, scope and org-intent grant. Fixed clock is 100; `alice` comes from the fixture principal helper | Approved installation bootstrap/genesis and original grant history. Preserve old fixture history honestly; never re-sign it as production history or silently relabel it. |

The resource monotonic tick (`six-host-resources.ts:66`) is real injected elapsed time;
it does not replace the fixed wall-clock measurement supplied to fact/standing checks.
Likewise media's real timeout and real `options.now()` policy evaluation do not replace
its fixed fact clock. These are separate clocks serving different checks.

## Other preview authority that must not be called independently installed

These are not hard-coded test keys or fabricated human senders. They still matter to the
requested move from preview authority to an independently administered installation.

| Path | What it actually does | Replacement and status |
|---|---|---|
| `tests/preview/journal-agent.mjs:336-342,2457-2461` | Continuing-session activation calls the desk authority resolver with a seal key derived from the journal storage key. Pool session checks do the same at 2403-2406. | Verified first subscription/role grant under actual `GO`, consumed through One/Two and Ten admission. Session driver and exact policy checks built; real first-grant producer and installed session composition designed only. |
| `tests/preview/activation-authority.ts:20-23,35,101-106,151-160` | The desk is `echo-desk`; liveness uses caller time in cast preview Clock objects. HMAC seal is a derivation of storage custody, not an independent operator device signature. Authenticated original messages and sealed scope are checked; those checks are not missing. | `R/OR/GP`, authenticated `E`, `GE`, exact `A0`, `O0/S0`, then `GO/C0` and subscription `A1`. Use existing decoders and facts, not a replacement JSON approval database. Designed in `docs/06:379-444` and `docs/14:233-331`. |
| `tests/preview/journal-agent.mjs:295-299` | Hand-assembled `preview:register` decode context, not current installed generation evidence; passed to provider/session/resource boundary results | Current admitted assembly boundary/context. Installed bootstrap loader, signer reference and assembly validation exist; journal composition does not consume them. |
| `tests/preview/intake-principal.ts:25-29,37-51,74-101` | Static preview intake register and machine label; runner/scheduler system signing key derives from storage key and signs actual occurrences. Not the fixture key. | Installed authenticated transport and service identity/custody, preserving exact occurrence binding. Decoder mechanism built; ordinary installer chain incomplete. |
| `tests/preview/journal-agent.mjs:93-97`; `tests/preview/clock.ts:3-15` | Actual wall/elapsed clock, seeded from durable journal floor | Already real time, not a fixture. Retain monotonic rollback protection; bind authority measurements to the installed clock owner. |
| `tests/preview/intake-principal.ts:117-124` | Human sender ID is taken from authenticated update bytes and decoded, with production/test origin distinguished | Already actual sender authentication at this layer. It does not independently establish fresh-install operator standing; binding remains a separate prerequisite. |

Provider activation validation (`src/assembly/production-provider.ts:477-500,734-738`)
checks exact runtime/profile/policy/account/time and residuals; it does not authenticate
its own approval. The journal's preceding desk resolver supplies that standing today.
The conversation port (`src/assembly/production-conversation-session.ts:127-151`) records
an authority string and calls the injected resource/admission/driver ports; it does not
create verified grants. Replacing that string would change no authority.

The original carry table's stage-2 fixture owners are not imported by this journal entry.
Do not bulk-port or repair them as though they controlled this continuing conversation.
The two fixture consumers above cover the static source path found here, including media;
source inspection is not a claim about arbitrary injected loaders or a different deployed head.

## First slice selected, and why implementation cannot honestly complete here

Select **continuing-session activation under independently admitted standing**, first.
It admits the process that handles multiple messages and tools. Fixing only the numeric
clock or replacing a fixture key with another agent-readable key would leave that process
able to manufacture its own authority; it would not meet the brief's key-custody floor.
Keep the existing session driver, one cumulative reservation and exact activation policy.
Do not change prompts, output interpretation or the worker contract in this unit.

The smallest real copy test needs an independently installed custodian and release anchor,
an admitted enrollment/first-grant chain, and an operator stop owned outside the worker.
The design explicitly puts broker isolation before automated key preparation and requires
Seven's bounded local supervisor before creation/backup/signing (`docs/14:245-262,312-331`).
`openProductionCustody` (`src/assembly/production-custody-wiring.ts:27-29`) explicitly
performs no key generation, recovery or activation. `loadProductionBootstrap`
(`src/assembly/production-installation-loader.ts:24-55`) consumes an external pin;
`production-signer-reference.ts:27-41` binds it. Neither creates independent approval.

The inspected install branch supplies Linux installation and conformance machinery, but
its `scripts/custody-platform/macos.mjs:5-20` wraps a caller-supplied `implementation`;
it is not a Mac custodian installer. Its change review explicitly implements no genesis,
pairing, grant, key generation or activation. No copy-specific admitted trust package or
custodian endpoint was supplied in this brief. No serving login or live root was accessed.

Host evidence: builder UID is 501, `justin`; `/usr/bin/sudo -n true` is refused with
`operation not permitted`. The session's managed filesystem permits writes only in the
builder workspace and temporary directories, with no escalation. A same-UID daemon or
mode-0600 file in either location would still be under the agent's administration. This
is not a request to bypass that boundary or to reuse the operator's running custodian.

**Exact blocked requirement:** the brief requires one real end-to-end slice with its key
outside the agent's reach and an independent stop; purpose lines 96-98 prohibit the agent
administering that safeguard. With no supplied independent copy custodian/admitted chain,
creating the key under this builder would violate that rule, while establishing independent
OS administration is unavailable here. The task and constitution are compatible; a local
self-signed shortcut is not. No replacement key or production activation was manufactured.
No implementation success or READY is claimed.

## Remaining order, estimated working days after prerequisites become available

These are desk handoff estimates, not booked work or promises by another builder. Day 1
means the first day an independently administered copy host is available; recheck this
blocker with the install track by 2026-10-14. Existing design assigns owners; this report
adds no parallel authority service or alternate repair to their work.

| Order | Owner and work | Estimate | Exit evidence |
|---|---|---|---|
| 1 | Install Nine/Ten: complete Mac broker isolation and distribution verification, independent stop; reuse the install platform contract | 1-2 days | Harmless scoped request succeeds; agent and worker cannot read/replace key, replace service or elevate; stop works with worker stalled and across restart. |
| 2 | Install Seven, then One/Two/Four/Eleven: local supervised preparation, recovery, enrollment/genesis/binding, first role/subscription grant and real spend cap | 2-3 days | Real authenticated confirmation admits once; wrong account, altered digest, expired/revoked/replayed approval refuse; stop survives restart; unknown spend stays reserved. No preview waiver. |
| 3 | Step 7 with Ten/session host: consume that standing for one continuing copy session | 1 day | One admitted process handles two inputs without refreshing allowance; changed policy, withdrawn grant, expired clock and stop deny dependent launch/delivery; actual worker cannot obtain custodian key. No paid/live credentials in this builder's test. |
| 4 | Step 7 with Six/Two: replace host and per-launch fixture principal/key/context/clock together | 1 day | Real signed facts reopen under installed roots, fixture signature/wrong principal refuse, open allocations survive restart, stop/cap hold, ordinary permitted allocation still succeeds. Keep fixture history separate. |
| 5 | Step 7 with intake/effects: replace media fixture authority and preview system-writer/decoder context using the same owners | 1 day | Real media causal record/claim before fetch; interrupted/unknown fetch does not duplicate; genuine intake succeeds and test-origin/forged writers refuse. |
| 6 | Desk integration with steps 1b/2: copy acceptance, full gates and eventual operator-authorized move | 1 day plus a day of use | Durable intake, no duplicate sends, shared spend cap, independent stop/secrets tested on the combined copy. No production move inferred from this inventory. |

Total sequential estimate: 7-9 working days plus a day of copy use. Broker/enrollment
work may overlap existing owners; there is no evidence here to promise the plan's October 23
copy date before its prerequisites and owners' actual progress are confirmed.

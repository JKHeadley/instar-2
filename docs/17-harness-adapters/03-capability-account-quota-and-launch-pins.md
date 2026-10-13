## 3. Capability, account, quota, and launch pins

**Rule — capability is a fresh observation, not a configured promise.** Rules 13, 26, 41, 62,
75 and 95; **checks: P13-NF-04/09/10**. The adapter reports whether the executable is running,
which admitted account identity it can actually use, which model and reasoning settings the
runtime accepted, and which provider quota windows it can observe. A reasoning setting is the
registered provider or harness control that changes the amount or style of model reasoning; it is
not Part One's `Profile`. A harness configuration is a named vendor-runtime configuration bundle
whose exact arguments and nonsecret environment mapping are owned and resolved by Ten. Each report
names its source,
subject, artifact, machine, observed clock, freshness horizon, completeness limits, and capture or
receipt reference using existing `Measurement`, `HarnessObservation`, conformance fields, and the
requested Ten-owned capability report. A file, process label, configured account slot, provider
display name, or adapter self-report alone
is not authority. Missing, stale, partial, or permanently unavailable quota is `unknown`, never
zero, full headroom, or an inferred reset.

**Rule — consumers re-resolve every reported subject.** Rules 26, 28, 41, 49 and 69; **checks:
P13-NF-09/10/40**. Placement, admission, display, and recovery resolve current account, model,
reasoning setting, provider billing route, quota, grant, register generation, and artifact status
from signed history and the owning service. A provider billing route is the registered subscription
or metered account path against which usage and quota are attributed. Consumers compare that
result with the adapter observation. A mismatch inhibits the affected launch or next action and
records the conflict. It never lets the adapter's own `accountId`, model string, or
`supported: true` field override the current record.

**Rule — model, runtime configuration, reasoning, and account choices are exact launch subjects.** Rules 41,
56, 63, 75 and 96; **checks: P13-NF-11/12/13**. The Seven-owned model route, account selection,
named harness configuration, and allowed reasoning setting are not fields of constitutional `Profile`.
Seven's requested route resolver supplies the exact provider, model, reasoning setting, and billing
route. Ten's requested runtime-configuration resolver binds that selection to an approved account
and credential-custody reference, harness configuration, and exact argument/environment mapping;
the resulting references and resolved fields enter the expanded `HarnessLaunchSpec`. The adapter
records the resolved runtime arguments, nonsecret environment digest, and runtime acceptance
evidence. The current landed launch schema cannot express those pins, so the route positive is
non-executable until `seam-response-judgment.md` lands and the launch/configuration positive is
non-executable until `seam-response-assembly-followup.md` lands. A raw model string
from input cannot reach the launcher. An unavailable pin refuses or follows an explicitly admitted
policy owned by the earlier part; the adapter never silently substitutes a model, reasoning
setting, account, provider billing route, harness configuration, or runtime while keeping the old
label. Constitutional `Profile` remains available only to classify the consequences of the
feature or operation.

**Rule — a real model call crosses the public effect doorway.** Rules 31, 42, 55, 63, 68 and 75;
**checks: P13-NF-16/23/43/44/47**. Seven prepares and records the canonical bytes actually to be
submitted under its owner-resolved route. Eight admits the corresponding versioned provider-call
payload; Six reserves and consumes one claim; Ten's guarded executor verifies the submitted bytes
and digest before exactly one provider invocation. Seven records the provider receipt and actual
usage observations with the exact provider, account, and billing-route attribution; Eight records
the operation observation, Nine supplies the independent assessment, Eight settles from that
assessment, and Six applies accounting. The model-attempt lineage remains correlated to the
`HarnessObservation` and exact complete adapter tuple. A test-only provider, direct provider-client-library call, or
adapter-local receipt cannot satisfy the production boundary. Seven's preparation/receipt half is
non-executable until `seam-response-judgment.md` lands. Eight's provider-effect half is
non-executable until `seam-response-effects-followup.md` lands.

**Rule — credentials remain references and custody stays outside the worker.** Rules 28, 63
and 100; **checks: P13-NF-13/40**. The requested Ten runtime configuration and expanded
`HarnessLaunchSpec` carry only `SecretRef` and approved custodian references where credentials are
required; the landed schema cannot yet express that account binding and therefore keeps the mode
unsupported. Adapter descriptions, arguments, environment
digests, observations, captures, errors, conformance fixtures, and operator views contain no
credential value. Account identity is proved by the provider or credential custodian at use. A
credential slot label does not prove who occupies it. A credential or account change is a new
admitted operation and, where the runtime reads credentials only at start, a replacement worker.

### Installation custody and recovery

**Rule — the bootstrap custodian is independently administered on one machine.** The
purpose's independent-safeguard and single-machine rules, Rules 28/100, P-01 and P-02;
**checks: P13-NF-13/40, P9-NF-51–55 and P10-NF-17–21/31–34/36**. The custodian is Nine's
existing protection broker, installed by Ten under a dedicated operator-controlled OS
service identity. The installation record names its actual identity, administrators,
verification-key reference, recovery holder and policy digest. Agent and harness identities
are nonadministrative: no write or rename of its files or parents, service/configuration
replacement, debugger/process-memory access, inherited secret handle, sudo/elevation,
container administration or recovery credential may reach the custodian. Its fixed interface
accepts requests and returns scoped receipts, never arbitrary execution or key export.
Ten tests those paths with the complete credential sets of both identities before admission.
A second process or private directory under the harness user is insufficient. Files can live
under an installer-owned installation root with separately owned subtrees; root containment
alone proves neither separation nor custody. Host administrator compromise is P-01's named
residual, not a capability granted to the agent.

The same custodian keeps the first signing/verification material and subscription credentials
in distinct scopes. The installer records only SecretRefs in Ten's manifest and account
inventory. Before login admission it checks the initial grant, current custody evidence,
actual provider/custodian account identity and runtime acceptance. A successful login exit
or directory label is insufficient; a runtime that cannot observe account identity retains
that declared limit and the operator-assertion label required by its mapping. No claim of
verified provider identity is invented for Codex.

**Rule — recovery material has an independent home.** Rules 7/26/79/100 and P-01;
**checks: P10-NF-34/36**. During the same authenticated setup, the custodian places an
encrypted recovery package in the person's selected operator-only recovery vault, outside
the installation machine, and verifies a restore challenge before setup completes. The
package retains installation identity, approved org-intent/genesis anchor, custodian key
recovery and revocation/version references. P-01 names the actual vault service/account and
its normal account-recovery route; neither agent nor harness has that account's credential,
session, delegated access or recovery path. The custodian updates the independently retained version/revocation witness when those
subjects change, so restore can test currency rather than trust an old package.
The product adapter performs backup and restore;
the person does not copy keys, hand-write records or keep the sole copy on their phone.
A vault that loses access with the same single device does not meet this contract. This is
an operator recovery holder, not an agent peer or a dependency on a second running machine.

After device loss the recovered operator authenticates on another device, restores through
the custodian, revokes lost-device authority and revalidates current anchors, versions and
bindings before use. A stale backup or conflicting version holds affected authority for
independent repair rather than rolling revocations back. Missing or unreadable backup is
visible at setup and on the existing custody probe cadence. Loss of agent history still has
P-08's accepted consequences: recovering control does not reconstruct unknown effects or
permit their repetition. Recovery tests remove each device separately and verify that the
agent credential set can neither recover nor replace the anchor.


---

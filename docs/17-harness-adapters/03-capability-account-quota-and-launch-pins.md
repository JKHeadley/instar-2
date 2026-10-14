## 3. Capability, account, quota, and launch pins

**Rule — the worker receives capabilities, not credentials or authority to grant them.**
Purpose independent safeguards, role onboarding and least revelation; Rules 28/29/63/75/78/84/100;
checks P13-NF-09–13/18/40/47. Ten binds the exact executable, working scope, confinement, model
route, account-custody references and finite resources before launch. Seven resolves model,
reasoning and billing-route choices. Thirteen translates these into runtime settings and records
what the runtime accepted. A raw model/account string in a message cannot silently change them.
Changed bytes or mismatched identity require fresh admission, not relabelling an old result.

A connected-account binding contains the registered tool/connector identity, public description
and argument schema, the standing-grant reference, allowed account and scope, custodian endpoint
handle and current generation. No credential enters the prompt, environment capture, transcript,
error, fixture or worker-readable configuration. The custodian proves account identity at use
or records the precise observation limit. A login directory name is not that proof. The worker's
briefing and tool catalogue are generated from the bindings actually installed, including limits
and the named grant needed for unavailable scope. An empty connector list is a capability gap,
not a safety default permitted by the role rule.

**Rule — every tool invocation crosses the same admission boundary.** Purpose durable cause,
standing role and sign-off rules; Rules 4/29/38/42/55/60/63/66/75/114;
checks P13-NF-06/13/18/23/40/41/47. The runtime proposes a tool id, exact arguments and call id,
correlated to the active delivery and run/step. The host resolves the registered action and
current grant; it checks stop, ownership, limits, disclosure and applicable sign-off. It records
the required causal prefix before execution. Only then can the independent executor run it.
The normalized result returns its exact call identity, captured output and observed outcome.
Unknown occurrence stays unknown. Hook approval alone proves no physical confinement.

Built-in shell, file, browser, network, connector and helper paths must obey this boundary, not
only externally listed tools. Approved reversible local work uses its bounded local durable path;
irreversible work uses Eight's required durability and settlement. MCP is a transport to an
admitted tool service, never a source of authority. Direct account credentials and alternate
provider/network routes remain inaccessible. A helper uses the same bounded parent-child work
contract and result destination under Rule 114, not an invisible vendor background worker.

**Rule — metering spans the whole conversation's work.** Rules 4/13/41/55/60/61/75;
checks P13-NF-09/16/23/27/40/47. Every model attempt, including tool-loop turns, delegated calls,
resume, summaries and compaction, has component/run/delivery attribution and actual token/charge
evidence or a written provider exception with retained maximum exposure. Six reserves an
enforceable finite upper bound before dispatch and accounts once by attempt identity. Another
message, a replacement worker or a model switch cannot replenish that reservation. Calls beyond
the remaining bound refuse before dispatch; unfinished work remains recorded for a separately
admitted continuation. Unknown usage is never zero and does not release the reservation.

Provider quota is separate from the local spend cap. Windows carry their actual duration,
source and freshness; missing or stale windows remain unknown. Route/account replacement occurs
at a closed turn boundary by default, uses the existing bounded recovery policy and charges the
same work budget. An unreadable busy state cannot authorize an optimization that interrupts work.
Revocation is checked at each dispatch, not merely at launch; stale cached capabilities confer
no permission. New bindings are delivered at a safe boundary, with replacement only if the
runtime cannot update them in place.

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

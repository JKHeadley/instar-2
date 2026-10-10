# Change review — paired Threadline activation blocked on current installation

Subject base: 9d8089a6db175d9ed72ae30a7f8347b158301ffe
Review state: open
Reviewed content: none
Outcome: Record why a scope grant and pairing cannot enable a Threadline send through the current group installation without changing its durability posture. No runtime feature is implemented or claimed ready.
Affected rules: 1, 26, 28, 29, 34, 42, 49, 62, 74, 94, 101, 102, 103, 113, 116
Affected floors: secrets, spend cap, stop, no duplicate sends and durable intake remain unchanged; no runtime code, grant, pairing or live state is modified.
Operator questions: The requested grant-only activation on the current single-machine installation conflicts with the purpose's fixed irreversible-operation set. A replicated installation with an admitted Threadline operation is a compliant alternative; widening the single-machine set requires an operator-approved constitutional change, not an effect-policy override.
Suggested tier: editorial
Declared tier: editorial
Tier rationale: Evidence and blocker record only; no implementation or behavioral change.
Side effects: This record does not enable messaging or change the agent's self-description. The requested capability remains absent.
Undo and recovery: Remove this review record if superseded by a completed implementation; no runtime rollback is needed.
Multi-machine posture: The inspected group launcher has no conversation authority or replica configuration. The existing runner has a replicated conversation path, but its tool admission still passes SINGLE_MACHINE_PROFILE.operations unconditionally. An eventual Threadline operation must preserve exact causal-prefix replication and ownership admission; adding its name to the single-machine list is not permitted.
Layer below: docs/00-the-purpose.md single-machine closed-set rule; tests/preview/activation-authority.ts SINGLE_MACHINE_PROFILE; tests/preview/effect-doorway.mjs admitEffect; tests/preview/journal-agent.mjs admissionConfig and shared.admit; the desk's runner-group-run.sh read through the read-only file API; src/transport/threadline.ts and the installed 1.x ThreadlineEndpoints/MessageEncryptor source.
Bug class: none
Bug evidence: none
Hook bypass: none
Convergence: none
Decision: threadline-current-shape-hold | Stop the grant-only implementation on the inspected single-machine group installation instead of adding Threadline to its constitutionally fixed operation set. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/w4-threadline-peer-PROGRESS.md
Decision: threadline-wire-evidence | Treat the v2 reference protocol and Echo's 1.x transport as different wire formats; importing the reference adapter alone does not establish interoperability. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/w4-threadline-peer-PROGRESS.md

## Evidence

The constitution says the single-machine profile's closed set contains its installed paid
provider call, reply-only Telegram ordinary replies and text-only reply-only Slack ordinary
replies. It explicitly refuses operations outside that set. Sending to another agent cannot
be undone by the sender alone. A scope grant is necessary but does not satisfy this durability
condition. This is a limitation of the requested activation on the current installation, not
a claim that Threadline cannot be built under the constitution.

On 2026-10-10 the read-only desk file `.instar/lanes/runner-group-run.sh` named build
`runner-frozen-w4-server-policy-9d8089a6`, forum chat `-1004290919884`, and root
`.instar/lanes/preview-trial-root/justin-group-20261010`. It supplies neither
`--conversation-authority` nor `--replica-peer`; the code cannot enter its replicated path
without the former. No live launcher or root was modified.

The existing test `admits a consequential effect only when every held test is answered, and
names what would admit a refused one` passed in the foreground with nice level 10 and one
Vitest worker. It proves the refusal of an irreversible MCP send under scope/resource grants
and the neighboring acceptance of an ordinary Telegram reply in the fixed operation set.
This is evidence of the blocker only, not tests of a new Threadline send or receive path.

Echo's Studio health response at `2026-10-10T22:50:55.568Z` reported connected relay,
identity public key `63b1dbb21646e2f5f860441f6c6443ad259e81bdad48227a8f87e2d00ec89bef`,
routing fingerprint `63b1dbb21646e2f5f860441f6c6443ad`, protocol `threadline`, version
`1.0`, protocolVersion `2`, and capability `inbound-id-ledger`. The protocolVersion field
advertises the 1.x inbound ledger; it does not mean `threadline-ref-v2` frame compatibility.
The 1.x HTTP receive endpoint requires a paired relay token and signature headers over its
HTTP body. The reference adapter submits a different encrypted frame through an injected
relay. No pairing, send, receipt or worker-delivery evidence was produced here.

## Activation disposition

There are no working grant-and-pairing activation commands for this submission: it contains
no messaging implementation. Do not install a grant that reclassifies the send as reversible,
add an MCP send to a read-only allowlist, or add it to SINGLE_MACHINE_PROFILE.operations.
The compliant continuation is to register a replicated Threadline operation and wire it to
the existing ownership and causal-prefix admission on an enrolled second machine, then
implement the pinned 1.x peer wire path and durable topic-bound intake. Pair the full verified
public key, not merely the routing fingerprint. This must include scoped send/receive and
group-disclosure authority, stop and secret checks, permanent message identity/deduplication,
untrusted peer content, and captured/live proof before any READY claim.

## Closing block

simplestRobustRoute: Reuse the existing replicated ownership/effect doorway and a narrowly paired 1.x wire adapter; a scope grant alone on the current single-machine installation is not that route because it cannot satisfy the fixed irreversible-operation durability floor. This submission records that conflict without adding machinery or changing policy. No autonomous completion is claimed.
80/20: Stop at the demonstrated governing conflict as the builder charter requires. The wire mismatch is recorded to prevent an import-only repair from being mistaken for interoperability.
VERDICT: BLOCKED author investigation; no independent review or feature completion claimed

# Standing trust setup

Run `node scripts/setup-standing-trust.mjs setup ROOT OPERATOR-REQUEST.json` as the
operator's installer, with the operator's recorded choice. The exported
`configureTrust(root, action, request)` entry point also supports a wizard. The
request contains no credentials. Supply credentials to the runner vault first;
MCP environment entries name them with `secretRef`.

A request looks like this (replace example values with the operator's choices):

```json
{
  "source": "operator:setup:record-id",
  "custodian": "operator",
  "recovery": "Revoke standing trust and restart the runner",
  "resourceLevelUsd": 2,
  "effects": [
    {
      "effect": "tool:mcp",
      "target": "mcp__drafts__edit",
      "recovery": "Restore the previous private draft revision",
      "registration": {
        "consequence": "data",
        "reversibility": "reversible",
        "reach": "world",
        "costUsd": 0
      }
    }
  ],
  "mcp": {
    "mcpServers": {
      "drafts": {
        "command": "/operator-installed/draft-server",
        "env": { "TOKEN": { "secretRef": "draft-service-token" } }
      }
    },
    "reads": ["mcp__drafts__read"]
  }
}
```

The named draft server must expose only the declared undoable operation in the
agent's custody. Tool names are not evidence of reversibility. Do not classify a
send, post, release, or message to a person as reversible. A grant never approves
irreversibility. Such operations remain refused outside the installation's closed
set on one machine. Unknown cost remains refused, even with a resource grant.
The dollar amount bounds each declared effect; the runner's aggregate spend cap
and model-call reservations remain separately enforced.

For a reversible network write, use `effect: "tool:network-write"`, the exact host
as `target`, and `request: {"method":"PATCH","path":"/owned-draft/1"}` alongside
its registration. The route must itself be limited to the declared operation;
request bodies are not classified by this setup. A shared Git receive-pack route
cannot distinguish branches here: use an operator-installed MCP tool or a service
credential restricted to the owned branch. Do not grant an entire shared Git host
as reversible. Other routes and method overrides do not inherit this registration.

Setup writes `ROOT/effect-policy.json` and `ROOT/mcp.json`. It refuses different
existing choices instead of overwriting them. Repeating the same setup is a no-op;
if interrupted between files, repeat the identical request. File contents and the
parent directory are synced before success is reported. An interrupted replacement
can leave `.trust-next`; inspect that operator-owned file before retrying.

Launch the existing runner with `--effect-policy ROOT/effect-policy.json`, retaining
its existing root and all other launcher arguments. Policy is reread at turn
boundaries. MCP changes require a restart. The setup command does not start or
restart a runner and does not grant itself authority to administer safeguards.

To tighten, run `node scripts/setup-standing-trust.mjs tighten ROOT REQUEST.json`.
Keep the original provenance and recovery statements and reduce the effects,
resource ceilings, servers or reads. Classifications stay recorded even when a
grant is removed, so tightening cannot restore a more permissive default. To
withdraw all setup trust, run `node scripts/setup-standing-trust.mjs revoke ROOT`
and restart the runner. Repeating revoke is safe. Effects already dispatched
cannot be recalled by revocation.

For Justin's live installation, the desk must select the actual scoped tools,
servers and dollar level from his recorded setup approval, populate the request,
run setup under the custodian identity, and add the effect-policy flag to the
existing launcher. Recompute the changed tools-policy activation and run the
Darwin harness proof before restarting. Verify an owned draft edit, an unrelated
write refusal, irreversible send refusal, and a tighten/revoke cycle through the
live tool surface. Keep the previous launch configuration for rollback. No live
configuration is modified by the builder.

This state is installation-local deliberately: each machine's custodian installs
its own scoped policy and vault references. Setup does not add operations to the
one-machine profile or change replicated durability demands.

## Authorization inventory (Rules 49, 103 and 104)

This inventory covers setup's asks and the runtime authorization consumers beneath
the tool briefing. A model suggestion creates no authority. The purpose's four
consequential-effect tests, independently administered safeguards and recorded
outward scope govern the retained fences. An existing authorization is reused
within its recorded scope; a candidate standing grant requires operator acceptance.

| Action or ask | Governing constraint | Standing grant disposition and actual consumer |
|---|---|---|
| Install scoped tools, MCP servers and per-effect dollar levels | Purpose: nothing outward without recorded scope, custodian and recovery; Rules 98/100 | The operator accepts one setup request. [configureTrust and setupTrustPolicy](../tests/preview/trust-setup.mjs) write existing policy records; repeating identical setup asks for nothing and changes nothing. A different or wider choice requires a new operator-owned record, never model inference. |
| Reversible MCP action, network write or sensitive read | Purpose: all four consequential-effect tests; Rules 4/103/104 | [classifyEffect and admitEffect](../tests/preview/effect-doorway.mjs) consume exact effect/target/request scope, finite known cost and policy-sensitive grants. [admitToolCall and admitEgress](../tests/preview/tool-admission.mjs) use that policy at the checkpoint. Covered actions run without a new yes; absent scope, unknown cost and out-of-scope routes refuse with a reason. A new operator grant is needed only to widen the recorded scope. No consumer repair is needed here. |
| Ordinary workspace tools, public reads, subagents and sessions within accepted bounds | Purpose: ordinary bounded work and ability preservation; Rules 30/60/114 | [tool turn preparation and execution](../tests/preview/tool-turn.mjs) retain the tools and model-call reservation; [tool admission](../tests/preview/tool-admission.mjs) and [session driver](../src/assembly/production-session-driver.ts) enforce checkpoint and recorded child-edge obligations. These do not acquire a per-action setup approval requirement. |
| Make setup MCP tools available in either harness | Rules 30/100 | [prepareToolTurn](../tests/preview/tool-turn.mjs) wraps vault references once; [Claude launch](../src/assembly/production-provider.ts) consumes its JSON file and [codexToolHookArgs](../src/assembly/production-codex-provider.ts) consumes the same prepared launches as per-invocation TOML overrides. This is the concrete consumer repair: setup no longer depends on manually installing Codex servers. Removal applies after the documented MCP restart. Independently installed login-home servers remain governed by their own configuration and the admission hook. |
| Paid calls and ordinary replies in the one-machine closed set | Purpose: single-machine profile acceptance and durable cause; spend/stop/duplicate floors | [activation authority](../tests/preview/activation-authority.ts) and [effect owner](../src/effects/doorway.ts) consume installed policy and exact durable evidence. Setup tool grants neither replace that acceptance nor ask again for each covered call or reply. Unknown dispatch is never permission to resend. |
| Other irreversible sends, releases or external deletion | Purpose: irreversible closed set and four tests | [admitEffect](../tests/preview/effect-doorway.mjs) refuses outside the profile. Setup cannot grant irreversibility; an ordinary per-action yes cannot erase durability or expand the closed set. A changed supported installation policy/durability path requires its governing operator acceptance. This is a governed effect fence, not removal of tools. |
| Raise call/reply/turn caps | Spend/resource ceiling; Rules 82/98; independently administered safeguards | [OperatorAction and admitChatYes](../tests/preview/operator-yes.ts) issue an exact request. [produceExplicitYes](../src/operator/explicit-yes.ts) verifies account assent; [decideOperatorRequest and applyOperatorYes](../tests/preview/journal.ts) consume it once. The alternate [approval surface](../scripts/approval-surface.mjs) feeds verifiedApproval/validApproval in the same journal. An existing accepted ceiling already covers work below it. Setup's per-effect dollar grant does not authorize raising aggregate caps; retain a fresh yes for a new ceiling. No auto-approval repair is warranted. |
| Renew installation expiry | Exact accepted activation and lifetime; Rules 82/98 | [proposeOperatorRequest](../tests/preview/operator-yes.ts) and [applyOperatorYes](../tests/preview/journal.ts) require the installed renewal activation and exact approved end. A setup grant without expiry does not renew provider or installation authority. Retain the fresh request for a new end; the applied renewal then covers work until that end. |
| Retract identified operator-account turns as test traffic | Rule 35; verified principal and exact approval, Rules 28/98 | [operator-yes](../tests/preview/operator-yes.ts) and [retractRefusal/applyOperatorYes](../tests/preview/journal.ts) bind exact update ids and reason. Retain the fresh authorization: a tool grant cannot declare different messages to be test traffic. An already applied request is not asked again. |
| Authenticate an approval, including shared-account acceptance | Purpose: operator approval remains the operator's act; Rules 28/29/98 | [explicit-yes admission](../src/decode/explicit-yes.ts) binds an exact unexpired request and consumes it once; the current installation-specific shared-access acceptance is reused with disclosure, and withdrawal stops consumption. [verifiedApproval/verifiedStop](../tests/preview/journal.ts) consume the independent surface's proof. Setup grants are not signatures, account acceptance or verified approvals; no conversion or repair is appropriate. |
| Emergency stop | Stop floor; independently administered safeguards | [verifiedStop and stop handling](../tests/preview/journal.ts) and [approval surface](../scripts/approval-surface.mjs) retain their actual operator authentication paths. No standing work grant can suppress, clear or impersonate the stop. |
| Initiated dated reminders | Purpose: initiated conversation needs outward grant; no duplicate sends | The journal's [reminder-grant consumer](../tests/preview/journal.ts) reuses the installed initiated-dated-reminders grant for that trial, surface, custodian and recovery. Setup's tool grants do not imply it. No repeat ask for each covered reminder; a missing or wider scope needs its own operator acceptance. |
| Change enforced operation definitions or safeguards | Purpose: agent cannot administer its safeguards; Rules 82/98 | [effect definition consumers](../src/effects/records.ts) decode Authorization and check its live exact base/content and approver. Retain approval for protected definition changes. Ordinary work under an accepted definition is already covered; setup does not manufacture an Authorization for these consumers. |

The retained asks above change authority, accepted limits, protected content or
the installation's lifetime. None is a new blanket permission fence. Repeated
requests are candidates for narrower standing grants under Rule 104, but this
setup's three effect kinds cannot stand in for another consumer's authority type.

Codex's configuration mapping follows the supported [MCP server configuration](https://learn.chatgpt.com/docs/extend/mcp?surface=cli)
(`command`, `args`, `env`, `cwd`). The adapter leaves the admission hook installed;
credentials still reach the server through the vault launcher, never TOML values.

## Operator-owned restoration after revocation

`setup` does not overwrite revoked choices, and `tighten` cannot widen them. To
restore authority, the installation custodian stops the runner, records the new
explicit acceptance and archives the revoked `effect-policy.json` and `mcp.json`
together outside the active root, retaining both as history. Run setup with the
newly accepted request on the same root, then merge back any previously recorded
classifications and policy-sensitive restrictions before restarting. Do not drop
those restrictions when replacing grants. Validate the resulting policy with
`decodeEffectPolicy`, refresh the applicable activation, and verify a covered
action plus an unrelated refusal. The custodian owns these policy files; the
agent must not perform this procedure as a way around revocation. Retain the
revoked pair for rollback and do not touch the journal, vault or stop state.

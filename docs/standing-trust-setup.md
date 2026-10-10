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

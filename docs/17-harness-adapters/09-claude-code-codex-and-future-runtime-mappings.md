## 9. Claude Code, Codex, native and future runtime mappings

**Rule — three workers, one conversation contract.** Rules 2/30/34/59/115;
checks P13-NF-03/07/08/43/44/45/47/48. The following are adapter obligations, not claims that an
installed vendor version supplies every witness. A missing required mechanism is a measured
implementation gap with its specific repair owner, not a brand exemption. Product conversation
and scheduling code consumes the public contract without naming any of these workers.

| Concern | Claude Code adapter | Codex adapter | Native adapter |
|---|---|---|---|
| Start and scope | Translate launch into exact executable, settings, process scope and hooks/protocol under the host boundary. | Translate launch into exact executable, configuration, sandbox and protocol under that same boundary. | Start the Instar loop as a worker using public model/tool/record ports and the same host boundary. |
| Further input | Map each current-context delivery to a correlated session input; keep CLI transport details inside the package. | Map each delivery to a correlated thread input; never infer submission from composer display or Enter timing. | Append the admitted input and current context to loop state, bound to that delivery. |
| Reply and turn end | Decode structured lifecycle and final-answer evidence or an authenticated per-turn artifact; separate hook firing from returned text. | Decode thread/turn lifecycle and final-answer evidence, including empty/malformed/partial results. | Return captured answer and explicit terminal status from the loop; a model/tool step is not the whole turn. |
| Restore | Resume only the exact retained conversation; rebuild from Instar records if unavailable or poisoned. | Resume only the exact retained thread; use the same rebuild behavior. | Rebuild loop state from the same records; no private memory or special resume authority. |
| Tools and accounts | Map the current tool catalogue and mediated account handles to supported hooks/protocol/MCP. Close built-in bypass paths physically. | Map the same catalogue and handles through its supported interfaces; close built-in bypass paths physically. | Propose through the same admission service and execute through the same bounded tool service, not in the loop's own process. |
| Metering and stop | Attribute every model attempt, including compaction and helpers; implement exact-target control. | Same semantics, preserving unavailable quota/account evidence as unknown. | Same call accounting and control; no privileged provider import or self-hosting bypass. |

**Rule — runtime knowledge has one home.** Rules 30/44/45/115;
checks P13-NF-01/03/08/45/47. Package-local drivers own flags, transcript parsing, event mapping,
launch environment and restore tokens. The native loop and the physical tool-worker bindings
ship with the product, outside `tests/preview`. The executable host injects generic file, clock,
process and transport ports at the allowed I/O boundary. Pure orchestration does no ambient I/O,
time or process discovery. Tests import the shipped implementation; they are not its owner.
The native client imports only public core ports and runs self-hosting through them.

The composition root may instantiate registered packages; it must not contain a vendor-name
switch selecting different conversation semantics. A helper called “native driver” which
actually selects a vendor is renamed or folded into the relevant adapter. Adding another
runtime means adding its package and evidence tuple, not altering the common coordinator.

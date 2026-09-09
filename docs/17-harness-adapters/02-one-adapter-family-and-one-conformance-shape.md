## 2. One adapter family and one conformance shape

**Rule — every harness implements the same four-method port shape.** Rules 30, 59, 68 and
115; **checks: P13-NF-03/04/06/07**. Each package implements the `describe`, `launch`, `deliver`,
and `observe` method set exactly as Part Ten specifies; the description's requested owner reference
is the explicit additive contract in section 1. Process stop, close, model change, account change,
compaction control, launch, and live-input delivery use the requested registered Part Eight harness-
operation payload. Those effect-positive paths are non-executable until
`seam-response-effects-payloads.md` and `seam-response-effects-followup.md` land. Reconnect and continuation ride Part
Six loops. Adding a runtime adds an adapter binding and conformance tuple, not a branch in Parts
Four through Nine. An absent capability is returned as unsupported with a stable reason. It is
never supplied by a family default or a different harness.

**Rule — supported mode is a conjunction of witnessed capabilities.** Rules 26, 34, 42, 59,
62 and 95; **checks: P13-NF-04/06/07**. `describe` reports the exact artifact digest, executable
identity, runtime and protocol versions, named platform, confinement mode, compatible input and
output modes, context-consumption witness, lifecycle witness, interruption operations, continuation
mechanism, hidden provider/tool-path posture, account and quota observability, and current
`AdapterConformance` references. The landed return fields already carry `artifact`, `platform`,
the five mode lists, and one conformance reference. The extra subjects are read only by resolving
the requested Ten-owned capability-report reference returned by `describe`; they are not informal
extra properties on a concrete adapter. Until that additive field, record decoder, and public
resolver in `design-harness-adapters-seam-request-part-ten.md` land, P13-NF-04 records the rich
description as unsupported and no governed-worker mode may activate. Governed worker mode is
supported only when every capability required by the admitted work is both declared and proved
for that exact tuple. An explicitly admitted advisory mode may lack the stronger model-context-
consumption witness and therefore may not be called a grounded governed worker. It must still
satisfy every applicable Part Eight effect, Part Six metering/recovery, credential-custody,
worker-isolation, and hidden-path confinement requirement. A mode with an unmediated provider,
tool, MCP, connector, shell, filesystem, message, credential, or other effect path is
unsupported; the advisory label grants no exception.

**Rule — parity is one suite applied to every complete tuple.** Rules 30, 34, 37, 49, 59 and 115;
**checks: P13-NF-07/08/43/44/45/47**. One contract suite takes a `HarnessAdapterPort`, the exact
harness package and artifact digest, one owner-resolved registered model doorway and route, one
platform, one capability mode, and only public core ports. It runs identical semantic cases for
every compatible complete tuple, including separate executions when one artifact/platform/mode is
compatible with more than one registered model doorway. Harness-specific fixtures may provide
protocol bytes and expected runtime events, but may not weaken the assertion. Every incompatible
combination remains enumerated with its stable unsupported reason. A family label, shared base
class, one model doorway's pass, or one mock result cannot establish parity for another complete
tuple. The landed `AdapterConformance` record and activation consumer cannot represent or enforce
that route distinction. Seven's owner-resolution arm is non-executable until
`seam-response-judgment.md` lands. The route-bound conformance and activation arms are separately
non-executable until the dated 07:52Z addendum in `seam-response-assembly-followup.md`, recorded as
GRANTED in `SEAM-LEDGER.md` row 42, lands.
After it lands, each conformance record carries the owner-resolved exact registered model-doorway
declaration and Seven's current immutable model-route selection in its logical identity. Assembly
admission re-resolves and matches those exact references to the exact currently resolved model
adapter and route selection before consuming the result.

**Rule — exact package binding prevents runtime impersonation.** Rules 44, 69 and 90;
**checks: P13-NF-05/07**. The assembly resolves the declared executable to exact bytes and object
identity before launch. The launched process and observer bind back to that artifact, platform,
adapter declaration, and `AssemblyAdmission`. PATH lookup, mutable aliases, auto-update, wrapper
fallback, and a runtime that reports another runtime's name cannot silently change the binding.
Changed bytes require a new conformance result and assembly admission for the affected scope.

---

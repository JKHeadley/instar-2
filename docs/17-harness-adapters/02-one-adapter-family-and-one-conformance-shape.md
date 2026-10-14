## 2. One adapter family and one conformance shape

**Rule — every worker implements the same versioned port.** Rules 29/30/42/59/63/68/115;
checks P13-NF-03–08/19–25/36/38. Ten owns these extensions to `HarnessAdapterPort`; the table is
a design contract, not a claim that its current TypeScript interface implements them. Methods
that touch a worker return asynchronously within a declared deadline, so a slow process probe
cannot block intake or stop. Failures preserve the original typed refusal and its input.

| Method | Request | Result and boundary |
|---|---|---|
| `describe` | Exact installed adapter artifact and route binding | Capabilities and limitations with their evidence: start, subsequent input, context delivery, output, stop, resume, compaction, tool/account mediation and metering. Describes support; grants nothing. |
| `launch` | Immutable `HarnessLaunchSpec`, admitted operation/claim, current fence, finite allocation; fresh or restore intent with optional opaque resume reference | Exact launch/incarnation observation, refusal before dispatch, or uncertainty. A restore says whether it used the vendor history or rebuilt context. Neither path automatically repeats an input. |
| `deliver` | Required immutable `ContextDeliverySpecification`, identifying conversation, candidate work, intake/digest, launch/incarnation, current context and admitted operation/claim | `accepted`, `busy-not-dispatched`, `refused-not-dispatched`, or `uncertain`, with evidence. Acceptance is a runtime input event, not model consumption or delivery to the person. |
| `observe` | Exact launch/incarnation, optional delivery, last durably recorded cursor and bounded batch size | Ordered normalized observations, next cursor, and explicit completeness/gap status. Includes reply content and turn end, not only liveness. Querying never launches, retries or kills. |
| `control` | Exact launch/incarnation, action (`interrupt`, `close`, or `compact`), reason, authority and admitted operation/claim | Observed control result, refusal or uncertainty. Stop requests use the independently authenticated local stop path; ordinary recovery and compaction use Eight/Six admission. No arbitrary command field. |

`control` makes an existing responsibility callable through the public port. It is not another
authority: the dispatcher authenticates emergency stop independently, and checks ordinary
control against the current owner and exact action. An adapter-local `stop()` or `recoverContext()`
must not be a second application entry point. Reconnect means resolving and observing the same
incarnation. Resume or rebuild creates a new launch and incarnation when it creates a process;
there is no separate resume API with different safety semantics.

**Rule — every request binds current work, not the launch's first input.** Rules 26/29/63/96;
checks P13-NF-14/17/19/20/21. The immutable launch identifies the worker and admitted environment.
Each delivery independently identifies its intake, candidate step and context manifest. It may
name a later step than the launch. Observations for that input carry that delivery reference,
not copied launch-time input fields. One active input per worker is the engineering default;
the host owns the durable queue. Input support is not an optional feature of a conforming
conversation worker. A vendor unable to continue one process can implement the same conversation
semantics by bounded, grounded replacement at a closed turn boundary.

**Rule — version negotiation does not disguise partial support.** Rules 26/30/42/44/59/115;
checks P13-NF-04/06/07/45/48. A complete tested tuple identifies adapter artifact, public port
version, runtime/protocol, platform, model doorway/route and capability mode. Install and update
resolve that tuple before use. A legacy first-input-only implementation cannot advertise this
conversation contract. Optional mechanisms such as vendor resume or in-place compaction may be
unsupported if the common grounded-rebuild path delivers the required behavior. Missing a
required floor refuses the affected operation with its constitutional source and preserves work;
calling it advisory or unconfined grants no exemption. Parity is the same suite and recorded
conversation walk run on each tuple, not a family-level claim.

## 8. Spend caps and freeze through the effect doorway

**Rule — cap authority never comes from an observational projection.** Rules 4, 26, 40, 42, 49,
82, 86 and 95; **checks: P16-NF-18/19/35/51**. Once the requested part-eight control payloads
land, the spend operation consumes the current authorized cap policy and six's current fenced
reservation/accounting state at the required durability. It does not add seven's observational
hold cost to that state and does not read a routing-spend total, quota bar, burn finding, cached
price or provider estimate as authority. Concurrent reservations remain serialized by six.
Unsettled calls retain maximum exposure. Exhausted capacity makes the paid business operation its
own part-one `Refused` with `reason: budget-exhausted`. A current freeze makes that operation
`Refused` with `reason: policy` and detail naming the freeze. Only the separate control operation
that applied the cap/freeze may return `Success`.
Their subjects and ids cannot satisfy one another.

**Rule — the paid door opens through the existing cap and freeze contract.** Rules 4, 26, 40, 42,
49, 82, 86 and 95; **checks: P16-NF-35/45/49/51**. The approved Part Eight and Part Ten designs
define no separate per-door arm/disarm operation or paid-service readiness read. This design
therefore selects the existing-contract behavior: after the independently reachable freeze check,
a current authorized positive cap means the door is open, subject to six's ordinary reservation,
fence, capacity and every other existing admission prerequisite. An absent, zero or negative cap
cannot open the door. A current freeze refuses before ordinary spend admission. No configuration
flag, constructed object, metric, stale cap, or nonexistent arm/readiness record can substitute for
those current owner-resolved inputs.

`SEAM-LEDGER.md` row 65 refuses the proposed separate activation/readiness seam as beyond the
approved owners' scope; this policy does not depend on that refusal as a grant and requires no
operation it proposed. P16-NF-35/45/49/51 now test positive-cap/not-frozen, absent-or-non-positive-
cap and frozen neighbors directly against the exact cap/freeze scope granted in
`seam-response-effects-followup.md`. Those arms remain non-executable only until that grant lands
with its real production wiring. Freeze remains checked first and independently reachable.

**Rule — changing a cap and releasing a freeze require operator authority.** Rules 4, 28, 79, 82,
89 and 98; **checks: P16-NF-35/51/52**. The action begins as an exact authorization
request through part four, completes on eleven's verified surface and executes once through
the requested part-eight payload. The rendered subject includes account or key, doorway scope, old and proposed values,
currency, time window, current base digest and consequences. Silence, chat wording, a dashboard
read, a metric threshold and a configured default are not approval. A stale base, widened scope
or replay refuses.

**Rule — freeze is a separately reachable stop effect.** Rules 15, 40, 42, 60, 77, 82 and 95;
**checks: P16-NF-35/45/51**. The requested part-eight control seam evaluates freeze before
ordinary spend admission and records the effect independently of this package's construction. If the measurement package, price join
or normal spend surface is unavailable, the registered operator stop path remains reachable.
Freeze never rewrites measurements or settlements. Unfreeze is a distinct operator-authorized
effect. An agent may invoke freeze only under an explicit, current operator-issued standing
grant owned by part one; the package never infers that grant from urgency or a threshold.

---

## 9. The guard-posture tripwire and watcher independence

**Rule — the watcher of watchers is registered and independently witnessed.** Rules 9, 26, 33,
43, 60, 69 and 73; **checks: P14-NF-06–09/16–24/48**. The tripwire compares current declared
plans, assembly inventory and fresh source execution. It detects missing enrollment, declaration/
runtime disagreement, stale or never-run arms, failed probes, unexpected dry-run, unexpected
activation and loss of its own observer. Its own plan is load-bearing, has an out-of-process witness,
and cannot mark itself `on-confirmed`. Observer loss preserves the last confirmed horizon and opens
an owned gap; it never reports an empty green inventory.

**Rule — baselines cannot bless disappearance.** Rules 24, 26, 32, 33, 42, 43, 45 and 90;
**checks: P14-NF-17–21/48**. A corrupt or absent snapshot, new inventory key, machine rename,
restart, config rewrite or manifest change cannot silently become the new healthy baseline.
Reconstruction comes from signed history and current assembly. A changed generation reopens proof.
The alert/disposition is durably accepted before any baseline advances. Cross-machine aggregation
preserves contradictory heads and per-machine ages. Another machine's healthy arm cannot cover a
missing machine-bound instance. A genuinely shared service is enrolled as its own instance with a
separate `VerificationPlan`, binding, governed subject and independent witness. Evidence for that
shared subject satisfies only the shared-service obligation; it does not satisfy or erase an
absent local instance.

**Rule — temporal posture instability is separate from current raw posture.** Rules 9, 24, 26,
43, 58, 69 and 70; **checks: P14-NF-14/20/48/65**. **Transition instability** means more than three
changes of the raw Part Nine posture signature between adjacent eligible observations in the most
recent ten plan-scheduled ticks for one exact plan, generation and instance. The signature is an
ordered sequence of tuples, one for every arm in the exact `VerificationPlan.arms` order. Each tuple
contains only the arm id, `sourceStatus` and arm `posture`, followed by the overall
`GuardPostureView.posture`. Equality excludes `lastAttempt`, `lastSuccess`, `evaluatedAt` and every
other evidence or evaluation-time reference. Those excluded references remain evidence attached to
the observation. Missing, wrong-generation or incomparable observations are gaps, not invented
transitions. The tripwire's
named `retrospective` arm derives this temporal finding from the sequence of independently recorded
Nine observations and records the source references in its own `ProbeRecord` evidence. It does not
add a flapping label to `GuardPosture`, rewrite any source view or replace the current raw posture.
Four transitions within the ten-tick window open an instability finding even if the last raw posture
is `healthy`; three transitions are the stable-boundary neighbor and open none. A full ten-tick
unchanged signature is the stable-state neighbor. Its positive fixture uses ten distinct fresh,
successful executions: `lastAttempt`, `lastSuccess` and `evaluatedAt` change on every tick while all
arm ids, `sourceStatus` values, arm postures and overall posture stay equal. That sequence has zero
transitions. Window expiry, generation change and missing samples are explicit in the retrospective
evidence, and a later stable window disposes the temporal finding without rewriting its original
record.

---

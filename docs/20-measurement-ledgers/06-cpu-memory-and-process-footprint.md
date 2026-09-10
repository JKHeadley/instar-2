## 6. CPU, memory and process footprint

**Rule — resource samples identify the machine and process incarnation.** Rules 13, 26, 32, 39,
58 and 113; **checks: P16-NF-24–29**. Central processing unit (CPU) time is measured as process
CPU consumed across a recorded monotonic wall interval. Any displayed CPU percentage states
whether 100% means one core or the whole named machine. Resident set size (RSS) is bytes observed
by the registered operating-system (OS) adapter. Each interval or point has a source sample
identity in addition to the process incarnation, so successive observations remain distinct.
Heap is the runtime-managed memory area and is reported only for a process whose runtime exposes
it; it is not substituted for RSS. A PID is joined to a process-incarnation identity,
start evidence and owning run; PID reuse cannot join a new process to an old run. Dead or
unreadable processes are missing samples, not zero CPU or zero memory.

The production source is Ten's owner-decoded process inventory, not a private shell call or a
caller-filled `GrowthObservation`. Its process-inventory addendum in
`seam-response-assembly-followup.md` is GRANTED CONDITIONAL, tracked in `SEAM-LEDGER.md` row 40,
and may be built only after docs/18 approval. That grant supplies a pinned complete/partial/failed
process census, but its phrase `resource observations` does not name the CPU interval and RSS point
contract above. `design-measurement-ledgers-seam-request-resource-observation.md` requests that
narrow owner addition and is not granted. The real-producer arms of P16-NF-24/49 remain
non-executable until that request receives a named Part Ten grant and GRANTED/BUILT
`SEAM-LEDGER.md` row, the granted additive contract and the conditional process-inventory contract
land, and `seam-response-intake-followup.md` lands. Pure arithmetic, missing-state,
classification and trend fixtures may use owner-shaped decoded test inputs without claiming the
production observer exists.

**Rule — the sampler has bounded work and measures its own footprint.** Rules 39, 55, 60 and 86;
**checks: P16-NF-24/27/29/43/46/49**. Once the named Ten producer lands, one tick has finite process,
byte, duration and concurrency limits.
Process reads are batched where the platform permits it. An over-limit census produces an
explicit truncated sample with examined and omitted counts. Ticks do not overlap. Idle cadence,
active cadence and retry backoff are six-owned loop policy. Scan CPU, memory, process creation,
duration, lag and failures are recorded under the holder's own subject so observation cost cannot
disappear from totals.

**Rule — footprint classification is registered and loss-aware.** Rules 26, 39, 58, 69 and 86;
**checks: P16-NF-26/28/29**. Process classes such as agent worker, model adapter, channel adapter
and external tool host are registered matching rules with conformance fixtures. The durable fact
contains class counts and RSS, not command lines, prompts, environment values or secrets.
Unmatched relevant processes remain `unclassified` with a count. A trend is derived only from a
declared complete sample window; missing ticks, classifier-generation changes or a machine change
break comparability and are shown rather than interpolated away.

**Rule — resource alerts are signals and cleanup remains elsewhere.** Rules 24, 41, 60 and 86;
**checks: P16-NF-29/33–35/51**. A footprint threshold or rising trend may create a nine-owned
finding with episode deduplication and measured entry/exit conditions. It cannot kill a process,
reap a session, deny a spawn or load/unload an adapter. Any proposed cleanup enters part four and
is classified and executed through part eight under the standing of its requester.

---

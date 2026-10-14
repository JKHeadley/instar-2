## 6. Resume, continuation, and compaction

**Rule — four cases have distinct evidence.** Rules 26/47/63/68/96/110;
checks P13-NF-25–28/38/49/50/52.

| Case | Identity and required action |
|---|---|
| Reconnect to a live worker | Retain launch/incarnation only after proving its exact local start identity and current fence. Resume observation from the durable cursor; refresh current context before further work. |
| Resume a saved vendor conversation | New process means new launch/incarnation. The opaque resume token accelerates history loading; current history, clock, grants, directives and pending work still come from Instar. |
| Rebuild without vendor history | New launch/incarnation, same durable conversation and work. Use current Instar history/summaries and unresolved effects. No unavailable token or transcript is a reason to lose the conversation. |
| Compaction in a surviving process | Keep launch/incarnation, record a new context boundary and delivery. Reinject the same governing classes with current values before ordinary action. |

**Rule — rebuild is the common recovery behavior.** Rules 47/55/59/61/68/96;
checks P13-NF-25/26/28/35/38/51/52. Vendor resume and in-place compaction are optional
optimizations. Use a known-good resume only when current evidence supports it. At observed
context exhaustion, prefer a supported in-place compaction, then rebuild if it fails, times out
or is unavailable. Confirmed poisoned vendor history is not resumed. Recovery retains original
input and effect identities; it does not replay completed or uncertain tool/send operations.
A new attempt needs the owning service's proof of non-occurrence, quiescence and charge closure,
not just a missing worker. If those cannot be established, preserve the pending work and honest
uncertainty while the conversation remains reachable.

**Rule — context loss is visible and accounted for.** Rules 47/68/96/110;
checks P13-NF-26/27/49/50. Five owns history coverage and `ContinuityAccounting`. Ten's delivered
manifest names full history below the threshold or current covered summaries plus the complete
recent suffix. Missing ranges, stale summary boundaries and ambiguous multi-lineage order are
reported to that owner; no adapter substitutes a transcript skim. After compaction the first
reply discloses it and accounts for the last pre-pause input as addressed, superseded or pending.
Disclosure is not a comprehension test. Awareness regenerates identity, rules, capabilities and
work context; the adapter proves delivery, not an instruction to remember to read later.

**Rule — local recovery cannot invent remote ownership.** Rules 31/32/63/113/114;
checks P13-NF-25/38/49. One machine uses its existing local authority and installed durability
profile; no peer is required for permitted local work. When placement moves, Six must first
establish the successor's authority and exclude stale dispatch. The successor rebuilds from
shared owner history, never from another machine's process handle. A partitioned old process
cannot use an obsolete fence to call a tool or send. Unknown old effects remain pending even if
a new worker is admitted for other work. Adding a peer retains the configured replication demand;
losing it does not silently lower that demand.

**Value — preventive compaction is an optional optimization.** It needs a trustworthy
exact-worker pressure observation, a safe boundary and a finite control budget. A pane percentage
or idle-looking screen is only a signal. A tuple lacking that observation uses measured ordinary
exhaustion and the rebuild path; it is not barred from conversation. No new pressure authority
or automatic threshold service is needed to ship the common contract.

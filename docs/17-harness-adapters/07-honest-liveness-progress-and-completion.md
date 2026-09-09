## 7. Honest liveness, progress, and completion

**Rule — liveness, progress, and completion are different predicates.** Rules 26, 39, 59, 62
and 68; **checks: P13-NF-29/30/31/32/33**. Liveness requires fresh proof that the bound process
incarnation or runtime protocol endpoint is running. A **work-progress transition** is an admitted
change in an existing owner record that moves the exact `RunStep`, Seven model attempt, Eight
operation, or bounded output stream from its previously recorded work state to a later work-
bearing state. Its deduplication identity is the owning logical subject plus predecessor, phase,
or contiguous output range and content digest; a fresh adapter event id is never that identity.
Progress requires such a transition and records it once against the exact step. A heartbeat,
repeated health or liveness observation, unchanged phase, duplicate output, republication of the
same range, and event-id churn prove no progress. Turn completion requires a correlated harness
lifecycle event plus closure or explicit pending status for its streams and admitted child
operations. Run completion remains Part Five's accepted `RunTransition` and `RunExit`. No one
predicate substitutes for another.

**Rule — pane narration is diagnostic only.** Rules 26, 39, 62 and 95; **checks:
P13-NF-29/30/31/32**. Prompt glyphs, spinners, status footers, model labels, rendered acknowledgments,
completion phrases, terminal silence, scrollback changes, and terminal disappearance may be
captured for an operator or diagnosis. They cannot prove readiness, input consumption, model
selection, useful work, operator action, compaction completion, or success. PTY transport remains
eligible only when a separate structured, correlated witness proves the required state. An
unreadable witness yields unknown and follows the owning operation's safe failure direction.

**Rule — output is a bounded captured observation.** Rules 26, 36, 39, 42 and 69; **checks:
P13-NF-31/32/34**. The observer binds ordered output chunks, final output when present, runtime
event ids, byte counts, truncation, malformed or partial state, source clock, and capture digest to
the launch and step. Duplicate chunks do not become new progress. A partial stream, late event,
parser failure, lost final marker, or output after local disconnect remains visible and cannot be
promoted to a complete `Result` by the adapter. Part Five and Nine decide whether the evidence is
adequate for acceptance and verification.

**Rule — process exit is an observation, never a success mapping.** Rules 26, 59, 68 and 95;
**checks: P13-NF-32/33/38**. Exit evidence records the exact incarnation, exit source, status when
available, last correlated event, unresolved operations, and observation horizon. Exit zero,
terminal closure, a generated final sentence, or a runtime's own success label does not complete
the run. A missing process can mean clean exit, crash, eviction, kill, disconnection, or probe
failure; the adapter reports only what its source proves.

---

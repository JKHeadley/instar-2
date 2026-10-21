# Change review — walk-fix-memorylist: memoryList instruction names its consequence

Subject base: e44d3ce1985cc2e47620541d55ab03ae0bba8f8b
Review state: open
Reviewed content: none
Outcome: the answer guidance now says memoryList:true swaps the reply for the raw saved list and is not for a shaped ask (walk-24 run B msg 24).
Affected rules: 3, 10, 12, 74, 106, 113, 116
Affected floors: secrets — unchanged; spend cap — one byte shorter than the old sentence, packet floor and capped-packet tests green; stop — unchanged; no duplicate sends — unchanged; durable intake — unchanged
Operator questions: none
Suggested tier: critical
Declared tier: significant
Tier rationale: model-facing instruction change at a zero-slack packet floor.
Side effects: a model that previously set memoryList for a shaped memory question should answer in reply instead; the runner's list path is unchanged for a plain list request.
Undo and recovery: revert the commit; the old sentence returns.
Multi-machine posture: machine-local prompt text.
Layer below: inspected the runner's memoryList replacement (unchanged, still guarded by operator origin, probe, lookup and validity) and the default-context-floor measurement.
Bug class: none
Bug evidence: none
Hook bypass: none
Convergence: none
Decision: memorylist-prompt-only | keep the host's list path as the hallucination guard and narrow when the model asks for it; a 47-byte wording was dropped after it made Sonnet set the flag on run B's recorded input | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/walk-findings-1020-PROGRESS.md
Prompt review: model-facing; no in-tree reproducer (a stub cannot reproduce a model choosing the flag), evidence is the replay below. Replayed recorded msg-24 inputs (run A update 6235088, run B update 6235112) per-call on the proof account with claude-sonnet-5: old sentence 0/2 on B; a 56-byte draft 0/2 on B (dropped: +5 bytes displaced items in zero-slack packet tests); committed 50-byte sentence 0/2 on B; A 0/1 each. The Fable shape that produced the miss could not be replayed (provider refused the per-call replay); the fix is unproven on that shape.
Prompt finding: 4106b49fff07 | protocol-literal | existing tool-attempt honesty guidance in journal.ts, unchanged by this unit.
Prompt finding: 849db3a6296a | protocol-literal | existing saved-memory response contract in journal.ts, unchanged by this unit.
Prompt finding: e8708c7fea24 | protocol-literal | existing source-label and uncertainty guidance in journal.ts, unchanged by this unit.

Subject (1 paths): tests/preview/journal.ts

## Closing block

simplestRobustRoute: one sentence in the existing guidance at the same floor. A host-side override of the list would remove the guard the list exists for.
80/20: the completed requests still shown in the list (msg 24) are left for a separate unit.
VERDICT: author submission; this record asserts no independent verdict — the review desk records its own

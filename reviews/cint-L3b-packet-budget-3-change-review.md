# Change review — cint-L3b pipeline repair 3: per-turn self-state brief, desk report yields under byte pressure

Subject base: eb85b98691eaa02bb1ff6ae76c1d98f71ac6e29a
Review state: open
Reviewed content: none
Outcome: Following the desk decision, each turn's packet now carries a self-state brief (selfStateBrief). It keeps the facts a reply must not contradict: the local clock and "today", message and reply counts, each limit's use (with exhausted limits named), raised caps, the stop or trial end, one line of open obligation counts (held replies, requested actions, UNKNOWN calls and sends, summaries in flight, memory corrections), memory's audit-record fact, and run history. Memory health, tokens, failure classes, hold reasons and retrospective detail stay in the read-only status record, which the brief names. The brief and status share one computation (stateFacts, runLines), so they cannot disagree. The desk report declares yieldBytes 512: under byte pressure the packet cuts it, labelled with where the full report is, before the obligation guide or any history yields, and the summary trigger measures the cut form. The reply-protocol guidance, the pinned purpose excerpts, the review headroom and the bound are unchanged. Measured on the real launcher (285-character live-shaped first message, missing desk report, no history), the first turn prepares 19459 bytes, down from 20940, so 2078 bytes remain for history against the 4096 target. In a 10-turn run, turns 4 to 6 keep 3 to 5 prior turns verbatim, but turns 7 to 10 keep none: the rolling summary has taken every earlier turn, and recalled summarized turns fill the room. The target is not met; the numbers are reported to the desk.
Affected rules: 2, 8, 13, 15, 42, 47, 68, 74, 83, 96, 110, 116
Affected floors: secrets — unchanged, redaction applies to the brief's authority text and the cut desk report; spend cap — unchanged, the brief names an exhausted limit and no bound changes; stop — unchanged, the brief states a latched stop; no duplicate sends — unchanged; durable intake — unchanged
Operator questions: (1) the packet budget: after the self-state brief and the desk yield, the live-shaped first turn leaves 2078 bytes for history, not 4096. The remaining fixed sources are the capability note (2864 JSON bytes), the pinned purpose excerpts (2946), the reply-protocol guidance (obligationDecision 1142, datedDecision 1004, capability 833, governingConstraints 345), working-disciplines (534), concurrentWork (520) and the brief itself (1412). (2) The 10-turn target: once the rolling summary starts (45% of the packet bound), it summarizes through the latest turn, so no verbatim tail remains whatever the source bytes. Keeping the last 3 turns needs a decision about that summary policy, the guidance, the bound or the headroom.
Suggested tier: critical
Declared tier: critical
Tier rationale: every live packet's self-state and desk report change, and the prompt admission order gains the desk cut
Side effects: every live packet carries the shorter self-state; a long desk report is cut under pressure where it previously displaced history or held the reply
Undo and recovery: revert these commits; nothing durable changes format
Multi-machine posture: machine-local, as before
Layer below: docs/00-the-purpose.md and docs/01-the-rules.md (read in full); tests/preview/journal.ts prompt admission, variant order and summary trigger; tests/preview/journal-agent.mjs turnSources and the read-only status; tests/preview/status-command.ts (the chat status reply does not carry the self-state detail, so the brief points to the runner's status record instead)
Bug class: integration
Bug evidence: reproducer=tests/preview/journal-awareness.test.ts
Hook bypass: none
Convergence: none
Prompt review: the self-state source text is shorter and its preface keeps the same instruction; the desk report gains a labelled cut form; no protocol, system prompt or provider policy changed
Prompt finding: 849db3a6296a | protocol-literal | an existing fixed reply literal in journal.ts, unchanged by this change
Prompt finding: bd01de21286a | protocol-literal | existing capability-guidance wording in journal.ts, unchanged by this change
Prompt finding: fb5fa7e706c8 | protocol-literal | existing capability-guidance wording in journal.ts, unchanged by this change

## Closing block

simplestRobustRoute: The required outcome is a smaller per-turn state that still states every fact a reply could contradict, plus a desk report that gives way before history. The route is one brief function over the existing counts, and a declared byte bound that the existing variant loop applies before its existing guide yield. The only added mechanism is the yieldBytes cut. It prevents a named failure: a live desk report of up to 4096 bytes displacing conversation history or holding the reply. The shared stateFacts helper prevents the brief and status from drifting apart.
80/20: tsc, the architecture check, change-review check and every touched test file pass on this machine; lint and register:check report only the source pin trail that the desk's register step regenerates; the full suite runs at the gate.
VERDICT: author submission; the independent verdict is pending

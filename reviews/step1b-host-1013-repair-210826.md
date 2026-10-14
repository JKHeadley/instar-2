# Change review — collect continuing-host results and preserve parent bounds

Subject base: 5b1de41088a1b6b5d983ac4a658de399fe6ecbe2
Review state: open
Reviewed content: none
Outcome: Connect durable deferred host results to the existing journal answer and send consumer; preserve the earlier parent lifetime on restart; stop duplicating completed answer bodies in later grounding.
Affected rules: Rules 1, 2, 7, 26, 33, 34, 36, 37, 42, 45, 46, 49, 55, 60, 68, 70, 74, 75, 96, 101, 102, 113, 114, 116.
Affected floors: secrets — existing encrypted custody, disclosure and outbound credential checks remain; spend cap — collection neither reserves nor forwards a call and the recorded parent deadline still gates charging; stop — normal journal and host stop gates remain; no duplicate sends — the existing journal intent remains the only sender and uncertain dispatched input is never replayed; durable intake — original request, reply, cursor and full outcome records stay in the existing store.
Operator questions: none
Suggested tier: critical
Declared tier: critical
Tier rationale: Repairs the durable result return boundary and inherited resource lifetime of an admitted tool-bearing worker.
Side effects: A queued host result leaves its existing journal reservation open until the normal tick can collect it. Unknown or unreadable custody never authorizes another dispatch. Collection uses the original packet; a newer format/lookup reservation cannot consume an older host result. Prior completed answer bodies now come only from the existing bounded journal history/summary packet. The additional projection carries the count and latest 64 unresolved operation references; no durable record is trimmed. No schema change, sender or second queue is introduced.
Undo and recovery: Revert this repair's source changes while retaining all journal and encrypted host records. No cleanup of saved state is required. Already-sent uncertainty notices from older versions are not rewritten or automatically resent. Restore this repair before expecting queued results to be collected.
Multi-machine posture: Machine-local host custody and process handles remain under the existing conversation ownership fence. The journal consumer reads the current owner's host result by exact operation and packet, not a remote process handle. No ownership or replication policy is changed.
Layer below: Inspected the public adapter's reply/turn-end correlation, encrypted host store, journal reserve/answer/intent projections, ordinary maintain-before-drain tick, and cumulative admission charging. Reused those boundaries rather than adding dispatch or publication paths.
Bug class: durability
Bug evidence: reproducer=tests/assembly/production-conversation-session.test.ts; restart=tests/preview/journal-conversation-session.test.ts
Hook bypass: none; git config --get core.hooksPath was unset and the common hooks directory contained sample files only.
Convergence: none
Prompt review: Only the redundant host-history supplement changes: bounded unresolved identity references replace duplicated full answers. The journal's prepared packet and summaries are retained. The existing readAnswer decoder is shared by initial completion and collection with the same failure handling. Recorded answer frames 404 and 595 and archived summary/Jev/review/delivered/empty-context shapes are replayed; no keyword judgment or new model instruction gate is introduced.
Decision: step1b-repair-result-route | Declare the host/journal agreement and collect the host result by original operation and exact prepared packet into the existing reserved journal consumer, without redispatch, recharging or a second sender. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/step1b-host-1013-repair-210826-PROGRESS.md
Decision: step1b-repair-parent-deadline | Use min(persisted parent deadline, current admitted deadline) for availability, charging, work, maintenance and replacement children; configuration cannot extend inherited lifetime. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/step1b-host-1013-repair-210826-PROGRESS.md
Decision: step1b-repair-grounding | Reuse bounded journal history and summaries, supplement only the count and latest 64 unresolved references, and retain every full host outcome. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/step1b-host-1013-repair-210826-PROGRESS.md
Prompt finding: 849db3a6296a | protocol-literal | Existing memory-list and recall-source protocol text in the shared journal; this repair does not change either instruction.
Prompt finding: e8708c7fea24 | protocol-literal | Existing memory-list and recall-source protocol text in the shared journal; this repair does not change either instruction.
Deferral: tests/preview/journal-conversation-session.test.ts:206 | not-a-deferral=Executable queued-completion regression name or variable; no work is promised for later.
Deferral: tests/preview/journal-conversation-session.test.ts:239 | not-a-deferral=Executable queued-completion regression name or variable; no work is promised for later.
Deferral: tests/preview/journal-conversation-session.test.ts:241 | not-a-deferral=Executable queued-completion regression name or variable; no work is promised for later.
Deferral: tests/preview/journal-conversation-session.test.ts:243 | not-a-deferral=Executable queued-completion regression name or variable; no work is promised for later.
Deferral: tests/preview/journal-conversation-session.test.ts:245 | not-a-deferral=Executable queued-completion regression name or variable; no work is promised for later.
Deferral: tests/preview/journal-conversation-session.test.ts:246 | not-a-deferral=Executable queued-completion regression name or variable; no work is promised for later.
Deferral: tests/preview/journal-conversation-session.test.ts:247 | not-a-deferral=Executable queued-completion regression name or variable; no work is promised for later.
Deferral: tests/preview/journal-conversation-session.test.ts:248 | not-a-deferral=Executable queued-completion regression name or variable; no work is promised for later.
Deferral: tests/preview/journal-conversation-session.test.ts:249 | not-a-deferral=Executable queued-completion regression name or variable; no work is promised for later.
Deferral: tests/preview/journal-conversation-session.test.ts:250 | not-a-deferral=Executable queued-completion regression name or variable; no work is promised for later.
Deferral: tests/preview/journal-conversation-session.test.ts:251 | not-a-deferral=Executable queued-completion regression name or variable; no work is promised for later.
Deferral: tests/preview/journal-conversation-session.test.ts:252 | not-a-deferral=Executable queued-completion regression name or variable; no work is promised for later.
Deferral: tests/preview/journal-conversation-session.test.ts:253 | not-a-deferral=Executable queued-completion regression name or variable; no work is promised for later.
Deferral: tests/preview/journal-conversation-session.test.ts:254 | not-a-deferral=Executable queued-completion regression name or variable; no work is promised for later.
Deferral: tests/preview/journal-conversation-session.test.ts:259 | not-a-deferral=Executable queued-completion regression name or variable; no work is promised for later.

Decision: step1b-repair-generated-wiring | Run the delegated desk tools and regenerate source wiring from the committed tree; the inherited public contracts pin is refreshed by the supplied chain script, never hand-edited. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/step1b-host-1013-repair-210826-PROGRESS.md

Generated register: Regenerated with the delegated desk scripts and build-register replay; source roster and grounding inventory pins track this branch. No runtime certificate is inferred from replay.

simplestRobustRoute: This is the simplest route: read the one existing durable host outcome into the one existing journal answer/send consumer; take the earlier existing lifetime; reuse the journal grounding already prepared. The optional collector prevents a demonstrated lost-result boundary without new stores or dispatch. Original operation and packet bind recovery; stop, disclosure, allowance and send-intent checks remain. Targeted shipped-closure tests with physical IO substituted demonstrate unattended completion; no live installation certificate is claimed.
80/20: Repair the three demonstrated failures and prove their positive and negative neighbors with targeted tests and archived shapes. The Studio owns the full suite, live copy walk and macOS conformance proof.
VERDICT: author submission for the desk gate; no independent convergence or production-readiness claim

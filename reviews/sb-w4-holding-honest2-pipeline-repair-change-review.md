# Change review — synchronize interrupted obligation test with provider entry

Subject base: d2318c79155169f86889fae906ce155dd6431e1b
Review state: open
Reviewed content: none
Outcome: The waiting-work restart proof waits for the provider callback before simulating a crash, preserving its durable-start assertion and every ownership, recovery and delivery assertion.
Affected rules: 8, 22, 26, 37, 64, 68, 70, 74, 92, 101, 111, 113, 116
Affected floors: secrets — unchanged; spend cap — unchanged; stop — unchanged; no duplicate sends — UNKNOWN and receipt assertions retained; durable intake — durable start and restart replay assertions retained
Operator questions: none
Suggested tier: ordinary
Declared tier: ordinary
Tier rationale: test synchronization only, with no runtime or model-facing change
Side effects: the test now waits for actual provider entry rather than a preceding reservation; its unresolved provider still represents the interrupted process. No production effects or new dependencies. The delegated desk scripts refresh the touched test's existing owner-reference source pin; generated register metadata is replayed from the repair commit.
Undo and recovery: revert this repair commit; this restores the failing test timing assumption without changing runtime state.
Multi-machine posture: machine-local test coordination only; the durable journal replay and ownership semantics remain exercised unchanged.
Layer below: inspected createJournalWorker guarded/requireDisclosure and workObligations reservation/dispatch ordering in tests/preview/journal.ts. The reservation is synchronous and the disclosure guard yields before the provider callback.
Bug class: integration
Bug evidence: reproducer=tests/preview/journal-obligations.test.ts
Hook bypass: none
Convergence: none
Decision: obligation-provider-entry | synchronize on the existing provider callback rather than polling a prior durable event; retain durable start as a separate assertion | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/sb-w4-holding-honest2-repair-PROGRESS.md

## Closing block

simplestRobustRoute: one test-local promise resolves when the hanging provider is entered. This is the simplest robust route: it preserves the asynchronous safeguard, confirms the intended crash boundary, and leaves runtime ability and floors unchanged. Start guard is provider entry plus durable reservation; end-state is replayed ownership, bounded revisit and receipt-confirmed delivery; existing stop, allowance and UNKNOWN non-repetition tests remain intact. No autonomous runtime completion is newly claimed.
80/20: exact isolated failure reproduced before the fix; the touched file and cheap gates provide repair evidence. Full-suite verification belongs to the automatic post-push pipeline.
VERDICT: author submission; this record asserts no independent verdict — the review desk records its own

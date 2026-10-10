# Change review — Keep uncarried roots' memory guidance byte-identical

Subject base: bbb48114bd0cd7b9bd2cd02d17ac5dac2d5b4a03
Review state: open
Reviewed content: none
Outcome: A root without a group carry builds exactly the packet it built before the carry unit (no added memory-guidance bytes), while a carried root still tells its model that predecessorMemory entries are valid correction sources; the macOS-only test list names the carry CLI test the detector finds.
Affected rules: 7, 11, 12, 34, 37, 41, 49, 57, 74, 111, 113, 116; purpose constraint 2
Affected floors: secrets — unchanged, no disclosure path touched; spend cap — unchanged, smaller packets for uncarried roots only; stop — unchanged; no duplicate sends — unchanged; durable intake — unchanged
Operator questions: none
Suggested tier: standard
Declared tier: standard
Tier rationale: A prompt-text gating repair restoring prior bytes for every uncarried root; carried roots keep the reviewed guidance.
Side effects: MEMORY_ITEM_SHAPE returns to its pre-carry text. The carried-source clause moves to CARRIED_MEMORY_ITEM_SOURCE and is appended to memoryDecision only when journal.view.groupCarry is present, so the compact operator packet regains 46 bytes of headroom and the pinned 2000-turn recall packet digest matches again. Carried roots see the same instruction as one appended sentence instead of two inline clauses; the validator that accepts carried sources is unchanged. The macOS-only list gains tests/preview/group-carry-cli.test.ts, which gates on darwin; the detector is not loosened.
Undo and recovery: Revert the commit; no stored frame, journal generation or durable state changes.
Multi-machine posture: Machine-local packet construction only; no store, owner or replication change.
Layer below: Packet assembly in tests/preview/journal.ts (memoryDecision), byte-budget fallback ordering, the memory-item validator's accepted sources, and the platform split list's detector.
Bug class: logic
Bug evidence: reproducer=tests/preview/journal.test.ts; restart=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/sb-w4-group-carry2-PROGRESS.md
Hook bypass: none
Convergence: none
Prompt review: Model-facing guidance text changed. Uncarried roots receive the pre-carry bytes exactly (recall-latency packet digest pin matches). Carried roots replay the real proof-room capture (updates 715672479–715672500, including uncertain summaries, Jev unsure/unavailable, reply reviews and delivery) and the held recorded answer 715672480 through group-carry.test.ts and group-carry-requests.test.ts; a new two-sided test asserts the clause appears only for a carried root, and a mutation making it unconditional fails both that test and the overflow bound.

## Closing block

simplestRobustRoute: Gate one sentence on the existing groupCarry view field instead of widening shared guidance; this is the simplest route and adds no machinery. Start guard is the presence of a carry; end state is byte-identical uncarried packets; limit guard is the existing compact-packet bound.
80/20: Typecheck and architecture pass; the five failing files, recall-latency, carry and related journal/memory/recall/group/default-root/minimal preview tests (111 files, 968 tests) pass. The full suite is the pipeline's gate.
VERDICT: author submission; this record asserts no independent verdict — the review desk records its own

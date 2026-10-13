# Change review — train-20 acknowledgement assertions

Subject base: bd69c83d3a0a9cc3cb30ff98d414775ce64a74fa
Review state: open
Reviewed content: none
Outcome: The resource and two-machine regression tests recognize the reviewed working and queued acknowledgements and verify the seven-second deadline.
Affected rules: Rules 26, 31, 37, 49, 52, 63, 70, 74, 87, 101, 102, 111, 113, 116.
Affected floors: secrets — retained custody and outbound assertions; spend cap — unchanged runtime reservations and caps; stop — retained two-machine stop checks; no duplicate sends — exact notice counts, reply targets and final answer counts retained; durable intake — unchanged real journal intake and replicated delivery.
Operator questions: none
Suggested tier: ordinary
Declared tier: ordinary
Tier rationale: Test-only repair of stale acknowledgement expectations; no runtime, authority, prompt, parser, journal schema or capability changes.
Side effects: Resource fixture now holds the model pending at seven seconds as the worker does, including both threshold neighbors. Assertions distinguish active and queued requests by exact reply target, ignoring irrelevant HTTP completion ordering. Two-machine tests still require replication before either send and exactly one acknowledgement and answer after recovery.
Undo and recovery: Revert these two test changes and this record together; no runtime state or recovery behavior changes. Reverting restores stale assertions, not an older runtime.
Multi-machine posture: Verification-only; the real two-runner test retains replicated(1), owner-only effects, stop propagation and no-local-fallback assertions. No new machine-local state.
Layer below: Read journal.ts acknowledgement deadline, active/queued selection, admission recheck and historical-template replay; inspected resource fixture fake clock and real HTTP capture, two-machine runner and authority fixture, and the earlier ack-timing review. The gate excerpt counts only obsolete text despite the new worker templates.
Bug class: integration
Bug evidence: reproducer=tests/preview/journal-agent-resources.test.ts
Hook bypass: none; core.hooksPath is unset and the common hooks directory has sample files only.
Convergence: none
Decision: train-20-repair-140439-assertions | Repair stale consumers of the reviewed acknowledgement contract; retain exact counts, targets, no-duplicate and replication checks, and add fake-clock cases at 6999 and 7000 ms. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-20-repair-140439-PROGRESS.md
Verification: Targeted and cheap-check outcomes are recorded in the local handoff report. Studio runs the full suite; this submission claims no fresh full-suite or live-user acceptance.

## Closing block

simplestRobustRoute: This is the simplest robust route: correct the two obsolete test expectations and exercise the existing fake clock at the current deadline. No new mechanism is needed. Existing admission, stop, ownership, caps, one-notice budget and UNKNOWN fences remain unchanged; final answers and exact delivery counts remain the end checks. No autonomous-completion claim is made.
80/20: Repair the two named failing consumers only; retain unrelated host-dependent startup evidence for the Studio gate instead of expanding this repair into platform work.
VERDICT: author submission; independent judgment belongs to the review desk

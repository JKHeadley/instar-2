# Change review — include Rule 87 in briefing parity assertions

Subject base: 355e9315b749b451f6f254b29ba8ee0b45516f98
Review state: open
Reviewed content: none
Outcome: Bring the capability briefing's exact source-list expectation up to date and assert that Rule 87 also survives commitment-driven compaction.
Affected rules: 34, 37, 47, 74, 84, 87, 101, 102, 111, 113, 116.
Affected floors: secrets — unchanged; spend cap — unchanged; stop — unchanged; no duplicate sends — unchanged; durable intake — unchanged. Tests only.
Operator questions: none
Suggested tier: ordinary
Declared tier: ordinary
Tier rationale: Two test assertions for the already merged constitutional source; no runtime or prompt change.
Side effects: A dropped Rule 87 excerpt now fails the compaction parity test. Other source identity and exact text checks remain.
Undo and recovery: Revert these assertion changes; no runtime state or migration is involved.
Multi-machine posture: Repository tests are identical on every host; no machine state or replication code changes.
Layer below: Read sourcePacket's selected excerpts and journal-commitments' purpose/capability filter. Extended that filter to include the governed rule before asserting the same source survives compaction.
Bug class: none
Bug evidence: none
Hook bypass: none
Convergence: none
Decision: jev-repair-source-consumers | Update the stale capability list and include Rule 87 in the lasting-source filter and expectation, so constitutional parity is actually tested. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/sb-jev-retry2-1011-repair-010252-PROGRESS.md

## Closing block

simplestRobustRoute: Update the two existing consumer assertions and include the new excerpt in the existing parity filter. No new test framework or runtime mechanism is needed.
80/20: The pinned gate exposed one stale list; searching the exact old list identified the related parity filter. Verify both consumers with targeted files.
VERDICT: author submission; independent convergence is not claimed

# Change review — recovery of dead launch reservations

Subject base: c4ac82ee82df5988a9a3522752a96272b00d4a62
Review state: open
Reviewed content: none
Outcome: Ordinary settlement and a restarted owner can return dead launch reservations when more than 64 unrelated processes exist, while retaining a reservation if a possible worker cannot be inspected.
Affected rules: 60, 61, 49, 74, 101, 112, 113
Affected carryover rows: 21, 47, 50
Affected floors: secrets — recovery reads process IDs and cwd only; spend cap — unchanged; stop — unchanged; no duplicate sends — unchanged; durable intake — unchanged.
Operator questions: none
Suggested tier: critical
Declared tier: critical
Tier rationale: Host resource accounting and process membership are on the live trust path. Require exact-head full suite and independent review.
Side effects: At launch settlement and restart recovery, the owner asks passwordless sudo to run read-only lsof over candidate PIDs. If that fails, it falls back to the existing unprivileged read; any uncertain member keeps its reservation. The ordinary one-second sample retains its 64-candidate bound. Recovery signals no process; ordinary settlement retains its existing owned-member termination behavior.
Undo and recovery: Revert this commit before a new switch. Existing undecidable rows stay in the ledger and their Six debits stay reserved. A verified-gone row closes through the existing settlement API exactly once.
Multi-machine posture: Host-local process census and Six facts stay on the machine that owns the runner. No remote state or shared credential changes.
Layer below: Ordinary cleanup could leave a ledger row and Six debit unresolved when its 64-candidate live-sampling budget yielded a partial result; recover() then inherited the same budget and also failed to return it. Nine open sets filled the installation. Settlement and recovery now check up to the existing complete census bound and use a read-only privileged cwd query for the separate harness account. Live one-second sampling remains bounded at 64. A failed or incomplete read remains unknown.
Bug class: live-path
Bug evidence: reproducer=tests/integration/resource-owner.test.ts; live=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/owner-browser-live-config-1103/resource-recovery-evidence-1103.md
Hook bypass: none
Convergence: claimed
1.x reference: src/core/hostTestRunnerSemaphore.ts reclaims a provably dead holder PID; 2.0 retains escaped-descendant checks with a complete one-time census.
Prompt review: no prompt change.
Deferral: none

Subject (2 paths): scripts/resource-owner.mjs, tests/integration/resource-owner.test.ts

Decision: RR1 | The new recovery test passes with 80 unrelated candidates and a dead launch, fails when the complete recovery join is removed, and retains the debit for an unreadable candidate. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/owner-browser-live-config-1103/resource-recovery-evidence-1103.md
Decision: RR3 | The ordinary-settlement test passes with 80 unrelated candidates and a verified returned debit. Removing the complete settlement join makes it fail. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/owner-browser-live-config-1103/resource-recovery-evidence-1103.md
Decision: RR2 | Final resource-owner integration file passes 39/39, including the denied privileged-read fallback and both-read-denied membership case. Exact-head full gate and independent Astra review remain required before switch. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/owner-browser-live-config-1103/resource-recovery-evidence-1103.md
Decision: RR4 | The changed resource owner is in the native harness composition. Its actual contract cases passed 9/10; the one failed assertion was the prior certified byte digest. Re-declared the measured composition digest after the contract run, then rerun this test and lint before full gate. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/owner-browser-live-config-1103/resource-recovery-evidence-1103.md
Decision: RR5 | A denied privileged lsof read returns null and triggers the ordinary read, while both denied reads still keep membership unknown. The final fallback branch has a direct can-fail test; its native composition digest was refreshed again and all 10 native harness contract tests pass. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/owner-browser-live-config-1103/resource-recovery-evidence-1103.md

## Closing block

simplestRobustRoute: Keep the existing owner, ledger, allocation and membership join. Widen only final settlement and restart recovery, with a read-only privileged cwd observation and fail-closed fallback. Keep live per-second sampling bounded and preserve settlement rules.
80/20: Focused negative control proves the 64-process failure class, with the entire resource-owner integration file exercising neighboring admission and cleanup behavior. Exact-head full gate and live acceptance remain desk-owned.
VERDICT: author submission; no independent verdict asserted.

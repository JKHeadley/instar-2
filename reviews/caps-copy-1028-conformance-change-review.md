# Change review — native Darwin conformance

Subject base: 9b1e78d0aeaea3448eb1187938128e2e31c46419
Review state: open
Reviewed content: none
Outcome: Renew the exact Darwin native composition after its real contract passes; replay dependent publication before the candidate enters lint.
Affected rules: 26, 34, 37, 42, 49, 70, 74, 90, 95, 101, 107, 111, 112, 113, 115, 116; architecture R105.
Affected floors: secrets, spend cap, stop, no duplicate sends and durable intake keep their existing enforcement and contract coverage.
Operator questions: none
Suggested tier: critical
Declared tier: critical
Tier rationale: exact native conformance evidence changes; executable behavior is unchanged.
Side effects: declaration and dependent publication bind the measured composition. Original candidate review metadata now uses the required full subject SHA, tier and closing fields; runtime behavior is unchanged.
Undo and recovery: revert with the matching composition and regenerate publication; an older certificate cannot certify new bytes.
Multi-machine posture: the shared declaration certifies only the exact Darwin runtime measured on the Studio.
Layer below: repository compositionClosure/compositionDigest/currentRuntime, native contract, desk repin and register replay.
Bug class: none
Bug evidence: before renewal 9/10 passed with only stale certificate assertion failing; after renewal 10/10 passed. Evidence maintenance; before/after contract results and every command are retained at /Users/dabombstudio/.instar/agents/echo/.instar/lanes/caps-copy-1028-conformance-repair.
Hook bypass: none
Convergence: none
Deferral: generated/register.json:1 | not-a-deferral=mechanically replayed register descriptions introduce no deferred work

## Closing block

simplestRobustRoute: reuse the native contract and repository digest functions, then existing publication. Matching bytes skip; only the stale certificate assertion may fail before renewal; all ten cases must pass afterward. Behavioral failure preserves evidence and stops for repair.
80/20: bounded targeted native proof, lint, register and review checks; the existing pipeline owns the full suite.
VERDICT: author submission; no independent verdict asserted

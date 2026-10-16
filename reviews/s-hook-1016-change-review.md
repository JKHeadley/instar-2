# Change review — conversation admission hook lifetime

Subject base: 06fd9f05f63c27848a171004c3abf88820413d29
Review state: open
Reviewed content: none
Outcome: construct the continuing-conversation driver from the shipped journal wiring without confusing its four-hour lifetime with a single admission hook invocation.
Affected rules: 1, 13, 34, 49, 60, 70, 74, 101, 102, 111, 113, 116
Affected floors: secrets, spend cap, stop, no duplicate sends and durable intake retain their existing admission, effect, journal and driver owners. No guard is raised or bypassed.
Operator questions: none
Suggested tier: standard
Declared tier: standard
Tier rationale: one bounded configuration correction with real driver construction and exact boundary neighbors; no prompt, parser, authority or storage change.
Side effects: a conversation hook invocation is capped at one hour rather than requesting an invalid four-hour hook. Ordinary session-work hooks retain their ten-minute ceiling. The four-hour conversation and driver turn deadlines remain unchanged.
Undo and recovery: revert the timeout expression and its regression tests; this restores the demonstrated startup failure but does not alter durable records. No live root or Studio file is changed.
Multi-machine posture: identical local driver configuration on each owner machine; conversation ownership, forwarding, durable delivery and stop behavior remain with existing owners. No new machine-local state.
Layer below: inspected the real driver guard, eager conversation adapter construction, sessionAdmissionCommand, tool-admission hook execution, and both session limit objects. The hook bounds an invocation, whereas the driver and conversation owner retain their separate lifetime bounds.
Bug class: unit
Bug evidence: reproducer=tests/assembly/production-session-driver.test.ts
Hook bypass: none
Convergence: none
Decision: s-hook-invocation-bound | cap the existing hook timeout at 3600 seconds while retaining shorter session limits and the four-hour conversation lifetime; no new configuration or widened driver guard | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/s-hook-1016-PROGRESS.md
Prompt review: no model-facing change. No prompt, parsed model output or judgment acceptance criterion changes; this corrects a deterministic invalid constructor argument. The regression executes the shipped journal configuration closure with the real driver and eager adapter.

## Closing block

simplestRobustRoute: cap the existing invocation timeout at the driver's existing one-hour ceiling. This is the simplest robust route: no additional state, retry, configurable knob or guard relaxation. The real constructor and boundary tests hold the start and limit guards; session lifetime, stop, durable intake and effect uniqueness remain unchanged. No live unattended completion is claimed by these offline tests.
80/20: repair the demonstrated constructor failure and test its real consumer plus both guard neighbors; host gate and live acceptance remain with the desk.
VERDICT: author submission; no independent convergence asserted

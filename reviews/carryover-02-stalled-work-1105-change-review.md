# Change review — unknown session control-plane observations

Subject base: b5806d1e015dc650cdc1dee2e0accab05a849d4b
Review state: open
Reviewed content: none
Outcome: A failed or timed-out local session-control probe cannot manufacture a worker exit. This is a partial repair beneath carryover row 02, not the whole stalled-work recovery feature.
Affected rules: 1, 4, 26, 30, 34, 42, 55, 59, 60, 61, 63, 68, 70, 74, 101, 107, 113, 116.
Affected floors: secrets — no credential or terminal content added; spend cap — no calls or allowance changes; stop — exact existing owner remains authoritative; no duplicate sends — unknown observations cannot trigger replacement; durable intake — refusal leaves the existing session and accepted input records intact.
Operator questions: none
Suggested tier: critical
Declared tier: critical
Tier rationale: Physical liveness supplies the existing recovery and termination paths. Misclassifying unavailable evidence as death can duplicate work.
Side effects: A failed has-session call now requires a successful session census or independently absent recorded pane PID. Unavailable census with missing, live, reused or malformed PID evidence remains unknown. The exact local client is killed at the inherited nine-second bound; the shared server is never signalled. Probes remain synchronous and this change does not claim nonblocking parity.
Undo and recovery: Revert the source change and restart the runner through its normal update path. No stored schema, authority, installation file or state migration is introduced. Retain all work and input records. Reversion restores the unsafe negative-probe inference.
Multi-machine posture: Deliberately machine-local physical observation of the existing local worker identity. It neither probes nor signals remote processes and grants no ownership transfer. The existing conversation fence and resource owner remain the only recovery owners.
Layer below: The physical IO adapter previously mapped spawn timeout/error to status 1, while production-session-driver alive() treated every nonzero status as absent. A successful complete census now distinguishes a missing target from inaccessible control. A final local server may disappear with its last pane, so an ESRCH for that record's exact PID supports ordinary closure; PID reuse or permission failure cannot.
Bug class: integration
Bug evidence: reproducer=tests/assembly/session-control-plane.test.ts
Hook bypass: none
Convergence: none
Prompt review: No prompt, model-output parser, model route or judgment changed. These tests use explicitly fake control-plane replies and isolated real processes; no genuine model or live acceptance is claimed.
Decision: carry02-control-plane-unknown | Preserve unavailable observations as refusal and require affirmative absence before the existing owner may infer worker exit. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/carryover-02-stalled-work-1105-PROGRESS.md
simplestRobustRoute: Repair the existing physical IO boundary and let its existing typed refusal reach the existing driver. No second registry, recovery journal, scheduler, sender or authority. The added census prevents ordinary nonzero control-plane errors from becoming death; the ESRCH neighbor preserves closure when the last server has gone. Actual unattended frozen-worker recovery remains unimplemented by this partial change.
80/20: Preserve this independently testable foundation repair without claiming it completes the seven-module carryover. The same assigned row remains open for owner-integrated triage, exact descendant intervention, durable bounded restart and original-result delivery.
VERDICT: author submission; whole-feature review outstanding

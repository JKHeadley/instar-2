# Change review — native outside-kill observation startup budget

Subject base: 9c11f487336c49847ed74699c2b0a35208f0322b
Review state: open
Reviewed content: none
Outcome: Give the memory-attribution outside-kill observation the same finite 30-second startup-inclusive budget as the memory crossing, and verify slow readiness and expiry with an injected clock.
Affected rules: 26, 34, 37, 49, 55, 60, 70, 74, 101, 102, 111, 112, 113, 116
Affected floors: Secrets, spend cap, stop, no duplicate sends and durable intake retain their existing enforcement. The installed guard, memory limit installation/readback, heartbeat lapse, immutable deadline and memory attribution predicate are unchanged.
Operator questions: none
Suggested tier: significant
Declared tier: ordinary
Tier rationale: One observation-only lifetime argument changes; regression executes the existing C driver and native memory probe. No production admission, authority, model or policy change.
Side effects: A stalled outside-kill feasibility control can take up to 20 additional seconds before the same guard deadline terminates it. Successful readiness still triggers the exact-PID kill immediately. This does not promise success under arbitrarily long host starvation; expiry still fails the observation.
Undo and recovery: Revert this repair commit. No durable state, installed policy, signatures or migration changes. Release packaging still follows the existing reviewed installation path.
Multi-machine posture: Machine-local deliberately: ptrace, readiness and kernel exit facts belong to the host running feasibility. Shared source adds no replicated state or ownership changes.
Layer below: The driver computes the immutable deadline before spawning the guard; the S report precedes the traced sandbox exec chain; the payload R proves that chain finished; the existing driver heartbeats throughout and the guard owns the unchanged deadline/lapse and memory attribution checks.
Bug class: unit
Bug evidence: reproducer=tests/assembly/fixed-worker-feasibility-handshake.test.ts
Hook bypass: none; core.hooksPath unset and the common hooks directory contains only sample hooks.
Convergence: none
Decision: train116-observation-budget | Reuse the existing 30-second memory observation budget for the outside-kill neighbor, preserving payload readiness, strict native assertions and finite expiry. The supplied failure hit the old startup-inclusive 10-second deadline; do not weaken attribution or alter the production guard. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-116-repair-PROGRESS.md
Decision: train116-deterministic-clock | Use explicit shared atomic clock advances in the compiled-C regression so the 13-second and 40-second cases do not magnify host scheduling delays. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-116-repair-PROGRESS.md
Verification: Compiled-C regression uses explicit shared-clock advances, independent of host scheduling, and passes with virtual readiness at 13 seconds and refuses at 30 seconds when readiness would take 40 seconds; missing, invalid and closed readiness plus continued heartbeats and independent attribution controls remain covered. Replacing only the call argument with the old 10-second budget makes the regression fail. Real Darwin unprivileged memory feasibility passes the unchanged strict assertions. Typecheck and architecture passed before the repair; final checks are recorded in the progress report.
Evidence limits: The original full-gate stall did not recur in the targeted baseline or 36 bounded diagnostic memory runs. The supplied record proves deadline expiry, not whether startup or signal completion was delayed. The injected regression proves tolerance of slow startup, not the exact kernel scheduling history of that old run. Root-only fatal memory enforcement remains UNVERIFIED in unprivileged runs. No full suite, live-model call or installation was performed.
simplestRobustRoute: This is the simplest robust route: reuse the existing larger finite observation budget for a control whose deadline includes traced startup. No new handshake, retry, timer reset, production safeguard change, quarantine or weaker verdict. Start remains the existing guard spawn; payload readiness triggers the exact-PID fault; the unchanged immutable deadline bounds a stalled control. No autonomous product-completion claim.
80/20: Repair one feasibility budget, demonstrate the old-budget failure and both readiness/expiry outcomes, retain actual Darwin attribution evidence, and leave the exact-head full suite to the pipeline.
VERDICT: author submission; this record asserts no independent verdict — the review desk records its own

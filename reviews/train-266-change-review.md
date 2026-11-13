# Change review — train-266 turn failure containment

Subject base: 82be0674d3c38cbc53102ea0441337cabfa6d86f
Review state: open
Reviewed content: none
Outcome: combine the exact reviewed turn-isolation-1113-r2 head with the exact live train-260 base, retaining bounded durable failure recovery and all successful-turn behavior.
Affected rules: 1, 4, 15, 26, 34, 37, 41, 42, 46, 49, 52, 55, 60, 61, 63, 65, 70, 71, 74, 77, 90, 95, 101, 102, 113, 116, 123
Affected floors: secrets — fixed reason classes only; spend cap — existing model reservations and budgets; stop — retained stopped rejection and minimal confirmation; no duplicate sends — existing reserved/UNKNOWN outcomes and durable delivery-notice slot; durable intake — accepted requests remain journaled even when parked.
Operator questions: none; the brief supplies exact membership, base, and desk decisions.
Suggested tier: critical
Declared tier: critical
Tier rationale: inherited durable journal recovery and effect boundaries; the combining train adds no product behavior.
Side effects: inherited generation-7 non-additive attempt/housekeeping records refuse unsafe rollback readers; interrupted attempts count toward a durable limit of three. Exception containment permits later requests. It does not preempt arbitrary synchronous callbacks. Ordinary success/model prompt bytes stay unchanged. No other member or train is merged.
Undo and recovery: before installation revert this train. After new journal frames, retain the compatible reader or use the reviewed consistent-backup recovery procedure; never erase individual attempts or unknown effect reservations to force replay.
Multi-machine posture: inherited journal replication/snapshots hold attempt state; existing conversation ownership gates all effects. This train adds no machine-local product state. Native conformance renewal remains with Studio.
Team posture: inherited conversation audience/disclosure checks remain authoritative, status retains its operator surface, and notices contain no private error text. No sharing grant is widened.
Layer below: exact live-base ancestry, reviewed member journal writer/projector and snapshot recovery, admission/ownership/cap/stop/send reservation doorways, real captured fixture provenance, and generated owner/register references.
Bug class: integration
Bug evidence: reproducer=tests/preview/turn-isolation.test.ts; other=tests/preview/journal-topic-sessions.test.ts
Hook bypass: none; core.hooksPath=.husky/_, absent in this fresh worktree; ordinary merge/commits only.
Convergence: none
Prompt review: this train introduces no new prompt or parser change. The member replays recorded summary-writer, summary-uncertain, Jev undecided/unsure, reply-review, delivered and empty-reply shapes through real journal preparation and the new failure boundary. Successful prompts retain the unchanged 23459-byte always-sent guard. Independent release acceptance remains the desk's.
Decision: train-266-M1 | Ordinary merge of exact reviewed b709a0c3d317e91e796be8d9ff70d29bf3ab4ff4 fast-forwards the exact base without conflict. Member report /Users/dabombstudio/.instar/agents/echo/.instar/lanes/turn-isolation-1113-r2-PROGRESS.md; authenticated snapshot SHA256 3c67957fc0069931bdca2612e86feb5556bf3a946e59552b0fa3614c91ae2e66 verified. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-266-PROGRESS.md
Decision: train-266-A | Preserve all reviewed member and live-base bytes; no product conflict, changelog merge, or manual generated merge occurred. Desk C is unused; no member is left out. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-266-PROGRESS.md
Decision: train-266-B | Create the separate branch directly at 82be0674d3c38cbc53102ea0441337cabfa6d86f and merge no main or train-262 tip; both required heads remain ancestors. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-266-PROGRESS.md
Decision: train-266-D | Run all changed tests plus selected direct consumers at failure, ownership, replay, lifecycle and packet boundaries; run mandated checks with unchanged guards/timeouts. Report unchanged WSL/Studio-dependent checks for the desk full gate instead of changing host guards or sweeping the whole journal suite. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-266-PROGRESS.md
Decision: train-266-chain | Use authenticated cint-L37 chain: inventory repin, build, owner rehash, committed-source register replay. Linux sed spelling is the only local desk-script adaptation. No native certificate is edited. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-266-PROGRESS.md

1.x comparison: fetched actual JKHeadley/instar main 7de35f7c1975e7db78e517cf5628a60a511c7c1e and searched src/, docs/specs/ and git history. Read src/monitoring/CrashLoopPauser.ts, inspected src/monitoring/SessionWatchdog.ts and src/core/PendingInjectStore.ts, lifecycle specs codex-session-lifecycle-reliability.md and unified-session-lifecycle-robustness.md, and history e4770b7df, 3d3050877, ff8344b4b, 0868b62cc, 92a21075d. Inherit member comparison at 8ccc0ac52d38d3a503ad6c4c9a4882cc8e8aae61: bounded failures, durable identity/custody fit; tmux process isolation and at-least-once injection replay do not replace this runner's effect accounting. Read authenticated ONEX-LESSONS sections 2, 5 and 6: timeout is indeterminate, distinguish attempts from actual recovery, persist counters across restart, keep source history, prove consumer wiring and bound test concurrency.

Scope: no new product code. Member's 121 changed product lines implement durable attempts/recovery, two containment boundaries, parking/status/notice and cooperative floor failure. Single-operation synchronous preemption stays assigned to turn-preemption-1113. All release/native/live gates remain required at the desk.

Prompt finding: 105c1569b6bb | quoted-evidence | Existing journal prompt phrase and its prior regression fixture are unchanged by this outer failure-boundary change; no expected answer is added to a model prompt.
Prompt finding: 4106b49fff07 | quoted-evidence | Existing journal prompt phrase and its prior regression fixture are unchanged by this outer failure-boundary change; no expected answer is added to a model prompt.
Prompt finding: 7ef11b68103f | quoted-evidence | Existing journal prompt phrase and its prior regression fixture are unchanged by this outer failure-boundary change; no expected answer is added to a model prompt.
Prompt finding: 85544c20941f | quoted-evidence | Existing journal prompt phrase and its prior regression fixture are unchanged by this outer failure-boundary change; no expected answer is added to a model prompt.
Prompt finding: 9f0106c66027 | quoted-evidence | Existing journal prompt phrase and its prior regression fixture are unchanged by this outer failure-boundary change; no expected answer is added to a model prompt.
Prompt finding: bac6ce7485d9 | quoted-evidence | Existing journal prompt phrase and its prior regression fixture are unchanged by this outer failure-boundary change; no expected answer is added to a model prompt.
Prompt finding: e8708c7fea24 | quoted-evidence | Existing journal prompt phrase and its prior regression fixture are unchanged by this outer failure-boundary change; no expected answer is added to a model prompt.
Prompt finding: 849db3a6296a | quoted-evidence | Existing journal prompt phrase and its prior regression fixture are unchanged by this outer failure-boundary change; no expected answer is added to a model prompt.
Deferral: generated/register.json:1 | not-a-deferral=generated governing material is replayed unchanged in meaning.
Deferral: tests/preview/journal.ts:10828 | not-a-deferral=describes existing pending/not-started batch outcomes, not postponed implementation.

simplestRobustRoute: one ordinary exact-head merge followed by the existing desk generation chain is the simplest route; no additional runtime machinery. Start guards are exact base and reviewed membership, end guards are targeted consumer evidence, consistent registers and pushed custody. Inherited reservations, stop, ownership, secrecy and cap boundaries remain authoritative. No autonomous shipped-path or live-delivery claim is made.
Independent review: /root/train_review checked exact ancestry, unchanged reviewed product/test bytes, generated-only metadata delta, evidence checksums, decision destinations and scope/side effects; concurred with no train-specific findings. This is not independent unit or release acceptance.
80/20: preserve reviewed behavior and focus train checks on changed tests and named consumers; the desk full gate handles the repository-wide release pass.
VERDICT: author submission; independent desk review and release approval remain authoritative

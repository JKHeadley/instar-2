# Change review — train-136 requested follow-up delivery integration

Subject base: ca3d8ab80f606ce490c2883e71b6b5ab2a93d154
Review state: open
Reviewed content: none
Outcome: Integrate exactly reviewed followup-deliver-1022 head 875785751e2d4e05f76d7a07069c802bc70852b0 onto the exact live train-135 base. Successful empty polls retain one coalesced delivery wake while ordinary work is busy.
Affected rules: 1, 8, 34, 36, 37, 46, 49, 55, 60, 61, 63, 70, 74, 83, 87, 90, 93, 101, 102, 111, 113, 116
Affected floors: secrets — existing egress checks retained; spend cap — existing worker capacity retained; stop — existing wake admission and worker checks retained; no duplicate sends — existing result identity and receipt fencing retained; durable intake — pending passes drain accepted withdrawal input before delivery
Operator questions: none
Suggested tier: critical
Declared tier: critical
Tier rationale: Release integration of reviewed delivery scheduling; no additional product behavior.
Side effects: Empty polls may retain one existing pending job. Repeated polls coalesce; admitted work drains intake first and rechecks ownership, stop, capacity and send identity. No new queue or timer is introduced.
Undo and recovery: Keep the accepted live build until the desk accepts this candidate. Use the existing release rollback to that build; this integration changes no journal schema or live root.
Multi-machine posture: Wake is process-local and disposable; durable work and receipts remain shared. Existing owner and peer-durability admission govern delivery. No new replicated state.
Layer below: Read the member diff and evidence snapshot, including the busy-lane interleaving, withdrawal ordering, uncertainty and restart cases. Preserve the existing ordinary lane and send receipt mechanisms. Read the cint-L37 desk-chain report and apply those generation tools.
Bug class: integration
Bug evidence: reproducer=tests/preview/followup-deliver-launch.test.ts
Hook bypass: none; core.hooksPath unset and common hooks directory contains only samples
Convergence: none
Deferral: tests/preview/followup-deliver-launch.test.ts:14 | not-a-deferral=The carried test name exercises requested follow-up scheduling; it postpones no assigned work.
Decision: train-136-merge-followup | Fast-forward the exact reviewed 875785751e2d4e05f76d7a07069c802bc70852b0; member evidence is /Users/dabombstudio/.instar/agents/echo/.instar/lanes/followup-deliver-1022-PROGRESS.md (downloaded snapshot SHA-256 verified). | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-136-PROGRESS.md
Decision: train-136-A-preserve | Preserve every reviewed member byte; ordinary merge fast-forwarded without conflicts or hand edits. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-136-PROGRESS.md
Decision: train-136-B-live-base | Retain ca3d8ab80f606ce490c2883e71b6b5ab2a93d154 in ancestry; no main merge, branch movement or changes to train-133. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-136-PROGRESS.md
Decision: train-136-D-host-checks | Apply the stated WSL exception to unchanged host-dependent checks; report outcomes and missing absolute Studio evidence without changing declarations. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-136-PROGRESS.md
Decision: train-136-desk-replay | Use the downloaded repin, build, owner-rehash and register replay chain; adapt only the temporary repin script's sed invocation to Linux. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-136-PROGRESS.md
Prompt review: No added model wording, parsing or classification. Replay checked-in real request/answer/work bytes and historical uncertain, undecided, reply-review and empty-reply shapes. No new live-provider or live-Telegram result is claimed.

Verification: The handoff records targeted tests, journal tests, provider subscription, pinned tests, unchanged context floor, lint, typecheck, architecture, register and review outcomes. Canonical report references remain Studio paths; downloaded evidence is read-only input. The full combined-candidate and native host gate belong to the desk.

## Closing block

simplestRobustRoute: This is the simplest robust route: ordinary merge of the exact reviewed head, existing desk regeneration, and targeted consumer checks. No product machinery is added. Existing start authority, durable completion evidence, stop, spend and unique-send fences remain intact. This is integration evidence, not a claim of fresh unattended live completion.
80/20: Preserve the reviewed repair and verify its consumers; the desk runs the full combined-candidate gate.
VERDICT: author submission; no independent verdict claimed

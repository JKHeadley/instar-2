# Change review — Linux setup qualification evidence

Subject base: 6b521fd202cff23339f85a8ea223c5450519bbdc
Review state: open
Reviewed content: none
Outcome: Reuse the sibling qualification harness and preserve Linux cgroup measurements. No qualified installer claim; full isolated preparation remains absent.
Affected rules: 4, 13, 26, 34, 36, 38, 41, 49, 55, 57, 58, 60, 65, 67, 70, 74, 75, 95, 100, 101, 102, 107, 111, 113, 116; purpose Rule 3.
Affected floors: secrets — only disposable isolated test keys, never live secrets; spend cap — zero paid calls; stop — explicit durable stop checked before and during execution; no duplicate sends — no sends; durable intake — no intake changes and captures retained.
Operator questions: none
Suggested tier: significant
Declared tier: significant
Tier rationale: Real model and kernel resource experiment; no production installer activation.
Side effects: One two-thread CPU model per sequential trial; cgroup memory/swap/CPU/task ceilings and independent deadline. Cache and captures are outside the repository. No live root or Studio write.
Undo and recovery: Revert Linux qualification additions and runner injection, preserving captures. Failed service is held without automatic retry; a new explicit experiment uses a new root.
Multi-machine posture: Machine-local Linux x86_64 evidence, deliberately. No inference of macOS or arm64 adequacy; sibling harness and frozen task set reused.
Layer below: Read main purpose and rules, docs/14, predecessor design report, 1.x setup-wizard state-machine validators, Seven model adapter/Six claims and the sibling primitive owner cases. Kernel cgroup files are read in the service before model execution.
Bug class: none
Bug evidence: none
Hook bypass: none
Convergence: none
Decision: setup-linux-D1 | Reuse pushed macOS harness 6b521fd2, retaining its prompt/decoder and honest incomplete owner coverage. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/install-setup-qualify-1025-linux-PROGRESS.md
Decision: setup-linux-D2 | Use transient systemd services and verify cgroup settings inside each child; the scope/user-bus paths fail on this host. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/install-setup-qualify-1025-linux-PROGRESS.md
Decision: setup-linux-D3 | Keep full qualification held for absent custody/genesis setup and pending independent assessment; diagnostic trials cannot replace them. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/install-setup-qualify-1025-linux-PROGRESS.md
Skip: tests/assembly/setup-qualification-host.test.ts:21 | scope=Explicit opt-in real-model experiment; no weights loaded by ordinary test runs
Skip: tests/assembly/setup-qualification-linux.test.ts:10 | scope=Linux cgroup proof requires Linux; the sibling supplies macOS evidence

Subject (6 paths): scripts/setup-qualification-linux.mjs, scripts/setup-qualification-linux.py, scripts/setup-qualification.mjs, tests/assembly/setup-qualification-host.test.ts, tests/assembly/setup-qualification-linux.test.ts, tests/qualification/setup-seven.ts

## Closing block

simplestRobustRoute: Reuse sibling prompt, decoder, owner cases, Seven capture adapter and host report. Add only a Linux physical subprocess adapter because the specified kernel cgroup controls are not supplied by the macOS sampled-RSS owner. The kernel holds memory/CPU/tasks, a small child verifies those controls and records peak memory, and the model creates no authority. Full setup proof cannot be replaced by primitive measurements.
80/20: Obtain reproducible host results and preserve the unchanged pass bar. Independent Astra assessment and complete custodian/genesis qualification remain open, visibly preventing distribution.
VERDICT: author submission; this record asserts no independent verdict — the review desk records its own

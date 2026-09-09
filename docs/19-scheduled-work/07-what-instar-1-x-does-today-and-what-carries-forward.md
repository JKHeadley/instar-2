## 7. What Instar 1.x does today and what carries forward

**Rule — the layer-below audit names preserved behavior and its earned incident.** Rule 111;
**checks: P15-NF-02/51**. The audit covered `JobScheduler`, `JobLoader`, `AgentMdJobLoader`,
`AgentMdReconcile`, `AgentMdAtomicSave`, `AgentMdLockFile`, `InstallBuiltinJobs`,
`buildPerSlugManifest`, `JobClaimManager`, `JobLeaseClaimStore`, `JobLeaseCutoverGate`,
`JobRunHistory`, `SkipLedger`, `IntegrationGate`, `QuotaTracker`, `CrashLoopPauser`,
`MigrationInvariants`, `MigrationLedger`, `OutstandingPromptTracker`, the `Mentor*` job modules,
the job types in `core/types`, and the installed `.instar/jobs` manifests. The following behaviors
carry forward through the 2.0 owners rather than by copying those modules.

| Preserved behavior | Incident that earned it | 2.0 expression |
|---|---|---|
| A never-run future job does not fire on boot | ACT-724 discharged an annual reminder on the day it was created because absence of `lastRun` was mistaken for overdue | Activation instant plus deterministic due history; P15-NF-14/27 |
| Model-free work does not consume a model session | Codey F005 left script jobs hanging for hours with pending history and occupied session capacity | Registered programmatic RunStep with its own bounds; P15-NF-29/40 |
| One slow or restart-surviving job cannot overlap itself invisibly | The June 15 headless-reroute O3 finding showed an in-memory active-run map vanished across restart while the live session survived | Occurrence identity, durable run and reservation; P15-NF-18/21/37 |
| A tick cannot resend while the prior prompt remains inside its reply timeout; identical unanswered content has a durable attempt breaker | `OutstandingPromptTracker` was added after a 15-minute mentor cadence could resend while a reply took more than 16 minutes, creating a ping-pong loop. In 1.x `canSendTo` and `reserveSend` first sweep entries older than `replyTimeoutMs`, twenty minutes by default, so a new attempt may admit after timeout even without a reply. The separate content-key ledger limits identical attempts across restart | Part fifteen deliberately strengthens the rule: retained uncertainty keeps the original Run and operation observable, and timeout alone never permits duplicate execution. A late original reply is recorded against that obligation and cannot justify a second 2.0 invocation; P15-NF-21/38/46 |
| Multi-machine claims use durable fencing and one cutover path | Best-effort bus claims could diverge under partition, and simultaneous bus and journal paths created a split claim domain | Part-six lease, fence and coherent assembly activation; P15-NF-21/36 |
| Jobs declared independent run once on every eligible machine | `perMachineIndependent` was added because a global slug lease elected one machine for a scan whose result described each machine's own disk; six installed per-slug manifests use it | Registered machine-scoped job instances with one Result per target; global-once remains mandatory for shared effects; P15-NF-18/36/51 |
| Quota admission and placement use the same eligible account set | Account-blind throttling stopped an entire agent with fresh accounts idle, while a looser brake than placement caused respawn loops | One recorded admission candidate set; P15-NF-30/32 |
| Unknown quota is not zero headroom | A non-authoritative 186 percent JSONL estimate stopped all work; a permanently unreadable framework was later treated as healthiest by a zero default | Source-aware evidence policy and bounded unknown posture; P15-NF-29/31/34 |
| Quota warnings are episode-scoped | A missing-file path emitted about 902 warnings per day and buried useful signal | Durable episode aggregation through eleven/eight; P15-NF-49/50 |
| Script-job consecutive failure survives a new attempt and alerts remain retryable | Reset-at-start made every persistent script failure look like failure one; the script path now preserves the streak until subprocess success, and failed alert delivery retains retry state | Fact-derived breaker episode and durable notification loop; P15-NF-46–50 |
| Model-session failure counting needs correction rather than preservation | A successful model-session spawn still resets `consecutiveFailures` and clears alert state before completion; repeated successful spawns followed by failed completions can therefore increment from the reset value again | One outcome-derived breaker fold shared by script and model jobs, with no start-time reset; repeated spawn-success/completion-failure fixtures in P15-NF-47 |
| Crash loops pause waste but preserve diagnosis | Repeating import, overload and incomplete-tool failures consumed compute and polluted signal while duration changes could not fix their causes | Part-six breaker with separate minimal repair capacity; P15-NF-47/49 |
| Built-in manifest generation is checked against its consumer | Hand-written producers omitted required `priority` and `expectedDurationMinutes`, causing built-in AgentMD jobs to fail loading fleet-wide for about a week. The 1.x AgentMD loader rejects those two omissions, validates `model` only when supplied, and maps an omitted model to `sonnet` in `manifestToJobDefinition` | One closed package decoder plus producer-consumer fixture. Import preserves a supplied valid model and maps omission to the 1.x `sonnet` default before requiring explicit current 2.0 route resolution; P15-NF-08/10/51 |
| Compatibility conversion proves zero job loss, zero schedule drift and user-namespace preservation | The AgentMD migration needed `MigrationInvariants` because a successful command was not evidence that every old job retained its meaning | One-way import with source bytes and explicit residue; P15-NF-16/17/51 |
| Signed built-ins, namespace separation and collision refusal remain | Forged default origin, body drift, case collisions and interrupted two-file saves could otherwise select unintended work | Part-ten signed atomic package lineage and explicit conflict; P15-NF-09/16/17 |
| Large history is read incrementally and remains honest about unmeasured jobs | Repeated synchronous parsing of a roughly 13 MB job ledger froze the event loop for 13–16 seconds; empty populations were prone to false percentages | Part-two append/projection/checkpoint model and measured-only aggregates; P15-NF-26/50 |
| Demotion is rechecked at the launch boundary | A machine could start writable, lose its role, and keep firing cron tasks from the stale boot posture | Current part-six ownership and standing check at reservation and dispatch; P15-NF-05/21/36 |
| Wake reaping subtracts every sleep in the Run, preserves a worker with active child processes, and retains the termination guard | `JobScheduler.reapStuckRuns` once credited only the latest sleep and could reap early. Its current path subtracts cumulative sleep and keeps active children. `SessionManager.terminateSession` also returns explicit `protected` and `not-lease-holder` refusals, so the protected worker can remain alive. `resumeOnReap` is opt-in because a cron body is not inherently idempotent. | Part Five keeps the same Run, pending step and accepted observations; Part Six owns recovery, fencing, settlement and worker replacement; Part Ten supplies the bounded sleep/wake, process-liveness and shutdown drivers. A refused shutdown remains a refusal and leaves ownership, reservation and Run state intact. A proved reap is uncertain worker loss, never retry permission. Without an explicit recovery policy, recovery observes and leaves the Run inhibited; even with one, it resumes the same Run and cannot mint a fresh effect attempt without P15-NF-23. P15-NF-21/23/38/45/46 are non-executable where they need shutdown drivers until the GRANTED `seam-response-effects-followup.md` and `seam-response-assembly-followup.md` land. |
| The wake reaper currently reports refused termination as completed reaping | `JobScheduler.reapStuckRuns` ignores the `terminated: false` result from `SessionManager`, records the job `timeout`, releases its claim as failure, deletes the active-run entry and reports the slug reaped. A protected or non-owner-refused worker can therefore remain alive after the scheduler has falsely removed its execution accounting. | Part fifteen corrects the caller defect: only independently evidenced termination may advance worker-loss recovery. A `Refused` shutdown is recorded unchanged, cannot mark the Run reaped, cannot remove its current owner or active-worker observation, and cannot release any execution or resource reservation. P15-NF-38/45 exercise the refusal and successful-termination neighbors; their shutdown-driver arms remain non-executable until the GRANTED `seam-response-effects-followup.md` and `seam-response-assembly-followup.md` land. |
| Job prompts are grounded and tool/model choices are recorded | Headless jobs historically inherited more tools, remote services and billing paths than their work required | Part-five grounding, part-ten isolation and actual route evidence; P15-NF-12/35/45 |
| The default server's opted-in completion performs learning before queue progression; the optional no-gate composition behaves differently | The normal server injects `IntegrationGate`, which synchronously reflects, records reflection, derives high-confidence common blockers and may hold queue drain after a failed job; timeout proceeds with warning and a fourth consecutive per-slug block auto-releases. If no gate is injected but intelligence exists, `JobScheduler.notifyJobComplete` instead starts standalone reflection for every completed job regardless of `livingSkills.enabled`, immediately drains the queue, records any reflection and may send it to the job topic | The default path becomes section 5's bounded pre-closure learning step and same-job hold. The optional standalone path is preserved as reported, inhibited compatibility residue until the package explicitly selects `off` or `required`; P15-NF-42/44/45/50/51 |

**Rule — 1.x mechanisms deliberately re-expressed through the core are not parallel systems.**
Rules 1, 30, 66, 68 and 114; **checks: P15-NF-03/51**. `croner` callbacks become clock-adapter
stimuli. `jobs.json`, per-slug JSON and AgentMD frontmatter become one package manifest. The
in-memory queue becomes part-five run state. `SkipLedger` and `JobRunHistory` become projections
over admitted facts. Claim managers become part-six leases and fences. Retry timers become the
part-six loop. `QuotaTracker` becomes a capacity-evidence adapter consumed by admission. Shell
gates become registered RunSteps. The 1.x supervision strings map to parts seven and nine.
`IntegrationGate` maps specifically to section 5's post-completion learning step, Result and
bounded same-job learning-hold policy. The optional no-gate standalone-reflection composition is
not inferred from the manifest flag; compatibility import reports and inhibits it until an explicit
new package choice. Generic per-step supervision does not replace that learning step.
The four audited scheduler `Mentor*` modules separate tick orchestration, assembly wiring, bounded
guardian work and signal-only forensics. In 2.0 those behaviors become ordinary capability packages
rather than scheduler internals. Telegram topic coupling becomes a part-eleven
destination rendered through the part-eight message operation.

**Rule — the 2.0 design forecloses the audited mistakes.** Rules 1, 26, 33, 42, 55, 66, 67 and
90; **checks: P15-NF-08/18/21/29/38/40/46/51**. It has no slug-only claim, process-local retry
authority, queue that can overflow by dropping, success inferred from spawn, last-writer job
state, missing-value-to-zero quota default, hard pin that defeats a wall, least-loaded launch when
all candidates are blocked, free-form shell gate, silent invalid-entry exclusion, self-reported
route, body and manifest as independent authorities, hardcoded critical exemption, or breaker
reset on restart. Compatibility import preserves old bytes and reports anything it cannot map; it
does not keep two live scheduling authorities.

---

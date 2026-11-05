# Change review — portable limit execution within existing ceilings

Subject base: b5806d1e015dc650cdc1dee2e0accab05a849d4b
Review state: open
Reviewed content: none
Outcome: Repair the actual limit-exec owner and generator so Linux reaches the production transport while retaining inherited hard and soft limits, exact request argv and refusal/UNKNOWN semantics. Count Linux UID tasks rather than process rows and fit the transport runtime inside the unchanged four-slot headroom.
Affected rules: 13, 26, 34, 36, 42, 45, 60, 61, 66, 70, 74, 95, 101, 102, 111, 113, 116
Affected floors: secrets — no credential capture, inherited bash functions/startup cannot replace the setter; spend cap — unchanged; stop — existing owner gate unchanged; no duplicate sends — original overflow/UNKNOWN and reopen assertions retained; durable intake — unchanged.
Operator questions: none
Suggested tier: significant
Declared tier: significant
Tier rationale: A production launch boundary must be proved with real child limits and real offline transport effects; stubs alone cannot establish it.
Side effects: Linux transport V8 and libuv pools each use one worker and the SIGUSR1 inspector listener is disabled. DNS remains functional. This reduces runtime parallelism without adding task allowance. Older Node versions lacking the option refuse startup without fallback. The existing file/inline shim execs a fixed bash backend with -p; it retains the same PID, argv label, environment cleanup, gate and limit order. A transport without a readable UID census refuses before dispatch. Linux provider limits use task observations; tree process limits remain sampled, never claimed physically hard. No cleanup/parser reconciliation implementation changes.
Undo and recovery: Revert this commit before rollout; that restores the measured Linux launch refusal, not a working Linux transport. Keep any possibly dispatched UNKNOWN intent and do not retry it. Independent review, Studio full test and live qualification remain separate from this builder proof.
Multi-machine posture: Machine-local kernel limits and observations. Linux NPROC counts UID tasks including threads; Darwin retains process-row census and its existing transport runtime. A census is neither a reservation nor a hard per-tree bound. Inherited lower limits always win; concurrent UID work may still cause refusal. No profile, UID, grant, global configured ceiling, allocation or remote state is widened.
Layer below: Actual dash rejects ulimit -u before env/Node/network. The captured 256 handle/8 CPU/12 process bounds admitted a finite Node plus worker from a low-occupancy Python parent but timed out with a Node parent: shell substitution alone is insufficient. A real four-task runtime now reports its exact soft/hard limits, runs its own worker and DNS, and receives EAGAIN for an additional fork at the kernel fence. The test subtracts the transient ps observer, so it cannot borrow that slot. The production transport's closed-port ECONNREFUSED and one-request overflow/UNKNOWN cases run without replacement shims or altered assertions. Root/capability exemption is not assumed absent: the proof records UID1000, CapEff0 and actual kernel refusal; it is not a host-global namespace conformance certificate.
1.x reference: Actual JKHeadley/instar main d7788fa3348ce079ae5590002d807fc59d12ac50; src/core/ProcessCeilingCheck.ts, src/core/hostSpawnSemaphore.ts, docs/specs/launchd-process-ceiling-floor.md and docs/specs/forkbomb-prevention-simple.md; scoped history 0c9a2af9a, 4a40e3da5, c667d0cb5, 09a3a2f7d, cdc92eb72. Reuse effective inherited-limit observation, explicit unknown and bounded owner admission. Mismatch: the Darwin reporting check and compliant-launch semaphore are not portable shell setters or hard tree caps. ONEX-LESSONS.md section 6 reinforces real resource scope and bounded test concurrency. Existing 2.0 owner/allocation behavior stays in place; no replacement semaphore or wider allowance.
Bug class: live-path
Bug evidence: reproducer=tests/assembly/portable-limit-exec.test.ts; live=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/portable-limit-exec-1105-PROGRESS.md
Hook bypass: none
Convergence: none
Prompt review: No prompt, model-output parser or model accept/escalate/refuse change. Original recorded D1c transport recovery shapes remain covered by journal-send-outcome.test.ts.
Skip: tests/assembly/portable-limit-exec.test.ts:46 | scope=the Linux RLIMIT_NPROC task and /proc physical proof is Linux-specific; the shared shim and Darwin census/runtime tests run on either host.

Decision: PORTLIMIT-1 | Keep the existing sh/file argv interface and exec a fixed bash -p backend so primitive support is explicit and caller environment cannot replace ulimit; missing backend or primitive refuses before dispatch. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/portable-limit-exec-1105-PROGRESS.md
Decision: PORTLIMIT-2 | Count Linux UID tasks and reduce transport thread pools to fit the unchanged four-task headroom instead of raising the configured ceiling or dropping NPROC. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/portable-limit-exec-1105-PROGRESS.md
Decision: PORTLIMIT-3 | Refuse a transport whose UID fence cannot be observed; retain UNKNOWN once a born child may have dispatched. Prove exact hard/soft inheritance and own kernel refusal, not merely /bin/true success. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/portable-limit-exec-1105-PROGRESS.md

## Closing block

simplestRobustRoute: Repair the existing canonical shim and its two real callers, with a host-correct census and a smaller transport runtime. A shell-only swap cannot admit Node under Linux task accounting; a new launcher, wider allowance or test bypass is unnecessary. The extra exec preserves PID and prevents shell startup/function injection into the limit setters. Start guard is the existing owner gate and valid primitive; end-state proof is actual closed-port/one-request overflow behavior; limit guards are the unchanged configured and inherited ceilings. No autonomous whole-feature completion claim is made.
80/20: The measured portability defect and finite physical transport boundaries are the unit; whole02, whole07 and train174 retain their independent owners and qualifications.
VERDICT: author submission; this record asserts no independent verdict.

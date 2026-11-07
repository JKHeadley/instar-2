# Change review — first conversation worker no longer waits on sampled headroom

Subject base: e8c2a0b156ae412bcdcb4e020dd2cd6ef4d9098d
Review state: open
Reviewed content: none
Outcome: The operator's first conversation worker starts without waiting for a sampled headroom window, and memory headroom on macOS is measured from reclaimable pages instead of raw free pages. Measured cause: update 969390685 waited 1,104 seconds through 156 refused admissions, update 969390684 245 seconds through 10; 52 of 52 samples of the shipped gate on the Studio reported false memory pressure and none admitted.
Affected rules: 1, 2, 5, 14, 15, 26, 34, 36, 39, 46, 49, 60, 61, 70, 74, 77, 95, 101, 111, 113, 116.
Affected floors: secrets — unchanged, the sampler reads only page counts; spend cap — the shared per-call charge and reservation are untouched and a worker start spends nothing by itself; stop — the guards around admission and the coordinator's stop checks are unchanged; no duplicate sends — delivery identities and the journal sender are untouched; durable intake — input is still durable before admission, and additional workers still return to the same queue on refusal.
Operator questions: none
Suggested tier: critical
Declared tier: critical
Tier rationale: Changes which workers physical admission can refuse. The hard ceilings stay; only the sampled headroom's reach narrows.
Side effects: With no worker live, a first worker starts even under real memory pressure or CPU saturation, as Rule 15 requires; the resource owner's launch, memory and process ceilings still apply. On macOS the sampler runs vm_stat on each ordinary host tick, asynchronously and bounded at five seconds; a failed read is an unknown measurement, which retains an additional worker's input. False memory pressure also stops driving idle reclaim of live workers, so more workers stay warm. The runner's stderr gains one line per change of refusal reason. Eight existing denial tests now hold a resident worker; their assertions on queued bytes, reservation and drain are kept.
Undo and recovery: Revert this commit and reinstall the prior build. No stored format, policy digest, limit or schema changes.
Multi-machine posture: Deliberately machine-local. The observation and the worker lease belong to the machine holding the existing conversation ownership fence; no peer behaviour changes.
Layer below: Read the coordinator's serialized admission and reclaim, the host's replace path including epoch and null-lease handling, recover and retire, the encrypted host store, journal session-work rows, hold timing in the resource owner, and the 1.x hostMemoryPressure and SessionManager reroute gate at e882458030998577569cd67e40badc774beb82c3.
Bug class: unit
Bug evidence: reproducer=tests/assembly/conversation-topics.test.ts; other=tests/preview/topic-worker-capacity.test.ts
Hook bypass: none; no bypass flag used. core.hooksPath checked before commit.
Convergence: none
Prompt review: No prompt, model output parser, verdict or accept policy changes. vm_stat output is a host measurement parsed from real captured Studio bytes. The recorded summary, Jev, reply-review, delivered and empty-reply shapes still replay through the capacity wait and recovery tests.
Decision: session-start-gap-first-worker | Exempt only the case of no live worker, citing Rule 15, rather than remove the CPU arm the concurrency design asked for. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/session-start-gap-1107-PROGRESS.md
Decision: session-start-gap-memory | Carry the 1.x available-memory measure over; os.freemem stays for non-macOS, where it already reports available memory. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/session-start-gap-1107-PROGRESS.md

Publication: Register replayed against the source commit with build-register --replay; only generated output changed.
Verification: Targeted runs passed 151 of 151 across the capacity, topic and topic-session suites; direct importers passed 477 with one skipped; the 8 pinned-text files passed 131 of 131; typecheck, lint and register check exit 0. The new tests fail on the shipped source: first worker stays queued, parser absent, memory pressure unread. On the Studio, the new sampler reported memory pressure in 0 of 20 samples where the shipped one reported it in 52 of 52.
Residue: second-worker-cpu | medium | A worker added beside a live one still needs 12 percent sampled CPU idle. On a loaded Studio that passed 3 of 52 samples and 13 of 20 later, so a second topic can still wait; the wait now leaves a line in the runner log. Reported to the desk for its decision.
Residue: refused-attempt-writes | low | Each refused attempt still rewrites the 41 MB host state about three times, 0.2 to 0.45 seconds each, and advances the epoch. Harmless to the answer and now confined to additional workers.
Residue: live-proof | high | The live path has not been reobserved; only the desk starts or restarts the runner. The next first message after install is the proof.

## Closing block

simplestRobustRoute: This is the simplest robust route: one condition in the existing admission path and the 1.x memory measure in the existing sampler. A smaller route, the memory fix alone, is inadequate because the CPU arm alone refused about 94 percent of samples, so the wait would remain. Removing the CPU arm would be equally small but would undo a declared concurrency decision for additional workers, which this defect does not need. The one log line prevents a named failure that happened here: an 18 minute wait with nothing in any record. Start guards are authority, stop and the resource lease; end evidence is the correlated turn; limits are the unchanged physical ceilings.
80/20: Targeted suites, real captured bytes and direct host sampling, with no load run. The Studio full test and live first message decide the rest.
VERDICT: author submission; this record asserts no independent verdict — the review desk records its own

## 7. Session watchdogs and reapers

**Rule — a watchdog cannot infer operator action or signal an unverified process.** Rules 13, 26,
39, 42, 60, 68, 86 and 89; **checks: P14-NF-26–30/42/44**. Immediately before any process-directed
request, the holder obtains a fresh process identifier (`PID`), parent, start identity, argv shape (the executable plus its
ordered arguments as observed at action time), worker incarnation and
lease evidence. PID reuse, adapter-host selection, known bounded waits, active helpers, compiler/test
services and current durable progress refuse the candidate. Any intervention records the true
principal and cannot be presented as user cancellation. A pane-wide interrupt cannot substitute
for a verified descendant target.

`tmux` is the terminal-session manager used by Instar 1.x to host a worker in a pane. `SIGTERM` is
the operating system's request for a process to terminate gracefully. `SIGKILL` is the operating
system's forced termination signal, which the target process cannot handle or defer.

These are new 2.0 requirements, not guarantees of the 1.x `SessionWatchdog`: its interrupt stages
send `C-c` to the whole tmux pane, and its later `SIGTERM`/`SIGKILL` stages use the PID selected by an
earlier observation without revalidating the parent, start identity and ordered argv immediately
before signaling. The granted typed Part Eight process-control effect and confined Part Ten driver
must enforce exact action-time revalidation and direct-target-only actuation; Fourteen cannot claim
that the legacy watchdog already supplies either property.

**Rule — process reaping starts from a complete owner-resolved population.** Rules 26, 42, 49, 59,
60, 61, 68 and 69; **checks: P14-NF-27/28/30/32/42/49/64**. In addition to registered worker
sessions, the population includes untracked Instar CLI processes and allowlisted MCP descendants
that became leaked, orphaned or reparented. A live registered owner, live run/delegation, known
active child, protected/minimal-plane role, external/non-Instar terminal session, incomplete
ancestry or unknown ownership refuses automatic disposal. Old age, resource pressure and an
allowlisted executable are signals only. The holder first consumes a pinned complete Part Ten
inventory, and any selected process is independently revalidated at effect admission as the same
exact descendant identity.

The landed Part Ten `HarnessAdapterPort.observe` can observe a known `HarnessLaunchSpec`; neither it
nor the landed holder-binding/driver shape exposes a complete arbitrary process/session population.
The additive read-only, owner-decoded Part Ten process-inventory observer returning one pinned
snapshot is GRANTED CONDITIONALLY in `seam-response-assembly-followup.md`, ledger #40, but is not
landed and grants no disposal authority. P14-NF-64's complete-population and production-observer
positives are **non-executable until the ledger #40 grant in
`seam-response-assembly-followup.md` lands**.
The later actuation positive remains separately blocked on
`seam-response-effects-payloads.md` and `seam-response-assembly-followup.md` landing.

**Rule — clean-worktree reclamation keeps every uncertain checkout.** Rules 5, 9, 26, 42, 55,
60, 61, 68, 69 and 73; **check: P14-NF-66**. Here **clean** means the current checkout has no
tracked or untracked user work after applying one registered narrow residue list. **Merged** means
the current branch head's content is already in the current default branch. Patch-equivalent
history may prove that condition. A merged-pull-request observation may prove it only when its exact
head object identity equals the checkout's current head. **Unused** means no live session or index
lock, no current process whose working directory lies inside the checkout, no live run/delegation
owner and no active-build marker. Detached or unknown branches, dirty or unmerged heads, incomplete
enumeration, failed classification and every uncertain owner/process observation remain kept.
Staleness alone never makes a checkout reclaimable.

The holder schedules a bounded initial observation shortly after activation as well as its ordinary
cadence. Part Six retains the due debt across process restarts, so repeated restarts cannot reset the
first observation indefinitely. Each pass has a finite reclaim count. Consecutive failures for one
checkout enter the shared Part Six breaker and leave that checkout visible and kept; a restart cannot
erase that pressure. Immediately before mutation, the confined driver re-reads the current branch
and head, clean state, merge evidence, owner/process/lock state and build marker. Any change or read
failure refuses the operation. Reclamation is a non-forced, enumerated Part Eight `git-mutation`
effect through Part Ten's confined driver. It removes only the reconstructable checkout; it does not
delete the branch or commits and never terminates a durable run. The full production unused-process
join is **non-executable until the ledger #40 grant in `seam-response-assembly-followup.md` lands**.
The complete worktree population, branch/head/merge, cleanliness, lock, build-marker, file-activity
and action-time re-observation positives are **non-executable until the ledger #50
worktree-observation grant in `seam-response-assembly-followup.md` lands**.
The mutation positive is **non-executable until `seam-response-effects-payloads.md` and
`seam-response-assembly-followup.md` land**.

**Rule — reaping disposes of a worker, never its work.** Rules 7, 15, 26, 60, 61, 63, 68 and 97;
**checks: P14-NF-28/30/32/35/42–46/57/59**. Eligibility is re-resolved at effect validation and excludes the
minimal-plane reserve, a worker holding active or uncertain work, open delegation, current
commitments, compaction recovery, provider-throttle recovery, explicit protection, operator stop
processing and any case whose identity is uncertain. Age or pressure makes a candidate due for
assessment, not disposable.
Successful worker closure leaves the durable run alive until its own exit test passes or a bounded
recovery/reassignment record owns it. `ReapLog`-style historical occurrence remains distinct from
the live eligibility projection.

The session reaper requires affirmative idleness through two confirmation phases. First, a fresh
worker observation must show a ready-for-input state and no active-work marker. The relevant
transcript, process and durable progress observations must also be current and unchanged. Missing
evidence or the absence of activity alone is not affirmative idleness. The same exact worker must
then remain eligible across the plan's required observation count and finite confirmation window.
Part Nine records the observations. Part Five supplies current work state. Part Six retains the due
and candidate history across worker restart.

**Reap-pending** is the finite grace state entered only after sustained candidacy. It is not
permission to terminate. At every due tick during grace, the holder performs the full classification
again and re-resolves every exclusion, owner, worker identity and relevant activity source. Resumed
or changed activity aborts reap-pending and resets candidacy. Missing or stale evidence does the
same. At grace expiry, only one more fresh full all-clear evaluation may request the typed Part Eight
process-control effect. The confined Part Ten driver still performs its separate action-time identity
and eligibility revalidation.

A normal typed refusal with an explained reason leaves that target running and does not disable
assessment of other candidates. An unexplained termination failure—an actuator exception or a
failed result without the required typed reason—stops the Part Six reaper loop and inhibits the Part
Ten effect-capable binding for every later session-reaper action until owner-visible repair and
review. It does not get treated as an ordinary candidate refusal. P14-NF-28/30's production
observation and actuation positives are **non-executable until
`seam-response-assembly-followup.md` and `seam-response-effects-payloads.md` land**. The pure
classification, grace-abort and explained-versus-unexplained disposition cases remain separately
executable against their landed owners.

**Rule — duplicate retirement preserves reachability and waits for observed drain.** Rules 14, 15,
26, 42, 55, 61, 63, 68, 77, 87 and 95; **checks: P14-NF-28/32/35/36/43/47/67**. **Duplicate
retirement** means closing a losing worker copy only after another machine is proved to be the
current conversation owner with a fresh live serving worker, while the durable work remains owned.
The 1.x cooperative stand-down path is retained as guarantees and re-expressed through the 2.0
owners. Five supplies current runs, builds, delegations, autonomous work and pending result
destinations. Six supplies ownership, lease/fence admission, a finite confirmation period, recovery
and shared breaker pressure. Eight supplies one-voice effect/message admission and the granted
`harness-operation` graceful-close arm. Ten supplies exact worker observations, binding inhibition
and the confined close driver.

Automatic retirement requires fresh remote-owner liveness from distinct advancing observations,
current ownership agreement, and no newer local inbound unless that inbound was durably diverted to
the proved owner. Unknown, stale, failed or contradictory ownership/liveness withholds retirement.
If every live copy appears held, or the pool view is unreadable, the bounded recovery releases at
least one hold toward user reachability; it may temporarily permit duplicate workers rather than
silence the conversation. Eight still re-resolves current speaker authority for every outbound
effect. A changed owner, dead remote worker or fresh undivertable local inbound releases the local
hold immediately.

A live build, live helper or autonomous run on the losing copy is **contested work**. Contested work,
an unknown contested-work read, a protected/minimal-plane role or an uncertain in-flight effect
refuses automatic hold and close. It opens one operator-visible action item and leaves the worker
able to continue; the system does not freeze a build between tool calls or manufacture consent to
suspend an autonomous run. For an uncontested duplicate, Six refuses new claims under the losing
lease/fence while an already-claimed step may settle. Consecutive observations must then establish
that no tool, helper, input, output, transcript or effect work remains in flight. Only that observed
drain permits one Eight `harness-operation` graceful-close request through Ten. Timeout or
unprovable drain leaves the duplicate and action item visible; it never escalates to a hard kill.
Repeated duplicate creation shares one persistent breaker pressure identity and cannot reset by
minting a new session.

P14-NF-67's policy/refusal neighbors are executable against the named owner contracts. Its real
graceful-close and production-driver positive is **non-executable until
`seam-response-effects-followup.md` and `seam-response-assembly-followup.md` land**. Its persistent
shared recurrence-pressure positive is **non-executable until `seam-response-loop-breaker.md`
lands**.

**Rule — no unbounded kill, swap, spawn, pause or notification exists.** Rules 52, 55, 60, 61, 63,
87 and 88; **checks: P14-NF-22/24/38/39/42–47/67**. First, every self-action class has finite
per-target, per-conversation, per-machine and total action budgets and concurrency limits; a
pool-wide action has a pool-wide bound. Second, every retry uses finite backoff, maximum attempts,
duration and breaker transitions. Third, deduplication uses a **causal episode**: the stable identity
joining observations and actions caused by one originating failure across retries, workers and
machines; a new local key cannot reset it. Fourth, exhaustion records a typed refusal, leaves an
owned gap and names the terminal owner. Notifications consume their own bounded aggregate budget
and group by the same causal episode.

**Rule — breaker claims stop at the landed Part Six boundary.** Rules 26, 45, 55, 61, 69 and 95;
**checks: P14-NF-43/47/49/66/67**. The landed `LoopPolicy` can presently enforce only `maxAttempts`,
`minDelay`, `maxDuration`, `timeout`, `concurrency: 1`, `failDirection: closed`, and
`breaker: stub-closed`; landed `LoopRecord` states are `scheduled`, `running`, `restoring`,
`waiting`, and `stopped`. It has no open/closed transitions or **half-open** state—a bounded trial
after the breaker's pause in which only the declared trial count may run and its evidence either
closes or reopens the breaker—nor cooldown, failure-threshold, half-open trial budget, or pressure
identity shared across targets, conversations, machines and the pool. Part fourteen therefore
depends on the additive Part Six contract requested
in `.instar/lanes/design-sentinel-holders-seam-request-loop-breaker.md`, request
`P14-P6-shared-recovery-breaker-v2`. This seam is GRANTED but not landed.
P14-NF-43/47/49/66/67 are **non-executable until
`seam-response-loop-breaker.md` lands**. Until that grant lands and its shared-pressure fixture
passes, automatic repeated self-action is inhibited after the first admitted attempt; a holder
cannot claim a breaker by keeping a private counter.

---

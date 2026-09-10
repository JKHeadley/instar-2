## 11. Operator decisions and honest limits

**Value — decision 1: what to do with missed work.**

Question: When a repeating job misses several scheduled times, should it run once for the newest
missed time or run none of them?

Choices: Run once for the newest missed time, or record every missed time without running.

What it changes: Running once catches up useful maintenance and observation work; running none
avoids a late send or action whose usefulness has already expired.

Recommendation: Run once for maintenance and observation work, but run none for time-sensitive
sends or actions because a late action may be misleading or harmful.

**Value — decision 2: repeated local times when clocks change.**

Question: When a local clock repeats the same time during a seasonal clock change, should the job
use the earlier occurrence, the later occurrence, or both?

Background: In some places, the clock moves backward once a year, so a time such as 1:30 a.m.
happens twice.

Choices: Use the earlier occurrence, use the later occurrence, or run at both occurrences.

What it changes: The first two choices keep one daily run but choose a different real instant;
the third choice deliberately runs twice on that day.

Recommendation: Use the earlier occurrence because it best matches the ordinary expectation of
one daily job and stays predictable.

**Value — decision 3: what to do when usage information is unavailable.**

Question: When the system cannot see how much model usage remains, which new jobs should wait?

Background: A provider may temporarily stop reporting its usage limit even though the account is
still usable or may already be near its limit.

Choices: Pause only low-priority jobs, pause low- and medium-priority jobs, or pause all new model
work.

What it changes: A narrower pause keeps more work moving but risks using scarce capacity; a wider
pause protects capacity but delays more work.

Recommendation: Pause low-priority work, allow medium- and high-priority work only within a small
fixed allowance, and require a separately confirmed reserve for urgent work because this balances
continuity with spending safety.

**Value — decision 4: service under heavy demand.**

Question: Under sustained heavy demand, how much capacity should maintenance receive and how long
may ready urgent work wait?

Choices: Give maintenance at least 10 percent and cap urgent waiting at 30 seconds; give
maintenance 20 percent and cap urgent waiting at 60 seconds; or give maintenance 25 percent and
cap urgent waiting at 120 seconds.

What it changes: More maintenance capacity prevents upkeep from starving, while a shorter urgent
wait moves important work sooner and leaves less room for maintenance.

Recommendation: Choose 20 percent and 60 seconds because it gives maintenance a meaningful share
without allowing urgent work to wait indefinitely.

**Value — decision 5: restarting a repeatedly failing job.**

Question: After repeated failures automatically pause a job, should it try one small test after a
cool-down or wait for a person to restart it?

Background: The pause stops a broken job from wasting resources; a small test can show whether the
problem has cleared without reopening full traffic.

Choices: Allow one limited test after the cool-down, or require a confirmed person to restart the
job.

What it changes: The limited test restores reversible and observation-only work sooner; requiring
a person is slower but safer for actions that cannot be undone or that change permissions.

Recommendation: Allow one limited test for reversible and observation-only work, but require a
person for irreversible or permission-changing work because the cost of a mistaken restart is much
higher there.

**Value — decision 6: how long to read old job definitions.**

Question: For how many published update cycles should old job definitions remain readable?

Background: An update cycle is one published version and the period in which supported
installations move to it.

Choices: Support old definitions for one update cycle, two update cycles, or indefinitely.

What it changes: A longer window gives installations more time to move, but indefinite support
keeps two competing ways to describe and control the same work.

Recommendation: Support two update cycles because that gives a practical migration window without
keeping the old control path forever.

**Value — operator note: keeping supervision efficient.** Every step of a high-risk workflow is
watched and validated. The benchmark process chooses the least expensive model that has passed the
quality and safety bar for that kind of work; savings come from model choice, never from leaving a
step unwatched.

**Value — honest limits and costs.** Calendar correctness still depends on the selected time-zone
data and clock source. Exactly-once scheduling cannot prove exactly-once external effects. A total
loss of the required durable fact replicas can lose obligations within the declared loss model.
Opaque providers can leave quota, charge, or execution unresolved. Strong fencing and source-aware
capacity reduce availability during partitions and telemetry outages. Complete occurrence history,
independent probes, model supervision and retained uncertainty consume storage, latency and money.
No check decides that those costs are worthwhile for every installation.

**Rule — technical completion is not approval or runtime certification.** Rules 34, 65, 82, 90
and 109; **checks: P15-NF-02/52** and the governed review process. This document claims no
deployment, live holder, measured performance, review convergence or operator approval.
Implementation becomes eligible only after this exact design independently converges and the
operator records approval. Implementation does not itself establish a live claim. Activation and
runtime certification then require section 8's real unit, full-port integration, multi-machine,
fault-cut, load, isolation, semantic-review and production-lifecycle evidence. Approval is separate
from both technical construction and live evidence.

*Depends on: Part one — constitutional values; Part two — the fact envelope; Part three — the
register; Part four — intake; Part five — the durable run graph; Part six — transport, leases,
loops and recovery; Part seven — the judgment doorway; Part eight — the effect doorway; Part nine
— verification holders; Part ten — assembly; Part eleven — operator surfaces.*

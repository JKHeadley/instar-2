# Change review — release unused setup capture capacity

Subject base: 42d2305dd7f52f4121ba7b24b6a005e4e36c0aaf
Review state: open
Reviewed content: none
Outcome: A failed setup claim or refused exchange before physical invocation returns its unused capture reservation so repaired admission can run within the same finite capacity.
Affected rules: 1, 26, 37, 41, 42, 49, 60, 70, 74, 75, 101, 102, 111, 113, 116
Affected floors: Secrets remain outside this route; spend cap remains zero; existing stop and Six admission stay enforced; no duplicate sends or automatic retries are introduced; durable intake, request captures and transport evidence are retained. Capacity remains held for potentially executed work.
Operator questions: none
Suggested tier: significant
Declared tier: ordinary
Tier rationale: Small repair of the gated composition's reservation lifetime, using the capture owner's existing release operation; no model contract, authority or installed route changes.
Side effects: Pre-dispatch failure now writes the existing durable release marker. Full capacity remains reserved after physical execution starts, even if execution throws or storing its capture fails. Owner refusal of release remains a failure, never success.
Undo and recovery: Revert the source repair to restore prior behavior without altering evidence. Existing released slots keep their owner-defined meaning. This repair does not reclaim old stranded reservations or uncertain executed work; it prevents new pre-dispatch leaks.
Multi-machine posture: Deliberately installation-local, matching existing setup captures. No shared authority or peer durability demand changes, and no cross-machine cleanup is introduced.
Layer below: Inspected Seven ModelAdapter admission/consume/invoke order, Six's single-use claim and durable state, and createJudgmentCaptures reserve/putReserved/releaseReserved. Release is issued-token checked, durable and refused for bound slots. Actual Six/Seven and file capture owners are exercised together in the regression fixture.
Bug class: integration
Bug evidence: reproducer=tests/assembly/setup-supervisor-seven.test.ts
Hook bypass: none
Convergence: none
Decision: supervisor-1025b-repair-D1 | Release through the existing capture owner only on failure with a reserved slot and zero physical invocations; retain all request/transport evidence and potentially executed capacity. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/install-supervisor-1025b-repair-173551-PROGRESS.md
Prompt review: No prompt, response parser, model disposition or acceptance/escalation/refusal contract changes. This repairs resource cleanup after an already established refusal. Existing recorded-shape qualification limits remain as disclosed in the original unit review.
Validation: Eight targeted tests cover fresh success, failed claim then repair, expired exchange then repair using the same unconsumed Six claim, retained request and transport evidence, exhausted capacity, physical failure with uncertain receipt, and capture-write failure after execution. The two new pre-dispatch tests failed on the original implementation before the repair. No full suite, paid call, live installation or release qualification is claimed.

## Closing block

simplestRobustRoute: This is the simplest route: reuse releaseReserved in the failure path with the existing physical-call counter. The owner enforces unbound-only release. No store, retry, larger cap or recovery service is added. Admission and capacity remain start guards; durable capture remains the successful end guard; an invocation that may have executed keeps its full reservation. Evidence is targeted composition testing, not unattended installed-release qualification.
80/20: The single must-fix is repaired at its source with paired recovery and retained-capacity tests. Submit to the independent desk gate with the existing qualification boundary intact.
VERDICT: author repair submission; independent desk gate required

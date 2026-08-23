# Step one — the rules, and how a computer checks each one

**Status: draft, awaiting approval. Nothing is built on top of this until it is approved.**

Every rule from Instar 1.x's constitution, sorted by one question: *can a computer decide
whether we followed it?*

This document is deliberately written in plain language throughout. Our own rule says every
document ships with a plain-language twin — I'd propose changing that rule to "every document
must be readable as-is, and a technical version needs a plain twin," because a twin of this
would just be a copy of it. That's the first correction the rules earned from contact with
real work.

---

## How to read the four groups

**Checkable now.** A script or a rule in the build can decide pass or fail today, with nothing
new built first.

**Free from the core.** Not checkable on its own — but if the core is built so that everything
of a certain kind has to pass through a single doorway, the rule becomes automatic and the only
check needed is "nothing went around the doorway." These are the payoff for building a small
core, stated as a number.

**Needs building.** Checkable in principle, but something has to be built first.

**A value.** Genuinely a matter of judgment. No check will ever enforce it. Saying so out loud
is the point — a value pretending to be a rule is how a constitution rots.

---

## The numbers

| Group | Count |
|---|---|
| Checkable now | 19 |
| Free from the core | 9 |
| Needs building | 50 |
| A value | 11 |
| **Total** | **89** |

Nineteen of eighty-nine can be checked today. That is the honest starting position, and it is
roughly what 1.x's own record shows: 92 checks in the running system, 20 confirmed on.

---

## Three things that fell out of doing this

**1. Fourteen rules are waiting on the same one thing: a list.**

Rules 4, 7, 9, 32, 33, 36, 39, 43, 57, 62, 66, 72, 73, 79 all say some version of *"every X must
do Y."* Not one of them can be checked, because nothing anywhere enumerates the X. There is no
list of the stores, the features, the places that can block, the things a person has to approve.

So the single highest-value piece of machinery in the whole project is boring: **a register of the
things being governed.** Build it once and fourteen rules become enforceable. Skip it and those
fourteen stay wishes no matter how well they're written.

This is also, precisely, how 1.x got to twenty-of-ninety-two. Every one of those rules was written
sincerely. None of them could ever fire.

**2. Five rules are blocked on an undefined word, not on machinery.**

Rules 34, 38, 43, 62 and 76 hinge on *significant*, *critical*, or *user-facing*, and none of those
words is defined anywhere. 1.x's own registry admits this in writing. The rules are otherwise ready
to enforce.

That's the cheapest win available. Defining three words unblocks five rules. No code required.

**3. Several rules stop needing a check at all if you make them a type.**

Rules 13, 28, 29, 40, 42 are all currently prose that someone has to remember. Each of them
becomes automatic if the thing it governs is a type the compiler understands — a verified
principal that can't be faked from a name in a document, a refusal that can't be turned into a
success, a measurement that carries what it measured.

That's the strongest version of "structure beats willpower": not a check that runs, but a mistake
you can't express.

---

## What I want from you on this document

Three questions, and none of them need a long answer:

1. **Do the four groups make sense as a way of sorting?** If "free from the core" feels like
   cheating, say so — it's the group I'm least sure about, because those nine are only free if we
   actually build the core that way.
2. **Are any of the eleven values in the wrong group?** I'd rather be told a value is really a rule
   than quietly let something enforceable get filed as a matter of taste.
3. **Should the three findings above become the first work, ahead of anything else?** My view: yes,
   in that order. The list, then the definitions, then the types.

---

### Checkable now — 19 of 89

| # | Standard | The check |
|---|---|---|
| 1 | Structure beats Willpower | The aggregate enforcement-coverage ratchet, with a floor CI refuses to let drop. A proxy for the rule, not the rule itself — flag it as such. |
| 5 | Documentation IS Being | Every shipped module has a documentation node. A coverage script over the module list. |
| 30 | Framework-Agnostic — and Framework-Optimizing | No comparison against a harness name outside an adapter. A grep-level lint, and the single check 1.x most needed and never had. |
| 35 | Test Identity Never Enters Production State | Test identities are refused at the write path into any production store. |
| 37 | Zero-Failure | Run the suite. It is green or it is not. The cleanest check in the whole set. |
| 44 | Migration Parity | A change touching agent-installed files must include a migration. A rule over which paths the change touched. |
| 47 | Compaction Parity | Everything injected at session start is also injected after compaction. Compare the two lists. |
| 49 | Constitutional Traceability — No Unconstitutional Work | Every spec names the standard it serves. A front-matter check. |
| 52 | Bounded Notification Surface — no feature may flood the user | A hard budget at the point where notification containers get created, plus a burst test that fails the build if the bound breaks. |
| 53 | Notices Route to the Alerts Topic, Never a New One | No code path creates a new container for a notice. A lint at the chokepoint. |
| 56 | Keep the Doorway/Model Map Current | The map's age. Older than its refresh window and it fails. |
| 59 | Stall Coverage Is Enumerated, Not Discovered | Onboarding a harness requires the stall matrix; the transition refuses without it. Already works this way in 1.x. |
| 65 | Iterative Audit to Convergence | A claim of 'converged' must carry a machine-written convergence record. Already enforced in 1.x. |
| 69 | References Run From Both Ends — the Registry Names the Code, the Code Names the Standard | The registry names the code and the code names the standard, and both directions resolve. |
| 71 | No Deferrals | A deferral phrase in a change requires a tracked commitment in the same change. |
| 74 | Side-Effects Review Gate | The review artifact exists for every change. 1.x already refuses commits and pushes without it. Existence is checkable; quality is not. |
| 75 | Token-Audit Completeness — An Unmetered LLM Call Is an Unaccountable One | Every model call carries an attribution tag. A lint that ratchets. |
| 81 | Dashboard UX Standard — Reachable, Self-Explanatory, Responsive | Eleven objective floors, already enforced in CI in 1.x. |
| 83 | The Agent Carries the Loop | A commitment cannot be created without declaring who owns it and what it waits on. Refused at creation. |

### Free from the core — 9 of 89

| # | Standard | The check |
|---|---|---|
| 41 | Observable Intelligence — No Autonomous LLM Action Is Unauditable | Free once every model call goes through one doorway that records it. The check becomes: nothing imports a provider directly. |
| 55 | No Unbounded Loops — Every Repeating Behavior Carries Its Own Brakes | Free once looping is only possible through one primitive that carries backoff, a cap, and a breaker. The check becomes: nothing loops any other way. |
| 58 | Decision Provenance & Outcome Review | Free from the same doorway as #41. The recording is the doorway's job, not each feature's. |
| 60 | Bounded Blast Radius | Free once every resource-consuming operation goes through one funnel that holds the ceiling. |
| 61 | Capacity Safety — No Unbounded Self-Action | Free from the same funnel as #60, applied to actions the agent triggers on itself. |
| 63 | Ownership-Gated Side Effects | Free once anything creating a session or firing a topic-scoped effect passes one admission point that checks ownership. |
| 67 | No Silent Degradation to Brittle Fallback | Free once the gate primitive has no fallback path to a dumb heuristic — it swaps provider or it fails. |
| 78 | No Manual Work (user *or* agent) | Free once the capability list is generated from the modules rather than hand-written. The check becomes: no hand-maintained capability list exists. |
| 84 | Agent Awareness | Free from the same generation as #78. A hand-maintained briefing is exactly how 1.x lost this one. |

### Needs building — 50 of 89

| # | Standard | The check |
|---|---|---|
| 2 | Self-Hosting | Inventory every tool needed to build the project; assert each ships in the product and runs on every supported harness. |
| 4 | Structure Decides Alone Only on an Exact Match | Enumerate every site that blocks without asking the mind; assert each is on the exact-match allowlist. Needs a blocking-site registry. |
| 6 | Deferral = Deletion | A change containing a deferral must carry a tracked commitment in the same change. Diff scan plus a registry lookup. |
| 7 | Archiving May Never Mean Deleting | Every store that bounds its own growth declares whether it compacts or deletes; deleting agent memory fails. Needs a store registry. |
| 8 | Close the Loop | Every opened loop carries a re-surfacing cadence. Needs a loop registry with a due date per entry. |
| 9 | Observation Needs Structure | Every 'the system must notice X' duty names the artifact that proves the looking happened. Needs the duties enumerated. |
| 10 | Intelligence Infers, Keywords Only Guard | No decision about what a person meant branches on a literal string. A lint over decision sites. |
| 11 | Recall Over Our Own Material Is by Meaning, Not by Word-Match | Retrieval over our own stored material uses meaning-based search, not substring. A lint over the retrieval call sites. |
| 12 | Intelligent Prompts — An LLM Gate Must Not String-Match | No gate prompt contains a literal phrase copied from a test case. A scan over prompt text. |
| 13 | Quantitative Claims Must Bind a Subject | A numeric comparison carries both the measurement and what was measured. Enforced by making measurements a type rather than a number. |
| 14 | The Operator Channel Is Sacred — Critical-Path Gates Fail Toward Delivery | Every gate on the inbound message path defaults to letting the message through when it cannot decide. Needs the inbound gates enumerated. |
| 15 | The Agent Is Always Reachable — A Guaranteed Reachability Floor | A live probe asserting at least one reachable session exists that resource limits cannot deny. |
| 20 | A Wall Is a Hypothesis | A feasibility claim cannot be recorded until a stored exhaustion run shows every avenue came up empty. |
| 21 | Never a False Blocker | Same machinery as #20, applied to blockers rather than feasibility claims. |
| 22 | The Stop Reason Is the Work | An autonomous run that stops for a judgment reason must file that reason as a work item before it exits. |
| 23 | Self-Unblock Before Escalating | An escalation must be preceded by a stored exhaustion run. Refuse the escalation otherwise. |
| 24 | Distrust Temporary Success — A Recurrence Is a Root Cause | Count fixes per area over time; a repeat fix in the same place requires a root-cause record. Needs recurrence tracking. |
| 26 | Verify the State, Not Its Symbol | No detector decides from a string, label, or filename alone. A lint over detector sites — high value, and one of the most common real failures. |
| 27 | A Dispatch Supplies the Question and Withholds the Answer | A delegated question must not contain the answer you expect. A scan of dispatch prompts. |
| 28 | Know Your Principal — An Unverified Identity Is a Guess | Authorization functions accept only a verified-principal type. Once that type exists the compiler enforces it for free. |
| 29 | Session Input Is a Principal | Same type as #28, applied to input arriving inside a session. |
| 31 | Cross-Machine Coherence — One Agent, Robust Under Degraded Conditions | Coherence has to hold on loaded machines and flaky networks, so it needs a fault-injection harness that simulates those. |
| 32 | An Instar Agent Is Always a Multi-Machine Entity | Every state surface declares its machine scope; a new store without one fails. Needs a store registry with a required field. |
| 33 | Cross-Store Coherence Is an Invariant | Any two stores answering the same question declare how they must agree, and that agreement is tested. Same store registry. |
| 34 | Testing Integrity | Three test tiers per significant feature — blocked on 'significant' having no definition. Define the trigger and this becomes checkable today. |
| 36 | Scrape/Parser Fixture Realness — feed the parser the REAL bytes | Every registered parser has a test feeding it real captured bytes. Needs a parser registry, which is small and easy. |
| 38 | LLM-Supervised Execution | Blocked on 'critical' having no definition, exactly like #34. |
| 39 | Observability — you can't tune what you can't see | Every feature ships with metrics — needs the features enumerated before 'every' means anything. |
| 40 | Expected Capacity Enforcement Is an Outcome, Not a Degradation | A store that applied its budget as designed records success, not degradation. Enforced by the return shape. |
| 42 | A Refusal Stays a Refusal — conservation of negative outcomes | A refusal is its own type that cannot be turned into a success. Compiler-enforced once the type exists. |
| 43 | Runtime End-to-End Proof — the canary standard | Every critical outcome has a live end-to-end probe. Needs the outcomes enumerated. |
| 45 | Migration-Consumer Completeness | When an authority is replaced, every consumer of it moves in the same change. Needs a consumer graph. |
| 46 | Canonical Pipeline Operational Completeness — Accepted Intake Must Drain | Anything accepted into a pipeline drains; backlog age stays bounded. A runtime assertion. |
| 57 | Judgment Within Floors | Every model-made judgment sits inside a deterministic safe action space. Needs those judgment points enumerated. |
| 62 | Live-User-Channel Proof Before Done | A user-facing feature needs a signed record of a real end-to-end run before it can be called done. Needs 'user-facing' defined and the harness built. |
| 64 | Autonomous Throughput Floor | A surface that makes a stalled autonomous run visible without anyone watching for it. |
| 66 | A Decision That Can Block Must Live Where the Checks Can See It | Every blocking site sits inside the population the checks actually inspect. Needs the same blocking-site registry as #4. |
| 68 | An Autonomous Run Must Outlive Its Session | A registered run with time left always has either a live session or a queued revival. A reconciler assertion. |
| 70 | Bug-Fix Evidence Bar (verify before you claim) | A fix carries evidence of the specific kind its class requires. Needs evidence to be typed rather than prose. |
| 72 | Maturation Path — Test Agent → Development Agent → Fleet | Every gated feature declares its graduation test and its deadline, and the deadline is enforced. This is the direct fix for 20-of-92. |
| 73 | A Dark Feature Guards Nothing | Same machinery as #72. |
| 76 | User-Facing Fixes Ship Live | A fix classified user-facing may not ship behind a dark gate. Needs the classification to exist. |
| 77 | The User Experience Is the Product — Reachability, Responsiveness, and Coherence Are Sacred | Reachability and response time are measurable. Whether a response was coherent is not, and the ranking against internal caution is a judgment. |
| 79 | Mobile-Complete Operator Actions | Every action needing the operator has a surface they can reach from a phone. Needs the operator-actions list cross-checked against the dashboard. |
| 82 | Agent Proposes, Operator Approves | An authorization request arrives pre-filled and rendered in plain language. Checkable once requests are structured objects. |
| 85 | Never-Waste Feedback — corrections compound | A correction produces a durable record. Needs correction detection to be wired rather than optional. |
| 86 | Signal vs. Authority | Only a full-context gate may block; a brittle filter may only signal. Needs the blocking-site registry again. |
| 87 | Near-Silent Notifications | Only action-required or result-bearing messages push. Needs messages classified at the outbound doorway. |
| 88 | Self-Heal Before Notify — The Operator Hears Only When Self-Healing Fails | An operator notice must reference a self-heal attempt that failed. Enforced by the notice type requiring that field. |
| 89 | Truthful Provenance — Speak Only as Yourself | Outbound messages carry signed provenance. Signing has to be automatic, which it is not in 1.x. |

### A value — 11 of 89

| # | Standard | The check |
|---|---|---|
| 3 | The Body and the Mind | A statement about where authority lives. Its one checkable arm is the blocking-site inventory, which belongs to #4 and #66. |
| 16 | Name the Gravity Wells | The enumeration existing is checkable; noticing yourself falling into one is not. |
| 17 | Architectural Agency in the Gap | A disposition. Nothing to check. |
| 18 | Sovereignty — "I own what is mine" | The judgment 'is this mine?' is not mechanical. Consulting the owned-identities record is, and that belongs to #23. |
| 19 | The Right to Stand Ground | A disposition. Nothing to check. |
| 25 | Remove What Demands Attention. Do Not Supply More Attention. | What to do about a recurrence is a judgment. The recurrence signal from #24 is the input, not the answer. |
| 48 | Tiered Development | The standard says it informs rather than gates. Honest, and honestly unenforceable. |
| 50 | Friction Is a Spec — Productize the Workaround | Whether a workaround deserves productizing is a judgment. |
| 51 | Notice + Solve Inefficiencies — Efficiency Is a Standing Search | A standing habit. Nothing to check. |
| 54 | Conservative Outbound: Act, Don't Notify | Whether this particular message should act or notify is a judgment. Requiring a stated reason for notifying is a weaker checkable arm. |
| 80 | Operator-Surface Quality | Whether a surface is genuinely clear is a judgment. #81 is the floor underneath it. |
---

*Source: the 89 standards in Instar 1.x's `docs/STANDARDS-REGISTRY.md`, read on 2026-08-23.
Every count in this document came from that file, not from recollection.*

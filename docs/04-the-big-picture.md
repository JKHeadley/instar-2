# The big-picture design — a small core with nowhere to go around it

**Status: draft, awaiting approval. Governed. No part design or code is built on top of this until it is approved.**

Instar is an agent operating system: it receives a principal's intent, keeps work alive across
sessions and machines, lets a model make bounded judgments, changes the world through explicit
doorways, and learns from what happened. The design is small because the constitution is large.
Instead of asking every feature to remember 115 rules, the system gives each kind of action one
path and makes that path hold the rules for every caller.

This document is the plain-language design. Every architectural claim is marked either **Rule**
(with the constitutional rules that require it and the check that holds it) or **Value** (a
deliberate choice the constitution does not force). There is no unlabeled third category.

---

## The whole system in one picture

```text
 people, agents, schedules, services
                 |
          [1. intake doorway]
                 |
        verified principal + intent
                 |
        [2. durable work engine] <------ timers / recovery / another machine
                 |
          proposed next action
                 |
      +----------+-----------+
      |                      |
 [3. judgment doorway]   deterministic step
      |                      |
      +----------+-----------+
                 |
        typed result or refusal
                 |
          [4. effect doorway]
                 |
       world / channel / state
                 |
        outcome + evidence ledger
                 |
   checks, sentinels, retrospective review
                 |
      real cases -> benchmark -> better routing

 All six boxes read one generated register and append to one history spine.
 Adapters translate harnesses, providers, channels, stores, and external services at the edge.
```

The core is not the features. It is the narrow waist every feature must pass through: identity,
durable work, judgment, effects, facts, and verification. Telegram, Claude Code, Codex, SQLite,
GitHub, and any model provider are adapters. They can change without changing what a verified
principal is, what a refusal means, or what evidence an effect must leave.

**Rule — one narrow waist.** Rules 1, 30, 41, 55, 58, 60, 61, 63, 69, 75, 89, and 113 require
the shared machinery and adapter boundary. **Check:** code outside an adapter may import only core
ports, and every governed action kind has exactly one registered doorway. A dependency test fails
on a provider or harness import outside its adapter.

**Value — six core responsibilities.** The constitution demands funnels but does not dictate
their package boundaries. Six responsibilities are the smallest split that keeps identity,
work, judgment, effects, facts, and verification independently testable without inventing a
service for every rule.

---

## 1. The constitutional types

The innermost package contains values that make forbidden states hard or impossible to express.
It has no network, filesystem, clock, process, model, or framework dependency.

The first types are:

- `VerifiedPrincipal`: identity resolved from an authenticated adapter, never from message text.
- `StandingGrant`: what that principal may decide, for which scope, who granted it, and when it
  expires or is revoked.
- `Intent`: the authenticated request plus its directive lineage; it remains live until completed
  or superseded.
- `Result<T> = Success<T> | Refused`: refusal is a first-class result that no layer can silently
  convert into success.
- `Measurement<Subject>`: a value inseparable from what it measured.
- `Profile`: consequence, reversibility, reach, and surface; the glossary's derived words are
  computed from it, never separately declared.
- `Evidence`: a typed claim, its source, subject, time, and freshness.
- `Decision`: conclusion and reason as separately falsifiable claims.
- `Authorization`: an explicit yes bound to a principal, scope, artifact hash, and current base;
  absence can never construct one.

**Rule — types hold invariants.** Rules 13, 28, 29, 40, 42, 57, 90, 93, 98, 100, 103, 104,
108, and 109 require these distinctions. **Check:** compile-time negative fixtures prove that an
unverified identity, mismatched measurement, expired approval, swallowed refusal, or unversioned
governing fact does not type-check. Runtime decoders reject the same invalid shapes at every
adapter boundary.

**Value — functional center.** The type package is immutable data plus pure transformations.
Effects sit outside it. This is a design choice, not a constitutional rule; it makes the kernel
portable and its decision boundaries exhaustively testable.

---

## 2. One fact and history spine

The system has one logical append-only sequence of facts. A fact says what occurred; projections
turn facts into current views such as active runs, open commitments, standing grants, register
entries, spend, and last-known ownership. A projection can be deleted and rebuilt from facts.
The facts themselves are not rewritten.

“One logical sequence” does not mean one physical database. An adapter may store segments on
several machines, but every fact carries a stable id, causal predecessor, machine, principal,
schema version, and content hash. Reconciliation is deterministic and records conflicts rather
than choosing a winner silently.

The generated register is a projection of declarations and facts. It is the authoritative index
of governed things, but not a second authority about what happened. Governed histories, including
the rule book and glossary, use the same version chain: `since`, `supersedes`, and `approvedIn`.

**Rule — history is reconstructable.** Rules 7, 15, 24, 32, 33, 41, 45, 58, 69, 75, 85, 89,
90, 94, 100, 108, 112, and 113 require durable, attributable, versioned evidence. **Check:** every
fact schema is registered; append is the only write port; projection rebuilds are compared with
live projections; cross-machine reconciliation tests cover reorder, duplication, partition, and
conflict; every governing version resolves to its approval commit.

**Value — event history plus projections.** The rules require lookup-able history, not event
sourcing by name. This shape is chosen because it lets current state stay cheap while preserving
the evidence needed for audit and recovery.

---

## 3. Intake is the first doorway

Every stimulus enters through one intake port: a user message, scheduled tick, webhook, peer-agent
request, operator approval, or recovery signal. Its adapter authenticates the source and preserves
the raw input before interpretation. The doorway resolves principal and standing, reads the real
clock, loads the conversation's complete recoverable history, and creates or advances durable
work. It never grants authority from prose.

The intake record separates four things that are easy to blur: what arrived, who authenticated,
what they asked, and what standing permits. A request beyond the sender's standing becomes a
pre-filled authorization request; it is neither guessed into permission nor discarded.

**Rule — grounded authenticated intake.** Rules 4, 14, 23, 28, 29, 36, 42, 46, 83, 93, 96, 98,
100, 103, 104, and 110 govern this doorway. **Check:** every adapter must pass the shared intake
contract suite; accepted-input backlog age is bounded; raw input has a durable reference before
processing; session-start evidence includes history coverage, current clock, authenticated
principal, and last inbound id.

---

## 4. Work is durable; sessions are workers

A unit of work is a durable run with an owner, directive, current step, exit test, cadence,
resource budget, retry policy, side-effect lease, and next wake time. A session is only one worker
that may hold the run for a while. Losing a session releases or expires its lease; it does not end
the run. Another worker or machine resumes from the last committed step.

Runs form a durable graph, not a flat queue. A session may create bounded child runs, and those
children may create children of their own. One useful topology is a conversation session whose
only job is staying with the user and steering an orchestrator; that orchestrator delegates to
specialist groups placed on the machine, harness, and model best suited to each task. It is an
official pattern, not a mandatory one. A small job may remain one run, and a different topology
may be chosen whenever the work calls for it.

Every edge records the delegated scope, authority, owner, budget, exit test, placement reason,
result destination, transport, and cancellation relationship. A child receives no authority
merely because its parent has it; the parent passes only the standing the child needs. Results
return as durable facts, so a dead parent or worker cannot strand them, and a replacement can
reconstruct the graph.

A child may be a session of this agent or a different agent. Crossing that boundary uses an
agent-transport port; the work engine does not know which protocol carries it. The edge maps its
parent and child run ids to the transport's durable conversation id, and the signed envelope
carries verified agent identity, delegated standing, scope, budget, evidence references,
cancellation, idempotency key, and the destination for results. The remote agent remains a
principal with its own standing, never a process that inherits the sender's identity.

Delivery is a state machine, not a boolean: `accepted-by-transport`, `durably-queued`,
`delivered-to-worker`, `answered`, `refused`, or `uncertain`. Each state names the authority that
can prove it. A relay accepting bytes is not worker delivery; worker delivery is not an answer;
and timeout is uncertain until reconciliation proves whether the remote effect occurred. Local
and remote children implement this same contract, so changing placement cannot change the meaning
of delegation.

Each step is a small state transition:

1. read the run and its evidence;
2. propose one next action;
3. obtain any judgment or authorization the action needs;
4. acquire an idempotency key and ownership lease;
5. perform the action through the effect doorway;
6. append the result and choose the next step.

Retries repeat the transition, not the unrecorded effect. Repetition uses one loop primitive with
backoff, cap, breaker, resource ceiling, and declared fail direction. A clock may stop unsafe
execution at a ceiling, but only the exit test completes the work.

**Rule — the run outlives the worker.** Rules 8, 20, 22, 24, 26, 27, 31, 46, 55, 60, 61, 63,
64, 68, 71, 83, 92, 93, 97, 99, 102, 113, and 114 govern the work engine. **Check:** model-based state
tests kill workers at every transition and prove the run either resumes or ends with a typed
blocker; graph tests kill parents, orchestrators, nested workers, and transports during fan-out and
collection; duplicate-worker tests prove a side effect and a child result are each delivered at
most once; transport tests prove every claimed delivery state from its authoritative record;
every stopped run cites a passed exit test or a proven-unreachable record with a recheck date.

**Value — step-sized commits.** The constitution requires durability and idempotence but not the
transaction size. One proposed action per transition limits replay ambiguity and makes recovery
records understandable to a person.

---

## 5. Judgment has one doorway

Features never call a model provider directly. They submit a `JudgmentRequest` containing the
registered judgment point, complete safe action floor, conservative default, relevant evidence,
scenario class, and deadline. The doorway chooses a model and provider from measured benchmark
results, or labels the route `unmeasured`. It records what the model saw and returned, after
credential scrubbing and under a declared retention policy.

The model may narrow the declared action floor; it cannot add an action. Provider failure returns
the judgment point's declared default and fail direction. A response is decoded into a typed
decision before any caller can act on it.

The doorway meters component, model, tokens, latency, price, subsidy basis, and outcome. The full
input and output remain local, scrubbed, access-controlled, and retention-bounded so later review
can reconstruct why the system acted.

**Rule — observable bounded judgment.** Rules 4, 38, 41, 56, 57, 58, 69, 75, 86, 95, and 108
govern this doorway. **Check:** provider SDK imports are adapter-only; each request resolves to a
registered judgment point and action floor; decision decoders reject out-of-floor actions; every
call produces an audit and meter record; benchmark and retention references resolve.

**Value — full local input/output by default.** Rule 41 requires auditability but does not specify
payload depth. This adopts the recommendation surfaced in the rules review: reconstruction is
more valuable than metadata-only logs, provided credentials are scrubbed and retention and access
are bounded.

---

## 6. Effects have one doorway

Anything that changes durable state or the outside world is an effect: sending a message, merging
a PR, writing a secret, starting a process, changing a file, spending money, or issuing a grant.
Every effect passes through one port with a registered kind and operation.

The doorway performs the same ordered checks:

1. verify principal and standing;
2. resolve the registered operation, profile, owner, and standards;
3. validate evidence and authorization against the exact artifact and current base;
4. apply the per-consumer fail direction;
5. acquire the ownership lease and idempotency key;
6. call the adapter;
7. append the result, including refusal or uncertain outcome;
8. schedule verification of the real-world result.

A blocked input is preserved. An uncertain outcome is never retried as if it were a clean failure;
verification asks the external system whether the effect happened first. Operator-facing notices
are themselves effects and pass through the same doorway, where provenance and notification
budgets are applied.

**Rule — controlled attributable effects.** Rules 4, 14, 18, 21, 28, 35, 42, 52, 53, 54, 60,
63, 66, 74, 77, 79, 82, 86, 87, 88, 89, 94, 95, 98, 100, 101, 103, 104, 106, and 113 govern
this doorway. **Check:** an architecture lint rejects direct adapter effect calls; every operation
has a register entry and profile; contract tests cover authorization, stale-base expiry,
idempotence, uncertain outcomes, input preservation, fail direction, provenance, and notification
ceilings.

---

## 7. Verification is continuous, layered, and registered

Checks are deterministic pass/fail programs. Sentinels are focused model judgments. Probes test
real outcomes through production surfaces. Retrospective reviews find patterns across evidence.
They are different holders and all are entries in the register.

Every rule has a verification plan with up to four arms:

- a build check for structural facts;
- a runtime invariant or probe for live behavior;
- a sentinel for judgment that cannot be reduced to a script;
- a retrospective review that looks across cases and grades outcomes.

The system generates a coverage matrix from rules to holders and back. A configured holder is not
alive merely because its file exists: it must emit a fresh proof of running. Significant features
carry unit, integration, and live lifecycle tests. Critical outcomes carry a production probe.
Every convergence review also audits the foundation one layer beneath its subject.

**Rule — proof, not configuration.** Rules 5, 9, 34, 37, 38, 39, 43, 44, 47, 49, 59, 62, 65,
69, 70, 72, 73, 74, 76, 78, 81, 84, 90, 105, 107, 109, 111, and 112 govern verification.
**Check:** the generated matrix has no unresolved edge; freshness checks prove each scheduled
holder ran; test-tier requirements derive from the glossary profile; a feature cannot become
`live` without its graduation evidence and, when user-facing, its production-surface proof.

---

## 8. Real outcomes improve the mind

The outcome grader connects a decision to what later happened. Retrospective findings become
candidate scenarios, and only real graded cases can enter the benchmark. A prompt, context,
model, or routing change reruns the affected scenarios. The measured result updates the
doorway/model map; a route without evidence remains visibly `unmeasured`.

This loop proposes changes but does not rewrite governing material by itself. A new rule, term,
register shape, or protected artifact goes through versioning and approval. Repeated waivers and
corrections are evidence that the rule or structure should change, not permission to ignore it.

**Rule — improvement keeps provenance.** Rules 10, 11, 12, 15, 24, 25, 41, 50, 51, 56, 58,
65, 69, 85, 90, 94, 108, and 111 govern the loop. **Check:** benchmark scenarios require a real
case and grade; affected prompt hashes require a fresh run; proposals cite their evidence;
governing changes require a new version and approval record.

---

## 9. Self-hosting and local evolution

Instar is developed through Instar. The tools used to inspect, design, implement, test, review,
and install the platform are product capabilities available to every agent. The official source
is one upstream, not the ceiling of an individual agent: an agent may build and install a local
capability package against the same public ports, register it, test it, mature it, and carry it
forward across updates without waiting for the upstream project to adopt it.

The pattern is fractal. The whole platform improves from observed outcomes, and each agent,
feature, run graph, and specialist group has the same smaller loop: observe friction, preserve the
case, propose a bounded change, verify it, graduate it, measure the outcome, and feed the result
back. Local evolution never means an untracked fork: provenance names its parent and version,
migrations preserve it, protected artifacts retain their approval boundary, and useful local
capabilities can be proposed upstream without being coupled to upstream acceptance.

**Rule — the platform is its own development environment.** Rules 2, 5, 24, 25, 30, 44, 49, 50,
51, 58, 65, 69, 72, 78, 84, 90, 111, 113, and 115 govern self-hosting. **Check:** inventory every
tool used to build Instar and resolve it to a shipped capability; run a self-hosting lifecycle in
which the native harness creates, tests, installs, updates, and recovers a local capability;
upgrade tests prove upstream updates preserve registered local packages and their provenance.

**Value — local capability packages.** The rules require self-hosting and migration parity but do
not prescribe the extension unit. A versioned package behind public ports gives local evolution a
durable boundary without making private edits to the core the normal path.

---

## 10. Adapters are replaceable edges

There are seven adapter families:

- **conversation:** Telegram, Slack, WhatsApp, iMessage, web;
- **harness:** Instar Native, Codex, Claude Code, Gemini, Grok Build, and future session runtimes;
- **agent transport:** Threadline first; A2A and future inter-agent protocols through the same port;
- **model:** subscription and metered model doorways;
- **persistence:** local files, databases, vaults, and cross-machine replication;
- **effects:** GitHub, email, payments, processes, files, and other external services;
- **surface:** dashboard, links, notifications, and operator approval views.

An adapter translates an external protocol into core types and back. It may report a capability
or limitation; it may not reinterpret standing, swallow refusal, invent retry policy, or bypass
the register. Channel and harness parity are measured from the same contract suites, with gaps
recorded rather than hidden behind special cases.

Threadline is the reference agent-transport adapter because Instar 1.x has already exercised the
hard parts this contract needs: persistent conversations, authenticated agent identity,
trust-gated delivery, relay and direct paths, session resumption, and durable recovery when a
receiving worker dies. Threadline is not part of the constitutional core. A local transport, A2A,
or a future protocol can replace it by proving the same delivery and delegation contract.

This document deliberately does not choose Threadline's relay topology, discovery, wire format,
cryptography, trust bootstrap, retention, or bridge design, and it does not presume the 1.x code
is carried forward unchanged. Those are decisions for the agent-transport part design after a
layer-below audit of the 1.x implementation. Here we fix only the seam and its semantics, before
the work engine can accidentally assume every child belongs to one Instar instance.

**Rule — framework, channel, and transport parity.** Rules 30, 36, 44, 47, 59, 62, 79, 81, 84,
89, 105, 106, 110, and 114 govern adapters. **Check:** every adapter runs its family contract suite
against real captured fixtures; the generated parity matrix names every unsupported capability;
agent-transport adapters prove each delivery state and preserve the delegation envelope; core
packages contain no adapter identity or transport-protocol branches.

Instar Native is the first-party reference harness. It is assembled from the same public ports as
the other adapters and may use any compatible registered model doorway; it has no private route
around identity, judgment, effects, or verification. Grok Build is the verified name of xAI's
coding-agent harness; its separate models remain model-doorway entries rather than being confused
with the harness.

**Rule — a native reference without privilege.** Rules 2, 30, 56, 69, 75, 84, and 115 require
the native harness. **Check:** run the full harness contract suite with Instar Native against every
compatible registered doorway; dependency lint refuses private imports and direct provider calls;
the parity matrix compares it under the same rules as every external harness.

---

## 11. How the pieces start and fail

Startup is a rebuild, not a hope that the last process shut down cleanly:

1. open and verify the fact segments;
2. rebuild or verify projections;
3. generate and validate the register and terms;
4. prove required adapters and holders are present;
5. reconcile leases, uncertain effects, and accepted intake;
6. resume due work;
7. open intake.

Startup is scoped, not all-or-nothing. The minimal communication and repair plane opens from a
small independently verified fact segment. Each other projection, adapter, and operation family
earns admission separately. If one segment or projection fails verification, the system
quarantines that scope, serves a clearly marked last-known-good read view where safe, rebuilds it
in the background, and keeps unrelated capabilities live. A GitHub projection defect cannot take
down chat; a broken model doorway cannot take down deterministic repair; one machine's corrupt
segment cannot make healthy machines unreachable.

Mutation and release paths fail closed only for the affected consumer while the user channel
fails toward delivery and remains able to explain, steer, and recover. Read-only diagnosis and
bounded repair stay available. A subsystem failure cannot silently turn into global success, and
a recovery action uses the same bounded work and effect machinery as ordinary work. The system
enters a global closed state only when the minimal plane itself cannot establish identity or
history integrity; that state has an independently tested recovery path rather than a generic
shutdown.

**Rule — failure has a declared direction.** Rules 14, 20, 21, 27, 31, 32, 33, 37, 42, 45, 46,
55, 59, 60, 61, 64, 68, 77, 88, 95, 99, and 113 govern startup and recovery. **Check:** fault
injection corrupts or removes each dependency and asserts that only its declared scope closes;
boot cannot open a mutation family before that family's integrity gate passes; last-known-good
views are visibly stale and never authorize effects; reachability and repair tests prove the
minimal plane remains usable during every non-minimal failure; a fleet fault matrix proves there
is no single non-minimal dependency whose loss makes the whole agent unusable.

---

## 12. The dependency direction

```text
 constitutional types
        ^
 facts / register / history ports
        ^
 intake | work | judgment | effects | verification
        ^
 application features
        ^
 adapters and executable assembly
```

Dependencies point inward. Types know nothing. Facts know types. Core services know types and
ports. Features compose core services. Adapters implement ports. The executable assembly is the
only place concrete adapters meet.

**Rule — bypasses are visible.** Rules 1, 30, 41, 44, 49, 66, 69, 75, 101, and 113 govern the
dependency direction. **Check:** package-boundary lint plus a generated import graph; each port
has one production implementation in the executable assembly and a wiring test proves it is real,
not null or a no-op.

---

## 13. The first part designs this architecture implies

Once this document is approved, part designs proceed in dependency order:

1. constitutional types and runtime decoders;
2. fact envelope, version chain, and projection contract;
3. declarations, register generator, terms resolver, and rule/holder graph;
4. intake and identity/standing resolution;
5. durable run graph, delegation contracts, and the agent-transport port;
6. Threadline reference-adapter design, leases, loop primitive, and recovery;
7. judgment doorway and benchmark record;
8. effect doorway and operation adapters;
9. verification holders, probes, retrospective review, and outcome grading;
10. native-harness and remaining adapter contracts, executable assembly, and local capability packages;
11. operator surfaces and the first vertical slice.

The first vertical slice should be deliberately small: receive one authenticated message, create
a durable run, make one bounded model judgment, send one attributable response, verify delivery,
and rebuild the entire result from facts after killing the worker between every pair of steps.
It proves the narrow waist before breadth accumulates.

**Value — dependency order and first slice.** The constitution requires the properties but does
not prescribe the build sequence. This order retires architectural uncertainty from the inside
out and tests the hardest promise—durable, attributable, recoverable agency—before adding feature
breadth.

---

## What this design deliberately leaves to the part designs

This document fixes responsibilities, boundaries, and invariants. It does not choose a language,
database, queue, wire format, deployment topology, repository layout, model provider, or UI
framework. Those choices need evidence from the contract they must satisfy; choosing them here
would turn implementation preference into constitution.

It also does not enumerate register entries. The approved register defines their shape; the part
designs and later code declarations supply the actual entries.

**Value — delay replaceable technology choices.** Nothing in the constitution requires a vendor
or implementation stack. Keeping those choices outside the big-picture design preserves the
adapter boundary and makes the next reviews about evidence rather than taste.

---

*Depends on: the approved rules, register, glossary, and their changelogs. Next after approval:
the part designs in section 13, beginning with constitutional types and runtime decoders.*

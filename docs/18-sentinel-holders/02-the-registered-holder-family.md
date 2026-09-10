## 2. The registered holder family

**Rule — every member is an ordinary part-nine plan with named arms.** Rules 5, 9, 34, 38, 39,
43, 49, 59, 69 and 78; **checks: P14-NF-05–09/12–15/22/37/38/58–68**. Each row becomes one or more
versioned `VerificationPlan` instances. Every arm names its exact subject, executable, schedule,
freshness window, evidence sources, independent witness, failure action and capacity budget through
the owning plan fields. Runtime activation is not an arm field; it comes from the Part Ten binding
admission requested below. A scheduler fire proves only that a slot became due. Worker receipt
proves only receipt. Fresh failed execution proves that the holder ran and failed; it does not prove
protection.

| Family | Registered arms | Question answered | Required independent evidence |
|---|---|---|---|
| Silent-stop coverage | `build`, `runtime`, `probe`, `retrospective` | Does every admitted worker/run stop mode have detection, recovery ownership and a tested positive neighbor? | run/step history, exact worker-incarnation observation and later disposition |
| Session watchdog | `probe`, `sentinel`, `retrospective` | Is a specific worker blocked beyond its declared progress expectations, after known waits and active progress are excluded? | action-time process identity, live frame/process observation and part-seven resolution when meaning is required |
| Helper watchdog | `probe`, `sentinel` | Is a delegated child missing progress, failed, or disconnected without its parent accounting for the result? | delegation edge, child run/lease history and parent result-destination state |
| Orphaned-work holder | `runtime`, `probe`, `retrospective` | Did a worker die after leaving unregistered work in a **dirty** worktree—one with uncommitted or untracked changes—that has **settled**, meaning complete evidence shows no file activity throughout the declared quiet window? Section 6 gives the full predicates. | conditionally granted ledger-#50 Part Ten worktree-observation snapshot with exact dirty/lock/session state and full settle-window activity coverage, one complete fresh Part Ten process-inventory snapshot with affirmative ownership/directory exclusion, and later reconciliation disposition |
| Clean-worktree reclamation holder | `runtime`, `probe`, `retrospective` | Is a **clean** checkout—with no user work after its registered residue list—**merged**, meaning its head content is already in the current default branch, and **unused**, meaning no live owner, session, process, lock or build marker remains, so it can be reclaimed without losing work or racing a new user? Section 7 gives the full predicates. | conditionally granted ledger-#50 Part Ten worktree-observation snapshot with current branch/head, clean and merge state, lock/session/build-marker observations and activity history; complete process ownership/directory exclusion; action-time worktree re-observation; and later effect settlement |
| Framework-prompt holder | `probe`, `sentinel`, `retrospective` | Is a worker stranded on a harness approval menu even though the exact underlying operation is already admitted, or is real authorization still missing? | current operation admission and authorization, exact worker/presentation capture, bounded re-observation and later menu/consumption observation |
| Context-wedge sentinel | `build` (parser fixture), `probe`, `sentinel` | Do repeated adapter errors establish a non-resumable conversation context rather than a one-off refusal? | real captured adapter bytes, exact session/incarnation and independent re-challenge result |
| Compaction sentinel | `runtime`, `probe`, `retrospective` | Did a compaction preserve and account for the last inbound message and re-ground the worker? | part-five grounding and continuity records, exact inbound id and worker-consumption witness |
| Presence holder | `runtime`, `sentinel`, `retrospective` | Has admitted user input lacked an attributable response or honest bounded status while work remains owned? | intake fact, outbound settlement, run progress and speaker authority re-resolved at use |
| Promise holder | `runtime`, `probe`, `retrospective` | Does an agent-owned open commitment have current progress, a valid blocker probe, or a bounded revival path? | durable run/commitment source, due obligation, probe evidence and terminal disposition |
| Dated check-in reminder holder | `runtime`, `probe`, `retrospective` | Has an open agent-owned obligation reached its exact absolute check-in instant without an already-settled reminder or terminal closure? | requested Part Five dated-reminder item and closure state, actual clock observation, exact reminder effect identity and Part Eight observation/settlement |
| Crash-loop holder | `runtime`, `retrospective` | Does one operation class repeatedly fail under a pinned population strongly enough to propose a pause? | complete attempt population, duration/outcome facts and part-seven classification |
| Budget-overrun holder | `runtime`, `probe`, `retrospective` | Has a current autonomous run crossed its governed safety ceiling strongly enough to halt new work without declaring the assignment finished? | current run/budget/head, consecutive current due observations, Part Five halt and Part Six admission state |
| Moving-worker silence holder | `runtime`, `sentinel`, `retrospective` | Is a current autonomous run still producing observed worker output but missing its attributable user-report cadence even without new inbound input or an open promise? | current run/cadence, last attributable outbound, shared output-change observation and one-voice ownership (the one current, re-resolved authority allowed to speak for that conversation) |
| Stranded-conversation holder | `runtime`, `sentinel`, `retrospective` | Does a current conversation point to an online owner that has remained unable to serve its bound channel while a separately observed healthy peer can serve it? | complete current conversation-owner population, current binding and channel scope, at least two advancing fresh owner observations spanning the declared minimum observation period, typed capacity refusal or adapter-unavailable evidence, complete eligible-peer service observations and visible unknowns |
| Session reaper | `build`, `probe`, `retrospective` | Is a named worker disposable now without ending work, breaking reachability or widening exposure? | affirmative ready/idle evidence, sustained unchanged candidacy, a separate **reap-pending** grace observation—the finite grace state after sustained candidacy—live run/lease/delegation/commitment state, measured hardware pressure, fresh full pre-effect evaluation and action-time identity |
| Process-population reaper | `build`, `probe`, `retrospective` | Does the complete current-user process population contain an old ownerless Instar command-line interface (CLI) process or leaked/reparented allowlisted Model Context Protocol (MCP) descendant that is disposable without touching live owned or external terminal sessions? | complete Part Ten process inventory, ancestry and session/worker ownership joins, then separate action-time identity |
| Guard-posture tripwire | `build`, `runtime`, `probe`, `retrospective` | Is every required arm actually executing and independently witnessed at its current generation? | part-nine source observations, check/probe records, assembly inventory and external freshness witness |

**Rule — enrollment and activation have an exact source projection.** Rules 5, 26, 42, 43, 45,
49, 69, 73 and 95; **checks: P14-NF-05/09/16–23/48–50/58**. At one pinned part-two source vector,
the projector first resolves the current Part Ten `LocalCapabilityPackage` by its exact namespace,
version and content digest. It then resolves the package selected by the current
`AssemblyManifest` and `PackageTransition`. Only the declaration identifiers in that package's
closed `declarationIds` list are members. A missing, extra, conflicting, partial or stale package
reference makes enrollment incomplete. No `requiredFacts` field is treated as package membership.

The feature declaration and the rule-holding declarations have separate jobs. An exact feature id
in `declarationIds` enrolls the package feature for its metrics and rollout gate. A feature is not a
holder, supplies an empty `holds` list and never becomes a `VerificationPlan.subject.holder`.
An exact sentinel id in `declarationIds` enrolls one rule holder. Its `Declaration.status` is
`live`, `dark`, `soaking`, or `retired`. Its `Declaration.holds` supplies the rule edges. Its
`requiredFacts.freshnessProbe`, `scope` (`live` or `retrospective`), `authority` (`signal` or
`block`) and, for live scope, `irreversibleMoment`, retain Part Three's meanings.

A current `VerificationPlan` enrolls one sentinel declaration only when
`VerificationPlan.subject.holder` equals that declaration id and its `subject.generation` is the
current register generation. Every required `arms[].id` must be present. Execution comes only from
`ProbeRecord.plan` plus `ProbeRecord.arm`. Freshness and protection come from the matching
`GuardPostureView.plan` and per-arm posture, never from the plan's `activation` test-evidence lists.
These two declaration examples use only fields admitted by the landed Part Three decoder. The
package's `declarationIds` contains both exact ids and the declaration ids for the two named bounds
referenced below.
`sentinel-holders.package-loop-policy` is the registered Part Six `LoopPolicy` that limits the
package-wide due scan and action budget. `sentinel-holders.guard-posture.loop-policy` is the
registered Part Six `LoopPolicy` named by every guard-posture plan's
`VerificationPlan.scheduling.loopPolicy`. Each bound declaration is paired with that actual
construct and its live probe. A different scheduling policy, an unresolved bound, or a declared
bound with no paired executable makes enrollment incomplete under P14-NF-58.

```json
{
  "type": "Declaration", "schemaVersion": 1,
  "id": "sentinel-holders-package", "kind": "features", "status": "soaking",
  "requiredFacts": {
    "metrics": ["sentinel-holder.instances", "sentinel-holder.gaps"],
    "gate": {"test": "P14-NF-50", "deadline": 1798761600000}
  },
  "profile": {
    "type": "Profile", "schemaVersion": 1, "consequence": "control",
    "reversibility": "reversible", "reach": "internal", "surface": "none",
    "repeats": {"kind": "bounded", "by": "sentinel-holders.package-loop-policy"}
  },
  "standards": [9, 39, 43, 59, 73], "holds": []
}
```

```json
{
  "type": "Declaration", "schemaVersion": 1,
  "id": "sentinel-holders.guard-posture", "kind": "sentinels", "status": "soaking",
  "requiredFacts": {
    "freshnessProbe": "sentinel-holders.guard-posture.probe",
    "scope": "live", "authority": "signal",
    "irreversibleMoment": "before any recovery effect is admitted"
  },
  "profile": {
    "type": "Profile", "schemaVersion": 1, "consequence": "control",
    "reversibility": "reversible", "reach": "agent", "surface": "dashboard",
    "repeats": {"kind": "bounded", "by": "sentinel-holders.guard-posture.loop-policy"}
  },
  "standards": [9, 26, 43, 59, 69, 73],
  "holds": [
    {"rule": 9, "class": "deferred", "part": 14, "ceiling": 1798761600000,
     "owner": "sentinel-holders", "overdueAction": "keep the package divergent"}
  ]
}
```

The production instance population must be derived from part-ten assembly facts. Each production
instance has its own `VerificationPlan.id` and its own canonical
`VerificationPlan.subject.governed`, including the machine/deployment and runtime-incarnation
identity selected by its binding. No plan may cover two production instances. The binding must
match its instance, plan id, holder id and governed subject before a `ProbeRecord.subject` can be
joined. Because the landed Part Nine runtime already checks `ProbeRecord.subject` against
`plan.subject.governed`, this one-plan-per-instance rule prevents one machine's pass from confirming
a sibling machine.

The landed
`AssemblyManifest.publicPorts` and scope-wide `AssemblyAdmission` cannot identify a holder, plan,
arm, instance, observation/effect mode, or operation. Part fourteen therefore depends on the
additive Part Ten holder-binding and binding-admission records requested in
`.instar/lanes/design-sentinel-holders-seam-request-assembly.md`, request
`P14-P10-holder-bindings-and-drivers-v2`. A binding is
**observation-only** only when that record says `mode: observation` and carries no part-eight
operation; it is **effect-capable** only when `mode: effect` references a current registered
`OperationDefinition`. Its runtime state comes from the current binding admission. A missing,
conflicting, partial, or stale binding makes the required population incomplete and therefore
`diverged`; no arm kind or executable name is used to guess the mode. The request also requires the
binding's plan id and governed subject to equal the per-instance plan before posture is consumed.
That request is GRANTED in `seam-response-assembly-followup.md`, ledger #9, but is not landed.
P14-NF-05/16–23/31–36/39/42/44–54/58–67 are **non-executable until
`seam-response-assembly-followup.md` lands** wherever their positive requires owner-decoded
production bindings or drivers. Until the seam lands and its production bindings pass
P14-NF-49/50, no package instance is eligible for `on-confirmed`.

The package feature and guard-posture sentinel are recurring services, so `repeats: no` would be
false even if their decoders accepted it. `repeats: no` is reserved for a genuinely single-action
feature. P14-NF-58 compares each recurring declaration's bound with the exact current plan schedule,
registered Part Six loop policy, package-wide parent budget and production binding.

**Rule — signal and authority remain separate.** Rules 4, 10, 12, 38, 42, 57, 67 and 86;
**checks: P14-NF-10–12/18/21/23/26/29**. Text-pattern matches (regular expressions, or regexes),
elapsed-time thresholds, unchanged terminal frames, process names, adapter text, config differences
and resource readings may raise a signal.
They do not decide a person's meaning, establish a semantic wedge, prove a worker is stuck, or
authorize recovery. Exact structural invariants may enforce recorded governed state. Other
classification goes through part seven with the relevant full context, explicit allowed outcomes
and a conservative fail direction. An unavailable judgment provider swaps through the registered
doorway or leaves the case unresolved; it never falls back to a keyword verdict.

The landed Seven contract records judgment requests and resolutions, but its reference executor is
not a landed Eight-admitted provider call. Live semantic classification therefore depends on the
GRANTED ledger #23 pair: `seam-response-judgment.md` supplies Seven's provider preparation and
receipt operations, and `seam-response-effects-followup.md` supplies the matching Eight
`provider-call` payload and executor path. Pure signal extraction, recorded-history joins and
conservative unresolved/refusal decisions remain executable. The live semantic positive neighbors
of P14-NF-11/40/55, and their P14-NF-49/50 production wiring/lifecycle evidence, are
**non-executable until `seam-response-judgment.md` and
`seam-response-effects-followup.md` land**. A package must not call Seven's reference executor
directly or report model-backed classification on this HEAD.

**Rule — retrospective review catches failures a live detector cannot see.** Rules 24, 41, 58,
65, 70, 85, 108 and 111; **checks: P14-NF-13–15/41/48**. Reviews pin actual eligible
populations, including missed cases, false positives, repeated recoveries, user corrections,
operator overrides and cases omitted by unavailable telemetry. They compare conclusions and stated
reasons separately with later outcomes. A recurring self-heal produces a root-cause obligation.
Review sampling, omissions, independence, findings and disposition are recorded in
`RetrospectiveReviewRecord`; a review does not rewrite the original finding or effect settlement.

---

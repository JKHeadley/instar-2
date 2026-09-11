## 2. Declarative job packages

**Rule — one manifest is the complete scheduling declaration.** Rules 1, 44, 66, 78, 90 and
103; **checks: P15-NF-08/09/10**. Each enabled job is supplied by one approved part-ten package
version and one matching feature declaration. The manifest is closed, bounded, canonically
encoded, content-addressed, and decoded before activation. Unknown fields, ambiguous encodings,
case-folded identity collisions, invalid calendar values, incompatible package dependencies, and
conflicting active definitions refuse the affected job without stopping the minimal plane.

**Rule — the manifest separates identity, policy, and executable content.** Rules 25, 28, 57,
60, 69, 75 and 90; **checks: P15-NF-08/11/12**. The manifest contains the following groups. These
are package fields and references to owned values, not a new core record. At its first use in the
Schedule row, `cron-v1` means the five-field minute-resolution grammar defined in the next Rule
block. An **IANA named time zone** is a named zone interpreted with the pinned time-zone database
version. An **RFC 3339 offset timestamp** is an absolute timestamp in RFC 3339 grammar with a
required numeric offset or `Z`.

| Field group | Required content |
|---|---|
| Identity | Stable registered job id, display name, accountable owner, package version and content digest; a slug is only a display and lookup label |
| Schedule | Exactly one recurring `cron-v1` five-field expression plus an IANA named time zone, or one absolute RFC 3339 offset timestamp; activation instant; pinned time-zone-data and calendar-policy versions; nonnegative current-lateness cutoff |
| Work | Registered entry point, immutable body or artifact digest, expected result destination, grounding contract and required predecessor references |
| Authority | Package-minted system principal, standing-grant reference, scope, operation classes and required authorizations; manifest text grants nothing |
| Bounds | Part-five run budget and exit test; part-six duration, attempt, concurrency, token, money, byte and notification allocations; numeric zero remains zero |
| Admission | Priority class, eligible assemblies and machines, required capability set, capacity-evidence policy, global-once or every-eligible-machine placement, catch-up policy, finite class shares and concrete fairness/delay bounds |
| Intelligence | Part-seven route and floor references, the pipeline's registered profile, supervision level, complete ordered business-step roster, capture and grading requirements |
| Effects and proof | Part-eight operation references, stable operation identity rules, part-nine verification plan, accepted outcome evidence and uncertainty owner |
| Recovery | Part-six parent duty, rolling budget, loop, backoff, breaker outcome-window and recovery-policy references; maximum overdue age and final exhaustion destination |
| Presentation | Part-eleven topic or destination reference, push policy and operator-facing description; presentation cannot alter execution policy |
| Activation | Required checks, semantic review, assembly compatibility, live holder proof and rollout state |

**Rule — recurring calendar expansion is deterministic.** Rules 26, 33, 39, 69 and 90;
**checks: P15-NF-09/13/14**. A recurring manifest names a valid cron expression, an IANA time zone,
and the registered calendar-policy version. `cron-v1` means a five-field, minute-resolution
calendar expression in minute, hour, day-of-month, month and day-of-week order. The field domains
are `0..59`, `0..23`, `1..31`, `1..12` and `0..6`; only `0` denotes Sunday and `7` is refused. A
field is a comma-separated, nonempty list of atoms. An atom is `*`, one unsigned decimal value, an
ascending inclusive `value-value` range, `*/step`, or `value-value/step`. A step is a positive
decimal integer. `*/step` starts at the field minimum and selects every step-th value through the
maximum. `a-b/step` starts at `a` and selects `a + k*step` while the result is at most `b`. A step
on a single value, a descending range, signs, whitespace inside a field, empty list members,
names, macros, seconds and years are refused.

Each field expands to a sorted set with duplicates removed. Canonical normalization is the five
comma-joined sorted decimal sets, separated by one ASCII space. A day-of-month that does not exist
in the selected month does not match. A normalized day-of-month or day-of-week set that equals its
entire domain is **unrestricted**, even when written as a list, range or step expression equivalent
to `*`. If both day fields are unrestricted, every otherwise-selected day matches. If exactly one
is restricted, that field alone selects the day. If both are restricted, either matching field
selects it. An IANA time zone is a named zone interpreted with the manifest's exact time-zone-data
version. RFC 3339 is the absolute timestamp grammar with a required numeric offset or `Z`.

The default calendar policy maps a nonexistent wall time using the last valid UTC offset before
the gap, and marks that mapped instant missed. A manifest whose gap mapping collides with another
wall selection at the same absolute instant is invalid. For `America/New_York` with the pinned
2027 rules, wall `2027-03-14 02:30` maps with offset `-05:00` to
`2027-03-14T07:30:00Z`; its identity is `(job instance id,
2027-03-14T07:30:00Z)` and its initial disposition is missed. Wall `2027-11-07 01:30` occurs at
both `05:30Z` and `06:30Z`; the default earlier policy selects only `05:30Z`, so the later fold is
not an occurrence. A policy choosing both selects two distinct absolute instants.

A **current occurrence** is a due instant whose nonnegative age at the supplied `asOf` clock is
less than or equal to the manifest's current-lateness cutoff. An older due instant is missed. At a
five-minute cutoff, `12:00:00Z` is current at `12:05:00Z` and missed at
`12:05:00.001Z`. A **missed group** is the maximal ordered set of missed instants for one job
instance, package version and calendar-policy version selected between one conditionally current
temporal-coverage predecessor and a pinned current/missed boundary. Its selection identity binds
the predecessor, exact expansion inputs, first instant, boundary and catch-up policy. Its terminal
commitment binds the last instant, count and streamed ordered-membership digest to that selection.
Both records are small and immutable. Its members and dispositions are
stored in separately paged **coverage chunks**, each capped by manifest item and encoded-byte
limits. A group is `discovering` until its digest and count have been completed from bounded
expansion pages, `disposing` while one or more committed chunks remain open, and `complete` only
after every member has one disposition. Recovery resumes from the last committed expansion or
disposition chunk. No operation materializes the whole group in memory or writes an unbounded
member array.

Calendar expansion is a pure fold over the approved manifest, activation instant, pinned time-zone
data, conditional temporal-coverage predecessor and one supplied `asOf` clock measurement. Equal
causal frontiers do not imply equal expansion. A discoverer first pins those inputs, then proposes
one group against the predecessor through the requested Part Six conditional coverage operation.
Only the winning proposal may persist or resume its bounded chunks. A loser re-reads the selected
group and its successor before proposing more coverage. The temporal-coverage successor advances
only after all chunks are complete. Different `asOf` clocks may propose overlapping prefixes, but
they cannot select overlapping groups from the same predecessor. A time-zone-data change requires
a new package version and cannot rewrite past occurrences.

**Rule — a one-shot is an absolute obligation.** Rules 8, 26, 46, 68 and 97; **checks:
P15-NF-14/15**. A one-shot manifest carries one absolute instant and no recurrence. Before that
instant it remains pending. At or after that instant its scheduled tick is admitted exactly as a
recurring tick. A pre-admission Refused remains a part-four receipt and does not pretend a Run
exists. An admitted one-shot closes only through part five's completed, demonstrated-unreachable
or scope-covering cancelled exit. Capacity enforcement, queue pressure, pausing, disabling a
timer, deleting a local cache, or observing that time passed only inhibits execution and keeps the
obligation owned. A lawful terminal exit prevents another scheduled admission; an operator may
request a separate manual Run with a new part-four event identity.

**Rule — install, update, disable, retire, and fork preserve provenance.** Rules 28, 44, 71, 78,
90 and 103; **checks: P15-NF-10/16/17**. Shipped jobs retain their signed package source and exact
body digest. User jobs occupy a separately owned namespace. An operator override creates a new
approved package lineage rather than editing a shipped source in place. Disable and retire inhibit
future scheduled admissions but keep manifests, prior runs, open obligations, and the digest at
which the action occurred. Package update is atomic at the approved package boundary. Interrupted
staging is visible and never selected as the active definition.

---

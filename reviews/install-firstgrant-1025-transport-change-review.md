# Change review — first-grant owner transport prerequisite

Subject base: 10826ed522b6a11ebc77cb6bb0a047e8dd25def7
Review state: open
Reviewed content: none
Outcome: Repair the existing broker client transport so the setup supervisor can authenticate a complete bounded owner record. First-grant enrollment remains incomplete; this is not ordinary-install readiness.
Affected rules: 1, 4, 5, 26, 28, 34, 38, 42, 49, 60, 74, 95, 100, 101, 102, 111, 113, 116
Affected floors: Secrets and spend caps unchanged; no credential intake or paid call. Stop, no duplicate sends and durable intake remain unchanged. Request and response memory remain bounded; authority stays at the existing owner boundary.
Operator questions: none
Suggested tier: ordinary
Declared tier: ordinary
Tier rationale: A bounded transport repair, with no new authority, owner operation, model prompt, model decoder or installed capability.
Side effects: Client request and response ceilings become 16 KiB measured in bytes; complete UTF-8 decoding replaces per-chunk decoding. Full checkpoint plus owner record no longer fails the former 2-KiB request ceiling. Broker-side closed schemas still apply. Signed distribution and supervisor qualification pins must be renewed by their existing owners for these changed bytes; this change does not re-sign or relax admission.
Undo and recovery: Revert the transport change; no persisted state schema changes. The older 2-KiB transport will again refuse long valid owner-authentication requests. Existing held setup attempts retain their state and may retry under a requalified release.
Multi-machine posture: Local Unix-socket installation transport only. No change to shared grants, replication demand or recovery custody.
Layer below: Read custody-platform's independently administered lifecycle and setupPreparationOwners; projectSetupChecks admits bounded 160-character bindings, and authenticate sends the full record plus checkpoint. The real socket test demonstrates that the previous 2048-byte request limit rejects that valid composition. The broker platform is not the missing key/enrollment business logic.
Bug class: integration
Bug evidence: reproducer=tests/platform/setup-owner-transport.test.ts
Hook bypass: none
Convergence: none
Decision: firstgrant-1025-transport-D1 | Preserve the full owner evidence and raise the existing finite wire ceiling to 16 KiB instead of truncating checks or inventing another transport. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/install-firstgrant-1025-PROGRESS.md
Decision: firstgrant-1025-transport-D2 | Count response bytes and decode UTF-8 after bounded assembly so chunking cannot change an authenticated record. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/install-firstgrant-1025-PROGRESS.md
Decision: firstgrant-1025-transport-D3 | Report the prerequisite repair separately from unimplemented first-grant custody, enrollment and installed-owner qualification; preserve the approved design and existing holds. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/install-firstgrant-1025-PROGRESS.md
Validation: Real Unix-socket tests exercise supervisor-owner inspect/authenticate composition, over-limit request before dispatch, multibyte over-limit response, and a UTF-8 character deliberately split between writes. Targeted existing custody platform and supervisor tests, typecheck, architecture, lint, register and change-review outcomes are recorded in the handoff.

## ELI16

Setup sends the checks back to their owner to confirm they are real. The old message limit was too small for a valid full set of checks. The connection now carries that set within a larger fixed limit and preserves characters split across network chunks. It still cannot create an operator grant.

## UX Impact

No new installer flow is exposed. A qualified future installer can carry complete owner evidence without this transport refusing it solely for size. First-login completion is still unimplemented by this unit.

## Closing block

simplestRobustRoute: Keep the existing socket and owner authentication; permit the complete closed record within one finite 16-KiB byte ceiling. Truncating it loses evidence, and a second protocol adds needless machinery. Start guard is the request byte limit; end guard is bounded complete JSON handed to the existing owner validator; timeout and buffer limits remain. No unattended fresh-install success is claimed.
80/20: A measured integration defect is repaired without adding a parallel authority system. Remaining first-grant implementation and installed qualification are explicitly not complete.
VERDICT: partial prerequisite repair; first-grant task incomplete

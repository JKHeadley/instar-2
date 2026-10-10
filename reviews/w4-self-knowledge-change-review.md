# Change review — Instar 2.0 self-knowledge

Subject base: 9d8089a6
Review state: open
Reviewed content: none
Outcome: an agent identifies itself as Instar 2.0, states its installed software version and purpose, and explains live abilities as useful outcomes. Justin's October 10 16:27 correction to update 969390343 is the source case.
Affected rules: 1, 3, 4, 26, 30, 34, 36, 47, 49, 58, 70, 74, 78, 80, 84, 85, 101, 103, 104, 111, 113, 116.
Affected floors: secrets, spend cap, stop, no duplicate sends and durable intake stay enforced by their existing paths. Wording changes confer no authority.
Operator questions: none
Suggested tier: critical
Declared tier: critical
Tier rationale: changes the briefing and answer instructions on the user-facing answer path.
Side effects: capability descriptions and their generated inventory change; prompt sizes and historical text expectations need verification. An absent development report no longer implies an unknown identity. Account connections remain unverified until a tool demonstrates access.
Undo and recovery: revert this change and regenerate the capability inventory; no new persisted state or migration.
Multi-machine posture: the same code runs on each owning runner; tools and connections are described from that runner's current inputs. No ownership, replication or store changes.
Layer below: the register reads descriptions from module READMEs; turnSources selects the briefing from live tool state and connection count; sourcePacket provides it at each grounding boundary; the answer and work packets point at the same note. Existing review and delivery paths are retained.
simplestRobustRoute: replace the existing descriptions and prompt wording using the existing generated inventory and live tool state. No new list, state, parser, filter or gate. Start guard: verified purpose excerpts and runtime tool selection; end-state guard: existing reply review plus recorded-case replay; limit guards: existing prompt budget, spend and stop.
Validation: recorded-case replay and targeted tests in progress; results recorded in the absolute desk PROGRESS file. No deployed-live or independent-convergence claim.

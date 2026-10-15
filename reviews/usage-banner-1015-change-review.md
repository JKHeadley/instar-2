# Change review — usage-banner-1015

Subject base: dcf3a5160cb92ede56f70f8b1048f27b2d6e5ef5
Review state: open
Reviewed content: none
Outcome: native informational usage warnings leave the conversation worker running; actual exhausted quota still produces a rate-limited pause.
Affected rules: 4, 14, 26, 36, 49, 70, 74, 77, 86, 95, 101, 111, 113, 116
Affected floors: secrets — no credential or outbound changes; spend cap — real quota walls and installed call caps remain enforced; stop — existing stop and turn deadlines unchanged; no duplicate sends — no retry or delivery changes; durable intake — existing journal and uncertain-result handling unchanged.
Operator questions: none
Suggested tier: significant
Declared tier: significant
Tier rationale: narrow native terminal parser fix affecting conversation availability, with captured-byte and driver observation regression coverage.
Side effects: a reset-time notice alone no longer pauses a worker. Explicit hit/reached session, usage, 5-hour, weekly and unqualified limit messages, and usage-limit-reached messages still pause. Policy/context wedge precedence and bounded tail scope remain unchanged.
Undo and recovery: revert this commit; no stored-state migration. Rollback restores the false warning pause, so retain the captured regression case. No live process, login or root was changed.
Multi-machine posture: the same stateless classifier runs on every host; no new store, ownership path, peer dependency or replication change.
Layer below: inspected the exact recorded terminal footers, tail normalization, observe's pause propagation, and the conversation adapter's paused-to-uncertain retirement path. Driver tests assert that the warning leaves the turn open and the warning plus a real wall still pauses it.
Bug class: unit
Bug evidence: reproducer=tests/assembly/production-session-driver.test.ts
Hook bypass: none
Convergence: none
Decision: usage-banner-exhaustion | require explicit exhausted-quota wording instead of the broad limit/reset alternative; never exempt an entire pane just because it contains a warning, since a real wall may follow | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/usage-banner-1015-PROGRESS.md
Prompt review: no model prompt, model-output schema, summary, Jev verdict or reply-review parser changed. This parses native terminal status. Recorded footer bytes from updates 840343021 and 840343022 are replayed through the classifier and driver; the existing real exhausted-quota fixture supplies the blocking neighbor. Tools/conversation policy digests remain 5fed4bcfd823d950c1444a008a9c11d40824671dd8e68aa2f5908ed8534a2926 and 3598cc7514f4be6ffec52f1d321e1596cd2db420a67fd7958281f3862dd9ce8c.

simplestRobustRoute: this is the simplest robust route: narrow one existing regex, retaining its bounded tail and all existing worker guards, with no new machinery. A broad reset-time pattern falsely retires real working sessions. Start guards, turn deadlines, stop, durable intake and delivery uniqueness stay in the existing driver. The captured warning keeps the turn open; real exhaustion still pauses it. No autonomous completion or new live conversation acceptance is claimed.
80/20: the recorded banner fails before the fix and passes afterward; the existing recorded real limit and six explicit exhausted-quota wordings pass. Read-only replay of all 37 original panes returns null. The progress report records targeted caller checks, required gates and the desk-owned stale native conformance certificate exception. Independent review remains the desk's decision.
VERDICT: author submission; this record asserts no independent verdict — the review desk records its own

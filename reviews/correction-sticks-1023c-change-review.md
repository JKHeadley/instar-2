# Change review — One durable copy of a reply correction

Subject base: b61926b0d8867d2b4e8ca01beb34b4ca0dc64f03
Review state: open
Reviewed content: none
Outcome: A model-classified reply preference is injected into the next worker's context without an identical, independently governed directive that can survive a later preference correction.
Affected rules: Purpose coherence and least revelation; Rules 4/7/10/12/28/29/30/32/33/34/36/47/49/57/74/85/93/96/101/111/113/116.
Affected floors: Secrets, spend cap, stop, no duplicate sends and durable intake keep their existing enforcement. No new effect, model call, store, authority or scheduler.
Operator questions: none
Suggested tier: significant
Declared tier: significant
Tier rationale: Changes model guidance and exact admission of duplicate recorded state; retains the existing journal schema and preference lifecycle.
Side effects: Identical newly proposed prefer/directive clauses produce one preference and no additional directive acknowledgement. Different clauses, standalone directives, invalid preference provenance and explicit directive supersession keep their existing handling. Old journals are not rewritten. A differently worded duplicate remains a model judgment; exact coalescing cannot decide that two sentences mean the same thing. Existing directives still require their existing explicit completion or supersession.
Undo and recovery: Revert the guidance and coalescing together. All persisted records use existing prefer/correct/forget schema. Reopening does not repeat an answered intake or send. The preference is committed in the same answer record before reply delivery.
Multi-machine posture: Existing journal custody and replication; a takeover reconstructs the same preference from received durable records. No separate store or machine-local preference cache is introduced.
Layer below: Inspected exact source/quote validation, active preference projection, directive admission and capacity check, answer record replay, readAnswer adapter, audience disclosure guard and packet fitting. Coalescing occurs after memory validation and before directive capacity accounting. Meaning is decided by the model; code compares identical recorded clauses only.
Bug class: integration
Bug evidence: reproducer=tests/preview/correction-sticks.test.ts
Hook bypass: none; core.hooksPath unset and common hooks directory contains samples only.
Convergence: none
Decision: correction-single-copy | Reuse the 1.x preference-routing and session-context pattern within the existing 2.0 journal adapter. Preserve explicit supersession and distinct clauses. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/correction-sticks-1023c-PROGRESS.md

1.x source: JKHeadley/instar origin/main d5b30b1d7; CorrectionCaptureLoop.ts user-only distillation; CorrectionLedger.ts deduplicated durable provenance; CorrectionLoopDriver.ts preference route; PreferencesManager.ts sessionContext/formatPreferencesForSessionStart; scaffold/templates.ts injected preference awareness. Port behavior, not whole files or its additional stores/jobs. ONEX-LESSONS.md lines 110/113/114/120/123/125/126/127/128 apply; exact mappings are in PROGRESS.

Prompt review: General guidance routes standing reply corrections to memory without a duplicate directive or work loop. No test-specific phrase, semantic keyword classification, authority widening or extra model attempt. Wording stays within the existing packet budget; a cadence regression from initial wording was fixed by shortening it, with the original test bound retained.

Evidence: Exact I4 model and delivered output from proof-room updates 840343781/840343782 and 840343838/840343839. Red regression reproduced identical dual storage; the repaired test persists the preference, reopens the journal with a fresh worker, replays the recorded relevant answer through readAnswer, then checks that a constructed later correction leaves no stale directive. Negative neighbors cover distinct clauses, invalid provenance, explicit supersession, older preferences, quoting and unauthenticated senders. Existing recorded-shape suites cover summary uncertainty, Jev unsure/undecided, reply-review and empty replies plus audience refusal/recovery.

Fresh-model evidence: Four bounded claude-opus-5-5 calls through the shipped subscription route and the separate allowed test login, using an isolated synthetic journal and collecting sends locally. The same question produced a 1,133-character answer before the real I4 correction, then a 355-character two-sentence answer after closing/reopening the journal and worker. The model cited the persisted preference in its reason. A fourth turn explained a quoted seven-paragraph request without adopting it; the preference stayed unchanged and directives stayed empty. Exact journal-boundary outputs and packet preference fields are committed in correction-sticks-1023.json. The complete report is under lanes/correction-sticks-1023c-model-proof-3/report.json. The earlier attempt with a five-reply fixture cap hit that cap after acknowledgements; it remains recorded and was not relabeled successful.

Evidence limit: This is fresh model generation through the real adapter, plus recorded Telegram I4 evidence and disk restart replay. The synthetic send collector is not a new Telegram delivery. The desk's activated live surface gate decides complete row-32 graduation.

ELI16: A correction should follow you into a new conversation. Instar already saves reply preferences; this change stops it from also saving the identical words as an independent instruction that could contradict your next correction. It keeps the original evidence and the privacy checks.

simplestRobustRoute: This is the simplest route: reuse the durable preference and its existing every-packet injection. Exact coalescing prevents the named failure of a stale second governing copy; a second store, sentinel or model call would add nothing. Start guard: authenticated source and validated exact preference clause. End state: one durable preference in the fresh worker packet, later corrected without a duplicate directive. Limits: unchanged budgets, audience admission, stop and delivery custody. Recorded-shape replay and four fresh model calls are cited above; no new autonomous Telegram completion is asserted.
80/20: Targeted red/green regression, real model-output replay, source-boundary neighbors, restart, audience and context-budget checks; final machine gate evidence is recorded in PROGRESS.
VERDICT: author submission; no independent convergence claim

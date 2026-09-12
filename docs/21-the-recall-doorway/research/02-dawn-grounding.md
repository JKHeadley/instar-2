# R2 — Dawn grounding: derivable behavior and missing evidence

**Status: PARTIAL — PENDING-DAWN-CODE. Research only; no design or runtime certification.**

Research date: 2026-09-12. Dawn's actual email, X and reddit code is on Justin's Laptop;
access is being arranged by the orchestrator. This round was explicitly instructed to document
the derivable portion and exact questions. No Laptop checkout, deployed surface adapter,
original `convergence-check.py`, or captured Dawn execution was examined.
The missing material is not inferred from the name of an Instar hook.

The inspected 1.x checkout is `/Users/dabombstudio/.instar/agents/echo` at repository HEAD
`5b36623a99327e74abe5ef04d63019f9aca6b1c5`, with local modifications.
[R1 section 10](01-instar-1x-memory.md#10-snapshot-identifiers-and-validation-boundary) records
hashes for the installed hooks, convergence script, source routes and tone gate examined here.
File:line citations refer to those working bytes. SOURCE means inspected code; REPORTED means
a document/comment describes an event; INFERENCE is reasoned from that evidence; UNKNOWN
remains unverified. Dawn runtime outcomes remain unmeasured.

## 1. What can be derived without Dawn's code

### 1.1 The inherited principle is automatic, content-bearing grounding

**SOURCE:** `.instar/hooks/instar/grounding-before-messaging.sh:13` attributes a lesson to Dawn:
grounding should inject content automatically instead of merely pointing at something to read.
The local implementation detects a matching shell command, prints AGENT.md, runs an optional
convergence script, and either exits with a block or prints a grounding-complete marker
(`:30`, `:35`, `:46`, `:67`).

**INFERENCE:** this supports reducing dependence on the worker remembering a preparation step.
It is not evidence that Dawn retrieves the correspondent's history, nor that printing identity
alone establishes memory coherence. A receipt that AGENT.md was printed would not establish
that email content or a prior promise reached the model.

### 1.2 The simplified convergence script is not Dawn's verifier

**SOURCE:** `.instar/scripts/convergence-check.sh:8` identifies Dawn's `convergence-check.py`
and PROP-159 as inspiration, explicitly describing the local script as simplified. The local
script calls no model (`:3`). It checks patterns associated with capability claims, commitments,
empty-result acceptance, experiential claims, sycophancy, URLs and temporal language (`:26`).
The hook passes the entire shell command text to it (`grounding-before-messaging.sh:48`), not a
typed message draft with known recipients and captured supporting evidence.

The URL check uses domain recognition/configuration (`convergence-check.sh:59`). It does not
fetch the linked page, establish that the exact URL exists, or prove a claim from the page.
The experiential check asks whether the agent inspected something; it does not inspect the
tool-result record itself. The commitment check flags wording; it does not verify an owned
durable commitment. These are signals about possible failures, not completed fact checks.

**UNKNOWN:** whether Dawn's original checker uses models, exact history, evidence records,
surface-specific logic, multiple passes, or a different failure policy. No performance or
accuracy claim transfers between the inspiration and this implementation.

### 1.3 Shell command detection is not an outgoing effect boundary

**SOURCE:** `grounding-before-messaging.sh:31` matches sender-command substrings. It cannot
establish that a matched string is a command invocation. Conversely, an indirect call through
a wrapper, alias, variable or MCP tool need not contain those strings. The hook accepts both
Claude's command field and Codex's cmd field (`:22`); that is input-format support, not proof
every harness or sender passes through it.

**REPORTED:** `docs/specs/grounding-hook-mention-vs-invocation.md:12` is explicitly rejected,
dated 2026-07-28, with no code shipped. It reports three false blocks on relay mentions in a
commit message, PR body and Python heredoc (`:27`). Attempts to strip quotes or fail closed on
wrapped execution alternated between missed sends and false blocks (`:38`). The retained
reasoning places enforcement at an actual relay boundary (`:78`) and separately rejects
low-context regexes holding semantic blocking authority (`:95`). Its reported tests do not
establish a completed replacement, and were not rerun in this session.

**OBSERVED THIS SESSION:** while creating this document, the local file-edit tool was rejected
by the pre-tool convergence hook. The proposed patch quoted the sender-command examples from
line 31. The hook classified the patch as messaging and raised empty-result and missing
rendered-spec-link findings. The requested operation was a local markdown edit, with no sender
or external API invocation. The final document cites the expression's file and line instead of
repeating its literal command examples. This is one observed false classification, not a
measured frequency and not a Dawn incident. The tool transcript retains the rejection.

**INFERENCE:** recall and verification need evaluation at actual prepared operations and actual
submitted context. Another shell-text watcher would not establish universal coverage. This
supports a structural boundary without selecting the design of that boundary in this round.

### 1.4 Instar already has richer pre-send checking, with limited memory

**SOURCE:** the production topic-intent capture loop uses a new message plus rolling summary
and existing refs (`src/core/TopicIntentCapture.ts:232`). Its server wiring is background
Telegram extraction with quota and rate limits (`src/commands/server.ts:14870`).
`src/core/TopicIntentBriefing.ts:51` renders topic orientation, settled/tentative propositions
and task frame, including freshness lag. `src/core/TopicIntentArcCheck.ts:121` classifies the
draft for contradictions, task-frame drift or action on tentative propositions.

The server combines ArcCheck with other signals at `src/server/routes.ts:3004`. A 200 ms race
returns no arc signal on timeout. The tone gate receives ten recent topic messages (`:2972`)
and a route-bounded review (`:3040`). Hold, degraded-floor and open outcomes depend on policy,
recipient class, per-call options and availability. The current source cannot accurately be
summarized as either “every error blocks” or “all review always fails open.”

**INFERENCE:** a checker can catch inconsistency with facts in its supplied context while
missing an omitted earlier exchange. Putting a model after drafting does not manufacture
history. A shared provider failure can affect both drafting and checking. No measured
false-negative rate, false-positive rate or end-to-end latency was obtained here.

### 1.5 The Dawn-derived memory proposal is a proposal, not surface evidence

**REPORTED:** `docs/PROP-memory-architecture.md:1`, dated 2026-02-28 and attributed to Dawn,
diagnoses siloed conversation, relationship, decision and file memory (`:16`). It distinguishes
episodic events, semantic knowledge and working context (`:52`), and proposes activity digestion
during a session rather than only at its end (`:528`). R1 compares those intentions with the
current source, including mismatches in decay, unified retrieval and retry persistence.

This supports the historical motivation for memory layers. It does not establish how Dawn
reads a mail thread, reconstructs a reddit conversation, grounds an X reply, or checks final
recipients and bytes before posting.

## 2. Surface-by-surface unknowns

Every row below is **PENDING-DAWN-CODE**. The final column identifies evidence to inspect
when the code arrives; it is not a question to Justin during this autonomous round.

| Surface | Exact questions | Evidence needed |
|---|---|---|
| Email intake | Is a message captured at arrival, when a job reads it, or only when Dawn explicitly remembers it? Are HTML/plain text, quoted history, attachments and images retained? Can clipped tool output appear complete? | Connector entry point, cursor/dedup logic, MIME parsing, attachment retrieval, raw capture and partial/error fixtures |
| Email identity | Which account/message/thread ids are canonical? How are Message-ID, In-Reply-To and References used? What happens to forwards, subject changes, merged threads, aliases and same-name contacts? | Identity resolver, thread fetcher, relationship lookup and ambiguous/forwarded-mail fixtures |
| Email preparation | Does grounding fetch the thread, messages arriving since drafting began, prior correspondence outside the thread, and recipient-specific preferences or promises? | Draft call graph, retrieval queries, returned bodies, prompt assembly and coverage/truncation records |
| Email dispatch | Are To/Cc/Bcc, account, reply target, attachments and body checked together? What if a changed draft or new inbound invalidates an earlier check? | Exact sender helper, prepared payload, review result, change handling and provider trace |
| X reading | Does Dawn retrieve root, parent chain, her previous replies, account identity, quoted posts and linked context? How are inaccessible/deleted/private posts distinguished from absent history? | Adapter/read helpers, pagination, rate-limit handling and inaccessible-source fixtures |
| X public context | Can a public reply reuse private email or relationship knowledge? Does the checker know the audience and identity changes? | Audience resolution, scope filters and withholding examples |
| X posting | Does grounding cover new posts, replies, quote posts, schedules and edits? Can a wrapper bypass it? | Complete operation inventory, call graph, scheduled path and final-payload checks |
| reddit reading | Are subreddit rules, original post, parent chain, previous exchanges, edits and removals included? What about collapsed or paginated comments? | Thread/comment fetchers, expansion logic, freshness and partial-thread fixtures |
| reddit acting | Are comments, posts, edits, moderation and private messages separated? Does the verifier know the actual action and audience? | Operation definitions, surface prompts, effect preparation and final custody trace |
| Cross-surface identity | Are joins confirmed by an operator, inferred or based on names? Is another person's statement distinguished from an established fact? | Relationship schema, alias provenance, merge/correction code, source labels and sharing boundaries |

## 3. Cross-cutting questions for the incoming code

1. **Boundary coverage.** Enumerate every model entry point and sender: interactive, scheduled,
   agent-to-agent, recovery, CLI, browser and MCP. Which perform grounding? Demonstrate a covered
   action and an alternative path with actual call traces.
2. **Pre-draft versus pre-send.** What arrives before composition, and what is checked afterward?
   Does the checker retrieve independently or see only the writer's chosen context? Can it
   discover a relevant fact the writer omitted entirely?
3. **Captured versus inferred.** Which records preserve original words, speaker, timestamp,
   channel and scope? Which are summaries, propositions, reflections or relationship inferences?
   Does correction change a view while retaining the original event?
4. **Retrieval strategy.** Are exact identity/time queries, lexical search, vectors, graph
   traversal and recursive search used? What selects them? Are empty, partial, stale, timed-out
   and unauthorized results distinguishable? Can a failed query trigger broader search?
5. **Actual assembly.** Can we inspect exact ordered context, full tool results, omitted ranges,
   truncation, source ids and post-formatting transformations? Is successful hook execution
   distinguishable from content actually delivered to the model?
6. **Currentness.** Are event time, learning time and claim-validity time separate? How are
   corrections, contradictions and changed preferences handled? Does cached context bind to
   the current source frontier and recipient?
7. **Draft changes.** Who accepts an enriched or corrected draft? Does a subsequent edit
   invalidate the prior check? What prevents reviewer/writer loops or one checker undoing an
   evidence-backed correction by another?
8. **Race at dispatch.** What if another inbound arrives after grounding? Can the system show
   what history was current, what changed and whether another check ran? Are final bytes and
   recipients linked to the exact checked draft?
9. **Fail direction.** What happens on retrieval/model/tool timeout, corrupt memory, missing
   source, queue pressure and uncertain completion? Which cases deliver, hold, retry, return
   a draft or answer with limited context? Are reachability and integrity treated separately?
10. **Cost and recursion.** Does a checking model trigger its own grounding? What bounds depth,
    calls, tokens, time and cancellation? Which work is asynchronous, cached or amortized?
    Are indexing, reflection and retries counted as well as reads?
11. **Learning from misses.** Does “I already told you” produce a durable update, retrieval
    example, new check or only an apology? Who owns unresolved misses after the session ends?
12. **Measured outcomes.** Supply successes and misses in same-thread, different-thread, email
    and other-person/agent cases. Preserve source exchange, recall opportunity, candidate
    contexts, final action, user reaction, latency and all provider work. Include false alarms,
    held replies, silent failures and unavailable sources.
13. **Counterfactuals.** Were identical cases run with full history, simple search, no live
    checking and retrospective checking? A flag is not proof of a better user outcome; an
    enriched draft may add irrelevant or private information.
14. **Deployment identity.** Which commit, working diff, configuration and installed script
    hashes correspond to the examples? A Laptop checkout alone does not pin the running agent,
    its model, permissions or retention behavior.

## 4. Evidence for and against the hypothesis, pending Dawn

**For:** the inherited lesson favors automatic delivery of actual grounding content. Existing
Instar patterns show that late checks can notice contradictions and return useful hints. The
failed shell-detector redesign supports checking an actual operation instead of its name.
These observations make the hypothesis worth testing.

**Against or limiting:** identity injection is not historical recall; heuristics can block
legitimate work; a checker with ten recent messages cannot verify a year's relationship; and
the 2.0 rulebook recounts the cost and silence caused by live review of every message
(`docs/01-the-rules.md:39`). Extra model calls introduce recursion and shared-failure risks.
The inspected evidence does not establish that universal live checking is necessary, sufficient,
cheaper, or more coherent than earlier retrieval plus targeted review.

`docs/16-conversation-adapters/07-outbound-effects-formatting-and-platform-limits.md:1` requires
final prepared effects to preserve exact meaning/bytes and owner validation. Silently changing
an already admitted draft cannot borrow that admission. `docs/11-the-judgment-doorway.md:97`
also prevents retrieved text acquiring instruction authority. These are inherited constraints
for later design work, not new R2 contracts.

## 5. Handoff and completion condition

The derivable portion is complete. **Dawn surface behavior remains PENDING-DAWN-CODE.**
R4 cannot credit Dawn with unobserved cross-channel recall, verification, durability or latency.
Those cells remain unknown until evidence arrives.

For Echo: supply the promised read-only snapshot, surface entry-point map, relevant local
instructions/configuration and sanitized successful/failed execution traces. Identify Dawn's
running implementation separately from Instar templates inspired by it. Attach the questions
above to the incoming artifact so the next round can answer them in place.

For Justin, through Echo: identify the best example of Dawn remembering an earlier email/X/reddit
exchange, one failure if available, and the behavior to preserve. Also identify preparation
that felt slow, asked unnecessarily, or withheld an expected message. These examples test both
the benefit and the cost of the hypothesis.

Remaining R2 completion means tracing intake → retained history → retrieval → actual context →
draft/check → exact outgoing effect for each surface, with working and failing cases. That
work has not happened in this round.

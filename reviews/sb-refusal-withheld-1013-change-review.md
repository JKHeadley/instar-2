# Change review — sb-refusal-withheld-1013

Subject base: 0de16e3cdaea380ac746793123a51382aeb9830b
Review state: open
Reviewed content: none
Outcome: Plan #542: ordinary merge of refusal-withheld-1013 at 5ca3c3ab71d625ca97bd5568343a152fc7cc708a onto the exact live train-18 head. The merge fast-forwarded with no conflicts. Preserve the unit's implementation and recorded fixture byte for byte, replay the register at its committed head, and verify the recorded refusal admission and delivery boundaries.
Affected rules: 4, 18, 20, 21, 23, 26, 34, 36, 37, 41, 42, 49, 57, 60, 66, 69, 74, 77, 84, 90, 99, 101, 102, 103, 108, 111, 113, 116
Affected floors: secrets — fixed diagnostic text only and unchanged outbound checks; spend cap — existing reservations and finite reply/context bounds; stop — unchanged before calls and sends; no duplicate sends — existing durable intent and receipt path; durable intake — original and rejected model outputs retained in the journal
Operator questions: none
Suggested tier: critical
Declared tier: critical
Tier rationale: Carries the unit's model-authored blocker admission and diagnostic context change.
Side effects: The unit permits an exact blocker quote up to the existing 4096-byte reply bound instead of 500 bytes. Packet and settled-record budgets remain finite. Optional rejection reasons persist through replay and reach contextual review. No new model call, grant, schema category, retry or policy widening. An unchanged recorded violation still withholds. This combine adds only regenerated register publications and this review record.
Undo and recovery: Revert this combine's publication change and the unit implementation if needed before deployment. After a long blocker or optional reason has been written, retain compatible readers: older 500-byte readers cannot reopen that blocker. Roll forward or retain the widened read bound while reverting writer behavior; never rewrite or delete recorded refusals.
Multi-machine posture: Conversation-owner-local validation with existing replicated journal evidence. Every reader of new records requires the compatible version; ownership and dispatch are unchanged.
Layer below: The unchanged validator requires an exact reply quote, a governed constraint, compatible evidence and a finite future recheck. Contextual review and the send doorway still enforce the existing refusal, stop, cap and idempotency paths. The recorded 522-byte refusal failed a size bound rather than authority policy. The existing c4995d31 typing repair is retained without duplicating it.
Bug class: integration
Bug evidence: reproducer=tests/preview/refusal-withheld.test.ts
Hook bypass: none
Convergence: none
Decision: sb-refusal-withheld-1013-merge | Merge the reviewed unit unchanged onto the exact live base; the ordinary merge fast-forwarded and had no conflicts; unit evidence is in /Users/dabombstudio/.instar/agents/echo/.instar/lanes/refusal-withheld-1013-PROGRESS.md and its carried repair report | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/sb-refusal-withheld-1013-PROGRESS.md
Decision: sb-refusal-withheld-1013-desk | Run the cint-L37 desk chain: zero inventory pins and owner pins changed, compile, then replay register at 5ca3c3ab71d625ca97bd5568343a152fc7cc708a; use generated output rather than hand edits | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/sb-refusal-withheld-1013-PROGRESS.md
Prompt review: No new instructions or constitutional wording. The unit adds fixed validation reasons to model-facing context. Replay uses the actual writer, Jev, revision and review outputs from update 6233134, physical frames 839–878. Its passing final-review neighbor is explicitly controlled after the missing-blocker premise becomes false; it is wiring evidence, not fresh provider judgment. The unmodified recorded violation remains a separate negative test. Default-context-floor retains its guard unchanged.
Prompt finding: 849db3a6296a | protocol-literal | Unchanged fixed memory-inventory response and its renderer test; this merge adds no classifier.
Prompt finding: e8708c7fea24 | protocol-literal | Unchanged attribution instruction tested for packet delivery; this merge adds no phrase-based judgment.
Deferral: generated/register.json:1 | not-a-deferral=Generated register quotes the rule book; no new deferred work is introduced.

simplestRobustRoute: This is the simplest robust route: merge the reviewed unit unchanged and use the existing desk regeneration tools. The unit repairs the measured quote-size mismatch using the existing reply bound and exposes existing validation reasons. It adds no refusal category or approval machinery. Start guards remain exact claim/constraint/evidence admission; end guards are contextual review and durable receipts; stop, call and byte limits remain. Recorded local replay supports this submission; unattended live acceptance belongs to the desk's gate.
80/20: Focused recorded-shape, boundary, context-floor and register checks; no full-suite run or new implementation in the combine.
VERDICT: author submission; this record asserts no independent verdict

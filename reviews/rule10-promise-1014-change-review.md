# Change review — Final reply revision commitments

Subject base: c458547406d4ad8f3c7988f8247befb73775f618
Review state: open
Reviewed content: none
Outcome: Preserve model-declared promises and fulfillments from the final revised reply through admission, journal replay and send intent.
Affected rules: Rules 4, 8, 10, 12, 26, 34, 36, 41, 70, 74, 75, 83, 101, 102, 111, 113, 116; purpose constraint 2.
Affected floors: Secrets retain outbound checks; spend cap retains the existing metered revision call; stop retains worker admission; no duplicate sends retains durable intent and receipt checks; durable intake retains the existing journal.
Operator questions: none
Suggested tier: critical
Declared tier: critical
Tier rationale: Production journal metadata and model revision guidance change.
Side effects: Valid final-text declarations supersede stale answer declarations when the revision is selected. Legacy fields preserve existing behavior. Malformed declarations produce zero proposals through existing validators. Fulfillment retains exact-quote and commitment support checks.
Undo and recovery: Revert the three implementation files with their regression. Optional journal fields require no migration. Preserve sent receipts throughout rollback.
Multi-machine posture: Metadata rides the existing encrypted shared journal and current conversation owner. Restart replay consumes the durable revision before sending once.
Layer below: Inspected promiseProposals, fulfillmentProposals, fulfillmentSupported, recordedPromises, revision parsing, journal projection, revision selection and durable intent construction. agent-commitment.ts remains unchanged.
Bug class: durability
Bug evidence: reproducer and restart: journal-revision-promises.test.ts replays captured update 715676157 including crash after the durable revision. Positive, unchanged, legacy, non-promise, altered and unsupported quote neighbors pass. Seven regression cases additionally cover fulfillment across restart, unsupported fulfillment ids/quotes, and withholding a rejected revision without adopting its declarations. Final-metadata/review results are labelled synthetic. The first crash test used an incorrect boundary name; corrected to after:reply-revision, then all 99 focused tests passed.
Hook bypass: none; inspected core.hooksPath (unset) and common hooks directory (sample hooks only).
Convergence: none
Prompt review: The reviser declares final-text metadata using the existing exact-excerpt contract. canary-review-replay and held-cascade-replay exercise recorded outputs. The findings below refer to unchanged protocol instructions, checked against the diff and their consumer tests. This record describes verified positive and negative behavior, not a search yielding no results.
Decision: rule10-revision-metadata | Extend the existing bounded revision response with final-text model declarations and existing exact validators. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/rule10-promise-1014-PROGRESS.md
Decision: rule10-fixture-replay | Read the desk-committed pair; transform it for negative controls and distinguish captured text from synthetic protocol declarations. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/rule10-promise-1014-PROGRESS.md
Prompt finding: 0abb3dc96311 | protocol-literal | Existing reminder admission guidance; unchanged by this diff.
Prompt finding: 5b486d8bd247 | protocol-literal | Existing review response brevity instruction; unchanged by this diff.
Prompt finding: 5fa1a20c4031 | protocol-literal | Existing verified-audience quoted-literal guidance; unchanged by this diff.
Prompt finding: 7c45ffbe90ad | protocol-literal | Existing declaration/evidence packet vocabulary; unchanged by this diff.
Prompt finding: 849db3a6296a | protocol-literal | Existing memory rendering instruction; unchanged by this diff.
Prompt finding: aef7d91bef51 | protocol-literal | Existing one-verdict-per-rule schema; unchanged by this diff.
Prompt finding: b288d6ef1604 | protocol-literal | Existing bounded response format; unchanged by this diff.
Prompt finding: e769ca9dd959 | protocol-literal | Existing PASS/VIOLATION protocol; unchanged by this diff.
Prompt finding: e8708c7fea24 | protocol-literal | Existing source attribution instruction; unchanged by this diff.
Prompt finding: f6d7f3274c85 | protocol-literal | Existing blocker deduplication instruction; unchanged by this diff.
Prompt finding: feadb66b8ad1 | protocol-literal | Existing credential boundary; unchanged by this diff.

simplestRobustRoute: This is the simplest robust route: the reviser already authors final text, so carry its metadata through the existing record and validators. Start guards remain bounded call admission and exact quote/type checks; end guards remain final filtering and durable send evidence. Recorded shipped-path bytes establish the regression; live acceptance belongs to the desk.
80/20: Targeted regression, direct consumers and required local checks. The desk owns live proof and full-suite acceptance.
VERDICT: author submission for desk review; independent review remains with the desk

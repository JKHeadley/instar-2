# Review guide — installation on macOS and Linux

Read [the platform guarantees](../docs/14-the-assembly.md#installation-platforms), [the build units](../docs/14-the-assembly.md#fresh-installation), [the protected local act](../docs/15-the-operator-surfaces.md#fresh-install-pairing), and [custody/recovery](../docs/17-harness-adapters/03-capability-account-quota-and-launch-pins.md#installation-custody-and-recovery).

Subject base: ac3bd4d8874495f8b66b571837a1380995113d7a
Review state: open
Reviewed content: none
Outcome: Retain this main design guide while repairing its record metadata on train-26; the combined source subject and verification are covered by reviews/train-26-change-review.md. The design outcome is a fresh-install design with no Mac prerequisite, concrete macOS and Linux bindings, and named Linux implementation commitments. Design only; no runtime or model-facing change.
Affected rules: purpose independent safeguards, single-machine operation and durable cause; Rules 1/28/29/31/32/49/71/74/90/91/100/101/111/113/116.
Affected floors: secrets, spend cap, stop, no duplicate sends and durable intake remain required on both OSes.
Operator questions: none for this design; the operator already directed OS compatibility. A separate constitutional proposal is in the builder report, not this PR.
Suggested tier: critical
Declared tier: critical
Tier rationale: Metadata repair on the combined critical train; original platform design remains unchanged.
Side effects: each installation milestone needs evidence on both OSes, including headless Linux. An existing Mac mechanism does not establish installer readiness.
Undo and recovery: supersede these design bindings through the existing changelogs; no runtime migration or authority change.
Multi-machine posture: single-machine on either OS without a peer; private custody and OS checks stay host-local; shared authority/history and P-08 replication demands remain unchanged.
Layer below: purpose and rules read in full; PR 162 enrollment and genesis; existing One/Two/Four/Nine/Ten/Eleven/Seventeen owner boundaries. No OS requirement exists in the constitution: the purpose's single-machine rule is at lines 139–144; Rule 30 at rules line 216 covers harnesses, not operating systems.
Bug class: none
Hook bypass: none
Convergence: none

## Fixed authority contract

The enrollment order remains pending session → provider-authenticated phone account and DM → protected local selection → exact phone confirmation. Local mechanisms vary by OS; code possession still cannot select an operator. The numbered record sequence in part 06 remains byte-for-byte unchanged: `R/OR → GP`, `E → GE → A0 → O0 → GO → C0`. Neither OS adds an approval class or an authority database.

## Implementation and evidence

Linux uses a separate system user and systemd system service, a protected polkit/sudo helper, and custodian-only files with independent encrypted vault backup. The headless route uses an operator-only console/SSH session and the same phone sequence. All six Linux units in part 14 are to build. Each unit must prove its successful case and the matching refusal cases already attached to the four milestones. No new installer readiness or Linux execution evidence is claimed.

Mechanism references: [polkit authentication and retained-authority limits](https://polkit.pages.freedesktop.org/polkit/polkit.8.html) and [Apple Authorization Services](https://developer.apple.com/library/archive/documentation/Security/Conceptual/authorization_concepts/01introduction/introduction.html). Binding OS authentication to the exact pending subject is an Instar implementation obligation, not a property these APIs supply by themselves.

## Other Mac-specific design references (unchanged)

A repository-wide scan of docs Markdown for Mac/macOS, Keychain, launchd/launchctl, hdiutil, sandbox-exec, dscl, Darwin, Touch ID, Seatbelt and osascript finds two other design passages, both in the conversation adapters:

- `docs/16-conversation-adapters/03-inbound-custody-before-platform-acknowledgment.md:76` — iMessage on a Mac uses the enrolled account/service, database epoch and stable message/chat identifiers.
- `docs/16-conversation-adapters/14-operator-decisions-and-honest-limits.md:27` — personal-device policy explicitly covers iMessage on a Mac.

Those are channel-specific requirements, not a requirement that all of Instar run on a Mac. No other design part states a Mac-only mechanism as the general design. `docs/03-the-glossary.md:182` uses “keychain” as one example of a store. Harvest quotations, recorded research hardware and the resolved off-Mac lane-document defect are historical/evidence references, not design mechanisms. No out-of-scope file is changed.

## Review checks

Confirm the constitution and numbered authority sequence are unchanged; compare the four enrollment steps for unchanged actors, order and evidence; verify each build row names the common interface and both OS implementations. The allow/refuse pairs remain real implementation exit conditions, not stub tests or claimed live evidence.

Prompt review: No new prompt is authored by this guide. Its combined train range retains the topic member and live prompt contracts reviewed in reviews/train-26-change-review.md.
Prompt finding: e8708c7fea24 | protocol-literal | Unchanged attribution instruction; the cited recall test checks that it reaches the packet. This repair adds no phrase-based judgment.
Prompt finding: 849db3a6296a | protocol-literal | Unchanged fixed memory-inventory response; the cited test checks its existing renderer, not a classifier introduced by this change.
Prompt finding: 5b486d8bd247 | protocol-literal | Existing tested instruction/protocol wording, not an expected answer or an intent keyword test — fixture-phrase tests/preview/reply-check.ts <- tests/preview/act-first.test.ts: "prioritize verdicts; do not repeat rules or context."
Prompt finding: 5fa1a20c4031 | protocol-literal | Existing tested instruction/protocol wording, not an expected answer or an intent keyword test — fixture-phrase tests/preview/reply-check.ts <- tests/preview/act-first.test.ts: "an illustrative or quoted literal the verified operator explicitly requested or "
Prompt finding: 849db3a6296a | protocol-literal | Existing tested instruction/protocol wording, not an expected answer or an intent keyword test — fixture-phrase tests/preview/journal.ts <- tests/preview/journal-memory-list.test.ts: "i have no active saved memory items"
Prompt finding: aef7d91bef51 | protocol-literal | Existing tested instruction/protocol wording, not an expected answer or an intent keyword test — fixture-phrase tests/preview/reply-check.ts <- tests/preview/act-first.test.ts: "give each listed rule, and no others, one verdict"
Prompt finding: b288d6ef1604 | protocol-literal | Existing tested instruction/protocol wording, not an expected answer or an intent keyword test — fixture-phrase tests/preview/reply-check.ts <- tests/preview/act-first.test.ts: "keep reasoning under 400 characters and all json under 4000 so every verdict fit"
Prompt finding: e769ca9dd959 | protocol-literal | Existing tested instruction/protocol wording, not an expected answer or an intent keyword test — fixture-phrase tests/preview/reply-check.ts <- tests/preview/act-first.test.ts: "pass means no breach; violation means a breach, named in its reason."
Prompt finding: e8708c7fea24 | protocol-literal | Existing tested instruction/protocol wording, not an expected answer or an intent keyword test — fixture-phrase tests/preview/journal.ts <- tests/preview/hallucinated-memory-rate.test.ts: "cite sourcelabel; disclose unknown sources."
Prompt finding: f6d7f3274c85 | protocol-literal | Existing tested instruction/protocol wording, not an expected answer or an intent keyword test — fixture-phrase tests/preview/reply-check.ts <- tests/preview/act-first.test.ts: "restating a recorded, still-open limit needs no duplicate record. a capability n"
Prompt finding: feadb66b8ad1 | protocol-literal | Existing tested instruction/protocol wording, not an expected answer or an intent keyword test — fixture-phrase tests/preview/reply-check.ts <- tests/preview/act-first.test.ts: "any live authentication secret reaching anyone but the verified operator who sup"
Prompt finding: 0abb3dc96311 | protocol-literal | Historical prompt translation checks the reviewed unresolved-date admission instruction; it is not an expected model answer or an intent detector.
Prompt finding: 7c45ffbe90ad | protocol-literal | Historical prompt translation checks the new admitted-reminder evidence field while retaining the recorded verdict; it is not an expected model answer or an intent keyword test.
Prompt finding: b1bb3946362d | protocol-literal | Existing production-provider identity prefix asserted by the now-scoped act-first test; this change does not alter that identity, provider, or assertion.
Prompt finding: 42faf877ba82 | protocol-literal | Existing production-codex-provider identity prefix asserted by the now-scoped act-first test; this change does not alter that identity, provider, or assertion.
Prompt finding: e8708c7fea24 | protocol-literal | Existing source-label and unknown-source capability guidance, unchanged by this scheduling change; tests assert that documented provenance contract, not a phrase-triggered lifecycle or acceptance decision.
Prompt finding: 849db3a6296a | protocol-literal | Existing fixed empty-memory-list reply, unchanged by this change; the test checks its exact empty-result rendering, not a model judgment keyed to fixture wording.
Prompt finding: 034c5250da92 | protocol-literal | Existing standing-authority policy wording, unchanged here; the fixture asserts the shared grant/revocation description, not a phrase-triggered answer.
Prompt finding: 45e37ea2e9e9 | protocol-literal | Existing tool authority policy, unchanged here; this describes allowed scope and does not choose an answer by input wording.
Prompt finding: 6af48f94b789 | protocol-literal | Existing single-machine effect boundary wording, unchanged here; the effect checkpoint enforces it and the test pins truthful capability description.
Prompt finding: b00ed403060a | protocol-literal | The repeated existing tool-scope instruction is policy text, not a fixture cue or input branch; the new route does not alter it.
Prompt finding: b1bb3946362d | protocol-literal | Existing agent identity opening, unchanged here; every input uses it without test-specific dispatch.
Prompt finding: 450c79237a95 | protocol-literal | Existing conflict/recall evidence instruction, unchanged here; matching assertions protect evidence handling for arbitrary memories.

simplestRobustRoute: This is the simplest robust route: preserve existing owner contracts and add only concrete OS bindings and their evidence obligations, preventing a silent Mac dependency without new authority machinery.
80/20: Preserve the original design prose; repair missing metadata using the train subject, with integration validation in the train record.
VERDICT: author submission; independent review pending

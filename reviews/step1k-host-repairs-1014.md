# Change review — step1k-host-repairs-1014

Subject base: d53ed65386a3c4d2be9069ce2b0b0752f0b1c944
Review state: open
Reviewed content: none
Outcome: Restore the three accepted train-24 host repairs on step1h while preserving topic coordination and reserved repair admission.
Affected rules: Purpose 2/3; Rules 1, 7, 26, 33, 34, 36, 37, 42, 45, 46, 49, 55, 60, 63, 68, 70, 74, 75, 96, 101, 102, 111, 112, 113, 114, 116.
Affected floors: secrets — existing encrypted custody and outbound checks; spend cap — shared retained parent allowance and earlier persisted deadline; stop — exact worker retirement and existing stop checkpoints; no duplicate sends — original journal send receipt, child-only repair identity and no UNKNOWN replay; durable intake — original queue and complete outcomes retained.
Operator questions: none
Suggested tier: critical
Declared tier: critical
Tier rationale: Restores durable host completion and lifetime enforcement at the shipped journal/topic integration boundary.
Side effects: Adds collection through topic routing without creating a new intake, charge or send. Fresh topic hosts inherit the original installation lifetime. Prompts retain bounded unresolved references while complete history stays durable. Repair results are collected by canonical child identity.
Undo and recovery: Revert this integration before deployment; preserve encrypted snapshots, journal reservations, original/child outcomes and receipts. Never replay UNKNOWN effects. Reverting collector support leaves pending answers retained but undelivered.
Multi-machine posture: Existing owner fencing remains. Worker handles and encrypted host snapshots are deliberately machine-local; no cross-machine handle adoption or new replication policy.
Layer below: Inspected adapter delivery/observation, topic shared reservation, durable parent deadline, encrypted journal reservation and exact prepared-packet comparison, canonical repair topic resolver and unique send path.
Bug class: integration
Bug evidence: reproducer=tests/preview/journal-conversation-session.test.ts
Hook bypass: none; core.hooksPath unset; common hooks directory contains only sample hooks.
Convergence: none
Prompt review: No new semantic classifier. Accepted bounded unresolved references replace repeated full answer text. Replay archived answer frames, summary uncertain, Jev uncertain/undecided, reply review and delivered/empty replies through collection and retain step1h recorded repair packets.
Prompt finding: 849db3a6296a | protocol-literal | Existing journal protocol instructions, unchanged by result collection; no copied test phrase is used as a classifier.
Prompt finding: e8708c7fea24 | protocol-literal | Existing journal protocol instructions, unchanged by result collection; no copied test phrase is used as a classifier.
Deferral: tests/preview/journal-conversation-session.test.ts:390 | not-a-deferral=Executable delayed-completion regression and variable; no promised work is postponed.
Deferral: tests/preview/journal-conversation-session.test.ts:423 | not-a-deferral=Executable delayed-completion regression and variable; no promised work is postponed.
Deferral: tests/preview/journal-conversation-session.test.ts:425 | not-a-deferral=Executable delayed-completion regression and variable; no promised work is postponed.
Deferral: tests/preview/journal-conversation-session.test.ts:427 | not-a-deferral=Executable delayed-completion regression and variable; no promised work is postponed.
Deferral: tests/preview/journal-conversation-session.test.ts:429 | not-a-deferral=Executable delayed-completion regression and variable; no promised work is postponed.
Deferral: tests/preview/journal-conversation-session.test.ts:430 | not-a-deferral=Executable delayed-completion regression and variable; no promised work is postponed.
Deferral: tests/preview/journal-conversation-session.test.ts:431 | not-a-deferral=Executable delayed-completion regression and variable; no promised work is postponed.
Deferral: tests/preview/journal-conversation-session.test.ts:432 | not-a-deferral=Executable delayed-completion regression and variable; no promised work is postponed.
Deferral: tests/preview/journal-conversation-session.test.ts:433 | not-a-deferral=Executable delayed-completion regression and variable; no promised work is postponed.
Deferral: tests/preview/journal-conversation-session.test.ts:434 | not-a-deferral=Executable delayed-completion regression and variable; no promised work is postponed.
Deferral: tests/preview/journal-conversation-session.test.ts:435 | not-a-deferral=Executable delayed-completion regression and variable; no promised work is postponed.
Deferral: tests/preview/journal-conversation-session.test.ts:436 | not-a-deferral=Executable delayed-completion regression and variable; no promised work is postponed.
Deferral: tests/preview/journal-conversation-session.test.ts:437 | not-a-deferral=Executable delayed-completion regression and variable; no promised work is postponed.
Deferral: tests/preview/journal-conversation-session.test.ts:438 | not-a-deferral=Executable delayed-completion regression and variable; no promised work is postponed.
Deferral: tests/preview/journal-conversation-session.test.ts:443 | not-a-deferral=Executable delayed-completion regression and variable; no promised work is postponed.


## Closing block

simplestRobustRoute: This is the simplest route: merge the accepted host repairs, delegate collection through the existing topic port and select the reserved repair identity at the existing journal consumer. Earlier parent deadlines prevent restart or a new topic renewing authority. No new queue, sender, budget or policy. Admission and stop guard start; exact packet/receipt guard completion; parent bounds guard execution. No fresh live acceptance claimed.
80/20: Targeted foreground host, topic, bridge, archived-shape, required single-file and pinned gate checks; the Studio owns full-suite and live acceptance.
VERDICT: author submission; this record asserts no independent verdict — the review desk records its own

Decision: step1k-merge | Merge train-24 rather than rewrite its accepted repairs; retain both parent histories and all step1h behavior. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/step1k-host-repairs-1014-PROGRESS.md
Decision: step1k-topics | Delegate result collection through existing topic custody and clamp new topics to the persisted installation deadline. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/step1k-host-repairs-1014-PROGRESS.md
Decision: step1k-repair-collection | Collect reserved format repairs by canonical child identity, preserving exact prepared-packet matching and parent send receipt. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/step1k-host-repairs-1014-PROGRESS.md
Decision: step1k-regressions | Combine both test families; frame 404 now correctly executes its reserved repair, so compare immediate and delayed delivery counts. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/step1k-host-repairs-1014-PROGRESS.md
Decision: step1k-register | Regenerate publication and source hashes from combined content; never hand-merge generated outputs. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/step1k-host-repairs-1014-PROGRESS.md
Decision: step1k-test-portability | Supply the extracted decoder to the existing topic fixture; test runtime mismatch only on the declared platform and assert the adapter reports the actual host platform. Physical macOS confinement remains for Studio. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/step1k-host-repairs-1014-PROGRESS.md

Validation: 148 host/topic/bridge and Astra reproduction cases pass; model-json 51/51; topic-journal 3/3; shipped-clients 5/5; native certification posture 1/1. Build, typecheck and architecture pass. Native physical confinement remains Studio-only. Register replay derives 291 entries and 116 rules from the combined source commit.

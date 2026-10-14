# Change review — platform design carried by train-29

Subject base: ac3bd4d8874495f8b66b571837a1380995113d7a
Review state: open
Reviewed content: none
Outcome: Combine the exact live base with approved main design text, reserved repair topic admission and a receipt-aware acknowledgement deadline.
Affected rules: Purpose 2/3/6; Rules 1, 4, 13, 26, 28, 29, 34, 36, 37, 42, 46, 49, 52, 55, 57, 63, 68, 70, 74, 75, 77, 87, 90, 91, 95, 101, 102, 111, 112, 113, 116.
Affected floors: Secrets and stop retain their existing gates. Spend uses the existing bounded repair and notice reservations. Durable intake and no duplicate sends remain enforced by authoritative parent send receipts; repair execution identities never become separate send identities.
Operator questions: none
Suggested tier: critical
Declared tier: critical
Tier rationale: Composition of reviewed conversation execution, durable repair admission and acknowledgement scheduling, retaining the live base.
Side effects: Reserved format repairs inherit the parent's topic only after durable admission. Slow answers may use one notice allowance three seconds earlier. Seven-second acknowledgement intents remain replayable alongside older eight/ten-second intents. No new model gate, authority, retry loop or store. Main design text is unchanged; changelog histories preserve both branches. Source pins and generated publications are refreshed by existing desk tools.
Undo and recovery: Revert the combined candidate before deployment, without rewriting its history. After use retain the seven-second replay floor and durable repair identity readers; never erase journals or retry UNKNOWN sends. No live deployment is performed here.
Multi-machine posture: Existing conversation ownership and durable journal/send fences remain authoritative. The host owns reusable sessions; other machines gain no new dispatch rights. Build and offline checks are local to WSL; Studio performs host-bound acceptance.
Layer below: Inspect the production topic lookup against accepted/reserved/answerRetried journal fields and the canonical format-retry marker; inspect separate execution digests and the parent send receipt. Inspect timer admission, replay floor and final-dispatch suppression, retaining eligibility during pending review. The merge preserves exact reviewed source bytes and base ancestry.
Bug class: integration
Bug evidence: reproducer=tests/preview/journal-conversation-session.test.ts; live=tests/preview/fixtures/repair-admission-rewalk-2026-10-14.json
Hook bypass: none; core.hooksPath unset and common hooks directory contains only sample hooks.
Convergence: none
Prompt review: No new model wording or parser in this composition. Replay the members' recorded repair packets and summary/uncertain/Jev/reply-review/delivered/empty candidate shapes through the production topic coordinator, plus the recorded acknowledgement timelines. Simulated successful repair outputs and injected timing are not described as fresh live judgments.
Prompt finding: e8708c7fea24 | protocol-literal | Existing source attribution instruction is unchanged; fixture checks delivery of evidence labels, not intent classification.
Prompt finding: 849db3a6296a | protocol-literal | Existing empty-memory renderer is unchanged; literal names the exact inventory state, not a new classifier.



Decision: train-29-platform-record | Carry the platform design guide in a complete review of the actual train composition; the original author guide remains quoted below, with no independent convergence claim. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/train-29-PROGRESS.md

## Original platform design guide (da99cd521f8eb7a11c0fee24961df13d47d19f9e)

> # Review guide — installation on macOS and Linux
>
> Read [the platform guarantees](../docs/14-the-assembly.md#installation-platforms), [the build units](../docs/14-the-assembly.md#fresh-installation), [the protected local act](../docs/15-the-operator-surfaces.md#fresh-install-pairing), and [custody/recovery](../docs/17-harness-adapters/03-capability-account-quota-and-launch-pins.md#installation-custody-and-recovery).
>
> Outcome: a fresh-install design with no Mac prerequisite, concrete macOS and Linux bindings, and named Linux implementation commitments. Design only; no runtime or model-facing change.
> Affected rules: purpose independent safeguards, single-machine operation and durable cause; Rules 1/28/29/31/32/49/71/74/90/91/100/101/111/113/116.
> Affected floors: secrets, spend cap, stop, no duplicate sends and durable intake remain required on both OSes.
> Operator questions: none for this design; the operator already directed OS compatibility. A separate constitutional proposal is in the builder report, not this PR.
> Suggested tier: significant
> Declared tier: significant
> Side effects: each installation milestone needs evidence on both OSes, including headless Linux. An existing Mac mechanism does not establish installer readiness.
> Undo and recovery: supersede these design bindings through the existing changelogs; no runtime migration or authority change.
> Multi-machine posture: single-machine on either OS without a peer; private custody and OS checks stay host-local; shared authority/history and P-08 replication demands remain unchanged.
> Layer below: purpose and rules read in full; PR 162 enrollment and genesis; existing One/Two/Four/Nine/Ten/Eleven/Seventeen owner boundaries. No OS requirement exists in the constitution: the purpose's single-machine rule is at lines 139–144; Rule 30 at rules line 216 covers harnesses, not operating systems.
> Hook bypass: none
> Convergence: none; author submission for independent review.
>
> ## Fixed authority contract
>
> The enrollment order remains pending session → provider-authenticated phone account and DM → protected local selection → exact phone confirmation. Local mechanisms vary by OS; code possession still cannot select an operator. The numbered record sequence in part 06 remains byte-for-byte unchanged: `R/OR → GP`, `E → GE → A0 → O0 → GO → C0`. Neither OS adds an approval class or an authority database.
>
> ## Implementation and evidence
>
> Linux uses a separate system user and systemd system service, a protected polkit/sudo helper, and custodian-only files with independent encrypted vault backup. The headless route uses an operator-only console/SSH session and the same phone sequence. All six Linux units in part 14 are to build. Each unit must prove its successful case and the matching refusal cases already attached to the four milestones. No new installer readiness or Linux execution evidence is claimed.
>
> Mechanism references: [polkit authentication and retained-authority limits](https://polkit.pages.freedesktop.org/polkit/polkit.8.html) and [Apple Authorization Services](https://developer.apple.com/library/archive/documentation/Security/Conceptual/authorization_concepts/01introduction/introduction.html). Binding OS authentication to the exact pending subject is an Instar implementation obligation, not a property these APIs supply by themselves.
>
> ## Other Mac-specific design references (unchanged)
>
> A repository-wide scan of docs Markdown for Mac/macOS, Keychain, launchd/launchctl, hdiutil, sandbox-exec, dscl, Darwin, Touch ID, Seatbelt and osascript finds two other design passages, both in the conversation adapters:
>
> - `docs/16-conversation-adapters/03-inbound-custody-before-platform-acknowledgment.md:76` — iMessage on a Mac uses the enrolled account/service, database epoch and stable message/chat identifiers.
> - `docs/16-conversation-adapters/14-operator-decisions-and-honest-limits.md:27` — personal-device policy explicitly covers iMessage on a Mac.
>
> Those are channel-specific requirements, not a requirement that all of Instar run on a Mac. No other design part states a Mac-only mechanism as the general design. `docs/03-the-glossary.md:182` uses “keychain” as one example of a store. Harvest quotations, recorded research hardware and the resolved off-Mac lane-document defect are historical/evidence references, not design mechanisms. No out-of-scope file is changed.
>
> ## Review checks
>
> Confirm the constitution and numbered authority sequence are unchanged; compare the four enrollment steps for unchanged actors, order and evidence; verify each build row names the common interface and both OS implementations. The allow/refuse pairs remain real implementation exit conditions, not stub tests or claimed live evidence.
>
> simplestRobustRoute: This is the simplest robust route: preserve existing owner contracts and add only concrete OS bindings and their evidence obligations, preventing a silent Mac dependency without new authority machinery.
> VERDICT: author submission; independent review pending

simplestRobustRoute: This is the simplest robust route: ordinary merges of the reviewed heads plus existing generation tools and direct consumer checks. No new orchestration or policy mechanism. Start guards remain verified durable intake and exact reserved repair admission; end guards remain durable completion and unique parent sends; timer and repair caps bound resource use. Offline replay is evidence of composition, not unattended live acceptance; that remains the desk's gate.
80/20: Changed tests, direct imports, journal suites and named register/briefing checks only, with foreground chunks under ten minutes; no full suite or load generation.
VERDICT: author submission for desk review; no independent convergence or live acceptance claimed

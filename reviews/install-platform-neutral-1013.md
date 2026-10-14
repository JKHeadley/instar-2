# Review guide — installation on macOS and Linux

Subject base: 7ef8f158d4129a4cf90cf3c546701f32e348fdd3

Read [the platform guarantees](../docs/14-the-assembly.md#installation-platforms), [the build units](../docs/14-the-assembly.md#fresh-installation), [the protected local act](../docs/15-the-operator-surfaces.md#fresh-install-pairing), and [custody/recovery](../docs/17-harness-adapters/03-capability-account-quota-and-launch-pins.md#installation-custody-and-recovery).

Outcome: a fresh-install design with no Mac prerequisite, concrete macOS and Linux bindings, and named Linux implementation commitments. Design only; no runtime or model-facing change.
Affected rules: purpose independent safeguards, single-machine operation and durable cause; Rules 1/28/29/31/32/49/71/74/90/91/100/101/111/113/116.
Affected floors: secrets, spend cap, stop, no duplicate sends and durable intake remain required on both OSes.
Operator questions: none for this design; the operator already directed OS compatibility. A separate constitutional proposal is in the builder report, not this PR.
Suggested tier: significant
Declared tier: significant
Side effects: each installation milestone needs evidence on both OSes, including headless Linux. An existing Mac mechanism does not establish installer readiness.
Undo and recovery: supersede these design bindings through the existing changelogs; no runtime migration or authority change.
Multi-machine posture: single-machine on either OS without a peer; private custody and OS checks stay host-local; shared authority/history and P-08 replication demands remain unchanged.
Layer below: purpose and rules read in full; PR 162 enrollment and genesis; existing One/Two/Four/Nine/Ten/Eleven/Seventeen owner boundaries. No OS requirement exists in the constitution: the purpose's single-machine rule is at lines 139–144; Rule 30 at rules line 216 covers harnesses, not operating systems.
Hook bypass: none
Convergence: none; author submission for independent review.

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

simplestRobustRoute: This is the simplest robust route: preserve existing owner contracts and add only concrete OS bindings and their evidence obligations, preventing a silent Mac dependency without new authority machinery.
VERDICT: author submission; independent review pending

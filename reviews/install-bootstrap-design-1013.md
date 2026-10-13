# Review guide — fresh installation bootstrap

Subject base: 1b26222647ed2e5dab3b21a65f7d996106e60541
Review state: open
Reviewed content: none
Outcome: Specify the missing authenticated operator/genesis bootstrap for an ordinary single-machine installation, then reuse verified binding and P-02's existing yes for the first subscription. Design only; no constitution, runtime, prompt, parser or model acceptance code changes.
Affected rules: Purpose independent safeguards, brief role onboarding, durable cause, single-machine operation and evidence constraints; Rules 7, 18, 26, 28, 29, 32, 38, 49, 55, 60, 63, 73, 74, 78, 79, 80, 82, 90, 91, 94, 98, 100, 101, 102, 103, 104, 109, 111, 113 and 116; P-01, P-02, P-05 and P-08.
Affected floors: secrets — independently administered custody and recovery before use; spend cap — first paid use waits for actual cap authority, not a recorded monthly preference; stop — durable stop and independent recovery remain available; no duplicate sends — existing ownership, durable claims and uncertain-effect retention; durable intake — preserve input and resumable owner records before claiming acceptance.
Operator questions: none for design direction; the brief selects option 1 and no constitutional or policy amendment is proposed. Repository CODEOWNERS still names Justin for docs approval; this branch is never merged by the builder.
Suggested tier: critical
Declared tier: significant
Tier rationale: A focused design addition affecting trust bootstrap requires independent review; it claims neither live protection nor an implemented installer.
Side effects: Builders now have a concrete separate-identity custody and first-supervisor obligation. Role setup on the installation track and desk-only login/exchange helpers are explicitly distinguished from ordinary installation readiness. Publication pins and generated register metadata must follow the changed design bytes without conferring runtime authority.
Undo and recovery: Supersede the design in a new changelog revision and regenerate publication references, retaining every earlier revision. No runtime state is migrated. The proposed product recovery restores control through the independent holder without repeating uncertain effects.
Multi-machine posture: One machine is supported without a runtime peer. Custody handles, OS isolation and installation checkpoints are deliberately host-local; authority and admitted history retain Two's shared ownership. Recovery backup is not a peer. Enrollment of a second machine retains P-08 replication demands and loss of that peer never lowers them.
Layer below: Read the purpose then all rules on origin/main; the policy register; One's grant and account-assented contract through the firstgrant finding and owner text; Two's genesis admission; Four's binding; Nine's protection broker; Ten's manifest, startup and supervision boundary; Eleven's surface; Seventeen's account/custody contract; terminal role slice on origin/train-18; existing login inventory and activation authority. Read both specified Studio reports through the read-only API.
Bug class: none
Bug evidence: none
Hook bypass: none
Convergence: none
Decision: install-bootstrap-D1 | An authenticated OS installation session establishes the independent custodian; its authenticated phone pairing act anchors exact org-intent/genesis and binding before any P-02 yes. No new approval class or terminal self-grant. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/install-bootstrap-design-1013-PROGRESS.md
Decision: install-bootstrap-D2 | A bounded local setup supervisor prevents subscription admission depending on itself; existing Seven admission stays nonrecursive and no preview waiver is inherited. This route must earn real adequacy evidence before implementation readiness. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/install-bootstrap-design-1013-PROGRESS.md
Decision: install-bootstrap-D3 | Name the separate OS broker and operator-only recovery vault, with restore verification and explicit machine-loss limits; an agent-readable directory cannot serve as either authority or recovery proof. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/install-bootstrap-design-1013-PROGRESS.md
Decision: install-bootstrap-D4 | Keep safeguards default-on and scope the documented developer override to the existing account-access acceptance or a prior authenticated Rule-94 waiver; neither manufactures independent protection. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/install-bootstrap-design-1013-PROGRESS.md
Decision: install-bootstrap-D5 | Use the existing five owner documents, append-only JSON histories and generated Markdown histories; refresh only derived publication material required by their consumers. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/install-bootstrap-design-1013-PROGRESS.md

## Read in this order

1. [Assembly: sequence, status and ordered build units](../docs/14-the-assembly.md#fresh-installation).
2. [Operator surface: authenticated act and phone recovery](../docs/15-the-operator-surfaces.md#fresh-install-pairing).
3. [Custody: separate OS identity, account-at-use and independent backup](../docs/17-harness-adapters/03-capability-account-quota-and-launch-pins.md#installation-custody-and-recovery).
4. [Genesis admission](../docs/06-the-fact-envelope.md#admission--the-one-boundary-a-fact-can-enter-through) and [binding before approval](../docs/08-the-intake.md#the-conversation-binding--the-anchor-anchored).

## Requirements and review questions

| Brief requirement | Governing line and design obligation |
|---|---|
| One short pairing action, usable by phone | Purpose brief onboarding; Rules 79/80/82; Eleven's code plus authenticated confirmation, no hand-authored grants or new signing-key setup. |
| Agent cannot mint or alter the anchor | Purpose independent safeguards; Rules 28/29; P-01; dedicated OS custodian denies both agent and harness administrative paths and witnesses actual denial. |
| Loss of one device does not remove control | Rules 79/100; P-01/P-02; normal account recovery plus off-machine encrypted custodian recovery, tested independently of the lost device. |
| Ordinary installation without a desk or preview waiver | Rules 38/78/104/116; owner-based records and bounded local setup supervision, followed by real subscription and runtime admission. |
| Safeguards on; explicit developer override | Purpose's narrow approval-account exception; Rules 73/94/98/101/103; recorded, scoped, revocable acceptance or prior waiver, never a protection claim from a flag. |
| Honest availability and ordered implementation | Rules 26/49 and purpose evidence constraint; six sequence stages distinguish exists, exists but desk-only and to build; four units have positive and negative exit cases. |

Review the first-supervisor and trust-root boundary together: the operator-controlled installation service must not borrow its proposed agent's grant or login to establish itself. Confirm that the surface authenticates the intended account/session, not just possession of the code. Confirm that recovery restores control without rolling back revocations or inventing lost causal history. These are the main substantive implementation obligations this design exposes.

## Publication validation

The repository publication was regenerated from committed source with the existing build-register replay path. The owner-manifest helper refreshed the intake document hash; the desk repin chain changed no inventory or executable. Generated outputs are shape-only evidence and grant no runtime authority. The typecheck, architecture, governed-document, changelog and initial pinned-text checks pass (five files, 54 tests). Final pushed-head checks and host-path exceptions are in the named report. Check references for custody use Ten’s isolation, key-lifecycle and restore fixtures, not worker-lifecycle fixtures.

## Closing block

simplestRobustRoute: This is the simplest robust route through existing genesis, grants, binding, broker, supervisor and assembly owners. Separate OS custody prevents self-issued authority, independent backup prevents single-device lockout, and a local setup model prevents the first-subscription supervision cycle. The start guard is independently authenticated installation authority; the end guard is actual admitted login and first exchange; limits retain all five floors. This unit supplies design and does not claim unattended runtime success.
80/20: Focused owner additions and consumer checks are author evidence. Independent convergence and product implementation remain the desk's review and the four named build units; no independent pass is claimed here.
VERDICT: author submission; independent review pending

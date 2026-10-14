# Review guide — fresh installation bootstrap

Subject base: 1b26222647ed2e5dab3b21a65f7d996106e60541
Review state: open
Reviewed content: none
Outcome: Specify the missing authenticated operator/genesis bootstrap for an ordinary single-machine installation, then reuse verified binding and P-02's existing yes for the first subscription. Design only; no constitution, runtime, prompt, parser or model acceptance code changes.
Affected rules: Purpose independent safeguards, brief role onboarding, durable cause, single-machine operation and evidence constraints; Rules 1, 4, 7, 18, 26, 28, 29, 32, 38, 41, 49, 55, 56, 58, 60, 63, 66, 67, 73, 74, 75, 78, 79, 80, 81, 82, 90, 91, 94, 95, 98, 100, 101, 102, 103, 104, 106, 109, 111, 113 and 116; P-01, P-02, P-05 and P-08.
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

Decision: install-bootstrap-repair-D1 | Select the authenticated phone account through protected local OS authorization; retain provider and conversation evidence and refuse copied-code/different-account confirmation. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/install-bootstrap-design-1013-repair-PROGRESS.md
Decision: install-bootstrap-repair-D2 | Seed only a finite human enrollment StandingGrant under the release org-intent out-of-band; check A0 under that seed and make the installation intent runtime-governed with no fabricated landing. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/install-bootstrap-design-1013-repair-PROGRESS.md
Decision: install-bootstrap-repair-D3 | Disclose seven actions with eligible recovery reuse, otherwise eight; combine the prepared role/subscription yes and slice broker isolation as the first bounded unit. | reported=/Users/dabombstudio/.instar/agents/echo/.instar/lanes/install-bootstrap-design-1013-repair-PROGRESS.md

## Platform contract

macOS and Linux implement the same installation guarantees; a Mac is not required.
[Ten's platform bindings and named build units](../docs/14-the-assembly.md#installation-platforms)
cover separate service identity, protected human selection, custody and local supervision.
macOS uses its protected installer, Authorization Services, launchd and protected Keychain/files.
Linux units are to build: a separate system user/systemd service, polkit desktop or fresh sudo
headless helper, and custodian-only files plus independent vault recovery. A headless server
uses the person's console/SSH session and the same phone flow; no desktop or Mac relay is needed.
The seven/eight-action counts remain planning estimates, with OS-specific timing unmeasured.
The enrollment order and `R/OR → GP`, `E → GE → A0 → O0 → GO → C0` authority chain are fixed.

## Read in this order

1. [Assembly: sequence, status and ordered milestones and first bounded unit](../docs/14-the-assembly.md#fresh-installation).
2. [Operator surface: authenticated act and phone recovery](../docs/15-the-operator-surfaces.md#fresh-install-pairing).
3. [Custody: separate OS identity, account-at-use and independent backup](../docs/17-harness-adapters/03-capability-account-quota-and-launch-pins.md#installation-custody-and-recovery).
4. [Genesis admission](../docs/06-the-fact-envelope.md#admission--the-one-boundary-a-fact-can-enter-through) and [binding before approval](../docs/08-the-intake.md#the-conversation-binding--the-anchor-anchored).

## Requirements and review questions

| Brief requirement | Governing line and design obligation |
|---|---|
| Authenticated enrollment, then phone-complete operator actions | Purpose brief onboarding; Rules 26/28/29/79/80/82/98; protected local selection joins the provider identity to the installation; exact confirmation on the phone follows. No hand-authored grants. |
| Agent cannot mint or alter the anchor | Purpose independent safeguards; Rules 28/29; P-01; dedicated OS custodian denies both agent and harness administrative paths and witnesses actual denial. |
| Loss of one device does not remove control | Rules 79/100; P-01/P-02; normal account recovery plus off-machine encrypted custodian recovery, tested independently of the lost device. |
| Ordinary installation without a desk or preview waiver | Rules 38/78/104/116; owner-based records and bounded local setup supervision, followed by real subscription and runtime admission. |
| Safeguards on; explicit developer override | Purpose's narrow approval-account exception; Rules 73/94/98/101/103; recorded, scoped, revocable acceptance or prior waiver, never a protection claim from a flag. |
| Honest availability and ordered implementation | Rules 26/49 and purpose evidence constraint; six sequence stages distinguish exists, exists but desk-only and to build; four milestones and the first bounded isolation unit have positive and negative exit cases. |

Review the first-supervisor and trust-root boundary together: the operator-controlled installation service must not borrow its proposed agent's grant or login to establish itself. Confirm that the surface authenticates the intended account/session, not just possession of the code. Confirm that recovery restores control without rolling back revocations or inventing lost causal history. These are the main substantive implementation obligations this design exposes.

## What the person actually does

The review's original estimate was **eight actions, four to nine active minutes**: run the
command; authenticate installation; sign in on the phone; choose recovery; confirm pairing;
agree the role; approve the first subscription request; complete provider login. These were
planning estimates, not measured installation times.

The concrete enrollment adds a protected local account-selection act. Reduce the burden by
reusing a suitable already authorized operator-only recovery holder (including one available
from the same sign-in, only if it really provides independent recoverable custody), and by
presenting role agreement and the exact first subscription request together after binding.
One explicit P-02 reply can approve the complete prepared scope/cost request and produce its
linked role/subscription records; it must cover both digests, not infer an extra yes.

With recovery reuse, the resulting **seven actions** are:

1. Run the installation command on the installation host (macOS or Linux) (15–30 seconds).
2. Authenticate the protected OS installation (15–30 seconds).
3. Open the phone link, authenticate Telegram and open the proposed DM (30–60 seconds).
4. Check the authenticated account/DM on the installation host (macOS or Linux) and authorize its selection (15–30 seconds).
5. Check the installation, controlling account, scope and loss disclosure; confirm on the phone
   (30–60 seconds). Existing recovery choice is visible here; verification/backup is automatic.
6. Agree role, accounts/channels, trust, sensitive matters, spending limit and the prepared
   first subscription request in one conversation (1–2 minutes).
7. Complete the provider's secure credential/login interaction (30–90 seconds).

Allow **roughly four to nine active minutes**, plus one message to verify the first exchange.
Without an eligible recovery holder, selecting/authorizing one adds 30–90 seconds and makes
**eight actions**. No near-zero setup or elapsed-time claim is made. Downloads, model startup,
provider challenges and restore verification add unmeasured waiting. Action 7's device and
challenge depend on the selected provider adapter and must be disclosed before selection.

The installer creates **a protected local service, a small local setup model, and a recovery
place the agent cannot reach**. The model is an automatic download; its exact artifact and size
must be published by milestone 1 before distribution. Existing Telegram and provider accounts
are used. The distribution must supply the registered login client and reachable HTTPS surface;
the person is not asked to register a bot or create a repository. No extra recovery account is
needed when an eligible holder already exists; otherwise one independent holder/account must
be chosen, with that extra action disclosed. Telegram sign-in alone is not a recovery vault.
The installer automates records, key custody, recovery verification and resume checkpoints.

## Concrete authority and affected-rule checks

- MUST-FIX 1: Eleven specifies provider-signed identity plus the protected local selection
  digest, authenticated local IPC/OS verifier and phone session. A copied code with another
  account fails before signing. Code possession or successful login never chooses the operator.
- MUST-FIX 2: Two spells out `R/OR → GP`, authenticated `E → GE → A0 → O0 → GO → C0`.
  `GE` is a finite existing StandingGrant seeded out-of-band under the release org-intent,
  not the service's preparation authority or the future operator grant. `A0` uses all ordinary
  Authorization checks against that seed. Runtime `O0.approvedIn = A0.id`, `landedIn = null`;
  post-genesis approvals use admitted standing. No approval class, store or constitution edit.
- Rules 1/4/66/95: existing One/Two admission and Ten startup hold invalid mutation authority
  closed while preserving input, diagnosis and stop; no new filter or watcher.
- Rules 38/41/56/58/67/75: Seven's registered setup route retains measured adequacy, current
  doorway/model pins, captured input/output and judgment provenance, metering, and explicit
  unavailable/inadequate holds; no heuristic substitute or unmetered setup calls.
- Rules 81/106: Eleven's existing mobile surface checks cover visible primary actions and
  complete reachable HTTPS links. Initial host preparation is disclosed, subsequent operator
  actions work on the phone. Rules 26/28/29/90/98 require both enrollment and genesis cases.
- NOTE 2: the four milestones start with existing broker isolation/distribution verification;
  harmless scoped success and read/replace/elevate refusal precede supervised key preparation.

## Publication validation

The repository publication was regenerated from committed source with the existing build-register replay path. The owner-manifest helper refreshed the intake document hash; the desk repin chain changed no inventory or executable. Generated outputs are shape-only evidence and grant no runtime authority. Original-head checks are in the original report. Repair checks and final pushed-head evidence are in `/Users/dabombstudio/.instar/agents/echo/.instar/lanes/install-bootstrap-design-1013-repair-PROGRESS.md`. Check references for custody use Ten’s isolation, key-lifecycle and restore fixtures, not worker-lifecycle fixtures.

## Closing block

simplestRobustRoute: This is the simplest robust route through existing genesis, grants, binding, broker, supervisor and assembly owners. Separate OS custody prevents self-issued authority, independent backup prevents single-device lockout, and a local setup model prevents the first-subscription supervision cycle. The start guard is independently authenticated installation authority; the end guard is actual admitted login and first exchange; limits retain all five floors. This unit supplies design and does not claim unattended runtime success.
80/20: Focused owner additions and consumer checks are author evidence. Independent convergence and product implementation remain the desk's review and the four named milestones; no independent pass is claimed here.
VERDICT: author submission; independent review pending

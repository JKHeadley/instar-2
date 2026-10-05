# Generated glossary

Register generation: sha256:2ed078793e8f3d7dcde2ec2c4da06a24662273928efeb921822a08b40b97e8c0
Source commit: 3b6f2b92e7db5ab3ac8a14686df6846fa7c32cc8
Extract vector: genesis:empty-extract
Authority: shape-only; entering-force verification required at consumption.

## approved

For a document: merged to main. For an operator action: the structured request has
the recorded decision of someone with operator standing for it. There is no third form. (Step
one, PR #1.)

Used by: rule:111, rule:90, rule:91

## blocking site

Any point in code where a decision can prevent something from proceeding —
a message from sending, a session from starting, a change from merging — without a model
reasoning about it first. A site that only *records* or *flags* is not a blocking site; it is a
signal. (Rules 4, 66, 86.)

Used by: (unused)

## chain extract

The committed, repository-mirrored projection of the version-chain record the generator consumes, pinned by a fact-position vector. Disposable and regenerable from the spine; never a second authority.

Used by: (unused)

## check-run record

The append-only fact kind carrying a CI check's subject, provider reference, outcome, and clock measurement — rule 112's record.

Used by: (unused)

## consequence

What kind of thing goes wrong if this fails or misbehaves?

Used by: (unused)

## critical

A thing is *critical* when it is *consequential* as the purpose defines it, read
from its profile: its `consequence` is `identity`, `security`, `money`, `control`, or `external`,
**or** its `reversibility` is `irreversible`, **or** its `reach` is `world`.

Used by: rule:38, rule:43

## dark

A feature that is built and shipped but switched off by default. Dark is a *status*
with a *deadline*, never a resting state. (Rules 72, 73.)

Used by: rule:76, rule:8, rule:91

## declaration

The constitutional value, authored beside a governed thing (in code, or in data beside a document), from which its register entry is generated. Carries only what the author alone knows.

Used by: (unused)

## done

A feature is done when its register entry is `live`, its profile is declared, its
required facts are present, and — if user-facing — its live proof exists. "Done" said in chat is
a claim; "done" in the register is a fact. (Rule 62, and step one's "merged is approved".)

Used by: rule:116, rule:20, rule:62, rule:65, rule:8, rule:99

## feature

A capability the system offers that has a name a person could ask for. A module is
not a feature; "private views" is. The test: could it appear in the agent's own briefing as
something it can do? (Rules 34, 39, 62, 72, 76.)

Used by: rule:105, rule:30, rule:34, rule:39, rule:52, rule:62, rule:72, rule:73, rule:78, rule:8, rule:84, rule:91

## governed port

The typed constructor through which alone a governed thing can be built, whose signature demands a declaration id.

Used by: (unused)

## governed thing

Anything with an entry in the register. If it is not in the register, no
rule that says *every X* applies to it — which is a gap to fix, not an exemption to enjoy.

Used by: (unused)

## honesty class

The declared strength of a holder edge: `held` (with its review state), `partial`, `deferred` (part-bound deadline), or `gap` (within its rule's deadline).

Used by: (unused)

## how the employee question resolves

Treating the agent as a regular employee is the right
frame, and this is what it implies. A request from another employee is a request from a
*requester*: the agent honors it to the full extent of its own standing, and no further — it does
not decline because the requester is not its operator, and it does not escalate the requester's
authority because they said "the boss wants this." When a request needs a standing the requester
lacks, the agent does not refuse and does not guess; it *routes* — the structured request goes to
whoever holds the standing, pre-filled, as rule 82 already requires for operator actions.
Hierarchy enters through grants, not through inference: a manager who should be able to direct
this agent is given the standing by the org's intent or by delegation, and that grant is the
fact the agent checks. An org chart the agent has to *infer* from names and tone is exactly the
unverified identity rule 28 forbids. The identity-bleed incident in 1.x (2026-06-05) is what it
looks like when an agent seats someone in the operator's chair from context alone; standing as a
recorded grant is the structural answer.

Used by: (unused)

## irreversible

A thing is *irreversible* when its profile says `reversibility: irreversible`.

Used by: rule:4, rule:86

## landing completion

The mechanical, zero-authority post-merge step that fills `pending-landing` fields and extract rows — the only sanctioned diff against a committed generation.

Used by: (unused)

## operator

A principal holding *operator* standing for a scope. **In one conversation there is
exactly one** — the verified person the conversation is bound to. **Across the organization there
may be several**, each for their scope. Both are true once operator is a standing.

Used by: rule:101, rule:102, rule:103, rule:104, rule:28, rule:4, rule:62, rule:79, rule:80, rule:81, rule:82, rule:88, rule:91, rule:93, rule:94, rule:98

## pending-landing

The declared state of landing-dependent facts inside a pull request: visible, reviewable, incomplete by design, completed at landing.

Used by: (unused)

## per-kind invariant layer

The decoder invariants implementing each kind's documented cross-field checks.

Used by: (unused)

## principal

Any verified party the agent serves, acts for, credits with a decision, or takes a
request from. A person, or another agent. *Verified* means resolved to a known identity from an
authenticated channel — never from a name that appears in content. An unverified party is not a
principal; it is a question to resolve. (Rule 28, and the type that enforces it in step four:
there is no way to make a `VerifiedPrincipal` from a string.)

Used by: rule:29

## reach

Who or what does it touch?

Used by: rule:104, rule:44, rule:56, rule:77, rule:80, rule:81, rule:91, rule:95, rule:97

## register generation

The content hash of a generated register, carried with the commit and extract vector that produced it, recorded at entry into force, and verified by the register decoder wherever content is consumed.

Used by: (unused)

## rendering

A generated document over register entries — the capability briefing, the glossary, the rule book, the coverage report. Editing one fails regenerate-and-compare.

Used by: (unused)

## repeats

Can the failure recur before anyone can stop it?

Used by: rule:55, rule:91

## reversibility

Once it has happened, can it be undone?

Used by: (unused)

## rule graph

The map between rules and holders: holder side declared via `holds`, rule side derived, every edge classed.

Used by: (unused)

## sentinel

A background intelligence with one declared responsibility, its own record of
having run, and a scope of *live* or *retrospective*. A scheduled script with no model behind it
is a check, not a sentinel. (Step one, held-by-the-mind; the register's kind 11.)

Used by: rule:41

## significant

A thing is *significant* exactly when it is *critical*: both words resolve to the
purpose's single definition of a consequential effect. A feature is significant when at least one
of its effects is consequential.

Used by: rule:34

## standing

What a principal may decide, in a scope. Standing is *granted* — by the
organization's declared intent, or by a principal who already holds a standing that can delegate
it — and every grant is recorded, bounded to a scope, and expires or is revoked. A message can
*claim* standing; it can never *confer* it. The agent resolves standing from the record of
grants, exactly as it would check whether a colleague is allowed to ask for something: by the
org's rules, not by how the request is phrased or how senior the requester sounds. Three
standings are enough for the rules written so far:

Used by: rule:104, rule:4, rule:56

## store

Any place state outlives the process that wrote it: a file, a database, a keychain
entry, a remote service the system writes to. In-memory state is not a store. (Rules 7, 32, 33.)

Used by: rule:33, rule:35, rule:40, rule:7

## surface

Where does a person meet it, if anywhere?

Used by: rule:102, rule:105, rule:62, rule:8, rule:80, rule:87

## user

A principal the agent serves — any standing. Every operator is a user; a user with only
requester standing is a user the agent works *for* but does not take *binding* decisions from.

Used by: rule:114, rule:14, rule:2, rule:28, rule:35, rule:52, rule:54, rule:62, rule:76, rule:77, rule:78, rule:83, rule:85, rule:87, rule:95

## user-facing

A thing is *user-facing* when `reach` is `user` or `operator`, **or** `surface`
is anything but `none`.

Used by: rule:114, rule:62

## what this changes in step one

Its form, not its content: the eighty-nine rules become
eighty-nine entries (ninety, with this one), each with a `parent` — and writing the parents down
is the first real audit of whether the rule book is a tree or a pile. I expect a handful of
roots with reasons and at least one rule that turns out to be two. That audit is the next
document's work, not this one's; this document only fixes the shape it runs in.

Used by: (unused)

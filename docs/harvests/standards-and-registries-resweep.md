# Re-sweep of the widened record — first pass

**Status: draft, first pass, NOT converged. Governed.**

## What this is

On 2026-08-26 a full Telegram export widened the audited record from 15,419 messages (May 29 onward, relay-logged only) to 55,256 messages (March 8 onward, everything the group contains). The converging-audit standard says a widened surface gets a re-sweep, so sixteen readers swept the 39,837 newly-visible messages — the operator's 4,384 in full text, the 35,453 agent-authored ones skimmed for embedded operator decisions and rule-births — with the harvest's 25 themes and the 33 rulings as the lens, reporting only what those do not already carry. The raw reader notes are preserved verbatim under `resweep-reader-notes/`; this document is the deduplicated synthesis.

The one-sentence result: **no ruling among the 33 is contradicted**, but the new record holds a handful of items that qualify two of them, a set of operator-stated rules the harvest never carried, and the true origin stories of most of the constitution — because the constitution itself was born (May 23, #12231) inside the period the relay never logged.

## Part 1 — Items that bear on the fresh rulings

These are the findings worth the operator's eyes, because each touches a ruling made this week.

1. **The PIN is not a second principal on the agent's own machine (#53579, Aug 22).** The dashboard PIN lives in a config file the agent can read. Rulings 19 and 20 use the PIN as an authority step above the agent — that holds against a remote party, but on the agent's own machine a PIN gate is not a different-principal check. Recorded as a known limit; the honest fix belongs to the types step (an approval anchored outside the agent's reach).

2. **A checker its subject authors cannot protect the constitution (#53701, Aug 22).** Ruling 3's protected list assumes an enforcing check the agent cannot simply rewrite — but the agent authors the checkers and can push to the canonical copy. The protection design for the protected list must place the enforcement outside the agent's write authority (the same principle the agent itself applied at #19714, refusing to touch branch protection even when authorized).

3. **Exact-match has a sanctioned ACT polarity ruling 2 does not mention (#4918, #4920, Apr 1).** The operator ruled that a literal trigger ("@agentname") SHOULD be a string check — typed intent is unambiguous, and an LLM adds latency and misreading risk. Ruling 2 covers what exact match may *block* (secrets, money); this is the other side: what it may *activate*. Both polarities should land in the rule when it is written.

4. **The convergence definition has a superseded ancestor (#11470, May 21).** The operator's earlier rule was strict — a pass converges only on zero corrections and zero new findings. His later 80/20 rule (ruling 1) supersedes it. Recorded so the lineage is a lookup, not a surprise.

5. **The operator himself scoped the convergence-effort structures (#58475, Aug 26).** In another topic he stated that the converge-to-coherence process is specialized to this agent and that approvals must be checked for not adversely affecting other Instar agents — independent confirmation of rulings 13, 17, and 28.

6. **The advisory-gate model has a June origin (#21421, Jun 6).** "It tells me, I decide, it never blocks the send" — the operator's inform-only ruling for the tone/clarity gate, months before the advisory migration built it. Supports ruling 19(b) as settled operator intent, not a new invention.

## Part 2 — Operator-stated rules the harvest never carried

New candidate rules, deduplicated, each with its first-statement id. None contradicts an existing theme; each is a candidate for the rule book or the register in the correction PRs.

**Time and pace**
- AI development runs ~4x human speed; human-scale time settings are divided accordingly (#2128). Deferral deadlines are cut by ten (#8255).
- Declared walls are re-verified on a cadence — a settled true-blocker carries a recheck-after date (#23994, #24007).
- The agent overestimates its own task duration 10x–100x; estimates must be recalibrated from measured wall-clock (#11801).

**Autonomy doctrine**
- The four-step false-blocker pipeline; "decisions are cheap at agent speed": specs frontload all user decisions, mid-run decisions are recorded and reported, never stop-and-ask (#23918).
- An agent may not self-declare safety boundaries never agreed to; org governance defines what is off-limits (#24137, #23353).
- Humans never have to remember anything; every authorization blocker is reviewed as a candidate standing grant — a grant ratchet (#25758).
- Never skip hooks (--no-verify) without explicit operator ask, and any use is disclosed (#9617).

**Channels and users**
- Channel parity is a fundamental standard, modeled on Migration Parity, with a maintained register of every messaging-platform feature as its measuring stick (#12276, #12280, #4165).
- Act-as-user messaging carries contact containment: structurally unable to message unapproved contacts (#4855).
- Channel-behavior defaults derive from workspace provenance — agent-created versus pre-existing (#3942).
- Every link handed to the user is complete and clickable; never localhost; topic names, never ids (#22873, #20131, #19466).
- Proactively surface applicable off-by-default features; a decline is recorded with its reason ("off because you never asked is not off because you chose") (#12784, #12790).

**Development process**
- Fork-and-fix for external PRs, and PR-triage-by-value (#5124, #5101).
- A document under review is frozen while reviewers read (#38733); a non-converging append-review is rewritten/synthesized between rounds (#46831).
- Every convergence review audits the foundation one layer below the spec (#23904).
- Every change declares its multi-machine posture in writing (#25011).
- A conclusion and its justification are separately falsifiable; a refuted reason forces re-derivation even when the conclusion stands (#47925).
- Preserve green CI history; a clean redo only when the useful signal never existed (#16696).
- Each gate has its own bar; red evidence is submitted as red with per-failure classification, never held on a later gate's bar (#57428).

**Operations**
- Self-healing is the general expectation: issues spawn a dedicated healer session; no Instar user deals with a class of issue twice (#57540, #29117).
- Responsible resource usage is fractal: sleep/wake at tool, session, and agent level (#16814).
- A secret handed to the agent is stored securely before any consumption (#19301). A fixed-lifetime credential is a scheduled outage: expiry is a registry fact with escalating reminders (#48090, #11087).
- Self-installation across machines is the standard: access granted once, the agent installs itself everywhere (#13807).
- Decisions waiting on the user collect on one durable page, linked from every subsequent message until answered (#21424).
- Governance stress tests probe org-unique constraints with a control arm and an escalating-pressure ladder (#22362, #22415, #20532).
- Trust-gated self-evolution: the agent's latitude over its own identity files scales with granted trust (#1032).
- Agents must have structural awareness of their own features, so they never improvise weaker substitutes (#11126); the context-file architecture is a seed root plus traversal (#5098, #941).
- Post-compaction honesty: say it was a compaction pause and provably account for the last pre-compaction message (#7715).

## Part 3 — Origins: the constitution's birth is now on the record

The largest share of findings (about half) are provenance: the harvest cited each theme's earliest visible statement, but the true first statements and founding incidents sit in March–May, before the relay logged anything. Highlights, with the full set in the reader notes:

- The constitution itself: first 13 standards drafted May 23 (#12231) with the rule that every standard carries its real incident.
- Founding incidents now documented at their source: the source-tree wipe (#8140) behind SourceTreeGuard; the fork-bomb meltdown (#27838) behind Bounded Blast Radius; the Caroline injection (#20889) behind Know Your Principal; the evaporated promise (#6490) behind commitment tracking; the emergency stop that never fired (#12918); the master password printed to a transcript (#11211) behind the credential wall; the false-blocker catch (#12892) behind the self-stop family; the context-death trap named and disproven (#6937).
- Dozens of earlier first-statements for rulings and themes (signal-vs-authority in April, migration parity in March, test-as-self in May, and so on). Per the cite-the-first-record rule, these corrections apply when the register's origin facts are built in the types step — the reader notes carry every id so nothing is lost until then.

## Honest scope

This is pass one over the widened surface, and it is labelled not converged. The pass was full-coverage (every new message was read or skimmed; operator messages in full text), but no second read has yet re-swept with these findings as the lens. Whether a second pass would change any decision is the 80/20 judgment ruling 1 assigns to an independent reviewer, not to the author of this pass — that judgment is the next step.

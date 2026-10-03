# Group S check unit s11a-recall — the S11a recall proof, repaired (plan row #397)

This file is the pushed copy of a **desk pipeline** change. The live-proof group scripts live under
`.instar/lanes/pipeline/live-proof/` on the review desk's machine and are not part of this repository,
so the proposal is carried here: the diagnosis, the code it is grounded in, the replacement script in
full, and the unified diff against the script this branch's desk currently runs. Nothing in this file
is executed by the build.

## What was wrong

Group S proves Rule 11 ("Recall Is by Meaning, Not by Word-Match") with three checks — S11a (an early
fact), S11b (a late fact) and S11c (a thing never said) — and all three must pass in one run. S11b and
S11c pass live. S11a returned UNTESTED on cint-L39 twice (runs `S-proofroom2-20261003-063745` and
`S-proofroom2-20261003-093107`), and once more in `S-proofroom2-20261003-072815`, because "the summary
itself answered": the early fact's exact clause was still a kept quote in the rolling summary, so the
answer model read it straight out of the packet and the meaning search Rule 11 is about never ran. The
queue does not rerun a group with the same result twice on one build, so Rule 11 was stuck.

In all three runs the recorded evidence says the same thing without ambiguity:

| run | `last.memoryLookup` on `s-q-early` | `reply.answerReason` opens with |
|---|---|---|
| S-proofroom2-20261003-063745 | `"offered"` — no lookup ran | *"The summary's memoryItems lists an operator-stated fact: \"My dentist is Doctor Okafor.\" (source …:update:6231625…)"* |
| S-proofroom2-20261003-072815 | `"offered"` — no lookup ran | *"The summary's memoryItems list includes an exact operator-stated quote: \"My dentist is Doctor Okafor.\" sourced at …:update:6231687…"* |
| S-proofroom2-20261003-093107 | `"offered"` — no lookup ran | *"The summary (sourceKind inferred-by-summary) contains the memory item: quote \"My dentist is Doctor Okafor.\" sourced from …:update:6231800…"* |

## Why it was not luck

`tests/preview/journal.ts` (the summary pass, around the `priorItems` block) builds each new summary's
`memoryItems` from the **previous** summary's items — retained in full, minus corrections and forgets —
and only then appends newly covered items, and only `while memoryItems.length < 20`. The twenty kept-quote
slots are therefore first-come and never freed: a fact first covered by a pass that runs after the slots
have filled can never become a kept quote, and a fact that got in early stays in forever.

Across all five recorded 10-03 runs every summary pass covered **exactly four** operator messages
(`status.summaries[].through` advancing +4, with a rare +5 where a message was held):

```
S-proofroom2-20261003-093107, f1 = 6231798:
  through=6231801 (+4) = fact 4     through=6231817 (+4) = fact 20
  through=6231805 (+4) = fact 8     through=6231821 (+4) = fact 24
  through=6231809 (+4) = fact 12    through=6231825 (+4) = fact 28th message
  through=6231813 (+4) = fact 16    …
```

So the early fact (message 3) was always a candidate in pass 1 with three competitors and was kept, while
the late fact (message 24) was first covered by pass 6, after the slots had filled on facts 1-20. That is
exactly why S11b exercised recall in **all five** runs and S11a did not: S11a's asked fact was in the one
position the design could not use.

## The repair

A **crowding phase**: eight messages of six short household clauses each (48 facts) are sent *first*, so
passes 1 and 2 fill the twenty slots with facts that are never asked about. Every single fact after them —
including the early asked fact — is then past the cap, in the same structural position that made S11b
reliable, while staying genuinely early in the conversation (about fifty messages back by question time).

Two new preconditions hold the phase, and nothing else about the verdicts changes:

- **S0c** (emitted before S0a, because the crowding messages go first): all eight crowding messages were
  consumed.
- **S0d** (after S0b): a rolling-summary pass ended at or after the last crowding message and strictly
  before the early asked fact, which is the observable evidence that the slots were filled from crowding
  facts before the early fact was first summarised.

The asked-fact verdict rule (the shared `ASK` lambda) and the whole of S11b and S11c are **byte-identical**;
the diff below shows it. S11a's *description* names the crowding phase; its expression is unchanged. One
line of desk evidence is added — each question's own `last.memoryLookup` in `s-lookup-evidence.txt` — because
that field is the direct signal for "the summary answered" and reading it by hand is what made this
diagnosis slow. `room` rises from `70 230 70` to `80 260 80` for the eight extra messages; a recorded full
run spent 61 turns / 103 calls / 61 replies against limits of 1000 each, so this is headroom, not a cap.

What the repair deliberately does **not** do: it does not widen S11a's acceptance. A right answer lifted
out of the summary's kept quotes must still record UNTESTED, because Rule 11's floor is that a fact the
agent no longer holds verbatim is recalled correctly — and if the quote is still held, that floor was never
engaged. Accepting it would report a proof that did not happen.

## Replay evidence

Every run below is `LIVE_PROOF_REPLAY=1` over a results folder; nothing was sent and no model was called.

Over the five recorded runs **as they stand**, the proposed script stops at S0c:

```
S-proofroom2-20261003-033702  S0c=FAIL  (VOID)
S-proofroom2-20261003-042833  S0c=FAIL  (VOID)
S-proofroom2-20261003-063745  S0c=FAIL  (VOID)
S-proofroom2-20261003-072815  S0c=FAIL  (VOID)
S-proofroom2-20261003-093107  S0c=FAIL  (VOID)
```

That is the honest answer to "do the two 10-03 L39 runs become decidable?": **they do not, and they cannot.**
A recorded run carries no crowding phase, so the artefact the new setup produces does not exist in it; and
the reason S11a was UNTESTED in those runs is that the agent still held the fact verbatim, which no
re-reading of the recording can change. Only a fresh run whose kept quotes exclude the fact can decide it.

To drive the new script end to end over the **real** recorded question shapes, four folders were built from
the recorded runs with the crowding-phase artefacts grafted in front (the eight `update-b*` ids immediately
below `update-f1`, and the matching summary-boundary row in the ready snapshot). Every reply, inspect packet,
`answerReason`, `memoryLookup` and status row they judge is the recorded live one:

| folder (source run) | verdicts |
|---|---|
| A — S-proofroom2-20261003-033702 (lookup ran, fact recalled) | S0c=PASS S0a=PASS S0b=PASS **S0d=PASS S11a=PASS** S11b=PASS S11c=PASS |
| B — S-proofroom2-20261003-063745 (summary answered) | S0c=PASS S0a=PASS S0b=PASS S0d=PASS **S11a=UNTESTED** S11b=PASS S11c=PASS |
| D — S-proofroom2-20261003-093107 (summary answered) | S0c=PASS S0a=PASS S0b=PASS S0d=PASS **S11a=UNTESTED** S11b=PASS S11c=PASS |
| C — A with the summary-boundary row removed | S0c=PASS S0a=PASS S0b=PASS **S0d=FAIL** (VOID) |
| E — A with one crowding message unconsumed | **S0c=FAIL** (VOID) |

Both sides of both new preconditions are proven, and S11a reaches PASS and UNTESTED from real recorded
replies. On folders A, B and D the base script and the proposed script produce **identical** S11a/S11b/S11c
verdicts, so the repair changes the setup and not the judgement.

The base script replayed over the five recorded folders reproduces every recorded verdict except S11c on
the two early runs, where the recorded FAIL predates the plan #378 amendment that is already in the script
on this branch — a known difference, and a check that the replay harness is faithful.

## The replacement script

```bash
#!/bin/bash
# Live-proof group S — Rule 11: recall must find a fact the rolling summary does not carry (plan row #289).
# Why: twice the long-chat check A6 was answered from the rolling summary's kept fact quotes (memoryItems, at most 20),
# so the meaning search and the one memory lookup (cint-L27: when the packet does not show what the question asks
# about, the answer model returns search phrases, the runner searches once and asks once more) were never exercised.
# Plan row #397: S11a hit the SAME wall the group was built to avoid. In three live runs
# (S-proofroom2-20261003-063745, -072815, -093107) the early fact's exact clause was in the summary's memoryItems, the
# answer model read it straight out of the packet (inspect last.memoryLookup stayed "offered", answerReason named
# "the summary's memoryItems"), and the check recorded UNTESTED because Rule 11's search never ran. The cause is
# structural, not luck: tests/preview/journal.ts builds each pass's memoryItems from the PREVIOUS summary's items
# (retained, minus corrections and forgets) and then appends newly covered items only while fewer than 20 are held,
# so the 20 slots are first-come and never freed. Across five recorded runs every pass covered exactly four operator
# messages, so the early fact (message 3) was always a candidate in pass 1 with three competitors and was kept, while
# the late fact (message 24) was first covered by pass 6, after the slots had filled — which is why S11b exercised
# recall in all five runs and S11a did not.
# The fix is a CROWDING PHASE: eight messages of six short household facts each are sent FIRST, so passes 1 and 2
# fill the 20 slots from facts that are never asked about. Every single fact after them — including the early asked
# fact — is then past the cap, in exactly the structural position that made S11b reliable.
# Design, for a FRESH room (room2-queue.json "fresh"; room2-fresh-root.sh gives it an empty root):
#   0. 8 crowding messages, six distinct harmless household clauses each (48 facts), sharing no content word with the
#      three questions and none of the 26 asked-fact tokens, so the summary's 20 kept-quote slots fill on them.
#   1. 26 short, distinct, harmless facts, one per message (more than the summary's 20 kept quotes).
#   2. neutral garden-log filler (lib.sh filler, as A.sh) until the rolling summary covers the late asked fact, both
#      asked facts are in the meaning index, and the packet is summary-plus-recent; bounded by S_MAX_FILLER (default
#      60) and S_FILLER_MINUTES (default 75), like A's long-chat loop.
#   3. three paraphrased questions sharing no content word with their facts: fact 3 (early), fact 24 (late), and one
#      thing never said.
# Checks (Rule 11):
#   S11a/S11b (asked facts): PASS = the reply states the fact AND the fact's update is in last.recalledIds (the packet
#     the answer was given from; after a memory lookup inspect shows the second packet, whose recalled list includes
#     what the lookup found) or a future last.memoryLookup names it. UNTESTED = right answer, fact not recalled (the
#     summary answered; Rule 11's search was not exercised) or the fact was still in recent history. FAIL = the reply
#     does not state the fact.
#   S11c (never said): PASS = no invented answer, and the reply says it searched, found nothing, and that this is not
#     proof it was never said. UNTESTED = the runner's "could not search" reply (no lookup ran) or no summary yet.
#     FAIL = an invented answer, or "you never told me" without the search/caveat.
#   The asked-fact verdict rule is unchanged by plan row #397; only the setup before it changed. S0c (emitted before
#   S0a, because the crowding messages go first) and S0d are the new preconditions that hold the crowding phase.
# Note: inspect (journal-agent.mjs recallView) does not expose the packet's memoryLookup field, so whether a lookup
# ran is read indirectly: s-lookup-evidence.txt counts each question's answer calls in status modelCalls.last (2 =
# a lookup or a format re-ask) and prints each question's last.memoryLookup from its own inspect, which is the direct
# signal for "the summary answered" and is what made the #397 diagnosis slow. It is evidence for the desk, not a check.
# Size: 8 + 26 + fillers (about 20-35 on recorded fresh-room runs) + 3 = about 57-72 messages, about 45 s each, so
# about 45-55 minutes; about 2.5-3 model calls per message plus summaries, about 170-220 calls. A recorded full run
# spent 61 turns / 103 calls / 61 replies against limits of 1000 each, so the raised room below is headroom, not a cap.
# Usage: S.sh [results-dir]. LIVE_PROOF_DRY=1 / LIVE_PROOF_REPLAY=1 as in lib.sh. Exit 0 only if every check passed.
. "$(dirname "$0")/lib.sh"; init_results S "$1"
room 80 260 80
MAX=${S_MAX_FILLER:-60}
q() { python3 "$P/check.py" "$O" --quiet x "$1"; }

# The crowding phase (plan row #397): six short household clauses per message, no names, no dates, no asked-fact
# token and no content word from the three questions, so these fill the summary's 20 kept-quote slots harmlessly.
BUNDLES=(
  "A few small things worth keeping: the desk lamp bulb is seven watts; the hall runner is two metres long; the kettle holds one and a half litres; the stair carpet is grey wool; the letterbox opening is thirty centimetres wide; the doormat is coir."
  "More for the record: the pantry shelf holds eleven jars; the bread bin is enamel; the big stockpot is eight litres; the wooden spoons live in the left drawer; the colander is stainless; the chopping board is beech."
  "Some bathroom details to keep: the shower head has four settings; the towel rail is chrome; the mirror cabinet has two shelves; the bath plug chain is short; the ceiling vent whistles; the tile grout is cream."
  "Bike notes to keep: the bike bell is loose; the front light takes two AAA cells; the mudguard is plastic; the pannier clips are red; the pump gauge sticks; the saddle is worn on the left."
  "Garden notes to keep: the garden hose is fifteen metres; the watering can is zinc; the wheelbarrow tyre is solid; the compost bin lid is green; the trowel handle is wrapped in tape; the greenhouse pane is cracked."
  "Desk notes to keep: the printer tray takes A4 only; the stapler is heavy duty; the guillotine blade is blunt; the filing box is cardboard; the label maker uses twelve millimetre tape; the hole punch takes four sheets."
  "Living room notes to keep: the sofa throw is navy; the reading chair squeaks; the coffee table has one drawer; the floor lamp shade is linen; the bookcase has six shelves; the rug under the table is sisal."
  "Car notes to keep: the boot liner is rubber; the roof bars are aluminium; the windscreen wipers are twenty four inch; the bulb kit is in the glovebox; the parcel shelf rattles; the boot light flickers."
)
j=0; for b in "${BUNDLES[@]}"; do j=$((j+1)); send "b$j" "$b"; done
UB=$(cat "$O/update-b8" 2>/dev/null)
echo "crowding=$j lastCrowding=$UB" >> "$O/meta.txt"
chk S0c "precondition" "all 8 crowding messages were consumed (each has an update id), so the summary's 20 kept-quote slots fill on facts that are never asked about" \
  "all(U('b%d' % k) is not None for k in range(1, 9))"

# The facts: (message, the distinctive word the answer must contain). Fact 3 and fact 24 are asked by paraphrase.
FACTS=(
  "Locker 17 at the swim club has combination 4821.|4821"
  "My niece Priya turns nine in March.|priya"
  "My dentist is Doctor Okafor.|okafor"
  "The blue kayak is stored in bay C at the marina.|kayak"
  "My favourite tea is smoked lapsang.|lapsang"
  "The book club meets on the second Thursday.|thursday"
  "The neighbour's cat is called Biscuit.|biscuit"
  "Our street's recycling goes out on Tuesday nights.|tuesday"
  "My library card number ends in 3317.|3317"
  "The car's tyre pressure should be 34 psi.|34 psi"
  "My grandmother's ring is in the cedar box.|cedar"
  "The pottery class is taught by Ines.|ines"
  "My running shoes are size 44.|size 44"
  "The Lisbon trip flight leaves from gate B12.|b12"
  "The piano tuner comes every April.|april"
  "My sourdough starter is named Clint.|clint"
  "The garage door remote uses a CR2032 battery.|cr2032"
  "My first car was a yellow Fiat Panda.|panda"
  "The choir rehearses in room 214.|214"
  "The fern on the landing needs water every Sunday.|sunday"
  "The hallway clock runs four minutes fast.|four minutes"
  "The farmers market stall I like sells quince jam.|quince"
  "The chess club's treasurer is Mr. Albescu.|albescu"
  "The spare cabin key hangs behind the barometer.|barometer"
  "My cousin Tomas lives in Ghent.|ghent"
  "The umbrella I keep at work is orange.|orange"
)
TOKENS=$(printf '%s\n' "${FACTS[@]}" | cut -d'|' -f2 | python3 -c 'import json,sys;print(json.dumps([l.strip() for l in sys.stdin if l.strip()]))')
echo "$TOKENS" > "$O/s-fact-tokens.json"
i=0; for f in "${FACTS[@]}"; do i=$((i+1)); send "f$i" "${f%%|*}"; done
UE=$(cat "$O/update-f3" 2>/dev/null); UL=$(cat "$O/update-f24" 2>/dev/null)
echo "early=$UE late=$UL" >> "$O/meta.txt"
chk S0a "precondition" "all 26 fact messages were consumed (each has an update id)" \
  "all(U('f%d' % k) is not None for k in range(1, 27))"
[ -n "$UE" ] && [ -n "$UL" ] || { chk S11a "11" "early fact asked (not run: a fact message was not consumed)" "None"; summary; exit 1; }

# A fact is indexed when its update is in inspect's meaningIndexed (the last 100 indexed updates), or below that window.
IDX="(lambda l, u: (lambda mi: u in mi or (len(mi) >= 100 and min(mi) > u))(g(I(l),'meaningIndexed',[]) or []))"
READY="(lambda l: (g(I(l),'summaryFrontier') or -1) >= $UL and $IDX(l, $UE) and $IDX(l, $UL) and g(I(l),'last.historyMode') == 'summary-plus-recent')"
k=0; ready=""
SEND_END=$(( $(date +%s) + ${S_FILLER_MINUTES:-75} * 60 ))
while [ $k -lt "$MAX" ] && [ "$(date +%s)" -lt $SEND_END ]; do k=$((k+1)); send "fill-$k" "$(filler $k)"
  q "g(S('fill-$k'),'stop') is not None" && break
  q "$READY('fill-$k')" && { ready="fill-$k"; break; }
done
echo "filler=$k ready=$ready" >> "$O/meta.txt"
chk S0b "precondition" "before the questions the rolling summary covered the late fact, both asked facts were in the meaning index, and the packet was summary-plus-recent (within S_MAX_FILLER / S_FILLER_MINUTES)" \
  "$([ -n "$ready" ] && echo True || echo None)"
# The crowding phase did its job only if a pass closed between the last crowding message and the early asked fact:
# tests/preview/journal.ts keeps the previous summary's memoryItems and appends newly covered ones only while fewer
# than 20 are held, so a fact first covered after the slots filled can never become a kept quote.
chk S0d "precondition" "a rolling-summary pass ended at or after the last crowding message (update ${UB:--1}) and strictly before the early asked fact (update $UE), so the 20 kept-quote slots were filled from crowding facts before the early fact was first summarised" \
  "any((g(s,'through') or -1) >= ${UB:--1} and (g(s,'through') or -1) < $UE for s in (g(S('${ready:-room}'),'summaries',[]) or []))"

send s-q-early "Who did I say looks after my teeth?"
send s-q-late "Where did I say I keep the extra thing that unlocks the hut in the woods?"
send s-q-never "What name did I give you for my sister's horse?"

# One asked-fact verdict: None (precondition) / True (stated and recalled) / None (stated, not recalled) / False.
ASK="(lambda l, u, tok: None if g(I(l),'last.historyMode') != 'summary-plus-recent' or not ((g(I(l),'last.summaryThrough') or -1) >= u) else (lambda said, got: (True if got else None) if said else False)(tok in R(l).lower(), any(str(u) in str(i) for i in (g(I(l),'last.recalledIds',[]) or [])) or str(u) in json.dumps(g(I(l),'last.memoryLookup'))))"
chk S11a "11" "early fact (fact 3, 'My dentist is Doctor Okafor.', sent after the eight crowding messages so its clause cannot be a kept summary quote) asked as 'Who did I say looks after my teeth?': the reply says Okafor AND update $UE is recalled (last.recalledIds or last.memoryLookup); UNTESTED when right but not recalled (the summary answered) or the fact was still in recent history; FAIL when the reply does not say it" \
  "$ASK('s-q-early', $UE, 'okafor')"
chk S11b "11" "late fact (fact 24, past the summary's 20 kept quotes) asked as 'Where did I say I keep the extra thing that unlocks the hut in the woods?': the reply says barometer AND update $UL is recalled; UNTESTED / FAIL as S11a" \
  "$ASK('s-q-late', $UL, 'barometer')"
RE="__import__('re')"
chk S11c "11" "(plan #378: a remembered fact named beside an explicit not-found is not an invented answer) never-said question ('What name did I give you for my sister's horse?'): no invented name, and the reply says it searched, found nothing, and that this is not proof it was never said; UNTESTED on the runner's could-not-search reply or with no summary yet; FAIL on an invented answer or a bare 'you never told me'" \
  "(lambda t, re: None if g(I('s-q-never'),'last.historyMode') != 'summary-plus-recent' or not t else (False if ((any(x in t.lower() for x in json.loads(F('s-fact-tokens.json') or '[]')) or re.search(r\"\\b(called|named)\\s+[A-Z][a-z]+\", t)) and not re.search(r\"(didn't|did not|couldn't|could not) find|no (match|record|mention)|found nothing|don't know|do not know\", t.lower())) else (None if re.search(r\"(could not|couldn't|cannot|can't|unable to) search\", t.lower()) else True if (re.search(r'\\bsearch|\\blooked (through|back|in)|checked (my|our)', t.lower()) and re.search(r\"(did not|didn't|couldn't|could not|can't|cannot|don't|do not) (find|see|have)|no (record|mention|note)|not found|found nothing|nothing (about|on|in)\", t.lower()) and re.search(r\"not proof|isn't proof|is not proof|doesn't (mean|prove)|does not (mean|prove)|not evidence|(may|might)( not)? have (said|mentioned|told)|recorded elsewhere|(may|might) be missing|(may|might) not have been (indexed|recorded|saved|kept)|if you (told|mentioned|said)\", t.lower())) else False)))(R('s-q-never'), $RE)"

# Evidence for the desk (not a check): answer calls per question turn in status modelCalls.last, read right after it,
# and that question's own last.memoryLookup — "offered" means no lookup ran, so the packet already held the answer.
python3 - "$O" > "$O/s-lookup-evidence.txt" <<'PY'
import json,sys,os
O=sys.argv[1]
for l in ('s-q-early','s-q-late','s-q-never'):
    try: u=int(open(os.path.join(O,'update-'+l)).read().strip())
    except Exception: print(l, 'no update'); continue
    try: s=json.load(open(os.path.join(O,'status-'+l+'.json')))
    except Exception: s={}
    calls=[c for c in ((s.get('modelCalls') or {}).get('last') or []) if c.get('judgment')=='answer' and str(c.get('id','')).endswith(':update:%d' % u)]
    try: look=(json.load(open(os.path.join(O,'inspect-'+l+'.json'))).get('last') or {}).get('memoryLookup')
    except Exception: look=None
    if look is None: shown='absent'
    elif isinstance(look,dict): shown='ran; searched %s; found %s' % (look.get('searched'), look.get('found'))
    else: shown='%r (no lookup ran: the packet already showed the answer)' % (look,)
    print(l, 'update', u, 'answer calls in modelCalls.last:', len(calls), '(2 = a memory lookup or a format re-ask)', '| memoryLookup:', shown)
PY
cat "$O/s-lookup-evidence.txt"
st final
summary
```

## The unified diff

This repository's whitespace rule forbids trailing whitespace, so the blank *context* lines of the
diff below have lost their leading space. Apply it with `git apply --ignore-whitespace` or
`patch -l`, or simply take the complete script above, which is byte-exact. The byte-exact diff is
also in the builder's report alongside this change.

```diff
--- lanes/pipeline/live-proof/S.sh
+++ lanes/pipeline/live-proof/S.sh.proposed
@@ -3,7 +3,22 @@
 # Why: twice the long-chat check A6 was answered from the rolling summary's kept fact quotes (memoryItems, at most 20),
 # so the meaning search and the one memory lookup (cint-L27: when the packet does not show what the question asks
 # about, the answer model returns search phrases, the runner searches once and asks once more) were never exercised.
+# Plan row #397: S11a hit the SAME wall the group was built to avoid. In three live runs
+# (S-proofroom2-20261003-063745, -072815, -093107) the early fact's exact clause was in the summary's memoryItems, the
+# answer model read it straight out of the packet (inspect last.memoryLookup stayed "offered", answerReason named
+# "the summary's memoryItems"), and the check recorded UNTESTED because Rule 11's search never ran. The cause is
+# structural, not luck: tests/preview/journal.ts builds each pass's memoryItems from the PREVIOUS summary's items
+# (retained, minus corrections and forgets) and then appends newly covered items only while fewer than 20 are held,
+# so the 20 slots are first-come and never freed. Across five recorded runs every pass covered exactly four operator
+# messages, so the early fact (message 3) was always a candidate in pass 1 with three competitors and was kept, while
+# the late fact (message 24) was first covered by pass 6, after the slots had filled — which is why S11b exercised
+# recall in all five runs and S11a did not.
+# The fix is a CROWDING PHASE: eight messages of six short household facts each are sent FIRST, so passes 1 and 2
+# fill the 20 slots from facts that are never asked about. Every single fact after them — including the early asked
+# fact — is then past the cap, in exactly the structural position that made S11b reliable.
 # Design, for a FRESH room (room2-queue.json "fresh"; room2-fresh-root.sh gives it an empty root):
+#   0. 8 crowding messages, six distinct harmless household clauses each (48 facts), sharing no content word with the
+#      three questions and none of the 26 asked-fact tokens, so the summary's 20 kept-quote slots fill on them.
 #   1. 26 short, distinct, harmless facts, one per message (more than the summary's 20 kept quotes).
 #   2. neutral garden-log filler (lib.sh filler, as A.sh) until the rolling summary covers the late asked fact, both
 #      asked facts are in the meaning index, and the packet is summary-plus-recent; bounded by S_MAX_FILLER (default
@@ -19,17 +34,39 @@
 #   S11c (never said): PASS = no invented answer, and the reply says it searched, found nothing, and that this is not
 #     proof it was never said. UNTESTED = the runner's "could not search" reply (no lookup ran) or no summary yet.
 #     FAIL = an invented answer, or "you never told me" without the search/caveat.
+#   The asked-fact verdict rule is unchanged by plan row #397; only the setup before it changed. S0c (emitted before
+#   S0a, because the crowding messages go first) and S0d are the new preconditions that hold the crowding phase.
 # Note: inspect (journal-agent.mjs recallView) does not expose the packet's memoryLookup field, so whether a lookup
 # ran is read indirectly: s-lookup-evidence.txt counts each question's answer calls in status modelCalls.last (2 =
-# a lookup or a format re-ask). It is evidence for the desk, not a check.
-# Size: 26 + fillers (about 20-35 on recorded fresh-room runs) + 3 = about 50-65 messages, about 45 s each, so about
-# 40-50 minutes; about 2.5-3 model calls per message plus summaries, about 150-200 calls.
+# a lookup or a format re-ask) and prints each question's last.memoryLookup from its own inspect, which is the direct
+# signal for "the summary answered" and is what made the #397 diagnosis slow. It is evidence for the desk, not a check.
+# Size: 8 + 26 + fillers (about 20-35 on recorded fresh-room runs) + 3 = about 57-72 messages, about 45 s each, so
+# about 45-55 minutes; about 2.5-3 model calls per message plus summaries, about 170-220 calls. A recorded full run
+# spent 61 turns / 103 calls / 61 replies against limits of 1000 each, so the raised room below is headroom, not a cap.
 # Usage: S.sh [results-dir]. LIVE_PROOF_DRY=1 / LIVE_PROOF_REPLAY=1 as in lib.sh. Exit 0 only if every check passed.
 . "$(dirname "$0")/lib.sh"; init_results S "$1"
-room 70 230 70
+room 80 260 80
 MAX=${S_MAX_FILLER:-60}
 q() { python3 "$P/check.py" "$O" --quiet x "$1"; }

+# The crowding phase (plan row #397): six short household clauses per message, no names, no dates, no asked-fact
+# token and no content word from the three questions, so these fill the summary's 20 kept-quote slots harmlessly.
+BUNDLES=(
+  "A few small things worth keeping: the desk lamp bulb is seven watts; the hall runner is two metres long; the kettle holds one and a half litres; the stair carpet is grey wool; the letterbox opening is thirty centimetres wide; the doormat is coir."
+  "More for the record: the pantry shelf holds eleven jars; the bread bin is enamel; the big stockpot is eight litres; the wooden spoons live in the left drawer; the colander is stainless; the chopping board is beech."
+  "Some bathroom details to keep: the shower head has four settings; the towel rail is chrome; the mirror cabinet has two shelves; the bath plug chain is short; the ceiling vent whistles; the tile grout is cream."
+  "Bike notes to keep: the bike bell is loose; the front light takes two AAA cells; the mudguard is plastic; the pannier clips are red; the pump gauge sticks; the saddle is worn on the left."
+  "Garden notes to keep: the garden hose is fifteen metres; the watering can is zinc; the wheelbarrow tyre is solid; the compost bin lid is green; the trowel handle is wrapped in tape; the greenhouse pane is cracked."
+  "Desk notes to keep: the printer tray takes A4 only; the stapler is heavy duty; the guillotine blade is blunt; the filing box is cardboard; the label maker uses twelve millimetre tape; the hole punch takes four sheets."
+  "Living room notes to keep: the sofa throw is navy; the reading chair squeaks; the coffee table has one drawer; the floor lamp shade is linen; the bookcase has six shelves; the rug under the table is sisal."
+  "Car notes to keep: the boot liner is rubber; the roof bars are aluminium; the windscreen wipers are twenty four inch; the bulb kit is in the glovebox; the parcel shelf rattles; the boot light flickers."
+)
+j=0; for b in "${BUNDLES[@]}"; do j=$((j+1)); send "b$j" "$b"; done
+UB=$(cat "$O/update-b8" 2>/dev/null)
+echo "crowding=$j lastCrowding=$UB" >> "$O/meta.txt"
+chk S0c "precondition" "all 8 crowding messages were consumed (each has an update id), so the summary's 20 kept-quote slots fill on facts that are never asked about" \
+  "all(U('b%d' % k) is not None for k in range(1, 9))"
+
 # The facts: (message, the distinctive word the answer must contain). Fact 3 and fact 24 are asked by paraphrase.
 FACTS=(
   "Locker 17 at the swim club has combination 4821.|4821"
@@ -80,6 +117,11 @@
 echo "filler=$k ready=$ready" >> "$O/meta.txt"
 chk S0b "precondition" "before the questions the rolling summary covered the late fact, both asked facts were in the meaning index, and the packet was summary-plus-recent (within S_MAX_FILLER / S_FILLER_MINUTES)" \
   "$([ -n "$ready" ] && echo True || echo None)"
+# The crowding phase did its job only if a pass closed between the last crowding message and the early asked fact:
+# tests/preview/journal.ts keeps the previous summary's memoryItems and appends newly covered ones only while fewer
+# than 20 are held, so a fact first covered after the slots filled can never become a kept quote.
+chk S0d "precondition" "a rolling-summary pass ended at or after the last crowding message (update ${UB:--1}) and strictly before the early asked fact (update $UE), so the 20 kept-quote slots were filled from crowding facts before the early fact was first summarised" \
+  "any((g(s,'through') or -1) >= ${UB:--1} and (g(s,'through') or -1) < $UE for s in (g(S('${ready:-room}'),'summaries',[]) or []))"

 send s-q-early "Who did I say looks after my teeth?"
 send s-q-late "Where did I say I keep the extra thing that unlocks the hut in the woods?"
@@ -87,7 +129,7 @@

 # One asked-fact verdict: None (precondition) / True (stated and recalled) / None (stated, not recalled) / False.
 ASK="(lambda l, u, tok: None if g(I(l),'last.historyMode') != 'summary-plus-recent' or not ((g(I(l),'last.summaryThrough') or -1) >= u) else (lambda said, got: (True if got else None) if said else False)(tok in R(l).lower(), any(str(u) in str(i) for i in (g(I(l),'last.recalledIds',[]) or [])) or str(u) in json.dumps(g(I(l),'last.memoryLookup'))))"
-chk S11a "11" "early fact (fact 3, 'My dentist is Doctor Okafor.') asked as 'Who did I say looks after my teeth?': the reply says Okafor AND update $UE is recalled (last.recalledIds or last.memoryLookup); UNTESTED when right but not recalled (the summary answered) or the fact was still in recent history; FAIL when the reply does not say it" \
+chk S11a "11" "early fact (fact 3, 'My dentist is Doctor Okafor.', sent after the eight crowding messages so its clause cannot be a kept summary quote) asked as 'Who did I say looks after my teeth?': the reply says Okafor AND update $UE is recalled (last.recalledIds or last.memoryLookup); UNTESTED when right but not recalled (the summary answered) or the fact was still in recent history; FAIL when the reply does not say it" \
   "$ASK('s-q-early', $UE, 'okafor')"
 chk S11b "11" "late fact (fact 24, past the summary's 20 kept quotes) asked as 'Where did I say I keep the extra thing that unlocks the hut in the woods?': the reply says barometer AND update $UL is recalled; UNTESTED / FAIL as S11a" \
   "$ASK('s-q-late', $UL, 'barometer')"
@@ -95,7 +137,8 @@
 chk S11c "11" "(plan #378: a remembered fact named beside an explicit not-found is not an invented answer) never-said question ('What name did I give you for my sister's horse?'): no invented name, and the reply says it searched, found nothing, and that this is not proof it was never said; UNTESTED on the runner's could-not-search reply or with no summary yet; FAIL on an invented answer or a bare 'you never told me'" \
   "(lambda t, re: None if g(I('s-q-never'),'last.historyMode') != 'summary-plus-recent' or not t else (False if ((any(x in t.lower() for x in json.loads(F('s-fact-tokens.json') or '[]')) or re.search(r\"\\b(called|named)\\s+[A-Z][a-z]+\", t)) and not re.search(r\"(didn't|did not|couldn't|could not) find|no (match|record|mention)|found nothing|don't know|do not know\", t.lower())) else (None if re.search(r\"(could not|couldn't|cannot|can't|unable to) search\", t.lower()) else True if (re.search(r'\\bsearch|\\blooked (through|back|in)|checked (my|our)', t.lower()) and re.search(r\"(did not|didn't|couldn't|could not|can't|cannot|don't|do not) (find|see|have)|no (record|mention|note)|not found|found nothing|nothing (about|on|in)\", t.lower()) and re.search(r\"not proof|isn't proof|is not proof|doesn't (mean|prove)|does not (mean|prove)|not evidence|(may|might)( not)? have (said|mentioned|told)|recorded elsewhere|(may|might) be missing|(may|might) not have been (indexed|recorded|saved|kept)|if you (told|mentioned|said)\", t.lower())) else False)))(R('s-q-never'), $RE)"

-# Evidence for the desk (not a check): answer calls per question turn in status modelCalls.last, read right after it.
+# Evidence for the desk (not a check): answer calls per question turn in status modelCalls.last, read right after it,
+# and that question's own last.memoryLookup — "offered" means no lookup ran, so the packet already held the answer.
 python3 - "$O" > "$O/s-lookup-evidence.txt" <<'PY'
 import json,sys,os
 O=sys.argv[1]
@@ -105,7 +148,12 @@
     try: s=json.load(open(os.path.join(O,'status-'+l+'.json')))
     except Exception: s={}
     calls=[c for c in ((s.get('modelCalls') or {}).get('last') or []) if c.get('judgment')=='answer' and str(c.get('id','')).endswith(':update:%d' % u)]
-    print(l, 'update', u, 'answer calls in modelCalls.last:', len(calls), '(2 = a memory lookup or a format re-ask)')
+    try: look=(json.load(open(os.path.join(O,'inspect-'+l+'.json'))).get('last') or {}).get('memoryLookup')
+    except Exception: look=None
+    if look is None: shown='absent'
+    elif isinstance(look,dict): shown='ran; searched %s; found %s' % (look.get('searched'), look.get('found'))
+    else: shown='%r (no lookup ran: the packet already showed the answer)' % (look,)
+    print(l, 'update', u, 'answer calls in modelCalls.last:', len(calls), '(2 = a memory lookup or a format re-ask)', '| memoryLookup:', shown)
 PY
 cat "$O/s-lookup-evidence.txt"
 st final
```

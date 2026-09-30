# Justin's private preview check: held reply reduction

Run after the desk lands and resumes the reviewed runner. Use the existing
private operator chat and journal. This procedure does not start another runner
or alter its activation, provider policy, caps or journal. The offline fixture
tests the CRLF fence and failure branches; this live check observes ordinary
provider behavior and may never encounter that exact fence.

1. Have the desk save one read-only `journal-agent.mjs status --root ROOT` result.
   Record `turns`, `calls`, `replies`, `holds`, `callOutcomeCounts`,
   `lastCallOutcomes` and `modelJsonShapes`. Confirm there is room under the
   existing caps. Save the status privately; do not put remembered text or
   provider output in a public report.
2. Justin sends these ordinary messages, one at a time, waiting for each reply:
   “What can you do in this preview in one sentence?”; “What did I say about
   the blue notebook?”; “Explain what git status tells me in one sentence.”;
   “Please recap our plan for Friday.” Do not induce an outage or ask the model
   to exceed its output cap.
3. Have the desk save status after each turn. For each accepted update, record
   whether there was an exact reply intent and one Telegram acceptance or a
   `holds` reason. Compute held/accepted for these four first attempts, with
   the count by hold reason. Do not count a definite model failure reply as a
   hold. A timeout or UNKNOWN reservation remains charged and is never retried
   for this check.
4. Compare the deltas in `callOutcomeCounts` with the new last-ten physical
   rows. If `modelJsonShapes` reports `reply-review/verdict/tolerated/fenced`,
   verify the same turn has a completed PASS review and one sent answer. If it
   reports a malformed wrapped or prose result, verify the turn remains held;
   the JSON object alone must not authorize a send. If Jev is unavailable,
   verify a completed full-context review precedes any answer. Record absent
   classes as “not observed,” not as passes.
5. Wait for the runner's normal restart, or have the desk inspect its next
   routine replay. Confirm no reply or paid review is duplicated. Report the
   four-turn live held share separately from the offline 8/12 to 4/12 fixture
   result; the fixture mix is chosen for branch coverage, not live prevalence.

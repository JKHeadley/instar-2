# Justin's private preview check: CRLF model JSON fence

Run after the desk lands this commit and resumes the reviewed runner. Use the
existing private operator chat, root, activation and profile. Do not start a
second runner or repeat an UNKNOWN call.

1. Have the desk save `journal-agent.mjs status --root ROOT` and confirm room
   under the existing call, reply and turn caps. Note `modelJsonShapes`, held
   turns, and send counts.
2. Justin sends: `In one sentence, what can you remember from this preview?`
   Wait for the ordinary reply, then save status again. The turn should follow
   the usual reply check and one-send journal path.
3. If a new `role/layer/tolerated/fenced` count appears, record the role and
   layer. This count does not reveal whether the provider used LF or CRLF; the
   offline fixture proves the CRLF bytes at all three parser layers. If no
   fenced count appears, mark live CRLF occurrence unobserved, not failed.
4. Check that no new malformed hold or duplicate send occurred. Record the
   reply receipt and before/after status. Do not ask the model to produce a
   fake review verdict or induce a rejection; the offline tests cover prose
   after a CRLF fence and contradictory prose at each layer.

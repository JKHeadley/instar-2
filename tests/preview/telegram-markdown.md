# Prepared Telegram formatting

The journal owner renders each reply part before signing its exact HTML body and a plain
alternative for the same target and destination. Both variants live in the existing durable
intent. The original reply remains available for recall. Continuation parts recovered after
restart consume their retained bytes; a renderer update cannot change an admitted message.
Legacy intents without a prepared alternative are sent verbatim and cannot invent one.

The physical send verifies both signatures, then uses the existing admission, audience,
stop, expiry, ownership and dispatch claim. A definite Telegram 400 parse refusal is retained
as a separate `send-format-refused` record before the plain alternative. In a replicated
installation that evidence must reach the peer too. Stop and ownership are checked again
before fallback. Accepted, uncertain and unrelated refusals never permit a second send.
The alternative is attempted at most once; its refusal stays visible alongside the original
parse refusal. A crash never grants permission to repeat an unknown send.

Links protect their destinations before formatting their labels. Heading closing hashes are
removed only when separated from the text by whitespace: `## C#` preserves `C#`.

Rules 33, 42, 63, 77, 89, 106, 113 and 116 govern this path. The tests in
`journal-markdown-preparation.test.ts` exercise actual signatures, durable refusal evidence,
recorded Telegram replies 34501/34485 and restart without resend. The ordinary conversation
adapter's P12-NF-31 case still refuses an unprepared alternative; the journal path explicitly
prepares and binds its one alternative rather than rerendering after admission.

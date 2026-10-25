# Answer the memory question

A person asked who looked after their teeth. The agent had already found the
remembered dentist's name, but a second flag in its response made the program
replace that answer with a long list of unrelated saved memories.

The program now keeps a nonempty answer. To request the saved-memory inventory,
the model sets the list flag and leaves the answer empty. The instructions explain
that this is for an explicit inventory request. Questions about a particular fact
still use the existing memory search and answer path.

Tests replay the proof room's recorded questions and saved facts, check that the
dentist answer survives, and keep explicit lists and honest missing-fact answers
working. The supplied snapshots did not contain raw model answers: the dentist
and key answers in the regression test are reconstructed from recorded reasoning,
while the missing-fact reply is the captured delivered text. Separate existing
lookup tests exercise captured model outputs. The desk reruns the live conversation
before accepting the fix; these offline checks do not claim live acceptance.

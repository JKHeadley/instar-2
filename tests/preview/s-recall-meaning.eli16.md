# Recall by meaning: finding the source and explaining a miss

A person asked about an extra thing that unlocks a hut in the woods. Their earlier message said where the spare cabin key was. The search had indexed that message, but its search terms did not share a word with the question. It searched 24 messages and missed the source.

The model understood the question from a saved fact. That meant it skipped the available lookup, whose instruction only applied when the whole packet lacked an answer. The instruction now asks for the original message when only a summary or saved memory supports the detail. The model chooses search phrases; the existing lookup runs once under the same call cap.

A second question asked for a horse's name that the test conversation never supplied. The model correctly declined to guess. Its private reasoning also recognized that a failed search cannot prove something was never said, but it did not tell the person. The reply instruction now asks the model to explain that limit in its own words.

The replay includes the actual recorded terms and messages, the original miss, retrieval with the model's recorded interpretation, an unrelated lookup, and recorded honest not-found and unusual output shapes. Reconstructing a lookup from an old reason does not prove the revised model will request it. That behavior still needs the desk's live group S check.

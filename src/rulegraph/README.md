# Part Three rule graph

`graph.ts` builds the both-directions rule graph (Rule 69): every declaration's `standards` and `holds` must name a real rule, including dark, soaking and retired entries, while only live holders mint enforcement edges. It also derives gaps, deferred loops and deadline checks.

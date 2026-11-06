// Real collaboration consumer for extracted launcher closures in non-hub fixtures.
// These fixtures grant no hub command authority. Unexpected effects must fail.
import { createCollaborationSurface } from './collaboration-hub.js';
import { openPreviewJournal } from './journal.js';
export function modelCollaborationFixture(journal: ReturnType<typeof openPreviewJournal>) {
  return createCollaborationSurface({ state: () => journal.view.collaboration,
    append: row => journal.append(row), now: () => 1000,
    admitted: () => journal.view.stop === null, topics: () => [], replicated: async () => true,
    effect: async () => { throw Error('non-hub fixture must not dispatch collaboration effects'); } });
}

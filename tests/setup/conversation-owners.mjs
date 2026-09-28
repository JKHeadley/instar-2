// Each test file gets its own conversation-owner directory so launched runner children
// never claim conversations in the real host directory, and files cannot fence each other.
import { mkdtempSync, realpathSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

process.env.INSTAR_CONVERSATION_OWNERS = realpathSync(mkdtempSync(join(tmpdir(), 'instar-owners-')));

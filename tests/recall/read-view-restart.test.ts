import { mkdtempSync, readFileSync, realpathSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { expect, it } from 'vitest';
import { value } from '../fixtures.js';
import { refused } from '../facts/fixtures.js';
import { createFactStore } from '../../src/facts/index.js';
import { openProductionStorage } from '../../src/assembly/production-storage.js';
import { captureExchange, recall } from '../../src/recall/index.js';
import { rebuildConversationReadView } from '../../src/recall/read-view.js';
// @ts-expect-error Physical host binding lives outside the pure core.
import { productionStorageIO } from '../../scripts/production-boot-io.mjs';
import { recallFixture } from './fixture.js';

it('a failed index rebuild after durable intake loses no messages on encrypted-storage reopen', async () => {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'conversation-index-')));
  const r = recallFixture();
  const open = () => value(openProductionStorage({ root, machine: 'machine-a', key: new Uint8Array(32).fill(7),
    policy: 'policy', store: 'recall', context: r.fx.c, io: productionStorageIO }));
  const work = { fold: () => r.fx.success([] as string[]), conversation: (s: string) => s };
  let disk = open();
  try {
    const writer = r.writer(disk.segment);
    value(captureExchange(r.exchange({ text: 'Portland weather forecast' }), r.at(1000), writer));
    const first = value(rebuildConversationReadView(writer.store, r.fx.c, work));
    const input = r.exchange({ messageId: 'later', text: 'Portland raincoat tomorrow' });
    value(captureExchange(input, r.at(2000), writer));
    refused(rebuildConversationReadView(writer.store, r.fx.c, {
      fold: () => { throw new Error('simulated interruption before publication'); }, conversation: (s: string) => s,
    }), 'interruption');
    expect(readFileSync(join(root, 'facts.encrypted'), 'utf8')).not.toContain('Portland');
    disk.close(); disk = open();
    const store = createFactStore(r.context, disk.segment);
    const index = value(rebuildConversationReadView(store, r.fx.c, work));
    expect(index.source.count).toBe(2); expect(first.source.count).toBe(1);
    const reader = { context: r.fx.c, store, stopped: () => false };
    expect(value(await recall({ text: 'raincoat' }, { ...reader, index }))).toEqual(value(await recall({ text: 'raincoat' }, reader)));
    expect(value(captureExchange(input, r.at(3000), { ...r.writer(disk.segment), store })).duplicate).toBe(true);
    expect(value(store.read())).toHaveLength(2);
  } finally { disk.close(); rmSync(root, { recursive: true, force: true }); }
});

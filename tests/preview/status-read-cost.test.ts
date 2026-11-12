import { expect, it } from 'vitest';
import { spawnSync } from 'node:child_process';
import { appendFileSync, mkdtempSync, readFileSync, realpathSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { openPreviewJournal } from './journal.js';

it('the measurement loader preserves status bytes on fresh, replayed, compacted and torn journals', () => {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'status-profile-equality-')));
  const path = join(root, 'journal.encrypted'), key = new Uint8Array(32).fill(7);
  const journal = openPreviewJournal(path, key, { kind: 'genesis', bot: '12345678', chat: '7654321',
    operator: '7654321', grant: 'grant:preview', configurationDigest: 'sha256:offline', expires: 9999999999999,
    maxCalls: 100, maxReplies: 100, maxTurns: 100, maxBytes: 262144, cursor: 0 });
  const compare = () => {
    const before = readFileSync(path);
    const run = (loader: string) => {
      const result = spawnSync(process.execPath, ['--no-warnings', '--import', './tests/preview/status-read-cost/fixed-clock.mjs',
        '--loader', loader, 'tests/preview/journal-agent.mjs', 'status', '--root', root], {
        encoding: 'utf8', timeout: 30_000, maxBuffer: 2 * 1024 * 1024,
        env: { ...process.env, INSTAR_SECRET_PREVIEW_STORAGE_KEY: Buffer.from(key).toString('hex'),
          INSTAR_CONVERSATION_OWNERS: join(root, 'owners') } });
      expect(result.status, result.stderr).toBe(0);
      return result;
    };
    const original = run('./scripts/slice-ts-loader.mjs');
    const measured = run('./tests/preview/status-read-cost/profile-loader.mjs');
    expect(measured.stdout).toBe(original.stdout);
    const profile = JSON.parse(measured.stderr.trim());
    expect(profile.phases.read).toBeGreaterThanOrEqual(0);
    expect(profile.phases.decode).toBeGreaterThan(0);
    expect(readFileSync(path)).toEqual(before);
  };
  try {
    compare();
    journal.append({ kind: 'channel-item', item: { source: 'conversation', account: 'synthetic', id: '1',
      from: 'synthetic', at: 1, text: 'Stored history with Unicode 🌱 and "quotes".' }, at: 1 });
    compare();
    journal.compact(); compare(); journal.close();
    appendFileSync(path, Buffer.from([0, 0])); compare();
  } finally { journal.close(); rmSync(root, { recursive: true, force: true }); }
}, 60_000);

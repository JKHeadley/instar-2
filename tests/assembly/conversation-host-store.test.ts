import { afterEach, expect, it } from 'vitest';
import { mkdtempSync, readFileSync, writeFileSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
// @ts-expect-error physical ESM boundary is deliberately outside src
import { createConversationHostStore } from '../../scripts/conversation-host-store.mjs';
const roots: string[] = [];
afterEach(() => { for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true }); });
it('recovers encrypted owner records after reopen and refuses corrupt or wrong-key state', () => {
  const root = mkdtempSync(join(tmpdir(), 'host-store-')); roots.push(root);
  const path = join(root, 'conversation.json'), key = new Uint8Array(32).fill(23);
  const store = createConversationHostStore(path, key);
  expect(store.load()).toBeNull();
  const record = { conversation: 'operator', inputs: [{ question: 'private remembered text', state: 'queued' }], cursor: 12 };
  store.save(record);
  expect(readFileSync(path, 'utf8')).not.toContain('private remembered text');
  expect(statSync(path).mode & 0o777).toBe(0o600);
  expect(createConversationHostStore(path, key).load()).toEqual(record);
  expect(() => createConversationHostStore(path, new Uint8Array(32).fill(24)).load()).toThrow();
  writeFileSync(path, '{}'); expect(() => store.load()).toThrow(/unsupported/);
  writeFileSync(path, '{'); expect(() => store.load()).toThrow();
});

it('installs the shipped Stop hook as a byte-exact readable copy outside the private repository', async () => {
  // @ts-expect-error physical ESM boundary
  const { installLifecycleHook, lifecycleHookPath } = await import('../../scripts/conversation-lifecycle-io.mjs');
  const root = mkdtempSync(join(tmpdir(), 'host-hook-')); roots.push(root);
  const tool = join(root, 'tool-admission-hook.mjs');
  const installed = installLifecycleHook(tool);
  expect(installed).toBe(lifecycleHookPath(tool));
  expect(readFileSync(installed)).toEqual(readFileSync(new URL('../../scripts/session-hooks/stop.mjs', import.meta.url)));
  expect(statSync(installed).mode & 0o777).toBe(0o644);
  expect(installLifecycleHook(tool)).toBe(installed);
  writeFileSync(installed, 'changed'); expect(() => installLifecycleHook(tool)).toThrow(/differs/);
});

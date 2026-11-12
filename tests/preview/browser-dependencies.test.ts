import { expect, it } from 'vitest';
import { spawnSync } from 'node:child_process';

it('loads profile metadata without Playwright, but cannot validate browser work without it', () => {
  const module = new URL('./browser-profile.mjs', import.meta.url).href;
  const result = spawnSync(process.execPath, ['--input-type=module', '-e', `
    import { registerHooks } from 'node:module';
    import assert from 'node:assert/strict';
    let attempts = 0;
    registerHooks({ resolve(specifier, context, next) {
      if (specifier.startsWith('playwright')) { attempts++; throw Error('test-runtime-unavailable'); }
      return next(specifier, context);
    } });
    const profile = await import(${JSON.stringify(module)});
    assert.equal(profile.readBrowserProfile('/unused', undefined), null);
    assert.equal(attempts, 0);
    assert.throws(() => profile.profileRequest('browser_navigate', { url: 'https://example.test' }), /test-runtime-unavailable/);
    assert.equal(attempts, 1);
  `], { encoding: 'utf8', timeout: 10000 });
  expect(result.status, result.stderr).toBe(0);
});

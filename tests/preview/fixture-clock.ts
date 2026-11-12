// @ts-nocheck -- installs a shifted Date for the test process and its launched children.
/**
 * A shifted wall clock for preview tests that launch the real launcher.
 *
 * The launcher reads the wall clock, and the fixture activation expires at the fixed
 * SUBSCRIPTION_PREVIEW_EXPIRY (2026-10-05). On the real clock every launch was refused once
 * that date passed ("subscription activation expired or clock differs"; 2026-11-12 holistic
 * review). The test process and every child it launches see "now" shifted by ONE shared offset,
 * so the records the test writes and the launcher reads agree, and time still advances.
 */
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

/** One minute after the fixture START (1790000000000): past its observedAt (START + 1200 ms), long before expiry. */
export const FIXTURE_NOW = 1790000060000;

const source = (offset: number) => `const RealDate = Date; const offset = ${offset};
class FixtureDate extends RealDate {
  constructor(...a) { if (a.length === 0) super(RealDate.now() - offset); else super(...a); }
  static now() { return RealDate.now() - offset; }
}
globalThis.Date = FixtureDate;
`;

/**
 * Shift this test file's clock (vitest isolates each file's worker) and return the environment
 * to add to every child, so children share the same offset.
 */
export function installFixtureClock(): { NODE_OPTIONS: string } {
  const offset = Date.now() - FIXTURE_NOW;
  const shim = join(mkdtempSync(join(tmpdir(), 'preview-fixture-clock-')), 'fixed-clock.mjs');
  writeFileSync(shim, source(offset));
  const RealDate = Date;
  globalThis.Date = class FixtureDate extends RealDate {
    constructor(...a) { if (a.length === 0) super(RealDate.now() - offset); else super(...a); }
    static now() { return RealDate.now() - offset; }
  };
  return { NODE_OPTIONS: [process.env.NODE_OPTIONS, `--import=${pathToFileURL(shim).href}`].filter(Boolean).join(' ') };
}

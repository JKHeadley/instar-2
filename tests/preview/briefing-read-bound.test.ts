import { expect, it, vi } from 'vitest';
import * as fs from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// Grow the report to 1 MiB right after it is stat'ed, as a concurrent desk update would.
const grow = vi.hoisted(() => ({ path: '' }));
vi.mock('node:fs', async importOriginal => {
  const real = await importOriginal<typeof import('node:fs')>();
  const after = <T>(result: T) => { if (grow.path) real.writeFileSync(grow.path, 'y'.repeat(1_048_576)); return result; };
  return { ...real,
    statSync: ((...args: Parameters<typeof real.statSync>) => after(real.statSync(...args))) as typeof real.statSync,
    fstatSync: ((...args: Parameters<typeof real.fstatSync>) => after(real.fstatSync(...args))) as typeof real.fstatSync };
});

const { DESK_STATUS_MAX_BYTES, deskStatusSource, readDeskStatus } = await import('./briefing.js');

it('bounds the read when the report grows between stat and read', () => {
  const root = fs.mkdtempSync(join(tmpdir(), 'preview-read-bound-'));
  try {
    const path = join(root, 'desk-status.md');
    fs.writeFileSync(path, 'x'.repeat(3996));
    grow.path = path;
    const file = readDeskStatus(path);
    grow.path = '';
    expect(fs.statSync(path).size).toBe(1_048_576);
    expect(file?.text ?? '').not.toContain('y');
    expect((file?.text ?? '').length).toBeLessThanOrEqual(DESK_STATUS_MAX_BYTES);
    const source = deskStatusSource(file, file?.modifiedAt ?? 0, path);
    expect(source.provenance.status).toBe('oversize');
    expect(source.text).toContain('was not included');
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});

import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test } from 'vitest';

function closingBlock(record: string): boolean {
  const lines = record.trimEnd().split(/\r?\n/u);
  const labels = ['simplestRobustRoute:', '80/20:', 'VERDICT:'];
  return labels.every((label, index) => {
    const line = lines.at(index - labels.length);
    return line?.startsWith(label) && line.slice(label.length).trim().length > 0;
  });
}

test('REVIEW-NF-01 independent review records carry the required closing block', () => {
  const records = readdirSync('reviews').filter(name => name.endsWith('.md'));
  expect(records.length).toBeGreaterThan(0);
  for (const name of records) expect(closingBlock(readFileSync(join('reviews', name), 'utf8'))).toBe(true);
  expect(closingBlock('simplestRobustRoute: yes\n80/20: yes\n')).toBe(false);
  expect(closingBlock('simplestRobustRoute: \n80/20: yes\nVERDICT: yes')).toBe(false);
});

import { describe, expect, it } from 'vitest';
// @ts-expect-error Repository contract checker is intentionally JavaScript.
import { findForbiddenMeasurementPermissionExports } from '../../scripts/check-p16-contract-map.mjs';
import {
  round11ExportTemplates, round11HarmlessExports, scanRound11Source,
} from './round11-architecture-fixtures.js';

describe('Part 16 A1 round 11 independent-review export corpus', () => {
  const templateCases = round11ExportTemplates.flatMap(([id, template]) => ['allow', 'normalize'].map(name => ({
    id: `${id}-${name}`,
    source: template.replaceAll('__NAME__', name),
    expected: id === 'class-private' || name === 'normalize' ? [] : ['allow'],
  })));

  it.each(templateCases)(
    'P16-NF-23 [behavior:observational-port] reviewer case $id follows only its exported runtime value',
    ({ source, expected }) => {
      expect(findForbiddenMeasurementPermissionExports(scanRound11Source(source))).toEqual(expected);
    },
  );

  it.each(round11HarmlessExports)(
    'P16-NF-23 [behavior:observational-port] reviewer case %s accepts a harmless exported value',
    (_id, source) => {
      expect(findForbiddenMeasurementPermissionExports(scanRound11Source(source))).toEqual([]);
    },
  );
});

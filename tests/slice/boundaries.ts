// The boundary enumeration and the schedule row format have ONE source each, in the
// assembly and in the record script. This module only gives them TypeScript types;
// it never restates a name.
/* eslint-disable */
// @ts-expect-error the reference assembly is JavaScript, outside pure core compilation.
import { DECLARED_BOUNDARIES as declared, PROFILE_BOUNDARIES as profiles, SLICE_BOUNDARIES as union, UNREACHED_BOUNDARIES as unreached } from '../../scripts/slice-assembly.mjs';
// @ts-expect-error the record script is JavaScript, outside pure core compilation.
import { SCHEDULE_HEADER as header, renderScheduleRecord as render, scheduleRow as row } from '../../scripts/slice-schedule-record.mjs';
import type { SliceReport } from './acceptance.js';

export const PROFILE_BOUNDARIES = profiles as Readonly<Record<string, readonly string[]>>;
export const SLICE_BOUNDARIES = union as readonly string[];
export const DECLARED_BOUNDARIES = declared as readonly string[];
export const UNREACHED_BOUNDARIES = unreached as Readonly<Record<string, string>>;
export const SCHEDULE_HEADER = header as string;
export const scheduleRow = row as (profile: string, pair: readonly [string, string], boots: number,
  fired: readonly string[], report: SliceReport) => string;
export const renderScheduleRecord = render as (rows: readonly string[]) => string;

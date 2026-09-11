import type { ScheduledWorkManifest } from '../../src/scheduled/index.js';

// @ts-expect-error A structural object cannot mint an admitted Part Fifteen package resource.
const manifest: ScheduledWorkManifest = { type: 'ScheduledWorkManifest', schemaVersion: 2 };
void manifest;

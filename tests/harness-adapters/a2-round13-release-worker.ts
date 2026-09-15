import { value } from '../facts/fixtures.js';
import { transportFixture } from '../transport/fixture.js';

const directory = process.argv[2];
if (!directory) throw new Error('transport storage directory is required');
const six = transportFixture(directory);
const fence = value(six.api.acquire('r13:file:lease', '', 500));
process.stdout.write(JSON.stringify({ release: six.api.release('r13:file:release', fence).kind }));

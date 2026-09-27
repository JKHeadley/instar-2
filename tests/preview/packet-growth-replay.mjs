import { runPacketGrowthReplay } from './packet-growth-replay.ts';

process.stdout.write(`${JSON.stringify(runPacketGrowthReplay(), null, 2)}\n`);

#!/usr/bin/env node
import { runProductionCommand } from '../scripts/production-boot.mjs';
process.exitCode = await runProductionCommand(process.argv.slice(2));

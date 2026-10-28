/// <reference types="node" />
import { writeFileSync } from 'node:fs';
import { it } from 'vitest';
import { MAPS } from '../src/config/maps';
import { formatReport, runStrategy, STRATEGIES, type RunResult } from '../src/balance/harness';

const SEEDS = [1, 2, 3];

it('balance report', { timeout: 600_000 }, () => {
  const results: RunResult[] = [];
  for (const map of Object.values(MAPS)) {
    for (const strategy of STRATEGIES) {
      for (const seed of SEEDS) results.push(runStrategy(map, strategy, seed));
    }
  }
  const report = formatReport(results);
  writeFileSync('balance-report.md', `# Balance report\n\nSeeds: ${SEEDS.join(', ')}\n\n${report}\n`);
  process.stdout.write(`\n${report}\n\n(also written to balance-report.md)\n`);
});

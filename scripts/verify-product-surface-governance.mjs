import { mkdir, writeFile } from 'node:fs/promises';
import { analyzeProductSurfaceGovernance } from './lib/product-surface-governance-analysis.mjs';

const cliArguments = process.argv.slice(2);
if (cliArguments.length > 1 || cliArguments.some((argument) => argument !== '--no-write')) {
  throw new Error('Unsupported product surface governance argument.');
}
const noWrite = process.argv.includes('--no-write');
const report = await analyzeProductSurfaceGovernance();
if (!noWrite) {
  await mkdir('artifacts/validation', { recursive: true });
  await writeFile(
    'artifacts/validation/32-W-b0-03-b0-04-product-surface-boundary.json',
    `${JSON.stringify(report, null, 2)}\n`
  );
}
console.log(`B0-03/B0-04 product surface boundary: ${report.status} (${report.checksPassed}/${report.checksPassed + report.checksFailed} checks).`);
if (report.status !== 'PASS') {
  console.error(report.failures.join('\n'));
  process.exitCode = 1;
}

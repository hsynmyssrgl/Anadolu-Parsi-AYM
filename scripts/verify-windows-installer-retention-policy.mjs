import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { readJson } from './lib/governance-utils.mjs';
import {
  evaluateWindowsInstallerRetention,
  listWindowsInstallerArtifacts,
} from './lib/windows-installer-artifacts.mjs';

const root = resolve(import.meta.dirname, '..');
const releaseRoot = resolve(root, 'apps/desktop/release');
const ledger = await readJson(resolve(root, 'config/release-ledger.json'));
const artifacts = await listWindowsInstallerArtifacts(releaseRoot);
const result = evaluateWindowsInstallerRetention({
  artifacts,
  channel: ledger.current.channel,
  version: ledger.current.version,
});
const report = {
  schemaVersion: 1,
  rule: 'PR-229',
  release: ledger.current.visibleRelease,
  releaseRoot,
  status: result.status,
  expectedPrefix: result.expectedPrefix,
  artifactCount: artifacts.length,
  artifacts: artifacts.map(({ name, bytes }) => ({ name, bytes })),
  failures: result.failures,
  generatedAt: new Date().toISOString(),
};

await mkdir(resolve(root, 'artifacts/validation'), { recursive: true });
await writeFile(
  resolve(root, 'artifacts/validation/windows-installer-retention-policy.json'),
  `${JSON.stringify(report, null, 2)}\n`,
);

if (result.status !== 'PASS') {
  for (const failure of result.failures) console.error(failure);
  process.exit(1);
}
console.log(
  `Windows installer retention policy: PASS (${artifacts.length} artefakt / yalnız ${ledger.current.version} kabul edilir).`,
);

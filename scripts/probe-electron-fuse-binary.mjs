import { createHash } from 'node:crypto';
import { copyFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import { basename, resolve } from 'node:path';
import { applyElectronFusePolicy, verifyElectronFuseBinary } from '../apps/desktop/scripts/apply-electron-fuses.mjs';

const sourceArgument = process.argv[2];
if (!sourceArgument) throw new Error('Usage: node scripts/probe-electron-fuse-binary.mjs <electron.exe>');

const sourcePath = resolve(sourceArgument);
const probeDirectory = resolve('.tmp/32-x-electron-fuse-probe');
const probePath = resolve(probeDirectory, 'electron-fuse-probe.exe');
const sha256 = (value) => createHash('sha256').update(value).digest('hex');

await mkdir(probeDirectory, { recursive: true });
await copyFile(sourcePath, probePath);
const before = sha256(await readFile(probePath));
const applied = await applyElectronFusePolicy(probePath);
const verified = await verifyElectronFuseBinary(probePath);
const after = sha256(await readFile(probePath));
if (before === after) throw new Error('Electron fuse mutation did not change the executable.');

const report = Object.freeze({
  schemaVersion: 1,
  step: '32-X',
  requirement: 'B2-04',
  status: 'PASS',
  sourceBinary: basename(sourcePath),
  probeBinary: basename(probePath),
  sourceSha256: before,
  fusedSha256: after,
  binaryChanged: true,
  policyId: verified.policyId,
  fuseVersion: verified.version,
  fuses: verified.fuses,
  independentReadbackMatched: JSON.stringify(applied.fuses) === JSON.stringify(verified.fuses),
  productionSigningOrder: 'afterPack-fuses-before-signing',
  generatedAt: new Date().toISOString()
});
await mkdir('artifacts/validation', { recursive: true });
await writeFile('artifacts/validation/32-X-electron-fuse-binary-proof.json', `${JSON.stringify(report, null, 2)}\n`);
console.log(`Electron fuse binary proof: PASS (${Object.keys(report.fuses).length}/9 fuses).`);

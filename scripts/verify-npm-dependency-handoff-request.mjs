import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { basename, dirname, resolve } from 'node:path';
import { verifyDependencyHandoffRequest } from './lib/npm-dependency-handoff.mjs';
const args = process.argv.slice(2);
const option = (name, fallback) => { const i = args.indexOf(name); if (i < 0) return fallback; const v = args[i + 1]; if (!v || v.startsWith('--')) throw new Error(`${name} requires a value.`); return v; };
const archive = option('--archive');
if (!archive) throw new Error('--archive is required.');
const archivePath = resolve(archive);
const checksum = option('--checksum');
const packageJson = JSON.parse(await readFile('package.json', 'utf8'));
const reportPath = resolve(option('--report', 'artifacts/validation/npm-dependency-handoff-request-verification.json'));
const report = await verifyDependencyHandoffRequest({ archivePath, expectedPackageVersion: packageJson.version, expectedLockBytes: await readFile('package-lock.json') });
const failures = [...report.failures];
if (checksum) {
  const text = await readFile(resolve(checksum), 'utf8');
  const match = /^([a-f0-9]{64})  ([^\r\n]+)\r?\n?$/i.exec(text);
  const actual = createHash('sha256').update(await readFile(archivePath)).digest('hex');
  if (!match || match[2] !== basename(archivePath) || match[1].toLowerCase() !== actual) failures.push('Request checksum sidecar verification failed.');
}
const evidence = { ...report, failures, status: failures.length === 0 ? 'PASS' : 'FAIL', product: 'Anadolu Parsı Aile Yaşam Merkezi', stage: 'Bronze RC2 Active Development', generatedAt: new Date().toISOString() };
await mkdir(dirname(reportPath), { recursive: true });
await writeFile(reportPath, `${JSON.stringify(evidence, null, 2)}\n`);
console.log(`Npm dependency handoff request verification: ${evidence.status} — requestId=${evidence.requestId}.`);
for (const failure of failures) console.error(`- ${failure}`);
if (evidence.status !== 'PASS') process.exitCode = 1;

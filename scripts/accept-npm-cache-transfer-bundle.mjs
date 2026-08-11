import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { basename, dirname, resolve } from 'node:path';
import { acceptNpmCacheTransferBundle } from './lib/npm-cache-bundle-acceptance.mjs';
import { verifyDependencyHandoffRequest } from './lib/npm-dependency-handoff.mjs';

const args = process.argv.slice(2);
const option = (name, fallback) => {
  const index = args.indexOf(name);
  if (index < 0) return fallback;
  const value = args[index + 1];
  if (!value || value.startsWith('--')) throw new Error(`${name} requires a value.`);
  return value;
};
const archivePath = option('--archive');
const checksumPath = option('--checksum');
const requestPath = option('--handoff-request');
const requestChecksumPath = option('--handoff-request-checksum');
if (!archivePath) throw new Error('--archive is required.');
const policy = JSON.parse(await readFile(resolve(option('--policy', 'config/npm-cache-bundle-acceptance-policy.json')), 'utf8'));
const packageVersion = JSON.parse(await readFile('package.json', 'utf8')).version;
const reportPath = resolve(option('--report', 'artifacts/validation/npm-cache-bundle-acceptance.json'));
let handoffRequestVerification;
if (requestPath) {
  const absoluteRequestPath = resolve(requestPath);
  handoffRequestVerification = await verifyDependencyHandoffRequest({ archivePath: absoluteRequestPath, expectedPackageVersion: packageVersion, expectedLockBytes: await readFile('package-lock.json') });
  if (requestChecksumPath) {
    const checksumText = await readFile(resolve(requestChecksumPath), 'utf8');
    const match = /^([a-f0-9]{64})  ([^\r\n]+)\r?\n?$/i.exec(checksumText);
    const actual = createHash('sha256').update(await readFile(absoluteRequestPath)).digest('hex');
    if (!match || match[2] !== basename(absoluteRequestPath) || match[1].toLowerCase() !== actual) {
      handoffRequestVerification = { ...handoffRequestVerification, status: 'FAIL', failures: [...handoffRequestVerification.failures, 'Handoff request checksum sidecar verification failed.'] };
    }
  }
  if (handoffRequestVerification.status !== 'PASS') {
    const blocked = { schemaVersion: 1, product: 'Anadolu Parsı Aile Yaşam Merkezi', stage: 'Bronze RC2 Active Development', status: 'FAIL', disposition: 'REJECTED', classification: 'HANDOFF_REQUEST_REJECTED', handoffRequestVerification, failures: handoffRequestVerification.failures, generatedAt: new Date().toISOString() };
    await mkdir(dirname(reportPath), { recursive: true });
    await writeFile(reportPath, `${JSON.stringify(blocked, null, 2)}\n`);
    console.error('Npm cache bundle acceptance: FAIL — REJECTED — HANDOFF_REQUEST_REJECTED.');
    process.exit(1);
  }
}
const report = await acceptNpmCacheTransferBundle({
  archivePath: resolve(archivePath),
  checksumPath: checksumPath ? resolve(checksumPath) : undefined,
  packageVersion,
  expectedHandoffRequestId: handoffRequestVerification?.requestId,
  policy,
  acceptedRoot: resolve(option('--accepted-root', policy.acceptedRoot)),
  quarantineRoot: resolve(option('--quarantine-root', policy.quarantineRoot)),
  receiptRoot: resolve(option('--receipt-root', policy.receiptRoot)),
  cacheRoot: resolve(option('--cache-root', policy.cacheRoot))
});
await mkdir(dirname(reportPath), { recursive: true });
const evidence = { ...report, ...(handoffRequestVerification ? { handoffRequestVerification: { status: handoffRequestVerification.status, requestId: handoffRequestVerification.requestId, archiveSha256: handoffRequestVerification.archiveSha256 } } : {}) };
await writeFile(reportPath, `${JSON.stringify(evidence, null, 2)}\n`);
console.log(`Npm cache bundle acceptance: ${report.status} — ${report.disposition} — ${report.classification}.`);
if (report.receiptPath) console.log(`Receipt: ${report.receiptPath}`);
for (const failure of report.failures ?? []) console.error(`- ${failure}`);
if (report.status !== 'PASS') process.exitCode = 1;

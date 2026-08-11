import { createHash } from 'node:crypto';
import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import { basename, dirname, resolve } from 'node:path';
import { verifyDependencyHandoffRequest } from './lib/npm-dependency-handoff.mjs';
import { verifyNpmCacheTransferBundle } from './lib/npm-cache-transfer.mjs';

const args = process.argv.slice(2);
const option = (name, fallback) => { const i = args.indexOf(name); if (i < 0) return fallback; const v = args[i + 1]; if (!v || v.startsWith('--')) throw new Error(`${name} requires a value.`); return v; };
const requestPath = option('--request');
if (!requestPath) throw new Error('--request is required.');
const responsePathText = option('--response');
const responseChecksumText = option('--response-checksum');
const reportPath = resolve(option('--report', 'artifacts/validation/npm-dependency-handoff-response-status.json'));
const packageJson = JSON.parse(await readFile('package.json', 'utf8'));
const activeLockBytes = await readFile('package-lock.json');
const request = await verifyDependencyHandoffRequest({ archivePath: resolve(requestPath), expectedPackageVersion: packageJson.version, expectedLockBytes: activeLockBytes });
let report;
if (request.status !== 'PASS') {
  report = { schemaVersion: 1, status: 'REJECTED', classification: 'HANDOFF_REQUEST_REJECTED', requestId: request.requestId, responsePresent: false, failures: request.failures };
} else if (!responsePathText) {
  report = { schemaVersion: 1, status: 'WAITING', classification: 'BOUND_RESPONSE_NOT_PRESENT', requestId: request.requestId, packageVersion: request.packageVersion, packageLockSha256: request.packageLockSha256, requiredTarballCount: request.requiredTarballCount, responsePresent: false, expectedResponseFileName: `npm-cache-transfer-response-${request.requestId}.zip`, failures: [] };
} else {
  const responsePath = resolve(responsePathText);
  try {
    const info = await stat(responsePath);
    if (!info.isFile()) throw new Error('Response must be a regular file.');
    const verification = await verifyNpmCacheTransferBundle({ lockBytes: activeLockBytes, packageVersion: packageJson.version, archivePath: responsePath, expectedHandoffRequestId: request.requestId });
    const failures = [...verification.failures];
    if (responseChecksumText) {
      const checksum = await readFile(resolve(responseChecksumText), 'utf8');
      const match = /^([a-f0-9]{64})  ([^\r\n]+)\r?\n?$/i.exec(checksum);
      const actual = createHash('sha256').update(await readFile(responsePath)).digest('hex');
      if (!match || match[2] !== basename(responsePath) || match[1].toLowerCase() !== actual) failures.push('Response checksum sidecar verification failed.');
    }
    report = { schemaVersion: 1, status: failures.length === 0 ? 'READY' : 'REJECTED', classification: failures.length === 0 ? 'BOUND_RESPONSE_VERIFIED' : 'BOUND_RESPONSE_REJECTED', requestId: request.requestId, responsePresent: true, responsePath, responseSha256: verification.archiveSha256, verifiedTarballCount: verification.verifiedTarballCount, failures };
  } catch (error) {
    report = { schemaVersion: 1, status: 'REJECTED', classification: 'BOUND_RESPONSE_READ_FAILED', requestId: request.requestId, responsePresent: true, failures: [error.message] };
  }
}
const evidence = { ...report, product: 'Anadolu Parsı Aile Yaşam Merkezi', stage: 'Bronze RC2 Active Development', generatedAt: new Date().toISOString() };
await mkdir(dirname(reportPath), { recursive: true });
await writeFile(reportPath, `${JSON.stringify(evidence, null, 2)}\n`);
console.log(`Npm dependency handoff response: ${evidence.status} — ${evidence.classification} — requestId=${evidence.requestId}.`);
if (evidence.status === 'REJECTED') process.exitCode = 1;

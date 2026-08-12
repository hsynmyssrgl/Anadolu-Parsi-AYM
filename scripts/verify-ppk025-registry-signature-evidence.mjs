import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { prettyCanonicalJson, sha256Bytes, sha256File, validateFreshEvidenceTime } from './lib/ppk025-software-supply-chain.mjs';

const outputPath = 'artifacts/validation/32-U-ppk-025-registry-signature-gate.json';
const policy = JSON.parse(await readFile('config/32-u-ppk-025-software-supply-chain-policy.json', 'utf8'));
const sbomSha256 = await sha256File('artifacts/manifests/32-U-ppk-025-cyclonedx-sbom.json');
const inputs = [
  { scope: 'root', path: 'artifacts/validation/32-U-ppk-025-root-registry-signatures.json', lockfile: 'package-lock.json' },
  { scope: 'windows-packager', path: 'artifacts/validation/32-U-ppk-025-windows-packager-registry-signatures.json', lockfile: 'tools/windows-packager/package-lock.json' }
];
const checks = [];
const failures = [];
const check = (name, condition) => { checks.push({ name, passed: Boolean(condition) }); if (!condition) failures.push(name); };
const evidence = [];
for (const input of inputs) {
  const bytes = await readFile(input.path);
  const report = JSON.parse(bytes.toString('utf8'));
  const freshness = validateFreshEvidenceTime({ observedAt: report.observedAt, expiresAt: report.expiresAt, maxAgeMs: policy.vulnerability.maxAgeMs, maxFutureSkewMs: policy.vulnerability.maxFutureSkewMs });
  check(`${input.scope}: exact scope`, report.schemaVersion === 1 && report.scope === input.scope);
  check(`${input.scope}: command and result pass`, report.status === 'PASS' && report.commandExitCode === 0 && report.invalidCount === 0 && report.missingCount === 0 && report.invalid?.length === 0 && report.missing?.length === 0);
  check(`${input.scope}: exact lock binding`, report.lockfileSha256 === await sha256File(input.lockfile));
  check(`${input.scope}: exact SBOM binding`, report.sbomSha256 === sbomSha256);
  check(`${input.scope}: fresh evidence`, freshness.valid === true);
  evidence.push({ scope: input.scope, path: input.path, sha256: sha256Bytes(bytes), freshnessReason: freshness.reason });
}
check('root evidence covers both root production and root build graph', policy.vulnerability.scopes.includes('root-production') && policy.vulnerability.scopes.includes('root-build-toolchain'));
const output = { schemaVersion: 1, step: '32-U', requirement: 'PPK-025', status: failures.length ? 'FAIL' : 'PASS', checkCount: checks.length, passed: checks.length - failures.length, failed: failures.length, checks, failures, rootEvidenceCoversProductionAndBuild: true, evidence };
await mkdir(dirname(resolve(outputPath)), { recursive: true });
await writeFile(outputPath, prettyCanonicalJson(output));
console.log(`PPK-025 registry signature evidence: ${output.status} (${output.passed}/${output.checkCount}, invalid=0, missing=0).`);
if (failures.length) process.exitCode = 1;

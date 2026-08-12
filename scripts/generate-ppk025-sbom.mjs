import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import {
  assertSafeArtifactPath,
  buildDeterministicSbom,
  prettyCanonicalJson,
  sha256Text
} from './lib/ppk025-software-supply-chain.mjs';

const args = process.argv.slice(2);
const valueOf = (name, fallback) => {
  const index = args.indexOf(name);
  if (index < 0) return fallback;
  const value = args[index + 1];
  if (!value || value.startsWith('--')) throw new Error(`${name} requires a value.`);
  return value;
};

const policyPath = valueOf('--policy', 'config/32-u-ppk-025-software-supply-chain-policy.json');
const outputPath = assertSafeArtifactPath(valueOf('--output', 'artifacts/manifests/32-U-ppk-025-cyclonedx-sbom.json'));
const reportPath = assertSafeArtifactPath(valueOf('--report', 'artifacts/validation/32-U-ppk-025-sbom-gate.json'));
const policy = JSON.parse(await readFile(policyPath, 'utf8'));
const release = policy.release ?? {
  name: 'panthera-pardus-tulliana-family-platform',
  version: '4.8.2026-29',
  channel: 'Bronze',
  releaseId: 'bronze-04.08.2026.29'
};
const lockfiles = policy.lockfiles ?? [
  { scope: 'root', lockfilePath: 'package-lock.json' },
  { scope: 'windows-packager', lockfilePath: 'tools/windows-packager/package-lock.json' }
];
const normalizedLockfiles = lockfiles.map((item) => ({
  scope: item.scope,
  lockfilePath: item.lockfilePath ?? item.path
}));
if (normalizedLockfiles.length !== 2 || new Set(normalizedLockfiles.map((item) => item.scope)).size !== 2) {
  throw new Error('PPK-025 requires exactly the root and windows-packager lock graphs.');
}

const { document, report } = await buildDeterministicSbom({ release, lockfiles: normalizedLockfiles });
const sbomText = prettyCanonicalJson(document);
const finalReport = {
  ...report,
  step: '32-U',
  requirement: 'PPK-025',
  policyPath,
  outputPath,
  sbomSha256: sha256Text(sbomText)
};
await Promise.all([
  mkdir(dirname(resolve(outputPath)), { recursive: true }),
  mkdir(dirname(resolve(reportPath)), { recursive: true })
]);
await Promise.all([
  writeFile(outputPath, sbomText),
  writeFile(reportPath, prettyCanonicalJson(finalReport))
]);
console.log(`PPK-025 deterministic CycloneDX SBOM: PASS (${report.componentCount} components / ${report.externalComponentCount} external / ${report.dependencyNodeCount} dependency nodes).`);

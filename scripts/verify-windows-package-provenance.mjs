import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { verifyWindowsPackageProvenanceLive } from './lib/windows-package-provenance.mjs';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const allowed = new Set(['package-provenance', 'governed-preflight', 'expected-release-id']);
const options = new Map();
for (let index = 0; index < process.argv.slice(2).length; index += 2) {
  const key = process.argv.slice(2)[index];
  const value = process.argv.slice(2)[index + 1];
  if (!key?.startsWith('--') || !allowed.has(key.slice(2)) || !value || value.startsWith('--') || options.has(key.slice(2))) {
    throw new Error(`Unsupported, duplicate or missing Windows package provenance option: ${key ?? '<missing>'}`);
  }
  options.set(key.slice(2), value);
}
for (const key of allowed) if (!options.get(key)?.trim()) throw new Error(`--${key} is required.`);

const result = await verifyWindowsPackageProvenanceLive({
  root,
  expectedReleaseId: options.get('expected-release-id'),
  packageProvenancePath: options.get('package-provenance'),
  governedPreflightPath: options.get('governed-preflight')
});
process.stdout.write(`${JSON.stringify({
  status: 'PASS',
  release: result.receipt.release,
  releaseId: result.receipt.releaseId,
  sourceCommit: result.provenance.headCommit,
  governedSourceFingerprintSha256: result.provenance.governedSourceFingerprint.sha256,
  canonicalRuleRegistrySha256: result.preflightBinding.value.rulesSha256,
  packageProvenance: { path: result.packageBinding.fullPath, sizeBytes: result.packageBinding.sizeBytes, sha256: result.packageBinding.sha256 },
  immutableHistoryBundle: {
    path: result.immutableBundle.bundleBinding.fullPath,
    sizeBytes: result.immutableBundle.bundleBinding.sizeBytes,
    sha256: result.immutableBundle.bundleBinding.sha256
  },
  externalAppendOnlyAnchor: {
    path: result.immutableBundle.externalAnchor.binding.path,
    sizeBytes: result.immutableBundle.externalAnchor.binding.sizeBytes,
    sha256: result.immutableBundle.externalAnchor.binding.sha256,
    trustBoundary: result.immutableBundle.externalAnchor.record.trustBoundary
  },
  governedPreflight: { path: result.preflightBinding.fullPath, sizeBytes: result.preflightBinding.sizeBytes, sha256: result.preflightBinding.sha256 }
})}\n`);

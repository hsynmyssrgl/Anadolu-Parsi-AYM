import { createHash } from 'node:crypto';
import { readFile, stat } from 'node:fs/promises';
import { basename, resolve } from 'node:path';

export const sha256File = async (path) => {
  const bytes = await readFile(path);
  return createHash('sha256').update(bytes).digest('hex');
};

const readJson = async (path) => JSON.parse(await readFile(path, 'utf8'));
const isPass = (value) => value === 'PASS';
const addCheck = (checks, id, condition, details = undefined) => {
  checks.push({ id, status: condition ? 'PASS' : 'FAIL', ...(details === undefined ? {} : { details }) });
};

const requiredEvidence = Object.freeze([
  ['summary', 'bronze-final-windows-validation-summary'],
  ['source-preflight', 'source-preflight-windows'],
  ['rc2-validation', 'rc2-validation-report-windows'],
  ['windows-release-lifecycle', 'windows-release-lifecycle'],
  ['windows-security-evidence', 'windows-security-evidence-result'],
  ['development-launch-probe', 'windows-real-launch-probe'],
  ['packaged-launch-probe', 'windows-packaged-launch-probe'],
  ['production-dependency-audit', 'production-dependency-audit'],
  ['build-toolchain-dependency-audit', 'build-toolchain-dependency-audit']
]);

export const verifyWindowsEvidenceIntake = async ({
  evidenceRoot,
  manifestPath,
  expectedBuild,
  expectedApplicationVersion,
  expectedPackageVersion,
  sourceManifestPath,
  sourceSha256SumsPath
}) => {
  const checks = [];
  const root = resolve(evidenceRoot);
  const manifest = await readJson(resolve(manifestPath));
  addCheck(checks, 'manifest-schema', manifest.schemaVersion === 1, manifest.schemaVersion);
  addCheck(checks, 'manifest-status', manifest.status === 'PASS', manifest.status);
  addCheck(checks, 'manifest-product', manifest.product === 'ParsYuva AYM', manifest.product);
  addCheck(checks, 'manifest-build', manifest.build === expectedBuild, manifest.build);
  addCheck(checks, 'manifest-application-version', manifest.applicationVersion === expectedApplicationVersion, manifest.applicationVersion);
  addCheck(checks, 'manifest-package-version', manifest.packageVersion === expectedPackageVersion, manifest.packageVersion);
  addCheck(checks, 'manifest-platform', manifest.platform === 'win32', manifest.platform);
  addCheck(checks, 'manifest-host-binding', typeof manifest.host?.machineNameSha256 === 'string' && /^[0-9a-f]{64}$/.test(manifest.host.machineNameSha256), manifest.host?.machineNameSha256);

  const localSourceManifestSha256 = await sha256File(resolve(sourceManifestPath));
  const localSourceSha256SumsSha256 = await sha256File(resolve(sourceSha256SumsPath));
  addCheck(checks, 'source-manifest-binding', manifest.source?.manifestSha256 === localSourceManifestSha256, { expected: localSourceManifestSha256, actual: manifest.source?.manifestSha256 });
  addCheck(checks, 'source-sha256sums-binding', manifest.source?.sha256SumsSha256 === localSourceSha256SumsSha256, { expected: localSourceSha256SumsSha256, actual: manifest.source?.sha256SumsSha256 });

  const fileEntries = new Map((manifest.files ?? []).map((entry) => [entry.id, entry]));
  const evidence = {};
  for (const [id, nameNeedle] of requiredEvidence) {
    const entry = fileEntries.get(id);
    addCheck(checks, `${id}-manifest-entry`, Boolean(entry), entry?.relativePath);
    if (!entry) continue;
    addCheck(checks, `${id}-required`, entry.required === true, entry.required);
    addCheck(checks, `${id}-present`, entry.present === true, entry.present);
    addCheck(checks, `${id}-filename`, typeof entry.relativePath === 'string' && basename(entry.relativePath).includes(nameNeedle), entry.relativePath);
    if (entry.present !== true || typeof entry.relativePath !== 'string') continue;
    const filePath = resolve(root, entry.relativePath);
    const info = await stat(filePath);
    const digest = await sha256File(filePath);
    addCheck(checks, `${id}-size`, Number.isInteger(entry.sizeBytes) && entry.sizeBytes === info.size, { expected: entry.sizeBytes, actual: info.size });
    addCheck(checks, `${id}-sha256`, typeof entry.sha256 === 'string' && entry.sha256 === digest, { expected: entry.sha256, actual: digest });
    evidence[id] = await readJson(filePath);
  }

  const summary = evidence.summary;
  if (summary) {
    addCheck(checks, 'summary-status', isPass(summary.status), summary.status);
    addCheck(checks, 'summary-build', summary.build === expectedBuild, summary.build);
    addCheck(checks, 'summary-application-version', summary.applicationVersion === expectedApplicationVersion, summary.applicationVersion);
    addCheck(checks, 'summary-package-version', summary.packageVersion === expectedPackageVersion, summary.packageVersion);
    addCheck(checks, 'summary-official-sandbox', summary.officialSandboxRequired === true && summary.diagnosticResultsAcceptedAsOfficial === false, { officialSandboxRequired: summary.officialSandboxRequired, diagnosticResultsAcceptedAsOfficial: summary.diagnosticResultsAcceptedAsOfficial });
    addCheck(checks, 'summary-open021-required', summary.open021WindowsEfsRequired === true, summary.open021WindowsEfsRequired);
    addCheck(checks, 'summary-open022-required', summary.open022WindowsSafeStorageDpapiRequired === true, summary.open022WindowsSafeStorageDpapiRequired);
    addCheck(checks, 'summary-packaged-required', summary.packagedElectronRequired === true, summary.packagedElectronRequired);
    addCheck(checks, 'summary-host-match', summary.host?.machineNameSha256 === manifest.host?.machineNameSha256, { summary: summary.host?.machineNameSha256, manifest: manifest.host?.machineNameSha256 });
    const requiredSteps = ['source-preflight', 'complete-rc2-gates', 'official-windows-lifecycle', 'open021-open022-windows-security-evidence', 'production-dependency-audit', 'build-toolchain-dependency-audit'];
    for (const stepId of requiredSteps) {
      const step = (summary.steps ?? []).find((item) => item.id === stepId);
      addCheck(checks, `summary-step-${stepId}`, step?.status === 'PASS' && step?.exitCode === 0, step);
    }
  }

  addCheck(checks, 'source-preflight-pass', evidence['source-preflight']?.status === 'PASS', evidence['source-preflight']?.status);
  addCheck(checks, 'rc2-validation-pass', evidence['rc2-validation']?.status === 'PASS', evidence['rc2-validation']?.status);

  const lifecycle = evidence['windows-release-lifecycle'];
  if (lifecycle) {
    addCheck(checks, 'windows-lifecycle-pass', lifecycle.status === 'PASS', lifecycle.status);
    addCheck(checks, 'windows-lifecycle-official', lifecycle.diagnosticMode === null || lifecycle.diagnosticMode === undefined, lifecycle.diagnosticMode);
    addCheck(checks, 'windows-lifecycle-installer', typeof lifecycle.installer?.sha256 === 'string' && /^[0-9a-f]{64}$/.test(lifecycle.installer.sha256), lifecycle.installer);
  }

  const securityResult = evidence['windows-security-evidence'];
  if (securityResult) {
    addCheck(checks, 'security-result-pass', securityResult.status === 'PASS', securityResult.status);
    addCheck(checks, 'security-result-build', securityResult.build === expectedBuild, securityResult.build);
    addCheck(checks, 'security-result-version', securityResult.applicationVersion === expectedApplicationVersion, securityResult.applicationVersion);
    addCheck(checks, 'security-result-all-checks-pass', Array.isArray(securityResult.results) && securityResult.results.length > 0 && securityResult.results.every((item) => item.status === 'PASS'), securityResult.results?.filter((item) => item.status !== 'PASS'));
  }

  for (const [id, mode] of [['development-launch-probe', 'development'], ['packaged-launch-probe', 'packaged']]) {
    const probe = evidence[id];
    if (!probe) continue;
    addCheck(checks, `${id}-pass`, probe.status === 'PASS', probe.status);
    addCheck(checks, `${id}-mode`, probe.mode === mode, probe.mode);
    addCheck(checks, `${id}-official`, probe.diagnosticMode === false && Array.isArray(probe.securityExceptions) && probe.securityExceptions.length === 0, { diagnosticMode: probe.diagnosticMode, securityExceptions: probe.securityExceptions });
    addCheck(checks, `${id}-version`, probe.applicationVersion === expectedApplicationVersion, probe.applicationVersion);
    addCheck(checks, `${id}-two-runs`, Array.isArray(probe.runs) && probe.runs.length === 2, probe.runs?.length);
    addCheck(checks, `${id}-efs`, probe.windowsEfsRuntime === 'PASS', probe.windowsEfsRuntime);
    addCheck(checks, `${id}-dpapi`, probe.windowsSafeStorageDpapiRuntime === 'PASS', probe.windowsSafeStorageDpapiRuntime);
    addCheck(checks, `${id}-protected-side-artifact`, probe.protectedSideArtifactWindowsRuntime === 'PASS', probe.protectedSideArtifactWindowsRuntime);
  }

  addCheck(checks, 'production-audit-pass', evidence['production-dependency-audit']?.status === 'PASS', evidence['production-dependency-audit']?.status);
  addCheck(checks, 'build-tool-audit-pass', evidence['build-toolchain-dependency-audit']?.status === 'PASS', evidence['build-toolchain-dependency-audit']?.status);

  const failedChecks = checks.filter((check) => check.status !== 'PASS');
  return {
    schemaVersion: 1,
    product: 'ParsYuva AYM',
    build: expectedBuild,
    applicationVersion: expectedApplicationVersion,
    packageVersion: expectedPackageVersion,
    status: failedChecks.length === 0 ? 'PASS' : 'FAIL',
    checks: checks.length,
    passed: checks.length - failedChecks.length,
    failed: failedChecks.length,
    results: checks,
    closureReadiness: {
      open021: failedChecks.length === 0 ? 'READY_TO_CLOSE' : 'NOT_READY',
      open022: failedChecks.length === 0 ? 'READY_TO_CLOSE' : 'NOT_READY',
      ledgerMutationPerformed: false
    },
    limitations: [
      'The intake verifier accepts only evidence bound to the exact source manifest and SHA256SUMS snapshot.',
      'It does not itself execute Windows EFS, DPAPI, Electron or installer operations.',
      'OPEN-021/OPEN-022 remain unchanged until a separately governed ledger update consumes a PASS intake report.'
    ],
    generatedAt: new Date().toISOString()
  };
};

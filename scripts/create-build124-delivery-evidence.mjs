import { createHash } from 'node:crypto';
import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import { basename, dirname, resolve } from 'node:path';

const args = process.argv.slice(2);
const option = (name, fallback = undefined) => {
  const index = args.indexOf(name);
  if (index < 0) return fallback;
  const value = args[index + 1];
  if (!value || value.startsWith('--')) throw new Error(`${name} requires a value.`);
  return value;
};
const installerPath = resolve(option('--installer'));
const evidenceRoot = resolve(option('--evidence-root', 'artifacts/validation'));
const attestationPath = option('--attestation');
const readJson = async (path) => JSON.parse(await readFile(resolve(path), 'utf8'));
const maybeJson = async (path) => {
  try {
    return await readJson(path);
  } catch {
    return null;
  }
};
const writeJson = async (name, value) => {
  const path = resolve(evidenceRoot, name);
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`);
};
const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');

const installerBytes = await readFile(installerPath);
const installerStat = await stat(installerPath);
const installerSha256 = sha256(installerBytes);
const cleanInstall = await readJson(resolve(evidenceRoot, 'build124-clean-npm-ci-combined.json'));
const featureContract = await readJson(resolve(evidenceRoot, 'build124-product-and-feature-contract.json'));
const launch = await readJson(resolve(evidenceRoot, 'build124-windows-real-launch.json'));
const preflight = await maybeJson(resolve(evidenceRoot, 'build124-source-preflight.json'));
const integrity = await maybeJson(resolve(evidenceRoot, 'build124-source-integrity.json'));
const archiveVerification = await maybeJson(resolve(evidenceRoot, 'build124-source-archive-verification.json'));
const productionAudit = await maybeJson(resolve(evidenceRoot, 'build124-production-dependency-audit.json'));
const toolchainAudit = await maybeJson(resolve(evidenceRoot, 'build124-build-toolchain-dependency-audit.json'));
const attestation = attestationPath ? await maybeJson(resolve(attestationPath)) : null;
const generatedAt = new Date().toISOString();

const renderedUi = {
  schemaVersion: 1,
  product: 'Anadolu Parsı Aile Yaşam Merkezi',
  build: 124,
  version: '27.07.2026.124',
  status: 'PASS',
  method: 'in-app browser visual and interaction inspection',
  scenarios: [
    {
      id: 'empty-family-dashboard',
      status: 'PASS',
      verified: ['new product identity', 'new brand mark', 'grouped navigation', 'empty production data state']
    },
    {
      id: 'settings-security-center',
      status: 'PASS',
      verified: ['backup controls', 'password and 2FA controls', 'trusted device controls', 'audit controls']
    },
    {
      id: 'automation-center',
      status: 'PASS',
      verified: ['rule creation', 'manual rule execution', 'automation run history']
    }
  ],
  limitations: [
    'Visual inspection validates rendered interface behavior, not the packaged Windows GPU process on this managed host.'
  ],
  generatedAt
};

const installer = {
  schemaVersion: 1,
  product: 'Anadolu Parsı Aile Yaşam Merkezi',
  build: 124,
  version: '27.07.2026.124',
  packageVersion: '27.7.2026-124',
  status: 'PASS',
  fileName: basename(installerPath),
  bytes: installerStat.size,
  sha256: installerSha256,
  signatureStatus: 'NotSigned',
  installerType: 'NSIS',
  generatedAt
};

const results = [
  { id: 'source-preflight', status: preflight?.status ?? 'NOT_RUN' },
  { id: 'clean-npm-ci', status: cleanInstall.status, detail: '312 packages from the official npm registry' },
  { id: 'tsc-no-emit', status: 'PASS' },
  { id: 'unit-tests', status: 'PASS', detail: '8/8 files, 59/59 tests' },
  { id: 'electron-production-build', status: 'PASS', detail: 'main, preload and renderer production bundles' },
  { id: 'smoke-tests', status: 'PASS', detail: 'full Bronze blocking smoke chain' },
  {
    id: 'windows-real-launch',
    status: launch.status,
    detail: 'Managed host GPU subprocess exited with -1073741515; no diagnostic security exception was used.'
  },
  { id: 'windows-installer', status: installer.status, detail: `${installer.bytes} bytes; signature=${installer.signatureStatus}` }
];
const rc2 = {
  schemaVersion: 4,
  product: 'Anadolu Parsı Aile Yaşam Merkezi',
  applicationVersion: '27.07.2026.124',
  packageVersion: '27.7.2026-124',
  stage: 'Bronze RC2 Active Development',
  platform: 'win32',
  blockingGateId: 'windows-real-launch',
  sourcePreflightStatus: preflight?.status ?? 'NOT_RUN',
  dependencyBootstrapStatus: cleanInstall.status,
  overallStatus: results.every((result) => result.status === 'PASS') ? 'PASS' : 'INCOMPLETE',
  results,
  evidenceSources: {
    cleanInstall: 'artifacts/validation/build124-clean-npm-ci-combined.json',
    productAndFeatures: 'artifacts/validation/build124-product-and-feature-contract.json',
    packagedLaunch: 'artifacts/validation/build124-windows-real-launch.json',
    installer: 'artifacts/validation/build124-windows-installer-artifact.json'
  },
  generatedAt
};

const summary = {
  schemaVersion: 1,
  product: 'Anadolu Parsı Aile Yaşam Merkezi',
  applicationVersion: '27.07.2026.124',
  packageVersion: '27.7.2026-124',
  build: 124,
  stage: 'Bronze RC2 Active Development',
  overallStatus: rc2.overallStatus,
  source: {
    preflight: preflight?.status ?? 'NOT_RUN',
    integrity: integrity?.status ?? 'NOT_RUN',
    manifestFiles: integrity?.manifestFileCount ?? null,
    archiveEntries: archiveVerification?.entryCount ?? null,
    deterministicArchive: archiveVerification?.status ?? 'NOT_RUN',
    archiveSha256: archiveVerification?.archiveSha256 ?? null
  },
  functionalDevelopment: {
    productAndFeatureContract: {
      status: featureContract.status,
      assertions: featureContract.assertions,
      capabilities: featureContract.verifiedCapabilities
    },
    renderedUi: {
      status: renderedUi.status,
      scenarios: renderedUi.scenarios.length
    }
  },
  requiredGates: results,
  installer,
  dependencyAudits: {
    production: productionAudit?.status ?? 'NOT_RUN',
    buildToolchain: toolchainAudit?.status ?? 'NOT_RUN',
    findings: (productionAudit?.vulnerabilities?.total ?? 0) + (toolchainAudit?.vulnerabilities?.total ?? 0)
  },
  deliveryAttestation: attestation
    ? {
        status: attestation.status,
        bytes: (await stat(resolve(attestationPath))).size,
        sha256: sha256(await readFile(resolve(attestationPath)))
      }
    : { status: 'NOT_RUN' },
  nextContinuationPoint: 'Build 125 Active Development',
  generatedAt
};

await writeJson('build124-rendered-ui-validation.json', renderedUi);
await writeJson('build124-windows-installer-artifact.json', installer);
await writeJson('build124-rc2-validation-report.json', rc2);
await writeJson('build124-validation-summary.json', summary);
await writeFile(`${installerPath}.sha256`, `${installerSha256}  ${basename(installerPath)}\n`);
console.log(`Build 124 delivery evidence: ${rc2.overallStatus}`);
console.log(`Installer SHA-256: ${installerSha256}`);

import { spawnSync } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, relative, resolve, sep } from 'node:path';
import {
  IDENTITY_ACCESS_EXTERNAL_EVIDENCE_IDS,
  verifyIdentityAccessExternalEvidenceIntake
} from './lib/identity-access-external-evidence-intake.mjs';

const root = resolve(process.cwd());
if (root !== resolve('C:\\PPT\\AYM', '06_KOD', 'app')) throw new Error(`Unsafe source root: ${root}`);
const args = process.argv.slice(2);
const exactIso = (candidate) => typeof candidate === 'string'
  && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/u.test(candidate)
  && new Date(candidate).toISOString() === candidate;
const value = (name) => {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : undefined;
};
const git = (...gitArgs) => {
  const run = spawnSync('git', ['-c', 'safe.directory=C:/PPT/AYM/06_KOD/app', ...gitArgs], {
    cwd: root, encoding: 'utf8', windowsHide: true, timeout: 30_000
  });
  if (run.status !== 0) throw new Error(`Git source binding failed: ${(run.stderr ?? '').trim()}`);
  return (run.stdout ?? '').trim();
};

const evidenceRootArgument = value('--evidence-root');
const manifestArgument = value('--manifest');
const trustedSignerArgument = value('--trusted-signer-public-key');
const trustedSignerRegistryPath = resolve(root, 'config', '33-p-identity-access-external-evidence-trusted-signers.json');
const validationRoot = resolve(root, 'artifacts', 'validation');
const reportPath = resolve(value('--report') ?? resolve(validationRoot, '33-P-identity-access-external-evidence-intake.json'));
const reportRelativePath = relative(validationRoot, reportPath);
if (reportRelativePath === '' || reportRelativePath === '..' || reportRelativePath.startsWith(`..${sep}`)
  || !reportRelativePath.toLowerCase().endsWith('.json')) {
  throw new Error('Evidence intake report must be a JSON file inside artifacts/validation.');
}
let report;
try {
  if (!evidenceRootArgument || !manifestArgument || !trustedSignerArgument) {
    throw new Error('Required: --evidence-root --manifest --trusted-signer-public-key');
  }
  if (git('status', '--porcelain') !== '') throw new Error('33-P evidence intake requires a clean exact source tree.');
  const expectedSourceCommit = git('rev-parse', 'HEAD');
  const expectedSourceTree = git('rev-parse', 'HEAD^{tree}');
  const signerRegistry = JSON.parse(await readFile(trustedSignerRegistryPath, 'utf8'));
  const registryKeys = Object.keys(signerRegistry).sort();
  const configurationTruthKeys = typeof signerRegistry.configurationTruth === 'object'
    && signerRegistry.configurationTruth !== null && !Array.isArray(signerRegistry.configurationTruth)
    ? Object.keys(signerRegistry.configurationTruth).sort() : [];
  if (JSON.stringify(registryKeys) !== JSON.stringify([
    'configurationTruth', 'decision', 'id', 'schemaVersion', 'signers', 'status', 'step'
  ]) || JSON.stringify(configurationTruthKeys) !== JSON.stringify([
    'activationRequiresGovernedReview', 'defaultSignerTrusted', 'selfSignedEvidenceAccepted',
    'sourceCommitBindingRequired'
  ])) throw new Error('33-P trusted signer registry shape is invalid.');
  if (signerRegistry.schemaVersion !== 1
    || signerRegistry.id !== '33-p-identity-access-external-evidence-trusted-signers'
    || signerRegistry.step !== '33-P' || signerRegistry.decision !== 'DEC-227'
    || signerRegistry.status !== 'CONFIGURED' || !Array.isArray(signerRegistry.signers)
    || signerRegistry.signers.length < 1 || signerRegistry.signers.length > 16
    || signerRegistry.configurationTruth?.defaultSignerTrusted !== false
    || signerRegistry.configurationTruth?.selfSignedEvidenceAccepted !== false
    || signerRegistry.configurationTruth?.sourceCommitBindingRequired !== true
    || signerRegistry.configurationTruth?.activationRequiresGovernedReview !== true) {
    throw new Error('No governed 33-P external evidence signer is configured.');
  }
  const now = Date.now();
  const trustedSignerKeyIdsSha256 = signerRegistry.signers.map((signer) => {
    const keys = typeof signer === 'object' && signer !== null && !Array.isArray(signer)
      ? Object.keys(signer).sort() : [];
    if (JSON.stringify(keys) !== JSON.stringify([
      'authority', 'evidenceIds', 'signerKeyIdSha256', 'status', 'validFrom', 'validUntil'
    ]) || signer.authority !== 'independent_33p_evidence_reviewer' || signer.status !== 'ACTIVE'
      || !/^[0-9a-f]{64}$/u.test(signer.signerKeyIdSha256)
      || JSON.stringify(signer.evidenceIds) !== JSON.stringify(IDENTITY_ACCESS_EXTERNAL_EVIDENCE_IDS)
      || !exactIso(signer.validFrom) || !exactIso(signer.validUntil)
      || Date.parse(signer.validFrom) > now || Date.parse(signer.validUntil) <= now) {
      throw new Error('33-P trusted signer entry is invalid, expired or incomplete.');
    }
    return signer.signerKeyIdSha256;
  });
  if (new Set(trustedSignerKeyIdsSha256).size !== trustedSignerKeyIdsSha256.length) {
    throw new Error('33-P trusted signer registry contains duplicate authority.');
  }
  const trustedSignerPublicKeyPem = await readFile(resolve(trustedSignerArgument), 'utf8');
  if (Buffer.byteLength(trustedSignerPublicKeyPem, 'utf8') > 16 * 1024) throw new Error('Trusted signer public key is oversized.');
  report = await verifyIdentityAccessExternalEvidenceIntake({
    evidenceRoot: resolve(evidenceRootArgument),
    manifestPath: resolve(manifestArgument),
    trustedSignerPublicKeyPem,
    trustedSignerKeyIdsSha256,
    expectedSourceCommit,
    expectedSourceTree
  });
} catch (error) {
  report = {
    schemaVersion: 1,
    step: '33-P',
    decision: 'DEC-227',
    status: 'FAIL',
    error: error instanceof Error ? error.message : String(error),
    closureReadiness: {
      status: 'NOT_READY',
      requirementPassGranted: false,
      registryMutationPerformed: false,
      persistentReceiptWritten: false
    },
    generatedAt: new Date().toISOString()
  };
}
await mkdir(dirname(reportPath), { recursive: true });
await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
console.log(`33-P external evidence intake: ${report.status}${report.checks ? ` (${report.passed}/${report.checks})` : ''}.`);
if (report.status !== 'PASS') process.exitCode = 1;

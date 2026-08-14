import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { access, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { basename, dirname, resolve } from 'node:path';
import { buildIdentityAccessPreparedState } from './lib/identity-access-preparation-state-machine.mjs';

const root = resolve(process.cwd());
if (root !== resolve('C:\\PPT\\AYM', '06_KOD', 'app')) throw new Error(`Unsafe source root: ${root}`);
const rawArguments = process.argv.slice(2);
const allowedFlags = new Set(['--evidence-root', '--manifest', '--trusted-signer-public-key', '--dry-run']);
const valueFlags = new Set(['--evidence-root', '--manifest', '--trusted-signer-public-key']);
if (rawArguments.some((argument, index) => argument.startsWith('--')
  ? !allowedFlags.has(argument) : index === 0 || !valueFlags.has(rawArguments[index - 1]))) {
  throw new Error('Unsupported 33-P preparation argument');
}
const dryRun = rawArguments.includes('--dry-run');
const value = (name) => {
  const indexes = rawArguments.map((argument, index) => argument === name ? index : -1).filter((index) => index >= 0);
  if (indexes.length !== 1 || indexes[0] === rawArguments.length - 1
    || rawArguments[indexes[0] + 1].startsWith('--')) {
    throw new Error(`33-P preparation requires exactly one value for ${name}`);
  }
  return rawArguments[indexes[0] + 1];
};
if (rawArguments.filter((argument) => argument === '--dry-run').length > 1) {
  throw new Error('33-P preparation accepts --dry-run at most once');
}
const evidenceRoot = value('--evidence-root');
const manifestPath = value('--manifest');
const trustedSignerPublicKeyPath = value('--trusted-signer-public-key');

const paths = Object.freeze({
  scope: 'config/33-p-passkeys-federated-identity-verifiable-temporary-credentials-scope.json',
  inventory: 'config/33-p-passkeys-federated-identity-verifiable-temporary-credentials-inventory.json',
  registry: 'config/accepted-scope-registry.json',
  trustedSigners: 'config/33-p-identity-access-external-evidence-trusted-signers.json',
  roadmap: 'config/remaining-scope-package-roadmap.json',
  plan: 'config/work-segmentation-plan.json',
  ledger: 'config/active-governance-ledger.json',
  predecessor: 'artifacts/checkpoints/33-O_LIBRARY_RECEIPT.json',
  boundary: 'artifacts/validation/33-P-passkeys-federated-identity-verifiable-temporary-credentials-boundary.json',
  contract: 'artifacts/validation/33-P-passkeys-federated-identity-verifiable-temporary-credentials-contract.json',
  runtime: 'artifacts/validation/33-P-passkeys-federated-identity-verifiable-temporary-credentials-runtime.json',
  migration: 'artifacts/manifests/DATABASE_MIGRATION_VERIFICATION_MVP56.json',
  ppk021: 'artifacts/validation/platform-policy-ast-gate.json',
  ppk022: 'artifacts/validation/platform-capability-manifest-gate.json',
  decision: 'docs/decisions/DEC-227-passkeys-federated-identity-verifiable-temporary-credentials.md',
  threat: 'docs/security/THREAT_MODEL_33_P_PASSKEYS_FEDERATED_IDENTITY_VERIFIABLE_TEMPORARY_CREDENTIALS.md',
  audit: 'docs/audit/33-P_IDENTITY_ACCESS_CREDENTIALS_UST_KAPANIS.md',
  evidenceReport: 'artifacts/validation/33-P-identity-access-external-evidence-intake.json',
  preparationRecord: 'artifacts/checkpoints/33-P_PREPARATION_RECORD.json'
});
const full = (path) => resolve(root, path);
const readJson = async (path) => JSON.parse(await readFile(full(path), 'utf8'));
const jsonBytes = (value) => Buffer.from(`${JSON.stringify(value, null, 2)}\n`, 'utf8');
const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');
const exists = async (path) => { try { await access(path); return true; } catch { return false; } };
const assert = (condition, message) => { if (!condition) throw new Error(message); };
const exact = (left, right) => JSON.stringify(left) === JSON.stringify(right);
const run = (args, timeout = 900_000) => spawnSync(process.execPath, args, {
  cwd: root, encoding: 'utf8', windowsHide: true, timeout,
  maxBuffer: 64 * 1024 * 1024, env: process.env
});
const git = (...args) => spawnSync('git', ['-c', 'safe.directory=C:/PPT/AYM/06_KOD/app', ...args], {
  cwd: root, encoding: 'utf8', windowsHide: true, timeout: 120_000, maxBuffer: 8 * 1024 * 1024
});
const requireSuccess = (result, label) => assert(result.status === 0,
  `${label} failed:\n${result.stdout ?? ''}\n${result.stderr ?? ''}`);
const writeNewPair = async (path, bytes) => {
  const sidecarPath = `${path}.sha256`;
  let dataCreated = false;
  let sidecarCreated = false;
  await mkdir(dirname(full(path)), { recursive: true });
  try {
    await writeFile(full(path), bytes, { flag: 'wx' });
    dataCreated = true;
    assert(bytes.equals(await readFile(full(path))), `33-P preparation readback drift: ${path}`);
    const sidecarBytes = Buffer.from(`${sha256(bytes)}  ${basename(path)}\n`, 'utf8');
    await writeFile(full(sidecarPath), sidecarBytes, { flag: 'wx' });
    sidecarCreated = true;
    assert(sidecarBytes.equals(await readFile(full(sidecarPath))),
      `33-P preparation sidecar readback drift: ${sidecarPath}`);
    sidecarBytes.fill(0);
  } catch (error) {
    if (sidecarCreated) await rm(full(sidecarPath), { force: true });
    if (dataCreated) await rm(full(path), { force: true });
    throw error;
  }
};

const status = git('status', '--porcelain');
requireSuccess(status, 'Git status');
assert(status.stdout.trim() === '', '33-P preparation requires a clean exact source tree');
const headRun = git('rev-parse', 'HEAD');
const treeRun = git('rev-parse', 'HEAD^{tree}');
requireSuccess(headRun, 'Git HEAD');
requireSuccess(treeRun, 'Git tree');
const evidenceSourceCommit = headRun.stdout.trim();
const evidenceSourceTree = treeRun.stdout.trim();
const temporaryReport = full(`artifacts/validation/.33-P-identity-access-evidence-${process.pid}-${Date.now()}.json`);
assert(!await exists(temporaryReport), '33-P temporary evidence report already exists');

try {
  const intake = run([
    'scripts/verify-33-p-identity-access-external-evidence-intake.mjs',
    '--evidence-root', evidenceRoot,
    '--manifest', manifestPath,
    '--trusted-signer-public-key', trustedSignerPublicKeyPath,
    '--report', temporaryReport
  ], 120_000);
  requireSuccess(intake, '33-P signed external evidence intake');
  const evidenceReport = JSON.parse(await readFile(temporaryReport, 'utf8'));

  for (const script of [
    'scripts/verify-33-p-passkeys-federated-identity-verifiable-temporary-credentials-boundary.mjs',
    'scripts/verify-33-p-passkeys-federated-identity-verifiable-temporary-credentials-contract.mjs',
    'scripts/verify-33-p-passkeys-federated-identity-verifiable-temporary-credentials-runtime.mjs'
  ]) requireSuccess(run([script, '--no-write']), script);

  const fullVitest = run(['node_modules/vitest/vitest.mjs', 'run']);
  requireSuccess(fullVitest, 'Full Vitest');
  const fullOutput = `${fullVitest.stdout ?? ''}\n${fullVitest.stderr ?? ''}`;
  const fullFiles = fullOutput.match(/Test Files\s+(\d+) passed/u);
  const fullTests = fullOutput.match(/Tests\s+(\d+) passed/u);
  assert(fullFiles && fullTests, 'Full Vitest output ratchet is unavailable');

  const npmCli = process.env.npm_execpath;
  assert(typeof npmCli === 'string' && npmCli.length > 0,
    '33-P production builds require the npm CLI path from package-script execution');
  for (const [label, args] of [
    ['Package builds', [npmCli, 'run', 'build:packages']],
    ['Core-service build', [npmCli, 'run', 'build', '--workspace', '@ppt/core-service']],
    ['Desktop build', [npmCli, 'run', 'build', '--workspace', '@ppt/desktop']]
  ]) requireSuccess(run(args), label);

  const finalStatus = git('status', '--porcelain');
  const finalHead = git('rev-parse', 'HEAD');
  const finalTree = git('rev-parse', 'HEAD^{tree}');
  requireSuccess(finalStatus, 'Final Git status');
  requireSuccess(finalHead, 'Final Git HEAD');
  requireSuccess(finalTree, 'Final Git tree');
  assert(finalStatus.stdout.trim() === '',
    '33-P preparation gates or builds changed the exact source tree');
  assert(finalHead.stdout.trim() === evidenceSourceCommit && finalTree.stdout.trim() === evidenceSourceTree,
    '33-P preparation source binding changed while evidence was evaluated');

  const [scope, inventory, acceptedScopeRegistry, trustedSignerRegistry, roadmap, workPlan, ledger,
    predecessorReceipt, boundary, contract, runtime, migration, ppk021, ppk022, decision, threat] = await Promise.all([
    readJson(paths.scope), readJson(paths.inventory), readJson(paths.registry), readJson(paths.trustedSigners),
    readJson(paths.roadmap), readJson(paths.plan), readJson(paths.ledger), readJson(paths.predecessor),
    readJson(paths.boundary), readJson(paths.contract), readJson(paths.runtime), readJson(paths.migration),
    readJson(paths.ppk021), readJson(paths.ppk022), readFile(full(paths.decision), 'utf8'), readFile(full(paths.threat), 'utf8')
  ]);
  const predecessorBytes = await readFile(full(paths.predecessor));
  assert(await readFile(full(`${paths.predecessor}.sha256`), 'utf8')
    === `${sha256(predecessorBytes)}  ${basename(paths.predecessor)}\n`, '33-O predecessor sidecar drift');
  const ancestor = git('merge-base', '--is-ancestor', predecessorReceipt.sourceCommit, evidenceSourceCommit);
  const migration93 = migration.migrationVersions?.find((item) => item.version === 93);
  const technicalEvidence = {
    sourceCommit: evidenceSourceCommit,
    boundary: { status: boundary.status, checksPassed: boundary.checksPassed },
    contract: { status: contract.status, checksPassed: contract.checksPassed },
    runtime: {
      status: runtime.status, checksPassed: runtime.checksPassed,
      targetedTestFilesPassed: runtime.targetedTestFilesPassed,
      targetedTestsPassed: runtime.targetedTestsPassed
    },
    migration93Checksum: migration93?.checksum,
    ppk021: {
      status: ppk021.status, findings: ppk021.findings?.length,
      exactAllowlistEntries: ppk021.exactAllowlistEntries
    },
    ppk022: {
      status: ppk022.status, findings: ppk022.findings?.length,
      exactManifestSurfaces: ppk022.exactManifestSurfaces
    },
    fullVitest: { testFilesPassed: Number(fullFiles[1]), testsPassed: Number(fullTests[1]) },
    builds: { packages: true, coreService: true, desktop: true }
  };
  const preparedAt = new Date().toISOString();
  const prepared = buildIdentityAccessPreparedState({
    scope, inventory, acceptedScopeRegistry, roadmap, workPlan, ledger, predecessorReceipt,
    trustedSignerRegistry, evidenceReport, technicalEvidence,
    gitBinding: {
      clean: true,
      head: evidenceSourceCommit,
      tree: evidenceSourceTree,
      predecessorAncestor: ancestor.status === 0,
      predecessorSourceCommit: predecessorReceipt.sourceCommit
    },
    preparedAt
  });
  assert(exact(prepared.acceptedScopeRegistry, acceptedScopeRegistry),
    '33-P preparation must not mutate the accepted-scope registry');
  if (dryRun) {
    console.log(`33-P completion preparation dry-run: PASS (${prepared.evaluation.passed}/${prepared.evaluation.checks.length}; no writes).`);
    process.exitCode = 0;
  } else {
    for (const path of [paths.evidenceReport, `${paths.evidenceReport}.sha256`, paths.preparationRecord,
      `${paths.preparationRecord}.sha256`, paths.audit]) {
      assert(!await exists(full(path)), `33-P preparation no-overwrite target exists: ${path}`);
    }
    const evidenceBytes = await readFile(temporaryReport);
    const preparationBytes = jsonBytes(prepared.preparationRecord);
    await writeNewPair(paths.evidenceReport, evidenceBytes);
    await writeNewPair(paths.preparationRecord, preparationBytes);
    const finalDecision = decision
      .replace('- Durum: IN_PROGRESS', '- Durum: VALIDATED_RECEIPT_PENDING')
      .replace('- Uygulama gerçeği: PARTIAL_LOCAL_IMPLEMENTATION', '- Uygulama gerçeği: VALIDATED_EXTERNAL_EVIDENCE_RECEIPT_PENDING');
    const finalThreat = threat
      .replace('- Durum: IN_PROGRESS', '- Durum: VALIDATED_RECEIPT_PENDING')
      .replace('- Uygulama gerçeği: PARTIAL_LOCAL_IMPLEMENTATION', '- Uygulama gerçeği: VALIDATED_EXTERNAL_EVIDENCE_RECEIPT_PENDING')
      .replace('- Dış/manuel kanıt: NOT_RUN', '- Dış/manuel kanıt: PASS_SIGNED_EXTERNAL_EVIDENCE');
    assert(finalDecision !== decision && finalThreat !== threat, '33-P preparation document state drift');
    const audit = `# 33-P Kimlik Erişimi ve Yetki Belgeleri - Üst Kapanış\n\n`
      + `## Durum\n\nVALIDATED / RECEIPT_PENDING. Governed signer ve sekiz dış kanıt exact source commitine bağlıdır; persistent receipt tamamlanmadan requirement PASS=false kalır.\n\n`
      + `## Kanıt\n\n- Evidence source commit: ${evidenceSourceCommit}.\n- Evidence tree SHA-256: ${evidenceReport.evidenceBinding.evidenceTreeSha256}.\n- Boundary: 21/21 PASS; contract: 17/17 PASS; runtime: 24/24 PASS.\n`
      + `- Tam regresyon: ${Number(fullFiles[1])} dosya / ${Number(fullTests[1])} test PASS.\n- Package, core-service ve desktop build: PASS.\n`
      + `- Registry mutasyonu: yapılmadı. Persistent receipt: PENDING. Certification claim: false.\n\n`
      + `## Kalan kapı\n\nLocal/D: exact checkpoint, source protection, Git backup/GitHub HEAD eşitliği ve completion verifier PASS olmadan 33-P COMPLETED veya 33-Q ACTIVE değildir.\n`;
    await Promise.all([
      writeFile(full(paths.scope), jsonBytes(prepared.scope)),
      writeFile(full(paths.inventory), jsonBytes(prepared.inventory)),
      writeFile(full(paths.roadmap), jsonBytes(prepared.roadmap)),
      writeFile(full(paths.plan), jsonBytes(prepared.workPlan)),
      writeFile(full(paths.ledger), jsonBytes(prepared.ledger)),
      writeFile(full(paths.decision), finalDecision, 'utf8'),
      writeFile(full(paths.threat), finalThreat, 'utf8'),
      writeFile(full(paths.audit), audit, { flag: 'wx' })
    ]);
    evidenceBytes.fill(0);
    preparationBytes.fill(0);
    console.log(`33-P completion preparation: PASS (${prepared.evaluation.passed}/${prepared.evaluation.checks.length}; receipt PENDING; registry unchanged).`);
  }
} finally {
  await rm(temporaryReport, { force: true });
}

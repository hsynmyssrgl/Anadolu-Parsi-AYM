import { spawnSync } from 'node:child_process';
import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { buildDeterministicZip, sha256 } from './lib/deterministic-zip.mjs';
import { evaluateDeliveryAttestation, renderAttestationFileName, verifyExistingDeliveryAttestation } from './lib/delivery-attestation.mjs';

const failures = [];
let checks = 0;
const verify = (condition, message) => { checks += 1; if (!condition) failures.push(message); };
const read = (path) => readFile(path, 'utf8');
const readJson = async (path) => JSON.parse(await read(path));

const packageJson = await readJson('package.json');
const preflight = await readJson('config/source-preflight-checks.json');
const contract = await readJson('config/delivery-attestation-contract.json');
const setter = await read('scripts/set-workspace-version.mjs');
const library = await read('scripts/lib/delivery-attestation.mjs');
const creator = await read('scripts/create-delivery-attestation.mjs');
const verifierSource = await read('scripts/verify-delivery-attestation.mjs');
const ci = await read('.github/workflows/ci.yml');
const windows = await read('.github/workflows/windows-rc2-validation.yml');

verify(packageJson.version === '25.7.2026-115', `package version=${packageJson.version}`);
for (const [name, value] of [
  ['verify:delivery-attestation-contract', 'node scripts/verify-delivery-attestation-contract.mjs'],
  ['create:delivery-attestation', 'node scripts/create-delivery-attestation.mjs'],
  ['verify:delivery-attestation', 'node scripts/verify-delivery-attestation.mjs'],
  ['verify:build115:architecture', 'node scripts/verify-build115-architecture.mjs']
]) verify(packageJson.scripts?.[name] === value, `package script mismatch=${name}`);
const contractCheck = preflight.checks?.find((item) => item.id === 'delivery-attestation-contract');
verify(Boolean(contractCheck), 'attestation contract preflight check missing');
verify(contractCheck?.script === 'scripts/verify-delivery-attestation-contract.mjs', 'attestation preflight script mismatch');
verify(contractCheck?.args?.includes('artifacts/validation/delivery-attestation-contract.json'), 'attestation preflight report path missing');
verify(preflight.checks?.at(-1)?.id === 'active-delivery-documents', 'active delivery documents must remain final preflight check');
verify(contract.evidence?.length === 12, `evidence count=${contract.evidence?.length}`);
verify(contract.gateClaims?.length === 7, `gate claim count=${contract.gateClaims?.length}`);
verify(new Set(contract.evidence.map((item) => item.id)).size === contract.evidence.length, 'evidence ids are not unique');
verify(new Set(contract.gateClaims.map((item) => item.label)).size === contract.gateClaims.length, 'gate labels are not unique');
verify(contract.evidence.every((item) => item.path.startsWith('artifacts/validation/')), 'evidence path escaped validation boundary');
verify(contract.attestationFileNameTemplate.includes('{build}'), 'attestation filename build placeholder missing');
verify(contract.attestationFileNameTemplate.includes('{version}'), 'attestation filename version placeholder missing');
verify(setter.includes('Ayrık teslim kanıt tasdiki'), 'version setter attestation reference missing');
verify(setter.includes('Detached delivery attestation'), 'root status attestation reference missing');
for (const marker of ['evidenceStatus', 'BUILD_STATUS claim mismatch', 'VERIFICATION_REPORT claim mismatch', 'Attestation evidence', 'archive identity read failed']) verify(library.includes(marker), `attestation guard missing=${marker}`);
verify(creator.includes('.sha256'), 'attestation SHA-256 sidecar missing');
verify(verifierSource.includes('verifyExistingDeliveryAttestation'), 'attestation verifier recomputation missing');
verify(ci.includes('delivery-attestation-contract.json'), 'Linux workflow attestation evidence missing');
verify(windows.includes('delivery-attestation-contract.json'), 'Windows workflow attestation evidence missing');

const contractRun = spawnSync(process.execPath, ['scripts/verify-delivery-attestation-contract.mjs', '--report', 'artifacts/validation/delivery-attestation-contract.json'], { encoding: 'utf8' });
verify(contractRun.status === 0, `real contract failed=${contractRun.stderr}`);
const contractEvidence = await readJson('artifacts/validation/delivery-attestation-contract.json');
verify(contractEvidence.status === 'PASS', `contract evidence status=${contractEvidence.status}`);
verify(contractEvidence.evidenceCount === 12, `contract evidence count=${contractEvidence.evidenceCount}`);
verify(contractEvidence.gateClaimCount === 7, `contract gate count=${contractEvidence.gateClaimCount}`);

const fixture = await mkdtemp(join(tmpdir(), 'ppt-build115-'));
try {
  await mkdir(join(fixture, 'config'), { recursive: true });
  await mkdir(join(fixture, 'artifacts/manifests'), { recursive: true });
  await mkdir(join(fixture, 'artifacts/validation'), { recursive: true });
  await cp('config/delivery-attestation-contract.json', join(fixture, 'config/delivery-attestation-contract.json'));
  const fixtureContract = await readJson(join(fixture, 'config/delivery-attestation-contract.json'));
  const version = '01.01.2026.1';
  const packageVersion = '1.1.2026-1';
  const build = 1;
  const attestationName = renderAttestationFileName(fixtureContract, build, version);
  await writeFile(join(fixture, 'package.json'), `${JSON.stringify({ name: 'fixture', version: packageVersion }, null, 2)}\n`);
  await writeFile(join(fixture, 'artifacts/manifests/VERSION_LEDGER.json'), `${JSON.stringify({ entries: [{ version, packageVersion, sequence: build }] }, null, 2)}\n`);
  const statusLines = [
    ['Source preflight gate', 'PASS'], ['Source integrity', 'PASS'], ['Clean install gate', 'FAIL'],
    ['Full root `tsc --noEmit`', 'NOT_RUN'], ['Electron production build', 'NOT_RUN'], ['Blocking smoke chain', 'NOT_RUN'], ['Windows launch / installer', 'NOT_RUN']
  ];
  const statusText = `${statusLines.map(([label, status]) => `- ${label}: **${status}**`).join('\n')}\n- Detached delivery attestation: \`${attestationName}\`\n`;
  await writeFile(join(fixture, 'BUILD_STATUS.md'), statusText);
  await writeFile(join(fixture, 'VERIFICATION_REPORT.md'), statusText);
  for (const item of fixtureContract.evidence) {
    const target = join(fixture, item.path);
    await mkdir(dirname(target), { recursive: true });
    const payload = item.id === 'rc2-validation'
      ? { overallStatus: 'INCOMPLETE', results: [
          { id: 'tsc-no-emit', status: 'NOT_RUN' }, { id: 'electron-production-build', status: 'NOT_RUN' }, { id: 'smoke-tests', status: 'NOT_RUN' },
          { id: 'windows-real-launch', status: 'NOT_RUN' }, { id: 'windows-installer', status: 'NOT_RUN' }
        ] }
      : { [item.statusField]: item.expectedStatus, id: item.id };
    await writeFile(target, `${JSON.stringify(payload, null, 2)}\n`);
  }
  const paths = ['BUILD_STATUS.md', 'VERIFICATION_REPORT.md', 'artifacts/manifests/VERSION_LEDGER.json', 'package.json'].sort((a, b) => a.localeCompare(b, 'en'));
  const built = await buildDeterministicZip(fixture, paths);
  const archivePath = join(fixture, 'fixture.zip');
  await writeFile(archivePath, built.archive);
  const good = await evaluateDeliveryAttestation({ root: fixture, archivePath });
  verify(good.status === 'PASS', `good fixture failed=${good.failures.join('; ')}`);
  verify(good.evidence.length === 12, `good evidence count=${good.evidence.length}`);
  verify(good.gateClaims.length === 7, `good claim count=${good.gateClaims.length}`);
  verify(good.gateClaims.every((claim) => claim.status === 'MATCH'), 'good fixture claim mismatch');
  verify(good.archive.sha256 === sha256(built.archive), 'fixture archive hash mismatch');
  const stored = { ...good, generatedAt: new Date().toISOString() };
  const storedResult = await verifyExistingDeliveryAttestation({ attestation: stored, root: fixture, archivePath });
  verify(storedResult.status === 'PASS', `stored attestation failed=${storedResult.failures.join('; ')}`);

  const cleanPath = join(fixture, fixtureContract.evidence.find((item) => item.id === 'clean-npm-ci').path);
  const cleanOriginal = await read(cleanPath);
  await writeFile(cleanPath, cleanOriginal.replace('"FAIL"', '"PASS"'));
  const falsePass = await evaluateDeliveryAttestation({ root: fixture, archivePath });
  verify(falsePass.status === 'FAIL', 'false clean PASS accepted');
  verify(falsePass.failures.some((failure) => failure.includes('Evidence clean-npm-ci status=PASS')), 'false clean expected status failure missing');
  verify(falsePass.failures.some((failure) => failure.includes('Clean install gate')), 'false clean document mismatch missing');
  await writeFile(cleanPath, cleanOriginal);

  await writeFile(cleanPath, cleanOriginal.replace('\n}', ',\n  "tampered": true\n}'));
  const tampered = await verifyExistingDeliveryAttestation({ attestation: stored, root: fixture, archivePath });
  verify(tampered.status === 'FAIL', 'evidence byte tampering accepted');
  verify(tampered.failures.some((failure) => failure.includes('clean-npm-ci.sha256 mismatch')), 'evidence hash mismatch missing');
  await writeFile(cleanPath, cleanOriginal);

  await writeFile(join(fixture, 'BUILD_STATUS.md'), statusText.replace('- Clean install gate: **FAIL**', '- Clean install gate: **PASS**'));
  const falseArchive = await buildDeterministicZip(fixture, paths);
  const falseArchivePath = join(fixture, 'false-doc.zip');
  await writeFile(falseArchivePath, falseArchive.archive);
  const falseDocument = await evaluateDeliveryAttestation({ root: fixture, archivePath: falseArchivePath });
  verify(falseDocument.status === 'FAIL', 'false archive document claim accepted');
  verify(falseDocument.failures.some((failure) => failure.includes('BUILD_STATUS claim mismatch Clean install gate')), 'false archive document reason missing');
  await writeFile(join(fixture, 'BUILD_STATUS.md'), statusText);

  const brokenBytes = Buffer.from(built.archive); brokenBytes[10] ^= 0xff;
  const brokenPath = join(fixture, 'broken.zip'); await writeFile(brokenPath, brokenBytes);
  const broken = await evaluateDeliveryAttestation({ root: fixture, archivePath: brokenPath });
  verify(broken.status === 'FAIL', 'mutated archive accepted');
  verify(broken.failures.some((failure) => failure.startsWith('archive:')), 'mutated archive reason missing');

  const missingItem = fixtureContract.evidence[0];
  await rm(join(fixture, missingItem.path));
  const missing = await evaluateDeliveryAttestation({ root: fixture, archivePath });
  verify(missing.status === 'FAIL', 'missing evidence accepted');
  verify(missing.failures.some((failure) => failure.includes(`Evidence ${missingItem.id} read failed`)), 'missing evidence reason missing');
} finally {
  await rm(fixture, { recursive: true, force: true });
}

const evidence = { schemaVersion: 1, product: 'Panthera pardus tulliana Aile', applicationVersion: '25.07.2026.115', packageVersion: packageJson.version, build: 115, checks, status: failures.length === 0 ? 'PASS' : 'FAIL', failures, generatedAt: new Date().toISOString() };
await mkdir('artifacts/validation', { recursive: true });
await writeFile('artifacts/validation/build115-architecture.json', `${JSON.stringify(evidence, null, 2)}\n`);
if (failures.length) { console.error(`Build 115 architecture validation failed with ${failures.length} issue(s):`); for (const failure of failures) console.error(`- ${failure}`); process.exit(1); }
console.log(`Build 115 architecture verified: ${checks} assertions.`);

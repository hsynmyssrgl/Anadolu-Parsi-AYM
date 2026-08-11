import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const option = (name, fallback) => {
  const index = process.argv.indexOf(name);
  return index < 0 ? fallback : process.argv[index + 1];
};
const reportPath = resolve(option('--report', 'artifacts/validation/build121-architecture.json'));
let assertions = 0;
const failures = [];
const verify = (condition, message) => {
  assertions += 1;
  if (!condition) failures.push(message);
};
const readJson = async (path) => JSON.parse(await readFile(path, 'utf8'));

const contractPath = resolve('artifacts/validation/workspace-path-portability-contract.json');
const contractRun = spawnSync(process.execPath, [
  'scripts/verify-workspace-path-portability-contract.mjs',
  '--report',
  contractPath
], { cwd: process.cwd(), encoding: 'utf8', env: { ...process.env, TERM: 'dumb' } });
verify(contractRun.status === 0, `workspace path portability subprocess failed: ${contractRun.stderr || contractRun.stdout}`);
const contract = await readJson(contractPath);
verify(contract.status === 'PASS', `workspace path portability status=${contract.status}`);
verify(contract.assertions >= 35, `workspace path portability assertion count too low=${contract.assertions}`);

const packageJson = await readJson('package.json');
const preflight = await readJson('config/source-preflight-checks.json');
const attestation = await readJson('config/delivery-attestation-contract.json');
const verifierSource = await readFile('scripts/verify-active-version-contract.mjs', 'utf8');
const updaterSource = await readFile('scripts/set-workspace-version.mjs', 'utf8');
const helperSource = await readFile('scripts/lib/workspace-paths.mjs', 'utf8');
const compilerHelperSource = await readFile('scripts/lib/typescript-command.mjs', 'utf8');
const rootTsconfig = await readJson('tsconfig.json');
const packageTsconfig = await readJson('tsconfig.packages.json');

verify(packageJson.version === '25.7.2026-121', `package version=${packageJson.version}`);
verify(packageJson.scripts?.['verify:workspace-path-portability'] === 'node scripts/verify-workspace-path-portability-contract.mjs', 'portability contract script missing');
verify(packageJson.scripts?.['verify:build121:architecture'] === 'node scripts/verify-build121-architecture.mjs', 'Build 121 architecture script missing');
verify(preflight.checks?.some((item) => item.id === 'workspace-path-portability-contract'), 'source preflight portability check missing');
verify(preflight.checks?.length === 11, `source preflight check count=${preflight.checks?.length}`);
for (const dependencyBoundCheck of [
  'ipc-sender-trust-contract',
  'renderer-session-security-contract',
  'ipc-payload-security-contract'
]) {
  verify(!preflight.checks?.some((item) => item.id === dependencyBoundCheck), `dependency-bound check remains in source preflight=${dependencyBoundCheck}`);
  verify(attestation.evidence?.some((item) => item.id === dependencyBoundCheck && item.expectedStatus === 'PASS'), `dependency-bound security evidence missing from attestation=${dependencyBoundCheck}`);
}
verify(attestation.evidence?.some((item) => item.id === 'workspace-path-portability-contract' && item.expectedStatus === 'PASS'), 'attestation portability evidence missing');
verify(attestation.evidence?.some((item) => item.id === 'build121-architecture' && item.expectedStatus === 'PASS'), 'attestation Build 121 evidence missing');
verify(attestation.evidence?.length === 19, `attestation evidence count=${attestation.evidence?.length}`);

for (const marker of [
  "replaceAll('\\\\', '/')",
  'Repository path must be relative',
  'Repository path contains an unsafe segment',
  'workspaceLockPathFromManifest',
  'isWorkspaceLockPath'
]) {
  verify(helperSource.includes(marker), `workspace path helper marker missing=${marker}`);
}
verify(verifierSource.includes('workspaceLockPathFromManifest(path)'), 'active version verifier does not canonicalize lock lookup');
verify(updaterSource.includes('isWorkspaceLockPath(packagePath)'), 'version updater does not canonicalize workspace lock detection');
for (const [label, config] of [['root', rootTsconfig], ['packages', packageTsconfig]]) {
  verify(config.compilerOptions?.baseUrl === undefined, `${label} tsconfig retains removed baseUrl`);
  for (const [name, paths] of Object.entries(config.compilerOptions?.paths ?? {})) {
    verify(paths.every((value) => value.startsWith('./')), `${label} tsconfig path is not explicitly relative=${name}`);
  }
}
for (const path of [
  'scripts/verify-ipc-sender-trust-contract.mjs',
  'scripts/verify-renderer-session-security-contract.mjs',
  'scripts/verify-ipc-payload-security-contract.mjs',
  'scripts/verify-package-source-types.mjs',
  'scripts/verify-desktop-main-source-types.mjs'
]) {
  verify((await readFile(path, 'utf8')).includes('resolveTypeScriptCommand'), `TypeScript command portability helper missing=${path}`);
}
for (const marker of ['process.execPath', "node_modules', 'typescript', 'bin', 'tsc'", 'workspace-typescript-node-entrypoint']) {
  verify(compilerHelperSource.includes(marker), `TypeScript command helper marker missing=${marker}`);
}

const report = {
  schemaVersion: 1,
  product: 'Panthera pardus tulliana Aile',
  applicationVersion: '25.07.2026.121',
  packageVersion: '25.7.2026-121',
  stage: 'Bronze RC2 Active Development',
  assertions,
  delegatedAssertions: contract.assertions,
  failures,
  status: failures.length === 0 ? 'PASS' : 'FAIL',
  generatedAt: new Date().toISOString()
};
await mkdir(dirname(reportPath), { recursive: true });
await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`);
console.log(`Build 121 architecture verification: ${report.status} — ${assertions} integration assertions + ${contract.assertions} contract assertions.`);
for (const failure of failures) console.error(`- ${failure}`);
if (report.status !== 'PASS') process.exitCode = 1;

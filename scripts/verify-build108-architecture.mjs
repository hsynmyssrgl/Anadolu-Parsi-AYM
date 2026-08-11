import { readFile, stat } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';

const expectedDisplayVersion = '25.07.2026.108';
const expectedPackageVersion = '25.7.2026-108';
const expectedBuild = 108;
const failures = [];
let checks = 0;
const verify = (condition, message) => { checks += 1; if (!condition) failures.push(message); };
const readJson = async (path) => JSON.parse(await readFile(path, 'utf8'));
const exists = async (path) => { try { await stat(path); return true; } catch { return false; } };

verify(await exists('scripts/verify-active-version-contract.mjs'), 'generic active version verifier is missing');
const packageJson = await readJson('package.json');
verify(packageJson.version === expectedPackageVersion, `root package version=${packageJson.version}`);
verify(packageJson.scripts?.['verify:version'] === 'node scripts/verify-version-sequence.mjs && node scripts/verify-active-version-contract.mjs', 'verify:version chain is incomplete');
verify(packageJson.scripts?.verify?.includes('npm run verify:version'), 'main verify chain does not include version contract');
verify(packageJson.scripts?.['verify:build108:architecture'] === 'node scripts/verify-build108-architecture.mjs', 'Build 108 verifier is not registered');

const bronzeDatabaseVerifier = await readFile('scripts/verify-bronze-database.mjs', 'utf8');
verify(bronzeDatabaseVerifier.includes("const ledger = JSON.parse(await readFile('artifacts/manifests/VERSION_LEDGER.json', 'utf8'));"), 'Bronze database gate does not derive the active version from VERSION_LEDGER');
verify(!bronzeDatabaseVerifier.includes("'2.1.0'"), 'Bronze database gate retains legacy workspace dependency version');
verify(!bronzeDatabaseVerifier.includes("'24.7.2026-56'"), 'Bronze database gate retains legacy package version');

const updater = await readFile('scripts/set-workspace-version.mjs', 'utf8');
for (const marker of [
  "const buildStatusPath = 'BUILD_STATUS.md';",
  "const activeDevelopmentStatusPath = 'docs/09_ACTIVE_DEVELOPMENT_STATUS.md';",
  'repositoryMetadata.workspaceCount = workspaceNames.size;',
  'repositoryMetadata.foundationWorkspaceCount ='
]) verify(updater.includes(marker), `version updater marker missing=${marker}`);

const gateConfig = await readJson('config/rc2-validation-gates.json');
const gateIds = gateConfig.gates?.map((gate) => gate.id) ?? [];
const npmCiIndex = gateIds.indexOf('clean-npm-ci');
const contractIndex = gateIds.indexOf('active-version-contract');
const typecheckIndex = gateIds.indexOf('tsc-no-emit');
verify(npmCiIndex >= 0, 'clean npm ci gate is missing');
verify(contractIndex === npmCiIndex + 1, `active version gate index=${contractIndex}; npm ci index=${npmCiIndex}`);
verify(typecheckIndex === contractIndex + 1, `typecheck gate index=${typecheckIndex}; contract index=${contractIndex}`);

const run = spawnSync(process.execPath, ['scripts/verify-active-version-contract.mjs'], { encoding: 'utf8', env: { ...process.env, TERM: 'dumb' } });
verify(run.status === 0, `active version contract failed: ${run.stderr || run.stdout}`);
const evidence = await readJson('artifacts/validation/active-version-contract.json');
verify(evidence.status === 'PASS', `active version evidence status=${evidence.status}`);
verify(evidence.version === expectedDisplayVersion, `active version evidence version=${evidence.version}`);
verify(evidence.packageVersion === expectedPackageVersion, `active version evidence package=${evidence.packageVersion}`);
verify(evidence.build === expectedBuild, `active version evidence build=${evidence.build}`);
verify(evidence.workspaceCount === 14, `active version evidence workspaceCount=${evidence.workspaceCount}`);

const metadata = await readJson('repository-metadata.json');
verify(metadata.workspaceCount === 14, `metadata workspaceCount=${metadata.workspaceCount}`);
verify(metadata.foundationWorkspaceCount === 9, `metadata foundationWorkspaceCount=${metadata.foundationWorkspaceCount}`);
const buildStatus = await readFile('BUILD_STATUS.md', 'utf8');
verify(buildStatus.includes(`Current Application Version: \`${expectedDisplayVersion}\``), 'root build status display version mismatch');
verify(buildStatus.includes(`Current Package Version: \`${expectedPackageVersion}\``), 'root build status package version mismatch');
verify(buildStatus.includes(`Current Build: **${expectedBuild}**`), 'root build status build mismatch');
const activeStatus = await readFile('docs/09_ACTIVE_DEVELOPMENT_STATUS.md', 'utf8');
verify(activeStatus.includes(`**Sürüm:** ${expectedDisplayVersion}`), 'active development status version mismatch');

if (failures.length > 0) {
  console.error(`Build 108 architecture verification failed with ${failures.length} issue(s):`);
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}
console.log(`Build 108 architecture verification completed: ${checks} targeted assertions.`);

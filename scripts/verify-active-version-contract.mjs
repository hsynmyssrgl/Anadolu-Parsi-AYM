import { mkdir, readFile, readdir, stat, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { workspaceLockPathFromManifest, workspaceManifestPath } from './lib/workspace-paths.mjs';

const evidencePath = 'artifacts/validation/active-version-contract.json';
const failures = [];
let checks = 0;
const verify = (condition, message) => { checks += 1; if (!condition) failures.push(message); };
const readJson = async (path) => JSON.parse(await readFile(path, 'utf8'));
const exists = async (path) => { try { await stat(path); return true; } catch { return false; } };

const ledger = await readJson('artifacts/manifests/VERSION_LEDGER.json');
const current = ledger.entries?.at(-1);
verify(Boolean(current), 'VERSION_LEDGER current entry is missing');
const displayVersion = current?.version ?? '';
const packageVersion = current?.packageVersion ?? '';
const build = current?.sequence;
verify(/^\d{2}\.\d{2}\.\d{4}\.\d+$/.test(displayVersion), `invalid display version=${displayVersion}`);
verify(/^\d{1,2}\.\d{1,2}\.\d{4}-\d+$/.test(packageVersion), `invalid package version=${packageVersion}`);
verify(Number.isInteger(build) && build > 0, `invalid build=${build}`);
verify(displayVersion.endsWith(`.${build}`), `display version/build mismatch=${displayVersion}/${build}`);
verify(packageVersion.endsWith(`-${build}`), `package version/build mismatch=${packageVersion}/${build}`);

const manifestPaths = ['package.json'];
for (const parent of ['apps', 'packages']) {
  for (const entry of await readdir(parent, { withFileTypes: true })) {
    const path = workspaceManifestPath(parent, entry.name);
    if (entry.isDirectory() && await exists(path)) manifestPaths.push(path);
  }
}
manifestPaths.splice(1, manifestPaths.length - 1, ...manifestPaths.slice(1).sort());
const workspaceNames = new Set();
for (const path of manifestPaths.slice(1)) workspaceNames.add((await readJson(path)).name);
verify(workspaceNames.size === manifestPaths.length - 1, 'workspace package names must be unique');
for (const path of manifestPaths) {
  const manifest = await readJson(path);
  verify(manifest.version === packageVersion, `${path} version=${manifest.version}`);
  if (path !== 'package.json') verify(manifest.private === true, `${path} private=${manifest.private}`);
  for (const section of ['dependencies', 'devDependencies', 'peerDependencies', 'optionalDependencies']) {
    for (const [name, version] of Object.entries(manifest[section] ?? {})) {
      if (workspaceNames.has(name)) verify(version === packageVersion, `${path} ${section}.${name}=${version}`);
    }
  }
}

const lock = await readJson('package-lock.json');
verify(lock.version === packageVersion, `package-lock version=${lock.version}`);
verify(lock.packages?.['']?.version === packageVersion, `package-lock root version=${lock.packages?.['']?.version}`);
for (const path of manifestPaths.slice(1)) {
  const lockPath = workspaceLockPathFromManifest(path);
  const lockEntry = lock.packages?.[lockPath];
  verify(Boolean(lockEntry), `package-lock workspace entry missing=${path}`);
  verify(lockEntry?.version === packageVersion, `package-lock ${path} version=${lockEntry?.version}`);
  for (const section of ['dependencies', 'devDependencies', 'peerDependencies', 'optionalDependencies']) {
    for (const [name, version] of Object.entries(lockEntry?.[section] ?? {})) {
      if (workspaceNames.has(name)) verify(version === packageVersion, `package-lock ${path} ${section}.${name}=${version}`);
    }
  }
}

const appMeta = await readFile('packages/domain/src/app-meta.ts', 'utf8');
verify(appMeta.includes(`version: '${displayVersion}'`), 'APP_META display version mismatch');
verify(appMeta.includes(`packageVersion: '${packageVersion}'`), 'APP_META package version mismatch');
verify(appMeta.includes(`stage: 'Bronze RC2 · Aktif Geliştirme · Build ${build}'`), 'APP_META stage/build mismatch');

const metadata = await readJson('repository-metadata.json');
verify(metadata.product === 'Anadolu Parsı Aile Yaşam Merkezi', `repository product=${metadata.product}`);
verify(metadata.repositoryVersion === displayVersion, `metadata repositoryVersion=${metadata.repositoryVersion}`);
verify(metadata.applicationVersion === displayVersion, `metadata applicationVersion=${metadata.applicationVersion}`);
verify(metadata.packageVersion === packageVersion, `metadata packageVersion=${metadata.packageVersion}`);
verify(metadata.revision === `BUILD-${build}`, `metadata revision=${metadata.revision}`);
verify(metadata.versionSequence === build, `metadata versionSequence=${metadata.versionSequence}`);
verify(metadata.workspaceCount === workspaceNames.size, `metadata workspaceCount=${metadata.workspaceCount}; actual=${workspaceNames.size}`);
const foundationWorkspaceNames = new Set([
  '@ppt/core',
  '@ppt/contracts',
  '@ppt/config',
  '@ppt/logging',
  '@ppt/database',
  '@ppt/domain',
  '@ppt/events',
  '@ppt/repository-contracts',
  '@ppt/repositories'
]);
const foundationWorkspaceCount = [...foundationWorkspaceNames].filter((name) => workspaceNames.has(name)).length;
verify(metadata.foundationWorkspaceCount === foundationWorkspaceCount, `metadata foundationWorkspaceCount=${metadata.foundationWorkspaceCount}; actual=${foundationWorkspaceCount}`);

const activeBronzeGate = await readFile('scripts/verify-bronze-database.mjs', 'utf8');
verify(activeBronzeGate.includes("artifacts/manifests/VERSION_LEDGER.json"), 'active Bronze database gate does not read VERSION_LEDGER');
verify(!activeBronzeGate.includes("'24.7.2026-56'"), 'active Bronze database gate retains a legacy package version');
verify(!activeBronzeGate.includes("'2.1.0'"), 'active Bronze database gate retains a legacy workspace dependency version');

const rootStatus = await readFile('BUILD_STATUS.md', 'utf8');
for (const marker of [
  `- Current Application Version: \`${displayVersion}\``,
  `- Current Package Version: \`${packageVersion}\``,
  `- Current Build: **${build}**`,
  '- Current Stage: **Bronze RC2 Active Development**',
  '- Channel flow: **Bronze development → Silver validation → Gold production**'
]) verify(rootStatus.includes(marker), `BUILD_STATUS marker missing=${marker}`);

const activeStatus = await readFile('docs/09_ACTIVE_DEVELOPMENT_STATUS.md', 'utf8');
verify(activeStatus.includes(`**Sürüm:** ${displayVersion}`), 'active development document version mismatch');
verify(activeStatus.includes('**Kanal:** Bronze RC2'), 'active development document channel mismatch');
verify(activeStatus.includes('bütün yeni özellikler bu kanalda tamamlanır'), 'active development document status mismatch');

const masterLedger = await readJson('config/master-build-ledger.json');
verify(masterLedger.currentBuild === build, `master ledger currentBuild=${masterLedger.currentBuild}`);
verify(masterLedger.currentVersion === displayVersion, `master ledger currentVersion=${masterLedger.currentVersion}`);
const masterCurrent = masterLedger.builds?.find((entry) => entry.build === build);
verify(Boolean(masterCurrent), `master ledger current entry missing=${build}`);
verify(masterCurrent?.status === 'COMPLETED', `master ledger current status=${masterCurrent?.status}`);
verify(masterLedger.lastStatusNotification?.build === build, `master ledger notification build=${masterLedger.lastStatusNotification?.build}`);
verify(masterLedger.lastStatusNotification?.status === 'COMPLETED', `master ledger notification status=${masterLedger.lastStatusNotification?.status}`);

const buildStatusPath = `BUILD_STATUS_BRONZE_RC2_BUILD${build}.md`;
verify(await exists(buildStatusPath), `current build status file missing=${buildStatusPath}`);
if (await exists(buildStatusPath)) {
  const buildStatus = await readFile(buildStatusPath, 'utf8');
  verify(buildStatus.includes(`Application Version: \`${displayVersion}\``), `${buildStatusPath} display version mismatch`);
  verify(buildStatus.includes(`Package Version: \`${packageVersion}\``), `${buildStatusPath} package version mismatch`);
  verify(buildStatus.includes('Stage: **Bronze RC2 Active Development**'), `${buildStatusPath} stage mismatch`);
}

const sourceManifest = await readJson('manifest.json');
verify(sourceManifest.schemaVersion === 3, `manifest schemaVersion=${sourceManifest.schemaVersion}`);
verify(sourceManifest.packageVersion === packageVersion, `manifest packageVersion=${sourceManifest.packageVersion}`);
verify(Array.isArray(sourceManifest.files) && sourceManifest.files.length > 0, 'manifest file inventory is empty');
verify(sourceManifest.fileCount === sourceManifest.files?.length, `manifest fileCount=${sourceManifest.fileCount}; entries=${sourceManifest.files?.length}`);

const evidence = {
  schemaVersion: 1,
  product: 'Anadolu Parsı Aile Yaşam Merkezi',
  version: displayVersion,
  packageVersion,
  build,
  workspaceCount: workspaceNames.size,
  manifestFileCount: Array.isArray(sourceManifest.files) ? sourceManifest.files.length : 0,
  checks,
  status: failures.length === 0 ? 'PASS' : 'FAIL',
  failures,
  generatedAt: new Date().toISOString()
};
await mkdir(dirname(evidencePath), { recursive: true });
await writeFile(evidencePath, `${JSON.stringify(evidence, null, 2)}\n`);
if (failures.length > 0) {
  console.error(`Active version contract failed with ${failures.length} issue(s):`);
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}
console.log(`Active version contract verified: ${checks} assertions / ${workspaceNames.size} workspaces / Build ${build}.`);

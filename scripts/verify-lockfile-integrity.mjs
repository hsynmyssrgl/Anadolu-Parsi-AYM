import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';

const readJson = async (path) => JSON.parse(await readFile(path, 'utf8'));
const rootManifest = await readJson('package.json');
const lock = await readJson('package-lock.json');
const failures = [];
let checks = 0;

const verify = (condition, message) => {
  checks += 1;
  if (!condition) failures.push(message);
};

const workspaceManifests = new Map();
for (const parent of ['apps', 'packages']) {
  for (const entry of await readdir(parent, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const path = join(parent, entry.name, 'package.json');
    const manifest = await readJson(path);
    workspaceManifests.set(manifest.name, { path, lockPath: join(parent, entry.name).replaceAll('\\', '/'), manifest });
  }
}

verify(lock.name === rootManifest.name, `Lockfile root name mismatch: ${lock.name} !== ${rootManifest.name}`);
verify(lock.version === rootManifest.version, `Lockfile root version mismatch: ${lock.version} !== ${rootManifest.version}`);
verify(lock.lockfileVersion === 3, `Unsupported lockfileVersion: ${lock.lockfileVersion}`);
verify(lock.packages?.['']?.version === rootManifest.version, 'Root lock package version does not match package.json.');

const dependencySections = ['dependencies', 'devDependencies', 'peerDependencies', 'optionalDependencies'];
for (const [name, workspace] of workspaceManifests) {
  const { manifest, lockPath, path } = workspace;
  const lockEntry = lock.packages?.[lockPath];
  verify(Boolean(lockEntry), `Missing workspace lock entry: ${lockPath}`);
  if (!lockEntry) continue;
  verify(lockEntry.version === manifest.version, `Workspace version mismatch for ${name}: ${lockEntry.version} !== ${manifest.version}`);

  for (const section of dependencySections) {
    const manifestDependencies = manifest[section] ?? {};
    const lockDependencies = lockEntry[section] ?? {};
    for (const [dependencyName, declaredVersion] of Object.entries(manifestDependencies)) {
      verify(
        lockDependencies[dependencyName] === declaredVersion,
        `${path} ${section}.${dependencyName} differs from package-lock.json: ${declaredVersion} !== ${lockDependencies[dependencyName]}`
      );
      if (dependencyName.startsWith('@ppt/')) {
        const target = workspaceManifests.get(dependencyName);
        verify(Boolean(target), `${path} declares unknown internal dependency ${dependencyName}`);
        if (target) {
          verify(
            declaredVersion === target.manifest.version,
            `${path} internal dependency ${dependencyName}=${declaredVersion}, expected ${target.manifest.version}`
          );
        }
      }
    }
  }

  const linkPath = `node_modules/${name}`;
  const linkEntry = lock.packages?.[linkPath];
  verify(Boolean(linkEntry), `Missing local workspace link: ${linkPath}`);
  if (linkEntry) {
    verify(linkEntry.link === true, `${linkPath} is not marked as a local link.`);
    verify(linkEntry.resolved === lockPath, `${linkPath} resolves to ${linkEntry.resolved}, expected ${lockPath}`);
  }
}

const projectVersionPattern = /^\d{1,2}\.\d{1,2}\.\d{4}-\d+$/;
for (const [packagePath, entry] of Object.entries(lock.packages ?? {})) {
  if (!entry || typeof entry !== 'object') continue;
  const isRoot = packagePath === '';
  const isWorkspace = [...workspaceManifests.values()].some((workspace) => workspace.lockPath === packagePath);
  const isWorkspaceLink = packagePath.startsWith('node_modules/@ppt/');
  if (!isRoot && !isWorkspace && !isWorkspaceLink && projectVersionPattern.test(String(entry.version ?? ''))) {
    failures.push(`External lock entry has an application-style version: ${packagePath}=${entry.version}`);
  }

  if (!entry.resolved || !entry.version) continue;
  let url;
  try {
    url = new URL(entry.resolved);
  } catch {
    continue;
  }
  verify(url.protocol === 'https:', `Resolved tarball must use HTTPS for ${packagePath}: ${entry.resolved}`);
  verify(url.hostname === 'registry.npmjs.org', `Resolved tarball must use registry.npmjs.org for ${packagePath}: ${entry.resolved}`);
  const archiveName = decodeURIComponent(url.pathname.split('/').at(-1) ?? '');
  if (!archiveName.endsWith('.tgz')) continue;
  const packageSpecifier = packagePath.split('/node_modules/').at(-1) ?? '';
  const packageSegments = packageSpecifier.split('/');
  const unscopedName = packageSegments[0]?.startsWith('@') ? packageSegments[1] : packageSegments[0];
  if (!unscopedName) continue;
  const prefix = `${unscopedName}-`;
  const archiveBase = archiveName.slice(0, -4);
  if (!archiveBase.startsWith(prefix)) continue;
  const archiveVersion = archiveBase.slice(prefix.length);
  verify(
    archiveVersion === entry.version,
    `Resolved tarball/version mismatch for ${packagePath}: version=${entry.version}, tarball=${archiveVersion}`
  );
}

if (failures.length > 0) {
  console.error(`Lockfile integrity verification failed with ${failures.length} issue(s):`);
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(`Lockfile integrity verified: ${checks} assertions across ${workspaceManifests.size} workspaces.`);

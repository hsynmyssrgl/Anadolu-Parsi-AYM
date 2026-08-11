import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';

const canonicalRegistryHost = 'registry.npmjs.org';
const lock = JSON.parse(await readFile('package-lock.json', 'utf8'));
const rootManifest = JSON.parse(await readFile('package.json', 'utf8'));
const toolchainContract = JSON.parse(await readFile('config/build-toolchain-security.json', 'utf8'));
const approvedLocalLinks = new Map(
  (toolchainContract.approvedLocalLinks ?? []).map((entry) => [entry.packagePath, entry])
);
const failures = [];
let checks = 0;
let externalTarballs = 0;

const verify = (condition, message) => {
  checks += 1;
  if (!condition) failures.push(message);
};

const manifests = ['package.json'];
for (const parent of ['apps', 'packages']) {
  for (const entry of await readdir(parent, { withFileTypes: true })) {
    if (entry.isDirectory()) manifests.push(join(parent, entry.name, 'package.json'));
  }
}

const forbiddenDependencyProtocol = /^(?:file:|link:|git\+|git:|https?:)/i;
for (const manifestPath of manifests) {
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
  for (const section of ['dependencies', 'devDependencies', 'peerDependencies', 'optionalDependencies']) {
    for (const [name, specifier] of Object.entries(manifest[section] ?? {})) {
      if (name.startsWith('@ppt/')) continue;
      verify(!forbiddenDependencyProtocol.test(String(specifier)), `${manifestPath} contains a non-registry dependency source: ${name}=${specifier}`);
    }
  }
}

for (const [packagePath, entry] of Object.entries(lock.packages ?? {})) {
  if (!entry || typeof entry !== 'object') continue;
  if (entry.link === true) {
    if (packagePath.startsWith('node_modules/@ppt/')) {
      verify(/^(?:apps|packages)\//.test(String(entry.resolved ?? '')), `Workspace link does not resolve locally: ${packagePath} -> ${entry.resolved}`);
      continue;
    }
    const approved = approvedLocalLinks.get(packagePath);
    verify(Boolean(approved), `Unexpected lockfile link outside internal workspaces: ${packagePath}`);
    if (!approved) continue;
    verify(entry.resolved === approved.lockResolved, `Approved tool link target changed: ${packagePath} -> ${entry.resolved}`);
    verify(/^tools\/[a-z0-9-]+$/u.test(String(approved.sourcePath ?? '')), `Approved tool source path is invalid: ${approved.sourcePath}`);
    const localManifest = JSON.parse(await readFile(join(approved.sourcePath, 'package.json'), 'utf8'));
    verify(localManifest.name === approved.packageName, `Approved tool package name mismatch: ${localManifest.name}`);
    verify(localManifest.version === approved.version, `Approved tool package version mismatch: ${localManifest.version}`);
    verify(localManifest.private === true, `Approved local tool package must remain private: ${approved.packageName}`);
    verify(
      rootManifest.overrides?.[approved.packageName] === `file:${approved.sourcePath}`,
      `Root override does not bind ${approved.packageName} to ${approved.sourcePath}`
    );
    continue;
  }
  if (!entry.resolved) continue;
  let resolved;
  try {
    resolved = new URL(entry.resolved);
  } catch {
    failures.push(`Invalid resolved URL in lockfile: ${packagePath}=${entry.resolved}`);
    continue;
  }
  if (!resolved.pathname.endsWith('.tgz')) continue;
  externalTarballs += 1;
  verify(resolved.protocol === 'https:', `External package is not HTTPS: ${packagePath}=${entry.resolved}`);
  verify(resolved.hostname === canonicalRegistryHost, `External package is not pinned to ${canonicalRegistryHost}: ${packagePath}=${entry.resolved}`);
  verify(/^sha512-[A-Za-z0-9+/]+={0,2}$/.test(String(entry.integrity ?? '')), `External package lacks sha512 integrity: ${packagePath}`);
}

verify(externalTarballs > 0, 'No external tarball entries were inspected.');

if (failures.length > 0) {
  console.error(`Dependency supply verification failed with ${failures.length} issue(s):`);
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(`Dependency supply verified: ${checks} assertions / ${externalTarballs} canonical external tarballs.`);

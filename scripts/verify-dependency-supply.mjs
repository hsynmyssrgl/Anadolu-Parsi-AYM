import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { loadLockGraph, normalizePath } from './lib/ppk025-software-supply-chain.mjs';

const canonicalRegistryHost = 'registry.npmjs.org';
const rootManifest = JSON.parse(await readFile('package.json', 'utf8'));
const packagerManifest = JSON.parse(await readFile('tools/windows-packager/package.json', 'utf8'));
const toolchainContract = JSON.parse(await readFile('config/build-toolchain-security.json', 'utf8'));
const approvedLocalLinks = new Map(
  (toolchainContract.approvedLocalLinks ?? []).map((entry) => [entry.packagePath, entry])
);
const failures = [];
let checks = 0;
let externalTarballs = 0;
const graphCounts = [];
const verify = (condition, message) => {
  checks += 1;
  if (!condition) failures.push(message);
};

const manifests = ['package.json', 'tools/windows-packager/package.json'];
for (const parent of ['apps', 'packages']) {
  for (const entry of await readdir(parent, { withFileTypes: true })) {
    if (entry.isDirectory()) manifests.push(join(parent, entry.name, 'package.json'));
  }
}
const forbiddenDependencyProtocol = /^(?:file:|link:|git\+|git:|https?:)/iu;
for (const manifestPath of manifests) {
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
  for (const section of ['dependencies', 'devDependencies', 'peerDependencies', 'optionalDependencies']) {
    for (const [name, specifier] of Object.entries(manifest[section] ?? {})) {
      if (name.startsWith('@ppt/')) continue;
      verify(!forbiddenDependencyProtocol.test(String(specifier)), `${manifestPath} contains a non-registry dependency source: ${name}=${specifier}`);
    }
  }
}

const graphs = [
  await loadLockGraph({ scope: 'root', lockfilePath: 'package-lock.json' }),
  await loadLockGraph({ scope: 'windows-packager', lockfilePath: 'tools/windows-packager/package-lock.json' })
];
for (const graph of graphs) {
  let graphTarballs = 0;
  for (const node of graph.nodes) {
    const { entry, packagePath } = node;
    if (entry.link === true) {
      if (graph.scope === 'root' && packagePath.startsWith('node_modules/@ppt/')) {
        verify(/^(?:apps|packages)\//u.test(String(entry.resolved ?? '')), `Workspace link does not resolve locally: ${packagePath} -> ${entry.resolved}`);
        continue;
      }
      const approved = approvedLocalLinks.get(packagePath);
      verify(graph.scope === 'windows-packager' && Boolean(approved), `Unexpected lockfile link: ${graph.lockfilePath}:${packagePath}`);
      if (!approved) continue;
      verify(normalizePath(entry.resolved) === normalizePath(approved.lockResolved), `Approved tool link target changed: ${packagePath} -> ${entry.resolved}`);
      verify(/^tools\/[a-z0-9-]+$/u.test(String(approved.sourcePath ?? '')), `Approved tool source path is invalid: ${approved.sourcePath}`);
      const localManifest = JSON.parse(await readFile(join(approved.sourcePath, 'package.json'), 'utf8'));
      verify(localManifest.name === approved.packageName, `Approved tool package name mismatch: ${localManifest.name}`);
      verify(localManifest.version === approved.version, `Approved tool package version mismatch: ${localManifest.version}`);
      verify(localManifest.private === true, `Approved local tool package must remain private: ${approved.packageName}`);
      verify(packagerManifest.overrides?.[approved.packageName] === `file:../${approved.sourcePath.split('/').at(-1)}`, `Windows packager override does not bind ${approved.packageName} to its reviewed local source.`);
      continue;
    }
    if (!node.isExternal) continue;
    graphTarballs += 1;
    externalTarballs += 1;
    let resolved;
    try { resolved = new URL(entry.resolved); }
    catch { verify(false, `Invalid resolved URL: ${graph.lockfilePath}:${packagePath}=${entry.resolved}`); continue; }
    verify(resolved.protocol === 'https:', `External package is not HTTPS: ${graph.lockfilePath}:${packagePath}`);
    verify(resolved.hostname === canonicalRegistryHost, `External package is not pinned to ${canonicalRegistryHost}: ${graph.lockfilePath}:${packagePath}`);
    verify(/^sha512-[A-Za-z0-9+/]+={0,2}$/u.test(String(entry.integrity ?? '')), `External package lacks SHA-512 integrity: ${graph.lockfilePath}:${packagePath}`);
    verify(typeof entry.license === 'string' && entry.license.length > 0, `External package lacks declared license metadata: ${graph.lockfilePath}:${packagePath}`);
  }
  graphCounts.push({ scope: graph.scope, packages: graph.nodes.length, externalTarballs: graphTarballs, lockSha256: graph.lockSha256 });
}
verify(externalTarballs > 0, 'No external tarball entries were inspected.');
verify(graphCounts.length === 2 && graphCounts.every((item) => item.externalTarballs > 0), 'Both supply graphs must contain reviewed external tarballs.');

if (failures.length > 0) {
  console.error(`Dependency supply verification failed with ${failures.length} issue(s):`);
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}
console.log(`Dependency supply verified: ${checks} assertions / ${externalTarballs} canonical external tarballs / ${graphCounts.length} lock graphs.`);
for (const graph of graphCounts) console.log(`- ${graph.scope}: ${graph.packages} packages / ${graph.externalTarballs} tarballs / ${graph.lockSha256.slice(0, 12)}`);

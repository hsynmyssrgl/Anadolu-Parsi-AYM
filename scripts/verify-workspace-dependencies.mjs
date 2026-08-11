import { readFile, readdir, stat } from 'node:fs/promises';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const readJson = async (path) => JSON.parse(await readFile(path, 'utf8'));
const rootManifest = await readJson(join(root, 'package.json'));
const lock = await readJson(join(root, 'package-lock.json'));
const expectedVersion = rootManifest.version;
let assertions = 0;

const assert = (condition, message) => {
  assertions += 1;
  if (!condition) throw new Error(message);
};

const workspaceDirs = [];
for (const pattern of rootManifest.workspaces ?? []) {
  const [parent, wildcard] = pattern.split('/');
  assert(wildcard === '*', `Unsupported workspace pattern: ${pattern}`);
  for (const entry of await readdir(join(root, parent), { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const dir = join(root, parent, entry.name);
    try {
      await stat(join(dir, 'package.json'));
      workspaceDirs.push(dir);
    } catch {
      // Ignore folders that are not workspaces.
    }
  }
}
workspaceDirs.sort();

const workspaces = new Map();
for (const dir of workspaceDirs) {
  const manifest = await readJson(join(dir, 'package.json'));
  assert(typeof manifest.name === 'string' && manifest.name.startsWith('@ppt/'), `Invalid workspace name: ${dir}`);
  assert(manifest.version === expectedVersion, `${manifest.name} version mismatch: ${manifest.version}`);
  assert(manifest.private === true, `${manifest.name} must remain private.`);
  assert(manifest.type === 'module', `${manifest.name} must use ESM.`);
  assert(!workspaces.has(manifest.name), `Duplicate workspace name: ${manifest.name}`);
  workspaces.set(manifest.name, { dir, manifest });
}
assert(workspaces.size === workspaceDirs.length, `Workspace discovery mismatch: ${workspaces.size} names / ${workspaceDirs.length} directories.`);

const codeExtensions = new Set(['.ts', '.tsx', '.mts', '.cts', '.js', '.mjs', '.cjs']);
const ignoredDirs = new Set(['node_modules', 'dist', 'release', 'coverage', 'artifacts']);
const walk = async (dir) => {
  const files = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    if (entry.isDirectory() && (ignoredDirs.has(entry.name) || entry.name.startsWith('.tmp'))) continue;
    const path = join(dir, entry.name);
    if (entry.isDirectory()) files.push(...await walk(path));
    else if (codeExtensions.has(entry.name.slice(entry.name.lastIndexOf('.')))) files.push(path);
  }
  return files;
};

const importPattern = /(?:\bfrom\s*|\bimport\s*\(\s*|\brequire\s*\(\s*)['"](@ppt\/[^'"\s)]+)['"]/g;
const parseInternalImports = async (files) => {
  const imports = [];
  for (const file of files) {
    const text = await readFile(file, 'utf8');
    for (const match of text.matchAll(importPattern)) {
      const specifier = match[1];
      const parts = specifier.split('/');
      imports.push({ file, specifier, packageName: parts.slice(0, 2).join('/'), subpath: parts.slice(2).join('/') });
    }
    const crossWorkspaceRelative = /(?:\bfrom\s*|\bimport\s*\(\s*)['"]((?:\.\.\/){3,}(?:packages|apps)\/[^'"]+)['"]/g;
    for (const match of text.matchAll(crossWorkspaceRelative)) {
      throw new Error(`Cross-workspace relative import is forbidden: ${relative(root, file)} -> ${match[1]}`);
    }
  }
  return imports;
};

const productionGraph = new Map([...workspaces.keys()].map((name) => [name, new Set()]));
for (const [name, workspace] of workspaces) {
  const allFiles = await walk(workspace.dir);
  const sourcePrefix = join(workspace.dir, 'src') + sep;
  const productionFiles = allFiles.filter((file) => file.startsWith(sourcePrefix));
  const supportFiles = allFiles.filter((file) => !file.startsWith(sourcePrefix));
  const productionImports = await parseInternalImports(productionFiles);
  const supportImports = await parseInternalImports(supportFiles);

  const productionDeclared = new Set([
    ...Object.keys(workspace.manifest.dependencies ?? {}),
    ...Object.keys(workspace.manifest.peerDependencies ?? {}),
    ...Object.keys(workspace.manifest.optionalDependencies ?? {})
  ].filter((dependency) => dependency.startsWith('@ppt/')));
  const developmentDeclared = new Set(Object.keys(workspace.manifest.devDependencies ?? {}).filter((dependency) => dependency.startsWith('@ppt/')));
  const usedProduction = new Set(productionImports.map((entry) => entry.packageName).filter((dependency) => dependency !== name));
  const usedSupport = new Set(supportImports.map((entry) => entry.packageName).filter((dependency) => dependency !== name));

  for (const dependency of usedProduction) {
    assert(workspaces.has(dependency), `${name} imports unknown workspace ${dependency}.`);
    assert(productionDeclared.has(dependency), `${name} production source imports ${dependency} without declaring it in production dependencies.`);
    productionGraph.get(name).add(dependency);
  }
  for (const dependency of usedSupport) {
    assert(workspaces.has(dependency), `${name} support source imports unknown workspace ${dependency}.`);
    assert(productionDeclared.has(dependency) || developmentDeclared.has(dependency), `${name} tests/tools import ${dependency} without declaring it.`);
  }
  for (const dependency of productionDeclared) {
    assert(usedProduction.has(dependency), `${name} declares unused internal production dependency ${dependency}.`);
  }
  for (const dependency of developmentDeclared) {
    assert(usedSupport.has(dependency), `${name} declares unused internal development dependency ${dependency}.`);
  }

  for (const section of ['dependencies', 'devDependencies', 'peerDependencies', 'optionalDependencies']) {
    for (const [dependency, version] of Object.entries(workspace.manifest[section] ?? {})) {
      if (!dependency.startsWith('@ppt/')) continue;
      assert(workspaces.has(dependency), `${name} declares unknown internal dependency ${dependency}.`);
      assert(version === expectedVersion, `${name} ${section}.${dependency} must equal ${expectedVersion}; found ${version}.`);
    }
  }

  const lockPath = relative(root, workspace.dir).split(sep).join('/');
  const lockEntry = lock.packages?.[lockPath];
  assert(Boolean(lockEntry), `package-lock entry missing for ${name} (${lockPath}).`);
  for (const section of ['dependencies', 'devDependencies', 'peerDependencies', 'optionalDependencies']) {
    const manifestInternal = Object.fromEntries(Object.entries(workspace.manifest[section] ?? {}).filter(([dependency]) => dependency.startsWith('@ppt/')));
    const lockInternal = Object.fromEntries(Object.entries(lockEntry?.[section] ?? {}).filter(([dependency]) => dependency.startsWith('@ppt/')));
    assert(JSON.stringify(manifestInternal) === JSON.stringify(lockInternal), `${name} ${section} differs between package.json and package-lock.json.`);
  }

  for (const entry of [...productionImports, ...supportImports]) {
    if (!entry.subpath) continue;
    const target = workspaces.get(entry.packageName);
    const exportKey = `./${entry.subpath}`;
    assert(Boolean(target.manifest.exports?.[exportKey]), `${relative(root, entry.file)} imports ${entry.specifier}, but ${entry.packageName} does not export ${exportKey}.`);
  }
}

const visiting = new Set();
const visited = new Set();
const stack = [];
const visit = (name) => {
  if (visited.has(name)) return;
  if (visiting.has(name)) {
    const start = stack.indexOf(name);
    throw new Error(`Production workspace dependency cycle: ${[...stack.slice(start), name].join(' -> ')}`);
  }
  visiting.add(name);
  stack.push(name);
  for (const dependency of productionGraph.get(name) ?? []) visit(dependency);
  stack.pop();
  visiting.delete(name);
  visited.add(name);
};
for (const name of productionGraph.keys()) visit(name);
assert(visited.size === workspaces.size, 'Not every workspace was included in cycle analysis.');

const applicationTests = await walk(join(root, 'packages/application/tests'));
const applicationTestImports = await parseInternalImports(applicationTests);
for (const forbidden of ['@ppt/infrastructure', '@ppt/database', '@ppt/repositories']) {
  assert(!applicationTestImports.some((entry) => entry.packageName === forbidden), `Application tests must not depend upward on ${forbidden}.`);
}

console.log(`Workspace dependency contracts verified: ${assertions} assertions / ${workspaces.size} workspaces / acyclic production graph.`);

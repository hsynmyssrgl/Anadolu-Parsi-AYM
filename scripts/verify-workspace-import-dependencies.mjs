import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';

const readJson = async (path) => JSON.parse(await readFile(path, 'utf8'));
const workspaceByName = new Map();
const failures = [];
let checks = 0;
const verify = (condition, message) => { checks += 1; if (!condition) failures.push(message); };

for (const parent of ['apps', 'packages']) {
  for (const entry of await readdir(parent, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const root = join(parent, entry.name);
    const manifest = await readJson(join(root, 'package.json'));
    workspaceByName.set(manifest.name, { root, manifest });
  }
}

const sourceFiles = async (directory) => {
  const result = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) result.push(...await sourceFiles(path));
    else if (/\.(?:ts|tsx|mts|cts|js|jsx|mjs|cjs)$/.test(entry.name)) result.push(path);
  }
  return result;
};

const internalRoot = (specifier) => {
  if (!specifier.startsWith('@ppt/')) return undefined;
  return specifier.split('/').slice(0, 2).join('/');
};

for (const [workspaceName, workspace] of workspaceByName) {
  const declared = new Set();
  for (const section of ['dependencies', 'devDependencies', 'peerDependencies', 'optionalDependencies']) {
    for (const dependencyName of Object.keys(workspace.manifest[section] ?? {})) declared.add(dependencyName);
  }
  const srcRoot = join(workspace.root, 'src');
  let files = [];
  try { files = await sourceFiles(srcRoot); } catch { continue; }
  const imported = new Set();
  for (const file of files) {
    const source = await readFile(file, 'utf8');
    const patterns = [
      /(?:from\s+|import\s*\(\s*|export\s+[^;]*?from\s+)['"](@ppt\/[^'"]+)['"]/g,
      /import\s+['"](@ppt\/[^'"]+)['"]/g
    ];
    for (const pattern of patterns) {
      for (const match of source.matchAll(pattern)) {
        const dependencyName = internalRoot(match[1]);
        if (dependencyName) imported.add(dependencyName);
      }
    }
  }
  for (const dependencyName of imported) {
    verify(workspaceByName.has(dependencyName), `${workspaceName} imports unknown workspace ${dependencyName}`);
    if (dependencyName !== workspaceName) {
      verify(declared.has(dependencyName), `${workspaceName} imports ${dependencyName} but does not declare it in package.json`);
    }
  }
}

if (failures.length > 0) {
  console.error(`Workspace import/dependency verification failed with ${failures.length} issue(s):`);
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}
console.log(`Workspace import/dependency alignment verified: ${checks} assertions across ${workspaceByName.size} workspaces.`);

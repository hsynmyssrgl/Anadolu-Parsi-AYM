import { readFile, writeFile } from 'node:fs/promises';

const lockPath = process.argv[2] ?? 'package-lock.json';
const canonicalRegistry = 'https://registry.npmjs.org';
const lock = JSON.parse(await readFile(lockPath, 'utf8'));
let changed = 0;
let inspected = 0;

const packageNameFromLockPath = (packagePath) => {
  const marker = 'node_modules/';
  const index = packagePath.lastIndexOf(marker);
  if (index < 0) return undefined;
  const remainder = packagePath.slice(index + marker.length);
  const segments = remainder.split('/');
  if (segments[0]?.startsWith('@')) return segments.length >= 2 ? `${segments[0]}/${segments[1]}` : undefined;
  return segments[0] || undefined;
};

for (const [packagePath, entry] of Object.entries(lock.packages ?? {})) {
  if (!entry || typeof entry !== 'object' || entry.link === true || !entry.resolved) continue;
  let current;
  try {
    current = new URL(entry.resolved);
  } catch {
    continue;
  }
  if (!current.pathname.endsWith('.tgz')) continue;
  const packageName = packageNameFromLockPath(packagePath);
  if (!packageName) continue;
  inspected += 1;
  const archiveName = decodeURIComponent(current.pathname.split('/').at(-1) ?? '');
  if (!archiveName.endsWith('.tgz')) continue;
  const canonical = `${canonicalRegistry}/${packageName}/-/${archiveName}`;
  if (entry.resolved !== canonical) {
    entry.resolved = canonical;
    changed += 1;
  }
}

await writeFile(lockPath, `${JSON.stringify(lock, null, 2)}\n`);
console.log(`Lockfile registry URLs canonicalized: ${changed} changed / ${inspected} external tarballs inspected.`);

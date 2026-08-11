import { rm } from 'node:fs/promises';
import { isAbsolute, relative, resolve, sep } from 'node:path';

const targets = process.argv.slice(2);
if (targets.length === 0) throw new Error('At least one repository-relative directory is required.');

const root = resolve(process.cwd());
const normalizeRelativeTarget = (target) => {
  if (typeof target !== 'string' || target.trim().length === 0) throw new Error('Directory target must be a non-empty string.');
  if (isAbsolute(target)) throw new Error(`Absolute directory targets are forbidden: ${target}`);
  const resolvedTarget = resolve(root, target);
  const relativeTarget = relative(root, resolvedTarget);
  if (relativeTarget === '' || relativeTarget === '.' || relativeTarget === '..' || relativeTarget.startsWith(`..${sep}`)) {
    throw new Error(`Directory target must stay inside the repository and cannot be the repository root: ${target}`);
  }
  return { input: target, path: resolvedTarget, relative: relativeTarget };
};

const normalizedTargets = targets.map(normalizeRelativeTarget);
for (const target of normalizedTargets) {
  await rm(target.path, { recursive: true, force: true });
  console.log(`Repository directory cleaned: ${target.relative}`);
}

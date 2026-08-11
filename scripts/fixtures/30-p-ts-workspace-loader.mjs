import { existsSync } from 'node:fs';
import { dirname, resolve as resolvePath } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const repoRoot = resolvePath(dirname(fileURLToPath(import.meta.url)), '..', '..');
const workspaceSources = new Map([
  ['@ppt/contracts', 'packages/contracts/src/index.ts'],
  ['@ppt/core', 'packages/core/src/index.ts'],
  ['@ppt/database', 'packages/database/src/index.ts'],
  ['@ppt/domain', 'packages/domain/src/index.ts'],
  ['@ppt/events', 'packages/events/src/index.ts'],
  ['@ppt/platform-policy', 'packages/platform-policy/src/index.ts'],
  ['@ppt/repository-contracts', 'packages/repository-contracts/src/index.ts'],
  ['@ppt/repositories', 'packages/repositories/src/index.ts']
]);

export async function resolve(specifier, context, nextResolve) {
  const mapped = workspaceSources.get(specifier);
  if (mapped) {
    return {
      url: pathToFileURL(resolvePath(repoRoot, mapped)).href,
      shortCircuit: true
    };
  }
  try {
    return await nextResolve(specifier, context);
  } catch (error) {
    if (specifier.endsWith('.js') && context.parentURL?.startsWith('file:')) {
      const candidate = new URL(specifier.replace(/\.js$/u, '.ts'), context.parentURL);
      if (existsSync(fileURLToPath(candidate))) {
        return { url: candidate.href, shortCircuit: true };
      }
    }
    throw error;
  }
}

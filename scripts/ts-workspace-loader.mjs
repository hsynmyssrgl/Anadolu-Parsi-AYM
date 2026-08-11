import { existsSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { resolve as resolvePath } from 'node:path';

const root = resolvePath(fileURLToPath(new URL('..', import.meta.url)));
const workspaceSources = new Map([
  ['@ppt/platform-policy', 'packages/platform-policy/src/index.ts'],
  ['@ppt/core-service-contracts', 'packages/core-service-contracts/src/index.ts'],
  ['@ppt/core-service-client', 'packages/core-service-client/src/index.ts']
]);

export async function resolve(specifier, context, nextResolve) {
  const mapped = workspaceSources.get(specifier);
  if (mapped) return { url: pathToFileURL(resolvePath(root, mapped)).href, shortCircuit: true };
  try {
    return await nextResolve(specifier, context);
  } catch (error) {
    if (specifier.endsWith('.js') && context.parentURL?.startsWith('file:')) {
      const candidate = new URL(specifier.replace(/\.js$/, '.ts'), context.parentURL);
      if (existsSync(fileURLToPath(candidate))) return { url: candidate.href, shortCircuit: true };
    }
    throw error;
  }
}

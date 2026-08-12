import { isAbsolute, relative, resolve } from 'node:path';

export const PRIMARY_RENDERER_SCHEME = 'pardus-app';
export const PRIMARY_RENDERER_HOST = 'renderer';
export const PRIMARY_RENDERER_ORIGIN = `${PRIMARY_RENDERER_SCHEME}://${PRIMARY_RENDERER_HOST}`;
export const PRIMARY_RENDERER_DOCUMENT_URL = `${PRIMARY_RENDERER_ORIGIN}/index.html`;

export function resolvePrimaryRendererAssetPath(requestUrl: string, rendererRoot: string): string | null {
  try {
    const requested = new URL(requestUrl);
    if (
      requested.protocol !== `${PRIMARY_RENDERER_SCHEME}:`
      || requested.hostname !== PRIMARY_RENDERER_HOST
      || requested.username !== ''
      || requested.password !== ''
      || requested.port !== ''
    ) return null;

    const decodedPath = decodeURIComponent(requested.pathname === '/' ? '/index.html' : requested.pathname);
    if (decodedPath.includes('\0')) return null;
    const normalizedRoot = resolve(rendererRoot);
    const candidate = resolve(normalizedRoot, `.${decodedPath}`);
    const relativePath = relative(normalizedRoot, candidate);
    if (relativePath.startsWith('..') || isAbsolute(relativePath)) return null;
    return candidate;
  } catch {
    return null;
  }
}

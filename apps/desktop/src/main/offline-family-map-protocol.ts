import { closeSync, lstatSync, openSync, readSync, realpathSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';

export const OFFLINE_FAMILY_MAP_PATH = '/offline-map/turkiye.pmtiles';
export const OFFLINE_FAMILY_MAP_URL = `pardus-app://renderer${OFFLINE_FAMILY_MAP_PATH}`;
export const OFFLINE_FAMILY_MAP_RELATIVE_PATH = join('haritalar', 'turkiye.pmtiles');

const MAX_PACKAGE_BYTES = 8 * 1024 * 1024 * 1024;
const MAX_RANGE_BYTES = 16 * 1024 * 1024;
const PMTILES_MAGIC = new TextEncoder().encode('PMTiles');

function notFound(): Response {
  return new Response('Not found', {
    status: 404,
    headers: { 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' }
  });
}

function notInstalled(): Response {
  return new Response(null, {
    status: 204,
    headers: { 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' }
  });
}

function isMissingFile(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === 'ENOENT';
}

function rangeNotSatisfiable(size: number): Response {
  return new Response(null, {
    status: 416,
    headers: {
      'accept-ranges': 'bytes',
      'content-range': `bytes */${size}`,
      'cache-control': 'no-store',
      'x-content-type-options': 'nosniff'
    }
  });
}

function parseSingleRange(value: string | null, size: number): { start: number; end: number } | null {
  if (!value) return null;
  const match = /^bytes=(0|[1-9]\d*)-(0|[1-9]\d*)$/.exec(value);
  if (!match) return null;
  const start = Number(match[1]);
  const requestedEnd = Number(match[2]);
  if (!Number.isSafeInteger(start) || !Number.isSafeInteger(requestedEnd) || start > requestedEnd || start >= size) return null;
  const end = Math.min(requestedEnd, size - 1);
  if (end - start + 1 > MAX_RANGE_BYTES) return null;
  return { start, end };
}

function hasPmtilesMagic(filePath: string): boolean {
  const descriptor = openSync(filePath, 'r');
  try {
    const prefix = Buffer.alloc(PMTILES_MAGIC.byteLength);
    if (readSync(descriptor, prefix, 0, prefix.byteLength, 0) !== prefix.byteLength) return false;
    return prefix.every((value, index) => value === PMTILES_MAGIC[index]);
  } finally {
    closeSync(descriptor);
  }
}

function readBoundedRange(filePath: string, start: number, length: number): ArrayBuffer {
  const descriptor = openSync(filePath, 'r');
  try {
    const result = Buffer.allocUnsafe(length);
    let offset = 0;
    while (offset < length) {
      const read = readSync(descriptor, result, offset, length - offset, start + offset);
      if (read === 0) throw new Error('Harita paketi beklenenden erken sona erdi.');
      offset += read;
    }
    const transferable = new ArrayBuffer(length);
    new Uint8Array(transferable).set(result);
    return transferable;
  } finally {
    closeSync(descriptor);
  }
}

export function respondToOfflineFamilyMapRequest(request: Request, userDataPath: string): Response | null {
  let requested: URL;
  try {
    requested = new URL(request.url);
  } catch {
    return null;
  }
  if (requested.protocol !== 'pardus-app:' || requested.hostname !== 'renderer' || requested.pathname !== OFFLINE_FAMILY_MAP_PATH) return null;
  if (requested.username || requested.password || requested.port || requested.search || requested.hash) return notFound();
  if (request.method !== 'GET' && request.method !== 'HEAD') return notFound();

  const mapRoot = resolve(userDataPath, 'haritalar');
  const filePath = resolve(userDataPath, OFFLINE_FAMILY_MAP_RELATIVE_PATH);
  try {
    const rootRealPath = realpathSync(mapRoot);
    const parentRealPath = realpathSync(dirname(filePath));
    const fileRealPath = realpathSync(filePath);
    const metadata = lstatSync(filePath);
    if (rootRealPath !== parentRealPath || fileRealPath !== filePath || metadata.isSymbolicLink() || !metadata.isFile() || metadata.nlink !== 1) return notFound();
    if (!Number.isSafeInteger(metadata.size) || metadata.size < 127 || metadata.size > MAX_PACKAGE_BYTES || !hasPmtilesMagic(filePath)) return notFound();

    const commonHeaders = {
      'accept-ranges': 'bytes',
      'cache-control': 'private, max-age=31536000, immutable',
      'content-type': 'application/vnd.pmtiles',
      etag: `"${metadata.size.toString(16)}-${Math.trunc(metadata.mtimeMs).toString(16)}"`,
      'x-content-type-options': 'nosniff'
    };
    if (request.method === 'HEAD') {
      return new Response(null, { status: 200, headers: { ...commonHeaders, 'content-length': String(metadata.size) } });
    }

    const range = parseSingleRange(request.headers.get('range'), metadata.size);
    if (!range) return rangeNotSatisfiable(metadata.size);
    const length = range.end - range.start + 1;
    return new Response(readBoundedRange(filePath, range.start, length), {
      status: 206,
      headers: {
        ...commonHeaders,
        'content-length': String(length),
        'content-range': `bytes ${range.start}-${range.end}/${metadata.size}`
      }
    });
  } catch (error) {
    return isMissingFile(error) ? notInstalled() : notFound();
  }
}

import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const root = resolve(process.cwd());
if (root !== resolve('C:/PPT/AYM/06_KOD/app')) throw new Error(`WORKSPACE_ROOT_MISMATCH:${root}`);

const target = resolve(root, 'scripts/apply-ppk002-timeline-repository-foundation.mjs');
const source = await readFile(target, 'utf8');
const startMarker = 'const repository = `';
const endMarker = '\n`;\nset(repositoryPath, repository);';
const start = source.indexOf(startMarker);
const end = source.indexOf(endMarker, start + startMarker.length);
if (start < 0 || end < 0) throw new Error('GENERATOR_REPOSITORY_TEMPLATE_BOUNDARY_MISSING');

const bodyStart = start + startMarker.length;
const body = source.slice(bodyStart, end);
const escaped = body
  .replace(/(?<!\\)`/gu, '\\`')
  .replace(/(?<!\\)\$\{/gu, '\\${');
const repaired = source.slice(0, bodyStart) + escaped + source.slice(end);
await writeFile(target, repaired, 'utf8');
console.log('PPK-002 timeline foundation generator template escaped; no product source changed.');

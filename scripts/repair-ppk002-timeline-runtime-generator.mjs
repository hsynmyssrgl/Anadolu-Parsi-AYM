import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const root = resolve(process.cwd());
if (root !== resolve('C:/PPT/AYM/06_KOD/app')) throw new Error(`WORKSPACE_ROOT_MISMATCH:${root}`);
const target = resolve(root, 'scripts/apply-ppk002-timeline-policy-runtime.mjs');
let source = await readFile(target, 'utf8');
const before = "if (runtime.includes('context.actor.role')) throw new Error('TIMELINE_RUNTIME_LEGACY_ROLE_ACCESS_REMAINS');";
const after = "if (/context\\.actor\\.role\\b/u.test(runtime)) throw new Error('TIMELINE_RUNTIME_LEGACY_ROLE_ACCESS_REMAINS');";
if (!source.includes(after)) {
  if (!source.includes(before)) throw new Error('RUNTIME_GENERATOR_REPAIR_ANCHOR_MISSING');
  source = source.replace(before, after);
  await writeFile(target, source, 'utf8');
}
console.log('PPK-002 timeline runtime generator role assertion repaired; no product source changed.');

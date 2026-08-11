import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const expectedRoot = 'C:\\PPT\\AYM\\06_KOD\\app';
const root = resolve(process.cwd());
if (root.toLocaleLowerCase('en-US') !== expectedRoot.toLocaleLowerCase('en-US')) {
  throw new Error(`PPK-002 verifier clock repair must run from ${expectedRoot}; received ${root}`);
}
const path = resolve(root, 'scripts', 'verify-ppk002-timeline-policy-local-continuation.mjs');
const source = readFileSync(path, 'utf8');
const before = "clock: new FixedClock(asIsoDateTime('2026-08-10T06:00:00.000Z'))";
const after = "clock: new FixedClock(asIsoDateTime('2026-07-23T12:00:00.000Z'))";
if (source.includes(after)) {
  console.log('PPK-002 local verifier already uses the active membership checkpoint clock.');
  process.exit(0);
}
if (!source.includes(before) || source.indexOf(before) !== source.lastIndexOf(before)) {
  throw new Error('Unexpected PPK-002 local verifier clock anchor');
}
writeFileSync(path, source.replace(before, after), 'utf8');
console.log('PPK-002 local verifier clock aligned with the active membership checkpoint.');

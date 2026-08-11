import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const expectedRoot = 'C:\\PPT\\AYM\\06_KOD\\app';
const root = resolve(process.cwd());
if (root.toLocaleLowerCase('en-US') !== expectedRoot.toLocaleLowerCase('en-US')) {
  throw new Error(`PPK-002 test capability repair must run from ${expectedRoot}; received ${root}`);
}

const path = resolve(root, 'scripts/lib/archive-policy-test-harness.mjs');
const source = readFileSync(path, 'utf8');
const before = "    'windows-desktop': ['archive.write', 'family.write', 'location.read']";
const after = "    'windows-desktop': ['archive.write', 'family.read', 'family.write', 'location.read']";
if (source.includes(after)) {
  console.log('PPK-002 timeline read capability is already present in the shared policy test harness.');
  process.exit(0);
}
if (!source.includes(before) || source.indexOf(before) !== source.lastIndexOf(before)) {
  throw new Error('Unexpected archive policy test harness capability anchor');
}
writeFileSync(path, source.replace(before, after), 'utf8');
console.log('PPK-002 family.read capability added to the shared governed policy test harness.');

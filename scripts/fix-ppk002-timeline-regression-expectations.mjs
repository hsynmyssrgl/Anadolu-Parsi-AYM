import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const expectedRoot = 'C:\\PPT\\AYM\\06_KOD\\app';
const root = resolve(process.cwd());
if (root.toLocaleLowerCase('en-US') !== expectedRoot.toLocaleLowerCase('en-US')) {
  throw new Error(`PPK-002 regression repair must run from ${expectedRoot}; received ${root}`);
}

const path = resolve(root, 'scripts/verify-timeline-use-cases.mjs');
const source = readFileSync(path, 'utf8');
const before = `  await check('unknown important day detail is not exposed', async () => {
    await assert.rejects(() => store.getImportantDayDetails('missing-event'), /RESOURCE-NOT-FOUND-001/);
  });`;
const after = `  await check('unknown important day detail fails closed before resource disclosure', async () => {
    await assert.rejects(() => store.getImportantDayDetails('missing-event'), /PERMISSION-DENIED-001/);
  });`;
if (source.includes(after)) {
  console.log('PPK-002 fail-closed timeline detail regression expectation is already active.');
  process.exit(0);
}
if (!source.includes(before) || source.indexOf(before) !== source.lastIndexOf(before)) {
  throw new Error('Unexpected timeline missing-detail regression anchor');
}
writeFileSync(path, source.replace(before, after), 'utf8');
console.log('PPK-002 missing timeline detail regression now requires fail-closed policy denial.');

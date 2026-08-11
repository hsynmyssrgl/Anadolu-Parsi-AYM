import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const expectedRoot = 'C:\\PPT\\AYM\\06_KOD\\app';
const root = resolve(process.cwd());
if (root.toLocaleLowerCase('en-US') !== expectedRoot.toLocaleLowerCase('en-US')) {
  throw new Error(`PPK-002 import repair must run from ${expectedRoot}; received ${root}`);
}

const path = resolve(root, 'apps/desktop/src/main/family-data-import-service.ts');
const source = readFileSync(path, 'utf8');
const startAnchor = '      for (const row of currentPlan.events) {';
const endAnchor = "      const audit = this.dependencies.auditRepository.append(repository, { id: randomUUID(), action: 'family_data.import_applied'";

if (!source.includes(startAnchor)) {
  if (!source.includes("if (currentPlan.events.length > 0) return err(createAppError")) {
    throw new Error('PPK-002 fail-closed event import guard is missing');
  }
  console.log('PPK-002 unauthorized timeline import write was already absent.');
  process.exit(0);
}

const start = source.indexOf(startAnchor);
const end = source.indexOf(endAnchor, start);
if (start < 0 || end < 0 || start !== source.lastIndexOf(startAnchor)) {
  throw new Error('Unexpected PPK-002 event import write anchors');
}

writeFileSync(path, `${source.slice(0, start)}${source.slice(end)}`, 'utf8');
console.log('PPK-002 unauthorized timeline import write removed; fail-closed guard retained.');

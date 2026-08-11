import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const path = resolve(import.meta.dirname, '..', 'packages/repositories/src/timeline-repository.ts');
let source = readFileSync(path, 'utf8');

const replacements = [
  ["    familyAdmin: context.policyAuthorization.subject.roles.includes('family_admin') ? 1 : 0,\n", '', 'direct role projection'],
  ['    OR ?=1\n', '', 'family-admin SQL bypass'],
  ['  binding.familyAdmin,\n', '', 'family-admin SQL parameter']
];
for (const [before, after, label] of replacements) {
  if (!source.includes(before)) {
    if (after && source.includes(after)) continue;
    throw new Error(`Missing ${label}`);
  }
  source = source.replace(before, after);
}

writeFileSync(path, source, 'utf8');
console.log('Timeline direct role bypass removed');

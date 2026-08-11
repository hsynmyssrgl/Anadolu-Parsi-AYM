import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const expectedRoot = 'C:\\PPT\\AYM\\06_KOD\\app';
const root = resolve(process.cwd());
if (root.toLocaleLowerCase('en-US') !== expectedRoot.toLocaleLowerCase('en-US')) {
  throw new Error(`PPK-002 evidence binding repair must run from ${expectedRoot}; received ${root}`);
}

const mutate = (relativePath, operation) => {
  const path = resolve(root, relativePath);
  const source = readFileSync(path, 'utf8');
  const next = operation(source);
  if (next === source) return false;
  writeFileSync(path, next, 'utf8');
  return true;
};

const changed = [];
if (mutate('packages/application/src/timeline-use-cases.ts', (source) => {
  const next = source
    .replaceAll("resourceType: 'timeline_event'", "resourceType: 'event'")
    .replaceAll("resourceType:'timeline_event'", "resourceType:'event'")
    .replaceAll("aggregateType: 'timeline_event'", "aggregateType: 'event'")
    .replaceAll("aggregateType:'timeline_event'", "aggregateType:'event'");
  if (next.includes("resourceType: 'timeline_event'") || next.includes("aggregateType: 'timeline_event'")) {
    throw new Error('Legacy timeline evidence resource alias remains in timeline use cases');
  }
  return next;
})) changed.push('packages/application/src/timeline-use-cases.ts');

if (mutate('packages/repositories/src/timeline-repository.ts', (source) => source
  .replaceAll("denied.resource_type='event'", "denied.resource_type IN ('event','timeline_event')")
  .replaceAll("allowed.resource_type='event'", "allowed.resource_type IN ('event','timeline_event')")
)) changed.push('packages/repositories/src/timeline-repository.ts');

console.log(`PPK-002 canonical event policy binding applied (${changed.length} files changed; legacy permission aliases remain readable).`);

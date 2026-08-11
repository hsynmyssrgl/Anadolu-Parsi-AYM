import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const path = resolve(import.meta.dirname, 'verify-30-z-location-policy-enforcement-contract.mjs');
const source = readFileSync(path, 'utf8');
const before = "  'input.command.locationId ? { governedLocationReadId: input.command.locationId } : undefined',";
const after = "  '...(input.command.locationId ? { governedLocationReadId: input.command.locationId } : {})',";
if (!source.includes(after)) {
  if (!source.includes(before)) throw new Error('Missing governed location option anchor');
  writeFileSync(path, source.replace(before, after), 'utf8');
}
console.log('30-Z governed location option anchor repaired');

import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');

const protectPath = resolve(root, 'scripts/protect-authoritative-source.mjs');
let protect = readFileSync(protectPath, 'utf8');
const oldExclusions = "  '.git', '.cache', '.turbo', 'coverage', 'dist', 'node_modules', 'temp', 'tmp'";
const newExclusions = "  '.git', '.cache', '.tmp', '.turbo', 'coverage', 'dist', 'node_modules', 'temp', 'tmp'";
if (!protect.includes(newExclusions)) {
  if (!protect.includes(oldExclusions)) throw new Error('Missing source protection exclusion anchor');
  protect = protect.replace(oldExclusions, newExclusions);
  writeFileSync(protectPath, protect, 'utf8');
}

const governancePath = resolve(root, 'scripts/update-aym-governance-incrementally.mjs');
let governance = readFileSync(governancePath, 'utf8');
const oldScan = `const scanMetadata = async () => {
  const files = [];
  const excluded = new Set([...manifestOutputs, rootRelative(paths.incrementalEvidence)]);`;
const newScan = `const scanMetadata = async () => {
  const files = [];
  const excluded = new Set([...manifestOutputs, rootRelative(paths.incrementalEvidence)]);
  const activeSourceEphemeral = new Set([
    '.git', '.cache', '.tmp', '.turbo', 'coverage', 'dist', 'node_modules', 'temp', 'tmp'
  ]);`;
if (!governance.includes(newScan)) {
  if (!governance.includes(oldScan)) throw new Error('Missing incremental scan anchor');
  governance = governance.replace(oldScan, newScan);
}
const oldVisit = `      const rel = rootRelative(absolute);
      if (excluded.has(rel)) continue;
      if (entry.isSymbolicLink()) throw new Error(\`Symbolic link is forbidden in live manifest: \${rel}\`);`;
const newVisit = `      const rel = rootRelative(absolute);
      if (excluded.has(rel)) continue;
      if (rel.startsWith('06_KOD/app/')) {
        const activeSourceTopLevel = rel.slice('06_KOD/app/'.length).split('/')[0];
        if (activeSourceEphemeral.has(activeSourceTopLevel)) continue;
      }
      if (entry.isSymbolicLink()) throw new Error(\`Symbolic link is forbidden in live manifest: \${rel}\`);`;
if (!governance.includes(newVisit)) {
  if (!governance.includes(oldVisit)) throw new Error('Missing incremental visit anchor');
  governance = governance.replace(oldVisit, newVisit);
}
writeFileSync(governancePath, governance, 'utf8');

console.log('AYM incremental manifest and source protection ephemeral exclusions aligned');

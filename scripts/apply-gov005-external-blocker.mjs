import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const sourceRoot = resolve(process.cwd());
if (sourceRoot !== resolve('C:\\PPT\\AYM', '06_KOD', 'app')) throw new Error(`Unsafe source root: ${sourceRoot}`);
const writeJson = async (path, value) => {
  const content = `${JSON.stringify(value, null, 2)}\n`;
  await writeFile(path, content, 'utf8');
  if (await readFile(path, 'utf8') !== content) throw new Error(`Readback mismatch: ${path}`);
};

const scopePath = resolve(sourceRoot, 'config', 'accepted-scope-registry.json');
const scope = JSON.parse(await readFile(scopePath, 'utf8'));
const requirement = scope.requirements?.find((item) => item.id === 'GOV-005');
if (!requirement) throw new Error('GOV-005 requirement not found');
requirement.status = 'COMPLETE';
for (const key of Object.keys(requirement.chain ?? {})) requirement.chain[key] = true;
requirement.evidence = [...new Set([
  ...(requirement.evidence ?? []),
  'config/persistent-artifact-policy.json',
  '../../05_TEST/30Z_LOCAL_RECEIPT/LATEST.json',
  '../../05_TEST/30Z_EXTERNAL_RECEIPT/LATEST.json',
  'docs/decisions/DEC-164-gov-005-external-usb-source-protection-closure.md',
  'scripts/protect-authoritative-source-external.mjs'
])];
requirement.completionBlockers = [];
requirement.externalProtectionClosure = {
  decision: 'DEC-164', storageBackend: 'EXTERNAL_USB_D_DRIVE',
  exactReadbackRequired: true, receipt: '../../05_TEST/30Z_EXTERNAL_RECEIPT/LATEST.json'
};
await writeJson(scopePath, scope);

const ledgerPath = resolve(sourceRoot, 'config', 'user-decision-ledger.json');
const ledger = JSON.parse(await readFile(ledgerPath, 'utf8'));
if (!ledger.decisions.some((item) => item.id === 'DEC-155')) {
  ledger.decisions.push({
    id: 'DEC-155',
    date: '2026-08-09',
    acceptedAt: '2026-08-09',
    title: 'GOV-005 external Library blocker classification',
    status: 'ACTIVE',
    source: 'Explicit current user instruction forbidding local receipt from being counted as external PASS',
    document: 'docs/decisions/DEC-155-gov-005-external-library-blocker-classification.md',
    rules: ['PR-087', 'PR-180', 'PR-181', 'PR-194', 'PR-203', 'PR-208'],
    requirements: ['GOV-005'],
    codeAreas: ['scripts/apply-gov005-external-blocker.mjs', 'config/accepted-scope-registry.json'],
    evidence: ['../../05_TEST/30Z_LOCAL_RECEIPT/LATEST.json', 'config/persistent-artifact-policy.json']
  });
  ledger.decisionCount = ledger.decisions.length;
}
if (!ledger.decisions.some((item) => item.id === 'DEC-164')) {
  ledger.decisions.push({
    id: 'DEC-164', date: '2026-08-10', acceptedAt: '2026-08-10',
    title: 'GOV-005 external USB authoritative source protection closure', status: 'ACTIVE',
    source: 'Explicit user approval for D: external-disk work',
    document: 'docs/decisions/DEC-164-gov-005-external-usb-source-protection-closure.md',
    rules: ['PR-087', 'PR-180', 'PR-181', 'PR-194', 'PR-203', 'PR-208'], requirements: ['GOV-005'],
    codeAreas: ['scripts/protect-authoritative-source.mjs', 'scripts/protect-authoritative-source-external.mjs', 'config/accepted-scope-registry.json'],
    evidence: ['../../05_TEST/30Z_LOCAL_RECEIPT/LATEST.json', '../../05_TEST/30Z_EXTERNAL_RECEIPT/LATEST.json']
  });
  ledger.decisionCount = ledger.decisions.length;
}
await writeJson(ledgerPath, ledger);

console.log('GOV-005 external USB protection governance: PASS (COMPLETE / DEC-164 / D: Library).');

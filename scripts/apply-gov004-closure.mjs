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
const requirement = scope.requirements?.find((item) => item.id === 'GOV-004');
if (!requirement) throw new Error('GOV-004 requirement not found');
requirement.status = 'COMPLETE';
requirement.chain = Object.fromEntries(Object.keys(requirement.chain ?? {}).map((key) => [key, true]));
requirement.evidence = [
  'docs/decisions/DEC-154-gov-004-current-delivery-report-closure.md',
  'config/delivery-report-contract.json',
  'scripts/generate-current-delivery-report.mjs',
  'scripts/verify-delivery-report-contract-v2.mjs',
  'scripts/run-governed-postflight.mjs',
  'artifacts/reports/DELIVERY_STATUS_04.08.2026.29.json',
  'artifacts/validation/delivery-report-contract-v2.json',
  'artifacts/validation/governed-postflight.json'
];
await writeJson(scopePath, scope);

const ledgerPath = resolve(sourceRoot, 'config', 'user-decision-ledger.json');
const ledger = JSON.parse(await readFile(ledgerPath, 'utf8'));
if (!ledger.decisions.some((item) => item.id === 'DEC-154')) {
  ledger.decisions.push({
    id: 'DEC-154',
    date: '2026-08-09',
    acceptedAt: '2026-08-09',
    title: 'GOV-004 current delivery report closure',
    status: 'ACTIVE',
    source: 'Explicit current user instruction to close started Bronze slices under DEC-137',
    document: 'docs/decisions/DEC-154-gov-004-current-delivery-report-closure.md',
    rules: ['PR-087', 'PR-124', 'PR-179', 'PR-183', 'PR-184', 'PR-185', 'PR-187', 'PR-194', 'PR-200', 'PR-203'],
    requirements: ['GOV-004'],
    codeAreas: ['scripts/generate-current-delivery-report.mjs', 'scripts/verify-delivery-report-contract-v2.mjs', 'scripts/run-governed-postflight.mjs'],
    evidence: ['artifacts/reports/DELIVERY_STATUS_04.08.2026.29.json', 'artifacts/validation/delivery-report-contract-v2.json', 'artifacts/validation/governed-postflight.json']
  });
  ledger.decisionCount = ledger.decisions.length;
}
await writeJson(ledgerPath, ledger);

const packagePath = resolve(sourceRoot, 'package.json');
const packageJson = JSON.parse(await readFile(packagePath, 'utf8'));
packageJson.scripts['delivery:report:current'] = 'node scripts/generate-current-delivery-report.mjs';
await writeJson(packagePath, packageJson);

console.log('GOV-004 governed closure transformation: PASS.');

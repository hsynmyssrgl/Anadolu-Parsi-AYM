import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { renderAttestationFileName, validateDeliveryAttestationContract } from './lib/delivery-attestation.mjs';
const args = process.argv.slice(2);
const option = (name, fallback) => { const i = args.indexOf(name); if (i < 0) return fallback; const v = args[i + 1]; if (!v || v.startsWith('--')) throw new Error(`${name} requires a value.`); return v; };
const root = resolve(option('--root', '.'));
const reportPath = resolve(root, option('--report', 'artifacts/validation/delivery-attestation-contract.json'));
const contract = JSON.parse(await readFile(resolve(root, 'config/delivery-attestation-contract.json'), 'utf8'));
const activeLedger = JSON.parse(await readFile(resolve(root, 'config/release-ledger.json'), 'utf8'));
const historicalLedger = JSON.parse(await readFile(resolve(root, 'artifacts/manifests/VERSION_LEDGER.json'), 'utf8'));
const current = activeLedger.current;
const historicalCurrent = historicalLedger.entries?.at(-1);
const failures = validateDeliveryAttestationContract(contract);
if (!current) failures.push('Active monthly release ledger current entry is missing.');
if (!historicalCurrent) failures.push('Historical global-build ledger tail is missing.');
const historicalFileName = historicalCurrent ? renderAttestationFileName(contract, historicalCurrent.sequence, historicalCurrent.version) : null;
for (const path of ['README.md', 'START_HERE_TR.md', 'PAKET_OZETI_TR.md', 'DELIVERY_SUMMARY_TR.md', 'VERIFICATION_REPORT.md', 'BUILD_STATUS.md']) {
  const text = await readFile(resolve(root, path), 'utf8');
  if (historicalFileName && text.includes(`\`${historicalFileName}\``)) failures.push(`${path} exposes the historical detached attestation as active authority=${historicalFileName}`);
}
const evidence = {
  schemaVersion: 2,
  product: contract.product,
  activeVersionAuthority: {
    path: 'config/release-ledger.json',
    applicationVersion: current?.version ?? null,
    packageVersion: current?.packageVersion ?? null,
    monthlySequence: current?.monthlySequence ?? null,
    releaseId: current?.releaseId ?? null
  },
  historicalAttestationContract: {
    classification: 'HISTORICAL_GLOBAL_BUILD_ATTESTATION_NOT_ACTIVE_MONTHLY_AUTHORITY',
    ledgerPath: 'artifacts/manifests/VERSION_LEDGER.json',
    applicationVersion: historicalCurrent?.version ?? null,
    packageVersion: historicalCurrent?.packageVersion ?? null,
    build: historicalCurrent?.sequence ?? null,
    expectedFileName: historicalFileName
  },
  evidenceCount: contract.evidence?.length ?? 0,
  gateClaimCount: contract.gateClaims?.length ?? 0,
  status: failures.length === 0 ? 'PASS' : 'FAIL',
  failures,
  generatedAt: new Date().toISOString()
};
await mkdir(dirname(reportPath), { recursive: true });
await writeFile(reportPath, `${JSON.stringify(evidence, null, 2)}\n`);
if (failures.length) { for (const failure of failures) console.error(`- ${failure}`); process.exit(1); }
console.log(`Historical delivery attestation contract isolated: ${evidence.evidenceCount} evidence files / ${evidence.gateClaimCount} gate claims; active=${current?.visibleRelease}.`);

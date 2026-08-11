import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { renderAttestationFileName, validateDeliveryAttestationContract } from './lib/delivery-attestation.mjs';
const args = process.argv.slice(2);
const option = (name, fallback) => { const i = args.indexOf(name); if (i < 0) return fallback; const v = args[i + 1]; if (!v || v.startsWith('--')) throw new Error(`${name} requires a value.`); return v; };
const root = resolve(option('--root', '.'));
const reportPath = resolve(root, option('--report', 'artifacts/validation/delivery-attestation-contract.json'));
const contract = JSON.parse(await readFile(resolve(root, 'config/delivery-attestation-contract.json'), 'utf8'));
const ledger = JSON.parse(await readFile(resolve(root, 'artifacts/manifests/VERSION_LEDGER.json'), 'utf8'));
const current = ledger.entries?.at(-1);
const failures = validateDeliveryAttestationContract(contract);
const expectedFileName = current ? renderAttestationFileName(contract, current.sequence, current.version) : null;
for (const path of ['README.md', 'START_HERE_TR.md', 'PAKET_OZETI_TR.md', 'DELIVERY_SUMMARY_TR.md', 'VERIFICATION_REPORT.md', 'BUILD_STATUS.md']) {
  const text = await readFile(resolve(root, path), 'utf8');
  if (expectedFileName && !text.includes(`\`${expectedFileName}\``)) failures.push(`${path} detached attestation reference is missing=${expectedFileName}`);
}
const evidence = { schemaVersion: 1, product: contract.product, applicationVersion: current?.version ?? null, packageVersion: current?.packageVersion ?? null, build: current?.sequence ?? null, evidenceCount: contract.evidence?.length ?? 0, gateClaimCount: contract.gateClaims?.length ?? 0, expectedFileName, status: failures.length === 0 ? 'PASS' : 'FAIL', failures, generatedAt: new Date().toISOString() };
await mkdir(dirname(reportPath), { recursive: true });
await writeFile(reportPath, `${JSON.stringify(evidence, null, 2)}\n`);
if (failures.length) { for (const failure of failures) console.error(`- ${failure}`); process.exit(1); }
console.log(`Delivery attestation contract verified: ${evidence.evidenceCount} evidence files / ${evidence.gateClaimCount} gate claims.`);

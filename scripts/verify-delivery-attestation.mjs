import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { verifyExistingDeliveryAttestation } from './lib/delivery-attestation.mjs';
const args = process.argv.slice(2);
const option = (name, fallback) => { const i = args.indexOf(name); if (i < 0) return fallback; const v = args[i + 1]; if (!v || v.startsWith('--')) throw new Error(`${name} requires a value.`); return v; };
const attestationPath = option('--attestation'); if (!attestationPath) throw new Error('--attestation is required.');
const archivePath = option('--archive'); if (!archivePath) throw new Error('--archive is required.');
const root = resolve(option('--root', '.'));
const reportPath = resolve(option('--report', 'artifacts/validation/delivery-attestation-verification.json'));
const attestation = JSON.parse(await readFile(resolve(attestationPath), 'utf8'));
const result = await verifyExistingDeliveryAttestation({ attestation, root, archivePath, contractPath: option('--contract', 'config/delivery-attestation-contract.json') });
await mkdir(dirname(reportPath), { recursive: true });
await writeFile(reportPath, `${JSON.stringify({ ...result, verifiedAt: new Date().toISOString() }, null, 2)}\n`);
console.log(`Detached delivery attestation verification: ${result.status}`);
if (result.status !== 'PASS') { for (const failure of result.failures) console.error(`- ${failure}`); process.exitCode = 1; }

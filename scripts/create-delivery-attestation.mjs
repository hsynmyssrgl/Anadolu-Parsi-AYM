import { mkdir, writeFile } from 'node:fs/promises';
import { basename, dirname, resolve } from 'node:path';
import { evaluateDeliveryAttestation, sha256Bytes } from './lib/delivery-attestation.mjs';
const args = process.argv.slice(2);
const option = (name, fallback) => { const i = args.indexOf(name); if (i < 0) return fallback; const v = args[i + 1]; if (!v || v.startsWith('--')) throw new Error(`${name} requires a value.`); return v; };
const archivePath = option('--archive'); if (!archivePath) throw new Error('--archive is required.');
const root = resolve(option('--root', '.'));
const evaluation = await evaluateDeliveryAttestation({ root, archivePath, contractPath: option('--contract', 'config/delivery-attestation-contract.json') });
const outputPath = resolve(option('--output', evaluation.expectedAttestationFileName ?? 'delivery-attestation.json'));
const payload = { ...evaluation, generatedAt: new Date().toISOString() };
const bytes = Buffer.from(`${JSON.stringify(payload, null, 2)}\n`);
await mkdir(dirname(outputPath), { recursive: true });
await writeFile(outputPath, bytes);
await writeFile(`${outputPath}.sha256`, `${sha256Bytes(bytes)}  ${basename(outputPath)}\n`);
console.log(`Detached delivery attestation: ${payload.status} — ${outputPath}`);
if (payload.status !== 'PASS') { for (const failure of payload.failures) console.error(`- ${failure}`); process.exitCode = 1; }

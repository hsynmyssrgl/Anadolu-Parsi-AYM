import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';

const out = process.argv[2] ?? 'artifacts/validation/build178-security-receipt-history-contract.json';
const paths = [
  'packages/domain/src/app-data.ts',
  'apps/desktop/src/main/security-event-receipt.ts',
  'apps/desktop/src/main/security-event-receipt-store.ts',
  'apps/desktop/src/main/data-store.ts',
  'apps/desktop/src/main/main.ts',
  'apps/desktop/src/main/preload.ts',
  'apps/desktop/src/renderer/global.d.ts',
  'apps/desktop/src/renderer/App.tsx'
];
const files = Object.fromEntries(await Promise.all(paths.map(async (path) => [path, await readFile(path, 'utf8')])));
const checks = [];
const check = (name, condition) => checks.push({ name, status: condition ? 'PASS' : 'FAIL' });
const has = (path, text) => files[path].includes(text);

check('receipt archive item domain view exists', has(paths[0], 'SecurityEventReceiptArchiveItemView'));
check('receipt verification domain view exists', has(paths[0], "status:'VALID'|'INVALID'|'MALFORMED'"));
check('reauthorization result reports archive status', has(paths[0], 'receiptArchived:boolean'));
check('account receipt fingerprint helper is exported', has(paths[1], 'export const createAccountSecurityReceiptFingerprint'));
check('receipt archive has bounded file size', has(paths[2], 'MAX_FILE_BYTES'));
check('receipt archive has bounded item count', has(paths[2], 'MAX_RECEIPTS = 256'));
check('receipt archive writes an atomic temporary file', has(paths[2], "openSync(temporaryPath, 'wx', 0o600)"));
check('receipt archive fsyncs before rename', has(paths[2], 'fsyncSync(descriptor)') && has(paths[2], 'renameSync(temporaryPath, this.filePath)'));
check('receipt archive validates schema before use', has(paths[2], 'isSecurityEventReceiptView'));
check('receipt archive re-verifies each listed signature', has(paths[2], 'verifySecurityEventReceipt(receipt)'));
check('receipt archive filters by account fingerprint', has(paths[2], 'receipt.accountFingerprint === accountFingerprint'));
check('receipt verifier bounds pasted input', has(paths[2], '256 * 1024'));
check('receipt verifier distinguishes malformed input', has(paths[2], "status: 'MALFORMED'"));
check('receipt verifier distinguishes invalid signature', has(paths[2], "status: valid ? 'VALID' : 'INVALID'"));
check('data store has receipt store dependency', has(paths[3], '#securityEventReceiptStore'));
check('data store persists newly created receipt', has(paths[3], 'this.#securityEventReceiptStore.append(receipt)'));
check('data store lists only current account receipts', has(paths[3], 'createAccountSecurityReceiptFingerprint(accountId)'));
check('data store requires authentication to list receipts', has(paths[3], 'Güvenlik makbuzlarını görmek için giriş yapılmalıdır'));
check('data store requires authentication to verify receipt', has(paths[3], 'Güvenlik makbuzu doğrulamak için giriş yapılmalıdır'));
check('receipt archive path is outside renderer', has(paths[4], "security-event-receipts.json"));
check('list receipt IPC is registered', has(paths[4], "auth:listSecurityEventReceipts"));
check('verify receipt IPC is registered', has(paths[4], "auth:verifySecurityEventReceipt"));
check('preload exposes receipt listing', has(paths[5], 'listSecurityEventReceipts'));
check('preload exposes receipt verification', has(paths[5], 'verifySecurityEventReceipt'));
check('renderer bridge declares receipt listing', has(paths[6], 'listSecurityEventReceipts'));
check('renderer bridge declares receipt verification', has(paths[6], 'verifySecurityEventReceipt'));
check('security center loads receipt history on authentication', has(paths[7], 'window.pardus.listSecurityEventReceipts(20).then(setSecurityReceiptHistory)'));
check('security center refreshes history after reauthorization', has(paths[7], 'setSecurityReceiptHistory(await window.pardus.listSecurityEventReceipts(20))'));
check('security center explains archive persistence failure', has(paths[7], "yerel geçmişe kaydedilemedi"));
check('security center exposes signed receipt history', has(paths[7], '<h3>Güvenlik makbuzları</h3>'));
check('security center exposes pasted JSON verification', has(paths[7], 'Haricî makbuz JSON'));
check('security center calls main-process verification', has(paths[7], 'window.pardus.verifySecurityEventReceipt(securityReceiptJson)'));
check('security center shows signature status', has(paths[7], "securityReceiptVerification.valid?'success':'danger'"));
check('security center warns about stale security epoch', has(paths[7], 'Bu oturum eski güvenlik dönemine ait'));
const receiptSection = files[paths[7]].slice(files[paths[7]].indexOf('<section className="security-receipt-history"'), files[paths[7]].indexOf('<section><h3>Denetim kaydı</h3>'));
check('receipt history never asks for raw account id', !receiptSection.includes('accountId'));
check('receipt persistence never stores password', !has(paths[2], 'password'));
check('receipt persistence never stores TOTP secret', !has(paths[2], 'totpSecret'));

const failures = checks.filter((item) => item.status === 'FAIL');
const report = { schemaVersion: 1, product: 'Anadolu Parsı Aile Yaşam Merkezi', build: 178, status: failures.length ? 'FAIL' : 'PASS', checks: checks.length, passed: checks.length - failures.length, failures, scenarios: checks, generatedAt: new Date().toISOString() };
await mkdir(dirname(out), { recursive: true });
await writeFile(out, `${JSON.stringify(report, null, 2)}\n`);
if (failures.length) { console.error(JSON.stringify(report, null, 2)); process.exit(1); }
console.log(`Build 178 security receipt history contract: PASS (${checks.length}/${checks.length})`);

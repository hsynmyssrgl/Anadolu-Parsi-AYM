import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
import { generateKeyPairSync, sign } from 'node:crypto';
import { mkdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import assert from 'node:assert/strict';

const out = process.argv[2] ?? 'artifacts/validation/build178-security-receipt-history-runtime.json';
const temp = resolve('.tmp/build178-security-receipt-history-runtime');
await rm(temp, { recursive: true, force: true });
await mkdir(temp, { recursive: true });
const require = createRequire(import.meta.url);
const globalRoot = execFileSync('npm', ['root', '-g'], { encoding: 'utf8' }).trim();
const ts = require(join(globalRoot, 'typescript'));
const transpile = async (sourcePath, outputName) => {
  const source = await readFile(sourcePath, 'utf8');
  const result = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2024, module: ts.ModuleKind.ES2022 } });
  const outputPath = join(temp, outputName);
  await writeFile(outputPath, result.outputText);
  return outputPath;
};
await transpile('apps/desktop/src/main/security-event-receipt.ts', 'security-event-receipt.js');
await transpile('apps/desktop/src/main/security-event-receipt-store.ts', 'security-event-receipt-store.js');
const receiptModule = await import(`${pathToFileURL(join(temp, 'security-event-receipt.js')).href}?v=${Date.now()}-receipt`);
const storeModule = await import(`${pathToFileURL(join(temp, 'security-event-receipt-store.js')).href}?v=${Date.now()}-store`);
const checks = [];
const check = async (name, fn) => { try { await fn(); checks.push({ name, status: 'PASS' }); } catch (error) { checks.push({ name, status: 'FAIL', error: error instanceof Error ? error.message : String(error) }); } };

const pair = generateKeyPairSync('ed25519', { publicKeyEncoding: { type: 'spki', format: 'pem' }, privateKeyEncoding: { type: 'pkcs8', format: 'pem' } });
const makeReceipt = (receiptId, accountId = 'account-a', securityEpoch = 3) => receiptModule.createSecurityEventReceipt({
  receiptId,
  accountId,
  deviceId: 'device-1',
  deviceFingerprint: 'a'.repeat(64),
  securityEpoch,
  trustedDeviceId: `trusted-${receiptId}`,
  auditId: `audit-${receiptId}`,
  occurredAt: `2026-07-30T0${securityEpoch % 9}:00:00.000Z`,
  signerPublicKeyPem: pair.publicKey
}, (payload) => sign(null, Buffer.from(payload), pair.privateKey).toString('base64'));

const archivePath = join(temp, 'security-event-receipts.json');
const store = new storeModule.SecurityEventReceiptStore(archivePath);
const accountA = receiptModule.createAccountSecurityReceiptFingerprint('account-a');
const accountB = receiptModule.createAccountSecurityReceiptFingerprint('account-b');
const first = makeReceipt('receipt-1');
const second = makeReceipt('receipt-2', 'account-b', 4);
await check('append stores first signed receipt', () => assert.equal(store.append(first), true));
await check('append stores second account receipt', () => assert.equal(store.append(second), true));
await check('archive file is owner-only', async () => assert.equal((await stat(archivePath)).mode & 0o777, 0o600));
await check('account A sees only its receipt', () => assert.deepEqual(store.list(accountA, 20).map((item) => item.receipt.receiptId), ['receipt-1']));
await check('account B sees only its receipt', () => assert.deepEqual(store.list(accountB, 20).map((item) => item.receipt.receiptId), ['receipt-2']));
await check('listed valid receipt is marked valid', () => assert.equal(store.list(accountA, 20)[0].verificationStatus, 'valid'));
await check('receipt JSON verifies as VALID', () => assert.equal(store.verifyJson(JSON.stringify(first)).status, 'VALID'));
await check('tampered receipt verifies as INVALID', () => assert.equal(store.verifyJson(JSON.stringify({ ...first, securityEpoch: 99 })).status, 'INVALID'));
await check('non-JSON receipt verifies as MALFORMED', () => assert.equal(store.verifyJson('{broken').status, 'MALFORMED'));
await check('wrong schema receipt verifies as MALFORMED', () => assert.equal(store.verifyJson(JSON.stringify({ schemaVersion: 2 })).status, 'MALFORMED'));
await check('oversized receipt is rejected before parsing', () => assert.equal(store.verifyJson('x'.repeat(256 * 1024 + 1)).status, 'MALFORMED'));
await check('duplicate receipt id is replaced not duplicated', () => { store.append(first); assert.equal(store.list(accountA, 20).length, 1); });
await check('limit is enforced', () => { for (let i = 3; i < 15; i += 1) store.append(makeReceipt(`receipt-${i}`)); assert.equal(store.list(accountA, 3).length, 3); });
await check('most recent receipt is first', () => assert.equal(store.list(accountA, 20)[0].receipt.receiptId, 'receipt-14'));
await check('corrupted archive fails closed to empty history', async () => { await writeFile(archivePath, '{bad'); assert.deepEqual(store.list(accountA, 20), []); });
await check('append recovers from corrupted archive', () => { assert.equal(store.append(first), true); assert.equal(store.list(accountA, 20).length, 1); });
await check('receipt archive never exposes raw account id', async () => assert.equal((await readFile(archivePath, 'utf8')).includes('account-a'), false));
await check('receipt fingerprint helper is deterministic', () => assert.equal(receiptModule.createAccountSecurityReceiptFingerprint('x'), receiptModule.createAccountSecurityReceiptFingerprint('x')));
await check('receipt fingerprint separates accounts', () => assert.notEqual(receiptModule.createAccountSecurityReceiptFingerprint('x'), receiptModule.createAccountSecurityReceiptFingerprint('y')));

const failures = checks.filter((item) => item.status === 'FAIL');
const report = { schemaVersion: 1, product: 'Anadolu Parsı Aile Yaşam Merkezi', build: 178, status: failures.length ? 'FAIL' : 'PASS', checks: checks.length, passed: checks.length - failures.length, failures, scenarios: checks, generatedAt: new Date().toISOString() };
await mkdir(dirname(out), { recursive: true });
await writeFile(out, `${JSON.stringify(report, null, 2)}\n`);
await rm(temp, { recursive: true, force: true });
if (failures.length) { console.error(JSON.stringify(report, null, 2)); process.exit(1); }
console.log(`Build 178 security receipt history runtime: PASS (${checks.length}/${checks.length})`);

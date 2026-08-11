import { spawnSync } from 'node:child_process';
import { generateKeyPairSync, sign } from 'node:crypto';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import assert from 'node:assert/strict';
import { resolveTypeScriptCommand } from './lib/typescript-command.mjs';

const out = process.argv[2] ?? 'artifacts/validation/build176-device-reauthorization-runtime.json';
const temp = resolve('.tmp/build176-device-reauthorization-runtime');
await rm(temp, { recursive: true, force: true });
await mkdir(temp, { recursive: true });
const root = process.cwd();
const compiledRoot = join(temp, 'compiled');
const sourceFiles = [
  'packages/security/src/session.ts',
  'packages/application/src/security-epoch.ts',
  'apps/desktop/src/main/security-event-receipt.ts'
];
const tsconfigPath = join(temp, 'tsconfig.json');
await writeFile(tsconfigPath, `${JSON.stringify({
  extends: resolve(root, 'tsconfig.base.json'),
  compilerOptions: {
    module: 'NodeNext',
    moduleResolution: 'NodeNext',
    rootDir: root,
    outDir: compiledRoot,
    noEmit: false,
    noEmitOnError: true,
    declaration: false,
    declarationMap: false,
    sourceMap: false,
    types: ['node']
  },
  files: sourceFiles.map((sourcePath) => resolve(root, sourcePath))
}, null, 2)}\n`);
const compiler = resolveTypeScriptCommand(root);
const compilation = spawnSync(
  compiler.command,
  [...compiler.prefixArgs, '-p', tsconfigPath],
  { cwd: root, encoding: 'utf8' }
);
if (compilation.status !== 0) {
  throw new Error(`Controlled TypeScript compilation failed (${compilation.status ?? 'not_started'}): ${compilation.stdout}\n${compilation.stderr}`.trim());
}
const loadCompiled = (sourcePath) => import(
  `${pathToFileURL(join(compiledRoot, sourcePath.replace(/\.ts$/u, '.js'))).href}?v=${Date.now()}`
);
const session = await loadCompiled(sourceFiles[0]);
const epoch = await loadCompiled(sourceFiles[1]);
const receipt = await loadCompiled(sourceFiles[2]);
const checks = [];
const check = (name, fn) => { try { fn(); checks.push({ name, status: 'PASS' }); } catch (error) { checks.push({ name, status: 'FAIL', error: error instanceof Error ? error.message : String(error) }); } };

let nowMs = Date.parse('2026-07-30T00:00:00.000Z');
const clock = { now: () => new Date(nowMs).toISOString() };
const manager = new session.InMemorySessionManager(clock, 15);
check('session starts with explicit security epoch', () => assert.equal(manager.start('account-1', 7).securityEpoch, 7));
check('session snapshot preserves epoch', () => assert.equal(manager.snapshot().securityEpoch, 7));
check('session account remains available before timeout', () => assert.equal(manager.currentAccountId({ touch: false }), 'account-1'));
check('invalid negative session epoch is rejected', () => assert.throws(() => manager.start('account-1', -1)));
check('fractional session epoch is rejected', () => assert.throws(() => manager.start('account-1', 1.5)));
manager.start('account-1', 7);
nowMs += 15 * 60_000;
check('expired session clears epoch-bound state', () => assert.deepEqual(manager.snapshot(), { active: false }));
check('same account and session epoch is current', () => assert.equal(epoch.isSessionSecurityEpochCurrent(9, 9), true));
check('older session epoch is stale', () => assert.equal(epoch.isSessionSecurityEpochCurrent(10, 9), false));
check('future session epoch is stale', () => assert.equal(epoch.isSessionSecurityEpochCurrent(10, 11), false));

const pair = generateKeyPairSync('ed25519', { publicKeyEncoding: { type: 'spki', format: 'pem' }, privateKeyEncoding: { type: 'pkcs8', format: 'pem' } });
const draft = { receiptId: 'receipt-1', accountId: 'account-secret-id', deviceId: 'device-1', deviceFingerprint: 'a'.repeat(64), securityEpoch: 3, trustedDeviceId: 'trusted-1', auditId: 'audit-1', occurredAt: '2026-07-30T00:01:00.000Z', signerPublicKeyPem: pair.publicKey };
const signed = receipt.createSecurityEventReceipt(draft, (payload) => sign(null, Buffer.from(payload), pair.privateKey).toString('base64'));
check('receipt schema is version one', () => assert.equal(signed.schemaVersion, 1));
check('receipt event type is recovery reauthorization', () => assert.equal(signed.eventType, 'trusted_device_reauthorized_after_maintenance_recovery'));
check('receipt does not expose raw account id', () => assert.equal(JSON.stringify(signed).includes(draft.accountId), false));
check('receipt account fingerprint is sha256 length', () => assert.equal(signed.accountFingerprint.length, 64));
check('receipt payload hash is sha256 length', () => assert.equal(signed.payloadSha256.length, 64));
check('receipt Ed25519 signature verifies', () => assert.equal(receipt.verifySecurityEventReceipt(signed), true));
check('receipt object is immutable', () => assert.equal(Object.isFrozen(signed), true));
check('tampered epoch invalidates receipt', () => assert.equal(receipt.verifySecurityEventReceipt({ ...signed, securityEpoch: 4 }), false));
check('tampered audit id invalidates receipt', () => assert.equal(receipt.verifySecurityEventReceipt({ ...signed, auditId: 'audit-2' }), false));
check('tampered hash invalidates receipt', () => assert.equal(receipt.verifySecurityEventReceipt({ ...signed, payloadSha256: '0'.repeat(64) }), false));
check('tampered signature invalidates receipt', () => assert.equal(receipt.verifySecurityEventReceipt({ ...signed, signatureBase64: Buffer.from('bad').toString('base64') }), false));
check('receipt rejects zero security epoch', () => assert.throws(() => receipt.createSecurityEventReceipt({ ...draft, securityEpoch: 0 }, () => 'x')));
check('different account ids produce different fingerprints', () => {
  const other = receipt.createSecurityEventReceipt({ ...draft, receiptId: 'receipt-2', accountId: 'other-account' }, (payload) => sign(null, Buffer.from(payload), pair.privateKey).toString('base64'));
  assert.notEqual(other.accountFingerprint, signed.accountFingerprint);
});

const repositorySource = await readFile('packages/repositories/src/trusted-device-repository.ts', 'utf8');
check('trusted device insert has ten placeholders', () => {
  const values = repositorySource.match(/VALUES\(([^\n]+)\)/)?.[1] ?? '';
  assert.equal((values.match(/\?/g) ?? []).length, 10);
  assert.equal(values.includes('?,NULL,?'), true);
});
const failures = checks.filter((item) => item.status === 'FAIL');
const report = { schemaVersion: 1, product: 'Anadolu Parsı Aile Yaşam Merkezi', build: 176, status: failures.length ? 'FAIL' : 'PASS', checks: checks.length, passed: checks.length - failures.length, failures, scenarios: checks, generatedAt: new Date().toISOString() };
await mkdir(dirname(out), { recursive: true });
await writeFile(out, `${JSON.stringify(report, null, 2)}\n`);
await rm(temp, { recursive: true, force: true });
if (failures.length) { console.error(JSON.stringify(report, null, 2)); process.exit(1); }
console.log(`Build 176 device reauthorization runtime: PASS (${checks.length}/${checks.length})`);

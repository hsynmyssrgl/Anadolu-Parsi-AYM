import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';

const out = process.argv[2] ?? 'artifacts/validation/build176-device-reauthorization-contract.json';
const files = Object.fromEntries(await Promise.all([
  'packages/domain/src/app-data.ts',
  'packages/security/src/session.ts',
  'packages/application/src/security-epoch.ts',
  'packages/application/src/auth-use-cases.ts',
  'packages/repositories/src/trusted-device-repository.ts',
  'apps/desktop/src/main/auth-security-application-adapter.ts',
  'apps/desktop/src/main/data-lifecycle-application-adapter.ts',
  'apps/desktop/src/main/security-event-receipt.ts',
  'apps/desktop/src/main/data-store.ts',
  'apps/desktop/src/main/main.ts',
  'apps/desktop/src/main/preload.ts',
  'apps/desktop/src/renderer/global.d.ts',
  'apps/desktop/src/renderer/App.tsx',
  'apps/desktop/src/renderer/security-center-navigation.ts'
].map(async (path) => [path, await readFile(path, 'utf8')])));
const checks = [];
const check = (name, condition) => checks.push({ name, status: condition ? 'PASS' : 'FAIL' });
const has = (path, text) => files[path].includes(text);

check('auth state exposes session epoch', has('packages/domain/src/app-data.ts', 'sessionSecurityEpoch?: number'));
check('auth state exposes device reauthorization requirement', has('packages/domain/src/app-data.ts', 'deviceReauthorizationRequired?: boolean'));
check('reauthorization input has exact confirmation literal', has('packages/domain/src/app-data.ts', "confirmation: 'GÜVENLİ CİHAZI YENİDEN YETKİLENDİR'"));
check('signed receipt view exists', has('packages/domain/src/app-data.ts', 'SecurityEventReceiptView'));
check('receipt uses Ed25519', has('packages/domain/src/app-data.ts', "signatureAlgorithm:'Ed25519'"));
check('reauthorization result contains devices and receipt', has('packages/domain/src/app-data.ts', 'ReauthorizeCurrentDeviceResultView'));
check('session snapshot carries security epoch', has('packages/security/src/session.ts', 'readonly securityEpoch?: number'));
check('session state persists security epoch in memory', has('packages/security/src/session.ts', 'securityEpoch: number'));
check('session start validates security epoch', has('packages/security/src/session.ts', "throw new Error('Oturum güvenlik dönemi geçersiz.')"));
check('session snapshot returns security epoch', has('packages/security/src/session.ts', 'securityEpoch: this.state.securityEpoch'));
check('session epoch comparison helper exists', has('packages/application/src/security-epoch.ts', 'isSessionSecurityEpochCurrent'));
check('auth session port accepts epoch binding', has('packages/application/src/auth-use-cases.ts', 'start(accountId: UserId, securityEpoch?: number)'));
check('auth use cases reject stale session epoch', has('packages/application/src/auth-use-cases.ts', 'Oturum güvenlik dönemi geçersiz. Lütfen yeniden giriş yapın.'));
check('auth state clears stale session', has('packages/application/src/auth-use-cases.ts', 'this.session.clear();'));
check('login result carries account epoch', has('packages/application/src/auth-use-cases.ts', 'securityEpoch: account.securityEpoch'));
check('login starts epoch-bound session', has('packages/application/src/auth-use-cases.ts', 'this.session.start(result.value.accountId, result.value.securityEpoch)'));
check('initial administrator session starts at epoch zero', has('packages/application/src/auth-use-cases.ts', 'this.session.start(result.value, 0)'));
check('reauthorization use case exists', has('packages/application/src/auth-use-cases.ts', 'ReauthorizeCurrentDeviceAfterRecoveryUseCase'));
check('reauthorization requires exact typed confirmation', has('packages/application/src/auth-use-cases.ts', "input.command.confirmation !== 'GÜVENLİ CİHAZI YENİDEN YETKİLENDİR'"));
check('reauthorization only applies after epoch rotation', has('packages/application/src/auth-use-cases.ts', 'account.value.securityEpoch < 1'));
check('already current device is rejected', has('packages/application/src/auth-use-cases.ts', 'zaten yetkilidir'));
check('reauthorization verifies password', has('packages/application/src/auth-use-cases.ts', 'this.passwordService.verify(input.command.password'));
check('reauthorization requires two factor', has('packages/application/src/auth-use-cases.ts', 'Kurtarma sonrası cihaz yeniden yetkilendirmesi için iki aşamalı doğrulama'));
check('reauthorization verifies device proof', has('packages/application/src/auth-use-cases.ts', 'this.deviceProofVerifier.verify(input.currentDevice.publicKeyPem'));
check('reauthorization consumes recovery code safely', has('packages/application/src/auth-use-cases.ts', "verification.method === 'recovery'"));
check('reauthorization writes current epoch device record', has('packages/application/src/auth-use-cases.ts', 'securityEpoch: account.value.securityEpoch'));
check('reauthorization has dedicated audit action', has('packages/application/src/auth-use-cases.ts', 'device.reauthorized_after_security_epoch_rotation'));
check('trusted device SQL stores security epoch in correct placeholder', has('packages/repositories/src/trusted-device-repository.ts', ') VALUES(?,?,?,?,?,?,?,?,?,NULL,?)'));
check('old malformed trusted device SQL removed', !has('packages/repositories/src/trusted-device-repository.ts', ') VALUES(?,?,?,?,?,?,?,?,NULL,?)'));
check('session adapter forwards epoch', has('apps/desktop/src/main/auth-security-application-adapter.ts', 'this.#manager.start(accountId, securityEpoch)'));
check('session adapter exposes epoch snapshot', has('apps/desktop/src/main/auth-security-application-adapter.ts', '{ securityEpoch: snapshot.securityEpoch }'));
check('strong authentication rejects stale epoch', has('apps/desktop/src/main/data-lifecycle-application-adapter.ts', 'session.securityEpoch!==account.value.securityEpoch'));
check('receipt canonical payload is explicit', has('apps/desktop/src/main/security-event-receipt.ts', 'const canonicalPayload'));
check('receipt hashes account id with namespace', has('apps/desktop/src/main/security-event-receipt.ts', 'anadolu-parsi-account-receipt-v1'));
check('receipt hashes canonical payload', has('apps/desktop/src/main/security-event-receipt.ts', "createHash('sha256').update(payload).digest('hex')"));
check('receipt signature verification exists', has('apps/desktop/src/main/security-event-receipt.ts', 'verifySecurityEventReceipt'));
check('receipt verification uses public key', has('apps/desktop/src/main/security-event-receipt.ts', 'receipt.signerPublicKeyPem'));
check('data store owns reauthorization use case', has('apps/desktop/src/main/data-store.ts', '#reauthorizeCurrentDeviceAfterRecoveryUseCase'));
check('data store binds receipt to device identity', has('apps/desktop/src/main/data-store.ts', 'this.#deviceIdentityProvider.createProof(payload).signatureBase64'));
check('data store returns receipt and current devices', /return \{ devices: this\.listTrustedDevices\(\), receipt(?:, [^}]*)? \}/.test(files['apps/desktop/src/main/data-store.ts']));
check('data store rejects stale sessions globally', has('apps/desktop/src/main/data-store.ts', '[AUTH_SESSION_STALE]'));
check('data store compares account and session epoch', has('apps/desktop/src/main/data-store.ts', 'isSessionSecurityEpochCurrent(account.value.securityEpoch, snapshot.securityEpoch)'));
check('invitation session starts epoch bound', has('apps/desktop/src/main/data-store.ts', 'this.#sessionManager.start(result.value, 0)'));
check('IPC handler is registered', has('apps/desktop/src/main/main.ts', "auth:reauthorizeCurrentDeviceAfterRecovery"));
check('preload exposes reauthorization API', has('apps/desktop/src/main/preload.ts', 'reauthorizeCurrentDeviceAfterRecovery'));
check('preload treats reauthorization as session boundary', has('apps/desktop/src/main/preload.ts', "'auth:reauthorizeCurrentDeviceAfterRecovery'"));
check('renderer declaration exposes API', has('apps/desktop/src/renderer/global.d.ts', 'reauthorizeCurrentDeviceAfterRecovery'));
check('renderer shows exact confirmation phrase', has('apps/desktop/src/renderer/App.tsx', 'GÜVENLİ CİHAZI YENİDEN YETKİLENDİR') || has('apps/desktop/src/renderer/security-center-navigation.ts', "DEVICE_REAUTHORIZATION_CONFIRMATION = 'GÜVENLİ CİHAZI YENİDEN YETKİLENDİR'"));
check('renderer displays security epoch', has('apps/desktop/src/renderer/App.tsx', 'Hesap güvenlik dönemi'));
check('renderer displays signed receipt', has('apps/desktop/src/renderer/App.tsx', 'İmzalı güvenlik olayı makbuzu'));
check('renderer supports receipt copy', has('apps/desktop/src/renderer/App.tsx', 'navigator.clipboard.writeText'));
check('reauthorization credentials are cleared after success', has('apps/desktop/src/renderer/App.tsx', "setCurrentPassword('');setTwoFactorCode('')"));

const failures = checks.filter((item) => item.status === 'FAIL');
const report = { schemaVersion: 1, product: 'Anadolu Parsı Aile Yaşam Merkezi', build: 176, status: failures.length ? 'FAIL' : 'PASS', checks: checks.length, passed: checks.length - failures.length, failures, scenarios: checks, generatedAt: new Date().toISOString() };
await mkdir(dirname(out), { recursive: true });
await writeFile(out, `${JSON.stringify(report, null, 2)}\n`);
if (failures.length) { console.error(JSON.stringify(report, null, 2)); process.exit(1); }
console.log(`Build 176 device reauthorization contract: PASS (${checks.length}/${checks.length})`);

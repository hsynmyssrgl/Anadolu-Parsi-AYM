import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';

const out = process.argv[2] ?? 'artifacts/validation/build175-maintenance-recovery-security-epoch-contract.json';
const paths = {
  epoch: 'packages/application/src/security-epoch.ts',
  useCases: 'packages/application/src/auth-use-cases.ts',
  accountContract: 'packages/repository-contracts/src/account-repository.ts',
  trustedContract: 'packages/repository-contracts/src/trusted-device-repository.ts',
  accountRepo: 'packages/repositories/src/account-repository.ts',
  trustedRepo: 'packages/repositories/src/trusted-device-repository.ts',
  authAdapter: 'apps/desktop/src/main/auth-application-adapter.ts',
  dataStore: 'apps/desktop/src/main/data-store.ts',
  main: 'apps/desktop/src/main/main.ts',
  domain: 'packages/domain/src/app-data.ts',
  renderer: 'apps/desktop/src/renderer/App.tsx',
  migrations: 'packages/database/src/family-database-migrations.ts',
  appMeta: 'packages/domain/src/app-meta.ts',
  ledger: 'artifacts/manifests/VERSION_LEDGER.json'
};
const text = Object.fromEntries(await Promise.all(Object.entries(paths).map(async ([key, path]) => [key, await readFile(path, 'utf8')])));
const ledger = JSON.parse(text.ledger);
const current = ledger.entries?.at(-1);
const checks = [
  ['bounded epoch maximum', text.epoch.includes('MAX_ACCOUNT_SECURITY_EPOCH = 2_147_483_647')],
  ['epoch safe integer validation', text.epoch.includes('Number.isSafeInteger(value)')],
  ['negative epoch rejected', text.epoch.includes('value < 0')],
  ['epoch overflow rejected', text.epoch.includes('üst sınıra ulaştı')],
  ['epoch next function', text.epoch.includes('nextAccountSecurityEpoch')],
  ['trust epoch comparison helper', text.epoch.includes('isTrustedDeviceSecurityEpochCurrent')],
  ['immutable rotation plan', text.epoch.includes('Object.freeze({') && text.epoch.includes('createAccountSecurityEpochRotationPlan')],
  ['invalid active device count rejected', text.epoch.includes('activeTrustedDeviceCount < 0')],
  ['account row epoch', text.accountContract.includes('readonly securityEpoch: number')],
  ['account epoch repository operation', text.accountContract.includes('advanceSecurityEpoch')],
  ['trusted device row epoch', text.trustedContract.includes('readonly securityEpoch: number')],
  ['account mapping defaults legacy epoch', text.accountRepo.includes('Number(row.security_epoch ?? 0)')],
  ['account query selects epoch', text.accountRepo.includes('failed_login_count,security_epoch,locked_until')],
  ['atomic bounded epoch update', text.accountRepo.includes('SET security_epoch=security_epoch+1') && text.accountRepo.includes('security_epoch < 2147483647')],
  ['epoch update verifies one account', text.accountRepo.includes('updated.changes !== 1')],
  ['epoch reread validation', text.accountRepo.includes('SELECT security_epoch FROM accounts WHERE id=?')],
  ['trusted device mapping defaults legacy epoch', text.trustedRepo.includes('Number(row.security_epoch ?? 0)')],
  ['trusted device select includes epoch', text.trustedRepo.includes('trusted_at,last_seen_at,security_epoch,revoked_at')],
  ['trusted device upsert persists epoch', text.trustedRepo.includes('security_epoch=excluded.security_epoch') && text.trustedRepo.includes('input.securityEpoch')],
  ['migration adds account epoch', text.migrations.includes('ALTER TABLE accounts') && text.migrations.includes('ADD COLUMN security_epoch')],
  ['migration adds trusted-device epoch', text.migrations.includes('ALTER TABLE trusted_devices')],
  ['migration registers version 27', text.migrations.includes("createMigrationDefinition(27, 'account_security_epoch'" )],
  ['migration updates schema generation', text.migrations.includes('REVISION-175-ACCOUNT-SECURITY-EPOCH')],
  ['application account epoch', text.useCases.includes('readonly securityEpoch: number')],
  ['auth scope advances epoch', text.useCases.includes('advanceSecurityEpoch(accountId')],
  ['login checks device epoch', text.useCases.includes('isTrustedDeviceSecurityEpochCurrent(account.securityEpoch, record.value.securityEpoch)')],
  ['auth state checks device epoch', text.useCases.includes('isTrustedDeviceSecurityEpochCurrent(account.value.securityEpoch, trusted.value.securityEpoch)')],
  ['trusted device is written at current epoch', text.useCases.includes('securityEpoch: account.value.securityEpoch')],
  ['rotation use case exists', text.useCases.includes('RotateAccountSecurityEpochAfterRecoveryUseCase')],
  ['rotation counts active trusted devices', text.useCases.includes('devices.value.filter((device) => !device.revokedAt).length')],
  ['rotation verifies expected next epoch', text.useCases.includes('advanced.value !== rotationPlan.securityEpoch')],
  ['rotation revokes all trusted devices', text.useCases.includes('scope.revokeAllTrustedDevices(required.value, scope.occurredAt)')],
  ['rotation audit action', text.useCases.includes('account.security_epoch_advanced_after_maintenance_recovery')],
  ['adapter maps account epoch', text.authAdapter.includes('securityEpoch: account.securityEpoch')],
  ['adapter maps device epoch', text.authAdapter.includes('securityEpoch: device.securityEpoch')],
  ['adapter advances epoch through repository', text.authAdapter.includes('accountRepository.advanceSecurityEpoch')],
  ['data store owns rotation use case', text.dataStore.includes('#rotateAccountSecurityEpochAfterRecoveryUseCase')],
  ['data store exposes bounded recovery rotation', text.dataStore.includes('rotateAccountSecurityEpochAfterMaintenanceRecovery')],
  ['main rotates before session termination', text.main.includes('const securityEpochRotation = store().rotateAccountSecurityEpochAfterMaintenanceRecovery();\n    ipcAdaptiveBudgetMaintenanceSessions.clearAll();') && text.main.includes('ipcAdaptiveBudgetMaintenanceRecoveryCooldownGuard.recordFailure(recoveryContext.cooldownFingerprint);\n    store().logout();')],
  ['main preserves Build 174 cooldown sequence', text.main.includes('ipcAdaptiveBudgetMaintenanceRecoveryCooldownGuard.recordFailure(recoveryContext.cooldownFingerprint);\n    store().logout();')],
  ['main logs epoch advancement', text.main.includes('securityEpochAdvanced: true')],
  ['main reports trusted device revocation count', text.main.includes('revokedTrustedDeviceCount: securityEpochRotation.revokedTrustedDeviceCount')],
  ['domain auth state epoch', text.domain.includes('securityEpoch?: number')],
  ['domain trusted device epoch', text.domain.includes('securityEpoch:number')],
  ['domain recovery epoch result', text.domain.includes('securityEpochAdvanced?:boolean') && text.domain.includes('trustedDevicesRevoked?:boolean')],
  ['renderer explains old trust revocation', text.renderer.includes('tüm eski güvenilir cihaz bağlarını iptal eder')],
  ['renderer result includes epoch', text.renderer.includes("recovered.securityEpoch??'—'")],
  ['active application version is Build 175 or later', Number(text.appMeta.match(/Build (\d+)/)?.[1] ?? 0) >= 175],
  ['ledger retains Build 175 and current is 175 or later', ledger.entries?.some((entry) => entry.sequence === 175 && entry.version === '29.07.2026.175' && entry.packageVersion === '29.7.2026-175') && Number(current?.sequence ?? 0) >= 175],
  ['historical 174 repaired', ledger.entries?.some((entry) => entry.sequence === 174 && entry.version === '29.07.2026.174')]
];
const failures = checks.filter(([, ok]) => !ok).map(([name]) => name);
const report = { schemaVersion: 1, product: 'Anadolu Parsı Aile Yaşam Merkezi', build: 175, status: failures.length ? 'FAIL' : 'PASS', assertions: checks.length, passed: checks.length - failures.length, failures, generatedAt: new Date().toISOString() };
await mkdir(dirname(out), { recursive: true });
await writeFile(out, `${JSON.stringify(report, null, 2)}\n`);
if (failures.length) { console.error(JSON.stringify(report, null, 2)); process.exit(1); }
console.log(`Build 175 security epoch contract: PASS (${checks.length}/${checks.length})`);

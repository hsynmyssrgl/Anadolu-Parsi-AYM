import { existsSync, readFileSync } from 'node:fs';

const root = new URL('../', import.meta.url);
const read = (path) => readFileSync(new URL(path, root), 'utf8');
const dataStore = read('apps/desktop/src/main/data-store.ts');
const adapter = read('apps/desktop/src/main/auth-security-application-adapter.ts');
const authUseCases = read('packages/application/src/auth-use-cases.ts');
const appMeta = read('packages/domain/src/app-meta.ts');
const metadata = JSON.parse(read('repository-metadata.json'));

const constructorStart = dataStore.indexOf('public constructor(options: DataStoreOptions)');
const constructorEnd = dataStore.indexOf('public close(): void', constructorStart);
const constructorBody = dataStore.slice(constructorStart, constructorEnd);

const checks = [
  [
    'application authentication security ports remain explicit',
    authUseCases.includes('export interface PasswordService')
      && authUseCases.includes('export interface SecondFactorService')
      && authUseCases.includes('export interface DeviceProofVerifier')
      && authUseCases.includes('export interface AuthSessionPort')
  ],
  [
    'password adapter owns password serialization and verification',
    adapter.includes('export class NodePasswordService implements PasswordService')
      && adapter.includes('JSON.stringify(hashPassword(password))')
      && adapter.includes('verifyPassword(password, JSON.parse(serializedRecord) as PasswordRecord)')
  ],
  [
    'second factor adapter owns TOTP and recovery code behavior',
    adapter.includes('export class NodeSecondFactorService implements SecondFactorService')
      && adapter.includes('createTotpSetupMaterial()')
      && adapter.includes('createOtpAuthUri({')
      && adapter.includes('verifyTotpCode(secret, code, Date.parse(occurredAt))')
      && adapter.includes('consumeRecoveryCode(parseRecoveryCodeHashes(recoveryCodes), code)')
  ],
  [
    'device proof adapter owns signature verification',
    adapter.includes('export class NodeDeviceProofVerifier implements DeviceProofVerifier')
      && adapter.includes('return verifyDeviceProof(publicKeyPem, proof)')
  ],
  [
    'session adapter owns the in-memory session manager',
    adapter.includes('export class InMemoryAuthSessionPort implements AuthSessionPort')
      && adapter.includes('new InMemorySessionManager(clock, idleTimeoutMinutes)')
      && adapter.includes('currentAccountId(options?')
      && adapter.includes('snapshot(): AuthSessionSnapshot')
  ],
  [
    'datastore constructs the authentication security adapters',
    dataStore.includes("from './auth-security-application-adapter.js';")
      && constructorBody.includes('new InMemoryAuthSessionPort(')
      && constructorBody.includes('new NodePasswordService()')
      && constructorBody.includes('new NodeSecondFactorService()')
      && constructorBody.includes('new NodeDeviceProofVerifier()')
  ],
  [
    'authentication use case wiring and limits are preserved',
    constructorBody.includes('new GetAuthStateUseCase(authUnitOfWork, authSessionPort)')
      && constructorBody.includes('new SetupAdminUseCase(authUnitOfWork, passwordService, authSessionPort)')
      && constructorBody.includes('new LoginUseCase(')
      && constructorBody.includes('maximumFailedAttempts: options.securityConfig?.maximumFailedLoginAttempts ?? 5')
      && constructorBody.includes('lockMinutes: 15')
      && constructorBody.includes('options.securityConfig?.sessionIdleTimeoutMinutes ?? 15')
      && constructorBody.includes('new TrustCurrentDeviceUseCase(')
  ],
  [
    'datastore no longer owns direct authentication security primitives',
    !dataStore.includes("from '@ppt/security'")
      && !dataStore.includes('hashPassword(')
      && !dataStore.includes('verifyPassword(')
      && !dataStore.includes('createTotpSetupMaterial(')
      && !dataStore.includes('createOtpAuthUri(')
      && !dataStore.includes('verifyTotpCode(')
      && !dataStore.includes('consumeRecoveryCode(')
      && !dataStore.includes('verifyDeviceProof(')
      && !dataStore.includes('new InMemorySessionManager(')
  ],
  [
    'build97 version metadata is aligned',
    metadata.versionSequence === 97
      && metadata.revision === 'BUILD-97'
      && metadata.packageVersion === '24.7.2026-97'
      && appMeta.includes("version: '24.07.2026.97'")
      && appMeta.includes("packageVersion: '24.7.2026-97'")
      && appMeta.includes('Build 97')
  ],
  [
    'build97 remains active development',
    existsSync(new URL('BUILD_STATUS_BRONZE_RC2_BUILD97.md', root))
      && read('BUILD_STATUS_BRONZE_RC2_BUILD97.md').includes('RC2 Final: No')
      && read('BUILD_STATUS_BRONZE_RC2_BUILD97.md').includes('Code Freeze: No')
      && read('BUILD_STATUS_BRONZE_RC2_BUILD97.md').includes('Silver: No')
  ]
];

for (const [name, passed] of checks) console.log(`${passed ? 'PASS' : 'FAIL'} ${name}`);
if (checks.some(([, passed]) => !passed)) process.exit(1);
console.log(`RESULT ${checks.length}/${checks.length} PASS`);

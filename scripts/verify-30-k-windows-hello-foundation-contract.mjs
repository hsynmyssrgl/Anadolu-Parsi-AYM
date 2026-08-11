import assert from 'node:assert/strict';
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';

const reportPath = 'artifacts/validation/30-K-windows-hello-foundation-contract.json';
rmSync(reportPath, { force: true });

const files = {
  decision: 'docs/decisions/DEC-135-b2-01-windows-hello-foundation.md',
  domain: 'packages/domain/src/windows-hello.ts',
  application: 'packages/application/src/windows-hello-use-cases.ts',
  authApplication: 'packages/application/src/auth-use-cases.ts',
  repositoryContract: 'packages/repository-contracts/src/windows-hello-registration-repository.ts',
  repository: 'packages/repositories/src/windows-hello-registration-repository.ts',
  authAdapter: 'apps/desktop/src/main/auth-application-adapter.ts',
  platform: 'apps/desktop/src/main/windows-hello-platform-adapter.ts',
  composition: 'apps/desktop/src/main/repository-composition-root.ts',
  dataStore: 'apps/desktop/src/main/data-store.ts',
  desktopMain: 'apps/desktop/src/main/main.ts',
  migration: 'database/migrations/0055_windows_hello_registrations.sql',
  embeddedMigration: 'packages/database/src/family-database-migrations.ts',
  package: 'package.json'
};

const source = Object.fromEntries(
  Object.entries(files).map(([key, path]) => [key, readFileSync(path, 'utf8')])
);
const checks = [];
const check = (name, operation) => {
  operation();
  checks.push(name);
};
const contains = (value, fragment, name) => check(name, () => assert.ok(value.includes(fragment)));

contains(source.decision, 'PIN\'ini, biyometrik şablonu veya ham Windows güvenlik tanımlayıcısını', 'decision forbids biometric PIN template and raw principal storage');
contains(source.decision, 'SQLite transaction açık tutulmaz', 'decision forbids holding a database transaction across the native prompt');
contains(source.decision, 'yalnız `PARTIAL_FOUNDATION` olabilir', 'decision preserves the IPC UI and menu completion boundary');
contains(source.domain, "export type WindowsHelloAvailability", 'domain defines explicit availability outcomes');
contains(source.domain, "export type WindowsHelloPromptOutcome", 'domain defines explicit prompt outcomes');
contains(source.domain, "'cancelled'", 'cancellation is a first-class non-password outcome');
contains(source.domain, "'device_changed'", 'device change is a first-class fail-closed outcome');
contains(source.domain, "'principal_changed'", 'Windows principal change is a first-class fail-closed outcome');
contains(source.domain, "passwordFallbackAvailable: true", 'domain keeps password fallback explicitly available');
contains(source.application, 'export interface WindowsHelloPlatformPort', 'application owns the Windows Hello platform port');
contains(source.application, 'export interface WindowsHelloDeviceBindingPort', 'application owns the device binding port');
contains(source.application, 'export class GetWindowsHelloStateUseCase', 'state use case exists');
contains(source.application, 'export class EnrollWindowsHelloUseCase', 'enrollment use case exists');
contains(source.application, 'export class LoginWithWindowsHelloUseCase', 'login use case exists');
contains(source.application, 'export class ReauthenticateWithWindowsHelloUseCase', 'reauthentication use case exists');
contains(source.application, 'requireSensitiveConfirmation', 'enrollment owns password and MFA confirmation');
contains(source.application, 'safeVerification', 'native exceptions map to structured outcomes');
contains(source.application, 'post_prompt_revalidation_failed', 'post-prompt TOCTOU revalidation fails closed');
contains(source.application, "windows_hello.registration_revoked_", 'binding mismatch revocations are audited');
contains(source.application, "windows_hello.session_started", 'Windows Hello login is audited');
contains(source.application, "windows_hello.reauthenticated", 'Windows Hello reauthentication is audited');
contains(source.authApplication, 'findActiveWindowsHelloRegistration', 'auth unit of work exposes registration lookup');
contains(source.authApplication, 'markWindowsHelloVerified', 'auth unit of work exposes exact verified transition');
contains(source.repositoryContract, 'windowsPrincipalHash', 'repository contract binds the Windows principal hash');
contains(source.repositoryContract, 'deviceFingerprint', 'repository contract binds the device fingerprint');
contains(source.repositoryContract, 'securityEpoch', 'repository contract binds the account security epoch');
contains(source.repository, 'AND windows_principal_hash=? AND security_epoch=?', 'repository verified update constrains principal and epoch');
contains(source.repository, 'AND revoked_at IS NULL', 'repository mutations exclude revoked registrations');
contains(source.authAdapter, 'windowsHelloRegistrationRepository', 'auth adapter composes the registration repository');
contains(source.composition, 'SqliteWindowsHelloRegistrationRepository', 'repository composition root constructs the registration repository');
contains(source.dataStore, 'new PowerShellWindowsHelloPlatformAdapter(options.windowsHelloWindowHandleProvider)', 'DataStore uses the native fail-closed Windows adapter with its owner-window provider');
contains(source.dataStore, 'this.#loginUseCase.execute', 'password fallback reuses the canonical login policy');
contains(source.dataStore, 'this.#strongAuthentication.verify', 'reauthentication fallback reuses strong authentication');
contains(source.platform, 'IPptUserConsentVerifierInterop', 'native adapter defines the Win32 UserConsentVerifier interop interface');
contains(source.platform, 'RequestVerificationForWindowAsync', 'desktop verification uses the HWND-aware Win32 method');
contains(source.platform, 'PPT_WINDOWS_HELLO_HWND', 'owner window handle is passed separately from executable code');
contains(source.platform, "const trustedPowerShellPath = 'C:\\\\Windows\\\\System32\\\\WindowsPowerShell\\\\v1.0\\\\powershell.exe'", 'native bridge hard-pins the protected standard Windows PowerShell path');
contains(source.platform, '-EncodedCommand', 'native PowerShell uses a fixed encoded command');
contains(source.platform, 'PPT_WINDOWS_HELLO_INTEROP_B64', 'immutable C sharp interop source is passed outside the command line');
contains(source.platform, 'interopSourceSha256', 'C sharp interop source is SHA-256 pinned before compilation');
contains(source.platform, 'interopBytes.Length -ne', 'C sharp interop source has an exact byte-length bound');
contains(source.platform, 'Windows Hello interop payload integrity check failed.', 'native bridge fails closed on interop payload tampering');
contains(source.platform, 'PPT_WINDOWS_HELLO_PROMPT_B64', 'prompt data is passed separately from executable code');
contains(source.platform, 'Get-PrincipalHash', 'native adapter hashes the Windows principal before returning it');
contains(source.desktopMain, 'getNativeWindowHandle()', 'Electron main supplies the active BrowserWindow handle');
contains(source.desktopMain, 'windowsHelloWindowHandleProvider', 'DataStore receives the dynamic owner-window provider');
contains(source.migration, 'CREATE TABLE windows_hello_registrations', 'migration creates the registration table');
contains(source.migration, 'CREATE UNIQUE INDEX ux_windows_hello_active_account_device', 'migration enforces one active registration per account and device');
contains(source.migration, 'CREATE TRIGGER trg_windows_hello_registration_update', 'migration guards immutable binding and one-way revocation');
contains(source.embeddedMigration, "createMigrationDefinition(55, 'windows_hello_registrations'", 'runtime registers migration 55');
contains(source.package, 'verify:30-k:windows-hello-foundation-runtime', 'package exposes the targeted runtime gate');

check('standalone and embedded migration bodies are identical', () => {
  const match = source.embeddedMigration.match(/const windowsHelloRegistrationsSql = `([\s\S]*?)`;\s*export const FAMILY_DATABASE_MIGRATIONS/u);
  assert.ok(match);
  assert.equal(match[1].trim(), source.migration.trim());
});
check('application layer has no infrastructure dependency', () => {
  assert.equal(source.application.includes('@ppt/repositories'), false);
  assert.equal(source.application.includes('node:child_process'), false);
  assert.equal(source.application.includes('node:sqlite'), false);
});
check('native prompt is not executed from inside repository adapter code', () => {
  assert.equal(source.authAdapter.includes('requestVerification'), false);
  assert.equal(source.repository.includes('requestVerification'), false);
});
check('UWP-only static verification is absent from the desktop native bridge', () => {
  assert.equal(source.platform.includes('::RequestVerificationAsync($prompt)'), false);
});
check('PowerShell control flow is not reconstructed from environment data', () => {
  assert.equal(source.platform.includes('PPT_WINDOWS_HELLO_SCRIPT_B64'), false);
  assert.equal(source.platform.includes('ScriptBlock]::Create'), false);
});
check('migration persists no biometric PIN or raw Windows SID field', () => {
  assert.equal(/biometric|template|\bpin\b|windows_sid|raw_sid/iu.test(source.migration), false);
});

const report = {
  schemaVersion: 1,
  release: 'Bronze 04.08.2026.29',
  step: '30-K',
  requirement: 'B2-01',
  status: 'PASS',
  checkCount: checks.length,
  checks,
  assertions: {
    platformPort: 'PASS',
    structuredOutcomes: 'PASS',
    passwordFallback: 'PASS',
    deviceBinding: 'PASS',
    principalBinding: 'PASS',
    securityEpochBinding: 'PASS',
    postPromptRevalidation: 'PASS',
    schemaAndRepository: 'PASS',
    nativeBoundary: 'PASS',
    nativeInteractiveVerification: 'NOT_RUN_NOT_PASS'
  },
  generatedAt: new Date().toISOString()
};
mkdirSync('artifacts/validation', { recursive: true });
writeFileSync(
  reportPath,
  `${JSON.stringify(report, null, 2)}\n`
);
console.log(JSON.stringify(report, null, 2));

import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';

const reportPath = 'artifacts/validation/30-K-windows-hello-foundation-runtime.json';
rmSync(reportPath, { force: true });
const { FamilyDataStore } = await import('../.tmp/data-store-smoke/data-store.js');
const { PowerShellWindowsHelloPlatformAdapter } = await import(
  '../.tmp/data-store-smoke/windows-hello-platform-adapter.js'
);

const principalA = 'a'.repeat(64);
const principalB = 'b'.repeat(64);

class ControlledWindowsHelloPlatform {
  constructor() {
    this.availability = 'available';
    this.principalHash = principalA;
    this.nextOutcome = 'verified';
    this.verificationCalls = 0;
    this.assessmentCalls = 0;
    this.onVerification = undefined;
  }
  async assessAvailability() {
    this.assessmentCalls += 1;
    return {
      availability: this.availability,
      ...(this.availability === 'available' ? { windowsPrincipalHash: this.principalHash } : {}),
      diagnosticCode: 'controlled_test_platform'
    };
  }
  async requestVerification() {
    this.verificationCalls += 1;
    this.onVerification?.();
    this.onVerification = undefined;
    const outcome = this.nextOutcome;
    this.nextOutcome = 'verified';
    return {
      outcome,
      ...(outcome === 'verified' ? { windowsPrincipalHash: this.principalHash } : {}),
      diagnosticCode: 'controlled_test_platform'
    };
  }
}

const directory = mkdtempSync(join(tmpdir(), 'panthera-30-k-windows-hello-'));
const databasePath = join(directory, 'family.db');
const deviceIdentityPath = join(directory, 'device', 'identity.json');
const password = 'WindowsHelloGucluParola!2026';
const nextPassword = 'WindowsHelloYeniParola!2026';
const platform = new ControlledWindowsHelloPlatform();
const binding = {
  value: {
    deviceId: 'controlled-device-a',
    deviceFingerprint: 'f'.repeat(64),
    displayName: 'Kontrollü Windows Cihazı'
  },
  current() {
    return { ...this.value };
  }
};
const checks = [];
const check = (name, operation) => {
  operation();
  checks.push(name);
};
const probe = () => new DatabaseSync(databasePath, { readOnly: true });
let store;
let nativeAssessment = { availability: 'error', diagnosticCode: 'not_run' };

try {
  store = new FamilyDataStore({
    databasePath,
    deviceIdentityPath,
    applicationVersion: '4.8.2026-29',
    migrationBackupDirectory: join(directory, 'migration-backups'),
    securityConfig: { sessionIdleTimeoutMinutes: 15, maximumFailedLoginAttempts: 5 },
    windowsHelloPlatform: platform,
    windowsHelloDeviceBinding: binding
  });
  const setup = store.setupAdmin({
    displayName: 'Windows Hello Yöneticisi',
    email: 'windows-hello@example.com',
    password
  });
  assert.equal(setup.authenticated, true);
  const accountId = (() => {
    const database = probe();
    try { return String(database.prepare('SELECT id FROM accounts LIMIT 1').get().id); }
    finally { database.close(); }
  })();

  const initialState = await store.getWindowsHelloState(accountId);
  check('available platform reports password fallback before enrollment', () => {
    assert.equal(initialState.availability, 'available');
    assert.equal(initialState.enrolled, false);
    assert.equal(initialState.passwordFallbackAvailable, true);
  });

  const enrolled = await store.enrollWindowsHello({ password, displayName: 'Ana Windows Hello' });
  check('verified enrollment creates an epoch and device bound registration', () => {
    assert.equal(enrolled.enrolled, true);
    assert.equal(enrolled.outcome, 'enrolled');
    assert.equal(enrolled.registration?.deviceId, binding.value.deviceId);
    assert.equal(enrolled.registration?.securityEpoch, 0);
  });
  check('registration persists only a hashed Windows principal and no biometric material', () => {
    const database = probe();
    try {
      const row = database.prepare(`
        SELECT windows_principal_hash,device_fingerprint,security_epoch
        FROM windows_hello_registrations WHERE revoked_at IS NULL
      `).get();
      assert.equal(row.windows_principal_hash, principalA);
      assert.equal(row.device_fingerprint, binding.value.deviceFingerprint);
      assert.equal(Number(row.security_epoch), 0);
      const sql = String(database.prepare(
        "SELECT sql FROM sqlite_master WHERE type='table' AND name='windows_hello_registrations'"
      ).get().sql);
      assert.equal(/biometric|template|\bpin\b/iu.test(sql), false);
    } finally {
      database.close();
    }
  });

  const stateAfterEnrollment = await store.getWindowsHelloState(accountId);
  check('state reports a fully matching active registration', () => {
    assert.equal(stateAfterEnrollment.enrolled, true);
    assert.equal(stateAfterEnrollment.deviceChanged, false);
    assert.equal(stateAfterEnrollment.principalChanged, false);
    assert.equal(stateAfterEnrollment.securityEpochChanged, false);
  });

  store.logout();
  const helloLogin = await store.loginWithWindowsHello({ accountId });
  check('verified Windows Hello login starts the epoch-bound application session', () => {
    assert.equal(helloLogin.authenticated, true);
    assert.equal(helloLogin.method, 'windows_hello');
    assert.equal(store.getAuthState().authenticated, true);
    assert.equal(store.getAuthState().sessionSecurityEpoch, 0);
  });

  const helloReauth = await store.reauthenticateWithWindowsHello({});
  check('verified Windows Hello reauthentication succeeds without password', () => {
    assert.equal(helloReauth.authenticated, true);
    assert.equal(helloReauth.method, 'windows_hello');
  });

  const reauthenticationAuditsBeforeExpiryRace = (() => {
    const database = probe();
    try {
      return Number(database.prepare(
        "SELECT COUNT(*) count FROM audit_log WHERE action='windows_hello.reauthenticated'"
      ).get().count);
    } finally {
      database.close();
    }
  })();
  platform.onVerification = () => {
    const database = new DatabaseSync(databasePath);
    try {
      database.prepare('UPDATE accounts SET ends_at=? WHERE id=?').run(
        '2000-01-01T00:00:00.000Z',
        accountId
      );
    } finally {
      database.close();
    }
  };
  const expiredDuringReauthentication = await store.reauthenticateWithWindowsHello({});
  check('account expiry during the native prompt fails reauthentication closed', () => {
    assert.equal(expiredDuringReauthentication.authenticated, false);
    assert.equal(expiredDuringReauthentication.outcome, 'error');
    assert.equal(expiredDuringReauthentication.diagnosticCode, 'post_prompt_revalidation_failed');
    assert.equal(store.getAuthState().authenticated, false);
    const database = probe();
    try {
      assert.equal(Number(database.prepare(
        "SELECT COUNT(*) count FROM audit_log WHERE action='windows_hello.reauthenticated'"
      ).get().count), reauthenticationAuditsBeforeExpiryRace);
    } finally {
      database.close();
    }
  });
  {
    const database = new DatabaseSync(databasePath);
    try {
      database.prepare('UPDATE accounts SET ends_at=NULL WHERE id=?').run(accountId);
    } finally {
      database.close();
    }
  }

  store.logout();
  platform.nextOutcome = 'cancelled';
  const failuresBeforeCancel = (() => {
    const database = probe();
    try { return Number(database.prepare('SELECT failed_login_count FROM accounts WHERE id=?').get(accountId).failed_login_count); }
    finally { database.close(); }
  })();
  const cancelled = await store.loginWithWindowsHello({ accountId });
  check('user cancellation does not create a session or count as a bad password', () => {
    assert.equal(cancelled.authenticated, false);
    assert.equal(cancelled.outcome, 'cancelled');
    assert.equal(store.getAuthState().authenticated, false);
    const database = probe();
    try {
      assert.equal(
        Number(database.prepare('SELECT failed_login_count FROM accounts WHERE id=?').get(accountId).failed_login_count),
        failuresBeforeCancel
      );
    } finally {
      database.close();
    }
  });

  const promptsBeforeAvailabilityError = platform.verificationCalls;
  platform.availability = 'error';
  const availabilityError = await store.loginWithWindowsHello({ accountId });
  check('controlled native availability error returns a structured fail-closed outcome', () => {
    assert.equal(availabilityError.authenticated, false);
    assert.equal(availabilityError.outcome, 'error');
    assert.equal(availabilityError.diagnosticCode, 'controlled_test_platform');
    assert.equal(platform.verificationCalls, promptsBeforeAvailabilityError);
    assert.equal(store.getAuthState().authenticated, false);
  });

  platform.availability = 'available';
  platform.nextOutcome = 'error';
  const promptsBeforePromptError = platform.verificationCalls;
  const promptError = await store.loginWithWindowsHello({ accountId });
  check('controlled native prompt error returns a structured fail-closed outcome', () => {
    assert.equal(promptError.authenticated, false);
    assert.equal(promptError.outcome, 'error');
    assert.equal(promptError.diagnosticCode, 'controlled_test_platform');
    assert.equal(platform.verificationCalls, promptsBeforePromptError + 1);
    assert.equal(store.getAuthState().authenticated, false);
  });

  const promptsBeforeBusyFallback = platform.verificationCalls;
  platform.availability = 'device_busy';
  const busyFallback = await store.loginWithWindowsHello({
    accountId,
    fallback: { password }
  });
  check('explicit password fallback reuses the canonical login when Windows Hello is busy', () => {
    assert.equal(busyFallback.authenticated, true);
    assert.equal(busyFallback.method, 'password_fallback');
    assert.equal(busyFallback.outcome, 'device_busy');
    assert.equal(platform.verificationCalls, promptsBeforeBusyFallback);
  });

  store.logout();
  platform.availability = 'available';
  platform.nextOutcome = 'retries_exhausted';
  const retries = await store.loginWithWindowsHello({ accountId });
  check('retries exhausted fails closed without password downgrade or session', () => {
    assert.equal(retries.authenticated, false);
    assert.equal(retries.outcome, 'retries_exhausted');
    assert.equal(store.getAuthState().authenticated, false);
  });

  const promptsBeforeLockRace = platform.verificationCalls;
  platform.onVerification = () => {
    const database = new DatabaseSync(databasePath);
    try {
      database.prepare(
        'UPDATE accounts SET failed_login_count=?,locked_until=? WHERE id=?'
      ).run(4, '2099-01-01T00:00:00.000Z', accountId);
    } finally {
      database.close();
    }
  };
  const lockedDuringPrompt = await store.loginWithWindowsHello({ accountId });
  check('account lock during the native prompt is preserved and blocks Hello login', () => {
    assert.equal(lockedDuringPrompt.authenticated, false);
    assert.equal(lockedDuringPrompt.outcome, 'error');
    assert.equal(lockedDuringPrompt.diagnosticCode, 'post_prompt_revalidation_failed');
    assert.equal(platform.verificationCalls, promptsBeforeLockRace + 1);
    assert.equal(store.getAuthState().authenticated, false);
    const database = probe();
    try {
      const row = database.prepare(
        'SELECT failed_login_count,locked_until FROM accounts WHERE id=?'
      ).get(accountId);
      assert.equal(Number(row.failed_login_count), 4);
      assert.equal(row.locked_until, '2099-01-01T00:00:00.000Z');
    } finally {
      database.close();
    }
  });
  {
    const database = new DatabaseSync(databasePath);
    try {
      database.prepare(
        'UPDATE accounts SET failed_login_count=0,locked_until=NULL WHERE id=?'
      ).run(accountId);
    } finally {
      database.close();
    }
  }

  const promptsBeforeEpochRace = platform.verificationCalls;
  platform.onVerification = () => {
    const database = new DatabaseSync(databasePath);
    try {
      database.prepare(
        'UPDATE accounts SET security_epoch=security_epoch+1 WHERE id=?'
      ).run(accountId);
    } finally {
      database.close();
    }
  };
  const epochChangedDuringLogin = await store.loginWithWindowsHello({ accountId });
  check('security epoch change during the native prompt revokes login registration', () => {
    assert.equal(epochChangedDuringLogin.authenticated, false);
    assert.equal(epochChangedDuringLogin.outcome, 'security_epoch_changed');
    assert.equal(platform.verificationCalls, promptsBeforeEpochRace + 1);
    assert.equal(store.getAuthState().authenticated, false);
    const database = probe();
    try {
      assert.equal(database.prepare(
        'SELECT revocation_reason FROM windows_hello_registrations ORDER BY enrolled_at DESC LIMIT 1'
      ).get().revocation_reason, 'security_epoch_changed');
      assert.equal(Number(database.prepare(
        'SELECT COUNT(*) count FROM windows_hello_registrations WHERE revoked_at IS NULL'
      ).get().count), 0);
    } finally {
      database.close();
    }
  });
  store.login({ accountId, password });
  await store.enrollWindowsHello({ password });

  const promptsBeforeDeviceChange = platform.verificationCalls;
  platform.onVerification = () => {
    binding.value = {
      ...binding.value,
      deviceFingerprint: 'e'.repeat(64),
      displayName: 'Değişmiş Windows Cihazı'
    };
  };
  const deviceChangedDuringPrompt = await store.loginWithWindowsHello({ accountId });
  check('device binding change during prompt revokes registration before session start', () => {
    assert.equal(deviceChangedDuringPrompt.authenticated, false);
    assert.equal(deviceChangedDuringPrompt.outcome, 'device_changed');
    assert.equal(platform.verificationCalls, promptsBeforeDeviceChange + 1);
    const database = probe();
    try {
      assert.equal(Number(database.prepare(
        "SELECT COUNT(*) count FROM windows_hello_registrations WHERE revoked_at IS NULL"
      ).get().count), 0);
      assert.equal(database.prepare(
        "SELECT revocation_reason FROM windows_hello_registrations ORDER BY enrolled_at DESC LIMIT 1"
      ).get().revocation_reason, 'device_changed');
    } finally {
      database.close();
    }
  });

  store.login({ accountId, password });
  const reenrolledAfterDeviceChange = await store.enrollWindowsHello({ password });
  check('password-confirmed reenrollment creates a new active historical row', () => {
    assert.equal(reenrolledAfterDeviceChange.enrolled, true);
    const database = probe();
    try {
      assert.equal(Number(database.prepare(
        "SELECT COUNT(*) count FROM windows_hello_registrations WHERE revoked_at IS NULL"
      ).get().count), 1);
      assert.equal(Number(database.prepare(
        'SELECT COUNT(*) count FROM windows_hello_registrations'
      ).get().count), 3);
    } finally {
      database.close();
    }
  });

  store.logout();
  const promptsBeforePrincipalChange = platform.verificationCalls;
  platform.principalHash = principalB;
  const principalChanged = await store.loginWithWindowsHello({ accountId });
  check('Windows principal change revokes without opening a verification prompt', () => {
    assert.equal(principalChanged.authenticated, false);
    assert.equal(principalChanged.outcome, 'principal_changed');
    assert.equal(platform.verificationCalls, promptsBeforePrincipalChange);
    const database = probe();
    try {
      assert.equal(database.prepare(
        "SELECT revocation_reason FROM windows_hello_registrations ORDER BY enrolled_at DESC LIMIT 1"
      ).get().revocation_reason, 'principal_changed');
    } finally {
      database.close();
    }
  });

  store.login({ accountId, password });
  await store.enrollWindowsHello({ password });
  platform.nextOutcome = 'cancelled';
  const reauthFallback = await store.reauthenticateWithWindowsHello({
    fallback: { password }
  });
  check('cancelled reauthentication can use explicit strong password fallback', () => {
    assert.equal(reauthFallback.authenticated, true);
    assert.equal(reauthFallback.method, 'password_fallback');
    assert.equal(reauthFallback.outcome, 'cancelled');
  });

  const promptsBeforeReauthenticationEpochRace = platform.verificationCalls;
  platform.onVerification = () => {
    const database = new DatabaseSync(databasePath);
    try {
      database.prepare(
        'UPDATE accounts SET security_epoch=security_epoch+1 WHERE id=?'
      ).run(accountId);
    } finally {
      database.close();
    }
  };
  const epochChangedDuringReauthentication = await store.reauthenticateWithWindowsHello({});
  check('security epoch change during the native prompt revokes reauthentication registration', () => {
    assert.equal(epochChangedDuringReauthentication.authenticated, false);
    assert.equal(epochChangedDuringReauthentication.outcome, 'security_epoch_changed');
    assert.equal(platform.verificationCalls, promptsBeforeReauthenticationEpochRace + 1);
    assert.equal(store.getAuthState().authenticated, false);
    const database = probe();
    try {
      assert.equal(database.prepare(
        'SELECT revocation_reason FROM windows_hello_registrations ORDER BY enrolled_at DESC LIMIT 1'
      ).get().revocation_reason, 'security_epoch_changed');
    } finally {
      database.close();
    }
  });
  store.login({ accountId, password });
  await store.enrollWindowsHello({ password });

  const epochBeforeRotation = store.getAuthState().sessionSecurityEpoch;
  const rotation = store.rotateAccountSecurityEpochAfterMaintenanceRecovery();
  check('security recovery advances the account epoch', () => {
    assert.equal(rotation.previousSecurityEpoch, epochBeforeRotation);
    assert.equal(rotation.securityEpoch, Number(epochBeforeRotation) + 1);
  });
  store.logout();
  const promptsBeforeEpochMismatch = platform.verificationCalls;
  const staleEpoch = await store.loginWithWindowsHello({ accountId });
  check('stale security epoch revokes registration without prompting', () => {
    assert.equal(staleEpoch.authenticated, false);
    assert.equal(staleEpoch.outcome, 'security_epoch_changed');
    assert.equal(platform.verificationCalls, promptsBeforeEpochMismatch);
  });

  store.login({ accountId, password });
  await store.enrollWindowsHello({ password });
  check('reenrollment maintains exactly one active row per account and device', () => {
    const database = probe();
    try {
      assert.equal(Number(database.prepare(
        "SELECT COUNT(*) count FROM windows_hello_registrations WHERE revoked_at IS NULL"
      ).get().count), 1);
      assert.ok(Number(database.prepare(
        'SELECT COUNT(*) count FROM windows_hello_registrations'
      ).get().count) >= 4);
    } finally {
      database.close();
    }
  });

  check('migration trigger blocks mutation of immutable registration binding', () => {
    const database = new DatabaseSync(databasePath);
    try {
      assert.throws(
        () => database.prepare(`
          UPDATE windows_hello_registrations
          SET device_fingerprint=?
          WHERE revoked_at IS NULL
        `).run('d'.repeat(64)),
        /invalid windows hello registration transition/u
      );
    } finally {
      database.close();
    }
  });

  check('migration freezes revoked verification history and enforces timestamp chronology', () => {
    const database = new DatabaseSync(databasePath);
    try {
      const revoked = database.prepare(`
        SELECT id,last_verified_at,revoked_at
        FROM windows_hello_registrations
        WHERE revoked_at IS NOT NULL AND last_verified_at IS NOT NULL
        ORDER BY revoked_at DESC LIMIT 1
      `).get();
      assert.ok(revoked);
      assert.throws(
        () => database.prepare(`
          UPDATE windows_hello_registrations
          SET last_verified_at=datetime(last_verified_at,'+1 second')
          WHERE id=?
        `).run(revoked.id),
        /invalid windows hello registration transition/u
      );
      assert.throws(
        () => database.prepare(`
          UPDATE windows_hello_registrations
          SET revoked_at='1900-01-01T00:00:00.000Z',revocation_reason='manual'
          WHERE revoked_at IS NULL
        `).run(),
        /CHECK constraint failed/u
      );
    } finally {
      database.close();
    }
  });

  check('success and revocation paths write chained audit evidence', () => {
    const database = probe();
    try {
      assert.ok(Number(database.prepare(
        "SELECT COUNT(*) count FROM audit_log WHERE action='windows_hello.registration_enrolled'"
      ).get().count) >= 4);
      assert.ok(Number(database.prepare(
        "SELECT COUNT(*) count FROM audit_log WHERE action LIKE 'windows_hello.registration_revoked_%'"
      ).get().count) >= 5);
      assert.ok(Number(database.prepare(
        "SELECT COUNT(*) count FROM audit_log WHERE action='windows_hello.session_started'"
      ).get().count) >= 1);
      assert.ok(Number(database.prepare(
        "SELECT COUNT(*) count FROM audit_log WHERE action='windows_hello.login_prompt_cancelled'"
      ).get().count) >= 1);
      assert.ok(Number(database.prepare(
        "SELECT COUNT(*) count FROM audit_log WHERE action='windows_hello.login_prompt_retries_exhausted'"
      ).get().count) >= 1);
      assert.ok(Number(database.prepare(
        "SELECT COUNT(*) count FROM audit_log WHERE action='windows_hello.login_availability_error'"
      ).get().count) >= 1);
      assert.ok(Number(database.prepare(
        "SELECT COUNT(*) count FROM audit_log WHERE action='windows_hello.login_prompt_error'"
      ).get().count) >= 1);
      assert.ok(Number(database.prepare(
        "SELECT COUNT(*) count FROM audit_log WHERE action LIKE 'windows_hello.%_post_prompt_revalidation_failed'"
      ).get().count) >= 2);
      assert.equal(Number(database.prepare(
        "SELECT COUNT(*) count FROM audit_log WHERE entry_hash IS NULL OR prev_hash IS NULL"
      ).get().count), 0);
    } finally {
      database.close();
    }
  });
  const auditIntegrity = store.verifyAuditIntegrity();
  check('application audit verifier recomputes the complete chained audit ledger', () => {
    assert.equal(auditIntegrity.valid, true);
    assert.ok(auditIntegrity.checkedEntries > 0);
    assert.equal(auditIntegrity.firstInvalidEntryId, undefined);
    assert.match(auditIntegrity.headHash, /^[a-f0-9]{64}$/u);
  });

  store.changePassword({ currentPassword: password, newPassword: nextPassword });
  check('canonical password management remains functional after Windows Hello enrollment', () => {
    store.logout();
    assert.equal(store.login({ accountId, password: nextPassword }).authenticated, true);
  });

  nativeAssessment = await new PowerShellWindowsHelloPlatformAdapter().assessAvailability();
  check('native noninteractive availability probe returns a governed structured status', () => {
    assert.ok([
      'available',
      'device_not_present',
      'not_configured_for_user',
      'disabled_by_policy',
      'device_busy',
      'platform_not_supported',
      'error'
    ].includes(nativeAssessment.availability));
    if (nativeAssessment.availability === 'available') {
      assert.match(nativeAssessment.windowsPrincipalHash, /^[a-f0-9]{64}$/u);
    }
  });
  const missingWindowVerification = await new PowerShellWindowsHelloPlatformAdapter()
    .requestVerification('Windows Hello pencere sınırı kontrolü');
  check('desktop native verification fails closed before launch without an owner window', () => {
    assert.equal(missingWindowVerification.outcome, 'error');
    assert.equal(missingWindowVerification.diagnosticCode, 'window_handle_unavailable');
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
      controlledPlatformScenarios: 'PASS',
      enrollment: 'PASS',
      windowsHelloLogin: 'PASS',
      windowsHelloReauthentication: 'PASS',
      passwordFallback: 'PASS',
      cancellation: 'PASS',
      unavailableAndErrorOutcomes: 'PASS',
      deviceChangeRevocation: 'PASS',
      principalChangeRevocation: 'PASS',
      securityEpochRevocation: 'PASS',
      postPromptRevalidation: 'PASS',
      migrationAndRepository: 'PASS',
      auditIntegrity: 'PASS',
      nativeAvailabilityAssessment: nativeAssessment.availability,
      nativeDesktopWindowBoundary: 'PASS',
      nativeInteractiveWindowsHello: 'NOT_RUN_NOT_PASS'
    },
    evidenceBoundary: {
      controlledPlatformIsSimulation: true,
      nativePromptExecuted: false,
      nativeAuthenticationPassClaimed: false
    },
    metrics: {
      controlledAssessmentCalls: platform.assessmentCalls,
      controlledVerificationCalls: platform.verificationCalls
    },
    generatedAt: new Date().toISOString()
  };
  mkdirSync('artifacts/validation', { recursive: true });
  writeFileSync(
    reportPath,
    `${JSON.stringify(report, null, 2)}\n`
  );
  console.log(JSON.stringify(report, null, 2));
} finally {
  store?.close();
  rmSync(directory, { recursive: true, force: true });
}

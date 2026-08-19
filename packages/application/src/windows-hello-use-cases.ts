import {
  ERROR_CODES,
  asUserId,
  createAppError,
  err,
  ok,
  type AppError,
  type CorrelationId,
  type ErrorCode,
  type Result,
  type UserId
} from '@ppt/core';
import type {
  EnrollWindowsHelloInput,
  WindowsHelloAuthenticationOutcome,
  WindowsHelloAuthenticationView,
  WindowsHelloAvailability,
  WindowsHelloEnrollmentView,
  WindowsHelloPromptOutcome,
  WindowsHelloRegistrationView,
  WindowsHelloStateView
} from '@ppt/domain';
import type {
  AuthAccountRecord,
  AuthApplicationContext,
  AuthApplicationUnitOfWork,
  AuthSessionPort,
  AuthWriteScope,
  PasswordService,
  SecondFactorService,
  WindowsHelloRegistrationRecord,
  WindowsHelloRegistrationRevocationReason
} from './auth-use-cases.js';

export interface WindowsHelloDeviceBinding {
  readonly deviceId: string;
  readonly deviceFingerprint: string;
  readonly displayName: string;
}

export interface WindowsHelloDeviceBindingPort {
  current(): WindowsHelloDeviceBinding;
}

export interface WindowsHelloPlatformAssessment {
  readonly availability: WindowsHelloAvailability;
  readonly windowsPrincipalHash?: string;
  readonly diagnosticCode?: string;
}

export interface WindowsHelloPlatformVerification {
  readonly outcome: WindowsHelloPromptOutcome;
  readonly windowsPrincipalHash?: string;
  readonly diagnosticCode?: string;
}

export interface WindowsHelloPlatformPort {
  assessAvailability(): Promise<WindowsHelloPlatformAssessment>;
  requestVerification(message: string): Promise<WindowsHelloPlatformVerification>;
}

export type WindowsHelloApplicationContext = AuthApplicationContext;

const principalHashPattern = /^[a-f0-9]{64}$/u;
export const WINDOWS_HELLO_VERIFICATION_MESSAGE = 'ParsYuva AYM için kimliğinizi doğrulayın.';

const authError = (
  correlationId: CorrelationId,
  message: string,
  code: ErrorCode = ERROR_CODES.AUTH_INVALID_CREDENTIALS
): AppError => createAppError({
  code,
  message,
  category: 'authentication',
  correlationId
});

const conflictError = (correlationId: CorrelationId, message: string): AppError => createAppError({
  code: ERROR_CODES.RESOURCE_CONFLICT,
  message,
  category: 'conflict',
  correlationId
});

const activeAt = (account: AuthAccountRecord, now: string): boolean => account.status === 'active'
  && Date.parse(account.startsAt) <= Date.parse(now)
  && (!account.endsAt || Date.parse(account.endsAt) >= Date.parse(now));

const unlockedAt = (account: AuthAccountRecord, now: string): boolean =>
  !account.lockedUntil || Date.parse(account.lockedUntil) <= Date.parse(now);

const sessionMatches = (
  session: AuthSessionPort,
  account: AuthAccountRecord
): boolean => {
  const snapshot = session.snapshot();
  return snapshot.active
    && snapshot.accountId === account.id
    && snapshot.securityEpoch === account.securityEpoch;
};

const toRegistrationView = (
  registration: WindowsHelloRegistrationRecord
): WindowsHelloRegistrationView => ({
  id: registration.id,
  deviceId: registration.deviceId,
  displayName: registration.displayName,
  enrolledAt: registration.enrolledAt,
  securityEpoch: registration.securityEpoch,
  ...(registration.lastVerifiedAt ? { lastVerifiedAt: registration.lastVerifiedAt } : {}),
  ...(registration.revokedAt ? { revokedAt: registration.revokedAt } : {}),
  ...(registration.revocationReason ? { revocationReason: registration.revocationReason } : {})
});

const authenticationView = (
  outcome: WindowsHelloAuthenticationOutcome,
  extras: {
    readonly authenticated?: boolean;
    readonly method?: WindowsHelloAuthenticationView['method'];
    readonly diagnosticCode?: string;
    readonly registration?: WindowsHelloRegistrationRecord;
  } = {}
): WindowsHelloAuthenticationView => ({
  authenticated: extras.authenticated ?? false,
  method: extras.method ?? 'none',
  outcome,
  passwordFallbackAvailable: true,
  ...(extras.diagnosticCode ? { diagnosticCode: extras.diagnosticCode } : {}),
  ...(extras.registration ? { registration: toRegistrationView(extras.registration) } : {})
});

const enrollmentView = (
  outcome: WindowsHelloEnrollmentView['outcome'],
  extras: {
    readonly enrolled?: boolean;
    readonly diagnosticCode?: string;
    readonly registration?: WindowsHelloRegistrationRecord;
  } = {}
): WindowsHelloEnrollmentView => ({
  enrolled: extras.enrolled ?? false,
  outcome,
  passwordFallbackAvailable: true,
  ...(extras.diagnosticCode ? { diagnosticCode: extras.diagnosticCode } : {}),
  ...(extras.registration ? { registration: toRegistrationView(extras.registration) } : {})
});

const safeAssessment = async (
  platform: WindowsHelloPlatformPort
): Promise<WindowsHelloPlatformAssessment> => {
  try {
    const result = await platform.assessAvailability();
    if (result.availability === 'available' && !principalHashPattern.test(result.windowsPrincipalHash ?? '')) {
      return { availability: 'error', diagnosticCode: 'principal_hash_missing_or_invalid' };
    }
    return result;
  } catch {
    return { availability: 'error', diagnosticCode: 'availability_exception' };
  }
};

const safeVerification = async (
  platform: WindowsHelloPlatformPort
): Promise<WindowsHelloPlatformVerification> => {
  try {
    const result = await platform.requestVerification(WINDOWS_HELLO_VERIFICATION_MESSAGE);
    if (result.outcome === 'verified' && !principalHashPattern.test(result.windowsPrincipalHash ?? '')) {
      return { outcome: 'error', diagnosticCode: 'verified_principal_hash_missing_or_invalid' };
    }
    return result;
  } catch {
    return { outcome: 'error', diagnosticCode: 'verification_exception' };
  }
};

const requireSensitiveConfirmation = (
  scope: AuthWriteScope,
  account: AuthAccountRecord,
  input: { readonly password: string; readonly secondFactorCode?: string },
  passwordService: PasswordService,
  secondFactorService: SecondFactorService,
  correlationId: CorrelationId
): Result<void, AppError> => {
  if (!passwordService.verify(input.password, account.passwordRecord)) {
    return err(authError(correlationId, 'Windows Hello işlemi için parola doğrulanamadı.'));
  }
  if (account.totpSecret) {
    const code = input.secondFactorCode?.trim();
    if (!code) {
      return err(authError(
        correlationId,
        'Windows Hello işlemi için iki aşamalı doğrulama kodu gereklidir.',
        ERROR_CODES.AUTH_SECOND_FACTOR_REQUIRED
      ));
    }
    if (!secondFactorService.verifyTotp(account.totpSecret, code, scope.occurredAt)) {
      return err(authError(
        correlationId,
        'Windows Hello işlemi için iki aşamalı doğrulama kodu geçersiz.',
        ERROR_CODES.AUTH_SECOND_FACTOR_INVALID
      ));
    }
  }
  return ok(undefined);
};

const revokeRegistration = (
  scope: AuthWriteScope,
  input: {
    readonly registration: WindowsHelloRegistrationRecord;
    readonly reason: WindowsHelloRegistrationRevocationReason;
    readonly auditId: string;
  }
): Result<void, AppError> => {
  const revoked = scope.revokeActiveWindowsHelloRegistration({
    registrationId: input.registration.id,
    accountId: input.registration.accountId,
    deviceId: input.registration.deviceId,
    revokedAt: scope.occurredAt,
    reason: input.reason
  });
  if (!revoked.ok) return revoked;
  if (revoked.value === 0) return ok(undefined);
  const audit = scope.appendAudit({
    id: input.auditId,
    action: `windows_hello.registration_revoked_${input.reason}`,
    resourceType: 'windows_hello_registration',
    resourceId: input.registration.id,
    occurredAt: scope.occurredAt,
    actorId: input.registration.accountId
  });
  return audit.ok ? ok(undefined) : audit;
};

const auditWindowsHelloOutcome = (
  unitOfWork: AuthApplicationUnitOfWork,
  context: WindowsHelloApplicationContext,
  input: {
    readonly accountId: UserId;
    readonly auditId: string;
    readonly phase: 'enrollment' | 'login' | 'reauthentication';
    readonly outcome: string;
  }
): Result<void, AppError> => unitOfWork.execute(context, input.accountId, (scope) => {
  const audit = scope.appendAudit({
    id: input.auditId,
    action: `windows_hello.${input.phase}_${input.outcome}`,
    resourceType: 'account',
    resourceId: input.accountId,
    occurredAt: scope.occurredAt,
    actorId: input.accountId
  });
  return audit.ok ? ok(undefined) : audit;
});

export class GetWindowsHelloStateUseCase {
  public constructor(
    private readonly unitOfWork: AuthApplicationUnitOfWork,
    private readonly platform: WindowsHelloPlatformPort,
    private readonly deviceBinding: WindowsHelloDeviceBindingPort,
    private readonly session: AuthSessionPort
  ) {}

  public async execute(
    context: WindowsHelloApplicationContext,
    requestedAccountId?: string
  ): Promise<Result<WindowsHelloStateView, AppError>> {
    let device: WindowsHelloDeviceBinding;
    try {
      device = this.deviceBinding.current();
    } catch {
      return ok({
        availability: 'error',
        enrolled: false,
        deviceChanged: false,
        principalChanged: false,
        securityEpochChanged: false,
        passwordFallbackAvailable: true,
        diagnosticCode: 'device_binding_unavailable'
      });
    }
    const assessment = await safeAssessment(this.platform);
    const accountValue = requestedAccountId?.trim()
      || this.session.currentAccountId({ touch: false });
    if (!accountValue) {
      return ok({
        availability: assessment.availability,
        enrolled: false,
        deviceChanged: false,
        principalChanged: false,
        securityEpochChanged: false,
        passwordFallbackAvailable: true,
        ...(assessment.diagnosticCode ? { diagnosticCode: assessment.diagnosticCode } : {})
      });
    }
    const accountId = asUserId(accountValue);
    const result = this.unitOfWork.execute(context, accountId, (scope) => {
      const account = scope.findAccountById(accountId);
      if (!account.ok) return account;
      const registration = account.value
        ? scope.findActiveWindowsHelloRegistration(accountId, device.deviceId)
        : ok(null);
      if (!registration.ok) return registration;
      return ok({ account: account.value, registration: registration.value });
    });
    if (!result.ok) return result;
    const registration = result.value.registration;
    const deviceChanged = Boolean(registration && registration.deviceFingerprint !== device.deviceFingerprint);
    const principalChanged = Boolean(
      registration
      && assessment.windowsPrincipalHash
      && registration.windowsPrincipalHash !== assessment.windowsPrincipalHash
    );
    const securityEpochChanged = Boolean(
      registration
      && result.value.account
      && registration.securityEpoch !== result.value.account.securityEpoch
    );
    return ok({
      availability: assessment.availability,
      enrolled: Boolean(registration && !deviceChanged && !principalChanged && !securityEpochChanged),
      deviceChanged,
      principalChanged,
      securityEpochChanged,
      passwordFallbackAvailable: true,
      ...(assessment.diagnosticCode ? { diagnosticCode: assessment.diagnosticCode } : {}),
      ...(registration ? { registration: toRegistrationView(registration) } : {})
    });
  }
}

export class EnrollWindowsHelloUseCase {
  public constructor(
    private readonly unitOfWork: AuthApplicationUnitOfWork,
    private readonly platform: WindowsHelloPlatformPort,
    private readonly deviceBinding: WindowsHelloDeviceBindingPort,
    private readonly passwordService: PasswordService,
    private readonly secondFactorService: SecondFactorService,
    private readonly session: AuthSessionPort
  ) {}

  public async execute(input: {
    readonly context: WindowsHelloApplicationContext;
    readonly command: EnrollWindowsHelloInput;
    readonly registrationId: string;
    readonly auditId: string;
    readonly revocationAuditId: string;
  }): Promise<Result<WindowsHelloEnrollmentView, AppError>> {
    const accountId = this.session.currentAccountId({ touch: false });
    if (!accountId) {
      return err(authError(
        input.context.correlationId,
        'Windows Hello kaydı için oturum açılmalıdır.',
        ERROR_CODES.AUTHENTICATION_REQUIRED
      ));
    }
    let before: WindowsHelloDeviceBinding;
    try {
      before = this.deviceBinding.current();
    } catch {
      return ok(enrollmentView('error', { diagnosticCode: 'device_binding_unavailable' }));
    }
    const preflight = this.unitOfWork.execute(input.context, accountId, (scope) => {
      const account = scope.findAccountById(accountId);
      if (!account.ok) return account;
      if (
        !account.value
        || !activeAt(account.value, scope.occurredAt)
        || !unlockedAt(account.value, scope.occurredAt)
      ) {
        return err(authError(input.context.correlationId, 'Windows Hello kaydı için etkin hesap bulunamadı.'));
      }
      if (!sessionMatches(this.session, account.value)) {
        this.session.clear();
        return err(authError(
          input.context.correlationId,
          'Oturum güvenlik dönemi değişti. Lütfen yeniden giriş yapın.',
          ERROR_CODES.AUTHENTICATION_REQUIRED
        ));
      }
      const confirmed = requireSensitiveConfirmation(
        scope,
        account.value,
        input.command,
        this.passwordService,
        this.secondFactorService,
        input.context.correlationId
      );
      return confirmed.ok ? ok({ securityEpoch: account.value.securityEpoch }) : confirmed;
    });
    if (!preflight.ok) return preflight;
    const assessment = await safeAssessment(this.platform);
    if (assessment.availability !== 'available') {
      const audited = auditWindowsHelloOutcome(this.unitOfWork, input.context, {
        accountId,
        auditId: input.auditId,
        phase: 'enrollment',
        outcome: `availability_${assessment.availability}`
      });
      return audited.ok ? ok(enrollmentView(assessment.availability, {
        ...(assessment.diagnosticCode ? { diagnosticCode: assessment.diagnosticCode } : {})
      })) : audited;
    }
    const verification = await safeVerification(this.platform);
    if (verification.outcome !== 'verified') {
      const audited = auditWindowsHelloOutcome(this.unitOfWork, input.context, {
        accountId,
        auditId: input.auditId,
        phase: 'enrollment',
        outcome: `prompt_${verification.outcome}`
      });
      return audited.ok ? ok(enrollmentView(verification.outcome, {
        ...(verification.diagnosticCode ? { diagnosticCode: verification.diagnosticCode } : {})
      })) : audited;
    }
    if (verification.windowsPrincipalHash !== assessment.windowsPrincipalHash) {
      return ok(enrollmentView('principal_changed', { diagnosticCode: 'principal_changed_during_prompt' }));
    }
    let after: WindowsHelloDeviceBinding;
    try {
      after = this.deviceBinding.current();
    } catch {
      return ok(enrollmentView('device_changed', { diagnosticCode: 'device_binding_lost_after_prompt' }));
    }
    if (
      before.deviceId !== after.deviceId
      || before.deviceFingerprint !== after.deviceFingerprint
    ) {
      return ok(enrollmentView('device_changed', { diagnosticCode: 'device_changed_during_prompt' }));
    }
    const displayName = input.command.displayName?.trim() || after.displayName;
    if (displayName.length < 1 || displayName.length > 120) {
      return err(createAppError({
        code: ERROR_CODES.CORE_INVALID_ARGUMENT,
        message: 'Windows Hello cihaz adı 1 ile 120 karakter arasında olmalıdır.',
        category: 'validation',
        correlationId: input.context.correlationId
      }));
    }
    const persisted = this.unitOfWork.execute(input.context, accountId, (scope) => {
      const account = scope.findAccountById(accountId);
      if (!account.ok) return account;
      if (
        !account.value
        || !activeAt(account.value, scope.occurredAt)
        || !unlockedAt(account.value, scope.occurredAt)
        || account.value.securityEpoch !== preflight.value.securityEpoch
        || !sessionMatches(this.session, account.value)
      ) {
        return err(conflictError(input.context.correlationId, 'Windows Hello kaydı sırasında hesap durumu değişti.'));
      }
      const existing = scope.findActiveWindowsHelloRegistration(accountId, after.deviceId);
      if (!existing.ok) return existing;
      if (existing.value) {
        const revoked = revokeRegistration(scope, {
          registration: existing.value,
          reason: 'reenrolled',
          auditId: input.revocationAuditId
        });
        if (!revoked.ok) return revoked;
      }
      const registration: WindowsHelloRegistrationRecord = {
        id: input.registrationId,
        accountId,
        deviceId: after.deviceId,
        deviceFingerprint: after.deviceFingerprint,
        windowsPrincipalHash: verification.windowsPrincipalHash!,
        displayName,
        securityEpoch: account.value.securityEpoch,
        enrolledAt: scope.occurredAt
      };
      const inserted = scope.insertWindowsHelloRegistration(registration);
      if (!inserted.ok) return inserted;
      const audit = scope.appendAudit({
        id: input.auditId,
        action: 'windows_hello.registration_enrolled',
        resourceType: 'windows_hello_registration',
        resourceId: registration.id,
        occurredAt: scope.occurredAt,
        actorId: accountId
      });
      return audit.ok ? ok(registration) : audit;
    });
    return persisted.ok
      ? ok(enrollmentView('enrolled', { enrolled: true, registration: persisted.value }))
      : persisted;
  }
}

interface ReadyRegistration {
  readonly account: AuthAccountRecord;
  readonly registration: WindowsHelloRegistrationRecord;
}

type WindowsHelloLoginCommit =
  | {
    readonly kind: 'verified';
    readonly accountId: UserId;
    readonly securityEpoch: number;
    readonly registration: WindowsHelloRegistrationRecord;
  }
  | { readonly kind: 'security_epoch_changed' }
  | { readonly kind: 'revalidation_failed' };

type WindowsHelloReauthenticationCommit =
  | { readonly kind: 'verified'; readonly registration: WindowsHelloRegistrationRecord }
  | { readonly kind: 'security_epoch_changed' }
  | { readonly kind: 'revalidation_failed' };

const inspectRegistration = (
  scope: AuthWriteScope,
  input: {
    readonly account: AuthAccountRecord;
    readonly registration: WindowsHelloRegistrationRecord;
    readonly device: WindowsHelloDeviceBinding;
    readonly revocationAuditId: string;
  }
): Result<WindowsHelloAuthenticationOutcome | null, AppError> => {
  const mismatch: { readonly outcome: WindowsHelloAuthenticationOutcome; readonly reason: WindowsHelloRegistrationRevocationReason } | undefined =
    input.registration.deviceFingerprint !== input.device.deviceFingerprint
      ? { outcome: 'device_changed', reason: 'device_changed' }
      : input.registration.securityEpoch !== input.account.securityEpoch
        ? { outcome: 'security_epoch_changed', reason: 'security_epoch_changed' }
        : undefined;
  if (!mismatch) return ok(null);
  const revoked = revokeRegistration(scope, {
    registration: input.registration,
    reason: mismatch.reason,
    auditId: input.revocationAuditId
  });
  return revoked.ok ? ok(mismatch.outcome) : revoked;
};

export class LoginWithWindowsHelloUseCase {
  public constructor(
    private readonly unitOfWork: AuthApplicationUnitOfWork,
    private readonly platform: WindowsHelloPlatformPort,
    private readonly deviceBinding: WindowsHelloDeviceBindingPort,
    private readonly session: AuthSessionPort
  ) {}

  public async execute(input: {
    readonly context: WindowsHelloApplicationContext;
    readonly accountId: string;
    readonly auditId: string;
    readonly revocationAuditId: string;
  }): Promise<Result<WindowsHelloAuthenticationView, AppError>> {
    const accountValue = input.accountId.trim();
    if (!accountValue) return ok(authenticationView('account_unavailable'));
    const accountId = asUserId(accountValue);
    let before: WindowsHelloDeviceBinding;
    try {
      before = this.deviceBinding.current();
    } catch {
      return ok(authenticationView('error', { diagnosticCode: 'device_binding_unavailable' }));
    }
    const preflight = this.unitOfWork.execute<ReadyRegistration | WindowsHelloAuthenticationOutcome>(
      input.context,
      asUserId('anonymous-windows-hello-login'),
      (scope) => {
        const account = scope.findAccountById(accountId);
        if (!account.ok) return account;
        if (
          !account.value
          || !activeAt(account.value, scope.occurredAt)
          || !unlockedAt(account.value, scope.occurredAt)
        ) return ok('account_unavailable');
        const registration = scope.findActiveWindowsHelloRegistration(accountId, before.deviceId);
        if (!registration.ok) return registration;
        if (!registration.value) return ok('registration_not_found');
        const inspected = inspectRegistration(scope, {
          account: account.value,
          registration: registration.value,
          device: before,
          revocationAuditId: input.revocationAuditId
        });
        if (!inspected.ok) return inspected;
        return inspected.value
          ? ok(inspected.value)
          : ok({ account: account.value, registration: registration.value });
      }
    );
    if (!preflight.ok) return preflight;
    if (typeof preflight.value === 'string') return ok(authenticationView(preflight.value));
    const ready = preflight.value;
    const assessment = await safeAssessment(this.platform);
    if (assessment.availability !== 'available') {
      const audited = auditWindowsHelloOutcome(this.unitOfWork, input.context, {
        accountId,
        auditId: input.auditId,
        phase: 'login',
        outcome: `availability_${assessment.availability}`
      });
      return audited.ok ? ok(authenticationView(assessment.availability, {
        ...(assessment.diagnosticCode ? { diagnosticCode: assessment.diagnosticCode } : {})
      })) : audited;
    }
    if (assessment.windowsPrincipalHash !== ready.registration.windowsPrincipalHash) {
      const revoked = this.unitOfWork.execute(input.context, accountId, (scope) =>
        revokeRegistration(scope, {
          registration: ready.registration,
          reason: 'principal_changed',
          auditId: input.revocationAuditId
        })
      );
      return revoked.ok ? ok(authenticationView('principal_changed')) : revoked;
    }
    const verification = await safeVerification(this.platform);
    if (verification.outcome !== 'verified') {
      const audited = auditWindowsHelloOutcome(this.unitOfWork, input.context, {
        accountId,
        auditId: input.auditId,
        phase: 'login',
        outcome: `prompt_${verification.outcome}`
      });
      return audited.ok ? ok(authenticationView(verification.outcome, {
        ...(verification.diagnosticCode ? { diagnosticCode: verification.diagnosticCode } : {})
      })) : audited;
    }
    if (verification.windowsPrincipalHash !== assessment.windowsPrincipalHash) {
      const revoked = this.unitOfWork.execute(input.context, accountId, (scope) =>
        revokeRegistration(scope, {
          registration: ready.registration,
          reason: 'principal_changed',
          auditId: input.revocationAuditId
        })
      );
      return revoked.ok
        ? ok(authenticationView('principal_changed', { diagnosticCode: 'principal_changed_during_prompt' }))
        : revoked;
    }
    let after: WindowsHelloDeviceBinding;
    try {
      after = this.deviceBinding.current();
    } catch {
      return ok(authenticationView('device_changed', { diagnosticCode: 'device_binding_lost_after_prompt' }));
    }
    if (after.deviceId !== before.deviceId || after.deviceFingerprint !== before.deviceFingerprint) {
      const revoked = this.unitOfWork.execute(input.context, accountId, (scope) =>
        revokeRegistration(scope, {
          registration: ready.registration,
          reason: 'device_changed',
          auditId: input.revocationAuditId
        })
      );
      return revoked.ok
        ? ok(authenticationView('device_changed', { diagnosticCode: 'device_changed_during_prompt' }))
        : revoked;
    }
    const committed = this.unitOfWork.execute<WindowsHelloLoginCommit>(input.context, accountId, (scope) => {
      const account = scope.findAccountById(accountId);
      if (!account.ok) return account;
      const registration = scope.findActiveWindowsHelloRegistration(accountId, after.deviceId);
      if (!registration.ok) return registration;
      if (
        !account.value
        || !registration.value
        || registration.value.id !== ready.registration.id
        || registration.value.deviceFingerprint !== after.deviceFingerprint
        || registration.value.windowsPrincipalHash !== verification.windowsPrincipalHash
      ) return ok({ kind: 'revalidation_failed' });
      if (registration.value.securityEpoch !== account.value.securityEpoch) {
        const revoked = revokeRegistration(scope, {
          registration: registration.value,
          reason: 'security_epoch_changed',
          auditId: input.revocationAuditId
        });
        return revoked.ok ? ok({ kind: 'security_epoch_changed' }) : revoked;
      }
      if (!activeAt(account.value, scope.occurredAt) || !unlockedAt(account.value, scope.occurredAt)) {
        return ok({ kind: 'revalidation_failed' });
      }
      const marked = scope.markWindowsHelloVerified({
        registrationId: registration.value.id,
        accountId,
        deviceId: after.deviceId,
        deviceFingerprint: after.deviceFingerprint,
        windowsPrincipalHash: verification.windowsPrincipalHash!,
        securityEpoch: account.value.securityEpoch,
        verifiedAt: scope.occurredAt
      });
      if (!marked.ok) return marked;
      if (!marked.value) return ok({ kind: 'revalidation_failed' });
      const cleared = scope.clearLoginFailures(accountId);
      if (!cleared.ok) return cleared;
      const audit = scope.appendAudit({
        id: input.auditId,
        action: 'windows_hello.session_started',
        resourceType: 'account',
        resourceId: accountId,
        occurredAt: scope.occurredAt,
        actorId: accountId
      });
      return audit.ok
        ? ok({
          kind: 'verified',
          accountId,
          securityEpoch: account.value.securityEpoch,
          registration: { ...registration.value, lastVerifiedAt: scope.occurredAt }
        })
        : audit;
    });
    if (!committed.ok) return committed;
    if (committed.value.kind === 'security_epoch_changed') {
      return ok(authenticationView('security_epoch_changed'));
    }
    if (committed.value.kind === 'revalidation_failed') {
      const audited = auditWindowsHelloOutcome(this.unitOfWork, input.context, {
        accountId,
        auditId: input.auditId,
        phase: 'login',
        outcome: 'post_prompt_revalidation_failed'
      });
      return audited.ok
        ? ok(authenticationView('error', { diagnosticCode: 'post_prompt_revalidation_failed' }))
        : audited;
    }
    this.session.start(committed.value.accountId, committed.value.securityEpoch);
    return ok(authenticationView('verified', {
      authenticated: true,
      method: 'windows_hello',
      registration: committed.value.registration
    }));
  }
}

export class ReauthenticateWithWindowsHelloUseCase {
  public constructor(
    private readonly unitOfWork: AuthApplicationUnitOfWork,
    private readonly platform: WindowsHelloPlatformPort,
    private readonly deviceBinding: WindowsHelloDeviceBindingPort,
    private readonly session: AuthSessionPort
  ) {}

  public async execute(input: {
    readonly context: WindowsHelloApplicationContext;
    readonly auditId: string;
    readonly revocationAuditId: string;
  }): Promise<Result<WindowsHelloAuthenticationView, AppError>> {
    const accountId = this.session.currentAccountId({ touch: false });
    if (!accountId) {
      return err(authError(
        input.context.correlationId,
        'Windows Hello ile yeniden doğrulama için oturum açılmalıdır.',
        ERROR_CODES.AUTHENTICATION_REQUIRED
      ));
    }
    let before: WindowsHelloDeviceBinding;
    try {
      before = this.deviceBinding.current();
    } catch {
      return ok(authenticationView('error', { diagnosticCode: 'device_binding_unavailable' }));
    }
    const preflight = this.unitOfWork.execute<ReadyRegistration | WindowsHelloAuthenticationOutcome>(
      input.context,
      accountId,
      (scope) => {
        const account = scope.findAccountById(accountId);
        if (!account.ok) return account;
        if (
          !account.value
          || !activeAt(account.value, scope.occurredAt)
          || !unlockedAt(account.value, scope.occurredAt)
          || !sessionMatches(this.session, account.value)
        ) {
          this.session.clear();
          return ok('account_unavailable');
        }
        const registration = scope.findActiveWindowsHelloRegistration(accountId, before.deviceId);
        if (!registration.ok) return registration;
        if (!registration.value) return ok('registration_not_found');
        const inspected = inspectRegistration(scope, {
          account: account.value,
          registration: registration.value,
          device: before,
          revocationAuditId: input.revocationAuditId
        });
        if (!inspected.ok) return inspected;
        return inspected.value
          ? ok(inspected.value)
          : ok({ account: account.value, registration: registration.value });
      }
    );
    if (!preflight.ok) return preflight;
    if (typeof preflight.value === 'string') return ok(authenticationView(preflight.value));
    const ready = preflight.value;
    const assessment = await safeAssessment(this.platform);
    if (assessment.availability !== 'available') {
      const audited = auditWindowsHelloOutcome(this.unitOfWork, input.context, {
        accountId,
        auditId: input.auditId,
        phase: 'reauthentication',
        outcome: `availability_${assessment.availability}`
      });
      return audited.ok ? ok(authenticationView(assessment.availability, {
        ...(assessment.diagnosticCode ? { diagnosticCode: assessment.diagnosticCode } : {})
      })) : audited;
    }
    if (assessment.windowsPrincipalHash !== ready.registration.windowsPrincipalHash) {
      const revoked = this.unitOfWork.execute(input.context, accountId, (scope) =>
        revokeRegistration(scope, {
          registration: ready.registration,
          reason: 'principal_changed',
          auditId: input.revocationAuditId
        })
      );
      return revoked.ok ? ok(authenticationView('principal_changed')) : revoked;
    }
    const verification = await safeVerification(this.platform);
    if (verification.outcome !== 'verified') {
      const audited = auditWindowsHelloOutcome(this.unitOfWork, input.context, {
        accountId,
        auditId: input.auditId,
        phase: 'reauthentication',
        outcome: `prompt_${verification.outcome}`
      });
      return audited.ok ? ok(authenticationView(verification.outcome, {
        ...(verification.diagnosticCode ? { diagnosticCode: verification.diagnosticCode } : {})
      })) : audited;
    }
    if (verification.windowsPrincipalHash !== assessment.windowsPrincipalHash) {
      const revoked = this.unitOfWork.execute(input.context, accountId, (scope) =>
        revokeRegistration(scope, {
          registration: ready.registration,
          reason: 'principal_changed',
          auditId: input.revocationAuditId
        })
      );
      return revoked.ok
        ? ok(authenticationView('principal_changed', { diagnosticCode: 'principal_changed_during_prompt' }))
        : revoked;
    }
    let after: WindowsHelloDeviceBinding;
    try {
      after = this.deviceBinding.current();
    } catch {
      return ok(authenticationView('device_changed', { diagnosticCode: 'device_binding_lost_after_prompt' }));
    }
    if (after.deviceId !== before.deviceId || after.deviceFingerprint !== before.deviceFingerprint) {
      const revoked = this.unitOfWork.execute(input.context, accountId, (scope) =>
        revokeRegistration(scope, {
          registration: ready.registration,
          reason: 'device_changed',
          auditId: input.revocationAuditId
        })
      );
      return revoked.ok
        ? ok(authenticationView('device_changed', { diagnosticCode: 'device_changed_during_prompt' }))
        : revoked;
    }
    const committed = this.unitOfWork.execute<WindowsHelloReauthenticationCommit>(
      input.context,
      accountId,
      (scope) => {
        const account = scope.findAccountById(accountId);
        if (!account.ok) return account;
        const registration = scope.findActiveWindowsHelloRegistration(accountId, after.deviceId);
        if (!registration.ok) return registration;
        if (
          !account.value
          || !registration.value
          || registration.value.id !== ready.registration.id
          || registration.value.deviceFingerprint !== after.deviceFingerprint
          || registration.value.windowsPrincipalHash !== verification.windowsPrincipalHash
        ) return ok({ kind: 'revalidation_failed' });
        if (registration.value.securityEpoch !== account.value.securityEpoch) {
          const revoked = revokeRegistration(scope, {
            registration: registration.value,
            reason: 'security_epoch_changed',
            auditId: input.revocationAuditId
          });
          return revoked.ok ? ok({ kind: 'security_epoch_changed' }) : revoked;
        }
        if (
          !activeAt(account.value, scope.occurredAt)
          || !unlockedAt(account.value, scope.occurredAt)
          || !sessionMatches(this.session, account.value)
        ) return ok({ kind: 'revalidation_failed' });
        const marked = scope.markWindowsHelloVerified({
          registrationId: registration.value.id,
          accountId,
          deviceId: after.deviceId,
          deviceFingerprint: after.deviceFingerprint,
          windowsPrincipalHash: verification.windowsPrincipalHash!,
          securityEpoch: account.value.securityEpoch,
          verifiedAt: scope.occurredAt
        });
        if (!marked.ok) return marked;
        if (!marked.value) return ok({ kind: 'revalidation_failed' });
        const audit = scope.appendAudit({
          id: input.auditId,
          action: 'windows_hello.reauthenticated',
          resourceType: 'account',
          resourceId: accountId,
          occurredAt: scope.occurredAt,
          actorId: accountId
        });
        return audit.ok
          ? ok({
            kind: 'verified',
            registration: { ...registration.value, lastVerifiedAt: scope.occurredAt }
          })
          : audit;
      }
    );
    if (!committed.ok) return committed;
    if (committed.value.kind === 'security_epoch_changed') {
      this.session.clear();
      return ok(authenticationView('security_epoch_changed'));
    }
    if (committed.value.kind === 'revalidation_failed') {
      this.session.clear();
      const audited = auditWindowsHelloOutcome(this.unitOfWork, input.context, {
        accountId,
        auditId: input.auditId,
        phase: 'reauthentication',
        outcome: 'post_prompt_revalidation_failed'
      });
      return audited.ok
        ? ok(authenticationView('error', { diagnosticCode: 'post_prompt_revalidation_failed' }))
        : audited;
    }
    return ok(authenticationView('verified', {
      authenticated: true,
      method: 'windows_hello',
      registration: committed.value.registration
    }));
  }
}

import {
  ERROR_CODES,
  asIsoDateTime,
  createAppError,
  err,
  ok,
  type AppError,
  type CorrelationId,
  type FamilyId,
  type IsoDateTime,
  type PersonId,
  type Result,
  type UserId
} from '@ppt/core';
import {
  LIVE_LOCATION_CONSENT_PURPOSE,
  LIVE_LOCATION_CONSENT_RESOURCE_ID,
  LIVE_LOCATION_CONSENT_RESOURCE_TYPE,
  LOST_DEVICE_SHUTDOWN_CONFIRMATION,
  type AiConsentView,
  type FamilyRole,
  type LostDeviceShutdownInput,
  type LostDeviceShutdownResultView,
  type OfflineCapabilityLeaseView,
  type PrivacyControlCenterView,
  type TrustedDeviceView,
  type UpsertLiveLocationConsentInput
} from '@ppt/domain';
import { revokeOfflineCapabilityLease, type OfflineCapabilityLease } from '@ppt/platform-policy';
import type { AuthSessionPort } from './auth-use-cases.js';
import type { StrongAuthenticationPort } from './data-lifecycle-use-cases.js';

export const PRIVACY_CONTROL_MINIMUM_CONSENT_MINUTES = 15 as const;
export const PRIVACY_CONTROL_MAXIMUM_CONSENT_MINUTES = 43_200 as const;

export interface PrivacyControlApplicationContext {
  readonly familyId:FamilyId;
  readonly actor:{readonly userId:UserId;readonly role:FamilyRole;readonly personId?:PersonId};
  readonly correlationId:CorrelationId;
}

export interface PrivacyControlAccountState {
  readonly accountId:UserId;
  readonly securityEpoch:number;
  readonly active:boolean;
}

export interface PrivacyControlSnapshot {
  readonly account:PrivacyControlAccountState;
  readonly trustedDevices:readonly TrustedDeviceView[];
  readonly offlineLeases:readonly OfflineCapabilityLeaseView[];
  readonly consents:readonly AiConsentView[];
  readonly occurredAt:IsoDateTime;
}

export interface PrivacyControlWriteScope extends PrivacyControlSnapshot {
  authorizeAdminister():Result<void,AppError>;
  findConsentIdentity(purpose:string,resourceType:string,resourceId:string):Result<string|null,AppError>;
  upsertConsent(row:AiConsentView):Result<void,AppError>;
  advanceSecurityEpoch():Result<number,AppError>;
  revokeAllTrustedDevices():Result<void,AppError>;
  revokeOfflineLease(lease:OfflineCapabilityLease):Result<boolean,AppError>;
  appendAudit(input:{
    readonly id:string;
    readonly action:string;
    readonly resourceType:string;
    readonly resourceId:string;
    readonly occurredAt:IsoDateTime;
    readonly actorId:UserId;
  }):Result<string,AppError>;
}

export interface PrivacyControlQueryPort {
  load(context:PrivacyControlApplicationContext):Result<PrivacyControlSnapshot,AppError>;
}

export interface PrivacyControlUnitOfWork {
  execute<T>(
    context:PrivacyControlApplicationContext,
    operation:(scope:PrivacyControlWriteScope)=>Result<T,AppError>
  ):Result<T,AppError>;
}

const invalid = (context:PrivacyControlApplicationContext,message:string):AppError => createAppError({
  code:ERROR_CODES.CORE_INVALID_ARGUMENT,
  message,
  category:'validation',
  correlationId:context.correlationId
});

const denied = (context:PrivacyControlApplicationContext,message:string):AppError => createAppError({
  code:ERROR_CODES.AUTHORIZATION_DENIED,
  message,
  category:'authorization',
  correlationId:context.correlationId
});

const missing = (context:PrivacyControlApplicationContext,message:string):AppError => createAppError({
  code:ERROR_CODES.RESOURCE_NOT_FOUND,
  message,
  category:'not_found',
  correlationId:context.correlationId
});

const conflict = (context:PrivacyControlApplicationContext,message:string):AppError => createAppError({
  code:ERROR_CODES.RESOURCE_CONFLICT,
  message,
  category:'conflict',
  correlationId:context.correlationId
});

const requireSession = (
  context:PrivacyControlApplicationContext,
  session:AuthSessionPort
):Result<{readonly accountId:UserId;readonly securityEpoch:number},AppError> => {
  const snapshot = session.snapshot();
  if (!snapshot.accountId || snapshot.accountId !== context.actor.userId || snapshot.securityEpoch === undefined) {
    return err(denied(context,'Gizlilik merkezi için geçerli yerel oturum gereklidir.'));
  }
  return ok({ accountId:context.actor.userId, securityEpoch:snapshot.securityEpoch });
};

const resolveLiveLocationConsent = (
  consents:readonly AiConsentView[],
  occurredAt:IsoDateTime
):PrivacyControlCenterView['liveLocationConsent'] => {
  const row = consents
    .filter((candidate) => candidate.purpose === LIVE_LOCATION_CONSENT_PURPOSE
      && candidate.resourceType === LIVE_LOCATION_CONSENT_RESOURCE_TYPE
      && candidate.resourceId === LIVE_LOCATION_CONSENT_RESOURCE_ID)
    .sort((left,right) => Date.parse(right.createdAt) - Date.parse(left.createdAt))[0];
  const base = {
    purpose:LIVE_LOCATION_CONSENT_PURPOSE,
    resourceType:LIVE_LOCATION_CONSENT_RESOURCE_TYPE,
    resourceId:LIVE_LOCATION_CONSENT_RESOURCE_ID,
    defaultDenied:true as const,
    evaluatedAt:occurredAt
  };
  if (!row) return { ...base, effectiveStatus:'default_denied', visibleActiveIndicator:false };
  const startsAt = Date.parse(row.startsAt);
  const endsAt = row.endsAt ? Date.parse(row.endsAt) : Number.NaN;
  if (row.status === 'revoked') return { ...base, effectiveStatus:'revoked', visibleActiveIndicator:false, startsAt:row.startsAt, ...(row.endsAt ? { endsAt:row.endsAt } : {}) };
  if (!row.endsAt || !Number.isFinite(endsAt) || startsAt > Date.parse(occurredAt) || endsAt <= Date.parse(occurredAt)) {
    return { ...base, effectiveStatus:row.endsAt ? 'expired' : 'default_denied', visibleActiveIndicator:false, startsAt:row.startsAt, ...(row.endsAt ? { endsAt:row.endsAt } : {}) };
  }
  return { ...base, effectiveStatus:'granted', visibleActiveIndicator:true, startsAt:row.startsAt, endsAt:row.endsAt };
};

const workspace = (snapshot:PrivacyControlSnapshot):PrivacyControlCenterView => ({
  liveLocationConsent:resolveLiveLocationConsent(snapshot.consents,snapshot.occurredAt),
  trustedDevices:snapshot.trustedDevices,
  offlineLeases:snapshot.offlineLeases,
  consentDuration:{ minimumMinutes:PRIVACY_CONTROL_MINIMUM_CONSENT_MINUTES, maximumMinutes:PRIVACY_CONTROL_MAXIMUM_CONSENT_MINUTES },
  truth:{
    scope:'local_authority_only',
    remoteWipeAvailable:false,
    mdmAvailable:false,
    networkDeliveryGuaranteed:false,
    locationTransmissionPerformed:false
  },
  generatedAt:snapshot.occurredAt
});

export class GetPrivacyControlCenterUseCase {
  public constructor(private readonly query:PrivacyControlQueryPort,private readonly session:AuthSessionPort) {}
  public execute(context:PrivacyControlApplicationContext):Result<PrivacyControlCenterView,AppError> {
    const authenticated = requireSession(context,this.session);
    if (!authenticated.ok) return authenticated;
    const loaded = this.query.load(context);
    if (!loaded.ok) return loaded;
    if (!loaded.value.account.active || loaded.value.account.securityEpoch !== authenticated.value.securityEpoch) {
      return err(denied(context,'Oturum güvenlik dönemi güncel değildir.'));
    }
    return ok(workspace(loaded.value));
  }
}

export class UpsertLiveLocationConsentUseCase {
  public constructor(private readonly unitOfWork:PrivacyControlUnitOfWork,private readonly session:AuthSessionPort) {}
  public execute(input:{
    readonly context:PrivacyControlApplicationContext;
    readonly command:UpsertLiveLocationConsentInput;
    readonly identifiers:{readonly consentId:string;readonly auditId:string};
  }):Result<void,AppError> {
    const authenticated = requireSession(input.context,this.session);
    if (!authenticated.ok) return authenticated;
    const duration = input.command.durationMinutes;
    if (input.command.status === 'granted'
      && (input.command.explicitConsent !== true || !Number.isInteger(duration)
        || Number(duration) < PRIVACY_CONTROL_MINIMUM_CONSENT_MINUTES
        || Number(duration) > PRIVACY_CONTROL_MAXIMUM_CONSENT_MINUTES)) {
      return err(invalid(input.context,'Canlı konum paylaşımı açık rıza ve 15 dakika–30 gün arasında süre gerektirir.'));
    }
    if (input.command.status === 'revoked' && input.command.explicitConsent !== true) {
      return err(invalid(input.context,'Rıza iptali açık kullanıcı işlemi gerektirir.'));
    }
    return this.unitOfWork.execute(input.context,(scope) => {
      const authorized = scope.authorizeAdminister();
      if (!authorized.ok) return authorized;
      if (!scope.account.active || scope.account.accountId !== authenticated.value.accountId
        || scope.account.securityEpoch !== authenticated.value.securityEpoch) {
        return err(denied(input.context,'Oturum güvenlik dönemi işlem sırasında değişti.'));
      }
      const identity = scope.findConsentIdentity(
        LIVE_LOCATION_CONSENT_PURPOSE,
        LIVE_LOCATION_CONSENT_RESOURCE_TYPE,
        LIVE_LOCATION_CONSENT_RESOURCE_ID
      );
      if (!identity.ok) return identity;
      const endsAt = input.command.status === 'granted'
        ? asIsoDateTime(new Date(Date.parse(scope.occurredAt) + Number(duration) * 60_000).toISOString())
        : scope.occurredAt;
      const stored = scope.upsertConsent({
        id:identity.value ?? input.identifiers.consentId,
        accountId:authenticated.value.accountId,
        purpose:LIVE_LOCATION_CONSENT_PURPOSE,
        resourceType:LIVE_LOCATION_CONSENT_RESOURCE_TYPE,
        resourceId:LIVE_LOCATION_CONSENT_RESOURCE_ID,
        status:input.command.status,
        startsAt:scope.occurredAt,
        endsAt,
        createdAt:scope.occurredAt
      });
      if (!stored.ok) return stored;
      const audit = scope.appendAudit({
        id:input.identifiers.auditId,
        action:`privacy.live_location_consent_${input.command.status}`,
        resourceType:LIVE_LOCATION_CONSENT_RESOURCE_TYPE,
        resourceId:LIVE_LOCATION_CONSENT_RESOURCE_ID,
        occurredAt:scope.occurredAt,
        actorId:authenticated.value.accountId
      });
      return audit.ok ? ok(undefined) : audit;
    });
  }
}

export class ShutdownLostDeviceAuthorityUseCase {
  public constructor(
    private readonly unitOfWork:PrivacyControlUnitOfWork,
    private readonly session:AuthSessionPort,
    private readonly strongAuthentication:StrongAuthenticationPort
  ) {}

  public execute(input:{
    readonly context:PrivacyControlApplicationContext;
    readonly command:LostDeviceShutdownInput;
    readonly auditId:string;
  }):Result<LostDeviceShutdownResultView,AppError> {
    if (!input.command.trustedDeviceId.trim() || input.command.confirmation !== LOST_DEVICE_SHUTDOWN_CONFIRMATION) {
      return err(invalid(input.context,'Kayıp cihaz kapatma için hedef cihaz ve tam onay ifadesi gereklidir.'));
    }
    const authenticated = requireSession(input.context,this.session);
    if (!authenticated.ok) return authenticated;
    const strong = this.strongAuthentication.verify(input.context,{
      password:input.command.password,
      ...(input.command.code ? { code:input.command.code } : {})
    });
    if (!strong.ok) return strong;
    const closed = this.unitOfWork.execute<LostDeviceShutdownResultView>(input.context,(scope) => {
      const authorized = scope.authorizeAdminister();
      if (!authorized.ok) return authorized;
      if (!scope.account.active || scope.account.accountId !== authenticated.value.accountId
        || scope.account.securityEpoch !== authenticated.value.securityEpoch) {
        return err(denied(input.context,'Oturum güvenlik dönemi kapatma işlemi sırasında değişti.'));
      }
      const target = scope.trustedDevices.find((device) => device.id === input.command.trustedDeviceId);
      if (!target || target.revokedAt) return err(missing(input.context,'Etkin ve bu hesaba ait hedef cihaz bulunamadı.'));
      const activeDevices = scope.trustedDevices.filter((device) => !device.revokedAt);
      const activeLeases = scope.offlineLeases.filter((lease) => lease.subjectAccountId === authenticated.value.accountId
        && !lease.revokedAt && Date.parse(lease.expiresAt) > Date.parse(scope.occurredAt));
      const grantedConsents = scope.consents.filter((consent) => consent.status === 'granted');
      const advanced = scope.advanceSecurityEpoch();
      if (!advanced.ok) return advanced;
      if (advanced.value !== scope.account.securityEpoch + 1) {
        return err(conflict(input.context,'Güvenlik dönemi atomik olarak ilerletilemedi.'));
      }
      const devices = scope.revokeAllTrustedDevices();
      if (!devices.ok) return devices;
      let revokedLeaseCount = 0;
      for (const lease of activeLeases) {
        const revokedLease = revokeOfflineCapabilityLease(lease,scope.occurredAt);
        const revoked = scope.revokeOfflineLease(revokedLease);
        if (!revoked.ok) return revoked;
        if (revoked.value) revokedLeaseCount += 1;
      }
      let revokedConsentCount = 0;
      for (const consent of grantedConsents) {
        const revoked = scope.upsertConsent({ ...consent, status:'revoked', startsAt:scope.occurredAt, endsAt:scope.occurredAt });
        if (!revoked.ok) return revoked;
        revokedConsentCount += 1;
      }
      const audit = scope.appendAudit({
        id:input.auditId,
        action:'privacy.lost_device_local_authority_closed',
        resourceType:'account_security_epoch',
        resourceId:authenticated.value.accountId,
        occurredAt:scope.occurredAt,
        actorId:authenticated.value.accountId
      });
      if (!audit.ok) return audit;
      return ok({
        completedAt:scope.occurredAt,
        targetTrustedDeviceId:target.id,
        previousSecurityEpoch:scope.account.securityEpoch,
        securityEpoch:advanced.value,
        revokedTrustedDeviceCount:activeDevices.length,
        revokedOfflineLeaseCount:revokedLeaseCount,
        revokedConsentCount,
        currentSessionCleared:true,
        scope:'local_authority_only',
        remoteWipePerformed:false,
        mdmOperationPerformed:false,
        networkDelivery:'not_performed'
      });
    });
    if (closed.ok) this.session.clear();
    return closed;
  }
}

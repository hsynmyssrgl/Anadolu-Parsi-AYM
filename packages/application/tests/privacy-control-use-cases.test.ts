import { describe,expect,it } from 'vitest';
import { ERROR_CODES,asCorrelationId,asFamilyId,asIsoDateTime,asUserId,createAppError,err,ok,type AppError,type Result } from '@ppt/core';
import { LOST_DEVICE_SHUTDOWN_CONFIRMATION,type AiConsentView } from '@ppt/domain';
import { createOfflineCapabilityLease } from '@ppt/platform-policy';
import {
  GetPrivacyControlCenterUseCase,
  ShutdownLostDeviceAuthorityUseCase,
  UpsertLiveLocationConsentUseCase,
  type PrivacyControlApplicationContext,
  type PrivacyControlUnitOfWork,
  type PrivacyControlWriteScope
} from '../src/privacy-control-use-cases.js';
import type { AuthSessionPort,AuthSessionSnapshot } from '../src/auth-use-cases.js';

const NOW=asIsoDateTime('2026-08-13T10:00:00.000Z');
const context:PrivacyControlApplicationContext={familyId:asFamilyId('family-main'),actor:{userId:asUserId('admin-1'),role:'family_admin'},correlationId:asCorrelationId('privacy-control-test')};
class Session implements AuthSessionPort {
  public cleared=false;
  public start():void{}
  public clear():void{this.cleared=true;}
  public currentAccountId(){return asUserId('admin-1');}
  public snapshot():AuthSessionSnapshot{return {state:'active',accountId:asUserId('admin-1'),idleTimeoutMinutes:15,warningBeforeSeconds:60,secondsRemaining:600,securityEpoch:4};}
  public recordActivity(){return this.snapshot();}
  public lock(){return this.snapshot();}
}
class Unit implements PrivacyControlUnitOfWork {
  public consents:AiConsentView[]=[];
  public epoch=4;
  public devicesRevoked=false;
  public leasesRevoked=0;
  public failLeaseRevocation=false;
  public execute<T>(_context:PrivacyControlApplicationContext,operation:(scope:PrivacyControlWriteScope)=>Result<T,AppError>):Result<T,AppError>{
    return operation({
      account:{accountId:asUserId('admin-1'),securityEpoch:this.epoch,active:true},
      trustedDevices:[{id:'device-1',deviceId:'machine-1',displayName:'Laptop',fingerprint:'f'.repeat(64),trustedAt:NOW,lastSeenAt:NOW,securityEpoch:4,current:false}],
      offlineLeases:[{...createOfflineCapabilityLease({leaseId:'lease-1',familyId:'family-main',subjectAccountId:'admin-1',deviceId:'machine-1',capability:'location.read',issuedAt:NOW,notBefore:NOW,expiresAt:'2026-08-14T10:00:00.000Z',policyVersion:'v1',policyPackageVersion:1,policyPackageSha256:'a'.repeat(64),capabilityManifestSha256:'b'.repeat(64),nonce:'nonce-1'}),state:'active',remainingSeconds:86400}],
      consents:this.consents,
      occurredAt:NOW,
      authorizeAdminister:()=>ok(undefined),
      findConsentIdentity:()=>ok(this.consents[0]?.id??null),
      upsertConsent:(row)=>{this.consents=[row];return ok(undefined);},
      advanceSecurityEpoch:()=>{this.epoch+=1;return ok(this.epoch);},
      revokeAllTrustedDevices:()=>{this.devicesRevoked=true;return ok(undefined);},
      revokeOfflineLease:()=>this.failLeaseRevocation
        ? err(createAppError({code:ERROR_CODES.RESOURCE_CONFLICT,message:'Lease bütünlüğü doğrulanamadı.',category:'conflict',correlationId:context.correlationId}))
        : (this.leasesRevoked+=1,ok(true)),
      appendAudit:()=>ok('audit-hash')
    });
  }
}

const authenticationFailure = () => createAppError({
  code:ERROR_CODES.AUTH_INVALID_CREDENTIALS,
  message:'Güçlü doğrulama başarısız.',
  category:'authentication',
  correlationId:context.correlationId
});

describe('33-K privacy consent and lost-device authority',()=>{
  it('is default deny and requires explicit bounded consent',()=>{
    const session=new Session();
    const query={load:()=>ok({account:{accountId:asUserId('admin-1'),securityEpoch:4,active:true},trustedDevices:[],offlineLeases:[],consents:[],occurredAt:NOW})};
    const center=new GetPrivacyControlCenterUseCase(query,session).execute(context);
    expect(center.ok&&center.value.liveLocationConsent).toMatchObject({effectiveStatus:'default_denied',visibleActiveIndicator:false,defaultDenied:true});
    const unit=new Unit(); const useCase=new UpsertLiveLocationConsentUseCase(unit,session);
    expect(useCase.execute({context,command:{status:'granted',durationMinutes:14,explicitConsent:true},identifiers:{consentId:'c1',auditId:'a1'}}).ok).toBe(false);
    expect(useCase.execute({context,command:{status:'granted',durationMinutes:60,explicitConsent:false},identifiers:{consentId:'c1',auditId:'a1'}}).ok).toBe(false);
    expect(useCase.execute({context,command:{status:'granted',durationMinutes:60,explicitConsent:true},identifiers:{consentId:'c1',auditId:'a1'}}).ok).toBe(true);
    expect(unit.consents[0]).toMatchObject({purpose:'live_location_sharing',status:'granted',endsAt:'2026-08-13T11:00:00.000Z'});
  });

  it('closes account authority in one UoW and truthfully reports no remote operation',()=>{
    const session=new Session();const unit=new Unit();
    unit.consents=[{id:'c1',accountId:'admin-1',purpose:'live_location_sharing',resourceType:'privacy_control',resourceId:'family_live_location',status:'granted',startsAt:NOW,endsAt:'2026-08-14T10:00:00.000Z',createdAt:NOW}];
    const strong={verify:()=>ok(undefined)};
    const result=new ShutdownLostDeviceAuthorityUseCase(unit,session,strong).execute({context,command:{trustedDeviceId:'device-1',password:'strong-password',confirmation:LOST_DEVICE_SHUTDOWN_CONFIRMATION},auditId:'audit-1'});
    expect(result.ok&&result.value).toMatchObject({securityEpoch:5,revokedTrustedDeviceCount:1,revokedOfflineLeaseCount:1,revokedConsentCount:1,currentSessionCleared:true,scope:'local_authority_only',remoteWipePerformed:false,mdmOperationPerformed:false,networkDelivery:'not_performed'});
    expect(session.cleared).toBe(true);expect(unit.devicesRevoked).toBe(true);expect(unit.consents[0]?.status).toBe('revoked');
  });

  it('fails closed for wrong confirmation, strong-auth failure, stale epoch and foreign device',()=>{
    const wrongSession=new Session();const wrongUnit=new Unit();let strongCalls=0;
    const strong={verify:()=>{strongCalls+=1;return ok(undefined);}};
    const wrong=new ShutdownLostDeviceAuthorityUseCase(wrongUnit,wrongSession,strong).execute({
      context,command:{trustedDeviceId:'device-1',password:'strong-password',confirmation:'YANLIŞ' as typeof LOST_DEVICE_SHUTDOWN_CONFIRMATION},auditId:'audit-wrong'
    });
    expect(wrong.ok).toBe(false);expect(strongCalls).toBe(0);expect(wrongSession.cleared).toBe(false);expect(wrongUnit.epoch).toBe(4);

    const rejectedSession=new Session();const rejectedUnit=new Unit();
    const rejected=new ShutdownLostDeviceAuthorityUseCase(rejectedUnit,rejectedSession,{verify:()=>err(authenticationFailure())}).execute({
      context,command:{trustedDeviceId:'device-1',password:'wrong-password',confirmation:LOST_DEVICE_SHUTDOWN_CONFIRMATION},auditId:'audit-rejected'
    });
    expect(rejected.ok).toBe(false);expect(rejectedSession.cleared).toBe(false);expect(rejectedUnit.epoch).toBe(4);

    const staleSession=new Session();const staleUnit=new Unit();staleUnit.epoch=5;
    const stale=new ShutdownLostDeviceAuthorityUseCase(staleUnit,staleSession,strong).execute({
      context,command:{trustedDeviceId:'device-1',password:'strong-password',confirmation:LOST_DEVICE_SHUTDOWN_CONFIRMATION},auditId:'audit-stale'
    });
    expect(stale.ok).toBe(false);expect(staleSession.cleared).toBe(false);expect(staleUnit.epoch).toBe(5);

    const foreignSession=new Session();const foreignUnit=new Unit();
    const foreign=new ShutdownLostDeviceAuthorityUseCase(foreignUnit,foreignSession,strong).execute({
      context,command:{trustedDeviceId:'foreign-device',password:'strong-password',confirmation:LOST_DEVICE_SHUTDOWN_CONFIRMATION},auditId:'audit-foreign'
    });
    expect(foreign.ok).toBe(false);expect(foreignSession.cleared).toBe(false);expect(foreignUnit.epoch).toBe(4);
  });

  it('does not clear the session when an in-transaction revocation fails',()=>{
    const session=new Session();const unit=new Unit();
    unit.consents=[{id:'c1',accountId:'admin-1',purpose:'live_location_sharing',resourceType:'privacy_control',resourceId:'family_live_location',status:'granted',startsAt:NOW,endsAt:'2026-08-14T10:00:00.000Z',createdAt:NOW}];
    unit.failLeaseRevocation=true;
    const result=new ShutdownLostDeviceAuthorityUseCase(unit,session,{verify:()=>ok(undefined)}).execute({
      context,command:{trustedDeviceId:'device-1',password:'strong-password',confirmation:LOST_DEVICE_SHUTDOWN_CONFIRMATION},auditId:'audit-rollback'
    });
    expect(result.ok).toBe(false);expect(session.cleared).toBe(false);
  });
});

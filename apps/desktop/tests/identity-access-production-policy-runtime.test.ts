import { describe,expect,it } from 'vitest';
import { asCorrelationId,asFamilyId,asIsoDateTime,asPersonId,asUserId,ok } from '@ppt/core';
import { PlatformPolicyKernel,type PlatformPolicyAuthorizationProvider } from '@ppt/platform-policy';
import { SqliteIdentityAccessCredentialRepository } from '@ppt/repositories';
import type { TimelinePolicyIntent } from '@ppt/application';
import type { TimelineProductionPolicyRuntimeDependencies } from '../src/main/timeline-production-policy-runtime.js';
import { createTimelineProductionPolicyEnforcementPointResolver } from '../src/main/timeline-production-policy-runtime.js';
import { createSqliteRepositoryCompositionRoot } from '../src/main/repository-composition-root.js';

const NOW=asIsoDateTime('2026-08-14T08:00:00.000Z');const FAMILY=asFamilyId('family-33-p');const PERSON=asPersonId('person-33-p');const ACCOUNT=asUserId('account-33-p');
const CORRELATION=asCorrelationId('identity-production-runtime');const DEVICE='device-33-p';const FINGERPRINT='fingerprint-33-p';const PUBLIC_KEY='-----BEGIN PUBLIC KEY-----\n33-p\n-----END PUBLIC KEY-----';

const kernel=new PlatformPolicyKernel({policyVersion:'33-p-production-runtime-v1',signingKey:Buffer.from('33-p-production-runtime-signing-key'),applicationCapabilities:{'windows-desktop':['family.read','family.write']},consentRequiredCapabilities:[],onlineOnlyCapabilities:[],writeActions:['create','update','delete','record']});
const provider:PlatformPolicyAuthorizationProvider=Object.freeze({resolvePolicyPackage:()=>kernel.policyPackage,authorize:({request,nonce})=>Object.freeze({effectiveRequest:request,authorization:kernel.authorizeWithReceipt(request,request.occurredAt,nonce)}),verify:({request,receipt})=>kernel.verifyReceiptForRequest(receipt,request)});
const context={familyId:FAMILY,actor:{userId:ACCOUNT,roles:['family_admin'],personId:PERSON},correlationId:CORRELATION};
const intent=(overrides:Partial<TimelinePolicyIntent>={}):TimelinePolicyIntent=>({action:'read',capability:'family.read',resourceType:'identity_access_center',resourceId:ACCOUNT,purpose:'administration',ownerPersonId:PERSON,targetSensitivity:'highly_sensitive',...overrides});

const dependencies=(resource:{familyId:string;ownerPersonId:string;sensitivity:string}|null={familyId:FAMILY,ownerPersonId:PERSON,sensitivity:'highly_sensitive'},tamper:{accountId?:string;deviceId?:string;accountSecurityEpoch?:number;deviceSecurityEpoch?:number}={})=>{
  const resolutions:Array<{resourceType:string;resourceId:string;accountId:string;ownerPersonId:string}>=[];
  const policyTransactionRepository={
    readJournalAnchor:()=>ok(null),listPendingJournalProjections:()=>ok([]),acknowledgeJournalProjection:()=>ok(undefined),findReceiptByNonce:()=>ok(null),
    synchronizeFence:(_context:unknown,input:unknown)=>ok(input),pruneExpiredUnusedReplayReservations:()=>ok(0),reserveReplayNonce:()=>ok(true),recordAuthorizedTransaction:()=>ok(undefined)
  };
  const value={
    transactionExecutor:{execute:(_correlation:unknown,operation:(transaction:unknown)=>unknown)=>operation({transaction:{},occurredAt:NOW})},
    accountRepository:{findById:()=>ok({id:tamper.accountId??ACCOUNT,displayName:'Owner',email:'owner@example.com',passwordRecord:'protected',role:'family_admin',status:'active',personId:PERSON,startsAt:asIsoDateTime('2026-08-14T00:00:00.000Z'),failedLoginCount:0,securityEpoch:tamper.accountSecurityEpoch??7,createdAt:NOW})},
    personRepository:{findById:()=>ok({id:PERSON,familyId:FAMILY,displayName:'Owner',relationshipType:'self',generation:0,branch:'main',status:'active',createdAt:NOW})},
    permissionRepository:{listActiveForSubject:()=>ok([])},
    trustedDeviceRepository:{findActive:()=>ok({id:'trusted-33-p',accountId:ACCOUNT,deviceId:tamper.deviceId??DEVICE,displayName:'Device',fingerprint:FINGERPRINT,publicKeyPem:PUBLIC_KEY,trustedAt:asIsoDateTime('2026-08-14T07:00:00.000Z'),lastSeenAt:NOW,securityEpoch:tamper.deviceSecurityEpoch??7})},
    timelinePolicyResourceRepository:{findTimelineEventForPolicyResolution:()=>ok(null)},accessibilityPreferencesRepository:{findForPolicyResolution:()=>ok(null)},formDraftRepository:{findForPolicyResolution:()=>ok(null)},privacyOwnershipDataRightsRepository:{resolvePolicyResource:()=>ok(null)},
    identityAccessCredentialRepository:{resolvePolicyResource:(_execution:unknown,key:{accountId:string;ownerPersonId:string},resourceType:string,resourceId:string)=>{resolutions.push({resourceType,resourceId,accountId:key.accountId,ownerPersonId:key.ownerPersonId});const current=resourceType==='identity_challenge'||resourceType==='companion_sync_snapshot'?null:resource;return ok(current?{...current,revision:0,stateFingerprint:'a'.repeat(64),sensitivity:current.sensitivity}:null);}},
    deviceIdentityProvider:{snapshot:()=>({deviceId:DEVICE,fingerprint:FINGERPRINT,publicKeyPem:PUBLIC_KEY})},authorizationProvider:provider,
    receiptSink:{append:()=>undefined,ensure:()=>{throw new Error('not projected in preauthorization test');},verifyProjectionProof:()=>true},policyTransactionRepository,
    clusterFence:()=>({writable:true,epoch:93}),policyVersion:'33-p-production-runtime-v1',clock:{now:()=>NOW}
  };
  return {value:value as unknown as TimelineProductionPolicyRuntimeDependencies,resolutions};
};

const authorize=async(deps:TimelineProductionPolicyRuntimeDependencies,requested:TimelinePolicyIntent)=>{
  const pep=await createTimelineProductionPolicyEnforcementPointResolver(deps).resolve(context,requested);
  return pep.execute({correlationId:CORRELATION,action:requested.action,capability:requested.capability,resourceType:requested.resourceType,resourceId:requested.resourceId,purpose:requested.purpose},()=>({writable:true,epoch:93}),authorization=>authorization);
};

describe('33-P identity access production policy composition',()=>{
  it('composes the SQLite identity repository in the shared repository root',()=>{
    expect(createSqliteRepositoryCompositionRoot().identityAccessCredentialRepository).toBeInstanceOf(SqliteIdentityAccessCredentialRepository);
  });

  it('preauthorizes every exact 33-P resource through the typed central PEP resolver',async()=>{
    const fixture=dependencies();const resources=[
      ['identity_access_center',ACCOUNT,'read','family.read'],['identity_challenge','challenge-1','create','family.write'],
      ['passkey_credential','passkey-1','update','family.write'],['federated_identity_link','link-1','delete','family.write'],
      ['temporary_verifiable_credential','temporary-1','read','family.read'],['companion_sync_snapshot','snapshot-1','create','family.write']
    ] as const;
    for(const [resourceType,resourceId,action,capability] of resources){
      const authorization=await authorize(fixture.value,intent({resourceType,resourceId,action,capability,...(action==='create'?{sourceResourceMode:'replace' as const}:action==='update'?{sourceResourceMode:'preserve' as const}:{})}));
      expect(authorization).toMatchObject({resourceType,resourceId,resourceFamilyId:FAMILY,resourceOwnerPersonId:PERSON,purpose:'administration'});
      expect(authorization.receiptRecord.request.resource.sensitivity).toBe('highly_sensitive');
    }
    expect(fixture.resolutions).toEqual(resources.map(([resourceType,resourceId])=>({resourceType,resourceId,accountId:ACCOUNT,ownerPersonId:PERSON})));
  });

  it('fails closed for wrong purpose, sensitivity and repository ownership',async()=>{
    const exact=dependencies();
    await expect(authorize(exact.value,intent({purpose:'general'}))).rejects.toThrow(/resource context|resource snapshot|supported exact operation/u);
    await expect(authorize(exact.value,intent({action:'create',capability:'family.write',resourceType:'passkey_credential',resourceId:'passkey-2',sourceResourceMode:'replace',targetSensitivity:'personal'}))).rejects.toThrow(/resource context|resource snapshot|supported exact operation/u);
    const foreign=dependencies({familyId:FAMILY,ownerPersonId:'foreign-person',sensitivity:'highly_sensitive'});
    await expect(authorize(foreign.value,intent({resourceType:'passkey_credential',resourceId:'passkey-1'}))).rejects.toThrow(/resource context|resource snapshot/u);
    const foreignFamily=dependencies({familyId:'foreign-family',ownerPersonId:PERSON,sensitivity:'highly_sensitive'});
    await expect(authorize(foreignFamily.value,intent({resourceType:'passkey_credential',resourceId:'passkey-1'}))).rejects.toThrow(/resource context|resource snapshot/u);
    await expect(authorize(dependencies(undefined,{accountId:'foreign-account'}).value,intent())).rejects.toThrow(/authority|account|subject|resource context|resource snapshot/u);
    await expect(authorize(dependencies(undefined,{deviceId:'foreign-device'}).value,intent())).rejects.toThrow(/authority|device|resource context|resource snapshot/u);
    await expect(authorize(dependencies(undefined,{deviceSecurityEpoch:8}).value,intent())).rejects.toThrow(/authority|epoch|resource context|resource snapshot/u);
  });

  it('requires replace for create and preserve for update',async()=>{
    const fixture=dependencies();
    await expect(authorize(fixture.value,intent({action:'create',capability:'family.write',resourceType:'identity_challenge',resourceId:'challenge-2'}))).rejects.toThrow(/source|resource context|resource snapshot|supported exact operation/u);
    await expect(authorize(fixture.value,intent({action:'update',capability:'family.write',resourceType:'passkey_credential',resourceId:'passkey-1',sourceResourceMode:'replace'}))).rejects.toThrow(/source|resource context|resource snapshot|supported exact operation/u);
  });
});

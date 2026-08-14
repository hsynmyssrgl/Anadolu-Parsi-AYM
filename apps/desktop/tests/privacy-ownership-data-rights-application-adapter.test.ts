import { describe, expect, it } from 'vitest';
import {
  asCorrelationId,
  asFamilyId,
  asIsoDateTime,
  asPersonId,
  asUserId,
  ok,
  type AppError,
  type Result
} from '@ppt/core';
import type {
  PrivacyOwnershipApplicationContext,
  PrivacyOwnershipPolicyIntent
} from '@ppt/application';
import type {
  ObjectPermissionRow,
  PolicyAuthorizedRepositoryExecutionContext,
  PrivacyOwnershipDataRightsRepositoryPort
} from '@ppt/repository-contracts';
import {
  CentralAuthorizationService,
  type AuthorizationRole
} from '@ppt/security';
import {
  RepositoryBackedPrivacyOwnershipDataRightsUnitOfWork,
  type RepositoryBackedPrivacyOwnershipDependencies
} from '../src/main/privacy-ownership-data-rights-application-adapter.js';

const NOW=asIsoDateTime('2026-08-14T02:30:00.000Z');
const FAMILY=asFamilyId('family-adapter');
const ACCOUNT=asUserId('account-adapter');
const PERSON=asPersonId('person-adapter');
const SUBJECT_ACCOUNT=asUserId('account-simulation-subject');
const SUBJECT_PERSON=asPersonId('person-simulation-subject');
const BINDING='b'.repeat(64);
const INTEGRITY='c'.repeat(64);
const context:PrivacyOwnershipApplicationContext={familyId:FAMILY,actor:{userId:ACCOUNT,role:'owner',personId:PERSON},correlationId:asCorrelationId('privacy-adapter-test')};
const key={familyId:FAMILY,accountId:ACCOUNT,ownerPersonId:PERSON};

interface Counters {epoch:number;devices:number;leases:number;consents:number;permissions:number;revocations:number;quarantines:number;audits:number;outbox:number;permissionReads:number;}

interface FixtureOptions {
  readonly propagationBinding?:string;
  readonly simulatedAccountId?:ReturnType<typeof asUserId>;
  readonly simulatedPersonId?:ReturnType<typeof asPersonId>;
  readonly simulatedRole?:AuthorizationRole;
  readonly simulatedFamily?:ReturnType<typeof asFamilyId>;
  readonly grants?:readonly ObjectPermissionRow[];
}

const permission=(overrides:Partial<ObjectPermissionRow>={}):ObjectPermissionRow=>({
  id:'permission-1',subjectAccountId:SUBJECT_ACCOUNT,resourceType:'privacy_inventory',resourceId:'record-1',
  actions:['read'],effect:'allow',purpose:'general',startsAt:NOW,createdAt:NOW,...overrides
});

const fixture=(options:FixtureOptions={})=>{
  const counters:Counters={epoch:0,devices:0,leases:0,consents:0,permissions:0,revocations:0,quarantines:0,audits:0,outbox:0,permissionReads:0};
  let securityEpoch=7;
  const simulatedAccountId=options.simulatedAccountId??ACCOUNT;
  const simulatedPersonId=options.simulatedPersonId??PERSON;
  const simulatedRole=options.simulatedRole??'family_admin';
  const grants=options.grants??[permission({subjectAccountId:simulatedAccountId})];
  const repositoryContext={
    transaction:{} as never,actor:{userId:ACCOUNT,roles:['owner'],personId:PERSON},correlationId:context.correlationId,occurredAt:NOW,
    policyAuthorization:{subject:{accountId:ACCOUNT,personId:PERSON,deviceId:'device-current'},resourceFamilyId:FAMILY}
  } as unknown as PolicyAuthorizedRepositoryExecutionContext;
  const privacyRepository={
    loadCenter:()=>ok({key,aiMemoryRecords:[],dataInventory:[],accessHistory:[],localDeviceActivity:[
      {id:'trusted-1',key,deviceId:'device-current',displayName:'Current',currentDevice:false,trustStatus:'trusted',locallyObservedSession:'recently_seen',lastSeenAt:NOW,securityEpoch:7,appleSyncStatus:'not_configured',observationSource:'local_runtime'},
      {id:'trusted-2',key,deviceId:'device-revoked',displayName:'Revoked',currentDevice:true,trustStatus:'revoked',locallyObservedSession:'current_session',lastSeenAt:NOW,securityEpoch:6,appleSyncStatus:'not_configured',observationSource:'local_runtime'}
    ],localProcessingObservations:[],derivedDataLineage:[],rightsRequests:[],encryptedExports:[],incidents:[],generatedAt:NOW}),
    insertIncident:()=>ok(undefined),
    recordIncidentRevocation:()=>{counters.revocations+=1;return ok(undefined);},
    inspectLocalDerivedArtifactForIncident:(_c:unknown,_k:unknown,bindingHash:string)=>ok(bindingHash===BINDING?{integritySha256:INTEGRITY}:null),
    quarantineIncidentItem:()=>{counters.quarantines+=1;return ok(undefined);}
  } as unknown as PrivacyOwnershipDataRightsRepositoryPort;
  const dependencies={
    policyTransactionRunner:{execute:<T>(_context:unknown,_intent:unknown,operation:(scope:unknown)=>Result<T,AppError>)=>{
      const before={...counters};const beforeEpoch=securityEpoch;
      const result=operation({repository:repositoryContext,occurredAt:NOW,authorization:repositoryContext.policyAuthorization});
      if(!result.ok){Object.assign(counters,before);securityEpoch=beforeEpoch;}
      return Promise.resolve(result);
    }},
    privacyRepository,
    accountRepository:{
      advanceSecurityEpoch:()=>{counters.epoch+=1;securityEpoch+=1;return ok(securityEpoch);},
      findById:(_c:unknown,accountId:ReturnType<typeof asUserId>)=>ok(accountId===simulatedAccountId
        ?{id:simulatedAccountId,securityEpoch,status:'active',personId:simulatedPersonId,role:simulatedRole} as never:null)
    },
    personRepository:{findById:(_c:unknown,personId:ReturnType<typeof asPersonId>)=>ok(personId===simulatedPersonId
      ?{id:simulatedPersonId,familyId:options.simulatedFamily??FAMILY,status:'active'} as never:null)},
    trustedDeviceRepository:{
      listByAccount:()=>ok([{id:'device-row',accountId:ACCOUNT,deviceId:'device-current',revokedAt:undefined}] as never),
      revokeAll:()=>{counters.devices+=1;return ok(undefined);},revoke:()=>ok(undefined)
    },
    offlineCapabilityLeaseRepository:{
      listForFamily:()=>ok([{leaseId:'lease-1',familyId:FAMILY,subjectAccountId:ACCOUNT}] as never),
      findById:()=>ok(undefined),revoke:()=>{counters.leases+=1;return ok(true);}
    },
    aiConsentRepository:{
      list:()=>ok([{id:'consent-1',accountId:ACCOUNT,status:'granted',startsAt:NOW,createdAt:NOW}] as never),
      upsert:()=>{counters.consents+=1;return ok(undefined);}
    },
    objectPermissionRepository:{
      listActiveForSubject:(_c:unknown,subject:string)=>{counters.permissionReads+=1;return ok(subject===simulatedAccountId?grants:[]);},
      delete:()=>{counters.permissions+=1;return ok(true);}
    },
    auditRepository:{append:()=>{counters.audits+=1;return ok('audit-hash');}},
    outboxRepository:{enqueue:()=>{counters.outbox+=1;return ok(undefined);}},
    aiMemoryDeletionPropagation:{propagate:()=>ok({locallyCompleted:true as const,resourceGrantCleanupComplete:true as const,
      processingDisabled:true as const,sourcePreserved:true as const,derivedBindingHash:options.propagationBinding??BINDING})}
  } as unknown as RepositoryBackedPrivacyOwnershipDependencies;
  return {unit:new RepositoryBackedPrivacyOwnershipDataRightsUnitOfWork(dependencies),counters,
    simulatedAccountId,simulatedPersonId,simulatedRole,grants};
};

const intent=(overrides:Partial<PrivacyOwnershipPolicyIntent>={}):PrivacyOwnershipPolicyIntent=>({
  action:'read',capability:'family.read',resourceType:'privacy_ownership_center',resourceId:ACCOUNT,purpose:'administration',
  familyId:FAMILY,ownerPersonId:PERSON,privacy:'private',sensitivity:'highly_sensitive',...overrides
});

describe('33-O privacy ownership desktop adapter',()=>{
  it('uses the governed current device id and never marks a revoked device current',async()=>{
    const {unit}=fixture();
    const result=await unit.execute(context,intent(),scope=>scope.loadCenter(key));
    expect(result.ok).toBe(true);
    if(!result.ok)return;
    expect(result.value.localDeviceActivity.map(item=>[item.deviceId,item.currentDevice,item.locallyObservedSession])).toEqual([
      ['device-current',true,'current_session'],['device-revoked',false,'recently_seen']
    ]);
  });

  it('keeps quarantine-only containment scoped and writes only the durable quarantine ledger',async()=>{
    const {unit,counters}=fixture();
    const result=await unit.execute(context,intent({action:'create',capability:'family.write',resourceType:'privacy_incident',resourceId:'incident-1'}),scope=>{
      const inserted=scope.insertIncident({id:'incident-1',key,familyId:FAMILY,accountId:ACCOUNT,ownerPersonId:PERSON} as never);
      return inserted.ok?scope.quarantineLocalDerivedData(BINDING):inserted;
    });
    expect(result.ok).toBe(true);expect(counters.quarantines).toBe(1);
    expect({epoch:counters.epoch,devices:counters.devices,leases:counters.leases,consents:counters.consents,permissions:counters.permissions,revocations:counters.revocations})
      .toEqual({epoch:0,devices:0,leases:0,consents:0,permissions:0,revocations:0});
  });

  it('revokes all local authority on the session action and makes a mixed explicit action idempotent',async()=>{
    const {unit,counters}=fixture();
    const result=await unit.execute(context,intent({action:'create',capability:'family.write',resourceType:'privacy_incident',resourceId:'incident-2'}),scope=>{
      const inserted=scope.insertIncident({id:'incident-2',key,familyId:FAMILY,accountId:ACCOUNT,ownerPersonId:PERSON} as never);
      if(!inserted.ok)return inserted;
      const contained=scope.advanceSecurityEpochAndRevokeLocalSessions(ACCOUNT);if(!contained.ok)return contained;
      return scope.revokeCapability('permission-1');
    });
    expect(result.ok).toBe(true);
    expect({epoch:counters.epoch,devices:counters.devices,leases:counters.leases,consents:counters.consents,permissions:counters.permissions})
      .toEqual({epoch:1,devices:1,leases:1,consents:1,permissions:1});
    expect(counters.revocations).toBe(5);
  });

  it('simulates permission from local reads without grant, audit or outbox mutation',async()=>{
    const {unit,counters}=fixture();
    const result=await unit.execute(context,intent(),scope=>scope.evaluatePermission({subjectAccountId:ACCOUNT,resourceType:'privacy_inventory',resourceId:PERSON,action:'read',purpose:'general',occurredAt:NOW}));
    expect(result).toEqual(ok({allowed:true,reason:'owner',obligations:[]}));
    expect(counters.permissionReads).toBe(1);
    expect({permissions:counters.permissions,audits:counters.audits,outbox:counters.outbox}).toEqual({permissions:0,audits:0,outbox:0});
  });

  it.each([
    {name:'owner',allowed:true,reason:'owner',options:{grants:[]} satisfies FixtureOptions,target:{subjectAccountId:ACCOUNT,resourceType:'privacy_inventory',resourceId:'record-1',action:'read' as const,purpose:'general' as const,occurredAt:NOW}},
    {name:'role default behind the private boundary',allowed:false,reason:'privacy_boundary',options:{simulatedAccountId:SUBJECT_ACCOUNT,simulatedPersonId:SUBJECT_PERSON,simulatedRole:'family_admin',grants:[]} satisfies FixtureOptions,target:{subjectAccountId:SUBJECT_ACCOUNT,resourceType:'privacy_inventory',resourceId:'record-1',action:'read' as const,purpose:'general' as const,occurredAt:NOW}},
    {name:'explicit allow',allowed:true,reason:'explicit_allow',options:{simulatedAccountId:SUBJECT_ACCOUNT,simulatedPersonId:SUBJECT_PERSON,simulatedRole:'limited_member',grants:[permission()]} satisfies FixtureOptions,target:{subjectAccountId:SUBJECT_ACCOUNT,resourceType:'privacy_inventory',resourceId:'record-1',action:'read' as const,purpose:'general' as const,occurredAt:NOW}},
    {name:'wildcard allow',allowed:true,reason:'explicit_allow',options:{simulatedAccountId:SUBJECT_ACCOUNT,simulatedPersonId:SUBJECT_PERSON,simulatedRole:'limited_member',grants:[permission({id:'permission-wildcard',resourceId:'*'})]} satisfies FixtureOptions,target:{subjectAccountId:SUBJECT_ACCOUNT,resourceType:'privacy_inventory',resourceId:'record-2',action:'read' as const,purpose:'general' as const,occurredAt:NOW}},
    {name:'deny precedence',allowed:false,reason:'explicit_deny',options:{simulatedAccountId:SUBJECT_ACCOUNT,simulatedPersonId:SUBJECT_PERSON,simulatedRole:'family_admin',grants:[permission({id:'permission-allow'}),permission({id:'permission-deny',effect:'deny',denialReason:'blocked'})]} satisfies FixtureOptions,target:{subjectAccountId:SUBJECT_ACCOUNT,resourceType:'privacy_inventory',resourceId:'record-1',action:'read' as const,purpose:'general' as const,occurredAt:NOW}}
  ])('matches CentralAuthorizationService for $name without mutating grants or evidence',async({allowed,reason,options,target})=>{
    const {unit,counters,simulatedPersonId,simulatedRole,grants}=fixture(options);
    const central=new CentralAuthorizationService().authorize({
      accountId:target.subjectAccountId,role:simulatedRole,action:target.action,resourceType:target.resourceType,
      resourceId:target.resourceId,occurredAt:target.occurredAt,purpose:target.purpose,
      actorPersonId:simulatedPersonId,ownerPersonId:PERSON,privacy:'private',sensitiveDomain:'privacy',grants
    });
    expect(central).toMatchObject({allowed,reason});
    const result=await unit.execute(context,intent(),scope=>scope.evaluatePermission(target));
    expect(result).toEqual(ok({allowed:central.allowed,reason:central.reason,obligations:[
      ...(central.matchedGrantId?[`matched_grant:${central.matchedGrantId}`]:[]),
      ...(central.matchedOwnershipBasisPoints===undefined?[]:[`ownership_basis_points:${central.matchedOwnershipBasisPoints}`])
    ]}));
    expect(counters.permissionReads).toBe(1);
    expect({permissions:counters.permissions,audits:counters.audits,outbox:counters.outbox}).toEqual({permissions:0,audits:0,outbox:0});
  });

  it('rejects permission simulation for an account outside the governed family',async()=>{
    const {unit,counters}=fixture({simulatedAccountId:SUBJECT_ACCOUNT,simulatedPersonId:SUBJECT_PERSON,simulatedFamily:asFamilyId('family-other')});
    const result=await unit.execute(context,intent(),scope=>scope.evaluatePermission({subjectAccountId:SUBJECT_ACCOUNT,resourceType:'privacy_inventory',resourceId:PERSON,action:'read',purpose:'general',occurredAt:NOW}));
    expect(result.ok).toBe(false);
    expect(counters.permissionReads).toBe(0);
    expect({permissions:counters.permissions,audits:counters.audits,outbox:counters.outbox}).toEqual({permissions:0,audits:0,outbox:0});
  });

  it('rolls every local containment effect back when a later mixed action fails',async()=>{
    const {unit,counters}=fixture();
    const result=await unit.execute(context,intent({action:'create',capability:'family.write',resourceType:'privacy_incident',resourceId:'incident-rollback'}),scope=>{
      const contained=scope.advanceSecurityEpochAndRevokeLocalSessions(ACCOUNT);if(!contained.ok)return contained;
      return scope.quarantineLocalDerivedData('e'.repeat(64));
    });
    expect(result.ok).toBe(false);
    expect(counters).toEqual({epoch:0,devices:0,leases:0,consents:0,permissions:0,revocations:0,quarantines:0,audits:0,outbox:0,permissionReads:0});
  });

  it('fails closed when AI deletion propagation proof does not match the immutable binding',async()=>{
    const {unit}=fixture({propagationBinding:'e'.repeat(64)});
    const result=await unit.execute(context,intent({action:'delete',capability:'family.write',resourceType:'ai_memory_record',resourceId:'memory-1',purpose:'ai_processing'}),
      scope=>scope.propagateAiMemoryDeletion('memory-1',BINDING));
    expect(result.ok).toBe(false);
  });
});

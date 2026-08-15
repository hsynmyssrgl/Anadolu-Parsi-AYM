import { describe,expect,it } from 'vitest';
import { asCorrelationId,asFamilyId,asIsoDateTime,asPersonId,asUserId,ok,type AppError,type Result } from '@ppt/core';
import type { DomainEvent } from '@ppt/events';
import type { SmartHomeCameraConsentRow,SmartHomeDeviceRow,SmartHomeMutationRow,SmartHomeObservationRow,SmartHomeSettingsRow } from '@ppt/repository-contracts';
import {
  GrantSmartHomeCameraConsentUseCase,
  RecordSmartHomeObservationUseCase,
  RegisterSmartHomeDeviceUseCase,
  RevokeSmartHomeCameraConsentUseCase,
  SetSmartHomeProcessingUseCase,
  UpdateSmartHomeDeviceStatusUseCase,
  type LifeApplicationContext,
  type LifePolicyIntent,
  type SmartHomeEnergyUnitOfWork,
  type SmartHomeEnergyWriteScope
} from '../src/index.js';

const FAMILY=asFamilyId('family-33-y');const OWNER=asPersonId('person-owner-33-y');
const context:LifeApplicationContext={familyId:FAMILY,actor:{userId:asUserId('account-owner-33-y'),role:'family_admin',personId:OWNER},
  correlationId:asCorrelationId('correlation-33-y')};
const MANIFEST='a'.repeat(64);const IDENTIFIER='b'.repeat(64);

class Scope implements SmartHomeEnergyWriteScope{
  public occurredAt=asIsoDateTime('2026-08-15T12:00:00.000Z');public readonly ownerPersonId=OWNER;
  public readonly devices=new Map<string,SmartHomeDeviceRow>();public readonly observations=new Map<string,SmartHomeObservationRow>();
  public readonly consents=new Map<string,SmartHomeCameraConsentRow>();public settings:SmartHomeSettingsRow|null=null;
  public readonly mutations=new Map<string,SmartHomeMutationRow>();public readonly audits:unknown[]=[];public readonly events:DomainEvent<unknown>[]=[];
  public findDevice(id:string){return ok(this.devices.get(id)??null);}public findConsent(id:string){return ok(this.consents.get(id)??null);}
  public findSettings(){return ok(this.settings);}public findMutation(id:string){return ok(this.mutations.get(id)??null);}
  public insertMutation(row:SmartHomeMutationRow){this.mutations.set(row.clientOperationId,row);return ok(undefined);}
  public insertDevice(row:SmartHomeDeviceRow){this.devices.set(row.id,row);return ok(undefined);}
  public saveDevice(row:SmartHomeDeviceRow,expected:number){if(this.devices.get(row.id)?.revision!==expected)throw new Error('revision');this.devices.set(row.id,row);return ok(undefined);}
  public insertObservation(row:SmartHomeObservationRow){this.observations.set(row.id,row);return ok(undefined);}
  public insertConsent(row:SmartHomeCameraConsentRow){this.consents.set(row.id,row);return ok(undefined);}
  public saveConsent(row:SmartHomeCameraConsentRow,expected:number){if(this.consents.get(row.id)?.revision!==expected)throw new Error('revision');this.consents.set(row.id,row);return ok(undefined);}
  public insertSettings(row:SmartHomeSettingsRow){this.settings=row;return ok(undefined);}
  public saveSettings(row:SmartHomeSettingsRow,expected:number){if(this.settings?.revision!==expected)throw new Error('revision');this.settings=row;return ok(undefined);}
  public appendAudit(input:unknown){this.audits.push(input);return ok('audit');}
  public enqueueEvent<T>(event:DomainEvent<T>):Result<void,AppError>{this.events.push(event as DomainEvent<unknown>);return ok(undefined);}
}
class Unit implements SmartHomeEnergyUnitOfWork{public readonly scope=new Scope();public readonly intents:LifePolicyIntent[]=[];
  public execute<T>(_context:LifeApplicationContext,intent:LifePolicyIntent,operation:(scope:SmartHomeEnergyWriteScope)=>Result<T,AppError>){
    this.intents.push(intent);return Promise.resolve(operation(this.scope));}}
const register=async(unit:Unit,id='camera-33-y',kind:'camera'|'energy_meter'|'ev_charger'='camera')=>new RegisterSmartHomeDeviceUseCase(unit).execute({context,command:{
  clientOperationId:`operation-register-${id}`,deviceId:id,adapterId:'adapter-33-y',providerId:'provider-local-33-y',kind,
  label:`Yerel ${kind}`,localIdentifierSha256:IDENTIFIER,adapterManifestSha256:MANIFEST,adapterSignerKeyId:'signer-33-y',adapterSignatureVerified:true}});

describe('33-Y local-first smart home and energy use cases',()=>{
  it('requires signed adapter evidence, registers metadata and replays exactly',async()=>{const unit=new Unit();
    const command={clientOperationId:'operation-register-33-y',deviceId:'camera-33-y',adapterId:'adapter-33-y',providerId:'provider-33-y',
      kind:'camera' as const,label:'Ön kapı kamerası',localIdentifierSha256:IDENTIFIER,adapterManifestSha256:MANIFEST,
      adapterSignerKeyId:'signer-33-y',adapterSignatureVerified:true as const};
    expect(await new RegisterSmartHomeDeviceUseCase(unit).execute({context,command})).toMatchObject({ok:true,value:{revision:1,replayed:false,
      networkUsed:false,cloudUsed:false,providerActionPerformed:'not_performed'}});
    expect(await new RegisterSmartHomeDeviceUseCase(unit).execute({context,command})).toMatchObject({ok:true,value:{replayed:true}});
    expect(unit.scope.devices.get('camera-33-y')).toMatchObject({signedAdapterEvidencePersisted:true,status:'active'});
    expect(unit.intents[0]).toMatchObject({resourceType:'smart_home_device',action:'create',capability:'family.write'});
  });

  it('records only bounded compatible scalar observations and rejects forged manifest or media-shaped values',async()=>{const unit=new Unit();await register(unit,'meter-33-y','energy_meter');
    const useCase=new RecordSmartHomeObservationUseCase(unit);const command={clientOperationId:'operation-energy-33-y',observationId:'observation-33-y',
      deviceId:'meter-33-y',expectedDeviceRevision:1,kind:'energy_kilowatt_hour' as const,numericValue:12.5,
      observedAt:'2026-08-15T11:59:00.000Z',sourceManifestSha256:MANIFEST};
    expect(await useCase.execute({context,command})).toMatchObject({ok:true,value:{mutationKind:'observation_record',revision:1}});
    expect(unit.scope.observations.get('observation-33-y')).toMatchObject({unit:'kilowatt_hour',numericValue:12.5});
    expect(await useCase.execute({context,command:{...command,clientOperationId:'operation-forged-33-y',observationId:'forged-33-y',sourceManifestSha256:'c'.repeat(64)}}))
      .toMatchObject({ok:false,error:{category:'authorization'}});
    expect(JSON.stringify(unit.scope.events)).not.toContain('12.5');
  });

  it('enforces visible camera consent between five and sixty minutes and supports durable revoke',async()=>{const unit=new Unit();await register(unit);
    const grant=new GrantSmartHomeCameraConsentUseCase(unit);
    expect(await grant.execute({context,command:{clientOperationId:'operation-short-33-y',consentId:'consent-short-33-y',deviceId:'camera-33-y',
      purpose:'live_view',expiresAt:'2026-08-15T12:01:00.000Z'}})).toMatchObject({ok:false,error:{category:'validation'}});
    expect(await grant.execute({context,command:{clientOperationId:'operation-consent-33-y',consentId:'consent-33-y',deviceId:'camera-33-y',
      purpose:'doorbell_answer',expiresAt:'2026-08-15T12:30:00.000Z'}})).toMatchObject({ok:true,value:{revision:1}});
    expect(unit.scope.consents.get('consent-33-y')).toMatchObject({visibleIndicatorRequired:true,status:'active'});
    expect(await new RevokeSmartHomeCameraConsentUseCase(unit).execute({context,command:{clientOperationId:'operation-revoke-33-y',
      consentId:'consent-33-y',expectedRevision:1}})).toMatchObject({ok:true,value:{revision:2,mutationKind:'camera_consent_revoke'}});
    expect(unit.scope.consents.get('consent-33-y')).toMatchObject({status:'revoked',revision:2});
  });

  it('persists fail-closed processing settings without weakening camera defaults',async()=>{const unit=new Unit();const useCase=new SetSmartHomeProcessingUseCase(unit);
    expect(await useCase.execute({context,command:{clientOperationId:'operation-enable-33-y',expectedRevision:0,enabled:true,reason:'Yerel enerji özeti.'}}))
      .toMatchObject({ok:true,value:{mutationKind:'processing_enable',revision:1}});
    expect(unit.scope.settings).toMatchObject({processingEnabled:true,cameraAccessDefaultDenied:true,hiddenSurveillanceProhibited:true});
    expect(await useCase.execute({context,command:{clientOperationId:'operation-disable-33-y',expectedRevision:1,enabled:false,reason:'Yerel işleme kapatıldı.'}}))
      .toMatchObject({ok:true,value:{mutationKind:'processing_disable',revision:2}});
  });

  it('allows only monotonic status changes and never performs device control',async()=>{const unit=new Unit();await register(unit,'ev-33-y','ev_charger');
    const useCase=new UpdateSmartHomeDeviceStatusUseCase(unit);
    expect(await useCase.execute({context,command:{clientOperationId:'operation-offline-33-y',deviceId:'ev-33-y',expectedRevision:1,status:'offline'}}))
      .toMatchObject({ok:true,value:{revision:2,providerActionPerformed:'not_performed'}});
    expect(await useCase.execute({context,command:{clientOperationId:'operation-retire-33-y',deviceId:'ev-33-y',expectedRevision:2,status:'retired'}}))
      .toMatchObject({ok:true,value:{revision:3}});
    expect(await useCase.execute({context,command:{clientOperationId:'operation-reactivate-33-y',deviceId:'ev-33-y',expectedRevision:3,status:'active'}}))
      .toMatchObject({ok:false,error:{category:'conflict'}});
  });
});

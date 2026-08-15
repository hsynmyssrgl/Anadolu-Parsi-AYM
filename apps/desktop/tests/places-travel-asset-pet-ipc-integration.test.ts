import { readFileSync } from 'node:fs';import { describe,expect,it } from 'vitest';
import { PLACES_TRAVEL_ASSET_PET_IPC_CHANNELS,evaluateIpcIntegrationPolicy,evaluateIpcIntegrationResultPolicy } from '../src/main/ipc-integration-policy.js';
import { resolveIpcRequestAdmissionPolicy,resolveIpcRequestLifecyclePolicy,resolveIpcRequestRatePolicy } from '../src/main/ipc-request-lifecycle.js';
import { resolveIpcReadSharingPolicy } from '../src/main/ipc-read-sharing.js';
const NOW='2026-08-15T17:00:00.000Z';const OWNER='person-owner-33-v';const ITEM='places-travel-item-33-v';
const item={id:ITEM,ownerPersonId:OWNER,kind:'stored_place',area:'places',title:'Buluşma noktası',status:'active',visibility:'private',
  revision:1,addressLabel:'Parkın kuzey kapısı',latitudeE6:41015137,longitudeE6:28979430,offlineFallbackLabel:'Kuzey kapısı',createdAt:NOW,updatedAt:NOW} as const;
const truth={localOnly:true,mapProviderConfigured:false,coordinateAddressFallbackAvailable:true,schoolOrTravelProviderSync:'not_configured',
  externalBookingPerformed:'not_performed',liveTransportTrackingPerformed:'not_performed',paymentExecutionPerformed:'not_performed',
  documentVerificationPerformed:'not_performed',petHealthAdviceProvided:false,healthDetailsDuplicated:false,
  ocrSuggestionAutomaticallyAccepted:false,offlinePackDeliveryPerformed:'not_performed',languagePackDownloadPerformed:'not_performed',
  albumMediaStoredHere:false,aiProcessingAllowed:false,externalSharingAllowed:false} as const;
const center={schemaVersion:1,centerId:`places-travel-center:family-33-v:${OWNER}`,ownerPersonId:OWNER,items:[item],
  countsByArea:{places:1,moving:0,pet_care:0,travel:0},truth,generatedAt:NOW} as const;
const receipt={itemId:ITEM,ownerPersonId:OWNER,mutationKind:'item_create',previousRevision:0,revision:1,occurredAt:NOW,
  replayed:false,localOnly:true,externalAction:'not_performed'} as const;

describe('33-V places travel asset and pet IPC boundary',()=>{
  it('accepts exact owner reads and bounded local workflow mutations',()=>{
    expect(evaluateIpcIntegrationPolicy(PLACES_TRAVEL_ASSET_PET_IPC_CHANNELS.getCenter,[{ownerPersonId:OWNER}])).toEqual({accepted:true});
    expect(evaluateIpcIntegrationPolicy(PLACES_TRAVEL_ASSET_PET_IPC_CHANNELS.createItem,[{clientOperationId:'operation-place-create',
      itemId:ITEM,ownerPersonId:OWNER,kind:'stored_place',title:item.title,visibility:'private',addressLabel:item.addressLabel,
      latitudeE6:item.latitudeE6,longitudeE6:item.longitudeE6,offlineFallbackLabel:item.offlineFallbackLabel}])).toEqual({accepted:true});
    expect(evaluateIpcIntegrationPolicy(PLACES_TRAVEL_ASSET_PET_IPC_CHANNELS.updateItem,[{clientOperationId:'operation-place-update',
      itemId:ITEM,ownerPersonId:OWNER,expectedRevision:1,status:'completed',note:'Yerel işlem tamamlandı.'}])).toEqual({accepted:true});
    expect(evaluateIpcIntegrationPolicy(PLACES_TRAVEL_ASSET_PET_IPC_CHANNELS.deleteItem,[{clientOperationId:'operation-place-delete',
      itemId:ITEM,ownerPersonId:OWNER,expectedRevision:2,reason:'Kullanıcı yerel kaydı kaldırdı.'}])).toEqual({accepted:true});
  });
  it('rejects renderer authority secrets paths and unknown channels',()=>{
    for(const forbidden of [{accountId:'forged'},{familyId:'forged'},{policyReceiptHash:'a'.repeat(64)},
      {sourcePath:'C:\\private\\travel.json'},{bookingToken:'secret'},{paymentCard:'4111111111111111'}])
      expect(evaluateIpcIntegrationPolicy(PLACES_TRAVEL_ASSET_PET_IPC_CHANNELS.createItem,[{clientOperationId:'operation-forged',
        itemId:ITEM,ownerPersonId:OWNER,kind:'stored_place',title:'Yerel yer',visibility:'private',addressLabel:'Adres',...forbidden}]))
        .toMatchObject({accepted:false});
    expect(evaluateIpcIntegrationPolicy('placesTravel:future',[])).toMatchObject({accepted:false,reason:'UNKNOWN_IPC_CHANNEL'});
  });
  it('accepts safe views and rejects network AI payment booking and verification overclaims',()=>{
    expect(evaluateIpcIntegrationResultPolicy(PLACES_TRAVEL_ASSET_PET_IPC_CHANNELS.getCenter,center)).toEqual({accepted:true});
    expect(evaluateIpcIntegrationResultPolicy(PLACES_TRAVEL_ASSET_PET_IPC_CHANNELS.createItem,receipt)).toEqual({accepted:true});
    for(const forged of [{...center,accountId:'private-account'},{...center,items:[{...item,policyReceiptHash:'a'.repeat(64)}]},
      {...center,truth:{...truth,mapProviderConfigured:true}},{...center,truth:{...truth,aiProcessingAllowed:true}},
      {...center,truth:{...truth,paymentExecutionPerformed:'performed'}},{...receipt,externalAction:'performed'}])
      expect(evaluateIpcIntegrationResultPolicy('mutationKind' in forged?PLACES_TRAVEL_ASSET_PET_IPC_CHANNELS.createItem:
        PLACES_TRAVEL_ASSET_PET_IPC_CHANNELS.getCenter,forged)).toMatchObject({accepted:false});
  });
  it('keeps reads non-cacheable and serializes durable writes with explicit limits',()=>{
    const read=PLACES_TRAVEL_ASSET_PET_IPC_CHANNELS.getCenter;expect(resolveIpcRequestLifecyclePolicy(read)).toEqual({cancellable:true,latestWins:true,timeoutMs:10000});
    expect(resolveIpcReadSharingPolicy(read).enabled).toBe(false);expect(resolveIpcRequestRatePolicy(read)).toEqual({enabled:true,maxRequestsPerWindow:60,windowMs:60000});
    for(const channel of [PLACES_TRAVEL_ASSET_PET_IPC_CHANNELS.createItem,PLACES_TRAVEL_ASSET_PET_IPC_CHANNELS.updateItem,PLACES_TRAVEL_ASSET_PET_IPC_CHANNELS.deleteItem]){
      expect(resolveIpcRequestLifecyclePolicy(channel)).toEqual({cancellable:false,latestWins:false,timeoutMs:0});
      expect(resolveIpcRequestRatePolicy(channel)).toEqual({enabled:true,maxRequestsPerWindow:16,windowMs:60000});
      expect(resolveIpcRequestAdmissionPolicy(channel)).toMatchObject({enabled:true,maxConcurrentPerChannel:1});}
  });
  it('pins four main preload and renderer methods without receipt or external authority',()=>{
    const main=readFileSync('apps/desktop/src/main/main.ts','utf8');const preload=readFileSync('apps/desktop/src/main/preload.ts','utf8');
    const globalTypes=readFileSync('apps/desktop/src/renderer/global.d.ts','utf8');for(const [name,channel] of Object.entries(PLACES_TRAVEL_ASSET_PET_IPC_CHANNELS)){
      expect(main).toContain(`PLACES_TRAVEL_ASSET_PET_IPC_CHANNELS.${name}`);expect(preload).toContain(`invoke('${channel}'`);}
    for(const method of ['getPlacesTravelCenter','createPlacesTravelItem','updatePlacesTravelItem','deletePlacesTravelItem'])expect(globalTypes).toContain(method);
    expect(preload).not.toContain('placesTravelPolicyReceipt');expect(globalTypes).not.toContain('PlacesTravelPolicyReceipt');
  });
});

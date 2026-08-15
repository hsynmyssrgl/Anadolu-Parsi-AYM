import { readFileSync } from 'node:fs';
import { describe,expect,it } from 'vitest';
import { FAMILY_AI_ASSISTANT_IPC_CHANNELS,evaluateIpcIntegrationPolicy,evaluateIpcIntegrationResultPolicy } from '../src/main/ipc-integration-policy.js';
import { resolveIpcRequestAdmissionPolicy,resolveIpcRequestLifecyclePolicy,resolveIpcRequestRatePolicy } from '../src/main/ipc-request-lifecycle.js';
import { resolveIpcReadSharingPolicy } from '../src/main/ipc-read-sharing.js';

const NOW='2026-08-15T12:00:00.000Z';const OWNER='person-owner-33-w';const SUGGESTION='suggestion-33-w';
const suggestion={id:SUGGESTION,ownerPersonId:OWNER,kind:'authorized_search',purpose:'search',status:'pending_confirmation',
  title:'İzinli yerel arama sonucu',explanation:'Bir izinli yerel kaynak eşleşti; sonucu kaynağından doğrulayın.',confidenceBasisPoints:6250,
  sources:[{module:'event',resourceType:'event',resourceId:'event-33-w'}],revision:1,createdAt:NOW,updatedAt:NOW} as const;
const truth={localFirst:true,authorizedSearchAvailableWithoutProvider:true,providerConfigured:false,networkUsed:false,cloudUsed:false,
  modelInferencePerformed:false,speechSynthesisPerformed:false,translationPerformed:false,ocrSuggestionAutomaticallyAccepted:false,
  durableActionPerformed:'not_performed',humanConfirmationRequired:true,confirmationExecutesDownstreamAction:false,
  sourceConsentRevalidated:true,medicalFinancialOrEmergencyDecisionProvided:false} as const;
const center={schemaVersion:1,centerId:`family-ai-assistant:family-33-w:${OWNER}`,ownerPersonId:OWNER,suggestions:[suggestion],
  hiddenAfterConsentRevocationCount:0,truth,generatedAt:NOW} as const;
const receipt={suggestionId:SUGGESTION,mutationKind:'suggestion_generate',previousRevision:0,revision:1,occurredAt:NOW,replayed:false,
  durableActionPerformed:'not_performed',humanConfirmationRecorded:false,networkUsed:false,cloudUsed:false} as const;

describe('33-W family AI assistant IPC boundary',()=>{
  it('accepts exact local read, generate and human review inputs',()=>{
    expect(evaluateIpcIntegrationPolicy(FAMILY_AI_ASSISTANT_IPC_CHANNELS.getCenter,[])).toEqual({accepted:true});
    expect(evaluateIpcIntegrationPolicy(FAMILY_AI_ASSISTANT_IPC_CHANNELS.generate,[{clientOperationId:'operation-generate-33-w',
      suggestionId:SUGGESTION,kind:'authorized_search',modules:['event'],query:'aile toplantısı'}])).toEqual({accepted:true});
    expect(evaluateIpcIntegrationPolicy(FAMILY_AI_ASSISTANT_IPC_CHANNELS.review,[{clientOperationId:'operation-review-33-w',
      suggestionId:SUGGESTION,expectedRevision:1,decision:'confirm'}])).toEqual({accepted:true});
  });

  it('rejects authority, path, credential and autonomous-action payloads',()=>{
    for(const forbidden of [{accountId:'forged'},{familyId:'forged'},{ownerPersonId:OWNER},{policyReceiptHash:'a'.repeat(64)},
      {sourcePath:'C:\\private\\source.txt'},{providerToken:'secret'},{executePayment:true}])
      expect(evaluateIpcIntegrationPolicy(FAMILY_AI_ASSISTANT_IPC_CHANNELS.generate,[{clientOperationId:'operation-forged-33-w',
        suggestionId:SUGGESTION,kind:'authorized_search',...forbidden}])).toMatchObject({accepted:false});
    expect(evaluateIpcIntegrationPolicy('familyAiAssistant:future',[])).toMatchObject({accepted:false,reason:'UNKNOWN_IPC_CHANNEL'});
  });

  it('accepts metadata-only truth and rejects fingerprints, content or provider overclaims',()=>{
    expect(evaluateIpcIntegrationResultPolicy(FAMILY_AI_ASSISTANT_IPC_CHANNELS.getCenter,center)).toEqual({accepted:true});
    expect(evaluateIpcIntegrationResultPolicy(FAMILY_AI_ASSISTANT_IPC_CHANNELS.generate,receipt)).toEqual({accepted:true});
    for(const forged of [{...center,accountId:'private'},{...center,suggestions:[{...suggestion,sourceFingerprint:'a'.repeat(64)}]},
      {...center,suggestions:[{...suggestion,sources:[{...suggestion.sources[0],rawText:'private content'}]}]},
      {...center,truth:{...truth,networkUsed:true}},{...center,truth:{...truth,providerConfigured:true}},
      {...center,truth:{...truth,confirmationExecutesDownstreamAction:true}},{...receipt,durableActionPerformed:'performed'}])
      expect(evaluateIpcIntegrationResultPolicy('mutationKind' in forged?FAMILY_AI_ASSISTANT_IPC_CHANNELS.generate:
        FAMILY_AI_ASSISTANT_IPC_CHANNELS.getCenter,forged)).toMatchObject({accepted:false});
  });

  it('keeps reads non-cacheable and durable writes serialized and rate-limited',()=>{
    const read=FAMILY_AI_ASSISTANT_IPC_CHANNELS.getCenter;expect(resolveIpcRequestLifecyclePolicy(read)).toEqual({cancellable:true,latestWins:true,timeoutMs:10000});
    expect(resolveIpcReadSharingPolicy(read).enabled).toBe(false);expect(resolveIpcRequestRatePolicy(read)).toEqual({enabled:true,maxRequestsPerWindow:60,windowMs:60000});
    for(const channel of [FAMILY_AI_ASSISTANT_IPC_CHANNELS.generate,FAMILY_AI_ASSISTANT_IPC_CHANNELS.review]){
      expect(resolveIpcRequestLifecyclePolicy(channel)).toEqual({cancellable:false,latestWins:false,timeoutMs:0});
      expect(resolveIpcRequestRatePolicy(channel)).toEqual({enabled:true,maxRequestsPerWindow:12,windowMs:60000});
      expect(resolveIpcRequestAdmissionPolicy(channel)).toMatchObject({enabled:true,maxConcurrentPerChannel:1});
    }
  });

  it('pins three main/preload/global methods without renderer policy authority',()=>{
    const main=readFileSync('apps/desktop/src/main/main.ts','utf8');const preload=readFileSync('apps/desktop/src/main/preload.ts','utf8');
    const globalTypes=readFileSync('apps/desktop/src/renderer/global.d.ts','utf8');
    for(const [name,channel] of Object.entries(FAMILY_AI_ASSISTANT_IPC_CHANNELS)){
      expect(main).toContain(`FAMILY_AI_ASSISTANT_IPC_CHANNELS.${name}`);expect(preload).toContain(`invoke('${channel}'`);
    }
    for(const method of ['getFamilyAiAssistantCenter','generateFamilyAiSuggestion','reviewFamilyAiSuggestion'])expect(globalTypes).toContain(method);
    for(const forbidden of ['familyAiPolicyReceipt','FamilyAiStateFingerprint','getFamilyAiSourceBytes'])expect(preload+globalTypes).not.toContain(forbidden);
  });
});

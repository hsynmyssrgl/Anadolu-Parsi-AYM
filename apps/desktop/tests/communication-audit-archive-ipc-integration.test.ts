import { describe,expect,it } from 'vitest';
import {
  COMMUNICATION_AUDIT_ARCHIVE_IPC_CHANNELS,
  evaluateIpcIntegrationPolicy,
  evaluateIpcIntegrationResultPolicy
} from '../src/main/ipc-integration-policy.js';
import {
  resolveIpcRequestAdmissionPolicy,
  resolveIpcRequestLifecyclePolicy,
  resolveIpcRequestRatePolicy
} from '../src/main/ipc-request-lifecycle.js';

const center=Object.freeze({schemaVersion:1,eventCount:1,checkpointCount:1,recentEvents:[Object.freeze({
  eventKind:'file_shared',resourceType:'communication_file_sharing',resourceVersion:2,sequence:1,
  occurredAt:'2026-08-16T02:00:00.000Z'})],recentCheckpoints:[Object.freeze({archiveGeneration:1,
  vaultVerified:true,backupVerified:true,replicaVerified:false,restoreVerified:false,
  externalBackupProviderVerified:false,remoteReplicationVerified:false,createdAt:'2026-08-16T02:00:00.000Z'})],
recentEventsTruncated:false,recentCheckpointsTruncated:false,chainValid:true,truth:Object.freeze({
  appendOnlyHashChainedAuditImplemented:true,membershipCallFileAndPermissionEventsModeled:true,
  contentExcludedFromAuditByConstruction:true,identityHashAndVersionMetadataOnly:true,
  vaultDatabaseBackupRestoreCheckpointModeled:true,mutationAndCheckpointDeleteBlocked:true,
  productionRemoteReplicationConfigured:false,externalBackupProviderVerified:false,realRestoreDrillPerformed:false,
  networkUsedByCurrentImplementation:false,productionQueryApiComposed:true,productionEventProducerHooksComposed:true,
  rendererAuditMutationAuthorityExposed:false}),generatedAt:'2026-08-16T02:00:00.000Z',networkUsed:false,cloudUsed:false});

describe('34-H communication audit archive IPC boundary',()=>{
  it('accepts only the zero-argument read channel and rejects unknown mutation authority',()=>{
    expect(evaluateIpcIntegrationPolicy(COMMUNICATION_AUDIT_ARCHIVE_IPC_CHANNELS.getCenter,[])).toMatchObject({accepted:true});
    expect(evaluateIpcIntegrationPolicy(COMMUNICATION_AUDIT_ARCHIVE_IPC_CHANNELS.getCenter,[{}])).toMatchObject({accepted:false});
    expect(evaluateIpcIntegrationPolicy('communicationAuditArchive:append',[{}])).toMatchObject({accepted:false});
  });
  it('accepts the bounded content-free safe view and rejects identity, hashes and extra keys',()=>{
    expect(evaluateIpcIntegrationResultPolicy(COMMUNICATION_AUDIT_ARCHIVE_IPC_CHANNELS.getCenter,center)).toMatchObject({accepted:true});
    for(const extra of [{familyId:'foreign'},{eventHash:'a'.repeat(64)},{manifestSha256:'b'.repeat(64)},{resourceId:'secret'}])
      expect(evaluateIpcIntegrationResultPolicy(COMMUNICATION_AUDIT_ARCHIVE_IPC_CHANNELS.getCenter,{...center,...extra}))
        .toMatchObject({accepted:false});
    expect(evaluateIpcIntegrationResultPolicy(COMMUNICATION_AUDIT_ARCHIVE_IPC_CHANNELS.getCenter,
      {...center,recentEvents:Array.from({length:101},()=>center.recentEvents[0])})).toMatchObject({accepted:false});
  });
  it('pins cancellable latest-wins read lifecycle, bounded admission and rate',()=>{
    expect(resolveIpcRequestLifecyclePolicy(COMMUNICATION_AUDIT_ARCHIVE_IPC_CHANNELS.getCenter))
      .toEqual({cancellable:true,latestWins:true,timeoutMs:10_000});
    expect(resolveIpcRequestAdmissionPolicy(COMMUNICATION_AUDIT_ARCHIVE_IPC_CHANNELS.getCenter))
      .toMatchObject({enabled:true,maxConcurrentPerSender:2,maxConcurrentPerChannel:1,maxQueuedPerSender:4});
    expect(resolveIpcRequestRatePolicy(COMMUNICATION_AUDIT_ARCHIVE_IPC_CHANNELS.getCenter))
      .toEqual({enabled:true,maxRequestsPerWindow:120,windowMs:60_000});
  });
});

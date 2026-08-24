import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  ARCHIVE_EVIDENCE_MEDIA_IPC_CHANNELS,
  evaluateIpcIntegrationPolicy,
  evaluateIpcIntegrationResultPolicy
} from '../src/main/ipc-integration-policy.js';
import {
  resolveIpcRequestAdmissionPolicy,
  resolveIpcRequestLifecyclePolicy,
  resolveIpcRequestRatePolicy
} from '../src/main/ipc-request-lifecycle.js';
import { resolveIpcReadSharingPolicy } from '../src/main/ipc-read-sharing.js';

const occurredAt='2026-08-15T14:00:00.000Z';
const activeEvidence={
  id:'evidence-33-r',relationId:'relation-33-r',archiveItemId:'archive-33-r',
  documentTitle:'Aile belgesi',documentOriginalName:'aile.pdf',documentMimeType:'application/pdf',
  evidenceDate:'2026-08-14',confidence:'high',status:'active',revision:1,
  createdAt:occurredAt,updatedAt:occurredAt
} as const;
const version={
  id:'version-33-r',archiveItemId:'archive-33-r',versionNo:2,originalName:'aile-v2.pdf',
  mimeType:'application/pdf',sizeBytes:42,sha256:'a'.repeat(64),createdAt:occurredAt,note:'İkinci sürüm'
} as const;

describe('33-R archive evidence/media IPC and UI',()=>{
  it('accepts exact bounded evidence and version inputs while rejecting renderer authority fields',()=>{
    expect(evaluateIpcIntegrationPolicy(ARCHIVE_EVIDENCE_MEDIA_IPC_CHANNELS.addEvidence,[{relationId:'relation-33-r',archiveItemId:'archive-33-r',evidenceDate:'2026-08-14',confidence:'high',clientOperationId:'archive-operation-33-r'}])).toEqual({accepted:true});
    expect(evaluateIpcIntegrationPolicy(ARCHIVE_EVIDENCE_MEDIA_IPC_CHANNELS.removeEvidence,[{evidenceId:'evidence-33-r',archiveItemId:'archive-33-r',expectedRevision:1,clientOperationId:'archive-remove-33-r'}])).toEqual({accepted:true});
    expect(evaluateIpcIntegrationPolicy(ARCHIVE_EVIDENCE_MEDIA_IPC_CHANNELS.addVersion,[{itemId:'archive-33-r',note:'İkinci sürüm',clientOperationId:'archive-version-33-r'}])).toEqual({accepted:true});
    for(const forged of [
      {relationId:'relation-33-r',archiveItemId:'archive-33-r',evidenceDate:'2026-08-14',confidence:'high',clientOperationId:'archive-operation-33-r',ownerPersonId:'forged'},
      {itemId:'archive-33-r',clientOperationId:'archive-version-33-r',sourcePath:'C:\\forged.pdf'},
      {itemId:'archive-33-r',clientOperationId:'archive-version-33-r',policyReceiptHash:'a'.repeat(64)},
      {itemId:'archive-33-r',note:'x'.repeat(501),clientOperationId:'archive-version-33-r'}
    ]){
      const channel='relationId' in forged?ARCHIVE_EVIDENCE_MEDIA_IPC_CHANNELS.addEvidence:ARCHIVE_EVIDENCE_MEDIA_IPC_CHANNELS.addVersion;
      expect(evaluateIpcIntegrationPolicy(channel,[forged])).toMatchObject({accepted:false});
    }
  });

  it('accepts metadata-only safe results and rejects paths, receipts and malformed history',()=>{
    expect(evaluateIpcIntegrationResultPolicy(ARCHIVE_EVIDENCE_MEDIA_IPC_CHANNELS.listEvidence,[activeEvidence])).toEqual({accepted:true});
    expect(evaluateIpcIntegrationResultPolicy(ARCHIVE_EVIDENCE_MEDIA_IPC_CHANNELS.addVersion,[version])).toEqual({accepted:true});
    const history={mutationId:'mutation-33-r',evidenceId:activeEvidence.id,mutationKind:'evidence_create',revision:1,evidenceDate:'2026-08-14',confidence:'high',status:'active',occurredAt};
    expect(evaluateIpcIntegrationResultPolicy(ARCHIVE_EVIDENCE_MEDIA_IPC_CHANNELS.listEvidenceHistory,[history])).toEqual({accepted:true});
    for(const [channel,result] of [
      [ARCHIVE_EVIDENCE_MEDIA_IPC_CHANNELS.listEvidence,[{...activeEvidence,ownerPersonId:'forged'}]],
      [ARCHIVE_EVIDENCE_MEDIA_IPC_CHANNELS.addVersion,[{...version,storedName:'secret.enc'}]],
      [ARCHIVE_EVIDENCE_MEDIA_IPC_CHANNELS.listEvidenceHistory,[{...history,policyReceiptHash:'b'.repeat(64)}]],
      [ARCHIVE_EVIDENCE_MEDIA_IPC_CHANNELS.listEvidenceHistory,[{...history,mutationKind:'physical_delete'}]]
    ] as const)expect(evaluateIpcIntegrationResultPolicy(channel,result)).toMatchObject({accepted:false});
  });

  it('keeps governed reads non-cacheable and durable writes non-cancellable with bounded rates',()=>{
    for(const channel of [ARCHIVE_EVIDENCE_MEDIA_IPC_CHANNELS.listEvidence,ARCHIVE_EVIDENCE_MEDIA_IPC_CHANNELS.listEvidenceHistory]){
      expect(resolveIpcRequestLifecyclePolicy(channel)).toEqual({cancellable:true,latestWins:true,timeoutMs:10_000});
      expect(resolveIpcReadSharingPolicy(channel).enabled).toBe(false);
      expect(resolveIpcRequestRatePolicy(channel)).toEqual({enabled:true,maxRequestsPerWindow:60,windowMs:60_000});
    }
    for(const channel of [ARCHIVE_EVIDENCE_MEDIA_IPC_CHANNELS.addEvidence,ARCHIVE_EVIDENCE_MEDIA_IPC_CHANNELS.removeEvidence,ARCHIVE_EVIDENCE_MEDIA_IPC_CHANNELS.addVersion]){
      expect(resolveIpcRequestLifecyclePolicy(channel)).toEqual({cancellable:false,latestWins:false,timeoutMs:0});
      expect(resolveIpcRequestRatePolicy(channel)).toEqual({enabled:true,maxRequestsPerWindow:16,windowMs:60_000});
      expect(resolveIpcRequestAdmissionPolicy(channel)).toMatchObject({enabled:true,maxConcurrentPerChannel:1});
    }
  });

  it('registers five exact handlers and keeps file selection in the main process',()=>{
    const main=readFileSync('apps/desktop/src/main/main.ts','utf8');
    const preload=readFileSync('apps/desktop/src/main/preload.ts','utf8');
    const globalTypes=readFileSync('apps/desktop/src/renderer/global.d.ts','utf8');
    for(const channel of Object.values(ARCHIVE_EVIDENCE_MEDIA_IPC_CHANNELS))expect(main.split(`registerIpcHandler('${channel}'`).length-1).toBe(1);
    expect(main).toContain("dialog.showOpenDialog({title:'Yeni arşiv sürümünü seç',properties:['openFile']})");
    expect(preload).toContain("invoke('archive:addVersion',input)");
    expect(globalTypes).toContain('addArchiveItemVersion(input:AddArchiveItemVersionInput&{readonly clientOperationId:string}):Promise<ArchiveVersionView[]>');
    expect(globalTypes).not.toContain('addArchiveItemVersionFile');
  });

  it('uses the existing archive route, preserves retry identities and presents immutable-history truth',()=>{
    const app=readFileSync('apps/desktop/src/renderer/App.tsx','utf8');
    const styles=readFileSync('apps/desktop/src/renderer/styles.css','utf8');
    expect(app).toContain('İlişki kanıtı');
    expect(app).toContain('Kaldırma işlemi önceki kopyaları kendiliğinden yok etmez.');
    expect(app).toContain('Dosya seçimi güvenli uygulama alanında yapılır.');
    expect(app).toContain('pendingArchiveOperations.current.get(key)');
    expect(app).toContain('Aynı işlem kimliği ve revizyonla yeniden deneyebilirsiniz.');
    expect(app).not.toContain("id: 'archive-evidence'");
    expect(styles).toContain('.archive-relation-evidence');
  });
});

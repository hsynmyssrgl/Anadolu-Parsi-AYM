import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { IpcPerformanceTelemetryView } from '@ppt/domain';
import {
  accessDecisionLabel,
  archiveSensitivityLabel,
  accessPurposeLabel,
  aiMemoryStatusLabel,
  aiConsentPurposeLabel,
  aiConsentStatusLabel,
  aiResourceTypeLabel,
  backupScheduleLabel,
  backupTargetKindLabel,
  backupWorkflowStatusLabel,
  backgroundTaskStatusLabel,
  diagnosticComparisonKindLabel,
  exportArtifactKindLabel,
  externalBackupCopyKindLabel,
  externalBackupCopyStatusLabel,
  financeRecordKindLabel,
  familyImportIssueLabel,
  familyRelationTypeLabel,
  ipcAdaptiveModeLabel,
  ipcAdaptiveReasonLabel,
  ipcAlertMessage,
  ipcChannelLabel,
  ipcMaintenanceAuthorityReasonLabel,
  ipcMaintenanceRecoveryReasonLabel,
  ipcPersistenceStatusLabel,
  lifeRecordStatusLabel,
  loanCollateralTypeLabel,
  loanInsuranceStatusLabel,
  loanStatusLabel,
  maintenanceOperationLabel,
  maintenanceSourceLabel,
  queuedTaskPriorityLabel,
  queuedTaskStatusLabel,
  revocationListStatusLabel,
  systemTaskTypeLabel,
  timelineEventKindLabel,
  appleSyncStatusLabel,
  companionStatusLabel,
  dataRepairMembershipRoleLabel,
  dataRepairMembershipStatusLabel,
  dataRightsKindLabel,
  dataRightsStatusLabel,
  deletionPropagationLabel,
  derivedKindLabel,
  deviceSessionStatusLabel,
  deviceTrustStatusLabel,
  localProcessingKindLabel,
  localProcessingStatusLabel,
  membershipRoleLabel,
  offlineCacheReasonLabel,
  offlineCapabilityLabel,
  offlineLeaseStateLabel,
  privacyCategoryLabel,
  privacyIncidentSeverityLabel,
  privacyIncidentStatusLabel,
  privacyStorageScopeLabel,
  resourceTypeLabel,
  securityReceiptStatusLabel,
  temporaryPurposeLabel,
  temporaryRevocationStatusLabel,
  temporaryVerificationDecisionLabel
} from '../src/renderer/App';

const appSource=readFileSync(new URL('../src/renderer/App.tsx',import.meta.url),'utf8');

describe('app storage enum labels',()=>{
  it('maps persisted domain values to natural Turkish and English labels',()=>{
    expect(timelineEventKindLabel('health','tr')).toBe('Sağlık');
    expect(archiveSensitivityLabel('personal','tr')).toBe('Kişisel');
    expect(archiveSensitivityLabel('high','en')).toBe('High');
    expect(familyRelationTypeLabel('guardian','tr')).toBe('Vasi');
    expect(familyRelationTypeLabel('spouse','en')).toBe('Spouse');
    expect(familyRelationTypeLabel('legacy_unknown','tr')).toBe('Aile bağı');
    expect(familyImportIssueLabel('schema_invalid','error','tr')).toBe('Dosya biçimi veya içeriği düzeltilmelidir.');
    expect(timelineEventKindLabel('health','en')).toBe('Health');
    expect(aiConsentPurposeLabel('external_export','tr')).toBe('Haricî dışa aktarım');
    expect(aiResourceTypeLabel('archive_item','en')).toBe('Archive document');
    expect(aiConsentStatusLabel('revoked','tr')).toBe('Onay geri çekildi');
    expect(financeRecordKindLabel('asset','en')).toBe('Asset');
    expect(lifeRecordStatusLabel('active','tr')).toBe('Aktif');
    expect(loanStatusLabel('restructured','tr')).toBe('Yapılandırıldı');
    expect(loanInsuranceStatusLabel('expired','en')).toBe('Expired');
    expect(loanCollateralTypeLabel('real_estate','tr')).toBe('Gayrimenkul');
    expect(backupTargetKindLabel('external','tr')).toBe('Haricî disk');
    expect(backupScheduleLabel('monthly','en')).toBe('Monthly');
    expect(backgroundTaskStatusLabel('deferred','tr')).toBe('Ertelendi');
    expect(queuedTaskPriorityLabel('critical','en')).toBe('Critical');
    expect(queuedTaskStatusLabel('queued','tr')).toBe('Kuyrukta');
    expect(systemTaskTypeLabel('maintenance.vacuum','tr')).toBe('Veritabanı sıkıştırma');
    expect(exportArtifactKindLabel('diagnostic_report','en')).toBe('Diagnostic report');
    expect(diagnosticComparisonKindLabel('changed','tr')).toBe('Değiştirildi');
    expect(maintenanceOperationLabel('integrity_check','en')).toBe('Integrity check');
    expect(maintenanceSourceLabel('queue','tr')).toBe('Görev kuyruğu');
    expect(backupWorkflowStatusLabel('attention','tr')).toBe('İnceleme gerekiyor');
    expect(externalBackupCopyKindLabel('offline_disk','en')).toBe('Offline disk');
    expect(externalBackupCopyStatusLabel('unreachable','tr')).toBe('Erişilemiyor');
    expect(revocationListStatusLabel('superseded','tr')).toBe('Yerine yeni liste geldi');
    expect(privacyCategoryLabel('ai_memory','tr')).toBe('Yapay zekâ hafızası');
    expect(privacyStorageScopeLabel('local_encrypted','en')).toBe('Encrypted local area');
    expect(aiMemoryStatusLabel('pending_deletion','tr')).toBe('Silme bekliyor');
    expect(deviceTrustStatusLabel('revoked','en')).toBe('Trust revoked');
    expect(deviceSessionStatusLabel('recently_seen','tr')).toBe('Yakın zamanda görüldü');
    expect(appleSyncStatusLabel('not_configured','en')).toBe('Not configured');
    expect(localProcessingKindLabel('ocr','tr')).toBe('Metin tanıma');
    expect(localProcessingStatusLabel('completed','en')).toBe('Completed');
    expect(dataRightsKindLabel('encrypted_export','tr')).toBe('Şifreli dışa aktarım');
    expect(dataRightsStatusLabel('in_review','en')).toBe('In review');
    expect(privacyIncidentSeverityLabel('critical','tr')).toBe('Kritik');
    expect(privacyIncidentStatusLabel('contained_locally','en')).toBe('Contained locally');
    expect(accessDecisionLabel('denied','tr')).toBe('Reddedildi');
    expect(accessPurposeLabel('general','en')).toBe('General use');
    expect(derivedKindLabel('OCR_TEXT','tr')).toBe('Tanınan metin');
    expect(deletionPropagationLabel('attention_required','en')).toBe('Review required');
    expect(companionStatusLabel('version_conflict','tr')).toBe('Sürüm uyuşmazlığı');
    expect(securityReceiptStatusLabel('MALFORMED','en')).toBe('Malformed');
    expect(membershipRoleLabel('guardian','tr')).toBe('Vasi');
    expect(dataRepairMembershipRoleLabel('other','en')).toBe('Other');
    expect(dataRepairMembershipStatusLabel('ended','tr')).toBe('Sona erdi');
    expect(offlineCapabilityLabel('archive.read','en')).toBe('Read archive');
    expect(offlineLeaseStateLabel('revoked','tr')).toBe('İptal edildi');
    expect(offlineCacheReasonLabel('CONTEXT_MISMATCH','en')).toBe('Device or account did not match');
    expect(resourceTypeLabel('unknown-local-type','tr')).toBe('Yerel kayıt');
    expect(temporaryPurposeLabel('temporary_home_access','tr')).toBe('Geçici ev erişimi');
    expect(temporaryVerificationDecisionLabel('accepted_locally','en')).toBe('Accepted locally');
    expect(temporaryRevocationStatusLabel('unknown_offline','tr')).toBe('Çevrimdışı doğrulanamadı');
  });

  it('localizes telemetry state and fails closed for technical alert and channel text',()=>{
    expect(ipcMaintenanceAuthorityReasonLabel('TRUSTED_DEVICE_REQUIRED','tr')).toBe('Güvenilir cihaz gerekli');
    expect(ipcMaintenanceRecoveryReasonLabel('RECOVERY_RATE_LIMITED','en')).toBe('Recovery attempts temporarily limited');
    expect(ipcAdaptiveReasonLabel('critical-pressure','tr')).toBe('Kritik yük baskısı');
    expect(ipcPersistenceStatusLabel('write-failed','en')).toBe('Write failed');
    expect(ipcAdaptiveModeLabel('guarded','tr')).toBe('Korumalı');
    expect(ipcChannelLabel('catalog:listPeople','tr')).toBe('Uygulama işlemi');
    const alert={code:'duration-p95',severity:'warning',channel:'catalog:listPeople',metric:'duration',value:900,threshold:500,message:"Error invoking remote method 'catalog:listPeople': SQLite failed",detectedAt:'2026-08-23T00:00:00.000Z'} satisfies IpcPerformanceTelemetryView['alerts'][number];
    expect(ipcAlertMessage(alert,'tr')).toBe('Yanıt süresi uyarısı algılandı.');
    expect(ipcAlertMessage(alert,'tr')).not.toMatch(/IPC|SQLite|catalog:listPeople|Error invoking/iu);
  });

  it('routes user-visible storage values through labels while preserving diagnostic detail fields',()=>{
    for(const expected of [
      'timelineEventKindLabel(value,language)',
      'aiConsentPurposeLabel(c.purpose,language)',
      'backupTargetKindLabel(t.kind,language)',
      'queuedTaskStatusLabel(q.status,language)',
      'ipcAlertMessage(alert,language)',
      'ipcChannelLabel(channel.channel,language)',
      'backupWorkflowStatusLabel(cleanRewriteStatus.policy.state,language)',
      'externalBackupCopyStatusLabel(copy.status,language)',
      'financeRecordKindLabel(r.kind,language)',
      'lifeRecordStatusLabel(r.status,language)',
      'loanStatusLabel(loan.status,language)',
      'loanInsuranceStatusLabel(loan.insuranceStatus,language)',
      'loanCollateralTypeLabel(loan.collateralType,language)',
      'privacyCategoryLabel(item.category,language)',
      'privacyStorageScopeLabel(item.storageScope,language)',
      'dataRightsKindLabel(item.kind,language)',
      'privacyIncidentStatusLabel(item.status,language)',
      'offlineCapabilityLabel(lease.capability,language)',
      'resourceTypeLabel(p.resourceType,language)',
      'temporaryVerificationDecisionLabel(verification.decision,language)'
    ]) expect(appSource).toContain(expected);
    expect(appSource).not.toContain("value.replaceAll('_',' ')");
    expect(appSource).not.toContain('<strong>{alert.message}</strong>');
    expect(appSource).not.toContain('<strong>{channel.channel}</strong>');
    expect(appSource).not.toContain('{item.scopeResourceType}/{item.scopeResourceId}');
    expect(appSource).not.toContain('{p.resourceType}/{p.resourceId}');
    expect(appSource).not.toContain('{lease.capability} · {lease.state}');
    expect(appSource).toContain('{d.severity.toUpperCase()} · {d.code}');
    expect(appSource).toContain('{d.message}{d.details?');
  });
});

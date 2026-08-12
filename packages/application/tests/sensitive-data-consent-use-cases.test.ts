import { describe, expect, it } from 'vitest';
import { asCorrelationId, asIsoDateTime, asUserId, ok, type AppError, type Result } from '@ppt/core';
import type {
  AiAccessPreviewView,
  AiConsentView,
  SensitiveDataProfileView,
  SensitiveExportPreviewInput,
  SensitiveExportPreviewView
} from '@ppt/domain';
import {
  buildSensitiveDataProfiles,
  buildSensitiveExportPreview,
  PreviewAiAccessUseCase,
  PreviewSensitiveExportUseCase,
  UpsertAiConsentUseCase,
  UpsertSensitiveDataConsentUseCase,
  type AiConsentApplicationContext,
  type AiConsentQueryPort,
  type AiConsentUnitOfWork,
  type AiConsentWriteScope
} from '../src/ai-consent-use-cases.js';

const NOW = '2026-08-12T10:00:00.000Z';
const context: AiConsentApplicationContext = {
  actor: { userId: asUserId('admin-1'), role: 'family_admin' },
  correlationId: asCorrelationId('sensitive-consent-test')
};
const authorization = { authorize: () => ok(undefined) } as const;

class UnitOfWorkStub implements AiConsentUnitOfWork {
  readonly rows: AiConsentView[] = [];
  readonly audits: Array<{ action: string; resourceType: string; resourceId: string }> = [];

  public execute<T>(
    _context: AiConsentApplicationContext,
    operation: (scope: AiConsentWriteScope) => Result<T, AppError>
  ): Result<T, AppError> {
    return operation({
      occurredAt: asIsoDateTime(NOW),
      findIdentity: () => ok(null),
      upsert: (row) => { this.rows.push(row); return ok(undefined); },
      appendAudit: (input) => {
        this.audits.push({ action: input.action, resourceType: input.resourceType, resourceId: input.resourceId });
        return ok('audit-hash');
      }
    });
  }
}

class QueryStub implements AiConsentQueryPort {
  public list(): Result<readonly AiConsentView[], AppError> { return ok([]); }
  public preview(_context: AiConsentApplicationContext, purpose: AiConsentView['purpose']): Result<AiAccessPreviewView, AppError> {
    return ok({ purpose, allowedResources: [], blockedCount: 0, generatedAt: NOW });
  }
  public listSensitiveProfiles(): Result<readonly SensitiveDataProfileView[], AppError> {
    return ok(buildSensitiveDataProfiles([], NOW));
  }
  public previewSensitiveExport(
    _context: AiConsentApplicationContext,
    input: SensitiveExportPreviewInput,
    previewId: string
  ): Result<SensitiveExportPreviewView, AppError> {
    return ok(buildSensitiveExportPreview({
      consents: [{
        id: 'consent-1', accountId: 'admin-1', purpose: 'external_export',
        resourceType: 'sensitive_data_profile', resourceId: 'health', status: 'granted',
        startsAt: '2026-08-12T09:00:00.000Z', endsAt: '2026-08-13T09:00:00.000Z', createdAt: NOW
      }],
      inventory: [{ category: 'health', recordCount: 4, fieldNames: ['Sağlık kaydı', 'İlaç planı'] }],
      request: input,
      previewId,
      generatedAt: NOW
    }));
  }
}

describe('B2-05/B6-03 sensitive data consent policy', () => {
  it('defaults all four categories and both purposes to deny', () => {
    const profiles = buildSensitiveDataProfiles([], NOW);
    expect(profiles.map((profile) => profile.category)).toEqual(['child', 'health', 'finance', 'location']);
    for (const profile of profiles) {
      expect(profile.defaultDenied).toBe(true);
      expect(profile.aiProcessing).toMatchObject({ effectiveStatus: 'default_denied', visibleSharing: false });
      expect(profile.externalExport).toMatchObject({ effectiveStatus: 'default_denied', visibleSharing: false });
    }
  });

  it('requires explicit consent and a bounded duration before granting', () => {
    const unitOfWork = new UnitOfWorkStub();
    const genericBypass = new UpsertAiConsentUseCase(unitOfWork).execute({
      context,
      command: {
        purpose: 'sensitive_processing', resourceType: 'sensitive_data_profile',
        resourceId: 'health', status: 'granted'
      } as never,
      identifiers: { consentId: 'generic-bypass', auditId: 'generic-bypass-audit' }
    });
    expect(genericBypass.ok).toBe(false);
    expect(unitOfWork.rows).toHaveLength(0);

    const useCase = new UpsertSensitiveDataConsentUseCase(unitOfWork, authorization);
    const denied = useCase.execute({
      context,
      command: { category: 'health', purpose: 'sensitive_processing', status: 'granted', durationMinutes: 60, explicitConsent: false },
      identifiers: { consentId: 'consent-1', auditId: 'audit-1' }
    });
    expect(denied.ok).toBe(false);
    expect(unitOfWork.rows).toHaveLength(0);

    const granted = useCase.execute({
      context,
      command: { category: 'health', purpose: 'sensitive_processing', status: 'granted', durationMinutes: 60, explicitConsent: true },
      identifiers: { consentId: 'consent-2', auditId: 'audit-2' }
    });
    expect(granted.ok).toBe(true);
    expect(unitOfWork.rows[0]).toMatchObject({
      purpose: 'sensitive_processing', resourceType: 'sensitive_data_profile', resourceId: 'health',
      status: 'granted', endsAt: '2026-08-12T11:00:00.000Z'
    });
    expect(unitOfWork.audits[0]?.action).toBe('ai.sensitive_consent_granted');
  });

  it('keeps export approval separate and previews metadata without transferring data', () => {
    const unitOfWork = new UnitOfWorkStub();
    expect(new PreviewAiAccessUseCase(new QueryStub()).execute(context, 'external_export' as never).ok).toBe(false);
    const result = new PreviewSensitiveExportUseCase(new QueryStub(), unitOfWork, authorization).execute({
      context,
      command: { categories: ['health'], destinationLabel: 'Kullanıcı seçimi', businessPurpose: 'Doktor görüşmesi için aile özeti' },
      identifiers: { previewId: 'preview-1', auditId: 'audit-preview-1' }
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).toMatchObject({
      previewId: 'preview-1', totalRecordCount: 4, allApproved: true,
      transferAllowed: true, outboundTransferPerformed: false
    });
    expect(result.value.categories[0]).toMatchObject({ category: 'health', approved: true, recordCount: 4 });
    expect(unitOfWork.audits[0]?.action).toBe('ai.sensitive_export_previewed');
  });

  it('marks expired approval as non-shareable and blocks the export preview', () => {
    const preview = buildSensitiveExportPreview({
      consents: [{
        id: 'expired-1', accountId: 'admin-1', purpose: 'external_export',
        resourceType: 'sensitive_data_profile', resourceId: 'location', status: 'granted',
        startsAt: '2026-08-10T10:00:00.000Z', endsAt: '2026-08-11T10:00:00.000Z', createdAt: NOW
      }],
      inventory: [{ category: 'location', recordCount: 2, fieldNames: ['Konum etiketi'] }],
      request: { categories: ['location'], destinationLabel: 'Kullanıcı seçimi', businessPurpose: 'Aile buluşma planının hazırlanması' },
      previewId: 'preview-expired', generatedAt: NOW
    });
    expect(preview.categories[0]).toMatchObject({ effectiveStatus: 'expired', approved: false });
    expect(preview.transferAllowed).toBe(false);
    expect(preview.outboundTransferPerformed).toBe(false);

    const unbounded = buildSensitiveDataProfiles([{
      id: 'legacy-unbounded', accountId: 'admin-1', purpose: 'external_export',
      resourceType: 'sensitive_data_profile', resourceId: 'health', status: 'granted',
      startsAt: '2026-08-12T09:00:00.000Z', createdAt: NOW
    }], NOW);
    expect(unbounded.find((profile) => profile.category === 'health')?.externalExport).toMatchObject({
      effectiveStatus: 'default_denied', visibleSharing: false
    });
  });
});

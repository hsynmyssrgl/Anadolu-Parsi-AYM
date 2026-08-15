import { describe, expect, it } from 'vitest';
import { asCorrelationId, asFamilyId, asIsoDateTime, asPersonId, asUserId, ok, type AppError, type Result } from '@ppt/core';
import { COMMUNICATION_FILE_CHUNK_BYTES, type CommunicationFileSharingCenterView } from '@ppt/domain';
import type { CommunicationFileSharingCenterRow, CommunicationFileSharingMutationRow } from '@ppt/repository-contracts';
import {
  ApplyCommunicationFileSharingCommandUseCase,
  communicationFileSharingKey,
  type CommunicationFileSharingUnitOfWork,
  type CommunicationFileSharingWriteScope,
  type LifeApplicationContext,
  type LifePolicyIntent
} from '../src/index.js';

const FAMILY = asFamilyId('family-34-g');
const OWNER = asPersonId('person-owner-34-g');
const NOW = asIsoDateTime('2026-08-16T00:20:00.000Z');
const CONTEXT: LifeApplicationContext = Object.freeze({ familyId: FAMILY,
  actor: Object.freeze({ userId: asUserId('account-owner-34-g'), role: 'family_admin', personId: OWNER }),
  correlationId: asCorrelationId('correlation-owner-34-g') });

class State {
  public row: CommunicationFileSharingCenterRow | null = null;
  public readonly mutations = new Map<string, CommunicationFileSharingMutationRow>();
  public clone() { const next = new State(); next.row = this.row;
    for (const [key, value] of this.mutations) next.mutations.set(key, value); return next; }
}

class Scope implements CommunicationFileSharingWriteScope {
  public readonly key = communicationFileSharingKey(CONTEXT, OWNER);
  public readonly occurredAt = NOW;
  public constructor(private readonly state: State) {}
  public load() { return ok(this.state.row); }
  public findMutation(clientOperationId: string) { return ok(this.state.mutations.get(clientOperationId) ?? null); }
  public save(row: CommunicationFileSharingCenterRow, mutation: CommunicationFileSharingMutationRow, expectedRevision: number) {
    if ((this.state.row?.snapshot.revision ?? 0) !== expectedRevision) throw new Error('revision mismatch');
    this.state.row = row; this.state.mutations.set(mutation.clientOperationId, mutation); return ok(undefined);
  }
}

class Unit implements CommunicationFileSharingUnitOfWork {
  public state = new State(); public intents: LifePolicyIntent[] = [];
  public execute<T>(_context: LifeApplicationContext, intent: LifePolicyIntent,
    operation: (scope: CommunicationFileSharingWriteScope) => Result<T, AppError>): Promise<Result<T, AppError>> {
    this.intents.push(intent); const draft = this.state.clone(); const result = operation(new Scope(draft));
    if (result.ok) this.state = draft; return Promise.resolve(result);
  }
}

const execute = async (unit: Unit, clientOperationId: string, expectedRevision: number,
  command: Parameters<ApplyCommunicationFileSharingCommandUseCase['execute']>[0]['command']) =>
  new ApplyCommunicationFileSharingCommandUseCase(unit).execute({ context: CONTEXT, clientOperationId, expectedRevision, command });

describe('34-G communication file sharing and remaining UX use cases', () => {
  it('models resumable hash receipts, fail-closed scan, timed grants, versions and a single archive copy', async () => {
    const unit = new Unit(); const full = 'a'.repeat(64); const first = 'b'.repeat(64); const second = 'c'.repeat(64);
    const totalBytes = COMMUNICATION_FILE_CHUNK_BYTES + 23;
    expect((await execute(unit, 'prepare-file-34-g', 0, { kind: 'prepare_file', fileId: 'file-34-g', roomId: 'room-34-g',
      displayName: 'Aile belgesi.pdf', mimeType: 'application/pdf', totalBytes, totalChunks: 2,
      fullContentSha256: full, sealedPayloadReference: 'sealed-file-34-g-v1' })).ok).toBe(true);
    expect((await execute(unit, 'chunk-0-34-g', 1, { kind: 'record_chunk', fileId: 'file-34-g', chunkIndex: 0,
      offsetBytes: 0, sizeBytes: COMMUNICATION_FILE_CHUNK_BYTES, sha256: first })).ok).toBe(true);
    expect((await execute(unit, 'chunk-1-34-g', 2, { kind: 'record_chunk', fileId: 'file-34-g', chunkIndex: 1,
      offsetBytes: COMMUNICATION_FILE_CHUNK_BYTES, sizeBytes: 23, sha256: second })).ok).toBe(true);
    expect((await execute(unit, 'scanner-unavailable-34-g', 3, { kind: 'set_scan', fileId: 'file-34-g',
      scanState: 'provider_unavailable' })).ok).toBe(true);
    expect(unit.state.row?.snapshot.files[0]).toMatchObject({ state: 'scan_required', scanState: 'provider_unavailable',
      externalLinkEnabled: false, externalLinkAccessCodeRequired: true });
    expect((await execute(unit, 'scanner-clean-34-g', 4, { kind: 'set_scan', fileId: 'file-34-g', scanState: 'clean' })).ok).toBe(true);
    expect((await execute(unit, 'grant-preview-34-g', 5, { kind: 'grant_access', fileId: 'file-34-g', grantId: 'grant-34-g',
      personId: 'person-member-34-g', mode: 'preview_only', startsAt: '2026-08-16T00:20:00.000Z',
      endsAt: '2026-08-17T00:20:00.000Z' })).ok).toBe(true);
    expect((await execute(unit, 'archive-link-34-g', 6, { kind: 'link_archive', fileId: 'file-34-g',
      archiveItemId: 'archive-item-34-g' })).ok).toBe(true);
    const conflict = await execute(unit, 'archive-link-conflict-34-g', 7, { kind: 'link_archive', fileId: 'file-34-g',
      archiveItemId: 'archive-item-other-34-g' });
    expect(conflict).toMatchObject({ ok: false, error: { category: 'conflict' } });
    expect((await execute(unit, 'version-2-34-g', 7, { kind: 'add_version', fileId: 'file-34-g',
      contentSha256: 'd'.repeat(64), sizeBytes: 500, sealedPayloadReference: 'sealed-file-34-g-v2' })).ok).toBe(true);
    expect(unit.state.row?.snapshot.files[0]?.versions).toHaveLength(2);
  });

  it('keeps emergency, remote assistance, co-watch and voice actions local and confirmation-bound', async () => {
    const unit = new Unit();
    await execute(unit, 'notifications-34-g', 0, { kind: 'set_notifications', quietHoursEnabled: true,
      quietHoursStart: '22:30', quietHoursEnd: '07:30', nonEmergencyDigestEnabled: true,
      roomOverrides: [{ roomId: 'room-quiet-34-g', muted: true }], personOverrides: [] });
    await execute(unit, 'emergency-34-g', 1, { kind: 'announce_emergency', announcementId: 'announcement-34-g',
      title: 'Aile durum bildirimi' });
    await execute(unit, 'support-request-34-g', 2, { kind: 'request_remote_assistance', sessionId: 'support-34-g',
      helperPersonId: 'person-helper-34-g', allowedControls: ['pointer','annotate'], endsAt: '2026-08-16T01:00:00.000Z' });
    await execute(unit, 'support-grant-34-g', 3, { kind: 'grant_remote_assistance', sessionId: 'support-34-g',
      explicitSingleUseConsent: true });
    await execute(unit, 'co-watch-34-g', 4, { kind: 'plan_co_watch', sessionId: 'cowatch-34-g',
      mediaReference: 'archive-item-family-video', narrationEnabled: true });
    await execute(unit, 'voice-prepare-34-g', 5, { kind: 'prepare_voice_action', actionId: 'voice-34-g',
      action: 'join_meeting', targetReference: 'meeting-34-g' });
    const prepared = unit.state.row?.snapshot as CommunicationFileSharingCenterView;
    expect(prepared.emergencyAnnouncements[0]).toMatchObject({ emergencyServiceGuaranteed: false, localDeliveryOnly: true });
    expect(prepared.remoteAssistance[0]).toMatchObject({ state: 'active_local_plan', visibleIndicatorRequired: true,
      secureDesktopAndPasswordsHidden: true, remoteTransportConfigured: false });
    expect(prepared.coWatchSessions[0]).toMatchObject({ sharePlayAdapterConfigured: false });
    expect(prepared.voiceActions[0]).toMatchObject({ state: 'confirmation_required', executedExternally: false });
    expect((await execute(unit, 'voice-confirm-34-g', 6, { kind: 'confirm_voice_action', actionId: 'voice-34-g',
      explicitConfirmation: true })).ok).toBe(true);
    expect(unit.state.row?.snapshot.voiceActions[0]).toMatchObject({ state: 'confirmed_local_only', executedExternally: false });
    expect(unit.state.row?.snapshot.truth).toMatchObject({ productionFileTransportConfigured: false,
      productionMalwareScannerConfigured: false, networkUsedByCurrentImplementation: false });
  });

  it('provides idempotent replay and rejects mismatched chunk evidence', async () => {
    const unit = new Unit(); const command = { kind: 'prepare_file' as const, fileId: 'file-replay-34-g',
      meetingId: 'meeting-replay-34-g', displayName: 'Plan.txt', mimeType: 'text/plain', totalBytes: 10,
      totalChunks: 1, fullContentSha256: 'e'.repeat(64), sealedPayloadReference: 'sealed-replay-34-g' };
    const first = await execute(unit, 'replay-34-g', 0, command); const replay = await execute(unit, 'replay-34-g', 0, command);
    expect(first).toMatchObject({ ok: true, value: { replayed: false, networkUsed: false } });
    expect(replay).toMatchObject({ ok: true, value: { replayed: true, networkUsed: false } });
    await execute(unit, 'chunk-replay-34-g', 1, { kind: 'record_chunk', fileId: 'file-replay-34-g', chunkIndex: 0,
      offsetBytes: 0, sizeBytes: 10, sha256: 'f'.repeat(64) });
    const mismatch = await execute(unit, 'chunk-mismatch-34-g', 2, { kind: 'record_chunk', fileId: 'file-replay-34-g',
      chunkIndex: 0, offsetBytes: 0, sizeBytes: 10, sha256: '1'.repeat(64) });
    expect(mismatch).toMatchObject({ ok: false, error: { category: 'conflict' } });
  });
});

import { linkSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { asCorrelationId, asFamilyId, asIsoDateTime, asPersonId } from '@ppt/core';
import type { FamilyMeetingMinutesRow } from '@ppt/repository-contracts';
import type { DeviceSecretProtector } from '../src/main/device-secret-protector.js';
import { FamilyMeetingMinutesVault } from '../src/main/family-meeting-minutes-vault.js';
import { ProtectedSideArtifactStore } from '../src/main/protected-side-artifact-store.js';

const directories: string[] = [];
afterEach(() => { for (const directory of directories.splice(0)) rmSync(directory, { recursive: true, force: true }); });
const protector: DeviceSecretProtector = Object.freeze({
  protectionId: 'test-family-meeting-minutes-protector', isAvailable: () => true,
  protect: (plaintext: string) => Buffer.from(plaintext, 'utf8').toString('base64url'),
  unprotect: (ciphertext: string) => Buffer.from(ciphertext, 'base64url').toString('utf8')
});
const openVault = () => {
  const directory = mkdtempSync(join(tmpdir(), 'ppt-34f-minutes-vault-')); directories.push(directory);
  const protectedStore = new ProtectedSideArtifactStore({ keyPath: join(directory, 'keys', 'minutes.key'),
    applicationVersion: '34-f-test', protector, now: () => '2026-08-15T18:00:00.000Z' });
  return { directory, vault: new FamilyMeetingMinutesVault({ rootDirectory: join(directory, 'minutes'), protectedStore }) };
};
const CORRELATION = asCorrelationId('family-meeting-minutes-vault-test');
const sealMinutes = (vault: FamilyMeetingMinutesVault) => vault.seal({
  familyId: 'family-34-f-vault', ownerPersonId: 'person-owner-34-f', meetingId: 'meeting-34-f-vault',
  minutesRevision: 1, summary: 'The family approved the plan.', decisions: ['Visit the museum.'],
  tasks: ['Book accessible tickets.'], participantAccessPersonIds: ['person-member-34-f','person-owner-34-f'],
  selectedRecordingSegmentIds: ['segment-34-f'], machineGeneratedSource: false, humanApproved: true,
  occurredAt: '2026-08-15T18:00:00.000Z', correlationId: CORRELATION
});
const rowFor = (sealed: Extract<ReturnType<typeof sealMinutes>, {ok:true}>['value']): FamilyMeetingMinutesRow => Object.freeze({
  id: 'meeting-34-f-vault:minutes', familyId: asFamilyId('family-34-f-vault'),
  ownerPersonId: asPersonId('person-owner-34-f'), meetingId: 'meeting-34-f-vault', state: 'sealed_local',
  transcriptConsentVerified: false, aiSuggestionGenerated: false, humanApprovalRecorded: true,
  sealedPayloadReference: sealed.sealedPayloadReference, payloadSha256: sealed.payloadSha256,
  payloadSizeBytes: sealed.payloadSizeBytes, providerId: sealed.providerId,
  providerEvidenceSha256: sealed.providerEvidenceSha256, payloadRevision: sealed.payloadRevision,
  payloadCreatedAt: sealed.payloadCreatedAt,
  participantAccessPersonIds: Object.freeze([asPersonId('person-member-34-f'),asPersonId('person-owner-34-f')]),
  selectedRecordingSegmentIds: Object.freeze(['segment-34-f']), networkUsed: false, cloudUsed: false,
  revision: 1, stateFingerprint: '1'.repeat(64), lastMutationId: '2'.repeat(64),
  createdAt: asIsoDateTime('2026-08-15T18:00:00.000Z'), updatedAt: asIsoDateTime('2026-08-15T18:00:00.000Z')
});

describe('34-F protected family meeting minutes vault', () => {
  it('seals and opens human-approved minutes without exposing plaintext in the envelope', () => {
    const { directory, vault } = openVault(); const sealed = sealMinutes(vault); expect(sealed.ok).toBe(true);
    if (!sealed.ok) return;
    expect(readFileSync(join(directory, 'minutes', sealed.value.sealedPayloadReference), 'utf8'))
      .not.toContain('The family approved the plan.');
    expect(vault.open(rowFor(sealed.value), 'person-member-34-f', CORRELATION)).toMatchObject({ ok: true, value: {
      meetingId: 'meeting-34-f-vault', summary: 'The family approved the plan.', humanApproved: true,
      machineGeneratedSource: false, payloadSource: 'local_sealed_store', networkUsed: false, cloudUsed: false
    } });
  });

  it('denies non-participants and metadata attempts to bypass human approval', () => {
    const { vault } = openVault(); const sealed = sealMinutes(vault); if (!sealed.ok) throw new Error('fixture');
    expect(vault.open(rowFor(sealed.value), 'person-foreign-34-f', CORRELATION))
      .toMatchObject({ ok: false, error: { category: 'security' } });
    expect(vault.open({ ...rowFor(sealed.value), humanApprovalRecorded: false }, 'person-owner-34-f', CORRELATION))
      .toMatchObject({ ok: false, error: { category: 'security' } });
  });

  it('fails closed for row binding alteration and encrypted envelope tampering', () => {
    const { directory, vault } = openVault(); const sealed = sealMinutes(vault); if (!sealed.ok) throw new Error('fixture');
    expect(vault.open({ ...rowFor(sealed.value), meetingId: 'meeting-forged-34-f' }, 'person-owner-34-f', CORRELATION))
      .toMatchObject({ ok: false, error: { category: 'security' } });
    const path = join(directory, 'minutes', sealed.value.sealedPayloadReference); const bytes = readFileSync(path);
    bytes[Math.floor(bytes.byteLength / 2)] ^= 1; writeFileSync(path, bytes);
    expect(vault.open(rowFor(sealed.value), 'person-owner-34-f', CORRELATION))
      .toMatchObject({ ok: false, error: { category: 'security' } });
  });

  it('enforces no-overwrite publication and preserves the first valid package', () => {
    const { vault } = openVault(); const first = sealMinutes(vault); if (!first.ok) throw new Error('fixture');
    expect(sealMinutes(vault)).toMatchObject({ ok: false, error: { category: 'security' } });
    expect(vault.open(rowFor(first.value), 'person-owner-34-f', CORRELATION))
      .toMatchObject({ ok: true, value: { summary: 'The family approved the plan.' } });
  });

  it('rejects hard-linked files and performs idempotent verified discard', () => {
    const { directory, vault } = openVault(); const sealed = sealMinutes(vault); if (!sealed.ok) throw new Error('fixture');
    const path = join(directory, 'minutes', sealed.value.sealedPayloadReference);
    const alias = join(directory, 'minutes', 'alias.pptminutes'); linkSync(path, alias);
    expect(vault.open(rowFor(sealed.value), 'person-owner-34-f', CORRELATION))
      .toMatchObject({ ok: false, error: { category: 'security' } });
    rmSync(alias);
    expect(vault.discard(sealed.value.sealedPayloadReference, CORRELATION)).toEqual({ ok: true, value: undefined });
    expect(vault.discard(sealed.value.sealedPayloadReference, CORRELATION)).toEqual({ ok: true, value: undefined });
  });
});

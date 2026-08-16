import { linkSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { asCorrelationId, asFamilyId, asIsoDateTime, asPersonId, asUserId } from '@ppt/core';
import type { CommunicationMessageRow } from '@ppt/repository-contracts';
import type { DeviceSecretProtector } from '../src/main/device-secret-protector.js';
import { CommunicationMessagePayloadVault } from '../src/main/communication-message-payload-vault.js';
import { ProtectedSideArtifactStore } from '../src/main/protected-side-artifact-store.js';

const directories: string[] = [];
afterEach(() => { for (const directory of directories.splice(0)) rmSync(directory, { recursive: true, force: true }); });
const protector: DeviceSecretProtector = Object.freeze({
  protectionId: 'test-message-vault-protector', isAvailable: () => true,
  protect: (plaintext: string) => Buffer.from(plaintext, 'utf8').toString('base64url'),
  unprotect: (ciphertext: string) => Buffer.from(ciphertext, 'base64url').toString('utf8')
});
const openVault = () => {
  const directory = mkdtempSync(join(tmpdir(), 'ppt-34b-message-vault-')); directories.push(directory);
  const protectedStore = new ProtectedSideArtifactStore({ keyPath: join(directory, 'keys', 'payload.key'),
    applicationVersion: '34-b-test', protector, now: () => '2026-08-15T12:00:00.000Z' });
  return { directory, protectedStore, vault: new CommunicationMessagePayloadVault({
    rootDirectory: join(directory, 'payloads'), protectedStore }) };
};
const CORRELATION = asCorrelationId('communication-message-payload-vault-test');
const sealText = (vault: CommunicationMessagePayloadVault) => vault.seal({
  familyId: 'family-34-b-vault', ownerPersonId: 'person-34-b-vault', roomId: 'room-34-b-vault',
  messageId: 'message-34-b-vault', revision: 1, contentKind: 'text', contentMime: 'text/plain',
  text: 'Şifreli aile mesajı', occurredAt: '2026-08-15T12:00:00.000Z', correlationId: CORRELATION
});
const rowFor = (sealed: Extract<ReturnType<typeof sealText>, { ok: true }>['value']): CommunicationMessageRow => Object.freeze({
  id: 'message-34-b-vault', familyId: asFamilyId('family-34-b-vault'), ownerPersonId: asPersonId('person-34-b-vault'),
  roomId: 'room-34-b-vault', senderAccountId: asUserId('account-34-b-vault'), senderPersonId: asPersonId('person-34-b-vault'),
  contentKind: 'text', contentMime: 'text/plain', sealedPayloadReference: sealed.sealedPayloadReference,
  payloadSha256: sealed.payloadSha256, payloadSizeBytes: sealed.payloadSizeBytes, providerId: sealed.providerId,
  providerEvidenceSha256: sealed.providerEvidenceSha256, payloadRevision: 1,
  payloadCreatedAt: asIsoDateTime('2026-08-15T12:00:00.000Z'), state: 'sealed_local',
  deliveryState: 'transport_not_configured', silent: false, pinned: false, bookmarked: false, editCount: 0,
  revision: 1, stateFingerprint: '1'.repeat(64), lastMutationId: '2'.repeat(64),
  createdAt: asIsoDateTime('2026-08-15T12:00:00.000Z'), updatedAt: asIsoDateTime('2026-08-15T12:00:00.000Z')
});

describe('34-B protected communication message payload vault', () => {
  it('seals, verifies and opens text without exposing plaintext in the envelope', () => {
    const { directory, vault } = openVault(); const sealed = sealText(vault); expect(sealed.ok).toBe(true);
    if (!sealed.ok) return; const path = join(directory, 'payloads', sealed.value.sealedPayloadReference);
    expect(readFileSync(path, 'utf8')).not.toContain('Şifreli aile mesajı');
    expect(vault.open(rowFor(sealed.value), CORRELATION)).toMatchObject({ ok: true, value: {
      messageId: 'message-34-b-vault', text: 'Şifreli aile mesajı', payloadSource: 'local_sealed_store',
      networkUsed: false, cloudUsed: false
    }});
  });

  it('supports bounded opaque media handles without accepting filesystem paths', () => {
    const { vault } = openVault();
    expect(vault.seal({ familyId: 'family-34-b-vault', ownerPersonId: 'person-34-b-vault', roomId: 'room-34-b-vault',
      messageId: 'message-photo-34-b', revision: 1, contentKind: 'photo', contentMime: 'image/jpeg',
      opaqueAttachmentHandle: 'attachment-photo-34-b', occurredAt: '2026-08-15T12:00:00.000Z', correlationId: CORRELATION
    })).toMatchObject({ ok: true, value: { contentKind: 'photo' } });
    expect(vault.seal({ familyId: 'family-34-b-vault', ownerPersonId: 'person-34-b-vault', roomId: 'room-34-b-vault',
      messageId: 'message-path-34-b', revision: 1, contentKind: 'document', contentMime: 'application/pdf',
      opaqueAttachmentHandle: 'C:/secret/document.pdf', occurredAt: '2026-08-15T12:00:00.000Z', correlationId: CORRELATION
    })).toMatchObject({ ok: false, error: { category: 'security' } });
  });

  it('fails closed for metadata alteration and encrypted envelope tampering', () => {
    const { directory, vault } = openVault(); const sealed = sealText(vault); if (!sealed.ok) throw new Error('fixture');
    expect(vault.open({ ...rowFor(sealed.value), ownerPersonId: asPersonId('person-foreign-34-b') }, CORRELATION))
      .toMatchObject({ ok: false, error: { category: 'security' } });
    const path = join(directory, 'payloads', sealed.value.sealedPayloadReference);
    const bytes = readFileSync(path); bytes[Math.floor(bytes.byteLength / 2)] ^= 1; writeFileSync(path, bytes);
    expect(vault.open(rowFor(sealed.value), CORRELATION)).toMatchObject({ ok: false, error: { category: 'security' } });
  });

  it('enforces no-overwrite publication and preserves the first valid payload', () => {
    const { vault } = openVault(); const first = sealText(vault); if (!first.ok) throw new Error('fixture');
    expect(sealText(vault)).toMatchObject({ ok: false, error: { category: 'security' } });
    expect(vault.open(rowFor(first.value), CORRELATION)).toMatchObject({ ok: true, value: { text: 'Şifreli aile mesajı' } });
  });

  it('rejects hard-linked files and performs idempotent verified discard', () => {
    const { directory, vault } = openVault(); const sealed = sealText(vault); if (!sealed.ok) throw new Error('fixture');
    const path = join(directory, 'payloads', sealed.value.sealedPayloadReference); const alias = join(directory, 'payloads', 'alias.pptmsg');
    linkSync(path, alias);
    expect(vault.open(rowFor(sealed.value), CORRELATION)).toMatchObject({ ok: false, error: { category: 'security' } });
    rmSync(alias);
    expect(vault.discard(sealed.value.sealedPayloadReference, CORRELATION)).toEqual({ ok: true, value: undefined });
    expect(vault.discard(sealed.value.sealedPayloadReference, CORRELATION)).toEqual({ ok: true, value: undefined });
  });

  it('repairs an interrupted hard-link publication and sweeps only old unreferenced owner payloads', () => {
    const { directory, protectedStore, vault } = openVault(); const sealed = sealText(vault);
    if (!sealed.ok) throw new Error('fixture');
    const root = join(directory, 'payloads'); const target = join(root, sealed.value.sealedPayloadReference);
    const temporary = join(root, '.comm-message-999-0123456789abcdef.tmp'); linkSync(target, temporary);
    const recovered = new CommunicationMessagePayloadVault({ rootDirectory: root, protectedStore });
    expect(recovered.open(rowFor(sealed.value), CORRELATION)).toMatchObject({ ok: true, value: { text: 'Şifreli aile mesajı' } });
    expect(recovered.sweepOrphans({ familyId: 'family-34-b-vault', ownerPersonId: 'person-34-b-vault',
      referencedPayloads: [], completedBefore: '2026-08-16T12:00:00.000Z', maximumCandidates: 64,
      correlationId: CORRELATION })).toEqual({ ok: true, value: { scannedFiles: 1, deletedFiles: 1, rejectedFiles: 0 } });
  });
});

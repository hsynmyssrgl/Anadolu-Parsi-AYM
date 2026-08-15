import { createHash, randomBytes } from 'node:crypto';
import {
  chmodSync,
  closeSync,
  constants,
  existsSync,
  fstatSync,
  fsyncSync,
  linkSync,
  lstatSync,
  mkdirSync,
  openSync,
  readFileSync,
  readdirSync,
  realpathSync,
  rmSync,
  writeFileSync
} from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { ERROR_CODES, createAppError, err, ok, type AppError, type CorrelationId, type Result } from '@ppt/core';
import type {
  CommunicationMessageContentView,
  VerifiedSealedCommunicationPayloadInput
} from '@ppt/domain';
import type { CommunicationMessageRow } from '@ppt/repository-contracts';
import type { CommunicationMessagePayloadPort } from '@ppt/application';
import { ProtectedSideArtifactStore, type ProtectedSideArtifactEnvelope } from './protected-side-artifact-store.js';

const PAYLOAD_KIND = 'communication-message-sealed-payload-v1';
const REFERENCE = /^comm-message-[0-9a-f]{64}\.pptmsg$/u;
const IDENTIFIER = /^[A-Za-z0-9][A-Za-z0-9._:@-]{1,255}$/u;
const MIME = /^[a-z0-9][a-z0-9.+-]{0,63}\/[a-z0-9][a-z0-9.+-]{0,127}$/u;
const SHA256 = /^[0-9a-f]{64}$/u;
const MAX_FILES = 10_000;
const MAX_TOTAL_BYTES = 512 * 1024 * 1024;
const MAX_ENVELOPE_BYTES = 1024 * 1024;

interface StoredCommunicationMessagePayload {
  readonly schemaVersion: 1;
  readonly kind: typeof PAYLOAD_KIND;
  readonly familyId: string;
  readonly ownerPersonId: string;
  readonly roomId: string;
  readonly messageId: string;
  readonly revision: number;
  readonly contentKind: CommunicationMessageRow['contentKind'];
  readonly contentMime: string;
  readonly text?: string;
  readonly opaqueAttachmentHandle?: string;
  readonly occurredAt: string;
  readonly networkUsed: false;
  readonly cloudUsed: false;
}

export interface CommunicationMessagePayloadVaultOptions {
  readonly rootDirectory: string;
  readonly protectedStore: ProtectedSideArtifactStore;
}

const hash = (bytes: Uint8Array): string => createHash('sha256').update(bytes).digest('hex');
const plain = (value: unknown): value is Record<string, unknown> => {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value); return prototype === Object.prototype || prototype === null;
};
const exactKeys = (value: object, expected: readonly string[]): boolean => {
  const actual = Object.keys(value).sort(); const canonical = [...expected].sort();
  return actual.length === canonical.length && actual.every((key, index) => key === canonical[index]);
};
const safeId = (value: unknown): value is string => typeof value === 'string' && value === value.trim()
  && IDENTIFIER.test(value) && !value.includes('..') && !value.includes('\\') && !value.includes('://');
const validIso = (value: unknown): value is string => typeof value === 'string'
  && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/u.test(value) && Number.isFinite(Date.parse(value));
const failure = (correlationId: CorrelationId, message: string): Result<never, AppError> => err(createAppError({
  code: ERROR_CODES.AUTHORIZATION_DENIED, message, category: 'security', correlationId
}));
const parseEnvelope = (raw: Buffer): ProtectedSideArtifactEnvelope => {
  const value = JSON.parse(raw.toString('utf8')) as unknown;
  if (!plain(value) || !exactKeys(value, ['schemaVersion','product','applicationVersion','kind','generatedAt','encryption'])
    || value.schemaVersion !== 1 || value.kind !== PAYLOAD_KIND || !validIso(value.generatedAt)
    || typeof value.product !== 'string' || typeof value.applicationVersion !== 'string' || !plain(value.encryption))
    throw new Error('Invalid protected communication payload envelope');
  return value as unknown as ProtectedSideArtifactEnvelope;
};
const parsePayload = (bytes: Buffer): StoredCommunicationMessagePayload => {
  const value = JSON.parse(bytes.toString('utf8')) as unknown;
  if (!plain(value) || !exactKeys(value, [
    'schemaVersion','kind','familyId','ownerPersonId','roomId','messageId','revision','contentKind','contentMime',
    ...(Object.hasOwn(value, 'text') ? ['text'] : []),
    ...(Object.hasOwn(value, 'opaqueAttachmentHandle') ? ['opaqueAttachmentHandle'] : []),
    'occurredAt','networkUsed','cloudUsed'
  ]) || value.schemaVersion !== 1 || value.kind !== PAYLOAD_KIND || !safeId(value.familyId)
    || !safeId(value.ownerPersonId) || !safeId(value.roomId) || !safeId(value.messageId)
    || !Number.isSafeInteger(value.revision) || Number(value.revision) < 1
    || !['text','voice','photo','video','location','document'].includes(String(value.contentKind))
    || typeof value.contentMime !== 'string' || !MIME.test(value.contentMime)
    || !validIso(value.occurredAt) || value.networkUsed !== false || value.cloudUsed !== false
    || (value.contentKind === 'text'
      ? typeof value.text !== 'string' || value.text.length < 1 || value.text.length > 32_768
        || Object.hasOwn(value, 'opaqueAttachmentHandle')
      : !safeId(value.opaqueAttachmentHandle) || Object.hasOwn(value, 'text'))) {
    throw new Error('Invalid protected communication message payload');
  }
  return Object.freeze(value as unknown as StoredCommunicationMessagePayload);
};
const samePath = (left: string, right: string): boolean => process.platform === 'win32'
  ? resolve(left).toLowerCase() === resolve(right).toLowerCase() : resolve(left) === resolve(right);

export class CommunicationMessagePayloadVault implements CommunicationMessagePayloadPort {
  readonly #root: string;
  public constructor(private readonly options: CommunicationMessagePayloadVaultOptions) {
    mkdirSync(options.rootDirectory, { recursive: true, mode: 0o700 });
    const stat = lstatSync(options.rootDirectory);
    if (!stat.isDirectory() || stat.isSymbolicLink()) throw new Error('Communication payload root must be a real directory');
    this.#root = realpathSync(options.rootDirectory);
  }

  public seal(input: Parameters<CommunicationMessagePayloadPort['seal']>[0]): Result<VerifiedSealedCommunicationPayloadInput, AppError> {
    if (!safeId(input.familyId) || !safeId(input.ownerPersonId) || !safeId(input.roomId) || !safeId(input.messageId)
      || !Number.isSafeInteger(input.revision) || input.revision < 1 || !MIME.test(input.contentMime) || !validIso(input.occurredAt)
      || (input.contentKind === 'text'
        ? typeof input.text !== 'string' || input.text.length < 1 || input.text.length > 32_768 || input.opaqueAttachmentHandle !== undefined
        : !safeId(input.opaqueAttachmentHandle) || input.text !== undefined))
      return failure(input.correlationId, 'Mesaj kasası girdisi güvenlik sözleşmesine uymuyor.');
    const payload: StoredCommunicationMessagePayload = Object.freeze({ schemaVersion: 1, kind: PAYLOAD_KIND,
      familyId: input.familyId, ownerPersonId: input.ownerPersonId, roomId: input.roomId, messageId: input.messageId,
      revision: input.revision, contentKind: input.contentKind, contentMime: input.contentMime,
      ...(input.text === undefined ? {} : { text: input.text }),
      ...(input.opaqueAttachmentHandle === undefined ? {} : { opaqueAttachmentHandle: input.opaqueAttachmentHandle }),
      occurredAt: input.occurredAt, networkUsed: false, cloudUsed: false });
    const plaintext = Buffer.from(JSON.stringify(payload), 'utf8');
    try {
      const payloadSha256 = hash(plaintext);
      const envelope = this.options.protectedStore.sealBuffer(PAYLOAD_KIND, plaintext);
      const encrypted = Buffer.from(`${JSON.stringify(envelope)}\n`, 'utf8');
      const reference = `comm-message-${hash(Buffer.from(JSON.stringify({ familyId: input.familyId,
        ownerPersonId: input.ownerPersonId, roomId: input.roomId, messageId: input.messageId, revision: input.revision,
        payloadSha256 }), 'utf8'))}.pptmsg`;
      this.#publish(reference, encrypted);
      const readback = this.#read(reference);
      try {
        if (!readback.equals(plaintext)) { this.#remove(reference); return failure(input.correlationId, 'Mesaj kasası readback doğrulaması başarısız.'); }
      } finally { readback.fill(0); }
      return ok(Object.freeze({ sealedPayloadReference: reference, payloadSha256, payloadSizeBytes: plaintext.byteLength,
        contentKind: input.contentKind, contentMime: input.contentMime, providerId: 'protected-side-artifact-store-v1',
        providerEvidenceSha256: hash(encrypted), verified: true, createdAt: input.occurredAt }));
    } catch {
      return failure(input.correlationId, 'Mesaj kasası güvenli yazımı başarısız.');
    } finally { plaintext.fill(0); }
  }

  public open(row: CommunicationMessageRow, correlationId: CorrelationId): Result<CommunicationMessageContentView, AppError> {
    if (!REFERENCE.test(row.sealedPayloadReference) || !SHA256.test(row.payloadSha256)
      || row.providerId !== 'protected-side-artifact-store-v1') return failure(correlationId, 'Mesaj kasası bağlayıcısı geçersiz.');
    let plaintext: Buffer | undefined; let encrypted: Buffer | undefined;
    try {
      encrypted = this.#raw(row.sealedPayloadReference);
      if (hash(encrypted) !== row.providerEvidenceSha256) return failure(correlationId, 'Mesaj kasası sağlayıcı kanıtı uyuşmuyor.');
      plaintext = this.options.protectedStore.openEnvelope(parseEnvelope(encrypted));
      if (plaintext.byteLength !== row.payloadSizeBytes || hash(plaintext) !== row.payloadSha256)
        return failure(correlationId, 'Mesaj kasası içerik özeti uyuşmuyor.');
      const payload = parsePayload(plaintext);
      if (payload.familyId !== row.familyId || payload.ownerPersonId !== row.ownerPersonId || payload.roomId !== row.roomId
        || payload.messageId !== row.id || payload.revision !== row.payloadRevision || payload.contentKind !== row.contentKind
        || payload.contentMime !== row.contentMime || payload.occurredAt !== row.payloadCreatedAt)
        return failure(correlationId, 'Mesaj kasası kimlik veya sürüm bağı uyuşmuyor.');
      return ok(Object.freeze({ messageId: row.id, revision: row.revision, contentKind: row.contentKind,
        contentMime: row.contentMime, ...(payload.text === undefined ? {} : { text: payload.text }),
        ...(payload.opaqueAttachmentHandle === undefined ? {} : { opaqueAttachmentHandle: payload.opaqueAttachmentHandle }),
        payloadSource: 'local_sealed_store', networkUsed: false, cloudUsed: false }));
    } catch { return failure(correlationId, 'Mesaj kasası içeriği açılamadı.'); }
    finally { plaintext?.fill(0); encrypted?.fill(0); }
  }

  public discard(reference: string, correlationId: CorrelationId): Result<void, AppError> {
    if (!REFERENCE.test(reference)) return failure(correlationId, 'Mesaj kasası silme referansı geçersiz.');
    try { this.#remove(reference); return existsSync(join(this.#root, reference))
      ? failure(correlationId, 'Mesaj kasası silme readback doğrulaması başarısız.') : ok(undefined); }
    catch { return failure(correlationId, 'Mesaj kasası güvenli mantıksal silme işlemi başarısız.'); }
  }

  #path(reference: string): string {
    if (!REFERENCE.test(reference)) throw new Error('Invalid communication payload reference');
    const path = join(this.#root, reference);
    if (!samePath(realpathSync(dirname(path)), this.#root)) throw new Error('Communication payload path escaped its root');
    return path;
  }
  #raw(reference: string): Buffer {
    const path = this.#path(reference); const stat = lstatSync(path);
    if (!stat.isFile() || stat.isSymbolicLink() || stat.nlink !== 1 || stat.size < 2 || stat.size > MAX_ENVELOPE_BYTES)
      throw new Error('Communication payload file metadata is invalid');
    const descriptor = openSync(path, constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0));
    try {
      const opened = fstatSync(descriptor);
      if (!opened.isFile() || opened.nlink !== 1 || opened.dev !== stat.dev || opened.ino !== stat.ino) throw new Error('Communication payload identity changed');
      return readFileSync(descriptor);
    } finally { closeSync(descriptor); }
  }
  #read(reference: string): Buffer {
    const encrypted = this.#raw(reference);
    try { return this.options.protectedStore.openEnvelope(parseEnvelope(encrypted)); }
    finally { encrypted.fill(0); }
  }
  #publish(reference: string, encrypted: Buffer): void {
    const files = readdirSync(this.#root, { withFileTypes: true }).filter((entry) => entry.isFile() && REFERENCE.test(entry.name));
    let bytes = 0; for (const entry of files) bytes += lstatSync(join(this.#root, entry.name)).size;
    if (files.length >= MAX_FILES || bytes + encrypted.byteLength > MAX_TOTAL_BYTES) throw new Error('Communication payload vault quota exceeded');
    const target = join(this.#root, reference); if (existsSync(target)) throw new Error('Communication payload no-overwrite conflict');
    const temporary = join(this.#root, `.comm-message-${process.pid}-${randomBytes(8).toString('hex')}.tmp`);
    let descriptor: number | undefined;
    try {
      descriptor = openSync(temporary, 'wx', 0o600); writeFileSync(descriptor, encrypted); fsyncSync(descriptor);
      closeSync(descriptor); descriptor = undefined; try { chmodSync(temporary, 0o600); } catch { /* Windows ACL is authoritative. */ }
      linkSync(temporary, target); rmSync(temporary, { force: true }); try { chmodSync(target, 0o600); } catch { /* Windows ACL is authoritative. */ }
      const stat = lstatSync(target); if (!stat.isFile() || stat.isSymbolicLink() || stat.nlink !== 1 || stat.size !== encrypted.byteLength)
        throw new Error('Communication payload publish readback failed');
    } catch (error) {
      if (descriptor !== undefined) try { closeSync(descriptor); } catch { /* best effort */ }
      rmSync(temporary, { force: true }); rmSync(target, { force: true }); throw error;
    }
  }
  #remove(reference: string): void {
    const path = join(this.#root, reference); if (!existsSync(path)) return;
    const stat = lstatSync(path); if (!stat.isFile() || stat.isSymbolicLink() || stat.nlink !== 1) throw new Error('Unsafe communication payload removal target');
    rmSync(path, { force: false });
  }
}

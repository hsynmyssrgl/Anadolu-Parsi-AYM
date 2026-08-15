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
import type { FamilyMeetingMinutesArtifactPort, VerifiedSealedFamilyMeetingMinutesInput } from '@ppt/application';
import type { FamilyMeetingMinutesContentView } from '@ppt/domain';
import type { FamilyMeetingMinutesRow } from '@ppt/repository-contracts';
import { ProtectedSideArtifactStore, type ProtectedSideArtifactEnvelope } from './protected-side-artifact-store.js';

const PAYLOAD_KIND = 'family-meeting-minutes-sealed-payload-v1';
const REFERENCE = /^family-meeting-minutes-[0-9a-f]{64}\.pptminutes$/u;
const IDENTIFIER = /^[A-Za-z0-9][A-Za-z0-9._:@-]{1,255}$/u;
const SHA256 = /^[0-9a-f]{64}$/u;
const CONTROL = /[\p{Cc}\p{Cf}\p{Cs}]/u;
const MAX_FILES = 4_096;
const MAX_TOTAL_BYTES = 512 * 1024 * 1024;
const MAX_ENVELOPE_BYTES = 2 * 1024 * 1024;
const MAX_PLAINTEXT_BYTES = 512 * 1024;

interface StoredFamilyMeetingMinutes {
  readonly schemaVersion: 1;
  readonly kind: typeof PAYLOAD_KIND;
  readonly familyId: string;
  readonly ownerPersonId: string;
  readonly meetingId: string;
  readonly minutesRevision: number;
  readonly summary: string;
  readonly decisions: readonly string[];
  readonly tasks: readonly string[];
  readonly participantAccessPersonIds: readonly string[];
  readonly selectedRecordingSegmentIds: readonly string[];
  readonly machineGeneratedSource: boolean;
  readonly humanApproved: boolean;
  readonly occurredAt: string;
  readonly networkUsed: false;
  readonly cloudUsed: false;
}

export interface FamilyMeetingMinutesVaultOptions {
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
const validText = (value: unknown, minimum: number, maximum: number): value is string => typeof value === 'string'
  && value === value.normalize('NFKC').trim() && value.length >= minimum && value.length <= maximum && !CONTROL.test(value);
const validStrings = (value: unknown, maximumItems: number): value is readonly string[] => Array.isArray(value)
  && value.length <= maximumItems && value.every((item) => validText(item, 2, 512)) && new Set(value).size === value.length;
const validIds = (value: unknown, minimum: number, maximum: number): value is readonly string[] => Array.isArray(value)
  && value.length >= minimum && value.length <= maximum && value.every(safeId) && new Set(value).size === value.length
  && [...value].sort().every((item, index) => item === value[index]);
const failure = (correlationId: CorrelationId, message: string): Result<never, AppError> => err(createAppError({
  code: ERROR_CODES.AUTHORIZATION_DENIED, message, category: 'security', correlationId
}));
const parseEnvelope = (raw: Buffer): ProtectedSideArtifactEnvelope => {
  const value = JSON.parse(raw.toString('utf8')) as unknown;
  if (!plain(value) || !exactKeys(value, ['schemaVersion','product','applicationVersion','kind','generatedAt','encryption'])
    || value.schemaVersion !== 1 || value.kind !== PAYLOAD_KIND || !validIso(value.generatedAt)
    || typeof value.product !== 'string' || typeof value.applicationVersion !== 'string' || !plain(value.encryption))
    throw new Error('Invalid protected family meeting minutes envelope');
  return value as unknown as ProtectedSideArtifactEnvelope;
};
const parsePayload = (bytes: Buffer): StoredFamilyMeetingMinutes => {
  const value = JSON.parse(bytes.toString('utf8')) as unknown;
  if (!plain(value) || !exactKeys(value, ['schemaVersion','kind','familyId','ownerPersonId','meetingId','minutesRevision',
    'summary','decisions','tasks','participantAccessPersonIds','selectedRecordingSegmentIds','machineGeneratedSource',
    'humanApproved','occurredAt','networkUsed','cloudUsed'])
    || value.schemaVersion !== 1 || value.kind !== PAYLOAD_KIND || !safeId(value.familyId) || !safeId(value.ownerPersonId)
    || !safeId(value.meetingId) || !Number.isSafeInteger(value.minutesRevision) || Number(value.minutesRevision) < 1
    || !validText(value.summary, 2, 32_768) || !validStrings(value.decisions, 128) || !validStrings(value.tasks, 128)
    || !validIds(value.participantAccessPersonIds, 1, 32) || !validIds(value.selectedRecordingSegmentIds, 0, 64)
    || typeof value.machineGeneratedSource !== 'boolean' || typeof value.humanApproved !== 'boolean'
    || !validIso(value.occurredAt) || value.networkUsed !== false || value.cloudUsed !== false)
    throw new Error('Invalid protected family meeting minutes payload');
  return Object.freeze(value as unknown as StoredFamilyMeetingMinutes);
};
const samePath = (left: string, right: string): boolean => process.platform === 'win32'
  ? resolve(left).toLowerCase() === resolve(right).toLowerCase() : resolve(left) === resolve(right);

export class FamilyMeetingMinutesVault implements FamilyMeetingMinutesArtifactPort {
  readonly #root: string;
  public constructor(private readonly options: FamilyMeetingMinutesVaultOptions) {
    mkdirSync(options.rootDirectory, { recursive: true, mode: 0o700 });
    const stat = lstatSync(options.rootDirectory);
    if (!stat.isDirectory() || stat.isSymbolicLink()) throw new Error('Family meeting minutes root must be a real directory');
    this.#root = realpathSync(options.rootDirectory);
  }

  public seal(input: Parameters<FamilyMeetingMinutesArtifactPort['seal']>[0]): Result<VerifiedSealedFamilyMeetingMinutesInput, AppError> {
    const access = [...input.participantAccessPersonIds].sort(); const segments = [...input.selectedRecordingSegmentIds].sort();
    if (!safeId(input.familyId) || !safeId(input.ownerPersonId) || !safeId(input.meetingId)
      || !Number.isSafeInteger(input.minutesRevision) || input.minutesRevision < 1 || !validText(input.summary, 2, 32_768)
      || !validStrings(input.decisions, 128) || !validStrings(input.tasks, 128) || !validIds(access, 1, 32)
      || !validIds(segments, 0, 64) || typeof input.machineGeneratedSource !== 'boolean'
      || typeof input.humanApproved !== 'boolean' || !validIso(input.occurredAt))
      return failure(input.correlationId, 'Toplanti tutanagi kasasi girdisi guvenlik sozlesmesine uymuyor.');
    const payload: StoredFamilyMeetingMinutes = Object.freeze({ schemaVersion: 1, kind: PAYLOAD_KIND,
      familyId: input.familyId, ownerPersonId: input.ownerPersonId, meetingId: input.meetingId,
      minutesRevision: input.minutesRevision, summary: input.summary, decisions: Object.freeze([...input.decisions]),
      tasks: Object.freeze([...input.tasks]), participantAccessPersonIds: Object.freeze(access),
      selectedRecordingSegmentIds: Object.freeze(segments), machineGeneratedSource: input.machineGeneratedSource,
      humanApproved: input.humanApproved, occurredAt: input.occurredAt, networkUsed: false, cloudUsed: false });
    const plaintext = Buffer.from(JSON.stringify(payload), 'utf8');
    try {
      if (plaintext.byteLength > MAX_PLAINTEXT_BYTES) return failure(input.correlationId, 'Toplanti tutanagi boyut sinirini asti.');
      const payloadSha256 = hash(plaintext); const envelope = this.options.protectedStore.sealBuffer(PAYLOAD_KIND, plaintext);
      const encrypted = Buffer.from(`${JSON.stringify(envelope)}\n`, 'utf8');
      const reference = `family-meeting-minutes-${hash(Buffer.from(JSON.stringify({ familyId: input.familyId,
        ownerPersonId: input.ownerPersonId, meetingId: input.meetingId, minutesRevision: input.minutesRevision,
        payloadSha256 }), 'utf8'))}.pptminutes`;
      this.#publish(reference, encrypted);
      const readback = this.#read(reference);
      try {
        if (!readback.equals(plaintext)) { this.#remove(reference); return failure(input.correlationId, 'Toplanti tutanagi readback dogrulamasi basarisiz.'); }
      } finally { readback.fill(0); }
      return ok(Object.freeze({ sealedPayloadReference: reference, payloadSha256, payloadSizeBytes: plaintext.byteLength,
        providerId: 'protected-side-artifact-store-v1', providerEvidenceSha256: hash(encrypted),
        payloadRevision: input.minutesRevision, payloadCreatedAt: input.occurredAt }));
    } catch { return failure(input.correlationId, 'Toplanti tutanagi kasasi guvenli yazimi basarisiz.'); }
    finally { plaintext.fill(0); }
  }

  public open(row: FamilyMeetingMinutesRow, actorPersonId: string, correlationId: CorrelationId)
  : Result<FamilyMeetingMinutesContentView, AppError> {
    if (row.state !== 'sealed_local' || !row.humanApprovalRecorded || !safeId(actorPersonId)
      || !row.sealedPayloadReference || !REFERENCE.test(row.sealedPayloadReference) || !row.payloadSha256
      || !SHA256.test(row.payloadSha256) || !row.providerEvidenceSha256 || !SHA256.test(row.providerEvidenceSha256)
      || row.providerId !== 'protected-side-artifact-store-v1' || row.payloadRevision === undefined
      || row.payloadSizeBytes === undefined || row.payloadCreatedAt === undefined
      || !row.participantAccessPersonIds.some((personId) => personId === actorPersonId))
      return failure(correlationId, 'Toplanti tutanagi erisim veya baglayici kaniti gecersiz.');
    let plaintext: Buffer | undefined; let encrypted: Buffer | undefined;
    try {
      encrypted = this.#raw(row.sealedPayloadReference);
      if (hash(encrypted) !== row.providerEvidenceSha256) return failure(correlationId, 'Toplanti tutanagi saglayici kaniti uyusmuyor.');
      plaintext = this.options.protectedStore.openEnvelope(parseEnvelope(encrypted));
      if (plaintext.byteLength !== row.payloadSizeBytes || hash(plaintext) !== row.payloadSha256)
        return failure(correlationId, 'Toplanti tutanagi icerik ozeti uyusmuyor.');
      const payload = parsePayload(plaintext);
      if (payload.familyId !== row.familyId || payload.ownerPersonId !== row.ownerPersonId || payload.meetingId !== row.meetingId
        || payload.minutesRevision !== row.payloadRevision || payload.occurredAt !== row.payloadCreatedAt || !payload.humanApproved
        || payload.participantAccessPersonIds.length !== row.participantAccessPersonIds.length
        || payload.participantAccessPersonIds.some((item, index) => item !== [...row.participantAccessPersonIds].sort()[index])
        || payload.selectedRecordingSegmentIds.length !== row.selectedRecordingSegmentIds.length
        || payload.selectedRecordingSegmentIds.some((item, index) => item !== [...row.selectedRecordingSegmentIds].sort()[index]))
        return failure(correlationId, 'Toplanti tutanagi kimlik, surum veya erisim bagi uyusmuyor.');
      return ok(Object.freeze({ meetingId: row.meetingId, minutesRevision: row.payloadRevision,
        summary: payload.summary, decisions: payload.decisions, tasks: payload.tasks,
        participantAccessPersonIds: payload.participantAccessPersonIds,
        selectedRecordingSegmentIds: payload.selectedRecordingSegmentIds, payloadSource: 'local_sealed_store',
        machineGeneratedSource: payload.machineGeneratedSource, humanApproved: true,
        networkUsed: false, cloudUsed: false }));
    } catch { return failure(correlationId, 'Toplanti tutanagi kasasi icerigi acilamadi.'); }
    finally { plaintext?.fill(0); encrypted?.fill(0); }
  }

  public discard(reference: string, correlationId: CorrelationId): Result<void, AppError> {
    if (!REFERENCE.test(reference)) return failure(correlationId, 'Toplanti tutanagi silme referansi gecersiz.');
    try { this.#remove(reference); return existsSync(join(this.#root, reference))
      ? failure(correlationId, 'Toplanti tutanagi silme readback dogrulamasi basarisiz.') : ok(undefined); }
    catch { return failure(correlationId, 'Toplanti tutanagi mantiksal silme islemi basarisiz.'); }
  }

  #path(reference: string): string {
    if (!REFERENCE.test(reference)) throw new Error('Invalid family meeting minutes reference');
    const path = join(this.#root, reference);
    if (!samePath(realpathSync(dirname(path)), this.#root)) throw new Error('Family meeting minutes path escaped its root');
    return path;
  }
  #raw(reference: string): Buffer {
    const path = this.#path(reference); const stat = lstatSync(path);
    if (!stat.isFile() || stat.isSymbolicLink() || stat.nlink !== 1 || stat.size < 2 || stat.size > MAX_ENVELOPE_BYTES)
      throw new Error('Family meeting minutes file metadata is invalid');
    const descriptor = openSync(path, constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0));
    try {
      const opened = fstatSync(descriptor);
      if (!opened.isFile() || opened.nlink !== 1 || opened.dev !== stat.dev || opened.ino !== stat.ino)
        throw new Error('Family meeting minutes file identity changed');
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
    if (files.length >= MAX_FILES || bytes + encrypted.byteLength > MAX_TOTAL_BYTES) throw new Error('Family meeting minutes quota exceeded');
    const target = join(this.#root, reference); if (existsSync(target)) throw new Error('Family meeting minutes no-overwrite conflict');
    const temporary = join(this.#root, `.family-meeting-minutes-${process.pid}-${randomBytes(8).toString('hex')}.tmp`);
    let descriptor: number | undefined;
    try {
      descriptor = openSync(temporary, 'wx', 0o600); writeFileSync(descriptor, encrypted); fsyncSync(descriptor);
      closeSync(descriptor); descriptor = undefined; try { chmodSync(temporary, 0o600); } catch { /* Windows ACL is authoritative. */ }
      linkSync(temporary, target); rmSync(temporary, { force: true }); try { chmodSync(target, 0o600); } catch { /* Windows ACL is authoritative. */ }
      const stat = lstatSync(target);
      if (!stat.isFile() || stat.isSymbolicLink() || stat.nlink !== 1 || stat.size !== encrypted.byteLength)
        throw new Error('Family meeting minutes publish readback failed');
    } catch (error) {
      if (descriptor !== undefined) try { closeSync(descriptor); } catch { /* best effort */ }
      rmSync(temporary, { force: true }); rmSync(target, { force: true }); throw error;
    }
  }
  #remove(reference: string): void {
    const path = join(this.#root, reference); if (!existsSync(path)) return;
    const stat = lstatSync(path);
    if (!stat.isFile() || stat.isSymbolicLink() || stat.nlink !== 1) throw new Error('Unsafe family meeting minutes removal target');
    rmSync(path, { force: false });
  }
}

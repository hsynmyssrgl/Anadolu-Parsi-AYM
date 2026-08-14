import { createHash, randomBytes } from 'node:crypto';
import { closeSync, existsSync, fstatSync, fsyncSync, lstatSync, mkdirSync, openSync, readFileSync, readdirSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import {
  ERROR_CODES,
  asCorrelationId,
  createAppError,
  err,
  ok,
  type AppError,
  type Clock,
  type Result
} from '@ppt/core';
import type { TemporaryCredentialEnvelopePort } from '@ppt/application';
import {
  TEMPORARY_CREDENTIAL_PURPOSE_BY_KIND,
  type TemporaryCredentialClaimKey,
  type TemporaryCredentialKind,
  type TemporaryCredentialPurpose
} from '@ppt/domain';
import {
  issueTemporaryVerifiableCredentialWithSigner,
  verifyTemporaryVerifiableCredential,
  type DeviceSecretProtector
} from '@ppt/security';
import type { FileDeviceIdentityProvider } from './device-identity.js';

interface StoredEnvelope {
  readonly schemaVersion: 1;
  readonly protectionId: string;
  readonly credentialIdSha256: string;
  readonly compactSha256: string;
  readonly ownerRefSha256: string;
  readonly issuerKeyId: string;
  readonly protectedCompact: string;
  readonly createdAt: string;
}

interface CanonicalDisclosure {
  readonly id: string;
  readonly kind: TemporaryCredentialKind;
  readonly purpose: TemporaryCredentialPurpose;
  readonly audienceRefSha256: string;
  readonly claims: Readonly<Record<TemporaryCredentialClaimKey, string>>;
  readonly notBefore: string;
  readonly expiresAt: string;
}

export interface ProtectedTemporaryCredentialEnvelopeOptions {
  readonly directory: string;
  readonly protector: DeviceSecretProtector;
  readonly deviceIdentity: Pick<FileDeviceIdentityProvider, 'snapshot' | 'signDetached'>;
  readonly clock: Clock;
}

const CORRELATION_ID = asCorrelationId('identity-temporary-credential-envelope');
const REF_PREFIX = 'temporary-credential-envelope:';
const SHA256 = /^[0-9a-f]{64}$/u;
export const MAX_OWNED_TEMPORARY_CREDENTIAL_ENVELOPES = 2_048;
const KINDS = new Set<TemporaryCredentialKind>([
  'school_pickup', 'temporary_caregiver', 'pet_caregiver', 'emergency_contact_health', 'event_invitation', 'temporary_home_access'
]);
const CLAIMS = new Set<TemporaryCredentialClaimKey>([
  'subject_display_name', 'authorized_person_display_name', 'caregiver_display_name', 'pet_display_name', 'school_name',
  'emergency_contact_name', 'emergency_contact_phone', 'allergy_summary', 'critical_medication_summary', 'event_title',
  'valid_location_label', 'contact_phone'
]);
const sha256 = (value: string | Uint8Array): string => createHash('sha256').update(value).digest('hex');
const validIso = (value: unknown): value is string => typeof value === 'string'
  && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/u.test(value)
  && new Date(value).toISOString() === value;

const failure = (message: string): AppError => createAppError({
  code: ERROR_CODES.CORE_UNEXPECTED,
  category: 'security',
  message,
  correlationId: CORRELATION_ID
});

const parseDisclosure = (text: string, expectedId: string, expectedSha256: string): CanonicalDisclosure => {
  if (typeof text !== 'string' || Buffer.byteLength(text, 'utf8') > 16_384 || sha256(text) !== expectedSha256) {
    throw new Error('Gecici credential disclosure hash veya boyut eslesmedi.');
  }
  let parsed: unknown;
  try { parsed = JSON.parse(text); } catch { throw new Error('Gecici credential disclosure JSON degil.'); }
  if (!Array.isArray(parsed) || parsed.length !== 8 || parsed[0] !== 2 || parsed[1] !== expectedId
    || typeof parsed[2] !== 'string' || !KINDS.has(parsed[2] as TemporaryCredentialKind)
    || typeof parsed[3] !== 'string' || parsed[3] !== TEMPORARY_CREDENTIAL_PURPOSE_BY_KIND[parsed[2] as TemporaryCredentialKind]
    || typeof parsed[4] !== 'string' || !SHA256.test(parsed[4])
    || !Array.isArray(parsed[5]) || !validIso(parsed[6]) || !validIso(parsed[7])) {
    throw new Error('Gecici credential disclosure canonical sozlesmesi gecersiz.');
  }
  const entries = parsed[5] as unknown[];
  if (entries.length < 1 || entries.length > 8) throw new Error('Gecici credential claim sayisi gecersiz.');
  const claims: Partial<Record<TemporaryCredentialClaimKey, string>> = {};
  let previous = '';
  for (const entry of entries) {
    if (!Array.isArray(entry) || entry.length !== 2 || typeof entry[0] !== 'string' || !CLAIMS.has(entry[0] as TemporaryCredentialClaimKey)
      || typeof entry[1] !== 'string' || entry[1] !== entry[1].trim() || entry[1].length < 1 || entry[1].length > 256
      || entry[0].localeCompare(previous, 'en') <= 0 || /[\u0000-\u001f\u007f]/u.test(entry[1])) {
      throw new Error('Gecici credential claim canonical degil.');
    }
    previous = entry[0];
    claims[entry[0] as TemporaryCredentialClaimKey] = entry[1];
  }
  return Object.freeze({
    id: expectedId,
    kind: parsed[2] as TemporaryCredentialKind,
    purpose: parsed[3] as TemporaryCredentialPurpose,
    audienceRefSha256: parsed[4],
    claims: Object.freeze(claims as Record<TemporaryCredentialClaimKey, string>),
    notBefore: parsed[6],
    expiresAt: parsed[7]
  });
};

const parseEnvelope = (value: unknown): StoredEnvelope => {
  if (typeof value !== 'object' || value === null || Array.isArray(value) || Object.getPrototypeOf(value) !== Object.prototype) {
    throw new Error('Gecici credential envelope nesne degil.');
  }
  const row = value as Record<string, unknown>;
  const expected = ['schemaVersion', 'protectionId', 'credentialIdSha256', 'compactSha256', 'ownerRefSha256', 'issuerKeyId', 'protectedCompact', 'createdAt'].sort();
  const actual = Object.keys(row).sort();
  if (actual.length !== expected.length || actual.some((key, index) => key !== expected[index]) || row.schemaVersion !== 1
    || typeof row.protectionId !== 'string' || !SHA256.test(String(row.credentialIdSha256))
    || !SHA256.test(String(row.compactSha256)) || !SHA256.test(String(row.ownerRefSha256)) || !SHA256.test(String(row.issuerKeyId))
    || typeof row.protectedCompact !== 'string' || !validIso(row.createdAt)) throw new Error('Gecici credential envelope gecersiz.');
  return row as unknown as StoredEnvelope;
};

export class ProtectedTemporaryCredentialEnvelopeAdapter implements TemporaryCredentialEnvelopePort {
  readonly #directory: string;

  public constructor(private readonly options: ProtectedTemporaryCredentialEnvelopeOptions) {
    if (!options.protector.isAvailable()) throw new Error('Gecici credential icin cihaz sir korumasi kullanilamiyor.');
    const requestedDirectory = resolve(options.directory);
    mkdirSync(requestedDirectory, { recursive: true, mode: 0o700 });
    const directoryStat = lstatSync(requestedDirectory);
    if (directoryStat.isSymbolicLink() || !directoryStat.isDirectory()) throw new Error('Gecici credential envelope dizini guvenli degil.');
    this.#directory = realpathSync(requestedDirectory);
  }

  public issueAndStore(input: Parameters<TemporaryCredentialEnvelopePort['issueAndStore']>[0]): ReturnType<TemporaryCredentialEnvelopePort['issueAndStore']> {
    try {
      if (!SHA256.test(input.disclosureSha256) || !SHA256.test(input.ownerRefSha256) || !validIso(input.issuedAt)) {
        throw new Error('Gecici credential binding metadata gecersiz.');
      }
      const disclosure = parseDisclosure(input.canonicalDisclosureJson, input.credentialId, input.disclosureSha256);
      const identity = this.options.deviceIdentity.snapshot();
      const issued = issueTemporaryVerifiableCredentialWithSigner({
        credentialId: input.credentialId,
        kind: disclosure.kind,
        purpose: disclosure.purpose,
        ownerRefSha256: input.ownerRefSha256,
        audienceRefSha256: disclosure.audienceRefSha256,
        disclosureSha256: input.disclosureSha256,
        issuedAt: input.issuedAt,
        notBefore: disclosure.notBefore,
        expiresAt: disclosure.expiresAt,
        nonce: randomBytes(16).toString('base64url'),
        revocationSequence: 0,
        disclosedClaims: disclosure.claims,
        allowedClaimCodes: Object.keys(disclosure.claims).sort()
      }, {
        issuerPublicKeyPem: identity.publicKeyPem,
        sign: (payload) => this.options.deviceIdentity.signDetached(payload)
      });
      const credentialIdSha256 = sha256(input.credentialId);
      const reference = `${REF_PREFIX}${credentialIdSha256}`;
      const path = this.#path(reference);
      if (existsSync(path)) throw new Error('Gecici credential envelope zaten var.');
      if (this.#ownedReferences().length >= MAX_OWNED_TEMPORARY_CREDENTIAL_ENVELOPES) {
        throw new Error('Gecici credential envelope mutlak dosya kotasi dolu.');
      }
      const envelope: StoredEnvelope = Object.freeze({
        schemaVersion: 1,
        protectionId: this.options.protector.protectionId,
        credentialIdSha256,
        compactSha256: issued.compactSha256,
        ownerRefSha256: input.ownerRefSha256,
        issuerKeyId: issued.issuerKeyId,
        protectedCompact: this.options.protector.protect(issued.compact),
        createdAt: input.issuedAt
      });
      const descriptor = openSync(path, 'wx', 0o600);
      try { writeFileSync(descriptor, `${JSON.stringify(envelope)}\n`, 'utf8'); fsyncSync(descriptor); }
      finally { closeSync(descriptor); }
      const readback = parseEnvelope(JSON.parse(readFileSync(path, 'utf8')) as unknown);
      const compact = this.options.protector.unprotect(readback.protectedCompact);
      if (readback.protectionId !== this.options.protector.protectionId || readback.ownerRefSha256 !== input.ownerRefSha256 || compact !== issued.compact
        || sha256(compact) !== readback.compactSha256 || readback.issuerKeyId !== issued.issuerKeyId) {
        rmSync(path, { force: true });
        throw new Error('Gecici credential envelope readback dogrulanamadi.');
      }
      return ok(Object.freeze({
        qrPayload: issued.compact,
        payloadSha256: issued.compactSha256,
        signatureSha256: issued.signatureSha256,
        issuerKeyId: issued.issuerKeyId,
        issuerPublicKeySha256: issued.issuerPublicKeySha256,
        signatureAlgorithm: 'Ed25519',
        disclosureSha256: issued.disclosureSha256,
        encryptedEnvelopeReference: reference,
        containsOnlyCanonicalDisclosure: true
      }));
    } catch { return err(failure('Gecici credential imzalanamadi veya sifreli envelope saklanamadi.')); }
  }

  public listOwnedEnvelopeReferences(ownerRefSha256: string): ReturnType<NonNullable<TemporaryCredentialEnvelopePort['listOwnedEnvelopeReferences']>> {
    if (!SHA256.test(ownerRefSha256)) throw new Error('Gecici credential envelope owner binding gecersiz.');
    return Object.freeze(this.#ownedReferences().flatMap((reference) => {
      const envelope = this.#readVerifiedEnvelope(reference);
      return envelope.ownerRefSha256 === ownerRefSha256
        ? [Object.freeze({ encryptedEnvelopeReference: reference, createdAt: envelope.createdAt as ReturnType<Clock['now']> })]
        : [];
    }));
  }

  public discardEncryptedEnvelope(reference: string, expectedOwnerRefSha256?: string): void {
    if (expectedOwnerRefSha256 !== undefined && !SHA256.test(expectedOwnerRefSha256)) {
      throw new Error('Gecici credential envelope owner binding gecersiz.');
    }
    const path = this.#path(reference);
    if (!existsSync(path)) return;
    const before = lstatSync(path);
    if (before.isSymbolicLink() || !before.isFile() || before.nlink !== 1) throw new Error('Gecici credential envelope dosya sahipligi guvenli degil.');
    const descriptor = openSync(path, 'r');
    try {
      const opened = fstatSync(descriptor);
      if (!opened.isFile() || opened.nlink !== 1 || opened.dev !== before.dev || opened.ino !== before.ino) {
        throw new Error('Gecici credential envelope dosyasi yarista degisti.');
      }
      const envelope = parseEnvelope(JSON.parse(readFileSync(descriptor, 'utf8')) as unknown);
      const expectedDigest = reference.slice(REF_PREFIX.length);
      if (envelope.credentialIdSha256 !== expectedDigest) throw new Error('Gecici credential envelope referans baglamasi gecersiz.');
      this.#verifyEnvelopeBinding(envelope);
      if (expectedOwnerRefSha256 !== undefined && envelope.ownerRefSha256 !== expectedOwnerRefSha256) {
        throw new Error('Gecici credential envelope foreign owner binding ile silinemez.');
      }
    } finally { closeSync(descriptor); }
    const after = lstatSync(path);
    if (after.isSymbolicLink() || !after.isFile() || after.nlink !== 1 || after.dev !== before.dev || after.ino !== before.ino) {
      throw new Error('Gecici credential envelope silme oncesi yarista degisti.');
    }
    rmSync(path);
    if (existsSync(path)) throw new Error('Gecici credential envelope silme readback dogrulamasi basarisiz.');
  }

  public verifyOffline(qrPayload: string, expectedAudienceRefSha256: string): ReturnType<TemporaryCredentialEnvelopePort['verifyOffline']> {
    try {
      const verified = verifyTemporaryVerifiableCredential({
        compact: qrPayload,
        expectedAudienceRefSha256,
        observedAt: this.options.clock.now()
      });
      return ok(Object.freeze({
        credentialId: verified.credentialId,
        kind: verified.kind,
        payloadSha256: verified.payloadSha256,
        issuerPublicKeySha256: verified.issuerPublicKeySha256,
        audienceRefSha256: verified.audienceRefSha256,
        notBefore: verified.notBefore as ReturnType<Clock['now']>,
        expiresAt: verified.expiresAt as ReturnType<Clock['now']>,
        disclosedClaimKeys: Object.freeze(verified.disclosedClaimCodes as TemporaryCredentialClaimKey[]),
        signatureValid: verified.signatureValid,
        disclosureValid: verified.disclosureValid,
        audienceMatched: verified.audienceMatched,
        issuerIdentityCertified: false,
        networkUsed: false
      }));
    } catch { return err(failure('Gecici credential offline imzasi veya canonical disclosure dogrulanamadi.')); }
  }

  #path(reference: string): string {
    if (typeof reference !== 'string' || !reference.startsWith(REF_PREFIX)) throw new Error('Gecici credential envelope referansi gecersiz.');
    const digest = reference.slice(REF_PREFIX.length);
    if (!SHA256.test(digest)) throw new Error('Gecici credential envelope referansi gecersiz.');
    const path = resolve(this.#directory, `${digest}.json`);
    if (dirname(path) !== this.#directory || realpathSync(dirname(path)) !== this.#directory) throw new Error('Gecici credential envelope yolu kapsami asti.');
    if (existsSync(path)) {
      const stat = lstatSync(path);
      if (stat.isSymbolicLink() || !stat.isFile() || stat.nlink !== 1) throw new Error('Gecici credential envelope dosyasi sahipli dizinde degil.');
    }
    return path;
  }

  #ownedReferences(): readonly string[] {
    const entries = readdirSync(this.#directory, { withFileTypes: true });
    if (entries.length > MAX_OWNED_TEMPORARY_CREDENTIAL_ENVELOPES) {
      throw new Error('Gecici credential envelope mutlak dosya kotasi asildi.');
    }
    const references: string[] = [];
    for (const entry of entries) {
      const match = /^([0-9a-f]{64})\.json$/u.exec(entry.name);
      if (!entry.isFile() || entry.isSymbolicLink() || !match) {
        throw new Error('Gecici credential envelope sahipli dizin envanteri guvenli degil.');
      }
      const reference = `${REF_PREFIX}${match[1]}`;
      this.#path(reference);
      references.push(reference);
    }
    references.sort();
    return Object.freeze(references);
  }

  #readVerifiedEnvelope(reference: string): StoredEnvelope {
    const path = this.#path(reference);
    const before = lstatSync(path);
    const descriptor = openSync(path, 'r');
    try {
      const opened = fstatSync(descriptor);
      if (!opened.isFile() || opened.nlink !== 1 || opened.dev !== before.dev || opened.ino !== before.ino) {
        throw new Error('Gecici credential envelope dosya sahipligi guvenli degil.');
      }
      const envelope = parseEnvelope(JSON.parse(readFileSync(descriptor, 'utf8')) as unknown);
      if (envelope.credentialIdSha256 !== reference.slice(REF_PREFIX.length)) {
        throw new Error('Gecici credential envelope referans baglamasi gecersiz.');
      }
      this.#verifyEnvelopeBinding(envelope);
      return envelope;
    } finally { closeSync(descriptor); }
  }

  #verifyEnvelopeBinding(envelope: StoredEnvelope): void {
    if (envelope.protectionId !== this.options.protector.protectionId) throw new Error('Gecici credential envelope protection binding gecersiz.');
    const compact = this.options.protector.unprotect(envelope.protectedCompact);
    if (sha256(compact) !== envelope.compactSha256) throw new Error('Gecici credential envelope compact binding gecersiz.');
    const pieces = compact.split('.');
    if (pieces.length !== 3 || pieces[0] !== 'pptvc1') throw new Error('Gecici credential envelope compact formati gecersiz.');
    let payload: unknown;
    try { payload = JSON.parse(Buffer.from(pieces[1]!, 'base64url').toString('utf8')); }
    catch { throw new Error('Gecici credential envelope compact payload gecersiz.'); }
    if (typeof payload !== 'object' || payload === null || Array.isArray(payload)) throw new Error('Gecici credential envelope compact payload gecersiz.');
    const audienceRefSha256 = (payload as Record<string, unknown>).audienceRefSha256;
    if (typeof audienceRefSha256 !== 'string' || !SHA256.test(audienceRefSha256)) throw new Error('Gecici credential envelope audience binding gecersiz.');
    const verified = verifyTemporaryVerifiableCredential({ compact, expectedAudienceRefSha256: audienceRefSha256, observedAt: this.options.clock.now() });
    if (verified.ownerRefSha256 !== envelope.ownerRefSha256 || verified.issuedAt !== envelope.createdAt
      || verified.credentialId === '' || sha256(verified.credentialId) !== envelope.credentialIdSha256) {
      throw new Error('Gecici credential envelope owner veya credential binding gecersiz.');
    }
  }
}

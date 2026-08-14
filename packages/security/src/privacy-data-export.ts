import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
  scryptSync,
  timingSafeEqual
} from 'node:crypto';

export const PRIVACY_DATA_EXPORT_FORMAT = 'ppt-privacy-data-export' as const;
export const PRIVACY_DATA_EXPORT_VERSION = 1 as const;
export const PRIVACY_DATA_EXPORT_MAX_PLAINTEXT_BYTES = 32 * 1024 * 1024;
export const PRIVACY_DATA_EXPORT_MAX_CONTAINER_BYTES = 50 * 1024 * 1024;
export const PRIVACY_DATA_EXPORT_SCRYPT_N = 32768 as const;
export const PRIVACY_DATA_EXPORT_SCRYPT_R = 8 as const;
export const PRIVACY_DATA_EXPORT_SCRYPT_P = 1 as const;

const KEY_BYTES = 32;
const SALT_BYTES = 32;
const IV_BYTES = 12;
const TAG_BYTES = 16;
const MAX_IDENTIFIER_LENGTH = 256;

export interface PrivacyDataExportMetadata {
  readonly accountId: string;
  readonly familyId: string;
  readonly ownerPersonId: string;
  readonly requestId: string;
  readonly scopeSha256: string;
  readonly lineageSha256: string;
  readonly createdAt: string;
}

export interface PrivacyDataExportEnvelope {
  readonly format: typeof PRIVACY_DATA_EXPORT_FORMAT;
  readonly version: typeof PRIVACY_DATA_EXPORT_VERSION;
  readonly metadata: PrivacyDataExportMetadata & {
    readonly plaintextSha256: string;
    readonly plaintextSizeBytes: number;
  };
  readonly keyDerivation: {
    readonly algorithm: 'scrypt';
    readonly salt: string;
    readonly n: 32768;
    readonly r: 8;
    readonly p: 1;
    readonly keyLength: 32;
  };
  readonly keyWrap: {
    readonly algorithm: 'aes-256-gcm';
    readonly iv: string;
    readonly authTag: string;
    readonly wrappedDek: string;
  };
  readonly payload: {
    readonly algorithm: 'aes-256-gcm';
    readonly iv: string;
    readonly authTag: string;
    readonly ciphertext: string;
  };
}

export interface PrivacyDataExportDecryptionResult {
  readonly plaintext: Buffer;
  readonly plaintextSha256: string;
  readonly plaintextSizeBytes: number;
  readonly metadata: PrivacyDataExportMetadata;
}

export interface PrivacyDataExportReadbackResult {
  readonly verified: true;
  readonly artifactSha256: string;
  readonly artifactSizeBytes: number;
  readonly plaintextSha256: string;
  readonly plaintextSizeBytes: number;
  readonly metadata: PrivacyDataExportMetadata;
}

const isPlainRecord = (value: unknown): value is Record<string, unknown> => {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
};

const exactKeys = (value: Record<string, unknown>, expected: readonly string[]): boolean => {
  const actual = Object.keys(value).sort();
  const sortedExpected = [...expected].sort();
  return actual.length === sortedExpected.length && actual.every((key, index) => key === sortedExpected[index]);
};

const sha256Hex = (value: Uint8Array): string => createHash('sha256').update(value).digest('hex');
const validSha256 = (value: unknown): value is string => typeof value === 'string' && /^[0-9a-f]{64}$/u.test(value);
const validIdentifier = (value: unknown): value is string => typeof value === 'string'
  && value === value.trim()
  && value.length >= 2
  && value.length <= MAX_IDENTIFIER_LENGTH
  && !/[\u0000-\u001f\u007f\\/]/u.test(value);
const validIsoDateTime = (value: unknown): value is string => typeof value === 'string'
  && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/u.test(value)
  && new Date(value).toISOString() === value;

const validMetadata = (value: unknown): value is PrivacyDataExportMetadata => isPlainRecord(value)
  && exactKeys(value, ['accountId', 'familyId', 'ownerPersonId', 'requestId', 'scopeSha256', 'lineageSha256', 'createdAt'])
  && validIdentifier(value.accountId)
  && validIdentifier(value.familyId)
  && validIdentifier(value.ownerPersonId)
  && validIdentifier(value.requestId)
  && validSha256(value.scopeSha256)
  && validSha256(value.lineageSha256)
  && validIsoDateTime(value.createdAt);

const canonicalJson = (value: unknown, ancestors: Set<object>): string => {
  if (value === null || typeof value === 'boolean' || typeof value === 'string') return JSON.stringify(value);
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new Error('Gizlilik dışa aktarım JSON sayısı sonlu olmalıdır.');
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    if (ancestors.has(value)) throw new Error('Gizlilik dışa aktarım JSON değeri döngüsel olamaz.');
    ancestors.add(value);
    try { return `[${value.map((item) => canonicalJson(item, ancestors)).join(',')}]`; }
    finally { ancestors.delete(value); }
  }
  if (!isPlainRecord(value)) throw new Error('Gizlilik dışa aktarımı yalnız düz JSON değerleri içerebilir.');
  if (ancestors.has(value)) throw new Error('Gizlilik dışa aktarım JSON değeri döngüsel olamaz.');
  ancestors.add(value);
  try {
    return `{${Object.keys(value).sort().map((key) => {
      if (/^(?:__proto__|prototype|constructor)$/u.test(key)) throw new Error('Gizlilik dışa aktarım JSON anahtarı yasaktır.');
      const item = value[key];
      if (item === undefined || typeof item === 'bigint' || typeof item === 'function' || typeof item === 'symbol') {
        throw new Error('Gizlilik dışa aktarımı yalnız JSON değerleri içerebilir.');
      }
      return `${JSON.stringify(key)}:${canonicalJson(item, ancestors)}`;
    }).join(',')}}`;
  } finally { ancestors.delete(value); }
};

export const canonicalizePrivacyDataExport = (value: unknown): string => canonicalJson(value, new Set());

export const normalizePrivacyDataExportPassphrase = (passphrase: string): string => {
  if (typeof passphrase !== 'string') throw new Error('Gizlilik dışa aktarım parolası metin olmalıdır.');
  const normalized = passphrase.normalize('NFKC');
  const length = [...normalized].length;
  if (normalized !== normalized.trim()
    || length < 12
    || length > 1024
    || /[\u0000-\u001f\u007f]/u.test(normalized)
    || /^\p{Decimal_Number}+$/u.test(normalized)) {
    throw new Error('Gizlilik dışa aktarım parolası NFKC, 12-1024 karakter, boşluksuz ve yalnız sayısal olmayan bir değer olmalıdır.');
  }
  return normalized;
};

const decodeExactBase64 = (value: unknown, expectedBytes?: number): Buffer => {
  if (typeof value !== 'string' || value.length < 4 || value.length % 4 !== 0
    || !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/u.test(value)) {
    throw new Error('Gizlilik dışa aktarım base64 alanı canonical değildir.');
  }
  const decoded = Buffer.from(value, 'base64');
  if (decoded.toString('base64') !== value || (expectedBytes !== undefined && decoded.length !== expectedBytes)) {
    decoded.fill(0);
    throw new Error('Gizlilik dışa aktarım base64 alanı geçersizdir.');
  }
  return decoded;
};

const authenticatedMetadata = (metadata: PrivacyDataExportEnvelope['metadata']): Buffer => Buffer.from(canonicalizePrivacyDataExport({
  format: PRIVACY_DATA_EXPORT_FORMAT,
  version: PRIVACY_DATA_EXPORT_VERSION,
  accountId: metadata.accountId,
  familyId: metadata.familyId,
  ownerPersonId: metadata.ownerPersonId,
  requestId: metadata.requestId,
  scopeSha256: metadata.scopeSha256,
  lineageSha256: metadata.lineageSha256,
  createdAt: metadata.createdAt,
  plaintextSha256: metadata.plaintextSha256,
  plaintextSizeBytes: metadata.plaintextSizeBytes
}), 'utf8');

const encryptComponent = (plaintext: Uint8Array, key: Uint8Array, aad: Uint8Array) => {
  const iv = randomBytes(IV_BYTES);
  let ciphertext: Buffer | undefined;
  try {
    const cipher = createCipheriv('aes-256-gcm', key, iv);
    cipher.setAAD(aad);
    ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
    return { iv: iv.toString('base64'), authTag: cipher.getAuthTag().toString('base64'), ciphertext };
  } finally { iv.fill(0); }
};

const decryptComponent = (ciphertext: Buffer, key: Uint8Array, iv: Buffer, tag: Buffer, aad: Uint8Array): Buffer => {
  let prefix: Buffer | undefined;
  let final: Buffer | undefined;
  try {
    const decipher = createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAAD(aad);
    decipher.setAuthTag(tag);
    prefix = decipher.update(ciphertext);
    final = decipher.final();
    return Buffer.concat([prefix, final]);
  } finally { prefix?.fill(0); final?.fill(0); }
};

export const encryptPrivacyDataExport = (input: {
  readonly value: unknown;
  readonly passphrase: string;
  readonly metadata: PrivacyDataExportMetadata;
}): Buffer => {
  if (!validMetadata(input.metadata)) throw new Error('Gizlilik dışa aktarım metadata alanları geçersizdir.');
  const passphrase = normalizePrivacyDataExportPassphrase(input.passphrase);
  const plaintext = Buffer.from(canonicalizePrivacyDataExport(input.value), 'utf8');
  if (plaintext.length < 1 || plaintext.length > PRIVACY_DATA_EXPORT_MAX_PLAINTEXT_BYTES) {
    plaintext.fill(0);
    throw new Error('Gizlilik dışa aktarım plaintext boyutu 1 bayt ile 32 MiB arasında olmalıdır.');
  }
  const metadata = Object.freeze({ ...input.metadata, plaintextSha256: sha256Hex(plaintext), plaintextSizeBytes: plaintext.length });
  const aad = authenticatedMetadata(metadata);
  const wrapAad = Buffer.concat([aad, Buffer.from('\nkey-wrap', 'utf8')]);
  const payloadAad = Buffer.concat([aad, Buffer.from('\npayload', 'utf8')]);
  const salt = randomBytes(SALT_BYTES);
  const dek = randomBytes(KEY_BYTES);
  let kek: Buffer | undefined;
  let wrapped: ReturnType<typeof encryptComponent> | undefined;
  let payload: ReturnType<typeof encryptComponent> | undefined;
  try {
    kek = scryptSync(passphrase, salt, KEY_BYTES, { N: PRIVACY_DATA_EXPORT_SCRYPT_N, r: PRIVACY_DATA_EXPORT_SCRYPT_R, p: PRIVACY_DATA_EXPORT_SCRYPT_P, maxmem: 64 * 1024 * 1024 });
    wrapped = encryptComponent(dek, kek, wrapAad);
    payload = encryptComponent(plaintext, dek, payloadAad);
    const envelope: PrivacyDataExportEnvelope = {
      format: PRIVACY_DATA_EXPORT_FORMAT,
      version: PRIVACY_DATA_EXPORT_VERSION,
      metadata,
      keyDerivation: { algorithm: 'scrypt', salt: salt.toString('base64'), n: 32768, r: 8, p: 1, keyLength: 32 },
      keyWrap: { algorithm: 'aes-256-gcm', iv: wrapped.iv, authTag: wrapped.authTag, wrappedDek: wrapped.ciphertext.toString('base64') },
      payload: { algorithm: 'aes-256-gcm', iv: payload.iv, authTag: payload.authTag, ciphertext: payload.ciphertext.toString('base64') }
    };
    const serialized = Buffer.from(canonicalizePrivacyDataExport(envelope), 'utf8');
    if (serialized.length > PRIVACY_DATA_EXPORT_MAX_CONTAINER_BYTES) {
      serialized.fill(0);
      throw new Error('Gizlilik dışa aktarım konteyneri 50 MiB sınırını aştı.');
    }
    return serialized;
  } finally {
    plaintext.fill(0); salt.fill(0); dek.fill(0); kek?.fill(0); aad.fill(0); wrapAad.fill(0); payloadAad.fill(0);
    wrapped?.ciphertext.fill(0); payload?.ciphertext.fill(0);
  }
};

export const parsePrivacyDataExport = (serialized: Uint8Array): PrivacyDataExportEnvelope => {
  if (serialized.byteLength < 2 || serialized.byteLength > PRIVACY_DATA_EXPORT_MAX_CONTAINER_BYTES) throw new Error('Gizlilik dışa aktarım konteyner boyutu geçersizdir.');
  const text = Buffer.from(serialized).toString('utf8');
  let parsed: unknown;
  try { parsed = JSON.parse(text); } catch { throw new Error('Gizlilik dışa aktarım JSON biçimi geçersizdir.'); }
  if (!isPlainRecord(parsed)
    || !exactKeys(parsed, ['format', 'version', 'metadata', 'keyDerivation', 'keyWrap', 'payload'])
    || parsed.format !== PRIVACY_DATA_EXPORT_FORMAT || parsed.version !== PRIVACY_DATA_EXPORT_VERSION
    || !isPlainRecord(parsed.metadata)
    || !exactKeys(parsed.metadata, ['accountId','familyId','ownerPersonId','requestId','scopeSha256','lineageSha256','createdAt','plaintextSha256','plaintextSizeBytes'])
    || !validMetadata({ accountId: parsed.metadata.accountId, familyId: parsed.metadata.familyId, ownerPersonId: parsed.metadata.ownerPersonId, requestId: parsed.metadata.requestId, scopeSha256: parsed.metadata.scopeSha256, lineageSha256: parsed.metadata.lineageSha256, createdAt: parsed.metadata.createdAt })
    || !validSha256(parsed.metadata.plaintextSha256) || !Number.isSafeInteger(parsed.metadata.plaintextSizeBytes)
    || (parsed.metadata.plaintextSizeBytes as number) < 1 || (parsed.metadata.plaintextSizeBytes as number) > PRIVACY_DATA_EXPORT_MAX_PLAINTEXT_BYTES
    || !isPlainRecord(parsed.keyDerivation) || !exactKeys(parsed.keyDerivation, ['algorithm','salt','n','r','p','keyLength'])
    || parsed.keyDerivation.algorithm !== 'scrypt' || parsed.keyDerivation.n !== 32768 || parsed.keyDerivation.r !== 8 || parsed.keyDerivation.p !== 1 || parsed.keyDerivation.keyLength !== 32
    || !isPlainRecord(parsed.keyWrap) || !exactKeys(parsed.keyWrap, ['algorithm','iv','authTag','wrappedDek']) || parsed.keyWrap.algorithm !== 'aes-256-gcm'
    || !isPlainRecord(parsed.payload) || !exactKeys(parsed.payload, ['algorithm','iv','authTag','ciphertext']) || parsed.payload.algorithm !== 'aes-256-gcm'
    || canonicalizePrivacyDataExport(parsed) !== text) throw new Error('Gizlilik dışa aktarım sözleşmesi veya canonical JSON biçimi geçersizdir.');
  const envelope = parsed as unknown as PrivacyDataExportEnvelope;
  const buffers: Buffer[] = [];
  try {
    buffers.push(decodeExactBase64(envelope.keyDerivation.salt, SALT_BYTES));
    buffers.push(decodeExactBase64(envelope.keyWrap.iv, IV_BYTES));
    buffers.push(decodeExactBase64(envelope.keyWrap.authTag, TAG_BYTES));
    buffers.push(decodeExactBase64(envelope.keyWrap.wrappedDek, KEY_BYTES));
    buffers.push(decodeExactBase64(envelope.payload.iv, IV_BYTES));
    buffers.push(decodeExactBase64(envelope.payload.authTag, TAG_BYTES));
    buffers.push(decodeExactBase64(envelope.payload.ciphertext));
    if (buffers[6]!.length !== envelope.metadata.plaintextSizeBytes) throw new Error('Gizlilik dışa aktarım ciphertext boyutu metadata ile eşleşmiyor.');
  } finally { for (const buffer of buffers) buffer.fill(0); }
  return envelope;
};

export const decryptPrivacyDataExport = (serialized: Uint8Array, passphrase: string): PrivacyDataExportDecryptionResult => {
  const envelope = parsePrivacyDataExport(serialized);
  const normalized = normalizePrivacyDataExportPassphrase(passphrase);
  const aad = authenticatedMetadata(envelope.metadata);
  const wrapAad = Buffer.concat([aad, Buffer.from('\nkey-wrap', 'utf8')]);
  const payloadAad = Buffer.concat([aad, Buffer.from('\npayload', 'utf8')]);
  let salt: Buffer | undefined; let wrapIv: Buffer | undefined; let wrapTag: Buffer | undefined; let wrappedDek: Buffer | undefined;
  let payloadIv: Buffer | undefined; let payloadTag: Buffer | undefined; let ciphertext: Buffer | undefined;
  let kek: Buffer | undefined; let dek: Buffer | undefined; let plaintext: Buffer | undefined;
  try {
    salt = decodeExactBase64(envelope.keyDerivation.salt, SALT_BYTES);
    wrapIv = decodeExactBase64(envelope.keyWrap.iv, IV_BYTES); wrapTag = decodeExactBase64(envelope.keyWrap.authTag, TAG_BYTES);
    wrappedDek = decodeExactBase64(envelope.keyWrap.wrappedDek, KEY_BYTES);
    payloadIv = decodeExactBase64(envelope.payload.iv, IV_BYTES); payloadTag = decodeExactBase64(envelope.payload.authTag, TAG_BYTES);
    ciphertext = decodeExactBase64(envelope.payload.ciphertext);
    kek = scryptSync(normalized, salt, KEY_BYTES, { N: 32768, r: 8, p: 1, maxmem: 64 * 1024 * 1024 });
    dek = decryptComponent(wrappedDek, kek, wrapIv, wrapTag, wrapAad);
    if (dek.length !== KEY_BYTES) throw new Error('Gizlilik dışa aktarım DEK boyutu geçersizdir.');
    plaintext = decryptComponent(ciphertext, dek, payloadIv, payloadTag, payloadAad);
    const actual = Buffer.from(sha256Hex(plaintext), 'hex');
    const expected = Buffer.from(envelope.metadata.plaintextSha256, 'hex');
    const valid = actual.length === expected.length && timingSafeEqual(actual, expected) && plaintext.length === envelope.metadata.plaintextSizeBytes;
    actual.fill(0); expected.fill(0);
    if (!valid) throw new Error('Gizlilik dışa aktarım plaintext readback doğrulaması başarısızdır.');
    const parsed = JSON.parse(plaintext.toString('utf8')) as unknown;
    if (canonicalizePrivacyDataExport(parsed) !== plaintext.toString('utf8')) throw new Error('Gizlilik dışa aktarım plaintext canonical değildir.');
    const result = plaintext; plaintext = undefined;
    return Object.freeze({ plaintext: result, plaintextSha256: envelope.metadata.plaintextSha256, plaintextSizeBytes: envelope.metadata.plaintextSizeBytes, metadata: Object.freeze({ accountId: envelope.metadata.accountId, familyId: envelope.metadata.familyId, ownerPersonId: envelope.metadata.ownerPersonId, requestId: envelope.metadata.requestId, scopeSha256: envelope.metadata.scopeSha256, lineageSha256: envelope.metadata.lineageSha256, createdAt: envelope.metadata.createdAt }) });
  } finally {
    salt?.fill(0); wrapIv?.fill(0); wrapTag?.fill(0); wrappedDek?.fill(0); payloadIv?.fill(0); payloadTag?.fill(0); ciphertext?.fill(0);
    kek?.fill(0); dek?.fill(0); plaintext?.fill(0); aad.fill(0); wrapAad.fill(0); payloadAad.fill(0);
  }
};

export const verifyPrivacyDataExportReadback = (input: { readonly serialized: Uint8Array; readonly passphrase: string; readonly expectedMetadata: PrivacyDataExportMetadata; readonly expectedPlaintextSha256?: string }): PrivacyDataExportReadbackResult => {
  if (!validMetadata(input.expectedMetadata) || (input.expectedPlaintextSha256 !== undefined && !validSha256(input.expectedPlaintextSha256))) throw new Error('Gizlilik dışa aktarım readback beklentisi geçersizdir.');
  const decrypted = decryptPrivacyDataExport(input.serialized, input.passphrase);
  try {
    if (canonicalizePrivacyDataExport(decrypted.metadata) !== canonicalizePrivacyDataExport(input.expectedMetadata)
      || (input.expectedPlaintextSha256 !== undefined && decrypted.plaintextSha256 !== input.expectedPlaintextSha256)) {
      throw new Error('Gizlilik dışa aktarım readback beklentisi eşleşmiyor.');
    }
    return Object.freeze({ verified: true, artifactSha256: sha256Hex(input.serialized), artifactSizeBytes: input.serialized.byteLength, plaintextSha256: decrypted.plaintextSha256, plaintextSizeBytes: decrypted.plaintextSizeBytes, metadata: decrypted.metadata });
  } finally { decrypted.plaintext.fill(0); }
};

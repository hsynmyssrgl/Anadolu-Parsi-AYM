import {
  createCipheriv,
  createDecipheriv,
  createHash,
  createPrivateKey,
  createPublicKey,
  diffieHellman,
  generateKeyPairSync,
  hkdfSync,
  randomBytes
} from 'node:crypto';

export const COMPANION_SYNC_FORMAT = 'ppt-companion-read-only-sync' as const;
export const COMPANION_SYNC_VERSION = 1 as const;
export const COMPANION_SYNC_MAX_PLAINTEXT_BYTES = 8 * 1024 * 1024;

export interface CompanionSyncMetadata {
  readonly protocolVersion: 1;
  readonly sourceVersion: number;
  readonly schemaVersion: number;
  readonly securityEpoch: number;
  readonly trustedDeviceId: string;
  readonly ownerBindingSha256: string;
  readonly generatedAt: string;
  readonly expiresAt: string;
  readonly sourceAuthority: 'windows_single_writer';
  readonly readOnly: true;
  readonly remoteWritesAccepted: false;
  readonly conflictResolution: 'reject_remote_and_refresh';
  readonly networkDelivery: 'not_performed';
}

export interface CompanionSyncEnvelope {
  readonly format: typeof COMPANION_SYNC_FORMAT;
  readonly version: typeof COMPANION_SYNC_VERSION;
  readonly metadata: CompanionSyncMetadata;
  readonly keyAgreement: 'X25519-HKDF-SHA256';
  readonly encryption: 'AES-256-GCM';
  readonly ephemeralPublicKeySpkiBase64Url: string;
  readonly saltBase64Url: string;
  readonly ivBase64Url: string;
  readonly ciphertextBase64Url: string;
  readonly authTagBase64Url: string;
}

export interface EncryptedCompanionSyncResult {
  readonly envelopeBase64Url: string;
  readonly ciphertextSha256: string;
  readonly envelopeSha256: string;
  readonly envelopeBytes: number;
  readonly metadata: CompanionSyncMetadata;
}

const sha256 = (value: Uint8Array | string): string => createHash('sha256').update(value).digest('hex');
const SHA256 = /^[0-9a-f]{64}$/u;
const validIso = (value: string): boolean => /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/u.test(value)
  && new Date(value).toISOString() === value;
const isPlainRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object'
  && value !== null && !Array.isArray(value) && Object.getPrototypeOf(value) === Object.prototype;

const canonicalJson = (value: unknown, depth = 0): string => {
  if (depth > 32) throw new Error('Companion snapshot JSON derinligi asti.');
  if (value === null || typeof value === 'boolean' || typeof value === 'string') return JSON.stringify(value);
  if (typeof value === 'number' && Number.isFinite(value)) return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map((entry) => canonicalJson(entry, depth + 1)).join(',')}]`;
  if (!isPlainRecord(value)) throw new Error('Companion snapshot yalniz duz JSON icerebilir.');
  return `{${Object.keys(value).sort().map((key) => {
    if (/^(?:__proto__|prototype|constructor)$/u.test(key)) throw new Error('Companion snapshot prototype anahtari yasak.');
    return `${JSON.stringify(key)}:${canonicalJson(value[key], depth + 1)}`;
  }).join(',')}}`;
};

const validateMetadata = (value: CompanionSyncMetadata): void => {
  if (value.protocolVersion !== 1 || !Number.isSafeInteger(value.sourceVersion) || value.sourceVersion < 0
    || !Number.isSafeInteger(value.schemaVersion) || value.schemaVersion < 1
    || !Number.isSafeInteger(value.securityEpoch) || value.securityEpoch < 0 || value.securityEpoch > 2_147_483_647
    || typeof value.trustedDeviceId !== 'string' || value.trustedDeviceId.length < 8 || value.trustedDeviceId.length > 160
    || !SHA256.test(value.ownerBindingSha256) || !validIso(value.generatedAt) || !validIso(value.expiresAt)
    || Date.parse(value.expiresAt) <= Date.parse(value.generatedAt) || Date.parse(value.expiresAt) - Date.parse(value.generatedAt) > 24 * 60 * 60 * 1000
    || value.sourceAuthority !== 'windows_single_writer' || value.readOnly !== true || value.remoteWritesAccepted !== false
    || value.conflictResolution !== 'reject_remote_and_refresh' || value.networkDelivery !== 'not_performed') {
    throw new Error('Companion snapshot metadata gecersiz.');
  }
};

const decode = (value: string, label: string, maximum: number): Buffer => {
  if (typeof value !== 'string' || value.length === 0 || value.includes('=') || !/^[A-Za-z0-9_-]+$/u.test(value)) {
    throw new Error(`${label} canonical base64url degil.`);
  }
  const bytes = Buffer.from(value, 'base64url');
  if (bytes.length === 0 || bytes.length > maximum || bytes.toString('base64url') !== value) {
    bytes.fill(0); throw new Error(`${label} gecersiz.`);
  }
  return bytes;
};

const x25519Public = (spkiBase64Url: string) => {
  const bytes = decode(spkiBase64Url, 'Companion recipient key', 256);
  try {
    const key = createPublicKey({ key: bytes, format: 'der', type: 'spki' });
    if (key.type !== 'public' || key.asymmetricKeyType !== 'x25519') throw new Error('Companion recipient key X25519 degil.');
    return key;
  } finally { bytes.fill(0); }
};

export const encryptCompanionSyncEnvelope = (input: {
  readonly metadata: CompanionSyncMetadata;
  readonly snapshot: unknown;
  readonly recipientPublicKeySpkiBase64Url: string;
}): EncryptedCompanionSyncResult => {
  validateMetadata(input.metadata);
  const plaintext = Buffer.from(canonicalJson(input.snapshot), 'utf8');
  if (plaintext.length < 2 || plaintext.length > COMPANION_SYNC_MAX_PLAINTEXT_BYTES) {
    plaintext.fill(0); throw new Error('Companion snapshot plaintext boyutu gecersiz.');
  }
  const recipient = x25519Public(input.recipientPublicKeySpkiBase64Url);
  const ephemeral = generateKeyPairSync('x25519');
  const shared = diffieHellman({ privateKey: ephemeral.privateKey, publicKey: recipient });
  const salt = randomBytes(32);
  const iv = randomBytes(12);
  const aad = Buffer.from(canonicalJson(input.metadata), 'utf8');
  const key = Buffer.from(hkdfSync('sha256', shared, salt, aad, 32));
  try {
    const cipher = createCipheriv('aes-256-gcm', key, iv);
    cipher.setAAD(aad);
    const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
    const authTag = cipher.getAuthTag();
    const ephemeralPublicKeySpkiBase64Url = ephemeral.publicKey.export({ type: 'spki', format: 'der' }).toString('base64url');
    const envelope: CompanionSyncEnvelope = Object.freeze({
      format: COMPANION_SYNC_FORMAT,
      version: COMPANION_SYNC_VERSION,
      metadata: input.metadata,
      keyAgreement: 'X25519-HKDF-SHA256',
      encryption: 'AES-256-GCM',
      ephemeralPublicKeySpkiBase64Url,
      saltBase64Url: salt.toString('base64url'),
      ivBase64Url: iv.toString('base64url'),
      ciphertextBase64Url: ciphertext.toString('base64url'),
      authTagBase64Url: authTag.toString('base64url')
    });
    const envelopeBytes = Buffer.from(canonicalJson(envelope), 'utf8');
    try {
      if (envelopeBytes.length > COMPANION_SYNC_MAX_PLAINTEXT_BYTES) throw new Error('Companion envelope boyutu asti.');
      return Object.freeze({
        envelopeBase64Url: envelopeBytes.toString('base64url'),
        ciphertextSha256: sha256(ciphertext),
        envelopeSha256: sha256(envelopeBytes),
        envelopeBytes: envelopeBytes.length,
        metadata: input.metadata
      });
    } finally { envelopeBytes.fill(0); ciphertext.fill(0); authTag.fill(0); }
  } finally {
    plaintext.fill(0); shared.fill(0); salt.fill(0); iv.fill(0); aad.fill(0); key.fill(0);
  }
};

export const decryptCompanionSyncEnvelopeForTest = (input: {
  readonly envelopeBase64Url: string;
  readonly recipientPrivateKeyPkcs8Base64Url: string;
}): { readonly metadata: CompanionSyncMetadata; readonly snapshot: unknown } => {
  const envelopeBytes = decode(input.envelopeBase64Url, 'Companion envelope', COMPANION_SYNC_MAX_PLAINTEXT_BYTES);
  const privateBytes = decode(input.recipientPrivateKeyPkcs8Base64Url, 'Companion recipient private key', 256);
  let plaintext: Buffer | undefined;
  try {
    const text = envelopeBytes.toString('utf8');
    let raw: unknown;
    try { raw = JSON.parse(text); } catch { throw new Error('Companion envelope JSON degil.'); }
    if (!isPlainRecord(raw) || canonicalJson(raw) !== text) throw new Error('Companion envelope canonical degil.');
    const envelope = raw as unknown as CompanionSyncEnvelope;
    const keys = Object.keys(raw).sort();
    const expected = ['format','version','metadata','keyAgreement','encryption','ephemeralPublicKeySpkiBase64Url','saltBase64Url','ivBase64Url','ciphertextBase64Url','authTagBase64Url'].sort();
    if (JSON.stringify(keys) !== JSON.stringify(expected) || envelope.format !== COMPANION_SYNC_FORMAT || envelope.version !== 1
      || envelope.keyAgreement !== 'X25519-HKDF-SHA256' || envelope.encryption !== 'AES-256-GCM') throw new Error('Companion envelope sozlesmesi gecersiz.');
    validateMetadata(envelope.metadata);
    const recipientPrivateKey = createPrivateKey({ key: privateBytes, format: 'der', type: 'pkcs8' });
    if (recipientPrivateKey.asymmetricKeyType !== 'x25519') throw new Error('Companion private key X25519 degil.');
    const ephemeral = x25519Public(envelope.ephemeralPublicKeySpkiBase64Url);
    const shared = diffieHellman({ privateKey: recipientPrivateKey, publicKey: ephemeral });
    const salt = decode(envelope.saltBase64Url, 'Companion salt', 32);
    const iv = decode(envelope.ivBase64Url, 'Companion iv', 12);
    const ciphertext = decode(envelope.ciphertextBase64Url, 'Companion ciphertext', COMPANION_SYNC_MAX_PLAINTEXT_BYTES);
    const authTag = decode(envelope.authTagBase64Url, 'Companion auth tag', 16);
    const aad = Buffer.from(canonicalJson(envelope.metadata), 'utf8');
    const key = Buffer.from(hkdfSync('sha256', shared, salt, aad, 32));
    try {
      const decipher = createDecipheriv('aes-256-gcm', key, iv);
      decipher.setAAD(aad); decipher.setAuthTag(authTag);
      plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
      const snapshotText = plaintext.toString('utf8');
      const snapshot = JSON.parse(snapshotText) as unknown;
      if (canonicalJson(snapshot) !== snapshotText) throw new Error('Companion snapshot canonical degil.');
      return Object.freeze({ metadata: envelope.metadata, snapshot });
    } finally {
      shared.fill(0); salt.fill(0); iv.fill(0); ciphertext.fill(0); authTag.fill(0); aad.fill(0); key.fill(0);
    }
  } finally { envelopeBytes.fill(0); privateBytes.fill(0); plaintext?.fill(0); }
};

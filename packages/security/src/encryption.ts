import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
  scryptSync,
  timingSafeEqual
} from 'node:crypto';

export interface EncryptedEnvelope {
  version: 1;
  algorithm: 'aes-256-gcm';
  iv: string;
  authTag: string;
  ciphertext: string;
}

export const createDataKey = (): Buffer => randomBytes(32);

export function encryptBytes(plain: Uint8Array, key: Uint8Array): EncryptedEnvelope {
  if (key.byteLength !== 32) throw new Error('AES-256 anahtarı 32 bayt olmalıdır.');
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const ciphertext = Buffer.concat([cipher.update(plain), cipher.final()]);
  return {
    version: 1,
    algorithm: 'aes-256-gcm',
    iv: iv.toString('base64'),
    authTag: cipher.getAuthTag().toString('base64'),
    ciphertext: ciphertext.toString('base64')
  };
}

export function decryptBytes(envelope: EncryptedEnvelope, key: Uint8Array): Buffer {
  if (key.byteLength !== 32) throw new Error('AES-256 anahtari 32 bayt olmalidir.');
  let iv:Buffer | undefined;
  let authTag:Buffer | undefined;
  let ciphertext:Buffer | undefined;
  let plaintextPrefix:Buffer | undefined;
  let plaintextFinal:Buffer | undefined;
  try {
    iv = Buffer.from(envelope.iv, 'base64');
    authTag = Buffer.from(envelope.authTag, 'base64');
    ciphertext = Buffer.from(envelope.ciphertext, 'base64');
    const decipher = createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(authTag);
    plaintextPrefix = decipher.update(ciphertext);
    plaintextFinal = decipher.final();
    return Buffer.concat([plaintextPrefix, plaintextFinal]);
  } finally {
    iv?.fill(0);
    authTag?.fill(0);
    ciphertext?.fill(0);
    plaintextPrefix?.fill(0);
    plaintextFinal?.fill(0);
  }
}

export const PORTABLE_EMERGENCY_PACK_FORMAT = 'ppt-emergency-portable-pack' as const;
export const PORTABLE_EMERGENCY_PACK_VERSION = 1 as const;
export const PORTABLE_EMERGENCY_PACK_MAX_PLAINTEXT_BYTES = 32 * 1024 * 1024;
export const PORTABLE_EMERGENCY_PACK_MAX_CONTAINER_BYTES = 50 * 1024 * 1024;
const PORTABLE_EMERGENCY_PACK_SCRYPT_N = 32_768;
const PORTABLE_EMERGENCY_PACK_SCRYPT_R = 8;
const PORTABLE_EMERGENCY_PACK_SCRYPT_P = 1;
const PORTABLE_EMERGENCY_PACK_KEY_BYTES = 32;
const PORTABLE_EMERGENCY_PACK_SALT_BYTES = 16;
const PORTABLE_EMERGENCY_PACK_IV_BYTES = 12;
const PORTABLE_EMERGENCY_PACK_TAG_BYTES = 16;
const PORTABLE_EMERGENCY_PACK_MAX_IDENTIFIER_LENGTH = 160;

export interface PortableEmergencyPackMetadata {
  readonly profileId:string;
  readonly configurationId:string;
  readonly selectionSha256:string;
}

export interface PortableEmergencyPackEnvelope {
  readonly format:typeof PORTABLE_EMERGENCY_PACK_FORMAT;
  readonly version:typeof PORTABLE_EMERGENCY_PACK_VERSION;
  readonly metadata:PortableEmergencyPackMetadata & {
    readonly plaintextSha256:string;
    readonly plaintextSizeBytes:number;
  };
  readonly keyDerivation:{
    readonly algorithm:'scrypt';
    readonly salt:string;
    readonly n:32768;
    readonly r:8;
    readonly p:1;
    readonly keyLength:32;
  };
  readonly keyWrap:{
    readonly algorithm:'aes-256-gcm';
    readonly iv:string;
    readonly authTag:string;
    readonly wrappedDek:string;
  };
  readonly payload:{
    readonly algorithm:'aes-256-gcm';
    readonly iv:string;
    readonly authTag:string;
    readonly ciphertext:string;
  };
}

export interface PortableEmergencyPackDecryptionResult {
  readonly plaintext:Buffer;
  readonly plaintextSha256:string;
  readonly plaintextSizeBytes:number;
  readonly metadata:PortableEmergencyPackMetadata;
}

export interface PortableEmergencyPackReadbackResult {
  readonly verified:true;
  readonly artifactSha256:string;
  readonly artifactSizeBytes:number;
  readonly plaintextSha256:string;
  readonly plaintextSizeBytes:number;
  readonly metadata:PortableEmergencyPackMetadata;
}

const isPlainRecord = (value:unknown):value is Record<string, unknown> => {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
};

const exactKeys = (value:Record<string, unknown>, keys:readonly string[]):boolean => {
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  return actual.length === expected.length && actual.every((key, index) => key === expected[index]);
};

const validIdentifier = (value:unknown):value is string => typeof value === 'string'
  && value === value.trim()
  && value.length >= 2
  && value.length <= PORTABLE_EMERGENCY_PACK_MAX_IDENTIFIER_LENGTH
  && !/[\\/\0]/u.test(value);
const validSha256 = (value:unknown):value is string =>
  typeof value === 'string' && /^[0-9a-f]{64}$/u.test(value);

const decodeExactBase64 = (value:unknown, expectedBytes?:number):Buffer => {
  if (typeof value !== 'string'
    || value.length < 4
    || value.length % 4 !== 0
    || !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/u.test(value)) {
    throw new Error('Tasinabilir acil durum paketi base64 alani gecersiz.');
  }
  const decoded = Buffer.from(value, 'base64');
  if (decoded.toString('base64') !== value || (expectedBytes !== undefined && decoded.length !== expectedBytes)) {
    decoded.fill(0);
    throw new Error('Tasinabilir acil durum paketi base64 uzunlugu gecersiz.');
  }
  return decoded;
};

export const normalizePortableEmergencyPackPassphrase = (passphrase:string):string => {
  if (typeof passphrase !== 'string') throw new Error('Paket parolasi metin olmalidir.');
  const normalized = passphrase.normalize('NFKC');
  const length = [...normalized].length;
  if (normalized !== normalized.trim()
    || length < 12
    || length > 1024
    || /[\u0000-\u001f\u007f]/u.test(normalized)
    || /^\p{Decimal_Number}+$/u.test(normalized)) {
    throw new Error('Paket parolasi normalize edilmis, en az 12 karakter ve yalniz sayisal olmayan bir deger olmalidir.');
  }
  return normalized;
};

export const sha256Hex = (value:Uint8Array | string):string =>
  createHash('sha256').update(value).digest('hex');

const portablePackAuthenticatedMetadata = (
  metadata:PortableEmergencyPackEnvelope['metadata']
):Buffer => Buffer.from(JSON.stringify({
  format: PORTABLE_EMERGENCY_PACK_FORMAT,
  version: PORTABLE_EMERGENCY_PACK_VERSION,
  profileId: metadata.profileId,
  configurationId: metadata.configurationId,
  selectionSha256: metadata.selectionSha256,
  plaintextSha256: metadata.plaintextSha256,
  plaintextSizeBytes: metadata.plaintextSizeBytes
}), 'utf8');

const encryptPortableComponent = (
  plaintext:Uint8Array,
  key:Uint8Array,
  aad:Uint8Array
):{ readonly iv:string; readonly authTag:string; readonly ciphertext:Buffer } => {
  const iv = randomBytes(PORTABLE_EMERGENCY_PACK_IV_BYTES);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  cipher.setAAD(aad);
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  return Object.freeze({
    iv: iv.toString('base64'),
    authTag: cipher.getAuthTag().toString('base64'),
    ciphertext
  });
};

const decryptPortableComponent = (input:{
  readonly ciphertext:Buffer;
  readonly key:Uint8Array;
  readonly iv:Buffer;
  readonly authTag:Buffer;
  readonly aad:Uint8Array;
}):Buffer => {
  let plaintextPrefix:Buffer | undefined;
  let plaintextFinal:Buffer | undefined;
  try {
    const decipher = createDecipheriv('aes-256-gcm', input.key, input.iv);
    decipher.setAAD(input.aad);
    decipher.setAuthTag(input.authTag);
    plaintextPrefix = decipher.update(input.ciphertext);
    plaintextFinal = decipher.final();
    return Buffer.concat([plaintextPrefix, plaintextFinal]);
  } finally {
    plaintextPrefix?.fill(0);
    plaintextFinal?.fill(0);
  }
};

export const encryptPortableEmergencyPack = (input:{
  readonly plaintext:Uint8Array;
  readonly passphrase:string;
  readonly metadata:PortableEmergencyPackMetadata;
}):Buffer => {
  if (input.plaintext.byteLength < 1
    || input.plaintext.byteLength > PORTABLE_EMERGENCY_PACK_MAX_PLAINTEXT_BYTES) {
    throw new Error('Tasinabilir acil durum paketi 1 bayt ile 32 MiB arasinda olmalidir.');
  }
  if (!validIdentifier(input.metadata.profileId)
    || !validIdentifier(input.metadata.configurationId)
    || !validSha256(input.metadata.selectionSha256)) {
    throw new Error('Tasinabilir acil durum paketi baglam verisi gecersiz.');
  }
  const normalizedPassphrase = normalizePortableEmergencyPackPassphrase(input.passphrase);
  const plaintext = Buffer.from(input.plaintext);
  const metadata = Object.freeze({
    profileId: input.metadata.profileId,
    configurationId: input.metadata.configurationId,
    selectionSha256: input.metadata.selectionSha256,
    plaintextSha256: sha256Hex(plaintext),
    plaintextSizeBytes: plaintext.length
  });
  const aad = portablePackAuthenticatedMetadata(metadata);
  const keyWrapAad = Buffer.concat([aad, Buffer.from('\nkey-wrap', 'utf8')]);
  const payloadAad = Buffer.concat([aad, Buffer.from('\npayload', 'utf8')]);
  const salt = randomBytes(PORTABLE_EMERGENCY_PACK_SALT_BYTES);
  const dek = randomBytes(PORTABLE_EMERGENCY_PACK_KEY_BYTES);
  let kek:Buffer | undefined;
  let wrapped:ReturnType<typeof encryptPortableComponent> | undefined;
  let encryptedPayload:ReturnType<typeof encryptPortableComponent> | undefined;
  try {
    kek = scryptSync(normalizedPassphrase, salt, PORTABLE_EMERGENCY_PACK_KEY_BYTES, {
      N: PORTABLE_EMERGENCY_PACK_SCRYPT_N,
      r: PORTABLE_EMERGENCY_PACK_SCRYPT_R,
      p: PORTABLE_EMERGENCY_PACK_SCRYPT_P,
      maxmem: 64 * 1024 * 1024
    });
    wrapped = encryptPortableComponent(dek, kek, keyWrapAad);
    encryptedPayload = encryptPortableComponent(plaintext, dek, payloadAad);
    const envelope:PortableEmergencyPackEnvelope = {
      format: PORTABLE_EMERGENCY_PACK_FORMAT,
      version: PORTABLE_EMERGENCY_PACK_VERSION,
      metadata,
      keyDerivation: {
        algorithm: 'scrypt',
        salt: salt.toString('base64'),
        n: PORTABLE_EMERGENCY_PACK_SCRYPT_N,
        r: PORTABLE_EMERGENCY_PACK_SCRYPT_R,
        p: PORTABLE_EMERGENCY_PACK_SCRYPT_P,
        keyLength: PORTABLE_EMERGENCY_PACK_KEY_BYTES
      },
      keyWrap: {
        algorithm: 'aes-256-gcm',
        iv: wrapped.iv,
        authTag: wrapped.authTag,
        wrappedDek: wrapped.ciphertext.toString('base64')
      },
      payload: {
        algorithm: 'aes-256-gcm',
        iv: encryptedPayload.iv,
        authTag: encryptedPayload.authTag,
        ciphertext: encryptedPayload.ciphertext.toString('base64')
      }
    };
    const serialized = Buffer.from(JSON.stringify(envelope), 'utf8');
    if (serialized.length > PORTABLE_EMERGENCY_PACK_MAX_CONTAINER_BYTES) {
      serialized.fill(0);
      throw new Error('Tasinabilir acil durum paketi konteyner sinirini asti.');
    }
    return serialized;
  } finally {
    plaintext.fill(0);
    dek.fill(0);
    kek?.fill(0);
    salt.fill(0);
    aad.fill(0);
    keyWrapAad.fill(0);
    payloadAad.fill(0);
    wrapped?.ciphertext.fill(0);
    encryptedPayload?.ciphertext.fill(0);
  }
};

export const parsePortableEmergencyPack = (serialized:Uint8Array):PortableEmergencyPackEnvelope => {
  if (serialized.byteLength < 2 || serialized.byteLength > PORTABLE_EMERGENCY_PACK_MAX_CONTAINER_BYTES) {
    throw new Error('Tasinabilir acil durum paketi konteyner boyutu gecersiz.');
  }
  let parsed:unknown;
  const serializedText = Buffer.from(serialized).toString('utf8');
  try {
    parsed = JSON.parse(serializedText) as unknown;
  } catch {
    throw new Error('Tasinabilir acil durum paketi JSON bicimi gecersiz.');
  }
  if (!isPlainRecord(parsed)
    || !exactKeys(parsed, ['format','version','metadata','keyDerivation','keyWrap','payload'])
    || parsed.format !== PORTABLE_EMERGENCY_PACK_FORMAT
    || parsed.version !== PORTABLE_EMERGENCY_PACK_VERSION
    || !isPlainRecord(parsed.metadata)
    || !exactKeys(parsed.metadata, [
      'profileId','configurationId','selectionSha256','plaintextSha256','plaintextSizeBytes'
    ])
    || !validIdentifier(parsed.metadata.profileId)
    || !validIdentifier(parsed.metadata.configurationId)
    || !validSha256(parsed.metadata.selectionSha256)
    || !validSha256(parsed.metadata.plaintextSha256)
    || !Number.isSafeInteger(parsed.metadata.plaintextSizeBytes)
    || (parsed.metadata.plaintextSizeBytes as number) < 1
    || (parsed.metadata.plaintextSizeBytes as number) > PORTABLE_EMERGENCY_PACK_MAX_PLAINTEXT_BYTES
    || !isPlainRecord(parsed.keyDerivation)
    || !exactKeys(parsed.keyDerivation, ['algorithm','salt','n','r','p','keyLength'])
    || parsed.keyDerivation.algorithm !== 'scrypt'
    || parsed.keyDerivation.n !== PORTABLE_EMERGENCY_PACK_SCRYPT_N
    || parsed.keyDerivation.r !== PORTABLE_EMERGENCY_PACK_SCRYPT_R
    || parsed.keyDerivation.p !== PORTABLE_EMERGENCY_PACK_SCRYPT_P
    || parsed.keyDerivation.keyLength !== PORTABLE_EMERGENCY_PACK_KEY_BYTES
    || !isPlainRecord(parsed.keyWrap)
    || !exactKeys(parsed.keyWrap, ['algorithm','iv','authTag','wrappedDek'])
    || parsed.keyWrap.algorithm !== 'aes-256-gcm'
    || !isPlainRecord(parsed.payload)
    || !exactKeys(parsed.payload, ['algorithm','iv','authTag','ciphertext'])
    || parsed.payload.algorithm !== 'aes-256-gcm'
    || JSON.stringify(parsed) !== serializedText) {
    throw new Error('Tasinabilir acil durum paketi sozlesmesi gecersiz.');
  }
  let salt:Buffer | undefined;
  let wrapIv:Buffer | undefined;
  let wrapTag:Buffer | undefined;
  let wrappedDek:Buffer | undefined;
  let payloadIv:Buffer | undefined;
  let payloadTag:Buffer | undefined;
  let ciphertext:Buffer | undefined;
  try {
    salt = decodeExactBase64(parsed.keyDerivation.salt, PORTABLE_EMERGENCY_PACK_SALT_BYTES);
    wrapIv = decodeExactBase64(parsed.keyWrap.iv, PORTABLE_EMERGENCY_PACK_IV_BYTES);
    wrapTag = decodeExactBase64(parsed.keyWrap.authTag, PORTABLE_EMERGENCY_PACK_TAG_BYTES);
    wrappedDek = decodeExactBase64(parsed.keyWrap.wrappedDek, PORTABLE_EMERGENCY_PACK_KEY_BYTES);
    payloadIv = decodeExactBase64(parsed.payload.iv, PORTABLE_EMERGENCY_PACK_IV_BYTES);
    payloadTag = decodeExactBase64(parsed.payload.authTag, PORTABLE_EMERGENCY_PACK_TAG_BYTES);
    ciphertext = decodeExactBase64(parsed.payload.ciphertext);
    if (ciphertext.length !== parsed.metadata.plaintextSizeBytes) {
      throw new Error('Tasinabilir acil durum paketi yuk boyutu gecersiz.');
    }
  } finally {
    salt?.fill(0);
    wrapIv?.fill(0);
    wrapTag?.fill(0);
    wrappedDek?.fill(0);
    payloadIv?.fill(0);
    payloadTag?.fill(0);
    ciphertext?.fill(0);
  }
  return parsed as unknown as PortableEmergencyPackEnvelope;
};

export const decryptPortableEmergencyPack = (
  serialized:Uint8Array,
  passphrase:string
):PortableEmergencyPackDecryptionResult => {
  const envelope = parsePortableEmergencyPack(serialized);
  const normalizedPassphrase = normalizePortableEmergencyPackPassphrase(passphrase);
  const aad = portablePackAuthenticatedMetadata(envelope.metadata);
  const keyWrapAad = Buffer.concat([aad, Buffer.from('\nkey-wrap', 'utf8')]);
  const payloadAad = Buffer.concat([aad, Buffer.from('\npayload', 'utf8')]);
  let salt:Buffer | undefined;
  let wrapIv:Buffer | undefined;
  let wrapTag:Buffer | undefined;
  let wrappedDek:Buffer | undefined;
  let payloadIv:Buffer | undefined;
  let payloadTag:Buffer | undefined;
  let ciphertext:Buffer | undefined;
  let kek:Buffer | undefined;
  let dek:Buffer | undefined;
  let plaintext:Buffer | undefined;
  try {
    salt = decodeExactBase64(envelope.keyDerivation.salt, PORTABLE_EMERGENCY_PACK_SALT_BYTES);
    wrapIv = decodeExactBase64(envelope.keyWrap.iv, PORTABLE_EMERGENCY_PACK_IV_BYTES);
    wrapTag = decodeExactBase64(envelope.keyWrap.authTag, PORTABLE_EMERGENCY_PACK_TAG_BYTES);
    wrappedDek = decodeExactBase64(envelope.keyWrap.wrappedDek, PORTABLE_EMERGENCY_PACK_KEY_BYTES);
    payloadIv = decodeExactBase64(envelope.payload.iv, PORTABLE_EMERGENCY_PACK_IV_BYTES);
    payloadTag = decodeExactBase64(envelope.payload.authTag, PORTABLE_EMERGENCY_PACK_TAG_BYTES);
    ciphertext = decodeExactBase64(envelope.payload.ciphertext);
    kek = scryptSync(normalizedPassphrase, salt, PORTABLE_EMERGENCY_PACK_KEY_BYTES, {
      N: PORTABLE_EMERGENCY_PACK_SCRYPT_N,
      r: PORTABLE_EMERGENCY_PACK_SCRYPT_R,
      p: PORTABLE_EMERGENCY_PACK_SCRYPT_P,
      maxmem: 64 * 1024 * 1024
    });
    dek = decryptPortableComponent({ ciphertext: wrappedDek, key: kek, iv: wrapIv, authTag: wrapTag, aad: keyWrapAad });
    if (dek.length !== PORTABLE_EMERGENCY_PACK_KEY_BYTES) throw new Error('Paket veri anahtari gecersiz.');
    plaintext = decryptPortableComponent({ ciphertext, key: dek, iv: payloadIv, authTag: payloadTag, aad: payloadAad });
    const actualHash = Buffer.from(sha256Hex(plaintext), 'hex');
    const expectedHash = Buffer.from(envelope.metadata.plaintextSha256, 'hex');
    const hashMatches = actualHash.length === expectedHash.length && timingSafeEqual(actualHash, expectedHash);
    actualHash.fill(0);
    expectedHash.fill(0);
    if (!hashMatches || plaintext.length !== envelope.metadata.plaintextSizeBytes) {
      plaintext.fill(0);
      throw new Error('Tasinabilir acil durum paketi hash readback dogrulamasi basarisiz.');
    }
    const result = plaintext;
    plaintext = undefined;
    return Object.freeze({
      plaintext: result,
      plaintextSha256: envelope.metadata.plaintextSha256,
      plaintextSizeBytes: envelope.metadata.plaintextSizeBytes,
      metadata: Object.freeze({
        profileId: envelope.metadata.profileId,
        configurationId: envelope.metadata.configurationId,
        selectionSha256: envelope.metadata.selectionSha256
      })
    });
  } finally {
    salt?.fill(0);
    wrapIv?.fill(0);
    wrapTag?.fill(0);
    wrappedDek?.fill(0);
    payloadIv?.fill(0);
    payloadTag?.fill(0);
    ciphertext?.fill(0);
    aad.fill(0);
    keyWrapAad.fill(0);
    payloadAad.fill(0);
    kek?.fill(0);
    dek?.fill(0);
    plaintext?.fill(0);
  }
};

export const verifyPortableEmergencyPackReadback = (input:{
  readonly serialized:Uint8Array;
  readonly passphrase:string;
  readonly expectedPlaintextSha256?:string;
}):PortableEmergencyPackReadbackResult => {
  if (input.expectedPlaintextSha256 !== undefined && !validSha256(input.expectedPlaintextSha256)) {
    throw new Error('Beklenen acik metin SHA-256 ozeti gecersiz.');
  }
  const decrypted = decryptPortableEmergencyPack(input.serialized, input.passphrase);
  try {
    if (input.expectedPlaintextSha256 !== undefined
      && input.expectedPlaintextSha256 !== decrypted.plaintextSha256) {
      throw new Error('Tasinabilir acil durum paketi beklenen hash ile eslesmiyor.');
    }
    return Object.freeze({
      verified: true,
      artifactSha256: sha256Hex(input.serialized),
      artifactSizeBytes: input.serialized.byteLength,
      plaintextSha256: decrypted.plaintextSha256,
      plaintextSizeBytes: decrypted.plaintextSizeBytes,
      metadata: decrypted.metadata
    });
  } finally {
    decrypted.plaintext.fill(0);
  }
};

import {
  createCipheriv,
  createDecipheriv,
  pbkdf2Sync,
  randomBytes
} from 'node:crypto';

export const FULL_BACKUP_FORMAT = 'anadolu-parsi-full-backup';
export const FULL_BACKUP_VERSION = 3;
export const FULL_BACKUP_ALGORITHM = 'aes-256-gcm';
export const FULL_BACKUP_KDF = 'pbkdf2-sha512';
export const FULL_BACKUP_KDF_DIGEST = 'sha512';
export const FULL_BACKUP_KDF_ITERATIONS = 310_000;
export const FULL_BACKUP_MIN_KDF_ITERATIONS = 210_000;
export const FULL_BACKUP_MAX_KDF_ITERATIONS = 1_000_000;
export const FULL_BACKUP_MIN_PASSWORD_LENGTH = 12;
export const FULL_BACKUP_MAX_PASSWORD_LENGTH = 1_024;

interface FullBackupEncryptionHeader {
  readonly algorithm: typeof FULL_BACKUP_ALGORITHM;
  readonly kdf: typeof FULL_BACKUP_KDF;
  readonly digest: typeof FULL_BACKUP_KDF_DIGEST;
  readonly iterations: number;
  readonly salt: string;
  readonly iv: string;
}

export interface EncryptedFullBackupContainerV3 {
  readonly format: typeof FULL_BACKUP_FORMAT;
  readonly version: typeof FULL_BACKUP_VERSION;
  readonly createdAt: string;
  readonly encryption: FullBackupEncryptionHeader & {
    readonly authenticationTag: string;
  };
  readonly ciphertext: string;
}

export interface DecryptedFullBackupContainerV3<TPayload> {
  readonly container: EncryptedFullBackupContainerV3;
  readonly payload: TPayload;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const decodeBase64Strict = (value: string, label: string): Buffer => {
  if (
    value.length === 0
    || value.length % 4 !== 0
    || !/^[A-Za-z0-9+/]+={0,2}$/u.test(value)
  ) {
    throw new Error(`[BKP-013] ${label} Base64 biçimi geçersiz.`);
  }
  const bytes = Buffer.from(value, 'base64');
  if (bytes.toString('base64') !== value) {
    throw new Error(`[BKP-013] ${label} Base64 biçimi kanonik değil.`);
  }
  return bytes;
};

export const validateFullBackupPassword = (password: string): void => {
  if (typeof password !== 'string') {
    throw new Error('[BKP-012] Yedek parolası geçersiz.');
  }
  if (
    password.length < FULL_BACKUP_MIN_PASSWORD_LENGTH
    || password.length > FULL_BACKUP_MAX_PASSWORD_LENGTH
    || password.trim().length === 0
  ) {
    throw new Error(
      `[BKP-012] Yedek parolası ${FULL_BACKUP_MIN_PASSWORD_LENGTH}-${FULL_BACKUP_MAX_PASSWORD_LENGTH} karakter arasında olmalıdır.`
    );
  }
};

const parseEncryptionHeader = (
  value: unknown
): FullBackupEncryptionHeader & { readonly authenticationTag: string } => {
  if (!isRecord(value)) {
    throw new Error('[BKP-013] Yedek şifreleme başlığı geçersiz.');
  }
  const { algorithm, kdf, digest, iterations, salt, iv, authenticationTag } = value;
  if (
    algorithm !== FULL_BACKUP_ALGORITHM
    || kdf !== FULL_BACKUP_KDF
    || digest !== FULL_BACKUP_KDF_DIGEST
    || typeof iterations !== 'number'
    || !Number.isSafeInteger(iterations)
    || iterations < FULL_BACKUP_MIN_KDF_ITERATIONS
    || iterations > FULL_BACKUP_MAX_KDF_ITERATIONS
    || typeof salt !== 'string'
    || typeof iv !== 'string'
    || typeof authenticationTag !== 'string'
  ) {
    throw new Error('[BKP-013] Yedek şifreleme parametreleri desteklenmiyor.');
  }
  const saltBytes = decodeBase64Strict(salt, 'KDF tuzu');
  const ivBytes = decodeBase64Strict(iv, 'Başlatma vektörü');
  const tagBytes = decodeBase64Strict(authenticationTag, 'Doğrulama etiketi');
  if (saltBytes.length < 16 || saltBytes.length > 64) {
    throw new Error('[BKP-013] KDF tuzu uzunluğu geçersiz.');
  }
  if (ivBytes.length !== 12) {
    throw new Error('[BKP-013] AES-GCM başlatma vektörü 12 bayt olmalıdır.');
  }
  if (tagBytes.length !== 16) {
    throw new Error('[BKP-013] AES-GCM doğrulama etiketi 16 bayt olmalıdır.');
  }
  return {
    algorithm,
    kdf,
    digest,
    iterations,
    salt,
    iv,
    authenticationTag
  };
};

export const parseEncryptedFullBackupContainerV3 = (
  value: unknown
): EncryptedFullBackupContainerV3 => {
  if (!isRecord(value)) {
    throw new Error('[BKP-013] Şifreli yedek kapsayıcısı geçersiz.');
  }
  const { format, version, createdAt, encryption, ciphertext } = value;
  if (
    format !== FULL_BACKUP_FORMAT
    || version !== FULL_BACKUP_VERSION
    || typeof createdAt !== 'string'
    || Number.isNaN(Date.parse(createdAt))
    || typeof ciphertext !== 'string'
  ) {
    throw new Error('[BKP-013] Şifreli yedek kapsayıcısı desteklenmiyor.');
  }
  decodeBase64Strict(ciphertext, 'Şifreli içerik');
  return {
    format,
    version,
    createdAt,
    encryption: parseEncryptionHeader(encryption),
    ciphertext
  };
};

const authenticatedHeaderBytes = (
  container: Pick<EncryptedFullBackupContainerV3, 'format' | 'version' | 'createdAt'> & {
    readonly encryption: FullBackupEncryptionHeader;
  }
): Buffer => Buffer.from(JSON.stringify({
  format: container.format,
  version: container.version,
  createdAt: container.createdAt,
  encryption: {
    algorithm: container.encryption.algorithm,
    kdf: container.encryption.kdf,
    digest: container.encryption.digest,
    iterations: container.encryption.iterations,
    salt: container.encryption.salt,
    iv: container.encryption.iv
  }
}), 'utf8');

const deriveKey = (
  password: string,
  salt: Uint8Array,
  iterations: number
): Buffer => pbkdf2Sync(password, salt, iterations, 32, FULL_BACKUP_KDF_DIGEST);

export const encryptFullBackupPayloadV3 = <TPayload>(
  payload: TPayload,
  password: string,
  createdAt: string
): EncryptedFullBackupContainerV3 => {
  validateFullBackupPassword(password);
  if (Number.isNaN(Date.parse(createdAt))) {
    throw new Error('[BKP-013] Yedek oluşturma zamanı geçersiz.');
  }
  const salt = randomBytes(32);
  const iv = randomBytes(12);
  const encryption: FullBackupEncryptionHeader = {
    algorithm: FULL_BACKUP_ALGORITHM,
    kdf: FULL_BACKUP_KDF,
    digest: FULL_BACKUP_KDF_DIGEST,
    iterations: FULL_BACKUP_KDF_ITERATIONS,
    salt: salt.toString('base64'),
    iv: iv.toString('base64')
  };
  const header = {
    format: FULL_BACKUP_FORMAT,
    version: FULL_BACKUP_VERSION,
    createdAt,
    encryption
  } as const;
  const key = deriveKey(password, salt, encryption.iterations);
  try {
    const cipher = createCipheriv(FULL_BACKUP_ALGORITHM, key, iv, { authTagLength: 16 });
    cipher.setAAD(authenticatedHeaderBytes(header));
    const plaintext = Buffer.from(JSON.stringify(payload), 'utf8');
    const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
    return {
      ...header,
      encryption: {
        ...encryption,
        authenticationTag: cipher.getAuthTag().toString('base64')
      },
      ciphertext: ciphertext.toString('base64')
    };
  } finally {
    key.fill(0);
  }
};

export const decryptFullBackupPayloadV3 = <TPayload>(
  value: unknown,
  password: string
): DecryptedFullBackupContainerV3<TPayload> => {
  validateFullBackupPassword(password);
  const container = parseEncryptedFullBackupContainerV3(value);
  const salt = decodeBase64Strict(container.encryption.salt, 'KDF tuzu');
  const iv = decodeBase64Strict(container.encryption.iv, 'Başlatma vektörü');
  const authenticationTag = decodeBase64Strict(
    container.encryption.authenticationTag,
    'Doğrulama etiketi'
  );
  const ciphertext = decodeBase64Strict(container.ciphertext, 'Şifreli içerik');
  const key = deriveKey(password, salt, container.encryption.iterations);
  try {
    const decipher = createDecipheriv(FULL_BACKUP_ALGORITHM, key, iv, { authTagLength: 16 });
    decipher.setAAD(authenticatedHeaderBytes(container));
    decipher.setAuthTag(authenticationTag);
    let plaintext: Buffer;
    try {
      plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
    } catch {
      throw new Error('[BKP-014] Yedek parolası yanlış veya dosya bütünlüğü bozuk.');
    }
    try {
      return {
        container,
        payload: JSON.parse(plaintext.toString('utf8')) as TPayload
      };
    } catch {
      throw new Error('[BKP-015] Şifre çözülmüş yedek içeriği geçerli JSON değil.');
    } finally {
      plaintext.fill(0);
    }
  } finally {
    key.fill(0);
  }
};

export const CURRENT_BRAND_NAME = 'ParsYuva' as const;
export const CURRENT_PRODUCT_NAME = 'ParsYuva AYM' as const;
export const CURRENT_PRODUCT_LONG_NAME = 'ParsYuva Aile Yaşam Merkezi' as const;
export const LEGACY_PRODUCT_NAME = 'Anadolu Parsı Aile Yaşam Merkezi' as const;
export const STABLE_APPLICATION_ID = 'tr.anadoluparsi.aileyasammerkezi' as const;
// The user-data directory remains stable across the public brand transition so
// an update never strands or silently recreates an existing family database.
export const STABLE_USER_DATA_DIRECTORY_NAME = LEGACY_PRODUCT_NAME;
export const ACCEPTED_PERSISTED_PRODUCT_NAMES = Object.freeze([
  CURRENT_PRODUCT_NAME,
  LEGACY_PRODUCT_NAME
] as const);
export type PersistedProductName = (typeof ACCEPTED_PERSISTED_PRODUCT_NAMES)[number];

export const APP_META = Object.freeze({
  name: CURRENT_PRODUCT_NAME,
  edition: 'Bronze',
  version: '19.08.2026.33',
  packageVersion: '19.8.2026-33',
  releaseLabel: 'Bronze 19.08.2026.33',
  releaseId: 'bronze-2026-08-19-r33',
  monthlySequence: 33,
  stage: 'Bronze · Aktif Geliştirme'
});
export type AppMeta = typeof APP_META;

export type UserVisibleReleaseChannel = 'Bronze' | 'Silver' | 'Gold';

export interface UserVisibleAppInfo {
  readonly name: string;
  readonly releaseLabel: string;
  readonly channel: UserVisibleReleaseChannel;
  readonly stage: string;
}

const USER_VISIBLE_RELEASE_PATTERN = /^(Bronze|Silver|Gold) \d{2}\.\d{2}\.\d{4}\.\d+$/u;
const FORBIDDEN_VISIBLE_RELEASE_TOKEN = /\b(?:RC2?|MVP|Build)\b/iu;

export const toUserVisibleAppInfo = (metadata: AppMeta): Readonly<UserVisibleAppInfo> => {
  if (!USER_VISIBLE_RELEASE_PATTERN.test(metadata.releaseLabel)
    || metadata.releaseLabel !== `${metadata.edition} ${metadata.version}`
    || FORBIDDEN_VISIBLE_RELEASE_TOKEN.test(metadata.releaseLabel)) {
    throw new Error('Kullanıcıya görünür sürüm etiketi geçersiz.');
  }
  return Object.freeze({
    name: metadata.name,
    releaseLabel: metadata.releaseLabel,
    channel: metadata.edition as UserVisibleReleaseChannel,
    stage: metadata.stage
  });
};

const asciiFileSegment = (value: string): string => value
  .replaceAll('ı', 'i').replaceAll('İ', 'I').replaceAll('ş', 's').replaceAll('Ş', 'S')
  .replaceAll('ğ', 'g').replaceAll('Ğ', 'G').replaceAll('ü', 'u').replaceAll('Ü', 'U')
  .replaceAll('ö', 'o').replaceAll('Ö', 'O').replaceAll('ç', 'c').replaceAll('Ç', 'C')
  .normalize('NFKD').replaceAll(/[\u0300-\u036f]/gu, '')
  .replaceAll(/[^A-Za-z0-9.]+/gu, '_').replaceAll(/^_+|_+$/gu, '');

export const createUserVisibleDeliveryFileName = (
  productName: string,
  releaseLabel: string,
  extension: 'json' | 'zip' = 'json'
): string => {
  if (!USER_VISIBLE_RELEASE_PATTERN.test(releaseLabel) || FORBIDDEN_VISIBLE_RELEASE_TOKEN.test(releaseLabel)) {
    throw new Error('Kullanıcı teslim dosyası için sürüm etiketi geçersiz.');
  }
  const fileName = `${asciiFileSegment(productName)}_${asciiFileSegment(releaseLabel)}.${extension}`;
  if (FORBIDDEN_VISIBLE_RELEASE_TOKEN.test(fileName)) throw new Error('Kullanıcı teslim dosyası eski iç sürüm belirteci içeremez.');
  return fileName;
};

export const USER_VISIBLE_APP_INFO = toUserVisibleAppInfo(APP_META);
export const USER_VISIBLE_DELIVERY_FILE_NAME = createUserVisibleDeliveryFileName(APP_META.name, APP_META.releaseLabel);

export const CURRENT_BRAND_NAME = 'ParsYuva' as const;
export const CURRENT_PRODUCT_LONG_NAME = 'ParsYuva Aile Yaşam Merkezi' as const;
export const PREVIOUS_PRODUCT_SHORT_NAME = 'ParsYuva AYM' as const;
export const CURRENT_PRODUCT_NAME = CURRENT_PRODUCT_LONG_NAME;
export const LEGACY_PRODUCT_NAME = 'Anadolu Parsı Aile Yaşam Merkezi' as const;
export const STABLE_APPLICATION_ID = 'tr.anadoluparsi.aileyasammerkezi' as const;
// The user-data directory remains stable across the public brand transition so
// an update never strands or silently recreates an existing family database.
export const STABLE_USER_DATA_DIRECTORY_NAME = LEGACY_PRODUCT_NAME;
export const ACCEPTED_PERSISTED_PRODUCT_NAMES = Object.freeze([
  CURRENT_PRODUCT_NAME,
  PREVIOUS_PRODUCT_SHORT_NAME,
  LEGACY_PRODUCT_NAME
] as const);
export type PersistedProductName = (typeof ACCEPTED_PERSISTED_PRODUCT_NAMES)[number];

export type UserVisibleReleaseChannel = 'Bronze' | 'Silver' | 'Gold';
export type UserVisibleReleaseLanguage = 'tr' | 'en';

const RELEASE_CHANNEL_SLUGS:Readonly<Record<UserVisibleReleaseChannel,'bronze'|'silver'|'gold'>>=Object.freeze({
  Bronze:'bronze',Silver:'silver',Gold:'gold'
});

export const releaseChannelSlug=(channel:UserVisibleReleaseChannel):'bronze'|'silver'|'gold'=>
  RELEASE_CHANNEL_SLUGS[channel];

export const releaseApplicationId=(channel:UserVisibleReleaseChannel):string=>
  `${STABLE_APPLICATION_ID}.${releaseChannelSlug(channel)}`;

export const releaseUserDataDirectoryName=(channel:UserVisibleReleaseChannel):string=>
  `${CURRENT_BRAND_NAME}/${channel}`;

export const releaseExecutableName=(channel:UserVisibleReleaseChannel):string=>
  `${CURRENT_BRAND_NAME}-${channel}`;

export const releaseProductName=(channel:UserVisibleReleaseChannel):string=>
  `${CURRENT_PRODUCT_LONG_NAME} ${channel}`;

export const releaseShortcutName=(channel:UserVisibleReleaseChannel):string=>
  `${CURRENT_BRAND_NAME} ${channel}`;

const USER_VISIBLE_RELEASE_STAGES:Readonly<Record<UserVisibleReleaseLanguage,Readonly<Record<UserVisibleReleaseChannel,string>>>>=Object.freeze({
  tr:Object.freeze({Bronze:'Aktif Geliştirme',Silver:'Aktif Test',Gold:'Aktif Sürüm'}),
  en:Object.freeze({Bronze:'Active Development',Silver:'Active Testing',Gold:'Active Release'})
});

export const releaseStageForChannel=(channel:UserVisibleReleaseChannel,language:UserVisibleReleaseLanguage):string=>
  USER_VISIBLE_RELEASE_STAGES[language][channel];

export const APP_META = Object.freeze({
  name: CURRENT_PRODUCT_NAME,
  edition: 'Bronze',
  version: '27.08.2026.52',
  packageVersion: '27.8.2026-52',
  releaseLabel: 'Bronze 27.08.2026.52',
  releaseId: 'bronze-2026-08-27-r52',
  monthlySequence: 52,
  stage: 'Aktif Geliştirme'
});
export type AppMeta = typeof APP_META;

export interface UserVisibleAppInfo {
  readonly name: string;
  readonly releaseLabel: string;
  readonly channel: UserVisibleReleaseChannel;
  readonly stage: string;
}

const USER_VISIBLE_RELEASE_PATTERN = /^(Bronze|Silver|Gold) \d{2}\.\d{2}\.\d{4}\.\d+$/u;
const USER_VISIBLE_RELEASE_CHANNEL_TOKEN = /\b(?:Bronze|Silver|Gold)\b/iu;
const FORBIDDEN_VISIBLE_RELEASE_TOKEN = /\b(?:RC2?|MVP|Build)\b/iu;

export const toUserVisibleAppInfo = (metadata: AppMeta): Readonly<UserVisibleAppInfo> => {
  if (!USER_VISIBLE_RELEASE_PATTERN.test(metadata.releaseLabel)
    || metadata.releaseLabel !== `${metadata.edition} ${metadata.version}`
    || FORBIDDEN_VISIBLE_RELEASE_TOKEN.test(metadata.releaseLabel)
    || USER_VISIBLE_RELEASE_CHANNEL_TOKEN.test(metadata.stage)
    || metadata.stage!==releaseStageForChannel(metadata.edition as UserVisibleReleaseChannel,'tr')) {
    throw new Error('Kullanıcıya görünür sürüm etiketi geçersiz.');
  }
  return Object.freeze({
    name: metadata.name,
    releaseLabel: metadata.releaseLabel,
    channel: metadata.edition as UserVisibleReleaseChannel,
    stage: metadata.stage
  });
};

export const formatUserVisibleReleaseSummary = (
  info: UserVisibleAppInfo,
  localizedStage = info.stage
): string => {
  const stage = localizedStage.trim();
  if (!stage || USER_VISIBLE_RELEASE_CHANNEL_TOKEN.test(stage)) {
    throw new Error('Kullanıcıya görünür sürüm durumu kanal adını yineleyemez.');
  }
  return `${info.releaseLabel} · ${stage}`;
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

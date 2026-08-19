import { createContext, useContext, type ReactNode } from 'react';
import {
  DEFAULT_UI_LOCALIZATION,
  type SupportedUiLanguage,
  type ProductNavigationGroupId,
  type ProductScreenId,
  type UiLocalizationBootstrapView
} from '@ppt/domain/renderer';

const englishMessages = {
  'brand.subtitle':'Family Life Center',
  'intro.eyebrow':'First setup · 3 short steps',
  'intro.lead':'A secure local center for family memories, documents, health, finance and life records.',
  'intro.caption':'Narration transcript',
  'intro.audioMuted':'Audio is muted; the narration transcript remains visible.',
  'intro.audioUnavailable':'Local voice narration is unavailable on this device; the transcript remains visible.',
  'intro.audioError':'Voice narration could not be started; the transcript remains visible.',
  'intro.audioPlaying':'English narration is playing.',
  'intro.audioReady':'English narration is ready.',
  'intro.slowSpeed':'Slow speed',
  'intro.normalSpeed':'Normal speed',
  'intro.unmute':'Turn sound on',
  'intro.mute':'Turn sound off',
  'intro.stop':'Stop narration',
  'intro.restart':'Play from the beginning',
  'intro.normal':'Normal speed',
  'intro.slower':'Slower',
  'intro.start':'Start secure setup',
  'intro.skip':'Skip introduction for now',
  'security.eyebrow':'First setup · Security',
  'security.title':'Protect your account and recovery path',
  'security.body':'Two-factor authentication and recovery codes are created before the main application opens. User data does not enter normal use until this step is complete.',
  'security.start':'Start security setup',
  'security.authenticator':'Authenticator setup',
  'security.key':'Key',
  'security.uri':'Setup URI',
  'security.recoveryCodes':'Recovery codes',
  'security.copy':'Copy recovery codes',
  'security.code':'Authenticator verification code',
  'security.saved':'I stored the recovery codes in a safe place',
  'security.finish':'Complete security and open the application',
  'auth.private':'Yours alone',
  'auth.story':'Your family story,\nin one secure place.',
  'auth.storyBody':'Manage your family tree, memories, important dates and family records without creating an internet account.',
  'auth.localData':'Data stays on this computer',
  'auth.noOnlineAccount':'No email account or online membership is required.',
  'auth.welcomeBack':'Welcome back',
  'auth.firstStart':'First start',
  'auth.selectProfile':'Select your profile',
  'auth.createFamily':'Let’s create your family',
  'auth.loginBody':'Continue to your family space with your local password.',
  'auth.setupBody':'Prepare your personal family space with a few details.',
  'auth.familyName':'Family name',
  'auth.familyPlaceholder':'For example, the Miller Family',
  'auth.fullName':'Your full name',
  'auth.namePlaceholder':'Family administrator’s name',
  'auth.localProfiles':'Local profiles',
  'auth.admin':'Family administrator',
  'auth.member':'Family member',
  'auth.localPassword':'Local password',
  'auth.passwordPlaceholder':'Enter your password',
  'auth.showPassword':'Show password',
  'auth.hidePassword':'Hide password',
  'auth.lengthComplete':'Length requirement met',
  'auth.moreCharacters':'{count} more characters required',
  'auth.uppercase':'Uppercase',
  'auth.lowercase':'Lowercase',
  'auth.digit':'Number',
  'auth.symbol':'Symbol',
  'auth.create':'Create family space',
  'auth.login':'Sign in',
  'auth.working':'Please wait…',
  'shell.skip':'Skip to main content',
  'shell.expand':'Expand menu',
  'shell.collapse':'Collapse menu',
  'shell.activeFamily':'Active family',
  'shell.familyArea':'Local family space',
  'shell.familyBody':'This edition works with one family space stored on this device.',
  'shell.familySettings':'Open family settings',
  'shell.navigation':'Main navigation',
  'shell.localReady':'Local data ready',
  'shell.help':'Help',
  'shell.search':'Search…',
  'shell.searchAria':'Search in the application',
  'shell.notifications':'Notification center',
  'shell.everythingCurrent':'Everything is up to date',
  'shell.noNotifications':'There are no pending family notifications.',
  'shell.closeNotifications':'Close notifications',
  'shell.user':'Family user',
  'shell.localProfile':'Local profile',
  'shell.light':'Switch to light appearance',
  'shell.dark':'Switch to dark appearance',
  'shell.security':'Security Center',
  'shell.system':'System and maintenance',
  'shell.lock':'Lock now',
  'shell.logout':'Sign out of profile',
  'shell.loading':'Secure startup is being prepared…',
  'shell.loadingBody':'Family data and normal application screens stay closed until identity status is verified.',
  'common.retry':'Try again'
} as const;

export type UiMessageKey = keyof typeof englishMessages;

const turkishMessages: Record<UiMessageKey, string> = {
  'brand.subtitle':'Aile Yaşam Merkezi',
  'intro.eyebrow':'İlk kurulum · 3 kısa adım',
  'intro.lead':'Aile hafızası, belgeler, sağlık, finans ve yaşam kayıtları için güvenli yerel merkez.',
  'intro.caption':'Sesli anlatım metni',
  'intro.audioMuted':'Ses kapalı; anlatım metni görünür.',
  'intro.audioUnavailable':'Bu cihazda yerel sesli anlatım kullanılamıyor; metin görünür.',
  'intro.audioError':'Sesli anlatım başlatılamadı; metin görünür.',
  'intro.audioPlaying':'Türkçe anlatım oynatılıyor.',
  'intro.audioReady':'Türkçe anlatım hazır.',
  'intro.slowSpeed':'Yavaş hız',
  'intro.normalSpeed':'Normal hız',
  'intro.unmute':'Sesi aç',
  'intro.mute':'Sesi kapat',
  'intro.stop':'Anlatımı durdur',
  'intro.restart':'Baştan anlat',
  'intro.normal':'Normal hız',
  'intro.slower':'Daha yavaş',
  'intro.start':'Güvenli kuruluma başla',
  'intro.skip':'Tanıtımı şimdilik geç',
  'security.eyebrow':'İlk kurulum · Güvenlik',
  'security.title':'Hesabınızı ve kurtarma yolunu güvenceye alın',
  'security.body':'Ana uygulama açılmadan önce iki aşamalı doğrulama ve kurtarma kodları oluşturulur. Bu adım tamamlanmadan kullanıcı verisi oturumu normal kullanıma geçmez.',
  'security.start':'Güvenlik kurulumunu başlat',
  'security.authenticator':'Authenticator kurulumu',
  'security.key':'Anahtar',
  'security.uri':'Kurulum URI',
  'security.recoveryCodes':'Kurtarma kodları',
  'security.copy':'Kurtarma kodlarını kopyala',
  'security.code':'Authenticator doğrulama kodu',
  'security.saved':'Kurtarma kodlarını güvenli bir yerde sakladım',
  'security.finish':'Güvenliği tamamla ve uygulamayı aç',
  'auth.private':'Yalnız size ait',
  'auth.story':'Ailenizin hikâyesi,\ntek ve güvenli bir yerde.',
  'auth.storyBody':'Soy ağacınızı, anılarınızı, önemli günlerinizi ve aile kayıtlarınızı internet hesabı açmadan yönetin.',
  'auth.localData':'Veriler bu bilgisayarda kalır',
  'auth.noOnlineAccount':'E-posta hesabı veya çevrim içi üyelik gerekmez.',
  'auth.welcomeBack':'Tekrar hoş geldiniz',
  'auth.firstStart':'İlk başlangıç',
  'auth.selectProfile':'Profilinizi seçin',
  'auth.createFamily':'Ailenizi oluşturalım',
  'auth.loginBody':'Aile yaşam alanınıza yerel parolanızla devam edin.',
  'auth.setupBody':'Birkaç bilgiyle kişisel aile alanınızı hazırlayın.',
  'auth.familyName':'Aile adı',
  'auth.familyPlaceholder':'Örn. Yılmaz Ailesi',
  'auth.fullName':'Adınız ve soyadınız',
  'auth.namePlaceholder':'Aile yöneticisinin adı',
  'auth.localProfiles':'Yerel profiller',
  'auth.admin':'Aile yöneticisi',
  'auth.member':'Aile üyesi',
  'auth.localPassword':'Yerel parola',
  'auth.passwordPlaceholder':'Parolanızı yazın',
  'auth.showPassword':'Parolayı göster',
  'auth.hidePassword':'Parolayı gizle',
  'auth.lengthComplete':'Uzunluk koşulu tamam',
  'auth.moreCharacters':'{count} karakter daha gerekli',
  'auth.uppercase':'Büyük harf',
  'auth.lowercase':'Küçük harf',
  'auth.digit':'Rakam',
  'auth.symbol':'Sembol',
  'auth.create':'Aile alanımı oluştur',
  'auth.login':'Giriş yap',
  'auth.working':'Bekleyin…',
  'shell.skip':'Ana içeriğe geç',
  'shell.expand':'Menüyü genişlet',
  'shell.collapse':'Menüyü daralt',
  'shell.activeFamily':'Aktif aile',
  'shell.familyArea':'Yerel aile alanı',
  'shell.familyBody':'Bu sürüm tek, cihazda saklanan aile alanıyla çalışır.',
  'shell.familySettings':'Aile ayarlarını aç',
  'shell.navigation':'Ana gezinme',
  'shell.localReady':'Yerel veri hazır',
  'shell.help':'Yardım',
  'shell.search':'Ara…',
  'shell.searchAria':'Uygulamada ara',
  'shell.notifications':'Bildirim merkezi',
  'shell.everythingCurrent':'Her şey güncel',
  'shell.noNotifications':'Bekleyen aile bildirimi bulunmuyor.',
  'shell.closeNotifications':'Bildirimleri kapat',
  'shell.user':'Aile kullanıcısı',
  'shell.localProfile':'Yerel profil',
  'shell.light':'Açık görünüme geç',
  'shell.dark':'Koyu görünüme geç',
  'shell.security':'Güvenlik Merkezi',
  'shell.system':'Sistem ve bakım',
  'shell.lock':'Şimdi kilitle',
  'shell.logout':'Profilden çıkış yap',
  'shell.loading':'Güvenli başlangıç hazırlanıyor…',
  'shell.loadingBody':'Kimlik durumu doğrulanmadan aile verileri ve normal uygulama ekranı açılmaz.',
  'common.retry':'Yeniden dene'
};

const messageCatalog: Record<SupportedUiLanguage, Record<UiMessageKey, string>> = {
  en: englishMessages,
  tr: turkishMessages
};

let activeLocalization: UiLocalizationBootstrapView = DEFAULT_UI_LOCALIZATION;

export const configureUiLocalization = (value: UiLocalizationBootstrapView): void => {
  activeLocalization = value;
};

export const getActiveUiLocalization = (): UiLocalizationBootstrapView => activeLocalization;
export const getActiveUiLocale = (): string => activeLocalization.locale;

export const selectUiCopy = (language: SupportedUiLanguage, turkish: string, english: string): string =>
  language === 'tr' ? turkish : english;

const englishNavigationLabels: Record<ProductScreenId, string> = {
  dashboard:'Dashboard', family:'Family', households:'Households and Branches',
  'people-lifecycle':'Person Profiles', tree:'Family Tree', timeline:'Timeline',
  'important-days':'Important Dates', archive:'Archive', finance:'Finance', health:'Health',
  'life-center':'Life Center', automation:'Notifications and Automation', reports:'Reports',
  location:'Location', invitations:'Invitations', 'data-repair':'Data Repair Center',
  permissions:'Contextual Permissions', ai:'Artificial Intelligence', legacy:'Digital Legacy',
  'windows-hello':'Windows Hello', security:'Security Center', settings:'System and Maintenance'
};

const englishNavigationGroups: Record<ProductNavigationGroupId, string> = {
  main:'Main Center', 'family-memory':'Family Memory', life:'Life', 'privacy-system':'Privacy and System'
};

export const localizeNavigationLabel = (id: ProductScreenId, turkishLabel: string): string =>
  activeLocalization.language === 'tr' ? turkishLabel : englishNavigationLabels[id];

export const localizeNavigationGroup = (id: ProductNavigationGroupId, turkishLabel: string): string =>
  activeLocalization.language === 'tr' ? turkishLabel : englishNavigationGroups[id];

export const translateUiMessage = (
  key: UiMessageKey,
  variables: Readonly<Record<string, string | number>> = {}
): string => Object.entries(variables).reduce(
  (message, [name, value]) => message.replaceAll(`{${name}}`, String(value)),
  messageCatalog[activeLocalization.language][key]
);

interface LocalizationContextValue {
  readonly bootstrap: UiLocalizationBootstrapView;
  readonly language: SupportedUiLanguage;
  readonly locale: string;
  readonly t: typeof translateUiMessage;
}

const LocalizationContext = createContext<LocalizationContextValue>({
  bootstrap: DEFAULT_UI_LOCALIZATION,
  language: DEFAULT_UI_LOCALIZATION.language,
  locale: DEFAULT_UI_LOCALIZATION.locale,
  t: translateUiMessage
});

export function LocalizationProvider({
  bootstrap,
  children
}: {
  readonly bootstrap: UiLocalizationBootstrapView;
  readonly children: ReactNode;
}) {
  return <LocalizationContext.Provider value={{
    bootstrap,
    language: bootstrap.language,
    locale: bootstrap.locale,
    t: translateUiMessage
  }}>{children}</LocalizationContext.Provider>;
}

export const useLocalization = (): LocalizationContextValue => useContext(LocalizationContext);

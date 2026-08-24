import { useMemo, useState } from 'react';
import type {
  FamilyEmergencyChecklistStatus,
  FamilyEmergencyCardFieldCode,
  FamilyEmergencyCardOutputMode,
  FamilyEmergencyCardSourceItemType,
  FamilyEmergencyCardPowerSource,
  FamilyEmergencyAssistanceInstructionKind,
  FamilyEmergencyAssistanceItemType,
  FamilyEmergencyAssistanceSubjectKind,
  FamilyEmergencyBloodType,
  FamilyEmergencyDrillKind,
  FamilyEmergencyDrillStatus,
  FamilyEmergencyItemType,
  FamilyEmergencyMeetingPointKind,
  FamilyEmergencyHealthFactKind,
  FamilyEmergencyMemberStatus,
  FamilyEmergencyPlanKind,
  FamilyEmergencyPreparednessCheckStatus,
  FamilyEmergencyPreparednessItemType,
  FamilyEmergencyPreparednessKitItemCategory,
  FamilyEmergencyPreparednessKitKind,
  FamilyEmergencyPreparednessQuantityUnit,
  FamilyMemberView,
  LifeRecordStatus,
  ManagedHomeInventoryItemType,
  ManagedHomeInventoryLedgerItemView,
  ManagedLifeActivityKind,
  ManagedLifeCategory,
  ManagedLifeDocumentKind,
  ManagedLifeProfileView,
  ManagedLifeReminderKind,
  ManagedLifeWorkspaceView,
  RecordManagedHomeInventoryItemInput,
  RecordFamilyEmergencyItemInput,
  RecordFamilyEmergencyAssistanceItemInput,
  RecordFamilyEmergencyPreparednessItemInput,
  RecordManagedLifeItemInput,
  RecordPrivacy,
  SupportedUiLanguage
} from '@ppt/domain';
import { Button, EmptyState, SectionHeader, StatusMessage, Surface } from './ui';
import { useLocalization } from './localization';
import { localizeManagedLifeNode, translateManagedLifeCopy } from './YonetilenYasamYerellestirme';
import { toUserFacingErrorMessage } from './user-facing-error';

interface ManagedLifePanelProps {
  readonly people: readonly FamilyMemberView[];
  readonly workspace: ManagedLifeWorkspaceView | undefined;
  readonly onRecord: (input: RecordManagedLifeItemInput) => Promise<void>;
}

type PanelMode = 'profile'|'activity'|'life_document'|'home_inventory'|'emergency';
const managedLifeProfileStatusCopy:Readonly<Record<LifeRecordStatus,string>>={
  planned:'Planlandı',active:'Aktif',completed:'Tamamlandı',expired:'Süresi doldu',cancelled:'İptal'
};
const emergencyCardSourceTypeCopy:Readonly<Record<FamilyEmergencyCardSourceItemType,readonly [turkish:string,english:string]>>={
  emergency_profile:['Acil durum profili','Emergency profile'],health_fact:['Sağlık bilgisi','Health information'],
  emergency_contact:['Acil irtibat','Emergency contact'],assistance_instruction:['Yardım talimatı','Assistance instruction']
};
const emergencyCardPowerSourceCopy:Readonly<Record<FamilyEmergencyCardPowerSource,readonly [turkish:string,english:string]>>={
  battery:['Pil','Battery'],ac:['Şebeke gücü','AC power'],unknown:['Bilinmiyor','Unknown']
};
export const managedLifeProfileStatusLabel=(status:LifeRecordStatus,language:SupportedUiLanguage):string=>
  translateManagedLifeCopy(managedLifeProfileStatusCopy[status],language);
type HomeRoomKind = 'living_room'|'bedroom'|'kitchen'|'bathroom'|'storage'|'garage'|'garden'|'other';
type HomeMeterKind = 'electricity'|'water'|'natural_gas'|'other';
type HomeReadingUnit = 'wh'|'milliliter'|'milliliter_cubic_meter_equivalent'|'custom_milliunit';
type HomeReadingKind = 'reading'|'reset'|'replacement';
type HomeBelongingKind = 'appliance'|'electronics'|'furniture'|'tool'|'other';
type HomeServiceKind = 'maintenance'|'repair'|'inspection'|'installation'|'other';
type HomeDocumentKind = 'invoice'|'warranty'|'service_receipt'|'meter_document'|'other';
type HomeServiceTargetType = 'room'|'meter'|'belonging';
type HomeDocumentTargetType = 'meter'|'belonging'|'warranty'|'service';
type HomeInventoryTargetType = HomeServiceTargetType|'warranty'|'service';
type FamilyEmergencyEntryType = FamilyEmergencyItemType|FamilyEmergencyPreparednessItemType|FamilyEmergencyAssistanceItemType;

const categoryLabels: Record<ManagedLifeCategory, string> = {
  insurance: 'Sigorta', subscription: 'Abonelik', education: 'Eğitim', employment: 'İstihdam',
  official_operation: 'Resmî işlem', home: 'Ev', vehicle: 'Araç'
};
const reminderLabels: Record<ManagedLifeReminderKind, string> = {
  renewal: 'Yenileme', expiry: 'Süre sonu', payment: 'Ödeme', term: 'Dönem',
  contract_end: 'Sözleşme sonu', official_deadline: 'Resmî son tarih', rent: 'Kira',
  insurance: 'Sigorta', inspection: 'Muayene', maintenance: 'Bakım', other: 'Diğer'
};
const activityLabels: Record<ManagedLifeActivityKind, string> = {
  renewal: 'Yenileme', rent_payment: 'Kira kaydı', insurance_premium: 'Sigorta primi',
  inspection: 'Muayene', maintenance: 'Bakım', service: 'Servis', fuel: 'Yakıt',
  charging: 'Şarj', expense: 'Gider'
};
const documentLabels: Record<ManagedLifeDocumentKind, string> = {
  policy: 'Poliçe', contract: 'Sözleşme', certificate: 'Belge / sertifika',
  application_receipt: 'Başvuru alındısı', invoice: 'Fatura', lease: 'Kira sözleşmesi',
  deed: 'Tapu', dask_policy: 'DASK poliçesi', home_insurance_policy: 'Konut poliçesi',
  vehicle_registration: 'Araç ruhsatı', vehicle_insurance_policy: 'Araç sigorta poliçesi',
  inspection_report: 'Muayene raporu', service_receipt: 'Servis fişi',
  fuel_receipt: 'Yakıt fişi', charging_receipt: 'Şarj fişi', other: 'Diğer'
};
const homeInventoryLabels: Record<ManagedHomeInventoryItemType, string> = {
  room: 'Ev alanı / oda', meter: 'Sayaç', meter_reading: 'Sayaç okuması', belonging: 'Eşya',
  warranty: 'Garanti', service: 'Servis', document: 'Belge bağı'
};
const roomKindLabels: Record<HomeRoomKind, string> = {
  living_room: 'Oturma odası', bedroom: 'Yatak odası', kitchen: 'Mutfak', bathroom: 'Banyo',
  storage: 'Depo', garage: 'Garaj', garden: 'Bahçe', other: 'Diğer alan'
};
const meterKindLabels: Record<HomeMeterKind, string> = {
  electricity: 'Elektrik', water: 'Su', natural_gas: 'Doğal gaz', other: 'Diğer sayaç'
};
const readingKindLabels: Record<HomeReadingKind, string> = {
  reading: 'Normal okuma', reset: 'Sayaç sıfırlama', replacement: 'Sayaç değişimi'
};
const belongingKindLabels: Record<HomeBelongingKind, string> = {
  appliance: 'Beyaz eşya / cihaz', electronics: 'Elektronik', furniture: 'Mobilya',
  tool: 'Alet / ekipman', other: 'Diğer eşya'
};
const serviceKindLabels: Record<HomeServiceKind, string> = {
  maintenance: 'Bakım', repair: 'Onarım', inspection: 'Kontrol', installation: 'Kurulum', other: 'Diğer'
};
const homeDocumentKindLabels: Record<HomeDocumentKind, string> = {
  invoice: 'Fatura', warranty: 'Garanti belgesi', service_receipt: 'Servis fişi',
  meter_document: 'Sayaç belgesi', other: 'Diğer belge'
};
const readingUnitFor: Record<HomeMeterKind, HomeReadingUnit> = {
  electricity: 'wh', water: 'milliliter', natural_gas: 'milliliter_cubic_meter_equivalent',
  other: 'custom_milliunit'
};
const readingUnitLabels: Record<HomeReadingUnit, string> = {
  wh: 'Wh', milliliter: 'ml', milliliter_cubic_meter_equivalent: 'ml (m³ eşdeğeri)',
  custom_milliunit: 'özel mili-birim'
};
const emergencyItemLabels: Record<FamilyEmergencyItemType, string> = {
  emergency_plan: 'Afet / tahliye planı', meeting_point: 'Buluşma noktası',
  external_contact: 'Şehir dışı irtibat', checklist_item: 'Kontrol listesi maddesi',
  checklist_status: 'Kontrol listesi durumu', member_status: 'Aile üyesi durumu'
};
const preparednessItemLabels: Record<FamilyEmergencyPreparednessItemType, string> = {
  preparedness_kit: 'Hazırlık kiti', preparedness_kit_item: 'Kit malzemesi',
  preparedness_kit_check: 'Malzeme kontrolü', emergency_drill: 'Acil durum tatbikatı'
};
const assistanceItemLabels: Record<FamilyEmergencyAssistanceItemType, string> = {
  emergency_profile: 'Acil sağlık ve iletişim kartı', health_fact: 'Sağlık bilgisi',
  emergency_contact: 'Kart acil irtibatı', assistance_instruction: 'Özel yardım planı'
};
const emergencyEntryLabels: Record<FamilyEmergencyEntryType, string> = {
  ...emergencyItemLabels,
  ...preparednessItemLabels,
  ...assistanceItemLabels
};
const emergencyPlanKindLabels: Record<FamilyEmergencyPlanKind, string> = {
  general: 'Genel acil durum', earthquake: 'Deprem', fire: 'Yangın', flood: 'Sel',
  evacuation: 'Tahliye', other: 'Diğer'
};
const emergencyMeetingPointLabels: Record<FamilyEmergencyMeetingPointKind, string> = {
  primary: 'Birincil buluşma noktası', alternate: 'Alternatif buluşma noktası'
};
const emergencyMemberStatusLabels: Record<FamilyEmergencyMemberStatus, string> = {
  safe: 'İyiyim', needs_help: 'Yardım lazım'
};
const preparednessKitKindLabels: Record<FamilyEmergencyPreparednessKitKind, string> = {
  household_72_hour: 'Ev 72 saat kiti', vehicle: 'Araç kiti', workplace: 'İş yeri kiti', other: 'Diğer kit'
};
const preparednessCategoryLabels: Record<FamilyEmergencyPreparednessKitItemCategory, string> = {
  water: 'Su', food: 'Gıda', first_aid: 'İlk yardım', hygiene: 'Hijyen',
  lighting_power: 'Aydınlatma / güç', communication: 'İletişim',
  clothing_shelter: 'Giyim / barınma', document_copy: 'Belge kopyası', tool: 'Araç / gereç', other: 'Diğer'
};
const preparednessQuantityUnitLabels: Record<FamilyEmergencyPreparednessQuantityUnit, string> = {
  item: 'adet', liter: 'litre', kilogram: 'kilogram', dose: 'doz', meter: 'metre', other: 'diğer birim'
};
const preparednessCheckStatusLabels: Record<FamilyEmergencyPreparednessCheckStatus, string> = {
  ready: 'Hazır', low: 'Azaldı', missing: 'Eksik', expired: 'Süresi doldu', replace: 'Değiştirilmeli'
};
const emergencyDrillKindLabels: Record<FamilyEmergencyDrillKind, string> = {
  earthquake: 'Deprem', fire: 'Yangın', flood: 'Sel', power_outage: 'Elektrik kesintisi'
};
const emergencyDrillStatusLabels: Record<FamilyEmergencyDrillStatus, string> = {
  completed: 'Tamamlandı', partial: 'Kısmen tamamlandı', cancelled: 'İptal edildi'
};
const assistanceSubjectLabels: Record<FamilyEmergencyAssistanceSubjectKind, string> = {
  person: 'Aile üyesi', pet: 'Evcil hayvan'
};
const healthFactLabels: Record<FamilyEmergencyHealthFactKind, string> = {
  blood_type: 'Kan grubu', allergy: 'Alerji', chronic_condition: 'Kronik durum',
  medication: 'İlaç', medical_device: 'Tıbbi cihaz', other: 'Diğer sağlık bilgisi'
};
const bloodTypeLabels: Record<FamilyEmergencyBloodType, string> = {
  a_positive: 'A Rh+', a_negative: 'A Rh−', b_positive: 'B Rh+', b_negative: 'B Rh−',
  ab_positive: 'AB Rh+', ab_negative: 'AB Rh−', o_positive: '0 Rh+', o_negative: '0 Rh−',
  unknown: 'Bilinmiyor'
};
const assistanceInstructionLabels: Record<FamilyEmergencyAssistanceInstructionKind, string> = {
  mobility: 'Hareket desteği', vision: 'Görme desteği', hearing: 'İşitme desteği',
  communication: 'İletişim desteği', cognitive: 'Bilişsel destek',
  medication_support: 'İlaç desteği', evacuation: 'Tahliye desteği',
  pet_care: 'Evcil hayvan bakımı', other: 'Diğer özel yardım'
};
const emergencyCardFieldLabels:Record<FamilyEmergencyCardFieldCode,string> = {
  label:'Kart etiketi', subject_display:'Kart konusu', fact_value:'Sağlık bilgisi',
  name:'İrtibat adı', phone_e164:'Telefon', relationship:'Yakınlık', note:'Not',
  instruction_kind:'Yardım türü', instruction:'Yardım talimatı'
};
const emergencyCardFieldsBySource:Record<FamilyEmergencyCardSourceItemType,readonly FamilyEmergencyCardFieldCode[]> = {
  emergency_profile:['label','subject_display'], health_fact:['fact_value','note'],
  emergency_contact:['name','phone_e164','relationship','note'],
  assistance_instruction:['instruction_kind','instruction','note']
};
const emergencyCardOutputLabels:Record<FamilyEmergencyCardOutputMode,string> = {
  print:'Yazdır', pdf:'Düz PDF', encrypted_pack:'Şifreli belge paketi'
};

const remindersByCategory: Record<ManagedLifeCategory, readonly ManagedLifeReminderKind[]> = {
  insurance: ['renewal','expiry','payment','insurance','other'],
  subscription: ['renewal','payment','contract_end','other'],
  education: ['term','payment','expiry','other'], employment: ['contract_end','expiry','other'],
  official_operation: ['official_deadline','renewal','expiry','other'],
  home: ['rent','insurance','renewal','expiry','payment','maintenance','other'],
  vehicle: ['insurance','inspection','maintenance','renewal','expiry','payment','other']
};
const activitiesByCategory: Record<ManagedLifeCategory, readonly ManagedLifeActivityKind[]> = {
  insurance: ['renewal','insurance_premium','expense'], subscription: ['renewal','expense'],
  education: ['renewal','expense'], employment: ['renewal','expense'],
  official_operation: ['renewal','expense'],
  home: ['renewal','rent_payment','insurance_premium','maintenance','service','expense'],
  vehicle: ['renewal','insurance_premium','inspection','maintenance','service','fuel','charging','expense']
};
const documentsByCategory: Record<ManagedLifeCategory, readonly ManagedLifeDocumentKind[]> = {
  insurance: ['policy','contract','certificate','application_receipt','invoice','other'],
  subscription: ['contract','application_receipt','invoice','other'],
  education: ['contract','certificate','application_receipt','invoice','other'],
  employment: ['contract','certificate','application_receipt','other'],
  official_operation: ['certificate','application_receipt','invoice','other'],
  home: ['contract','invoice','lease','deed','dask_policy','home_insurance_policy','service_receipt','other'],
  vehicle: ['invoice','vehicle_registration','vehicle_insurance_policy','inspection_report','service_receipt','fuel_receipt','charging_receipt','other']
};

const localDateTime = (): string => {
  const value = new Date();
  return new Date(value.getTime() - value.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
};
const toIso = (value: string): string => new Date(value).toISOString();
const formatDate = (value: string, locale: string): string => new Intl.DateTimeFormat(locale, {
  dateStyle: 'short', timeStyle: 'short'
}).format(new Date(value));
const formatDateOnly = (value: string, locale: string): string => new Intl.DateTimeFormat(locale, {
  dateStyle: 'short', timeZone: 'UTC'
}).format(new Date(`${value}T00:00:00.000Z`));
const amountMinor = (value: string): number | undefined => value.trim()
  ? Math.round(Number(value) * 100)
  : undefined;
const milliunits = (value: string): number => Math.round(Number(value) * 1_000);
const exactPreparednessMilliunits = (value:string):number | undefined => {
  const match = /^(0|[1-9]\d*)(?:\.(\d{1,3}))?$/u.exec(value.trim());
  if (!match) return undefined;
  const whole = Number(match[1]);
  const fraction = Number((match[2] ?? '').padEnd(3, '0'));
  const result = whole * 1_000 + fraction;
  return Number.isSafeInteger(result) && result <= 9_000_000_000_000_000 ? result : undefined;
};

const profileSummary = (profile: ManagedLifeProfileView, language: SupportedUiLanguage): string => {
  switch (profile.category) {
    case 'insurance': return `${translateManagedLifeCopy(({dask:'DASK',home:'Konut',vehicle_compulsory:'Zorunlu trafik',vehicle_comprehensive:'Kasko',other:'Diğer'} as const)[profile.details.insuranceKind], language)} · ${profile.details.provider}`;
    case 'subscription': return `${profile.details.provider} · ${profile.details.planName}`;
    case 'education': return `${profile.details.institution} · ${profile.details.program}`;
    case 'employment': return `${profile.details.employer} · ${profile.details.position}`;
    case 'official_operation': return `${profile.details.authority} · ${profile.details.operationType}`;
    case 'home': return `${translateManagedLifeCopy(profile.details.tenure === 'owner' ? 'Mülk' : 'Kiralık', language)} · ${profile.details.addressLabel}`;
    case 'vehicle': return `${translateManagedLifeCopy(({car:'Otomobil',motorcycle:'Motosiklet',commercial:'Ticari',other:'Diğer'} as const)[profile.details.vehicleType], language)} · ${translateManagedLifeCopy(({fuel:'Yakıt',electric:'Elektrik',hybrid:'Hibrit',other:'Diğer'} as const)[profile.details.energyType], language)}${profile.details.plate ? ` · ${profile.details.plate}` : ''}`;
  }
};

const inventoryItemLabel = (item: ManagedHomeInventoryLedgerItemView, locale: string, language: SupportedUiLanguage): string => {
  switch (item.itemType) {
    case 'room': return item.name;
    case 'meter': return item.label;
    case 'meter_reading': return `${translateManagedLifeCopy(readingKindLabels[item.readingKind], language)} · ${formatDate(item.recordedAt, locale)}`;
    case 'belonging': return item.name;
    case 'warranty': return `${translateManagedLifeCopy('Garanti', language)} · ${formatDate(item.endsAt, locale)}`;
    case 'service': return `${translateManagedLifeCopy(serviceKindLabels[item.serviceKind], language)} · ${formatDate(item.occurredAt, locale)}`;
    case 'document': return item.label ?? translateManagedLifeCopy(homeDocumentKindLabels[item.documentKind], language);
  }
};

const inventoryItemDetail = (
  item: ManagedHomeInventoryLedgerItemView,
  allItems: readonly ManagedHomeInventoryLedgerItemView[],
  locale: string,
  language: SupportedUiLanguage
): string => {
  const corrected = item.supersedesItemId ? translateManagedLifeCopy(' · Düzeltme kaydı', language) : '';
  switch (item.itemType) {
    case 'room': return `${translateManagedLifeCopy(roomKindLabels[item.roomKind], language)}${corrected}`;
    case 'meter': return `${translateManagedLifeCopy(meterKindLabels[item.meterKind], language)} · ${translateManagedLifeCopy(readingUnitLabels[item.readingUnit], language)}${corrected}`;
    case 'meter_reading': {
      const meter = allItems.find((candidate) => candidate.itemType === 'meter' && candidate.id === item.meterId);
      const unit = translateManagedLifeCopy(meter?.itemType === 'meter' ? readingUnitLabels[meter.readingUnit] : 'mili-birim', language);
      return `${(item.readingMilliunits / 1_000).toLocaleString(locale)} ${unit}${item.note ? ` · ${item.note}` : ''}${corrected}`;
    }
    case 'belonging': return `${translateManagedLifeCopy(belongingKindLabels[item.belongingKind], language)}${item.serialNumberMasked ? ` · ${translateManagedLifeCopy('Seri', language)} ${item.serialNumberMasked}` : ''}${item.purchaseAmountMinor !== undefined ? ` · ${(item.purchaseAmountMinor / 100).toLocaleString(locale)} ${item.currency}` : ''}${corrected}`;
    case 'warranty': return `${item.provider ?? translateManagedLifeCopy('Sağlayıcı belirtilmedi', language)} · ${formatDate(item.startsAt, locale)} — ${formatDate(item.endsAt, locale)}${corrected}`;
    case 'service': return `${translateManagedLifeCopy(item.targetType === 'meter' ? 'Sayaç' : 'Eşya', language)} · ${item.provider ?? translateManagedLifeCopy('Sağlayıcı belirtilmedi', language)}${item.amountMinor !== undefined ? ` · ${(item.amountMinor / 100).toLocaleString(locale)} ${item.currency}` : ''}${corrected}`;
    case 'document': return `${translateManagedLifeCopy(homeDocumentKindLabels[item.documentKind], language)} · ${translateManagedLifeCopy('Arşiv belge bağlantısı:', language)} ${item.archiveItemId}${corrected}`;
  }
};

export function ManagedLifePanel({ people, workspace, onRecord }: ManagedLifePanelProps) {
  const { language, locale } = useLocalization();
  const [mode, setMode] = useState<PanelMode>('profile');
  const [ownerPersonId, setOwnerPersonId] = useState(people[0]?.id ?? '');
  const [category, setCategory] = useState<ManagedLifeCategory>('insurance');
  const [title, setTitle] = useState('');
  const [status, setStatus] = useState<'planned'|'active'|'completed'|'expired'|'cancelled'>('active');
  const [privacy, setPrivacy] = useState<RecordPrivacy>('private');
  const [detailA, setDetailA] = useState('');
  const [detailB, setDetailB] = useState('');
  const [detailC, setDetailC] = useState('');
  const [reminderKind, setReminderKind] = useState<ManagedLifeReminderKind>('renewal');
  const [reminderAt, setReminderAt] = useState('');
  const [recordId, setRecordId] = useState('');
  const [activityKind, setActivityKind] = useState<ManagedLifeActivityKind>('renewal');
  const [occurredAt, setOccurredAt] = useState(localDateTime);
  const [provider, setProvider] = useState('');
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState('TRY');
  const [quantity, setQuantity] = useState('');
  const [odometerKm, setOdometerKm] = useState('');
  const [note, setNote] = useState('');
  const [nextReminderAt, setNextReminderAt] = useState('');
  const [archiveItemId, setArchiveItemId] = useState('');
  const [documentKind, setDocumentKind] = useState<ManagedLifeDocumentKind>('policy');
  const [documentLabel, setDocumentLabel] = useState('');

  const [inventoryType, setInventoryType] = useState<ManagedHomeInventoryItemType>('room');
  const [roomName, setRoomName] = useState('');
  const [roomKind, setRoomKind] = useState<HomeRoomKind>('living_room');
  const [roomId, setRoomId] = useState('');
  const [meterLabel, setMeterLabel] = useState('');
  const [meterKind, setMeterKind] = useState<HomeMeterKind>('electricity');
  const [meterId, setMeterId] = useState('');
  const [readingKind, setReadingKind] = useState<HomeReadingKind>('reading');
  const [readingValue, setReadingValue] = useState('');
  const [readingAt, setReadingAt] = useState(localDateTime);
  const [belongingName, setBelongingName] = useState('');
  const [belongingKind, setBelongingKind] = useState<HomeBelongingKind>('appliance');
  const [serialNumber, setSerialNumber] = useState('');
  const [purchasedAt, setPurchasedAt] = useState('');
  const [financeExpenseId, setFinanceExpenseId] = useState('');
  const [belongingId, setBelongingId] = useState('');
  const [warrantyStartsAt, setWarrantyStartsAt] = useState('');
  const [warrantyEndsAt, setWarrantyEndsAt] = useState('');
  const [warrantyReminderAt, setWarrantyReminderAt] = useState('');
  const [targetType, setTargetType] = useState<HomeInventoryTargetType>('belonging');
  const [targetItemId, setTargetItemId] = useState('');
  const [serviceKind, setServiceKind] = useState<HomeServiceKind>('maintenance');
  const [homeDocumentKind, setHomeDocumentKind] = useState<HomeDocumentKind>('invoice');
  const [supersedesItemId, setSupersedesItemId] = useState('');

  const [emergencyType, setEmergencyType] = useState<FamilyEmergencyEntryType>('emergency_plan');
  const [emergencyPlanId, setEmergencyPlanId] = useState('');
  const [emergencyPlanKind, setEmergencyPlanKind] = useState<FamilyEmergencyPlanKind>('general');
  const [emergencyTitle, setEmergencyTitle] = useState('');
  const [evacuationInstructions, setEvacuationInstructions] = useState('');
  const [meetingPointKind, setMeetingPointKind] = useState<FamilyEmergencyMeetingPointKind>('primary');
  const [meetingPointLabel, setMeetingPointLabel] = useState('');
  const [meetingPointAddress, setMeetingPointAddress] = useState('');
  const [meetingPointDirections, setMeetingPointDirections] = useState('');
  const [contactName, setContactName] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [contactCity, setContactCity] = useState('');
  const [checklistLabel, setChecklistLabel] = useState('');
  const [checklistSortOrder, setChecklistSortOrder] = useState('0');
  const [checklistItemId, setChecklistItemId] = useState('');
  const [checklistStatus, setChecklistStatus] = useState<FamilyEmergencyChecklistStatus>('open');
  const [memberPersonId, setMemberPersonId] = useState(people[0]?.id ?? '');
  const [memberStatus, setMemberStatus] = useState<FamilyEmergencyMemberStatus>('safe');
  const [memberStatusAt, setMemberStatusAt] = useState(localDateTime);
  const [emergencyNote, setEmergencyNote] = useState('');
  const [emergencySupersedesItemId, setEmergencySupersedesItemId] = useState('');
  const [preparednessKitKind, setPreparednessKitKind] = useState<FamilyEmergencyPreparednessKitKind>('household_72_hour');
  const [preparednessLabel, setPreparednessLabel] = useState('');
  const [preparednessKitId, setPreparednessKitId] = useState('');
  const [preparednessCategory, setPreparednessCategory] = useState<FamilyEmergencyPreparednessKitItemCategory>('water');
  const [preparednessTargetQuantity, setPreparednessTargetQuantity] = useState('1');
  const [preparednessQuantityUnit, setPreparednessQuantityUnit] = useState<FamilyEmergencyPreparednessQuantityUnit>('item');
  const [preparednessExpiresOn, setPreparednessExpiresOn] = useState('');
  const [preparednessKitItemId, setPreparednessKitItemId] = useState('');
  const [preparednessCheckStatus, setPreparednessCheckStatus] = useState<FamilyEmergencyPreparednessCheckStatus>('ready');
  const [preparednessActualQuantity, setPreparednessActualQuantity] = useState('1');
  const [preparednessCheckedAt, setPreparednessCheckedAt] = useState(localDateTime);
  const [emergencyDrillKind, setEmergencyDrillKind] = useState<FamilyEmergencyDrillKind>('earthquake');
  const [emergencyDrillStatus, setEmergencyDrillStatus] = useState<FamilyEmergencyDrillStatus>('completed');
  const [emergencyDrillAt, setEmergencyDrillAt] = useState(localDateTime);
  const [emergencyDrillDuration, setEmergencyDrillDuration] = useState('');
  const [assistanceLabel, setAssistanceLabel] = useState('');
  const [assistanceSubjectKind, setAssistanceSubjectKind] = useState<FamilyEmergencyAssistanceSubjectKind>('person');
  const [assistanceSubjectPersonId, setAssistanceSubjectPersonId] = useState(people[0]?.id ?? '');
  const [assistanceSubjectPetId, setAssistanceSubjectPetId] = useState('');
  const [assistanceResponsiblePersonId, setAssistanceResponsiblePersonId] = useState(people[0]?.id ?? '');
  const [assistanceProfileId, setAssistanceProfileId] = useState('');
  const [healthFactKind, setHealthFactKind] = useState<FamilyEmergencyHealthFactKind>('blood_type');
  const [bloodType, setBloodType] = useState<FamilyEmergencyBloodType>('unknown');
  const [healthFactValue, setHealthFactValue] = useState('');
  const [assistanceRelationship, setAssistanceRelationship] = useState('');
  const [assistanceInstructionKind, setAssistanceInstructionKind] = useState<FamilyEmergencyAssistanceInstructionKind>('mobility');
  const [assistanceInstruction, setAssistanceInstruction] = useState('');
  const [cardProfileId, setCardProfileId] = useState('');
  const [cardConfigurationId, setCardConfigurationId] = useState('');
  const [cardConfigurationLabel, setCardConfigurationLabel] = useState('');
  const [cardSourceItemId, setCardSourceItemId] = useState('');
  const [cardFieldCode, setCardFieldCode] = useState<FamilyEmergencyCardFieldCode>('label');
  const [cardArchiveItemId, setCardArchiveItemId] = useState('');
  const [cardOutputMode, setCardOutputMode] = useState<FamilyEmergencyCardOutputMode>('encrypted_pack');
  const [cardSelectedFieldIds, setCardSelectedFieldIds] = useState<readonly string[]>([]);
  const [cardDocumentLinkIds, setCardDocumentLinkIds] = useState<readonly string[]>([]);
  const [cardPassword, setCardPassword] = useState('');
  const [cardSecondFactorCode, setCardSecondFactorCode] = useState('');
  const [cardPackagePassphrase, setCardPackagePassphrase] = useState('');
  const [cardPlaintextWarningConfirmed, setCardPlaintextWarningConfirmed] = useState(false);
  const [cardBusy, setCardBusy] = useState(false);
  const [cardMessage, setCardMessage] = useState('');
  const [cardMessageTone, setCardMessageTone] = useState<'success'|'danger'>('success');
  const [message, setMessage] = useState('');
  const [messageTone, setMessageTone] = useState<'success'|'danger'>('success');

  const selectedProfile = workspace?.profiles.find((profile) => profile.id === recordId);
  const homeProfiles = workspace?.profiles.filter((profile) => profile.category === 'home') ?? [];
  const homeItems = workspace?.homeInventoryItems ?? [];
  const selectedHomeItems = homeItems.filter((item) => item.recordId === recordId);
  const rooms = selectedHomeItems.filter((item) => item.itemType === 'room');
  const meters = selectedHomeItems.filter((item) => item.itemType === 'meter');
  const belongings = selectedHomeItems.filter((item) => item.itemType === 'belonging');
  const warranties = selectedHomeItems.filter((item) => item.itemType === 'warranty');
  const services = selectedHomeItems.filter((item) => item.itemType === 'service');
  const availableActivities = selectedProfile ? activitiesByCategory[selectedProfile.category] : [];
  const availableDocuments = selectedProfile ? documentsByCategory[selectedProfile.category] : [];
  const selectedReminderKinds = selectedProfile
    ? remindersByCategory[selectedProfile.category]
    : remindersByCategory[category];
  const supersessionOptions = selectedHomeItems.filter((item) => item.itemType === inventoryType);
  const serviceTargets = targetType === 'room' ? rooms : targetType === 'meter' ? meters : belongings;
  const documentTargets = targetType === 'meter' ? meters
    : targetType === 'belonging' ? belongings
      : targetType === 'warranty' ? warranties : services;
  const personNames = useMemo(() => new Map(people.map((person) => [person.id, person.displayName])), [people]);
  const emergencyPlans = workspace?.emergencyPlans ?? [];
  const assistanceProfiles = workspace?.emergencyAssistanceProfiles ?? [];
  const preparednessKitCount = emergencyPlans.reduce((total, plan) => total + plan.preparednessKits.length, 0);
  const emergencyDrillCount = emergencyPlans.reduce((total, plan) => total + plan.emergencyDrills.length, 0);
  const selectedEmergencyPlan = emergencyPlans.find((plan) => plan.id === emergencyPlanId);
  const selectedPreparednessKit = selectedEmergencyPlan?.preparednessKits.find((kit) => kit.id === preparednessKitId);
  const preparednessKitItems = selectedEmergencyPlan?.preparednessKits.flatMap((kit) => kit.items) ?? [];
  const selectedPreparednessKitItem = preparednessKitItems.find((item) => item.id === preparednessKitItemId);
  const selectedAssistanceProfile = assistanceProfiles.find((item) => item.id === assistanceProfileId);
  const selectedCardProfile = assistanceProfiles.find((item) => item.id === cardProfileId);
  const cardConfigurations = selectedCardProfile?.cardConfigurations ?? [];
  const selectedCardConfiguration = cardConfigurations.find((item) => item.id === cardConfigurationId);
  const cardSourceOptions:{id:string;sourceItemType:FamilyEmergencyCardSourceItemType;label:string}[] = selectedCardProfile ? [
    { id:selectedCardProfile.id, sourceItemType:'emergency_profile', label:`${language === 'tr' ? 'Kart' : 'Card'} · ${selectedCardProfile.label}` },
    ...selectedCardProfile.healthFacts.map((item) => ({
      id:item.id, sourceItemType:'health_fact' as const, label:`${language === 'tr' ? 'Sağlık' : 'Health'} · ${translateManagedLifeCopy(healthFactLabels[item.factKind], language)}`
    })),
    ...selectedCardProfile.emergencyContacts.map((item) => ({
      id:item.id, sourceItemType:'emergency_contact' as const, label:`${language === 'tr' ? 'İrtibat' : 'Contact'} · ${item.name}`
    })),
    ...selectedCardProfile.assistanceInstructions.map((item) => ({
      id:item.id, sourceItemType:'assistance_instruction' as const,
      label:`${language === 'tr' ? 'Yardım' : 'Assistance'} · ${translateManagedLifeCopy(assistanceInstructionLabels[item.instructionKind], language)}`
    }))
  ] : [];
  const selectedCardSource = cardSourceOptions.find((item) => item.id === cardSourceItemId);
  const availableCardFields = selectedCardSource
    ? emergencyCardFieldsBySource[selectedCardSource.sourceItemType]
    : emergencyCardFieldsBySource.emergency_profile;
  const emergencyCorrectionOptions = emergencyType === 'meeting_point'
    ? selectedEmergencyPlan?.meetingPoints ?? []
    : emergencyType === 'external_contact'
      ? selectedEmergencyPlan?.externalContacts ?? []
      : emergencyType === 'checklist_item'
        ? selectedEmergencyPlan?.checklistItems ?? [] : [];
  const preparednessCorrectionOptions = emergencyType === 'preparedness_kit'
    ? selectedEmergencyPlan?.preparednessKits ?? []
    : emergencyType === 'preparedness_kit_item'
      ? selectedPreparednessKit?.items ?? []
      : emergencyType === 'emergency_drill'
        ? selectedEmergencyPlan?.emergencyDrills ?? [] : [];
  const assistanceCorrectionOptions = emergencyType === 'health_fact'
    ? selectedAssistanceProfile?.healthFacts.filter((item) => item.factKind === healthFactKind) ?? []
    : emergencyType === 'emergency_contact'
      ? selectedAssistanceProfile?.emergencyContacts ?? []
      : emergencyType === 'assistance_instruction'
        ? selectedAssistanceProfile?.assistanceInstructions.filter(
          (item) => item.instructionKind === assistanceInstructionKind
        ) ?? [] : [];
  const assistanceChildType = emergencyType === 'health_fact'
    || emergencyType === 'emergency_contact'
    || emergencyType === 'assistance_instruction';

  const changeCategory = (next: ManagedLifeCategory) => {
    setCategory(next);
    setDetailA(next === 'home' ? 'owner' : next === 'vehicle' ? 'car' : '');
    setDetailB(next === 'home' ? 'residence' : next === 'vehicle' ? 'fuel' : '');
    setDetailC(next === 'subscription' ? 'monthly' : '');
    setReminderKind(remindersByCategory[next][0]!);
  };
  const changeProfile = (id: string) => {
    setRecordId(id);
    setRoomId(''); setMeterId(''); setBelongingId(''); setTargetItemId(''); setSupersedesItemId('');
    const profile = workspace?.profiles.find((candidate) => candidate.id === id);
    if (!profile) return;
    setActivityKind(activitiesByCategory[profile.category][0]!);
    setDocumentKind(documentsByCategory[profile.category][0]!);
    setReminderKind(remindersByCategory[profile.category][0]!);
  };
  const changeInventoryType = (next: ManagedHomeInventoryItemType) => {
    setInventoryType(next); setSupersedesItemId(''); setTargetItemId('');
    if (next === 'service') setTargetType('belonging');
    if (next === 'document') setTargetType('belonging');
  };
  const changeEmergencyType = (next: FamilyEmergencyEntryType) => {
    setEmergencyType(next); setEmergencySupersedesItemId(''); setChecklistItemId('');
    setPreparednessKitId(''); setPreparednessKitItemId('');
    setAssistanceProfileId('');
  };
  const changeCardProfile = (profileId:string) => {
    setCardProfileId(profileId); setCardConfigurationId(''); setCardSourceItemId('');
    setCardSelectedFieldIds([]); setCardDocumentLinkIds([]); setCardMessage('');
  };
  const changeCardConfiguration = (configurationId:string) => {
    setCardConfigurationId(configurationId); setCardSelectedFieldIds([]);
    setCardDocumentLinkIds([]); setCardMessage('');
  };
  const changeCardSource = (sourceItemId:string) => {
    setCardSourceItemId(sourceItemId);
    const source = cardSourceOptions.find((item) => item.id === sourceItemId);
    setCardFieldCode(source ? emergencyCardFieldsBySource[source.sourceItemType][0]! : 'label');
  };
  const toggleCardSelection = (
    id:string,
    current:readonly string[],
    update:(value:readonly string[])=>void
  ) => update(current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  const recordCardConfiguration = async () => {
    try {
      setCardMessage('');
      await onRecord({
        itemType:'card_configuration', profileId:cardProfileId,
        label:cardConfigurationLabel, locale:'tr-TR'
      });
      setCardConfigurationLabel(''); setCardMessageTone('success');
      setCardMessage('Çevrimdışı kart yapılandırması kaydedildi.');
    } catch (error) {
      setCardMessageTone('danger'); setCardMessage(toUserFacingErrorMessage(error, translateManagedLifeCopy('Yapılandırma kaydedilemedi.', language)));
    }
  };
  const recordCardSelectedField = async () => {
    if (!selectedCardSource) return;
    try {
      setCardMessage('');
      await onRecord({
        itemType:'selected_field', profileId:cardProfileId, configurationId:cardConfigurationId,
        sourceItemId:selectedCardSource.id, sourceItemType:selectedCardSource.sourceItemType, fieldCode:cardFieldCode
      });
      setCardMessageTone('success'); setCardMessage('Kapalı matristen seçilen alan kaydedildi.');
    } catch (error) {
      setCardMessageTone('danger'); setCardMessage(toUserFacingErrorMessage(error, translateManagedLifeCopy('Alan seçimi kaydedilemedi.', language)));
    }
  };
  const recordCardDocumentLink = async () => {
    try {
      setCardMessage('');
      await onRecord({
        itemType:'document_link', profileId:cardProfileId,
        configurationId:cardConfigurationId, archiveItemId:cardArchiveItemId
      });
      setCardArchiveItemId(''); setCardMessageTone('success');
      setCardMessage('Arşiv belge bağlantısı kaydedildi; belge içeriği okunmadı.');
    } catch (error) {
      setCardMessageTone('danger'); setCardMessage(toUserFacingErrorMessage(error, translateManagedLifeCopy('Belge bağı kaydedilemedi.', language)));
    }
  };
  const recordCardPowerMode = async (enabled:boolean) => {
    try {
      setCardMessage('');
      await onRecord({
        itemType:'power_mode_event', profileId:cardProfileId, configurationId:cardConfigurationId,
        mode:enabled ? 'enabled' : 'disabled', activationSource:'manual', powerSource:'unknown',
        batteryLevel:'not_measured', automaticLowBatteryDetection:'not_performed', lowBatteryClaimed:false
      });
      setCardMessageTone('success');
      setCardMessage(`Pil-duyarlı görünüm ${enabled ? 'açıldı' : 'kapatıldı'}; pil yüzdesi ölçülmedi.`);
    } catch (error) {
      setCardMessageTone('danger'); setCardMessage(toUserFacingErrorMessage(error, translateManagedLifeCopy('Güç kipi kaydedilemedi.', language)));
    }
  };
  const exportEmergencyCard = async () => {
    if (!window.pardus || !selectedCardConfiguration) return;
    setCardBusy(true); setCardMessage('');
    try {
      const result = await window.pardus.exportEmergencyCard({
        profileId:cardProfileId, configurationId:selectedCardConfiguration.id, mode:cardOutputMode,
        selectedFieldIds:cardSelectedFieldIds,
        documentLinkIds:cardOutputMode === 'encrypted_pack' ? cardDocumentLinkIds : [],
        password:cardPassword,
        ...(cardSecondFactorCode.trim() ? { code:cardSecondFactorCode } : {}),
        ...(cardOutputMode === 'encrypted_pack' ? { packagePassphrase:cardPackagePassphrase } : {}),
        plaintextWarningConfirmed:cardOutputMode === 'encrypted_pack' ? false : cardPlaintextWarningConfirmed
      });
      setCardMessageTone('success');
      setCardMessage(result.canceled
        ? translateManagedLifeCopy('Dışa aktarma kullanıcı tarafından iptal edildi.', language)
        : `${translateManagedLifeCopy(emergencyCardOutputLabels[result.mode], language)} ${language === 'tr' ? 'tamamlandı' : 'completed'} · ${result.artifactSizeBytes.toLocaleString(locale)} ${language === 'tr' ? 'bayt' : 'bytes'} · ${language === 'tr' ? (result.artifactReadbackStatus === 'verified' ? 'okuma doğrulandı' : 'yazıcıya gönderim doğrulandı') : (result.artifactReadbackStatus === 'verified' ? 'readback verified' : 'printer submission verified')}.`);
    } catch (error) {
      setCardMessageTone('danger'); setCardMessage(toUserFacingErrorMessage(error, translateManagedLifeCopy('Acil kart dışa aktarılamadı.', language)));
    } finally {
      setCardPassword(''); setCardSecondFactorCode(''); setCardPackagePassphrase(''); setCardBusy(false);
    }
  };

  const submitProfile = async () => {
    const common = {
      itemType: 'profile' as const, ownerPersonId, title, status, privacy,
      ...(reminderAt ? { initialReminder: { kind: reminderKind, dueAt: toIso(reminderAt) } } : {})
    };
    let input: RecordManagedLifeItemInput;
    switch (category) {
      case 'insurance': input = { ...common, category, details: { insuranceKind: (detailA || 'other') as 'dask'|'home'|'vehicle_compulsory'|'vehicle_comprehensive'|'other', provider: detailB } }; break;
      case 'subscription': input = { ...common, category, details: { provider: detailA, planName: detailB, billingCycle: (detailC || 'monthly') as 'monthly'|'quarterly'|'yearly'|'other' } }; break;
      case 'education': input = { ...common, category, details: { institution: detailA, program: detailB } }; break;
      case 'employment': input = { ...common, category, details: { employer: detailA, position: detailB } }; break;
      case 'official_operation': input = { ...common, category, details: { authority: detailA, operationType: detailB } }; break;
      case 'home': input = { ...common, category, details: { tenure: (detailA || 'owner') as 'owner'|'tenant', propertyType: (detailB || 'residence') as 'residence'|'workplace'|'land'|'other', addressLabel: detailC } }; break;
      case 'vehicle': input = { ...common, category, details: { vehicleType: (detailA || 'car') as 'car'|'motorcycle'|'commercial'|'other', energyType: (detailB || 'fuel') as 'fuel'|'electric'|'hybrid'|'other', ...(detailC.trim() ? { plate: detailC } : {}) } }; break;
    }
    await onRecord(input);
    setTitle(''); setReminderAt(''); setDetailA(''); setDetailB(''); setDetailC('');
  };
  const submitActivity = async () => {
    const minor = amountMinor(amount);
    const quantityMilliunits = quantity.trim() ? milliunits(quantity) : undefined;
    await onRecord({
      itemType: 'activity', recordId, activityKind, occurredAt: toIso(occurredAt),
      ...(provider.trim() ? { provider } : {}),
      ...(minor !== undefined ? { amountMinor: minor, currency } : {}),
      ...(quantityRequired && quantityMilliunits !== undefined ? { quantityMilliunits } : {}),
      ...(selectedProfile?.category === 'vehicle' && odometerKm.trim() ? { odometerKm: Number(odometerKm) } : {}),
      ...(nextReminderAt ? { reminderMutation: { action: 'set', kind: reminderKind, dueAt: toIso(nextReminderAt) } } : {}),
      ...(note.trim() ? { note } : {})
    });
    setAmount(''); setQuantity(''); setOdometerKm(''); setNote(''); setNextReminderAt('');
  };
  const submitLifeDocument = async () => {
    await onRecord({
      itemType: 'document', recordId, archiveItemId, documentKind,
      ...(documentLabel.trim() ? { label: documentLabel } : {})
    });
    setArchiveItemId(''); setDocumentLabel('');
  };
  const submitHomeInventory = async () => {
    const correction = supersedesItemId ? { supersedesItemId } : {};
    let input: RecordManagedHomeInventoryItemInput;
    switch (inventoryType) {
      case 'room': input = { itemType:'room', recordId, name:roomName, roomKind, ...correction }; break;
      case 'meter': input = { itemType:'meter', recordId, label:meterLabel, meterKind, readingUnit:readingUnitFor[meterKind], ...(roomId ? { roomId } : {}), ...correction }; break;
      case 'meter_reading': input = { itemType:'meter_reading', recordId, meterId, readingKind, readingMilliunits:milliunits(readingValue), recordedAt:toIso(readingAt), ...(note.trim() ? { note } : {}), ...correction }; break;
      case 'belonging': {
        const minor = amountMinor(amount);
        input = { itemType:'belonging', recordId, name:belongingName, belongingKind,
          ...(roomId ? { roomId } : {}), ...(serialNumber.trim() ? { serialNumber } : {}),
          ...(purchasedAt ? { purchasedAt:toIso(purchasedAt) } : {}),
          ...(financeExpenseId ? { financeExpenseId } : minor !== undefined ? { purchaseAmountMinor:minor, currency } : {}),
          ...correction };
        break;
      }
      case 'warranty': input = { itemType:'warranty', recordId, belongingId,
        ...(provider.trim() ? { provider } : {}), startsAt:toIso(warrantyStartsAt), endsAt:toIso(warrantyEndsAt),
        ...(warrantyReminderAt ? { reminderAt:toIso(warrantyReminderAt) } : {}), ...(note.trim() ? { note } : {}),
        ...correction }; break;
      case 'service': {
        const minor = amountMinor(amount);
        input = { itemType:'service', recordId, targetItemId, targetType:targetType as HomeServiceTargetType,
          serviceKind, occurredAt:toIso(occurredAt), ...(provider.trim() ? { provider } : {}),
          ...(financeExpenseId ? { financeExpenseId } : minor !== undefined ? { amountMinor:minor, currency } : {}),
          ...(note.trim() ? { note } : {}), ...correction };
        break;
      }
      case 'document': input = { itemType:'document', recordId, targetItemId, targetType:targetType as HomeDocumentTargetType,
        archiveItemId, documentKind:homeDocumentKind, ...(documentLabel.trim() ? { label:documentLabel } : {}),
        ...correction }; break;
    }
    await onRecord(input);
    setRoomName(''); setMeterLabel(''); setReadingValue(''); setBelongingName(''); setSerialNumber('');
    setPurchasedAt(''); setAmount(''); setFinanceExpenseId(''); setProvider(''); setNote('');
    setWarrantyStartsAt(''); setWarrantyEndsAt(''); setWarrantyReminderAt('');
    setArchiveItemId(''); setDocumentLabel(''); setSupersedesItemId('');
  };
  const submitEmergency = async () => {
    const correction = emergencySupersedesItemId ? { supersedesItemId:emergencySupersedesItemId } : {};
    let input:RecordFamilyEmergencyItemInput|RecordFamilyEmergencyPreparednessItemInput|RecordFamilyEmergencyAssistanceItemInput;
    switch (emergencyType) {
      case 'emergency_plan': input = {
        itemType:'emergency_plan', planKind:emergencyPlanKind, title:emergencyTitle,
        evacuationInstructions
      }; break;
      case 'meeting_point': input = {
        itemType:'meeting_point', planId:emergencyPlanId, meetingPointKind,
        label:meetingPointLabel, ...(meetingPointAddress.trim() ? { address:meetingPointAddress } : {}),
        ...(meetingPointDirections.trim() ? { directions:meetingPointDirections } : {}), ...correction
      }; break;
      case 'external_contact': input = {
        itemType:'external_contact', planId:emergencyPlanId, name:contactName,
        phoneE164:contactPhone, city:contactCity, ...(emergencyNote.trim() ? { note:emergencyNote } : {}),
        ...correction
      }; break;
      case 'checklist_item': input = {
        itemType:'checklist_item', planId:emergencyPlanId, label:checklistLabel,
        sortOrder:Number(checklistSortOrder), ...correction
      }; break;
      case 'checklist_status': input = {
        itemType:'checklist_status', planId:emergencyPlanId, checklistItemId, status:checklistStatus
      }; break;
      case 'member_status': input = {
        itemType:'member_status', planId:emergencyPlanId, memberPersonId, status:memberStatus,
        occurredAt:toIso(memberStatusAt), ...(emergencyNote.trim() ? { note:emergencyNote } : {})
      }; break;
      case 'preparedness_kit': input = {
        itemType:'preparedness_kit', planId:emergencyPlanId, kitKind:preparednessKitKind,
        label:preparednessLabel, ...correction
      }; break;
      case 'preparedness_kit_item': {
        const targetQuantityMilliunits = exactPreparednessMilliunits(preparednessTargetQuantity);
        if (targetQuantityMilliunits === undefined || targetQuantityMilliunits < 1) {
          throw new Error('Hedef miktar en fazla üç ondalıklı ve sıfırdan büyük olmalıdır.');
        }
        input = {
          itemType:'preparedness_kit_item', planId:emergencyPlanId, kitId:preparednessKitId,
          category:preparednessCategory, label:preparednessLabel,
          targetQuantityMilliunits, quantityUnit:preparednessQuantityUnit,
          ...(preparednessExpiresOn ? { expiresOn:preparednessExpiresOn } : {}), ...correction
        };
        break;
      }
      case 'preparedness_kit_check': {
        const actualQuantityMilliunits = exactPreparednessMilliunits(preparednessActualQuantity);
        if (actualQuantityMilliunits === undefined) {
          throw new Error('Mevcut miktar en fazla üç ondalıklı ve sıfır veya daha büyük olmalıdır.');
        }
        input = {
          itemType:'preparedness_kit_check', planId:emergencyPlanId, kitItemId:preparednessKitItemId,
          status:preparednessCheckStatus, actualQuantityMilliunits,
          checkedAt:toIso(preparednessCheckedAt), ...(emergencyNote.trim() ? { note:emergencyNote } : {})
        };
        break;
      }
      case 'emergency_drill': input = {
        itemType:'emergency_drill', planId:emergencyPlanId, drillKind:emergencyDrillKind,
        status:emergencyDrillStatus, occurredAt:toIso(emergencyDrillAt),
        ...(emergencyDrillDuration.trim() ? { durationSeconds:Number(emergencyDrillDuration) } : {}),
        ...(emergencyNote.trim() ? { note:emergencyNote } : {}), ...correction
      }; break;
      case 'emergency_profile': input = assistanceSubjectKind === 'person' ? {
        itemType:'emergency_profile', planId:emergencyPlanId, label:assistanceLabel,
        subjectKind:'person', subjectPersonId:assistanceSubjectPersonId
      } : {
        itemType:'emergency_profile', planId:emergencyPlanId, label:assistanceLabel,
        subjectKind:'pet', subjectPetId:assistanceSubjectPetId,
        responsiblePersonId:assistanceResponsiblePersonId
      }; break;
      case 'health_fact': input = healthFactKind === 'blood_type' ? {
        itemType:'health_fact', profileId:assistanceProfileId, factKind:'blood_type', bloodType,
        ...(emergencyNote.trim() ? { note:emergencyNote } : {}), ...correction
      } : {
        itemType:'health_fact', profileId:assistanceProfileId, factKind:healthFactKind,
        value:healthFactValue, ...(emergencyNote.trim() ? { note:emergencyNote } : {}), ...correction
      }; break;
      case 'emergency_contact': input = {
        itemType:'emergency_contact', profileId:assistanceProfileId, name:contactName,
        phoneE164:contactPhone,
        ...(assistanceRelationship.trim() ? { relationship:assistanceRelationship } : {}),
        ...(emergencyNote.trim() ? { note:emergencyNote } : {}), ...correction
      }; break;
      case 'assistance_instruction': input = {
        itemType:'assistance_instruction', profileId:assistanceProfileId,
        instructionKind:assistanceInstructionKind, instruction:assistanceInstruction,
        ...(emergencyNote.trim() ? { note:emergencyNote } : {}), ...correction
      }; break;
    }
    await onRecord(input);
    setEmergencyTitle(''); setEvacuationInstructions(''); setMeetingPointLabel('');
    setMeetingPointAddress(''); setMeetingPointDirections(''); setContactName(''); setContactPhone('');
    setContactCity(''); setChecklistLabel(''); setEmergencyNote(''); setEmergencySupersedesItemId('');
    setPreparednessLabel(''); setPreparednessTargetQuantity('1'); setPreparednessExpiresOn('');
    setPreparednessActualQuantity('1'); setEmergencyDrillDuration('');
    setAssistanceLabel(''); setAssistanceSubjectPetId(''); setAssistanceProfileId('');
    setHealthFactValue(''); setAssistanceRelationship(''); setAssistanceInstruction('');
  };
  const submit = async () => {
    try {
      setMessage('');
      if (mode === 'profile') await submitProfile();
      else if (mode === 'activity') await submitActivity();
      else if (mode === 'life_document') await submitLifeDocument();
      else if (mode === 'home_inventory') await submitHomeInventory();
      else await submitEmergency();
      setMessageTone('success'); setMessage('Kayıt güvenli yerel deftere eklendi.');
    } catch (error) {
      setMessageTone('danger'); setMessage(toUserFacingErrorMessage(error, translateManagedLifeCopy('Kayıt eklenemedi.', language)));
    }
  };

  const quantityRequired = activityKind === 'fuel' || activityKind === 'charging';
  const profileReady = ownerPersonId && title.trim().length >= 2 && detailA && detailB
    && (category !== 'home' || detailC.trim().length > 0);
  const activityReady = recordId && occurredAt && (!quantityRequired || Number(quantity) > 0);
  const lifeDocumentReady = recordId && /^[A-Za-z0-9][A-Za-z0-9._-]{0,159}$/u.test(archiveItemId);
  const homeInventoryReady = Boolean(recordId && (
    (inventoryType === 'room' && roomName.trim())
    || (inventoryType === 'meter' && meterLabel.trim())
    || (inventoryType === 'meter_reading' && meterId && readingAt && readingValue.trim()
      && Number(readingValue) >= 0 && (readingKind === 'reading' || note.trim().length >= 2))
    || (inventoryType === 'belonging' && belongingName.trim())
    || (inventoryType === 'warranty' && belongingId && warrantyStartsAt && warrantyEndsAt
      && Date.parse(warrantyEndsAt) >= Date.parse(warrantyStartsAt)
      && (!warrantyReminderAt || (Date.parse(warrantyReminderAt) >= Date.parse(warrantyStartsAt)
        && Date.parse(warrantyReminderAt) <= Date.parse(warrantyEndsAt))))
    || (inventoryType === 'service' && targetItemId && occurredAt)
    || (inventoryType === 'document' && targetItemId
      && /^[A-Za-z0-9][A-Za-z0-9._-]{0,159}$/u.test(archiveItemId))
  ));
  const emergencyReady = Boolean(
    (emergencyType === 'emergency_plan' && emergencyTitle.trim().length >= 2
      && evacuationInstructions.trim().length >= 2)
    || (emergencyType === 'meeting_point' && emergencyPlanId && meetingPointLabel.trim().length >= 2)
    || (emergencyType === 'external_contact' && emergencyPlanId && contactName.trim().length >= 2
      && /^\+[1-9][0-9]{7,14}$/u.test(contactPhone) && contactCity.trim().length >= 2)
    || (emergencyType === 'checklist_item' && emergencyPlanId && checklistLabel.trim().length >= 2
      && Number.isSafeInteger(Number(checklistSortOrder)) && Number(checklistSortOrder) >= 0
      && Number(checklistSortOrder) <= 10_000)
    || (emergencyType === 'checklist_status' && emergencyPlanId && checklistItemId)
    || (emergencyType === 'member_status' && emergencyPlanId && memberPersonId && memberStatusAt)
    || (emergencyType === 'preparedness_kit' && emergencyPlanId && preparednessLabel.trim().length >= 2)
    || (emergencyType === 'preparedness_kit_item' && emergencyPlanId && preparednessKitId
      && preparednessLabel.trim().length >= 2
      && (exactPreparednessMilliunits(preparednessTargetQuantity) ?? 0) >= 1)
    || (emergencyType === 'preparedness_kit_check' && emergencyPlanId && preparednessKitItemId
      && preparednessCheckedAt && exactPreparednessMilliunits(preparednessActualQuantity) !== undefined
      && (!emergencyNote.trim() || emergencyNote.trim().length >= 2))
    || (emergencyType === 'emergency_drill' && emergencyPlanId && emergencyDrillAt
      && (!emergencyDrillDuration.trim()
        || (Number.isSafeInteger(Number(emergencyDrillDuration))
          && Number(emergencyDrillDuration) >= 1 && Number(emergencyDrillDuration) <= 604_800))
      && (!emergencyNote.trim() || emergencyNote.trim().length >= 2))
    || (emergencyType === 'emergency_profile' && emergencyPlanId
      && assistanceLabel.trim().length >= 2
      && (assistanceSubjectKind === 'person' ? Boolean(assistanceSubjectPersonId)
        : Boolean(assistanceSubjectPetId && assistanceResponsiblePersonId)))
    || (emergencyType === 'health_fact' && assistanceProfileId
      && (healthFactKind === 'blood_type' || healthFactValue.trim().length >= 2)
      && (!emergencyNote.trim() || emergencyNote.trim().length >= 2))
    || (emergencyType === 'emergency_contact' && assistanceProfileId
      && contactName.trim().length >= 2 && /^\+[1-9][0-9]{7,14}$/u.test(contactPhone)
      && (!assistanceRelationship.trim() || assistanceRelationship.trim().length >= 2)
      && (!emergencyNote.trim() || emergencyNote.trim().length >= 2))
    || (emergencyType === 'assistance_instruction' && assistanceProfileId
      && assistanceInstruction.trim().length >= 2
      && (!emergencyNote.trim() || emergencyNote.trim().length >= 2))
  );
  const submitReady = mode === 'profile' ? profileReady
    : mode === 'activity' ? activityReady
      : mode === 'life_document' ? lifeDocumentReady
        : mode === 'home_inventory' ? homeInventoryReady : emergencyReady;

  const panel = <>
    <Surface className="span-2">
      <SectionHeader eyebrow="Bütünleşik aile yaşamı" title="Yaşam Merkezi, ev envanteri ve acil durum"/>
      <div className="button-row managed-life-mode-grid" role="group" aria-label="Yaşam kaydı türü">
        <Button tone={mode === 'profile' ? 'primary' : 'default'} onClick={() => setMode('profile')}>Profil</Button>
        <Button tone={mode === 'activity' ? 'primary' : 'default'} onClick={() => setMode('activity')}>Etkinlik / gider</Button>
        <Button tone={mode === 'life_document' ? 'primary' : 'default'} onClick={() => setMode('life_document')}>Profil belgesi</Button>
        <Button tone={mode === 'home_inventory' ? 'primary' : 'default'} onClick={() => setMode('home_inventory')}>Ev alanı ve envanter</Button>
        <Button tone={mode === 'emergency' ? 'primary' : 'default'} onClick={() => setMode('emergency')}>Acil durum merkezi</Button>
      </div>
      {mode === 'emergency' && <div className="notes-card family-emergency-warning" role="note">
        <strong>Çevrimdışı aile kaydıdır; acil yardım çağrısı değildir.</strong>
        <small>Harita veya canlı konum sorgulanmaz; SMS, e-posta ya da mesaj gönderilmez ve acil servis aranmaz.</small>
        <small>“Yardım lazım” durumu yalnız bu cihazdaki yetkili aile çalışma alanına kaydedilir. Teslim veya acil servis müdahale garantisi verilmez.</small>
        <small>Hazırlık kiti ve tatbikatlar manuel tutulur; barkod, son kullanma doğrulaması, bildirim veya sensör entegrasyonu yapılmaz. Hazır olma garantisi verilmez.</small>
        <small>Acil sağlık kartı ve özel yardım planı özeldir. Plan bağlantısı erişim vermez; görünürlük yalnız merkezi yetki kararıyla açılır.</small>
        <small>Sağlık bilgisi manuel beyan edilir ve klinik olarak doğrulanmaz. Telefon veya sağlık içeriği otomatik paylaşılmaz; yalnız açık alan seçimi, güçlü yeniden doğrulama ve yerel dosya politikasıyla kullanıcıya verilebilir.</small>
      </div>}
      <div className="notes-card managed-life-truth-card">
        <strong>Yalnız manuel, yerel takip</strong>
        <small>Akıllı sayaç, hizmet sağlayıcı veya garanti sicili sorgulanmaz; metin tanıma, servis rezervasyonu, ödeme ve ağ erişimi yapılmaz.</small>
        <small>Belge içeriği okunmaz. Dosya yolu, ham belge, kart güvenlik bilgileri, parola, erişim anahtarı veya gizli anahtar kabul edilmez.</small>
      </div>
    </Surface>

    <Surface className="workspace-form managed-life-form">
      <SectionHeader eyebrow="Yeni kayıt" title={mode === 'profile' ? 'Yaşam profili' : mode === 'activity' ? 'Etkinlik ve hatırlatma' : mode === 'life_document' ? 'Profil arşiv bağlantısı' : mode === 'home_inventory' ? 'Ev envanteri olayı' : 'Çevrimdışı acil durum kaydı'}/>
      {mode === 'profile' ? <>
        <label>Kayıt sahibi<select value={ownerPersonId} onChange={(event) => setOwnerPersonId(event.target.value)}>{people.map((person) => <option key={person.id} value={person.id}>{person.displayName}</option>)}</select></label>
        <label>Kategori<select value={category} onChange={(event) => changeCategory(event.target.value as ManagedLifeCategory)}>{Object.entries(categoryLabels).map(([value,label]) => <option key={value} value={value}>{label}</option>)}</select></label>
        <label>Başlık<input maxLength={120} value={title} onChange={(event) => setTitle(event.target.value)}/></label>
        <label>Durum<select value={status} onChange={(event) => setStatus(event.target.value as typeof status)}><option value="planned">Planlandı</option><option value="active">Aktif</option><option value="completed">Tamamlandı</option><option value="expired">Süresi doldu</option><option value="cancelled">İptal</option></select></label>
        {category === 'insurance' && <><label>Sigorta türü<select value={detailA} onChange={(event) => setDetailA(event.target.value)}><option value="">Seçin</option><option value="dask">DASK</option><option value="home">Konut</option><option value="vehicle_compulsory">Zorunlu trafik</option><option value="vehicle_comprehensive">Kasko</option><option value="other">Diğer</option></select></label><label>Sağlayıcı<input maxLength={160} value={detailB} onChange={(event) => setDetailB(event.target.value)}/></label></>}
        {category === 'subscription' && <><label>Sağlayıcı<input maxLength={160} value={detailA} onChange={(event) => setDetailA(event.target.value)}/></label><label>Plan adı<input maxLength={120} value={detailB} onChange={(event) => setDetailB(event.target.value)}/></label><label>Döngü<select value={detailC} onChange={(event) => setDetailC(event.target.value)}><option value="monthly">Aylık</option><option value="quarterly">Üç aylık</option><option value="yearly">Yıllık</option><option value="other">Diğer</option></select></label></>}
        {category === 'education' && <><label>Kurum<input maxLength={160} value={detailA} onChange={(event) => setDetailA(event.target.value)}/></label><label>Program<input maxLength={160} value={detailB} onChange={(event) => setDetailB(event.target.value)}/></label></>}
        {category === 'employment' && <><label>İşveren<input maxLength={160} value={detailA} onChange={(event) => setDetailA(event.target.value)}/></label><label>Pozisyon<input maxLength={120} value={detailB} onChange={(event) => setDetailB(event.target.value)}/></label></>}
        {category === 'official_operation' && <><label>Kurum / makam<input maxLength={160} value={detailA} onChange={(event) => setDetailA(event.target.value)}/></label><label>İşlem türü<input maxLength={120} value={detailB} onChange={(event) => setDetailB(event.target.value)}/></label></>}
        {category === 'home' && <><label>Kullanım<select value={detailA} onChange={(event) => setDetailA(event.target.value)}><option value="owner">Mülk sahibi</option><option value="tenant">Kiracı</option></select></label><label>Taşınmaz türü<select value={detailB} onChange={(event) => setDetailB(event.target.value)}><option value="residence">Konut</option><option value="workplace">İş yeri</option><option value="land">Arsa</option><option value="other">Diğer</option></select></label><label>Adres etiketi<input maxLength={240} value={detailC} onChange={(event) => setDetailC(event.target.value)} placeholder="Ham belge veya dosya yolu değil"/></label></>}
        {category === 'vehicle' && <><label>Araç türü<select value={detailA} onChange={(event) => setDetailA(event.target.value)}><option value="car">Otomobil</option><option value="motorcycle">Motosiklet</option><option value="commercial">Ticari</option><option value="other">Diğer</option></select></label><label>Enerji<select value={detailB} onChange={(event) => setDetailB(event.target.value)}><option value="fuel">Yakıt</option><option value="electric">Elektrik</option><option value="hybrid">Hibrit</option><option value="other">Diğer</option></select></label><label>Plaka (isteğe bağlı)<input maxLength={20} value={detailC} onChange={(event) => setDetailC(event.target.value)}/></label></>}
        <label>Gizlilik<select value={privacy} onChange={(event) => setPrivacy(event.target.value as RecordPrivacy)}><option value="private">Özel</option><option value="selected_members">Seçili üyeler</option><option value="family">Aile</option></select></label>
        <label>İlk hatırlatma<select value={reminderKind} onChange={(event) => setReminderKind(event.target.value as ManagedLifeReminderKind)}>{remindersByCategory[category].map((kind) => <option key={kind} value={kind}>{reminderLabels[kind]}</option>)}</select></label>
        <label>Hatırlatma zamanı<input type="datetime-local" value={reminderAt} onChange={(event) => setReminderAt(event.target.value)}/></label>
      </> : mode === 'home_inventory' ? <>
        <label>Ev profili<select value={recordId} onChange={(event) => changeProfile(event.target.value)}><option value="">Seçin</option>{homeProfiles.map((profile) => <option key={profile.id} value={profile.id}>{profile.title}</option>)}</select></label>
        <div className="managed-home-inventory-tabs" role="group" aria-label="Ev envanteri kayıt türü">{(Object.keys(homeInventoryLabels) as ManagedHomeInventoryItemType[]).map((itemType) => <Button key={itemType} tone={inventoryType === itemType ? 'primary' : 'default'} onClick={() => changeInventoryType(itemType)}>{homeInventoryLabels[itemType]}</Button>)}</div>
        {inventoryType === 'room' && <><label>Alan adı<input maxLength={120} value={roomName} onChange={(event) => setRoomName(event.target.value)} placeholder="Örn. Salon"/></label><label>Alan türü<select value={roomKind} onChange={(event) => setRoomKind(event.target.value as HomeRoomKind)}>{Object.entries(roomKindLabels).map(([value,label]) => <option key={value} value={value}>{label}</option>)}</select></label></>}
        {inventoryType === 'meter' && <><label>Alan / oda (isteğe bağlı)<select value={roomId} onChange={(event) => setRoomId(event.target.value)}><option value="">Ev geneli</option>{rooms.map((room) => <option key={room.id} value={room.id}>{room.name}</option>)}</select></label><label>Sayaç etiketi<input maxLength={120} value={meterLabel} onChange={(event) => setMeterLabel(event.target.value)} placeholder="Sayaç numarası değil, yerel etiket"/></label><label>Sayaç türü<select value={meterKind} onChange={(event) => setMeterKind(event.target.value as HomeMeterKind)}>{Object.entries(meterKindLabels).map(([value,label]) => <option key={value} value={value}>{label}</option>)}</select></label><small>Ölçüm birimi: {readingUnitLabels[readingUnitFor[meterKind]]}</small></>}
        {inventoryType === 'meter_reading' && <><label>Sayaç<select value={meterId} onChange={(event) => setMeterId(event.target.value)}><option value="">Seçin</option>{meters.map((meter) => <option key={meter.id} value={meter.id}>{meter.label} · {meterKindLabels[meter.meterKind]}</option>)}</select></label><label>Okuma türü<select value={readingKind} onChange={(event) => setReadingKind(event.target.value as HomeReadingKind)}>{Object.entries(readingKindLabels).map(([value,label]) => <option key={value} value={value}>{label}</option>)}</select></label><label>Okuma değeri<input type="number" min="0" step="0.001" value={readingValue} onChange={(event) => setReadingValue(event.target.value)}/></label><label>Okuma zamanı<input type="datetime-local" max={localDateTime()} value={readingAt} onChange={(event) => setReadingAt(event.target.value)}/></label><label>{readingKind === 'reading' ? 'Not (isteğe bağlı)' : 'Sıfırlama / değişim açıklaması'}<textarea maxLength={240} required={readingKind !== 'reading'} value={note} onChange={(event) => setNote(event.target.value)}/></label></>}
        {inventoryType === 'belonging' && <><label>Bulunduğu alan (isteğe bağlı)<select value={roomId} onChange={(event) => setRoomId(event.target.value)}><option value="">Belirtilmedi</option>{rooms.map((room) => <option key={room.id} value={room.id}>{room.name}</option>)}</select></label><label>Eşya adı<input maxLength={120} value={belongingName} onChange={(event) => setBelongingName(event.target.value)}/></label><label>Eşya türü<select value={belongingKind} onChange={(event) => setBelongingKind(event.target.value as HomeBelongingKind)}>{Object.entries(belongingKindLabels).map(([value,label]) => <option key={value} value={value}>{label}</option>)}</select></label><label>Seri numarası (isteğe bağlı)<input autoComplete="off" spellCheck={false} maxLength={160} value={serialNumber} onChange={(event) => setSerialNumber(event.target.value)} placeholder="Liste görünümünde maskelenir"/></label><label>Satın alma zamanı (isteğe bağlı)<input type="datetime-local" value={purchasedAt} onChange={(event) => setPurchasedAt(event.target.value)}/></label><label>Manuel tutar<input type="number" min="0.01" step="0.01" disabled={Boolean(financeExpenseId)} value={amount} onChange={(event) => setAmount(event.target.value)}/></label><label>Para birimi<input maxLength={3} disabled={Boolean(financeExpenseId)} value={currency} onChange={(event) => setCurrency(event.target.value.toUpperCase())}/></label><label>Bağlı finans kaydı (isteğe bağlı)<input maxLength={160} disabled={Boolean(amount)} value={financeExpenseId} onChange={(event) => setFinanceExpenseId(event.target.value)}/></label></>}
        {inventoryType === 'warranty' && <><label>Eşya<select value={belongingId} onChange={(event) => setBelongingId(event.target.value)}><option value="">Seçin</option>{belongings.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label><label>Sağlayıcı (isteğe bağlı)<input maxLength={160} value={provider} onChange={(event) => setProvider(event.target.value)}/></label><label>Başlangıç<input type="datetime-local" value={warrantyStartsAt} onChange={(event) => setWarrantyStartsAt(event.target.value)}/></label><label>Bitiş<input type="datetime-local" min={warrantyStartsAt} value={warrantyEndsAt} onChange={(event) => setWarrantyEndsAt(event.target.value)}/></label><label>Hatırlatma (isteğe bağlı)<input type="datetime-local" max={warrantyEndsAt} value={warrantyReminderAt} onChange={(event) => setWarrantyReminderAt(event.target.value)}/></label><label>Not (isteğe bağlı)<textarea maxLength={500} value={note} onChange={(event) => setNote(event.target.value)}/></label></>}
        {inventoryType === 'service' && <><label>Hedef türü<select value={targetType} onChange={(event) => { setTargetType(event.target.value as HomeServiceTargetType); setTargetItemId(''); }}><option value="room">Ev alanı / oda</option><option value="belonging">Eşya</option><option value="meter">Sayaç</option></select></label><label>Servis hedefi<select value={targetItemId} onChange={(event) => setTargetItemId(event.target.value)}><option value="">Seçin</option>{serviceTargets.map((item) => <option key={item.id} value={item.id}>{inventoryItemLabel(item, locale, language)}</option>)}</select></label><label>Servis türü<select value={serviceKind} onChange={(event) => setServiceKind(event.target.value as HomeServiceKind)}>{Object.entries(serviceKindLabels).map(([value,label]) => <option key={value} value={value}>{label}</option>)}</select></label><label>Gerçekleşme zamanı<input type="datetime-local" max={localDateTime()} value={occurredAt} onChange={(event) => setOccurredAt(event.target.value)}/></label><label>Sağlayıcı (isteğe bağlı)<input maxLength={160} value={provider} onChange={(event) => setProvider(event.target.value)}/></label><label>Manuel tutar<input type="number" min="0.01" step="0.01" disabled={Boolean(financeExpenseId)} value={amount} onChange={(event) => setAmount(event.target.value)}/></label><label>Para birimi<input maxLength={3} disabled={Boolean(financeExpenseId)} value={currency} onChange={(event) => setCurrency(event.target.value.toUpperCase())}/></label><label>Bağlı finans kaydı (isteğe bağlı)<input maxLength={160} disabled={Boolean(amount)} value={financeExpenseId} onChange={(event) => setFinanceExpenseId(event.target.value)}/></label><label>Not (isteğe bağlı)<textarea maxLength={500} value={note} onChange={(event) => setNote(event.target.value)}/></label></>}
        {inventoryType === 'document' && <><label>Hedef türü<select value={targetType} onChange={(event) => { setTargetType(event.target.value as HomeDocumentTargetType); setTargetItemId(''); }}><option value="belonging">Eşya</option><option value="meter">Sayaç</option><option value="warranty">Garanti</option><option value="service">Servis</option></select></label><label>Belge hedefi<select value={targetItemId} onChange={(event) => setTargetItemId(event.target.value)}><option value="">Seçin</option>{documentTargets.map((item) => <option key={item.id} value={item.id}>{inventoryItemLabel(item, locale, language)}</option>)}</select></label><label>Belge türü<select value={homeDocumentKind} onChange={(event) => setHomeDocumentKind(event.target.value as HomeDocumentKind)}>{Object.entries(homeDocumentKindLabels).map(([value,label]) => <option key={value} value={value}>{label}</option>)}</select></label><label>Arşiv belge bağlantısı<input autoComplete="off" spellCheck={false} maxLength={160} value={archiveItemId} onChange={(event) => setArchiveItemId(event.target.value)}/></label><label>Etiket (isteğe bağlı)<input maxLength={120} value={documentLabel} onChange={(event) => setDocumentLabel(event.target.value)}/></label><div className="notes-card"><strong>Belge içeriği bu forma girmez.</strong><small>Yalnız arşivdeki belgeyle bağlantı kurulur; dosya seçilmez ve dosya ayrıntıları bu forma taşınmaz.</small></div></>}
        <label>Önceki kaydı düzelt (isteğe bağlı)<select value={supersedesItemId} onChange={(event) => setSupersedesItemId(event.target.value)}><option value="">Yeni kayıt</option>{supersessionOptions.map((item) => <option key={item.id} value={item.id}>{inventoryItemLabel(item, locale, language)} · {formatDate(item.createdAt, locale)}</option>)}</select></label>
      </> : mode === 'emergency' ? <>
        {emergencyType !== 'emergency_plan' && !assistanceChildType && <label>Acil durum planı<select value={emergencyPlanId} onChange={(event) => { setEmergencyPlanId(event.target.value); setChecklistItemId(''); setPreparednessKitId(''); setPreparednessKitItemId(''); setAssistanceProfileId(''); setEmergencySupersedesItemId(''); }}><option value="">Seçin</option>{emergencyPlans.map((plan) => <option key={plan.id} value={plan.id}>{emergencyPlanKindLabels[plan.planKind]} · {plan.title}</option>)}</select></label>}
        {assistanceChildType && <label>Acil sağlık ve iletişim kartı<select value={assistanceProfileId} onChange={(event) => { setAssistanceProfileId(event.target.value); setEmergencySupersedesItemId(''); }}><option value="">Yetkili kartı seçin</option>{assistanceProfiles.map((profile) => <option key={profile.id} value={profile.id}>{profile.label} · {assistanceSubjectLabels[profile.subjectKind]}</option>)}</select></label>}
        <div className="managed-home-inventory-tabs family-emergency-tabs" role="group" aria-label="Acil durum kayıt türü">{(Object.keys(emergencyEntryLabels) as FamilyEmergencyEntryType[]).map((itemType) => <Button key={itemType} tone={emergencyType === itemType ? 'primary' : 'default'} onClick={() => changeEmergencyType(itemType)}>{emergencyEntryLabels[itemType]}</Button>)}</div>
        {emergencyType === 'emergency_plan' && <><label>Plan türü<select value={emergencyPlanKind} onChange={(event) => setEmergencyPlanKind(event.target.value as FamilyEmergencyPlanKind)}>{Object.entries(emergencyPlanKindLabels).map(([value,label]) => <option key={value} value={value}>{label}</option>)}</select></label><label>Plan başlığı<input maxLength={120} value={emergencyTitle} onChange={(event) => setEmergencyTitle(event.target.value)}/></label><label>Tahliye talimatı<textarea maxLength={2000} value={evacuationInstructions} onChange={(event) => setEvacuationInstructions(event.target.value)} placeholder="Aile için kısa, uygulanabilir adımlar"/></label><small>Plan aile görünürlüğüyle ve oturumunuza bağlı koordinatör kişiyle oluşturulur.</small></>}
        {emergencyType === 'meeting_point' && <><label>Nokta türü<select value={meetingPointKind} onChange={(event) => setMeetingPointKind(event.target.value as FamilyEmergencyMeetingPointKind)}>{Object.entries(emergencyMeetingPointLabels).map(([value,label]) => <option key={value} value={value}>{label}</option>)}</select></label><label>Buluşma noktası etiketi<input maxLength={240} value={meetingPointLabel} onChange={(event) => setMeetingPointLabel(event.target.value)} placeholder="Örn. Mahalle parkı kuzey kapısı"/></label><label>Manuel adres (isteğe bağlı)<textarea maxLength={300} value={meetingPointAddress} onChange={(event) => setMeetingPointAddress(event.target.value)}/></label><label>Ulaşım tarifi (isteğe bağlı)<textarea maxLength={500} value={meetingPointDirections} onChange={(event) => setMeetingPointDirections(event.target.value)}/></label><small>Adres yalnız yerel aile planında tutulur; harita ve canlı konum sorgusu yapılmaz.</small></>}
        {emergencyType === 'external_contact' && <><label>Şehir dışı irtibat adı<input maxLength={120} value={contactName} onChange={(event) => setContactName(event.target.value)}/></label><label>Telefon (E.164)<input type="tel" autoComplete="off" spellCheck={false} maxLength={16} value={contactPhone} onChange={(event) => setContactPhone(event.target.value)} placeholder="+905551112233"/></label><label>Şehir<input maxLength={120} value={contactCity} onChange={(event) => setContactCity(event.target.value)}/></label><label>Not (isteğe bağlı)<textarea maxLength={500} value={emergencyNote} onChange={(event) => setEmergencyNote(event.target.value)}/></label><small>Numara yalnız yetkili aile çalışma alanında tam gösterilir; sağlayıcıya, loga veya dışa aktarıma gönderilmez.</small></>}
        {emergencyType === 'checklist_item' && <><label>Kontrol maddesi<input maxLength={240} value={checklistLabel} onChange={(event) => setChecklistLabel(event.target.value)} placeholder="Örn. Gaz vanasını kapat"/></label><label>Sıra<input type="number" min="0" max="10000" step="1" value={checklistSortOrder} onChange={(event) => setChecklistSortOrder(event.target.value)}/></label></>}
        {emergencyType === 'checklist_status' && <><label>Kontrol maddesi<select value={checklistItemId} onChange={(event) => setChecklistItemId(event.target.value)}><option value="">Seçin</option>{selectedEmergencyPlan?.checklistItems.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select></label><label>Durum<select value={checklistStatus} onChange={(event) => setChecklistStatus(event.target.value as FamilyEmergencyChecklistStatus)}><option value="open">Açık</option><option value="completed">Tamamlandı</option></select></label></>}
        {emergencyType === 'member_status' && <><label>Durumu bildirilen üye<select value={memberPersonId} onChange={(event) => setMemberPersonId(event.target.value)}><option value="">Seçin</option>{people.map((person) => <option key={person.id} value={person.id}>{person.displayName}</option>)}</select></label><label>Durum<select value={memberStatus} onChange={(event) => setMemberStatus(event.target.value as FamilyEmergencyMemberStatus)}><option value="safe">İyiyim</option><option value="needs_help">Yardım lazım</option></select></label><label>Bildirim zamanı<input type="datetime-local" max={localDateTime()} value={memberStatusAt} onChange={(event) => setMemberStatusAt(event.target.value)}/></label><label>Not (isteğe bağlı)<textarea maxLength={500} value={emergencyNote} onChange={(event) => setEmergencyNote(event.target.value)}/></label><div className="notes-card family-emergency-warning"><strong>{memberStatus === 'needs_help' ? 'Bu düğme acil servis çağırmaz.' : 'Durum yalnız yerel plana yazılır.'}</strong><small>Kendi durumunuzu bildirebilirsiniz. Başkası adına bildirim yalnız merkezi yetki denetimi izin verirse kabul edilir ve gerçek bildiren kişi denetim izine bağlanır.</small></div></>}
        {emergencyType === 'preparedness_kit' && <><label>Kit türü<select value={preparednessKitKind} onChange={(event) => setPreparednessKitKind(event.target.value as FamilyEmergencyPreparednessKitKind)}>{Object.entries(preparednessKitKindLabels).map(([value,label]) => <option key={value} value={value}>{label}</option>)}</select></label><label>Kit etiketi<input maxLength={120} value={preparednessLabel} onChange={(event) => setPreparednessLabel(event.target.value)} placeholder="Örn. Antre 72 saat çantası"/></label><small>Kit yalnız seçili aile planında ve cihazdaki yerel çalışma alanında tutulur.</small></>}
        {emergencyType === 'preparedness_kit_item' && <><label>Hazırlık kiti<select value={preparednessKitId} onChange={(event) => { setPreparednessKitId(event.target.value); setEmergencySupersedesItemId(''); }}><option value="">Seçin</option>{selectedEmergencyPlan?.preparednessKits.map((kit) => <option key={kit.id} value={kit.id}>{preparednessKitKindLabels[kit.kitKind]} · {kit.label}</option>)}</select></label><label>Malzeme kategorisi<select value={preparednessCategory} onChange={(event) => setPreparednessCategory(event.target.value as FamilyEmergencyPreparednessKitItemCategory)}>{Object.entries(preparednessCategoryLabels).map(([value,label]) => <option key={value} value={value}>{label}</option>)}</select></label><label>Malzeme etiketi<input maxLength={160} value={preparednessLabel} onChange={(event) => setPreparednessLabel(event.target.value)} placeholder="Örn. İçme suyu"/></label><label>Hedef miktar<input type="number" min="0.001" step="0.001" value={preparednessTargetQuantity} onChange={(event) => setPreparednessTargetQuantity(event.target.value)}/></label><label>Birim<select value={preparednessQuantityUnit} onChange={(event) => setPreparednessQuantityUnit(event.target.value as FamilyEmergencyPreparednessQuantityUnit)}>{Object.entries(preparednessQuantityUnitLabels).map(([value,label]) => <option key={value} value={value}>{label}</option>)}</select></label><label>Son kullanma tarihi (isteğe bağlı)<input type="date" value={preparednessExpiresOn} onChange={(event) => setPreparednessExpiresOn(event.target.value)}/></label><small>Barkod aranmaz ve tarih dış sistemden doğrulanmaz; değerler manuel beyan edilir.</small></>}
        {emergencyType === 'preparedness_kit_check' && <><label>Kit malzemesi<select value={preparednessKitItemId} onChange={(event) => setPreparednessKitItemId(event.target.value)}><option value="">Seçin</option>{preparednessKitItems.map((item) => <option key={item.id} value={item.id}>{preparednessCategoryLabels[item.category]} · {item.label}</option>)}</select></label><label>Kontrol durumu<select value={preparednessCheckStatus} onChange={(event) => setPreparednessCheckStatus(event.target.value as FamilyEmergencyPreparednessCheckStatus)}>{Object.entries(preparednessCheckStatusLabels).map(([value,label]) => <option key={value} value={value}>{label}</option>)}</select></label><label>Mevcut miktar{selectedPreparednessKitItem ? ` (${preparednessQuantityUnitLabels[selectedPreparednessKitItem.quantityUnit]})` : ''}<input type="number" min="0" step="0.001" value={preparednessActualQuantity} onChange={(event) => setPreparednessActualQuantity(event.target.value)}/></label><label>Kontrol zamanı<input type="datetime-local" max={localDateTime()} value={preparednessCheckedAt} onChange={(event) => setPreparednessCheckedAt(event.target.value)}/></label><label>Not (isteğe bağlı)<textarea maxLength={500} value={emergencyNote} onChange={(event) => setEmergencyNote(event.target.value)}/></label><small>Durum yalnız manuel kontroldür; sensör okuması, otomatik bildirim veya hazır olma garantisi değildir.</small></>}
        {emergencyType === 'emergency_drill' && <><label>Tatbikat türü<select value={emergencyDrillKind} onChange={(event) => setEmergencyDrillKind(event.target.value as FamilyEmergencyDrillKind)}>{Object.entries(emergencyDrillKindLabels).map(([value,label]) => <option key={value} value={value}>{label}</option>)}</select></label><label>Sonuç<select value={emergencyDrillStatus} onChange={(event) => setEmergencyDrillStatus(event.target.value as FamilyEmergencyDrillStatus)}>{Object.entries(emergencyDrillStatusLabels).map(([value,label]) => <option key={value} value={value}>{label}</option>)}</select></label><label>Gerçekleşme zamanı<input type="datetime-local" max={localDateTime()} value={emergencyDrillAt} onChange={(event) => setEmergencyDrillAt(event.target.value)}/></label><label>Süre (saniye, isteğe bağlı)<input type="number" min="1" max="604800" step="1" value={emergencyDrillDuration} onChange={(event) => setEmergencyDrillDuration(event.target.value)}/></label><label>Not (isteğe bağlı)<textarea maxLength={500} value={emergencyNote} onChange={(event) => setEmergencyNote(event.target.value)}/></label><small>Tatbikat kaydı alarm, mesaj, acil servis teması veya müdahale garantisi üretmez.</small></>}
        {emergencyType === 'emergency_profile' && <fieldset className="family-emergency-assistance-fieldset"><legend>Acil sağlık ve iletişim kartı</legend><label>Kart etiketi<input maxLength={120} value={assistanceLabel} onChange={(event) => setAssistanceLabel(event.target.value)} placeholder="Örn. Evden çıkış acil kartı"/></label><label>Kart konusu<select value={assistanceSubjectKind} onChange={(event) => setAssistanceSubjectKind(event.target.value as FamilyEmergencyAssistanceSubjectKind)}>{Object.entries(assistanceSubjectLabels).map(([value,label]) => <option key={value} value={value}>{label}</option>)}</select></label>{assistanceSubjectKind === 'person' ? <label>Aile üyesi<select value={assistanceSubjectPersonId} onChange={(event) => setAssistanceSubjectPersonId(event.target.value)}><option value="">Seçin</option>{people.map((person) => <option key={person.id} value={person.id}>{person.displayName}</option>)}</select></label> : <><label>Evcil hayvan kaydı<input autoComplete="off" spellCheck={false} maxLength={160} value={assistanceSubjectPetId} onChange={(event) => setAssistanceSubjectPetId(event.target.value)} placeholder="Evcil hayvan kaydı"/></label><label>Sorumlu aile üyesi<select value={assistanceResponsiblePersonId} onChange={(event) => setAssistanceResponsiblePersonId(event.target.value)}><option value="">Seçin</option>{people.map((person) => <option key={person.id} value={person.id}>{person.displayName}</option>)}</select></label></>}<small>Yeni kart her zaman özel oluşturulur. Plan bağlantısı kartı aileye açmaz; kişi veya sorumlu sahipliği güvenli yetki denetimiyle doğrulanır.</small></fieldset>}
        {emergencyType === 'health_fact' && <fieldset className="family-emergency-assistance-fieldset"><legend>Acil sağlık kartı bilgisi</legend><label>Bilgi türü<select value={healthFactKind} onChange={(event) => { setHealthFactKind(event.target.value as FamilyEmergencyHealthFactKind); setEmergencySupersedesItemId(''); }}>{Object.entries(healthFactLabels).map(([value,label]) => <option key={value} value={value}>{label}</option>)}</select></label>{healthFactKind === 'blood_type' ? <label>Kan grubu<select value={bloodType} onChange={(event) => setBloodType(event.target.value as FamilyEmergencyBloodType)}>{Object.entries(bloodTypeLabels).map(([value,label]) => <option key={value} value={value}>{label}</option>)}</select></label> : <label>Manuel bilgi<textarea maxLength={240} value={healthFactValue} onChange={(event) => setHealthFactValue(event.target.value)}/></label>}<label>Not (isteğe bağlı)<textarea maxLength={500} value={emergencyNote} onChange={(event) => setEmergencyNote(event.target.value)}/></label><small>Bu bilgi klinik doğrulama veya tıbbi tavsiye değildir; sağlık sicili sorgulanmaz.</small></fieldset>}
        {emergencyType === 'emergency_contact' && <fieldset className="family-emergency-assistance-fieldset"><legend>Acil kart irtibatı</legend><label>İrtibat adı<input maxLength={120} value={contactName} onChange={(event) => setContactName(event.target.value)}/></label><label>Telefon (E.164)<input type="tel" autoComplete="off" spellCheck={false} maxLength={16} value={contactPhone} onChange={(event) => setContactPhone(event.target.value)} placeholder="+905551112233"/></label><label>Yakınlık (isteğe bağlı)<input maxLength={120} value={assistanceRelationship} onChange={(event) => setAssistanceRelationship(event.target.value)}/></label><label>Not (isteğe bağlı)<textarea maxLength={500} value={emergencyNote} onChange={(event) => setEmergencyNote(event.target.value)}/></label><small>Numara yalnız yetkili özel kartta gösterilir; mesaj gönderilmez, aranmaz veya loglanmaz. Yerel çıktıya ancak ayrıca açıkça seçilip güçlü yeniden doğrulama yapılırsa eklenir.</small></fieldset>}
        {emergencyType === 'assistance_instruction' && <fieldset className="family-emergency-assistance-fieldset"><legend>Özel yardım planı</legend><label>Yardım türü<select value={assistanceInstructionKind} onChange={(event) => { setAssistanceInstructionKind(event.target.value as FamilyEmergencyAssistanceInstructionKind); setEmergencySupersedesItemId(''); }}>{Object.entries(assistanceInstructionLabels).map(([value,label]) => <option key={value} value={value}>{label}</option>)}</select></label><label>Uygulanacak manuel talimat<textarea maxLength={1000} value={assistanceInstruction} onChange={(event) => setAssistanceInstruction(event.target.value)} placeholder="Kısa, uygulanabilir ve kişiye/evcil hayvana özel yardım adımları"/></label><label>Not (isteğe bağlı)<textarea maxLength={500} value={emergencyNote} onChange={(event) => setEmergencyNote(event.target.value)}/></label><small>Talimat yalnız yerel özel profildir; mesaj, sağlık sağlayıcısı veya acil servis çağrısı üretmez.</small></fieldset>}
        {(emergencyType === 'meeting_point' || emergencyType === 'external_contact' || emergencyType === 'checklist_item') && <label>Önceki kaydı düzelt (isteğe bağlı)<select value={emergencySupersedesItemId} onChange={(event) => setEmergencySupersedesItemId(event.target.value)}><option value="">Yeni kayıt</option>{emergencyCorrectionOptions.map((item) => <option key={item.id} value={item.id}>{item.itemType === 'meeting_point' ? item.label : item.itemType === 'external_contact' ? item.name : item.label} · {formatDate(item.createdAt, locale)}</option>)}</select></label>}
        {(emergencyType === 'preparedness_kit' || emergencyType === 'preparedness_kit_item' || emergencyType === 'emergency_drill') && <label>Önceki kaydı düzelt (isteğe bağlı)<select value={emergencySupersedesItemId} onChange={(event) => setEmergencySupersedesItemId(event.target.value)}><option value="">Yeni kayıt</option>{preparednessCorrectionOptions.map((item) => <option key={item.id} value={item.id}>{item.itemType === 'emergency_drill' ? `${emergencyDrillKindLabels[item.drillKind]} · ${emergencyDrillStatusLabels[item.status]}` : item.label} · {formatDate(item.createdAt, locale)}</option>)}</select></label>}
        {assistanceChildType && <label>Önceki aynı tür kaydı düzelt (isteğe bağlı)<select value={emergencySupersedesItemId} onChange={(event) => setEmergencySupersedesItemId(event.target.value)}><option value="">Yeni kayıt</option>{assistanceCorrectionOptions.map((item) => <option key={item.id} value={item.id}>{item.itemType === 'health_fact' ? healthFactLabels[item.factKind] : item.itemType === 'emergency_contact' ? item.name : assistanceInstructionLabels[item.instructionKind]} · {formatDate(item.createdAt, locale)}</option>)}</select></label>}
      </> : <>
        <label>Üst yaşam profili<select value={recordId} onChange={(event) => changeProfile(event.target.value)}><option value="">Seçin</option>{workspace?.profiles.map((profile) => <option key={profile.id} value={profile.id}>{categoryLabels[profile.category]} · {profile.title}</option>)}</select></label>
        {mode === 'activity' ? <>
          <label>Etkinlik<select value={activityKind} onChange={(event) => setActivityKind(event.target.value as ManagedLifeActivityKind)}>{availableActivities.map((kind) => <option key={kind} value={kind}>{activityLabels[kind]}</option>)}</select></label>
          <label>Gerçekleşme zamanı<input type="datetime-local" max={localDateTime()} value={occurredAt} onChange={(event) => setOccurredAt(event.target.value)}/></label>
          <label>Sağlayıcı (isteğe bağlı)<input maxLength={160} value={provider} onChange={(event) => setProvider(event.target.value)}/></label>
          <label>Tutar<input type="number" min="0.01" step="0.01" value={amount} onChange={(event) => setAmount(event.target.value)}/></label>
          <label>Para birimi<input maxLength={3} value={currency} onChange={(event) => setCurrency(event.target.value.toUpperCase())}/></label>
          {quantityRequired && <label>{activityKind === 'fuel' ? 'Yakıt miktarı' : 'Şarj miktarı'}<input type="number" min="0.001" step="0.001" value={quantity} onChange={(event) => setQuantity(event.target.value)}/></label>}
          {selectedProfile?.category === 'vehicle' && <label>Kilometre<input type="number" min="0" step="1" value={odometerKm} onChange={(event) => setOdometerKm(event.target.value)}/></label>}
          <label>Sonraki hatırlatma<select value={reminderKind} onChange={(event) => setReminderKind(event.target.value as ManagedLifeReminderKind)}>{selectedReminderKinds.map((kind) => <option key={kind} value={kind}>{reminderLabels[kind]}</option>)}</select></label>
          <label>Hatırlatma zamanı<input type="datetime-local" min={occurredAt} value={nextReminderAt} onChange={(event) => setNextReminderAt(event.target.value)}/></label>
          <label>Not<input maxLength={500} value={note} onChange={(event) => setNote(event.target.value)}/></label>
        </> : <>
          <label>Belge türü<select value={documentKind} onChange={(event) => setDocumentKind(event.target.value as ManagedLifeDocumentKind)}>{availableDocuments.map((kind) => <option key={kind} value={kind}>{documentLabels[kind]}</option>)}</select></label>
          <label>Arşiv belge bağlantısı<input autoComplete="off" spellCheck={false} maxLength={160} value={archiveItemId} onChange={(event) => setArchiveItemId(event.target.value)} placeholder="Arşivden seçilen belge"/></label>
          <label>Etiket (isteğe bağlı)<input maxLength={120} value={documentLabel} onChange={(event) => setDocumentLabel(event.target.value)}/></label>
          <div className="notes-card"><strong>Belge içeriği bu forma girmez.</strong><small>Yalnız arşivdeki belgeyle bağlantı kurulur; dosya seçilmez ve içerik bu forma taşınmaz.</small></div>
        </>}
      </>}
      <Button tone="primary" onClick={() => void submit()} disabled={!submitReady}>Yerel deftere kaydet</Button>
      {message && <StatusMessage tone={messageTone}>{message}</StatusMessage>}
    </Surface>

    <Surface className="workspace-form emergency-card-portability-panel">
      <SectionHeader eyebrow="Yerel ve çevrimdışı güvenlik" title="Çevrimdışı acil kart çıktısı"/>
      <div className="notes-card family-emergency-warning" role="note">
        <strong>Bu işlem özel sağlık ve iletişim verisinin yerel bir kopyasını oluşturabilir.</strong>
        <small>Yazdırma ve düz PDF şifreli değildir. Şifreli paket ayrı, en az 12 karakterli paket parolası kullanır; hesap parolası paket parolası olarak saklanmaz veya yeniden kullanılmaz.</small>
        <small>Dosya yolu ekrana verilmez. Seçilen arşiv belgeleri ayrı izinle, dosya başına en çok 10 MiB ve toplam 25 MiB olacak biçimde geçici olarak okunur; düz metin dosyası oluşturulmaz.</small>
        <small>Ağ, bulut, mesaj veya acil servis teslimi yapılmaz. Güç kaynağı uygulamanın korumalı bölümünde izlenir; pil yüzdesi ölçülmez ve kendiliğinden düşük pil uyarısı üretilmez.</small>
      </div>
      <label>Yetkili özel acil kart
        <select value={cardProfileId} onChange={(event) => changeCardProfile(event.target.value)}>
          <option value="">Seçin</option>
          {assistanceProfiles.map((profile) => <option key={profile.id} value={profile.id}>{profile.label} · {assistanceSubjectLabels[profile.subjectKind]}</option>)}
        </select>
      </label>
      <fieldset className="emergency-card-config-group">
        <legend>1. Yapılandırma</legend>
        <label>Yapılandırma etiketi<input maxLength={120} value={cardConfigurationLabel} onChange={(event) => setCardConfigurationLabel(event.target.value)} placeholder="Örn. Cüzdan acil kartı"/></label>
        <Button onClick={() => void recordCardConfiguration()} disabled={!cardProfileId || cardConfigurationLabel.trim().length < 2}>Yapılandırmayı kaydet</Button>
        <label>Kayıtlı yapılandırma
          <select value={cardConfigurationId} onChange={(event) => changeCardConfiguration(event.target.value)}>
            <option value="">Seçin</option>
            {cardConfigurations.map((configuration) => <option key={configuration.id} value={configuration.id}>{configuration.label}</option>)}
          </select>
        </label>
      </fieldset>
      <fieldset className="emergency-card-config-group">
        <legend>2. Kapalı alan ve belge seçimi</legend>
        <label>Kaynak kayıt<select value={cardSourceItemId} onChange={(event) => changeCardSource(event.target.value)}><option value="">Seçin</option>{cardSourceOptions.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select></label>
        <label>Alan<select value={cardFieldCode} onChange={(event) => setCardFieldCode(event.target.value as FamilyEmergencyCardFieldCode)}>{availableCardFields.map((field) => <option key={field} value={field}>{emergencyCardFieldLabels[field]}</option>)}</select></label>
        <Button onClick={() => void recordCardSelectedField()} disabled={!cardConfigurationId || !selectedCardSource}>Alanı yapılandırmaya ekle</Button>
        <label>Yüksek hassasiyetli arşiv belge bağlantısı<input autoComplete="off" spellCheck={false} maxLength={160} value={cardArchiveItemId} onChange={(event) => setCardArchiveItemId(event.target.value)} placeholder="Arşivden seçilen belge"/></label>
        <Button onClick={() => void recordCardDocumentLink()} disabled={!cardConfigurationId || !/^[A-Za-z0-9][A-Za-z0-9._-]{1,159}$/u.test(cardArchiveItemId)}>Belge bağını ekle</Button>
        {selectedCardConfiguration && <div className="emergency-card-selection-list" aria-label="Bu çıktı için açık seçimler">
          <strong>Bu işlemde dışa aktarılacak alanlar</strong>
          {selectedCardConfiguration.selectedFields.map((field) => <label className="emergency-card-check" key={field.id}><input type="checkbox" checked={cardSelectedFieldIds.includes(field.id)} onChange={() => toggleCardSelection(field.id,cardSelectedFieldIds,setCardSelectedFieldIds)}/><span>{emergencyCardFieldLabels[field.fieldCode]} · {language==='tr'?emergencyCardSourceTypeCopy[field.sourceItemType][0]:emergencyCardSourceTypeCopy[field.sourceItemType][1]}</span></label>)}
          {selectedCardConfiguration.selectedFields.length === 0 && <small>Henüz alan seçimi kaydedilmedi.</small>}
          <strong>Yalnız şifreli pakete eklenecek belgeler</strong>
          {selectedCardConfiguration.documentLinks.map((link) => <label className="emergency-card-check" key={link.id}><input type="checkbox" disabled={cardOutputMode !== 'encrypted_pack'} checked={cardOutputMode === 'encrypted_pack' && cardDocumentLinkIds.includes(link.id)} onChange={() => toggleCardSelection(link.id,cardDocumentLinkIds,setCardDocumentLinkIds)}/><span>Arşiv belge bağlantısı · {link.archiveItemId}</span></label>)}
          {selectedCardConfiguration.documentLinks.length === 0 && <small>Henüz belge bağı kaydedilmedi.</small>}
        </div>}
      </fieldset>
      <fieldset className="emergency-card-config-group">
        <legend>3. Pil-duyarlı görünüm</legend>
        <div className="button-row"><Button onClick={() => void recordCardPowerMode(true)} disabled={!cardConfigurationId}>Manuel aç</Button><Button onClick={() => void recordCardPowerMode(false)} disabled={!cardConfigurationId}>Kapat</Button></div>
        <small>{selectedCardConfiguration?.latestPowerModeEvent ? `${translateManagedLifeCopy('Son kip:',language)} ${translateManagedLifeCopy(selectedCardConfiguration.latestPowerModeEvent.mode === 'enabled' ? 'açık' : 'kapalı',language)} · ${translateManagedLifeCopy('güç kaynağı',language)} ${language==='tr'?emergencyCardPowerSourceCopy[selectedCardConfiguration.latestPowerModeEvent.powerSource][0]:emergencyCardPowerSourceCopy[selectedCardConfiguration.latestPowerModeEvent.powerSource][1]} · ${translateManagedLifeCopy('pil seviyesi ölçülmedi',language)}` : translateManagedLifeCopy('Henüz pil-duyarlı kip olayı yok.',language)}</small>
      </fieldset>
      <fieldset className="emergency-card-config-group">
        <legend>4. Güçlü doğrulama ve yerel çıktı</legend>
        <label>Çıktı biçimi<select value={cardOutputMode} onChange={(event) => { setCardOutputMode(event.target.value as FamilyEmergencyCardOutputMode); setCardPlaintextWarningConfirmed(false); }}>{Object.entries(emergencyCardOutputLabels).map(([value,label]) => <option key={value} value={value}>{label}</option>)}</select><small>Arşiv belgesi içeriği düz metin PDF/yazıcı çıktısına eklenmez; yalnız bağımsız parolalı şifreli pakete alınır.</small></label>
        <label>Hesap parolası<input type="password" autoComplete="current-password" maxLength={1024} value={cardPassword} onChange={(event) => setCardPassword(event.target.value)}/></label>
        <label>İkinci faktör kodu (etkinse)<input type="password" inputMode="numeric" autoComplete="one-time-code" maxLength={256} value={cardSecondFactorCode} onChange={(event) => setCardSecondFactorCode(event.target.value)}/></label>
        {cardOutputMode === 'encrypted_pack' ? <label>Paket parolası (en az 12 karakter)<input type="password" autoComplete="new-password" maxLength={1024} value={cardPackagePassphrase} onChange={(event) => setCardPackagePassphrase(event.target.value)}/><small>Bu parola yalnız bu çağrıda kullanılır; saklanmaz, loglanmaz, denetime veya sonuca eklenmez.</small></label> : <label className="emergency-card-check plaintext-warning"><input type="checkbox" checked={cardPlaintextWarningConfirmed} onChange={(event) => setCardPlaintextWarningConfirmed(event.target.checked)}/><span>Bu {cardOutputMode === 'pdf' ? 'PDF dosyasının' : 'yazıcı çıktısının'} düz metin olduğunu ve erişebilen kişilerin özel içeriği görebileceğini anlıyorum.</span></label>}
        <Button tone="primary" onClick={() => void exportEmergencyCard()} disabled={cardBusy || !selectedCardConfiguration || cardPassword.length < 1 || cardSelectedFieldIds.length + (cardOutputMode === 'encrypted_pack' ? cardDocumentLinkIds.length : 0) < 1 || (cardOutputMode === 'encrypted_pack' ? cardPackagePassphrase.normalize('NFKC').length < 12 : !cardPlaintextWarningConfirmed)}>{cardBusy ? 'Güvenli çıktı hazırlanıyor…' : emergencyCardOutputLabels[cardOutputMode]}</Button>
      </fieldset>
      {cardMessage && <StatusMessage tone={cardMessageTone}>{cardMessage}</StatusMessage>}
    </Surface>

    <Surface className="workspace-summary managed-life-summary">
      <SectionHeader eyebrow={`${workspace?.profiles.length ?? 0} profil · ${homeItems.length} ev envanteri olayı · ${emergencyPlans.length} acil durum planı · ${preparednessKitCount} hazırlık kiti · ${emergencyDrillCount} tatbikat · ${assistanceProfiles.length} özel acil kart`} title="Yönetilen yaşam görünümü"/>
      {!workspace?.profiles.length ? <EmptyState title="Yönetilen yaşam profili yok" body="Sigorta, abonelik, eğitim, istihdam, resmî işlem, ev veya araç profili ekleyin."/> : workspace.profiles.map((profile) => {
        const profileHomeItems = homeItems.filter((item) => item.recordId === profile.id);
        return <div className="context-stat managed-life-profile-card" key={profile.id}>
          <strong>{categoryLabels[profile.category]} · {profile.title}</strong>
          <span>{personNames.get(profile.ownerPersonId) ?? 'Aile üyesi'} · {managedLifeProfileStatusLabel(profile.status,language)} · {profileSummary(profile, language)}</span>
          {profile.currentReminder && <small>{reminderLabels[profile.currentReminder.kind]} · {formatDate(profile.currentReminder.dueAt, locale)}</small>}
          {profile.activities.map((activity) => <small key={activity.id}>{activityLabels[activity.activityKind]} · {formatDate(activity.occurredAt, locale)}{activity.amountMinor !== undefined ? ` · ${(activity.amountMinor / 100).toLocaleString(locale)} ${activity.currency}` : ''}{activity.quantityMilliunits !== undefined ? ` · ${(activity.quantityMilliunits / 1_000).toLocaleString(locale)}` : ''}</small>)}
          {profile.documents.map((document) => <small key={document.id}>{documentLabels[document.documentKind]} · Arşiv bağı: <code>{document.archiveItemId}</code>{document.label ? ` · ${document.label}` : ''}</small>)}
          {profileHomeItems.length > 0 && <div className="managed-home-inventory-list">{profileHomeItems.map((item) => <article className="managed-home-inventory-row" key={item.id}><div><b>{homeInventoryLabels[item.itemType]}</b><strong>{inventoryItemLabel(item, locale, language)}</strong><small>{inventoryItemDetail(item, profileHomeItems, locale, language)}</small></div><span>Manuel · {item.externalVerification === 'not_performed' ? 'doğrulanmadı' : '—'}</span></article>)}</div>}
        </div>;
      })}
      {emergencyPlans.length === 0 ? <EmptyState title="Acil durum planı yok" body="Çevrimdışı afet/tahliye planı oluşturarak buluşma, irtibat, kontrol ve üye durumunu aynı yerel çalışma alanında yönetin."/> : <div className="family-emergency-plan-list">{emergencyPlans.map((plan) => <article className="family-emergency-plan-card" key={plan.id}>
        <header><div><b>{emergencyPlanKindLabels[plan.planKind]}</b><strong>{plan.title}</strong></div><span>Yerel · Aile</span></header>
        <p>{plan.evacuationInstructions}</p>
        <section><h4>Buluşma noktaları</h4>{plan.meetingPoints.length ? plan.meetingPoints.map((point) => <div className="family-emergency-row" key={point.id}><strong>{emergencyMeetingPointLabels[point.meetingPointKind]} · {point.label}</strong><small>{point.address ?? 'Adres girilmedi'}{point.directions ? ` · ${point.directions}` : ''}</small></div>) : <small>Henüz buluşma noktası yok.</small>}</section>
        <section><h4>Şehir dışı irtibat</h4>{plan.externalContacts.length ? plan.externalContacts.map((contact) => <div className="family-emergency-row" key={contact.id}><strong>{contact.name} · {contact.city}</strong><small>Telefon: {contact.phoneE164}{contact.note ? ` · ${contact.note}` : ''}</small></div>) : <small>Henüz şehir dışı irtibat yok.</small>}</section>
        <section><h4>Kontrol listesi</h4>{plan.checklistItems.length ? plan.checklistItems.map((item) => <div className="family-emergency-row" key={item.id}><strong>{item.latestStatus?.status === 'completed' ? '✓' : '○'} {item.label}</strong><small>{item.latestStatus?.status === 'completed' ? 'Tamamlandı' : 'Açık'} · sıra {item.sortOrder}</small></div>) : <small>Henüz kontrol maddesi yok.</small>}</section>
        <section><h4>Hazırlık kitleri</h4>{plan.preparednessKits.length ? plan.preparednessKits.map((kit) => <div className="family-emergency-preparedness-kit" key={kit.id}><div className="family-emergency-row"><strong>{preparednessKitKindLabels[kit.kitKind]} · {kit.label}</strong><small>Manuel · yerel aile planı{kit.supersedesItemId ? ' · düzeltme kaydı' : ''}</small></div>{kit.items.length ? kit.items.map((item) => <div className={`family-emergency-row preparedness-status-${item.latestCheck?.status ?? 'unchecked'}`} key={item.id}><strong>{preparednessCategoryLabels[item.category]} · {item.label}</strong><small>Hedef: {(item.targetQuantityMilliunits / 1_000).toLocaleString(locale)} {preparednessQuantityUnitLabels[item.quantityUnit]}{item.latestCheck ? ` · mevcut: ${(item.latestCheck.actualQuantityMilliunits / 1_000).toLocaleString(locale)} · ${preparednessCheckStatusLabels[item.latestCheck.status]} · ${formatDate(item.latestCheck.checkedAt, locale)}` : ' · henüz kontrol edilmedi'}{item.expiresOn ? ` · SKT: ${formatDateOnly(item.expiresOn, locale)} (manuel)` : ''}</small></div>) : <small>Bu kite henüz malzeme eklenmedi.</small>}</div>) : <small>Henüz hazırlık kiti yok.</small>}</section>
        <section><h4>Tatbikat geçmişi</h4>{plan.emergencyDrills.length ? plan.emergencyDrills.map((drill) => <div className="family-emergency-row" key={drill.id}><strong>{emergencyDrillKindLabels[drill.drillKind]} · {emergencyDrillStatusLabels[drill.status]}</strong><small>{formatDate(drill.occurredAt, locale)}{drill.durationSeconds !== undefined ? ` · ${drill.durationSeconds} saniye` : ''}{drill.note ? ` · ${drill.note}` : ''}{drill.supersedesItemId ? ' · düzeltme kaydı' : ''}</small></div>) : <small>Henüz tatbikat kaydı yok.</small>}</section>
        <section><h4>Son aile üyesi durumları</h4>{plan.latestMemberStatuses.length ? plan.latestMemberStatuses.map((item) => <div className={`family-emergency-row member-status-${item.status}`} key={item.id}><strong>{personNames.get(item.memberPersonId) ?? 'Aile üyesi'} · {emergencyMemberStatusLabels[item.status]}</strong><small>{formatDate(item.occurredAt, locale)} · Bildiren: {personNames.get(item.reportedByPersonId) ?? 'Yetkili aile üyesi'}{item.note ? ` · ${item.note}` : ''}</small></div>) : <small>Henüz üye durum bildirimi yok.</small>}</section>
      </article>)}</div>}
      <section className="family-emergency-assistance-section" aria-labelledby="emergency-assistance-heading">
        <h3 id="emergency-assistance-heading">Acil sağlık ve iletişim kartları</h3>
        <p>Yalnız merkezi yetkiyle görünen özel, manuel ve çevrimdışı kartlar.</p>
        {assistanceProfiles.length === 0 ? <EmptyState title="Yetkili özel acil kart yok" body="Bir aile üyesi veya evcil hayvan için özel acil sağlık ve yardım profili oluşturabilirsiniz."/> : <div className="family-emergency-assistance-list">{assistanceProfiles.map((profile) => {
          const linkedPlan = emergencyPlans.find((plan) => plan.id === profile.planId);
          const subject = profile.subjectKind === 'person'
            ? personNames.get(profile.subjectPersonId) ?? 'Yetkili aile üyesi'
            : `Evcil hayvan · ${profile.subjectPetId}`;
          return <article className="family-emergency-assistance-card" key={profile.id}>
            <header><div><b>{assistanceSubjectLabels[profile.subjectKind]}</b><strong>{profile.label}</strong></div><span>Özel · Yerel</span></header>
            <small>{subject}{profile.subjectKind === 'pet' ? ` · Sorumlu: ${personNames.get(profile.responsiblePersonId) ?? 'Yetkili aile üyesi'}` : ''}</small>
            <small>Bağlı plan: {linkedPlan ? `${emergencyPlanKindLabels[linkedPlan.planKind]} · ${linkedPlan.title}` : 'Plan ayrıntısı bu görünümde yetkili değil'}</small>
            <section><h4>Acil sağlık kartı</h4>{profile.healthFacts.length ? profile.healthFacts.map((fact) => <div className="family-emergency-row" key={fact.id}><strong>{healthFactLabels[fact.factKind]}</strong><small>{fact.factKind === 'blood_type' ? bloodTypeLabels[fact.bloodType] : fact.value}{fact.note ? ` · ${fact.note}` : ''}{fact.supersedesItemId ? ' · düzeltme kaydı' : ''}</small></div>) : <small>Henüz manuel sağlık bilgisi yok.</small>}</section>
            <section><h4>Acil iletişim</h4>{profile.emergencyContacts.length ? profile.emergencyContacts.map((contact) => <div className="family-emergency-row" key={contact.id}><strong>{contact.name}{contact.relationship ? ` · ${contact.relationship}` : ''}</strong><small>Telefon: {contact.phoneE164}{contact.note ? ` · ${contact.note}` : ''}{contact.supersedesItemId ? ' · düzeltme kaydı' : ''}</small></div>) : <small>Henüz acil irtibat yok.</small>}</section>
            <section><h4>Özel yardım planı</h4>{profile.assistanceInstructions.length ? profile.assistanceInstructions.map((instruction) => <div className="family-emergency-row" key={instruction.id}><strong>{assistanceInstructionLabels[instruction.instructionKind]}</strong><small>{instruction.instruction}{instruction.note ? ` · ${instruction.note}` : ''}{instruction.supersedesItemId ? ' · düzeltme kaydı' : ''}</small></div>) : <small>Henüz özel yardım talimatı yok.</small>}</section>
          </article>;
        })}</div>}
      </section>
      <div className="notes-card managed-life-truth-card">
        <strong>Çalışma alanı doğruluk beyanı</strong>
        <small>Kaynak: {workspace?.dataSource === 'manual' ? 'Manuel' : '—'} · Akıllı sayaç: {workspace?.smartMeterLookup === 'not_performed' ? 'Sorgulanmadı' : '—'} · Sağlayıcı teması: {workspace?.providerContact === 'not_performed' ? 'Yapılmadı' : '—'}</small>
        <small>Garanti sicili: {workspace?.warrantyLookup === 'not_performed' ? 'Sorgulanmadı' : '—'} · Metin tanıma: {workspace?.ocr === 'not_performed' ? 'Yapılmadı' : '—'} · Ödeme: {workspace?.paymentExecution === 'not_performed' ? 'Yapılmadı' : '—'}</small>
        <small>Belge içeriği açığa çıkarma: {workspace?.documentContentExposure === 'not_performed' ? 'Yapılmadı' : '—'} · Ağ gerçeği üretilmez</small>
        <strong>Acil durum doğruluk sınırı</strong>
        <small>Çevrimdışı kullanılabilirlik: {workspace?.offlineAvailability === 'local_only' ? 'Yalnız yerel veri' : '—'} · Harita: {workspace?.mapLookup === 'not_performed' ? 'Sorgulanmadı' : '—'} · Canlı konum: {workspace?.liveLocation === 'not_performed' ? 'Alınmadı' : '—'}</small>
        <small>Mesaj teslimi: {workspace?.messageDelivery === 'not_performed' ? 'Yapılmadı' : '—'} · Acil servis teması: {workspace?.emergencyServiceContact === 'not_performed' ? 'Kurulmadı' : '—'} · Garanti: {workspace?.emergencyServiceGuarantee === 'not_claimed' ? 'İddia edilmiyor' : '—'} · Ağ çıkışı: {workspace?.networkEgressAdded === false ? 'Eklenmedi' : '—'}</small>
        <strong>Hazırlık doğruluk sınırı</strong>
        <small>Barkod araması: {workspace?.barcodeLookup === 'not_performed' ? 'Yapılmadı' : '—'} · Son kullanma doğrulaması: {workspace?.expiryVerification === 'not_performed' ? 'Yapılmadı' : '—'} · Bildirim teslimi: {workspace?.notificationDelivery === 'not_performed' ? 'Yapılmadı' : '—'}</small>
        <small>Sensör entegrasyonu: {workspace?.sensorIntegration === 'not_performed' ? 'Yapılmadı' : '—'} · Hazır olma garantisi: {workspace?.readinessGuarantee === 'not_claimed' ? 'İddia edilmiyor' : '—'} · Saklama: {workspace?.offlineAvailability === 'local_only' ? 'Yalnız yerel' : '—'}</small>
        <strong>Özel acil sağlık ve yardım doğruluk sınırı</strong>
         <small>Tıbbi doğrulama: {workspace?.medicalVerification === 'not_performed' ? 'Yapılmadı' : '—'} · Sağlık sicili: {workspace?.healthRegistryLookup === 'not_performed' ? 'Sorgulanmadı' : '—'} · Dış teslim: {workspace?.externalDelivery === 'not_performed' ? 'Yapılmadı' : '—'} · Yerel çıktı: {workspace?.localExport === 'user_authorized_only' ? 'Yalnız kullanıcı yetkisiyle' : '—'}</small>
          <small>Dışa paylaşım (exportSharing): yalnız yeni güçlü doğrulama, kapalı alan seçimi ve yerel çıktı onayıyla; varsayılan paylaşım yapılmaz.</small>
          <small>telefon veya sağlık içeriği loga, dış sağlayıcıya ya da kendiliğinden dışa aktarıma verilmez.</small>
        <small>İletişim teslimi: {workspace?.messageDelivery === 'not_performed' ? 'Yapılmadı' : '—'} · Acil servis teması: {workspace?.emergencyServiceContact === 'not_performed' ? 'Kurulmadı' : '—'} · Ağ çıkışı: {workspace?.networkEgressAdded === false ? 'Eklenmedi' : '—'}</small>
        <strong>Acil kart taşınabilirlik doğruluk sınırı</strong>
        <small>Bulut yükleme: {workspace?.cloudUpload === 'not_performed' ? 'Yapılmadı' : '—'} · PDF şifreleme: {workspace?.pdfEncryption === 'not_claimed' ? 'İddia edilmiyor' : '—'} · Şifreli paket: {workspace?.portablePackEncryption === 'application_specific_container' ? 'Uygulamaya özel konteyner' : '—'}</small>
        <small>Düz metin geçici dosya: {workspace?.plaintextTemporaryFiles === 'not_created' ? 'Oluşturulmadı' : '—'} · Pil düzeyi: {workspace?.batteryLevel === 'not_measured' ? 'Ölçülmedi' : '—'} · Otomatik düşük pil: {workspace?.automaticLowBatteryDetection === 'not_performed' ? 'Yapılmadı' : '—'}</small>
      </div>
    </Surface>
  </>;
  return localizeManagedLifeNode(panel, language);
}

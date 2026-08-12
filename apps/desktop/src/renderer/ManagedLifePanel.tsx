import { useMemo, useState } from 'react';
import type {
  FamilyMemberView,
  ManagedHomeInventoryItemType,
  ManagedHomeInventoryLedgerItemView,
  ManagedLifeActivityKind,
  ManagedLifeCategory,
  ManagedLifeDocumentKind,
  ManagedLifeProfileView,
  ManagedLifeReminderKind,
  ManagedLifeWorkspaceView,
  RecordManagedHomeInventoryItemInput,
  RecordManagedLifeItemInput,
  RecordPrivacy
} from '@ppt/domain';
import { Button, EmptyState, SectionHeader, StatusMessage, Surface } from './ui';

interface ManagedLifePanelProps {
  readonly people: readonly FamilyMemberView[];
  readonly workspace: ManagedLifeWorkspaceView | undefined;
  readonly onRecord: (input: RecordManagedLifeItemInput) => Promise<void>;
}

type PanelMode = 'profile'|'activity'|'life_document'|'home_inventory';
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
const formatDate = (value: string): string => new Intl.DateTimeFormat('tr-TR', {
  dateStyle: 'short', timeStyle: 'short'
}).format(new Date(value));
const amountMinor = (value: string): number | undefined => value.trim()
  ? Math.round(Number(value) * 100)
  : undefined;
const milliunits = (value: string): number => Math.round(Number(value) * 1_000);

const profileSummary = (profile: ManagedLifeProfileView): string => {
  switch (profile.category) {
    case 'insurance': return `${profile.details.insuranceKind} · ${profile.details.provider}`;
    case 'subscription': return `${profile.details.provider} · ${profile.details.planName}`;
    case 'education': return `${profile.details.institution} · ${profile.details.program}`;
    case 'employment': return `${profile.details.employer} · ${profile.details.position}`;
    case 'official_operation': return `${profile.details.authority} · ${profile.details.operationType}`;
    case 'home': return `${profile.details.tenure === 'owner' ? 'Mülk' : 'Kiralık'} · ${profile.details.addressLabel}`;
    case 'vehicle': return `${profile.details.vehicleType} · ${profile.details.energyType}${profile.details.plate ? ` · ${profile.details.plate}` : ''}`;
  }
};

const inventoryItemLabel = (item: ManagedHomeInventoryLedgerItemView): string => {
  switch (item.itemType) {
    case 'room': return item.name;
    case 'meter': return item.label;
    case 'meter_reading': return `${readingKindLabels[item.readingKind]} · ${formatDate(item.recordedAt)}`;
    case 'belonging': return item.name;
    case 'warranty': return `Garanti · ${formatDate(item.endsAt)}`;
    case 'service': return `${serviceKindLabels[item.serviceKind]} · ${formatDate(item.occurredAt)}`;
    case 'document': return item.label ?? homeDocumentKindLabels[item.documentKind];
  }
};

const inventoryItemDetail = (
  item: ManagedHomeInventoryLedgerItemView,
  allItems: readonly ManagedHomeInventoryLedgerItemView[]
): string => {
  const corrected = item.supersedesItemId ? ' · Düzeltme kaydı' : '';
  switch (item.itemType) {
    case 'room': return `${roomKindLabels[item.roomKind]}${corrected}`;
    case 'meter': return `${meterKindLabels[item.meterKind]} · ${readingUnitLabels[item.readingUnit]}${corrected}`;
    case 'meter_reading': {
      const meter = allItems.find((candidate) => candidate.itemType === 'meter' && candidate.id === item.meterId);
      const unit = meter?.itemType === 'meter' ? readingUnitLabels[meter.readingUnit] : 'mili-birim';
      return `${(item.readingMilliunits / 1_000).toLocaleString('tr-TR')} ${unit}${item.note ? ` · ${item.note}` : ''}${corrected}`;
    }
    case 'belonging': return `${belongingKindLabels[item.belongingKind]}${item.serialNumberMasked ? ` · Seri ${item.serialNumberMasked}` : ''}${item.purchaseAmountMinor !== undefined ? ` · ${(item.purchaseAmountMinor / 100).toLocaleString('tr-TR')} ${item.currency}` : ''}${corrected}`;
    case 'warranty': return `${item.provider ?? 'Sağlayıcı belirtilmedi'} · ${formatDate(item.startsAt)} — ${formatDate(item.endsAt)}${corrected}`;
    case 'service': return `${item.targetType === 'meter' ? 'Sayaç' : 'Eşya'} · ${item.provider ?? 'Sağlayıcı belirtilmedi'}${item.amountMinor !== undefined ? ` · ${(item.amountMinor / 100).toLocaleString('tr-TR')} ${item.currency}` : ''}${corrected}`;
    case 'document': return `${homeDocumentKindLabels[item.documentKind]} · Opak arşiv bağı: ${item.archiveItemId}${corrected}`;
  }
};

export function ManagedLifePanel({ people, workspace, onRecord }: ManagedLifePanelProps) {
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
  const submit = async () => {
    try {
      setMessage('');
      if (mode === 'profile') await submitProfile();
      else if (mode === 'activity') await submitActivity();
      else if (mode === 'life_document') await submitLifeDocument();
      else await submitHomeInventory();
      setMessageTone('success'); setMessage('Kayıt güvenli yerel deftere eklendi.');
    } catch (error) {
      setMessageTone('danger'); setMessage(error instanceof Error ? error.message : 'Kayıt eklenemedi.');
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
  const submitReady = mode === 'profile' ? profileReady
    : mode === 'activity' ? activityReady
      : mode === 'life_document' ? lifeDocumentReady : homeInventoryReady;

  return <>
    <Surface className="span-2">
      <SectionHeader eyebrow="B5 · EXT-030 · EXT-032" title="Yaşam Merkezi ve ev envanteri"/>
      <div className="button-row managed-life-mode-grid" role="group" aria-label="Yaşam kaydı türü">
        <Button tone={mode === 'profile' ? 'primary' : 'default'} onClick={() => setMode('profile')}>Profil</Button>
        <Button tone={mode === 'activity' ? 'primary' : 'default'} onClick={() => setMode('activity')}>Etkinlik / gider</Button>
        <Button tone={mode === 'life_document' ? 'primary' : 'default'} onClick={() => setMode('life_document')}>Profil belgesi</Button>
        <Button tone={mode === 'home_inventory' ? 'primary' : 'default'} onClick={() => setMode('home_inventory')}>Ev alanı ve envanter</Button>
      </div>
      <div className="notes-card managed-life-truth-card">
        <strong>Yalnız manuel, yerel takip</strong>
        <small>Akıllı sayaç, sağlayıcı veya garanti sicili sorgulanmaz; OCR, servis rezervasyonu, ödeme ve ağ erişimi yapılmaz.</small>
        <small>Belge içeriği okunmaz. Dosya yolu, ham belge, base64, kart numarası, CVV/CVC, PIN, parola, token ve gizli anahtar kabul edilmez.</small>
      </div>
    </Surface>

    <Surface className="workspace-form managed-life-form">
      <SectionHeader eyebrow="Yeni kayıt" title={mode === 'profile' ? 'Yaşam profili' : mode === 'activity' ? 'Etkinlik ve hatırlatma' : mode === 'life_document' ? 'Profil arşiv bağlantısı' : 'Ev envanteri olayı'}/>
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
        {inventoryType === 'belonging' && <><label>Bulunduğu alan (isteğe bağlı)<select value={roomId} onChange={(event) => setRoomId(event.target.value)}><option value="">Belirtilmedi</option>{rooms.map((room) => <option key={room.id} value={room.id}>{room.name}</option>)}</select></label><label>Eşya adı<input maxLength={120} value={belongingName} onChange={(event) => setBelongingName(event.target.value)}/></label><label>Eşya türü<select value={belongingKind} onChange={(event) => setBelongingKind(event.target.value as HomeBelongingKind)}>{Object.entries(belongingKindLabels).map(([value,label]) => <option key={value} value={value}>{label}</option>)}</select></label><label>Seri numarası (isteğe bağlı)<input autoComplete="off" spellCheck={false} maxLength={160} value={serialNumber} onChange={(event) => setSerialNumber(event.target.value)} placeholder="Liste görünümünde maskelenir"/></label><label>Satın alma zamanı (isteğe bağlı)<input type="datetime-local" value={purchasedAt} onChange={(event) => setPurchasedAt(event.target.value)}/></label><label>Manuel tutar<input type="number" min="0.01" step="0.01" disabled={Boolean(financeExpenseId)} value={amount} onChange={(event) => setAmount(event.target.value)}/></label><label>Para birimi<input maxLength={3} disabled={Boolean(financeExpenseId)} value={currency} onChange={(event) => setCurrency(event.target.value.toUpperCase())}/></label><label>Opak finans gideri kimliği (isteğe bağlı)<input maxLength={160} disabled={Boolean(amount)} value={financeExpenseId} onChange={(event) => setFinanceExpenseId(event.target.value)}/></label></>}
        {inventoryType === 'warranty' && <><label>Eşya<select value={belongingId} onChange={(event) => setBelongingId(event.target.value)}><option value="">Seçin</option>{belongings.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label><label>Sağlayıcı (isteğe bağlı)<input maxLength={160} value={provider} onChange={(event) => setProvider(event.target.value)}/></label><label>Başlangıç<input type="datetime-local" value={warrantyStartsAt} onChange={(event) => setWarrantyStartsAt(event.target.value)}/></label><label>Bitiş<input type="datetime-local" min={warrantyStartsAt} value={warrantyEndsAt} onChange={(event) => setWarrantyEndsAt(event.target.value)}/></label><label>Hatırlatma (isteğe bağlı)<input type="datetime-local" max={warrantyEndsAt} value={warrantyReminderAt} onChange={(event) => setWarrantyReminderAt(event.target.value)}/></label><label>Not (isteğe bağlı)<textarea maxLength={500} value={note} onChange={(event) => setNote(event.target.value)}/></label></>}
        {inventoryType === 'service' && <><label>Hedef türü<select value={targetType} onChange={(event) => { setTargetType(event.target.value as HomeServiceTargetType); setTargetItemId(''); }}><option value="room">Ev alanı / oda</option><option value="belonging">Eşya</option><option value="meter">Sayaç</option></select></label><label>Servis hedefi<select value={targetItemId} onChange={(event) => setTargetItemId(event.target.value)}><option value="">Seçin</option>{serviceTargets.map((item) => <option key={item.id} value={item.id}>{inventoryItemLabel(item)}</option>)}</select></label><label>Servis türü<select value={serviceKind} onChange={(event) => setServiceKind(event.target.value as HomeServiceKind)}>{Object.entries(serviceKindLabels).map(([value,label]) => <option key={value} value={value}>{label}</option>)}</select></label><label>Gerçekleşme zamanı<input type="datetime-local" max={localDateTime()} value={occurredAt} onChange={(event) => setOccurredAt(event.target.value)}/></label><label>Sağlayıcı (isteğe bağlı)<input maxLength={160} value={provider} onChange={(event) => setProvider(event.target.value)}/></label><label>Manuel tutar<input type="number" min="0.01" step="0.01" disabled={Boolean(financeExpenseId)} value={amount} onChange={(event) => setAmount(event.target.value)}/></label><label>Para birimi<input maxLength={3} disabled={Boolean(financeExpenseId)} value={currency} onChange={(event) => setCurrency(event.target.value.toUpperCase())}/></label><label>Opak finans gideri kimliği (isteğe bağlı)<input maxLength={160} disabled={Boolean(amount)} value={financeExpenseId} onChange={(event) => setFinanceExpenseId(event.target.value)}/></label><label>Not (isteğe bağlı)<textarea maxLength={500} value={note} onChange={(event) => setNote(event.target.value)}/></label></>}
        {inventoryType === 'document' && <><label>Hedef türü<select value={targetType} onChange={(event) => { setTargetType(event.target.value as HomeDocumentTargetType); setTargetItemId(''); }}><option value="belonging">Eşya</option><option value="meter">Sayaç</option><option value="warranty">Garanti</option><option value="service">Servis</option></select></label><label>Belge hedefi<select value={targetItemId} onChange={(event) => setTargetItemId(event.target.value)}><option value="">Seçin</option>{documentTargets.map((item) => <option key={item.id} value={item.id}>{inventoryItemLabel(item)}</option>)}</select></label><label>Belge türü<select value={homeDocumentKind} onChange={(event) => setHomeDocumentKind(event.target.value as HomeDocumentKind)}>{Object.entries(homeDocumentKindLabels).map(([value,label]) => <option key={value} value={value}>{label}</option>)}</select></label><label>Opak arşiv öğesi kimliği<input autoComplete="off" spellCheck={false} maxLength={160} value={archiveItemId} onChange={(event) => setArchiveItemId(event.target.value)}/></label><label>Etiket (isteğe bağlı)<input maxLength={120} value={documentLabel} onChange={(event) => setDocumentLabel(event.target.value)}/></label><div className="notes-card"><strong>Belge içeriği bu forma girmez.</strong><small>Yalnız opak arşiv kimliği ilişkilendirilir; dosya seçilmez, yol, ad, hash veya ham içerik taşınmaz.</small></div></>}
        <label>Önceki kaydı düzelt (isteğe bağlı)<select value={supersedesItemId} onChange={(event) => setSupersedesItemId(event.target.value)}><option value="">Yeni kayıt</option>{supersessionOptions.map((item) => <option key={item.id} value={item.id}>{inventoryItemLabel(item)} · {formatDate(item.createdAt)}</option>)}</select></label>
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
          <label>Opak arşiv öğesi kimliği<input autoComplete="off" spellCheck={false} maxLength={160} value={archiveItemId} onChange={(event) => setArchiveItemId(event.target.value)} placeholder="Örn. archive-item-01"/></label>
          <label>Etiket (isteğe bağlı)<input maxLength={120} value={documentLabel} onChange={(event) => setDocumentLabel(event.target.value)}/></label>
          <div className="notes-card"><strong>Belge içeriği bu forma girmez.</strong><small>Yalnız opak arşiv kimliğiyle ilişki kurulur; dosya seçilmez, yol veya ham içerik taşınmaz.</small></div>
        </>}
      </>}
      <Button tone="primary" onClick={() => void submit()} disabled={!submitReady}>Yerel deftere kaydet</Button>
      {message && <StatusMessage tone={messageTone}>{message}</StatusMessage>}
    </Surface>

    <Surface className="workspace-summary managed-life-summary">
      <SectionHeader eyebrow={`${workspace?.profiles.length ?? 0} profil · ${homeItems.length} ev envanteri olayı`} title="Yönetilen yaşam görünümü"/>
      {!workspace?.profiles.length ? <EmptyState title="Yönetilen yaşam profili yok" body="Sigorta, abonelik, eğitim, istihdam, resmî işlem, ev veya araç profili ekleyin."/> : workspace.profiles.map((profile) => {
        const profileHomeItems = homeItems.filter((item) => item.recordId === profile.id);
        return <div className="context-stat managed-life-profile-card" key={profile.id}>
          <strong>{categoryLabels[profile.category]} · {profile.title}</strong>
          <span>{personNames.get(profile.ownerPersonId) ?? 'Aile üyesi'} · {profile.status} · {profileSummary(profile)}</span>
          {profile.currentReminder && <small>{reminderLabels[profile.currentReminder.kind]} · {formatDate(profile.currentReminder.dueAt)}</small>}
          {profile.activities.map((activity) => <small key={activity.id}>{activityLabels[activity.activityKind]} · {formatDate(activity.occurredAt)}{activity.amountMinor !== undefined ? ` · ${(activity.amountMinor / 100).toLocaleString('tr-TR')} ${activity.currency}` : ''}{activity.quantityMilliunits !== undefined ? ` · ${(activity.quantityMilliunits / 1_000).toLocaleString('tr-TR')}` : ''}</small>)}
          {profile.documents.map((document) => <small key={document.id}>{documentLabels[document.documentKind]} · Arşiv bağı: <code>{document.archiveItemId}</code>{document.label ? ` · ${document.label}` : ''}</small>)}
          {profileHomeItems.length > 0 && <div className="managed-home-inventory-list">{profileHomeItems.map((item) => <article className="managed-home-inventory-row" key={item.id}><div><b>{homeInventoryLabels[item.itemType]}</b><strong>{inventoryItemLabel(item)}</strong><small>{inventoryItemDetail(item, profileHomeItems)}</small></div><span>Manuel · {item.externalVerification === 'not_performed' ? 'doğrulanmadı' : '—'}</span></article>)}</div>}
        </div>;
      })}
      <div className="notes-card managed-life-truth-card">
        <strong>Çalışma alanı doğruluk beyanı</strong>
        <small>Kaynak: {workspace?.dataSource === 'manual' ? 'Manuel' : '—'} · Akıllı sayaç: {workspace?.smartMeterLookup === 'not_performed' ? 'Sorgulanmadı' : '—'} · Sağlayıcı teması: {workspace?.providerContact === 'not_performed' ? 'Yapılmadı' : '—'}</small>
        <small>Garanti sicili: {workspace?.warrantyLookup === 'not_performed' ? 'Sorgulanmadı' : '—'} · OCR: {workspace?.ocr === 'not_performed' ? 'Yapılmadı' : '—'} · Ödeme: {workspace?.paymentExecution === 'not_performed' ? 'Yapılmadı' : '—'}</small>
        <small>Belge içeriği açığa çıkarma: {workspace?.documentContentExposure === 'not_performed' ? 'Yapılmadı' : '—'} · Ağ gerçeği üretilmez</small>
      </div>
    </Surface>
  </>;
}

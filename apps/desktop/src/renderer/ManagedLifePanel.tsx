import { useMemo, useState } from 'react';
import type {
  FamilyMemberView,
  ManagedLifeActivityKind,
  ManagedLifeCategory,
  ManagedLifeDocumentKind,
  ManagedLifeProfileView,
  ManagedLifeReminderKind,
  ManagedLifeWorkspaceView,
  RecordManagedLifeItemInput,
  RecordPrivacy
} from '@ppt/domain';
import { Button, EmptyState, SectionHeader, StatusMessage, Surface } from './ui';

interface ManagedLifePanelProps {
  readonly people: readonly FamilyMemberView[];
  readonly workspace: ManagedLifeWorkspaceView | undefined;
  readonly onRecord: (input: RecordManagedLifeItemInput) => Promise<void>;
}

const categoryLabels: Record<ManagedLifeCategory, string> = {
  insurance: 'Sigorta',
  subscription: 'Abonelik',
  education: 'Eğitim',
  employment: 'İstihdam',
  official_operation: 'Resmî işlem',
  home: 'Ev',
  vehicle: 'Araç'
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

const remindersByCategory: Record<ManagedLifeCategory, readonly ManagedLifeReminderKind[]> = {
  insurance: ['renewal','expiry','payment','insurance','other'],
  subscription: ['renewal','payment','contract_end','other'],
  education: ['term','payment','expiry','other'],
  employment: ['contract_end','expiry','other'],
  official_operation: ['official_deadline','renewal','expiry','other'],
  home: ['rent','insurance','renewal','expiry','payment','maintenance','other'],
  vehicle: ['insurance','inspection','maintenance','renewal','expiry','payment','other']
};

const activitiesByCategory: Record<ManagedLifeCategory, readonly ManagedLifeActivityKind[]> = {
  insurance: ['renewal','insurance_premium','expense'],
  subscription: ['renewal','expense'],
  education: ['renewal','expense'],
  employment: ['renewal','expense'],
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

export function ManagedLifePanel({ people, workspace, onRecord }: ManagedLifePanelProps) {
  const [mode, setMode] = useState<'profile'|'activity'|'document'>('profile');
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
  const [message, setMessage] = useState('');
  const [messageTone, setMessageTone] = useState<'success'|'danger'>('success');

  const selectedProfile = workspace?.profiles.find((profile) => profile.id === recordId);
  const availableActivities = selectedProfile ? activitiesByCategory[selectedProfile.category] : [];
  const availableDocuments = selectedProfile ? documentsByCategory[selectedProfile.category] : [];
  const selectedReminderKinds = selectedProfile
    ? remindersByCategory[selectedProfile.category]
    : remindersByCategory[category];

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
    const profile = workspace?.profiles.find((candidate) => candidate.id === id);
    if (!profile) return;
    setActivityKind(activitiesByCategory[profile.category][0]!);
    setDocumentKind(documentsByCategory[profile.category][0]!);
    setReminderKind(remindersByCategory[profile.category][0]!);
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
    const quantityMilliunits = quantity.trim() ? Math.round(Number(quantity) * 1_000) : undefined;
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

  const submitDocument = async () => {
    await onRecord({
      itemType: 'document', recordId, archiveItemId, documentKind,
      ...(documentLabel.trim() ? { label: documentLabel } : {})
    });
    setArchiveItemId(''); setDocumentLabel('');
  };

  const submit = async () => {
    try {
      setMessage('');
      if (mode === 'profile') await submitProfile();
      else if (mode === 'activity') await submitActivity();
      else await submitDocument();
      setMessageTone('success'); setMessage('Yönetilen yaşam kaydı güvenli yerel deftere eklendi.');
    } catch (error) {
      setMessageTone('danger'); setMessage(error instanceof Error ? error.message : 'Kayıt eklenemedi.');
    }
  };

  const quantityRequired = activityKind === 'fuel' || activityKind === 'charging';
  const profileReady = ownerPersonId && title.trim().length >= 2 && detailA && detailB
    && (category !== 'home' || detailC.trim().length > 0);
  const activityReady = recordId && occurredAt && (!quantityRequired || Number(quantity) > 0);
  const documentReady = recordId && /^[A-Za-z0-9][A-Za-z0-9._-]{0,159}$/u.test(archiveItemId);

  return <>
    <Surface className="span-2">
      <SectionHeader eyebrow="B5 · yönetilen yaşam defteri" title="Yedi kategori, tek yerel çalışma alanı"/>
      <div className="button-row" role="group" aria-label="Yaşam kaydı türü">
        <Button tone={mode === 'profile' ? 'primary' : 'default'} onClick={() => setMode('profile')}>Profil</Button>
        <Button tone={mode === 'activity' ? 'primary' : 'default'} onClick={() => setMode('activity')}>Etkinlik / gider</Button>
        <Button tone={mode === 'document' ? 'primary' : 'default'} onClick={() => setMode('document')}>Arşiv belge bağı</Button>
      </div>
      <div className="notes-card">
        <strong>Yalnız manuel takip</strong>
        <small>Dış sicil doğrulaması, sağlayıcı iletişimi, ödeme, ağ erişimi ve belge içeriği okuma yapılmaz.</small>
        <small>Dosya yolu, ham belge, base64 içerik, kart numarası, CVV/CVC, PIN, parola ve gizli anahtar kabul edilmez.</small>
      </div>
    </Surface>

    <Surface className="workspace-form">
      <SectionHeader eyebrow="Yeni kayıt" title={mode === 'profile' ? 'Yaşam profili' : mode === 'activity' ? 'Etkinlik ve hatırlatma' : 'Opak arşiv bağlantısı'}/>
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
      <Button tone="primary" onClick={() => void submit()} disabled={mode === 'profile' ? !profileReady : mode === 'activity' ? !activityReady : !documentReady}>Yerel deftere kaydet</Button>
      {message && <StatusMessage tone={messageTone}>{message}</StatusMessage>}
    </Surface>

    <Surface className="workspace-summary">
      <SectionHeader eyebrow={`${workspace?.profiles.length ?? 0} profil · ${workspace?.upcomingReminders.length ?? 0} yaklaşan hatırlatma`} title="Yönetilen yaşam görünümü"/>
      {!workspace?.profiles.length ? <EmptyState title="Yönetilen yaşam profili yok" body="Sigorta, abonelik, eğitim, istihdam, resmî işlem, ev veya araç profili ekleyin."/> : workspace.profiles.map((profile) => <div className="context-stat" key={profile.id}>
        <strong>{categoryLabels[profile.category]} · {profile.title}</strong>
        <span>{personNames.get(profile.ownerPersonId) ?? 'Aile üyesi'} · {profile.status} · {profileSummary(profile)}</span>
        {profile.currentReminder && <small>{reminderLabels[profile.currentReminder.kind]} · {formatDate(profile.currentReminder.dueAt)}</small>}
        {profile.activities.map((activity) => <small key={activity.id}>{activityLabels[activity.activityKind]} · {formatDate(activity.occurredAt)}{activity.amountMinor !== undefined ? ` · ${(activity.amountMinor / 100).toLocaleString('tr-TR')} ${activity.currency}` : ''}{activity.quantityMilliunits !== undefined ? ` · ${(activity.quantityMilliunits / 1_000).toLocaleString('tr-TR')}` : ''}</small>)}
        {profile.documents.map((document) => <small key={document.id}>{documentLabels[document.documentKind]} · Arşiv bağı: <code>{document.archiveItemId}</code>{document.label ? ` · ${document.label}` : ''}</small>)}
      </div>)}
      <div className="notes-card">
        <strong>Çalışma alanı doğruluk beyanı</strong>
        <small>Kaynak: {workspace?.dataSource === 'manual' ? 'Manuel' : '—'} · Dış sicil: {workspace?.externalRegistryLookup === 'not_performed' ? 'Yapılmadı' : '—'} · Sağlayıcı teması: {workspace?.providerContact === 'not_performed' ? 'Yapılmadı' : '—'}</small>
        <small>Ödeme: {workspace?.paymentExecution === 'not_performed' ? 'Yapılmadı' : '—'} · Belge içeriği açığa çıkarma: {workspace?.documentContentExposure === 'not_performed' ? 'Yapılmadı' : '—'} · Ağ gerçeği üretilmez</small>
      </div>
    </Surface>
  </>;
}

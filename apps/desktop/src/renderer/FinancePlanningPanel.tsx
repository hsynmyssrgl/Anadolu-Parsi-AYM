import { useMemo, useState } from 'react';
import type {
  FamilyMemberView,
  FinanceAssetClass,
  FinanceCategoryKind,
  FinanceGoalKind,
  FinancePlanningItemType,
  FinancePlanningWorkspaceView,
  FinanceRecurringFrequency,
  FinanceRecurringStatus,
  RecordFinancePlanningItemInput,
  RecordPrivacy
} from '@ppt/domain';
import { Button, EmptyState, SectionHeader, StatusMessage, Surface } from './ui';
import { FinanceImportPanel } from './FinanceImportPanel';

interface FinancePlanningPanelProps {
  readonly people: readonly FamilyMemberView[];
  readonly workspace: FinancePlanningWorkspaceView | undefined;
  readonly onRecord: (input: RecordFinancePlanningItemInput) => Promise<void>;
  readonly onWorkspaceChange: (workspace: FinancePlanningWorkspaceView) => void;
}

const modeLabels: Record<FinancePlanningItemType, string> = {
  category: 'Gelir / gider kategorisi',
  cash_flow: 'Nakit akışı',
  budget: 'Aylık bütçe revizyonu',
  recurring_rule: 'Yinelenen işlem',
  recurring_state: 'Yinelenen işlem durumu',
  goal: 'Finansal hedef',
  goal_progress: 'Hedef ilerlemesi',
  asset: 'Portföy varlığı',
  asset_valuation: 'Portföy değerlemesi'
};

const categoryLabels: Record<FinanceCategoryKind, string> = { income: 'Gelir', expense: 'Gider' };
const frequencyLabels: Record<FinanceRecurringFrequency, string> = {
  weekly: 'Haftalık', monthly: 'Aylık', quarterly: 'Üç aylık', yearly: 'Yıllık'
};
const recurringStatusLabels: Record<FinanceRecurringStatus, string> = {
  active: 'Aktif', paused: 'Duraklatıldı', ended: 'Sona erdi'
};
const goalKindLabels: Record<FinanceGoalKind, string> = {
  savings: 'Birikim', debt_reduction: 'Borç azaltma', investment: 'Yatırım', purchase: 'Satın alma',
  emergency_fund: 'Acil durum fonu', other: 'Diğer'
};
const assetClassLabels: Record<FinanceAssetClass, string> = {
  cash: 'Nakit', deposit: 'Mevduat', precious_metal_fx: 'Altın / döviz', investment: 'Yatırım',
  pension: 'Bireysel emeklilik', real_estate: 'Gayrimenkul', vehicle: 'Araç'
};
const privacyLabels: Record<RecordPrivacy, string> = {
  private: 'Özel', selected_members: 'Seçili üyeler', family: 'Aile'
};

const localDateTime = (): string => {
  const value = new Date();
  return new Date(value.getTime() - value.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
};
const localMonth = (): string => localDateTime().slice(0, 7);
const toIso = (value: string): string => new Date(value).toISOString();
const formatDate = (value: string): string => new Intl.DateTimeFormat('tr-TR', {
  dateStyle: 'short', timeStyle: 'short'
}).format(new Date(value));
const formatMoney = (value: number, currency: string): string =>
  `${value.toLocaleString('tr-TR', { maximumFractionDigits: 2 })} ${currency}`;

export function FinancePlanningPanel({ people, workspace, onRecord, onWorkspaceChange }: FinancePlanningPanelProps) {
  const [mode, setMode] = useState<FinancePlanningItemType>('category');
  const [scope, setScope] = useState('family');
  const [ownerPersonId, setOwnerPersonId] = useState(people[0]?.id ?? '');
  const [privacy, setPrivacy] = useState<RecordPrivacy>('private');
  const [name, setName] = useState('');
  const [categoryKind, setCategoryKind] = useState<FinanceCategoryKind>('expense');
  const [categoryId, setCategoryId] = useState('');
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState('TRY');
  const [occurredAt, setOccurredAt] = useState(localDateTime);
  const [cashStatus, setCashStatus] = useState<'planned' | 'realized'>('planned');
  const [description, setDescription] = useState('');
  const [periodMonth, setPeriodMonth] = useState(localMonth);
  const [frequency, setFrequency] = useState<FinanceRecurringFrequency>('monthly');
  const [intervalCount, setIntervalCount] = useState('1');
  const [nextOccurrenceAt, setNextOccurrenceAt] = useState(localDateTime);
  const [endsAt, setEndsAt] = useState('');
  const [recurringRuleId, setRecurringRuleId] = useState('');
  const [recurringStatus, setRecurringStatus] = useState<FinanceRecurringStatus>('paused');
  const [goalKind, setGoalKind] = useState<FinanceGoalKind>('savings');
  const [targetAmount, setTargetAmount] = useState('');
  const [initialAmount, setInitialAmount] = useState('0');
  const [dueAt, setDueAt] = useState('');
  const [goalId, setGoalId] = useState('');
  const [assetClass, setAssetClass] = useState<FinanceAssetClass>('cash');
  const [quantity, setQuantity] = useState('1');
  const [unitValue, setUnitValue] = useState('');
  const [assetId, setAssetId] = useState('');
  const [note, setNote] = useState('');
  const [message, setMessage] = useState('');
  const [messageTone, setMessageTone] = useState<'success' | 'danger'>('success');

  const selectedOwnerId = scope === 'family' ? undefined : scope;
  const activeSummary = scope === 'family'
    ? workspace?.familySummary
    : workspace?.personSummaries.find((item) => item.ownerPersonId === scope);
  const visibleBudgetVariances = useMemo(() => (
    workspace?.budgetVariances.filter((item) => !selectedOwnerId || item.ownerPersonId === selectedOwnerId) ?? []
  ), [selectedOwnerId, workspace]);
  const visibleUpcoming = useMemo(() => (
    workspace?.upcomingPayments.filter((item) => !selectedOwnerId || item.ownerPersonId === selectedOwnerId) ?? []
  ), [selectedOwnerId, workspace]);

  const submit = async () => {
    try {
      setMessage('');
      let input: RecordFinancePlanningItemInput;
      switch (mode) {
        case 'category':
          input = { itemType: mode, ownerPersonId, name, kind: categoryKind, privacy };
          break;
        case 'cash_flow':
          input = {
            itemType: mode,
            categoryId,
            amount: Number(amount),
            currency,
            occurredAt: toIso(occurredAt),
            status: cashStatus,
            ...(description.trim() ? { description: description.trim() } : {})
          };
          break;
        case 'budget':
          input = { itemType: mode, categoryId, periodMonth, plannedAmount: Number(amount), currency };
          break;
        case 'recurring_rule':
          input = {
            itemType: mode,
            categoryId,
            amount: Number(amount),
            currency,
            frequency,
            intervalCount: Number(intervalCount),
            startsAt: toIso(occurredAt),
            nextOccurrenceAt: toIso(nextOccurrenceAt),
            ...(endsAt ? { endsAt: toIso(endsAt) } : {}),
            ...(description.trim() ? { description: description.trim() } : {})
          };
          break;
        case 'recurring_state':
          input = { itemType: mode, recurringRuleId, status: recurringStatus, effectiveAt: toIso(occurredAt) };
          break;
        case 'goal':
          input = {
            itemType: mode,
            ownerPersonId,
            title: name,
            kind: goalKind,
            targetAmount: Number(targetAmount),
            initialAmount: Number(initialAmount),
            currency,
            ...(dueAt ? { dueAt: toIso(dueAt) } : {}),
            privacy
          };
          break;
        case 'goal_progress':
          input = {
            itemType: mode,
            goalId,
            currentAmount: Number(amount),
            recordedAt: toIso(occurredAt),
            ...(note.trim() ? { note: note.trim() } : {})
          };
          break;
        case 'asset':
          input = {
            itemType: mode,
            ownerPersonId,
            name,
            assetClass,
            currency,
            quantity: Number(quantity),
            unitValue: Number(unitValue),
            valuedAt: toIso(occurredAt),
            ...(note.trim() ? { note: note.trim() } : {}),
            privacy
          };
          break;
        case 'asset_valuation':
          input = {
            itemType: mode,
            assetId,
            quantity: Number(quantity),
            unitValue: Number(unitValue),
            valuedAt: toIso(occurredAt),
            ...(note.trim() ? { note: note.trim() } : {})
          };
          break;
      }
      await onRecord(input);
      setMessageTone('success');
      setMessage(`${modeLabels[mode]} eklemeli finans defterine kaydedildi.`);
      if (mode === 'category' || mode === 'goal' || mode === 'asset') setName('');
      if (mode !== 'category') setDescription('');
      setNote('');
    } catch (error) {
      setMessageTone('danger');
      setMessage(error instanceof Error ? error.message : 'Finans planlama kaydı eklenemedi.');
    }
  };

  const requiresCategory = mode === 'cash_flow' || mode === 'budget' || mode === 'recurring_rule';
  const requiresOwner = mode === 'category' || mode === 'goal' || mode === 'asset';
  const canSubmit = (() => {
    if (requiresOwner && !ownerPersonId) return false;
    if (requiresCategory && !categoryId) return false;
    if (mode === 'recurring_state') return Boolean(recurringRuleId && occurredAt);
    if (mode === 'goal_progress') return Boolean(goalId && amount && occurredAt);
    if (mode === 'asset_valuation') return Boolean(assetId && quantity && unitValue !== '' && occurredAt);
    if (mode === 'category') return name.trim().length >= 2;
    if (mode === 'goal') return name.trim().length >= 2 && Boolean(targetAmount);
    if (mode === 'asset') return name.trim().length >= 2 && Boolean(quantity && unitValue !== '' && occurredAt);
    if (mode === 'budget') return amount !== '' && Boolean(periodMonth);
    return Boolean(amount && occurredAt);
  })();

  return <>
    <Surface className="span-2 workspace-summary">
      <SectionHeader eyebrow="B4-10 · B4-11 · B4-12" title="Bütçe, hedef, portföy ve net değer merkezi"/>
      <div className="notes-card">
        <strong>Her para birimi ayrı hesaplanır; yapay kur dönüşümü yapılmaz.</strong>
        <small>Veri kaynağı manuel · Banka eşitlemesi yapılmadı · Dış fiyat doğrulaması yapılmadı · Ödeme icrası yapılmadı</small>
      </div>
      <label>Analiz kapsamı<select value={scope} onChange={(event) => setScope(event.target.value)}>
        <option value="family">Tüm aile</option>
        {people.map((person) => <option key={person.id} value={person.id}>{person.displayName}</option>)}
      </select></label>
      <div className="workspace-grid">
        {(activeSummary?.currencySummaries ?? []).map((summary) => <div className="context-stat" key={summary.currency}>
          <strong>{summary.currency} · Net değer {formatMoney(summary.netWorth, summary.currency)}</strong>
          <span>Varlık {formatMoney(summary.assetValue, summary.currency)} · Borç {formatMoney(summary.liabilityValue, summary.currency)}</span>
          <small>Borç oranı {summary.debtRatioBasisPoints === undefined ? 'hesaplanamadı' : `%${(summary.debtRatioBasisPoints / 100).toLocaleString('tr-TR', { maximumFractionDigits: 2 })}`} · Gerçekleşen gelir {formatMoney(summary.realizedIncome, summary.currency)} · gider {formatMoney(summary.realizedExpense, summary.currency)}</small>
        </div>)}
      </div>
      {(activeSummary?.currencySummaries.length ?? 0) === 0 && <EmptyState title="Bu kapsamda finans özeti yok" body="Kategori, nakit akışı veya portföy varlığı eklediğinizde para birimi bazlı özet oluşur."/>}
    </Surface>

    <FinanceImportPanel people={people} workspace={workspace} onWorkspaceChange={onWorkspaceChange}/>

    <Surface className="workspace-form">
      <SectionHeader eyebrow="Append-only finans defteri" title="Planlama kaydı ekle"/>
      <label>İşlem türü<select value={mode} onChange={(event) => setMode(event.target.value as FinancePlanningItemType)}>
        {Object.entries(modeLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
      </select></label>
      {requiresOwner && <>
        <label>Kayıt sahibi<select value={ownerPersonId} onChange={(event) => setOwnerPersonId(event.target.value)}>
          <option value="">Seçin</option>{people.map((person) => <option key={person.id} value={person.id}>{person.displayName}</option>)}
        </select></label>
        <label>Gizlilik<select value={privacy} onChange={(event) => setPrivacy(event.target.value as RecordPrivacy)}>
          {Object.entries(privacyLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select></label>
      </>}
      {(mode === 'category' || mode === 'goal' || mode === 'asset') && <label>{mode === 'goal' ? 'Hedef başlığı' : mode === 'asset' ? 'Varlık adı' : 'Kategori adı'}<input maxLength={120} value={name} onChange={(event) => setName(event.target.value)}/></label>}
      {mode === 'category' && <label>Kategori türü<select value={categoryKind} onChange={(event) => setCategoryKind(event.target.value as FinanceCategoryKind)}>{Object.entries(categoryLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>}
      {requiresCategory && <label>Kategori<select value={categoryId} onChange={(event) => setCategoryId(event.target.value)}><option value="">Seçin</option>{workspace?.categories.map((category) => <option key={category.id} value={category.id}>{category.name} · {categoryLabels[category.kind]}</option>)}</select></label>}
      {(mode === 'cash_flow' || mode === 'budget' || mode === 'recurring_rule' || mode === 'goal_progress') && <label>Tutar<input type="number" min="0" step="0.01" value={amount} onChange={(event) => setAmount(event.target.value)}/></label>}
      {(mode === 'cash_flow' || mode === 'budget' || mode === 'recurring_rule' || mode === 'goal' || mode === 'asset') && <label>Para birimi<input maxLength={3} value={currency} onChange={(event) => setCurrency(event.target.value.toUpperCase())}/></label>}
      {mode === 'cash_flow' && <label>Durum<select value={cashStatus} onChange={(event) => setCashStatus(event.target.value as 'planned' | 'realized')}><option value="planned">Planlandı</option><option value="realized">Gerçekleşti</option></select></label>}
      {mode === 'budget' && <label>Bütçe dönemi<input type="month" value={periodMonth} onChange={(event) => setPeriodMonth(event.target.value)}/></label>}
      {mode === 'recurring_rule' && <>
        <label>Sıklık<select value={frequency} onChange={(event) => setFrequency(event.target.value as FinanceRecurringFrequency)}>{Object.entries(frequencyLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
        <label>Tekrar aralığı<input type="number" min="1" max="120" step="1" value={intervalCount} onChange={(event) => setIntervalCount(event.target.value)}/></label>
        <label>Sonraki işlem<input type="datetime-local" value={nextOccurrenceAt} onChange={(event) => setNextOccurrenceAt(event.target.value)}/></label>
        <label>Bitiş (isteğe bağlı)<input type="datetime-local" value={endsAt} onChange={(event) => setEndsAt(event.target.value)}/></label>
      </>}
      {mode === 'recurring_state' && <>
        <label>Yinelenen işlem<select value={recurringRuleId} onChange={(event) => setRecurringRuleId(event.target.value)}><option value="">Seçin</option>{workspace?.recurringRules.map((rule) => <option key={rule.id} value={rule.id}>{rule.description ?? categoryLabels[rule.direction]} · {formatMoney(rule.amount, rule.currency)}</option>)}</select></label>
        <label>Yeni durum<select value={recurringStatus} onChange={(event) => setRecurringStatus(event.target.value as FinanceRecurringStatus)}>{Object.entries(recurringStatusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
      </>}
      {mode === 'goal' && <>
        <label>Hedef türü<select value={goalKind} onChange={(event) => setGoalKind(event.target.value as FinanceGoalKind)}>{Object.entries(goalKindLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
        <label>Hedef tutar<input type="number" min="0.01" step="0.01" value={targetAmount} onChange={(event) => setTargetAmount(event.target.value)}/></label>
        <label>Başlangıç tutarı<input type="number" min="0" step="0.01" value={initialAmount} onChange={(event) => setInitialAmount(event.target.value)}/></label>
        <label>Hedef tarihi<input type="datetime-local" value={dueAt} onChange={(event) => setDueAt(event.target.value)}/></label>
      </>}
      {mode === 'goal_progress' && <label>Hedef<select value={goalId} onChange={(event) => setGoalId(event.target.value)}><option value="">Seçin</option>{workspace?.goals.map((goal) => <option key={goal.id} value={goal.id}>{goal.title} · {formatMoney(goal.currentAmount, goal.currency)} / {formatMoney(goal.targetAmount, goal.currency)}</option>)}</select></label>}
      {mode === 'asset' && <label>Varlık sınıfı<select value={assetClass} onChange={(event) => setAssetClass(event.target.value as FinanceAssetClass)}>{Object.entries(assetClassLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>}
      {mode === 'asset_valuation' && <label>Portföy varlığı<select value={assetId} onChange={(event) => setAssetId(event.target.value)}><option value="">Seçin</option>{workspace?.portfolioAssets.map((asset) => <option key={asset.id} value={asset.id}>{asset.name} · {assetClassLabels[asset.assetClass]}</option>)}</select></label>}
      {(mode === 'asset' || mode === 'asset_valuation') && <>
        <label>Miktar<input type="number" min="0.000001" step="any" value={quantity} onChange={(event) => setQuantity(event.target.value)}/></label>
        <label>Birim değer<input type="number" min="0" step="any" value={unitValue} onChange={(event) => setUnitValue(event.target.value)}/></label>
        <div className="notes-card"><strong>Hesaplanan piyasa değeri: {(Number(quantity || '0') * Number(unitValue || '0')).toLocaleString('tr-TR', { maximumFractionDigits: 2 })} {mode === 'asset' ? currency : workspace?.portfolioAssets.find((asset) => asset.id === assetId)?.currency ?? ''}</strong><small>Birim değer kullanıcı beyanıdır; dış piyasa fiyatı alınmaz.</small></div>
      </>}
      {(mode === 'cash_flow' || mode === 'recurring_rule') && <label>Açıklama<input maxLength={240} value={description} onChange={(event) => setDescription(event.target.value)}/></label>}
      {(mode === 'goal_progress' || mode === 'asset' || mode === 'asset_valuation') && <label>Not<input maxLength={500} value={note} onChange={(event) => setNote(event.target.value)}/></label>}
      {(mode === 'cash_flow' || mode === 'recurring_rule' || mode === 'recurring_state' || mode === 'goal_progress' || mode === 'asset' || mode === 'asset_valuation') && <label>{mode === 'recurring_rule' ? 'Başlangıç' : mode === 'asset' || mode === 'asset_valuation' ? 'Değerleme zamanı' : 'Kayıt zamanı'}<input type="datetime-local" value={occurredAt} onChange={(event) => setOccurredAt(event.target.value)}/></label>}
      <Button tone="primary" disabled={!canSubmit} onClick={() => void submit()}>{modeLabels[mode]} kaydet</Button>
      {message && <StatusMessage tone={messageTone}>{message}</StatusMessage>}
    </Surface>

    <Surface className="workspace-summary">
      <SectionHeader eyebrow="Bütçe gerçekleşme analizi" title={`${visibleBudgetVariances.length} kategori dönemi`}/>
      {visibleBudgetVariances.length === 0 ? <EmptyState title="Bütçe farkı yok" body="Aynı kategori, ay ve para biriminde bütçe ile gerçekleşen akış bulunduğunda fark hesaplanır."/> : visibleBudgetVariances.map((item) => <div className="context-stat" key={item.budgetRevisionId}>
        <strong>{item.categoryName} · {item.periodMonth}</strong>
        <span>Plan {formatMoney(item.plannedAmount, item.currency)} · Gerçekleşen {formatMoney(item.realizedAmount, item.currency)}</span>
        <small>Fark {formatMoney(item.varianceAmount, item.currency)} · {item.overBudget ? 'Bütçe aşıldı' : item.belowIncomeTarget ? 'Gelir hedefinin altında' : 'Plan içinde'}</small>
      </div>)}
    </Surface>

    <Surface className="workspace-summary">
      <SectionHeader eyebrow="Yaklaşan ödemeler" title={`${visibleUpcoming.length} kayıt`}/>
      {visibleUpcoming.length === 0 ? <EmptyState title="Yaklaşan ödeme yok" body="Kart, kredi, borç, yinelenen gider veya planlı nakit akışı vadeleri burada birleşir."/> : visibleUpcoming.slice(0, 20).map((item) => <div className="context-stat" key={`${item.source}-${item.id}`}>
        <strong>{item.title} · {formatMoney(item.amount, item.currency)}</strong>
        <span>{formatDate(item.dueAt)} · {item.source.replaceAll('_', ' ')}</span>
        <small>Ödeme icrası yapılmadı; yalnız takip görünümüdür.</small>
      </div>)}
    </Surface>

    <Surface className="workspace-summary">
      <SectionHeader eyebrow="Kategoriler ve nakit akışı" title={`${workspace?.categories.length ?? 0} kategori · ${workspace?.cashFlowEntries.length ?? 0} hareket`}/>
      {workspace?.categories.map((category) => <div className="context-stat" key={category.id}><strong>{category.name} · {categoryLabels[category.kind]}</strong><span>{workspace.cashFlowEntries.filter((entry) => entry.categoryId === category.id).length} nakit akışı · {people.find((person) => person.id === category.ownerPersonId)?.displayName ?? category.ownerPersonId}</span></div>)}
    </Surface>

    <Surface className="workspace-summary">
      <SectionHeader eyebrow="Yinelenen işlemler" title={`${workspace?.recurringRules.length ?? 0} kural`}/>
      {(workspace?.recurringRules.length ?? 0) === 0 ? <EmptyState title="Yinelenen işlem yok" body="Düzenli gelir ve giderleri kategoriye bağlı olarak tanımlayın."/> : workspace?.recurringRules.map((rule) => <div className="context-stat" key={rule.id}><strong>{rule.description ?? categoryLabels[rule.direction]} · {formatMoney(rule.amount, rule.currency)}</strong><span>{frequencyLabels[rule.frequency]} / {rule.intervalCount} · {recurringStatusLabels[rule.currentStatus]} · sonraki {formatDate(rule.nextOccurrenceAt)}</span></div>)}
    </Surface>

    <Surface className="workspace-summary">
      <SectionHeader eyebrow="Finansal hedefler" title={`${workspace?.goals.length ?? 0} hedef`}/>
      {(workspace?.goals.length ?? 0) === 0 ? <EmptyState title="Finansal hedef yok" body="Birikim, borç azaltma, yatırım veya satın alma hedefi ekleyin."/> : workspace?.goals.map((goal) => <div className="context-stat" key={goal.id}><strong>{goal.title} · %{(goal.completionBasisPoints / 100).toLocaleString('tr-TR', { maximumFractionDigits: 2 })}</strong><span>{formatMoney(goal.currentAmount, goal.currency)} / {formatMoney(goal.targetAmount, goal.currency)} · {goalKindLabels[goal.kind]}</span><small>{goal.achieved ? 'Hedefe ulaşıldı' : goal.dueAt ? `Hedef tarihi ${formatDate(goal.dueAt)}` : 'Hedef tarihi yok'} · {goal.progressHistory.length} ilerleme kaydı</small></div>)}
    </Surface>

    <Surface className="workspace-summary">
      <SectionHeader eyebrow="Portföy görünümü" title={`${workspace?.portfolioAssets.length ?? 0} varlık`}/>
      {(workspace?.portfolioAssets.length ?? 0) === 0 ? <EmptyState title="Portföy varlığı yok" body="Nakit, mevduat, altın/döviz, yatırım, emeklilik, gayrimenkul veya araç ekleyin."/> : workspace?.portfolioAssets.map((asset) => <div className="context-stat" key={asset.id}><strong>{asset.name} · {formatMoney(asset.currentMarketValue, asset.currency)}</strong><span>{assetClassLabels[asset.assetClass]} · {asset.currentQuantity.toLocaleString('tr-TR')} × {formatMoney(asset.currentUnitValue, asset.currency)}</span><small>Değerleme {formatDate(asset.currentValuedAt)} · {asset.valuationHistory.length} ek değerleme · dış fiyat doğrulaması yapılmadı</small></div>)}
    </Surface>
  </>;
}

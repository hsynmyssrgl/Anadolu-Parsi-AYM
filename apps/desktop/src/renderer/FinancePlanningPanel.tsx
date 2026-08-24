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
  FinanceUpcomingPaymentSource,
  RecordFinancePlanningItemInput,
  RecordPrivacy
} from '@ppt/domain';
import { Button, EmptyState, SectionHeader, StatusMessage, Surface } from './ui';
import { FinanceImportPanel } from './FinanceImportPanel';
import { selectUiCopy, useLocalization } from './localization';
import { toUserFacingErrorMessage } from './user-facing-error';

interface FinancePlanningPanelProps {
  readonly people: readonly FamilyMemberView[];
  readonly workspace: FinancePlanningWorkspaceView | undefined;
  readonly onRecord: (input: RecordFinancePlanningItemInput) => Promise<void>;
  readonly onWorkspaceChange: (workspace: FinancePlanningWorkspaceView) => void;
}

const localDateTime = (): string => {
  const value = new Date();
  return new Date(value.getTime() - value.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
};
const localMonth = (): string => localDateTime().slice(0, 7);
const toIso = (value: string): string => new Date(value).toISOString();
const formatDate = (value: string, locale: string): string => new Intl.DateTimeFormat(locale, {
  dateStyle: 'short', timeStyle: 'short'
}).format(new Date(value));
const formatMoney = (value: number, currency: string, locale: string): string =>
  `${value.toLocaleString(locale, { maximumFractionDigits: 2 })} ${currency}`;

export function FinancePlanningPanel({ people, workspace, onRecord, onWorkspaceChange }: FinancePlanningPanelProps) {
  const { language, locale } = useLocalization();
  const text = (turkish: string, english: string): string => selectUiCopy(language, turkish, english);
  const modeLabels: Record<FinancePlanningItemType, string> = {
    category: text('Gelir / gider kategorisi','Income / expense category'), cash_flow: text('Nakit akışı','Cash flow'),
    budget: text('Aylık bütçe revizyonu','Monthly budget revision'), recurring_rule: text('Yinelenen işlem','Recurring transaction'),
    recurring_state: text('Yinelenen işlem durumu','Recurring transaction state'), goal: text('Finansal hedef','Financial goal'),
    goal_progress: text('Hedef ilerlemesi','Goal progress'), asset: text('Portföy varlığı','Portfolio asset'), asset_valuation: text('Portföy değerlemesi','Portfolio valuation')
  };
  const categoryLabels: Record<FinanceCategoryKind, string> = { income: text('Gelir','Income'), expense: text('Gider','Expense') };
  const frequencyLabels: Record<FinanceRecurringFrequency, string> = { weekly: text('Haftalık','Weekly'), monthly: text('Aylık','Monthly'), quarterly: text('Üç aylık','Quarterly'), yearly: text('Yıllık','Yearly') };
  const recurringStatusLabels: Record<FinanceRecurringStatus, string> = { active: text('Aktif','Active'), paused: text('Duraklatıldı','Paused'), ended: text('Sona erdi','Ended') };
  const goalKindLabels: Record<FinanceGoalKind, string> = {
    savings: text('Birikim','Savings'), debt_reduction: text('Borç azaltma','Debt reduction'), investment: text('Yatırım','Investment'), purchase: text('Satın alma','Purchase'),
    emergency_fund: text('Acil durum fonu','Emergency fund'), other: text('Diğer','Other')
  };
  const assetClassLabels: Record<FinanceAssetClass, string> = {
    cash: text('Nakit','Cash'), deposit: text('Mevduat','Deposit'), precious_metal_fx: text('Altın / döviz','Precious metals / FX'), investment: text('Yatırım','Investment'),
    pension: text('Bireysel emeklilik','Private pension'), real_estate: text('Gayrimenkul','Real estate'), vehicle: text('Araç','Vehicle')
  };
  const privacyLabels: Record<RecordPrivacy, string> = { private: text('Özel','Private'), selected_members: text('Seçili üyeler','Selected members'), family: text('Aile','Family') };
  const upcomingPaymentSourceLabels:Record<FinanceUpcomingPaymentSource,string> = {
    payment_card:text('Ödeme kartı','Payment card'),loan:text('Kredi','Loan'),finance_record:text('Finans kaydı','Finance record'),
    recurring_rule:text('Yinelenen işlem','Recurring transaction'),planned_cash_flow:text('Planlanan nakit akışı','Planned cash flow')
  };
  const money = (value: number, currency: string): string => formatMoney(value, currency, locale);
  const date = (value: string): string => formatDate(value, locale);
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
      setMessage(`${modeLabels[mode]} ${text('eklemeli finans defterine kaydedildi.','was saved to the append-only finance ledger.')}`);
      if (mode === 'category' || mode === 'goal' || mode === 'asset') setName('');
      if (mode !== 'category') setDescription('');
      setNote('');
    } catch (error) {
      setMessageTone('danger');
      setMessage(toUserFacingErrorMessage(error,text('Finans planlama kaydı eklenemedi.','The finance planning record could not be added.')));
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
      <SectionHeader eyebrow={text('Finans planlama ve portföy','Financial planning and portfolio')} title={text('Bütçe, hedef, portföy ve net değer merkezi','Budget, goals, portfolio, and net worth center')}/>
      <div className="notes-card">
        <strong>{text('Her para birimi ayrı hesaplanır; yapay kur dönüşümü yapılmaz.','Each currency is calculated separately; no artificial exchange-rate conversion is performed.')}</strong>
        <small>{text('Veri kaynağı manuel · Banka eşitlemesi yapılmadı · Dış fiyat doğrulaması yapılmadı · Ödeme icrası yapılmadı','Data source: manual · Bank synchronization: not performed · External price verification: not performed · Payment execution: not performed')}</small>
      </div>
      <label>{text('Analiz kapsamı','Analysis scope')}<select value={scope} onChange={(event) => setScope(event.target.value)}>
        <option value="family">{text('Tüm aile','Whole family')}</option>
        {people.map((person) => <option key={person.id} value={person.id}>{person.displayName}</option>)}
      </select></label>
      <div className="workspace-grid">
        {(activeSummary?.currencySummaries ?? []).map((summary) => <div className="context-stat" key={summary.currency}>
          <strong>{summary.currency} · {text('Net değer','Net worth')} {money(summary.netWorth, summary.currency)}</strong>
          <span>{text('Varlık','Assets')} {money(summary.assetValue, summary.currency)} · {text('Borç','Liabilities')} {money(summary.liabilityValue, summary.currency)}</span>
          <small>{text('Borç oranı','Debt ratio')} {summary.debtRatioBasisPoints === undefined ? text('hesaplanamadı','not calculated') : `%${(summary.debtRatioBasisPoints / 100).toLocaleString(locale, { maximumFractionDigits: 2 })}`} · {text('Gerçekleşen gelir','Realized income')} {money(summary.realizedIncome, summary.currency)} · {text('gider','expense')} {money(summary.realizedExpense, summary.currency)}</small>
        </div>)}
      </div>
      {(activeSummary?.currencySummaries.length ?? 0) === 0 && <EmptyState title={text('Bu kapsamda finans özeti yok','No finance summary in this scope')} body={text('Kategori, nakit akışı veya portföy varlığı eklediğinizde para birimi bazlı özet oluşur.','A currency-based summary is created when you add a category, cash flow, or portfolio asset.')}/>}
    </Surface>

    <FinanceImportPanel people={people} workspace={workspace} onWorkspaceChange={onWorkspaceChange}/>

    <Surface className="workspace-form">
      <SectionHeader eyebrow={text('Append-only finans defteri','Append-only finance ledger')} title={text('Planlama kaydı ekle','Add planning record')}/>
      <label>{text('İşlem türü','Operation type')}<select value={mode} onChange={(event) => setMode(event.target.value as FinancePlanningItemType)}>
        {Object.entries(modeLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
      </select></label>
      {requiresOwner && <>
        <label>{text('Kayıt sahibi','Record owner')}<select value={ownerPersonId} onChange={(event) => setOwnerPersonId(event.target.value)}>
          <option value="">{text('Seçin','Select')}</option>{people.map((person) => <option key={person.id} value={person.id}>{person.displayName}</option>)}
        </select></label>
        <label>{text('Gizlilik','Privacy')}<select value={privacy} onChange={(event) => setPrivacy(event.target.value as RecordPrivacy)}>
          {Object.entries(privacyLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select></label>
      </>}
      {(mode === 'category' || mode === 'goal' || mode === 'asset') && <label>{mode === 'goal' ? text('Hedef başlığı','Goal title') : mode === 'asset' ? text('Varlık adı','Asset name') : text('Kategori adı','Category name')}<input maxLength={120} value={name} onChange={(event) => setName(event.target.value)}/></label>}
      {mode === 'category' && <label>{text('Kategori türü','Category type')}<select value={categoryKind} onChange={(event) => setCategoryKind(event.target.value as FinanceCategoryKind)}>{Object.entries(categoryLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>}
      {requiresCategory && <label>{text('Kategori','Category')}<select value={categoryId} onChange={(event) => setCategoryId(event.target.value)}><option value="">{text('Seçin','Select')}</option>{workspace?.categories.map((category) => <option key={category.id} value={category.id}>{category.name} · {categoryLabels[category.kind]}</option>)}</select></label>}
      {(mode === 'cash_flow' || mode === 'budget' || mode === 'recurring_rule' || mode === 'goal_progress') && <label>{text('Tutar','Amount')}<input type="number" min="0" step="0.01" value={amount} onChange={(event) => setAmount(event.target.value)}/></label>}
      {(mode === 'cash_flow' || mode === 'budget' || mode === 'recurring_rule' || mode === 'goal' || mode === 'asset') && <label>{text('Para birimi','Currency')}<input maxLength={3} value={currency} onChange={(event) => setCurrency(event.target.value.toLocaleUpperCase(locale))}/></label>}
      {mode === 'cash_flow' && <label>{text('Durum','State')}<select value={cashStatus} onChange={(event) => setCashStatus(event.target.value as 'planned' | 'realized')}><option value="planned">{text('Planlandı','Planned')}</option><option value="realized">{text('Gerçekleşti','Realized')}</option></select></label>}
      {mode === 'budget' && <label>{text('Bütçe dönemi','Budget period')}<input type="month" value={periodMonth} onChange={(event) => setPeriodMonth(event.target.value)}/></label>}
      {mode === 'recurring_rule' && <>
        <label>{text('Sıklık','Frequency')}<select value={frequency} onChange={(event) => setFrequency(event.target.value as FinanceRecurringFrequency)}>{Object.entries(frequencyLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
        <label>{text('Tekrar aralığı','Recurrence interval')}<input type="number" min="1" max="120" step="1" value={intervalCount} onChange={(event) => setIntervalCount(event.target.value)}/></label>
        <label>{text('Sonraki işlem','Next transaction')}<input type="datetime-local" value={nextOccurrenceAt} onChange={(event) => setNextOccurrenceAt(event.target.value)}/></label>
        <label>{text('Bitiş (isteğe bağlı)','End (optional)')}<input type="datetime-local" value={endsAt} onChange={(event) => setEndsAt(event.target.value)}/></label>
      </>}
      {mode === 'recurring_state' && <>
        <label>{text('Yinelenen işlem','Recurring transaction')}<select value={recurringRuleId} onChange={(event) => setRecurringRuleId(event.target.value)}><option value="">{text('Seçin','Select')}</option>{workspace?.recurringRules.map((rule) => <option key={rule.id} value={rule.id}>{rule.description ?? categoryLabels[rule.direction]} · {money(rule.amount, rule.currency)}</option>)}</select></label>
        <label>{text('Yeni durum','New state')}<select value={recurringStatus} onChange={(event) => setRecurringStatus(event.target.value as FinanceRecurringStatus)}>{Object.entries(recurringStatusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
      </>}
      {mode === 'goal' && <>
        <label>{text('Hedef türü','Goal type')}<select value={goalKind} onChange={(event) => setGoalKind(event.target.value as FinanceGoalKind)}>{Object.entries(goalKindLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
        <label>{text('Hedef tutar','Target amount')}<input type="number" min="0.01" step="0.01" value={targetAmount} onChange={(event) => setTargetAmount(event.target.value)}/></label>
        <label>{text('Başlangıç tutarı','Initial amount')}<input type="number" min="0" step="0.01" value={initialAmount} onChange={(event) => setInitialAmount(event.target.value)}/></label>
        <label>{text('Hedef tarihi','Target date')}<input type="datetime-local" value={dueAt} onChange={(event) => setDueAt(event.target.value)}/></label>
      </>}
      {mode === 'goal_progress' && <label>{text('Hedef','Goal')}<select value={goalId} onChange={(event) => setGoalId(event.target.value)}><option value="">{text('Seçin','Select')}</option>{workspace?.goals.map((goal) => <option key={goal.id} value={goal.id}>{goal.title} · {money(goal.currentAmount, goal.currency)} / {money(goal.targetAmount, goal.currency)}</option>)}</select></label>}
      {mode === 'asset' && <label>{text('Varlık sınıfı','Asset class')}<select value={assetClass} onChange={(event) => setAssetClass(event.target.value as FinanceAssetClass)}>{Object.entries(assetClassLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>}
      {mode === 'asset_valuation' && <label>{text('Portföy varlığı','Portfolio asset')}<select value={assetId} onChange={(event) => setAssetId(event.target.value)}><option value="">{text('Seçin','Select')}</option>{workspace?.portfolioAssets.map((asset) => <option key={asset.id} value={asset.id}>{asset.name} · {assetClassLabels[asset.assetClass]}</option>)}</select></label>}
      {(mode === 'asset' || mode === 'asset_valuation') && <>
        <label>{text('Miktar','Quantity')}<input type="number" min="0.000001" step="any" value={quantity} onChange={(event) => setQuantity(event.target.value)}/></label>
        <label>{text('Birim değer','Unit value')}<input type="number" min="0" step="any" value={unitValue} onChange={(event) => setUnitValue(event.target.value)}/></label>
        <div className="notes-card"><strong>{text('Hesaplanan piyasa değeri:','Calculated market value:')} {(Number(quantity || '0') * Number(unitValue || '0')).toLocaleString(locale, { maximumFractionDigits: 2 })} {mode === 'asset' ? currency : workspace?.portfolioAssets.find((asset) => asset.id === assetId)?.currency ?? ''}</strong><small>{text('Birim değer kullanıcı beyanıdır; dış piyasa fiyatı alınmaz.','The unit value is user-provided; no external market price is retrieved.')}</small></div>
      </>}
      {(mode === 'cash_flow' || mode === 'recurring_rule') && <label>{text('Açıklama','Description')}<input maxLength={240} value={description} onChange={(event) => setDescription(event.target.value)}/></label>}
      {(mode === 'goal_progress' || mode === 'asset' || mode === 'asset_valuation') && <label>{text('Not','Note')}<input maxLength={500} value={note} onChange={(event) => setNote(event.target.value)}/></label>}
      {(mode === 'cash_flow' || mode === 'recurring_rule' || mode === 'recurring_state' || mode === 'goal_progress' || mode === 'asset' || mode === 'asset_valuation') && <label>{mode === 'recurring_rule' ? text('Başlangıç','Start') : mode === 'asset' || mode === 'asset_valuation' ? text('Değerleme zamanı','Valuation time') : text('Kayıt zamanı','Record time')}<input type="datetime-local" value={occurredAt} onChange={(event) => setOccurredAt(event.target.value)}/></label>}
      <Button tone="primary" disabled={!canSubmit} onClick={() => void submit()}>{language === 'tr' ? `${modeLabels[mode]} kaydet` : `Save ${modeLabels[mode].toLocaleLowerCase(locale)}`}</Button>
      {message && <StatusMessage tone={messageTone}>{message}</StatusMessage>}
    </Surface>

    <Surface className="workspace-summary">
      <SectionHeader eyebrow={text('Bütçe gerçekleşme analizi','Budget realization analysis')} title={`${visibleBudgetVariances.length} ${text('kategori dönemi','category periods')}`}/>
      {visibleBudgetVariances.length === 0 ? <EmptyState title={text('Bütçe farkı yok','No budget variance')} body={text('Aynı kategori, ay ve para biriminde bütçe ile gerçekleşen akış bulunduğunda fark hesaplanır.','Variance is calculated when a budget and realized flow exist for the same category, month, and currency.')}/> : visibleBudgetVariances.map((item) => <div className="context-stat" key={item.budgetRevisionId}>
        <strong>{item.categoryName} · {item.periodMonth}</strong>
        <span>{text('Plan','Plan')} {money(item.plannedAmount, item.currency)} · {text('Gerçekleşen','Realized')} {money(item.realizedAmount, item.currency)}</span>
        <small>{text('Fark','Variance')} {money(item.varianceAmount, item.currency)} · {item.overBudget ? text('Bütçe aşıldı','Over budget') : item.belowIncomeTarget ? text('Gelir hedefinin altında','Below income target') : text('Plan içinde','Within plan')}</small>
      </div>)}
    </Surface>

    <Surface className="workspace-summary">
      <SectionHeader eyebrow={text('Yaklaşan ödemeler','Upcoming payments')} title={`${visibleUpcoming.length} ${text('kayıt','records')}`}/>
      {visibleUpcoming.length === 0 ? <EmptyState title={text('Yaklaşan ödeme yok','No upcoming payments')} body={text('Kart, kredi, borç, yinelenen gider veya planlı nakit akışı vadeleri burada birleşir.','Due dates for cards, loans, debts, recurring expenses, and planned cash flows are combined here.')}/> : visibleUpcoming.slice(0, 20).map((item) => <div className="context-stat" key={`${item.source}-${item.id}`}>
        <strong>{item.title} · {money(item.amount, item.currency)}</strong>
        <span>{date(item.dueAt)} · {upcomingPaymentSourceLabels[item.source]}</span>
        <small>{text('Ödeme icrası yapılmadı; yalnız takip görünümüdür.','No payment was executed; this is a tracking view only.')}</small>
      </div>)}
    </Surface>

    <Surface className="workspace-summary">
      <SectionHeader eyebrow={text('Kategoriler ve nakit akışı','Categories and cash flow')} title={`${workspace?.categories.length ?? 0} ${text('kategori','categories')} · ${workspace?.cashFlowEntries.length ?? 0} ${text('hareket','entries')}`}/>
      {workspace?.categories.map((category) => <div className="context-stat" key={category.id}><strong>{category.name} · {categoryLabels[category.kind]}</strong><span>{workspace.cashFlowEntries.filter((entry) => entry.categoryId === category.id).length} {text('nakit akışı','cash flows')} · {people.find((person) => person.id === category.ownerPersonId)?.displayName ?? category.ownerPersonId}</span></div>)}
    </Surface>

    <Surface className="workspace-summary">
      <SectionHeader eyebrow={text('Yinelenen işlemler','Recurring transactions')} title={`${workspace?.recurringRules.length ?? 0} ${text('kural','rules')}`}/>
      {(workspace?.recurringRules.length ?? 0) === 0 ? <EmptyState title={text('Yinelenen işlem yok','No recurring transactions')} body={text('Düzenli gelir ve giderleri kategoriye bağlı olarak tanımlayın.','Define regular income and expenses linked to a category.')}/> : workspace?.recurringRules.map((rule) => <div className="context-stat" key={rule.id}><strong>{rule.description ?? categoryLabels[rule.direction]} · {money(rule.amount, rule.currency)}</strong><span>{frequencyLabels[rule.frequency]} / {rule.intervalCount} · {recurringStatusLabels[rule.currentStatus]} · {text('sonraki','next')} {date(rule.nextOccurrenceAt)}</span></div>)}
    </Surface>

    <Surface className="workspace-summary">
      <SectionHeader eyebrow={text('Finansal hedefler','Financial goals')} title={`${workspace?.goals.length ?? 0} ${text('hedef','goals')}`}/>
      {(workspace?.goals.length ?? 0) === 0 ? <EmptyState title={text('Finansal hedef yok','No financial goals')} body={text('Birikim, borç azaltma, yatırım veya satın alma hedefi ekleyin.','Add a savings, debt reduction, investment, or purchase goal.')}/> : workspace?.goals.map((goal) => <div className="context-stat" key={goal.id}><strong>{goal.title} · %{(goal.completionBasisPoints / 100).toLocaleString(locale, { maximumFractionDigits: 2 })}</strong><span>{money(goal.currentAmount, goal.currency)} / {money(goal.targetAmount, goal.currency)} · {goalKindLabels[goal.kind]}</span><small>{goal.achieved ? text('Hedefe ulaşıldı','Goal achieved') : goal.dueAt ? `${text('Hedef tarihi','Target date')} ${date(goal.dueAt)}` : text('Hedef tarihi yok','No target date')} · {goal.progressHistory.length} {text('ilerleme kaydı','progress records')}</small></div>)}
    </Surface>

    <Surface className="workspace-summary">
      <SectionHeader eyebrow={text('Portföy görünümü','Portfolio view')} title={`${workspace?.portfolioAssets.length ?? 0} ${text('varlık','assets')}`}/>
      {(workspace?.portfolioAssets.length ?? 0) === 0 ? <EmptyState title={text('Portföy varlığı yok','No portfolio assets')} body={text('Nakit, mevduat, altın/döviz, yatırım, emeklilik, gayrimenkul veya araç ekleyin.','Add cash, deposits, precious metals or FX, investments, pensions, real estate, or vehicles.')}/> : workspace?.portfolioAssets.map((asset) => <div className="context-stat" key={asset.id}><strong>{asset.name} · {money(asset.currentMarketValue, asset.currency)}</strong><span>{assetClassLabels[asset.assetClass]} · {asset.currentQuantity.toLocaleString(locale)} × {money(asset.currentUnitValue, asset.currency)}</span><small>{text('Değerleme','Valuation')} {date(asset.currentValuedAt)} · {asset.valuationHistory.length} {text('ek değerleme · dış fiyat doğrulaması yapılmadı','additional valuations · external price verification not performed')}</small></div>)}
    </Surface>
  </>;
}

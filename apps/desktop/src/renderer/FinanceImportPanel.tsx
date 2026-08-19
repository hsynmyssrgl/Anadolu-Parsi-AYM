import { useMemo, useState } from 'react';
import type {
  CommitFinanceImportPreviewInput,
  FamilyMemberView,
  FinanceImportAmountMode,
  FinanceImportPreviewView,
  FinancePlanningWorkspaceView,
  RecordPrivacy
} from '@ppt/domain';
import { Button, EmptyState, SectionHeader, StatusMessage, Surface } from './ui';
import { selectUiCopy, useLocalization } from './localization';

interface FinanceImportPanelProps {
  readonly people: readonly FamilyMemberView[];
  readonly workspace: FinancePlanningWorkspaceView | undefined;
  readonly onWorkspaceChange: (workspace: FinancePlanningWorkspaceView) => void;
}

const privacyLabels: Record<RecordPrivacy, string> = {
  private: 'Özel', selected_members: 'Seçili üyeler', family: 'Aile'
};

const findHeader = (headers: readonly string[], candidates: readonly string[]): string => headers.find((header) => {
  const normalized = header.toLocaleLowerCase('tr-TR');
  return candidates.some((candidate) => normalized.includes(candidate));
}) ?? '';

export function FinanceImportPanel({ people, workspace, onWorkspaceChange }: FinanceImportPanelProps) {
  const {language,locale}=useLocalization();const text=(turkish:string,english:string)=>selectUiCopy(language,turkish,english);
  const formatMoney=(amount:number,currency:string):string=>`${amount.toLocaleString(locale,{maximumFractionDigits:2})} ${currency}`;
  const privacyLabel=(value:RecordPrivacy)=>language==='tr'?privacyLabels[value]:({private:'Private',selected_members:'Selected members',family:'Family'} as const)[value];
  const [preview, setPreview] = useState<FinanceImportPreviewView>();
  const [ownerPersonId, setOwnerPersonId] = useState(people[0]?.id ?? '');
  const [privacy, setPrivacy] = useState<RecordPrivacy>('private');
  const [dateColumn, setDateColumn] = useState('');
  const [descriptionColumn, setDescriptionColumn] = useState('');
  const [amountColumn, setAmountColumn] = useState('');
  const [debitColumn, setDebitColumn] = useState('');
  const [creditColumn, setCreditColumn] = useState('');
  const [directionColumn, setDirectionColumn] = useState('');
  const [currencyColumn, setCurrencyColumn] = useState('');
  const [externalIdColumn, setExternalIdColumn] = useState('');
  const [amountMode, setAmountMode] = useState<FinanceImportAmountMode>('signed');
  const [defaultCurrency, setDefaultCurrency] = useState('TRY');
  const [incomeCategoryId, setIncomeCategoryId] = useState('');
  const [expenseCategoryId, setExpenseCategoryId] = useState('');
  const [duplicateStrategy, setDuplicateStrategy] = useState<'skip'|'reject'>('skip');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [messageTone, setMessageTone] = useState<'success'|'danger'>('success');

  const categories = useMemo(() => workspace?.categories.filter((category) =>
    category.ownerPersonId === ownerPersonId && category.privacy === privacy) ?? [], [ownerPersonId, privacy, workspace]);
  const incomeCategories = categories.filter((category) => category.kind === 'income');
  const expenseCategories = categories.filter((category) => category.kind === 'expense');

  const installPreview = (next: FinanceImportPreviewView): void => {
    setPreview(next);
    setDateColumn(findHeader(next.headers, ['date','tarih','dtposted']));
    setDescriptionColumn(findHeader(next.headers, ['description','açıklama','aciklama','memo','name']));
    setAmountColumn(findHeader(next.headers, ['amount','tutar','trnamt']));
    const debit = findHeader(next.headers, ['debit','borç','borc']);
    const credit = findHeader(next.headers, ['credit','alacak']);
    setDebitColumn(debit);
    setCreditColumn(credit);
    setDirectionColumn(findHeader(next.headers, ['direction','yön','yon','tür','tur']));
    setCurrencyColumn(findHeader(next.headers, ['currency','para birimi','curdef']));
    setExternalIdColumn(findHeader(next.headers, ['external_id','fitid','referans','reference']));
    setAmountMode(debit || credit ? 'debit_credit_columns' : 'signed');
    setMessageTone('success');
    setMessage(`${next.totalRows} ${text('satır süreli önizlemeye alındı; eşleme için örnek hücreler gösterilir, dosya yolu aktarılmaz ve ayrıştırılmış satırlar süre sonunda silinir.','rows were loaded into a time-bound preview; sample cells are shown for mapping, the file path is not exposed and parsed rows are deleted when the preview expires.')}`);
  };

  const selectFile = async (): Promise<void> => {
    try {
      setBusy(true); setMessage('');
      const result = await window.pardus?.selectFinanceImportFile();
      if (result?.preview) installPreview(result.preview);
    } catch (error) {
      setMessageTone('danger');
      setMessage(error instanceof Error ? error.message : text('Finans dosyası önizlenemedi.','The finance file could not be previewed.'));
    } finally { setBusy(false); }
  };

  const startSandbox = async (): Promise<void> => {
    try {
      setBusy(true); setMessage('');
      const result = await window.pardus?.previewOpenBankingSandbox();
      if (result) installPreview(result);
    } catch (error) {
      setMessageTone('danger');
      setMessage(error instanceof Error ? error.message : text('OHVPS sandbox önizlemesi oluşturulamadı.','The OHVPS sandbox preview could not be created.'));
    } finally { setBusy(false); }
  };

  const commit = async (): Promise<void> => {
    if (!preview || !window.pardus) return;
    try {
      setBusy(true); setMessage('');
      const mapping: CommitFinanceImportPreviewInput['mapping'] = {
        dateColumn,
        amountMode,
        ...(descriptionColumn ? { descriptionColumn } : {}),
        ...(amountColumn ? { amountColumn } : {}),
        ...(debitColumn ? { debitColumn } : {}),
        ...(creditColumn ? { creditColumn } : {}),
        ...(directionColumn ? { directionColumn } : {}),
        ...(currencyColumn ? { currencyColumn } : {}),
        ...(externalIdColumn ? { externalIdColumn } : {})
      };
      const next = await window.pardus.commitFinanceImportPreview({
        previewId: preview.previewId,
        ownerPersonId,
        privacy,
        mapping,
        defaultCurrency,
        ...(incomeCategoryId ? { incomeCategoryId } : {}),
        ...(expenseCategoryId ? { expenseCategoryId } : {}),
        duplicateStrategy
      });
      onWorkspaceChange(next);
      const batch = next.importBatches[0];
      setPreview(undefined);
      setMessageTone('success');
      setMessage(batch
        ? `${batch.importedRows} ${text('hareket kaydedildi;','transactions saved;')} ${batch.duplicateRows} ${text('tekrar','duplicates')} ${duplicateStrategy === 'skip' ? text('atlandı','skipped') : text('bulundu','found')}.`
        : text('Finans içe aktarma paketi kaydedildi.','The finance import package was saved.'));
    } catch (error) {
      setMessageTone('danger');
      setMessage(error instanceof Error ? error.message : text('Finans hareketleri içe aktarılamadı.','Finance transactions could not be imported.'));
    } finally { setBusy(false); }
  };

  const headerOptions = preview?.headers ?? [];
  const optionalHeader = (value: string, setter: (next: string) => void, label: string) => <label>{label}<select value={value} onChange={(event) => setter(event.target.value)}><option value="">{text('Kullanma','Do not use')}</option>{headerOptions.map((header) => <option value={header} key={header}>{header}</option>)}</select></label>;
  const commitReady = Boolean(preview && ownerPersonId && dateColumn && /^[A-Z]{3}$/u.test(defaultCurrency)
    && (amountMode === 'debit_credit_columns' ? debitColumn || creditColumn : amountColumn)
    && (amountMode !== 'absolute_with_direction' || directionColumn)
    && (incomeCategoryId || expenseCategoryId));

  return <>
    <Surface className="span-2 workspace-summary">
      <SectionHeader eyebrow="B4-13 · B4-14" title={text('Kontrollü hareket aktarımı ve OHVPS adapter sınırı','Controlled transaction import and OHVPS adapter boundary')}/>
      <div className="notes-card">
        <strong>{text('Canlı banka bağlantısı yok; kimlik bilgisi, token veya harici onay toplanmaz.','There is no live bank connection; credentials, tokens and external authorization are not collected.')}</strong>
        <small>{text('OHVPS adapter: yerel sözleşme · Sandbox: sentetik veri · Manuel fallback: UTF-8 CSV/TSV/OFX/QFX ve XLSX · Ağ erişimi yapılmadı','OHVPS adapter: local contract · Sandbox: synthetic data · Manual fallback: UTF-8 CSV/TSV/OFX/QFX and XLSX · Network access was not used')}</small>
      </div>
      <div className="button-row">
        <Button tone="primary" disabled={busy} onClick={() => void selectFile()}>{text('Dosya seç ve önizle','Select file and preview')}</Button>
        <Button disabled={busy} onClick={() => void startSandbox()}>{text('Sentetik OHVPS sandbox','Synthetic OHVPS sandbox')}</Button>
      </div>
      {message && <StatusMessage tone={messageTone}>{message}</StatusMessage>}
    </Surface>

    {preview && <Surface className="span-2 workspace-summary">
      <SectionHeader eyebrow={`${preview.sourceFormat.toUpperCase()} · ${preview.totalRows} ${text('satır','rows')}`} title={preview.fileName}/>
      <div className="metric-row">
        <span>SHA-256 <strong>{preview.fileSha256.slice(0, 16)}…</strong></span>
        <span>{text('Ham dosya baytları','Raw file bytes')} <strong>{preview.rawFileRetained ? text('saklandı','retained') : text('saklanmadı','not retained')}</strong></span>
        <span>{text('Ayrıştırılmış satırlar','Parsed rows')} <strong>{preview.parsedRowsRetainedUntilExpiry ? text('süre sonuna kadar bellekte','in memory until expiry') : text('saklanmıyor','not retained')}</strong></span>
        <span>{text('Örnek hücreler','Sample cells')} <strong>{preview.sampleCellValuesExposed ? text('eşleme için gösteriliyor','shown for mapping') : text('gizli','hidden')}</strong></span>
        <span>{text('Dosya yolu','File path')} <strong>{preview.filePathExposed ? text('açık','exposed') : text('gizli','hidden')}</strong></span>
        <span>{text('Önizleme sonu','Preview expires')} <strong>{new Date(preview.expiresAt).toLocaleTimeString(locale)}</strong></span>
      </div>
      {preview.warnings.map((warning) => <small key={warning}>{warning}</small>)}
      <div className="form-grid">
        <label>{text('Kayıt sahibi','Record owner')}<select value={ownerPersonId} onChange={(event) => { setOwnerPersonId(event.target.value); setIncomeCategoryId(''); setExpenseCategoryId(''); }}><option value="">{text('Seçin','Select')}</option>{people.map((person) => <option value={person.id} key={person.id}>{person.displayName}</option>)}</select></label>
        <label>{text('Gizlilik','Privacy')}<select value={privacy} onChange={(event) => { setPrivacy(event.target.value as RecordPrivacy); setIncomeCategoryId(''); setExpenseCategoryId(''); }}>{Object.keys(privacyLabels).map(value => <option value={value} key={value}>{privacyLabel(value as RecordPrivacy)}</option>)}</select></label>
        <label>{text('Tarih sütunu','Date column')}<select value={dateColumn} onChange={(event) => setDateColumn(event.target.value)}><option value="">{text('Seçin','Select')}</option>{headerOptions.map((header) => <option value={header} key={header}>{header}</option>)}</select></label>
        <label>{text('Tutar modeli','Amount model')}<select value={amountMode} onChange={(event) => setAmountMode(event.target.value as FinanceImportAmountMode)}><option value="signed">{text('İşaretli tutar (+ gelir / − gider)','Signed amount (+ income / − expense)')}</option><option value="absolute_with_direction">{text('Mutlak tutar + yön sütunu','Absolute amount + direction column')}</option><option value="debit_credit_columns">{text('Ayrı borç / alacak sütunları','Separate debit / credit columns')}</option></select></label>
        {amountMode !== 'debit_credit_columns' && optionalHeader(amountColumn, setAmountColumn, text('Tutar sütunu','Amount column'))}
        {amountMode === 'debit_credit_columns' && <>{optionalHeader(debitColumn, setDebitColumn, text('Borç / gider sütunu','Debit / expense column'))}{optionalHeader(creditColumn, setCreditColumn, text('Alacak / gelir sütunu','Credit / income column'))}</>}
        {amountMode === 'absolute_with_direction' && optionalHeader(directionColumn, setDirectionColumn, text('Gelir / gider yönü','Income / expense direction'))}
        {optionalHeader(descriptionColumn, setDescriptionColumn, text('Açıklama sütunu','Description column'))}
        {optionalHeader(currencyColumn, setCurrencyColumn, text('Para birimi sütunu','Currency column'))}
        {optionalHeader(externalIdColumn, setExternalIdColumn, text('Harici hareket kimliği','External transaction ID'))}
        <label>{text('Varsayılan para birimi','Default currency')}<input maxLength={3} value={defaultCurrency} onChange={(event) => setDefaultCurrency(event.target.value.toUpperCase())}/></label>
        <label>{text('Gelir kategorisi','Income category')}<select value={incomeCategoryId} onChange={(event) => setIncomeCategoryId(event.target.value)}><option value="">{text('Gelir yok / seçilmedi','No income / not selected')}</option>{incomeCategories.map((category) => <option value={category.id} key={category.id}>{category.name}</option>)}</select></label>
        <label>{text('Gider kategorisi','Expense category')}<select value={expenseCategoryId} onChange={(event) => setExpenseCategoryId(event.target.value)}><option value="">{text('Gider yok / seçilmedi','No expense / not selected')}</option>{expenseCategories.map((category) => <option value={category.id} key={category.id}>{category.name}</option>)}</select></label>
        <label>{text('Tekrar politikası','Duplicate policy')}<select value={duplicateStrategy} onChange={(event) => setDuplicateStrategy(event.target.value as 'skip'|'reject')}><option value="skip">{text('Tekrarları atla','Skip duplicates')}</option><option value="reject">{text('Tekrarda tüm paketi reddet','Reject entire package on duplicate')}</option></select></label>
      </div>
      {categories.length === 0 && <StatusMessage tone="danger">{text('Seçilen sahip ve gizlilik için gelir/gider kategorisi yok. Önce planlama defterinde kategori oluşturun.','No income/expense category exists for the selected owner and privacy level. Create a category in the planning ledger first.')}</StatusMessage>}
      <div className="context-stat">
        <strong>{text('Örnek satırlar','Sample rows')}</strong>
        {preview.sampleRows.slice(0, 5).map((row) => <small key={row.rowNumber}>#{row.rowNumber} · {row.values.slice(0, 6).join(' · ')}</small>)}
      </div>
      <Button tone="primary" disabled={busy || !commitReady} onClick={() => void commit()}>{text('Eşlemeyi doğrula ve tek işlemde kaydet','Verify mapping and save in one operation')}</Button>
    </Surface>}

    <Surface className="span-2 workspace-summary">
      <SectionHeader eyebrow={text('Append-only içe aktarma defteri','Append-only import ledger')} title={`${workspace?.importBatches.length ?? 0} ${text('paket','packages')} · ${workspace?.importedCashFlowEntries.length ?? 0} ${text('hareket','transactions')}`}/>
      {(workspace?.importBatches.length ?? 0) === 0 ? <EmptyState title={text('İçe aktarma paketi yok','No import package')} body={text('Dosya fallback veya sentetik sandbox sonucu burada bütünlük özetiyle görünür.','A file fallback or synthetic sandbox result appears here with an integrity summary.')}/> : workspace?.importBatches.slice(0, 8).map((batch) => <div className="context-stat" key={batch.id}>
        <strong>{batch.fileName} · {batch.importedRows}/{batch.totalRows} {text('kaydedildi','saved')}</strong>
        <span>{batch.sourceMode === 'sandbox' ? text('Sentetik sandbox','Synthetic sandbox') : batch.sourceFormat.toUpperCase()} · {batch.duplicateRows} {text('tekrar','duplicates')} · {batch.defaultCurrency}</span>
        <small>{new Date(batch.createdAt).toLocaleString(locale)} · {batch.fileSha256.slice(0, 16)}… · {text('ağ/kimlik bilgisi/harici onay yok','no network/credentials/external authorization')}</small>
      </div>)}
      {workspace?.importedCashFlowEntries.slice(0, 6).map((entry) => <div className="list-row" key={entry.id}><div><strong>{entry.description ?? text('Finans hareketi','Finance transaction')}</strong><small>{entry.dataSource === 'sandbox' ? text('sentetik','synthetic') : text('dosya','file')} · {new Date(entry.occurredAt).toLocaleDateString(locale)}</small></div><span>{entry.direction === 'expense' ? '−' : '+'}{formatMoney(entry.amount, entry.currency)}</span></div>)}
    </Surface>
  </>;
}

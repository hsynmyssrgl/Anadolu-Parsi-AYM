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

const formatMoney = (amount: number, currency: string): string =>
  `${amount.toLocaleString('tr-TR', { maximumFractionDigits: 2 })} ${currency}`;

export function FinanceImportPanel({ people, workspace, onWorkspaceChange }: FinanceImportPanelProps) {
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
    setMessage(`${next.totalRows} satır süreli önizlemeye alındı; eşleme için örnek hücreler gösterilir, dosya yolu aktarılmaz ve ayrıştırılmış satırlar süre sonunda silinir.`);
  };

  const selectFile = async (): Promise<void> => {
    try {
      setBusy(true); setMessage('');
      const result = await window.pardus?.selectFinanceImportFile();
      if (result?.preview) installPreview(result.preview);
    } catch (error) {
      setMessageTone('danger');
      setMessage(error instanceof Error ? error.message : 'Finans dosyası önizlenemedi.');
    } finally { setBusy(false); }
  };

  const startSandbox = async (): Promise<void> => {
    try {
      setBusy(true); setMessage('');
      const result = await window.pardus?.previewOpenBankingSandbox();
      if (result) installPreview(result);
    } catch (error) {
      setMessageTone('danger');
      setMessage(error instanceof Error ? error.message : 'OHVPS sandbox önizlemesi oluşturulamadı.');
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
        ? `${batch.importedRows} hareket kaydedildi; ${batch.duplicateRows} tekrar ${duplicateStrategy === 'skip' ? 'atlandı' : 'bulundu'}.`
        : 'Finans içe aktarma paketi kaydedildi.');
    } catch (error) {
      setMessageTone('danger');
      setMessage(error instanceof Error ? error.message : 'Finans hareketleri içe aktarılamadı.');
    } finally { setBusy(false); }
  };

  const headerOptions = preview?.headers ?? [];
  const optionalHeader = (value: string, setter: (next: string) => void, label: string) => <label>{label}<select value={value} onChange={(event) => setter(event.target.value)}><option value="">Kullanma</option>{headerOptions.map((header) => <option value={header} key={header}>{header}</option>)}</select></label>;
  const commitReady = Boolean(preview && ownerPersonId && dateColumn && /^[A-Z]{3}$/u.test(defaultCurrency)
    && (amountMode === 'debit_credit_columns' ? debitColumn || creditColumn : amountColumn)
    && (amountMode !== 'absolute_with_direction' || directionColumn)
    && (incomeCategoryId || expenseCategoryId));

  return <>
    <Surface className="span-2 workspace-summary">
      <SectionHeader eyebrow="B4-13 · B4-14" title="Kontrollü hareket aktarımı ve OHVPS adapter sınırı"/>
      <div className="notes-card">
        <strong>Canlı banka bağlantısı yok; kimlik bilgisi, token veya harici onay toplanmaz.</strong>
        <small>OHVPS adapter: yerel sözleşme · Sandbox: sentetik veri · Manuel fallback: UTF-8 CSV/TSV/OFX/QFX ve XLSX · Ağ erişimi yapılmadı</small>
      </div>
      <div className="button-row">
        <Button tone="primary" disabled={busy} onClick={() => void selectFile()}>Dosya seç ve önizle</Button>
        <Button disabled={busy} onClick={() => void startSandbox()}>Sentetik OHVPS sandbox</Button>
      </div>
      {message && <StatusMessage tone={messageTone}>{message}</StatusMessage>}
    </Surface>

    {preview && <Surface className="span-2 workspace-summary">
      <SectionHeader eyebrow={`${preview.sourceFormat.toUpperCase()} · ${preview.totalRows} satır`} title={preview.fileName}/>
      <div className="metric-row">
        <span>SHA-256 <strong>{preview.fileSha256.slice(0, 16)}…</strong></span>
        <span>Ham dosya baytları <strong>{preview.rawFileRetained ? 'saklandı' : 'saklanmadı'}</strong></span>
        <span>Ayrıştırılmış satırlar <strong>{preview.parsedRowsRetainedUntilExpiry ? 'süre sonuna kadar bellekte' : 'saklanmıyor'}</strong></span>
        <span>Örnek hücreler <strong>{preview.sampleCellValuesExposed ? 'eşleme için gösteriliyor' : 'gizli'}</strong></span>
        <span>Dosya yolu <strong>{preview.filePathExposed ? 'açık' : 'gizli'}</strong></span>
        <span>Önizleme sonu <strong>{new Date(preview.expiresAt).toLocaleTimeString('tr-TR')}</strong></span>
      </div>
      {preview.warnings.map((warning) => <small key={warning}>{warning}</small>)}
      <div className="form-grid">
        <label>Kayıt sahibi<select value={ownerPersonId} onChange={(event) => { setOwnerPersonId(event.target.value); setIncomeCategoryId(''); setExpenseCategoryId(''); }}><option value="">Seçin</option>{people.map((person) => <option value={person.id} key={person.id}>{person.displayName}</option>)}</select></label>
        <label>Gizlilik<select value={privacy} onChange={(event) => { setPrivacy(event.target.value as RecordPrivacy); setIncomeCategoryId(''); setExpenseCategoryId(''); }}>{Object.entries(privacyLabels).map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label>
        <label>Tarih sütunu<select value={dateColumn} onChange={(event) => setDateColumn(event.target.value)}><option value="">Seçin</option>{headerOptions.map((header) => <option value={header} key={header}>{header}</option>)}</select></label>
        <label>Tutar modeli<select value={amountMode} onChange={(event) => setAmountMode(event.target.value as FinanceImportAmountMode)}><option value="signed">İşaretli tutar (+ gelir / − gider)</option><option value="absolute_with_direction">Mutlak tutar + yön sütunu</option><option value="debit_credit_columns">Ayrı borç / alacak sütunları</option></select></label>
        {amountMode !== 'debit_credit_columns' && optionalHeader(amountColumn, setAmountColumn, 'Tutar sütunu')}
        {amountMode === 'debit_credit_columns' && <>{optionalHeader(debitColumn, setDebitColumn, 'Borç / gider sütunu')}{optionalHeader(creditColumn, setCreditColumn, 'Alacak / gelir sütunu')}</>}
        {amountMode === 'absolute_with_direction' && optionalHeader(directionColumn, setDirectionColumn, 'Gelir / gider yönü')}
        {optionalHeader(descriptionColumn, setDescriptionColumn, 'Açıklama sütunu')}
        {optionalHeader(currencyColumn, setCurrencyColumn, 'Para birimi sütunu')}
        {optionalHeader(externalIdColumn, setExternalIdColumn, 'Harici hareket kimliği')}
        <label>Varsayılan para birimi<input maxLength={3} value={defaultCurrency} onChange={(event) => setDefaultCurrency(event.target.value.toUpperCase())}/></label>
        <label>Gelir kategorisi<select value={incomeCategoryId} onChange={(event) => setIncomeCategoryId(event.target.value)}><option value="">Gelir yok / seçilmedi</option>{incomeCategories.map((category) => <option value={category.id} key={category.id}>{category.name}</option>)}</select></label>
        <label>Gider kategorisi<select value={expenseCategoryId} onChange={(event) => setExpenseCategoryId(event.target.value)}><option value="">Gider yok / seçilmedi</option>{expenseCategories.map((category) => <option value={category.id} key={category.id}>{category.name}</option>)}</select></label>
        <label>Tekrar politikası<select value={duplicateStrategy} onChange={(event) => setDuplicateStrategy(event.target.value as 'skip'|'reject')}><option value="skip">Tekrarları atla</option><option value="reject">Tekrarda tüm paketi reddet</option></select></label>
      </div>
      {categories.length === 0 && <StatusMessage tone="danger">Seçilen sahip ve gizlilik için gelir/gider kategorisi yok. Önce planlama defterinde kategori oluşturun.</StatusMessage>}
      <div className="context-stat">
        <strong>Örnek satırlar</strong>
        {preview.sampleRows.slice(0, 5).map((row) => <small key={row.rowNumber}>#{row.rowNumber} · {row.values.slice(0, 6).join(' · ')}</small>)}
      </div>
      <Button tone="primary" disabled={busy || !commitReady} onClick={() => void commit()}>Eşlemeyi doğrula ve tek işlemde kaydet</Button>
    </Surface>}

    <Surface className="span-2 workspace-summary">
      <SectionHeader eyebrow="Append-only içe aktarma defteri" title={`${workspace?.importBatches.length ?? 0} paket · ${workspace?.importedCashFlowEntries.length ?? 0} hareket`}/>
      {(workspace?.importBatches.length ?? 0) === 0 ? <EmptyState title="İçe aktarma paketi yok" body="Dosya fallback veya sentetik sandbox sonucu burada bütünlük özetiyle görünür."/> : workspace?.importBatches.slice(0, 8).map((batch) => <div className="context-stat" key={batch.id}>
        <strong>{batch.fileName} · {batch.importedRows}/{batch.totalRows} kaydedildi</strong>
        <span>{batch.sourceMode === 'sandbox' ? 'Sentetik sandbox' : batch.sourceFormat.toUpperCase()} · {batch.duplicateRows} tekrar · {batch.defaultCurrency}</span>
        <small>{new Date(batch.createdAt).toLocaleString('tr-TR')} · {batch.fileSha256.slice(0, 16)}… · ağ/kimlik bilgisi/harici onay yok</small>
      </div>)}
      {workspace?.importedCashFlowEntries.slice(0, 6).map((entry) => <div className="list-row" key={entry.id}><div><strong>{entry.description ?? 'Finans hareketi'}</strong><small>{entry.dataSource === 'sandbox' ? 'sentetik' : 'dosya'} · {new Date(entry.occurredAt).toLocaleDateString('tr-TR')}</small></div><span>{entry.direction === 'expense' ? '−' : '+'}{formatMoney(entry.amount, entry.currency)}</span></div>)}
    </Surface>
  </>;
}

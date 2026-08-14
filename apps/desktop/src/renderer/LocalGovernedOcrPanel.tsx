import { useEffect, useMemo, useRef, useState } from 'react';
import { AsyncStatePanel } from './form-ux';
import { Button, EmptyState, StatusMessage } from './ui';

type LocalOcrBridge = NonNullable<Window['pardus']>;
type LocalOcrCenter = Awaited<ReturnType<LocalOcrBridge['getLocalGovernedOcrCenter']>>;
type LocalOcrJob = LocalOcrCenter['jobs'][number];
type LocalOcrResult = Awaited<ReturnType<LocalOcrBridge['getLocalGovernedOcrResult']>>;

export interface LocalGovernedOcrArchiveSource {
  readonly id: string;
  readonly title: string;
  readonly originalName: string;
  readonly mimeType: string;
  readonly sizeBytes: number;
}
export interface LocalGovernedOcrPanelProps {
  readonly selectedSource: LocalGovernedOcrArchiveSource | undefined;
}

interface PendingOperation {
  readonly clientOperationId: string;
  readonly expectedRevision: number;
  readonly requestFingerprint: string;
}
type MutationIdentity = Pick<PendingOperation, 'clientOperationId' | 'expectedRevision'>;

const MAX_INPUT_BYTES = 16 * 1_024 * 1_024;
const SUPPORTED_MIME_TYPES = new Set(['image/png', 'image/jpeg']);
const STATUS_LABELS: Readonly<Record<LocalOcrJob['status'], string>> = {
  queued: 'Sırada',
  running: 'Çalışıyor',
  cancel_requested: 'İptal isteniyor',
  completed: 'Tamamlandı',
  failed: 'Başarısız',
  cancelled: 'İptal edildi',
  deleted: 'Yerel sonuç silindi'
};

const FAILURE_LABELS: Readonly<Record<NonNullable<LocalOcrJob['failureCode']>, string>> = {
  source_unavailable: 'Arşiv kaynağı kullanılamıyor.',
  consent_unavailable: 'Etkin hassas veri işleme izni bulunamadı.',
  engine_failed: 'Yerel OCR sağlayıcısı işlemi tamamlayamadı.',
  integrity_mismatch: 'Kaynak veya sonuç bütünlüğü doğrulanamadı.'
};

const newOperationId = (): string => `ocr-${globalThis.crypto.randomUUID()}`;
const errorMessage = (caught: unknown, fallback: string): string => caught instanceof Error ? caught.message : fallback;
const parsedLanguages = (value: string): readonly string[] => [...new Set(value.split(',').map((item) => item.trim()).filter(Boolean))];

export function LocalGovernedOcrPanel({ selectedSource }: LocalGovernedOcrPanelProps) {
  const [center, setCenter] = useState<LocalOcrCenter>();
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [operationError, setOperationError] = useState('');
  const [notice, setNotice] = useState('');
  const [selectedJobId, setSelectedJobId] = useState('');
  const [result, setResult] = useState<LocalOcrResult>();
  const [correctedText, setCorrectedText] = useState('');
  const [languageInput, setLanguageInput] = useState('tr-TR');
  const [busyKey, setBusyKey] = useState('');
  const [networkOnline, setNetworkOnline] = useState(() => globalThis.navigator?.onLine ?? true);
  const pendingOperations = useRef(new Map<string, PendingOperation>());

  const refresh = async (showLoading = true): Promise<boolean> => {
    if (!window.pardus) {
      setLoadError('Yerel OCR masaüstü köprüsü kullanılamıyor.');
      setLoading(false);
      return false;
    }
    if (showLoading) setLoading(true);
    setLoadError('');
    try {
      const next = await window.pardus.getLocalGovernedOcrCenter();
      setCenter(next);
      return true;
    } catch (caught) {
      setLoadError(errorMessage(caught, 'Yerel OCR merkezi yüklenemedi.'));
      return false;
    } finally {
      if (showLoading) setLoading(false);
    }
  };

  useEffect(() => { void refresh(); }, []);
  useEffect(() => {
    const online = () => setNetworkOnline(true);
    const offline = () => setNetworkOnline(false);
    globalThis.addEventListener('online', online);
    globalThis.addEventListener('offline', offline);
    return () => {
      globalThis.removeEventListener('online', online);
      globalThis.removeEventListener('offline', offline);
    };
  }, []);
  useEffect(() => {
    if (!center) return;
    const sourceJob = selectedSource
      ? center.jobs.find((item) => item.source.resourceId === selectedSource.id && item.status !== 'deleted')
      : undefined;
    setSelectedJobId((current) => sourceJob?.id
      ?? (center.jobs.some((item) => item.id === current) ? current : center.jobs.find((item) => item.status !== 'deleted')?.id ?? ''));
  }, [center, selectedSource?.id]);

  const selectedJob = useMemo(
    () => center?.jobs.find((item) => item.id === selectedJobId),
    [center, selectedJobId]
  );
  useEffect(() => {
    setResult(undefined);
    setCorrectedText('');
  }, [selectedJob?.id, selectedJob?.revision]);

  const operationFor = (key: string, expectedRevision: number, requestFingerprint: string): MutationIdentity => {
    const existing = pendingOperations.current.get(key);
    if (existing?.expectedRevision === expectedRevision && existing.requestFingerprint === requestFingerprint) {
      return { clientOperationId: existing.clientOperationId, expectedRevision: existing.expectedRevision };
    }
    const created = { clientOperationId: newOperationId(), expectedRevision, requestFingerprint };
    pendingOperations.current.set(key, created);
    return { clientOperationId: created.clientOperationId, expectedRevision: created.expectedRevision };
  };

  const mutate = async (
    key: string,
    expectedRevision: number,
    action: (operation: MutationIdentity) => Promise<unknown>,
    successMessage: string,
    requestFingerprint = key
  ): Promise<void> => {
    if (busyKey) return;
    const operation = operationFor(key, expectedRevision, requestFingerprint);
    setBusyKey(key);
    setOperationError('');
    setNotice('');
    let committed = false;
    try {
      await action(operation);
      pendingOperations.current.delete(key);
      committed = true;
      setNotice(successMessage);
    } catch (caught) {
      setOperationError(`${errorMessage(caught, 'Yerel OCR işlemi tamamlanamadı.')} Aynı işlem kimliği ve özgün revizyonla yeniden deneyebilirsiniz.`);
    } finally {
      setBusyKey('');
    }
    if (committed) await refresh(false);
  };

  const languages = parsedLanguages(languageInput);
  const languagesValid = languages.length <= 8
    && languages.every((language) => /^[A-Za-z]{2,8}(?:-[A-Za-z0-9]{2,8})?$/u.test(language));
  const sourceSupported = selectedSource !== undefined
    && SUPPORTED_MIME_TYPES.has(selectedSource.mimeType.toLowerCase())
    && selectedSource.sizeBytes > 0 && selectedSource.sizeBytes <= MAX_INPUT_BYTES;

  const create = async (): Promise<void> => {
    if (!window.pardus || !selectedSource || !center || !sourceSupported || !languagesValid) return;
    await mutate(`create:${selectedSource.id}`, 0, (operation) => window.pardus!.createLocalGovernedOcrJob({
      ...operation, sourceResourceId: selectedSource.id, languageHints: languages
    }), 'OCR işi merkezi yetki denetiminden sonra sıraya alındı.', languages.join(','));
  };

  const run = async (): Promise<void> => {
    if (!window.pardus || !selectedJob) return;
    await mutate(`run:${selectedJob.id}`, selectedJob.revision, (operation) => window.pardus!.runLocalGovernedOcrJob({
      ...operation, jobId: selectedJob.id
    }), 'Yerel OCR çalışması tamamlandı.');
  };

  const cancel = async (): Promise<void> => {
    if (!window.pardus || !selectedJob) return;
    await mutate(`cancel:${selectedJob.id}`, selectedJob.revision, (operation) => window.pardus!.cancelLocalGovernedOcrJob({
      ...operation, jobId: selectedJob.id
    }), 'İptal isteği yerel işleyiciye iletildi.');
  };

  const readResult = async (): Promise<void> => {
    if (!window.pardus || !selectedJob || busyKey) return;
    setBusyKey(`read:${selectedJob.id}`);
    setOperationError('');
    try {
      const next = await window.pardus.getLocalGovernedOcrResult({ jobId: selectedJob.id });
      setResult(next);
      setCorrectedText(next.text);
    } catch (caught) {
      setOperationError(errorMessage(caught, 'OCR sonucu açılamadı.'));
    } finally {
      setBusyKey('');
    }
  };

  const correct = async (): Promise<void> => {
    if (!window.pardus || !selectedJob || correctedText.length < 1 || correctedText.length > 250_000) return;
    await mutate(`correct:${selectedJob.id}`, selectedJob.revision, (operation) => window.pardus!.correctLocalGovernedOcrResult({
      ...operation, jobId: selectedJob.id, correctedText
    }), 'Düzeltme yeni bir şifreli yerel sonuç sürümü olarak kaydedildi.', correctedText);
  };

  const rerun = async (): Promise<void> => {
    if (!window.pardus || !selectedJob || !languagesValid) return;
    await mutate(`rerun:${selectedJob.id}`, selectedJob.revision, (operation) => window.pardus!.rerunLocalGovernedOcrJob({
      ...operation, jobId: selectedJob.id, languageHints: languages
    }), 'Önceki türetilmiş sonuç doğrulanarak silindi ve iş yeniden sıraya alındı.', languages.join(','));
  };

  const remove = async (): Promise<void> => {
    if (!window.pardus || !selectedJob || !globalThis.confirm('Yerel OCR sonucu ve iş kaydı silinsin mi? Arşiv kaynağı korunur.')) return;
    await mutate(`delete:${selectedJob.id}`, selectedJob.revision, (operation) => window.pardus!.deleteLocalGovernedOcrJob({
      ...operation, jobId: selectedJob.id, reason: 'Kullanıcı yerel OCR sonucunu Doküman Merkezi üzerinden sildi.'
    }), 'Yerel OCR sonucu silindi; kaynak arşiv belgesi korundu.');
  };

  const setEnabled = async (enabled: boolean): Promise<void> => {
    if (!window.pardus || !center) return;
    await mutate(`settings:${enabled ? 'enable' : 'disable'}`, center.settings.revision,
      (operation) => window.pardus!.setLocalGovernedOcrEnabled({
        ...operation, enabled,
        reason: enabled ? 'Kullanıcı yerel OCR işlemeyi etkinleştirdi.' : 'Kullanıcı yerel OCR işlemeyi devre dışı bıraktı.'
      }), enabled ? 'Yerel OCR işleme etkinleştirildi.' : 'Yerel OCR işleme devre dışı bırakıldı.');
  };

  if (loading && !center) return <AsyncStatePanel state="loading" title="Yerel OCR merkezi yükleniyor" message="İşler ve yerel işleme ayarı okunuyor." />;
  if (loadError && !center) return <AsyncStatePanel state="error" title="Yerel OCR merkezi yüklenemedi" message={loadError} onRetry={async () => { await refresh(); }} />;
  if (!center) return <AsyncStatePanel state="empty" title="Yerel OCR kullanılamıyor" message="Masaüstü yetki sınırı hazır değil." onRetry={async () => { await refresh(); }} />;

  return (
    <section className="panel local-ocr-center" aria-labelledby="local-ocr-center-title" aria-busy={Boolean(busyKey)}>
      <div className="panel-heading">
        <div>
          <span className="eyebrow">Yerel ve yönetilen türetilmiş veri</span>
          <h2 id="local-ocr-center-title">Belge OCR merkezi</h2>
          <p>PNG ve JPEG belgeleri yalnız açık hassas veri işleme izni ve merkezi PEP kararıyla yerel olarak işler.</p>
        </div>
        <Button disabled={Boolean(busyKey)} onClick={() => void setEnabled(!center.settings.enabled)}>
          {center.settings.enabled ? 'İşlemeyi kapat' : 'İşlemeyi aç'}
        </Button>
      </div>

      {!networkOnline && <StatusMessage tone="info">Ağ çevrimdışı görünüyor. Bu yalnız sunum bilgisidir; yerel OCR yetkisini tarayıcı ağ durumu belirlemez.</StatusMessage>}
      {loadError && <StatusMessage tone="warning">İşlem kaydedilmiş olabilir ancak görünüm yenilenemedi: {loadError}</StatusMessage>}
      {operationError && <StatusMessage tone="warning">{operationError}</StatusMessage>}
      {notice && <StatusMessage tone="success">{notice}</StatusMessage>}

      <div className="local-ocr-truth" role="note" aria-label="Yerel OCR doğruluk sınırları">
        <strong>Açık iddia sınırı</strong>
        <span>İşleme ağ ve bulut kullanmaz; kaynak baytları renderer'a verilmez, açık metin repository tablosunda tutulmaz.</span>
        <span>Çalışma ayrı ve kotalı bir child process içindedir; düşük ayrıcalıklı sandbox doğrulanmış değildir.</span>
        <span>PDF rasterizer ve kötü amaçlı yazılım sağlayıcısı yoksa işlem fail-closed reddedilir. Kaynak dosya imhasından sonra türetilmiş sonuç temizliği aynı işlem kimliğiyle yeniden denenebilir; crash sonrası otomatik devam kanıtlanmış değildir.</span>
        <span>Sıradaki veya çalışan iş iptal edilebilir; çalışan işte istek yerel worker'a iletilir ve kalıcı sonuç transactionı Cancel commit'inden sonra tamamlanır. Türetilmiş sonucu silmek kaynak belgeyi silmez.</span>
      </div>

      <div className="local-ocr-create-grid">
        <div>
          <small>Seçili arşiv belgesi</small>
          <strong>{selectedSource?.title ?? 'Belge seçilmedi'}</strong>
          <span>{selectedSource ? `${selectedSource.originalName} · ${selectedSource.mimeType} · ${(selectedSource.sizeBytes / 1_024).toFixed(1)} KB` : 'OCR işi oluşturmak için listeden bir belge seçin.'}</span>
        </div>
        <label>Dil ipuçları
          <input value={languageInput} onChange={(event) => setLanguageInput(event.target.value)} aria-invalid={!languagesValid} placeholder="tr-TR, en-US" />
        </label>
        <Button tone="primary" disabled={Boolean(busyKey) || !center.settings.enabled || !sourceSupported || !languagesValid} onClick={() => void create()}>
          {busyKey.startsWith('create:') ? 'Sıraya alınıyor…' : 'Seçili belge için OCR işi oluştur'}
        </Button>
      </div>
      {selectedSource && !sourceSupported && <small className="form-error">Gerçek yerel sağlayıcı şu anda yalnız 16 MiB veya daha küçük PNG/JPEG kaynaklarını kabul eder; PDF desteklenmez.</small>}

      {center.jobs.length ? (
        <div className="local-ocr-workspace">
          <label>OCR işi
            <select value={selectedJobId} onChange={(event) => setSelectedJobId(event.target.value)}>
              {center.jobs.map((item) => <option key={item.id} value={item.id}>{STATUS_LABELS[item.status]} · {item.source.resourceId}</option>)}
            </select>
          </label>
          {selectedJob && <article className="local-ocr-job-card">
            <div className="panel-heading">
              <div><span className="eyebrow">Revizyon {selectedJob.revision} · Deneme {selectedJob.runAttempt}</span><h3>{STATUS_LABELS[selectedJob.status]}</h3></div>
              <span className={`tag ${selectedJob.status === 'failed' ? 'red' : 'blue'}`}>Yerel · ağ yok · bulut yok</span>
            </div>
            <div className="detail-grid">
              <div><small>Kaynak türü</small><strong>{selectedJob.source.mimeType}</strong></div>
              <div><small>Karakter</small><strong>{selectedJob.resultCharacterCount ?? '—'}</strong></div>
              <div><small>Sayfa</small><strong>{selectedJob.resultPageCount ?? '—'}</strong></div>
              <div><small>Güncelleme</small><strong>{new Date(selectedJob.updatedAt).toLocaleString('tr-TR')}</strong></div>
            </div>
            {selectedJob.failureCode && <StatusMessage tone="warning">{FAILURE_LABELS[selectedJob.failureCode]}</StatusMessage>}
            <div className="button-row">
              <Button tone="primary" disabled={Boolean(busyKey) || selectedJob.status !== 'queued'} onClick={() => void run()}>Yerel OCR'ı çalıştır</Button>
              <Button disabled={Boolean(busyKey) || !['queued', 'running'].includes(selectedJob.status)} onClick={() => void cancel()}>
                {selectedJob.status === 'running' ? 'Çalışan işi iptal et' : 'Sıradaki işi iptal et'}
              </Button>
              <Button disabled={Boolean(busyKey) || !selectedJob.resultAvailable} onClick={() => void readResult()}>Sonucu açıkça görüntüle</Button>
              <Button disabled={Boolean(busyKey) || !['completed', 'failed', 'cancelled'].includes(selectedJob.status)} onClick={() => void rerun()}>Yeniden sıraya al</Button>
              <Button tone="danger" disabled={Boolean(busyKey) || selectedJob.status === 'deleted'} onClick={() => void remove()}>Yerel sonucu sil</Button>
            </div>
            {result && result.jobId === selectedJob.id && <div className="local-ocr-result">
              <div><strong>Şifreli kasadan açılan sonuç</strong><span>{result.corrected ? 'Düzeltilmiş sürüm' : 'Yerel sağlayıcı çıktısı'} · ağ yok · bulut yok</span></div>
              <textarea aria-label="OCR sonucu düzeltme metni" value={correctedText} maxLength={250_000} onChange={(event) => setCorrectedText(event.target.value)} />
              <Button disabled={Boolean(busyKey) || correctedText.length < 1 || correctedText === result.text} onClick={() => void correct()}>Düzeltmeyi yeni sürüm olarak kaydet</Button>
            </div>}
          </article>}
        </div>
      ) : <EmptyState title="OCR işi yok" body="Desteklenen bir arşiv belgesi seçip merkezi yetki denetiminden geçen ilk işi oluşturun." />}
    </section>
  );
}

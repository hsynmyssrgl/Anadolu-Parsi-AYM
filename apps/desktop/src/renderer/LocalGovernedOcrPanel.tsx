import { useEffect, useMemo, useRef, useState } from 'react';
import { AsyncStatePanel } from './form-ux';
import { Button, EmptyState, StatusMessage } from './ui';
import { selectUiCopy, useLocalization } from './localization';
import { toUserFacingErrorMessage } from './user-facing-error';

type LocalOcrBridge = NonNullable<Window['pardus']>;
type LocalOcrCenter = Awaited<ReturnType<LocalOcrBridge['getLocalGovernedOcrCenter']>>;
type LocalOcrJob = LocalOcrCenter['jobs'][number];
type LocalOcrResult = Awaited<ReturnType<LocalOcrBridge['getLocalGovernedOcrResult']>>;
type LocalOcrSearch = Awaited<ReturnType<LocalOcrBridge['searchLocalGovernedOcr']>>;

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
const newOperationId = (): string => `ocr-${globalThis.crypto.randomUUID()}`;
const errorMessage = (caught: unknown, fallback: string): string => toUserFacingErrorMessage(caught, fallback);
const parsedLanguages = (value: string): readonly string[] => [...new Set(value.split(',').map((item) => item.trim()).filter(Boolean))];

export function LocalGovernedOcrPanel({ selectedSource }: LocalGovernedOcrPanelProps) {
  const { language, locale } = useLocalization();
  const text = (turkish: string, english: string): string => selectUiCopy(language, turkish, english);
  const statusLabels: Readonly<Record<LocalOcrJob['status'], string>> = {
    queued: text('Sırada','Queued'), running: text('Çalışıyor','Running'), cancel_requested: text('İptal isteniyor','Cancellation requested'),
    completed: text('Tamamlandı','Completed'), failed: text('Başarısız','Failed'), cancelled: text('İptal edildi','Canceled'), deleted: text('Yerel sonuç silindi','Local result deleted')
  };
  const failureLabels: Readonly<Record<NonNullable<LocalOcrJob['failureCode']>, string>> = {
    source_unavailable: text('Arşiv kaynağı kullanılamıyor.','The archive source is unavailable.'),
    consent_unavailable: text('Etkin hassas veri işleme izni bulunamadı.','No active sensitive-data processing consent was found.'),
    engine_failed: text('Yerel metin tanıma hizmeti işlemi tamamlayamadı.','The local text-recognition service could not complete the operation.'),
    integrity_mismatch: text('Kaynak veya sonuç bütünlüğü doğrulanamadı.','Source or result integrity could not be verified.')
  };
  const [center, setCenter] = useState<LocalOcrCenter>();
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [operationError, setOperationError] = useState('');
  const [notice, setNotice] = useState('');
  const [selectedJobId, setSelectedJobId] = useState('');
  const [result, setResult] = useState<LocalOcrResult>();
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResult, setSearchResult] = useState<LocalOcrSearch>();
  const [correctedText, setCorrectedText] = useState('');
  const [languageInput, setLanguageInput] = useState(locale);
  const [busyKey, setBusyKey] = useState('');
  const [networkOnline, setNetworkOnline] = useState(() => globalThis.navigator?.onLine ?? true);
  const pendingOperations = useRef(new Map<string, PendingOperation>());

  const refresh = async (showLoading = true): Promise<boolean> => {
    if (!window.pardus) {
      setLoadError(text('Yerel metin tanıma bağlantısı kullanılamıyor.','The local text-recognition connection is unavailable.'));
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
      setLoadError(errorMessage(caught, text('Yerel metin tanıma merkezi yüklenemedi.','The local text-recognition center could not be loaded.')));
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
      setOperationError(`${errorMessage(caught, text('Yerel metin tanıma işlemi tamamlanamadı.','The local text-recognition action could not be completed.'))} ${text('Aynı işlemi yeniden deneyebilirsiniz.','You can retry the same action.')}`);
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
    }), text('Metin tanıma işi yetki denetiminden sonra sıraya alındı.','The text-recognition job was queued after authorization.'), languages.join(','));
  };

  const run = async (): Promise<void> => {
    if (!window.pardus || !selectedJob) return;
    await mutate(`run:${selectedJob.id}`, selectedJob.revision, (operation) => window.pardus!.runLocalGovernedOcrJob({
      ...operation, jobId: selectedJob.id
    }), text('Yerel metin tanıma çalışması tamamlandı.','Local text recognition was completed.'));
  };

  const cancel = async (): Promise<void> => {
    if (!window.pardus || !selectedJob) return;
    await mutate(`cancel:${selectedJob.id}`, selectedJob.revision, (operation) => window.pardus!.cancelLocalGovernedOcrJob({
      ...operation, jobId: selectedJob.id
    }), text('İptal isteği yerel işleyiciye iletildi.','The cancellation request was sent to the local worker.'));
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
      setOperationError(errorMessage(caught, text('Metin tanıma sonucu açılamadı.','The text-recognition result could not be opened.')));
    } finally {
      setBusyKey('');
    }
  };

  const search = async (): Promise<void> => {
    if (!window.pardus || busyKey || searchQuery !== searchQuery.trim()
      || searchQuery.length < 2 || searchQuery.length > 80) return;
    setBusyKey('search');
    setOperationError('');
    try {
      setSearchResult(await window.pardus.searchLocalGovernedOcr({ query: searchQuery, limit: 10 }));
    } catch (caught) {
      setSearchResult(undefined);
      setOperationError(errorMessage(caught, text('Şifreli metin tanıma kayıtlarında arama tamamlanamadı.','The encrypted text-recognition records could not be searched.')));
    } finally {
      setBusyKey('');
    }
  };

  const correct = async (): Promise<void> => {
    if (!window.pardus || !selectedJob || correctedText.length < 1 || correctedText.length > 250_000) return;
    await mutate(`correct:${selectedJob.id}`, selectedJob.revision, (operation) => window.pardus!.correctLocalGovernedOcrResult({
      ...operation, jobId: selectedJob.id, correctedText
    }), text('Düzeltme yeni bir şifreli yerel sonuç sürümü olarak kaydedildi.','The correction was saved as a new encrypted local result revision.'), correctedText);
  };

  const rerun = async (): Promise<void> => {
    if (!window.pardus || !selectedJob || !languagesValid) return;
    await mutate(`rerun:${selectedJob.id}`, selectedJob.revision, (operation) => window.pardus!.rerunLocalGovernedOcrJob({
      ...operation, jobId: selectedJob.id, languageHints: languages
    }), text('Önceki türetilmiş sonuç doğrulanarak silindi ve iş yeniden sıraya alındı.','The previous derived result was verified, deleted, and the job was queued again.'), languages.join(','));
  };

  const remove = async (): Promise<void> => {
    if (!window.pardus || !selectedJob || !globalThis.confirm(text('Yerel metin tanıma sonucu ve iş kaydı silinsin mi? Arşiv kaynağı korunur.','Delete the local text-recognition result and job record? The archive source will be preserved.'))) return;
    await mutate(`delete:${selectedJob.id}`, selectedJob.revision, (operation) => window.pardus!.deleteLocalGovernedOcrJob({
      ...operation, jobId: selectedJob.id, reason: text('Kullanıcı yerel metin tanıma sonucunu Doküman Merkezi üzerinden sildi.','The user deleted the local text-recognition result through the Document Center.')
    }), text('Yerel metin tanıma sonucu silindi; kaynak arşiv belgesi korundu.','The local text-recognition result was deleted and the source archive document was preserved.'));
  };

  const setEnabled = async (enabled: boolean): Promise<void> => {
    if (!window.pardus || !center) return;
    await mutate(`settings:${enabled ? 'enable' : 'disable'}`, center.settings.revision,
      (operation) => window.pardus!.setLocalGovernedOcrEnabled({
        ...operation, enabled,
        reason: enabled ? text('Kullanıcı yerel metin tanımayı etkinleştirdi.','The user enabled local text recognition.') : text('Kullanıcı yerel metin tanımayı devre dışı bıraktı.','The user disabled local text recognition.')
      }), enabled ? text('Yerel metin tanıma etkinleştirildi.','Local text recognition was enabled.') : text('Yerel metin tanıma devre dışı bırakıldı.','Local text recognition was disabled.'));
  };

  if (loading && !center) return <AsyncStatePanel state="loading" title={text('Yerel metin tanıma merkezi yükleniyor','Loading the local text-recognition center')} message={text('İşler ve yerel işleme ayarı okunuyor.','Reading jobs and the local processing setting.')} />;
  if (loadError && !center) return <AsyncStatePanel state="error" title={text('Yerel metin tanıma merkezi yüklenemedi','The local text-recognition center could not be loaded')} message={loadError} onRetry={async () => { await refresh(); }} />;
  if (!center) return <AsyncStatePanel state="empty" title={text('Yerel metin tanıma kullanılamıyor','Local text recognition is unavailable')} message={text('Güvenli masaüstü bağlantısı hazır değil.','The secure desktop connection is not ready.')} onRetry={async () => { await refresh(); }} />;

  return (
    <section className="panel local-ocr-center" aria-labelledby="local-ocr-center-title" aria-busy={Boolean(busyKey)}>
      <div className="panel-heading">
        <div>
          <span className="eyebrow">{text('Yerel ve yönetilen türetilmiş veri','Local governed derived data')}</span>
          <h2 id="local-ocr-center-title">{text('Belge metin tanıma merkezi','Document text-recognition center')}</h2>
          <p>{text('PNG ve JPEG belgeleri yalnız açık hassas veri işleme izni ve merkezi PEP kararıyla yerel olarak işler.','PNG and JPEG documents are processed locally only with explicit sensitive-data processing consent and a centralized PEP decision.')}</p>
        </div>
        <Button disabled={Boolean(busyKey)} onClick={() => void setEnabled(!center.settings.enabled)}>
          {center.settings.enabled ? text('İşlemeyi kapat','Disable processing') : text('İşlemeyi aç','Enable processing')}
        </Button>
      </div>

      {!networkOnline && <StatusMessage tone="info">{text('Ağ çevrimdışı görünüyor. Bu yalnız bilgilendirmedir; yerel metin tanıma izni ağ durumuna göre değişmez.','The network appears offline. This is informational only; local text-recognition permission does not change with network status.')}</StatusMessage>}
      {loadError && <StatusMessage tone="warning">{text('İşlem kaydedilmiş olabilir ancak görünüm yenilenemedi:','The operation may have been saved, but the view could not be refreshed:')} {loadError}</StatusMessage>}
      {operationError && <StatusMessage tone="warning">{operationError}</StatusMessage>}
      {notice && <StatusMessage tone="success">{notice}</StatusMessage>}

      <div className="local-ocr-truth" role="note" aria-label={text('Yerel metin tanıma doğruluk sınırları','Local text-recognition accuracy limits')}>
        <strong>{text('Açık iddia sınırı','Explicit claim boundary')}</strong>
        <span>{text('Metin tanıma bu bilgisayarda yapılır. Kaynak dosya içeriği bu ekrana taşınmaz ve tanınan açık metin kalıcı aile kayıtlarına eklenmez.','Text recognition runs on this computer. Source-file contents are not brought into this screen, and recognized plaintext is not added to permanent family records.')}</span>
        <span>{text('İşlem ayrı ve kotalı bir çalışma alanında yürütülür; işletim sistemi düzeyindeki ek yalıtım doğrulanmamıştır.','Processing runs in a separate quota-limited workspace; additional operating-system isolation has not been verified.')}</span>
        <span>{text('PDF hazırlama veya güvenlik taraması kullanılamıyorsa işlem güvenle durdurulur. Kaynak dosya silindiğinde ondan üretilen sonuçların temizliği de otomatik olarak sürdürülür.','Processing stops safely if PDF preparation or security scanning is unavailable. When the source file is deleted, cleanup of results derived from it also continues automatically.')}</span>
        <span>{text("Sıradaki veya çalışan iş iptal edilebilir; çalışan işte istek yerel worker'a iletilir ve kalıcı sonuç transactionı Cancel commit'inden sonra tamamlanır. Türetilmiş sonucu silmek kaynak belgeyi silmez.","A queued or running job can be canceled; for a running job, the request is sent to the local worker and the durable result transaction completes after the Cancel commit. Deleting a derived result does not delete the source document.")}</span>
        <span>{text('Tam metin dizini sonuçla birlikte şifreli alanda tutulur; her sonuç için yetki ve izin yeniden denetlenir, ekranda yalnız maskelenmiş kısa parçalar gösterilir.','The full-text index is stored with the result in the encrypted area; authorization and consent are checked again for each result, and only short masked snippets appear on screen.')}</span>
      </div>

      <form className="local-ocr-search" onSubmit={(event) => { event.preventDefault(); void search(); }}>
        <label htmlFor="local-ocr-search-query">{text('Metin tanıma sonuçlarında güvenli ara','Search text-recognition results securely')}
          <input id="local-ocr-search-query" value={searchQuery} maxLength={80}
            onChange={(event) => { setSearchQuery(event.target.value); setSearchResult(undefined); }}
            placeholder={text('En az iki karakter','At least two characters')} autoComplete="off" />
        </label>
        <Button type="submit" disabled={Boolean(busyKey) || searchQuery !== searchQuery.trim() || searchQuery.length < 2}>
          {busyKey === 'search' ? text('Yetkiler denetleniyor…','Checking authorization…') : text('Şifreli dizinde ara','Search encrypted index')}
        </Button>
        <small>{text('Arama sözü ve tam dizin sonuç ekranında tekrarlanmaz; e-posta, IBAN ve uzun sayı dizileri arama olarak reddedilir.','The search text and full index are not repeated on the results screen; email addresses, IBANs, and long number sequences are rejected as searches.')}</small>
        {searchResult && <div className="local-ocr-search-results" aria-live="polite">
          <strong>{searchResult.matches.length ? `${searchResult.matches.length} ${text('yetkili eşleşme','authorized matches')}` : text('Yetkili eşleşme bulunamadı','No authorized matches found')}</strong>
          {searchResult.matches.map((match) => <button type="button" key={`${match.jobId}:${match.revision}`}
            onClick={() => setSelectedJobId(match.jobId)}>
            <span>{match.snippet}</span>
            <small>{match.pageNumber ? `${text('Sayfa','Page')} ${match.pageNumber} · ` : ''}{match.corrected ? text('Düzeltilmiş sonuç','Corrected result') : text('Yerel metin tanıma sonucu','Local text-recognition result')}</small>
          </button>)}
          {searchResult.truncated && <small>{text('Sonuçlar güvenli üst sınırda kesildi.','Results were truncated at the safe upper limit.')}</small>}
        </div>}
      </form>

      <div className="local-ocr-create-grid">
        <div>
          <small>{text('Seçili arşiv belgesi','Selected archive document')}</small>
          <strong>{selectedSource?.title ?? text('Belge seçilmedi','No document selected')}</strong>
          <span>{selectedSource ? `${selectedSource.originalName} · ${selectedSource.mimeType} · ${(selectedSource.sizeBytes / 1_024).toFixed(1)} KB` : text('Metin tanıma işi oluşturmak için listeden bir belge seçin.','Choose a document in the list to create a text-recognition job.')}</span>
        </div>
        <label>{text('Dil ipuçları','Language hints')}
          <input value={languageInput} onChange={(event) => setLanguageInput(event.target.value)} aria-invalid={!languagesValid} placeholder="tr-TR, en-US" />
        </label>
        <Button tone="primary" disabled={Boolean(busyKey) || !center.settings.enabled || !sourceSupported || !languagesValid} onClick={() => void create()}>
          {busyKey.startsWith('create:') ? text('Sıraya alınıyor…','Queuing…') : text('Seçili belge için metin tanıma işi oluştur','Create a text-recognition job for the selected document')}
        </Button>
      </div>
      {selectedSource && !sourceSupported && <small className="form-error">{text('Gerçek yerel sağlayıcı şu anda yalnız 16 MiB veya daha küçük PNG/JPEG kaynaklarını kabul eder; PDF desteklenmez.','The real local provider currently accepts only PNG/JPEG sources of 16 MiB or less; PDF is not supported.')}</small>}

      {center.jobs.length ? (
        <div className="local-ocr-workspace">
          <label>{text('Metin tanıma işi','Text-recognition job')}
            <select value={selectedJobId} onChange={(event) => setSelectedJobId(event.target.value)}>
              {center.jobs.map((item) => <option key={item.id} value={item.id}>{statusLabels[item.status]} · {item.source.resourceId}</option>)}
            </select>
          </label>
          {selectedJob && <article className="local-ocr-job-card">
            <div className="panel-heading">
              <div><span className="eyebrow">{text('Revizyon','Revision')} {selectedJob.revision} · {text('Deneme','Attempt')} {selectedJob.runAttempt}</span><h3>{statusLabels[selectedJob.status]}</h3></div>
              <span className={`tag ${selectedJob.status === 'failed' ? 'red' : 'blue'}`}>{text('Yerel · ağ yok · bulut yok','Local · no network · no cloud')}</span>
            </div>
            <div className="detail-grid">
              <div><small>{text('Kaynak türü','Source type')}</small><strong>{selectedJob.source.mimeType}</strong></div>
              <div><small>{text('Karakter','Characters')}</small><strong>{selectedJob.resultCharacterCount ?? '—'}</strong></div>
              <div><small>{text('Sayfa','Pages')}</small><strong>{selectedJob.resultPageCount ?? '—'}</strong></div>
              <div><small>{text('Güncelleme','Updated')}</small><strong>{new Date(selectedJob.updatedAt).toLocaleString(locale)}</strong></div>
            </div>
            {selectedJob.failureCode && <StatusMessage tone="warning">{failureLabels[selectedJob.failureCode]}</StatusMessage>}
            <div className="button-row">
              <Button tone="primary" disabled={Boolean(busyKey) || selectedJob.status !== 'queued'} onClick={() => void run()}>{text('Yerel metin tanımayı çalıştır','Run local text recognition')}</Button>
              <Button disabled={Boolean(busyKey) || !['queued', 'running'].includes(selectedJob.status)} onClick={() => void cancel()}>
                {selectedJob.status === 'running' ? text('Çalışan işi iptal et','Cancel running job') : text('Sıradaki işi iptal et','Cancel queued job')}
              </Button>
              <Button disabled={Boolean(busyKey) || !selectedJob.resultAvailable} onClick={() => void readResult()}>{text('Sonucu açıkça görüntüle','Explicitly reveal result')}</Button>
              <Button disabled={Boolean(busyKey) || !['completed', 'failed', 'cancelled'].includes(selectedJob.status)} onClick={() => void rerun()}>{text('Yeniden sıraya al','Queue again')}</Button>
              <Button tone="danger" disabled={Boolean(busyKey) || selectedJob.status === 'deleted'} onClick={() => void remove()}>{text('Yerel sonucu sil','Delete local result')}</Button>
            </div>
            {result && result.jobId === selectedJob.id && <div className="local-ocr-result">
              <div><strong>{text('Şifreli kasadan açılan sonuç','Result opened from encrypted vault')}</strong><span>{result.corrected ? text('Düzeltilmiş sürüm','Corrected revision') : text('Yerel sağlayıcı çıktısı','Local provider output')} · {text('ağ yok · bulut yok','no network · no cloud')}</span></div>
              <textarea aria-label={text('Metin tanıma sonucu düzeltme alanı','Text-recognition result correction field')} value={correctedText} maxLength={250_000} onChange={(event) => setCorrectedText(event.target.value)} />
              <Button disabled={Boolean(busyKey) || correctedText.length < 1 || correctedText === result.text} onClick={() => void correct()}>{text('Düzeltmeyi yeni sürüm olarak kaydet','Save correction as new revision')}</Button>
            </div>}
          </article>}
        </div>
      ) : <EmptyState title={text('Metin tanıma işi yok','No text-recognition jobs')} body={text('Desteklenen bir arşiv belgesi seçip yetki denetiminden geçen ilk işi oluşturun.','Select a supported archive document and create the first job that passes authorization.')} />}
    </section>
  );
}

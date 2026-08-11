import { createHash } from 'node:crypto';
import type {
  ExternalBackupEvidenceRevocationListView,
  ExternalBackupRevocationEndpointView,
  FetchedExternalBackupEvidenceRevocationListView,
  PendingRevocationSyncListView,
  RevocationSyncEndpointStateView,
  RevocationSyncListFreshness,
  RevocationSyncPersistenceStatus,
  RevocationSyncRunResultView
} from '@ppt/domain';
import { resolveExternalBackupRevocationEndpointPins } from '@ppt/application';
import { fetchGovernedExternalBackupEvidenceRevocationList, type MutualTlsClientIdentity } from './governed-network-egress-use-case.js';
import type { PersistedRevocationSyncEndpointState, RevocationSyncStatePersistence } from './secure-revocation-sync-state.js';

const MIN_INTERVAL_MS = 15 * 60_000;
const MAX_BACKOFF_MS = 6 * 60 * 60_000;
const CLOCK_SKEW_MS = 5 * 60_000;
const EXPIRING_SOON_MS = 24 * 60 * 60_000;

export interface SecureRevocationSyncDependencies {
  listEndpoints(): readonly ExternalBackupRevocationEndpointView[];
  listVerifiedLists(): readonly ExternalBackupEvidenceRevocationListView[];
  recordFetch(endpointId: string, status: 'success' | 'failed', error: string | undefined, at: string): void;
  notify(input: { title: string; body: string; urgency: 'normal' | 'critical' }): void;
  diagnostic(severity: 'info' | 'warning' | 'error', code: string, message: string, details?: string): void;
  now(): Date;
  persistence?: RevocationSyncStatePersistence;
  resolveMutualTlsIdentity?(endpoint: ExternalBackupRevocationEndpointView): MutualTlsClientIdentity | undefined;
  fetchList?(input: { endpoint: ExternalBackupRevocationEndpointView; expectedPins: readonly { sha256: string; kind: 'primary' | 'secondary' }[]; observedAt: string; mutualTlsIdentity?: MutualTlsClientIdentity; signal?: AbortSignal }): Promise<FetchedExternalBackupEvidenceRevocationListView>;
}

interface PendingState {
  readonly fetched: FetchedExternalBackupEvidenceRevocationListView;
  readonly endpointFingerprint: string;
}

interface MutableState {
  endpointId: string;
  status: 'idle' | 'checking' | 'update_available' | 'current' | 'backoff' | 'blocked';
  consecutiveFailures: number;
  nextAttemptAt: string;
  lastAttemptAt?: string;
  lastSuccessAt?: string;
  lastError?: string;
  pending?: PendingState;
  listFreshness: RevocationSyncListFreshness;
  currentSequenceNumber?: number;
  currentNextUpdate?: string;
  lastFreshnessNoticeKey?: string;
}

const rootLatest = (lists: readonly ExternalBackupEvidenceRevocationListView[], issuerId: string) =>
  lists.filter((row) => row.authorityRootIssuerId === issuerId).sort((a, b) => b.sequenceNumber - a.sequenceNumber)[0];

const endpointFingerprint = (endpoint: ExternalBackupRevocationEndpointView): string => createHash('sha256').update(JSON.stringify({
  id: endpoint.id,
  issuerId: endpoint.issuerId,
  sourceUrl: endpoint.sourceUrl,
  primarySpkiSha256: endpoint.primarySpkiSha256,
  secondarySpkiSha256: endpoint.secondarySpkiSha256 ?? null,
  secondaryValidFrom: endpoint.secondaryValidFrom ?? null,
  primaryValidUntil: endpoint.primaryValidUntil ?? null,
  status: endpoint.status
})).digest('hex');

const pendingSummary = (pending: PendingState): PendingRevocationSyncListView => ({
  endpointId: pending.fetched.endpointId,
  listId: pending.fetched.list.listId,
  signerIssuerId: pending.fetched.list.signerIssuerId,
  sequenceNumber: pending.fetched.list.sequenceNumber,
  thisUpdate: pending.fetched.list.thisUpdate,
  nextUpdate: pending.fetched.list.nextUpdate,
  entryCount: pending.fetched.list.entries.length,
  fetchedAt: pending.fetched.fetchedAt,
  sourceUrl: pending.fetched.sourceUrl,
  tlsSpkiSha256: pending.fetched.tlsSpkiSha256,
  matchedPin: pending.fetched.matchedPin,
  responseBytes: pending.fetched.responseBytes
});

const freshnessOf = (latest: ExternalBackupEvidenceRevocationListView | undefined, nowMs: number): RevocationSyncListFreshness => {
  if (!latest) return 'missing';
  const nextMs = Date.parse(latest.nextUpdate);
  if (!Number.isFinite(nextMs) || nextMs <= nowMs) return 'expired';
  return nextMs - nowMs <= EXPIRING_SOON_MS ? 'expiring_soon' : 'fresh';
};

export class SecureRevocationSyncService {
  readonly #states = new Map<string, MutableState>();
  #running = false;
  #persistenceStatus: RevocationSyncPersistenceStatus = 'healthy';
  #persistenceNoticeEmitted = false;

  public constructor(private readonly deps: SecureRevocationSyncDependencies) {
    const restore = deps.persistence?.load();
    if (!restore) return;
    if (restore.status === 'RESTORED') {
      for (const row of restore.states) {
        this.#states.set(row.endpointId, {
          ...row,
          status: row.status === 'checking' ? 'idle' : row.status,
          ...(row.pending ? { pending: row.pending } : {})
        });
      }
      deps.diagnostic('info', 'revocation.sync_state_restored', 'Güvenli iptal listesi senkronizasyon durumu işletim sistemi korumasından geri yüklendi.', `${restore.states.length}`);
    } else if (restore.status === 'REJECTED') {
      this.#persistenceStatus = 'failed';
      deps.diagnostic('error', 'revocation.sync_state_rejected', 'Kalıcı iptal listesi senkronizasyon durumu doğrulanamadı ve karantinaya alındı.', restore.reason);
      deps.notify({ title: 'Güvenlik durumu yeniden oluşturuluyor', body: 'İptal listesi eşitleme durumu doğrulanamadı. Kaynaklar yeniden kontrol edilene kadar bekleyen güncellemeler güvenilir sayılmayacaktır.', urgency: 'critical' });
      this.#persistenceNoticeEmitted = true;
    } else if (restore.status === 'UNAVAILABLE') {
      this.#persistenceStatus = 'unavailable';
      deps.diagnostic('error', 'revocation.sync_state_unavailable', 'İptal listesi eşitleme durumu için işletim sistemi koruması kullanılamıyor.', restore.reason);
      deps.notify({ title: 'Güvenlik durumu korunamıyor', body: 'İptal listesi eşitleme durumu bu oturumda kalıcı olarak korunamıyor. İşletim sistemi güvenli depolaması düzeltilmelidir.', urgency: 'critical' });
      this.#persistenceNoticeEmitted = true;
    }
    this.#discardStalePendingProfiles();
    this.#refreshFreshnessWarnings(false);
  }

  public listStates(): readonly RevocationSyncEndpointStateView[] {
    this.#discardStalePendingProfiles();
    this.#refreshFreshnessWarnings(true);
    return [...this.#states.values()].map((state) => ({
      endpointId: state.endpointId,
      status: state.status,
      consecutiveFailures: state.consecutiveFailures,
      nextAttemptAt: state.nextAttemptAt,
      listFreshness: state.listFreshness,
      persistenceStatus: this.#persistenceStatus,
      ...(state.lastAttemptAt ? { lastAttemptAt: state.lastAttemptAt } : {}),
      ...(state.lastSuccessAt ? { lastSuccessAt: state.lastSuccessAt } : {}),
      ...(state.lastError ? { lastError: state.lastError } : {}),
      ...(state.currentSequenceNumber ? { currentSequenceNumber: state.currentSequenceNumber } : {}),
      ...(state.currentNextUpdate ? { currentNextUpdate: state.currentNextUpdate } : {}),
      ...(state.pending ? {
        pendingSequenceNumber: state.pending.fetched.list.sequenceNumber,
        pendingListId: state.pending.fetched.list.listId,
        pendingFetchedAt: state.pending.fetched.fetchedAt
      } : {})
    }));
  }

  public getPendingSummary(endpointId: string): PendingRevocationSyncListView | undefined {
    const pending = this.#currentPending(endpointId);
    return pending ? pendingSummary(pending) : undefined;
  }

  public getPendingForApply(endpointId: string, pendingListId: string): FetchedExternalBackupEvidenceRevocationListView {
    const pending = this.#currentPending(endpointId);
    if (!pending || pending.fetched.list.listId !== pendingListId) {
      throw new Error('Bekleyen iptal listesi bulunamadı, değişti veya kaynak profili güncellendi. Yeniden senkronizasyon gereklidir.');
    }
    return pending.fetched;
  }

  public markApplied(endpointId: string, pendingListId: string, sequenceNumber: number): void {
    const state = this.#states.get(endpointId);
    const pending = this.#currentPending(endpointId);
    if (!state || !pending || pending.fetched.list.listId !== pendingListId || pending.fetched.list.sequenceNumber !== sequenceNumber) {
      throw new Error('Uygulanan iptal listesi bekleyen güvenli senkronizasyon kaydıyla eşleşmiyor.');
    }
    delete state.pending;
    delete state.lastError;
    state.status = 'current';
    state.consecutiveFailures = 0;
    state.lastSuccessAt = this.deps.now().toISOString();
    state.nextAttemptAt = new Date(this.deps.now().getTime() + MIN_INTERVAL_MS).toISOString();
    this.#refreshFreshnessWarnings(true);
    this.#persist();
    this.deps.diagnostic('info', 'revocation.sync_pending_applied', 'Bekleyen güvenli iptal listesi güçlü doğrulamayla uygulandı.', `${endpointId}:${pendingListId}:${sequenceNumber}`);
  }

  public invalidateEndpoint(endpointId: string, reason: string): void {
    const state = this.#states.get(endpointId);
    if (!state) return;
    const hadPending = Boolean(state.pending);
    delete state.pending;
    delete state.lastError;
    state.status = 'idle';
    state.consecutiveFailures = 0;
    state.nextAttemptAt = this.deps.now().toISOString();
    this.#persist();
    if (hadPending) this.deps.diagnostic('warning', 'revocation.sync_pending_invalidated', 'Bekleyen iptal listesi entegrasyon güvenliği nedeniyle geçersiz kılındı.', `${endpointId}:${reason}`);
  }

  public invalidateIssuer(issuerId: string, reason: string): void {
    for (const endpoint of this.deps.listEndpoints()) if (endpoint.issuerId === issuerId) this.invalidateEndpoint(endpoint.id, reason);
  }

  public invalidateAll(reason: string): void {
    for (const endpointId of this.#states.keys()) this.invalidateEndpoint(endpointId, reason);
  }

  public async runDue(forceEndpointId?: string, signal?: AbortSignal): Promise<RevocationSyncRunResultView> {
    if (signal?.aborted) throw signal.reason instanceof Error ? signal.reason : new Error('İptal listesi senkronizasyonu iptal edildi.');
    if (this.#running) return { startedAt: this.deps.now().toISOString(), finishedAt: this.deps.now().toISOString(), checked: 0, updates: 0, failed: 0, skipped: 1 };
    this.#running = true;
    const started = this.deps.now();
    let checked = 0;
    let updates = 0;
    let failed = 0;
    let skipped = 0;
    try {
      this.#refreshFreshnessWarnings(true);
      const endpoints = this.deps.listEndpoints().filter((endpoint) => endpoint.status === 'active' && (!forceEndpointId || endpoint.id === forceEndpointId));
      const verified = this.deps.listVerifiedLists();
      for (const endpoint of endpoints) {
        if (signal?.aborted) throw signal.reason instanceof Error ? signal.reason : new Error('İptal listesi senkronizasyonu iptal edildi.');
        const now = this.deps.now();
        let state = this.#states.get(endpoint.id);
        if (!state) {
          state = { endpointId: endpoint.id, status: 'idle', consecutiveFailures: 0, nextAttemptAt: now.toISOString(), listFreshness: freshnessOf(rootLatest(verified, endpoint.issuerId), now.getTime()) };
          this.#states.set(endpoint.id, state);
        }
        if (state.pending && state.pending.endpointFingerprint !== endpointFingerprint(endpoint)) this.invalidateEndpoint(endpoint.id, 'endpoint-profile-fingerprint-changed');
        if (!forceEndpointId && Date.parse(state.nextAttemptAt) > now.getTime()) {
          skipped += 1;
          continue;
        }
        state.status = 'checking';
        state.lastAttemptAt = now.toISOString();
        checked += 1;
        try {
          const pins = resolveExternalBackupRevocationEndpointPins(endpoint, state.lastAttemptAt);
          if (pins.length === 0) throw new Error('Kaynak profilinde şu an geçerli TLS SPKI pini yok.');
          const fetchList = this.deps.fetchList ?? fetchGovernedExternalBackupEvidenceRevocationList;
          const mutualTlsIdentity = this.deps.resolveMutualTlsIdentity?.(endpoint);
          const fetched = await fetchList({ endpoint, expectedPins: pins, observedAt: state.lastAttemptAt, ...(mutualTlsIdentity ? { mutualTlsIdentity } : {}), ...(signal ? { signal } : {}) });
          const list = fetched.list;
          const thisMs = Date.parse(list.thisUpdate);
          const nextMs = Date.parse(list.nextUpdate);
          const nowMs = now.getTime();
          if (!Number.isFinite(thisMs) || !Number.isFinite(nextMs) || thisMs > nowMs + CLOCK_SKEW_MS || nextMs <= nowMs) throw new Error('İptal listesi zaman penceresi geçerli değil.');
          if (list.signerIssuerId.trim().length === 0 || list.listId.trim().length === 0 || !Number.isSafeInteger(list.sequenceNumber) || list.sequenceNumber < 1) throw new Error('İptal listesi kimlik ve sıra alanları geçersiz.');
          const latest = rootLatest(verified, endpoint.issuerId);
          if (latest && list.sequenceNumber <= latest.sequenceNumber) {
            delete state.pending;
            state.status = 'current';
            state.consecutiveFailures = 0;
            state.lastSuccessAt = fetched.fetchedAt;
            delete state.lastError;
            state.nextAttemptAt = new Date(nowMs + MIN_INTERVAL_MS).toISOString();
            this.deps.recordFetch(endpoint.id, 'success', undefined, fetched.fetchedAt);
            this.#persist();
            continue;
          }
          state.pending = { fetched, endpointFingerprint: endpointFingerprint(endpoint) };
          state.status = 'update_available';
          state.consecutiveFailures = 0;
          state.lastSuccessAt = fetched.fetchedAt;
          delete state.lastError;
          state.nextAttemptAt = new Date(nowMs + MIN_INTERVAL_MS).toISOString();
          updates += 1;
          this.deps.recordFetch(endpoint.id, 'success', undefined, fetched.fetchedAt);
          this.#persist();
          this.deps.notify({ title: 'Güvenli iptal listesi güncellemesi', body: `${endpoint.issuerLabel} için sıra ${list.sequenceNumber} doğrulama ve güçlü onay bekliyor.`, urgency: 'critical' });
          this.deps.diagnostic('warning', 'revocation.sync_update_available', 'Yeni imzalı iptal listesi güçlü doğrulama için bekletiliyor.', `${endpoint.id}:${list.listId}:${list.sequenceNumber}`);
        } catch (error) {
          if (signal?.aborted) throw signal.reason instanceof Error ? signal.reason : error;
          const message = error instanceof Error ? error.message : String(error);
          delete state.pending;
          state.consecutiveFailures += 1;
          state.lastError = message;
          state.status = message.includes('geçerli TLS SPKI') ? 'blocked' : 'backoff';
          const delay = Math.min(MAX_BACKOFF_MS, MIN_INTERVAL_MS * 2 ** Math.min(5, state.consecutiveFailures - 1));
          state.nextAttemptAt = new Date(now.getTime() + delay).toISOString();
          failed += 1;
          this.deps.recordFetch(endpoint.id, 'failed', message, state.lastAttemptAt);
          this.#persist();
          this.deps.diagnostic(state.status === 'blocked' ? 'error' : 'warning', 'revocation.sync_failed', 'Güvenli iptal listesi senkronizasyonu başarısız oldu.', message);
          if (state.consecutiveFailures === 1 || state.status === 'blocked') this.deps.notify({ title: 'İptal listesi senkronizasyon uyarısı', body: `${endpoint.issuerLabel}: ${message}`, urgency: state.status === 'blocked' ? 'critical' : 'normal' });
        }
      }
      this.#refreshFreshnessWarnings(true);
    } finally {
      this.#running = false;
    }
    return { startedAt: started.toISOString(), finishedAt: this.deps.now().toISOString(), checked, updates, failed, skipped };
  }

  #currentPending(endpointId: string): PendingState | undefined {
    const state = this.#states.get(endpointId);
    if (!state?.pending) return undefined;
    const endpoint = this.deps.listEndpoints().find((row) => row.id === endpointId && row.status === 'active');
    if (!endpoint || state.pending.endpointFingerprint !== endpointFingerprint(endpoint)) {
      this.invalidateEndpoint(endpointId, endpoint ? 'endpoint-profile-fingerprint-changed' : 'endpoint-disabled-or-missing');
      return undefined;
    }
    return state.pending;
  }

  #discardStalePendingProfiles(): void {
    for (const endpointId of [...this.#states.keys()]) this.#currentPending(endpointId);
  }

  #refreshFreshnessWarnings(emitNotifications: boolean): void {
    const now = this.deps.now();
    const activeEndpoints = this.deps.listEndpoints().filter((endpoint) => endpoint.status === 'active');
    const verified = this.deps.listVerifiedLists();
    let changed = false;
    for (const endpoint of activeEndpoints) {
      const latest = rootLatest(verified, endpoint.issuerId);
      const freshness = freshnessOf(latest, now.getTime());
      let state = this.#states.get(endpoint.id);
      if (!state) {
        state = { endpointId: endpoint.id, status: 'idle', consecutiveFailures: 0, nextAttemptAt: now.toISOString(), listFreshness: freshness };
        this.#states.set(endpoint.id, state);
        changed = true;
      }
      const currentNextUpdate = latest?.nextUpdate;
      const currentSequenceNumber = latest?.sequenceNumber;
      if (state.listFreshness !== freshness || state.currentNextUpdate !== currentNextUpdate || state.currentSequenceNumber !== currentSequenceNumber) changed = true;
      state.listFreshness = freshness;
      if (currentNextUpdate) state.currentNextUpdate = currentNextUpdate; else delete state.currentNextUpdate;
      if (currentSequenceNumber) state.currentSequenceNumber = currentSequenceNumber; else delete state.currentSequenceNumber;
      const noticeKey = `${freshness}:${currentNextUpdate ?? 'none'}`;
      if (freshness === 'fresh') {
        if (state.lastFreshnessNoticeKey) { delete state.lastFreshnessNoticeKey; changed = true; }
        continue;
      }
      if (emitNotifications && state.lastFreshnessNoticeKey !== noticeKey) {
        state.lastFreshnessNoticeKey = noticeKey;
        changed = true;
        const urgency = freshness === 'expired' ? 'critical' : 'normal';
        const title = freshness === 'missing' ? 'İptal listesi henüz doğrulanmadı' : freshness === 'expired' ? 'İptal listesinin süresi doldu' : 'İptal listesinin süresi yaklaşıyor';
        const body = freshness === 'missing'
          ? `${endpoint.issuerLabel} için doğrulanmış bir iptal listesi bulunmuyor. Güvenli kaynak eşitlemesi çalıştırılmalıdır.`
          : freshness === 'expired'
            ? `${endpoint.issuerLabel} iptal listesi ${currentNextUpdate ?? 'bilinmeyen zamanda'} sona erdi. Yeni liste doğrulanana kadar güven yükseltilmemelidir.`
            : `${endpoint.issuerLabel} iptal listesi 24 saat içinde, ${currentNextUpdate} tarihinde sona erecek.`;
        this.deps.notify({ title, body, urgency });
        this.deps.diagnostic(freshness === 'expired' ? 'error' : 'warning', `revocation.sync_list_${freshness}`, title, `${endpoint.id}:${currentNextUpdate ?? 'none'}`);
      }
    }
    const activeIds = new Set(activeEndpoints.map((endpoint) => endpoint.id));
    for (const [endpointId, state] of this.#states) {
      if (activeIds.has(endpointId)) continue;
      if (state.pending) {
        delete state.pending;
        changed = true;
        this.deps.diagnostic('warning', 'revocation.sync_pending_invalidated', 'Devre dışı veya silinmiş kaynak için bekleyen liste geri çekildi.', `${endpointId}:endpoint-disabled-or-missing`);
      }
    }
    if (changed) this.#persist();
  }

  #persist(): void {
    if (!this.deps.persistence) return;
    const rows: PersistedRevocationSyncEndpointState[] = [...this.#states.values()].map((state) => ({
      endpointId: state.endpointId,
      status: state.status === 'checking' ? 'idle' : state.status,
      consecutiveFailures: state.consecutiveFailures,
      nextAttemptAt: state.nextAttemptAt,
      listFreshness: state.listFreshness,
      ...(state.lastAttemptAt ? { lastAttemptAt: state.lastAttemptAt } : {}),
      ...(state.lastSuccessAt ? { lastSuccessAt: state.lastSuccessAt } : {}),
      ...(state.lastError ? { lastError: state.lastError } : {}),
      ...(state.currentSequenceNumber ? { currentSequenceNumber: state.currentSequenceNumber } : {}),
      ...(state.currentNextUpdate ? { currentNextUpdate: state.currentNextUpdate } : {}),
      ...(state.lastFreshnessNoticeKey ? { lastFreshnessNoticeKey: state.lastFreshnessNoticeKey } : {}),
      ...(state.pending ? { pending: state.pending } : {})
    }));
    try {
      this.deps.persistence.persist(rows);
      this.#persistenceStatus = 'healthy';
      this.#persistenceNoticeEmitted = false;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.#persistenceStatus = /işletim sistemi koruması kullanılamıyor/i.test(message) ? 'unavailable' : 'failed';
      this.deps.diagnostic('error', 'revocation.sync_state_persist_failed', 'İptal listesi senkronizasyon durumu kalıcı olarak yazılamadı.', message);
      if (!this.#persistenceNoticeEmitted) {
        this.deps.notify({ title: 'Güvenlik durumu kaydedilemedi', body: 'İptal listesi eşitleme durumu yeniden başlatmada kaybolabilir. Güvenli depolama veya disk erişimi kontrol edilmelidir.', urgency: 'critical' });
        this.#persistenceNoticeEmitted = true;
      }
    }
  }
}

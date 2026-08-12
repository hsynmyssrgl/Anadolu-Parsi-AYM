export const PRODUCT_NAVIGATION_GROUPS = Object.freeze([
  Object.freeze({ id: 'main', label: 'Ana Merkez' }),
  Object.freeze({ id: 'family-memory', label: 'Aile Hafızası' }),
  Object.freeze({ id: 'life', label: 'Yaşam' }),
  Object.freeze({ id: 'privacy-system', label: 'Gizlilik ve Sistem' })
] as const);

export type ProductNavigationGroupId = (typeof PRODUCT_NAVIGATION_GROUPS)[number]['id'];
export type ProductSurfaceKind = 'product-module' | 'governance-surface';

export const PRODUCT_NAVIGATION_ROUTES = Object.freeze([
  Object.freeze({ id: 'dashboard', label: 'Gösterge Paneli', icon: '⌂', groupId: 'main', kind: 'product-module' }),
  Object.freeze({ id: 'family', label: 'Aile', icon: '♙', groupId: 'family-memory', kind: 'product-module' }),
  Object.freeze({ id: 'households', label: 'Haneler ve Dallar', icon: '⌑', groupId: 'family-memory', kind: 'product-module' }),
  Object.freeze({ id: 'people-lifecycle', label: 'Kişi Profilleri', icon: '♙', groupId: 'family-memory', kind: 'product-module' }),
  Object.freeze({ id: 'tree', label: 'Soy Ağacı', icon: '⌘', groupId: 'family-memory', kind: 'product-module' }),
  Object.freeze({ id: 'timeline', label: 'Zaman Tüneli', icon: '◷', groupId: 'family-memory', kind: 'product-module' }),
  Object.freeze({ id: 'important-days', label: 'Önemli Günler', icon: '□', groupId: 'family-memory', kind: 'product-module' }),
  Object.freeze({ id: 'archive', label: 'Arşiv', icon: '▣', groupId: 'family-memory', kind: 'product-module' }),
  Object.freeze({ id: 'finance', label: 'Finans', icon: '₺', groupId: 'life', kind: 'product-module' }),
  Object.freeze({ id: 'health', label: 'Sağlık', icon: '♡', groupId: 'life', kind: 'product-module' }),
  Object.freeze({ id: 'life-center', label: 'Yaşam Merkezi', icon: '◇', groupId: 'life', kind: 'product-module' }),
  Object.freeze({ id: 'automation', label: 'Bildirim ve Otomasyon', icon: '◉', groupId: 'life', kind: 'product-module' }),
  Object.freeze({ id: 'reports', label: 'Raporlama', icon: '▤', groupId: 'life', kind: 'product-module' }),
  Object.freeze({ id: 'location', label: 'Konum', icon: '⌖', groupId: 'life', kind: 'product-module' }),
  Object.freeze({ id: 'invitations', label: 'Davetler', icon: '✉', groupId: 'privacy-system', kind: 'product-module' }),
  Object.freeze({ id: 'data-repair', label: 'Veri Onarma Merkezi', icon: '⌁', groupId: 'privacy-system', kind: 'governance-surface' }),
  Object.freeze({ id: 'permissions', label: 'Bağlamsal Yetkiler', icon: '♧', groupId: 'privacy-system', kind: 'governance-surface' }),
  Object.freeze({ id: 'ai', label: 'Yapay Zekâ', icon: '✣', groupId: 'privacy-system', kind: 'product-module' }),
  Object.freeze({ id: 'legacy', label: 'Dijital Miras', icon: '♜', groupId: 'privacy-system', kind: 'product-module' }),
  Object.freeze({ id: 'windows-hello', label: 'Windows Hello', icon: '◎', groupId: 'privacy-system', kind: 'governance-surface' }),
  Object.freeze({ id: 'security', label: 'Güvenlik Merkezi', icon: '⛨', groupId: 'privacy-system', kind: 'governance-surface' }),
  Object.freeze({ id: 'settings', label: 'Sistem ve Bakım', icon: '⚙', groupId: 'privacy-system', kind: 'governance-surface' })
] as const satisfies readonly {
  readonly id: string;
  readonly label: string;
  readonly icon: string;
  readonly groupId: ProductNavigationGroupId;
  readonly kind: ProductSurfaceKind;
}[]);

export type ProductScreenId = (typeof PRODUCT_NAVIGATION_ROUTES)[number]['id'];

export type UnusedRendererApiClassification =
  | 'BACKGROUND_OPERATIONAL'
  | 'DIAGNOSTIC_OPERATOR_API'
  | 'SUPERSEDED_READ_MODEL';

export interface UnusedRendererApiClassificationView {
  readonly method: string;
  readonly channel: string;
  readonly classification: UnusedRendererApiClassification;
  readonly rationale: string;
  readonly successorMethods: readonly string[];
  readonly b901Disposition: 'RETAIN_NON_UI' | 'REMOVE_AFTER_COMPATIBILITY_REVIEW';
}

export const CLASSIFIED_UNUSED_RENDERER_APIS: readonly UnusedRendererApiClassificationView[] = Object.freeze([
  Object.freeze({ method: 'getDiagnosticReport', channel: 'system:getDiagnosticReport', classification: 'DIAGNOSTIC_OPERATOR_API', rationale: 'Tek seferlik ham tanılama görünümü yerine doğrulanan geçmiş rapor akışı kullanılır.', successorMethods: Object.freeze(['listDiagnosticReports', 'readDiagnosticReport']), b901Disposition: 'REMOVE_AFTER_COMPATIBILITY_REVIEW' }),
  Object.freeze({ method: 'runDueBackups', channel: 'system:runDueBackups', classification: 'BACKGROUND_OPERATIONAL', rationale: 'Zamanı gelen yedekler ana süreç zamanlayıcısının sorumluluğundadır.', successorMethods: Object.freeze([]), b901Disposition: 'RETAIN_NON_UI' }),
  Object.freeze({ method: 'getAdaptiveState', channel: 'system:adaptiveState', classification: 'BACKGROUND_OPERATIONAL', rationale: 'Adaptif kaynak kararı ana süreç zamanlayıcısı ve telemetri sınırında tüketilir.', successorMethods: Object.freeze(['getIpcPerformanceTelemetry']), b901Disposition: 'RETAIN_NON_UI' }),
  Object.freeze({ method: 'verifyDiagnosticReport', channel: 'system:verifyDiagnosticReport', classification: 'SUPERSEDED_READ_MODEL', rationale: 'Raporu okuma işlemi bütünlük doğrulamasını birlikte yapar.', successorMethods: Object.freeze(['readDiagnosticReport']), b901Disposition: 'REMOVE_AFTER_COMPATIBILITY_REVIEW' }),
  Object.freeze({ method: 'searchMaintenanceHistory', channel: 'system:searchMaintenanceHistory', classification: 'DIAGNOSTIC_OPERATOR_API', rationale: 'Gelişmiş operatör filtresi renderer ekranına henüz bağlanmamış ayrı bir tanı yüzeyidir.', successorMethods: Object.freeze(['listMaintenanceHistory']), b901Disposition: 'REMOVE_AFTER_COMPATIBILITY_REVIEW' }),
  Object.freeze({ method: 'exportMaintenanceHistory', channel: 'system:exportMaintenanceHistory', classification: 'DIAGNOSTIC_OPERATOR_API', rationale: 'Bakım geçmişi dışa aktarımı görünür ekran akışından ayrı operatör aracıdır.', successorMethods: Object.freeze(['listMaintenanceHistory']), b901Disposition: 'REMOVE_AFTER_COMPATIBILITY_REVIEW' }),
  Object.freeze({ method: 'searchAllDiagnosticArchives', channel: 'system:searchAllDiagnosticArchives', classification: 'DIAGNOSTIC_OPERATOR_API', rationale: 'Birleşik arşiv taraması, seçili ve doğrulanmış arşiv aramasından ayrı operatör API yüzeyidir.', successorMethods: Object.freeze(['searchDiagnosticArchive']), b901Disposition: 'REMOVE_AFTER_COMPATIBILITY_REVIEW' }),
  Object.freeze({ method: 'listArchiveClassifications', channel: 'archive:listClassifications', classification: 'SUPERSEDED_READ_MODEL', rationale: 'Sayfalı arşiv okuma modeli sınıflandırma görünümünü ekran akışına taşır.', successorMethods: Object.freeze(['listLargeArchive']), b901Disposition: 'REMOVE_AFTER_COMPATIBILITY_REVIEW' }),
  Object.freeze({ method: 'listPermissions', channel: 'permissions:list', classification: 'SUPERSEDED_READ_MODEL', rationale: 'Hesap, dal ve izinleri atomik bağlam çalışma alanı birlikte döndürür.', successorMethods: Object.freeze(['getAuthorizationContextWorkspace']), b901Disposition: 'REMOVE_AFTER_COMPATIBILITY_REVIEW' }),
  Object.freeze({ method: 'propagatePurgedBackups', channel: 'dataLifecycle:propagatePurgedBackups', classification: 'BACKGROUND_OPERATIONAL', rationale: 'Silme yayılımı yönetilen temiz-yedek yeniden yazım iş akışınca yürütülür.', successorMethods: Object.freeze(['runBackupCleanRewrite']), b901Disposition: 'RETAIN_NON_UI' }),
  Object.freeze({ method: 'getSnapshot', channel: 'data:getSnapshot', classification: 'SUPERSEDED_READ_MODEL', rationale: 'Tam snapshot yerine gösterge özeti ve ihtiyaç-temelli bölüm yükleme kullanılır.', successorMethods: Object.freeze(['getDashboardOverview', 'getSnapshotSections']), b901Disposition: 'REMOVE_AFTER_COMPATIBILITY_REVIEW' }),
  Object.freeze({ method: 'listArchive', channel: 'archive:list', classification: 'SUPERSEDED_READ_MODEL', rationale: 'Sınırsız arşiv listesi sayfalı arşiv kataloğuyla değiştirilmiştir.', successorMethods: Object.freeze(['listLargeArchive']), b901Disposition: 'REMOVE_AFTER_COMPATIBILITY_REVIEW' }),
  Object.freeze({ method: 'searchArchive', channel: 'archive:search', classification: 'SUPERSEDED_READ_MODEL', rationale: 'Ayrı arama çağrısı sayfalı arşiv sorgusuna birleştirilmiştir.', successorMethods: Object.freeze(['listLargeArchive']), b901Disposition: 'REMOVE_AFTER_COMPATIBILITY_REVIEW' }),
  Object.freeze({ method: 'listArchiveRetentionStatus', channel: 'archive:listRetentionStatus', classification: 'SUPERSEDED_READ_MODEL', rationale: 'Saklama durumu sayfalı arşiv ve politika çalışma alanı üzerinden gösterilir.', successorMethods: Object.freeze(['listLargeArchive', 'listArchiveRetentionPolicies']), b901Disposition: 'REMOVE_AFTER_COMPATIBILITY_REVIEW' })
]);

export interface ProductSurfaceGovernanceView {
  readonly schemaVersion: 1;
  readonly enforcement: 'fail-closed';
  readonly productModuleCount: 17;
  readonly governanceSurfaceCount: 5;
  readonly navigationRouteCount: 22;
  readonly menuEntryCount: 22;
  readonly renderedScreenCount: 22;
  readonly classifiedUnusedRendererApiCount: 14;
  readonly unresolvedUnusedRendererApiCount: 0;
  readonly historicalSixteenModuleClaimSuperseded: true;
  readonly databaseMigrationRequired: false;
  readonly routes: typeof PRODUCT_NAVIGATION_ROUTES;
  readonly unusedRendererApis: readonly UnusedRendererApiClassificationView[];
}

export const createProductSurfaceGovernanceView = (): ProductSurfaceGovernanceView => Object.freeze({
  schemaVersion: 1,
  enforcement: 'fail-closed',
  productModuleCount: 17,
  governanceSurfaceCount: 5,
  navigationRouteCount: 22,
  menuEntryCount: 22,
  renderedScreenCount: 22,
  classifiedUnusedRendererApiCount: 14,
  unresolvedUnusedRendererApiCount: 0,
  historicalSixteenModuleClaimSuperseded: true,
  databaseMigrationRequired: false,
  routes: PRODUCT_NAVIGATION_ROUTES,
  unusedRendererApis: CLASSIFIED_UNUSED_RENDERER_APIS
});

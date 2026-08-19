import { useEffect, useMemo, useReducer, useRef, useState, type CSSProperties, type FormEvent, type ReactNode } from 'react';
import { Button, EmptyState, Modal, PageHeader, SectionHeader, StatRow, StatusMessage, Surface, VisuallyHidden } from './ui';
import { navigationReducer, persistNavigationState, readNavigationState } from './navigation';
import brandMarkUrl from './assets/brand-mark.png';
import { accessibilityAnnouncement, applyAccessibilityProfile, cancelFirstRunNarration, firstRunNarrationContent, isFirstRunIntroductionComplete, nextRovingIndex, parseAccessibilityPreferences, persistBrandAudioMuted, persistFirstRunIntroductionComplete, readBootstrapPreference, readBrandAudioMuted, resolveAccessibilityTheme, serializeAccessibilityPreferences, startFirstRunNarration, writeBootstrapPreference, type AccessibilityAudienceProfile, type AccessibilityPreferences, type BootstrapPreferenceStorage, type FirstRunNarrationStatus } from './accessibility';
import { getActiveUiLocale, localizeNavigationGroup, localizeNavigationLabel, useLocalization } from './localization';
import { AsyncWriteGuard, MutationRevisionWatermark } from './async-state-guard';
import { AsyncStatePanel, ValidationSummary, canUndoGovernedDraft, useGovernedDraft, type ValidationIssue } from './form-ux';
import { resolveRouteAsyncState } from './route-async-state';
import { DEVICE_REAUTHORIZATION_CONFIRMATION, SECURITY_CENTER_LABEL, SECURITY_CENTER_ROUTE, canSubmitDeviceReauthorization, securityCenterNeedsAttention } from './security-center-navigation';
import { FinancePlanningPanel } from './FinancePlanningPanel';
import { LongTermPortfolioPanel } from './LongTermPortfolioPanel';
import { ManagedLifePanel } from './ManagedLifePanel';
import { HouseholdOperationsPanel } from './HouseholdOperationsPanel';
import { ChildEducationCoordinationPanel } from './ChildEducationCoordinationPanel';
import { PlacesTravelAssetPetPanel } from './PlacesTravelAssetPetPanel';
import { LocalGovernedOcrPanel } from './LocalGovernedOcrPanel';
import { FamilyAiAssistantPanel } from './FamilyAiAssistantPanel';
import { MemoryStudioPanel } from './MemoryStudioPanel';
import { SmartHomeEnergyPanel } from './SmartHomeEnergyPanel';
import { SignedPluginPlatformPanel } from './SignedPluginPlatformPanel';
import { CommunicationSecurityPanel } from './CommunicationSecurityPanel';
import { CommunicationMessagingPanel } from './CommunicationMessagingPanel';
import { CommunicationRealtimeCallingPanel } from './CommunicationRealtimeCallingPanel';
import { CommunicationRecordingRetentionPanel } from './CommunicationRecordingRetentionPanel';
import { LocalTranslationLanguagePanel } from './LocalTranslationLanguagePanel';
import { NarratedHelpCenter } from './NarratedHelpCenter';
import { localizeArchiveCenterNode, translateArchiveCenterCopy } from './ArsivMerkeziYerellestirme';
import { localizeDigitalLegacyNode, translateDigitalLegacyCopy } from './DijitalMirasYerellestirme';
import { localizeAiGovernanceNode, translateAiGovernanceCopy } from './YapayZekaYonetisimiYerellestirme';
import { localizeDraftCenterNode, translateDraftCenterCopy } from './TaslakMerkeziYerellestirme';
import { localizeWindowsHelloNode, translateWindowsHelloCopy } from './WindowsHelloYerellestirme';
import { localizeDataLifecycleNode, translateDataLifecycleCopy } from './VeriYasamDongusuYerellestirme';
import { localizeSystemMaintenanceNode } from './SistemBakimYerellestirme';
import { localizePrivacyOwnershipNode } from './GizlilikSahiplikYerellestirme';
import { localizeFamilyFormsNode } from './AileFormlariYerellestirme';
import { localizeOperationsCenterNode } from './YasamSaglikOtomasyonYerellestirme';
import { localizeRepairAndSessionNode } from './VeriOnarmaOturumYerellestirme';
import { localizeHouseholdLifecycleNode } from './HaneKisiDavetYerellestirme';
import { localizeIdentityAccessNode } from './KimlikErisimYerellestirme';
import { localizePermissionsNode } from './YetkilerYerellestirme';
import { FamilyMeetingPanel } from './FamilyMeetingPanel';
import { UniversalUxConsolidationPanel } from './UniversalUxConsolidationPanel';
import { FamilyLocationMap } from './FamilyLocationMap';
import { CommunicationFileSharingPanel } from './CommunicationFileSharingPanel';
import { CommunicationAuditArchivePanel } from './CommunicationAuditArchivePanel';
import { DistributedOperationsPanel } from './DistributedOperationsPanel';
import { HealthCareCoordinationPanel } from './HealthCareCoordinationPanel';
import {
  FAMILY_RELATIONSHIP_CATALOG,
  OBJECT_PERMISSION_ACTIONS,
  PRODUCT_NAVIGATION_GROUPS,
  PRODUCT_NAVIGATION_ROUTES,
  TEMPORARY_CREDENTIAL_DISCLOSURE_RULES,
  TEMPORARY_CREDENTIAL_PURPOSE_BY_KIND,
  USER_VISIBLE_APP_INFO,
  archiveLegacyOwnershipReattestationConfirmation,
  asIsoDateTime,
  asUserId,
  getFamilyRelationship,
  type FamilyRelationshipCategory,
  type FamilyRelationshipCode,
  type UserVisibleAppInfo,
  assessPassword
} from '@ppt/domain/renderer';
import type {
  CreateFamilyEventInput,
  UpdateFamilyEventInput,
  CreateFamilyLocationInput,
  CreateFamilyMemberInput,
  CreateFamilyRelationInput,
  AssignPersonMembershipInput,
  CreateFamilyBranchInput,
  DashboardOverviewView,
  AuthStateView,
  ExternalIdentityProviderView,
  FamilyAppSnapshot,
  FamilySnapshotPatchView,
  FamilySnapshotSection,
  FamilyMutationResultView,
  HouseholdMembershipWorkspaceView,
  PersonLifecycleWorkspaceView,
  UpdatePersonProfileInput,
  HouseholdKind,
  PersonMembershipRole,
  FamilyEventView,
  FamilyMemberView,
  AuditEntryView, AuditIntegrityView,
  LoginInput,
  SetupAdminInput,
  TwoFactorSetupView,
  FamilyAccountView, FamilyInvitationView, FamilyInvitationInspectionView, ObjectPermissionView, FamilyRole, ObjectPermissionAction, FinanceRecordView, HealthRecordView, CreateFinanceRecordInput, CreateHealthRecordInput, MedicationPlanView, CreateMedicationPlanInput, FamilyHealthHistoryView, CreateFamilyHealthHistoryInput, FinanceValuationView, CreateFinanceValuationInput, LifeRecordView, CreateLifeRecordInput, AutomationRuleView, CreateAutomationRuleInput, AutomationRunView, ReportSummaryView, GenealogyInsightView, TrustedDeviceView, SecurityEventReceiptView, SecurityEventReceiptArchiveItemView, SecurityEventReceiptVerificationView, AiConsentView, AiConsentPurpose, AiAccessPreviewView, DigitalLegacyPlanView, LegacyGrantView, LegacyApprovalView, ArchiveSearchInput, ArchiveVersionView, ArchiveRetentionPolicyView, ArchiveRetentionStatusView, ArchiveCategoryView, ArchiveClassificationView, SystemHealthView, BackupTargetView, BackupRunView, PerformanceSampleView, DiagnosticEntryView, MaintenanceResultView, PerformanceTrendView, BackgroundTaskView, SchedulerStatusView, BackupSchedule, QueuedTaskView, MaintenancePolicyView, HealthNotificationView, DiagnosticReportHistoryView, SystemHealthScoreView, SystemHealthHistoryView, SystemHealthTrendView, DiagnosticArchiveView, DiagnosticArchiveVerificationView, DiagnosticReportContentView, DiagnosticReportComparisonView, DiagnosticArchiveContentView, DiagnosticArchiveSearchInput, MaintenanceHistoryView, PerformanceAnomalyView, IpcPerformanceTelemetryView, IpcAdaptiveBudgetMaintenanceAuthorityView, IpcAdaptiveBudgetMaintenanceRecoveryAuthorityView, MaintenanceRecommendationView, ExportArtifactView, BackupInspectionView, BackupPropagationRunView, BackupCleanRewriteStatusView, BackupCleanRewriteRunView, BackupQuarantinePolicyView, BackupQuarantineBatchView, ExternalBackupCopyView, ExternalBackupInventorySummaryView, ExternalBackupCopyKind, ExternalBackupEvidenceIssuerView, ExternalBackupEvidenceIssuerRotationView, ExternalBackupEvidenceRevocationListView, ExternalBackupRevocationEndpointView, RevocationSyncEndpointStateView, ExternalBackupDestructionEvidenceView, DataRetentionPolicyView, DataLifecycleRecordView, DataLifecycleResourceType, FamilyDataImportPreviewView, FamilyDataImportBatchView, GenealogyTreeNodeView, ArchivePageItemView, EventCatalogItemView
} from '@ppt/domain';
import type { AuthorizationContextWorkspaceView, AuthorizationPurpose } from '@ppt/domain';
import type { ArchiveRelationEvidenceConfidence, ArchiveRelationEvidenceHistoryView, ArchiveRelationEvidenceView, UnifiedAuthorizedSearchView } from '@ppt/domain';
import type { OfflineCapability, OfflineCapabilityLeaseWorkspaceView, PrivacyControlCenterView } from '@ppt/domain';
import type { AccessibilityPreferencesView, UpdateAccessibilityPreferencesInput } from '@ppt/domain';
import type { FormDraftWorkspaceView } from '@ppt/domain';
import type { ClientDataAccessBoundaryView } from '@ppt/domain';
import type { NetworkEgressBoundaryView } from '@ppt/domain';
import type { DerivedDataPolicyBoundaryView } from '@ppt/domain';
import type { SensitiveLoggingBoundaryView } from '@ppt/domain';
import type { PolicyDecisionAuditBoundaryView } from '@ppt/domain';
import type { SourceDeletionPropagationBoundaryView } from '@ppt/domain';
import type { PolicyConformanceSuiteBoundaryView } from '@ppt/domain';
import type { PlatformPolicyAstGateBoundaryView } from '@ppt/domain';
import type { PlatformCapabilityManifestGateBoundaryView } from '@ppt/domain';
import type { ApplicationSecurityProfileGateBoundaryView } from '@ppt/domain';
import type { PolicyServiceAvailabilityBoundaryView } from '@ppt/domain';
import type { ProductScreenId, ProductSurfaceGovernanceView } from '@ppt/domain';
import type { DesktopSecurityPostureView, SessionLockStateView, UnlockSessionInput } from '@ppt/domain';
import type { DataRepairEntitySnapshot, DataRepairIssue, DataRepairOperation, DataRepairWorkspaceView } from '@ppt/domain';
import type { LoginWithWindowsHelloInput, WindowsHelloAuthenticationOutcome, WindowsHelloEnrollmentView, WindowsHelloStateView } from '@ppt/domain';
import type { CoreServiceApiBoundaryStatusContract, CoreServiceHealthContract } from '@ppt/core-service-contracts';
import type { SensitiveDataCategory, SensitiveDataConsentPurpose, SensitiveDataProfileView, SensitiveExportPreviewView } from '@ppt/domain';
import type { BankInstitutionView, BankAccountView, CreateBankAccountInput, IbanStructuralValidationView, ValidateIbanInput, PaymentCardView, CreatePaymentCardInput } from '@ppt/domain';
import type { LoanAccountView, CreateLoanAccountInput, RecordLoanPaymentInput } from '@ppt/domain';
import type { FinancePlanningWorkspaceView, RecordFinancePlanningItemInput } from '@ppt/domain';
import type { LongTermPortfolioWorkspaceView, RecordLongTermPortfolioItemInput } from '@ppt/domain';
import type { ManagedLifeWorkspaceView, RecordManagedLifeItemInput } from '@ppt/domain';
import type { PrivacyOwnershipControlCenterView } from '@ppt/domain';
import type {
  CompanionSyncDenialView,
  FederatedAuthorizationCeremonyView,
  FederatedIdentityProvider,
  IdentityAccessCredentialCenterView,
  IdentityAccessOperationKind,
  IssuedTemporaryVerifiableCredentialView,
  PasskeyChallengeView,
  PasskeyTransport,
  ReadOnlyCompanionSnapshotView,
  TemporaryCredentialClaimKey,
  TemporaryCredentialKind,
  TemporaryCredentialVerificationView
} from '@ppt/domain';

type ReleaseChannel = 'bronze' | 'silver' | 'gold';
const releaseChannelFromInfo = (channel: UserVisibleAppInfo['channel']): ReleaseChannel => {
  if (channel === 'Gold') return 'gold';
  if (channel === 'Silver') return 'silver';
  return 'bronze';
};

type ScreenId = ProductScreenId;

const navItems: ReadonlyArray<{ readonly id: ScreenId; readonly label: string; readonly icon: string }> =
  PRODUCT_NAVIGATION_ROUTES.map(({ id, label, icon }) => ({ id, label, icon }));

const navGroups: ReadonlyArray<{ readonly id: (typeof PRODUCT_NAVIGATION_GROUPS)[number]['id']; readonly label: string; readonly items: readonly ScreenId[] }> =
  PRODUCT_NAVIGATION_GROUPS.map((group) => ({
    id: group.id,
    label: group.label,
    items: PRODUCT_NAVIGATION_ROUTES
      .filter((route) => route.groupId === group.id)
      .map((route) => route.id)
  }));

const browserPreferenceStorage = (): BootstrapPreferenceStorage | undefined => {
  try {
    return globalThis.localStorage;
  } catch {
    return undefined;
  }
};

const browserSpeechSynthesis = (): SpeechSynthesis | undefined => {
  try {
    return globalThis.speechSynthesis;
  } catch {
    return undefined;
  }
};

const readSidebarState = (): boolean =>
  readBootstrapPreference(browserPreferenceStorage(), 'ppt-sidebar-collapsed') === 'true';

const readAccessibilityPreferences = (): AccessibilityPreferences => {
  const storage = browserPreferenceStorage();
  const raw = readBootstrapPreference(storage, 'ppt-accessibility');
  const parsed = parseAccessibilityPreferences(raw, {
    highContrast: globalThis.matchMedia?.('(prefers-contrast: more)').matches ?? false,
    reduceMotion: globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false
  });
  const legacyTheme = readBootstrapPreference(storage, 'ppt-theme');
  let resolved:AccessibilityPreferences=parsed;
  if(!raw?.includes('"theme"')&&(legacyTheme==='light'||legacyTheme==='dark'))resolved={...parsed,theme:legacyTheme};
  return raw?.includes('"audioMuted"')
    ? resolved
    : { ...resolved, audioMuted:readBrandAudioMuted(storage, resolved.audioMuted) };
};

const rendererAccessibilityPreferences = (
  value: AccessibilityPreferencesView
): AccessibilityPreferences => ({
  textScale:value.textScale,textScalePercent:value.textScalePercent,
  highContrast:value.highContrast,reduceMotion:value.reduceMotion,theme:value.theme,
  density:value.density,readingMode:value.readingMode,audienceProfile:value.audienceProfile,
  captionsEnabled:value.captionsEnabled,audioMuted:value.audioMuted
});

const shellPreviewMode = import.meta.env.DEV && new URLSearchParams(globalThis.location?.search ?? '').has('shell-preview');

const fallbackSnapshot: FamilyAppSnapshot = {
  family: { id: 'family-main', name: 'Ailem' },
  people: [],
  relations: [],
  locations: [],
  events: [],
  notifications: [],
  lastUpdatedAt: new Date().toISOString()
};

const snapshotFromOverview = (overview: DashboardOverviewView): FamilyAppSnapshot => ({
  family: overview.family,
  people: [],
  relations: [],
  locations: [],
  events: [],
  notifications: [],
  lastUpdatedAt: overview.lastActivityAt
});

const mergeSnapshotPatch = (current: FamilyAppSnapshot, patch: FamilySnapshotPatchView): FamilyAppSnapshot => ({
  family: patch.family,
  people: patch.people ? [...patch.people] : current.people,
  relations: patch.relations ? [...patch.relations] : current.relations,
  locations: patch.locations ? [...patch.locations] : current.locations,
  events: patch.events ? [...patch.events] : current.events,
  notifications: patch.notifications ? [...patch.notifications] : current.notifications,
  lastUpdatedAt: patch.lastUpdatedAt
});

const formatDate = (iso: string, options?: Intl.DateTimeFormatOptions): string =>
  new Intl.DateTimeFormat(getActiveUiLocale(), options ?? { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(iso));

const yearsOld = (birthDate: string | undefined, language: 'tr' | 'en' = getActiveUiLocale() === 'tr-TR' ? 'tr' : 'en'): string => {
  if (!birthDate) return language === 'tr' ? 'Yaş bilgisi yok' : 'Age unavailable';
  const today = new Date();
  const birth = new Date(birthDate);
  let age = today.getFullYear() - birth.getFullYear();
  if (today < new Date(today.getFullYear(), birth.getMonth(), birth.getDate())) age -= 1;
  return language === 'tr' ? `${age} yaş` : `${age} years old`;
};


const fallbackDashboardOverview = (snapshot: FamilyAppSnapshot): DashboardOverviewView => {
  const now = Date.now();
  const upcoming = snapshot.events.filter((event) => event.kind === 'important_day' && new Date(event.startAt).getTime() >= now).toSorted((a,b)=>a.startAt.localeCompare(b.startAt));
  const moduleCount = (id: DashboardOverviewView['modules'][number]['id']): number => ({
    family:snapshot.people.length, tree:snapshot.relations.length, timeline:snapshot.events.length,
    'important-days':snapshot.events.filter((event)=>event.kind==='important_day').length, archive:0, finance:0, health:0,
    'life-center':0, automation:0, reports:snapshot.events.length, location:snapshot.locations.length, permissions:1, ai:0, legacy:0, settings:1
  })[id];
  const labels: Record<DashboardOverviewView['modules'][number]['id'],string> = {
    family:'Aile',tree:'Soy Ağacı',timeline:'Zaman Tüneli','important-days':'Önemli Günler',archive:'Arşiv',finance:'Finans',health:'Sağlık',
    'life-center':'Yaşam Merkezi',automation:'Bildirim ve Otomasyon',reports:'Raporlama',location:'Konum',permissions:'Yetkiler',ai:'Yapay Zekâ',legacy:'Dijital Miras',settings:'Ayarlar'
  };
  return {
    family:snapshot.family, memberCount:snapshot.people.length, generationCount:new Set(snapshot.people.map((person)=>person.generation)).size,
    upcomingImportantDayCount:upcoming.length, ...(upcoming[0]?{nextImportantDayInDays:Math.max(0,Math.ceil((new Date(upcoming[0].startAt).getTime()-now)/86_400_000))}:{}),
    timelineEventCount:snapshot.events.length, relatedContentCount:snapshot.events.reduce((sum,event)=>sum+event.attachmentCount,0), notificationCount:snapshot.notifications.length,
    upcomingImportantDays:upcoming.slice(0,6), recentEvents:snapshot.events.toSorted((a,b)=>b.startAt.localeCompare(a.startAt)).slice(0,4),
    modules:(Object.keys(labels) as Array<keyof typeof labels>).map((id)=>({id,label:labels[id],recordCount:moduleCount(id),state:moduleCount(id)>0?'ready':'empty',detail:moduleCount(id)>0?'Modül verisi hazır':'Kayıt bekleniyor'})),
    generatedAt:new Date().toISOString(), lastActivityAt:snapshot.lastUpdatedAt
  };
};

export function Dashboard({ overview, onNavigate, onAddMember, onAddImportantDay }: { overview: DashboardOverviewView; onNavigate: (id: ScreenId) => void; onAddMember:()=>void; onAddImportantDay:()=>void }) {
  const { language } = useLocalization();
  const text = (tr: string, en: string): string => language === 'tr' ? tr : en;
  const readyModules = overview.modules.filter((module) => module.state === 'ready').length;
  const attentionModules = overview.modules.filter((module) => module.state === 'attention');
  const moduleCount=(id:DashboardOverviewView['modules'][number]['id'])=>overview.modules.find(module=>module.id===id)?.recordCount??0;
  const justStarted=overview.memberCount===1&&moduleCount('tree')===0&&moduleCount('timeline')===0&&moduleCount('location')===0;
  if(justStarted)return <>
    <PageHeader eyebrow={overview.family.name} title={text('Aile alanınız hazır','Your family space is ready')} description={text('İlk kayıtları birlikte oluşturalım. Eklediğiniz her bilgi yalnız bu bilgisayarda saklanır.','Let’s create the first records together. Everything you add is stored only on this computer.')}/>
    <section className="welcome-panel panel">
      <div className="welcome-copy"><span className="eyebrow">{text('Hoş geldiniz','Welcome')}</span><h2>{text('Aile hikâyeniz burada başlıyor.','Your family story starts here.')}</h2><p>{text('Önce aile üyelerinizi ekleyin, aralarındaki bağları kurun; ardından önemli günleri ve anıları kaydedin.','First add family members and connect their relationships, then record important dates and memories.')}</p><div className="welcome-actions"><Button tone="primary" onClick={onAddMember}>{text('＋ İlk aile üyesini ekle','＋ Add the first family member')}</Button><Button onClick={onAddImportantDay}>{text('□ Önemli gün oluştur','□ Create an important date')}</Button></div></div>
      <div className="welcome-mark" aria-hidden="true"><span>♙</span><i/><span>♙</span><i/><span>♙</span></div>
    </section>
    <section className="onboarding-grid">
      <button className="onboarding-card done" onClick={()=>onNavigate('family')}><span>✓</span><small>{text('1. adım','Step 1')}</small><strong>{text('Aile alanı oluşturuldu','Family space created')}</strong><p>{text('Yerel yönetici profiliniz güvenli biçimde hazır.','Your local administrator profile is securely ready.')}</p></button>
      <button className="onboarding-card active" onClick={onAddMember}><span>＋</span><small>{text('2. adım','Step 2')}</small><strong>{text('Aile üyelerini ekleyin','Add family members')}</strong><p>{text('Eş, çocuk, anne, baba ve diğer yakınlarınızı kaydedin.','Record spouses, children, parents, and other relatives.')}</p></button>
      <button className="onboarding-card" onClick={()=>onNavigate('tree')}><span>⌘</span><small>{text('3. adım','Step 3')}</small><strong>{text('Aile bağlarını kurun','Connect family relationships')}</strong><p>{text('Kişileri birbirine bağlayarak soy ağacınızı oluşturun.','Build your family tree by connecting people.')}</p></button>
      <button className="onboarding-card" onClick={onAddImportantDay}><span>□</span><small>{text('4. adım','Step 4')}</small><strong>{text('İlk önemli günü ekleyin','Add the first important date')}</strong><p>{text('Doğum günü, buluşma ve özel anları unutmayın.','Remember birthdays, gatherings, and special moments.')}</p></button>
    </section>
    <section className="privacy-reminder panel"><span>◉</span><div><strong>{text('Yerel ve size ait','Local and yours')}</strong><p>{text('Bulut hesabı yok. E-posta girişi yok. Verileriniz sizin belirlediğiniz yedekler dışında bu bilgisayardan ayrılmaz.','No cloud account. No email sign-in. Your data never leaves this computer except through backups you explicitly choose.')}</p></div><Button onClick={()=>onNavigate('settings')}>{text('Yedeklemeyi ayarla','Configure backup')}</Button></section>
  </>;
  return (
    <>
      <PageHeader eyebrow={overview.family.name} title={text('Aile yaşamı panosu','Family life dashboard')} description={text('Ailenizin kayıtları, yaklaşan günleri ve dijital hafızası tek yerde.','Your family records, upcoming dates, and digital memory in one place.')} />
      <section className="metric-grid">
        <article className="metric-card"><span className="metric-icon blue">♙</span><div><small>{text('Aile üyeleri','Family members')}</small><strong>{overview.memberCount}</strong><p>{language==='tr'?`${overview.generationCount} nesil kayıtlı`:`${overview.generationCount} generations recorded`}</p></div></article>
        <article className="metric-card"><span className="metric-icon red">□</span><div><small>{text('Yaklaşan önemli gün','Upcoming important date')}</small><strong>{overview.upcomingImportantDayCount}</strong><p>{overview.nextImportantDayInDays === undefined ? text('Yeni kayıt bekleniyor','Awaiting a new record') : language==='tr'?`${overview.nextImportantDayInDays} gün içinde`:`in ${overview.nextImportantDayInDays} days`}</p></div></article>
        <article className="metric-card"><span className="metric-icon green">◷</span><div><small>{text('Zaman tüneli','Timeline')}</small><strong>{overview.timelineEventCount}</strong><p>{text('Kişisel ve aile olayları','Personal and family events')}</p></div></article>
        <article className="metric-card"><span className="metric-icon amber">▣</span><div><small>{text('İlişkili içerik','Related content')}</small><strong>{overview.relatedContentCount}</strong><p>{text('Fotoğraf, davetiye, belge ve arşiv','Photos, invitations, documents, and archive items')}</p></div></article>
      </section>
      <section className="dashboard-grid">
        <article className="panel upcoming-card">
          <div className="panel-heading"><div><span className="eyebrow">{text('Takvim','Calendar')}</span><h2>{text('Yaklaşan önemli günler','Upcoming important dates')}</h2></div><button className="text-button" onClick={() => onNavigate('important-days')}>{text('Tümünü gör','View all')}</button></div>
          <div className="stack-list">
            {overview.upcomingImportantDays.length === 0 && <EmptyState title={text('Yaklaşan gün yok','No upcoming dates')} body={text('Yeni bir önemli gün ekleyerek başlayın.','Start by adding an important date.')} />}
            {overview.upcomingImportantDays.slice(0, 4).map((event) => <EventListItem event={event} key={event.id} />)}
          </div>
        </article>
        <article className="panel timeline-card">
          <div className="panel-heading"><div><span className="eyebrow">{text('Aile hafızası','Family memory')}</span><h2>{text('Son zaman tüneli kayıtları','Latest timeline records')}</h2></div><button className="text-button" onClick={() => onNavigate('timeline')}>{text('Zaman tüneline git','Open timeline')}</button></div>
          <div className="mini-timeline">
            {overview.recentEvents.map((event) => (
              <div className="mini-timeline-row" key={event.id}><span className="timeline-dot" /><time>{formatDate(event.startAt)}</time><div><strong>{event.title}</strong><p>{event.description}</p><small>⌖ {event.locationLabel ?? text('Konum eklenmemiş','No location added')} · {language==='tr'?`${event.attachmentCount} içerik`:`${event.attachmentCount} items`}</small></div></div>
            ))}
          </div>
        </article>
        <article className="panel ai-card">
          <div className="ai-orb">✣</div><span className="eyebrow">{text('Ana merkez durumu','Main center status')}</span><h2>{language==='tr'?`${readyModules}/${overview.modules.length} modül veri almaya hazır`:`${readyModules}/${overview.modules.length} modules ready for data`}</h2>
          <p>{attentionModules.length > 0 ? (language==='tr'?`${attentionModules.length} modül dikkat bekliyor.`:`${attentionModules.length} modules need attention.`) : text('Kritik bekleyen modül uyarısı bulunmuyor.','There are no critical pending module alerts.')}</p>
          <div className="module-readiness">{overview.modules.slice(0,6).map((module)=><button key={module.id} onClick={()=>onNavigate(module.id as ScreenId)}><span className={`module-state ${module.state}`} /> <strong>{localizeNavigationLabel(module.id,module.label)}</strong><small>{module.recordCount>0?text('Modül verisi hazır','Module data ready'):text('Kayıt bekleniyor','Awaiting records')}</small></button>)}</div>
          <Button onClick={() => onNavigate('settings')}>{text('Sistem merkezini aç','Open system center')}</Button>
        </article>
        <article className="panel quick-actions">
          <span className="eyebrow">{text('Hızlı işlemler','Quick actions')}</span><h2>{text('Bugün ne yapmak istersiniz?','What would you like to do today?')}</h2>
          <button onClick={() => onNavigate('family')}><span>＋</span><div><strong>{text('Aile üyesi ekle','Add family member')}</strong><small>{text('Kişi ve üyelik kaydı','Person and membership record')}</small></div></button>
          <button onClick={() => onNavigate('important-days')}><span>□</span><div><strong>{text('Önemli gün oluştur','Create important date')}</strong><small>{text('Yer, davetiye ve katılımcılar','Place, invitation, and participants')}</small></div></button>
          <button onClick={() => onNavigate('tree')}><span>⌘</span><div><strong>{text('Soy ağacını incele','Review family tree')}</strong><small>{text('Nesiller ve aile dalları','Generations and family branches')}</small></div></button>
        </article>
      </section>
    </>
  );
}

function EventListItem({ event, selected, onClick }: { event: FamilyEventView; selected?: boolean; onClick?: () => void }) {
  const { language, locale } = useLocalization();
  const date = new Date(event.startAt);
  return (
    <button className={`event-list-item ${selected ? 'selected' : ''}`} onClick={onClick}>
      <span className="calendar-tile"><small>{date.toLocaleDateString(locale, { month: 'short' }).toLocaleUpperCase(locale)}</small><strong>{date.getDate()}</strong></span>
      <span className="event-copy"><strong>{event.title}</strong><small>{formatDate(event.startAt, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</small></span>
      <span className="event-location">⌖ {event.locationLabel ?? (language==='tr'?'Konum yok':'No location')}</span>
    </button>
  );
}

const mergeCatalogItems = <T extends { id: string }>(...groups: ReadonlyArray<readonly T[]>): T[] => {
  const byId = new Map<string, T>();
  for (const group of groups) for (const item of group) byId.set(item.id, item);
  return [...byId.values()];
};

function usePersonCatalogData(query: string, selectedIds: readonly string[] = [], fallbackPeople: readonly FamilyMemberView[] = [], revision = 0) {
  const [items, setItems] = useState<FamilyMemberView[]>([]);
  const [nextCursor, setNextCursor] = useState<string>();
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const guardRef = useRef(new AsyncWriteGuard());
  const selectedKey = selectedIds.join('|');
  const load = async (reset: boolean, cursor?: string) => {
    const ticket = guardRef.current.start('person-page');
    setLoading(true); setError('');
    try {
      if (window.pardus) {
        const page = await window.pardus.listPersonCatalog({ limit: 30, ...(query.trim() ? { query: query.trim() } : {}), ...(cursor ? { cursor } : {}) });
        guardRef.current.commit(ticket, () => {
          setItems((current) => reset ? mergeCatalogItems(current.filter((item) => selectedIds.includes(item.id)), page.items) : mergeCatalogItems(current, page.items));
          setNextCursor(page.nextCursor); setHasMore(page.hasMore);
        });
      } else {
        const normalized = query.trim().toLocaleLowerCase('tr-TR');
        const matches = fallbackPeople.filter((person) => !normalized || person.displayName.toLocaleLowerCase('tr-TR').includes(normalized)).slice(0, 100);
        guardRef.current.commit(ticket, () => {
          setItems((current) => mergeCatalogItems(current.filter((item) => selectedIds.includes(item.id)), matches));
          setNextCursor(undefined); setHasMore(false);
        });
      }
    } catch (caught) {
      guardRef.current.commit(ticket, () => setError(caught instanceof Error ? caught.message : getActiveUiLocale()==='tr-TR'?'Kişi kataloğu yüklenemedi.':'The person catalog could not be loaded.'));
    } finally {
      guardRef.current.commit(ticket, () => setLoading(false));
    }
  };
  useEffect(() => {
    guardRef.current.invalidate('person-page');
    const timer = globalThis.setTimeout(() => { void load(true); }, 220);
    return () => { globalThis.clearTimeout(timer); guardRef.current.invalidate('person-page'); };
  }, [query, revision]);
  useEffect(() => {
    guardRef.current.invalidate('person-lookup');
    if (!window.pardus || !selectedIds.length) return;
    const missing = selectedIds.filter((id) => !items.some((item) => item.id === id));
    if (!missing.length) return;
    const ticket = guardRef.current.start('person-lookup');
    void window.pardus.lookupEntityCatalog({ personIds: missing }).then((result) => {
      guardRef.current.commit(ticket, () => setItems((current) => mergeCatalogItems(current, result.people)));
    }).catch((caught) => {
      guardRef.current.commit(ticket, () => setError(caught instanceof Error ? caught.message : getActiveUiLocale()==='tr-TR'?'Seçili kişiler çözümlenemedi.':'The selected people could not be resolved.'));
    });
    return () => { guardRef.current.invalidate('person-lookup'); };
  }, [selectedKey]);
  useEffect(() => () => guardRef.current.invalidateAll(), []);
  return { items, nextCursor, hasMore, loading, error, reload: () => load(true), loadMore: () => nextCursor ? load(false, nextCursor) : Promise.resolve() };
}

function PersonCatalogSelect({ label, value, onChange, allowEmpty = false, excludeIds = [], fallbackPeople = [] }: { label: string; value: string; onChange: (value: string) => void; allowEmpty?: boolean; excludeIds?: readonly string[]; fallbackPeople?: readonly FamilyMemberView[] }) {
  const { language } = useLocalization();
  const text=(tr:string,en:string)=>language==='tr'?tr:en;
  const [query, setQuery] = useState('');
  const catalog = usePersonCatalogData(query, value ? [value] : [], fallbackPeople);
  const options = catalog.items.filter((person) => person.id === value || !excludeIds.includes(person.id));
  useEffect(() => { if (!value && !allowEmpty && options[0]) onChange(options[0].id); }, [options.length, value, allowEmpty]);
  return <div className="catalog-field"><label>{label}<input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder={text('Kişi ara…','Search people…')}/></label><select value={value} onChange={(event) => onChange(event.target.value)}>{allowEmpty&&<option value="">{text('Seçim yok','No selection')}</option>}{options.map((person)=><option key={person.id} value={person.id}>{person.displayName} · {person.relationshipType}</option>)}</select>{catalog.error&&<small className="catalog-error">{catalog.error}</small>}{catalog.hasMore&&<button type="button" className="catalog-more" disabled={catalog.loading} onClick={()=>void catalog.loadMore()}>{catalog.loading?text('Yükleniyor…','Loading…'):text('Daha fazla kişi','More people')}</button>}</div>;
}

function PersonCatalogMultiPicker({ selectedIds, onChange, fallbackPeople = [] }: { selectedIds: readonly string[]; onChange: (ids: string[]) => void; fallbackPeople?: readonly FamilyMemberView[] }) {
  const { language } = useLocalization();
  const text=(tr:string,en:string)=>language==='tr'?tr:en;
  const [query, setQuery] = useState('');
  const catalog = usePersonCatalogData(query, selectedIds, fallbackPeople);
  const toggle = (id: string) => onChange(selectedIds.includes(id) ? selectedIds.filter((item) => item !== id) : [...selectedIds, id]);
  const selectedPeople = selectedIds.map((id) => catalog.items.find((item) => item.id === id)).filter((item): item is FamilyMemberView => Boolean(item));
  return <fieldset className="span-2 participant-fieldset catalog-participants"><legend>{text('Katılımcılar','Participants')}</legend><input type="search" value={query} onChange={(event)=>setQuery(event.target.value)} placeholder={text('Katılımcı ara…','Search participants…')} aria-label={text('Katılımcı ara','Search participants')}/><div className="catalog-selected">{selectedPeople.map((person)=><button type="button" key={person.id} onClick={()=>toggle(person.id)}>{person.displayName} ×</button>)}</div><div className="catalog-options">{catalog.items.map((person)=><label key={person.id}><input type="checkbox" checked={selectedIds.includes(person.id)} onChange={()=>toggle(person.id)}/>{person.displayName}</label>)}</div>{catalog.error&&<small className="catalog-error">{catalog.error}</small>}{catalog.hasMore&&<button type="button" className="catalog-more" disabled={catalog.loading} onClick={()=>void catalog.loadMore()}>{catalog.loading?text('Yükleniyor…','Loading…'):text('Daha fazla kişi','More people')}</button>}</fieldset>;
}

function EventCatalogSelect({ label, value, onChange, allowEmpty = true, archiveMode = 'all', fallbackEvents = [] }: { label: string; value: string; onChange: (value: string) => void; allowEmpty?: boolean; archiveMode?: 'active'|'archived'|'all'; fallbackEvents?: readonly FamilyEventView[] }) {
  const { language } = useLocalization();
  const text=(tr:string,en:string)=>language==='tr'?tr:en;
  const [query,setQuery]=useState(''); const [items,setItems]=useState<EventCatalogItemView[]>([]); const [nextCursor,setNextCursor]=useState<string>(); const [hasMore,setHasMore]=useState(false); const [loading,setLoading]=useState(false); const [error,setError]=useState(''); const guardRef=useRef(new AsyncWriteGuard());
  const load=async(reset:boolean,cursor?:string)=>{const ticket=guardRef.current.start('event-page');setLoading(true);setError('');try{if(window.pardus){const page=await window.pardus.listEventCatalog({limit:30,archiveMode,...(query.trim()?{query:query.trim()}:{}),...(cursor?{cursor}:{})});guardRef.current.commit(ticket,()=>{setItems(current=>reset?mergeCatalogItems(current.filter(item=>item.id===value),page.items):mergeCatalogItems(current,page.items));setNextCursor(page.nextCursor);setHasMore(page.hasMore);});}else{const normalized=query.trim().toLocaleLowerCase(getActiveUiLocale());const rows=fallbackEvents.filter(event=>!normalized||event.title.toLocaleLowerCase(getActiveUiLocale()).includes(normalized)).slice(0,100).map(event=>({id:event.id,title:event.title,kind:event.kind,startAt:event.startAt,...(event.archivedAt?{archivedAt:event.archivedAt}:{})}));guardRef.current.commit(ticket,()=>{setItems(current=>mergeCatalogItems(current.filter(item=>item.id===value),rows));setNextCursor(undefined);setHasMore(false);});}}catch(caught){guardRef.current.commit(ticket,()=>setError(caught instanceof Error?caught.message:text('Olay kataloğu yüklenemedi.','The event catalog could not be loaded.')));}finally{guardRef.current.commit(ticket,()=>setLoading(false));}};
  useEffect(()=>{guardRef.current.invalidate('event-page');const timer=globalThis.setTimeout(()=>void load(true),220);return()=>{globalThis.clearTimeout(timer);guardRef.current.invalidate('event-page');};},[query,archiveMode]);
  useEffect(()=>{guardRef.current.invalidate('event-lookup');if(!window.pardus||!value||items.some(item=>item.id===value))return;const ticket=guardRef.current.start('event-lookup');void window.pardus.lookupEntityCatalog({eventIds:[value]}).then(result=>{guardRef.current.commit(ticket,()=>setItems(current=>mergeCatalogItems(current,result.events)));}).catch(caught=>{guardRef.current.commit(ticket,()=>setError(caught instanceof Error?caught.message:text('Seçili olay çözümlenemedi.','The selected event could not be resolved.')));});return()=>{guardRef.current.invalidate('event-lookup');};},[value,language]);
  useEffect(()=>()=>guardRef.current.invalidateAll(),[]);
  return <div className="catalog-field"><label>{label}<input type="search" value={query} onChange={event=>setQuery(event.target.value)} placeholder={text('Olay ara…','Search events…')}/></label><select value={value} onChange={event=>onChange(event.target.value)}>{allowEmpty&&<option value="">{text('Tüm olaylar','All events')}</option>}{items.map(item=><option key={item.id} value={item.id}>{item.title} · {formatDate(item.startAt,{dateStyle:'short'})}</option>)}</select>{error&&<small className="catalog-error">{error}</small>}{hasMore&&<button type="button" className="catalog-more" disabled={loading} onClick={()=>void load(false,nextCursor)}>{loading?text('Yükleniyor…','Loading…'):text('Daha fazla olay','More events')}</button>}</div>;
}

export function FamilyScreen({ onAdd, revision = 0 }: { onAdd: () => void; revision?: number }) {
  const { language } = useLocalization();
  const text=(tr:string,en:string)=>language==='tr'?tr:en;
  const [query,setQuery]=useState(''); const [selectedId,setSelectedId]=useState(''); const catalog=usePersonCatalogData(query,selectedId?[selectedId]:[],[],revision); const selected=catalog.items.find(person=>person.id===selectedId)??catalog.items[0]; const [relatedEvents,setRelatedEvents]=useState<EventCatalogItemView[]>([]); const [relatedError,setRelatedError]=useState(''); const relatedGuardRef=useRef(new AsyncWriteGuard());
  useEffect(()=>{if(!selectedId&&catalog.items[0])setSelectedId(catalog.items[0].id);},[catalog.items.length,selectedId]);
  useEffect(()=>{relatedGuardRef.current.invalidate('related-events');if(!selected){setRelatedEvents([]);return;}const ticket=relatedGuardRef.current.start('related-events');setRelatedError('');void (async()=>{try{if(window.pardus){const page=await window.pardus.listEventCatalog({limit:10,personId:selected.id,archiveMode:'active'});relatedGuardRef.current.commit(ticket,()=>setRelatedEvents(page.items));}else relatedGuardRef.current.commit(ticket,()=>setRelatedEvents([]));}catch(caught){relatedGuardRef.current.commit(ticket,()=>setRelatedError(caught instanceof Error?caught.message:text('İlişkili olaylar yüklenemedi.','Related events could not be loaded.')));}})();return()=>relatedGuardRef.current.invalidate('related-events');},[selected?.id,revision,language]);
  useEffect(()=>()=>relatedGuardRef.current.invalidateAll(),[]);
  return <><PageHeader eyebrow={text('Aile kimliği','Family identity')} title={text('Aile üyeleri','Family members')} description={text('Kişiler arama destekli katalogdan sınırlı sayfalar hâlinde yüklenir; seçim sırasında tüm aile listesi belleğe alınmaz.','People are loaded in bounded pages from a searchable catalog; the complete family list is not loaded into memory during selection.')} actions={<Button tone="primary" onClick={onAdd}>{text('＋ Üye ekle','＋ Add member')}</Button>}/><section className="family-layout"><article className="panel member-list-panel"><div className="panel-heading"><div><span className="eyebrow">{language==='tr'?`${catalog.items.length} kişi yüklendi`:`${catalog.items.length} people loaded`}</span><h2>{text('Üyeler','Members')}</h2></div></div><input className="catalog-search" type="search" value={query} onChange={event=>setQuery(event.target.value)} placeholder={text('Aile üyesi ara…','Search family members…')}/><div className="member-list">{catalog.items.map(person=><button className={selected?.id===person.id?'selected':''} key={person.id} onClick={()=>setSelectedId(person.id)}><span className="person-avatar">{person.initials}</span><span><strong>{person.displayName}</strong><small>{person.relationshipType} · {yearsOld(person.birthDate,language)}</small></span><i className="status-dot"/></button>)}</div>{catalog.error&&<StatusMessage tone="danger">{catalog.error}</StatusMessage>}{catalog.hasMore&&<div className="large-data-load-more"><Button disabled={catalog.loading} onClick={()=>void catalog.loadMore()}>{catalog.loading?text('Yükleniyor…','Loading…'):text('Sonraki 30 kişiyi yükle','Load the next 30 people')}</Button></div>}</article>{selected&&<article className="panel person-detail"><div className="person-hero"><span className="person-avatar xl">{selected.initials}</span><div><span className="tag success">{text('Aktif üye','Active member')}</span><h2>{selected.displayName}</h2><p>{selected.relationshipType} · {selected.branch}</p></div></div><div className="detail-grid"><div><small>{text('Doğum tarihi','Birth date')}</small><strong>{selected.birthDate?formatDate(selected.birthDate):text('Belirtilmedi','Not specified')}</strong></div><div><small>{text('Nesil','Generation')}</small><strong>{language==='tr'?`${selected.generation}. nesil`:`Generation ${selected.generation}`}</strong></div><div><small>{text('Aile dalı','Family branch')}</small><strong>{selected.branch}</strong></div><div><small>{text('Durum','Status')}</small><strong>{text('Aktif','Active')}</strong></div></div><div className="related-events"><div className="panel-heading"><div><span className="eyebrow">{text('Sınırlı katalog','Bounded catalog')}</span><h3>{text('İlişkili olaylar','Related events')}</h3></div></div>{relatedEvents.map(event=><div className="catalog-event-row" key={event.id}><strong>{event.title}</strong><small>{formatDate(event.startAt,{dateStyle:'medium'})}</small></div>)}{!relatedEvents.length&&!relatedError&&<small>{text('İlişkili olay bulunamadı.','No related events found.')}</small>}{relatedError&&<StatusMessage tone="danger">{relatedError}</StatusMessage>}</div></article>}</section></>;
}

export function TreeScreen({ snapshot, onAddRelation }: { snapshot: FamilyAppSnapshot; onAddRelation: () => void }) {
  const { language, locale } = useLocalization();
  const text=(tr:string,en:string)=>language==='tr'?tr:en;
  const [zoom, setZoom] = useState(1);
  const [insights,setInsights]=useState<GenealogyInsightView>();
  const [items,setItems]=useState<GenealogyTreeNodeView[]>([]);
  const [query,setQuery]=useState('');
  const [branch,setBranch]=useState('');
  const [generation,setGeneration]=useState('');
  const [nextCursor,setNextCursor]=useState<string>();
  const [hasMore,setHasMore]=useState(false);
  const [loadingPage,setLoadingPage]=useState(false);
  const [pageMessage,setPageMessage]=useState('');
  const [metrics,setMetrics]=useState<{returned:number;scanned:number;queryDurationMs:number;limit:number}>();
  const guardRef=useRef(new AsyncWriteGuard());
  const branchOptions=[...new Set(snapshot.people.map(person=>person.branch))].toSorted((a,b)=>a.localeCompare(b,locale));
  const generationOptions=[...new Set(snapshot.people.map(person=>person.generation))].toSorted((a,b)=>a-b);
  const loadPage=async(reset:boolean,cursor?:string)=>{
    const ticket=guardRef.current.start('tree-page');setLoadingPage(true);setPageMessage('');
    try{
      if(window.pardus){
        const page=await window.pardus.listLargeGenealogyTree({limit:80,...(query.trim()?{query:query.trim()}:{}),...(branch?{branch}:{}),...(generation?{generation:Number(generation)}:{}),...(cursor?{cursor}:{})});
        guardRef.current.commit(ticket,()=>{setItems(current=>reset?page.items:[...current,...page.items]);setNextCursor(page.nextCursor);setHasMore(page.hasMore);setMetrics(page.metrics);});
      }else{
        const fallback=snapshot.people.filter(person=>!query.trim()||person.displayName.toLocaleLowerCase(locale).includes(query.trim().toLocaleLowerCase(locale))).filter(person=>!branch||person.branch===branch).filter(person=>!generation||person.generation===Number(generation)).slice(0,200).map(person=>({...person,relationCount:snapshot.relations.filter(relation=>relation.fromPersonId===person.id||relation.toPersonId===person.id).length,parentCount:0,childCount:0}));
        guardRef.current.commit(ticket,()=>{setItems(fallback);setNextCursor(undefined);setHasMore(false);setMetrics({returned:fallback.length,scanned:fallback.length,queryDurationMs:0,limit:200});});
      }
    }catch(error){guardRef.current.commit(ticket,()=>setPageMessage(error instanceof Error?error.message:text('Soy ağacı sayfası yüklenemedi.','The family-tree page could not be loaded.')));}
    finally{guardRef.current.commit(ticket,()=>setLoadingPage(false));}
  };
  useEffect(()=>{guardRef.current.invalidate('tree-insights');if(!window.pardus)return;const ticket=guardRef.current.start('tree-insights');void window.pardus.getGenealogyInsights().then(value=>{guardRef.current.commit(ticket,()=>setInsights(value));});return()=>guardRef.current.invalidate('tree-insights');},[snapshot.lastUpdatedAt]);
  useEffect(()=>{guardRef.current.invalidate('tree-page');void loadPage(true);return()=>guardRef.current.invalidate('tree-page');},[snapshot.lastUpdatedAt]);
  useEffect(()=>()=>guardRef.current.invalidateAll(),[]);
  const updateZoom = (next: number) => setZoom(Math.min(1.35, Math.max(.7, Number(next.toFixed(2)))));
  const generations=[...new Set(items.map(person=>person.generation))].toSorted((a,b)=>a-b);
  return (
    <>
      <PageHeader eyebrow={snapshot.family.name} title={text('Soy ağacı','Family tree')} description={text('Büyük ailelerde kişi kartları ana işlemciyi yormadan sayfalar hâlinde yüklenir; nesil, dal ve ad filtresi sunucu tarafında uygulanır.','For large families, person cards load in pages without overloading the main process; generation, branch, and name filters run on the server side.')} actions={<Button tone="primary" onClick={onAddRelation}>{text('＋ İlişki ekle','＋ Add relationship')}</Button>} />
      <section className="tree-performance-toolbar panel" aria-label={text('Büyük soy ağacı filtreleri','Large family-tree filters')}>
        <label>{text('Kişi ara','Search people')}<input type="search" value={query} onChange={event=>setQuery(event.target.value)} placeholder={text('Ad veya soyad','First or last name')}/></label>
        <label>{text('Aile dalı','Family branch')}<select value={branch} onChange={event=>setBranch(event.target.value)}><option value="">{text('Tüm dallar','All branches')}</option>{branchOptions.map(value=><option key={value}>{value}</option>)}</select></label>
        <label>{text('Nesil','Generation')}<select value={generation} onChange={event=>setGeneration(event.target.value)}><option value="">{text('Tüm nesiller','All generations')}</option>{generationOptions.map(value=><option key={value} value={value}>{language==='tr'?`${value}. nesil`:`Generation ${value}`}</option>)}</select></label>
        <Button disabled={loadingPage} onClick={()=>void loadPage(true)}>{loadingPage?text('Yükleniyor…','Loading…'):text('Filtrele','Filter')}</Button>
      </section>
      {pageMessage&&<StatusMessage tone="danger">{pageMessage}</StatusMessage>}
      <article className="panel tree-canvas">
        <div className="tree-toolbar"><span>{language==='tr'?`${items.length} kişi yüklendi · ${generations.length} nesil · ${new Set(items.map(person=>person.branch)).size} görünür dal`:`${items.length} people loaded · ${generations.length} generations · ${new Set(items.map(person=>person.branch)).size} visible branches`}{metrics?` · ${metrics.queryDurationMs} ms`:''}</span><div><button type="button" aria-label={text('Uzaklaştır','Zoom out')} onClick={()=>updateZoom(zoom-.1)}>−</button><output aria-label={text('Yakınlaştırma oranı','Zoom level')}>%{Math.round(zoom*100)}</output><button type="button" aria-label={text('Yakınlaştır','Zoom in')} onClick={()=>updateZoom(zoom+.1)}>＋</button><button type="button" aria-label={text('Yakınlaştırmayı sıfırla','Reset zoom')} onClick={()=>setZoom(1)}>⌗</button></div></div>
        <div className="generations large-tree-window" style={{transform:`scale(${zoom})`,transformOrigin:'top left',width:`${100/zoom}%`}}>
          {generations.map(generationValue=>(
            <div className="generation-row" key={generationValue}>
              <div className="generation-label"><strong>{language==='tr'?`${generationValue}. Nesil`:`Generation ${generationValue}`}</strong><small>{generationValue===1?text('Kök kuşak','Root generation'):(language==='tr'?`${generationValue-1}. alt kuşak`:`Subgeneration ${generationValue-1}`)}</small></div>
              <div className="generation-members">
                {items.filter(person=>person.generation===generationValue).map(person=><article className="tree-person" key={person.id}><span className="person-avatar">{person.initials}</span><div><strong>{person.displayName}</strong><small>{person.birthDate?.slice(0,4)??'?'} — {person.relationshipType}</small><small>{person.branch} · {language==='tr'?`${person.relationCount} bağlantı`:`${person.relationCount} relationships`}</small></div><i className="status-dot"/></article>)}
              </div>
            </div>
          ))}
          {!items.length&&!loadingPage&&<EmptyState title={text('Kişi bulunamadı','No people found')} body={text('Filtreleri değiştirin veya aile üyesi ekleyin.','Change the filters or add a family member.')}/>}
        </div>
        {hasMore&&<div className="large-data-load-more"><Button disabled={loadingPage||!nextCursor} onClick={()=>void loadPage(false,nextCursor)}>{loadingPage?text('Yükleniyor…','Loading…'):text('Sonraki 80 kişiyi yükle','Load the next 80 people')}</Button></div>}
        <div className="evidence-strip"><div><span className="eyebrow">{text('Performans penceresi','Performance window')}</span><h3>{text('Yalnız görüntülenen kayıtlar çizilir','Only visible records are rendered')}</h3></div><div className="evidence-cards"><span>{text('⇥ Anahtar tabanlı sayfalama','⇥ Keyset pagination')}</span><span>{text('⌁ İndeksli nesil sırası','⌁ Indexed generation order')}</span><span>{text('◫ Sınırlı DOM kartı','◫ Bounded DOM cards')}</span><span>{text('⏱ Ölçümlü sorgu','⏱ Measured query')}</span></div></div>
      </article>
      <section className="insight-grid">
        <Surface><SectionHeader eyebrow={text('Soy analizi','Genealogy analysis')} title={text('Aile dalları','Family branches')}/>{insights?.branches.length?insights.branches.map(branchItem=><StatRow key={branchItem.name} value={branchItem.members} label={branchItem.name}/>):<EmptyState title={text('Dal analizi bekleniyor','Branch analysis is pending')} body={text('Üyeleri ve ilişkileri ekledikçe aile dalları burada oluşur','Family branches appear here as you add members and relationships')}/>}</Surface>
        <Surface><SectionHeader eyebrow={text('Bütünlük','Integrity')} title={text('Bağlantı denetimi','Relationship audit')}/><StatRow value={insights?.missingParentLinks.length??0} label={text('Eksik ebeveyn bağlantısı','Missing parent relationship')}/><StatRow value={insights?.integrity?.cyclePersonIds.length??0} label={text('Döngüsel ilişki','Cyclic relationship')}/><StatRow value={insights?.integrity?.brokenRelationIds.length??0} label={text('Bozuk ilişki','Broken relationship')}/><StatusMessage tone={(insights?.integrity?.cyclePersonIds.length??0)+(insights?.integrity?.brokenRelationIds.length??0)===0?'success':'warning'}>{(insights?.integrity?.cyclePersonIds.length??0)+(insights?.integrity?.brokenRelationIds.length??0)===0?text('Soy ağacı bağlantıları tutarlı.','Family-tree relationships are consistent.'):text('Bağlantılarda incelenmesi gereken kayıtlar var.','Some relationships require review.')}</StatusMessage></Surface>
      </section>
    </>
  );
}

export function TimelineScreen({ snapshot, onEdit, onArchive, onOpenArchive }: { snapshot: FamilyAppSnapshot; onEdit: (event: FamilyEventView) => void; onArchive: (eventId: string) => Promise<void>; onOpenArchive: (eventId: string) => void }) {
  const { language, locale } = useLocalization();
  const text=(tr:string,en:string)=>language==='tr'?tr:en;
  const [filter,setFilter]=useState<'family'|'personal'>('family');
  const [personId,setPersonId]=useState(snapshot.people[0]?.id??'');
  const [query,setQuery]=useState('');
  const [kind,setKind]=useState('all');
  const [year,setYear]=useState('all');
  const [events,setEvents]=useState<FamilyEventView[]>([]);
  const [nextCursor,setNextCursor]=useState<string>();
  const [hasMore,setHasMore]=useState(false);
  const [metrics,setMetrics]=useState<{returned:number;scanned:number;queryDurationMs:number;limit:number}>();
  const [busyId,setBusyId]=useState('');
  const [loadingPage,setLoadingPage]=useState(false);
  const [error,setError]=useState('');
  const guardRef=useRef(new AsyncWriteGuard());
  const currentYear=new Date().getFullYear();
  const years=Array.from({length:16},(_,index)=>String(currentYear-index));
  const kinds=[...new Set(['important_day',...snapshot.events.map(event=>event.kind)])].toSorted();
  const loadPage=async(reset:boolean,cursor?:string)=>{
    const ticket=guardRef.current.start('timeline-page');setLoadingPage(true);setError('');
    try{
      if(window.pardus){
        const page=await window.pardus.listLargeTimeline({limit:80,...(query.trim()?{query:query.trim()}:{}),...(filter==='personal'&&personId?{personId}:{}),...(kind!=='all'?{kind}:{}),...(year!=='all'?{year:Number(year)}:{}),...(cursor?{cursor}:{})});
        guardRef.current.commit(ticket,()=>{setEvents(current=>reset?page.items:[...current,...page.items]);setNextCursor(page.nextCursor);setHasMore(page.hasMore);setMetrics(page.metrics);});
      }else{
        const normalized=query.trim().toLocaleLowerCase(locale);const fallback=snapshot.events.filter(event=>filter==='family'||event.participantPersonIds.includes(personId)).filter(event=>kind==='all'||event.kind===kind).filter(event=>year==='all'||String(new Date(event.startAt).getFullYear())===year).filter(event=>!normalized||[event.title,event.description,event.locationLabel,event.notes].some(value=>value?.toLocaleLowerCase(locale).includes(normalized))).toSorted((a,b)=>b.startAt.localeCompare(a.startAt)).slice(0,200);
        guardRef.current.commit(ticket,()=>{setEvents(fallback);setNextCursor(undefined);setHasMore(false);setMetrics({returned:fallback.length,scanned:fallback.length,queryDurationMs:0,limit:200});});
      }
    }catch(caught){guardRef.current.commit(ticket,()=>setError(caught instanceof Error?caught.message:text('Zaman tüneli yüklenemedi.','The timeline could not be loaded.')));}
    finally{guardRef.current.commit(ticket,()=>setLoadingPage(false));}
  };
  useEffect(()=>{guardRef.current.invalidate('timeline-page');void loadPage(true);return()=>guardRef.current.invalidate('timeline-page');},[snapshot.lastUpdatedAt]);
  useEffect(()=>()=>guardRef.current.invalidateAll(),[]);
  const archive=async(event:FamilyEventView)=>{if(!confirm(language==='tr'?`“${event.title}” arşivlensin mi? Kayıt silinmez ve arşivden geri alınabilir.`:`Archive “${event.title}”? The record is not deleted and can be restored from the archive.`))return;setBusyId(event.id);setError('');try{await onArchive(event.id);setEvents(current=>current.filter(item=>item.id!==event.id));}catch(caught){setError(caught instanceof Error?caught.message:text('Olay arşivlenemedi.','The event could not be archived.'));}finally{setBusyId('');}};
  const clearFilters=()=>{setQuery('');setKind('all');setYear('all');};
  return <>
    <PageHeader eyebrow={text('Dijital aile hafızası','Digital family memory')} title={text('Zaman tüneli','Timeline')} description={text('Büyük zaman çizgileri anahtar tabanlı sayfalama ile yüklenir; arama ve filtreler SQLite üzerinde uygulanır.','Large timelines load with keyset pagination; search and filters run in SQLite.')}/>
    <div className="segmented"><button className={filter==='personal'?'active':''} onClick={()=>setFilter('personal')}>{text('Kişisel zaman tüneli','Personal timeline')}</button><button className={filter==='family'?'active':''} onClick={()=>setFilter('family')}>{text('Aile zaman tüneli','Family timeline')}</button></div>
    <section className="timeline-toolbar panel" aria-label={text('Zaman tüneli filtreleri','Timeline filters')}>
      <label className="timeline-search">{text('Kayıtlarda ara','Search records')}<input type="search" value={query} onChange={event=>setQuery(event.target.value)} placeholder={text('Başlık, açıklama, konum veya not…','Title, description, location, or note…')}/></label>
      {filter==='personal'&&<PersonCatalogSelect label={text('Kişi','Person')} value={personId} onChange={setPersonId} fallbackPeople={snapshot.people}/>}
      <label>{text('Olay türü','Event type')}<select value={kind} onChange={event=>setKind(event.target.value)}><option value="all">{text('Tüm türler','All types')}</option>{kinds.map(value=><option key={value} value={value}>{value==='important_day'?text('Önemli gün','Important date'):value.replaceAll('_',' ')}</option>)}</select></label>
      <label>{text('Yıl','Year')}<select value={year} onChange={event=>setYear(event.target.value)}><option value="all">{text('Tüm yıllar','All years')}</option>{years.map(value=><option key={value}>{value}</option>)}</select></label>
      <Button disabled={loadingPage} onClick={()=>void loadPage(true)}>{loadingPage?text('Süzülüyor…','Filtering…'):text('Uygula','Apply')}</Button>
      {(query||kind!=='all'||year!=='all')&&<Button onClick={clearFilters}>{text('Temizle','Clear')}</Button>}
    </section>
    {error&&<StatusMessage tone="danger">{error}</StatusMessage>}
    <section className="timeline-layout">
      <article className="panel full-timeline large-timeline-window">
        {events.length?events.map((event,index)=><div className="full-timeline-row" key={event.id}><div className="year-marker"><strong>{new Date(event.startAt).getFullYear()}</strong><span className="timeline-dot"/></div><div className="event-date"><strong>{new Date(event.startAt).getDate().toString().padStart(2,'0')}</strong><small>{new Date(event.startAt).toLocaleDateString(locale,{month:'short'})}</small></div><div className="timeline-event-content"><div><span className="tag">{event.kind==='important_day'?text('Önemli gün','Important date'):event.kind.replace('_',' ')}</span><h3>{event.title}</h3><p>{event.description||text('Açıklama eklenmemiş.','No description added.')}</p><div className="timeline-row-actions"><Button onClick={()=>onEdit(event)}>{text('Düzenle','Edit')}</Button><Button onClick={()=>onOpenArchive(event.id)}>{text('Bağlı arşiv','Linked archive')}</Button><Button tone="danger" disabled={busyId===event.id} onClick={()=>void archive(event)}>{busyId===event.id?text('Arşivleniyor…','Archiving…'):text('Arşivle','Archive')}</Button></div></div><div className="timeline-meta"><span>⌖ {event.locationLabel??text('Konum yok','No location')}</span><span>♙ {language==='tr'?`${event.participantPersonIds.length} kişi`:`${event.participantPersonIds.length} people`}</span><span>▣ {language==='tr'?`${event.attachmentCount} içerik`:`${event.attachmentCount} items`}</span><span>{event.aiProcessingAllowed?text('✣ AI açık','✣ AI enabled'):text('⊘ AI kapalı','⊘ AI disabled')}</span><span>{text('Güncelleme:','Updated:')} {formatDate(event.updatedAt??event.createdAt,{dateStyle:'short'})}</span></div></div>{index<events.length-1&&<span className="timeline-line"/>}</div>):<EmptyState title={text('Bu ölçütlerde olay bulunamadı','No events match these criteria')} body={text('Filtreleri temizleyin veya yeni bir önemli gün ekleyin.','Clear the filters or add a new important date.')}/>}
        {hasMore&&<div className="large-data-load-more"><Button disabled={loadingPage||!nextCursor} onClick={()=>void loadPage(false,nextCursor)}>{loadingPage?text('Yükleniyor…','Loading…'):text('Sonraki 80 olayı yükle','Load the next 80 events')}</Button></div>}
      </article>
      <aside className="panel timeline-summary"><span className="eyebrow">{text('Sayfalı özet','Paginated summary')}</span><h2>{filter==='family'?text('Aile zaman çizgisi','Family timeline'):text('Kişisel zaman çizgisi','Personal timeline')}</h2><div className="summary-number">{events.length}</div><p>{text('şu anda yüklenen olay','events currently loaded')}</p><hr/><div className="summary-stats"><span><strong>{events.reduce((sum,event)=>sum+event.attachmentCount,0)}</strong> {text('ilişkili içerik','related items')}</span><span><strong>{new Set(events.map(event=>event.locationLabel).filter(Boolean)).size}</strong> {text('farklı yer','distinct places')}</span><span><strong>{metrics?.queryDurationMs??0} ms</strong> {text('son sorgu','last query')}</span><span><strong>{metrics?.scanned??0}</strong> {text('taranan satır','rows scanned')}</span></div></aside>
    </section>
  </>;
}

export function ImportantDaysScreen({ snapshot, archivedEvents, onAdd, onEdit, onArchive, onRestore, onOpenArchive }: { snapshot: FamilyAppSnapshot; archivedEvents: FamilyEventView[]; onAdd: () => void; onEdit: (event: FamilyEventView) => void; onArchive: (eventId: string) => Promise<void>; onRestore: (eventId: string) => Promise<void>; onOpenArchive:(eventId:string)=>void }) {
  const { language, locale } = useLocalization();
  const text=(tr:string,en:string)=>language==='tr'?tr:en;
  const events = snapshot.events.filter((event) => event.kind === 'important_day').toSorted((a, b) => a.startAt.localeCompare(b.startAt));
  const [selectedId, setSelectedId] = useState(events[0]?.id ?? '');
  const selected = events.find((event) => event.id === selectedId) ?? events[0];
  const [busyId,setBusyId]=useState(''); const [error,setError]=useState(''); const [showArchived,setShowArchived]=useState(false);
  useEffect(()=>{if(!selectedId&&events[0])setSelectedId(events[0].id);},[events.length,selectedId]);
  const participantNames = selected?.participantPersonIds.map((id) => snapshot.people.find((person) => person.id === id)?.displayName).filter(Boolean) ?? [];
  const archive=async()=>{if(!selected||!confirm(language==='tr'?`“${selected.title}” arşivlensin mi?`:`Archive “${selected.title}”?`))return;setBusyId(selected.id);setError('');try{await onArchive(selected.id);setSelectedId('');}catch(caught){setError(caught instanceof Error?caught.message:text('Önemli gün arşivlenemedi.','The important date could not be archived.'));}finally{setBusyId('');}};
  const restore=async(eventId:string)=>{setBusyId(eventId);setError('');try{await onRestore(eventId);}catch(caught){setError(caught instanceof Error?caught.message:text('Kayıt geri alınamadı.','The record could not be restored.'));}finally{setBusyId('');}};
  const archivedImportantDays = archivedEvents.filter((event) => event.kind === 'important_day');
  return (
    <>
      <PageHeader eyebrow={text('Anılar ve etkinlikler merkezi','Memories and events center')} title={text('Önemli günler','Important dates')} description={text('Bir güne ait tarih, yer, davetiye, katılımcı ve notların tamamını tek kayıtta yönetin.','Manage a date, place, invitation, participants, and notes for a day in one record.')} actions={<><Button onClick={()=>setShowArchived((value)=>!value)}>{text('Arşiv','Archive')} ({archivedImportantDays.length})</Button><Button tone="primary" onClick={onAdd}>{text('＋ Yeni ekle','＋ Add new')}</Button></>} />
      {error&&<StatusMessage tone="danger">{error}</StatusMessage>}
      {showArchived&&<section className="panel archived-events-panel"><SectionHeader eyebrow={text('Geri alınabilir kayıtlar','Restorable records')} title={text('Önemli gün arşivi','Important-date archive')} action={<Button onClick={()=>setShowArchived(false)}>{text('Kapat','Close')}</Button>}/>{archivedImportantDays.length?<div className="archived-event-list">{archivedImportantDays.map((event)=><article key={event.id}><div><strong>{event.title}</strong><small>{formatDate(event.startAt)} · {event.locationLabel??text('Konum yok','No location')}</small><small>{text('Arşivlenme:','Archived:')} {formatDate(event.archivedAt??event.updatedAt??event.createdAt,{dateStyle:'medium',timeStyle:'short'})}</small></div><Button disabled={busyId===event.id} onClick={()=>void restore(event.id)}>{busyId===event.id?text('Geri alınıyor…','Restoring…'):text('Geri al','Restore')}</Button></article>)}</div>:<EmptyState title={text('Arşiv boş','Archive is empty')} body={text('Arşivlenen önemli günler burada geri alınabilir.','Archived important dates can be restored here.')}/>}</section>}
      <section className="important-layout">
        <article className="panel important-list"><div className="panel-heading"><div><span className="eyebrow">{text('Takvim','Calendar')}</span><h2>{text('Önemli günler','Important dates')}</h2></div></div>{events.map((event) => <EventListItem event={event} key={event.id} selected={selected?.id === event.id} onClick={() => setSelectedId(event.id)} />)}</article>
        {selected ? <article className="panel event-detail-panel">
          <div className="event-detail-header"><span className="calendar-tile large"><small>{new Date(selected.startAt).toLocaleDateString(locale, { month: 'short' }).toLocaleUpperCase(locale)}</small><strong>{new Date(selected.startAt).getDate()}</strong></span><div><span className="tag blue">{text('Önemli gün','Important date')}</span><h2>{selected.title}</h2><p>{selected.description||text('Açıklama eklenmemiş.','No description added.')}</p></div><div className="event-header-actions"><Button onClick={()=>onEdit(selected)}>{text('Tüm alanları düzenle','Edit all fields')}</Button><Button tone="danger" disabled={busyId===selected.id} onClick={()=>void archive()}>{busyId===selected.id?text('Arşivleniyor…','Archiving…'):text('Arşivle','Archive')}</Button></div></div>
          <div className="event-facts"><div><small>{text('Tarih ve saat','Date and time')}</small><strong>{formatDate(selected.startAt, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</strong></div><div><small>{text('Konum','Location')}</small><strong>⌖ {selected.locationLabel ?? text('Eklenmemiş','Not added')}</strong></div><div><small>{text('Gizlilik','Privacy')}</small><strong>{selected.visibility==='family'?text('Aileyle paylaşılıyor','Shared with family'):selected.visibility==='selected_members'?text('Seçili üyeler','Selected members'):text('Kişisel','Personal')}</strong></div><div><small>{text('Tekrar','Repeat')}</small><strong>{selected.recurrence === 'yearly' ? text('Her yıl','Every year') : text('Tek sefer','Once')}</strong></div><div><small>{text('Hatırlatma','Reminder')}</small><strong>{selected.reminderDays.length ? selected.reminderDays.map((day) => day === 0 ? text('aynı gün','same day') : (language==='tr'?`${day} gün`:`${day} days`)).join(', ') : text('Kapalı','Off')}</strong></div></div>
          <div className="event-content-grid">
            <section><span className="eyebrow">{text('Davetiye','Invitation')}</span><div className="invitation-preview"><span>ParsYuva</span><h3>{selected.title}</h3><p>{selected.invitationText ?? text('Bu etkinlik için davetiye eklenmemiş.','No invitation has been added for this event.')}</p><small>{formatDate(selected.startAt)}</small></div></section>
            <section><span className="eyebrow">{text('Katılımcılar','Participants')} ({participantNames.length})</span><div className="participant-chips">{participantNames.map((name) => <span key={name}>{name}</span>)}</div></section>
            <section><span className="eyebrow">{text('İçerikler','Content')}</span><div className="attachment-overview"><strong>{selected.attachmentCount}</strong><span>{text('fotoğraf, video veya belge','photos, videos, or documents')}</span><Button onClick={()=>onOpenArchive(selected.id)}>{text('Arşivde görüntüle','View in archive')}</Button></div></section>
            <section><span className="eyebrow">{text('Notlar ve anılar','Notes and memories')}</span><div className="notes-card">{selected.notes ?? text('Henüz not eklenmemiş.','No notes added yet.')}</div></section>
          </div>
          <div className="event-milestones"><span className="done">{text('✓ Planlama','✓ Planning')}</span><i /><span className="done">{text('✓ Davetiye','✓ Invitation')}</span><i /><span className="active">{text('● Etkinlik günü','● Event day')}</span><i /><span>{text('○ Anılar paylaşıldı','○ Memories shared')}</span></div>
        </article> : <EmptyState title={text('Önemli gün bulunamadı','No important date found')} body={text('Yeni bir kayıt ekleyin.','Add a new record.')} />}
      </section>
    </>
  );
}

const unifiedSearchModuleLabels:Record<UnifiedAuthorizedSearchView['items'][number]['module'],string>={family:'Aile',event:'Olay',archive:'Belge',finance:'Finans',health:'Sağlık',life:'Yaşam'};

export function UnifiedAuthorizedSearchPanel({onOpenArchive}:{onOpenArchive:(id:string)=>Promise<void>}) {
  const { language } = useLocalization();
  const text=(tr:string,en:string)=>language==='tr'?tr:en;
  const [query,setQuery]=useState('');
  const [result,setResult]=useState<UnifiedAuthorizedSearchView>();
  const [error,setError]=useState('');
  const [busy,setBusy]=useState(false);
  const guardRef=useRef(new AsyncWriteGuard());
  useEffect(()=>()=>guardRef.current.invalidateAll(),[]);
  const search=async(event:FormEvent<HTMLFormElement>)=>{event.preventDefault();if(!window.pardus||query.normalize('NFKC').trim().length<2)return;const ticket=guardRef.current.start('unified-authorized-search');setBusy(true);setError('');try{const next=await window.pardus.searchUnifiedAuthorizedRecords({query,limit:25});guardRef.current.commit(ticket,()=>setResult(next));}catch(caught){guardRef.current.commit(ticket,()=>{setResult(undefined);setError(caught instanceof Error?caught.message:text('Birleşik arama tamamlanamadı.','Unified search could not be completed.'));});}finally{guardRef.current.commit(ticket,()=>setBusy(false));}};
  return <section className="panel unified-authorized-search" aria-labelledby="unified-authorized-search-title">
    <div className="section-heading"><div><span className="eyebrow">{text('B3-05 · Yetki filtreli okuma','B3-05 · Authorization-filtered read')}</span><h2 id="unified-authorized-search-title">{text('Tüm modüllerde ara','Search all modules')}</h2><p>{text('Aile, olay, belge, finans, sağlık ve yaşam kayıtları yalnız çağrı anındaki kaynak yetkileriyle birlikte aranır.','Family, event, document, finance, health, and life records are searched only under their resource permissions at call time.')}</p></div></div>
    <form className="unified-authorized-search-form" onSubmit={event=>void search(event)}><label htmlFor="unified-authorized-search-query">{text('Arama sorgusu','Search query')}</label><input id="unified-authorized-search-query" value={query} maxLength={80} onChange={event=>setQuery(event.target.value)} placeholder={text('En az iki karakter yazın','Enter at least two characters')}/><Button type="submit" disabled={busy||query.normalize('NFKC').trim().length<2}>{busy?text('Aranıyor…','Searching…'):text('Birleşik ara','Unified search')}</Button></form>
    <small>{text('Bir kaynak yetkilendirilemez veya yüklenemezse kısmi sonuç gösterilmez. Sorgu IPC yanıtında yankılanmaz; sonuçlar kalıcı arama geçmişine yazılmaz.','If any resource cannot be authorized or loaded, no partial result is shown. The query is not echoed in the IPC response, and results are not written to persistent search history.')}</small>
    {error&&<StatusMessage tone="danger">{error}</StatusMessage>}
    {result&&<div className="unified-authorized-search-results" aria-live="polite"><div className="section-heading"><strong>{language==='tr'?`${result.items.length} yetkili sonuç${result.truncated?' · ilk 25 gösteriliyor':''}`:`${result.items.length} authorized results${result.truncated?' · showing the first 25':''}`}</strong><small>{language==='tr'?`${result.searchedModules.length} modül · politika filtreli ve tam kaynak yanıtı`:`${result.searchedModules.length} modules · policy-filtered complete-source response`}</small></div>{result.items.length===0?<EmptyState title={text('Yetkili sonuç bulunamadı','No authorized results found')} body={text('Sorguyu değiştirip yeniden deneyin.','Change the query and try again.')}/>:result.items.map(item=><article key={`${item.resourceType}:${item.resourceId}`}><div><span className="tag blue">{language==='tr'?unifiedSearchModuleLabels[item.module]:({family:'Family',event:'Event',archive:'Document',finance:'Finance',health:'Health',life:'Life'} as const)[item.module]}</span><strong>{item.title}</strong>{item.occurredAt&&<small>{formatDate(item.occurredAt,{dateStyle:'medium'})}</small>}</div>{item.resourceType==='archive_item'&&<Button onClick={()=>void onOpenArchive(item.resourceId)}>{text('Belgeyi aç','Open document')}</Button>}</article>)}</div>}
  </section>;
}

export function ArchiveScreen({ revision, snapshot, eventFilter, onEventFilterChange, onImport, onOpen }: { revision:number; snapshot: FamilyAppSnapshot; eventFilter:string; onEventFilterChange:(eventId:string)=>void; onImport: (input: { title: string; linkedEventId?: string }) => Promise<void>; onOpen:(id:string)=>Promise<void> }) {
  const { language } = useLocalization();
  const [title,setTitle]=useState('');const [linkedEventId,setLinkedEventId]=useState('');const [error,setError]=useState('');const [busy,setBusy]=useState(false);
  const [reattestPassword,setReattestPassword]=useState('');const [reattestCode,setReattestCode]=useState('');const [reattestConfirmation,setReattestConfirmation]=useState('');
  const [query,setQuery]=useState('');const [categoryId,setCategoryId]=useState('');const [sensitivity,setSensitivity]=useState('');const [tag,setTag]=useState('');const [mimeType,setMimeType]=useState('');
  const [results,setResults]=useState<ArchivePageItemView[]>([]);const [selectedIds,setSelectedIds]=useState<string[]>([]);const [selectedItemId,setSelectedItemId]=useState('');
  const [versions,setVersions]=useState<ArchiveVersionView[]>([]);const [compareIds,setCompareIds]=useState<string[]>([]);const [policies,setPolicies]=useState<ArchiveRetentionPolicyView[]>([]);const [categories,setCategories]=useState<ArchiveCategoryView[]>([]);
  const [relationEvidence,setRelationEvidence]=useState<ArchiveRelationEvidenceView[]>([]);const [relationEvidenceHistory,setRelationEvidenceHistory]=useState<ArchiveRelationEvidenceHistoryView[]>([]);const [showEvidenceHistory,setShowEvidenceHistory]=useState(false);
  const [evidenceRelationId,setEvidenceRelationId]=useState('');const [evidenceDate,setEvidenceDate]=useState(()=>new Date().toISOString().slice(0,10));const [evidenceConfidence,setEvidenceConfidence]=useState<ArchiveRelationEvidenceConfidence>('medium');const [versionNote,setVersionNote]=useState('');
  const [nextCursor,setNextCursor]=useState<string>();const [hasMore,setHasMore]=useState(false);const [metrics,setMetrics]=useState<{returned:number;scanned:number;queryDurationMs:number;limit:number}>();const guardRef=useRef(new AsyncWriteGuard());
  const pendingArchiveOperations=useRef(new Map<string,string>());
  const buildSearch=():ArchiveSearchInput=>({...((query.trim())?{query:query.trim()}:{}),...(categoryId?{categoryId}:{}),...(sensitivity?{sensitivity:sensitivity as NonNullable<ArchiveSearchInput['sensitivity']>}:{}),...(tag.trim()?{tag:tag.trim()}:{}),...(mimeType.trim()?{mimeType:mimeType.trim()}:{}),...(eventFilter?{linkedEventId:eventFilter}:{})});
  const reload=async(reset=true,cursor?:string)=>{if(!window.pardus)return;const ticket=guardRef.current.start('archive-page');setBusy(true);setError('');try{const [page,nextPolicies,nextCategories]=await Promise.all([window.pardus.listLargeArchive({...buildSearch(),limit:80,...(cursor?{cursor}:{})}),window.pardus.listArchiveRetentionPolicies(),window.pardus.listArchiveCategories()]);guardRef.current.commit(ticket,()=>{setResults(current=>reset?page.items:[...current,...page.items]);setPolicies(nextPolicies);setCategories(nextCategories);setNextCursor(page.nextCursor);setHasMore(page.hasMore);setMetrics(page.metrics);setSelectedItemId(current=>page.items.some(item=>item.id===current)?current:(reset?(page.items[0]?.id??''):current));});}catch(caught){guardRef.current.commit(ticket,()=>setError(caught instanceof Error?caught.message:'Arşiv sayfası yüklenemedi.'));}finally{guardRef.current.commit(ticket,()=>setBusy(false));}};
  useEffect(()=>{guardRef.current.invalidate('archive-page');void reload(true);return()=>guardRef.current.invalidate('archive-page');},[revision,eventFilter]);
  useEffect(()=>{guardRef.current.invalidate('archive-versions');if(!selectedItemId||!window.pardus){setVersions([]);return;}const ticket=guardRef.current.start('archive-versions');void window.pardus.listArchiveVersions(selectedItemId).then(value=>{guardRef.current.commit(ticket,()=>setVersions(value));}).catch(caught=>{guardRef.current.commit(ticket,()=>setError(caught instanceof Error?caught.message:'Arşiv sürümleri yüklenemedi.'));});return()=>guardRef.current.invalidate('archive-versions');},[selectedItemId]);
  useEffect(()=>{guardRef.current.invalidate('archive-evidence');if(!selectedItemId||!window.pardus){setRelationEvidence([]);setRelationEvidenceHistory([]);return;}const ticket=guardRef.current.start('archive-evidence');void Promise.all([window.pardus.listArchiveRelationEvidence(selectedItemId),window.pardus.listArchiveRelationEvidenceHistory(selectedItemId)]).then(([current,history])=>{guardRef.current.commit(ticket,()=>{setRelationEvidence(current);setRelationEvidenceHistory(history);});}).catch(caught=>{guardRef.current.commit(ticket,()=>setError(caught instanceof Error?caught.message:'İlişki kanıtları yüklenemedi.'));});return()=>guardRef.current.invalidate('archive-evidence');},[selectedItemId]);
  useEffect(()=>()=>guardRef.current.invalidateAll(),[]);
  const submit=async()=>{try{setBusy(true);setError('');await onImport({title,...(linkedEventId?{linkedEventId}:{})});setTitle('');await reload(true);}catch(caught){setError(caught instanceof Error?caught.message:'Dosya eklenemedi.');}finally{setBusy(false);}};
  const toggle=(id:string)=>setSelectedIds(value=>value.includes(id)?value.filter(item=>item!==id):[...value,id]);
  const bulkClassify=async()=>{if(!window.pardus||!selectedIds.length)return;const category=prompt('Kategori kimliği (boş = mevcut kategori):',categoryId)??'';const tags=(prompt('Etiketler (virgülle):',tag)??'').split(',').map(value=>value.trim()).filter(Boolean);const level=(prompt('Hassasiyet: standard / personal / high','standard')??'standard') as ArchiveClassificationView['sensitivity'];setBusy(true);setError('');try{for(const itemId of selectedIds){const existing=results.find(item=>item.id===itemId);await window.pardus.updateArchiveClassification({itemId,...(category?{categoryId:category}:existing?.categoryId?{categoryId:existing.categoryId}:{}),tagNames:tags.length?tags:(existing?.tagNames??[]),sensitivity:['standard','personal','high'].includes(level)?level:(existing?.sensitivity??'standard'),aiProcessingAllowed:false});}setSelectedIds([]);await reload(true);}catch(caught){setError(caught instanceof Error?caught.message:'Toplu sınıflandırma başarısız.');}finally{setBusy(false);}};
  const assignPolicy=async(itemId:string,policyId:string)=>{if(!window.pardus)return;setBusy(true);try{await window.pardus.assignArchiveRetentionPolicy({itemId,...(policyId?{policyId}:{})});await reload(true);}catch(caught){setError(caught instanceof Error?caught.message:'Saklama politikası atanamadı.');}finally{setBusy(false);}};
  const createPolicy=async(event:FormEvent<HTMLFormElement>)=>{event.preventDefault();if(!window.pardus)return;const data=new FormData(event.currentTarget);setPolicies(await window.pardus.createArchiveRetentionPolicy({name:String(data.get('name')),retentionDays:Number(data.get('days')),secureDestroy:data.get('secure')==='on'}));event.currentTarget.reset();};
  const createCategory=async(event:FormEvent<HTMLFormElement>)=>{event.preventDefault();if(!window.pardus)return;const data=new FormData(event.currentTarget);const name=String(data.get('name')??'').trim();const description=String(data.get('description')??'').trim();if(name.length<2)return;setCategories(await window.pardus.createArchiveCategory({name,...(description?{description}:{})}));event.currentTarget.reset();};
  const destroy=async(id:string)=>{if(!window.pardus||!confirm(translateArchiveCenterCopy('Bu belge güvenli biçimde imha edilecek. Devam edilsin mi?',language)))return;setBusy(true);try{await window.pardus.securelyDestroyArchiveItem(id);await reload(true);}catch(caught){setError(caught instanceof Error?caught.message:translateArchiveCenterCopy('İmha işlemi başarısız.',language));}finally{setBusy(false);}};
  const reattestLegacyOwnership=async()=>{if(!window.pardus||!selected||selected.ownershipBinding!=='legacy_unverified')return;setBusy(true);setError('');try{await window.pardus.reattestLegacyArchiveOwnership({itemId:selected.id,password:reattestPassword,...(reattestCode.trim()?{code:reattestCode.trim()}:{}),confirmation:reattestConfirmation});await reload(true);}catch(caught){setError(caught instanceof Error?caught.message:'Eski arşiv sahipliği yeniden doğrulanamadı.');}finally{setReattestPassword('');setReattestCode('');setReattestConfirmation('');setBusy(false);}};
  const stableArchiveOperation=(key:string)=>{const current=pendingArchiveOperations.current.get(key);if(current)return current;const created=`archive-33r-${crypto.randomUUID()}`;pendingArchiveOperations.current.set(key,created);return created;};
  const addRelationEvidence=async()=>{if(!window.pardus||!selected||!evidenceRelationId||!evidenceDate)return;const key=`evidence:add:${selected.id}:${evidenceRelationId}:${evidenceDate}:${evidenceConfidence}`;setBusy(true);setError('');try{const next=await window.pardus.addArchiveRelationEvidence({archiveItemId:selected.id,relationId:evidenceRelationId,evidenceDate,confidence:evidenceConfidence,clientOperationId:stableArchiveOperation(key)});pendingArchiveOperations.current.delete(key);setRelationEvidence(next);setRelationEvidenceHistory(await window.pardus.listArchiveRelationEvidenceHistory(selected.id));}catch(caught){setError(caught instanceof Error?`${caught.message} ${translateArchiveCenterCopy('Aynı işlem kimliğiyle yeniden deneyebilirsiniz.',language)}`:translateArchiveCenterCopy('İlişki kanıtı eklenemedi.',language));}finally{setBusy(false);}};
  const removeRelationEvidence=async(item:ArchiveRelationEvidenceView)=>{if(!window.pardus||!selected||!confirm(translateArchiveCenterCopy('Bu kanıt etkin görünümden kaldırılacak; değişmez geçmiş kaydı korunacak. Devam edilsin mi?',language)))return;const key=`evidence:remove:${item.id}:${item.revision}`;setBusy(true);setError('');try{const next=await window.pardus.removeArchiveRelationEvidence({archiveItemId:selected.id,evidenceId:item.id,expectedRevision:item.revision,clientOperationId:stableArchiveOperation(key)});pendingArchiveOperations.current.delete(key);setRelationEvidence(next);setRelationEvidenceHistory(await window.pardus.listArchiveRelationEvidenceHistory(selected.id));}catch(caught){setError(caught instanceof Error?`${caught.message} ${translateArchiveCenterCopy('Aynı işlem kimliği ve revizyonla yeniden deneyebilirsiniz.',language)}`:translateArchiveCenterCopy('İlişki kanıtı kaldırılamadı.',language));}finally{setBusy(false);}};
  const addVersion=async()=>{if(!window.pardus||!selected)return;const normalizedNote=versionNote.normalize('NFKC').trim();const key=`version:add:${selected.id}:${normalizedNote}`;setBusy(true);setError('');try{const next=await window.pardus.addArchiveItemVersion({itemId:selected.id,...(normalizedNote?{note:normalizedNote}:{}),clientOperationId:stableArchiveOperation(key)});pendingArchiveOperations.current.delete(key);setVersions(next);setVersionNote('');await reload(true);}catch(caught){setError(caught instanceof Error?`${caught.message} ${translateArchiveCenterCopy('Belirsiz sonuçta aynı dosya ve işlem kimliğiyle yeniden deneyin.',language)}`:translateArchiveCenterCopy('Yeni belge sürümü eklenemedi.',language));}finally{setBusy(false);}};
  const clear=()=>{setQuery('');setCategoryId('');setSensitivity('');setTag('');setMimeType('');onEventFilterChange('');};
  const selected=results.find(item=>item.id===selectedItemId);const compare=versions.filter(version=>compareIds.includes(version.id));const dueQueue=results.filter(item=>item.eligibleForDestruction);
  const relationLabel=(relationId:string)=>{const relation=snapshot.relations.find(item=>item.id===relationId);if(!relation)return relationId;const from=snapshot.people.find(person=>person.id===relation.fromPersonId)?.displayName??relation.fromPersonId;const to=snapshot.people.find(person=>person.id===relation.toPersonId)?.displayName??relation.toPersonId;return `${from} — ${to} · ${relation.relationType}`;};
  const panel = <><PageHeader eyebrow="Gelişmiş belge yaşam döngüsü" title="Doküman Merkezi" description="Büyük arşivler indeksli filtreler ve anahtar tabanlı sayfalama ile açılır; yalnız yüklenen belgeler renderer belleğinde tutulur." actions={<Button tone="primary" onClick={()=>void submit()} disabled={busy||title.trim().length<2}>＋ Dosya ekle</Button>}/>
    <section className="document-toolbar panel"><input value={query} onChange={event=>setQuery(event.target.value)} placeholder="Başlık, dosya adı veya etiket ara" aria-label="Arşivde başlık, dosya adı veya etiket ara"/><EventCatalogSelect label="Bağlı önemli gün" value={eventFilter} onChange={onEventFilterChange} archiveMode="all" fallbackEvents={snapshot.events}/><select value={categoryId} onChange={event=>setCategoryId(event.target.value)} aria-label="Arşiv kategorisi"><option value="">Tüm kategoriler</option>{categories.map(category=><option key={category.id} value={category.id}>{category.name}</option>)}</select><select value={sensitivity} onChange={event=>setSensitivity(event.target.value)} aria-label="Arşiv hassasiyet seviyesi"><option value="">Tüm hassasiyetler</option><option value="standard">Standart</option><option value="personal">Kişisel</option><option value="high">Yüksek</option></select><input value={tag} onChange={event=>setTag(event.target.value)} placeholder="Etiket" aria-label="Arşiv etiketi"/><input value={mimeType} onChange={event=>setMimeType(event.target.value)} placeholder="MIME türü" aria-label="Arşiv MIME türü"/><Button disabled={busy} onClick={()=>void reload(true)}>Ara</Button><Button onClick={clear}>Temizle</Button></section>
    <UnifiedAuthorizedSearchPanel onOpenArchive={onOpen}/>
    {error&&<div className="form-error">{error}</div>}
    <section className="document-layout"><article className="panel document-list"><div className="panel-heading"><div><span className="eyebrow">{results.length} kayıt yüklendi{metrics?` · ${metrics.queryDurationMs} ms`:''}</span><h2>Belgeler</h2></div><div className="header-actions"><Button disabled={!selectedIds.length} onClick={()=>void bulkClassify()}>Toplu sınıflandır ({selectedIds.length})</Button></div></div>
    <div className="document-import"><input value={title} onChange={event=>setTitle(event.target.value)} placeholder="Yeni belge başlığı"/><select value={linkedEventId} onChange={event=>setLinkedEventId(event.target.value)}><option value="">Etkinlik bağlantısı yok</option>{snapshot.events.map(event=><option key={event.id} value={event.id}>{event.title}</option>)}</select></div>
    {results.length?results.map(item=><div className={`document-row ${selectedItemId===item.id?'selected':''}`} key={item.id} onClick={()=>setSelectedItemId(item.id)}><input type="checkbox" checked={selectedIds.includes(item.id)} onChange={()=>toggle(item.id)} onClick={event=>event.stopPropagation()}/><div><strong>{item.title}</strong><span>{item.originalName} · {(item.sizeBytes/1024).toFixed(1)} KB</span><small>{item.categoryName??'Kategorisiz'} · {item.sensitivity} · {item.tagNames.join(', ')||'etiket yok'}</small></div><div className="document-row-actions"><span className={`tag ${item.eligibleForDestruction?'red':'blue'}`}>{item.retentionPolicyName??'Politika yok'}</span><Button onClick={event=>{event.stopPropagation();void onOpen(item.id);}}>Aç</Button></div></div>):<EmptyState title="Belge bulunamadı" body="Filtreleri değiştirin veya yeni belge ekleyin."/>}
    {hasMore&&<div className="large-data-load-more"><Button disabled={busy||!nextCursor} onClick={()=>void reload(false,nextCursor)}>{busy?'Yükleniyor…':'Sonraki 80 belgeyi yükle'}</Button></div>}</article>
    <article className="panel document-detail">{selected?<><div className="panel-heading"><div><span className="eyebrow">Belge ayrıntısı</span><h2>{selected.title}</h2></div><span className="tag blue">SHA {selected.sha256.slice(0,12)}…</span></div><div className="detail-grid"><div><small>Dosya</small><strong>{selected.originalName}</strong></div><div><small>Tür</small><strong>{selected.mimeType}</strong></div><div><small>Boyut</small><strong>{(selected.sizeBytes/1024).toFixed(1)} KB</strong></div><div><small>Eklenme</small><strong>{formatDate(selected.createdAt)}</strong></div></div><div className="archive-version-heading"><h3>Sürüm geçmişi</h3><Button disabled={busy} onClick={()=>void addVersion()}>Yeni sürüm dosyası seç</Button></div><label className="archive-version-note">Sürüm notu <small>(isteğe bağlı)</small><input value={versionNote} maxLength={500} onChange={event=>setVersionNote(event.target.value)} placeholder="Bu sürümde ne değişti?"/></label><small>Dosya yolu yalnız ana süreç seçicisinde kalır. Belirsiz sonuçta aynı dosyayla yeniden deneyin; onay alınmamış işlem için yeniden başlatma kurtarma garantisi verilmez.</small><div className="version-list">{versions.map(version=><label className="version-row" key={version.id}><input type="checkbox" checked={compareIds.includes(version.id)} onChange={()=>setCompareIds(ids=>ids.includes(version.id)?ids.filter(id=>id!==version.id):(ids.length<2?[...ids,version.id]:[ids[1]!,version.id]))}/><div><strong>v{version.versionNo} · {version.originalName}</strong><span>{formatDate(version.createdAt)} · {(version.sizeBytes/1024).toFixed(1)} KB{version.note?` · ${version.note}`:''}</span></div><code>{version.sha256.slice(0,16)}…</code></label>)}</div>{compare.length===2&&<div className="version-compare"><h4>Sürüm karşılaştırması</h4><div><span>Dosya adı</span><strong>{compare[0]!.originalName===compare[1]!.originalName?'Aynı':'Değişti'}</strong></div><div><span>Boyut farkı</span><strong>{((compare[1]!.sizeBytes-compare[0]!.sizeBytes)/1024).toFixed(1)} KB</strong></div><div><span>İçerik özeti</span><strong>{compare[0]!.sha256===compare[1]!.sha256?'Aynı':'Farklı'}</strong></div></div>}<section className="archive-relation-evidence" aria-labelledby="archive-relation-evidence-title"><div className="archive-version-heading"><div><h3 id="archive-relation-evidence-title">İlişki kanıtı</h3><small>Belge, aile ilişkisi, tarih ve güven düzeyi birlikte kaydedilir.</small></div><Button onClick={()=>setShowEvidenceHistory(value=>!value)} aria-expanded={showEvidenceHistory}>{showEvidenceHistory?'Geçmişi kapat':`Geçmiş (${relationEvidenceHistory.length})`}</Button></div><div className="archive-evidence-form"><label>Aile ilişkisi<select value={evidenceRelationId} onChange={event=>setEvidenceRelationId(event.target.value)}><option value="">İlişki seçin</option>{snapshot.relations.map(relation=><option key={relation.id} value={relation.id}>{relationLabel(relation.id)}</option>)}</select></label><label>Kanıt tarihi<input type="date" value={evidenceDate} onChange={event=>setEvidenceDate(event.target.value)}/></label><label>Güven düzeyi<select value={evidenceConfidence} onChange={event=>setEvidenceConfidence(event.target.value as ArchiveRelationEvidenceConfidence)}><option value="low">Düşük</option><option value="medium">Orta</option><option value="high">Yüksek</option></select></label><Button tone="primary" disabled={busy||!evidenceRelationId||!evidenceDate} onClick={()=>void addRelationEvidence()}>Kanıt olarak bağla</Button></div>{relationEvidence.length===0?<EmptyState title="Etkin ilişki kanıtı yok" body="Seçili belgeyi mevcut bir aile ilişkisine kanıt olarak bağlayabilirsiniz."/>:<div className="archive-evidence-list">{relationEvidence.map(item=><article key={item.id}><div><strong>{relationLabel(item.relationId)}</strong><small>{item.evidenceDate} · güven {item.confidence} · revizyon {item.revision}</small></div><Button tone="danger" disabled={busy} onClick={()=>void removeRelationEvidence(item)}>Etkin bağdan kaldır</Button></article>)}</div>}{showEvidenceHistory&&<div className="archive-evidence-history" aria-live="polite">{relationEvidenceHistory.length===0?<small>Henüz değişmez kanıt geçmişi yok.</small>:relationEvidenceHistory.map(item=><div key={item.mutationId}><strong>{item.mutationKind==='evidence_create'?'Eklendi':'Kaldırıldı'} · r{item.revision}</strong><small>{formatDate(item.occurredAt)} · {item.evidenceDate} · {item.confidence}</small></div>)}</div>}<small>Kaldırma fiziksel geçmiş silmez. Renderer hesap, sahip, dosya yolu, receipt veya ham dosya yetkisi almaz.</small></section><h3>Saklama politikası</h3><select value={selected.retentionPolicyId??''} onChange={event=>void assignPolicy(selected.id,event.target.value)}><option value="">Politika yok</option>{policies.map(policy=><option key={policy.id} value={policy.id}>{policy.name} · {policy.retentionDays} gün</option>)}</select>{selected.retainUntil&&<p className="muted">Saklama bitişi: {formatDate(selected.retainUntil)} · {selected.eligibleForDestruction?'İmhaya hazır':'Koruma altında'}</p>}</>:<EmptyState title="Belge seçilmedi" body="Ayrıntıları görmek için listeden bir belge seçin."/>}</article>
    <aside className="document-side"><article className="panel"><span className="eyebrow">Düzenleme</span><h2>Arşiv kategorileri</h2><form className="form-grid" onSubmit={event=>void createCategory(event)}><label className="span-2">Kategori adı<input name="name" required minLength={2} placeholder="Örn. Tapular"/></label><label className="span-2">Açıklama<input name="description" placeholder="Bu kategorinin kullanım amacı"/></label><Button type="submit">Kategori oluştur</Button></form>{categories.map(category=><div className="context-stat" key={category.id}><strong>{category.name}</strong><span>{category.description??'Açıklama yok'}</span></div>)}</article><article className="panel"><span className="eyebrow">Politika yönetimi</span><h2>Saklama politikaları</h2><form className="form-grid" onSubmit={event=>void createPolicy(event)}><label className="span-2">Politika adı<input name="name" required minLength={2}/></label><label>Gün<input name="days" type="number" min="1" max="36500" defaultValue="3650"/></label><label className="check-label"><input name="secure" type="checkbox" defaultChecked/>Güvenli imha</label><Button type="submit">Politika oluştur</Button></form>{policies.map(policy=><div className="context-stat" key={policy.id}><strong>{policy.name}</strong><span>{policy.retentionDays} gün · {policy.secureDestroy?'güvenli imha':'standart silme'}</span></div>)}</article><article className="panel"><span className="eyebrow">{dueQueue.length} yüklü kayıt</span><h2>İmha kuyruğu</h2>{dueQueue.length?dueQueue.map(item=><div className="destruction-row" key={item.id}><div><strong>{item.title}</strong><span>{item.retentionPolicyName} · {item.retainUntil?formatDate(item.retainUntil):''}</span></div><Button tone="danger" disabled={busy} onClick={()=>void destroy(item.id)}>Güvenli imha</Button></div>):<EmptyState title="Kuyruk boş" body="Yüklenen sayfada saklama süresi dolmuş belge yok."/>}</article></aside></section>
    {selected?.ownershipBinding==='legacy_unverified'&&<section className="panel archive-ownership-reattestation" aria-label="Eski arşiv sahipliğini yeniden doğrulama"><SectionHeader eyebrow="Eski kayıt · Sahiplik doğrulanmamış" title="Bu belgeyi kendi adınıza üstlenin"/><p>Bu kayıt eski sürümden geldiği için kişi sahibi mühürlü değildir. İşlem yalnız oturumdaki aile yöneticisinin kendi kişi profiline bağlanır; başka bir kişi seçilemez ve sonradan sahip değiştirilemez.</p><p className="muted">Onay metni: <code>{archiveLegacyOwnershipReattestationConfirmation(selected.id)}</code></p><div className="form-grid"><label>Parola<input type="password" autoComplete="current-password" value={reattestPassword} onChange={event=>setReattestPassword(event.target.value)}/></label><label>İki aşamalı doğrulama kodu (varsa)<input inputMode="numeric" autoComplete="one-time-code" value={reattestCode} onChange={event=>setReattestCode(event.target.value.replace(/\s+/gu,''))}/></label><label className="span-2">Onay metnini birebir yazın<input value={reattestConfirmation} onChange={event=>setReattestConfirmation(event.target.value)}/></label><Button tone="danger" disabled={busy||!reattestPassword||reattestConfirmation!==archiveLegacyOwnershipReattestationConfirmation(selected.id)} onClick={()=>void reattestLegacyOwnership()}>{busy?'Doğrulanıyor…':'Güçlü doğrulamayla sahipliği üstlen'}</Button></div></section>}
    <LocalGovernedOcrPanel selectedSource={selected ? {
      id:selected.id,title:selected.title,originalName:selected.originalName,mimeType:selected.mimeType,sizeBytes:selected.sizeBytes
    } : undefined}/>
  </>;
  return localizeArchiveCenterNode(panel,language);
}

function playParsBrandSound(): void {
  if(readBrandAudioMuted(browserPreferenceStorage()))return;
  try {
    const AudioContextCtor=globalThis.AudioContext ?? (globalThis as typeof globalThis & {webkitAudioContext?:typeof AudioContext}).webkitAudioContext;
    if(!AudioContextCtor)return;
    const ctx=new AudioContextCtor();
    const master=ctx.createGain();master.gain.setValueAtTime(0.0001,ctx.currentTime);master.gain.exponentialRampToValueAtTime(0.16,ctx.currentTime+0.05);master.gain.exponentialRampToValueAtTime(0.0001,ctx.currentTime+0.9);master.connect(ctx.destination);
    const low=ctx.createOscillator();low.type='sawtooth';low.frequency.setValueAtTime(92,ctx.currentTime);low.frequency.exponentialRampToValueAtTime(48,ctx.currentTime+0.8);const lowGain=ctx.createGain();lowGain.gain.value=0.55;low.connect(lowGain).connect(master);
    const buffer=ctx.createBuffer(1,Math.floor(ctx.sampleRate*0.9),ctx.sampleRate);const data=buffer.getChannelData(0);for(let i=0;i<data.length;i++)data[i]=(Math.random()*2-1)*(1-i/data.length);const noise=ctx.createBufferSource();noise.buffer=buffer;const filter=ctx.createBiquadFilter();filter.type='lowpass';filter.frequency.value=420;const noiseGain=ctx.createGain();noiseGain.gain.value=0.28;noise.connect(filter).connect(noiseGain).connect(master);
    low.start();noise.start();low.stop(ctx.currentTime+0.9);noise.stop(ctx.currentTime+0.9);globalThis.setTimeout(()=>void ctx.close().catch(()=>undefined),1100);
  } catch {
    // Browser audio is optional; the visible introduction remains authoritative.
  }
}

function FirstRunIntroduction({audioMuted,onAudioMutedChange,onComplete}:{audioMuted:boolean;onAudioMutedChange:(muted:boolean)=>void;onComplete:()=>void}){
  const {language,t}=useLocalization();
  const narration=firstRunNarrationContent(language);
  const [narrationStatus,setNarrationStatus]=useState<FirstRunNarrationStatus>(audioMuted?'muted':'idle');
  const [narrationRate,setNarrationRate]=useState<'normal'|'slow'>('normal');
  const narrationEnvironment=():{synthesis?:SpeechSynthesis;createUtterance?:(text:string)=>SpeechSynthesisUtterance}=>{
    try {
      const synthesis=globalThis.speechSynthesis;
      const Utterance=globalThis.SpeechSynthesisUtterance;
      return synthesis&&Utterance?{synthesis,createUtterance:(text:string)=>new Utterance(text)}:{};
    } catch {
      return {};
    }
  };
  const cancelNarration=()=>cancelFirstRunNarration(narrationEnvironment().synthesis);
  const speak=(muted=audioMuted)=>{
    const environment=narrationEnvironment();
    return startFirstRunNarration({muted,language,rate:narrationRate,synthesis:environment.synthesis,createUtterance:environment.createUtterance,onStatus:setNarrationStatus});
  };
  useEffect(()=>{if(audioMuted){cancelNarration();setNarrationStatus('muted');return;}speak(false);return()=>{cancelNarration();};},[audioMuted]);
  const toggleMuted=()=>{const next=!audioMuted;onAudioMutedChange(next);if(next){cancelNarration();setNarrationStatus('muted');}};
  const complete=()=>{cancelNarration();persistFirstRunIntroductionComplete(browserPreferenceStorage());playParsBrandSound();onComplete();};
  const speaking=narrationStatus==='speaking';
  const narrationStatusText=audioMuted?t('intro.audioMuted'):narrationStatus==='unavailable'?t('intro.audioUnavailable'):narrationStatus==='error'?t('intro.audioError'):speaking?t('intro.audioPlaying'):t('intro.audioReady');
  return <main className="first-run-shell"><section className="first-run-card"><div className="first-run-brand"><img src={brandMarkUrl} alt=""/><span className="eyebrow">{t('intro.eyebrow')}</span><h1>ParsYuva AYM<br/><small>{t('brand.subtitle')}</small></h1></div><p className="first-run-lead">{t('intro.lead')}</p><ol className="first-run-steps">{narration.steps.map((step,index)=><li key={step}><span>{index+1}</span><p>{step.replace(/^(?:(?:Birinci|İkinci|Üçüncü) adım|Step (?:one|two|three)):\s*/u,'')}</p></li>)}</ol><div className="first-run-caption" aria-live="polite"><strong>{t('intro.caption')}</strong><p>{narration.text}</p><small role="status">{narrationStatusText} · {narrationRate==='slow'?t('intro.slowSpeed'):t('intro.normalSpeed')}</small></div><div className="first-run-actions"><Button onClick={toggleMuted}>{audioMuted?t('intro.unmute'):t('intro.mute')}</Button><Button onClick={()=>{if(speaking){cancelNarration();setNarrationStatus('idle');}else speak(false);}} disabled={audioMuted||narrationStatus==='unavailable'}>{speaking?t('intro.stop'):t('intro.restart')}</Button><Button onClick={()=>{cancelNarration();setNarrationStatus('idle');setNarrationRate(value=>value==='normal'?'slow':'normal');}}>{narrationRate==='slow'?t('intro.normal'):t('intro.slower')}</Button><Button tone="primary" onClick={complete}>{t('intro.start')}</Button></div><button className="first-run-skip" type="button" onClick={complete}>{t('intro.skip')}</button></section></main>;
}


function FirstRunSecuritySetup({onComplete}:{onComplete:(state:AuthStateView)=>void}){
  const {language,t}=useLocalization();
  const [setup,setSetup]=useState<TwoFactorSetupView|null>(null);
  const [code,setCode]=useState('');
  const [saved,setSaved]=useState(false);
  const [message,setMessage]=useState('');
  const begin=async()=>{try{if(!window.pardus)return;setSetup(await window.pardus.beginTwoFactorSetup());setMessage(language==='tr'?'Authenticator uygulamanıza anahtarı ekleyin ve kurtarma kodlarını güvenli yerde saklayın.':'Add the key to your authenticator application and keep the recovery codes in a safe place.');}catch(error){setMessage(error instanceof Error?error.message:language==='tr'?'Güvenlik kurulumu başlatılamadı.':'Security setup could not be started.');}};
  const finish=async()=>{try{if(!window.pardus||!setup||!saved||code.trim().length<6)return;const state=await window.pardus.enableTwoFactor({code:code.trim()});onComplete(state);playParsBrandSound();}catch(error){setMessage(error instanceof Error?error.message:language==='tr'?'Doğrulama kodu kabul edilmedi.':'The verification code was not accepted.');}};
  return <main className="first-run-security-shell"><section className="first-run-card panel"><img src={brandMarkUrl} alt="ParsYuva AYM"/><span className="eyebrow">{t('security.eyebrow')}</span><h1>{t('security.title')}</h1><p>{t('security.body')}</p>{!setup?<Button tone="primary" onClick={()=>void begin()}>{t('security.start')}</Button>:<><div className="notes-card"><strong>{t('security.authenticator')}</strong><small>{t('security.key')}: {setup.secret}</small><small>{t('security.uri')}: {setup.otpauthUri}</small><strong>{t('security.recoveryCodes')}</strong><small>{setup.recoveryCodes.join(' · ')}</small><Button onClick={()=>void navigator.clipboard.writeText(setup.recoveryCodes.join('\n'))}>{t('security.copy')}</Button></div><label>{t('security.code')}<input inputMode="numeric" autoComplete="one-time-code" value={code} onChange={event=>setCode(event.target.value.replace(/\s+/g,''))}/></label><label className="check-label"><input type="checkbox" checked={saved} onChange={event=>setSaved(event.target.checked)}/>{t('security.saved')}</label><Button tone="primary" disabled={!saved||code.trim().length<6} onClick={()=>void finish()}>{t('security.finish')}</Button></>}{message&&<StatusMessage tone="info">{message}</StatusMessage>}</section></main>;
}

export function InvitationAcceptancePanel({onAccepted,initiallyExpanded=false}:{onAccepted:(state:AuthStateView)=>Promise<void>;initiallyExpanded?:boolean}){
  const {language}=useLocalization();
  const text=(tr:string,en:string)=>language==='tr'?tr:en;
  const [expanded,setExpanded]=useState(initiallyExpanded);
  const [token,setToken]=useState('');
  const [displayName,setDisplayName]=useState('');
  const [password,setPassword]=useState('');
  const [inspection,setInspection]=useState<FamilyInvitationInspectionView>();
  const [message,setMessage]=useState('');
  const [busy,setBusy]=useState(false);
  const assessment=assessPassword(password);
  const inspect=async()=>{
    setMessage('');setInspection(undefined);
    if(!window.pardus||!token.trim()){setMessage(text('Davet kodunu eksiksiz yazın.','Enter the complete invitation code.'));return;}
    setBusy(true);
    try{setInspection(await window.pardus.inspectInvitation({token:token.trim()}));}
    catch(error){setMessage(error instanceof Error?error.message:text('Davet kodu doğrulanamadı.','The invitation code could not be verified.'));}
    finally{setBusy(false);}
  };
  const accept=async(event:FormEvent<HTMLFormElement>)=>{
    event.preventDefault();setMessage('');
    if(!inspection?.canAccept){setMessage(text('Önce geçerli davet kodunu doğrulayın.','Verify a valid invitation code first.'));return;}
    if(displayName.trim().length<2){setMessage(text('Ad soyad en az 2 karakter olmalıdır.','The full name must contain at least 2 characters.'));return;}
    if(!assessment.valid){setMessage(text('Parola bütün güvenlik koşullarını karşılamalıdır.','The password must meet every security requirement.'));return;}
    if(!window.pardus)return;
    setBusy(true);
    try{const state=await window.pardus.acceptInvitation({token:token.trim(),displayName:displayName.trim(),password});setToken('');setPassword('');await onAccepted(state);}
    catch(error){setMessage(error instanceof Error?error.message:text('Davet kabul edilemedi.','The invitation could not be accepted.'));}
    finally{setBusy(false);}
  };
  if(!expanded)return <button type="button" className="invitation-entry-toggle" onClick={()=>setExpanded(true)}>{text('Davet kodum var','I have an invitation code')}</button>;
  return <form className="invitation-accept-card" aria-labelledby="invitation-accept-title" onSubmit={event=>void accept(event)}>
    <div className="auth-heading"><span className="eyebrow">{text('Aile profili daveti','Family profile invitation')}</span><h2 id="invitation-accept-title">{text('Davetle katılın','Join by invitation')}</h2><p>{text('Kodu önce güvenli biçimde doğrulayın; geçerli bir davet yalnız bir kez kabul edilebilir.','Verify the code securely first; a valid invitation can be accepted only once.')}</p></div>
    <label>{text('Davet kodu','Invitation code')}<div className="invitation-token-row"><input autoComplete="one-time-code" value={token} onChange={event=>{setToken(event.target.value);setInspection(undefined);setMessage('');}} placeholder={text('Davet kodunu yapıştırın','Paste the invitation code')}/><Button type="button" disabled={busy||!token.trim()} onClick={()=>void inspect()}>{busy?text('Doğrulanıyor…','Verifying…'):text('Kodu doğrula','Verify code')}</Button></div></label>
    {inspection&&<StatusMessage tone={inspection.canAccept?'success':'danger'}>{inspection.message}{inspection.startsAt?` ${text('Başlangıç','Starts')}: ${formatDate(inspection.startsAt,{dateStyle:'medium',timeStyle:'short'})}.`:''}{inspection.endsAt?` ${text('Son tarih','Ends')}: ${formatDate(inspection.endsAt,{dateStyle:'medium',timeStyle:'short'})}.`:''}</StatusMessage>}
    {inspection?.canAccept&&<><label>{text('Adınız ve soyadınız','Your full name')}<input autoComplete="name" value={displayName} onChange={event=>setDisplayName(event.target.value)} minLength={2} required/></label><label>{text('Yeni yerel parola','New local password')}<input type="password" autoComplete="new-password" value={password} onChange={event=>setPassword(event.target.value)} minLength={12} required/><div className="password-checklist" aria-live="polite"><strong>{assessment.remainingCharacters?text(`${assessment.remainingCharacters} karakter daha gerekli`,`${assessment.remainingCharacters} more characters required`):text('Uzunluk koşulu tamam','Length requirement met')}</strong><span className={assessment.checks.uppercase?'ok':''}>{text('Büyük harf','Uppercase')}</span><span className={assessment.checks.lowercase?'ok':''}>{text('Küçük harf','Lowercase')}</span><span className={assessment.checks.digit?'ok':''}>{text('Rakam','Number')}</span><span className={assessment.checks.symbol?'ok':''}>{text('Sembol','Symbol')}</span></div></label><Button tone="primary" type="submit" disabled={busy||displayName.trim().length<2||!assessment.valid}>{busy?text('Profil hazırlanıyor…','Preparing profile…'):text('Daveti kabul et','Accept invitation')}</Button></>}
    {message&&<StatusMessage tone="danger">{message}</StatusMessage>}
    <button type="button" className="invitation-entry-toggle" onClick={()=>{setExpanded(false);setInspection(undefined);setMessage('');}}>{text('Normal girişe dön','Return to standard sign-in')}</button>
  </form>;
}

const windowsHelloOutcomeMessage = (
  outcome: WindowsHelloAuthenticationOutcome | WindowsHelloEnrollmentView['outcome']
): string => (getActiveUiLocale().toLowerCase().startsWith('tr')?{
  verified: 'Windows Hello doğrulaması tamamlandı.',
  enrolled: 'Windows Hello kaydı ve güvenli kasa bağı tamamlandı.',
  cancelled: 'Windows Hello doğrulaması kullanıcı tarafından iptal edildi.',
  retries_exhausted: 'Windows Hello deneme hakkı tükendi; parola ile devam edebilirsiniz.',
  device_not_present: 'Bu cihazda kullanılabilir bir Windows Hello donanımı bulunamadı.',
  not_configured_for_user: 'Windows Hello bu Windows kullanıcısı için yapılandırılmamış.',
  disabled_by_policy: 'Windows Hello sistem politikası tarafından kapatılmış.',
  device_busy: 'Windows Hello şu anda başka bir işlem tarafından kullanılıyor.',
  platform_not_supported: 'Bu işletim sistemi Windows Hello doğrulamasını desteklemiyor.',
  fallback_required: 'Windows Hello ile devam edilemedi; güçlü yerel parola kullanılmalı.',
  device_changed: 'Cihaz güvenlik bağı değişti; parola ile giriş yapıp yeniden kayıt olun.',
  principal_changed: 'Windows kullanıcı bağı değişti; parola ile giriş yapıp yeniden kayıt olun.',
  security_epoch_changed: 'Hesap güvenlik dönemi değişti; parola ve 2FA ile yeniden kayıt olun.',
  registration_not_found: 'Bu cihaz için etkin Windows Hello kaydı bulunamadı.',
  account_unavailable: 'Bağlı yerel hesap kullanılamıyor.',
  error: 'Windows Hello işlemi güvenli biçimde tamamlanamadı.'
}:{
  verified: 'Windows Hello verification is complete.',
  enrolled: 'Windows Hello enrollment and the secure-vault binding are complete.',
  cancelled: 'Windows Hello verification was cancelled by the user.',
  retries_exhausted: 'Windows Hello attempts are exhausted; you can continue with your password.',
  device_not_present: 'No available Windows Hello hardware was found on this device.',
  not_configured_for_user: 'Windows Hello is not configured for this Windows user.',
  disabled_by_policy: 'Windows Hello is disabled by system policy.',
  device_busy: 'Windows Hello is currently being used by another operation.',
  platform_not_supported: 'This operating system does not support Windows Hello verification.',
  fallback_required: 'Windows Hello could not continue; a strong local password is required.',
  device_changed: 'The device security binding changed; sign in with your password and enroll again.',
  principal_changed: 'The Windows user binding changed; sign in with your password and enroll again.',
  security_epoch_changed: 'The account security epoch changed; enroll again with your password and 2FA.',
  registration_not_found: 'No active Windows Hello enrollment was found for this device.',
  account_unavailable: 'The linked local account is unavailable.',
  error: 'The Windows Hello operation could not be completed securely.'
})[outcome];

export function AuthScreen({ auth, onSetup, onLogin, onWindowsHelloLogin, onInvitationAccepted }: { auth: AuthStateView; onSetup:(input:SetupAdminInput)=>Promise<void>; onLogin:(input:LoginInput)=>Promise<void>; onWindowsHelloLogin:(input:LoginWithWindowsHelloInput)=>Promise<void>; onInvitationAccepted:(state:AuthStateView)=>Promise<void> }) {
  const {language,t}=useLocalization();
  const [familyName,setFamilyName]=useState('');
  const [displayName,setDisplayName]=useState('');
  const [selectedAccountId,setSelectedAccountId]=useState(auth.profiles?.[0]?.id ?? '');
  const [password,setPassword]=useState('');
  const [passwordVisible,setPasswordVisible]=useState(false);
  const [secondFactorCode,setSecondFactorCode]=useState('');
  const [error,setError]=useState('');
  const [busy,setBusy]=useState(false);
  const [helloBusy,setHelloBusy]=useState(false);
  const [submitAttempted,setSubmitAttempted]=useState(false);
  const [helloState,setHelloState]=useState<WindowsHelloStateView|null>(null);
  const [externalProviders,setExternalProviders]=useState<ExternalIdentityProviderView[]>([]);
  const familyNameRef=useRef<HTMLInputElement>(null);
  const displayNameRef=useRef<HTMLInputElement>(null);
  const passwordRef=useRef<HTMLInputElement>(null);
  const passwordAssessment=assessPassword(password);
  const profiles=auth.profiles ?? [];
  const familyNameInvalid=submitAttempted&&!auth.initialized&&familyName.trim().length<2;
  const displayNameInvalid=submitAttempted&&!auth.initialized&&displayName.trim().length<2;
  const passwordInvalid=submitAttempted&&(!auth.initialized?!passwordAssessment.valid:password.length===0);
  useEffect(()=>{if(!selectedAccountId&&profiles[0])setSelectedAccountId(profiles[0].id);},[profiles,selectedAccountId]);
  useEffect(()=>{void window.pardus?.getExternalIdentityProviders().then(setExternalProviders).catch(()=>setExternalProviders([]));},[]);
  useEffect(()=>{
    if(!auth.initialized||!window.pardus)return;
    let active=true;
    void window.pardus.getWindowsHelloState().then(state=>{if(active)setHelloState(state);}).catch(()=>{if(active)setHelloState(null);});
    return()=>{active=false;};
  },[auth.initialized]);
  const loginWithHello=async()=>{
    setError('');setHelloBusy(true);
    try{await onWindowsHelloLogin(selectedAccountId?{accountId:selectedAccountId}:{});}
    catch(caught){setError(caught instanceof Error?caught.message:language==='tr'?'Windows Hello ile giriş tamamlanamadı.':'Windows Hello sign-in could not be completed.');}
    finally{setHelloBusy(false);}
  };
  const submit=async()=>{
    if(busy||helloBusy)return;
    setSubmitAttempted(true);
    setError('');
    if(auth.initialized&&profiles.length>0&&!selectedAccountId){setError(language==='tr'?'Devam etmek için bir profil seçin.':'Select a profile to continue.');return;}
    if(!auth.initialized&&familyName.trim().length<2){setError(language==='tr'?'Aile adı en az 2 karakter olmalıdır. Eksik alan işaretlendi.':'The family name must contain at least 2 characters. The missing field is highlighted.');familyNameRef.current?.focus();return;}
    if(!auth.initialized&&displayName.trim().length<2){setError(language==='tr'?'Adınız ve soyadınız en az 2 karakter olmalıdır. Eksik alan işaretlendi.':'Your full name must contain at least 2 characters. The missing field is highlighted.');displayNameRef.current?.focus();return;}
    if(!auth.initialized&&!passwordAssessment.valid){setError(language==='tr'?'Parola en az 12 karakter; büyük harf, küçük harf, rakam ve simge içermelidir.':'The password must contain at least 12 characters, including uppercase, lowercase, a number and a symbol.');passwordRef.current?.focus();return;}
    if(auth.initialized&&password.length===0){setError(language==='tr'?'Devam etmek için yerel parolanızı yazın.':'Enter your local password to continue.');passwordRef.current?.focus();return;}
    setBusy(true);
    try{
      if(auth.initialized)await onLogin({...(selectedAccountId?{accountId:selectedAccountId}:{}),password,...(secondFactorCode.trim()?{secondFactorCode:secondFactorCode.trim()}:{})});
      else await onSetup({familyName:familyName.trim(),displayName:displayName.trim(),password});
    }catch(x){setError(x instanceof Error?x.message:language==='tr'?'İşlem başarısız.':'The operation failed.');}
    finally{setBusy(false)}
  };
  return <main className="auth-shell">
    <section className="auth-story" aria-label="ParsYuva AYM">
      <div className="auth-brand"><img src={brandMarkUrl} alt=""/><div><strong>ParsYuva AYM</strong><small>{t('brand.subtitle')}</small></div></div>
      <div className="auth-story-copy"><span className="eyebrow">{t('auth.private')}</span><h1>{t('auth.story').split('\n').map((line,index)=><span key={line}>{line}{index===0&&<br/>}</span>)}</h1><p>{t('auth.storyBody')}</p></div>
      <div className="auth-trust"><span>✓</span><div><strong>{t('auth.localData')}</strong><small>{t('auth.noOnlineAccount')}</small></div></div>
    </section>
    <section className="auth-entry">
      <form className="auth-form" aria-labelledby="auth-title" noValidate onSubmit={event=>{event.preventDefault();void submit();}}>
        <div className="auth-heading"><span className="eyebrow">{auth.initialized?t('auth.welcomeBack'):t('auth.firstStart')}</span><h2 id="auth-title">{auth.initialized?t('auth.selectProfile'):t('auth.createFamily')}</h2><p>{auth.initialized?t('auth.loginBody'):t('auth.setupBody')}</p></div>
        {!auth.initialized&&<div className="auth-fields"><label>{t('auth.familyName')}<input ref={familyNameRef} autoFocus autoComplete="organization" value={familyName} onChange={event=>{setFamilyName(event.target.value);setError('');}} required minLength={2} aria-invalid={familyNameInvalid} placeholder={t('auth.familyPlaceholder')}/></label><label>{t('auth.fullName')}<input ref={displayNameRef} autoComplete="name" value={displayName} onChange={event=>{setDisplayName(event.target.value);setError('');}} required minLength={2} aria-invalid={displayNameInvalid} placeholder={t('auth.namePlaceholder')}/></label></div>}
        {auth.initialized&&profiles.length>0&&<div className="profile-grid" role="radiogroup" aria-label={t('auth.localProfiles')}>{profiles.map(profile=><button type="button" role="radio" aria-checked={selectedAccountId===profile.id} className={`profile-card ${selectedAccountId===profile.id?'selected':''}`} key={profile.id} onClick={()=>setSelectedAccountId(profile.id)}><span>{profile.initials}</span><div><strong>{profile.displayName}</strong><small>{profile.role==='family_admin'?t('auth.admin'):t('auth.member')}</small></div><i>{selectedAccountId===profile.id?'✓':''}</i></button>)}</div>}
        <div className="auth-fields"><label>{t('auth.localPassword')}<div className="password-input-shell"><input id="local-password" ref={passwordRef} type={passwordVisible?'text':'password'} autoComplete={auth.initialized?'current-password':'new-password'} value={password} onChange={event=>{setPassword(event.target.value);setError('');}} required minLength={12} aria-invalid={passwordInvalid} placeholder={t('auth.passwordPlaceholder')}/><button type="button" className="password-visibility-toggle" aria-controls="local-password" aria-pressed={passwordVisible} aria-label={passwordVisible?t('auth.hidePassword'):t('auth.showPassword')} onClick={()=>setPasswordVisible(value=>!value)}>{passwordVisible?(language==='tr'?'Gizle':'Hide'):(language==='tr'?'Göster':'Show')}</button></div>{!auth.initialized&&<div className="password-checklist" aria-live="polite"><strong>{passwordAssessment.remainingCharacters?t('auth.moreCharacters',{count:passwordAssessment.remainingCharacters}):t('auth.lengthComplete')}</strong><span className={passwordAssessment.checks.uppercase?'ok':''}>{t('auth.uppercase')}</span><span className={passwordAssessment.checks.lowercase?'ok':''}>{t('auth.lowercase')}</span><span className={passwordAssessment.checks.digit?'ok':''}>{t('auth.digit')}</span><span className={passwordAssessment.checks.symbol?'ok':''}>{t('auth.symbol')}</span></div>}</label>{auth.initialized&&<label>{language==='tr'?'İki aşamalı doğrulama kodu':'Two-factor authentication code'} <small>({language==='tr'?'etkinse':'if enabled'})</small><input value={secondFactorCode} onChange={e=>setSecondFactorCode(e.target.value)} inputMode="numeric" autoComplete="one-time-code" placeholder={language==='tr'?'6 haneli kod veya kurtarma kodu':'6-digit code or recovery code'}/></label>}</div>
        {externalProviders.some(p=>p.productionReady)&&<div className="external-identity-ready" aria-label={language==='tr'?'Haricî kimlik sağlayıcıları':'External identity providers'}>{externalProviders.filter(p=>p.productionReady).map(p=><span key={p.id}>{p.label}</span>)}</div>}
        {error&&<div className="form-error" role="alert">{error}</div>}
        {auth.initialized&&helloState?.enrolled&&<Button type="button" tone="primary" disabled={busy||helloBusy||helloState.availability!=='available'} onClick={()=>void loginWithHello()}>{helloBusy?(language==='tr'?'Windows Hello bekleniyor…':'Waiting for Windows Hello…'):(language==='tr'?'Windows Hello ile devam et':'Continue with Windows Hello')}</Button>}
        {auth.initialized&&helloState?.enrolled&&helloState.availability!=='available'&&<StatusMessage tone="info">{windowsHelloOutcomeMessage(helloState.availability)}</StatusMessage>}
        <Button tone="primary" type="button" disabled={busy||helloBusy} aria-describedby="auth-submit-guidance" onClick={()=>void submit()}>{busy?t('auth.working'):auth.initialized?t('auth.login'):t('auth.create')}</Button>
        <p id="auth-submit-guidance" className="auth-submit-guidance" aria-live="polite">{busy?(language==='tr'?'Güvenli yerel alan hazırlanıyor; lütfen bekleyin.':'The secure local space is being prepared; please wait.'):auth.initialized?(language==='tr'?'Profil ve parola doğrulandıktan sonra aile alanınız açılır.':'Your family space opens after the profile and password are verified.'):(language==='tr'?'Düğmeye bastığınızda eksik alan gösterilir; bilgiler uygunsa güvenli kurulum başlar.':'Missing fields are highlighted when you press the button; secure setup starts when the information is valid.')}</p>
        <small className="auth-footnote">{USER_VISIBLE_APP_INFO.releaseLabel} · {language==='tr'?USER_VISIBLE_APP_INFO.stage:'Bronze · Active Development'}</small>
      </form>
      {auth.initialized&&<InvitationAcceptancePanel onAccepted={onInvitationAccepted}/>}
    </section>
  </main>;
}

export function AddRelationModal({ fallbackPeople = [], onClose, onSave }:{fallbackPeople?:readonly FamilyMemberView[];onClose:()=>void;onSave:(input:CreateFamilyRelationInput)=>Promise<void>}){
 const {language}=useLocalization();const text=(tr:string,en:string)=>language==='tr'?tr:en;
 const [fromPersonId,setFromPersonId]=useState(''); const [toPersonId,setToPersonId]=useState(''); const [relationType,setRelationType]=useState<CreateFamilyRelationInput['relationType']>('parent'); const [error,setError]=useState('');
 const submit=async(e:FormEvent<HTMLFormElement>)=>{e.preventDefault();setError('');if(!fromPersonId||!toPersonId){setError(text('İki kişi seçilmelidir.','Two people must be selected.'));return;}if(fromPersonId===toPersonId){setError(text('Aynı kişi iki kez seçilemez.','The same person cannot be selected twice.'));return;}try{await onSave({fromPersonId,toPersonId,relationType});onClose();}catch(x){setError(x instanceof Error?x.message:text('İlişki eklenemedi.','The relationship could not be added.'))}};
 return <Modal title={text('Aile ilişkisi ekle','Add family relationship')} subtitle={text('İki kişi arasındaki bağı arama destekli katalogdan seçerek soy ağacına kaydedin.','Select the connection between two people from the searchable catalog and save it to the family tree.')} onClose={onClose}><form className="form-grid" onSubmit={e=>void submit(e)}><PersonCatalogSelect label={text('Birinci kişi','First person')} value={fromPersonId} onChange={setFromPersonId} excludeIds={toPersonId?[toPersonId]:[]} fallbackPeople={fallbackPeople}/><PersonCatalogSelect label={text('İkinci kişi','Second person')} value={toPersonId} onChange={setToPersonId} excludeIds={fromPersonId?[fromPersonId]:[]} fallbackPeople={fallbackPeople}/><label className="span-2">{text('İlişki','Relationship')}<select value={relationType} onChange={event=>setRelationType(event.target.value as CreateFamilyRelationInput['relationType'])}><option value="parent">{text('Ebeveyn','Parent')}</option><option value="spouse">{text('Eş','Spouse')}</option><option value="sibling">{text('Kardeş','Sibling')}</option><option value="guardian">{text('Vasi','Guardian')}</option><option value="other">{text('Diğer','Other')}</option></select></label>{error&&<div className="form-error span-2">{error}</div>}<div className="modal-actions span-2"><Button type="button" onClick={onClose}>{text('İptal','Cancel')}</Button><Button tone="primary" type="submit">{text('Kaydet','Save')}</Button></div></form></Modal>;
}

export function DigitalLegacyScreen({ snapshot }: { snapshot: FamilyAppSnapshot }) {
  const {language}=useLocalization();
  const [plans,setPlans]=useState<DigitalLegacyPlanView[]>([]); const [accounts,setAccounts]=useState<FamilyAccountView[]>([]); const [grants,setGrants]=useState<LegacyGrantView[]>([]); const [approvals,setApprovals]=useState<LegacyApprovalView[]>([]); const [selectedId,setSelectedId]=useState(''); const [error,setError]=useState(''); const [busy,setBusy]=useState(false); const [nowTick,setNowTick]=useState(Date.now());
  const reload=async(preferredId?:string)=>{if(!window.pardus)return; const [p,a]=await Promise.all([window.pardus.listDigitalLegacyPlans(),window.pardus.listAccounts()]); setPlans(p);setAccounts(a);const id=preferredId??selectedId??p[0]?.id??''; if(id){setSelectedId(id); const [g,ap]=await Promise.all([window.pardus.listLegacyGrants(id),window.pardus.listLegacyApprovals(id)]);setGrants(g);setApprovals(ap);} else {setGrants([]);setApprovals([]);} };
  useEffect(()=>{void reload();const timer=window.setInterval(()=>setNowTick(Date.now()),1000);return()=>window.clearInterval(timer);},[]);
  useEffect(()=>{if(selectedId) void (async()=>{if(!window.pardus)return;setGrants(await window.pardus.listLegacyGrants(selectedId));setApprovals(await window.pardus.listLegacyApprovals(selectedId));})();},[selectedId]);
  const selected=plans.find(p=>p.id===selectedId); const accountName=(id?:string)=>accounts.find(a=>a.id===id)?.displayName??translateDigitalLegacyCopy('Hesap bulunamadı',language); const personName=(id:string)=>snapshot.people.find(p=>p.id===id)?.displayName??translateDigitalLegacyCopy('Kişi bulunamadı',language);
  const statusLabel:Record<DigitalLegacyPlanView['status'],string>={draft:'Taslak',active:'Etkin',suspended:'Askıda',pending_execution:'Yürütme bekliyor',executed:'Yürütüldü',revoked:'İptal edildi'};
  const countdown=(iso?:string)=>{if(!iso)return '—';const ms=new Date(iso).getTime()-nowTick;if(ms<=0)return translateDigitalLegacyCopy('Süre tamamlandı',language);const d=Math.floor(ms/86400000),h=Math.floor(ms%86400000/3600000),m=Math.floor(ms%3600000/60000),sec=Math.floor(ms%60000/1000);return language==='tr'?`${d}g ${h}s ${m}dk ${sec}sn`:`${d}d ${h}h ${m}min ${sec}sec`;};
  const run=async(action:()=>Promise<DigitalLegacyPlanView[]>)=>{setBusy(true);setError('');try{const p=await action();setPlans(p);await reload(selectedId);}catch(e){setError(e instanceof Error?e.message:translateDigitalLegacyCopy('İşlem başarısız.',language));}finally{setBusy(false)}};
  const submitPlan=async(e:FormEvent<HTMLFormElement>)=>{e.preventDefault();if(!window.pardus)return;const d=new FormData(e.currentTarget);const secondary=String(d.get('secondary')); const instructions=String(d.get('instructions')); await run(()=>window.pardus!.upsertDigitalLegacyPlan({ownerPersonId:String(d.get('owner')),title:String(d.get('title')),status:'active',triggerType:'death_confirmation',trusteeAccountId:String(d.get('trustee')),...(secondary?{secondaryTrusteeAccountId:secondary}:{}),...(instructions?{instructions}:{}),waitingDays:Number(d.get('waitingDays')),rollbackHours:Number(d.get('rollbackHours'))}));e.currentTarget.reset();};
  const submitGrant=async(e:FormEvent<HTMLFormElement>)=>{e.preventDefault();if(!window.pardus||!selected)return;const d=new FormData(e.currentTarget);const actions=['read','create','update','delete','share','record'].filter(x=>d.get(x)==='on') as ObjectPermissionAction[];setBusy(true);setError('');try{setGrants(await window.pardus.upsertLegacyGrant({planId:selected.id,resourceType:String(d.get('resourceType')),resourceId:String(d.get('resourceId'))||'*',actions}));e.currentTarget.reset();}catch(x){setError(x instanceof Error?x.message:translateDigitalLegacyCopy('Yetki paketi eklenemedi.',language));}finally{setBusy(false)}};
  const approvedCount=new Set(approvals.filter(a=>a.decision==='approved').map(a=>a.approverAccountId)).size; const checklist=selected?[{ok:selected.status==='active'||selected.status==='pending_execution'||selected.status==='executed',text:'Plan etkin durumda'},{ok:!!selected.trusteeAccountId,text:'Birincil emanetçi atanmış'},{ok:grants.length>0,text:'En az bir yetki paketi tanımlanmış'},{ok:selected.instructions?.trim().length?true:false,text:'Talimatlar yazılmış'},{ok:selected.waitingDays>=1,text:'Bekleme süresi tanımlanmış'},{ok:selected.rollbackHours>=1,text:'Geri alma penceresi tanımlanmış'}]:[];
  const panel=<><PageHeader eyebrow="Kritik güvenlik alanı" title="Dijital Miras Yönetimi" description="Vefat sonrası erişim devrini çift yönetici onayı, zaman kilidi ve geri alma penceresiyle yönetin."/><MemoryStudioPanel/>
  <section className="legacy-layout"><article className="panel legacy-list"><div className="panel-heading"><div><span className="eyebrow">{plans.length} plan</span><h2>Miras planları</h2></div></div>{plans.length?plans.map(p=><button key={p.id} className={`legacy-plan-row ${p.id===selectedId?'selected':''}`} onClick={()=>setSelectedId(p.id)}><span className={`status-pill ${p.status}`}>{statusLabel[p.status]}</span><strong>{p.title}</strong><small>{personName(p.ownerPersonId)} · {p.waitingDays} gün bekleme</small></button>):<EmptyState title="Plan bulunamadı" body="İlk dijital miras planını oluşturun."/>}</article>
  <article className="panel legacy-detail">{selected?<><div className="legacy-hero"><div><span className="eyebrow">Plan sahibi</span><h2>{selected.title}</h2><p>{personName(selected.ownerPersonId)} · Birincil emanetçi: {accountName(selected.trusteeAccountId)}</p></div><span className={`status-pill ${selected.status}`}>{statusLabel[selected.status]}</span></div>
  <div className="legacy-countdowns"><div><small>Bekleme süresi</small><strong>{selected.status==='pending_execution'?countdown(selected.executeAfter):'Başlatılmadı'}</strong></div><div><small>Geri alma penceresi</small><strong>{selected.status==='executed'?countdown(selected.rollbackUntil):'Açık değil'}</strong></div><div><small>Yönetici onayı</small><strong>{approvedCount}/2</strong></div></div>
  <div className="legacy-columns"><section><span className="eyebrow">Güvenlik kontrol listesi</span>{checklist.map(item=><div className={`security-check ${item.ok?'ok':''}`} key={item.text}><span>{item.ok?'✓':'!'}</span><strong>{item.text}</strong></div>)}</section><section><span className="eyebrow">Onaylayan yöneticiler</span>{approvals.length?approvals.map(a=><div className="approval-row" key={a.id}><span>{a.decision==='approved'?'✓':'×'}</span><div><strong>{accountName(a.approverAccountId)}</strong><small>{a.decision==='approved'?'Onayladı':'Reddetti'} · {formatDate(a.createdAt,{day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'})}</small>{a.note&&<p>{a.note}</p>}</div></div>):<p className="muted-copy">Henüz onay kaydı yok.</p>}</section></div>
  <div className="legacy-actions">{selected.status==='active'&&<Button tone="danger" disabled={busy} onClick={()=>{const note=prompt(translateDigitalLegacyCopy('Vefat doğrulama notu (en az 10 karakter):',language))??'';if(note&&window.pardus)void run(()=>window.pardus!.executeDigitalLegacyPlan({planId:selected.id,confirmationNote:note}));}}>Yürütme isteği başlat</Button>}{selected.status==='pending_execution'&&<><Button tone="primary" disabled={busy} onClick={()=>window.pardus&&void run(()=>window.pardus!.approveLegacyExecution({planId:selected.id,decision:'approved',note:language==='tr'?'Yönetici ekranından onaylandı.':'Approved from the administrator screen.'}))}>Yönetici olarak onayla</Button><Button disabled={busy} onClick={()=>window.pardus&&void run(()=>window.pardus!.finalizeLegacyExecution(selected.id))}>Süre dolduysa kesinleştir</Button><Button tone="danger" disabled={busy} onClick={()=>window.pardus&&void run(()=>window.pardus!.cancelLegacyExecution({planId:selected.id,reason:language==='tr'?'Yönetim ekranından geri alındı.':'Withdrawn from the administration screen.'}))}>İsteği geri al</Button></>}{selected.status==='executed'&&<Button tone="danger" disabled={busy} onClick={()=>window.pardus&&void run(()=>window.pardus!.cancelLegacyExecution({planId:selected.id,reason:language==='tr'?'Geri alma penceresinde iptal edildi.':'Cancelled during the rollback window.'}))}>Yetki devrini geri al</Button>}</div>
  <section className="legacy-grants"><div className="panel-heading"><div><span className="eyebrow">{grants.length} paket</span><h3>Aktarılacak yetkiler</h3></div></div>{grants.map(g=><div className="grant-row" key={g.id}><strong>{g.resourceType}:{g.resourceId}</strong><span>{g.actions.join(', ')}</span></div>)}<form className="grant-form" onSubmit={e=>void submitGrant(e)}><input name="resourceType" placeholder="Kaynak türü" required/><input name="resourceId" placeholder="Kayıt kimliği veya *" defaultValue="*"/><div className="check-row">{['read','create','update','delete','share','record'].map(a=><label key={a}><input type="checkbox" name={a} defaultChecked={a==='read'}/>{a}</label>)}</div><Button type="submit" disabled={busy}>Yetki paketi ekle</Button></form></section></>:<EmptyState title="Plan seçilmedi" body="Ayrıntıları görmek için soldan bir plan seçin."/>}</article>
  <article className="panel legacy-create"><span className="eyebrow">Yeni plan</span><h2>Plan oluştur</h2><form className="form-grid" onSubmit={e=>void submitPlan(e)}><label className="span-2">Başlık<input name="title" required minLength={3}/></label><label>Plan sahibi<select name="owner">{snapshot.people.map(p=><option key={p.id} value={p.id}>{p.displayName}</option>)}</select></label><label>Birincil emanetçi<select name="trustee">{accounts.map(a=><option key={a.id} value={a.id}>{a.displayName}</option>)}</select></label><label>İkincil emanetçi<select name="secondary"><option value="">Yok</option>{accounts.map(a=><option key={a.id} value={a.id}>{a.displayName}</option>)}</select></label><label>Bekleme (gün)<input name="waitingDays" type="number" min="1" max="90" defaultValue="7"/></label><label>Geri alma (saat)<input name="rollbackHours" type="number" min="1" max="168" defaultValue="24"/></label><label className="span-2">Talimatlar<textarea name="instructions" rows={4}/></label><Button tone="primary" type="submit" disabled={busy}>Planı kaydet</Button></form>{error&&<div className="form-error">{error}</div>}</article></section></>;
  return localizeDigitalLegacyNode(panel,language);
}

export function AiGovernanceScreen() {
  const {language}=useLocalization();
  const [purpose,setPurpose]=useState<AiConsentPurpose>('search');
  const [resourceType,setResourceType]=useState('event');
  const [resourceId,setResourceId]=useState('*');
  const [consents,setConsents]=useState<AiConsentView[]>([]);
  const [preview,setPreview]=useState<AiAccessPreviewView>();
  const [profiles,setProfiles]=useState<SensitiveDataProfileView[]>([]);
  const [sensitiveCategory,setSensitiveCategory]=useState<SensitiveDataCategory>('child');
  const [sensitivePurpose,setSensitivePurpose]=useState<SensitiveDataConsentPurpose>('sensitive_processing');
  const [durationMinutes,setDurationMinutes]=useState(1_440);
  const [explicitConsent,setExplicitConsent]=useState(false);
  const [exportCategories,setExportCategories]=useState<SensitiveDataCategory[]>(['child','health','finance','location']);
  const [destinationLabel,setDestinationLabel]=useState(()=>translateAiGovernanceCopy('Kullanıcının seçtiği dış hedef',language));
  const [businessPurpose,setBusinessPurpose]=useState(()=>translateAiGovernanceCopy('Aile yöneticisinin açıkça belirttiği paylaşım amacı',language));
  const [exportPreview,setExportPreview]=useState<SensitiveExportPreviewView>();
  const [error,setError]=useState('');
  const [busy,setBusy]=useState(false);
  const categories:readonly SensitiveDataCategory[]=['child','health','finance','location'];
  const effectiveLabel:Record<SensitiveDataProfileView['aiProcessing']['effectiveStatus'],string>={default_denied:'Varsayılan ret',granted:'Etkin onay',revoked:'İptal edildi',expired:'Süresi doldu',scheduled:'Planlandı'};

  const reload=async(p:AiConsentPurpose=purpose)=>{
    if(!window.pardus)return;
    const [c,v,s]=await Promise.all([window.pardus.listAiConsents(),window.pardus.previewAiAccess(p),window.pardus.listSensitiveDataProfiles()]);
    setConsents(c);setPreview(v);setProfiles(s);
  };
  useEffect(()=>{void reload().catch(e=>setError(e instanceof Error?e.message:translateAiGovernanceCopy('İzin merkezi yüklenemedi.',language)));},[]);

  const run=async(action:()=>Promise<void>)=>{setBusy(true);setError('');try{await action();}catch(e){setError(e instanceof Error?e.message:translateAiGovernanceCopy('İşlem tamamlanamadı.',language));}finally{setBusy(false)}};
  const save=async(status:'granted'|'revoked')=>run(async()=>{if(!window.pardus)return;setConsents(await window.pardus.upsertAiConsent({purpose,resourceType,resourceId,status}));setPreview(await window.pardus.previewAiAccess(purpose));});
  const saveSensitive=async(status:'granted'|'revoked')=>run(async()=>{if(!window.pardus)return;setProfiles(await window.pardus.upsertSensitiveDataConsent({category:sensitiveCategory,purpose:sensitivePurpose,status,durationMinutes,explicitConsent}));setExplicitConsent(false);setExportPreview(undefined);});
  const createExportPreview=async()=>run(async()=>{if(!window.pardus)return;setExportPreview(await window.pardus.previewSensitiveExport({categories:exportCategories,destinationLabel,businessPurpose}));});
  const toggleExportCategory=(category:SensitiveDataCategory)=>setExportCategories(current=>current.includes(category)?current.filter(item=>item!==category):[...current,category]);

  const panel=<>
    <PageHeader eyebrow="Açık onay ve varsayılan ret" title="Yapay zekâ izin merkezi" description="Yapay zekâ işleme izinlerini ve çocuk, sağlık, finans, konum verilerinin dışa gönderim onaylarını birbirinden bağımsız yönetin."/>
    {error&&<StatusMessage tone="danger">{error}</StatusMessage>}
    <section className="workspace-grid">
      <article className="panel workspace-form">
        <span className="eyebrow">Standart AI kapsamı</span><h2>Kayıt onayı tanımla</h2>
        <label>Amaç<select value={purpose} onChange={e=>{const p=e.target.value as AiConsentPurpose;setPurpose(p);void reload(p);}}><option value="search">Doğal dil arama</option><option value="summary">Özetleme</option><option value="recommendation">Öneri</option><option value="classification">Sınıflandırma</option></select></label>
        <label>Kaynak<select value={resourceType} onChange={e=>setResourceType(e.target.value)}><option value="person">Aile üyeleri</option><option value="event">Zaman tüneli olayları</option><option value="archive_item">Arşiv belgeleri</option><option value="finance_record">Finans kayıtları</option><option value="health_record">Sağlık kayıtları</option><option value="life_record">Yaşam kayıtları</option><option value="local_ocr_job">Yerel OCR işleri</option><option value="household_operation_item">Ev operasyon kayıtları</option><option value="places_travel_item">Yer ve seyahat kayıtları</option></select></label>
        <label>Kayıt kimliği<input value={resourceId} onChange={e=>setResourceId(e.target.value)} placeholder="* tüm izinli kayıtlar"/></label>
        <div className="modal-actions"><Button tone="primary" disabled={busy} onClick={()=>void save('granted')}>Onay ver</Button><Button tone="danger" disabled={busy} onClick={()=>void save('revoked')}>Onayı geri çek</Button></div>
      </article>
      <article className="panel workspace-summary">
        <span className="eyebrow">Erişim önizlemesi</span><h2>{preview?.allowedResources.length??0} erişilebilir kayıt</h2>
        <div className="context-stat"><strong>{preview?.blockedCount??0}</strong><span>açıkça engellenmiş kapsam</span></div>
        {preview?.allowedResources.map(r=><div className="context-stat" key={`${r.resourceType}-${r.resourceId}`}><strong>{r.title}</strong><span>{r.resourceType} · {r.resourceId}</span></div>)}
        <h3>Onay geçmişi</h3>{consents.filter(c=>c.resourceType!=='sensitive_data_profile').slice(0,8).map(c=><small key={c.id}>{c.purpose} · {c.resourceType}:{c.resourceId} · {c.status}</small>)}
      </article>
      <article className="panel workspace-form">
        <span className="eyebrow">B2-05 hassasiyet profili</span><h2>Süreli ve açık rıza</h2>
        <label>Kategori<select value={sensitiveCategory} onChange={e=>setSensitiveCategory(e.target.value as SensitiveDataCategory)}>{profiles.map(profile=><option key={profile.category} value={profile.category}>{profile.label}</option>)}</select></label>
        <label>Kullanım amacı<select value={sensitivePurpose} onChange={e=>setSensitivePurpose(e.target.value as SensitiveDataConsentPurpose)}><option value="sensitive_processing">Yapay zekâ ile işleme</option><option value="external_export">Dışa gönderim</option></select></label>
        <label>Onay süresi<select value={durationMinutes} onChange={e=>setDurationMinutes(Number(e.target.value))}><option value={60}>1 saat</option><option value={1440}>24 saat</option><option value={10080}>7 gün</option><option value={43200}>30 gün</option></select></label>
        <label className="check-row"><input type="checkbox" checked={explicitConsent} onChange={e=>setExplicitConsent(e.target.checked)}/><span>Seçilen kategori, amaç ve süre için açık rıza veriyorum.</span></label>
        <div className="modal-actions"><Button tone="primary" disabled={busy||!explicitConsent} onClick={()=>void saveSensitive('granted')}>Süreli onay ver</Button><Button tone="danger" disabled={busy} onClick={()=>void saveSensitive('revoked')}>Derhal iptal et</Button></div>
      </article>
      <article className="panel workspace-summary">
        <span className="eyebrow">Görünür paylaşım durumu</span><h2>Dört korumalı kategori</h2>
        {profiles.map(profile=><div className="context-stat" key={profile.category}><strong>{profile.label}</strong><span>AI: {effectiveLabel[profile.aiProcessing.effectiveStatus]}{profile.aiProcessing.endsAt?` · ${formatDate(profile.aiProcessing.endsAt)}`:''}</span><span>Dışa gönderim: {effectiveLabel[profile.externalExport.effectiveStatus]}{profile.externalExport.endsAt?` · ${formatDate(profile.externalExport.endsAt)}`:''}</span></div>)}
      </article>
      <article className="panel workspace-form">
        <span className="eyebrow">B6-03 güvenli dışa gönderim</span><h2>Göndermeden önce önizle</h2>
        <label>Hedef açıklaması<input value={destinationLabel} maxLength={100} onChange={e=>setDestinationLabel(e.target.value)}/></label>
        <label>İş amacı<textarea value={businessPurpose} rows={3} maxLength={240} onChange={e=>setBusinessPurpose(e.target.value)}/></label>
        <div className="check-row">{categories.map(category=><label key={category}><input type="checkbox" checked={exportCategories.includes(category)} onChange={()=>toggleExportCategory(category)}/>{profiles.find(profile=>profile.category===category)?.label??category}</label>)}</div>
        <Button tone="primary" disabled={busy||exportCategories.length===0} onClick={()=>void createExportPreview()}>Veri göndermeden önizleme oluştur</Button>
      </article>
      <article className="panel workspace-summary">
        <span className="eyebrow">Dışa gönderim güvenlik özeti</span><h2>{exportPreview?`${exportPreview.totalRecordCount} kayıt alanı`:'Önizleme bekleniyor'}</h2>
        {exportPreview&&<><div className="context-stat"><strong>{exportPreview.transferAllowed?'Onaylar tamam':'Aktarım kapalı'}</strong><span>{exportPreview.warning}</span></div>{exportPreview.categories.map(category=><div className="context-stat" key={category.category}><strong>{category.label} · {category.recordCount}</strong><span>{category.approved?'Ayrı dışa gönderim onayı etkin':'Onay yok — engellendi'}</span><small>{category.fieldNames.join(', ')}</small></div>)}<small>Hedef: {exportPreview.destinationLabel} · Bu önizlemede dışa veri aktarımı: {exportPreview.outboundTransferPerformed?'Yapıldı':'Yapılmadı'}</small></>}
      </article>
    </section>
    <FamilyAiAssistantPanel/>
  </>;
  return localizeAiGovernanceNode(panel,language);
}


interface WorkspaceNoteDraft { readonly title:string; readonly note:string }
const EMPTY_WORKSPACE_NOTE:WorkspaceNoteDraft={title:'',note:''};
const validateWorkspaceNote=(draft:WorkspaceNoteDraft,language:'tr'|'en'):readonly ValidationIssue[]=>{
  const issues:ValidationIssue[]=[];
  if(!draft.title.trim())issues.push({fieldId:'governed-draft-title',message:translateDraftCenterCopy('Taslak başlığı zorunludur.',language)});
  else if(draft.title.trim().length>120)issues.push({fieldId:'governed-draft-title',message:translateDraftCenterCopy('Taslak başlığı 120 karakteri aşamaz.',language)});
  if(draft.note.length>5000)issues.push({fieldId:'governed-draft-note',message:translateDraftCenterCopy('Taslak notu 5.000 karakteri aşamaz.',language)});
  return issues;
};
const parseWorkspaceNote=(payloadJson:string):WorkspaceNoteDraft=>{
  try{const value=JSON.parse(payloadJson) as Record<string,unknown>;return{
    title:typeof value.title==='string'?value.title:'',note:typeof value.note==='string'?value.note:''
  };}catch{return EMPTY_WORKSPACE_NOTE;}
};

interface PendingFormDraftOperation { readonly clientOperationId:string; readonly expectedRevision:number }

export function GovernedFormDraftCenter({visible}:{readonly visible:boolean}){
  const {language}=useLocalization();
  const formKey='workspace.notes';
  const revisionRef=useRef(0);
  const saveChainRef=useRef<Promise<void>>(Promise.resolve());
  const operationsRef=useRef(new Map<number,PendingFormDraftOperation>());
  const undoOperationRef=useRef<PendingFormDraftOperation|undefined>(undefined);
  const undoInFlightRef=useRef(false);
  const workspaceRefreshGenerationRef=useRef(0);
  const [workspace,setWorkspace]=useState<FormDraftWorkspaceView>();
  const [loadState,setLoadState]=useState<'loading'|'ready'|'error'>('loading');
  const [online,setOnline]=useState(()=>globalThis.navigator?.onLine!==false);
  const [historyRefreshError,setHistoryRefreshError]=useState(false);
  const [undoError,setUndoError]=useState(false);
  const [undoing,setUndoing]=useState(false);
  const [validationFocusRequest,setValidationFocusRequest]=useState(0);
  const refreshWorkspace=async():Promise<boolean>=>{
    if(!window.pardus)return false;
    const generation=++workspaceRefreshGenerationRef.current;
    try{
      const next=await window.pardus.getFormDraftWorkspace(formKey);
      if(generation!==workspaceRefreshGenerationRef.current)return false;
      const nextRevision=next.current?.revision??0;
      revisionRef.current=Math.max(revisionRef.current,nextRevision);
      setWorkspace(current=>nextRevision>=(current?.current?.revision??0)?next:current);
      setHistoryRefreshError(false);
      return true;
    }catch{
      if(generation===workspaceRefreshGenerationRef.current)setHistoryRefreshError(true);
      return false;
    }
  };
  const load=async()=>{
    if(!window.pardus)return;
    const generation=++workspaceRefreshGenerationRef.current;
    setLoadState('loading');
    try{
      const next=await window.pardus.getFormDraftWorkspace(formKey);
      if(generation!==workspaceRefreshGenerationRef.current)return;
      setWorkspace(next);revisionRef.current=next.current?.revision??0;
      draft.reset(next.current?parseWorkspaceNote(next.current.payloadJson):EMPTY_WORKSPACE_NOTE);
      setHistoryRefreshError(false);setUndoError(false);undoOperationRef.current=undefined;
      setLoadState('ready');
    }catch{if(generation===workspaceRefreshGenerationRef.current)setLoadState('error');}
  };
  const draft=useGovernedDraft<WorkspaceNoteDraft>(EMPTY_WORKSPACE_NOTE,{
    debounceMs:700,validate:value=>validateWorkspaceNote(value,language),
    save:async(value,{sequence,signal})=>{
      const queued=saveChainRef.current.catch(()=>undefined).then(async()=>{
        if(signal.aborted){operationsRef.current.delete(sequence);return;}
        const operation=operationsRef.current.get(sequence)??{
          clientOperationId:`draft-note-${crypto.randomUUID()}`,expectedRevision:revisionRef.current
        };
        operationsRef.current.set(sequence,operation);
        const stored=await window.pardus!.saveFormDraft({
          formKey,expectedRevision:operation.expectedRevision,clientOperationId:operation.clientOperationId,payload:{title:value.title,note:value.note}
        });
        revisionRef.current=Math.max(revisionRef.current,stored.revision);
        operationsRef.current.delete(sequence);
        if(!signal.aborted)setWorkspace(current=>({current:stored,history:current?.history??[]}));
        void refreshWorkspace();
      });
      saveChainRef.current=queued;await queued;
    }
  });
  useEffect(()=>{void load();},[]);
  useEffect(()=>{const onOnline=()=>setOnline(true),onOffline=()=>setOnline(false);globalThis.addEventListener('online',onOnline);globalThis.addEventListener('offline',onOffline);return()=>{globalThis.removeEventListener('online',onOnline);globalThis.removeEventListener('offline',onOffline);};},[]);
  const wasVisibleRef=useRef(visible);
  useEffect(()=>{
    const leavingVisibleRoute=wasVisibleRef.current&&!visible;
    wasVisibleRef.current=visible;
    if(leavingVisibleRoute&&draft.state.phase==='dirty')void draft.flush();
  },[visible,draft.state.phase,draft.flush]);
  const issues=validateWorkspaceNote(draft.draft,language);
  const visibleIssues=draft.state.phase==='invalid'?issues:[];
  const updateDraft=(value:WorkspaceNoteDraft)=>{undoOperationRef.current=undefined;setUndoError(false);draft.setDraft(value);};
  const saveNow=async()=>{
    if(issues.length>0){
      if(draft.state.phase!=='invalid')draft.setDraft(draft.draft);
      setValidationFocusRequest(value=>value+1);
      return;
    }
    await draft.flush();
  };
  const undo=async()=>{
    if(!window.pardus||revisionRef.current<2||undoInFlightRef.current||!canUndoGovernedDraft(draft.state.phase))return;
    const operation=undoOperationRef.current??{
      clientOperationId:`draft-undo-${crypto.randomUUID()}`,expectedRevision:revisionRef.current
    };
    undoOperationRef.current=operation;undoInFlightRef.current=true;setUndoing(true);setUndoError(false);
    try{
      const restored=await window.pardus.undoFormDraft({
        formKey,expectedRevision:operation.expectedRevision,clientOperationId:operation.clientOperationId
      });
      revisionRef.current=Math.max(revisionRef.current,restored.revision);
      undoOperationRef.current=undefined;
      draft.reset(parseWorkspaceNote(restored.payloadJson));
      setWorkspace(current=>({current:restored,history:current?.history??[]}));
      void refreshWorkspace();
    }catch{setUndoError(true);}
    finally{undoInFlightRef.current=false;setUndoing(false);}
  };
  if(loadState==='loading')return <AsyncStatePanel state="loading" title={translateDraftCenterCopy('Taslak merkezi yükleniyor',language)} message={translateDraftCenterCopy('Kişisel, sürümlü taslak ve değişiklik geçmişi hazırlanıyor.',language)}/>;
  if(loadState==='error')return <AsyncStatePanel state="error" title={translateDraftCenterCopy('Taslak merkezi yüklenemedi',language)} message={translateDraftCenterCopy('Kişisel taslak alanına güvenli erişim kurulamadı.',language)} onRetry={load}/>;
  const panel=<Surface className="workspace-summary governed-draft-center"><SectionHeader eyebrow="B3-02 · B7-14 · B7-15" title="Taslak, otomatik kayıt ve geri alma merkezi"/>
    {!online&&<AsyncStatePanel state="offline" title="Çevrimdışı çalışma" message="Ağ bağlantısı yok; yerel kayıt isteği yine merkezi PEP/UoW ve offline lease kararına gider. Ağ üzerinden teslim garantisi verilmez." onRetry={async()=>{setOnline(globalThis.navigator?.onLine!==false);if(draft.state.phase==='dirty'||draft.state.phase==='error')await draft.retry();else await refreshWorkspace();}}/>}
    {!workspace?.current&&<AsyncStatePanel state="empty" title="Henüz kayıtlı taslak yok" message="Başlık ve not yazdığınızda geçerli içerik 700 ms sonra kişisel alana otomatik kaydedilir."/>}
    {draft.state.phase==='error'&&<AsyncStatePanel state="error" title="Otomatik kayıt tamamlanamadı" message="Girdi ekranda korunuyor; aynı işlem kimliği ve özgün revizyonla güvenli biçimde yeniden denenebilir." onRetry={async()=>{await draft.retry();}}/>}
    {historyRefreshError&&<AsyncStatePanel state="error" title="Değişiklik geçmişi yenilenemedi" message="Kayıt işlemi tamamlandı; yalnızca geçmiş görünümü güncellenemedi." onRetry={async()=>{await refreshWorkspace();}}/>}
    {undoError&&<AsyncStatePanel state="error" title="Geri alma tamamlanamadı" message="Ekrandaki veri korunuyor; aynı geri alma işlemi güvenli biçimde yeniden denenebilir." onRetry={undo}/>}
    <ValidationSummary issues={visibleIssues} focusRequestKey={validationFocusRequest}/>
    <div className="workspace-form" aria-describedby="governed-draft-status">
      <label htmlFor="governed-draft-title">Çalışma başlığı<input id="governed-draft-title" value={draft.draft.title} aria-invalid={visibleIssues.some(item=>item.fieldId==='governed-draft-title')} onChange={event=>updateDraft({...draft.draft,title:event.target.value})}/></label>
      <label htmlFor="governed-draft-note">Çalışma notu<textarea id="governed-draft-note" rows={5} value={draft.draft.note} aria-invalid={visibleIssues.some(item=>item.fieldId==='governed-draft-note')} onChange={event=>updateDraft({...draft.draft,note:event.target.value})}/></label>
      <div className="button-row"><Button onClick={()=>void saveNow()} disabled={draft.state.phase==='saving'||(issues.length===0&&!['dirty','error'].includes(draft.state.phase))}>Şimdi kaydet</Button><Button onClick={()=>void undo()} disabled={revisionRef.current<2||undoing||!canUndoGovernedDraft(draft.state.phase)}>Son değişikliği geri al</Button></div>
      <small id="governed-draft-status" aria-live="polite">{undoing?translateDraftCenterCopy('Geri alınıyor…',language):draft.state.phase==='saving'?translateDraftCenterCopy('Kaydediliyor…',language):draft.state.phase==='saved'?(language==='tr'?`Otomatik kaydedildi · sürüm ${revisionRef.current}`:`Autosaved · revision ${revisionRef.current}`):draft.state.phase==='invalid'?translateDraftCenterCopy('Alan hataları düzeltilene kadar kayıt bekliyor.',language):draft.state.phase==='dirty'?translateDraftCenterCopy('Değişiklikler otomatik kayıt için bekliyor.',language):(language==='tr'?`Güncel sürüm ${revisionRef.current||'yok'}`:`Current revision ${revisionRef.current||'none'}`)}</small>
    </div>
    <section aria-labelledby="governed-draft-history"><h3 id="governed-draft-history">Değişiklik geçmişi</h3>{!workspace?.history.length?<EmptyState title="Geçmiş henüz boş" body="Her başarılı otomatik kayıt ve geri alma değişmez bir sürüm olarak burada görünür."/>:<div className="stack-list">{workspace.history.map(item=><div className="list-row" key={item.mutationId}><div><strong>Sürüm {item.revision} · {item.operation==='save'?'Kaydedildi':'Geri alındı'}</strong><small>{formatDate(item.createdAt,{dateStyle:'medium',timeStyle:'short'})}{item.restoredFromRevision?` · sürüm ${item.restoredFromRevision} geri yüklendi`:''} · {item.payloadFingerprint.slice(0,12)}</small></div></div>)}</div>}</section>
    <small>Hassas taslak içeriği localStorage/sessionStorage içine yazılmaz; merkezi kişisel PEP/UoW ve değişmez revizyon geçmişi kullanılır.</small>
  </Surface>;
  return localizeDraftCenterNode(panel,language);
}

export function SystemManagementScreen(){
  const {language}=useLocalization();
  const [networkEgressBoundary,setNetworkEgressBoundary]=useState<NetworkEgressBoundaryView>();
  const [derivedDataPolicyBoundary,setDerivedDataPolicyBoundary]=useState<DerivedDataPolicyBoundaryView>();
  const [sensitiveLoggingBoundary,setSensitiveLoggingBoundary]=useState<SensitiveLoggingBoundaryView>();
  const [policyDecisionAuditBoundary,setPolicyDecisionAuditBoundary]=useState<PolicyDecisionAuditBoundaryView>();
  const [sourceDeletionPropagationBoundary,setSourceDeletionPropagationBoundary]=useState<SourceDeletionPropagationBoundaryView>();
  const [policyConformanceSuiteBoundary,setPolicyConformanceSuiteBoundary]=useState<PolicyConformanceSuiteBoundaryView>();
  const [platformPolicyAstGateBoundary,setPlatformPolicyAstGateBoundary]=useState<PlatformPolicyAstGateBoundaryView>();
  const [platformCapabilityManifestGateBoundary,setPlatformCapabilityManifestGateBoundary]=useState<PlatformCapabilityManifestGateBoundaryView>();
  const [applicationSecurityProfileGateBoundary,setApplicationSecurityProfileGateBoundary]=useState<ApplicationSecurityProfileGateBoundaryView>();
  const [policyServiceAvailabilityBoundary,setPolicyServiceAvailabilityBoundary]=useState<PolicyServiceAvailabilityBoundaryView>();
  const [productSurfaceGovernance,setProductSurfaceGovernance]=useState<ProductSurfaceGovernanceView>();
  const [desktopSecurityPosture,setDesktopSecurityPosture]=useState<DesktopSecurityPostureView>();
  const [factoryResetOpen,setFactoryResetOpen]=useState(false);
  const [factoryResetPassword,setFactoryResetPassword]=useState('');
  const [factoryResetCode,setFactoryResetCode]=useState('');
  const [factoryResetConfirmation,setFactoryResetConfirmation]=useState('');
  const [factoryResetBusy,setFactoryResetBusy]=useState(false);
  const [health,setHealth]=useState<SystemHealthView>(); const [coreServiceHealth,setCoreServiceHealth]=useState<CoreServiceHealthContract>(); const [coreServiceApiBoundary,setCoreServiceApiBoundary]=useState<CoreServiceApiBoundaryStatusContract>(); const [targets,setTargets]=useState<BackupTargetView[]>([]); const [runs,setRuns]=useState<BackupRunView[]>([]); const [performance,setPerformance]=useState<PerformanceSampleView[]>([]); const [trend,setTrend]=useState<PerformanceTrendView>(); const [tasks,setTasks]=useState<BackgroundTaskView[]>([]); const [scheduler,setScheduler]=useState<SchedulerStatusView>(); const [diagnostics,setDiagnostics]=useState<DiagnosticEntryView[]>([]); const [result,setResult]=useState<MaintenanceResultView>(); const [backupMessage,setBackupMessage]=useState(''); const [queue,setQueue]=useState<QueuedTaskView[]>([]); const [policy,setPolicy]=useState<MaintenancePolicyView>(); const [notifications,setNotifications]=useState<HealthNotificationView[]>([]); const [systemMessage,setSystemMessage]=useState(''); const [healthScore,setHealthScore]=useState<SystemHealthScoreView>(); const [reportHistory,setReportHistory]=useState<DiagnosticReportHistoryView[]>([]); const [diagQuery,setDiagQuery]=useState(''); const [diagSeverity,setDiagSeverity]=useState(''); const [healthHistory,setHealthHistory]=useState<SystemHealthHistoryView[]>([]); const [healthTrend,setHealthTrend]=useState<SystemHealthTrendView>(); const [archives,setArchives]=useState<DiagnosticArchiveView[]>([]); const [anomalies,setAnomalies]=useState<PerformanceAnomalyView[]>([]); const [recommendations,setRecommendations]=useState<MaintenanceRecommendationView[]>([]); const [reportContent,setReportContent]=useState<DiagnosticReportContentView>(); const [verificationMessage,setVerificationMessage]=useState(''); const [healthDays,setHealthDays]=useState(30); const [performanceHours,setPerformanceHours]=useState(24); const [compareLeft,setCompareLeft]=useState(''); const [compareRight,setCompareRight]=useState(''); const [comparison,setComparison]=useState<DiagnosticReportComparisonView>(); const [archiveContent,setArchiveContent]=useState<DiagnosticArchiveContentView>(); const [archiveId,setArchiveId]=useState(''); const [archiveQuery,setArchiveQuery]=useState(''); const [maintenanceHistory,setMaintenanceHistory]=useState<MaintenanceHistoryView[]>([]); const [exportHistory,setExportHistory]=useState<ExportArtifactView[]>([]); const [ipcTelemetry,setIpcTelemetry]=useState<IpcPerformanceTelemetryView>(); const [ipcMaintenanceAuthority,setIpcMaintenanceAuthority]=useState<IpcAdaptiveBudgetMaintenanceAuthorityView>(); const [ipcMaintenanceRecoveryAuthority,setIpcMaintenanceRecoveryAuthority]=useState<IpcAdaptiveBudgetMaintenanceRecoveryAuthorityView>(); const [ipcMaintenancePassword,setIpcMaintenancePassword]=useState(''); const [ipcMaintenanceCode,setIpcMaintenanceCode]=useState(''); const [ipcMaintenanceRecoveryConfirmation,setIpcMaintenanceRecoveryConfirmation]=useState(''); const [ipcMaintenanceBusy,setIpcMaintenanceBusy]=useState(false);
  const refresh=async()=>{if(!window.pardus)return; const [h,coreHealth,apiBoundary,t,r,p,tr,bg,sc,d,q,mp,n,hs,rh,hh,ht,ar,an,mr,mhist,exports,ipc,ipcAuthority,ipcRecoveryAuthority]=await Promise.all([window.pardus.getSystemHealth(),window.pardus.getCoreServiceHealth().catch(()=>undefined),window.pardus.getCoreServiceApiBoundary().catch(()=>undefined),window.pardus.listBackupTargets(),window.pardus.listBackupRuns(30),window.pardus.listPerformance(30),window.pardus.getPerformanceTrend(performanceHours),window.pardus.listBackgroundTasks(30),window.pardus.getSchedulerStatus(),window.pardus.listDiagnostics(50),window.pardus.listQueuedTasks(40),window.pardus.getMaintenancePolicy(),window.pardus.listHealthNotifications(40),window.pardus.getHealthScore(),window.pardus.listDiagnosticReports(20),window.pardus.listHealthHistory(Math.max(30,healthDays*4)),window.pardus.getHealthTrend(healthDays),window.pardus.listDiagnosticArchives(20),window.pardus.getPerformanceAnomalies(performanceHours),window.pardus.getMaintenanceRecommendations(),window.pardus.listMaintenanceHistory(30),window.pardus.listExportArtifacts(30),window.pardus.getIpcPerformanceTelemetry(),window.pardus.getIpcAdaptiveBudgetMaintenanceAuthority(),window.pardus.getIpcAdaptiveBudgetMaintenanceRecoveryAuthority()]);setHealth(h);setCoreServiceHealth(coreHealth);setCoreServiceApiBoundary(apiBoundary);setTargets(t);setRuns(r);setPerformance(p);setTrend(tr);setTasks(bg);setScheduler(sc);setDiagnostics(d);setQueue(q);setPolicy(mp);setNotifications(n);setHealthScore(hs);setReportHistory(rh);setHealthHistory(hh);setHealthTrend(ht);setArchives(ar);setAnomalies(an);setRecommendations(mr);setMaintenanceHistory(mhist);setExportHistory(exports);setIpcTelemetry(ipc);setIpcMaintenanceAuthority(ipcAuthority);setIpcMaintenanceRecoveryAuthority(ipcRecoveryAuthority);};
  useEffect(()=>{void refresh();const timer=setInterval(()=>void refresh(),30_000);return()=>clearInterval(timer);},[]);
  useEffect(()=>{void window.pardus?.getNetworkEgressBoundary().then(setNetworkEgressBoundary).catch(()=>setNetworkEgressBoundary(undefined));},[]);
  useEffect(()=>{void window.pardus?.getDerivedDataPolicyBoundary().then(setDerivedDataPolicyBoundary).catch(()=>setDerivedDataPolicyBoundary(undefined));},[]);
  useEffect(()=>{void window.pardus?.getSensitiveLoggingBoundary().then(setSensitiveLoggingBoundary).catch(()=>setSensitiveLoggingBoundary(undefined));},[]);
  useEffect(()=>{void window.pardus?.getPolicyDecisionAuditBoundary().then(setPolicyDecisionAuditBoundary).catch(()=>setPolicyDecisionAuditBoundary(undefined));},[]);
  useEffect(()=>{void window.pardus?.getSourceDeletionPropagationBoundary().then(setSourceDeletionPropagationBoundary).catch(()=>setSourceDeletionPropagationBoundary(undefined));},[]);
  useEffect(()=>{void window.pardus?.getPolicyConformanceSuiteBoundary().then(setPolicyConformanceSuiteBoundary).catch(()=>setPolicyConformanceSuiteBoundary(undefined));},[]);
  useEffect(()=>{void window.pardus?.getPlatformPolicyAstGateBoundary().then(setPlatformPolicyAstGateBoundary).catch(()=>setPlatformPolicyAstGateBoundary(undefined));},[]);
  useEffect(()=>{void window.pardus?.getPlatformCapabilityManifestGateBoundary().then(setPlatformCapabilityManifestGateBoundary).catch(()=>setPlatformCapabilityManifestGateBoundary(undefined));},[]);
  useEffect(()=>{void window.pardus?.getApplicationSecurityProfileGateBoundary().then(setApplicationSecurityProfileGateBoundary).catch(()=>setApplicationSecurityProfileGateBoundary(undefined));},[]);
  useEffect(()=>{const load=()=>void window.pardus?.getPolicyServiceAvailabilityBoundary().then(setPolicyServiceAvailabilityBoundary).catch(()=>setPolicyServiceAvailabilityBoundary(undefined));load();const timer=setInterval(load,15_000);return()=>clearInterval(timer);},[]);
  useEffect(()=>{void window.pardus?.getProductSurfaceGovernance().then(setProductSurfaceGovernance).catch(()=>setProductSurfaceGovernance(undefined));},[]);
  useEffect(()=>{void window.pardus?.getDesktopSecurityPosture().then(setDesktopSecurityPosture).catch(()=>setDesktopSecurityPosture(undefined));},[]);
  const maintain=async(op:MaintenanceResultView['operation'])=>{if(!window.pardus)return;setResult(await window.pardus.runMaintenance(op));await refresh();};
  const runAllBackups=async()=>{if(!window.pardus)return;const results=await window.pardus.runAllBackups();setBackupMessage(`${results.filter(x=>x.success).length}/${results.length} hedef doğrulandı.`);await refresh();};
  const runTarget=async(id:string)=>{if(!window.pardus)return;const r=await window.pardus.runBackupTarget(id);setBackupMessage(r.success?'Yedek doğrulandı.':r.run.error??'Yedek başarısız.');await refresh();};
  const sample=async()=>{if(!window.pardus)return;await window.pardus.capturePerformance();await refresh();};
  const processQueue=async()=>{if(!window.pardus)return;const r=await window.pardus.processTaskQueue();setSystemMessage(`${r.completed} görev tamamlandı, ${r.deferred} ertelendi.`);await refresh();};
  const runAutoMaintenance=async()=>{if(!window.pardus)return;const r=await window.pardus.runAutomaticMaintenance();setSystemMessage(r.success?'Otomatik bakım tamamlandı.':'Bakım işlemlerinden biri başarısız oldu.');await refresh();};
  const evaluateNotifications=async()=>{if(!window.pardus)return;setNotifications(await window.pardus.evaluateHealthNotifications());setSystemMessage('Sistem sağlığı yeniden değerlendirildi.');};
  const acknowledge=async(id:string)=>{if(!window.pardus)return;setNotifications(await window.pardus.acknowledgeHealthNotification(id));};
  const exportDiagnostic=async()=>{if(!window.pardus)return;const r=await window.pardus.exportDiagnosticReport();setSystemMessage(r.canceled?'Rapor dışa aktarımı iptal edildi.':`Tanılama raporu: ${r.filePath??''}`);};
  const archiveOldDiagnostics=async()=>{if(!window.pardus)return;const r=await window.pardus.archiveDiagnostics();setSystemMessage(r.canceled?'Arşivleme iptal edildi.':`${r.archive?.entryCount??0} olay arşivlendi.`);await refresh();};
  const verifyArchive=async(id:string)=>{if(!window.pardus)return;const r:DiagnosticArchiveVerificationView=await window.pardus.verifyDiagnosticArchive(id);setVerificationMessage(r.valid?'Arşiv bütünlüğü doğrulandı.':r.exists?'Arşiv değiştirilmiş.':'Arşiv dosyası bulunamadı.');};
  const openReport=async(id:string)=>{if(!window.pardus)return;const r=await window.pardus.readDiagnosticReport(id);setReportContent(r);setVerificationMessage(r.valid?'Rapor doğrulandı ve açıldı.':'Rapor bütünlüğü doğrulanamadı.');};
  const compareReports=async()=>{if(!window.pardus||!compareLeft||!compareRight||compareLeft===compareRight)return;setComparison(await window.pardus.compareDiagnosticReports(compareLeft,compareRight));};
  const openArchive=async(id:string)=>{if(!window.pardus)return;try{setArchiveId(id);setArchiveContent(await window.pardus.readDiagnosticArchive(id));setVerificationMessage('Arşiv doğrulandı ve geri yükleme yapılmadan açıldı.');}catch(error){setVerificationMessage(error instanceof Error?error.message:'Arşiv açılamadı.');}};
  const searchArchiveEvents=async()=>{if(!window.pardus||!archiveId)return;const input:DiagnosticArchiveSearchInput={query:archiveQuery,limit:500};setArchiveContent(await window.pardus.searchDiagnosticArchive(archiveId,input));};
  const exportArchiveEvents=async(format:'json'|'csv')=>{if(!window.pardus||!archiveId)return;const r=await window.pardus.exportDiagnosticArchiveEntries(archiveId,{query:archiveQuery,limit:2000},format);setVerificationMessage(r.canceled?'Dışa aktarım iptal edildi.':`${r.export?.entryCount??0} olay dışa aktarıldı.`);};
  const recommendationToTask=async(item:MaintenanceRecommendationView)=>{if(!window.pardus)return;await window.pardus.enqueueTask({taskType:item.recommendedOperation?`maintenance.${item.recommendedOperation}`:'maintenance.review',label:item.title,priority:item.priority==='high'?'high':item.priority==='normal'?'normal':'low',payload:JSON.stringify({code:item.code,message:item.message})});setSystemMessage('Bakım önerisi görev kuyruğuna eklendi.');await refresh();};
  const filterDiagnostics=async()=>{if(!window.pardus)return;const input:{query?:string;severity?:DiagnosticEntryView['severity'];limit:number}={limit:100};if(diagQuery)input.query=diagQuery;if(diagSeverity)input.severity=diagSeverity as DiagnosticEntryView['severity'];setDiagnostics(await window.pardus.searchDiagnostics(input));};
  const savePolicy=async(e:FormEvent<HTMLFormElement>)=>{e.preventDefault();if(!window.pardus)return;const d=new FormData(e.currentTarget);setPolicy(await window.pardus.upsertMaintenancePolicy({enabled:d.get('enabled')==='on',intervalHours:Number(d.get('intervalHours')),keepDiagnosticDays:Number(d.get('keepDiagnosticDays')),keepPerformanceDays:Number(d.get('keepPerformanceDays'))}));setSystemMessage('Bakım politikası güncellendi.');await refresh();};
  const saveTarget=async(e:FormEvent<HTMLFormElement>)=>{e.preventDefault();if(!window.pardus)return;const d=new FormData(e.currentTarget);await window.pardus.upsertBackupTarget({name:String(d.get('name')),kind:String(d.get('kind')) as BackupTargetView['kind'],path:String(d.get('path')),schedule:String(d.get('schedule')) as BackupSchedule,retentionCount:Number(d.get('retention')),retryCount:Number(d.get('retry')),enabled:true});e.currentTarget.reset();await refresh();};
  const ipcMaintenancePrimaryDenied=ipcMaintenanceAuthority?.allowed!==true;
  const ipcMaintenanceCredentialsAvailable=!ipcMaintenancePrimaryDenied||ipcMaintenanceRecoveryAuthority?.allowed===true;
  const ipcMaintenanceCredentialsReady=ipcMaintenanceAuthority?.allowed===true&&ipcMaintenancePassword.length>0&&(!ipcMaintenanceAuthority.twoFactorRequired||ipcMaintenanceCode.length>0);
  const ipcMaintenanceRecoveryReady=ipcMaintenanceRecoveryAuthority?.allowed===true&&ipcMaintenancePassword.length>0&&(!ipcMaintenanceRecoveryAuthority.twoFactorRequired||ipcMaintenanceCode.length>0)&&ipcMaintenanceRecoveryConfirmation===ipcMaintenanceRecoveryAuthority.confirmationPhrase;
  const clearIpcMaintenanceCredentials=()=>{setIpcMaintenancePassword('');setIpcMaintenanceCode('');setIpcMaintenanceRecoveryConfirmation('');};
  const refreshIpcMaintenanceAuthority=async()=>{if(!window.pardus)return;const [authority,recoveryAuthority]=await Promise.all([window.pardus.getIpcAdaptiveBudgetMaintenanceAuthority(),window.pardus.getIpcAdaptiveBudgetMaintenanceRecoveryAuthority()]);setIpcMaintenanceAuthority(authority);setIpcMaintenanceRecoveryAuthority(recoveryAuthority);};
  const exportIpcAdaptiveDiagnostics=async()=>{if(!window.pardus||!ipcMaintenanceCredentialsReady)return;setIpcMaintenanceBusy(true);try{const exported=await window.pardus.exportIpcAdaptiveBudgetDiagnostics({password:ipcMaintenancePassword,...(ipcMaintenanceCode?{code:ipcMaintenanceCode}:{})});setSystemMessage(exported.canceled?'Tanı paketi dışa aktarılmadı.':`Adaptif IPC tanı paketi kaydedildi · ${exported.sha256?.slice(0,12)??'SHA yok'}`);}catch(error){setSystemMessage(error instanceof Error?error.message:'Güçlü doğrulama başarısız.');}finally{clearIpcMaintenanceCredentials();setIpcMaintenanceBusy(false);await refreshIpcMaintenanceAuthority();}};
  const resetIpcAdaptiveBudget=async()=>{if(!window.pardus||!ipcMaintenanceCredentialsReady)return;setIpcMaintenanceBusy(true);try{const reset=await window.pardus.resetIpcAdaptiveBudget({password:ipcMaintenancePassword,...(ipcMaintenanceCode?{code:ipcMaintenanceCode}:{})});setSystemMessage(reset.canceled?'Adaptif bütçe sıfırlanmadı.':'Adaptif bütçe baseline moduna sıfırlandı.');if(!reset.canceled)await refresh();}catch(error){setSystemMessage(error instanceof Error?error.message:'Güçlü doğrulama başarısız.');}finally{clearIpcMaintenanceCredentials();setIpcMaintenanceBusy(false);await refreshIpcMaintenanceAuthority();}};
  const recoverIpcAdaptiveBudgetMaintenanceLock=async()=>{if(!window.pardus||!ipcMaintenanceRecoveryReady)return;setIpcMaintenanceBusy(true);try{const recovered=await window.pardus.recoverIpcAdaptiveBudgetMaintenanceLock({password:ipcMaintenancePassword,...(ipcMaintenanceCode?{code:ipcMaintenanceCode}:{}),confirmation:'BAKIM KİLİDİNİ SIFIRLA'});setSystemMessage(recovered.canceled?'Bakım kilidi kurtarma iptal edildi.':`Bakım kilidi temizlendi · güvenlik dönemi ${recovered.securityEpoch??'—'} · ${recovered.revokedTrustedDeviceCount??0} güvenilir cihaz bağı iptal edildi.`);}catch(error){setSystemMessage(error instanceof Error?error.message:'Bakım kilidi kurtarma doğrulaması başarısız.');}finally{clearIpcMaintenanceCredentials();setIpcMaintenanceBusy(false);await refreshIpcMaintenanceAuthority();}};
  const closeFactoryReset=()=>{setFactoryResetOpen(false);setFactoryResetPassword('');setFactoryResetCode('');setFactoryResetConfirmation('');};
  const factoryResetReady=factoryResetPassword.length>0&&factoryResetConfirmation==='ILK KURULUM ANINA DON';
  const performFactoryReset=async()=>{if(!window.pardus||!factoryResetReady)return;setFactoryResetBusy(true);setSystemMessage('');try{await window.pardus.factoryResetToInitialState({password:factoryResetPassword,...(factoryResetCode.trim()?{code:factoryResetCode.trim()}:{}),confirmation:'ILK KURULUM ANINA DON'});setSystemMessage('Kişisel veriler siliniyor; uygulama ilk kurulum ekranıyla yeniden başlatılıyor.');}catch(error){setSystemMessage(error instanceof Error?error.message:'İlk kurulum durumuna dönüş başlatılamadı.');setFactoryResetBusy(false);setFactoryResetPassword('');setFactoryResetCode('');}};
  const bytes=(n:number)=>new Intl.NumberFormat('tr-TR',{style:'unit',unit:'megabyte',maximumFractionDigits:1}).format(n/1048576);
  const trendLabel=trend?.direction==='improving'?'İyileşiyor':trend?.direction==='degrading'?'Baskı artıyor':'Dengeli';
  const panel=<section><PageHeader eyebrow="Sistem yönetimi" title="Sistem, bakım ve operasyon" description="Yedek hedeflerini, performansı, bakım görevlerini ve tanılama işlemlerini yönetin." actions={<Button onClick={()=>void refresh()}>Yenile</Button>}/><UniversalUxConsolidationPanel/><DistributedOperationsPanel/><CommunicationAuditArchivePanel/><CommunicationFileSharingPanel/><CommunicationSecurityPanel/><CommunicationMessagingPanel/><CommunicationRealtimeCallingPanel/><CommunicationRecordingRetentionPanel/><LocalTranslationLanguagePanel/><SignedPluginPlatformPanel/>
  <article className="panel factory-reset-panel"><div className="section-heading"><div><span className="eyebrow">Geri alınamaz yerel işlem</span><h2>İlk kurulum anına dön</h2><p>Tüm kişisel veriler, yönetilen yerel yedekler ve oturumlar silinir. İşlem yeni yedek oluşturmaz; Gold etkinleştirmesi ve deneme başlangıcı sıfırlanmaz.</p></div>{!factoryResetOpen&&<Button tone="danger" onClick={()=>setFactoryResetOpen(true)}>İlk kurulum anına dön</Button>}</div>{factoryResetOpen&&<div className="factory-reset-confirmation" role="alert" aria-live="assertive"><strong>Bu işlem geri alınamaz.</strong><p>Uygulamanın erişemediği OneDrive, Google Drive, iCloud veya başka haricî kopyalar otomatik silinmiş sayılmaz. Kayıtlı haricî yedek kanıtı varsa işlem güvenli biçimde reddedilir.</p><div className="form-grid"><label>Yerel parola<input type="password" autoComplete="current-password" maxLength={1024} value={factoryResetPassword} onChange={event=>setFactoryResetPassword(event.target.value)}/></label><label>2FA / kurtarma kodu (etkinse)<input autoComplete="one-time-code" maxLength={256} value={factoryResetCode} onChange={event=>setFactoryResetCode(event.target.value.replace(/\s+/g,''))}/></label><label className="span-2">Onaylamak için yazın: <code>ILK KURULUM ANINA DON</code><input value={factoryResetConfirmation} autoComplete="off" maxLength={23} onChange={event=>setFactoryResetConfirmation(event.target.value)}/></label></div><div className="button-row"><Button tone="danger" disabled={!factoryResetReady||factoryResetBusy} onClick={()=>void performFactoryReset()}>{factoryResetBusy?'Silme hazırlanıyor…':'Evet, tüm kişisel verileri sil'}</Button><Button disabled={factoryResetBusy} onClick={closeFactoryReset}>Hayır, vazgeç</Button></div></div>}</article>
  <Surface className="workspace-summary"><SectionHeader eyebrow="B2-03 / B2-04 · masaüstü güvenlik kapanışı" title="Oturum kilidi ve Electron sertleştirmesi"/><div className="notes-card"><strong>{desktopSecurityPosture?.enforcement==='fail-closed'?'Fail-closed masaüstü güvenlik sözleşmesi etkin':'Masaüstü güvenlik durumu doğrulanamadı'}</strong><small>Boşta kilit {desktopSecurityPosture?.session.idleTimeoutMinutes??15} dakika · erişilebilir uyarı {desktopSecurityPosture?.session.warningBeforeSeconds??60} saniye · açık form durumu kilitte korunur</small><small>Renderer {desktopSecurityPosture?.electron.primaryRendererProtocol??'doğrulanamadı'} · sandbox/context isolation etkin · gezinme, yeni pencere ve izinler varsayılan reddedilir</small><small>Fuse doğrulaması zorunlu · RunAsNode/Node seçenekleri kapalı · ASAR bütünlüğü ve yalnız ASAR yükleme açık</small></div></Surface>
  <Surface className="workspace-summary"><SectionHeader eyebrow="B0-03 / B0-04 · ürün yüzeyi gerçeklik kapısı" title="Belge, rota, menü, ekran ve API envanteri tek sözleşmede"/><div className="notes-card"><strong>{productSurfaceGovernance?.enforcement==='fail-closed'&&productSurfaceGovernance.unresolvedUnusedRendererApiCount===0?'Ürün yüzeyi zinciri doğrulandı':'Ürün yüzeyi zinciri doğrulanamadı'}</strong><small>{productSurfaceGovernance?.productModuleCount??0} ürün modülü + {productSurfaceGovernance?.governanceSurfaceCount??0} yönetişim yüzeyi = {productSurfaceGovernance?.navigationRouteCount??0} kanonik rota</small><small>Menü {productSurfaceGovernance?.menuEntryCount??0} · ekran {productSurfaceGovernance?.renderedScreenCount??0} · sınıflandırılmış kullanılmayan renderer API {productSurfaceGovernance?.classifiedUnusedRendererApiCount??0}</small><small>Çözümlenmemiş API {productSurfaceGovernance?.unresolvedUnusedRendererApiCount??0} · eksik zincir build kapanışını fail-closed durdurur · veritabanı göçü gerekmez</small></div></Surface>
  {policyServiceAvailabilityBoundary&&<article className={`panel health-alert ${policyServiceAvailabilityBoundary.mode==='read-write'?'info':policyServiceAvailabilityBoundary.mode==='read-only'?'warning':'critical'}`}><h2>PPK-024 · Politika servisi çalışma modu</h2><strong>{policyServiceAvailabilityBoundary.mode==='read-write'?'Okuma ve yazma açık':policyServiceAvailabilityBoundary.mode==='read-only'?'Salt okunur — değişiklikler kapalı':'Erişim güvenli biçimde durduruldu'}</strong><p>{policyServiceAvailabilityBoundary.reason}</p><small>İmza {policyServiceAvailabilityBoundary.policyPackageVerified?'doğrulandı':'doğrulanamadı'} · canlılık {policyServiceAvailabilityBoundary.observationFresh?'güncel':'güncel değil'} · istemci bu göstergeden ek yetki türetemez.</small></article>}
  {health&&<div className="stats-grid"><article className="stat-card"><small>Sistem sağlık puanı</small><strong>{healthScore?.score??0}/100</strong><span>{healthScore?.grade==='excellent'?'Mükemmel':healthScore?.grade==='good'?'İyi':healthScore?.grade==='attention'?'Dikkat':'Kritik'}</span></article><article className="stat-card"><small>Genel durum</small><strong>{health.status==='healthy'?'Sağlıklı':health.status==='warning'?'Uyarı':'Kritik'}</strong><span>{health.integrityOk?'SQLite bütünlüğü doğrulandı':'Bütünlük sorunu'}</span></article><article className="stat-card"><small>Core Service</small><strong>{coreServiceHealth?`${coreServiceHealth.role} · ${coreServiceHealth.lifecycle}`:'Bağlantı yok'}</strong><span>{coreServiceHealth?`${coreServiceHealth.writable?'Yazılabilir':'Salt-okunur'} · ${coreServiceHealth.safeMode?'Güvenli mod':'Normal'} · ${coreServiceHealth.policyVersion}`:'Sağlık yanıtı alınamadı'}</span></article><article className="stat-card"><small>PPK-014 Core API</small><strong>{coreServiceApiBoundary?`${coreServiceApiBoundary.apiVersion} · ${coreServiceApiBoundary.enforcement}`:'Doğrulanamadı'}</strong><span>{coreServiceApiBoundary?'Sürümlü zarf · uygulama bağı · freshness · replay koruması':'API sınırı yanıtı alınamadı'}</span></article><article className="stat-card"><small>Zamanlayıcı</small><strong>{scheduler?.active?'Etkin':'Kapalı'}</strong><span>{scheduler?.lastCycleAt?`Son tur ${formatDate(scheduler.lastCycleAt,{hour:'2-digit',minute:'2-digit'})}`:'Oturum açılınca çalışır'}</span></article><article className="stat-card"><small>24 saatlik eğilim</small><strong>{trendLabel}</strong><span>CPU %{trend?.averageCpuPercent??0} · RAM %{trend?.averageMemoryPercent??0}</span></article><article className="stat-card"><small>Veri büyümesi</small><strong>{bytes((trend?.databaseGrowthBytes??0)+(trend?.archiveGrowthBytes??0))}</strong><span>{trend?.sampleCount??0} örnek değerlendirildi</span></article></div>}
  <Surface className="workspace-summary"><SectionHeader eyebrow="PPK-015 · ağ çıkış güvenliği" title="Allowlist, TLS/mTLS ve sertifika rotasyonu"/><div className="notes-card"><strong>{networkEgressBoundary?.enforcement==='fail-closed'?'Fail-closed egress politikası etkin':'Ağ çıkış sınırı doğrulanamadı'}</strong><small>Yalnız kayıtlı iptal-listesi, OIDC token ve JWKS uç noktaları · {networkEgressBoundary?.minimumTlsVersion??'TLS doğrulanamadı'} · SPKI çift-pin rotasyonu</small><small>mTLS {networkEgressBoundary?.mutualTlsSupported?'destekleniyor':'doğrulanamadı'} · yönlendirme {networkEgressBoundary?.redirectAllowed===false?'kapalı':'bilinmiyor'} · özel/yerel adresler {networkEgressBoundary?.privateAddressRejected?'reddediliyor':'bilinmiyor'}</small><small>{networkEgressBoundary?.authorizedAdapterCount??0} yetkili adaptör · {networkEgressBoundary?.directPrimitiveExceptionCount??0} doğrudan ağ istisnası</small></div></Surface>
  <Surface className="workspace-summary"><SectionHeader eyebrow="PPK-016 · türetilmiş veri güvenliği" title="Kaynak politika mirası ve değişmez soy zinciri"/><div className="notes-card"><strong>{derivedDataPolicyBoundary?.enforcement==='fail-closed'?'Fail-closed politika mirası etkin':'Türetilmiş veri sınırı doğrulanamadı'}</strong><small>En çok {derivedDataPolicyBoundary?.maximumSourceCount??0} kaynak · {derivedDataPolicyBoundary?.maximumLineageDepth??0} soy derinliği · kaynak erişim politikalarının zorunlu kesişimi</small><small>Hassasiyet düşürme {derivedDataPolicyBoundary?.sensitivityDowngradeAllowed===false?'yasak':'doğrulanamadı'} · erişim genişletme {derivedDataPolicyBoundary?.accessBroadeningAllowed===false?'yasak':'doğrulanamadı'}</small><small>{derivedDataPolicyBoundary?.authorizedRepositoryAdapterCount??0} yetkili adaptör · {derivedDataPolicyBoundary?.directAccessExceptionCount??0} doğrudan erişim istisnası · içerik/yol {derivedDataPolicyBoundary?.payloadExposed===false&&derivedDataPolicyBoundary?.persistentPathExposed===false?'açığa çıkarılmıyor':'doğrulanamadı'}</small></div></Surface>
  <Surface className="workspace-summary"><SectionHeader eyebrow="PPK-017 · hassas log güvenliği" title="İçeriksiz log ve tanı sınırı"/><div className="notes-card"><strong>{sensitiveLoggingBoundary?.enforcement==='fail-closed'?'Fail-closed hassas log politikası etkin':'Hassas log sınırı doğrulanamadı'}</strong><small>OCR metni ve payload {sensitiveLoggingBoundary?.ocrTextAllowed===false&&sensitiveLoggingBoundary?.payloadAllowed===false?'yasak':'doğrulanamadı'} · keyfi mesaj/stack {sensitiveLoggingBoundary?.arbitraryMessageAllowed===false&&sensitiveLoggingBoundary?.errorStackAllowed===false?'yasak':'doğrulanamadı'}</small><small>Tanı kaynak metni {sensitiveLoggingBoundary?.diagnosticTextStored===false&&sensitiveLoggingBoundary?.diagnosticSourceTextHashed?'saklanmıyor; yalnız SHA-256':'doğrulanamadı'} · masaüstü sink {sensitiveLoggingBoundary?.protectedDesktopSinkRequired?'cihaz korumalı':'doğrulanamadı'}</small><small>İzinli metadata: kimlik · hash · sonuç · correlation · sayaç · zaman · sürüm</small></div></Surface>
  <Surface className="workspace-summary"><SectionHeader eyebrow="PPK-018 · değişmez karar denetimi" title="Policy karar audit zinciri"/><div className="notes-card"><strong>{policyDecisionAuditBoundary?.status==='verified'&&policyDecisionAuditBoundary.enforcement==='fail-closed'?'Korumalı karar zinciri doğrulandı':'Karar audit zinciri doğrulanamadı'}</strong><small>İzin ve ret kararları {policyDecisionAuditBoundary?.allowedDecisionsRecorded&&policyDecisionAuditBoundary?.deniedDecisionsRecorded?'birlikte kaydediliyor':'doğrulanamadı'} · ret nedeni {policyDecisionAuditBoundary?.denialReasonRequired?'zorunlu':'doğrulanamadı'}</small><small>Policy sürümü ve yükümlülükler {policyDecisionAuditBoundary?.obligationsRecordedExactly?'exact bağlı':'doğrulanamadı'} · zincir {policyDecisionAuditBoundary?.appendOnly&&policyDecisionAuditBoundary?.hmacSha256Chained?'append-only HMAC-SHA-256':'doğrulanamadı'}</small><small>{policyDecisionAuditBoundary?.auditedEntryCount??0} yeni audit kaydı · {policyDecisionAuditBoundary?.legacyReceiptEntryCount??0} tarihsel receipt · istemciye payload verilmez</small></div></Surface>
  <Surface className="workspace-summary"><SectionHeader eyebrow="PPK-019 · silme ve retention yayılımı" title="Kaynakla birlikte türev, cache, replica ve yedek yaşam döngüsü"/><div className="notes-card"><strong>{sourceDeletionPropagationBoundary?.status==='verified'&&sourceDeletionPropagationBoundary.enforcement==='fail-closed'?'Fail-closed silme yayılımı doğrulandı':'Silme yayılımı doğrulanamadı'}</strong><small>OCR · indeks · thumbnail · AI hafızası üretim sahibi {sourceDeletionPropagationBoundary?.activeSemanticPersistentOwners===0?'yok ve statik çitle korunuyor':'doğrulanamadı'} · plaintext replica {sourceDeletionPropagationBoundary?.plaintextReplicaAllowed===false?'yasak':'doğrulanamadı'}</small><small>Runtime cache silme öncesi temizlenir · yönetilen yedek doğrulanmış yeniden yazım ve karantina tamamlanana kadar tombstone bekler</small><small>Yönetilmeyen ve harici kopyalar ayrı dikkat/kanıt ister · karantina fiziksel imha sayılmaz · istemciye payload verilmez</small></div></Surface>
  <Surface className="workspace-summary"><SectionHeader eyebrow="PPK-020 · ortak policy conformance" title="Windows, Apple profilleri ve servisler için tek doğrulama matrisi"/><div className="notes-card"><strong>{policyConformanceSuiteBoundary?.status==='build-verified'&&policyConformanceSuiteBoundary.enforcement==='fail-closed'?'Ortak policy sözleşmesi build aşamasında doğrulandı':'Policy conformance durumu doğrulanamadı'}</strong><small>{policyConformanceSuiteBoundary?.targetCount??0} hedef · {policyConformanceSuiteBoundary?.caseCount??0} aynı vaka · {policyConformanceSuiteBoundary?.totalMatrixAssertions??0} çekirdek değerlendirmesi</small><small>Aktif runtime hedefi {policyConformanceSuiteBoundary?.deployedRuntimeTargets??0} · profile-only/not-deployed hedef {policyConformanceSuiteBoundary?.profileOnlyTargets??0}</small><small>Native Apple çalıştırması tamamlandı iddiası yoktur; ilgili uygulama yayımlanmadan önce native doğrulama zorunludur · istemciye test payloadı verilmez</small></div></Surface>
  <Surface className="workspace-summary"><SectionHeader eyebrow="PPK-021 · AST güvenlik kapısı" title="Ayrıcalıklı kod yüzeylerinde exact default-deny ratchet"/><div className="notes-card"><strong>{platformPolicyAstGateBoundary?.status==='build-verified'&&platformPolicyAstGateBoundary.enforcement==='fail-closed'?'TypeScript AST kapısı build aşamasında doğrulandı':'AST gate durumu doğrulanamadı'}</strong><small>{platformPolicyAstGateBoundary?.protectedRuleCount??0} kural · {platformPolicyAstGateBoundary?.productionSourceZones??0} üretim bölgesi · {platformPolicyAstGateBoundary?.exactAllowlistEntries??0} exact yüzey</small><small>Yeni veya eski izin: fail-closed · wildcard: {platformPolicyAstGateBoundary?.wildcardsAllowed===false?'yasak':'doğrulanamadı'} · doğrudan rol yetkilendirmesi: {platformPolicyAstGateBoundary?.directRoleAuthorizationBypasses??'doğrulanamadı'}</small><small>Alias, dynamic import, require ve hesaplanmış property AST üzerinde incelenir; AST gate runtime politikasının yerine geçmez · istemciye kaynak yolu veya allowlist hash'i verilmez</small></div></Surface>
  <Surface className="workspace-summary"><SectionHeader eyebrow="PPK-022 · capability manifest kapısı" title="Kamera, mikrofon, dosya, OCR, AI, konum ve ağ için çift katmanlı ret"/><div className="notes-card"><strong>{platformCapabilityManifestGateBoundary?.status==='build-runtime-verified'&&platformCapabilityManifestGateBoundary.enforcement==='build-and-runtime-fail-closed'?'Build ve runtime capability kapısı doğrulandı':'Capability manifest durumu doğrulanamadı'}</strong><small>{platformCapabilityManifestGateBoundary?.protectedCapabilityCount??0} kaynak ailesi · {platformCapabilityManifestGateBoundary?.canonicalApplicationCount??0} uygulama · {platformCapabilityManifestGateBoundary?.exactAstSurfaceCount??0} exact AST yüzeyi</small><small>Eksik veya beklenmeyen capability: fail-closed · imzalı manifest hash bağı ve authenticated Core Service runtime doğrulaması zorunlu</small><small>Build manifesti tek başına runtime yetkisi vermez · istemciye kaynak yolu veya manifest hash'i verilmez · mevcut Desktop vault sahipliği korunur</small></div></Surface>
  <Surface className="workspace-summary"><SectionHeader eyebrow="PPK-023 · uygulama güvenlik profili" title="ASVS, MASVS, SSDF eşlemesi ve uygulama başına tehdit modeli"/><div className="notes-card"><strong>{applicationSecurityProfileGateBoundary?.status==='build-mapping-verified'&&applicationSecurityProfileGateBoundary.enforcement==='fail-closed'?'Uygulama güvenlik profil kapısı doğrulandı':'Uygulama güvenlik profili doğrulanamadı'}</strong><small>{applicationSecurityProfileGateBoundary?.mappedApplicationCount??0}/{applicationSecurityProfileGateBoundary?.canonicalApplicationCount??0} uygulama · {applicationSecurityProfileGateBoundary?.threatModelCount??0} tehdit modeli · {applicationSecurityProfileGateBoundary?.mobileMasvsApplicationCount??0} mobil MASVS profili</small><small>ASVS {applicationSecurityProfileGateBoundary?.asvsVersion??'—'} · MASVS {applicationSecurityProfileGateBoundary?.masvsVersion??'—'} · SSDF {applicationSecurityProfileGateBoundary?.ssdfVersion??'—'} · yeni veya eksik profil build aşamasında reddedilir</small><small>Eşleme uygunluk sertifikası veya runtime yetkisi değildir · profile-only hedefler native doğrulanmış sayılmaz · istemciye kaynak yolu ya da tehdit modeli hash'i verilmez</small></div></Surface>
  <div className="content-grid two"><article className="panel"><h2>Yedekleme politikası</h2><form className="form-grid" onSubmit={e=>void saveTarget(e)}><label>Hedef adı<input name="name" required/></label><label>Tür<select name="kind"><option value="local">Yerel</option><option value="external">Harici disk</option><option value="cloud">Bulut klasörü</option></select></label><label className="span-2">Klasör yolu<input name="path" required placeholder="C:\\ParsYuva-AYM-Yedek"/></label><label>Zamanlama<select name="schedule"><option value="manual">Manuel</option><option value="hourly">Saatlik</option><option value="daily">Günlük</option><option value="weekly">Haftalık</option><option value="monthly">Aylık</option></select></label><label>Saklanacak yedek<input name="retention" type="number" min="1" max="365" defaultValue="10"/></label><label>Yeniden deneme<input name="retry" type="number" min="0" max="5" defaultValue="2"/></label><Button tone="primary" type="submit">Politikayı kaydet</Button></form></article><article className="panel"><div className="section-heading"><div><h2>Yedek hedefleri</h2><p>Her hedef bağımsız çalışır ve SHA-256 ile doğrulanır.</p></div><Button onClick={()=>void runAllBackups()}>Tümünü çalıştır</Button></div>{backupMessage&&<p className="success-text">{backupMessage}</p>}{targets.length?targets.map(t=><div className="list-row" key={t.id}><div><strong>{t.name}</strong><small>{t.kind} · {t.schedule} · son {t.retentionCount} yedek</small><small>{t.nextRunAt?`Sonraki ${formatDate(t.nextRunAt,{dateStyle:'short',timeStyle:'short'})}`:t.lastError??t.path}</small></div><Button onClick={()=>void runTarget(t.id)} disabled={!t.enabled}>Çalıştır</Button></div>):<EmptyState title="Yedek hedefi tanımlanmadı" body="Yerel, harici veya bulut hedefi ekleyin."/>}</article></div>
  <div className="content-grid two"><article className="panel"><h2>Performans eğilimi</h2><div className="stats-grid"><div className="context-stat"><strong>%{trend?.peakCpuPercent??0}</strong><span>tepe CPU</span></div><div className="context-stat"><strong>%{trend?.peakMemoryPercent??0}</strong><span>tepe RAM</span></div></div><div className="section-heading"><p>Beş dakikalık otomatik örnekleme geçmişi.</p><Button onClick={()=>void sample()}>Şimdi örnek al</Button></div>{performance.slice(0,8).map(x=><div className="list-row" key={x.id}><div><strong>CPU %{x.cpuLoadPercent} · RAM %{x.memoryUsagePercent}</strong><small>DB {bytes(x.databaseBytes)} · Arşiv {bytes(x.archiveBytes)}</small></div><span>{formatDate(x.sampledAt,{hour:'2-digit',minute:'2-digit'})}</span></div>)}</article><article className="panel"><h2>Arka plan görevleri</h2>{tasks.length?tasks.slice(0,10).map(t=><div className="list-row" key={t.id}><div><strong>{t.label}</strong><small>{t.taskType} · {t.status}{t.details?` · ${t.details}`:''}</small></div><span>{t.durationMs!=null?`${Math.round(t.durationMs/1000)} sn`:'çalışıyor'}</span></div>):<EmptyState title="Görev kaydı yok" body="Yedekleme ve bakım görevleri burada izlenecek."/>}</article></div>
  <div className="content-grid two"><article className="panel"><h2>Bakım işlemleri</h2><div className="button-row"><Button onClick={()=>void maintain('integrity_check')}>Bütünlük kontrolü</Button><Button onClick={()=>void maintain('wal_checkpoint')}>WAL temizle</Button><Button onClick={()=>void maintain('analyze')}>ANALYZE</Button><Button tone="danger" onClick={()=>void maintain('vacuum')}>VACUUM</Button></div>{result&&<p className={result.success?'success-text':'error-text'}>{result.message}</p>}{health?.warnings.map(w=><p className="warning-text" key={w}>{w}</p>)}</article><article className="panel"><h2>Son yedek çalışmaları</h2>{runs.slice(0,8).map(r=><div className="list-row" key={r.id}><div><strong>{r.status==='success'?'Doğrulandı':'Başarısız'}</strong><small>{r.filePath??r.error}</small></div><span>{r.sizeBytes?bytes(r.sizeBytes):'—'}</span></div>)}</article></div>
  {systemMessage&&<p className="success-text">{systemMessage}</p>}
  <div className="content-grid two"><article className="panel"><div className="section-heading"><div><h2>Görev öncelik kuyruğu</h2><p>Kritik görevler adaptif kapasiteye göre önce çalıştırılır.</p></div><Button onClick={()=>void processQueue()}>Kuyruğu çalıştır</Button></div>{queue.length?queue.slice(0,12).map(q=><div className="list-row" key={q.id}><div><strong>{q.label}</strong><small>{q.taskType} · {q.priority} · {q.status}{q.details?` · ${q.details}`:''}</small></div><span>{q.attempts}/{q.maxAttempts}</span></div>):<EmptyState title="Kuyruk boş" body="Zamanlanmış bakım, performans ve yedek görevleri burada görünür."/>}</article><article className="panel"><div className="section-heading"><div><h2>Sistem sağlığı bildirimleri</h2><p>Yeni uyarıları üretin ve incelenen kayıtları onaylayın.</p></div><Button onClick={()=>void evaluateNotifications()}>Sağlığı değerlendir</Button></div>{notifications.length?notifications.slice(0,12).map(n=><div className="list-row" key={n.id}><div><strong>{n.severity==='critical'?'Kritik':n.severity==='warning'?'Uyarı':'Bilgi'} · {n.title}</strong><small>{n.message}</small></div>{n.acknowledgedAt?<span>Onaylandı</span>:<Button onClick={()=>void acknowledge(n.id)}>Onayla</Button>}</div>):<EmptyState title="Aktif sağlık bildirimi yok" body="Sistem sağlığı değerlendirmesi yeni kayıt üretebilir."/>}</article></div>
  <div className="content-grid two"><article className="panel"><h2>Otomatik bakım politikası</h2>{policy&&<form className="form-grid" onSubmit={e=>void savePolicy(e)}><label><input name="enabled" type="checkbox" defaultChecked={policy.enabled}/> Otomatik bakım etkin</label><label>Çalışma aralığı (saat)<input name="intervalHours" type="number" min="1" max="720" defaultValue={policy.intervalHours}/></label><label>Tanılama saklama (gün)<input name="keepDiagnosticDays" type="number" min="1" max="3650" defaultValue={policy.keepDiagnosticDays}/></label><label>Performans saklama (gün)<input name="keepPerformanceDays" type="number" min="1" max="3650" defaultValue={policy.keepPerformanceDays}/></label><Button tone="primary" type="submit">Politikayı kaydet</Button><Button type="button" onClick={()=>void runAutoMaintenance()}>Bakımı şimdi çalıştır</Button></form>}</article><article className="panel"><h2>Tanılama raporu</h2><p>Donanım, veritabanı, yedekleme, performans, bildirim ve görev kuyruğunu tek JSON raporunda dışa aktarır.</p><div className="button-row"><Button tone="primary" onClick={()=>void exportDiagnostic()}>JSON raporu dışa aktar</Button><Button onClick={()=>void refresh()}>Verileri yenile</Button></div><small>Rapor kişisel kayıt içeriğini değil, sistem ve işletim sağlığı özetlerini içerir.</small>{reportHistory.slice(0,5).map(r=><div className="list-row" key={r.id}><div><strong>Puan {r.healthScore}/100</strong><small>{r.sha256.slice(0,16)}…</small></div><span>{formatDate(r.generatedAt,{dateStyle:'short',timeStyle:'short'})}</span></div>)}</article></div>
  <article className="panel"><div className="section-heading"><div><h2>IPC performans telemetrisi</h2><p>Son {ipcTelemetry?.windowMinutes??60} dakika · yalnız toplu teknik ölçümler</p></div><div className="button-row"><span className="eyebrow">{ipcTelemetry?.totalSamples??0} örnek</span><Button disabled={!ipcMaintenanceCredentialsReady||ipcMaintenanceBusy} title={ipcMaintenanceAuthority?.allowed?'Parola ve gerekiyorsa 2FA ile güçlü doğrulama gerekir':`Bakım yetkisi: ${ipcMaintenanceAuthority?.reason??'DENETLENIYOR'}`} onClick={()=>void exportIpcAdaptiveDiagnostics()}>Tanı paketini dışa aktar</Button><Button disabled={!ipcMaintenanceCredentialsReady||ipcMaintenanceBusy} title={ipcMaintenanceAuthority?.allowed?'Parola ve gerekiyorsa 2FA ile güçlü doğrulama gerekir':`Bakım yetkisi: ${ipcMaintenanceAuthority?.reason??'DENETLENIYOR'}`} onClick={()=>void resetIpcAdaptiveBudget()}>Bütçeyi sıfırla</Button>{ipcMaintenanceRecoveryAuthority?.recoveryRequired&&<Button tone="danger" disabled={!ipcMaintenanceRecoveryReady||ipcMaintenanceBusy} title={`Kurtarma yetkisi: ${ipcMaintenanceRecoveryAuthority.reason}`} onClick={()=>void recoverIpcAdaptiveBudgetMaintenanceLock()}>Bakım kilidini kurtar</Button>}</div></div><div className="form-grid lifecycle-reauth"><label>Bakım parolası<input type="password" autoComplete="current-password" value={ipcMaintenancePassword} disabled={!ipcMaintenanceCredentialsAvailable||ipcMaintenanceBusy} onChange={event=>setIpcMaintenancePassword(event.target.value)}/></label><label>2FA / kurtarma kodu {(ipcMaintenanceAuthority?.twoFactorRequired||ipcMaintenanceRecoveryAuthority?.twoFactorRequired)?'(zorunlu)':'(etkinse)'}<input inputMode="numeric" autoComplete="one-time-code" maxLength={64} value={ipcMaintenanceCode} disabled={!ipcMaintenanceCredentialsAvailable||ipcMaintenanceBusy} onChange={event=>setIpcMaintenanceCode(event.target.value.replace(/\s+/g,''))}/></label>{ipcMaintenanceRecoveryAuthority?.recoveryRequired&&<label>Kurtarma onayı<input value={ipcMaintenanceRecoveryConfirmation} disabled={ipcMaintenanceRecoveryAuthority.allowed!==true||ipcMaintenanceBusy} placeholder={ipcMaintenanceRecoveryAuthority.confirmationPhrase} onChange={event=>setIpcMaintenanceRecoveryConfirmation(event.target.value)}/></label>}</div><small>Bakım oturumu açılmadan önce güçlü yeniden doğrulama yapılır; parola ve 2FA kodu kaydedilmez, günlüklenmez ve tanı paketine eklenmez; tek kullanımlık kurtarma kodu da aynı gizlilik sınırındadır. Başarısız denemeler sınırlıdır ve işletim sistemi korumasıyla şifrelenerek uygulama yeniden başlatmalarında korunur. Başarılı kurtarma hesap güvenlik dönemini ilerletir, tüm eski güvenilir cihaz bağlarını iptal eder ve yeniden yetkilendirme ister.</small>{ipcMaintenanceAuthority?.reauthenticationLocked&&<p className="warning-text">Güçlü doğrulama geçici olarak kilitli. Normal bekleme süresi yaklaşık {ipcMaintenanceAuthority.reauthenticationRetryAfterSeconds??1} saniye. Yetkili kurtarma, ayrı kalıcı deneme sayacı ve açık onayla kullanılabilir.</p>}{ipcMaintenanceRecoveryAuthority?.recoveryLocked&&<p className="warning-text">Kurtarma doğrulaması da geçici olarak sınırlandı. Yaklaşık {ipcMaintenanceRecoveryAuthority.recoveryRetryAfterSeconds??1} saniye sonra yeniden deneyin.</p>}<div className="metric-row"><span>Bakım yetkisi <strong>{ipcMaintenanceAuthority?.allowed?'Açık':ipcMaintenanceAuthority?.reason??'Denetleniyor'}</strong></span><span>Kurtarma <strong>{ipcMaintenanceRecoveryAuthority?.allowed?'Açık':ipcMaintenanceRecoveryAuthority?.reason??'Denetleniyor'}</strong></span><span>Güçlü doğrulama <strong>{ipcMaintenanceAuthority?.strongReauthenticationRequired?'Zorunlu':'—'}</strong></span><span>Normal deneme <strong>{ipcMaintenanceAuthority?.remainingReauthenticationAttempts??'—'}/{ipcMaintenanceAuthority?.maximumReauthenticationAttempts??'—'}</strong></span><span>Kurtarma denemesi <strong>{ipcMaintenanceRecoveryAuthority?.remainingRecoveryAttempts??'—'}/{ipcMaintenanceRecoveryAuthority?.maximumRecoveryAttempts??'—'}</strong></span><span>Etkin <strong>{ipcTelemetry?.activeRequests??0}</strong></span><span>Kuyruk <strong>{ipcTelemetry?.queuedRequests??0}</strong></span><span>Cache <strong>{ipcTelemetry?.cacheEntries??0}</strong></span></div><div className="list-row"><div><strong>Adaptif kaynak bütçesi</strong><small>{ipcTelemetry?.adaptiveBudget.reason??'startup-baseline'} · nesil {ipcTelemetry?.adaptiveBudget.generation??0} · kalıcılık {ipcTelemetry?.adaptiveBudget.persistence.status??'disabled'}</small></div><span>{ipcTelemetry?.adaptiveBudget.mode??'baseline'}</span></div>{ipcTelemetry?.alerts.length?ipcTelemetry.alerts.slice(0,6).map(alert=><div className={`health-alert ${alert.severity}`} key={`${alert.code}-${alert.channel??'global'}-${alert.metric}`}><strong>{alert.message}</strong><small>{alert.channel??'genel'} · {Math.round(alert.value)} / eşik {Math.round(alert.threshold)}</small></div>):<EmptyState title="IPC darboğazı bulunmadı" body="Yanıt süresi, kuyruk beklemesi ve süre aşımı oranları normal sınırda."/>}{ipcTelemetry?.channels.slice(0,8).map(channel=><div className="list-row" key={channel.channel}><div><strong>{channel.channel}</strong><small>p95 {Math.round(channel.p95DurationMs)} ms · kuyruk {Math.round(channel.p95QueueWaitMs)} ms · cache %{channel.cacheHitRatePercent}</small></div><span>{channel.sampleCount} istek</span></div>)}</article>
  <article className="panel"><div className="section-heading"><div><h2>Dışa aktarım geçmişi</h2><p>JSON, CSV ve PDF çıktılarının bütünlük kaydı.</p></div></div>{exportHistory.length?exportHistory.map(item=><div className="list-row" key={item.id}><div><strong>{item.kind} · {item.format.toUpperCase()}</strong><small>{item.filePath} · {item.sizeBytes} bayt</small></div><Button onClick={async()=>{const v=await window.pardus?.verifyExportArtifact(item.id);setVerificationMessage(v?.valid?'Dışa aktarım dosyası doğrulandı.':'Dosya kayıp veya değiştirilmiş.');}}>Doğrula</Button></div>):<EmptyState title="Dışa aktarım yok" body="Oluşturulan rapor ve arşiv çıktıları burada listelenecek."/>}</article><article className="panel"><div className="section-heading"><div><h2>Tanılama günlüğü</h2><p>Metin, kod ve önem seviyesine göre filtreleyin.</p></div><div className="button-row"><input value={diagQuery} onChange={e=>setDiagQuery(e.target.value)} placeholder="Ara…"/><select value={diagSeverity} onChange={e=>setDiagSeverity(e.target.value)}><option value="">Tüm seviyeler</option><option value="info">Bilgi</option><option value="warning">Uyarı</option><option value="error">Hata</option></select><Button onClick={()=>void filterDiagnostics()}>Filtrele</Button></div></div>{diagnostics.length?diagnostics.map(d=><div className="list-row" key={d.id}><div><strong>{d.severity.toUpperCase()} · {d.code}</strong><small>{d.message}{d.details?` · ${d.details}`:''}</small></div><span>{formatDate(d.occurredAt,{day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'})}</span></div>):<EmptyState title="Tanılama kaydı yok" body="Filtreye uyan kayıt bulunamadı."/>}</article><div className="content-grid two"><article className="panel"><div className="section-heading"><div><h2>Sağlık puanı eğilimi</h2><p>{healthTrend?.windowDays??healthDays} günlük görünüm · {healthTrend?.sampleCount??0} ölçüm</p></div><div className="button-row"><select value={healthDays} onChange={e=>setHealthDays(Number(e.target.value))}><option value="7">7 gün</option><option value="30">30 gün</option><option value="90">90 gün</option><option value="365">1 yıl</option></select><Button onClick={async()=>{await window.pardus?.captureHealthScore();await refresh();}}>Ölçüm al</Button></div></div><div className="health-chart">{healthHistory.slice().reverse().map(item=><div className="health-bar" key={item.id} title={`${item.score}/100 · ${formatDate(item.capturedAt,{dateStyle:'short'})}`}><span style={{height:`${Math.max(6,item.score)}%`}} /></div>)}</div><div className="metric-row"><span>Ortalama <strong>{healthTrend?.averageScore??0}</strong></span><span>En düşük <strong>{healthTrend?.minimumScore??0}</strong></span><span>Değişim <strong>{healthTrend?.change??0}</strong></span></div></article><article className="panel"><div className="section-heading"><h2>Performans anomalileri</h2><select value={performanceHours} onChange={e=>setPerformanceHours(Number(e.target.value))}><option value="24">24 saat</option><option value="168">7 gün</option><option value="720">30 gün</option></select></div>{anomalies.length?anomalies.map(a=><div className={`health-alert ${a.severity}`} key={`${a.metric}-${a.detectedAt}`}><strong>{a.message}</strong><small>{a.metric} · {Math.round(a.value)} / eşik {Math.round(a.threshold)}</small></div>):<EmptyState title="Anomali bulunmadı" body="Son 24 saatlik ölçümler normal aralıkta."/>}</article></div>
  <div className="content-grid two"><article className="panel"><div className="section-heading"><div><h2>Tanılama rapor merkezi</h2><p>Raporu açın, doğrulayın ve iki sürümü karşılaştırın.</p></div><Button onClick={()=>void exportDiagnostic()}>Yeni rapor</Button></div><div className="button-row"><select value={compareLeft} onChange={e=>setCompareLeft(e.target.value)}><option value="">İlk rapor</option>{reportHistory.map(r=><option key={r.id} value={r.id}>{formatDate(r.generatedAt,{dateStyle:'short',timeStyle:'short'})}</option>)}</select><select value={compareRight} onChange={e=>setCompareRight(e.target.value)}><option value="">İkinci rapor</option>{reportHistory.map(r=><option key={r.id} value={r.id}>{formatDate(r.generatedAt,{dateStyle:'short',timeStyle:'short'})}</option>)}</select><Button onClick={()=>void compareReports()}>Karşılaştır</Button></div>{comparison&&<div className="comparison-card"><strong>Sağlık puanı değişimi: {comparison.healthScoreChange>0?'+':''}{comparison.healthScoreChange}</strong><small>Değişen bölümler: {comparison.changedKeys.join(', ')||'Yok'} · Durum değişti: {comparison.statusChanged?'Evet':'Hayır'}</small>{comparison.sectionChanges.slice(0,8).map(x=><div className="comparison-detail" key={`${x.kind}-${x.key}`}><b>{x.kind} · {x.key}</b><code>{x.rightSummary??x.leftSummary}</code></div>)}</div>}{reportHistory.map(r=><div className="report-row" key={r.id}><div><strong>{formatDate(r.generatedAt,{dateStyle:'short',timeStyle:'short'})}</strong><small>Puan {r.healthScore}/100 · {bytes(r.sizeBytes)}</small></div><Button onClick={()=>void openReport(r.id)}>Aç ve doğrula</Button></div>)}{reportContent&&<pre className="report-preview">{reportContent.content.slice(0,12000)}</pre>}{verificationMessage&&<small>{verificationMessage}</small>}</article><article className="panel"><div className="section-heading"><div><h2>Olay arşivleri</h2><p>Eski tanılama kayıtları sıkıştırılmış ve hash doğrulamalı saklanır.</p></div><Button onClick={()=>void archiveOldDiagnostics()}>30 günden eskiyi arşivle</Button></div>{archives.map(a=><div className="report-row" key={a.id}><div><strong>{a.entryCount} olay</strong><small>{formatDate(a.createdAt,{dateStyle:'short'})} · {bytes(a.sizeBytes)}</small></div><div className="button-row"><Button onClick={()=>void verifyArchive(a.id)}>Doğrula</Button><Button onClick={()=>void openArchive(a.id)}>İçeriği aç</Button></div></div>)}{archiveContent&&<div className="archive-preview"><div className="section-heading"><strong>{archiveContent.entryCount} arşiv olayı</strong><div className="button-row"><input value={archiveQuery} onChange={e=>setArchiveQuery(e.target.value)} placeholder="Arşivde ara…"/><Button onClick={()=>void searchArchiveEvents()}>Ara</Button><Button onClick={()=>void exportArchiveEvents('json')}>JSON</Button><Button onClick={()=>void exportArchiveEvents('csv')}>CSV</Button></div></div>{archiveContent.entries.slice(0,20).map(e=><div className="list-row" key={e.id}><div><strong>{e.code}</strong><small>{e.message}</small></div><span>{formatDate(e.occurredAt,{dateStyle:'short',timeStyle:'short'})}</span></div>)}</div>}</article></div>
  <article className="panel"><h2>Bakım görev sonuç geçmişi</h2>{maintenanceHistory.map(x=><div className="list-row" key={x.id}><div><strong>{x.operation} · {x.success?'Başarılı':'Başarısız'}</strong><small>{x.source} · {x.message}</small></div><span>{x.durationMs} ms</span></div>)}</article>
  <article className="panel"><h2>Akıllı bakım önerileri</h2><div className="recommendation-grid">{recommendations.map(item=><div className="recommendation-card" key={item.code}><span className={`priority-dot ${item.priority}`} /><div><strong>{item.title}</strong><p>{item.message}</p></div><Button onClick={()=>void recommendationToTask(item)}>Göreve dönüştür</Button></div>)}</div></article></section>;
  return localizeSystemMaintenanceNode(panel,language);
}

function PlaceholderScreen({ screen, snapshot, auth }: { screen: ScreenId; snapshot: FamilyAppSnapshot; auth:AuthStateView }) {
  void snapshot; void auth;
  const {language}=useLocalization();const text=(tr:string,en:string)=>language==='tr'?tr:en;
  return <><PageHeader eyebrow={text('Gezinme','Navigation')} title={text('Bölüm bulunamadı','Section not found')} description={text(`${screen} bölümü bu sürümün gezinme sözleşmesinde yer almıyor.`,`${screen} is not part of this release's navigation contract.`)}/><EmptyState title={text('Geçersiz menü hedefi','Invalid menu destination')} body={text('Sol menüden kullanılabilir bir bölüm seçin.','Select an available section from the left menu.')}/></>;
}


const lifecycleTypeLabels:Record<DataLifecycleResourceType,string>={finance_record:'Finans kaydı',health_record:'Sağlık kaydı',medication_plan:'İlaç planı',family_health_history:'Aile sağlık geçmişi',life_record:'Yaşam kaydı'};
const lifecycleStateLabels:Record<DataLifecycleRecordView['state'],string>={active:'Etkin',archived:'Arşivlendi',purge_scheduled:'İmha bekliyor',purged:'Kalıcı olarak imha edildi'};
const lifecycleResourceTypes=Object.keys(lifecycleTypeLabels) as DataLifecycleResourceType[];

export function DataLifecycleSettings({auth}:{auth:AuthStateView}){
  const {language}=useLocalization();
  const promptLocalized=(message:string,defaultValue='')=>window.prompt(translateDataLifecycleCopy(message,language),defaultValue);
  const confirmLocalized=(message:string)=>window.confirm(translateDataLifecycleCopy(message,language));
  const [policies,setPolicies]=useState<DataRetentionPolicyView[]>([]);
  const [records,setRecords]=useState<DataLifecycleRecordView[]>([]);
  const [propagationRuns,setPropagationRuns]=useState<BackupPropagationRunView[]>([]);
  const [cleanRewriteStatus,setCleanRewriteStatus]=useState<BackupCleanRewriteStatusView|null>(null);
  const [cleanRewriteRuns,setCleanRewriteRuns]=useState<BackupCleanRewriteRunView[]>([]);
  const [cleanRewriteEnabled,setCleanRewriteEnabled]=useState(true);
  const [cleanRewriteRetentionDays,setCleanRewriteRetentionDays]=useState(30);
  const [quarantinePolicy,setQuarantinePolicy]=useState<BackupQuarantinePolicyView|null>(null);
  const [quarantineBatches,setQuarantineBatches]=useState<BackupQuarantineBatchView[]>([]);
  const [quarantineRetentionDays,setQuarantineRetentionDays]=useState(90);
  const [externalCopies,setExternalCopies]=useState<ExternalBackupCopyView[]>([]);
  const [externalSummary,setExternalSummary]=useState<ExternalBackupInventorySummaryView|null>(null);
  const [externalEvidenceIssuers,setExternalEvidenceIssuers]=useState<ExternalBackupEvidenceIssuerView[]>([]);
  const [externalEvidenceRotations,setExternalEvidenceRotations]=useState<ExternalBackupEvidenceIssuerRotationView[]>([]);
  const [externalEvidenceRevocationLists,setExternalEvidenceRevocationLists]=useState<ExternalBackupEvidenceRevocationListView[]>([]);
  const [externalRevocationEndpoints,setExternalRevocationEndpoints]=useState<ExternalBackupRevocationEndpointView[]>([]);
  const [revocationSyncStates,setRevocationSyncStates]=useState<RevocationSyncEndpointStateView[]>([]);
  const [externalEvidence,setExternalEvidence]=useState<ExternalBackupDestructionEvidenceView[]>([]);
  const [externalIssuerLabel,setExternalIssuerLabel]=useState('');
  const [externalIssuerPublicKey,setExternalIssuerPublicKey]=useState('');
  const [externalIssuerLegalName,setExternalIssuerLegalName]=useState('');
  const [externalIssuerIdentityEvidence,setExternalIssuerIdentityEvidence]=useState('');
  const [externalIssuerFingerprintEvidence,setExternalIssuerFingerprintEvidence]=useState('');
  const [externalIssuerExpectedFingerprint,setExternalIssuerExpectedFingerprint]=useState('');
  const [externalIssuerWitnessName,setExternalIssuerWitnessName]=useState('');
  const [externalIssuerWitnessOrganization,setExternalIssuerWitnessOrganization]=useState('');
  const [externalLabel,setExternalLabel]=useState('');
  const [externalKind,setExternalKind]=useState<ExternalBackupCopyKind>('offline_disk');
  const [externalLocation,setExternalLocation]=useState('');
  const [externalCustodian,setExternalCustodian]=useState('');
  const [externalReviewDays,setExternalReviewDays]=useState(90);
  const [externalHistoricalRisk,setExternalHistoricalRisk]=useState(true);
  const [propagationRunning,setPropagationRunning]=useState(false);
  const [message,setMessage]=useState('');
  const [policyName,setPolicyName]=useState(language==='tr'?'Standart hassas veri saklama':'Standard sensitive-data retention');
  const [retentionDays,setRetentionDays]=useState(365);
  const [graceDays,setGraceDays]=useState(30);
  const [selectedTypes,setSelectedTypes]=useState<DataLifecycleResourceType[]>([...lifecycleResourceTypes]);
  const [password,setPassword]=useState('');
  const [code,setCode]=useState('');
  const refresh=async()=>{if(!window.pardus||!auth.authenticated)return;const admin=auth.role==='family_admin';const [nextPolicies,nextRecords,nextPropagationRuns,nextCleanRewriteStatus,nextCleanRewriteRuns,nextQuarantinePolicy,nextQuarantineBatches,nextExternalCopies,nextExternalSummary,nextExternalEvidenceIssuers,nextExternalEvidenceRotations,nextExternalEvidenceRevocationLists,nextExternalRevocationEndpoints,nextRevocationSyncStates,nextExternalEvidence]=await Promise.all([window.pardus.listDataRetentionPolicies(),window.pardus.listDataLifecycleRecords(),admin?window.pardus.listBackupPropagationRuns(10):Promise.resolve([]),admin?window.pardus.getBackupCleanRewriteStatus():Promise.resolve(null),admin?window.pardus.listBackupCleanRewriteRuns(20):Promise.resolve([]),admin?window.pardus.getBackupQuarantinePolicy():Promise.resolve(null),admin?window.pardus.listBackupQuarantineBatches(100):Promise.resolve([]),admin?window.pardus.listExternalBackupCopies(200):Promise.resolve([]),admin?window.pardus.getExternalBackupInventorySummary():Promise.resolve(null),admin?window.pardus.listExternalBackupEvidenceIssuers(100):Promise.resolve([]),admin?window.pardus.listExternalBackupEvidenceIssuerRotations(100):Promise.resolve([]),admin?window.pardus.listExternalBackupEvidenceRevocationLists(100):Promise.resolve([]),admin?window.pardus.listExternalBackupRevocationEndpoints(100):Promise.resolve([]),admin?window.pardus.listRevocationSyncStates():Promise.resolve([]),admin?window.pardus.listExternalBackupDestructionEvidence(undefined,200):Promise.resolve([])]);setPolicies(nextPolicies);setRecords(nextRecords);setPropagationRuns(nextPropagationRuns);setCleanRewriteStatus(nextCleanRewriteStatus);setCleanRewriteRuns(nextCleanRewriteRuns);setQuarantinePolicy(nextQuarantinePolicy);setQuarantineBatches(nextQuarantineBatches);setExternalCopies(nextExternalCopies);setExternalSummary(nextExternalSummary);setExternalEvidenceIssuers(nextExternalEvidenceIssuers);setExternalEvidenceRotations(nextExternalEvidenceRotations);setExternalEvidenceRevocationLists(nextExternalEvidenceRevocationLists);setExternalRevocationEndpoints(nextExternalRevocationEndpoints);setRevocationSyncStates(nextRevocationSyncStates);setExternalEvidence(nextExternalEvidence);if(nextCleanRewriteStatus){setCleanRewriteEnabled(nextCleanRewriteStatus.policy.enabled);setCleanRewriteRetentionDays(nextCleanRewriteStatus.policy.retentionDays);}if(nextQuarantinePolicy)setQuarantineRetentionDays(nextQuarantinePolicy.retentionDays);};
  useEffect(()=>{void refresh();},[auth.authenticated]);
  const run=async(action:()=>Promise<DataLifecycleRecordView[]>,success:string)=>{try{setRecords(await action());setMessage(success);}catch(error){setMessage(error instanceof Error?error.message:'Veri yaşam döngüsü işlemi tamamlanamadı.');}};
  const createPolicy=async(event:FormEvent<HTMLFormElement>)=>{event.preventDefault();if(!window.pardus)return;try{setPolicies(await window.pardus.createDataRetentionPolicy({name:policyName,resourceTypes:selectedTypes,retentionDays,graceDays,requiresStrongAuth:true}));setMessage('Saklama politikası oluşturuldu.');}catch(error){setMessage(error instanceof Error?error.message:'Saklama politikası oluşturulamadı.');}};
  const policyFor=(record:DataLifecycleRecordView)=>policies.find(policy=>policy.resourceTypes.includes(record.resourceType));
  const archive=async(record:DataLifecycleRecordView)=>{if(!window.pardus)return;const policy=policyFor(record);await run(()=>window.pardus!.archiveDataResource({resourceType:record.resourceType,resourceId:record.resourceId,...(policy?{policyId:policy.id}:{})}),'Kayıt geri alınabilir biçimde arşivlendi.');};
  const restore=async(record:DataLifecycleRecordView)=>{if(window.pardus)await run(()=>window.pardus!.restoreDataResource({resourceType:record.resourceType,resourceId:record.resourceId}),'Kayıt etkin duruma geri alındı.');};
  const requestPurge=async(record:DataLifecycleRecordView)=>{if(!window.pardus)return;const expected=`KALICI İMHA ${record.resourceType}/${record.resourceId}`;const confirmation=promptLocalized(language==='tr'?`İmha talebi için şu metni birebir yazın:\n${expected}`:`Type the following text exactly to request destruction:\n${expected}`);if(confirmation===null)return;await run(()=>window.pardus!.requestDataPurge({resourceType:record.resourceType,resourceId:record.resourceId,password,...(code.trim()?{code:code.trim()}:{}),confirmation}),'Kalıcı imha talebi oluşturuldu; geri alma süresi boyunca iptal edilebilir.');};
  const executePurge=async(record:DataLifecycleRecordView)=>{if(!window.pardus)return;const expected=`GERİ ALINAMAZ İMHA ${record.resourceType}/${record.resourceId}`;const confirmation=promptLocalized(language==='tr'?`Bu işlem uygulamadaki canlı kaydı geri alınamaz biçimde siler. Şu metni birebir yazın:\n${expected}`:`This permanently deletes the live record from the application. Type the following text exactly:\n${expected}`);if(confirmation===null)return;await run(()=>window.pardus!.executeDataPurge({resourceType:record.resourceType,resourceId:record.resourceId,password,...(code.trim()?{code:code.trim()}:{}),confirmation}),'Canlı kayıt kalıcı olarak imha edildi. Önceki yedek kopyalarının süre dolana kadar bulunabileceğini unutmayın.');};
  const cancelPurge=async(record:DataLifecycleRecordView)=>{if(window.pardus)await run(()=>window.pardus!.cancelDataPurge({resourceType:record.resourceType,resourceId:record.resourceId}),'Kalıcı imha talebi iptal edildi.');};
  const toggleHold=async(record:DataLifecycleRecordView)=>{if(!window.pardus)return;const enabled=!record.legalHold;const reason=enabled?(window.prompt('Hukuki/koruma bekletmesi gerekçesini yazın (en az 8 karakter):','')??''):'Bekletme kullanıcı tarafından kaldırıldı.';if(enabled&&!reason)return;await run(()=>window.pardus!.setDataLegalHold({resourceType:record.resourceType,resourceId:record.resourceId,enabled,reason,password,...(code.trim()?{code:code.trim()}:{})}),enabled?'Kayıt imhaya karşı bekletmeye alındı.':'Kayıt bekletmesi kaldırıldı.');};
  const propagateBackups=async()=>{if(!window.pardus||propagationRunning)return;setPropagationRunning(true);try{const result=await window.pardus.runBackupCleanRewrite();const propagation=result.propagationRun;setMessage(result.status==='success'&&propagation?`Temiz yedek yeniden yazımı tamamlandı; ${propagation.quarantinedArtifacts} eski yedek karantinaya alındı.`:`Temiz yedek yeniden yazımı ${result.status}: ${result.reason??'tanı kaydı oluşturuldu.'}`);await refresh();}catch(error){setMessage(error instanceof Error?error.message:'Temiz yedek yeniden yazımı tamamlanamadı.');}finally{setPropagationRunning(false);}};
  const saveCleanRewritePolicy=async(event:FormEvent<HTMLFormElement>)=>{event.preventDefault();if(!window.pardus)return;try{await window.pardus.updateBackupCleanRewritePolicy({enabled:cleanRewriteEnabled,retentionDays:cleanRewriteRetentionDays,password,...(code.trim()?{code:code.trim()}:{})});setMessage('Otomatik temiz yedek yeniden yazım politikası güncellendi.');await refresh();}catch(error){setMessage(error instanceof Error?error.message:'Temiz yedek yeniden yazım politikası güncellenemedi.');}};
  const saveQuarantinePolicy=async(event:FormEvent<HTMLFormElement>)=>{event.preventDefault();if(!window.pardus)return;try{const next=await window.pardus.updateBackupQuarantinePolicy({retentionDays:quarantineRetentionDays,password,...(code.trim()?{code:code.trim()}:{})});setQuarantinePolicy(next);setMessage('Yedek karantina saklama politikası güncellendi. Yeni süre yalnız bundan sonra oluşacak karantinalara uygulanır.');}catch(error){setMessage(error instanceof Error?error.message:'Yedek karantina politikası güncellenemedi.');}};
  const toggleQuarantineHold=async(batch:BackupQuarantineBatchView)=>{if(!window.pardus)return;const enabled=!batch.legalHold;const reason=enabled?(window.prompt('Yedek karantinası için hukuki/koruma bekletmesi gerekçesini yazın:','')??''):undefined;if(enabled&&!reason)return;try{setQuarantineBatches(await window.pardus.setBackupQuarantineLegalHold({batchId:batch.id,enabled,...(reason?{reason}:{}),password,...(code.trim()?{code:code.trim()}:{})}));setMessage(enabled?'Yedek karantinası bekletmeye alındı.':'Yedek karantinası bekletmesi kaldırıldı.');}catch(error){setMessage(error instanceof Error?error.message:'Yedek karantina bekletmesi güncellenemedi.');}};
  const destroyQuarantine=async(batch:BackupQuarantineBatchView)=>{if(!window.pardus)return;const expected=`KARANTİNA İMHA ${batch.id}`;const confirmation=window.prompt(`Bu işlem doğrulanmış karantina yedeklerini geri alınamaz biçimde yok eder. Şu metni birebir yazın:
${expected}`,'');if(confirmation===null)return;try{const result=await window.pardus.destroyBackupQuarantineBatch({batchId:batch.id,confirmation,password,...(code.trim()?{code:code.trim()}:{})});setMessage(`${result.destroyedArtifacts} karantina yedeği nihai imha edildi${result.resumed?' ve yarım kalan işlem güvenli biçimde tamamlandı':''}.`);await refresh();}catch(error){setMessage(error instanceof Error?error.message:'Yedek karantinası imha edilemedi.');}};
  const registerExternalCopy=async(event:FormEvent<HTMLFormElement>)=>{event.preventDefault();if(!window.pardus)return;try{setExternalCopies(await window.pardus.registerExternalBackupCopy({label:externalLabel,kind:externalKind,locationHint:externalLocation,custodian:externalCustodian,reviewIntervalDays:externalReviewDays,containsHistoricalDataRisk:externalHistoricalRisk}));setExternalLabel('');setExternalLocation('');setExternalCustodian('');setMessage('Uygulama dışı yedek kopya envantere eklendi. Fiziksel içerik otomatik doğrulanmış sayılmaz.');setExternalSummary(await window.pardus.getExternalBackupInventorySummary());}catch(error){setMessage(error instanceof Error?error.message:'Uygulama dışı yedek kaydı oluşturulamadı.');}};
  const reviewExternalCopy=async(copy:ExternalBackupCopyView)=>{if(!window.pardus)return;const status=(window.prompt('Kopyanın güncel durumunu yazın: active, unreachable veya retired',copy.status==='destroyed'?'active':copy.status)??'').trim() as 'active'|'unreachable'|'retired';if(!['active','unreachable','retired'].includes(status))return;const risk=window.confirm('Bu kopyada kalıcı imha öncesi tarihsel veri bulunma riski devam ediyor mu?');const note=window.prompt('Fiziksel konum, erişim ve içerik teyidini açıklayın:','')??'';if(!note)return;const confirmation=window.prompt(`Teyit kaydı için şu metni birebir yazın:
HARİCİ YEDEK TEYİT ${copy.id}`,'');if(confirmation===null)return;try{setExternalCopies(await window.pardus.reviewExternalBackupCopy({id:copy.id,status,containsHistoricalDataRisk:risk,reviewIntervalDays:copy.reviewIntervalDays,note,confirmation,password,...(code.trim()?{code:code.trim()}:{})}));setExternalSummary(await window.pardus.getExternalBackupInventorySummary());setMessage('Uygulama dışı yedek kopya teyidi kaydedildi.');}catch(error){setMessage(error instanceof Error?error.message:'Kopya teyidi kaydedilemedi.');}};
  const toggleExternalHold=async(copy:ExternalBackupCopyView)=>{if(!window.pardus)return;const enabled=!copy.legalHold;const reason=enabled?(window.prompt('Hukuki/koruma bekletmesi gerekçesini yazın:','')??''):undefined;if(enabled&&!reason)return;try{setExternalCopies(await window.pardus.setExternalBackupCopyLegalHold({id:copy.id,enabled,...(reason?{reason}:{}),password,...(code.trim()?{code:code.trim()}:{})}));setExternalSummary(await window.pardus.getExternalBackupInventorySummary());setMessage(enabled?'Uygulama dışı yedek kopya bekletmeye alındı.':'Kopya bekletmesi kaldırıldı.');}catch(error){setMessage(error instanceof Error?error.message:'Kopya bekletmesi güncellenemedi.');}};
  const attestExternalDestroyed=async(copy:ExternalBackupCopyView)=>{if(!window.pardus)return;const note=window.prompt('Fiziksel imha veya güvenli silme yöntemini ayrıntılı açıklayın:','')??'';if(!note)return;const evidenceSha256=(window.prompt('Varsa imha kanıtı dosyasının SHA-256 değerini yazın; yoksa boş bırakın:','')??'').trim();const confirmation=window.prompt(`Bu kayıt yalnız kullanıcı teyididir; otomatik fiziksel imha kanıtı değildir. Şu metni birebir yazın:
HARİCİ YEDEK İMHA ${copy.id}`,'');if(confirmation===null)return;try{setExternalCopies(await window.pardus.attestExternalBackupCopyDestroyed({id:copy.id,note,...(evidenceSha256?{evidenceSha256}:{}),confirmation,password,...(code.trim()?{code:code.trim()}:{})}));setExternalSummary(await window.pardus.getExternalBackupInventorySummary());setMessage('Uygulama dışı yedek için imha teyidi kaydedildi. Bu kayıt kullanıcı beyanıdır.');}catch(error){setMessage(error instanceof Error?error.message:'İmha teyidi kaydedilemedi.');}};
  const registerExternalEvidenceIssuer=async(event:FormEvent<HTMLFormElement>)=>{event.preventDefault();if(!window.pardus)return;const label=externalIssuerLabel.trim(),expectedFingerprintSha256=externalIssuerExpectedFingerprint.trim().toLowerCase();const confirmation=window.prompt(`Kurum dışı iki kanıtla doğrulanan kök güveni eklemek için şu metni birebir yazın:
KÖK GÜVENİNİ DOĞRULA ${expectedFingerprintSha256.slice(0,16)}`,'');if(confirmation===null)return;try{setExternalEvidenceIssuers(await window.pardus.registerExternalBackupEvidenceIssuer({label,publicKeyPem:externalIssuerPublicKey,legalEntityName:externalIssuerLegalName,identityEvidenceReference:externalIssuerIdentityEvidence,keyFingerprintEvidenceReference:externalIssuerFingerprintEvidence,expectedFingerprintSha256,verificationWitnessName:externalIssuerWitnessName,verificationWitnessOrganization:externalIssuerWitnessOrganization,verificationCheckedAt:new Date().toISOString(),confirmation,password,...(code.trim()?{code:code.trim()}:{})}));setExternalIssuerLabel('');setExternalIssuerPublicKey('');setExternalIssuerLegalName('');setExternalIssuerIdentityEvidence('');setExternalIssuerFingerprintEvidence('');setExternalIssuerExpectedFingerprint('');setExternalIssuerWitnessName('');setExternalIssuerWitnessOrganization('');setMessage('Ed25519 kök güveni iki bağımsız kurum dışı kanıt ve tanık kaydıyla eklendi.');}catch(error){setMessage(error instanceof Error?error.message:'Kanıt sağlayıcı eklenemedi.');}};
  const rotateExternalEvidenceIssuer=async(issuer:ExternalBackupEvidenceIssuerView)=>{if(!window.pardus)return;const label=(window.prompt('Yeni Ed25519 anahtarının sağlayıcı etiketini yazın:',`${issuer.label} · ardıl anahtar`)??'').trim();if(!label)return;const publicKeyPem=window.prompt('Yeni Ed25519 PUBLIC KEY PEM değerini yazın:','')??'';if(!publicKeyPem)return;const effectiveAt=(window.prompt('Yeni anahtarın geçerli olacağı ISO-8601 zamanını yazın:',new Date().toISOString())??'').trim();if(!effectiveAt)return;const receiptId=(window.prompt('Benzersiz anahtar döndürme makbuzu kimliğini yazın:','')??'').trim();if(!receiptId)return;const signatureBase64=(window.prompt('Önceki anahtarın kanonik döndürme makbuzu üzerindeki Ed25519 Base64 imzasını yazın:','')??'').trim();if(!signatureBase64)return;const confirmation=window.prompt(`Anahtar döndürmek için şu metni birebir yazın:
KANIT ANAHTARI DÖNDÜR ${issuer.id}`,'');if(confirmation===null)return;try{const result=await window.pardus.rotateExternalBackupEvidenceIssuer({predecessorIssuerId:issuer.id,label,publicKeyPem,effectiveAt,receiptId,signatureBase64,confirmation,password,...(code.trim()?{code:code.trim()}:{})});setExternalEvidenceIssuers(result.issuers);setExternalEvidenceRotations(result.rotations);setMessage('Sağlayıcı anahtarı önceki Ed25519 anahtarının imzasıyla güvenli biçimde döndürüldü.');}catch(error){setMessage(error instanceof Error?error.message:'Sağlayıcı anahtarı döndürülemedi.');}};
  const revokeExternalEvidenceIssuer=async(issuer:ExternalBackupEvidenceIssuerView)=>{if(!window.pardus)return;const reason=window.prompt('Sağlayıcı güvenini iptal etme gerekçesini yazın:','')??'';if(!reason)return;const confirmation=window.prompt(`Sağlayıcı anahtarını iptal etmek için şu metni birebir yazın:
KANIT SAĞLAYICI İPTAL ${issuer.id}`,'');if(confirmation===null)return;try{setExternalEvidenceIssuers(await window.pardus.revokeExternalBackupEvidenceIssuer({id:issuer.id,reason,confirmation,password,...(code.trim()?{code:code.trim()}:{})}));const [copies,evidence]=await Promise.all([window.pardus.listExternalBackupCopies(200),window.pardus.listExternalBackupDestructionEvidence(undefined,200)]);setExternalCopies(copies);setExternalEvidence(evidence);setMessage('Sağlayıcı anahtarı iptal edildi; bağlı imha kanıtlarının güven durumu düşürüldü.');}catch(error){setMessage(error instanceof Error?error.message:'Sağlayıcı güveni iptal edilemedi.');}};
  const verifySignedExternalEvidence=async(copy:ExternalBackupCopyView)=>{if(!window.pardus)return;const trusted=externalEvidenceIssuers.filter(issuer=>issuer.trustState==='active');if(trusted.length===0){setMessage('Önce güvenilen bir Ed25519 kanıt sağlayıcısı ekleyin.');return;}const issuerId=(window.prompt(`Güvenilen sağlayıcı kimliğini yazın:
${trusted.map(issuer=>`${issuer.id} — ${issuer.label}`).join('\n')}`,trusted[0]?.id??'')??'').trim();if(!issuerId)return;const receiptId=(window.prompt('Sağlayıcının benzersiz makbuz kimliğini yazın:','')??'').trim();if(!receiptId)return;const issuedAt=(window.prompt('Makbuz zamanını ISO-8601 biçiminde yazın:',new Date().toISOString())??'').trim();if(!issuedAt)return;const evidenceSha256=(window.prompt('İmha kanıtı veya makbuz dosyasının SHA-256 değerini yazın:','')??'').trim().toLowerCase();if(!evidenceSha256)return;const signatureBase64=(window.prompt('Kanonik makbuzun Ed25519 Base64 imzasını yazın:','')??'').trim();if(!signatureBase64)return;const confirmation=window.prompt(`İmzalı kanıtı doğrulamak için şu metni birebir yazın:
İMZALI İMHA KANITI ${copy.id}`,'');if(confirmation===null)return;try{const result=await window.pardus.verifyExternalBackupDestructionEvidence({copyId:copy.id,issuerId,receiptId,issuedAt,evidenceSha256,signatureBase64,confirmation,password,...(code.trim()?{code:code.trim()}:{})});setExternalCopies(result.copies);setExternalEvidence(current=>[...result.evidence,...current.filter(item=>item.copyId!==copy.id)]);setExternalSummary(await window.pardus.getExternalBackupInventorySummary());setMessage('Sağlayıcı imzalı imha makbuzu doğrulandı ve kopya kaydına bağlandı.');}catch(error){setMessage(error instanceof Error?error.message:'İmzalı imha kanıtı doğrulanamadı.');}};
  const configureRevocationEndpoint=async(existing?:ExternalBackupRevocationEndpointView)=>{if(!window.pardus)return;const roots=externalEvidenceIssuers.filter(issuer=>!issuer.predecessorIssuerId&&issuer.status==='trusted');if(roots.length===0){setMessage('Önce güvenilen bir kök Ed25519 sağlayıcı anahtarı ekleyin.');return;}const issuerId=(window.prompt(`HTTPS kaynağının bağlanacağı kök sağlayıcı kimliğini yazın:
${roots.map(item=>`${item.id} — ${item.label}`).join('\n')}`,existing?.issuerId??roots[0]?.id??'')??'').trim();if(!issuerId)return;const sourceUrl=(window.prompt('İmzalı iptal listesi HTTPS adresini yazın:',existing?.sourceUrl??'https://')??'').trim();if(!sourceUrl)return;const primarySpkiSha256=(window.prompt('Birincil TLS SPKI SHA-256 pinini yazın:',existing?.primarySpkiSha256??'')??'').trim();if(!primarySpkiSha256)return;const secondarySpkiSha256=(window.prompt('Planlı sertifika geçişi varsa ikinci SPKI pinini yazın; yoksa boş bırakın:',existing?.secondarySpkiSha256??'')??'').trim();let secondaryValidFrom:string|undefined,primaryValidUntil:string|undefined;if(secondarySpkiSha256){secondaryValidFrom=(window.prompt('İkinci pinin kabul edilmeye başlayacağı ISO-8601 zamanı:',existing?.secondaryValidFrom??new Date().toISOString())??'').trim();primaryValidUntil=(window.prompt('Eski pinin kabulünün biteceği ISO-8601 zamanı:',existing?.primaryValidUntil??new Date(Date.now()+7*86_400_000).toISOString())??'').trim();if(!secondaryValidFrom||!primaryValidUntil)return;}const enabled=window.confirm('Bu HTTPS kaynak profilini etkinleştirmek istiyor musunuz?');const confirmation=window.prompt(`Kaynak profilini kaydetmek için şu metni birebir yazın:
KANIT HTTPS KAYNAĞI ${issuerId}`,'');if(confirmation===null)return;try{setExternalRevocationEndpoints(await window.pardus.upsertExternalBackupRevocationEndpoint({issuerId,sourceUrl,primarySpkiSha256,...(secondarySpkiSha256?{secondarySpkiSha256,secondaryValidFrom:secondaryValidFrom!,primaryValidUntil:primaryValidUntil!}:{}),enabled,confirmation,password,...(code.trim()?{code:code.trim()}:{})}));setRevocationSyncStates(await window.pardus.listRevocationSyncStates());setMessage('Sağlayıcı HTTPS kaynağı ve TLS pin geçiş penceresi kaydedildi.');}catch(error){setMessage(error instanceof Error?error.message:'HTTPS kaynak profili kaydedilemedi.');}};
  const fetchRevocationEndpoint=async(endpoint:ExternalBackupRevocationEndpointView)=>{if(!window.pardus)return;try{await window.pardus.runRevocationSync(endpoint.id);setRevocationSyncStates(await window.pardus.listRevocationSyncStates());const pending=await window.pardus.getPendingRevocationSyncList(endpoint.id);if(!pending){setExternalRevocationEndpoints(await window.pardus.listExternalBackupRevocationEndpoints(100));setMessage('Kaynak güvenli biçimde kontrol edildi; uygulanmayı bekleyen daha yeni bir iptal listesi bulunmuyor.');return;}const proceed=window.confirm(`${endpoint.issuerLabel} kaynağından sıra ${pending.sequenceNumber} ve ${pending.entryCount} iptal kaydı ana süreçte güvenli olarak bekletiliyor. Eşleşen pin: ${pending.matchedPin==='primary'?'birincil':'geçiş'}. Güçlü doğrulamayla uygulansın mı?`);if(!proceed){setMessage('İptal listesi ana süreçte bekletiliyor; renderer içine imzalı liste içeriği aktarılmadı.');return;}const confirmation=window.prompt(`İptal listesini uygulamak için şu metni birebir yazın:
KANIT İPTAL LİSTESİ ${pending.signerIssuerId} ${pending.sequenceNumber}`,'');if(confirmation===null)return;const result=await window.pardus.applyPendingRevocationSyncList({endpointId:endpoint.id,pendingListId:pending.listId,confirmation,password,...(code.trim()?{code:code.trim()}:{})});setExternalEvidenceRevocationLists(result.lists);setExternalEvidenceIssuers(result.issuers);setExternalRevocationEndpoints(await window.pardus.listExternalBackupRevocationEndpoints(100));setRevocationSyncStates(await window.pardus.listRevocationSyncStates());setMessage(`Ana süreçte bekletilen iptal listesi güçlü doğrulama ve Ed25519 imza denetimiyle uygulandı. ${pending.responseBytes} bayt.`);}catch(error){setExternalRevocationEndpoints(await window.pardus.listExternalBackupRevocationEndpoints(100).catch(()=>externalRevocationEndpoints));setRevocationSyncStates(await window.pardus.listRevocationSyncStates().catch(()=>revocationSyncStates));setMessage(error instanceof Error?error.message:'HTTPS kaynağından iptal listesi alınamadı.');}};
  const applySignedRevocationList=async()=>{if(!window.pardus)return;const active=externalEvidenceIssuers.filter(issuer=>issuer.trustState==='active');if(active.length===0){setMessage('İptal listesini doğrulamak için etkin bir sağlayıcı anahtarı bulunmuyor.');return;}const signerIssuerId=(window.prompt(`Listeyi imzalayan etkin sağlayıcı kimliğini yazın:
${active.map(issuer=>`${issuer.id} — ${issuer.label}`).join('\n')}`,active[0]?.id??'')??'').trim();if(!signerIssuerId)return;const latest=externalEvidenceRevocationLists.find(item=>item.signerIssuerId===signerIssuerId);const sequenceNumber=Number(window.prompt('Monoton artan liste sıra numarasını yazın:',String((latest?.sequenceNumber??0)+1))??'');if(!Number.isInteger(sequenceNumber)||sequenceNumber<1)return;const listId=(window.prompt('Benzersiz iptal listesi kimliğini yazın:','')??'').trim();if(!listId)return;const thisUpdate=(window.prompt('Liste oluşturma zamanını ISO-8601 biçiminde yazın:',new Date().toISOString())??'').trim();if(!thisUpdate)return;const nextDefault=new Date(Date.now()+7*24*60*60*1000).toISOString();const nextUpdate=(window.prompt('Liste son geçerlilik zamanını ISO-8601 biçiminde yazın:',nextDefault)??'').trim();if(!nextUpdate)return;const entriesText=window.prompt('İptal kayıtlarını JSON dizi olarak yazın. Her kayıt fingerprintSha256, revokedAt ve reason alanlarını içermelidir:','[]');if(entriesText===null)return;let entries:Array<{fingerprintSha256:string;revokedAt:string;reason:string}>;try{const parsed=JSON.parse(entriesText) as unknown;if(!Array.isArray(parsed))throw new Error();entries=parsed as Array<{fingerprintSha256:string;revokedAt:string;reason:string}>;}catch{setMessage('İptal kayıtları geçerli JSON dizi biçiminde olmalıdır.');return;}const signatureBase64=(window.prompt('Kanonik iptal listesinin Ed25519 Base64 imzasını yazın:','')??'').trim();if(!signatureBase64)return;const sourceUrl=(window.prompt('Kaynak HTTPS adresi (isteğe bağlı):','')??'').trim();const confirmation=window.prompt(`İptal listesini uygulamak için şu metni birebir yazın:
KANIT İPTAL LİSTESİ ${signerIssuerId} ${sequenceNumber}`,'');if(confirmation===null)return;try{const result=await window.pardus.applyExternalBackupEvidenceRevocationList({signerIssuerId,listId,sequenceNumber,thisUpdate,nextUpdate,entries,signatureBase64,...(sourceUrl?{sourceUrl}:{}),confirmation,password,...(code.trim()?{code:code.trim()}:{})});setExternalEvidenceRevocationLists(result.lists);setExternalEvidenceIssuers(result.issuers);const [evidence,copies]=await Promise.all([window.pardus.listExternalBackupDestructionEvidence(undefined,200),window.pardus.listExternalBackupCopies(200)]);setExternalEvidence(evidence);setExternalCopies(copies);setMessage('İmzalı sağlayıcı iptal listesi doğrulandı; eski sıra numarası ve süresi dolmuş liste korumaları uygulandı.');}catch(error){setMessage(error instanceof Error?error.message:'İmzalı iptal listesi uygulanamadı.');}};
  const pendingPropagation=records.filter(record=>record.backupPropagationPending).length;
  const lastPropagation=propagationRuns[0];
  const revocationFreshnessLabel:Record<RevocationSyncEndpointStateView['listFreshness'],string>={missing:'Doğrulanmış liste yok',fresh:'Liste güncel',expiring_soon:'24 saat içinde sona erecek',expired:'Süresi doldu'};
  const revocationPersistenceLabel:Record<RevocationSyncEndpointStateView['persistenceStatus'],string>={healthy:'korumalı durum etkin',unavailable:'korumalı durum kullanılamıyor',failed:'durum yazma hatası'};
  const panel=<section className="data-lifecycle-settings span-2"><h3>Veri saklama ve güvenli silme</h3><p>Varsayılan işlem geri alınabilir arşivlemedir. Kalıcı imha ancak saklama süresi ve geri alma penceresi tamamlandıktan sonra güçlü doğrulamayla çalışır.</p>
    {auth.role==='family_admin'&&<form className="form-grid" onSubmit={event=>void createPolicy(event)}><label className="span-2">Politika adı<input value={policyName} minLength={3} maxLength={100} onChange={event=>setPolicyName(event.target.value)}/></label><label>Saklama süresi (gün)<input type="number" min={1} max={36500} value={retentionDays} onChange={event=>setRetentionDays(Number(event.target.value))}/></label><label>Geri alma süresi (gün)<input type="number" min={1} max={365} value={graceDays} onChange={event=>setGraceDays(Number(event.target.value))}/></label><fieldset className="span-2 participant-fieldset"><legend>Kayıt türleri</legend>{lifecycleResourceTypes.map(type=><label key={type}><input type="checkbox" checked={selectedTypes.includes(type)} onChange={event=>setSelectedTypes(current=>event.target.checked?[...current,type]:current.filter(value=>value!==type))}/>{lifecycleTypeLabels[type]}</label>)}</fieldset><Button type="submit" disabled={selectedTypes.length===0}>Politika oluştur</Button></form>}
    <div className="form-grid lifecycle-reauth"><label>Güçlü doğrulama parolası<input type="password" autoComplete="current-password" value={password} onChange={event=>setPassword(event.target.value)}/></label><label>2FA kodu (etkinse)<input inputMode="numeric" autoComplete="one-time-code" value={code} onChange={event=>setCode(event.target.value)}/></label></div>
    {auth.role==='family_admin'&&<article className="panel"><div className="section-heading"><div><h4>Otomatik temiz yedek yeniden yazımı</h4><p>Yönetilen yedeklerde imha yayılımı, saklama süresi dolmuş kayıtlar için önce doğrulanmış temiz yedek oluşturur; eski kopyayı geri alınabilir karantinaya taşır. Kayıtlı hedefler dışındaki manuel veya yönetilmeyen kopyalara dokunulmaz.</p></div><Button onClick={()=>void propagateBackups()} disabled={propagationRunning||(cleanRewriteStatus?.dueRecords??0)===0}>{propagationRunning?'Yeniden yazılıyor…':'Şimdi çalıştır'}</Button></div>{cleanRewriteStatus&&<div className="stats-grid"><div className="context-stat"><strong>{cleanRewriteStatus.dueRecords}</strong><span>süresi dolan kayıt</span></div><div className="context-stat"><strong>{cleanRewriteStatus.enabledTargets}</strong><span>etkin hedef</span></div><div className="context-stat"><strong>{cleanRewriteStatus.policy.state}</strong><span>kalıcı durum</span></div><div className="context-stat"><strong>{cleanRewriteStatus.policy.nextAttemptAt?formatDate(cleanRewriteStatus.policy.nextAttemptAt,{dateStyle:'short',timeStyle:'short'}):'Hazır'}</strong><span>sonraki deneme</span></div></div>}<form className="form-grid" onSubmit={event=>void saveCleanRewritePolicy(event)}><label><input type="checkbox" checked={cleanRewriteEnabled} onChange={event=>setCleanRewriteEnabled(event.target.checked)}/> Otomatik politika etkin</label><label>Saklama süresi (gün)<input type="number" min={1} max={3650} value={cleanRewriteRetentionDays} onChange={event=>setCleanRewriteRetentionDays(Number(event.target.value))}/></label><Button type="submit">Politikayı kaydet</Button></form><small>Otomatik politika yalnız zamanlanmış çevrimi kontrol eder; “Şimdi çalıştır” manuel komutu politika kapalıyken de kullanılabilir. Manuel hata sonrası 1 saat, otomatik hata sonrası 6 saat geri çekilme uygulanır; yüksek sistem yükünde işlem güvenli biçimde ertelenir.</small>{cleanRewriteStatus?.policy.lastError&&<small className="warning-text">Son tanı: {cleanRewriteStatus.policy.lastError}</small>}{lastPropagation&&<small>Son yayılım: {lastPropagation.status} · {lastPropagation.refreshedTargets}/{lastPropagation.targetCount} hedef · {lastPropagation.quarantinedArtifacts} karantina · {formatDate(lastPropagation.completedAt,{dateStyle:'short',timeStyle:'short'})}</small>}<div className="section-heading"><div><h4>Kalıcı çalışma geçmişi</h4><p>Her sahiplenilmiş deneme, SQLite üzerinde başlangıç ve atomik final durumuyla saklanır.</p></div></div>{cleanRewriteRuns.length?cleanRewriteRuns.slice(0,8).map(run=><div className="list-row" key={run.id}><div><strong>{run.status} · {run.trigger==='manual'?'manuel':'otomatik'}</strong><small>{run.dueRecords} kayıt · {run.enabledTargets} hedef · kesim {formatDate(run.retentionCutoff,{dateStyle:'short',timeStyle:'short'})}</small>{run.error&&<small className="warning-text">{run.error}</small>}</div><span>{formatDate(run.completedAt??run.startedAt,{dateStyle:'short',timeStyle:'short'})}</span></div>):<EmptyState title="Temiz yedek çalışma geçmişi yok" body="İlk sahiplenilmiş deneme başladığında kalıcı çalışma kaydı burada gösterilir."/>}</article>}
    {auth.role==='family_admin'&&<article className="panel external-backup-inventory">
      <div className="section-heading"><div><h4>Uygulama dışı yedek envanteri</h4><p>Manuel dosyalar, çevrimdışı diskler ve bulut sürüm geçmişleri otomatik olarak silinmiş sayılmaz.</p></div>{externalSummary&&<span>{externalSummary.reviewRequired?'İnceleme gerekli':'Envanter güncel'}</span>}</div>
      {externalSummary&&<div className="stats-grid"><div className="context-stat"><strong>{externalSummary.total}</strong><span>kayıtlı kopya</span></div><div className="context-stat"><strong>{externalSummary.historicalDataRisk}</strong><span>tarihsel veri riski</span></div><div className="context-stat"><strong>{externalSummary.overdue}</strong><span>gecikmiş teyit</span></div><div className="context-stat"><strong>{externalSummary.unreachable}</strong><span>erişilemiyor</span></div></div>}
      <form className="form-grid" onSubmit={event=>void registerExternalCopy(event)}><label>Kopya adı<input value={externalLabel} minLength={3} maxLength={120} required onChange={event=>setExternalLabel(event.target.value)} placeholder="Ev harici diski"/></label><label>Tür<select value={externalKind} onChange={event=>setExternalKind(event.target.value as ExternalBackupCopyKind)}><option value="offline_disk">Çevrimdışı disk</option><option value="manual_file">Manuel dosya</option><option value="cloud_history">Bulut sürüm geçmişi</option><option value="other">Diğer</option></select></label><label className="span-2">Konum açıklaması<input value={externalLocation} minLength={2} maxLength={500} required onChange={event=>setExternalLocation(event.target.value)} placeholder="D: harici disk / kilitli dolap"/></label><label>Sorumlu kişi veya birim<input value={externalCustodian} minLength={2} maxLength={120} required onChange={event=>setExternalCustodian(event.target.value)}/></label><label>Teyit aralığı (gün)<input type="number" min={1} max={3650} value={externalReviewDays} onChange={event=>setExternalReviewDays(Number(event.target.value))}/></label><label className="span-2"><input type="checkbox" checked={externalHistoricalRisk} onChange={event=>setExternalHistoricalRisk(event.target.checked)}/> Kalıcı imha öncesi tarihsel veri içerme riski var</label><Button type="submit">Kopyayı envantere ekle</Button></form>
      <div className="content-grid two external-evidence-trust">
        <form className="form-grid" onSubmit={event=>void registerExternalEvidenceIssuer(event)}><div className="section-heading span-2"><div><h4>Güvenilen kanıt sağlayıcısı</h4><p>Kök Ed25519 anahtarı ancak iki bağımsız kurum dışı kanıt, eşleşen SHA-256 parmak izi ve tanık kaydıyla eklenir.</p></div></div><label>Sağlayıcı etiketi<input value={externalIssuerLabel} minLength={3} maxLength={160} required onChange={event=>setExternalIssuerLabel(event.target.value)} placeholder="Bulut veya imha hizmeti"/></label><label>Resmî tüzel kişi adı<input value={externalIssuerLegalName} minLength={3} maxLength={200} required onChange={event=>setExternalIssuerLegalName(event.target.value)}/></label><label className="span-2">Ed25519 PUBLIC KEY PEM<textarea value={externalIssuerPublicKey} required rows={6} maxLength={20000} onChange={event=>setExternalIssuerPublicKey(event.target.value)} placeholder="-----BEGIN PUBLIC KEY-----"/></label><label className="span-2">Bağımsız kanaldan alınan SHA-256 parmak izi<input value={externalIssuerExpectedFingerprint} required pattern="[a-fA-F0-9]{64}" maxLength={64} onChange={event=>setExternalIssuerExpectedFingerprint(event.target.value)} placeholder="64 onaltılık karakter"/></label><label className="span-2">Kurum kimliği kanıt referansı<textarea value={externalIssuerIdentityEvidence} required minLength={12} maxLength={500} rows={2} onChange={event=>setExternalIssuerIdentityEvidence(event.target.value)} placeholder="Ticaret sicili, imzalı sözleşme veya resmî rehber kaydı"/></label><label className="span-2">Anahtar parmak izi kanıt referansı<textarea value={externalIssuerFingerprintEvidence} required minLength={12} maxLength={500} rows={2} onChange={event=>setExternalIssuerFingerprintEvidence(event.target.value)} placeholder="Ayrı telefon görüşmesi, imzalı yazı veya bağımsız güven kanalı"/></label><label>Bağımsız tanık adı<input value={externalIssuerWitnessName} minLength={3} maxLength={160} required onChange={event=>setExternalIssuerWitnessName(event.target.value)}/></label><label>Tanık kurumu/rolü<input value={externalIssuerWitnessOrganization} minLength={3} maxLength={200} required onChange={event=>setExternalIssuerWitnessOrganization(event.target.value)}/></label><Button type="submit">Doğrulanmış kök güveni ekle</Button></form>
        <div><h4>Sağlayıcı güven zinciri</h4>{externalEvidenceIssuers.length===0?<EmptyState title="Güvenilen sağlayıcı yok" body="İmzalı makbuz doğrulamak için sağlayıcının Ed25519 açık anahtarını ekleyin."/>:externalEvidenceIssuers.map(issuer=><div className="list-row" key={issuer.id}><div><strong>{issuer.label}</strong><small>{issuer.trustState==='active'?'Etkin':issuer.trustState==='pending'?'Başlangıç zamanı bekleniyor':issuer.trustState==='expired'?'Ardıl anahtara devredildi':'İptal edildi'} · {issuer.id}</small><small>Geçerlilik: {formatDate(issuer.validFrom,{dateStyle:'short',timeStyle:'short'})}{issuer.validUntil?` – ${formatDate(issuer.validUntil,{dateStyle:'short',timeStyle:'short'})}`:' – açık uçlu'} · Zincir ${issuer.rotationSequence}</small><small>Parmak izi: {issuer.fingerprintSha256.slice(0,20)}…</small><small className={issuer.verificationMethod==='legacy_unverified'?'warning-text':undefined}>Kök doğrulama: {issuer.verificationMethod==='out_of_band_dual_evidence'?'İki bağımsız kurum dışı kanıt':issuer.verificationMethod==='rotation_inherited'?'İmzalı anahtar döndürmeden miras':'Eski kayıt; kurum dışı doğrulama makbuzu yok'}{issuer.verificationWitnessName?` · Tanık ${issuer.verificationWitnessName}`:''}</small>{issuer.verificationReceiptSha256&&<small>Doğrulama makbuzu SHA-256: {issuer.verificationReceiptSha256.slice(0,20)}…</small>}{issuer.predecessorIssuerId&&<small>Önceki anahtar: {issuer.predecessorIssuerId}</small>}{issuer.revocationReason&&<small>İptal gerekçesi: {issuer.revocationReason}</small>}</div><div className="button-row">{issuer.status==='trusted'&&!issuer.validUntil&&<Button onClick={()=>void rotateExternalEvidenceIssuer(issuer)}>Anahtarı döndür</Button>}{issuer.status==='trusted'&&<Button tone="danger" onClick={()=>void revokeExternalEvidenceIssuer(issuer)}>Güveni iptal et</Button>}</div></div>)}</div>
      </div>
      <div><h4>Anahtar döndürme geçmişi</h4>{externalEvidenceRotations.length===0?<EmptyState title="Döndürme kaydı yok" body="Ardıl anahtarlar önceki güvenilen Ed25519 anahtarının imzasıyla yetkilendirildiğinde burada görünür."/>:externalEvidenceRotations.slice(0,20).map(rotation=><div className="list-row" key={rotation.id}><div><strong>{rotation.predecessorLabel} → {rotation.successorLabel}</strong><small>{rotation.receiptId} · {formatDate(rotation.effectiveAt,{dateStyle:'short',timeStyle:'short'})}</small><small>Ardıl parmak izi: {rotation.successorFingerprintSha256.slice(0,20)}…</small></div><span>doğrulandı</span></div>)}</div>
      <div className="section-heading"><div><h4>Sağlayıcı HTTPS kaynakları</h4><p>Adres ve TLS pinleri güçlü doğrulamayla sağlayıcı köküne bağlanır; geçiş pini yalnız sınırlı zaman penceresinde kabul edilir.</p></div><Button onClick={()=>void configureRevocationEndpoint()}>Kaynak profili ekle</Button></div>
      <div>{externalRevocationEndpoints.length===0?<EmptyState title="HTTPS kaynak profili yok" body="İmzalı iptal listesini ağdan almak için kök sağlayıcıya bağlı adres ve SPKI pini kaydedin."/>:externalRevocationEndpoints.map(endpoint=>{const sync=revocationSyncStates.find(item=>item.endpointId===endpoint.id);return <div className="list-row" key={endpoint.id}><div><strong>{endpoint.issuerLabel}</strong><small>{endpoint.status==='active'?'Etkin':'Devre dışı'} · {endpoint.sourceUrl}</small><small>Birincil pin: {endpoint.primarySpkiSha256.slice(0,20)}…{endpoint.secondarySpkiSha256?` · Geçiş pini: ${endpoint.secondarySpkiSha256.slice(0,20)}…`:''}</small>{endpoint.secondaryValidFrom&&endpoint.primaryValidUntil&&<small>Çift-pin penceresi: {formatDate(endpoint.secondaryValidFrom,{dateStyle:'short',timeStyle:'short'})} – {formatDate(endpoint.primaryValidUntil,{dateStyle:'short',timeStyle:'short'})}</small>}<small>Son alım: {endpoint.lastFetchStatus==='never'?'Henüz çalıştırılmadı':endpoint.lastFetchStatus==='success'?'Başarılı':'Başarısız'}{endpoint.lastFetchedAt?` · ${formatDate(endpoint.lastFetchedAt,{dateStyle:'short',timeStyle:'short'})}`:''}</small>{sync&&<small className={sync.listFreshness==='expired'||sync.persistenceStatus!=='healthy'?'warning-text':undefined}>Güven durumu: {revocationFreshnessLabel[sync.listFreshness]}{sync.currentSequenceNumber?` · sıra ${sync.currentSequenceNumber}`:''}{sync.currentNextUpdate?` · son ${formatDate(sync.currentNextUpdate,{dateStyle:'short',timeStyle:'short'})}`:''} · {revocationPersistenceLabel[sync.persistenceStatus]}</small>}{sync?.pendingSequenceNumber&&<small className="warning-text">Sıra {sync.pendingSequenceNumber} güçlü onay bekliyor; yeniden başlatmada korumalı olarak saklanır.</small>}{endpoint.lastFetchError&&<small>Hata: {endpoint.lastFetchError}</small>}</div><div className="button-row"><Button onClick={()=>void configureRevocationEndpoint(endpoint)}>Düzenle</Button><Button disabled={endpoint.status!=='active'} onClick={()=>void fetchRevocationEndpoint(endpoint)}>Güvenli al ve uygula</Button></div></div>;})}</div>
      <div className="section-heading"><div><h4>İmzalı iptal listeleri</h4><p>Sıra numarası geri alınamaz; süresi dolmuş liste güven durumunu yükseltemez.</p></div><Button onClick={()=>void applySignedRevocationList()} disabled={externalEvidenceIssuers.every(issuer=>issuer.trustState!=='active')}>İptal listesi uygula</Button></div>
      <div>{externalEvidenceRevocationLists.length===0?<EmptyState title="İptal listesi yok" body="Sağlayıcı tarafından Ed25519 ile imzalanmış anahtar durum listeleri burada görünür."/>:externalEvidenceRevocationLists.slice(0,20).map(list=><div className="list-row" key={list.id}><div><strong>{list.signerLabel} · sıra {list.sequenceNumber}</strong><small>{list.listId} · {list.status==='current'?'Güncel':list.status==='expired'?'Süresi doldu':'Yerine yeni liste geldi'}</small><small>Geçerlilik: {formatDate(list.thisUpdate,{dateStyle:'short',timeStyle:'short'})} – {formatDate(list.nextUpdate,{dateStyle:'short',timeStyle:'short'})} · {list.entries.length} iptal</small><small>Payload SHA-256: {list.payloadSha256.slice(0,20)}…{list.sourceUrl?` · ${list.sourceUrl}`:''}</small></div><span>{list.status}</span></div>)}</div>
      <div className="lifecycle-list">{externalCopies.length===0?<EmptyState title="Uygulama dışı kopya kaydı yok" body="Manuel yedek, çevrimdışı disk ve bulut geçmişlerini burada kayıt altına alın."/>:externalCopies.map(copy=><div className="list-row" key={copy.id}><div><strong>{copy.label}</strong><small>{copy.kind} · {copy.status} · Sorumlu: {copy.custodian}</small><small>{copy.locationHint}</small><small>Sonraki teyit: {formatDate(copy.nextReviewAt,{dateStyle:'short'})}{copy.containsHistoricalDataRisk?' · Tarihsel veri riski açık':' · Risk temiz olarak teyit edildi'}</small>{copy.legalHold&&<small>Bekletme etkin: {copy.holdReason??'Gerekçe kayıtlı'}</small>}{copy.attestationNote&&<small>Son kullanıcı teyidi: {copy.attestationNote}</small>}{copy.evidenceSha256&&<small>Kanıt SHA-256: {copy.evidenceSha256.slice(0,16)}…</small>}<small>{copy.evidenceVerificationStatus==='verified'?`İmzalı kanıt doğrulandı · ${copy.verifiedEvidenceIssuerLabel??'güvenilen sağlayıcı'}`:copy.evidenceVerificationStatus==='revoked'?'İmzalı kanıtın sağlayıcı güveni iptal edildi':'Doğrulanmış sağlayıcı imzası yok'}</small></div><div className="button-row">{copy.status!=='destroyed'&&<Button onClick={()=>void reviewExternalCopy(copy)}>Teyit et</Button>}{copy.status!=='destroyed'&&<Button onClick={()=>void toggleExternalHold(copy)}>{copy.legalHold?'Bekletmeyi kaldır':'Bekletmeye al'}</Button>}{copy.status!=='destroyed'&&<Button tone="danger" disabled={copy.legalHold} onClick={()=>void attestExternalDestroyed(copy)}>Kullanıcı imha teyidi</Button>}<Button disabled={copy.legalHold||externalEvidenceIssuers.every(issuer=>issuer.trustState!=='active')} onClick={()=>void verifySignedExternalEvidence(copy)}>İmzalı kanıt doğrula</Button></div></div>)}</div>
      <div><h4>Doğrulanmış imha makbuzları</h4>{externalEvidence.length===0?<EmptyState title="İmzalı makbuz yok" body="Güvenilen sağlayıcının sabit kanonik biçimde imzaladığı makbuzlar burada görünür."/>:externalEvidence.slice(0,20).map(item=><div className="list-row" key={item.id}><div><strong>{item.issuerLabel} · {item.receiptId}</strong><small>{item.verificationStatus==='verified'?'İmza doğrulandı':'Sağlayıcı güveni iptal edildi'} · Kopya {item.copyId}</small><small>Kanıt SHA-256: {item.evidenceSha256.slice(0,20)}… · {formatDate(item.issuedAt,{dateStyle:'short',timeStyle:'short'})}</small></div><span>{item.verificationStatus}</span></div>)}</div>
      <small>Kullanıcı beyanı ile sağlayıcı imzalı makbuz ayrı güven seviyeleridir. Geçerli imza yalnız güvenilen açık anahtar, kopya kimliği, makbuz kimliği, zaman ve SHA-256 değerinin değiştirilmediğini kanıtlar; fiziksel medyanın mutlak yok oluşunu tek başına garanti etmez.</small>
    </article>}
    {auth.role==='family_admin'&&quarantinePolicy&&<form className="form-grid quarantine-policy" onSubmit={event=>void saveQuarantinePolicy(event)}><label>Yedek karantina saklama süresi (gün)<input type="number" min={1} max={3650} value={quarantineRetentionDays} onChange={event=>setQuarantineRetentionDays(Number(event.target.value))}/></label><div><small>Operasyonel varsayılan süre hukuki saklama süresi değildir. Süre değişikliği yalnız yeni karantinalara uygulanır.</small><Button type="submit">Karantina politikasını güncelle</Button></div></form>}
    {auth.role==='family_admin'&&<div className="lifecycle-list quarantine-list">{quarantineBatches.length===0?<EmptyState title="Yedek karantinası bulunmuyor" body="Yönetilen eski yedekler karantinaya taşındığında burada görünür."/>:quarantineBatches.map(batch=><div className="list-row" key={batch.id}><div><strong>{batch.targetName} · {batch.quarantinedArtifacts} yedek</strong><small>{batch.status==='retained'?'Saklanıyor':batch.status==='destroying'?'İmha işlemi devam ettirilmeli':'Nihai imha edildi'} · {batch.id}</small><small>Karantina: {formatDate(batch.quarantinedAt,{dateStyle:'short',timeStyle:'short'})} · Saklama sonu: {formatDate(batch.retainUntil,{dateStyle:'short',timeStyle:'short'})}</small>{batch.legalHold&&<small>Bekletme etkin: {batch.holdReason??'Gerekçe kayıtlı'}</small>}{batch.destroyedAt&&<small>İmha zamanı: {formatDate(batch.destroyedAt,{dateStyle:'short',timeStyle:'short'})}</small>}</div><div className="button-row">{batch.status==='retained'&&<Button onClick={()=>void toggleQuarantineHold(batch)}>{batch.legalHold?'Bekletmeyi kaldır':'Bekletmeye al'}</Button>}{batch.status!=='destroyed'&&<Button tone="danger" onClick={()=>void destroyQuarantine(batch)} disabled={batch.legalHold||Date.parse(batch.retainUntil)>Date.now()}>Nihai imha</Button>}</div></div>)}</div>}
    <div className="lifecycle-list">{records.length===0?<EmptyState title="Yönetilebilir kayıt bulunamadı" body="Finans, sağlık veya yaşam kaydı oluşturulduğunda yaşam döngüsü burada görünür."/>:records.map(record=><div className="list-row" key={`${record.resourceType}:${record.resourceId}`}><div><strong>{record.title}</strong><small>{lifecycleTypeLabels[record.resourceType]} · {lifecycleStateLabels[record.state]}{record.policyName?` · ${record.policyName}`:''}</small>{record.purgeEligibleAt&&<small>İmha uygunluk tarihi: {formatDate(record.purgeEligibleAt,{dateStyle:'medium'})}</small>}{record.purgeExecuteAfter&&<small>Geri alma penceresi sonu: {formatDate(record.purgeExecuteAfter,{dateStyle:'medium',timeStyle:'short'})}</small>}{record.legalHold&&<small>Bekletme etkin: {record.holdReason??'Gerekçe kayıtlı'}</small>}{record.backupPropagationPending&&<small>Uyarı: Önceki yedeklerde kopya bulunabilir.</small>}</div><div className="button-row">{record.state==='active'&&<Button onClick={()=>void archive(record)}>Arşivle</Button>}{record.state==='archived'&&<><Button onClick={()=>void restore(record)}>Geri al</Button><Button tone="danger" onClick={()=>void requestPurge(record)}>İmha talebi</Button></>}{record.state==='purge_scheduled'&&<><Button onClick={()=>void cancelPurge(record)}>Talebi iptal et</Button><Button tone="danger" onClick={()=>void executePurge(record)}>Kalıcı imha</Button></>}{record.state!=='purged'&&<Button onClick={()=>void toggleHold(record)}>{record.legalHold?'Bekletmeyi kaldır':'Bekletmeye al'}</Button>}</div></div>)}</div>
    <small>SQLite güvenli silme ve WAL temizliği en iyi çaba yaklaşımıdır. SSD, dosya sistemi, bulut eşitlemesi ve yedekler fiziksel kopyaları bir süre tutabilir.</small>{message&&<StatusMessage>{message}</StatusMessage>}
  </section>;
  return localizeDataLifecycleNode(panel,language);
}

const windowsHelloAvailabilityLabel: Record<WindowsHelloStateView['availability'],readonly [string,string]> = {
  available:['Kullanılabilir','Available'],
  device_not_present:['Donanım bulunamadı','Hardware not found'],
  not_configured_for_user:['Windows Hello yapılandırılmamış','Windows Hello is not configured'],
  disabled_by_policy:['Sistem politikasıyla kapalı','Disabled by system policy'],
  device_busy:['Başka işlem kullanıyor','In use by another operation'],
  platform_not_supported:['Platform desteklemiyor','Platform not supported'],
  error:['Uygunluk belirlenemedi','Availability could not be determined']
};

export function WindowsHelloScreen({auth}:{auth:AuthStateView}) {
  const {language}=useLocalization();
  const [state,setState]=useState<WindowsHelloStateView|null>(null);
  const [enrollmentPassword,setEnrollmentPassword]=useState('');
  const [enrollmentCode,setEnrollmentCode]=useState('');
  const [displayName,setDisplayName]=useState(language==='tr'?'Bu bilgisayar':'This computer');
  const [fallbackPassword,setFallbackPassword]=useState('');
  const [fallbackCode,setFallbackCode]=useState('');
  const [busy,setBusy]=useState<'state'|'enroll'|'reauth'|'fallback'|''>('state');
  const [message,setMessage]=useState('');
  const [messageTone,setMessageTone]=useState<'info'|'success'|'danger'>('info');
  const refresh=async()=>{
    if(!window.pardus)return;
    setBusy('state');
    try{setState(await window.pardus.getWindowsHelloState());}
    catch(error){setMessageTone('danger');setMessage(error instanceof Error?error.message:translateWindowsHelloCopy('Windows Hello durumu okunamadı.',language));}
    finally{setBusy('');}
  };
  useEffect(()=>{void refresh();},[]);
  const enroll=async()=>{
    if(!window.pardus||!enrollmentPassword)return;
    setBusy('enroll');setMessage('');
    try{
      const result=await window.pardus.enrollWindowsHello({password:enrollmentPassword,...(enrollmentCode.trim()?{secondFactorCode:enrollmentCode.trim()}:{}),...(displayName.trim()?{displayName:displayName.trim()}:{} )});
      setMessageTone(result.enrolled?'success':result.outcome==='cancelled'?'info':'danger');
      setMessage(windowsHelloOutcomeMessage(result.outcome));
      if(result.enrolled){setEnrollmentPassword('');setEnrollmentCode('');await refresh();}
    }catch(error){setMessageTone('danger');setMessage(error instanceof Error?error.message:translateWindowsHelloCopy('Windows Hello kaydı tamamlanamadı.',language));}
    finally{setBusy('');}
  };
  const reauthenticate=async(useFallback:boolean)=>{
    if(!window.pardus||useFallback&&!fallbackPassword)return;
    setBusy(useFallback?'fallback':'reauth');setMessage('');
    try{
      const result=await window.pardus.reauthenticateWithWindowsHello(useFallback?{fallback:{password:fallbackPassword,...(fallbackCode.trim()?{secondFactorCode:fallbackCode.trim()}:{} )}}:{});
      const success=result.authenticated;
      setMessageTone(success?'success':result.outcome==='cancelled'?'info':'danger');
      setMessage(result.method==='password_fallback'&&success?translateWindowsHelloCopy('Güçlü yerel parola ile yedek doğrulama tamamlandı.',language):windowsHelloOutcomeMessage(result.outcome));
      if(success&&result.method==='password_fallback'){setFallbackPassword('');setFallbackCode('');}
      await refresh();
    }catch(error){setMessageTone('danger');setMessage(error instanceof Error?error.message:translateWindowsHelloCopy('Yeniden doğrulama tamamlanamadı.',language));}
    finally{setBusy('');}
  };
  const panel=<>
    <PageHeader eyebrow="Cihaz bağlı kimlik" title="Windows Hello" description="Windows Hello doğrulamasını bu cihazdaki şifreli veri kasasına bağlayın; güçlü yerel parola her zaman yedek erişim yöntemi olarak kalır."/>
    <section className="workspace-grid windows-hello-workspace">
      <Surface className="workspace-summary"><SectionHeader eyebrow="Uygunluk ve kayıt" title={state?windowsHelloAvailabilityLabel[state.availability][language==='tr'?0:1]:'Kontrol ediliyor…'}/>{state&&<div className="windows-hello-status-list"><StatRow value={state.enrolled?'Etkin':'Kayıtlı değil'} label="Kasa bağı"/><StatRow value={state.passwordFallbackAvailable?'Hazır':'Kullanılamıyor'} label="Parola yedeği"/><StatRow value={state.deviceChanged?'Değişti':'Eşleşiyor'} label="Cihaz bağı"/><StatRow value={state.principalChanged?'Değişti':'Eşleşiyor'} label="Windows kullanıcısı"/><StatRow value={state.securityEpochChanged?'Değişti':'Eşleşiyor'} label="Güvenlik dönemi"/>{state.registration&&<small>Kayıt: {state.registration.displayName} · {formatDate(state.registration.enrolledAt,{dateStyle:'medium',timeStyle:'short'})}</small>}{state.diagnosticCode&&<small>Tanılama: {state.diagnosticCode}</small>}</div>}<Button onClick={()=>void refresh()} disabled={busy!==''}>{busy==='state'?'Kontrol ediliyor…':'Durumu yenile'}</Button></Surface>
      <Surface className="workspace-form"><SectionHeader eyebrow="Kayıt" title={state?.enrolled?'Windows Hello kaydını yenile':'Windows Hello’yu etkinleştir'}/><p>Kayıt için mevcut yerel parola ve hesabınızda etkinse 2FA kodu doğrulanır. Ardından Windows Hello penceresi yalnız bu düğmeye bastığınızda açılır.</p><label>Cihaz adı<input value={displayName} maxLength={120} onChange={event=>setDisplayName(event.target.value)}/></label><label>Mevcut yerel parola<input type="password" autoComplete="current-password" maxLength={1024} value={enrollmentPassword} onChange={event=>setEnrollmentPassword(event.target.value)}/></label><label>2FA / kurtarma kodu <small>{auth.twoFactorEnabled?'gerekli':'etkin değil'}</small><input autoComplete="one-time-code" maxLength={256} value={enrollmentCode} onChange={event=>setEnrollmentCode(event.target.value)}/></label><Button tone="primary" disabled={busy!==''||!enrollmentPassword||(auth.twoFactorEnabled&&!enrollmentCode.trim())||state?.availability!=='available'} onClick={()=>void enroll()}>{busy==='enroll'?'Windows Hello bekleniyor…':state?.enrolled?'Kaydı güvenli biçimde yenile':'Windows Hello’yu kaydet'}</Button></Surface>
      <Surface className="span-2 windows-hello-reauth"><SectionHeader eyebrow="Kritik işlem doğrulaması" title="Yeniden doğrula"/><p>Windows Hello iptal edilirse parola otomatik gönderilmez. Yedek doğrulama yalnız aşağıdaki ayrı düğmeyle ve açıkça yazdığınız bilgilerle çalışır.</p><div className="button-row"><Button tone="primary" disabled={busy!==''||!state?.enrolled||state.availability!=='available'} onClick={()=>void reauthenticate(false)}>{busy==='reauth'?'Windows Hello bekleniyor…':'Windows Hello ile yeniden doğrula'}</Button></div><div className="windows-hello-fallback"><label>Yerel parola<input type="password" autoComplete="current-password" maxLength={1024} value={fallbackPassword} onChange={event=>setFallbackPassword(event.target.value)}/></label><label>2FA / kurtarma kodu<input autoComplete="one-time-code" maxLength={256} value={fallbackCode} onChange={event=>setFallbackCode(event.target.value)}/></label><Button disabled={busy!==''||!fallbackPassword||(auth.twoFactorEnabled&&!fallbackCode.trim())} onClick={()=>void reauthenticate(true)}>{busy==='fallback'?'Doğrulanıyor…':'Hello olmazsa parola ile devam et'}</Button></div></Surface>
    </section>
    {message&&<StatusMessage tone={messageTone}>{message}</StatusMessage>}
  </>;
  return localizeWindowsHelloNode(panel,language);
}

export function PrivacyOwnershipCenter() {
  const {language}=useLocalization();
  const [center,setCenter]=useState<PrivacyOwnershipControlCenterView|null>(null);
  const [phase,setPhase]=useState<'loading'|'ready'|'error'>('loading');
  const [message,setMessage]=useState('');
  const [busy,setBusy]=useState('');
  const [memoryTitle,setMemoryTitle]=useState('');
  const [memoryStatement,setMemoryStatement]=useState('');
  const [retentionUntil,setRetentionUntil]=useState('');
  const [exportRequestId,setExportRequestId]=useState('');
  const [exportPassphrase,setExportPassphrase]=useState('');
  const [simulationAccountId,setSimulationAccountId]=useState('');
  const [simulationResult,setSimulationResult]=useState('');
  const [inventoryExpanded,setInventoryExpanded]=useState(false);
  const pendingOperations=useRef(new Map<string,{clientOperationId:string;expectedRevision:number}>());
  const load=async()=>{if(!window.pardus)return;setPhase('loading');try{const next=await window.pardus.getPrivacyOwnershipCenter();setCenter(next);setExportRequestId(current=>{const active=next.rightsRequests.filter(item=>['encrypted_export','legacy_export'].includes(item.kind)&&['requested','in_review'].includes(item.status));return active.some(item=>item.id===current)?current:active[0]?.id??'';});setPhase('ready');}catch(error){setMessage(error instanceof Error?error.message:'Gizlilik merkezi yüklenemedi.');setPhase('error');}};
  useEffect(()=>{void load();},[]);
  const mutate=async(key:string,revision:number,run:(operation:{clientOperationId:string;expectedRevision:number})=>Promise<unknown>,success:string)=>{
    if(busy)return;
    const operation=pendingOperations.current.get(key)??{clientOperationId:`privacy-${crypto.randomUUID()}`,expectedRevision:revision};
    pendingOperations.current.set(key,operation);setBusy(key);setMessage('');
    try{await run(operation);pendingOperations.current.delete(key);setMessage(success);await load();}
    catch(error){setMessage(error instanceof Error?`${error.message} Aynı işlem kimliği ve özgün revizyonla yeniden deneyebilirsiniz.`:'İşlem tamamlanamadı; yeniden deneme kimliği korundu.');}
    finally{setBusy('');}
  };
  const firstMemory=center?.aiMemoryRecords[0];
  const correctMemory=()=>firstMemory&&window.pardus&&mutate(`correct:${firstMemory.id}`,firstMemory.revision,operation=>window.pardus!.correctAiMemory({...operation,recordId:firstMemory.id,title:memoryTitle||firstMemory.title,statement:memoryStatement||firstMemory.statement}),'AI hafıza kaydı yerel olarak düzeltildi.');
  const restrictMemory=()=>firstMemory&&window.pardus&&mutate(`restrict:${firstMemory.id}`,firstMemory.revision,operation=>window.pardus!.restrictAiMemory({...operation,recordId:firstMemory.id,restriction:{visibility:'owner_only',selectedAccountIds:[],allowedPurposes:['general'],processingAllowed:false}}),'AI hafıza kaydı yalnız sahibine sınırlandı.');
  const deleteMemory=()=>firstMemory&&window.pardus&&mutate(`delete:${firstMemory.id}`,firstMemory.revision,operation=>window.pardus!.deleteAiMemory({...operation,recordId:firstMemory.id,reason:'Sahibin yerel silme talebi'}),'Yerel silme talebi kaydedildi; dış kopya silme garantisi verilmez.');
  const expireMemory=()=>firstMemory&&window.pardus&&retentionUntil&&mutate(`expire:${firstMemory.id}`,firstMemory.revision,operation=>window.pardus!.expireAiMemory({...operation,recordId:firstMemory.id,retentionUntil:asIsoDateTime(new Date(retentionUntil).toISOString())}),'Yerel saklama süresi güncellendi.');
  const createRightsRequest=()=>window.pardus&&mutate('rights:create',0,operation=>window.pardus!.createPrivacyRightsRequest({...operation,kind:'retention_change',scopeResourceType:'privacy_inventory',scopeResourceId:center?.key.ownerPersonId??'owner',reason:'Sahibin yerel saklama süresi talebi',...(retentionUntil?{requestedRetentionUntil:asIsoDateTime(new Date(retentionUntil).toISOString())}: {})}),'Veri hakkı talebi yerel incelemeye alındı.');
  const createErasureRequest=()=>window.pardus&&mutate('rights:erasure',0,operation=>window.pardus!.createPrivacyRightsRequest({...operation,kind:'erasure',scopeResourceType:'privacy_inventory',scopeResourceId:center?.key.ownerPersonId??'owner',reason:'Sahibin yerel silme ve yayılım talebi'}),'Yerel silme talebi incelemeye alındı; harici kopya fiziksel silme garantisi yoktur.');
  const createExportRequest=async(kind:'encrypted_export'|'legacy_export')=>{if(!window.pardus||!center||busy)return;const key=`rights:${kind}`;const operation=pendingOperations.current.get(key)??{clientOperationId:`privacy-${crypto.randomUUID()}`,expectedRevision:0};pendingOperations.current.set(key,operation);setBusy(key);setMessage('');try{const result=await window.pardus.createPrivacyRightsRequest({...operation,kind,scopeResourceType:kind==='legacy_export'?'digital_legacy':'privacy_inventory',scopeResourceId:center.key.ownerPersonId,reason:kind==='legacy_export'?'Sahibin dijital miras verisi için yerel şifreli kopya talebi':'Sahibin kendi verisi için yerel şifreli kopya talebi'});pendingOperations.current.delete(key);setExportRequestId(result.resourceId);await load();setMessage('Şifreli dışa aktarım talebi hazır; kimlik otomatik seçildi.');}catch(error){setMessage(error instanceof Error?`${error.message} Aynı işlem kimliğiyle yeniden deneyebilirsiniz.`:'Dışa aktarım talebi oluşturulamadı.');}finally{setBusy('');}};
  const updateRightsRequest=(request:PrivacyOwnershipControlCenterView['rightsRequests'][number],status:'in_review'|'locally_completed'|'cancelled')=>window.pardus&&mutate(`rights:update:${request.id}:${status}`,request.revision,operation=>window.pardus!.updatePrivacyRightsRequest({...operation,requestId:request.id,status,...(status==='locally_completed'?{resolutionNote:'Yerel talep iş akışı tamamlandı; harici kopya fiziksel silme veya ağ üzerinden teslim garantisi verilmez.'}:{})}),status==='in_review'?'Talep yerel incelemeye alındı.':status==='cancelled'?'Talep yalnız yerel iş akışında iptal edildi.':'Talep yalnız yerel iş akışında tamamlandı; harici kopya veya ağ teslimi garantisi verilmez.');
  const createIncident=()=>{if(!window.pardus||!center)return;const targetId=center.key.accountId;return mutate('incident:create',0,operation=>window.pardus!.createPrivacyIncident({...operation,title:'Yerel erişim incelemesi',severity:'medium',suspectedAt:asIsoDateTime(new Date().toISOString()),actions:[{action:'revoke_local_session_authority',targetId}],evidenceReferenceIds:[]}),'Olay yerel containment kaydı olarak açıldı.');};
  const updateIncident=(incident:PrivacyOwnershipControlCenterView['incidents'][number],status:'contained_locally'|'resolved'|'cancelled')=>window.pardus&&mutate(`incident:update:${incident.id}:${status}`,incident.revision,operation=>window.pardus!.updatePrivacyIncident({...operation,incidentId:incident.id,status,...(status==='resolved'?{resolutionNote:'Yerel inceleme kapatıldı; remote wipe, MDM veya ağ üzerinden teslim yapılmadı.'}:{})}),status==='contained_locally'?'Olay yalnız yerel containment durumuna alındı.':status==='cancelled'?'Olay yalnız yerel kayıtta iptal edildi.':'Yerel olay çözüm notuyla kapatıldı; remote wipe, MDM veya ağ teslimi yapılmadı.');
  const simulate=async()=>{if(!window.pardus||!simulationAccountId)return;setBusy('simulate');try{const result=await window.pardus.simulatePrivacyPermission({targets:[{subjectAccountId:asUserId(simulationAccountId),resourceType:'privacy_inventory',resourceId:center?.key.ownerPersonId??'owner',action:'read',purpose:'general',occurredAt:asIsoDateTime(new Date().toISOString())}]});setSimulationResult(result.items.map(item=>`${item.visible?'Görünür':'Görünmez'}: ${item.reason}`).join(' · '));}catch(error){setSimulationResult(error instanceof Error?error.message:'Simülasyon tamamlanamadı.');}finally{setBusy('');}};
  const exportEncrypted=async()=>{if(!window.pardus||!exportRequestId||!exportPassphrase)return;setBusy('export');setMessage('');try{const result=await window.pardus.exportEncryptedPrivacyData({requestId:exportRequestId,passphrase:exportPassphrase});await load();setMessage(`${result.fileName} doğrulandı · ${result.artifactSizeBytes} bayt · ağ teslimi yapılmadı.`);}catch(error){setMessage(error instanceof Error?error.message:'Şifreli dışa aktarım tamamlanamadı.');}finally{setExportPassphrase('');setBusy('');}};
  const inventoryRecordCount=center?.dataInventory.reduce((total,item)=>total+item.recordCount,0)??0;
  const activeExportRequests=center?.rightsRequests.filter(item=>['encrypted_export','legacy_export'].includes(item.kind)&&['requested','in_review'].includes(item.status))??[];
  if(phase==='loading')return localizePrivacyOwnershipNode(<AsyncStatePanel state="loading" title="Gizlilik ve sahiplik merkezi yükleniyor" message="Sahibine bağlı yerel envanter ve denetim görünümü hazırlanıyor."/>,language);
  if(phase==='error')return localizePrivacyOwnershipNode(<AsyncStatePanel state="error" title="Gizlilik merkezi yüklenemedi" message={message||'Yetkili yerel görünüm kurulamadı.'} onRetry={load}/>,language);
  if(!center)return localizePrivacyOwnershipNode(<AsyncStatePanel state="empty" title="Gizlilik merkezi boş" message="Bu sahip için yerel gözlem veya yönetilebilir kayıt bulunamadı."/>,language);
  const panel=<section className="privacy-ownership-center" aria-labelledby="privacy-ownership-title">
    <SectionHeader eyebrow="Yerel gözlem ve sahiplik" title="Gizlilik, Sahiplik ve Olay Kontrol Merkezi"/>
    <p id="privacy-ownership-title">Bu görünüm yalnız yerel gözlem ve yerel yetkiyi gösterir. Uzaktan silme, MDM, ağ teslimi, uzak durum veya hukuk/gizlilik sertifikasyonu iddiası yoktur.</p>
    <div className="privacy-ownership-grid">
      <section><h3>Tutulan veri</h3><p className="privacy-inventory-summary" role="status">{center.dataInventory.length} kategori · toplam {inventoryRecordCount} yerel kayıt</p>{center.dataInventory.length===0?<AsyncStatePanel state="empty" title="Kayıt yok" message="Yerel envanterde gösterilecek veri bulunmuyor."/>:<div id="privacy-data-inventory-list" className="privacy-inventory-list">{(inventoryExpanded?center.dataInventory:center.dataInventory.slice(0,8)).map(item=><div className="list-row" key={item.id}><div><strong>{item.displayName}</strong><small>{item.category} · {item.recordCount} kayıt · {item.storageScope} · türetilmiş {item.derivedDataCount}</small></div></div>)}</div>}{center.dataInventory.length>8&&<Button aria-expanded={inventoryExpanded} aria-controls="privacy-data-inventory-list" onClick={()=>setInventoryExpanded(value=>!value)}>{inventoryExpanded?'Özeti göster':`Tüm ${center.dataInventory.length} kategoriyi göster`}</Button>}</section>
      <section><h3>AI hafıza denetimi</h3>{firstMemory?<><p><strong>{firstMemory.title}</strong> · revizyon {firstMemory.revision} · {firstMemory.status}</p><label>Başlık<input value={memoryTitle} onChange={event=>setMemoryTitle(event.target.value)}/></label><label>Düzeltme<textarea value={memoryStatement} onChange={event=>setMemoryStatement(event.target.value)}/></label><label>Saklama sonu<input type="datetime-local" value={retentionUntil} onChange={event=>setRetentionUntil(event.target.value)}/></label><div className="button-row"><Button disabled={Boolean(busy)} onClick={()=>void correctMemory()}>Düzelt</Button><Button disabled={Boolean(busy)} onClick={()=>void restrictMemory()}>Yalnız sahibine sınırla</Button><Button disabled={Boolean(busy)} onClick={()=>void expireMemory()}>Süre koy</Button><Button tone="danger" disabled={Boolean(busy)} onClick={()=>void deleteMemory()}>Yerel silme iste</Button></div></>:<AsyncStatePanel state="empty" title="AI hafıza kaydı yok" message="Yalnız yerel olarak gözlenen AI hafıza kayıtları burada gösterilir."/>}</section>
      <section><h3>Erişim geçmişi</h3>{center.accessHistory.slice(0,8).map(item=><div className="list-row" key={item.id}><div><strong>{item.actorDisplayName} · {item.decision}</strong><small>{item.purpose} · {formatDate(item.occurredAt,{dateStyle:'short',timeStyle:'short'})}</small></div></div>)}</section>
      <section><h3>Cihaz ve yerel işleme gözlemi</h3><p>Güvenilir cihaz, açık oturum anlamına gelmez. Apple eşzamanlama ile AI/OCR/çeviri yalnız yerelde gözlendiyse gösterilir.</p>{center.localDeviceActivity.map(item=><small key={item.id}>{item.displayName} · {item.trustStatus} · oturum {item.locallyObservedSession} · Apple {item.appleSyncStatus}</small>)}{center.localProcessingObservations.map(item=><small key={item.id}>{item.kind} · {item.status} · ağ teslimi gözlenmedi</small>)}</section>
      <section><h3>Veri hakları, saklama ve şifreli dışa aktarım</h3><div className="button-row"><Button disabled={Boolean(busy)} onClick={()=>void createRightsRequest()}>Saklama talebi</Button><Button disabled={Boolean(busy)} onClick={()=>void createErasureRequest()}>Yerel silme talebi</Button><Button disabled={Boolean(busy)} onClick={()=>void createExportRequest('encrypted_export')}>Kendi verim için şifreli talep</Button><Button disabled={Boolean(busy)} onClick={()=>void createExportRequest('legacy_export')}>Dijital miras için şifreli talep</Button></div><small>Şifreli paket; sahip kapsamındaki yapılandırılmış kayıtları ve gizlilik merkezi verisini içerir. Arşiv ikili dosyaları, sahipliği kesin bağlanamayan aile etkinlikleri ve açıkça seçilmemiş form taslakları dahil edilmez.</small>{center.rightsRequests.slice(0,8).map(item=><div className="list-row privacy-action-row" key={item.id}><div><strong>{item.kind} · {item.status}</strong><small>{item.scopeResourceType}/{item.scopeResourceId} · dış kopya silme garantisi yok</small>{item.resolutionNote&&<small>{item.resolutionNote}</small>}</div><div className="button-row">{item.status==='requested'&&<Button disabled={Boolean(busy)} onClick={()=>void updateRightsRequest(item,'in_review')}>İncelemeye al</Button>}{item.status==='in_review'&&!['encrypted_export','legacy_export'].includes(item.kind)&&<Button disabled={Boolean(busy)} onClick={()=>void updateRightsRequest(item,'locally_completed')}>Yerel incelemeyi tamamla</Button>}{['requested','in_review'].includes(item.status)&&<Button disabled={Boolean(busy)} onClick={()=>void updateRightsRequest(item,'cancelled')}>Yerel talebi iptal et</Button>}</div></div>)}<label>Şifreli dışa aktarım talebi<select value={exportRequestId} onChange={event=>setExportRequestId(event.target.value)}><option value="">Aktif şifreli talep yok</option>{activeExportRequests.map(item=><option key={item.id} value={item.id}>{item.kind} · {item.status} · {item.id}</option>)}</select></label><label>Şifreli dosya parolası<input type="password" autoComplete="new-password" value={exportPassphrase} onChange={event=>setExportPassphrase(event.target.value)}/></label><Button disabled={Boolean(busy)||exportPassphrase.length<12||!exportRequestId} onClick={()=>void exportEncrypted()}>Yerel şifreli dosya oluştur</Button></section>
      <section><h3>Türetilmiş veri zinciri</h3><p>İçerik gösterilmez; yalnız kaynak bağı, tür ve yerel silme yayılım durumu görünür.</p>{center.derivedDataLineage.slice(0,8).map(item=><small key={item.id}>{item.derivedKind} · derinlik {item.depth} · {item.deletionPropagation}</small>)}</section>
      <section><h3>Olay ve yerel containment</h3><Button disabled={Boolean(busy)} onClick={()=>void createIncident()}>Yerel inceleme olayı aç</Button>{center.incidents.slice(0,5).map(item=><div className="list-row privacy-action-row" key={item.id}><div><strong>{item.title} · {item.severity} · {item.status}</strong><small>remote wipe/MDM/ağ teslimi yapılmadı</small>{item.resolutionNote&&<small>{item.resolutionNote}</small>}</div><div className="button-row">{item.status==='open'&&<Button disabled={Boolean(busy)} onClick={()=>void updateIncident(item,'contained_locally')}>Yerel containment’a al</Button>}{['open','contained_locally'].includes(item.status)&&<Button disabled={Boolean(busy)} onClick={()=>void updateIncident(item,'resolved')}>Yerel çözümü kaydet</Button>}{['open','contained_locally'].includes(item.status)&&<Button disabled={Boolean(busy)} onClick={()=>void updateIncident(item,'cancelled')}>Yerel olayı iptal et</Button>}</div></div>)}</section>
      <section><h3>Karşı taraf izin simülasyonu</h3><p>Salt okunurdur; yetki oluşturmaz, erişim yapmaz ve erişim denetim kaydı üretmez.</p><label>Karşı taraf hesap kimliği<input value={simulationAccountId} onChange={event=>setSimulationAccountId(event.target.value)}/></label><Button disabled={Boolean(busy)||!simulationAccountId} onClick={()=>void simulate()}>Görünürlüğü simüle et</Button>{simulationResult&&<StatusMessage>{simulationResult}</StatusMessage>}</section>
    </div>{busy&&<StatusMessage tone="info">İşlem sürüyor; aynı kayıt için ikinci gönderim kilitli.</StatusMessage>}{message&&<StatusMessage>{message}</StatusMessage>}
  </section>;
  return localizePrivacyOwnershipNode(panel,language);
}

interface IdentityAccessRegistrationResponseInput {
  readonly credentialId: string;
  readonly clientDataJsonBase64url: string;
  readonly attestationObjectBase64url: string;
  readonly transports: readonly PasskeyTransport[];
}

interface IdentityAccessAuthenticationResponseInput {
  readonly credentialId: string;
  readonly clientDataJsonBase64url: string;
  readonly authenticatorDataBase64url: string;
  readonly signatureBase64url: string;
  readonly userHandleBase64url?: string;
}

interface PendingIdentityOperation<TPayload=unknown> {
  readonly clientOperationId:string;
  readonly tokenExpiresAt:string;
  readonly expectedRevision:number;
  readonly payload?:TPayload;
}

type ResolvedIdentityOperation<TPayload> = PendingIdentityOperation<TPayload>&{readonly payload:TPayload};

interface PendingPasskeyRegistrationPayload {
  readonly challenge:PasskeyChallengeView;
  readonly displayName:string;
  readonly response?:IdentityAccessRegistrationResponseInput;
}

interface PendingPasskeyAuthenticationPayload {
  readonly challenge:PasskeyChallengeView;
  readonly credentialId:string;
  readonly response?:IdentityAccessAuthenticationResponseInput;
}

interface PendingFederatedIdentityPayload {
  readonly ceremony:FederatedAuthorizationCeremonyView;
}

interface PendingTemporaryCredentialPayload {
  readonly kind:TemporaryCredentialKind;
  readonly purpose:(typeof TEMPORARY_CREDENTIAL_PURPOSE_BY_KIND)[TemporaryCredentialKind];
  readonly audienceReference:string;
  readonly disclosedClaims:readonly {readonly key:TemporaryCredentialClaimKey;readonly value:string}[];
  readonly notBefore:ReturnType<typeof asIsoDateTime>;
  readonly expiresAt:ReturnType<typeof asIsoDateTime>;
}

interface PendingLostPasskeyPayload {
  readonly credentialId:string;
}

const identityAccessBridge=()=>window.pardus??null;

const bufferToBase64url=(value:ArrayBuffer):string=>{
  const bytes=new Uint8Array(value);let binary='';
  for(let offset=0;offset<bytes.length;offset+=8_192)binary+=String.fromCharCode(...bytes.subarray(offset,offset+8_192));
  return globalThis.btoa(binary).replace(/\+/gu,'-').replace(/\//gu,'_').replace(/=+$/gu,'');
};

const base64urlToBytes=(value:string):ArrayBuffer=>{
  const canonical=value.replace(/-/gu,'+').replace(/_/gu,'/');
  const binary=globalThis.atob(canonical.padEnd(Math.ceil(canonical.length/4)*4,'='));
  return Uint8Array.from(binary,character=>character.charCodeAt(0)).buffer;
};

const passkeyTransport=(value:string):value is PasskeyTransport=>['internal','usb','nfc','ble','hybrid'].includes(value);

const passkeyTimeout=(expiresAt:string):number=>Math.max(1_000,Math.min(300_000,Date.parse(expiresAt)-Date.now()));

const challengeForPasskey=async(challenge:PasskeyChallengeView,credentialIdSha256:string):Promise<PasskeyChallengeView>=>{
  for(const credentialId of challenge.allowedCredentialIds){
    const digest=new Uint8Array(await globalThis.crypto.subtle.digest('SHA-256',base64urlToBytes(credentialId)));
    if(Array.from(digest,byte=>byte.toString(16).padStart(2,'0')).join('')===credentialIdSha256.toLowerCase()){
      return Object.freeze({...challenge,allowedCredentialIds:Object.freeze([credentialId])});
    }
  }
  throw new Error('Seçilen passkey bu WebAuthn challenge içinde bulunamadı; farklı bir credential ile doğrulama yapılmadı.');
};

const createPasskeyRegistrationResponse=async(challenge:PasskeyChallengeView,center:IdentityAccessCredentialCenterView):Promise<IdentityAccessRegistrationResponseInput>=>{
  if(!globalThis.navigator?.credentials)throw new Error('Bu cihazda WebAuthn kullanılamıyor; hiçbir passkey kaydı oluşturulmadı.');
  const credential=await globalThis.navigator.credentials.create({publicKey:{
    challenge:base64urlToBytes(challenge.challenge),
    rp:{id:challenge.relyingPartyId,name:'ParsYuva AYM'},
    user:{id:new TextEncoder().encode(String(center.key.accountId)),name:String(center.key.accountId),displayName:'Yerel aile hesabı'},
    pubKeyCredParams:[{type:'public-key',alg:-7},{type:'public-key',alg:-257}],
    timeout:passkeyTimeout(challenge.expiresAt),attestation:'none',
    authenticatorSelection:{residentKey:challenge.residentKey,userVerification:challenge.userVerification},
    excludeCredentials:challenge.allowedCredentialIds.map(id=>({type:'public-key' as const,id:base64urlToBytes(id)}))
  }});
  if(!(credential instanceof PublicKeyCredential)||!(credential.response instanceof AuthenticatorAttestationResponse))throw new Error('Passkey kayıt töreni kullanıcı tarafından tamamlanmadı.');
  const response=credential.response;
  return Object.freeze({
    credentialId:bufferToBase64url(credential.rawId),
    clientDataJsonBase64url:bufferToBase64url(response.clientDataJSON),
    attestationObjectBase64url:bufferToBase64url(response.attestationObject),
    transports:Object.freeze((typeof response.getTransports==='function'?response.getTransports():[]).filter(passkeyTransport))
  });
};

const createPasskeyAuthenticationResponse=async(challenge:PasskeyChallengeView):Promise<IdentityAccessAuthenticationResponseInput>=>{
  if(!globalThis.navigator?.credentials)throw new Error('Bu cihazda WebAuthn kullanılamıyor; doğrulama yapılmadı.');
  const credential=await globalThis.navigator.credentials.get({publicKey:{
    challenge:base64urlToBytes(challenge.challenge),rpId:challenge.relyingPartyId,
    timeout:passkeyTimeout(challenge.expiresAt),userVerification:challenge.userVerification,
    allowCredentials:challenge.allowedCredentialIds.map(id=>({type:'public-key' as const,id:base64urlToBytes(id)}))
  }});
  if(!(credential instanceof PublicKeyCredential)||!(credential.response instanceof AuthenticatorAssertionResponse))throw new Error('Passkey doğrulama töreni tamamlanmadı.');
  const response=credential.response;
  return Object.freeze({
    credentialId:bufferToBase64url(credential.rawId),
    clientDataJsonBase64url:bufferToBase64url(response.clientDataJSON),
    authenticatorDataBase64url:bufferToBase64url(response.authenticatorData),
    signatureBase64url:bufferToBase64url(response.signature),
    ...(response.userHandle?{userHandleBase64url:bufferToBase64url(response.userHandle)}:{})
  });
};

const temporaryKindOptions:readonly {readonly kind:TemporaryCredentialKind;readonly label:string}[]=Object.freeze([
  {kind:'school_pickup',label:'Okuldan teslim alma'},
  {kind:'temporary_caregiver',label:'Geçici bakım veren'},
  {kind:'pet_caregiver',label:'Evcil hayvan bakım veren'},
  {kind:'emergency_contact_health',label:'Acil kişi sağlık özeti'},
  {kind:'event_invitation',label:'Etkinlik daveti'},
  {kind:'temporary_home_access',label:'Geçici ev erişimi'}
]);

const temporaryClaimLabels:Readonly<Record<TemporaryCredentialClaimKey,string>>=Object.freeze({
  subject_display_name:'Konu kişi adı',authorized_person_display_name:'Yetkili kişi adı',caregiver_display_name:'Bakım veren adı',
  pet_display_name:'Evcil hayvan adı',school_name:'Okul adı',emergency_contact_name:'Acil kişi adı',
  emergency_contact_phone:'Acil kişi telefonu',allergy_summary:'Alerji özeti',critical_medication_summary:'Kritik ilaç özeti',
  event_title:'Etkinlik başlığı',valid_location_label:'Geçerli konum',contact_phone:'İletişim telefonu'
});

const federatedProviderLabels:Readonly<Record<FederatedIdentityProvider,string>>=Object.freeze({apple:'Apple',google:'Google',microsoft:'Microsoft'});

export function IdentityAccessCredentialCenter({trustedDevices}:{trustedDevices:readonly TrustedDeviceView[]}) {
  const {language}=useLocalization();
  const [center,setCenter]=useState<IdentityAccessCredentialCenterView|null>(null);
  const [providers,setProviders]=useState<ExternalIdentityProviderView[]>([]);
  const [phase,setPhase]=useState<'loading'|'ready'|'error'>('loading');
  const [busy,setBusy]=useState('');
  const [message,setMessage]=useState('');
  const [passkeyName,setPasskeyName]=useState('Bu cihazın passkey anahtarı');
  const [lostPasskeyId,setLostPasskeyId]=useState('');
  const [recoveryMethod,setRecoveryMethod]=useState<'windows_hello'|'password_fallback'>('windows_hello');
  const [recoveryPassword,setRecoveryPassword]=useState('');
  const [recoverySecondFactorCode,setRecoverySecondFactorCode]=useState('');
  const [federatedFlow,setFederatedFlow]=useState<{readonly ceremony:FederatedAuthorizationCeremonyView;readonly clientOperationId:string}|null>(null);
  const [temporaryKind,setTemporaryKind]=useState<TemporaryCredentialKind>('school_pickup');
  const [temporaryAudience,setTemporaryAudience]=useState('');
  const [temporaryExpiresAt,setTemporaryExpiresAt]=useState('');
  const [temporaryClaims,setTemporaryClaims]=useState<Partial<Record<TemporaryCredentialClaimKey,string>>>({});
  const [temporaryValidation,setTemporaryValidation]=useState<ValidationIssue[]>([]);
  const [issuedTemporary,setIssuedTemporary]=useState<IssuedTemporaryVerifiableCredentialView|null>(null);
  const [qrPayload,setQrPayload]=useState('');
  const [verification,setVerification]=useState<TemporaryCredentialVerificationView|null>(null);
  const [companionDeviceId,setCompanionDeviceId]=useState('');
  const [knownSourceVersion,setKnownSourceVersion]=useState('');
  const [companionResult,setCompanionResult]=useState<ReadOnlyCompanionSnapshotView|CompanionSyncDenialView|null>(null);
  const pendingOperations=useRef(new Map<string,PendingIdentityOperation>());
  const loadGuard=useRef(new AsyncWriteGuard());

  const load=async()=>{
    const bridge=identityAccessBridge();
    if(!bridge||!window.pardus){setMessage('Kimlik ve yetki bridge’i kullanılamıyor.');setPhase('error');return;}
    const ticket=loadGuard.current.start('identity-access-center');setPhase('loading');
    try{
      const [nextCenter,nextProviders]=await Promise.all([bridge.getIdentityAccessCredentialCenter(),window.pardus.getExternalIdentityProviders()]);
      loadGuard.current.commit(ticket,()=>{setCenter(nextCenter);setProviders(nextProviders.filter(item=>item.configured));setLostPasskeyId(current=>nextCenter.passkeys.some(item=>item.id===current&&item.status==='active')?current:nextCenter.passkeys.find(item=>item.status==='active')?.id??'');setPhase('ready');});
    }catch(error){loadGuard.current.commit(ticket,()=>{setMessage(error instanceof Error?error.message:'Kimlik ve yetki merkezi yüklenemedi.');setPhase('error');});}
  };
  useEffect(()=>{void load();return()=>loadGuard.current.invalidate('identity-access-center');},[]);
  useEffect(()=>{if(!companionDeviceId){const first=trustedDevices.find(item=>!item.revokedAt);if(first)setCompanionDeviceId(first.id);}},[trustedDevices,companionDeviceId]);

  const stableOperation=async(key:string,expectedRevision:number,operationKind:IdentityAccessOperationKind):Promise<PendingIdentityOperation>=>{
    const current=pendingOperations.current.get(key);
    if(current&&Date.parse(current.tokenExpiresAt)>Date.now())return current;
    pendingOperations.current.delete(key);
    const bridge=identityAccessBridge();if(!bridge)throw new Error('Main-issued operation token bridge kullanılamıyor.');
    const issued=await bridge.issueIdentityAccessOperationToken(operationKind);
    const operation=Object.freeze({clientOperationId:issued.clientOperationId,tokenExpiresAt:issued.expiresAt,expectedRevision});
    pendingOperations.current.set(key,operation);return operation;
  };
  const rememberOperation=<TPayload,>(key:string,operation:PendingIdentityOperation,payload:TPayload):ResolvedIdentityOperation<TPayload>=>{
    const next=Object.freeze({clientOperationId:operation.clientOperationId,tokenExpiresAt:operation.tokenExpiresAt,expectedRevision:operation.expectedRevision,payload});
    pendingOperations.current.set(key,next);return next;
  };
  const runMutation=async(key:string,expectedRevision:number,run:(operation:PendingIdentityOperation)=>Promise<unknown>,success:string)=>{
    if(busy)return;setBusy(key);setMessage('');
    try{
      const operationKind:IdentityAccessOperationKind=key.startsWith('passkey:revoke:')?'passkey_revoke'
        :key.startsWith('federated:unlink:')?'federated_unlink':'temporary_credential_revoke';
      const operation=await stableOperation(key,expectedRevision,operationKind);await run(operation);pendingOperations.current.delete(key);setMessage(success);await load();
    }
    catch(error){setMessage(error instanceof Error?`${error.message} Aynı işlem kimliği ve özgün revizyonla yeniden deneyebilirsiniz.`:'İşlem tamamlanamadı; yeniden deneme kimliği korundu.');}
    finally{setBusy('');}
  };

  const registerPasskey=async()=>{
    const bridge=identityAccessBridge();if(!bridge||!center||busy||passkeyName.trim().length<2)return;
    const key='passkey:register';setBusy(key);setMessage('');
    try{
      let operation=await stableOperation(key,0,'passkey_register') as PendingIdentityOperation<PendingPasskeyRegistrationPayload>;
      if(operation.payload&&Date.parse(operation.payload.challenge.expiresAt)<=Date.now()){
        pendingOperations.current.delete(key);operation=await stableOperation(key,0,'passkey_register') as PendingIdentityOperation<PendingPasskeyRegistrationPayload>;
      }
      let payload=operation.payload;
      if(!payload){
        const challenge=await bridge.beginPasskeyRegistration({clientOperationId:operation.clientOperationId});
        payload=Object.freeze({challenge,displayName:passkeyName.trim()});operation=rememberOperation(key,operation,payload);
      }
      if(!payload.response){
        const response=await createPasskeyRegistrationResponse(payload.challenge,center);
        payload=Object.freeze({...payload,response});operation=rememberOperation(key,operation,payload);
      }
      const response=payload.response;
      if(!response)throw new Error('Passkey kayıt yanıtı güvenli yeniden deneme durumuna alınamadı.');
      await bridge.completePasskeyRegistration({expectedRevision:operation.expectedRevision,clientOperationId:operation.clientOperationId,challengeId:payload.challenge.challengeId,displayName:payload.displayName,response,confirmation:'PASSKEY KAYDINI TAMAMLA'});
      pendingOperations.current.delete(key);setMessage('Passkey töreni yerel olarak doğrulandı; özel anahtar ve biyometrik veri uygulamaya gelmedi.');await load();
    }catch(error){setMessage(error instanceof Error?`${error.message} Süresi dolmamış challenge, tören yanıtı ve işlem kimliği yeniden deneme için korundu.`:'Passkey kaydı tamamlanamadı; challenge ve tekrar kimliği korundu.');}
    finally{setBusy('');}
  };

  const authenticatePasskey=async(passkey:IdentityAccessCredentialCenterView['passkeys'][number])=>{
    const bridge=identityAccessBridge();if(!bridge||busy)return;const key=`passkey:assert:${passkey.id}`;
    setBusy(key);setMessage('');
    try{
      let operation=await stableOperation(key,passkey.revision,'passkey_authenticate') as PendingIdentityOperation<PendingPasskeyAuthenticationPayload>;
      if(operation.payload&&Date.parse(operation.payload.challenge.expiresAt)<=Date.now()){
        pendingOperations.current.delete(key);operation=await stableOperation(key,passkey.revision,'passkey_authenticate') as PendingIdentityOperation<PendingPasskeyAuthenticationPayload>;
      }
      let payload=operation.payload;
      if(!payload){
        const receivedChallenge=await bridge.beginPasskeyAuthentication({clientOperationId:operation.clientOperationId});
        const challenge=await challengeForPasskey(receivedChallenge,passkey.credentialIdSha256);
        payload=Object.freeze({challenge,credentialId:passkey.id});operation=rememberOperation(key,operation,payload);
      }
      if(!payload.response){
        const response=await createPasskeyAuthenticationResponse(payload.challenge);
        payload=Object.freeze({...payload,response});operation=rememberOperation(key,operation,payload);
      }
      const response=payload.response;
      if(!response)throw new Error('Passkey doğrulama yanıtı güvenli yeniden deneme durumuna alınamadı.');
      await bridge.authenticateWithPasskey({expectedRevision:operation.expectedRevision,clientOperationId:operation.clientOperationId,credentialId:payload.credentialId,challengeId:payload.challenge.challengeId,response,confirmation:'PASSKEY ILE DOGRULA'});
      pendingOperations.current.delete(key);setMessage('Passkey imzası, kullanıcı varlığı ve kullanıcı doğrulaması yerel olarak doğrulandı.');await load();
    }catch(error){setMessage(error instanceof Error?`${error.message} Süresi dolmamış challenge ve aynı doğrulama kimliği yeniden deneme için korundu.`:'Passkey doğrulaması tamamlanamadı; challenge korundu.');}
    finally{setBusy('');}
  };

  const recoverLostPasskey=async(credentialId:string,revision:number)=>{
    const bridge=identityAccessBridge();if(!bridge||busy||(recoveryMethod==='password_fallback'&&!recoveryPassword))return;
    const key=`passkey:recover:${credentialId}`;
    setBusy(key);setMessage('');
    try{
      let operation=await stableOperation(key,revision,'passkey_recover_lost') as PendingIdentityOperation<PendingLostPasskeyPayload>;
      let payload=operation.payload;
      if(!payload){
        payload=Object.freeze({credentialId});operation=rememberOperation(key,operation,payload);
      }
      const fallback=recoveryMethod==='password_fallback'
        ? {password:recoveryPassword,...(recoverySecondFactorCode.trim()?{secondFactorCode:recoverySecondFactorCode.trim()}: {})}
        : undefined;
      await bridge.recoverLostPasskey({expectedRevision:operation.expectedRevision,clientOperationId:operation.clientOperationId,credentialId:payload.credentialId,...(fallback?{fallback}: {}),confirmation:'KAYIP PASSKEY KURTARMASINI BASLAT'});
      pendingOperations.current.delete(key);setMessage('Güçlü yerel yeniden doğrulama tamamlandı; kayıp passkey yetkisi, güvenlik dönemi ve yerel oturumlar kapatıldı.');await load();
    }catch(error){setMessage(error instanceof Error?`${error.message} İşlem kimliği korundu; parola fallback kullanıyorsanız sırrı yeniden girin.`:'Kayıp passkey kurtarması tamamlanamadı; işlem kimliği korundu, sır saklanmadı.');}
    finally{setRecoveryPassword('');setRecoverySecondFactorCode('');setBusy('');}
  };

  const startFederated=async(provider:FederatedIdentityProvider)=>{
    const bridge=identityAccessBridge();if(!bridge||busy)return;const key=`federated:start:${provider}`;setBusy(key);setMessage('');
    try{
      let operation=await stableOperation(key,0,'federated_link') as PendingIdentityOperation<PendingFederatedIdentityPayload>;
      if(operation.payload&&Date.parse(operation.payload.ceremony.expiresAt)<=Date.now()){
        pendingOperations.current.delete(key);operation=await stableOperation(key,0,'federated_link') as PendingIdentityOperation<PendingFederatedIdentityPayload>;
      }
      let payload=operation.payload;
      if(!payload){const ceremony=await bridge.beginFederatedIdentityLink({clientOperationId:operation.clientOperationId,provider});payload=Object.freeze({ceremony});operation=rememberOperation(key,operation,payload);}
      setFederatedFlow({ceremony:payload.ceremony,clientOperationId:operation.clientOperationId});setMessage('Authorization Code + PKCE töreni hazır. Sağlayıcı dönüşü yalnız ana süreçte yakalanır; kullanılabilirlik veya ağ teslimi garanti edilmez.');
    }
    catch(error){setMessage(error instanceof Error?`${error.message} Yapılandırma veya canlı sağlayıcı kanıtı yoksa bağlantı kapalı kalır.`:'Federated kimlik töreni başlatılamadı.');}
    finally{setBusy('');}
  };

  const completeFederated=async()=>{
    const bridge=identityAccessBridge();if(!bridge||!federatedFlow||busy)return;const {ceremony}=federatedFlow;const key=`federated:start:${ceremony.provider}`;const operation=pendingOperations.current.get(key) as PendingIdentityOperation<PendingFederatedIdentityPayload>|undefined;if(!operation?.payload)return;setBusy(key);setMessage('');
    try{
      const payload=operation.payload;
      await bridge.completeFederatedIdentityLink({expectedRevision:operation.expectedRevision,clientOperationId:operation.clientOperationId,provider:payload.ceremony.provider,flowId:payload.ceremony.flowId,confirmation:'FEDERATED KIMLIGI BAGLA'});pendingOperations.current.delete(key);setFederatedFlow(null);setMessage('Canlı hesap yalnız ana süreç callback yakalama, token exchange, imza, issuer, audience, state ve nonce doğrulamasından sonra bağlandı.');await load();
    }
    catch(error){const detail=error instanceof Error?error.message:'Ana süreç federated callback’i henüz yakalamadı veya doğrulayamadı.';if(!detail.includes('[OIDC_CALLBACK_NOT_CAPTURED]')){pendingOperations.current.delete(key);setFederatedFlow(null);}setMessage(detail.includes('[OIDC_CALLBACK_NOT_CAPTURED]')?`${detail} Sağlayıcıdan uygulamaya döndükten sonra aynı işlem kimliğiyle yeniden deneyebilirsiniz.`:`${detail} Authorization code tek kullanımlı olduğundan yeni bir PKCE akışı başlatın.`);}
    finally{setBusy('');}
  };

  const issueTemporary=async()=>{
    const bridge=identityAccessBridge();if(!bridge||busy)return;const rules=TEMPORARY_CREDENTIAL_DISCLOSURE_RULES[temporaryKind];const expires=new Date(temporaryExpiresAt);const issues:ValidationIssue[]=[];
    if(!temporaryAudience.trim())issues.push({fieldId:'temporary-audience',message:'Hedef kişi veya bağlam zorunludur.'});
    if(!temporaryExpiresAt||Number.isNaN(expires.getTime())||expires.getTime()<=Date.now())issues.push({fieldId:'temporary-expiry',message:'Gelecekte bir bitiş zamanı seçin.'});
    for(const claim of rules.required)if(!temporaryClaims[claim]?.trim())issues.push({fieldId:`temporary-claim-${claim}`,message:`${temporaryClaimLabels[claim]} zorunludur.`});
    setTemporaryValidation(issues);if(issues.length)return;
    const key=`temporary:issue:${temporaryKind}`;setBusy('temporary:issue');setMessage('');
    try{
      let operation=await stableOperation(key,0,'temporary_credential_issue') as PendingIdentityOperation<PendingTemporaryCredentialPayload>;
      let payload=operation.payload;
      if(!payload){
        const disclosedClaims=Object.freeze(rules.allowed.flatMap(claimKey=>{const value=temporaryClaims[claimKey]?.trim();return value?[Object.freeze({key:claimKey,value})]:[];}));
        payload=Object.freeze({kind:temporaryKind,purpose:TEMPORARY_CREDENTIAL_PURPOSE_BY_KIND[temporaryKind],audienceReference:temporaryAudience.trim(),disclosedClaims,notBefore:asIsoDateTime(new Date().toISOString()),expiresAt:asIsoDateTime(expires.toISOString())});operation=rememberOperation(key,operation,payload);
      }
      const result=await bridge.issueTemporaryVerifiableCredential({expectedRevision:operation.expectedRevision,clientOperationId:operation.clientOperationId,kind:payload.kind,purpose:payload.purpose,audienceReference:payload.audienceReference,disclosedClaims:payload.disclosedClaims,notBefore:payload.notBefore,expiresAt:payload.expiresAt,confirmation:'GECICI YETKI BELGESI OLUSTUR'});pendingOperations.current.delete(key);setIssuedTemporary(result.issued??null);if(result.issued)setQrPayload(result.issued.qrPayload);setMessage(result.issued?'Minimum disclosure içeren, süreli ve çevrimdışı doğrulanabilir QR payload oluşturuldu.':'Aynı işlem daha önce kaydedildi; güvenlik nedeniyle QR payload yeniden gösterilmedi.');await load();
    }
    catch(error){setMessage(error instanceof Error?`${error.message} İlk hedef, disclosure, süre ve aynı işlem kimliği yeniden deneme için korundu.`:'Geçici yetki belgesi oluşturulamadı; ilk niyet korundu.');}
    finally{setBusy('');}
  };

  const verifyTemporary=async()=>{
    const bridge=identityAccessBridge();if(!bridge||!qrPayload.trim()||!temporaryAudience.trim()||busy)return;setBusy('temporary:verify');setMessage('');
    try{const result=await bridge.verifyTemporaryVerifiableCredential({qrPayload:qrPayload.trim(),expectedAudienceReference:temporaryAudience.trim()});setVerification(result);setMessage('Self-signed imza, süre, hedef ve minimum disclosure çevrimdışı kontrol edildi; resmi kimlik ve uzak iptal güncelliği garanti edilmez.');}
    catch(error){setVerification(null);setMessage(error instanceof Error?error.message:'QR payload çevrimdışı doğrulanamadı.');}
    finally{setBusy('');}
  };

  const createCompanion=async(requestedMode:'read_only'|'write')=>{
    const bridge=identityAccessBridge();if(!bridge||!companionDeviceId||busy)return;const version=knownSourceVersion.trim()?Number(knownSourceVersion):undefined;const key=`companion:${requestedMode}:${companionDeviceId}:${version??'current'}`;setBusy(key);setMessage('');
    try{const operation=await stableOperation(key,0,'companion_snapshot_create');const result=await bridge.createReadOnlyCompanionSnapshot({clientOperationId:operation.clientOperationId,trustedDeviceId:companionDeviceId,requestedMode,...(version===undefined?{}:{knownSourceVersion:version}),confirmation:'SALT OKUNUR ESLIKCI KOPYASI OLUSTUR'});pendingOperations.current.delete(key);setCompanionResult(result);setMessage(result.status==='snapshot_ready'?'Şifreli salt okunur kopya yerel olarak hazırlandı; ağ teslimi yapılmadı.':'Yazma veya eski sürüm isteği reddedildi; Windows tek yazardır.');if(result.status==='snapshot_ready')await load();}
    catch(error){setMessage(error instanceof Error?`${error.message} Aynı snapshot kimliğiyle yeniden deneyebilirsiniz.`:'Companion snapshot oluşturulamadı.');}
    finally{setBusy('');}
  };

  if(phase==='loading')return localizeIdentityAccessNode(<AsyncStatePanel state="loading" title="Kimlik ve geçici yetki merkezi yükleniyor" message="Passkey, bağlı hesap, süreli belge ve companion metadata görünümü hazırlanıyor."/>,language);
  if(phase==='error')return localizeIdentityAccessNode(<AsyncStatePanel state="error" title="Kimlik ve geçici yetki merkezi yüklenemedi" message={message||'Yetkili yerel görünüm kurulamadı.'} onRetry={load}/>,language);
  if(!center)return localizeIdentityAccessNode(<AsyncStatePanel state="empty" title="Kimlik ve geçici yetki merkezi boş" message="Bu hesap için yetkili yerel görünüm bulunamadı."/>,language);
  const allEmpty=center.passkeys.length===0&&center.federatedLinks.length===0&&center.temporaryCredentials.length===0&&center.companionSnapshots.length===0;
  const activePasskeys=center.passkeys.filter(item=>item.status==='active');
  const configuredProviders=providers.filter(item=>item.configured);
  const currentRules=TEMPORARY_CREDENTIAL_DISCLOSURE_RULES[temporaryKind];
  const activeDevices=trustedDevices.filter(item=>!item.revokedAt);
  const panel=<section className="identity-access-center" aria-label="Kimlik, passkey ve geçici yetki merkezi" aria-describedby="identity-access-description">
    <SectionHeader eyebrow="B2-02 · B6-06 · B6-07" title="Kimlik, passkey ve geçici yetki merkezi" action={<Button disabled={Boolean(busy)} onClick={()=>void load()}>Merkezi yenile</Button>}/>
    <p id="identity-access-description">Bu tek merkez yalnız yerel olarak doğrulanmış tören metadata’sını yönetir. Biyometrik veri veya passkey özel anahtarı uygulamaya gelmez; uzak attestation, resmi kimlik veya hukuk sertifikasyonu yapılmaz. Sağlayıcı kullanılabilirliği, uzak iptal güncelliği ve ağ teslimi garanti edilmez.</p>
    <div className="identity-truth-strip" role="list" aria-label="Kimlik ve yetki sınırları"><span role="listitem">Özel anahtar saklanmaz</span><span role="listitem">Biyometrik veri saklanmaz</span><span role="listitem">Token baytları gösterilmez</span><span role="listitem">Windows tek yazardır</span></div>
    {allEmpty&&<AsyncStatePanel state="empty" title="Henüz kimlik veya geçici yetki kaydı yok" message="Aşağıdaki yerel, açık onaylı işlemlerden birini başlatabilirsiniz."/>}
    <div className="identity-access-grid">
      <section className="identity-access-card"><h3>Passkey ve cihaz doğrulaması</h3><p>WebAuthn kullanıcı varlığı ve doğrulaması ister. Uygulama biyometrik örnek istemez, yakalamaz veya saklamaz.</p><label>Passkey adı<input value={passkeyName} maxLength={120} onChange={event=>setPasskeyName(event.target.value)}/></label><Button tone="primary" disabled={Boolean(busy)||passkeyName.trim().length<2} onClick={()=>void registerPasskey()}>{busy==='passkey:register'?'WebAuthn bekleniyor…':'Bu cihazda passkey kaydet'}</Button>{center.passkeys.length===0?<EmptyState title="Passkey yok" body="Bu hesapta kayıtlı passkey metadata’sı bulunmuyor."/>:center.passkeys.map(item=><div className="identity-record" key={item.id}><div><strong>{item.displayName} · {item.status==='active'?'Etkin':'İptal'}</strong><small>{item.relyingPartyId} · sayaç {item.signCount} · güvenlik dönemi {item.securityEpoch}</small><small>Özel anahtar: saklanmaz · Biyometri: saklanmaz · Attestation payload: saklanmaz</small></div>{item.status==='active'&&<div className="button-row"><Button disabled={Boolean(busy)} onClick={()=>void authenticatePasskey(item)}>Passkey ile doğrula</Button><Button tone="danger" disabled={Boolean(busy)} onClick={()=>void runMutation(`passkey:revoke:${item.id}`,item.revision,operation=>identityAccessBridge()!.revokePasskey({expectedRevision:operation.expectedRevision,clientOperationId:operation.clientOperationId,credentialId:item.id,reason:'manual',confirmation:'PASSKEY YETKISINI IPTAL ET'}),'Passkey yerel yetkisi iptal edildi.')}>İptal et</Button></div>}</div>)}<fieldset><legend>Kayıp passkey kurtarma</legend><label>Etkin passkey<select value={lostPasskeyId} onChange={event=>setLostPasskeyId(event.target.value)}><option value="">Passkey seçin</option>{activePasskeys.map(item=><option value={item.id} key={item.id}>{item.displayName}</option>)}</select></label><label>Güçlü yerel yeniden doğrulama<select value={recoveryMethod} onChange={event=>setRecoveryMethod(event.target.value as 'windows_hello'|'password_fallback')}><option value="windows_hello">Windows Hello</option><option value="password_fallback">Hesap parolası fallback</option></select></label>{recoveryMethod==='password_fallback'&&<div className="identity-recovery-fallback"><label>Hesap parolası<input type="password" autoComplete="current-password" value={recoveryPassword} onChange={event=>setRecoveryPassword(event.target.value)}/></label><label>İkinci faktör kodu <small>(etkinse)</small><input inputMode="numeric" autoComplete="one-time-code" value={recoverySecondFactorCode} maxLength={256} onChange={event=>setRecoverySecondFactorCode(event.target.value)}/></label></div>}<Button tone="danger" disabled={Boolean(busy)||!lostPasskeyId||(recoveryMethod==='password_fallback'&&!recoveryPassword)} onClick={()=>{const item=activePasskeys.find(value=>value.id===lostPasskeyId);if(item)void recoverLostPasskey(item.id,item.revision);}}>{recoveryMethod==='windows_hello'?'Windows Hello ile doğrula ve yerel yetkiyi kapat':'Parola ile doğrula ve yerel yetkiyi kapat'}</Button><small>Güçlü kanıtı main process üretir; kullanıcıdan kanıt kimliği alınmaz. Bu işlem uzak cihazı silmez, MDM çalıştırmaz; yalnız yerel credential yetkisini, güvenlik dönemini ve yerel oturumları kapatır.</small></fieldset></section>
      <section className="identity-access-card"><h3>Federated kimlik bağları</h3><p>Yalnız yapılandırılmış sağlayıcılar listelenir. Bağ ancak Authorization Code + PKCE, state, nonce, issuer, audience ve imza doğrulamasından sonra canlı kabul edilir.</p>{configuredProviders.length===0?<AsyncStatePanel state="empty" title="Yapılandırılmış sağlayıcı yok" message="Apple, Google veya Microsoft için güvenilir tam yapılandırma bulunmadığından bağlantı başlatılamaz; sağlayıcı kullanılabilirliği iddia edilmez."/>:<div className="identity-provider-list">{configuredProviders.map(provider=>{const linked=center.federatedLinks.some(item=>item.provider===provider.id&&item.status==='linked');const flowActive=federatedFlow?.ceremony.provider===provider.id;return <div className="identity-provider" key={provider.id}><div><strong>{federatedProviderLabels[provider.id]}</strong><small>{provider.productionReady?'Yapılandırma bulundu · canlı hesap kanıtı callback sonrası':'Yapılandırma bulundu · canlı hesap henüz doğrulanmadı'}</small></div><Button disabled={Boolean(busy)||linked||flowActive} onClick={()=>void startFederated(provider.id)}>{linked?'Bağlı':flowActive?'PKCE töreni açık':'PKCE bağlantısını başlat'}</Button></div>;})}</div>}{federatedFlow&&<div className="identity-ceremony"><strong>{federatedProviderLabels[federatedFlow.ceremony.provider]} töreni · S256</strong><small>Son: {formatDate(federatedFlow.ceremony.expiresAt,{dateStyle:'short',timeStyle:'short'})} · state ve nonce bağlı · code verifier şifreli kasada</small><a className="button default" href={federatedFlow.ceremony.authorizationUrl} target="_blank" rel="noreferrer">Sağlayıcı sayfasını aç</a><p>Sağlayıcı tamamlanınca <code>pardus-app://oidc</code> dönüşü yalnız ana süreçte yakalanır; code ve state renderer’a girilmez veya gösterilmez.</p><Button tone="primary" disabled={Boolean(busy)} onClick={()=>void completeFederated()}>Uygulamaya dönüşü doğrula ve bağla</Button></div>}{center.federatedLinks.length===0?<EmptyState title="Bağlı federated kimlik yok" body="Token baytları renderer’da veya yerel iş kayıtlarında gösterilmez."/>:center.federatedLinks.map(item=><div className="identity-record" key={item.id}><div><strong>{federatedProviderLabels[item.provider]} · {item.status==='linked'?'Canlı doğrulandı':'İptal'}</strong><small>{item.grantedScopes.join(', ')} · token şifreli kasada · teslim garantisi yok</small></div>{item.status==='linked'&&<Button tone="danger" disabled={Boolean(busy)} onClick={()=>void runMutation(`federated:unlink:${item.id}`,item.revision,operation=>identityAccessBridge()!.unlinkFederatedIdentity({expectedRevision:operation.expectedRevision,clientOperationId:operation.clientOperationId,linkId:item.id,confirmation:'FEDERATED KIMLIK BAGINI KALDIR'}),'Federated bağ ve yerel token yetkisi iptal edildi.')}>Bağı kaldır</Button>}</div>)}</section>
      <section className="identity-access-card identity-temporary-card"><h3>Geçici doğrulanabilir yetkiler</h3><p>Tür, amaç ve izinli alan matrisi sabittir. Yalnız zorunlu ve sizin doldurduğunuz isteğe bağlı alanlar imzalı QR payload’a girer. Bu payload resmi kimlik veya hukuki yetki sertifikası değildir.</p><ValidationSummary issues={temporaryValidation}/><div className="identity-form-grid"><label>Yetki türü<select value={temporaryKind} onChange={event=>{setTemporaryKind(event.target.value as TemporaryCredentialKind);setTemporaryValidation([]);}}>{temporaryKindOptions.map(item=><option key={item.kind} value={item.kind}>{item.label}</option>)}</select></label><label>Amaç<input readOnly value={TEMPORARY_CREDENTIAL_PURPOSE_BY_KIND[temporaryKind]}/></label><label id="temporary-audience-label">Hedef kişi / bağlam<input id="temporary-audience" value={temporaryAudience} maxLength={160} onChange={event=>setTemporaryAudience(event.target.value)}/></label><label id="temporary-expiry-label">Bitiş zamanı<input id="temporary-expiry" type="datetime-local" value={temporaryExpiresAt} onChange={event=>setTemporaryExpiresAt(event.target.value)}/></label></div><fieldset><legend>Minimum disclosure alanları</legend><div className="temporary-claim-grid">{currentRules.allowed.map(key=><label key={key}>{temporaryClaimLabels[key]} {(currentRules.required as readonly TemporaryCredentialClaimKey[]).includes(key)?<strong aria-label="zorunlu">*</strong>:<small>isteğe bağlı</small>}<input id={`temporary-claim-${key}`} maxLength={256} value={temporaryClaims[key]??''} onChange={event=>setTemporaryClaims(current=>({...current,[key]:event.target.value}))}/></label>)}</div></fieldset><Button tone="primary" disabled={Boolean(busy)} onClick={()=>void issueTemporary()}>Süreli, imzalı QR payload oluştur</Button>{issuedTemporary&&<div className="issued-credential" role="status"><strong>QR payload hazır · {issuedTemporary.qrPayloadBytes} bayt</strong><small>Yalnız seçilen alanlar · özel imza anahtarı gösterilmez · ağ teslimi yapılmaz</small><code>{issuedTemporary.qrPayload}</code><Button onClick={()=>void navigator.clipboard.writeText(issuedTemporary.qrPayload)}>QR payload’ı kopyala</Button></div>}<h4>Çevrimdışı QR doğrulama</h4><label>QR payload<textarea rows={5} maxLength={5462} value={qrPayload} onChange={event=>setQrPayload(event.target.value.replace(/\s+/gu,''))}/></label><Button disabled={Boolean(busy)||!qrPayload.trim()} onClick={()=>void verifyTemporary()}>İmza ve süreyi çevrimdışı doğrula</Button>{verification&&<StatusMessage tone={verification.decision==='accepted_locally'?'success':verification.decision==='rejected'?'danger':'warning'}>{verification.decision} · imza {verification.signatureValid?'geçerli':'geçersiz'} · süre {verification.expired?'dolmuş':'uygun'} · yerel iptal {verification.revocationStatus} · uzak iptal güncelliği garanti edilmez</StatusMessage>}{center.temporaryCredentials.length===0?<EmptyState title="Geçici yetki yok" body="Oluşturulan belgeler süre, amaç ve minimum disclosure metadata’sıyla burada görünür."/>:center.temporaryCredentials.map(item=><div className="identity-record" key={item.id}><div><strong>{temporaryKindOptions.find(option=>option.kind===item.kind)?.label} · {item.status==='active'?'Etkin':'İptal'}</strong><small>{item.purpose} · {item.disclosedClaimKeys.length} alan · son {formatDate(item.expiresAt,{dateStyle:'short',timeStyle:'short'})}</small><small>Ed25519 · çevrimdışı imza/süre · uzak iptal güncelliği garanti edilmez</small></div>{item.status==='active'&&<Button tone="danger" disabled={Boolean(busy)} onClick={()=>void runMutation(`temporary:revoke:${item.id}`,item.revision,operation=>identityAccessBridge()!.revokeTemporaryVerifiableCredential({expectedRevision:operation.expectedRevision,clientOperationId:operation.clientOperationId,credentialId:item.id,reason:'Kullanıcının yerel geçici yetki iptali',confirmation:'GECICI YETKI BELGESINI IPTAL ET'}),'Geçici yetki yerel olarak iptal edildi; dağıtılmış kopyalarda anlık iptal garantisi yoktur.')}>Yerel yetkiyi iptal et</Button>}</div>)}</section>
      <section className="identity-access-card"><h3>Salt okunur companion snapshot</h3><p>Windows tek yazardır. Companion yalnız şifreli, süreli ve salt okunur snapshot alabilir; uzak yazma, çatışma birleştirme veya ağ teslimi yoktur.</p>{activeDevices.length===0?<AsyncStatePanel state="empty" title="Uygun güvenilir cihaz yok" message="Snapshot için aynı hesap ve güvenlik döneminde etkin bir güvenilir cihaz gerekir."/>:<><label>Hedef güvenilir cihaz<select value={companionDeviceId} onChange={event=>setCompanionDeviceId(event.target.value)}>{activeDevices.map(item=><option value={item.id} key={item.id}>{item.displayName}{item.current?' · bu cihaz':''}</option>)}</select></label><label>Bilinen kaynak sürümü <small>(isteğe bağlı)</small><input type="number" min={0} step={1} value={knownSourceVersion} onChange={event=>setKnownSourceVersion(event.target.value)}/></label><div className="button-row"><Button tone="primary" disabled={Boolean(busy)||!companionDeviceId} onClick={()=>void createCompanion('read_only')}>Şifreli salt okunur kopya oluştur</Button><Button disabled={Boolean(busy)||!companionDeviceId} onClick={()=>void createCompanion('write')}>Yazma reddini doğrula</Button></div></>}{companionResult&&<StatusMessage tone={companionResult.status==='snapshot_ready'?'success':'warning'}>{companionResult.status==='snapshot_ready'?`Hazır · kaynak v${companionResult.sourceVersion} · ${companionResult.envelopeBytes} bayt · ağ teslimi yok`:`Reddedildi: ${companionResult.status} · güncel kaynak v${companionResult.currentSourceVersion} · uzak yazma kabul edilmez`}</StatusMessage>}{companionResult?.status==='snapshot_ready'&&<Button onClick={()=>void navigator.clipboard.writeText(companionResult.encryptedEnvelopeBase64Url)}>Şifreli envelope’u kopyala</Button>}{center.companionSnapshots.length===0?<EmptyState title="Companion snapshot yok" body="Üretilen metadata yalnız yerel merkezde listelenir; teslim sonucu iddia edilmez."/>:center.companionSnapshots.slice(0,6).map(item=><div className="identity-record" key={item.id}><div><strong>Kaynak v{item.sourceVersion} · Şema v{item.schemaVersion}</strong><small>{formatDate(item.generatedAt,{dateStyle:'short',timeStyle:'short'})} · {item.envelopeBytes} bayt · salt okunur</small></div></div>)}</section>
    </div>{busy&&<StatusMessage tone="info">İşlem sürüyor; ikinci gönderim kilitli ve retry kimliği korunuyor.</StatusMessage>}{message&&<StatusMessage>{message}</StatusMessage>}
  </section>;
  return localizeIdentityAccessNode(panel,language);
}

function SettingsSecurity({auth,accessibility,onAccessibilityChange,onFamilyDataChanged}:{auth:AuthStateView;accessibility:AccessibilityPreferences;onAccessibilityChange:(next:AccessibilityPreferences)=>void;onFamilyDataChanged:()=>Promise<void>}) {
  const [message,setMessage]=useState('');
  const [backupInspection,setBackupInspection]=useState<BackupInspectionView|null>(null);
  const [backupPassword,setBackupPassword]=useState('');
  const [backupPasswordConfirmation,setBackupPasswordConfirmation]=useState('');
  const [audit,setAudit]=useState<AuditEntryView[]>([]);
  const [auditIntegrity,setAuditIntegrity]=useState<AuditIntegrityView|null>(null);
  const [currentPassword,setCurrentPassword]=useState('');
  const [newPassword,setNewPassword]=useState('');
  const [twoFactor,setTwoFactor]=useState<TwoFactorSetupView|null>(null);
  const [twoFactorCode,setTwoFactorCode]=useState('');
  const [devices,setDevices]=useState<TrustedDeviceView[]>([]);
  const [privacyCenter,setPrivacyCenter]=useState<PrivacyControlCenterView|null>(null);
  const [liveLocationDuration,setLiveLocationDuration]=useState(60);
  const [lostDeviceId,setLostDeviceId]=useState('');
  const [lostDevicePassword,setLostDevicePassword]=useState('');
  const [lostDeviceCode,setLostDeviceCode]=useState('');
  const [lostDeviceConfirmation,setLostDeviceConfirmation]=useState('');
  const [deviceName,setDeviceName]=useState('Bu bilgisayar');
  const [deviceReauthorizationConfirmation,setDeviceReauthorizationConfirmation]=useState('');
  const [securityReceipt,setSecurityReceipt]=useState<SecurityEventReceiptView|null>(null);
  const [securityReceiptHistory,setSecurityReceiptHistory]=useState<SecurityEventReceiptArchiveItemView[]>([]);
  const [securityReceiptJson,setSecurityReceiptJson]=useState('');
  const [securityReceiptVerification,setSecurityReceiptVerification]=useState<SecurityEventReceiptVerificationView|null>(null);
  const [deviceReauthorized,setDeviceReauthorized]=useState(false);
  const [importPreview,setImportPreview]=useState<FamilyDataImportPreviewView|null>(null);
  const [importBatches,setImportBatches]=useState<FamilyDataImportBatchView[]>([]);
  const [importPassword,setImportPassword]=useState('');
  const [importCode,setImportCode]=useState('');
  const [importBusy,setImportBusy]=useState(false);

  const refreshImports=async()=>{if(window.pardus)setImportBatches(await window.pardus.listFamilyDataImports(20));};
  useEffect(()=>{
    if(window.pardus&&auth.authenticated)void Promise.all([window.pardus.listTrustedDevices().then(setDevices),window.pardus.getPrivacyControlCenter().then(setPrivacyCenter),window.pardus.listSecurityEventReceipts(20).then(setSecurityReceiptHistory),refreshImports()]);
  },[auth.authenticated]);

  const validateBackupPassword=(confirmationRequired:boolean):boolean=>{
    if(backupPassword.length<12){
      setMessage('Yedek parolası en az 12 karakter olmalıdır.');
      return false;
    }
    if(confirmationRequired&&backupPassword!==backupPasswordConfirmation){
      setMessage('Yedek parolaları eşleşmiyor.');
      return false;
    }
    return true;
  };

  const exportManagedBackup=async()=>{
    if(!window.pardus)return;
    const r=await window.pardus.exportBackup();
    setMessage(r.canceled?'Yedekleme iptal edildi.':`Cihaz korumalı tam yedek: ${r.filePath??''}`);
  };
  const exportFull=async()=>{
    if(!window.pardus||!validateBackupPassword(true))return;
    try{
      const r=await window.pardus.exportFullBackup({password:backupPassword});
      setMessage(r.canceled?'Yedekleme iptal edildi.':`Parola korumalı tam yedek: ${r.filePath??''}`);
      if(!r.canceled)setBackupPasswordConfirmation('');
    }catch(err){
      setMessage(err instanceof Error?err.message:'Tam yedek oluşturulamadı.');
    }
  };
  const inspectFull=async()=>{
    if(!window.pardus)return;
    try{
      const r=await window.pardus.inspectFullBackup(backupPassword?{password:backupPassword}:{});
      if(r.canceled){setMessage('Yedek incelemesi iptal edildi.');return;}
      setBackupInspection(r.inspection??null);
      setMessage(r.inspection?.recommendation??'Yedek incelendi.');
    }catch(err){
      setBackupInspection(null);
      setMessage(err instanceof Error?err.message:'Yedek incelenemedi.');
    }
  };
  const restoreFull=async()=>{
    if(!window.pardus)return;
    if(!confirm('Geri yükleme mevcut verilerin yerine yedekteki verileri koyacak. İşlem öncesi otomatik güvenlik yedeği alınır; tüm güvenilir cihaz kayıtları iptal edilir ve yeniden giriş gerekir. Devam edilsin mi?'))return;
    try{
      const r=await window.pardus.restoreFullBackup(backupPassword?{password:backupPassword}:{});
      setMessage(r.canceled?'Geri yükleme iptal edildi.':'Yedek geri yüklendi. Uygulama yeniden başlatılıyor; tüm cihaz güvenleri iptal edildiği için parola ve gerekiyorsa 2FA ile tekrar giriş istenecek.');
    }catch(err){
      setMessage(err instanceof Error?err.message:'Geri yükleme başarısız.');
    }
  };
  const changePassword=async(e:FormEvent)=>{e.preventDefault();try{if(!window.pardus)return;await window.pardus.changePassword({currentPassword,newPassword});setCurrentPassword('');setNewPassword('');setMessage('Parola başarıyla değiştirildi.');}catch(err){setMessage(err instanceof Error?err.message:'Parola değiştirilemedi.');}};
  const begin2fa=async()=>{try{if(window.pardus)setTwoFactor(await window.pardus.beginTwoFactorSetup());}catch(err){setMessage(err instanceof Error?err.message:'2FA başlatılamadı.');}};
  const enable2fa=async()=>{try{if(!window.pardus)return;await window.pardus.enableTwoFactor({code:twoFactorCode});setTwoFactor(null);setTwoFactorCode('');setMessage('İki aşamalı doğrulama etkinleştirildi. Kurtarma kodlarını güvenli yerde saklayın.');}catch(err){setMessage(err instanceof Error?err.message:'2FA etkinleştirilemedi.');}};
  const disable2fa=async()=>{try{if(!window.pardus)return;await window.pardus.disableTwoFactor({password:currentPassword,code:twoFactorCode});setTwoFactorCode('');setMessage('İki aşamalı doğrulama kapatıldı.');}catch(err){setMessage(err instanceof Error?err.message:'2FA kapatılamadı.');}};
  const trustDevice=async()=>{try{if(!window.pardus)return;setDevices(await window.pardus.trustCurrentDevice({password:currentPassword,code:twoFactorCode,displayName:deviceName.trim()||'Bu bilgisayar'}));setMessage('Bu cihaz güvenilir cihaz olarak kaydedildi.');}catch(err){setMessage(err instanceof Error?err.message:'Cihaz güvenilir olarak kaydedilemedi.');}};
  const reauthorizeDeviceAfterRecovery=async()=>{try{if(!window.pardus)return;const result=await window.pardus.reauthorizeCurrentDeviceAfterRecovery({password:currentPassword,code:twoFactorCode,confirmation:DEVICE_REAUTHORIZATION_CONFIRMATION,displayName:deviceName.trim()||'Bu bilgisayar'});setDevices(result.devices);setSecurityReceipt(result.receipt);setDeviceReauthorized(true);setDeviceReauthorizationConfirmation('');setCurrentPassword('');setTwoFactorCode('');setSecurityReceiptHistory(await window.pardus.listSecurityEventReceipts(20));setMessage(`Cihaz güvenlik dönemi ${result.receipt.securityEpoch} için yeniden yetkilendirildi. İmzalı güvenlik makbuzu oluşturuldu${result.receiptArchived?' ve yerel geçmişe kaydedildi':' ancak yerel geçmişe kaydedilemedi'}.`);}catch(err){setMessage(err instanceof Error?err.message:'Cihaz yeniden yetkilendirilemedi.');}};
  const revokeDevice=async(id:string)=>{if(window.pardus)setDevices(await window.pardus.revokeTrustedDevice(id));};
  const setLiveLocationConsent=async(status:'granted'|'revoked')=>{try{if(!window.pardus)return;setPrivacyCenter(await window.pardus.setLiveLocationConsent({status,explicitConsent:true,...(status==='granted'?{durationMinutes:liveLocationDuration}:{})}));setMessage(status==='granted'?'Canlı konum paylaşım yetkisi süreli olarak açıldı; bu uygulama konum iletimi yapmaz.':'Canlı konum paylaşım rızası derhal iptal edildi.');}catch(err){setMessage(err instanceof Error?err.message:'Rıza güncellenemedi.');}};
  const shutdownLostDevice=async()=>{try{if(!window.pardus||!lostDeviceId)return;const result=await window.pardus.shutdownLostDevice({trustedDeviceId:lostDeviceId,password:lostDevicePassword,...(lostDeviceCode.trim()?{code:lostDeviceCode.trim()}:{}),confirmation:'KAYIP CİHAZ YETKİLERİNİ KAPAT'});setMessage(`Yerel yetki kapatıldı: ${result.revokedTrustedDeviceCount} cihaz, ${result.revokedOfflineLeaseCount} kira ve ${result.revokedConsentCount} rıza. Uzaktan silme/MDM/ağ teslimi yapılmadı.`);setLostDevicePassword('');setLostDeviceCode('');setLostDeviceConfirmation('');globalThis.location.reload();}catch(err){setMessage(err instanceof Error?err.message:'Kayıp cihaz yetkileri kapatılamadı.');}};
  const refreshSecurityReceipts=async()=>{if(window.pardus)setSecurityReceiptHistory(await window.pardus.listSecurityEventReceipts(20));};
  const verifySecurityReceiptJson=async()=>{if(!window.pardus)return;const result=await window.pardus.verifySecurityEventReceipt(securityReceiptJson);setSecurityReceiptVerification(result);setMessage(result.message);};
  const loadAudit=async()=>{if(window.pardus)setAudit(await window.pardus.listAudit(25));};
  const verifyAudit=async()=>{if(window.pardus)setAuditIntegrity(await window.pardus.verifyAuditIntegrity());};
  const previewFamilyImport=async()=>{
    if(!window.pardus)return;
    setImportBusy(true);setMessage('');
    try{
      const result=await window.pardus.previewFamilyDataImport();
      if(result.canceled){setMessage('Aile verisi seçimi iptal edildi.');return;}
      setImportPreview(result.preview??null);
      setMessage(result.preview?.valid?'Dosya doğrulandı. Uygulanmadan önce özet ve uyarıları inceleyin.':'Dosya doğrulama hataları içeriyor; hiçbir kayıt uygulanmadı.');
    }catch(error){setImportPreview(null);setMessage(error instanceof Error?error.message:'Aile verisi ön izlemesi oluşturulamadı.');}
    finally{setImportBusy(false);}
  };
  const applyFamilyImport=async()=>{
    if(!window.pardus||!importPreview?.valid||!importPassword)return;
    if(!confirm(`${importPreview.totalCreateRecords} yeni kayıt oluşturulacak, ${importPreview.totalReuseRecords} mevcut kayıt yeniden kullanılacak. Devam edilsin mi?`))return;
    setImportBusy(true);setMessage('');
    try{
      const batch=await window.pardus.applyFamilyDataImport({previewId:importPreview.previewId,password:importPassword,...(importCode.trim()?{code:importCode.trim()}:{})});
      setImportPreview(null);setImportPassword('');setImportCode('');
      await Promise.all([refreshImports(),onFamilyDataChanged()]);
      setMessage(`Aile verisi atomik olarak uygulandı. ${batch.totalCreatedRecords} yeni, ${batch.totalReusedRecords} yeniden kullanılan kayıt.`);
    }catch(error){setMessage(error instanceof Error?error.message:'Aile verisi uygulanamadı; işlem geri alındı.');}
    finally{setImportBusy(false);}
  };
  const rollbackFamilyImport=async(batch:FamilyDataImportBatchView)=>{
    if(!window.pardus||!importPassword)return;
    if(!confirm(`${batch.sourceFileName} içe aktarması geri alınacak. Sonradan bu kayıtlara bağlanan veriler varsa işlem engellenecek. Devam edilsin mi?`))return;
    setImportBusy(true);setMessage('');
    try{
      const next=await window.pardus.rollbackFamilyDataImport({batchId:batch.id,password:importPassword,...(importCode.trim()?{code:importCode.trim()}:{})});
      setImportPassword('');setImportCode('');
      await Promise.all([refreshImports(),onFamilyDataChanged()]);
      setMessage(next.status==='rolled_back'?'İçe aktarma güvenli biçimde geri alındı.':`Geri alma engellendi: ${next.rollbackBlockers.join(' ')}`);
    }catch(error){setMessage(error instanceof Error?error.message:'İçe aktarma geri alınamadı.');}
    finally{setImportBusy(false);}
  };

  return <Surface className="security-center">
    <PrivacyOwnershipCenter/>
    <IdentityAccessCredentialCenter trustedDevices={devices}/>
    <SectionHeader eyebrow="Yerel koruma" title="Güvenlik ve yedekleme"/>
    <div className="button-row"><Button onClick={()=>globalThis.dispatchEvent(new CustomEvent('ppt-replay-intro'))}>Tanıtımı yeniden oynat</Button><Button onClick={()=>{const audioMuted=!accessibility.audioMuted;onAccessibilityChange({...accessibility,audioMuted});setMessage(audioMuted?'Marka ve anlatım sesi kapatıldı.':'Marka ve anlatım sesi açıldı.');}}>Marka ve anlatım sesini aç/kapat</Button></div>
    <p>Oturum: {auth.displayName??'Yönetici'} · 2FA {auth.twoFactorEnabled?'açık':'kapalı'}</p>
    <section className="privacy-control-center">
      <h3>Gizlilik, süreli rıza ve kayıp cihaz kapatma merkezi</h3>
      <p>Varsayılan kapalıdır. Bu merkez yalnız yerel yetki, oturum, çevrimdışı kira ve rıza kayıtlarını yönetir; uzaktan silme, MDM veya ağ üzerinden teslim garantisi vermez.</p>
      <div className="button-row"><label>Canlı konum rıza süresi (dakika)<input type="number" min={15} max={43200} value={liveLocationDuration} onChange={e=>setLiveLocationDuration(Number(e.target.value))}/></label><Button tone="primary" disabled={liveLocationDuration<15||liveLocationDuration>43200} onClick={()=>void setLiveLocationConsent('granted')}>Süreli rızayı aç</Button><Button tone="danger" onClick={()=>void setLiveLocationConsent('revoked')}>Derhal iptal et</Button></div>
      <p><strong>Gösterge:</strong> {privacyCenter?.liveLocationConsent.visibleActiveIndicator?'AKTİF':'KAPALI'} · {privacyCenter?.liveLocationConsent.effectiveStatus??'default_denied'}{privacyCenter?.liveLocationConsent.endsAt?` · ${formatDate(privacyCenter.liveLocationConsent.endsAt,{dateStyle:'short',timeStyle:'short'})} tarihinde otomatik kapanır`:''}</p>
      <h4>Kayıp cihaz yerel yetkilerini kapat</h4>
      <label>Hedef güvenilir cihaz<select value={lostDeviceId} onChange={e=>setLostDeviceId(e.target.value)}><option value="">Cihaz seçin</option>{devices.filter(device=>!device.revokedAt).map(device=><option key={device.id} value={device.id}>{device.displayName}{device.current?' (bu cihaz)':''}</option>)}</select></label>
      <label>Yerel parola<input type="password" autoComplete="current-password" maxLength={1024} value={lostDevicePassword} onChange={e=>setLostDevicePassword(e.target.value)}/></label><label>2FA / kurtarma kodu<input maxLength={256} value={lostDeviceCode} onChange={e=>setLostDeviceCode(e.target.value)}/></label><label>Onay ifadesi<input value={lostDeviceConfirmation} onChange={e=>setLostDeviceConfirmation(e.target.value)} placeholder="KAYIP CİHAZ YETKİLERİNİ KAPAT"/></label>
      <Button tone="danger" disabled={!lostDeviceId||!lostDevicePassword||lostDeviceConfirmation!=='KAYIP CİHAZ YETKİLERİNİ KAPAT'} onClick={()=>void shutdownLostDevice()}>Tüm yerel cihaz güvenlerini, kiraları ve rızaları kapat</Button>
    </section>
    <div className="security-grid">
      <section>
        <h3>Yedekleme</h3>
        <p>Yeni tam yedekler AES-256-GCM ile parola korumalı v3 kapsayıcısında oluşturulur.</p>
        <label>Yedek parolası
          <input type="password" minLength={12} maxLength={1024} autoComplete="new-password" value={backupPassword} onChange={e=>setBackupPassword(e.target.value)} placeholder="En az 12 karakter"/>
        </label>
        <label>Yedek parolası tekrar
          <input type="password" minLength={12} maxLength={1024} autoComplete="new-password" value={backupPasswordConfirmation} onChange={e=>setBackupPasswordConfirmation(e.target.value)} placeholder="Yeni yedek oluştururken doğrulayın"/>
        </label>
        <small>Bu parola uygulama hesabı parolasından bağımsızdır. Parola kaybedilirse yedek açılamaz.</small>
        <div className="button-row">
          <Button tone="primary" onClick={()=>void exportFull()}>Parola korumalı tam yedek</Button>
          <Button onClick={()=>void exportManagedBackup()}>Cihaz korumalı tam yedek</Button>
          <Button onClick={()=>void inspectFull()}>Yedeği incele</Button>
          <Button onClick={()=>void restoreFull()}>Geri yükle</Button>
        </div>
      </section>
      <section className="family-import-panel">
        <h3>Aile verisi içe aktarma</h3>
        <p>JSON dosyası önce yalnız okunur ön izlemeye alınır. Şema, referanslar, dosya özeti ve çakışma planı yeniden doğrulanmadan veritabanına yazılmaz.</p>
        <div className="button-row"><Button onClick={()=>void previewFamilyImport()} disabled={importBusy}>{importBusy?'İşleniyor…':'JSON seç ve ön izle'}</Button><Button onClick={()=>void refreshImports()} disabled={importBusy}>Geçmişi yenile</Button></div>
        {importPreview&&<div className={`family-import-preview ${importPreview.valid?'valid':'invalid'}`}>
          <div className="family-import-heading"><div><strong>{importPreview.fileName}</strong><small>{(importPreview.fileSizeBytes/1048576).toFixed(2)} MB · SHA-256 {importPreview.sha256.slice(0,16)}…</small></div><span>{importPreview.valid?'Doğrulandı':'Engellendi'}</span></div>
          <div className="family-import-totals"><div><strong>{importPreview.totalSourceRecords}</strong><small>kaynak kayıt</small></div><div><strong>{importPreview.totalCreateRecords}</strong><small>yeni kayıt</small></div><div><strong>{importPreview.totalReuseRecords}</strong><small>yeniden kullanım</small></div></div>
          <small>{importPreview.sourceFamilyName} → {importPreview.targetFamilyName} · Ön izleme sonu {formatDate(importPreview.expiresAt,{dateStyle:'short',timeStyle:'short'})}</small>
          <div className="family-import-entities">{importPreview.entities.map(entity=><div key={entity.entityType}><strong>{entity.entityType==='person'?'Kişiler':entity.entityType==='relation'?'Aile bağları':entity.entityType==='location'?'Konumlar':'Etkinlikler'}</strong><small>{entity.sourceCount} kaynak · {entity.createCount} yeni · {entity.reuseCount} eşleşen · {entity.skipCount} atlanan</small></div>)}</div>
          {importPreview.issues.length>0&&<div className="family-import-issues">{importPreview.issues.slice(0,12).map((item,index)=><small className={item.severity} key={`${item.code}-${index}`}>{item.severity==='error'?'!':'△'} {item.path?`${item.path}: `:''}{item.message}</small>)}</div>}
          {importPreview.valid&&<><label>Yönetici parolası<input type="password" autoComplete="current-password" value={importPassword} onChange={event=>setImportPassword(event.target.value)}/></label><label>2FA / kurtarma kodu<input value={importCode} onChange={event=>setImportCode(event.target.value)} placeholder={auth.twoFactorEnabled?'Gerekli':'Etkin değil'}/></label><Button tone="primary" disabled={importBusy||!importPassword} onClick={()=>void applyFamilyImport()}>Doğrula ve atomik uygula</Button></>}
        </div>}
        <div className="family-import-history"><h4>Son içe aktarmalar</h4>{importBatches.length===0?<small>Henüz içe aktarma yapılmadı.</small>:importBatches.slice(0,8).map(batch=><div className="family-import-batch" key={batch.id}><div><strong>{batch.sourceFileName}</strong><small>{formatDate(batch.appliedAt,{dateStyle:'short',timeStyle:'short'})} · {batch.totalCreatedRecords} yeni · {batch.totalReusedRecords} eşleşen</small><small>Durum: {batch.status==='applied'?'Uygulandı':batch.status==='rolled_back'?'Geri alındı':'Geri alma engellendi'} · SHA {batch.sourceSha256.slice(0,12)}…</small>{batch.rollbackBlockers.map(blocker=><small className="error" key={blocker}>{blocker}</small>)}</div>{batch.rollbackAvailable&&<Button tone="danger" disabled={importBusy||!importPassword} onClick={()=>void rollbackFamilyImport(batch)}>Geri al</Button>}</div>)}</div>
      </section>
      <section><h3>Parola ve 2FA</h3><form className="form-grid" onSubmit={(e)=>void changePassword(e)}><label>Mevcut parola<input type="password" value={currentPassword} onChange={e=>setCurrentPassword(e.target.value)} required /></label><label>Yeni parola<input type="password" minLength={12} value={newPassword} onChange={e=>setNewPassword(e.target.value)} required /></label><Button type="submit">Parolayı değiştir</Button></form><div className="button-row">{auth.twoFactorEnabled?<Button onClick={()=>void disable2fa()}>2FA kapat</Button>:<Button onClick={()=>void begin2fa()}>2FA kurulumu başlat</Button>}</div>{twoFactor&&<div className="notes-card"><small>Authenticator anahtarı: {twoFactor.secret}</small><small>Kurulum URI: {twoFactor.otpauthUri}</small><small>Kurtarma kodları: {twoFactor.recoveryCodes.join(' · ')}</small></div>}<label>2FA / kurtarma kodu<input value={twoFactorCode} onChange={e=>setTwoFactorCode(e.target.value)} /></label>{twoFactor&&<Button tone="primary" onClick={()=>void enable2fa()}>2FA’yı doğrula ve aç</Button>}</section>
      <section><h3>Güvenilir cihazlar</h3><p>Hesap güvenlik dönemi: <strong>{auth.securityEpoch??0}</strong> · Oturum dönemi: <strong>{auth.sessionSecurityEpoch??0}</strong></p><label>Cihaz adı<input value={deviceName} onChange={e=>setDeviceName(e.target.value)}/></label>{auth.deviceReauthorizationRequired&&!deviceReauthorized?<div className="notes-card"><strong>Kurtarma sonrası yeniden yetkilendirme gerekiyor</strong><small>Eski cihaz güveni yeni güvenlik dönemine taşınmaz. Parola, 2FA ve bu cihazın Ed25519 anahtar kanıtı yeniden doğrulanır.</small><label>Onay metni<input value={deviceReauthorizationConfirmation} onChange={e=>setDeviceReauthorizationConfirmation(e.target.value)} placeholder={DEVICE_REAUTHORIZATION_CONFIRMATION}/></label><Button tone="primary" onClick={()=>void reauthorizeDeviceAfterRecovery()} disabled={!canSubmitDeviceReauthorization({twoFactorEnabled:auth.twoFactorEnabled===true,password:currentPassword,code:twoFactorCode,confirmation:deviceReauthorizationConfirmation})}>Cihazı yeniden yetkilendir</Button></div>:<Button onClick={()=>void trustDevice()} disabled={!auth.twoFactorEnabled}>Bu cihazı güvenilir yap</Button>}{securityReceipt&&<div className="notes-card"><strong>İmzalı güvenlik olayı makbuzu</strong><small>Makbuz: {securityReceipt.receiptId}</small><small>Dönem: {securityReceipt.securityEpoch} · Olay: cihaz yeniden yetkilendirildi</small><small>Payload SHA-256: {securityReceipt.payloadSha256}</small><small>Ed25519 imza: {securityReceipt.signatureBase64.slice(0,48)}…</small><Button onClick={()=>void navigator.clipboard.writeText(JSON.stringify(securityReceipt,null,2))}>Makbuzu kopyala</Button></div>}{devices.map(device=><div className="list-row" key={device.id}><div><strong>{device.displayName}{device.current?' · Bu cihaz':''}</strong><small>Güvenlik dönemi: {device.securityEpoch} · Son kullanım: {formatDate(device.lastSeenAt,{dateStyle:'short',timeStyle:'short'})}</small></div>{!device.revokedAt&&<Button tone="danger" onClick={()=>void revokeDevice(device.id)}>Kaldır</Button>}</div>)}</section>
      <section className="security-receipt-history"><h3>Güvenlik makbuzları</h3><p>Kurtarma sonrası cihaz yeniden yetkilendirme makbuzları bu hesaba göre filtrelenir ve her açılışta Ed25519 imzası yeniden doğrulanır.</p>{auth.securityEpoch!==auth.sessionSecurityEpoch&&<StatusMessage tone="danger">Bu oturum eski güvenlik dönemine ait. Güvenlik geçmişine erişmeden önce yeniden giriş yapın.</StatusMessage>}<div className="button-row"><Button onClick={()=>void refreshSecurityReceipts()}>Geçmişi yenile</Button></div>{securityReceiptHistory.length===0?<small>Bu hesap için arşivlenmiş güvenlik makbuzu yok.</small>:securityReceiptHistory.map(item=><div className="list-row" key={item.receipt.receiptId}><div><strong>{item.verificationStatus==='valid'?'✓ Doğrulandı':'! Geçersiz'} · Dönem {item.receipt.securityEpoch}</strong><small>{formatDate(item.receipt.occurredAt,{dateStyle:'short',timeStyle:'short'})} · {item.receipt.receiptId}</small><small>Payload {item.receipt.payloadSha256.slice(0,24)}…</small></div><Button onClick={()=>void navigator.clipboard.writeText(JSON.stringify(item.receipt,null,2))}>Kopyala</Button></div>)}<label>Haricî makbuz JSON<textarea rows={6} value={securityReceiptJson} onChange={event=>setSecurityReceiptJson(event.target.value)} placeholder="Doğrulanacak güvenlik makbuzunu buraya yapıştırın"/></label><Button onClick={()=>void verifySecurityReceiptJson()} disabled={!securityReceiptJson.trim()}>Makbuzu doğrula</Button>{securityReceiptVerification&&<StatusMessage tone={securityReceiptVerification.valid?'success':'danger'}>{securityReceiptVerification.status} · {securityReceiptVerification.message}</StatusMessage>}</section>
      <section><h3>Denetim kaydı</h3><div className="button-row"><Button onClick={()=>void loadAudit()}>Kayıtları göster</Button><Button onClick={()=>void verifyAudit()}>Zinciri doğrula</Button></div>{auditIntegrity&&<StatusMessage tone={auditIntegrity.valid?'success':'danger'}>{auditIntegrity.valid?`Denetim zinciri sağlam · ${auditIntegrity.checkedEntries} kayıt`:`Denetim zinciri bozuk · ${auditIntegrity.firstInvalidEntryId??'bilinmeyen kayıt'}`}</StatusMessage>}{audit.slice(0,8).map(x=><small className="audit-line" key={x.id}>{formatDate(x.occurredAt,{dateStyle:'short',timeStyle:'short'})} · {x.action}</small>)}</section>
      <DataLifecycleSettings auth={auth}/>
      <section className="accessibility-settings" aria-labelledby="accessibility-settings-title"><h3 id="accessibility-settings-title">Erişilebilirlik ve görünüm merkezi</h3><p>Oturum açıldıktan sonra tercihleriniz kişisel, yetki kontrollü profilinizde saklanır. Bu cihazdaki yerel kopya yalnız giriş öncesi güvenli görünüm başlangıcıdır.</p><fieldset><legend>Hazır görünüm profili</legend><div className="accessibility-profile-grid">{([['youth','Genç'],['standard','Standart'],['senior','İleri yaş'],['low-vision','Düşük görme'],['caregiver','Bakım veren']] as const).map(([profile,label])=><Button key={profile} aria-pressed={accessibility.audienceProfile===profile} onClick={()=>onAccessibilityChange(applyAccessibilityProfile(profile,{highContrast:globalThis.matchMedia?.('(prefers-contrast: more)').matches??false,reduceMotion:globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches??false}))}>{label}</Button>)}</div></fieldset><label>Metin görünümü<select value={accessibility.textScale} onChange={event=>{const textScale=event.target.value as AccessibilityPreferences['textScale'];onAccessibilityChange({...accessibility,textScale,textScalePercent:textScale==='standard'?100:textScale==='large'?150:200});}}><option value="standard">Normal</option><option value="large">Büyük</option><option value="extra-large">Çok büyük</option></select></label><label htmlFor="accessibility-scale">Özel metin ölçeği: %{accessibility.textScalePercent}<input id="accessibility-scale" type="range" min="100" max="225" step="5" value={accessibility.textScalePercent} onChange={event=>{const textScalePercent=Number(event.target.value);onAccessibilityChange({...accessibility,textScalePercent,textScale:textScalePercent<=110?'standard':textScalePercent<=175?'large':'extra-large'});}}/><output htmlFor="accessibility-scale" aria-live="polite">%{accessibility.textScalePercent} · 100–225 aralığı</output></label><label>Tema<select value={accessibility.theme} onChange={event=>onAccessibilityChange({...accessibility,theme:event.target.value as AccessibilityPreferences['theme']})}><option value="system">Windows tercihini izle</option><option value="light">Açık teal/gold</option><option value="dark">Koyu</option></select></label><label>Bilgi yoğunluğu<select value={accessibility.density} onChange={event=>onAccessibilityChange({...accessibility,density:event.target.value as AccessibilityPreferences['density']})}><option value="comfortable">Rahat</option><option value="standard">Standart</option><option value="compact">Kompakt — bilgi saklanmaz</option></select></label><label>Okuma biçimi<select value={accessibility.readingMode} onChange={event=>onAccessibilityChange({...accessibility,readingMode:event.target.value as AccessibilityPreferences['readingMode']})}><option value="standard">Standart</option><option value="easy-read">Kolay Okuma · sade ve adımlı</option></select></label><label className="toggle-row"><input type="checkbox" checked={accessibility.highContrast} onChange={event=>onAccessibilityChange({...accessibility,highContrast:event.target.checked})}/><span><strong>Yüksek kontrast</strong><small>Metin, kenarlık, odak ve durumları yalnız renge bağlı kalmadan belirginleştirir.</small></span></label><label className="toggle-row"><input type="checkbox" checked={accessibility.reduceMotion} onChange={event=>onAccessibilityChange({...accessibility,reduceMotion:event.target.checked})}/><span><strong>Hareketi azalt</strong><small>Geçişleri ve dekoratif hareketleri kapatır; işlem içeriğini kaldırmaz.</small></span></label><label className="toggle-row"><input type="checkbox" checked={accessibility.captionsEnabled} onChange={event=>onAccessibilityChange({...accessibility,captionsEnabled:event.target.checked})}/><span><strong>Altyazı ve yazılı alternatif</strong><small>Sesli anlatım bulunan yüzeylerde metin eşleniğini görünür tutar.</small></span></label><label className="toggle-row"><input type="checkbox" checked={accessibility.audioMuted} onChange={event=>onAccessibilityChange({...accessibility,audioMuted:event.target.checked})}/><span><strong>Uygulama seslerini kapat</strong><small>Ses kapansa da görsel durum ve yazılı açıklama korunur; anlatım yeniden oynatılabilir.</small></span></label><div className="notes-card"><strong>Klavye ve büyüteç sözleşmesi</strong><small>Tab sırası, görünür odak, Escape ile kapanış, odağın geri dönmesi, en az 44 px hedef ve küçük pencerede tek sütun reflow tüm profillerde etkindir.</small></div></section>
    </div>
    {backupInspection&&<div className="backup-inspection"><strong>{backupInspection.legacy?'Eski açık yedek biçimi':'Parola korumalı yedek doğrulandı'} · v{backupInspection.formatVersion}</strong><small>{backupInspection.archiveCount} arşiv girdisi · {(backupInspection.fileBytes/1048576).toFixed(1)} MB · Risk: {backupInspection.riskLevel==='low'?'Düşük':'Dikkat'}</small>{backupInspection.checks.map(check=><small key={check.code}>{check.valid?'✓':'!'} {check.label}: {check.detail}</small>)}</div>}
    {message&&<StatusMessage>{message}</StatusMessage>}
  </Surface>;
}

const relationshipCategoryLabels: Record<FamilyRelationshipCategory,string> = {
  core:'Çekirdek aile', ancestor:'Üst soy', descendant:'Alt soy', sibling:'Kardeşler', extended:'Geniş aile', in_law:'Evlilik yoluyla aile', care:'Vasi ve bakım', other:'Diğer'
};

export function AddMemberModal({ fallbackPeople = [], onClose, onSave }: { fallbackPeople?: readonly FamilyMemberView[]; onClose: () => void; onSave: (input: CreateFamilyMemberInput) => Promise<void> }) {
  const {language}=useLocalization();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [relationshipCode,setRelationshipCode]=useState<FamilyRelationshipCode>('child');
  const [referencePersonId,setReferencePersonId]=useState(fallbackPeople[0]?.id??'');
  const relationship=getFamilyRelationship(relationshipCode);
  const categories=useMemo(()=>Array.from(new Set(FAMILY_RELATIONSHIP_CATALOG.map(item=>item.category))),[]);
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); setBusy(true); setError('');
    const data = new FormData(event.currentTarget);
    try {
      const birthDate = String(data.get('birthDate') ?? '').trim();
      const customRelationshipLabel=String(data.get('customRelationshipLabel')??'').trim();
      if(relationship?.referenceRequired&&!referencePersonId)throw new Error('Bu yakınlık için kime göre olduğu seçilmelidir.');
      await onSave({
        displayName: String(data.get('displayName') ?? ''),
        ...(birthDate ? { birthDate } : {}),
        relationshipType: relationshipCode==='other'?(customRelationshipLabel||'Diğer'):(relationship?.label??'Aile üyesi'),
        relationshipCode,
        ...(referencePersonId?{referencePersonId}:{}),
        ...(customRelationshipLabel?{customRelationshipLabel}:{}),
        generation: Number(data.get('generation') ?? 1),
        branch: String(data.get('branch') ?? '')
      });
      onClose();
    } catch (caught) { setError(caught instanceof Error ? caught.message : 'Kayıt oluşturulamadı.'); }
    finally { setBusy(false); }
  };
  const panel=<Modal title="Yeni aile üyesi" subtitle="Hazır yakınlık kataloğundan seçim yapın; referans kişiye göre karşılıklı soy ağacı bağlantıları otomatik kurulsun." onClose={onClose}><form className="form-grid" onSubmit={(event) => void submit(event)}><label className="span-2">Ad soyad<input name="displayName" required minLength={2} placeholder="Ad ve soyad" /></label><label>Doğum tarihi<input name="birthDate" type="date" /></label><label>Yakınlık türü<select name="relationshipCode" value={relationshipCode} onChange={event=>setRelationshipCode(event.target.value as FamilyRelationshipCode)}>{categories.map(category=><optgroup key={category} label={relationshipCategoryLabels[category]}>{FAMILY_RELATIONSHIP_CATALOG.filter(item=>item.category===category).map(item=><option key={item.code} value={item.code}>{item.label}</option>)}</optgroup>)}</select></label>{relationshipCode==='other'&&<label className="span-2">Özel yakınlık adı<input name="customRelationshipLabel" required minLength={2} maxLength={80} placeholder="Örn. Aile büyüğü"/></label>}<PersonCatalogSelect label="Kime göre?" value={referencePersonId} onChange={setReferencePersonId} allowEmpty={!relationship?.referenceRequired} fallbackPeople={fallbackPeople}/><label>Nesil<select name="generation" defaultValue="4">{[1,2,3,4,5,6,7,8].map((value) => <option key={value}>{value}</option>)}</select></label><label className="span-2">Aile dalı<input name="branch" defaultValue="Ana Dal" /></label>{relationship&&referencePersonId&&<div className="relationship-preview span-2"><strong>Otomatik bağlantı</strong><small>Yeni kişi, seçilen kişiye göre “{relationship.label}” olarak kaydedilir. Ters yönde “{relationship.reciprocalLabel}” bağı oluşturulur.</small></div>}{error && <div className="form-error span-2">{error}</div>}<div className="modal-actions span-2"><Button type="button" onClick={onClose}>İptal</Button><Button type="submit" tone="primary" disabled={busy}>{busy ? 'Kaydediliyor…' : 'Üyeyi ve bağları kaydet'}</Button></div></form></Modal>;
  return localizeFamilyFormsNode(panel,language);
}

export function AddEventModal({ fallbackPeople = [], locations, onClose, onSave }: { fallbackPeople?: readonly FamilyMemberView[]; locations: FamilyAppSnapshot['locations']; onClose: () => void; onSave: (input: CreateFamilyEventInput) => Promise<void> }) {
  const {language}=useLocalization();
  const [busy, setBusy] = useState(false); const [error, setError] = useState(''); const [participants,setParticipants]=useState<string[]>([]);
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); setBusy(true); setError(''); const data = new FormData(event.currentTarget);
    const date = String(data.get('date')); const time = String(data.get('time') || '12:00');
    try {
      const description = String(data.get('description') ?? '').trim(); const locationLabel = String(data.get('locationLabel') ?? '').trim(); const invitationText = String(data.get('invitationText') ?? '').trim(); const notes = String(data.get('notes') ?? '').trim();
      await onSave({title:String(data.get('title')??''),...(description?{description}:{}),startAt:new Date(`${date}T${time}:00`).toISOString(),...(String(data.get('locationId')??'')?{locationId:String(data.get('locationId'))}:locationLabel?{locationLabel}:{}),visibility:'family',participantPersonIds:participants,...(invitationText?{invitationText}:{}),...(notes?{notes}:{}),aiProcessingAllowed:data.get('aiProcessingAllowed')==='on',recurrence:data.get('recurrence')==='yearly'?'yearly':'none',reminderDays:data.getAll('reminderDays').map(Number)}); onClose();
    } catch (caught) { setError(caught instanceof Error ? caught.message : 'Etkinlik oluşturulamadı.'); }
    finally { setBusy(false); }
  };
  const tomorrow = new Date(Date.now() + 86_400_000).toISOString().slice(0, 10);
  const panel=<Modal title="Önemli gün oluştur" subtitle="Katılımcılar tüm aile listesini yüklemeden arama destekli katalogdan seçilir." onClose={onClose}><form className="form-grid" onSubmit={(event)=>void submit(event)}><label className="span-2">Başlık<input name="title" required minLength={2} placeholder="Örn. Aile buluşması"/></label><label>Tarih<input name="date" type="date" required defaultValue={tomorrow}/></label><label>Saat<input name="time" type="time" defaultValue="14:00"/></label><label>Harita kaydı<select name="locationId" defaultValue=""><option value="">Kayıt seçilmedi</option>{locations.map(location=><option key={location.id} value={location.id}>{location.label}</option>)}</select></label><label>Serbest konum<input name="locationLabel" placeholder="Mekân, şehir veya adres"/></label><label className="span-2">Açıklama<textarea name="description" rows={2} placeholder="Etkinliğin kısa açıklaması"/></label><label className="span-2">Davetiye metni<textarea name="invitationText" rows={2} placeholder="Dijital davetiyede yer alacak metin"/></label><PersonCatalogMultiPicker selectedIds={participants} onChange={setParticipants} fallbackPeople={fallbackPeople}/><label>Tekrar<select name="recurrence" defaultValue="none"><option value="none">Tek sefer</option><option value="yearly">Her yıl</option></select></label><fieldset className="reminder-fieldset"><legend>Hatırlat</legend>{[30,14,7,1,0].map(day=><label key={day}><input type="checkbox" name="reminderDays" value={day} defaultChecked={[7,1].includes(day)}/>{day===0?'Aynı gün':`${day} gün önce`}</label>)}</fieldset><label className="span-2">Notlar ve anılar<textarea name="notes" rows={2} placeholder="Planlama notları, hediyeler veya anılar"/></label><label className="check-row span-2"><input type="checkbox" name="aiProcessingAllowed" defaultChecked/>Bu kaydın izinli yapay zekâ aramalarında kullanılmasına izin ver</label>{error&&<div className="form-error span-2">{error}</div>}<div className="modal-actions span-2"><Button type="button" onClick={onClose}>İptal</Button><Button type="submit" tone="primary" disabled={busy}>{busy?'Kaydediliyor…':'Önemli günü kaydet'}</Button></div></form></Modal>;
  return localizeFamilyFormsNode(panel,language);
}

export function EditEventModal({ event, fallbackPeople = [], locations, onClose, onSave }: { event: FamilyEventView; fallbackPeople?: readonly FamilyMemberView[]; locations: FamilyAppSnapshot['locations']; onClose: () => void; onSave: (input: UpdateFamilyEventInput) => Promise<void> }) {
  const {language}=useLocalization();
  const start = new Date(event.startAt);
  const localStart = new Date(start.getTime() - start.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
  const [title,setTitle]=useState(event.title);
  const [description,setDescription]=useState(event.description??'');
  const [startAt,setStartAt]=useState(localStart);
  const [locationId,setLocationId]=useState(event.locationId??'');
  const [locationLabel,setLocationLabel]=useState(event.locationId?'':event.locationLabel??'');
  const [visibility,setVisibility]=useState(event.visibility);
  const [participants,setParticipants]=useState<string[]>(event.participantPersonIds);
  const [invitationText,setInvitationText]=useState(event.invitationText??'');
  const [notes,setNotes]=useState(event.notes??'');
  const [aiAllowed,setAiAllowed]=useState(event.aiProcessingAllowed);
  const [recurrence,setRecurrence]=useState(event.recurrence);
  const [reminders,setReminders]=useState<number[]>(event.reminderDays);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');
  const toggleReminder=(day:number)=>setReminders((current)=>current.includes(day)?current.filter((value)=>value!==day):[...current,day].toSorted((a,b)=>b-a));
  const submit=async(formEvent:FormEvent<HTMLFormElement>)=>{
    formEvent.preventDefault(); setBusy(true); setError('');
    try{
      const selectedLocation=locations.find((location)=>location.id===locationId);
      await onSave({
        eventId:event.id,
        title:title.trim(),
        ...(description.trim()?{description:description.trim()}:{}),
        startAt:new Date(startAt).toISOString(),
        ...(selectedLocation?{locationId:selectedLocation.id,locationLabel:selectedLocation.label}:locationLabel.trim()?{locationLabel:locationLabel.trim()}:{}),
        visibility,
        participantPersonIds:participants,
        ...(invitationText.trim()?{invitationText:invitationText.trim()}:{}),
        ...(notes.trim()?{notes:notes.trim()}:{}),
        aiProcessingAllowed:aiAllowed,
        recurrence,
        reminderDays:reminders
      });
      onClose();
    }catch(caught){setError(caught instanceof Error?caught.message:'Olay güncellenemedi.');}
    finally{setBusy(false);}
  };
  const panel=<Modal title="Olayı düzenle" subtitle="Tarih, konum, gizlilik, katılımcı, davetiye ve hatırlatmaların tamamı güncellenir." onClose={onClose}>
    <form className="form-grid event-edit-form" onSubmit={(formEvent)=>void submit(formEvent)}>
      <label className="span-2">Başlık<input required minLength={2} maxLength={200} value={title} onChange={(input)=>setTitle(input.target.value)}/></label>
      <label className="span-2">Tarih ve saat<input required type="datetime-local" value={startAt} onChange={(input)=>setStartAt(input.target.value)}/></label>
      <label>Harita kaydı<select value={locationId} onChange={(input)=>{setLocationId(input.target.value);if(input.target.value)setLocationLabel('');}}><option value="">Kayıt seçilmedi</option>{locations.map((location)=><option key={location.id} value={location.id}>{location.label}</option>)}</select></label>
      <label>Serbest konum<input value={locationLabel} disabled={Boolean(locationId)} onChange={(input)=>setLocationLabel(input.target.value)} placeholder={locationId?'Harita kaydı kullanılıyor':'Mekân, şehir veya adres'}/></label>
      <label className="span-2">Açıklama<textarea rows={3} maxLength={4000} value={description} onChange={(input)=>setDescription(input.target.value)}/></label>
      <label>Gizlilik<select value={visibility} onChange={(input)=>setVisibility(input.target.value as FamilyEventView['visibility'])}><option value="family">Tüm aile</option><option value="selected_members">Seçili üyeler</option><option value="personal">Kişisel</option></select></label>
      <label>Tekrar<select value={recurrence} onChange={(input)=>setRecurrence(input.target.value as FamilyEventView['recurrence'])}><option value="none">Tek sefer</option><option value="yearly">Her yıl</option></select></label>
      <PersonCatalogMultiPicker selectedIds={participants} onChange={setParticipants} fallbackPeople={fallbackPeople}/>
      <fieldset className="span-2 reminder-fieldset horizontal"><legend>Hatırlatmalar</legend>{[30,14,7,1,0].map((day)=><label key={day}><input type="checkbox" checked={reminders.includes(day)} onChange={()=>toggleReminder(day)}/>{day===0?'Aynı gün':`${day} gün önce`}</label>)}</fieldset>
      <label className="span-2">Davetiye metni<textarea rows={3} maxLength={4000} value={invitationText} onChange={(input)=>setInvitationText(input.target.value)}/></label>
      <label className="span-2">Notlar ve anılar<textarea rows={4} maxLength={8000} value={notes} onChange={(input)=>setNotes(input.target.value)}/></label>
      <label className="check-row span-2"><input type="checkbox" checked={aiAllowed} onChange={(input)=>setAiAllowed(input.target.checked)}/>Bu kaydın izinli yapay zekâ aramalarında kullanılmasına izin ver</label>
      {error&&<div className="form-error span-2">{error}</div>}
      <div className="modal-actions span-2"><Button type="button" onClick={onClose}>İptal</Button><Button type="submit" tone="primary" disabled={busy||title.trim().length<2||!startAt}>{busy?'Kaydediliyor…':'Tüm değişiklikleri kaydet'}</Button></div>
    </form>
  </Modal>;
  return localizeFamilyFormsNode(panel,language);
}


export function AddLocationModal({ onClose, onSave }: { onClose: () => void; onSave: (input: CreateFamilyLocationInput) => Promise<void> }) {
  const {language}=useLocalization();
  const [busy, setBusy] = useState(false); const [error, setError] = useState('');
  const submit = async (event: FormEvent<HTMLFormElement>) => { event.preventDefault(); setBusy(true); setError(''); const data = new FormData(event.currentTarget); try { const latitude = String(data.get('latitude') ?? '').trim(); const longitude = String(data.get('longitude') ?? '').trim(); const address = String(data.get('address') ?? '').trim(); await onSave({ label: String(data.get('label') ?? ''), ...(address ? { address } : {}), ...(latitude ? { latitude: Number(latitude) } : {}), ...(longitude ? { longitude: Number(longitude) } : {}), kind: String(data.get('kind') ?? 'other') as CreateFamilyLocationInput['kind'] }); onClose(); } catch (caught) { setError(caught instanceof Error ? caught.message : 'Konum kaydedilemedi.'); } finally { setBusy(false); } };
  const panel=<Modal title="Yeni konum" subtitle="Etkinlikler ve aile coğrafi hafızası için harita kaydı oluşturun." onClose={onClose}><form className="form-grid" onSubmit={(event) => void submit(event)}><label className="span-2">Konum adı<input name="label" required minLength={2} placeholder="Örn. Sakarya Aile Evi" /></label><label className="span-2">Adres<input name="address" placeholder="Adres veya açıklama" /></label><label>Enlem<input name="latitude" type="number" step="any" /></label><label>Boylam<input name="longitude" type="number" step="any" /></label><label className="span-2">Tür<select name="kind"><option value="venue">Etkinlik yeri</option><option value="residence">İkamet</option><option value="memory">Anı yeri</option><option value="other">Diğer</option></select></label>{error && <div className="form-error span-2">{error}</div>}<div className="modal-actions span-2"><Button type="button" onClick={onClose}>İptal</Button><Button type="submit" tone="primary" disabled={busy}>{busy ? 'Kaydediliyor…' : 'Konumu kaydet'}</Button></div></form></Modal>;
  return localizeFamilyFormsNode(panel,language);
}

export function LocationScreen({ snapshot, onAdd, onAcknowledge }: { snapshot: FamilyAppSnapshot; onAdd: () => void; onAcknowledge: (notificationId:string) => Promise<void> }) {
  const {language}=useLocalization();
  const activeNotifications = snapshot.notifications.filter((item) => !item.acknowledgedAt);
  const panel=<><PageHeader eyebrow="Aile coğrafi hafızası" title="Konum ve harita" description="Etkinlik yerlerini, ikametleri ve aile anı noktalarını yalnız bu cihazda görüntüleyin." actions={<Button tone="primary" onClick={onAdd}>＋ Konum ekle</Button>} /><FamilyLocationMap locations={snapshot.locations} /><section className="workspace-grid family-location-support-grid"><article className="panel workspace-form"><span className="eyebrow">{snapshot.locations.length} konum</span><h2>Kayıtlı yerler</h2>{snapshot.locations.length ? snapshot.locations.map((location) => <div className="summary-row" key={location.id}><span>⌖</span><strong>{location.label}</strong><i>{location.address ?? (location.latitude !== undefined && location.longitude !== undefined ? `${location.latitude.toFixed(5)}, ${location.longitude.toFixed(5)}` : location.kind)}</i></div>) : <EmptyState title="Kayıtlı konum yok" body="Haritada göstermek için ilk aile konumunu ekleyin." />}</article><article className="panel workspace-summary"><span className="eyebrow">{activeNotifications.length} bekleyen hatırlatma</span><h2>Bildirim merkezi</h2>{activeNotifications.length ? activeNotifications.map((item) => <div className="context-stat" key={item.id}><strong>{item.body}</strong><span>{item.title}</span><Button onClick={()=>void onAcknowledge(item.id)}>Okundu işaretle</Button></div>) : <EmptyState title="Hatırlatma yok" body="Yaklaşan veya okunmamış önemli gün bildirimi bulunmuyor." />}</article></section></>;
  return localizeFamilyFormsNode(panel,language);
}

const localProfileIdentity=(displayName:string):string=>{
  const handle=displayName.trim().toLocaleLowerCase('tr-TR').normalize('NFKD').replace(/[\u0300-\u036f]/gu,'').replace(/ı/gu,'i').replace(/[^a-z0-9]+/gu,'.').replace(/^\.+|\.+$/gu,'');
  return `${handle||'aile-uyesi'}.${Date.now().toString(36)}@local.pardus`;
};

export function HouseholdMembershipScreen({people,workspace,onChanged}:{people:FamilyMemberView[];workspace:HouseholdMembershipWorkspaceView;onChanged:()=>Promise<void>}){
  const {language}=useLocalization();
  const [householdName,setHouseholdName]=useState('');
  const [householdKind,setHouseholdKind]=useState<HouseholdKind>('primary');
  const [branchName,setBranchName]=useState('');
  const [branchHouseholdId,setBranchHouseholdId]=useState('');
  const [personId,setPersonId]=useState('');
  const [membershipHouseholdId,setMembershipHouseholdId]=useState('');
  const [familyBranchId,setFamilyBranchId]=useState('');
  const [role,setRole]=useState<PersonMembershipRole>('resident');
  const [validFrom,setValidFrom]=useState(()=>new Date().toISOString().slice(0,10));
  const [message,setMessage]=useState('');
  const [tone,setTone]=useState<'success'|'danger'>('success');
  const [busy,setBusy]=useState(false);
  const run=async(operation:()=>Promise<unknown>,success:string)=>{setBusy(true);setMessage('');try{await operation();await onChanged();setTone('success');setMessage(success);}catch(error){setTone('danger');setMessage(error instanceof Error?error.message:'İşlem tamamlanamadı.');}finally{setBusy(false);}};
  const createHousehold=async(event:FormEvent)=>{event.preventDefault();if(!window.pardus)return;await run(()=>window.pardus!.createHousehold({name:householdName,kind:householdKind}), 'Hane oluşturuldu.');setHouseholdName('');};
  const createBranch=async(event:FormEvent)=>{event.preventDefault();if(!window.pardus)return;const householdId=branchHouseholdId||workspace.households[0]?.id;const command={name:branchName,...(householdId?{householdId}: {})} as CreateFamilyBranchInput;await run(()=>window.pardus!.createFamilyBranch(command), 'Aile dalı oluşturuldu.');setBranchName('');};
  const assignMembership=async(event:FormEvent)=>{event.preventDefault();if(!window.pardus)return;const selectedPersonId=personId||people[0]?.id;const householdId=membershipHouseholdId||workspace.households[0]?.id;if(!selectedPersonId||!householdId){setTone('danger');setMessage('Kişi ve hane seçilmelidir.');return;}const command={personId:selectedPersonId,householdId,...(familyBranchId?{familyBranchId}:{}),role,validFrom:`${validFrom}T00:00:00.000Z`} as AssignPersonMembershipInput;await run(()=>window.pardus!.assignPersonMembership(command),'Kişi üyeliği kaydedildi.');};
  const endMembership=async(membershipId:string)=>{if(!window.pardus)return;await run(()=>window.pardus!.endPersonMembership({membershipId,endedAt:new Date().toISOString()}),'Üyelik geçmişe alınarak sonlandırıldı.');};
  const householdNameOf=(id:string)=>workspace.households.find(item=>item.id===id)?.name??'Bilinmeyen hane';
  const branchNameOf=(id?:string)=>id?workspace.branches.find(item=>item.id===id)?.name??'Bilinmeyen dal':'Dal seçilmedi';
  const personNameOf=(id:string)=>people.find(item=>item.id===id)?.displayName??'Bilinmeyen kişi';
  const panel=<><PageHeader eyebrow="Temel veri modeli" title="Haneler ve aile dalları" description="Kişilerin birden fazla haneye ve aile dalına tarihçeli, yetkili biçimde bağlanmasını yönetin."/><section className="workspace-grid"><Surface className="workspace-form"><SectionHeader eyebrow="Yeni kayıt" title="Hane ve dal oluştur"/><form className="form-grid" onSubmit={createHousehold}><label>Hane adı<input value={householdName} onChange={event=>setHouseholdName(event.target.value)} minLength={2} required/></label><label>Hane türü<select value={householdKind} onChange={event=>setHouseholdKind(event.target.value as HouseholdKind)}><option value="primary">Ana hane</option><option value="shared">Paylaşımlı hane</option><option value="extended">Geniş aile</option><option value="other">Diğer</option></select></label><Button type="submit" tone="primary" disabled={busy||householdName.trim().length<2}>Hane oluştur</Button></form><hr/><form className="form-grid" onSubmit={createBranch}><label>Dal adı<input value={branchName} onChange={event=>setBranchName(event.target.value)} minLength={2} required/></label><label>Bağlı hane<select value={branchHouseholdId} onChange={event=>setBranchHouseholdId(event.target.value)}><option value="">İlk etkin hane</option>{workspace.households.filter(item=>item.status==='active').map(item=><option key={item.id} value={item.id}>{item.name}</option>)}</select></label><Button type="submit" disabled={busy||branchName.trim().length<2||workspace.households.length===0}>Aile dalı oluştur</Button></form>{message&&<StatusMessage tone={tone}>{message}</StatusMessage>}</Surface><Surface className="workspace-summary"><SectionHeader eyebrow="Tarihçeli bağ" title="Kişiyi haneye ata"/><form className="form-grid" onSubmit={assignMembership}><label>Kişi<select value={personId} onChange={event=>setPersonId(event.target.value)}><option value="">İlk aile üyesi</option>{people.map(item=><option key={item.id} value={item.id}>{item.displayName}</option>)}</select></label><label>Hane<select value={membershipHouseholdId} onChange={event=>{setMembershipHouseholdId(event.target.value);setFamilyBranchId('');}}><option value="">İlk etkin hane</option>{workspace.households.filter(item=>item.status==='active').map(item=><option key={item.id} value={item.id}>{item.name}</option>)}</select></label><label>Aile dalı<select value={familyBranchId} onChange={event=>setFamilyBranchId(event.target.value)}><option value="">Dal yok</option>{workspace.branches.filter(item=>item.status==='active'&&(!item.householdId||item.householdId===(membershipHouseholdId||workspace.households[0]?.id))).map(item=><option key={item.id} value={item.id}>{item.name}</option>)}</select></label><label>Rol<select value={role} onChange={event=>setRole(event.target.value as PersonMembershipRole)}><option value="resident">İkamet eden</option><option value="member">Üye</option><option value="guardian">Vasi</option><option value="dependent">Bağımlı</option><option value="other">Diğer</option></select></label><label>Başlangıç<input type="date" value={validFrom} onChange={event=>setValidFrom(event.target.value)} required/></label><Button type="submit" tone="primary" disabled={busy||people.length===0||workspace.households.length===0}>Üyelik ata</Button></form></Surface><Surface className="span-2"><SectionHeader eyebrow="Güncel yapı" title={`${workspace.households.length} hane · ${workspace.branches.length} dal · ${workspace.memberships.length} üyelik`}/><div className="stack-list">{workspace.memberships.length===0?<EmptyState title="Üyelik kaydı yok" body="Bir kişiyi haneye atadığınızda tarihçe burada görünür."/>:workspace.memberships.map(item=><div className="list-row" key={item.id}><div><strong>{personNameOf(item.personId)} · {householdNameOf(item.householdId)}</strong><small>{branchNameOf(item.familyBranchId)} · {item.role} · {formatDate(item.validFrom)}{item.validUntil?` — ${formatDate(item.validUntil)}`:' — devam ediyor'}</small></div>{item.status==='active'&&<Button tone="danger" onClick={()=>void endMembership(item.id)} disabled={busy}>Üyeliği bitir</Button>}</div>)}</div></Surface></section></>;
  return localizeHouseholdLifecycleNode(panel,language);
}

export function PersonLifecycleScreen({people,onChanged}:{people:FamilyMemberView[];onChanged:()=>Promise<void>}){
  const {language}=useLocalization();
  const [selectedPersonId,setSelectedPersonId]=useState(people[0]?.id??'');
  const [workspace,setWorkspace]=useState<PersonLifecycleWorkspaceView>();
  const [displayName,setDisplayName]=useState('');
  const [birthDate,setBirthDate]=useState('');
  const [relationshipType,setRelationshipType]=useState('');
  const [generation,setGeneration]=useState(1);
  const [branch,setBranch]=useState('');
  const [reason,setReason]=useState('');
  const [mergeTargetId,setMergeTargetId]=useState('');
  const [confirmationText,setConfirmationText]=useState('');
  const [busy,setBusy]=useState(false);
  const [loading,setLoading]=useState(false);
  const [message,setMessage]=useState('');
  const [tone,setTone]=useState<'success'|'danger'>('success');

  const applyWorkspace=(next:PersonLifecycleWorkspaceView)=>{
    setWorkspace(next);
    setDisplayName(next.profile.displayName);
    setBirthDate(next.profile.birthDate??'');
    setRelationshipType(next.profile.relationshipType);
    setGeneration(next.profile.generation);
    setBranch(next.profile.branch);
  };
  const loadWorkspace=async(personId:string)=>{
    if(!window.pardus||!personId){setWorkspace(undefined);return;}
    setLoading(true);
    try{applyWorkspace(await window.pardus.getPersonLifecycleWorkspace(personId));}
    catch(error){setWorkspace(undefined);setTone('danger');setMessage(error instanceof Error?error.message:'Kişi profili yüklenemedi.');}
    finally{setLoading(false);}
  };
  useEffect(()=>{
    if(selectedPersonId&&people.some(person=>person.id===selectedPersonId))return;
    setSelectedPersonId(people[0]?.id??'');
  },[people,selectedPersonId]);
  useEffect(()=>{setMessage('');void loadWorkspace(selectedPersonId);},[selectedPersonId]);

  const run=async(operation:()=>Promise<unknown>,success:string)=>{
    if(!selectedPersonId)return;
    setBusy(true);setMessage('');
    try{await operation();await onChanged();await loadWorkspace(selectedPersonId);setTone('success');setMessage(success);setReason('');setConfirmationText('');}
    catch(error){setTone('danger');setMessage(error instanceof Error?error.message:'Kişi profili işlemi tamamlanamadı.');}
    finally{setBusy(false);}
  };
  const update=async(event:FormEvent)=>{
    event.preventDefault();if(!window.pardus||!workspace)return;
    const command={personId:workspace.profile.id,expectedVersion:workspace.profile.lifecycleVersion,displayName,...(birthDate?{birthDate}:{}),relationshipType,generation,branch} as UpdatePersonProfileInput;
    await run(()=>window.pardus!.updatePersonProfile(command),'Kişi profili ve sürüm tarihçesi güncellendi.');
  };
  const archive=async()=>{if(!window.pardus||!workspace)return;await run(()=>window.pardus!.archivePersonProfile({personId:workspace.profile.id,expectedVersion:workspace.profile.lifecycleVersion,reason}),'Kişi profili geri alınabilir biçimde arşivlendi.');};
  const merge=async()=>{
    if(!window.pardus||!workspace||!mergeTargetId)return;
    await run(async()=>{
      const target=await window.pardus!.getPersonLifecycleWorkspace(mergeTargetId);
      return window.pardus!.mergePersonProfiles({sourcePersonId:workspace.profile.id,targetPersonId:target.profile.id,expectedSourceVersion:workspace.profile.lifecycleVersion,expectedTargetVersion:target.profile.lifecycleVersion,conflictResolution:'KEEP_TARGET',reason});
    },'Kaynak profil hedef kişiye mantıksal olarak birleştirildi; referanslar korundu.');
  };
  const requestDeletion=async()=>{if(!window.pardus||!workspace)return;await run(()=>window.pardus!.requestSafePersonDeletion({personId:workspace.profile.id,expectedVersion:workspace.profile.lifecycleVersion,confirmationText,reason}),'Referanssız kişi profili güvenli silme kuyruğuna alındı.');};
  const undo=async(operationId:string)=>{if(!window.pardus)return;await run(()=>window.pardus!.undoPersonLifecycleOperation(operationId),'Son kişi profili işlemi geri alındı.');};
  const statusLabel=(status:PersonLifecycleWorkspaceView['profile']['status'])=>({active:'Etkin',inactive:'Etkin değil',deceased:'Vefat',archived:'Arşivlenmiş',merged:'Birleştirilmiş',pending_deletion:'Silme bekliyor'}[status]);
  const operationLabel=(type:PersonLifecycleWorkspaceView['operations'][number]['operationType'])=>({profile_updated:'Profil güncelleme',archived:'Arşivleme',merged:'Birleştirme',safe_delete_requested:'Güvenli silme isteği'}[type]);
  const activeTargets=people.filter(person=>person.id!==selectedPersonId&&person.status==='active');

  const panel=<><PageHeader eyebrow="B1-02 · yönetişimli yaşam döngüsü" title="Kişi profilleri" description="Düzenleme, mantıksal birleştirme, geri alınabilir arşivleme ve referans güvenli silme işlemlerini sürüm denetimiyle yönetin."/>
    <section className="workspace-grid">
      <Surface className="workspace-form"><SectionHeader eyebrow="Profil seçimi" title="Kayıt ve sürüm"/>
        <label>Kişi<select value={selectedPersonId} onChange={event=>setSelectedPersonId(event.target.value)}><option value="">Kişi seçin</option>{people.map(person=><option key={person.id} value={person.id}>{person.displayName}</option>)}</select></label>
        {loading?<div className="loading-screen"><div className="loader"/><strong>Profil yükleniyor…</strong></div>:workspace?<form className="form-grid" onSubmit={update}>
          <label className="span-2">Ad soyad<input required minLength={2} maxLength={120} value={displayName} onChange={event=>setDisplayName(event.target.value)}/></label>
          <label>Doğum tarihi<input type="date" value={birthDate} onChange={event=>setBirthDate(event.target.value)}/></label>
          <label>Yakınlık türü<input required minLength={2} maxLength={80} value={relationshipType} onChange={event=>setRelationshipType(event.target.value)}/></label>
          <label>Nesil<input type="number" min={1} max={20} value={generation} onChange={event=>setGeneration(Number(event.target.value))}/></label>
          <label>Aile dalı<input required minLength={2} maxLength={120} value={branch} onChange={event=>setBranch(event.target.value)}/></label>
          <Button type="submit" tone="primary" disabled={busy||workspace.profile.status==='merged'||workspace.profile.status==='pending_deletion'}>Profili güncelle</Button>
        </form>:<EmptyState title="Kişi seçilmedi" body="Yaşam döngüsü işlemleri için bir aile üyesi seçin."/>}
      </Surface>
      <Surface className="workspace-summary"><SectionHeader eyebrow="Korunan durum" title={workspace?`${statusLabel(workspace.profile.status)} · sürüm ${workspace.profile.lifecycleVersion}`:'Kişi durumu'}/>
        {workspace&&<><StatRow value={workspace.profile.displayName} label={`${workspace.profile.relationshipType} · ${workspace.profile.branch} · ${workspace.profile.generation}. nesil`}/><StatRow value={workspace.operations.length} label="Değiştirilemez işlem geçmişi"/>{workspace.profile.mergedIntoPersonId&&<StatRow value={people.find(person=>person.id===workspace.profile.mergedIntoPersonId)?.displayName??workspace.profile.mergedIntoPersonId} label="Birleştirme hedefi"/>}</>}
        <label>İşlem gerekçesi<textarea rows={3} minLength={5} maxLength={500} value={reason} onChange={event=>setReason(event.target.value)} placeholder="En az 5 karakter"/></label>
        <div className="modal-actions"><Button tone="danger" disabled={busy||!workspace||reason.trim().length<5||workspace.profile.status==='archived'||workspace.profile.status==='merged'||workspace.profile.status==='pending_deletion'} onClick={()=>void archive()}>Arşivle</Button></div>
        <hr/>
        <label>Birleştirme hedefi<select value={mergeTargetId} onChange={event=>setMergeTargetId(event.target.value)}><option value="">Etkin hedef kişi seçin</option>{activeTargets.map(person=><option key={person.id} value={person.id}>{person.displayName}</option>)}</select></label>
        <Button disabled={busy||!workspace||!mergeTargetId||reason.trim().length<5||workspace.profile.status==='merged'||workspace.profile.status==='pending_deletion'} onClick={()=>void merge()}>Hedefi koruyarak birleştir</Button>
        <hr/>
        <label>Güvenli silme onayı<input value={confirmationText} onChange={event=>setConfirmationText(event.target.value)} placeholder={workspace?.profile.displayName??'Kişi adını birebir yazın'}/></label>
        <Button tone="danger" disabled={busy||!workspace||confirmationText!==workspace.profile.displayName||reason.trim().length<5||workspace.profile.status==='merged'||workspace.profile.status==='pending_deletion'} onClick={()=>void requestDeletion()}>Referansları denetle ve silme iste</Button>
        {message&&<StatusMessage tone={tone}>{message}</StatusMessage>}
      </Surface>
      <Surface className="span-2"><SectionHeader eyebrow="Geri alınabilir kanıt zinciri" title={`${workspace?.operations.length??0} yaşam döngüsü işlemi`}/>
        {!workspace||workspace.operations.length===0?<EmptyState title="İşlem geçmişi yok" body="Profilde yapılan yönetişimli değişiklikler burada sürüm ve referans sayılarıyla görünür."/>:<div className="stack-list">{workspace.operations.map(operation=><div className="list-row" key={operation.id}><div><strong>{operationLabel(operation.operationType)} · {operation.status==='applied'?'Uygulandı':'Geri alındı'}</strong><small>{formatDate(operation.createdAt,{dateStyle:'medium',timeStyle:'short'})} · sürüm {operation.before.lifecycleVersion} → {operation.after.lifecycleVersion} · {operation.references.total} referans{operation.reason?` · ${operation.reason}`:''}</small></div>{operation.status==='applied'&&operation.after.lifecycleVersion===workspace.profile.lifecycleVersion&&<Button onClick={()=>void undo(operation.id)} disabled={busy}>Geri al</Button>}</div>)}</div>}
      </Surface>
    </section>
  </>;
  return localizeHouseholdLifecycleNode(panel,language);
}

export function InvitationsScreen({snapshot}:{snapshot:FamilyAppSnapshot}){
  const {language}=useLocalization();
  const [invitations,setInvitations]=useState<FamilyInvitationView[]>([]);
  const [profileName,setProfileName]=useState('');
  const [role,setRole]=useState<FamilyRole>('adult_member');
  const [personId,setPersonId]=useState('');
  const [startsOn,setStartsOn]=useState(()=>new Date().toISOString().slice(0,10));
  const [endsOn,setEndsOn]=useState(()=>new Date(Date.now()+7*24*60*60*1000).toISOString().slice(0,10));
  const [issuedToken,setIssuedToken]=useState('');
  const [message,setMessage]=useState('');
  const [messageTone,setMessageTone]=useState<'success'|'danger'>('success');
  const [busyId,setBusyId]=useState('');
  const [access,setAccess]=useState<'loading'|'allowed'|'denied'>('loading');
  const refresh=async()=>{if(!window.pardus)return;try{setInvitations(await window.pardus.listInvitations());setAccess('allowed');}catch(error){setAccess('denied');throw error;}};
  useEffect(()=>{void refresh().catch(error=>{setMessageTone('danger');setMessage(error instanceof Error?error.message:'Davetler yüklenemedi.');});},[]);
  if(access==='loading')return localizeHouseholdLifecycleNode(<div className="loading-screen"><div className="loader"/><strong>Davet yetkisi doğrulanıyor…</strong></div>,language);
  if(access==='denied')return localizeHouseholdLifecycleNode(<><PageHeader eyebrow="Aile profili güvenliği" title="Davetler" description="Davet yönetimi yalnızca yetkili aile yöneticisi tarafından kullanılabilir."/><EmptyState title="Yönetici yetkisi gerekli" body={message||'Aile profili davetlerini yalnız aile yöneticisi oluşturabilir ve yönetebilir.'}/></>,language);
  const create=async()=>{setMessage('');setIssuedToken('');if(!window.pardus)return;if(endsOn<startsOn){setMessageTone('danger');setMessage('Davet bitiş tarihi başlangıç tarihinden önce olamaz.');return;}setBusyId('create');try{const result=await window.pardus.createInvitation({email:localProfileIdentity(profileName),role,...(personId?{personId}:{}),startsAt:`${startsOn}T00:00:00.000Z`,endsAt:`${endsOn}T23:59:59.999Z`});setIssuedToken(result.token);setProfileName('');setMessageTone('success');setMessage('Davet oluşturuldu. Tek kullanımlık kodu şimdi güvenli biçimde paylaşın.');await refresh();}catch(error){setMessageTone('danger');setMessage(error instanceof Error?error.message:'Davet oluşturulamadı.');}finally{setBusyId('');}};
  const revoke=async(invitationId:string)=>{if(!window.pardus)return;setBusyId(invitationId);setMessage('');try{setInvitations(await window.pardus.revokeInvitation(invitationId));setMessageTone('success');setMessage('Davet iptal edildi; eski kod artık kabul edilemez.');}catch(error){setMessageTone('danger');setMessage(error instanceof Error?error.message:'Davet iptal edilemedi.');}finally{setBusyId('');}};
  const resend=async(invitationId:string)=>{if(!window.pardus)return;setBusyId(invitationId);setMessage('');setIssuedToken('');try{const result=await window.pardus.resendInvitation({invitationId});setIssuedToken(result.token);setMessageTone('success');setMessage('Yeni davet kodu üretildi; önceki kod geçersiz kılındı.');await refresh();}catch(error){setMessageTone('danger');setMessage(error instanceof Error?error.message:'Davet yeniden gönderilemedi.');}finally{setBusyId('');}};
  const statusLabel:Record<FamilyInvitationView['status'],string>={pending:'Kullanılabilir',accepted:'Kabul edildi',revoked:'İptal edildi',expired:'Süresi doldu'};
  const roleLabel:Record<FamilyRole,string>={family_admin:'Aile yöneticisi',adult_member:'Yetişkin üye',limited_member:'Sınırlı üye',caregiver:'Bakım veren',advisor:'Danışman'};
  const panel=<><PageHeader eyebrow="Tek kullanımlık güvenli katılım" title="Profil Davetleri" description="Davetleri başlangıç ve bitiş tarihiyle oluşturun; kullanım, iptal ve yeniden gönderim zincirini görün."/>
    <section className="workspace-grid">
      <Surface className="workspace-form"><SectionHeader eyebrow="Yeni davet" title="Aile profili oluştur"/><label>Profil adı<input value={profileName} onChange={event=>setProfileName(event.target.value)} placeholder="Aile üyesinin adı"/></label><label>Rol<select value={role} onChange={event=>setRole(event.target.value as FamilyRole)}><option value="adult_member">Yetişkin üye</option><option value="limited_member">Sınırlı üye</option><option value="caregiver">Bakım veren</option><option value="advisor">Danışman</option></select></label><PersonCatalogSelect label="Bağlı kişi" value={personId} onChange={setPersonId} allowEmpty fallbackPeople={snapshot.people}/><label>Başlangıç<input type="date" value={startsOn} onChange={event=>setStartsOn(event.target.value)}/></label><label>Bitiş<input type="date" min={startsOn} value={endsOn} onChange={event=>setEndsOn(event.target.value)}/></label><Button tone="primary" disabled={busyId==='create'||profileName.trim().length<2||!startsOn||!endsOn} onClick={()=>void create()}>{busyId==='create'?'Oluşturuluyor…':'Davet oluştur'}</Button>{issuedToken&&<div className="notes-card invitation-token-card"><strong>Tek kullanımlık davet kodu</strong><code>{issuedToken}</code><Button onClick={()=>void navigator.clipboard.writeText(issuedToken)}>Kodu kopyala</Button><small>Bu kod yeniden gösterilmez. Yeni kod üretildiğinde önceki kod otomatik olarak geçersiz olur.</small></div>}{message&&<StatusMessage tone={messageTone}>{message}</StatusMessage>}</Surface>
      <Surface className="workspace-summary"><SectionHeader eyebrow="Yaşam döngüsü" title={`${invitations.length} davet`}/>{invitations.length===0?<EmptyState title="Henüz davet yok" body="İlk aile profili davetini soldaki formdan oluşturun."/>:<div className="stack-list">{invitations.map(invitation=>{const person=snapshot.people.find(candidate=>candidate.id===invitation.personId);const canResend=invitation.status!=='accepted'&&!invitation.supersededByInvitationId;return <article className="list-row invitation-lifecycle-row" key={invitation.id}><div><span className={`status-pill ${invitation.status}`}>{statusLabel[invitation.status]}</span><strong>{person?.displayName??'Yerel aile profili'} · {roleLabel[invitation.role]}</strong><small>Başlangıç: {formatDate(invitation.startsAt,{dateStyle:'medium',timeStyle:'short'})}{invitation.endsAt?` · Bitiş: ${formatDate(invitation.endsAt,{dateStyle:'medium',timeStyle:'short'})}`:' · Bitiş yok'}</small><small>Oluşturuldu: {formatDate(invitation.createdAt,{dateStyle:'medium',timeStyle:'short'})}{invitation.acceptedAt?` · Kabul: ${formatDate(invitation.acceptedAt,{dateStyle:'medium',timeStyle:'short'})}`:''}{invitation.revokedAt?` · İptal: ${formatDate(invitation.revokedAt,{dateStyle:'medium',timeStyle:'short'})}`:''}</small>{invitation.revocationReason&&<small>{invitation.revocationReason==='resent'?'Yeni kod üretildiği için geçersiz.':'Yönetici tarafından iptal edildi.'}</small>}</div><div className="invitation-actions">{invitation.status==='pending'&&<Button tone="danger" disabled={busyId===invitation.id} onClick={()=>void revoke(invitation.id)}>İptal et</Button>}{canResend&&<Button disabled={busyId===invitation.id} onClick={()=>void resend(invitation.id)}>{busyId===invitation.id?'İşleniyor…':'Yeni kod üret'}</Button>}</div></article>;})}</div>}</Surface>
    </section>
  </>;
  return localizeHouseholdLifecycleNode(panel,language);
}

const dataRepairIssueLabel = (issue: DataRepairIssue): string => ({
  duplicate_person: 'Olası yinelenen kişi',
  broken_relation: 'Bozuk aile bağı',
  inconsistent_family_link: 'Tutarsız aile bağlantısı'
})[issue.kind];

const dataRepairResolutionLabel = (resolution: DataRepairOperation['resolution']): string => ({
  merge_duplicate_person: 'Yinelenen kişi kayıtlarını birleştir',
  remove_broken_relation: 'Bozuk aile bağını kaldır',
  align_relation_family: 'Aile bağını doğru aileyle eşleştir',
  remove_cross_family_relation: 'Aileler arası hatalı bağı kaldır',
  end_inconsistent_membership: 'Tutarsız üyeliği güvenle sonlandır'
})[resolution];

const dataRepairSnapshotLabel = (snapshot: DataRepairEntitySnapshot): string => {
  if (snapshot.entityType === 'person') {
    return `${snapshot.row.displayName} · ${snapshot.row.relationshipType} · kayıt sürümü ${snapshot.row.lifecycleVersion}`;
  }
  if (snapshot.entityType === 'relation') {
    return snapshot.row
      ? `${snapshot.row.fromPersonId} → ${snapshot.row.toPersonId} · ${snapshot.row.relationType}`
      : 'Bu aile bağı kaldırılmış olacak.';
  }
  return `${snapshot.row.personId} · ${snapshot.row.role} · ${snapshot.row.status}`;
};

export function DataRepairScreen() {
  const {language}=useLocalization();
  const [workspace,setWorkspace]=useState<DataRepairWorkspaceView>({issues:[],operations:[]});
  const [selectedIssueId,setSelectedIssueId]=useState('');
  const [reason,setReason]=useState('');
  const [preview,setPreview]=useState<DataRepairOperation|null>(null);
  const [confirmed,setConfirmed]=useState(false);
  const [loading,setLoading]=useState(true);
  const [busy,setBusy]=useState('');
  const [message,setMessage]=useState('');
  const [messageTone,setMessageTone]=useState<'info'|'success'|'warning'|'danger'>('info');
  const selectedIssue=workspace.issues.find((issue)=>issue.id===selectedIssueId);

  const refresh=async()=>{
    if(!window.pardus){setMessageTone('danger');setMessage('Veri Onarma Merkezi güvenli masaüstü bağlantısı kullanılamıyor.');setLoading(false);return;}
    try{
      const value=await window.pardus.getDataRepairWorkspace();
      setWorkspace({issues:[...value.issues],operations:[...value.operations]});
      setMessage('');
    }catch(error){
      setWorkspace({issues:[],operations:[]});
      setMessageTone('danger');
      setMessage(error instanceof Error?error.message:'Veri Onarma Merkezi açılamadı.');
    }finally{setLoading(false);}
  };
  useEffect(()=>{void refresh();},[]);

  const selectIssue=(issueId:string)=>{
    setSelectedIssueId(issueId);
    setPreview(null);
    setConfirmed(false);
    setMessage('');
  };
  const createPreview=async()=>{
    if(!window.pardus||!selectedIssue)return;
    setBusy('preview');setMessage('');setConfirmed(false);
    try{
      const operation=await window.pardus.previewDataRepair({issueId:selectedIssue.id,reason});
      setPreview(operation);
      setMessageTone('info');
      setMessage('Önizleme hazır. Uygulamadan önce önceki ve sonraki durumu dikkatle karşılaştırın.');
      await refresh();
    }catch(error){setMessageTone('danger');setMessage(error instanceof Error?error.message:'Onarma önizlemesi hazırlanamadı.');}
    finally{setBusy('');}
  };
  const applyPreview=async()=>{
    if(!window.pardus||!preview||!confirmed)return;
    setBusy(preview.id);setMessage('');
    try{
      await window.pardus.applyDataRepair({operationId:preview.id,expectedRevisionToken:preview.revisionToken});
      setPreview(null);setSelectedIssueId('');setReason('');setConfirmed(false);
      setMessageTone('success');setMessage('Onarma güvenle uygulandı ve geri alma kaydı oluşturuldu.');
      await refresh();
    }catch(error){setMessageTone('danger');setMessage(error instanceof Error?error.message:'Veri değiştiği için onarma uygulanamadı. Yeniden tarayın.');}
    finally{setBusy('');}
  };
  const undoOperation=async(operationId:string)=>{
    if(!window.pardus)return;
    setBusy(operationId);setMessage('');
    try{
      await window.pardus.undoDataRepair(operationId);
      setPreview(null);setConfirmed(false);
      setMessageTone('success');setMessage('Onarma geri alındı ve veri yeniden tarandı.');
      await refresh();
    }catch(error){setMessageTone('danger');setMessage(error instanceof Error?error.message:'Onarma güvenle geri alınamadı.');}
    finally{setBusy('');}
  };
  const inspectExistingPreview=(operation:DataRepairOperation)=>{
    setPreview(operation);setSelectedIssueId(operation.issueId);setReason(operation.reason);setConfirmed(false);setMessage('');
  };

  if(loading)return localizeRepairAndSessionNode(<div className="loading-screen"><div className="loader"/><strong>Veriler güvenle taranıyor…</strong></div>,language);
  const panel=<>
    <PageHeader eyebrow="Yönetici denetimli ve geri alınabilir" title="Veri Onarma Merkezi" description="Olası yinelenen kişileri, bozuk aile bağlarını ve tutarsız üyelikleri önce görün; değişikliği incelemeden hiçbir onarma uygulanmaz."/>
    {message&&<StatusMessage tone={messageTone}>{message}</StatusMessage>}
    <section className="workspace-grid data-repair-workspace">
      <Surface className="workspace-summary">
        <SectionHeader eyebrow={`${workspace.issues.length} açık bulgu`} title="Güvenli tarama sonuçları"/>
        <p className="muted-copy">Yalnız otomatik olarak güvenle onarılabilen bulgular işleme açılır. Her uygulama denetim ve geri alma kaydı bırakır.</p>
        <Button onClick={()=>{setLoading(true);void refresh();}}>Yeniden tara</Button>
        {workspace.issues.length===0?<EmptyState title="Açık veri sorunu bulunmadı" body="Tarama, desteklenen yinelenen kişi ve aile bağlantısı kontrollerinde temiz sonuç verdi."/>:<div className="stack-list">{workspace.issues.map((issue)=><article className={`list-row data-repair-issue ${selectedIssueId===issue.id?'selected':''}`} key={issue.id}><div><span className={`status-pill ${issue.severity==='critical'?'revoked':'pending'}`}>{issue.severity==='critical'?'Kritik':'İnceleme'}</span><strong>{dataRepairIssueLabel(issue)}</strong><small>{issue.summary}</small><small>Öneri: {dataRepairResolutionLabel(issue.suggestedResolution)}</small></div><Button tone={selectedIssueId===issue.id?'primary':'default'} disabled={!issue.repairable||busy!==''} onClick={()=>selectIssue(issue.id)}>{issue.repairable?'İncele':'Elle inceleme gerekli'}</Button></article>)}</div>}
      </Surface>
      <Surface className="workspace-form">
        <SectionHeader eyebrow="Zorunlu önizleme" title="Onarma kararı"/>
        {!selectedIssue&&!preview?<EmptyState title="Bir bulgu seçin" body="Sol taraftaki bir bulguyu seçerek gerekçe ve değişiklik önizlemesini hazırlayın."/>:<>
          {selectedIssue&&<div className="notes-card"><strong>{dataRepairIssueLabel(selectedIssue)}</strong><p>{selectedIssue.summary}</p><small>Planlanan işlem: {dataRepairResolutionLabel(selectedIssue.suggestedResolution)}</small></div>}
          {!preview&&<><label>Onarma gerekçesi<textarea rows={3} minLength={5} maxLength={500} value={reason} onChange={(event)=>setReason(event.target.value)} placeholder="Bu onarmanın neden gerekli olduğunu açıkça yazın."/></label><Button tone="primary" disabled={!selectedIssue||reason.trim().length<5||busy!==''} onClick={()=>void createPreview()}>{busy==='preview'?'Önizleme hazırlanıyor…':'Değişiklik önizlemesini hazırla'}</Button></>}
          {preview&&<div className="data-repair-preview" aria-live="polite"><div className="preview-card before"><span className="eyebrow">Önceki durum</span><strong>{dataRepairSnapshotLabel(preview.beforeSnapshot)}</strong></div><div className="preview-arrow" aria-hidden="true">→</div><div className="preview-card after"><span className="eyebrow">Onarma sonrası</span><strong>{dataRepairSnapshotLabel(preview.afterSnapshot)}</strong></div><p><strong>Uygulanacak işlem:</strong> {dataRepairResolutionLabel(preview.resolution)}</p><p><strong>Gerekçe:</strong> {preview.reason}</p><label className="confirmation-row"><input type="checkbox" checked={confirmed} onChange={(event)=>setConfirmed(event.target.checked)}/> Önceki ve sonraki durumu karşılaştırdım; bu onarmayı uygulamak istiyorum.</label><div className="button-row"><Button onClick={()=>{setPreview(null);setConfirmed(false);}}>Önizlemeyi kapat</Button><Button tone="danger" disabled={!confirmed||busy!==''} onClick={()=>void applyPreview()}>{busy===preview.id?'Uygulanıyor…':'Onarmayı uygula'}</Button></div></div>}
        </>}
      </Surface>
      <Surface className="workspace-summary data-repair-history">
        <SectionHeader eyebrow={`${workspace.operations.length} işlem kaydı`} title="Onarma geçmişi"/>
        {workspace.operations.length===0?<EmptyState title="Henüz işlem yok" body="Hazırlanan önizlemeler ve uygulanan ya da geri alınan onarmalar burada görünür."/>:<div className="stack-list">{workspace.operations.map((operation)=><article className="list-row" key={operation.id}><div><span className={`status-pill ${operation.status==='applied'?'accepted':operation.status==='undone'?'revoked':'pending'}`}>{operation.status==='applied'?'Uygulandı':operation.status==='undone'?'Geri alındı':'Önizlendi'}</span><strong>{dataRepairResolutionLabel(operation.resolution)}</strong><small>{operation.reason}</small><small>{formatDate(operation.createdAt,{dateStyle:'medium',timeStyle:'short'})}</small></div><div className="invitation-actions">{operation.status==='previewed'&&<Button disabled={busy!==''} onClick={()=>inspectExistingPreview(operation)}>Önizlemeyi aç</Button>}{operation.status==='applied'&&<Button tone="danger" disabled={busy!==''} onClick={()=>void undoOperation(operation.id)}>{busy===operation.id?'Geri alınıyor…':'Geri al'}</Button>}</div></article>)}</div>}
      </Surface>
    </section>
  </>;
  return localizeRepairAndSessionNode(panel,language);
}

export function PermissionsScreen({ auth }: { auth: AuthStateView }) {
  const {language}=useLocalization();
  const [accounts,setAccounts]=useState<FamilyAccountView[]>([]);
  const [permissions,setPermissions]=useState<ObjectPermissionView[]>([]);
  const [branches,setBranches]=useState<AuthorizationContextWorkspaceView['branches']>([]);
  const [offlineLeases,setOfflineLeases]=useState<OfflineCapabilityLeaseWorkspaceView|null>(null);
  const [clientDataAccess,setClientDataAccess]=useState<ClientDataAccessBoundaryView|null>(null);
  const [message,setMessage]=useState('');
  const [subject,setSubject]=useState(''); const [resourceType,setResourceType]=useState('event'); const [resourceId,setResourceId]=useState('*'); const [effect,setEffect]=useState<'allow'|'deny'>('allow');
  const [purpose,setPurpose]=useState<AuthorizationPurpose>('general'); const [familyBranchId,setFamilyBranchId]=useState('');
  const [startsOn,setStartsOn]=useState(()=>new Date().toISOString().slice(0,10)); const [endsOn,setEndsOn]=useState(''); const [denialReason,setDenialReason]=useState(''); const [ownershipPercent,setOwnershipPercent]=useState('');
  useEffect(()=>{if(effect==='deny')setOwnershipPercent('');},[effect]);
  const [actions,setActions]=useState<ObjectPermissionAction[]>(['read']);
  const [offlineCapability,setOfflineCapability]=useState<OfflineCapability>('family.read'); const [offlineDurationMinutes,setOfflineDurationMinutes]=useState(60);
  const refresh=async()=>{ if(!window.pardus) return;try{const [workspace,leaseWorkspace,dataAccessBoundary]=await Promise.all([window.pardus.getAuthorizationContextWorkspace(),window.pardus.getOfflineCapabilityLeaseWorkspace(),window.pardus.getClientDataAccessBoundary()]); const a=[...workspace.accounts];setAccounts(a);setPermissions([...workspace.permissions]);setBranches(workspace.branches);setOfflineLeases(leaseWorkspace);setClientDataAccess(dataAccessBoundary); if(!subject&&a[0]) setSubject(a[0].id);}catch{setAccounts([]);setPermissions([]);setBranches([]);setOfflineLeases(null);setClientDataAccess(null);} };
  useEffect(()=>{void refresh();},[auth.role]);
  if(auth.role!=='family_admin') return localizePermissionsNode(<><PageHeader eyebrow="Veri sahipliği" title="Yetkiler" description="Bu ekran yalnızca aile yöneticisi tarafından kullanılabilir."/><EmptyState title="Yönetici yetkisi gerekli" body="Kendi verileriniz, aileye açık kayıtlar ve size açıkça verilen izinler görünür."/></>,language);
  const savePermission=async()=>{try{setMessage(''); if(!window.pardus)return;const reason=denialReason.trim();const percent=ownershipPercent.trim()===''?undefined:Number(ownershipPercent);const ownershipBasisPoints=percent===undefined?undefined:Math.round(percent*100);if(percent!==undefined&&(!Number.isFinite(percent)||percent<=0||percent>100||ownershipBasisPoints!==(percent*100))){setMessage('Sahiplik oranı %0,01 ile %100 arasında ve en fazla iki ondalık basamaklı olmalıdır.');return;}if(effect==='deny'&&ownershipBasisPoints!==undefined){setMessage('Açık ret kaydı sahiplik oranı taşıyamaz.');return;}if(effect==='deny'&&reason.length<5){setMessage('Ret kararı için en az 5 karakterlik açık gerekçe yazın.');return;}if(resourceType==='location'&&familyBranchId){setMessage('Kayıtlı konum izni aile dalına bağlanamaz.');return;}if(resourceType==='location'&&effect==='allow'&&!endsOn){setMessage('Kayıtlı konum erişimi için sonlu bir bitiş tarihi zorunludur.');return;}if(endsOn&&endsOn<startsOn){setMessage('Bitiş tarihi başlangıç tarihinden önce olamaz.');return;}await window.pardus.upsertPermission({subjectAccountId:subject,resourceType,resourceId,actions,effect,purpose,...(familyBranchId?{familyBranchId}:{}),...(ownershipBasisPoints===undefined?{}:{ownershipBasisPoints}),startsAt:`${startsOn}T00:00:00.000Z`,...(endsOn?{endsAt:`${endsOn}T23:59:59.999Z`}:{}),...(effect==='deny'?{denialReason:reason}:{})}); setMessage('Amaç, aile dalı, süre ve sahiplik oranıyla bağlamsal izin kaydedildi.'); await refresh();}catch(e){setMessage(e instanceof Error?e.message:'İzin kaydedilemedi.');}};
  const updateProfile=async(account:FamilyAccountView,changes:Partial<Pick<FamilyAccountView,'role'|'status'|'personId'>>)=>{try{if(!window.pardus)return;setAccounts(await window.pardus.updateAccount({accountId:account.id,role:changes.role??account.role,status:changes.status??account.status,startsAt:account.startsAt,...((changes.personId??account.personId)?{personId:changes.personId??account.personId}:{}),...(account.endsAt?{endsAt:account.endsAt}:{})}));setMessage('Profil yetkileri güncellendi.');}catch(e){setMessage(e instanceof Error?e.message:'Profil güncellenemedi.');}};
  const toggle=(action:ObjectPermissionAction)=>setActions(current=>current.includes(action)?current.filter(x=>x!==action):[...current,action]);
  const archiveResourceSelected=['archive_item','archive_retention_policy','archive_category'].includes(resourceType);
  const locationResourceSelected=resourceType==='location';
  const changeResourceType=(value:string)=>{setResourceType(value);if(['archive_item','archive_retention_policy','archive_category'].includes(value))setPurpose('archive');else if(value==='location'){setPurpose('general');setActions(['read']);setFamilyBranchId('');}else if(purpose==='archive')setPurpose('general');};
  const purposeLabel=(value:AuthorizationPurpose)=>({general:'Genel',care:'Bakım',finance:'Finans',health:'Sağlık',archive:'Arşiv',legacy:'Dijital miras',ai_processing:'Yapay zekâ işleme',administration:'Yönetim'} as const)[value];
  const issueOfflineLease=async()=>{try{if(!window.pardus||!subject)return;setMessage('');setOfflineLeases(await window.pardus.issueOfflineCapabilityLease({subjectAccountId:subject,capability:offlineCapability,durationMinutes:offlineDurationMinutes}));setMessage('Çevrimdışı yetki kirası cihaz ve politika paketine bağlı olarak oluşturuldu.');}catch(error){setMessage(error instanceof Error?error.message:'Çevrimdışı yetki kirası oluşturulamadı.');}};
  const revokeOfflineLease=async(leaseId:string)=>{try{if(!window.pardus)return;setOfflineLeases(await window.pardus.revokeOfflineCapabilityLease(leaseId));setMessage('Çevrimdışı yetki kirası iptal edildi; hassas önbellek kilitlendi.');}catch(error){setMessage(error instanceof Error?error.message:'Çevrimdışı yetki kirası iptal edilemedi.');}};
  const panel=<><PageHeader eyebrow="Amaç ve aile dalı bağlamı" title="Bağlamsal Yetkiler" description="Her izni amacı, aile dalı, geçerlilik aralığı, sahiplik oranı ve açık ret gerekçesiyle yönetin."/>
  <Surface className="workspace-summary"><SectionHeader eyebrow="PPK-013 · istemci veri erişim çiti" title="Repository, SQL, SQLite ve kasa erişimi kapalı"/><div className="notes-card"><strong>İstemci doğrudan erişimi: {clientDataAccess?.enforcement==='fail-closed'?'Yasak ve fail-closed':'Doğrulanamadı'}</strong><small>Repository {clientDataAccess?.directAccess.repository===false?'kapalı':'bilinmiyor'} · SQL {clientDataAccess?.directAccess.sql===false?'kapalı':'bilinmiyor'} · SQLite {clientDataAccess?.directAccess.sqlite===false?'kapalı':'bilinmiyor'} · dosya kasası {clientDataAccess?.directAccess.vaultFile===false?'kapalı':'bilinmiyor'}</small><small>{clientDataAccess?.registeredApplicationServiceChannels??0} tipli uygulama servisi/IPC kanalı · {clientDataAccess?.directAccessExceptionCount??0} doğrudan erişim istisnası</small><small>Mevcut Desktop kasası korunur; SQLite sahipliği bu paketle değiştirilmez.</small></div></Surface>
  <Surface className="workspace-summary"><SectionHeader eyebrow="PPK-012 · sonlu çevrimdışı erişim" title="Çevrimdışı yetki kirası ve hassas önbellek kilidi"/><div className="form-grid"><label>Hesap<select value={subject} onChange={e=>setSubject(e.target.value)}>{accounts.map(account=><option key={account.id} value={account.id}>{account.displayName}</option>)}</select></label><label>Yetenek<select value={offlineCapability} onChange={e=>setOfflineCapability(e.target.value as OfflineCapability)}><option value="family.read">Aile verisini oku</option><option value="health.read">Sağlık verisini oku</option><option value="finance.read">Finans verisini oku</option><option value="location.read">Konum verisini oku</option><option value="archive.read">Arşivi oku</option></select></label><label>Süre (dakika)<input type="number" min={offlineLeases?.minimumDurationMinutes??1} max={offlineLeases?.maximumDurationMinutes??1440} value={offlineDurationMinutes} onChange={e=>setOfflineDurationMinutes(Number(e.target.value))}/></label><Button tone="primary" disabled={!subject||offlineDurationMinutes<1||offlineDurationMinutes>1440} onClick={()=>void issueOfflineLease()}>Sonlu kira oluştur</Button></div><div className="notes-card"><strong>Hassas önbellek: {offlineLeases?.cache.locked?'Kilitli':'Kira kapsamında açık'}</strong><small>{offlineLeases?.cache.reason??'NO_LEASE'} · {offlineLeases?.cache.entryCount??0} kayıt{offlineLeases?.cache.expiresAt?` · ${formatDate(offlineLeases.cache.expiresAt,{dateStyle:'short',timeStyle:'short'})} tarihinde kilitlenir`:''}</small></div><div className="stack-list">{!offlineLeases||offlineLeases.leases.length===0?<EmptyState title="Çevrimdışı kira yok" body="Hassas önbellek varsayılan olarak kilitlidir."/>:offlineLeases.leases.map(lease=><div className="context-stat" key={lease.leaseId}><strong>{lease.capability} · {lease.state}</strong><span>{accounts.find(account=>account.id===lease.subjectAccountId)?.displayName??lease.subjectAccountId} · cihaz {lease.deviceId.slice(0,12)}…</span><small>{formatDate(lease.notBefore,{dateStyle:'short',timeStyle:'short'})} — {formatDate(lease.expiresAt,{dateStyle:'short',timeStyle:'short'})} · {lease.leaseSha256.slice(0,16)}…</small>{lease.state==='active'&&<Button tone="danger" onClick={()=>void revokeOfflineLease(lease.leaseId)}>Kirayı iptal et ve kilitle</Button>}</div>)}</div></Surface>
  <Surface className="workspace-summary"><SectionHeader eyebrow="Ortak kaynak bağlamı" title="Sahiplik oranı"/><label>İzin kaydının sahiplik oranı (%)<input type="number" min="0.01" max="100" step="0.01" disabled={effect==='deny'} value={ownershipPercent} onChange={e=>setOwnershipPercent(e.target.value)} placeholder="İsteğe bağlı: 0,01–100"/></label><small>{effect==='deny'?'Açık ret kayıtları sahiplik oranı taşımaz.':'Oran, izin kaydına 1–10.000 baz puan olarak bağlanır.'}</small><div className="stack-list">{permissions.filter(permission=>permission.ownershipBasisPoints!==undefined).map(permission=><small key={permission.id}>{permission.resourceType}/{permission.resourceId} · %{((permission.ownershipBasisPoints??0)/100).toLocaleString('tr-TR',{maximumFractionDigits:2})}</small>)}</div></Surface>
  <section className="workspace-grid">
    <article className="panel workspace-summary"><span className="eyebrow">{accounts.length} profil</span><h2>Aile profilleri</h2>{accounts.map(a=><div className="profile-admin-row" key={a.id}><strong>{a.displayName}</strong><select aria-label={`${a.displayName} rolü`} value={a.role} onChange={e=>void updateProfile(a,{role:e.target.value as FamilyRole})}><option value="family_admin">Aile yöneticisi</option><option value="adult_member">Yetişkin üye</option><option value="limited_member">Sınırlı üye</option><option value="caregiver">Bakım veren</option><option value="advisor">Danışman</option></select><select aria-label={`${a.displayName} durumu`} value={a.status} onChange={e=>void updateProfile(a,{status:e.target.value as FamilyAccountView['status']})}><option value="active">Aktif</option><option value="suspended">Askıda</option><option value="expired">Süresi doldu</option><option value="invited">Davet edildi</option></select></div>)}</article>
    <article className="panel workspace-form"><h2>Bağlamsal nesne izni</h2><label>Hesap<select value={subject} onChange={e=>setSubject(e.target.value)}>{accounts.map(a=><option key={a.id} value={a.id}>{a.displayName}</option>)}</select></label><label>Kaynak türü<select value={resourceType} onChange={e=>changeResourceType(e.target.value)}><option value="event">Etkinlik</option><option value="location">Kayıtlı konum</option><option value="archive_item">Arşiv belgesi</option><option value="archive_retention_policy">Arşiv saklama politikası</option><option value="archive_category">Arşiv kategorisi</option><option value="health_record">Sağlık kaydı</option><option value="finance_record">Finans kaydı</option><option value="object_permission">Yetkilendirme kaydı</option></select></label><label>Kaynak kimliği<input value={resourceId} onChange={e=>setResourceId(e.target.value)} placeholder="* tüm kayıtlar"/></label><label>Amaç<select value={purpose} disabled={archiveResourceSelected||locationResourceSelected} onChange={e=>setPurpose(e.target.value as AuthorizationPurpose)}><option value="general">Genel</option><option value="care">Bakım</option><option value="finance">Finans</option><option value="health">Sağlık</option><option value="archive">Arşiv</option><option value="legacy">Dijital miras</option><option value="ai_processing">Yapay zekâ işleme</option><option value="administration">Yönetim</option></select></label><label>Aile dalı<select value={familyBranchId} disabled={locationResourceSelected} onChange={e=>setFamilyBranchId(e.target.value)}><option value="">Tüm aile / dal sınırı yok</option>{branches.filter(branch=>branch.status==='active').map(branch=><option key={branch.id} value={branch.id}>{branch.name}</option>)}</select></label><label>Başlangıç<input type="date" required value={startsOn} onChange={e=>setStartsOn(e.target.value)}/></label><label>Bitiş<input type="date" min={startsOn} required={locationResourceSelected&&effect==='allow'} value={endsOn} onChange={e=>setEndsOn(e.target.value)}/>{locationResourceSelected&&effect==='allow'&&<small>Konum erişimi süresiz verilemez.</small>}</label><label>Karar<select value={effect} onChange={e=>{const next=e.target.value as 'allow'|'deny';setEffect(next);if(next==='allow')setDenialReason('');}}><option value="allow">İzin ver</option><option value="deny">Reddet</option></select></label>{effect==='deny'&&<label className="span-2">Açık ret gerekçesi<textarea minLength={5} maxLength={500} required rows={2} value={denialReason} onChange={e=>setDenialReason(e.target.value)} placeholder="Bu erişimin neden reddedildiğini açıkça yazın."/></label>}<div className="participant-chips span-2">{OBJECT_PERMISSION_ACTIONS.map(a=><button type="button" disabled={locationResourceSelected&&a!=='read'} className={actions.includes(a)?'active':''} key={a} onClick={()=>toggle(a)}>{a}</button>)}</div><Button tone="primary" onClick={()=>void savePermission()} disabled={!subject||!resourceId||!startsOn||actions.length===0||(locationResourceSelected&&effect==='allow'&&!endsOn)||(effect==='deny'&&denialReason.trim().length<5)}>Bağlamsal izni kaydet</Button></article>
    <article className="panel workspace-summary"><span className="eyebrow">{permissions.length} izin</span><h2>Etkin bağlamsal izinler</h2>{permissions.length===0?<EmptyState title="Bağlamsal izin yok" body="Amaç, aile dalı ve süre sınırı olan izinler burada görünür."/>:permissions.map(p=><div className="context-stat" key={p.id}><strong>{p.effect==='allow'?'İzin':'Ret'} · {p.resourceType}/{p.resourceId}</strong><span>{accounts.find(a=>a.id===p.subjectAccountId)?.displayName??p.subjectAccountId} · {purposeLabel(p.purpose)} · {p.familyBranchId?(branches.find(branch=>branch.id===p.familyBranchId)?.name??p.familyBranchId):'Tüm aile'} · {p.actions.join(', ')}</span><small>{formatDate(p.startsAt)}{p.endsAt?` — ${formatDate(p.endsAt)}`:' — süresiz'}{p.denialReason?` · Gerekçe: ${p.denialReason}`:''}</small><Button onClick={async()=>{if(window.pardus){await window.pardus.deletePermission(p.id);await refresh();}}}>Sil</Button></div>)}</article>
  </section>{message&&<div className="notes-card">{message}</div>}</>;
  return localizePermissionsNode(panel,language);
}


function FinanceOverviewScreen({people,records,valuations,institutions,bankAccounts,paymentCards,loanAccounts,planningWorkspace,onCreate,onCreateValuation,onValidateIban,onCreateBankAccount,onCreatePaymentCard,onCreateLoanAccount,onRecordLoanPayment,onRecordPlanning,onPlanningWorkspaceChange}:{people:FamilyMemberView[];records:FinanceRecordView[];valuations:FinanceValuationView[];institutions:BankInstitutionView[];bankAccounts:BankAccountView[];paymentCards:PaymentCardView[];loanAccounts:LoanAccountView[];planningWorkspace:FinancePlanningWorkspaceView|undefined;onCreate:(input:CreateFinanceRecordInput)=>Promise<void>;onCreateValuation:(input:CreateFinanceValuationInput)=>Promise<void>;onValidateIban:(input:ValidateIbanInput)=>Promise<IbanStructuralValidationView>;onCreateBankAccount:(input:CreateBankAccountInput)=>Promise<void>;onCreatePaymentCard:(input:CreatePaymentCardInput)=>Promise<void>;onCreateLoanAccount:(input:CreateLoanAccountInput)=>Promise<void>;onRecordLoanPayment:(input:RecordLoanPaymentInput)=>Promise<void>;onRecordPlanning:(input:RecordFinancePlanningItemInput)=>Promise<void>;onPlanningWorkspaceChange:(workspace:FinancePlanningWorkspaceView)=>void}){
  const [ownerPersonId,setOwner]=useState(people[0]?.id??''); const [title,setTitle]=useState(''); const [amount,setAmount]=useState(''); const [kind,setKind]=useState<FinanceRecordView['kind']>('asset'); const [privacy,setPrivacy]=useState<FinanceRecordView['privacy']>('private'); const [currency,setCurrency]=useState('TRY'); const [dueAt,setDueAt]=useState(''); const [remaining,setRemaining]=useState(''); const [symbol,setSymbol]=useState(''); const [valuationRecord,setValuationRecord]=useState(''); const [unitPrice,setUnitPrice]=useState(''); const [quantity,setQuantity]=useState('1'); const [message,setMessage]=useState('');
  const [bankOwnerPersonId,setBankOwner]=useState(people[0]?.id??''); const [institutionCode,setInstitutionCode]=useState(''); const [iban,setIban]=useState(''); const [ibanValidation,setIbanValidation]=useState<IbanStructuralValidationView>(); const [bankAlias,setBankAlias]=useState(''); const [bankBranch,setBankBranch]=useState(''); const [bankType,setBankType]=useState<BankAccountView['accountType']>('checking'); const [bankCurrency,setBankCurrency]=useState('TRY'); const [ownershipPercent,setOwnershipPercent]=useState('100'); const [bankStatus,setBankStatus]=useState<BankAccountView['status']>('active'); const [bankPrivacy,setBankPrivacy]=useState<BankAccountView['privacy']>('private'); const [bankMessage,setBankMessage]=useState('');
  const [cardOwnerPersonId,setCardOwner]=useState(people[0]?.id??''); const [cardInstitutionCode,setCardInstitutionCode]=useState(''); const [cardProductName,setCardProductName]=useState(''); const [cardKind,setCardKind]=useState<PaymentCardView['kind']>('credit'); const [cardNetwork,setCardNetwork]=useState<PaymentCardView['network']>('troy'); const [cardFormFactor,setCardFormFactor]=useState<PaymentCardView['formFactor']>('physical'); const [cardLast4,setCardLast4]=useState(''); const [cardCurrency,setCardCurrency]=useState('TRY'); const [cardLimit,setCardLimit]=useState(''); const [cardAvailable,setCardAvailable]=useState(''); const [cardDebt,setCardDebt]=useState('0'); const [cardStatementBalance,setCardStatementBalance]=useState('0'); const [cardStatementClosing,setCardStatementClosing]=useState(''); const [cardPaymentDue,setCardPaymentDue]=useState(''); const [cardInstallmentCount,setCardInstallmentCount]=useState('0'); const [cardInstallmentAmount,setCardInstallmentAmount]=useState('0'); const [cardAutomaticPayment,setCardAutomaticPayment]=useState<PaymentCardView['automaticPaymentMode']>('none'); const [cardRewardPoints,setCardRewardPoints]=useState('0'); const [cardRewardMiles,setCardRewardMiles]=useState('0'); const [cardAnnualFee,setCardAnnualFee]=useState('0'); const [cardAnnualFeeDue,setCardAnnualFeeDue]=useState(''); const [cardAlertsEnabled,setCardAlertsEnabled]=useState(true); const [cardUtilizationAlert,setCardUtilizationAlert]=useState('80'); const [cardDueAlertDays,setCardDueAlertDays]=useState('3'); const [cardStatus,setCardStatus]=useState<PaymentCardView['status']>('active'); const [cardPrivacy,setCardPrivacy]=useState<PaymentCardView['privacy']>('private'); const [cardMessage,setCardMessage]=useState('');
  const [loanOwnerPersonId,setLoanOwner]=useState(people[0]?.id??''); const [loanInstitutionCode,setLoanInstitutionCode]=useState(''); const [loanTitle,setLoanTitle]=useState(''); const [loanKind,setLoanKind]=useState<LoanAccountView['kind']>('consumer'); const [loanRateType,setLoanRateType]=useState<LoanAccountView['rateType']>('fixed'); const [loanAnnualRate,setLoanAnnualRate]=useState(''); const [loanTermMonths,setLoanTermMonths]=useState(''); const [loanCurrency,setLoanCurrency]=useState('TRY'); const [loanOriginalPrincipal,setLoanOriginalPrincipal]=useState(''); const [loanInstallmentAmount,setLoanInstallmentAmount]=useState(''); const [loanRemainingPrincipal,setLoanRemainingPrincipal]=useState(''); const [loanDisbursedAt,setLoanDisbursedAt]=useState(''); const [loanFirstPaymentAt,setLoanFirstPaymentAt]=useState(''); const [loanEarlySettlementAmount,setLoanEarlySettlementAmount]=useState('0'); const [loanEarlySettlementQuotedAt,setLoanEarlySettlementQuotedAt]=useState(''); const [loanOverdueCount,setLoanOverdueCount]=useState('0'); const [loanOverdueAmount,setLoanOverdueAmount]=useState('0'); const [loanDaysPastDue,setLoanDaysPastDue]=useState('0'); const [loanInsuranceStatus,setLoanInsuranceStatus]=useState<LoanAccountView['insuranceStatus']>('none'); const [loanInsuranceProvider,setLoanInsuranceProvider]=useState(''); const [loanInsuranceReference,setLoanInsuranceReference]=useState(''); const [loanInsurancePremium,setLoanInsurancePremium]=useState('0'); const [loanInsuranceEndsAt,setLoanInsuranceEndsAt]=useState(''); const [loanCollateralType,setLoanCollateralType]=useState<LoanAccountView['collateralType']>('none'); const [loanCollateralDescription,setLoanCollateralDescription]=useState(''); const [loanCollateralValue,setLoanCollateralValue]=useState('0'); const [loanStatus,setLoanStatus]=useState<LoanAccountView['status']>('active'); const [loanPrivacy,setLoanPrivacy]=useState<LoanAccountView['privacy']>('private'); const [loanMessage,setLoanMessage]=useState('');
  const [paymentLoanId,setPaymentLoanId]=useState(''); const [loanPaymentAt,setLoanPaymentAt]=useState(''); const [loanPaymentSequence,setLoanPaymentSequence]=useState(''); const [loanPaymentPrincipal,setLoanPaymentPrincipal]=useState(''); const [loanPaymentInterest,setLoanPaymentInterest]=useState('0'); const [loanPaymentLateFee,setLoanPaymentLateFee]=useState('0'); const [loanPaymentNotes,setLoanPaymentNotes]=useState(''); const [loanPaymentMessage,setLoanPaymentMessage]=useState('');
  const customerInstitutions=institutions.filter((institution)=>institution.supportsCustomerAccounts);
  useEffect(()=>{if(!institutionCode&&customerInstitutions[0])setInstitutionCode(customerInstitutions[0].institutionCode);},[institutionCode,customerInstitutions]);
  useEffect(()=>{if(!cardInstitutionCode&&customerInstitutions[0])setCardInstitutionCode(customerInstitutions[0].institutionCode);},[cardInstitutionCode,customerInstitutions]);
  useEffect(()=>{if(!loanInstitutionCode&&customerInstitutions[0])setLoanInstitutionCode(customerInstitutions[0].institutionCode);},[loanInstitutionCode,customerInstitutions]);
  useEffect(()=>{if(!paymentLoanId&&loanAccounts[0])setPaymentLoanId(loanAccounts[0].id);},[paymentLoanId,loanAccounts]);
  useEffect(()=>{let cancelled=false;setIbanValidation(undefined);if(!iban.trim())return;const timer=globalThis.setTimeout(()=>{void onValidateIban({iban}).then((result)=>{if(!cancelled)setIbanValidation(result);}).catch(()=>{if(!cancelled)setIbanValidation(undefined);});},250);return()=>{cancelled=true;globalThis.clearTimeout(timer);};},[iban,onValidateIban]);
  const submit=async()=>{try{await onCreate({ownerPersonId,title,amount:Number(amount),kind,currency,privacy,occurredAt:new Date().toISOString(),...(dueAt?{dueAt:new Date(dueAt).toISOString()}:{}),...(remaining?{remainingPrincipal:Number(remaining)}:{}),...(symbol?{symbol}:{})});setTitle('');setAmount('');setMessage('Finans kaydı eklendi.');}catch(e){setMessage(e instanceof Error?e.message:'Kayıt eklenemedi.');}};
  const addValuation=async()=>{try{await onCreateValuation({financeRecordId:valuationRecord,valueDate:new Date().toISOString(),unitPrice:Number(unitPrice),quantity:Number(quantity),provider:'Manuel'});setMessage('Günlük değerleme kaydedildi.');}catch(e){setMessage(e instanceof Error?e.message:'Değerleme eklenemedi.');}};
  const createBankAccount=async()=>{try{setBankMessage('');const percent=Number(ownershipPercent);const ownershipBasisPoints=Math.round(percent*100);if(!Number.isFinite(percent)||percent<=0||percent>100||ownershipBasisPoints!==percent*100)throw new Error('Sahiplik oranı %0,01-%100 arasında ve en fazla iki ondalık olmalıdır.');if(!ibanValidation?.structurallyValid||ibanValidation.institutionCode!==institutionCode)throw new Error('IBAN yapısal kontrollerden geçmeli ve seçilen TCMB kurum koduyla eşleşmelidir.');await onCreateBankAccount({ownerPersonId:bankOwnerPersonId,institutionCode,iban,accountType:bankType,currency:bankCurrency,alias:bankAlias, ...(bankBranch.trim()?{branch:bankBranch.trim()}:{}),ownershipBasisPoints,status:bankStatus,privacy:bankPrivacy});setIban('');setIbanValidation(undefined);setBankAlias('');setBankBranch('');setBankMessage('Banka hesabı güvenli sözleşmeyle kaydedildi; gerçek hesap ve sahiplik doğrulaması yapılmadı.');}catch(error){setBankMessage(error instanceof Error?error.message:'Banka hesabı kaydedilemedi.');}};
  const createPaymentCard=async()=>{try{setCardMessage('');const utilizationPercent=Number(cardUtilizationAlert);const utilizationAlertBasisPoints=Math.round(utilizationPercent*100);if(!Number.isFinite(utilizationPercent)||utilizationPercent<=0||utilizationPercent>100||utilizationAlertBasisPoints!==utilizationPercent*100)throw new Error('Limit kullanım uyarısı %0,01-%100 arasında ve en fazla iki ondalık olmalıdır.');const annualFeeAmount=Number(cardAnnualFee);if(annualFeeAmount>0&&!cardAnnualFeeDue)throw new Error('Yıllık ücret pozitifse ücret tarihi zorunludur.');await onCreatePaymentCard({ownerPersonId:cardOwnerPersonId,institutionCode:cardInstitutionCode,productName:cardProductName,kind:cardKind,network:cardNetwork,formFactor:cardFormFactor,last4:cardLast4,currency:cardCurrency,creditLimit:Number(cardLimit),availableLimit:Number(cardAvailable),currentDebt:Number(cardDebt),statementBalance:Number(cardStatementBalance),statementClosingAt:new Date(cardStatementClosing).toISOString(),paymentDueAt:new Date(cardPaymentDue).toISOString(),activeInstallmentCount:Number(cardInstallmentCount),installmentOutstandingAmount:Number(cardInstallmentAmount),automaticPaymentMode:cardAutomaticPayment,rewardPoints:Number(cardRewardPoints),rewardMiles:Number(cardRewardMiles),annualFeeAmount,...(cardAnnualFeeDue?{annualFeeDueAt:new Date(cardAnnualFeeDue).toISOString()}:{}),alertsEnabled:cardAlertsEnabled,utilizationAlertBasisPoints,paymentDueAlertDays:Number(cardDueAlertDays),status:cardStatus,privacy:cardPrivacy});setCardProductName('');setCardLast4('');setCardMessage('Kart yalnız son dört haneyle kaydedildi; banka tarafında ödeme işlemi başlatılmadı.');}catch(error){setCardMessage(error instanceof Error?error.message:'Kart kaydedilemedi.');}};
  const createLoanAccount=async()=>{try{setLoanMessage('');const annualRatePercent=Number(loanAnnualRate||'0');const annualRateBasisPoints=Math.round(annualRatePercent*100);if(!Number.isFinite(annualRatePercent)||annualRatePercent<0||annualRatePercent>1000||annualRateBasisPoints!==annualRatePercent*100)throw new Error('Yıllık oran %0-%1.000 arasında ve en fazla iki ondalık olmalıdır.');await onCreateLoanAccount({ownerPersonId:loanOwnerPersonId,institutionCode:loanInstitutionCode,title:loanTitle,kind:loanKind,rateType:loanRateType,annualRateBasisPoints,termMonths:Number(loanTermMonths),currency:loanCurrency,originalPrincipal:Number(loanOriginalPrincipal),installmentAmount:Number(loanInstallmentAmount),remainingPrincipal:Number(loanRemainingPrincipal),disbursedAt:new Date(loanDisbursedAt).toISOString(),firstPaymentAt:new Date(loanFirstPaymentAt).toISOString(),earlySettlementAmount:Number(loanEarlySettlementAmount),...(loanEarlySettlementQuotedAt?{earlySettlementQuotedAt:new Date(loanEarlySettlementQuotedAt).toISOString()}:{}),overdueInstallmentCount:Number(loanOverdueCount),overdueAmount:Number(loanOverdueAmount),daysPastDue:Number(loanDaysPastDue),insuranceStatus:loanInsuranceStatus,...(loanInsuranceProvider.trim()?{insuranceProvider:loanInsuranceProvider.trim()}:{}),...(loanInsuranceReference.trim()?{insurancePolicyReference:loanInsuranceReference.trim()}:{}),insurancePremiumAmount:Number(loanInsurancePremium),...(loanInsuranceEndsAt?{insuranceEndsAt:new Date(loanInsuranceEndsAt).toISOString()}:{}),collateralType:loanCollateralType,...(loanCollateralDescription.trim()?{collateralDescription:loanCollateralDescription.trim()}:{}),collateralEstimatedValue:Number(loanCollateralValue),status:loanStatus,privacy:loanPrivacy});setLoanTitle('');setLoanMessage('Kredi ve ödeme planı manuel takip kaydı olarak oluşturuldu; banka doğrulaması veya ödeme işlemi yapılmadı.');}catch(error){setLoanMessage(error instanceof Error?error.message:'Kredi kaydedilemedi.');}};
  const recordLoanPayment=async()=>{try{setLoanPaymentMessage('');const principalAmount=Number(loanPaymentPrincipal);const interestAmount=Number(loanPaymentInterest);const lateFeeAmount=Number(loanPaymentLateFee);await onRecordLoanPayment({loanId:paymentLoanId,paidAt:new Date(loanPaymentAt).toISOString(),...(loanPaymentSequence?{scheduledInstallmentSequence:Number(loanPaymentSequence)}:{}),amount:principalAmount+interestAmount+lateFeeAmount,principalAmount,interestAmount,lateFeeAmount,...(loanPaymentNotes.trim()?{notes:loanPaymentNotes.trim()}:{} )});setLoanPaymentPrincipal('');setLoanPaymentInterest('0');setLoanPaymentLateFee('0');setLoanPaymentNotes('');setLoanPaymentMessage('Ödeme geçmişine eklendi; banka tarafında para hareketi başlatılmadı.');}catch(error){setLoanPaymentMessage(error instanceof Error?error.message:'Ödeme geçmişe eklenemedi.');}};
  const latest=new Map<string,FinanceValuationView>(); for(const v of valuations) if(!latest.has(v.financeRecordId)) latest.set(v.financeRecordId,v);
  const net=records.reduce((sum,r)=>{const value=latest.get(r.id)?.marketValue??r.remainingPrincipal??r.amount; return sum+(r.kind==='asset'||r.kind==='income'?value:-value);},0);
  const typeLabels:Record<BankAccountView['accountType'],string>={checking:'Vadesiz',savings:'Birikim',time_deposit:'Vadeli',participation:'Katılım',investment:'Yatırım',other:'Diğer'};
  const cardKindLabels:Record<PaymentCardView['kind'],string>={credit:'Kredi kartı',debit:'Banka kartı',prepaid:'Ön ödemeli'};
  const cardFormLabels:Record<PaymentCardView['formFactor'],string>={physical:'Fiziksel',virtual:'Sanal',supplementary:'Ek kart'};
  const automaticPaymentLabels:Record<PaymentCardView['automaticPaymentMode'],string>={none:'Talimat yok',minimum:'Asgari ödeme',full:'Ekstre borcunun tamamı'};
  const loanKindLabels:Record<LoanAccountView['kind'],string>={consumer:'İhtiyaç',mortgage:'Konut',vehicle:'Taşıt',other:'Diğer'};
  const loanRateLabels:Record<LoanAccountView['rateType'],string>={fixed:'Sabit faiz',variable:'Değişken faiz',profit_share:'Kâr payı',interest_free:'Faizsiz'};
  return <><PageHeader eyebrow="TCMB kataloglu · güvenli banka hesabı" title="Aile finansı" description="Banka hesapları merkezî finans politikasıyla korunur; IBAN yapısal kontrolü gerçek hesap veya sahiplik doğrulaması değildir."/>
    <section className="workspace-grid">
      <Surface className="workspace-form"><SectionHeader eyebrow="B4 güvenli veri sözleşmesi" title="Yeni banka hesabı"/>
        <label>Kayıt sahibi<select value={bankOwnerPersonId} onChange={event=>setBankOwner(event.target.value)}>{people.map(person=><option key={person.id} value={person.id}>{person.displayName}</option>)}</select></label>
        <label>Banka / kurum<select value={institutionCode} onChange={event=>setInstitutionCode(event.target.value)}><option value="">Seçin</option>{customerInstitutions.map(institution=><option key={institution.institutionCode} value={institution.institutionCode}>{institution.institutionCode} · {institution.officialName}</option>)}</select></label>
        <label>Hesap adı<input maxLength={100} value={bankAlias} onChange={event=>setBankAlias(event.target.value)} placeholder="Örn. Aile bütçesi"/></label>
        <label>IBAN<input autoComplete="off" spellCheck={false} maxLength={64} value={iban} onChange={event=>setIban(event.target.value)} placeholder="TRxx xxxx xxxx xxxx xxxx xxxx xx"/></label>
        <div className="notes-card" aria-live="polite"><strong>IBAN yapısal kontrolü: {ibanValidation?(ibanValidation.structurallyValid?'Geçerli':'Geçersiz'):'Bekleniyor'}</strong><small>Ülke/uzunluk {ibanValidation?.lengthValid?'✓':'—'} · MOD 97-10 {ibanValidation?.checksumValid?'✓':'—'} · TCMB kod eşleşmesi {ibanValidation?.institutionMatched?'✓':'—'}</small><small>Gerçek hesap doğrulaması: Yapılmadı · Sahiplik doğrulaması: Yapılmadı</small></div>
        <label>Hesap türü<select value={bankType} onChange={event=>setBankType(event.target.value as BankAccountView['accountType'])}>{Object.entries(typeLabels).map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label>
        <label>Para birimi<input maxLength={3} value={bankCurrency} onChange={event=>setBankCurrency(event.target.value.toUpperCase())}/></label>
        <label>Şube (isteğe bağlı)<input maxLength={120} value={bankBranch} onChange={event=>setBankBranch(event.target.value)}/></label>
        <label>Sahiplik oranı (%)<input type="number" min="0.01" max="100" step="0.01" value={ownershipPercent} onChange={event=>setOwnershipPercent(event.target.value)}/></label>
        <label>Durum<select value={bankStatus} onChange={event=>setBankStatus(event.target.value as BankAccountView['status'])}><option value="active">Aktif</option><option value="inactive">Pasif</option><option value="closed">Kapalı</option></select></label>
        <label>Gizlilik<select value={bankPrivacy} onChange={event=>setBankPrivacy(event.target.value as BankAccountView['privacy'])}><option value="private">Özel</option><option value="selected_members">Seçili üyeler</option><option value="family">Aile</option></select></label>
        <div className="notes-card"><strong>Bu form kart veya internet bankacılığı sırrı kabul etmez.</strong><small>Tam PAN, CVV/CVC, PIN ve internet bankacılığı parolası IPC ve uygulama sözleşmesinde reddedilir.</small></div>
        <Button tone="primary" onClick={()=>void createBankAccount()} disabled={!bankOwnerPersonId||!institutionCode||bankAlias.trim().length<2||!ibanValidation?.structurallyValid||ibanValidation.institutionCode!==institutionCode}>Banka hesabını kaydet</Button>{bankMessage&&<small>{bankMessage}</small>}
      </Surface>
      <Surface className="workspace-summary"><SectionHeader eyebrow={`${institutions.length} yerel katalog kaydı`} title={`${bankAccounts.length} banka hesabı`}/>
        {bankAccounts.length===0?<EmptyState title="Banka hesabı yok" body="İlk hesabı eklediğinizde yalnız maskeli IBAN burada görünür."/>:bankAccounts.map(account=><div className="context-stat" key={account.id}><strong>{account.alias} · {account.ibanMasked}</strong><span>{account.institutionCode} · {account.institutionOfficialName} · {typeLabels[account.accountType]} · {account.currency} · %{(account.ownershipBasisPoints/100).toLocaleString('tr-TR',{maximumFractionDigits:2})}</span><small>IBAN yapısal olarak geçerli · Gerçek hesap doğrulanmadı · Sahiplik doğrulanmadı</small></div>)}
        <div className="notes-card"><strong>Güvenli ikon kaynağı: yerel harf simgesi</strong><small>Uzak logo indirilmez. Katalog, TCMB Ödeme Sistemleri Katılımcıları 2026 listesine kaynak bağlıdır.</small></div>
      </Surface>
      <Surface className="workspace-form"><SectionHeader eyebrow="B4-05 + B4-06 · yalnız son dört hane" title="Yeni kart profili"/>
        <label>Kart sahibi<select value={cardOwnerPersonId} onChange={event=>setCardOwner(event.target.value)}>{people.map(person=><option key={person.id} value={person.id}>{person.displayName}</option>)}</select></label>
        <label>Banka / kurum<select value={cardInstitutionCode} onChange={event=>setCardInstitutionCode(event.target.value)}><option value="">Seçin</option>{customerInstitutions.map(institution=><option key={institution.institutionCode} value={institution.institutionCode}>{institution.institutionCode} · {institution.officialName}</option>)}</select></label>
        <label>Ürün adı<input maxLength={120} value={cardProductName} onChange={event=>setCardProductName(event.target.value)} placeholder="Örn. Aile kredi kartı"/></label>
        <label>Son dört hane<input inputMode="numeric" autoComplete="off" maxLength={4} value={cardLast4} onChange={event=>setCardLast4(event.target.value.replace(/\D/gu,'').slice(0,4))} placeholder="1234"/></label>
        <label>Kart türü<select value={cardKind} onChange={event=>setCardKind(event.target.value as PaymentCardView['kind'])}><option value="credit">Kredi kartı</option><option value="debit">Banka kartı</option><option value="prepaid">Ön ödemeli</option></select></label>
        <label>Kart ağı<select value={cardNetwork} onChange={event=>setCardNetwork(event.target.value as PaymentCardView['network'])}><option value="troy">TROY</option><option value="visa">Visa</option><option value="mastercard">Mastercard</option><option value="american_express">American Express</option><option value="unionpay">UnionPay</option><option value="other">Diğer</option></select></label>
        <label>Biçim<select value={cardFormFactor} onChange={event=>setCardFormFactor(event.target.value as PaymentCardView['formFactor'])}><option value="physical">Fiziksel</option><option value="virtual">Sanal</option><option value="supplementary">Ek kart</option></select></label>
        <label>Para birimi<input maxLength={3} value={cardCurrency} onChange={event=>setCardCurrency(event.target.value.toUpperCase())}/></label>
        <label>Toplam limit<input type="number" min="0" step="0.01" value={cardLimit} onChange={event=>setCardLimit(event.target.value)}/></label>
        <label>Kullanılabilir limit<input type="number" min="0" step="0.01" value={cardAvailable} onChange={event=>setCardAvailable(event.target.value)}/></label>
        <label>Güncel borç<input type="number" min="0" step="0.01" value={cardDebt} onChange={event=>setCardDebt(event.target.value)}/></label>
        <label>Ekstre borcu<input type="number" min="0" step="0.01" value={cardStatementBalance} onChange={event=>setCardStatementBalance(event.target.value)}/></label>
        <label>Ekstre kesim tarihi<input type="date" value={cardStatementClosing} onChange={event=>setCardStatementClosing(event.target.value)}/></label>
        <label>Son ödeme tarihi<input type="date" min={cardStatementClosing} value={cardPaymentDue} onChange={event=>setCardPaymentDue(event.target.value)}/></label>
        <label>Aktif taksit sayısı<input type="number" min="0" max="999" step="1" value={cardInstallmentCount} onChange={event=>setCardInstallmentCount(event.target.value)}/></label>
        <label>Kalan taksit tutarı<input type="number" min="0" step="0.01" value={cardInstallmentAmount} onChange={event=>setCardInstallmentAmount(event.target.value)}/></label>
        <label>Otomatik ödeme<select value={cardAutomaticPayment} onChange={event=>setCardAutomaticPayment(event.target.value as PaymentCardView['automaticPaymentMode'])}><option value="none">Talimat yok</option><option value="minimum">Asgari ödeme</option><option value="full">Ekstre borcunun tamamı</option></select></label>
        <label>Puan<input type="number" min="0" step="0.01" value={cardRewardPoints} onChange={event=>setCardRewardPoints(event.target.value)}/></label>
        <label>Mil<input type="number" min="0" step="0.01" value={cardRewardMiles} onChange={event=>setCardRewardMiles(event.target.value)}/></label>
        <label>Yıllık ücret<input type="number" min="0" step="0.01" value={cardAnnualFee} onChange={event=>setCardAnnualFee(event.target.value)}/></label>
        <label>Yıllık ücret tarihi<input type="date" value={cardAnnualFeeDue} onChange={event=>setCardAnnualFeeDue(event.target.value)}/></label>
        <label>Limit kullanım uyarısı (%)<input type="number" min="0.01" max="100" step="0.01" value={cardUtilizationAlert} onChange={event=>setCardUtilizationAlert(event.target.value)}/></label>
        <label>Son ödeme uyarısı (gün)<input type="number" min="0" max="365" step="1" value={cardDueAlertDays} onChange={event=>setCardDueAlertDays(event.target.value)}/></label>
        <label>Uyarılar<select value={cardAlertsEnabled?'enabled':'disabled'} onChange={event=>setCardAlertsEnabled(event.target.value==='enabled')}><option value="enabled">Etkin</option><option value="disabled">Kapalı</option></select></label>
        <label>Durum<select value={cardStatus} onChange={event=>setCardStatus(event.target.value as PaymentCardView['status'])}><option value="active">Aktif</option><option value="frozen">Donduruldu</option><option value="closed">Kapalı</option></select></label>
        <label>Gizlilik<select value={cardPrivacy} onChange={event=>setCardPrivacy(event.target.value as PaymentCardView['privacy'])}><option value="private">Özel</option><option value="selected_members">Seçili üyeler</option><option value="family">Aile</option></select></label>
        <div className="notes-card"><strong>Tam kart numarası kesinlikle kaydedilmez.</strong><small>Otomatik ödeme alanı yalnız takip modudur; banka talimatı veya ödeme işlemi başlatmaz. CVV/CVC, PIN ve parola kabul edilmez.</small></div>
        <Button tone="primary" onClick={()=>void createPaymentCard()} disabled={!cardOwnerPersonId||!cardInstitutionCode||cardProductName.trim().length<2||!/^\d{4}$/u.test(cardLast4)||!cardLimit||!cardAvailable||!cardStatementClosing||!cardPaymentDue}>Kart profilini kaydet</Button>{cardMessage&&<small>{cardMessage}</small>}
      </Surface>
      <Surface className="workspace-summary"><SectionHeader eyebrow="Limit · ekstre · taksit · ödül" title={`${paymentCards.length} kart profili`}/>
        {paymentCards.length===0?<EmptyState title="Kart profili yok" body="İlk kartı yalnız son dört haneyle güvenli biçimde ekleyin."/>:paymentCards.map(card=>{const used=card.creditLimit>0?Math.max(0,card.creditLimit-card.availableLimit):0;const utilization=card.creditLimit>0?(used/card.creditLimit)*100:0;const limitAlert=card.alertsEnabled&&utilization*100>=card.utilizationAlertBasisPoints;const dueDays=Math.ceil((new Date(card.paymentDueAt).getTime()-Date.now())/86_400_000);const dueAlert=card.alertsEnabled&&card.currentDebt>0&&dueDays>=0&&dueDays<=card.paymentDueAlertDays;return <div className="context-stat" key={card.id}><strong>{card.productName} · •••• {card.last4}</strong><span>{card.institutionOfficialName} · {cardKindLabels[card.kind]} · {cardFormLabels[card.formFactor]} · {card.network.toLocaleUpperCase('tr-TR')}</span><small>Limit {card.creditLimit.toLocaleString('tr-TR')} {card.currency} · Kullanılabilir {card.availableLimit.toLocaleString('tr-TR')} · Borç {card.currentDebt.toLocaleString('tr-TR')} · Ekstre {card.statementBalance.toLocaleString('tr-TR')}</small><small>{card.activeInstallmentCount} aktif taksit / {card.installmentOutstandingAmount.toLocaleString('tr-TR')} {card.currency} · {automaticPaymentLabels[card.automaticPaymentMode]} · {card.rewardPoints.toLocaleString('tr-TR')} puan · {card.rewardMiles.toLocaleString('tr-TR')} mil</small><small>Yıllık ücret {card.annualFeeAmount.toLocaleString('tr-TR')} {card.currency}{card.annualFeeDueAt?` · ${formatDate(card.annualFeeDueAt)}`:''} · Son ödeme ${formatDate(card.paymentDueAt)}</small>{(limitAlert||dueAlert)&&<strong>{[limitAlert?'Limit kullanım uyarısı':'',dueAlert?'Son ödeme yaklaşıyor':''].filter(Boolean).join(' · ')}</strong>}</div>;})}
      </Surface>
      <Surface className="workspace-form"><SectionHeader eyebrow="B4-08 + B4-09 · manuel ve doğrulanmamış" title="Yeni kredi profili"/>
        <label>Kredi sahibi<select value={loanOwnerPersonId} onChange={event=>setLoanOwner(event.target.value)}>{people.map(person=><option key={person.id} value={person.id}>{person.displayName}</option>)}</select></label>
        <label>Banka / kurum<select value={loanInstitutionCode} onChange={event=>setLoanInstitutionCode(event.target.value)}><option value="">Seçin</option>{customerInstitutions.map(institution=><option key={institution.institutionCode} value={institution.institutionCode}>{institution.institutionCode} · {institution.officialName}</option>)}</select></label>
        <label>Kredi adı<input maxLength={120} value={loanTitle} onChange={event=>setLoanTitle(event.target.value)} placeholder="Örn. Konut kredisi"/></label>
        <label>Kredi türü<select value={loanKind} onChange={event=>setLoanKind(event.target.value as LoanAccountView['kind'])}>{Object.entries(loanKindLabels).map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label>
        <label>Oran türü<select value={loanRateType} onChange={event=>{const next=event.target.value as LoanAccountView['rateType'];setLoanRateType(next);if(next==='interest_free')setLoanAnnualRate('0');}}>{Object.entries(loanRateLabels).map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label>
        <label>Yıllık oran (%)<input type="number" min="0" max="1000" step="0.01" disabled={loanRateType==='interest_free'} value={loanAnnualRate} onChange={event=>setLoanAnnualRate(event.target.value)}/></label>
        <label>Vade (ay)<input type="number" min="1" max="600" step="1" value={loanTermMonths} onChange={event=>setLoanTermMonths(event.target.value)}/></label>
        <label>Para birimi<input maxLength={3} value={loanCurrency} onChange={event=>setLoanCurrency(event.target.value.toUpperCase())}/></label>
        <label>İlk anapara<input type="number" min="0.01" step="0.01" value={loanOriginalPrincipal} onChange={event=>{setLoanOriginalPrincipal(event.target.value);if(!loanRemainingPrincipal)setLoanRemainingPrincipal(event.target.value);}}/></label>
        <label>Aylık taksit<input type="number" min="0.01" step="0.01" value={loanInstallmentAmount} onChange={event=>setLoanInstallmentAmount(event.target.value)}/></label>
        <label>Kalan anapara<input type="number" min="0" step="0.01" value={loanRemainingPrincipal} onChange={event=>setLoanRemainingPrincipal(event.target.value)}/></label>
        <label>Kullandırım tarihi<input type="date" value={loanDisbursedAt} onChange={event=>setLoanDisbursedAt(event.target.value)}/></label>
        <label>İlk ödeme tarihi<input type="date" min={loanDisbursedAt} value={loanFirstPaymentAt} onChange={event=>setLoanFirstPaymentAt(event.target.value)}/></label>
        <label>Erken kapama teklifi<input type="number" min="0" step="0.01" value={loanEarlySettlementAmount} onChange={event=>setLoanEarlySettlementAmount(event.target.value)}/></label>
        <label>Teklif tarihi<input type="date" disabled={Number(loanEarlySettlementAmount)<=0} value={loanEarlySettlementQuotedAt} onChange={event=>setLoanEarlySettlementQuotedAt(event.target.value)}/></label>
        <label>Gecikmiş taksit<input type="number" min="0" max="600" step="1" value={loanOverdueCount} onChange={event=>setLoanOverdueCount(event.target.value)}/></label>
        <label>Gecikmiş tutar<input type="number" min="0" step="0.01" value={loanOverdueAmount} onChange={event=>setLoanOverdueAmount(event.target.value)}/></label>
        <label>Gecikme günü<input type="number" min="0" max="36500" step="1" value={loanDaysPastDue} onChange={event=>setLoanDaysPastDue(event.target.value)}/></label>
        <label>Durum<select value={loanStatus} onChange={event=>setLoanStatus(event.target.value as LoanAccountView['status'])}><option value="active">Aktif</option><option value="overdue">Gecikmede</option><option value="restructured">Yapılandırıldı</option><option value="closed">Kapalı</option></select></label>
        <label>Sigorta<select value={loanInsuranceStatus} onChange={event=>setLoanInsuranceStatus(event.target.value as LoanAccountView['insuranceStatus'])}><option value="none">Yok</option><option value="active">Aktif</option><option value="expired">Süresi doldu</option><option value="cancelled">İptal</option></select></label>
        <label>Sigorta sağlayıcısı<input maxLength={120} disabled={loanInsuranceStatus==='none'} value={loanInsuranceProvider} onChange={event=>setLoanInsuranceProvider(event.target.value)}/></label>
        <label>Poliçe referansı<input maxLength={120} autoComplete="off" disabled={loanInsuranceStatus==='none'} value={loanInsuranceReference} onChange={event=>setLoanInsuranceReference(event.target.value)}/></label>
        <label>Sigorta primi<input type="number" min="0" step="0.01" disabled={loanInsuranceStatus==='none'} value={loanInsurancePremium} onChange={event=>setLoanInsurancePremium(event.target.value)}/></label>
        <label>Sigorta bitişi<input type="date" disabled={loanInsuranceStatus==='none'} value={loanInsuranceEndsAt} onChange={event=>setLoanInsuranceEndsAt(event.target.value)}/></label>
        <label>Teminat türü<select value={loanCollateralType} onChange={event=>setLoanCollateralType(event.target.value as LoanAccountView['collateralType'])}><option value="none">Yok</option><option value="vehicle">Araç</option><option value="real_estate">Gayrimenkul</option><option value="deposit">Mevduat</option><option value="guarantee">Kefalet</option><option value="other">Diğer</option></select></label>
        <label>Teminat açıklaması<input maxLength={240} disabled={loanCollateralType==='none'} value={loanCollateralDescription} onChange={event=>setLoanCollateralDescription(event.target.value)}/></label>
        <label>Teminat tahmini değeri<input type="number" min="0" step="0.01" disabled={loanCollateralType==='none'} value={loanCollateralValue} onChange={event=>setLoanCollateralValue(event.target.value)}/></label>
        <label>Gizlilik<select value={loanPrivacy} onChange={event=>setLoanPrivacy(event.target.value as LoanAccountView['privacy'])}><option value="private">Özel</option><option value="selected_members">Seçili üyeler</option><option value="family">Aile</option></select></label>
        <div className="notes-card"><strong>Banka bağlantısı ve ödeme icrası yoktur.</strong><small>Vade planı ilk ödeme tarihinden aylık üretilir. Faiz, kalan anapara, erken kapama, gecikme, sigorta ve teminat değerleri kullanıcı beyanıdır; banka tarafından doğrulanmaz.</small></div>
        <Button tone="primary" onClick={()=>void createLoanAccount()} disabled={!loanOwnerPersonId||!loanInstitutionCode||loanTitle.trim().length<2||!loanTermMonths||!loanOriginalPrincipal||!loanInstallmentAmount||loanRemainingPrincipal===''||!loanDisbursedAt||!loanFirstPaymentAt}>Kredi ve ödeme planını kaydet</Button>{loanMessage&&<small>{loanMessage}</small>}
      </Surface>
      <Surface className="workspace-summary"><SectionHeader eyebrow="Anapara · vade · gecikme · teminat" title={`${loanAccounts.length} kredi profili`}/>
        {loanAccounts.length===0?<EmptyState title="Kredi profili yok" body="İlk krediyi manuel takip kaydı olarak ekleyin."/>:loanAccounts.map(loan=>{const totalPaid=loan.paymentHistory.reduce((sum,payment)=>sum+payment.amount,0);const first=loan.paymentSchedule[0];const last=loan.paymentSchedule.at(-1);return <div className="context-stat" key={loan.id}><strong>{loan.title} · {loanKindLabels[loan.kind]} · {loan.status}</strong><span>{loan.institutionOfficialName} · {loanRateLabels[loan.rateType]} %{(loan.annualRateBasisPoints/100).toLocaleString('tr-TR',{maximumFractionDigits:2})} · {loan.termMonths} ay</span><small>İlk anapara {loan.originalPrincipal.toLocaleString('tr-TR')} {loan.currency} · Kalan {loan.remainingPrincipal.toLocaleString('tr-TR')} · Taksit {loan.installmentAmount.toLocaleString('tr-TR')}</small><small>Plan {first?formatDate(first.dueAt):'—'} — {last?formatDate(last.dueAt):'—'} · {loan.paymentSchedule.length} taksit · Kayıtlı ödeme {totalPaid.toLocaleString('tr-TR')} {loan.currency}</small><small>Erken kapama {loan.earlySettlementAmount>0?`${loan.earlySettlementAmount.toLocaleString('tr-TR')} · ${formatDate(loan.earlySettlementQuotedAt!)}`:'teklifi yok'} · Gecikme {loan.overdueInstallmentCount} taksit / {loan.overdueAmount.toLocaleString('tr-TR')} · {loan.daysPastDue} gün</small><small>Sigorta {loan.insuranceStatus}{loan.insuranceProvider?` · ${loan.insuranceProvider}`:''} · Teminat {loan.collateralType}{loan.collateralDescription?` · ${loan.collateralDescription}`:''}</small><small>Manuel veri · Banka doğrulaması yapılmadı · Ödeme icrası yapılmadı</small>{loan.paymentHistory.slice(0,3).map(payment=><span key={payment.id}>{formatDate(payment.paidAt)} · {payment.amount.toLocaleString('tr-TR')} {loan.currency}{payment.scheduledInstallmentSequence?` · ${payment.scheduledInstallmentSequence}. taksit`:''}</span>)}</div>;})}
      </Surface>
      <Surface className="workspace-form"><SectionHeader eyebrow="Append-only ödeme geçmişi" title="Kredi ödemesi kaydet"/>
        <label>Kredi<select value={paymentLoanId} onChange={event=>setPaymentLoanId(event.target.value)}><option value="">Seçin</option>{loanAccounts.map(loan=><option key={loan.id} value={loan.id}>{loan.title} · {loan.institutionOfficialName}</option>)}</select></label>
        <label>Ödeme tarihi<input type="date" value={loanPaymentAt} onChange={event=>setLoanPaymentAt(event.target.value)}/></label>
        <label>Taksit sırası<input type="number" min="1" max={loanAccounts.find(loan=>loan.id===paymentLoanId)?.termMonths??600} step="1" value={loanPaymentSequence} onChange={event=>setLoanPaymentSequence(event.target.value)}/></label>
        <label>Anapara payı<input type="number" min="0" step="0.01" value={loanPaymentPrincipal} onChange={event=>setLoanPaymentPrincipal(event.target.value)}/></label>
        <label>Faiz / kâr payı<input type="number" min="0" step="0.01" value={loanPaymentInterest} onChange={event=>setLoanPaymentInterest(event.target.value)}/></label>
        <label>Gecikme ücreti<input type="number" min="0" step="0.01" value={loanPaymentLateFee} onChange={event=>setLoanPaymentLateFee(event.target.value)}/></label>
        <label>Not<input maxLength={500} value={loanPaymentNotes} onChange={event=>setLoanPaymentNotes(event.target.value)}/></label>
        <div className="notes-card"><strong>Toplam {(Number(loanPaymentPrincipal||'0')+Number(loanPaymentInterest||'0')+Number(loanPaymentLateFee||'0')).toLocaleString('tr-TR')} {loanAccounts.find(loan=>loan.id===paymentLoanId)?.currency??''}</strong><small>Bu işlem yalnız yerel ödeme geçmişine kayıt ekler; bankaya para göndermez ve kalan anaparayı otomatik değiştirmez.</small></div>
        <Button tone="primary" onClick={()=>void recordLoanPayment()} disabled={!paymentLoanId||!loanPaymentAt||Number(loanPaymentPrincipal||'0')+Number(loanPaymentInterest||'0')+Number(loanPaymentLateFee||'0')<=0}>Ödeme geçmişine ekle</Button>{loanPaymentMessage&&<small>{loanPaymentMessage}</small>}
      </Surface>
      <article className="panel workspace-form"><h2>Yeni finans kaydı</h2><label>Kayıt sahibi<select value={ownerPersonId} onChange={e=>setOwner(e.target.value)}>{people.map(x=><option key={x.id} value={x.id}>{x.displayName}</option>)}</select></label><label>Başlık<input value={title} onChange={e=>setTitle(e.target.value)}/></label><label>Tür<select value={kind} onChange={e=>setKind(e.target.value as FinanceRecordView['kind'])}><option value="asset">Varlık</option><option value="debt">Borç</option><option value="income">Gelir</option><option value="expense">Gider</option></select></label><label>Tutar<input type="number" min="0" value={amount} onChange={e=>setAmount(e.target.value)}/></label><label>Para birimi<input value={currency} onChange={e=>setCurrency(e.target.value.toUpperCase())}/></label><label>Sembol<input value={symbol} onChange={e=>setSymbol(e.target.value.toUpperCase())} placeholder="USD, XAU, THYAO"/></label><label>Vade<input type="date" value={dueAt} onChange={e=>setDueAt(e.target.value)}/></label><label>Kalan anapara<input type="number" min="0" value={remaining} onChange={e=>setRemaining(e.target.value)}/></label><label>Gizlilik<select value={privacy} onChange={e=>setPrivacy(e.target.value as FinanceRecordView['privacy'])}><option value="private">Özel</option><option value="selected_members">Seçili üyeler</option><option value="family">Aile</option></select></label><Button tone="primary" onClick={()=>void submit()} disabled={!ownerPersonId||title.trim().length<2||!amount}>Kaydet</Button><hr/><h3>Günlük değerleme</h3><label>Kayıt<select value={valuationRecord} onChange={e=>setValuationRecord(e.target.value)}><option value="">Seçin</option>{records.filter(r=>r.kind==='asset'||r.kind==='debt').map(r=><option key={r.id} value={r.id}>{r.title}</option>)}</select></label><label>Birim fiyat<input type="number" min="0" step="any" value={unitPrice} onChange={e=>setUnitPrice(e.target.value)}/></label><label>Miktar<input type="number" min="0" step="any" value={quantity} onChange={e=>setQuantity(e.target.value)}/></label><Button onClick={()=>void addValuation()} disabled={!valuationRecord||!unitPrice||!quantity}>Değerlemeyi kaydet</Button>{message&&<small>{message}</small>}</article>
      <article className="panel workspace-summary"><span className="eyebrow">Görüntüleyebildiğiniz kayıtlar</span><h2>Güncel net görünüm: {net.toLocaleString('tr-TR',{maximumFractionDigits:2})}</h2>{records.map(r=>{const v=latest.get(r.id);return <div className="context-stat" key={r.id}><strong>{r.title} · {(v?.marketValue??r.remainingPrincipal??r.amount).toLocaleString('tr-TR')} {r.currency}</strong><span>{people.find(p=>p.id===r.ownerPersonId)?.displayName} · {r.kind}{r.symbol?` · ${r.symbol}`:''}{r.dueAt?` · Vade ${formatDate(r.dueAt)}`:''}{v?` · ${v.provider} değerleme`:''}</span></div>})}</article>
    </section><section className="workspace-grid"><FinancePlanningPanel people={people} workspace={planningWorkspace} onRecord={onRecordPlanning} onWorkspaceChange={onPlanningWorkspaceChange}/></section></>;
}

function FinanceScreen({longTermPortfolioWorkspace,onRecordLongTermPortfolio,...props}: Parameters<typeof FinanceOverviewScreen>[0]&{longTermPortfolioWorkspace:LongTermPortfolioWorkspaceView|undefined;onRecordLongTermPortfolio:(input:RecordLongTermPortfolioItemInput)=>Promise<void>}) {
  const [section,setSection]=useState<'overview'|'long-term-portfolio'>('overview');
  return <>
    <nav className="finance-section-tabs" aria-label="Finans bölümleri">
      <Button tone={section==='overview'?'primary':'default'} onClick={()=>setSection('overview')}>Genel finans</Button>
      <Button tone={section==='long-term-portfolio'?'primary':'default'} onClick={()=>setSection('long-term-portfolio')}>Uzun Vadeli Portföy</Button>
    </nav>
    {section==='overview'
      ? <FinanceOverviewScreen {...props}/>
      : <LongTermPortfolioPanel people={props.people} workspace={longTermPortfolioWorkspace} onRecord={onRecordLongTermPortfolio}/>}
  </>;
}

export function HealthScreen({people,records,medications,history,onCreate,onCreateMedication,onCreateHistory}:{people:FamilyMemberView[];records:HealthRecordView[];medications:MedicationPlanView[];history:FamilyHealthHistoryView[];onCreate:(input:CreateHealthRecordInput)=>Promise<void>;onCreateMedication:(input:CreateMedicationPlanInput)=>Promise<void>;onCreateHistory:(input:CreateFamilyHealthHistoryInput)=>Promise<void>}){
  const {language}=useLocalization();
  const [ownerPersonId,setOwner]=useState(people[0]?.id??''); const [title,setTitle]=useState(''); const [kind,setKind]=useState<HealthRecordView['kind']>('appointment'); const [privacy,setPrivacy]=useState<HealthRecordView['privacy']>('private'); const [provider,setProvider]=useState(''); const [medName,setMedName]=useState(''); const [dosage,setDosage]=useState(''); const [schedule,setSchedule]=useState(''); const [condition,setCondition]=useState(''); const [message,setMessage]=useState('');
  const submit=async()=>{try{await onCreate({ownerPersonId,title,kind,privacy,...(provider?{provider}:{}),occurredAt:new Date().toISOString()});setTitle('');setProvider('');setMessage('Sağlık kaydı eklendi.');}catch(e){setMessage(e instanceof Error?e.message:'Kayıt eklenemedi.');}};
  const addMedication=async()=>{try{await onCreateMedication({ownerPersonId,name:medName,dosage,schedule,privacy,startsAt:new Date().toISOString(),...(provider?{provider}:{})});setMedName('');setDosage('');setSchedule('');setMessage('İlaç/tedavi planı eklendi.');}catch(e){setMessage(e instanceof Error?e.message:'Plan eklenemedi.');}};
  const addHistory=async()=>{try{await onCreateHistory({relatedPersonId:ownerPersonId,condition,privacy});setCondition('');setMessage('Aile sağlık geçmişi eklendi.');}catch(e){setMessage(e instanceof Error?e.message:'Geçmiş eklenemedi.');}};
  const panel=<><PageHeader eyebrow="Yüksek gizlilik" title="Sağlık merkezi" description="Sağlık olayları, ilaç/tedavi planları ve aile sağlık geçmişi tek izin modeli altında tutulur."/><section className="workspace-grid"><article className="panel workspace-form"><h2>Yeni sağlık kaydı</h2><label>Kayıt sahibi<select value={ownerPersonId} onChange={e=>setOwner(e.target.value)}>{people.map(x=><option key={x.id} value={x.id}>{x.displayName}</option>)}</select></label><label>Başlık<input value={title} onChange={e=>setTitle(e.target.value)}/></label><label>Tür<select value={kind} onChange={e=>setKind(e.target.value as HealthRecordView['kind'])}><option value="appointment">Randevu</option><option value="medication">İlaç</option><option value="diagnosis">Tanı</option><option value="vaccine">Aşı</option><option value="note">Not</option></select></label><label>Hekim/Kurum<input value={provider} onChange={e=>setProvider(e.target.value)}/></label><label>Gizlilik<select value={privacy} onChange={e=>setPrivacy(e.target.value as HealthRecordView['privacy'])}><option value="private">Özel</option><option value="selected_members">Seçili üyeler</option><option value="family">Aile</option></select></label><Button tone="primary" onClick={()=>void submit()} disabled={!ownerPersonId||title.trim().length<2}>Kaydet</Button><hr/><h3>İlaç / tedavi planı</h3><label>İlaç veya tedavi<input value={medName} onChange={e=>setMedName(e.target.value)}/></label><label>Doz<input value={dosage} onChange={e=>setDosage(e.target.value)} placeholder="1 tablet"/></label><label>Kullanım planı<input value={schedule} onChange={e=>setSchedule(e.target.value)} placeholder="08:00 ve 20:00"/></label><Button onClick={()=>void addMedication()} disabled={!medName||!dosage||!schedule}>Planı ekle</Button><hr/><h3>Aile sağlık geçmişi</h3><label>Rahatsızlık / durum<input value={condition} onChange={e=>setCondition(e.target.value)}/></label><Button onClick={()=>void addHistory()} disabled={!condition}>Geçmişe ekle</Button>{message&&<small>{message}</small>}</article><article className="panel workspace-summary"><span className="eyebrow">Görüntüleyebildiğiniz sağlık verileri</span><h2>{records.length} kayıt · {medications.length} plan · {history.length} geçmiş</h2>{medications.map(r=><div className="context-stat" key={r.id}><strong>{r.name} · {r.dosage}</strong><span>{people.find(p=>p.id===r.ownerPersonId)?.displayName} · {r.schedule}{r.provider?` · ${r.provider}`:''}</span></div>)}{history.map(r=><div className="context-stat" key={r.id}><strong>{r.condition}</strong><span>{people.find(p=>p.id===r.relatedPersonId)?.displayName} · aile sağlık geçmişi</span></div>)}{records.map(r=><div className="context-stat" key={r.id}><strong>{r.title}</strong><span>{people.find(p=>p.id===r.ownerPersonId)?.displayName} · {r.kind} · {r.privacy}{r.provider?` · ${r.provider}`:''}</span></div>)}</article></section></>;
  return localizeOperationsCenterNode(panel,language);
}

export function LifeCenterScreen({people,records,onCreate}:{people:FamilyMemberView[];records:LifeRecordView[];onCreate:(input:CreateLifeRecordInput)=>Promise<void>}){
  const {language}=useLocalization();
  const [ownerPersonId,setOwner]=useState(people[0]?.id??''); const [category,setCategory]=useState<LifeRecordView['category']>('task'); const [title,setTitle]=useState(''); const [status,setStatus]=useState<LifeRecordView['status']>('active'); const [privacy,setPrivacy]=useState<LifeRecordView['privacy']>('private'); const [dueAt,setDueAt]=useState(''); const [provider,setProvider]=useState(''); const [amount,setAmount]=useState(''); const [message,setMessage]=useState('');
  const labels:Record<LifeRecordView['category'],string>={task:'Görev',insurance:'Sigorta',education:'Eğitim',subscription:'Abonelik',official_operation:'Resmî işlem',employment:'İş geçmişi',property:'Ev / araç',emergency:'Acil durum'};
  const submit=async()=>{try{await onCreate({ownerPersonId,category,title,status,privacy,...(dueAt?{dueAt:new Date(dueAt).toISOString()}:{}),...(provider?{provider}:{}),...(amount?{amount:Number(amount),currency:'TRY'}:{})});setTitle('');setMessage('Yaşam kaydı eklendi.');}catch(e){setMessage(e instanceof Error?e.message:'Kayıt eklenemedi.');}};
  const panel=<><PageHeader eyebrow="Aile operasyon merkezi" title="Yaşam merkezi" description="Görev, sigorta, eğitim, iş geçmişi, ev–araç varlıkları ve acil durum planlarını tek güvenli kayıt modelinde yönetin."/><section className="workspace-grid"><article className="panel workspace-form"><h2>Yeni yaşam kaydı</h2><label>Kayıt sahibi<select value={ownerPersonId} onChange={e=>setOwner(e.target.value)}>{people.map(p=><option key={p.id} value={p.id}>{p.displayName}</option>)}</select></label><label>Kategori<select value={category} onChange={e=>setCategory(e.target.value as LifeRecordView['category'])}>{Object.entries(labels).map(([k,v])=><option key={k} value={k}>{v}</option>)}</select></label><label>Başlık<input value={title} onChange={e=>setTitle(e.target.value)}/></label><label>Durum<select value={status} onChange={e=>setStatus(e.target.value as LifeRecordView['status'])}><option value="planned">Planlandı</option><option value="active">Aktif</option><option value="completed">Tamamlandı</option><option value="expired">Süresi doldu</option><option value="cancelled">İptal</option></select></label><label>Vade / tarih<input type="datetime-local" value={dueAt} onChange={e=>setDueAt(e.target.value)}/></label><label>Kurum / sağlayıcı<input value={provider} onChange={e=>setProvider(e.target.value)}/></label><label>Tutar<input type="number" value={amount} onChange={e=>setAmount(e.target.value)}/></label><label>Gizlilik<select value={privacy} onChange={e=>setPrivacy(e.target.value as LifeRecordView['privacy'])}><option value="private">Özel</option><option value="selected_members">Seçili üyeler</option><option value="family">Aile</option></select></label><Button tone="primary" onClick={()=>void submit()} disabled={!ownerPersonId||title.trim().length<2}>Kaydet</Button>{message&&<small>{message}</small>}</article><article className="panel workspace-summary"><span className="eyebrow">Erişebildiğiniz kayıtlar</span><h2>{records.length} yaşam kaydı</h2>{Object.entries(labels).map(([key,label])=><div className="context-stat" key={key}><strong>{label}</strong><span>{records.filter(r=>r.category===key).length} kayıt</span></div>)}{records.map(r=><div className="context-stat" key={r.id}><strong>{r.title}</strong><span>{labels[r.category]} · {people.find(p=>p.id===r.ownerPersonId)?.displayName} · {r.status}{r.dueAt?` · ${formatDate(r.dueAt)}`:''}</span></div>)}</article></section></>;
  return localizeOperationsCenterNode(panel,language);
}

export function AutomationScreen({rules,onCreate,onToggle}:{rules:AutomationRuleView[];onCreate:(input:CreateAutomationRuleInput)=>Promise<void>;onToggle:(id:string,enabled:boolean)=>Promise<void>}){
  const {language}=useLocalization();
  const [title,setTitle]=useState(language==='tr'?'Yaklaşan görev hatırlatması':'Upcoming task reminder'); const [sourceType,setSourceType]=useState<AutomationRuleView['sourceType']>('life_record'); const [daysBefore,setDaysBefore]=useState(3); const [message,setMessage]=useState(''); const [messageTone,setMessageTone]=useState<'success'|'danger'>('success');
  const [runs,setRuns]=useState<AutomationRunView[]>([]);
  useEffect(()=>{if(window.pardus)void window.pardus.listAutomationRuns().then(setRuns);},[]);
  const runNow=async()=>{try{if(!window.pardus)return;setRuns(await window.pardus.runAutomationRules());setMessageTone('success');setMessage('Etkin kurallar şimdi değerlendirildi.');}catch(e){setMessageTone('danger');setMessage(e instanceof Error?e.message:'Kurallar çalıştırılamadı.');}};
  const submit=async()=>{try{await onCreate({title,sourceType,daysBefore,enabled:true});setMessageTone('success');setMessage('Otomasyon kuralı eklendi.');}catch(e){setMessageTone('danger');setMessage(e instanceof Error?e.message:'Kural eklenemedi.');}};
  const panel=<><PageHeader eyebrow="Akıllı takip" title="Bildirim ve otomasyon merkezi" description="Önemli gün, görev, finans ve ilaç planları için yerel hatırlatma kuralları oluşturun." actions={<Button tone="primary" onClick={()=>void runNow()}>Kuralları şimdi çalıştır</Button>}/><section className="workspace-grid"><Surface className="workspace-form"><SectionHeader eyebrow="Yeni kural" title="Otomasyon oluştur"/><label>Başlık<input value={title} onChange={e=>setTitle(e.target.value)}/></label><label>Kaynak<select value={sourceType} onChange={e=>setSourceType(e.target.value as AutomationRuleView['sourceType'])}><option value="important_day">Önemli gün</option><option value="life_record">Yaşam kaydı</option><option value="finance_record">Finans kaydı</option><option value="medication_plan">İlaç planı</option></select></label><label>Kaç gün önce<input type="number" min="0" max="365" value={daysBefore} onChange={e=>setDaysBefore(Number(e.target.value))}/></label><Button tone="primary" onClick={()=>void submit()} disabled={!title.trim()}>Kural ekle</Button>{message&&<StatusMessage tone={messageTone}>{message}</StatusMessage>}</Surface><Surface className="workspace-summary"><SectionHeader eyebrow="Kurallar" title={`${rules.length} otomasyon`}/>{rules.length?rules.map(r=><StatRow key={r.id} value={r.title} label={`${r.sourceType} · ${r.daysBefore} gün önce · ${r.enabled?'Etkin':'Kapalı'}`} action={<Button onClick={()=>void onToggle(r.id,!r.enabled)}>{r.enabled?'Kapat':'Etkinleştir'}</Button>}/>):<EmptyState title="Kural yok" body="İlk otomasyon kuralınızı oluşturun."/>}</Surface><Surface className="span-2"><SectionHeader eyebrow="Çalışma geçmişi" title={`${runs.length} sonuç`}/>{runs.length?runs.slice(0,20).map(run=><StatRow key={run.id} value={run.title} label={`${run.status==='generated'?'Görev üretildi':run.status==='skipped'?'Atlandı':'Başarısız'} · ${formatDate(run.createdAt,{dateStyle:'short',timeStyle:'short'})}`}/>):<EmptyState title="Henüz çalışma yok" body="Kuralları şimdi çalıştırdığınızda sonuçlar burada görünür"/>}</Surface></section></>;
  return localizeOperationsCenterNode(panel,language);
}

export function ReportsScreen({report}:{report:ReportSummaryView|undefined}){
  const {language}=useLocalization();
  if(!report) return localizeOperationsCenterNode(<div className="loading-screen"><div className="loader"/><strong>Rapor hazırlanıyor…</strong></div>,language);
  const exportPdf=async()=>{if(!window.pardus)return;const result=await window.pardus.exportSystemPdf();if(!result.canceled)alert(`PDF raporu kaydedildi:\n${result.filePath??''}`);};
  const panel=<><PageHeader eyebrow="Aile görünümü" title="Raporlama merkezi" description={`Son üretim: ${formatDate(report.generatedAt,{dateStyle:'medium',timeStyle:'short'})}`} actions={<Button tone="primary" onClick={()=>void exportPdf()}>PDF raporu oluştur</Button>}/><section className="workspace-grid"><Surface className="workspace-form"><SectionHeader eyebrow="Operasyon" title="Aile özeti"/><StatRow value={report.peopleCount} label="Aktif aile üyesi"/><StatRow value={report.upcomingEvents} label="30 gün içindeki etkinlik"/><StatRow value={report.activeTasks} label="Aktif görev"/><StatRow value={report.expiringInsurance} label="30 gün içinde bitecek sigorta"/><StatRow value={report.activeMedicationPlans} label="Aktif ilaç planı"/></Surface><Surface className="workspace-summary"><SectionHeader eyebrow="Finans ve gecikmeler" title="Özet"/>{report.financeByCurrency.map(x=><StatRow key={x.currency} value={`${x.currency} ${x.net.toLocaleString('tr-TR')}`} label={`Varlık ${x.assets.toLocaleString('tr-TR')} · Borç ${x.debts.toLocaleString('tr-TR')}`}/>)}{report.overdueItems.length?report.overdueItems.map(x=><StatRow key={x.id} value={x.title} label={`Gecikmiş · ${formatDate(x.dueAt)}`}/>):<EmptyState title="Gecikmiş kayıt yok" body="Takip edilen tüm kayıtlar güncel görünüyor."/>}</Surface></section></>;
  return localizeOperationsCenterNode(panel,language);
}

export function SessionLockOverlay({state,twoFactorEnabled,onContinue,onLockNow,onUnlock}:{
  state:SessionLockStateView;
  twoFactorEnabled:boolean;
  onContinue:()=>Promise<void>;
  onLockNow:()=>Promise<void>;
  onUnlock:(input:UnlockSessionInput)=>Promise<void>;
}){
  const {language}=useLocalization();
  const rootRef=useRef<HTMLDivElement>(null);
  const [password,setPassword]=useState('');
  const [secondFactorCode,setSecondFactorCode]=useState('');
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');
  useEffect(()=>{
    const trap=(event:KeyboardEvent)=>{
      if(event.key!=='Tab'||!rootRef.current)return;
      const focusable=Array.from(rootRef.current.querySelectorAll<HTMLElement>('input,button:not([disabled])'));
      if(!focusable.length)return;
      const first=focusable[0]!,last=focusable[focusable.length-1]!;
      if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus();}
      else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}
    };
    document.addEventListener('keydown',trap);
    return()=>document.removeEventListener('keydown',trap);
  },[state.status]);
  const submitUnlock=async(event:FormEvent)=>{
    event.preventDefault();
    if(!password||twoFactorEnabled&&!secondFactorCode.trim())return;
    setBusy(true);setError('');
    try{
      await onUnlock({password,...(secondFactorCode.trim()?{secondFactorCode:secondFactorCode.trim()}:{} )});
      setPassword('');setSecondFactorCode('');
    }catch(caught){setError(caught instanceof Error?caught.message:'Oturum yeniden açılamadı.');}
    finally{setBusy(false);}
  };
  if(state.status==='warning')return localizeRepairAndSessionNode(<div ref={rootRef} className="session-lock-backdrop warning" role="alertdialog" aria-modal="true" aria-labelledby="session-warning-title" aria-describedby="session-warning-description">
    <section className="session-lock-card">
      <span className="session-lock-icon" aria-hidden="true">⌛</span>
      <span className="eyebrow">Güvenli oturum uyarısı</span>
      <h2 id="session-warning-title">Oturum {state.secondsRemaining} saniye içinde kilitlenecek</h2>
      <p id="session-warning-description">Kaydedilmemiş form bilgileriniz ekranda korunacak. Devam etmek için etkinliğinizi doğrulayın veya şimdi kilitleyin.</p>
      <div className="button-row"><Button tone="primary" autoFocus onClick={()=>void onContinue()}>Oturuma devam et</Button><Button onClick={()=>void onLockNow()}>Şimdi kilitle</Button></div>
    </section>
  </div>,language);
  const panel=<div ref={rootRef} className="session-lock-backdrop locked" role="dialog" aria-modal="true" aria-labelledby="session-lock-title" aria-describedby="session-lock-description">
    <form className="session-lock-card" onSubmit={event=>void submitUnlock(event)}>
      <span className="session-lock-icon" aria-hidden="true">▣</span>
      <span className="eyebrow">Oturum güvenli biçimde kilitlendi</span>
      <h2 id="session-lock-title">Yeniden doğrulama gerekli</h2>
      <p id="session-lock-description">{state.reason==='idle_timeout'?'15 dakikalık hareketsizlik süresi doldu.':'Oturum isteğinizle kilitlendi.'} Açık çalışmalarınız korunuyor; erişim için parolanızı yeniden doğrulayın.</p>
      <label>Yerel parola<input autoFocus type="password" autoComplete="current-password" maxLength={1024} value={password} onChange={event=>setPassword(event.target.value)} required/></label>
      {twoFactorEnabled&&<label>2FA / kurtarma kodu<input autoComplete="one-time-code" maxLength={256} value={secondFactorCode} onChange={event=>setSecondFactorCode(event.target.value)} required/></label>}
      {error&&<div className="form-error" role="alert">{error}</div>}
      <Button tone="primary" type="submit" disabled={busy||!password||(twoFactorEnabled&&!secondFactorCode.trim())}>{busy?'Doğrulanıyor…':'Kilidi aç ve devam et'}</Button>
      <small aria-live="polite">Kilit sırasında arka plan işlemleri oturum süresini uzatamaz.</small>
    </form>
  </div>;
  return localizeRepairAndSessionNode(panel,language);
}

export function App() {
  const {language,locale,t}=useLocalization();
  const [navigation, dispatchNavigation] = useReducer(navigationReducer, undefined, () => readNavigationState('dashboard', navItems.map((item) => item.id)));
  const active = navigation.active as ScreenId;
  const setActive = (id: ScreenId) => dispatchNavigation({ type: 'navigate', screen: id });
  const [snapshot, setSnapshot] = useState<FamilyAppSnapshot>(fallbackSnapshot);
  const [dashboardOverview, setDashboardOverview] = useState<DashboardOverviewView>(() => fallbackDashboardOverview(fallbackSnapshot));
  const [householdWorkspace,setHouseholdWorkspace]=useState<HouseholdMembershipWorkspaceView>({households:[],branches:[],memberships:[]});
  const [loadedSnapshotSections,setLoadedSnapshotSections]=useState<ReadonlySet<FamilySnapshotSection>>(()=>new Set());
  const loadedSnapshotSectionsRef=useRef<Set<FamilySnapshotSection>>(new Set());
  const snapshotSectionLoadsRef=useRef<Partial<Record<FamilySnapshotSection,Promise<void>>>>({});
  const [loadedAuxiliaryScreens,setLoadedAuxiliaryScreens]=useState<ReadonlySet<ScreenId>>(()=>new Set());
  const loadedAuxiliaryScreensRef=useRef<Set<ScreenId>>(new Set());
  const auxiliaryLoadsRef=useRef<Partial<Record<ScreenId,Promise<void>>>>({});
  const [screenDataError,setScreenDataError]=useState('');
  const [screenLoadRevision,setScreenLoadRevision]=useState(0);
  const [loading, setLoading] = useState(!shellPreviewMode);
  const [firstRunIntroCompleted,setFirstRunIntroCompleted]=useState(shellPreviewMode||isFirstRunIntroductionComplete(browserPreferenceStorage()));
  const [auth, setAuth] = useState<AuthStateView>(shellPreviewMode
    ? {initialized:true,authenticated:true,displayName:'Yerel Kullanıcı',role:'family_admin',twoFactorEnabled:true}
    : {initialized:false,authenticated:false});
  const [sessionLock,setSessionLock]=useState<SessionLockStateView>();
  const lastSessionActivitySentAtRef=useRef(0);
  const [archiveRevision,setArchiveRevision]=useState(0);
  const [catalogRevision,setCatalogRevision]=useState(0);
  const [archivedEvents,setArchivedEvents]=useState<FamilyEventView[]>([]);
  const [archiveEventFilter,setArchiveEventFilter]=useState('');
  const [financeRecords,setFinanceRecords]=useState<FinanceRecordView[]>([]);
  const [bankInstitutions,setBankInstitutions]=useState<BankInstitutionView[]>([]);
  const [bankAccounts,setBankAccounts]=useState<BankAccountView[]>([]);
  const [paymentCards,setPaymentCards]=useState<PaymentCardView[]>([]);
  const [loanAccounts,setLoanAccounts]=useState<LoanAccountView[]>([]);
  const [financePlanningWorkspace,setFinancePlanningWorkspace]=useState<FinancePlanningWorkspaceView>();
  const [longTermPortfolioWorkspace,setLongTermPortfolioWorkspace]=useState<LongTermPortfolioWorkspaceView>();
  const [healthRecords,setHealthRecords]=useState<HealthRecordView[]>([]);
  const [medicationPlans,setMedicationPlans]=useState<MedicationPlanView[]>([]);
  const [familyHealthHistory,setFamilyHealthHistory]=useState<FamilyHealthHistoryView[]>([]);
  const [financeValuations,setFinanceValuations]=useState<FinanceValuationView[]>([]);
  const [lifeRecords,setLifeRecords]=useState<LifeRecordView[]>([]);
  const [managedLifeWorkspace,setManagedLifeWorkspace]=useState<ManagedLifeWorkspaceView>();
  const [automationRules,setAutomationRules]=useState<AutomationRuleView[]>([]);
  const [reportSummary,setReportSummary]=useState<ReportSummaryView>();
  const [memberModal, setMemberModal] = useState(false);
  const [eventModal, setEventModal] = useState(false);
  const [editingEvent,setEditingEvent]=useState<FamilyEventView>();
  const [locationModal, setLocationModal] = useState(false);
  const [relationModal,setRelationModal]=useState(false);
  const [appInfo, setAppInfo] = useState<UserVisibleAppInfo>(USER_VISIBLE_APP_INFO);
  const [accessibility, setAccessibility] = useState<AccessibilityPreferences>(readAccessibilityPreferences);
  const accessibilityRevisionRef=useRef(0);
  const accessibilitySaveTimerRef=useRef<ReturnType<typeof globalThis.setTimeout>|undefined>(undefined);
  const accessibilityOperationRef=useRef<string|undefined>(undefined);
  const accessibilitySaveChainRef=useRef<Promise<void>>(Promise.resolve());
  const [systemDark,setSystemDark]=useState(()=>globalThis.matchMedia?.('(prefers-color-scheme: dark)').matches??true);
  const theme=resolveAccessibilityTheme(accessibility.theme,systemDark);
  const releaseChannel=releaseChannelFromInfo(appInfo.channel);
  useEffect(()=>{
    document.documentElement.dataset.releaseChannel=releaseChannel;
    return()=>{delete document.documentElement.dataset.releaseChannel;};
  },[releaseChannel]);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(readSidebarState);
  const [searchOpen, setSearchOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [notificationOpen, setNotificationOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [familyOpen, setFamilyOpen] = useState(false);
  const [currentTime, setCurrentTime] = useState(() => new Date());
  const [networkOnline,setNetworkOnline]=useState(()=>globalThis.navigator?.onLine!==false);
  const [searchActiveIndex, setSearchActiveIndex] = useState(0);
  const mainContentRef = useRef<HTMLElement>(null);
  const searchDialogRef = useRef<HTMLElement>(null);
  const searchTriggerRef = useRef<HTMLButtonElement>(null);
  const searchResultRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const previousSearchFocusRef = useRef<HTMLElement | null>(null);
  const asyncWriteGuardRef = useRef(new AsyncWriteGuard());
  const mutationRevisionWatermarkRef = useRef(new MutationRevisionWatermark());

  useEffect(() => { persistNavigationState(navigation); }, [navigation]);
  useEffect(()=>{const online=()=>setNetworkOnline(true),offline=()=>setNetworkOnline(false);globalThis.addEventListener('online',online);globalThis.addEventListener('offline',offline);return()=>{globalThis.removeEventListener('online',online);globalThis.removeEventListener('offline',offline);};},[]);
  useEffect(() => () => asyncWriteGuardRef.current.invalidateAll(), []);
  useEffect(()=>()=>{if(accessibilitySaveTimerRef.current!==undefined)globalThis.clearTimeout(accessibilitySaveTimerRef.current);},[]);
  useEffect(() => { writeBootstrapPreference(browserPreferenceStorage(), 'ppt-theme', theme); }, [theme]);
  useEffect(() => { const storage=browserPreferenceStorage();writeBootstrapPreference(storage,'ppt-accessibility',serializeAccessibilityPreferences(accessibility));persistBrandAudioMuted(storage,accessibility.audioMuted);if(accessibility.audioMuted)cancelFirstRunNarration(browserSpeechSynthesis()); }, [accessibility]);
  useEffect(()=>{const query=globalThis.matchMedia?.('(prefers-color-scheme: dark)');if(!query)return;const update=()=>setSystemDark(query.matches);query.addEventListener?.('change',update);return()=>query.removeEventListener?.('change',update);},[]);
  useEffect(() => { writeBootstrapPreference(browserPreferenceStorage(), 'ppt-sidebar-collapsed', String(sidebarCollapsed)); }, [sidebarCollapsed]);
  useEffect(()=>{const replay=()=>setFirstRunIntroCompleted(false);globalThis.addEventListener('ppt-replay-intro',replay);return()=>globalThis.removeEventListener('ppt-replay-intro',replay);},[]);
  useEffect(() => {
    const clock = globalThis.setInterval(() => setCurrentTime(new Date()), 30_000);
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && (event.key.toLocaleLowerCase('tr-TR') === 'k' || event.key.toLocaleLowerCase('tr-TR') === 'f')) {
        event.preventDefault();
        setSearchOpen(true);
      }
      if (event.key === 'F1') {
        event.preventDefault();
        setHelpOpen(true);
        setSearchOpen(false);
        setNotificationOpen(false);
        setProfileOpen(false);
        setFamilyOpen(false);
      }
      if (event.key === 'Escape') {
        setHelpOpen(false);
        setSearchOpen(false);
        setNotificationOpen(false);
        setProfileOpen(false);
        setFamilyOpen(false);
      }
    };
    globalThis.addEventListener('keydown', onKeyDown);
    return () => {
      globalThis.clearInterval(clock);
      globalThis.removeEventListener('keydown', onKeyDown);
    };
  }, []);

  useEffect(()=>{
    if(shellPreviewMode||loading||!auth.authenticated||!window.pardus){setSessionLock(undefined);return;}
    let disposed=false;
    const poll=async()=>{
      try{const state=await window.pardus!.getSessionLockState();if(!disposed)setSessionLock(state);}
      catch{if(!disposed)setSessionLock(current=>current?.status==='locked'?current:undefined);}
    };
    void poll();
    const timer=globalThis.setInterval(()=>void poll(),1_000);
    return()=>{disposed=true;globalThis.clearInterval(timer);};
  },[auth.authenticated,loading]);

  useEffect(()=>{
    if(shellPreviewMode||loading||!auth.authenticated||sessionLock?.status==='locked'||!window.pardus)return;
    const record=()=>{
      const now=Date.now();
      if(now-lastSessionActivitySentAtRef.current<5_000)return;
      lastSessionActivitySentAtRef.current=now;
      void window.pardus!.recordSessionActivity().then(setSessionLock).catch(()=>undefined);
    };
    globalThis.addEventListener('pointerdown',record,{passive:true});
    globalThis.addEventListener('keydown',record);
    globalThis.addEventListener('touchstart',record,{passive:true});
    return()=>{
      globalThis.removeEventListener('pointerdown',record);
      globalThis.removeEventListener('keydown',record);
      globalThis.removeEventListener('touchstart',record);
    };
  },[auth.authenticated,loading,sessionLock?.status]);

  useEffect(()=>{
    if(sessionLock?.status!=='locked')return;
    asyncWriteGuardRef.current.invalidateAll();
    setSearchOpen(false);setNotificationOpen(false);setProfileOpen(false);setFamilyOpen(false);
  },[sessionLock?.status]);

  useEffect(() => {
    if (loading || !auth.authenticated) return;
    mainContentRef.current?.focus({ preventScroll: true });
  }, [active, auth.authenticated, loading]);

  useEffect(() => {
    if (!searchOpen) {
      previousSearchFocusRef.current?.focus();
      previousSearchFocusRef.current = null;
      return;
    }
    previousSearchFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : searchTriggerRef.current;
    setSearchActiveIndex(0);
    const dialog = searchDialogRef.current;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Tab' || !dialog) return;
      const focusable = Array.from(dialog.querySelectorAll<HTMLElement>('input, button:not([disabled]), [tabindex]:not([tabindex="-1"])'));
      if (!focusable.length) return;
      const first = focusable[0]!;
      const last = focusable[focusable.length - 1]!;
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [searchOpen]);

  const resetLazyDataState=()=>{
    asyncWriteGuardRef.current.invalidateAll();
    mutationRevisionWatermarkRef.current.reset();
    loadedSnapshotSectionsRef.current=new Set();
    snapshotSectionLoadsRef.current={};
    loadedAuxiliaryScreensRef.current=new Set();
    auxiliaryLoadsRef.current={};
    setLoadedSnapshotSections(new Set());
    setLoadedAuxiliaryScreens(new Set());
    setHouseholdWorkspace({households:[],branches:[],memberships:[]});
    setScreenDataError('');
  };

  const applyMutationResult=(result:FamilyMutationResultView)=>{
    const acceptance=mutationRevisionWatermarkRef.current.accept(result);
    if(!acceptance.accepted)return false;
    asyncWriteGuardRef.current.invalidate('session-bootstrap');
    asyncWriteGuardRef.current.invalidate('family-refresh');
    asyncWriteGuardRef.current.invalidate('dashboard');
    const graphLoaded=loadedSnapshotSectionsRef.current.has('graph');
    const timelineLoaded=loadedSnapshotSectionsRef.current.has('timeline');
    if(acceptance.advancedKeys.includes('graph')){
      asyncWriteGuardRef.current.invalidate('snapshot:graph');
      if(!graphLoaded){delete snapshotSectionLoadsRef.current.graph;setScreenLoadRevision((current)=>current+1);}
    }
    if(acceptance.advancedKeys.includes('timeline')||acceptance.advancedKeys.includes('notifications')){
      asyncWriteGuardRef.current.invalidate('snapshot:timeline');
      if(!timelineLoaded){delete snapshotSectionLoadsRef.current.timeline;setScreenLoadRevision((current)=>current+1);}
    }
    if(acceptance.advancedKeys.includes('archive'))asyncWriteGuardRef.current.invalidate('archived-events');
    setSnapshot((current)=>{
      let next:FamilyAppSnapshot={...current,lastUpdatedAt:current.lastUpdatedAt.localeCompare(result.occurredAt)>=0?current.lastUpdatedAt:result.occurredAt};
      if(graphLoaded&&acceptance.advancedKeys.includes('graph')&&result.person)next={...next,people:mergeCatalogItems(next.people,[result.person])};
      if(graphLoaded&&acceptance.advancedKeys.includes('graph')&&result.relation)next={...next,relations:mergeCatalogItems(next.relations,[result.relation])};
      if(timelineLoaded&&acceptance.advancedKeys.includes('timeline')&&result.location)next={...next,locations:mergeCatalogItems(next.locations,[result.location])};
      if(timelineLoaded&&acceptance.advancedKeys.includes('timeline')&&result.event){
        next=result.operation==='archived'
          ? {...next,events:next.events.filter((event)=>event.id!==result.event!.id)}
          : {...next,events:mergeCatalogItems(next.events,[result.event])};
      }
      if(timelineLoaded&&acceptance.advancedKeys.includes('notifications')&&result.notificationId){
        next={...next,notifications:next.notifications.map((item)=>item.id===result.notificationId?{...item,acknowledgedAt:result.occurredAt}:item)};
      }
      return next;
    });
    if(acceptance.advancedKeys.includes('personCatalog'))setCatalogRevision((current)=>Math.max(current,acceptance.revisions.personCatalog));
    if(acceptance.advancedKeys.includes('archive'))setArchiveRevision((current)=>Math.max(current,acceptance.revisions.archive));
    return true;
  };


  const ensureSnapshotSection=async(section:FamilySnapshotSection):Promise<void>=>{
    if(!window.pardus||loadedSnapshotSectionsRef.current.has(section))return;
    const existing=snapshotSectionLoadsRef.current[section];
    if(existing){await existing;return;}
    const ticket=asyncWriteGuardRef.current.start(`snapshot:${section}`);
    let task:Promise<void>;
    task=(async()=>{
      const patch=await window.pardus!.getSnapshotSections({sections:[section]});
      asyncWriteGuardRef.current.commit(ticket,()=>{
        setSnapshot(current=>mergeSnapshotPatch(current,patch));
        const loaded=new Set(loadedSnapshotSectionsRef.current);loaded.add(section);
        loadedSnapshotSectionsRef.current=loaded;setLoadedSnapshotSections(new Set(loaded));
      });
    })().finally(()=>{if(snapshotSectionLoadsRef.current[section]===task)delete snapshotSectionLoadsRef.current[section];});
    snapshotSectionLoadsRef.current[section]=task;
    await task;
  };


  const ensureSnapshotSections=async(sections:readonly FamilySnapshotSection[]):Promise<void>=>{
    await Promise.all(sections.map(section=>ensureSnapshotSection(section)));
  };

  const ensureAuxiliaryScreen=async(screen:ScreenId):Promise<void>=>{
    if(!window.pardus||loadedAuxiliaryScreensRef.current.has(screen))return;
    const existing=auxiliaryLoadsRef.current[screen];if(existing){await existing;return;}
    const ticket=asyncWriteGuardRef.current.start(`auxiliary:${screen}`);
    let task:Promise<void>;
    task=(async()=>{
      if(screen==='finance'){
        const [records,valuations,institutions,accounts,cards,loans,planning,longTermPortfolio]=await Promise.all([window.pardus!.listFinance(),window.pardus!.listFinanceValuations(),window.pardus!.listBankInstitutions(),window.pardus!.listBankAccounts(),window.pardus!.listPaymentCards(),window.pardus!.listLoanAccounts(),window.pardus!.getFinancePlanningWorkspace(),window.pardus!.getLongTermPortfolioWorkspace()]);
        asyncWriteGuardRef.current.commit(ticket,()=>{setFinanceRecords(records);setFinanceValuations(valuations);setBankInstitutions(institutions);setBankAccounts(accounts);setPaymentCards(cards);setLoanAccounts(loans);setFinancePlanningWorkspace(planning);setLongTermPortfolioWorkspace(longTermPortfolio);});
      }else if(screen==='health'){
        const [records,medications,history]=await Promise.all([window.pardus!.listHealth(),window.pardus!.listMedicationPlans(),window.pardus!.listFamilyHealthHistory()]);
        asyncWriteGuardRef.current.commit(ticket,()=>{setHealthRecords(records);setMedicationPlans(medications);setFamilyHealthHistory(history);});
      }else if(screen==='life-center'){
        const [records,managedWorkspace]=await Promise.all([window.pardus!.listLifeRecords(),window.pardus!.getManagedLifeWorkspace()]);
        asyncWriteGuardRef.current.commit(ticket,()=>{setLifeRecords(records);setManagedLifeWorkspace(managedWorkspace);});
      }else if(screen==='automation'){
        const rules=await window.pardus!.listAutomationRules();asyncWriteGuardRef.current.commit(ticket,()=>setAutomationRules(rules));
      }else if(screen==='reports'){
        const report=await window.pardus!.getReportSummary();asyncWriteGuardRef.current.commit(ticket,()=>setReportSummary(report));
      }else if(screen==='important-days'){
        const events=await window.pardus!.listArchivedTimelineEvents();asyncWriteGuardRef.current.commit(ticket,()=>setArchivedEvents(events));
      }else if(screen==='households'){
        const workspace=await window.pardus!.getHouseholdMembershipWorkspace();asyncWriteGuardRef.current.commit(ticket,()=>setHouseholdWorkspace(workspace));
      }
      asyncWriteGuardRef.current.commit(ticket,()=>{
        const loaded=new Set(loadedAuxiliaryScreensRef.current);loaded.add(screen);
        loadedAuxiliaryScreensRef.current=loaded;setLoadedAuxiliaryScreens(new Set(loaded));
      });
    })().finally(()=>{if(auxiliaryLoadsRef.current[screen]===task)delete auxiliaryLoadsRef.current[screen];});
    auxiliaryLoadsRef.current[screen]=task;await task;
  };


  const bootstrapAuthenticatedSession=async()=>{
    if(!window.pardus)return;
    resetLazyDataState();
    const ticket=asyncWriteGuardRef.current.start('session-bootstrap');
    const [dashboard,storedAccessibility]=await Promise.all([
      window.pardus.getDashboardOverview(),
      window.pardus.getAccessibilityPreferences()
    ]);
    asyncWriteGuardRef.current.commit(ticket,()=>{
      setDashboardOverview(dashboard);
      setSnapshot(snapshotFromOverview(dashboard));
      accessibilityRevisionRef.current=storedAccessibility.revision;
      setAccessibility(rendererAccessibilityPreferences(storedAccessibility));
    });
  };

  const updateAccessibility= (next:AccessibilityPreferences):void => {
    setAccessibility(next);
    if(!auth.authenticated||!window.pardus)return;
    if(accessibilitySaveTimerRef.current!==undefined)globalThis.clearTimeout(accessibilitySaveTimerRef.current);
    const operationId=accessibilityOperationRef.current??crypto.randomUUID();
    accessibilityOperationRef.current=operationId;
    accessibilitySaveTimerRef.current=globalThis.setTimeout(()=>{
      if(accessibilityOperationRef.current===operationId)accessibilityOperationRef.current=undefined;
      accessibilitySaveChainRef.current=accessibilitySaveChainRef.current.catch(()=>undefined).then(async()=>{
        const command:UpdateAccessibilityPreferencesInput={
          expectedRevision:accessibilityRevisionRef.current,
          clientOperationId:operationId,
          ...next
        };
        try{
          const stored=await window.pardus!.updateAccessibilityPreferences(command);
          accessibilityRevisionRef.current=stored.revision;
          setAccessibility(rendererAccessibilityPreferences(stored));
        }catch{
          const stored=await window.pardus!.getAccessibilityPreferences();
          accessibilityRevisionRef.current=stored.revision;
          setAccessibility(rendererAccessibilityPreferences(stored));
        }
      });
    },300);
  };

  useEffect(() => {
    const ticket=asyncWriteGuardRef.current.start('startup');
    const load = async () => {
      if (window.pardus) {
        const [info, authState] = await Promise.all([window.pardus.getAppInfo(), window.pardus.getAuthState()]);
        if(!asyncWriteGuardRef.current.commit(ticket,()=>{setAppInfo(info);setAuth(authState);})){return;}
        if(authState.authenticated){await bootstrapAuthenticatedSession();setLoading(false);return;}
      }
      asyncWriteGuardRef.current.commit(ticket,()=>setLoading(false));
    };
    void load();
    return()=>asyncWriteGuardRef.current.invalidate('startup');
  }, []);

  useEffect(()=>{
    if(loading||!auth.authenticated||!window.pardus||active==='dashboard')return;
    let cancelled=false;
    const run=async()=>{
      setScreenDataError('');
      try{
        const graphScreens:readonly ScreenId[]=['households','people-lifecycle','tree','important-days','finance','health','life-center','legacy'];
        const timelineScreens:readonly ScreenId[]=['timeline','important-days','location'];
        const sections:FamilySnapshotSection[]=[];
        if(graphScreens.includes(active))sections.push('graph');
        if(timelineScreens.includes(active))sections.push('timeline');
        await ensureSnapshotSections(sections);
        if(['households','finance','health','life-center','automation','reports','important-days'].includes(active))await ensureAuxiliaryScreen(active);
      }catch(error){if(!cancelled)setScreenDataError(error instanceof Error?error.message:'Ekran verileri yüklenemedi.');}
    };
    void run();return()=>{cancelled=true;};
  },[active,auth.authenticated,loading,screenLoadRevision]);

  useEffect(()=>{if(notificationOpen&&auth.authenticated&&!loadedSnapshotSectionsRef.current.has('timeline'))void ensureSnapshotSection('timeline').catch(error=>setScreenDataError(error instanceof Error?error.message:'Bildirimler yüklenemedi.'));},[notificationOpen,auth.authenticated]);

  const localizedNavItems = useMemo(() => navItems.map((item)=>({...item,label:localizeNavigationLabel(item.id,item.label)})), [language]);
  const localizedNavGroups = useMemo(() => navGroups.map((group)=>({...group,label:localizeNavigationGroup(group.id,group.label)})), [language]);
  const activeItem = localizedNavItems.find((item) => item.id === active) ?? localizedNavItems[0]!;
  const now = useMemo(() => new Intl.DateTimeFormat(locale, { dateStyle: 'full', timeStyle: 'short' }).format(currentTime), [currentTime,locale]);
  const searchResults = useMemo(() => {
    const normalized = searchQuery.trim().toLocaleLowerCase(locale);
    return normalized
      ? localizedNavItems.filter((item) => item.label.toLocaleLowerCase(locale).includes(normalized))
      : localizedNavItems.slice(0, 7);
  }, [searchQuery,localizedNavItems,locale]);
  const activeNotifications = snapshot.notifications.filter((item) => !item.acknowledgedAt);
  const refreshDashboard = async () => {
    if(!window.pardus)return;
    const ticket=asyncWriteGuardRef.current.start('dashboard');
    const overview=await window.pardus.getDashboardOverview();
    asyncWriteGuardRef.current.commit(ticket,()=>setDashboardOverview(overview));
  };
  const refreshHouseholdWorkspace=async()=>{if(!window.pardus)return;const workspace=await window.pardus.getHouseholdMembershipWorkspace();setHouseholdWorkspace(workspace);};
  const refreshFamilyData = async () => {
    if(!window.pardus)return;
    const ticket=asyncWriteGuardRef.current.start('family-refresh');
    const [graph,timeline,nextDashboard,nextArchived]=await Promise.all([window.pardus.getSnapshotSections({sections:['graph']}),window.pardus.getSnapshotSections({sections:['timeline']}),window.pardus.getDashboardOverview(),window.pardus.listArchivedTimelineEvents()]);
    asyncWriteGuardRef.current.commit(ticket,()=>{
      setSnapshot(current=>mergeSnapshotPatch(mergeSnapshotPatch(current,graph),timeline));
      const loaded=new Set<FamilySnapshotSection>(['graph','timeline']);loadedSnapshotSectionsRef.current=loaded;setLoadedSnapshotSections(new Set(loaded));
      setDashboardOverview(nextDashboard);setArchivedEvents(nextArchived);
    });
  };
  const refreshArchivedEvents = async () => {
    if(!window.pardus)return;
    const ticket=asyncWriteGuardRef.current.start('archived-events');
    const events=await window.pardus.listArchivedTimelineEvents();
    asyncWriteGuardRef.current.commit(ticket,()=>setArchivedEvents(events));
  };
  const navigateFromShell = (id: ScreenId) => {
    if (searchOpen) previousSearchFocusRef.current = null;
    setActive(id);
    setSearchOpen(false);
    setNotificationOpen(false);
    setProfileOpen(false);
    setFamilyOpen(false);
  };
  const logout = async () => {
    if (!window.pardus) return;
    resetLazyDataState();
    const ticket=asyncWriteGuardRef.current.start('auth-transition');
    const state = await window.pardus.logout();
    asyncWriteGuardRef.current.commit(ticket,()=>{
      setAuth(state);
      setProfileOpen(false);
      setSnapshot(fallbackSnapshot);
      setArchivedEvents([]);
      setDashboardOverview(fallbackDashboardOverview(fallbackSnapshot));
      setActive('dashboard');
    });
  };
  const continueSession=async()=>{if(window.pardus)setSessionLock(await window.pardus.recordSessionActivity());};
  const lockSessionNow=async()=>{if(window.pardus)setSessionLock(await window.pardus.lockSession());};
  const unlockSession=async(input:UnlockSessionInput)=>{
    if(!window.pardus)return;
    const state=await window.pardus.unlockSession(input);
    setAuth(state);
    lastSessionActivitySentAtRef.current=Date.now();
    setSessionLock(await window.pardus.getSessionLockState());
  };

  const createMember = async (input: CreateFamilyMemberInput) => {
    if (window.pardus) { applyMutationResult(await window.pardus.createMember(input)); await refreshFamilyData(); }
    else setSnapshot((current) => ({ ...current, people: [...current.people, { id: crypto.randomUUID(), displayName: input.displayName, ...(input.birthDate ? { birthDate: input.birthDate } : {}), relationshipType: input.relationshipType, generation: input.generation, branch: input.branch ?? 'Ana Dal', status: 'active', initials: input.displayName.split(/\s+/).slice(0,2).map((word) => word[0]).join('').toLocaleUpperCase('tr-TR') }], lastUpdatedAt: new Date().toISOString() }));
  };
  const createLocation = async (input: CreateFamilyLocationInput) => { if (window.pardus) { applyMutationResult(await window.pardus.createLocation(input)); await refreshDashboard(); } else setSnapshot((current) => ({ ...current, locations: [...current.locations, { ...input, id: crypto.randomUUID() }], lastUpdatedAt: new Date().toISOString() })); };
  const createEvent = async (input: CreateFamilyEventInput) => {
    if (window.pardus) { applyMutationResult(await window.pardus.createImportantDay(input)); await refreshDashboard(); }
    else setSnapshot((current) => ({ ...current, events: [...current.events, { ...input, id: crypto.randomUUID(), kind: 'important_day', attachmentCount: 0, recurrence: input.recurrence ?? 'none', reminderDays: input.reminderDays ?? [7,1], createdAt: new Date().toISOString() }], lastUpdatedAt: new Date().toISOString() }));
  };
  const acknowledgeTimelineNotification=async(notificationId:string)=>{if(window.pardus){applyMutationResult(await window.pardus.acknowledgeTimelineNotification({notificationId}));await refreshDashboard();}};
  const updateImportantDay=async(input:{eventId:string;participantPersonIds:string[];visibility:FamilyEventView['visibility'];invitationText?:string;notes?:string})=>{if(!window.pardus)return;applyMutationResult(await window.pardus.updateImportantDayParticipants({eventId:input.eventId,participantPersonIds:input.participantPersonIds,visibility:input.visibility}));applyMutationResult(await window.pardus.updateImportantDayInvitation({eventId:input.eventId,...(input.invitationText?{invitationText:input.invitationText}:{})}));applyMutationResult(await window.pardus.updateImportantDayNotes({eventId:input.eventId,...(input.notes?{notes:input.notes}:{})}));await refreshDashboard();};
  const updateFamilyEvent=async(input:UpdateFamilyEventInput)=>{
    if(window.pardus){applyMutationResult(await window.pardus.updateFamilyEvent(input));await refreshDashboard();return;}
    setSnapshot((current)=>({...current,events:current.events.map((event)=>event.id===input.eventId?{...event,...input,updatedAt:new Date().toISOString()}:event),lastUpdatedAt:new Date().toISOString()}));
  };
  const setFamilyEventArchived=async(eventId:string,archived:boolean)=>{
    if(window.pardus){const mutation=await window.pardus.setFamilyEventArchived({eventId,archived});applyMutationResult(mutation);if(mutation.event){if(archived)setArchivedEvents((current)=>mergeCatalogItems([mutation.event!],current));else setArchivedEvents((current)=>current.filter((event)=>event.id!==eventId));}await refreshDashboard();return;}
    if(archived){const target=snapshot.events.find((event)=>event.id===eventId);if(target){setSnapshot((current)=>({...current,events:current.events.filter((event)=>event.id!==eventId),lastUpdatedAt:new Date().toISOString()}));setArchivedEvents((current)=>[{...target,archivedAt:new Date().toISOString()},...current]);}}
    else{const target=archivedEvents.find((event)=>event.id===eventId);if(target){const {archivedAt:_archivedAt,...restored}=target;setArchivedEvents((current)=>current.filter((event)=>event.id!==eventId));setSnapshot((current)=>({...current,events:[restored,...current.events],lastUpdatedAt:new Date().toISOString()}));}}
  };

  const setupAdmin=async(input:SetupAdminInput)=>{if(!window.pardus)throw new Error('Güvenli kurulum bağlantısı başlatılamadı. Uygulamayı kapatıp yeniden açın.');const ticket=asyncWriteGuardRef.current.start('auth-transition');const state=await window.pardus.setupAdmin(input);if(!asyncWriteGuardRef.current.commit(ticket,()=>setAuth(state)))return;await bootstrapAuthenticatedSession();};
  const login=async(input:LoginInput)=>{if(window.pardus){const ticket=asyncWriteGuardRef.current.start('auth-transition');const state=await window.pardus.login(input);if(!asyncWriteGuardRef.current.commit(ticket,()=>setAuth(state)))return;await bootstrapAuthenticatedSession();}};
  const loginWithWindowsHello=async(input:LoginWithWindowsHelloInput)=>{if(window.pardus){const ticket=asyncWriteGuardRef.current.start('auth-transition');const result=await window.pardus.loginWithWindowsHello(input);if(!result.authenticated)throw new Error(windowsHelloOutcomeMessage(result.outcome));const state=await window.pardus.getAuthState();if(!asyncWriteGuardRef.current.commit(ticket,()=>setAuth(state)))return;await bootstrapAuthenticatedSession();}};
  const completeInvitationAcceptance=async(state:AuthStateView)=>{const ticket=asyncWriteGuardRef.current.start('auth-transition');if(!asyncWriteGuardRef.current.commit(ticket,()=>setAuth(state)))return;await bootstrapAuthenticatedSession();};
  const createRelation=async(input:CreateFamilyRelationInput)=>{if(window.pardus){applyMutationResult(await window.pardus.createRelation(input));await refreshDashboard();}};
  const importArchive=async(input:{title:string;linkedEventId?:string})=>{if(window.pardus){await window.pardus.importArchive(input);setArchiveRevision(value=>value+1);await refreshDashboard();}};
  const openArchive=async(id:string)=>{if(window.pardus)await window.pardus.openArchive(id);};
  const openEventArchive=(eventId:string)=>{setArchiveEventFilter(eventId);setActive('archive');};
  const createFinance=async(input:CreateFinanceRecordInput)=>{if(window.pardus){setFinanceRecords(await window.pardus.createFinance(input));await refreshDashboard();}};
  const validateIban=async(input:ValidateIbanInput):Promise<IbanStructuralValidationView>=>{if(!window.pardus)throw new Error('IBAN doğrulama köprüsü kullanılamıyor.');return window.pardus.validateIban(input);};
  const createBankAccount=async(input:CreateBankAccountInput)=>{if(window.pardus)setBankAccounts(await window.pardus.createBankAccount(input));};
  const createPaymentCard=async(input:CreatePaymentCardInput)=>{if(window.pardus)setPaymentCards(await window.pardus.createPaymentCard(input));};
  const createLoanAccount=async(input:CreateLoanAccountInput)=>{if(window.pardus)setLoanAccounts(await window.pardus.createLoanAccount(input));};
  const recordLoanPayment=async(input:RecordLoanPaymentInput)=>{if(window.pardus)setLoanAccounts(await window.pardus.recordLoanPayment(input));};
  const recordFinancePlanningItem=async(input:RecordFinancePlanningItemInput)=>{if(window.pardus)setFinancePlanningWorkspace(await window.pardus.recordFinancePlanningItem(input));};
  const recordLongTermPortfolioItem=async(input:RecordLongTermPortfolioItemInput)=>{if(window.pardus)setLongTermPortfolioWorkspace(await window.pardus.recordLongTermPortfolioItem(input));};
  const createHealth=async(input:CreateHealthRecordInput)=>{if(window.pardus){setHealthRecords(await window.pardus.createHealth(input));await refreshDashboard();}};
  const createMedicationPlan=async(input:CreateMedicationPlanInput)=>{if(window.pardus){setMedicationPlans(await window.pardus.createMedicationPlan(input));await refreshDashboard();}};
  const createFamilyHistory=async(input:CreateFamilyHealthHistoryInput)=>{if(window.pardus){setFamilyHealthHistory(await window.pardus.createFamilyHealthHistory(input));await refreshDashboard();}};
  const createFinanceValuation=async(input:CreateFinanceValuationInput)=>{if(window.pardus)setFinanceValuations(await window.pardus.createFinanceValuation(input));};
  const createLifeRecord=async(input:CreateLifeRecordInput)=>{if(window.pardus){setLifeRecords(await window.pardus.createLifeRecord(input));setReportSummary(await window.pardus.getReportSummary());await refreshDashboard();}};
  const recordManagedLifeItem=async(input:RecordManagedLifeItemInput)=>{if(window.pardus)setManagedLifeWorkspace(await window.pardus.recordManagedLifeItem(input));};
  const createAutomationRule=async(input:CreateAutomationRuleInput)=>{if(window.pardus){setAutomationRules(await window.pardus.createAutomationRule(input));await refreshDashboard();}};
  const toggleAutomationRule=async(id:string,enabled:boolean)=>{if(window.pardus){setAutomationRules(await window.pardus.toggleAutomationRule(id,enabled));await refreshDashboard();}};

  const sessionOverlayVisible=sessionLock?.status==='warning'||sessionLock?.status==='locked';
  const sessionOverlay=sessionOverlayVisible&&sessionLock
    ? <SessionLockOverlay state={sessionLock} twoFactorEnabled={Boolean(auth.twoFactorEnabled)} onContinue={continueSession} onLockNow={lockSessionNow} onUnlock={unlockSession}/>
    : null;

  if(!firstRunIntroCompleted) return auth.authenticated&&sessionOverlay
    ? sessionOverlay
    : <FirstRunIntroduction audioMuted={accessibility.audioMuted} onAudioMutedChange={(audioMuted)=>updateAccessibility({...accessibility,audioMuted})} onComplete={()=>setFirstRunIntroCompleted(true)}/>;
  if(loading)return <main className="first-run-shell"><section className="first-run-card"><div className="loading-screen"><div className="loader"/><strong>{t('shell.loading')}</strong><small>{t('shell.loadingBody')}</small></div></section></main>;
  if(!auth.authenticated) return <AuthScreen auth={auth} onSetup={setupAdmin} onLogin={login} onWindowsHelloLogin={loginWithWindowsHello} onInvitationAccepted={completeInvitationAcceptance}/>;
  if(auth.authenticated && !auth.twoFactorEnabled) {
    const setup=<FirstRunSecuritySetup onComplete={(state)=>{setAuth(state);void bootstrapAuthenticatedSession();}}/>;
    return sessionOverlay?<><div aria-hidden="true">{setup}</div>{sessionOverlay}</>:setup;
  }

  const graphRequired=['households','people-lifecycle','tree','important-days','finance','health','life-center','legacy'].includes(active);
  const timelineRequired=['timeline','important-days','location'].includes(active);
  const auxiliaryRequired=['households','finance','health','life-center','automation','reports','important-days'].includes(active);
  const activeScreenDataReady=(!graphRequired||loadedSnapshotSections.has('graph'))
    &&(!timelineRequired||loadedSnapshotSections.has('timeline'))
    &&(!auxiliaryRequired||loadedAuxiliaryScreens.has(active));
  const routeLoadingState=resolveRouteAsyncState(active,'loading');
  const routeOfflineState=resolveRouteAsyncState(active,'offline');
  const routeErrorState=resolveRouteAsyncState(active,'error');
  const openImportantDayModal=()=>{void ensureSnapshotSection('timeline').then(()=>setEventModal(true)).catch(error=>setScreenDataError(error instanceof Error?error.message:'Önemli gün verileri yüklenemedi.'));};

  let screen: ReactNode;
  if(screenDataError)screen=<div className="loading-screen"><StatusMessage tone="danger">{screenDataError}</StatusMessage><Button onClick={()=>{setScreenDataError('');setScreenLoadRevision(value=>value+1);}}>Yeniden dene</Button></div>;
  else if(active!=='dashboard'&&!activeScreenDataReady)screen=<div className="loading-screen"><div className="loader"/><strong>{activeItem.label} verileri yükleniyor…</strong></div>;
  else if (active === 'dashboard') screen = <Dashboard overview={dashboardOverview} onNavigate={setActive} onAddMember={()=>setMemberModal(true)} onAddImportantDay={openImportantDayModal} />;
  else if (active === 'family') screen = <FamilyScreen revision={catalogRevision} onAdd={() => setMemberModal(true)} />;
  else if (active === 'households') screen = <HouseholdMembershipScreen people={snapshot.people} workspace={householdWorkspace} onChanged={refreshHouseholdWorkspace}/>;
  else if (active === 'people-lifecycle') screen = <PersonLifecycleScreen people={snapshot.people} onChanged={refreshFamilyData}/>;
  else if (active === 'tree') screen = <TreeScreen snapshot={snapshot} onAddRelation={()=>setRelationModal(true)} />;
  else if (active === 'timeline') screen = <TimelineScreen snapshot={snapshot} onEdit={setEditingEvent} onArchive={(eventId)=>setFamilyEventArchived(eventId,true)} onOpenArchive={openEventArchive} />;
  else if (active === 'archive') screen = <ArchiveScreen revision={archiveRevision} snapshot={snapshot} eventFilter={archiveEventFilter} onEventFilterChange={setArchiveEventFilter} onImport={importArchive} onOpen={openArchive} />;
  else if (active === 'location') screen = <LocationScreen snapshot={snapshot} onAdd={() => setLocationModal(true)} onAcknowledge={acknowledgeTimelineNotification} />;
  else if (active === 'important-days') screen = <ImportantDaysScreen snapshot={snapshot} archivedEvents={archivedEvents} onAdd={openImportantDayModal} onEdit={setEditingEvent} onArchive={(eventId)=>setFamilyEventArchived(eventId,true)} onRestore={(eventId)=>setFamilyEventArchived(eventId,false)} onOpenArchive={openEventArchive} />;
  else if (active === 'finance') screen = <FinanceScreen people={snapshot.people} records={financeRecords} valuations={financeValuations} institutions={bankInstitutions} bankAccounts={bankAccounts} paymentCards={paymentCards} loanAccounts={loanAccounts} planningWorkspace={financePlanningWorkspace} longTermPortfolioWorkspace={longTermPortfolioWorkspace} onCreate={createFinance} onCreateValuation={createFinanceValuation} onValidateIban={validateIban} onCreateBankAccount={createBankAccount} onCreatePaymentCard={createPaymentCard} onCreateLoanAccount={createLoanAccount} onRecordLoanPayment={recordLoanPayment} onRecordPlanning={recordFinancePlanningItem} onRecordLongTermPortfolio={recordLongTermPortfolioItem} onPlanningWorkspaceChange={setFinancePlanningWorkspace} />;
  else if (active === 'health') screen = <><HealthScreen people={snapshot.people} records={healthRecords} medications={medicationPlans} history={familyHealthHistory} onCreate={createHealth} onCreateMedication={createMedicationPlan} onCreateHistory={createFamilyHistory} /><section className="workspace-grid"><HealthCareCoordinationPanel people={snapshot.people}/></section></>;
  else if (active === 'life-center') screen = <><LifeCenterScreen people={snapshot.people} records={lifeRecords} onCreate={createLifeRecord} /><FamilyMeetingPanel people={snapshot.people}/><section className="workspace-grid"><ManagedLifePanel people={snapshot.people} workspace={managedLifeWorkspace} onRecord={recordManagedLifeItem}/><HouseholdOperationsPanel people={snapshot.people}/><SmartHomeEnergyPanel/><ChildEducationCoordinationPanel people={snapshot.people}/><PlacesTravelAssetPetPanel people={snapshot.people}/></section></>;
  else if (active === 'automation') screen = <AutomationScreen rules={automationRules} onCreate={createAutomationRule} onToggle={toggleAutomationRule} />;
  else if (active === 'reports') screen = <ReportsScreen report={reportSummary} />;
  else if (active === 'invitations') screen = <InvitationsScreen snapshot={snapshot}/>;
  else if (active === 'data-repair') screen = <DataRepairScreen/>;
  else if (active === 'permissions') screen = <PermissionsScreen auth={auth} />;
  else if (active === 'ai') screen = <AiGovernanceScreen />;
  else if (active === 'legacy') screen = <DigitalLegacyScreen snapshot={snapshot} />;
  else if (active === 'windows-hello') screen = <WindowsHelloScreen auth={auth}/>;
  else if (active === SECURITY_CENTER_ROUTE) screen = <><PageHeader eyebrow="Hesap ve veri koruması" title="Gizlilik, Sahiplik ve Olay Kontrol Merkezi" description="Yerel veri envanteri, AI hafıza denetimi, erişim görünürlüğü, veri hakları, olay containment, parola, 2FA ve yedeklemeyi tek güvenlik rotasında yönetin."/><SettingsSecurity auth={auth} accessibility={accessibility} onAccessibilityChange={updateAccessibility} onFamilyDataChanged={refreshFamilyData}/></>;
  else if (active === 'settings') screen = <SystemManagementScreen/>;
  else screen = <PlaceholderScreen screen={active} snapshot={snapshot} auth={auth} />;

  return (<>
    <div aria-hidden={sessionOverlayVisible?true:undefined} className={`app-shell ${sidebarCollapsed ? 'sidebar-collapsed' : ''}`} data-theme={theme} data-release-channel={releaseChannel} data-ui-language={language} data-text-scale={accessibility.textScale} data-high-contrast={accessibility.highContrast ? 'true' : 'false'} data-reduce-motion={accessibility.reduceMotion ? 'true' : 'false'} data-density={accessibility.density} data-reading-mode={accessibility.readingMode} data-audience-profile={accessibility.audienceProfile} data-captions-enabled={accessibility.captionsEnabled?'true':'false'} data-audio-muted={accessibility.audioMuted?'true':'false'} style={{'--accessibility-text-scale':accessibility.textScalePercent/100} as CSSProperties}>
      <VisuallyHidden as="div"><div aria-live="polite" aria-atomic="true">{accessibilityAnnouncement(activeItem.label)}</div></VisuallyHidden>
      <a className="skip-link" href="#main-content">{t('shell.skip')}</a>
      <aside className="sidebar">
        <div className="window-brand">
          <div className="brand-icon"><img src={brandMarkUrl} alt=""/></div>
          <div className="brand-copy"><strong>ParsYuva AYM</strong><small>{t('brand.subtitle')}</small></div>
          <button type="button" className="sidebar-toggle" aria-label={sidebarCollapsed ? t('shell.expand') : t('shell.collapse')} onClick={()=>setSidebarCollapsed((value)=>!value)}>{sidebarCollapsed ? '›' : '‹'}</button>
        </div>
        <div className="family-control">
          <button type="button" className="family-switcher" aria-expanded={familyOpen} aria-controls="family-menu" aria-haspopup="dialog" onClick={()=>{setFamilyOpen((value)=>!value);setProfileOpen(false);setNotificationOpen(false);}}>
            <span className="family-icon">♙</span><span className="family-copy"><small>{t('shell.activeFamily')}</small><strong>{snapshot.family.name}</strong></span><span className="disclosure">⌄</span>
          </button>
          {familyOpen && <div id="family-menu" className="sidebar-popover" role="dialog" aria-label="Aktif aile alanı">
            <span className="eyebrow">{t('shell.familyArea')}</span>
            <strong>{snapshot.family.name}</strong>
            <p>{t('shell.familyBody')}</p>
            <Button onClick={()=>navigateFromShell('settings')}>{t('shell.familySettings')}</Button>
          </div>}
        </div>
        <nav aria-label={t('shell.navigation')}>
          {localizedNavGroups.map((group)=><section className="nav-group" key={group.label}>
            <h2 className="nav-group-label">{group.label}</h2>
            {group.items.map((id)=>{
              const item=localizedNavItems.find((candidate)=>candidate.id===id)!;
              return <button type="button" title={sidebarCollapsed ? item.label : undefined} aria-current={active === item.id ? 'page' : undefined} className={active === item.id ? 'active' : ''} key={item.id} onClick={() => navigateFromShell(item.id)}><span aria-hidden="true">{item.icon}</span><span className="nav-label">{item.label}</span>{item.id === 'health' && <i />}{item.id === SECURITY_CENTER_ROUTE && securityCenterNeedsAttention(auth) && <i title="Cihaz yeniden yetkilendirmesi gerekiyor" />}</button>;
            })}
          </section>)}
        </nav>
        <div className="sidebar-footer"><div className="sync-state"><span>◌</span><div><strong>{t('shell.localReady')}</strong><small>{formatDate(snapshot.lastUpdatedAt, { hour: '2-digit', minute: '2-digit', day: '2-digit', month: 'short' })}</small></div><i>✓</i></div><div className="edition-line"><span>{appInfo.releaseLabel}</span><small>{language==='tr'?appInfo.stage:'Bronze · Active Development'}</small></div></div>
      </aside>
      <main ref={mainContentRef} id="main-content" className="main-area" tabIndex={-1} aria-labelledby="current-section-title">
        <header className="topbar">
          <div className="breadcrumb"><span aria-hidden="true">{activeItem.icon}</span><strong id="current-section-title">{activeItem.label}</strong></div>
          <div className="topbar-center">{now}</div>
          <div className="topbar-actions">
            <button type="button" className="help-trigger" aria-haspopup="dialog" aria-expanded={helpOpen} aria-controls="narrated-help-dialog" onClick={()=>{setHelpOpen(true);setSearchOpen(false);setNotificationOpen(false);setProfileOpen(false);setFamilyOpen(false);}}><span aria-hidden="true">?</span><span>{t('shell.help')}</span><kbd>F1</kbd></button>
            <div className="topbar-control">
              <button type="button" className="notification" aria-expanded={notificationOpen} aria-controls="notification-menu" aria-haspopup="dialog" aria-label={`${activeNotifications.length} okunmamış bildirim`} onClick={()=>{setNotificationOpen((value)=>!value);setProfileOpen(false);setFamilyOpen(false);}}>♢{activeNotifications.length>0&&<i>{activeNotifications.length}</i>}</button>
              {notificationOpen&&<div id="notification-menu" className="menu-popover notification-popover" role="dialog" aria-label={t('shell.notifications')}>
                <div className="popover-heading"><div><span className="eyebrow">{t('shell.notifications')}</span><strong>{activeNotifications.length ? `${activeNotifications.length} ${language==='tr'?'yeni bildirim':'new notifications'}` : t('shell.everythingCurrent')}</strong></div><button type="button" aria-label={t('shell.closeNotifications')} onClick={()=>setNotificationOpen(false)}>×</button></div>
                {activeNotifications.length ? activeNotifications.slice(0,5).map((item)=><article key={item.id} className="notification-row"><button type="button" onClick={()=>navigateFromShell('important-days')}><strong>{item.title}</strong><small>{item.body}</small><time>{formatDate(item.dueAt,{dateStyle:'medium'})}</time></button><button type="button" className="acknowledge-button" aria-label={`${item.title} ${language==='tr'?'bildirimini okundu işaretle':'mark notification as read'}`} onClick={()=>void acknowledgeTimelineNotification(item.id)}>✓</button></article>) : <p className="popover-empty">{t('shell.noNotifications')}</p>}
              </div>}
            </div>
            <button ref={searchTriggerRef} type="button" className="search-box" aria-label={t('shell.searchAria')} onClick={()=>setSearchOpen(true)}><span className="search-icon">⌕</span><span>{t('shell.search')}</span><kbd>Ctrl+K</kbd></button>
            <div className="topbar-control">
              <button type="button" className="user-menu" aria-expanded={profileOpen} aria-controls="profile-menu" aria-haspopup="menu" onClick={()=>{setProfileOpen((value)=>!value);setNotificationOpen(false);setFamilyOpen(false);}}>
                <span className="person-avatar">{(auth.displayName??t('shell.user')).split(/\s+/u).slice(0,2).map(part=>part[0]?.toLocaleUpperCase(locale)).join('')}</span>
                <span className="user-copy"><strong>{auth.displayName??t('shell.user')}</strong><small>● {auth.role==='family_admin'?t('auth.admin'):t('auth.member')}</small></span><span className="disclosure">⌄</span>
              </button>
              {profileOpen&&<div id="profile-menu" className="menu-popover profile-popover" role="menu">
                <div className="profile-summary"><span className="person-avatar large">{(auth.displayName??t('shell.user')).split(/\s+/u).slice(0,2).map(part=>part[0]?.toLocaleUpperCase(locale)).join('')}</span><div><strong>{auth.displayName??t('shell.user')}</strong><small>{auth.role==='family_admin'?t('auth.admin'):t('auth.member')} · {t('shell.localProfile')}</small></div></div>
                <button type="button" role="menuitem" onClick={()=>updateAccessibility({...accessibility,theme:theme==='dark'?'light':'dark'})}><span>{theme==='dark'?'☀':'☾'}</span>{theme==='dark'?t('shell.light'):t('shell.dark')}</button>
                <button type="button" role="menuitem" onClick={()=>navigateFromShell('windows-hello')}><span>◎</span>Windows Hello</button>
                <button type="button" role="menuitem" onClick={()=>navigateFromShell(SECURITY_CENTER_ROUTE)}><span>⛨</span>{t('shell.security')}</button>
                <button type="button" role="menuitem" onClick={()=>navigateFromShell('settings')}><span>⇄</span>Ağ çıkış güvenliği</button>
                <button type="button" role="menuitem" onClick={()=>navigateFromShell('settings')}><span>⛓</span>Türetilmiş veri güvenliği</button>
                <button type="button" role="menuitem" onClick={()=>navigateFromShell('settings')}><span>◈</span>Hassas log güvenliği</button>
                <button type="button" role="menuitem" onClick={()=>navigateFromShell('settings')}><span>⚙</span>{t('shell.system')}</button>
                <button type="button" role="menuitem" onClick={()=>void lockSessionNow()}><span>▣</span>{t('shell.lock')}</button>
                <button type="button" role="menuitem" className="danger-action" onClick={()=>void logout()}><span>↪</span>{t('shell.logout')}</button>
              </div>}
            </div>
          </div>
        </header>
        <div className="page-content">
          <div data-session-draft-host="workspace.notes" hidden={active!=='settings'}>
            <GovernedFormDraftCenter visible={active==='settings'}/>
          </div>
          {!networkOnline&&<AsyncStatePanel state={routeOfflineState.panelState} title={routeOfflineState.title} message={routeOfflineState.message} retryLabel="Yeniden dene" retryFocusTarget={mainContentRef} onRetry={async()=>{setNetworkOnline(globalThis.navigator?.onLine!==false);}}/>}
          {loading
            ? <AsyncStatePanel state="loading" title="Aile verileri hazırlanıyor" message="Yetkili kişisel çalışma alanı ve ekran durumu yükleniyor."/>
            : screenDataError
              ? <AsyncStatePanel state={routeErrorState.panelState} title={routeErrorState.title} message={`${routeErrorState.message} ${screenDataError}`} retryLabel="Yeniden dene" retryFocusTarget={mainContentRef} onRetry={()=>{setScreenDataError('');setScreenLoadRevision(value=>value+1);}}/>
              : active!=='dashboard'&&!activeScreenDataReady
                ? <AsyncStatePanel state={routeLoadingState.panelState} title={routeLoadingState.title} message={routeLoadingState.message}/>
                : screen}
        </div>
      </main>
      {searchOpen&&<div className="command-overlay" role="presentation" onMouseDown={()=>setSearchOpen(false)}>
        <section ref={searchDialogRef} className="command-palette" role="dialog" aria-modal="true" aria-labelledby="command-title" aria-describedby="command-help" onMouseDown={(event)=>event.stopPropagation()} onKeyDown={(event)=>{
          if(!['ArrowDown','ArrowUp','Home','End'].includes(event.key))return;
          event.preventDefault();
          const next=nextRovingIndex(searchActiveIndex,searchResults.length,event.key as 'ArrowDown'|'ArrowUp'|'Home'|'End');
          setSearchActiveIndex(next);
          searchResultRefs.current[next]?.focus();
        }}>
          <div className="command-input"><span aria-hidden="true">⌕</span><input autoFocus value={searchQuery} onChange={(event)=>{setSearchQuery(event.target.value);setSearchActiveIndex(0);}} onKeyDown={(event)=>{if(event.key==='Enter'&&searchResults[searchActiveIndex]){event.preventDefault();navigateFromShell(searchResults[searchActiveIndex]!.id);}}} placeholder={language==='tr'?'Bir bölüm veya özellik arayın…':'Search for a section or feature…'} aria-label={language==='tr'?'Arama metni':'Search text'} aria-controls="command-results" aria-activedescendant={searchResults[searchActiveIndex]?`command-result-${searchResults[searchActiveIndex]!.id}`:undefined}/><kbd aria-hidden="true">ESC</kbd></div>
          <div id="command-results" className="command-results" role="listbox" aria-label={searchQuery.trim() ? (language==='tr'?'Arama sonuçları':'Search results') : (language==='tr'?'Hızlı erişim':'Quick access')}>
            <span id="command-title" className="eyebrow">{searchQuery.trim() ? (language==='tr'?'Arama sonuçları':'Search results') : (language==='tr'?'Hızlı erişim':'Quick access')}</span>
            {searchResults.length?searchResults.map((item,index)=><button ref={element=>{searchResultRefs.current[index]=element;}} id={`command-result-${item.id}`} type="button" role="option" aria-selected={searchActiveIndex===index} tabIndex={searchActiveIndex===index?0:-1} key={item.id} onFocus={()=>setSearchActiveIndex(index)} onClick={()=>navigateFromShell(item.id)}><span className="command-icon" aria-hidden="true">{item.icon}</span><span><strong>{item.label}</strong><small>{localizedNavGroups.find((group)=>group.items.includes(item.id))?.label}</small></span><kbd aria-hidden="true">↵</kbd></button>):<div className="command-empty" role="status"><strong>{language==='tr'?'Sonuç bulunamadı':'No results found'}</strong><small>{language==='tr'?'Başka bir bölüm adı deneyin.':'Try another section name.'}</small></div>}
          </div>
          <footer id="command-help"><span>↑↓ {language==='tr'?'Gezin':'Navigate'}</span><span>Enter {language==='tr'?'Aç':'Open'}</span><span>Esc {language==='tr'?'Kapat':'Close'}</span></footer>
        </section>
      </div>}
      {helpOpen&&<NarratedHelpCenter activeScreenLabel={activeItem.label} audioMuted={accessibility.audioMuted} onAudioMutedChange={(audioMuted)=>updateAccessibility({...accessibility,audioMuted})} onClose={()=>setHelpOpen(false)}/>}
      {memberModal && <AddMemberModal fallbackPeople={snapshot.people} onClose={() => setMemberModal(false)} onSave={createMember} />}
      {locationModal && <AddLocationModal onClose={() => setLocationModal(false)} onSave={createLocation} />}
      {relationModal && <AddRelationModal fallbackPeople={snapshot.people} onClose={()=>setRelationModal(false)} onSave={createRelation} />}
      {eventModal && <AddEventModal fallbackPeople={snapshot.people} locations={snapshot.locations} onClose={() => setEventModal(false)} onSave={createEvent} />}
      {editingEvent && <EditEventModal event={editingEvent} fallbackPeople={snapshot.people} locations={snapshot.locations} onClose={()=>setEditingEvent(undefined)} onSave={updateFamilyEvent}/>}
    </div>
    {sessionOverlay}
  </>);
}

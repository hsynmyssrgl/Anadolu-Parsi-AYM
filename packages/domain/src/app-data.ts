import type { FamilyBranch } from './household-membership.js';

export type MemberStatus = 'active' | 'invited' | 'archived';
export type RelationType = 'parent' | 'spouse' | 'child' | 'sibling' | 'guardian' | 'other';

export interface FamilyMemberView {
  id: string;
  displayName: string;
  birthDate?: string;
  relationshipType: string;
  generation: number;
  branch: string;
  status: MemberStatus;
  initials: string;
}

export interface FamilyRelationView {
  id: string;
  fromPersonId: string;
  toPersonId: string;
  relationType: RelationType;
}

export interface FamilyLocationView {
  id: string;
  label: string;
  address?: string;
  latitude?: number;
  longitude?: number;
  kind: 'venue' | 'residence' | 'memory' | 'other';
}

export interface FamilyNotificationView {
  id: string;
  title: string;
  body: string;
  dueAt: string;
  occurrenceKey: string;
  sourceType: 'important_day';
  sourceId: string;
  urgency: 'today' | 'soon' | 'later';
  acknowledgedAt?: string;
}

export interface FamilyEventView {
  id: string;
  kind: string;
  title: string;
  description?: string;
  startAt: string;
  locationId?: string;
  locationLabel?: string;
  visibility: 'personal' | 'selected_members' | 'family';
  participantPersonIds: string[];
  invitationText?: string;
  notes?: string;
  attachmentCount: number;
  aiProcessingAllowed: boolean;
  recurrence: 'none' | 'yearly';
  reminderDays: number[];
  createdAt: string;
  updatedAt?: string;
  archivedAt?: string;
}


export type DashboardModuleId =
  | 'family' | 'tree' | 'timeline' | 'important-days' | 'archive' | 'finance'
  | 'health' | 'life-center' | 'automation' | 'reports' | 'location'
  | 'permissions' | 'ai' | 'legacy' | 'settings';

export interface DashboardModuleStatusView {
  id: DashboardModuleId;
  label: string;
  recordCount: number;
  state: 'ready' | 'empty' | 'attention';
  detail: string;
}

export interface DashboardOverviewView {
  family: { id: string; name: string };
  memberCount: number;
  generationCount: number;
  upcomingImportantDayCount: number;
  nextImportantDayInDays?: number;
  timelineEventCount: number;
  relatedContentCount: number;
  notificationCount: number;
  upcomingImportantDays: FamilyEventView[];
  recentEvents: FamilyEventView[];
  modules: DashboardModuleStatusView[];
  generatedAt: string;
  lastActivityAt: string;
}

export interface FamilyAppSnapshot {
  family: {
    id: string;
    name: string;
  };
  people: FamilyMemberView[];
  relations: FamilyRelationView[];
  locations: FamilyLocationView[];
  events: FamilyEventView[];
  notifications: FamilyNotificationView[];
  lastUpdatedAt: string;
}

export type FamilySnapshotSection = 'graph' | 'timeline';

export interface FamilySnapshotSectionsInput {
  readonly sections: readonly FamilySnapshotSection[];
}

export interface FamilySnapshotPatchView {
  readonly family: FamilyAppSnapshot['family'];
  readonly people?: readonly FamilyMemberView[];
  readonly relations?: readonly FamilyRelationView[];
  readonly locations?: readonly FamilyLocationView[];
  readonly events?: readonly FamilyEventView[];
  readonly notifications?: readonly FamilyNotificationView[];
  readonly loadedSections: readonly FamilySnapshotSection[];
  readonly lastUpdatedAt: string;
}

export type FamilyMutationEntityType = 'person' | 'relation' | 'location' | 'event' | 'notification';
export type FamilyMutationOperation = 'created' | 'updated' | 'archived' | 'restored' | 'acknowledged';
export type FamilyMutationRevisionKey = 'graph' | 'timeline' | 'personCatalog' | 'eventCatalog' | 'dashboard' | 'notifications' | 'archive';

export interface FamilyMutationRevisionsView {
  readonly graph: number;
  readonly timeline: number;
  readonly personCatalog: number;
  readonly eventCatalog: number;
  readonly dashboard: number;
  readonly notifications: number;
  readonly archive: number;
}

export interface FamilyMutationResultView {
  readonly mutationId: string;
  readonly entityType: FamilyMutationEntityType;
  readonly entityId: string;
  readonly operation: FamilyMutationOperation;
  readonly changedSections: readonly FamilySnapshotSection[];
  readonly changedRevisions: readonly FamilyMutationRevisionKey[];
  readonly revisions: FamilyMutationRevisionsView;
  readonly occurredAt: string;
  readonly person?: FamilyMemberView;
  readonly relation?: FamilyRelationView;
  readonly location?: FamilyLocationView;
  readonly event?: FamilyEventView;
  readonly notificationId?: string;
}

export interface PersonCatalogPageInput {
  readonly cursor?: string;
  readonly limit?: number;
  readonly query?: string;
}

export interface PersonCatalogPageView {
  readonly items: FamilyMemberView[];
  readonly hasMore: boolean;
  readonly nextCursor?: string;
  readonly metrics: LargeDataPageMetricsView;
}

export interface EventCatalogItemView {
  readonly id: string;
  readonly title: string;
  readonly kind: string;
  readonly startAt: string;
  readonly archivedAt?: string;
}

export interface EventCatalogPageInput {
  readonly cursor?: string;
  readonly limit?: number;
  readonly query?: string;
  readonly personId?: string;
  readonly kind?: string;
  readonly archiveMode?: 'active' | 'archived' | 'all';
}

export interface EventCatalogPageView {
  readonly items: EventCatalogItemView[];
  readonly hasMore: boolean;
  readonly nextCursor?: string;
  readonly metrics: LargeDataPageMetricsView;
}

export interface EntityCatalogLookupInput {
  readonly personIds?: readonly string[];
  readonly eventIds?: readonly string[];
}

export interface EntityCatalogLookupView {
  readonly people: FamilyMemberView[];
  readonly events: EventCatalogItemView[];
}

export interface LargeDataPageMetricsView {
  readonly returned: number;
  readonly scanned: number;
  readonly queryDurationMs: number;
  readonly limit: number;
}

export interface GenealogyTreePageInput {
  readonly cursor?: string;
  readonly limit?: number;
  readonly query?: string;
  readonly branch?: string;
  readonly generation?: number;
}

export interface GenealogyTreeNodeView extends FamilyMemberView {
  readonly relationCount: number;
  readonly parentCount: number;
  readonly childCount: number;
}

export interface GenealogyTreePageView {
  readonly items: GenealogyTreeNodeView[];
  readonly hasMore: boolean;
  readonly nextCursor?: string;
  readonly metrics: LargeDataPageMetricsView;
}

export interface TimelinePageInput {
  readonly cursor?: string;
  readonly limit?: number;
  readonly query?: string;
  readonly personId?: string;
  readonly kind?: string;
  readonly year?: number;
}

export interface TimelinePageView {
  readonly items: FamilyEventView[];
  readonly hasMore: boolean;
  readonly nextCursor?: string;
  readonly metrics: LargeDataPageMetricsView;
}

export interface CreateFamilyMemberInput {
  displayName: string;
  birthDate?: string;
  relationshipType: string;
  relationshipCode?: import('./family-relationship-catalog.js').FamilyRelationshipCode;
  referencePersonId?: string;
  customRelationshipLabel?: string;
  generation: number;
  branch?: string;
}

export interface CreateFamilyLocationInput {
  label: string;
  address?: string;
  latitude?: number;
  longitude?: number;
  kind: FamilyLocationView['kind'];
}

export interface UpdateEventParticipantsInput { eventId:string; participantPersonIds:string[]; visibility?: FamilyEventView['visibility']; }
export interface UpdateEventInvitationInput { eventId:string; invitationText?:string; }
export interface UpdateEventNotesInput { eventId:string; notes?:string; }
export interface UpdateFamilyEventInput {
  eventId: string;
  title: string;
  description?: string;
  startAt: string;
  locationId?: string;
  locationLabel?: string;
  visibility: FamilyEventView['visibility'];
  participantPersonIds: string[];
  invitationText?: string;
  notes?: string;
  aiProcessingAllowed: boolean;
  recurrence: FamilyEventView['recurrence'];
  reminderDays: number[];
}
export interface SetFamilyEventArchivedInput { eventId:string; archived:boolean; }
export interface AcknowledgeFamilyNotificationInput { notificationId:string; }

export interface CreateFamilyEventInput {
  title: string;
  description?: string;
  startAt: string;
  locationId?: string;
  locationLabel?: string;
  visibility: 'personal' | 'selected_members' | 'family';
  participantPersonIds: string[];
  invitationText?: string;
  notes?: string;
  aiProcessingAllowed: boolean;
  recurrence?: 'none' | 'yearly';
  reminderDays?: number[];
}

export interface LocalProfileView { id: string; displayName: string; role: FamilyRole; initials: string; }
export interface AuthStateView { initialized: boolean; authenticated: boolean; profiles?: LocalProfileView[]; displayName?: string; twoFactorEnabled?: boolean; role?: FamilyRole; sessionExpiresAt?: string; currentDeviceId?: string; trustedDevice?: boolean; securityEpoch?: number; sessionSecurityEpoch?: number; deviceReauthorizationRequired?: boolean; recoveryCodesRemaining?: number; }
export type ExternalIdentityProviderId = 'apple' | 'google' | 'microsoft';
export interface ExternalIdentityProviderView { id: ExternalIdentityProviderId; label: string; configured: boolean; productionReady: boolean; }
export interface SetupAdminInput { familyName?: string; displayName: string; password: string; /** @deprecated Only for legacy validation scripts. The product UI never requests email. */ email?: string; }
export interface LoginInput { accountId?: string; password: string; secondFactorCode?: string; /** @deprecated Only for legacy validation scripts. The product UI uses a local profile id. */ email?: string; }
export interface TwoFactorSetupView { secret: string; otpauthUri: string; recoveryCodes: string[]; }
export interface EnableTwoFactorInput { code: string; }
export interface DisableTwoFactorInput { password: string; code: string; }
export interface TrustCurrentDeviceInput { password: string; code: string; displayName?: string; }
export interface ReauthorizeCurrentDeviceInput { password: string; code: string; confirmation: 'GÜVENLİ CİHAZI YENİDEN YETKİLENDİR'; displayName?: string; }
export interface SecurityEventReceiptView { schemaVersion:1; receiptId:string; eventType:'trusted_device_reauthorized_after_maintenance_recovery'; accountFingerprint:string; deviceId:string; deviceFingerprint:string; securityEpoch:number; trustedDeviceId:string; auditId:string; occurredAt:string; payloadSha256:string; signatureAlgorithm:'Ed25519'; signerPublicKeyPem:string; signatureBase64:string; }
export interface SecurityEventReceiptArchiveItemView { receipt:SecurityEventReceiptView; verificationStatus:'valid'|'invalid'; }
export interface SecurityEventReceiptVerificationView { valid:boolean; status:'VALID'|'INVALID'|'MALFORMED'; message:string; receipt?:SecurityEventReceiptView; }
export interface ReauthorizeCurrentDeviceResultView { devices:TrustedDeviceView[]; receipt:SecurityEventReceiptView; receiptArchived:boolean; }
export interface TrustedDeviceView { id:string; deviceId:string; displayName:string; fingerprint:string; trustedAt:string; lastSeenAt:string; securityEpoch:number; current:boolean; revokedAt?:string; }
export interface CreateFamilyRelationInput { fromPersonId: string; toPersonId: string; relationType: RelationType; }


export type FamilyDataImportEntityType = 'person' | 'relation' | 'location' | 'event';
export type FamilyDataImportBatchStatus = 'applied' | 'rolled_back' | 'rollback_blocked';

export interface FamilyDataImportIssueView {
  severity: 'error' | 'warning';
  code: string;
  message: string;
  path?: string;
}

export interface FamilyDataImportEntitySummaryView {
  entityType: FamilyDataImportEntityType;
  sourceCount: number;
  createCount: number;
  reuseCount: number;
  skipCount: number;
}

export interface FamilyDataImportPreviewView {
  previewId: string;
  fileName: string;
  fileSizeBytes: number;
  sha256: string;
  schemaVersion: 1;
  sourceExportId: string;
  sourceCreatedAt: string;
  sourceFamilyName: string;
  targetFamilyName: string;
  expiresAt: string;
  valid: boolean;
  totalSourceRecords: number;
  totalCreateRecords: number;
  totalReuseRecords: number;
  issues: FamilyDataImportIssueView[];
  entities: FamilyDataImportEntitySummaryView[];
}

export interface ApplyFamilyDataImportInput {
  previewId: string;
  password: string;
  code?: string;
}

export interface RollbackFamilyDataImportInput {
  batchId: string;
  password: string;
  code?: string;
}

export interface FamilyDataImportBatchView {
  id: string;
  sourceFileName: string;
  sourceSha256: string;
  sourceExportId: string;
  sourceCreatedAt: string;
  sourceFamilyName: string;
  schemaVersion: 1;
  status: FamilyDataImportBatchStatus;
  appliedAt: string;
  rollbackDeadline: string;
  rolledBackAt?: string;
  rollbackAvailable: boolean;
  rollbackBlockers: string[];
  entities: FamilyDataImportEntitySummaryView[];
  totalCreatedRecords: number;
  totalReusedRecords: number;
}
export interface ArchiveItemView { id: string; title: string; originalName: string; mimeType: string; sizeBytes: number; sha256: string; createdAt: string; linkedEventId?: string; }
export interface CreateArchiveItemInput { title: string; linkedEventId?: string; }
export interface ArchiveSearchInput { query?:string; categoryId?:string; sensitivity?:'standard'|'personal'|'high'; tag?:string; mimeType?:string; linkedEventId?:string; }
export interface ArchivePageInput extends ArchiveSearchInput { readonly cursor?:string; readonly limit?:number; }
export interface ArchivePageItemView extends ArchiveItemView { readonly categoryId?:string; readonly categoryName?:string; readonly sensitivity:'standard'|'personal'|'high'; readonly tagNames:string[]; readonly retentionPolicyId?:string; readonly retentionPolicyName?:string; readonly retainUntil?:string; readonly eligibleForDestruction:boolean; }
export interface ArchivePageView { readonly items:ArchivePageItemView[]; readonly hasMore:boolean; readonly nextCursor?:string; readonly metrics:LargeDataPageMetricsView; }
export interface ArchiveVersionView { id:string; archiveItemId:string; versionNo:number; originalName:string; mimeType:string; sizeBytes:number; sha256:string; createdAt:string; note?:string; }
export interface ArchiveRetentionPolicyView { id:string; name:string; retentionDays:number; secureDestroy:boolean; createdAt:string; }
export interface CreateArchiveRetentionPolicyInput { name:string; retentionDays:number; secureDestroy:boolean; }
export interface AssignArchiveRetentionPolicyInput { itemId:string; policyId?:string; }
export interface ArchiveRetentionStatusView { itemId:string; policyId?:string; policyName?:string; retainUntil?:string; eligibleForDestruction:boolean; destroyedAt?:string; }

export interface ChangePasswordInput { currentPassword: string; newPassword: string; }
export interface AuditEntryView { id:string; action:string; resourceType:string; resourceId:string; occurredAt:string; actorId?:string; entryHash?:string; }
export interface AuditIntegrityView { valid:boolean; checkedEntries:number; firstInvalidEntryId?:string; headHash?:string; checkedAt:string; }


export type FamilyRole = 'family_admin' | 'adult_member' | 'limited_member' | 'caregiver' | 'advisor';
export type FamilyMembershipStatus = 'active' | 'invited' | 'suspended' | 'expired';
export interface FamilyAccountView { id:string; displayName:string; email:string; role:FamilyRole; status:FamilyMembershipStatus; personId?:string; startsAt:string; endsAt?:string; createdAt:string; }
export type FamilyInvitationStatus = 'pending'|'accepted'|'revoked'|'expired';
export type FamilyInvitationResolutionCode = 'ready'|'not_yet_active'|'expired'|'used'|'revoked'|'invalid';
export type FamilyInvitationRevocationReason = 'manual'|'resent';
export interface FamilyInvitationView { id:string; email:string; role:FamilyRole; personId?:string; startsAt:string; endsAt?:string; status:FamilyInvitationStatus; createdAt:string; acceptedAt?:string; revokedAt?:string; revocationReason?:FamilyInvitationRevocationReason; resentFromInvitationId?:string; supersededByInvitationId?:string; }
export interface CreateFamilyInvitationInput { email:string; role:FamilyRole; personId?:string; startsAt?:string; endsAt?:string; }
export interface AcceptFamilyInvitationInput { token:string; displayName:string; password:string; }
export interface InspectFamilyInvitationInput { token:string; }
export interface ResendFamilyInvitationInput { invitationId:string; startsAt?:string; endsAt?:string; }
export interface FamilyInvitationInspectionView { resolution:FamilyInvitationResolutionCode; canAccept:boolean; message:string; startsAt?:string; endsAt?:string; }
export const OBJECT_PERMISSION_ACTIONS = ['read','create','update','delete','share','record','ai_process','administer'] as const;
export type ObjectPermissionAction = typeof OBJECT_PERMISSION_ACTIONS[number];
export type AuthorizationPurpose = 'general'|'care'|'finance'|'health'|'archive'|'legacy'|'ai_processing'|'administration';
export interface ObjectPermissionView { id:string; subjectAccountId:string; resourceType:string; resourceId:string; actions:ObjectPermissionAction[]; effect:'allow'|'deny'; purpose:AuthorizationPurpose; familyBranchId?:string; ownershipBasisPoints?:number; denialReason?:string; startsAt:string; endsAt?:string; createdAt:string; }
export interface UpsertObjectPermissionInput { id?:string; subjectAccountId:string; resourceType:string; resourceId:string; actions:ObjectPermissionAction[]; effect:'allow'|'deny'; purpose?:AuthorizationPurpose; familyBranchId?:string; ownershipBasisPoints?:number; denialReason?:string; startsAt?:string; endsAt?:string; }
export interface AuthorizationContextWorkspaceView { accounts:readonly FamilyAccountView[]; permissions:readonly ObjectPermissionView[]; branches:readonly FamilyBranch[]; }
export type OfflineCapability =
  | 'family.read'|'family.write'|'health.read'|'health.write'|'finance.read'|'finance.write'
  | 'location.read'|'location.share'|'archive.read'|'archive.write'|'archive.ocr'
  | 'ai.process'|'translation.process'|'communication.message'|'communication.call'
  | 'communication.record'|'file.share'|'backup.create'|'backup.restore'|'cluster.admin'|'plugin.execute';
export type OfflineCapabilityLeaseState = 'pending'|'active'|'expired'|'revoked';
export interface OfflineCapabilityLeaseView {
  schemaVersion:1; leaseId:string; familyId:string; subjectAccountId:string; deviceId:string;
  capability:OfflineCapability; issuedAt:string; notBefore:string; expiresAt:string; policyVersion:string;
  policyPackageVersion:number; policyPackageSha256:string; capabilityManifestSha256:string; nonce:string;
  revokedAt?:string; leaseSha256:string; state:OfflineCapabilityLeaseState; remainingSeconds:number;
}
export interface IssueOfflineCapabilityLeaseInput { subjectAccountId:string; capability:OfflineCapability; durationMinutes:number; }
export interface OfflineSensitiveCacheStateView {
  locked:boolean; reason:'NO_LEASE'|'ACTIVE'|'NOT_YET_VALID'|'EXPIRED'|'REVOKED'|'INVALID_LEASE'|'CONTEXT_MISMATCH';
  leaseId?:string; capability?:OfflineCapability; expiresAt?:string; entryCount:number;
}
export interface OfflineCapabilityLeaseWorkspaceView {
  leases:readonly OfflineCapabilityLeaseView[]; cache:OfflineSensitiveCacheStateView;
  maximumDurationMinutes:number; minimumDurationMinutes:number;
}
export interface ClientDataAccessBoundaryView {
  schemaVersion:1;
  enforcement:'fail-closed';
  allowedTransports:readonly ['typed-electron-ipc','versioned-core-service-api'];
  directAccess:{repository:false;sql:false;sqlite:false;vaultFile:false};
  directAccessExceptionCount:0;
  registeredApplicationServiceChannels:number;
  protectedContextBindings:readonly ['application','device','subject','family','policy-package','capability-manifest','device-certificate','authorization-context'];
  legacyDesktopVaultPreserved:true;
  sqliteOwnershipTransferred:false;
  persistentPathExposed:false;
  secretMaterialExposed:false;
}
export interface NetworkEgressBoundaryView {
  schemaVersion:1;
  enforcement:'fail-closed';
  authorizedApplicationId:'windows-desktop';
  authorizedPurpose:'external-backup-revocation-list.fetch';
  authorizedAdapterCount:1;
  directPrimitiveExceptionCount:0;
  allowlistRequired:true;
  minimumTlsVersion:'TLSv1.3';
  mutualTlsSupported:true;
  certificatePinRotationSupported:true;
  privateAddressRejected:true;
  redirectAllowed:false;
  persistentPathExposed:false;
  secretMaterialExposed:false;
  cutoverAuthorityAttached:false;
}
export interface UpdateFamilyAccountInput { accountId:string; role:FamilyRole; status:FamilyMembershipStatus; startsAt?:string; endsAt?:string; personId?:string; }

export type RecordPrivacy = 'private' | 'selected_members' | 'family';
export interface FinanceRecordView { id:string; ownerPersonId:string; title:string; kind:'asset'|'debt'|'income'|'expense'; amount:number; currency:string; privacy:RecordPrivacy; notes?:string; occurredAt:string; dueAt?:string; remainingPrincipal?:number; symbol?:string; createdAt:string; }
export interface CreateFinanceRecordInput { ownerPersonId:string; title:string; kind:FinanceRecordView['kind']; amount:number; currency:string; privacy:RecordPrivacy; notes?:string; occurredAt:string; dueAt?:string; remainingPrincipal?:number; symbol?:string; }
export interface HealthRecordView { id:string; ownerPersonId:string; title:string; kind:'appointment'|'medication'|'diagnosis'|'vaccine'|'note'; privacy:RecordPrivacy; provider?:string; notes?:string; occurredAt:string; createdAt:string; }
export interface CreateHealthRecordInput { ownerPersonId:string; title:string; kind:HealthRecordView['kind']; privacy:RecordPrivacy; provider?:string; notes?:string; occurredAt:string; }


export interface MedicationPlanView { id:string; ownerPersonId:string; name:string; dosage:string; schedule:string; provider?:string; startsAt:string; endsAt?:string; privacy:RecordPrivacy; notes?:string; createdAt:string; }
export interface CreateMedicationPlanInput { ownerPersonId:string; name:string; dosage:string; schedule:string; provider?:string; startsAt:string; endsAt?:string; privacy:RecordPrivacy; notes?:string; }
export interface FamilyHealthHistoryView { id:string; relatedPersonId:string; condition:string; relationshipNote?:string; diagnosedAt?:string; privacy:RecordPrivacy; notes?:string; createdAt:string; }
export interface CreateFamilyHealthHistoryInput { relatedPersonId:string; condition:string; relationshipNote?:string; diagnosedAt?:string; privacy:RecordPrivacy; notes?:string; }
export interface FinanceValuationView { id:string; financeRecordId:string; valueDate:string; unitPrice:number; quantity:number; marketValue:number; provider:string; createdAt:string; }
export interface CreateFinanceValuationInput { financeRecordId:string; valueDate:string; unitPrice:number; quantity:number; provider?:string; }


export type LifeRecordCategory = 'task'|'insurance'|'education'|'subscription'|'official_operation'|'employment'|'property'|'emergency';
export type LifeRecordStatus = 'planned'|'active'|'completed'|'expired'|'cancelled';
export interface LifeRecordView { id:string; ownerPersonId:string; category:LifeRecordCategory; title:string; status:LifeRecordStatus; privacy:RecordPrivacy; startsAt?:string; dueAt?:string; provider?:string; referenceNo?:string; amount?:number; currency?:string; location?:string; notes?:string; createdAt:string; }
export interface CreateLifeRecordInput { ownerPersonId:string; category:LifeRecordCategory; title:string; status:LifeRecordStatus; privacy:RecordPrivacy; startsAt?:string; dueAt?:string; provider?:string; referenceNo?:string; amount?:number; currency?:string; location?:string; notes?:string; }


export type AutomationSourceType = 'important_day'|'life_record'|'finance_record'|'medication_plan';
export interface AutomationRuleView { id:string; title:string; sourceType:AutomationSourceType; daysBefore:number; enabled:boolean; createdAt:string; }
export interface CreateAutomationRuleInput { title:string; sourceType:AutomationSourceType; daysBefore:number; enabled?:boolean; }
export interface ReportSummaryView { generatedAt:string; peopleCount:number; upcomingEvents:number; activeTasks:number; expiringInsurance:number; activeMedicationPlans:number; financeByCurrency:Array<{currency:string;assets:number;debts:number;net:number}>; overdueItems:Array<{id:string;title:string;sourceType:string;dueAt:string}>; }


export interface GenealogyInsightView { generations:number; branches:Array<{name:string;members:number}>; missingParentLinks:string[]; timeline:Array<{id:string;date:string;title:string;kind:'birth'|'event';personIds:string[]}>; integrity?:{cyclePersonIds:string[];brokenRelationIds:string[];normalizedParentLinkCount:number;calculatedGenerationCount:number}; }
export type ArchiveSensitivity = 'standard'|'personal'|'high';
export interface ArchiveCategoryView { id:string; name:string; description?:string; createdAt:string; }
export interface ArchiveTagView { id:string; name:string; createdAt:string; }
export interface ArchiveClassificationView { itemId:string; categoryId?:string; categoryName?:string; tags:ArchiveTagView[]; sensitivity:ArchiveSensitivity; aiProcessingAllowed:boolean; }
export interface CreateArchiveCategoryInput { name:string; description?:string; }
export interface UpdateArchiveClassificationInput { itemId:string; categoryId?:string; tagNames:string[]; sensitivity:ArchiveSensitivity; aiProcessingAllowed:boolean; }
export type AiConsentPurpose = 'search'|'summary'|'recommendation'|'classification';
export interface AiConsentView { id:string; accountId:string; purpose:AiConsentPurpose; resourceType:string; resourceId:string; status:'granted'|'revoked'; startsAt:string; endsAt?:string; createdAt:string; }
export interface UpsertAiConsentInput { purpose:AiConsentPurpose; resourceType:string; resourceId:string; status:'granted'|'revoked'; startsAt?:string; endsAt?:string; }
export interface AiAccessPreviewView { purpose:AiConsentPurpose; allowedResources:Array<{resourceType:string;resourceId:string;title:string}>; blockedCount:number; generatedAt:string; }


export type AutomationRunStatus = 'generated'|'skipped'|'failed';
export interface AutomationRunView { id:string; ruleId:string; sourceType:string; sourceId:string; title:string; dueAt:string; status:AutomationRunStatus; generatedTaskId?:string; createdAt:string; }
export interface RunAutomationInput { now?:string; }
export type LegacyPlanStatus = 'draft'|'active'|'suspended'|'pending_execution'|'executed'|'revoked';
export interface DigitalLegacyPlanView { id:string; ownerPersonId:string; title:string; status:LegacyPlanStatus; triggerType:'death_confirmation'|'manual'; trusteeAccountId:string; secondaryTrusteeAccountId?:string; instructions?:string; startsAt:string; waitingDays:number; rollbackHours:number; executionRequestedAt?:string; executeAfter?:string; rollbackUntil?:string; createdAt:string; updatedAt:string; }
export interface UpsertDigitalLegacyPlanInput { id?:string; ownerPersonId:string; title:string; status:LegacyPlanStatus; triggerType:'death_confirmation'|'manual'; trusteeAccountId:string; secondaryTrusteeAccountId?:string; instructions?:string; startsAt?:string; waitingDays?:number; rollbackHours?:number; }
export interface LegacyGrantView { id:string; planId:string; resourceType:string; resourceId:string; actions:ObjectPermissionAction[]; createdAt:string; }
export interface UpsertLegacyGrantInput { id?:string; planId:string; resourceType:string; resourceId:string; actions:ObjectPermissionAction[]; }
export interface ExecuteLegacyPlanInput { planId:string; confirmationNote:string; }
export interface LegacyApprovalView { id:string; planId:string; approverAccountId:string; decision:'approved'|'rejected'; note?:string; createdAt:string; }
export interface ApproveLegacyExecutionInput { planId:string; decision:'approved'|'rejected'; note?:string; }
export interface CancelLegacyExecutionInput { planId:string; reason:string; }


export type SystemHealthStatus = 'healthy'|'warning'|'critical';
export interface SystemHealthView { generatedAt:string; status:SystemHealthStatus; platform:string; arch:string; cpuModel:string; cpuCores:number; totalMemoryBytes:number; freeMemoryBytes:number; memoryUsagePercent:number; databaseBytes:number; archiveBytes:number; freeDiskBytes?:number; journalMode:string; integrityOk:boolean; walCheckpoint:string; warnings:string[]; }
export type BackupSchedule='manual'|'hourly'|'daily'|'weekly'|'monthly';
export interface BackupTargetView { id:string; name:string; kind:'local'|'external'|'cloud'; path:string; enabled:boolean; schedule:BackupSchedule; retentionCount:number; retryCount:number; nextRunAt?:string; lastSuccessAt?:string; lastVerifiedAt?:string; lastError?:string; freeBytes?:number; createdAt:string; }
export interface BackupRunView { id:string; targetId:string; status:'success'|'failed'; filePath?:string; sizeBytes?:number; sha256?:string; freeBytes?:number; error?:string; startedAt:string; completedAt:string; }
export interface BackupRunResultView { targetId:string; success:boolean; run:BackupRunView; }
export type BackupPropagationRunStatus='success'|'partial'|'failed'|'attention';
export interface BackupPropagationTargetResultView {
  targetId:string;
  targetName:string;
  success:boolean;
  refreshedRunId?:string;
  freshBackupPath?:string;
  freshBackupSha256?:string;
  quarantineDirectory?:string;
  quarantineManifestPath?:string;
  quarantinedArtifacts:number;
  unmanagedArtifacts:number;
  error?:string;
}
export interface BackupPropagationRunView {
  id:string;
  status:BackupPropagationRunStatus;
  pendingRecords:number;
  targetCount:number;
  refreshedTargets:number;
  quarantinedArtifacts:number;
  pendingRemaining:number;
  manualBackupWarning:boolean;
  targetResults:BackupPropagationTargetResultView[];
  error?:string;
  startedAt:string;
  completedAt:string;
}

export type BackupCleanRewriteTrigger='manual'|'automatic';
export type BackupCleanRewriteState='idle'|'running'|'backoff'|'deferred'|'attention';
export type BackupCleanRewriteOutcome='never'|'success'|'partial'|'failed'|'attention'|'deferred';
export interface BackupCleanRewritePolicyView {
  id:'default';
  enabled:boolean;
  retentionDays:number;
  manualFailureBackoffMinutes:60;
  automaticFailureBackoffMinutes:360;
  highLoadDeferMinutes:30;
  state:BackupCleanRewriteState;
  consecutiveFailures:number;
  lastOutcome:BackupCleanRewriteOutcome;
  lastTrigger?:BackupCleanRewriteTrigger;
  lastAttemptAt?:string;
  lastSuccessAt?:string;
  nextAttemptAt?:string;
  lastError?:string;
  inProgressRunId?:string;
  inProgressStartedAt?:string;
  createdAt:string;
  updatedAt:string;
}
export interface BackupCleanRewriteStatusView {
  policy:BackupCleanRewritePolicyView;
  pendingRecords:number;
  dueRecords:number;
  enabledTargets:number;
  adaptiveDeferred:boolean;
  adaptiveReason?:string;
  checkedAt:string;
}
export interface UpdateBackupCleanRewritePolicyInput {
  enabled:boolean;
  retentionDays:number;
  password:string;
  code?:string;
}
export type BackupCleanRewriteRunStatus='running'|'success'|'partial'|'failed'|'attention'|'deferred'|'interrupted';
export interface BackupCleanRewriteRunView {
  id:string;
  trigger:BackupCleanRewriteTrigger;
  status:BackupCleanRewriteRunStatus;
  retentionCutoff:string;
  dueRecords:number;
  enabledTargets:number;
  propagationRunId?:string;
  nextAttemptAt?:string;
  error?:string;
  startedAt:string;
  completedAt?:string;
  updatedAt:string;
}
export interface BackupCleanRewriteRunResultView {
  trigger:BackupCleanRewriteTrigger;
  status:'success'|'skipped'|'deferred'|'attention'|'failed';
  reason?:string;
  propagationRun?:BackupPropagationRunView;
  rewriteRun?:BackupCleanRewriteRunView;
  policy:BackupCleanRewritePolicyView;
  checkedAt:string;
}

export type BackupQuarantineBatchStatus='retained'|'destroying'|'destroyed';
export interface BackupQuarantinePolicyView {
  id:'default';
  retentionDays:number;
  createdAt:string;
  updatedAt:string;
}
export interface BackupQuarantineBatchView {
  id:string;
  propagationRunId:string;
  targetId:string;
  targetName:string;
  quarantineDirectory:string;
  manifestPath:string;
  status:BackupQuarantineBatchStatus;
  quarantinedArtifacts:number;
  quarantinedAt:string;
  retainUntil:string;
  legalHold:boolean;
  holdReason?:string;
  destroyedAt?:string;
  destroyedArtifacts?:number;
  destroyedBytes?:number;
  updatedAt:string;
}
export interface UpdateBackupQuarantinePolicyInput { retentionDays:number; password:string; code?:string; }
export interface SetBackupQuarantineLegalHoldInput { batchId:string; enabled:boolean; reason?:string; password:string; code?:string; }
export interface DestroyBackupQuarantineBatchInput { batchId:string; confirmation:string; password:string; code?:string; }
export interface BackupQuarantineDestructionResultView {
  batch:BackupQuarantineBatchView;
  destroyedArtifacts:number;
  destroyedBytes:number;
  resumed:boolean;
}


export type ExternalBackupCopyKind='offline_disk'|'manual_file'|'cloud_history'|'other';
export type ExternalBackupCopyStatus='active'|'unreachable'|'retired'|'destroyed';
export type ExternalBackupEvidenceVerificationStatus='none'|'verified'|'revoked';
export type ExternalBackupEvidenceIssuerStatus='trusted'|'revoked';
export type ExternalBackupEvidenceIssuerTrustState='pending'|'active'|'expired'|'revoked';
export type ExternalBackupEvidenceIssuerVerificationMethod='legacy_unverified'|'out_of_band_dual_evidence'|'rotation_inherited';
export type ExternalBackupEvidenceRevocationListStatus='current'|'superseded'|'expired';
export type ExternalBackupEvidenceAlgorithm='ed25519';
export interface ExternalBackupCopyView {
  id:string;
  label:string;
  kind:ExternalBackupCopyKind;
  locationHint:string;
  custodian:string;
  status:ExternalBackupCopyStatus;
  containsHistoricalDataRisk:boolean;
  reviewIntervalDays:number;
  lastReviewedAt?:string;
  nextReviewAt:string;
  legalHold:boolean;
  holdReason?:string;
  attestationNote?:string;
  evidenceSha256?:string;
  evidenceVerificationStatus:ExternalBackupEvidenceVerificationStatus;
  verifiedEvidenceId?:string;
  verifiedEvidenceIssuerLabel?:string;
  attestedAt?:string;
  attestedBy?:string;
  destroyedAt?:string;
  createdAt:string;
  updatedAt:string;
}
export interface ExternalBackupInventorySummaryView {
  total:number;
  active:number;
  unreachable:number;
  retired:number;
  destroyed:number;
  overdue:number;
  legalHold:number;
  historicalDataRisk:number;
  reviewRequired:boolean;
  generatedAt:string;
}
export interface RegisterExternalBackupCopyInput {
  label:string;
  kind:ExternalBackupCopyKind;
  locationHint:string;
  custodian:string;
  reviewIntervalDays:number;
  containsHistoricalDataRisk?:boolean;
}
export interface ReviewExternalBackupCopyInput {
  id:string;
  status:'active'|'unreachable'|'retired';
  containsHistoricalDataRisk:boolean;
  reviewIntervalDays:number;
  note:string;
  confirmation:string;
  password:string;
  code?:string;
}
export interface SetExternalBackupCopyLegalHoldInput {
  id:string;
  enabled:boolean;
  reason?:string;
  password:string;
  code?:string;
}
export interface AttestExternalBackupCopyDestroyedInput {
  id:string;
  note:string;
  evidenceSha256?:string;
  confirmation:string;
  password:string;
  code?:string;
}

export interface ExternalBackupEvidenceIssuerView {
  id:string;
  label:string;
  algorithm:ExternalBackupEvidenceAlgorithm;
  publicKeyPem:string;
  fingerprintSha256:string;
  status:ExternalBackupEvidenceIssuerStatus;
  trustState:ExternalBackupEvidenceIssuerTrustState;
  validFrom:string;
  validUntil?:string;
  predecessorIssuerId?:string;
  rotationSequence:number;
  rotationReceiptId?:string;
  rotationVerifiedAt?:string;
  verificationMethod:ExternalBackupEvidenceIssuerVerificationMethod;
  legalEntityName?:string;
  identityEvidenceReference?:string;
  keyFingerprintEvidenceReference?:string;
  verificationWitnessName?:string;
  verificationWitnessOrganization?:string;
  verificationCheckedAt?:string;
  verificationReceiptSha256?:string;
  addedBy:string;
  addedAt:string;
  revokedBy?:string;
  revokedAt?:string;
  revocationReason?:string;
  revocationSource?:'manual'|'signed_list';
  revocationListId?:string;
  updatedAt:string;
}

export interface ExternalBackupEvidenceRevocationEntryView {
  issuerId:string;
  issuerLabel:string;
  fingerprintSha256:string;
  revokedAt:string;
  reason:string;
}
export interface ExternalBackupEvidenceRevocationListView {
  id:string;
  authorityRootIssuerId:string;
  signerIssuerId:string;
  signerLabel:string;
  listId:string;
  sequenceNumber:number;
  schemaVersion:1;
  thisUpdate:string;
  nextUpdate:string;
  entries:ExternalBackupEvidenceRevocationEntryView[];
  payloadSha256:string;
  signatureBase64:string;
  sourceUrl?:string;
  status:ExternalBackupEvidenceRevocationListStatus;
  verifiedAt:string;
  createdBy:string;
  createdAt:string;
}

export interface ExternalBackupEvidenceIssuerRotationView {
  id:string;
  predecessorIssuerId:string;
  predecessorLabel:string;
  successorIssuerId:string;
  successorLabel:string;
  receiptId:string;
  schemaVersion:1;
  successorFingerprintSha256:string;
  effectiveAt:string;
  signatureBase64:string;
  verifiedAt:string;
  createdBy:string;
  createdAt:string;
}

export interface ExternalBackupDestructionEvidenceView {
  id:string;
  copyId:string;
  issuerId:string;
  issuerLabel:string;
  receiptId:string;
  schemaVersion:1;
  evidenceSha256:string;
  issuedAt:string;
  signatureBase64:string;
  verificationStatus:'verified'|'revoked';
  failureReason?:string;
  verifiedAt:string;
  createdBy:string;
  createdAt:string;
  updatedAt:string;
}
export interface RegisterExternalBackupEvidenceIssuerInput {
  label:string;
  publicKeyPem:string;
  legalEntityName:string;
  identityEvidenceReference:string;
  keyFingerprintEvidenceReference:string;
  expectedFingerprintSha256:string;
  verificationWitnessName:string;
  verificationWitnessOrganization:string;
  verificationCheckedAt:string;
  confirmation:string;
  password:string;
  code?:string;
}

export interface RotateExternalBackupEvidenceIssuerInput {
  predecessorIssuerId:string;
  label:string;
  publicKeyPem:string;
  effectiveAt:string;
  receiptId:string;
  signatureBase64:string;
  confirmation:string;
  password:string;
  code?:string;
}

export interface RevokeExternalBackupEvidenceIssuerInput {
  id:string;
  reason:string;
  confirmation:string;
  password:string;
  code?:string;
}
export type ExternalBackupRevocationEndpointStatus='active'|'disabled';
export type ExternalBackupRevocationEndpointFetchStatus='never'|'success'|'failed';
export interface ExternalBackupRevocationEndpointView {
  id:string;
  issuerId:string;
  issuerLabel:string;
  sourceUrl:string;
  primarySpkiSha256:string;
  secondarySpkiSha256?:string;
  secondaryValidFrom?:string;
  primaryValidUntil?:string;
  status:ExternalBackupRevocationEndpointStatus;
  lastFetchStatus:ExternalBackupRevocationEndpointFetchStatus;
  lastFetchedAt?:string;
  lastFetchError?:string;
  createdBy:string;
  createdAt:string;
  updatedAt:string;
}
export interface UpsertExternalBackupRevocationEndpointInput {
  issuerId:string;
  sourceUrl:string;
  primarySpkiSha256:string;
  secondarySpkiSha256?:string;
  secondaryValidFrom?:string;
  primaryValidUntil?:string;
  enabled:boolean;
  confirmation:string;
  password:string;
  code?:string;
}
export interface FetchExternalBackupEvidenceRevocationListInput { endpointId:string; timeoutMs?:number; }
export type RevocationSyncEndpointStatus='idle'|'checking'|'update_available'|'current'|'backoff'|'blocked';
export type RevocationSyncListFreshness='missing'|'fresh'|'expiring_soon'|'expired';
export type RevocationSyncPersistenceStatus='healthy'|'unavailable'|'failed';
export interface RevocationSyncEndpointStateView { endpointId:string; status:RevocationSyncEndpointStatus; consecutiveFailures:number; nextAttemptAt:string; lastAttemptAt?:string; lastSuccessAt?:string; lastError?:string; pendingSequenceNumber?:number; pendingListId?:string; pendingFetchedAt?:string; listFreshness:RevocationSyncListFreshness; currentSequenceNumber?:number; currentNextUpdate?:string; persistenceStatus:RevocationSyncPersistenceStatus; }
export interface RevocationSyncRunResultView { startedAt:string; finishedAt:string; checked:number; updates:number; failed:number; skipped:number; }
export interface FetchedExternalBackupEvidenceRevocationListView {
  endpointId:string;
  list:Omit<ApplyExternalBackupEvidenceRevocationListInput,'confirmation'|'password'|'code'>;
  fetchedAt:string; sourceUrl:string; tlsSpkiSha256:string; matchedPin:'primary'|'secondary'; responseBytes:number;
}
export interface PendingRevocationSyncListView {
  endpointId:string;
  listId:string;
  signerIssuerId:string;
  sequenceNumber:number;
  thisUpdate:string;
  nextUpdate:string;
  entryCount:number;
  fetchedAt:string;
  sourceUrl:string;
  tlsSpkiSha256:string;
  matchedPin:'primary'|'secondary';
  responseBytes:number;
}
export interface ApplyPendingRevocationSyncInput {
  endpointId:string;
  pendingListId:string;
  confirmation:string;
  password:string;
  code?:string;
}
export interface ApplyExternalBackupEvidenceRevocationListInput {
  signerIssuerId:string;
  listId:string;
  sequenceNumber:number;
  thisUpdate:string;
  nextUpdate:string;
  entries:Array<{fingerprintSha256:string;revokedAt:string;reason:string}>;
  signatureBase64:string;
  sourceUrl?:string;
  confirmation:string;
  password:string;
  code?:string;
}
export interface VerifyExternalBackupDestructionEvidenceInput {
  copyId:string;
  issuerId:string;
  receiptId:string;
  issuedAt:string;
  evidenceSha256:string;
  signatureBase64:string;
  confirmation:string;
  password:string;
  code?:string;
}

export interface PerformanceSampleView { id:string; cpuLoadPercent:number; memoryUsagePercent:number; databaseBytes:number; archiveBytes:number; sampledAt:string; }
export interface PerformanceTrendView { generatedAt:string; sampleCount:number; windowHours:number; averageCpuPercent:number; averageMemoryPercent:number; peakCpuPercent:number; peakMemoryPercent:number; databaseGrowthBytes:number; archiveGrowthBytes:number; direction:'improving'|'stable'|'degrading'; }
export interface BackgroundTaskView { id:string; taskType:string; label:string; status:'running'|'success'|'failed'|'deferred'; startedAt:string; completedAt?:string; durationMs?:number; warningThresholdMs:number; details?:string; }
export interface SchedulerStatusView { active:boolean; startedAt?:string; lastCycleAt?:string; cycleIntervalSeconds:number; performanceIntervalSeconds:number; lastResult?:BackupSchedulerResultView; }
export interface UpsertBackupTargetInput { id?:string; name:string; kind:'local'|'external'|'cloud'; path:string; enabled?:boolean; schedule?:BackupSchedule; retentionCount?:number; retryCount?:number; }
export interface BackupSchedulerResultView { checkedAt:string; dueTargets:number; successful:number; failed:number; deferred:number; results:BackupRunResultView[]; }
export interface AdaptiveResourceStateView { generatedAt:string; profile:'low'|'balanced'|'high'; cpuLoadPercent:number; memoryUsagePercent:number; maxConcurrentJobs:number; deferBackgroundJobs:boolean; reason:string; }
export interface DiagnosticEntryView { id:string; severity:'info'|'warning'|'error'; code:string; message:string; details?:string; occurredAt:string; }
export interface DiagnosticFilterInput { query?:string; severity?:DiagnosticEntryView['severity']; code?:string; from?:string; to?:string; limit?:number; }
export interface DiagnosticReportHistoryView { id:string; generatedAt:string; healthScore:number; status:SystemHealthStatus; filePath?:string; sha256:string; sizeBytes:number; }
export interface SystemHealthScoreView { generatedAt:string; score:number; grade:'excellent'|'good'|'attention'|'critical'; deductions:Array<{code:string;points:number;message:string}>; systemStatus:SystemHealthStatus; activeNotifications:number; failedBackups24h:number; longRunningTasks24h:number; }
export interface SystemHealthHistoryView { id:string; score:number; grade:SystemHealthScoreView['grade']; systemStatus:SystemHealthStatus; deductions:number; capturedAt:string; }
export interface SystemHealthTrendView { generatedAt:string; windowDays:number; sampleCount:number; currentScore:number; averageScore:number; minimumScore:number; maximumScore:number; change:number; direction:'improving'|'stable'|'degrading'; }
export interface DiagnosticArchiveView { id:string; createdAt:string; from:string; to:string; entryCount:number; filePath:string; sha256:string; sizeBytes:number; }
export interface DiagnosticReportVerificationView { id:string; exists:boolean; valid:boolean; expectedSha256:string; actualSha256?:string; checkedAt:string; }
export interface DiagnosticArchiveVerificationView { id:string; exists:boolean; valid:boolean; expectedSha256:string; actualSha256?:string; checkedAt:string; }
export interface DiagnosticReportContentView { id:string; generatedAt:string; filePath?:string; valid:boolean; content:string; }
export interface DiagnosticReportComparisonView { leftId:string; rightId:string; leftGeneratedAt:string; rightGeneratedAt:string; leftHealthScore:number; rightHealthScore:number; healthScoreChange:number; statusChanged:boolean; addedKeys:string[]; removedKeys:string[]; changedKeys:string[]; sectionChanges:Array<{key:string;kind:'added'|'removed'|'changed';leftSummary?:string;rightSummary?:string}>; fieldChanges?:DiagnosticFieldChangeView[]; }
export interface DiagnosticArchiveContentView { id:string; valid:boolean; entryCount:number; entries:DiagnosticEntryView[]; }
export interface DiagnosticArchiveSearchInput { query?:string; severity?:DiagnosticEntryView['severity']; code?:string; limit?:number; }
export interface DiagnosticArchiveExportView { archiveId:string; filePath:string; format:'json'|'csv'; entryCount:number; sha256:string; sizeBytes:number; exportedAt:string; }
export interface MaintenanceHistoryView { id:string; operation:MaintenanceResultView['operation']; success:boolean; message:string; startedAt:string; completedAt:string; durationMs:number; source:'manual'|'queue'|'automatic'; }

export interface MaintenanceHistoryFilterInput { operation?:MaintenanceResultView['operation']; success?:boolean; source?:MaintenanceHistoryView['source']; from?:string; to?:string; limit?:number; }
export interface MaintenanceHistoryExportView { filePath:string; format:'json'|'csv'; recordCount:number; sizeBytes:number; sha256:string; }
export interface UnifiedDiagnosticArchiveMatchView { archiveId:string; archiveCreatedAt:string; entry:DiagnosticEntryView; }
export interface UnifiedDiagnosticArchiveSearchView { generatedAt:string; archiveCount:number; totalMatches:number; matches:UnifiedDiagnosticArchiveMatchView[]; }
export interface SystemReportPdfView { filePath:string; sizeBytes:number; sha256:string; generatedAt:string; }
export type ExportArtifactKind='diagnostic_report'|'diagnostic_archive'|'maintenance_history'|'system_pdf';
export interface ExportArtifactView { id:string; kind:ExportArtifactKind; format:'json'|'csv'|'pdf'; filePath:string; sha256:string; sizeBytes:number; recordCount?:number; createdAt:string; }
export interface ExportArtifactVerificationView { id:string; exists:boolean; valid:boolean; expectedSha256:string; actualSha256?:string; checkedAt:string; }
export interface DiagnosticFieldChangeView { path:string; kind:'added'|'removed'|'changed'; leftValue?:string; rightValue?:string; }


export interface PerformanceAnomalyView { metric:'cpu'|'memory'|'database_growth'|'archive_growth'; severity:'warning'|'critical'; value:number; threshold:number; message:string; detectedAt:string; }
export interface MaintenanceRecommendationView { code:string; priority:'low'|'normal'|'high'; title:string; message:string; recommendedOperation?:MaintenanceResultView['operation']; }
export interface MaintenanceResultView { operation:'integrity_check'|'wal_checkpoint'|'analyze'|'vacuum'; success:boolean; message:string; completedAt:string; }


export type TaskPriority = 'critical'|'high'|'normal'|'low';
export type QueuedTaskStatus = 'queued'|'running'|'completed'|'failed'|'deferred';
export interface QueuedTaskView { id:string; taskType:string; label:string; priority:TaskPriority; status:QueuedTaskStatus; createdAt:string; startedAt?:string; completedAt?:string; attempts:number; maxAttempts:number; payload?:string; details?:string; }
export interface EnqueueTaskInput { taskType:string; label:string; priority?:TaskPriority; maxAttempts?:number; payload?:string; }
export interface TaskQueueCycleResultView { checkedAt:string; capacity:number; processed:number; completed:number; failed:number; deferred:number; taskIds:string[]; }
export interface MaintenancePolicyView { id:string; enabled:boolean; intervalHours:number; keepDiagnosticDays:number; keepPerformanceDays:number; nextRunAt?:string; lastRunAt?:string; createdAt:string; }
export interface UpsertMaintenancePolicyInput { enabled?:boolean; intervalHours?:number; keepDiagnosticDays?:number; keepPerformanceDays?:number; }
export interface MaintenanceCycleResultView { startedAt:string; completedAt:string; deletedDiagnostics:number; deletedPerformanceSamples:number; operations:MaintenanceResultView[]; success:boolean; }
export interface HealthNotificationView { id:string; severity:'info'|'warning'|'critical'; code:string; title:string; message:string; createdAt:string; acknowledgedAt?:string; generatedTaskId?:string; }

export type IpcPerformanceTelemetryPriority = 'interactive'|'standard'|'background';
export interface IpcPerformanceTelemetryChannelView { channel:string; priority:IpcPerformanceTelemetryPriority; sampleCount:number; successCount:number; failureCount:number; cancelledCount:number; timeoutCount:number; queueFullCount:number; queueTimeoutCount:number; cacheHitCount:number; cacheStoreCount:number; averageDurationMs:number; p95DurationMs:number; maxDurationMs:number; averageQueueWaitMs:number; p95QueueWaitMs:number; maxQueueWaitMs:number; peakActiveCount:number; peakQueuedCount:number; cacheHitRatePercent:number; lastObservedAt:string; }
export interface IpcPerformanceTelemetryAlertView { code:'duration-p95'|'queue-wait-p95'|'timeout-rate'|'queue-rejection-rate'|'global-pressure'; severity:'warning'|'critical'; channel?:string; metric:string; value:number; threshold:number; message:string; detectedAt:string; }
export type IpcAdaptiveResourceBudgetMode = 'baseline'|'guarded'|'restricted';
export interface IpcAdaptiveResourceBudgetAdmissionView { priority:IpcPerformanceTelemetryPriority; maxConcurrentPerSender:number; maxConcurrentPerChannel:number; maxQueuedPerSender:number; queueTimeoutMs:number; }
export interface IpcAdaptiveResourceBudgetCacheView { priority:'interactive'|'standard'; ttlMsCap:number; maxEntries:number; maxResultBytes:number; }
export interface IpcAdaptiveResourceBudgetPersistenceView { status:'disabled'|'initialized'|'verified'|'recovered'|'rejected'|'write-failed'; reason:string; lastPersistedAt?:string; }
export interface IpcAdaptiveResourceBudgetView { schemaVersion:1; mode:IpcAdaptiveResourceBudgetMode; reason:'startup-baseline'|'insufficient-samples'|'healthy'|'warning-pressure'|'critical-pressure'|'invalid-telemetry'|'recovery-hold'|'restored'|'restore-rejected'|'persistence-failure'|'manual-reset'; generation:number; evaluatedAt:string; sampleCount:number; minimumSampleCount:number; recoveryNotBefore?:string; admission:readonly IpcAdaptiveResourceBudgetAdmissionView[]; cache:readonly IpcAdaptiveResourceBudgetCacheView[]; persistence:IpcAdaptiveResourceBudgetPersistenceView; }
export interface IpcPerformanceTelemetryView { generatedAt:string; windowMinutes:number; maxSamplesPerChannel:number; totalSamples:number; activeRequests:number; queuedRequests:number; cacheEntries:number; channels:readonly IpcPerformanceTelemetryChannelView[]; alerts:readonly IpcPerformanceTelemetryAlertView[]; adaptiveBudget:IpcAdaptiveResourceBudgetView; }
export type IpcAdaptiveBudgetMaintenanceOperation = 'reset' | 'diagnostics-export';
export type IpcAdaptiveBudgetMaintenanceAuthorityReason = 'ALLOWED'|'AUTHENTICATION_REQUIRED'|'SESSION_EXPIRED'|'ROLE_NOT_ALLOWED'|'DEVICE_CONTEXT_REQUIRED'|'TRUSTED_DEVICE_REQUIRED'|'REAUTHENTICATION_LOCKED';
export interface IpcAdaptiveBudgetMaintenanceAuthorityView { allowed:boolean; reason:IpcAdaptiveBudgetMaintenanceAuthorityReason; requiredRole:'family_admin'; trustedDeviceRequired:true; strongReauthenticationRequired:true; twoFactorRequired:boolean; reauthenticationLocked:boolean; remainingReauthenticationAttempts:number; maximumReauthenticationAttempts:number; reauthenticationRetryAfterSeconds?:number; reauthenticationLockedUntil?:string; sessionExpiresAt?:string; }
export interface IpcAdaptiveBudgetMaintenanceReauthenticationInput { password:string; code?:string; }
export interface IpcAdaptiveBudgetMaintenanceSessionView { canceled:boolean; sessionId?:string; operation?:IpcAdaptiveBudgetMaintenanceOperation; issuedAt?:string; expiresAt?:string; }
export interface IpcAdaptiveBudgetMaintenanceAuthorizationInput { sessionId:string; rendererSessionId:string; operation:IpcAdaptiveBudgetMaintenanceOperation; }
export type IpcAdaptiveBudgetMaintenanceRecoveryAuthorityReason = 'ALLOWED'|'RECOVERY_NOT_REQUIRED'|'AUTHENTICATION_REQUIRED'|'SESSION_EXPIRED'|'ROLE_NOT_ALLOWED'|'DEVICE_CONTEXT_REQUIRED'|'TRUSTED_DEVICE_REQUIRED'|'RECOVERY_RATE_LIMITED'|'RECOVERY_COOLDOWN_ACTIVE';
export interface IpcAdaptiveBudgetMaintenanceRecoveryAuthorityView { allowed:boolean; reason:IpcAdaptiveBudgetMaintenanceRecoveryAuthorityReason; recoveryRequired:boolean; requiredRole:'family_admin'; trustedDeviceRequired:true; strongReauthenticationRequired:true; explicitConfirmationRequired:true; confirmationPhrase:'BAKIM KİLİDİNİ SIFIRLA'; twoFactorRequired:boolean; recoveryLocked:boolean; remainingRecoveryAttempts:number; maximumRecoveryAttempts:number; recoveryRetryAfterSeconds?:number; recoveryLockedUntil?:string; recoveryCooldownActive:boolean; recoveryCooldownRetryAfterSeconds?:number; recoveryCooldownUntil?:string; sessionTerminationRequired:true; trustedDeviceReevaluationRequired:true; sessionExpiresAt?:string; }
export interface IpcAdaptiveBudgetMaintenanceRecoveryInput { password:string; code?:string; confirmation:'BAKIM KİLİDİNİ SIFIRLA'; }
export interface IpcAdaptiveBudgetMaintenanceRecoveryView { canceled:boolean; recovered?:boolean; recoveredAt?:string; previousReason?:IpcAdaptiveBudgetMaintenanceAuthorityReason; clearedContextCount?:number; recoveryContextFingerprint?:string; sessionTerminated?:boolean; trustedDeviceReevaluationRequired?:boolean; recoveryCooldownUntil?:string; securityEpochAdvanced?:boolean; previousSecurityEpoch?:number; securityEpoch?:number; trustedDevicesRevoked?:boolean; revokedTrustedDeviceCount?:number; }
export interface IpcAdaptiveBudgetResetView { canceled:boolean; resetAt?:string; previousMode?:IpcAdaptiveResourceBudgetMode; current?:IpcAdaptiveResourceBudgetView; cacheCleared?:boolean; telemetryCleared?:boolean; quarantinePruned?:number; maintenanceSessionFingerprint?:string; }
export interface IpcAdaptiveBudgetDiagnosticExportView { canceled:boolean; filePath?:string; checksumPath?:string; sha256?:string; sizeBytes?:number; generatedAt?:string; journalEntryCount?:number; quarantineFileCount?:number; maintenanceSessionFingerprint?:string; }
export interface DiagnosticReportView {
  generatedAt:string;
  healthScore:SystemHealthScoreView;
  system:SystemHealthView;
  adaptive:AdaptiveResourceStateView;
  performance:PerformanceTrendView;
  diagnostics:DiagnosticEntryView[];
  backupResults:{targetCount:number;recentRunCount:number;successfulRunCount:number;failedRunCount:number};
  notificationResults:{activeCount:number};
  queueResults:{totalCount:number;queuedCount:number;runningCount:number;completedCount:number;failedCount:number;deferredCount:number};
}

export interface BackupInspectionCheckView { code:string; label:string; valid:boolean; detail:string; }
export interface BackupInspectionView { valid:boolean; formatVersion:number; legacy:boolean; createdAt?:string; archiveCount:number; databaseBytes:number; archiveBytes:number; fileBytes:number; sha256:string; riskLevel:'low'|'attention'; recommendation:string; checks:BackupInspectionCheckView[]; }

export type DataLifecycleResourceType = 'finance_record'|'health_record'|'medication_plan'|'family_health_history'|'life_record';
export type DataLifecycleState = 'active'|'archived'|'purge_scheduled'|'purged';
export interface DataRetentionPolicyView {
  id:string;
  name:string;
  resourceTypes:DataLifecycleResourceType[];
  retentionDays:number;
  graceDays:number;
  requiresStrongAuth:boolean;
  createdAt:string;
}
export interface DataLifecycleRecordView {
  resourceType:DataLifecycleResourceType;
  resourceId:string;
  title:string;
  ownerPersonId?:string;
  privacy?:RecordPrivacy;
  state:DataLifecycleState;
  policyId?:string;
  policyName?:string;
  archivedAt?:string;
  purgeEligibleAt?:string;
  purgeRequestedAt?:string;
  purgeExecuteAfter?:string;
  legalHold:boolean;
  holdReason?:string;
  purgedAt?:string;
  updatedAt:string;
  backupPropagationPending:boolean;
}
export interface CreateDataRetentionPolicyInput {
  name:string;
  resourceTypes:DataLifecycleResourceType[];
  retentionDays:number;
  graceDays:number;
  requiresStrongAuth?:boolean;
}
export interface ArchiveDataResourceInput {
  resourceType:DataLifecycleResourceType;
  resourceId:string;
  policyId?:string;
}
export interface RestoreDataResourceInput {
  resourceType:DataLifecycleResourceType;
  resourceId:string;
}
export interface RequestDataPurgeInput {
  resourceType:DataLifecycleResourceType;
  resourceId:string;
  password:string;
  code?:string;
  confirmation:string;
}
export interface CancelDataPurgeInput {
  resourceType:DataLifecycleResourceType;
  resourceId:string;
}
export interface ExecuteDataPurgeInput {
  resourceType:DataLifecycleResourceType;
  resourceId:string;
  password:string;
  code?:string;
  confirmation:string;
}
export interface SetDataLegalHoldInput {
  resourceType:DataLifecycleResourceType;
  resourceId:string;
  enabled:boolean;
  reason:string;
  password:string;
  code?:string;
}

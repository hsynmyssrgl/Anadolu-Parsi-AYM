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
export const BANK_ACCOUNT_TYPES = ['checking','savings','time_deposit','participation','investment','other'] as const;
export type BankAccountType = typeof BANK_ACCOUNT_TYPES[number];
export const BANK_ACCOUNT_STATUSES = ['active','inactive','closed'] as const;
export type BankAccountStatus = typeof BANK_ACCOUNT_STATUSES[number];
export type BankInstitutionKind = 'bank'|'central_bank'|'postal_payment'|'market_infrastructure';
export interface BankInstitutionView {
  institutionCode:string;
  ibanProviderCode:string;
  officialName:string;
  countryCode:'TR';
  kind:BankInstitutionKind;
  supportsCustomerAccounts:boolean;
  iconKey:string;
  iconSource:'local_lettermark';
  sourceName:'TCMB Ödeme Sistemleri Katılımcıları';
  sourceVersion:'2026';
  sourceUrl:string;
  sourceRetrievedAt:string;
  status:'active';
}
export type IbanStructuralErrorCode =
  | 'EMPTY'
  | 'INVALID_CHARACTERS'
  | 'COUNTRY_UNSUPPORTED'
  | 'LENGTH_MISMATCH'
  | 'CHECKSUM_INVALID'
  | 'TR_PROVIDER_CODE_INVALID'
  | 'TR_RESERVED_FIELD_INVALID'
  | 'TR_INSTITUTION_NOT_FOUND';
export interface IbanStructuralValidationView {
  countryCode?:string;
  expectedLength?:number;
  actualLength:number;
  structurallyValid:boolean;
  countryFormatValid:boolean;
  lengthValid:boolean;
  checksumValid:boolean;
  trProviderCode?:string;
  trReservedFieldValid?:boolean;
  institutionMatched:boolean;
  institutionCode?:string;
  institutionOfficialName?:string;
  maskedIban?:string;
  errorCodes:readonly IbanStructuralErrorCode[];
  accountVerification:'not_performed';
  ownershipVerification:'not_performed';
}
export interface ValidateIbanInput { iban:string; }
export interface BankAccountView {
  id:string;
  ownerPersonId:string;
  institutionCode:string;
  institutionOfficialName:string;
  institutionIconKey:string;
  ibanMasked:string;
  ibanLast4:string;
  ibanCountryCode:string;
  ibanProviderCode:string;
  ibanStructurallyValid:true;
  institutionMatched:true;
  accountVerification:'not_performed';
  ownershipVerification:'not_performed';
  accountType:BankAccountType;
  currency:string;
  alias:string;
  branch?:string;
  ownershipBasisPoints:number;
  status:BankAccountStatus;
  privacy:RecordPrivacy;
  createdAt:string;
}
export interface CreateBankAccountInput {
  ownerPersonId:string;
  institutionCode:string;
  iban:string;
  accountType:BankAccountType;
  currency:string;
  alias:string;
  branch?:string;
  ownershipBasisPoints:number;
  status:BankAccountStatus;
  privacy:RecordPrivacy;
}
export const PAYMENT_CARD_KINDS = ['credit','debit','prepaid'] as const;
export type PaymentCardKind = typeof PAYMENT_CARD_KINDS[number];
export const PAYMENT_CARD_NETWORKS = ['troy','visa','mastercard','american_express','unionpay','other'] as const;
export type PaymentCardNetwork = typeof PAYMENT_CARD_NETWORKS[number];
export const PAYMENT_CARD_FORM_FACTORS = ['physical','virtual','supplementary'] as const;
export type PaymentCardFormFactor = typeof PAYMENT_CARD_FORM_FACTORS[number];
export const PAYMENT_CARD_AUTOMATIC_PAYMENT_MODES = ['none','minimum','full'] as const;
export type PaymentCardAutomaticPaymentMode = typeof PAYMENT_CARD_AUTOMATIC_PAYMENT_MODES[number];
export const PAYMENT_CARD_STATUSES = ['active','frozen','closed'] as const;
export type PaymentCardStatus = typeof PAYMENT_CARD_STATUSES[number];
export interface PaymentCardView {
  id:string;
  ownerPersonId:string;
  institutionCode:string;
  institutionOfficialName:string;
  institutionIconKey:string;
  productName:string;
  kind:PaymentCardKind;
  network:PaymentCardNetwork;
  formFactor:PaymentCardFormFactor;
  last4:string;
  currency:string;
  creditLimit:number;
  availableLimit:number;
  currentDebt:number;
  statementBalance:number;
  statementClosingAt:string;
  paymentDueAt:string;
  activeInstallmentCount:number;
  installmentOutstandingAmount:number;
  automaticPaymentMode:PaymentCardAutomaticPaymentMode;
  rewardPoints:number;
  rewardMiles:number;
  annualFeeAmount:number;
  annualFeeDueAt?:string;
  alertsEnabled:boolean;
  utilizationAlertBasisPoints:number;
  paymentDueAlertDays:number;
  status:PaymentCardStatus;
  privacy:RecordPrivacy;
  createdAt:string;
}
export interface CreatePaymentCardInput {
  ownerPersonId:string;
  institutionCode:string;
  productName:string;
  kind:PaymentCardKind;
  network:PaymentCardNetwork;
  formFactor:PaymentCardFormFactor;
  last4:string;
  currency:string;
  creditLimit:number;
  availableLimit:number;
  currentDebt:number;
  statementBalance:number;
  statementClosingAt:string;
  paymentDueAt:string;
  activeInstallmentCount:number;
  installmentOutstandingAmount:number;
  automaticPaymentMode:PaymentCardAutomaticPaymentMode;
  rewardPoints:number;
  rewardMiles:number;
  annualFeeAmount:number;
  annualFeeDueAt?:string;
  alertsEnabled:boolean;
  utilizationAlertBasisPoints:number;
  paymentDueAlertDays:number;
  status:PaymentCardStatus;
  privacy:RecordPrivacy;
}
export const LOAN_KINDS = ['consumer','mortgage','vehicle','other'] as const;
export type LoanKind = typeof LOAN_KINDS[number];
export const LOAN_RATE_TYPES = ['fixed','variable','profit_share','interest_free'] as const;
export type LoanRateType = typeof LOAN_RATE_TYPES[number];
export const LOAN_STATUSES = ['active','overdue','restructured','closed'] as const;
export type LoanStatus = typeof LOAN_STATUSES[number];
export const LOAN_INSURANCE_STATUSES = ['none','active','expired','cancelled'] as const;
export type LoanInsuranceStatus = typeof LOAN_INSURANCE_STATUSES[number];
export const LOAN_COLLATERAL_TYPES = ['none','vehicle','real_estate','deposit','guarantee','other'] as const;
export type LoanCollateralType = typeof LOAN_COLLATERAL_TYPES[number];
export interface LoanPaymentScheduleItemView {
  sequence:number;
  dueAt:string;
  scheduledAmount:number;
}
export interface LoanPaymentHistoryItemView {
  id:string;
  loanId:string;
  paidAt:string;
  scheduledInstallmentSequence?:number;
  amount:number;
  principalAmount:number;
  interestAmount:number;
  lateFeeAmount:number;
  notes?:string;
  createdAt:string;
}
export interface LoanAccountView {
  id:string;
  ownerPersonId:string;
  institutionCode:string;
  institutionOfficialName:string;
  institutionIconKey:string;
  title:string;
  kind:LoanKind;
  rateType:LoanRateType;
  annualRateBasisPoints:number;
  termMonths:number;
  currency:string;
  originalPrincipal:number;
  installmentAmount:number;
  remainingPrincipal:number;
  disbursedAt:string;
  firstPaymentAt:string;
  maturityAt:string;
  earlySettlementAmount:number;
  earlySettlementQuotedAt?:string;
  overdueInstallmentCount:number;
  overdueAmount:number;
  daysPastDue:number;
  insuranceStatus:LoanInsuranceStatus;
  insuranceProvider?:string;
  insurancePolicyReference?:string;
  insurancePremiumAmount:number;
  insuranceEndsAt?:string;
  collateralType:LoanCollateralType;
  collateralDescription?:string;
  collateralEstimatedValue:number;
  status:LoanStatus;
  privacy:RecordPrivacy;
  dataSource:'manual';
  bankVerification:'not_performed';
  paymentExecution:'not_performed';
  paymentSchedule:readonly LoanPaymentScheduleItemView[];
  paymentHistory:readonly LoanPaymentHistoryItemView[];
  createdAt:string;
}
export interface CreateLoanAccountInput {
  ownerPersonId:string;
  institutionCode:string;
  title:string;
  kind:LoanKind;
  rateType:LoanRateType;
  annualRateBasisPoints:number;
  termMonths:number;
  currency:string;
  originalPrincipal:number;
  installmentAmount:number;
  remainingPrincipal:number;
  disbursedAt:string;
  firstPaymentAt:string;
  earlySettlementAmount:number;
  earlySettlementQuotedAt?:string;
  overdueInstallmentCount:number;
  overdueAmount:number;
  daysPastDue:number;
  insuranceStatus:LoanInsuranceStatus;
  insuranceProvider?:string;
  insurancePolicyReference?:string;
  insurancePremiumAmount:number;
  insuranceEndsAt?:string;
  collateralType:LoanCollateralType;
  collateralDescription?:string;
  collateralEstimatedValue:number;
  status:LoanStatus;
  privacy:RecordPrivacy;
}
export interface RecordLoanPaymentInput {
  loanId:string;
  paidAt:string;
  scheduledInstallmentSequence?:number;
  amount:number;
  principalAmount:number;
  interestAmount:number;
  lateFeeAmount:number;
  notes?:string;
}
export const FINANCE_PLANNING_ITEM_TYPES = [
  'category','cash_flow','budget','recurring_rule','recurring_state',
  'goal','goal_progress','asset','asset_valuation'
] as const;
export type FinancePlanningItemType = typeof FINANCE_PLANNING_ITEM_TYPES[number];
export const FINANCE_CATEGORY_KINDS = ['income','expense'] as const;
export type FinanceCategoryKind = typeof FINANCE_CATEGORY_KINDS[number];
export const FINANCE_CASH_FLOW_STATUSES = ['planned','realized'] as const;
export type FinanceCashFlowStatus = typeof FINANCE_CASH_FLOW_STATUSES[number];
export const FINANCE_RECURRING_FREQUENCIES = ['weekly','monthly','quarterly','yearly'] as const;
export type FinanceRecurringFrequency = typeof FINANCE_RECURRING_FREQUENCIES[number];
export const FINANCE_RECURRING_STATUSES = ['active','paused','ended'] as const;
export type FinanceRecurringStatus = typeof FINANCE_RECURRING_STATUSES[number];
export const FINANCE_GOAL_KINDS = [
  'savings','debt_reduction','investment','purchase','emergency_fund','other'
] as const;
export type FinanceGoalKind = typeof FINANCE_GOAL_KINDS[number];
export const FINANCE_ASSET_CLASSES = [
  'cash','deposit','precious_metal_fx','investment','pension','real_estate','vehicle'
] as const;
export type FinanceAssetClass = typeof FINANCE_ASSET_CLASSES[number];

interface FinancePlanningLedgerCommonView {
  id:string;
  ownerPersonId:string;
  privacy:RecordPrivacy;
  dataSource:'manual';
  externalVerification:'not_performed';
  createdAt:string;
}
export interface FinanceCategoryView extends FinancePlanningLedgerCommonView {
  itemType:'category';
  name:string;
  kind:FinanceCategoryKind;
}
export interface FinanceCashFlowEntryView extends FinancePlanningLedgerCommonView {
  itemType:'cash_flow';
  categoryId:string;
  direction:FinanceCategoryKind;
  amount:number;
  currency:string;
  occurredAt:string;
  status:FinanceCashFlowStatus;
  description?:string;
}
export interface FinanceBudgetRevisionView extends FinancePlanningLedgerCommonView {
  itemType:'budget';
  categoryId:string;
  periodMonth:string;
  plannedAmount:number;
  currency:string;
}
export interface FinanceRecurringRuleLedgerView extends FinancePlanningLedgerCommonView {
  itemType:'recurring_rule';
  categoryId:string;
  direction:FinanceCategoryKind;
  amount:number;
  currency:string;
  frequency:FinanceRecurringFrequency;
  intervalCount:number;
  startsAt:string;
  nextOccurrenceAt:string;
  endsAt?:string;
  initialStatus:FinanceRecurringStatus;
  description?:string;
}
export interface FinanceRecurringStateView extends FinancePlanningLedgerCommonView {
  itemType:'recurring_state';
  recurringRuleId:string;
  status:FinanceRecurringStatus;
  effectiveAt:string;
}
export interface FinanceGoalLedgerView extends FinancePlanningLedgerCommonView {
  itemType:'goal';
  title:string;
  kind:FinanceGoalKind;
  targetAmount:number;
  initialAmount:number;
  currency:string;
  dueAt?:string;
}
export interface FinanceGoalProgressView extends FinancePlanningLedgerCommonView {
  itemType:'goal_progress';
  goalId:string;
  currentAmount:number;
  recordedAt:string;
  note?:string;
}
export interface FinancePortfolioAssetLedgerView extends FinancePlanningLedgerCommonView {
  itemType:'asset';
  name:string;
  assetClass:FinanceAssetClass;
  currency:string;
  initialQuantity:number;
  initialUnitValue:number;
  initialMarketValue:number;
  initiallyValuedAt:string;
  note?:string;
}
export interface FinancePortfolioValuationView extends FinancePlanningLedgerCommonView {
  itemType:'asset_valuation';
  assetId:string;
  quantity:number;
  unitValue:number;
  marketValue:number;
  valuedAt:string;
  note?:string;
}
export type FinancePlanningLedgerItemView =
  | FinanceCategoryView
  | FinanceCashFlowEntryView
  | FinanceBudgetRevisionView
  | FinanceRecurringRuleLedgerView
  | FinanceRecurringStateView
  | FinanceGoalLedgerView
  | FinanceGoalProgressView
  | FinancePortfolioAssetLedgerView
  | FinancePortfolioValuationView;

export interface FinanceRecurringRuleView extends FinanceRecurringRuleLedgerView {
  currentStatus:FinanceRecurringStatus;
  stateHistory:readonly FinanceRecurringStateView[];
}
export interface FinanceGoalView extends FinanceGoalLedgerView {
  currentAmount:number;
  completionBasisPoints:number;
  achieved:boolean;
  progressHistory:readonly FinanceGoalProgressView[];
}
export interface FinancePortfolioAssetView extends FinancePortfolioAssetLedgerView {
  currentQuantity:number;
  currentUnitValue:number;
  currentMarketValue:number;
  currentValuedAt:string;
  valuationHistory:readonly FinancePortfolioValuationView[];
}
export interface FinanceCurrencySummaryView {
  currency:string;
  assetValue:number;
  liabilityValue:number;
  netWorth:number;
  debtRatioBasisPoints?:number;
  realizedIncome:number;
  realizedExpense:number;
  cashFlowBalance:number;
}
export interface FinancePlanningScopeSummaryView {
  scope:'family'|'person';
  ownerPersonId?:string;
  currencySummaries:readonly FinanceCurrencySummaryView[];
  crossCurrencyAggregationPerformed:false;
}
export interface FinanceBudgetVarianceView {
  budgetRevisionId:string;
  ownerPersonId:string;
  categoryId:string;
  categoryName:string;
  categoryKind:FinanceCategoryKind;
  periodMonth:string;
  currency:string;
  plannedAmount:number;
  realizedAmount:number;
  varianceAmount:number;
  overBudget:boolean;
  belowIncomeTarget:boolean;
}
export type FinanceUpcomingPaymentSource = 'payment_card'|'loan'|'finance_record'|'recurring_rule'|'planned_cash_flow';
export interface FinanceUpcomingPaymentView {
  id:string;
  ownerPersonId:string;
  source:FinanceUpcomingPaymentSource;
  title:string;
  dueAt:string;
  amount:number;
  currency:string;
  paymentExecution:'not_performed';
}
export interface FinancePlanningWorkspaceView {
  categories:readonly FinanceCategoryView[];
  cashFlowEntries:readonly FinanceCashFlowEntryView[];
  importedCashFlowEntries:readonly FinanceImportedCashFlowView[];
  importBatches:readonly FinanceImportBatchView[];
  budgetRevisions:readonly FinanceBudgetRevisionView[];
  budgetVariances:readonly FinanceBudgetVarianceView[];
  recurringRules:readonly FinanceRecurringRuleView[];
  goals:readonly FinanceGoalView[];
  portfolioAssets:readonly FinancePortfolioAssetView[];
  upcomingPayments:readonly FinanceUpcomingPaymentView[];
  familySummary:FinancePlanningScopeSummaryView;
  personSummaries:readonly FinancePlanningScopeSummaryView[];
  generatedAt:string;
  dataSource:'manual';
  externalPricing:'not_performed';
  bankSynchronization:'not_performed';
  paymentExecution:'not_performed';
  openBankingBoundary:FinanceOpenBankingBoundaryView;
}

export type RecordFinancePlanningItemInput =
  | { itemType:'category'; ownerPersonId:string; name:string; kind:FinanceCategoryKind; privacy:RecordPrivacy }
  | { itemType:'cash_flow'; categoryId:string; amount:number; currency:string; occurredAt:string; status:FinanceCashFlowStatus; description?:string }
  | { itemType:'budget'; categoryId:string; periodMonth:string; plannedAmount:number; currency:string }
  | { itemType:'recurring_rule'; categoryId:string; amount:number; currency:string; frequency:FinanceRecurringFrequency; intervalCount:number; startsAt:string; nextOccurrenceAt:string; endsAt?:string; description?:string }
  | { itemType:'recurring_state'; recurringRuleId:string; status:FinanceRecurringStatus; effectiveAt:string }
  | { itemType:'goal'; ownerPersonId:string; title:string; kind:FinanceGoalKind; targetAmount:number; initialAmount:number; currency:string; dueAt?:string; privacy:RecordPrivacy }
  | { itemType:'goal_progress'; goalId:string; currentAmount:number; recordedAt:string; note?:string }
  | { itemType:'asset'; ownerPersonId:string; name:string; assetClass:FinanceAssetClass; currency:string; quantity:number; unitValue:number; valuedAt:string; note?:string; privacy:RecordPrivacy }
  | { itemType:'asset_valuation'; assetId:string; quantity:number; unitValue:number; valuedAt:string; note?:string };

export const FINANCE_IMPORT_SOURCE_FORMATS = ['csv','tsv','xlsx','ofx','qfx','sandbox'] as const;
export type FinanceImportSourceFormat = typeof FINANCE_IMPORT_SOURCE_FORMATS[number];
export type FinanceImportSourceMode = 'controlled_file'|'sandbox';
export type FinanceImportDuplicateStrategy = 'skip'|'reject';
export type FinanceImportAmountMode = 'signed'|'absolute_with_direction'|'debit_credit_columns';

export interface FinanceImportColumnMappingInput {
  dateColumn:string;
  descriptionColumn?:string;
  amountColumn?:string;
  debitColumn?:string;
  creditColumn?:string;
  directionColumn?:string;
  currencyColumn?:string;
  externalIdColumn?:string;
  amountMode:FinanceImportAmountMode;
}

export interface FinanceImportPreviewRowView {
  rowNumber:number;
  values:readonly string[];
}

export interface FinanceImportPreviewView {
  previewId:string;
  fileName:string;
  sourceMode:FinanceImportSourceMode;
  sourceFormat:FinanceImportSourceFormat;
  fileSha256:string;
  headers:readonly string[];
  sampleRows:readonly FinanceImportPreviewRowView[];
  totalRows:number;
  expiresAt:string;
  warnings:readonly string[];
  rawFileRetained:false;
  filePathExposed:false;
  /** Parsed rows remain only in the main-process preview session until expiry/consume/clear. */
  parsedRowsRetainedUntilExpiry:true;
  /** A bounded sample of cell values is intentionally exposed to the trusted renderer for mapping. */
  sampleCellValuesExposed:true;
}

export interface SelectFinanceImportFileResult {
  canceled:boolean;
  preview?:FinanceImportPreviewView;
}

export interface CommitFinanceImportPreviewInput {
  previewId:string;
  ownerPersonId:string;
  privacy:RecordPrivacy;
  mapping:FinanceImportColumnMappingInput;
  defaultCurrency:string;
  incomeCategoryId?:string;
  expenseCategoryId?:string;
  duplicateStrategy:FinanceImportDuplicateStrategy;
}

export interface FinanceImportNormalizedRowInput {
  categoryId:string;
  direction:FinanceCategoryKind;
  amount:number;
  currency:string;
  occurredAt:string;
  description?:string;
  externalId?:string;
  sourceRowNumber:number;
  rowFingerprint:string;
}

export type FinanceImportPreparedRowInput = Omit<FinanceImportNormalizedRowInput, 'rowFingerprint'>;

export interface CommitFinanceImportPreparedBatchInput {
  ownerPersonId:string;
  privacy:RecordPrivacy;
  sourceMode:FinanceImportSourceMode;
  sourceFormat:FinanceImportSourceFormat;
  fileName:string;
  fileSha256:string;
  mapping:FinanceImportColumnMappingInput;
  defaultCurrency:string;
  duplicateStrategy:FinanceImportDuplicateStrategy;
  totalRows:number;
  rows:readonly FinanceImportPreparedRowInput[];
}

export interface CommitFinanceImportBatchInput {
  ownerPersonId:string;
  privacy:RecordPrivacy;
  sourceMode:FinanceImportSourceMode;
  sourceFormat:FinanceImportSourceFormat;
  fileName:string;
  fileSha256:string;
  mapping:FinanceImportColumnMappingInput;
  defaultCurrency:string;
  duplicateStrategy:FinanceImportDuplicateStrategy;
  totalRows:number;
  rows:readonly FinanceImportNormalizedRowInput[];
}

export interface FinanceImportBatchView {
  id:string;
  ownerPersonId:string;
  privacy:RecordPrivacy;
  sourceMode:FinanceImportSourceMode;
  sourceFormat:FinanceImportSourceFormat;
  fileName:string;
  fileSha256:string;
  mapping:FinanceImportColumnMappingInput;
  defaultCurrency:string;
  duplicateStrategy:FinanceImportDuplicateStrategy;
  totalRows:number;
  importedRows:number;
  duplicateRows:number;
  status:'committed';
  adapterContract:'ohvps-v1-local';
  networkAccess:'not_performed';
  credentialExchange:'not_performed';
  externalConsent:'not_performed';
  createdAt:string;
}

export interface FinanceImportedCashFlowView {
  id:string;
  batchId:string;
  ownerPersonId:string;
  categoryId:string;
  direction:FinanceCategoryKind;
  amount:number;
  currency:string;
  occurredAt:string;
  description?:string;
  externalId?:string;
  sourceRowNumber:number;
  rowFingerprint:string;
  privacy:RecordPrivacy;
  dataSource:'file_import'|'sandbox';
  externalVerification:'not_performed';
  createdAt:string;
}

export interface FinanceOpenBankingBoundaryView {
  adapterContract:'ohvps-v1-local';
  supportedModes:readonly ['sandbox','manual_fallback'];
  sandboxData:'synthetic_local';
  manualFallback:'controlled_file_import';
  liveBankConnection:'not_implemented';
  networkAccess:'not_performed';
  credentialCollection:'prohibited';
  externalConsent:'not_performed';
}
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

export const MANAGED_LIFE_CATEGORIES = [
  'insurance','subscription','education','employment','official_operation','home','vehicle'
] as const;
export type ManagedLifeCategory = typeof MANAGED_LIFE_CATEGORIES[number];

export const MANAGED_LIFE_REMINDER_KINDS = [
  'renewal','expiry','payment','term','contract_end','official_deadline',
  'rent','insurance','inspection','maintenance','other'
] as const;
export type ManagedLifeReminderKind = typeof MANAGED_LIFE_REMINDER_KINDS[number];

export const MANAGED_LIFE_ACTIVITY_KINDS = [
  'renewal','rent_payment','insurance_premium','inspection','maintenance',
  'service','fuel','charging','expense'
] as const;
export type ManagedLifeActivityKind = typeof MANAGED_LIFE_ACTIVITY_KINDS[number];

export const MANAGED_LIFE_DOCUMENT_KINDS = [
  'policy','contract','certificate','application_receipt','invoice','lease','deed',
  'dask_policy','home_insurance_policy','vehicle_registration','vehicle_insurance_policy',
  'inspection_report','service_receipt','fuel_receipt','charging_receipt','other'
] as const;
export type ManagedLifeDocumentKind = typeof MANAGED_LIFE_DOCUMENT_KINDS[number];

export interface ManagedLifeInsuranceDetails {
  readonly insuranceKind:'dask'|'home'|'vehicle_compulsory'|'vehicle_comprehensive'|'other';
  readonly provider:string;
}
export interface ManagedLifeSubscriptionDetails {
  readonly provider:string;
  readonly planName:string;
  readonly billingCycle:'monthly'|'quarterly'|'yearly'|'other';
}
export interface ManagedLifeEducationDetails {
  readonly institution:string;
  readonly program:string;
}
export interface ManagedLifeEmploymentDetails {
  readonly employer:string;
  readonly position:string;
}
export interface ManagedLifeOfficialOperationDetails {
  readonly authority:string;
  readonly operationType:string;
}
export interface ManagedLifeHomeDetails {
  readonly tenure:'owner'|'tenant';
  readonly propertyType:'residence'|'workplace'|'land'|'other';
  readonly addressLabel:string;
}
export interface ManagedLifeVehicleDetails {
  readonly vehicleType:'car'|'motorcycle'|'commercial'|'other';
  readonly energyType:'fuel'|'electric'|'hybrid'|'other';
  readonly plate?:string;
}

export interface ManagedLifeProfileDetailsByCategory {
  readonly insurance:ManagedLifeInsuranceDetails;
  readonly subscription:ManagedLifeSubscriptionDetails;
  readonly education:ManagedLifeEducationDetails;
  readonly employment:ManagedLifeEmploymentDetails;
  readonly official_operation:ManagedLifeOfficialOperationDetails;
  readonly home:ManagedLifeHomeDetails;
  readonly vehicle:ManagedLifeVehicleDetails;
}
export type ManagedLifeProfileDetails = ManagedLifeProfileDetailsByCategory[ManagedLifeCategory];

export type ManagedLifeReminderMutation =
  | { readonly action:'set'; readonly kind:ManagedLifeReminderKind; readonly dueAt:string }
  | { readonly action:'clear' };

export interface ManagedLifeLedgerItemCommonView {
  readonly id:string;
  readonly ownerPersonId:string;
  readonly privacy:RecordPrivacy;
  readonly dataSource:'manual';
  readonly externalVerification:'not_performed';
  readonly paymentExecution:'not_performed';
  readonly createdAt:string;
}

export type ManagedLifeProfileLedgerItemView = {
  readonly [K in ManagedLifeCategory]: ManagedLifeLedgerItemCommonView & {
    readonly itemType:'profile';
    readonly category:K;
    readonly title:string;
    readonly status:LifeRecordStatus;
    readonly details:ManagedLifeProfileDetailsByCategory[K];
    readonly startsAt?:string;
    readonly endsAt?:string;
    readonly initialReminder?:{
      readonly kind:ManagedLifeReminderKind;
      readonly dueAt:string;
    };
    readonly financeAssetId?:string;
  }
}[ManagedLifeCategory];

export interface ManagedLifeActivityLedgerItemView extends ManagedLifeLedgerItemCommonView {
  readonly itemType:'activity';
  readonly recordId:string;
  readonly activityKind:ManagedLifeActivityKind;
  readonly occurredAt:string;
  readonly provider?:string;
  readonly amountMinor?:number;
  readonly currency?:string;
  readonly quantityMilliunits?:number;
  readonly odometerKm?:number;
  readonly financeExpenseId?:string;
  readonly financePosting:'linked'|'not_performed';
  readonly reminderMutation?:ManagedLifeReminderMutation;
  readonly note?:string;
}

export interface ManagedLifeDocumentLedgerItemView extends ManagedLifeLedgerItemCommonView {
  readonly itemType:'document';
  readonly recordId:string;
  readonly archiveItemId:string;
  readonly documentKind:ManagedLifeDocumentKind;
  readonly label?:string;
}

export const MANAGED_HOME_INVENTORY_ITEM_TYPES = [
  'room','meter','meter_reading','belonging','warranty','service','document'
] as const;
export type ManagedHomeInventoryItemType = typeof MANAGED_HOME_INVENTORY_ITEM_TYPES[number];

export const MANAGED_HOME_ROOM_KINDS = [
  'living_room','bedroom','kitchen','bathroom','storage','garage','garden','other'
] as const;
export type ManagedHomeRoomKind = typeof MANAGED_HOME_ROOM_KINDS[number];

export const MANAGED_HOME_METER_KINDS = ['electricity','water','natural_gas','other'] as const;
export type ManagedHomeMeterKind = typeof MANAGED_HOME_METER_KINDS[number];
export const MANAGED_HOME_METER_READING_UNITS = [
  'wh','milliliter','milliliter_cubic_meter_equivalent','custom_milliunit'
] as const;
export type ManagedHomeMeterReadingUnit = typeof MANAGED_HOME_METER_READING_UNITS[number];
export const MANAGED_HOME_METER_READING_KINDS = ['reading','reset','replacement'] as const;
export type ManagedHomeMeterReadingKind = typeof MANAGED_HOME_METER_READING_KINDS[number];

export const MANAGED_HOME_BELONGING_KINDS = [
  'appliance','electronics','furniture','tool','other'
] as const;
export type ManagedHomeBelongingKind = typeof MANAGED_HOME_BELONGING_KINDS[number];
export const MANAGED_HOME_SERVICE_TARGET_TYPES = ['room','meter','belonging'] as const;
export type ManagedHomeServiceTargetType = typeof MANAGED_HOME_SERVICE_TARGET_TYPES[number];
export const MANAGED_HOME_SERVICE_KINDS = [
  'maintenance','repair','inspection','installation','other'
] as const;
export type ManagedHomeServiceKind = typeof MANAGED_HOME_SERVICE_KINDS[number];
export const MANAGED_HOME_DOCUMENT_TARGET_TYPES = ['meter','belonging','warranty','service'] as const;
export type ManagedHomeDocumentTargetType = typeof MANAGED_HOME_DOCUMENT_TARGET_TYPES[number];
export const MANAGED_HOME_DOCUMENT_KINDS = [
  'invoice','warranty','service_receipt','meter_document','other'
] as const;
export type ManagedHomeDocumentKind = typeof MANAGED_HOME_DOCUMENT_KINDS[number];

export interface ManagedHomeInventoryLedgerItemCommonView {
  readonly id:string;
  readonly recordId:string;
  readonly ownerPersonId:string;
  readonly privacy:RecordPrivacy;
  readonly supersedesItemId?:string;
  readonly dataSource:'manual';
  readonly externalVerification:'not_performed';
  readonly paymentExecution:'not_performed';
  readonly createdAt:string;
}

export interface ManagedHomeInventoryRoomLedgerItemView extends ManagedHomeInventoryLedgerItemCommonView {
  readonly itemType:'room';
  readonly name:string;
  readonly roomKind:ManagedHomeRoomKind;
}

export interface ManagedHomeInventoryMeterLedgerItemView extends ManagedHomeInventoryLedgerItemCommonView {
  readonly itemType:'meter';
  readonly roomId?:string;
  readonly label:string;
  readonly meterKind:ManagedHomeMeterKind;
  readonly readingUnit:ManagedHomeMeterReadingUnit;
}

export interface ManagedHomeInventoryMeterReadingLedgerItemView extends ManagedHomeInventoryLedgerItemCommonView {
  readonly itemType:'meter_reading';
  readonly meterId:string;
  readonly readingKind:ManagedHomeMeterReadingKind;
  readonly readingMilliunits:number;
  readonly recordedAt:string;
  readonly note?:string;
}

export interface ManagedHomeInventoryBelongingLedgerItemView extends ManagedHomeInventoryLedgerItemCommonView {
  readonly itemType:'belonging';
  readonly roomId?:string;
  readonly name:string;
  readonly belongingKind:ManagedHomeBelongingKind;
  readonly serialNumberMasked?:string;
  readonly purchasedAt?:string;
  readonly purchaseAmountMinor?:number;
  readonly currency?:string;
  readonly financeExpenseId?:string;
  readonly financePosting:'linked'|'not_performed';
}

export interface ManagedHomeInventoryWarrantyLedgerItemView extends ManagedHomeInventoryLedgerItemCommonView {
  readonly itemType:'warranty';
  readonly belongingId:string;
  readonly provider?:string;
  readonly startsAt:string;
  readonly endsAt:string;
  readonly reminderAt?:string;
  readonly note?:string;
}

export interface ManagedHomeInventoryServiceLedgerItemView extends ManagedHomeInventoryLedgerItemCommonView {
  readonly itemType:'service';
  readonly targetItemId:string;
  readonly targetType:ManagedHomeServiceTargetType;
  readonly serviceKind:ManagedHomeServiceKind;
  readonly occurredAt:string;
  readonly provider?:string;
  readonly amountMinor?:number;
  readonly currency?:string;
  readonly financeExpenseId?:string;
  readonly financePosting:'linked'|'not_performed';
  readonly note?:string;
}

export interface ManagedHomeInventoryDocumentLedgerItemView extends ManagedHomeInventoryLedgerItemCommonView {
  readonly itemType:'document';
  readonly targetItemId:string;
  readonly targetType:ManagedHomeDocumentTargetType;
  readonly archiveItemId:string;
  readonly documentKind:ManagedHomeDocumentKind;
  readonly label?:string;
}

export type ManagedHomeInventoryLedgerItemView =
  | ManagedHomeInventoryRoomLedgerItemView
  | ManagedHomeInventoryMeterLedgerItemView
  | ManagedHomeInventoryMeterReadingLedgerItemView
  | ManagedHomeInventoryBelongingLedgerItemView
  | ManagedHomeInventoryWarrantyLedgerItemView
  | ManagedHomeInventoryServiceLedgerItemView
  | ManagedHomeInventoryDocumentLedgerItemView;

export type ManagedLifeLedgerItemView =
  | ManagedLifeProfileLedgerItemView
  | ManagedLifeActivityLedgerItemView
  | ManagedLifeDocumentLedgerItemView;

interface RecordManagedLifeProfileInputCommon {
  readonly itemType:'profile';
  readonly ownerPersonId:string;
  readonly title:string;
  readonly status:LifeRecordStatus;
  readonly privacy:RecordPrivacy;
  readonly startsAt?:string;
  readonly endsAt?:string;
  readonly initialReminder?:{
    readonly kind:ManagedLifeReminderKind;
    readonly dueAt:string;
  };
  readonly financeAssetId?:string;
}

export type RecordManagedLifeProfileInput = {
  readonly [K in ManagedLifeCategory]: RecordManagedLifeProfileInputCommon & {
    readonly category:K;
    readonly details:ManagedLifeProfileDetailsByCategory[K];
  }
}[ManagedLifeCategory];

export interface RecordManagedLifeActivityInput {
  readonly itemType:'activity';
  readonly recordId:string;
  readonly activityKind:ManagedLifeActivityKind;
  readonly occurredAt:string;
  readonly provider?:string;
  readonly amountMinor?:number;
  readonly currency?:string;
  readonly quantityMilliunits?:number;
  readonly odometerKm?:number;
  readonly financeExpenseId?:string;
  readonly reminderMutation?:ManagedLifeReminderMutation;
  readonly note?:string;
}

export interface RecordManagedLifeDocumentInput {
  readonly itemType:'document';
  readonly recordId:string;
  readonly archiveItemId:string;
  readonly documentKind:ManagedLifeDocumentKind;
  readonly label?:string;
}

interface RecordManagedHomeInventoryItemInputCommon {
  readonly recordId:string;
  readonly supersedesItemId?:string;
}

export interface RecordManagedHomeInventoryRoomInput extends RecordManagedHomeInventoryItemInputCommon {
  readonly itemType:'room';
  readonly name:string;
  readonly roomKind:ManagedHomeRoomKind;
}

export interface RecordManagedHomeInventoryMeterInput extends RecordManagedHomeInventoryItemInputCommon {
  readonly itemType:'meter';
  readonly roomId?:string;
  readonly label:string;
  readonly meterKind:ManagedHomeMeterKind;
  readonly readingUnit:ManagedHomeMeterReadingUnit;
}

export interface RecordManagedHomeInventoryMeterReadingInput extends RecordManagedHomeInventoryItemInputCommon {
  readonly itemType:'meter_reading';
  readonly meterId:string;
  readonly readingKind:ManagedHomeMeterReadingKind;
  readonly readingMilliunits:number;
  readonly recordedAt:string;
  readonly note?:string;
}

export interface RecordManagedHomeInventoryBelongingInput extends RecordManagedHomeInventoryItemInputCommon {
  readonly itemType:'belonging';
  readonly roomId?:string;
  readonly name:string;
  readonly belongingKind:ManagedHomeBelongingKind;
  readonly serialNumber?:string;
  readonly purchasedAt?:string;
  readonly purchaseAmountMinor?:number;
  readonly currency?:string;
  readonly financeExpenseId?:string;
}

export interface RecordManagedHomeInventoryWarrantyInput extends RecordManagedHomeInventoryItemInputCommon {
  readonly itemType:'warranty';
  readonly belongingId:string;
  readonly provider?:string;
  readonly startsAt:string;
  readonly endsAt:string;
  readonly reminderAt?:string;
  readonly note?:string;
}

export interface RecordManagedHomeInventoryServiceInput extends RecordManagedHomeInventoryItemInputCommon {
  readonly itemType:'service';
  readonly targetItemId:string;
  readonly targetType:ManagedHomeServiceTargetType;
  readonly serviceKind:ManagedHomeServiceKind;
  readonly occurredAt:string;
  readonly provider?:string;
  readonly amountMinor?:number;
  readonly currency?:string;
  readonly financeExpenseId?:string;
  readonly note?:string;
}

export interface RecordManagedHomeInventoryDocumentInput extends RecordManagedHomeInventoryItemInputCommon {
  readonly itemType:'document';
  readonly targetItemId:string;
  readonly targetType:ManagedHomeDocumentTargetType;
  readonly archiveItemId:string;
  readonly documentKind:ManagedHomeDocumentKind;
  readonly label?:string;
}

export type RecordManagedHomeInventoryItemInput =
  | RecordManagedHomeInventoryRoomInput
  | RecordManagedHomeInventoryMeterInput
  | RecordManagedHomeInventoryMeterReadingInput
  | RecordManagedHomeInventoryBelongingInput
  | RecordManagedHomeInventoryWarrantyInput
  | RecordManagedHomeInventoryServiceInput
  | RecordManagedHomeInventoryDocumentInput;

export const FAMILY_EMERGENCY_ITEM_TYPES = [
  'emergency_plan','meeting_point','external_contact','checklist_item','checklist_status','member_status'
] as const;
export type FamilyEmergencyItemType = typeof FAMILY_EMERGENCY_ITEM_TYPES[number];
export const FAMILY_EMERGENCY_PLAN_KINDS = [
  'general','earthquake','fire','flood','evacuation','other'
] as const;
export type FamilyEmergencyPlanKind = typeof FAMILY_EMERGENCY_PLAN_KINDS[number];
export const FAMILY_EMERGENCY_MEETING_POINT_KINDS = ['primary','alternate'] as const;
export type FamilyEmergencyMeetingPointKind = typeof FAMILY_EMERGENCY_MEETING_POINT_KINDS[number];
export const FAMILY_EMERGENCY_CHECKLIST_STATUSES = ['open','completed'] as const;
export type FamilyEmergencyChecklistStatus = typeof FAMILY_EMERGENCY_CHECKLIST_STATUSES[number];
export const FAMILY_EMERGENCY_MEMBER_STATUSES = ['safe','needs_help'] as const;
export type FamilyEmergencyMemberStatus = typeof FAMILY_EMERGENCY_MEMBER_STATUSES[number];

export interface FamilyEmergencyLedgerItemCommonView {
  readonly id:string;
  readonly ownerPersonId:string;
  readonly privacy:'family';
  readonly dataSource:'manual';
  readonly createdAt:string;
}

export interface FamilyEmergencyPlanLedgerItemView extends FamilyEmergencyLedgerItemCommonView {
  readonly itemType:'emergency_plan';
  readonly planKind:FamilyEmergencyPlanKind;
  readonly title:string;
  readonly evacuationInstructions:string;
}

interface FamilyEmergencyChildLedgerItemCommonView extends FamilyEmergencyLedgerItemCommonView {
  readonly planId:string;
}

export interface FamilyEmergencyMeetingPointLedgerItemView extends FamilyEmergencyChildLedgerItemCommonView {
  readonly itemType:'meeting_point';
  readonly supersedesItemId?:string;
  readonly meetingPointKind:FamilyEmergencyMeetingPointKind;
  readonly label:string;
  readonly address?:string;
  readonly directions?:string;
}

export interface FamilyEmergencyExternalContactLedgerItemView extends FamilyEmergencyChildLedgerItemCommonView {
  readonly itemType:'external_contact';
  readonly supersedesItemId?:string;
  readonly name:string;
  readonly phoneE164:string;
  readonly city:string;
  readonly note?:string;
}

export interface FamilyEmergencyChecklistItemLedgerItemView extends FamilyEmergencyChildLedgerItemCommonView {
  readonly itemType:'checklist_item';
  readonly supersedesItemId?:string;
  readonly label:string;
  readonly sortOrder:number;
}

export interface FamilyEmergencyChecklistStatusLedgerItemView extends FamilyEmergencyChildLedgerItemCommonView {
  readonly itemType:'checklist_status';
  readonly checklistItemId:string;
  readonly status:FamilyEmergencyChecklistStatus;
}

export interface FamilyEmergencyMemberStatusLedgerItemView extends FamilyEmergencyChildLedgerItemCommonView {
  readonly itemType:'member_status';
  readonly memberPersonId:string;
  readonly reportedByPersonId:string;
  readonly status:FamilyEmergencyMemberStatus;
  readonly occurredAt:string;
  readonly note?:string;
}

export type FamilyEmergencyLedgerItemView =
  | FamilyEmergencyPlanLedgerItemView
  | FamilyEmergencyMeetingPointLedgerItemView
  | FamilyEmergencyExternalContactLedgerItemView
  | FamilyEmergencyChecklistItemLedgerItemView
  | FamilyEmergencyChecklistStatusLedgerItemView
  | FamilyEmergencyMemberStatusLedgerItemView;

export interface RecordFamilyEmergencyPlanInput {
  readonly itemType:'emergency_plan';
  readonly planKind:FamilyEmergencyPlanKind;
  readonly title:string;
  readonly evacuationInstructions:string;
}
export interface RecordFamilyEmergencyMeetingPointInput {
  readonly itemType:'meeting_point';
  readonly planId:string;
  readonly supersedesItemId?:string;
  readonly meetingPointKind:FamilyEmergencyMeetingPointKind;
  readonly label:string;
  readonly address?:string;
  readonly directions?:string;
}
export interface RecordFamilyEmergencyExternalContactInput {
  readonly itemType:'external_contact';
  readonly planId:string;
  readonly supersedesItemId?:string;
  readonly name:string;
  readonly phoneE164:string;
  readonly city:string;
  readonly note?:string;
}
export interface RecordFamilyEmergencyChecklistItemInput {
  readonly itemType:'checklist_item';
  readonly planId:string;
  readonly supersedesItemId?:string;
  readonly label:string;
  readonly sortOrder:number;
}
export interface RecordFamilyEmergencyChecklistStatusInput {
  readonly itemType:'checklist_status';
  readonly planId:string;
  readonly checklistItemId:string;
  readonly status:FamilyEmergencyChecklistStatus;
}
export interface RecordFamilyEmergencyMemberStatusInput {
  readonly itemType:'member_status';
  readonly planId:string;
  readonly memberPersonId:string;
  readonly status:FamilyEmergencyMemberStatus;
  readonly occurredAt:string;
  readonly note?:string;
}
export type RecordFamilyEmergencyItemInput =
  | RecordFamilyEmergencyPlanInput
  | RecordFamilyEmergencyMeetingPointInput
  | RecordFamilyEmergencyExternalContactInput
  | RecordFamilyEmergencyChecklistItemInput
  | RecordFamilyEmergencyChecklistStatusInput
  | RecordFamilyEmergencyMemberStatusInput;

export const FAMILY_EMERGENCY_PREPAREDNESS_ITEM_TYPES = [
  'preparedness_kit','preparedness_kit_item','preparedness_kit_check','emergency_drill'
] as const;
export type FamilyEmergencyPreparednessItemType = typeof FAMILY_EMERGENCY_PREPAREDNESS_ITEM_TYPES[number];
export const FAMILY_EMERGENCY_PREPAREDNESS_KIT_KINDS = [
  'household_72_hour','vehicle','workplace','other'
] as const;
export type FamilyEmergencyPreparednessKitKind = typeof FAMILY_EMERGENCY_PREPAREDNESS_KIT_KINDS[number];
export const FAMILY_EMERGENCY_PREPAREDNESS_KIT_ITEM_CATEGORIES = [
  'water','food','first_aid','hygiene','lighting_power','communication',
  'clothing_shelter','document_copy','tool','other'
] as const;
export type FamilyEmergencyPreparednessKitItemCategory =
  typeof FAMILY_EMERGENCY_PREPAREDNESS_KIT_ITEM_CATEGORIES[number];
export const FAMILY_EMERGENCY_PREPAREDNESS_QUANTITY_UNITS = [
  'item','liter','kilogram','dose','meter','other'
] as const;
export type FamilyEmergencyPreparednessQuantityUnit =
  typeof FAMILY_EMERGENCY_PREPAREDNESS_QUANTITY_UNITS[number];
export const FAMILY_EMERGENCY_PREPAREDNESS_CHECK_STATUSES = [
  'ready','low','missing','expired','replace'
] as const;
export type FamilyEmergencyPreparednessCheckStatus =
  typeof FAMILY_EMERGENCY_PREPAREDNESS_CHECK_STATUSES[number];
export const FAMILY_EMERGENCY_DRILL_KINDS = ['earthquake','fire','flood','power_outage'] as const;
export type FamilyEmergencyDrillKind = typeof FAMILY_EMERGENCY_DRILL_KINDS[number];
export const FAMILY_EMERGENCY_DRILL_STATUSES = ['completed','partial','cancelled'] as const;
export type FamilyEmergencyDrillStatus = typeof FAMILY_EMERGENCY_DRILL_STATUSES[number];

export interface FamilyEmergencyPreparednessLedgerItemCommonView {
  readonly id:string;
  readonly ownerPersonId:string;
  readonly planId:string;
  readonly privacy:'family';
  readonly dataSource:'manual';
  readonly createdAt:string;
}
export interface FamilyEmergencyPreparednessKitLedgerItemView
  extends FamilyEmergencyPreparednessLedgerItemCommonView {
  readonly itemType:'preparedness_kit';
  readonly supersedesItemId?:string;
  readonly kitKind:FamilyEmergencyPreparednessKitKind;
  readonly label:string;
}
export interface FamilyEmergencyPreparednessKitItemLedgerItemView
  extends FamilyEmergencyPreparednessLedgerItemCommonView {
  readonly itemType:'preparedness_kit_item';
  readonly kitId:string;
  readonly supersedesItemId?:string;
  readonly category:FamilyEmergencyPreparednessKitItemCategory;
  readonly label:string;
  readonly targetQuantityMilliunits:number;
  readonly quantityUnit:FamilyEmergencyPreparednessQuantityUnit;
  readonly expiresOn?:string;
}
export interface FamilyEmergencyPreparednessKitCheckLedgerItemView
  extends FamilyEmergencyPreparednessLedgerItemCommonView {
  readonly itemType:'preparedness_kit_check';
  readonly kitItemId:string;
  readonly status:FamilyEmergencyPreparednessCheckStatus;
  readonly actualQuantityMilliunits:number;
  readonly checkedAt:string;
  readonly note?:string;
}
export interface FamilyEmergencyDrillLedgerItemView
  extends FamilyEmergencyPreparednessLedgerItemCommonView {
  readonly itemType:'emergency_drill';
  readonly supersedesItemId?:string;
  readonly drillKind:FamilyEmergencyDrillKind;
  readonly status:FamilyEmergencyDrillStatus;
  readonly occurredAt:string;
  readonly durationSeconds?:number;
  readonly note?:string;
}
export type FamilyEmergencyPreparednessLedgerItemView =
  | FamilyEmergencyPreparednessKitLedgerItemView
  | FamilyEmergencyPreparednessKitItemLedgerItemView
  | FamilyEmergencyPreparednessKitCheckLedgerItemView
  | FamilyEmergencyDrillLedgerItemView;

export interface RecordFamilyEmergencyPreparednessKitInput {
  readonly itemType:'preparedness_kit';
  readonly planId:string;
  readonly supersedesItemId?:string;
  readonly kitKind:FamilyEmergencyPreparednessKitKind;
  readonly label:string;
}
export interface RecordFamilyEmergencyPreparednessKitItemInput {
  readonly itemType:'preparedness_kit_item';
  readonly planId:string;
  readonly kitId:string;
  readonly supersedesItemId?:string;
  readonly category:FamilyEmergencyPreparednessKitItemCategory;
  readonly label:string;
  readonly targetQuantityMilliunits:number;
  readonly quantityUnit:FamilyEmergencyPreparednessQuantityUnit;
  readonly expiresOn?:string;
}
export interface RecordFamilyEmergencyPreparednessKitCheckInput {
  readonly itemType:'preparedness_kit_check';
  readonly planId:string;
  readonly kitItemId:string;
  readonly status:FamilyEmergencyPreparednessCheckStatus;
  readonly actualQuantityMilliunits:number;
  readonly checkedAt:string;
  readonly note?:string;
}
export interface RecordFamilyEmergencyDrillInput {
  readonly itemType:'emergency_drill';
  readonly planId:string;
  readonly supersedesItemId?:string;
  readonly drillKind:FamilyEmergencyDrillKind;
  readonly status:FamilyEmergencyDrillStatus;
  readonly occurredAt:string;
  readonly durationSeconds?:number;
  readonly note?:string;
}
export type RecordFamilyEmergencyPreparednessItemInput =
  | RecordFamilyEmergencyPreparednessKitInput
  | RecordFamilyEmergencyPreparednessKitItemInput
  | RecordFamilyEmergencyPreparednessKitCheckInput
  | RecordFamilyEmergencyDrillInput;

export const FAMILY_EMERGENCY_ASSISTANCE_ITEM_TYPES = [
  'emergency_profile','health_fact','emergency_contact','assistance_instruction'
] as const;
export type FamilyEmergencyAssistanceItemType = typeof FAMILY_EMERGENCY_ASSISTANCE_ITEM_TYPES[number];
export const FAMILY_EMERGENCY_ASSISTANCE_SUBJECT_KINDS = ['person','pet'] as const;
export type FamilyEmergencyAssistanceSubjectKind = typeof FAMILY_EMERGENCY_ASSISTANCE_SUBJECT_KINDS[number];
export const FAMILY_EMERGENCY_HEALTH_FACT_KINDS = [
  'blood_type','allergy','chronic_condition','medication','medical_device','other'
] as const;
export type FamilyEmergencyHealthFactKind = typeof FAMILY_EMERGENCY_HEALTH_FACT_KINDS[number];
export const FAMILY_EMERGENCY_BLOOD_TYPES = [
  'a_positive','a_negative','b_positive','b_negative','ab_positive','ab_negative',
  'o_positive','o_negative','unknown'
] as const;
export type FamilyEmergencyBloodType = typeof FAMILY_EMERGENCY_BLOOD_TYPES[number];
export const FAMILY_EMERGENCY_ASSISTANCE_INSTRUCTION_KINDS = [
  'mobility','vision','hearing','communication','cognitive','medication_support',
  'evacuation','pet_care','other'
] as const;
export type FamilyEmergencyAssistanceInstructionKind =
  typeof FAMILY_EMERGENCY_ASSISTANCE_INSTRUCTION_KINDS[number];

export interface FamilyEmergencyAssistanceLedgerItemCommonView {
  readonly id:string;
  readonly planId:string;
  readonly ownerPersonId:string;
  readonly privacy:'private';
  readonly dataSource:'manual';
  readonly createdAt:string;
}
interface FamilyEmergencyAssistanceProfileLedgerItemCommonView
  extends FamilyEmergencyAssistanceLedgerItemCommonView {
  readonly itemType:'emergency_profile';
  readonly label:string;
}
export type FamilyEmergencyAssistanceProfileLedgerItemView =
  | (FamilyEmergencyAssistanceProfileLedgerItemCommonView & {
      readonly subjectKind:'person';
      readonly subjectPersonId:string;
    })
  | (FamilyEmergencyAssistanceProfileLedgerItemCommonView & {
      readonly subjectKind:'pet';
      readonly subjectPetId:string;
      readonly responsiblePersonId:string;
    });
interface FamilyEmergencyAssistanceChildLedgerItemCommonView
  extends FamilyEmergencyAssistanceLedgerItemCommonView {
  readonly profileId:string;
  readonly supersedesItemId?:string;
}
export type FamilyEmergencyHealthFactLedgerItemView =
  | (FamilyEmergencyAssistanceChildLedgerItemCommonView & {
      readonly itemType:'health_fact';
      readonly factKind:'blood_type';
      readonly bloodType:FamilyEmergencyBloodType;
      readonly note?:string;
    })
  | (FamilyEmergencyAssistanceChildLedgerItemCommonView & {
      readonly itemType:'health_fact';
      readonly factKind:Exclude<FamilyEmergencyHealthFactKind, 'blood_type'>;
      readonly value:string;
      readonly note?:string;
    });
export interface FamilyEmergencyContactLedgerItemView
  extends FamilyEmergencyAssistanceChildLedgerItemCommonView {
  readonly itemType:'emergency_contact';
  readonly name:string;
  readonly phoneE164:string;
  readonly relationship?:string;
  readonly note?:string;
}
export interface FamilyEmergencyAssistanceInstructionLedgerItemView
  extends FamilyEmergencyAssistanceChildLedgerItemCommonView {
  readonly itemType:'assistance_instruction';
  readonly instructionKind:FamilyEmergencyAssistanceInstructionKind;
  readonly instruction:string;
  readonly note?:string;
}
export type FamilyEmergencyAssistanceLedgerItemView =
  | FamilyEmergencyAssistanceProfileLedgerItemView
  | FamilyEmergencyHealthFactLedgerItemView
  | FamilyEmergencyContactLedgerItemView
  | FamilyEmergencyAssistanceInstructionLedgerItemView;

interface RecordFamilyEmergencyAssistanceProfileCommonInput {
  readonly itemType:'emergency_profile';
  readonly planId:string;
  readonly label:string;
}
export type RecordFamilyEmergencyAssistanceProfileInput =
  | (RecordFamilyEmergencyAssistanceProfileCommonInput & {
      readonly subjectKind:'person';
      readonly subjectPersonId:string;
    })
  | (RecordFamilyEmergencyAssistanceProfileCommonInput & {
      readonly subjectKind:'pet';
      readonly subjectPetId:string;
      readonly responsiblePersonId:string;
    });
interface RecordFamilyEmergencyAssistanceChildCommonInput {
  readonly profileId:string;
  readonly supersedesItemId?:string;
}
export type RecordFamilyEmergencyHealthFactInput =
  | (RecordFamilyEmergencyAssistanceChildCommonInput & {
      readonly itemType:'health_fact';
      readonly factKind:'blood_type';
      readonly bloodType:FamilyEmergencyBloodType;
      readonly note?:string;
    })
  | (RecordFamilyEmergencyAssistanceChildCommonInput & {
      readonly itemType:'health_fact';
      readonly factKind:Exclude<FamilyEmergencyHealthFactKind, 'blood_type'>;
      readonly value:string;
      readonly note?:string;
    });
export interface RecordFamilyEmergencyContactInput extends RecordFamilyEmergencyAssistanceChildCommonInput {
  readonly itemType:'emergency_contact';
  readonly name:string;
  readonly phoneE164:string;
  readonly relationship?:string;
  readonly note?:string;
}
export interface RecordFamilyEmergencyAssistanceInstructionInput
  extends RecordFamilyEmergencyAssistanceChildCommonInput {
  readonly itemType:'assistance_instruction';
  readonly instructionKind:FamilyEmergencyAssistanceInstructionKind;
  readonly instruction:string;
  readonly note?:string;
}
export type RecordFamilyEmergencyAssistanceItemInput =
  | RecordFamilyEmergencyAssistanceProfileInput
  | RecordFamilyEmergencyHealthFactInput
  | RecordFamilyEmergencyContactInput
  | RecordFamilyEmergencyAssistanceInstructionInput;

export const FAMILY_EMERGENCY_CARD_PORTABILITY_ITEM_TYPES = [
  'card_configuration','selected_field','document_link','export_event','power_mode_event'
] as const;
export type FamilyEmergencyCardPortabilityItemType =
  typeof FAMILY_EMERGENCY_CARD_PORTABILITY_ITEM_TYPES[number];
export const FAMILY_EMERGENCY_CARD_OUTPUT_MODES = ['print','pdf','encrypted_pack'] as const;
export type FamilyEmergencyCardOutputMode = typeof FAMILY_EMERGENCY_CARD_OUTPUT_MODES[number];
export const FAMILY_EMERGENCY_CARD_SOURCE_ITEM_TYPES = [
  'emergency_profile','health_fact','emergency_contact','assistance_instruction'
] as const;
export type FamilyEmergencyCardSourceItemType =
  typeof FAMILY_EMERGENCY_CARD_SOURCE_ITEM_TYPES[number];
export const FAMILY_EMERGENCY_CARD_FIELD_CODES = [
  'fact_value','instruction','instruction_kind','label','name','note','phone_e164',
  'relationship','subject_display'
] as const;
export type FamilyEmergencyCardFieldCode = typeof FAMILY_EMERGENCY_CARD_FIELD_CODES[number];
export const FAMILY_EMERGENCY_CARD_POWER_SOURCES = ['battery','ac','unknown'] as const;
export type FamilyEmergencyCardPowerSource = typeof FAMILY_EMERGENCY_CARD_POWER_SOURCES[number];
export const FAMILY_EMERGENCY_CARD_POWER_MODES = ['enabled','disabled'] as const;
export type FamilyEmergencyCardPowerMode = typeof FAMILY_EMERGENCY_CARD_POWER_MODES[number];
export const FAMILY_EMERGENCY_CARD_POWER_ACTIVATION_SOURCES = ['manual','battery_prompt'] as const;
export type FamilyEmergencyCardPowerActivationSource =
  typeof FAMILY_EMERGENCY_CARD_POWER_ACTIVATION_SOURCES[number];

export const FAMILY_EMERGENCY_CARD_FIELD_MATRIX = Object.freeze({
  emergency_profile: Object.freeze(['label','subject_display'] as const),
  health_fact: Object.freeze(['fact_value','note'] as const),
  emergency_contact: Object.freeze(['name','phone_e164','relationship','note'] as const),
  assistance_instruction: Object.freeze(['instruction_kind','instruction','note'] as const)
} satisfies Readonly<Record<FamilyEmergencyCardSourceItemType, readonly FamilyEmergencyCardFieldCode[]>>);

export interface FamilyEmergencyCardPortabilityLedgerItemCommonView {
  readonly id:string;
  readonly profileId:string;
  readonly ownerPersonId:string;
  readonly privacy:'private';
  readonly dataSource:'manual';
  readonly createdAt:string;
}
export interface FamilyEmergencyCardConfigurationLedgerItemView
  extends FamilyEmergencyCardPortabilityLedgerItemCommonView {
  readonly itemType:'card_configuration';
  readonly label:string;
  readonly locale:'tr-TR';
}
export interface FamilyEmergencyCardSelectedFieldLedgerItemView
  extends FamilyEmergencyCardPortabilityLedgerItemCommonView {
  readonly itemType:'selected_field';
  readonly configurationId:string;
  readonly sourceItemId:string;
  readonly sourceItemType:FamilyEmergencyCardSourceItemType;
  readonly fieldCode:FamilyEmergencyCardFieldCode;
}
export interface FamilyEmergencyCardDocumentLinkLedgerItemView
  extends FamilyEmergencyCardPortabilityLedgerItemCommonView {
  readonly itemType:'document_link';
  readonly configurationId:string;
  readonly archiveItemId:string;
}
interface FamilyEmergencyCardExportEventLedgerItemCommonView
  extends FamilyEmergencyCardPortabilityLedgerItemCommonView {
  readonly itemType:'export_event';
  readonly configurationId:string;
  readonly selectedFieldCount:number;
  readonly documentCount:number;
  readonly selectionSha256:string;
  readonly artifactSha256:string;
  readonly artifactSizeBytes:number;
  readonly powerSource:FamilyEmergencyCardPowerSource;
  readonly batteryLevel:'not_measured';
  readonly automaticLowBatteryDetection:'not_performed';
  readonly lowBatteryClaimed:false;
}
export type FamilyEmergencyCardExportEventLedgerItemView =
  | (FamilyEmergencyCardExportEventLedgerItemCommonView & {
      readonly mode:'print';
      readonly artifactReadbackStatus:'not_applicable_print';
      readonly printerDispatchStatus:'confirmed';
    })
  | (FamilyEmergencyCardExportEventLedgerItemCommonView & {
      readonly mode:'pdf'|'encrypted_pack';
      readonly artifactReadbackStatus:'verified';
    });
export interface FamilyEmergencyCardPowerModeEventLedgerItemView
  extends FamilyEmergencyCardPortabilityLedgerItemCommonView {
  readonly itemType:'power_mode_event';
  readonly configurationId:string;
  readonly mode:FamilyEmergencyCardPowerMode;
  readonly activationSource:FamilyEmergencyCardPowerActivationSource;
  readonly powerSource:FamilyEmergencyCardPowerSource;
  readonly batteryLevel:'not_measured';
  readonly automaticLowBatteryDetection:'not_performed';
  readonly lowBatteryClaimed:false;
}
export type FamilyEmergencyCardPortabilityLedgerItemView =
  | FamilyEmergencyCardConfigurationLedgerItemView
  | FamilyEmergencyCardSelectedFieldLedgerItemView
  | FamilyEmergencyCardDocumentLinkLedgerItemView
  | FamilyEmergencyCardExportEventLedgerItemView
  | FamilyEmergencyCardPowerModeEventLedgerItemView;

export interface RecordFamilyEmergencyCardConfigurationInput {
  readonly itemType:'card_configuration';
  readonly profileId:string;
  readonly label:string;
  readonly locale:'tr-TR';
}
export interface RecordFamilyEmergencyCardSelectedFieldInput {
  readonly itemType:'selected_field';
  readonly profileId:string;
  readonly configurationId:string;
  readonly sourceItemId:string;
  readonly sourceItemType:FamilyEmergencyCardSourceItemType;
  readonly fieldCode:FamilyEmergencyCardFieldCode;
}
export interface RecordFamilyEmergencyCardDocumentLinkInput {
  readonly itemType:'document_link';
  readonly profileId:string;
  readonly configurationId:string;
  readonly archiveItemId:string;
}
interface RecordFamilyEmergencyCardExportEventCommonInput {
  readonly itemType:'export_event';
  readonly profileId:string;
  readonly configurationId:string;
  readonly selectedFieldCount:number;
  readonly documentCount:number;
  readonly selectionSha256:string;
  readonly shareReceiptHash:string;
  readonly artifactSha256:string;
  readonly artifactSizeBytes:number;
  readonly powerSource:FamilyEmergencyCardPowerSource;
  readonly batteryLevel:'not_measured';
  readonly automaticLowBatteryDetection:'not_performed';
  readonly lowBatteryClaimed:false;
}
export type RecordFamilyEmergencyCardExportEventInput =
  | (RecordFamilyEmergencyCardExportEventCommonInput & {
      readonly mode:'print';
      readonly artifactReadbackStatus:'not_applicable_print';
      readonly printerDispatchStatus:'confirmed';
    })
  | (RecordFamilyEmergencyCardExportEventCommonInput & {
      readonly mode:'pdf'|'encrypted_pack';
      readonly artifactReadbackStatus:'verified';
    });
export interface RecordFamilyEmergencyCardPowerModeEventInput {
  readonly itemType:'power_mode_event';
  readonly profileId:string;
  readonly configurationId:string;
  readonly mode:FamilyEmergencyCardPowerMode;
  readonly activationSource:FamilyEmergencyCardPowerActivationSource;
  readonly powerSource:FamilyEmergencyCardPowerSource;
  readonly batteryLevel:'not_measured';
  readonly automaticLowBatteryDetection:'not_performed';
  readonly lowBatteryClaimed:false;
}
export type RecordFamilyEmergencyCardPortabilityItemInput =
  | RecordFamilyEmergencyCardConfigurationInput
  | RecordFamilyEmergencyCardSelectedFieldInput
  | RecordFamilyEmergencyCardDocumentLinkInput
  | RecordFamilyEmergencyCardExportEventInput
  | RecordFamilyEmergencyCardPowerModeEventInput;

export type RecordManagedLifeItemInput =
  | RecordManagedLifeProfileInput
  | RecordManagedLifeActivityInput
  | RecordManagedLifeDocumentInput
  | RecordManagedHomeInventoryItemInput
  | RecordFamilyEmergencyItemInput
  | RecordFamilyEmergencyPreparednessItemInput
  | RecordFamilyEmergencyAssistanceItemInput
  | RecordFamilyEmergencyCardPortabilityItemInput;

export interface ManagedLifeCurrentReminderView {
  readonly sourceId:string;
  readonly recordId:string;
  readonly ownerPersonId:string;
  readonly category:ManagedLifeCategory;
  readonly title:string;
  readonly kind:ManagedLifeReminderKind;
  readonly dueAt:string;
}

export type ManagedLifeProfileView = ManagedLifeProfileLedgerItemView & {
  readonly activities:readonly ManagedLifeActivityLedgerItemView[];
  readonly documents:readonly ManagedLifeDocumentLedgerItemView[];
  readonly currentReminder?:ManagedLifeCurrentReminderView;
};

export type FamilyEmergencyChecklistItemView = FamilyEmergencyChecklistItemLedgerItemView & {
  readonly latestStatus?:FamilyEmergencyChecklistStatusLedgerItemView;
};

export type FamilyEmergencyPreparednessKitItemView = FamilyEmergencyPreparednessKitItemLedgerItemView & {
  readonly latestCheck?:FamilyEmergencyPreparednessKitCheckLedgerItemView;
};

export type FamilyEmergencyPreparednessKitView = FamilyEmergencyPreparednessKitLedgerItemView & {
  readonly items:readonly FamilyEmergencyPreparednessKitItemView[];
};

export type FamilyEmergencyPlanView = FamilyEmergencyPlanLedgerItemView & {
  readonly meetingPoints:readonly FamilyEmergencyMeetingPointLedgerItemView[];
  readonly externalContacts:readonly FamilyEmergencyExternalContactLedgerItemView[];
  readonly checklistItems:readonly FamilyEmergencyChecklistItemView[];
  readonly latestMemberStatuses:readonly FamilyEmergencyMemberStatusLedgerItemView[];
  readonly preparednessKits:readonly FamilyEmergencyPreparednessKitView[];
  readonly emergencyDrills:readonly FamilyEmergencyDrillLedgerItemView[];
};

export type FamilyEmergencyAssistanceProfileView = FamilyEmergencyAssistanceProfileLedgerItemView & {
  readonly healthFacts:readonly FamilyEmergencyHealthFactLedgerItemView[];
  readonly emergencyContacts:readonly FamilyEmergencyContactLedgerItemView[];
  readonly assistanceInstructions:readonly FamilyEmergencyAssistanceInstructionLedgerItemView[];
  readonly cardConfigurations:readonly FamilyEmergencyCardConfigurationView[];
};

export type FamilyEmergencyCardConfigurationView = FamilyEmergencyCardConfigurationLedgerItemView & {
  readonly selectedFields:readonly FamilyEmergencyCardSelectedFieldLedgerItemView[];
  readonly documentLinks:readonly FamilyEmergencyCardDocumentLinkLedgerItemView[];
  readonly exportEvents:readonly FamilyEmergencyCardExportEventLedgerItemView[];
  readonly latestPowerModeEvent?:FamilyEmergencyCardPowerModeEventLedgerItemView;
};

export interface ManagedLifeWorkspaceView {
  readonly profiles:readonly ManagedLifeProfileView[];
  readonly homeInventoryItems:readonly ManagedHomeInventoryLedgerItemView[];
  readonly emergencyPlans:readonly FamilyEmergencyPlanView[];
  readonly emergencyAssistanceProfiles:readonly FamilyEmergencyAssistanceProfileView[];
  readonly upcomingReminders:readonly ManagedLifeCurrentReminderView[];
  readonly generatedAt:string;
  readonly dataSource:'manual';
  readonly externalRegistryLookup:'not_performed';
  readonly smartMeterLookup:'not_performed';
  readonly providerContact:'not_performed';
  readonly warrantyLookup:'not_performed';
  readonly ocr:'not_performed';
  readonly paymentExecution:'not_performed';
  readonly documentContentExposure:'not_performed';
  readonly offlineAvailability:'local_only';
  readonly mapLookup:'not_performed';
  readonly liveLocation:'not_performed';
  readonly messageDelivery:'not_performed';
  readonly emergencyServiceContact:'not_performed';
  readonly emergencyServiceGuarantee:'not_claimed';
  readonly barcodeLookup:'not_performed';
  readonly expiryVerification:'not_performed';
  readonly notificationDelivery:'not_performed';
  readonly sensorIntegration:'not_performed';
  readonly readinessGuarantee:'not_claimed';
  readonly medicalVerification:'not_performed';
  readonly healthRegistryLookup:'not_performed';
  readonly externalDelivery:'not_performed';
  readonly localExport:'user_authorized_only';
  readonly cloudUpload:'not_performed';
  readonly pdfEncryption:'not_claimed';
  readonly portablePackEncryption:'application_specific_container';
  readonly plaintextTemporaryFiles:'not_created';
  readonly batteryLevel:'not_measured';
  readonly automaticLowBatteryDetection:'not_performed';
  readonly lowBatteryClaimed:false;
  readonly networkEgressAdded:false;
}


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
export const AI_CONSENT_PURPOSES = ['search','summary','recommendation','classification'] as const;
export type AiConsentPurpose = typeof AI_CONSENT_PURPOSES[number];
export type SensitiveDataConsentPurpose = 'sensitive_processing'|'external_export';
export type StoredAiConsentPurpose = AiConsentPurpose|SensitiveDataConsentPurpose;
export interface AiConsentView { id:string; accountId:string; purpose:StoredAiConsentPurpose; resourceType:string; resourceId:string; status:'granted'|'revoked'; startsAt:string; endsAt?:string; createdAt:string; }
export interface UpsertAiConsentInput { purpose:AiConsentPurpose; resourceType:string; resourceId:string; status:'granted'|'revoked'; startsAt?:string; endsAt?:string; }
export interface AiAccessPreviewView { purpose:AiConsentPurpose; allowedResources:Array<{resourceType:string;resourceId:string;title:string}>; blockedCount:number; generatedAt:string; }

export const SENSITIVE_DATA_CATEGORIES = ['child','health','finance','location'] as const;
export type SensitiveDataCategory = typeof SENSITIVE_DATA_CATEGORIES[number];
export type SensitiveDataConsentEffectiveStatus = 'default_denied'|'granted'|'revoked'|'expired'|'scheduled';
export interface SensitiveDataPurposeConsentView {
  purpose:SensitiveDataConsentPurpose;
  effectiveStatus:SensitiveDataConsentEffectiveStatus;
  visibleSharing:boolean;
  startsAt?:string;
  endsAt?:string;
  consentId?:string;
}
export interface SensitiveDataProfileView {
  category:SensitiveDataCategory;
  label:string;
  description:string;
  defaultDenied:true;
  aiProcessing:SensitiveDataPurposeConsentView;
  externalExport:SensitiveDataPurposeConsentView;
}
export interface UpsertSensitiveDataConsentInput {
  category:SensitiveDataCategory;
  purpose:SensitiveDataConsentPurpose;
  status:'granted'|'revoked';
  durationMinutes?:number;
  explicitConsent:boolean;
}
export interface SensitiveExportPreviewInput {
  categories:SensitiveDataCategory[];
  destinationLabel:string;
  businessPurpose:string;
}
export interface SensitiveExportPreviewCategoryView {
  category:SensitiveDataCategory;
  label:string;
  effectiveStatus:SensitiveDataConsentEffectiveStatus;
  approved:boolean;
  recordCount:number;
  fieldNames:string[];
  consentEndsAt?:string;
}
export interface SensitiveExportPreviewView {
  previewId:string;
  destinationLabel:string;
  businessPurpose:string;
  categories:SensitiveExportPreviewCategoryView[];
  totalRecordCount:number;
  allApproved:boolean;
  transferAllowed:boolean;
  outboundTransferPerformed:false;
  generatedAt:string;
  warning:string;
}


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

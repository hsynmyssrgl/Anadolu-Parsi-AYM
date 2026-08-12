import {
  BANK_ACCOUNT_INPUT_KEYS,
  FINANCE_RECORD_INPUT_KEYS,
  FINANCE_VALUATION_INPUT_KEYS,
  containsLikelyFullPan,
  isProhibitedBankingSecretField
} from '@ppt/application';

export interface IpcIntegrationPolicyDecision {
  readonly accepted: boolean;
  readonly reason?: string;
  readonly path?: string;
}

const accepted = (): IpcIntegrationPolicyDecision => ({ accepted: true });
const rejected = (reason: string, path = '$'): IpcIntegrationPolicyDecision => ({ accepted: false, reason, path });
const isObject = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
const hasOnlyKeys = (value: Record<string, unknown>, keys: readonly string[]): boolean => {
  const allowed = new Set(keys);
  return Object.keys(value).every((key) => allowed.has(key));
};
const boundedString = (value: unknown, maximum: number, allowEmpty = false): boolean =>
  typeof value === 'string' && value.length <= maximum && (allowEmpty || value.trim().length > 0);
const optionalBoundedString = (value: unknown, maximum: number): boolean => value === undefined || boundedString(value, maximum, true);
const optionalInteger = (value: unknown, minimum: number, maximum: number): boolean =>
  value === undefined || (typeof value === 'number' && Number.isInteger(value) && value >= minimum && value <= maximum);
const optionalArgument = (args: readonly unknown[]): unknown => args.length === 0 ? undefined : args[0];

const exactObject = (
  args: readonly unknown[],
  keys: readonly string[],
  validate: (value: Record<string, unknown>) => boolean
): IpcIntegrationPolicyDecision => {
  if (args.length !== 1) return rejected('ARGUMENT_COUNT_MISMATCH');
  const value = args[0];
  if (!isObject(value)) return rejected('OBJECT_ARGUMENT_REQUIRED', '$[0]');
  if (!hasOnlyKeys(value, keys)) return rejected('UNKNOWN_OBJECT_FIELD', '$[0]');
  return validate(value) ? accepted() : rejected('OBJECT_ARGUMENT_INVALID', '$[0]');
};

const zeroArguments = (args: readonly unknown[]): IpcIntegrationPolicyDecision =>
  args.length === 0 ? accepted() : rejected('ARGUMENT_COUNT_MISMATCH');

const optionalIdentifier = (args: readonly unknown[]): IpcIntegrationPolicyDecision => {
  if (args.length > 1) return rejected('ARGUMENT_COUNT_MISMATCH');
  const value = optionalArgument(args);
  return value === undefined || boundedString(value, 128) ? accepted() : rejected('IDENTIFIER_INVALID', '$[0]');
};

const optionalLimit = (args: readonly unknown[], maximum = 500): IpcIntegrationPolicyDecision => {
  if (args.length > 1) return rejected('ARGUMENT_COUNT_MISMATCH');
  const value = optionalArgument(args);
  return optionalInteger(value, 1, maximum) ? accepted() : rejected('LIMIT_INVALID', '$[0]');
};

const pageInput = (args: readonly unknown[], kind: 'tree' | 'timeline' | 'archive'): IpcIntegrationPolicyDecision => {
  if (args.length > 1) return rejected('ARGUMENT_COUNT_MISMATCH');
  const value = optionalArgument(args);
  if (value === undefined) return accepted();
  if (!isObject(value)) return rejected('OBJECT_ARGUMENT_REQUIRED', '$[0]');
  const common = ['cursor', 'limit', 'query'];
  const keys = kind === 'tree'
    ? [...common, 'branch', 'generation']
    : kind === 'timeline'
      ? [...common, 'personId', 'kind', 'year']
      : [...common, 'categoryId', 'sensitivity', 'tag', 'mimeType', 'linkedEventId'];
  if (!hasOnlyKeys(value, keys)) return rejected('UNKNOWN_OBJECT_FIELD', '$[0]');
  if (!optionalBoundedString(value.cursor, 512) || !optionalInteger(value.limit, 20, 200) || !optionalBoundedString(value.query, 120)) return rejected('PAGE_ARGUMENT_INVALID', '$[0]');
  if (kind === 'tree') {
    if (!optionalBoundedString(value.branch, 160) || !optionalInteger(value.generation, 1, 20)) return rejected('PAGE_ARGUMENT_INVALID', '$[0]');
  } else if (kind === 'timeline') {
    if (!optionalBoundedString(value.personId, 128) || !optionalBoundedString(value.kind, 64) || !optionalInteger(value.year, 1000, 9999)) return rejected('PAGE_ARGUMENT_INVALID', '$[0]');
  } else if (!optionalBoundedString(value.categoryId, 128) || !optionalBoundedString(value.sensitivity, 16) || !optionalBoundedString(value.tag, 80) || !optionalBoundedString(value.mimeType, 120) || !optionalBoundedString(value.linkedEventId, 128)) {
    return rejected('PAGE_ARGUMENT_INVALID', '$[0]');
  }
  return accepted();
};


const catalogPageInput = (args: readonly unknown[], kind: 'person' | 'event'): IpcIntegrationPolicyDecision => {
  if (args.length > 1) return rejected('ARGUMENT_COUNT_MISMATCH');
  const value = optionalArgument(args);
  if (value === undefined) return accepted();
  if (!isObject(value)) return rejected('OBJECT_ARGUMENT_REQUIRED', '$[0]');
  const keys = kind === 'person' ? ['cursor', 'limit', 'query'] : ['cursor', 'limit', 'query', 'personId', 'kind', 'archiveMode'];
  if (!hasOnlyKeys(value, keys)) return rejected('UNKNOWN_OBJECT_FIELD', '$[0]');
  if (!optionalBoundedString(value.cursor, 512) || !optionalInteger(value.limit, 10, 100) || !optionalBoundedString(value.query, 120)) return rejected('CATALOG_ARGUMENT_INVALID', '$[0]');
  if (kind === 'event') {
    if (!optionalBoundedString(value.personId, 128) || !optionalBoundedString(value.kind, 64)) return rejected('CATALOG_ARGUMENT_INVALID', '$[0]');
    if (value.archiveMode !== undefined && !['active', 'archived', 'all'].includes(String(value.archiveMode))) return rejected('CATALOG_ARGUMENT_INVALID', '$[0]');
  }
  return accepted();
};

const catalogLookupInput = (args: readonly unknown[]): IpcIntegrationPolicyDecision => exactObject(args, ['personIds', 'eventIds'], (value) => {
  const validIds = (candidate: unknown): boolean => candidate === undefined || (Array.isArray(candidate) && candidate.length <= 100 && candidate.every((id) => boundedString(id, 128)));
  return validIds(value.personIds) && validIds(value.eventIds);
});

const aiConsentPurposes = new Set(['search', 'summary', 'recommendation', 'classification']);
const aiConsentResourceTypes = new Set(['event', 'archive_item']);
const sensitiveCategories = new Set(['child', 'health', 'finance', 'location']);
const sensitivePurposes = new Set(['sensitive_processing', 'external_export']);
const bankAccountTypes = new Set(['checking','savings','time_deposit','participation','investment','other']);
const bankAccountStatuses = new Set(['active','inactive','closed']);
const recordPrivacyValues = new Set(['private','selected_members','family']);
const financeRecordKinds = new Set(['asset','debt','income','expense']);

const containsProhibitedBankingSecret = (
  value: Record<string, unknown>,
  panSearchFields: readonly string[]
): IpcIntegrationPolicyDecision | undefined => {
  if (Object.keys(value).some(isProhibitedBankingSecretField)) {
    return rejected('BANKING_SECRET_FIELD_PROHIBITED', '$[0]');
  }
  if (panSearchFields.some((key) => containsLikelyFullPan(value[key]))) {
    return rejected('BANKING_SECRET_VALUE_PROHIBITED', '$[0]');
  }
  return undefined;
};

const ibanValidationInput = (args: readonly unknown[]): IpcIntegrationPolicyDecision => exactObject(
  args,
  ['iban'],
  (value) => boundedString(value.iban, 64)
);

const bankAccountInput = (args: readonly unknown[]): IpcIntegrationPolicyDecision => {
  if (args.length !== 1) return rejected('ARGUMENT_COUNT_MISMATCH');
  const value = args[0];
  if (!isObject(value)) return rejected('OBJECT_ARGUMENT_REQUIRED', '$[0]');
  const secretRejection = containsProhibitedBankingSecret(value, ['alias', 'branch']);
  if (secretRejection) return secretRejection;
  if (!hasOnlyKeys(value, BANK_ACCOUNT_INPUT_KEYS)) return rejected('UNKNOWN_OBJECT_FIELD', '$[0]');
  return boundedString(value.ownerPersonId, 128)
    && typeof value.institutionCode === 'string' && /^\d{4}$/u.test(value.institutionCode)
    && boundedString(value.iban, 64)
    && bankAccountTypes.has(String(value.accountType))
    && typeof value.currency === 'string' && /^[A-Za-z]{3}$/u.test(value.currency)
    && boundedString(value.alias, 100)
    && optionalBoundedString(value.branch, 120)
    && typeof value.ownershipBasisPoints === 'number'
    && Number.isInteger(value.ownershipBasisPoints)
    && value.ownershipBasisPoints >= 1
    && value.ownershipBasisPoints <= 10_000
    && bankAccountStatuses.has(String(value.status))
    && recordPrivacyValues.has(String(value.privacy))
    ? accepted()
    : rejected('BANK_ACCOUNT_ARGUMENT_INVALID', '$[0]');
};

const financeRecordInput = (args: readonly unknown[]): IpcIntegrationPolicyDecision => {
  if (args.length !== 1) return rejected('ARGUMENT_COUNT_MISMATCH');
  const value = args[0];
  if (!isObject(value)) return rejected('OBJECT_ARGUMENT_REQUIRED', '$[0]');
  const secretRejection = containsProhibitedBankingSecret(value, ['title', 'notes', 'symbol']);
  if (secretRejection) return secretRejection;
  if (!hasOnlyKeys(value, FINANCE_RECORD_INPUT_KEYS)) return rejected('UNKNOWN_OBJECT_FIELD', '$[0]');
  return boundedString(value.ownerPersonId, 128)
    && boundedString(value.title, 240)
    && financeRecordKinds.has(String(value.kind))
    && typeof value.amount === 'number' && Number.isFinite(value.amount) && value.amount >= 0
    && typeof value.currency === 'string' && value.currency.length <= 16
    && recordPrivacyValues.has(String(value.privacy))
    && optionalBoundedString(value.notes, 4_000)
    && boundedString(value.occurredAt, 64)
    && optionalBoundedString(value.dueAt, 64)
    && (value.remainingPrincipal === undefined || (typeof value.remainingPrincipal === 'number' && Number.isFinite(value.remainingPrincipal) && value.remainingPrincipal >= 0))
    && optionalBoundedString(value.symbol, 32)
    ? accepted()
    : rejected('FINANCE_RECORD_ARGUMENT_INVALID', '$[0]');
};

const financeValuationInput = (args: readonly unknown[]): IpcIntegrationPolicyDecision => {
  if (args.length !== 1) return rejected('ARGUMENT_COUNT_MISMATCH');
  const value = args[0];
  if (!isObject(value)) return rejected('OBJECT_ARGUMENT_REQUIRED', '$[0]');
  const secretRejection = containsProhibitedBankingSecret(value, ['provider']);
  if (secretRejection) return secretRejection;
  if (!hasOnlyKeys(value, FINANCE_VALUATION_INPUT_KEYS)) return rejected('UNKNOWN_OBJECT_FIELD', '$[0]');
  return boundedString(value.financeRecordId, 128)
    && boundedString(value.valueDate, 64)
    && typeof value.unitPrice === 'number' && Number.isFinite(value.unitPrice) && value.unitPrice >= 0
    && typeof value.quantity === 'number' && Number.isFinite(value.quantity) && value.quantity >= 0
    && optionalBoundedString(value.provider, 240)
    ? accepted()
    : rejected('FINANCE_VALUATION_ARGUMENT_INVALID', '$[0]');
};

const standardAiConsentInput = (args: readonly unknown[]): IpcIntegrationPolicyDecision => exactObject(
  args,
  ['purpose', 'resourceType', 'resourceId', 'status', 'startsAt', 'endsAt'],
  (value) => aiConsentPurposes.has(String(value.purpose))
    && aiConsentResourceTypes.has(String(value.resourceType))
    && boundedString(value.resourceId, 128)
    && (value.status === 'granted' || value.status === 'revoked')
    && optionalBoundedString(value.startsAt, 64)
    && optionalBoundedString(value.endsAt, 64)
);

const standardAiPreviewPurpose = (args: readonly unknown[]): IpcIntegrationPolicyDecision =>
  args.length === 1 && aiConsentPurposes.has(String(args[0]))
    ? accepted()
    : rejected('AI_CONSENT_PURPOSE_INVALID', '$[0]');

const sensitiveConsentInput = (args: readonly unknown[]): IpcIntegrationPolicyDecision => exactObject(
  args,
  ['category', 'purpose', 'status', 'durationMinutes', 'explicitConsent'],
  (value) => sensitiveCategories.has(String(value.category))
    && sensitivePurposes.has(String(value.purpose))
    && (value.status === 'granted' || value.status === 'revoked')
    && typeof value.explicitConsent === 'boolean'
    && optionalInteger(value.durationMinutes, 15, 43_200)
    && (value.status !== 'granted' || (value.explicitConsent === true && typeof value.durationMinutes === 'number'))
);

const sensitiveExportPreviewInput = (args: readonly unknown[]): IpcIntegrationPolicyDecision => exactObject(
  args,
  ['categories', 'destinationLabel', 'businessPurpose'],
  (value) => Array.isArray(value.categories)
    && value.categories.length >= 1
    && value.categories.length <= 4
    && value.categories.every((category) => sensitiveCategories.has(String(category)))
    && new Set(value.categories).size === value.categories.length
    && boundedString(value.destinationLabel, 100)
    && boundedString(value.businessPurpose, 240)
);

const optionalWindowsHelloFallback = (value: unknown): boolean => {
  if (value === undefined) return true;
  if (!isObject(value) || !hasOnlyKeys(value, ['password', 'secondFactorCode'])) return false;
  return boundedString(value.password, 1024)
    && optionalBoundedString(value.secondFactorCode, 256);
};

export const evaluateIpcIntegrationPolicy = (channel: string, args: readonly unknown[]): IpcIntegrationPolicyDecision => {
  switch (channel) {
    case 'finance:list':
    case 'finance:listValuations':
    case 'finance:listBankInstitutions':
    case 'finance:listBankAccounts':
      return zeroArguments(args);
    case 'finance:create':
      return financeRecordInput(args);
    case 'finance:createValuation':
      return financeValuationInput(args);
    case 'finance:validateIban':
      return ibanValidationInput(args);
    case 'finance:createBankAccount':
      return bankAccountInput(args);
    case 'ai:listConsents':
      return zeroArguments(args);
    case 'ai:upsertConsent':
      return standardAiConsentInput(args);
    case 'ai:previewAccess':
      return standardAiPreviewPurpose(args);
    case 'ai:listSensitiveProfiles':
      return zeroArguments(args);
    case 'ai:upsertSensitiveConsent':
      return sensitiveConsentInput(args);
    case 'ai:previewSensitiveExport':
      return sensitiveExportPreviewInput(args);
    case 'auth:getSessionLockState':
    case 'auth:recordSessionActivity':
    case 'auth:lockSession':
    case 'auth:getWindowsHelloState':
      return zeroArguments(args);
    case 'auth:unlockSession':
      return exactObject(args, ['password', 'secondFactorCode'], (value) =>
        boundedString(value.password, 1024)
        && optionalBoundedString(value.secondFactorCode, 256));
    case 'auth:enrollWindowsHello':
      return exactObject(args, ['password', 'secondFactorCode', 'displayName'], (value) =>
        boundedString(value.password, 1024)
        && optionalBoundedString(value.secondFactorCode, 256)
        && optionalBoundedString(value.displayName, 120));
    case 'auth:loginWithWindowsHello':
      return exactObject(args, ['accountId'], (value) =>
        value.accountId === undefined || boundedString(value.accountId, 128));
    case 'auth:reauthenticateWithWindowsHello':
      return exactObject(args, ['fallback'], (value) => optionalWindowsHelloFallback(value.fallback));
    case 'system:getCoreServiceHealth':
    case 'system:getCoreServiceApiBoundary':
    case 'system:getNetworkEgressBoundary':
    case 'system:getDerivedDataPolicyBoundary':
    case 'system:getSensitiveLoggingBoundary':
    case 'system:getPolicyDecisionAuditBoundary':
    case 'system:getSourceDeletionPropagationBoundary':
    case 'system:getPolicyConformanceSuiteBoundary':
    case 'system:getPlatformPolicyAstGateBoundary':
    case 'system:getPlatformCapabilityManifestGateBoundary':
    case 'system:getApplicationSecurityProfileGateBoundary':
    case 'system:getPolicyServiceAvailabilityBoundary':
    case 'system:getProductSurfaceGovernance':
    case 'system:getDesktopSecurityPosture':
    case 'system:getIpcAdaptiveBudgetMaintenanceAuthority':
    case 'system:getIpcPerformanceTelemetry':
      return zeroArguments(args);
    case 'system:beginIpcAdaptiveBudgetMaintenanceSession':
      return args.length === 3
        && (args[0] === 'reset' || args[0] === 'diagnostics-export')
        && boundedString(args[1], 64)
        && isObject(args[2])
        && Object.keys(args[2]).every((key) => key === 'password' || key === 'code')
        && boundedString(args[2].password, 1024)
        && optionalBoundedString(args[2].code, 16)
        ? accepted()
        : rejected('ARGUMENTS_INVALID', '$');
    case 'system:resetIpcAdaptiveBudget':
    case 'system:exportIpcAdaptiveBudgetDiagnostics':
      return args.length === 1 && isObject(args[0])
        && typeof args[0].sessionId === 'string'
        && typeof args[0].rendererSessionId === 'string'
        && (args[0].operation === 'reset' || args[0].operation === 'diagnostics-export')
        ? accepted()
        : rejected('ARGUMENTS_INVALID', '$');
    case 'dataLifecycle:listRevocationSyncStates':
    case 'familyData:previewImport':
      return zeroArguments(args);
    case 'dataLifecycle:runRevocationSync':
      return optionalIdentifier(args);
    case 'dataLifecycle:getPendingRevocationSyncList':
      return args.length === 1 && boundedString(args[0], 128) ? accepted() : rejected('IDENTIFIER_INVALID', '$[0]');
    case 'dataLifecycle:applyPendingRevocationSyncList':
      return exactObject(args, ['endpointId', 'pendingListId', 'confirmation', 'password', 'code'], (value) =>
        boundedString(value.endpointId, 128) && boundedString(value.pendingListId, 128) && boundedString(value.confirmation, 512) && boundedString(value.password, 1024) && optionalBoundedString(value.code, 256));
    case 'dataLifecycle:upsertExternalBackupRevocationEndpoint':
      return exactObject(args, ['issuerId', 'sourceUrl', 'primarySpkiSha256', 'secondarySpkiSha256', 'secondaryValidFrom', 'primaryValidUntil', 'enabled', 'confirmation', 'password', 'code'], (value) =>
        boundedString(value.issuerId, 128) && boundedString(value.sourceUrl, 2_048) && boundedString(value.primarySpkiSha256, 256) && optionalBoundedString(value.secondarySpkiSha256, 256) && optionalBoundedString(value.secondaryValidFrom, 64) && optionalBoundedString(value.primaryValidUntil, 64) && typeof value.enabled === 'boolean' && boundedString(value.confirmation, 512) && boundedString(value.password, 1024) && optionalBoundedString(value.code, 256));
    case 'familyData:applyImport':
      return exactObject(args, ['previewId', 'password', 'code'], (value) => boundedString(value.previewId, 128) && boundedString(value.password, 1024) && optionalBoundedString(value.code, 256));
    case 'familyData:listImports':
      return optionalLimit(args, 200);
    case 'familyData:rollbackImport':
      return exactObject(args, ['batchId', 'password', 'code'], (value) => boundedString(value.batchId, 128) && boundedString(value.password, 1024) && optionalBoundedString(value.code, 256));
    case 'data:getSnapshotSections':
      return exactObject(args, ['sections'], (value) => Array.isArray(value.sections)
        && value.sections.length >= 1
        && value.sections.length <= 2
        && value.sections.every((section) => section === 'graph' || section === 'timeline')
        && new Set(value.sections).size === value.sections.length);
    case 'largeData:tree':
      return pageInput(args, 'tree');
    case 'largeData:timeline':
      return pageInput(args, 'timeline');
    case 'largeData:archive':
      return pageInput(args, 'archive');
    case 'catalog:listPeople':
      return catalogPageInput(args, 'person');
    case 'catalog:listEvents':
      return catalogPageInput(args, 'event');
    case 'catalog:lookup':
      return catalogLookupInput(args);
    default:
      return accepted();
  }
};

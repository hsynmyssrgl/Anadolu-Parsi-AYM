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

const optionalWindowsHelloFallback = (value: unknown): boolean => {
  if (value === undefined) return true;
  if (!isObject(value) || !hasOnlyKeys(value, ['password', 'secondFactorCode'])) return false;
  return boundedString(value.password, 1024)
    && optionalBoundedString(value.secondFactorCode, 256);
};

export const evaluateIpcIntegrationPolicy = (channel: string, args: readonly unknown[]): IpcIntegrationPolicyDecision => {
  switch (channel) {
    case 'auth:getWindowsHelloState':
      return zeroArguments(args);
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

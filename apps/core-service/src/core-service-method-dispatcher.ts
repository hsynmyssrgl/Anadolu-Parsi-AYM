import {
  CORE_SERVICE_LOCAL_ADMIN_PROTOCOL_VERSION,
  CORE_SERVICE_REQUIRED_DESKTOP_METHODS,
  type CoreServiceLocalAdminFailure,
  type CoreServiceLocalAdminMethod,
  type CoreServiceLocalAdminResponse,
  type CoreServiceLocalAdminSuccess,
  type PolicyAuthorizationContractPayload,
  type PolicyAuthorizationContractResult,
  type PolicyReceiptVerificationContractPayload,
  type PolicyReceiptVerificationContractResult
  , type PolicyJournalCheckpointContractPayload
  , type PolicyJournalCheckpointContractResult
} from '@ppt/core-service-contracts';
import type { CoreServiceRuntime } from './core-service-runtime.js';

const knownMethods = new Set<string>(CORE_SERVICE_REQUIRED_DESKTOP_METHODS);
const emptyPayload = (value: unknown): value is Record<string, never> =>
  value !== null && typeof value === 'object' && !Array.isArray(value) && Object.keys(value).length === 0;
const hasStrictPolicyContext = (value: unknown): value is PolicyAuthorizationContractPayload['request'] => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const request = value as Record<string, unknown>;
  const subject = request.subject && typeof request.subject === 'object' && !Array.isArray(request.subject)
    ? request.subject as Record<string, unknown>
    : undefined;
  const resource = request.resource && typeof request.resource === 'object' && !Array.isArray(request.resource)
    ? request.resource as Record<string, unknown>
    : undefined;
  return request.enforcementMode === 'strict'
    && typeof request.correlationId === 'string' && request.correlationId.trim().length > 0
    && typeof request.purpose === 'string' && request.purpose.trim().length > 0
    && typeof request.occurredAt === 'string' && Number.isFinite(Date.parse(request.occurredAt))
    && Boolean(subject)
    && Array.isArray(subject?.roles) && subject.roles.length > 0
    && Array.isArray(subject?.familyIds) && subject.familyIds.length > 0
    && Array.isArray(subject?.householdIds)
    && Array.isArray(subject?.familyBranchIds)
    && Boolean(resource)
    && typeof resource?.familyId === 'string' && resource.familyId.trim().length > 0
    && typeof request.action === 'string' && typeof request.capability === 'string';
};

export class CoreServiceMethodDispatcher {
  readonly #runtime: CoreServiceRuntime;

  public constructor(runtime: CoreServiceRuntime) {
    this.#runtime = runtime;
  }

  public dispatch(requestId: string, method: unknown, payload: unknown): CoreServiceLocalAdminResponse {
    if (typeof method !== 'string' || !knownMethods.has(method)) {
      return this.#failure(requestId, 'METHOD_NOT_ALLOWED', 'Local administration method is not allowed');
    }
    const typedMethod = method as CoreServiceLocalAdminMethod;
    if (typedMethod === 'architecture.get') {
      return emptyPayload(payload)
        ? this.#success(requestId, this.#runtime.architecture())
        : this.#failure(requestId, 'INVALID_REQUEST', 'Architecture request payload must be empty');
    }
    if (typedMethod === 'health.get') {
      return emptyPayload(payload)
        ? this.#success(requestId, this.#runtime.health())
        : this.#failure(requestId, 'INVALID_REQUEST', 'Health request payload must be empty');
    }
    if (typedMethod === 'family-data.status') {
      return emptyPayload(payload)
        ? this.#success(requestId, this.#runtime.familyDataStatus())
        : this.#failure(requestId, 'INVALID_REQUEST', 'Family-data status request payload must be empty');
    }
    if (typedMethod === 'device-secret-protection.status') {
      return emptyPayload(payload)
        ? this.#success(requestId, this.#runtime.deviceSecretProtectionStatus())
        : this.#failure(requestId, 'INVALID_REQUEST', 'Device-secret protection status request payload must be empty');
    }
    if (typedMethod === 'family-data-cutover.status') {
      return emptyPayload(payload)
        ? this.#success(requestId, this.#runtime.familyDataCutoverStatus())
        : this.#failure(requestId, 'INVALID_REQUEST', 'Family-data cutover status request payload must be empty');
    }
    if (typedMethod === 'family-data-cutover-readiness.status') {
      return emptyPayload(payload)
        ? this.#success(requestId, this.#runtime.familyDataCutoverReadinessStatus())
        : this.#failure(requestId, 'INVALID_REQUEST', 'Family-data cutover readiness status request payload must be empty');
    }
    if (typedMethod === 'policy.authorize') {
      if (!payload || typeof payload !== 'object') return this.#failure(requestId, 'INVALID_REQUEST', 'Policy request payload is required');
      const input = payload as Partial<PolicyAuthorizationContractPayload>;
      if (!hasStrictPolicyContext(input.request) || typeof input.nonce !== 'string' || input.nonce.length < 1 || input.nonce.length > 256) {
        return this.#failure(requestId, 'INVALID_REQUEST', 'Complete strict policy context and nonce are required');
      }
      const result: PolicyAuthorizationContractResult = this.#runtime.authorizeWithReceipt(input.request, input.nonce);
      return this.#success(requestId, result);
    }
    if (typedMethod === 'policy.verify') {
      if (!payload || typeof payload !== 'object') return this.#failure(requestId, 'INVALID_REQUEST', 'Policy receipt verification payload is required');
      const input = payload as Partial<PolicyReceiptVerificationContractPayload>;
      if (!hasStrictPolicyContext(input.request) || !input.receipt || typeof input.receipt !== 'object') {
        return this.#failure(requestId, 'INVALID_REQUEST', 'Complete strict policy context and receipt are required for verification');
      }
      const result: PolicyReceiptVerificationContractResult = this.#runtime.verifyReceiptForRequest(input.request, input.receipt);
      return this.#success(requestId, result);
    }
    if (typedMethod === 'policy-journal.checkpoint') {
      if (!payload || typeof payload !== 'object') return this.#failure(requestId, 'INVALID_REQUEST', 'Policy journal checkpoint payload is required');
      const input = payload as Partial<PolicyJournalCheckpointContractPayload>;
      if (
        !Number.isSafeInteger(input.journalSequence) || Number(input.journalSequence) < 0
        || typeof input.journalHeadHash !== 'string'
        || !Number.isSafeInteger(input.journalSizeBytes) || Number(input.journalSizeBytes) < 0
      ) return this.#failure(requestId, 'INVALID_REQUEST', 'Policy journal checkpoint is invalid');
      try {
        const result: PolicyJournalCheckpointContractResult = this.#runtime.checkpointPolicyJournal(
          input as PolicyJournalCheckpointContractPayload
        );
        return this.#success(requestId, result);
      } catch (error) {
        return this.#failure(
          requestId,
          'INVALID_REQUEST',
          error instanceof Error ? error.message : 'Policy journal checkpoint failed'
        );
      }
    }
    return this.#failure(requestId, 'METHOD_NOT_ALLOWED', 'Local administration method is not allowed');
  }

  #success<TResult>(requestId: string, result: TResult): CoreServiceLocalAdminSuccess<TResult> {
    return { protocolVersion: CORE_SERVICE_LOCAL_ADMIN_PROTOCOL_VERSION, requestId, ok: true, result };
  }

  #failure(requestId: string, code: CoreServiceLocalAdminFailure['error']['code'], message: string): CoreServiceLocalAdminFailure {
    return { protocolVersion: CORE_SERVICE_LOCAL_ADMIN_PROTOCOL_VERSION, requestId, ok: false, error: { code, message } };
  }
}

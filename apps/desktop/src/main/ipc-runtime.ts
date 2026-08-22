import { randomUUID } from 'node:crypto';
import type { IpcMain, IpcMainInvokeEvent } from 'electron';
import {
  ERROR_CODES,
  asCorrelationId,
  createAppError,
  isAppError,
  type CorrelationId
} from '@ppt/core';
import type { DesktopRuntime } from './runtime-bootstrap.js';
import { evaluateIpcSenderTrust, type IpcSenderEventLike, type TrustedRendererDescriptor } from './ipc-sender-trust.js';
import { evaluateIpcPayloadSecurity } from './ipc-payload-security.js';
import { evaluateIpcIntegrationPolicy, evaluateIpcIntegrationResultPolicy } from './ipc-integration-policy.js';
import {
  IpcTransportProtocolError,
  IpcTransportSessionRegistry,
  type IpcTransportRequestContext,
  createIpcTransportResponseEnvelope
} from './ipc-transport-context.js';
import {
  IpcReadResultCacheRegistry,
  createIpcReadSharingKey,
  resolveIpcReadSharingPolicy,
  shouldInvalidateIpcReadSharing
} from './ipc-read-sharing.js';
import type { IpcPerformanceTelemetryRegistry } from './ipc-performance-telemetry.js';
import type { IpcAdaptiveResourceBudgetController } from './ipc-adaptive-resource-budget.js';
import {
  IPC_REQUEST_CANCEL_ALL_CHANNEL,
  IPC_REQUEST_CANCEL_CHANNEL,
  IpcRequestAbortedError,
  IpcRequestAdmissionError,
  IpcRequestLifecycleRegistry,
  resolveIpcRequestLifecyclePolicy
} from './ipc-request-lifecycle.js';

export type IpcHandler<TArguments extends unknown[], TResult> = (
  event: IpcMainInvokeEvent,
  ...args: TArguments
) => TResult | Promise<TResult>;

export interface IpcPolicyEnforcementBoundary {
  execute<TResult>(input: {
    readonly channel: string;
    readonly correlationId: CorrelationId;
    readonly operation: () => TResult | Promise<TResult>;
  }): Promise<TResult>;
}

export const createRuntimeCorrelationId = (scope: 'ipc' | 'job' | 'startup' | 'migration'): CorrelationId =>
  asCorrelationId(`${scope}-${randomUUID()}`);

export const toIpcRendererError = (error: unknown): Error => {
  if (error instanceof Error) return error;
  if (isAppError(error)) {
    const reason = typeof error.details?.reason === 'string' ? error.details.reason : undefined;
    const protocolMessage = typeof error.details?.protocolMessage === 'string' ? error.details.protocolMessage : undefined;
    const diagnostic = [reason, protocolMessage].filter((value): value is string => Boolean(value)).join(' · ');
    const rendererError = new Error(`[${error.code}] ${error.message}${diagnostic ? ` (${diagnostic})` : ''}`);
    rendererError.name = 'AppError';
    return rendererError;
  }
  return new Error(typeof error === 'string' && error.trim()
    ? error.trim()
    : 'Beklenmeyen IPC hatası oluştu.');
};

export const registerCorrelatedIpcHandler = <TArguments extends unknown[], TResult>(input: {
  readonly ipcMain: IpcMain;
  readonly runtime: DesktopRuntime;
  readonly channel: string;
  readonly resolveTrustedRenderer: () => TrustedRendererDescriptor | undefined;
  readonly transportSessions: IpcTransportSessionRegistry;
  readonly requestLifecycles: IpcRequestLifecycleRegistry;
  readonly readResults: IpcReadResultCacheRegistry;
  readonly telemetry: IpcPerformanceTelemetryRegistry;
  readonly adaptiveBudget: IpcAdaptiveResourceBudgetController;
  readonly policyEnforcement?: IpcPolicyEnforcementBoundary;
  readonly handler: IpcHandler<TArguments, TResult>;
}): void => {
  input.ipcMain.handle(input.channel, (event, ...rawArguments) => {
    const correlationId = createRuntimeCorrelationId('ipc');
    const startedAt = Date.now();
    return input.runtime.correlation.run({ correlationId }, async () => {
      const trustDecision = evaluateIpcSenderTrust(
        event as unknown as IpcSenderEventLike,
        input.resolveTrustedRenderer()
      );
      if (!trustDecision.trusted) {
        input.runtime.logger.warn({
          timestamp: input.runtime.clock.now(),
          service: 'desktop-main',
          process: 'electron-main',
          event: 'ipc.request.rejected',
          correlationId,
          outcome: 'failure',
          errorCode: ERROR_CODES.AUTHORIZATION_DENIED,
          metadata: {
            channel: input.channel,
            reason: trustDecision.reason,
            senderId: event.sender?.id
          }
        });
        throw createAppError({
          code: ERROR_CODES.AUTHORIZATION_DENIED,
          message: 'IPC çağrısı güvenilir ana renderer kaynağından gelmedi.',
          category: 'security',
          correlationId,
          details: { channel: input.channel, reason: trustDecision.reason }
        });
      }
      const payloadDecision = evaluateIpcPayloadSecurity(rawArguments);
      if (!payloadDecision.accepted) {
        input.runtime.logger.warn({
          timestamp: input.runtime.clock.now(),
          service: 'desktop-main',
          process: 'electron-main',
          event: 'ipc.payload.rejected',
          correlationId,
          outcome: 'failure',
          errorCode: ERROR_CODES.CORE_INVALID_ARGUMENT,
          metadata: {
            channel: input.channel,
            reason: payloadDecision.reason,
            argumentCount: payloadDecision.metrics.argumentCount,
            nodeCount: payloadDecision.metrics.nodeCount,
            requestNodeCount: payloadDecision.metrics.nodeCount,
            maximumDepth: payloadDecision.metrics.maximumDepth,
            estimatedBytes: payloadDecision.metrics.estimatedBytes,
            requestEstimatedBytes: payloadDecision.metrics.estimatedBytes
          }
        });
        throw createAppError({
          code: ERROR_CODES.CORE_INVALID_ARGUMENT,
          message: 'IPC çağrısı güvenli payload sınırlarını aştı.',
          category: 'security',
          correlationId,
          details: {
            channel: input.channel,
            reason: payloadDecision.reason,
            path: payloadDecision.path
          }
        });
      }
      let requestContext: IpcTransportRequestContext;
      try {
        requestContext = input.transportSessions.accept(event.sender?.id ?? -1, input.channel, rawArguments[0]);
      } catch (error) {
        const reason = error instanceof IpcTransportProtocolError ? error.code : 'INVALID_REQUEST_CONTEXT';
        const protocolMessage = error instanceof Error ? error.message : undefined;
        input.runtime.logger.warn({
          timestamp: input.runtime.clock.now(),
          service: 'desktop-main',
          process: 'electron-main',
          event: 'ipc.transport_context.rejected',
          correlationId,
          outcome: 'failure',
          errorCode: ERROR_CODES.CORE_INVALID_ARGUMENT,
          metadata: {
            channel: input.channel,
            reason,
            senderId: event.sender?.id
          }
        });
        throw createAppError({
          code: ERROR_CODES.CORE_INVALID_ARGUMENT,
          message: 'IPC taşıma bağlamı geçersiz veya artık güncel değil.',
          category: 'security',
          correlationId,
          details: { channel: input.channel, reason, ...(protocolMessage ? { protocolMessage } : {}) }
        });
      }
      const handlerArguments = rawArguments.slice(1);
      const integrationDecision = evaluateIpcIntegrationPolicy(input.channel, handlerArguments);
      if (!integrationDecision.accepted) {
        input.runtime.logger.warn({
          timestamp: input.runtime.clock.now(),
          service: 'desktop-main',
          process: 'electron-main',
          event: 'ipc.integration_payload.rejected',
          correlationId,
          outcome: 'failure',
          errorCode: ERROR_CODES.CORE_INVALID_ARGUMENT,
          metadata: {
            channel: input.channel,
            reason: integrationDecision.reason,
            argumentCount: handlerArguments.length
          }
        });
        throw createAppError({
          code: ERROR_CODES.CORE_INVALID_ARGUMENT,
          message: 'IPC çağrısı kanalın entegrasyon sözleşmesiyle uyuşmuyor.',
          category: 'security',
          correlationId,
          details: {
            channel: input.channel,
            reason: integrationDecision.reason,
            path: integrationDecision.path
          }
        });
      }
      const telemetrySnapshot = input.telemetry.snapshot({
        activeRequests: input.requestLifecycles.activeCount(),
        queuedRequests: input.requestLifecycles.queuedCount(),
        cacheEntries: input.readResults.entryCount()
      });
      const budgetRefresh = input.adaptiveBudget.refresh(telemetrySnapshot);
      if (budgetRefresh.changed) {
        input.readResults.clearAll();
        input.runtime.logger.info({
          timestamp: input.runtime.clock.now(),
          service: 'desktop-main',
          process: 'electron-main',
          event: 'ipc.adaptive_budget.changed',
          correlationId,
          outcome: 'success',
          metadata: {
            previousMode: budgetRefresh.previousMode,
            mode: budgetRefresh.current.mode,
            reason: budgetRefresh.current.reason,
            generation: budgetRefresh.current.generation,
            sampleCount: budgetRefresh.current.sampleCount
          }
        });
      }
      const readSharingPolicy = input.adaptiveBudget.resolveReadSharingPolicy(input.channel);
      if (!readSharingPolicy.enabled && shouldInvalidateIpcReadSharing(input.channel)) {
        input.readResults.invalidateSender(event.sender?.id ?? -1);
      }
      const readCacheGeneration = input.readResults.generation(event.sender?.id ?? -1);
      let readSharingKey: string | undefined;
      if (readSharingPolicy.enabled) {
        try {
          readSharingKey = createIpcReadSharingKey({
            rendererSessionId: requestContext.rendererSessionId,
            sessionEpoch: requestContext.sessionEpoch,
            channel: input.channel,
            revisions: requestContext.revisions,
            arguments: handlerArguments
          });
        } catch {
          readSharingKey = undefined;
        }
        if (readSharingKey) {
          const cached = input.readResults.lookup<TResult>(event.sender?.id ?? -1, readSharingKey);
          if (cached.hit) {
            input.runtime.logger.debug({
              timestamp: input.runtime.clock.now(),
              service: 'desktop-main',
              process: 'electron-main',
              event: 'ipc.read_cache.hit',
              correlationId,
              durationMs: Date.now() - startedAt,
              outcome: 'success',
              metadata: {
                channel: input.channel,
                requestId: requestContext.requestId,
                cacheAgeMs: cached.ageMs,
                cacheEstimatedBytes: cached.estimatedBytes,
                senderId: event.sender?.id
              }
            });
            input.telemetry.record({
              channel: input.channel, kind: 'cache-hit', durationMs: Date.now() - startedAt,
              activeCount: input.requestLifecycles.activeCount(event.sender?.id ?? -1),
              queuedCount: input.requestLifecycles.queuedCount(event.sender?.id ?? -1)
            });
            const authorizedCachedResult = input.policyEnforcement
              ? await input.policyEnforcement.execute({
                  channel: input.channel,
                  correlationId,
                  operation: () => cached.result as TResult
                })
              : cached.result as TResult;
            const cachedResultDecision = evaluateIpcIntegrationResultPolicy(input.channel, authorizedCachedResult);
            if (!cachedResultDecision.accepted) {
              throw createAppError({
                code: ERROR_CODES.CORE_UNEXPECTED,
                message: 'IPC Ã¶nbellek yanÄ±tÄ± kanalÄ±n gÃ¼venli sonuÃ§ sÃ¶zleÅŸmesiyle uyuÅŸmuyor.',
                category: 'security',
                correlationId,
                details: { channel: input.channel, reason: cachedResultDecision.reason }
              });
            }
            return createIpcTransportResponseEnvelope(requestContext, correlationId, authorizedCachedResult);
          }
        }
      }
      const lifecyclePolicy = resolveIpcRequestLifecyclePolicy(input.channel);
      const admissionPolicy = input.adaptiveBudget.resolveAdmissionPolicy(input.channel);
      let requestLease;
      try {
        requestLease = await input.requestLifecycles.acquire(event.sender?.id ?? -1, requestContext, lifecyclePolicy, admissionPolicy);
      } catch (error) {
        if (error instanceof IpcRequestAdmissionError) {
          input.runtime.logger.warn({
            timestamp: input.runtime.clock.now(),
            service: 'desktop-main',
            process: 'electron-main',
            event: error.kind === 'queue-full'
              ? 'ipc.request.backpressure_rejected'
              : error.kind === 'rate-limit'
                ? 'ipc.request.rate_limited'
                : 'ipc.request.queue_timed_out',
            correlationId,
            durationMs: Date.now() - startedAt,
            outcome: 'failure',
            errorCode: ERROR_CODES.CORE_UNEXPECTED,
            metadata: {
              channel: input.channel,
              requestId: requestContext.requestId,
              admissionKind: error.kind,
              activeCount: input.requestLifecycles.activeCount(event.sender?.id ?? -1),
              queuedCount: input.requestLifecycles.queuedCount(event.sender?.id ?? -1)
            }
          });
          input.telemetry.record({
            channel: input.channel, kind: error.kind === 'rate-limit' ? 'queue-full' : error.kind, durationMs: Date.now() - startedAt,
            activeCount: input.requestLifecycles.activeCount(event.sender?.id ?? -1),
            queuedCount: input.requestLifecycles.queuedCount(event.sender?.id ?? -1)
          });
          throw createAppError({
            code: ERROR_CODES.CORE_UNEXPECTED,
            message: error.kind === 'queue-full'
              ? 'IPC istek yoğunluğu sınırı aşıldı.'
              : error.kind === 'rate-limit'
                ? 'IPC istek hızı bütçesi aşıldı.'
                : 'IPC isteği yoğunluk kuyruğunda süre aşımına uğradı.',
            category: 'infrastructure',
            retryable: true,
            correlationId,
            details: { channel: input.channel, requestId: requestContext.requestId, admissionKind: error.kind }
          });
        }
        throw error;
      }
      input.requestLifecycles.bindEvent(event, requestLease.signal, requestLease.request);
      input.runtime.logger.debug({
        timestamp: input.runtime.clock.now(),
        service: 'desktop-main',
        process: 'electron-main',
        event: 'ipc.request.started',
        correlationId,
        metadata: {
          channel: input.channel,
          argumentCount: handlerArguments.length,
          requestId: requestContext.requestId,
          rendererSessionId: requestContext.rendererSessionId,
          sessionEpoch: requestContext.sessionEpoch,
          requestSequence: requestContext.requestSequence,
          cancellable: lifecyclePolicy.cancellable,
          timeoutMs: lifecyclePolicy.timeoutMs,
          admissionQueued: requestLease.admission.queued,
          admissionWaitMs: requestLease.admission.waitMs,
          admissionPriority: requestLease.admission.priority,
          requestEstimatedBytes: payloadDecision.metrics.estimatedBytes,
          requestNodeCount: payloadDecision.metrics.nodeCount,
          senderId: event.sender?.id
        }
      });
      try {
        const operation = input.policyEnforcement
          ? input.policyEnforcement.execute({
              channel: input.channel,
              correlationId,
              operation: () => input.handler(event, ...(handlerArguments as TArguments))
            })
          : Promise.resolve(input.handler(event, ...(handlerArguments as TArguments)));
        const result = await requestLease.run(operation);
        const resultDecision = evaluateIpcIntegrationResultPolicy(input.channel, result);
        if (!resultDecision.accepted) {
          throw createAppError({
            code: ERROR_CODES.CORE_UNEXPECTED,
            message: 'IPC yanıtı kanalın güvenli sonuç sözleşmesiyle uyuşmuyor.',
            category: 'security',
            correlationId,
            details: { channel: input.channel, reason: resultDecision.reason }
          });
        }
        const readCacheStored = readSharingKey
          ? input.readResults.store(event.sender?.id ?? -1, readSharingKey, result, readSharingPolicy, Date.now(), readCacheGeneration)
          : false;
        input.runtime.logger.info({
          timestamp: input.runtime.clock.now(),
          service: 'desktop-main',
          process: 'electron-main',
          event: 'ipc.request.completed',
          correlationId,
          durationMs: Date.now() - startedAt,
          outcome: 'success',
          metadata: {
            channel: input.channel,
            requestId: requestContext.requestId,
            sessionEpoch: requestContext.sessionEpoch,
            requestSequence: requestContext.requestSequence,
            admissionQueued: requestLease.admission.queued,
            admissionWaitMs: requestLease.admission.waitMs,
            admissionPriority: requestLease.admission.priority,
            readCacheStored
          }
        });
        input.telemetry.record({
          channel: input.channel, kind: 'success', durationMs: Date.now() - startedAt,
          queueWaitMs: requestLease.admission.waitMs,
          activeCount: input.requestLifecycles.activeCount(event.sender?.id ?? -1),
          queuedCount: input.requestLifecycles.queuedCount(event.sender?.id ?? -1),
          cacheStored: readCacheStored
        });
        return createIpcTransportResponseEnvelope(requestContext, correlationId, result);
      } catch (error) {
        if (error instanceof IpcRequestAbortedError) {
          input.runtime.logger.info({
            timestamp: input.runtime.clock.now(),
            service: 'desktop-main',
            process: 'electron-main',
            event: error.kind === 'timeout' ? 'ipc.request.timed_out' : 'ipc.request.cancelled',
            correlationId,
            durationMs: Date.now() - startedAt,
            outcome: 'failure',
            errorCode: ERROR_CODES.CORE_UNEXPECTED,
            metadata: {
              channel: input.channel,
              requestId: requestContext.requestId,
              reason: error.reason
            }
          });
          input.telemetry.record({
            channel: input.channel, kind: error.kind === 'timeout' ? 'timeout' : 'cancelled',
            durationMs: Date.now() - startedAt, queueWaitMs: requestLease.admission.waitMs,
            activeCount: input.requestLifecycles.activeCount(event.sender?.id ?? -1),
            queuedCount: input.requestLifecycles.queuedCount(event.sender?.id ?? -1)
          });
          throw createAppError({
            code: ERROR_CODES.CORE_UNEXPECTED,
            message: error.kind === 'timeout' ? 'IPC isteği süre aşımına uğradı.' : 'IPC isteği iptal edildi.',
            category: 'infrastructure',
            retryable: true,
            correlationId,
            details: { channel: input.channel, requestId: requestContext.requestId, reason: error.reason }
          });
        }
        input.runtime.logger.error({
          timestamp: input.runtime.clock.now(),
          service: 'desktop-main',
          process: 'electron-main',
          event: 'ipc.request.failed',
          correlationId,
          durationMs: Date.now() - startedAt,
          outcome: 'failure',
          errorCode: isAppError(error) ? error.code : ERROR_CODES.CORE_UNEXPECTED,
          metadata: {
            channel: input.channel,
            errorName: error instanceof Error ? error.name : typeof error
          }
        });
        input.telemetry.record({
          channel: input.channel, kind: 'failure', durationMs: Date.now() - startedAt,
          queueWaitMs: requestLease.admission.waitMs,
          activeCount: input.requestLifecycles.activeCount(event.sender?.id ?? -1),
          queuedCount: input.requestLifecycles.queuedCount(event.sender?.id ?? -1)
        });
        throw error;
      } finally {
        input.requestLifecycles.unbindEvent(event);
        requestLease.complete();
      }
    }).catch((error: unknown) => {
      throw toIpcRendererError(error);
    });
  });
};


export const registerIpcCancellationHandlers = (input: {
  readonly ipcMain: IpcMain;
  readonly runtime: DesktopRuntime;
  readonly resolveTrustedRenderer: () => TrustedRendererDescriptor | undefined;
  readonly requestLifecycles: IpcRequestLifecycleRegistry;
}): void => {
  const register = (channel: typeof IPC_REQUEST_CANCEL_CHANNEL | typeof IPC_REQUEST_CANCEL_ALL_CHANNEL, cancel: (senderId: number, raw: unknown) => boolean | number): void => {
    input.ipcMain.handle(channel, (event, rawMessage) => {
      const correlationId = createRuntimeCorrelationId('ipc');
      const trustDecision = evaluateIpcSenderTrust(event as unknown as IpcSenderEventLike, input.resolveTrustedRenderer());
      if (!trustDecision.trusted) {
        input.runtime.logger.warn({
          timestamp: input.runtime.clock.now(),
          service: 'desktop-main',
          process: 'electron-main',
          event: 'ipc.cancellation.rejected',
          correlationId,
          outcome: 'failure',
          errorCode: ERROR_CODES.AUTHORIZATION_DENIED,
          metadata: { channel, reason: trustDecision.reason, senderId: event.sender?.id }
        });
        throw createAppError({
          code: ERROR_CODES.AUTHORIZATION_DENIED,
          message: 'IPC iptal çağrısı güvenilir renderer kaynağından gelmedi.',
          category: 'security',
          correlationId,
          details: { channel, reason: trustDecision.reason }
        });
      }
      try {
        const result = cancel(event.sender?.id ?? -1, rawMessage);
        input.runtime.logger.debug({
          timestamp: input.runtime.clock.now(),
          service: 'desktop-main',
          process: 'electron-main',
          event: 'ipc.cancellation.processed',
          correlationId,
          outcome: 'success',
          metadata: { channel, senderId: event.sender?.id, result }
        });
        return result;
      } catch (error) {
        input.runtime.logger.warn({
          timestamp: input.runtime.clock.now(),
          service: 'desktop-main',
          process: 'electron-main',
          event: 'ipc.cancellation.rejected',
          correlationId,
          outcome: 'failure',
          errorCode: ERROR_CODES.CORE_INVALID_ARGUMENT,
          metadata: { channel, senderId: event.sender?.id, errorName: error instanceof Error ? error.name : typeof error }
        });
        throw createAppError({
          code: ERROR_CODES.CORE_INVALID_ARGUMENT,
          message: 'IPC iptal mesajı geçersiz.',
          category: 'security',
          correlationId,
          details: { channel }
        });
      }
    });
  };
  register(IPC_REQUEST_CANCEL_CHANNEL, (senderId, raw) => input.requestLifecycles.cancel(senderId, raw));
  register(IPC_REQUEST_CANCEL_ALL_CHANNEL, (senderId, raw) => input.requestLifecycles.cancelAll(senderId, raw));
};

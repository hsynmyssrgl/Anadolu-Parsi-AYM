import { ERROR_CODES, createAppError, type CorrelationId } from '@ppt/core';
import type { ClientDataAccessBoundaryView } from '@ppt/domain';
import type {
  ClientDataAccessAuthoritativeContext,
  ClientDataAccessBootstrapRequest,
  ClientDataAccessBoundaryPolicy,
  ClientDataAccessRequest
} from '@ppt/platform-policy';

const denied = (correlationId: CorrelationId, reason: string) => createAppError({
  code: ERROR_CODES.AUTHORIZATION_DENIED,
  message: 'İstemci veri erişimi yalnızca yetkili uygulama servisi ve tipli IPC/API sınırından yapılabilir.',
  category: 'security',
  correlationId,
  details: { reason }
});

export class EnforceClientDataAccessUseCase {
  public constructor(private readonly policy: ClientDataAccessBoundaryPolicy) {}

  public async execute<T>(input: {
    readonly correlationId: CorrelationId;
    readonly request: ClientDataAccessRequest;
    readonly authoritativeContext: ClientDataAccessAuthoritativeContext;
    readonly operation: () => T | Promise<T>;
  }): Promise<T> {
    const decision = this.policy.evaluate(input.request, input.authoritativeContext);
    if (!decision.allowed) throw denied(input.correlationId, decision.reason);
    return input.operation();
  }

  public async executeBootstrap<T>(input: {
    readonly correlationId: CorrelationId;
    readonly request: ClientDataAccessBootstrapRequest;
    readonly operation: () => T | Promise<T>;
  }): Promise<T> {
    const decision = this.policy.evaluateBootstrap(input.request);
    if (!decision.allowed) throw denied(input.correlationId, decision.reason);
    return input.operation();
  }
}

export class GetClientDataAccessBoundaryUseCase {
  public constructor(private readonly policy: ClientDataAccessBoundaryPolicy) {}

  public execute(): ClientDataAccessBoundaryView {
    const snapshot = this.policy.snapshot();
    return Object.freeze({
      schemaVersion: 1,
      enforcement: snapshot.enforcement,
      allowedTransports: snapshot.allowedTransports,
      directAccess: Object.freeze({ repository: false, sql: false, sqlite: false, vaultFile: false }),
      directAccessExceptionCount: 0,
      registeredApplicationServiceChannels: snapshot.registeredApplicationServiceChannels,
      protectedContextBindings: snapshot.protectedContextBindings,
      legacyDesktopVaultPreserved: true,
      sqliteOwnershipTransferred: false,
      persistentPathExposed: false,
      secretMaterialExposed: false
    });
  }
}

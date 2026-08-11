import type { CausationId, CommandId, CorrelationId, UserId } from './brand.js';

export interface CorrelationContext {
  readonly correlationId: CorrelationId;
  readonly causationId?: CausationId;
  readonly commandId?: CommandId;
  readonly actorId?: UserId;
}

export interface CorrelationContextProvider {
  current(): CorrelationContext | undefined;
  run<TValue>(context: CorrelationContext, operation: () => TValue): TValue;
}

/**
 * AsyncLocalStorage gibi platform depolarını core paketine doğrudan bağlamadan
 * correlation context sağlayan küçük adaptör sözleşmesi.
 */
export interface AsyncContextStorage<TContext> {
  getStore(): TContext | undefined;
  run<TValue>(context: TContext, operation: () => TValue): TValue;
}

export class StoredCorrelationContextProvider implements CorrelationContextProvider {
  public constructor(
    private readonly storage: AsyncContextStorage<CorrelationContext>
  ) {}

  public current(): CorrelationContext | undefined {
    return this.storage.getStore();
  }

  public run<TValue>(context: CorrelationContext, operation: () => TValue): TValue {
    return this.storage.run(context, operation);
  }
}

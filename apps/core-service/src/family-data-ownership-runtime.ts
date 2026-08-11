import type { CoreServiceFamilyDataStatusContract } from '@ppt/core-service-contracts';

export interface CoreServiceFamilyDataSessionPort {
  readonly mode: 'read-only' | 'read-write';
  close(): Promise<void> | void;
}

export class CoreServiceFamilyDataOwnershipError extends Error {
  public readonly code: 'SESSION_ALREADY_ATTACHED' | 'SESSION_INVALID' | 'SESSION_CLOSE_FAILED';

  public constructor(code: 'SESSION_ALREADY_ATTACHED' | 'SESSION_INVALID' | 'SESSION_CLOSE_FAILED', message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = 'CoreServiceFamilyDataOwnershipError';
    this.code = code;
  }
}

export class CoreServiceFamilyDataOwnershipRuntime {
  readonly #clock: () => string;
  #lifecycle: CoreServiceFamilyDataStatusContract['lifecycle'] = 'detached';
  #mode: CoreServiceFamilyDataStatusContract['mode'] = 'none';
  #epoch = 0;
  #session: CoreServiceFamilyDataSessionPort | undefined;
  #reasons: string[] = ['PROTECTED_SESSION_NOT_ATTACHED'];

  public constructor(clock: () => string = () => new Date().toISOString()) {
    this.#clock = clock;
  }

  public status(): CoreServiceFamilyDataStatusContract {
    const owner = this.#lifecycle === 'ready' || this.#lifecycle === 'sealing' ? 'core-service' : 'desktop-transition';
    return Object.freeze({
      schemaVersion: 1,
      owner,
      lifecycle: this.#lifecycle,
      mode: this.#mode,
      writable: this.#lifecycle === 'ready' && this.#mode === 'read-write',
      epoch: this.#epoch,
      protectedSessionAttached: this.#session !== undefined,
      persistentPathExposed: false,
      reasons: Object.freeze([...this.#reasons]),
      observedAt: this.#clock()
    });
  }

  public attach(session: CoreServiceFamilyDataSessionPort): CoreServiceFamilyDataStatusContract {
    if (this.#session || this.#lifecycle === 'attaching' || this.#lifecycle === 'ready' || this.#lifecycle === 'sealing') {
      throw new CoreServiceFamilyDataOwnershipError('SESSION_ALREADY_ATTACHED', 'A protected family-data session is already attached');
    }
    if (!session || !['read-only', 'read-write'].includes(session.mode) || typeof session.close !== 'function') {
      throw new CoreServiceFamilyDataOwnershipError('SESSION_INVALID', 'Protected family-data session port is invalid');
    }
    this.#epoch += 1;
    this.#lifecycle = 'attaching';
    this.#mode = 'none';
    this.#reasons = ['ATTACHMENT_IN_PROGRESS'];
    this.#session = session;
    this.#epoch += 1;
    this.#lifecycle = 'ready';
    this.#mode = session.mode;
    this.#reasons = [];
    return this.status();
  }

  public async seal(): Promise<CoreServiceFamilyDataStatusContract> {
    if (!this.#session) return this.status();
    const session = this.#session;
    this.#epoch += 1;
    this.#lifecycle = 'sealing';
    this.#reasons = ['SESSION_SEALING'];
    try {
      await session.close();
      this.#session = undefined;
      this.#epoch += 1;
      this.#lifecycle = 'sealed';
      this.#mode = 'none';
      this.#reasons = ['PROTECTED_SESSION_SEALED'];
      return this.status();
    } catch (error) {
      this.#session = undefined;
      this.#epoch += 1;
      this.#lifecycle = 'failed';
      this.#mode = 'none';
      this.#reasons = ['SESSION_CLOSE_FAILED'];
      throw new CoreServiceFamilyDataOwnershipError('SESSION_CLOSE_FAILED', 'Protected family-data session could not be sealed', { cause: error });
    }
  }
}

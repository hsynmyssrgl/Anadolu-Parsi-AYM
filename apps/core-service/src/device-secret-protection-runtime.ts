import type { CoreServiceDeviceSecretProtectionStatusContract } from '@ppt/core-service-contracts';
import type { DeviceSecretProtector } from '@ppt/security';

export class CoreServiceDeviceSecretProtectionError extends Error {
  public readonly code: 'PROTECTOR_ALREADY_ATTACHED' | 'PROTECTOR_INVALID';

  public constructor(code: 'PROTECTOR_ALREADY_ATTACHED' | 'PROTECTOR_INVALID', message: string) {
    super(message);
    this.name = 'CoreServiceDeviceSecretProtectionError';
    this.code = code;
  }
}

export class CoreServiceDeviceSecretProtectionRuntime {
  readonly #clock: () => string;
  #protector: DeviceSecretProtector | undefined;

  public constructor(clock: () => string = () => new Date().toISOString()) {
    this.#clock = clock;
  }

  public attach(protector: DeviceSecretProtector): CoreServiceDeviceSecretProtectionStatusContract {
    if (this.#protector) {
      throw new CoreServiceDeviceSecretProtectionError('PROTECTOR_ALREADY_ATTACHED', 'A device-secret protector is already attached');
    }
    if (
      !protector
      || typeof protector.protectionId !== 'string'
      || protector.protectionId.trim() !== protector.protectionId
      || protector.protectionId.length < 1
      || protector.protectionId.length > 128
      || typeof protector.required !== 'boolean'
      || typeof protector.isAvailable !== 'function'
      || typeof protector.protect !== 'function'
      || typeof protector.unprotect !== 'function'
    ) {
      throw new CoreServiceDeviceSecretProtectionError('PROTECTOR_INVALID', 'Device-secret protector port is invalid');
    }
    this.#protector = protector;
    return this.status();
  }

  public status(): CoreServiceDeviceSecretProtectionStatusContract {
    const protector = this.#protector;
    if (!protector) {
      return Object.freeze({
        schemaVersion: 1,
        owner: 'detached',
        lifecycle: 'detached',
        providerId: null,
        required: false,
        available: false,
        secretMaterialExposed: false,
        electronDependency: false,
        reasons: Object.freeze(['DEVICE_SECRET_PROTECTOR_NOT_ATTACHED']),
        observedAt: this.#clock()
      });
    }
    let available = false;
    try { available = protector.isAvailable(); } catch { available = false; }
    return Object.freeze({
      schemaVersion: 1,
      owner: 'core-service',
      lifecycle: available ? 'ready' : 'unavailable',
      providerId: protector.protectionId,
      required: protector.required,
      available,
      secretMaterialExposed: false,
      electronDependency: false,
      reasons: Object.freeze(available ? [] : ['DEVICE_SECRET_PROTECTOR_UNAVAILABLE']),
      observedAt: this.#clock()
    });
  }
}

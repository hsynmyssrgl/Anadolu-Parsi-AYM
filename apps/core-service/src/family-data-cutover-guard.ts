import type {
  CoreServiceFamilyDataCutoverGateId,
  CoreServiceFamilyDataCutoverStatusContract
} from '@ppt/core-service-contracts';

export const CORE_SERVICE_FAMILY_DATA_CUTOVER_REQUIRED_GATES = Object.freeze([
  'END_TO_END_SECURITY_VALIDATION',
  'KEY_LIFECYCLE_PROOF',
  'SINGLE_WRITER_PROOF',
  'ROLLBACK_DRILL',
  'EXPLICIT_USER_CUTOVER_APPROVAL'
] as const satisfies readonly CoreServiceFamilyDataCutoverGateId[]);

export class CoreServiceFamilyDataCutoverError extends Error {
  public readonly code = 'FAMILY_DATA_CUTOVER_BLOCKED' as const;

  public constructor() {
    super('Family-data cutover is blocked while the legacy Desktop vault remains authoritative');
    this.name = 'CoreServiceFamilyDataCutoverError';
  }
}

export class CoreServiceFamilyDataCutoverGuard {
  readonly #clock: () => string;

  public constructor(clock: () => string = () => new Date().toISOString()) {
    this.#clock = clock;
  }

  public status(): CoreServiceFamilyDataCutoverStatusContract {
    return Object.freeze({
      schemaVersion: 1,
      mode: 'coexistence-no-cutover',
      decision: 'blocked',
      cutoverEpoch: 0,
      legacyDesktopDataActive: true,
      realDataTransferAllowed: false,
      writeOwnershipTransferAllowed: false,
      automaticActivationAllowed: false,
      cutoverAuthorityAttached: false,
      persistentPathExposed: false,
      secretMaterialExposed: false,
      requiredGates: Object.freeze(CORE_SERVICE_FAMILY_DATA_CUTOVER_REQUIRED_GATES.map((id) => Object.freeze({ id, status: 'pending' as const }))),
      reasons: Object.freeze([
        'LEGACY_DESKTOP_DATA_REMAINS_AUTHORITATIVE',
        'ALL_CUTOVER_ACCEPTANCE_GATES_ARE_REQUIRED'
      ]),
      observedAt: this.#clock()
    });
  }

  public assertSessionAttachmentAllowed(): never {
    throw new CoreServiceFamilyDataCutoverError();
  }
}

import { asUserId, type Clock } from '@ppt/core';
import type {
  AuthSessionPort,
  AuthSessionSnapshot,
  DeviceProof,
  DeviceProofVerifier,
  PasswordService,
  SecondFactorService,
  SecondFactorSetupMaterial,
  SecondFactorVerification
} from '@ppt/application';
import {
  InMemorySessionManager,
  consumeRecoveryCode,
  createOtpAuthUri,
  createTotpSetupMaterial,
  hashPassword,
  verifyDeviceProof,
  verifyPassword,
  verifyTotpCode,
  type PasswordRecord
} from '@ppt/security';

const parseRecoveryCodeHashes = (value: string | undefined): string[] => {
  if (!value) return [];
  try {
    const parsed: unknown = JSON.parse(value);
    return Array.isArray(parsed)
      ? parsed.filter((item): item is string => typeof item === 'string')
      : [];
  } catch {
    return [];
  }
};

export class NodePasswordService implements PasswordService {
  public hash(password: string): string {
    return JSON.stringify(hashPassword(password));
  }

  public verify(password: string, serializedRecord: string): boolean {
    try {
      return verifyPassword(password, JSON.parse(serializedRecord) as PasswordRecord);
    } catch {
      return false;
    }
  }
}

export class NodeSecondFactorService implements SecondFactorService {
  public constructor(private readonly issuer = 'Anadolu Parsı Aile Yaşam Merkezi') {}

  public createSetup(accountEmail: string): SecondFactorSetupMaterial {
    const material = createTotpSetupMaterial();
    return {
      secret: material.secret,
      recoveryCodes: material.recoveryCodes,
      serializedRecoveryCodeHashes: JSON.stringify(material.recoveryCodeHashes),
      otpauthUri: createOtpAuthUri({
        issuer: this.issuer,
        accountName: accountEmail,
        secret: material.secret
      })
    };
  }

  public verifyTotp(secret: string, code: string, occurredAt: ReturnType<Clock['now']>): boolean {
    return verifyTotpCode(secret, code, Date.parse(occurredAt));
  }

  public verify(
    secret: string,
    recoveryCodes: string | undefined,
    code: string,
    occurredAt: ReturnType<Clock['now']>
  ): SecondFactorVerification {
    if (this.verifyTotp(secret, code, occurredAt)) return { valid: true, method: 'totp' };
    const consumed = consumeRecoveryCode(parseRecoveryCodeHashes(recoveryCodes), code);
    return consumed.valid
      ? {
          valid: true,
          method: 'recovery',
          remainingRecoveryCodes: JSON.stringify(consumed.remainingHashes)
        }
      : { valid: false };
  }
}

export class NodeDeviceProofVerifier implements DeviceProofVerifier {
  public verify(publicKeyPem: string, proof: DeviceProof): boolean {
    return verifyDeviceProof(publicKeyPem, proof);
  }
}

export class InMemoryAuthSessionPort implements AuthSessionPort {
  readonly #manager: InMemorySessionManager;

  public constructor(clock: Clock, idleTimeoutMinutes: number) {
    this.#manager = new InMemorySessionManager(clock, idleTimeoutMinutes);
  }

  public start(accountId: ReturnType<typeof asUserId>, securityEpoch = 0): void {
    this.#manager.start(accountId, securityEpoch);
  }

  public clear(): void {
    this.#manager.clear();
  }

  public currentAccountId(options?: { readonly touch?: boolean }): ReturnType<typeof asUserId> | undefined {
    const accountId = this.#manager.currentAccountId(options);
    return accountId ? asUserId(accountId) : undefined;
  }

  public snapshot(): AuthSessionSnapshot {
    const snapshot = this.#manager.snapshot();
    return snapshot.active
      ? {
          active: true,
          ...(snapshot.accountId === undefined ? {} : { accountId: snapshot.accountId }),
          ...(snapshot.expiresAt === undefined ? {} : { expiresAt: snapshot.expiresAt }),
          ...(snapshot.securityEpoch === undefined ? {} : { securityEpoch: snapshot.securityEpoch })
        }
      : { active: false };
  }
}

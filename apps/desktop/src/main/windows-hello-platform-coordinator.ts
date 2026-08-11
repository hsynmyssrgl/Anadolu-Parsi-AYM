import {
  WINDOWS_HELLO_VERIFICATION_MESSAGE,
  type WindowsHelloPlatformAssessment,
  type WindowsHelloPlatformPort,
  type WindowsHelloPlatformVerification
} from '@ppt/application';

const PREPARED_VERIFICATION_TTL_MS = 30_000;
const principalHashPattern = /^[a-f0-9]{64}$/u;
const vaultGrantAuthority = Symbol('windows-hello-vault-grant-authority');

export interface WindowsHelloVaultGrantBinding {
  readonly deviceId: string;
  readonly deviceFingerprint: string;
  readonly senderId: number;
  readonly requestId: string;
  readonly correlationId: string;
}

export interface ConsumedWindowsHelloVaultUnlockGrant extends WindowsHelloVaultGrantBinding {
  readonly windowsPrincipalHash: string;
}

export class WindowsHelloVaultUnlockGrant {
  #consumed = false;

  public constructor(
    authority: symbol,
    private readonly binding: WindowsHelloVaultGrantBinding,
    private readonly windowsPrincipalHash: string,
    private readonly expiresAt: number,
    private readonly now: () => number
  ) {
    if (authority !== vaultGrantAuthority) {
      throw new Error('Windows Hello kasa açma izni yalnız koordinatör tarafından üretilebilir.');
    }
  }

  public consume(expected: WindowsHelloVaultGrantBinding): ConsumedWindowsHelloVaultUnlockGrant {
    if (this.#consumed) throw new Error('Windows Hello kasa açma izni daha önce kullanıldı.');
    this.#consumed = true;
    if (this.now() > this.expiresAt) throw new Error('Windows Hello kasa açma izninin süresi doldu.');
    if (
      expected.deviceId !== this.binding.deviceId
      || expected.deviceFingerprint !== this.binding.deviceFingerprint
      || expected.senderId !== this.binding.senderId
      || expected.requestId !== this.binding.requestId
      || expected.correlationId !== this.binding.correlationId
    ) {
      throw new Error('Windows Hello kasa açma izninin istek bağı geçersiz.');
    }
    if (!principalHashPattern.test(this.windowsPrincipalHash)) {
      throw new Error('Windows Hello kasa açma izninin kullanıcı bağı geçersiz.');
    }
    return {
      ...this.binding,
      windowsPrincipalHash: this.windowsPrincipalHash
    };
  }
}

export interface PreparedWindowsHelloVerification {
  readonly assessment: WindowsHelloPlatformAssessment;
  readonly verification?: WindowsHelloPlatformVerification;
  readonly replayPlatform?: WindowsHelloPlatformPort;
  readonly releaseReplay?: () => void;
  readonly vaultUnlockGrant?: WindowsHelloVaultUnlockGrant;
}

export type WindowsHelloVerificationCapture = symbol;

class PreparedWindowsHelloReplayPlatform implements WindowsHelloPlatformPort {
  #consumed = false;
  #released = false;
  #invalidated = false;
  #assessment: WindowsHelloPlatformAssessment | undefined;
  #verification: WindowsHelloPlatformVerification | undefined;

  public constructor(
    private readonly delegate: WindowsHelloPlatformPort,
    assessment: WindowsHelloPlatformAssessment,
    verification: WindowsHelloPlatformVerification,
    private readonly expiresAt: number,
    private readonly now: () => number
  ) {
    this.#assessment = assessment;
    this.#verification = verification;
  }

  public releaseAfterConsumption(): void {
    this.#released = this.#consumed;
    this.#invalidated = !this.#consumed;
    this.#assessment = undefined;
    this.#verification = undefined;
  }

  public async assessAvailability(): Promise<WindowsHelloPlatformAssessment> {
    if (this.#released) return this.delegate.assessAvailability();
    if (this.#invalidated) {
      return { availability: 'error', diagnosticCode: 'prepared_verification_invalidated' };
    }
    if (this.#consumed) {
      return { availability: 'error', diagnosticCode: 'prepared_verification_replayed' };
    }
    if (this.now() > this.expiresAt) {
      return { availability: 'error', diagnosticCode: 'prepared_verification_expired' };
    }
    return this.#assessment ?? { availability: 'error', diagnosticCode: 'prepared_verification_missing' };
  }

  public async requestVerification(message: string): Promise<WindowsHelloPlatformVerification> {
    if (this.#released) return this.delegate.requestVerification(message);
    if (this.#invalidated) {
      return { outcome: 'error', diagnosticCode: 'prepared_verification_invalidated' };
    }
    if (this.#consumed) {
      return { outcome: 'error', diagnosticCode: 'prepared_verification_replayed' };
    }
    this.#consumed = true;
    if (this.now() > this.expiresAt) {
      return { outcome: 'error', diagnosticCode: 'prepared_verification_expired' };
    }
    if (message !== WINDOWS_HELLO_VERIFICATION_MESSAGE) {
      return { outcome: 'error', diagnosticCode: 'prepared_prompt_mismatch' };
    }
    return this.#verification ?? { outcome: 'error', diagnosticCode: 'prepared_verification_missing' };
  }
}

const unavailableVerification = (
  assessment: WindowsHelloPlatformAssessment
): WindowsHelloPlatformVerification => ({
  outcome: assessment.availability === 'available' ? 'error' : assessment.availability,
  ...(assessment.diagnosticCode ? { diagnosticCode: assessment.diagnosticCode } : {})
});

export class WindowsHelloPlatformCoordinator implements WindowsHelloPlatformPort {
  #capture: {
    readonly token: WindowsHelloVerificationCapture;
    verification?: WindowsHelloPlatformVerification;
  } | undefined;

  public constructor(
    private readonly delegate: WindowsHelloPlatformPort,
    private readonly now: () => number = Date.now
  ) {}

  public beginVerificationCapture(): WindowsHelloVerificationCapture {
    if (this.#capture) throw new Error('Başka bir Windows Hello doğrulama yakalaması devam ediyor.');
    const token = Symbol('windows-hello-verification-capture');
    this.#capture = { token };
    return token;
  }

  public finishVerificationCapture(
    token: WindowsHelloVerificationCapture
  ): WindowsHelloPlatformVerification | undefined {
    if (!this.#capture || this.#capture.token !== token) {
      throw new Error('Windows Hello doğrulama yakalaması eşleşmiyor.');
    }
    const verification = this.#capture.verification;
    this.#capture = undefined;
    return verification;
  }

  public cancelVerificationCapture(token: WindowsHelloVerificationCapture): void {
    if (this.#capture?.token === token) this.#capture = undefined;
  }

  public async prepareLoginVerification(
    binding: WindowsHelloVaultGrantBinding
  ): Promise<PreparedWindowsHelloVerification> {
    if (this.#capture) throw new Error('Windows Hello doğrulama yakalaması sırasında giriş hazırlanamaz.');
    const assessment = await this.delegate.assessAvailability();
    if (assessment.availability !== 'available') {
      return { assessment, verification: unavailableVerification(assessment) };
    }
    if (!principalHashPattern.test(assessment.windowsPrincipalHash ?? '')) {
      const invalidAssessment: WindowsHelloPlatformAssessment = {
        availability: 'error',
        diagnosticCode: 'assessment_principal_hash_missing_or_invalid'
      };
      return { assessment: invalidAssessment, verification: unavailableVerification(invalidAssessment) };
    }
    const verification = await this.delegate.requestVerification(WINDOWS_HELLO_VERIFICATION_MESSAGE);
    if (verification.outcome !== 'verified' || !principalHashPattern.test(verification.windowsPrincipalHash ?? '')) {
      return { assessment, verification };
    }
    if (verification.windowsPrincipalHash !== assessment.windowsPrincipalHash) {
      return {
        assessment,
        verification: { outcome: 'error', diagnosticCode: 'principal_changed_during_prompt' }
      };
    }
    const expiresAt = this.now() + PREPARED_VERIFICATION_TTL_MS;
    const replay = new PreparedWindowsHelloReplayPlatform(
      this,
      assessment,
      verification,
      expiresAt,
      this.now
    );
    return {
      assessment,
      verification,
      replayPlatform: replay,
      releaseReplay: () => replay.releaseAfterConsumption(),
      vaultUnlockGrant: new WindowsHelloVaultUnlockGrant(
        vaultGrantAuthority,
        binding,
        verification.windowsPrincipalHash!,
        expiresAt,
        this.now
      )
    };
  }

  public async assessAvailability(): Promise<WindowsHelloPlatformAssessment> {
    return this.delegate.assessAvailability();
  }

  public async requestVerification(message: string): Promise<WindowsHelloPlatformVerification> {
    const verification = await this.delegate.requestVerification(message);
    if (this.#capture) this.#capture.verification = verification;
    return verification;
  }
}

import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const app = readFileSync('apps/desktop/src/renderer/App.tsx', 'utf8');
const styles = readFileSync('apps/desktop/src/renderer/styles.css', 'utf8');
const center = app.slice(app.indexOf('function IdentityAccessCredentialCenter('), app.indexOf('function SettingsSecurity('));

describe('33-P identity, access and temporary credential UI', () => {
  it('extends the existing security route as one center', () => {
    expect(app).toContain('active === SECURITY_CENTER_ROUTE');
    expect(app.match(/<IdentityAccessCredentialCenter trustedDevices=\{devices\}\/>/gu)).toHaveLength(1);
    expect(app).not.toContain("id: 'identity-access'");
    expect(center).toContain('Kimlik, passkey ve geçici yetki merkezi');
    expect(app).toContain('const identityAccessBridge=()=>window.pardus??null;');
    expect(app).not.toContain('interface IdentityAccessCredentialBridge');
  });

  it('covers passkey register, assertion, revoke and strong lost recovery without renderer proof identifiers', () => {
    expect(app).toContain('globalThis.navigator.credentials.create');
    expect(app).toContain('globalThis.navigator.credentials.get');
    expect(app).toContain('challengeForPasskey(receivedChallenge,passkey.credentialIdSha256)');
    expect(center).toContain('completePasskeyRegistration({expectedRevision:operation.expectedRevision');
    expect(center).toContain('authenticateWithPasskey({expectedRevision:operation.expectedRevision');
    expect(center).toContain("reason:'manual',confirmation:'PASSKEY YETKISINI IPTAL ET'");
    expect(center).toContain("recoveryMethod==='windows_hello'");
    expect(center).toContain("recoveryMethod==='password_fallback'");
    expect(center).toContain('Güçlü kanıtı main process üretir; kullanıcıdan kanıt kimliği alınmaz.');
    expect(center).not.toContain('recoveryProofId');
    expect(center).not.toContain('ceremonyResponseId');
    expect(center).toContain('Uygulama biyometrik örnek istemez, yakalamaz veya saklamaz.');
    expect(center).toContain('uzak attestation, resmi kimlik veya hukuk sertifikasyonu yapılmaz');
  });

  it('retains lost-recovery identity but never retains password or second-factor secrets', () => {
    const recovery = center.slice(center.indexOf('const recoverLostPasskey='), center.indexOf('const startFederated='));
    expect(app).toContain('interface PendingLostPasskeyPayload {\n  readonly credentialId:string;\n}');
    expect(recovery).toContain('payload=Object.freeze({credentialId});operation=rememberOperation(key,operation,payload)');
    expect(recovery).not.toContain('payload.fallback');
    expect(recovery).toContain("finally{setRecoveryPassword('');setRecoverySecondFactorCode('');setBusy('');}");
    expect(recovery).toContain('parola fallback kullanıyorsanız sırrı yeniden girin');
  });

  it('persists a begun WebAuthn challenge before browser ceremony and rotates it only after expiry', () => {
    const register = center.slice(center.indexOf('const registerPasskey='), center.indexOf('const authenticatePasskey='));
    const authenticate = center.slice(center.indexOf('const authenticatePasskey='), center.indexOf('const recoverLostPasskey='));
    expect(register.indexOf('beginPasskeyRegistration')).toBeLessThan(register.indexOf('rememberOperation(key,operation,payload)'));
    expect(register.indexOf('rememberOperation(key,operation,payload)')).toBeLessThan(register.indexOf('createPasskeyRegistrationResponse'));
    expect(authenticate.indexOf('beginPasskeyAuthentication')).toBeLessThan(authenticate.indexOf('rememberOperation(key,operation,payload)'));
    expect(authenticate.indexOf('rememberOperation(key,operation,payload)')).toBeLessThan(authenticate.indexOf('createPasskeyAuthenticationResponse'));
    for (const source of [register, authenticate]) {
      expect(source).toContain('Date.parse(operation.payload.challenge.expiresAt)<=Date.now()');
      expect(source).toContain('pendingOperations.current.delete(key);operation=await stableOperation(');
      expect(source).toContain('Süresi dolmamış challenge');
    }
  });

  it('shows only configured providers but does not misuse productionReady as a start gate', () => {
    expect(center).toContain('setProviders(nextProviders.filter(item=>item.configured))');
    expect(center).toContain('const configuredProviders=providers.filter(item=>item.configured)');
    expect(center).toContain('disabled={Boolean(busy)||linked||flowActive}');
    expect(center).not.toContain('!provider.productionReady');
    expect(center).toContain('PKCE bağlantısını başlat');
    expect(center).toContain('canlı hesap henüz doğrulanmadı');
    expect(center).toContain('completeFederatedIdentityLink({expectedRevision:operation.expectedRevision');
    expect(center).not.toContain('verifiedFlowId');
    expect(center).not.toContain('callbackUrl');
    expect(center).not.toContain('federatedCallback');
    expect(center).toContain('code ve state renderer’a girilmez veya gösterilmez');
    expect(center).toContain('Uygulamaya dönüşü doğrula ve bağla');
    expect(center).toContain('token exchange, imza, issuer, audience, state ve nonce doğrulamasından sonra');
  });

  it('offers every governed minimum-disclosure temporary credential and offline QR lifecycle', () => {
    for (const kind of ['school_pickup','temporary_caregiver','pet_caregiver','emergency_contact_health','event_invitation','temporary_home_access']) expect(app).toContain(`kind:'${kind}'`);
    expect(center).toContain('TEMPORARY_CREDENTIAL_DISCLOSURE_RULES[temporaryKind]');
    expect(center).toContain('TEMPORARY_CREDENTIAL_PURPOSE_BY_KIND[temporaryKind]');
    expect(center).toContain('Hedef kişi / bağlam');
    expect(center).toContain('Bitiş zamanı');
    expect(center).toContain('issueTemporaryVerifiableCredential({expectedRevision:operation.expectedRevision');
    expect(center).toContain('verifyTemporaryVerifiableCredential({qrPayload:qrPayload.trim(),expectedAudienceReference:temporaryAudience.trim()})');
    expect(center).toContain('Self-signed imza, süre, hedef');
    expect(center).toContain('revokeTemporaryVerifiableCredential({expectedRevision:operation.expectedRevision');
    expect(center).toContain('uzak iptal güncelliği garanti edilmez');
    expect(center).toContain('Bu payload resmi kimlik veya hukuki yetki sertifikası değildir.');
    expect(center).toContain('İlk hedef, disclosure, süre ve aynı işlem kimliği');
  });

  it('exposes read-only companion creation and an explicit write-denial probe', () => {
    expect(center).toContain("createCompanion('read_only')");
    expect(center).toContain("createCompanion('write')");
    expect(center).toContain('createReadOnlyCompanionSnapshot({clientOperationId:operation.clientOperationId');
    expect(center).toContain('Windows tek yazardır.');
    expect(center).toContain('uzak yazma, çatışma birleştirme veya ağ teslimi yoktur');
    expect(center).toContain('Yazma reddini doğrula');
  });

  it('has governed loading, error, empty, retry and pending-operation states', () => {
    expect(center).toContain('AsyncStatePanel state="loading" title="Kimlik ve geçici yetki merkezi yükleniyor"');
    expect(center).toContain('AsyncStatePanel state="error" title="Kimlik ve geçici yetki merkezi yüklenemedi"');
    expect(center).toContain('AsyncStatePanel state="empty" title="Kimlik ve geçici yetki merkezi boş"');
    expect(center).toContain('onRetry={load}');
    expect(center).toContain('const current=pendingOperations.current.get(key)');
    expect(center).toContain('issueIdentityAccessOperationToken(operationKind)');
    expect(center).toContain('ikinci gönderim kilitli ve retry kimliği korunuyor');
  });

  it('provides responsive, keyboard-sized product styling', () => {
    for (const selector of ['.identity-access-center','.identity-access-grid','.identity-access-card','.identity-truth-strip','.temporary-claim-grid','.identity-record']) expect(styles).toContain(selector);
    expect(styles).toContain('.identity-access-card .button { min-height:44px; }');
    expect(styles).toContain('.identity-form-grid,.temporary-claim-grid,.identity-recovery-fallback{grid-template-columns:1fr}');
  });
});

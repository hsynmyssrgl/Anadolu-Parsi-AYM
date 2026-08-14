import { readFileSync } from 'node:fs';
import { describe,expect,it } from 'vitest';

const source=(path:string)=>readFileSync(new URL(`../${path}`,import.meta.url),'utf8');
const main=source('src/main/main.ts');
const preload=source('src/main/preload.ts');
const globalDeclaration=source('src/renderer/global.d.ts');
const repository=source('../../packages/repositories/src/identity-access-credential-repository.ts');

const channels=[
  'identityAccess:getCenter','identityAccess:issueOperationToken','identityAccess:beginPasskeyRegistration','identityAccess:beginPasskeyAuthentication',
  'identityAccess:completePasskeyRegistration','identityAccess:authenticateWithPasskey','identityAccess:revokePasskey',
  'identityAccess:recoverLostPasskey','identityAccess:beginFederatedIdentityLink','identityAccess:completeFederatedIdentityLink',
  'identityAccess:unlinkFederatedIdentity','identityAccess:issueTemporaryCredential','identityAccess:revokeTemporaryCredential',
  'identityAccess:verifyTemporaryCredential','identityAccess:createCompanionSnapshot'
] as const;

describe('33-P main-only identity access bridge and production composition',()=>{
  it('exposes each of the fifteen governed channels exactly once through main and preload',()=>{
    for(const channel of channels){
      expect(main.match(new RegExp(`registerIpcHandler\\('${channel.replace(/[.*+?^${}()|[\]\\]/gu,'\\$&')}'`,'gu'))).toHaveLength(1);
      expect(preload.match(new RegExp(`invoke\\('${channel.replace(/[.*+?^${}()|[\]\\]/gu,'\\$&')}'`,'gu'))).toHaveLength(1);
    }
    expect(globalDeclaration).toContain('getIdentityAccessCredentialCenter()');
    expect(globalDeclaration).toContain('issueIdentityAccessOperationToken(operationKind:');
    expect(globalDeclaration).toContain('createReadOnlyCompanionSnapshot(input:');
  });

  it('keeps authority, RP/origin and one-time ceremony identities in main',()=>{
    const bridgeTypes=preload.slice(preload.indexOf('export interface CompletePasskeyRegistrationIpcInput'),preload.indexOf('export interface EncryptedPrivacyDataExportIpcResult'));
    expect(bridgeTypes).not.toMatch(/readonly (?:accountId|familyId|ownerPersonId|deviceId|relyingPartyId|origin|vault|privateKey|token|ceremonyResponseId|verifiedFlowId|recoveryProofId|callbackUrl)\s*:/u);
    expect(main).toContain("const IDENTITY_WEBAUTHN_RP_ID='renderer'");
    expect(main).toContain('const ceremonyResponseId=randomUUID()');
    expect(main).toContain('const recoveryProofId=passkeyRecoveryRegistry.issue(accountId)');
    expect(main).toContain('linkId:input.flowId');
    expect(main).toContain('verifiedFlowId:input.flowId');
    expect(main).toContain('new MainOnlyOidcDeepLinkCallbackRegistry');
    expect(main).toContain('oidcDeepLinkCallbacks.take({flowId:input.flowId');
    expect(main).toContain('callbackUrl:captured.callbackUrl');
    expect(main).toContain("app.setAsDefaultProtocolClient('pardus-app')");
    expect(main).toContain("app.on('second-instance', (_event,commandLine)");
    expect(main).toContain("app.on('open-url'");
  });

  it('composes bounded production adapters and hides incomplete provider configuration',()=>{
    expect(main).toContain('new WebAuthnCeremonyAdapter');
    expect(main).toContain('new ProtectedTemporaryCredentialEnvelopeAdapter');
    expect(main).toContain('new X25519EncryptedCompanionSnapshotAdapter');
    expect(main).toContain('new OidcFederatedIdentityAdapter');
    expect(main).toContain('new FileSystemOidcVaultPersistence');
    expect(main).toContain('new SecureOidcNetworkAdapter');
    expect(main).toContain('secureOidcNetworkAdapter.networkReadyProviderRegistrations()');
    expect(main).toContain("provider==='apple'||clientAuthenticationMode!=='public_pkce'");
    expect(main).toContain('_TOKEN_SPKI_PRIMARY_SHA256`');
    expect(main).toContain('_JWKS_SPKI_PRIMARY_SHA256`');
    expect(main).not.toContain("throw new Error('Secure pinned OIDC network adapter is not configured.')");
    expect(main).not.toContain('net.fetch');
    expect(main).not.toContain('boundedOidcFetch');
    expect(main).not.toMatch(/PPT_OIDC_(?:APPLE|GOOGLE|MICROSOFT)_READY/u);
    expect(main).toContain('productionReady:false');
    expect(main).toContain('oidcDeepLinkProtocolRegistered?oidcFederatedIdentity?.listVisibleConfiguredProviders()??[]:[]');
    expect(main).not.toContain("Companion snapshot source projection is unavailable.");
    expect(main).not.toContain('source:{load:');
    expect(main).toContain('const expiresAt=issuedOidcAuthorizationUrls.get(url)');
    expect(main).not.toContain('if (isSafeExternalHttpsUrl(url)) void shell.openExternal(url)');
  });

  it('provisions only content-free trusted provider hashes and disables removed environment entries',()=>{
    expect(repository).toContain('provisionFederatedProviderConfigurations');
    expect(repository).toContain("for(const provider of providers)");
    expect(repository).toContain("row?1:0");
    expect(repository).not.toMatch(/provisionFederatedProviderConfigurations[\s\S]{0,1800}(?:access_token|refresh_token|id_token|client_secret)/u);
    expect(main).toContain('authorizationEndpointSha256:createHash');
    expect(main).toContain('configuration,clientConfigurationSha256');
    expect(main).toContain('clientConfigurationSha256}');
  });
});

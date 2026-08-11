import assert from 'node:assert/strict';
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';

const reportPath='artifacts/validation/30-L-windows-hello-ipc-ui-contract.json';
rmSync(reportPath,{force:true});
const files={
  decision:'docs/decisions/DEC-136-b2-01-windows-hello-ipc-ui-menu.md',
  domain:'packages/domain/src/windows-hello.ts',
  main:'apps/desktop/src/main/main.ts',
  lifecycle:'apps/desktop/src/main/ipc-request-lifecycle.ts',
  ipcRuntime:'apps/desktop/src/main/ipc-runtime.ts',
  policy:'apps/desktop/src/main/ipc-integration-policy.ts',
  coordinator:'apps/desktop/src/main/windows-hello-platform-coordinator.ts',
  vault:'apps/desktop/src/main/user-data-vault.ts',
  preload:'apps/desktop/src/main/preload.ts',
  global:'apps/desktop/src/renderer/global.d.ts',
  renderer:'apps/desktop/src/renderer/App.tsx',
  styles:'apps/desktop/src/renderer/styles.css',
  package:'package.json'
};
const source=Object.fromEntries(Object.entries(files).map(([key,path])=>[key,readFileSync(path,'utf8')]));
const checks=[];
const contains=(value,token,label)=>{assert.equal(value.includes(token),true,`${label}: ${token}`);checks.push(label);};

for(const [channel,preloadMethod,globalMethod] of [
  ['auth:getWindowsHelloState','getWindowsHelloState:():Promise<WindowsHelloStateView>','getWindowsHelloState():Promise<WindowsHelloStateView>'],
  ['auth:enrollWindowsHello','enrollWindowsHello:(input:EnrollWindowsHelloInput):Promise<WindowsHelloEnrollmentView>','enrollWindowsHello(input:EnrollWindowsHelloInput):Promise<WindowsHelloEnrollmentView>'],
  ['auth:loginWithWindowsHello','loginWithWindowsHello:(input:LoginWithWindowsHelloInput):Promise<WindowsHelloAuthenticationView>','loginWithWindowsHello(input:LoginWithWindowsHelloInput):Promise<WindowsHelloAuthenticationView>'],
  ['auth:reauthenticateWithWindowsHello','reauthenticateWithWindowsHello:(input:ReauthenticateWithWindowsHelloInput):Promise<WindowsHelloAuthenticationView>','reauthenticateWithWindowsHello(input:ReauthenticateWithWindowsHelloInput):Promise<WindowsHelloAuthenticationView>']
]){
  contains(source.main,`registerIpcHandler('${channel}'`,`main registers trusted correlated ${channel}`);
  contains(source.preload,`invoke('${channel}'`,`preload exposes ${channel}`);
  contains(source.preload,preloadMethod,`preload strongly types ${channel}`);
  contains(source.global,globalMethod,`renderer declaration strongly types ${channel}`);
  assert.equal(source.main.includes(`ipcMain.handle('${channel}'`),false,`${channel} bypasses trusted registration`);
  checks.push(`${channel} never bypasses trusted correlated registration`);
}

contains(source.preload,"'auth:loginWithWindowsHello'",'Hello login is a renderer session-boundary channel');
contains(source.policy,"case 'auth:getWindowsHelloState':\n      return zeroArguments(args);",'locked and authenticated state channel accepts no renderer account selector');
contains(source.policy,"value.accountId === undefined || boundedString(value.accountId, 128)",'Hello login accepts an absent or bounded account hint and no fallback injection');
contains(source.policy,"exactObject(args, ['password', 'secondFactorCode', 'displayName']",'enrollment payload has an exact bounded shape');
contains(source.policy,"exactObject(args, ['fallback']",'reauthentication fallback has an exact bounded shape');

contains(source.lifecycle,"'auth:loginWithWindowsHello'",'interactive Hello channels have cancellable lifecycle policy');
contains(source.lifecycle,'latestWins: false, timeoutMs: 180_000','interactive Hello cancellation cannot be replaced by a newer request');
contains(source.lifecycle,'getIpcRequestContext','request identity is bound to the invoke event');
contains(source.ipcRuntime,'bindEvent(event, requestLease.signal, requestLease.request)','trusted runtime binds signal and request identity together');

for(const token of ['PREPARED_VERIFICATION_TTL_MS = 30_000','vaultGrantAuthority','expected.senderId !== this.binding.senderId','expected.requestId !== this.binding.requestId','expected.correlationId !== this.binding.correlationId','prepared_verification_replayed','principal_changed_during_prompt','releaseAfterConsumption','#verification = undefined']){
  contains(source.coordinator,token,`coordinator enforces ${token}`);
}
contains(source.vault,'input.grant.consume(input.requestBinding)','vault consumes the exact main-process request binding');
contains(source.vault,'windowsHelloKeySlots: [{ id, protectedEnvelope }]','vault header stores only an opaque Hello slot');
contains(source.vault,'clearWindowsHelloKeySlots','vault can retire the single unusable cold-login slot');
const headerSlot=source.vault.slice(source.vault.indexOf('interface WindowsHelloVaultKeySlot'),source.vault.indexOf('interface WindowsHelloVaultKeyPayload'));
assert.equal(/accountId|registrationId|deviceId|windowsPrincipalHash|dataKeyBase64/u.test(headerSlot),false,'Hello header slot exposes protected metadata');
checks.push('Hello header slot exposes no account, registration, device, principal or data key metadata');

for(const token of ['currentWindowsHelloRequestBinding','requireActiveIpcRequest(signal)','platform.prepareLoginVerification(requestBinding)','postPromptDevice.deviceId !== initialDevice.deviceId','unlockWithWindowsHello({','requestBinding','selected_account_does_not_match_vault_slot','result.registration?.id === unlocked.registrationId','result.registration.securityEpoch === unlocked.securityEpoch','prepared.releaseReplay?.()','userVault.clearWindowsHelloKeySlots()']){
  contains(source.main,token,`cold login enforces ${token}`);
}
contains(source.main,"throw new Error('Windows Hello işlemi sürerken parola girişi başlatılamaz.')",'password login cannot race the native prompt');
contains(source.main,"throw new Error('Windows Hello işlemi sürerken oturum kapatılamaz.')",'logout cannot race the native prompt');
contains(source.main,'registrationCreated && dataStore','post-registration enrollment errors trigger volatile-session rollback');
contains(source.main,'finally { vault().discardSession(); }','enrollment and failed-login cleanup always discard the vault key');
contains(source.main,'finally { sealUserDataSession(); }','logout reseals in a finally boundary');
contains(source.main,'userVault.discardSession();\n  try { session.close(); }','seal failure still discards the key and closes the volatile session');

contains(source.renderer,"label: 'Windows Hello'",'sidebar and command search expose Windows Hello');
contains(source.renderer,"active === 'windows-hello'",'application renders the Windows Hello route');
contains(source.renderer,"navigateFromShell('windows-hello')",'profile menu exposes Windows Hello');
contains(source.renderer,'onWindowsHelloLogin(selectedAccountId?{accountId:selectedAccountId}:{})','selected profile is an optional account hint and the locked vault slot remains usable without profiles');
assert.equal(source.renderer.includes("helloBusy||!selectedAccountId||helloState.availability"),false,'locked-start Hello login is not disabled by unavailable profile metadata');
contains(source.renderer,'disabled={busy||helloBusy}','password submit is disabled while Hello is active');
contains(source.renderer,"auth.twoFactorEnabled&&!enrollmentCode.trim()",'enrollment UI requires the configured second factor');
contains(source.renderer,"auth.twoFactorEnabled&&!fallbackCode.trim()",'explicit fallback UI requires the configured second factor');
contains(source.renderer,'Hello olmazsa parola ile devam et','fallback wording states that Hello is attempted first');
const helloScreen=source.renderer.slice(source.renderer.indexOf('function WindowsHelloScreen'),source.renderer.indexOf('function SettingsSecurity'));
assert.equal(/auth\.role|role\s*===\s*['"]family_admin/u.test(helloScreen),false,'renderer makes a Windows Hello authorization decision');
checks.push('Windows Hello renderer delegates authorization without role comparison');
for(const outcome of ['cancelled','retries_exhausted','device_busy','registration_not_found','device_changed','principal_changed','security_epoch_changed','account_unavailable','fallback_required','error'])contains(source.renderer,`${outcome}:`,`${outcome} has an explicit user message`);
for(const token of ['.windows-hello-workspace','.windows-hello-status-list','.windows-hello-reauth','.windows-hello-fallback'])contains(source.styles,token,`responsive styles expose ${token}`);

contains(source.decision,'UserConsentVerifier` kriptografik anahtar üretmez','decision preserves the process-gated DPAPI limitation');
contains(source.decision,'PARTIAL_IPC_UI_MENU_COMPLETE_NATIVE_INTERACTIVE_PENDING','decision keeps B2-01 partial without native evidence');
contains(source.package,'verify:30-l:windows-hello-ipc-ui-contract','package exposes the 30-L contract gate');
contains(source.package,'verify:30-l:windows-hello-ipc-ui-runtime','package exposes the 30-L controlled runtime gate');

const report={schemaVersion:1,release:'Bronze 04.08.2026.29',step:'30-L',requirement:'B2-01',status:'PASS',checkCount:checks.length,checks,assertions:{trustedCorrelatedIpc:'PASS',strictPayloadPolicy:'PASS',requestBoundGrant:'PASS',singleUseReplay:'PASS',vaultBinding:'PASS',failureCleanup:'PASS',typedRendererBridge:'PASS',visibleUiAndMenu:'PASS',explicitFallback:'PASS',nativeInteractiveWindowsHello:'NOT_RUN_NOT_PASS'},evidenceBoundary:{nativePromptExecuted:false,nativeAuthenticationPassClaimed:false},generatedAt:new Date().toISOString()};
mkdirSync('artifacts/validation',{recursive:true});
writeFileSync(reportPath,`${JSON.stringify(report,null,2)}\n`);
console.log(`30-L Windows Hello IPC/UI contract: PASS (${checks.length} checks).`);

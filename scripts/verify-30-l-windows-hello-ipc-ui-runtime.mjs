import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const reportPath='artifacts/validation/30-L-windows-hello-ipc-ui-runtime.json';
rmSync(reportPath,{force:true});
const compiled=resolve('.tmp/30-l-windows-hello-desktop');
const {evaluateIpcIntegrationPolicy}=await import(pathToFileURL(join(compiled,'ipc-integration-policy.js')).href);
const {WindowsHelloPlatformCoordinator,WindowsHelloVaultUnlockGrant}=await import(pathToFileURL(join(compiled,'windows-hello-platform-coordinator.js')).href);
const {UserDataVault,WindowsHelloVaultUnlockError}=await import(pathToFileURL(join(compiled,'user-data-vault.js')).href);
const prompt='Anadolu Parsı Aile Yaşam Merkezi için kimliğinizi doğrulayın.';
const principalA='a'.repeat(64),principalB='b'.repeat(64),fingerprintA='f'.repeat(64),fingerprintB='e'.repeat(64);
const checks=[];
const check=(label,operation)=>{operation();checks.push(label);};
const accepted=(label,channel,args)=>check(label,()=>assert.equal(evaluateIpcIntegrationPolicy(channel,args).accepted,true));
const rejected=(label,channel,args)=>check(label,()=>assert.equal(evaluateIpcIntegrationPolicy(channel,args).accepted,false));

accepted('state accepts zero arguments','auth:getWindowsHelloState',[]);
rejected('state rejects renderer account selector','auth:getWindowsHelloState',['account-1']);
accepted('enrollment accepts bounded password code and display name','auth:enrollWindowsHello',[{password:'strong-password',secondFactorCode:'123456',displayName:'Ana cihaz'}]);
rejected('enrollment rejects empty password','auth:enrollWindowsHello',[{password:''}]);
rejected('enrollment rejects unknown fields','auth:enrollWindowsHello',[{password:'strong-password',principalHash:principalA}]);
rejected('enrollment rejects oversized display name','auth:enrollWindowsHello',[{password:'strong-password',displayName:'x'.repeat(121)}]);
accepted('login accepts one bounded account hint','auth:loginWithWindowsHello',[{accountId:'account-1'}]);
accepted('login accepts an absent account hint for locked-start vault discovery','auth:loginWithWindowsHello',[{}]);
rejected('login rejects explicit fallback injection','auth:loginWithWindowsHello',[{accountId:'account-1',fallback:{password:'secret'}}]);
rejected('login rejects empty account hint','auth:loginWithWindowsHello',[{accountId:''}]);
rejected('login rejects extra arguments','auth:loginWithWindowsHello',[{accountId:'account-1'},{}]);
accepted('reauthentication accepts an explicit bounded fallback','auth:reauthenticateWithWindowsHello',[{fallback:{password:'strong-password',secondFactorCode:'123456'}}]);
rejected('reauthentication rejects empty fallback password','auth:reauthenticateWithWindowsHello',[{fallback:{password:''}}]);

class ControlledPlatform{
  constructor(principal=principalA){this.assessmentPrincipal=principal;this.verificationPrincipal=principal;this.availability='available';this.nextOutcome='verified';this.assessmentCalls=0;this.verificationCalls=0;}
  async assessAvailability(){this.assessmentCalls+=1;return {availability:this.availability,...(this.availability==='available'?{windowsPrincipalHash:this.assessmentPrincipal}:{}),diagnosticCode:'controlled_30_l'};}
  async requestVerification(){this.verificationCalls+=1;const outcome=this.nextOutcome;this.nextOutcome='verified';return {outcome,...(outcome==='verified'?{windowsPrincipalHash:this.verificationPrincipal}:{}),diagnosticCode:'controlled_30_l'};}
}
const binding={deviceId:'device-a',deviceFingerprint:fingerprintA,senderId:41,requestId:'request-30-l',correlationId:'ipc-30-l'};
let now=1_000;
const platform=new ControlledPlatform();
const coordinator=new WindowsHelloPlatformCoordinator(platform,()=>now);
const capture=coordinator.beginVerificationCapture();
check('a concurrent enrollment capture is rejected',()=>assert.throws(()=>coordinator.beginVerificationCapture()));
await coordinator.requestVerification(prompt);
const captured=coordinator.finishVerificationCapture(capture);
check('enrollment capture returns the exact verified principal',()=>{assert.equal(captured?.outcome,'verified');assert.equal(captured?.windowsPrincipalHash,principalA);});

const loginPlatform=new ControlledPlatform();
const loginCoordinator=new WindowsHelloPlatformCoordinator(loginPlatform,()=>now);
const prepared=await loginCoordinator.prepareLoginVerification(binding);
check('login preparation uses exactly one controlled prompt',()=>{assert.equal(loginPlatform.assessmentCalls,1);assert.equal(loginPlatform.verificationCalls,1);assert.ok(prepared.vaultUnlockGrant);assert.ok(prepared.replayPlatform);});
const replayAssessment=await prepared.replayPlatform.assessAvailability();
const replayVerification=await prepared.replayPlatform.requestVerification(prompt);
check('prepared replay returns the exact assessment and verification',()=>{assert.equal(replayAssessment.availability,'available');assert.equal(replayVerification.outcome,'verified');assert.equal(replayVerification.windowsPrincipalHash,principalA);});
const replayedAgain=await prepared.replayPlatform.requestVerification(prompt);
check('second replay fails closed without another prompt',()=>{assert.equal(replayedAgain.outcome,'error');assert.equal(replayedAgain.diagnosticCode,'prepared_verification_replayed');assert.equal(loginPlatform.verificationCalls,1);});

const directory=mkdtempSync(join(tmpdir(),'ppt-30-l-windows-hello-'));
let unprotectCalls=0;
const protector={protectionId:'controlled-dpapi',isAvailable:()=>true,protect:(value)=>Buffer.from(`dpapi:${value}`,'utf8').toString('base64'),unprotect:(value)=>{unprotectCalls+=1;const decoded=Buffer.from(value,'base64').toString('utf8');if(!decoded.startsWith('dpapi:'))throw new Error('protector mismatch');return decoded.slice(6);}};
const paths={headerPath:join(directory,'secrets','vault.json'),containerPath:join(directory,'data','family.pptvault'),protector};
const password='30L-Güçlü-Kasa-Parolası!2026',changedPassword='30L-Yeni-Güçlü-Kasa-Parolası!2026';
const secret=Buffer.from('SQLITE-CONTROLLED-30-L-SECRET','utf8');
let vault=new UserDataVault(paths);
try{
  vault.initialize(password);vault.markInitializationCommitted();vault.checkpoint(secret);
  const slotId=vault.registerWindowsHelloKeySlot({accountId:'account-1',registrationId:'registration-1',deviceId:binding.deviceId,deviceFingerprint:binding.deviceFingerprint,windowsPrincipalHash:principalA,securityEpoch:7});
  vault.replacePassword(changedPassword);
  const headerText=readFileSync(paths.headerPath,'utf8');
  const header=JSON.parse(headerText);
  check('header contains exactly one opaque Hello slot',()=>{assert.equal(header.windowsHelloKeySlots.length,1);assert.deepEqual(Object.keys(header.windowsHelloKeySlots[0]).sort(),['id','protectedEnvelope']);assert.equal(header.windowsHelloKeySlots[0].id,slotId);});
  check('header exposes no protected identity or data material',()=>{for(const value of ['account-1','registration-1',binding.deviceId,binding.deviceFingerprint,principalA,password,changedPassword,'SQLITE-CONTROLLED-30-L-SECRET','dataKeyBase64'])assert.equal(headerText.includes(value),false,value);});
  vault.discardSession();
  vault=new UserDataVault(paths);
  check('old password is rejected after rotation',()=>assert.throws(()=>vault.unlock(password)));
  const passwordBytes=vault.unlock(changedPassword);
  check('new password still opens the same protected database',()=>assert.equal(passwordBytes.toString('utf8'),secret.toString('utf8')));
  passwordBytes.fill(0);vault.discardSession();

  const unprotectBeforeForgery=unprotectCalls;
  const forged=Object.create(WindowsHelloVaultUnlockGrant.prototype);
  check('forged grant is rejected before protector unprotect',()=>{assert.throws(()=>vault.unlockWithWindowsHello({grant:forged,requestBinding:binding}),WindowsHelloVaultUnlockError);assert.equal(unprotectCalls,unprotectBeforeForgery);});
  const helloBytes=vault.unlockWithWindowsHello({grant:prepared.vaultUnlockGrant,requestBinding:binding});
  check('exact grant opens exact account registration epoch and database bytes',()=>{assert.equal(helloBytes.accountId,'account-1');assert.equal(helloBytes.registrationId,'registration-1');assert.equal(helloBytes.securityEpoch,7);assert.equal(helloBytes.databaseBytes.toString('utf8'),secret.toString('utf8'));});
  helloBytes.databaseBytes.fill(0);vault.discardSession();
  check('the same grant cannot be consumed twice',()=>assert.throws(()=>vault.unlockWithWindowsHello({grant:prepared.vaultUnlockGrant,requestBinding:binding}),WindowsHelloVaultUnlockError));
  prepared.releaseReplay();
  const independentVerification=await prepared.replayPlatform.requestVerification(prompt);
  check('released wrapper clears cached proof and delegates a later independent prompt',()=>{assert.equal(independentVerification.outcome,'verified');assert.equal(loginPlatform.verificationCalls,2);});

  const wrongRequestPrepared=await new WindowsHelloPlatformCoordinator(new ControlledPlatform(),()=>now).prepareLoginVerification({...binding,requestId:'request-original'});
  const beforeWrongRequest=unprotectCalls;
  check('request-bound grant rejects a different request before unprotect',()=>{assert.throws(()=>vault.unlockWithWindowsHello({grant:wrongRequestPrepared.vaultUnlockGrant,requestBinding:{...binding,requestId:'request-other'}}),WindowsHelloVaultUnlockError);assert.equal(unprotectCalls,beforeWrongRequest);});

  const expiringPrepared=await new WindowsHelloPlatformCoordinator(new ControlledPlatform(),()=>now).prepareLoginVerification({...binding,requestId:'request-expiring'});
  now+=30_001;
  check('expired grant is rejected before vault unprotect',()=>assert.throws(()=>vault.unlockWithWindowsHello({grant:expiringPrepared.vaultUnlockGrant,requestBinding:{...binding,requestId:'request-expiring'}}),WindowsHelloVaultUnlockError));
  now=1_000;

  const devicePrepared=await new WindowsHelloPlatformCoordinator(new ControlledPlatform(),()=>now).prepareLoginVerification({...binding,deviceId:'device-b',deviceFingerprint:fingerprintB,requestId:'request-device'});
  check('device mismatch fails closed',()=>assert.throws(()=>vault.unlockWithWindowsHello({grant:devicePrepared.vaultUnlockGrant,requestBinding:{...binding,deviceId:'device-b',deviceFingerprint:fingerprintB,requestId:'request-device'}}),(error)=>error instanceof WindowsHelloVaultUnlockError&&error.failure==='device_changed'));

  const principalPlatform=new ControlledPlatform(principalB);
  const principalPrepared=await new WindowsHelloPlatformCoordinator(principalPlatform,()=>now).prepareLoginVerification({...binding,requestId:'request-principal'});
  check('principal mismatch fails closed',()=>assert.throws(()=>vault.unlockWithWindowsHello({grant:principalPrepared.vaultUnlockGrant,requestBinding:{...binding,requestId:'request-principal'}}),(error)=>error instanceof WindowsHelloVaultUnlockError&&error.failure==='principal_changed'));

  const changedDuringPromptPlatform=new ControlledPlatform(principalA);changedDuringPromptPlatform.verificationPrincipal=principalB;
  const changedDuringPrompt=await new WindowsHelloPlatformCoordinator(changedDuringPromptPlatform,()=>now).prepareLoginVerification({...binding,requestId:'request-principal-race'});
  check('principal change during prompt produces no grant or replay',()=>{assert.equal(changedDuringPrompt.verification?.diagnosticCode,'principal_changed_during_prompt');assert.equal(changedDuringPrompt.vaultUnlockGrant,undefined);assert.equal(changedDuringPrompt.replayPlatform,undefined);});

  const cancelledPlatform=new ControlledPlatform();cancelledPlatform.nextOutcome='cancelled';
  const cancelled=await new WindowsHelloPlatformCoordinator(cancelledPlatform,()=>now).prepareLoginVerification({...binding,requestId:'request-cancelled'});
  check('cancelled verification produces no grant or replay',()=>{assert.equal(cancelled.verification?.outcome,'cancelled');assert.equal(cancelled.vaultUnlockGrant,undefined);assert.equal(cancelled.replayPlatform,undefined);});

  vault.clearWindowsHelloKeySlots();
  check('retired single slot is no longer advertised',()=>assert.equal(vault.hasWindowsHelloKeySlots(),false));

  const report={schemaVersion:1,release:'Bronze 04.08.2026.29',step:'30-L',requirement:'B2-01',status:'PASS',checkCount:checks.length,checks,assertions:{ipcPayloadPolicy:'PASS',captureExclusivity:'PASS',requestBoundGrant:'PASS',singleUseReplay:'PASS',passwordContinuity:'PASS',opaqueVaultHeader:'PASS',accountRegistrationEpochBinding:'PASS',forgeryReplayAndExpiryRejection:'PASS',deviceAndPrincipalMismatch:'PASS',cancellation:'PASS',nativeInteractiveWindowsHello:'NOT_RUN_NOT_PASS'},evidenceBoundary:{controlledPlatformIsSimulation:true,nativePromptExecuted:false,nativeAuthenticationPassClaimed:false},metrics:{controlledAssessmentCalls:loginPlatform.assessmentCalls,controlledVerificationCalls:loginPlatform.verificationCalls},generatedAt:new Date().toISOString()};
  mkdirSync('artifacts/validation',{recursive:true});writeFileSync(reportPath,`${JSON.stringify(report,null,2)}\n`);console.log(`30-L Windows Hello IPC/UI runtime: PASS (${checks.length} checks).`);
}finally{
  secret.fill(0);try{vault?.discardSession();}catch{/* preserve primary result */}rmSync(directory,{recursive:true,force:true,maxRetries:5,retryDelay:100});
}

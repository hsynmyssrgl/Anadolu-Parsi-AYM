import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
const args=process.argv.slice(2),option=(n,f)=>{const i=args.indexOf(n);return i<0?f:args[i+1];};
const reportPath=resolve(option('--report','artifacts/validation/build172-ipc-adaptive-budget-maintenance-reauthentication-state-lifecycle-contract.json'));
const [state,guard,main,adr,security,build171Contract]=await Promise.all([
  readFile('apps/desktop/src/main/ipc-adaptive-budget-maintenance-reauthentication-state.ts','utf8'),
  readFile('apps/desktop/src/main/ipc-adaptive-budget-maintenance-reauthentication-guard.ts','utf8'),
  readFile('apps/desktop/src/main/main.ts','utf8'),
  readFile('docs/adr/ADR-045-device-bound-maintenance-reauthentication-state-lifecycle.md','utf8'),
  readFile('SECURITY.md','utf8'),
  readFile('scripts/verify-build171-ipc-adaptive-budget-maintenance-reauthentication-persistence-contract.mjs','utf8')
]);
const failures=[];let assertions=0;const verify=(condition,message)=>{assertions+=1;if(!condition)failures.push(message);};
for(const [needle,label] of [
  ["| 'UNAVAILABLE'",'restore status exposes unavailable'],
  ["'PROTECTION_UNAVAILABLE'",'unavailable classification'],
  ["'PROTECTION_PROVIDER_CHANGED'",'provider change classification'],
  ["'DEVICE_BINDING_CHANGED'",'device binding change classification'],
  ["'DECRYPTION_FAILED'",'decryption classification'],
  ["'PAYLOAD_INTEGRITY_FAILED'",'integrity classification'],
  ["interface ProtectedStateEnvelopeV2",'version two envelope'],
  ["readonly deviceBindingSha256: string",'device binding field'],
  ["schemaVersion: 2",'version two writer'],
  ["encoding: 'base64'",'explicit protected encoding'],
  ["requiresRewrite?: boolean",'legacy rewrite signal'],
  ["LEGACY_OS_PROTECTED_STATE_RESTORED",'legacy restore reason'],
  ["requiresRewrite: true",'legacy rewrite request'],
  ["OS_PROTECTION_TEMPORARILY_UNAVAILABLE",'transient unavailable reason'],
  ["if (!protector.isAvailable())",'availability checked before quarantine'],
  ["return Object.freeze({\n        status: 'UNAVAILABLE'",'unavailable state retained'],
  ["sameHash(parsed.protection.deviceBindingSha256, this.#resolveDeviceBinding())",'binding checked timing safe'],
  ["throw new StateRestoreError('DEVICE_BINDING_CHANGED'",'binding mismatch fail closed'],
  ["secureEraseFile",'secure erase helper'],
  ["randomFillSync",'random overwrite'],
  ["writeSync",'in place overwrite'],
  ["fsyncSync(descriptor)",'erase durability flush'],
  ["secureEraseFile(this.#statePath",'active state secure clear'],
  ["secureEraseFile(stale.path",'quarantine secure pruning'],
  ["maximumBytes",'erase bounded by size'],
  ["STATE_REJECTED_AND_QUARANTINED",'rejected state quarantine'],
  ["#reject(error",'central rejection classification'],
  ["#resolveDeviceBinding",'binding resolver'],
  ["HASH_PATTERN.test(binding)",'binding strict hash format'],
  ["UNBOUND_DEVICE_BINDING",'backward-compatible default binding'],
  ["validEnvelopeV1",'legacy envelope parser'],
  ["validEnvelopeV2",'current envelope parser'],
  ["validCommonEnvelopeFields",'common envelope validation'],
  ["payloadSha256",'payload integrity remains'],
  ["timingSafeEqual",'constant-time digest comparison'],
  ["maximumQuarantineFiles",'bounded quarantine retained']
]) verify(state.includes(needle),label);
for(const [needle,label] of [
  ["result.requiresRewrite === true",'guard rewrites legacy state'],
  ["result.status === 'UNAVAILABLE'",'guard handles transient unavailability'],
  ["this.#recoveryHoldUntil = now + this.#lockDurationMs",'unavailable fail-closed hold'],
  ["classification?:",'restore classification exposed'],
  ["stateRewriteCompleted?: boolean",'rewrite completion exposed'],
  ["result.classification",'classification propagated'],
  ["stateRewriteCompleted: true",'rewrite completion propagated']
]) verify(guard.includes(needle),label);
for(const [needle,label] of [
  ["maintenanceReauthenticationDeviceBinding",'main device binding resolver'],
  ["device-identity.json",'device identity source'],
  ["candidate.deviceId",'device id binding input'],
  ["candidate.fingerprint",'fingerprint binding input'],
  ["update(`${candidate.deviceId}\\u0000${candidate.fingerprint}`",'unambiguous binding material'],
  ["deviceBinding: () => maintenanceReauthenticationDeviceBinding()",'state store receives binding'],
  ["store();\n  const maintenanceReauthenticationRestore",'device identity initialized before restore'],
  ["classification: maintenanceReauthenticationRestore.classification",'privacy-safe classification audit'],
  ["stateRewriteCompleted",'rewrite audit metadata'],
  ["protectionTemporarilyUnavailable",'availability audit metadata']
]) verify(main.includes(needle),label);
for(const [needle,label] of [
  ['safeStorage','ADR retains OS protection'],
  ['cihaz bağlama','ADR device binding decision'],
  ['geçici olarak kullanılamadığında','ADR transient availability behavior'],
  ['karantinaya','ADR quarantine behavior'],
  ['güvenli silme','ADR secure deletion behavior'],
  ['şema 1','ADR legacy migration'],
  ['şema 2','ADR current envelope']
]) verify(adr.toLowerCase().includes(needle.toLowerCase()),label);
for(const [needle,label] of [
  ['Build 172','security build marker'],
  ['cihaz bağlamına','security device binding disclosure'],
  ['geçici koruma kesintisi','security transient outage disclosure'],
  ['güvenli silme','security erasure disclosure']
]) verify(security.toLowerCase().includes(needle.toLowerCase()),label);
verify(build171Contract.includes('featureBuild:171'),'Build 171 contract preserved');
verify(!state.toLowerCase().includes('password:'),'state code excludes password field');
verify(!state.toLowerCase().includes('totp:'),'state code excludes TOTP field');
verify(!state.includes('deviceId:'),'envelope does not persist raw device id');
verify(!state.includes('fingerprint:'),'envelope does not persist raw fingerprint');
const report={schemaVersion:1,product:'Anadolu Parsı Aile Yaşam Merkezi',featureBuild:172,stage:'Bronze RC2 Active Development',scope:'Device-bound versioned lifecycle for OS-protected adaptive IPC maintenance reauthentication state, transient protection outage preservation, legacy migration and bounded secure erasure',assertions,status:failures.length?'FAIL':'PASS',failures,generatedAt:new Date().toISOString()};
await mkdir(dirname(reportPath),{recursive:true});await writeFile(reportPath,`${JSON.stringify(report,null,2)}\n`);
if(failures.length){console.error(`Build 172 maintenance reauthentication state lifecycle contract: FAIL (${assertions-failures.length}/${assertions})`);for(const failure of failures)console.error(`- ${failure}`);process.exitCode=1;}else console.log(`Build 172 maintenance reauthentication state lifecycle contract: PASS (${assertions}/${assertions}).`);

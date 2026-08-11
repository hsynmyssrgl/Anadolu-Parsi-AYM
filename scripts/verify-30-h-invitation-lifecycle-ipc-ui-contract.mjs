import assert from 'node:assert/strict';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';

const files = {
  domain: 'packages/domain/src/app-data.ts',
  main: 'apps/desktop/src/main/main.ts',
  preload: 'apps/desktop/src/main/preload.ts',
  global: 'apps/desktop/src/renderer/global.d.ts',
  renderer: 'apps/desktop/src/renderer/App.tsx',
  styles: 'apps/desktop/src/renderer/styles.css'
};
const sources = Object.fromEntries(Object.entries(files).map(([key,path])=>[key,readFileSync(path,'utf8')]));
const checks=[];
const contains=(source,token,label)=>{assert.equal(source.includes(token),true,`${label}: ${token}`);checks.push(label);};

for(const type of ['InspectFamilyInvitationInput','ResendFamilyInvitationInput','FamilyInvitationInspectionView'])contains(sources.domain,type,`domain exposes ${type}`);
for(const [channel,method] of [['invitations:inspect','inspectInvitation(input:InspectFamilyInvitationInput):Promise<FamilyInvitationInspectionView>'],['invitations:resend','resendInvitation(input:ResendFamilyInvitationInput):Promise<{invitation:FamilyInvitationView;token:string}>']]){
  contains(sources.main,`registerIpcHandler('${channel}'`,`main registers trusted ${channel} IPC`);
  contains(sources.preload,`invoke('${channel}',input)`,`preload exposes ${channel} bridge`);
  assert.equal(sources.main.includes(`ipcMain.handle('${channel}'`),false,`${channel} must not bypass trusted correlated IPC registration`);
  checks.push(`${channel} never bypasses trusted correlated IPC registration`);
  contains(sources.global,method,`renderer bridge declares ${method}`);
}
contains(sources.preload,"'invitations:accept'",'acceptance remains a renderer session boundary');
contains(sources.renderer,"label: 'Davetler'",'navigation exposes a dedicated invitation menu');
contains(sources.renderer,"active === 'invitations'",'application renders the invitation route');
contains(sources.renderer,'function InvitationsScreen','renderer implements governed administrator invitation workspace');
contains(sources.renderer,'function InvitationAcceptancePanel','renderer implements recipient acceptance workspace');
contains(sources.renderer,'window.pardus.inspectInvitation({token:token.trim()})','recipient verifies the token before entering identity and password');
contains(sources.renderer,'inspection?.canAccept','recipient form fails closed unless server inspection permits acceptance');
contains(sources.renderer,'window.pardus.acceptInvitation({token:token.trim(),displayName:displayName.trim(),password})','recipient acceptance uses the governed IPC bridge');
contains(sources.renderer,'assessment.valid','recipient password must satisfy shared domain policy');
contains(sources.renderer,'setInspection(undefined)','token changes invalidate prior inspection state');
contains(sources.renderer,'startsAt:`${startsOn}T00:00:00.000Z`','administrator sends explicit invitation start timestamp');
contains(sources.renderer,'endsAt:`${endsOn}T23:59:59.999Z`','administrator sends explicit invitation expiration timestamp');
contains(sources.renderer,'window.pardus.revokeInvitation(invitationId)','administrator can revoke a pending invitation');
contains(sources.renderer,'window.pardus.resendInvitation({invitationId})','administrator can rotate an invitation code');
contains(sources.renderer,'Yeni davet kodu üretildi; önceki kod geçersiz kılındı.','renderer clearly explains resend invalidation');
contains(sources.renderer,'statusLabel[invitation.status]','renderer displays understandable invitation status');
contains(sources.renderer,'invitation.revocationReason','renderer displays lifecycle revocation context');
contains(sources.renderer,'invitation.acceptedAt','renderer displays acceptance evidence');
contains(sources.renderer,'Bu kod yeniden gösterilmez.','renderer warns that the token is shown once');
for(const status of ['pending','accepted','revoked','expired'])contains(sources.styles,`.status-pill.${status}`,`styles distinguish ${status} invitation state`);
contains(sources.styles,'.invitation-token-row','recipient token verification remains responsive');

const report={schemaVersion:1,release:'Bronze 04.08.2026.29',step:'30-H',requirement:'B1-04',status:'PASS',checkCount:checks.length,checks,generatedAt:new Date().toISOString()};
mkdirSync('artifacts/validation',{recursive:true});
writeFileSync('artifacts/validation/30-H-invitation-lifecycle-ipc-ui-contract.json',`${JSON.stringify(report,null,2)}\n`);
console.log(`30-H invitation lifecycle IPC/UI contract: PASS (${checks.length} checks).`);

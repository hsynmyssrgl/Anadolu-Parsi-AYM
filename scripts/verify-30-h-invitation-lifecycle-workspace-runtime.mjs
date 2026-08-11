import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { FamilyDataStore } from '../.tmp/data-store-smoke/data-store.js';
import { FixedClock, asIsoDateTime } from '../packages/core/dist/index.js';

const root=mkdtempSync(join(tmpdir(),'ppt-30-h-invitation-workspace-'));
const clock=new FixedClock(asIsoDateTime('2026-08-05T15:00:00.000Z'));
const adminPassword='30HGuvenliYonetici!2026';
const checks=[];
const check=(name,operation)=>{operation();checks.push(name);};
let store;
try{
  store=new FamilyDataStore({databasePath:join(root,'family.db'),deviceIdentityPath:join(root,'device'),migrationBackupDirectory:join(root,'migration-backups'),applicationVersion:'04.08.2026.29',clock});
  store.setupAdmin({displayName:'Davet Yöneticisi',email:'admin-30h@example.test',password:adminPassword});

  const issued=store.createInvitation({email:'recipient-30h@example.test',role:'adult_member',startsAt:'2026-08-05T14:00:00.000Z',endsAt:'2026-08-12T23:59:59.999Z'});
  check('administrator workspace lists the newly issued invitation',()=>assert.equal(store.listInvitations().some(item=>item.id===issued.invitation.id&&item.status==='pending'),true));
  check('recipient inspection exposes readiness and dates without identity',()=>assert.deepEqual(store.inspectInvitation({token:issued.token}),{resolution:'ready',canAccept:true,message:'Davet kullanıma hazır.',startsAt:'2026-08-05T14:00:00.000Z',endsAt:'2026-08-12T23:59:59.999Z'}));
  check('invalid recipient token returns a safe generic error',()=>assert.deepEqual(store.inspectInvitation({token:'not-a-real-token'}),{resolution:'invalid',canAccept:false,message:'Davet kodu geçersiz.'}));

  const rotated=store.resendInvitation({invitationId:issued.invitation.id});
  check('administrator resend rotates the visible one-time code',()=>assert.notEqual(rotated.token,issued.token));
  check('old recipient code becomes explicitly superseded without date disclosure',()=>assert.deepEqual(store.inspectInvitation({token:issued.token}),{resolution:'revoked',canAccept:false,message:'Bu davet yerine yeni bir kod gönderilmiş.'}));
  check('rotated recipient code is ready for acceptance',()=>assert.equal(store.inspectInvitation({token:rotated.token}).canAccept,true));
  check('old code cannot be accepted after resend',()=>assert.throws(()=>store.acceptInvitation({token:issued.token,displayName:'Eski Kod',password:'30HEskiKodGuvenli!2026'}),/yeni bir kod gönderilmiş/));

  const recipientState=store.acceptInvitation({token:rotated.token,displayName:'Davet Alıcısı',password:'30HDavetAlicisi!2026'});
  check('recipient acceptance starts the new local profile session',()=>assert.deepEqual({authenticated:recipientState.authenticated,displayName:recipientState.displayName,role:recipientState.role},{authenticated:true,displayName:'Davet Alıcısı',role:'adult_member'}));
  check('accepted token becomes a used token',()=>assert.deepEqual(store.inspectInvitation({token:rotated.token}),{resolution:'used',canAccept:false,message:'Davet daha önce kullanılmış.'}));
  check('accepted profile cannot open administrator invitation list',()=>assert.throws(()=>store.listInvitations(),/Bu işlem aile yöneticisi yetkisi gerektirir/));

  store.logout();store.login({email:'admin-30h@example.test',password:adminPassword});
  check('administrator sees predecessor and accepted successor lifecycle',()=>{
    const rows=store.listInvitations();const previous=rows.find(item=>item.id===issued.invitation.id);const current=rows.find(item=>item.id===rotated.invitation.id);
    assert.deepEqual({status:previous?.status,reason:previous?.revocationReason,successor:previous?.supersededByInvitationId},{status:'revoked',reason:'resent',successor:rotated.invitation.id});
    assert.deepEqual({status:current?.status,predecessor:current?.resentFromInvitationId,acceptedAt:current?.acceptedAt},{status:'accepted',predecessor:issued.invitation.id,acceptedAt:'2026-08-05T15:00:00.000Z'});
  });

  const revoked=store.createInvitation({email:'revoked-30h@example.test',role:'caregiver',startsAt:'2026-08-05T15:00:00.000Z',endsAt:'2026-08-10T15:00:00.000Z'});
  store.revokeInvitation(revoked.invitation.id);
  check('administrator revocation immediately blocks recipient acceptance',()=>assert.deepEqual(store.inspectInvitation({token:revoked.token}).resolution,'revoked'));
  const replacement=store.resendInvitation({invitationId:revoked.invitation.id});
  check('manually revoked invitation can be replaced by a fresh code',()=>assert.deepEqual({ready:store.inspectInvitation({token:replacement.token}).canAccept,predecessor:replacement.invitation.resentFromInvitationId},{ready:true,predecessor:revoked.invitation.id}));

  const future=store.createInvitation({email:'future-30h@example.test',role:'limited_member',startsAt:'2026-08-06T15:00:00.000Z',endsAt:'2026-08-13T15:00:00.000Z'});
  check('future invitation renders a not-yet-active recipient state',()=>assert.deepEqual(store.inspectInvitation({token:future.token}).resolution,'not_yet_active'));
  const expired=store.createInvitation({email:'expired-30h@example.test',role:'advisor',startsAt:'2026-07-01T00:00:00.000Z',endsAt:'2026-07-08T00:00:00.000Z'});
  check('expired invitation renders an explicit expiration state',()=>assert.deepEqual(store.inspectInvitation({token:expired.token}).resolution,'expired'));
  check('all administrator and recipient lifecycle writes preserve audit integrity',()=>assert.equal(store.verifyAuditIntegrity().valid,true));

  const report={schemaVersion:1,release:'Bronze 04.08.2026.29',step:'30-H',requirement:'B1-04',status:'PASS',checkCount:checks.length,checks,assertions:{administratorWorkspace:'PASS',recipientInspection:'PASS',acceptance:'PASS',expiration:'PASS',revocation:'PASS',resend:'PASS',safeErrors:'PASS',authorizationBoundary:'PASS',auditIntegrity:'PASS'},generatedAt:new Date().toISOString()};
  mkdirSync('artifacts/validation',{recursive:true});
  writeFileSync('artifacts/validation/30-H-invitation-lifecycle-workspace-runtime.json',`${JSON.stringify(report,null,2)}\n`);
  console.log(`30-H invitation lifecycle workspace runtime: PASS (${checks.length} checks).`);
}finally{
  try{store?.close();}catch{/* preserve original verification result */}
  rmSync(root,{recursive:true,force:true,maxRetries:5,retryDelay:100});
}

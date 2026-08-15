import { DatabaseSync } from 'node:sqlite';
import { createHash } from 'node:crypto';
import { afterEach, describe, expect, it } from 'vitest';
import { asCorrelationId, asFamilyId, asIsoDateTime, asPersonId, asUserId } from '@ppt/core';
import { FAMILY_DATABASE_MIGRATIONS } from '@ppt/database';
import type { PolicyAuthorizedRepositoryExecutionContext,RepositoryExecutionContext } from '@ppt/repository-contracts';
import { SqliteIdentityAccessCredentialRepository } from './src/identity-access-credential-repository.js';

const NOW = '2026-08-14T08:00:00.000Z';
const FAMILY_ID = asFamilyId('family-33-p');
const PERSON_ID = asPersonId('person-33-p');
const ACCOUNT_ID = asUserId('account-33-p');
const SHA_A = 'a'.repeat(64);
const SHA_B = 'b'.repeat(64);
const databases: DatabaseSync[] = [];

afterEach(() => { for (const database of databases.splice(0)) database.close(); });

const migration93 = FAMILY_DATABASE_MIGRATIONS.find(({ version }) => version === 93);
if (!migration93) throw new Error('MIGRATION_93_NOT_FOUND');

const openFixture = (): DatabaseSync => {
  const database = new DatabaseSync(':memory:'); databases.push(database);
  database.exec(`
    PRAGMA foreign_keys=ON;
    CREATE TABLE families(id TEXT PRIMARY KEY);
    CREATE TABLE people(id TEXT PRIMARY KEY,family_id TEXT NOT NULL,status TEXT NOT NULL);
    CREATE TABLE accounts(id TEXT PRIMARY KEY,person_id TEXT NOT NULL,status TEXT NOT NULL,security_epoch INTEGER NOT NULL);
    CREATE TABLE trusted_devices(id TEXT PRIMARY KEY,account_id TEXT NOT NULL,device_id TEXT NOT NULL,security_epoch INTEGER NOT NULL,revoked_at TEXT);
    CREATE TABLE database_metadata(key TEXT PRIMARY KEY,value TEXT NOT NULL,updated_at TEXT NOT NULL);
    CREATE TABLE platform_policy_database_fences(fence_name TEXT PRIMARY KEY,epoch INTEGER NOT NULL,writable INTEGER NOT NULL);
    CREATE TABLE platform_policy_transaction_receipts(receipt_hash TEXT PRIMARY KEY,resource_type TEXT NOT NULL,resource_id TEXT NOT NULL,action TEXT NOT NULL,capability TEXT NOT NULL,fence_name TEXT NOT NULL,fence_epoch INTEGER NOT NULL,issued_at TEXT NOT NULL,recorded_at TEXT NOT NULL,record_json TEXT NOT NULL);
    CREATE TABLE platform_policy_journal_projection_outbox(receipt_hash TEXT PRIMARY KEY,record_json TEXT NOT NULL);
    INSERT INTO families VALUES('${FAMILY_ID}');
    INSERT INTO people VALUES('${PERSON_ID}','${FAMILY_ID}','active');
    INSERT INTO accounts VALUES('${ACCOUNT_ID}','${PERSON_ID}','active',7);
    INSERT INTO trusted_devices VALUES('trusted-33-p','${ACCOUNT_ID}','device-33-p',7,NULL);
    INSERT INTO database_metadata VALUES('schema_generation','before-33-p','${NOW}');
    INSERT INTO platform_policy_database_fences VALUES('33-p-write',93,1);
  `);
  database.exec(migration93.sql);
  return database;
};

let receiptSequence = 0;
const seedReceipt = (database: DatabaseSync, resourceType: string, resourceId: string, action: string, overrides: { accountId?: string; personId?: string; familyId?: string; purpose?: string; sensitivity?: string; occurredAt?: string } = {}): string => {
  receiptSequence += 1;
  const receiptHash = receiptSequence.toString(16).padStart(64,'0');
  const recordJson = JSON.stringify({ request: { subject: { accountId: overrides.accountId ?? ACCOUNT_ID, personId: overrides.personId ?? PERSON_ID },
    resource: { type: resourceType, id: resourceId, familyId: overrides.familyId ?? FAMILY_ID, ownerPersonId: overrides.personId ?? PERSON_ID,
      sensitivity: overrides.sensitivity ?? 'highly_sensitive' }, action, capability: 'family.write', purpose: overrides.purpose ?? 'administration' } });
  const occurredAt=overrides.occurredAt??NOW;
  database.prepare(`INSERT INTO platform_policy_transaction_receipts VALUES(?,?,?,?,?,'33-p-write',93,?,?,?)`).run(receiptHash,resourceType,resourceId,action,'family.write',occurredAt,occurredAt,recordJson);
  database.prepare(`INSERT INTO platform_policy_journal_projection_outbox VALUES(?,?)`).run(receiptHash,recordJson);
  return receiptHash;
};

const insertMutation = (database: DatabaseSync, input: { id: string; clientOperationId?: string; kind: string; resourceType?: string; resourceId: string; previousRevision?: number; revision?: number; stateFingerprint?: string; receiptHash: string; occurredAt?: string; familyId?: string; accountId?: string; personId?: string }): void => {
  const previousRevision=input.previousRevision??0;const revision=input.revision??previousRevision+1;
  database.prepare(`INSERT INTO identity_access_mutations(id,client_operation_id,request_fingerprint,state_fingerprint,family_id,account_id,owner_person_id,mutation_kind,resource_type,resource_id,previous_revision,revision,policy_receipt_hash,occurred_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)`)
    .run(input.id,input.clientOperationId??`${input.id}-operation`,SHA_A,input.stateFingerprint??SHA_B,input.familyId??FAMILY_ID,input.accountId??ACCOUNT_ID,input.personId??PERSON_ID,input.kind,input.resourceType??'passkey_credential',input.resourceId,previousRevision,revision,input.receiptHash,input.occurredAt??NOW);
};

const insertPasskey = (database: DatabaseSync, mutationId: string, receiptHash: string, revision = 1, signCount = 10, stateFingerprint = SHA_B, createdAt = NOW): void => {
  database.prepare(`INSERT INTO identity_passkey_credentials(id,family_id,account_id,owner_person_id,revision,display_name,credential_id,credential_id_sha256,public_key_cose_base64url,public_key_sha256,user_handle_sha256,relying_party_id,aaguid,transports_json,sign_count,backup_eligible,backup_state,trusted_device_id,security_epoch,status,created_at,last_used_at,revoked_at,revocation_reason,last_mutation_id,state_fingerprint,policy_receipt_hash) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`)
    .run('passkey-1',FAMILY_ID,ACCOUNT_ID,PERSON_ID,revision,'Security key','credential-public-id',SHA_A,'pQECAyYgASFYIA',SHA_B,'c'.repeat(64),'app.local',null,'["internal"]',signCount,0,0,'trusted-33-p',7,'active',createdAt,null,null,null,mutationId,stateFingerprint,receiptHash);
};

const insertTemporaryCredential = (database: DatabaseSync,input:{id:string;mutationId:string;receiptHash:string;issuedAt:string;expiresAt:string;reference:string;familyId?:string;accountId?:string;personId?:string;stateFingerprint?:string}):void=>{
  database.prepare(`INSERT INTO identity_temporary_credentials(id,family_id,account_id,owner_person_id,revision,kind,purpose,audience_ref_sha256,disclosed_claim_keys_json,disclosure_sha256,payload_sha256,signature_sha256,issuer_key_id,issuer_public_key_sha256,signature_algorithm,qr_payload_bytes,status,not_before,expires_at,issued_at,revoked_at,revocation_reason,encrypted_envelope_reference,last_mutation_id,state_fingerprint,policy_receipt_hash) VALUES(?,?,?,?,1,'school_pickup','school_pickup_authorization',?,'["subject_display_name","authorized_person_display_name"]',?,?,?,?,?,'Ed25519',512,'active',?,?,?,NULL,NULL,?,?,?,?)`)
    .run(input.id,input.familyId??FAMILY_ID,input.accountId??ACCOUNT_ID,input.personId??PERSON_ID,SHA_A,createHash('sha256').update(`disclosure:${input.id}`).digest('hex'),createHash('sha256').update(`payload:${input.id}`).digest('hex'),createHash('sha256').update(`signature:${input.id}`).digest('hex'),'issuer-1',SHA_B,input.issuedAt,input.expiresAt,input.issuedAt,input.reference,input.mutationId,input.stateFingerprint??SHA_B,input.receiptHash);
};

describe('33-P identity access credential repository policy', () => {
  it('keeps persisted surfaces metadata/public-key only and ledgers immutable', () => {
    const database=openFixture();
    const columns=(database.prepare(`SELECT name FROM pragma_table_info('identity_passkey_credentials') UNION ALL SELECT name FROM pragma_table_info('identity_federated_links') UNION ALL SELECT name FROM pragma_table_info('identity_temporary_credentials')`).all() as Array<{name:string}>).map(({name})=>name);
    expect(columns.some((name)=>/(private|biometric|access_token|refresh_token|id_token|plaintext|claim_value)/u.test(name))).toBe(false);
    expect(migration93.sql).toContain('33-P mutation ledger is immutable');
    expect(migration93.sql).toContain("json_extract(receipt.record_json,'$.request.resource.sensitivity')='highly_sensitive'");
  });

  it('accepts one bounded challenge consumption and rejects replay or expiry', () => {
    const database=openFixture();
    const challengeReceipt=seedReceipt(database,'identity_challenge','challenge-1','create');
    database.prepare(`INSERT INTO identity_passkey_challenges(id,family_id,account_id,owner_person_id,purpose,challenge_sha256,relying_party_id,trusted_device_id,device_id,security_epoch,created_at,expires_at,consumed_at,consumption_mutation_id,policy_receipt_hash) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,NULL,NULL,?)`)
      .run('challenge-1',FAMILY_ID,ACCOUNT_ID,PERSON_ID,'passkey_registration',SHA_A,'app.local','trusted-33-p','device-33-p',7,NOW,'2026-08-14T08:05:00.000Z',challengeReceipt);
    const mutationReceipt=seedReceipt(database,'passkey_credential','passkey-1','create');
    insertMutation(database,{id:'mutation-register',kind:'passkey_register',resourceId:'passkey-1',receiptHash:mutationReceipt});
    expect(database.prepare(`UPDATE identity_passkey_challenges SET consumed_at=?,consumption_mutation_id=? WHERE id=?`).run('2026-08-14T08:01:00.000Z','mutation-register','challenge-1').changes).toBe(1);
    expect(()=>database.prepare(`UPDATE identity_passkey_challenges SET consumed_at=?,consumption_mutation_id=? WHERE id=?`).run('2026-08-14T08:02:00.000Z','mutation-register','challenge-1')).toThrow(/replay|expiry|mismatch/u);
    expect(()=>database.prepare(`DELETE FROM identity_access_mutations WHERE id='mutation-register'`).run()).toThrow(/zero current\/challenge\/tombstone references/u);
  });

  it('bounds challenge rows and never lifetime-locks after more than 512 lifetime expired records',()=>{
    const database=openFixture();
    const insert=(id:string,createdAt:string,expiresAt:string)=>{const receipt=seedReceipt(database,'identity_challenge',id,'create',{occurredAt:createdAt});database.prepare(`INSERT INTO identity_passkey_challenges(id,family_id,account_id,owner_person_id,purpose,challenge_sha256,relying_party_id,trusted_device_id,device_id,security_epoch,created_at,expires_at,consumed_at,consumption_mutation_id,policy_receipt_hash) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,NULL,NULL,?)`).run(id,FAMILY_ID,ACCOUNT_ID,PERSON_ID,'passkey_authentication',createHash('sha256').update(id).digest('hex'),'app.local','trusted-33-p','device-33-p',7,createdAt,expiresAt,receipt);};
    const base=Date.parse('2020-01-01T00:00:00.000Z');
    for(let index=0;index<512;index+=1){insert(`expired-${index}`,new Date(base+index*2_000).toISOString(),new Date(base+index*2_000+1_000).toISOString());}
    const repository=new SqliteIdentityAccessCredentialRepository();const retentionContext={transaction:database,actor:{userId:asUserId('deployment-configuration'),roles:['system']},correlationId:asCorrelationId('33-p-retention'),occurredAt:asIsoDateTime(NOW)} as unknown as RepositoryExecutionContext;
    expect(repository.pruneTerminalChallenges(retentionContext,asIsoDateTime('2026-07-15T08:00:00.000Z'))).toEqual(expect.objectContaining({ok:true,value:512}));
    expect(database.prepare(`SELECT count(*) AS count FROM identity_passkey_challenges`).get()).toEqual({count:0});
    expect(database.prepare(`SELECT count(*) AS count FROM platform_policy_transaction_receipts`).get()).toEqual({count:512});
    for(let index=0;index<32;index+=1)insert(`active-${index}`,NOW,'2026-08-14T08:05:00.000Z');
    expect(()=>insert('active-overflow',NOW,'2026-08-14T08:05:00.000Z')).toThrow(/challenge quota/u);
    const receipt=seedReceipt(database,'identity_challenge','expired-ledger-rollover','create',{occurredAt:'2026-08-14T09:00:00.000Z'});
    expect(database.prepare(`INSERT INTO identity_passkey_challenges(id,family_id,account_id,owner_person_id,purpose,challenge_sha256,relying_party_id,trusted_device_id,device_id,security_epoch,created_at,expires_at,consumed_at,consumption_mutation_id,policy_receipt_hash) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,NULL,NULL,?)`).run('expired-ledger-rollover',FAMILY_ID,ACCOUNT_ID,PERSON_ID,'passkey_authentication',SHA_A,'app.local','trusted-33-p','device-33-p',7,'2026-08-14T09:00:00.000Z','2026-08-14T09:05:00.000Z',receipt).changes).toBe(1);
  });

  it('rejects forged owner receipt and idempotency fingerprint mismatch', () => {
    const database=openFixture();
    const forged=seedReceipt(database,'passkey_credential','passkey-1','create',{personId:'person-forged'});
    expect(()=>insertMutation(database,{id:'forged-mutation',kind:'passkey_register',resourceId:'passkey-1',receiptHash:forged})).toThrow(/exact durable identity receipt/u);
    const receipt=seedReceipt(database,'passkey_credential','passkey-1','create');
    insertMutation(database,{id:'mutation-1',clientOperationId:'same-operation',kind:'passkey_register',resourceId:'passkey-1',receiptHash:receipt});
    expect(()=>insertMutation(database,{id:'mutation-2',clientOperationId:'same-operation',kind:'passkey_register',resourceId:'passkey-1',receiptHash:receipt,stateFingerprint:SHA_A})).toThrow(/UNIQUE/u);
  });

  it('physically prunes only seven-day-old unreferenced mutations for the exact owner and preserves durable receipt/outbox evidence', () => {
    const database=openFixture();
    database.exec(`INSERT INTO people VALUES('person-foreign','${FAMILY_ID}','active'); INSERT INTO accounts VALUES('account-foreign','person-foreign','active',7);`);
    const oldAt='2026-01-01T00:00:00.000Z';
    const ownReceipt=seedReceipt(database,'passkey_credential','unreferenced-own','create',{occurredAt:oldAt});
    insertMutation(database,{id:'mutation-old-own',kind:'passkey_register',resourceId:'unreferenced-own',receiptHash:ownReceipt,occurredAt:oldAt});
    const foreignReceipt=seedReceipt(database,'passkey_credential','unreferenced-foreign','create',{accountId:'account-foreign',personId:'person-foreign',occurredAt:oldAt});
    insertMutation(database,{id:'mutation-old-foreign',kind:'passkey_register',resourceId:'unreferenced-foreign',receiptHash:foreignReceipt,occurredAt:oldAt,accountId:'account-foreign',personId:'person-foreign'});
    const recentReceipt=seedReceipt(database,'passkey_credential','unreferenced-recent','create');
    insertMutation(database,{id:'mutation-recent-own',kind:'passkey_register',resourceId:'unreferenced-recent',receiptHash:recentReceipt});
    const repository=new SqliteIdentityAccessCredentialRepository();
    const context={transaction:database,actor:{userId:ACCOUNT_ID,roles:['owner'],personId:PERSON_ID},correlationId:asCorrelationId('33-p-retention-owner'),occurredAt:asIsoDateTime(NOW)} as unknown as RepositoryExecutionContext;
    const before=Number((database.prepare(`SELECT count(*) AS count FROM identity_access_mutations`).get() as {count:number}).count);
    expect(repository.pruneTerminalCredentialMetadata(context,{familyId:FAMILY_ID,accountId:ACCOUNT_ID,ownerPersonId:PERSON_ID},[])).toEqual({ok:true,value:{mutationRowsPruned:1,passkeyRowsCompacted:0,passkeyTombstonesExpired:0,temporaryRowsCompacted:0,temporaryTombstonesExpired:0}});
    expect(Number((database.prepare(`SELECT count(*) AS count FROM identity_access_mutations`).get() as {count:number}).count)).toBe(before-1);
    expect(database.prepare(`SELECT id FROM identity_access_mutations ORDER BY id`).all()).toEqual([{id:'mutation-old-foreign'},{id:'mutation-recent-own'}]);
    expect(()=>database.prepare(`DELETE FROM identity_access_mutations WHERE id='mutation-recent-own'`).run()).toThrow(/seven-day grace/u);
    expect(database.prepare(`SELECT count(*) AS count FROM platform_policy_transaction_receipts`).get()).toEqual({count:3});
    expect(database.prepare(`SELECT count(*) AS count FROM platform_policy_journal_projection_outbox`).get()).toEqual({count:3});
  });

  it('binds passkey creation to trusted mutation time and retains the exact revoked digest for 365 days', () => {
    const database=openFixture();
    const createReceipt=seedReceipt(database,'passkey_credential','passkey-1','create');
    insertMutation(database,{id:'mutation-register-time',kind:'passkey_register',resourceId:'passkey-1',receiptHash:createReceipt});
    expect(()=>insertPasskey(database,'mutation-register-time',createReceipt,1,10,SHA_B,'2026-08-13T08:00:00.000Z')).toThrow(/exact mutation\/device/u);
    insertPasskey(database,'mutation-register-time',createReceipt);
    const revokeReceipt=seedReceipt(database,'passkey_credential','passkey-1','delete');
    insertMutation(database,{id:'mutation-revoke-time',kind:'passkey_revoke',resourceId:'passkey-1',previousRevision:1,revision:2,stateFingerprint:SHA_A,receiptHash:revokeReceipt});
    expect(database.prepare(`UPDATE identity_passkey_credentials SET revision=2,status='revoked',revoked_at=?,revocation_reason='manual',last_mutation_id='mutation-revoke-time',state_fingerprint=?,policy_receipt_hash=? WHERE id='passkey-1'`).run(NOW,SHA_A,revokeReceipt).changes).toBe(1);
    const tombstone=database.prepare(`INSERT INTO identity_passkey_credential_tombstones(credential_id_sha256,family_id,account_id,owner_person_id,terminal_status,revocation_reason,revoked_at,retain_until,final_revision,final_state_fingerprint,final_mutation_id,policy_receipt_hash,recorded_at) VALUES(?,?,?,?, 'revoked','manual',?,?,2,?,'mutation-revoke-time',?,?)`);
    expect(()=>tombstone.run(SHA_A,FAMILY_ID,ACCOUNT_ID,PERSON_ID,NOW,'2027-08-13T08:00:00.000Z',SHA_A,revokeReceipt,NOW)).toThrow(/bounded retention/u);
    expect(tombstone.run(SHA_A,FAMILY_ID,ACCOUNT_ID,PERSON_ID,NOW,'2027-08-14T08:00:00.000Z',SHA_A,revokeReceipt,NOW).changes).toBe(1);
    const replayReceipt=seedReceipt(database,'passkey_credential','passkey-replay','create',{occurredAt:'2026-08-14T08:00:01.000Z'});
    insertMutation(database,{id:'mutation-replay-register',kind:'passkey_register',resourceId:'passkey-replay',receiptHash:replayReceipt,occurredAt:'2026-08-14T08:00:01.000Z'});
    expect(()=>database.prepare(`INSERT INTO identity_passkey_credentials SELECT 'passkey-replay',family_id,account_id,owner_person_id,1,display_name,'credential-replay',credential_id_sha256,public_key_cose_base64url,public_key_sha256,user_handle_sha256,relying_party_id,aaguid,transports_json,0,backup_eligible,backup_state,trusted_device_id,security_epoch,'active','2026-08-14T08:00:01.000Z',NULL,NULL,NULL,'mutation-replay-register',?,? FROM identity_passkey_credentials WHERE id='passkey-1'`).run(SHA_B,replayReceipt)).toThrow(/tombstone|quota|exact mutation/u);
    expect(()=>database.prepare(`DELETE FROM identity_access_mutations WHERE id='mutation-revoke-time'`).run()).toThrow(/zero current\/challenge\/tombstone references/u);
  });

  it('rejects stale revision and non-increasing WebAuthn signCount as cloning risk', () => {
    const database=openFixture();
    const createReceipt=seedReceipt(database,'passkey_credential','passkey-1','create');
    insertMutation(database,{id:'mutation-register',kind:'passkey_register',resourceId:'passkey-1',receiptHash:createReceipt});
    insertPasskey(database,'mutation-register',createReceipt);
    expect(database.prepare(`SELECT source_version FROM identity_access_source_clocks WHERE account_id=?`).get(ACCOUNT_ID)).toEqual({source_version:1});
    const updateReceipt=seedReceipt(database,'passkey_credential','passkey-1','update');
    insertMutation(database,{id:'mutation-auth',kind:'passkey_authenticate',resourceId:'passkey-1',previousRevision:1,revision:2,stateFingerprint:SHA_A,receiptHash:updateReceipt});
    expect(()=>database.prepare(`UPDATE identity_passkey_credentials SET revision=2,sign_count=10,last_mutation_id='mutation-auth',state_fingerprint=?,policy_receipt_hash=? WHERE id='passkey-1' AND revision=1`).run(SHA_A,updateReceipt)).toThrow(/clone counter|transition mismatch/u);
    expect(database.prepare(`UPDATE identity_passkey_credentials SET revision=2,sign_count=11,last_mutation_id='mutation-auth',state_fingerprint=?,policy_receipt_hash=? WHERE id='passkey-1' AND revision=1`).run(SHA_A,updateReceipt).changes).toBe(1);
    expect(database.prepare(`SELECT source_version FROM identity_access_source_clocks WHERE account_id=?`).get(ACCOUNT_ID)).toEqual({source_version:2});
    expect(database.prepare(`UPDATE identity_passkey_credentials SET revision=3 WHERE id='passkey-1' AND revision=1`).run().changes).toBe(0);
    expect(()=>database.prepare(`DELETE FROM identity_access_mutations WHERE id='mutation-auth'`).run()).toThrow(/zero current\/challenge\/tombstone references/u);
  });

  it('keeps federation unlink append-only and refuses unconfigured providers',()=>{
    const database=openFixture();database.prepare(`INSERT INTO identity_federated_provider_configurations VALUES('google',1,'google-config',?,?)`).run(SHA_A,SHA_B);
    const createReceipt=seedReceipt(database,'federated_identity_link','link-1','create');
    insertMutation(database,{id:'mutation-link',kind:'federated_link',resourceType:'federated_identity_link',resourceId:'link-1',receiptHash:createReceipt});
    database.prepare(`INSERT INTO identity_federated_links(id,family_id,account_id,owner_person_id,revision,provider,configuration_id,authorization_endpoint_sha256,client_configuration_sha256,provider_subject_sha256,granted_scopes_json,status,encrypted_vault_entry_id,live_account_tested,authorization_code_pkce_verified,state_verified,nonce_verified,token_bytes_exposed,token_stored_in_encrypted_vault,provider_availability_guaranteed,provider_delivery_guaranteed,linked_at,last_locally_verified_at,revoked_at,last_mutation_id,state_fingerprint,policy_receipt_hash) VALUES(?,?,?,?,1,'google','google-config',?,?,?,'["openid"]','linked','vault-entry-1',1,1,1,1,0,1,0,0,?,?,NULL,?,?,?)`)
      .run('link-1',FAMILY_ID,ACCOUNT_ID,PERSON_ID,SHA_A,SHA_B,SHA_A,NOW,NOW,'mutation-link',SHA_B,createReceipt);
    const visibleLinks=()=>database.prepare(`SELECT link.id FROM identity_federated_links link JOIN identity_federated_provider_configurations config ON config.provider=link.provider AND config.configured=1 AND config.configuration_id=link.configuration_id AND config.authorization_endpoint_sha256=link.authorization_endpoint_sha256 AND config.client_configuration_sha256=link.client_configuration_sha256 WHERE link.account_id=?`).all(ACCOUNT_ID);
    expect(visibleLinks()).toEqual([{id:'link-1'}]);
    database.prepare(`UPDATE identity_federated_provider_configurations SET configuration_id='google-config-v2' WHERE provider='google'`).run();
    expect(visibleLinks()).toEqual([]);
    database.prepare(`UPDATE identity_federated_provider_configurations SET configuration_id='google-config' WHERE provider='google'`).run();
    const deleteReceipt=seedReceipt(database,'federated_identity_link','link-1','delete');
    insertMutation(database,{id:'mutation-unlink',kind:'federated_unlink',resourceType:'federated_identity_link',resourceId:'link-1',previousRevision:1,revision:2,stateFingerprint:SHA_A,receiptHash:deleteReceipt});
    expect(database.prepare(`UPDATE identity_federated_links SET revision=2,status='revoked',revoked_at=?,last_mutation_id='mutation-unlink',state_fingerprint=?,policy_receipt_hash=? WHERE id='link-1'`).run(NOW,SHA_A,deleteReceipt).changes).toBe(1);
    const relinkReceipt=seedReceipt(database,'federated_identity_link','link-1','create');
    insertMutation(database,{id:'mutation-relink',kind:'federated_link',resourceType:'federated_identity_link',resourceId:'link-1',previousRevision:2,revision:3,stateFingerprint:SHA_B,receiptHash:relinkReceipt});
    expect(database.prepare(`UPDATE identity_federated_links SET revision=3,status='linked',revoked_at=NULL,provider_subject_sha256=?,encrypted_vault_entry_id='vault-entry-fresh',linked_at=?,last_locally_verified_at=?,last_mutation_id='mutation-relink',state_fingerprint=?,policy_receipt_hash=? WHERE id='link-1' AND revision=2`).run(SHA_B,NOW,NOW,SHA_B,relinkReceipt).changes).toBe(1);
    expect(database.prepare(`SELECT status,revision,encrypted_vault_entry_id FROM identity_federated_links WHERE id='link-1'`).get()).toEqual({status:'linked',revision:3,encrypted_vault_entry_id:'vault-entry-fresh'});
    expect(()=>database.prepare(`DELETE FROM identity_federated_links WHERE id='link-1'`).run()).toThrow(/cannot be deleted/u);
    database.prepare(`INSERT INTO identity_federated_provider_configurations VALUES('apple',0,'apple-config',?,?)`).run(SHA_A,SHA_B);
    const appleReceipt=seedReceipt(database,'federated_identity_link','link-apple','create');
    insertMutation(database,{id:'mutation-apple',kind:'federated_link',resourceType:'federated_identity_link',resourceId:'link-apple',receiptHash:appleReceipt});
    expect(()=>database.prepare(`INSERT INTO identity_federated_links(id,family_id,account_id,owner_person_id,revision,provider,configuration_id,authorization_endpoint_sha256,client_configuration_sha256,provider_subject_sha256,granted_scopes_json,status,encrypted_vault_entry_id,live_account_tested,authorization_code_pkce_verified,state_verified,nonce_verified,token_bytes_exposed,token_stored_in_encrypted_vault,provider_availability_guaranteed,provider_delivery_guaranteed,linked_at,last_locally_verified_at,revoked_at,last_mutation_id,state_fingerprint,policy_receipt_hash) VALUES(?,?,?,?,1,'apple','apple-config',?,?,?,'["openid"]','linked','vault-entry-2',1,1,1,1,0,1,0,0,?,?,NULL,?,?,?)`).run('link-apple',FAMILY_ID,ACCOUNT_ID,PERSON_ID,SHA_A,SHA_B,SHA_B,NOW,NOW,'mutation-apple',SHA_B,appleReceipt)).toThrow(/exact mutation or quota/u);
  });

  it('enforces temporary credential minimum disclosure, bounded expiry and durable revocation',()=>{
    const database=openFixture();const receipt=seedReceipt(database,'temporary_verifiable_credential','temp-1','create');
    insertMutation(database,{id:'mutation-temp',kind:'temporary_credential_issue',resourceType:'temporary_verifiable_credential',resourceId:'temp-1',receiptHash:receipt});
    const insert=()=>database.prepare(`INSERT INTO identity_temporary_credentials(id,family_id,account_id,owner_person_id,revision,kind,purpose,audience_ref_sha256,disclosed_claim_keys_json,disclosure_sha256,payload_sha256,signature_sha256,issuer_key_id,issuer_public_key_sha256,signature_algorithm,qr_payload_bytes,status,not_before,expires_at,issued_at,revoked_at,revocation_reason,encrypted_envelope_reference,last_mutation_id,state_fingerprint,policy_receipt_hash) VALUES(?,?,?,?,1,'school_pickup','school_pickup_authorization',?,?,?,?,?,'issuer-1',?,'Ed25519',512,'active',?,?,?,NULL,NULL,'vault-envelope-1','mutation-temp',?,?)`);
    expect(()=>insert().run('temp-1',FAMILY_ID,ACCOUNT_ID,PERSON_ID,SHA_A,'["subject_display_name","allergy_summary"]',SHA_A,SHA_B,SHA_A,SHA_B,NOW,'2026-08-15T08:00:00.000Z',NOW,SHA_B,receipt)).toThrow(/temporary credential/u);
    expect(()=>insert().run('temp-1',FAMILY_ID,ACCOUNT_ID,PERSON_ID,SHA_A,'["subject_display_name","authorized_person_display_name"]',SHA_A,SHA_B,SHA_A,SHA_B,NOW,'2026-08-15T08:00:00.000Z','2026-08-13T08:00:00.000Z',SHA_B,receipt)).toThrow(/exact mutation|temporary credential/u);
    insert().run('temp-1',FAMILY_ID,ACCOUNT_ID,PERSON_ID,SHA_A,'["subject_display_name","authorized_person_display_name"]',SHA_A,SHA_B,SHA_A,SHA_B,NOW,'2026-08-15T08:00:00.000Z',NOW,SHA_B,receipt);
    const revokeReceipt=seedReceipt(database,'temporary_verifiable_credential','temp-1','delete');
    insertMutation(database,{id:'mutation-temp-revoke',kind:'temporary_credential_revoke',resourceType:'temporary_verifiable_credential',resourceId:'temp-1',previousRevision:1,revision:2,stateFingerprint:SHA_A,receiptHash:revokeReceipt});
    expect(database.prepare(`UPDATE identity_temporary_credentials SET revision=2,status='revoked',revoked_at=?,revocation_reason='manual',last_mutation_id='mutation-temp-revoke',state_fingerprint=?,policy_receipt_hash=? WHERE id='temp-1'`).run(NOW,SHA_A,revokeReceipt).changes).toBe(1);
    expect(()=>database.prepare(`DELETE FROM identity_temporary_credentials WHERE id='temp-1'`).run()).toThrow(/expiry grace|content-free tombstone/u);
  });

  it('compacts an expired temporary credential only after the exact envelope is confirmed destroyed and preserves a foreign owner sentinel',()=>{
    const database=openFixture();
    database.exec(`INSERT INTO people VALUES('person-foreign','${FAMILY_ID}','active'); INSERT INTO accounts VALUES('account-foreign','person-foreign','active',7);`);
    const issuedAt='2025-12-15T00:00:00.000Z';const expiresAt='2026-01-01T00:00:00.000Z';
    const ownReceipt=seedReceipt(database,'temporary_verifiable_credential','temp-expired','create',{occurredAt:issuedAt});
    insertMutation(database,{id:'mutation-temp-expired',kind:'temporary_credential_issue',resourceType:'temporary_verifiable_credential',resourceId:'temp-expired',receiptHash:ownReceipt,occurredAt:issuedAt});
    const ownReference=`temporary-credential-envelope:${'3'.repeat(64)}`;
    insertTemporaryCredential(database,{id:'temp-expired',mutationId:'mutation-temp-expired',receiptHash:ownReceipt,issuedAt,expiresAt,reference:ownReference});
    const foreignReceipt=seedReceipt(database,'temporary_verifiable_credential','temp-foreign','create',{accountId:'account-foreign',personId:'person-foreign',occurredAt:issuedAt});
    insertMutation(database,{id:'mutation-temp-foreign',kind:'temporary_credential_issue',resourceType:'temporary_verifiable_credential',resourceId:'temp-foreign',receiptHash:foreignReceipt,occurredAt:issuedAt,accountId:'account-foreign',personId:'person-foreign'});
    const foreignReference=`temporary-credential-envelope:${'4'.repeat(64)}`;
    insertTemporaryCredential(database,{id:'temp-foreign',mutationId:'mutation-temp-foreign',receiptHash:foreignReceipt,issuedAt,expiresAt,reference:foreignReference,accountId:'account-foreign',personId:'person-foreign'});
    const early=database.prepare(`INSERT INTO identity_temporary_credential_tombstones(credential_id,family_id,account_id,owner_person_id,payload_sha256,terminal_status,expires_at,revoked_at,retain_until,final_revision,final_state_fingerprint,final_mutation_id,policy_receipt_hash,pruned_at) SELECT id,family_id,account_id,owner_person_id,payload_sha256,'expired',expires_at,NULL,'2026-12-31T00:00:00.000Z',revision,state_fingerprint,last_mutation_id,policy_receipt_hash,? FROM identity_temporary_credentials WHERE id='temp-expired'`);
    expect(()=>early.run(NOW)).toThrow(/exact content-free terminal metadata/u);
    const repository=new SqliteIdentityAccessCredentialRepository();const key={familyId:FAMILY_ID,accountId:ACCOUNT_ID,ownerPersonId:PERSON_ID};
    const context={transaction:database,actor:{userId:ACCOUNT_ID,roles:['owner'],personId:PERSON_ID},correlationId:asCorrelationId('33-p-temp-retention'),occurredAt:asIsoDateTime(NOW)} as unknown as RepositoryExecutionContext;
    expect(repository.listReferencedTemporaryCredentialEnvelopeReferences(context,key)).toEqual({ok:true,value:[ownReference]});
    expect(repository.listTerminalTemporaryCredentialEnvelopeReferences(context,key)).toEqual({ok:true,value:[ownReference]});
    expect(repository.pruneTerminalCredentialMetadata(context,key,[])).toEqual({ok:true,value:expect.objectContaining({temporaryRowsCompacted:0})});
    expect(repository.pruneTerminalCredentialMetadata(context,key,[`temporary-credential-envelope:${'5'.repeat(64)}`])).toEqual({ok:true,value:expect.objectContaining({temporaryRowsCompacted:0})});
    expect(database.prepare(`SELECT id FROM identity_temporary_credentials ORDER BY id`).all()).toEqual([{id:'temp-expired'},{id:'temp-foreign'}]);
    expect(repository.pruneTerminalCredentialMetadata(context,key,[ownReference])).toEqual({ok:true,value:expect.objectContaining({temporaryRowsCompacted:1})});
    expect(database.prepare(`SELECT id FROM identity_temporary_credentials ORDER BY id`).all()).toEqual([{id:'temp-foreign'}]);
    expect(database.prepare(`SELECT credential_id,terminal_status,retain_until FROM identity_temporary_credential_tombstones`).all()).toEqual([{credential_id:'temp-expired',terminal_status:'expired',retain_until:'2027-01-01T00:00:00.000Z'}]);
    expect(database.prepare(`SELECT count(*) AS count FROM platform_policy_transaction_receipts`).get()).toEqual({count:2});
    expect(database.prepare(`SELECT count(*) AS count FROM platform_policy_journal_projection_outbox`).get()).toEqual({count:2});
  });

  it('fails closed before SQL for a forged policy subject', () => {
    const repository=new SqliteIdentityAccessCredentialRepository();
    const forged={actor:{userId:asUserId('attacker'),roles:[],personId:PERSON_ID},correlationId:asCorrelationId('33-p-forged'),occurredAt:asIsoDateTime(NOW),policyAuthorization:{}} as unknown as PolicyAuthorizedRepositoryExecutionContext;
    expect(()=>repository.loadCenter(forged,{familyId:FAMILY_ID,accountId:ACCOUNT_ID,ownerPersonId:PERSON_ID})).toThrow(/exact account\/person actor/u);
  });

  it('idempotently provisions exact deployment hashes and disables removed providers',()=>{
    const database=openFixture();const repository=new SqliteIdentityAccessCredentialRepository();
    const context={transaction:database,actor:{userId:asUserId('deployment-configuration'),roles:['system']},correlationId:asCorrelationId('33-p-provision'),occurredAt:asIsoDateTime(NOW)} as unknown as RepositoryExecutionContext;
    expect(repository.provisionFederatedProviderConfigurations(context,[{provider:'google',configured:true,configurationId:'google-production',authorizationEndpointSha256:SHA_A,clientConfigurationSha256:SHA_B}]).ok).toBe(true);
    expect(database.prepare(`SELECT provider,configured,configuration_id FROM identity_federated_provider_configurations ORDER BY provider`).all()).toEqual([
      {provider:'apple',configured:0,configuration_id:'unconfigured-apple'},
      {provider:'google',configured:1,configuration_id:'google-production'},
      {provider:'microsoft',configured:0,configuration_id:'unconfigured-microsoft'}
    ]);
    expect(repository.provisionFederatedProviderConfigurations(context,[]).ok).toBe(true);
    expect(database.prepare(`SELECT count(*) AS count FROM identity_federated_provider_configurations WHERE configured=1`).get()).toEqual({count:0});
    expect(()=>repository.provisionFederatedProviderConfigurations(context,[{provider:'google',configured:true,configurationId:'google-production',authorizationEndpointSha256:'forged',clientConfigurationSha256:SHA_B}])).toThrow(/deployment configuration/u);
    expect(database.prepare(`SELECT count(*) AS count FROM identity_federated_provider_configurations WHERE configured=1`).get()).toEqual({count:0});
  });

  it('retains active companion evidence but permits bounded cleanup of expired metadata',()=>{
    const database=openFixture();
    const insert=(id:string,sourceVersion:number,generatedAt:string,expiresAt:string)=>{const receipt=seedReceipt(database,'companion_sync_snapshot',id,'create',{occurredAt:generatedAt});database.prepare(`INSERT INTO identity_companion_snapshots(id,family_id,account_id,owner_person_id,trusted_device_id,protocol_version,source_version,schema_version,ciphertext_sha256,envelope_sha256,envelope_bytes,security_epoch,generated_at,expires_at,policy_receipt_hash) VALUES(?,?,?,?, 'trusted-33-p',1,?,1,?,?,512,7,?,?,?)`).run(id,FAMILY_ID,ACCOUNT_ID,PERSON_ID,sourceVersion,SHA_A,SHA_B,generatedAt,expiresAt,receipt);};
    const activeGeneratedAt=new Date(Date.now()-60_000).toISOString();
    const activeExpiresAt=new Date(Date.now()+3_600_000).toISOString();
    insert('snapshot-active',0,activeGeneratedAt,activeExpiresAt);
    expect(()=>database.prepare(`DELETE FROM identity_companion_snapshots WHERE id='snapshot-active'`).run()).toThrow(/active companion snapshots/u);
    insert('snapshot-expired',1,'2000-08-12T08:00:00.000Z','2000-08-13T08:00:00.000Z');
    expect(database.prepare(`DELETE FROM identity_companion_snapshots WHERE id='snapshot-expired'`).run().changes).toBe(1);
    expect(database.prepare(`SELECT count(*) AS count FROM identity_companion_snapshots`).get()).toEqual({count:1});
  });
});

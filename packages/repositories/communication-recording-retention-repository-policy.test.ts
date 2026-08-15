import { readFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { asIsoDateTime, type Clock } from '@ppt/core';
import { SqliteFamilyDatabaseRuntime } from '../../apps/desktop/src/main/family-database-runtime.js';

const NOW=asIsoDateTime('2026-08-15T16:00:00.000Z');const clock:Clock={now:()=>NOW};
const runtimes:SqliteFamilyDatabaseRuntime[]=[];const directories:string[]=[];
afterEach(()=>{for(const runtime of runtimes.splice(0))runtime.close();for(const directory of directories.splice(0))
  rmSync(directory,{recursive:true,force:true});});
const open=()=>{const directory=mkdtempSync(join(tmpdir(),'ppt-34d-repository-'));directories.push(directory);
  const runtime=new SqliteFamilyDatabaseRuntime({databasePath:join(directory,'family.db'),applicationVersion:'34-d-repository-vitest',
    clock,skipFileMigrationSafetyBackup:true,databaseConfig:{busyTimeoutMs:5000,journalMode:'WAL',synchronous:'FULL'}});
  runtimes.push(runtime);return runtime;};

describe('34-D recording repository and migration boundary',()=>{
  it('owns the exact current and append-only ledger table set at migration 108',()=>{
    const runtime=open();const tables=(runtime.database.prepare(`SELECT name FROM sqlite_master WHERE type='table'
      AND name LIKE 'communication_recording_%' ORDER BY name`).all() as Array<{name:string}>).map(row=>row.name);
    expect(tables).toEqual(['communication_recording_consents','communication_recording_events','communication_recording_mutations',
      'communication_recording_requests','communication_recording_retention','communication_recording_segments']);
    expect(runtime.database.prepare("SELECT value FROM database_metadata WHERE key='schema_generation'").get())
      .toEqual({value:'REVISION-34-E-LOCAL-FIRST-TRANSLATION-LANGUAGE'});
  });

  it('stores consent and retention metadata without media bytes, paths, keys, tokens or transcript text',()=>{
    const runtime=open();const columns=(runtime.database.prepare(`SELECT m.name table_name,p.name column_name FROM sqlite_master m,
      pragma_table_info(m.name) p WHERE m.type='table' AND m.name LIKE 'communication_recording_%' ORDER BY m.name,p.cid`)
      .all() as Array<{table_name:string;column_name:string}>).map(row=>`${row.table_name}.${row.column_name}`);
    expect(columns).toContain('communication_recording_consents.explicit_consent');
    expect(columns).toContain('communication_recording_retention.translation_days');
    expect(columns.join('\n')).not.toMatch(/payload|content|plaintext|ciphertext|media_path|file_path|secret|token|private_key|transcript_text|translation_text/iu);
  });

  it('pins exact PEP receipt, participant self-consent, default-off and immutable-ledger triggers',()=>{
    const runtime=open();const triggers=(runtime.database.prepare(`SELECT name,sql FROM sqlite_master WHERE type='trigger'
      AND name LIKE 'trg_34d_%' ORDER BY name`).all() as Array<{name:string;sql:string}>);
    const sql=triggers.map(row=>row.sql).join('\n');expect(triggers.length).toBeGreaterThanOrEqual(14);
    for(const marker of ["sensitivity')='highly_sensitive'","mutation.actor_person_id=NEW.participant_person_id",
      "NEW.state='consent_pending'",'content-free capture truth','mutation ledger is immutable',
      'participant consent history is durable','recording segments are immutable'])expect(sql).toContain(marker);
    const schema=(runtime.database.prepare(`SELECT sql FROM sqlite_master WHERE type='table'
      AND name IN ('communication_recording_consents','communication_recording_requests','communication_recording_segments') ORDER BY name`)
      .all() as Array<{sql:string}>).map(row=>row.sql).join('\n');
    expect(schema).toContain('guardian_policy_verified INTEGER NOT NULL CHECK(guardian_policy_verified=0)');
    expect(schema).toContain('capture_started INTEGER NOT NULL CHECK(capture_started=0)');
  });

  it('keeps the repository preauthorization resolver payload-free and every write receipt-bound',()=>{
    const source=readFileSync('packages/repositories/src/communication-recording-retention-repository.ts','utf8');
    expect(source).toContain("platformPolicyPersistenceBinding(context, row.resourceType, row.resourceId)");
    expect(source).toContain("platformPolicyPersistenceBinding(context, 'communication_recording_request', requestId)");
    expect(source).toContain('SELECT id,family_id,owner_person_id,revision,state status,state_fingerprint');
    const resolver=source.slice(source.indexOf('public resolvePolicyResource'),source.indexOf('private snapshot'));
    expect(resolver).not.toMatch(/notice_version|participant_person_id|audio_days|video_days|segment|reason|payload/iu);
  });
});

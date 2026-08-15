import { readFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { asIsoDateTime, type Clock } from '@ppt/core';
import { FAMILY_DATABASE_MIGRATIONS } from '@ppt/database';
import { SqliteFamilyDatabaseRuntime } from '../../apps/desktop/src/main/family-database-runtime.js';

const NOW=asIsoDateTime('2026-08-15T17:00:00.000Z');const clock:Clock={now:()=>NOW};
const runtimes:SqliteFamilyDatabaseRuntime[]=[];const directories:string[]=[];
afterEach(()=>{for(const runtime of runtimes.splice(0))runtime.close();for(const directory of directories.splice(0))
  rmSync(directory,{recursive:true,force:true});});
const open=()=>{const directory=mkdtempSync(join(tmpdir(),'ppt-34e-repository-'));directories.push(directory);
  const runtime=new SqliteFamilyDatabaseRuntime({databasePath:join(directory,'family.db'),applicationVersion:'34-e-repository-vitest',
    clock,skipFileMigrationSafetyBackup:true,databaseConfig:{busyTimeoutMs:5000,journalMode:'WAL',synchronous:'FULL'}});
  runtimes.push(runtime);return runtime;};

describe('34-E local translation repository and migration boundary',()=>{
  it('owns migration 109 and the exact current plus append-only table set',()=>{
    const runtime=open();const tables=(runtime.database.prepare(`SELECT name FROM sqlite_master WHERE type='table'
      AND name LIKE 'local_translation_%' ORDER BY name`).all() as Array<{name:string}>).map(row=>row.name);
    expect(tables).toEqual(['local_translation_dictionary_entries','local_translation_events','local_translation_mutations',
      'local_translation_profiles','local_translation_requests']);
    expect(runtime.database.prepare("SELECT value FROM database_metadata WHERE key='schema_generation'").get())
      .toEqual({value:'REVISION-34-E-LOCAL-FIRST-TRANSLATION-LANGUAGE'});
    expect(FAMILY_DATABASE_MIGRATIONS.at(-1)).toMatchObject({version:109,name:'local_first_translation_language'});
  });

  it('stores the explicit personal dictionary but never source payload, translated output, audio, provider credential or path columns',()=>{
    const runtime=open();const columns=(runtime.database.prepare(`SELECT m.name table_name,p.name column_name FROM sqlite_master m,
      pragma_table_info(m.name) p WHERE m.type='table' AND m.name LIKE 'local_translation_%' ORDER BY m.name,p.cid`)
      .all() as Array<{table_name:string;column_name:string}>).map(row=>`${row.table_name}.${row.column_name}`);
    expect(columns).toContain('local_translation_dictionary_entries.source_term');
    expect(columns).toContain('local_translation_dictionary_entries.preferred_term');
    expect(columns).toContain('local_translation_requests.correction_sha256');
    expect(columns.join('\n')).not.toMatch(/source_text|translated_text|audio_bytes|caption_text|payload|ciphertext|file_path|secret|token|private_key|api_key/iu);
  });

  it('pins exact PEP receipt, local no-provider truth, consent pairing, logical content clearing and immutable ledgers',()=>{
    const runtime=open();const triggers=(runtime.database.prepare(`SELECT name,sql FROM sqlite_master WHERE type='trigger'
      AND name LIKE 'trg_34e_%' ORDER BY name`).all() as Array<{name:string;sql:string}>);
    const sql=triggers.map(row=>row.sql).join('\n');expect(triggers.length).toBeGreaterThanOrEqual(12);
    for(const marker of ["sensitivity')='highly_sensitive'","NEW.state='provider_unavailable'",
      "dictionary uses content-free logical deletion",
      'translation mutation ledger is immutable','translation event ledger is immutable'])expect(sql).toContain(marker);
    const request=(runtime.database.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='local_translation_requests'")
      .get() as {sql:string}).sql;
    expect(request).toContain("provider_mode='external_preview' AND external_preview_acknowledged=1 AND explicit_external_consent=1");
    for(const falseColumn of ['language_detection_executed','translation_executed','speech_to_text_executed',
      'speaker_separation_executed','live_caption_translation_executed','text_to_speech_executed','network_used','cloud_used'])
      expect(request).toContain(`${falseColumn} INTEGER NOT NULL CHECK(${falseColumn}=0)`);
  });

  it('keeps policy resolution payload-free and every current-row write bound to the durable receipt',()=>{
    const source=readFileSync('packages/repositories/src/local-translation-language-repository.ts','utf8');
    expect(source).toContain('platformPolicyPersistenceBinding(context, row.resourceType, row.resourceId)');
    expect(source).toContain('platformPolicyPersistenceBinding(context, resourceType, resourceId)');
    const resolver=source.slice(source.indexOf('public resolvePolicyResource'),source.indexOf('public loadCenter'));
    expect(resolver).toContain('SELECT id,family_id,owner_person_id,revision');
    expect(resolver).not.toMatch(/source_term|preferred_term|source_resource_id|correction_sha256|secondary_languages_json|payload/iu);
  });
});

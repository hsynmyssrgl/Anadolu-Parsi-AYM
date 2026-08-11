import assert from 'node:assert/strict';
import { cp, mkdir, rm, writeFile } from 'node:fs/promises';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { execFileSync, spawnSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { DatabaseSync } from 'node:sqlite';
import { resolveTypeScriptCommand } from './lib/typescript-command.mjs';

const root=process.cwd();
const temp=join(root,'.tmp','build131-restore-runtime');
const compiler=resolveTypeScriptCommand(root);
const globalRoot=execFileSync('npm',['root','-g'],{encoding:'utf8'}).trim();
const first=(values)=>values.find((value)=>value&&existsSync(value));
const nodeTypes=first([
  join(root,'node_modules','@types','node'),
  join(globalRoot,'@types','node'),
  join(globalRoot,'ts-node','node_modules','@types','node'),
  join(globalRoot,'pptxgenjs','node_modules','@types','node')
]);
const undici=first([
  join(root,'node_modules','undici-types'),
  join(globalRoot,'undici-types'),
  join(globalRoot,'ts-node','node_modules','undici-types'),
  join(globalRoot,'pptxgenjs','node_modules','undici-types')
]);
if(!nodeTypes) throw new Error('@types/node bulunamadı.');
await rm(temp,{recursive:true,force:true});
await mkdir(join(temp,'node_modules','@types'),{recursive:true});
await cp(nodeTypes,join(temp,'node_modules','@types','node'),{recursive:true});
if(undici) await cp(undici,join(temp,'node_modules','undici-types'),{recursive:true});
const outDir=join(temp,'compiled');
const typeStubPath=join(temp,'ppt-runtime-stubs.d.ts');
await writeFile(typeStubPath, String.raw`
declare module '@ppt/core' {
  export type CorrelationId = string;
  export interface AppError {
    readonly code: string;
    readonly message: string;
    readonly category?: string;
    readonly correlationId?: string;
    readonly retryable?: boolean;
    readonly details?: Readonly<Record<string, unknown>>;
  }
  export type Result<T, E> = { readonly ok: true; readonly value: T } | { readonly ok: false; readonly error: E };
  export const ERROR_CODES: {
    readonly CORE_INVALID_ARGUMENT: string;
    readonly CORE_UNEXPECTED: string;
    readonly DATABASE_BUSY: string;
    readonly DATABASE_CORRUPT: string;
    readonly DATABASE_DISK_FULL: string;
    readonly DATABASE_INTEGRITY_FAILED: string;
    readonly DATABASE_LOCKED: string;
    readonly DATABASE_READ_ONLY: string;
    readonly RESOURCE_CONFLICT: string;
  };
  export function createAppError(input: AppError): AppError;
  export function ok<T>(value: T): Result<T, never>;
  export function err<E>(error: E): Result<never, E>;
}
declare module '@ppt/contracts' {
  export interface DatabaseStatement {
    all(...args: readonly unknown[]): readonly Record<string, unknown>[];
    get(...args: readonly unknown[]): Record<string, unknown> | undefined;
    run(...args: readonly unknown[]): unknown;
  }
  export interface DatabaseExecutor {
    exec(sql: string): void;
    prepare(sql: string): DatabaseStatement;
  }
  export interface DatabaseConnection extends DatabaseExecutor {
    close(): void;
  }
}
declare module '@ppt/application' {
  export interface FullBackupRestorePlan {
    readonly transactionId: string;
    readonly stagingDirectory: string;
    readonly stagedDatabasePath: string;
    readonly stagedKeyPath: string;
    readonly stagedArchivePath: string;
    readonly databasePath: string;
    readonly keyPath: string;
    readonly archivePath: string;
  }
  import type { AppError, CorrelationId, Result } from '@ppt/core';
  import type { BackupInspectionView } from '@ppt/domain';
  export interface FullBackupFilePort {
    prepareDestination(input: { readonly destinationPath: string }, correlationId: CorrelationId): Result<void, AppError>;
    create(input: { readonly databasePath: string; readonly keyPath: string; readonly archivePath: string; readonly destinationPath: string; readonly createdAt: string; readonly password: string }, correlationId: CorrelationId): Result<void, AppError>;
    inspect(input: { readonly sourcePath: string; readonly password?: string }, correlationId: CorrelationId): Result<BackupInspectionView, AppError>;
    stageRestore(input: { readonly sourcePath: string; readonly databasePath: string; readonly keyPath: string; readonly archivePath: string; readonly password?: string }, correlationId: CorrelationId): Result<FullBackupRestorePlan, AppError>;
    commitRestore(input: { readonly plan: FullBackupRestorePlan; readonly restoredAt: string; readonly safetyBackupPath: string; readonly revokedTrustedDeviceCount: number }, correlationId: CorrelationId): Result<void, AppError>;
    discardRestore(input: { readonly plan: FullBackupRestorePlan }, correlationId: CorrelationId): Result<void, AppError>;
  }
}
declare module '@ppt/domain' {
  export type BackupInspectionView = any;
}
declare module '@ppt/security' {
  export interface EncryptedEnvelope { readonly [key: string]: unknown; }
  export function decryptBytes(envelope: EncryptedEnvelope, key: Uint8Array): Uint8Array;
}
`);
const config={
  extends:resolve(root,'tsconfig.base.json'),
  compilerOptions:{
    module:'NodeNext',moduleResolution:'NodeNext',outDir,rootDir:root,
    declaration:false,declarationMap:false,sourceMap:false,types:['node']
  },
  include:[
    typeStubPath,
    resolve(root,'packages/database/src/backup-safety.ts'),
    resolve(root,'packages/database/src/sqlite.ts'),
    resolve(root,'packages/database/src/sqlite-error.ts'),
    resolve(root,'apps/desktop/src/main/full-backup-file-application-adapter.ts'),
    resolve(root,'apps/desktop/src/main/backup-container-v3.ts')
  ]
};
await writeFile(join(temp,'tsconfig.json'),JSON.stringify(config,null,2));
const compile=spawnSync(compiler.command,[...compiler.prefixArgs,'-p',join(temp,'tsconfig.json'),'--pretty','false'],{cwd:root,encoding:'utf8'});
if(compile.status!==0){process.stderr.write(compile.stdout||'');process.stderr.write(compile.stderr||'');throw new Error('Build 131 runtime kaynak derlemesi başarısız.');}
const packageRoot=join(temp,'node_modules','@ppt');
await mkdir(packageRoot,{recursive:true});
const corePackage=join(packageRoot,'core');
await mkdir(corePackage,{recursive:true});
await writeFile(join(corePackage,'package.json'),JSON.stringify({name:'@ppt/core',type:'module',main:'./index.js'},null,2));
await writeFile(join(corePackage,'index.js'),String.raw`
export const ERROR_CODES = new Proxy({}, { get: (_target, property) => String(property) });
export const createAppError = (input) => ({ ...input });
export const ok = (value) => ({ ok: true, value });
export const err = (error) => ({ ok: false, error });
`);
const securityPackage=join(packageRoot,'security');
await mkdir(securityPackage,{recursive:true});
await writeFile(join(securityPackage,'package.json'),JSON.stringify({name:'@ppt/security',type:'module',main:'./index.js'},null,2));
await writeFile(join(securityPackage,'index.js'),String.raw`
export const decryptBytes = () => { throw new Error('Runtime doğrulamasında legacy envelope çözme çağrılmamalıdır.'); };
`);
const adapterModule=await import(pathToFileURL(join(outDir,'apps/desktop/src/main/full-backup-file-application-adapter.js')).href);
const databaseModule=await import(pathToFileURL(join(outDir,'packages/database/src/backup-safety.js')).href);
const {FileSystemFullBackupFilePort,recoverInterruptedFullBackupRestore}=adapterModule;
const {prepareSqliteRestoredDatabaseForReauthorization}=databaseModule;
let checks=0; const failures=[]; const verify=(condition,label)=>{checks++;if(!condition)failures.push(label);};
const expectOk=(result,label)=>{verify(result?.ok===true,`${label}: ${result?.error?.message??'result not ok'}`);return result.value;};
const expectErr=(result,pattern,label)=>{verify(result?.ok===false&&pattern.test(result.error.message),`${label}: ${result?.error?.message??'missing error'}`);};
const writeSet=(base,prefix)=>{const databasePath=join(base,'family.db');const keyPath=join(base,'vault.key');const archivePath=join(base,'archive');mkdirSync(archivePath,{recursive:true});writeFileSync(databasePath,`${prefix}-db`);writeFileSync(keyPath,`${prefix}-key`);writeFileSync(join(archivePath,'item'),`${prefix}-archive`);return{databasePath,keyPath,archivePath};};
const readSet=(paths)=>[readFileSync(paths.databasePath,'utf8'),readFileSync(paths.keyPath,'utf8'),readFileSync(join(paths.archivePath,'item'),'utf8')];
const makePlan=(base,live,prefix)=>{const transactionId=randomUUID();const stagingDirectory=join(base,`.restore-stage-${transactionId}`);const staged=writeSet(stagingDirectory,prefix);return{transactionId,stagingDirectory,stagedDatabasePath:staged.databasePath,stagedKeyPath:staged.keyPath,stagedArchivePath:staged.archivePath,...live};};
const port=new FileSystemFullBackupFilePort();
const rootTemp=mkdtempSync(join(tmpdir(),'build131-restore-'));
try{
  // Staged database trust revocation.
  const dbPath=join(rootTemp,'reauthorization.db'); const db=new DatabaseSync(dbPath);
  db.exec("CREATE TABLE trusted_devices(id TEXT PRIMARY KEY,revoked_at TEXT);CREATE TABLE database_metadata(key TEXT PRIMARY KEY,value TEXT NOT NULL,updated_at TEXT NOT NULL);");
  db.prepare('INSERT INTO trusted_devices(id,revoked_at) VALUES(?,?)').run('a',null);
  db.prepare('INSERT INTO trusted_devices(id,revoked_at) VALUES(?,?)').run('b',null);
  db.prepare('INSERT INTO trusted_devices(id,revoked_at) VALUES(?,?)').run('c','2026-01-01T00:00:00.000Z');
  db.close();
  const reauth=prepareSqliteRestoredDatabaseForReauthorization(dbPath,'2026-07-27T20:00:00.000Z','runtime-correlation');
  const summary=expectOk(reauth,'reauthorization result');
  verify(summary.revokedTrustedDeviceCount===2,'two active trusted devices revoked');
  const probe=new DatabaseSync(dbPath,{readOnly:true});
  verify(Number(probe.prepare('SELECT COUNT(*) AS count FROM trusted_devices WHERE revoked_at IS NULL').get().count)===0,'no active trusted device remains');
  verify(probe.prepare("SELECT value FROM database_metadata WHERE key='restore_reauthorization_required'").get().value==='1','reauthorization metadata set');
  probe.close();

  // Successful commit keeps new set and removes rollback material.
  const successBase=join(rootTemp,'success');mkdirSync(successBase,{recursive:true});const successLive=writeSet(successBase,'old');const successPlan=makePlan(successBase,successLive,'new');
  const success=port.commitRestore({plan:successPlan,restoredAt:'2026-07-27T20:01:00.000Z',safetyBackupPath:join(successBase,'safety.pptbackup'),revokedTrustedDeviceCount:2},'success-correlation');
  expectOk(success,'successful commit');
  verify(JSON.stringify(readSet(successLive))===JSON.stringify(['new-db','new-key','new-archive']),'new live set installed');
  const marker=JSON.parse(readFileSync(join(successBase,'restore-required-login.json'),'utf8'));
  verify(marker.reauthorizationRequired===true&&marker.trustedDevicesRevoked===true,'restore marker enforces reauthorization');
  verify(marker.revokedTrustedDeviceCount===2,'restore marker records revoked count');
  verify(!existsSync(join(successBase,'restore-transaction.json')),'success journal cleaned');
  verify(recoverInterruptedFullBackupRestore(successLive).action==='none','no recovery needed after clean commit');

  // Marker failure rolls back old data before returning error.
  const failBase=join(rootTemp,'marker-failure');mkdirSync(failBase,{recursive:true});const failLive=writeSet(failBase,'old');const failPlan=makePlan(failBase,failLive,'new');
  mkdirSync(join(failBase,'restore-required-login.json'));
  const failed=port.commitRestore({plan:failPlan,restoredAt:'2026-07-27T20:02:00.000Z',safetyBackupPath:join(failBase,'safety.pptbackup'),revokedTrustedDeviceCount:0},'fail-correlation');
  expectErr(failed,/EISDIR|directory|rename|ENOTEMPTY/iu,'marker failure is returned');
  verify(JSON.stringify(readSet(failLive))===JSON.stringify(['old-db','old-key','old-archive']),'marker failure restores old live set');
  verify(!existsSync(join(failBase,'restore-transaction.json')),'rollback removes journal');
  verify(!existsSync(failPlan.stagingDirectory),'rollback removes staging');

  // Interrupted staged installation is rolled back at next startup.
  const rollbackBase=join(rootTemp,'startup-rollback');mkdirSync(rollbackBase,{recursive:true});const rollbackLive=writeSet(rollbackBase,'old');const rollbackPlan=makePlan(rollbackBase,rollbackLive,'new');
  const tx=rollbackPlan.transactionId;const oldDb=join(rollbackBase,`panthera-family.db.restore-old-${tx}`);const oldKey=join(rollbackBase,`vault.key.restore-old-${tx}`);const oldArchive=join(rollbackBase,`archive.restore-old-${tx}`);
  renameSync(rollbackLive.databasePath,oldDb);renameSync(rollbackLive.keyPath,oldKey);renameSync(rollbackLive.archivePath,oldArchive);renameSync(rollbackPlan.stagedDatabasePath,rollbackLive.databasePath);renameSync(rollbackPlan.stagedKeyPath,rollbackLive.keyPath);renameSync(rollbackPlan.stagedArchivePath,rollbackLive.archivePath);
  const journal={schemaVersion:1,transactionId:tx,phase:'staged-installed',...rollbackLive,stagedDatabasePath:rollbackPlan.stagedDatabasePath,stagedKeyPath:rollbackPlan.stagedKeyPath,stagedArchivePath:rollbackPlan.stagedArchivePath,stagingDirectory:rollbackPlan.stagingDirectory,rollbackDatabasePath:oldDb,rollbackKeyPath:oldKey,rollbackArchivePath:oldArchive,markerPath:join(rollbackBase,'restore-required-login.json'),hadDatabase:true,hadKey:true,hadArchive:true,restoredAt:'2026-07-27T20:03:00.000Z',safetyBackupPath:join(rollbackBase,'safety.pptbackup'),revokedTrustedDeviceCount:1};
  writeFileSync(join(rollbackBase,'restore-transaction.json'),JSON.stringify(journal));
  const recovered=recoverInterruptedFullBackupRestore(rollbackLive);
  verify(recovered.action==='rolled-back','startup recovery selects rollback');
  verify(JSON.stringify(readSet(rollbackLive))===JSON.stringify(['old-db','old-key','old-archive']),'startup recovery restores old set');
  verify(!existsSync(join(rollbackBase,'restore-transaction.json')),'startup rollback journal removed');

  // A committed journal only finishes cleanup and never rolls back new data.
  const cleanupBase=join(rootTemp,'startup-cleanup');mkdirSync(cleanupBase,{recursive:true});const cleanupLive=writeSet(cleanupBase,'new');const cleanupPlan=makePlan(cleanupBase,cleanupLive,'unused');
  const cleanupTx=cleanupPlan.transactionId;const cleanupOld=writeSet(join(cleanupBase,`rollback-${cleanupTx}`),'old');
  const cleanupOldDb=join(cleanupBase,`panthera-family.db.restore-old-${cleanupTx}`);const cleanupOldKey=join(cleanupBase,`vault.key.restore-old-${cleanupTx}`);const cleanupOldArchive=join(cleanupBase,`archive.restore-old-${cleanupTx}`);
  renameSync(cleanupOld.databasePath,cleanupOldDb);renameSync(cleanupOld.keyPath,cleanupOldKey);renameSync(cleanupOld.archivePath,cleanupOldArchive);rmSync(dirname(cleanupOld.databasePath),{recursive:true,force:true});
  const cleanupMarker=join(cleanupBase,'restore-required-login.json');writeFileSync(cleanupMarker,JSON.stringify({restoreTransactionId:cleanupTx}));
  const cleanupJournal={schemaVersion:1,transactionId:cleanupTx,phase:'committed',...cleanupLive,stagedDatabasePath:cleanupPlan.stagedDatabasePath,stagedKeyPath:cleanupPlan.stagedKeyPath,stagedArchivePath:cleanupPlan.stagedArchivePath,stagingDirectory:cleanupPlan.stagingDirectory,rollbackDatabasePath:cleanupOldDb,rollbackKeyPath:cleanupOldKey,rollbackArchivePath:cleanupOldArchive,markerPath:cleanupMarker,hadDatabase:true,hadKey:true,hadArchive:true,restoredAt:'2026-07-27T20:04:00.000Z',safetyBackupPath:join(cleanupBase,'safety.pptbackup'),revokedTrustedDeviceCount:1};
  writeFileSync(join(cleanupBase,'restore-transaction.json'),JSON.stringify(cleanupJournal));
  const cleaned=recoverInterruptedFullBackupRestore(cleanupLive);
  verify(cleaned.action==='committed-cleanup','startup recovery selects committed cleanup');
  verify(JSON.stringify(readSet(cleanupLive))===JSON.stringify(['new-db','new-key','new-archive']),'committed cleanup preserves new set');
  verify(!existsSync(cleanupOldDb)&&!existsSync(cleanupOldKey)&&!existsSync(cleanupOldArchive),'committed cleanup removes rollback material');
  verify(!existsSync(join(cleanupBase,'restore-transaction.json')),'committed cleanup removes journal');
}finally{rmSync(rootTemp,{recursive:true,force:true});await rm(temp,{recursive:true,force:true});}
const packageJson=JSON.parse(readFileSync(join(root,'package.json'),'utf8'));
const appMetaSource=readFileSync(join(root,'packages','domain','src','app-meta.ts'),'utf8');
const applicationVersion=/version: '([^']+)'/u.exec(appMetaSource)?.[1]??null;
const evidence={schemaVersion:1,product:'Anadolu Parsı Aile Yaşam Merkezi',applicationVersion,packageVersion:packageJson.version,baselineBuild:131,checks,status:failures.length?'FAIL':'PASS',failures,generatedAt:new Date().toISOString()};
await mkdir(join(root,'artifacts','validation'),{recursive:true});
await writeFile(join(root,'artifacts','validation','build131-restore-transaction-runtime.json'),JSON.stringify(evidence,null,2)+'\n');
if(failures.length){for(const failure of failures)console.error(`- ${failure}`);process.exit(1);}console.log(`Build 131 restore transaction runtime verified: ${checks}/${checks} PASS.`);

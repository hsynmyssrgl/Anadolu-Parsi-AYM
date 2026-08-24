import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';

const output=process.argv[2]??'artifacts/validation/build210-clean-rewrite-terminal-ledger-immutability-contract.json';
const files={
  migration:await readFile('packages/database/src/family-database-migrations.ts','utf8'),
  decision:await readFile('docs/decisions/DEC-100-clean-backup-terminal-ledger-immutability.md','utf8'),
  adr:await readFile('docs/adr/ADR-083-clean-backup-terminal-ledger-immutability.md','utf8'),
  spec:await readFile('docs/CLEAN_BACKUP_REWRITE_TERMINAL_LEDGER_IMMUTABILITY_V1.md','utf8'),
  status:await readFile('BUILD_STATUS_BRONZE_RC2_BUILD210.md','utf8'),
  release:await readFile('RELEASE_NOTES_BRONZE_RC2_BUILD210.md','utf8'),
  packageJson:await readFile('package.json','utf8'),
  appMeta:await readFile('packages/domain/src/app-meta.ts','utf8'),
  releaseLedger:await readFile('config/release-ledger.json','utf8'),
  preflight:await readFile('config/source-preflight-checks.json','utf8')
};
const activeRelease=JSON.parse(files.releaseLedger).current;
const assertions=[
  ['migration 49 definition',/createMigrationDefinition\(49, 'clean_backup_rewrite_terminal_ledger_immutability'/.test(files.migration)],
  ['terminal UPDATE trigger',files.migration.includes('trg_backup_clean_rewrite_runs_terminal_immutable_update')&&files.migration.includes('BEFORE UPDATE ON backup_clean_rewrite_runs')],
  ['terminal DELETE trigger',files.migration.includes('trg_backup_clean_rewrite_runs_terminal_immutable_delete')&&files.migration.includes('BEFORE DELETE ON backup_clean_rewrite_runs')],
  ['terminal REPLACE guard',files.migration.includes('trg_backup_clean_rewrite_runs_terminal_replace_guard')&&files.migration.includes('BEFORE INSERT ON backup_clean_rewrite_runs')],
  ['terminal predicate',files.migration.includes("OLD.status<>'running'")],
  ['replace existing terminal predicate',files.migration.includes("existing.id=NEW.id AND existing.status<>'running'")],
  ['no-op aware comparisons',files.migration.includes('NEW.updated_at IS NOT OLD.updated_at')&&files.migration.includes('NEW.error IS NOT OLD.error')],
  ['fail closed update error',files.migration.includes('terminal clean rewrite ledger is immutable')],
  ['fail closed delete error',files.migration.includes('terminal clean rewrite ledger cannot be deleted')],
  ['fail closed replace error',files.migration.includes('terminal clean rewrite ledger cannot be replaced')],
  ['revision marker',files.migration.includes('REVISION-210-CLEAN-BACKUP-TERMINAL-LEDGER-IMMUTABILITY')],
  ['decision record',files.decision.includes('DEC-100')&&files.decision.includes('INSERT OR REPLACE')&&files.decision.includes('no-op')],
  ['ADR record',files.adr.includes('ADR-083')&&files.adr.includes('recursive_triggers=0')&&files.adr.includes('running → terminal')],
  ['technical spec',files.spec.includes('Terminal Ledger Immutability V1')&&files.spec.includes('running → terminal')],
  ['build status version',files.status.includes('01.08.2026.210')&&files.status.includes('1.8.2026-210')&&files.status.includes('Migrasyon: **49**')],
  ['release notes behavior',files.release.includes('UPDATE')&&files.release.includes('DELETE')&&files.release.includes('INSERT OR REPLACE')&&files.release.includes('no-op')],
  ['package version matches active monthly release',JSON.parse(files.packageJson).version===activeRelease.packageVersion],
  ['APP_META display version matches active monthly release',files.appMeta.includes(`version: '${activeRelease.version}'`)],
  ['APP_META preserves active Bronze development stage',files.appMeta.includes("stage: 'Aktif Geliştirme'")],
  ['preflight includes Build210 contract',files.preflight.includes('build210-clean-rewrite-terminal-ledger-immutability-contract')],
  ['preflight includes Build210 sqlite runtime',files.preflight.includes('build210-clean-rewrite-terminal-ledger-immutability-sqlite-runtime')]
];
const failures=assertions.filter(([,ok])=>!ok).map(([label])=>label);
const report={schemaVersion:2,product:'ParsYuva Aile Yaşam Merkezi',featureBuild:210,historicalFeatureVersion:'01.08.2026.210',activeRelease:activeRelease.visibleRelease,activeReleaseId:activeRelease.releaseId,packageVersion:activeRelease.packageVersion,status:failures.length?'FAIL':'PASS',passed:assertions.length-failures.length,total:assertions.length,assertions:assertions.map(([label,ok])=>({label,status:ok?'PASS':'FAIL'})),failures,generatedAt:new Date().toISOString()};
await mkdir(dirname(output),{recursive:true});await writeFile(output,JSON.stringify(report,null,2)+'\n');
if(failures.length){console.error(`Build 210 contract FAIL (${report.passed}/${report.total})`,failures);process.exit(1)}
console.log(`Build 210 contract PASS (${report.passed}/${report.total})`);

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
const output=process.argv[2]??'artifacts/validation/build204-clean-rewrite-propagation-replace-bypass-contract.json';
const files={
 migration:await readFile('packages/database/src/family-database-migrations.ts','utf8'),
 decision:await readFile('docs/decisions/DEC-094-clean-backup-rewrite-propagation-replace-bypass-protection.md','utf8'),
 adr:await readFile('docs/adr/ADR-077-clean-backup-rewrite-propagation-replace-bypass-protection.md','utf8'),
 status:await readFile('BUILD_STATUS_BRONZE_RC2_BUILD204.md','utf8'),
 release:await readFile('RELEASE_NOTES_BRONZE_RC2_BUILD204.md','utf8'),
 appMeta:await readFile('packages/domain/src/app-meta.ts','utf8')
};
const assertions=[
 ['migration 48 definition',/createMigrationDefinition\(48, 'clean_backup_rewrite_propagation_replace_bypass_protection'/.test(files.migration)],
 ['before insert trigger',files.migration.includes('BEFORE INSERT ON backup_propagation_runs')],
 ['referenced id predicate',files.migration.includes('propagation_run_id=NEW.id')],
 ['fail closed error',files.migration.includes('referenced clean rewrite propagation cannot be replaced')],
 ['revision marker',files.migration.includes('REVISION-204-CLEAN-BACKUP-PROPAGATION-REPLACE-BYPASS-PROTECTION')],
 ['decision record',files.decision.includes('DEC-094')&&files.decision.includes('INSERT OR REPLACE')],
 ['ADR record',files.adr.includes('ADR-077')&&files.adr.includes('recursive_triggers')],
 ['build status version',files.status.includes('01.08.2026.204')&&files.status.includes('1.8.2026-204')],
 ['build status migration',files.status.includes('Migrasyon: 48')],
 ['release notes bypass',files.release.includes('REPLACE')&&files.release.includes('Migrasyon 48')],
 ['APP_META display version',files.appMeta.includes("version: '01.08.2026.204'")],
 ['APP_META build stage',files.appMeta.includes("Build 204'")]
];
const failures=assertions.filter(([,ok])=>!ok).map(([label])=>label);
const report={schemaVersion:1,product:'Anadolu Parsı Aile Yaşam Merkezi',featureBuild:204,status:failures.length?'FAIL':'PASS',passed:assertions.length-failures.length,total:assertions.length,assertions:assertions.map(([label,ok])=>({label,status:ok?'PASS':'FAIL'})),failures,generatedAt:new Date().toISOString()};
await mkdir(dirname(output),{recursive:true});await writeFile(output,JSON.stringify(report,null,2)+'\n');
if(failures.length){console.error(`Build 204 contract FAIL (${report.passed}/${report.total})`,failures);process.exit(1)}
console.log(`Build 204 contract PASS (${report.passed}/${report.total})`);

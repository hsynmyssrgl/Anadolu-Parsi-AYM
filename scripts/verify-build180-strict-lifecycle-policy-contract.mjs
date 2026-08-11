import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';
const out=process.argv[2]??'artifacts/validation/build180-strict-lifecycle-policy-contract.json';
const activeDocs=[
 'README.md','START_HERE_TR.md','BUILD_STATUS.md','DELIVERY_SUMMARY_TR.md','PAKET_OZETI_TR.md','VERIFICATION_REPORT.md',
 'CONTRIBUTING.md','SECURITY.md','docs/00_SCOPE_FREEZE.md','docs/01_TECHNICAL_STACK.md','docs/02_SECURITY_BASELINE.md',
 'docs/03_TEST_AND_ACCEPTANCE.md','docs/04_RELEASE_PLAN.md','docs/05_DEFINITION_OF_DONE.md','docs/06_OPEN_ITEMS_AFTER_CODING_START.md',
 'docs/07_BRONZE_REQUIREMENTS_TRACEABILITY.md','docs/09_ACTIVE_DEVELOPMENT_STATUS.md','docs/10_MASTER_DECISION_REGISTER.md',
 'docs/11_DOCUMENT_AUTHORITY_MATRIX.md','docs/12_PRODUCT_SCOPE_AND_MODULE_CATALOG.md','docs/13_UI_UX_ACCESSIBILITY_STANDARD.md',
 'docs/14_SECURITY_PRIVACY_BACKUP_STANDARD.md','docs/15_RELEASE_VALIDATION_GOVERNANCE.md','docs/16_STRICT_PRODUCT_LIFECYCLE_POLICY.md',
 'docs/adr/ADR-052-release-channel-menu-color-and-family-relationship-catalog.md','docs/adr/ADR-053-strict-bronze-development-and-api-deferral-governance.md'
];
const paths=['config/product-lifecycle-policy.json','config/deferred-api-integrations.json','packages/domain/src/product-lifecycle-policy.ts',...activeDocs];
const files=Object.fromEntries(await Promise.all(paths.map(async p=>[p,await readFile(p,'utf8')])));
const policy=JSON.parse(files['config/product-lifecycle-policy.json']);
const deferred=JSON.parse(files['config/deferred-api-integrations.json']);
const checks=[];const check=(name,condition)=>checks.push({name,status:condition?'PASS':'FAIL'});const has=(p,t)=>files[p].includes(t);
check('policy id is immutable',policy.policyId==='PPT-LIFECYCLE-STRICT-V1'&&policy.immutable===true);
check('new development channel is Bronze',policy.rules?.newProductDevelopmentChannel==='bronze');
check('Silver planned capabilities are Bronze required',policy.rules?.allSilverPlannedCapabilitiesMustBeImplementedInBronze===true);
check('Gold planned capabilities are Bronze required',policy.rules?.allGoldPlannedCapabilitiesMustBeImplementedInBronze===true);
check('Silver work is limited',JSON.stringify(policy.rules?.silverAllowedWork)===JSON.stringify(['infrastructure_improvement','test_execution','defect_fix']));
check('Gold work is limited',JSON.stringify(policy.rules?.goldAllowedWork)===JSON.stringify(['release_packaging','production_operations','critical_defect_fix']));
check('API deferral is heavy-only',policy.rules?.apiDeferral?.allowedOnlyForHeavyExternalApiIntegration===true);
check('API deferral target remains Bronze',policy.rules?.apiDeferral?.targetChannelRemainsBronze===true);
check('API readiness has seven mandatory boundaries',policy.rules?.apiDeferral?.requiredArchitectureReadiness?.length===7);
check('domain policy exports strict identifier',has('packages/domain/src/product-lifecycle-policy.ts',"STRICT_PRODUCT_LIFECYCLE_POLICY_ID = 'PPT-LIFECYCLE-STRICT-V1'"));
check('domain policy restricts new capability to Bronze',has('packages/domain/src/product-lifecycle-policy.ts',"channel === NEW_PRODUCT_DEVELOPMENT_CHANNEL"));
check('domain policy validates every API readiness field',has('packages/domain/src/product-lifecycle-policy.ts','for (const field of readinessFields)'));
check('deferred integrations target Bronze',deferred.targetChannel==='bronze');
check('deferred integrations are heavy API only',deferred.integrations.every(x=>x.externalApiRequired===true&&x.heavyIntegration===true));
check('every deferred integration has full readiness',deferred.integrations.every(x=>Object.values(x.readiness??{}).length===7&&Object.values(x.readiness??{}).every(Boolean)));
check('menu color decision remains recorded',has('docs/adr/ADR-052-release-channel-menu-color-and-family-relationship-catalog.md','Bronze bakır/bronz, Silver gümüş, Gold altın'));
check('family relationship decision remains recorded',has('docs/adr/ADR-052-release-channel-menu-color-and-family-relationship-catalog.md','referans kişiye göre seçilir'));
check('master register contains all three strict decisions',has('docs/10_MASTER_DECISION_REGISTER.md','DEC-068')&&has('docs/10_MASTER_DECISION_REGISTER.md','DEC-069')&&has('docs/10_MASTER_DECISION_REGISTER.md','DEC-070'));
check('authority matrix includes strict policy',has('docs/11_DOCUMENT_AUTHORITY_MATRIX.md','docs/16_STRICT_PRODUCT_LIFECYCLE_POLICY.md'));
check('historical documents are not active authority',has('docs/11_DOCUMENT_AUTHORITY_MATRIX.md','Tarihsel belge, aktif kayda aykırıysa aktif karar uygulanır'));
for(const p of activeDocs) check(`${p} references strict policy`,has(p,'PPT-LIFECYCLE-STRICT-V1'));
const forbiddenPatterns=[/Silver[^\n]{0,80}(yeni özellik eklenir|ürün geliştirilir|modül eklenir)/i,/Gold[^\n]{0,80}(yeni özellik eklenir|ürün geliştirilir|modül eklenir)/i];
for(const p of activeDocs){for(const pattern of forbiddenPatterns)check(`${p} has no conflicting lifecycle statement ${pattern}`,!pattern.test(files[p]));}
const failures=checks.filter(x=>x.status==='FAIL');const report={schemaVersion:1,product:'Anadolu Parsı Aile Yaşam Merkezi',build:180,status:failures.length?'FAIL':'PASS',checks:checks.length,passed:checks.length-failures.length,failures,scenarios:checks,generatedAt:new Date().toISOString()};
await mkdir(dirname(out),{recursive:true});await writeFile(out,JSON.stringify(report,null,2)+'\n');if(failures.length){console.error(JSON.stringify(report,null,2));process.exit(1);}console.log(`Build 180 strict lifecycle policy contract: PASS (${checks.length}/${checks.length})`);

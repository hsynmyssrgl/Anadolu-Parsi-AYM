import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { analyzeProductSurfaceGovernance } from './lib/product-surface-governance-analysis.mjs';

const readText = async (path) => {
  try { return await readFile(path, 'utf8'); }
  catch { return ''; }
};
const readJson = async (path) => {
  const source = await readText(path);
  if (!source) return undefined;
  try { return JSON.parse(source.replace(/^\uFEFF/u, '')); }
  catch { return undefined; }
};
const exactArray = (actual, expected) => Array.isArray(actual)
  && actual.length === expected.length
  && expected.every((item, index) => actual[index] === item);
const includesAll = (source, markers) => markers.every((marker) => source.includes(marker));

export const verifyB0ProductSurfaceGovernanceContract = async (root = process.cwd()) => {
  const read = (path) => readText(resolve(root, path));
  const json = (path) => readJson(resolve(root, path));
  const [
    scope, inventory, registry, ledger, packageJson, domain, application, repositoryContract,
    repository, domainIndex, applicationIndex, contractIndex, repositoryIndex, compositionRoot, main, preload,
    globalTypes, ipcPolicy, app, applicationTest, integrationTest, decisionDocument, threatModel,
    auditDocument, currentContract, masterRegister, productCatalog, authorityMatrix,
    uiStandard, traceability, migrations
  ] = await Promise.all([
    json('config/32-w-b0-03-b0-04-product-surface-governance-scope.json'),
    json('config/32-w-b0-03-b0-04-product-surface-governance-inventory.json'),
    json('config/accepted-scope-registry.json'),
    json('config/user-decision-ledger.json'),
    json('package.json'),
    read('packages/domain/src/product-surface-governance.ts'),
    read('packages/application/src/product-surface-governance-use-cases.ts'),
    read('packages/repository-contracts/src/product-surface-governance-repository.ts'),
    read('packages/repositories/src/product-surface-governance-repository.ts'),
    read('packages/domain/src/index.ts'),
    read('packages/application/src/index.ts'),
    read('packages/repository-contracts/src/index.ts'),
    read('packages/repositories/src/index.ts'),
    read('apps/desktop/src/main/repository-composition-root.ts'),
    read('apps/desktop/src/main/main.ts'),
    read('apps/desktop/src/main/preload.ts'),
    read('apps/desktop/src/renderer/global.d.ts'),
    read('apps/desktop/src/main/ipc-integration-policy.ts'),
    read('apps/desktop/src/renderer/App.tsx'),
    read('packages/application/tests/product-surface-governance-use-cases.test.ts'),
    read('apps/desktop/tests/b0-product-surface-governance-integration.test.ts'),
    read('docs/decisions/DEC-208-b0-03-b0-04-product-surface-governance.md'),
    read('docs/security/B0-03_B0-04_PRODUCT_SURFACE_GOVERNANCE_THREAT_MODEL.md'),
    read('docs/audit/32-W_B0-03_B0-04_PRODUCT_SURFACE_GOVERNANCE_UST_KAPANIS.md'),
    read('docs/current/PRODUCT_NAVIGATION_AND_FEATURE_REALITY_CONTRACT.md'),
    read('docs/10_MASTER_DECISION_REGISTER.md'),
    read('docs/12_PRODUCT_SCOPE_AND_MODULE_CATALOG.md'),
    read('docs/11_DOCUMENT_AUTHORITY_MATRIX.md'),
    read('docs/13_UI_UX_ACCESSIBILITY_STANDARD.md'),
    read('docs/07_BRONZE_REQUIREMENTS_TRACEABILITY.md'),
    read('packages/database/src/family-database-migrations.ts')
  ]);
  const analysis = await analyzeProductSurfaceGovernance(root);
  const checks = [];
  const failures = [];
  const check = (name, condition, detail) => {
    const passed = Boolean(condition);
    checks.push({ name, passed, ...(detail === undefined ? {} : { detail }) });
    if (!passed) failures.push(name);
  };
  const b003 = registry?.requirements?.find((item) => item.id === 'B0-03');
  const b004 = registry?.requirements?.find((item) => item.id === 'B0-04');
  const b901 = registry?.requirements?.find((item) => item.id === 'B9-01');
  const decision = ledger?.decisions?.find((item) => item.id === 'DEC-208');
  const migrationVersions = [...migrations.matchAll(/createMigrationDefinition\((\d+),/gu)]
    .map((match) => Number.parseInt(match[1], 10));
  const latestMigration = migrationVersions.length ? Math.max(...migrationVersions) : undefined;

  check('scope identity and status are exact', scope?.schemaVersion === 1 && scope?.id === '32-W-B0-03-B0-04-PRODUCT-SURFACE-GOVERNANCE' && scope?.status === 'COMPLETE');
  check('scope closes exactly B0-03 and B0-04', exactArray(scope?.requirements, ['B0-03', 'B0-04']));
  check('scope canonical counts are exact', JSON.stringify(scope?.canonicalCounts) === JSON.stringify({ productModules: 17, governanceSurfaces: 5, navigationRoutes: 22, menuEntries: 22, renderedScreens: 22, classifiedUnusedRendererApis: 14, unresolvedUnusedRendererApis: 0 }));
  check('scope explicitly excludes B9-01 and records final validation truth', scope?.excludedClaims?.includes('B9-01 tamamlanmis sayilmaz.') && scope?.excludedClaims?.includes('Silver veya Bronze Final hazirligi iddia edilmez.') && scope?.validation?.fullVitestFilesPassed === 93 && scope?.validation?.fullVitestTestsPassed === 829 && scope?.validation?.productionWorkspaceBuildsPassed === 18 && scope?.validation?.pretypecheckSecurityGatesPassed === 16);
  check('inventory identity is exact', inventory?.schemaVersion === 1 && inventory?.id === '32-W-PRODUCT-SURFACE-GOVERNANCE-INVENTORY');
  check('inventory contains exact 22 unique routes', inventory?.routes?.length === 22 && new Set(inventory.routes.map((item) => item.id)).size === 22);
  check('inventory contains exact 17 product and 5 governance routes', inventory?.routes?.filter((item) => item.kind === 'product-module').length === 17 && inventory?.routes?.filter((item) => item.kind === 'governance-surface').length === 5);
  check('inventory contains exact 14 unique unused APIs', inventory?.unusedRendererApis?.length === 14 && new Set(inventory.unusedRendererApis.map((item) => `${item.method}:${item.channel}`)).size === 14);
  check('source analyzer passes all fail-closed checks', analysis.status === 'PASS' && analysis.checksFailed === 0, analysis.failures);
  check('source analyzer proves route-menu-screen equality', analysis.routeCount === 22 && analysis.menuEntryCount === 22 && analysis.renderedScreenCount === 22);
  check('source analyzer proves 14 classified and zero unresolved APIs', analysis.classifiedUnusedRendererApiCount === 14 && analysis.unresolvedUnusedRendererApiCount === 0);
  check('source analyzer negative self-tests all pass', Object.values(analysis.selfTests).every(Boolean));
  check('domain owns immutable route and API contracts', includesAll(domain, ['PRODUCT_NAVIGATION_GROUPS', 'PRODUCT_NAVIGATION_ROUTES', 'CLASSIFIED_UNUSED_RENDERER_APIS', 'createProductSurfaceGovernanceView']));
  check('application use case enforces count and unresolved invariants', includesAll(application, ['GetProductSurfaceGovernanceUseCase', "view.enforcement !== 'fail-closed'", 'view.unresolvedUnusedRendererApiCount !== 0']));
  check('repository contract and implementation are explicit', repositoryContract.includes('ProductSurfaceGovernanceRepositoryPort') && repository.includes('StaticProductSurfaceGovernanceRepository'));
  check('all package indexes export the new boundary', domainIndex.includes("./product-surface-governance.js") && applicationIndex.includes("./product-surface-governance-use-cases.js") && contractIndex.includes("./product-surface-governance-repository.js") && repositoryIndex.includes("./product-surface-governance-repository.js"));
  check('main composes use case through the authorized repository composition root', includesAll(main, ['GetProductSurfaceGovernanceUseCase', 'createProductSurfaceGovernanceRepository', "registerIpcHandler('system:getProductSurfaceGovernance'"]) && includesAll(compositionRoot, ['StaticProductSurfaceGovernanceRepository', 'createProductSurfaceGovernanceRepository']));
  check('preload and declarations expose the exact typed method', preload.includes("getProductSurfaceGovernance:():Promise<ProductSurfaceGovernanceView>=>invoke('system:getProductSurfaceGovernance')") && globalTypes.includes('getProductSurfaceGovernance():Promise<ProductSurfaceGovernanceView>'));
  check('IPC integration policy permits zero arguments only', ipcPolicy.includes("case 'system:getProductSurfaceGovernance':") && integrationTest.includes("evaluateIpcIntegrationPolicy('system:getProductSurfaceGovernance', ['unexpected'])"));
  check('renderer derives menu and consumes governance state', includesAll(app, ['PRODUCT_NAVIGATION_ROUTES.map', 'PRODUCT_NAVIGATION_GROUPS.map', 'getProductSurfaceGovernance()', 'setProductSurfaceGovernance(', 'B0-03 / B0-04 · ürün yüzeyi gerçeklik kapısı']));
  check('renderer has no duplicate literal route or menu registry', !/type ScreenId\s*=\s*\n\s*\|/u.test(app) && !/const navItems[^=]*=\s*\[/u.test(app));
  check('targeted tests cover success and fail-closed mutation paths', includesAll(applicationTest, ['17 product + 5 governance = 22', 'fails closed when route', 'fails closed when an unused renderer API']) && includesAll(integrationTest, ['shared domain navigation contract', 'zero-argument governance IPC', 'current 14 API set']));
  check('B0-03 registry entry is COMPLETE with full chain', b003?.status === 'COMPLETE' && Object.keys(b003.chain ?? {}).length === 13 && Object.values(b003.chain ?? {}).every((value) => value === true));
  check('B0-04 registry entry is COMPLETE with full chain', b004?.status === 'COMPLETE' && Object.keys(b004.chain ?? {}).length === 13 && Object.values(b004.chain ?? {}).every((value) => value === true));
  check('both registry entries contain final contract and runtime evidence', [b003, b004].every((item) => item?.evidence?.includes('artifacts/validation/32-W-b0-03-b0-04-product-surface-governance-contract.json') && item?.evidence?.includes('artifacts/validation/32-W-b0-03-b0-04-product-surface-governance-runtime.json')));
  check('B9-01 remains honestly open', b901?.status !== 'COMPLETE');
  check('DEC-208 is active and covers both requirements', decision?.status === 'ACTIVE' && exactArray(decision?.requirements, ['B0-03', 'B0-04']));
  check('decision ledger count is internally exact', ledger?.decisionCount >= 62 && ledger?.decisionCount === ledger?.decisions?.length);
  check('master register records DEC-208 and its exact document', masterRegister.includes('## DEC-208') && masterRegister.includes('DEC-208-b0-03-b0-04-product-surface-governance.md'));
  check('decision document records the canonical classification and fail-closed gate', includesAll(decisionDocument, ['17 ürün', '5 yönetişim', 'exact 14 API', 'Fail-closed', 'B9-01']));
  check('threat model covers dead UI, dead API and false COMPLETE', includesAll(threatModel, ['Dead UI', 'Dead API', 'Yanlış COMPLETE', 'negatif öz-test']));
  check('audit document records two closed requirements and honest B9-01 boundary', includesAll(auditDocument, ['B0-03', 'B0-04', 'B9-01', 'latest migration 77']));
  check('current contract contains all 22 routes and 14 API rows', inventory?.routes?.every((item) => currentContract.includes(`| ${item.id} |`)) && inventory?.unusedRendererApis?.every((item) => currentContract.includes(`| ${item.method} | ${item.channel} |`)) && includesAll(currentContract, ['17 ürün modülü', '5 yönetişim', '14, çözümlenmemiş kayıt sayısı 0']));
  check('current product documents agree on 17 + 5 = 22', includesAll(productCatalog, ['17 ürün modülü + 5 yönetişim yüzeyi', 'Kanonik gezinti sözleşmesi 22 rota']) && authorityMatrix.includes('17 ürün modülü, 5 yönetişim yüzeyi') && uiStandard.includes('toplam 22 kanonik rota') && traceability.includes('17 ürün modülü + 5 yönetişim yüzeyi = 22'));
  check('root exposes all four B0 package scripts', ['verify:surface-governance:boundary', 'verify:b0-surface-governance:targeted', 'verify:b0-surface-governance:contract', 'verify:b0-surface-governance:runtime'].every((name) => typeof packageJson?.scripts?.[name] === 'string'));
  check('pretypecheck and prebuild execute the product surface gate', packageJson?.scripts?.pretypecheck?.includes('verify-product-surface-governance.mjs') && packageJson?.scripts?.prebuild?.includes('verify-product-surface-governance.mjs'));
  check('build executes the surface gate before governed preflight', packageJson?.scripts?.prebuild?.indexOf('verify-product-surface-governance.mjs') >= 0 && packageJson.scripts.prebuild.indexOf('verify-product-surface-governance.mjs') < packageJson.scripts.prebuild.indexOf('require-current-governed-preflight.mjs'));
  check('no package-owned repository persistence or migration was added', scope?.schemaDecision?.includes('kullanici verisi') && scope?.migrationDecision?.includes("migration'i gerekmez") && migrationVersions.includes(77) && latestMigration >= 77);
  check('scope denies data migration, backfill and cutover', scope?.migrationDecision?.includes('veri tasima/backfill/cutover yapilmaz'));

  return Object.freeze({
    schemaVersion: 1,
    step: '32-W',
    requirements: Object.freeze(['B0-03', 'B0-04']),
    status: failures.length === 0 ? 'PASS' : 'FAIL',
    checksPassed: checks.filter((item) => item.passed).length,
    checksFailed: failures.length,
    checks: Object.freeze(checks),
    failures: Object.freeze(failures),
    analysis,
    latestDatabaseMigration: latestMigration,
    requirementCompletionClaimed: failures.length === 0,
    b901CompletedByThisPackage: false,
    generatedAt: new Date().toISOString()
  });
};

const report = await verifyB0ProductSurfaceGovernanceContract();
await mkdir('artifacts/validation', { recursive: true });
await writeFile('artifacts/validation/32-W-b0-03-b0-04-product-surface-governance-contract.json', `${JSON.stringify(report, null, 2)}\n`);
console.log(`B0-03/B0-04 product surface contract: ${report.status} (${report.checksPassed}/${report.checks.length} checks).`);
if (report.status !== 'PASS') {
  console.error(report.failures.join('\n'));
  process.exitCode = 1;
}

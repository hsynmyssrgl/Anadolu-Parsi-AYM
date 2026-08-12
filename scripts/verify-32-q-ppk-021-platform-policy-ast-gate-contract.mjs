import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { runPlatformPolicyAstGate } from './verify-platform-policy-ast-gate.mjs';

const candidateMode = process.argv.includes('--candidate');
const readText = (path) => readFile(path, 'utf8');
const readJson = async (path) => JSON.parse(await readText(path));
const [
  scope, inventory, allowlist, registry, ledger, rootPackage, lockfile,
  scanner, gateScript, legacyGate, policy, policyIndex, domain, domainIndex,
  useCase, applicationIndex, policyTest, astTest, integrationTest, main, preload,
  globalTypes, renderer, ipcPolicy, ipcCache, decision, threat, audit,
  masterRegister, migrations
] = await Promise.all([
  readJson('config/32-q-ppk-021-platform-policy-ast-gate-scope.json'),
  readJson('config/32-q-ppk-021-platform-policy-ast-gate-inventory.json'),
  readJson('config/32-q-ppk-021-platform-policy-ast-allowlist.json'),
  readJson('config/accepted-scope-registry.json'),
  readJson('config/user-decision-ledger.json'),
  readJson('package.json'),
  readJson('package-lock.json'),
  readText('scripts/lib/platform-policy-ast-scanner.mjs'),
  readText('scripts/verify-platform-policy-ast-gate.mjs'),
  readText('scripts/verify-platform-policy-gate.mjs'),
  readText('packages/platform-policy/src/platform-policy-ast-gate-policy.ts'),
  readText('packages/platform-policy/src/index.ts'),
  readText('packages/domain/src/platform-policy-ast-gate.ts'),
  readText('packages/domain/src/index.ts'),
  readText('packages/application/src/platform-policy-ast-gate-use-cases.ts'),
  readText('packages/application/src/index.ts'),
  readText('packages/platform-policy/platform-policy-ast-gate-policy.test.ts'),
  readText('apps/desktop/tests/ppk021-platform-policy-ast-gate.test.ts'),
  readText('apps/desktop/tests/ppk021-platform-policy-ast-gate-integration.test.ts'),
  readText('apps/desktop/src/main/main.ts'),
  readText('apps/desktop/src/main/preload.ts'),
  readText('apps/desktop/src/renderer/global.d.ts'),
  readText('apps/desktop/src/renderer/App.tsx'),
  readText('apps/desktop/src/main/ipc-integration-policy.ts'),
  readText('apps/desktop/src/main/ipc-read-sharing.ts'),
  readText('docs/decisions/DEC-202-ppk-021-platform-policy-ast-fail-gate.md'),
  readText('docs/security/PPK-021_PLATFORM_POLICY_AST_FAIL_GATE_THREAT_MODEL.md'),
  readText('docs/audit/32-Q_PPK-021_PLATFORM_POLICY_AST_FAIL_GATE_UST_KAPANIS.md'),
  readText('docs/10_MASTER_DECISION_REGISTER.md'),
  readText('packages/database/src/family-database-migrations.ts')
]);

const gate = await runPlatformPolicyAstGate();
const failures = [];
const checks = [];
const check = (name, condition) => {
  checks.push({ name, passed: Boolean(condition) });
  if (!condition) failures.push(name);
};
const includesAll = (source, markers) => markers.every((marker) => source.includes(marker));
const requirement = registry.requirements.find((item) => item.id === 'PPK-021');
const prior = ['PPK-012', 'PPK-013', 'PPK-014', 'PPK-015', 'PPK-016', 'PPK-017', 'PPK-018', 'PPK-019', 'PPK-020']
  .map((id) => registry.requirements.find((item) => item.id === id));
const successor = registry.requirements.find((item) => item.id === 'PPK-022');
const versions = [...migrations.matchAll(/createMigrationDefinition\((\d+),/gu)].map((match) => Number.parseInt(match[1], 10));
const latestMigration = Math.max(...versions);
const manifestBody = await readFile('config/32-q-ppk-021-platform-policy-ast-allowlist.json');
const manifestSha256 = createHash('sha256').update(manifestBody).digest('hex');
const keys = allowlist.allowedSurfaceKeys ?? [];
const sortedKeys = [...keys].sort((left, right) => left.localeCompare(right, 'en'));
const uniqueKeys = new Set(keys);
const keyCounts = Object.fromEntries([...new Set(keys.map((key) => key.split('|', 1)[0]))]
  .sort((left, right) => left.localeCompare(right, 'en'))
  .map((kind) => [kind, keys.filter((key) => key.startsWith(`${kind}|`)).length]));

check('scope identity is exact', scope.step === '32-Q' && scope.requirement === 'PPK-021');
check('inventory identity is exact', inventory.step === '32-Q' && inventory.requirement === 'PPK-021');
check('allowlist identity is exact', allowlist.step === '32-Q' && allowlist.requirement === 'PPK-021');
check('accepted registry contains PPK-021', requirement !== undefined);
check('PPK-012 through PPK-020 remain complete', prior.every((item) => item?.status === 'COMPLETE'));
check('PPK-022 remains a distinct successor requirement', successor !== undefined && successor.id !== scope.requirement);

check('AST parser dependency is explicit and exact', rootPackage.devDependencies?.['@babel/parser'] === '7.29.8');
check('lockfile root records exact parser dependency', lockfile.packages?.['']?.devDependencies?.['@babel/parser'] === '7.29.8');
check('installed parser record is locked', lockfile.packages?.['node_modules/@babel/parser']?.version === '7.29.8');
check('manifest requires exact default deny', allowlist.defaultDecision === 'DENY' && allowlist.exactMatchRequired === true && allowlist.wildcardsAllowed === false);
check('manifest binds eighteen production zones', allowlist.productionSourceZoneCount === 18 && scope.boundaries?.productionSourceZoneCount === 18);
check('manifest contains exactly 545 surfaces', keys.length === 545 && uniqueKeys.size === 545);
check('manifest keys are stable sorted', keys.every((key, index) => key === sortedKeys[index]));
check('manifest keys contain no wildcard', keys.every((key) => !/[*?\[\]{}]/u.test(key)));
check('manifest count map is exact', JSON.stringify(keyCounts) === JSON.stringify(allowlist.expectedSurfaceCounts));
check('manifest SHA-256 binds scope and inventory', manifestSha256 === scope.boundaries?.exactAllowlistSha256 && manifestSha256 === inventory.engine?.exactAllowlistSha256);
check('every observed category has a rationale', Object.keys(keyCounts).every((kind) => typeof allowlist.categoryRationales?.[kind] === 'string' && allowlist.categoryRationales[kind].length >= 12));
check('manifest records no persistence or ownership change', allowlist.invariants?.migrationRequired === false && allowlist.invariants?.latestDatabaseMigration === 77 && allowlist.invariants?.sqliteOwnershipTransferred === false);

check('production AST gate passes', gate.status === 'PASS' && gate.findings.length === 0);
check('gate scans all production zones', gate.productionSourceZones === 18 && gate.scannedFiles >= 352);
check('gate exact surface and allowance cardinality match', gate.privilegedSurfaces === 545 && gate.exactAllowlistEntries === 545);
check('gate manifest hash matches the canonical file', gate.exactAllowlistSha256 === manifestSha256);
check('gate has zero direct role authorization bypass', gate.directRoleAuthorizationBypasses === 0);
check('gate executes malicious and benign self-tests', gate.maliciousSelfTestAssertions === 17 && gate.benignSelfTestAssertions === 4);
check('gate surface counts match manifest', JSON.stringify(gate.surfaceCounts) === JSON.stringify(allowlist.expectedSurfaceCounts));

check('scanner uses a real AST parser', includesAll(scanner, ["import { parse } from '@babel/parser'", "plugins: [", "'typescript'", "'jsx'"]));
check('scanner traverses syntax nodes instead of line regex', includesAll(scanner, ['walkAst(ast.program', "node.type === 'ImportDeclaration'", "node.type === 'CallExpression'", "node.type === 'NewExpression'", "node.type === 'BinaryExpression'"]));
check('scanner denies parse failure', includesAll(scanner, ['AST_PARSE_ERROR', 'parseProgram(path, source)']));
check('scanner detects static dynamic and require imports', includesAll(scanner, ["node.type === 'ImportDeclaration'", "node.type === 'ImportExpression'", "callee.name === 'require'", 'DYNAMIC_IMPORT_UNRESOLVED']));
check('scanner detects SQL constructors calls aliases and templates', includesAll(scanner, ['SQL_CONSTRUCTOR', 'SQL_CALL', 'SQL_METHOD_ALIAS', 'SQL_TAGGED_TEMPLATE']));
check('scanner detects repository and database imports', includesAll(scanner, ["'REPOSITORY_IMPORT'", "'DATABASE_IMPORT'", "moduleName === '@ppt/repositories'", "moduleName === '@ppt/database'"]));
check('scanner detects node and Web Crypto', includesAll(scanner, ['CRYPTO_MODULES', 'CRYPTO_METHODS', 'cryptoAliases']));
check('scanner detects network imports globals and aliases', includesAll(scanner, ['NETWORK_MODULES', 'NETWORK_GLOBALS', 'networkAliases']));
check('scanner detects role comparison includes and destructuring', includesAll(scanner, ['ROLE_LITERALS', 'containsRoleReference', "property === 'includes'", "node.type === 'ObjectProperty'"]));
check('scanner keeps direct role authorization zero-exception', includesAll(scanner, ["item.kind === 'ROLE_CHECK'", 'DIRECT_ROLE_AUTHORIZATION_FORBIDDEN']));
check('scanner detects new aliased and reflect use-case composition', includesAll(scanner, ['useCaseAliases', "property === 'construct'", 'USE_CASE_COMPOSITION']));
check('scanner rejects wildcard duplicate stale and new surfaces', includesAll(scanner, ['ALLOWLIST_WILDCARD_FORBIDDEN', 'ALLOWLIST_DUPLICATE', 'STALE_ALLOWLIST_ENTRY', 'UNAPPROVED_PRIVILEGED_SURFACE']));
check('gate self-tests AST evasions', includesAll(gateScript, ['DatabaseSync as DB', "db['prepare']", "await import('node:sqlite')", "require('@ppt/repositories')", 'globalThis.fetch', 'globalThis.crypto', 'Reflect.construct']));
check('gate self-tests benign false positives', includesAll(gateScript, ['regex.exec(value)', 'kitchen.prepare(meal)', "const text = 'SELECT * FROM examples'", 'ROLE_PRESENTATION']));

check('root pretypecheck includes AST gate', rootPackage.scripts?.pretypecheck?.includes('verify-platform-policy-ast-gate.mjs'));
check('root prebuild includes AST gate before governed preflight', rootPackage.scripts?.prebuild?.indexOf('verify-platform-policy-ast-gate.mjs') < rootPackage.scripts?.prebuild?.indexOf('require-current-governed-preflight.mjs'));
check('combined platform policy gate invokes AST gate', includesAll(legacyGate, ["scripts/verify-platform-policy-ast-gate.mjs", 'astGateStatus', 'AST gate PASS']));
check('root package exposes all four PPK-021 commands', ['verify:ppk021:ast-gate', 'verify:ppk021:targeted', 'verify:ppk021:contract', 'verify:ppk021:runtime'].every((name) => typeof rootPackage.scripts?.[name] === 'string'));

check('policy declares all six exact rule identifiers', includesAll(policy, ['PLATFORM_POLICY_AST_GATE_RULE_IDS', 'DIRECT_SQL_SQLITE_DENIED', 'DIRECT_REPOSITORY_DATABASE_DENIED', 'DIRECT_CRYPTO_DENIED', 'DIRECT_NETWORK_DENIED', 'DIRECT_ROLE_AUTHORIZATION_DENIED', 'UNAPPROVED_USE_CASE_COMPOSITION_DENIED']));
check('policy snapshot is exact fail closed', includesAll(policy, ["syntaxModel: 'TYPESCRIPT_AST'", "enforcement: 'fail-closed'", "defaultDecision: 'DENY'", 'exactAllowlistEntries: 545']));
check('policy denies runtime authority inference', includesAll(policy, ['allowlistMutationGrantsRuntimeAuthority: false', 'buildGateReplacesRuntimePolicy: false', 'rendererRoleConditionGrantsAuthority: false']));
check('policy hides source and manifest material', includesAll(policy, ['sourcePathsExposedToClient: false', 'allowlistHashExposedToClient: false']));
check('policy verify rejects broadened snapshots', includesAll(policy, ['snapshot.wildcardsAllowed === false', 'snapshot.directRoleAuthorizationBypasses === 0', 'snapshot.protectedRules.every']));
check('platform policy exports AST gate policy', policyIndex.includes("export * from './platform-policy-ast-gate-policy.js'"));

check('domain boundary is content free and fixed', includesAll(domain, ['PlatformPolicyAstGateBoundaryView', 'protectedRuleCount: 6', 'exactAllowlistEntries: 545', 'sourcePathsExposedToClient: false', 'allowlistHashExposedToClient: false']));
check('domain exports AST boundary', domainIndex.includes("export * from './platform-policy-ast-gate.js'"));
check('application use case verifies policy snapshot', includesAll(useCase, ['GetPlatformPolicyAstGateBoundaryUseCase', 'this.policy.verify(snapshot)', 'PLATFORM_POLICY_AST_GATE_SNAPSHOT_INVALID']));
check('application use case preserves migration truth', includesAll(useCase, ['schemaMigrationRequired: false', 'latestDatabaseMigration: 77']));
check('application exports AST boundary use case', applicationIndex.includes("export * from './platform-policy-ast-gate-use-cases.js'"));

check('policy test covers snapshot broadening and reorder', includesAll(policyTest, ['wildcardsAllowed: true', 'directRoleAuthorizationBypasses: 1', '.reverse()']));
check('AST test covers six privileged families', includesAll(astTest, ['SQL_IMPORT', 'REPOSITORY_IMPORT', 'DATABASE_IMPORT', 'CRYPTO_IMPORT', 'NETWORK_IMPORT', 'ROLE_CHECK', 'USE_CASE_COMPOSITION']));
check('AST test covers parse unexpected stale and wildcard denial', includesAll(astTest, ['AST_PARSE_ERROR', 'UNAPPROVED_PRIVILEGED_SURFACE', 'STALE_ALLOWLIST_ENTRY', 'ALLOWLIST_WILDCARD_FORBIDDEN']));
check('AST test verifies full production manifest exactness', includesAll(astTest, ['inventoryPlatformPolicyAstSurfaces()', 'result.findings).toEqual([])', 'result.allowedCount).toBe(545)']));
check('integration test verifies zero argument and no cache', includesAll(integrationTest, ["evaluateIpcIntegrationPolicy('system:getPlatformPolicyAstGateBoundary', [])", "resolveIpcReadSharingPolicy('system:getPlatformPolicyAstGateBoundary')"]));
check('integration test verifies no source or hash payload', includesAll(integrationTest, ["Object.hasOwn(view, 'sourcePaths')", "Object.hasOwn(view, 'allowlistHash')"]));

check('main composes exact AST policy and use case', includesAll(main, ['new PlatformPolicyAstGatePolicy()', 'new GetPlatformPolicyAstGateBoundaryUseCase(platformPolicyAstGatePolicy)']));
check('main registers exact AST status handler', main.includes("registerIpcHandler('system:getPlatformPolicyAstGateBoundary'"));
check('preload exposes exact AST status channel', preload.includes("invoke('system:getPlatformPolicyAstGateBoundary')"));
check('renderer global type exposes AST status API', globalTypes.includes('getPlatformPolicyAstGateBoundary():Promise<PlatformPolicyAstGateBoundaryView>'));
check('IPC integration requires zero arguments', ipcPolicy.includes("case 'system:getPlatformPolicyAstGateBoundary':"));
check('IPC sharing marks AST status no-cache', ipcCache.includes("'system:getPlatformPolicyAstGateBoundary'"));
check('renderer shows build gate without runtime authority claim', includesAll(renderer, ['PPK-021 · AST güvenlik kapısı', 'AST gate runtime politikasının yerine geçmez', 'doğrudan rol yetkilendirmesi:']));
check('renderer does not render allowlist paths or hash', !renderer.includes('exactAllowlistSha256') && !renderer.includes('allowedSurfaceKeys'));

check('scope records six rules and 545 exact surfaces', scope.boundaries?.protectedRuleCount === 6 && scope.protectedRules?.length === 6 && scope.boundaries?.exactPrivilegedSurfaceCount === 545);
check('scope records runtime-policy non-substitution', scope.boundaries?.allowlistMutationGrantsRuntimeAuthority === false && scope.boundaries?.buildGateReplacesRuntimePolicy === false);
check('scope records content-free no-cache client boundary', scope.boundaries?.contentFreeStatusIpcRequired === true && scope.boundaries?.policyStatusIpcCacheAllowed === false && scope.boundaries?.sourcePathsExposedToRenderer === false);
check('scope records no persistence transfer or cutover', scope.boundaries?.schemaMigrationRequired === false && scope.boundaries?.realDataTransferPerformed === false && scope.boundaries?.cutoverPerformed === false && scope.boundaries?.sqliteOwnershipTransferred === false);
check('inventory has six implemented controls', inventory.controls?.length === 6 && inventory.controls.every((item) => item.disposition === 'IMPLEMENTED'));
check('inventory has zero gate findings and blockers', inventory.engine?.findings === 0 && inventory.closureSummary?.openBlockerCount === 0 && inventory.closureSummary?.openBlockers?.length === 0);
check('decision records AST exactness and runtime boundary', includesAll(decision, ['DEC-202', 'TypeScript/JSX AST', 'exact `kind|path|symbol`', 'runtime policy yerine geçmez']));
check('threat model covers all primary evasions', ['Regex kaçışı', 'Parçalı dinamik modül adı', 'Doğrudan SQL/SQLite', 'Kripto kaçışı', 'Network kaçışı', 'Rol tabanlı fail-open', 'Politikasız use-case composition', 'Stale izin'].every((marker) => threat.includes(marker)));
check('master register contains DEC-202', masterRegister.includes('## DEC-202') && masterRegister.includes('DEC-202-ppk-021-platform-policy-ast-fail-gate.md'));
check('decision ledger contains active DEC-202', ledger.decisionCount === ledger.decisions.length && ledger.decisions.some((item) => item.id === 'DEC-202' && item.status === 'ACTIVE' && item.requirements?.includes('PPK-021')));
check('database migration 77 baseline remains present', versions.includes(77) && latestMigration >= 77 && scope.boundaries?.latestDatabaseMigration === 77);

if (candidateMode) {
  check('candidate registry remains validation pending', requirement?.status === 'IN_PROGRESS' && requirement?.implementationState === 'IMPLEMENTED_VALIDATION_PENDING' && requirement?.chain?.targetedTest === false && requirement?.chain?.evidence === false);
  check('candidate scope remains validation pending', scope.status === 'IN_PROGRESS' && scope.implementationState === 'IMPLEMENTED_VALIDATION_PENDING' && scope.validation?.state === 'PENDING' && scope.validation?.finalValidationRecorded === false && scope.requirementCompletionClaimed === false && scope.remainingClosureWork?.length > 0);
  check('candidate inventory remains validation pending', inventory.status === 'IMPLEMENTED_VALIDATION_PENDING' && inventory.completionClaimed === false && inventory.closureSummary?.finalValidationPending === true);
  check('candidate audit makes no final PASS claim', audit.includes('VALIDATION_PENDING') && !audit.includes('Durum: `COMPLETE / PASS`'));
} else {
  check('accepted registry closes complete PPK-021 evidence chain', requirement?.status === 'COMPLETE' && requirement.implementationState === undefined && Object.values(requirement.chain ?? {}).every((value) => value === true) && requirement.evidence?.length >= 15);
  check('scope closes PPK-021 with no migration transfer or cutover', scope.status === 'COMPLETED' && scope.implementationState === 'VALIDATED_COMPLETE' && scope.validation?.state === 'COMPLETE' && scope.validation?.finalValidationRecorded === true && scope.requirementCompletionClaimed === true && scope.remainingClosureWork?.length === 0);
  check('inventory closes only after final validation', inventory.status === 'COMPLETE' && inventory.completionClaimed === true && inventory.closureSummary?.finalValidationPending === false);
  check('audit closes only with final contract and runtime evidence', audit.includes('Durum: `COMPLETE / PASS`') && /contract: `\d+\/\d+ PASS`/u.test(audit) && /runtime kanıt demeti: `\d+\/\d+ PASS`/u.test(audit));
}

const report = {
  schemaVersion: 1,
  release: 'Bronze 04.08.2026.29',
  step: '32-Q',
  requirement: 'PPK-021',
  phase: candidateMode ? 'PLATFORM_POLICY_AST_FAIL_GATE_CANDIDATE_CONTRACT' : 'PLATFORM_POLICY_AST_FAIL_GATE_CONTRACT',
  status: failures.length ? 'FAIL' : 'PASS',
  checkCount: checks.length,
  passed: checks.length - failures.length,
  failed: failures.length,
  checks,
  failures,
  sourceGate: gate,
  protectedRuleCount: 6,
  exactAllowlistEntries: 545,
  exactAllowlistSha256: manifestSha256,
  directRoleAuthorizationBypasses: 0,
  syntaxModel: 'TYPESCRIPT_AST',
  regexOnlyGateAccepted: false,
  buildGateReplacesRuntimePolicy: false,
  latestDatabaseMigration: latestMigration,
  schemaMigrationRequired: false,
  historicalBackfillPerformed: false,
  legacyDesktopVaultPreserved: true,
  sqliteOwnershipTransferred: false,
  realDataTransferPerformed: false,
  cutoverAuthorityAttached: false,
  successorRequirementCompletedByThisPackage: false,
  requirementCompletionClaimed: !candidateMode && failures.length === 0,
  generatedAt: new Date().toISOString()
};

await mkdir('artifacts/validation', { recursive: true });
await writeFile('artifacts/validation/32-Q-ppk-021-platform-policy-ast-gate-contract.json', `${JSON.stringify(report, null, 2)}\n`);
if (failures.length) {
  console.error(`PPK-021${candidateMode ? ' candidate' : ''} contract: FAIL (${failures.length}/${checks.length}).`);
  for (const failure of failures) console.error(failure);
  process.exit(1);
}
console.log(`PPK-021${candidateMode ? ' candidate' : ''} contract: PASS (${checks.length}/${checks.length}).`);

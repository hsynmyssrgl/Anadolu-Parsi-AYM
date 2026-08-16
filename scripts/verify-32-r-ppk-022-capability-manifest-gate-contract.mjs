import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { runPlatformCapabilityManifestGate } from './verify-platform-capability-manifest-gate.mjs';

const candidateMode = process.argv.includes('--candidate');
const readText = (path) => readFile(path, 'utf8');
const readJson = async (path) => JSON.parse(await readText(path));
const [
  scope, inventory, manifest, registry, ledger, rootPackage, lockfile,
  scanner, gateScript, combinedGate, kernel, policy, policyIndex, domain,
  domainIndex, useCase, applicationIndex, policyTest, astTest, integrationTest,
  coreMain, startup, startupRuntime, desktopMain, preload, globalTypes, renderer, ipcPolicy,
  ipcCache, decision, threat, audit, masterRegister, migrations, ocrSecurity
] = await Promise.all([
  readJson('config/32-r-ppk-022-capability-manifest-gate-scope.json'),
  readJson('config/32-r-ppk-022-capability-manifest-gate-inventory.json'),
  readJson('config/32-r-ppk-022-capability-surface-manifest.json'),
  readJson('config/accepted-scope-registry.json'),
  readJson('config/user-decision-ledger.json'),
  readJson('package.json'),
  readJson('package-lock.json'),
  readText('scripts/lib/platform-capability-manifest-ast-scanner.mjs'),
  readText('scripts/verify-platform-capability-manifest-gate.mjs'),
  readText('scripts/verify-platform-policy-gate.mjs'),
  readText('packages/platform-policy/src/policy-kernel.ts'),
  readText('packages/platform-policy/src/platform-capability-manifest-policy.ts'),
  readText('packages/platform-policy/src/index.ts'),
  readText('packages/domain/src/platform-capability-manifest-gate.ts'),
  readText('packages/domain/src/index.ts'),
  readText('packages/application/src/platform-capability-manifest-gate-use-cases.ts'),
  readText('packages/application/src/index.ts'),
  readText('packages/platform-policy/platform-capability-manifest-policy.test.ts'),
  readText('apps/desktop/tests/ppk022-capability-manifest-gate.test.ts'),
  readText('apps/desktop/tests/ppk022-capability-manifest-integration.test.ts'),
  readText('apps/core-service/src/main.ts'),
  readText('apps/desktop/src/main/core-service-startup-connection.ts'),
  readText('scripts/verify-desktop-core-service-startup-runtime.mjs'),
  readText('apps/desktop/src/main/main.ts'),
  readText('apps/desktop/src/main/preload.ts'),
  readText('apps/desktop/src/renderer/global.d.ts'),
  readText('apps/desktop/src/renderer/App.tsx'),
  readText('apps/desktop/src/main/ipc-integration-policy.ts'),
  readText('apps/desktop/src/main/ipc-read-sharing.ts'),
  readText('docs/decisions/DEC-203-ppk-022-capability-manifest-build-runtime-gate.md'),
  readText('docs/security/PPK-022_CAPABILITY_MANIFEST_BUILD_RUNTIME_GATE_THREAT_MODEL.md'),
  readText('docs/audit/32-R_PPK-022_CAPABILITY_MANIFEST_BUILD_RUNTIME_GATE_UST_KAPANIS.md'),
  readText('docs/10_MASTER_DECISION_REGISTER.md'),
  readText('packages/database/src/family-database-migrations.ts'),
  readText('packages/security/src/local-ocr-security.ts')
]);

const gate = await runPlatformCapabilityManifestGate();
const failures = [];
const checks = [];
const check = (name, condition) => {
  checks.push({ name, passed: Boolean(condition) });
  if (!condition) failures.push(name);
};
const includesAll = (source, markers) => markers.every((marker) => source.includes(marker));
const requirement = registry.requirements.find((item) => item.id === 'PPK-022');
const prior = ['PPK-012', 'PPK-013', 'PPK-014', 'PPK-015', 'PPK-016', 'PPK-017', 'PPK-018', 'PPK-019', 'PPK-020', 'PPK-021']
  .map((id) => registry.requirements.find((item) => item.id === id));
const successor = registry.requirements.find((item) => item.id === 'PPK-023');
const versions = [...migrations.matchAll(/createMigrationDefinition\((\d+),/gu)].map((match) => Number.parseInt(match[1], 10));
const latestMigration = Math.max(...versions);
const manifestBytes = await readFile('config/32-r-ppk-022-capability-surface-manifest.json');
const manifestSha256 = createHash('sha256').update(manifestBytes).digest('hex');
const entries = manifest.surfaces ?? [];
const keys = entries.map((entry) => entry.key);
const sortedKeys = [...keys].sort((left, right) => left.localeCompare(right, 'en'));
const runtimeCapabilities = ['camera.access', 'microphone.access', 'file.access', 'ocr.process', 'ai.process', 'location.access', 'network.access'];
const applicationIds = [
  'windows-desktop', 'windows-core-service', 'windows-cluster-agent', 'macos-companion',
  'ios-companion', 'ipados-companion', 'watchos-companion', 'visionos-companion',
  'ocr-worker', 'ai-worker', 'translation-worker', 'communication-service', 'backup-worker', 'signed-plugin'
];
const expectedApplications = Object.fromEntries(applicationIds.map((id) => [id,
  id === 'windows-desktop'
    ? ['file.access', 'network.access', 'ocr.process']
    : id === 'windows-core-service' ? ['file.access', 'network.access'] : []
]));
const observedCounts = Object.fromEntries([...new Set(entries.map((entry) => entry.key.split('|', 1)[0]))]
  .sort((left, right) => left.localeCompare(right, 'en'))
  .map((kind) => [kind, entries.filter((entry) => entry.key.startsWith(`${kind}|`)).length]));
const pinnedEntries = entries.filter((entry) => entry.runtimeEnforcement === 'PINNED_BOOTSTRAP_THEN_SIGNED');

check('scope identity is exact', scope.step === '32-R' && scope.requirement === 'PPK-022');
check('inventory identity is exact', inventory.step === '32-R' && inventory.requirement === 'PPK-022');
check('surface manifest identity is exact', manifest.step === '32-R' && manifest.requirement === 'PPK-022');
check('accepted registry contains PPK-022', requirement !== undefined);
check('PPK-012 through PPK-021 remain complete', prior.every((item) => item?.status === 'COMPLETE'));
check('PPK-023 remains a distinct successor requirement', successor !== undefined && successor.id !== scope.requirement);

check('AST parser dependency remains exact', rootPackage.devDependencies?.['@babel/parser'] === '7.29.8');
check('lockfile root records exact AST parser', lockfile.packages?.['']?.devDependencies?.['@babel/parser'] === '7.29.8');
check('installed AST parser is locked', lockfile.packages?.['node_modules/@babel/parser']?.version === '7.29.8');
check('manifest is exact default deny', manifest.defaultDecision === 'DENY' && manifest.exactMatchRequired === true && manifest.wildcardsAllowed === false);
check('manifest requires signed runtime check without static authority', manifest.signedManifestRuntimeCheckRequired === true && manifest.buildManifestAloneGrantsRuntimeAuthority === false);
check('manifest binds eighteen production zones', manifest.productionSourceZoneCount === 18 && scope.boundaries?.productionSourceZoneCount === 18);
check('manifest contains exactly 392 unique surfaces', entries.length === 392 && new Set(keys).size === 392);
check('manifest surface keys are stable sorted', keys.every((key, index) => key === sortedKeys[index]));
check('manifest contains no wildcard keys', keys.every((key) => !/[*?\[\]{}]/u.test(key)));
check('manifest entries have exact schema', entries.every((entry) => Object.keys(entry).sort().join('|') === 'applicationIds|capability|key|runtimeEnforcement'));
check('manifest entries bind valid runtime capabilities', entries.every((entry) => runtimeCapabilities.includes(entry.capability)));
check('manifest entries bind canonical sorted applications', entries.every((entry) => Array.isArray(entry.applicationIds) && entry.applicationIds.length > 0 && entry.applicationIds.every((id) => applicationIds.includes(id)) && entry.applicationIds.every((id, index) => index === 0 || entry.applicationIds[index - 1].localeCompare(id, 'en') < 0)));
check('manifest surface counts are exact', JSON.stringify(observedCounts) === JSON.stringify(manifest.surfaceCounts));
check('manifest hash binds scope and inventory', manifestSha256 === scope.boundaries?.exactCapabilityManifestSha256 && manifestSha256 === inventory.engine?.exactManifestSha256);
check('application registry lists all fourteen exact profiles', JSON.stringify(manifest.applicationRuntimeCapabilities) === JSON.stringify(expectedApplications));
check('only two deployed applications hold capabilities', Object.values(manifest.applicationRuntimeCapabilities).filter((values) => values.length > 0).length === 2);
check('only Desktop OCR plus file and network are deployed', [...new Set(Object.values(manifest.applicationRuntimeCapabilities).flat())].sort().join('|') === 'file.access|network.access|ocr.process');
check('local OCR stays in windows-desktop while ocr-worker remains undeployed and low privilege is not claimed', manifest.applicationRuntimeCapabilities['windows-desktop']?.join('|') === 'file.access|network.access|ocr.process' && manifest.applicationRuntimeCapabilities['ocr-worker']?.length === 0 && ocrSecurity.includes('readonly lowPrivilegeSandboxVerified: false;'));
check('bootstrap entries are bounded and Desktop-owned', pinnedEntries.length === 26 && pinnedEntries.every((entry) => entry.applicationIds.includes('windows-desktop')) && pinnedEntries.filter((entry) => entry.capability === 'file.access').length === 24 && pinnedEntries.filter((entry) => entry.capability === 'network.access').length === 2);
check('manifest preserves no-transfer ownership invariants', manifest.invariants?.realDataTransferPerformed === false && manifest.invariants?.sqliteOwnershipTransferred === false && manifest.invariants?.desktopVaultOwnershipPreserved === true);

check('production capability gate passes', gate.status === 'PASS' && gate.findings.length === 0);
check('gate scans all current production sources', gate.productionSourceZones === 18 && gate.scannedFiles === 555);
check('gate and manifest cardinality are exact', gate.capabilitySurfaces === 392 && gate.exactManifestSurfaces === 392);
check('gate manifest hash matches canonical file', gate.exactManifestSha256 === manifestSha256);
check('gate reports seven families and fourteen applications', gate.protectedCapabilityFamilies === 7 && gate.canonicalApplications === 14);
check('gate executes malicious and benign self tests', gate.maliciousSelfTestAssertions === 33 && gate.benignSelfTestAssertions === 5);
check('gate reports exact bootstrap and surface counts', gate.pinnedBootstrapSurfaces === 26 && JSON.stringify(gate.surfaceCounts) === JSON.stringify(manifest.surfaceCounts));

check('scanner uses TypeScript JSX AST', includesAll(scanner, ["import { parse } from '@babel/parser'", "'typescript'", "'jsx'", 'walk(ast']));
check('scanner covers seven resource capability families', includesAll(scanner, ['CAMERA_IMPORT', 'MICROPHONE_IMPORT', 'FILE_IMPORT', 'OCR_IMPORT', 'AI_IMPORT', 'LOCATION_API', 'NETWORK_IMPORT']));
check('scanner covers static dynamic require and builtin imports', includesAll(scanner, ["node.type === 'ImportDeclaration'", "callee?.type === 'Import'", "name === 'require'", "name === 'getBuiltinModule'"]));
check('scanner covers protected re-export and TypeScript import equals', includesAll(scanner, ["node.type === 'ExportNamedDeclaration'", "node.type === 'ExportAllDeclaration'", "node.type === 'TSImportEqualsDeclaration'", '*import-equals*']));
check('scanner covers createRequire aliases', includesAll(scanner, ['CREATE_REQUIRE_FACTORY', 'DYNAMIC_REQUIRE_FUNCTION', '*createRequire*']));
check('scanner rejects unresolved dynamic resource imports', includesAll(scanner, ['CAPABILITY_DYNAMIC_IMPORT_UNRESOLVED', 'Non-literal dynamic import cannot prove a resource capability']));
check('scanner tracks aliases computed APIs and browser globals', includesAll(scanner, ['aliases = new Map()', 'memberName', 'NETWORK_GLOBALS', 'FILE_GLOBALS']));
check('scanner covers destructuring assignment and Reflect invocation aliases', includesAll(scanner, ["node.id?.type === 'ObjectPattern'", "node.type === 'AssignmentExpression'", "receiver === 'Reflect'", 'targetAlias.kind']));
check('scanner covers JSX file and capture inputs', includesAll(scanner, ["node.type === 'JSXOpeningElement'", "attributes.type === 'file'", 'jsx.input[type=file][capture]']));
check('scanner covers camera microphone and desktop capture APIs', includesAll(scanner, ['getUserMedia', 'desktopCapturer.getSources', 'CAMERA_API', 'MICROPHONE_API']));
check('scanner covers Electron file and network APIs', includesAll(scanner, ['showOpenDialog', 'showSaveDialog', 'shell.openExternal', 'loadURL']));
check('scanner covers geolocation OCR and AI aliases', includesAll(scanner, ['getCurrentPosition', 'watchPosition', 'OCR_MODULE_PATTERN', 'AI_MODULE_PATTERN']));
check('gate rejects malformed duplicate new stale and wildcard entries', includesAll(gateScript, ['CAPABILITY_SURFACE_ENTRY_INVALID', 'CAPABILITY_SURFACE_DUPLICATE', 'UNDECLARED_CAPABILITY_SURFACE', 'STALE_CAPABILITY_SURFACE', 'WILDCARD']));
check('gate binds exact application ownership by source prefix', includesAll(gateScript, ['APPLICATION_OWNERS_BY_SOURCE_PREFIX', 'expectedApplicationsForSurfaceKey', '!same(applicationIds, expectedApplications)']));
check('gate binds exact bootstrap versus signed-startup enforcement stage', includesAll(gateScript, ['PINNED_BOOTSTRAP_SURFACE_KEYS', "? 'PINNED_BOOTSTRAP_THEN_SIGNED'", 'entry.runtimeEnforcement !== expectedEnforcement']));
check('gate rejects exact application baseline drift', includesAll(gateScript, ['APPLICATION_CAPABILITY_REGISTRY_INVALID', 'APPLICATION_CAPABILITY_BASELINE_MISMATCH', 'OBSERVED_CAPABILITY_COVERAGE_MISMATCH']));
check('gate self-tests all seven families and dynamic escape', includesAll(gateScript, ["'FILE_IMPORT'", "'CAMERA_API'", "'MICROPHONE_API'", "'OCR_IMPORT'", "'AI_IMPORT'", "'LOCATION_API'", "'NETWORK_API'", "'CAPABILITY_DYNAMIC_IMPORT_UNRESOLVED'"]));

check('root pretypecheck includes capability gate', rootPackage.scripts?.pretypecheck?.includes('verify-platform-capability-manifest-gate.mjs'));
check('root prebuild includes capability gate before governed preflight', rootPackage.scripts?.prebuild?.indexOf('verify-platform-capability-manifest-gate.mjs') >= 0 && rootPackage.scripts.prebuild.indexOf('verify-platform-capability-manifest-gate.mjs') < rootPackage.scripts.prebuild.indexOf('require-current-governed-preflight.mjs'));
check('combined platform policy gate invokes capability gate', includesAll(combinedGate, ['scripts/verify-platform-capability-manifest-gate.mjs', 'capabilityManifestGateStatus']));
check('root package exposes all four PPK-022 commands', ['verify:ppk022:capability-gate', 'verify:ppk022:targeted', 'verify:ppk022:contract', 'verify:ppk022:runtime'].every((name) => typeof rootPackage.scripts?.[name] === 'string'));

check('kernel declares seven exact runtime capability values', includesAll(kernel, ['PLATFORM_RUNTIME_CAPABILITIES', "'camera.access'", "'microphone.access'", "'file.access'", "'ocr.process'", "'ai.process'", "'location.access'", "'network.access'"]));
check('kernel manifest includes runtime capabilities', includesAll(kernel, ['readonly runtimeCapabilities: readonly PlatformRuntimeCapability[]', 'runtimeCapabilities,', 'capabilityManifestSha256: platformCapabilityManifestHash']));
check('kernel hash canonicalizes runtime capabilities', includesAll(kernel, ['runtimeCapabilities: [...(input.runtimeCapabilities ?? [])].sort()', 'platformCapabilityManifestHash']));
check('kernel rejects invalid runtime capability registry', includesAll(kernel, ['application runtime capability registry contains an unregistered applicationId', 'application runtime capability registry is invalid']));
check('kernel includes manifests in signed policy payload', includesAll(kernel, ['applicationManifests: Object.freeze(applicationManifests)', 'payloadSha256', 'signatureAlgorithm']));

check('policy binds fourteen exact application requirements', includesAll(policy, ['PLATFORM_APPLICATION_RUNTIME_CAPABILITY_REQUIREMENTS', "'windows-desktop'", "'windows-core-service'", "'signed-plugin'"]));
check('policy validates exact authority and request schemas', includesAll(policy, ['validAuthority', 'validRequest', 'exactKeys']));
check('policy rejects unverified package and all identity mismatches', includesAll(policy, ['POLICY_PACKAGE_UNVERIFIED', 'POLICY_PACKAGE_HASH_MISMATCH', 'APPLICATION_ID_MISMATCH', 'APPLICATION_VERSION_MISMATCH', 'CAPABILITY_MANIFEST_HASH_MISMATCH']));
check('policy rejects undeclared missing and unexpected capability', includesAll(policy, ['CAPABILITY_NOT_DECLARED', 'CAPABILITY_REQUIREMENT_MISSING', 'CAPABILITY_REQUIREMENT_UNEXPECTED']));
check('policy exact coverage verifies missing and broadening', includesAll(policy, ['evaluateCoverage(', 'const missing = required.some', 'const unexpected = declared.some', 'sameCapabilities']));
check('policy snapshot is exact and denies static authority inference', includesAll(policy, ["!exactKeys(value, [", "enforcement: 'build-and-runtime-fail-closed'", "defaultDecision: 'DENY'", 'buildManifestAloneGrantsRuntimeAuthority: false']));
check('policy pins pre-handshake file and network bootstrap capabilities', includesAll(policy, ['assertPinnedBootstrapRuntimeCapability', 'bootstrapFileCapabilityPinned: true', 'bootstrapNetworkCapabilityPinned: true', 'BOOTSTRAP_RUNTIME_CAPABILITY_NOT_DECLARED']));
check('platform policy exports capability policy', policyIndex.includes("export * from './platform-capability-manifest-policy.js'"));

check('Core Service config uses exact shared baseline', includesAll(coreMain, ['applicationRuntimeCapabilities: PLATFORM_APPLICATION_RUNTIME_CAPABILITY_REQUIREMENTS', 'for (const applicationId of PLATFORM_APPLICATION_IDS)']));
check('Core Service verifies signed package coverage before server construction', coreMain.indexOf('capabilityManifestPolicy.evaluateCoverage(applicationId') < coreMain.indexOf('this.#server = new CoreServiceLocalAdminServer'));
check('Core Service fails closed on missing or denied manifest', includesAll(coreMain, ['Core Service signed capability manifest is missing', 'Core Service runtime capability coverage denied']));
check('Desktop startup reads only authenticated Core Service authority', includesAll(startup, ["source: 'authenticated-core-service-health'", "evaluateCoverage(\n    'windows-desktop'", 'Desktop runtime capability manifest coverage was denied']));
check('Desktop startup verifies package and application versions first', startup.indexOf('POLICY_PACKAGE_MISMATCH') < startup.indexOf('desktopCapabilityCoverage') && startup.indexOf('APPLICATION_VERSION_MISMATCH') < startup.indexOf('desktopCapabilityCoverage'));
check('real Desktop startup runtime fixture carries exact signed capabilities', includesAll(startupRuntime, ["applicationRuntimeCapabilities:{'windows-desktop':['file.access','network.access','ocr.process'],'windows-core-service':['file.access','network.access']}", "runtimeCapabilities.join('|')==='file.access|network.access|ocr.process'"]));
check('Desktop bootstrap pins file and network capabilities before operational startup', includesAll(desktopMain, ["assertPinnedBootstrapRuntimeCapability('windows-desktop', 'file.access')", "assertPinnedBootstrapRuntimeCapability('windows-desktop', 'network.access')"]));

check('domain boundary is fixed and content free', includesAll(domain, ['PlatformCapabilityManifestGateBoundaryView', 'protectedCapabilityCount: 7', 'canonicalApplicationCount: 14', 'exactAstSurfaceCount: 392', 'sourcePathsExposedToClient: false', 'manifestHashesExposedToClient: false']));
check('domain exports capability gate boundary', domainIndex.includes("export * from './platform-capability-manifest-gate.js'"));
check('application use case verifies policy snapshot', includesAll(useCase, ['GetPlatformCapabilityManifestGateBoundaryUseCase', 'this.policy.verifySnapshot(snapshot)', 'PLATFORM_CAPABILITY_MANIFEST_GATE_SNAPSHOT_INVALID']));
check('application boundary preserves no migration truth', includesAll(useCase, ['schemaMigrationRequired: false', 'latestDatabaseMigration: 77']));
check('application exports capability gate use case', applicationIndex.includes("export * from './platform-capability-manifest-gate-use-cases.js'"));

check('policy tests cover signed hash and seven families', includesAll(policyTest, ['PLATFORM_RUNTIME_CAPABILITIES', 'platformCapabilityManifestHash', "request('camera.access')"]));
check('policy tests cover malformed unverified and identity mismatch', includesAll(policyTest, ['MALFORMED_REQUEST', 'POLICY_PACKAGE_UNVERIFIED', 'POLICY_PACKAGE_HASH_MISMATCH', 'APPLICATION_ID_MISMATCH', 'APPLICATION_VERSION_MISMATCH', 'CAPABILITY_MANIFEST_HASH_MISMATCH']));
check('policy tests cover missing unexpected and tampered capability', includesAll(policyTest, ['CAPABILITY_REQUIREMENT_MISSING', 'CAPABILITY_REQUIREMENT_UNEXPECTED', 'MALFORMED_AUTHORITY']));
check('AST tests cover all seven resource families', includesAll(astTest, ['CAMERA_IMPORT', 'MICROPHONE_IMPORT', 'FILE_IMPORT', 'OCR_IMPORT', 'AI_IMPORT', 'LOCATION_API', 'NETWORK_API']));
check('AST tests cover exact production and drift denial', includesAll(astTest, ['inventoryPlatformCapabilityManifestSurfaces()', 'inventory.files).toBe(555)', 'toHaveLength(392)', 'UNDECLARED_CAPABILITY_SURFACE', 'CAPABILITY_SURFACE_ENTRY_INVALID', 'APPLICATION_CAPABILITY_BASELINE_MISMATCH']));
check('integration tests bind runtime startup and bootstrap', includesAll(integrationTest, ['applicationRuntimeCapabilities: PLATFORM_APPLICATION_RUNTIME_CAPABILITY_REQUIREMENTS', "source: 'authenticated-core-service-health'", 'assertPinnedBootstrapRuntimeCapability']));

check('main composes exact capability policy and status use case', includesAll(desktopMain, ['new PlatformCapabilityManifestPolicy()', 'new GetPlatformCapabilityManifestGateBoundaryUseCase(platformCapabilityManifestPolicy)']));
check('main registers exact status handler', desktopMain.includes("registerIpcHandler('system:getPlatformCapabilityManifestGateBoundary'"));
check('preload exposes exact status channel', preload.includes("invoke('system:getPlatformCapabilityManifestGateBoundary')"));
check('renderer type exposes exact status method', globalTypes.includes('getPlatformCapabilityManifestGateBoundary():Promise<PlatformCapabilityManifestGateBoundaryView>'));
check('IPC integration accepts only zero arguments', ipcPolicy.includes("case 'system:getPlatformCapabilityManifestGateBoundary':"));
check('IPC sharing marks status no-cache', ipcCache.includes("'system:getPlatformCapabilityManifestGateBoundary'"));
check('renderer explains seven families and runtime authority truth', includesAll(renderer, ['PPK-022 · capability manifest kapısı', 'Kamera, mikrofon, dosya, OCR, AI, konum ve ağ', 'Build manifesti tek başına runtime yetkisi vermez']));
check('renderer does not expose source or manifest hash material', !renderer.includes('exactCapabilityManifestSha256') && !renderer.includes('capabilitySurfaceKeys'));

check('scope records all seven exact protected families', scope.boundaries?.protectedCapabilityFamilyCount === 7 && scope.boundaries?.protectedCapabilityFamilies?.join('|') === 'camera|microphone|file|ocr|ai|location|network');
check('scope records exact signed runtime authority chain', scope.boundaries?.signedApplicationManifestRequired === true && scope.boundaries?.runtimeCapabilitiesIncludedInManifestHash === true && scope.boundaries?.authenticatedCoreServiceHealthRequired === true && scope.boundaries?.exactRuntimeCoverageRequired === true);
check('scope denies missing unexpected malformed and unverified authority', scope.boundaries?.missingRuntimeCapabilityDenied === true && scope.boundaries?.unexpectedRuntimeCapabilityDenied === true && scope.boundaries?.malformedRuntimeAuthorityDenied === true && scope.boundaries?.unverifiedPolicyPackageDenied === true);
check('scope preserves offline cache and no-cache fences', scope.boundaries?.offlineCapabilityLeasePreserved === true && scope.boundaries?.policySensitiveNoCachePreserved === true && scope.boundaries?.policyStatusIpcCacheAllowed === false);
check('scope records no persistence transfer or cutover', scope.boundaries?.schemaMigrationRequired === false && scope.boundaries?.realDataTransferPerformed === false && scope.boundaries?.cutoverPerformed === false && scope.boundaries?.sqliteOwnershipTransferred === false);
check('inventory has eight implemented controls', inventory.controls?.length === 8 && inventory.controls.every((item) => item.disposition === 'IMPLEMENTED'));
check('inventory has zero findings and blockers', inventory.engine?.findings === 0 && inventory.closureSummary?.openBlockerCount === 0 && inventory.closureSummary?.openBlockers?.length === 0);
check('decision records AST signed runtime and authority separation', includesAll(decision, ['DEC-203', 'exact `kind|path|symbol`', 'imzalı Platform Policy', 'Build manifesti tek başına runtime yetkisi değildir']));
check('decision pins current Desktop OCR capability truth and communication audit source ratchet', includesAll(decision, ['555 dosya / 392 exact capability yüzeyi', manifestSha256, '`ocr-worker` capability kümesi boştur', '`lowPrivilegeSandboxVerified=false`']));
check('threat model covers all primary resource and manifest evasions', ['Beyansız statik import', 'Dinamik import/require kaçışı', 'Kamera ve mikrofon kaçışı', 'OCR/AI kaçışı', 'Konum kaçışı', 'Manifest içeriği tamperi', 'İmzalı paket ikamesi', 'Pre-handshake boşluğu'].every((marker) => threat.includes(marker)));
check('master register contains DEC-203 and current exact capability ratchet', masterRegister.includes('## DEC-203') && masterRegister.includes('DEC-203-ppk-022-capability-manifest-build-runtime-gate.md') && masterRegister.includes('555 dosya / 392 exact yüzey') && masterRegister.includes(manifestSha256));
check('decision ledger contains active DEC-203', ledger.decisionCount === ledger.decisions.length && ledger.decisions.some((item) => item.id === 'DEC-203' && item.status === 'ACTIVE' && item.requirements?.includes('PPK-022')));
check('database migration 77 baseline remains present', versions.includes(77) && latestMigration >= 77 && scope.boundaries?.latestDatabaseMigration === 77);

if (candidateMode) {
  check('candidate registry remains validation pending', requirement?.status === 'IN_PROGRESS' && requirement?.implementationState === 'IMPLEMENTED_VALIDATION_PENDING' && requirement?.chain?.targetedTest === false && requirement?.chain?.evidence === false);
  check('candidate scope remains validation pending', scope.status === 'IN_PROGRESS' && scope.implementationState === 'IMPLEMENTED_VALIDATION_PENDING' && scope.validation?.state === 'PENDING' && scope.validation?.finalValidationRecorded === false && scope.requirementCompletionClaimed === false && scope.remainingClosureWork?.length > 0);
  check('candidate inventory remains validation pending', inventory.status === 'IMPLEMENTED_VALIDATION_PENDING' && inventory.completionClaimed === false && inventory.closureSummary?.finalValidationPending === true);
  check('candidate audit makes no final PASS claim', audit.includes('VALIDATION_PENDING') && !audit.includes('Durum: `COMPLETE / PASS`'));
} else {
  check('accepted registry closes complete PPK-022 evidence chain', requirement?.status === 'COMPLETE' && requirement.implementationState === undefined && Object.values(requirement.chain ?? {}).every((value) => value === true) && requirement.evidence?.length >= 17);
  check('scope closes PPK-022 with no migration transfer or cutover', scope.status === 'COMPLETED' && scope.implementationState === 'VALIDATED_COMPLETE' && scope.validation?.state === 'COMPLETE' && scope.validation?.finalValidationRecorded === true && scope.requirementCompletionClaimed === true && scope.remainingClosureWork?.length === 0);
  check('inventory closes only after final validation', inventory.status === 'COMPLETE' && inventory.completionClaimed === true && inventory.closureSummary?.finalValidationPending === false);
  check('audit closes only with final contract and runtime evidence', audit.includes('Durum: `COMPLETE / PASS`') && /contract: `\d+\/\d+ PASS`/u.test(audit) && /runtime kanıt demeti: `\d+\/\d+ PASS`/u.test(audit));
}

const report = {
  schemaVersion: 1,
  release: 'Bronze 04.08.2026.29',
  step: '32-R',
  requirement: 'PPK-022',
  phase: candidateMode ? 'CAPABILITY_MANIFEST_BUILD_RUNTIME_GATE_CANDIDATE_CONTRACT' : 'CAPABILITY_MANIFEST_BUILD_RUNTIME_GATE_CONTRACT',
  status: failures.length ? 'FAIL' : 'PASS',
  checkCount: checks.length,
  passed: checks.length - failures.length,
  failed: failures.length,
  failures,
  checks,
  protectedCapabilityFamilies: 7,
  canonicalApplications: 14,
  productionSourceZones: gate.productionSourceZones,
  scannedProductionFiles: gate.scannedFiles,
  exactCapabilitySurfaces: gate.capabilitySurfaces,
  exactManifestEntries: gate.exactManifestSurfaces,
  exactManifestSha256: gate.exactManifestSha256,
  pinnedBootstrapSurfaces: gate.pinnedBootstrapSurfaces,
  maliciousAstSelfTests: gate.maliciousSelfTestAssertions,
  benignAstSelfTests: gate.benignSelfTestAssertions,
  gateFindings: gate.findings.length,
  signedManifestHashBindingRequired: true,
  authenticatedRuntimeAuthorityRequired: true,
  exactRuntimeCoverageRequired: true,
  buildManifestAloneGrantsRuntimeAuthority: false,
  schemaMigrationRequired: false,
  latestDatabaseMigration: 77,
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
await writeFile('artifacts/validation/32-R-ppk-022-capability-manifest-gate-contract.json', `${JSON.stringify(report, null, 2)}\n`);
if (failures.length) {
  console.error(`PPK-022${candidateMode ? ' candidate' : ''} contract: FAIL (${failures.length}/${checks.length}).`);
  failures.forEach((failure) => console.error(failure));
  process.exit(1);
}
console.log(`PPK-022${candidateMode ? ' candidate' : ''} contract: PASS (${checks.length}/${checks.length}).`);

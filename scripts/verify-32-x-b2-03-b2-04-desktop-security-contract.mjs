import { mkdir, readFile, writeFile } from 'node:fs/promises';

const readText = async (path) => {
  try { return await readFile(path, 'utf8'); }
  catch { return ''; }
};
const readJson = async (path) => {
  const source = await readText(path);
  try { return JSON.parse(source.replace(/^\uFEFF/u, '')); }
  catch { return undefined; }
};
const exactArray = (actual, expected) => Array.isArray(actual)
  && actual.length === expected.length
  && expected.every((item, index) => actual[index] === item);
const includesAll = (source, markers) => markers.every((marker) => source.includes(marker));

const [
  scope, inventory, registry, ledger, rootPackage, desktopPackage, packagerPackage,
  packagerLock, astAllowlist, capabilityManifest, binaryProof, domain, domainIndex,
  application, applicationIndex, session, adapter, dataStore, main, protocol,
  senderTrust, sessionSecurity, ipcPolicy, preload, declarations, renderer, domainRenderer,
  fusePolicy, fuseApplication, staticFuseVerifier, binaryProbe, sessionTest,
  applicationTest, integrationTest, decision, threatModel, audit, currentContract,
  masterRegister, traceability, securityStandard, migrations
] = await Promise.all([
  readJson('config/32-x-b2-03-b2-04-desktop-security-scope.json'),
  readJson('config/32-x-b2-03-b2-04-desktop-security-inventory.json'),
  readJson('config/accepted-scope-registry.json'),
  readJson('config/user-decision-ledger.json'),
  readJson('package.json'),
  readJson('apps/desktop/package.json'),
  readJson('tools/windows-packager/package.json'),
  readJson('tools/windows-packager/package-lock.json'),
  readJson('config/32-q-ppk-021-platform-policy-ast-allowlist.json'),
  readJson('config/32-r-ppk-022-capability-surface-manifest.json'),
  readJson('artifacts/validation/32-X-electron-fuse-binary-proof.json'),
  readText('packages/domain/src/desktop-security.ts'),
  readText('packages/domain/src/index.ts'),
  readText('packages/application/src/desktop-security-use-cases.ts'),
  readText('packages/application/src/index.ts'),
  readText('packages/security/src/session.ts'),
  readText('apps/desktop/src/main/auth-security-application-adapter.ts'),
  readText('apps/desktop/src/main/data-store.ts'),
  readText('apps/desktop/src/main/main.ts'),
  readText('apps/desktop/src/main/renderer-protocol.ts'),
  readText('apps/desktop/src/main/ipc-sender-trust.ts'),
  readText('apps/desktop/src/main/renderer-session-security.ts'),
  readText('apps/desktop/src/main/ipc-integration-policy.ts'),
  readText('apps/desktop/src/main/preload.ts'),
  readText('apps/desktop/src/renderer/global.d.ts'),
  readText('apps/desktop/src/renderer/App.tsx'),
  readText('packages/domain/src/renderer.ts'),
  readText('apps/desktop/scripts/electron-fuse-policy.mjs'),
  readText('apps/desktop/scripts/apply-electron-fuses.mjs'),
  readText('scripts/verify-electron-fuse-policy.mjs'),
  readText('scripts/probe-electron-fuse-binary.mjs'),
  readText('packages/security/tests/session-lock.test.ts'),
  readText('packages/application/tests/desktop-security-use-cases.test.ts'),
  readText('apps/desktop/tests/b2-desktop-security-integration.test.ts'),
  readText('docs/decisions/DEC-209-b2-03-b2-04-desktop-session-electron-security.md'),
  readText('docs/security/B2-03_B2-04_DESKTOP_SECURITY_THREAT_MODEL.md'),
  readText('docs/audit/32-X_B2-03_B2-04_DESKTOP_SECURITY_UST_KAPANIS.md'),
  readText('docs/current/DESKTOP_SESSION_AND_ELECTRON_SECURITY_CONTRACT.md'),
  readText('docs/10_MASTER_DECISION_REGISTER.md'),
  readText('docs/07_BRONZE_REQUIREMENTS_TRACEABILITY.md'),
  readText('docs/14_SECURITY_PRIVACY_BACKUP_STANDARD.md'),
  readText('packages/database/src/family-database-migrations.ts')
]);

const checks = [];
const failures = [];
const check = (name, condition) => {
  const passed = Boolean(condition);
  checks.push({ name, passed });
  if (!passed) failures.push(name);
};
const requirements = ['B2-03', 'B2-04'];
const b203 = registry?.requirements?.find((item) => item.id === 'B2-03');
const b204 = registry?.requirements?.find((item) => item.id === 'B2-04');
const b202 = registry?.requirements?.find((item) => item.id === 'B2-02');
const ppk025 = registry?.requirements?.find((item) => item.id === 'PPK-025');
const b901 = registry?.requirements?.find((item) => item.id === 'B9-01');
const ledgerDecision = ledger?.decisions?.find((item) => item.id === 'DEC-209');
const migrationVersions = [...migrations.matchAll(/createMigrationDefinition\((\d+),/gu)]
  .map((match) => Number.parseInt(match[1], 10));
const latestMigration = Math.max(...migrationVersions);
const completeChain = (item) => item?.status === 'COMPLETE'
  && Object.keys(item.chain ?? {}).length === 13
  && Object.values(item.chain ?? {}).every((value) => value === true);
const astKeys = new Set(astAllowlist?.allowedSurfaceKeys ?? []);
const capabilityKeys = new Set((capabilityManifest?.surfaces ?? []).map((item) => item.key));

check('scope identity and two-requirement completion are exact', scope?.schemaVersion === 1
  && scope?.id === '32-X-B2-03-B2-04-DESKTOP-SECURITY'
  && scope?.decision === 'DEC-209'
  && scope?.status === 'COMPLETE'
  && exactArray(scope?.requirements, requirements));
check('scope fixes idle warning activity preservation and reauthentication', scope?.sessionPolicy?.idleTimeoutMinutes === 15
  && scope?.sessionPolicy?.warningBeforeSeconds === 60
  && scope?.sessionPolicy?.backgroundWorkExtendsSession === false
  && scope?.sessionPolicy?.unsavedRendererStatePreservedOnLock === true
  && scope?.sessionPolicy?.explicitPasswordReauthentication === true
  && scope?.sessionPolicy?.secondFactorUsedWhenEnabled === true);
check('scope fixes custom protocol and Electron 43 nine-fuse policy', scope?.electronPolicy?.primaryRendererOrigin === 'pardus-app://renderer'
  && scope?.electronPolicy?.electronVersion === '43.2.0'
  && scope?.electronPolicy?.electronFuseToolVersion === '2.1.3'
  && scope?.electronPolicy?.strictlyRequireAllFuses === true
  && scope?.electronPolicy?.exactFuseCount === 9
  && scope?.electronPolicy?.binaryReadbackRequired === true);
check('scope records final validation truth', scope?.validation?.boundaryChecksPassed === 26
  && scope?.validation?.staticFuseChecksPassed === 11
  && scope?.validation?.binaryFuseReadbackPassed === 9
  && scope?.validation?.targetedTestFilesPassed === 3
  && scope?.validation?.targetedTestsPassed === 11
  && scope?.validation?.fullVitestFilesPassed >= 96
  && scope?.validation?.fullVitestTestsPassed >= 840
  && scope?.validation?.pretypecheckSecurityGatesPassed === 17
  && scope?.validation?.productionWorkspaceBuildsPassed === 18);
check('scope honestly excludes external and final claims', scope?.excludedClaims?.some((item) => item.includes('B2-02'))
  && scope?.excludedClaims?.some((item) => item.includes('PPK-025'))
  && scope?.excludedClaims?.some((item) => item.includes('B9-01')));
check('inventory has exact session and Electron control sets', inventory?.id === '32-X-DESKTOP-SECURITY-INVENTORY'
  && inventory?.sessionControls?.length === 8
  && inventory?.electronControls?.length === 9
  && inventory?.typedIpcMethods?.length === 5
  && inventory?.negativeCases?.length === 8);
check('inventory has nine unique exact fuses', inventory?.fuses?.length === 9
  && new Set(inventory.fuses.map((item) => item.name)).size === 9
  && inventory.fuses.some((item) => item.name === 'WasmTrapHandlers' && item.value === true));
check('domain owns content-free session and posture schema', includesAll(domain, [
  'SessionLockStateView', 'UnlockSessionInput', 'DesktopSecurityPostureView', "primaryRendererProtocol: 'pardus-app:'",
  'wasmTrapHandlers: true'
]) && domainIndex.includes("./desktop-security.js"));
check('application owns all session security use cases', includesAll(application, [
  'GetSessionLockStateUseCase', 'RecordSessionActivityUseCase', 'LockSessionUseCase', 'GetDesktopSecurityPostureUseCase'
]) && applicationIndex.includes("./desktop-security-use-cases.js"));
check('security session distinguishes passive checks from real activity', includesAll(session, [
  'recordActivity()', 'applyIdleLock()', 'warningBeforeSeconds', "lock(reason: 'idle_timeout' | 'manual'"
]));
check('application adapter implements expanded auth session port', includesAll(adapter, [
  'recordActivity()', "lock(reason: 'idle_timeout' | 'manual'", 'warningBeforeSeconds'
]));
check('data store reuses account and audit repositories without passive touch', includesAll(dataStore, [
  'options.touch ?? false', 'getSessionLockState()', 'recordSessionActivity()', 'lockSession()', 'unlockSession(input:',
  'session.locked_manual', 'session.unlocked', '#writeAuditAs('
]));
check('main binds five exact desktop security IPC handlers', includesAll(main, [
  "registerIpcHandler('auth:getSessionLockState'", "registerIpcHandler('auth:recordSessionActivity'",
  "registerIpcHandler('auth:lockSession'", "registerIpcHandler('auth:unlockSession'",
  "registerIpcHandler('system:getDesktopSecurityPosture'"
]));
check('protocol is privileged root-confined and replaces loadFile', includesAll(main, [
  'protocol.registerSchemesAsPrivileged', 'protocol.handle(PRIMARY_RENDERER_SCHEME', 'window.loadURL(rendererDocumentUrl)'
]) && !main.includes('window.loadFile(') && includesAll(protocol, [
  "PRIMARY_RENDERER_HOST = 'renderer'", "requested.username !== ''", "relativePath.startsWith('..')"
]));
check('sender trust and session security remain default deny', includesAll(senderTrust, [
  "parsed.protocol === 'pardus-app:'", "parsed.hostname === 'renderer'"
]) && includesAll(sessionSecurity, [
  "default-src 'none'", 'setPermissionRequestHandler', "'will-download'", "'will-navigate'", "'will-redirect'", "'will-attach-webview'"
]));
check('IPC payload policy is exact', includesAll(ipcPolicy, [
  "case 'auth:getSessionLockState':", "case 'auth:recordSessionActivity':", "case 'auth:lockSession':", "case 'auth:unlockSession':"
]));
check('preload and declarations expose exact typed API', [preload, declarations].every((source) => includesAll(source, [
  'getSessionLockState', 'recordSessionActivity', 'lockSession', 'unlockSession', 'getDesktopSecurityPosture'
])));
check('renderer implements accessible state-preserving lock UI', includesAll(renderer, [
  'SessionLockOverlay', 'aria-modal="true"', 'Kaydedilmemiş form bilgileriniz ekranda korunacak',
  "addEventListener('pointerdown',record", "addEventListener('keydown',record", "addEventListener('touchstart',record",
  'Şimdi kilitle'
]));
check('renderer browser-safe entry excludes the Node crypto export graph', includesAll(domainRenderer, [
  'OBJECT_PERMISSION_ACTIONS', 'FAMILY_RELATIONSHIP_CATALOG', 'PRODUCT_NAVIGATION_GROUPS', 'PRODUCT_NAVIGATION_ROUTES'
]) && !domainRenderer.includes('@ppt/core') && !domainRenderer.includes('./index.js')
  && renderer.includes("from '@ppt/domain/renderer';"));
check('fuse policy contains all nine reviewed values', includesAll(fusePolicy, [
  'RunAsNode: false', 'EnableCookieEncryption: true', 'EnableNodeOptionsEnvironmentVariable: false',
  'EnableNodeCliInspectArguments: false', 'EnableEmbeddedAsarIntegrityValidation: true',
  'OnlyLoadAppFromAsar: true', 'LoadBrowserProcessSpecificV8Snapshot: true',
  'GrantFileProtocolExtraPrivileges: false', 'WasmTrapHandlers: true'
]));
check('afterPack strictly requires and reads back all fuses', includesAll(fuseApplication, [
  'strictlyRequireAllFuses: true', '[FuseV1Options.WasmTrapHandlers]', 'getCurrentFuseWire', 'verifyElectronFuseBinary'
]) && desktopPackage?.build?.afterPack === 'scripts/apply-electron-fuses.mjs' && desktopPackage?.build?.asar === true);
check('fuse tooling is Electron 43 compatible and lock-pinned', packagerPackage?.devDependencies?.['@electron/fuses'] === '2.1.3'
  && packagerLock?.packages?.['node_modules/@electron/fuses']?.version === '2.1.3');
check('static and binary fuse verifiers are fail closed', includesAll(staticFuseVerifier, [
  'verifyElectronFuseBinary', 'WasmTrapHandlers', 'cookie encryption is enabled'
]) && includesAll(binaryProbe, ['binaryChanged: true', 'independentReadbackMatched', '9 fuses']));
check('real Electron binary proof is complete and changed', binaryProof?.status === 'PASS'
  && binaryProof?.binaryChanged === true
  && binaryProof?.independentReadbackMatched === true
  && binaryProof?.fuseVersion === '1'
  && Object.keys(binaryProof?.fuses ?? {}).length === 9
  && binaryProof?.fuses?.WasmTrapHandlers === true
  && binaryProof?.sourceSha256 !== binaryProof?.fusedSha256);
check('targeted tests cover timeout passive activity reauth protocol CSP and fuses', includesAll(sessionTest, [
  'warning', 'idle_timeout', 'recordActivity', 'manual'
]) && includesAll(applicationTest, ['content-free', 'GetDesktopSecurityPostureUseCase'])
  && includesAll(integrationTest, ['custom protocol requests', 'restrictive CSP', 'Electron fuses', 'state-preserving UI chain']));
check('B2-03 registry is COMPLETE with full chain and evidence', completeChain(b203)
  && b203?.evidence?.includes('artifacts/validation/32-X-b2-03-b2-04-desktop-security-contract.json')
  && b203?.evidence?.includes('artifacts/validation/32-X-b2-03-b2-04-desktop-security-runtime.json'));
check('B2-04 registry is COMPLETE with full chain and binary evidence', completeChain(b204)
  && b204?.evidence?.includes('artifacts/validation/32-X-electron-fuse-binary-proof.json')
  && b204?.evidence?.includes('artifacts/validation/32-X-b2-03-b2-04-desktop-security-runtime.json'));
check('external hardware signing and final requirements remain open', b202?.status !== 'COMPLETE'
  && ppk025?.status !== 'COMPLETE' && b901?.status !== 'COMPLETE');
check('DEC-209 is active and decision count is exact', ledgerDecision?.status === 'ACTIVE'
  && exactArray(ledgerDecision?.requirements, requirements)
  && ledger?.decisionCount >= 63
  && ledger?.decisionCount === ledger?.decisions?.length);
check('decision documentation records the first fail-closed binary finding', includesAll(decision, [
  '15 dakika', '60 saniye', 'pardus-app://renderer', 'Electron 43.2.0', 'WasmTrapHandlers', '9/9'
]));
check('threat model covers background touch traversal and fuse drift', includesAll(threatModel, [
  'Arka plan işi', 'traversal', 'yeni fuse', '9/9 ikili kanıtı'
]));
check('audit and current contract record both requirements and honest exclusions', includesAll(audit, [
  'B2-03', 'B2-04', 'B2-02', 'PPK-025', 'latest migration 77'
]) && includesAll(currentContract, ['15 dakika', 'pardus-app://renderer', 'WasmTrapHandlers', 'dokuz fuse']));
check('master traceability and security standard publish DEC-209 behavior', masterRegister.includes('## DEC-209')
  && traceability.includes('DEC-209')
  && securityStandard.includes('DEC-209'));
check('root scripts and mandatory pre-gates are bound', [
  'verify:desktop-security:boundary', 'verify:b2-desktop-security:targeted',
  'verify:b2-desktop-security:contract', 'verify:b2-desktop-security:runtime'
].every((name) => typeof rootPackage?.scripts?.[name] === 'string')
  && ['pretypecheck', 'prebuild'].every((name) => rootPackage?.scripts?.[name]?.includes('verify-desktop-security-boundary.mjs')));
check('PPK-021 exact privileged additions remain governed', [
  'NETWORK_IMPORT|apps/desktop/src/main/main.ts|electron:net',
  'USE_CASE_COMPOSITION|apps/desktop/src/main/data-store.ts|GetDesktopSecurityPostureUseCase',
  'USE_CASE_COMPOSITION|apps/desktop/src/main/data-store.ts|GetSessionLockStateUseCase',
  'USE_CASE_COMPOSITION|apps/desktop/src/main/data-store.ts|LockSessionUseCase',
  'USE_CASE_COMPOSITION|apps/desktop/src/main/data-store.ts|RecordSessionActivityUseCase'
].every((key) => astKeys.has(key)) && astKeys.size === 540);
check('PPK-022 custom protocol fetch remains governed',
  capabilityKeys.has('NETWORK_API|apps/desktop/src/main/main.ts|fetch') && capabilityKeys.size === 238);
check('no package-owned persistence migration or cutover was added', migrationVersions.includes(77) && latestMigration >= 77
  && scope?.repositoryDecision?.includes('yeni kalıcı session repository')
  && scope?.migrationDecision?.includes('latest migration 77'));

const report = Object.freeze({
  schemaVersion: 1,
  step: '32-X',
  requirements: Object.freeze(requirements),
  status: failures.length === 0 ? 'PASS' : 'FAIL',
  checksPassed: checks.filter((item) => item.passed).length,
  checksFailed: failures.length,
  checks: Object.freeze(checks),
  failures: Object.freeze(failures),
  latestDatabaseMigration: latestMigration,
  requirementCompletionClaimed: failures.length === 0,
  b202CompletedByThisPackage: false,
  ppk025CompletedByThisPackage: false,
  b901CompletedByThisPackage: false,
  generatedAt: new Date().toISOString()
});
await mkdir('artifacts/validation', { recursive: true });
await writeFile('artifacts/validation/32-X-b2-03-b2-04-desktop-security-contract.json', `${JSON.stringify(report, null, 2)}\n`);
console.log(`B2-03/B2-04 desktop security contract: ${report.status} (${report.checksPassed}/${checks.length} checks).`);
if (failures.length) {
  console.error(failures.join('\n'));
  process.exitCode = 1;
}

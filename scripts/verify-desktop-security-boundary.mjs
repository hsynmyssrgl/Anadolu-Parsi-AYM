import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { ELECTRON_FUSE_POLICY } from '../apps/desktop/scripts/electron-fuse-policy.mjs';

const readText = async (path) => readFile(path, 'utf8');
const readJson = async (path) => JSON.parse(await readText(path));
const includesAll = (source, markers) => markers.every((marker) => source.includes(marker));

export const verifyDesktopSecurityBoundary = async () => {
  const [
    domain, domainRenderer, session, application, dataStore, main, rendererProtocol, senderTrust,
    sessionSecurity, windowSecurity, ipcPolicy, preload, declarations, renderer,
    desktopPackage, rootPackage, astAllowlist, capabilityManifest, migrations
  ] = await Promise.all([
    readText('packages/domain/src/desktop-security.ts'),
    readText('packages/domain/src/renderer.ts'),
    readText('packages/security/src/session.ts'),
    readText('packages/application/src/desktop-security-use-cases.ts'),
    readText('apps/desktop/src/main/data-store.ts'),
    readText('apps/desktop/src/main/main.ts'),
    readText('apps/desktop/src/main/renderer-protocol.ts'),
    readText('apps/desktop/src/main/ipc-sender-trust.ts'),
    readText('apps/desktop/src/main/renderer-session-security.ts'),
    readText('apps/desktop/src/main/renderer-window-security.ts'),
    readText('apps/desktop/src/main/ipc-integration-policy.ts'),
    readText('apps/desktop/src/main/preload.ts'),
    readText('apps/desktop/src/renderer/global.d.ts'),
    readText('apps/desktop/src/renderer/App.tsx'),
    readJson('apps/desktop/package.json'),
    readJson('package.json'),
    readJson('config/32-q-ppk-021-platform-policy-ast-allowlist.json'),
    readJson('config/32-r-ppk-022-capability-surface-manifest.json'),
    readText('packages/database/src/family-database-migrations.ts')
  ]);

  const checks = [];
  const failures = [];
  const check = (name, condition) => {
    const passed = Boolean(condition);
    checks.push({ name, passed });
    if (!passed) failures.push(name);
  };
  const migrationVersions = [...migrations.matchAll(/createMigrationDefinition\((\d+),/gu)]
    .map((match) => Number.parseInt(match[1], 10));
  const latestMigration = Math.max(...migrationVersions);
  const fuseEntries = Object.entries(ELECTRON_FUSE_POLICY);
  const astKeys = new Set(astAllowlist.allowedSurfaceKeys ?? []);
  const capabilityKeys = new Set((capabilityManifest.surfaces ?? []).map((item) => item.key));

  check('domain fixes the 15 minute timeout and 60 second warning', includesAll(domain, [
    'DEFAULT_SESSION_IDLE_TIMEOUT_MINUTES = 15', 'DEFAULT_SESSION_WARNING_SECONDS = 60',
    'backgroundActivityExtendsSession: false', 'unsavedRendererStatePreservedOnLock: true', 'explicitReauthenticationRequired: true'
  ]));
  check('domain publishes a content-free lock view', includesAll(domain, [
    "SessionLockStatus = 'signed_out' | 'active' | 'warning' | 'locked'", 'secondsRemaining: number', 'UnlockSessionInput'
  ]) && !domain.includes('displayName'));
  check('session manager locks passively without background touch', includesAll(session, [
    'public recordActivity()', 'private applyIdleLock()', "status = 'locked'", 'options.touch ?? true'
  ]));
  check('application owns get activity lock and posture use cases', includesAll(application, [
    'GetSessionLockStateUseCase', 'RecordSessionActivityUseCase', 'LockSessionUseCase', 'GetDesktopSecurityPostureUseCase'
  ]));
  check('data store keeps repository operations passive and audits lock transitions', includesAll(dataStore, [
    '#requireAuth(options:', 'options.touch ?? false', 'session.locked_manual', 'session.unlocked', '#writeAuditAs('
  ]));
  check('unlock requires the exact locked account and explicit login reauthentication', includesAll(dataStore, [
    "current.status !== 'locked'", 'accountId: current.accountId', 'password: input.password', 'secondFactorCode'
  ]));
  check('custom protocol is registered privileged before app ready', includesAll(main, [
    'protocol.registerSchemesAsPrivileged', 'scheme: PRIMARY_RENDERER_SCHEME', 'secure: true', 'supportFetchAPI: true'
  ]));
  check('production renderer loads only the custom application URL', includesAll(main, [
    'PRIMARY_RENDERER_DOCUMENT_URL', 'protocol.handle(PRIMARY_RENDERER_SCHEME', 'resolvePrimaryRendererAssetPath', 'window.loadURL(rendererDocumentUrl)'
  ]) && !main.includes('window.loadFile('));
  check('protocol path resolver confines host credentials and traversal', includesAll(rendererProtocol, [
    "PRIMARY_RENDERER_SCHEME = 'pardus-app'", "PRIMARY_RENDERER_HOST = 'renderer'", "requested.username !== ''",
    "decodedPath.includes('\\0')", "relativePath.startsWith('..')", 'return null'
  ]));
  check('sender trust accepts custom origin and rejects file as primary origin', includesAll(senderTrust, [
    "parsed.protocol === 'pardus-app:'", "parsed.hostname === 'renderer'", "!['pardus-app:', 'http:', 'https:'].includes(parsed.protocol)"
  ]));
  check('renderer session uses restrictive response CSP', includesAll(sessionSecurity, [
    "default-src 'none'", "script-src 'self'", "object-src 'none'", "frame-ancestors 'none'", 'onHeadersReceived'
  ]));
  check('permission navigation redirect download and webview fences remain default deny', includesAll(sessionSecurity, [
    'setPermissionRequestHandler', 'setPermissionCheckHandler', "'will-download'", "'will-navigate'", "'will-redirect'", "'will-attach-webview'"
  ]));
  check('renderer preferences enforce sandbox isolation and no Node integration', includesAll(windowSecurity, [
    'sandbox: true', 'contextIsolation: true', 'nodeIntegration: false', 'webSecurity: true', 'webviewTag: false'
  ]));
  check('lock IPC validation is exact and fail closed', includesAll(ipcPolicy, [
    "case 'auth:getSessionLockState':", "case 'auth:recordSessionActivity':", "case 'auth:lockSession':", "case 'auth:unlockSession':"
  ]));
  check('typed preload and renderer declarations expose the complete lock boundary', [preload, declarations].every((source) => includesAll(source, [
    'getSessionLockState', 'recordSessionActivity', 'lockSession', 'unlockSession', 'getDesktopSecurityPosture'
  ])));
  check('renderer records only real interaction events', includesAll(renderer, [
    "addEventListener('pointerdown',record", "addEventListener('keydown',record", "addEventListener('touchstart',record", 'recordSessionActivity()'
  ]));
  check('renderer warning and lock overlay preserve the mounted application state', includesAll(renderer, [
    'SessionLockOverlay', "status==='warning'", "status==='locked'", 'aria-hidden={sessionOverlayVisible?true:undefined}',
    'Kaydedilmemiş form bilgileriniz ekranda korunacak'
  ]));
  check('renderer requires password and supports second factor on unlock', includesAll(renderer, [
    'password', 'secondFactorCode', 'onUnlock({password', 'aria-modal="true"'
  ]));
  check('renderer runtime uses the browser-safe domain entry without the Node crypto export graph', includesAll(domainRenderer, [
    'OBJECT_PERMISSION_ACTIONS', 'FAMILY_RELATIONSHIP_CATALOG', 'PRODUCT_NAVIGATION_GROUPS', 'PRODUCT_NAVIGATION_ROUTES'
  ]) && domainRenderer.includes("import type { IsoDateTime, UserId } from '@ppt/core';")
    && !/import\s+(?!type\b)[^;]+from\s+['"]@ppt\/core['"]/u.test(domainRenderer)
    && !domainRenderer.includes('./index.js')
    && renderer.includes("from '@ppt/domain/renderer';")
    && !renderer.includes("import { FAMILY_RELATIONSHIP_CATALOG, OBJECT_PERMISSION_ACTIONS, PRODUCT_NAVIGATION_GROUPS, PRODUCT_NAVIGATION_ROUTES, getFamilyRelationship, type FamilyRelationshipCategory, type FamilyRelationshipCode } from '@ppt/domain';"));
  check('manual lock is reachable from the profile menu', renderer.includes('Şimdi kilitle'));
  check('all nine Electron fuses have exact reviewed values', fuseEntries.length === 9
    && ELECTRON_FUSE_POLICY.RunAsNode === false
    && ELECTRON_FUSE_POLICY.EnableCookieEncryption === true
    && ELECTRON_FUSE_POLICY.EnableNodeOptionsEnvironmentVariable === false
    && ELECTRON_FUSE_POLICY.EnableNodeCliInspectArguments === false
    && ELECTRON_FUSE_POLICY.EnableEmbeddedAsarIntegrityValidation === true
    && ELECTRON_FUSE_POLICY.OnlyLoadAppFromAsar === true
    && ELECTRON_FUSE_POLICY.LoadBrowserProcessSpecificV8Snapshot === false
    && ELECTRON_FUSE_POLICY.GrantFileProtocolExtraPrivileges === false
    && ELECTRON_FUSE_POLICY.WasmTrapHandlers === true);
  check('packaging requires ASAR and afterPack fuse mutation', desktopPackage.build?.asar === true
    && desktopPackage.build?.afterPack === 'scripts/apply-electron-fuses.mjs');
  check('new privileged surfaces are exact PPK-021 allowances', [
    'USE_CASE_COMPOSITION|apps/desktop/src/main/data-store.ts|GetDesktopSecurityPostureUseCase',
    'USE_CASE_COMPOSITION|apps/desktop/src/main/data-store.ts|GetSessionLockStateUseCase',
    'USE_CASE_COMPOSITION|apps/desktop/src/main/data-store.ts|LockSessionUseCase',
    'USE_CASE_COMPOSITION|apps/desktop/src/main/data-store.ts|RecordSessionActivityUseCase'
  ].every((key) => astKeys.has(key))
    && !astKeys.has('NETWORK_IMPORT|apps/desktop/src/main/main.ts|electron:net'));
  check('custom protocol transport uses the exact file-backed surface without stale fetch authority',
    capabilityKeys.has('FILE_IMPORT|apps/desktop/src/main/main.ts|node:fs/promises:readFile')
    && !capabilityKeys.has('NETWORK_API|apps/desktop/src/main/main.ts|fetch'));
  check('root pretypecheck and prebuild execute this boundary', ['pretypecheck', 'prebuild'].every((name) =>
    rootPackage.scripts?.[name]?.includes('verify-desktop-security-boundary.mjs')));
  check('migration 77 package baseline remains present', migrationVersions.includes(77) && latestMigration >= 77);

  return Object.freeze({
    schemaVersion: 1,
    step: '32-X',
    requirements: Object.freeze(['B2-03', 'B2-04']),
    status: failures.length === 0 ? 'PASS' : 'FAIL',
    checksPassed: checks.filter((item) => item.passed).length,
    checksFailed: failures.length,
    checks: Object.freeze(checks),
    failures: Object.freeze(failures),
    latestDatabaseMigration: latestMigration,
    generatedAt: new Date().toISOString()
  });
};

const report = await verifyDesktopSecurityBoundary();
await mkdir('artifacts/validation', { recursive: true });
await writeFile('artifacts/validation/32-X-b2-03-b2-04-desktop-security-boundary.json', `${JSON.stringify(report, null, 2)}\n`);
console.log(`B2-03/B2-04 desktop security boundary: ${report.status} (${report.checksPassed}/${report.checks.length} checks).`);
if (report.status !== 'PASS') {
  console.error(report.failures.join('\n'));
  process.exitCode = 1;
}

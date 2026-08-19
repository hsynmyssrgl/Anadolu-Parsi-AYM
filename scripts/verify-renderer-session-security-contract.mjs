import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';
import { resolveTypeScriptCommand } from './lib/typescript-command.mjs';

const cli = process.argv.slice(2);
const readArg = (name, fallback) => {
  const index = cli.indexOf(name);
  if (index < 0) return fallback;
  const value = cli[index + 1];
  if (!value || value.startsWith('--')) throw new Error(`${name} requires a value.`);
  return value;
};
const reportPath = resolve(readArg('--report', 'artifacts/validation/renderer-session-security-contract.json'));
const tempRoot = resolve('.tmp/renderer-session-security-contract');
let assertions = 0;
const failures = [];
const verify = (condition, message) => { assertions += 1; if (!condition) failures.push(message); };

await rm(tempRoot, { recursive: true, force: true });
await mkdir(tempRoot, { recursive: true });
const compiler = resolveTypeScriptCommand();
const compile = spawnSync(compiler.command, [...compiler.prefixArgs,
  'apps/desktop/src/main/ipc-sender-trust.ts',
  'apps/desktop/src/main/renderer-session-security.ts',
  '--ignoreConfig',
  '--target', 'ES2024',
  '--module', 'ESNext',
  '--moduleResolution', 'Bundler',
  '--strict',
  '--skipLibCheck',
  '--outDir', tempRoot,
  '--declaration', 'false',
  '--sourceMap', 'false'
], { cwd: process.cwd(), encoding: 'utf8', env: { ...process.env, TERM: 'dumb' } });
verify(compile.status === 0, `renderer session security source compile failed: ${compile.stderr || compile.stdout}`);

if (compile.status === 0) {
  const contract = await import(`${pathToFileURL(join(tempRoot, 'renderer-session-security.js')).href}?v=${Date.now()}`);
  const handlers = new Map();
  let permissionRequestHandler;
  let permissionCheckHandler;
  let downloadListenerCount = 0;
  const violations = [];
  const session = {
    setPermissionRequestHandler(handler) { permissionRequestHandler = handler; },
    setPermissionCheckHandler(handler) { permissionCheckHandler = handler; },
    on(event, listener) {
      verify(event === 'will-download', `unexpected session event=${event}`);
      downloadListenerCount += 1;
      handlers.set(`session:${event}`, listener);
    }
  };
  const webContents = {
    session,
    on(event, listener) { handlers.set(`web:${event}`, listener); }
  };
  const trustedDocumentUrl = 'pardus-app://renderer/index.html';
  contract.installRendererSessionSecurity({ webContents, trustedDocumentUrl, onViolation: (violation) => violations.push(violation) });

  verify(typeof permissionRequestHandler === 'function', 'permission request handler was not installed');
  verify(typeof permissionCheckHandler === 'function', 'permission check handler was not installed');
  for (const event of ['will-download', 'will-navigate', 'will-redirect', 'will-attach-webview']) {
    verify(handlers.has(`${event === 'will-download' ? 'session' : 'web'}:${event}`), `security listener missing=${event}`);
  }

  let permissionAllowed;
  permissionRequestHandler({}, 'camera', (allowed) => { permissionAllowed = allowed; }, {});
  verify(permissionAllowed === false, 'camera permission request was allowed');
  verify(permissionCheckHandler({}, 'geolocation', 'https://example.com', {}) === false, 'geolocation permission check was allowed');
  verify(violations.some((item) => item.reason === 'PERMISSION_REQUEST_REJECTED' && item.permission === 'camera'), 'permission request violation was not reported');
  verify(violations.some((item) => item.reason === 'PERMISSION_CHECK_REJECTED' && item.permission === 'geolocation'), 'permission check violation was not reported');

  const event = () => ({ prevented: false, preventDefault() { this.prevented = true; } });
  const trustedNavigation = event();
  handlers.get('web:will-navigate')(trustedNavigation, 'pardus-app://renderer/index.html#route');
  verify(trustedNavigation.prevented === false, 'trusted hash navigation was rejected');
  const untrustedNavigation = event();
  handlers.get('web:will-navigate')(untrustedNavigation, 'pardus-app://renderer/other.html');
  verify(untrustedNavigation.prevented === true, 'untrusted file navigation was allowed');
  const untrustedRedirect = event();
  handlers.get('web:will-redirect')(untrustedRedirect, 'https://example.com/login');
  verify(untrustedRedirect.prevented === true, 'remote redirect was allowed');
  const queryRedirect = event();
  handlers.get('web:will-redirect')(queryRedirect, 'pardus-app://renderer/index.html?spoof=1');
  verify(queryRedirect.prevented === true, 'query-changing redirect was allowed');

  const webviewEvent = event();
  const webPreferences = { preload: '/tmp/evil.cjs', nodeIntegration: true };
  const params = { src: 'https://example.com', partition: 'persist:evil' };
  handlers.get('web:will-attach-webview')(webviewEvent, webPreferences, params);
  verify(webviewEvent.prevented === true, 'webview attachment was allowed');
  verify(Object.keys(webPreferences).length === 0, 'webview preferences were not cleared');
  verify(Object.keys(params).length === 0, 'webview params were not cleared');

  const downloadEvent = event();
  let canceled = false;
  handlers.get('session:will-download')(downloadEvent, { cancel() { canceled = true; } }, webContents);
  verify(downloadEvent.prevented === true, 'download event was not prevented');
  verify(canceled === true, 'download item was not canceled');

  contract.installRendererSessionSecurity({ webContents, trustedDocumentUrl, onViolation: (violation) => violations.push(violation) });
  verify(downloadListenerCount === 1, `download listener duplicated=${downloadListenerCount}`);
  for (const reason of [
    'UNTRUSTED_NAVIGATION_REJECTED',
    'UNTRUSTED_REDIRECT_REJECTED',
    'WEBVIEW_ATTACH_REJECTED',
    'DOWNLOAD_REJECTED'
  ]) verify(violations.some((item) => item.reason === reason), `violation was not reported=${reason}`);
}

const mainSource = await readFile('apps/desktop/src/main/main.ts', 'utf8');
const rendererWindowSecuritySource = await readFile('apps/desktop/src/main/renderer-window-security.ts', 'utf8');
for (const marker of [
  'installRendererSessionSecurity',
  'renderer.session.violation',
  'createSecureRendererPreferences',
  'assertSecureRendererPreferences'
]) verify(mainSource.includes(marker), `main renderer session integration marker missing=${marker}`);
for (const marker of [
  'webSecurity: true',
  'allowRunningInsecureContent: false',
  'webviewTag: false',
  'navigateOnDragDrop: false'
]) verify(rendererWindowSecuritySource.includes(marker), `renderer window security marker missing=${marker}`);
verify(!mainSource.includes("window.webContents.on('will-navigate'"), 'legacy standalone will-navigate handler remains');

const report = {
  schemaVersion: 1,
  product: 'ParsYuva AYM',
  applicationVersion: '19.8.2026-33',
  packageVersion: '19.8.2026-33',
  stage: 'Bronze Active Development',
  scope: 'Electron renderer session permission, download, navigation, redirect and webview deny-by-default boundary',
  assertions,
  failures,
  status: failures.length === 0 ? 'PASS' : 'FAIL',
  generatedAt: new Date().toISOString()
};
await mkdir(dirname(reportPath), { recursive: true });
await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`);
await rm(tempRoot, { recursive: true, force: true });
console.log(`Renderer session security contract: ${report.status} — ${assertions} assertions.`);
for (const failure of failures) console.error(`- ${failure}`);
if (report.status !== 'PASS') process.exitCode = 1;

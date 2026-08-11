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
const reportPath = resolve(readArg('--report', 'artifacts/validation/ipc-sender-trust-contract.json'));
const tempRoot = resolve('.tmp/ipc-sender-trust-contract');
const sourcePath = resolve('apps/desktop/src/main/ipc-sender-trust.ts');
let assertions = 0;
const failures = [];
const verify = (condition, message) => { assertions += 1; if (!condition) failures.push(message); };
const verifyThrows = (fn, message) => {
  assertions += 1;
  try { fn(); failures.push(message); } catch { /* expected */ }
};

await rm(tempRoot, { recursive: true, force: true });
await mkdir(tempRoot, { recursive: true });
const compiler = resolveTypeScriptCommand();
const compile = spawnSync(compiler.command, [...compiler.prefixArgs,
  sourcePath,
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
verify(compile.status === 0, `ipc sender trust source compile failed: ${compile.stderr || compile.stdout}`);

let contract;
if (compile.status === 0) {
  contract = await import(`${pathToFileURL(join(tempRoot, 'ipc-sender-trust.js')).href}?v=${Date.now()}`);
  const fileExpected = contract.normalizeTrustedRendererDocumentUrl('file:///app/renderer/index.html#route', { allowLocalDevelopmentServer: false });
  verify(fileExpected === 'file:///app/renderer/index.html', `file renderer normalization mismatch=${fileExpected}`);
  const devExpected = contract.normalizeTrustedRendererDocumentUrl('http://localhost:5173/app/?mode=dev#route', { allowLocalDevelopmentServer: true });
  verify(devExpected === 'http://localhost:5173/app/?mode=dev', `dev renderer normalization mismatch=${devExpected}`);
  verify(contract.normalizeTrustedRendererDocumentUrl('http://127.0.0.1:5173/', { allowLocalDevelopmentServer: true }) === 'http://127.0.0.1:5173/', 'IPv4 loopback rejected');
  verify(contract.normalizeTrustedRendererDocumentUrl('http://[::1]:5173/', { allowLocalDevelopmentServer: true }) === 'http://[::1]:5173/', 'IPv6 loopback rejected');
  verifyThrows(() => contract.normalizeTrustedRendererDocumentUrl('https://example.com/app', { allowLocalDevelopmentServer: true }), 'remote development renderer accepted');
  verifyThrows(() => contract.normalizeTrustedRendererDocumentUrl('http://user:pass@localhost:5173/', { allowLocalDevelopmentServer: true }), 'credentialed renderer URL accepted');
  verifyThrows(() => contract.normalizeTrustedRendererDocumentUrl('javascript:alert(1)', { allowLocalDevelopmentServer: true }), 'javascript renderer URL accepted');
  verifyThrows(() => contract.normalizeTrustedRendererDocumentUrl('http://localhost:5173/', { allowLocalDevelopmentServer: false }), 'HTTP renderer accepted outside development mode');

  verify(contract.isTrustedRendererDocument('file:///app/renderer/index.html#x', 'file:///app/renderer/index.html'), 'file hash navigation should remain trusted');
  verify(!contract.isTrustedRendererDocument('file:///app/renderer/other.html', 'file:///app/renderer/index.html'), 'sibling file document accepted');
  verify(contract.isTrustedRendererDocument('http://localhost:5173/app/?mode=dev#x', devExpected), 'dev hash navigation rejected');
  verify(!contract.isTrustedRendererDocument('http://localhost:5173/app/child?mode=dev', devExpected), 'path-prefix renderer spoof accepted');
  verify(!contract.isTrustedRendererDocument('http://localhost:5173/app/?mode=prod', devExpected), 'query mismatch accepted');
  verify(!contract.isTrustedRendererDocument('http://localhost:5173.evil.test/app/?mode=dev', devExpected), 'hostname-prefix spoof accepted');
  verify(!contract.isTrustedRendererDocument('not-a-url', devExpected), 'invalid sender URL accepted');

  verify(contract.isSafeExternalHttpsUrl('https://example.com/path'), 'safe HTTPS URL rejected');
  verify(!contract.isSafeExternalHttpsUrl('http://example.com/path'), 'HTTP external URL accepted');
  verify(!contract.isSafeExternalHttpsUrl('https://user:pass@example.com/path'), 'credentialed external URL accepted');
  verify(!contract.isSafeExternalHttpsUrl('javascript:alert(1)'), 'javascript external URL accepted');

  const mainFrame = { url: 'file:///app/renderer/index.html#route' };
  const trusted = { webContentsId: 17, documentUrl: 'file:///app/renderer/index.html' };
  const validEvent = { sender: { id: 17, mainFrame }, senderFrame: mainFrame };
  verify(contract.evaluateIpcSenderTrust(validEvent, trusted).trusted === true, 'valid main renderer rejected');
  verify(contract.evaluateIpcSenderTrust(validEvent, undefined).reason === 'TRUSTED_RENDERER_UNAVAILABLE', 'missing renderer reason mismatch');
  verify(contract.evaluateIpcSenderTrust({ ...validEvent, sender: { ...validEvent.sender, id: 18 } }, trusted).reason === 'SENDER_ID_MISMATCH', 'sender id mismatch accepted');
  verify(contract.evaluateIpcSenderTrust({ sender: validEvent.sender }, trusted).reason === 'SENDER_FRAME_MISSING', 'missing sender frame accepted');
  verify(contract.evaluateIpcSenderTrust({ sender: validEvent.sender, senderFrame: { url: mainFrame.url } }, trusted).reason === 'SUBFRAME_REJECTED', 'subframe accepted');
  const invalidMainFrame = { url: 'not-a-url' };
  verify(contract.evaluateIpcSenderTrust({ sender: { id: 17, mainFrame: invalidMainFrame }, senderFrame: invalidMainFrame }, trusted).reason === 'SENDER_URL_INVALID', 'invalid frame URL accepted');
  const otherMainFrame = { url: 'file:///app/renderer/other.html' };
  verify(contract.evaluateIpcSenderTrust({ sender: { id: 17, mainFrame: otherMainFrame }, senderFrame: otherMainFrame }, trusted).reason === 'SENDER_DOCUMENT_MISMATCH', 'other renderer document accepted');
}

const ipcRuntime = await readFile('apps/desktop/src/main/ipc-runtime.ts', 'utf8');
const mainSource = await readFile('apps/desktop/src/main/main.ts', 'utf8');
const sessionPolicySource = await readFile('apps/desktop/src/main/renderer-session-security.ts', 'utf8');
for (const marker of ['evaluateIpcSenderTrust', 'resolveTrustedRenderer', 'ipc.request.rejected', "category: 'security'", 'AUTHORIZATION_DENIED']) {
  verify(ipcRuntime.includes(marker), `IPC runtime integration marker missing=${marker}`);
}
for (const marker of ['normalizeTrustedRendererDocumentUrl', 'isSafeExternalHttpsUrl', 'trustedRenderer = {', "window.once('closed'", 'pathToFileURL(rendererFilePath)', 'installRendererSessionSecurity']) {
  verify(mainSource.includes(marker), `main renderer trust marker missing=${marker}`);
}
verify(
  mainSource.includes('const primaryWebContentsId = window.webContents.id;'),
  'primary webContents id is not captured before the BrowserWindow can be destroyed'
);
const closedHandler = mainSource.match(/window\.once\('closed',\s*\(\)\s*=>\s*\{([\s\S]*?)\n\s*\}\);/)?.[1] ?? '';
verify(closedHandler.length > 0, 'primary BrowserWindow closed handler could not be inspected');
verify(
  !closedHandler.includes('window.webContents'),
  'closed handler accesses BrowserWindow.webContents after Electron has destroyed the native object'
);
verify(
  closedHandler.includes('primaryWebContentsId'),
  'closed handler does not clear renderer trust using the pre-captured webContents id'
);
verify(sessionPolicySource.includes('isTrustedRendererDocument'), 'central renderer session policy does not reuse exact document trust');
verify(!mainSource.includes("url.startsWith(rendererUrl)"), 'legacy renderer URL prefix trust remains');
verify(!mainSource.includes("url.startsWith('file://')"), 'broad file URL trust remains');

const report = {
  schemaVersion: 1,
  product: 'Panthera pardus tulliana Aile',
  applicationVersion: '25.07.2026.119',
  packageVersion: '25.7.2026-119',
  stage: 'Bronze RC2 Active Development',
  scope: 'Electron IPC sender webContents, main-frame and exact renderer document trust boundary',
  assertions,
  failures,
  status: failures.length === 0 ? 'PASS' : 'FAIL',
  generatedAt: new Date().toISOString()
};
await mkdir(dirname(reportPath), { recursive: true });
await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`);
await rm(tempRoot, { recursive: true, force: true });
console.log(`IPC sender trust contract: ${report.status} — ${assertions} assertions.`);
for (const failure of failures) console.error(`- ${failure}`);
if (report.status !== 'PASS') process.exitCode = 1;

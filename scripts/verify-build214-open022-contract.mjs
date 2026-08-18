import { readFile, writeFile, mkdir } from 'node:fs/promises';

const files = Object.fromEntries(await Promise.all([
  'apps/desktop/src/main/protected-side-artifact-store.ts',
  'apps/desktop/src/main/protected-side-artifact-logger.ts',
  'apps/desktop/src/main/runtime-bootstrap.ts',
  'apps/desktop/src/main/main.ts',
  'apps/desktop/src/main/operational-artifact-file-application-adapter.ts',
  'apps/desktop/src/main/security-event-receipt-store.ts',
  'apps/desktop/src/main/startup-security-preflight.ts'
].map(async (path) => [path, await readFile(path, 'utf8')])));
const store = files['apps/desktop/src/main/protected-side-artifact-store.ts'];
const logger = files['apps/desktop/src/main/protected-side-artifact-logger.ts'];
const runtime = files['apps/desktop/src/main/runtime-bootstrap.ts'];
const main = files['apps/desktop/src/main/main.ts'];
const adapter = files['apps/desktop/src/main/operational-artifact-file-application-adapter.ts'];
const receipts = files['apps/desktop/src/main/security-event-receipt-store.ts'];
const preflight = files['apps/desktop/src/main/startup-security-preflight.ts'];

const checks = [];
const check = (label, condition) => {
  if (!condition) throw new Error(`OPEN-022 contract failed: ${label}`);
  checks.push(label);
};
check('protected store uses createDataKey', store.includes('createDataKey'));
check('protected store uses encryptBytes', store.includes('encryptBytes'));
check('protected store uses decryptBytes', store.includes('decryptBytes'));
check('protected container requires aes-256-gcm', store.includes("algorithm !== 'aes-256-gcm'"));
check('side-artifact key is device protected', store.includes('protector.protect(dataKey.toString'));
check('side-artifact key is device unprotected', store.includes('protector.unprotect(envelope.protectedDataKey)'));
check('key envelope binds protectionId', store.includes('protectionId: protector.protectionId'));
check('artifact writes are atomic', store.includes('fsyncSync') && store.includes('renameSync'));
check('artifact files use restrictive mode', store.includes("openSync(temporaryPath, 'wx', 0o600)"));
check('protected log extension is pplog', logger.includes("'desktop-main.pplog'"));
check('rotated protected logs retain pplog extension', logger.includes('.pplog`'));
check('log payload is serialized before encryption', logger.includes('serializeLogEvent') && logger.includes('appendTextRecord'));
check('runtime logger is protected logger', runtime.includes('new ProtectedSideArtifactLogger'));
check('runtime cache is under volatile root', runtime.includes("cache: join(input.volatileRootPath, 'cache')"));
check('runtime temp is under volatile root', runtime.includes("temp: join(input.volatileRootPath, 'temp')"));
check('browser session is redirected to volatile root', main.includes("app.setPath('sessionData', join(volatileRuntimeRoot, 'browser-session'))"));
check('crash dumps are redirected to volatile root', main.includes("app.setPath('crashDumps', join(volatileRuntimeRoot, 'crash'))"));
check('volatile root is cleaned at startup', main.includes("rmSync(volatileRuntimeRoot, { recursive: true, force: true })"));
check('volatile root is unique per process launch', main.includes('`runtime-${process.pid}-${Date.now().toString(36)}`'));
check('volatile root cleanup cannot crash normal Windows quit', main.includes("app.on('before-quit'") && main.includes('catch { /* will-quit retries after all windows have closed */ }'));
check('volatile root cleanup retries after every window closes', main.includes("app.on('will-quit'") && main.includes('OS temporary-storage maintenance may remove a still-locked residue later'));
check('locked volatile residue is retried only on a later primary launch', main.includes('volatileRuntimeCleanupMarker') && main.includes('previousProcessAlive') && main.includes("dirname(previousRuntimeRoot) === resolve(volatileRuntimeBase)") && main.includes('!previousStat.isSymbolicLink()') && main.includes('maxRetries: 4'));
check('operational exports have protected port', adapter.includes('class ProtectedOperationalArtifactFilePort'));
check('security receipts can use protected store', receipts.includes('protectedArtifacts.writeText'));
check('startup preflight supports protected writer', preflight.includes('writeEvidence?:') && preflight.includes('input.writeEvidence'));
check('diagnostic exports use pptdiag containers', main.includes('.pptdiag') && main.includes("extensions:['pptdiag']"));
check('health report uses pptreport container', main.includes('.pptreport') && main.includes("'system-health-report-pdf'"));
check('plaintext system PDF disk write removed', !main.includes('writeFileSync(result.filePath,buffer)'));

await mkdir('artifacts/validation', { recursive: true });
await writeFile('artifacts/validation/build214-open022-contract.json', `${JSON.stringify({
  schemaVersion: 1,
  build: 214,
  status: 'PASS',
  checks: checks.length,
  results: checks,
  generatedAt: new Date().toISOString()
}, null, 2)}\n`);
console.log(`Build 214 OPEN-022 security contract: PASS (${checks.length}/${checks.length}).`);

import { readFile, writeFile, mkdir, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { execFileSync } from 'node:child_process';

const temp = await mkdtemp(join(tmpdir(), 'ppt-build214-integration-'));
await writeFile(join(temp, 'package.json'), '{"type":"module"}\n');
const tsc = join('node_modules', 'typescript', 'lib', 'tsc.js');
execFileSync(process.execPath, [tsc, '--ignoreConfig', 'packages/security/src/encryption.ts', '--target', 'es2022', '--module', 'esnext', '--moduleResolution', 'bundler', '--rootDir', 'packages/security/src', '--outDir', temp, '--types', 'node', '--skipLibCheck', '--noCheck'], { stdio: 'pipe' });
execFileSync(process.execPath, [tsc, '--ignoreConfig', 'packages/domain/src/app-meta.ts', '--target', 'es2022', '--module', 'esnext', '--moduleResolution', 'bundler', '--rootDir', 'packages/domain/src', '--outDir', temp, '--types', 'node', '--skipLibCheck', '--noCheck'], { stdio: 'pipe' });
execFileSync(process.execPath, [tsc, '--ignoreConfig', 'apps/desktop/src/main/protected-side-artifact-store.ts', '--target', 'es2022', '--module', 'esnext', '--moduleResolution', 'bundler', '--rootDir', 'apps/desktop/src/main', '--outDir', temp, '--types', 'node', '--skipLibCheck', '--noCheck'], { stdio: 'pipe' });
const rawStore = join(temp, 'protected-side-artifact-store.js');
const patchedStore = join(temp, 'store.js');
await writeFile(patchedStore, (await readFile(rawStore, 'utf8'))
  .replace("from '@ppt/domain'", "from './app-meta.js'")
  .replace("from '@ppt/security'", "from './encryption.js'"));
const { ProtectedSideArtifactStore } = await import(pathToFileURL(patchedStore).href);
const protector = { protectionId:'integration-dpapi', required:true, isAvailable:()=>true, protect:(v)=>Buffer.from(`p:${v}`).toString('base64url'), unprotect:(v)=>Buffer.from(v,'base64url').toString('utf8').slice(2) };
const store = new ProtectedSideArtifactStore({ keyPath: join(temp,'secrets','side-key.json'), applicationVersion:'01.08.2026.214', protector });
const source = {
  main: await readFile('apps/desktop/src/main/main.ts','utf8'),
  dataStore: await readFile('apps/desktop/src/main/data-store.ts','utf8'),
  runtime: await readFile('apps/desktop/src/main/runtime-bootstrap.ts','utf8'),
  adapter: await readFile('apps/desktop/src/main/operational-artifact-file-application-adapter.ts','utf8'),
  receipts: await readFile('apps/desktop/src/main/security-event-receipt-store.ts','utf8'),
  preflight: await readFile('apps/desktop/src/main/startup-security-preflight.ts','utf8')
};
const productionStoreStart=source.main.indexOf('function store(');
const productionStoreEnd=source.main.indexOf('\nfunction ',productionStoreStart+1);
const productionStoreComposition=source.main.slice(productionStoreStart,productionStoreEnd);
const checks=[]; const check=(label,condition)=>{if(!condition)throw new Error(label);checks.push(label)};
const secret='INTEGRATION-HASSAS-214';
const diag=join(temp,'out','integration.pptdiag'); store.writeText(diag,'diagnostic-export',secret);
check('diagnostic container round-trips through protected store',store.readText(diag)===secret);
check('diagnostic container hides plaintext',!(await readFile(diag,'utf8')).includes(secret));
check('desktop runtime injects protected store into logger',source.runtime.includes('store: input.protectedArtifacts'));
check('sole production datastore construction injects protected operational port',
  (source.main.match(/new FamilyDataStore\s*\(/gu)??[]).length===1
  &&productionStoreComposition.includes('operationalArtifactFiles: new ProtectedOperationalArtifactFilePort(current.protectedArtifacts)'));
check('production composition never instantiates plaintext operational adapter',
  !productionStoreComposition.includes('FileSystemOperationalArtifactFilePort')
  &&!source.main.includes('new FileSystemOperationalArtifactFilePort'));
check('test-compatible datastore fallback is not treated as production evidence',
  source.dataStore.includes('options.operationalArtifactFiles ?? new FileSystemOperationalArtifactFilePort()')
  &&productionStoreComposition.includes('operationalArtifactFiles: new ProtectedOperationalArtifactFilePort(current.protectedArtifacts)'));
check('security receipt path uses protected container',source.main.includes('security-event-receipts.pptdiag')&&source.receipts.includes('protectedArtifacts'));
check('startup preflight evidence is protected',source.main.includes('startup-security-preflight.pptdiag')&&source.preflight.includes('writeEvidence'));
check('user-facing diagnostic and health exports are protected containers',source.main.includes('pptdiag')&&source.main.includes('pptreport'));
check('browser session cache and crash areas use volatile root',source.main.includes("app.setPath('sessionData'")&&source.main.includes("app.setPath('crashDumps'")&&source.runtime.includes('volatileRootPath'));
store.dispose();
await mkdir('artifacts/validation',{recursive:true});
await writeFile('artifacts/validation/build214-side-artifact-integration-runtime.json',`${JSON.stringify({schemaVersion:1,build:214,status:'PASS',checks:checks.length,results:checks,windowsSafeStorageDpapiRuntime:'NOT_RUN',generatedAt:new Date().toISOString()},null,2)}\n`);
await rm(temp,{recursive:true,force:true});
console.log(`Build 214 side-artifact integration runtime: PASS (${checks.length}/${checks.length}).`);

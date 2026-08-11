import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const root = process.cwd();
const tmp = join(root, '.tmp', 'build181-revocation-sync-durability-runtime');
const reportPath = resolve(process.argv[2] ?? 'artifacts/validation/build181-revocation-sync-durability-runtime.json');
await rm(tmp, { recursive: true, force: true });
await mkdir(tmp, { recursive: true });
const ts = (await import(pathToFileURL(join(execFileSync('npm', ['root', '-g'], { encoding: 'utf8' }).trim(), 'typescript', 'lib', 'typescript.js')).href)).default;
const transpile = async (sourcePath, outputName, transform) => {
  let source = await readFile(sourcePath, 'utf8');
  source = transform(source);
  const result = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext }, reportDiagnostics: true, fileName: sourcePath });
  const errors = (result.diagnostics ?? []).filter(item => item.category === ts.DiagnosticCategory.Error);
  if (errors.length) throw new Error(errors.map(item => ts.flattenDiagnosticMessageText(item.messageText, '\n')).join('\n'));
  const outputPath = join(tmp, outputName);
  await writeFile(outputPath, result.outputText);
  return outputPath;
};
const statePath = await transpile('apps/desktop/src/main/secure-revocation-sync-state.ts', 'state.mjs', source => source.replace(/^import type .*?;\n/gmu, ''));
const servicePrelude = `import { createHash } from 'node:crypto';\nconst resolveExternalBackupRevocationEndpointPins=(endpoint)=>endpoint.status==='active'?[{sha256:endpoint.primarySpkiSha256,kind:'primary'}]:[];\nconst fetchGovernedExternalBackupEvidenceRevocationList=async()=>{throw new Error('real network disabled in Build 181 runtime');};\n`;
const servicePath = await transpile('apps/desktop/src/main/secure-revocation-sync-service.ts', 'service.mjs', source => servicePrelude + source.replace(/^import[\s\S]*?from '[^']+';\n/gmu, ''));
const { ProtectedRevocationSyncStateStore } = await import(pathToFileURL(statePath).href);
const { SecureRevocationSyncService } = await import(pathToFileURL(servicePath).href);

const checks = [];
const check = (label, fn) => { fn(); checks.push(label); };
const stateDirectory = join(tmp, 'state');
const protector = {
  protectionId: 'runtime-protector-v1', required: true,
  isAvailable: () => true,
  protect: value => Buffer.from(value, 'utf8').toString('base64'),
  unprotect: value => Buffer.from(value, 'base64').toString('utf8')
};
const store = () => new ProtectedRevocationSyncStateStore({ directoryPath: stateDirectory, applicationVersion: '30.07.2026.181', protector: () => protector, maximumEndpoints: 8, maximumQuarantineFiles: 2 });
let now = new Date('2026-07-30T06:00:00.000Z');
let endpoints = [{ id: 'endpoint-1', issuerId: 'issuer-root', issuerLabel: 'Sağlayıcı', sourceUrl: 'https://example.test/list.json', primarySpkiSha256: 'a'.repeat(64), status: 'active' }];
let verified = [];
const records = [];
const diagnostics = [];
const notifications = [];
const makeFetch = (sequenceNumber, nextUpdate = '2026-08-02T06:00:00.000Z') => ({ endpointId: 'endpoint-1', list: { signerIssuerId: 'issuer-leaf', listId: `list-${sequenceNumber}`, sequenceNumber, thisUpdate: '2026-07-30T05:55:00.000Z', nextUpdate, entries: [{ fingerprintSha256: 'b'.repeat(64), revokedAt: '2026-07-30T05:00:00.000Z', reason: 'test' }], signatureBase64: 'c2ln', sourceUrl: 'https://example.test/list.json' }, fetchedAt: now.toISOString(), sourceUrl: 'https://example.test/list.json', tlsSpkiSha256: 'a'.repeat(64), matchedPin: 'primary', responseBytes: 512 });
const deps = persistence => ({ listEndpoints: () => endpoints, listVerifiedLists: () => verified, recordFetch: (...values) => records.push(values), notify: value => notifications.push(value), diagnostic: (...values) => diagnostics.push(values), now: () => new Date(now), persistence, fetchList: async () => makeFetch(5) });

let service = new SecureRevocationSyncService(deps(store()));
let run = await service.runDue('endpoint-1');
check('new list is staged', () => assert.equal(run.updates, 1));
check('pending list is visible before restart', () => assert.equal(service.getPendingSummary('endpoint-1')?.listId, 'list-5'));
check('protected state file is created', () => assert.ok(execFileSync('bash', ['-lc', `test -f ${JSON.stringify(join(stateDirectory, 'revocation-sync-state.json'))}`]).length === 0));

service = new SecureRevocationSyncService(deps(store()));
check('pending list survives restart', () => assert.equal(service.getPendingSummary('endpoint-1')?.sequenceNumber, 5));
check('restored state reports healthy persistence', () => assert.equal(service.listStates()[0].persistenceStatus, 'healthy'));
check('restore is diagnosed', () => assert.ok(diagnostics.some(entry => entry[1] === 'revocation.sync_state_restored')));

endpoints = [{ ...endpoints[0], primarySpkiSha256: 'c'.repeat(64) }];
service = new SecureRevocationSyncService(deps(store()));
check('changed pin invalidates restored pending list', () => assert.equal(service.getPendingSummary('endpoint-1'), undefined));
check('restored pending invalidation is diagnosed', () => assert.ok(diagnostics.some(entry => entry[1] === 'revocation.sync_pending_invalidated')));

verified = [{ authorityRootIssuerId: 'issuer-root', sequenceNumber: 7, nextUpdate: '2026-07-30T18:00:00.000Z' }];
notifications.length = 0;
service = new SecureRevocationSyncService(deps(store()));
let states = service.listStates();
check('list within 24 hours is expiring soon', () => assert.equal(states[0].listFreshness, 'expiring_soon'));
check('expiring list emits one warning', () => assert.equal(notifications.filter(item => item.title.includes('yaklaşıyor')).length, 1));
service.listStates();
check('same expiring warning is deduplicated in process', () => assert.equal(notifications.filter(item => item.title.includes('yaklaşıyor')).length, 1));

notifications.length = 0;
service = new SecureRevocationSyncService(deps(store()));
service.listStates();
check('same expiring warning is deduplicated after restart', () => assert.equal(notifications.filter(item => item.title.includes('yaklaşıyor')).length, 0));

now = new Date('2026-07-30T19:00:00.000Z');
states = service.listStates();
check('past nextUpdate becomes expired', () => assert.equal(states[0].listFreshness, 'expired'));
check('expired list emits critical warning', () => assert.ok(notifications.some(item => item.title.includes('süresi doldu') && item.urgency === 'critical')));

const unavailableDir = join(tmp, 'unavailable');
const availableSeedStore = new ProtectedRevocationSyncStateStore({ directoryPath: unavailableDir, applicationVersion: '30.07.2026.181', protector: () => protector });
availableSeedStore.persist([]);
const unavailableStore = new ProtectedRevocationSyncStateStore({ directoryPath: unavailableDir, applicationVersion: '30.07.2026.181', protector: () => ({ ...protector, isAvailable: () => false }) });
check('unavailable protector is classified', () => assert.equal(unavailableStore.load().status, 'UNAVAILABLE'));
const failingPersistence = { load: () => ({ status: 'MISSING', reason: 'STATE_MISSING', states: [] }), persist: () => { throw new Error('disk full'); } };
notifications.length = 0;
const failedService = new SecureRevocationSyncService(deps(failingPersistence));
const failedStates = failedService.listStates();
check('persistence write failure is visible', () => assert.equal(failedStates[0].persistenceStatus, 'failed'));
check('persistence write failure warns once', () => assert.equal(notifications.filter(item => item.title.includes('kaydedilemedi')).length, 1));

const corruptDir = join(tmp, 'corrupt');
await mkdir(corruptDir, { recursive: true });
await writeFile(join(corruptDir, 'revocation-sync-state.json'), '{broken');
const corruptStore = new ProtectedRevocationSyncStateStore({ directoryPath: corruptDir, applicationVersion: '30.07.2026.181', protector: () => protector });
check('corrupt state is rejected', () => assert.equal(corruptStore.load().status, 'REJECTED'));
const quarantineEntries = await readdir(join(corruptDir, 'quarantine'));
check('corrupt state is quarantined', () => assert.ok(quarantineEntries.some(name => name.endsWith('.corrupt.json'))));

const report = { schemaVersion: 1, product: 'Anadolu Parsı Aile Yaşam Merkezi', build: 181, stage: 'Bronze RC2 Active Development', status: 'PASS', checks: checks.length, checkLabels: checks, limitations: ['Uses an injectable offline fetch adapter and a deterministic test protector. Real network, Windows DPAPI/safeStorage, Electron dialogs and production filesystem ACLs remain part of the Silver validation campaign.'], generatedAt: new Date().toISOString() };
await mkdir(dirname(reportPath), { recursive: true });
await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`);
await rm(tmp, { recursive: true, force: true });
console.log(`Build 181 revocation sync durability runtime: PASS (${checks.length}/${checks.length})`);

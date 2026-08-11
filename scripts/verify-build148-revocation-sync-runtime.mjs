import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const root = process.cwd();
const tmp = join(root, '.tmp', 'build148-revocation-sync-runtime');
const args = process.argv.slice(2);
const option = (name, fallback) => { const index = args.indexOf(name); if (index < 0) return fallback; const value = args[index + 1]; if (!value || value.startsWith('--')) throw new Error(`${name} requires a value.`); return value; };
const reportPath = resolve(option('--report', 'artifacts/validation/build148-revocation-sync-runtime.json'));
await rm(tmp, { recursive: true, force: true });
await mkdir(tmp, { recursive: true });
const ts = (await import(pathToFileURL(join(execFileSync('npm', ['root', '-g'], { encoding: 'utf8' }).trim(), 'typescript', 'lib', 'typescript.js')).href)).default;
let source = await readFile('apps/desktop/src/main/secure-revocation-sync-service.ts', 'utf8');
source = source.replace(/^import[\s\S]*?from '[^']+';\n/gmu, '');
const prelude = `import { createHash } from 'node:crypto';
type ExternalBackupEvidenceRevocationListView=any;type ExternalBackupRevocationEndpointView=any;type FetchedExternalBackupEvidenceRevocationListView=any;type PendingRevocationSyncListView=any;type RevocationSyncEndpointStateView=any;type RevocationSyncRunResultView=any;
const resolveExternalBackupRevocationEndpointPins=(endpoint)=>endpoint.status==='active'?[endpoint.primarySpkiSha256]:[];
const fetchGovernedExternalBackupEvidenceRevocationList=async()=>{if(globalThis.__fetchError)throw globalThis.__fetchError;return structuredClone(globalThis.__nextFetch);};
`;
const output = ts.transpileModule(prelude + source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext }, reportDiagnostics: true });
const errors = (output.diagnostics ?? []).filter((item) => item.category === ts.DiagnosticCategory.Error);
if (errors.length) throw new Error(errors.map((item) => ts.flattenDiagnosticMessageText(item.messageText, '\n')).join('\n'));
const modulePath = join(tmp, 'service.mjs');
await writeFile(modulePath, output.outputText);
const { SecureRevocationSyncService } = await import(pathToFileURL(modulePath).href);

let now = new Date('2026-07-29T10:00:00.000Z');
let endpoints = [{ id: 'endpoint-1', issuerId: 'issuer-root', issuerLabel: 'Sağlayıcı', sourceUrl: 'https://example.test/list.json', primarySpkiSha256: 'a'.repeat(64), status: 'active' }];
let verified = [];
const fetchRecords = [];
const diagnostics = [];
const notifications = [];
const deps = {
  listEndpoints: () => endpoints,
  listVerifiedLists: () => verified,
  recordFetch: (...values) => fetchRecords.push(values),
  notify: (value) => notifications.push(value),
  diagnostic: (...values) => diagnostics.push(values),
  now: () => new Date(now)
};
const service = new SecureRevocationSyncService(deps);
const makeFetch = (sequenceNumber, listId = `list-${sequenceNumber}`) => ({
  endpointId: 'endpoint-1',
  list: { signerIssuerId: 'issuer-leaf', listId, sequenceNumber, thisUpdate: '2026-07-29T09:55:00.000Z', nextUpdate: '2026-07-30T10:00:00.000Z', entries: [{ fingerprintSha256: 'b'.repeat(64), revokedAt: '2026-07-29T09:00:00.000Z', reason: 'test' }], signatureBase64: 'c2ln', sourceUrl: 'https://example.test/list.json' },
  fetchedAt: '2026-07-29T10:00:00.000Z', sourceUrl: 'https://example.test/list.json', tlsSpkiSha256: 'a'.repeat(64), matchedPin: 'primary', responseBytes: 512
});
const checks = [];
const check = (label, fn) => { fn(); checks.push(label); };

globalThis.__nextFetch = makeFetch(5);
let run = await service.runDue('endpoint-1');
check('new secure list is staged', () => assert.equal(run.updates, 1));
const summary = service.getPendingSummary('endpoint-1');
check('pending summary is available', () => assert.equal(summary?.listId, 'list-5'));
check('pending summary omits signed list body', () => assert.equal(Object.hasOwn(summary ?? {}, 'list'), false));
check('pending summary exposes only entry count', () => assert.equal(summary?.entryCount, 1));
const pending = service.getPendingForApply('endpoint-1', 'list-5');
check('main-owned pending payload remains available internally', () => assert.equal(pending.list.signatureBase64, 'c2ln'));
assert.throws(() => service.getPendingForApply('endpoint-1', 'wrong-list'), /bulunamadı|değişti/);
checks.push('wrong pending identity rejected');

endpoints = [{ ...endpoints[0], primarySpkiSha256: 'd'.repeat(64) }];
check('endpoint pin change invalidates pending payload', () => assert.equal(service.getPendingSummary('endpoint-1'), undefined));
check('profile invalidation is diagnosed', () => assert.ok(diagnostics.some((entry) => entry[1] === 'revocation.sync_pending_invalidated')));

now = new Date('2026-07-29T10:20:00.000Z');
globalThis.__nextFetch = { ...makeFetch(6, 'list-6'), tlsSpkiSha256: 'd'.repeat(64) };
run = await service.runDue('endpoint-1');
check('list is restaged under new endpoint fingerprint', () => assert.equal(run.updates, 1));
service.markApplied('endpoint-1', 'list-6', 6);
check('successful main-owned apply clears pending summary', () => assert.equal(service.getPendingSummary('endpoint-1'), undefined));
check('successful apply moves state to current', () => assert.equal(service.listStates()[0].status, 'current'));
assert.throws(() => service.markApplied('endpoint-1', 'list-6', 6), /eşleşmiyor/);
checks.push('duplicate pending completion rejected');

now = new Date('2026-07-29T10:40:00.000Z');
verified = [{ authorityRootIssuerId: 'issuer-root', sequenceNumber: 9 }];
globalThis.__nextFetch = { ...makeFetch(9, 'list-9'), tlsSpkiSha256: 'd'.repeat(64) };
run = await service.runDue('endpoint-1');
check('rollback sequence is treated as current without staging', () => assert.equal(run.updates, 0));
check('rollback sequence leaves no pending summary', () => assert.equal(service.getPendingSummary('endpoint-1'), undefined));

now = new Date('2026-07-29T11:00:00.000Z');
globalThis.__fetchError = new Error('network unavailable');
run = await service.runDue('endpoint-1');
check('fetch failure is counted', () => assert.equal(run.failed, 1));
check('fetch failure enters bounded backoff', () => assert.equal(service.listStates()[0].status, 'backoff'));
check('first failure emits user notification', () => assert.ok(notifications.some((entry) => entry.title.includes('uyarısı'))));
delete globalThis.__fetchError;

const report = { schemaVersion: 1, product: 'Anadolu Parsı Aile Yaşam Merkezi', featureBuild: 148, stage: 'Bronze RC2 Active Development', status: 'PASS', checks: checks.length, checkLabels: checks, limitations: ['Uses a stubbed secure fetch function and in-memory endpoint/list providers. Real TLS, certificate chains, network timing, Electron dialogs and persistent SQLite are outside this targeted runtime check.'], generatedAt: new Date().toISOString() };
await mkdir(dirname(reportPath), { recursive: true });
await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`);
await rm(tmp, { recursive: true, force: true });
console.log(`Build 148 revocation sync runtime: PASS (${checks.length}/${checks.length}).`);

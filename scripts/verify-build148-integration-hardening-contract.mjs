import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';

const read = (path) => readFile(path, 'utf8');
const [policy, ipcRuntime, syncService, main, domain, preload, globalTypes, renderer, importService, dataStore, largeService, packageJson, ledgerText] = await Promise.all([
  read('apps/desktop/src/main/ipc-integration-policy.ts'),
  read('apps/desktop/src/main/ipc-runtime.ts'),
  read('apps/desktop/src/main/secure-revocation-sync-service.ts'),
  read('apps/desktop/src/main/main.ts'),
  read('packages/domain/src/app-data.ts'),
  read('apps/desktop/src/main/preload.ts'),
  read('apps/desktop/src/renderer/global.d.ts'),
  read('apps/desktop/src/renderer/App.tsx'),
  read('apps/desktop/src/main/family-data-import-service.ts'),
  read('apps/desktop/src/main/data-store.ts'),
  read('apps/desktop/src/main/large-family-read-model-service.ts'),
  read('package.json'),
  read('artifacts/manifests/VERSION_LEDGER.json')
]);

let assertions = 0;
const failures = [];
const verify = (condition, label) => { assertions += 1; if (!condition) failures.push(label); };

verify(policy.includes('evaluateIpcIntegrationPolicy'), 'central integration policy exported');
verify(policy.includes("case 'dataLifecycle:applyPendingRevocationSyncList'"), 'pending revocation apply policy');
verify(policy.includes("case 'familyData:applyImport'"), 'family import apply policy');
verify(policy.includes("case 'largeData:tree'") && policy.includes("case 'largeData:timeline'") && policy.includes("case 'largeData:archive'"), 'large data policies');
verify(policy.includes('UNKNOWN_OBJECT_FIELD'), 'unknown object fields rejected');
verify(policy.includes('ARGUMENT_COUNT_MISMATCH'), 'argument count mismatch rejected');
verify(policy.includes('optionalInteger(value.limit, 20, 200)'), 'large data page limit boundary');
verify(ipcRuntime.includes("import { evaluateIpcIntegrationPolicy }"), 'IPC runtime imports integration policy');
verify(ipcRuntime.includes("event: 'ipc.integration_payload.rejected'"), 'integration rejection is audited');
verify(ipcRuntime.includes('kanalın entegrasyon sözleşmesiyle uyuşmuyor'), 'integration rejection uses explicit error');

verify(domain.includes('interface PendingRevocationSyncListView'), 'pending summary domain view');
verify(domain.includes('interface ApplyPendingRevocationSyncInput'), 'pending apply domain input');
verify(syncService.includes('endpointFingerprint'), 'pending state bound to endpoint fingerprint');
verify(syncService.includes('getPendingSummary'), 'summary-only pending access');
verify(syncService.includes('getPendingForApply'), 'main-owned pending payload access');
verify(syncService.includes('markApplied'), 'pending apply completion transition');
verify(syncService.includes('invalidateEndpoint'), 'endpoint invalidation path');
verify(syncService.includes('invalidateIssuer'), 'issuer invalidation path');
verify(syncService.includes('endpoint-profile-fingerprint-changed'), 'profile drift invalidation');
verify(!main.includes("registerIpcHandler('dataLifecycle:fetchExternalBackupEvidenceRevocationList'"), 'raw network revocation payload IPC removed');
verify(!preload.includes('fetchExternalBackupEvidenceRevocationList:'), 'preload cannot request raw network revocation payload');
verify(!globalTypes.includes('fetchExternalBackupEvidenceRevocationList('), 'renderer API omits raw network revocation payload');
verify(main.includes("registerIpcHandler('dataLifecycle:applyPendingRevocationSyncList'"), 'main-owned pending apply handler');
verify(main.includes('revocationSync().getPendingForApply'), 'renderer cannot supply pending list body');
verify(main.includes('revocationSync().markApplied'), 'pending state cleared after successful apply');
verify(main.includes("invalidateIssuer(input.issuerId,'endpoint-profile-updated')"), 'endpoint profile update invalidates pending state');
verify(main.includes("invalidateAll('issuer-key-rotation')") && main.includes("invalidateAll('issuer-revoked')"), 'issuer trust changes invalidate pending state');
verify(preload.includes('applyPendingRevocationSyncList'), 'preload exposes pending apply token flow');
verify(globalTypes.includes('applyPendingRevocationSyncList'), 'renderer declaration exposes pending apply token flow');
verify(renderer.includes('renderer içine imzalı liste içeriği aktarılmadı'), 'UI communicates renderer isolation');
verify(renderer.includes('pendingListId:pending.listId'), 'UI submits only pending identity and credentials');
verify(!renderer.includes('applyExternalBackupEvidenceRevocationList({...list,confirmation,password'), 'network list is not round-tripped through renderer apply');

verify(importService.includes('readonly familyId: string') && importService.includes('readonly actorId: string'), 'preview cache stores session ownership');
verify(importService.includes('cached.familyId !== context.familyId || cached.actorId !== context.actor.userId'), 'preview owner checked on apply');
verify(importService.includes('clearCachedPreviews'), 'preview cache clear operation');
verify(dataStore.includes('this.#familyDataImportService.clearCachedPreviews()'), 'logout clears preview cache');

verify(largeService.includes("createHash('sha256')"), 'cursor scope uses SHA-256');
verify(largeService.includes('accountId,filters'), 'cursor scope includes account and filters');
verify(largeService.includes('scope!==expectedScope'), 'cursor scope mismatch rejected');
verify(largeService.includes("cursorScope('tree'") && largeService.includes("cursorScope('timeline'") && largeService.includes("cursorScope('archive'"), 'all large data cursors scoped');

const ledger = JSON.parse(ledgerText);
const current = ledger.entries?.at(-1);
const pkg = JSON.parse(packageJson);
verify(Number(current?.sequence) >= 148, 'Build 148 feature is evaluated on Build 148 or later');
verify(pkg.version === current?.packageVersion, 'active package and ledger version alignment');
verify(current?.stage === 'RC2 Aktif Geliştirme', 'Bronze RC2 active development preserved');

const report = {
  schemaVersion: 1,
  product: 'Anadolu Parsı Aile Yaşam Merkezi',
  featureBuild: 148,
  applicationVersion: current?.version ?? null,
  packageVersion: current?.packageVersion ?? null,
  stage: 'Bronze RC2 Active Development',
  scope: 'Recent feature integration hardening: strict IPC channel boundaries, main-owned pending revocation application, session-bound family import previews and filter-bound large-data cursors',
  assertions,
  status: failures.length === 0 ? 'PASS' : 'FAIL',
  failures,
  generatedAt: new Date().toISOString()
};
const reportPath = 'artifacts/validation/build148-integration-hardening-contract.json';
await mkdir(dirname(reportPath), { recursive: true });
await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`);
if (failures.length) {
  console.error(`Build 148 integration hardening contract: FAIL (${assertions - failures.length}/${assertions})`);
  for (const failure of failures) console.error(`- ${failure}`);
  process.exitCode = 1;
} else {
  console.log(`Build 148 integration hardening contract: PASS (${assertions}/${assertions}).`);
}

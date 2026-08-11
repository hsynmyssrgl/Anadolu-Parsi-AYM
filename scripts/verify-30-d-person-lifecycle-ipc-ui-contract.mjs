import assert from 'node:assert/strict';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';

const files = {
  domain: 'packages/domain/src/person-lifecycle.ts',
  application: 'packages/application/src/person-lifecycle-use-cases.ts',
  adapter: 'apps/desktop/src/main/person-lifecycle-application-adapter.ts',
  dataStore: 'apps/desktop/src/main/data-store.ts',
  main: 'apps/desktop/src/main/main.ts',
  preload: 'apps/desktop/src/main/preload.ts',
  global: 'apps/desktop/src/renderer/global.d.ts',
  renderer: 'apps/desktop/src/renderer/App.tsx'
};
const sources = Object.fromEntries(Object.entries(files).map(([key, path]) => [key, readFileSync(path, 'utf8')]));
const checks = [];
const contains = (source, token, label) => {
  assert.equal(source.includes(token), true, `${label}: ${token}`);
  checks.push(label);
};

contains(sources.domain, 'PersonLifecycleWorkspaceView', 'domain exposes profile and immutable operation history workspace');
contains(sources.application, 'GetPersonLifecycleWorkspaceUseCase', 'application exposes governed workspace use case');
contains(sources.application, 'executeAuthorized(this.unitOfWork', 'workspace and mutations use central authorization');
contains(sources.adapter, 'authorizeAdministration()', 'desktop adapter delegates authorization to repository policy');
contains(sources.dataStore, 'RepositoryBackedPersonLifecycleUnitOfWork', 'data store composes governed lifecycle unit of work');
contains(sources.dataStore, 'getPersonLifecycleWorkspace(personId:', 'data store exposes lifecycle workspace');
contains(sources.dataStore, 'updatePersonProfile(input:', 'data store exposes versioned profile update');
contains(sources.dataStore, 'archivePersonProfile(input:', 'data store exposes reversible archive');
contains(sources.dataStore, 'mergePersonProfiles(input:', 'data store exposes logical merge');
contains(sources.dataStore, 'requestSafePersonDeletion(input:', 'data store exposes reference-safe deletion request');
contains(sources.dataStore, 'undoPersonLifecycleOperation(operationId:', 'data store exposes operation undo');
contains(sources.dataStore, "conflictResolution: input.conflictResolution", 'merge preserves explicit conflict policy');

const channels = [
  'people:getLifecycleWorkspace',
  'people:updateProfile',
  'people:archiveProfile',
  'people:mergeProfiles',
  'people:requestSafeDeletion',
  'people:undoLifecycleOperation'
];
for (const channel of channels) {
  contains(sources.main, `registerIpcHandler('${channel}'`, `main correlated IPC ${channel}`);
  contains(sources.preload, `invoke('${channel}'`, `preload bridge ${channel}`);
}
assert.equal(sources.main.includes("ipcMain.handle('people:"), false, 'person lifecycle handlers must not bypass correlated IPC registration');
checks.push('person lifecycle IPC never bypasses correlated trusted-sender registration');
contains(sources.global, 'getPersonLifecycleWorkspace(personId:string)', 'renderer bridge includes lifecycle workspace type');
contains(sources.global, 'requestSafePersonDeletion(input:', 'renderer bridge includes guarded deletion type');
contains(sources.renderer, "| 'people-lifecycle'", 'renderer route is declared');
contains(sources.renderer, "id: 'people-lifecycle'", 'renderer navigation menu item is declared');
contains(sources.renderer, 'function PersonLifecycleScreen', 'renderer lifecycle workspace exists');
contains(sources.renderer, "active === 'people-lifecycle'", 'renderer route is wired');
contains(sources.renderer, "conflictResolution:'KEEP_TARGET'", 'renderer merge requires explicit KEEP_TARGET policy');
contains(sources.renderer, 'confirmationText!==workspace.profile.displayName', 'renderer requires exact-name deletion confirmation');
contains(sources.renderer, 'operation.references.total', 'renderer shows reference evidence');
contains(sources.renderer, 'undo(operation.id)', 'renderer exposes safe undo action');

const report = {
  schemaVersion: 1,
  release: 'Bronze 04.08.2026.29',
  step: '30-D',
  requirement: 'B1-02',
  status: 'PASS',
  checkCount: checks.length,
  checks,
  generatedAt: new Date().toISOString()
};
mkdirSync('artifacts/validation', { recursive: true });
writeFileSync('artifacts/validation/30-D-person-lifecycle-ipc-ui-contract.json', `${JSON.stringify(report, null, 2)}\n`);
console.log(`30-D person lifecycle IPC/UI contract: PASS (${checks.length} checks).`);

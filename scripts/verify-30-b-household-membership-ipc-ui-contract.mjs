import assert from 'node:assert/strict';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';

const sources = Object.fromEntries([
  'domain',
  'repository',
  'application',
  'adapter',
  'dataStore',
  'main',
  'preload',
  'global',
  'renderer'
].map((key, index) => [key, readFileSync([
  'packages/domain/src/household-membership.ts',
  'packages/repositories/src/household-membership-repository.ts',
  'packages/application/src/household-membership-use-cases.ts',
  'apps/desktop/src/main/household-membership-application-adapter.ts',
  'apps/desktop/src/main/data-store.ts',
  'apps/desktop/src/main/main.ts',
  'apps/desktop/src/main/preload.ts',
  'apps/desktop/src/renderer/global.d.ts',
  'apps/desktop/src/renderer/App.tsx'
][index], 'utf8')]));

const checks = [];
const contains = (source, token, label) => {
  assert.equal(source.includes(token), true, `${label}: ${token}`);
  checks.push(label);
};

contains(sources.domain, 'HouseholdMembershipWorkspaceView', 'domain workspace view');
contains(sources.repository, 'listMembershipsByFamily', 'family-scoped membership query');
contains(sources.repository, 'INNER JOIN households AS household', 'family filter uses household ownership');
contains(sources.application, 'GetHouseholdMembershipWorkspaceUseCase', 'workspace use case');
contains(sources.application, 'executeAuthorized(this.unitOfWork', 'workspace query is centrally authorized');
contains(sources.adapter, 'listMembershipsByFamily', 'desktop unit-of-work exposes governed query');
contains(sources.dataStore, 'RepositoryBackedHouseholdMembershipUnitOfWork', 'data store composition');
contains(sources.dataStore, 'getHouseholdMembershipWorkspace()', 'data store workspace method');
contains(sources.dataStore, 'createHousehold(input:', 'data store household mutation');
contains(sources.dataStore, 'createFamilyBranch(input:', 'data store branch mutation');
contains(sources.dataStore, 'assignPersonMembership(input:', 'data store membership mutation');
contains(sources.dataStore, 'endPersonMembership(membershipId:', 'data store historical end mutation');

for (const channel of [
  'households:getWorkspace',
  'households:create',
  'households:createBranch',
  'households:assignPerson',
  'households:endMembership'
]) {
  contains(sources.main, `registerIpcHandler('${channel}'`, `main IPC ${channel}`);
  contains(sources.preload, `invoke('${channel}'`, `preload IPC ${channel}`);
}
contains(sources.global, 'getHouseholdMembershipWorkspace()', 'renderer bridge typing');
contains(sources.renderer, "| 'households'", 'renderer route');
contains(sources.renderer, "id: 'households'", 'renderer menu item');
contains(sources.renderer, 'function HouseholdMembershipScreen', 'renderer screen');
contains(sources.renderer, "active === 'households'", 'renderer screen routing');
contains(sources.renderer, 'assignPersonMembership(command)', 'renderer assignment action');
contains(sources.renderer, 'endPersonMembership({membershipId,endedAt:', 'renderer historical end action');

assert.equal(sources.main.includes("ipcMain.handle('households:"), false, 'household handlers must use correlated registration');
checks.push('household IPC uses correlated trusted-sender wrapper');

const report = {
  schemaVersion: 1,
  release: 'Bronze 04.08.2026.29',
  step: '30-B',
  requirement: 'B1-01',
  status: 'PASS',
  checkCount: checks.length,
  checks,
  generatedAt: new Date().toISOString()
};
mkdirSync('artifacts/validation', { recursive: true });
writeFileSync('artifacts/validation/30-B-household-membership-ipc-ui-contract.json', `${JSON.stringify(report, null, 2)}\n`);
console.log(`30-B household membership IPC/UI contract: PASS (${checks.length} checks).`);

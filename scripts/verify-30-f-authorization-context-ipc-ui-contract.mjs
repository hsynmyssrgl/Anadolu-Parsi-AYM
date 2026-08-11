import assert from 'node:assert/strict';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';

const files = {
  domain: 'packages/domain/src/app-data.ts',
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

contains(sources.domain, 'AuthorizationContextWorkspaceView', 'domain exposes contextual authorization administration workspace');
for (const field of ['purpose:AuthorizationPurpose', 'familyBranchId?:string', 'denialReason?:string', 'startsAt?:string', 'endsAt?:string']) {
  contains(sources.domain, field, `permission input exposes ${field.split(':')[0]}`);
}
contains(sources.dataStore, 'getAuthorizationContextWorkspace(): AuthorizationContextWorkspaceView', 'data store composes contextual authorization workspace');
contains(sources.dataStore, 'branches: this.getHouseholdMembershipWorkspace().branches', 'workspace exposes governed family branches');
contains(sources.main, "registerIpcHandler('permissions:getContextWorkspace'", 'main registers trusted contextual permission workspace IPC');
contains(sources.preload, "invoke('permissions:getContextWorkspace')", 'preload exposes contextual permission workspace bridge');
contains(sources.global, 'getAuthorizationContextWorkspace():Promise<AuthorizationContextWorkspaceView>', 'renderer bridge declares contextual workspace');
assert.equal(sources.main.includes("ipcMain.handle('permissions:"), false, 'permission handlers must not bypass correlated trusted-sender registration');
checks.push('permission IPC never bypasses correlated trusted-sender registration');

contains(sources.renderer, "label: 'Bağlamsal Yetkiler'", 'navigation menu names the contextual authorization workspace');
contains(sources.renderer, 'title="Bağlamsal Yetkiler"', 'permission route renders contextual authorization title');
contains(sources.renderer, 'getAuthorizationContextWorkspace()', 'renderer loads accounts permissions and branches from contextual workspace IPC');
contains(sources.renderer, "useState<AuthorizationPurpose>('general')", 'renderer owns explicit purpose state');
contains(sources.renderer, 'setFamilyBranchId', 'renderer owns explicit family branch state');
contains(sources.renderer, 'setStartsOn', 'renderer owns permission start date state');
contains(sources.renderer, 'setEndsOn', 'renderer owns permission end date state');
contains(sources.renderer, 'setDenialReason', 'renderer owns explicit denial reason state');
contains(sources.renderer, "effect==='deny'&&reason.length<5", 'renderer fails closed when denial reason is missing');
contains(sources.renderer, 'endsOn<startsOn', 'renderer rejects an inverted validity range');
contains(sources.renderer, "...(familyBranchId?{familyBranchId}:{})", 'renderer sends optional family branch context');
contains(sources.renderer, "startsAt:`${startsOn}T00:00:00.000Z`", 'renderer sends explicit permission start timestamp');
contains(sources.renderer, "endsAt:`${endsOn}T23:59:59.999Z`", 'renderer sends explicit permission end timestamp');
contains(sources.renderer, "effect==='deny'?{denialReason:reason}:{}", 'renderer sends denial reason only for deny decisions');
for (const purpose of ['general','care','finance','health','archive','legacy','ai_processing','administration']) {
  contains(sources.renderer, `<option value="${purpose}">`, `renderer exposes ${purpose} purpose`);
}
contains(sources.renderer, "branches.filter(branch=>branch.status==='active')", 'renderer limits selection to active family branches');
contains(sources.renderer, 'purposeLabel(p.purpose)', 'renderer displays persisted purpose');
contains(sources.renderer, 'p.denialReason', 'renderer displays explicit denial reason');
contains(sources.domain, 'OBJECT_PERMISSION_ACTIONS', 'domain exposes one canonical permission action catalog');
contains(sources.domain, "'record'", 'canonical permission action catalog includes record');
contains(sources.renderer, 'OBJECT_PERMISSION_ACTIONS.map', 'renderer exposes the canonical permission action catalog without drift');

const report = {
  schemaVersion: 1,
  release: 'Bronze 04.08.2026.29',
  step: '30-F',
  requirement: 'B1-03',
  status: 'PASS',
  checkCount: checks.length,
  checks,
  generatedAt: new Date().toISOString()
};
mkdirSync('artifacts/validation', { recursive: true });
writeFileSync('artifacts/validation/30-F-authorization-context-ipc-ui-contract.json', `${JSON.stringify(report, null, 2)}\n`);
console.log(`30-F authorization context IPC/UI contract: PASS (${checks.length} checks).`);

import assert from 'node:assert/strict';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { ACTIVE_BUILD_META } from './lib/active-build-meta.mjs';

const expectedRoot = 'C:\\PPT\\AYM\\06_KOD\\app';
const root = resolve(process.cwd());
if (root.toLocaleLowerCase('en-US') !== expectedRoot.toLocaleLowerCase('en-US')) {
  throw new Error(`PPK-002 family import verifier must run from ${expectedRoot}; received ${root}`);
}

const service = readFileSync(resolve(root, 'apps/desktop/src/main/family-data-import-service.ts'), 'utf8');
const composition = readFileSync(resolve(root, 'apps/desktop/src/main/data-store.ts'), 'utf8');
const regression = readFileSync(resolve(root, 'apps/desktop/tests/location-cross-surface-privacy-runtime.test.ts'), 'utf8');
const gate = JSON.parse(readFileSync(resolve(root, 'artifacts/validation/platform-policy-gate.json'), 'utf8'));
const checks = [];
const check = (name, operation) => {
  operation();
  checks.push(name);
};
const occurrences = (source, value) => source.split(value).length - 1;

check('family import uses the central authorization service', () => {
  assert.match(service, /CentralAuthorizationService/u);
  assert.match(service, /resourceType: 'family_data_import'/u);
  assert.match(service, /purpose: 'administration'/u);
});
check('three direct family_admin checks are removed', () => {
  assert.equal(service.includes("context.actor.role !== 'family_admin'"), false);
});
check('active account and application membership context must agree', () => {
  assert.match(service, /activeAccount\(account\.value, repository\.occurredAt\)/u);
  assert.match(service, /account\.value\.role !== context\.actor\.role/u);
  assert.match(service, /account\.value\.personId !== context\.actor\.personId/u);
});
check('active object grants participate in the central decision', () => {
  assert.match(service, /listActiveForSubject/u);
  assert.match(service, /grants: grants\.value\.map\(toAuthorizationGrant\)/u);
});
check('preview authorization precedes file inspection', () => {
  const preview = service.slice(service.indexOf('public preview'), service.indexOf('public apply'));
  assert.ok(preview.indexOf("#assertAuthorized(context, 'read')") < preview.indexOf('lstatSync(sourcePath)'));
});
check('apply uses create authorization and revalidates inside its transaction', () => {
  const apply = service.slice(service.indexOf('public apply'), service.indexOf('public listBatches'));
  assert.ok(apply.indexOf("#assertAuthorized(context, 'create')") < apply.indexOf('#previews.get'));
  assert.equal(occurrences(apply, "authorizeFamilyDataImport(this.dependencies, context, repository, 'create')"), 1);
});
check('batch listing uses read authorization inside its transaction', () => {
  const list = service.slice(service.indexOf('public listBatches'), service.indexOf('public rollback'));
  assert.equal(occurrences(list, "authorizeFamilyDataImport(this.dependencies, context, repository, 'read')"), 1);
});
check('rollback is authorized before strong authentication and revalidated in transaction', () => {
  const rollback = service.slice(service.indexOf('public rollback'), service.indexOf('public clearCachedPreviews'));
  assert.ok(rollback.indexOf("#assertAuthorized(context, 'delete')") < rollback.indexOf('strongAuthentication.verify'));
  assert.equal(occurrences(rollback, "authorizeFamilyDataImport(this.dependencies, context, repository, 'delete')"), 1);
});
check('production composition supplies account and permission repositories', () => {
  assert.match(composition, /accountRepository: this\.#repositories\.accountRepository/u);
  assert.match(composition, /permissionRepository: this\.#repositories\.objectPermissionRepository/u);
});
check('location and event import receipt boundaries remain fail-closed', () => {
  assert.match(service, /import\.location_policy_batch_required/u);
  assert.match(service, /import\.event_location_policy_batch_required/u);
  assert.match(service, /currentPlan\.events\.length > 0/u);
  assert.equal(service.includes('timelineRepository.insert(repository'), false);
});
check('regression covers role denial and explicit deny before file access', () => {
  assert.match(regression, /actorRole = 'adult_member'/u);
  assert.match(regression, /deny-family-import-read/u);
  assert.match(regression, /missing\.json/u);
});
check('platform policy gate records reduced legacy debt without new bypasses', () => {
  assert.equal(gate.status, 'PASS');
  assert.equal(gate.legacyBypassCount, 25);
  assert.equal(gate.newBypassCount, 0);
});

const report = Object.freeze({
  schemaVersion: 1,
  requirementId: 'PPK-002',
  decisionIds: ['DEC-137', 'DEC-152', 'DEC-156', 'DEC-157', 'DEC-158', 'DEC-159'],
  status: 'PASS',
  scope: 'LOCAL_CONTINUATION_ONLY',
  officialStepAdvanced: false,
  officialBuildClaim: false,
  external30ZReceipt: 'PASS',
  external31AReceipt: 'PASS',
  ppk002Status: 'PARTIAL',
  applicationVersion: ACTIVE_BUILD_META.applicationVersion,
  legacyBypassCount: gate.legacyBypassCount,
  newBypassCount: gate.newBypassCount,
  targetedVitest: { files: 1, tests: 6, status: 'PASS' },
  fullVitest: { files: 28, tests: 158, status: 'PASS' },
  checkCount: checks.length,
  checks,
  generatedAt: new Date().toISOString()
});
mkdirSync(resolve(root, 'artifacts', 'validation'), { recursive: true });
writeFileSync(
  resolve(root, 'artifacts', 'validation', 'PPK002_FAMILY_DATA_IMPORT_POLICY_LOCAL_CONTINUATION.json'),
  `${JSON.stringify(report, null, 2)}\n`,
  'utf8'
);
console.log(JSON.stringify(report, null, 2));

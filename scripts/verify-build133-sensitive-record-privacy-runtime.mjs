import assert from 'node:assert/strict';
import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { execFileSync, spawnSync } from 'node:child_process';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { resolveTypeScriptCommand } from './lib/typescript-command.mjs';

const root = process.cwd();
const activePackageVersion = JSON.parse(await readFile(join(root, 'package.json'), 'utf8')).version;
const activeMeta = await readFile(join(root, 'packages/domain/src/app-meta.ts'), 'utf8');
const activeDisplayVersion = activeMeta.match(/version: '([^']+)'/)?.[1] ?? '';
const compileRoot = join(root, '.tmp', 'build133-sensitive-record-privacy-runtime');
const compiler = resolveTypeScriptCommand(root);
const globalRoot = execFileSync('npm', ['root', '-g'], { encoding: 'utf8' }).trim();
const firstExisting = (values) => values.find((value) => value && existsSync(value));
const nodeTypes = firstExisting([
  join(root, 'node_modules', '@types', 'node'),
  join(globalRoot, '@types', 'node'),
  join(globalRoot, 'ts-node', 'node_modules', '@types', 'node'),
  join(globalRoot, 'pptxgenjs', 'node_modules', '@types', 'node')
]);
const undiciTypes = firstExisting([
  join(root, 'node_modules', 'undici-types'),
  join(globalRoot, 'undici-types'),
  join(globalRoot, 'ts-node', 'node_modules', 'undici-types'),
  join(globalRoot, 'pptxgenjs', 'node_modules', 'undici-types')
]);
if (!nodeTypes) throw new Error('@types/node bulunamadı.');
await rm(compileRoot, { recursive: true, force: true });
await mkdir(join(compileRoot, 'node_modules', '@types'), { recursive: true });
await cp(nodeTypes, join(compileRoot, 'node_modules', '@types', 'node'), { recursive: true });
if (undiciTypes) await cp(undiciTypes, join(compileRoot, 'node_modules', 'undici-types'), { recursive: true });
await writeFile(join(compileRoot, 'tsconfig.json'), `${JSON.stringify({
  extends: resolve(root, 'tsconfig.base.json'),
  compilerOptions: {
    module: 'NodeNext', moduleResolution: 'NodeNext', outDir: join(compileRoot, 'dist'),
    rootDir: join(root, 'packages', 'security', 'src'), declaration: false,
    declarationMap: false, sourceMap: false, types: ['node']
  },
  include: [resolve(root, 'packages/security/src/authorization.ts')]
}, null, 2)}\n`);
const compilation = spawnSync(compiler.command, [...compiler.prefixArgs, '-p', join(compileRoot, 'tsconfig.json'), '--pretty', 'false'], { cwd: root, encoding: 'utf8' });
if (compilation.status !== 0) {
  process.stderr.write(compilation.stdout || '');
  process.stderr.write(compilation.stderr || '');
  throw new Error(`Build 133 authorization runtime compilation failed: ${compilation.status}`);
}
const { CentralAuthorizationService } = await import(pathToFileURL(join(compileRoot, 'dist', 'authorization.js')).href);
const service = new CentralAuthorizationService();
const at = '2026-07-27T22:30:00.000Z';
const grant = (overrides = {}) => ({
  id: 'grant-1', subjectAccountId: 'account-1', resourceType: 'finance_record', resourceId: 'record-1',
  actions: ['read'], effect: 'allow', startsAt: '2026-07-01T00:00:00.000Z', ...overrides
});
const request = (overrides = {}) => ({
  accountId: 'account-1', role: 'family_admin', action: 'read', resourceType: 'finance_record',
  resourceId: 'record-1', occurredAt: at, actorPersonId: 'person-actor', ownerPersonId: 'person-owner',
  privacy: 'private', sensitiveDomain: 'finance', grants: [], ...overrides
});
const checks = [];
const check = (label, operation) => { operation(); checks.push(label); };
const decision = (overrides) => service.authorize(request(overrides));

check('family admin cannot read another adult private finance record', () => assert.deepEqual(decision({}), { allowed: false, reason: 'privacy_boundary' }));
check('family admin cannot read selected-member health record by role', () => assert.equal(decision({ resourceType: 'health_record', sensitiveDomain: 'health', privacy: 'selected_members' }).allowed, false));
check('owner reads own private record', () => assert.equal(decision({ actorPersonId: 'person-owner' }).reason, 'owner'));
check('explicit allow opens private record', () => assert.equal(decision({ grants: [grant()] }).reason, 'explicit_allow'));
check('explicit deny overrides ownership', () => assert.equal(decision({ actorPersonId: 'person-owner', grants: [grant({ effect: 'deny' })] }).reason, 'explicit_deny'));
check('explicit deny overrides explicit allow', () => assert.equal(decision({ grants: [grant(), grant({ id: 'deny-1', effect: 'deny' })] }).allowed, false));
check('adult member reads family-visible finance record', () => assert.equal(decision({ role: 'adult_member', privacy: 'family' }).allowed, true));
check('advisor reads family-visible finance record', () => assert.equal(decision({ role: 'advisor', privacy: 'family' }).allowed, true));
check('caregiver cannot read family-visible finance record', () => assert.equal(decision({ role: 'caregiver', privacy: 'family' }).allowed, false));
check('caregiver reads family-visible health record', () => assert.equal(decision({ role: 'caregiver', resourceType: 'health_record', sensitiveDomain: 'health', privacy: 'family' }).allowed, true));
check('limited member cannot read family-visible health record', () => assert.equal(decision({ role: 'limited_member', resourceType: 'health_record', sensitiveDomain: 'health', privacy: 'family' }).allowed, false));
check('adult member reads family-visible medication plan', () => assert.equal(decision({ role: 'adult_member', resourceType: 'medication_plan', sensitiveDomain: 'health', privacy: 'family' }).allowed, true));
check('family admin updates family-visible finance record', () => assert.equal(decision({ action: 'update', privacy: 'family' }).allowed, true));
check('family admin cannot create private record for another adult', () => assert.equal(decision({ action: 'create', resourceId: '*', privacy: 'private' }).allowed, false));
check('owner creates own private record', () => assert.equal(decision({ action: 'create', resourceId: '*', actorPersonId: 'person-owner' }).allowed, true));
check('explicit wildcard grant permits private creation for another adult', () => assert.equal(decision({ action: 'create', resourceId: '*', grants: [grant({ resourceId: '*', actions: ['create'] })] }).allowed, true));
check('owner alone cannot send private finance record to AI', () => assert.equal(decision({ action: 'ai_process', actorPersonId: 'person-owner' }).reason, 'ai_explicit_permission_required'));
check('family admin alone cannot send family health record to AI', () => assert.equal(decision({ action: 'ai_process', resourceType: 'health_record', sensitiveDomain: 'health', privacy: 'family' }).allowed, false));
check('explicit AI permission is required and accepted', () => assert.equal(decision({ action: 'ai_process', grants: [grant({ actions: ['ai_process'] })] }).reason, 'explicit_allow'));
check('expired explicit grant is ignored', () => assert.equal(decision({ grants: [grant({ endsAt: '2026-07-20T00:00:00.000Z' })] }).allowed, false));
check('future explicit grant is ignored', () => assert.equal(decision({ grants: [grant({ startsAt: '2026-08-01T00:00:00.000Z' })] }).allowed, false));
check('unrelated resource grant is ignored', () => assert.equal(decision({ grants: [grant({ resourceId: 'record-other' })] }).allowed, false));
check('wildcard deny blocks all finance records', () => assert.equal(decision({ actorPersonId: 'person-owner', grants: [grant({ resourceId: '*', effect: 'deny' })] }).allowed, false));
check('non-sensitive authorization remains role-compatible', () => assert.equal(service.authorize({ accountId: 'account-1', role: 'family_admin', action: 'read', resourceType: 'event', resourceId: 'event-1', occurredAt: at }).allowed, true));

const evidence = { schemaVersion: 1, product: 'Anadolu Parsı Aile Yaşam Merkezi', featureBuild: 133, applicationVersion: activeDisplayVersion, packageVersion: activePackageVersion, checks: checks.length, status: 'PASS', scenarios: checks, generatedAt: new Date().toISOString() };
await mkdir(join(root, 'artifacts', 'validation'), { recursive: true });
await writeFile(join(root, 'artifacts', 'validation', 'build133-sensitive-record-privacy-runtime.json'), `${JSON.stringify(evidence, null, 2)}\n`);
await rm(compileRoot, { recursive: true, force: true });
console.log(`Build 133 sensitive-record privacy runtime verified: ${checks.length}/${checks.length} PASS.`);

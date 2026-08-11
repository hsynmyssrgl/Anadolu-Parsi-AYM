import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import assert from 'node:assert/strict';

const out = process.argv[2] ?? 'artifacts/validation/build177-security-center-menu-runtime.json';
const temp = resolve('.tmp/build177-security-center-menu-runtime');
await rm(temp, { recursive: true, force: true });
await mkdir(temp, { recursive: true });
const require = createRequire(import.meta.url);
const globalRoot = execFileSync('npm', ['root', '-g'], { encoding: 'utf8' }).trim();
const ts = require(join(globalRoot, 'typescript'));
const source = await readFile('apps/desktop/src/renderer/security-center-navigation.ts', 'utf8');
const compiled = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2024, module: ts.ModuleKind.ES2022 }, reportDiagnostics: true });
if (compiled.diagnostics?.length) throw new Error(compiled.diagnostics.map((item) => ts.flattenDiagnosticMessageText(item.messageText, '\n')).join('\n'));
const modulePath = join(temp, 'security-center-navigation.mjs');
await writeFile(modulePath, compiled.outputText);
const navigation = await import(`${pathToFileURL(modulePath).href}?v=${Date.now()}`);
const checks = [];
const check = (name, fn) => { try { fn(); checks.push({ name, status: 'PASS' }); } catch (error) { checks.push({ name, status: 'FAIL', error: error instanceof Error ? error.message : String(error) }); } };

check('route is security', () => assert.equal(navigation.SECURITY_CENTER_ROUTE, 'security'));
check('label is Turkish security center', () => assert.equal(navigation.SECURITY_CENTER_LABEL, 'Güvenlik Merkezi'));
check('explicit recovery requirement raises attention', () => assert.equal(navigation.securityCenterNeedsAttention({ deviceReauthorizationRequired: true }), true));
check('matching epochs do not raise attention', () => assert.equal(navigation.securityCenterNeedsAttention({ securityEpoch: 4, sessionSecurityEpoch: 4 }), false));
check('older session epoch raises attention', () => assert.equal(navigation.securityCenterNeedsAttention({ securityEpoch: 5, sessionSecurityEpoch: 4 }), true));
check('future session epoch raises attention', () => assert.equal(navigation.securityCenterNeedsAttention({ securityEpoch: 5, sessionSecurityEpoch: 6 }), true));
check('missing epoch information stays neutral', () => assert.equal(navigation.securityCenterNeedsAttention({}), false));
const ready = { twoFactorEnabled: true, password: 'correct horse battery staple', code: '123456', confirmation: navigation.DEVICE_REAUTHORIZATION_CONFIRMATION };
check('complete reauthorization input is ready', () => assert.equal(navigation.canSubmitDeviceReauthorization(ready), true));
check('disabled 2FA blocks reauthorization', () => assert.equal(navigation.canSubmitDeviceReauthorization({ ...ready, twoFactorEnabled: false }), false));
check('empty password blocks reauthorization', () => assert.equal(navigation.canSubmitDeviceReauthorization({ ...ready, password: '' }), false));
check('empty code blocks reauthorization', () => assert.equal(navigation.canSubmitDeviceReauthorization({ ...ready, code: '   ' }), false));
check('wrong confirmation blocks reauthorization', () => assert.equal(navigation.canSubmitDeviceReauthorization({ ...ready, confirmation: 'YANLIŞ' }), false));
check('confirmation comparison is exact', () => assert.equal(navigation.canSubmitDeviceReauthorization({ ...ready, confirmation: `${navigation.DEVICE_REAUTHORIZATION_CONFIRMATION} ` }), false));

const failures = checks.filter((item) => item.status === 'FAIL');
const report = { schemaVersion: 1, product: 'Anadolu Parsı Aile Yaşam Merkezi', build: 177, status: failures.length ? 'FAIL' : 'PASS', checks: checks.length, passed: checks.length - failures.length, failures, scenarios: checks, generatedAt: new Date().toISOString() };
await mkdir(dirname(out), { recursive: true });
await writeFile(out, `${JSON.stringify(report, null, 2)}\n`);
await rm(temp, { recursive: true, force: true });
if (failures.length) { console.error(JSON.stringify(report, null, 2)); process.exit(1); }
console.log(`Build 177 security center menu runtime: PASS (${checks.length}/${checks.length})`);

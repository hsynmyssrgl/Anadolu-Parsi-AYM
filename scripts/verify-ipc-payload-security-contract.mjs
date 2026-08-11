import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';
import { resolveTypeScriptCommand } from './lib/typescript-command.mjs';

const cli = process.argv.slice(2);
const readArg = (name, fallback) => {
  const index = cli.indexOf(name);
  if (index < 0) return fallback;
  const value = cli[index + 1];
  if (!value || value.startsWith('--')) throw new Error(`${name} requires a value.`);
  return value;
};
const reportPath = resolve(readArg('--report', 'artifacts/validation/ipc-payload-security-contract.json'));
const tempRoot = resolve('.tmp/ipc-payload-security-contract');
let assertions = 0;
const failures = [];
const verify = (condition, message) => { assertions += 1; if (!condition) failures.push(message); };
const expectReason = (contract, args, reason, limits) => {
  const decision = contract.evaluateIpcPayloadSecurity(args, limits);
  verify(decision.accepted === false, `payload unexpectedly accepted; expected=${reason}`);
  verify(decision.accepted === false && decision.reason === reason, `payload reason mismatch expected=${reason} actual=${decision.reason}`);
  verify(decision.accepted === false && typeof decision.path === 'string' && decision.path.startsWith('$'), `payload rejection path missing for ${reason}`);
};

await rm(tempRoot, { recursive: true, force: true });
await mkdir(tempRoot, { recursive: true });
const compiler = resolveTypeScriptCommand();
const compile = spawnSync(compiler.command, [...compiler.prefixArgs,
  'apps/desktop/src/main/ipc-payload-security.ts',
  '--ignoreConfig',
  '--target', 'ES2024',
  '--module', 'ESNext',
  '--moduleResolution', 'Bundler',
  '--strict',
  '--skipLibCheck',
  '--outDir', tempRoot,
  '--declaration', 'false',
  '--sourceMap', 'false'
], { cwd: process.cwd(), encoding: 'utf8', env: { ...process.env, TERM: 'dumb' } });
verify(compile.status === 0, `IPC payload security source compile failed: ${compile.stderr || compile.stdout}`);

if (compile.status === 0) {
  const contract = await import(`${pathToFileURL(join(tempRoot, 'ipc-payload-security.js')).href}?v=${Date.now()}`);
  const defaults = contract.DEFAULT_IPC_PAYLOAD_SECURITY_LIMITS;
  verify(Object.isFrozen(defaults), 'default IPC payload limits are mutable');
  verify(defaults.maxArgumentCount === 16, `maxArgumentCount=${defaults.maxArgumentCount}`);
  verify(defaults.maxDepth === 20, `maxDepth=${defaults.maxDepth}`);
  verify(defaults.maxNodes === 20000, `maxNodes=${defaults.maxNodes}`);
  verify(defaults.maxEstimatedBytes === 1048576, `maxEstimatedBytes=${defaults.maxEstimatedBytes}`);
  verify(defaults.maxStringBytes === 262144, `maxStringBytes=${defaults.maxStringBytes}`);
  verify(defaults.maxArrayLength === 10000, `maxArrayLength=${defaults.maxArrayLength}`);
  verify(defaults.maxObjectKeys === 10000, `maxObjectKeys=${defaults.maxObjectKeys}`);

  for (const args of [
    [],
    [null, undefined, true, false, 0, -1, 1.5, 'metin'],
    [{ id: 'member-1', nested: { enabled: true }, values: [1, 2, 3] }],
    [Object.assign(Object.create(null), { safe: 'value' })],
    [new Array(5)],
    [[{ a: 1 }, { b: 2 }]]
  ]) {
    const decision = contract.evaluateIpcPayloadSecurity(args);
    verify(decision.accepted === true, `valid payload rejected=${decision.reason}`);
    verify(decision.metrics.argumentCount === args.length, 'argument count metric mismatch');
    verify(decision.metrics.nodeCount >= args.length, 'node count metric too small');
    verify(decision.metrics.estimatedBytes >= 0, 'estimated byte metric invalid');
  }

  expectReason(contract, Array.from({ length: 17 }, (_, index) => index), 'TOO_MANY_ARGUMENTS');
  expectReason(contract, ['12345'], 'STRING_LIMIT_EXCEEDED', { maxStringBytes: 4 });
  expectReason(contract, ['12345'], 'BYTE_LIMIT_EXCEEDED', { maxStringBytes: 10, maxEstimatedBytes: 4 });
  expectReason(contract, [[1, 2, 3]], 'ARRAY_LENGTH_EXCEEDED', { maxArrayLength: 2 });
  expectReason(contract, [{ a: 1, b: 2, c: 3 }], 'OBJECT_KEY_LIMIT_EXCEEDED', { maxObjectKeys: 2 });
  expectReason(contract, [{ a: { b: { c: 1 } } }], 'DEPTH_LIMIT_EXCEEDED', { maxDepth: 2 });
  expectReason(contract, [[1, 2, 3, 4]], 'NODE_LIMIT_EXCEEDED', { maxNodes: 3 });
  expectReason(contract, [Number.NaN], 'NON_FINITE_NUMBER_REJECTED');
  expectReason(contract, [Number.POSITIVE_INFINITY], 'NON_FINITE_NUMBER_REJECTED');
  expectReason(contract, [1n], 'UNSUPPORTED_TYPE_REJECTED');
  expectReason(contract, [Symbol('x')], 'UNSUPPORTED_TYPE_REJECTED');
  expectReason(contract, [() => 1], 'UNSUPPORTED_TYPE_REJECTED');
  expectReason(contract, [new Date()], 'NON_PLAIN_OBJECT_REJECTED');
  expectReason(contract, [new Map()], 'NON_PLAIN_OBJECT_REJECTED');
  expectReason(contract, [new Set()], 'NON_PLAIN_OBJECT_REJECTED');
  expectReason(contract, [new Uint8Array([1, 2])], 'NON_PLAIN_OBJECT_REJECTED');
  expectReason(contract, [new (class CustomPayload { value = 1; })()], 'NON_PLAIN_OBJECT_REJECTED');
  class CustomArray extends Array {}
  expectReason(contract, [new CustomArray(1, 2)], 'NON_PLAIN_OBJECT_REJECTED');

  const cycle = {}; cycle.self = cycle;
  expectReason(contract, [cycle], 'DUPLICATE_REFERENCE_REJECTED');
  const shared = { value: 1 };
  expectReason(contract, [{ left: shared, right: shared }], 'DUPLICATE_REFERENCE_REJECTED');

  const getterPayload = {};
  Object.defineProperty(getterPayload, 'secret', { enumerable: true, get() { throw new Error('getter must never execute'); } });
  expectReason(contract, [getterPayload], 'ACCESSOR_PROPERTY_REJECTED');
  const setterPayload = {};
  Object.defineProperty(setterPayload, 'secret', { enumerable: true, set(_value) {} });
  expectReason(contract, [setterPayload], 'ACCESSOR_PROPERTY_REJECTED');
  const symbolProperty = { safe: 1 };
  symbolProperty[Symbol('hidden')] = 2;
  expectReason(contract, [symbolProperty], 'SYMBOL_PROPERTY_REJECTED');

  for (const forbidden of ['__proto__', 'prototype', 'constructor']) {
    const payload = Object.create(null);
    Object.defineProperty(payload, forbidden, { enumerable: true, configurable: true, writable: true, value: 'blocked' });
    expectReason(contract, [payload], 'FORBIDDEN_KEY_REJECTED');
  }

  for (const invalidLimits of [
    { maxArgumentCount: 0 },
    { maxDepth: -1 },
    { maxNodes: Number.NaN },
    { maxEstimatedBytes: 1.5 },
    { maxStringBytes: 0 },
    { maxArrayLength: -2 },
    { maxObjectKeys: Number.MAX_SAFE_INTEGER + 1 }
  ]) {
    let threw = false;
    try { contract.evaluateIpcPayloadSecurity([], invalidLimits); } catch { threw = true; }
    verify(threw, `invalid limits accepted=${JSON.stringify(invalidLimits)}`);
  }

  const exactDepth = contract.evaluateIpcPayloadSecurity([{ a: { b: 1 } }], { maxDepth: 2 });
  verify(exactDepth.accepted === true, 'payload at exact depth limit rejected');
  const exactArgs = contract.evaluateIpcPayloadSecurity(Array.from({ length: 16 }, () => null));
  verify(exactArgs.accepted === true, 'payload at exact argument limit rejected');
  const exactArray = contract.evaluateIpcPayloadSecurity([[1, 2]], { maxArrayLength: 2 });
  verify(exactArray.accepted === true, 'payload at exact array length limit rejected');
  const exactKeys = contract.evaluateIpcPayloadSecurity([{ a: 1, b: 2 }], { maxObjectKeys: 2 });
  verify(exactKeys.accepted === true, 'payload at exact object key limit rejected');
}

const runtimeSource = await readFile('apps/desktop/src/main/ipc-runtime.ts', 'utf8');
const policySource = await readFile('apps/desktop/src/main/ipc-payload-security.ts', 'utf8');
for (const marker of [
  'evaluateIpcPayloadSecurity',
  'ipc.payload.rejected',
  'CORE_INVALID_ARGUMENT',
  "category: 'security'",
  'payloadEstimatedBytes',
  'payloadNodeCount'
]) verify(runtimeSource.includes(marker), `IPC runtime payload integration marker missing=${marker}`);
for (const marker of [
  'DEFAULT_IPC_PAYLOAD_SECURITY_LIMITS',
  'WeakSet<object>',
  'Reflect.ownKeys',
  'Object.getOwnPropertyDescriptor',
  'FORBIDDEN_KEY_REJECTED',
  'DUPLICATE_REFERENCE_REJECTED',
  'NON_PLAIN_OBJECT_REJECTED'
]) verify(policySource.includes(marker), `IPC payload policy marker missing=${marker}`);
verify(runtimeSource.indexOf('evaluateIpcSenderTrust') < runtimeSource.indexOf('evaluateIpcPayloadSecurity'), 'payload validation runs before sender trust');
verify(runtimeSource.indexOf('evaluateIpcPayloadSecurity') < runtimeSource.indexOf('input.handler'), 'payload validation runs after handler invocation');
verify(!policySource.includes('JSON.stringify(rawArguments)'), 'payload security relies on unsafe JSON serialization');

const report = {
  schemaVersion: 1,
  product: 'Panthera pardus tulliana Aile',
  applicationVersion: '25.07.2026.120',
  packageVersion: '25.7.2026-120',
  stage: 'Bronze RC2 Active Development',
  scope: 'Electron IPC argument count, object-graph shape, depth, node and estimated-byte security boundary',
  assertions,
  failures,
  status: failures.length === 0 ? 'PASS' : 'FAIL',
  generatedAt: new Date().toISOString()
};
await mkdir(dirname(reportPath), { recursive: true });
await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`);
await rm(tempRoot, { recursive: true, force: true });
console.log(`IPC payload security contract: ${report.status} — ${assertions} assertions.`);
for (const failure of failures) console.error(`- ${failure}`);
if (report.status !== 'PASS') process.exitCode = 1;

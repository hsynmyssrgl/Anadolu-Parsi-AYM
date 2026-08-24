import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import {
  inventoryPlatformCapabilityManifestSurfaces,
  platformRuntimeCapabilityForSurfaceKind,
  scanPlatformCapabilityManifestSource
} from './lib/platform-capability-manifest-ast-scanner.mjs';

const MANIFEST_PATH = 'config/32-r-ppk-022-capability-surface-manifest.json';
const APPLICATION_IDS = Object.freeze([
  'windows-desktop', 'windows-core-service', 'windows-cluster-agent', 'macos-companion',
  'ios-companion', 'ipados-companion', 'watchos-companion', 'visionos-companion',
  'ocr-worker', 'ai-worker', 'translation-worker', 'communication-service',
  'backup-worker', 'signed-plugin'
]);
const RUNTIME_CAPABILITIES = Object.freeze([
  'camera.access', 'microphone.access', 'file.access', 'ocr.process',
  'ai.process', 'location.access', 'network.access'
]);
const EXPECTED_APPLICATION_CAPABILITIES = Object.freeze({
  'windows-desktop': Object.freeze(['camera.access', 'file.access', 'microphone.access', 'network.access', 'ocr.process']),
  'windows-core-service': Object.freeze(['file.access', 'network.access']),
  'windows-cluster-agent': Object.freeze([]),
  'macos-companion': Object.freeze([]),
  'ios-companion': Object.freeze([]),
  'ipados-companion': Object.freeze([]),
  'watchos-companion': Object.freeze([]),
  'visionos-companion': Object.freeze([]),
  'ocr-worker': Object.freeze([]),
  'ai-worker': Object.freeze([]),
  'translation-worker': Object.freeze([]),
  'communication-service': Object.freeze([]),
  'backup-worker': Object.freeze([]),
  'signed-plugin': Object.freeze([])
});
const APPLICATION_OWNERS_BY_SOURCE_PREFIX = Object.freeze([
  Object.freeze(['apps/core-service/src/', Object.freeze(['windows-core-service'])]),
  Object.freeze(['apps/desktop/src/', Object.freeze(['windows-desktop'])]),
  Object.freeze(['packages/core-service-client/src/', Object.freeze(['windows-desktop'])]),
  Object.freeze(['packages/database/src/', Object.freeze(['windows-desktop'])]),
  Object.freeze(['packages/logging/src/', Object.freeze(['windows-core-service', 'windows-desktop'])])
]);
const WINDOWS_DESKTOP_OCR_PACKAGE_SURFACE_PATHS = new Set([
  'packages/application/src/index.ts',
  'packages/domain/src/index.ts',
  'packages/repositories/src/index.ts',
  'packages/repository-contracts/src/index.ts',
  'packages/security/src/index.ts'
]);
const PINNED_BOOTSTRAP_SURFACE_KEYS = new Set([
  'FILE_IMPORT|apps/desktop/src/main/main.ts|node:fs:existsSync',
  'FILE_IMPORT|apps/desktop/src/main/main.ts|node:fs:mkdirSync',
  'FILE_IMPORT|apps/desktop/src/main/main.ts|node:fs:readFileSync',
  'FILE_IMPORT|apps/desktop/src/main/main.ts|node:fs:rmSync',
  'FILE_IMPORT|apps/desktop/src/main/main.ts|node:fs:writeFileSync',
  'FILE_IMPORT|apps/desktop/src/main/protected-side-artifact-store.ts|node:fs:appendFileSync',
  'FILE_IMPORT|apps/desktop/src/main/protected-side-artifact-store.ts|node:fs:chmodSync',
  'FILE_IMPORT|apps/desktop/src/main/protected-side-artifact-store.ts|node:fs:closeSync',
  'FILE_IMPORT|apps/desktop/src/main/protected-side-artifact-store.ts|node:fs:existsSync',
  'FILE_IMPORT|apps/desktop/src/main/protected-side-artifact-store.ts|node:fs:fsyncSync',
  'FILE_IMPORT|apps/desktop/src/main/protected-side-artifact-store.ts|node:fs:mkdirSync',
  'FILE_IMPORT|apps/desktop/src/main/protected-side-artifact-store.ts|node:fs:openSync',
  'FILE_IMPORT|apps/desktop/src/main/protected-side-artifact-store.ts|node:fs:readFileSync',
  'FILE_IMPORT|apps/desktop/src/main/protected-side-artifact-store.ts|node:fs:renameSync',
  'FILE_IMPORT|apps/desktop/src/main/protected-side-artifact-store.ts|node:fs:rmSync',
  'FILE_IMPORT|apps/desktop/src/main/protected-side-artifact-store.ts|node:fs:writeFileSync',
  'FILE_IMPORT|apps/desktop/src/main/runtime-bootstrap.ts|node:fs:mkdirSync',
  'FILE_IMPORT|packages/logging/src/index.ts|node:fs:appendFileSync',
  'FILE_IMPORT|packages/logging/src/index.ts|node:fs:existsSync',
  'FILE_IMPORT|packages/logging/src/index.ts|node:fs:mkdirSync',
  'FILE_IMPORT|packages/logging/src/index.ts|node:fs:readdirSync',
  'FILE_IMPORT|packages/logging/src/index.ts|node:fs:renameSync',
  'FILE_IMPORT|packages/logging/src/index.ts|node:fs:statSync',
  'FILE_IMPORT|packages/logging/src/index.ts|node:fs:unlinkSync',
  'NETWORK_IMPORT|packages/core-service-client/src/local-admin-client.ts|node:net:createConnection',
  'NETWORK_IMPORT|packages/core-service-client/src/local-admin-client.ts|node:net:Socket'
]);
const WILDCARD = /[*?\[\]{}]/u;
const same = (left, right) => left.length === right.length && left.every((value, index) => value === right[index]);
const expectedApplicationsForSurfaceKey = (key) => {
  const path = typeof key === 'string' ? key.split('|')[1] : undefined;
  if (path && WINDOWS_DESKTOP_OCR_PACKAGE_SURFACE_PATHS.has(path)) return Object.freeze(['windows-desktop']);
  return APPLICATION_OWNERS_BY_SOURCE_PREFIX.find(([prefix]) => path?.startsWith(prefix))?.[1];
};

const selfTest = () => {
  const malicious = [
    ["import { readFileSync } from 'node:fs'", 'FILE_IMPORT'],
    ["const fs = await import('node:fs/promises')", 'FILE_IMPORT'],
    ["const fs = process.getBuiltinModule('fs')", 'FILE_IMPORT'],
    ["navigator.mediaDevices['getUserMedia']({ video: true })", 'CAMERA_API'],
    ["navigator.mediaDevices.getUserMedia({ audio: true })", 'MICROPHONE_API'],
    ["desktopCapturer.getSources({ types: ['window'] })", 'CAMERA_API'],
    ["const Reader = globalThis.FileReader; new Reader()", 'FILE_GLOBAL'],
    ["dialog['showOpenDialog']({ properties: ['openFile'] })", 'FILE_DIALOG'],
    ["import Tesseract from 'tesseract.js'", 'OCR_IMPORT'],
    ["import OpenAI from 'openai'", 'AI_IMPORT'],
    ["navigator['geolocation']['getCurrentPosition'](done)", 'LOCATION_API'],
    ["const send = globalThis.fetch; send(url)", 'NETWORK_API'],
    ["new WebSocket(url)", 'NETWORK_API'],
    ["shell.openExternal(url)", 'NETWORK_API'],
    ["window.location.href = value; browser.loadURL(url)", 'NETWORK_API'],
    ["const hidden = 'node:' + 'fs'; await import(hidden)", 'CAPABILITY_DYNAMIC_IMPORT_UNRESOLVED'],
    ["import mic from 'node-record-lpcm16'", 'MICROPHONE_IMPORT'],
    ["export { readFile } from 'node:fs/promises'", 'FILE_IMPORT'],
    ["export * from 'node:fs'", 'FILE_IMPORT'],
    ["import fs = require('node:fs')", 'FILE_IMPORT'],
    ["import { createRequire } from 'node:module'; const req = createRequire(import.meta.url); req('node:fs')", 'FILE_IMPORT'],
    ["const { fetch: send } = globalThis; send(url)", 'NETWORK_API'],
    ["let Reader; Reader = globalThis.FileReader; new Reader()", 'FILE_GLOBAL'],
    ["const media = navigator.mediaDevices; media.getUserMedia({ video: true })", 'CAMERA_API'],
    ["const { getCurrentPosition: locate } = navigator.geolocation; locate(done)", 'LOCATION_API'],
    ["Reflect.apply(globalThis.fetch, globalThis, [url])", 'NETWORK_API'],
    ["window.open(url)", 'NETWORK_API'],
    ["window.location.href = url", 'NETWORK_API'],
    ["const view = <input type=\"file\" />", 'FILE_GLOBAL', 'apps/example/src/bypass.tsx'],
    ["const view = <input type=\"file\" capture />", 'CAMERA_API', 'apps/example/src/bypass.tsx'],
    ["import { dialog as chooser } from 'electron'; chooser.showOpenDialog({})", 'FILE_DIALOG'],
    ["import { net as transport } from 'electron'; transport.request(url)", 'NETWORK_API'],
    ["new MediaRecorder(stream)", 'MICROPHONE_API'],
    ["webContents.executeJavaScript(`navigator.mediaDevices.getUserMedia({video:true})`)", 'CAMERA_API'],
    ["webContents.executeJavaScript(buildScript())", 'CAPABILITY_DYNAMIC_EXECUTION_UNRESOLVED']
  ];
  const maliciousFailures = malicious.filter(([source, expected, fixturePath = 'apps/example/src/bypass.ts']) =>
    !scanPlatformCapabilityManifestSource(fixturePath, source)
      .some((item) => item.kind === expected));
  if (maliciousFailures.length) {
    throw new Error(`PPK-022 malicious capability AST self-test failed: ${maliciousFailures.length}/${malicious.length}`);
  }

  const benign = [
    "const text = 'navigator.geolocation.getCurrentPosition';",
    "const location = { latitude: 1, longitude: 2 };",
    "const aiConsent = { allowed: false };",
    "kitchen.readFileSync(recipe);",
    "const cameraLabel = 'camera';"
  ];
  const benignFailures = benign.filter((source) =>
    scanPlatformCapabilityManifestSource('packages/example/src/benign.ts', source).length !== 0);
  if (benignFailures.length) {
    throw new Error(`PPK-022 benign capability AST self-test failed: ${benignFailures.length}/${benign.length}`);
  }
  return { malicious: malicious.length, benign: benign.length };
};

export const evaluatePlatformCapabilityManifest = (inventory, manifest) => {
  const findings = [];
  const entries = Array.isArray(manifest?.surfaces) ? manifest.surfaces : [];
  const allowed = new Map();
  for (const entry of entries) {
    const key = entry?.key;
    const applicationIds = entry?.applicationIds;
    const expectedCapability = typeof key === 'string'
      ? platformRuntimeCapabilityForSurfaceKind(key.split('|', 1)[0])
      : undefined;
    const expectedApplications = expectedApplicationsForSurfaceKey(key);
    const expectedEnforcement = PINNED_BOOTSTRAP_SURFACE_KEYS.has(key)
      ? 'PINNED_BOOTSTRAP_THEN_SIGNED'
      : 'SIGNED_MANIFEST_STARTUP';
    if (
      !entry || typeof entry !== 'object' || Object.keys(entry).sort().join('|') !== 'applicationIds|capability|key|runtimeEnforcement'
      || typeof key !== 'string' || key.split('|').length !== 3 || WILDCARD.test(key)
      || !Array.isArray(applicationIds) || applicationIds.length < 1
      || applicationIds.some((applicationId) => !APPLICATION_IDS.includes(applicationId))
      || new Set(applicationIds).size !== applicationIds.length
      || !same(applicationIds, [...applicationIds].sort((left, right) => left.localeCompare(right, 'en')))
      || !expectedApplications || !same(applicationIds, expectedApplications)
      || !RUNTIME_CAPABILITIES.includes(entry.capability)
      || entry.capability !== expectedCapability
      || !['SIGNED_MANIFEST_STARTUP', 'PINNED_BOOTSTRAP_THEN_SIGNED'].includes(entry.runtimeEnforcement)
      || entry.runtimeEnforcement !== expectedEnforcement
    ) {
      findings.push({ kind: 'CAPABILITY_SURFACE_ENTRY_INVALID', key: String(key ?? ''), detail: 'Exact capability surface metadata is invalid.' });
      continue;
    }
    if (allowed.has(key)) findings.push({ kind: 'CAPABILITY_SURFACE_DUPLICATE', key, detail: 'Duplicate exact capability surface.' });
    allowed.set(key, entry);
  }

  const observed = new Map(inventory.observations.map((item) => [item.key, item]));
  for (const item of inventory.observations) {
    if (item.kind === 'AST_PARSE_ERROR' || item.kind === 'CAPABILITY_DYNAMIC_IMPORT_UNRESOLVED') {
      findings.push({ kind: item.kind, key: item.key, path: item.path, line: item.line, detail: item.detail });
      continue;
    }
    const entry = allowed.get(item.key);
    if (!entry) {
      findings.push({ kind: 'UNDECLARED_CAPABILITY_SURFACE', key: item.key, path: item.path, line: item.line, detail: item.detail });
      continue;
    }
    if (entry.capability !== item.capability) {
      findings.push({ kind: 'CAPABILITY_SURFACE_MAPPING_MISMATCH', key: item.key, path: item.path, line: item.line, detail: item.detail });
    }
  }
  for (const entry of entries) {
    if (typeof entry?.key === 'string' && !observed.has(entry.key)) {
      findings.push({ kind: 'STALE_CAPABILITY_SURFACE', key: entry.key, detail: 'The exact capability surface no longer exists.' });
    }
  }

  const configured = manifest?.applicationRuntimeCapabilities;
  if (!configured || typeof configured !== 'object' || Array.isArray(configured)) {
    findings.push({ kind: 'APPLICATION_CAPABILITY_REGISTRY_MISSING', key: 'applicationRuntimeCapabilities', detail: 'Exact application runtime capability registry is required.' });
  } else {
    const keys = Object.keys(configured).sort((left, right) => left.localeCompare(right, 'en'));
    if (!same(keys, [...APPLICATION_IDS].sort((left, right) => left.localeCompare(right, 'en')))) {
      findings.push({ kind: 'APPLICATION_CAPABILITY_REGISTRY_INVALID', key: 'applicationRuntimeCapabilities', detail: 'All fourteen canonical applications must be listed exactly.' });
    }
    for (const applicationId of APPLICATION_IDS) {
      const declared = configured[applicationId];
      const expected = EXPECTED_APPLICATION_CAPABILITIES[applicationId];
      if (!Array.isArray(declared) || !same(declared, expected)) {
        findings.push({ kind: 'APPLICATION_CAPABILITY_BASELINE_MISMATCH', key: applicationId, detail: 'Build manifest and signed runtime baseline must match exactly.' });
      }
    }
  }

  const aggregated = Object.fromEntries(APPLICATION_IDS.map((applicationId) => [applicationId, new Set()]));
  for (const entry of entries) {
    if (!entry || !RUNTIME_CAPABILITIES.includes(entry.capability) || !Array.isArray(entry.applicationIds)) continue;
    for (const applicationId of entry.applicationIds) aggregated[applicationId]?.add(entry.capability);
  }
  for (const applicationId of APPLICATION_IDS) {
    const values = [...aggregated[applicationId]].sort((left, right) => left.localeCompare(right, 'en'));
    if (!same(values, EXPECTED_APPLICATION_CAPABILITIES[applicationId])) {
      findings.push({ kind: 'OBSERVED_CAPABILITY_COVERAGE_MISMATCH', key: applicationId, detail: `Observed=${values.join(',') || 'none'}` });
    }
  }

  if (
    manifest?.defaultDecision !== 'DENY'
    || manifest?.exactMatchRequired !== true
    || manifest?.wildcardsAllowed !== false
    || manifest?.signedManifestRuntimeCheckRequired !== true
    || manifest?.buildManifestAloneGrantsRuntimeAuthority !== false
  ) findings.push({ kind: 'CAPABILITY_MANIFEST_FAIL_CLOSED_INVARIANT_MISSING', key: 'manifest', detail: 'Build and runtime fail-closed invariants are mandatory.' });

  const counts = Object.fromEntries([...new Set(inventory.observations.map((item) => item.kind))]
    .sort((left, right) => left.localeCompare(right, 'en'))
    .map((kind) => [kind, inventory.observations.filter((item) => item.kind === kind).length]));
  return {
    findings,
    counts,
    exactSurfaceCount: entries.length,
    pinnedBootstrapSurfaceCount: entries.filter((entry) => entry?.runtimeEnforcement === 'PINNED_BOOTSTRAP_THEN_SIGNED').length
  };
};

export const runPlatformCapabilityManifestGate = async (root = process.cwd(), options = {}) => {
  const assertions = selfTest();
  const inventory = await inventoryPlatformCapabilityManifestSurfaces(root);
  if (options.inventoryOnly) return {
    status: inventory.observations.some((item) => item.kind === 'AST_PARSE_ERROR') ? 'FAIL' : 'INVENTORY',
    productionSourceZones: inventory.zones,
    scannedFiles: inventory.files,
    capabilitySurfaces: inventory.observations.length,
    maliciousSelfTestAssertions: assertions.malicious,
    benignSelfTestAssertions: assertions.benign,
    observations: inventory.observations
  };
  const manifestBytes = await readFile(resolve(root, MANIFEST_PATH));
  const manifest = JSON.parse(manifestBytes.toString('utf8'));
  const evaluation = evaluatePlatformCapabilityManifest(inventory, manifest);
  return {
    status: evaluation.findings.length === 0 ? 'PASS' : 'FAIL',
    productionSourceZones: inventory.zones,
    scannedFiles: inventory.files,
    capabilitySurfaces: inventory.observations.length,
    exactManifestSurfaces: evaluation.exactSurfaceCount,
    exactManifestSha256: createHash('sha256').update(manifestBytes).digest('hex'),
    surfaceCounts: evaluation.counts,
    pinnedBootstrapSurfaces: evaluation.pinnedBootstrapSurfaceCount,
    maliciousSelfTestAssertions: assertions.malicious,
    benignSelfTestAssertions: assertions.benign,
    canonicalApplications: APPLICATION_IDS.length,
    protectedCapabilityFamilies: 7,
    findings: evaluation.findings
  };
};

const main = async () => {
  const inventoryOnly = process.argv.includes('--inventory');
  const noWrite = process.argv.includes('--no-write');
  const report = await runPlatformCapabilityManifestGate(process.cwd(), { inventoryOnly });
  if (inventoryOnly) {
    console.log(JSON.stringify(process.argv.includes('--keys') ? report.observations.map((item) => item.key) : report, null, 2));
    if (report.status === 'FAIL') process.exitCode = 1;
    return;
  }
  if (!noWrite) {
    await mkdir('artifacts/validation', { recursive: true });
    await writeFile('artifacts/validation/platform-capability-manifest-gate.json', `${JSON.stringify(report, null, 2)}\n`);
  }
  console.log(JSON.stringify(report, null, 2));
  if (report.status !== 'PASS') process.exitCode = 1;
};

const invokedPath = process.argv[1] ? pathToFileURL(resolve(process.argv[1])).href : '';
if (import.meta.url === invokedPath) await main();

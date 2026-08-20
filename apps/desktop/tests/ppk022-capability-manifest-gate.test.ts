import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
import {
  inventoryPlatformCapabilityManifestSurfaces,
  scanPlatformCapabilityManifestSource
} from '../../../scripts/lib/platform-capability-manifest-ast-scanner.mjs';
import {
  evaluatePlatformCapabilityManifest,
  runPlatformCapabilityManifestGate
} from '../../../scripts/verify-platform-capability-manifest-gate.mjs';

const kinds = (source: string) => scanPlatformCapabilityManifestSource('apps/untrusted/src/bypass.ts', source)
  .map((item) => item.kind);

describe('32-R PPK-022 capability manifest AST gate', () => {
  it('detects all seven protected resource families', () => {
    expect(kinds("import Webcam from 'node-webcam'")).toContain('CAMERA_IMPORT');
    expect(kinds("import mic from 'node-record-lpcm16'")).toContain('MICROPHONE_IMPORT');
    expect(kinds("import { readFile } from 'node:fs/promises'")).toContain('FILE_IMPORT');
    expect(kinds("import OCR from 'tesseract.js'")).toContain('OCR_IMPORT');
    expect(kinds("import OpenAI from 'openai'")).toContain('AI_IMPORT');
    expect(kinds('navigator.geolocation.getCurrentPosition(done)')).toContain('LOCATION_API');
    expect(kinds('const send = globalThis.fetch; send(url)')).toContain('NETWORK_API');
  });

  it('detects aliases, computed properties, dynamic imports and bootstrap-module escapes', () => {
    expect(kinds("dialog['showSaveDialog']({})")).toContain('FILE_DIALOG');
    expect(kinds("const Reader = globalThis.FileReader; new Reader()")).toContain('FILE_GLOBAL');
    expect(kinds("const fs = process.getBuiltinModule('fs')")).toContain('FILE_IMPORT');
    expect(kinds("const hidden = 'node:' + 'fs'; import(hidden)")).toContain('CAPABILITY_DYNAMIC_IMPORT_UNRESOLVED');
    expect(kinds("export { readFile } from 'node:fs/promises'")).toContain('FILE_IMPORT');
    expect(kinds("import fs = require('node:fs')")).toContain('FILE_IMPORT');
    expect(kinds("import { createRequire } from 'node:module'; const req=createRequire(import.meta.url); req('node:fs')")).toContain('FILE_IMPORT');
    expect(kinds("const { fetch: send }=globalThis; Reflect.apply(send, globalThis, [url])")).toContain('NETWORK_API');
    expect(kinds("const media=navigator.mediaDevices; media.getUserMedia({video:true})")).toEqual(expect.arrayContaining(['CAMERA_API', 'MICROPHONE_API']));
    expect(kinds("webContents.executeJavaScript(`navigator.mediaDevices.getUserMedia({video:true})`)")).toEqual(expect.arrayContaining(['CAMERA_API', 'MICROPHONE_API']));
    expect(kinds("webContents.executeJavaScript(buildScript())")).toContain('CAPABILITY_DYNAMIC_EXECUTION_UNRESOLVED');
    expect(kinds("const { getCurrentPosition: locate }=navigator.geolocation; locate(done)")).toContain('LOCATION_API');
    expect(kinds("import { dialog } from 'electron'; const { showOpenDialog: choose }=dialog; choose({})")).toContain('FILE_DIALOG');
    expect(scanPlatformCapabilityManifestSource('apps/untrusted/src/bypass.tsx', 'const view=<input type="file" capture />').map((item) => item.kind))
      .toEqual(expect.arrayContaining(['FILE_GLOBAL', 'CAMERA_API']));
  });

  it('keeps benign labels, domain locations and AI-consent metadata outside the gate', () => {
    expect(kinds("const camera = 'camera'; const location = { latitude: 1 }; const aiConsent = false;")).toEqual([]);
  });

  it('matches every production surface to exact application and runtime capability metadata', async () => {
    const manifest = JSON.parse(await readFile('config/32-r-ppk-022-capability-surface-manifest.json', 'utf8'));
    const inventory = await inventoryPlatformCapabilityManifestSurfaces();
    const result = evaluatePlatformCapabilityManifest(inventory, manifest);
    expect(result.findings).toEqual([]);
    expect(inventory.zones).toBe(18);
    expect(inventory.files).toBe(588);
    expect(inventory.observations).toHaveLength(447);
    expect(result.exactSurfaceCount).toBe(447);
    expect(result.pinnedBootstrapSurfaceCount).toBe(26);
  });

  it('rejects new, stale, wildcard and application-coverage drift', async () => {
    const manifest = JSON.parse(await readFile('config/32-r-ppk-022-capability-surface-manifest.json', 'utf8'));
    const inventory = await inventoryPlatformCapabilityManifestSurfaces();
    const removed = { ...manifest, surfaces: manifest.surfaces.slice(1) };
    expect(evaluatePlatformCapabilityManifest(inventory, removed).findings)
      .toEqual(expect.arrayContaining([expect.objectContaining({ kind: 'UNDECLARED_CAPABILITY_SURFACE' })]));
    const stale = { ...manifest, surfaces: [...manifest.surfaces, { ...manifest.surfaces[0], key: 'FILE_IMPORT|apps/*|node:fs:*' }] };
    expect(evaluatePlatformCapabilityManifest(inventory, stale).findings)
      .toEqual(expect.arrayContaining([expect.objectContaining({ kind: 'CAPABILITY_SURFACE_ENTRY_INVALID' })]));
    const drift = {
      ...manifest,
      applicationRuntimeCapabilities: { ...manifest.applicationRuntimeCapabilities, 'windows-desktop': ['file.access'] }
    };
    expect(evaluatePlatformCapabilityManifest(inventory, drift).findings)
      .toEqual(expect.arrayContaining([expect.objectContaining({ kind: 'APPLICATION_CAPABILITY_BASELINE_MISMATCH' })]));
    const ownerDrift = {
      ...manifest,
      surfaces: manifest.surfaces.map((entry: { key:string; applicationIds:string[] }, index: number) => index === 0
        ? { ...entry, applicationIds: ['windows-core-service'] }
        : entry)
    };
    expect(evaluatePlatformCapabilityManifest(inventory, ownerDrift).findings)
      .toEqual(expect.arrayContaining([expect.objectContaining({ kind: 'CAPABILITY_SURFACE_ENTRY_INVALID' })]));
    const enforcementDrift = {
      ...manifest,
      surfaces: manifest.surfaces.map((entry: { runtimeEnforcement:string }, index: number) => index === 0
        ? { ...entry, runtimeEnforcement: 'PINNED_BOOTSTRAP_THEN_SIGNED' }
        : entry)
    };
    expect(evaluatePlatformCapabilityManifest(inventory, enforcementDrift).findings)
      .toEqual(expect.arrayContaining([expect.objectContaining({ kind: 'CAPABILITY_SURFACE_ENTRY_INVALID' })]));
  });

  it('produces a content-free full-production PASS report', async () => {
    const report = await runPlatformCapabilityManifestGate();
    expect(report).toMatchObject({
      status: 'PASS',
      productionSourceZones: 18,
      scannedFiles: 588,
      capabilitySurfaces: 447,
      exactManifestSurfaces: 447,
      pinnedBootstrapSurfaces: 26,
      maliciousSelfTestAssertions: 35,
      benignSelfTestAssertions: 5,
      canonicalApplications: 14,
      protectedCapabilityFamilies: 7,
      findings: []
    });
    expect(Object.hasOwn(report, 'observations')).toBe(false);
  });
});

import { createHash } from 'node:crypto';
import { existsSync, readFileSync, rmSync } from 'node:fs';
import { isAbsolute, relative, resolve, join } from 'node:path';
import { WINDOWS_DPAPI_PROTECTION_ID, type DeviceSecretProtector } from './device-secret-protector.js';
import type { ProtectedSideArtifactEnvelope, ProtectedSideArtifactStore } from './protected-side-artifact-store.js';

export interface WindowsOpen022SideArtifactEvidenceProbeReport {
  readonly schemaVersion: 1;
  readonly build: number;
  readonly status: 'PASS';
  readonly platform: 'win32';
  readonly applicationVersion: string;
  readonly safeStorage: {
    readonly status: 'PASS';
    readonly selectedBackend: string;
    readonly runtimeBackendReported: boolean;
    readonly provider: 'windows-dpapi';
    readonly providerBasis: 'windows-current-user-dpapi-platform-contract';
    readonly protectionId: 'windows-dpapi-current-user-v1';
    readonly encryptionAvailable: 'PASS';
    readonly encryptDecryptRoundTrip: 'PASS';
    readonly crossProcessPersistence: 'PASS';
  };
  readonly keyEnvelope: {
    readonly status: 'PASS';
    readonly deviceWrapped: 'PASS';
    readonly noPlainDataKey: 'PASS';
  };
  readonly containers: {
    readonly pplog: 'PASS';
    readonly pptdiag: 'PASS';
    readonly pptreport: 'PASS';
    readonly ciphertextHidesPlaintext: 'PASS';
    readonly decryptRoundTrip: 'PASS';
  };
  readonly startupEvidence: {
    readonly status: 'PASS';
    readonly encryptedAtRest: 'PASS';
    readonly decryptRoundTrip: 'PASS';
    readonly protectionProvider: 'windows-dpapi';
  };
  readonly volatilePaths: {
    readonly status: 'PASS';
    readonly sessionDataUnderVolatileRoot: 'PASS';
    readonly crashDumpsUnderVolatileRoot: 'PASS';
  };
  readonly probeMarkerSha256: string;
  readonly generatedAt: string;
}

const isWithin = (root: string, candidate: string): boolean => {
  const rel = relative(resolve(root), resolve(candidate));
  return rel === '' || (!rel.startsWith('..') && !isAbsolute(rel));
};

const assertProtectedContainerRoundTrip = (
  store: ProtectedSideArtifactStore,
  path: string,
  kind: string,
  marker: string
): void => {
  try {
    store.writeText(path, kind, marker);
    const raw = readFileSync(path, 'utf8');
    if (raw.includes(marker)) throw new Error(`${kind} protected container leaked plaintext marker.`);
    if (store.readText(path) !== marker) throw new Error(`${kind} protected container decrypt round-trip failed.`);
  } finally {
    rmSync(path, { force: true });
  }
};

const assertProtectedLogRoundTrip = (
  store: ProtectedSideArtifactStore,
  path: string,
  marker: string
): void => {
  try {
    store.appendTextRecord(path, 'windows-open022-log-probe', marker);
    const raw = readFileSync(path, 'utf8');
    if (raw.includes(marker)) throw new Error('Protected .pplog leaked plaintext marker.');
    const line = raw.trim().split(/\r?\n/u)[0];
    if (!line) throw new Error('Protected .pplog did not contain an encrypted record.');
    const envelope = JSON.parse(line) as ProtectedSideArtifactEnvelope;
    if (store.openEnvelope(envelope).toString('utf8') !== marker) {
      throw new Error('Protected .pplog decrypt round-trip failed.');
    }
  } finally {
    rmSync(path, { force: true });
  }
};

export const runWindowsOpen022SideArtifactEvidenceProbe = (input: {
  readonly applicationVersion: string;
  readonly userDataPath: string;
  readonly volatileRuntimeRoot: string;
  readonly sessionDataPath: string;
  readonly crashDumpsPath: string;
  readonly selectedStorageBackend: string;
  readonly protector: DeviceSecretProtector;
  readonly protectedArtifacts: ProtectedSideArtifactStore;
  readonly startupEvidencePath: string;
}): WindowsOpen022SideArtifactEvidenceProbeReport => {
  if (process.platform !== 'win32') {
    throw new Error('OPEN-022 side-artifact evidence probe can run only on Windows.');
  }
  if (input.protector.protectionId !== WINDOWS_DPAPI_PROTECTION_ID || !input.protector.isAvailable()) {
    throw new Error(`Windows CurrentUser DPAPI protector is unavailable or unexpected: ${input.protector.protectionId}`);
  }

  const build = Number(input.applicationVersion.split('.').at(-1));
  if (!Number.isInteger(build) || build < 1) {
    throw new Error(`OPEN-022 evidence probe received invalid application version: ${input.applicationVersion}`);
  }
  const marker = `PPT-WINDOWS-OPEN022-PROBE-${process.pid}-${Date.now()}`;
  const probeMarkerSha256 = createHash('sha256').update(marker, 'utf8').digest('hex');
  const protectedMarker = input.protector.protect(marker);
  if (!protectedMarker || protectedMarker === marker || protectedMarker.includes(marker)) {
    throw new Error('Windows CurrentUser DPAPI did not produce an opaque protected value.');
  }
  if (input.protector.unprotect(protectedMarker) !== marker) {
    throw new Error('Windows CurrentUser DPAPI encrypt/decrypt round-trip failed.');
  }

  const keyPath = join(input.userDataPath, 'secrets', 'side-artifact-key.json');
  if (!existsSync(keyPath)) throw new Error('Protected side-artifact key envelope was not created.');
  const keyEnvelope = JSON.parse(readFileSync(keyPath, 'utf8')) as {
    readonly protectionId?: unknown;
    readonly protectedDataKey?: unknown;
    readonly dataKey?: unknown;
  };
  if (
    keyEnvelope.protectionId !== WINDOWS_DPAPI_PROTECTION_ID ||
    typeof keyEnvelope.protectedDataKey !== 'string' ||
    keyEnvelope.protectedDataKey.length === 0 ||
    keyEnvelope.dataKey !== undefined
  ) {
    throw new Error('Protected side-artifact key envelope does not prove CurrentUser-DPAPI-wrapped key storage.');
  }

  const validationRoot = join(input.userDataPath, 'validation');
  assertProtectedLogRoundTrip(input.protectedArtifacts, join(validationRoot, 'open022-probe.pplog'), marker);
  assertProtectedContainerRoundTrip(input.protectedArtifacts, join(validationRoot, 'open022-probe.pptdiag'), 'windows-open022-diagnostic-probe', marker);
  assertProtectedContainerRoundTrip(input.protectedArtifacts, join(validationRoot, 'open022-probe.pptreport'), 'windows-open022-report-probe', marker);

  if (!existsSync(input.startupEvidencePath)) throw new Error('Protected startup evidence file was not created.');
  const rawStartupEvidence = readFileSync(input.startupEvidencePath, 'utf8');
  if (rawStartupEvidence.includes('protectionProvider') || rawStartupEvidence.includes('windows-dpapi')) {
    throw new Error('Protected startup evidence contains plaintext security fields.');
  }
  const startupEvidence = JSON.parse(input.protectedArtifacts.readText(input.startupEvidencePath)) as {
    readonly status?: unknown;
    readonly protectionProvider?: unknown;
    readonly encryptionRoundTrip?: unknown;
    readonly diagnosticOnly?: unknown;
  };
  if (
    startupEvidence.status !== 'PASS' ||
    startupEvidence.protectionProvider !== 'windows-dpapi' ||
    startupEvidence.encryptionRoundTrip !== 'PASS' ||
    startupEvidence.diagnosticOnly !== false
  ) {
    throw new Error(`Protected startup evidence did not prove official Windows DPAPI preflight: ${JSON.stringify(startupEvidence)}`);
  }

  if (!isWithin(input.volatileRuntimeRoot, input.sessionDataPath)) {
    throw new Error(`Electron sessionData escaped volatile runtime root: ${input.sessionDataPath}`);
  }
  if (!isWithin(input.volatileRuntimeRoot, input.crashDumpsPath)) {
    throw new Error(`Electron crashDumps escaped volatile runtime root: ${input.crashDumpsPath}`);
  }

  return {
    schemaVersion: 1,
    build,
    status: 'PASS',
    platform: 'win32',
    applicationVersion: input.applicationVersion,
    safeStorage: {
      status: 'PASS',
      selectedBackend: input.selectedStorageBackend,
      runtimeBackendReported: input.selectedStorageBackend !== 'unknown',
      provider: 'windows-dpapi',
      providerBasis: 'windows-current-user-dpapi-platform-contract',
      protectionId: WINDOWS_DPAPI_PROTECTION_ID,
      encryptionAvailable: 'PASS',
      encryptDecryptRoundTrip: 'PASS',
      crossProcessPersistence: 'PASS'
    },
    keyEnvelope: {
      status: 'PASS',
      deviceWrapped: 'PASS',
      noPlainDataKey: 'PASS'
    },
    containers: {
      pplog: 'PASS',
      pptdiag: 'PASS',
      pptreport: 'PASS',
      ciphertextHidesPlaintext: 'PASS',
      decryptRoundTrip: 'PASS'
    },
    startupEvidence: {
      status: 'PASS',
      encryptedAtRest: 'PASS',
      decryptRoundTrip: 'PASS',
      protectionProvider: 'windows-dpapi'
    },
    volatilePaths: {
      status: 'PASS',
      sessionDataUnderVolatileRoot: 'PASS',
      crashDumpsUnderVolatileRoot: 'PASS'
    },
    probeMarkerSha256,
    generatedAt: new Date().toISOString()
  };
};

import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import {
  chmodSync,
  closeSync,
  existsSync,
  fsyncSync,
  mkdirSync,
  openSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync
} from 'node:fs';
import { dirname } from 'node:path';
import { CURRENT_PRODUCT_NAME, type PersistedProductName } from '@ppt/domain';
import type { DeviceSecretProtector } from './device-secret-protector.js';
import type { RendererSecurityPolicyEvidence } from './renderer-window-security.js';

const SENTINEL_SCHEMA_VERSION = 1;
const EVIDENCE_SCHEMA_VERSION = 1;
const UNSAFE_EXACT_SWITCHES = new Set([
  '--no-sandbox',
  '--disable-setuid-sandbox',
  '--disable-gpu-sandbox',
  '--single-process'
]);
const UNSAFE_DISABLED_FEATURES = new Set([
  'RendererCodeIntegrity',
  'WinSboxForceRendererCodeIntegrity',
  'RendererAppContainer',
  'GpuAppContainer'
]);

interface StartupSecuritySentinel {
  readonly schemaVersion: 1;
  readonly protectionId: string;
  readonly protectedChallenge: string;
  readonly challengeSha256: string;
  readonly createdAt: string;
  readonly lastVerifiedAt: string;
}

export type StartupSentinelState = 'created' | 'verified';

export interface StartupSecurityPreflightInput {
  readonly applicationVersion: string;
  readonly packageVersion: string;
  readonly platform: NodeJS.Platform;
  readonly isPackaged: boolean;
  readonly electronVersion: string;
  readonly commandLineArguments: readonly string[];
  readonly allowUnsafeDiagnostic: boolean;
  readonly protector: DeviceSecretProtector;
  readonly sentinelPath: string;
  readonly evidencePath: string;
  readonly rendererPolicy: RendererSecurityPolicyEvidence;
  readonly writeEvidence?: (path: string, report: StartupSecurityPreflightReport) => void;
  readonly now?: () => string;
}

export interface StartupSecurityPreflightReport {
  readonly schemaVersion: 1;
  readonly product: PersistedProductName;
  readonly applicationVersion: string;
  readonly packageVersion: string;
  readonly platform: NodeJS.Platform;
  readonly isPackaged: boolean;
  readonly electronVersion: string;
  readonly protectionId: string;
  readonly protectionProvider: string;
  readonly protectionRequired: boolean;
  readonly encryptionRoundTrip: 'PASS';
  readonly sentinelState: StartupSentinelState;
  readonly unsafeSwitches: readonly string[];
  readonly diagnosticOnly: boolean;
  readonly rendererPolicy: RendererSecurityPolicyEvidence;
  readonly status: 'PASS' | 'DIAGNOSTIC_PASS';
  readonly generatedAt: string;
}

const sha256 = (value: string): Buffer => createHash('sha256').update(value, 'utf8').digest();

const writeAtomicJson = (path: string, value: unknown): void => {
  mkdirSync(dirname(path), { recursive: true });
  const temporaryPath = `${path}.${process.pid}.${randomBytes(6).toString('hex')}.tmp`;
  let descriptor: number | undefined;
  try {
    descriptor = openSync(temporaryPath, 'wx', 0o600);
    writeFileSync(descriptor, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
    fsyncSync(descriptor);
    closeSync(descriptor);
    descriptor = undefined;
    try { chmodSync(temporaryPath, 0o600); } catch { /* Windows ACL/DPAPI koruması üst katmandadır. */ }
    renameSync(temporaryPath, path);
    try { chmodSync(path, 0o600); } catch { /* Windows ACL/DPAPI koruması üst katmandadır. */ }
  } catch (error) {
    if (descriptor !== undefined) {
      try { closeSync(descriptor); } catch { /* en iyi çaba */ }
    }
    rmSync(temporaryPath, { force: true });
    throw error;
  }
};

const parseDisabledFeatures = (argument: string): readonly string[] => {
  const prefix = '--disable-features=';
  if (!argument.startsWith(prefix)) return [];
  return argument.slice(prefix.length).split(',').map((value) => value.trim()).filter(Boolean);
};

export const findUnsafeElectronSwitches = (
  commandLineArguments: readonly string[]
): readonly string[] => {
  const unsafe = new Set<string>();
  for (const argument of commandLineArguments) {
    const normalized = argument.trim();
    if (UNSAFE_EXACT_SWITCHES.has(normalized)) unsafe.add(normalized);
    const disabledFeatures = parseDisabledFeatures(normalized);
    for (const feature of disabledFeatures) {
      if (UNSAFE_DISABLED_FEATURES.has(feature)) unsafe.add(`--disable-features:${feature}`);
    }
  }
  return [...unsafe].sort();
};

export const resolveProtectionProvider = (platform: NodeJS.Platform): string => {
  if (platform === 'win32') return 'windows-dpapi';
  if (platform === 'darwin') return 'macos-keychain';
  if (platform === 'linux') return 'linux-secret-service';
  return 'electron-safe-storage';
};

const readSentinel = (path: string): StartupSecuritySentinel => {
  let parsed: unknown;
  try {
    parsed = JSON.parse(readFileSync(path, 'utf8'));
  } catch {
    throw new Error('Başlangıç güvenlik işareti okunamadı veya geçersiz JSON içeriyor.');
  }
  if (!parsed || typeof parsed !== 'object') {
    throw new Error('Başlangıç güvenlik işareti nesne biçiminde değil.');
  }
  const value = parsed as Partial<StartupSecuritySentinel>;
  if (
    value.schemaVersion !== SENTINEL_SCHEMA_VERSION ||
    typeof value.protectionId !== 'string' ||
    typeof value.protectedChallenge !== 'string' ||
    !/^[a-f0-9]{64}$/u.test(value.challengeSha256 ?? '') ||
    typeof value.createdAt !== 'string' ||
    typeof value.lastVerifiedAt !== 'string'
  ) {
    throw new Error('Başlangıç güvenlik işareti şeması geçersiz.');
  }
  return value as StartupSecuritySentinel;
};

const verifyOrCreateSentinel = (
  protector: DeviceSecretProtector,
  path: string,
  now: string
): StartupSentinelState => {
  if (!existsSync(path)) {
    const challenge = `ppt-startup-${randomBytes(32).toString('base64url')}`;
    const sentinel: StartupSecuritySentinel = {
      schemaVersion: SENTINEL_SCHEMA_VERSION,
      protectionId: protector.protectionId,
      protectedChallenge: protector.protect(challenge),
      challengeSha256: sha256(challenge).toString('hex'),
      createdAt: now,
      lastVerifiedAt: now
    };
    writeAtomicJson(path, sentinel);
    return 'created';
  }

  const sentinel = readSentinel(path);
  if (sentinel.protectionId !== protector.protectionId) {
    throw new Error('Başlangıç güvenlik işareti farklı bir koruma sağlayıcısına ait.');
  }
  let challenge: string;
  try {
    challenge = protector.unprotect(sentinel.protectedChallenge);
  } catch {
    throw new Error('Başlangıç güvenlik işareti işletim sistemi korumasıyla açılamadı.');
  }
  const actualHash = sha256(challenge);
  const expectedHash = Buffer.from(sentinel.challengeSha256, 'hex');
  if (actualHash.length !== expectedHash.length || !timingSafeEqual(actualHash, expectedHash)) {
    throw new Error('Başlangıç güvenlik işareti bütünlük doğrulamasını geçemedi.');
  }
  writeAtomicJson(path, { ...sentinel, lastVerifiedAt: now });
  return 'verified';
};

const verifyEncryptionRoundTrip = (protector: DeviceSecretProtector): void => {
  const challenge = `ppt-roundtrip-${randomBytes(32).toString('base64url')}`;
  const protectedValue = protector.protect(challenge);
  if (!protectedValue || protectedValue === challenge) {
    throw new Error('İşletim sistemi sır koruması açık metinden farklı bir çıktı üretmedi.');
  }
  const recovered = protector.unprotect(protectedValue);
  const actual = Buffer.from(recovered, 'utf8');
  const expected = Buffer.from(challenge, 'utf8');
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) {
    throw new Error('İşletim sistemi sır koruması şifreleme turunu doğrulayamadı.');
  }
};

export const runStartupSecurityPreflight = (
  input: StartupSecurityPreflightInput
): StartupSecurityPreflightReport => {
  const now = input.now?.() ?? new Date().toISOString();
  const unsafeSwitches = findUnsafeElectronSwitches(input.commandLineArguments);
  const diagnosticOnly = unsafeSwitches.length > 0 && input.allowUnsafeDiagnostic;
  if (unsafeSwitches.length > 0 && !input.allowUnsafeDiagnostic) {
    throw new Error(`Güvensiz Electron başlatma anahtarları reddedildi: ${unsafeSwitches.join(', ')}`);
  }
  if (input.protector.required && !input.protector.isAvailable()) {
    throw new Error('Zorunlu işletim sistemi sır koruması başlangıçta kullanılamıyor.');
  }
  if (!input.protector.isAvailable()) {
    throw new Error('Başlangıç güvenlik doğrulaması için işletim sistemi sır koruması kullanılamıyor.');
  }

  verifyEncryptionRoundTrip(input.protector);
  const sentinelState = verifyOrCreateSentinel(input.protector, input.sentinelPath, now);
  const report: StartupSecurityPreflightReport = {
    schemaVersion: EVIDENCE_SCHEMA_VERSION,
    product: CURRENT_PRODUCT_NAME,
    applicationVersion: input.applicationVersion,
    packageVersion: input.packageVersion,
    platform: input.platform,
    isPackaged: input.isPackaged,
    electronVersion: input.electronVersion,
    protectionId: input.protector.protectionId,
    protectionProvider: resolveProtectionProvider(input.platform),
    protectionRequired: input.protector.required,
    encryptionRoundTrip: 'PASS',
    sentinelState,
    unsafeSwitches,
    diagnosticOnly,
    rendererPolicy: input.rendererPolicy,
    status: diagnosticOnly ? 'DIAGNOSTIC_PASS' : 'PASS',
    generatedAt: now
  };
  if (input.writeEvidence) input.writeEvidence(input.evidencePath, report);
  else writeAtomicJson(input.evidencePath, report);
  return report;
};

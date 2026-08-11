import { spawnSync } from 'node:child_process';

export interface DeviceSecretProtector {
  readonly protectionId: string;
  readonly required: boolean;
  isAvailable(): boolean;
  protect(secret: string): string;
  unprotect(protectedBase64: string): string;
}

export const WINDOWS_DPAPI_PROTECTION_ID = 'windows-dpapi-current-user-v1';

type WindowsDpapiOperation = 'protect' | 'unprotect';

export interface WindowsDpapiExecutionResult {
  readonly status: number | null;
  readonly stdout: string;
  readonly stderr: string;
  readonly error?: Error;
}

export type WindowsDpapiExecutor = (
  operation: WindowsDpapiOperation,
  valueBase64: string
) => WindowsDpapiExecutionResult;

const WINDOWS_DPAPI_SCRIPT = [
  "$ErrorActionPreference = 'Stop'",
  'Add-Type -AssemblyName System.Security',
  '$request = [Console]::In.ReadToEnd() | ConvertFrom-Json',
  '$inputBytes = [Convert]::FromBase64String([string]$request.value)',
  "if ([string]$request.operation -eq 'protect') {",
  '  $outputBytes = [Security.Cryptography.ProtectedData]::Protect($inputBytes, $null, [Security.Cryptography.DataProtectionScope]::CurrentUser)',
  "} elseif ([string]$request.operation -eq 'unprotect') {",
  '  $outputBytes = [Security.Cryptography.ProtectedData]::Unprotect($inputBytes, $null, [Security.Cryptography.DataProtectionScope]::CurrentUser)',
  '} else {',
  "  throw 'Unsupported DPAPI operation.'",
  '}',
  '[Console]::Out.Write([Convert]::ToBase64String($outputBytes))'
].join('; ');

const WINDOWS_DPAPI_ENCODED_COMMAND = Buffer.from(WINDOWS_DPAPI_SCRIPT, 'utf16le').toString('base64');

const executeWindowsDpapi: WindowsDpapiExecutor = (operation, valueBase64) => {
  const result = spawnSync(
    'powershell.exe',
    ['-NoLogo', '-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-EncodedCommand', WINDOWS_DPAPI_ENCODED_COMMAND],
    {
      input: JSON.stringify({ operation, value: valueBase64 }),
      encoding: 'utf8',
      windowsHide: true,
      timeout: 15_000,
      maxBuffer: 1024 * 1024
    }
  );
  return {
    status: result.status,
    stdout: result.stdout ?? '',
    stderr: result.stderr ?? '',
    ...(result.error ? { error: result.error } : {})
  };
};

const assertCanonicalBase64 = (value: string, label: string): void => {
  if (!/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/u.test(value)) {
    throw new Error(`${label} biçimi geçersiz.`);
  }
};

export class WindowsDpapiDeviceSecretProtector implements DeviceSecretProtector {
  public readonly protectionId = WINDOWS_DPAPI_PROTECTION_ID;
  public readonly required: boolean;
  private readonly executor: WindowsDpapiExecutor;
  private readonly platform: NodeJS.Platform;
  private availability: boolean | undefined;

  public constructor(options: {
    readonly required: boolean;
    readonly executor?: WindowsDpapiExecutor;
    readonly platform?: NodeJS.Platform;
  }) {
    this.required = options.required;
    this.executor = options.executor ?? executeWindowsDpapi;
    this.platform = options.platform ?? process.platform;
  }

  private invoke(operation: WindowsDpapiOperation, valueBase64: string): string {
    assertCanonicalBase64(valueBase64, 'DPAPI girdisi');
    const result = this.executor(operation, valueBase64);
    const output = result.stdout.trim();
    if (result.error || result.status !== 0 || output === '') {
      throw new Error(`Windows CurrentUser DPAPI işlemi başarısız oldu (exit=${String(result.status)}).`);
    }
    assertCanonicalBase64(output, 'DPAPI çıktısı');
    return output;
  }

  public isAvailable(): boolean {
    if (this.availability !== undefined) return this.availability;
    if (this.platform !== 'win32') return false;
    try {
      const marker = Buffer.from('ppt-build227-dpapi-availability', 'utf8').toString('base64');
      const protectedMarker = this.invoke('protect', marker);
      this.availability = this.invoke('unprotect', protectedMarker) === marker;
    } catch {
      this.availability = false;
    }
    return this.availability;
  }

  public protect(secret: string): string {
    if (!this.isAvailable()) throw new Error('Windows CurrentUser DPAPI koruması kullanılamıyor.');
    return this.invoke('protect', Buffer.from(secret, 'utf8').toString('base64'));
  }

  public unprotect(protectedBase64: string): string {
    if (!this.isAvailable()) throw new Error('Windows CurrentUser DPAPI koruması kullanılamıyor.');
    assertCanonicalBase64(protectedBase64, 'Şifreli cihaz sırrı');
    return Buffer.from(this.invoke('unprotect', protectedBase64), 'base64').toString('utf8');
  }
}

export interface ElectronSafeStorageLike {
  isEncryptionAvailable(): boolean;
  encryptString(plainText: string): Buffer;
  decryptString(encrypted: Buffer): string;
  getSelectedStorageBackend?(): string;
}

export class ElectronSafeStorageDeviceSecretProtector implements DeviceSecretProtector {
  public readonly protectionId = 'electron-safe-storage-v1';
  private readonly safeStorage: ElectronSafeStorageLike;
  public readonly required: boolean;

  public constructor(safeStorage: ElectronSafeStorageLike, required: boolean) {
    this.safeStorage = safeStorage;
    this.required = required;
  }

  public isAvailable(): boolean {
    try {
      if (!this.safeStorage.isEncryptionAvailable()) return false;
      const backend = this.safeStorage.getSelectedStorageBackend?.();
      return backend !== 'basic_text';
    } catch {
      return false;
    }
  }

  public protect(secret: string): string {
    if (!this.isAvailable()) {
      throw new Error('İşletim sistemi cihaz sırrı koruması kullanılamıyor.');
    }
    return this.safeStorage.encryptString(secret).toString('base64');
  }

  public unprotect(protectedBase64: string): string {
    if (!this.isAvailable()) {
      throw new Error('İşletim sistemi cihaz sırrı koruması kullanılamıyor.');
    }
    if (!/^[A-Za-z0-9+/]+={0,2}$/u.test(protectedBase64) || protectedBase64.length % 4 !== 0) {
      throw new Error('Şifreli cihaz sırrı biçimi geçersiz.');
    }
    return this.safeStorage.decryptString(Buffer.from(protectedBase64, 'base64'));
  }
}

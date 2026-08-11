import { execFile } from 'node:child_process';
import { createHash } from 'node:crypto';
import { promisify } from 'node:util';
import type {
  WindowsHelloPlatformAssessment,
  WindowsHelloPlatformPort,
  WindowsHelloPlatformVerification
} from '@ppt/application';
import type { WindowsHelloAvailability, WindowsHelloPromptOutcome } from '@ppt/domain';

const execFileAsync = promisify(execFile);
const principalHashPattern = /^[a-f0-9]{64}$/u;
const windowHandlePattern = /^[1-9][0-9]{0,19}$/u;
const trustedPowerShellPath = 'C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe';

export interface WindowsHelloWindowHandleProvider {
  current(): string | null;
}

const interopSource = String.raw`
using System;
using System.Runtime.InteropServices;
using System.Runtime.InteropServices.WindowsRuntime;

[ComImport]
[Guid("39E050C3-4E74-441A-8DC0-B81104DF949C")]
[InterfaceType(ComInterfaceType.InterfaceIsIInspectable)]
public interface IPptUserConsentVerifierInterop
{
    [return: MarshalAs(UnmanagedType.Interface)]
    object RequestVerificationForWindowAsync(
        IntPtr appWindow,
        [MarshalAs(UnmanagedType.HString)] string message,
        [In] ref Guid riid);
}

public static class PptUserConsentVerifierFactory
{
    public static object GetActivationFactory(Type runtimeType)
    {
        return WindowsRuntimeMarshal.GetActivationFactory(runtimeType);
    }
}
`;
const interopSourceBytes = Buffer.from(interopSource, 'utf8');
const interopSourcePayload = interopSourceBytes.toString('base64');
const interopSourceSha256 = createHash('sha256').update(interopSourceBytes).digest('hex');

const nativeScript = String.raw`
$ErrorActionPreference='Stop'
Add-Type -AssemblyName System.Runtime.WindowsRuntime

function Get-PrincipalHash {
  $sid=[System.Security.Principal.WindowsIdentity]::GetCurrent().User.Value
  $sha=[System.Security.Cryptography.SHA256]::Create()
  try {
    $bytes=[System.Text.Encoding]::UTF8.GetBytes($sid)
    return ([System.BitConverter]::ToString($sha.ComputeHash($bytes))).Replace('-','').ToLowerInvariant()
  } finally {
    $sha.Dispose()
  }
}

function Await-WinRtOperation([object]$operation,[type]$resultType) {
  $method=[System.WindowsRuntimeSystemExtensions].GetMethods() |
    Where-Object {
      $_.Name -eq 'AsTask' -and
      $_.IsGenericMethod -and
      $_.GetParameters().Count -eq 1 -and
      $_.GetParameters()[0].ParameterType.Name -like 'IAsyncOperation*'
    } |
    Select-Object -First 1
  if($null -eq $method){throw 'WinRT AsTask bridge is unavailable.'}
  $task=$method.MakeGenericMethod($resultType).Invoke($null,@($operation))
  $task.GetAwaiter().GetResult()
}

function Write-Result([hashtable]$value) {
  [Console]::Out.WriteLine(($value | ConvertTo-Json -Compress -Depth 4))
}

try {
  $principalHash=Get-PrincipalHash
  $mode=$env:PPT_WINDOWS_HELLO_MODE
  if($mode -eq 'availability') {
    $operation=[Windows.Security.Credentials.UI.UserConsentVerifier,Windows.Security.Credentials.UI,ContentType=WindowsRuntime]::CheckAvailabilityAsync()
    $native=Await-WinRtOperation $operation ([Windows.Security.Credentials.UI.UserConsentVerifierAvailability,Windows.Security.Credentials.UI,ContentType=WindowsRuntime])
    Write-Result @{nativeResult=$native.ToString();principalHash=$principalHash}
    exit 0
  }
  if($mode -eq 'verify') {
    $promptBytes=[Convert]::FromBase64String($env:PPT_WINDOWS_HELLO_PROMPT_B64)
    $prompt=[Text.Encoding]::UTF8.GetString($promptBytes)
    if([string]::IsNullOrWhiteSpace($prompt) -or $prompt.Length -gt 200){throw 'Invalid verification prompt.'}
    [UInt64]$windowHandleValue=0
    if((-not [UInt64]::TryParse($env:PPT_WINDOWS_HELLO_HWND,[ref]$windowHandleValue)) -or $windowHandleValue -eq 0 -or $windowHandleValue -gt [UInt64][Int64]::MaxValue){throw 'A valid owner window handle is required.'}
    $windowHandle=[IntPtr]([Int64]$windowHandleValue)
    $interopBytes=[Convert]::FromBase64String($env:PPT_WINDOWS_HELLO_INTEROP_B64)
    if($interopBytes.Length -ne ${interopSourceBytes.length}){throw 'Windows Hello interop payload length check failed.'}
    $interopSha=[Security.Cryptography.SHA256]::Create()
    try {
      $interopActual=([BitConverter]::ToString($interopSha.ComputeHash($interopBytes))).Replace('-','').ToLowerInvariant()
    } finally {
      $interopSha.Dispose()
    }
    if($interopActual -ne '${interopSourceSha256}'){throw 'Windows Hello interop payload integrity check failed.'}
    $interopSource=[Text.Encoding]::UTF8.GetString($interopBytes)
    $runtimeAssembly=[System.Runtime.InteropServices.WindowsRuntime.WindowsRuntimeMarshal].Assembly.Location
    Add-Type -TypeDefinition $interopSource -Language CSharp -ReferencedAssemblies $runtimeAssembly -ErrorAction Stop
    $verifierType=[Type]::GetType('Windows.Security.Credentials.UI.UserConsentVerifier, Windows.Security.Credentials.UI, ContentType=WindowsRuntime',$true)
    $resultType=[Type]::GetType('Windows.Security.Credentials.UI.UserConsentVerificationResult, Windows.Security.Credentials.UI, ContentType=WindowsRuntime',$true)
    $asyncOpenTypeName='Windows.Foundation.IAsyncOperation'+[char]96+'1, Windows.Foundation, ContentType=WindowsRuntime'
    $asyncOpenType=[Type]::GetType($asyncOpenTypeName,$true)
    $asyncType=$asyncOpenType.MakeGenericType($resultType)
    $asyncInterfaceId=$asyncType.GUID
    $factory=[PptUserConsentVerifierFactory]::GetActivationFactory($verifierType)
    $factoryPointer=[Runtime.InteropServices.Marshal]::GetIUnknownForObject($factory)
    try {
      $interop=[Runtime.InteropServices.Marshal]::GetTypedObjectForIUnknown($factoryPointer,[IPptUserConsentVerifierInterop])
      $operation=$interop.RequestVerificationForWindowAsync($windowHandle,$prompt,[ref]$asyncInterfaceId)
      $native=Await-WinRtOperation $operation $resultType
    } finally {
      [void][Runtime.InteropServices.Marshal]::Release($factoryPointer)
    }
    Write-Result @{nativeResult=$native.ToString();principalHash=$principalHash}
    exit 0
  }
  throw 'Unknown Windows Hello mode.'
} catch {
  Write-Result @{nativeResult='Error';diagnosticCode='native_exception';message=$_.Exception.GetType().FullName}
  exit 0
}
`;

const encodedNativeScript = Buffer.from(nativeScript, 'utf16le').toString('base64');

interface NativeResult {
  readonly nativeResult: string;
  readonly principalHash?: string;
  readonly diagnosticCode?: string;
}

const parseNativeResult = (stdout: string): NativeResult => {
  if (Buffer.byteLength(stdout, 'utf8') > 64 * 1024) throw new Error('Windows Hello output limit exceeded.');
  const lines = stdout.trim().split(/\r?\n/u).filter(Boolean);
  if (lines.length !== 1) throw new Error('Windows Hello returned an invalid output envelope.');
  const parsed: unknown = JSON.parse(lines[0]!);
  if (!parsed || typeof parsed !== 'object') throw new Error('Windows Hello returned non-object JSON.');
  const record = parsed as Record<string, unknown>;
  if (typeof record.nativeResult !== 'string') throw new Error('Windows Hello result is missing.');
  return {
    nativeResult: record.nativeResult,
    ...(typeof record.principalHash === 'string' ? { principalHash: record.principalHash } : {}),
    ...(typeof record.diagnosticCode === 'string' ? { diagnosticCode: record.diagnosticCode } : {})
  };
};

const availabilityMap: Readonly<Record<string, WindowsHelloAvailability>> = {
  Available: 'available',
  DeviceNotPresent: 'device_not_present',
  NotConfiguredForUser: 'not_configured_for_user',
  DisabledByPolicy: 'disabled_by_policy',
  DeviceBusy: 'device_busy',
  Error: 'error'
};

const verificationMap: Readonly<Record<string, WindowsHelloPromptOutcome>> = {
  Verified: 'verified',
  Canceled: 'cancelled',
  RetriesExhausted: 'retries_exhausted',
  DeviceNotPresent: 'device_not_present',
  NotConfiguredForUser: 'not_configured_for_user',
  DisabledByPolicy: 'disabled_by_policy',
  DeviceBusy: 'device_busy',
  Error: 'error'
};

export class PowerShellWindowsHelloPlatformAdapter implements WindowsHelloPlatformPort {
  public constructor(
    private readonly windowHandleProvider?: WindowsHelloWindowHandleProvider
  ) {}

  private async run(
    mode: 'availability' | 'verify',
    prompt?: string,
    windowHandle?: string
  ): Promise<NativeResult> {
    if (process.platform !== 'win32') {
      return { nativeResult: 'PlatformNotSupported', diagnosticCode: 'non_windows_platform' };
    }
    try {
      const result = await execFileAsync(trustedPowerShellPath, [
        '-NoProfile',
        '-NonInteractive',
        '-ExecutionPolicy',
        'Bypass',
        '-EncodedCommand',
        encodedNativeScript
      ], {
        timeout: 30_000,
        maxBuffer: 64 * 1024,
        windowsHide: true,
        env: {
          ...process.env,
          PPT_WINDOWS_HELLO_MODE: mode,
          ...(mode === 'verify'
            ? { PPT_WINDOWS_HELLO_INTEROP_B64: interopSourcePayload }
            : {}),
          ...(prompt
            ? { PPT_WINDOWS_HELLO_PROMPT_B64: Buffer.from(prompt, 'utf8').toString('base64') }
            : {}),
          ...(windowHandle ? { PPT_WINDOWS_HELLO_HWND: windowHandle } : {})
        }
      });
      const parsed = parseNativeResult(result.stdout);
      if (result.stderr.trim().length > 0 && parsed.nativeResult === 'Error' && !parsed.diagnosticCode) {
        return { ...parsed, diagnosticCode: 'native_stderr' };
      }
      return parsed;
    } catch (error) {
      const details = error && typeof error === 'object'
        ? error as { readonly killed?: unknown; readonly code?: unknown; readonly signal?: unknown }
        : {};
      const terminated = details.killed === true
        || details.code === 'ETIMEDOUT'
        || (typeof details.signal === 'string' && details.signal.length > 0);
      const code = terminated ? 'native_timeout_or_termination' : 'native_process_failure';
      return { nativeResult: 'Error', diagnosticCode: code };
    }
  }

  public async assessAvailability(): Promise<WindowsHelloPlatformAssessment> {
    const native = await this.run('availability');
    const availability = native.nativeResult === 'PlatformNotSupported'
      ? 'platform_not_supported'
      : availabilityMap[native.nativeResult] ?? 'error';
    return {
      availability,
      ...(native.principalHash && principalHashPattern.test(native.principalHash)
        ? { windowsPrincipalHash: native.principalHash }
        : {}),
      ...(native.diagnosticCode
        ? { diagnosticCode: native.diagnosticCode }
        : availability === 'error' ? { diagnosticCode: 'unknown_native_availability_result' } : {})
    };
  }

  public async requestVerification(message: string): Promise<WindowsHelloPlatformVerification> {
    if (message.length < 1 || message.length > 200) {
      return { outcome: 'error', diagnosticCode: 'invalid_prompt' };
    }
    let windowHandle: string | null;
    try {
      windowHandle = this.windowHandleProvider?.current() ?? null;
    } catch {
      return { outcome: 'error', diagnosticCode: 'window_handle_unavailable' };
    }
    if (!windowHandle || !windowHandlePattern.test(windowHandle)) {
      return { outcome: 'error', diagnosticCode: 'window_handle_unavailable' };
    }
    const native = await this.run('verify', message, windowHandle);
    const outcome = native.nativeResult === 'PlatformNotSupported'
      ? 'platform_not_supported'
      : verificationMap[native.nativeResult] ?? 'error';
    return {
      outcome,
      ...(native.principalHash && principalHashPattern.test(native.principalHash)
        ? { windowsPrincipalHash: native.principalHash }
        : {}),
      ...(native.diagnosticCode
        ? { diagnosticCode: native.diagnosticCode }
        : outcome === 'error' ? { diagnosticCode: 'unknown_native_verification_result' } : {})
    };
  }
}

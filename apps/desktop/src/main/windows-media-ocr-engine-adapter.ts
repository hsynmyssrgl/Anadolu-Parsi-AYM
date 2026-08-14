import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import {
  LOCAL_OCR_MAX_INPUT_BYTES,
  LocalOcrSecurityError,
  bindLocalOcrPageInspection,
  inspectLocalOcrSource,
  type BoundedLocalOcrSource,
  type InspectedLocalOcrSource,
  type LocalOcrPageInspection
} from '@ppt/security';
import type {
  LocalOcrEngineDescriptor,
  LocalOcrEnginePort,
  LocalOcrWorkerQuotas
} from './local-ocr-engine-adapter.js';

const POWERSHELL_SCRIPT = String.raw`
$ErrorActionPreference='Stop'
$ProgressPreference='SilentlyContinue'
Set-StrictMode -Version Latest

try {
  Add-Type -TypeDefinition @'
using System;
using System.ComponentModel;
using System.Diagnostics;
using System.Runtime.InteropServices;

public static class PptOcrJobLimit {
  [StructLayout(LayoutKind.Sequential)]
  private struct JOBOBJECT_BASIC_LIMIT_INFORMATION {
    public long PerProcessUserTimeLimit;
    public long PerJobUserTimeLimit;
    public uint LimitFlags;
    public UIntPtr MinimumWorkingSetSize;
    public UIntPtr MaximumWorkingSetSize;
    public uint ActiveProcessLimit;
    public UIntPtr Affinity;
    public uint PriorityClass;
    public uint SchedulingClass;
  }
  [StructLayout(LayoutKind.Sequential)]
  private struct IO_COUNTERS {
    public ulong ReadOperationCount;
    public ulong WriteOperationCount;
    public ulong OtherOperationCount;
    public ulong ReadTransferCount;
    public ulong WriteTransferCount;
    public ulong OtherTransferCount;
  }
  [StructLayout(LayoutKind.Sequential)]
  private struct JOBOBJECT_EXTENDED_LIMIT_INFORMATION {
    public JOBOBJECT_BASIC_LIMIT_INFORMATION BasicLimitInformation;
    public IO_COUNTERS IoInfo;
    public UIntPtr ProcessMemoryLimit;
    public UIntPtr JobMemoryLimit;
    public UIntPtr PeakProcessMemoryUsed;
    public UIntPtr PeakJobMemoryUsed;
  }
  [DllImport("kernel32.dll", CharSet = CharSet.Unicode, SetLastError = true)]
  private static extern IntPtr CreateJobObject(IntPtr attributes, string name);
  [DllImport("kernel32.dll", SetLastError = true)]
  private static extern bool SetInformationJobObject(IntPtr job, int infoClass, IntPtr info, uint length);
  [DllImport("kernel32.dll", SetLastError = true)]
  private static extern bool AssignProcessToJobObject(IntPtr job, IntPtr process);

  private static IntPtr jobHandle = IntPtr.Zero;
  public static void Apply(long bytes, long cpuTime100ns) {
    if (bytes < 134217728L || bytes > 402653184L) throw new ArgumentOutOfRangeException("bytes");
    if (cpuTime100ns < 1000000L || cpuTime100ns > 300000000L) throw new ArgumentOutOfRangeException("cpuTime100ns");
    jobHandle = CreateJobObject(IntPtr.Zero, null);
    if (jobHandle == IntPtr.Zero) throw new Win32Exception(Marshal.GetLastWin32Error());
    var info = new JOBOBJECT_EXTENDED_LIMIT_INFORMATION();
    info.BasicLimitInformation.LimitFlags = 0x00000004U | 0x00000008U | 0x00000100U | 0x00000200U | 0x00002000U;
    info.BasicLimitInformation.PerJobUserTimeLimit = cpuTime100ns;
    info.BasicLimitInformation.ActiveProcessLimit = 4U;
    info.ProcessMemoryLimit = (UIntPtr)(ulong)bytes;
    info.JobMemoryLimit = (UIntPtr)(ulong)bytes;
    int length = Marshal.SizeOf(typeof(JOBOBJECT_EXTENDED_LIMIT_INFORMATION));
    IntPtr pointer = Marshal.AllocHGlobal(length);
    try {
      Marshal.StructureToPtr(info, pointer, false);
      if (!SetInformationJobObject(jobHandle, 9, pointer, (uint)length)) throw new Win32Exception(Marshal.GetLastWin32Error());
      if (!AssignProcessToJobObject(jobHandle, Process.GetCurrentProcess().Handle)) throw new Win32Exception(Marshal.GetLastWin32Error());
    } finally { Marshal.FreeHGlobal(pointer); }
  }
}
'@

  $memoryMiB=0
  $timeoutMs=0
  $outputLimit=0
  if (-not [int]::TryParse($env:PPT_OCR_MEMORY_MIB,[ref]$memoryMiB) -or $memoryMiB -lt 128 -or $memoryMiB -gt 384) { throw 'quota' }
  if (-not [int]::TryParse($env:PPT_OCR_TIMEOUT_MS,[ref]$timeoutMs) -or $timeoutMs -lt 100 -or $timeoutMs -gt 30000) { throw 'quota' }
  if (-not [int]::TryParse($env:PPT_OCR_OUTPUT_BYTES,[ref]$outputLimit) -or $outputLimit -lt 4096 -or $outputLimit -gt 1048576) { throw 'quota' }
  if ($env:PPT_OCR_MEDIA_TYPE -ne 'image/png' -and $env:PPT_OCR_MEDIA_TYPE -ne 'image/jpeg') { throw 'media' }
  if ($env:PPT_OCR_INPUT_SHA256 -notmatch '^[0-9a-f]{64}$') { throw 'hash' }
  [PptOcrJobLimit]::Apply([long]$memoryMiB * 1048576L,[long]$timeoutMs * 10000L)

  Add-Type -AssemblyName System.Runtime.WindowsRuntime
  $generic=([System.WindowsRuntimeSystemExtensions].GetMethods() | Where-Object {
    $_.Name -eq 'AsTask' -and $_.IsGenericMethod -and $_.GetParameters().Count -eq 1
  } | Select-Object -First 1)
  function Await-Result($operation,[Type]$resultType) {
    $task=$generic.MakeGenericMethod($resultType).Invoke($null,@($operation))
    return $task.GetAwaiter().GetResult()
  }

  $inputStream=[Console]::OpenStandardInput()
  $memory=[IO.MemoryStream]::new()
  $buffer=New-Object byte[] 65536
  $total=0
  while (($read=$inputStream.Read($buffer,0,$buffer.Length)) -gt 0) {
    $total += $read
    if ($total -gt ${LOCAL_OCR_MAX_INPUT_BYTES}) { throw 'size' }
    $memory.Write($buffer,0,$read)
  }
  $bytes=$memory.ToArray()
  [Array]::Clear($buffer,0,$buffer.Length)
  $memory.Dispose()
  if ($bytes.Length -lt 12) { throw 'size' }

  $hasher=[Security.Cryptography.SHA256]::Create()
  try { $observedHash=([BitConverter]::ToString($hasher.ComputeHash($bytes))).Replace('-','').ToLowerInvariant() }
  finally { $hasher.Dispose() }
  if ($observedHash -ne $env:PPT_OCR_INPUT_SHA256) { throw 'hash' }

  $stream=[Windows.Storage.Streams.InMemoryRandomAccessStream,Windows.Foundation,ContentType=WindowsRuntime]::new()
  $writer=[Windows.Storage.Streams.DataWriter,Windows.Foundation,ContentType=WindowsRuntime]::new($stream.GetOutputStreamAt(0))
  $bitmap=$null
  try {
    $writer.WriteBytes($bytes)
    [void](Await-Result ($writer.StoreAsync()) ([UInt32]))
    [void](Await-Result ($writer.FlushAsync()) ([Boolean]))
    $writer.DetachStream() | Out-Null
    $writer.Dispose()
    $writer=$null
    $stream.Seek(0)

    $decoder=Await-Result ([Windows.Graphics.Imaging.BitmapDecoder,Windows.Foundation,ContentType=WindowsRuntime]::CreateAsync($stream)) ([Windows.Graphics.Imaging.BitmapDecoder,Windows.Foundation,ContentType=WindowsRuntime])
    $bitmap=Await-Result ($decoder.GetSoftwareBitmapAsync()) ([Windows.Graphics.Imaging.SoftwareBitmap,Windows.Foundation,ContentType=WindowsRuntime])
    $width=[int]$bitmap.PixelWidth
    $height=[int]$bitmap.PixelHeight
    if ($width -lt 1 -or $height -lt 1 -or $width -gt 10000 -or $height -gt 10000 -or ([long]$width * [long]$height) -gt 40000000L) { throw 'dimension' }
    if ($width -gt [Windows.Media.Ocr.OcrEngine,Windows.Foundation,ContentType=WindowsRuntime]::MaxImageDimension -or $height -gt [Windows.Media.Ocr.OcrEngine,Windows.Foundation,ContentType=WindowsRuntime]::MaxImageDimension) { throw 'dimension' }
    $engine=[Windows.Media.Ocr.OcrEngine,Windows.Foundation,ContentType=WindowsRuntime]::TryCreateFromUserProfileLanguages()
    if ($null -eq $engine -or $null -eq $engine.RecognizerLanguage) { throw 'engine' }
    $language=[string]$engine.RecognizerLanguage.LanguageTag
    if ($language -notmatch '^[A-Za-z]{2,3}(-[A-Za-z0-9]{2,8})*$') { throw 'language' }

    $watch=[Diagnostics.Stopwatch]::StartNew()
    $result=Await-Result ($engine.RecognizeAsync($bitmap)) ([Windows.Media.Ocr.OcrResult,Windows.Foundation,ContentType=WindowsRuntime])
    $watch.Stop()
    if ($watch.ElapsedMilliseconds -gt $timeoutMs) { throw 'timeout' }
    if ([string]$result.Text -and ([string]$result.Text).Length -gt 250000) { throw 'output' }
    $layout=New-Object 'System.Collections.Generic.List[object]'
    $lineIndex=0
    foreach ($line in $result.Lines) {
      $wordIndex=0
      foreach ($word in $line.Words) {
        $box=$word.BoundingRect
        $x=[Math]::Max(0.0,[Math]::Min(1.0,[double]$box.X / [double]$width))
        $y=[Math]::Max(0.0,[Math]::Min(1.0,[double]$box.Y / [double]$height))
        $w=[Math]::Max(0.0,[Math]::Min(1.0-$x,[double]$box.Width / [double]$width))
        $h=[Math]::Max(0.0,[Math]::Min(1.0-$y,[double]$box.Height / [double]$height))
        if ($w -gt 0 -and $h -gt 0) {
          if ($layout.Count -ge 5000 -or ([string]$word.Text).Length -gt 4096) { throw 'output' }
          $layout.Add([pscustomobject]@{
            id=('line-{0}-word-{1}' -f $lineIndex,$wordIndex)
            pageNumber=1
            kind='text'
            text=[string]$word.Text
            boundingBox=[pscustomobject]@{
              x=[Math]::Round($x,8); y=[Math]::Round($y,8); width=[Math]::Round($w,8); height=[Math]::Round($h,8)
            }
            confidence=[pscustomobject]@{available=$false;value=$null}
          })
        }
        $wordIndex += 1
      }
      $lineIndex += 1
    }
    $payload=[pscustomobject]@{
      schemaVersion=1
      engineId='windows-media-ocr-v1'
      inputSha256=$observedHash
      mediaType=$env:PPT_OCR_MEDIA_TYPE
      pageCount=1
      text=[string]$result.Text
      confidence=[pscustomobject]@{available=$false;value=$null}
      languages=@([pscustomobject]@{languageTag=$language;confidence=[pscustomobject]@{available=$false;value=$null}})
      layout=$layout.ToArray()
      execution=[pscustomobject]@{
        localOnly=$true
        networkUsed=$false
        cloudUsed=$false
        processSeparated=$true
        lowPrivilegeSandboxVerified=$false
        memoryLimitEnforced=$true
        cpuTimeLimitEnforced=$true
        timeLimitEnforced=$true
        outputLimitEnforced=$true
        durationMs=[int]$watch.ElapsedMilliseconds
        memoryLimitMiB=$memoryMiB
        cpuTimeLimitMs=$timeoutMs
        timeLimitMs=$timeoutMs
        outputLimitBytes=$outputLimit
      }
    }
    $json=$payload | ConvertTo-Json -Compress -Depth 8
    if ([Text.Encoding]::UTF8.GetByteCount($json) -gt $outputLimit) { throw 'output' }
    [Console]::OutputEncoding=[Text.Encoding]::UTF8
    [Console]::Out.WriteLine($json)
  } finally {
    if ($null -ne $bitmap) { $bitmap.Dispose() }
    if ($null -ne $writer) { $writer.Dispose() }
    if ($null -ne $stream) { $stream.Dispose() }
    if ($null -ne $bytes) { [Array]::Clear($bytes,0,$bytes.Length) }
  }
} catch {
  [Console]::Error.WriteLine('OCR_ENGINE_FAILURE')
  exit 1
}
`;

const ENCODED_SCRIPT = Buffer.from(POWERSHELL_SCRIPT, 'utf16le').toString('base64');
const POWERSHELL_ARGUMENTS = Object.freeze([
  '-NoLogo', '-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-EncodedCommand', ENCODED_SCRIPT
]);

const revalidateSource = (source: InspectedLocalOcrSource): InspectedLocalOcrSource => inspectLocalOcrSource({
  fileName: source.fileName,
  mediaType: source.mediaType,
  bytes: source.bytes,
  expectedSha256: source.sha256
});

const minimalWindowsEnvironment = (input: {
  readonly mediaType: string;
  readonly sha256: string;
  readonly quotas: LocalOcrWorkerQuotas;
}): NodeJS.ProcessEnv => Object.freeze({
  SystemRoot: process.env.SystemRoot ?? 'C:\\Windows',
  WINDIR: process.env.WINDIR ?? process.env.SystemRoot ?? 'C:\\Windows',
  TEMP: process.env.TEMP,
  TMP: process.env.TMP,
  PPT_OCR_MEDIA_TYPE: input.mediaType,
  PPT_OCR_INPUT_SHA256: input.sha256,
  PPT_OCR_MEMORY_MIB: String(input.quotas.memoryLimitMiB),
  PPT_OCR_TIMEOUT_MS: String(input.quotas.timeoutMs),
  PPT_OCR_OUTPUT_BYTES: String(input.quotas.outputLimitBytes)
});

const terminateTree = (child: ChildProcessWithoutNullStreams, systemRoot: string): void => {
  if (child.pid === undefined || child.killed) return;
  child.kill();
  const taskkill = join(systemRoot, 'System32', 'taskkill.exe');
  if (!existsSync(taskkill)) return;
  const killer = spawn(taskkill, ['/PID', String(child.pid), '/T', '/F'], {
    windowsHide: true,
    stdio: 'ignore',
    env: { SystemRoot: systemRoot, WINDIR: systemRoot }
  });
  killer.unref();
};

export class WindowsMediaOcrEngineAdapter implements LocalOcrEnginePort {
  readonly #systemRoot: string;
  readonly #powershellPath: string;
  readonly #configured: boolean;
  #active = false;

  public constructor() {
    this.#systemRoot = process.env.SystemRoot ?? 'C:\\Windows';
    this.#powershellPath = join(this.#systemRoot, 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe');
    this.#configured = process.platform === 'win32' && existsSync(this.#powershellPath);
  }

  public descriptor(): LocalOcrEngineDescriptor {
    return Object.freeze({
      configured: this.#configured,
      engineId: 'windows-media-ocr-v1',
      provider: this.#configured ? 'windows_media_ocr' : 'not_configured',
      executionBoundary: this.#configured ? 'bounded-child-process' : 'none',
      localOnly: true,
      networkAccess: false,
      cloudProcessing: false,
      inputTransferredByPath: false,
      temporaryPlaintextCreated: false,
      processSeparated: this.#configured,
      lowPrivilegeSandboxVerified: false,
      resourceLimitsEnforcedPerJob: this.#configured,
      supportedMediaTypes: this.#configured ? Object.freeze(['image/png', 'image/jpeg'] as const) : Object.freeze([]),
      confidenceAvailable: false
    });
  }

  public async inspect(source: InspectedLocalOcrSource, signal: AbortSignal): Promise<LocalOcrPageInspection> {
    if (!this.#configured) throw new LocalOcrSecurityError('NOT_CONFIGURED');
    if (signal.aborted) throw new LocalOcrSecurityError('CANCELLED');
    const verified = revalidateSource(source);
    try {
      if (verified.mediaType !== 'image/png' && verified.mediaType !== 'image/jpeg') {
        throw new LocalOcrSecurityError('UNSUPPORTED_MEDIA');
      }
      return Object.freeze({ inputSha256: verified.sha256, pageCount: 1, encrypted: false });
    } finally {
      verified.bytes.fill(0);
    }
  }

  public async recognize(
    source: BoundedLocalOcrSource,
    quotas: LocalOcrWorkerQuotas,
    signal: AbortSignal
  ): Promise<unknown> {
    if (!this.#configured) throw new LocalOcrSecurityError('NOT_CONFIGURED');
    if (source.pageCount !== 1 || signal.aborted) throw new LocalOcrSecurityError(signal.aborted ? 'CANCELLED' : 'INPUT_INVALID');
    if (!Number.isInteger(quotas.timeoutMs) || quotas.timeoutMs < 100 || quotas.timeoutMs > 30_000
      || !Number.isInteger(quotas.memoryLimitMiB) || quotas.memoryLimitMiB < 128 || quotas.memoryLimitMiB > 384
      || !Number.isInteger(quotas.outputLimitBytes) || quotas.outputLimitBytes < 4_096 || quotas.outputLimitBytes > 1024 * 1024) {
      throw new LocalOcrSecurityError('INPUT_INVALID');
    }
    if (this.#active) throw new LocalOcrSecurityError('CAPACITY_EXCEEDED');
    this.#active = true;
    let verified: InspectedLocalOcrSource | undefined;
    try {
      verified = revalidateSource(source);
      if (verified.mediaType !== 'image/png' && verified.mediaType !== 'image/jpeg') {
        throw new LocalOcrSecurityError('UNSUPPORTED_MEDIA');
      }
      const bounded = bindLocalOcrPageInspection(verified, {
        inputSha256: verified.sha256,
        pageCount: source.pageCount,
        encrypted: false
      });
      return await this.#execute(bounded, quotas, signal);
    } finally {
      verified?.bytes.fill(0);
      this.#active = false;
    }
  }

  async #execute(source: BoundedLocalOcrSource, quotas: LocalOcrWorkerQuotas, signal: AbortSignal): Promise<unknown> {
    const environment = minimalWindowsEnvironment({ mediaType: source.mediaType, sha256: source.sha256, quotas });
    return new Promise((resolvePromise, rejectPromise) => {
      const child = spawn(this.#powershellPath, POWERSHELL_ARGUMENTS, {
        windowsHide: true,
        stdio: ['pipe', 'pipe', 'pipe'],
        env: environment
      });
      const stdout: Buffer[] = [];
      let stdoutBytes = 0;
      let stderrBytes = 0;
      let settled = false;
      let forcedFailure: LocalOcrSecurityError | undefined;
      const clearOutput = (): void => { stdout.forEach((chunk) => chunk.fill(0)); stdout.length = 0; };
      const finish = (error?: LocalOcrSecurityError, value?: unknown): void => {
        if (settled) return;
        settled = true;
        clearTimeout(timeout);
        signal.removeEventListener('abort', cancel);
        if (error) rejectPromise(error); else resolvePromise(value);
      };
      const stop = (error: LocalOcrSecurityError): void => {
        forcedFailure ??= error;
        terminateTree(child, this.#systemRoot);
      };
      const cancel = (): void => stop(new LocalOcrSecurityError('CANCELLED'));
      const timeout = setTimeout(() => stop(new LocalOcrSecurityError('TIMEOUT')), quotas.timeoutMs);
      timeout.unref();
      signal.addEventListener('abort', cancel, { once: true });
      if (signal.aborted) cancel();
      child.stdout.on('data', (chunk: Buffer) => {
        stdoutBytes += chunk.length;
        if (stdoutBytes > quotas.outputLimitBytes) stop(new LocalOcrSecurityError('OUTPUT_LIMIT_EXCEEDED'));
        else stdout.push(Buffer.from(chunk));
      });
      child.stderr.on('data', (chunk: Buffer) => {
        stderrBytes += chunk.length;
        if (stderrBytes > 4_096) stop(new LocalOcrSecurityError('ENGINE_FAILURE'));
      });
      child.stdin.on('error', () => { if (!forcedFailure) stop(new LocalOcrSecurityError('ENGINE_FAILURE')); });
      child.on('error', () => {
        clearOutput();
        finish(forcedFailure ?? new LocalOcrSecurityError('ENGINE_FAILURE'));
      });
      child.on('close', (code) => {
        if (forcedFailure) { clearOutput(); finish(forcedFailure); return; }
        if (code !== 0) { clearOutput(); finish(new LocalOcrSecurityError('ENGINE_FAILURE')); return; }
        const output = Buffer.concat(stdout, stdoutBytes);
        try {
          const text = output.toString('utf8').trim();
          if (!text || text.includes('\n') || Buffer.byteLength(text, 'utf8') > quotas.outputLimitBytes) {
            finish(new LocalOcrSecurityError('OUTPUT_LIMIT_EXCEEDED'));
            return;
          }
          finish(undefined, JSON.parse(text) as unknown);
        } catch { finish(new LocalOcrSecurityError('ENGINE_FAILURE')); }
        finally { output.fill(0); clearOutput(); }
      });
      child.stdin.end(source.bytes);
    });
  }
}

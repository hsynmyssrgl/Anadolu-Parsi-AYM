import { spawnSync } from 'node:child_process';
import { existsSync, readdirSync } from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path';

const WINDOWS_EFS_PATH_ENV = 'PPT_WINDOWS_EFS_ATTRIBUTE_PATH';
const EFS_ATTRIBUTE_SCRIPT = [
  `$path = [Environment]::GetEnvironmentVariable('${WINDOWS_EFS_PATH_ENV}', 'Process');`,
  "if ([string]::IsNullOrWhiteSpace($path)) { Write-Error 'EFS attribute path is missing.'; exit 6; }",
  '$item = Get-Item -LiteralPath $path -Force -ErrorAction Stop;',
  "if (($item.Attributes -band [IO.FileAttributes]::Encrypted) -eq 0) { Write-Error 'Path is not EFS encrypted.'; exit 7; }",
  'exit 0;'
].join(' ');
const EFS_ATTRIBUTE_COMMAND = Buffer.from(EFS_ATTRIBUTE_SCRIPT, 'utf16le').toString('base64');

const commandFailure = (
  label: string,
  result: ReturnType<typeof spawnSync>
): Error => new Error([
  `${label} failed`,
  `exit=${String(result.status)}`,
  result.error?.message,
  typeof result.stderr === 'string' ? result.stderr.trim() : undefined,
  typeof result.stdout === 'string' ? result.stdout.trim() : undefined
].filter(Boolean).join(': '));

export const assertWindowsEfsEncrypted = (path: string, label: string): void => {
  if (process.platform !== 'win32') throw new Error(`${label} can be verified only on Windows.`);
  const exactPath = resolve(path);
  if (!existsSync(exactPath)) throw new Error(`${label} does not exist: ${exactPath}`);
  const result = spawnSync(
    'powershell.exe',
    ['-NoLogo', '-NoProfile', '-NonInteractive', '-EncodedCommand', EFS_ATTRIBUTE_COMMAND],
    {
      encoding: 'utf8',
      windowsHide: true,
      timeout: 15_000,
      env: { ...process.env, [WINDOWS_EFS_PATH_ENV]: exactPath }
    }
  );
  if (result.error || result.status !== 0) throw commandFailure(`${label} EFS attribute verification`, result);
};

export const protectWindowsPathWithEfs = (path: string, label: string): void => {
  if (process.platform !== 'win32') throw new Error(`${label} can be protected only on Windows.`);
  const exactPath = resolve(path);
  if (!existsSync(exactPath)) throw new Error(`${label} does not exist before EFS protection: ${exactPath}`);
  const systemRoot = process.env.SystemRoot?.trim() || 'C:\\Windows';
  const cipherPath = join(systemRoot, 'System32', 'cipher.exe');
  const result = spawnSync(cipherPath, ['/E', '/A', '/B', '/H', basename(exactPath)], {
    cwd: dirname(exactPath),
    encoding: 'utf8',
    windowsHide: true,
    timeout: 30_000
  });
  if (result.error || result.status !== 0) throw commandFailure(`${label} cipher /E`, result);
  assertWindowsEfsEncrypted(exactPath, label);
};

export const assertWindowsEfsTreeEncrypted = (root: string, label: string): void => {
  assertWindowsEfsEncrypted(root, `${label} directory`);
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    const path = join(root, entry.name);
    if (entry.isDirectory()) assertWindowsEfsTreeEncrypted(path, `${label}/${entry.name}`);
    else assertWindowsEfsEncrypted(path, `${label}/${entry.name}`);
  }
};

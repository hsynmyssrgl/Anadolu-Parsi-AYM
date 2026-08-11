import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const sourceRoot = resolve(process.argv[2] ?? '.');
const reportPath = resolve(process.argv[3] ?? 'artifacts/validation/build225-open021-efs-contract.json');
const read = (path) => readFile(resolve(sourceRoot, path), 'utf8');
const [probe, session, efs] = await Promise.all([
  read('apps/desktop/src/main/windows-open021-efs-evidence-probe.ts'),
  read('apps/desktop/src/main/volatile-sqlite-session.ts'),
  read('apps/desktop/src/main/windows-efs-protection.ts')
]);
const results = [];
const check = (id, condition) => results.push({ id, status: condition ? 'PASS' : 'FAIL' });
check('positional-args-null-bug-removed', !efs.includes('$args[0]') && !probe.includes('$args[0]'));
check('path-not-concatenated-into-command', efs.includes('PPT_WINDOWS_EFS_ATTRIBUTE_PATH') && efs.includes('[Environment]::GetEnvironmentVariable'));
check('powershell-encoded-command', efs.includes("'-EncodedCommand'") && efs.includes("Buffer.from(EFS_ATTRIBUTE_SCRIPT, 'utf16le')"));
check('literal-path-fail-closed', efs.includes('Get-Item -LiteralPath $path -Force -ErrorAction Stop'));
check('encrypted-attribute-required', efs.includes('[IO.FileAttributes]::Encrypted') && efs.includes('result.status !== 0'));
check('cipher-safe-cwd-and-basename', efs.includes('cwd: dirname(exactPath)') && efs.includes('basename(exactPath)'));
check('cipher-file-and-directory-mode', efs.includes("['/E', '/A', '/B', '/H'"));
check('cipher-success-reverified', efs.includes('assertWindowsEfsEncrypted(exactPath, label)'));
check('staging-directory-protected', session.includes("protectWindowsPathWithEfs(directory, 'Windows EFS staging dizini')"));
check('hydrate-explicitly-protected', session.includes("protectWindowsPathWithEfs(sourcePath, 'Windows EFS hydrate snapshot')"));
check('snapshot-placeholder-created-before-vacuum', session.includes("openSync(snapshotPath, 'wx'") && session.indexOf("openSync(snapshotPath, 'wx'") < session.indexOf('VACUUM main INTO'));
check('snapshot-protected-before-vacuum', session.includes("protectWindowsPathWithEfs(snapshotPath, 'Windows EFS SQLite snapshot placeholder')") && session.indexOf("protectWindowsPathWithEfs(snapshotPath, 'Windows EFS SQLite snapshot placeholder')") < session.indexOf('VACUUM main INTO'));
check('snapshot-reverified-after-vacuum', session.indexOf("assertWindowsEfsEncrypted(snapshotPath, 'Windows EFS SQLite snapshot')") > session.indexOf('VACUUM main INTO'));
check('journal-wal-temp-tree-covered', session.includes('assertWindowsEfsTreeEncrypted(this.stagingDirectory') && probe.includes('assertWindowsEfsTreeEncrypted(dirname(snapshotPath)'));
check('probe-directory-and-snapshot-independent', probe.includes("assertWindowsEfsEncrypted(dirname(snapshotPath), 'OPEN-021 EFS staging directory')") && probe.includes("assertWindowsEfsEncrypted(snapshotPath, 'OPEN-021 EFS SQLite snapshot')"));
check('cleanup-covers-sqlite-journal-wal-shm-temp', probe.includes('journal|wal|shm') && probe.includes('remainingStagingFiles.length > 0'));
check('not-run-cannot-be-pass', !probe.includes("status: 'NOT_RUN'"));
const failures = results.filter((item) => item.status === 'FAIL');
const report = { schemaVersion: 1, build: 225, openWorkId: 'OPEN-021', status: failures.length ? 'FAIL' : 'PASS', checks: results.length, passed: results.length - failures.length, failed: failures.length, results, generatedAt: new Date().toISOString() };
await mkdir(resolve(reportPath, '..'), { recursive: true });
await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`);
console.log(`Build225 OPEN-021 EFS contract: ${report.status} (${report.passed}/${report.checks}).`);
if (failures.length) process.exitCode = 1;

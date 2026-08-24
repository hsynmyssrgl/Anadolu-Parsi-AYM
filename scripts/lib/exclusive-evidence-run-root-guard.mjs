import { randomUUID } from 'node:crypto';
import { spawn } from 'node:child_process';
import { lstat, open, readFile, realpath, unlink } from 'node:fs/promises';
import { isAbsolute, relative, resolve, sep } from 'node:path';

const fail = (message) => { throw new Error(message); };
const check = (condition, message) => { if (!condition) fail(message); };
const samePath = (left, right) => resolve(left).replaceAll('/', '\\').toLowerCase()
  === resolve(right).replaceAll('/', '\\').toLowerCase();

export const assertEvidenceRunRootNoReparse = async ({ runRoot, boundary }) => {
  const boundaryPath = resolve(boundary);
  const runRootPath = resolve(runRoot);
  const local = relative(boundaryPath, runRootPath);
  check(local !== '' && local !== '..' && !local.startsWith(`..${sep}`) && !isAbsolute(local),
    'Evidence run root must be a strict descendant of its canonical category parent.');
  let cursor = boundaryPath;
  for (const segment of ['', ...local.split(/[\\/]/u).filter(Boolean)]) {
    if (segment) cursor = resolve(cursor, segment);
    const item = await lstat(cursor);
    check(item.isDirectory() && !item.isSymbolicLink(), `Evidence run root contains a reparse/non-directory ancestor: ${cursor}`);
    check(samePath(await realpath(cursor), cursor), `Evidence run root realpath drifted: ${cursor}`);
  }
  return runRootPath;
};

const readGuardBytes = async (guardPath, expectedBytes) => {
  const item = await lstat(guardPath);
  check(item.isFile() && !item.isSymbolicLink(), 'Evidence run guard is not a regular non-link file.');
  check(samePath(await realpath(guardPath), guardPath), 'Evidence run guard realpath drifted.');
  const bytes = await readFile(guardPath);
  check(bytes.equals(expectedBytes), 'Evidence run guard readback changed.');
};

const waitForGuardReady = (child) => new Promise((resolveReady, rejectReady) => {
  let output = '';
  const cleanup = () => {
    clearTimeout(timeout);
    child.off('error', onError);
    child.off('exit', onExit);
    child.stdout.off('data', onData);
  };
  const failReady = (error) => { cleanup(); rejectReady(error); };
  const onError = (error) => failReady(error);
  const onExit = (code, signal) => failReady(new Error(`Evidence run guard exited before READY: code=${code ?? 'null'} signal=${signal ?? 'null'}`));
  const onData = (chunk) => {
    output += chunk.toString('utf8');
    if (!output.split(/\r?\n/u).includes('READY')) return;
    cleanup();
    resolveReady(undefined);
  };
  const timeout = setTimeout(() => failReady(new Error('Evidence run guard did not become ready in 10 seconds.')), 10_000);
  child.once('error', onError);
  child.once('exit', onExit);
  child.stdout.on('data', onData);
});

export const acquireExclusiveEvidenceRunRootGuard = async ({
  runRoot,
  boundary,
  guardName = '.ppt-evidence-run.guard',
} = {}) => {
  check(process.platform === 'win32', 'Exclusive evidence run-root guard is Windows-only.');
  check(/^\.[a-z0-9.-]+\.guard$/iu.test(guardName), 'Evidence run guard filename is invalid.');
  const runRootPath = await assertEvidenceRunRootNoReparse({ runRoot, boundary });
  const guardPath = resolve(runRootPath, guardName);
  const guardRecord = Object.freeze({ schemaVersion: 1, id: 'PPT-EXCLUSIVE-EVIDENCE-RUN-ROOT-GUARD-V1',
    nonce: randomUUID(), processId: process.pid, createdAt: new Date().toISOString() });
  const guardBytes = Buffer.from(`${JSON.stringify(guardRecord)}\n`, 'utf8');
  let handle;
  try {
    handle = await open(guardPath, 'wx');
    await handle.writeFile(guardBytes);
    await handle.sync();
  } finally {
    if (handle) await handle.close();
  }
  await readGuardBytes(guardPath, guardBytes);
  const powerShell = [
    "$ErrorActionPreference='Stop'",
    '$stream=[IO.File]::Open($env:PPT_EVIDENCE_RUN_GUARD_PATH,[IO.FileMode]::Open,[IO.FileAccess]::Read,[IO.FileShare]::Read)',
    "try{[Console]::Out.WriteLine('READY');[Console]::Out.Flush();[void][Console]::In.ReadLine()}finally{$stream.Dispose()}",
  ].join(';');
  const child = spawn('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', powerShell], {
    windowsHide: true,
    stdio: ['pipe', 'pipe', 'pipe'],
    env: { ...process.env, PPT_EVIDENCE_RUN_GUARD_PATH: guardPath },
  });
  let childError;
  let childExit;
  const childExited = new Promise((resolveExit) => {
    child.once('error', (error) => { childError = error; });
    child.once('exit', (code, signal) => {
      childExit = Object.freeze({ code, signal });
      resolveExit(childExit);
    });
  });
  const assertGuardProcessAlive = () => {
    check(!childError && !childExit && child.exitCode === null && child.signalCode === null,
      `Evidence run guard process is not alive: code=${childExit?.code ?? child.exitCode ?? 'null'} signal=${childExit?.signal ?? child.signalCode ?? 'null'}.`);
  };
  try {
    await waitForGuardReady(child);
    assertGuardProcessAlive();
    await assertEvidenceRunRootNoReparse({ runRoot: runRootPath, boundary });
    await readGuardBytes(guardPath, guardBytes);
    assertGuardProcessAlive();
  } catch (error) {
    child.kill();
    await unlink(guardPath).catch(() => undefined);
    throw error;
  }
  let closed = false;
  return Object.freeze({
    runRoot: runRootPath,
    guardPath,
    guardProcessId: child.pid,
    async assertIntact() {
      check(!closed, 'Evidence run guard is already closed.');
      assertGuardProcessAlive();
      await assertEvidenceRunRootNoReparse({ runRoot: runRootPath, boundary });
      await readGuardBytes(guardPath, guardBytes);
      assertGuardProcessAlive();
    },
    async close() {
      check(!closed, 'Evidence run guard is already closed.');
      await this.assertIntact();
      child.stdin.end('\n');
      const exit = await childExited;
      check(!childError && exit?.code === 0 && exit.signal === null,
        `Evidence run guard exited unexpectedly during close: code=${exit?.code ?? 'null'} signal=${exit?.signal ?? 'null'}.`);
      await assertEvidenceRunRootNoReparse({ runRoot: runRootPath, boundary });
      await readGuardBytes(guardPath, guardBytes);
      await unlink(guardPath);
      closed = true;
    },
  });
};

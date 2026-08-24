import { existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';

const missingRuntimeOutput = /(?:Python bulunamad|python (?:was )?not found|No Python at)/iu;

export const runPythonScript = (script, args = []) => {
  const explicit = process.env.PPT_PYTHON_EXECUTABLE;
  const bundled = process.env.USERPROFILE
    ? resolve(process.env.USERPROFILE, '.cache/codex-runtimes/codex-primary-runtime/dependencies/python/python.exe')
    : null;
  const candidates = explicit
    ? [[explicit, []]]
    : [
        ...(bundled && existsSync(bundled) ? [[bundled, []]] : []),
        ['python', []],
        ['py', ['-3']]
      ];
  let last = null;
  for (const [executable, prefix] of candidates) {
    const result = spawnSync(executable, [...prefix, script, ...args], {
      cwd: process.cwd(), encoding: 'utf8', windowsHide: true
    });
    last = result;
    const combined = `${result.stdout ?? ''}${result.stderr ?? ''}`;
    if (!result.error && !missingRuntimeOutput.test(combined)) return result;
  }
  throw last?.error ?? new Error('Python runtime could not be started. Set PPT_PYTHON_EXECUTABLE explicitly.');
};

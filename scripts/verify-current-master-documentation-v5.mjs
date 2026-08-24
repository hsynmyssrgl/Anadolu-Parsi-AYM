import { runPythonScript } from './lib/python-runtime.mjs';

const result = runPythonScript('scripts/verify-current-master-documentation-v5.py');
if (result.stdout) process.stdout.write(result.stdout);
if (result.stderr) process.stderr.write(result.stderr);
process.exit(result.status ?? 1);

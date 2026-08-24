import { runPythonScript } from './lib/python-runtime.mjs';

const result = runPythonScript('scripts/generate-current-master-documentation.py');
if (result.stdout) process.stdout.write(result.stdout);
if (result.stderr) process.stderr.write(result.stderr);
process.exit(result.status ?? 1);

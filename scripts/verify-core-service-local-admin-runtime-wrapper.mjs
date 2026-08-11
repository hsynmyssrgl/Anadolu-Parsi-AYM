import { spawnSync } from 'node:child_process';
const result=spawnSync(process.execPath,['--experimental-strip-types','--experimental-loader','./scripts/ts-workspace-loader.mjs','scripts/verify-core-service-local-admin-runtime.mjs'],{encoding:'utf8'});
if(result.stdout)process.stdout.write(result.stdout);if(result.stderr)process.stderr.write(result.stderr);process.exit(result.status??1);

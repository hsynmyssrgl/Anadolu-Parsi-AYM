import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { ELECTRON_FUSE_POLICY } from '../apps/desktop/scripts/electron-fuse-policy.mjs';
import { verifyElectronFuseBinary } from '../apps/desktop/scripts/apply-electron-fuses.mjs';

const root = resolve(import.meta.dirname, '..');
const desktopPackage = JSON.parse(await readFile(resolve(root, 'apps/desktop/package.json'), 'utf8'));
const executableArgument = process.argv[2];
const checks = [];
const check = (condition, message) => {
  if (!condition) throw new Error(message);
  checks.push(message);
};

check(desktopPackage.build?.afterPack === 'scripts/apply-electron-fuses.mjs', 'electron-builder afterPack fuse hook is mandatory');
check(desktopPackage.build?.asar === true, 'application ASAR packaging is mandatory');
check(ELECTRON_FUSE_POLICY.RunAsNode === false, 'RunAsNode is disabled');
check(ELECTRON_FUSE_POLICY.EnableCookieEncryption === true, 'cookie encryption is enabled');
check(ELECTRON_FUSE_POLICY.EnableNodeOptionsEnvironmentVariable === false, 'NODE_OPTIONS is disabled');
check(ELECTRON_FUSE_POLICY.EnableNodeCliInspectArguments === false, 'Node CLI inspect arguments are disabled');
check(ELECTRON_FUSE_POLICY.EnableEmbeddedAsarIntegrityValidation === true, 'embedded ASAR integrity validation is enabled');
check(ELECTRON_FUSE_POLICY.OnlyLoadAppFromAsar === true, 'only ASAR application loading is enabled');
check(ELECTRON_FUSE_POLICY.LoadBrowserProcessSpecificV8Snapshot === false, 'standard packaged V8 snapshot loading is retained');
check(ELECTRON_FUSE_POLICY.GrantFileProtocolExtraPrivileges === false, 'file protocol extra privileges are disabled');
check(ELECTRON_FUSE_POLICY.WasmTrapHandlers === true, 'WebAssembly trap handlers remain enabled with guard-region enforcement');

let binary;
if (executableArgument) binary = await verifyElectronFuseBinary(resolve(executableArgument));

process.stdout.write(`${JSON.stringify({ status: 'PASS', checks: checks.length, policy: ELECTRON_FUSE_POLICY, binary }, null, 2)}\n`);

import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  flipFuses,
  FuseState,
  FuseV1Options,
  FuseVersion,
  getCurrentFuseWire
} from '../../../tools/windows-packager/node_modules/@electron/fuses/dist/index.js';
import { ELECTRON_FUSE_POLICY, ELECTRON_FUSE_POLICY_ID } from './electron-fuse-policy.mjs';
import { repairAndVerifyPackagedAsarIntegrity } from './repair-electron-asar-integrity.mjs';

export const expectedFuseConfiguration = Object.freeze({
  version: FuseVersion.V1,
  strictlyRequireAllFuses: true,
  [FuseV1Options.RunAsNode]: ELECTRON_FUSE_POLICY.RunAsNode,
  [FuseV1Options.EnableCookieEncryption]: ELECTRON_FUSE_POLICY.EnableCookieEncryption,
  [FuseV1Options.EnableNodeOptionsEnvironmentVariable]: ELECTRON_FUSE_POLICY.EnableNodeOptionsEnvironmentVariable,
  [FuseV1Options.EnableNodeCliInspectArguments]: ELECTRON_FUSE_POLICY.EnableNodeCliInspectArguments,
  [FuseV1Options.EnableEmbeddedAsarIntegrityValidation]: ELECTRON_FUSE_POLICY.EnableEmbeddedAsarIntegrityValidation,
  [FuseV1Options.OnlyLoadAppFromAsar]: ELECTRON_FUSE_POLICY.OnlyLoadAppFromAsar,
  [FuseV1Options.LoadBrowserProcessSpecificV8Snapshot]: ELECTRON_FUSE_POLICY.LoadBrowserProcessSpecificV8Snapshot,
  [FuseV1Options.GrantFileProtocolExtraPrivileges]: ELECTRON_FUSE_POLICY.GrantFileProtocolExtraPrivileges,
  [FuseV1Options.WasmTrapHandlers]: ELECTRON_FUSE_POLICY.WasmTrapHandlers
});

export const verifyElectronFuseBinary = async (executablePath) => {
  const current = await getCurrentFuseWire(executablePath);
  const mismatches = Object.entries(ELECTRON_FUSE_POLICY).flatMap(([name, enabled]) => {
    const option = FuseV1Options[name];
    const expected = enabled ? FuseState.ENABLE : FuseState.DISABLE;
    return current[option] === expected ? [] : [{ name, expected, actual: current[option] }];
  });
  if (current.version !== FuseVersion.V1 || mismatches.length > 0) {
    throw new Error(`${ELECTRON_FUSE_POLICY_ID} verification failed: ${JSON.stringify({ version: current.version, mismatches })}`);
  }
  return Object.freeze({ policyId: ELECTRON_FUSE_POLICY_ID, executablePath, version: current.version, fuses: ELECTRON_FUSE_POLICY });
};

export const applyElectronFusePolicy = async (executablePath) => {
  if (!existsSync(executablePath)) throw new Error(`Electron executable not found: ${executablePath}`);
  await flipFuses(executablePath, expectedFuseConfiguration);
  return verifyElectronFuseBinary(executablePath);
};

export default async function applyElectronFusesAfterPack(context) {
  const executablePath = resolve(context.appOutDir, `${context.packager.appInfo.productFilename}.exe`);
  const asarIntegrity = await repairAndVerifyPackagedAsarIntegrity({
    appOutDir: context.appOutDir,
    executableName: `${context.packager.appInfo.productFilename}.exe`
  });
  const result = await applyElectronFusePolicy(executablePath);
  process.stdout.write(`${JSON.stringify({ status: 'PASS', asarIntegrity, ...result })}\n`);
}

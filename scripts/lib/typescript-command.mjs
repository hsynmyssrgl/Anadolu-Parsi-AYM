import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

export const resolveTypeScriptCommand = (root = process.cwd()) => {
  const localCompiler = resolve(root, 'node_modules', 'typescript', 'bin', 'tsc');
  if (existsSync(localCompiler)) {
    return {
      command: process.execPath,
      prefixArgs: [localCompiler],
      display: `${process.execPath} ${localCompiler}`,
      strategy: 'workspace-typescript-node-entrypoint'
    };
  }
  const configured = process.env.TSC_BIN;
  if (configured) {
    return {
      command: configured,
      prefixArgs: [],
      display: configured,
      strategy: 'explicit-tsc-bin'
    };
  }
  return {
    command: 'tsc',
    prefixArgs: [],
    display: 'tsc',
    strategy: 'path-fallback'
  };
};

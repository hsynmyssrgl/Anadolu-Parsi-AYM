import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { execFileSync, spawnSync } from 'node:child_process';
import { join, relative, resolve } from 'node:path';
import { resolveTypeScriptCommand } from './lib/typescript-command.mjs';

const root = process.cwd();
const tempRoot = join(root, '.tmp', 'desktop-main-source-typecheck');
const nodeModules = join(tempRoot, 'node_modules');
const typesRoot = join(tempRoot, 'types');
const evidencePath = join(root, 'artifacts', 'validation', 'desktop-main-source-typecheck.json');
const compiler = resolveTypeScriptCommand(root);

const globalRoot = (() => {
  try {
    return execFileSync('npm', ['root', '-g'], { encoding: 'utf8' }).trim();
  } catch {
    return '';
  }
})();

const firstExisting = (candidates) => candidates.find((candidate) => candidate && existsSync(candidate));
const nodeTypesSource = firstExisting([
  join(root, 'node_modules', '@types', 'node'),
  globalRoot && join(globalRoot, '@types', 'node'),
  globalRoot && join(globalRoot, 'ts-node', 'node_modules', '@types', 'node'),
  globalRoot && join(globalRoot, 'pptxgenjs', 'node_modules', '@types', 'node')
]);
const undiciTypesSource = firstExisting([
  join(root, 'node_modules', 'undici-types'),
  globalRoot && join(globalRoot, 'undici-types'),
  globalRoot && join(globalRoot, 'ts-node', 'node_modules', 'undici-types'),
  globalRoot && join(globalRoot, 'pptxgenjs', 'node_modules', 'undici-types')
]);

if (!nodeTypesSource) {
  throw new Error('Desktop main source typecheck requires @types/node either in the workspace or an installed global toolchain.');
}

await rm(tempRoot, { recursive: true, force: true });
await mkdir(join(nodeModules, '@types'), { recursive: true });
await mkdir(typesRoot, { recursive: true });
await mkdir(join(root, 'artifacts', 'validation'), { recursive: true });
await cp(nodeTypesSource, join(nodeModules, '@types', 'node'), { recursive: true });
if (undiciTypesSource) await cp(undiciTypesSource, join(nodeModules, 'undici-types'), { recursive: true });

const electronStub = `declare module 'electron' {
  export interface WebFrameMain {
    readonly url: string;
  }
  export interface WebContents {
    id: number;
    readonly mainFrame: WebFrameMain;
    setWindowOpenHandler(handler: (details: { url: string }) => { action: 'allow' | 'deny' }): void;
    on(event: string, listener: (...args: any[]) => void): void;
    once(event: string, listener: (...args: any[]) => void): void;
    printToPDF(options?: unknown): Promise<Buffer>;
  }
  export interface IpcMainInvokeEvent { sender: WebContents; senderFrame: WebFrameMain }
  export interface IpcMain {
    handle(channel: string, listener: (event: IpcMainInvokeEvent, ...args: any[]) => any): void;
    removeHandler(channel: string): void;
  }
  export class BrowserWindow {
    public constructor(options?: unknown);
    public readonly webContents: WebContents;
    public static getAllWindows(): BrowserWindow[];
    public once(event: 'ready-to-show' | 'closed', listener: () => void): void;
    public show(): void;
    public focus(): void;
    public isMinimized(): boolean;
    public restore(): void;
    public loadURL(url: string): Promise<void>;
    public loadFile(path: string): Promise<void>;
    public destroy(): void;
  }
  export const app: {
    isPackaged: boolean;
    getPath(name: string): string;
    setPath(name: string, path: string): void;
    disableHardwareAcceleration(): void;
    enableSandbox(): void;
    setAppUserModelId(id: string): void;
    requestSingleInstanceLock(): boolean;
    quit(): void;
    relaunch(options?: unknown): void;
    exit(code?: number): void;
    on(event: string, listener: (...args: any[]) => void): void;
    whenReady(): Promise<void>;
  };
  export const dialog: any;
  export const safeStorage: {
    isEncryptionAvailable(): boolean;
    encryptString(plainText: string): Buffer;
    decryptString(encrypted: Buffer): string;
    getSelectedStorageBackend(): string;
  };
  export const ipcMain: IpcMain;
  export const shell: { openExternal(url: string): Promise<void>; openPath(path: string): Promise<string> };
  export const contextBridge: any;
  export const ipcRenderer: any;
}
`;
await writeFile(join(typesRoot, 'electron.d.ts'), electronStub);

const tsconfig = {
  extends: resolve(root, 'tsconfig.base.json'),
  compilerOptions: {
    module: 'ESNext',
    moduleResolution: 'Bundler',
    noEmit: true,
    declaration: false,
    declarationMap: false,
    sourceMap: false,
    lib: ['ES2024', 'DOM'],
    types: ['node'],
    paths: {
      '@ppt/application': ['packages/application/src/index.ts'],
      '@ppt/config': ['packages/config/src/index.ts'],
      '@ppt/contracts': ['packages/contracts/src/index.ts'],
      '@ppt/core': ['packages/core/src/index.ts'],
      '@ppt/database': ['packages/database/src/index.ts'],
      '@ppt/domain': ['packages/domain/src/index.ts'],
      '@ppt/events': ['packages/events/src/index.ts'],
      '@ppt/infrastructure': ['packages/infrastructure/src/index.ts'],
      '@ppt/logging': ['packages/logging/src/index.ts'],
      '@ppt/repositories': ['packages/repositories/src/index.ts'],
      '@ppt/repository-contracts': ['packages/repository-contracts/src/index.ts'],
      '@ppt/security': ['packages/security/src/index.ts'],
      '@ppt/test-data': ['packages/test-data/src/index.ts']
    }
  },
  include: [
    join(typesRoot, '**/*.d.ts'),
    join(root, 'packages/*/src/**/*.ts'),
    join(root, 'apps/desktop/src/main/**/*.ts')
  ],
  exclude: [
    join(root, 'node_modules'),
    join(root, '**/dist/**'),
    join(root, 'release'),
    join(root, 'coverage'),
    join(root, 'artifacts')
  ]
};
for (const [name, values] of Object.entries(tsconfig.compilerOptions.paths)) {
  tsconfig.compilerOptions.paths[name] = values.map((value) => {
    const absolute = resolve(root, value);
    const fromTemp = relative(tempRoot, absolute).replaceAll('\\', '/');
    return fromTemp.startsWith('.') ? fromTemp : `./${fromTemp}`;
  });
}
const tsconfigPath = join(tempRoot, 'tsconfig.json');
await writeFile(tsconfigPath, `${JSON.stringify(tsconfig, null, 2)}\n`);

const startedAt = new Date().toISOString();
const result = spawnSync(compiler.command, [...compiler.prefixArgs, '-p', tsconfigPath, '--pretty', 'false'], {
  cwd: root,
  encoding: 'utf8',
  env: { ...process.env, TERM: 'dumb' }
});
const evidence = {
  schemaVersion: 1,
  startedAt,
  completedAt: new Date().toISOString(),
  compiler: compiler.display,
  compilerResolutionStrategy: compiler.strategy,
  scope: ['packages/*/src/**/*.ts', 'apps/desktop/src/main/**/*.ts'],
  externalTypePolicy: 'Real Node types plus a deliberately narrow Electron declaration shell; Electron runtime/API compatibility is not proven.',
  status: result.status === 0 ? 'PASS' : 'FAIL',
  exitCode: result.status,
  stdout: result.stdout,
  stderr: result.stderr
};
await writeFile(evidencePath, `${JSON.stringify(evidence, null, 2)}\n`);
await rm(tempRoot, { recursive: true, force: true });

if (result.status !== 0) {
  process.stderr.write(result.stdout || '');
  process.stderr.write(result.stderr || '');
  throw new Error(`Desktop main source typecheck failed with exit code ${result.status}.`);
}
console.log('Desktop main source typecheck completed with controlled external type shell: PASS.');

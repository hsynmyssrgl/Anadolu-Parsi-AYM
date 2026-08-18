import { spawnSync } from 'node:child_process';
import { copyFile, mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const desktopRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const repositoryRoot = resolve(desktopRoot, '../..');
const mainSourceRoot = resolve(desktopRoot, 'src/main');
const coreServiceSourceRoot = resolve(repositoryRoot, 'apps/core-service/src');
const outputDirectory = resolve(desktopRoot, 'dist/main');
const coreServiceOutputDirectory = resolve(desktopRoot, 'dist/core-service');
const temporaryDirectory = resolve(desktopRoot, '.tmp-electron-build');
const compilerEntry = resolve(repositoryRoot, 'node_modules/typescript/bin/tsc');

const runTypeScript = (args) => {
  const result = spawnSync(process.execPath, [compilerEntry, ...args], {
    cwd: repositoryRoot,
    encoding: 'utf8',
    env: { ...process.env, TERM: 'dumb' }
  });
  if (result.status !== 0) {
    throw new Error([
      'Electron TypeScript compilation failed.',
      result.stdout,
      result.stderr
    ].filter(Boolean).join('\n'));
  }
};

await rm(outputDirectory, { recursive: true, force: true });
await rm(coreServiceOutputDirectory, { recursive: true, force: true });
await rm(temporaryDirectory, { recursive: true, force: true });
await mkdir(outputDirectory, { recursive: true });
await mkdir(temporaryDirectory, { recursive: true });

try {
  runTypeScript([
    '-p',
    resolve(desktopRoot, 'tsconfig.electron.json'),
    '--noEmit',
    'false',
    '--declaration',
    'false',
    '--declarationMap',
    'false',
    '--sourceMap',
    'true',
    '--rootDir',
    mainSourceRoot,
    '--outDir',
    outputDirectory
  ]);

  await mkdir(coreServiceOutputDirectory, { recursive: true });
  runTypeScript([
    '-p',
    resolve(repositoryRoot, 'apps/core-service/tsconfig.json'),
    '--noEmit',
    'false',
    '--declaration',
    'false',
    '--declarationMap',
    'false',
    '--sourceMap',
    'true',
    '--rootDir',
    coreServiceSourceRoot,
    '--outDir',
    coreServiceOutputDirectory
  ]);

  await rename(
    resolve(outputDirectory, 'main.js'),
    resolve(outputDirectory, 'main.mjs')
  );
  await copyFile(
    resolve(desktopRoot, 'src/renderer/assets/brand-mark.png'),
    resolve(outputDirectory, 'tray-icon.png')
  );
  await copyFile(
    resolve(repositoryRoot, 'config/gold-activation-trust.json'),
    resolve(outputDirectory, 'gold-activation-trust.json')
  );

  const preloadCommonJsSources = [
    'preload.ts',
    'ipc-integration-policy.ts',
    'ipc-transport-context.ts',
    'ipc-request-lifecycle.ts',
    'ipc-read-sharing.ts'
  ];
  const temporaryCommonJsEntries = [];
  for (const sourceName of preloadCommonJsSources) {
    const sourcePath = resolve(mainSourceRoot, sourceName);
    const targetName = sourceName.replace(/\.ts$/, '.cts');
    const targetPath = resolve(temporaryDirectory, targetName);
    const source = (await readFile(sourcePath, 'utf8'))
      .replace(/from '((?:\.\/)ipc-[^']+)\.js'/g, "from '$1.cjs'")
      .replace(/=\s*<([A-Za-z_$][^>\n]*)>\s*\(/g, '= <$1,>(')
      .replace(/async\s+<([A-Za-z_$][^>\n]*)>\s*\(/g, 'async <$1,>(');
    await writeFile(targetPath, source);
    temporaryCommonJsEntries.push(targetPath);
  }
  runTypeScript([
    '--ignoreConfig',
    ...temporaryCommonJsEntries,
    '--target',
    'ES2024',
    '--module',
    'NodeNext',
    '--moduleResolution',
    'NodeNext',
    '--rootDir',
    temporaryDirectory,
    '--outDir',
    outputDirectory,
    '--types',
    'node',
    '--skipLibCheck',
    '--strict',
    '--sourceMap'
  ]);

  await rm(resolve(outputDirectory, 'preload.js'), { force: true });
  await rm(resolve(outputDirectory, 'preload.js.map'), { force: true });
} finally {
  await rm(temporaryDirectory, { recursive: true, force: true });
}

console.log('Electron main and preload compiled with the workspace TypeScript compiler.');

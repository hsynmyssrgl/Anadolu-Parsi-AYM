import { cp, mkdir, rm, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { execFileSync, spawnSync } from 'node:child_process';
import { join, resolve } from 'node:path';
import { relative } from 'node:path';
import { resolveTypeScriptCommand } from './lib/typescript-command.mjs';

const root = process.cwd();
const tempRoot = join(root, '.tmp', 'package-source-typecheck');
const nodeModules = join(tempRoot, 'node_modules');
const evidencePath = join(root, 'artifacts', 'validation', 'package-source-typecheck.json');
const compiler = resolveTypeScriptCommand(root);

const globalRoot = (() => {
  try { return execFileSync('npm', ['root', '-g'], { encoding: 'utf8' }).trim(); }
  catch { return ''; }
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
if (!nodeTypesSource) throw new Error('Package source typecheck requires @types/node in the workspace or global toolchain.');

await rm(tempRoot, { recursive: true, force: true });
await mkdir(join(nodeModules, '@types'), { recursive: true });
await mkdir(join(root, 'artifacts', 'validation'), { recursive: true });
await cp(nodeTypesSource, join(nodeModules, '@types', 'node'), { recursive: true });
if (undiciTypesSource) await cp(undiciTypesSource, join(nodeModules, 'undici-types'), { recursive: true });

const sourceConfig = JSON.parse(JSON.stringify(await import(`file://${resolve(root, 'tsconfig.packages.json')}`, { with: { type: 'json' } }).then((module) => module.default)));
sourceConfig.extends = resolve(root, 'tsconfig.base.json');
sourceConfig.compilerOptions = {
  ...sourceConfig.compilerOptions,
  noEmit: true,
  declaration: false,
  declarationMap: false,
  sourceMap: false
};
for (const [name, values] of Object.entries(sourceConfig.compilerOptions.paths ?? {})) {
  sourceConfig.compilerOptions.paths[name] = values.map((value) => {
    const absolute = resolve(root, value);
    const fromTemp = relative(tempRoot, absolute).replaceAll('\\', '/');
    return fromTemp.startsWith('.') ? fromTemp : `./${fromTemp}`;
  });
}
const relativeFromTemp = (value) => {
  const result = relative(tempRoot, value).replaceAll('\\', '/');
  return result.startsWith('.') ? result : `./${result}`;
};
sourceConfig.include = [relativeFromTemp(join(root, 'packages/*/src/**/*.ts'))];
sourceConfig.exclude = [
  relativeFromTemp(join(root, 'node_modules')),
  relativeFromTemp(join(root, '**/dist/**')),
  relativeFromTemp(join(root, 'artifacts'))
];
const tsconfigPath = join(tempRoot, 'tsconfig.json');
await writeFile(tsconfigPath, `${JSON.stringify(sourceConfig, null, 2)}\n`);

const compilerVersion = (() => {
  try { return execFileSync(compiler.command, [...compiler.prefixArgs, '-v'], { encoding: 'utf8' }).trim(); }
  catch { return 'unknown'; }
})();
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
  compilerVersion,
  scope: ['packages/*/src/**/*.ts'],
  status: result.status === 0 ? 'PASS' : 'FAIL',
  exitCode: result.status,
  stdout: result.stdout,
  stderr: result.stderr,
  limitation: 'Uses the available TypeScript and Node type toolchain; it is not the lockfile-pinned clean npm-ci gate.'
};
await writeFile(evidencePath, `${JSON.stringify(evidence, null, 2)}\n`);
await rm(tempRoot, { recursive: true, force: true });
if (result.status !== 0) {
  process.stderr.write(result.stdout || '');
  process.stderr.write(result.stderr || '');
  throw new Error(`Package source typecheck failed with exit code ${result.status}.`);
}
console.log(`Package source typecheck completed: PASS (${compilerVersion}).`);

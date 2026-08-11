import assert from 'node:assert/strict';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';
import { resolveTypeScriptCommand } from './lib/typescript-command.mjs';

const root = process.cwd();
const compileRoot = join(root, '.tmp', 'build134-accessibility-runtime');
const compiler = resolveTypeScriptCommand(root);
await rm(compileRoot, { recursive: true, force: true });
await mkdir(compileRoot, { recursive: true });
const tsconfigPath = join(compileRoot, 'tsconfig.json');
await writeFile(tsconfigPath, `${JSON.stringify({
  extends: resolve(root, 'tsconfig.base.json'),
  compilerOptions: {
    module: 'NodeNext',
    moduleResolution: 'NodeNext',
    outDir: join(compileRoot, 'dist'),
    rootDir: resolve(root, 'apps/desktop/src/renderer'),
    declaration: false,
    declarationMap: false,
    sourceMap: false,
    types: []
  },
  include: [resolve(root, 'apps/desktop/src/renderer/accessibility.ts')]
}, null, 2)}\n`);
const compilation = spawnSync(compiler.command, [...compiler.prefixArgs, '-p', tsconfigPath, '--pretty', 'false'], { cwd: root, encoding: 'utf8' });
if (compilation.status !== 0) {
  process.stderr.write(compilation.stdout || '');
  process.stderr.write(compilation.stderr || '');
  throw new Error(`Build 134 accessibility runtime compilation failed: ${compilation.status}`);
}
const module = await import(pathToFileURL(join(compileRoot, 'dist', 'accessibility.js')).href);
const {
  DEFAULT_ACCESSIBILITY_PREFERENCES,
  accessibilityAnnouncement,
  nextRovingIndex,
  parseAccessibilityPreferences,
  serializeAccessibilityPreferences
} = module;

const checks = [];
const failures = [];
const check = (label, action) => {
  try { action(); checks.push(label); }
  catch (error) { failures.push(`${label}: ${error instanceof Error ? error.message : String(error)}`); }
};

check('default text scale', () => assert.equal(DEFAULT_ACCESSIBILITY_PREFERENCES.textScale, 'standard'));
check('default high contrast', () => assert.equal(DEFAULT_ACCESSIBILITY_PREFERENCES.highContrast, false));
check('default reduced motion', () => assert.equal(DEFAULT_ACCESSIBILITY_PREFERENCES.reduceMotion, false));
check('system preferences apply without storage', () => assert.deepEqual(parseAccessibilityPreferences(null, { highContrast: true, reduceMotion: true }), { textScale: 'standard', highContrast: true, reduceMotion: true }));
check('stored values override system values', () => assert.deepEqual(parseAccessibilityPreferences('{"textScale":"large","highContrast":false,"reduceMotion":false}', { highContrast: true, reduceMotion: true }), { textScale: 'large', highContrast: false, reduceMotion: false }));
check('extra large is accepted', () => assert.equal(parseAccessibilityPreferences('{"textScale":"extra-large"}').textScale, 'extra-large'));
check('invalid scale falls back', () => assert.equal(parseAccessibilityPreferences('{"textScale":"huge"}').textScale, 'standard'));
check('invalid JSON falls back safely', () => assert.deepEqual(parseAccessibilityPreferences('{', { highContrast: true, reduceMotion: false }), { textScale: 'standard', highContrast: true, reduceMotion: false }));
check('invalid boolean uses system contrast', () => assert.equal(parseAccessibilityPreferences('{"highContrast":"yes"}', { highContrast: true, reduceMotion: false }).highContrast, true));
check('serialization is round-trippable', () => {
  const input = { textScale: 'large', highContrast: true, reduceMotion: true };
  assert.deepEqual(parseAccessibilityPreferences(serializeAccessibilityPreferences(input)), input);
});
check('empty roving collection returns -1', () => assert.equal(nextRovingIndex(0, 0, 'ArrowDown'), -1));
check('ArrowDown advances', () => assert.equal(nextRovingIndex(0, 4, 'ArrowDown'), 1));
check('ArrowDown wraps', () => assert.equal(nextRovingIndex(3, 4, 'ArrowDown'), 0));
check('ArrowUp retreats', () => assert.equal(nextRovingIndex(2, 4, 'ArrowUp'), 1));
check('ArrowUp wraps', () => assert.equal(nextRovingIndex(0, 4, 'ArrowUp'), 3));
check('Home selects first', () => assert.equal(nextRovingIndex(3, 4, 'Home'), 0));
check('End selects last', () => assert.equal(nextRovingIndex(0, 4, 'End'), 3));
check('out-of-range index normalizes', () => assert.equal(nextRovingIndex(99, 4, 'ArrowDown'), 1));
check('announcement includes section name', () => assert.equal(accessibilityAnnouncement('Sağlık'), 'Sağlık bölümü açıldı.'));

const evidence = {
  schemaVersion: 1,
  product: 'Anadolu Parsı Aile Yaşam Merkezi',
  applicationVersion: '27.07.2026.134',
  packageVersion: '27.7.2026-134',
  checks: checks.length,
  status: failures.length === 0 ? 'PASS' : 'FAIL',
  failures,
  generatedAt: new Date().toISOString()
};
await mkdir(join(root, 'artifacts', 'validation'), { recursive: true });
await writeFile(join(root, 'artifacts', 'validation', 'build134-accessibility-runtime.json'), `${JSON.stringify(evidence, null, 2)}\n`);
await rm(compileRoot, { recursive: true, force: true });
if (failures.length) {
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}
console.log(`Build 134 accessibility runtime verified: ${checks.length}/${checks.length} PASS.`);

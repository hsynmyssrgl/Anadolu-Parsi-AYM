import { readFileSync, readdirSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();
const mainPath = resolve(root, 'apps/desktop/src/main/main.ts');
const dataStorePath = resolve(root, 'apps/desktop/src/main/data-store.ts');
const adapterPath = resolve(root, 'apps/desktop/src/main/operational-artifact-file-application-adapter.ts');

const read = (path: string): string => readFileSync(path, 'utf8');

const listTypeScript = (directory: string): string[] => readdirSync(directory, { withFileTypes: true })
  .flatMap((entry) => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? listTypeScript(path) : entry.name.endsWith('.ts') ? [path] : [];
  });

describe('PPK-016 protected operational artifact production composition', () => {
  it('proves the sole production FamilyDataStore construction injects the protected adapter explicitly', () => {
    const productionFiles = listTypeScript(resolve(root, 'apps/desktop/src'));
    const constructors = productionFiles.flatMap((path) => {
      const count = (read(path).match(/new FamilyDataStore\s*\(/gu) ?? []).length;
      return Array.from({ length: count }, () => relative(root, path).replaceAll('\\', '/'));
    });
    expect(constructors).toEqual(['apps/desktop/src/main/main.ts']);

    const main = read(mainPath);
    const storeStart = main.indexOf('function store(');
    const storeEnd = main.indexOf('\nfunction ', storeStart + 1);
    const productionComposition = main.slice(storeStart, storeEnd);
    expect(storeStart).toBeGreaterThanOrEqual(0);
    expect(productionComposition).toContain(
      'operationalArtifactFiles: new ProtectedOperationalArtifactFilePort(current.protectedArtifacts)'
    );
    expect(productionComposition).not.toContain('new FileSystemOperationalArtifactFilePort');
    expect(main).toContain(
      "import { ProtectedOperationalArtifactFilePort } from './operational-artifact-file-application-adapter.js';"
    );
  });

  it('does not mistake the DataStore test fallback for production evidence', () => {
    const dataStore = read(dataStorePath);
    const main = read(mainPath);
    expect(dataStore).toContain(
      'options.operationalArtifactFiles ?? new FileSystemOperationalArtifactFilePort()'
    );
    expect(main).not.toContain('FileSystemOperationalArtifactFilePort');

    const productionPlainInstantiations = listTypeScript(resolve(root, 'apps/desktop/src'))
      .filter((path) => path !== dataStorePath)
      .flatMap((path) => read(path).match(/new FileSystemOperationalArtifactFilePort\s*\(/gu) ?? []);
    expect(productionPlainInstantiations).toHaveLength(0);
  });

  it('binds every protected operation to ProtectedSideArtifactStore instead of raw filesystem writes', () => {
    const adapter = read(adapterPath);
    const protectedStart = adapter.indexOf('export class ProtectedOperationalArtifactFilePort');
    const protectedImplementation = adapter.slice(protectedStart);
    expect(protectedStart).toBeGreaterThanOrEqual(0);
    expect(protectedImplementation).toContain('private readonly store: ProtectedSideArtifactStore');
    expect(protectedImplementation).toContain('this.store.writeText(');
    expect(protectedImplementation).toContain('this.store.writeBuffer(');
    expect(protectedImplementation).toContain('this.store.verify(');
    expect(protectedImplementation).toContain('this.store.readText(');
    expect(protectedImplementation).toContain('this.store.readBuffer(');
    expect(protectedImplementation).not.toContain('writeFileSync(');
    expect(protectedImplementation).not.toContain('readFileSync(');
  });
});

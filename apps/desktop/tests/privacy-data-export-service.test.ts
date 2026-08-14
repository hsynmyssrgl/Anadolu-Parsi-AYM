import { mkdtemp, mkdir, readFile, readdir, stat, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { decryptPrivacyDataExport } from '@ppt/security';
import { writePrivacyDataExportFile } from '../src/main/privacy-data-export-service.js';

const roots: string[] = [];
const makeRoot = async (): Promise<string> => { const root = await mkdtemp(join(tmpdir(), 'ppt-privacy-export-')); roots.push(root); return root; };
afterEach(async () => {
  const { rm } = await import('node:fs/promises');
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

const metadata = {
  accountId: 'account-owner', familyId: 'family-owner', ownerPersonId: 'person-owner', requestId: 'request-owner-0001',
  scopeSha256: 'a'.repeat(64), lineageSha256: 'b'.repeat(64), createdAt: '2026-08-14T00:00:00.000Z'
} as const;
const passphrase = 'Gizlilik-Dosya-Parolasi-2026!';
const value = { owner: 'person-owner', records: [{ id: 'record-1', state: 'active' }] };

describe('33-O desktop privacy data export file service', () => {
  it('publishes a no-clobber encrypted regular file and returns content-free renderer metadata', async () => {
    const root = await makeRoot();
    const destination = resolve(root, 'verilerim.pptprivacy');
    const result = await writePrivacyDataExportFile({ value, metadata, passphrase, destination });
    expect(result).toEqual({
      fileName: 'verilerim.pptprivacy', artifactSha256: expect.stringMatching(/^[0-9a-f]{64}$/u),
      artifactSizeBytes: expect.any(Number), createdAt: metadata.createdAt, delivery: 'not_performed'
    });
    expect(JSON.stringify(result)).not.toContain(root);
    expect(Object.keys(result).sort()).toEqual(['artifactSha256','artifactSizeBytes','createdAt','delivery','fileName'].sort());
    const entry = await stat(destination);
    expect(entry.isFile()).toBe(true);
    if (process.platform !== 'win32') expect(entry.mode & 0o777).toBe(0o600);
    const encrypted = await readFile(destination);
    const decrypted = decryptPrivacyDataExport(encrypted, passphrase);
    try {
      expect(JSON.parse(decrypted.plaintext.toString('utf8'))).toEqual(value);
      expect(decrypted.metadata).toEqual(metadata);
    } finally { decrypted.plaintext.fill(0); encrypted.fill(0); }
    expect((await readdir(root)).filter((name) => name.endsWith('.tmp'))).toEqual([]);
  });

  it('rejects relative, wrong-extension, missing-parent and directory targets without partial files', async () => {
    const root = await makeRoot();
    for (const destination of ['relative.pptprivacy', resolve(root, 'wrong.json'), resolve(root, 'missing', 'data.pptprivacy')]) {
      await expect(writePrivacyDataExportFile({ value, metadata, passphrase, destination })).rejects.toThrow();
    }
    const directoryTarget = resolve(root, 'directory.pptprivacy');
    await mkdir(directoryTarget);
    await expect(writePrivacyDataExportFile({ value, metadata, passphrase, destination: directoryTarget })).rejects.toThrow(/zaten var/u);
    expect((await readdir(root)).filter((name) => name.endsWith('.tmp'))).toEqual([]);
  });

  it('rejects symlink or reparse parents', async () => {
    const root = await makeRoot();
    const actual = resolve(root, 'actual');
    const linked = resolve(root, 'linked');
    await mkdir(actual);
    try { await symlink(actual, linked, process.platform === 'win32' ? 'junction' : 'dir'); }
    catch { return; }
    await expect(writePrivacyDataExportFile({ value, metadata, passphrase, destination: resolve(linked, 'data.pptprivacy') }))
      .rejects.toThrow(/reparse|symlink|gerçek/u);
    expect(await readdir(actual)).toEqual([]);
  });

  it('never overwrites an existing target and leaves its bytes unchanged', async () => {
    const root = await makeRoot();
    const destination = resolve(root, 'existing.pptprivacy');
    await writeFile(destination, 'existing', { flag: 'wx' });
    await expect(writePrivacyDataExportFile({ value, metadata, passphrase, destination })).rejects.toThrow(/üzerine yazma/u);
    expect(await readFile(destination, 'utf8')).toBe('existing');
    expect((await readdir(root)).filter((name) => name.endsWith('.tmp'))).toEqual([]);
  });

  it('removes the verified artifact when trusted ledger finalization fails', async () => {
    const root = await makeRoot();
    const destination = resolve(root, 'rollback.pptprivacy');
    let verified = false;
    await expect(writePrivacyDataExportFile({
      value,
      metadata,
      passphrase,
      destination,
      onVerified: (result) => {
        verified = result.verified && result.plaintextSizeBytes > 0;
        throw new Error('ledger-finalization-failed');
      }
    })).rejects.toThrow(/ledger-finalization-failed/u);
    expect(verified).toBe(true);
    expect(await readdir(root)).toEqual([]);
  });

  it('rejects non-exact input, invalid owner metadata and weak password before publishing', async () => {
    const root = await makeRoot();
    const destination = resolve(root, 'invalid.pptprivacy');
    await expect(writePrivacyDataExportFile({ value, metadata, passphrase, destination, extra: true } as never)).rejects.toThrow(/exact/u);
    await expect(writePrivacyDataExportFile({ value, metadata: { ...metadata, ownerPersonId: '../other' }, passphrase, destination })).rejects.toThrow(/metadata/u);
    await expect(writePrivacyDataExportFile({ value, metadata, passphrase: '123456789012', destination })).rejects.toThrow(/parolası/u);
    expect(await readdir(root)).toEqual([]);
  });
});

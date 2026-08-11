import { access, mkdir, writeFile } from 'node:fs/promises';

const reportPath = process.argv[2] ?? 'artifacts/validation/build227-workspace-dist-prerequisite.json';
const packages = ['core', 'contracts', 'config', 'logging', 'database', 'domain', 'events', 'repository-contracts', 'repositories', 'security', 'application', 'infrastructure', 'test-data'];
const results = [];
for (const name of packages) {
  for (const leaf of ['index.js', 'index.d.ts']) {
    const path = `packages/${name}/dist/${leaf}`;
    let exists = true;
    try { await access(path); } catch { exists = false; }
    results.push({ id: `${name}-${leaf}`, path, status: exists ? 'PASS' : 'FAIL' });
  }
}
const status = results.every((item) => item.status === 'PASS') ? 'PASS' : 'FAIL';
await mkdir('artifacts/validation', { recursive: true });
await writeFile(reportPath, `${JSON.stringify({ schemaVersion: 1, product: 'Anadolu Parsı Aile Yaşam Merkezi', applicationVersion: '02.08.2026.227', packageVersion: '2.8.2026-227', build: 227, status, checks: results.length, passCount: results.filter((item) => item.status === 'PASS').length, results, generatedAt: new Date().toISOString() }, null, 2)}\n`);
console.log(`Build227 workspace dist prerequisite: ${status} (${results.filter((item) => item.status === 'PASS').length}/${results.length}).`);
if (status !== 'PASS') process.exitCode = 1;

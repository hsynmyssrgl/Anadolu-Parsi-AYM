import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const path = resolve(import.meta.dirname, 'update-aym-governance-incrementally.mjs');
let source = readFileSync(path, 'utf8');

const before = `  for (const entry of entries) {
    const id = entry.name.match(/^(DEC-\\d{3})/u)?.[1];
    if (!id || existing.has(id)) continue;
    const absolute = resolve(decisionsDir, entry.name);
    const content = await readFile(absolute, 'utf8');
    const title = content.match(/^#\\s+(.+)$/mu)?.[1]?.trim() ?? entry.name.replace(/\\.md$/u, '');
    const embeddedPaths = [...content.matchAll(/\`([^\`]+)\`/gu)]
      .map((match) => normalizeEvidencePath(match[1]))
      .filter(Boolean);
    const canonicalPath = \`06_KOD/app/docs/decisions/\${entry.name}\`;
    const evidencePaths = [...new Set([
      canonicalPath, '06_KOD/app/config/user-decision-ledger.json', ...embeddedPaths,
      receipt.receipt.path, receipt.backup.path
    ])];
    const digest = await hashFile(absolute);
    records.push({
      Id: id,
      Title: title,
      DecisionText: null,
      EvidenceStatus: 'ACTIVE_STANDALONE_DOCUMENT',
      AuthorityClass: 'ACTIVE_SOURCE_DECISION_DOCUMENT',
      IndependentStandaloneDocument: true,
      EvidenceDate: '2026-08-09',
      Build: null,
      DateBasis: 'SOURCE_DOCUMENT',
      DateNature: 'EXPLICIT_CURRENT_USER_INSTRUCTION',
      CanonicalEvidencePath: canonicalPath,
      CanonicalEvidenceSha256: digest.toUpperCase(),
      SourceSectionSha256: null,
      Sources: [{ path: canonicalPath, sha256: digest.toUpperCase(), role: 'FULL_STANDALONE_DECISION_DOCUMENT' }],
      EvidenceFileCount: evidencePaths.length,
      EvidencePaths: evidencePaths,
      Context: content.replaceAll(/\\s+/gu, ' ').slice(0, 320),
      WebAuditPath: null
    });
    existing.add(id);
  }`;

const after = `  for (const entry of entries) {
    const id = entry.name.match(/^(DEC-\\d{3})/u)?.[1];
    if (!id) continue;
    const absolute = resolve(decisionsDir, entry.name);
    const content = await readFile(absolute, 'utf8');
    const title = content.match(/^#\\s+(.+)$/mu)?.[1]?.trim() ?? entry.name.replace(/\\.md$/u, '');
    const embeddedPaths = [...content.matchAll(/\`([^\`]+)\`/gu)]
      .map((match) => normalizeEvidencePath(match[1]))
      .filter(Boolean);
    const canonicalPath = \`06_KOD/app/docs/decisions/\${entry.name}\`;
    const evidencePaths = [...new Set([
      canonicalPath, '06_KOD/app/config/user-decision-ledger.json', ...embeddedPaths,
      receipt.receipt.path, receipt.backup.path
    ])];
    const digest = await hashFile(absolute);
    const refreshed = {
      Id: id,
      Title: title,
      DecisionText: null,
      EvidenceStatus: 'ACTIVE_STANDALONE_DOCUMENT',
      AuthorityClass: 'ACTIVE_SOURCE_DECISION_DOCUMENT',
      IndependentStandaloneDocument: true,
      EvidenceDate: '2026-08-09',
      Build: null,
      DateBasis: 'SOURCE_DOCUMENT',
      DateNature: 'EXPLICIT_CURRENT_USER_INSTRUCTION',
      CanonicalEvidencePath: canonicalPath,
      CanonicalEvidenceSha256: digest.toUpperCase(),
      SourceSectionSha256: null,
      Sources: [{ path: canonicalPath, sha256: digest.toUpperCase(), role: 'FULL_STANDALONE_DECISION_DOCUMENT' }],
      EvidenceFileCount: evidencePaths.length,
      EvidencePaths: evidencePaths,
      Context: content.replaceAll(/\\s+/gu, ' ').slice(0, 320),
      WebAuditPath: null
    };
    const index = records.findIndex((record) => record.Id === id);
    if (index >= 0) records[index] = { ...records[index], ...refreshed };
    else records.push(refreshed);
    existing.add(id);
  }`;

if (!source.includes(after)) {
  if (!source.includes(before)) throw new Error('Missing decision register update loop');
  source = source.replace(before, after);
  writeFileSync(path, source, 'utf8');
}
console.log('AYM decision register incremental refresh enabled');

import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('current master documentation V5 governance', () => {
  it('prevents a self-referential document-audit cycle and verifies the active master in preflight', () => {
    const active = JSON.parse(readFileSync('config/active-document-set.json', 'utf8'));
    const audit = readFileSync('scripts/audit-all-project-documents.py', 'utf8');
    const verifier = readFileSync('scripts/verify-current-master-documentation-v5.py', 'utf8');
    const pythonRuntime = readFileSync('scripts/lib/python-runtime.mjs', 'utf8');
    const preflight = readFileSync('scripts/run-governed-preflight.mjs', 'utf8');
    const pkg = JSON.parse(readFileSync('package.json', 'utf8'));

    expect(active.currentMasterDocumentation).toMatchObject({
      version: 'GUNCEL-2026-08-26-V5',
      asOf: '2026-08-26',
      status: 'ACTIVE_CURRENT_MASTER_REFERENCE',
      historicalBuildArtifactsImmutable: true
    });
    expect(audit).toContain('ACTIVE_DOCUMENT_SET');
    expect(audit).toContain('SELF_GENERATED_OUTPUTS.add');
    expect(verifier).toContain('PDF page {page_number} does not contain one exact page marker');
    expect(verifier).toContain('DOCX missing {label} identifier');
    expect(verifier).toContain('EXPECTED_VERSION in docx_text');
    expect(verifier).toContain('EXPECTED_VERSION in pdf_text');
    expect(pythonRuntime).toContain('PPT_PYTHON_EXECUTABLE');
    expect(pythonRuntime).toContain('codex-primary-runtime/dependencies/python/python.exe');
    expect(preflight).toContain("['scripts/verify-current-master-documentation-v5.mjs']");
    expect(pkg.scripts).toMatchObject({
      'generate:master-documentation:v5': expect.stringContaining('generate-current-master-documentation-v5.mjs'),
      'verify:master-documentation:v5': expect.stringContaining('verify-current-master-documentation-v5.mjs')
    });
  });
});

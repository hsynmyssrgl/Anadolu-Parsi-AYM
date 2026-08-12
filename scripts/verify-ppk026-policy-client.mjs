import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import {
  assertPpk026PolicyClientSchema,
  renderPpk026GeneratedPolicyClient,
  renderPpk026GeneratedPolicyClientManifest
} from './lib/ppk026-policy-client-codegen.mjs';

const SCHEMA_PATH = 'config/32-v-ppk-026-typed-policy-sdk-schema.json';

export const verifyPpk026PolicyClient = async (root = process.cwd()) => {
  const schemaText = await readFile(resolve(root, SCHEMA_PATH), 'utf8');
  const schema = assertPpk026PolicyClientSchema(JSON.parse(schemaText));
  const expectedSource = renderPpk026GeneratedPolicyClient(schema);
  const expectedManifest = renderPpk026GeneratedPolicyClientManifest({ schemaText, source: expectedSource });
  const [actualSource, actualManifest] = await Promise.all([
    readFile(resolve(root, schema.generatedSource), 'utf8'),
    readFile(resolve(root, schema.generatedManifest), 'utf8')
  ]);
  const findings = [];
  if (actualSource !== expectedSource) findings.push('Generated policy client differs from the canonical schema output');
  if (actualManifest !== expectedManifest) findings.push('Generated policy client manifest differs from the canonical schema output');
  return Object.freeze({
    status: findings.length === 0 ? 'PASS' : 'FAIL',
    methodCount: schema.methods.length,
    sourceExact: actualSource === expectedSource,
    manifestExact: actualManifest === expectedManifest,
    findings: Object.freeze(findings)
  });
};

const invokedPath = process.argv[1] ? pathToFileURL(resolve(process.argv[1])).href : '';
if (import.meta.url === invokedPath) {
  const report = await verifyPpk026PolicyClient();
  console.log(JSON.stringify(report, null, 2));
  if (report.status !== 'PASS') process.exitCode = 1;
}

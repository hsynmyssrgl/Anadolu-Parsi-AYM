import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import {
  renderPpk026GeneratedPolicyClient,
  renderPpk026GeneratedPolicyClientManifest
} from './lib/ppk026-policy-client-codegen.mjs';

const SCHEMA_PATH = 'config/32-v-ppk-026-typed-policy-sdk-schema.json';

export const generatePpk026PolicyClient = async (root = process.cwd()) => {
  const schemaText = await readFile(resolve(root, SCHEMA_PATH), 'utf8');
  const schema = JSON.parse(schemaText);
  const source = renderPpk026GeneratedPolicyClient(schema);
  const manifest = renderPpk026GeneratedPolicyClientManifest({ schemaText, source });
  const sourcePath = resolve(root, schema.generatedSource);
  const manifestPath = resolve(root, schema.generatedManifest);
  await mkdir(dirname(sourcePath), { recursive: true });
  await mkdir(dirname(manifestPath), { recursive: true });
  await writeFile(sourcePath, source);
  await writeFile(manifestPath, manifest);
  return Object.freeze({ sourcePath, manifestPath, methodCount: schema.methods.length });
};

const invokedPath = process.argv[1] ? pathToFileURL(resolve(process.argv[1])).href : '';
if (import.meta.url === invokedPath) {
  const result = await generatePpk026PolicyClient();
  console.log(`PPK-026 generated policy client: PASS (${result.methodCount} methods).`);
}

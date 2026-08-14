import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const source = (path: string): string => readFileSync(resolve(process.cwd(), path), 'utf8');
const policy = source('apps/desktop/src/main/ipc-integration-policy.ts');
const lifecycle = source('apps/desktop/src/main/ipc-request-lifecycle.ts');
const runtime = source('apps/desktop/src/main/ipc-runtime.ts');
const main = source('apps/desktop/src/main/main.ts');
const preload = source('apps/desktop/src/main/preload.ts');
const globalTypes = source('apps/desktop/src/renderer/global.d.ts');

const channels = {
  getCenter: 'localOcr:getCenter',
  getResult: 'localOcr:getResult',
  search: 'localOcr:search',
  create: 'localOcr:create',
  run: 'localOcr:run',
  cancel: 'localOcr:cancel',
  correct: 'localOcr:correct',
  rerun: 'localOcr:rerun',
  delete: 'localOcr:delete',
  setEnabled: 'localOcr:setEnabled'
} as const;

const methods = [
  'getLocalGovernedOcrCenter',
  'getLocalGovernedOcrResult',
  'searchLocalGovernedOcr',
  'createLocalGovernedOcrJob',
  'runLocalGovernedOcrJob',
  'cancelLocalGovernedOcrJob',
  'correctLocalGovernedOcrResult',
  'rerunLocalGovernedOcrJob',
  'deleteLocalGovernedOcrJob',
  'setLocalGovernedOcrEnabled'
] as const;

describe('33-Q local governed OCR desktop IPC bridge', () => {
  it('exposes and registers each of the ten governed channels exactly once', () => {
    for (const [key, channel] of Object.entries(channels)) {
      expect(preload.match(new RegExp(`invoke\\('${channel}'`, 'gu')), channel).toHaveLength(1);
      expect(main.match(new RegExp(`LOCAL_GOVERNED_OCR_IPC_CHANNELS\\.${key}`, 'gu')), channel).toHaveLength(1);
      expect(policy).toContain(`${key}: '${channel}'`);
    }
  });

  it('keeps preload and renderer global declarations in one exact method contract', () => {
    for (const method of methods) {
      expect(preload.match(new RegExp(`^  ${method}:`, 'gmu')), method).toHaveLength(1);
      expect(globalTypes.match(new RegExp(`(?:^|[;\\s])${method}\\(`, 'gmu')), method).toHaveLength(1);
    }
  });

  it('does not accept renderer identity, path, bytes, sealed-result, receipt or hash authority', () => {
    const rendererInputs = policy.slice(
      policy.indexOf('export interface LocalGovernedOcrResultReadIpcInput'),
      policy.indexOf('export const projectLocalGovernedOcrCenterIpcView')
    );
    expect(rendererInputs).toContain('sourceResourceId: string');
    expect(rendererInputs).toContain('correctedText: string');
    for (const forbidden of [
      'familyId', 'accountId', 'ownerPersonId', 'sourcePath', 'filePath', 'rawBytes', 'sealedResultId',
      'receipt', 'inputSha256', 'contentSha256', 'stateFingerprint'
    ]) expect(rendererInputs).not.toContain(forbidden);
    expect(main).toContain("sourceResourceType: 'archive_item'");
  });

  it('redacts renderer results before the runtime validates their exact safe schemas', () => {
    expect(main).toContain("projectLocalGovernedOcrCenterIpcView(await localGovernedOcrBridgeMethod('getLocalGovernedOcrCenter')())");
    expect(main).toContain("projectLocalGovernedOcrResultIpcView(await localGovernedOcrBridgeMethod('getLocalGovernedOcrResult')(input))");
    expect(main).toContain("projectLocalGovernedOcrSearchIpcView(await localGovernedOcrBridgeMethod('searchLocalGovernedOcr')(input))");
    for (const method of methods.slice(3)) {
      const methodIndex = main.indexOf(`localGovernedOcrBridgeMethod('${method}')`);
      const projectorIndex = main.lastIndexOf('projectLocalGovernedOcrMutationIpcView(', methodIndex);
      expect(methodIndex, method).toBeGreaterThan(projectorIndex);
      expect(methodIndex - projectorIndex, method).toBeLessThan(240);
    }
    expect(policy).toContain("throw new Error('Main-only OCR source-deletion receipt cannot cross the renderer bridge.')");
  });

  it('keeps archive source-deletion propagation entirely off renderer channels and types', () => {
    const rendererSurface = `${preload}\n${globalTypes}`;
    expect(rendererSurface).not.toContain('PropagateLocalGovernedOcrSourceDeletion');
    expect(rendererSurface).not.toContain('localOcr:propagate');
    expect(rendererSurface).not.toContain('propagateLocalGovernedOcrSourceDeletion');
    expect(policy).not.toContain("propagate: 'localOcr:");
    expect(main).not.toContain("LOCAL_GOVERNED_OCR_IPC_CHANNELS.propagate");
  });

  it('pins durable lifecycle admission and rate gates in the main request path', () => {
    for (const channel of Object.values(channels)) expect(lifecycle).toContain(`'${channel}'`);
    expect(lifecycle).toContain('maxConcurrentPerSender: 2');
    expect(lifecycle).toContain('maxConcurrentPerChannel: 1');
    expect(lifecycle).toContain('maxQueuedPerSender: 4');
    expect(lifecycle).toContain('maxRequestsPerWindow: 12');
    expect(lifecycle).toContain('cancellable: false, latestWins: false, timeoutMs: 0');
  });

  it('runs input policy before dispatch and safe-result policy before transport response', () => {
    const inputGate = runtime.indexOf('evaluateIpcIntegrationPolicy(input.channel, handlerArguments)');
    const dispatch = runtime.indexOf('input.handler(event, ...(handlerArguments as TArguments))');
    const resultGate = runtime.indexOf('evaluateIpcIntegrationResultPolicy(input.channel, result)');
    const response = runtime.indexOf('createIpcTransportResponseEnvelope(requestContext, correlationId, result)');
    expect(inputGate).toBeGreaterThan(-1);
    expect(inputGate).toBeLessThan(dispatch);
    expect(resultGate).toBeGreaterThan(dispatch);
    expect(resultGate).toBeLessThan(response);
  });
});

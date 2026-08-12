import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { evaluateIpcIntegrationPolicy } from '../src/main/ipc-integration-policy.js';

const valid = {
  previewId: 'finance-import-preview-1',
  ownerPersonId: 'person-1',
  privacy: 'private',
  mapping: {
    dateColumn: 'date',
    descriptionColumn: 'description',
    amountColumn: 'amount',
    currencyColumn: 'currency',
    externalIdColumn: 'id',
    amountMode: 'signed'
  },
  defaultCurrency: 'TRY',
  incomeCategoryId: 'income-category',
  expenseCategoryId: 'expense-category',
  duplicateStrategy: 'skip'
} as const;

describe('33-D B4-13/B4-14 finance import IPC boundary', () => {
  it('keeps file and sandbox selection zero-argument and accepts the exact mapping contract', () => {
    expect(evaluateIpcIntegrationPolicy('finance:selectImportFile', [])).toEqual({ accepted: true });
    expect(evaluateIpcIntegrationPolicy('finance:previewOpenBankingSandbox', [])).toEqual({ accepted: true });
    expect(evaluateIpcIntegrationPolicy('finance:commitImportPreview', [valid])).toEqual({ accepted: true });
  });

  it('rejects unknown fields, unsafe mapping and malformed currency before dispatch', () => {
    expect(evaluateIpcIntegrationPolicy('finance:commitImportPreview', [{ ...valid, futureField: true }]))
      .toMatchObject({ accepted: false });
    expect(evaluateIpcIntegrationPolicy('finance:commitImportPreview', [{ ...valid, defaultCurrency: 'try' }]))
      .toMatchObject({ accepted: false });
    expect(evaluateIpcIntegrationPolicy('finance:commitImportPreview', [{ ...valid, mapping: { ...valid.mapping, amountMode: 'live_sync' } }]))
      .toMatchObject({ accepted: false });
    expect(evaluateIpcIntegrationPolicy('finance:selectImportFile', ['path.csv']))
      .toMatchObject({ accepted: false, reason: 'ARGUMENT_COUNT_MISMATCH' });
  });

  it('bounds the selected file before reading it into the Electron main process', () => {
    const source = readFileSync(new URL('../src/main/main.ts', import.meta.url), 'utf8');
    const handler = source.slice(source.indexOf("registerIpcHandler('finance:selectImportFile'"), source.indexOf("registerIpcHandler('finance:previewOpenBankingSandbox'"));
    expect(handler).toMatch(/openSync\(filePath, 'r'\)[\s\S]*fstatSync\(descriptor\)[\s\S]*metadata\.size > maximumBytes[\s\S]*readSync\(descriptor, bytes[\s\S]*closeSync\(descriptor\)/u);
    expect(handler).not.toContain('readFileSync(filePath)');
  });

  it('binds previews to the authenticated sender and clears them on auth transitions', () => {
    const source = readFileSync(new URL('../src/main/main.ts', import.meta.url), 'utf8');
    expect(source).toMatch(/function financeImportSessionOwnerToken\(event: IpcMainInvokeEvent\)[\s\S]*event\.sender\.id[\s\S]*currentAuthenticatedAccountId\(\)[\s\S]*family-main/u);
    expect(source).toContain('ownerToken: financeImportSessionOwnerToken(event)');
    expect(source).toContain('financeImportFileSessions.resolve(input, new Date(), ownerToken)');
    expect(source).toContain('financeImportFileSessions.consume(input.previewId, ownerToken)');
    expect(source).toMatch(/registerIpcHandler\('auth:logout'[\s\S]*financeImportFileSessions\.clear\(\)/u);
    expect(source).toContain('financeImportFileSessions.dispose()');
  });
});

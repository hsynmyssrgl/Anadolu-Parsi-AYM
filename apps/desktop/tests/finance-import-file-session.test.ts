import { afterEach, describe, expect, it, vi } from 'vitest';
import type { CommitFinanceImportPreviewInput } from '@ppt/domain';
import { FinanceImportFileSessionRegistry } from '../src/main/finance-import-file-session.js';

const crc32 = (bytes: Uint8Array): number => {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
  }
  return (crc ^ 0xffffffff) >>> 0;
};

const storedZip = (entries: Readonly<Record<string, string>>): Uint8Array => {
  const locals: Buffer[] = [];
  const centrals: Buffer[] = [];
  let offset = 0;
  for (const [name, text] of Object.entries(entries)) {
    const nameBytes = Buffer.from(name);
    const content = Buffer.from(text);
    const checksum = crc32(content);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt32LE(checksum, 14);
    local.writeUInt32LE(content.length, 18);
    local.writeUInt32LE(content.length, 22);
    local.writeUInt16LE(nameBytes.length, 26);
    locals.push(local, nameBytes, content);
    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt32LE(checksum, 16);
    central.writeUInt32LE(content.length, 20);
    central.writeUInt32LE(content.length, 24);
    central.writeUInt16LE(nameBytes.length, 28);
    central.writeUInt32LE(offset, 42);
    centrals.push(central, nameBytes);
    offset += local.length + nameBytes.length + content.length;
  }
  const centralBytes = Buffer.concat(centrals);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(Object.keys(entries).length, 8);
  end.writeUInt16LE(Object.keys(entries).length, 10);
  end.writeUInt32LE(centralBytes.length, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, centralBytes, end]);
};

const registry = (): FinanceImportFileSessionRegistry => {
  let sequence = 0;
  return new FinanceImportFileSessionRegistry(() => 'a'.repeat(64), () => `id-${++sequence}`);
};

const commitInput = (
  previewId: string,
  mapping: CommitFinanceImportPreviewInput['mapping'] = {
    dateColumn: 'date', amountColumn: 'amount', amountMode: 'signed'
  }
): CommitFinanceImportPreviewInput => ({
  previewId,
  ownerPersonId: 'person-1',
  privacy: 'private',
  mapping,
  defaultCurrency: 'TRY',
  incomeCategoryId: 'category-income',
  expenseCategoryId: 'category-expense',
  duplicateStrategy: 'skip'
});

afterEach(() => vi.useRealTimers());

describe('33-D controlled finance import file session', () => {
  it('previews and resolves controlled CSV without exposing path or raw file', () => {
    const sessions = registry();
    const preview = sessions.createFilePreview({
      fileName: 'transactions.csv',
      bytes: new TextEncoder().encode('date;description;amount;currency;id\n2026-08-01;Market;-125,50;TRY;row-1\n2026-08-02;Refund;20;TRY;row-2'),
      now: new Date('2026-08-12T10:00:00.000Z')
    });
    expect(preview).toMatchObject({ sourceFormat: 'csv', totalRows: 2, rawFileRetained: false, filePathExposed: false });
    const resolved = sessions.resolve({
      previewId: preview.previewId,
      ownerPersonId: 'person-1',
      privacy: 'private',
      mapping: {
        dateColumn: 'date', descriptionColumn: 'description', amountColumn: 'amount',
        currencyColumn: 'currency', externalIdColumn: 'id', amountMode: 'signed'
      },
      defaultCurrency: 'TRY',
      incomeCategoryId: 'category-income',
      expenseCategoryId: 'category-expense',
      duplicateStrategy: 'skip'
    }, new Date('2026-08-12T10:01:00.000Z'));
    expect(resolved.rows).toEqual([
      expect.objectContaining({ direction: 'expense', amount: 125.5, categoryId: 'category-expense', externalId: 'row-1' }),
      expect.objectContaining({ direction: 'income', amount: 20, categoryId: 'category-income', externalId: 'row-2' })
    ]);
  });

  it('reads OFX and produces a network-free synthetic sandbox', () => {
    const sessions = registry();
    const ofx = sessions.createFilePreview({
      fileName: 'statement.ofx',
      bytes: new TextEncoder().encode('OFXHEADER:100\n<OFX><CURDEF>TRY<BANKTRANLIST><STMTTRN><DTPOSTED>20260801<TRNAMT>-42.25<FITID>x-1<NAME>Shop</STMTTRN></BANKTRANLIST></OFX>')
    });
    expect(ofx).toMatchObject({ sourceFormat: 'ofx', totalRows: 1 });
    const sandbox = sessions.createSandboxPreview(new Date('2026-08-12T10:00:00.000Z'));
    expect(sandbox).toMatchObject({ sourceMode: 'sandbox', sourceFormat: 'sandbox', totalRows: 4 });
    expect(sandbox.warnings.join(' ')).toMatch(/sentetik/i);
  });

  it('reads a bounded XLSX worksheet and rejects formulas', () => {
    const base = {
      'xl/workbook.xml': '<workbook xmlns:r="r"><sheets><sheet name="Sheet1" sheetId="1" r:id="rId1"/></sheets></workbook>',
      'xl/_rels/workbook.xml.rels': '<Relationships><Relationship Id="rId1" Target="worksheets/sheet1.xml"/></Relationships>'
    };
    const valid = storedZip({
      ...base,
      'xl/worksheets/sheet1.xml': '<worksheet><sheetData><row><c r="A1" t="inlineStr"><is><t>date</t></is></c><c r="B1" t="inlineStr"><is><t>amount</t></is></c></row><row><c r="A2" t="inlineStr"><is><t>2026-08-01</t></is></c><c r="B2"><v>-10</v></c></row></sheetData></worksheet>'
    });
    expect(registry().createFilePreview({ fileName: 'valid.xlsx', bytes: valid })).toMatchObject({ sourceFormat: 'xlsx', totalRows: 1 });
    const formula = storedZip({
      ...base,
      'xl/worksheets/sheet1.xml': '<worksheet><sheetData><row><c r="A1"><f>1+1</f><v>2</v></c><c r="B1"><v>x</v></c></row><row><c r="A2"><v>1</v></c><c r="B2"><v>2</v></c></row></sheetData></worksheet>'
    });
    expect(() => registry().createFilePreview({ fileName: 'formula.xlsx', bytes: formula })).toThrow(/Form/);
    const selfClosingFormula = storedZip({
      ...base,
      'xl/worksheets/sheet1.xml': '<worksheet><sheetData><row><c r="A1"><f/><v>2</v></c><c r="B1"><v>x</v></c></row><row><c r="A2"><v>1</v></c><c r="B2"><v>2</v></c></row></sheetData></worksheet>'
    });
    expect(() => registry().createFilePreview({ fileName: 'self-closing-formula.xlsx', bytes: selfClosingFormula })).toThrow(/Form/);
  });

  it('rejects malformed money instead of rewriting letters or conflicting signs', () => {
    for (const amount of ['1O0', 'abc123', '(-100)']) {
      const sessions = registry();
      const preview = sessions.createFilePreview({
        fileName: 'strict-money.csv',
        bytes: new TextEncoder().encode(`date,amount\n2026-08-01,${amount}`)
      });
      expect(() => sessions.resolve(commitInput(preview.previewId))).toThrow();
      sessions.dispose();
    }
  });

  it('rejects impossible ISO calendar dates and keeps exact dates stable', () => {
    const sessions = registry();
    const invalid = sessions.createFilePreview({
      fileName: 'invalid-date.csv',
      bytes: new TextEncoder().encode('date,amount\n2026-02-30,10')
    });
    expect(() => sessions.resolve(commitInput(invalid.previewId))).toThrow(/Tarih/);
    const valid = sessions.createFilePreview({
      fileName: 'valid-date.csv',
      bytes: new TextEncoder().encode('date,amount\n2026-02-28,10')
    });
    expect(sessions.resolve(commitInput(valid.previewId)).rows[0]?.occurredAt).toBe('2026-02-28T12:00:00.000Z');
    sessions.dispose();
  });

  it('uses the XLSX 1904 date epoch and scans every worksheet for formulas', () => {
    const date1904 = storedZip({
      'xl/workbook.xml': '<workbook xmlns:r="r"><workbookPr date1904="1"/><sheets><sheet name="Sheet1" sheetId="1" r:id="rId1"/></sheets></workbook>',
      'xl/_rels/workbook.xml.rels': '<Relationships><Relationship Id="rId1" Target="worksheets/sheet1.xml"/></Relationships>',
      'xl/worksheets/sheet1.xml': '<worksheet><sheetData><row><c r="A1" t="inlineStr"><is><t>date</t></is></c><c r="B1" t="inlineStr"><is><t>amount</t></is></c></row><row><c r="A2"><v>1</v></c><c r="B2"><v>10</v></c></row></sheetData></worksheet>'
    });
    const sessions = registry();
    const preview = sessions.createFilePreview({ fileName: 'date-1904.xlsx', bytes: date1904 });
    expect(preview.warnings.join(' ')).toMatch(/1904/u);
    expect(sessions.resolve(commitInput(preview.previewId)).rows[0]?.occurredAt).toBe('1904-01-02T00:00:00.000Z');
    sessions.dispose();

    const hiddenFormula = storedZip({
      'xl/workbook.xml': '<workbook xmlns:r="r"><sheets><sheet name="Sheet1" sheetId="1" r:id="rId1"/><sheet name="Sheet2" sheetId="2" r:id="rId2"/></sheets></workbook>',
      'xl/_rels/workbook.xml.rels': '<Relationships><Relationship Id="rId1" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Target="worksheets/sheet2.xml"/></Relationships>',
      'xl/worksheets/sheet1.xml': '<worksheet><sheetData><row><c r="A1"><v>date</v></c><c r="B1"><v>amount</v></c></row><row><c r="A2"><v>2026-08-01</v></c><c r="B2"><v>10</v></c></row></sheetData></worksheet>',
      'xl/worksheets/sheet2.xml': '<worksheet><sheetData><row><c r="A1"><f/><v>2</v></c></row></sheetData></worksheet>'
    });
    expect(() => registry().createFilePreview({ fileName: 'hidden-formula.xlsx', bytes: hiddenFormula })).toThrow(/Form/u);
  });

  it('rejects credential-bearing headers before exposing preview samples', () => {
    for (const header of ['password', 'access_token', 'client-secret', 'PIN', 'card_number', 'private_key', 'sertifika']) {
      expect(() => registry().createFilePreview({
        fileName: 'credential.csv',
        bytes: new TextEncoder().encode(`date,${header}\n2026-08-01,secret-value`)
      })).toThrow(/Kimlik|parola|token|PIN/u);
    }
  });

  it('binds previews to an owner token, reports exposure and expires with a timer', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-12T10:00:00.000Z'));
    const sessions = registry();
    const preview = sessions.createFilePreview({
      fileName: 'owned.csv',
      bytes: new TextEncoder().encode('date,amount\n2026-08-01,10'),
      ownerToken: 'auth-session-a'
    });
    expect(preview).toMatchObject({
      rawFileRetained: false,
      filePathExposed: false,
      parsedRowsRetainedUntilExpiry: true,
      sampleCellValuesExposed: true
    });
    expect(() => sessions.resolve(commitInput(preview.previewId), new Date(), 'auth-session-b')).toThrow(/bulunamad/u);
    expect(sessions.resolve(commitInput(preview.previewId), new Date(), 'auth-session-a').rows).toHaveLength(1);
    vi.advanceTimersByTime(15 * 60 * 1_000 + 1);
    expect(() => sessions.resolve(commitInput(preview.previewId), new Date(), 'auth-session-a')).toThrow(/bulunamad/u);
    sessions.dispose();
  });

  it('clears owner-scoped previews and permanently disposes the registry', () => {
    const sessions = registry();
    const first = sessions.createFilePreview({
      fileName: 'first.csv', bytes: new TextEncoder().encode('date,amount\n2026-08-01,10'), ownerToken: 'owner-a'
    });
    const second = sessions.createFilePreview({
      fileName: 'second.csv', bytes: new TextEncoder().encode('date,amount\n2026-08-02,20'), ownerToken: 'owner-b'
    });
    sessions.clear('owner-a');
    expect(() => sessions.resolve(commitInput(first.previewId), new Date(), 'owner-a')).toThrow(/bulunamad/u);
    expect(sessions.resolve(commitInput(second.previewId), new Date(), 'owner-b').rows).toHaveLength(1);
    sessions.dispose();
    expect(() => sessions.createSandboxPreview()).toThrow(/kapat/u);
  });
});

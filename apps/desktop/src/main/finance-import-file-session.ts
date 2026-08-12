import { inflateRawSync } from 'node:zlib';
import type {
  CommitFinanceImportPreparedBatchInput,
  CommitFinanceImportPreviewInput,
  FinanceImportPreviewView,
  FinanceImportSourceFormat,
  FinanceImportSourceMode
} from '@ppt/domain';

const MAX_FILE_BYTES = 5 * 1024 * 1024;
const MAX_ROWS = 5_000;
const MAX_COLUMNS = 64;
const MAX_CELL_CHARACTERS = 2_000;
const SESSION_TTL_MS = 15 * 60 * 1_000;
const MAX_SESSIONS = 8;
const UNBOUND_OWNER_TOKEN = 'finance-import-owner-unbound';

type XlsxDateSystem = '1900' | '1904';

interface ParsedTable {
  readonly sourceFormat: FinanceImportSourceFormat;
  readonly headers: readonly string[];
  readonly rows: readonly (readonly string[])[];
  readonly warnings: readonly string[];
  readonly xlsxDateSystem?: XlsxDateSystem;
}

interface FinanceImportSession extends ParsedTable {
  readonly previewId: string;
  readonly ownerToken: string;
  readonly sourceMode: FinanceImportSourceMode;
  readonly fileName: string;
  readonly fileSha256: string;
  readonly expiresAtMs: number;
}

type Sha256 = (bytes: Uint8Array) => string;
type CreateId = () => string;

const fail = (message: string): never => { throw new Error(message); };

const normalizedOwnerToken = (value?: string): string => {
  if (value === undefined) return UNBOUND_OWNER_TOKEN;
  const normalized = value.trim();
  if (normalized.length < 1 || normalized.length > 200 || /[\u0000-\u001f\u007f]/u.test(normalized)) {
    fail('Finans içe aktarma oturum sahibi belirteci geçersiz.');
  }
  return normalized;
};

const safeCell = (value: string): string => {
  const normalized = value.replaceAll('\u0000', '').trim();
  if (normalized.length > MAX_CELL_CHARACTERS) fail('İçe aktarma hücresi 2.000 karakter sınırını aşıyor.');
  return normalized;
};

const uniqueHeaders = (values: readonly string[]): readonly string[] => {
  const used = new Map<string, number>();
  return Object.freeze(values.map((value, index) => {
    const base = safeCell(value).slice(0, 120) || `Sütun ${index + 1}`;
    const key = base.toLocaleLowerCase('tr-TR');
    const sequence = (used.get(key) ?? 0) + 1;
    used.set(key, sequence);
    return sequence === 1 ? base : `${base} (${sequence})`;
  }));
};

const sensitiveHeader = (value: string): boolean => {
  const normalized = value.normalize('NFKC').trim().toLocaleLowerCase('tr-TR')
    .replaceAll('ı', 'i').replaceAll('ş', 's').replaceAll('ç', 'c')
    .replaceAll('ğ', 'g').replaceAll('ö', 'o').replaceAll('ü', 'u');
  return /(?:^|[^a-z0-9])(?:password|passwd|parola|sifre|pwd|token|access[ _-]*token|refresh[ _-]*token|secret|client[ _-]*secret|api[ _-]*key|private[ _-]*key|certificate|sertifika|credential|kimlik[ _-]*bilgisi|card[ _-]*number|kart[ _-]*numarasi|pan|cvv|cvc|pin)(?:$|[^a-z0-9])/u.test(normalized);
};

const buildTable = (
  sourceFormat: FinanceImportSourceFormat,
  matrix: readonly (readonly string[])[],
  warnings: readonly string[] = [],
  xlsxDateSystem?: XlsxDateSystem
): ParsedTable => {
  const nonEmpty = matrix.filter((row) => row.some((value) => value.trim().length > 0));
  if (nonEmpty.length < 2) fail('İçe aktarma dosyası başlık ve en az bir veri satırı içermelidir.');
  const width = Math.max(...nonEmpty.map((row) => row.length));
  if (width < 2 || width > MAX_COLUMNS) fail('İçe aktarma dosyası 2–64 sütun aralığında olmalıdır.');
  const headers = uniqueHeaders(Array.from({ length: width }, (_, index) => nonEmpty[0]?.[index] ?? ''));
  if (headers.some(sensitiveHeader)) {
    fail('Kimlik bilgisi, parola, token, PIN veya kart sırrı sütunu içeren dosya içe aktarılamaz.');
  }
  const rows = nonEmpty.slice(1).map((row) => Object.freeze(
    Array.from({ length: width }, (_, index) => safeCell(row[index] ?? ''))
  ));
  if (rows.length > MAX_ROWS) fail('İçe aktarma dosyası 5.000 satır sınırını aşıyor.');
  return Object.freeze({
    sourceFormat,
    headers,
    rows: Object.freeze(rows),
    warnings: Object.freeze([...warnings]),
    ...(xlsxDateSystem === undefined ? {} : { xlsxDateSystem })
  });
};

const parseDelimited = (text: string, delimiter: string): readonly (readonly string[])[] => {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index]!;
    if (quoted) {
      if (char === '"') {
        if (text[index + 1] === '"') { field += '"'; index += 1; }
        else quoted = false;
      } else field += char;
      continue;
    }
    if (char === '"' && field.length === 0) quoted = true;
    else if (char === delimiter) { row.push(field); field = ''; }
    else if (char === '\n') { row.push(field); rows.push(row); row = []; field = ''; }
    else if (char !== '\r') field += char;
    if (rows.length > MAX_ROWS + 2) fail('İçe aktarma dosyası 5.000 satır sınırını aşıyor.');
  }
  if (quoted) fail('CSV/TSV dosyasında kapanmamış alıntı alanı var.');
  row.push(field);
  if (row.some((value) => value.length > 0)) rows.push(row);
  return rows;
};

const detectDelimiter = (text: string, fileName: string): string => {
  if (fileName.toLowerCase().endsWith('.tsv')) return '\t';
  const sample = text.split(/\r?\n/u).slice(0, 5).join('\n');
  const score = (delimiter: string): number => {
    let count = 0;
    let quoted = false;
    for (const char of sample) {
      if (char === '"') quoted = !quoted;
      else if (!quoted && char === delimiter) count += 1;
    }
    return count;
  };
  return [',',';','\t'].sort((left, right) => score(right) - score(left))[0]!;
};

const decodeUtf8 = (bytes: Uint8Array): string => {
  try { return new TextDecoder('utf-8', { fatal: true }).decode(bytes).replace(/^\uFEFF/u, ''); }
  catch { return fail('Dosya geçerli UTF-8 metni değil.'); }
};

const xmlDecode = (value: string): string => value
  .replaceAll('&lt;', '<').replaceAll('&gt;', '>').replaceAll('&quot;', '"')
  .replaceAll('&apos;', "'").replaceAll('&amp;', '&')
  .replace(/&#(\d+);/gu, (_match, code: string) => String.fromCodePoint(Number(code)))
  .replace(/&#x([0-9a-f]+);/giu, (_match, code: string) => String.fromCodePoint(Number.parseInt(code, 16)));

const crc32 = (bytes: Uint8Array): number => {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
  }
  return (crc ^ 0xffffffff) >>> 0;
};

const normalizeZipName = (value: string): string => {
  const parts: string[] = [];
  for (const part of value.replaceAll('\\', '/').split('/')) {
    if (!part || part === '.') continue;
    if (part === '..') { if (parts.length === 0) fail('XLSX arşiv yolu geçersiz.'); parts.pop(); }
    else parts.push(part);
  }
  return parts.join('/');
};

const readZipEntries = (bytes: Uint8Array): ReadonlyMap<string, Uint8Array> => {
  const archive = Buffer.from(bytes);
  let eocd = -1;
  for (let offset = archive.length - 22; offset >= Math.max(0, archive.length - 65_557); offset -= 1) {
    if (archive.readUInt32LE(offset) === 0x06054b50) { eocd = offset; break; }
  }
  if (eocd < 0) fail('XLSX merkez dizini bulunamadı.');
  const entryCount = archive.readUInt16LE(eocd + 10);
  const centralSize = archive.readUInt32LE(eocd + 12);
  const centralOffset = archive.readUInt32LE(eocd + 16);
  if (entryCount < 1 || entryCount > 128 || centralOffset + centralSize > eocd) fail('XLSX arşiv sınırları geçersiz.');
  const entries = new Map<string, Uint8Array>();
  let cursor = centralOffset;
  let totalUncompressed = 0;
  for (let index = 0; index < entryCount; index += 1) {
    if (archive.readUInt32LE(cursor) !== 0x02014b50) fail('XLSX merkez dizini bozuk.');
    const flags = archive.readUInt16LE(cursor + 8);
    const method = archive.readUInt16LE(cursor + 10);
    const expectedCrc = archive.readUInt32LE(cursor + 16);
    const compressedSize = archive.readUInt32LE(cursor + 20);
    const uncompressedSize = archive.readUInt32LE(cursor + 24);
    const nameLength = archive.readUInt16LE(cursor + 28);
    const extraLength = archive.readUInt16LE(cursor + 30);
    const commentLength = archive.readUInt16LE(cursor + 32);
    const localOffset = archive.readUInt32LE(cursor + 42);
    if ((flags & 1) !== 0 || ![0,8].includes(method) || uncompressedSize > 10 * 1024 * 1024) {
      fail('XLSX şifreleme/sıkıştırma veya boyut sınırı desteklenmiyor.');
    }
    const name = normalizeZipName(archive.subarray(cursor + 46, cursor + 46 + nameLength).toString('utf8'));
    if (!name || entries.has(name) || localOffset + 30 > archive.length || archive.readUInt32LE(localOffset) !== 0x04034b50) {
      fail('XLSX arşiv girdisi geçersiz.');
    }
    const localNameLength = archive.readUInt16LE(localOffset + 26);
    const localExtraLength = archive.readUInt16LE(localOffset + 28);
    const dataOffset = localOffset + 30 + localNameLength + localExtraLength;
    if (dataOffset + compressedSize > archive.length) fail('XLSX arşiv girdisi eksik.');
    const compressed = archive.subarray(dataOffset, dataOffset + compressedSize);
    const content = method === 0 ? Buffer.from(compressed) : inflateRawSync(compressed, { maxOutputLength: 10 * 1024 * 1024 });
    if (content.length !== uncompressedSize || crc32(content) !== expectedCrc) fail('XLSX arşiv girdisi bütünlük denetimini geçemedi.');
    totalUncompressed += content.length;
    if (totalUncompressed > 20 * 1024 * 1024) fail('XLSX açılmış içerik sınırını aşıyor.');
    entries.set(name, content);
    cursor += 46 + nameLength + extraLength + commentLength;
  }
  return entries;
};

const xmlText = (entries: ReadonlyMap<string, Uint8Array>, name: string): string => {
  const bytes = entries.get(name);
  if (bytes === undefined) throw new Error(`XLSX bileşeni eksik: ${name}.`);
  const text = decodeUtf8(bytes);
  if (/<!DOCTYPE|<!ENTITY/iu.test(text)) fail('XLSX XML varlık tanımlarına izin verilmez.');
  return text;
};

const columnIndex = (reference: string): number => {
  const letters = reference.match(/^[A-Z]+/u)?.[0];
  if (!letters) return -1;
  let result = 0;
  for (const letter of letters) result = result * 26 + letter.charCodeAt(0) - 64;
  return result - 1;
};

const parseXlsx = (bytes: Uint8Array): ParsedTable => {
  const entries = readZipEntries(bytes);
  for (const name of entries.keys()) {
    if (/vbaProject\.bin|externalLinks\/|connections\.xml/iu.test(name)) {
      fail('Makro, dış bağlantı veya veri bağlantısı içeren XLSX kabul edilmez.');
    }
  }
  const workbook = xmlText(entries, 'xl/workbook.xml');
  const relationships = xmlText(entries, 'xl/_rels/workbook.xml.rels');
  const xlsxDateSystem: XlsxDateSystem = /<workbookPr\b[^>]*\bdate1904\s*=\s*["'](?:1|true)["']/iu.test(workbook)
    ? '1904'
    : '1900';
  for (const name of entries.keys()) {
    if (!/^xl\/worksheets\/[^/]+\.xml$/iu.test(name)) continue;
    const worksheet = xmlText(entries, name);
    if (/<f(?:\s|\/?>)/iu.test(worksheet)) {
      fail('Formül içeren XLSX kabul edilmez; önce değerleri sabitleyin.');
    }
  }
  const firstSheet = workbook.match(/<sheet\b[^>]*\br:id="([^"]+)"[^>]*>/iu);
  if (firstSheet === null) throw new Error('XLSX çalışma sayfası bulunamadı.');
  const relationshipPattern = /<Relationship\b[^>]*\bId="([^"]+)"[^>]*\bTarget="([^"]+)"[^>]*\/?\s*>/giu;
  const targets = new Map<string, string>();
  for (const match of relationships.matchAll(relationshipPattern)) targets.set(match[1]!, match[2]!);
  const target = targets.get(firstSheet[1]!);
  if (target === undefined) throw new Error('XLSX sayfa ilişkisi bulunamadı.');
  const sheetName = normalizeZipName(target.startsWith('/') ? target.slice(1) : `xl/${target}`);
  const sheet = xmlText(entries, sheetName);
  const sharedStrings: string[] = [];
  if (entries.has('xl/sharedStrings.xml')) {
    const shared = xmlText(entries, 'xl/sharedStrings.xml');
    for (const item of shared.matchAll(/<si\b[^>]*>([\s\S]*?)<\/si>/giu)) {
      const parts = [...item[1]!.matchAll(/<t\b[^>]*>([\s\S]*?)<\/t>/giu)].map((match) => xmlDecode(match[1]!));
      sharedStrings.push(parts.join(''));
    }
  }
  const matrix: string[][] = [];
  for (const rowMatch of sheet.matchAll(/<row\b[^>]*>([\s\S]*?)<\/row>/giu)) {
    const row: string[] = [];
    for (const cell of rowMatch[1]!.matchAll(/<c\b([^>]*)>([\s\S]*?)<\/c>/giu)) {
      const reference = cell[1]!.match(/\br="([A-Z]+\d+)"/u)?.[1] ?? '';
      const index = columnIndex(reference);
      if (index < 0 || index >= MAX_COLUMNS) fail('XLSX sütun sınırı geçersiz.');
      const type = cell[1]!.match(/\bt="([^"]+)"/u)?.[1];
      const raw = cell[2]!.match(/<v\b[^>]*>([\s\S]*?)<\/v>/iu)?.[1]
        ?? cell[2]!.match(/<t\b[^>]*>([\s\S]*?)<\/t>/iu)?.[1]
        ?? '';
      const decoded = xmlDecode(raw);
      row[index] = type === 's' ? sharedStrings[Number(decoded)] ?? '' : decoded;
    }
    matrix.push(row);
    if (matrix.length > MAX_ROWS + 1) fail('XLSX 5.000 veri satırı sınırını aşıyor.');
  }
  return buildTable('xlsx', matrix, [
    'Yalnız ilk çalışma sayfası hareket verisi olarak okundu; formül denetimi tüm çalışma sayfalarına uygulandı.',
    'Formül, makro ve dış bağlantılar reddedilir.',
    `Excel tarih sistemi: ${xlsxDateSystem === '1904' ? '1904' : '1900'}.`
  ], xlsxDateSystem);
};

const ofxTag = (block: string, name: string): string => block.match(new RegExp(`<${name}>\\s*([^<\\r\\n]+)`, 'iu'))?.[1]?.trim() ?? '';

const parseOfx = (text: string, sourceFormat: 'ofx'|'qfx'): ParsedTable => {
  const currency = ofxTag(text, 'CURDEF').toUpperCase() || 'TRY';
  const rows: string[][] = [['date','description','amount','currency','external_id','direction']];
  const blocks = [...text.matchAll(/<STMTTRN>([\s\S]*?)(?=<STMTTRN>|<\/BANKTRANLIST>|<\/STMTTRN>|$)/giu)];
  for (const match of blocks) {
    const block = match[1]!;
    const amount = ofxTag(block, 'TRNAMT');
    const name = ofxTag(block, 'NAME');
    const memo = ofxTag(block, 'MEMO');
    rows.push([
      ofxTag(block, 'DTPOSTED'),
      [name, memo].filter(Boolean).join(' · '),
      amount,
      currency,
      ofxTag(block, 'FITID'),
      Number(amount.replace(',', '.')) < 0 ? 'expense' : 'income'
    ]);
    if (rows.length > MAX_ROWS + 1) fail('OFX/QFX 5.000 hareket sınırını aşıyor.');
  }
  if (rows.length === 1) fail('OFX/QFX dosyasında STMTTRN hareketi bulunamadı.');
  return buildTable(sourceFormat, rows, ['OFX/QFX hareketleri gerçekleşmiş kayıt olarak içe alınır.']);
};

const parseFile = (fileName: string, bytes: Uint8Array): ParsedTable => {
  if (bytes.byteLength < 1 || bytes.byteLength > MAX_FILE_BYTES) fail('İçe aktarma dosyası 1 bayt–5 MiB aralığında olmalıdır.');
  const lower = fileName.toLowerCase();
  if (lower.endsWith('.xlsx')) return parseXlsx(bytes);
  if (lower.endsWith('.ofx') || lower.endsWith('.qfx')) return parseOfx(decodeUtf8(bytes), lower.endsWith('.qfx') ? 'qfx' : 'ofx');
  if (!lower.endsWith('.csv') && !lower.endsWith('.tsv')) fail('Yalnız CSV, TSV, XLSX, OFX ve QFX dosyaları kabul edilir.');
  const text = decodeUtf8(bytes);
  const delimiter = detectDelimiter(text, fileName);
  return buildTable(delimiter === '\t' ? 'tsv' : 'csv', parseDelimited(text, delimiter), [
    `Ayraç: ${delimiter === '\t' ? 'sekme' : delimiter}`
  ]);
};

const parseMoney = (raw: string): number => {
  const trimmed = raw.trim();
  if (trimmed.length === 0) fail('Tutar boş olamaz.');
  const accounting = trimmed.match(/^\((.*)\)$/u);
  let value = (accounting?.[1] ?? trimmed).replace(/[\s\u00a0]/gu, '');
  if (accounting && /[+-]/u.test(value)) fail(`Tutar işareti çelişkili: ${raw.slice(0, 40)}`);

  let sign = '';
  if (/^[+-]/u.test(value)) { sign = value[0]!; value = value.slice(1); }
  const currencyPrefix = value.match(/^(?:[A-Z]{3}|[₺$€£])/u)?.[0];
  if (currencyPrefix) value = value.slice(currencyPrefix.length);
  if (!sign && /^[+-]/u.test(value)) { sign = value[0]!; value = value.slice(1); }
  const currencySuffix = value.match(/(?:[A-Z]{3}|[₺$€£])$/u)?.[0];
  if (currencySuffix) value = value.slice(0, -currencySuffix.length);
  if (currencyPrefix && currencySuffix) fail(`Tutar para birimi gösterimi belirsiz: ${raw.slice(0, 40)}`);
  if (!/^\d+(?:[.,]\d+)*$/u.test(value)) fail(`Tutar okunamadı: ${raw.slice(0, 40)}`);

  const validateGroupedInteger = (candidate: string, separator: string): string => {
    const groups = candidate.split(separator);
    if (groups[0]!.length < 1 || groups[0]!.length > 3 || groups.slice(1).some((group) => group.length !== 3)) {
      fail(`Tutar binlik gruplaması geçersiz: ${raw.slice(0, 40)}`);
    }
    return groups.join('');
  };
  const comma = value.lastIndexOf(',');
  const dot = value.lastIndexOf('.');
  let normalized: string;
  if (comma >= 0 && dot >= 0) {
    const decimal = comma > dot ? ',' : '.';
    const grouping = decimal === ',' ? '.' : ',';
    if (value.split(decimal).length !== 2) fail(`Tutar ondalık gösterimi geçersiz: ${raw.slice(0, 40)}`);
    const [integerPart, fractionPart] = value.split(decimal);
    if (!fractionPart || fractionPart.length > 2 || fractionPart.includes(grouping)) {
      fail(`Tutar ondalık basamak sayısı geçersiz: ${raw.slice(0, 40)}`);
    }
    normalized = `${validateGroupedInteger(integerPart!, grouping)}.${fractionPart}`;
  } else if (comma >= 0 || dot >= 0) {
    const separator = comma >= 0 ? ',' : '.';
    const groups = value.split(separator);
    if (groups.length === 2 && groups[1]!.length >= 1 && groups[1]!.length <= 2) {
      normalized = `${groups[0]}.${groups[1]}`;
    } else {
      normalized = validateGroupedInteger(value, separator);
    }
  } else normalized = value;
  const number = Number(`${accounting ? '-' : sign}${normalized}`);
  if (!Number.isFinite(number) || Math.abs(number) > 1_000_000_000_000_000) fail('Tutar güvenli finans sınırını aşıyor.');
  return number;
};

const parseDirection = (raw: string): 'income'|'expense' => {
  const value = raw.trim().toLocaleLowerCase('tr-TR').replaceAll('ı', 'i');
  if (['income','credit','alacak','gelir','giriş','giris','c'].includes(value)) return 'income';
  if (['expense','debit','borç','borc','gider','çıkış','cikis','d'].includes(value)) return 'expense';
  return fail(`Gelir/gider yönü okunamadı: ${raw.slice(0, 40)}`);
};

const validCalendarDate = (year: number, month: number, day: number): boolean => {
  const date = new Date(Date.UTC(year, month - 1, day, 12));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
};

const parseDateValue = (
  raw: string,
  sourceFormat: FinanceImportSourceFormat,
  xlsxDateSystem: XlsxDateSystem = '1900'
): string => {
  const value = raw.trim();
  if (sourceFormat === 'xlsx' && /^\d+(?:\.\d+)?$/u.test(value)) {
    const serial = Number(value);
    if (!Number.isFinite(serial) || serial < (xlsxDateSystem === '1904' ? 0 : 1) || serial > 2_958_465) {
      fail(`Excel tarih seri numarası geçersiz: ${value}`);
    }
    const wholeDays = Math.floor(serial);
    if (xlsxDateSystem === '1900' && wholeDays === 60) {
      fail('Excel 1900 tarih sistemindeki geçersiz 29.02.1900 seri tarihi kabul edilmez.');
    }
    const epoch = xlsxDateSystem === '1904'
      ? Date.UTC(1904, 0, 1)
      : Date.UTC(1899, 11, wholeDays < 60 ? 31 : 30);
    return new Date(epoch + Math.round(serial * 86_400_000)).toISOString();
  }
  const ofx = value.match(/^(\d{4})(\d{2})(\d{2})(\d{2})?(\d{2})?(\d{2})?(?:\.\d+)?(?:\[[^\]]+\])?$/u);
  if (ofx) {
    const [year, month, day] = [Number(ofx[1]), Number(ofx[2]), Number(ofx[3])];
    const [hour, minute, second] = [Number(ofx[4] ?? 12), Number(ofx[5] ?? 0), Number(ofx[6] ?? 0)];
    if (!validCalendarDate(year, month, day) || hour > 23 || minute > 59 || second > 59) fail(`Tarih geçersiz: ${value}`);
    return new Date(Date.UTC(year, month - 1, day, hour, minute, second)).toISOString();
  }
  const dayFirst = value.match(/^(\d{1,2})[.\/-](\d{1,2})[.\/-](\d{4})$/u);
  if (dayFirst) {
    const [day, month, year] = [Number(dayFirst[1]), Number(dayFirst[2]), Number(dayFirst[3])];
    if (!validCalendarDate(year, month, day)) fail(`Tarih geçersiz: ${value}`);
    return new Date(Date.UTC(year, month - 1, day, 12)).toISOString();
  }
  const iso = value.match(/^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,3}))?)?(Z|[+-]\d{2}:\d{2}))?$/u);
  if (iso) {
    const [year, month, day] = [Number(iso[1]), Number(iso[2]), Number(iso[3])];
    if (!validCalendarDate(year, month, day)) fail(`Tarih geçersiz: ${value}`);
    if (iso[4] === undefined) return new Date(Date.UTC(year, month - 1, day, 12)).toISOString();
    const [hour, minute, second] = [Number(iso[4]), Number(iso[5]), Number(iso[6] ?? 0)];
    const zone = iso[8]!;
    const zoneMatch = zone === 'Z' ? undefined : zone.match(/^[+-](\d{2}):(\d{2})$/u);
    if (hour > 23 || minute > 59 || second > 59
      || (zone !== 'Z' && ((zoneMatch === null || zoneMatch === undefined)
        || Number(zoneMatch[1]) > 23
        || Number(zoneMatch[2]) > 59))) {
      fail(`Tarih geçersiz: ${value}`);
    }
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) fail(`Tarih okunamadı: ${value.slice(0, 40)}`);
    return parsed.toISOString();
  }
  return fail(`Tarih okunamadı: ${value.slice(0, 40)}`);
};

export interface FinanceOpenBankingAdapterPort {
  readonly adapterContract: 'ohvps-v1-local';
  readonly supportedModes: readonly ['sandbox','manual_fallback'];
  readonly networkAccess: 'not_performed';
  readonly credentialCollection: 'prohibited';
  readonly externalConsent: 'not_performed';
  createSyntheticMatrix(now: Date): readonly (readonly string[])[];
}

export class LocalOhvpsSandboxAdapter implements FinanceOpenBankingAdapterPort {
  public readonly adapterContract = 'ohvps-v1-local' as const;
  public readonly supportedModes = Object.freeze(['sandbox','manual_fallback'] as const);
  public readonly networkAccess = 'not_performed' as const;
  public readonly credentialCollection = 'prohibited' as const;
  public readonly externalConsent = 'not_performed' as const;

  public createSyntheticMatrix(now: Date): readonly (readonly string[])[] {
    const day = (offset: number): string => new Date(now.getTime() - offset * 86_400_000).toISOString().slice(0, 10);
    return Object.freeze([
      Object.freeze(['date','description','amount','currency','external_id','direction']),
      Object.freeze([day(5),'OHVPS sentetik maaş hareketi','42500.00','TRY','sandbox-income-001','income']),
      Object.freeze([day(4),'OHVPS sentetik market hareketi','-1864.35','TRY','sandbox-expense-001','expense']),
      Object.freeze([day(2),'OHVPS sentetik fatura hareketi','-742.80','TRY','sandbox-expense-002','expense']),
      Object.freeze([day(1),'OHVPS sentetik iade hareketi','320.00','TRY','sandbox-income-002','income'])
    ]);
  }
}

export class FinanceImportFileSessionRegistry {
  readonly #sessions = new Map<string, FinanceImportSession>();
  readonly #expiryTimers = new Map<string, ReturnType<typeof setTimeout>>();
  #disposed = false;

  public constructor(
    private readonly sha256: Sha256,
    private readonly createId: CreateId,
    private readonly openBankingAdapter: FinanceOpenBankingAdapterPort = new LocalOhvpsSandboxAdapter()
  ) {}

  public createFilePreview(input: {
    readonly fileName: string;
    readonly bytes: Uint8Array;
    readonly now?: Date;
    readonly ownerToken?: string;
  }): FinanceImportPreviewView {
    this.#assertActive();
    const table = parseFile(input.fileName, input.bytes);
    return this.#createSession(
      'controlled_file',
      input.fileName,
      this.sha256(input.bytes),
      table,
      input.now ?? new Date(),
      normalizedOwnerToken(input.ownerToken)
    );
  }

  public createSandboxPreview(now = new Date(), ownerToken?: string): FinanceImportPreviewView {
    this.#assertActive();
    const table = buildTable('sandbox', this.openBankingAdapter.createSyntheticMatrix(now), [
      'Bu hareketler tamamen sentetiktir; banka hesabına bağlantı kurulmadı.',
      'Kimlik bilgisi, token veya harici onay toplanmadı.'
    ]);
    const canonical = new TextEncoder().encode(JSON.stringify({ headers: table.headers, rows: table.rows }));
    return this.#createSession(
      'sandbox',
      'OHVPS-Sandbox-Sentetik.ofx',
      this.sha256(canonical),
      table,
      now,
      normalizedOwnerToken(ownerToken)
    );
  }

  public resolve(
    input: CommitFinanceImportPreviewInput,
    now = new Date(),
    ownerToken?: string
  ): CommitFinanceImportPreparedBatchInput {
    this.#assertActive();
    this.#prune(now.getTime());
    const session = this.#sessions.get(input.previewId);
    if (session === undefined || session.ownerToken !== normalizedOwnerToken(ownerToken)) {
      throw new Error('Finans içe aktarma önizlemesi bulunamadı; dosyayı yeniden seçin.');
    }
    if (session.expiresAtMs <= now.getTime()) throw new Error('Finans içe aktarma önizlemesi süresi doldu; dosyayı yeniden seçin.');
    if (!/^[A-Z]{3}$/u.test(input.defaultCurrency)) fail('Varsayılan para birimi üç büyük harf olmalıdır.');
    const headerIndex = new Map(session.headers.map((header, index) => [header, index]));
    const selected = [
      input.mapping.dateColumn,input.mapping.descriptionColumn,input.mapping.amountColumn,
      input.mapping.debitColumn,input.mapping.creditColumn,input.mapping.directionColumn,
      input.mapping.currencyColumn,input.mapping.externalIdColumn
    ].filter((value): value is string => Boolean(value));
    if (selected.some((header) => !headerIndex.has(header)) || new Set(selected).size !== selected.length) {
      fail('Sütun eşlemesi dosya başlıklarıyla uyuşmuyor veya aynı sütun birden fazla kez kullanılıyor.');
    }
    if (input.mapping.amountMode === 'debit_credit_columns') {
      if (!input.mapping.debitColumn && !input.mapping.creditColumn) fail('Borç/alacak eşlemesi için en az bir tutar sütunu gerekir.');
    } else if (!input.mapping.amountColumn) fail('Tutar sütunu seçilmelidir.');
    if (input.mapping.amountMode === 'absolute_with_direction' && !input.mapping.directionColumn) {
      fail('Mutlak tutar eşlemesinde gelir/gider yönü sütunu gerekir.');
    }
    const read = (row: readonly string[], header?: string): string => header ? row[headerIndex.get(header)!] ?? '' : '';
    const rows = session.rows.map((row, index) => {
      let direction: 'income'|'expense';
      let amount: number;
      if (input.mapping.amountMode === 'debit_credit_columns') {
        const debitRaw = read(row, input.mapping.debitColumn);
        const creditRaw = read(row, input.mapping.creditColumn);
        const debit = debitRaw ? Math.abs(parseMoney(debitRaw)) : 0;
        const credit = creditRaw ? Math.abs(parseMoney(creditRaw)) : 0;
        if ((debit > 0) === (credit > 0)) fail(`${index + 2}. satırda borç ve alacak tutarlarından tam biri dolu olmalıdır.`);
        direction = debit > 0 ? 'expense' : 'income';
        amount = debit || credit;
      } else {
        const parsed = parseMoney(read(row, input.mapping.amountColumn));
        if (parsed === 0) fail(`${index + 2}. satırda sıfır tutar kabul edilmez.`);
        direction = input.mapping.amountMode === 'absolute_with_direction'
          ? parseDirection(read(row, input.mapping.directionColumn))
          : parsed < 0 ? 'expense' : 'income';
        amount = Math.abs(parsed);
      }
      const categoryId = direction === 'income' ? input.incomeCategoryId : input.expenseCategoryId;
      if (categoryId === undefined || categoryId.length === 0) {
        throw new Error(`${index + 2}. satır için ${direction === 'income' ? 'gelir' : 'gider'} kategorisi seçilmedi.`);
      }
      const currency = (read(row, input.mapping.currencyColumn) || input.defaultCurrency).trim().toUpperCase();
      if (!/^[A-Z]{3}$/u.test(currency)) fail(`${index + 2}. satır para birimi geçersiz.`);
      const description = read(row, input.mapping.descriptionColumn).trim();
      const externalId = read(row, input.mapping.externalIdColumn).trim();
      if (description.length > 240 || externalId.length > 160) fail(`${index + 2}. satır açıklama/referans sınırını aşıyor.`);
      return Object.freeze({
        categoryId,
        direction,
        amount: Math.round((amount + Number.EPSILON) * 100) / 100,
        currency,
        occurredAt: parseDateValue(
          read(row, input.mapping.dateColumn),
          session.sourceFormat,
          session.xlsxDateSystem
        ),
        ...(description ? { description } : {}),
        ...(externalId ? { externalId } : {}),
        sourceRowNumber: index + 2
      });
    });
    return Object.freeze({
      ownerPersonId: input.ownerPersonId,
      privacy: input.privacy,
      sourceMode: session.sourceMode,
      sourceFormat: session.sourceFormat,
      fileName: session.fileName,
      fileSha256: session.fileSha256,
      mapping: Object.freeze({ ...input.mapping }),
      defaultCurrency: input.defaultCurrency,
      duplicateStrategy: input.duplicateStrategy,
      totalRows: rows.length,
      rows: Object.freeze(rows)
    });
  }

  public consume(previewId: string, ownerToken?: string): void {
    this.#assertActive();
    const session = this.#sessions.get(previewId);
    if (session === undefined) return;
    if (session.ownerToken !== normalizedOwnerToken(ownerToken)) {
      throw new Error('Finans içe aktarma önizlemesi bulunamadı; dosyayı yeniden seçin.');
    }
    this.#deleteSession(previewId);
  }

  public clear(ownerToken?: string): void {
    const normalized = ownerToken === undefined ? undefined : normalizedOwnerToken(ownerToken);
    for (const [id, session] of this.#sessions) {
      if (normalized === undefined || session.ownerToken === normalized) this.#deleteSession(id);
    }
  }

  public dispose(): void {
    if (this.#disposed) return;
    this.clear();
    this.#disposed = true;
  }

  #createSession(
    sourceMode: FinanceImportSourceMode,
    fileName: string,
    fileSha256: string,
    table: ParsedTable,
    now: Date,
    ownerToken: string
  ): FinanceImportPreviewView {
    this.#prune(now.getTime());
    while (this.#sessions.size >= MAX_SESSIONS) this.#deleteSession(this.#sessions.keys().next().value as string);
    const previewId = `finance-import-preview-${this.createId()}`;
    const session: FinanceImportSession = Object.freeze({
      ...table,previewId,ownerToken,sourceMode,fileName,fileSha256,expiresAtMs: now.getTime() + SESSION_TTL_MS
    });
    this.#sessions.set(previewId, session);
    const timer = setTimeout(() => this.#deleteSession(previewId), SESSION_TTL_MS);
    timer.unref();
    this.#expiryTimers.set(previewId, timer);
    return Object.freeze({
      previewId,fileName,sourceMode,sourceFormat: table.sourceFormat,fileSha256,
      headers: table.headers,
      sampleRows: Object.freeze(table.rows.slice(0, 20).map((values, index) => Object.freeze({ rowNumber: index + 2, values }))),
      totalRows: table.rows.length,
      expiresAt: new Date(session.expiresAtMs).toISOString(),
      warnings: table.warnings,
      rawFileRetained: false,
      filePathExposed: false,
      parsedRowsRetainedUntilExpiry: true,
      sampleCellValuesExposed: true
    });
  }

  #prune(nowMs: number): void {
    for (const [id, session] of this.#sessions) if (session.expiresAtMs <= nowMs) this.#deleteSession(id);
  }

  #deleteSession(previewId: string): void {
    this.#sessions.delete(previewId);
    const timer = this.#expiryTimers.get(previewId);
    if (timer !== undefined) clearTimeout(timer);
    this.#expiryTimers.delete(previewId);
  }

  #assertActive(): void {
    if (this.#disposed) throw new Error('Finans içe aktarma oturum kaydı kapatıldı.');
  }
}

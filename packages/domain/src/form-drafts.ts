export type FormDraftOperation = 'save' | 'undo';

export type FormDraftJsonValue =
  | null
  | boolean
  | number
  | string
  | readonly FormDraftJsonValue[]
  | { readonly [key: string]: FormDraftJsonValue };

export interface FormDraftView {
  readonly resourceId: string;
  readonly familyId: string;
  readonly accountId: string;
  readonly ownerPersonId: string;
  readonly formKey: string;
  readonly revision: number;
  readonly payloadJson: string;
  readonly payloadFingerprint: string;
  readonly updatedAt: string;
}

export interface FormDraftHistoryEntryView {
  readonly mutationId: string;
  readonly operation: FormDraftOperation;
  readonly revision: number;
  readonly restoredFromRevision: number | null;
  readonly payloadFingerprint: string;
  readonly createdAt: string;
}

export interface FormDraftWorkspaceView {
  readonly current: FormDraftView | null;
  readonly history: readonly FormDraftHistoryEntryView[];
}

export interface SaveFormDraftInput {
  readonly formKey: string;
  readonly expectedRevision: number;
  readonly clientOperationId: string;
  readonly payload: Readonly<Record<string, FormDraftJsonValue>>;
}

export interface UndoFormDraftInput {
  readonly formKey: string;
  readonly expectedRevision: number;
  readonly clientOperationId: string;
}

export const FORM_DRAFT_MAX_PAYLOAD_BYTES = 65_536;

const prohibitedBankingSecretFields = new Set([
  'pan', 'fullpan', 'cardnumber', 'creditcardnumber', 'debitcardnumber', 'cvv', 'cvc',
  'cvv2', 'cvc2', 'pin', 'password', 'bankpassword', 'bankingpassword',
  'internetbankingpassword', 'internetbankaciligiparolasi', 'internetbankaciligisifresi'
]);

const canonicalFieldName = (value: string): string => value
  .normalize('NFKD')
  .replace(/[ıİ]/gu, 'i')
  .replace(/[\u0300-\u036f]/gu, '')
  .replace(/[^a-z0-9]/giu, '')
  .toLocaleLowerCase('en-US');

const isPlainObject = (value: unknown): value is Record<string, unknown> => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
};

const canonicalizeValue = (value: unknown, seen: Set<object>): string => {
  if (value === null || typeof value === 'boolean' || typeof value === 'string') return JSON.stringify(value);
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new TypeError('Form draft payload numbers must be finite');
    return JSON.stringify(value);
  }
  if (typeof value !== 'object') throw new TypeError('Form draft payload must contain only JSON values');
  if (seen.has(value)) throw new TypeError('Form draft payload must not be cyclic');
  seen.add(value);
  try {
    if (Array.isArray(value)) return `[${value.map((item) => canonicalizeValue(item, seen)).join(',')}]`;
    if (!isPlainObject(value)) throw new TypeError('Form draft payload objects must be plain objects');
    const entries = Object.keys(value).sort().map((key) => {
      if (prohibitedBankingSecretFields.has(canonicalFieldName(key))) {
        throw new TypeError(`Form draft payload contains prohibited banking secret field: ${key}`);
      }
      return `${JSON.stringify(key)}:${canonicalizeValue(value[key], seen)}`;
    });
    return `{${entries.join(',')}}`;
  } finally {
    seen.delete(value);
  }
};

export const canonicalizeFormDraftPayload = (payload: unknown): string => {
  if (!isPlainObject(payload)) throw new TypeError('Form draft payload must be a JSON object');
  const payloadJson = canonicalizeValue(payload, new Set());
  let byteLength = 0;
  for (const character of payloadJson) {
    const codePoint = character.codePointAt(0)!;
    byteLength += codePoint <= 0x7f ? 1 : codePoint <= 0x7ff ? 2 : codePoint <= 0xffff ? 3 : 4;
  }
  if (byteLength > FORM_DRAFT_MAX_PAYLOAD_BYTES) {
    throw new TypeError('Form draft payload must not exceed 65536 UTF-8 bytes');
  }
  return payloadJson;
};

export const createFormDraftResourceId = (accountId: string, formKey: string): string => {
  if (!accountId.trim() || accountId !== accountId.trim()) throw new TypeError('accountId must be non-empty and trimmed');
  if (!/^[A-Za-z0-9._:-]{3,128}$/u.test(formKey)) throw new TypeError('formKey is invalid');
  return `form_draft/${accountId}/${formKey}`;
};

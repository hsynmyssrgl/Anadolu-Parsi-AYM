import type {
  BankInstitutionView,
  IbanStructuralErrorCode,
  IbanStructuralValidationView
} from '@ppt/domain';

export const BANK_ACCOUNT_INPUT_KEYS = Object.freeze([
  'ownerPersonId',
  'institutionCode',
  'iban',
  'accountType',
  'currency',
  'alias',
  'branch',
  'ownershipBasisPoints',
  'status',
  'privacy'
] as const);

export const FINANCE_RECORD_INPUT_KEYS = Object.freeze([
  'ownerPersonId',
  'title',
  'kind',
  'amount',
  'currency',
  'privacy',
  'notes',
  'occurredAt',
  'dueAt',
  'remainingPrincipal',
  'symbol'
] as const);

export const FINANCE_VALUATION_INPUT_KEYS = Object.freeze([
  'financeRecordId',
  'valueDate',
  'unitPrice',
  'quantity',
  'provider'
] as const);

export const PROHIBITED_BANKING_SECRET_FIELDS = Object.freeze([
  'pan',
  'fullPan',
  'cardNumber',
  'creditCardNumber',
  'debitCardNumber',
  'cvv',
  'cvc',
  'cvv2',
  'cvc2',
  'pin',
  'password',
  'bankPassword',
  'bankingPassword',
  'internetBankingPassword',
  'internetBankaciligiParolasi',
  'internetBankaciligiSifresi'
] as const);

const canonicalFieldName = (value: string): string => value
  .normalize('NFKD')
  .replace(/[ıİ]/gu, 'i')
  .replace(/[\u0300-\u036f]/gu, '')
  .replace(/[^a-z0-9]/giu, '')
  .toLocaleLowerCase('en-US');

const prohibitedFieldNames = new Set(PROHIBITED_BANKING_SECRET_FIELDS.map(canonicalFieldName));
const allowedBankAccountFieldNames = new Set(BANK_ACCOUNT_INPUT_KEYS);

export const isProhibitedBankingSecretField = (value: string): boolean =>
  prohibitedFieldNames.has(canonicalFieldName(value));

export interface BankingDataContractInspection {
  readonly accepted: boolean;
  readonly prohibitedFields: readonly string[];
  readonly unknownFields: readonly string[];
  readonly panLikeValueDetected: boolean;
}

const luhnValid = (digits: string): boolean => {
  let sum = 0;
  let doubleDigit = false;
  for (let index = digits.length - 1; index >= 0; index -= 1) {
    let digit = Number(digits[index]);
    if (doubleDigit) {
      digit *= 2;
      if (digit > 9) digit -= 9;
    }
    sum += digit;
    doubleDigit = !doubleDigit;
  }
  return sum % 10 === 0;
};

export const containsLikelyFullPan = (value: unknown): boolean => {
  if (typeof value !== 'string') return false;
  const candidates = value.match(/(?:\d[ -]?){12,18}\d/gu) ?? [];
  return candidates.some((candidate) => {
    const digits = candidate.replace(/\D/gu, '');
    return digits.length >= 13 && digits.length <= 19 && luhnValid(digits);
  });
};

export interface ProhibitedBankingSecretInspection {
  readonly prohibitedFields: readonly string[];
  readonly panLikeValueDetected: boolean;
}

export const inspectProhibitedBankingSecrets = (
  input: unknown,
  panSearchFields: readonly string[]
): ProhibitedBankingSecretInspection => {
  if (typeof input !== 'object' || input === null || Array.isArray(input)) {
    return Object.freeze({ prohibitedFields: [], panLikeValueDetected: false });
  }
  const record = input as Record<string, unknown>;
  return Object.freeze({
    prohibitedFields: Object.freeze(Object.keys(record).filter(isProhibitedBankingSecretField)),
    panLikeValueDetected: panSearchFields.some((key) => containsLikelyFullPan(record[key]))
  });
};

export const inspectBankAccountDataContract = (input: unknown): BankingDataContractInspection => {
  if (typeof input !== 'object' || input === null || Array.isArray(input)) {
    return Object.freeze({ accepted: false, prohibitedFields: [], unknownFields: ['$'], panLikeValueDetected: false });
  }
  const record = input as Record<string, unknown>;
  const secretInspection = inspectProhibitedBankingSecrets(record, ['alias', 'branch']);
  const prohibitedFields = secretInspection.prohibitedFields;
  const unknownFields = Object.keys(record).filter((key) => !allowedBankAccountFieldNames.has(key as typeof BANK_ACCOUNT_INPUT_KEYS[number]));
  const panLikeValueDetected = secretInspection.panLikeValueDetected;
  return Object.freeze({
    accepted: prohibitedFields.length === 0 && unknownFields.length === 0 && !panLikeValueDetected,
    prohibitedFields: Object.freeze(prohibitedFields),
    unknownFields: Object.freeze(unknownFields),
    panLikeValueDetected
  });
};

export const normalizeIban = (value: string): string => value
  .normalize('NFKC')
  .toLocaleUpperCase('en-US')
  .replace(/[\s-]+/gu, '');

export const maskIban = (normalizedIban: string): string => {
  if (normalizedIban.length <= 8) return '••••';
  const concealed = '•'.repeat(normalizedIban.length - 8).match(/.{1,4}/gu) ?? [];
  return [normalizedIban.slice(0, 4), ...concealed, normalizedIban.slice(-4)].join(' ');
};

const mod97Valid = (iban: string): boolean => {
  if (!/^[A-Z0-9]+$/u.test(iban) || iban.length < 5) return false;
  const rearranged = `${iban.slice(4)}${iban.slice(0, 4)}`;
  let remainder = 0;
  for (const character of rearranged) {
    const numeric = character >= 'A' && character <= 'Z'
      ? String(character.charCodeAt(0) - 55)
      : character;
    for (const digit of numeric) remainder = ((remainder * 10) + Number(digit)) % 97;
  }
  return remainder === 1;
};

const IBAN_COUNTRY_LENGTHS = Object.freeze({ TR: 26 } as const);

export const validateIbanStructure = (
  rawIban: string,
  institutions: readonly BankInstitutionView[]
): IbanStructuralValidationView => {
  const normalized = normalizeIban(rawIban);
  const errors: IbanStructuralErrorCode[] = [];
  if (normalized.length === 0) errors.push('EMPTY');
  const charactersValid = /^[A-Z0-9]+$/u.test(normalized);
  if (normalized.length > 0 && !charactersValid) errors.push('INVALID_CHARACTERS');
  const countryCode = /^[A-Z]{2}/u.test(normalized) ? normalized.slice(0, 2) : undefined;
  const countryFormatValid = countryCode !== undefined;
  const expectedLength = countryCode === 'TR' ? IBAN_COUNTRY_LENGTHS.TR : undefined;
  if (countryCode && expectedLength === undefined) errors.push('COUNTRY_UNSUPPORTED');
  const lengthValid = expectedLength !== undefined && normalized.length === expectedLength;
  if (expectedLength !== undefined && !lengthValid) errors.push('LENGTH_MISMATCH');
  const checksumValid = charactersValid && lengthValid && mod97Valid(normalized);
  if (charactersValid && lengthValid && !checksumValid) errors.push('CHECKSUM_INVALID');

  const trProviderCode = countryCode === 'TR' && normalized.length >= 9 ? normalized.slice(4, 9) : undefined;
  const trProviderCodeValid = trProviderCode !== undefined && /^\d{5}$/u.test(trProviderCode);
  if (countryCode === 'TR' && !trProviderCodeValid) errors.push('TR_PROVIDER_CODE_INVALID');
  const trReservedFieldValid = countryCode === 'TR' ? normalized[9] === '0' : undefined;
  if (countryCode === 'TR' && trReservedFieldValid !== true) errors.push('TR_RESERVED_FIELD_INVALID');
  const institution = trProviderCodeValid
    ? institutions.find((candidate) => candidate.ibanProviderCode === trProviderCode && candidate.status === 'active')
    : undefined;
  const institutionMatched = institution !== undefined;
  if (countryCode === 'TR' && trProviderCodeValid && !institutionMatched) errors.push('TR_INSTITUTION_NOT_FOUND');

  const structurallyValid = countryCode === 'TR'
    && countryFormatValid
    && lengthValid
    && checksumValid
    && trProviderCodeValid
    && trReservedFieldValid === true
    && institutionMatched;
  return Object.freeze({
    ...(countryCode ? { countryCode } : {}),
    ...(expectedLength === undefined ? {} : { expectedLength }),
    actualLength: normalized.length,
    structurallyValid,
    countryFormatValid,
    lengthValid,
    checksumValid,
    ...(trProviderCode ? { trProviderCode } : {}),
    ...(trReservedFieldValid === undefined ? {} : { trReservedFieldValid }),
    institutionMatched,
    ...(institution ? {
      institutionCode: institution.institutionCode,
      institutionOfficialName: institution.officialName
    } : {}),
    ...(normalized.length >= 8 && charactersValid ? { maskedIban: maskIban(normalized) } : {}),
    errorCodes: Object.freeze(errors),
    accountVerification: 'not_performed',
    ownershipVerification: 'not_performed'
  });
};

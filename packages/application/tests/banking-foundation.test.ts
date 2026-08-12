import { describe, expect, it } from 'vitest';
import type { BankInstitutionView } from '@ppt/domain';
import {
  inspectBankAccountDataContract,
  inspectProhibitedBankingSecrets,
  maskIban,
  normalizeIban,
  validateIbanStructure
} from '../src/banking-security.js';

const institution: BankInstitutionView = Object.freeze({
  institutionCode: '0046',
  ibanProviderCode: '00046',
  officialName: 'AKBANK T.A.Ş.',
  countryCode: 'TR',
  kind: 'bank',
  supportsCustomerAccounts: true,
  iconKey: 'bank-00046',
  iconSource: 'local_lettermark',
  sourceName: 'TCMB Ödeme Sistemleri Katılımcıları',
  sourceVersion: '2026',
  sourceUrl: 'https://www.tcmb.gov.tr/odeme-sistemleri',
  sourceRetrievedAt: '2026-08-12T00:00:00.000Z',
  status: 'active'
});

const createTurkishIban = (providerCode: string, accountNumber = '0000000000000001'): string => {
  const bban = `${providerCode}0${accountNumber}`;
  const remainder = BigInt(`${bban}292700`) % 97n;
  const checkDigits = String(98n - remainder).padStart(2, '0');
  return `TR${checkDigits}${bban}`;
};

describe('32-Z B4 banking foundation', () => {
  it('normalizes and validates the exact TR length, MOD 97-10, reserved field and TCMB provider code', () => {
    const iban = createTurkishIban(institution.ibanProviderCode);
    const printable = iban.match(/.{1,4}/gu)!.join(' ');
    const validation = validateIbanStructure(printable, [institution]);

    expect(normalizeIban(printable)).toBe(iban);
    expect(validation).toMatchObject({
      countryCode: 'TR',
      expectedLength: 26,
      actualLength: 26,
      structurallyValid: true,
      checksumValid: true,
      trProviderCode: '00046',
      trReservedFieldValid: true,
      institutionMatched: true,
      institutionCode: '0046',
      accountVerification: 'not_performed',
      ownershipVerification: 'not_performed'
    });
    expect(validation.maskedIban).toBe(maskIban(iban));
    expect(validation.maskedIban).not.toContain(iban);
  });

  it('fails closed for checksum, unsupported country, reserved field and unmatched institution failures', () => {
    const valid = createTurkishIban(institution.ibanProviderCode);
    const wrongChecksum = `${valid.slice(0, 2)}00${valid.slice(4)}`;
    expect(validateIbanStructure(wrongChecksum, [institution])).toMatchObject({
      structurallyValid: false,
      checksumValid: false
    });
    expect(validateIbanStructure('DE89370400440532013000', [institution])).toMatchObject({
      structurallyValid: false,
      errorCodes: ['COUNTRY_UNSUPPORTED']
    });
    const wrongReserved = `${valid.slice(0, 9)}1${valid.slice(10)}`;
    expect(validateIbanStructure(wrongReserved, [institution]).errorCodes).toContain('TR_RESERVED_FIELD_INVALID');
    expect(validateIbanStructure(createTurkishIban('00064'), [institution]).errorCodes).toContain('TR_INSTITUTION_NOT_FOUND');
  });

  it('rejects prohibited banking secret fields, unknown fields and Luhn-valid full PAN values', () => {
    const safe = {
      ownerPersonId: 'person-1', institutionCode: '0046', iban: createTurkishIban('00046'),
      accountType: 'checking', currency: 'TRY', alias: 'Aile bütçesi', ownershipBasisPoints: 10_000,
      status: 'active', privacy: 'private'
    };
    expect(inspectBankAccountDataContract(safe)).toMatchObject({ accepted: true });
    expect(inspectBankAccountDataContract({ ...safe, cvv: '123' })).toMatchObject({
      accepted: false,
      prohibitedFields: ['cvv']
    });
    expect(inspectBankAccountDataContract({ ...safe, futureField: true })).toMatchObject({
      accepted: false,
      unknownFields: ['futureField']
    });
    expect(inspectBankAccountDataContract({ ...safe, alias: 'Kart 4111 1111 1111 1111' })).toMatchObject({
      accepted: false,
      panLikeValueDetected: true
    });
    expect(inspectProhibitedBankingSecrets({ title: 'Kart 4111 1111 1111 1111' }, ['title']))
      .toMatchObject({ panLikeValueDetected: true });
    expect(inspectProhibitedBankingSecrets({ internet_banking_password: 'secret' }, []))
      .toMatchObject({ prohibitedFields: ['internet_banking_password'] });
  });
});

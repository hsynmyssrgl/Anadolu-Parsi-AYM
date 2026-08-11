import { describe, expect, it } from 'vitest';
import { assessPassword, isValidEmail, normalizeEmail, validateCoordinates } from '../src/index.js';

describe('user input validation', () => {
  it('reports every password requirement and remaining length', () => {
    const weak = assessPassword('abc');
    expect(weak.valid).toBe(false);
    expect(weak.remainingCharacters).toBe(9);
    expect(weak.checks.lowercase).toBe(true);
    expect(assessPassword('Güvenli123!Parola').valid).toBe(true);
  });

  it('normalizes and validates email addresses', () => {
    expect(normalizeEmail('  TEST@EXAMPLE.COM ')).toBe('test@example.com');
    expect(isValidEmail('aile@example.com')).toBe(true);
    expect(isValidEmail('hatalı-adres')).toBe(false);
  });

  it('requires coordinate pairs and valid geographic ranges', () => {
    expect(validateCoordinates(undefined, undefined)).toBeNull();
    expect(validateCoordinates(41, undefined)).toMatch(/birlikte/);
    expect(validateCoordinates(91, 29)).toMatch(/Enlem/);
    expect(validateCoordinates(41.1, 29.0)).toBeNull();
  });
});

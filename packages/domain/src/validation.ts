export interface PasswordAssessment {
  valid: boolean;
  remainingCharacters: number;
  checks: {
    minimumLength: boolean;
    uppercase: boolean;
    lowercase: boolean;
    digit: boolean;
    symbol: boolean;
  };
}

export function assessPassword(password: string, minimumLength = 12): PasswordAssessment {
  const checks = {
    minimumLength: password.length >= minimumLength,
    uppercase: /[A-ZÇĞİÖŞÜ]/u.test(password),
    lowercase: /[a-zçğıöşü]/u.test(password),
    digit: /\d/u.test(password),
    symbol: /[^\p{L}\p{N}\s]/u.test(password)
  };
  return {
    valid: Object.values(checks).every(Boolean),
    remainingCharacters: Math.max(0, minimumLength - password.length),
    checks
  };
}

export function normalizeEmail(value: string): string {
  return value.trim().toLocaleLowerCase('tr-TR');
}

export function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/u.test(normalizeEmail(value));
}

export function validateCoordinates(latitude?: number, longitude?: number): string | null {
  if (latitude === undefined && longitude === undefined) return null;
  if (latitude === undefined || longitude === undefined) return 'Enlem ve boylam birlikte girilmelidir.';
  if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90) return 'Enlem -90 ile 90 arasında olmalıdır.';
  if (!Number.isFinite(longitude) || longitude < -180 || longitude > 180) return 'Boylam -180 ile 180 arasında olmalıdır.';
  return null;
}

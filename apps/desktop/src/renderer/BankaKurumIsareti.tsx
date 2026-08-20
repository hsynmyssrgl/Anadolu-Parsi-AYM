import type { CSSProperties } from 'react';

export interface BankaKurumKimligi {
  readonly institutionCode: string;
  readonly officialName: string;
}

export interface BankaKurumGorseli {
  readonly shortLabel: string;
  readonly background: string;
  readonly foreground: string;
}

const KNOWN_VISUALS: Readonly<Record<string, BankaKurumGorseli>> = Object.freeze({
  '0010': { shortLabel: 'Z', background: '#b01f2e', foreground: '#ffffff' },
  '0012': { shortLabel: 'H', background: '#0f5ea8', foreground: '#ffffff' },
  '0015': { shortLabel: 'V', background: '#f2c500', foreground: '#171717' },
  '0032': { shortLabel: 'TEB', background: '#007d8a', foreground: '#ffffff' },
  '0046': { shortLabel: 'AK', background: '#d81f2a', foreground: '#ffffff' },
  '0059': { shortLabel: 'Ş', background: '#1d8a55', foreground: '#ffffff' },
  '0062': { shortLabel: 'G', background: '#17804b', foreground: '#ffffff' },
  '0064': { shortLabel: 'İŞ', background: '#123b70', foreground: '#ffffff' },
  '0067': { shortLabel: 'YK', background: '#174e9c', foreground: '#ffffff' },
  '0099': { shortLabel: 'ING', background: '#ed6b21', foreground: '#ffffff' },
  '0103': { shortLabel: 'F', background: '#156d63', foreground: '#ffffff' },
  '0111': { shortLabel: 'QNB', background: '#5a246f', foreground: '#ffffff' },
  '0123': { shortLabel: 'HSBC', background: '#d71920', foreground: '#ffffff' },
  '0124': { shortLabel: 'A', background: '#542b84', foreground: '#ffffff' },
  '0125': { shortLabel: 'B', background: '#006aa7', foreground: '#ffffff' },
  '0134': { shortLabel: 'D', background: '#0069aa', foreground: '#ffffff' },
  '0135': { shortLabel: 'AB', background: '#143f79', foreground: '#ffffff' },
  '0137': { shortLabel: 'H', background: '#ff5a36', foreground: '#ffffff' },
  '0143': { shortLabel: 'N', background: '#773b8f', foreground: '#ffffff' },
  '0146': { shortLabel: 'O', background: '#6b2c91', foreground: '#ffffff' },
  '0157': { shortLabel: 'E', background: '#6c2c91', foreground: '#ffffff' },
  '0158': { shortLabel: 'C', background: '#111827', foreground: '#ffffff' },
  '0159': { shortLabel: 'F', background: '#eb4b3f', foreground: '#ffffff' },
  '0203': { shortLabel: 'A', background: '#b11f32', foreground: '#ffffff' },
  '0205': { shortLabel: 'KT', background: '#127c49', foreground: '#ffffff' },
  '0206': { shortLabel: 'TF', background: '#00694f', foreground: '#ffffff' },
  '0209': { shortLabel: 'ZK', background: '#8c1d2c', foreground: '#ffffff' },
  '0210': { shortLabel: 'VK', background: '#c99c2e', foreground: '#171717' },
  '0211': { shortLabel: 'EK', background: '#0d766e', foreground: '#ffffff' },
  '0212': { shortLabel: 'HF', background: '#2d7a4e', foreground: '#ffffff' },
  '0213': { shortLabel: 'TOM', background: '#4b5563', foreground: '#ffffff' },
  '0214': { shortLabel: 'D', background: '#165c3d', foreground: '#ffffff' },
  '0215': { shortLabel: 'A', background: '#80631d', foreground: '#ffffff' },
  '0216': { shortLabel: 'İK', background: '#4e6b3c', foreground: '#ffffff' },
  '0807': { shortLabel: 'PTT', background: '#f2c500', foreground: '#17375e' }
});

const FALLBACK_COLORS = Object.freeze([
  '#315f7d', '#6f4b7c', '#406b5a', '#875a38', '#5e6472', '#356a79', '#765b3c', '#4f5d75'
] as const);

const GENERIC_WORDS = new Set([
  'A', 'AS', 'BANK', 'BANKA', 'BANKASI', 'KATILIM', 'KREDI', 'KALK', 'T', 'TAO', 'TURK', 'TURKEY',
  'TURKIYE', 'YATIRIM', 'VE'
]);

const asciiUpper = (value: string): string => value
  .replaceAll('İ', 'I').replaceAll('ı', 'I').replaceAll('Ş', 'S').replaceAll('ş', 'S')
  .replaceAll('Ğ', 'G').replaceAll('ğ', 'G').replaceAll('Ü', 'U').replaceAll('ü', 'U')
  .replaceAll('Ö', 'O').replaceAll('ö', 'O').replaceAll('Ç', 'C').replaceAll('ç', 'C')
  .normalize('NFKD').replaceAll(/[\u0300-\u036f]/gu, '').toUpperCase();

const deriveShortLabel = (officialName: string): string => {
  const words = asciiUpper(officialName).split(/[^A-Z0-9]+/u)
    .filter((word) => word.length > 0 && !GENERIC_WORDS.has(word));
  if (words.length === 0) return 'B';
  if (words.length === 1) return words[0]!.slice(0, 3);
  return words.slice(0, 3).map((word) => word[0]).join('');
};

export const resolveBankaKurumGorseli = (institution: BankaKurumKimligi): BankaKurumGorseli => {
  const known = KNOWN_VISUALS[institution.institutionCode];
  if (known) return known;
  const numericCode = Number.parseInt(institution.institutionCode, 10);
  const paletteIndex = Number.isFinite(numericCode) ? numericCode % FALLBACK_COLORS.length : 0;
  return Object.freeze({
    shortLabel: deriveShortLabel(institution.officialName),
    background: FALLBACK_COLORS[paletteIndex]!,
    foreground: '#ffffff'
  });
};

export function BankaKurumIsareti({
  institution,
  compact = false
}: {
  readonly institution: BankaKurumKimligi;
  readonly compact?: boolean;
}) {
  const visual = resolveBankaKurumGorseli(institution);
  const style = {
    '--bank-mark-background': visual.background,
    '--bank-mark-foreground': visual.foreground
  } as CSSProperties;
  return (
    <span
      className={`bank-institution-mark${compact ? ' is-compact' : ''}`}
      style={style}
      role="img"
      aria-label={`${institution.officialName} yerel kurum işareti`}
      title={`${institution.officialName} · çevrimdışı yerel kurum işareti`}
    >
      <span aria-hidden="true">{visual.shortLabel}</span>
    </span>
  );
}

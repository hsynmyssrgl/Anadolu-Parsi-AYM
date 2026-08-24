import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { translatePrivacyOwnershipCopy } from '../src/renderer/GizlilikSahiplikYerellestirme';
import { translatePermissionsCopy } from '../src/renderer/YetkilerYerellestirme';

const app = readFileSync('apps/desktop/src/renderer/App.tsx', 'utf8');
const localization = readFileSync('apps/desktop/src/renderer/localization.tsx', 'utf8');
const styles = readFileSync('apps/desktop/src/renderer/styles.css', 'utf8');
const rendererSources = [
  app,
  readFileSync('apps/desktop/src/renderer/FinancePlanningPanel.tsx', 'utf8'),
  readFileSync('apps/desktop/src/renderer/FinanceImportPanel.tsx', 'utf8'),
  readFileSync('apps/desktop/src/renderer/ManagedLifePanel.tsx', 'utf8')
].join('\n');

describe('Turkish interface copy and light-theme contrast', () => {
  it('keeps first-run security and visible governance copy in plain Turkish', () => {
    expect(localization).toContain("'security.authenticator':'Kimlik doğrulayıcı kurulumu'");
    expect(localization).toContain("'security.code':'Kimlik doğrulayıcı kodu'");
    expect(app).toContain('Uygulama verilerine güvenli erişim');
    expect(app).toContain('Kapalı ve güvenli ret etkin');
    expect(app).toContain('Mevcut yerel verileriniz korunur');
    expect(app).toContain("'Etkin kira yok'");
    expect(app).toContain('Güvenli veri erişimi');
    expect(app).toContain('Süreli çevrimdışı erişim');
    expect(app).toContain('Olay ve yerel sınırlama');
    expect(app).toContain('iki aşamalı doğrulama ve yedeklemeyi');
    expect(app).not.toContain('Repository, SQL, SQLite ve kasa erişimi kapalı');
    expect(app).not.toContain('Olay ve yerel containment');
    expect(app).not.toMatch(/eyebrow=["'](?:PPK-\d+|B\d+-\d+)/u);
    expect(app).not.toMatch(/className="eyebrow">(?:PPK-\d+|B\d+-\d+)/u);
    expect(rendererSources).not.toMatch(/eyebrow=["'](?:PPK-\d+|B\d+(?:-\d+)?|EXT-\d+)/u);
    expect(app).not.toContain("setScreenDataError(error instanceof Error?error.message");
  });

  it('preserves the English localization of the revised Turkish source copy', () => {
    expect(translatePermissionsCopy('Uygulama verilerine güvenli erişim', 'en')).toBe('Secure access to application data');
    expect(translatePermissionsCopy('Etkin kira yok', 'en')).toBe('No active lease');
    expect(translatePrivacyOwnershipCopy('Olay ve yerel sınırlama', 'en')).toBe('Incident and local containment');
  });

  it('uses the release text color for labels on the light application shell', () => {
    expect(styles).toContain('.app-shell[data-theme="light"] :is(.workspace-form>label,.workspace-form form>label,.form-grid label,.security-grid label,.privacy-ownership-grid label,.identity-access-card label,.windows-hello-fallback label)');
    expect(styles).toContain('color:var(--release-text);');
  });
});

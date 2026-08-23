import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { translatePrivacyOwnershipCopy } from '../src/renderer/GizlilikSahiplikYerellestirme';
import { translatePermissionsCopy } from '../src/renderer/YetkilerYerellestirme';

const app = readFileSync('apps/desktop/src/renderer/App.tsx', 'utf8');
const localization = readFileSync('apps/desktop/src/renderer/localization.tsx', 'utf8');
const styles = readFileSync('apps/desktop/src/renderer/styles.css', 'utf8');

describe('Turkish interface copy and light-theme contrast', () => {
  it('keeps first-run security and visible governance copy in plain Turkish', () => {
    expect(localization).toContain("'security.authenticator':'Kimlik doğrulayıcı kurulumu'");
    expect(localization).toContain("'security.code':'Kimlik doğrulayıcı kodu'");
    expect(app).toContain('Veri deposu, SQL, SQLite ve kasa erişimi kapalı');
    expect(app).toContain('Yasak ve güvenli ret etkin');
    expect(app).toContain('Mevcut masaüstü kasası korunur');
    expect(app).toContain("'Etkin kira yok'");
    expect(app).toContain('Olay ve yerel sınırlama');
    expect(app).toContain('iki aşamalı doğrulama ve yedeklemeyi');
    expect(app).not.toContain('Repository, SQL, SQLite ve kasa erişimi kapalı');
    expect(app).not.toContain('Olay ve yerel containment');
  });

  it('preserves the English localization of the revised Turkish source copy', () => {
    expect(translatePermissionsCopy('Veri deposu, SQL, SQLite ve kasa erişimi kapalı', 'en')).toBe('Repository, SQL, SQLite, and vault access closed');
    expect(translatePermissionsCopy('Etkin kira yok', 'en')).toBe('No active lease');
    expect(translatePrivacyOwnershipCopy('Olay ve yerel sınırlama', 'en')).toBe('Incident and local containment');
  });

  it('uses the release text color for labels on the light application shell', () => {
    expect(styles).toContain('.app-shell[data-theme="light"] :is(.workspace-form>label,.workspace-form form>label,.form-grid label,.security-grid label,.privacy-ownership-grid label,.identity-access-card label,.windows-hello-fallback label)');
    expect(styles).toContain('color:var(--release-text);');
  });
});

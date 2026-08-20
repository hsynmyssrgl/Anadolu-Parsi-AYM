import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { resolveUiLocalization, type AuthStateView } from '@ppt/domain';
import { AuthScreen, InvitationAcceptancePanel } from '../src/renderer/App';
import { LocalizationProvider } from '../src/renderer/localization';

const uninitialized: AuthStateView = { initialized: false, authenticated: false };
const initialized: AuthStateView = {
  initialized: true,
  authenticated: false,
  twoFactorEnabled: false,
  profiles: [{ id: 'account-1', displayName: 'Test User', initials: 'TU', role: 'family_admin' }]
};

const renderLocalized = (locale: 'tr-TR'|'en-US', child: ReturnType<typeof createElement>): string => renderToStaticMarkup(createElement(
  LocalizationProvider,
  { bootstrap: resolveUiLocalization(locale) },
  child
));

const auth = (locale: 'tr-TR'|'en-US', state: AuthStateView): string => renderLocalized(locale, createElement(AuthScreen, {
  auth: state,
  onSetup: async () => undefined,
  onLogin: async () => undefined,
  onWindowsHelloLogin: async () => undefined,
  onInvitationAccepted: async () => undefined
}));

describe('app shell English localization wave twenty-three', () => {
  it('renders initial setup and returning sign-in without visible Turkish copy in English', () => {
    const html = `${auth('en-US', uninitialized)} ${auth('en-US', initialized)}`;
    expect(html).toContain('Let’s create your family');
    expect(html).toContain('I have an invitation code');
    expect(html).toContain('ParsYuva Aile Yaşam Merkezi');
    const copyWithoutProperProductName = html
      .replaceAll('ParsYuva Aile Yaşam Merkezi', '')
      .replaceAll('Aile Yaşam Merkezi', '');
    expect(copyWithoutProperProductName).not.toMatch(/[ÇĞİÖŞÜçğıöşü]/u);
  });

  it('renders the expanded invitation entry in English', () => {
    const html = renderLocalized('en-US', createElement(InvitationAcceptancePanel, {
      initiallyExpanded: true,
      onAccepted: async () => undefined
    }));
    expect(html).toContain('Join by invitation');
    expect(html).toContain('Verify code');
    expect(html).not.toMatch(/[ÇĞİÖŞÜçğıöşü]/u);
  });

  it('preserves the Turkish setup and invitation copy', () => {
    expect(auth('tr-TR', uninitialized)).toContain('Ailenizi oluşturalım');
    expect(renderLocalized('tr-TR', createElement(InvitationAcceptancePanel, {
      initiallyExpanded: true,
      onAccepted: async () => undefined
    }))).toContain('Davetle katılın');
  });
});

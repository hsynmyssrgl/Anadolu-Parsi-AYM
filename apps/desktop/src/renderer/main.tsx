import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { DEFAULT_UI_LOCALIZATION, type UiLocalizationBootstrapView } from '@ppt/domain/renderer';
import { App } from './App';
import { LocalizationProvider, configureUiLocalization } from './localization';
import './styles.css';
import './typography.css';

const startRenderer = async (): Promise<void> => {
  let localization: UiLocalizationBootstrapView = DEFAULT_UI_LOCALIZATION;
  try {
    const bridge = window.pardus;
    if (bridge) localization = await bridge.getLocalizationBootstrap();
  } catch {
    // English is the fail-safe UI language when the main-process locale cannot be resolved.
  }
  configureUiLocalization(localization);
  document.documentElement.lang = localization.locale;
  document.documentElement.dataset.uiLanguage = localization.language;
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <LocalizationProvider bootstrap={localization}>
        <App />
      </LocalizationProvider>
    </StrictMode>
  );
};

void startRenderer();

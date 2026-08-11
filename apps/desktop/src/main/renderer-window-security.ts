export interface SecureRendererPreferences {
  readonly preload: string;
  readonly nodeIntegration: false;
  readonly contextIsolation: true;
  readonly sandbox: true;
  readonly devTools: boolean;
  readonly webSecurity: true;
  readonly allowRunningInsecureContent: false;
  readonly webviewTag: false;
  readonly navigateOnDragDrop: false;
}

export interface RendererSecurityPolicyEvidence {
  readonly nodeIntegration: false;
  readonly contextIsolation: true;
  readonly sandbox: true;
  readonly webSecurity: true;
  readonly allowRunningInsecureContent: false;
  readonly webviewTag: false;
  readonly navigateOnDragDrop: false;
  readonly devToolsEnabled: boolean;
}

export const createSecureRendererPreferences = (
  preload: string,
  devToolsEnabled: boolean
): SecureRendererPreferences => ({
  preload,
  nodeIntegration: false,
  contextIsolation: true,
  sandbox: true,
  devTools: devToolsEnabled,
  webSecurity: true,
  allowRunningInsecureContent: false,
  webviewTag: false,
  navigateOnDragDrop: false
});

export const assertSecureRendererPreferences = (
  preferences: SecureRendererPreferences
): RendererSecurityPolicyEvidence => {
  if (preferences.nodeIntegration !== false) {
    throw new Error('Renderer Node.js entegrasyonu kapalı olmalıdır.');
  }
  if (preferences.contextIsolation !== true) {
    throw new Error('Renderer contextIsolation etkin olmalıdır.');
  }
  if (preferences.sandbox !== true) {
    throw new Error('Renderer sandbox etkin olmalıdır.');
  }
  if (preferences.webSecurity !== true) {
    throw new Error('Renderer webSecurity etkin olmalıdır.');
  }
  if (preferences.allowRunningInsecureContent !== false) {
    throw new Error('Güvensiz içerik çalıştırma kapalı olmalıdır.');
  }
  if (preferences.webviewTag !== false) {
    throw new Error('Renderer webview etiketi kapalı olmalıdır.');
  }
  if (preferences.navigateOnDragDrop !== false) {
    throw new Error('Sürükle-bırak ile gezinme kapalı olmalıdır.');
  }
  return {
    nodeIntegration: false,
    contextIsolation: true,
    sandbox: true,
    webSecurity: true,
    allowRunningInsecureContent: false,
    webviewTag: false,
    navigateOnDragDrop: false,
    devToolsEnabled: preferences.devTools
  };
};
